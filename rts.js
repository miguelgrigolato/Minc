/* MINC · Peritagem — Módulo RTS (Relatório Técnico de Serviço)  (v5.11.0)
   Independente das peritagens: o RTS nasce na proposta, muitas vezes antes de ver a válvula.
   - Lista de RTS (aba "RTS" no topo), editor em seções e PDF no layout R-MINC-060-RTS-PT (capa, sumário, rodapé).
   - Escopo por POS: o usuário escolhe a providência e as atividades padrão entram prontas (catalogo.js > RTS_BIBLIOTECA).
   - Pode partir de um modelo de válvula do banco de projetos (as POS entram prontas) ou ser montado do zero.
   - Guardado neste aparelho (IndexedDB) e sincronizado com a tabela rts_documents quando há nuvem (mesma lógica de revisão
     das peritagens: se outra pessoa gravou antes, aparece o aviso de conflito).
   Carregado ANTES do app.js: tudo que usa funções do app roda só quando chamado. */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};
MX.sync=MX.sync||[];MX.boot=MX.boot||[];
const CAT=()=>window.MINC_CATALOGO||{};
const FORM=()=>CAT().RTS_FORM||{titulo:'RELATÓRIO TÉCNICO DE SERVIÇO',tipo:'REGISTRO',codigo:'',rev:'00',data:'',endereco:'',contato:''};
const PROVS=()=>CAT().RTS_PROVIDENCIAS||['Recuperar','Reutilizar','Substituir','Adequar','Fabricar'];
const BIB=()=>CAT().RTS_BIBLIOTECA||{};
const TXT=()=>CAT().RTS_TEXTOS||{};
const RSTATUS=['Rascunho','Em revisão','Emitido'];
const rCls={'Rascunho':'st-gray','Em revisão':'st-amber','Emitido':'st-green'};
const PCOM_MAT=['Substituir','Fabricar'];   // providências que entram na lista de materiais
const missing=e=>!!e&&(e.code==='PGRST205'||e.code==='42P01'||/relation .* does not exist|schema cache/i.test(e.message||''));
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const nowHM=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
const dedupe=a=>[...new Set(a)];

/* ============================== Dados ============================== */
let RTS=[];
window.RTSLIST=()=>RTS;
const curR=()=>RTS.find(r=>r.id===S.rtsId&&!r.deletedAt);
const act=t=>({id:uid('RA'),t});
const verbo=p=>String(p||'').toUpperCase();

function normRts(r){
  r.status=RSTATUS.includes(r.status)?r.status:'Rascunho';
  for(const k of ['numero','cliente','produto','codigoProduto','quantidade','emissao','hora','elaboradoPor','aprovadoPor','dataDoc','statusDoc','prazoDias','modeloId','modeloNome','objetivo','notaLocal','validade','garantia','notaEmbalagem'])if(r[k]==null)r[k]='';
  r.geral=Object.assign({titulo:'CONJUNTO GERAL –',sub:'',etapas:[]},r.geral);r.geral.etapas=Array.isArray(r.geral.etapas)?r.geral.etapas:[];
  r.montagem=Object.assign({titulo:CAT().RTS_MONTAGEM_TITULO||'MONTAGEM DO CONJUNTO GERAL – TESTES – PINTURA',etapas:[]},r.montagem);r.montagem.etapas=Array.isArray(r.montagem.etapas)?r.montagem.etapas:[];
  r.pos=(Array.isArray(r.pos)?r.pos:[]).map(p=>Object.assign({id:uid('RP'),pos:'',nome:'',provs:[],titulo:'',atividades:[],nota:''},p,{provs:Array.isArray(p.provs)?p.provs:[],atividades:Array.isArray(p.atividades)?p.atividades:[]}));
  r.materiais=Array.isArray(r.materiais)?r.materiais:[];
  r.obs=Object.assign({identificacao:'',pintura:'',embalagem:'',devolucao:'',testes:''},r.obs);
  return r;
}
function newRts(o={}){
  const T=TXT(),now=new Date().toISOString();
  const r=normRts({id:uid('RTS'),createdAt:now,updatedAt:now,createdBy:S.user?.name||'',updatedBy:S.user?.name||'',
    status:'Rascunho',emissao:today(),hora:nowHM(),elaboradoPor:S.user?.name||'',dataDoc:'',statusDoc:(CAT().RTS_STATUS_DOC||[])[0]||'',quantidade:'01',
    notaLocal:T.notaLocal||'',notaEmbalagem:T.notaEmbalagem||'',validade:T.validade||'',garantia:T.garantia||'',
    obs:{identificacao:T.identificacao||'',pintura:T.pintura||'',embalagem:T.embalagem||'',devolucao:T.devolucao||'',testes:T.testes||''},
    geral:{titulo:'CONJUNTO GERAL –',sub:'',etapas:(CAT().RTS_GERAL||[]).map(act)},
    montagem:{titulo:CAT().RTS_MONTAGEM_TITULO||'MONTAGEM DO CONJUNTO GERAL – TESTES – PINTURA',etapas:(CAT().RTS_MONTAGEM||[]).map(act)},
    ...o});
  if(emp(r.objetivo))r.objetivo=objetivoPadrao(r);
  return r;
}
const objetivoPadrao=r=>`Efetuar serviço de recuperação em ${emp(r.produto)?'(produto)':r.produto}, conforme escopo detalhado neste relatório.`;
function loadModelPos(r,m){
  r.modeloId=m.id;r.modeloNome=m.name;
  if(emp(r.produto))r.produto=m.name;
  if(emp(r.geral.sub))r.geral.sub=m.name;
  const have=new Set(r.pos.map(p=>String(p.pos).trim().toUpperCase()+'|'+String(p.nome).trim().toUpperCase()));
  let add=0;
  for(const c of m.components||[]){
    const k=String(c.pos||'').trim().toUpperCase()+'|'+String(c.name||'').trim().toUpperCase();
    if(have.has(k))continue;
    r.pos.push({id:uid('RP'),pos:c.pos||'',nome:String(c.name||'').toUpperCase(),qtd:String(c.qtd||'1'),unid:c.unid||'',provs:[],titulo:'',atividades:[],nota:''});add++;
  }
  return add;
}

/* ---- persistência local ---- */
const RtsStore={
  async all(){try{return(await Store.all('rts')).map(normRts)}catch{return[]}},
  put(r){return Store.put('rts',r).catch(e=>console.error('rts local',e))},
  del(id){return Store.del('rts',id).catch(()=>{})}
};
const toRowR=r=>{const data={};for(const k of Object.keys(r))if(!k.startsWith('_'))data[k]=r[k];
  return{id:r.id,numero:r.numero||null,cliente:r.cliente||null,produto:r.produto||null,status:r.status,deleted_at:r.deletedAt||null,data}};
