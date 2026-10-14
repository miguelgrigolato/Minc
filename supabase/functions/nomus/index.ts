// Edge Function "nomus" — consulta SOMENTE LEITURA ao Nomus ERP para o app MINC Peritagem.
// A chave de integração fica só aqui, como segredo (NOMUS_CHAVE); o app nunca a vê.
// Segredos: NOMUS_CHAVE (valor do Basic, sem a palavra "Basic"), NOMUS_BASE (opcional; padrão abaixo).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BASE = (Deno.env.get("NOMUS_BASE") || "https://minc.nomus.com.br/minc/rest").replace(/\/+$/, "");
const CHAVE = Deno.env.get("NOMUS_CHAVE") || "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json; charset=utf-8",
};
const out = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: CORS });

/* GET no Nomus, respeitando o throttling ({"tempoAteLiberar": segundos}) */
async function nomus(path: string, query?: string, tries = 3): Promise<any> {
  const url = `${BASE}/${path}${query ? `?query=${encodeURIComponent(query)}` : ""}`;
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: { Authorization: `Basic ${CHAVE}`, "Content-Type": "application/json" } });
    const txt = await r.text();
    let j: any = null;
    try { j = JSON.parse(txt); } catch { /* não é JSON */ }
    if (j && !Array.isArray(j) && typeof j.tempoAteLiberar === "number") {
      const ms = Math.min(j.tempoAteLiberar, 10) * 1000;
      if (i < tries - 1) { await new Promise((ok) => setTimeout(ok, ms)); continue; }
      throw { status: 429, message: `Nomus pediu para aguardar ${j.tempoAteLiberar}s. Tente de novo.` };
    }
    if (r.status === 401 || r.status === 403) throw { status: 502, message: "O Nomus recusou a chave de integração." };
    if (!r.ok) throw { status: 502, message: `Nomus respondeu ${r.status}.` };
    return j;
  }
}

/* "pd 2292" -> "PD 002292" ; "OS.123"/"os000123" -> ordem */
function classificar(q: string) {
  const s = q.trim().toUpperCase();
  let m = s.match(/^PD\s*[-.]?\s*0*(\d+)$/);
  if (m) return { tipo: "pedido", variantes: [`PD ${m[1].padStart(6, "0")}`, s] };
  m = s.match(/^OS\s*[-.]?\s*0*(\d+)$/);
  if (m) return { tipo: "ordem", variantes: [`OS${m[1].padStart(6, "0")}`, `OS.${m[1]}`, `OS ${m[1].padStart(6, "0")}`, s] };
  if (/^\d+$/.test(s)) return { tipo: "pedido", variantes: [`PD ${s.padStart(6, "0")}`] };
  return null;
}

const cliente = (c: any) => c && ({
  id: c.id, codigo: c.codigo, nome: c.nome, cnpj: c.cnpj || c.cpfCnpj || "", municipio: c.municipio || "", uf: c.siglaEstado || c.uf || "",
});

async function dadosCliente(id: number | undefined) {
  if (!id) return null;
  try { const c = await nomus(`clientes/${id}`); return cliente(Array.isArray(c) ? c[0] : c); } catch { return { id }; }
}
async function dadosProduto(id: number) {
  try {
    const p = await nomus(`produtos/${id}`);
    const x = Array.isArray(p) ? p[0] : p;
    return { codigo: x?.codigo || "", descricao: x?.descricao || "" };
  } catch { return { codigo: "", descricao: "" }; }
}

async function buscaPedido(variantes: string[]) {
  for (const v of variantes) {
    const l = await nomus("pedidos", `codigoPedido=${v}`);
    if (Array.isArray(l) && l.length) {
      const p = l[0];
      const ids = [...new Set<number>((p.itensPedido || []).map((i: any) => i.idProduto).filter(Boolean))];
      const prods = Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await dadosProduto(id)])));
      return {
        tipo: "pedido", codigo: p.codigoPedido, emissao: p.dataEmissao, id: p.id,
        cliente: await dadosCliente(p.idPessoaCliente),
        itens: (p.itensPedido || []).map((i: any) => ({
          item: i.item, quantidade: i.quantidade, entrega: i.dataEntrega, observacoes: i.observacoes || "",
          produto: prods[i.idProduto] || { codigo: "", descricao: "" },
        })),
      };
    }
  }
  return null;
}

async function buscaOrdem(variantes: string[]) {
  for (const v of variantes) {
    const l = await nomus("ordens", `nome=${v}`);
    if (Array.isArray(l) && l.length) {
      const o = l[0];
      return {
        tipo: "ordem", codigo: o.nome, id: o.id, status: o.status, quantidade: o.qtde, unidade: o.unidadeMedida,
        entrega: o.dataHoraEntrega, empresa: o.nomeEmpresa,
        produto: { codigo: o.codigoProduto, descricao: o.descricaoProduto },
      };
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!CHAVE) return out(503, { error: "A integração com o Nomus ainda não foi configurada (segredo NOMUS_CHAVE)." });

  // só usuário ativo do app (admin/operador)
  const auth = req.headers.get("Authorization") || "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return out(401, { error: "Entre no aplicativo para consultar o Nomus." });
  const { data: perfil } = await sb.from("profiles").select("role,status").eq("id", u.user.id).maybeSingle();
  if (!perfil || perfil.status !== "ativo" || !["admin", "operador"].includes(perfil.role)) return out(403, { error: "Usuário sem permissão." });

  let body: any = {};
  try { body = await req.json(); } catch { /* vazio */ }
  try {
    if (body.acao === "ping") { const t = await nomus("pedidos", "codigoPedido=PD 000000"); return out(200, { ok: true, amostra: Array.isArray(t) }); }
    if (body.acao === "buscar") {
      const q = String(body.q || "");
      const c = classificar(q);
      if (!c) return out(400, { error: "Digite o pedido (PD 002292) ou a ordem (OS000123)." });
      const r = c.tipo === "pedido" ? await buscaPedido(c.variantes) : await buscaOrdem(c.variantes);
      if (!r) return out(404, { error: `Não encontrei "${q.trim()}" no Nomus.` });
      return out(200, r);
    }
    return out(400, { error: "Ação inválida." });
  } catch (e: any) {
    return out(e?.status || 500, { error: e?.message || "Falha ao consultar o Nomus." });
  }
});
