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
    // 1º caminho: função do Netlify (Node/OpenSSL, aceita o TLS do servidor do Nomus). 2º: função do Supabase.
    const {data:ss}=await SB.auth.getSession();const tok=ss?.session?.access_token;
    if(!tok)throw new Error('Sessão expirada. Entre de novo no aplicativo.');
    let res=null;
    try{res=await fetch('/.netlify/functions/nomus',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok},body:JSON.stringify(body)})}catch{}
    if(res){   // resposta da função do Netlify (JSON). Sem a função publicada, o Netlify devolve uma página 404 (HTML) e usamos o Supabase
      let j=null;try{j=await res.clone().json()}catch{}
      if(j){if(!res.ok||j.error)throw new Error(j.error||'Não foi possível consultar o Nomus agora.');return j}
    }
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
  if(r.tipo==='lista'){
    const ROT={pedido:'Pedido',ordem:'Ordem',processo:'Processo'};
    return `<p class="hint">${r.total>r.itens.length?`Mostrando ${r.itens.length} de ${r.total}. Refine a busca para ver os demais.`:`${r.itens.length} resultados.`} Toque no que você quer usar:</p><div class="gs-l">${r.itens.map(x=>`<button type="button" class="gs-r" data-act="nomusPick" data-tipo="${esc(x.tipo)}" data-q="${esc(x.codigo)}"><b>${esc(x.codigo)}</b><small>${ROT[x.tipo]||x.tipo} · ${esc(x.resumo||'')}</small></button>`).join('')}</div>`;
  }
  if(r.tipo==='processo')return `<div class="nm-res"><dl class="kv"><div><dt>Processo (Nomus)</dt><dd>${esc(r.codigo)} · nº ${esc(r.id)}</dd></div><div><dt>Etapa</dt><dd>${esc(r.etapa)||'—'}${r.responsavel?' · '+esc(r.responsavel):''}</dd></div></dl></div>`;
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
    dialog(`<form class="dlg-body" data-submit="nomusBuscar"><h2>Buscar no Nomus</h2><p>Digite o pedido, a ordem ou o processo, do jeito que vier: <b>PD307</b>, <b>PD 00307</b>, <b>PD.307</b>, <b>OS 307</b>, <b>OS.307</b>, <b>proc 307</b> ou só <b>307</b>. Use <b>%</b> para pular partes, como no Nomus: <b>PD%307</b>, <b>%2025%</b>. Só consulta: nada é alterado no Nomus.</p><div class="field"><label for="nm-q">Pedido, ordem ou processo</label><div class="search mat-search">${ic('search')}<input id="nm-q" type="search" data-keep-case autocomplete="off" autofocus placeholder="PD 307  ·  OS.307  ·  PD%307"><button type="button" class="pct" data-act="pctIns" data-for="nm-q" aria-label="Inserir o sinal %" title="Inserir %">%</button></div></div><div id="nm-out" aria-live="polite"></div><div class="actions end"><button type="button" class="btn" data-act="closeDlg">Fechar</button><button type="submit" class="btn" id="nm-go">${ic('search')}Buscar</button><button type="button" class="btn primary" id="nm-use" data-act="nomusUse" hidden>${ic('check')}Preencher o processo</button></div></form>`);
  },
  nomusUse(el){
    const r=cur(),n=Nomus.last;if(!r||!n)return;
    const d=el.closest('dialog');
    const put=(k,v)=>{if(v!==undefined&&v!==null&&String(v).trim()!=='')r[k]=String(v).trim()};
    if(n.tipo==='pedido'){
      put('pedido',n.codigo);put('cliente',n.cliente?.nome);
      const sel=d.querySelector('#nm-item'),it=sel&&sel.value!==''?n.itens[+sel.value]:null;
      if(it)put('equipamento',it.produto?.descricao||it.produto?.codigo);
    }else if(n.tipo==='processo'){
      put('process',n.codigo);
    }else{
      put('ordem',n.codigo);
      if(emp(r.equipamento))put('equipamento',n.produto?.descricao||n.produto?.codigo);
    }
    changed(r);closeDialog(d);renderMain();
    toast(n.tipo==='pedido'?'Pedido, cliente e equipamento preenchidos a partir do Nomus. Confira os dados.':n.tipo==='processo'?'Nº do processo preenchido a partir do Nomus. Confira.':'Ordem preenchida a partir do Nomus. Confira os dados.',{ms:5000});
  },
  async nomusPick(el){
    const f=el.closest('form'),out=f.querySelector('#nm-out'),use=f.querySelector('#nm-use');
    f.querySelector('#nm-q').value=el.dataset.q;use.hidden=true;Nomus.last=null;out.innerHTML='<p class="hint">Consultando o Nomus…</p>';
    try{const r=await Nomus.call({acao:'buscar',q:el.dataset.q,tipo:el.dataset.tipo,exato:true});Nomus.last=r;out.innerHTML=resultHTML(r);use.hidden=false}
    catch(e){out.innerHTML=`<p class="errbox">${esc(e.message)}</p>`}
  },
  async nomusTeste(el){
    const o=document.getElementById('nm-teste');el.disabled=true;if(o)o.textContent='Consultando…';
    try{const r=await Nomus.call({acao:'ping'});if(o)o.textContent=r&&r.ok?`Conexão com o Nomus funcionando${r.tls?' (TLS '+r.tls+')':''}.`:'Resposta inesperada do Nomus.'}
    catch(e){if(o)o.textContent=e.message}
    el.disabled=false;
  }
});
Object.assign(MX.sub,{
  async nomusBuscar(f){
    const q=f.querySelector('#nm-q').value.trim(),out=f.querySelector('#nm-out'),go=f.querySelector('#nm-go'),use=f.querySelector('#nm-use');
    if(!q){out.innerHTML='<p class="errbox">Digite o número do pedido ou da ordem.</p>';return}
    go.disabled=true;use.hidden=true;Nomus.last=null;out.innerHTML='<p class="hint">Consultando o Nomus…</p>';
    try{const r=await Nomus.call({acao:'buscar',q});Nomus.last=r.tipo==='lista'?null:r;out.innerHTML=resultHTML(r);use.hidden=r.tipo==='lista'}
    catch(e){out.innerHTML=`<p class="errbox">${esc(e.message)}</p>`}
    go.disabled=false;
  }
});

/* Administração > Configurações: teste da conexão */
window.vNomusAdmin=()=>!Settings.on('nomus')?'':`<div class="panel"><h2>Integração com o Nomus</h2><p class="hint">Consulta de pedidos e ordens (somente leitura). A chave fica guardada no servidor, nunca no aplicativo.</p><div class="actions"><button type="button" class="btn" data-act="nomusTeste" ${CLOUD?'':'disabled'}>Testar conexão com o Nomus</button></div><p class="hint" id="nm-teste" aria-live="polite">${CLOUD?'':'Disponível só com o aplicativo conectado à nuvem.'}</p></div>`;
})();
