// MINC · Peritagem — função de administração de usuários (roda no servidor, nunca no navegador).
// A chave de serviço (service_role) só existe aqui, nos segredos da função. O navegador envia apenas o login do
// administrador; esta função confere quem chama, aplica as travas e só então usa a chave de serviço.
// Código escrito em JavaScript puro dentro de .ts para poder ser testado fora do Deno.
//
// v2: cadastro por NOME DE USUÁRIO (sem e-mail). O login é criado com um e-mail interno fictício
//     (<usuario>@usuarios.minc.ind.br), já confirmado, e nenhuma mensagem é enviada.
//     Ações: invite (e-mail real, como antes) · create (usuário + senha) · setpassword · update · resend.
// v3: perfil "gestor" (acesso a tudo, menos Administração de usuários). Só o administrador usa esta função.

export const SITE_URL = 'https://minc-peritagem.netlify.app';
export const INTERNAL_DOMAIN = 'usuarios.minc.ind.br';
export const ALLOWED_ORIGINS = [SITE_URL, 'http://localhost:8000', 'http://localhost:8765', 'http://127.0.0.1:8000'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const PASS_MIN = 8, PASS_MAX = 72;
const ROLES = ['admin', 'gestor', 'operador', 'pendente'];
const NEW_ROLES = ['admin', 'gestor', 'operador'];
const STATUSES = ['ativo', 'bloqueado'];
const BAN = '876000h'; // ~100 anos: bloqueio até o administrador desbloquear

const isInternal = (email) => String(email || '').toLowerCase().endsWith('@' + INTERNAL_DOMAIN);
// Nome mostrado na auditoria: usuário (se o e-mail é interno) ou e-mail real.
const ident = (p) => (p && (isInternal(p.email) ? (p.username || String(p.email).split('@')[0]) : p.email)) || null;

function cors(origin) {
  const h = {
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
function json(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
const fail = (status, error, origin) => json(status, { ok: false, error }, origin);

async function getProfile(admin, id) {
  const r = await admin.from('profiles').select('id,email,username,name,role,status').eq('id', id).single();
  return r.error ? null : r.data;
}
async function audit(admin, caller, action, target, details) {
  try {
    await admin.from('admin_audit').insert({
      actor_id: caller.id, actor_email: ident(caller) || null, action,
      target_id: target?.id || null, target_email: ident(target), details: details || {},
    });
  } catch (e) { console.error('audit', e?.message); }
}
function mapAuthError(e) {
  const m = String(e?.message || '');
  if (e?.status === 429 || /rate limit/i.test(m)) return [429, 'Limite de e-mails do Supabase atingido. Use "Gerar link" ou configure um servidor de e-mail próprio (SMTP).'];
  if (/already.*registered|already been registered|exists/i.test(m)) return [409, 'Já existe um usuário com este e-mail.'];
  if (/password/i.test(m)) return [400, 'Senha recusada pelo serviço de autenticação. Use ao menos ' + PASS_MIN + ' caracteres.'];
  return [502, 'Não foi possível concluir a operação no serviço de autenticação.'];
}
const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const checkPass = (p) => (typeof p === 'string' && p.length >= PASS_MIN && p.length <= PASS_MAX);

export async function handle(req, deps) {
  const origin = req.headers.get('origin');
  const originOk = !origin || ALLOWED_ORIGINS.includes(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: originOk ? 204 : 403, headers: cors(origin) });
  if (req.method !== 'POST') return fail(405, 'Método não permitido.', origin);
  if (!originOk) return fail(403, 'Origem não permitida.', origin);

  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return fail(401, 'Sessão ausente. Entre novamente.', origin);

  const { admin, siteUrl } = deps;
  try {
    const u = await admin.auth.getUser(token);
    if (u.error || !u.data?.user) return fail(401, 'Sessão inválida. Entre novamente.', origin);
    const caller = u.data.user;
    const cp = await getProfile(admin, caller.id);
    if (!cp || cp.role !== 'admin' || cp.status !== 'ativo') return fail(403, 'Apenas administradores ativos podem fazer isso.', origin);
    caller.email = caller.email || cp.email;
    caller.username = cp.username || null;

    let body;
    try { body = await req.json(); } catch { return fail(400, 'Requisição inválida.', origin); }
    const action = body?.action;

    /* ---------- criar por nome de usuário (sem e-mail) ---------- */
    if (action === 'create') {
      const username = clean(body.username, 40).toLowerCase(), name = clean(body.name, 80), role = body.role, password = body.password;
      if (!USERNAME_RE.test(username)) return fail(400, 'Usuário inválido: use 3 a 30 caracteres (letras minúsculas, números, ponto, hífen ou sublinhado), começando por letra ou número.', origin);
      if (name.length < 2) return fail(400, 'Informe o nome (mínimo 2 letras).', origin);
      if (!NEW_ROLES.includes(role)) return fail(400, 'Escolha o perfil: administrador, gestor ou funcionário.', origin);
      if (!checkPass(password)) return fail(400, 'A senha provisória precisa ter de ' + PASS_MIN + ' a ' + PASS_MAX + ' caracteres.', origin);
      const email = username + '@' + INTERNAL_DOMAIN;
      const ex = await admin.from('profiles').select('id').or('username.eq.' + username + ',email.eq.' + email);
      if (ex.data && ex.data.length) return fail(409, 'Já existe um usuário com este nome de usuário.', origin);

      const r = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { name, username, must_change_password: true },
      });
      if (r.error) { const [s, m] = mapAuthError(r.error); return fail(s, /e-mail/.test(m) ? 'Já existe um usuário com este nome de usuário.' : m, origin); }
      const user = r.data.user;
      const pr = await admin.from('profiles').upsert({ id: user.id, email, username, name, role, status: 'ativo' });
      if (pr.error) {
        console.error('perfil', pr.error.message);
        await admin.auth.admin.deleteUser(user.id); // não deixa login órfão sem perfil
        return fail(500, 'Não foi possível gravar o perfil. Nada foi criado; tente novamente.', origin);
      }
      await audit(admin, caller, 'criar_usuario', { id: user.id, email, username }, { role, sem_email: true });
      return json(200, { ok: true, user: { id: user.id, email, username, name, role, status: 'ativo' } }, origin);
    }

    /* ---------- definir (ou redefinir) senha ---------- */
    if (action === 'setpassword') {
      const userId = clean(body.userId, 64), password = body.password;
      const target = userId ? await getProfile(admin, userId) : null;
      if (!target) return fail(404, 'Usuário não encontrado.', origin);
      if (!checkPass(password)) return fail(400, 'A senha provisória precisa ter de ' + PASS_MIN + ' a ' + PASS_MAX + ' caracteres.', origin);
      const au = await admin.auth.admin.getUserById(userId);
      if (au.error || !au.data?.user) return fail(404, 'Usuário não encontrado.', origin);
      const meta = { ...(au.data.user.user_metadata || {}) };
      if (userId !== caller.id) meta.must_change_password = true; // o próprio admin não é forçado a trocar
      const up = await admin.auth.admin.updateUserById(userId, { password, user_metadata: meta });
      if (up.error) { const [s, m] = mapAuthError(up.error); return fail(s, m, origin); }
      await audit(admin, caller, 'definir_senha', target, { proprio: userId === caller.id });
      return json(200, { ok: true }, origin);
    }

    /* ---------- convidar por e-mail real (como antes) ---------- */
    if (action === 'invite') {
      const email = clean(body.email, 200).toLowerCase(), name = clean(body.name, 80), role = body.role, mode = body.mode === 'link' ? 'link' : 'email';
      if (!EMAIL_RE.test(email)) return fail(400, 'E-mail inválido.', origin);
      if (isInternal(email)) return fail(400, 'Este domínio é reservado a usuários sem e-mail. Use "Novo usuário sem e-mail".', origin);
      if (name.length < 2) return fail(400, 'Informe o nome (mínimo 2 letras).', origin);
      if (!NEW_ROLES.includes(role)) return fail(400, 'Escolha o perfil: administrador, gestor ou funcionário.', origin);
      const ex = await admin.from('profiles').select('id').eq('email', email);
      if (ex.data && ex.data.length) return fail(409, 'Já existe um usuário com este e-mail.', origin);

      let user, link = null;
      if (mode === 'email') {
        const r = await admin.auth.admin.inviteUserByEmail(email, { data: { name }, redirectTo: siteUrl });
        if (r.error) { const [s, m] = mapAuthError(r.error); return fail(s, m, origin); }
        user = r.data.user;
      } else {
        const r = await admin.auth.admin.generateLink({ type: 'invite', email, options: { data: { name }, redirectTo: siteUrl } });
        if (r.error) { const [s, m] = mapAuthError(r.error); return fail(s, m, origin); }
        user = r.data.user; link = r.data.properties?.action_link || null;
      }
      const pr = await admin.from('profiles').upsert({ id: user.id, email, name, role, status: 'ativo' });
      if (pr.error) { console.error('perfil', pr.error.message); return fail(500, 'Usuário criado, mas o perfil não pôde ser gravado. Tente "Reenviar acesso".', origin); }
      await audit(admin, caller, 'convidar', { id: user.id, email }, { role, mode });
      return json(200, { ok: true, user: { id: user.id, email, name, role, status: 'ativo' }, link }, origin);
    }

    /* ---------- alterar perfil / status / nome ---------- */
    if (action === 'update') {
      const userId = clean(body.userId, 64);
      const target = userId ? await getProfile(admin, userId) : null;
      if (!target) return fail(404, 'Usuário não encontrado.', origin);
      const patch = {};
      if (body.role !== undefined) { if (!ROLES.includes(body.role)) return fail(400, 'Perfil inválido.', origin); patch.role = body.role; }
      if (body.status !== undefined) { if (!STATUSES.includes(body.status)) return fail(400, 'Status inválido.', origin); patch.status = body.status; }
      if (body.name !== undefined) { const n = clean(body.name, 80); if (n.length < 2) return fail(400, 'Nome inválido.', origin); patch.name = n; }
      const changesRole = patch.role !== undefined && patch.role !== target.role;
      const changesStatus = patch.status !== undefined && patch.status !== target.status;
      if (!changesRole && !changesStatus && patch.name === undefined) return json(200, { ok: true, profile: target, unchanged: true }, origin);
      if (userId === caller.id && (changesRole || changesStatus)) return fail(400, 'Você não pode alterar o próprio perfil ou status.', origin);
      if (target.role === 'admin' && target.status === 'ativo' && (changesRole || changesStatus)) {
        const others = await admin.from('profiles').select('id').eq('role', 'admin').eq('status', 'ativo').neq('id', userId);
        if (!others.data || others.data.length === 0) return fail(409, 'Não é possível remover ou bloquear o último administrador ativo.', origin);
      }
      const up = await admin.from('profiles').update(patch).eq('id', userId);
      if (up.error) return fail(409, /último administrador/i.test(up.error.message || '') ? 'Não é possível remover ou bloquear o último administrador ativo.' : 'Não foi possível salvar a alteração.', origin);
      if (changesStatus) {
        const b = await admin.auth.admin.updateUserById(userId, { ban_duration: patch.status === 'bloqueado' ? BAN : 'none' });
        if (b.error) { await admin.from('profiles').update({ status: target.status }).eq('id', userId); return fail(502, 'Não foi possível atualizar o bloqueio de login. Nada foi alterado.', origin); }
      }
      await audit(admin, caller, 'alterar', target, { de: { role: target.role, status: target.status }, para: patch });
      return json(200, { ok: true, profile: { ...target, ...patch } }, origin);
    }

    /* ---------- reenviar acesso (convite ou redefinição de senha) — só para quem tem e-mail real ---------- */
    if (action === 'resend') {
      const userId = clean(body.userId, 64), mode = body.mode === 'link' ? 'link' : 'email';
      const target = userId ? await getProfile(admin, userId) : null;
      if (!target) return fail(404, 'Usuário não encontrado.', origin);
      if (isInternal(target.email)) return fail(400, 'Este usuário não tem e-mail. Use "Definir senha".', origin);
      const au = await admin.auth.admin.getUserById(userId);
      if (au.error || !au.data?.user) return fail(404, 'Usuário não encontrado.', origin);
      const confirmed = !!(au.data.user.email_confirmed_at || au.data.user.confirmed_at);
      let link = null;
      if (mode === 'email') {
        const r = confirmed ? await admin.auth.resetPasswordForEmail(target.email, { redirectTo: siteUrl })
                            : await admin.auth.admin.inviteUserByEmail(target.email, { data: { name: target.name }, redirectTo: siteUrl });
        if (r.error) { const [s, m] = mapAuthError(r.error); return fail(s, m, origin); }
      } else {
        const r = await admin.auth.admin.generateLink({ type: confirmed ? 'recovery' : 'invite', email: target.email, options: { redirectTo: siteUrl } });
        if (r.error) { const [s, m] = mapAuthError(r.error); return fail(s, m, origin); }
        link = r.data.properties?.action_link || null;
      }
      await audit(admin, caller, 'reenviar', target, { tipo: confirmed ? 'redefinir_senha' : 'convite', mode });
      return json(200, { ok: true, tipo: confirmed ? 'redefinir_senha' : 'convite', link }, origin);
    }

    return fail(400, 'Ação desconhecida.', origin);
  } catch (e) {
    console.error('admin-users', e?.message);
    return fail(500, 'Erro interno. Tente novamente.', origin);
  }
}
