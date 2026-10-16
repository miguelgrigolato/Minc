/* MINC · ServiceHub — Custos do RTS (v5.29.0)
   Botão "Custo" ao lado de "Visualizar" no RTS: previsão orçamentária ligada ao RTS (um orçamento por RTS, pelo id do RTS).
   - Cabeçalho vem do RTS (e da D.E. vinculada): ninguém redigita número, cliente, produto etc.
   - Itens vêm da lista de materiais (D.E. vinculada e lista do RTS); sem lista, entra a estrutura padrão da planilha de custos.
   - Preço: "estimado" (referência do histórico de compras do Nomus) ou "informado" (digitado). O valor usado fica guardado; a
     referência nunca troca o preço sozinha. Não existe "preço confirmado" porque o processo da empresa não tem essa etapa.
   - Quem vale nos números é o banco (gatilho rts_costs_calc); aqui a conta é a mesma para mostrar na hora.
   - Documento (PDF) usa a mesma moldura do RTS (RtsPdfFrame, rts.js). Excel com números de verdade.
   Tabela: rts_costs (um registro por RTS) + histórico em doc_audit (kind 'custo'). Carregado depois do rts.js. */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};
MX.sync=MX.sync||[];MX.boot=MX.boot||[];
const C=window.CustosCalc;
const KV='cost:';
const missing=e=>!!e&&(e.code==='PGRST205'||e.code==='42P01'||/relation .* does not exist|schema cache/i.test(e.message||''));
const brl=n=>n==null?'—':'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const brlP=n=>n==null?'—':'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:4});
const inNum=n=>n==null?'':String(n).replace('.',',');
const dBR=iso=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso||''));return m?`${m[3]}/${m[2]}/${m[1]}`:''};
const rtsById=id=>(window.RTSLIST?RTSLIST():[]).find(r=>r.id===id);
const dep=r=>r&&r.processoId&&typeof PROCS!=='undefined'?PROCS.find(p=>p.id===r.processoId&&!p.deletedAt):null;

/* ============================== Estado ============================== */
const Costs={
  map:new Map(),cfg:{acesso:'membros',padrao:null},cfgAt:0,off:false,
  get:id=>Costs.map.get(id),
  async put(c){this.map.set(c.rtsId,c);try{await Store.put('kv',{k:KV+c.rtsId,v:c})}catch(e){console.error('custos (local)',e)}},
  async load(){try{for(const x of await Store.all('kv'))if(String(x.k).startsWith(KV)&&x.v)this.map.set(x.v.rtsId,x.v)}catch{}},
  dirtyN:()=>[...Costs.map.values()].filter(c=>c._dirty&&!c._conflict).length
};
window.Costs=Costs;
MX.boot.push(()=>Costs.load());
const canCost=()=>{
  if(!S.user)return false;
  if(!CLOUD)return true;
  const m=['admin','gestor'].includes(S.user.cloudRole);
  return m||(S.user.cloudRole==='operador'&&Costs.cfg.acesso!=='gestores');
};
const isMgr=()=>typeof isManager==='function'&&isManager();
const SAVE={t:null,ids:new Set(),
  queue(id){this.ids.add(id);clearTimeout(this.t);this.t=setTimeout(()=>this.flush(),500)},
  async flush(){clearTimeout(this.t);const ids=[...this.ids];this.ids.clear();for(const id of ids){const c=Costs.get(id);if(c)await Costs.put(c)}}};
window.addEventListener('pagehide',()=>{SAVE.flush()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)SAVE.flush()});
function touchC(c){
  c._dirty=true;c._novo=false;c.updatedAt=new Date().toISOString();c.updatedBy=S.user?.name||c.updatedBy||'';
  SAVE.queue(c.rtsId);if(window.Sync)Sync.kick(2500);
  const st=document.getElementById('cst-state');if(st)st.innerHTML=stateHTML(c);
}
const stateHTML=c=>c._conflict?'<span class="badge st-amber">Conflito</span>':!CLOUD?'<span class="muted">Salvo neste aparelho</span>':c._novo?'<span class="muted">Ainda não salvo (nada foi alterado)</span>':c._dirty||c._rev==null?'<span class="muted">Salvo no aparelho · envio pendente</span>':'<span class="muted">Sincronizado</span>';

/* ---------- fontes da lista de materiais ---------- */
function fontes(r){
  const out=[],p=dep(r);
  if(p&&typeof matRows==='function'){
    let rows=[];try{rows=matRows(p)}catch(e){console.error('lista da D.E.',e)}
    const vistos=new Map();
    for(const x of rows){
      const serv=x.tipo==='Serviço';
      const desc=[x.raw,!serv&&x.material,!serv&&x.dimensao].filter(v=>v&&String(v).trim()).join(' - ').trim();
      if(!desc)continue;
      const cod=x.codigo&&x.codigo!=='SEM CADASTRO'?x.codigo:'';
      /* chave estável: o nº do componente muda quando entram outros; usa o nome dele + o que é o item (e a ordem, se repetir) */
      const k0=`de|${p.id}|${C.nz(x.comp)}|${cod||C.nz(x.raw)}|${C.nz(x.material)}|${C.nz(x.dimensao)}`,rep=(vistos.get(k0)||0)+1;vistos.set(k0,rep);
      out.push({chave:k0+'|'+rep,sec:serv?'srv':'mat',cat:serv?'Serviço (da D.E.)':'Matéria-prima (da D.E.)',codigo:cod,desc,un:String(x.unit||'').toUpperCase()||(serv?'UN':'PÇ'),qtd:C.parseNum(x.qty),origemTipo:'de',ref:x.comp?`${x.no} ${x.comp}`:''});
    }
  }
  for(const m of r.materiais||[]){
    if(!String(m.desc||'').trim())continue;
    out.push({chave:'rts|'+m.id,sec:'mat',cat:'Lista de materiais do RTS',codigo:'',desc:String(m.desc).toUpperCase(),un:String(m.unid||'PÇ').toUpperCase(),qtd:C.parseNum(m.qtd),origemTipo:'rts',ref:''});
  }
  return out;
}
const itemDeFonte=f=>C.itemNovo({sec:f.sec,cat:f.cat,codigo:f.codigo,desc:f.desc,un:f.un,qtd:f.qtd,origem:{tipo:f.origemTipo,chave:f.chave,snap:C.snapOf(f)}});

/* ---------- abrir / criar o orçamento do RTS ---------- */
function ensure(r){
  let c=Costs.get(r.id);
  if(c)return c;
  const d=C.orcamentoInicial(Costs.cfg.padrao);
  const f=fontes(r);
  if(f.length){   // lista de materiais disponível: entra primeiro; a estrutura padrão fica só com despesas, mão de obra e serviços
    d.itens=d.itens.filter(i=>i.sec!=='mat');
    d.itens=[...f.map(itemDeFonte),...d.itens];
  }
  if(!emp(r.prazoDias))d.prazoDias=String(r.prazoDias);
  c={rtsId:r.id,data:d,_rev:null,_dirty:false,_novo:true,_conflict:null,updatedAt:new Date().toISOString(),_fonte:f.length};
  Costs.map.set(r.id,c);   // só vai para o aparelho/nuvem na primeira alteração
  return c;
}
const cur=()=>{const r=rtsById(S.custoRts);return r?{r,c:ensure(r)}:{r:null,c:null}};

