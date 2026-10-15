// MINC ServiceHub — Consulta ao Nomus pelo Netlify (Node.js). SOMENTE LEITURA.
// Caminho alternativo à função do Supabase: o servidor do Nomus recusou o TLS do Supabase (Deno/rustls).
// O Node usa OpenSSL, que aceita configurações TLS mais antigas quando pedimos (ver TLS_LEGACY).
// Segredo: variável de ambiente NOMUS_CHAVE no Netlify (escopo Functions) — nunca no código.
// Uso pelo app: POST /.netlify/functions/nomus  {acao:'ping'|'buscar', q}  com o token do usuário (Supabase).
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
async function nomus(path, query, tries = 3) {
  // o Nomus usa RSQL: ?query=campo=valor; valores com espaço ou símbolos precisam de aspas. O "=" do filtro NÃO vai codificado.
  const enc = (q) => q.split(";").map((p) => {
    const i = p.search(/[=<>]/); if (i < 0) return encodeURIComponent(p);
    let j = i; while (j < p.length && /[=<>]/.test(p[j])) j++;
    const v = p.slice(j).replace(/^"|"$/g, "");
    return p.slice(0, j) + encodeURIComponent(`"${v.replace(/"/g, "")}"`);
  }).join(";");
  const url = `${BASE}/${path}${query ? `?query=${enc(query)}` : ""}`;
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

/* "pd 2292" -> "PD 002292" ; "OS.123"/"os000123" -> ordem */
function classificar(q) {
  const s = q.trim().toUpperCase();
  let m = s.match(/^PD\s*[-.]?\s*0*(\d+)$/);
  if (m) return { tipo: "pedido", variantes: [`PD ${m[1].padStart(6, "0")}`, s] };
  m = s.match(/^OS\s*[-.]?\s*0*(\d+)$/);
  if (m) return { tipo: "ordem", variantes: [`OS${m[1].padStart(6, "0")}`, `OS.${m[1]}`, `OS ${m[1].padStart(6, "0")}`, s] };
  if (/^\d+$/.test(s)) return { tipo: "pedido", variantes: [`PD ${s.padStart(6, "0")}`] };
  return null;
}
const one = (x) => (Array.isArray(x) ? x[0] : x);
async function dadosCliente(id) {
  if (!id) return null;
  try { const c = one(await nomus(`clientes/${id}`)); return c && { id: c.id, codigo: c.codigo, nome: c.nome, cnpj: c.cnpj || c.cpfCnpj || "", municipio: c.municipio || "", uf: c.siglaEstado || c.uf || "" }; }
  catch { return { id }; }
}
async function dadosProduto(id) {
  try { const x = one(await nomus(`produtos/${id}`)); return { codigo: x?.codigo || "", descricao: x?.descricao || "" }; }
  catch { return { codigo: "", descricao: "" }; }
}
async function buscaPedido(variantes) {
  for (const v of variantes) {
    const l = await nomus("pedidos", `codigoPedido=${v}`);
    if (Array.isArray(l) && l.length) {
      const p = l[0];
      const ids = [...new Set((p.itensPedido || []).map((i) => i.idProduto).filter(Boolean))];
      const prods = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await dadosProduto(id)])));
      return {
        tipo: "pedido", codigo: p.codigoPedido, emissao: p.dataEmissao, id: p.id, cliente: await dadosCliente(p.idPessoaCliente),
        itens: (p.itensPedido || []).map((i) => ({ item: i.item, quantidade: i.quantidade, entrega: i.dataEntrega, observacoes: i.observacoes || "", produto: prods[i.idProduto] || { codigo: "", descricao: "" } })),
      };
    }
  }
  return null;
}
async function buscaOrdem(variantes) {
  for (const v of variantes) {
    const l = await nomus("ordens", `nome=${v}`);
    if (Array.isArray(l) && l.length) {
      const o = l[0];
      return { tipo: "ordem", codigo: o.nome, id: o.id, status: o.status, quantidade: o.qtde, unidade: o.unidadeMedida, entrega: o.dataHoraEntrega, empresa: o.nomeEmpresa, produto: { codigo: o.codigoProduto, descricao: o.descricaoProduto } };
    }
  }
  return null;
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
    if (body.acao === "buscar") {
      const q = String(body.q || ""), c = classificar(q);
      if (!c) return json(400, { error: "Digite o pedido (PD 002292) ou a ordem (OS000123)." });
      const r = c.tipo === "pedido" ? await buscaPedido(c.variantes) : await buscaOrdem(c.variantes);
      if (!r) return json(404, { error: `Não encontrei "${q.trim()}" no Nomus.` });
      return json(200, r);
    }
    return json(400, { error: "Ação inválida." });
  } catch (e) {
    return json(e?.status || 500, { error: e?.message || "Falha ao consultar o Nomus." });
  }
};