const fromRowR=row=>normRts({...(row.data||{}),id:row.id,numero:row.numero||'',cliente:row.cliente||'',produto:row.produto||'',status:row.status,updatedAt:row.updated_at,_rev:row.rev,_dirty:false,_conflict:null,...(row.deleted_at?{deletedAt:row.deleted_at}:{})});

/* salvamento com debounce */
const RtsSave={
  t:null,ids:new Set(),
  queue(id){this.ids.add(id);clearTimeout(this.t);this.t=setTimeout(()=>this.flush(),500)},
  async flush(){
    clearTimeout(this.t);const ids=[...this.ids];this.ids.clear();
    for(const id of ids){const r=RTS.find(x=>x.id===id);if(r)await RtsStore.put(r)}
  }
};
window.RtsSave=RtsSave;
function touchR(r=curR()){
  if(!r)return;r._dirty=true;r.updatedAt=new Date().toISOString();r.updatedBy=S.user?.name||r.updatedBy;
  RtsSave.queue(r.id);if(window.Sync)Sync.kick(2500);
  const st=document.getElementById('rts-state');if(st)st.innerHTML=stateHTML(r);
}
const stateHTML=r=>r._conflict?'<span class="badge st-amber">Conflito</span>':!CLOUD?'<span class="muted">Salvo neste aparelho</span>':r._dirty||r._rev==null?'<span class="muted">Salvo no aparelho · envio pendente</span>':'<span class="muted">Sincronizado</span>';
window.addEventListener('pagehide',()=>{RtsSave.flush()});
document.addEventListener('visibilitychange',()=>{if(document.hidden)RtsSave.flush()});

/* ---- nuvem ---- */
const Cloud={
  missing:false,
  async push(){
    if(!CLOUD||this.missing)return false;let did=false;
    for(const r of RTS.filter(x=>x._dirty&&!x._conflict)){
      const snap=r.updatedAt,row=toRowR(r);let out=null;
      if(r._rev==null){
        const q=await SB.from('rts_documents').insert(row).select('rev').single();
        if(!q.error)out=q.data;
        else if(missing(q.error)){this.missing=true;return did}
        else if(q.error.code==='23505'){const g=await SB.from('rts_documents').select('rev').eq('id',r.id).single();if(g.error)throw g.error;r._rev=g.data.rev}
        else throw q.error;
      }
      if(!out){
        const q=await SB.from('rts_documents').update(row).eq('id',r.id).eq('rev',r._rev).select('rev');
        if(q.error)throw q.error;
        if(!q.data.length){const g=await SB.from('rts_documents').select('*').eq('id',r.id).single();if(g.error)throw g.error;r._conflict=g.data;await RtsStore.put(r);did=true;continue}
        out=q.data[0];
      }
      r._rev=out.rev;if(r.updatedAt===snap)r._dirty=false;await RtsStore.put(r);did=true;
    }
    return did;
  },
  async pull(){
    if(!CLOUD||this.missing)return false;
    let since=localStorage.getItem('minc_rts_lastpull')||'1970-01-01T00:00:00Z',max=since,changed=false;
    for(let guard=0;guard<50;guard++){
      const {data,error}=await SB.from('rts_documents').select('*').gte('updated_at',since).order('updated_at',{ascending:true}).limit(200);
      if(error){if(missing(error)){this.missing=true;return changed}throw error}
      for(const row of data){changed=(await this.apply(row))||changed;if(row.updated_at>max)max=row.updated_at}
      if(data.length<200||max===since)break;since=max;
    }
    localStorage.setItem('minc_rts_lastpull',max);return changed;
  },
  async apply(row){
    const loc=RTS.find(x=>x.id===row.id);
    if(!loc){const n=fromRowR(row);RTS.unshift(n);await RtsStore.put(n);return true}
    if(row.rev<=(loc._rev??0))return false;
    if(loc._dirty){loc._conflict=row;await RtsStore.put(loc);return true}
    const n=fromRowR(row);Object.keys(loc).forEach(k=>delete loc[k]);Object.assign(loc,n);await RtsStore.put(loc);return true;
  }
};
MX.sync.push(async()=>{if(!S.user)return false;const a=await Cloud.push(),b=await Cloud.pull();return a||b});
MX.pending=()=>RTS.filter(r=>r._dirty).length;
MX.boot.push(async()=>{RTS=(await RtsStore.all()).filter(r=>!r.deletedAt||r._dirty);});
MX.refresh=typing=>{
  if(S.screen==='rts'){const q=document.getElementById('rts-q');if(q&&document.activeElement===q)document.getElementById('rts-rows').innerHTML=rowsRts();else renderMain()}
  else if(S.screen==='rtsEdit'&&!typing)renderMain();
};

/* ============================== Lista ============================== */
const matchQ=(r,q)=>{q=String(q||'').trim().toLowerCase();return!q||[r.numero,r.cliente,r.produto,r.codigoProduto].some(v=>String(v||'').toLowerCase().includes(q))};
function filteredR(){return RTS.filter(r=>!r.deletedAt&&(S.rtsF==='Todos'||!S.rtsF||r.status===S.rtsF)&&matchQ(r,S.rtsQ)).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))}
function rowsRts(){
  const l=filteredR();
  if(!l.length)return `<div class="empty"><h2>${RTS.some(r=>!r.deletedAt)?'Nada encontrado':'Nenhum RTS ainda'}</h2><p>${RTS.some(r=>!r.deletedAt)?'Ajuste a busca ou o filtro.':'Crie o primeiro Relatório Técnico de Serviço.'}</p></div>`;
  return l.map(r=>`<button class="rts-row" data-act="rtsOpen" data-id="${esc(r.id)}"><div class="rts-r1"><b>${esc(r.numero)||'Sem nº'}</b><span class="badge ${rCls[r.status]||'st-gray'}">${esc(r.status)}</span>${r._conflict?'<span class="badge st-amber">Conflito</span>':''}</div><div class="rts-r2">${esc(r.produto)||'Sem produto'}</div><div class="rts-r3">${esc(r.cliente)||'—'} · atualizado em ${fmt(r.updatedAt)}${r._dirty?' · envio pendente':''}</div></button>`).join('');
}
MX.views.rts=function(){
  const all=RTS.filter(r=>!r.deletedAt);
  const note=CLOUD&&Cloud.missing?'<p class="errbox" style="margin-bottom:12px">A tabela de RTS ainda não existe na nuvem; por enquanto os RTS ficam só neste aparelho. Peça ao responsável técnico para aplicar a migração 20261013_modelos_valvula_e_rts.sql.</p>':'';
  return `<div class="rts-home"><div class="list-h"><div><h1>Relatórios Técnicos de Serviço</h1><small>${plural(all.length,'cadastrado','cadastrados')}</small></div><button class="btn primary" data-act="rtsNew">${ic('plus')}Novo RTS</button></div>${note}<div class="search">${ic('search')}<input type="search" id="rts-q" placeholder="Buscar proposta, cliente, produto…" aria-label="Buscar RTS" data-keep-case data-inp="rtsQ" value="${esc(S.rtsQ||'')}"></div><div class="chips fl" role="group" aria-label="Filtrar por status">${['Todos',...RSTATUS].map(f=>`<button class="chip ${(S.rtsF||'Todos')===f?'on':''}" data-act="rtsFilter" data-v="${f}" aria-pressed="${(S.rtsF||'Todos')===f}" data-fk="rf-${f}">${f}</button>`).join('')}</div><div id="rts-rows" class="rts-rows">${rowsRts()}</div></div>`;
};