/* ============================== Nuvem ============================== */
const Cloud={
  async cfg(){
    if(!CLOUD||!navigator.onLine||Date.now()-Costs.cfgAt<600000)return false;
    const q=await SB.from('app_settings').select('value').eq('key','custos_config');
    if(q.error)throw q.error;
    const v=q.data[0]?.value||{};Costs.cfgAt=Date.now();
    const n={acesso:v.acesso==='gestores'?'gestores':'membros',padrao:v.padrao||null},ch=JSON.stringify(n)!==JSON.stringify(Costs.cfg);
    Costs.cfg=n;try{localStorage.setItem('minc_custos_cfg',JSON.stringify(n))}catch{}
    return ch;
  },
  async push(){
    if(!CLOUD||Costs.off)return false;let did=false;
    for(const c of [...Costs.map.values()].filter(x=>x._dirty&&!x._conflict)){
      const r=rtsById(c.rtsId);if(!r||r._rev==null)continue;   // o RTS precisa estar na nuvem primeiro
      const snap=c.updatedAt;let out=null;
      const row={id:c.rtsId,rts_id:c.rtsId,data:c.data};
      if(c._rev==null){
        const q=await SB.from('rts_costs').insert({...row,created_by:S.user.id}).select('rev,data,total_geral').single();
        if(!q.error)out=q.data;
        else if(missing(q.error)){Costs.off=true;return did}
        else if(q.error.code==='23505'){const g=await SB.from('rts_costs').select('*').eq('id',c.rtsId).single();if(g.error)throw g.error;c._conflict=g.data;await Costs.put(c);did=true;continue}   // outra pessoa criou o orçamento antes: você escolhe qual vale
        else if(window.apReject&&await apReject('rts_costs',c,q.error,()=>Costs.put(c))){did=true;continue}
        else throw q.error;
      }
      if(!out){
        const q=await SB.from('rts_costs').update({data:c.data}).eq('id',c.rtsId).eq('rev',c._rev).select('rev,data,total_geral');
        if(q.error){if(window.apReject&&await apReject('rts_costs',c,q.error,()=>Costs.put(c))){did=true;continue}throw q.error}
        if(!q.data.length){const g=await SB.from('rts_costs').select('*').eq('id',c.rtsId).single();if(g.error)throw g.error;c._conflict=g.data;await Costs.put(c);did=true;continue}
        out=q.data[0];
      }
      c._rev=out.rev;
      if(c.updatedAt===snap){c._dirty=false;c.data=out.data}   // o servidor devolve os totais conferidos
      await Costs.put(c);did=true;
    }
    return did;
  },
  async pull(){
    if(!CLOUD||Costs.off)return false;
    let since=localStorage.getItem('minc_costs_lastpull')||'1970-01-01T00:00:00Z',max=since,changed=false;
    for(let g=0;g<50;g++){
      const {data,error}=await SB.from('rts_costs').select('*').gte('updated_at',since).order('updated_at',{ascending:true}).limit(200);
      if(error){if(missing(error)){Costs.off=true;return changed}throw error}
      for(const row of data){changed=(await this.apply(row))||changed;if(row.updated_at>max)max=row.updated_at}
      if(data.length<200||max===since)break;since=max;
    }
    localStorage.setItem('minc_costs_lastpull',max);return changed;
  },
  async apply(row){
    const loc=Costs.get(row.rts_id);
    if(!loc||loc._novo&&!loc._dirty){await Costs.put({rtsId:row.rts_id,data:row.data,_rev:row.rev,_dirty:false,_conflict:null,updatedAt:row.updated_at});return true}
    if(row.rev<=(loc._rev??0))return false;
    if(loc._dirty){loc._conflict=row;await Costs.put(loc);return true}
    Object.assign(loc,{data:row.data,_rev:row.rev,_dirty:false,_conflict:null,updatedAt:row.updated_at});await Costs.put(loc);return true;
  }
};
MX.sync.push(async()=>{
  if(!S.user||!CLOUD)return false;
  let a=false;try{a=await Cloud.cfg()}catch(e){console.error('config de custos',e)}
  return (await Cloud.push())||(await Cloud.pull())||a;
});
const prevPending=MX.pending;MX.pending=()=>(prevPending?prevPending():0)+Costs.dirtyN();
const prevRefresh=MX.refresh;
MX.refresh=typing=>{if(S.screen==='custo'){if(!typing&&!document.querySelector('.cst-doc input:focus,.cst-doc textarea:focus'))renderMain()}else prevRefresh&&prevRefresh(typing)};
try{const v=JSON.parse(localStorage.getItem('minc_custos_cfg'));if(v)Costs.cfg=v}catch{}

/* ============================== Botão na lista e no RTS ============================== */
window.custoBtn=r=>{
  if(!canCost())return '';
  const c=Costs.get(r.id),saved=c&&!c._novo,s=saved?C.resumo(c.data.itens):null;
  const tip=saved?`Orçamento salvo · ${s.itens} ${s.itens===1?'item':'itens'}${s.pendentes?` · ${s.pendentes} pendente${s.pendentes>1?'s':''}`:''}${s.total?' · '+brl(s.total):''}`:'Ainda sem orçamento';
  return `<button class="btn" data-act="custoOpen" data-id="${esc(r.id)}" title="${esc(tip)}">${ic('doc')}Custo${saved?`<span class="cst-dot${s.pendentes?' warn':''}" aria-label="${esc(tip)}"></span>`:''}</button>`;
};
Object.assign(MX.act,{
  custoOpen(el){
    if(!canCost()){toast('Você não tem acesso aos custos.');return}
    const r=rtsById(el.dataset.id);if(!r){toast('RTS não encontrado.');return}
    if(window.RtsSave)RtsSave.flush();
    S.custoRts=r.id;S.custoBack=S.screen==='rtsEdit'?'rtsEdit':'rts';S.rtsId=r.id;S.screen='custo';S.anim='up';render();scrollTo(0,0);
  },
  custoBack(){SAVE.flush();S.screen=S.custoBack||'rts';S.anim='up';render();scrollTo(0,0)}
});

