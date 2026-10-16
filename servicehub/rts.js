/* MINC · Peritagem — Módulo RTS (Relatório Técnico de Serviço)  (v5.12.0 · v5.28.0: balão de atividades, sem formato de título/pintura, texto por POS, importação do laudo do cliente)
   Independente das peritagens: o RTS nasce na proposta, muitas vezes antes de ver a válvula.
   - Lista de RTS (aba "RTS" no topo), editor em seções e PDF no layout R-MINC-060-RTS-PT (capa, sumário, rodapé).
   - Escopo por POS: o usuário escolhe a providência e as atividades padrão entram prontas (catalogo.js > RTS_BIBLIOTECA).
   - Observações técnicas, seções extras e anexos (imagens/desenhos/lista de materiais) são listas livres, com biblioteca.
   - Aprovação dentro do app: o elaborador envia, o ADMINISTRADOR aprova (ou devolve). Só o aprovado sai com "Aprovado por".
   - Guardado neste aparelho (IndexedDB) e sincronizado com a tabela rts_documents quando há nuvem (mesma lógica de revisão
     das peritagens). As imagens vão para o bucket peritagem-fotos, em rts/<id do RTS>/.
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
const BIBX=()=>CAT().RTS_BIBLIOTECA_EXTRA||{};
const OBSB=()=>CAT().RTS_OBS_BIBLIOTECA||[];
const PINT=()=>CAT().RTS_PINTURAS||[{nome:'Padrão MINC',linhas:[]}];
const GAR=()=>CAT().RTS_GARANTIAS||[];
const TXT=()=>CAT().RTS_TEXTOS||{};
/* status do RTS: o fluxo de aprovação é Rascunho -> Aguardando aprovação -> Aprovado */
const S_RAS='Rascunho',S_AGU='Aguardando aprovação',S_APR='Aprovado';
const RSTATUS=[S_RAS,S_AGU,S_APR];
const rCls={[S_RAS]:'st-gray',[S_AGU]:'st-amber',[S_APR]:'st-green'};
const LEGACY_STATUS={'Em revisão':S_AGU,'Emitido':S_APR};
const PCOM_MAT=['Substituir','Fabricar'];   // providências que entram na lista de materiais
const missing=e=>!!e&&(e.code==='PGRST205'||e.code==='42P01'||/relation .* does not exist|schema cache/i.test(e.message||''));
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const nowHM=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
const dedupe=a=>[...new Set(a)];
const isAdminU=()=>CLOUD?['admin','gestor'].includes(S.user?.cloudRole):['Administrador','Gestor'].includes(S.user?.role);   // quem aprova: administrador ou gestor

/* ============================== Dados ============================== */
let RTS=[];
window.RTSLIST=()=>RTS;
const curR=()=>RTS.find(r=>r.id===S.rtsId&&!r.deletedAt);
const act=t=>({id:uid('RA'),t});
const verbo=p=>String(p||'').toUpperCase();
const locked=r=>r.status!==S_RAS;

