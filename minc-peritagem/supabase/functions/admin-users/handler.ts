// MINC · Peritagem — função de administração de usuários (roda no servidor, nunca no navegador).
// A chave de serviço (service_role) só existe aqui, nos segredos da função. O navegador envia apenas o login do
// administrador; esta função confere quem chama, aplica as travas e só então usa a chave de serviço.
// Código escrito em JavaScript puro dentro de .ts para poder ser testado fora do Deno.

export const SITE_URL = 'https://minc-peritagem.netlify.app';
export const ALLOWED_ORIGINS = [SITE_URL, 'http://localhost:8000', 'http://localhost:8765', 'http://127.0.0.1:8000'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLES = ['admin', 'operador', 'pendente'];
const STATUSES = ['ativo', 'bloqueado'];
const BAN = '876000h'; // ~100 anos: bloqueio até o administrador desbloquear

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
  const r = await admin.from('profiles').select('id,email,name,role,status').eq('id', id).single();
  return r.error ? null : r.data;
}
async function audit(admin, caller, action, target, details) {
  try {
    await admin.from('admin_audit').insert({
      actor_id: caller.id, actor_email: caller.email || null, action,
      target_id: target?.id || null, target_email: target?.email || null, details: details || {},
    });
  } catch (e) { console.error('audit', e?.message); }
}
function mapAuthError(e) {
  const m = String(e?.message || '');
  if (e?.status === 429 || /rate limit/i.test(m)) return [429, 'Limite de e-mails do Supabase atingido. Use "Gerar link" ou configure um servidor de e-mail próprio (SMTP).'];
  if (/already.*registered|already been registered|exists/i.test(m)) return [409, 'Já existe um usuário com este e-mail.'];
  return [502, 'Não foi possível concluir a operação no serviço de autenticação.'];
}
const clean = (v, max) => String(v ?? '').trim().slice(0, max);

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

    let body;
    try { body = await req.json(); } catch { return fail(400, 'Requisição inválida.', origin); }
    const action = body?.action;

    /* ---------- convidar ---------- */
    if (action === 'invite') {
      const email = clean(body.email, 200).toLowerCase(), name = clean(body.name, 80), role = body.role, mode = body.mode === 'link' ? 'link' : 'email';
      if (!EMAIL_RE.test(email)) return fail(400, 'E-mail inválido.', origin);
      if (name.length < 2) return fail(400, 'Informe o nome (mínimo 2 letras).', origin);
      if (!['admin', 'operador'].includes(role)) return fail(400, 'Escolha o perfil: administrador ou funcionário.', origin);
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

    /* ---------- reenviar acesso (convite ou redefinição de senha) ---------- */
    if (action === 'resend') {
      const userId = clean(body.userId, 64), mode = body.mode === 'link' ? 'link' : 'email';
      const target = userId ? await getProfile(admin, userId) : null;
      if (!target) return fail(404, 'Usuário não encontrado.', origin);
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