/* ============================== Tela ============================== */
const idLine=(l,v)=>emp(v)?'':`<div><dt>${l}</dt><dd>${esc(v)}</dd></div>`;
function headerInfo(r){
  const p=dep(r);
  return [['Nº do RTS',r.numero],['Cliente',r.cliente],['Produto / válvula',r.produto+(emp(r.codigoProduto)?'':' ('+r.codigoProduto+')')],['Quantidade',r.quantidade],
    ['Pedido (D.E.)',p&&p.pedido],['Ordem (D.E.)',p&&p.ordem],['Processo (D.E.)',p&&p.process],['Elaborado por',r.elaboradoPor],['Prazo do RTS',r.prazoData?dBR(r.prazoData):(r.prazoDias?r.prazoDias+(r.prazoRef?' '+r.prazoRef:''):'')],['Status do RTS',r.status]];
}
const bud=(id,l,k,v,ph='')=>`<div class="field"><label for="${id}">${l}</label><input id="${id}" value="${esc(v)}" placeholder="${esc(ph)}" data-inp="cstH" data-k="${k}" data-keep-case autocomplete="off"></div>`;
function refHTML(it){
  const rf=it.ref;
  if(!rf)return '';
  if(rf.valor==null)return `<span class="cst-ref none" title="${esc(rf.motivo||'')}">Nomus: ${esc(rf.motivo||'sem histórico')}</span>`;
  const used=C.parseNum(it.preco);
  const ign=used!=null&&Math.abs(used-rf.valor)>1e-9;
  const old=rf.antigo?' · <b>histórico antigo</b>':'';
  return `<span class="cst-ref ${rf.antigo?'old':''}" title="${esc(rf.metodo||'')}">Ref. Nomus <b>${brlP(rf.valor)}</b> · ${rf.n} ${rf.n===1?'compra':'compras'} · última ${dBR(rf.ultimaCompra)} · confiança ${esc(rf.confianca)}${old}${ign?` · usado ${brlP(used)}`:''}</span>${ign||used==null?`<button type="button" class="btn sm" data-act="cstUseRef" data-id="${esc(it.id)}">Usar referência</button>`:''}`;
}
function totTxt(it){
  const l=C.linha(it);
  if(l.estado==='ok')return brl(l.total);
  if(l.estado==='pendente')return `<span class="cst-pend">Pendente — falta ${l.falta.join(' e ')}</span>`;
  return '<span class="muted">—</span>';
}
function rowHTML(it){
  const l=C.linha(it),mo=it.sec==='mo',cls=(l.estado==='pendente'?' cst-pnd':l.estado==='vazio'?' vazio':'')+(mo?' mo':'');
  const f=(k,label,cls2,ph,extra='')=>`<input class="${cls2}" aria-label="${label}" placeholder="${ph||label}" value="${esc(['qtd','preco','horas'].includes(k)?inNum(it[k]):it[k])}" data-inp="cstF" data-id="${esc(it.id)}" data-k="${k}" data-keep-case autocomplete="off" ${['qtd','preco','horas'].includes(k)?'inputmode="decimal"':''} ${extra}>`;
  const tag=it.preco!=null&&it.preco!==''?(it.preco_tipo==='referencia'?'<span class="cst-tag est">Estimado</span>':'<span class="cst-tag inf">Informado</span>'):'';
  return `<div class="cst-row${cls}" data-row="${esc(it.id)}"><div class="cst-main">${f('desc','Descrição','cst-desc','Descrição do item')}${f('un','Unidade','cst-un','Un.','list="cst-un"')}${mo?f('qtd','Pessoas','cst-num','Pessoas')+f('horas','Horas','cst-num','Horas'):f('qtd','Quantidade','cst-num','Qtd.')}${f('preco',mo?'Valor da hora (R$)':'Preço unitário (R$)','cst-num',mo?'R$/h':'Preço unit.')}<output class="cst-tot" id="tot-${esc(it.id)}">${totTxt(it)}</output><button class="iconb" data-act="cstRm" data-id="${esc(it.id)}" aria-label="Remover item">${ic('trash')}</button></div><div class="cst-sub"><span id="tag-${esc(it.id)}">${tag}</span>${it.sec!=='mo'?f('codigo','Código Nomus','cst-cod','Código Nomus'):''}${f('obs','Observação','cst-obs','Observação (especificação, justificativa de preço…)')}<span class="cst-refw" id="ref-${esc(it.id)}">${refHTML(it)}</span>${it.sec!=='mo'&&emp(it.codigo)?`<button type="button" class="btn sm ghost" data-act="${it.sec==='mat'?'cstVinc':'cstSrvVinc'}" data-id="${esc(it.id)}">Vincular código</button>`:''}</div></div>`;
}
function secHTML(c,s){
  const itens=c.data.itens.filter(i=>i.sec===s.k);
  const rs=C.resumo(itens);
  const head=s.k==='mo'?'<span>Descrição</span><span>Un.</span><span>Pessoas</span><span>Horas</span><span>R$/h</span><span>Total</span><span></span>':'<span>Descrição</span><span>Un.</span><span>Qtd.</span><span>Preço unit.</span><span>Total</span><span></span>';
  const add=`<button class="btn" data-act="cstAdd" data-sec="${s.k}">${ic('plus')}${s.k==='mo'?'Setor':'Item'}</button>`+(s.k==='mat'?`<button class="btn" data-act="cstCat">Do catálogo padrão</button><button class="btn" data-act="cstMats">Do cadastro de matéria-prima</button>`:'');
  return `<section class="panel cst-sec" id="sec-${s.k}"><div class="ph-row"><h2>${s.t}</h2><div class="cst-sub-t" id="sub-${s.k}">${rs.itens?`Subtotal <b>${brl(rs.total)}</b>${rs.pendentes?` · ${rs.pendentes} pendente${rs.pendentes>1?'s':''}`:''}`:'<span class="muted">Nada orçado</span>'}</div></div><div class="cst-h ${s.k==='mo'?'mo':''}">${head}</div>${itens.map(rowHTML).join('')||'<p class="hint">Nenhum item. Use os botões abaixo para adicionar.</p>'}<div class="actions" style="margin-top:10px">${add}</div></section>`;
}
function summaryHTML(c){
  const rs=C.resumo(c.data.itens);
  const sub=C.SECS.filter(s=>rs.subtotais[s.k]||c.data.itens.some(i=>i.sec===s.k&&C.linha(i).estado==='ok')).map(s=>`<div><dt>${s.t}</dt><dd>${brl(rs.subtotais[s.k])}</dd></div>`).join('');
  return `<div class="panel cst-sum" id="cst-sum"><div class="cst-total"><small>${rs.parcial?'Total parcial (há itens pendentes)':'Total estimado'}</small><b>${brl(rs.total)}</b></div><dl class="cst-subs">${sub}</dl><div class="cst-cnt"><span><b>${rs.itens}</b> ${rs.itens===1?'item orçado':'itens orçados'}</span><span><b>${rs.estimados}</b> estimado${rs.estimados===1?'':'s'}</span><span><b>${rs.informados}</b> informado${rs.informados===1?'':'s'}</span><span class="${rs.pendentes?'cst-pend':''}"><b>${rs.pendentes}</b> pendente${rs.pendentes===1?'':'s'}</span></div></div>`;
}
MX.views.custo=function(){
  setTimeout(()=>{if(CLOUD)Hist.carregar().then(i=>{const e=document.getElementById('cst-hist');if(e&&i)e.innerHTML='<b>Histórico de compras:</b> '+infoTxt(i)+'. '}).catch(()=>{})},0);
  const {r,c}=cur();
  if(!r)return `<div class="empty"><h2>RTS não encontrado</h2><button class="btn" data-act="rtsHome">Voltar</button></div>`;
  const info=headerInfo(r).map(([l,v])=>idLine(l,v)).join('');
  const conflict=c._conflict?`<div class="panel conflict"><div class="ph-row"><div><h2>Outra pessoa alterou este orçamento</h2><p class="hint" style="margin:0">Escolha qual versão vale. Os preços de referência e informados da versão descartada não são recuperados.</p></div><div class="actions"><button class="btn" data-act="cstUseCloud">Usar a da nuvem</button><button class="btn primary" data-act="cstKeepMine">Manter a minha</button></div></div></div>`:'';
  const novo=c._novo&&c._fonte?`<div class="mdl-hint" style="margin-bottom:12px"><b>${c._fonte===1?'1 item carregado':c._fonte+' itens carregados'} da lista de materiais.</b><span>Nada é salvo até você alterar alguma coisa.</span></div>`:c._novo?`<div class="mdl-hint" style="margin-bottom:12px"><b>Este RTS não tem lista de materiais.</b><span>Entrou a estrutura padrão (itens em branco não contam e não saem no documento). Complete o que usar ou adicione do catálogo.</span></div>`:'';
  return `<div class="cst-doc"><div class="ph"><button class="btn ghost" data-act="custoBack">${ic('back')}${S.custoBack==='rtsEdit'?'Voltar ao RTS':'Todos os RTS'}</button><div class="ph-row"><div><h1>Custos — RTS ${esc(r.numero)||'(sem nº)'}</h1><p id="cst-state" class="hint" style="margin:0">${stateHTML(c)}</p></div><div class="actions"><button class="btn" data-act="cstPdfOpen">${ic('print')}Visualizar</button><button class="btn" data-act="cstXlsx">${ic('download')}Excel</button><button class="btn primary" data-act="cstPdf">${ic('download')}Baixar PDF</button></div></div></div>${conflict}${novo}
<div class="panel"><div class="ph-row"><h2>Identificação <span class="muted" style="font-weight:400;font-size:13px">· vem do RTS</span></h2><button class="btn" data-act="cstOpenRts">Abrir RTS</button></div><dl class="kv cst-kv">${info}</dl></div>
<div class="panel"><h2>Dados do orçamento</h2><div class="grid g3">${bud('ch-sol','Solicitante','solicitante',c.data.solicitante)}${bud('ch-eng','Responsável pela engenharia','respEngenharia',c.data.respEngenharia)}${bud('ch-prj','Responsável pelo projeto','respProjeto',c.data.respProjeto)}${bud('ch-prz','Prazo (dias úteis)','prazoDias',c.data.prazoDias)}</div><div class="field"><label for="ch-com">Comentários</label><textarea id="ch-com" rows="2" class="rts-ta" data-inp="cstH" data-k="comentarios" data-keep-case placeholder="Ex.: este orçamento prevê atividades realizadas no site da MINC.">${esc(c.data.comentarios)}</textarea></div></div>
<div class="panel"><div class="ph-row"><div><h2>Lista e preços</h2><p class="hint" style="margin:0"><span id="cst-hist"></span> Pendente = tem quantidade ou preço, mas falta o outro: fica de fora do total (nunca vira zero) e sai como “pendente” no documento. Linhas em branco não contam.</p></div><div class="actions"><button class="btn" data-act="cstImport">${ic('refresh')}Atualizar da lista de materiais</button><button class="btn" data-act="cstNomus">Buscar preços no histórico</button><button class="btn" data-act="cstHist">${ic('clock')}Histórico</button>${isMgr()?'<button class="btn ghost" data-act="cstHistImport">Importar histórico</button><button class="btn ghost" data-act="cstPadrao">Lista padrão</button>':''}</div></div></div>
${summaryHTML(c)}${C.SECS.map(s=>secHTML(c,s)).join('')}
<datalist id="cst-un">${C.UNIDADES.map(u=>`<option value="${u}">`).join('')}</datalist></div>`;
};

/* ---------- edição ---------- */
const NUMK={qtd:3,preco:4,horas:2};
const findIt=(c,id)=>c.data.itens.find(i=>i.id===id);
function upd(c,it){
  const t=document.getElementById('tot-'+it.id);if(t)t.innerHTML=totTxt(it);
  const row=document.querySelector(`[data-row="${CSS.escape(it.id)}"]`);if(row){const l=C.linha(it);row.classList.toggle('cst-pnd',l.estado==='pendente');row.classList.toggle('vazio',l.estado==='vazio')}
  const tg=document.getElementById('tag-'+it.id);if(tg)tg.innerHTML=it.preco!=null?(it.preco_tipo==='referencia'?'<span class="cst-tag est">Estimado</span>':'<span class="cst-tag inf">Informado</span>'):'';
  const rf=document.getElementById('ref-'+it.id);if(rf)rf.innerHTML=refHTML(it);
  const s=C.SECS.find(x=>x.k===it.sec),rs=C.resumo(c.data.itens.filter(i=>i.sec===it.sec)),sb=document.getElementById('sub-'+it.sec);
  if(sb)sb.innerHTML=rs.itens?`Subtotal <b>${brl(rs.total)}</b>${rs.pendentes?` · ${rs.pendentes} pendente${rs.pendentes>1?'s':''}`:''}`:'<span class="muted">Nada orçado</span>';
  const sm=document.getElementById('cst-sum');if(sm)sm.outerHTML=summaryHTML(c);
}
Object.assign(MX.inp,{
  cstF(el){
    const {c}=cur();if(!c)return;const it=findIt(c,el.dataset.id);if(!it)return;const k=el.dataset.k;
    if(NUMK[k]!==undefined){
      const raw=el.value.trim(),n=raw===''?null:C.parseNum(raw);
      if(raw!==''&&(n==null||n<0)){el.classList.add('invalid');return}
      el.classList.remove('invalid');it[k]=n==null?null:C.dec(n,NUMK[k]);
      if(k==='preco'){it.preco_tipo=it.preco==null?null:(it.ref&&it.ref.valor!=null&&Math.abs(it.preco-it.ref.valor)<1e-9?'referencia':'informado')}
    }else it[k]=el.value;
    touchC(c);if(NUMK[k]!==undefined)upd(c,it);
  },
  cstH(el){const {c}=cur();if(!c)return;c.data[el.dataset.k]=el.value;touchC(c)}
});
Object.assign(MX.chg,{});
const itemFocus=id=>{const e=document.querySelector(`[data-row="${CSS.escape(id)}"] .cst-desc`);if(e){e.scrollIntoView({block:'center'});e.focus()}};
const addItems=(c,list)=>{c.data.itens.push(...list);touchC(c);renderMain()};
Object.assign(MX.act,{
  cstAdd(el){
    const {c}=cur();if(!c)return;const sec=el.dataset.sec;
    const it=C.itemNovo({sec,un:sec==='mo'?'H':sec==='mat'?'PÇ':'UN',qtd:sec==='mo'?1:null,origem:{tipo:'manual'}});
    c.data.itens.push(it);touchC(c);renderMain();itemFocus(it.id);
  },
  async cstRm(el){
    const {c}=cur();if(!c)return;const it=findIt(c,el.dataset.id);if(!it)return;
    const l=C.linha(it);
    if(l.estado!=='vazio'&&!await ask({title:'Remover o item?',body:`“${it.desc||'sem descrição'}” sai do orçamento. A remoção fica no histórico.`,ok:'Remover',danger:true}))return;
    c.data.itens=c.data.itens.filter(i=>i.id!==it.id);touchC(c);renderMain();
  },
  cstUseRef(el){
    const {c}=cur();if(!c)return;const it=findIt(c,el.dataset.id);if(!it||!it.ref||it.ref.valor==null)return;
    it.preco=it.ref.valor;it.preco_tipo='referencia';touchC(c);renderMain();toast('Preço de referência aplicado (estimado).');
  },
  cstOpenRts(){const {r}=cur();if(r){S.custoBack='rts';SAVE.flush();MX.act.rtsOpen({dataset:{id:r.id}})}},
  async cstUseCloud(){const {c}=cur();if(!c||!c._conflict)return;const row=c._conflict;Object.assign(c,{data:row.data,_rev:row.rev,_dirty:false,_conflict:null,updatedAt:row.updated_at});await Costs.put(c);renderMain();toast('Versão da nuvem carregada.')},
  async cstKeepMine(){const {c}=cur();if(!c||!c._conflict)return;c._rev=c._conflict.rev;c._conflict=null;touchC(c);await Costs.put(c);renderMain();toast('Sua versão será enviada.')}
});