function normRts(r){
  if(LEGACY_STATUS[r.status])r.status=LEGACY_STATUS[r.status];
  r.status=RSTATUS.includes(r.status)?r.status:S_RAS;
  for(const k of ['numero','cliente','produto','codigoProduto','quantidade','emissao','hora','elaboradoPor','statusDoc','prazoData','prazoDias','prazoRef','modeloId','modeloNome','objetivo','notaLocal','validade','garantia','notaEmbalagem','aprovadoPor','aprovadoEm','aprovadoPorId','enviadoPor','enviadoEm','motivoDevolucao'])if(r[k]==null)r[k]='';
  r.tituloModo='pos';   // formato único do título: POS. 02 - CORPO – RECUPERAR.
  r.pintura=0;          // um padrão de pintura só (o da biblioteca); o seletor foi retirado para não confundir
  r.geral=Object.assign({titulo:'CONJUNTO GERAL –',sub:'',etapas:[]},r.geral);r.geral.etapas=Array.isArray(r.geral.etapas)?r.geral.etapas:[];
  r.montagem=Object.assign({titulo:CAT().RTS_MONTAGEM_TITULO||'MONTAGEM DO CONJUNTO GERAL – TESTES – PINTURA',etapas:[]},r.montagem);r.montagem.etapas=Array.isArray(r.montagem.etapas)?r.montagem.etapas:[];
  r.pos=(Array.isArray(r.pos)?r.pos:[]).map(p=>Object.assign({id:uid('RP'),pos:'',nome:'',qtd:'',unid:'',provs:[],titulo:'',atividades:[],nota:''},p,{provs:Array.isArray(p.provs)?p.provs:[],atividades:Array.isArray(p.atividades)?p.atividades:[]}));
  r.materiais=Array.isArray(r.materiais)?r.materiais:[];
  r.extras=Array.isArray(r.extras)?r.extras:[];
  if(!Array.isArray(r.observacoes)){   // formato antigo (5 campos fixos): vira lista
    const o=r.obs||{},old=[['IDENTIFICAÇÃO',o.identificacao],['PINTURA',o.pintura],['EMBALAGEM',o.embalagem],['DEVOLUÇÃO',o.devolucao],['TESTES',o.testes]];
    r.observacoes=old.filter(([,t])=>!emp(t)).map(([titulo,texto])=>({id:uid('RO'),titulo,texto}));
  }
  delete r.obs;
  r.anexos=Array.isArray(r.anexos)?r.anexos:[{id:uid('RX'),titulo:'Lista de Materiais',tipo:'materiais',layout:'lado',itens:[]}];
  r.anexos.forEach(a=>{a.itens=Array.isArray(a.itens)?a.itens:[];a.layout=a.layout==='cheia'?'cheia':'lado'});
  return r;
}
function newRts(o={}){
  const T=TXT(),now=new Date().toISOString();
  const r=normRts({id:uid('RTS'),createdAt:now,updatedAt:now,createdBy:S.user?.name||'',updatedBy:S.user?.name||'',
    status:S_RAS,emissao:today(),hora:nowHM(),elaboradoPor:S.user?.name||'',statusDoc:(CAT().RTS_STATUS_DOC||[])[0]||'',quantidade:'01',
    prazoRef:(CAT().RTS_PRAZO_REF||[])[0]||'',
    notaLocal:T.notaLocal||'',notaEmbalagem:T.notaEmbalagem||'',validade:T.validade||'',garantia:(GAR()[0]||{}).texto||'',
    observacoes:OBSB().filter(x=>x.padrao).map(x=>({id:uid('RO'),titulo:x.titulo,texto:x.texto})),
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

/* ---- imagens dos anexos: aparelho (IndexedDB 'photos', procId = id do RTS) e nuvem (bucket peritagem-fotos, rts/<id>/) ---- */
const imgPath=(rid,id)=>`rts/${rid}/${id}.jpg`;
const rtsImgRefs=r=>r.anexos.flatMap(a=>a.itens.map(i=>i.img).filter(Boolean));
MX.keepPhotos=()=>RTS.flatMap(r=>rtsImgRefs(r).map(i=>i.id));   // o app.js não apaga estas imagens na limpeza
async function dropImg(r,img){
  const u=Photos.urls.get(img.id);if(u)URL.revokeObjectURL(u);Photos.urls.delete(img.id);
  if(CLOUD){const rec=await Store.get('photos',img.id).catch(()=>null);
    if(rec?.up){let q=[];try{q=JSON.parse(localStorage.getItem('minc_photo_del'))||[]}catch{}q.push({id:img.id,path:[imgPath(r.id,img.id)]});try{localStorage.setItem('minc_photo_del',JSON.stringify(q))}catch{}}}
  return Store.del('photos',img.id).catch(()=>{});
}
async function imgsUp(){
  if(!CLOUD)return false;let did=false;
  for(const rec of (await Store.all('photos')).filter(x=>String(x.procId).startsWith('RTS-')&&!x.up)){
    const r=RTS.find(x=>x.id===rec.procId);
    if(!r||r.deletedAt||!rtsImgRefs(r).some(i=>i.id===rec.id))continue;
    const u=await SB.storage.from(BUCKET).upload(imgPath(rec.procId,rec.id),rec.blob,{contentType:'image/jpeg',upsert:false});
    if(u.error&&!/exist|duplicate/i.test(u.error.message||''))throw u.error;
    rec.up=true;await Store.put('photos',rec);did=true;
  }
  return did;
}
async function imgsDown(){
  if(!CLOUD)return false;const have=new Set(await Store.photoKeys());let n=0;
  for(const r of RTS.filter(x=>!x.deletedAt&&x._rev!=null)){
    for(const img of rtsImgRefs(r)){
      if(have.has(img.id))continue;if(n>=25)return true;
      const d=await SB.storage.from(BUCKET).download(imgPath(r.id,img.id));
      if(d.error||!d.data)continue;
      await Store.put('photos',{id:img.id,procId:r.id,blob:d.data,name:img.name,at:Date.now(),up:true});
      Photos.urls.set(img.id,URL.createObjectURL(d.data));have.add(img.id);n++;
    }
  }
  return n>0;
}

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
MX.sync.push(async()=>{
  if(!S.user)return false;
  const a=await Cloud.push(),b=await Cloud.pull();let d=false;
  try{await imgsUp()}catch(e){console.error('imagens RTS (envio)',e)}
  try{d=await imgsDown()}catch(e){console.error('imagens RTS (baixa)',e)}
  return a||b||d;
});
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
  return l.map(r=>`<button class="rts-row" data-act="rtsOpen" data-id="${esc(r.id)}"><div class="rts-r1"><b>${esc(r.numero)||'Sem nº'}</b><span class="badge ${rCls[r.status]||'st-gray'}">${esc(r.status)}</span>${r._conflict?'<span class="badge st-amber">Conflito</span>':''}</div><div class="rts-r2">${esc(r.produto)||'Sem produto'}</div><div class="rts-r3">${esc(r.cliente)||'—'} · ${r.status===S_APR&&r.aprovadoPor?'aprovado por '+esc(r.aprovadoPor)+' · ':''}atualizado em ${fmt(r.updatedAt)}${r._dirty?' · envio pendente':''}</div></button>`).join('');
}
MX.views.rts=function(){
  const all=RTS.filter(r=>!r.deletedAt),aguard=all.filter(r=>r.status===S_AGU).length;
  const note=CLOUD&&Cloud.missing?'<p class="errbox" style="margin-bottom:12px">A tabela de RTS ainda não existe na nuvem; por enquanto os RTS ficam só neste aparelho. Peça ao responsável técnico para aplicar a migração 20261013_modelos_valvula_e_rts.sql.</p>':'';
  const pend=isAdminU()&&aguard?`<div class="mdl-hint" style="margin-bottom:12px"><b>${aguard===1?'1 RTS aguarda':aguard+' RTS aguardam'} a sua aprovação</b><span><button class="btn" data-act="rtsFilter" data-v="${S_AGU}" style="margin-top:6px">Ver pendentes</button></span></div>`:'';
  return `<div class="rts-home"><div class="list-h"><div><h1>Relatórios Técnicos de Serviço</h1><small>${plural(all.length,'cadastrado','cadastrados')}</small></div><button class="btn primary" data-act="rtsNew">${ic('plus')}Novo RTS</button></div>${note}${pend}<div class="search">${ic('search')}<input type="search" id="rts-q" placeholder="Buscar proposta, cliente, produto…" aria-label="Buscar RTS" data-keep-case data-inp="rtsQ" value="${esc(S.rtsQ||'')}"></div><div class="chips fl" role="group" aria-label="Filtrar por status">${['Todos',...RSTATUS].map(f=>`<button class="chip ${(S.rtsF||'Todos')===f?'on':''}" data-act="rtsFilter" data-v="${f}" aria-pressed="${(S.rtsF||'Todos')===f}" data-fk="rf-${f}">${f}</button>`).join('')}</div><div id="rts-rows" class="rts-rows">${rowsRts()}</div></div>`;
};

/* ============================== Editor ============================== */
const fx=(label,k,v,o={})=>`<div class="field ${o.cls||''}"><label for="rf-${k}">${label}</label><input id="rf-${k}" ${o.type?`type="${o.type}"`:''} value="${esc(v)}" data-inp="rtsF" data-k="${k}" ${o.keep?'data-keep-case':''} ${o.list?`list="${o.list}"`:''} ${o.ph?`placeholder="${esc(o.ph)}"`:''} autocomplete="off"></div>`;
const ta=(label,k,v,rows=3)=>`<div class="field"><label for="rf-${k}">${label}</label><textarea id="rf-${k}" rows="${rows}" class="rts-ta" data-inp="rtsF" data-k="${k}" data-keep-case>${esc(v)}</textarea></div>`;
const setK=(r,k,v)=>{const p=k.split('.'),l=p.pop();const o=p.reduce((a,x)=>a[x],r);o[l]=v};

/* numeração dos itens do escopo: reinicia em 1 em cada bloco (conjunto geral, cada POS, montagem) */
function numbering(r){
  const m=new Map(),seq=l=>{let n=0;l.forEach(a=>m.set(a.id,++n))};
  seq(r.geral.etapas);r.pos.forEach(p=>seq(p.atividades));seq(r.montagem.etapas);
  return m;
}
const posHeading=(p,r)=>{
  if(!emp(p.titulo))return p.titulo;
  const nome=emp(p.nome)?'(sem nome)':p.nome;
  const base=emp(p.pos)?nome:`POS. ${p.pos} - ${nome}`;
  return (base+(p.provs.length?' – '+p.provs.map(verbo).join(' – '):'')+'.').toUpperCase();
};
const actList=(r,key)=>key==='geral'?r.geral.etapas:key==='mont'?r.montagem.etapas:(r.pos.find(p=>p.id===key)||{}).atividades;
/* a linha "{PINTURA}" da biblioteca vira as linhas do padrão de pintura escolhido no RTS */
const expand=(r,list)=>list.flatMap(t=>t==='{PINTURA}'?((PINT()[r.pintura]||PINT()[0]||{}).linhas||[]):[t]);

function actRows(r,key,nums){
  const l=actList(r,key)||[];
  return l.map(a=>`<div class="rts-act"><span class="rts-n">${nums.get(a.id)||''}</span><textarea class="rts-ta" rows="1" aria-label="Atividade" data-inp="rtsAct" data-list="${esc(key)}" data-id="${esc(a.id)}" data-keep-case>${esc(a.t)}</textarea><div class="rts-mv"><button class="iconb" data-act="rtsActMv" data-list="${esc(key)}" data-id="${esc(a.id)}" data-dir="-1" aria-label="Subir">${ic('up')}</button><button class="iconb" data-act="rtsActMv" data-list="${esc(key)}" data-id="${esc(a.id)}" data-dir="1" aria-label="Descer">${ic('chev')}</button><button class="iconb" data-act="rtsActRm" data-list="${esc(key)}" data-id="${esc(a.id)}" aria-label="Remover atividade">${ic('trash')}</button></div></div>`).join('')||'<p class="hint">Nenhuma atividade nesta seção.</p>';
}
/* grupos de atividades sugeridas para o balão (nada entra sozinho: o funcionário marca o que vale) */
function libGroups(r,p){
  const have=new Set(p.atividades.map(a=>a.t)),g=[],used=new Set();
  for(const v of p.provs){
    const l=dedupe(expand(r,BIB()[v]||[])).filter(t=>!have.has(t)&&!used.has(t));
    l.forEach(t=>used.add(t));if(l.length)g.push([`${v} — atividades padrão`,l]);
  }
  for(const [k,l] of Object.entries(BIBX())){const f=expand(r,l).filter(t=>!have.has(t)&&!used.has(t));if(f.length)g.push([k,f])}
  return g;
}
function posCard(r,p,i,nums){
  return `<article class="rts-pos"><div class="rts-ph"><div class="field rts-pos-no"><label for="pp-${p.id}">POS.</label><input id="pp-${p.id}" value="${esc(p.pos)}" data-inp="rtsPos" data-id="${esc(p.id)}" data-k="pos" autocomplete="off"></div><div class="field rts-pos-nm"><label for="pn-${p.id}">Componente</label><input id="pn-${p.id}" value="${esc(p.nome)}" data-inp="rtsPos" data-id="${esc(p.id)}" data-k="nome" autocomplete="off"></div><div class="rts-mv"><button class="iconb" data-act="rtsPosMv" data-id="${esc(p.id)}" data-dir="-1" aria-label="Subir POS">${ic('up')}</button><button class="iconb" data-act="rtsPosMv" data-id="${esc(p.id)}" data-dir="1" aria-label="Descer POS">${ic('chev')}</button><button class="iconb" data-act="rtsPosRm" data-id="${esc(p.id)}" aria-label="Remover POS">${ic('trash')}</button></div></div>
${p.laudo?`<p class="rts-laudo-tag">${ic('doc')}Do laudo do cliente: ${esc(p.laudo)}</p>`:''}
<div class="chips fl rts-provs" id="prov-${esc(p.id)}" role="group" aria-label="Providência">${PROVS().map(v=>`<button class="chip ${p.provs.includes(v)?'on':''}" data-act="rtsProv" data-id="${esc(p.id)}" data-v="${v}" aria-pressed="${p.provs.includes(v)}">${v}</button>`).join('')}</div>
<div class="rts-title" data-prev="${esc(p.id)}">${esc(posHeading(p,r))}</div>
${actRows(r,p.id,nums)}
<div class="actions rts-addrow"><button class="btn" data-act="rtsPick" data-id="${esc(p.id)}">${ic('check')}Escolher atividades</button><button class="btn" data-act="rtsActAdd" data-list="${esc(p.id)}">${ic('plus')}Atividade</button></div>
<div class="field" style="margin-top:10px"><label for="pnota-${p.id}">Texto desta POS <span class="muted">(opcional — aparece como NOTA depois das atividades)</span></label><textarea id="pnota-${p.id}" rows="2" class="rts-ta" data-inp="rtsPos" data-id="${esc(p.id)}" data-k="nota" data-keep-case>${esc(p.nota)}</textarea></div>
<details class="rts-more"><summary>Mais opções (título)</summary><div class="field"><label for="pt-${p.id}">Título no documento <span class="muted">(deixe vazio para gerar automático)</span></label><input id="pt-${p.id}" value="${esc(p.titulo)}" data-inp="rtsPos" data-id="${esc(p.id)}" data-k="titulo" autocomplete="off" placeholder="${esc(posHeading({...p,titulo:''},r))}"></div></details></article>`;
}
function matRows(r){
  return r.materiais.map(m=>`<div class="rts-mat"><input aria-label="Descrição" value="${esc(m.desc)}" data-inp="rtsMat" data-id="${esc(m.id)}" data-k="desc" autocomplete="off"><input aria-label="Unidade" value="${esc(m.unid)}" data-inp="rtsMat" data-id="${esc(m.id)}" data-k="unid" data-keep-case autocomplete="off"><input aria-label="Quantidade" value="${esc(m.qtd)}" data-inp="rtsMat" data-id="${esc(m.id)}" data-k="qtd" inputmode="decimal" data-keep-case autocomplete="off"><button class="iconb" data-act="rtsMatRm" data-id="${esc(m.id)}" aria-label="Remover item">${ic('trash')}</button></div>`).join('')||'<p class="hint">Sem itens. Marque POS como Substituir ou Fabricar e use “Atualizar a partir das POS”.</p>';
}
/* listas livres (seções extras e observações): título + texto */
function listBlock(r,list,{label,rows=3}){
  const arr=r[list];
  return arr.map((x,i)=>`<div class="rts-blk"><div class="rts-bh"><div class="field"><label for="b-${x.id}">${label}${list==='observacoes'?` <span class="muted">(Obs.${i+1})</span>`:''}</label><input id="b-${x.id}" value="${esc(x.titulo)}" data-inp="rtsList" data-list="${list}" data-id="${esc(x.id)}" data-k="titulo" ${list==='extras'?'list="dl-extras"':''} autocomplete="off"></div><div class="rts-mv"><button class="iconb" data-act="rtsLMv" data-list="${list}" data-id="${esc(x.id)}" data-dir="-1" aria-label="Subir">${ic('up')}</button><button class="iconb" data-act="rtsLMv" data-list="${list}" data-id="${esc(x.id)}" data-dir="1" aria-label="Descer">${ic('chev')}</button><button class="iconb" data-act="rtsLRm" data-list="${list}" data-id="${esc(x.id)}" aria-label="Remover">${ic('trash')}</button></div></div><textarea class="rts-ta" rows="${rows}" aria-label="Texto" data-inp="rtsList" data-list="${list}" data-id="${esc(x.id)}" data-k="texto" data-keep-case>${esc(x.texto)}</textarea></div>`).join('');
}
function anexoCard(r,a,i){
  const n=String(i+1).padStart(2,'0');
  const head=`<div class="rts-bh"><div class="field"><label for="ax-${a.id}">Anexo ${n} — título</label><input id="ax-${a.id}" value="${esc(a.titulo)}" data-inp="rtsAx" data-aid="${esc(a.id)}" data-k="titulo" list="dl-anexos" autocomplete="off"></div><div class="rts-mv"><button class="iconb" data-act="rtsAxMv" data-aid="${esc(a.id)}" data-dir="-1" aria-label="Subir anexo">${ic('up')}</button><button class="iconb" data-act="rtsAxMv" data-aid="${esc(a.id)}" data-dir="1" aria-label="Descer anexo">${ic('chev')}</button><button class="iconb" data-act="rtsAxRm" data-aid="${esc(a.id)}" aria-label="Remover anexo">${ic('trash')}</button></div></div>`;
  if(a.tipo==='materiais')return `<article class="rts-pos">${head}<div class="actions" style="margin-bottom:8px"><button class="btn" data-act="rtsMatSync">Atualizar a partir das POS</button><button class="btn" data-act="rtsMatAdd">${ic('plus')}Item</button></div><div class="rts-mats"><div class="rts-mh"><span>Descrição</span><span>Unid.</span><span>Qtd.</span><span></span></div>${matRows(r)}</div></article>`;
  const items=a.itens.map(it=>{
    const u=it.img&&Photos.urls.get(it.img.id);
    return `<div class="rts-img"><div class="rts-thumb">${u?`<img src="${u}" alt="${esc(it.img.name||'')}">`:`<span class="muted">${it.img?'Baixando…':'Sem imagem'}</span>`}</div><div class="rts-imf"><div class="field"><label for="d-${it.id}">Descrição</label><input id="d-${it.id}" value="${esc(it.descricao)}" data-inp="rtsAxIt" data-aid="${esc(a.id)}" data-id="${esc(it.id)}" data-k="descricao" autocomplete="off"></div><div class="field"><label for="s-${it.id}">Status / observação</label><textarea id="s-${it.id}" rows="2" class="rts-ta" data-inp="rtsAxIt" data-aid="${esc(a.id)}" data-id="${esc(it.id)}" data-k="status" data-keep-case>${esc(it.status)}</textarea></div></div><button class="iconb" data-act="rtsImgRm" data-aid="${esc(a.id)}" data-id="${esc(it.id)}" aria-label="Remover imagem">${ic('trash')}</button></div>`;
  }).join('')||'<p class="hint">Nenhuma imagem neste anexo.</p>';
  return `<article class="rts-pos">${head}<div class="field" style="max-width:340px"><label for="ly-${a.id}">Disposição das imagens no PDF</label><select id="ly-${a.id}" data-chg="rtsAxLayout" data-aid="${esc(a.id)}"><option value="lado" ${a.layout==='lado'?'selected':''}>Imagem ao lado da descrição</option><option value="cheia" ${a.layout==='cheia'?'selected':''}>Imagem em largura total (desenhos)</option></select></div>${items}<div class="actions" style="margin-top:8px"><button class="btn" data-act="rtsImgAdd" data-aid="${esc(a.id)}">${ic('camera')}Adicionar imagens</button></div></article>`;
}
/* barra de aprovação: o fluxo e quem pode o quê */
function approvalBar(r){
  const adm=isAdminU();
  if(r.status===S_RAS){
    const back=!emp(r.motivoDevolucao)?`<div class="errbox" style="margin-bottom:10px" role="alert"><b>Devolvido para ajustes${r.devolvidoPor?' por '+esc(r.devolvidoPor):''}:</b> ${esc(r.motivoDevolucao)}</div>`:'';
    return `<div class="panel rts-ap" data-ap="no">${back}<div class="ph-row"><div><h2>Aprovação</h2><p class="hint" style="margin:0">Rascunho. Quando estiver pronto, envie para aprovação. O PDF só sai com “Aprovado por” depois que o administrador aprovar aqui no app.</p></div><button class="btn primary" data-act="rtsSubmit">${ic('next')}Enviar para aprovação</button></div></div>`;
  }
  if(r.status===S_AGU){
    return `<div class="panel rts-ap" data-ap="no"><div class="ph-row"><div><h2>Aguardando aprovação</h2><p class="hint" style="margin:0">Enviado por ${esc(r.enviadoPor||'—')} em ${fmt(r.enviadoEm)}. Enquanto aguarda, o RTS fica travado para edição.</p></div><div class="actions">${adm?`<button class="btn" data-act="rtsReturn">Devolver para ajustes</button><button class="btn primary" data-act="rtsApprove">${ic('check')}Aprovar e liberar</button>`:`<button class="btn" data-act="rtsReopen">Reabrir para edição</button>`}</div></div>${adm?'':'<p class="hint" style="margin:8px 0 0">Só o administrador pode aprovar.</p>'}</div>`;
  }
  return `<div class="panel rts-ap" data-ap="yes"><div class="ph-row"><div><h2>Aprovado</h2><p class="hint" style="margin:0">Aprovado por <b>${esc(r.aprovadoPor)}</b> em ${fmt(r.aprovadoEm)}. O PDF sai com esta aprovação.</p></div><button class="btn" data-act="rtsReopen">Reabrir para edição</button></div></div>`;
}
MX.views.rtsEdit=function(){
  const r=curR();if(!r)return `<div class="empty"><h2>RTS não encontrado</h2><button class="btn primary" data-act="rtsHome">Voltar à lista</button></div>`;
  const nums=numbering(r),models=window.Models?Models.active():[],lock=locked(r);
  const conflict=r._conflict?`<div class="errbox rts-conf" role="alert"><b>Outra pessoa alterou este RTS antes de você enviar.</b> Escolha qual versão manter.<div class="actions" style="margin-top:8px"><button class="btn" data-act="rtsUseCloud">Usar a versão da nuvem</button><button class="btn primary" data-act="rtsKeepMine">Manter a minha</button></div></div>`:'';
  const dl=`<datalist id="dl-sdoc">${(CAT().RTS_STATUS_DOC||[]).map(s=>`<option value="${esc(s)}">`).join('')}</datalist><datalist id="dl-pref">${(CAT().RTS_PRAZO_REF||[]).map(s=>`<option value="${esc(s)}">`).join('')}</datalist><datalist id="dl-extras">${(CAT().RTS_EXTRAS_TITULOS||[]).map(s=>`<option value="${esc(s)}">`).join('')}</datalist><datalist id="dl-anexos">${(CAT().RTS_ANEXOS_TITULOS||[]).map(s=>`<option value="${esc(s)}">`).join('')}</datalist>`;
  const sug=(CAT().RTS_TESTES_SUGESTOES||[]).filter(t=>!r.montagem.etapas.some(a=>a.t===t));
  const obsLib=OBSB().filter(o=>!r.observacoes.some(x=>x.titulo===o.titulo&&x.texto===o.texto));
  const hasMat=r.anexos.some(a=>a.tipo==='materiais');
  return `<div class="rts-edit"><div class="ph"><button class="btn ghost" data-act="rtsHome">${ic('back')}Todos os RTS</button><div class="ph-row"><div><h1>RTS ${esc(r.numero)||'(sem nº)'} <span class="badge ${rCls[r.status]}" style="vertical-align:middle">${esc(r.status)}</span></h1><p id="rts-state" class="hint" style="margin:0">${stateHTML(r)}</p></div><div class="actions"><button class="btn" data-act="rtsPdfOpen">${ic('print')}Visualizar</button>${window.npLevarBtn?npLevarBtn('rts'):''}<button class="btn primary" data-act="rtsPdf">${ic('download')}Baixar PDF</button></div></div></div>${conflict}${approvalBar(r)}${dl}
<fieldset class="rts-fs" ${lock?'disabled':''}>
<div class="panel"><h2>Dados do relatório</h2><div class="grid g4">${fx('Proposta nº','numero',r.numero,{keep:true,ph:'1135-26'})}${fx('Cliente','cliente',r.cliente,{cls:'sp2'})}${fx('Emissão','emissao',r.emissao,{type:'date'})}</div><div class="grid g4">${fx('Hora','hora',r.hora,{type:'time'})}${fx('Elaborado por','elaboradoPor',r.elaboradoPor)}${fx('Prazo (data limite)','prazoData',r.prazoData,{type:'date'})}${fx('Finalidade (status do documento)','statusDoc',r.statusDoc,{list:'dl-sdoc'})}</div></div>
${window.cmpPanel?cmpPanel(r):''}<div class="panel"><h2>Produto</h2><div class="grid g4">${fx('Código','codigoProduto',r.codigoProduto,{keep:true})}${fx('Produto','produto',r.produto,{cls:'sp2',ph:'Ex.: VÁLVULA BORBOLETA DE DUPLO DISCO/SEDE – DN 2600'})}${fx('Quantidade','quantidade',r.quantidade,{keep:true})}</div>${models.length?`<div class="rts-model"><div class="field"><label for="rts-model">Carregar POS de um projeto</label><select id="rts-model"><option value="">Selecione o modelo…</option>${models.map(m=>`<option value="${esc(m.id)}" ${m.id===r.modeloId?'selected':''}>${esc(m.name)}${m.dn?' — DN '+esc(m.dn):''}</option>`).join('')}</select></div><button class="btn" data-act="rtsLoadModel">${ic('plus')}Carregar POS</button></div><p class="hint">Só adiciona as POS que ainda não estão na lista; nada do que você já escreveu é apagado.</p>`:''}</div>
<div class="panel"><h2>Objetivo</h2>${ta('Texto do objetivo','objetivo',r.objetivo,4)}${ta('Nota do local do serviço','notaLocal',r.notaLocal,2)}</div>
<div class="panel"><div class="ph-row"><div><h2>Seções adicionais</h2><p class="hint" style="margin:0">Textos livres entre o Objetivo e o Escopo (ex.: Relatório de Delineamento Contratual, “Serão demandados da Minc”). Linhas que começam com “- ” viram tópicos.</p></div><button class="btn" data-act="rtsLAdd" data-list="extras">${ic('plus')}Seção</button></div>${listBlock(r,'extras',{label:'Título da seção',rows:6})||'<p class="hint" style="margin-top:12px">Nenhuma seção adicional.</p>'}</div>
<div class="panel"><h2>Escopo — Conjunto geral</h2><div class="grid g2">${fx('Título da seção','geral.titulo',r.geral.titulo,{keep:true})}${fx('Subtítulo (válvula)','geral.sub',r.geral.sub)}</div>${actRows(r,'geral',nums)}<div class="actions"><button class="btn" data-act="rtsActAdd" data-list="geral">${ic('plus')}Etapa</button></div></div>
<div class="panel"><div class="ph-row"><div><h2>Escopo — Componentes (POS)</h2><p class="hint" style="margin:0">Marque a providência da POS e escolha, no balão, só as atividades que valem para esta válvula. Se o cliente mandou o laudo, importe-o: as POS, providências e atividades vêm do laudo.</p></div><div class="actions"><button class="btn" data-act="rtsLaudo">${ic('doc')}Importar laudo do cliente</button><button class="btn" data-act="rtsPosAdd">${ic('plus')}POS</button></div></div>${r.pos.length?r.pos.map((p,i)=>posCard(r,p,i,nums)).join(''):'<p class="hint" style="margin-top:12px">Nenhuma POS. Adicione manualmente ou carregue de um projeto (em Produto).</p>'}</div>
<div class="panel"><h2>Escopo — Montagem, testes e pintura</h2>${fx('Título da seção','montagem.titulo',r.montagem.titulo,{keep:true})}${actRows(r,'mont',nums)}<div class="actions rts-addrow">${sug.length?`<select aria-label="Adicionar teste sugerido" data-chg="rtsTeste"><option value="">+ Testes e comissionamento sugeridos…</option>${sug.map(t=>`<option value="${esc(t)}">${esc(t.length>90?t.slice(0,87)+'…':t)}</option>`).join('')}</select>`:''}<button class="btn" data-act="rtsActAdd" data-list="mont">${ic('plus')}Etapa</button></div>${ta('Nota de embalagem (opcional)','notaEmbalagem',r.notaEmbalagem,3)}</div>
<div class="panel"><div class="ph-row"><div><h2>Observações técnicas</h2><p class="hint" style="margin:0">Escolha da biblioteca o que vale para este cliente; edite o texto à vontade. A numeração (Obs.1, Obs.2…) é automática.</p></div><div class="actions rts-addrow">${obsLib.length?`<select aria-label="Adicionar observação da biblioteca" data-chg="rtsObsLib"><option value="">+ Da biblioteca…</option>${obsLib.map(o=>`<option value="${OBSB().indexOf(o)}">${esc(o.nome)}</option>`).join('')}</select>`:''}<button class="btn" data-act="rtsLAdd" data-list="observacoes">${ic('plus')}Em branco</button></div></div>${listBlock(r,'observacoes',{label:'Título',rows:4})||'<p class="hint" style="margin-top:12px">Nenhuma observação.</p>'}</div>
<div class="panel"><h2>Cronograma, validade e garantia</h2><div class="grid g4">${fx('Prazo estimado (dias)','prazoDias',r.prazoDias,{keep:true,ph:'90'})}${fx('Contado','prazoRef',r.prazoRef,{cls:'sp2',list:'dl-pref'})}</div>${ta('Validade da proposta','validade',r.validade,2)}<div class="field"><label for="rts-gar">Termo de garantia — modelo</label><select id="rts-gar" data-chg="rtsGar"><option value="">Escolher modelo…</option>${GAR().map((g,i)=>`<option value="${i}">${esc(g.nome)}</option>`).join('')}</select></div>${ta('Texto da garantia','garantia',r.garantia,5)}</div>
<div class="panel"><div class="ph-row"><div><h2>Anexos</h2><p class="hint" style="margin:0">Imagens de recebimento/peritagem, desenhos de referência e a lista de materiais. Entram numerados (Anexo 01, 02…) no PDF.</p></div><div class="actions"><button class="btn" data-act="rtsAxAdd" data-t="imagens">${ic('camera')}Anexo de imagens</button>${hasMat?'':`<button class="btn" data-act="rtsAxAdd" data-t="materiais">${ic('plus')}Lista de materiais</button>`}</div></div>${r.anexos.map((a,i)=>anexoCard(r,a,i)).join('')||'<p class="hint" style="margin-top:12px">Nenhum anexo.</p>'}</div>
</fieldset>
<div class="actions end rts-foot"><button class="btn danger" data-act="rtsDel">${ic('trash')}Excluir RTS</button><button class="btn" data-act="rtsDup">Duplicar</button><button class="btn primary" data-act="rtsPdf">${ic('download')}Baixar PDF</button></div></div>`;
};

/* ============================== Ações ============================== */
const openR=id=>{closeBalloon();S.rtsId=id;S.screen='rtsEdit';S.anim='up';render();scrollTo(0,0);
  const r=RTS.find(x=>x.id===id);if(r)Photos.load(r.id).then(()=>{if(S.screen==='rtsEdit'&&S.rtsId===id&&rtsImgRefs(r).length)renderMain()}).catch(()=>{})};
const hasProv=(p,v)=>p.provs.includes(v);
/* ---- balão flutuante de atividades: checklist organizado; o funcionário marca o que vale e nada entra sozinho ---- */
let BAL=null;
function closeBalloon(){if(!BAL)return;BAL.el.remove();document.removeEventListener('keydown',BAL.key,true);document.removeEventListener('pointerdown',BAL.out,true);BAL=null}
const fold3=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function openBalloon(anchor,pid){
  closeBalloon();
  const r=curR(),p=r&&r.pos.find(x=>x.id===pid);if(!p||locked(r))return;
  const groups=libGroups(r,p);
  if(!groups.length){toast(p.provs.length?'Todas as atividades sugeridas já estão na lista. Use “+ Atividade” para escrever outra.':'Escolha a providência acima ou use “+ Atividade”.');return}
  const el=document.createElement('div');el.className='rts-bal';el.setAttribute('role','dialog');el.setAttribute('aria-label','Escolher atividades');
  el.innerHTML=`<div class="rts-bal-h"><div><b>${esc(posHeading(p,r))}</b><small>Marque o que se aplica a esta válvula. Nada entra sozinho.</small></div><button type="button" class="iconb" data-bal="close" aria-label="Fechar">✕</button></div><input type="search" class="rts-bal-q" placeholder="Filtrar atividades…" aria-label="Filtrar atividades" data-keep-case autocomplete="off"><div class="rts-bal-b">${groups.map(([t,l],gi)=>`<details class="rts-bal-g" ${gi===0?'open':''}><summary>${esc(t)} <span class="muted">(${l.length})</span></summary>${l.map((x,i)=>`<label class="rts-bal-i"><input type="checkbox" data-gi="${gi}" data-i="${i}"><span>${esc(x)}</span></label>`).join('')}</details>`).join('')}</div><div class="rts-bal-f"><button type="button" class="btn ghost" data-bal="clear">Limpar</button><button type="button" class="btn primary" data-bal="add" disabled>Adicionar</button></div>`;
  document.body.appendChild(el);
  const small=innerWidth<720;
  if(small)el.classList.add('sheet');
  else{
    const ar=(anchor||document.body).getBoundingClientRect(),w=Math.min(580,innerWidth-16);
    el.style.width=w+'px';el.style.left=Math.max(8,Math.min(ar.left,innerWidth-w-8))+'px';
    const h=Math.min(540,innerHeight*.7);let top=ar.bottom+8;
    if(top+h>innerHeight-8)top=ar.top-h-8>=8?ar.top-h-8:Math.max(8,innerHeight-h-12);   // abaixo se couber; senão acima; senão encosta no rodapé
    el.style.top=top+'px';el.style.maxHeight=h+'px';
  }
  const add=el.querySelector('[data-bal="add"]'),count=()=>{const n=el.querySelectorAll('input[type=checkbox]:checked').length;add.disabled=!n;add.textContent=n?`Adicionar (${n})`:'Adicionar'};
  el.addEventListener('change',count);
  el.querySelector('.rts-bal-q').addEventListener('input',e=>{
    const q=fold3(e.target.value).trim();
    el.querySelectorAll('.rts-bal-i').forEach(l=>{l.hidden=!!q&&!fold3(l.textContent).includes(q)});
    el.querySelectorAll('.rts-bal-g').forEach(g=>{const any=[...g.querySelectorAll('.rts-bal-i')].some(l=>!l.hidden);g.hidden=!any;if(q&&any)g.open=true});
  });
  el.addEventListener('click',e=>{
    const b=e.target.closest('[data-bal]');if(!b)return;
    const k=b.dataset.bal;
    if(k==='close'){closeBalloon();return}
    if(k==='clear'){el.querySelectorAll('input[type=checkbox]').forEach(c=>c.checked=false);count();return}
    if(k==='add'){
      const r2=curR(),p2=r2&&r2.pos.find(x=>x.id===pid);if(!p2||locked(r2)){closeBalloon();return}
      const have=new Set(p2.atividades.map(a=>a.t));let n=0;
      el.querySelectorAll('input[type=checkbox]:checked').forEach(c=>{const t=groups[+c.dataset.gi][1][+c.dataset.i];if(!have.has(t)){p2.atividades.push(act(t));have.add(t);n++}});
      closeBalloon();if(n){touchR(r2);renderMain();toast(`${plural(n,'atividade adicionada','atividades adicionadas')}.`)}
    }
  });
  BAL={el,key:e=>{if(e.key==='Escape'){e.stopPropagation();closeBalloon()}},out:e=>{if(!el.contains(e.target)&&!e.target.closest('[data-act="rtsProv"],[data-act="rtsPick"]'))closeBalloon()}};
  document.addEventListener('keydown',BAL.key,true);document.addEventListener('pointerdown',BAL.out,true);
  setTimeout(()=>{const f=el.querySelector('.rts-bal-i input');f&&!small&&f.focus()},0);
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

/* ---- importação do laudo/documentos do cliente (leitura em laudo.js) ---- */
const lineSent=l=>/^[-–•]\s*/.test(l)?'- '+RtsLaudo.sentence(l.replace(/^[-–•]\s*/,'')):RtsLaudo.sentence(l);
/* assunto de uma observação (para trocar a padrão da MINC pela do laudo quando o assunto é o mesmo) */
function obsKey(t){
  const f=fold3(t).replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  if(/data ?book/.test(f))return'databook';if(/identific/.test(f))return'ident';if(/embal/.test(f))return'embal';if(/devol/.test(f))return'devol';
  if(/teste/.test(f))return'teste';if(/pintura/.test(f))return'pint';if(/mao de obra/.test(f))return'mdo';return'';
}
function laudoResumo(lp){
  const comps=lp.itens.flatMap(i=>i.comps),cnt={};comps.forEach(c=>cnt[c.prov]=(cnt[c.prov]||0)+1);
  return {comps:comps.length,itens:lp.itens.filter(i=>i.comps.length).length,cnt,obs:lp.obsGerais.length};
}
function laudoPreview(r,plan){
  const li=plan.map(p=>{
    if(p.kind==='laudo'){const x=laudoResumo(p.lp),prov=Object.entries(x.cnt).map(([k,v])=>`${v} ${k.toLowerCase()}`).join(', ');
      return `<li><b>${esc(p.d.name)}</b> — laudo ${esc(p.lp.numero||'')}${p.lp.cliente?' · '+esc(p.lp.cliente):''}${p.lp.tag?' · TAG '+esc(p.lp.tag):''}: <b>${plural(x.comps,'POS','POS')}</b> em ${plural(x.itens,'item','itens')} (${esc(prov)}); ${plural(x.obs,'observação geral','observações gerais')}.</li>`}
    if(p.kind==='img')return `<li><b>${esc(p.d.name)}</b> — sem texto (desenho escaneado): ${plural(p.d.images.length,'imagem entra','imagens entram')} como anexo.</li>`;
    return `<li><b>${esc(p.d.name)}</b> — texto de instruções (${p.text.length} caracteres): vira uma observação técnica.</li>`;
  }).join('');
  const has=k=>plan.some(p=>p.kind===k);
  return `<ul class="rts-lg-list">${li}</ul>${has('laudo')?`<label class="rts-lg-o"><input type="checkbox" name="o-pos" checked> Criar as POS do laudo (com providência, quantidade e atividades)</label><label class="rts-lg-o"><input type="checkbox" name="o-obs" checked> Criar as observações gerais do laudo (data-book, identificação, embalagem, testes…)</label><label class="rts-lg-o"><input type="checkbox" name="o-subst" checked> Trocar as observações padrão da MINC pelas do laudo quando tratam do mesmo assunto (o laudo do cliente manda)</label><label class="rts-lg-o"><input type="checkbox" name="o-ficha" checked> Criar a seção com os dados do equipamento do laudo</label>`:''}<p class="hint" style="margin-top:8px">POS que já existem no RTS (mesmo nº e nome) são mantidas como estão.</p>`;
}
async function applyLaudo(r,plan,o){
  const out={pos:0,ja:0,obs:0,extras:0,imgs:0,subst:0};
  const have=new Set(r.pos.map(p=>String(p.pos).trim().toUpperCase()+'|'+String(p.nome).trim().toUpperCase()));
  for(const it of plan){
    if(it.kind==='laudo'){
      const lp=it.lp,prim=lp.itens.find(x=>x.comps.length)||lp.itens[0];
      if(emp(r.cliente)&&lp.cliente)r.cliente=lp.cliente;
      if(emp(r.produto)&&prim)r.produto=[prim.desc,lp.tag?'TAG '+lp.tag:''].filter(Boolean).join(' – ');
      if(emp(r.geral.sub)&&!emp(r.produto))r.geral.sub=r.produto;
      if(o.ficha){
        const linhas=[lp.numero&&`Laudo nº ${lp.numero}${lp.cliente?' ('+lp.cliente+')':''}`,lp.tag&&`TAG: ${lp.tag}`,lp.tecnico&&`Técnico responsável: ${lp.tecnico}`,'',...lp.itens.map(i=>`- Item ${i.n}: ${i.desc}${i.avaria?' — avaria: '+RtsLaudo.sentence(i.avaria):''}${i.recup?' — '+RtsLaudo.sentence(i.recup):''}${i.qtd?' — qtd. '+i.qtd:''}`),'',lp.ficha.split('\n').map(lineSent).join('\n')].filter(x=>typeof x==='string');
        r.extras.push({id:uid('RE'),titulo:`DADOS DO EQUIPAMENTO — LAUDO ${lp.cliente||'DO CLIENTE'} Nº ${lp.numero||''}`.trim(),texto:linhas.join('\n').replace(/\n{3,}/g,'\n\n').trim()});out.extras++;
      }
      if(o.pos){
        const multi=lp.itens.filter(x=>x.comps.length).length>1;
        for(const item of lp.itens)for(const c of item.comps){
          const pos=multi?`${item.n}.${c.nn}`:c.nn,nome=c.nome.toUpperCase(),k=pos.toUpperCase()+'|'+nome;
          if(have.has(k)){out.ja++;continue}have.add(k);
          r.pos.push({id:uid('RP'),pos,nome,qtd:c.qtd,unid:c.unid,provs:c.prov?[c.prov]:[],titulo:'',atividades:c.acts.map(a=>act(a.t)),nota:'',laudo:`laudo ${lp.numero||''} · item ${item.n} (${item.desc||''}) · nº ${c.nn}`.replace(/\s+/g,' ').trim()});out.pos++;
        }
      }
      if(o.obs){
        const keys=new Set(lp.obsGerais.map(x=>obsKey(x.titulo)).filter(Boolean));
        if(o.subst){const before=r.observacoes.length;r.observacoes=r.observacoes.filter(x=>!keys.has(obsKey(x.titulo)));out.subst+=before-r.observacoes.length}
        for(const ob of lp.obsGerais){r.observacoes.push({id:uid('RO'),titulo:ob.titulo,texto:ob.texto.split('\n').map(lineSent).join('\n')});out.obs++}
      }
    }else if(it.kind==='text'){
      r.observacoes.push({id:uid('RO'),titulo:`Instruções do cliente — ${it.d.name.replace(/\.pdf$/i,'')}`.slice(0,120),texto:it.text.split('\n').map(lineSent).join('\n')});out.obs++;
    }else{
      const a={id:uid('RX'),titulo:`Desenho do cliente — ${it.d.name.replace(/\.pdf$/i,'')}`.slice(0,120),tipo:'imagens',layout:'cheia',itens:[]};
      for(const im of it.d.images){const id=uid('IMG');
        await Store.put('photos',{id,procId:r.id,blob:im.blob,name:im.name,at:Date.now()});Photos.urls.set(id,URL.createObjectURL(im.blob));
        a.itens.push({id:uid('RI'),img:{id,name:im.name},descricao:'',status:'',obs:''});out.imgs++}
      r.anexos.push(a);
    }
  }
  return out;
}
const swap=(a,i,j)=>{if(j<0||j>=a.length)return false;[a[i],a[j]]=[a[j],a[i]];return true};
const clearApproval=r=>{r.aprovadoPor='';r.aprovadoEm='';r.aprovadoPorId='';r.enviadoPor='';r.enviadoEm=''};
const need=(r,msg)=>{if(locked(r)){toast(msg||'RTS travado: reabra para edição.');return false}return true};
Object.assign(MX.act,{
  rtsHome(){
    closeBalloon();
    if(window.Settings&&!Settings.rtsOn()){toast('A aba RTS está desligada. O administrador liga em Administração > Configurações.');return}
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
  async rtsDup(){
    const r=curR();if(!r)return;
    const c=JSON.parse(JSON.stringify(r));
    for(const k of Object.keys(c))if(k.startsWith('_'))delete c[k];
    const n=newRts({});Object.assign(c,{id:n.id,createdAt:n.createdAt,updatedAt:n.updatedAt,createdBy:n.createdBy,updatedBy:n.updatedBy,status:S_RAS,numero:'',emissao:today(),hora:nowHM(),elaboradoPor:S.user?.name||c.elaboradoPor,motivoDevolucao:'',devolvidoPor:''});
    clearApproval(c);delete c.deletedAt;
    const idMap=new Map(),nid=(old,p)=>{const v=uid(p);idMap.set(old,v);return v};   // novos ids: nada repete id do RTS de origem
    c.geral.etapas.forEach(a=>a.id=nid(a.id,'RA'));c.montagem.etapas.forEach(a=>a.id=nid(a.id,'RA'));
    c.pos.forEach(p=>{p.id=nid(p.id,'RP');p.atividades.forEach(a=>a.id=nid(a.id,'RA'))});
    c.materiais.forEach(m=>{m.id=uid('RM');if(m.fromPos)m.fromPos=idMap.get(m.fromPos)||m.fromPos});
    c.extras.forEach(x=>x.id=uid('RE'));c.observacoes.forEach(x=>x.id=uid('RO'));
    for(const a of c.anexos){a.id=uid('RX');for(const it of a.itens){it.id=uid('RI');if(it.img){   // copia o arquivo da imagem
      const src=await Store.get('photos',it.img.id).catch(()=>null),id=uid('IMG');
      if(src){await Store.put('photos',{id,procId:c.id,blob:src.blob,name:src.name,at:Date.now()});Photos.urls.set(id,URL.createObjectURL(src.blob));it.img={id,name:it.img.name}}else it.img=null}}}
    const d=normRts(c);d._dirty=true;RTS.unshift(d);RtsStore.put(d);openR(d.id);
    toast('RTS duplicado. Informe o número da nova proposta.');
  },
  async rtsDel(){
    const r=curR();if(!r)return;
    if(!await ask({title:`Excluir o RTS ${r.numero||'sem número'}?`,body:'Ele sai da lista. Dá para desfazer logo após excluir.',ok:'Excluir',danger:true}))return;
    r.deletedAt=new Date().toISOString();touchR(r);S.screen='rts';render();scrollTo(0,0);
    toast('RTS excluído.',{label:'Desfazer',ms:7000,action:()=>{delete r.deletedAt;touchR(r);if(S.screen==='rts')renderMain()}});
  },
  /* ---- aprovação ---- */
  rtsSubmit(){
    const r=curR();if(!r)return;
    const miss=[emp(r.numero)&&'Proposta nº',emp(r.cliente)&&'Cliente',emp(r.produto)&&'Produto',emp(r.objetivo)&&'Objetivo',!r.pos.length&&!r.geral.etapas.length&&'Escopo'].filter(Boolean);
    if(miss.length){toast('Falta preencher: '+miss.join(', ')+'.',{ms:6000});return}
    r.status=S_AGU;r.enviadoPor=S.user?.name||'';r.enviadoEm=new Date().toISOString();r.motivoDevolucao='';r.devolvidoPor='';
    touchR(r);renderMain();scrollTo(0,0);toast('Enviado para aprovação.');
  },
  async rtsApprove(){
    const r=curR();if(!r)return;
    if(!isAdminU()){toast('Só o administrador ou o gestor aprova.');return}
    if(!await ask({title:`Aprovar e liberar o RTS ${r.numero||''}?`,body:`O PDF passará a sair com “Aprovado por ${S.user?.name||''}” e a data de agora. Para alterar depois, será preciso reabrir e aprovar de novo.`,ok:'Aprovar e liberar'}))return;
    r.status=S_APR;r.aprovadoPor=S.user?.name||'';r.aprovadoPorId=S.user?.id||'';r.aprovadoEm=new Date().toISOString();r.motivoDevolucao='';
    touchR(r);renderMain();toast('RTS aprovado.');
  },
  rtsReturn(){
    const r=curR();if(!r)return;
    if(!isAdminU()){toast('Só o administrador ou o gestor devolve para ajustes.');return}
    dialog(`<form class="dlg-body" data-submit="rtsReturn"><h2>Devolver para ajustes</h2><p>O RTS volta a rascunho e quem elaborou vê o motivo.</p><div class="field"><label for="rr-m">O que precisa ser ajustado</label><textarea id="rr-m" name="motivo" rows="4" data-keep-case required autofocus></textarea></div><div class="actions end"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit">Devolver</button></div></form>`);
  },
  async rtsReopen(){
    const r=curR();if(!r)return;
    const ap=r.status===S_APR;
    if(!await ask({title:'Reabrir para edição?',body:ap?'A aprovação atual será perdida e o RTS precisará ser enviado e aprovado de novo.':'O envio para aprovação é cancelado e o RTS volta a rascunho.',ok:'Reabrir'}))return;
    r.status=S_RAS;clearApproval(r);touchR(r);renderMain();toast('RTS reaberto como rascunho.');
  },
  rtsLoadModel(){
    const r=curR(),id=document.getElementById('rts-model')?.value,m=id&&Models.get(id);
    if(!need(r))return;if(!m){toast('Escolha o modelo.');return}
    const n=loadModelPos(r,m);touchR(r);renderMain();
    toast(n?`${plural(n,'POS carregada','POS carregadas')} do projeto.`:'Todas as POS deste projeto já estão na lista.');
  },
  rtsLaudo(){
    const r=curR();if(!need(r))return;
    dialog(`<form class="dlg-body" data-submit="rtsLaudo" data-step="0"><h2>Importar documentos do cliente</h2><p>Escolha o <b>laudo</b> (PDF) e, se vierem junto, as <b>instruções ao fornecedor</b> e o <b>desenho</b>. O laudo é lido e vira POS (com providência, quantidade e atividades do próprio laudo), observações e dados do equipamento. Desenho escaneado entra como anexo de imagem. Nada do que já está no RTS é apagado.</p><div class="field"><label for="lg-f">Arquivos PDF</label><input id="lg-f" name="f" type="file" accept=".pdf,application/pdf" multiple required></div><div id="lg-prev" class="hint" aria-live="polite"></div><div class="actions end"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit" id="lg-go">Ler documentos</button></div></form>`);
  },
  rtsPosAdd(){const r=curR();if(!need(r))return;r.pos.push({id:uid('RP'),pos:'',nome:'',qtd:'',unid:'',provs:[],titulo:'',atividades:[],nota:''});touchR(r);renderMain();const n=document.getElementById('pp-'+r.pos[r.pos.length-1].id);n&&n.focus()},
  rtsPosRm(el){
    const r=curR();if(!need(r))return;const i=r.pos.findIndex(p=>p.id===el.dataset.id);if(i<0)return;
    const [gone]=r.pos.splice(i,1);touchR(r);renderMain();
    toast('POS removida.',{label:'Desfazer',ms:7000,action:()=>{r.pos.splice(i,0,gone);touchR(r);renderMain()}});
  },
  rtsPosMv(el){const r=curR();if(!need(r))return;const i=r.pos.findIndex(p=>p.id===el.dataset.id);if(swap(r.pos,i,i+ +el.dataset.dir)){touchR(r);renderMain()}},
  rtsProv(el){
    const r=curR(),p=r.pos.find(x=>x.id===el.dataset.id),v=el.dataset.v;if(!p||!need(r))return;
    if(hasProv(p,v)){p.provs=p.provs.filter(x=>x!==v);touchR(r);closeBalloon();renderMain();return}
    p.provs=PROVS().filter(x=>x===v||hasProv(p,x));touchR(r);renderMain();
    openBalloon(document.getElementById('prov-'+p.id),p.id);   // abre o balão para o funcionário escolher; nada é incluído sozinho
  },
  rtsPick(el){const r=curR();if(!need(r))return;openBalloon(el,el.dataset.id)},
  rtsActAdd(el){
    const r=curR();if(!need(r))return;const l=actList(r,el.dataset.list);if(!l)return;
    const a=act('');l.push(a);touchR(r);renderMain();
    const n=document.querySelector(`textarea[data-id="${a.id}"]`);n&&n.focus();
  },
  rtsActRm(el){
    const r=curR();if(!need(r))return;const l=actList(r,el.dataset.list);if(!l)return;
    const i=l.findIndex(a=>a.id===el.dataset.id);if(i<0)return;
    const [gone]=l.splice(i,1);touchR(r);renderMain();
    toast('Atividade removida.',{label:'Desfazer',ms:6000,action:()=>{l.splice(i,0,gone);touchR(r);renderMain()}});
  },
  rtsActMv(el){const r=curR();if(!need(r))return;const l=actList(r,el.dataset.list);if(!l)return;const i=l.findIndex(a=>a.id===el.dataset.id);if(swap(l,i,i+ +el.dataset.dir)){touchR(r);renderMain()}},
  /* listas livres: extras e observações */
  rtsLAdd(el){const r=curR();if(!need(r))return;const l=el.dataset.list,x={id:uid(l==='extras'?'RE':'RO'),titulo:'',texto:''};r[l].push(x);touchR(r);renderMain();const n=document.getElementById('b-'+x.id);n&&n.focus()},
  rtsLRm(el){
    const r=curR();if(!need(r))return;const arr=r[el.dataset.list],i=arr.findIndex(x=>x.id===el.dataset.id);if(i<0)return;
    const [gone]=arr.splice(i,1);touchR(r);renderMain();
    toast('Removido.',{label:'Desfazer',ms:6000,action:()=>{arr.splice(i,0,gone);touchR(r);renderMain()}});
  },
  rtsLMv(el){const r=curR();if(!need(r))return;const arr=r[el.dataset.list],i=arr.findIndex(x=>x.id===el.dataset.id);if(swap(arr,i,i+ +el.dataset.dir)){touchR(r);renderMain()}},
  /* materiais */
  rtsMatAdd(){const r=curR();if(!need(r))return;r.materiais.push({id:uid('RM'),desc:'',unid:'PÇ',qtd:'1'});touchR(r);renderMain()},
  rtsMatRm(el){const r=curR();if(!need(r))return;r.materiais=r.materiais.filter(m=>m.id!==el.dataset.id);touchR(r);renderMain()},
  rtsMatSync(){const r=curR();if(!need(r))return;const n=syncMats(r);touchR(r);renderMain();toast(n?`${plural(n,'item incluído','itens incluídos')} a partir das POS.`:'Nenhuma POS nova com Substituir ou Fabricar.')},
  /* anexos */
  rtsAxAdd(el){
    const r=curR();if(!need(r))return;const t=el.dataset.t;
    r.anexos.push({id:uid('RX'),titulo:t==='materiais'?'Lista de Materiais':'',tipo:t,layout:'lado',itens:[]});touchR(r);renderMain();
    const a=r.anexos[r.anexos.length-1],n=document.getElementById('ax-'+a.id);n&&n.focus();
  },
  async rtsAxRm(el){
    const r=curR();if(!need(r))return;const i=r.anexos.findIndex(a=>a.id===el.dataset.aid);if(i<0)return;
    const a=r.anexos[i];
    if((a.itens.length||a.tipo==='materiais'&&r.materiais.length)&&!await ask({title:'Remover o anexo?',body:a.tipo==='materiais'?'A lista de materiais sai do PDF (os itens continuam gravados no RTS e voltam se você incluir a lista de novo).':`As ${plural(a.itens.length,'imagem','imagens')} deste anexo serão apagadas.`,ok:'Remover',danger:true}))return;
    for(const it of a.itens)if(it.img)await dropImg(r,it.img);
    r.anexos.splice(i,1);touchR(r);renderMain();
  },
  rtsAxMv(el){const r=curR();if(!need(r))return;const i=r.anexos.findIndex(a=>a.id===el.dataset.aid);if(swap(r.anexos,i,i+ +el.dataset.dir)){touchR(r);renderMain()}},
  rtsImgAdd(el){
    const r=curR();if(!need(r))return;const a=r.anexos.find(x=>x.id===el.dataset.aid);if(!a)return;
    const i=document.createElement('input');i.type='file';i.accept='image/*';i.multiple=true;
    i.onchange=async()=>{
      const files=[...i.files];if(!files.length)return;
      const t=toast(`Processando ${plural(files.length,'imagem','imagens')}…`,{ms:120000});let ok=0,fail=0;
      for(const f of files){
        try{const blob=await toBlob(f),id=uid('IMG');
          await Store.put('photos',{id,procId:r.id,blob,name:f.name||'imagem.jpg',at:Date.now()});
          Photos.urls.set(id,URL.createObjectURL(blob));
          a.itens.push({id:uid('RI'),img:{id,name:f.name||'imagem.jpg'},descricao:'',status:'',obs:''});ok++}
        catch(e){console.error(e);fail++}
      }
      t.close();if(ok)touchR(r);renderMain();
      toast(`${ok?plural(ok,'imagem adicionada','imagens adicionadas'):'Nenhuma imagem adicionada'}${fail?`; ${plural(fail,'arquivo não entrou','arquivos não entraram')}`:''}.`);
    };
    i.click();
  },
  async rtsImgRm(el){
    const r=curR();if(!need(r))return;const a=r.anexos.find(x=>x.id===el.dataset.aid);if(!a)return;
    const i=a.itens.findIndex(x=>x.id===el.dataset.id);if(i<0)return;
    const [it]=a.itens.splice(i,1);if(it.img)await dropImg(r,it.img);
    touchR(r);renderMain();toast('Imagem removida.');
  },
  /* conflito de sincronização */
  async rtsUseCloud(){
    const r=curR();if(!r||!r._conflict)return;
    const n=fromRowR(r._conflict);Object.keys(r).forEach(k=>delete r[k]);Object.assign(r,n);await RtsStore.put(r);renderMain();toast('Versão da nuvem carregada.');
  },
  async rtsKeepMine(){
    const r=curR();if(!r||!r._conflict)return;
    r._rev=r._conflict.rev;r._conflict=null;touchR(r);renderMain();toast('Sua versão será enviada.');
  },
  /* PDF */
  async rtsPdf(el){
    const b=el.closest?.('button')||el;b.setAttribute?.('aria-busy','true');
    try{const r=curR(),out=await buildRtsPdf(r);saveBytes(out.bytes,out.fileName);toast(r.status===S_APR?'PDF gerado.':'PDF gerado com marca de “não aprovado”.')}catch(e){console.error(e);toast('Não foi possível gerar o PDF.')}
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
  async rtsLaudo(f){
    const go=f.querySelector('#lg-go'),prev=f.querySelector('#lg-prev'),files=[...f.elements.f.files],r=curR();
    if(!files.length){prev.textContent='Escolha o(s) arquivo(s).';return}
    if(!r||locked(r))return;
    go.setAttribute('aria-busy','true');
    try{
      if(f.dataset.step==='0'){
        if(!window.RtsLaudo)throw new Error('O leitor de laudo não carregou. Recarregue a página.');
        prev.textContent='Lendo os documentos…';
        const plan=[];
        for(const file of files){
          const d=await RtsLaudo.readPdf(file);
          if(d.images.length){plan.push({kind:'img',d});continue}
          const lp=RtsLaudo.parse(d.lines);
          if(lp.eLaudo&&lp.itens.length)plan.push({kind:'laudo',d,lp});
          else{const text=RtsLaudo.freeText(d.lines);if(text)plan.push({kind:'text',d,text});else prev.textContent=`Não achei texto em “${file.name}”.`}
        }
        if(!plan.length){prev.textContent='Nenhum conteúdo reconhecido nos arquivos.';return}
        f._plan=plan;f.dataset.step='1';prev.innerHTML=laudoPreview(r,plan);go.textContent='Importar para o RTS';
        f.elements.f.addEventListener('change',()=>{f.dataset.step='0';go.textContent='Ler documentos';prev.textContent='';f._plan=null},{once:true});
        return;
      }
      const e=f.elements,o={pos:!e['o-pos']||e['o-pos'].checked,obs:!e['o-obs']||e['o-obs'].checked,ficha:!e['o-ficha']||e['o-ficha'].checked,subst:!e['o-subst']||e['o-subst'].checked};
      const n=await applyLaudo(r,f._plan||[],o);
      touchR(r);closeDialog(f.closest('dialog'));renderMain();
      toast([n.pos&&plural(n.pos,'POS criada','POS criadas'),n.ja&&`${plural(n.ja,'POS já existia','POS já existiam')}`,n.obs&&plural(n.obs,'observação','observações'),n.subst&&`${plural(n.subst,'observação padrão trocada','observações padrão trocadas')}`,n.extras&&'dados do equipamento',n.imgs&&plural(n.imgs,'imagem de desenho','imagens de desenho')].filter(Boolean).join(' · ')+'.',{ms:7000});
    }catch(err){console.error(err);prev.textContent=err.message||'Não consegui ler o arquivo.'}
    finally{go.removeAttribute('aria-busy')}
  },
  rtsNew(f){
    const e=f.elements,mid=e.modelo?.value;
    const r=newRts({numero:e.numero.value.trim(),cliente:e.cliente.value.trim(),produto:e.produto.value.trim()});
    const m=mid&&window.Models&&Models.get(mid);if(m)loadModelPos(r,m);
    r.objetivo=objetivoPadrao(r);r._dirty=true;RTS.unshift(r);RtsStore.put(r);
    closeDialog(f.closest('dialog'));openR(r.id);
  },
  rtsReturn(f){
    const r=curR();if(!r||!isAdminU())return;
    const m=f.elements.motivo.value.trim();if(!m){toast('Descreva o ajuste necessário.');return}
    r.status=S_RAS;clearApproval(r);r.motivoDevolucao=m;r.devolvidoPor=S.user?.name||'';r.devolucoes=(+r.devolucoes||0)+1;   // contador para o painel de gestão
    touchR(r);closeDialog(f.closest('dialog'));renderMain();toast('RTS devolvido para ajustes.');
  }
});
Object.assign(MX.inp,{
  rtsQ(el){S.rtsQ=el.value;document.getElementById('rts-rows').innerHTML=rowsRts()},
  rtsF(el){const r=curR();if(!r||locked(r))return;setK(r,el.dataset.k,el.value);touchR(r);if(el.dataset.k==='numero'){const h=document.querySelector('.rts-edit h1');if(h&&h.firstChild)h.firstChild.textContent='RTS '+(r.numero||'(sem nº)')+' '}},
  rtsPos(el){
    const r=curR(),p=r?.pos.find(x=>x.id===el.dataset.id);if(!p||locked(r))return;p[el.dataset.k]=el.value;touchR(r);
    const pv=document.querySelector(`[data-prev="${CSS.escape(p.id)}"]`);if(pv)pv.textContent=posHeading(p,r);
  },
  rtsAct(el){const r=curR();if(!r||locked(r))return;const l=actList(r,el.dataset.list),a=l?.find(x=>x.id===el.dataset.id);if(a){a.t=el.value;touchR(r)}},
  rtsMat(el){const r=curR(),m=r?.materiais.find(x=>x.id===el.dataset.id);if(m&&!locked(r)){m[el.dataset.k]=el.value;touchR(r)}},
  rtsList(el){const r=curR();if(!r||locked(r))return;const x=r[el.dataset.list]?.find(y=>y.id===el.dataset.id);if(x){x[el.dataset.k]=el.value;touchR(r)}},
  rtsAx(el){const r=curR();if(!r||locked(r))return;const a=r.anexos.find(x=>x.id===el.dataset.aid);if(a){a[el.dataset.k]=el.value;touchR(r)}},
  rtsAxIt(el){const r=curR();if(!r||locked(r))return;const it=r.anexos.find(x=>x.id===el.dataset.aid)?.itens.find(y=>y.id===el.dataset.id);if(it){it[el.dataset.k]=el.value;touchR(r)}}
});
Object.assign(MX.chg,{
  rtsLib(el){
    if(!el.value)return;const r=curR(),p=r.pos.find(x=>x.id===el.dataset.id);if(!p||!need(r))return;
    p.atividades.push(act(el.value));touchR(r);renderMain();
  },
  rtsTeste(el){if(!el.value)return;const r=curR();if(!need(r))return;r.montagem.etapas.splice(Math.max(0,r.montagem.etapas.length-2),0,act(el.value));touchR(r);renderMain()},
  rtsObsLib(el){const o=OBSB()[+el.value],r=curR();if(!o||!need(r))return;r.observacoes.push({id:uid('RO'),titulo:o.titulo,texto:o.texto});touchR(r);renderMain()},
  rtsGar(el){const g=GAR()[+el.value],r=curR();if(!g||!need(r))return;r.garantia=g.texto;touchR(r);renderMain()},
  rtsAxLayout(el){const r=curR();if(!need(r))return;const a=r.anexos.find(x=>x.id===el.dataset.aid);if(a){a.layout=el.value==='cheia'?'cheia':'lado';touchR(r)}}
});

/* ============================== PDF ============================== */
const rtsFileName=r=>['RTS',slug(r.numero)||'SEM-NUMERO',slug(r.cliente,20)||'CLIENTE',slug(r.produto,30)||'PRODUTO'].join('_')+(r.status===S_APR?'':'_RASCUNHO')+'.pdf';
/* imagem do anexo reduzida (1400 px) para o PDF; o arquivo original continua no aparelho */
async function imgData(id){
  const rec=await Store.get('photos',id).catch(()=>null);if(!rec||!rec.blob)return null;
  try{
    const bmp=await createImageBitmap(rec.blob),k=Math.min(1,1400/Math.max(bmp.width,bmp.height));
    const c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);bmp.close&&bmp.close();
    return{url:c.toDataURL('image/jpeg',.78),w:c.width,h:c.height};
  }catch{try{return{url:await blobToDataURL(rec.blob),w:4,h:3}}catch{return null}}
}
async function buildRtsPdf(r){
  await pdfLib();
  const F=FORM(),{jsPDF}=window.jspdf,logo=await logoForPdf();
  const M=15,W=210-2*M,TOP=40,BOT=297-27,LH=1.32;
  const pt=pdfTxt,approved=r.status===S_APR;
  const dateBR=v=>fmtISO(v)||'';
  const isoDay=v=>{const d=new Date(v);return isNaN(d)?'':d.toLocaleDateString('pt-BR')};
  /* carrega as imagens dos anexos uma vez */
  const imgs=new Map();
  for(const a of r.anexos)for(const it of a.itens)if(it.img&&!imgs.has(it.img.id))imgs.set(it.img.id,await imgData(it.img.id));
  const anexoNome=(a,i)=>`Anexo ${String(i+1).padStart(2,'0')} – ${a.titulo||(a.tipo==='materiais'?'Lista de Materiais':'Imagens')}`;
  /* monta o documento; tocPages = páginas reservadas ao sumário (descoberto na 1ª passada) */
  function render(tocPages){
    const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
    doc.setProperties({title:pt(`${F.titulo} - ${r.numero||''}`),subject:pt(r.produto||''),author:pt(S.user?.name||''),creator:'MINC ServiceHub'});
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
    /* texto livre: linhas que começam com "- " viram tópicos; linhas em branco separam parágrafos */
    const rich=(txt,indent=3)=>{
      String(txt||'-').split(/\r?\n/).forEach(raw=>{
        const line=raw.trim();
        if(!line){y+=1.6;return}
        const m=/^[-•*]\s+(.*)$/.exec(line);
        if(!m){para(line,{indent,gap:.9});return}
        doc.setFont('helvetica','normal');doc.setFontSize(10);doc.setTextColor(0);
        const lines=doc.splitTextToSize(pt(m[1]),W-indent-5),lh=lineH(10);
        lines.forEach((ln,i)=>{ensure(lh);if(i===0)doc.text('-',M+indent,y+lh*.78);doc.text(ln,M+indent+5,y+lh*.78);y+=lh});
        y+=.9;
      });
      y+=1.4;
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
    const tbl=(opts)=>{doc.autoTable({theme:'grid',styles:{font:'helvetica',fontSize:9,cellPadding:2,lineColor:[0,0,0],lineWidth:.2,textColor:[0,0,0],valign:'middle'},headStyles:{fillColor:[236,236,236],textColor:[0,0,0],fontStyle:'bold',lineWidth:.2,lineColor:[0,0,0]},margin:{left:M,right:M,top:TOP,bottom:27},...opts,startY:y});y=doc.lastAutoTable.finalY+4};
    const hd=t=>({content:t,styles:{fillColor:[236,236,236],fontStyle:'bold'}});
    /* --- capa --- */
    doc.setFont('helvetica','bold');doc.setFontSize(30);doc.setTextColor(0);
    doc.text('Relatório Técnico de',105,120,{align:'center'});doc.text('Serviços',105,134,{align:'center'});
    doc.autoTable({theme:'grid',startY:196,styles:{font:'helvetica',fontSize:10,cellPadding:3,lineColor:[0,0,0],lineWidth:.3,textColor:[0,0,0],halign:'center',valign:'middle'},head:[['Proposta nº:','Elaborado por:','Aprovado por:','Data']],headStyles:{fillColor:[236,236,236],textColor:[0,0,0],fontStyle:'bold'},body:[[pt(r.numero||'-'),pt(r.elaboradoPor||'-'),pt(approved?(r.aprovadoPor||'-'):'PENDENTE DE APROVAÇÃO'),pt(approved?isoDay(r.aprovadoEm):'-')]],margin:{left:M,right:M}});
    /* --- páginas reservadas ao sumário --- */
    for(let i=0;i<tocPages;i++)doc.addPage();
    newPage();
    /* --- dados --- */
    heading('Dados do Relatório');
    tbl({body:[[{content:'CLIENTE',colSpan:3,styles:hd('').styles},{content:'PRAZO',colSpan:2,styles:hd('').styles}],[{content:pt(r.cliente||'-'),colSpan:3},{content:pt(dateBR(r.prazoData)||'-'),colSpan:2}],[hd('Nº'),hd('EMISSÃO'),hd('HORA'),hd('ELABORADO POR:'),hd('STATUS')],[pt(r.numero||'-'),pt(dateBR(r.emissao)||'-'),pt(emp(r.hora)?'-':r.hora+' HS'),pt((r.elaboradoPor||'-').toUpperCase()),pt((r.statusDoc||'-').toUpperCase())]]});
    heading('Dados do Produto');
    tbl({head:[['CÓDIGO','PRODUTO','QUANTIDADE']],body:[[pt(r.codigoProduto||'-'),pt(r.produto||'-'),pt(r.quantidade||'-')]],columnStyles:{0:{cellWidth:32},2:{cellWidth:30,halign:'center'}}});
    heading('Objetivo');
    para(r.objetivo||'-',{gap:2.5});
    if(!emp(r.notaLocal)){doc.setFont('helvetica','bold');doc.setFontSize(10);const w=doc.getTextWidth('NOTA. ');ensure(lineH(10));doc.text('NOTA. ',M,y+lineH(10)*.78);doc.setFont('helvetica','normal');
      const lines=doc.splitTextToSize(pt(r.notaLocal),W-w);lines.forEach((ln,i)=>{if(i>0)ensure(lineH(10));doc.text(ln,M+(i===0?w:0),y+lineH(10)*.78);y+=lineH(10)});y+=2}
    for(const x of r.extras){heading(x.titulo||'Seção',{lvl:0});rich(x.texto,0)}
    /* --- escopo --- */
    const nums=numbering(r);
    heading('Descrição Técnica do Serviço');
    heading(r.geral.titulo,{lvl:1});
    if(!emp(r.geral.sub))para(r.geral.sub,{bold:true,gap:2});
    r.geral.etapas.filter(a=>!emp(a.t)).forEach(a=>numbered(nums.get(a.id),a.t));
    for(const p of r.pos){
      heading(posHeading(p,r),{lvl:1});
      p.atividades.filter(a=>!emp(a.t)).forEach(a=>numbered(nums.get(a.id),a.t));
      if(!emp(p.nota))para(/^(nota|aten)/i.test(p.nota.trim())?p.nota:'NOTA. '+p.nota,{indent:13,size:9.5,gap:2});
    }
    heading(r.montagem.titulo,{lvl:1});
    r.montagem.etapas.filter(a=>!emp(a.t)).forEach(a=>numbered(nums.get(a.id),a.t));
    if(!emp(r.notaEmbalagem))para('Nota. - '+r.notaEmbalagem,{bold:true,size:9,indent:13,gap:2});
    /* --- observações --- */
    if(r.observacoes.length){
      heading('Observações Técnicas');
      r.observacoes.forEach((o,i)=>{heading(`(Obs.${i+1}) ${o.titulo||''}`.trim().toUpperCase(),{lvl:1});rich(o.texto)});
    }
    heading('Cronograma');
    para(emp(r.prazoDias)?'Prazo estimado: a definir.':`Prazo Estimado: ${r.prazoDias} dias${emp(r.prazoRef)?'':', '+r.prazoRef}.`,{gap:3});
    if(!emp(r.validade)){heading('Validade',{inToc:false});para(r.validade,{gap:3})}
    if(r.anexos.length){
      heading('Anexos',{lvl:1,inToc:false});
      r.anexos.forEach((a,i)=>para(anexoNome(a,i)+'.',{gap:.8}));y+=2;
    }
    /* --- anexos --- */
    r.anexos.forEach((a,i)=>{
      newPage();
      heading(anexoNome(a,i));
      if(a.tipo==='materiais'){
        const mats=r.materiais.filter(m=>!emp(m.desc));
        tbl({head:[[{content:'ITEM',styles:{halign:'center'}},'DESCRIÇÃO',{content:'UNID',styles:{halign:'center'}},{content:'QTD',styles:{halign:'center'}}]],body:mats.length?mats.map((m,k)=>[String(k+1),pt(String(m.desc).toUpperCase()),pt(m.unid||'-'),pt(m.qtd||'-')]):[[{content:'Sem itens.',colSpan:4,styles:{halign:'center'}}]],columnStyles:{0:{cellWidth:16,halign:'center'},2:{cellWidth:20,halign:'center'},3:{cellWidth:20,halign:'center'}}});
        return;
      }
      if(!a.itens.length){para('Sem imagens.',{gap:2});return}
      const caption=it=>[it.descricao&&`Descrição: ${it.descricao}`,it.status&&`Status: ${it.status}`].filter(Boolean).join('\n\n');
      if(a.layout==='cheia'){
        for(const it of a.itens){
          const d=it.img&&imgs.get(it.img.id);
          const maxH=BOT-TOP-24;let w=W,h=0;
          if(d){h=w*d.h/d.w;if(h>maxH){h=maxH;w=h*d.w/d.h}}
          ensure((d?h:10)+12);
          if(d){try{doc.addImage(d.url,'JPEG',M+(W-w)/2,y,w,h)}catch(e){console.error('imagem no PDF',e)}doc.setDrawColor(0);doc.setLineWidth(.3);doc.rect(M+(W-w)/2,y,w,h);y+=h+2}
          const c=caption(it);if(c)para(c,{size:9,gap:4});else y+=3;
        }
      }else{
        const body=a.itens.map(it=>['',pt(caption(it)||'-')]);
        doc.autoTable({theme:'grid',startY:y,styles:{font:'helvetica',fontSize:9,cellPadding:3,lineColor:[0,0,0],lineWidth:.2,textColor:[0,0,0],valign:'middle',minCellHeight:56},body,columnStyles:{0:{cellWidth:78},1:{cellWidth:'auto'}},margin:{left:M,right:M,top:TOP,bottom:27},rowPageBreak:'avoid',
          didDrawCell:data=>{
            if(data.section!=='body'||data.column.index!==0)return;
            const it=a.itens[data.row.index],d=it&&it.img&&imgs.get(it.img.id);if(!d)return;
            const pad=2,aw=data.cell.width-pad*2,ah=data.cell.height-pad*2,k=Math.min(aw/d.w,ah/d.h),w=d.w*k,h=d.h*k;
            try{doc.addImage(d.url,'JPEG',data.cell.x+(data.cell.width-w)/2,data.cell.y+(data.cell.height-h)/2,w,h)}catch(e){console.error('imagem no PDF',e)}
          }});
        y=doc.lastAutoTable.finalY+4;
      }
    });
    /* --- garantia --- */
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
  /* cabeçalho, rodapé e marca de "não aprovado" em todas as páginas */
  const n=doc.getNumberOfPages(),mark=r.status===S_AGU?'AGUARDANDO APROVAÇÃO':'RASCUNHO';
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
    if(!approved){   // marca d'água: documento ainda não aprovado no app
      try{doc.saveGraphicsState();doc.setGState(new doc.GState({opacity:.11}));doc.setTextColor(0);doc.setFont('helvetica','bold');doc.setFontSize(r.status===S_AGU?46:78);doc.text(pt(mark),105,160,{align:'center',angle:45});doc.restoreGraphicsState()}catch(e){console.error('marca d\'água',e)}
    }
  }
  return{bytes:doc.output('arraybuffer'),pages:n,fileName:rtsFileName(r)};
}
window.buildRtsPdf=buildRtsPdf;
window.RtsApi={cur:()=>curR(),touch:r=>touchR(r),locked:r=>locked(r)};   // usado pelo comparativo RTS x D.E
})();
