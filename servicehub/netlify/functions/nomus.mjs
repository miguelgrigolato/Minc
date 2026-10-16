// MINC ServiceHub — Consulta ao Nomus pelo Netlify (Node.js). SOMENTE LEITURA.
// Caminho alternativo à função do Supabase: o servidor do Nomus recusou o TLS do Supabase (Deno/rustls).
// O Node usa OpenSSL, que aceita configurações TLS mais antigas quando pedimos (ver TLS_LEGACY).
// Segredo: variável de ambiente NOMUS_CHAVE no Netlify (escopo Functions) — nunca no código.
// Uso pelo app: POST /.netlify/functions/nomus  {acao:'ping'|'buscar'|'processo'|'processos'|'produtos', ...}  com o token do usuário (Supabase).
// Diagnóstico sem login (não usa a chave): GET /.netlify/functions/nomus?diag=1
import https from "node:https";
import tls from "node:tls";
import { constants } from "node:crypto";

const BASE = (process.env.NOMUS_BASE || "https://minc.nomus.com.br/minc/rest").replace(/\/+$/, "");
const CHAVE = process.env.NOMUS_CHAVE || "";
const SB_URL = "https://oufqazvkalpgsdeaihyd.supabase.co";
const SB_KEY = "sb_publishable_igkTHcKb551js5D_FsT_SQ_W1Tbl-oZ"; // chave pública (a mesma do config.js)
const TLS_LEGACY = {
  minVersion: "TLSv1",
  ciphers: "DEFAULT:@SECLEVEL=0",
  secureOptions: constants.SSL_OP_LEGACY_SERVER_CONNECT | constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
};
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

/* GET simples com as opções de TLS */
function get(url, headers, tlsOpts) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "GET", headers, timeout: 20000, ...tlsOpts }, (res) => {
      let data = ""; res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data, tls: res.socket?.getProtocol?.(), cipher: res.socket?.getCipher?.()?.name }));
    });
    req.on("timeout", () => req.destroy(new Error("tempo esgotado")));
    req.on("error", reject);
    req.end();
  });
}

/* diagnóstico: só aperto de mão TLS, sem chave */
function handshake(host, opts) {
  return new Promise((resolve) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: 15000, ...opts }, () => {
      const r = { ok: true, protocolo: s.getProtocol(), cifra: s.getCipher()?.name, cert: s.getPeerCertificate()?.subject?.CN };
      s.end(); resolve(r);
    });
    s.on("error", (e) => resolve({ ok: false, erro: String(e.message || e).slice(0, 200), codigo: e.code }));
    s.on("timeout", () => { s.destroy(); resolve({ ok: false, erro: "tempo esgotado" }); });
  });
}

let modo = null; // qual configuração de TLS funcionou (padrão ou legada)
async function nomus(path, query, tries = 3, pagina = 0) {
  // o Nomus usa RSQL: ?query=campo=valor; valores com espaço ou símbolos precisam de aspas. O "=" do filtro NÃO vai codificado.
  const enc = (q) => q.split(";").map((p) => {
    const i = p.search(/[=<>]/); if (i < 0) return encodeURIComponent(p);
    let j = i; while (j < p.length && /[=<>]/.test(p[j])) j++;
    const v = p.slice(j).replace(/^"|"$/g, "");
    if (v.startsWith("#")) return p.slice(0, j) + encodeURIComponent(v.slice(1));   // número: sem aspas
    return p.slice(0, j) + encodeURIComponent(`"${v.replace(/"/g, "")}"`);
  }).join(";");
  const qs = [query ? `query=${enc(query)}` : "", pagina > 1 ? `pagina=${pagina}` : ""].filter(Boolean).join("&");
  const url = `${BASE}/${path}${qs ? "?" + qs : ""}`;
  const headers = { Authorization: `Basic ${CHAVE}`, "Content-Type": "application/json" };
  for (let i = 0; i < tries; i++) {
    let r;
    try { r = await get(url, headers, modo === "legado" ? TLS_LEGACY : {}); }
    catch (e) {
      if (modo !== "legado") { modo = "legado"; r = await get(url, headers, TLS_LEGACY); }
      else throw { status: 502, message: "Não foi possível conectar ao Nomus: " + (e.message || e) };
    }
    let j = null; try { j = JSON.parse(r.body); } catch {}
    if (j && !Array.isArray(j) && typeof j.tempoAteLiberar === "number") {
      if (i < tries - 1) { await new Promise((ok) => setTimeout(ok, Math.min(j.tempoAteLiberar, 10) * 1000)); continue; }
      throw { status: 429, message: `Nomus pediu para aguardar ${j.tempoAteLiberar}s. Tente de novo.` };
    }
    if (r.status === 401 || r.status === 403) throw { status: 502, message: "O Nomus recusou a chave de integração." };
    if (r.status >= 400) throw { status: 502, message: `Nomus respondeu ${r.status}${r.body ? ": " + String(r.body).replace(/\s+/g, " ").slice(0, 220) : ""} (consulta: ${path}${query ? "?query=" + query : ""})` };
    return j;
  }
}