/* ---------- catálogo padrão e cadastro de matéria-prima ---------- */
const nzs=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
Object.assign(MX.act,{
  cstCat(){
    const {c}=cur();if(!c)return;
    const have=new Set(c.data.itens.filter(i=>i.sec==='mat').map(i=>C.nz(i.desc)));
    const grupos=C.CATALOGO.reduce((m,[cat,un,l])=>{(m[cat]=m[cat]||[]).push(...l.map(d=>({d,un})));return m},{});
    const html=Object.entries(grupos).map(([cat,l])=>`<fieldset class="cst-grp"><legend>${esc(cat)}</legend>${l.map(x=>`<label class="chk ${have.has(C.nz(x.d))?'dis':''}" data-q="${esc(nzs(x.d+' '+cat))}"><input type="checkbox" name="i" value="${esc(cat+'|'+x.un+'|'+x.d)}" ${have.has(C.nz(x.d))?'disabled':''}><span>${esc(x.d)}${have.has(C.nz(x.d))?' <small class="muted">(já na lista)</small>':''}</span></label>`).join('')}</fieldset>`).join('');
    dialog(`<form class="dlg-body cst-dlg" data-submit="cstCat"><h2>Catálogo padrão de materiais</h2><p>Marque o que será usado neste serviço. Só entra o que você marcar, sem quantidade nem preço.</p><div class="field"><label for="cc-q">Buscar</label><input id="cc-q" data-inp="cstFilter" autocomplete="off" placeholder="parafuso, junta, lixa…"></div><div class="cst-list">${html}</div><div class="actions end"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit">Adicionar marcados</button></div></form>`);
  },
  cstMats(el){
    const {c}=cur();if(!c)return;
    S.cstTarget=el&&el.dataset&&el.dataset.id||null;
    dialog(`<div class="dlg-body cst-dlg"><h2>${S.cstTarget?'Vincular código do cadastro':'Cadastro de matéria-prima'}</h2><p>Busque pelo código ou descrição (use % para pular palavras).</p><div class="field"><label for="cm-q">Buscar</label><input id="cm-q" data-inp="cstMatQ" autocomplete="off" autofocus placeholder="paraf%sext%m10"></div><div class="cst-list" id="cm-res"><p class="hint">Digite para buscar.</p></div><div class="actions end"><button type="button" class="btn" data-act="closeDlg">Fechar</button></div></div>`);
  },
  cstVinc(el){MX.act.cstMats(el)},
  cstMatPick(el){
    const {c}=cur();if(!c)return;const m=window.Mats&&Mats.list.find(x=>x.id===el.dataset.mid);if(!m)return;
    if(S.cstTarget){const it=findIt(c,S.cstTarget);if(it){it.codigo=m.codigo;if(emp(it.desc))it.desc=m.descricao;it.ref=null;touchC(c);renderMain()}}
    else addItems(c,[C.itemNovo({sec:'mat',cat:m.familia||'Matéria-prima',codigo:m.codigo,desc:m.descricao,un:String(m.unidade||'PÇ').toUpperCase(),origem:{tipo:'catalogo',chave:'cat|'+m.codigo}})]);
    closeDialog(el.closest('dialog'));toast(S.cstTarget?'Código vinculado.':'Item adicionado.');S.cstTarget=null;
  }
});
Object.assign(MX.inp,{
  cstFilter(el){const q=nzs(el.value).split(/[\s%]+/).filter(Boolean);el.closest('form').querySelectorAll('.chk').forEach(l=>{l.hidden=!q.every(w=>l.dataset.q.includes(w))});el.closest('form').querySelectorAll('.cst-grp').forEach(g=>{g.hidden=![...g.querySelectorAll('.chk')].some(l=>!l.hidden)})},
  cstMatQ(el){
    const out=document.getElementById('cm-res');if(!out)return;
    const q=nzs(el.value).split(/[\s%]+/).filter(Boolean);
    if(!q.length||!window.Mats){out.innerHTML='<p class="hint">Digite para buscar.</p>';return}
    const l=Mats.active().filter(x=>q.every(w=>(x._d+' '+x._c).includes(w))).slice(0,40);
    out.innerHTML=l.map(m=>`<div class="cst-mp"><div><b>${esc(m.codigo)}</b> ${esc(m.descricao)}<br><small class="muted">${esc(m.familia)} · ${esc(m.unidade)}</small></div><button type="button" class="btn" data-act="cstMatPick" data-mid="${esc(m.id)}">${S.cstTarget?'Vincular':'Adicionar'}</button></div>`).join('')||'<p class="hint">Nada encontrado.</p>';
  }
});
Object.assign(MX.sub,{
  cstCat(f){
    const {c}=cur();if(!c)return;
    const sel=[...f.querySelectorAll('input[name=i]:checked')].map(x=>x.value.split('|'));
    if(!sel.length){toast('Marque ao menos um item.');return}
    closeDialog(f.closest('dialog'));
    addItems(c,sel.map(([cat,un,d])=>C.itemNovo({sec:'mat',cat,desc:d,un,origem:{tipo:'catalogo',chave:'cat|'+C.nz(d)}})));
    toast(`${sel.length} ${sel.length===1?'item adicionado':'itens adicionados'}.`);
  }
});

/* ---------- atualizar pela lista de materiais (sem duplicar, sem sobrescrever preço) ---------- */
const campoTxt={qtd:'quantidade',un:'unidade',desc:'descrição'};
Object.assign(MX.act,{
  cstImport(){
    const {r,c}=cur();if(!r)return;
    const f=fontes(r);
    if(!f.length){toast('Este RTS não tem lista de materiais (nem D.E. vinculada com matéria-prima).');return}
    const p=C.planoImportacao(c.data.itens,f);
    S.cstPlan=p;
    if(!p.novos.length&&!p.alterados.length&&!p.sumiram.length){toast('O orçamento já está igual à lista de materiais.');return}
    const sec=(t,rows)=>rows.length?`<fieldset class="cst-grp"><legend>${t}</legend>${rows.join('')}</fieldset>`:'';
    const novos=p.novos.map((x,i)=>`<label class="chk"><input type="checkbox" name="n" value="${i}" checked><span>${esc(x.desc)} <small class="muted">· ${esc(x.un)}${x.qtd!=null?' · qtd '+x.qtd:''}${x.ref?' · '+esc(x.ref):''}</small></span></label>`);
    const alt=p.alterados.map((x,i)=>`<label class="chk"><input type="checkbox" name="a" value="${i}" checked><span>${esc(x.item.desc)} <small class="muted">· ${x.mud.map(m=>`${campoTxt[m.campo]}: ${m.de??'—'} → ${m.para??'—'}`).join('; ')} <i>(o preço não muda)</i></small></span></label>`);
    const sum=p.sumiram.map((x,i)=>`<label class="chk"><input type="checkbox" name="s" value="${i}"><span>${esc(x.desc)} <small class="muted">· não está mais na lista; marque para remover</small></span></label>`);
    dialog(`<form class="dlg-body cst-dlg" data-submit="cstImport"><h2>Atualizar pela lista de materiais</h2><p>Nada é apagado nem duplicado. Confira o que mudou e marque o que aplicar.</p><div class="cst-list">${sec('Itens novos ('+p.novos.length+')',novos)}${sec('Itens alterados na lista ('+p.alterados.length+')',alt)}${sec('Itens que saíram da lista ('+p.sumiram.length+')',sum)}</div><div class="actions end"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit">Aplicar</button></div></form>`);
  }
});
Object.assign(MX.sub,{
  cstImport(f){
    const {c}=cur(),p=S.cstPlan;if(!c||!p)return;
    const ch=n=>[...f.querySelectorAll(`input[name=${n}]:checked`)].map(x=>+x.value);
    const nn=ch('n'),aa=ch('a'),ss=ch('s');
    c.data.itens.push(...nn.map(i=>itemDeFonte(p.novos[i])));
    for(const i of aa){const {item,fonte}=p.alterados[i];item.qtd=fonte.qtd!=null?C.dec(fonte.qtd,3):item.qtd;item.un=fonte.un||item.un;item.desc=fonte.desc||item.desc;item.origem.snap=C.snapOf(fonte)}
    const rm=new Set(ss.map(i=>p.sumiram[i].id));if(rm.size)c.data.itens=c.data.itens.filter(i=>!rm.has(i.id));
    S.cstPlan=null;closeDialog(f.closest('dialog'));
    if(nn.length||aa.length||rm.size){touchC(c);renderMain()}
    toast(`${nn.length} novo${nn.length===1?'':'s'}, ${aa.length} atualizado${aa.length===1?'':'s'}, ${rm.size} removido${rm.size===1?'':'s'}.`);
  }
});