/* ============================== Editor ============================== */
const fx=(label,k,v,o={})=>`<div class="field ${o.cls||''}"><label for="rf-${k}">${label}</label><input id="rf-${k}" ${o.type?`type="${o.type}"`:''} value="${esc(v)}" data-inp="rtsF" data-k="${k}" ${o.keep?'data-keep-case':''} ${o.list?`list="${o.list}"`:''} ${o.ph?`placeholder="${esc(o.ph)}"`:''} autocomplete="off"></div>`;
const ta=(label,k,v,rows=3)=>`<div class="field"><label for="rf-${k}">${label}</label><textarea id="rf-${k}" rows="${rows}" class="rts-ta" data-inp="rtsF" data-k="${k}" data-keep-case>${esc(v)}</textarea></div>`;
const getK=(r,k)=>k.split('.').reduce((o,x)=>o?.[x],r);
const setK=(r,k,v)=>{const p=k.split('.'),l=p.pop();const o=p.reduce((a,x)=>a[x],r);o[l]=v};

/* numeração contínua dos itens do escopo (como no RTS em Word: 1…N atravessa todas as seções) */
function numbering(r){
  const m=new Map();let n=0;
  r.geral.etapas.forEach(a=>m.set(a.id,++n));
  r.pos.forEach(p=>p.atividades.forEach(a=>m.set(a.id,++n)));
  r.montagem.etapas.forEach(a=>m.set(a.id,++n));
  return m;
}
const posHeading=p=>{
  if(!emp(p.titulo))return p.titulo;
  const nome=emp(p.nome)?'(sem nome)':p.nome,base=emp(p.pos)?nome:`POS. ${p.pos} - ${nome}`;
  return (base+(p.provs.length?' – '+p.provs.map(verbo).join(' – '):'')+'.').toUpperCase();
};
const actList=(r,key)=>key==='geral'?r.geral.etapas:key==='mont'?r.montagem.etapas:(r.pos.find(p=>p.id===key)||{}).atividades;