/* ---------- interpretação do que a pessoa digitou ----------
   Aceita: PD307, PD00307, PD.307, PD 307, pd-307, "307" · OS307, OS.307, OS 000307 · PROC 307 / processo 307
   e o curinga % (como no Nomus): PD%307, %307, OS%2025%, pd%0307% ... */
const norm = (c) => String(c || "").toUpperCase().replace(/[\s.\-_]/g, "");
const one = (x) => (Array.isArray(x) ? x[0] : x);
function interpretar(q) {
  const s = String(q || "").trim();
  const m = s.match(/^(PEDIDO|PROCESSO|ORDEM|PROC|PD|OS)?[\s.\-_:#]*(.*)$/i);
  const pre = (m[1] || "").toUpperCase();
  const tipos = pre === "PD" || pre === "PEDIDO" ? ["pedido"] : pre === "OS" || pre === "ORDEM" ? ["ordem"] : pre === "PROC" || pre === "PROCESSO" ? ["processo"] : ["pedido", "ordem", "processo"];
  const resto = (m[2] || "").trim();
  if (!resto) return null;
  if (resto.includes("%")) return { tipos, coringa: true, prefixo: pre === "PEDIDO" ? "PD" : pre === "ORDEM" ? "OS" : pre.startsWith("PROC") ? "" : pre, padrao: norm(resto).replace(/%+/g, "%") };
  const dig = resto.replace(/[\s.\-_]/g, "");
  if (!/^\d+$/.test(dig)) return null;
  return { tipos, coringa: false, n: String(parseInt(dig, 10)), dig };
}
const pad = (n, k) => String(n).padStart(k, "0");
const variantes = {
  pedido: (n) => [...new Set([`PD ${pad(n, 6)}`, `PD${pad(n, 6)}`, `PD ${n}`, `PD.${n}`, `PD${n}`, `PD ${pad(n, 5)}`])],
  ordem: (n) => [...new Set([`OS${pad(n, 6)}`, `OS.${n}`, `OS ${pad(n, 6)}`, `OS${n}`, `OS ${n}`, `OS.${pad(n, 6)}`])],
};
const rx = (padrao) => new RegExp("^" + padrao.split("%").map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$", "i");

async function dadosCliente(id) {
  if (!id) return null;
  try { const c = one(await nomus(`clientes/${id}`)); return c && { id: c.id, codigo: c.codigo, nome: c.nome, cnpj: c.cnpj || c.cpfCnpj || "", municipio: c.municipio || "", uf: c.siglaEstado || c.uf || "" }; }
  catch { return { id }; }
}
async function dadosProduto(id) {
  try { const x = one(await nomus(`produtos/${id}`)); return { codigo: x?.codigo || "", descricao: x?.descricao || "" }; }
  catch { return { codigo: "", descricao: "" }; }
}
/* processos do CRM ligados ao pedido: o nome do processo traz o código do pedido ("# 1173 - PD 00199 (OS…)…") */
async function processosDoPedido(p) {
  const cod = norm(p.codigoPedido), ach = new Map(), ini = Date.now();
  if (!cod) return [];
  const R = new RegExp(cod.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?!\\d)", "i");
  const tenta = (l) => { for (const x of l || []) if (x && x.id && R.test(norm(x.nome))) ach.set(x.id, { id: x.id, nome: x.nome || "", etapa: x.etapa || "" }); };
  try { const l = await nomus("processos", `nome=%${p.codigoPedido}%`); if (Array.isArray(l)) tenta(l); } catch (e) { if (e.status === 429) return []; }
  for (let pg = 1; pg <= 4 && !ach.size && Date.now() - ini < 6000; pg++) {
    try { const l = await nomus("processos", "", 3, pg); if (!Array.isArray(l) || !l.length) break; tenta(l); } catch { break; }
  }
  return [...ach.values()].slice(0, 6);
}
async function montaPedido(p) {
  const ids = [...new Set((p.itensPedido || []).map((i) => i.idProduto).filter(Boolean))];
  const prods = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await dadosProduto(id)])));
  return {
    tipo: "pedido", codigo: p.codigoPedido, emissao: p.dataEmissao, id: p.id, cliente: await dadosCliente(p.idPessoaCliente), processos: await processosDoPedido(p),
    itens: (p.itensPedido || []).map((i) => ({ item: i.item, quantidade: i.quantidade, entrega: i.dataEntrega, observacoes: i.observacoes || "", produto: prods[i.idProduto] || { codigo: "", descricao: "" } })),
  };
}
const montaOrdem = (o) => ({ tipo: "ordem", codigo: o.nome, id: o.id, status: o.status, quantidade: o.qtde, unidade: o.unidadeMedida, entrega: o.dataHoraEntrega, empresa: o.nomeEmpresa, produto: { codigo: o.codigoProduto, descricao: o.descricaoProduto } });
const montaProcesso = (x) => ({ tipo: "processo", codigo: x.nome, id: x.id, etapa: x.etapa, responsavel: x.responsavel, prioridade: x.prioridade, criado: x.dataCriacao, origem: x.origem });
const TIPOS = {
  pedido: { rota: "pedidos", campo: "codigoPedido", cod: (p) => p.codigoPedido, monta: montaPedido, resumo: (p) => `emitido em ${String(p.dataEmissao || "").slice(0, 10)}` },
  ordem: { rota: "ordens", campo: "nome", cod: (o) => o.nome, monta: async (o) => montaOrdem(o), resumo: (o) => `${o.descricaoProduto || ""} · ${o.status || ""}` },
  processo: { rota: "processos", campo: "nome", cod: (x) => x.nome, monta: async (x) => montaProcesso(x), resumo: (x) => `${x.etapa || ""} · ${x.responsavel || ""}` },
};