/* ---------- histórico de compras (planilha do Nomus importada: tabela purchase_history) ---------- */
const Hist={
  info:null,infoAt:0,
  async carregar(force){
    if(!CLOUD||!navigator.onLine)return this.info;
    if(!force&&this.info&&Date.now()-this.infoAt<120000)return this.info;
    const q=await SB.from('purchase_imports').select('at,by_name,arquivo,mantidas,novas,periodo_ini,periodo_fim').order('at',{ascending:false}).limit(1);
    if(q.error){if(missing(q.error)){this.info={semTabela:true};return this.info}throw q.error}
    const c=await SB.from('purchase_history').select('id',{count:'exact',head:true});
    this.info=q.data[0]?{...q.data[0],total:c.count}:{vazio:true};this.infoAt=Date.now();return this.info;
  },
  /* compras de uma lista de códigos, no formato do refPrice */
  async compras(codes){
    const out={};
    for(let i=0;i<codes.length;i+=20){
      const lote=codes.slice(i,i+20);
      for(let from=0;;from+=1000){
        const q=await SB.from('purchase_history').select('codigo,data,qtd,vun,um,fornecedor,tipo_item').in('codigo',lote).order('data',{ascending:false}).range(from,from+999);
        if(q.error)throw q.error;
        for(const x of q.data)(out[x.codigo]=out[x.codigo]||[]).push({data:x.data,situacao:'',quantidade:x.qtd,valorUnitario:x.vun,unidade:x.um,moeda:'R$',fornecedor:x.fornecedor||'',servico:x.tipo_item==='servico'});
        if(q.data.length<1000)break;
      }
    }
    return out;
  }
};
window.CostsHist=Hist;
const infoTxt=i=>!i?'':i.semTabela?'A tabela de histórico de compras ainda não existe no banco.':i.vazio?'Nenhuma compra importada ainda.':`${fmtN(i.total??i.mantidas)} compras · de ${dBR(i.periodo_ini)} a ${dBR(i.periodo_fim)} · importado em ${dBR(i.at)} por ${esc(i.by_name||'—')}`;
const refSecs=['mat','srv','out'];
const semCod=v=>emp(v)||/sem cadastro/i.test(v);
Object.assign(MX.act,{
  async cstNomus(){
    const {c}=cur();if(!c)return;
    if(!CLOUD||!navigator.onLine){toast('A consulta ao histórico de compras precisa de internet e da nuvem. O orçamento continua funcionando sem ela.',{ms:6000});return}
    const its=c.data.itens.filter(i=>refSecs.includes(i.sec)&&!semCod(i.codigo));
    if(!its.length){toast('Nenhum item com código do Nomus. Use “Vincular código” nos itens ou carregue a lista pela D.E.',{ms:6000});return}
    const codes=[...new Set(its.map(i=>String(i.codigo).trim()))];
    let recs={},info=null;
    const t=toast('Consultando o histórico de compras…',{ms:120000});
    try{info=await Hist.carregar(true);if(info&&(info.vazio||info.semTabela)){t.close();toast(info.semTabela?'A tabela de histórico de compras ainda não existe no banco.':'Ainda não há compras importadas. Um administrador/gestor importa a planilha do Nomus em “Importar histórico”.',{ms:8000});return}
      recs=await Hist.compras(codes)}
    catch(e){t.close();toast('Não foi possível consultar o histórico: '+(e.message||e),{ms:8000});return}
    t.close();
    const agora=new Date().toISOString();let com=0,sem=0;
    for(const it of its){
      const rr=recs[String(it.codigo).trim()]||[];
      const ref=C.refPrice(rr,{un:it.un,servico:it.sec!=='mat'});
      if(ref.valor==null)ref.motivo=ref.motivo||'Sem histórico de compras deste código.';
      ref.consultadoEm=agora;ref.fonte='historico_nomus';ref.baseAte=info&&info.periodo_fim||null;
      if(it.ref&&it.ref.valor!=null&&ref.valor!==it.ref.valor){it.refHist=[...(it.refHist||[]),{...it.ref}].slice(-10)}   // a referência anterior fica guardada
      it.ref=ref;if(ref.valor!=null)com++;else sem++;
    }
    touchC(c);renderMain();
    toast(`${com} com referência, ${sem} sem histórico utilizável. Nada foi aplicado: use “Usar referência” em cada item.`,{ms:9000});
  },
  /* ---- serviços: vincular o código escolhendo no histórico de compras ---- */
  cstSrvVinc(el){
    if(!CLOUD){toast('Precisa da nuvem.');return}
    S.cstTarget=el.dataset.id;
    dialog(`<div class="dlg-body cst-dlg"><h2>Vincular serviço do histórico</h2><p>Busque pela descrição (use % para pular palavras). Aparecem os serviços já comprados.</p><div class="field"><label for="cs-q">Buscar</label><input id="cs-q" data-inp="cstSrvQ" autocomplete="off" autofocus placeholder="usinagem, revestimento, transporte…"></div><div class="cst-list" id="cs-res"><p class="hint">Digite para buscar.</p></div><div class="actions end"><button type="button" class="btn" data-act="closeDlg">Fechar</button></div></div>`);
  },
  cstSrvPick(el){
    const {c}=cur();if(!c)return;const it=findIt(c,S.cstTarget);if(!it)return;
    it.codigo=el.dataset.cod;if(emp(it.desc))it.desc=el.dataset.desc;it.ref=null;touchC(c);renderMain();closeDialog(el.closest('dialog'));toast('Código vinculado.');
  },
  /* ---- importar a planilha do Nomus (administrador/gestor) ---- */
  async cstHistImport(){
    if(!CLOUD||!isMgr()){toast('Só administrador ou gestor, com a nuvem ligada, importa o histórico.');return}
    let info=null;try{info=await Hist.carregar(true)}catch{}
    dialog(`<form class="dlg-body cst-dlg" data-submit="cstHistImport" data-step="0"><h2>Importar histórico de compras</h2><p>Escolha a planilha <b>“BD - Custos”</b> exportada do Nomus (compras por nota fiscal). O app confere cada linha: o que tem <b>quantidade, preço ou unidade errados não entra</b> e não vira referência. Serviços ficam. Linhas já importadas antes são ignoradas, então pode importar planilhas novas por cima.</p>${info&&!info.vazio&&!info.semTabela?`<p class="hint">Base atual: ${infoTxt(info)}</p>`:''}<div class="field"><label for="hi-f">Planilha (.xlsx)</label><input id="hi-f" type="file" name="f" accept=".xlsx,.xls,.csv"></div><div id="hi-prev" class="hint" aria-live="polite"></div><div class="actions end"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button type="button" class="btn" id="hi-dl" data-act="cstHistDescartes" hidden>Baixar linhas descartadas</button><button class="btn primary" id="hi-go" type="submit">Ler planilha</button></div></form>`);
  },
  cstHistDescartes(){
    const p=S.cstHist;if(!p||!p.descartadas.length)return;
    const aoa=[['Linha no arquivo','Motivo','Código','Descrição','U.M.','Qtd','Valor unitário','Valor total','Fornecedor','Data']].concat(p.descartadas.map(l=>[l.linha,l.motivo,l.codigo,l.descricao,l.um,l.qtd,l.vun,l.vtot,l.fornecedor,l.data?l.data.toISOString().slice(0,16).replace('T',' '):'']));
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),'Descartadas');XLSX.writeFile(wb,'Compras descartadas na importacao.xlsx');
  }
});
Object.assign(MX.inp,{
  async cstSrvQ(el){
    const out=document.getElementById('cs-res');if(!out)return;
    const toks=el.value.split(/[\s%]+/).map(x=>x.trim()).filter(x=>x.length>1).slice(0,5);
    if(!toks.length){out.innerHTML='<p class="hint">Digite para buscar.</p>';return}
    const seq=(S.cstSeq=(S.cstSeq||0)+1);
    let q=SB.from('purchase_history').select('codigo,descricao,um,data').eq('tipo_item','servico');
    for(const t of toks)q=q.ilike('descricao','%'+t.replace(/[%_,()]/g,' ')+'%');
    const r=await q.order('data',{ascending:false}).limit(400);
    if(seq!==S.cstSeq)return;
    if(r.error){out.innerHTML='<p class="hint">Não foi possível buscar.</p>';return}
    const m=new Map();for(const x of r.data){const e=m.get(x.codigo)||{...x,n:0};e.n++;m.set(x.codigo,e)}
    out.innerHTML=[...m.values()].slice(0,40).map(x=>`<div class="cst-mp"><div><b>${esc(x.codigo)}</b> ${esc(x.descricao)}<br><small class="muted">${esc(x.um)} · ${x.n} ${x.n===1?'compra':'compras'} · última ${dBR(x.data)}</small></div><button type="button" class="btn" data-act="cstSrvPick" data-cod="${esc(x.codigo)}" data-desc="${esc(x.descricao)}">Vincular</button></div>`).join('')||'<p class="hint">Nada encontrado.</p>';
  }
});
Object.assign(MX.sub,{
  async cstHistImport(f){
    const prev=f.querySelector('#hi-prev'),go=f.querySelector('#hi-go'),dl=f.querySelector('#hi-dl');
    if(f.dataset.step==='1'){   // grava
      const p=S.cstHist;if(!p)return;
      go.disabled=true;go.textContent='Importando…';
      try{
        const ins=await SB.from('purchase_imports').insert({by_id:S.user.id,by_name:S.user.name,arquivo:p.arquivo,linhas:p.total,mantidas:p.mantidas.length,descartadas:p.resumo,periodo_ini:p.ini,periodo_fim:p.fim}).select('id').single();
        if(ins.error)throw ins.error;
        const rows=p.mantidas.map(l=>({...C.paraBanco(l),lote:ins.data.id}));let novas=0;
        for(let i=0;i<rows.length;i+=400){
          prev.textContent=`Gravando… ${Math.min(i+400,rows.length)} de ${rows.length}`;
          const q=await SB.from('purchase_history').upsert(rows.slice(i,i+400),{onConflict:'chave',ignoreDuplicates:true}).select('id');
          if(q.error)throw q.error;novas+=q.data.length;
        }
        await SB.from('purchase_imports').update({novas}).eq('id',ins.data.id);
        Hist.info=null;S.cstHist=null;closeDialog(f.closest('dialog'));
        toast(`${fmtN(novas)} compras novas gravadas (${fmtN(rows.length-novas)} já estavam no histórico).`,{ms:8000});
        if(S.screen==='custo')renderMain();
      }catch(e){console.error(e);prev.innerHTML=`<span class="cst-pend">Não foi possível gravar: ${esc(e.message||e)}</span>`;go.disabled=false;go.textContent='Tentar de novo'}
      return;
    }
    const file=f.elements.f.files[0];
    if(!file){prev.textContent='Escolha a planilha.';return}
    go.disabled=true;prev.textContent='Lendo a planilha…';
    try{
      const buf=await file.arrayBuffer();
      const wb=XLSX.read(buf,{type:'array',cellDates:true});
      const aoa=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:null});
      const l=C.lerPlanilhaCompras(aoa);
      if(l.erro){prev.innerHTML=`<span class="cst-pend">${esc(l.erro)}</span>`;go.disabled=false;return}
      const r=C.limparCompras(l.linhas),ds=r.mantidas.map(x=>+x.data);
      S.cstHist={arquivo:file.name,total:l.linhas.length,mantidas:r.mantidas,descartadas:r.descartadas,resumo:r.resumo,ini:new Date(Math.min(...ds)).toISOString(),fim:new Date(Math.max(...ds)).toISOString()};
      const sv=r.mantidas.filter(C.ehServico).length;
      prev.innerHTML=`<b>${fmtN(l.linhas.length)}</b> linhas lidas · <b>${fmtN(r.mantidas.length)}</b> aproveitadas (${fmtN(r.mantidas.length-sv)} de material e ${fmtN(sv)} de serviço) · <b>${fmtN(r.descartadas.length)}</b> descartadas<br><small>Período: ${dBR(S.cstHist.ini)} a ${dBR(S.cstHist.fim)}</small>${r.descartadas.length?`<ul style="margin:6px 0 0 18px">${Object.entries(r.resumo).map(([k,n])=>`<li>${n} — ${esc(k)}</li>`).join('')}</ul>`:''}`;
      if(r.descartadas.length)dl.hidden=false;
      f.dataset.step='1';go.disabled=false;go.textContent=`Importar ${fmtN(r.mantidas.length)} compras`;
    }catch(e){console.error(e);prev.innerHTML=`<span class="cst-pend">Não consegui ler o arquivo: ${esc(e.message||e)}</span>`;go.disabled=false}
  }
});

