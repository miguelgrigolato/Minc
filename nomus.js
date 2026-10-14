/* MINC · Peritagem — Consulta ao Nomus ERP (v5.17.0). SOMENTE LEITURA.
   O app chama a Edge Function "nomus" (Supabase); a chave de integração fica lá, nunca aqui.
   Uso: no processo, "Buscar no Nomus" -> PD 002292 (pedido) ou OS000123 (ordem) -> preenche pedido, cliente, equipamento e ordem.
   Carregado ANTES do app.js: tudo que usa funções do app roda só quando chamado. */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};
MX.sync=MX.sync||[];MX.boot=MX.boot||[];

const Nomus={
  last:null,
  ok(){return !!CLOUD&&navigator.onLine},
  async call(body){
    if(!CLOUD)throw new Error('A busca no Nomus só funciona com o aplicativo conectado à nuvem.');
    if(!navigator.onLine)throw new Error('Sem conexão com a internet.');
    const r=await SB.functions.invoke('nomus',{body});
    if(r.error){let msg='Não foi possível consultar o Nomus agora.';try{const j=await r.error.context.json();if(j&&j.error)msg=j.error}catch{}throw new Error(msg)}
    if(r.data&&r.data.error)throw new Error(r.data.error);
    return r.data;
  }
};
window.Nomus=Nomus;

/* botão que o app.js coloca no painel "Identificação" */
window.nomusBtn=()=>!Settings.on('nomus')?'':`<button type="button" class="btn" data-act="nomusOpen">${ic('search')}Buscar no Nomus</button>`;

function resultHTML(r){
  if(!r)return '';
  if(r.tipo==='pedido'){
    const c=r.cliente||{};
    return `<div class="nm-res"><dl class="kv"><div><dt>Pedido</dt><dd>${esc(r.codigo)}${r.emissao?` · emitido em ${esc(String(r.emissao).slice(0,10))}`:''}</dd></div><div><dt>Cliente</dt><dd>${esc(c.nome)||'—'}${c.cnpj?` · ${esc(c.cnpj)}`:''}</dd></div></dl><div class="field"><label for="nm-item">Equipamento (item do pedido)</label><select id="nm-item"><option value="">Não preencher o equipamento</option>${(r.itens||[]).map((i,k)=>`<option value="${k}" ${(r.itens.length===1)?'selected':''}>${esc(i.item)} — ${esc(i.produto?.descricao||i.produto?.codigo||'sem descrição')} (qtd. ${esc(i.quantidade)})</option>`).join('')}</select></div></div>`;
  }
  return `<div class="nm-res"><dl class="kv"><div><dt>Ordem</dt><dd>${esc(r.codigo)}${r.status?` · ${esc(r.status)}`:''}</dd></div><div><dt>Produto</dt><dd>${esc(r.produto?.descricao||r.produto?.codigo)||'—'}</dd></div></dl></div>`;
}

Object.assign(MX.act,{
  nomusOpen(){
    if(!Nomus.ok()){toast(CLOUD?'Sem conexão com a internet.':'A busca no Nomus só funciona com o aplicativo conectado à nuvem.',{ms:5000});return}
    Nomus.last=null;
    dialog(`<form class="dlg-body" data-submit="nomusBuscar"><h2>Buscar no Nomus</h2><p>Digite o número do pedido (<b>PD 002292</b>) ou da ordem (<b>OS000123</b>). Só consulta: nada é alterado no Nomus.</p><div class="field"><label for="nm-q">Pedido ou ordem</label><input id="nm-q" data-keep-case autocomplete="off" autofocus placeholder="PD 002292"></div><div id="nm-out" aria-live="polite"></div><div class="actions end"><button type="button" class="btn" data-act="closeDlg">Fechar</button><button type="submit" class="btn" id="nm-go">${ic('search')}Buscar</button><button type="button" class="btn primary" id="nm-use" data-act="nomusUse" hidden>${ic('check')}Preencher o processo</button></div></form>`);
  },
  nomusUse(el){
    const r=cur(),n=Nomus.last;if(!r||!n)return;
    const d=el.closest('dialog');
    const put=(k,v)=>{if(v!==undefined&&v!==null&&String(v).trim()!=='')r[k]=String(v).trim()};
    if(n.tipo==='pedido'){
      put('pedido',n.codigo);put('cliente',n.cliente?.nome);
      const sel=d.querySelector('#nm-item'),it=sel&&sel.value!==''?n.itens[+sel.value]:null;
      if(it)put('equipamento',it.produto?.descricao||it.produto?.codigo);
    }else{
      put('ordem',n.codigo);
      if(emp(r.equipamento))put('equipamento',n.produto?.descricao||n.produto?.codigo);
    }
    changed(r);closeDialog(d);renderMain();
    toast(n.tipo==='pedido'?'Pedido, cliente e equipamento preenchidos a partir do Nomus. Confira os dados.':'Ordem preenchida a partir do Nomus. Confira os dados.',{ms:5000});
  },
  async nomusTeste(el){
    const o=document.getElementById('nm-teste');el.disabled=true;if(o)o.textContent='Consultando…';
    try{const r=await Nomus.call({acao:'ping'});if(o)o.textContent=r&&r.ok?'Conexão com o Nomus funcionando.':'Resposta inesperada do Nomus.'}
    catch(e){if(o)o.textContent=e.message}
    el.disabled=false;
  }
});
Object.assign(MX.sub,{
  async nomusBuscar(f){
    const q=f.querySelector('#nm-q').value.trim(),out=f.querySelector('#nm-out'),go=f.querySelector('#nm-go'),use=f.querySelector('#nm-use');
    if(!q){out.innerHTML='<p class="errbox">Digite o número do pedido ou da ordem.</p>';return}
    go.disabled=true;use.hidden=true;Nomus.last=null;out.innerHTML='<p class="hint">Consultando o Nomus…</p>';
    try{const r=await Nomus.call({acao:'buscar',q});Nomus.last=r;out.innerHTML=resultHTML(r);use.hidden=false}
    catch(e){out.innerHTML=`<p class="errbox">${esc(e.message)}</p>`}
    go.disabled=false;
  }
});

/* Administração > Configurações: teste da conexão */
window.vNomusAdmin=()=>!Settings.on('nomus')?'':`<div class="panel"><h2>Integração com o Nomus</h2><p class="hint">Consulta de pedidos e ordens (somente leitura). A chave fica guardada no servidor, nunca no aplicativo.</p><div class="actions"><button type="button" class="btn" data-act="nomusTeste" ${CLOUD?'':'disabled'}>Testar conexão com o Nomus</button></div><p class="hint" id="nm-teste" aria-live="polite">${CLOUD?'':'Disponível só com o aplicativo conectado à nuvem.'}</p></div>`;
})();