/* procura exata por número (várias formas de escrever o código) */
async function exato(tipo, n) {
  const T = TIPOS[tipo];
  if (tipo === "processo") {
    for (const q of [`id=#${n}`, `nome=${n}`]) { try { const l = await nomus(T.rota, q); if (Array.isArray(l) && l.length) return l[0]; } catch (e) { if (e.status === 429) throw e; } }
    return null;
  }
  for (const v of variantes[tipo](n)) { const l = await nomus(T.rota, `${T.campo}=${v}`); if (Array.isArray(l) && l.length) return l[0]; }
  return null;
}
/* curinga: tenta o filtro do próprio Nomus (com %) e, se não achar, varre as páginas mais recentes */
async function curinga(tipo, padrao, prefixo) {
  const T = TIPOS[tipo], R = rx(prefixo && !padrao.startsWith(prefixo) && tipo !== "processo" ? prefixo + (padrao.startsWith("%") ? "" : "%") + padrao : padrao);
  const achados = new Map();
  const tenta = (l) => { for (const o of l || []) { if (R.test(norm(T.cod(o)))) achados.set(o.id, o); } };
  try { const ex = padrao.replace(/%+/g, "%"); const l = await nomus(T.rota, `${T.campo}=${(prefixo && tipo !== "processo" ? prefixo + " " : "") + ex.replace(/^(PD|OS)/, "")}`); tenta(Array.isArray(l) ? l : []); } catch (e) { if (e.status === 429) throw e; }
  if (!achados.size) {
    for (let pg = 1; pg <= 8 && achados.size < 20; pg++) {
      const l = await nomus(T.rota, "", 3, pg);
      if (!Array.isArray(l) || !l.length) break;
      tenta(l);
    }
  }
  return [...achados.values()].slice(0, 20);
}
async function buscar(q, tipoForcado, ehExato) {
  const it = interpretar(q);
  if (!it) throw { status: 400, message: "Digite o pedido (PD 307), a ordem (OS 307) ou o processo. Pode usar % para pular partes, ex.: PD%307." };
  const tipos = tipoForcado ? [tipoForcado] : it.tipos;
  if (!it.coringa || ehExato) {
    const n = it.n || String(parseInt(String(q).replace(/\D/g, ""), 10));
    for (const t of tipos) { const o = await exato(t, n); if (o) return await TIPOS[t].monta(o); }
    return null;
  }
  const itens = [];
  for (const t of tipos) for (const o of await curinga(t, it.padrao, it.prefixo)) itens.push({ tipo: t, codigo: TIPOS[t].cod(o), resumo: TIPOS[t].resumo(o), _o: o });
  if (!itens.length) return null;
  if (itens.length === 1) return await TIPOS[itens[0].tipo].monta(itens[0]._o);
  return { tipo: "lista", itens: itens.slice(0, 25).map(({ _o, ...r }) => r), total: itens.length };
}