/* ---------- histórico ---------- */
const CAMPO={qtd:'quantidade',horas:'horas',preco:'preço',preco_tipo:'origem do preço',un:'unidade',desc:'descrição',item_incluido:'item incluído',item_removido:'item removido'};
const ACT={custo_criado:'Orçamento criado',custo_alterado:'Orçamento alterado'};
Object.assign(MX.act,{
  async cstHist(){
    if(!CLOUD){toast('O histórico de custos fica na nuvem (entre com internet).');return}
    const {r}=cur();if(!r)return;
    const {data,error}=await SB.from('doc_audit').select('at,action,actor_name,details').eq('kind','custo').eq('doc_id',r.id).order('at',{ascending:false}).limit(40);
    if(error){toast('Não foi possível carregar o histórico.');return}
    const li=data.map(x=>{
      const d=x.details||{},ms=(d.mudancas||[]).map(m=>`${esc(m.item||'')}: ${esc(CAMPO[m.campo]||m.campo)}${m.campo.startsWith('item_')?'':` ${esc(m.de??'—')} → ${esc(m.para??'—')}`}`);
      return `<li><b>${esc(ACT[x.action]||x.action)}</b> — ${esc(x.actor_name||'—')}<br><small class="muted">${fmt(x.at)}${d.total_para!=null&&d.total_de!==d.total_para?` · total ${brl(d.total_de)} → ${brl(d.total_para)}`:''}</small>${ms.length?`<div class="cst-hl">${ms.slice(0,12).join('<br>')}${d.qtd_mudancas>12?`<br>… e mais ${d.qtd_mudancas-12}`:''}</div>`:''}</li>`;
    }).join('');
    dialog(`<div class="dlg-body"><h2>Histórico do orçamento</h2>${li?`<ul class="ap-hist">${li}</ul>`:'<p class="hint">Sem registros ainda.</p>'}<div class="actions end"><button class="btn" data-act="closeDlg">Fechar</button></div></div>`);
  }
});

/* ---------- lista padrão (gestores) ---------- */
Object.assign(MX.act,{
  cstPadrao(){
    if(!isMgr()||!CLOUD){toast('Só administrador ou gestor, com a nuvem ligada, altera a lista padrão.');return}
    const p=Costs.cfg.padrao||{},tx=(k,def)=>(p[k]||def).map(x=>typeof x==='string'?x:(x.preco!=null?`${x.desc} | ${x.preco}`:x.desc)).join('\n');
    dialog(`<form class="dlg-body cst-dlg" data-submit="cstPadrao"><h2>Lista padrão de custos</h2><p>Itens que entram em um orçamento novo quando o RTS não tem lista de materiais. Uma linha por item. Em mão de obra use <code>DESCRIÇÃO | valor da hora</code>.</p><div class="field"><label for="cp-m">Materiais</label><textarea id="cp-m" name="mat" rows="6" data-keep-case>${esc(tx('mat',C.BASE_MAT))}</textarea></div><div class="field"><label for="cp-h">Mão de obra (H/H)</label><textarea id="cp-h" name="mo" rows="6" data-keep-case>${esc(tx('mo',C.HH.map(([d,v])=>({desc:d,preco:v}))))}</textarea></div><div class="field"><label for="cp-o">Despesas complementares</label><textarea id="cp-o" name="out" rows="3" data-keep-case>${esc(tx('out',C.OUT))}</textarea></div><div class="field"><label for="cp-s">Serviços externos</label><textarea id="cp-s" name="srv" rows="3" data-keep-case>${esc(tx('srv',C.SRV))}</textarea></div><div class="field"><label for="cp-a">Quem acessa os custos</label><select id="cp-a" name="acesso"><option value="membros" ${Costs.cfg.acesso!=='gestores'?'selected':''}>Todos os usuários ativos</option><option value="gestores" ${Costs.cfg.acesso==='gestores'?'selected':''}>Só administrador e gestores</option></select></div><div class="actions end"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit">Salvar</button></div></form>`);
  }
});
Object.assign(MX.sub,{
  async cstPadrao(f){
    const lines=n=>f.elements[n].value.split('\n').map(x=>x.trim()).filter(Boolean);
    const padrao={mat:lines('mat').map(d=>({desc:d})),out:lines('out').map(d=>({desc:d})),srv:lines('srv').map(d=>({desc:d})),
      mo:lines('mo').map(l=>{const [d,v]=l.split('|').map(x=>x.trim());const n=C.parseNum(v);return{desc:d,preco:n}})};
    const v={acesso:f.elements.acesso.value,padrao};
    const q=await SB.from('app_settings').upsert({key:'custos_config',value:v,updated_by:S.user.id},{onConflict:'key'});
    if(q.error){toast(cloudErrMsg(q.error));return}
    Costs.cfg={acesso:v.acesso,padrao};Costs.cfgAt=Date.now();try{localStorage.setItem('minc_custos_cfg',JSON.stringify(Costs.cfg))}catch{}
    closeDialog(f.closest('dialog'));toast('Lista padrão salva. Vale para os próximos orçamentos novos.');
  }
});