function actRows(r,key,nums){
  const l=actList(r,key)||[];
  return l.map((a,i)=>`<div class="rts-act"><span class="rts-n">${nums.get(a.id)||''}</span><textarea class="rts-ta" rows="1" aria-label="Atividade" data-inp="rtsAct" data-list="${esc(key)}" data-id="${esc(a.id)}" data-keep-case>${esc(a.t)}</textarea><div class="rts-mv"><button class="iconb" data-act="rtsActMv" data-list="${esc(key)}" data-id="${esc(a.id)}" data-dir="-1" aria-label="Subir">${ic('up')}</button><button class="iconb" data-act="rtsActMv" data-list="${esc(key)}" data-id="${esc(a.id)}" data-dir="1" aria-label="Descer">${ic('chev')}</button><button class="iconb" data-act="rtsActRm" data-list="${esc(key)}" data-id="${esc(a.id)}" aria-label="Remover atividade">${ic('trash')}</button></div></div>`).join('')||'<p class="hint">Nenhuma atividade nesta seção.</p>';
}
function libOptions(r,p){
  const have=new Set(p.atividades.map(a=>a.t));
  return dedupe(p.provs.flatMap(v=>BIB()[v]||[])).filter(t=>!have.has(t));
}
function posCard(r,p,i,nums){
  const lib=libOptions(r,p);
  return `<article class="rts-pos"><div class="rts-ph"><div class="field rts-pos-no"><label for="pp-${p.id}">POS.</label><input id="pp-${p.id}" value="${esc(p.pos)}" data-inp="rtsPos" data-id="${esc(p.id)}" data-k="pos" autocomplete="off"></div><div class="field rts-pos-nm"><label for="pn-${p.id}">Componente</label><input id="pn-${p.id}" value="${esc(p.nome)}" data-inp="rtsPos" data-id="${esc(p.id)}" data-k="nome" autocomplete="off"></div><div class="rts-mv"><button class="iconb" data-act="rtsPosMv" data-id="${esc(p.id)}" data-dir="-1" aria-label="Subir POS">${ic('up')}</button><button class="iconb" data-act="rtsPosMv" data-id="${esc(p.id)}" data-dir="1" aria-label="Descer POS">${ic('chev')}</button><button class="iconb" data-act="rtsPosRm" data-id="${esc(p.id)}" aria-label="Remover POS">${ic('trash')}</button></div></div>
<div class="chips fl rts-provs" role="group" aria-label="Providência">${PROVS().map(v=>`<button class="chip ${p.provs.includes(v)?'on':''}" data-act="rtsProv" data-id="${esc(p.id)}" data-v="${v}" aria-pressed="${p.provs.includes(v)}">${v}</button>`).join('')}</div>
<div class="rts-title" data-prev="${esc(p.id)}">${esc(posHeading(p))}</div>
${actRows(r,p.id,nums)}
<div class="actions rts-addrow">${lib.length?`<select aria-label="Adicionar da biblioteca" data-chg="rtsLib" data-id="${esc(p.id)}"><option value="">+ Da biblioteca de atividades…</option>${lib.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>`:''}<button class="btn" data-act="rtsActAdd" data-list="${esc(p.id)}">${ic('plus')}Atividade</button>${p.provs.length&&p.atividades.length?`<button class="btn ghost" data-act="rtsReload" data-id="${esc(p.id)}">Recarregar padrão</button>`:''}</div>
<details class="rts-more"><summary>Mais opções (título e nota)</summary><div class="field"><label for="pt-${p.id}">Título no documento <span class="muted">(deixe vazio para gerar automático)</span></label><input id="pt-${p.id}" value="${esc(p.titulo)}" data-inp="rtsPos" data-id="${esc(p.id)}" data-k="titulo" autocomplete="off" placeholder="${esc(posHeading({...p,titulo:''}))}"></div><div class="field"><label for="pnota-${p.id}">NOTA <span class="muted">(opcional, aparece depois das atividades)</span></label><textarea id="pnota-${p.id}" rows="2" class="rts-ta" data-inp="rtsPos" data-id="${esc(p.id)}" data-k="nota" data-keep-case>${esc(p.nota)}</textarea></div></details></article>`;
}
function matRows(r){
  return r.materiais.map(m=>`<div class="rts-mat"><input aria-label="Descrição" value="${esc(m.desc)}" data-inp="rtsMat" data-id="${esc(m.id)}" data-k="desc" autocomplete="off"><input aria-label="Unidade" value="${esc(m.unid)}" data-inp="rtsMat" data-id="${esc(m.id)}" data-k="unid" data-keep-case autocomplete="off"><input aria-label="Quantidade" value="${esc(m.qtd)}" data-inp="rtsMat" data-id="${esc(m.id)}" data-k="qtd" inputmode="decimal" data-keep-case autocomplete="off"><button class="iconb" data-act="rtsMatRm" data-id="${esc(m.id)}" aria-label="Remover item">${ic('trash')}</button></div>`).join('')||'<p class="hint">Sem itens. Marque POS como Substituir ou Fabricar e use “Atualizar a partir das POS”.</p>';
}
MX.views.rtsEdit=function(){
  const r=curR();if(!r)return `<div class="empty"><h2>RTS não encontrado</h2><button class="btn primary" data-act="rtsHome">Voltar à lista</button></div>`;
  const nums=numbering(r),models=window.Models?Models.active():[];
  const conflict=r._conflict?`<div class="errbox rts-conf" role="alert"><b>Outra pessoa alterou este RTS antes de você enviar.</b> Escolha qual versão manter.<div class="actions" style="margin-top:8px"><button class="btn" data-act="rtsUseCloud">Usar a versão da nuvem</button><button class="btn primary" data-act="rtsKeepMine">Manter a minha</button></div></div>`:'';
  const dl=`<datalist id="dl-sdoc">${(CAT().RTS_STATUS_DOC||[]).map(s=>`<option value="${esc(s)}">`).join('')}</datalist>`;
  const sug=(CAT().RTS_TESTES_SUGESTOES||[]).filter(t=>!r.montagem.etapas.some(a=>a.t===t));
  return `<div class="rts-edit"><div class="ph"><button class="btn ghost" data-act="rtsHome">${ic('back')}Todos os RTS</button><div class="ph-row"><div><h1>RTS ${esc(r.numero)||'(sem nº)'}</h1><p id="rts-state" class="hint" style="margin:0">${stateHTML(r)}</p></div><div class="actions"><select aria-label="Status do RTS" data-chg="rtsStatus">${RSTATUS.map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select><button class="btn" data-act="rtsPdfOpen">${ic('print')}Visualizar</button><button class="btn primary" data-act="rtsPdf">${ic('download')}Baixar PDF</button></div></div></div>${conflict}${dl}
<div class="panel"><h2>Dados do relatório</h2><div class="grid g4">${fx('Proposta nº','numero',r.numero,{keep:true,ph:'1135-26'})}${fx('Cliente','cliente',r.cliente,{cls:'sp2'})}${fx('Finalidade (status do documento)','statusDoc',r.statusDoc,{list:'dl-sdoc'})}</div><div class="grid g4">${fx('Emissão','emissao',r.emissao,{type:'date'})}${fx('Hora','hora',r.hora,{type:'time'})}${fx('Elaborado por','elaboradoPor',r.elaboradoPor)}${fx('Aprovado por','aprovadoPor',r.aprovadoPor)}</div><div class="grid g4">${fx('Data da aprovação','dataDoc',r.dataDoc,{type:'date'})}${fx('Prazo estimado (dias)','prazoDias',r.prazoDias,{keep:true,ph:'110'})}</div></div>
<div class="panel"><h2>Produto</h2><div class="grid g4">${fx('Código','codigoProduto',r.codigoProduto,{keep:true})}${fx('Produto','produto',r.produto,{cls:'sp2',ph:'Ex.: VÁLVULA BORBOLETA DE DUPLO DISCO/SEDE – DN 2600'})}${fx('Quantidade','quantidade',r.quantidade,{keep:true})}</div>${models.length?`<div class="rts-model"><div class="field"><label for="rts-model">Carregar POS de um projeto</label><select id="rts-model"><option value="">Selecione o modelo…</option>${models.map(m=>`<option value="${esc(m.id)}" ${m.id===r.modeloId?'selected':''}>${esc(m.name)}${m.dn?' — DN '+esc(m.dn):''}</option>`).join('')}</select></div><button class="btn" data-act="rtsLoadModel">${ic('plus')}Carregar POS</button></div><p class="hint">Só adiciona as POS que ainda não estão na lista; nada do que você já escreveu é apagado.</p>`:''}</div>
<div class="panel"><h2>Objetivo</h2>${ta('Texto do objetivo','objetivo',r.objetivo,4)}${ta('Nota do local do serviço','notaLocal',r.notaLocal,2)}</div>
<div class="panel"><h2>Escopo — Conjunto geral</h2><div class="grid g2">${fx('Título da seção','geral.titulo',r.geral.titulo,{keep:true})}${fx('Subtítulo (válvula)','geral.sub',r.geral.sub)}</div>${actRows(r,'geral',nums)}<div class="actions"><button class="btn" data-act="rtsActAdd" data-list="geral">${ic('plus')}Etapa</button></div></div>
<div class="panel"><div class="ph-row"><div><h2>Escopo — Componentes (POS)</h2><p class="hint" style="margin:0">Escolha a providência de cada POS: as atividades padrão entram prontas e você apaga o que não se aplica.</p></div><button class="btn" data-act="rtsPosAdd">${ic('plus')}POS</button></div>${r.pos.length?r.pos.map((p,i)=>posCard(r,p,i,nums)).join(''):'<p class="hint" style="margin-top:12px">Nenhuma POS. Adicione manualmente ou carregue de um projeto (em Produto).</p>'}</div>
<div class="panel"><h2>Escopo — Montagem, testes e pintura</h2>${fx('Título da seção','montagem.titulo',r.montagem.titulo,{keep:true})}${actRows(r,'mont',nums)}<div class="actions rts-addrow">${sug.length?`<select aria-label="Adicionar teste sugerido" data-chg="rtsTeste"><option value="">+ Testes e comissionamento sugeridos…</option>${sug.map(t=>`<option value="${esc(t)}">${esc(t.length>90?t.slice(0,87)+'…':t)}</option>`).join('')}</select>`:''}<button class="btn" data-act="rtsActAdd" data-list="mont">${ic('plus')}Etapa</button></div>${ta('Nota de embalagem','notaEmbalagem',r.notaEmbalagem,3)}</div>
<div class="panel"><div class="ph-row"><div><h2>Anexo 01 — Lista de materiais</h2><p class="hint" style="margin:0">Itens a comprar/fabricar. “Atualizar a partir das POS” inclui as POS com Substituir ou Fabricar que ainda não estão na lista.</p></div><div class="actions"><button class="btn" data-act="rtsMatSync">Atualizar a partir das POS</button><button class="btn" data-act="rtsMatAdd">${ic('plus')}Item</button></div></div><div class="rts-mats"><div class="rts-mh"><span>Descrição</span><span>Unid.</span><span>Qtd.</span><span></span></div>${matRows(r)}</div></div>
<div class="panel"><h2>Observações técnicas, validade e garantia</h2>${ta('(Obs.1) Identificação','obs.identificacao',r.obs.identificacao,3)}${ta('(Obs.2) Pintura','obs.pintura',r.obs.pintura,2)}${ta('(Obs.3) Embalagem','obs.embalagem',r.obs.embalagem,2)}${ta('(Obs.4) Devolução','obs.devolucao',r.obs.devolucao,3)}${ta('(Obs.5) Testes','obs.testes',r.obs.testes,2)}${ta('Validade da proposta','validade',r.validade,2)}${ta('Termo de garantia','garantia',r.garantia,5)}</div>
<div class="actions end rts-foot"><button class="btn danger" data-act="rtsDel">${ic('trash')}Excluir RTS</button><button class="btn" data-act="rtsDup">Duplicar</button><button class="btn primary" data-act="rtsPdf">${ic('download')}Baixar PDF</button></div></div>`;
};

/* ============================== Ações ============================== */
const openR=id=>{S.rtsId=id;S.screen='rtsEdit';S.anim='up';render();scrollTo(0,0)};
const hasProv=(p,v)=>p.provs.includes(v);
function addLibActs(p,prov){
  const have=new Set(p.atividades.map(a=>a.t));
  (BIB()[prov]||[]).forEach(t=>{if(!have.has(t)){p.atividades.push(act(t));have.add(t)}});
}
function syncMats(r){
  let add=0;
  for(const p of r.pos){
    const need=p.provs.some(v=>PCOM_MAT.includes(v));
    if(need&&!r.materiais.some(m=>m.fromPos===p.id)){
      r.materiais.push({id:uid('RM'),fromPos:p.id,desc:String(p.nome||'').toUpperCase(),unid:String(p.unid||'pç').toUpperCase(),qtd:String(p.qtd||'1')});add++;
    }
  }
  return add;
}
const swap=(a,i,j)=>{if(j<0||j>=a.length)return false;[a[i],a[j]]=[a[j],a[i]];return true};
Object.assign(MX.act,{
  rtsHome(){
    if(S.screen==='rts'){scrollTo({top:0,behavior:RM()?'auto':'smooth'});return}
    RtsSave.flush();S.id=null;S.errs=null;S.screen='rts';S.anim='up';render();scrollTo(0,0);
    if(window.Sync)Sync.kick(500);
  },
  rtsFilter(el){S.rtsF=el.dataset.v;renderMain()},
  rtsOpen(el){openR(el.dataset.id)},
  rtsNew(){
    const ms=window.Models?Models.active():[];
    dialog(`<form class="dlg-body" data-submit="rtsNew"><h2>Novo RTS</h2><div class="field"><label for="nr-num">Proposta nº</label><input id="nr-num" name="numero" data-keep-case autocomplete="off" placeholder="1135-26" autofocus></div><div class="field"><label for="nr-cli">Cliente</label><input id="nr-cli" name="cliente" autocomplete="off"></div><div class="field"><label for="nr-prod">Produto</label><input id="nr-prod" name="produto" autocomplete="off" placeholder="Ex.: VÁLVULA BORBOLETA DN 2600"></div>${ms.length?`<div class="field"><label for="nr-mod">Partir de um projeto <span class="muted">(opcional)</span></label><select id="nr-mod" name="modelo"><option value="">Montar do zero</option>${ms.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}${m.dn?' — DN '+esc(m.dn):''}</option>`).join('')}</select></div>`:''}<div class="actions end"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit">Criar RTS</button></div></form>`);
  },
  rtsDup(){
    const r=curR();if(!r)return;
    const c=JSON.parse(JSON.stringify(r));
    for(const k of Object.keys(c))if(k.startsWith('_'))delete c[k];
    const n=newRts({});Object.assign(c,{id:n.id,createdAt:n.createdAt,updatedAt:n.updatedAt,createdBy:n.createdBy,updatedBy:n.updatedBy,status:'Rascunho',numero:'',emissao:today(),hora:nowHM(),dataDoc:'',aprovadoPor:''});
    c.deletedAt=undefined;delete c.deletedAt;
    const idMap=new Map();   // novos ids: atividades e POS não podem repetir ids do RTS de origem
    const nid=(old,p)=>{const v=uid(p);idMap.set(old,v);return v};
    c.geral.etapas.forEach(a=>a.id=nid(a.id,'RA'));c.montagem.etapas.forEach(a=>a.id=nid(a.id,'RA'));
    c.pos.forEach(p=>{p.id=nid(p.id,'RP');p.atividades.forEach(a=>a.id=nid(a.id,'RA'))});
    c.materiais.forEach(m=>{m.id=uid('RM');if(m.fromPos)m.fromPos=idMap.get(m.fromPos)||m.fromPos});
    const d=normRts(c);d._dirty=true;RTS.unshift(d);RtsStore.put(d);openR(d.id);
    toast('RTS duplicado. Informe o número da nova proposta.');
  },
  async rtsDel(){
    const r=curR();if(!r)return;
    if(!await ask({title:`Excluir o RTS ${r.numero||'sem número'}?`,body:'Ele sai da lista. Dá para desfazer logo após excluir.',ok:'Excluir',danger:true}))return;
    r.deletedAt=new Date().toISOString();touchR(r);S.screen='rts';render();scrollTo(0,0);
    toast('RTS excluído.',{label:'Desfazer',ms:7000,action:()=>{delete r.deletedAt;touchR(r);if(S.screen==='rts')renderMain()}});
  },
  rtsLoadModel(){
    const r=curR(),id=document.getElementById('rts-model')?.value,m=id&&Models.get(id);
    if(!m){toast('Escolha o modelo.');return}
    const n=loadModelPos(r,m);touchR(r);renderMain();
    toast(n?`${plural(n,'POS carregada','POS carregadas')} do projeto.`:'Todas as POS deste projeto já estão na lista.');
  },
  rtsPosAdd(){const r=curR();r.pos.push({id:uid('RP'),pos:'',nome:'',provs:[],titulo:'',atividades:[],nota:''});touchR(r);renderMain();const n=document.getElementById('pp-'+r.pos[r.pos.length-1].id);n&&n.focus()},
  rtsPosRm(el){
    const r=curR(),i=r.pos.findIndex(p=>p.id===el.dataset.id);if(i<0)return;
    const [gone]=r.pos.splice(i,1);touchR(r);renderMain();
    toast('POS removida.',{label:'Desfazer',ms:7000,action:()=>{r.pos.splice(i,0,gone);touchR(r);renderMain()}});
  },
  rtsPosMv(el){const r=curR(),i=r.pos.findIndex(p=>p.id===el.dataset.id);if(swap(r.pos,i,i+ +el.dataset.dir)){touchR(r);renderMain()}},
  rtsProv(el){
    const r=curR(),p=r.pos.find(x=>x.id===el.dataset.id),v=el.dataset.v;if(!p)return;
    if(hasProv(p,v))p.provs=p.provs.filter(x=>x!==v);
    else{p.provs=PROVS().filter(x=>x===v||hasProv(p,x));if(!p.atividades.length||p.atividades.every(a=>emp(a.t)))addLibActs(p,v)}   // lista vazia: entram as atividades padrão; com texto já escrito, nada é mexido
    touchR(r);renderMain();
  },
  rtsReload(el){
    const r=curR(),p=r.pos.find(x=>x.id===el.dataset.id);if(!p)return;
    const before=p.atividades.length;p.provs.forEach(v=>addLibActs(p,v));
    touchR(r);renderMain();toast(p.atividades.length>before?`${plural(p.atividades.length-before,'atividade padrão adicionada','atividades padrão adicionadas')}.`:'As atividades padrão já estão todas na lista.');
  },
  rtsActAdd(el){
    const r=curR(),l=actList(r,el.dataset.list);if(!l)return;
    const a=act('');l.push(a);touchR(r);renderMain();
    const n=document.querySelector(`textarea[data-id="${a.id}"]`);n&&n.focus();
  },
  rtsActRm(el){
    const r=curR(),l=actList(r,el.dataset.list);if(!l)return;
    const i=l.findIndex(a=>a.id===el.dataset.id);if(i<0)return;
    const [gone]=l.splice(i,1);touchR(r);renderMain();
    toast('Atividade removida.',{label:'Desfazer',ms:6000,action:()=>{l.splice(i,0,gone);touchR(r);renderMain()}});
  },
  rtsActMv(el){const r=curR(),l=actList(r,el.dataset.list);if(!l)return;const i=l.findIndex(a=>a.id===el.dataset.id);if(swap(l,i,i+ +el.dataset.dir)){touchR(r);renderMain()}},
  rtsMatAdd(){const r=curR();r.materiais.push({id:uid('RM'),desc:'',unid:'PÇ',qtd:'1'});touchR(r);renderMain()},
  rtsMatRm(el){const r=curR();r.materiais=r.materiais.filter(m=>m.id!==el.dataset.id);touchR(r);renderMain()},
  rtsMatSync(){const r=curR(),n=syncMats(r);touchR(r);renderMain();toast(n?`${plural(n,'item incluído','itens incluídos')} a partir das POS.`:'Nenhuma POS nova com Substituir ou Fabricar.')},
  async rtsUseCloud(){
    const r=curR();if(!r||!r._conflict)return;
    const n=fromRowR(r._conflict);Object.keys(r).forEach(k=>delete r[k]);Object.assign(r,n);await RtsStore.put(r);renderMain();toast('Versão da nuvem carregada.');
  },
  async rtsKeepMine(){
    const r=curR();if(!r||!r._conflict)return;
    r._rev=r._conflict.rev;r._conflict=null;touchR(r);renderMain();toast('Sua versão será enviada.');
  },
  async rtsPdf(el){
    const b=el.closest?.('button')||el;b.setAttribute?.('aria-busy','true');
    try{const r=curR(),out=await buildRtsPdf(r);saveBytes(out.bytes,out.fileName);toast('PDF gerado.')}catch(e){console.error(e);toast('Não foi possível gerar o PDF.')}
    finally{b.removeAttribute?.('aria-busy')}
  },
  async rtsPdfOpen(el){
    const win=window.open('','_blank');if(win)win.opener=null;
    const b=el.closest?.('button')||el;b.setAttribute?.('aria-busy','true');
    try{const out=await buildRtsPdf(curR()),u=URL.createObjectURL(new Blob([out.bytes],{type:'application/pdf'}));if(win&&!win.closed)win.location.href=u;else window.open(u,'_blank')}
    catch(e){if(win)win.close();console.error(e);toast('Não foi possível gerar o PDF.')}
    finally{b.removeAttribute?.('aria-busy')}
  }
});
Object.assign(MX.sub,{
  rtsNew(f){
    const e=f.elements,mid=e.modelo?.value;
    const r=newRts({numero:e.numero.value.trim(),cliente:e.cliente.value.trim(),produto:e.produto.value.trim()});
    const m=mid&&window.Models&&Models.get(mid);if(m)loadModelPos(r,m);
    r.objetivo=objetivoPadrao(r);r._dirty=true;RTS.unshift(r);RtsStore.put(r);
    closeDialog(f.closest('dialog'));openR(r.id);
  }
});
Object.assign(MX.inp,{
  rtsQ(el){S.rtsQ=el.value;document.getElementById('rts-rows').innerHTML=rowsRts()},
  rtsF(el){const r=curR();if(!r)return;setK(r,el.dataset.k,el.value);touchR(r);if(['numero'].includes(el.dataset.k)){const h=document.querySelector('.rts-edit h1');if(h)h.textContent='RTS '+(r.numero||'(sem nº)')}},
  rtsPos(el){
    const r=curR(),p=r?.pos.find(x=>x.id===el.dataset.id);if(!p)return;p[el.dataset.k]=el.value;touchR(r);
    const pv=document.querySelector(`[data-prev="${CSS.escape(p.id)}"]`);if(pv)pv.textContent=posHeading(p);
  },
  rtsAct(el){const r=curR(),l=actList(r,el.dataset.list),a=l?.find(x=>x.id===el.dataset.id);if(a){a.t=el.value;touchR(r)}},
  rtsMat(el){const r=curR(),m=r?.materiais.find(x=>x.id===el.dataset.id);if(m){m[el.dataset.k]=el.value;touchR(r)}}
});
Object.assign(MX.chg,{
  rtsStatus(el){const r=curR();if(!r)return;r.status=el.value;touchR(r)},
  rtsLib(el){
    if(!el.value)return;const r=curR(),p=r.pos.find(x=>x.id===el.dataset.id);if(!p)return;
    p.atividades.push(act(el.value));touchR(r);renderMain();
  },
  rtsTeste(el){if(!el.value)return;const r=curR();r.montagem.etapas.splice(Math.max(0,r.montagem.etapas.length-2),0,act(el.value));touchR(r);renderMain()}
});

/* ============================== PDF ============================== */
const rtsFileName=r=>['RTS',slug(r.numero)||'SEM-NUMERO',slug(r.cliente,20)||'CLIENTE',slug(r.produto,30)||'PRODUTO'].join('_')+'.pdf';
async function buildRtsPdf(r){
  await pdfLib();
  const F=FORM(),{jsPDF}=window.jspdf,logo=await logoForPdf();
  const M=15,W=210-2*M,TOP=40,BOT=297-27,LH=1.32;
  const pt=pdfTxt;
  const dateBR=v=>fmtISO(v)||'';
  /* monta o documento; tocPages = páginas reservadas ao sumário (descoberto na 1ª passada) */
  function render(tocPages){
    const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
    doc.setProperties({title:pt(`${F.titulo} - ${r.numero||''}`),subject:pt(r.produto||''),author:pt(S.user?.name||''),creator:'MINC Peritagem'});
    const toc=[];let y=TOP;
    const page=()=>doc.getNumberOfPages();
    const newPage=()=>{doc.addPage();y=TOP};
    const ensure=h=>{if(y+h>BOT)newPage()};
    const lineH=size=>size*0.3528*LH;
    const para=(txt,{size=10,bold=false,indent=0,gap=1.2,color=0}={})=>{
      doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(color);
      const lines=doc.splitTextToSize(pt(txt),W-indent),lh=lineH(size);
      for(const ln of lines){ensure(lh);doc.text(ln,M+indent,y+lh*.78);y+=lh}
      y+=gap;
    };
    const heading=(txt,{lvl=0,inToc=true}={})=>{
      const size=lvl===0?13:10.5;ensure(lineH(size)+16);
      y+=lvl===0?2:2.4;
      doc.setFont('helvetica','bold');doc.setFontSize(size);doc.setTextColor(0);
      const lines=doc.splitTextToSize(pt(txt),W),lh=lineH(size);
      lines.forEach(ln=>{doc.text(ln,M,y+lh*.78);y+=lh});
      if(lvl===0){doc.setDrawColor(0);doc.setLineWidth(.5);doc.line(M,y+.6,M+W,y+.6);y+=3.2}else y+=1.4;
      if(inToc)toc.push({lvl,title:txt.replace(/\.$/,''),page:page()});
    };
    const numbered=(n,txt)=>{
      doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(0);
      const lines=doc.splitTextToSize(pt(txt),W-14),lh=lineH(10),total=lines.length*lh;
      if(total<=BOT-TOP-10)ensure(total);
      lines.forEach((ln,i)=>{ensure(lh);if(i===0)doc.text(String(n),M+9,y+lh*.78,{align:'right'});doc.text(ln,M+13,y+lh*.78);y+=lh});
      y+=1.3;
    };
    const tbl=(opts)=>{doc.autoTable({theme:'grid',styles:{font:'helvetica',fontSize:9,cellPadding:2,lineColor:[0,0,0],lineWidth:.2,textColor:[0,0,0],valign:'middle'},headStyles:{fillColor:[236,236,236],textColor:[0,0,0],fontStyle:'bold',lineWidth:.2,lineColor:[0,0,0]},margin:{left:M,right:M,top:TOP,bottom:27-0},...opts,startY:y});y=doc.lastAutoTable.finalY+4};
    /* --- capa --- */
    doc.setFont('helvetica','bold');doc.setFontSize(30);doc.setTextColor(0);
    doc.text('Relatório Técnico de',105,120,{align:'center'});doc.text('Serviços',105,134,{align:'center'});
    y=196;
    doc.autoTable({theme:'grid',startY:y,styles:{font:'helvetica',fontSize:10,cellPadding:3,lineColor:[0,0,0],lineWidth:.3,textColor:[0,0,0],halign:'center',valign:'middle'},head:[['Proposta nº:','Elaborado por:','Aprovado por:','Data']],headStyles:{fillColor:[236,236,236],textColor:[0,0,0],fontStyle:'bold'},body:[[pt(r.numero||'-'),pt(r.elaboradoPor||'-'),pt(r.aprovadoPor||'-'),pt(dateBR(r.dataDoc||r.emissao)||'-')]],margin:{left:M,right:M}});
    /* --- páginas reservadas ao sumário --- */
    for(let i=0;i<tocPages;i++)doc.addPage();
    newPage();
    /* --- Dados do relatório --- */
    heading('Dados do Relatório');
    tbl({body:[[{content:'CLIENTE',colSpan:3,styles:{fillColor:[236,236,236],fontStyle:'bold'}},{content:'PRAZO',colSpan:2,styles:{fillColor:[236,236,236],fontStyle:'bold'}}],[{content:pt(r.cliente||'-'),colSpan:3},{content:pt(emp(r.prazoDias)?'-':r.prazoDias+' dias'),colSpan:2}],[{content:'Nº',styles:{fillColor:[236,236,236],fontStyle:'bold'}},{content:'EMISSÃO',styles:{fillColor:[236,236,236],fontStyle:'bold'}},{content:'HORA',styles:{fillColor:[236,236,236],fontStyle:'bold'}},{content:'ELABORADO POR:',styles:{fillColor:[236,236,236],fontStyle:'bold'}},{content:'STATUS',styles:{fillColor:[236,236,236],fontStyle:'bold'}}],[pt(r.numero||'-'),pt(dateBR(r.emissao)||'-'),pt(emp(r.hora)?'-':r.hora+' HS'),pt((r.elaboradoPor||'-').toUpperCase()),pt((r.statusDoc||'-').toUpperCase())]]});
    heading('Dados do Produto');
    tbl({head:[['CÓDIGO','PRODUTO','QUANTIDADE']],body:[[pt(r.codigoProduto||'-'),pt(r.produto||'-'),pt(r.quantidade||'-')]],columnStyles:{0:{cellWidth:32},2:{cellWidth:30,halign:'center'}}});
    heading('Objetivo');
    para(r.objetivo||'-',{gap:2.5});
    if(!emp(r.notaLocal)){doc.setFont('helvetica','bold');doc.setFontSize(10);const w=doc.getTextWidth('NOTA. ');ensure(lineH(10));doc.text('NOTA. ',M,y+lineH(10)*.78);doc.setFont('helvetica','normal');
      const lines=doc.splitTextToSize(pt(r.notaLocal),W-w);lines.forEach((ln,i)=>{if(i>0)ensure(lineH(10));doc.text(ln,M+(i===0?w:0),y+lineH(10)*.78);y+=lineH(10)});y+=2}
    /* --- escopo --- */
    const nums=numbering(r);
    heading('Descrição Técnica do Serviço');
    heading(r.geral.titulo+(emp(r.geral.sub)?'':''),{lvl:1});
    if(!emp(r.geral.sub))para(r.geral.sub,{bold:true,gap:2});
    r.geral.etapas.filter(a=>!emp(a.t)).forEach(a=>numbered(nums.get(a.id),a.t));
    for(const p of r.pos){
      heading(posHeading(p),{lvl:1});
      p.atividades.filter(a=>!emp(a.t)).forEach(a=>numbered(nums.get(a.id),a.t));
      if(!emp(p.nota))para('NOTA. '+p.nota,{indent:13,size:9.5,gap:2});
    }
    heading(r.montagem.titulo,{lvl:1});
    r.montagem.etapas.filter(a=>!emp(a.t)).forEach(a=>numbered(nums.get(a.id),a.t));
    if(!emp(r.notaEmbalagem))para('Nota. - '+r.notaEmbalagem,{bold:true,size:9,indent:13,gap:2});
    /* --- observações --- */
    heading('Observações Técnicas');
    [['(Obs.1) IDENTIFICAÇÃO',r.obs.identificacao],['(Obs.2) PINTURA',r.obs.pintura],['(Obs.3) EMBALAGEM',r.obs.embalagem],['(Obs.4) DEVOLUÇÃO',r.obs.devolucao],['(Obs.5) TESTES',r.obs.testes]].forEach(([t,v])=>{heading(t,{lvl:1});para(v||'-',{indent:3,gap:2})});
    heading('Cronograma do Serviço');
    para(emp(r.prazoDias)?'Prazo estimado: a definir.':`Prazo Estimado: ${r.prazoDias} dias, após a liberação do serviço pelo cliente.`,{gap:3});
    if(!emp(r.validade)){heading('Validade',{inToc:false});para(r.validade,{gap:3})}
    heading('ANEXOS.',{lvl:1,inToc:false});para('Anexo 01 – Lista de Material.',{gap:2});
    /* --- anexo 01 --- */
    newPage();
    heading('Anexo 01 - Lista de Materiais');
    const mats=r.materiais.filter(m=>!emp(m.desc));
    tbl({head:[[{content:'ITEM',styles:{halign:'center'}},'DESCRIÇÃO',{content:'UNID',styles:{halign:'center'}},{content:'QTD',styles:{halign:'center'}}]],body:mats.length?mats.map((m,i)=>[String(i+1),pt(String(m.desc).toUpperCase()),pt(m.unid||'-'),pt(m.qtd||'-')]):[[{content:'Sem itens.',colSpan:4,styles:{halign:'center'}}]],columnStyles:{0:{cellWidth:16,halign:'center'},2:{cellWidth:20,halign:'center'},3:{cellWidth:20,halign:'center'}}});
    heading('Termo de Garantia');
    String(r.garantia||'-').split(/\n\s*\n/).forEach(t=>para(t.trim(),{gap:3}));
    return{doc,toc};
  }
  /* sumário: 1ª passada descobre quantas páginas ele precisa, 2ª posiciona o conteúdo certo */
  const tocHeight=e=>e.lvl===0?7:5.6;
  const needPages=toc=>{let pages=1,y=TOP+14;toc.forEach(e=>{const h=tocHeight(e);if(y+h>BOT){pages++;y=TOP}y+=h});return pages};   // mesma conta do desenho abaixo
  let pass=render(1),tocPages=needPages(pass.toc);
  if(tocPages>1)pass=render(tocPages);
  const {doc,toc}=pass;
  /* desenha o sumário nas páginas reservadas (2..1+tocPages) */
  let tp=2,ty=TOP;
  doc.setPage(tp);doc.setFont('helvetica','bold');doc.setFontSize(16);doc.setTextColor(0);doc.text('Sumário',M,ty+6);ty+=14;
  for(const e of toc){
    const h=tocHeight(e);
    if(ty+h>BOT){tp++;doc.setPage(tp);ty=TOP}
    const x=M+e.lvl*6,size=e.lvl===0?10.5:9;
    doc.setFont('helvetica',e.lvl===0?'bold':'normal');doc.setFontSize(size);doc.setTextColor(0);
    const title=pt(e.title),pg=String(e.page),pw=doc.getTextWidth(pg);
    let t=title;const maxW=W-e.lvl*6-pw-8;
    while(t.length>4&&doc.getTextWidth(t)>maxW)t=t.slice(0,-1);
    if(t!==title)t=t.slice(0,-1)+'...';
    const base=ty+h*.7;
    doc.text(t,x,base);doc.text(pg,M+W,base,{align:'right'});
    doc.setFont('helvetica','normal');doc.setFontSize(size);doc.setTextColor(120);
    const startX=x+doc.getTextWidth(t)+1.5,endX=M+W-pw-1.5,dw=doc.getTextWidth('.');
    if(endX-startX>dw*2)doc.text('.'.repeat(Math.floor((endX-startX)/dw)),startX,base);
    doc.setTextColor(0);
    try{doc.link(x,ty,W-e.lvl*6,h,{pageNumber:e.page})}catch{}
    ty+=h;
  }
  /* cabeçalho e rodapé de todas as páginas */
  const n=doc.getNumberOfPages();
  for(let i=1;i<=n;i++){
    doc.setPage(i);
    const hx=M,hy=10,hh=22,lw=34,rw=56;
    doc.setDrawColor(0);doc.setLineWidth(.4);doc.rect(hx,hy,W,hh);doc.line(hx+lw,hy,hx+lw,hy+hh);doc.line(hx+W-rw,hy,hx+W-rw,hy+hh);doc.setLineWidth(.2);
    if(logo){const pad=2,aw=lw-pad*2,ah=hh-pad*2;let w=aw,h=w/logo.ratio;if(h>ah){h=ah;w=h*logo.ratio}try{doc.addImage(logo.url,'PNG',hx+(lw-w)/2,hy+(hh-h)/2,w,h)}catch(e){console.error('logo no PDF',e)}}
    else{doc.setFont('helvetica','bold');doc.setFontSize(14);doc.setTextColor(0);doc.text('MINC',hx+lw/2,hy+hh/2+2,{align:'center'})}
    doc.setTextColor(0);doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text(pt(F.titulo),hx+lw+(W-lw-rw)/2,hy+hh/2+1.5,{align:'center'});
    doc.setFontSize(8);[['Tipo:',F.tipo],['Cód.:',F.codigo],['Rev.:',F.rev],['Data:',fmtISO(F.data)]].forEach(([k,v],j)=>{
      doc.setFont('helvetica','normal');doc.text(pt(k),hx+W-rw+3,hy+4.6+j*4.6);doc.setFont('helvetica','bold');doc.text(pt(v||'-'),hx+W-rw+16,hy+4.6+j*4.6);
    });
    doc.setDrawColor(150);doc.setLineWidth(.2);doc.line(M,283,M+W,283);
    doc.setTextColor(60);doc.setFontSize(7.5);doc.setFont('helvetica','normal');
    doc.text(pt(`${F.codigo}    REV:${F.rev||'-'}`),M,287);
    doc.setFont('helvetica','bold');doc.text(`Página ${i} de ${n}`,M+W,287,{align:'right'});
    doc.setFont('helvetica','normal');doc.setFontSize(6.8);
    if(F.endereco)doc.text(pt(F.endereco),105,291,{align:'center'});
    if(F.contato)doc.text(pt(F.contato),105,294.4,{align:'center'});
  }
  return{bytes:doc.output('arraybuffer'),pages:n,fileName:rtsFileName(r)};
}
window.buildRtsPdf=buildRtsPdf;
})();