/* ---------- catálogo de produtos (matéria-prima) para o app atualizar a lista ----------
   O app pede páginas aos poucos (ação "produtos"); cada chamada lê algumas páginas dentro de ~20 s e diz de qual página continuar. */
let unidades = null;
async function mapaUnidades() {
  if (unidades) return unidades;
  const m = {};
  try {
    for (let pg = 1; pg <= 5; pg++) {
      const l = await nomus("unidadesMedida", "", 3, pg);
      if (!Array.isArray(l) || !l.length) break;
      for (const u of l) m[u.id] = u.sigla || u.simbolo || u.nome || u.descricao || "";
    }
  } catch {}
  return (unidades = m);
}
const ativo = (p) => p.ativo !== false && !p.bloqueado;
async function paginaProdutos(pagina) {
  const un = await mapaUnidades(), ini = Date.now(), itens = [];
  let pg = Math.max(1, +pagina || 1), fim = false;
  while (Date.now() - ini < 18000) {
    const l = await nomus("produtos", "", 3, pg);
    if (!Array.isArray(l) || !l.length) { fim = true; break; }
    for (const p of l) itens.push({ codigo: p.codigo || "", descricao: p.descricao || "", unidade: un[p.idUnidadeMedida] || p.unidadeMedida || p.nomeUnidadeMedida || "", familia: p.nomeFamiliaProduto || "", tipo: p.nomeTipoProduto || "", grupo: p.nomeGrupoProduto || "", ativo: ativo(p) });
    pg++;
  }
  return { itens, proxima: fim ? null : pg };
}

/* ---------- processo do CRM (nº "# 1173" = id do processo) ----------
   Devolve etapa, responsável, prazo e, se o Nomus permitir, a lista de arquivos anexos. Tudo só leitura. */