/* ============================== PDF (mesma moldura do RTS) ============================== */
const fileBase=r=>`Custos RTS ${r.numero||''} - ${r.produto||''}`.replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,110);
async function buildCostPdf(r,c){
  await pdfLib();
  const F=(window.MINC_CATALOGO&&MINC_CATALOGO.RTS_FORM)||{titulo:'RELATÓRIO TÉCNICO DE SERVIÇO',tipo:'REGISTRO',codigo:'',rev:'00',data:''};
  const {jsPDF}=window.jspdf,logo=await logoForPdf(),pt=pdfTxt;
  const M=15,W=180,TOP=40,BOT=297-27;
  const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
  doc.setProperties({title:pt(`Previsão orçamentária - RTS ${r.numero||''}`),subject:pt(r.produto||''),author:pt(S.user?.name||''),creator:'MINC ServiceHub'});
  let y=TOP;const lineH=s=>s*0.3528*1.32;
  const ensure=h=>{if(y+h>BOT){doc.addPage();y=TOP}};
  const heading=txt=>{ensure(lineH(13)+16);y+=2;doc.setFont('helvetica','bold');doc.setFontSize(13);doc.setTextColor(0);doc.text(pt(txt),M,y+lineH(13)*.78);y+=lineH(13);doc.setDrawColor(0);doc.setLineWidth(.5);doc.line(M,y+.6,M+W,y+.6);y+=3.2};
  const para=(txt,size=10)=>{doc.setFont('helvetica','normal');doc.setFontSize(size);doc.setTextColor(0);for(const ln of doc.splitTextToSize(pt(txt),W)){ensure(lineH(size));doc.text(ln,M,y+lineH(size)*.78);y+=lineH(size)}y+=1.5};
  const base={theme:'grid',rowPageBreak:'avoid',styles:{font:'helvetica',fontSize:9,cellPadding:2,lineColor:[0,0,0],lineWidth:.2,textColor:[0,0,0],valign:'middle'},headStyles:{fillColor:[236,236,236],textColor:[0,0,0],fontStyle:'bold',lineWidth:.2,lineColor:[0,0,0]},margin:{left:M,right:M,top:TOP,bottom:27}};
  const tbl=o=>{doc.autoTable({...base,...o,startY:y});y=doc.lastAutoTable.finalY+4};
  const hd=t=>({content:pt(t),styles:{fillColor:[236,236,236],fontStyle:'bold'}});
  /* ---- identificação (campos vazios não aparecem) ---- */
  const p=dep(r);
  const campos=[['CLIENTE',r.cliente],['Nº DO RTS',r.numero],['EMISSÃO DO RTS',dBR(r.emissao)],['PRODUTO / VÁLVULA',r.produto],['CÓDIGO',r.codigoProduto],['QUANTIDADE',r.quantidade],
    ['PEDIDO',p&&p.pedido],['ORDEM',p&&p.ordem],['PROCESSO (D.E.)',p&&p.process],['SOLICITANTE',c.data.solicitante],['ELABORADO POR',(r.elaboradoPor||'').toUpperCase()],['PRAZO (DIAS ÚTEIS)',c.data.prazoDias||r.prazoDias]].filter(([,v])=>!emp(v));
  heading('Identificação');
  const body=[];
  for(let i=0;i<campos.length;i+=3){
    const g=campos.slice(i,i+3);
    body.push(g.map(([l],k)=>({...hd(l),colSpan:g.length===1?3:g.length===2?(k===0?2:1):1})));
    body.push(g.map(([,v],k)=>({content:pt(String(v)),colSpan:g.length===1?3:g.length===2?(k===0?2:1):1})));
  }
  tbl({body,columnStyles:{0:{cellWidth:70},1:{cellWidth:60},2:{cellWidth:50}}});
  if(!emp(r.objetivo)){heading('Descrição do serviço');para(r.objetivo)}
  if(!emp(c.data.comentarios)){heading('Comentários');para(c.data.comentarios)}
  /* ---- seções ---- */
  const origemTxt=it=>it.preco==null?'':it.preco_tipo==='referencia'?'Estimado'+(it.ref&&it.ref.consultadoEm?' '+dBR(it.ref.consultadoEm):''):'Informado';
  const pendCell=t=>({content:t,styles:{fontStyle:'italic',textColor:[90,90,90],halign:'right'}});
  const rsAll=C.resumo(c.data.itens);
  const secs=C.SECS.filter(s=>c.data.itens.some(i=>i.sec===s.k&&C.linha(i).estado!=='vazio'));
  for(const s of secs){
    const its=c.data.itens.filter(i=>i.sec===s.k&&C.linha(i).estado!=='vazio'),rs=C.resumo(its);
    heading(s.doc);
    let n=0;const rows=[];
    if(s.k==='mo'){
      for(const it of its){const l=C.linha(it);n++;rows.push([{content:String(n),styles:{halign:'center'}},pt(it.desc||'-'),{content:inNum(it.qtd)||'-',styles:{halign:'center'}},{content:inNum(it.horas)||'-',styles:{halign:'center'}},l.estado==='ok'||it.preco!=null?{content:brl(it.preco),styles:{halign:'right'}}:pendCell('PENDENTE'),l.estado==='ok'?{content:brl(l.total),styles:{halign:'right'}}:pendCell('PENDENTE'),pt(it.obs||'')])}
      tbl({head:[[{content:'ITEM',styles:{halign:'center'}},'DESCRIÇÃO',{content:'QUANT. MO',styles:{halign:'center'}},{content:'H/H',styles:{halign:'center'}},{content:'R$ / H',styles:{halign:'right'}},{content:'CUSTO TOTAL',styles:{halign:'right'}},'OBS']],body:rows,columnStyles:{0:{cellWidth:14},2:{cellWidth:18},3:{cellWidth:14},4:{cellWidth:22},5:{cellWidth:28},6:{cellWidth:24}}});
    }else{
      const grp=s.k==='mat';let lastCat=null;
      for(const it of its){
        const l=C.linha(it);
        if(grp&&it.cat&&it.cat!==lastCat){lastCat=it.cat;rows.push([{content:pt(it.cat.toUpperCase()),colSpan:8,styles:{fillColor:[246,246,246],fontStyle:'bold',fontSize:8}}])}
        n++;
        const desc=pt((it.desc||'-')+(it.obs?'\n'+it.obs:''));
        rows.push([{content:String(n),styles:{halign:'center'}},pt(it.codigo||''),{content:desc},{content:pt(it.un||''),styles:{halign:'center'}},{content:it.qtd==null?'-':inNum(it.qtd),styles:{halign:'center'}},it.preco!=null?{content:brlP(it.preco),styles:{halign:'right'}}:pendCell('PENDENTE'),{content:origemTxt(it),styles:{halign:'center',fontSize:7.5}},l.estado==='ok'?{content:brl(l.total),styles:{halign:'right'}}:pendCell('PENDENTE')]);
      }
      tbl({head:[[{content:'ITEM',styles:{halign:'center'}},'CÓD.','DESCRIÇÃO',{content:'UN',styles:{halign:'center'}},{content:'QTD',styles:{halign:'center'}},{content:'CUSTO UNIT.',styles:{halign:'right'}},{content:'ORIGEM',styles:{halign:'center'}},{content:'CUSTO TOTAL',styles:{halign:'right'}}]],body:rows,columnStyles:{0:{cellWidth:14},1:{cellWidth:20},3:{cellWidth:10},4:{cellWidth:14},5:{cellWidth:24},6:{cellWidth:19},7:{cellWidth:27}}});
    }
    ensure(8);
    doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(0);
    doc.text(pt(`SUBTOTAL ${s.doc}${rs.pendentes?` (parcial: ${rs.pendentes} ${rs.pendentes===1?'item pendente':'itens pendentes'})`:''}`),M+W-30,y+3,{align:'right'});doc.text(pt(brl(rs.total)),M+W,y+3,{align:'right'});y+=8;
  }
  if(!secs.length){heading('Orçamento');para('Nenhum item orçado ainda.')}
  /* ---- resumo financeiro ---- */
  const pend0=c.data.itens.filter(i=>C.linha(i).estado==='pendente');
  ensure(34+(secs.length+1)*8+Math.min(pend0.length,8)*5);   // o resumo inteiro fica junto, sem total isolado
  heading('Resumo financeiro');
  const res=secs.map(s=>[pt('SUBTOTAL '+s.doc),{content:pt(brl(rsAll.subtotais[s.k])),styles:{halign:'right'}}]);
  res.push([{content:pt(rsAll.parcial?'TOTAL PARCIAL ESTIMADO (itens pendentes ficam de fora)':'TOTAL GERAL ESTIMADO'),styles:{fontStyle:'bold',fillColor:[236,236,236]}},{content:pt(brl(rsAll.total)),styles:{fontStyle:'bold',halign:'right',fillColor:[236,236,236]}}]);
  tbl({body:res,columnStyles:{1:{cellWidth:45}}});
  const pend=c.data.itens.filter(i=>C.linha(i).estado==='pendente');
  para(`Itens orçados: ${rsAll.itens}  |  com preço estimado (referência Nomus): ${rsAll.estimados}  |  com preço informado: ${rsAll.informados}  |  pendentes: ${rsAll.pendentes}`,9);
  if(pend.length){doc.setFont('helvetica','bold');para('Itens pendentes de preço ou quantidade:',9);for(const it of pend.slice(0,25))para('- '+(it.desc||'-')+' (falta '+C.linha(it).falta.join(' e ')+')',8.5);if(pend.length>25)para(`… e mais ${pend.length-25}.`,8.5)}
  para('Estimado: preço de referência calculado pela MINC a partir do histórico de compras (média ponderada pela quantidade comprada). Informado: preço digitado pela equipe. Valores sem preço não entram no total.',7.5);
  /* ---- responsáveis ---- */
  const resp=[['RESPONSÁVEL PELA ENGENHARIA',c.data.respEngenharia],['RESPONSÁVEL PELO PROJETO',c.data.respProjeto]].filter(([,v])=>!emp(v));
  if(resp.length){ensure(24);y+=2;tbl({head:[resp.map(([l])=>pt(l))],body:[resp.map(([,v])=>({content:pt(String(v).toUpperCase()),styles:{halign:'center',minCellHeight:12}}))],headStyles:{...base.headStyles,halign:'center'}})}
  const n=doc.getNumberOfPages(),hoje=new Date().toLocaleDateString('pt-BR');
  for(let i=1;i<=n;i++){doc.setPage(i);RtsPdfFrame(doc,i,n,{logo,F,titulo:'PREVISÃO ORÇAMENTÁRIA',M,W,right:[['Tipo:',F.tipo],['RTS nº:',r.numero||'-'],['Ref.:',F.codigo],['Data:',hoje]]})}
  return{bytes:doc.output('arraybuffer'),pages:n,fileName:fileBase(r)+'.pdf'};
}
window.buildCostPdf=buildCostPdf;
Object.assign(MX.act,{
  async cstPdfOpen(el){
    const {r,c}=cur();if(!r)return;
    const win=window.open('','_blank');if(win)win.opener=null;
    const b=el.closest?.('button')||el;b.setAttribute?.('aria-busy','true');
    try{const o=await buildCostPdf(r,c),u=URL.createObjectURL(new Blob([o.bytes],{type:'application/pdf'}));if(win&&!win.closed)win.location.href=u;else window.open(u,'_blank')}
    catch(e){if(win)win.close();console.error(e);toast('Não foi possível gerar o PDF.')}
    finally{b.removeAttribute?.('aria-busy')}
  },
  async cstPdf(){
    const {r,c}=cur();if(!r)return;
    try{const o=await buildCostPdf(r,c);saveBytes(o.bytes,o.fileName);toast('PDF gerado.')}catch(e){console.error(e);toast('Não foi possível gerar o PDF.')}
  },
  cstXlsx(){
    const {r,c}=cur();if(!r)return;
    try{const wb=buildCostXlsx(r,c);XLSX.writeFile(wb,fileBase(r)+'.xlsx');toast('Excel gerado.')}catch(e){console.error(e);toast('Não foi possível gerar o Excel.')}
  }
});