const dataBR = (t) => {
  const m = String(t || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return null;
  const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
  return `${y}-${pad(m[2], 2)}-${pad(m[1], 2)}`;
};
function resumoProcesso(x) {
  const bruto = {};
  for (const [k, v] of Object.entries(x || {})) if (v !== null && v !== undefined && typeof v !== "object") bruto[k] = String(v).slice(0, 300);
  const kEnt = Object.keys(bruto).find((k) => /entrega/i.test(k) && dataBR(bruto[k]));
  const prazoTxt = kEnt ? bruto[kEnt] : x.dataHoraProgramada;
  return {
    id: x.id, nome: x.nome || "", etapa: x.etapa || "", responsavel: x.responsavel || "", reportador: x.reportador || "", prioridade: x.prioridade || "",
    tipo: x.tipo || "", origem: x.origem || "", criado: dataBR(x.dataCriacao), programada: dataBR(x.dataHoraProgramada), prazo: dataBR(prazoTxt), prazoCampo: kEnt || "dataHoraProgramada", bruto,
  };
}
async function detalheProcesso(id, comAnexos) {
  let x;
  try { x = one(await nomus(`processos/${id}`)); } catch (e) { if (/respondeu 404/.test(e.message || "")) return null; throw e; }
  if (!x || !x.id) return null;
  const r = resumoProcesso(x);
  if (comAnexos) {
    r.anexos = null;
    try {
      const a = await nomus(`processos/${id}/arquivosAnexos`);
      if (Array.isArray(a)) r.anexos = a.slice(0, 60).map((f) => ({ nome: String(f.nomeArquivo || f.nome || f.arquivo || f.name || "").slice(0, 200), tamanho: f.tamanho || f.tamanhoArquivo || "", por: f.enviadoPor || f.usuario || "", data: f.dataUpload || f.data || "" }));
    } catch { /* o Nomus pode não oferecer esta consulta: o app avisa */ }
  }
  return r;
}
async function varios(ids) {
  const ini = Date.now(), itens = {}, faltam = [];
  for (const id of ids) {
    if (Date.now() - ini > 8000) { faltam.push(id); continue; }
    try { const r = await detalheProcesso(id, false); itens[id] = r ? (({ bruto, ...o }) => o)(r) : { id, naoAchou: true }; }
    catch (e) { if (e.status === 429) { faltam.push(id); continue; } itens[id] = { id, erro: e.message }; }
  }
  return { itens, faltam };
}


/* ---------- histórico de compras (para o preço de referência do módulo de Custos) ----------
   SOMENTE LEITURA. Recurso "pedidoscompra" da API REST do Nomus. Os nomes dos campos de pedido/itens de compra ainda não foram
   confirmados com a chave real (sem acesso ao Nomus durante o desenvolvimento): por isso a leitura aceita nomes alternativos e a
   ação "compras_sonda" devolve os campos que o Nomus realmente manda, para ajustar a leitura se for preciso. */
const num = (v) => { if (v == null || v === "") return null; const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
const pick = (o, ks) => { for (const k of ks) if (o && o[k] != null && o[k] !== "") return o[k]; return null; };
const itensDoPedido = (p) => pick(p, ["itensPedidoCompra", "itensPedido", "itensCompra", "itens"]) || [];
async function idsDosProdutos(codigos) {
  const m = {};
  for (const c of codigos) {
    try { const l = await nomus("produtos", `codigo=${c}`); const x = Array.isArray(l) ? l.find((p) => String(p.codigo || "").trim().toUpperCase() === String(c).trim().toUpperCase()) : null; if (x && x.id) m[x.id] = c; }
    catch (e) { if (e.status === 429) throw e; }
  }
  return m;
}
async function compras(codigos, pagina) {
  const porId = await idsDosProdutos(codigos), ini = Date.now(), registros = [];
  let pg = Math.max(1, +pagina || 1), fim = false, campos = null, lidas = 0;
  if (!Object.keys(porId).length) return { registros, proxima: null, paginas: 0, semProduto: codigos, aviso: "Nenhum destes códigos foi encontrado no cadastro de produtos do Nomus." };
  while (Date.now() - ini < 16000 && lidas < 12) {
    const l = await nomus("pedidoscompra", "", 3, pg);
    if (!Array.isArray(l) || !l.length) { fim = true; break; }
    lidas++;
    if (!campos) { const it = itensDoPedido(l[0])[0]; campos = { pedido: Object.keys(l[0] || {}), item: it ? Object.keys(it) : [] }; }
    for (const p of l) for (const it of itensDoPedido(p)) {
      const id = pick(it, ["idProduto", "produtoId"]) ?? (it.produto && it.produto.id);
      if (!porId[id]) continue;
      registros.push({
        codigo: porId[id], pedido: pick(p, ["codigoPedido", "codigo", "nome"]) || "", data: pick(p, ["dataEmissao", "dataPedido", "data"]) || "",
        situacao: String(pick(p, ["situacao", "nomeSituacao", "status", "statusPedido"]) || ""), fornecedor: String(pick(p, ["nomeFornecedor", "nomePessoaFornecedor", "fornecedor"]) || "").slice(0, 80),
        quantidade: num(pick(it, ["quantidade", "qtde", "qtd"])), valorUnitario: num(pick(it, ["valorUnitario", "precoUnitario", "valorUnitarioLiquido", "preco"])),
        unidade: String(pick(it, ["unidadeMedida", "siglaUnidadeMedida", "nomeUnidadeMedida", "unidade"]) || ""), moeda: String(pick(it, ["moeda", "siglaMoeda"]) || pick(p, ["moeda", "siglaMoeda"]) || ""),
      });
    }
    pg++;
  }
  return { registros, proxima: fim ? null : pg, paginas: lidas, campos, semProduto: codigos.filter((c) => !Object.values(porId).includes(c)) };
}
async function comprasSonda() {
  const l = await nomus("pedidoscompra", "", 2, 1);
  if (!Array.isArray(l)) return { ok: false, aviso: "O Nomus não devolveu uma lista para pedidoscompra.", tipo: typeof l };
  const p = l[0] || {}, it = itensDoPedido(p)[0] || {};
  const raso = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v == null || typeof v !== "object").map(([k, v]) => [k, v == null ? null : String(v).slice(0, 60)]));
  return { ok: true, pedidos: l.length, camposPedido: raso(p), camposItem: raso(it), chaves: Object.keys(p) };
}