/* ============================== Excel (números de verdade, totais com fórmula) ============================== */
function buildCostXlsx(r,c){
  const wb=XLSX.utils.book_new(),aoa=[],hdr=[];
  const p=dep(r);
  aoa.push(['PREVISÃO ORÇAMENTÁRIA']);
  for(const [l,v] of [['Nº do RTS',r.numero],['Cliente',r.cliente],['Produto / válvula',r.produto],['Código',r.codigoProduto],['Quantidade',r.quantidade],['Pedido',p&&p.pedido],['Ordem',p&&p.ordem],['Processo (D.E.)',p&&p.process],['Solicitante',c.data.solicitante],['Elaborado por',r.elaboradoPor],['Prazo (dias úteis)',c.data.prazoDias||r.prazoDias],['Responsável pela engenharia',c.data.respEngenharia],['Responsável pelo projeto',c.data.respProjeto],['Comentários',c.data.comentarios]])if(!emp(v))aoa.push([l,String(v)]);
  aoa.push([]);
  const ws={},cells={};let row=aoa.length;   // linhas já escritas (0-based)
  const secTot=[];
  const addRow=cols=>{aoa.push(cols);return aoa.length};   // devolve nº da linha (1-based)
  for(const s of C.SECS){
    const its=c.data.itens.filter(i=>i.sec===s.k&&C.linha(i).estado!=='vazio');if(!its.length)continue;
    addRow([s.doc]);
    addRow(s.k==='mo'?['Item','Descrição','Un.','Pessoas','Horas','R$/h','Custo total (R$)','Origem do preço','Observação']:['Item','Código','Descrição','Un.','Quantidade','Preço unitário (R$)','Custo total (R$)','Origem do preço','Referência Nomus (R$)','Última compra','Compras na média','Observação']);
    const first=aoa.length+1;let n=0;
    for(const it of its){
      n++;const l=C.linha(it),rn=aoa.length+1;
      const og=it.preco==null?'':it.preco_tipo==='referencia'?'Estimado (referência Nomus)':'Informado';
      if(s.k==='mo')aoa.push([n,it.desc,it.un,it.qtd,it.horas,it.preco,{f:`IF(AND(ISNUMBER(D${rn}),ISNUMBER(E${rn}),ISNUMBER(F${rn})),D${rn}*E${rn}*F${rn},"PENDENTE")`,v:l.total==null?'PENDENTE':l.total},og,it.obs||'']);
      else aoa.push([n,it.codigo||'',it.desc,it.un,it.qtd,it.preco,{f:`IF(AND(ISNUMBER(E${rn}),ISNUMBER(F${rn})),ROUND(E${rn}*F${rn},2),"PENDENTE")`,v:l.total==null?'PENDENTE':l.total},og,it.ref&&it.ref.valor!=null?it.ref.valor:'',it.ref&&it.ref.ultimaCompra?dBR(it.ref.ultimaCompra):'',it.ref&&it.ref.n?it.ref.n:'',it.obs||'']);
    }
    const last=aoa.length,rs=C.resumo(its),tr=aoa.length+1;
    aoa.push(['','','','','','Subtotal',{f:`SUM(G${first}:G${last})`,v:rs.total}]);
    secTot.push({s,ref:`G${tr}`,rs});aoa.push([]);
  }
  const rsAll=C.resumo(c.data.itens);
  aoa.push(['RESUMO FINANCEIRO']);
  for(const t of secTot)aoa.push([t.s.doc,'','','','','',{f:t.ref,v:t.rs.total}]);
  const tt=aoa.length+1;
  aoa.push([rsAll.parcial?'TOTAL PARCIAL ESTIMADO (itens pendentes ficam de fora)':'TOTAL GERAL ESTIMADO','','','','','',{f:secTot.length?secTot.map(t=>t.ref).join('+'):'0',v:rsAll.total}]);
  aoa.push(['Itens orçados',rsAll.itens]);aoa.push(['Com preço estimado (referência Nomus)',rsAll.estimados]);aoa.push(['Com preço informado',rsAll.informados]);aoa.push(['Pendentes',rsAll.pendentes]);
  const sheet=XLSX.utils.aoa_to_sheet(aoa.map(a=>a.map(v=>v&&typeof v==='object'&&'f' in v?'':v)));
  /* fórmulas: aoa_to_sheet não escreve objeto {f,v}; aplica célula a célula */
  aoa.forEach((a,ri)=>a.forEach((v,ci)=>{if(v&&typeof v==='object'&&'f' in v){const ref=XLSX.utils.encode_cell({r:ri,c:ci});sheet[ref]={t:typeof v.v==='number'?'n':'s',v:v.v,f:v.f};if(typeof v.v==='number')sheet[ref].z='#,##0.00'}}));
  const rng=XLSX.utils.decode_range(sheet['!ref']||'A1:A1');rng.e.r=Math.max(rng.e.r,aoa.length-1);rng.e.c=Math.max(rng.e.c,11);sheet['!ref']=XLSX.utils.encode_range(rng);
  sheet['!cols']=[{wch:8},{wch:18},{wch:48},{wch:8},{wch:12},{wch:18},{wch:18},{wch:26},{wch:18},{wch:14},{wch:12},{wch:34}];
  XLSX.utils.book_append_sheet(wb,sheet,'Custos');
  return wb;
}
window.buildCostXlsx=buildCostXlsx;
})();