/* só usuário ativo do app (admin, gestor ou operador) */
async function usuario(auth) {
  if (!auth.startsWith("Bearer ")) return null;
  const h = { apikey: SB_KEY, Authorization: auth };
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: h });
  if (!u.ok) return null;
  const user = await u.json();
  const p = await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,status`, { headers: h });
  const pr = p.ok ? (await p.json())[0] : null;
  return pr && pr.status === "ativo" && ["admin", "gestor", "operador"].includes(pr.role) ? { id: user.id, role: pr.role } : null;
}

export default async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.get("diag")) {
    const host = new URL(BASE).hostname;
    const padrao = await handshake(host, {});
    const legado = await handshake(host, TLS_LEGACY);
    return json(200, { host, node: process.version, openssl: process.versions.openssl, padrao, legado, chave_configurada: !!CHAVE });
  }
  if (req.method !== "POST") return json(405, { error: "Use POST." });
  if (!CHAVE) return json(503, { error: "A integração com o Nomus ainda não foi configurada no Netlify (variável NOMUS_CHAVE)." });
  const who = await usuario(req.headers.get("authorization") || "");
  if (!who) return json(401, { error: "Entre no aplicativo para consultar o Nomus." });
  let body = {}; try { body = await req.json(); } catch {}
  try {
    if (body.acao === "ping") { const t = await nomus("pedidos", "codigoPedido=PD 000000"); return json(200, { ok: true, amostra: Array.isArray(t), tls: modo || "padrão" }); }
    if (body.acao === "produtos") {
      if (!["admin", "gestor"].includes(who.role)) return json(403, { error: "Só administrador ou gestor atualiza a lista pelo Nomus." });
      return json(200, await paginaProdutos(body.pagina));
    }
    if (body.acao === "processo") {
      const id = parseInt(String(body.id).replace(/\D/g, ""), 10);
      if (!id) return json(400, { error: "Informe o número do processo (ex.: 1173)." });
      const r = await detalheProcesso(id, true);
      if (!r) return json(404, { error: `Não encontrei o processo #${id} no Nomus.` });
      return json(200, r);
    }
    if (body.acao === "processos") {
      const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map((v) => parseInt(String(v).replace(/\D/g, ""), 10)).filter(Boolean))].slice(0, 40);
      return json(200, await varios(ids));
    }
    if (body.acao === "buscar") {
      const q = String(body.q || "");
      const r = await buscar(q, ["pedido", "ordem", "processo"].includes(body.tipo) ? body.tipo : null, !!body.exato);
      if (!r) return json(404, { error: `Não encontrei "${q.trim()}" no Nomus. Tente com % (ex.: PD%${q.replace(/\D/g, "") || "307"}).` });
      return json(200, r);
    }
    if (body.acao === "compras") {
      const cods = [...new Set((Array.isArray(body.codigos) ? body.codigos : []).map((c) => String(c || "").trim()).filter(Boolean))].slice(0, 25);
      if (!cods.length) return json(400, { error: "Informe os códigos dos materiais." });
      return json(200, await compras(cods, body.pagina));
    }
    if (body.acao === "compras_sonda") {
      if (!["admin", "gestor"].includes(who.role)) return json(403, { error: "Só administrador ou gestor." });
      return json(200, await comprasSonda());
    }
    return json(400, { error: "Ação inválida." });
  } catch (e) {
    return json(e?.status || 500, { error: e?.message || "Falha ao consultar o Nomus." });
  }
};
