'use strict';
/* MINC · Peritagem — v5.8.0
   Organização: utilitários → Store (IndexedDB) → Fotos → Auth → Regras (validação) → Telas → Ações/eventos → Boot */

const APP_VERSION='5.8.0';

/* ============================== Utilitários ============================== */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const emp=v=>!String(v??'').trim();
const num=v=>parseFloat(String(v??'').replace(',','.'));
const uid=p=>p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
const withTimeout=(p,ms)=>Promise.race([p,new Promise((_,no)=>setTimeout(()=>no(new Error('timeout')),ms))]);
const fmt=iso=>{const d=new Date(iso);return isNaN(d)?'—':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})};
const fmtDay=iso=>{const d=new Date(iso);return isNaN(d)?'—':d.toLocaleDateString('pt-BR')};
const qAttr=s=>String(s).replace(/["\\]/g,'\\$&');
const wide=()=>window.matchMedia('(min-width:961px)').matches;
const RM=()=>!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);   // movimento reduzido

const IC={
  plus:'<path d="M12 5v14M5 12h14"/>',check:'<path d="M20 6 9 17l-5-5"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  back:'<path d="M19 12H5M12 19l-7-7 7-7"/>',next:'<path d="M5 12h14M12 5l7 7-7 7"/>',chev:'<path d="m6 9 6 6 6-6"/>',
  print:'<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  moon:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  alert:'<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  up:'<path d="m18 15-6-6-6 6"/>',
  doc:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>'
};
const ic=(n,c='ic')=>`<svg class="${c}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]||''}</svg>`;

const emptyMark=()=>`<div class="mark">${ic('doc','ic lg')}</div>`;

/* ============================== Avisos e diálogos ============================== */
function toast(msg,{label='Desfazer',action,ms=3200,onExpire}={}){
  const box=$('#toasts');if(!box)return{close(){}};
  const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');
  const s=document.createElement('span');s.textContent=msg;t.append(s);
  let timer,done=false;
  const close=()=>{if(done)return;done=true;clearTimeout(timer);if(RM()){t.remove();return}t.classList.add('out');setTimeout(()=>t.remove(),130)};
  if(action){
    const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{if(done)return;close();action()};t.append(b);
    const bar=document.createElement('i');bar.className='bar';bar.style.animationDuration=ms+'ms';t.append(bar);   // mostra quanto tempo resta para desfazer
  }
  box.append(t);
  timer=setTimeout(()=>{if(done)return;close();onExpire&&onExpire()},ms);
  return{close};
}
function closeDialog(d,val){if(!d||!d.open)return;if(RM()){d.close(val);return}d.classList.add('closing');setTimeout(()=>d.close(val),130)}
function dialog(html,{lock=false,cls=''}={}){
  const d=document.createElement('dialog');d.className='dlg '+cls;d.innerHTML=html;if(lock)d.dataset.lock='1';
  document.body.append(d);
  d.addEventListener('close',()=>d.remove());
  d.addEventListener('click',e=>{if(e.target===d&&!d.dataset.lock)closeDialog(d)});
  d.addEventListener('cancel',e=>{e.preventDefault();if(!lock)closeDialog(d)});
  d.showModal();return d;
}
function ask({title,body,ok='Confirmar',danger=false}){
  return new Promise(res=>{
    const d=dialog(`<div class="dlg-body"><h2>${esc(title)}</h2><p>${esc(body)}</p><div class="actions end"><button type="button" class="btn" data-v="no">Cancelar</button><button type="button" class="btn ${danger?'danger-solid':'primary'}" data-v="yes" autofocus>${esc(ok)}</button></div></div>`);
    d.querySelectorAll('button[data-v]').forEach(b=>b.addEventListener('click',()=>closeDialog(d,b.dataset.v)));
    d.addEventListener('close',()=>res(d.returnValue==='yes'));
  });
}

/* ============================== Armazenamento local (IndexedDB) ==============================
   Processos ficam na store "processes" (JSON leve). Fotos ficam na store "photos" como Blob,
   fora do JSON — por isso não existe mais o limite de ~5 MB do localStorage. */
const Store={
  db:null,
  async open(){
    // Se outra aba (versão antiga do app) está com o banco aberto, isso bloquearia a atualização de versão
    // indefinidamente. Damos 6 s de folga para esse caso normal e then desistimos (o app segue sem o banco local
    // nesta aba em vez de travar a tela de carregamento para sempre).
    try{await withTimeout(this._open(),6000)}catch(e){this.db=null;throw e}
  },
  _open(){return new Promise((ok,no)=>{
    if(!window.indexedDB)return no(new Error('no-idb'));
    const r=indexedDB.open('minc_peritagem',2);
    r.onupgradeneeded=()=>{const d=r.result,has=n=>d.objectStoreNames.contains(n);if(!has('processes'))d.createObjectStore('processes',{keyPath:'id'});if(!has('photos'))d.createObjectStore('photos',{keyPath:'id'}).createIndex('proc','procId');if(!has('docs'))d.createObjectStore('docs',{keyPath:'id'})};   // docs: PDFs gerados aguardando envio à nuvem
    r.onsuccess=()=>{this.db=r.result;this.db.onversionchange=()=>{this.db.close();this.db=null;toast('Este app foi atualizado em outra aba. Feche e abra esta aba de novo para continuar.',{ms:9000})};ok()};
    r.onerror=()=>no(r.error);r.onblocked=()=>no(new Error('blocked: outra aba está com o banco local aberto'));
  })},
  _r(req){return new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error)})},
  _w(store,fn){return new Promise((ok,no)=>{
    if(!this.db)return no(new Error('no-db'));
    const t=this.db.transaction(store,'readwrite');fn(t.objectStore(store));
    t.oncomplete=()=>ok();t.onerror=()=>no(t.error);t.onabort=()=>no(t.error||new Error('abort'));
  })},
  all(store){return this.db?this._r(this.db.transaction(store).objectStore(store).getAll()):Promise.resolve([])},
  get(store,k){return this.db?this._r(this.db.transaction(store).objectStore(store).get(k)):Promise.resolve(undefined)},
  put(store,v){return this._w(store,s=>s.put(v))},
  del(store,k){return this._w(store,s=>s.delete(k))},
  photosOf(pid){return this.db?this._r(this.db.transaction('photos').objectStore('photos').index('proc').getAll(pid)):Promise.resolve([])},
  photoKeys(){return this.db?this._r(this.db.transaction('photos').objectStore('photos').getAllKeys()):Promise.resolve([])}
};

/* Salvamento automático com debounce + indicador na barra superior */
const SAVE_TXT={saved:'Salvo neste aparelho',saving:'Salvando…',error:'Falha ao salvar'};
const Saver={
  timers:new Map(),state:'saved',warned:false,
  set(s){const was=this.state;this.state=s;const el=$('#savestate');if(el){el.dataset.s=s;el.lastElementChild.textContent=SAVE_TXT[s];if(s==='saved'&&was==='saving'&&!RM()){el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash')}}},
  queue(id){this.set('saving');clearTimeout(this.timers.get(id));this.timers.set(id,setTimeout(()=>this.flush(id),450))},
  async flush(id){
    clearTimeout(this.timers.get(id));this.timers.delete(id);
    const p=PROCS.find(x=>x.id===id);if(!p)return;
    try{await Store.put('processes',p);if(!this.timers.size)this.set('saved');Sync.kick()}
    catch(e){console.error(e);this.set('error');if(!this.warned){this.warned=true;toast('Não foi possível salvar neste aparelho. Verifique o espaço de armazenamento.',{ms:6000})}}
  },
  async flushAll(){await Promise.all([...this.timers.keys()].map(id=>this.flush(id)))}
};

/* ============================== Fotos ============================== */
const Photos={
  urls:new Map(),
  url(id){return this.urls.get(id)||''},
  async load(pid){for(const p of await Store.photosOf(pid))if(!this.urls.has(p.id))this.urls.set(p.id,URL.createObjectURL(p.blob))},
  async drop(id){
    const u=this.urls.get(id);if(u)URL.revokeObjectURL(u);this.urls.delete(id);
    if(CLOUD){const rec=await Store.get('photos',id).catch(()=>null);if(rec?.up)queuePhotoDelete(rec)}
    return Store.del('photos',id).catch(()=>{});
  }
};
async function toBlob(file){
  let bmp;
  try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}
  catch{bmp=await new Promise((ok,no)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);ok(im)};im.onerror=()=>{URL.revokeObjectURL(u);no(new Error('img'))};im.src=u})}
  const w0=bmp.width||bmp.naturalWidth,h0=bmp.height||bmp.naturalHeight,k=Math.min(1,1600/Math.max(w0,h0));
  const c=document.createElement('canvas');c.width=Math.round(w0*k);c.height=Math.round(h0*k);
  c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);bmp.close&&bmp.close();
  return new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error('blob')),'image/jpeg',.75));
}
const IMG_EXT=/\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)$/i,MAX_ANEXO=25*1024*1024;
const isImg=f=>/^image\//.test(f.type||'')||IMG_EXT.test(f.name||'');
const fileExt=n=>{const m=/\.([A-Za-z0-9]{1,8})$/.exec(n||'');return m?'.'+m[1].toLowerCase():''};
async function addPhotos(files,target){
  const r=cur(),list=[...files];if(!r||!list.length)return;
  const comp=target==='equip'?null:C(target);if(target!=='equip'&&!comp)return;
  const arr=comp?comp.photos:r.equipmentPhotos,anx=comp?comp.anexos:r.anexos;
  const t=toast(`Processando ${list.length} arquivo(s)…`,{ms:120000});
  let nf=0,na=0,fail=0,big=0;const newIds=[];
  for(const f of list){
    try{
      if(isImg(f)){const blob=await toBlob(f),id=uid('IMG');
        await Store.put('photos',{id,procId:r.id,blob,name:f.name||'foto.jpg',at:Date.now()});
        Photos.urls.set(id,URL.createObjectURL(blob));arr.push({id,name:f.name||'foto.jpg'});newIds.push(id);nf++}
      else{
        if(f.size>MAX_ANEXO){big++;continue}
        const id=uid('ANX'),ext=fileExt(f.name),type=f.type||'application/octet-stream';
        await Store.put('photos',{id,procId:r.id,blob:f,name:f.name||'arquivo'+ext,at:Date.now(),kind:'file',ext,type});
        Photos.urls.set(id,URL.createObjectURL(f));anx.push({id,name:f.name||'arquivo'+ext,type,size:f.size,ext});newIds.push('ax-'+id);na++}
    }catch(e){console.error(e);fail++}
  }
  t.close();changed(r);S.pulse=newIds.map(id=>/^ax-/.test(id)?id:'ph-'+id);renderMain();
  const parts=[nf&&`${nf} foto(s)`,na&&`${na} anexo(s)`].filter(Boolean);
  toast(parts.length?`${parts.join(' e ')} adicionado(s)${fail+big?`; ${fail+big} não entrou`:''}.`:(big?'Arquivo maior que 25 MB não foi adicionado.':'Não foi possível adicionar o arquivo.'));
}

/* ============================== Autenticação local ==============================
   Protege contra uso casual neste aparelho. Segurança real (perfis, auditoria) virá com o banco central. */
async function hashPw(pw,salt){
  if(window.crypto?.subtle){
    const enc=new TextEncoder(),key=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:100000},key,256);
    return{alg:'pbkdf2',hash:[...new Uint8Array(bits)].map(b=>b.toString(16).padStart(2,'0')).join('')};
  }
  let h1=0xdeadbeef,h2=0x41c6ce57;const s=salt+pw;
  for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677)}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  return{alg:'weak',hash:(h1>>>0).toString(16)+(h2>>>0).toString(16)};
}
const Auth={
  KEY:'minc_users_v2',
  list(){try{return JSON.parse(localStorage.getItem(this.KEY))||[]}catch{return[]}},
  save(l){localStorage.setItem(this.KEY,JSON.stringify(l))},
  find(login){return this.list().find(u=>u.login.toLowerCase()===String(login).trim().toLowerCase())},
  async make(name,login,password,role,mustChange){const salt=uid('s'),h=await hashPw(password,salt);return{id:uid('USR'),name,login,role,salt,alg:h.alg,hash:h.hash,mustChange}},
  async init(){
    if(this.list().length)return;
    let old=[];try{old=JSON.parse(localStorage.getItem('minc_users_v1'))||[]}catch{}
    const seed=!old.length;
    if(seed)old=[{id:'u1',name:'Administrador',login:'admin',password:'1234',role:'Administrador'},{id:'u2',name:'Operador',login:'operador',password:'1234',role:'Funcionário'}];
    const out=[];
    for(const u of old){const salt=uid('s'),h=await hashPw(u.password,salt);out.push({id:u.id,name:u.name,login:u.login,role:u.role,salt,alg:h.alg,hash:h.hash,mustChange:u.password==='1234'})}
    this.save(out);localStorage.removeItem('minc_users_v1');
  },
  async check(u,pw){const h=await hashPw(pw,u.salt);return h.alg===u.alg&&h.hash===u.hash},
  async setPw(id,pw,mustChange){const l=this.list(),u=l.find(x=>x.id===id);if(!u)return;const salt=uid('s'),h=await hashPw(pw,salt);Object.assign(u,{salt,alg:h.alg,hash:h.hash,mustChange});this.save(l);return u}
};

/* ============================== Domínio: constantes e normalização ============================== */
const STATUS=['Rascunho','Em execução','Concluído'];
const stCls={'Rascunho':'st-gray','Em execução':'st-amber','Concluído':'st-green'};
const STEPS=[{k:'process',t:'Informações'},{k:'components',t:'Componentes'},{k:'test',t:'Testes'},{k:'packaging',t:'Embalagem'},{k:'execution',t:'Documento'},{k:'structure',t:'Estrutura'}];
const FLOW=STEPS.map(s=>s.k),VALIDATED=['process','components','test','packaging'];
const CATALOGO=window.MINC_CATALOGO||{};
const FORM=CATALOGO.FORM||{titulo:'DOCUMENTO DE EXECUÇÃO DE PERITAGEM E SERVIÇOS',tipo:'REGISTRO',codigo:'R-MINC-046-DEP-PT',rev:'',data:''};
const PROV=CATALOGO.PROVIDENCIAS||['Fabricar','Recuperar','Reutilizar','Substituir'];
const COM_MAT=CATALOGO.COM_MATERIAIS||['Fabricar','Substituir'];
const ITENS_COMUNS=CATALOGO.ITENS_COMUNS||[],EMB_PADRAO=CATALOGO.EMBALAGEM_PADRAO||[];
const VEDACAO=['Metal x Metal','Resiliente','Não aplicável'],ACIONAMENTO=['Atuador Eletromecânico','Atuador Hidráulico','Atuador Pneumático','Manual','Motor','Sem Acionamento'];
const withLegacy=(list,val)=>(emp(val)||list.includes(val))?list:[...list,val];   // preserva um valor antigo que não está mais na lista (ex.: "Alavanca")
const EMB=['Padrão MINC','Específica'],UNITS=['pç','un','kg','m','mm','cm','m²','m³','L'],PUN=['bar','kgf/cm²','MPa','psi'],MEIOS=['Hidrostático','Pneumático'];

function parsePress(txt){
  const m=String(txt??'').trim().match(/^([\d.,]+)\s*(bar|kgf\/cm[²2]|mpa|psi)?$/i);
  if(!m)return{val:String(txt??''),un:''};
  const u=(m[2]||'').toLowerCase();
  return{val:m[1],un:!u?'':u==='bar'?'bar':u==='mpa'?'MPa':u==='psi'?'psi':'kgf/cm²'};
}
function legacyTeste(t){
  t=t||{};const a=t.acionamento||{},s=t.sede||{},c=t.corpo||{};
  const pa=parsePress(a.pressaoAtuadorValor),ps=parsePress(s.pressao),pc=parsePress(c.pressao);
  return{v:2,
    acionamento:{comissionamento:!!a.comissionamento,pressaoAtuador:!!a.pressaoAtuador,pressaoAtuadorVal:pa.val,pressaoAtuadorUn:pa.un},
    sede:{na:false,sentido:s.sentido||'',pressaoVal:ps.val,pressaoUn:ps.un},
    corpo:{na:false,pressaoVal:pc.val,pressaoUn:pc.un}};
}
/* v3: parâmetros gerais, meio/duração/repetições por teste e ensaios adicionais (estrutura vista no item TESTE dos documentos) */
function normTeste(t){
  const b=(t&&t.v>=2)?t:legacyTeste(t);
  b.v=3;
  const fill=(o,d)=>{for(const k of Object.keys(d))if(o[k]===undefined)o[k]=d[k];return o};
  b.geral=fill(b.geral||{},{fluido:'',norma:'',criterio:''});   // fluido/norma antigos ficam guardados, mas não aparecem mais
  b.acionamento=fill(b.acionamento||{},{obs:''});b.sede=fill(b.sede||{},{meio:'',fluido:'',duracao:'',rep:'',obs:''});b.corpo=fill(b.corpo||{},{meio:'',fluido:'',duracao:'',rep:'',obs:''});
  if(b.sede.sentido==='Ambos os sentidos')b.sede.sentido='Em ambos os sentidos';   // mesmo significado, nome novo
  b.extras=(b.extras||[]).map(x=>fill(x,{fluido:'',obs:''}));
  return b;
}
/* Atividades antigas (checkbox) viram linhas de texto no formato do documento */
function legacyAtiv(c){
  const out=[];
  if(c.action==='Recuperar')(c.ops||[]).filter(o=>o.done&&o.flow!=='Polimento').forEach(o=>out.push({id:uid('AT'),t:String(o.op).toUpperCase()+(o.obs?' — '+o.obs:'')}));
  if(c.action==='Reutilizar')(c.reuse||[]).forEach(x=>out.push({id:uid('AT'),t:String(x).toUpperCase()}));
  return out;
}
function normComp(c){
  c.acoes=Array.isArray(c.acoes)?c.acoes:(c.action?[c.action]:[]);
  c.action=c.acoes[0]||'';                 // mantido para compatibilidade (consultas e dados antigos)
  c.materials=(c.materials||[]).map(m=>Object.assign({tipo:'mp',raw:'',material:'',dimensao:'',codigo:'',semCadastro:false,peso:'',unit:'pç',qty:'',obs:''},m));
  c.materials.forEach(m=>{m.tipo=m.tipo==='serv'?'serv':'mp';m.semCadastro=!!m.semCadastro});   // folha da estrutura: matéria-prima (mp) ou serviço (serv)
  c.parentId=c.parentId||null;c.codigo=c.codigo||'';c.semCadastro=!!c.semCadastro;c.qtd=c.qtd==null?'':String(c.qtd);c.unid=c.unid||'un';   // posição na árvore da Estrutura
  c.ops=(c.ops||[]).filter(o=>o.flow!=='Polimento');c.reuse=c.reuse||[];c.photos=c.photos||[];c.anexos=Array.isArray(c.anexos)?c.anexos:[];c.noDrawing=!!c.noDrawing;c.obs=c.obs||'';c.servicos=Array.isArray(c.servicos)?c.servicos:[];
  if(!Array.isArray(c.atividades))c.atividades=legacyAtiv(c);
  return c;
}
/* Estrutura: garante que a árvore nunca fique inconsistente (pai que não existe mais, ou laço), seja qual for a origem do dado */
function fixTree(p){
  const by=new Map(p.components.map(c=>[c.id,c]));
  p.components.forEach(c=>{if(c.parentId&&(c.parentId===c.id||!by.has(c.parentId)))c.parentId=null});
  p.components.forEach(c=>{const seen=new Set([c.id]);let x=c;while(x.parentId){if(seen.has(x.parentId)){x.parentId=null;break}seen.add(x.parentId);x=by.get(x.parentId)}});
}
const newComp=(o={})=>normComp({id:uid('CMP'),name:'',drawing:'',acoes:[],qtd:'1',...o});
const newLeaf=t=>({tipo:t==='serv'?'serv':'mp',raw:'',material:'',dimensao:'',codigo:'',semCadastro:false,unit:t==='serv'?'un':'pç',qty:'',obs:''});
function normalize(p){
  p.equipmentPhotos=p.equipmentPhotos||[];p.anexos=Array.isArray(p.anexos)?p.anexos:[];
  p.components=(p.components||[]).map(normComp);fixTree(p);
  p.embalagem=p.embalagem||{};p.teste=normTeste(p.teste);p.status=p.status||'Rascunho';
  p.plaq=Object.assign({tipo:'',dn:'',pressaoVal:'',pressaoUn:'',temp:'',corpo:'',sede:'',os:'',tag:'',data:''},p.plaq);
  const d0=String(p.createdAt||'').slice(0,10);
  for(const k of ['nomus','revisao','motivoRevisao','aprovadoPor','aprovadoData'])if(p[k]==null)p[k]='';
  if(p.dataDoc==null)p.dataDoc=d0;if(p.elaboradoPor==null)p.elaboradoPor=p.createdBy||'';if(p.elaboradoData==null)p.elaboradoData=d0;
  return p;
}

/* ============================== Estado ============================== */
let PROCS=[];
const S={screen:'boot',user:null,id:null,sel:null,q:'',filter:'Todos',open:{},errs:null,sec:{},tc:{},sv:'tree',adminTab:'users'};
const cur=()=>PROCS.find(p=>p.id===S.id&&!p.deletedAt);
const C=cid=>cur()?.components.find(c=>c.id===cid);
const T=(r=cur())=>{r.teste=normTeste(r.teste);return r.teste};
/* árvore da Estrutura: o número do item é o mesmo da aba Componentes e do documento; filhos em ordem crescente de número */
/* numeração hierárquica: 1, 1.1, 1.2, 1.1.1, 2 ... Cada nível conta só entre irmãos, em ordem de criação. É a MESMA numeração
   da aba Componentes, da Estrutura, do documento e do Excel. Processo antigo (tudo na raiz) segue 1, 2, 3 como sempre foi. */
const _lbl={sig:null,map:null};
function compLabels(r){
  const sig=r.id+'|'+r.components.map(c=>c.id+'>'+(c.parentId||'')).join(',');
  if(_lbl.sig===sig)return _lbl.map;
  const m=new Map(),rec=(pid,pre)=>kidsOf(r,pid).forEach((c,i)=>{const l=pre?pre+'.'+(i+1):String(i+1);m.set(c.id,l);rec(c.id,l)});
  rec(null,'');_lbl.sig=sig;_lbl.map=m;return m;
}
const compNo=(r,c)=>compLabels(r).get(c.id)||'?';
/* componentes na ordem da árvore: cada pai seguido dos seus filhos. rootsDesc = raízes do mais novo para o mais antigo (aba Componentes) */
function treeList(r,{rootsDesc=false}={}){
  const out=[],L=compLabels(r),rec=(pid,lvl)=>{let ks=kidsOf(r,pid);if(lvl===0&&rootsDesc)ks=ks.slice().reverse();ks.forEach(c=>{out.push({c,no:L.get(c.id),lvl});rec(c.id,lvl+1)})};
  rec(null,0);
  if(out.length<r.components.length){const seen=new Set(out.map(x=>x.c.id));r.components.filter(c=>!seen.has(c.id)).forEach(c=>out.push({c,no:'?',lvl:0}))}   // defesa: nada some da lista
  return out;
}
const kidsOf=(r,id)=>r.components.filter(c=>(c.parentId||null)===id).reverse();
function descOf(r,id){const out=new Set(),st=[id];while(st.length){for(const k of kidsOf(r,st.pop())){out.add(k.id);st.push(k.id)}}return out}
const codeOf=x=>x.semCadastro?'':String(x.codigo||'').trim();   // "Não tem cadastro" marcado: o código digitado é ignorado
function touch(r=cur()){if(!r)return;r._dirty=true;r.updatedAt=new Date().toISOString();r.updatedBy=S.user?.name||r.updatedBy;Saver.queue(r.id)}
function changed(r=cur()){touch(r);liveErrs();liveChrome()}


/* ============================== Catálogos: setores, atividades, serviços externos ==============================
   Nuvem: tabelas catalog_* (leitura por membros, escrita só por administrador). O aparelho guarda uma cópia para uso offline
   e, se nunca baixou, usa o catálogo padrão de catalogo.js. Cada linha de atividade guarda o NOME como estava (cópia),
   então editar o catálogo depois não altera documentos antigos. */
const CAT_KEY='minc_catalog_v1';
const byPos=(a,b)=>(a.position-b.position)||String(a.name).localeCompare(String(b.name),'pt-BR');
function catDefault(){
  return{src:'default',at:null,
    sectors:(CATALOGO.SETORES_PADRAO||[]).map((x,i)=>({id:'seed-s'+i,name:x.name,position:i+1,active:true,activities:(x.atividades||[]).map((a,j)=>({id:`seed-a${i}-${j}`,name:a.name,position:j+1,requiresDetail:!!a.requiresDetail,active:true}))})),
    services:(CATALOGO.SERVICOS_EXTERNOS_PADRAO||[]).map((n,i)=>({id:'seed-v'+i,name:n,position:i+1,active:true}))};
}
let CATALOG=catDefault();
const Catalog={
  load(){try{const c=JSON.parse(localStorage.getItem(CAT_KEY));if(c&&Array.isArray(c.sectors)){CATALOG=c;return}}catch{}CATALOG=catDefault()},
  async refresh(){
    if(!CLOUD)return false;
    const [a,b,v]=await Promise.all([SB.from('catalog_sectors').select('*').order('position'),SB.from('catalog_activities').select('*').order('position'),SB.from('catalog_external_services').select('*').order('position')]);
    for(const r of [a,b,v])if(r.error)throw r.error;
    const sectors=a.data.map(x=>({id:x.id,name:x.name,position:x.position,active:x.active,activities:b.data.filter(y=>y.sector_id===x.id).map(y=>({id:y.id,name:y.name,position:y.position,requiresDetail:!!y.requires_detail,active:y.active}))}));
    const services=v.data.map(x=>({id:x.id,name:x.name,position:x.position,active:x.active}));
    const before=JSON.stringify([CATALOG.sectors,CATALOG.services]);
    CATALOG={src:'cloud',at:new Date().toISOString(),sectors,services};
    try{localStorage.setItem(CAT_KEY,JSON.stringify(CATALOG))}catch{}
    return before!==JSON.stringify([sectors,services]);
  },
  sectors(){return CATALOG.sectors.filter(x=>x.active).sort(byPos)},
  services(){return CATALOG.services.filter(x=>x.active).sort(byPos)}
};
/* linhas de atividade: do catálogo {sectorId,sector,actId,act,detail,reqDetail} ou antigas {t} */
const ativText=a=>a.actId?(a.act+(emp(a.detail)?'':' — '+a.detail)):(a.t||'');
const sameAct=(l,sec,act)=>!!l.actId&&(l.actId===act.id||(l.sector===sec.name&&l.act===act.name));
const sameServ=(x,sv)=>!!x.serviceId&&(x.serviceId===sv.id||x.nome===sv.name);

/* ============================== Regras de validação ============================== */
function pErr(lbl,v,u){if(emp(v)||!(num(v)>0))return lbl+' — pressão';if(!u)return lbl+' — unidade da pressão';return null}
const precisaMat=c=>c.acoes.some(a=>COM_MAT.includes(a));
/* folha visível: serviço em qualquer providência; matéria-prima só em Fabricar/Substituir.
   Matéria-prima de um item que mudou de providência fica guardada (não é apagada) e volta ao escolher Fabricar/Substituir. */
const leafOn=(c,m)=>m.tipo==='serv'||precisaMat(c);
const visLeaves=c=>c.materials.filter(m=>leafOn(c,m));
const hiddenMp=c=>c.materials.filter(m=>!leafOn(c,m)).length;
const matsTitle=ls=>ls.every(m=>m.tipo==='serv')?'Serviços':ls.some(m=>m.tipo==='serv')?'Materiais e serviços a comprar':'Materiais a comprar';
function compIssues(c,no){
  const p='Componente '+no+' — ',e=[];
  const serv=c.acoes.includes('Serviço externo');
  if(emp(c.name))e.push(p+'Nome / descrição');
  if(!c.noDrawing&&emp(c.drawing))e.push(p+'Número do desenho (ou escolha "Sem desenho")');
  if(!c.acoes.length)e.push(p+'escolha a providência');
  else if(c.acoes.length>1)e.push(p+'escolha só uma providência (item antigo com '+c.acoes.length+')');
  {let nmp=0,nsv=0;visLeaves(c).forEach(m=>{const sv=m.tipo==='serv',q=p+(sv?'Serviço '+(++nsv):'Matéria-prima '+(++nmp))+' — ';
    if(emp(m.raw))e.push(q+(sv?'Serviço':'Matéria-prima'));if(!sv&&emp(m.material))e.push(q+'Material');if(emp(m.unit))e.push(q+'Unidade');if(!(num(m.qty)>0))e.push(q+'Quantidade')})}
  const acts=c.atividades.filter(a=>a.actId||!emp(a.t));
  // Fabricar/Substituir: as atividades são definidas pela Engenharia de Processos, então não são exigidas aqui
  if(!acts.length&&!precisaMat(c)&&!(serv&&c.servicos.length)&&!visLeaves(c).length)e.push(p+'adicione ao menos uma atividade ou serviço');
  c.atividades.forEach((a,j)=>{
    if(a.actId){if(a.reqDetail&&emp(a.detail))e.push(`${p}Atividade ${j+1} — informe o detalhe de "${a.act}"`)}
    else if(emp(a.t))e.push(p+'há atividade em branco');
  });
  if(serv){
    if(!c.servicos.length)e.push(p+'escolha ao menos um serviço externo');
    c.servicos.forEach((x,j)=>{if(!x.serviceId&&emp(x.nome))e.push(`${p}Serviço externo ${j+1} — descreva o serviço`)});
  }
  return e;
}
function check(step,r=cur()){
  const e=[];if(!r)return e;
  if(step==='process')[['process','Processo'],['pedido','Pedido'],['equipamento','Equipamento'],['cliente','Cliente'],['vedacao','Tipo de vedação'],['acionamento','Acionamento']].forEach(([k,n])=>{if(emp(r[k]))e.push(n)});
  if(step==='components'){if(!r.components.length)e.push('Adicione ao menos um componente');treeList(r,{rootsDesc:true}).forEach(({c,no})=>e.push(...compIssues(c,no)))}
  if(step==='test'){
    const t=T(r),a=t.acionamento,s=t.sede,c=t.corpo;
    if(a.pressaoAtuador){const x=pErr('Teste de acionamento — Pressão do atuador',a.pressaoAtuadorVal,a.pressaoAtuadorUn);if(x)e.push(x)}
    if(!s.na){
      if(!s.sentido)e.push('Estanqueidade da sede — escolha o sentido');else{const x=pErr('Estanqueidade da sede',s.pressaoVal,s.pressaoUn);if(x)e.push(x)}
      if(emp(s.meio))e.push('Estanqueidade da sede — tipo de teste');
      if(!(num(s.duracao)>0))e.push('Estanqueidade da sede — duração');
    }
    if(!c.na){
      const x=pErr('Estanqueidade do corpo',c.pressaoVal,c.pressaoUn);if(x)e.push(x);
      if(emp(c.meio))e.push('Estanqueidade do corpo — tipo de teste');
      if(!(num(c.duracao)>0))e.push('Estanqueidade do corpo — duração');
    }
    t.extras.forEach((x,i)=>{const q='Ensaio adicional '+(i+1)+' — ';if(emp(x.desc))e.push(q+'descrição');if(!emp(x.pressaoVal)){if(!(num(x.pressaoVal)>0))e.push(q+'pressão inválida');else if(!x.pressaoUn)e.push(q+'unidade da pressão')}});
  }
  if(step==='packaging'){const m=r.embalagem||{};if(!m.tipo)e.push('Escolha o tipo de embalagem');else if(m.tipo==='Específica'&&emp(m.descricao))e.push('Descreva como o produto deve ser embalado')}
  return e;
}
const inv=(v,req=true)=>S.errs&&req&&emp(v)?' invalid':'';
const stepOk=(k,r=cur())=>!check(k,r).length;

function go(x){
  const from=FLOW.indexOf(S.screen),to=FLOW.indexOf(x);
  if(from>=0&&to>from){for(let k=0;k<to;k++){const e=check(FLOW[k]);if(e.length){S.screen=FLOW[k];S.errs=e;S.fx='shake';render();scrollTo(0,0);toast('Preencha os campos obrigatórios para avançar.');return}}}
  S.errs=null;S.anim=(from>=0&&to>=0)?(to>from?'fwd':'back'):'up';S.screen=x;Saver.flushAll();render();scrollTo(0,0);
}
function liveErrs(){if(!S.errs)return;const e=check(S.screen);S.errs=e.length?e:null;const s=$('#errslot');if(s)s.innerHTML=errBox()}
const stepMap=()=>{const m={};STEPS.forEach(s=>m[s.k]=stepState(s.k));return m};
function liveChrome(){
  const r=cur();if(!r)return;const a=$('#cbslot'),b=$('#stepslot');
  const now=stepMap(),prev=S.stepSt||now,fresh=STEPS.filter(s=>now[s.k]==='ok'&&prev[s.k]!=='ok').map(s=>s.k);S.stepSt=now;
  const dn=VALIDATED.filter(k=>now[k]==='ok').length,bump=S.doneN!=null&&dn!==S.doneN;S.doneN=dn;
  if(a)a.innerHTML=carimbo(r,bump);if(b)b.innerHTML=stepsHTML(fresh);
}
function liveComp(cid){
  const r=cur(),i=r?.components.findIndex(c=>c.id===cid);if(i==null||i<0)return;
  const st=document.querySelector(`.tn[data-cid="${qAttr(cid)}"] .tn-st`);if(st)st.outerHTML=nodeStatus(r.components[i],compNo(r,r.components[i]));
  const el=document.querySelector(`.comp[data-cid="${qAttr(cid)}"] .comp-head`);if(!el)return;
  const t=document.createElement('div');t.innerHTML=compHead(r.components[i],compNo(r,r.components[i]),!!S.open[cid]);el.replaceWith(t.firstElementChild);
}

/* ============================== Telas ============================== */
const badge=s=>`<span class="badge ${stCls[s]||'st-gray'}">${esc(s)}</span>`;
function errBox(){return S.errs?`<div class="errbox" role="alert"><b>Preencha os campos obrigatórios para continuar:</b><ul>${S.errs.map(e=>`<li>${esc(e)}</li>`).join('')}</ul></div>`:''}
function emptyBox(title,text,act,label,data=''){return `<div class="empty"><h2>${esc(title)}</h2><p>${esc(text)}</p><button class="btn primary" data-act="${act}" ${data}>${ic('plus')}${esc(label)}</button></div>`}
function fld(label,k,v,o={}){return `<div class="field"><label for="f-${k}">${label}</label><input id="f-${k}" class="${inv(v).trim()}" value="${esc(v)}" data-inp="p" data-k="${k}" autocomplete="off"${o.ph?` placeholder="${esc(o.ph)}"`:''}></div>`}
function rcards(items,val,act,extra,cols='g2'){return `<div class="rgroup ${cols}${S.errs&&emp(val)?' invalid-group':''}" role="radiogroup">${items.map(o=>{const k=typeof o==='string'?o:o.k,d=typeof o==='string'?'':o.d;return `<button type="button" class="rcard ${val===k?'on':''}" role="radio" aria-checked="${val===k}" data-act="${act}" data-v="${esc(k)}" ${extra} data-fk="rc-${esc(act)}-${esc(k)}-${esc(String(extra).replace(/[^\w-]/g,''))}"><b>${esc(k)}</b>${d?`<small>${esc(d)}</small>`:''}</button>`}).join('')}</div>`}
function sw(chg,g,k,on,label,extra=''){return `<label class="switch"><input type="checkbox" data-chg="${chg}" data-g="${g}" data-k="${k}" ${extra} ${on?'checked':''}><span class="track"></span><span>${label}</span></label>`}

/* Controle "aplica / não se aplica": verde quando aplica, âmbar quando não aplica */
function applic({on,act,extra='',yes='Aplica',no='Não se aplica'}){
  return `<div class="appl" role="radiogroup"><button type="button" class="ap yes ${on?'on':''}" role="radio" aria-checked="${on}" data-act="${act}" data-v="1" ${extra} data-fk="ap-${act}-${String(extra).replace(/[^\w-]/g,'')}-1">${on?ic('check','ic sm'):''}${yes}</button><button type="button" class="ap no ${on?'':'on'}" role="radio" aria-checked="${!on}" data-act="${act}" data-v="0" ${extra} data-fk="ap-${act}-${String(extra).replace(/[^\w-]/g,'')}-0">${on?'':ic('x','ic sm')}${no}</button></div>`;
}

function shell(inner){
  const dark=document.documentElement.dataset.theme==='dark',sv=Sync.view();
  return `<div class="app"><header class="topbar no-print"><button class="brand" data-act="home" aria-label="MINC Peritagem: ir para a tela inicial" title="Ir para a tela inicial"><span class="wm-b">MINC</span><span class="brand-sub">Peritagem</span></button><div class="bar-r"><button class="pill" id="syncpill" data-s="${sv.s}" data-act="syncPill" title="Sincronização com a nuvem"><i></i><span>${sv.t}</span></button><span class="pill" id="savestate" data-s="${Saver.state}"><i></i><span>${SAVE_TXT[Saver.state]}</span></span><button class="iconbtn" data-act="theme" aria-label="${dark?'Usar tema claro':'Usar tema escuro'}">${ic(dark?'sun':'moon')}</button><button class="userchip" data-act="userMenu">${esc(S.user?.name)}</button><button class="iconbtn" data-act="logout" aria-label="Sair">${ic('logout')}</button></div></header><main class="container" id="main">${inner}</main></div>`;
}
function view(){
  switch(S.screen){
    case'home':return vHome();case'admin':return vAdmin();
    case'process':return workspace(vProcess());case'components':return workspace(vComponents());case'test':return workspace(vTest());
    case'packaging':return workspace(vPack());case'execution':return workspace(vExec());case'structure':return workspace(vStructure());
  }return'';
}
function render(){
  const a=$('#app');
  if(S.screen==='login'||!S.user){S.anim=null;a.innerHTML=loginView();tryLogo();return}
  if(S.screen==='pending'){S.anim=null;a.innerHTML=pendingView();tryLogo();return}
  if(S.screen==='blocked'){S.anim=null;a.innerHTML=blockedView();tryLogo();return}
  if(S.screen==='setpw'){S.anim=null;a.innerHTML=setpwView();tryLogo();return}
  a.innerHTML=shell(view());
  afterRender();
}
function afterRender(){
  const m=$('#main');if(!m)return;
  if(S.anim){
    const t=S.anim;S.anim=null;
    const ws=(t==='fwd'||t==='back')&&m.querySelector('.ws-main');
    if(ws)ws.classList.add('anim-'+t);else{m.classList.add('anim-up');setTimeout(()=>m.classList.remove('anim-up'),700)}
  }
  if(S.fx==='shake'){S.fx=null;const eb=$('#errslot .errbox');if(eb)eb.classList.add('shake')}
  S.opening=null;
  if(S.rowsIn){S.rowsIn=false;const rw=$('#rows');if(rw&&!RM()){rw.classList.add('rows-in');setTimeout(()=>rw.classList.remove('rows-in'),420)}}
  const pk=[].concat(S.pulse||[]);S.pulse=null;
  for(const k of pk){const n=m.querySelector(`[data-fk="${qAttr(k)}"]`);if(n){n.classList.remove('just');void n.offsetWidth;n.classList.add('just')}}
}
function renderMain(){
  const m=$('#main');if(!m)return render();
  const y=window.scrollY,k=document.activeElement?.dataset?.fk,seg=segSnap(m);
  m.innerHTML=view();
  if(k){const n=m.querySelector(`[data-fk="${qAttr(k)}"]`);n&&n.focus({preventScroll:true})}
  window.scrollTo(0,y);
  if(S.focus){const n=document.getElementById(S.focus);S.focus=null;if(n)n.focus()}
  afterRender();segGlide(m,seg);
}
/* Controles segmentados (status Rascunho / Em execução / Concluído, visões, abas): a pílula escura desliza da opção
   anterior até a nova. Uma cópia "marcada" das opções fica por cima, recortada só na opção ativa, e o recorte anda:
   fundo e texto trocam juntos, sem cor intermediária. A tela é redesenhada inteira, então a posição de partida é
   medida antes (segSnap) e a animação começa depois (segGlide). Curva = --ease-io de movimento.css. */
const segKey=g=>g.getAttribute('aria-label')||g.getAttribute('aria-labelledby');
function segClip(g,b){
  const s=g.getBoundingClientRect(),r=b.getBoundingClientRect(),L=s.left+g.clientLeft,T=s.top+g.clientTop;
  return `inset(${r.top-T}px ${L+g.clientWidth-r.right}px ${T+g.clientHeight-r.bottom}px ${r.left-L}px round ${getComputedStyle(b).borderTopLeftRadius})`;
}
function segSnap(m){
  const out=new Map();if(RM()||!Element.prototype.animate)return out;
  m.querySelectorAll('.seg').forEach(g=>{const b=g.querySelector(':scope>.seg-b.on'),k=segKey(g);if(b&&k)out.set(k,segClip(g,b))});
  return out;
}
function segGlide(m,snap){
  if(!snap.size)return;
  m.querySelectorAll('.seg').forEach(g=>{
    const from=snap.get(segKey(g)),b=g.querySelector(':scope>.seg-b.on');if(!from||!b)return;
    const to=segClip(g,b);if(to===from)return;
    const ov=document.createElement('div');ov.className='seg-ov';ov.setAttribute('aria-hidden','true');
    // cada opção da cópia fica exatamente sobre a original (posição medida), para o texto não "tremer" na borda do recorte
    const gr=g.getBoundingClientRect(),gx=gr.left+g.clientLeft,gy=gr.top+g.clientTop;
    ov.innerHTML=[...g.querySelectorAll(':scope>.seg-b')].map(x=>{const r=x.getBoundingClientRect();return `<span class="seg-b on" style="left:${r.left-gx}px;top:${r.top-gy}px;width:${r.width}px;height:${r.height}px">${x.innerHTML}</span>`}).join('');
    ov.style.clipPath=to;   // estado final já fixo: no quadro em que a animação acaba a pílula não cobre o controle inteiro
    g.classList.add('gliding');g.append(ov);
    const a=ov.animate([{clipPath:from},{clipPath:to}],{duration:260,easing:'cubic-bezier(.77,0,.175,1)'});
    let done=false;
    const end=()=>{if(done)return;done=true;g.classList.add('settle');g.classList.remove('gliding');ov.remove();requestAnimationFrame(()=>requestAnimationFrame(()=>g.classList.remove('settle')))};
    a.onfinish=end;a.oncancel=end;
  });
}

/* ---------- Login ---------- */
function loginArt(){
  return `<section class="login-art"><div class="la-top">Indústrias Minc</div><div class="la-mid"><h1>Peritagem</h1><p>Registro de inspeção, recuperação e reutilização de equipamentos.</p></div><div class="la-word" aria-label="MINC">MINC</div></section>`;
}
function loginView(){
  return `<div class="login">${loginArt()}<section class="login-form"><form data-submit="login" autocomplete="on"><div class="wm">MINC</div><h2>Entrar</h2><div class="field"><label for="lg">${CLOUD?'E-mail':'Usuário'}</label><input id="lg" name="login" ${CLOUD?'type="email" inputmode="email"':''} required data-keep-case autocapitalize="off" autocomplete="username"></div><div class="field"><label for="pw">Senha</label><input id="pw" name="pw" type="password" required autocomplete="current-password"></div><button class="btn primary block" type="submit">Entrar</button><p class="foot">Versão ${APP_VERSION}${CLOUD?'':' — modo local'}</p></form></section></div>`;
}
function pendingView(){
  return `<div class="login">${loginArt()}<section class="login-form"><div class="pend"><div class="wm">MINC</div><h2>Acesso aguardando aprovação</h2><p>A conta <b>${esc(S.user?.login)}</b> foi criada, mas um administrador ainda precisa liberar o acesso.</p><div class="stack"><button class="btn primary" data-act="recheck">Verificar novamente</button><button class="btn" data-act="logout">Sair</button></div></div></section></div>`;
}
function blockedView(){
  return `<div class="login">${loginArt()}<section class="login-form"><div class="pend"><div class="wm">MINC</div><h2>Acesso bloqueado</h2><p>A conta <b>${esc(S.user?.login)}</b> está bloqueada. Fale com um administrador para voltar a usar o aplicativo.</p><div class="stack"><button class="btn primary" data-act="recheck">Verificar novamente</button><button class="btn" data-act="logout">Sair</button></div></div></section></div>`;
}
function setpwView(){
  return `<div class="login">${loginArt()}<section class="login-form"><form data-submit="setpw" autocomplete="on"><div class="wm">MINC</div><h2>Defina sua senha</h2><p class="hint" style="margin-top:-8px">Conta: <b>${esc(S.user?.login)}</b></p><input type="text" name="user" value="${esc(S.user?.login)}" autocomplete="username" hidden><div class="field"><label for="sp1">Nova senha <span class="muted">(mínimo 8 caracteres)</span></label><input id="sp1" name="n1" type="password" required minlength="8" autocomplete="new-password" autofocus></div><div class="field"><label for="sp2">Repita a senha</label><input id="sp2" name="n2" type="password" required minlength="8" autocomplete="new-password"></div><button class="btn primary block" type="submit">Salvar e entrar</button></form></section></div>`;
}
/* Se existir icons/logo-minc.svg (ou .png), ela substitui o logotipo tipográfico, sobre uma placa branca. */
let LOGO;
function setLogo(src){const w=$('.la-word');if(!w)return;const im=new Image();im.alt='Indústrias Minc';im.src=src;w.classList.add('has-img');w.textContent='';w.append(im)}
function tryLogo(){
  if(LOGO===false)return;
  if(LOGO)return setLogo(LOGO);
  const next=list=>{if(!list.length){LOGO=false;return}const im=new Image();im.onload=()=>{LOGO=list[0];setLogo(list[0])};im.onerror=()=>next(list.slice(1));im.src=list[0]};
  next(['icons/logo-minc.svg','icons/logo-minc.png']);
}

/* ---------- Início: lista + detalhe ---------- */
function filtered(all){
  const q=S.q.trim().toLowerCase();
  return all.filter(p=>(S.filter==='Todos'||p.status===S.filter)&&(!q||[p.equipamento,p.cliente,p.process,p.pedido,p.ordem].some(v=>String(v||'').toLowerCase().includes(q))))
    .sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
function rowsHTML(list){
  if(!list.length)return `<div class="list-empty">Nenhum processo encontrado.</div>`;
  return list.map((p,i)=>`<button style="--i:${Math.min(i,6)}" class="row ${stCls[p.status]||''} ${p.id===S.sel?'sel':''}" data-act="pick" data-id="${p.id}" data-fk="row-${p.id}"><span class="row-t"><b>${esc(p.equipamento)||'Sem equipamento'}</b><small>${esc(p.cliente)||'Sem cliente'}</small><small>${p.process?'Processo '+esc(p.process):'Sem número de processo'}</small></span><span class="row-m">${p._conflict?'<span class="badge st-red">Conflito</span>':badge(p.status)}${emp(p.ordem)?'<span class="badge pend">Sem ordem</span>':''}<small>${fmtDay(p.updatedAt)}</small></span></button>`).join('');
}
function vHome(){
  const all=PROCS.filter(p=>!p.deletedAt),list=filtered(all);
  if(wide()&&!all.find(p=>p.id===S.sel))S.sel=list[0]?.id||null;
  const sel=all.find(p=>p.id===S.sel);
  return `<div class="home"><section class="list-p" aria-label="Processos"><div class="list-h"><div><h1>Processos</h1><small>${all.length} cadastrado(s)</small></div><button class="btn primary" data-act="newProcess">${ic('plus')}Novo processo</button></div><div class="search">${ic('search')}<input type="search" id="q" placeholder="Buscar equipamento, cliente, pedido…" aria-label="Buscar processos" data-keep-case data-inp="q" value="${esc(S.q)}"></div><div class="chips fl" role="group" aria-label="Filtrar por status">${['Todos',...STATUS].map(f=>`<button class="chip ${S.filter===f?'on':''}" data-act="filter" data-v="${f}" aria-pressed="${S.filter===f}" data-fk="fl-${f}">${f}</button>`).join('')}</div><div id="rows">${rowsHTML(list)}</div></section><section class="detail" aria-live="polite">${detail(sel,all)}</section></div>`;
}
function detail(p,all){
  if(!all.length)return `<div class="empty-art">${emptyMark()}<h2>Nenhum processo ainda</h2><p>Crie o primeiro registro de peritagem para começar.</p><button class="btn primary" data-act="newProcess">${ic('plus')}Novo processo</button></div>`;
  if(!p)return `<div class="empty-art">${emptyMark()}<h2>Selecione um processo</h2><p>Veja o resumo e abra o registro de peritagem.</p></div>`;
  const nPh=p.components.reduce((n,c)=>n+c.photos.length,0)+p.equipmentPhotos.length;
  return `<article class="sheet"><div class="sheet-h"><div><small>Equipamento</small><h2>${esc(p.equipamento)||'Sem equipamento'}</h2></div>${badge(p.status)}</div><dl class="kv"><div><dt>Cliente</dt><dd>${esc(p.cliente)||'—'}</dd></div><div><dt>Processo</dt><dd>${esc(p.process)||'—'}</dd></div><div><dt>Pedido / Ordem</dt><dd>${esc(p.pedido)||'—'} / ${esc(p.ordem)||'<span class="pend-t">pendente</span>'}</dd></div><div><dt>Vedação</dt><dd>${esc(p.vedacao)||'—'}</dd></div><div><dt>Acionamento</dt><dd>${esc(p.acionamento)||'—'}</dd></div><div><dt>Fluido de trabalho</dt><dd>${esc(p.fluido)||'—'}</dd></div><div><dt>Atualizado em</dt><dd>${fmt(p.updatedAt)}</dd></div><div><dt>Por</dt><dd>${esc(p.updatedBy||p.createdBy)||'—'}</dd></div><div><dt>Criado por</dt><dd>${esc(p.createdBy)||'—'}</dd></div></dl><div class="sheet-b"><h3>Etapas</h3><ul class="prog">${VALIDATED.map(k=>{const ok=stepOk(k,p);return `<li class="${ok?'ok':'todo'}">${ok?ic('check','ic sm'):ic('alert','ic sm')}${STEPS.find(s=>s.k===k).t}</li>`}).join('')}</ul><div class="counts"><span><b>${p.components.length}</b>componente(s)</span><span><b>${nPh}</b>foto(s)</span></div><div class="actions"><button class="btn primary" data-act="openProcess" data-id="${p.id}">Abrir processo</button><button class="btn" data-act="openDoc" data-id="${p.id}">Documento</button><button class="btn danger" data-act="delProcess" data-id="${p.id}">${ic('trash')}Excluir</button></div></div></article>`;
}

/* ---------- Carimbo, etapas e barra de ações ---------- */
function carimbo(r,bump=false){
  const done=VALIDATED.filter(k=>stepOk(k,r)).length;
  return `<header class="carimbo no-print"><button class="btn ghost back" data-act="home">${ic('back')}<span>Processos</span></button><div class="cb-grid"><div class="cb-c cb-eq"><small>Equipamento</small><b>${esc(r.equipamento)||'Novo processo'}</b></div><div class="cb-c"><small>Cliente</small><b>${esc(r.cliente)||'—'}</b></div><div class="cb-c"><small>Processo</small><b>${esc(r.process)||'—'}</b></div><div class="cb-c"><small>Pedido / Ordem</small><b>${esc(r.pedido)||'—'} / ${esc(r.ordem)||'—'}</b></div><div class="cb-c"><small>Status</small><span class="cb-st" data-fk="cb-st">${badge(r.status)}</span></div><div class="cb-c${bump?' just':''}"><small>Etapas completas</small><b>${done} de ${VALIDATED.length}</b></div></div></header>`;
}
function stepState(k){if(VALIDATED.includes(k))return stepOk(k)?'ok':'todo';return VALIDATED.every(v=>stepOk(v))?'open':'locked'}
function stepsHTML(fresh=[]){
  return `<nav class="steps no-print" aria-label="Etapas do processo">${STEPS.map((s,n)=>{const st=stepState(s.k),cu=S.screen===s.k;return `<button class="step ${st}${cu?' cur':''}${fresh.includes(s.k)?' just':''}" data-act="go" data-v="${s.k}" data-fk="step-${s.k}" ${cu?'aria-current="step"':''}${st==='locked'?' title="Complete as etapas anteriores"':''}><span class="node">${st==='ok'?ic('check','ic sm'):n+1}</span><span>${s.t}</span></button>`}).join('')}</nav>`;
}
function actionbar(){
  const i=FLOW.indexOf(S.screen),prev=FLOW[i-1],next=FLOW[i+1];
  const nextLabel=S.screen==='packaging'?'Gerar documento':next?STEPS[i+1].t:'';
  const MID={components:`<button class="btn" data-act="addComp">${ic('plus')}Componente</button>`,execution:`<button class="btn" data-act="print">${ic('print')}Imprimir / Salvar PDF</button>`};
  const mid=Object.prototype.hasOwnProperty.call(MID,S.screen)?MID[S.screen]:`<button class="btn" data-act="saveNow">${ic('save')}Salvar</button>`;
  return `<div class="actionbar no-print">${prev?`<button class="btn" data-act="go" data-v="${prev}">${ic('back')}Voltar</button>`:'<span></span>'}<div class="mid">${mid}</div>${next?`<button class="btn primary" data-act="go" data-v="${next}">${esc(nextLabel)}${ic('next')}</button>`:'<span></span>'}</div>`;
}
function workspace(content){
  const r=cur();S.stepSt=stepMap();S.doneN=VALIDATED.filter(k=>S.stepSt[k]==='ok').length;
  return `<div id="cbslot">${carimbo(r)}</div><div class="ws"><div id="stepslot">${stepsHTML()}</div><section class="ws-main"><div id="errslot">${errBox()}</div>${content}</section></div>${actionbar()}`;
}

/* ---------- 1. Informações ---------- */
function photoGrid(list,kind,cid=''){
  return `<div class="ph-grid">${list.length?list.map((p,n)=>`<div class="ph-tile" data-fk="ph-${p.id}"><button class="ph-img" data-act="zoom" data-pid="${p.id}" aria-label="Ampliar foto ${n+1}"><img src="${Photos.url(p.id)}" alt="Foto ${n+1}" loading="lazy"></button><button class="ph-x" data-act="delPhoto" data-kind="${kind}" data-cid="${cid}" data-pid="${p.id}" aria-label="Remover foto ${n+1}">${ic('x')}</button></div>`).join(''):`<div class="ph-none">Nenhuma foto.</div>`}</div>`;
}
const photoBtns=t=>`<div class="actions"><button class="btn" data-act="pickPhoto" data-cap="1" data-t="${t}">${ic('camera')}Tirar foto</button><button class="btn" data-act="pickAnexo" data-t="${t}">${ic('doc')}Anexos</button></div>`;
const anexLabel=a=>(fileExt(a.name)||a.ext||'').replace('.','').toUpperCase()||'ARQ';
function anexList(list,kind,cid=''){
  if(!list.length)return '';
  return `<ul class="anx-list" aria-label="Arquivos anexados">${list.map(a=>`<li class="anx" data-fk="ax-${a.id}"><span class="anx-t">${esc(anexLabel(a))}</span><button class="anx-n" data-act="openAnexo" data-pid="${a.id}" data-nm="${esc(a.name)}" data-ty="${esc(a.type||'')}" title="Abrir ${esc(a.name)}"><b>${esc(a.name)}</b><small>${a.size?kb(a.size):''}</small></button><button class="iconb" data-act="delAnexo" data-kind="${kind}" data-cid="${cid}" data-pid="${a.id}" aria-label="Remover ${esc(a.name)}">${ic('trash')}</button></li>`).join('')}</ul>`;
}
const fmtISO=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v||''));return m?`${m[3]}/${m[2]}/${m[1]}`:(v||'')};
/* campo genérico: scope 'p' = dado do processo, 'plaq' = dados da plaqueta */
function fldS(scope,k,label,v,o={}){
  const id=`f-${scope}-${k}`;
  return `<div class="field"><label for="${id}">${label}</label><input id="${id}" ${o.type?`type="${o.type}"`:''} value="${esc(v)}" data-inp="${scope}" data-k="${k}" ${o.keep?'data-keep-case':''} autocomplete="off"${o.ph?` placeholder="${esc(o.ph)}"`:''}></div>`;
}
function vProcess(){
  const r=cur(),q=r.plaq;
  return `<div class="ph"><h1>Informações do processo</h1><p>Identificação, dados do documento, dados técnicos e fotos do equipamento ainda montado.</p></div>
<div class="panel"><h2>Identificação</h2><p class="hint pasta-note">${r.pasta?`Pasta na nuvem: <code>${esc(r.pasta)}</code>`:'A pasta deste processo na nuvem (Processo + Pedido + Equipamento + Cliente) é criada quando esses quatro campos estiverem preenchidos.'}</p><div class="grid g3">${fld('Processo','process',r.process)}${fld('Pedido','pedido',r.pedido)}${fld('Ordem <span class="muted">(opcional)</span>','ordem',r.ordem)}${fld('Equipamento','equipamento',r.equipamento)}${fld('Cliente','cliente',r.cliente)}<div class="field"><span class="lbl" id="l-status">Status</span><div class="seg" role="radiogroup" aria-labelledby="l-status">${STATUS.map(s=>`<button type="button" class="seg-b ${r.status===s?'on':''}" role="radio" aria-checked="${r.status===s}" data-act="status" data-v="${s}" data-fk="st-${s}"><i class="dot ${stCls[s]}"></i>${s}</button>`).join('')}</div></div></div><div class="field"><label for="f-observacoes">Observações <span class="muted">(opcional)</span></label><textarea id="f-observacoes" data-inp="p" data-k="observacoes">${esc(r.observacoes)}</textarea></div></div>
<div class="panel"><h2>Documento de execução</h2><p class="hint">Cabeçalho e assinaturas do formulário ${esc(FORM.codigo)}. Todos os campos são opcionais.</p><div class="grid g3">${fldS('p','nomus','Peritagem Nomus',r.nomus)}${fldS('p','dataDoc','Data do documento',r.dataDoc,{type:'date'})}${fldS('p','revisao','Revisão',r.revisao)}</div>${fldS('p','motivoRevisao','Motivo da revisão',r.motivoRevisao)}<div class="grid g4">${fldS('p','elaboradoPor','Elaborado por',r.elaboradoPor)}${fldS('p','elaboradoData','Data da elaboração',r.elaboradoData,{type:'date'})}${fldS('p','aprovadoPor','Aprovado por',r.aprovadoPor)}${fldS('p','aprovadoData','Data da aprovação',r.aprovadoData,{type:'date'})}</div></div>
<div class="panel"><h2>Informações técnicas</h2><div class="field"><span class="lbl">Tipo de vedação</span>${rcards(VEDACAO,r.vedacao,'set','data-k="vedacao"','g3')}</div><div class="field"><span class="lbl">Acionamento</span>${rcards(withLegacy(ACIONAMENTO,r.acionamento),r.acionamento,'set','data-k="acionamento"','g4')}</div><div class="grid g3">${fld('Fluido de trabalho <span class="muted">(opcional)</span>','fluido',r.fluido)}</div></div>
<div class="panel"><h2>Dados da plaqueta de identificação</h2><p class="hint">Opcional. Preencha o que será gravado na plaqueta; só o que for informado aparece no documento.</p><div class="grid g4">${fldS('plaq','tipo','Equipamento',q.tipo)}${fldS('plaq','dn','DN',q.dn,{keep:true})}${fldS('plaq','os','O.S.',q.os)}${fldS('plaq','tag','TAG',q.tag)}</div><div class="grid g4">${fldS('plaq','data','Data do reparo',q.data,{type:'date'})}</div></div>
<div class="panel"><div class="ph-bar"><div><h2 style="margin:0">Imagens do equipamento</h2><span class="ph-count">${r.equipmentPhotos.length} de 4 fotos recomendadas, com o equipamento ainda montado. ${r.anexos.length?`${r.anexos.length} anexo(s).`:'Use “Anexos” para PDF e outros arquivos.'}</span></div>${photoBtns('equip')}</div>${photoGrid(r.equipmentPhotos,'equip')}${anexList(r.anexos,'equip')}</div>`;
}

/* ---------- 2. Componentes ---------- */
function vComponents(){
  const r=cur(),n=r.components.length;
  return `<div class="ph"><h1>Componentes</h1><p>O componente mais novo aparece no topo; os subcomponentes ficam logo abaixo do componente a que pertencem (1.1, 1.2…). Toque no cabeçalho para abrir ou fechar.</p></div>${ITENS_COMUNS.length?`<div class="panel quick"><span class="lbl">Itens comuns nos documentos</span><div class="chips fl">${ITENS_COMUNS.map(x=>`<button class="chip" data-act="addCommon" data-v="${esc(x)}" data-fk="cm-${esc(x)}">${ic('plus','ic sm')}${esc(x)}</button>`).join('')}</div></div>`:''}${n?treeList(r,{rootsDesc:true}).map(({c,no,lvl})=>vComp(c,no,lvl)).join(''):emptyBox('Nenhum componente cadastrado','Adicione o primeiro componente para registrar providência, atividades, materiais e fotos.','addComp','Adicionar componente')}`;
}
/* seção "Subcomponentes" dentro do componente: adiciona filhos (no.1, no.2…) e dá atalho para abrir cada um */
function vSubs(c,no){
  const r=cur(),subs=kidsOf(r,c.id);
  return `<div class="subpanel"><div class="ph-row"><div><h3>Subcomponentes</h3><p class="hint" style="margin:0">Peças que fazem parte deste componente. Cada uma é numerada a partir do ${esc(no)} (${esc(no)}.1, ${esc(no)}.2…) e tem atividades, materiais e fotos próprios.</p></div><button type="button" class="btn primary" data-act="addSub" data-pid="${c.id}">${ic('plus')}Adicionar subcomponente</button></div>${subs.length?`<div class="chips">${subs.map(x=>`<button type="button" class="chip" data-act="openComp" data-cid="${x.id}"><b>${esc(compNo(r,x))}</b>&nbsp;${esc(x.name)||'Sem descrição'}</button>`).join('')}</div>`:'<p class="hint" style="margin:8px 0 0">Nenhum subcomponente.</p>'}</div>`;
}
function subOf(c){const r=cur(),pa=c.parentId&&r&&r.components.find(x=>x.id===c.parentId);return pa?` · Sub do item ${compNo(r,pa)}`:''}
function compHead(c,no,open){
  const iss=compIssues(c,no).length,extra=c.acoes.length>1?` +${c.acoes.length-1}`:'';
  return `<button class="comp-head" data-act="toggleComp" data-cid="${c.id}" aria-expanded="${open}" data-fk="ch-${c.id}"><span class="comp-no">${no}</span><span class="comp-t"><b>${esc(c.name)||'Sem descrição'}</b><small class="${c.noDrawing?'na':''}">${c.noDrawing?'Sem desenho aplicável':c.drawing?'Desenho '+esc(c.drawing):'Desenho não informado'}${subOf(c)}</small></span><span class="badge b-act" title="${esc(c.acoes.join(' + '))}">${esc(c.acoes[0]||'Sem providência')}${extra}</span><span class="comp-st ${iss?'warn':'ok'}">${iss?ic('alert','ic sm')+iss+(iss>1?' pendências':' pendência'):ic('check','ic sm')+'Completo'}</span><span class="comp-ph">${ic('image','ic sm')}${c.photos.length}</span>${ic('chev','ic chev')}</button>`;
}
function provCards(c){
  const legacy=c.acoes.filter(a=>!PROV.includes(a));   // opções descontinuadas (ex.: Retrofit) em itens antigos
  return `<div class="rgroup g4${S.errs&&c.acoes.length!==1?' invalid-group':''}" role="radiogroup" aria-label="Providência">${PROV.map(k=>{const on=c.acoes.includes(k);return `<button type="button" class="rcard ${on?'on':''}" role="radio" aria-checked="${on}" data-act="toggleProv" data-cid="${c.id}" data-v="${esc(k)}" data-fk="pv-${c.id}-${esc(k)}"><b>${esc(k)}</b></button>`}).join('')}${legacy.map(k=>`<button type="button" class="rcard on legacy" role="radio" aria-checked="true" data-act="toggleProv" data-cid="${c.id}" data-v="${esc(k)}" data-fk="pv-${c.id}-${esc(k)}" title="Opção descontinuada. Toque para remover."><b>${esc(k)}</b><small>Descontinuada: toque para remover</small></button>`).join('')}</div>`;
}
function vComp(c,no,lvl=0){
  const open=!!S.open[c.id],id=c.id;
  return `<article class="comp ${open?'open':''}${lvl?' sub':''}" data-cid="${id}" style="--lv:${Math.min(lvl,6)}">${compHead(c,no,open)}${open?`<div class="comp-body${S.opening===id?' opening':''}"><div class="comp-in">
<div class="grid g3"><div class="field"><label for="cn-${id}">Nome / descrição</label><input id="cn-${id}" class="${inv(c.name).trim()}" value="${esc(c.name)}" data-inp="c" data-cid="${id}" data-k="name" autocomplete="off"></div><div class="field"><span class="lbl">Desenho</span>${applic({on:!c.noDrawing,act:'cDraw',extra:`data-cid="${id}"`,yes:'Tem desenho',no:'Sem desenho'})}</div><div class="field"><label for="cd-${id}">Número do desenho</label><input id="cd-${id}" class="${c.noDrawing?'':inv(c.drawing).trim()}" value="${c.noDrawing?'':esc(c.drawing)}" data-inp="c" data-cid="${id}" data-k="drawing" autocomplete="off" ${c.noDrawing?'disabled placeholder="Sem desenho aplicável"':''}></div></div>
<div class="field"><span class="lbl">Providência</span>${c.acoes.length>1?`<p class="errbox" style="margin:0 0 10px">Este item antigo tem ${c.acoes.length} providências (${esc(c.acoes.join(', '))}). Escolha só uma.</p>`:''}${provCards(c)}</div>
${c.acoes.includes('Serviço externo')?vServ(c):''}${vMats(c)}${vAtivs(c)}${vSubs(c,no)}
<div class="field"><label for="co-${id}">Observação do item <span class="muted">(opcional)</span></label><textarea id="co-${id}" rows="2" data-inp="c" data-cid="${id}" data-k="obs">${esc(c.obs)}</textarea></div>
<div class="field"><div class="ph-bar"><span class="lbl" style="margin:0">Fotos do componente (${c.photos.length})</span>${photoBtns(id)}</div>${photoGrid(c.photos,'comp',id)}${anexList(c.anexos,'comp',id)}</div>
<div class="comp-foot"><button class="btn danger" data-act="delComp" data-cid="${id}">${ic('trash')}Excluir componente</button></div></div></div>`:''}</article>`;
}
function vAtivs(c){
  const secs=Catalog.sectors();
  const lastSec=c.atividades.length?c.atividades[c.atividades.length-1].sectorId:null;
  const sel=secs.find(x=>x.id===S.sec[c.id])||secs.find(x=>x.id===lastSec)||secs[0];
  const acts=sel?sel.activities.filter(a=>a.active).sort(byPos):[];
  const bad=S.errs&&!precisaMat(c)&&!c.atividades.some(a=>a.actId||!emp(a.t))&&!(c.acoes.includes('Serviço externo')&&c.servicos.length)&&!visLeaves(c).length;
  const nSec=x=>c.atividades.filter(l=>l.actId&&(l.sectorId===x.id||l.sector===x.name)).length;
  const line=(a,j)=>{
    const btns=`<span class="ativ-b"><button class="iconb" data-act="moveAtiv" data-cid="${c.id}" data-aid="${a.id}" data-dir="-1" aria-label="Subir atividade ${j+1}" ${j===0?'disabled':''}>${ic('up')}</button><button class="iconb" data-act="moveAtiv" data-cid="${c.id}" data-aid="${a.id}" data-dir="1" aria-label="Descer atividade ${j+1}" ${j===c.atividades.length-1?'disabled':''}>${ic('chev')}</button><button class="iconb" data-act="delAtiv" data-cid="${c.id}" data-aid="${a.id}" aria-label="Excluir atividade ${j+1}">${ic('trash')}</button></span>`;
    if(a.actId)return `<li class="ativ"><span class="ativ-n">${j+1}</span><div class="ativ-m"><div class="ativ-h"><span class="badge sec">${esc(a.sector)}</span><b>${esc(a.act)}</b></div><input id="at-${a.id}" class="${S.errs&&a.reqDetail&&emp(a.detail)?'invalid':''}" value="${esc(a.detail)}" data-inp="ativ" data-k="detail" data-cid="${c.id}" data-aid="${a.id}" placeholder="${a.reqDetail?'Detalhe (obrigatório)':'Detalhe (opcional)'}" aria-label="Detalhe da atividade ${j+1}" autocomplete="off"></div>${btns}</li>`;
    return `<li class="ativ"><span class="ativ-n">${j+1}</span><div class="ativ-m"><div class="ativ-h"><span class="badge sec old">Sem setor (anterior)</span></div><input id="at-${a.id}" class="${S.errs&&emp(a.t)?'invalid':''}" value="${esc(a.t)}" data-inp="ativ" data-k="t" data-cid="${c.id}" data-aid="${a.id}" placeholder="Descreva a atividade" aria-label="Atividade ${j+1}" autocomplete="off"></div>${btns}</li>`;
  };
  return `<div class="subpanel${bad?' invalid-group':''}"><h3>Atividades${precisaMat(c)?' <span class="muted">(opcional)</span>':''}</h3><p class="hint">${precisaMat(c)?'Para Fabricar ou Substituir não é preciso escolher atividades: elas são definidas pela Engenharia de Processos. ':''}Escolha o setor e toque nas atividades que serão executadas. Um item pode ter atividades de vários setores.</p>${secs.length?`<div class="field"><span class="lbl" id="l-sec-${c.id}">Setor</span><div class="chips" role="radiogroup" aria-labelledby="l-sec-${c.id}">${secs.map(x=>{const n=nSec(x),on=sel&&sel.id===x.id;return `<button class="chip ${on?'on':''}" role="radio" aria-checked="${on}" data-act="pickSector" data-cid="${c.id}" data-sid="${esc(x.id)}" data-fk="sc-${c.id}-${esc(x.id)}">${esc(x.name)}${n?` <span class="cnt">${n}</span>`:''}</button>`}).join('')}</div></div><div class="field"><span class="lbl">Atividades de ${esc(sel.name)}</span>${acts.length?`<div class="chips cat" role="group">${acts.map(a=>{const on=c.atividades.some(l=>sameAct(l,sel,a));return `<button class="chip ${on?'on':''}" role="checkbox" aria-checked="${on}" data-act="toggleAct" data-cid="${c.id}" data-sid="${esc(sel.id)}" data-aid="${esc(a.id)}" data-fk="ta-${c.id}-${esc(a.id)}">${on?ic('check','ic sm'):ic('plus','ic sm')}${esc(a.name)}</button>`}).join('')}</div>`:'<p class="hint">Este setor ainda não tem atividades cadastradas.</p>'}</div>`:'<p class="hint">Nenhum setor cadastrado.</p>'}${c.atividades.length?`<ol class="ativs">${c.atividades.map(line).join('')}</ol>`:'<p class="hint">Nenhuma atividade escolhida.</p>'}</div>`;
}
function vServ(c){
  const svs=Catalog.services(),bad=S.errs&&!c.servicos.length;
  return `<div class="subpanel${bad?' invalid-group':''}"><h3>Serviços externos</h3><p class="hint">Marque os serviços externos necessários para este item. Use "Outro" para um serviço que não está na lista.</p><div class="chips cat" role="group" aria-label="Serviços externos">${svs.map(x=>{const on=c.servicos.some(y=>sameServ(y,x));return `<button class="chip ${on?'on':''}" role="checkbox" aria-checked="${on}" data-act="toggleServ" data-cid="${c.id}" data-sv="${esc(x.id)}" data-fk="sv-${c.id}-${esc(x.id)}">${on?ic('check','ic sm'):ic('plus','ic sm')}${esc(x.name)}</button>`}).join('')}<button class="chip" data-act="addServOutro" data-cid="${c.id}" data-fk="sv-${c.id}-outro">${ic('plus','ic sm')}Outro serviço</button></div>${c.servicos.length?`<ul class="servs">${c.servicos.map((x,j)=>`<li class="serv"><div class="serv-m">${x.serviceId?`<b>${esc(x.nome)}</b>`:`<input id="sv-${x.id}" class="${S.errs&&emp(x.nome)?'invalid':''}" value="${esc(x.nome)}" data-inp="serv" data-k="nome" data-cid="${c.id}" data-sid="${x.id}" placeholder="Descreva o serviço (obrigatório)" aria-label="Serviço externo ${j+1}" autocomplete="off">`}<input value="${esc(x.obs)}" data-inp="serv" data-k="obs" data-cid="${c.id}" data-sid="${x.id}" placeholder="Observação (opcional)" aria-label="Observação do serviço ${j+1}" autocomplete="off"></div><button class="iconb" data-act="delServ" data-cid="${c.id}" data-sid="${x.id}" aria-label="Excluir serviço ${j+1}">${ic('trash')}</button></li>`).join('')}</ul>`:''}</div>`;
}
const leafBad=m=>emp(m.raw)||(m.tipo!=='serv'&&emp(m.material))||!(num(m.qty)>0);
function vMats(c){
  let nmp=0,nsv=0;const mp=precisaMat(c),vis=visLeaves(c),hid=hiddenMp(c);
  const list=c.materials.map((m,j)=>leafOn(c,m)?vMat(c,m,j,m.tipo==='serv'?++nsv:++nmp):'').join('');
  return `<div class="subpanel${S.errs&&vis.some(leafBad)?' invalid-group':''}"><div class="ph-row"><div><h3>${mp?'Materiais e serviços':'Serviços'}</h3><p class="hint" style="margin:0">${mp?'Um componente pode ter várias matérias-primas e serviços.':'Matéria-prima só entra em Fabricar ou Substituir. Serviços valem para qualquer providência.'}</p></div><div class="actions">${mp?`<button class="btn primary" data-act="addMat" data-cid="${c.id}">${ic('plus')}Adicionar matéria-prima</button>`:''}<button class="btn${mp?'':' primary'}" data-act="addLeaf" data-t="serv" data-cid="${c.id}">${ic('plus')}Adicionar serviço</button></div></div>${list||`<p class="hint">${mp?'Nenhuma matéria-prima ou serviço cadastrado.':'Nenhum serviço cadastrado.'}</p>`}${hid?`<p class="hint">${plural(hid,'matéria-prima guardada','matérias-primas guardadas')} de quando o item era Fabricar ou Substituir. Não aparece no documento nem na lista de compras.</p>`:''}</div>`;
}
/* uma folha da estrutura: matéria-prima (com material/norma e dimensão) ou serviço. ord = número dentro do próprio tipo */
function vMat(c,m,j,ord){
  const k=`${c.id}-${j}`,a=`data-inp="m" data-cid="${c.id}" data-j="${j}"`,sv=m.tipo==='serv',nome=leafKind(m);
  const cod=`<div class="field"><label for="mc-${k}">Código <span class="muted">(opcional)</span></label><input id="mc-${k}" ${a} data-k="codigo" value="${esc(m.codigo)}" ${m.semCadastro?'disabled placeholder="Sem cadastro"':''}>${sw('mchk',c.id,'semCadastro',m.semCadastro,'Não tem cadastro',`data-j="${j}"`)}</div>`;
  const head=`<div class="mat-h"><b>${nome} ${ord}</b><button class="btn danger" data-act="delMat" data-cid="${c.id}" data-j="${j}" aria-label="Excluir ${nome.toLowerCase()} ${ord}">${ic('trash')}Excluir</button></div>`;
  const first=sv
    ?`<div class="grid g2"><div class="field"><label for="mr-${k}">Serviço</label><input id="mr-${k}" class="${inv(m.raw).trim()}" ${a} data-k="raw" value="${esc(m.raw)}" placeholder="Ex.: serviço de corte de chapa"></div>${cod}</div>`
    :`<div class="grid g4"><div class="field"><label for="mr-${k}">Matéria-prima</label><input id="mr-${k}" class="${inv(m.raw).trim()}" ${a} data-k="raw" value="${esc(m.raw)}" placeholder="Ex.: chapa, barra redonda"></div><div class="field"><label for="mm-${k}">Material / norma</label><input id="mm-${k}" class="${inv(m.material).trim()}" ${a} data-k="material" value="${esc(m.material)}" placeholder="Ex.: SAE 1020, ASTM A-36"></div><div class="field"><label for="md-${k}">Dimensão <span class="muted">(opcional)</span></label><input id="md-${k}" ${a} data-k="dimensao" data-keep-case value="${esc(m.dimensao)}" placeholder="Ex.: Ø160 mm"></div>${cod}</div>`;
  const qty=`<div class="grid g-mat2"><div class="field"><label for="mq-${k}">Quantidade</label><input id="mq-${k}" class="${S.errs&&!(num(m.qty)>0)?'invalid':''}" type="number" step="any" inputmode="decimal" ${a} data-k="qty" value="${esc(m.qty)}"></div><div class="field"><label for="mu-${k}">Unidade</label><select id="mu-${k}" data-chg="m" data-cid="${c.id}" data-j="${j}" data-k="unit">${UNITS.map(o=>`<option ${m.unit===o?'selected':''}>${o}</option>`).join('')}</select></div><div class="field wide"><label for="mo-${k}">Observação <span class="muted">(opcional)</span></label><input id="mo-${k}" ${a} data-k="obs" value="${esc(m.obs)}"></div></div>`;
  return `<div class="mat">${head}${first}${qty}${sv||emp(m.peso)?'':`<p class="hint" style="margin:0">Peso informado anteriormente: <b>${esc(m.peso)}</b>. Se ainda for necessário, informe na quantidade (unidade kg) ou na observação.</p>`}</div>`;
}

/* ---------- 3. Testes ---------- */
function pressureField(g,kv,ku,val,un,label){
  const id=`t-${g}-${kv}`;
  return `<div class="field"><label for="${id}">${label}</label><div class="pgroup"><input id="${id}" class="${S.errs&&!(num(val)>0)?'invalid':''}" inputmode="decimal" placeholder="Valor" data-keep-case data-inp="t" data-g="${g}" data-k="${kv}" value="${esc(val)}" autocomplete="off"><select aria-label="Unidade de pressão" class="${S.errs&&!un?'invalid':''}" data-chg="tsel" data-g="${g}" data-k="${ku}"><option value="">Unidade</option>${PUN.map(u=>`<option ${un===u?'selected':''}>${u}</option>`).join('')}</select></div></div>`;
}
const SENTIDOS=['Contra a sede','A favor da sede','Em ambos os sentidos'];
function testParams(g,o){
  const id=`t-${g}`;
  return `<div class="grid g3"><div class="field"><label for="${id}-meio">Tipo de teste</label><select id="${id}-meio" class="${S.errs&&emp(o.meio)?'invalid':''}" data-chg="tsel" data-g="${g}" data-k="meio"><option value="">Selecione</option>${MEIOS.map(x=>`<option ${o.meio===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label for="${id}-dur">Duração, min</label><input id="${id}-dur" class="${S.errs&&!(num(o.duracao)>0)?'invalid':''}" inputmode="decimal" data-keep-case data-inp="t" data-g="${g}" data-k="duracao" value="${esc(o.duracao)}" autocomplete="off"></div><div class="field"><label for="${id}-rep">Repetições <span class="muted">(opcional)</span></label><input id="${id}-rep" inputmode="numeric" data-keep-case data-inp="t" data-g="${g}" data-k="rep" value="${esc(o.rep)}" autocomplete="off"></div></div>`;
}
function vTest(){
  const t=T(),a=t.acionamento,s=t.sede,c=t.corpo,g=t.geral;
  const legacySent=s.sentido==='Apenas um sentido';   // valor antigo: continua válido até o usuário escolher um dos novos
  const sentItems=legacySent?[...SENTIDOS,{k:'Apenas um sentido',d:'Valor anterior: escolha um dos novos'}]:SENTIDOS;
  return `<div class="ph"><h1>Procedimento de teste</h1><p>Registro dos testes a realizar. Os dados entram no item TESTE do documento de execução.</p></div>
<div class="panel"><h2>Teste de acionamento</h2><div class="stack">${sw('tchk','acionamento','comissionamento',a.comissionamento,'Comissionamento')}${sw('tchk','acionamento','pressaoAtuador',a.pressaoAtuador,'Pressão do atuador')}${a.pressaoAtuador?pressureField('acionamento','pressaoAtuadorVal','pressaoAtuadorUn',a.pressaoAtuadorVal,a.pressaoAtuadorUn,'Pressão do atuador'):''}</div><div class="field" style="margin-top:14px"><label for="t-ac-obs">Observação <span class="muted">(opcional)</span></label><textarea id="t-ac-obs" rows="2" data-inp="t" data-g="acionamento" data-k="obs">${esc(a.obs)}</textarea></div></div>
<div class="panel" data-ap="${s.na?'no':'yes'}"><div class="ph-row"><h2>Teste de estanqueidade da sede</h2>${applic({on:!s.na,act:'tAp',extra:'data-g="sede"'})}</div>${s.na?'<p class="hint">Este teste não será exigido nem aparecerá preenchido no documento.</p>':`<div class="field"><span class="lbl">Sentido do teste</span>${rcards(sentItems,s.sentido,'sentido','',legacySent?'g4':'g3')}</div>${s.sentido?`<div style="max-width:420px">${pressureField('sede','pressaoVal','pressaoUn',s.pressaoVal,s.pressaoUn,'Pressão')}</div>`:''}${testParams('sede',s)}<div class="field" style="margin-top:4px"><label for="t-sede-obs">Observação <span class="muted">(opcional)</span></label><textarea id="t-sede-obs" rows="2" data-inp="t" data-g="sede" data-k="obs">${esc(s.obs)}</textarea></div>`}</div>
<div class="panel" data-ap="${c.na?'no':'yes'}"><div class="ph-row"><h2>Teste de estanqueidade do corpo</h2>${applic({on:!c.na,act:'tAp',extra:'data-g="corpo"'})}</div>${c.na?'<p class="hint">Este teste não será exigido nem aparecerá preenchido no documento.</p>':`<div style="max-width:420px">${pressureField('corpo','pressaoVal','pressaoUn',c.pressaoVal,c.pressaoUn,'Pressão')}</div>${testParams('corpo',c)}<div class="field" style="margin-top:4px"><label for="t-corpo-obs">Observação <span class="muted">(opcional)</span></label><textarea id="t-corpo-obs" rows="2" data-inp="t" data-g="corpo" data-k="obs">${esc(c.obs)}</textarea></div>`}</div>
<div class="panel"><div class="ph-row"><div><h2>Ensaios adicionais</h2><p class="hint" style="margin:0">Para outros ensaios do procedimento, por exemplo uma segunda estanqueidade da sede com outro tipo de teste e pressão.</p></div><button class="btn primary" data-act="addExtra">${ic('plus')}Adicionar ensaio</button></div>${t.extras.length?t.extras.map((x,j)=>`<div class="mat"><div class="mat-h"><b>Ensaio adicional ${j+1}</b><button class="btn danger" data-act="delExtra" data-j="${j}" aria-label="Excluir ensaio adicional ${j+1}">${ic('trash')}Excluir</button></div><div class="field"><label for="tx-d-${j}">Descrição</label><input id="tx-d-${j}" class="${inv(x.desc).trim()}" data-inp="tx" data-j="${j}" data-k="desc" value="${esc(x.desc)}" autocomplete="off"></div><div class="grid g4"><div class="field"><label for="tx-p-${j}">Pressão <span class="muted">(opcional)</span></label><div class="pgroup"><input id="tx-p-${j}" inputmode="decimal" data-keep-case data-inp="tx" data-j="${j}" data-k="pressaoVal" value="${esc(x.pressaoVal)}" placeholder="Valor" autocomplete="off"><select aria-label="Unidade de pressão" data-chg="txsel" data-j="${j}" data-k="pressaoUn"><option value="">Unidade</option>${PUN.map(u=>`<option ${x.pressaoUn===u?'selected':''}>${u}</option>`).join('')}</select></div></div><div class="field"><label for="tx-t-${j}">Duração, min <span class="muted">(opcional)</span></label><input id="tx-t-${j}" inputmode="decimal" data-keep-case data-inp="tx" data-j="${j}" data-k="duracao" value="${esc(x.duracao)}"></div><div class="field"><label for="tx-r-${j}">Repetições <span class="muted">(opcional)</span></label><input id="tx-r-${j}" inputmode="numeric" data-keep-case data-inp="tx" data-j="${j}" data-k="rep" value="${esc(x.rep)}"></div></div><div class="field" style="margin:10px 0 0"><label for="tx-o-${j}">Observação <span class="muted">(opcional)</span></label><textarea id="tx-o-${j}" rows="2" data-inp="tx" data-j="${j}" data-k="obs">${esc(x.obs)}</textarea></div></div>`).join(''):'<p class="hint">Nenhum ensaio adicional.</p>'}</div>
<div class="panel"><h2>Critério de aceitação</h2><div class="field" style="margin:0"><label for="t-g-crit">Critério de aceitação <span class="muted">(opcional)</span></label><textarea id="t-g-crit" rows="3" data-inp="t" data-g="geral" data-k="criterio">${esc(g.criterio)}</textarea></div></div>`;
}

/* ---------- 4. Embalagem ---------- */
function vPack(){
  const e=cur().embalagem||{};
  return `<div class="ph"><h1>Embalagem do produto</h1><p>Defina como o produto será acondicionado.</p></div><div class="panel">${rcards(EMB.map(o=>({k:o,d:o==='Padrão MINC'?'Embalagem conforme padrão da empresa':'Descreva como embalar este produto'})),e.tipo,'embSet','','g2')}${e.tipo==='Padrão MINC'&&EMB_PADRAO.length?`<div class="subpanel" style="margin-top:16px"><h3>Atividades do padrão</h3><ol class="rp-std">${EMB_PADRAO.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div>`:''}${e.tipo==='Específica'?`<div class="field" style="margin-top:16px"><label for="emb-d">Descrição da embalagem</label><textarea id="emb-d" rows="5" class="${inv(e.descricao).trim()}" placeholder="Descreva detalhadamente como o produto deve ser embalado" data-inp="embDesc">${esc(e.descricao)}</textarea></div>`:''}</div>`;
}

/* ---------- 5. Documento (layout do formulário R-MINC-046-DEP-PT) ---------- */
const pf=(v,u)=>emp(v)?'—':esc(v)+(u?' '+esc(u):'');
const pfs=(v,u)=>emp(v)?'':esc(v)+(u?' '+esc(u):'');
function matLine(m){
  return [m.tipo==='serv'?'Serviço: '+esc(m.raw):esc(m.raw),esc(m.material),esc(m.dimensao),esc(codeOf(m)),emp(m.qty)?'':esc(m.qty)+' '+esc(m.unit)].filter(Boolean).join(' | ');
}
function rpItem({no,nome,prov,desenho,photos=[],lines=[],mats=[],matsT='Materiais a comprar',obs='',semProv=false}){
  const cs=semProv?3:5;   // itens fixos (TESTE, PLACA, EMBALAGEM) não têm providência: a linha de cima tem 4 células em vez de 6
  return `<div class="rp-item"><table class="report-table"><tr><th class="w-s">Item</th><td class="w-s">${no}</td><th class="w-m">Descrição</th><td>${esc(nome)}</td>${semProv?'':`<th class="w-m">Providência</th><td>${esc(prov)||'—'}</td>`}</tr>${desenho?`<tr><th>Desenho</th><td colspan="${cs}">${desenho}</td></tr>`:''}${photos.length?`<tr><th>Imagem</th><td colspan="${cs}"><div class="rp-photos">${photos.map(p=>`<img class="report-photo" src="${Photos.url(p.id)}" alt="">`).join('')}</div></td></tr>`:''}<tr><th>Atividade</th><td colspan="${cs}">${lines.length?`<ol class="rp-lines">${lines.map(l=>`<li>${l}</li>`).join('')}</ol>`:'—'}${mats.length?`<p class="rp-mat"><b>${matsT}:</b></p><ol class="rp-lines">${mats.map(l=>`<li>${l}</li>`).join('')}</ol>`:''}</td></tr><tr><th>Obs.</th><td colspan="${cs}">${esc(obs).replace(/\n/g,'<br>')||'—'}</td></tr></table></div>`;
}
function testeLines(r){
  const t=T(r),a=t.acionamento,s=t.sede,c=t.corpo,g=t.geral,L=[];
  const par=o=>[o.meio?esc(o.meio):'',pfs(o.pressaoVal,o.pressaoUn)?'pressão '+pfs(o.pressaoVal,o.pressaoUn):'',emp(o.duracao)?'':'durante '+esc(o.duracao)+' min',emp(o.rep)?'':esc(o.rep)+' repetição(ões)'].filter(Boolean).join(', ');
  const obsTxt=o=>emp(o.obs)?'':' Observação: '+esc(o.obs).replace(/\n/g,' ')+'.';
  const accParts=[];
  if(a.comissionamento)accParts.push('comissionamento');
  if(a.pressaoAtuador)accParts.push('pressão do atuador '+pf(a.pressaoAtuadorVal,a.pressaoAtuadorUn));
  if(accParts.length)L.push('Teste de acionamento: '+accParts.join('; ')+'.'+obsTxt(a));
  if(!s.na&&(s.sentido||!emp(s.pressaoVal)))L.push('Teste de estanqueidade da sede'+(s.sentido?' ('+esc(s.sentido.toLowerCase())+')':'')+': '+par(s)+'.'+obsTxt(s));
  if(!c.na&&!emp(c.pressaoVal))L.push('Teste de estanqueidade do corpo: '+par(c)+'.'+obsTxt(c));
  t.extras.forEach(x=>{if(!emp(x.desc)){const q=par(x);L.push(esc(x.desc)+(q?': '+q+'.':'.')+obsTxt(x))}});
  if(!emp(g.criterio))L.push('Critério de aceitação: '+esc(g.criterio).replace(/\n/g,'<br>'));
  return L;
}
function plaqLines(r){
  const q=r.plaq,L=[];
  [['Equipamento',q.tipo],['DN',q.dn],['O.S.',q.os],['TAG',q.tag],['Data do reparo',fmtISO(q.data)]]
    .forEach(([k,v])=>{if(!emp(v))L.push(`${k}: ${esc(v)}`)});
  return L;
}
function embLines(r){
  const e=r.embalagem||{};
  if(e.tipo==='Padrão MINC')return EMB_PADRAO.map(esc);
  if(e.tipo==='Específica')return String(e.descricao||'').split(/\n+/).filter(x=>!emp(x)).map(esc);
  return [];
}
/* Modelo único do documento: a tela (HTML) e o PDF arquivado leem exatamente os mesmos itens. */
function reportModel(r){
  const items=treeList(r).map(({c,no})=>({no,nome:c.name,prov:c.acoes.join(' / '),desenho:c.noDrawing?'Sem desenho aplicável':esc(c.drawing),photos:c.photos,lines:[...c.atividades.filter(a=>a.actId||!emp(a.t)).map(a=>esc(a.actId?(a.sector+': '+ativText(a)).toUpperCase():a.t)),...(c.acoes.includes('Serviço externo')?c.servicos.filter(x=>x.serviceId||!emp(x.nome)).map(x=>esc(('Serviço externo: '+x.nome+(emp(x.obs)?'':' — '+x.obs)).toUpperCase())):[])],mats:visLeaves(c).map(matLine),matsT:matsTitle(visLeaves(c)),obs:c.obs}));
  const nComp=items.length;let k=kidsOf(r,null).length;   // TESTE/PLACA/EMBALAGEM continuam a numeração dos componentes principais
  const blank={prov:'',semProv:true,desenho:'',photos:[],mats:[],obs:''};
  const tl=testeLines(r);if(tl.length)items.push({...blank,no:++k,nome:'TESTE',lines:tl});
  const pl=plaqLines(r);if(pl.length)items.push({...blank,no:++k,nome:'PLACA',lines:pl});
  const el=embLines(r);if(el.length)items.push({...blank,no:++k,nome:'EMBALAGEM',lines:el});
  return{items,nComp};
}
function reportHTML(r){
  const m=reportModel(r);
  const comp=m.items.slice(0,m.nComp).map(rpItem).join('');
  const extra=m.items.slice(m.nComp).map(rpItem);
  return `<div class="report"><table class="rp-head"><tr><td class="rp-logo" rowspan="4"><img src="icons/logo-minc.png" alt="MINC" onerror="this.outerHTML='MINC'"></td><td class="rp-title" rowspan="4">${esc(FORM.titulo)}</td><th>Tipo:</th><td>${esc(FORM.tipo)}</td></tr><tr><th>Cód.:</th><td>${esc(FORM.codigo)}</td></tr><tr><th>Rev.:</th><td>${esc(FORM.rev)}</td></tr><tr><th>Data:</th><td>${fmtISO(FORM.data)}</td></tr></table>
<table class="report-table"><tr><th>Equipamento</th><td colspan="3">${esc(r.equipamento)}</td></tr><tr><th>Data</th><td>${fmtISO(r.dataDoc)||'—'}</td><th>Revisão</th><td>${esc(r.revisao)||'—'}</td></tr><tr><th>Peritagem Nomus</th><td>${esc(r.nomus)||'—'}</td><th>Motivo da revisão</th><td>${esc(r.motivoRevisao)||'—'}</td></tr><tr><th>Cliente</th><td colspan="3">${esc(r.cliente)}</td></tr><tr><th>Processo</th><td>${esc(r.process)}</td><th>Pedido / Ordem</th><td>${esc(r.pedido)||'—'} / ${esc(r.ordem)||'—'}</td></tr><tr><th>Tipo de vedação</th><td>${esc(r.vedacao)||'—'}</td><th>Acionamento</th><td>${esc(r.acionamento)||'—'}</td></tr><tr><th>Fluido de trabalho</th><td colspan="3">${esc(r.fluido)||'—'}</td></tr></table>
${r.equipmentPhotos.length?`<h2>Fotos do equipamento</h2><div class="rp-photos">${r.equipmentPhotos.map(p=>`<img class="report-photo" src="${Photos.url(p.id)}" alt="">`).join('')}</div>`:''}
${comp||'<p>Nenhum componente.</p>'}${extra.join('')}${emp(r.observacoes)?'':`<div class="rp-item"><table class="report-table"><tr><th class="w-m">Observações gerais</th><td>${esc(r.observacoes).replace(/\n/g,'<br>')}</td></tr></table></div>`}
<table class="report-table rp-sign"><tr><th>Elaborado por / Data</th><th>Aprovado por / Data</th></tr><tr><td>${esc(r.elaboradoPor)}${r.elaboradoData?' / '+fmtISO(r.elaboradoData):''}<div class="sig"></div></td><td>${esc(r.aprovadoPor)}${r.aprovadoData?' / '+fmtISO(r.aprovadoData):''}<div class="sig"></div></td></tr></table></div>`;
}
function vExec(){
  return `<div class="ph no-print"><h1>Documento de execução</h1><p>Relatório no formato do formulário ${esc(FORM.codigo)}. Gere e arquive o PDF abaixo, ou use “Imprimir / Salvar PDF” na barra inferior.</p></div>${docsPanel(cur())}${reportHTML(cur())}`;
}

/* ---------- 6. Estrutura ---------- */
/* Árvore de componentes, no formato da lista de materiais do Nomus: cada componente pode ter subcomponentes, matérias-primas e serviços.
   O nó da árvore é o MESMO objeto da aba Componentes (parentId liga um ao outro): providência, atividades e fotos continuam
   sendo editadas lá, e o documento de execução não muda. O código é digitado pelo operador por enquanto; quando o Nomus for
   integrado ele virá da busca por nome/código, e a caixa "Não tem cadastro" continua valendo para o que ainda não existe lá. */
const leafKind=m=>m.tipo==='serv'?'Serviço':'Matéria-prima';
const plural=(n,a,b)=>`${n} ${n===1?a:b}`;
function structStats(r){let mp=0,sv=0;r.components.forEach(c=>visLeaves(c).forEach(m=>m.tipo==='serv'?sv++:mp++));return{comp:r.components.length,mp,sv}}
/* lista de compras: matérias-primas (só Fabricar/Substituir) e serviços (qualquer providência) */
function matRows(r){
  const rows=[];
  treeList(r).forEach(({c,no})=>{visLeaves(c).forEach(m=>rows.push({no,comp:c.name,prov:c.acoes.join(' / '),tipo:leafKind(m),raw:m.raw,material:m.tipo==='serv'?'':m.material,dimensao:m.tipo==='serv'?'':m.dimensao,codigo:codeOf(m),unit:m.unit,qty:m.qty,drawing:c.noDrawing?'Sem desenho':c.drawing,obs:m.obs}))});
  return rows;   // já na ordem do documento (1, 1.1, 1.2, 2…)
}
/* a árvore inteira, achatada em linhas (usada na exportação): componente, depois suas folhas, depois seus subcomponentes */
function structRows(r){
  const rows=[],lab=(c,no)=>`${no} — ${c.name||'Sem descrição'}`;
  const rec=(id,lvl,pai)=>kidsOf(r,id).forEach(c=>{
    const no=compNo(r,c);
    rows.push({lvl,no,tipo:'Componente',codigo:codeOf(c),sem:c.semCadastro,desc:c.name,material:'',dimensao:'',unit:c.unid,qty:c.qtd,prov:c.acoes.join(' / '),drawing:c.noDrawing?'Sem desenho':c.drawing,pai,obs:c.obs});
    visLeaves(c).forEach(m=>rows.push({lvl:lvl+1,no:'',tipo:leafKind(m),codigo:codeOf(m),sem:m.semCadastro,desc:m.raw,material:m.tipo==='serv'?'':m.material,dimensao:m.tipo==='serv'?'':m.dimensao,unit:m.unit,qty:m.qty,prov:'',drawing:'',pai:lab(c,no),obs:m.obs}));
    rec(c.id,lvl+1,lab(c,no));
  });
  rec(null,0,'');return rows;
}
function nodeStatus(c,no){const n=compIssues(c,no).length;return n?`<span class="tn-st comp-st warn">${ic('alert','ic sm')}${plural(n,'pendência','pendências')}</span>`:`<span class="tn-st comp-st ok">${ic('check','ic sm')}Completo</span>`}
function vNode(r,c,lvl){
  const id=c.id,no=compNo(r,c),open=!S.tc[id],has=kidsOf(r,id).length>0||visLeaves(c).length>0;
  const ban=descOf(r,id);ban.add(id);   // o pai novo nunca pode ser o próprio componente nem um descendente dele
  const opts=treeList(r).filter(x=>!ban.has(x.c.id)).map(({c:x,no:nx})=>`<option value="${x.id}" ${c.parentId===x.id?'selected':''}>${esc(nx)} — ${esc(x.name)||'Sem descrição'}</option>`).join('');
  const chip=(k,old)=>{const on=c.acoes.includes(k);return `<button type="button" class="chip sm ${on?'on':''}${old?' legacy':''}" role="radio" aria-checked="${on}" data-act="toggleProv" data-cid="${id}" data-v="${esc(k)}" data-fk="np-${id}-${esc(k)}"${old?' title="Opção descontinuada. Toque para remover."':''}>${on?ic('check','ic sm'):''}${esc(k)}</button>`};
  let nmp=0,nsv=0;
  const leaves=c.materials.map((m,j)=>leafOn(c,m)?`<div class="tl" style="--lv:${Math.min(lvl+1,7)}">${vMat(c,m,j,m.tipo==='serv'?++nsv:++nmp)}</div>`:'').join('');
  return `<div class="tn" style="--lv:${Math.min(lvl,6)}" data-cid="${id}"><div class="tn-row"><div class="tn-top">
<button type="button" class="tn-t" data-act="toggleNode" data-cid="${id}" aria-expanded="${open}" aria-label="${open?'Recolher':'Expandir'} ${esc(c.name)||'componente'}" ${has?'':'disabled'} data-fk="nt-${id}">${ic('chev')}</button>
<span class="comp-no" title="Item ${no} do documento">${no}</span>
<div class="tn-f"><div class="field"><label for="sc-${id}">Código</label><input id="sc-${id}" value="${esc(c.codigo)}" data-inp="c" data-cid="${id}" data-k="codigo" autocomplete="off" ${c.semCadastro?'disabled placeholder="Sem cadastro"':''}>${sw('cchk',id,'semCadastro',c.semCadastro,'Não tem cadastro')}</div>
<div class="field"><label for="sn-${id}">Nome / descrição</label><input id="sn-${id}" class="${inv(c.name).trim()}" value="${esc(c.name)}" data-inp="c" data-cid="${id}" data-k="name" autocomplete="off"></div>
<div class="field"><label for="su-${id}">Un.</label><select id="su-${id}" data-chg="c" data-cid="${id}" data-k="unid">${withLegacy(UNITS,c.unid).map(o=>`<option ${c.unid===o?'selected':''}>${esc(o)}</option>`).join('')}</select></div>
<div class="field"><label for="sq-${id}">Qtd.</label><input id="sq-${id}" type="number" step="any" inputmode="decimal" value="${esc(c.qtd)}" data-inp="c" data-cid="${id}" data-k="qtd"></div></div>
${nodeStatus(c,no)}</div>
<div class="tn-bar"><div class="chips tn-prov" role="radiogroup" aria-label="Providência do item ${no}">${PROV.map(k=>chip(k,false)).join('')}${c.acoes.filter(a=>!PROV.includes(a)).map(k=>chip(k,true)).join('')}</div>
<div class="tn-acts"><button type="button" class="btn sm" data-act="addNode" data-pid="${id}">${ic('plus')}Subcomponente</button>${precisaMat(c)?`<button type="button" class="btn sm" data-act="addLeaf" data-t="mp" data-cid="${id}">${ic('plus')}Matéria-prima</button>`:''}<button type="button" class="btn sm" data-act="addLeaf" data-t="serv" data-cid="${id}">${ic('plus')}Serviço</button></div></div>
<details class="tn-more"><summary>Mais opções</summary><div class="tn-more-b"><div class="field"><label for="sp-${id}">Subcomponente de</label><select id="sp-${id}" data-chg="cpar" data-cid="${id}"><option value="">Nível principal</option>${opts}</select></div><div class="actions"><button type="button" class="btn" data-act="openComp" data-cid="${id}">Abrir no componente (atividades e fotos)</button><button type="button" class="btn danger" data-act="delComp" data-cid="${id}">${ic('trash')}Excluir</button></div></div></details>
</div></div>${open?leaves:''}`;
}
function vTree(r){
  if(!r.components.length)return emptyBox('Estrutura vazia','Adicione o primeiro componente. Cada componente pode ter subcomponentes, matérias-primas e serviços, como na lista de materiais do Nomus.','addNode','Adicionar componente');
  const out=[],rec=(id,lvl)=>kidsOf(r,id).forEach(c=>{out.push(vNode(r,c,lvl));if(!S.tc[c.id])rec(c.id,lvl+1)});
  rec(null,0);return out.join('');
}
function vBuy(r){
  const rows=matRows(r);
  return `<div class="panel"><p class="hint" style="margin-top:0">Consolidado do que comprar: matérias-primas dos itens “Fabricar” ou “Substituir” e serviços de qualquer providência.</p>${rows.length?`<div class="tw"><table class="tbl"><thead><tr><th>Item</th><th>Componente</th><th>Providência</th><th>Tipo</th><th>Matéria-prima / serviço</th><th>Material / norma</th><th>Dimensão</th><th>Código</th><th>Un.</th><th>Qtd.</th><th>Desenho</th><th>Obs.</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.no}</td><td class="wrap">${esc(x.comp)}</td><td>${esc(x.prov)}</td><td>${esc(x.tipo)}</td><td class="wrap">${esc(x.raw)}</td><td class="wrap">${esc(x.material)}</td><td>${esc(x.dimensao)}</td><td>${esc(x.codigo)}</td><td>${esc(x.unit)}</td><td>${esc(x.qty)}</td><td>${esc(x.drawing)}</td><td class="wrap">${esc(x.obs)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><p>Nada para comprar ainda. Matérias-primas e serviços de componentes com providência “Fabricar” ou “Substituir” aparecem aqui.</p></div>'}</div>`;
}
function vStructure(){
  const r=cur(),st=structStats(r),buy=S.sv==='buy';
  const seg=`<div class="seg" role="radiogroup" aria-label="Visão da estrutura"><button type="button" class="seg-b ${buy?'':'on'}" role="radio" aria-checked="${!buy}" data-act="structView" data-v="tree" data-fk="sv-tree">Estrutura</button><button type="button" class="seg-b ${buy?'on':''}" role="radio" aria-checked="${buy}" data-act="structView" data-v="buy" data-fk="sv-buy">Lista de compras</button></div>`;
  const tools=buy?'':`<div class="actions"><button type="button" class="btn primary" data-act="addNode">${ic('plus')}Componente</button><button type="button" class="btn" data-act="treeAll" data-v="open">Expandir tudo</button><button type="button" class="btn" data-act="treeAll" data-v="close">Recolher tudo</button></div>`;
  return `<div class="ph"><h1>Estrutura</h1><p>Monte a estrutura do equipamento: cada componente pode ter subcomponentes, matérias-primas e serviços. Indique a providência de cada um aqui mesmo; atividades e fotos ficam na aba Componentes.</p></div>
<div class="panel"><div class="ph-row"><b>${plural(st.comp,'componente','componentes')} · ${plural(st.mp,'matéria-prima','matérias-primas')} · ${plural(st.sv,'serviço','serviços')}</b><div class="actions">${seg}<button class="btn primary" data-act="exportX" ${st.comp?'':'disabled'}>${ic('download')}Exportar Excel</button></div></div>${tools}</div>${buy?vBuy(r):vTree(r)}`;
}
/* Excel: 3 planilhas — Estrutura (árvore com níveis), Compras (o consolidado de sempre) e Para cadastro (itens marcados "Não tem cadastro") */
function exportX(){
  const r=cur(),name='MINC_Estrutura_'+String(r.process||r.id).replace(/[^\w-]+/g,'_');
  const n=v=>isNaN(num(v))?v:num(v),nl=v=>/^\d+$/.test(String(v))?+v:v,st=structRows(r),buy=matRows(r),cad=st.filter(x=>x.sem);
  const sheets=[
    {t:'Estrutura',w:[7,6,15,20,46,24,16,8,10,22,16,12,28],h:['Nível','Item','Tipo','Código','Descrição','Material / norma','Dimensão','Un.','Qtd.','Providência','Desenho','Sem cadastro','Observação'],d:st.map(x=>[x.lvl+1,nl(x.no),x.tipo,x.codigo,'  '.repeat(x.lvl)+(x.desc||''),x.material,x.dimensao,x.unit,n(x.qty),x.prov,x.drawing,x.sem?'Sim':'',x.obs])},
    {t:'Compras',w:[6,30,14,15,28,22,16,18,9,11,18,28],h:['Item','Componente','Providência','Tipo','Matéria-prima / serviço','Material / norma','Dimensão','Código','Unidade','Quantidade','Desenho','Observação'],d:buy.map(x=>[nl(x.no),x.comp,x.prov,x.tipo,x.raw,x.material,x.dimensao,x.codigo,x.unit,n(x.qty),x.drawing,x.obs])}
  ];
  if(cad.length)sheets.push({t:'Para cadastro',w:[15,40,24,16,8,10,34,28],h:['Tipo','Descrição','Material / norma','Dimensão','Un.','Qtd.','Pertence a','Observação'],d:cad.map(x=>[x.tipo,x.desc,x.material,x.dimensao,x.unit,n(x.qty),x.pai,x.obs])});
  if(window.XLSX){
    const wb=XLSX.utils.book_new();
    sheets.forEach(s=>{const ws=XLSX.utils.aoa_to_sheet([s.h,...s.d]);ws['!cols']=s.w.map(wch=>({wch}));XLSX.utils.book_append_sheet(wb,ws,s.t)});
    XLSX.writeFile(wb,name+'.xlsx');
  }else{
    const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"',s=sheets[0];
    const csv='\ufeff'+[s.h,...s.d].map(l=>l.map(q).join(';')).join('\r\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=name+'.csv';a.click();
    toast('Exportado em CSV com a estrutura (a biblioteca de Excel não carregou).');
  }
}

/* ============================== Documento em PDF + arquivo versionado (Fase C) ==============================
   O PDF é gerado no aparelho (funciona offline), guardado numa fila local e enviado ao Supabase Storage quando há internet.
   Cada geração cria uma NOVA versão (nada é sobrescrito). Registro e histórico ficam na tabela process_documents. */
const DOCS_BUCKET='documentos-peritagem';
const PDF_LIBS=['vendor/jspdf.umd.min.js','vendor/jspdf.plugin.autotable.min.js'];
const loadScript=src=>new Promise((ok,no)=>{const e=document.createElement('script');e.src=src;e.onload=ok;e.onerror=()=>no(new Error('Não foi possível carregar '+src));document.head.append(e)});
async function pdfLib(){
  if(!window.jspdf)await loadScript(PDF_LIBS[0]);
  if(typeof window.jspdf.jsPDF.API.autoTable!=='function')await loadScript(PDF_LIBS[1]);
}
/* texto para fontes padrão do PDF (Helvetica/WinAnsi): troca o que ela não desenha */
const pdfTxt=v=>String(v??'').replace(/[\u2013\u2014\u2212]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/\u2022/g,'-').replace(/\u2026/g,'...').replace(/\u00A0/g,' ').replace(/[^\n\x20-\x7E\xA0-\xFF]/g,'?');
const plain=h=>String(h??'').replace(/<br\s*\/?>/g,'\n').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
const blobToDataURL=b=>new Promise((ok,no)=>{const f=new FileReader();f.onload=()=>ok(f.result);f.onerror=()=>no(f.error);f.readAsDataURL(b)});
const LOGO_RATIO_FALLBACK=471/188;   // proporção do arquivo da logo oficial; usada se o navegador não conseguir medir a imagem
let LOGO_PDF;   // undefined=não tentado, null=sem logo (usa "MINC" em texto), {url,ratio}=logo pronta
async function logoForPdf(){
  if(LOGO_PDF!==undefined)return LOGO_PDF;
  try{
    const res=await fetch('icons/logo-minc.png');if(!res.ok)throw new Error('404');
    const url=await blobToDataURL(await res.blob());
    let ratio=LOGO_RATIO_FALLBACK;
    // medir a imagem é só um refinamento (ajusta a proporção se a logo um dia for trocada por outra com formato diferente);
    // nunca pode travar a geração do PDF, então tem um limite curto e cai no valor padrão se não responder a tempo
    try{const dim=await withTimeout(new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok({w:im.naturalWidth,h:im.naturalHeight});im.onerror=no;im.src=url}),3000);if(dim.w>0&&dim.h>0)ratio=dim.w/dim.h}catch{}
    LOGO_PDF={url,ratio};
  }catch(e){LOGO_PDF=null}
  return LOGO_PDF;
}
async function photoData(id){
  const rec=await Store.get('photos',id).catch(()=>null);if(!rec||!rec.blob)return null;
  try{   // reduz para ~900 px: PDF leve (a foto original continua guardada em alta)
    const bmp=await createImageBitmap(rec.blob),k=Math.min(1,900/Math.max(bmp.width,bmp.height));
    const c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);bmp.close&&bmp.close();
    return{url:c.toDataURL('image/jpeg',.7),w:c.width,h:c.height};
  }catch{try{return{url:await blobToDataURL(rec.blob),w:4,h:3}}catch{return null}}
}
async function pdfPhotos(doc,list,y,M){
  const imgs=[];for(const p of list){const d=await photoData(p.id);if(d)imgs.push(d)}
  if(!imgs.length)return y;
  const bw=42,bh=32,gap=3,per=Math.max(1,Math.floor((210-2*M+gap)/(bw+gap)));
  imgs.forEach((d,i)=>{
    if(i%per===0){if(i>0)y+=bh+gap;if(y+bh>297-16){doc.addPage();y=M}}
    const x=M+(i%per)*(bw+gap),k=Math.min(bw/d.w,bh/d.h),w=d.w*k,h=d.h*k;
    try{doc.addImage(d.url,'JPEG',x+(bw-w)/2,y+(bh-h)/2,w,h)}catch(e){console.error('foto no PDF',e)}
    doc.setDrawColor(150);doc.rect(x,y,bw,bh);
  });
  return y+bh+gap;
}
async function buildPdf(r,{compress=true}={}){
  await pdfLib();
  const {jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4',compress}),M=12;
  const grid={theme:'grid',styles:{font:'helvetica',fontSize:8,cellPadding:1.6,lineColor:[0,0,0],lineWidth:.2,textColor:[0,0,0],valign:'top'},margin:{left:M,right:M,top:M,bottom:16}};
  const H=t=>({content:pdfTxt(t),styles:{fillColor:[236,236,236],fontStyle:'bold'}});
  const V=t=>pdfTxt(emp(t)?'-':t);
  const m=reportModel(r);
  const logo=await logoForPdf();
  doc.setProperties({title:pdfTxt(`${FORM.titulo} - ${r.equipamento||''}`),subject:pdfTxt(`Processo ${r.process||''}`),author:pdfTxt(S.user?.name||''),creator:'MINC Peritagem'});
  doc.autoTable({...grid,startY:M,body:[[{content:logo?'':'MINC',rowSpan:4,styles:{halign:'center',valign:'middle',fontStyle:'bold',fontSize:18,cellWidth:26}},{content:pdfTxt(FORM.titulo),rowSpan:4,styles:{halign:'center',valign:'middle',fontStyle:'bold',fontSize:11}},H('Tipo:'),pdfTxt(FORM.tipo)],[H('Cód.:'),pdfTxt(FORM.codigo)],[H('Rev.:'),V(FORM.rev)],[H('Data:'),V(fmtISO(FORM.data))]],columnStyles:{2:{cellWidth:16},3:{cellWidth:38}},
    didDrawCell:(data)=>{
      if(!logo||data.section!=='body'||data.column.index!==0||data.row.index!==0)return;
      const pad=1.5,availW=data.cell.width-pad*2,availH=data.cell.height-pad*2;
      let w=availW,h=w/logo.ratio;if(h>availH){h=availH;w=h*logo.ratio}
      if(!(w>0)||!(h>0))return;
      const x=data.cell.x+(data.cell.width-w)/2,y=data.cell.y+(data.cell.height-h)/2;
      try{doc.addImage(logo.url,'PNG',x,y,w,h)}catch(e){console.error('logo no PDF',e)}
    }});
  doc.autoTable({...grid,startY:doc.lastAutoTable.finalY+3,body:[[H('Equipamento'),{content:V(r.equipamento),colSpan:3}],[H('Data'),V(fmtISO(r.dataDoc)),H('Revisão'),V(r.revisao)],[H('Peritagem Nomus'),V(r.nomus),H('Motivo da revisão'),V(r.motivoRevisao)],[H('Cliente'),{content:V(r.cliente),colSpan:3}],[H('Processo'),V(r.process),H('Pedido / Ordem'),pdfTxt((r.pedido||'-')+' / '+(r.ordem||'-'))],[H('Tipo de vedação'),V(r.vedacao),H('Acionamento'),V(r.acionamento)],[H('Fluido de trabalho'),{content:V(r.fluido),colSpan:3}]],columnStyles:{0:{cellWidth:34},2:{cellWidth:34}}});
  let y=doc.lastAutoTable.finalY+3;
  if(r.equipmentPhotos.length){doc.setFontSize(9);doc.setFont('helvetica','bold');doc.text('Fotos do equipamento',M,y+3);y=await pdfPhotos(doc,r.equipmentPhotos,y+5,M)}
  for(const it of m.items){
    const cs=it.semProv?3:5;   // TESTE, PLACA e EMBALAGEM: sem a célula de providência
    const rows=[[H('Item'),{content:String(it.no),styles:{halign:'center'}},H('Descrição'),V(it.nome),...(it.semProv?[]:[H('Providência'),V(it.prov)])]];
    if(it.desenho)rows.push([H('Desenho'),{content:V(plain(it.desenho)),colSpan:cs}]);
    let at=it.lines.map((l,i)=>`${i+1}. ${plain(l)}`).join('\n');
    if(it.mats.length)at+=(at?'\n\n':'')+(it.matsT||'Materiais a comprar')+':\n'+it.mats.map((l,i)=>`${i+1}. ${plain(l)}`).join('\n');
    rows.push([H('Atividade'),{content:V(at),colSpan:cs}]);
    rows.push([H('Obs.'),{content:V(it.obs),colSpan:cs}]);
    doc.autoTable({...grid,startY:y,body:rows,rowPageBreak:'avoid',columnStyles:{0:{cellWidth:18},1:{cellWidth:13},2:{cellWidth:22},4:{cellWidth:24}}});
    y=doc.lastAutoTable.finalY;
    if(it.photos.length){doc.setFontSize(7);doc.setFont('helvetica','normal');doc.text('Imagem',M,y+3.5);y=await pdfPhotos(doc,it.photos,y+5,M)}
    y+=3;
  }
  if(!emp(r.observacoes)){doc.autoTable({...grid,startY:y,body:[[H('Observações gerais'),V(r.observacoes)]],columnStyles:{0:{cellWidth:34}}});y=doc.lastAutoTable.finalY+3}
  if(y>297-60){doc.addPage();y=M}
  doc.autoTable({...grid,startY:y,head:[[H('Elaborado por / Data'),H('Aprovado por / Data')]],body:[[{content:pdfTxt((r.elaboradoPor||'')+(r.elaboradoData?' / '+fmtISO(r.elaboradoData):'')+'\n\n\n'),styles:{minCellHeight:22}},{content:pdfTxt((r.aprovadoPor||'')+(r.aprovadoData?' / '+fmtISO(r.aprovadoData):'')+'\n\n\n'),styles:{minCellHeight:22}}]]});
  const n=doc.getNumberOfPages();
  for(let i=1;i<=n;i++){doc.setPage(i);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(90);doc.text(pdfTxt(`${FORM.codigo}  Rev. ${FORM.rev||'-'}  |  Processo ${r.process||'-'}  |  Pagina ${i} de ${n}`),M,297-8)}
  return{bytes:doc.output('arraybuffer'),pages:n};
}
const slug=(v,max=28)=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,max);
function docFileName(r,when=new Date()){
  const d=when.toISOString().slice(0,10),t=when.toISOString().slice(11,16).replace(':','');
  return [slug(r.process)||'SEM-PROCESSO',slug(r.pedido)||'SEM-PEDIDO',slug(r.equipamento)||'EQUIPAMENTO','Rev'+(slug(r.revisao||FORM.rev,6)||'00'),d,t].join('_')+'.pdf';
}
const uuid4=()=>window.crypto?.randomUUID?window.crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16)});
async function sha256(bytes){try{const h=await window.crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')}catch{return null}}
const kb=n=>n>=1048576?(n/1048576).toFixed(1).replace('.',',')+' MB':Math.max(1,Math.round(n/1024))+' KB';
function saveBytes(bytes,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));a.download=name;document.body.append(a);a.click();a.remove()}
const Docs={
  cache:new Map(),pending:new Map(),loaded:new Set(),
  /* carrega (uma vez por abertura) os documentos locais pendentes e a lista da nuvem */
  prepare(pid){
    if(this.loaded.has(pid))return;this.loaded.add(pid);
    (async()=>{
      try{this.pending.set(pid,(await Store.all('docs')).filter(d=>d.procId===pid&&!d.up))}catch{}
      try{await this.refresh(pid)}catch(e){console.error('documentos',e)}
      if(S.screen==='execution'&&S.id===pid)renderMain();
    })();
  },
  async refresh(pid){
    if(!CLOUD||!navigator.onLine)return false;
    const r=await SB.from('process_documents').select('*').eq('process_id',pid).order('version',{ascending:false});
    if(r.error)throw r.error;this.cache.set(pid,r.data);return true;
  },
  find(id){for(const l of this.cache.values()){const d=l.find(x=>x.id===id);if(d)return{srv:d}}for(const l of this.pending.values()){const d=l.find(x=>x.id===id);if(d)return{local:d}}return null},
  async generate(r,note){
    const {bytes,pages}=await buildPdf(r);
    const when=new Date(),rec={id:uuid4(),procId:r.id,bytes,pages,snapshot:JSON.stringify({form:FORM,generatedAt:when.toISOString(),generatedBy:S.user?.name||'',process:toRow(r)}),
      fileName:docFileName(r,when),note:emp(note)?'':String(note).trim(),size:bytes.byteLength,sha256:await sha256(bytes),formCode:FORM.codigo,formRev:FORM.rev||'',processRev:r._rev??null,byName:S.user?.name||'',at:when.toISOString(),up:false};
    if(!CLOUD)return rec;          // modo local: só baixa
    await Store.put('docs',rec);
    this.pending.set(r.id,[rec,...(this.pending.get(r.id)||[])]);this.loaded.add(r.id);
    return rec;
  },
  async url(d,{download=false}={}){
    if(d.local){return URL.createObjectURL(new Blob([d.local.bytes],{type:'application/pdf'}))}
    if(!navigator.onLine)throw new Error('Sem conexão: a versão arquivada só abre com internet.');
    const name=d.srv.file_name.replace(/\.pdf$/i,'')+'_v'+d.srv.version+'.pdf';
    const r=await SB.storage.from(DOCS_BUCKET).createSignedUrl(d.srv.storage_path,120,download?{download:name}:undefined);
    if(r.error)throw r.error;return r.data.signedUrl;
  }
};
function docsPanel(r){
  if(!CLOUD)return `<div class="panel no-print"><div class="ph-row"><div><h2>Arquivo em PDF</h2><p class="hint" style="margin:0">Gera o PDF do documento neste aparelho. O arquivamento por versão na nuvem fica disponível com o Supabase ligado.</p></div><button class="btn primary" data-act="docDownloadNow">${ic('download')}Baixar PDF</button></div></div>`;
  Docs.prepare(r.id);
  const srv=Docs.cache.get(r.id),pend=Docs.pending.get(r.id)||[],isAdmin=S.user?.cloudRole==='admin';
  const li=(badge,title,meta,nameTxt,id,del)=>`<li class="doc"><div class="doc-h">${badge}<b>${title}</b><small>${meta}</small></div><div class="doc-m">${nameTxt}</div><div class="doc-a"><button class="btn" data-act="docOpen" data-id="${id}">Ver</button><button class="btn" data-act="docSave" data-id="${id}">${ic('download')}Baixar</button>${del?`<button class="iconb" data-act="docDel" data-id="${id}" aria-label="Excluir esta versão">${ic('trash')}</button>`:''}</div></li>`;
  const rows=[...pend.map(d=>li('<span class="badge st-amber">Aguardando envio</span>','Nova versão',fmt(d.at)+' — '+esc(d.byName),esc(d.fileName)+' — '+kb(d.size)+(d.note?`<br><i>${esc(d.note)}</i>`:''),d.id,false)),
    ...(srv||[]).map(d=>li(`<span class="badge ${d.is_current?'st-green':'st-gray'}">${d.is_current?'Atual':'Substituída'}</span>`,'Versão '+d.version,fmt(d.generated_at)+' — '+esc(d.generated_by_name||''),esc(d.file_name)+(d.size_bytes?' — '+kb(d.size_bytes):'')+(d.note?`<br><i>${esc(d.note)}</i>`:''),d.id,isAdmin))];
  return `<div class="panel no-print"><div class="ph-row"><div><h2>Documentos arquivados</h2><p class="hint" style="margin:0">Cada geração cria uma nova versão em PDF na nuvem. As anteriores ficam no histórico.</p></div><button class="btn primary" data-act="docGen">${ic('save')}Gerar e arquivar nova versão</button></div>${srv===undefined&&!pend.length?'<div class="sk" style="height:64px;margin-top:12px"></div>':rows.length?`<ul class="docs">${rows.join('')}</ul>`:`<p class="hint" style="margin:12px 0 0">${navigator.onLine?'Nenhuma versão arquivada ainda.':'Sem conexão: a lista da nuvem aparece quando a internet voltar.'}</p>`}</div>`;
}

/* ---------- Administração ---------- */
function vAdmin(){
  if(CLOUD)return vAdminCloud();
  const us=Auth.list();
  return `<div class="ph"><button class="btn ghost" data-act="home">${ic('back')}Voltar</button><h1>Administração</h1><p>Usuários com acesso a este aparelho.</p></div>
<div class="panel"><h2>Novo usuário</h2><form data-submit="newUser"><div class="grid g4"><div class="field"><label for="un">Nome</label><input id="un" name="name" required autocomplete="off"><label class="switch name-caps"><input type="checkbox" name="caps" id="un-caps" data-chg="nameCaps" checked><span class="track"></span><span>Nome em CAIXA ALTA</span></label></div><div class="field"><label for="ul">Login</label><input id="ul" name="login" required data-keep-case autocapitalize="off"></div><div class="field"><label for="up">Senha temporária</label><input id="up" name="pw" type="password" required minlength="6" autocomplete="new-password"></div><div class="field"><label for="ur">Perfil</label><select id="ur" name="role"><option>Funcionário</option><option>Administrador</option></select></div></div><p class="hint">O usuário troca a senha no primeiro acesso. O controle de acesso é local, neste aparelho; perfis e auditoria centralizados dependem do banco de dados central.</p><button class="btn primary" type="submit">Cadastrar usuário</button></form></div>
<div class="panel"><div class="tw"><table class="tbl"><thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th></th></tr></thead><tbody>${us.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.login)}</td><td>${esc(u.role)}</td><td><div class="actions"><button class="btn" data-act="resetPw" data-id="${u.id}">Redefinir senha</button>${u.login==='admin'||u.id===S.user.id?'':`<button class="btn danger" data-act="delUser" data-id="${u.id}">Excluir</button>`}</div></td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ============================== Nuvem (Supabase) ==============================
   Ligado quando config.js define supabaseUrl/supabaseKey (a chave "publishable" é pública por desenho;
   a proteção real está nas regras RLS do banco). Sem config.js o app funciona em modo local, como antes. */
const CFG=window.MINC_CONFIG||{};
const CLOUD=!!(CFG.supabaseUrl&&CFG.supabaseKey&&window.supabase&&window.supabase.createClient);
const BUCKET='peritagem-fotos';
const AUTH_LINK=(()=>{const h=new URLSearchParams((location.hash||'').replace(/^#/,'')),q=new URLSearchParams(location.search);return{type:h.get('type')||q.get('type'),error:h.get('error_description')||q.get('error_description')}})();
const SB=CLOUD?window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'minc-auth'}}):null;

function cloudErrMsg(e){
  const m=String(e?.message||e||'');
  if(/Invalid login credentials/i.test(m))return 'E-mail ou senha inválidos.';
  if(/Email not confirmed/i.test(m))return 'E-mail ainda não confirmado.';
  if(/banned|user is blocked/i.test(m))return 'Este acesso está bloqueado. Fale com um administrador.';
  if(/fetch|network|Retryable/i.test(m)||e?.name==='AuthRetryableFetchError')return 'Sem conexão com o servidor.';
  return m||'Erro inesperado.';
}
const userFromProfile=(p,email)=>({id:p.id,name:p.name||email,login:email||p.email||'',role:p.role==='admin'?'Administrador':'Funcionário',cloudRole:p.role,status:p.status||'ativo'});
const homeScreen=p=>p.status==='bloqueado'?'blocked':p.role==='pendente'?'pending':'home';
async function loadProfile(user){
  try{
    const {data,error}=await SB.from('profiles').select('id,name,email,role,status').eq('id',user.id).single();
    if(error)throw error;
    localStorage.setItem('minc_profile',JSON.stringify(data));return data;
  }catch(e){
    let c=null;try{c=JSON.parse(localStorage.getItem('minc_profile'))}catch{}
    if(c&&c.id===user.id)return c;   // sem internet: usa o perfil guardado na última entrada
    throw e;
  }
}
function enter(prof,email){
  S.user=userFromProfile(prof,email);S.screen=homeScreen(prof);S.anim='up';render();
  if(S.screen==='home')Sync.start();
}
const Cloud={
  async login(email,pw){const {data,error}=await SB.auth.signInWithPassword({email:String(email).trim(),password:pw});if(error)throw error;return data.user},
  async restore(){const {data}=await SB.auth.getSession();return data?.session?.user||null},
  async logout(){try{await SB.auth.signOut({scope:'local'})}catch{}localStorage.removeItem('minc_profile')}
};
async function callAdmin(body){
  if(!navigator.onLine)throw new Error('Sem conexão com a internet.');
  const r=await SB.functions.invoke('admin-users',{body});
  if(r.error){let msg='Não foi possível concluir a operação.';try{const j=await r.error.context.json();if(j&&j.error)msg=j.error}catch{}throw new Error(msg)}
  if(!r.data||!r.data.ok)throw new Error((r.data&&r.data.error)||'Falha na operação.');
  return r.data;
}
async function loadAdmin(){
  S.admin={rows:null};if(S.screen==='admin')renderMain();
  try{
    const [u,a]=await Promise.all([SB.from('profiles').select('id,name,email,role,status,created_at').order('created_at'),SB.from('admin_audit').select('*').order('at',{ascending:false}).limit(15)]);
    if(u.error)throw u.error;
    S.admin={rows:u.data,audit:a.error?[]:a.data};
  }catch(e){S.admin={rows:[],audit:[],err:cloudErrMsg(e)}}
  if(S.screen==='admin')renderMain();
}
function adminHead(){
  return `<div class="ph"><button class="btn ghost" data-act="home">${ic('back')}Voltar</button><h1>Administração</h1><p>Usuários e catálogos usados nos formulários.</p></div><div class="seg adm-tabs" role="tablist" aria-label="Seções da administração" style="max-width:420px;margin-bottom:16px">${[['users','Usuários'],['catalog','Catálogos']].map(([k,t])=>`<button class="seg-b ${S.adminTab===k?'on':''}" role="tab" aria-selected="${S.adminTab===k}" data-act="adminTab" data-v="${k}" data-fk="adm-${k}">${t}</button>`).join('')}</div>`;
}
function vAdminCloud(){
  if(S.adminTab==='catalog')return adminHead()+vCatalogAdmin();
  const a=S.admin||{};
  const opts=[['admin','Administrador'],['operador','Funcionário'],['pendente','Aguardando aprovação']];
  const novo=`<div class="panel"><h2>Novo usuário</h2><p class="hint">A pessoa recebe um convite e define a própria senha. Você nunca vê nem define a senha de ninguém.</p><form data-submit="inviteUser"><div class="grid g4"><div class="field"><label for="nu-name">Nome</label><input id="nu-name" name="name" required minlength="2" autocomplete="off"><label class="switch name-caps"><input type="checkbox" name="caps" id="nu-caps" data-chg="nameCaps" checked><span class="track"></span><span>Nome em CAIXA ALTA</span></label></div><div class="field"><label for="nu-email">E-mail</label><input id="nu-email" name="email" type="email" required data-keep-case autocapitalize="off" autocomplete="off"></div><div class="field"><label for="nu-role">Perfil</label><select id="nu-role" name="role"><option value="operador">Funcionário</option><option value="admin">Administrador</option></select></div><div class="field"><label for="nu-mode">Como enviar o acesso</label><select id="nu-mode" name="mode"><option value="email">Enviar convite por e-mail</option><option value="link">Gerar link para eu enviar</option></select></div></div><button class="btn primary" type="submit">${ic('plus')}Cadastrar usuário</button></form></div>`;
  const tabela=!a.rows?'<div class="sk" style="height:120px"></div>':a.err?`<div class="errbox">${esc(a.err)}</div>`:`<div class="tw"><table class="tbl"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Acesso</th></tr></thead><tbody>${a.rows.map(u=>{const me=u.id===S.user.id;return `<tr class="${u.status==='bloqueado'?'off-row':''}"><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td><select aria-label="Perfil de ${esc(u.name)}" data-chg="role" data-id="${u.id}" ${me?'disabled':''}>${opts.map(([v,l])=>`<option value="${v}" ${u.role===v?'selected':''}>${l}</option>`).join('')}</select></td><td>${me?'<span class="badge st-green">Você</span>':`<label class="switch"><input type="checkbox" data-chg="userStatus" data-id="${u.id}" data-name="${esc(u.name)}" ${u.status==='ativo'?'checked':''}><span class="track"></span><span>${u.status==='ativo'?'Ativo':'Bloqueado'}</span></label>`}</td><td><div class="actions"><button class="btn" data-act="userResend" data-id="${u.id}" data-mode="email">Reenviar acesso</button><button class="btn" data-act="userResend" data-id="${u.id}" data-mode="link">Gerar link</button></div></td></tr>`}).join('')}</tbody></table></div>`;
  const hist=(a.audit||[]).length?`<div class="panel"><h2>Últimas ações</h2><ul class="audit">${a.audit.map(x=>`<li><b>${esc(x.action)}</b> ${esc(x.target_email||'')} <small>por ${esc(x.actor_email||'')} em ${fmt(x.at)}</small></li>`).join('')}</ul></div>`:'';
  return `${adminHead()}${novo}<div class="panel"><h2>Usuários</h2><p class="hint">Perfil “Aguardando aprovação” e usuários bloqueados não acessam nenhum dado. Todas as alterações passam por uma função segura no servidor e ficam registradas.</p>${tabela}</div>${hist}`;
}
function linkDialog(link,email){
  dialog(`<div class="dlg-body"><h2>Link de acesso</h2><p>Envie este link para <b>${esc(email)}</b>. Ele serve para definir a senha e expira em pouco tempo; não compartilhe com mais ninguém.</p><textarea id="lnk" rows="4" readonly data-keep-case>${esc(link)}</textarea><div class="actions end"><button class="btn" data-act="copyLink">Copiar link</button><button class="btn primary" data-act="closeDlg">Fechar</button></div></div>`);
}
/* ---- editor dos catálogos (só administrador, só online) ---- */
const CAT_TABLE={sector:'catalog_sectors',activity:'catalog_activities',service:'catalog_external_services'};
function catList(t,parent){
  if(t==='sector')return[...CATALOG.sectors].sort(byPos);
  if(t==='service')return[...CATALOG.services].sort(byPos);
  const sec=CATALOG.sectors.find(x=>x.id===parent);return sec?[...sec.activities].sort(byPos):[];
}
function catRow(t,it,parent,extra=''){
  const nav=d=>`<button class="iconb" data-act="catMove" data-t="${t}" data-id="${it.id}" data-parent="${esc(parent||'')}" data-dir="${d}" aria-label="${d<0?'Subir':'Descer'} ${esc(it.name)}">${ic(d<0?'up':'chev')}</button>`;
  return `<div class="cat-row ${it.active?'':'off'}"><input class="cat-name" data-keep-case aria-label="Nome" value="${esc(it.name)}" data-chg="catName" data-t="${t}" data-id="${it.id}">${extra}<label class="switch"><input type="checkbox" data-chg="catActive" data-t="${t}" data-id="${it.id}" ${it.active?'checked':''}><span class="track"></span><span>Ativo</span></label><span class="ativ-b">${nav(-1)}${nav(1)}</span></div>`;
}
function catAddBox(t,parent,label,id){
  return `<div class="cat-add"><input id="${id}" data-keep-case placeholder="${esc(label)}" aria-label="${esc(label)}" autocomplete="off"><button class="btn" data-act="catAdd" data-t="${t}" data-parent="${esc(parent||'')}" data-inp="${id}">${ic('plus')}Adicionar</button></div>`;
}
function vCatalogAdmin(){
  const secs=[...CATALOG.sectors].sort(byPos);
  const note=CATALOG.src==='cloud'?'':'<p class="errbox" style="margin-bottom:12px">Mostrando o catálogo padrão deste aparelho. Entre com internet para carregar e editar o catálogo da nuvem.</p>';
  return `${note}<div class="panel"><h2>Setores e atividades</h2><p class="hint">Cada atividade pertence a um setor. Itens desativados deixam de aparecer para escolha, mas continuam nos documentos já feitos. Marque “Exige detalhe” quando a linha precisar de texto complementar.</p>${secs.map(sec=>`<section class="cat-sec ${sec.active?'':'off'}" aria-label="Setor ${esc(sec.name)}"><h3>Setor</h3>${catRow('sector',sec,'')}<div class="cat-acts"><h4>Atividades de ${esc(sec.name)}</h4>${[...sec.activities].sort(byPos).map(a=>catRow('activity',a,sec.id,`<label class="switch"><input type="checkbox" data-chg="catReq" data-id="${a.id}" ${a.requiresDetail?'checked':''}><span class="track"></span><span>Exige detalhe</span></label>`)).join('')||'<p class="hint">Nenhuma atividade.</p>'}${catAddBox('activity',sec.id,'Nova atividade em '+sec.name,'cadd-a-'+sec.id)}</div></section>`).join('')}${catAddBox('sector','','Novo setor','cadd-sector')}</div><div class="panel"><h2>Serviços externos</h2><p class="hint">Opções que aparecem quando o item tem a providência “Serviço externo”.</p>${[...CATALOG.services].sort(byPos).map(x=>catRow('service',x,'')).join('')||'<p class="hint">Nenhum serviço cadastrado.</p>'}${catAddBox('service','','Novo serviço externo','cadd-service')}</div>`;
}
async function catWrite(fn){
  if(!navigator.onLine){toast('Sem conexão: o catálogo só pode ser editado online.');renderMain();return false}
  if(CATALOG.src!=='cloud'){toast('Carregue o catálogo da nuvem antes de editar.');renderMain();return false}
  const r=await fn();
  if(r&&r.error){toast(r.error.code==='23505'?'Já existe um item com esse nome.':cloudErrMsg(r.error));await Catalog.refresh().catch(()=>{});renderMain();return false}
  await Catalog.refresh().catch(()=>{});renderMain();return true;
}

/* ---- conversão processo local <-> linha do banco ---- */
const photoRefs=p=>[...p.equipmentPhotos.map(x=>({...x,cid:null})),...p.anexos.map(x=>({...x,cid:null,file:true})),...p.components.flatMap(c=>[...c.photos.map(x=>({...x,cid:c.id})),...c.anexos.map(x=>({...x,cid:c.id,file:true}))])];

/* ---- pasta do processo na nuvem: Processo + Pedido + Equipamento + Cliente ----
   Tudo do processo (fotos, anexos, documentos arquivados) fica dentro dela. O nome é fixado na primeira vez em que algo
   é enviado (guardado em p.pasta, vai junto com o processo) e só nasce com os quatro campos preenchidos. Arquivos antigos
   continuam em <id do processo>/ e seguem sendo lidos de lá. */
function folderName(p){
  const parts=[p.process,p.pedido,p.equipamento,p.cliente].map(v=>slug(v,40));
  return parts.every(Boolean)?parts.join('_'):null;
}
function ensureFolder(p){
  if(p.pasta)return p.pasta;
  const f=folderName(p);if(!f)return null;
  p.pasta=f;p._dirty=true;Store.put('processes',p).catch(()=>{});Sync.kick(1500);
  return f;
}
const anexExt=r=>/^\.[a-z0-9]{1,8}$/.test(r.ext||'')?r.ext:'';
const cloudPath=(pasta,r)=>r.file||r.kind==='file'?`${pasta}/anexos/${r.id}${anexExt(r)}`:`${pasta}/fotos/${r.id}.jpg`;
const legacyPath=(pid,r)=>`${pid}/${r.id}.jpg`;
function toRow(p){
  const data={};for(const k of Object.keys(p))if(!k.startsWith('_'))data[k]=p[k];
  return{id:p.id,process_no:p.process||null,pedido:p.pedido||null,ordem:p.ordem||null,equipamento:p.equipamento||null,cliente:p.cliente||null,status:p.status,deleted_at:p.deletedAt||null,data};
}
function fromRow(r){
  const o={...(r.data||{}),id:r.id,process:r.process_no||'',pedido:r.pedido||'',ordem:r.ordem||'',equipamento:r.equipamento||'',cliente:r.cliente||'',status:r.status,updatedAt:r.updated_at,_rev:r.rev,_dirty:false,_conflict:null};
  if(r.deleted_at)o.deletedAt=r.deleted_at;else delete o.deletedAt;
  return normalize(o);
}
function replaceLocal(loc,n){Object.keys(loc).forEach(k=>delete loc[k]);Object.assign(loc,n)}
function queuePhotoDelete(rec){
  let q=[];try{q=JSON.parse(localStorage.getItem('minc_photo_del'))||[]}catch{}
  const p=PROCS.find(x=>x.id===rec.procId),paths=[legacyPath(rec.procId,rec)];
  if(p&&p.pasta)paths.push(cloudPath(p.pasta,rec));
  q.push({id:rec.id,path:paths});localStorage.setItem('minc_photo_del',JSON.stringify(q))}

/* ---- motor de sincronização: local primeiro, nuvem depois ---- */
const Sync={
  state:'idle',running:false,timer:null,iv:null,
  enabled(){return CLOUD&&!!S.user&&S.user.cloudRole&&S.user.cloudRole!=='pendente'&&S.user.status!=='bloqueado'&&S.screen!=='setpw'},
  pendingCount(){return PROCS.filter(p=>p._dirty).length},
  conflicts(){return PROCS.filter(p=>p._conflict&&!p.deletedAt)},
  kick(ms=2500){if(!this.enabled())return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.run(),ms)},
  start(){
    if(!this.enabled())return;
    // dados criados antes da nuvem ser ligada entram na fila de envio
    for(const p of PROCS)if(p._rev==null&&!p._dirty){p._dirty=true;Store.put('processes',p).catch(()=>{})}
    this.ui();this.kick(300);clearInterval(this.iv);this.iv=setInterval(()=>{if(!document.hidden)this.run()},60000);
  },
  stop(){clearTimeout(this.timer);clearInterval(this.iv)},
  view(){
    if(!CLOUD)return{s:'local',t:'Só neste aparelho'};
    const c=this.conflicts().length,n=this.pendingCount();
    if(c)return{s:'error',t:c+(c>1?' conflitos':' conflito')};
    if(this.state==='syncing')return{s:'sync',t:'Sincronizando…'};
    if(!navigator.onLine)return{s:'off',t:n?`Offline, ${n} pendente${n>1?'s':''}`:'Offline'};
    if(this.state==='error')return{s:'error',t:'Erro ao sincronizar'};
    if(n)return{s:'busy',t:`${n} pendente${n>1?'s':''}`};
    return{s:'ok',t:'Sincronizado'};
  },
  ui(){const el=$('#syncpill');if(!el)return;const v=this.view();el.dataset.s=v.s;el.lastElementChild.textContent=v.t},
  async run(){
    if(!this.enabled()||this.running||!navigator.onLine){this.ui();return}
    this.running=true;this.state='syncing';this.ui();let changed=false;
    try{
      await Saver.flushAll();
      const cp=await this.checkProfile();if(cp==='stop'){this.state='idle';return}
      changed=cp||false;
      changed=(await this.push())||changed;
      changed=(await this.pull())||changed;
      try{changed=(await Catalog.refresh())||changed}catch(e){console.error('catálogo',e)}   // falha no catálogo não derruba a sincronização
      changed=(await this.photosUp())||changed;
      changed=(await this.docsUp())||changed;
      changed=(await this.photosDown())||changed;
      await this.remoteDeletes();
      changed=(await this.purge())||changed;
      this.state='idle';
    }catch(e){console.error('sync',e);this.state='error'}
    finally{this.running=false;this.ui()}
    if(changed)refreshAfterSync();
    if(this.state==='idle'&&PROCS.some(p=>p._dirty&&!p._conflict))this.kick(4000);   // edições feitas durante o envio
  },
  /* o administrador pode ter bloqueado ou mudado o perfil desta pessoa: confere a cada sincronização */
  async checkProfile(){
    const r=await SB.from('profiles').select('id,name,email,role,status').eq('id',S.user.id).single();
    if(r.error)throw r.error;
    try{localStorage.setItem('minc_profile',JSON.stringify(r.data))}catch{}
    const nu=userFromProfile(r.data,S.user.login);
    if(nu.status===S.user.status&&nu.cloudRole===S.user.cloudRole)return false;
    S.user=nu;
    if(nu.status==='bloqueado'||nu.cloudRole==='pendente'){S.screen=homeScreen(r.data);S.id=null;Sync.stop();render();toast(nu.status==='bloqueado'?'Seu acesso foi bloqueado pelo administrador.':'Seu acesso foi alterado: aguarde a aprovação.',{ms:6000});return 'stop'}
    render();return true;
  },
  async push(){
    let did=false;
    for(const p of PROCS.filter(x=>x._dirty&&!x._conflict)){
      const snap=p.updatedAt,row=toRow(p);let out=null;
      if(p._rev==null){
        const r=await SB.from('processes').insert(row).select('rev').single();
        if(!r.error)out=r.data;
        else if(r.error.code==='23505'){const q=await SB.from('processes').select('rev').eq('id',p.id).single();if(q.error)throw q.error;p._rev=q.data.rev}   // reenvio de uma tentativa anterior
        else throw r.error;
      }
      if(!out){
        const r=await SB.from('processes').update(row).eq('id',p.id).eq('rev',p._rev).select('rev');
        if(r.error)throw r.error;
        if(!r.data.length){   // a revisão mudou: alguém gravou antes de nós
          const q=await SB.from('processes').select('*').eq('id',p.id).single();if(q.error)throw q.error;
          p._conflict=q.data;await Store.put('processes',p);did=true;continue;
        }
        out=r.data[0];
      }
      p._rev=out.rev;if(p.updatedAt===snap)p._dirty=false;   // se foi editado durante o envio, continua pendente
      await Store.put('processes',p);did=true;
    }
    return did;
  },
  async pull(){
    let since=localStorage.getItem('minc_lastpull')||'1970-01-01T00:00:00Z',max=since,changed=false;
    for(let guard=0;guard<50;guard++){
      const {data,error}=await SB.from('processes').select('*').gte('updated_at',since).order('updated_at',{ascending:true}).limit(200);
      if(error)throw error;
      for(const row of data){changed=(await applyRow(row))||changed;if(row.updated_at>max)max=row.updated_at}
      if(data.length<200||max===since)break;since=max;
    }
    localStorage.setItem('minc_lastpull',max);return changed;
  },
  async photosUp(){
    let did=false;
    const recs=(await Store.all('photos')).filter(r=>!r.up);
    for(const rec of recs){
      const p=PROCS.find(x=>x.id===rec.procId);
      if(!p||p._rev==null||p.deletedAt)continue;                       // o processo ainda não existe na nuvem
      const ref=photoRefs(p).find(x=>x.id===rec.id);if(!ref)continue;   // foto removida
      const pasta=ensureFolder(p);if(!pasta)continue;                  // sem Processo/Pedido/Equipamento/Cliente ainda: espera no aparelho
      const path=cloudPath(pasta,{...rec,file:!!ref.file});
      const u=await SB.storage.from(BUCKET).upload(path,rec.blob,{contentType:ref.file?(rec.type||'application/octet-stream'):'image/jpeg',upsert:false});
      if(u.error&&!/exist|duplicate/i.test(u.error.message||''))throw u.error;
      const r=await SB.from('photos').insert({id:rec.id,process_id:p.id,component_id:ref.cid,storage_path:path,name:ref.name});
      if(r.error&&r.error.code!=='23505')throw r.error;
      rec.up=true;await Store.put('photos',rec);did=true;
    }
    return did;
  },
  async docsUp(){
    let did=false;
    for(const rec of (await Store.all('docs')).filter(d=>!d.up)){
      const p=PROCS.find(x=>x.id===rec.procId);
      if(!p||p._rev==null||p.deletedAt)continue;                       // o processo ainda não existe na nuvem
      const pasta=ensureFolder(p);if(!pasta)continue;
      const base=`${pasta}/documentos/${rec.id}`,okDup=e=>e&&!/exist|duplicate/i.test(e.message||'');
      const f1=await SB.storage.from(DOCS_BUCKET).upload(base+'.pdf',new Blob([rec.bytes],{type:'application/pdf'}),{contentType:'application/pdf',upsert:false});if(okDup(f1.error))throw f1.error;
      const f2=await SB.storage.from(DOCS_BUCKET).upload(base+'.json',new Blob([rec.snapshot],{type:'application/json'}),{contentType:'application/json',upsert:false});if(okDup(f2.error))throw f2.error;
      const ins=await SB.from('process_documents').insert({id:rec.id,process_id:rec.procId,storage_path:base+'.pdf',snapshot_path:base+'.json',file_name:rec.fileName,size_bytes:rec.size,sha256:rec.sha256,form_code:rec.formCode,form_rev:rec.formRev,process_rev:rec.processRev,note:rec.note||null,generated_by_name:rec.byName}).select('version').single();
      if(ins.error&&ins.error.code!=='23505')throw ins.error;
      await Store.del('docs',rec.id);Docs.loaded.delete(rec.procId);did=true;
    }
    return did;
  },
  async photosDown(){
    const have=new Set(await Store.photoKeys());let n=0;
    for(const p of PROCS.filter(x=>!x.deletedAt)){
      for(const ref of photoRefs(p)){
        if(have.has(ref.id))continue;if(n>=25)return n>0;
        let r=p.pasta?await SB.storage.from(BUCKET).download(cloudPath(p.pasta,ref)):{error:true};
        if((r.error||!r.data)&&!ref.file)r=await SB.storage.from(BUCKET).download(legacyPath(p.id,ref));   // arquivos de antes das pastas
        if(r.error||!r.data)continue;                                   // quem criou ainda não enviou
        await Store.put('photos',{id:ref.id,procId:p.id,blob:r.data,name:ref.name,at:Date.now(),up:true,...(ref.file?{kind:'file',ext:ref.ext,type:ref.type}:{})});
        Photos.urls.set(ref.id,URL.createObjectURL(r.data));have.add(ref.id);n++;
      }
    }
    return n>0;
  },
  async remoteDeletes(){
    let q=[];try{q=JSON.parse(localStorage.getItem('minc_photo_del'))||[]}catch{}
    if(!q.length)return;
    const a=await SB.storage.from(BUCKET).remove(q.flatMap(x=>[].concat(x.path)));if(a.error)throw a.error;
    const b=await SB.from('photos').delete().in('id',q.map(x=>x.id));if(b.error)throw b.error;
    localStorage.removeItem('minc_photo_del');
  },
  async purge(){   // exclusões já enviadas à nuvem somem do aparelho
    const gone=PROCS.filter(p=>p.deletedAt&&!p._dirty&&!p._conflict&&Date.now()-new Date(p.deletedAt)>15000);
    for(const p of gone){await Store.del('processes',p.id).catch(()=>{});for(const ph of await Store.photosOf(p.id))await Store.del('photos',ph.id).catch(()=>{})}
    if(gone.length)PROCS=PROCS.filter(p=>!gone.includes(p));
    return gone.length>0;
  }
};
async function applyRow(row){
  const loc=PROCS.find(p=>p.id===row.id);
  if(!loc){
    if(row.deleted_at)return false;
    const n=fromRow(row);PROCS.unshift(n);await Store.put('processes',n);return true;
  }
  if(row.rev<=(loc._rev??0))return false;      // já temos esta versão (inclusive o eco do nosso envio)
  if(loc._dirty){loc._conflict=row;await Store.put('processes',loc);return true}   // alteração local ainda não enviada: não sobrescreve
  replaceLocal(loc,fromRow(row));await Store.put('processes',loc);return true;
}
function refreshAfterSync(){
  if(S.id&&!cur()&&FLOW.includes(S.screen)){toast('Este processo foi excluído por outra pessoa.',{ms:5000});ACT.home();return}
  const a=document.activeElement,typing=a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName);
  if(S.screen==='home'){if(a&&a.id==='q'){$('#rows').innerHTML=rowsHTML(filtered(PROCS.filter(p=>!p.deletedAt)))}else renderMain()}
  else if(FLOW.includes(S.screen)&&!typing)renderMain();
}

/* ============================== Ações (clique) ============================== */
const ACT={
  /* navegação / sessão */
  go(el){go(el.dataset.v)},
  home(){
    if(S.screen==='home'){window.scrollTo({top:0,behavior:RM()?'auto':'smooth'});return}
    S.sel=S.id||S.sel;S.screen='home';S.errs=null;S.id=null;Saver.flushAll();S.anim='up';render();scrollTo(0,0);
  },
  async logout(){
    await Saver.flushAll();
    if(CLOUD&&Sync.pendingCount()&&!await ask({title:'Sair com alterações pendentes?',body:`Há ${Sync.pendingCount()} processo(s) ainda não enviado(s) à nuvem. Eles ficam neste aparelho e são enviados na próxima entrada.`,ok:'Sair mesmo assim'}))return;
    S.loggingOut=true;Sync.stop();if(CLOUD)await Cloud.logout();
    sessionStorage.removeItem('minc_sess');S.user=null;S.id=null;S.screen='login';S.errs=null;S.loggingOut=false;render();
  },
  theme(){const d=document.documentElement,n=d.dataset.theme==='dark'?'light':'dark',y=window.scrollY;d.dataset.theme=n;try{localStorage.setItem('minc_theme',n)}catch{}render();window.scrollTo(0,y)},
  closeDlg(el){closeDialog(el.closest('dialog'))},
  saveNow(){Saver.flushAll().then(()=>toast('Processo salvo.'))},
  print(){window.print()},
  exportX(){exportX()},
  /* aplicabilidade */
  cDraw(el){C(el.dataset.cid).noDrawing=el.dataset.v==='0';changed();renderMain()},
  tAp(el){T()[el.dataset.g].na=el.dataset.v==='0';changed();renderMain()},
  /* administração: usuários */
  async userResend(el){
    try{const r=await callAdmin({action:'resend',userId:el.dataset.id,mode:el.dataset.mode});
      if(r.link)linkDialog(r.link,(S.admin?.rows||[]).find(u=>u.id===el.dataset.id)?.email||'');else toast(r.tipo==='convite'?'Convite reenviado por e-mail.':'E-mail de redefinição de senha enviado.')
      loadAdmin()}catch(e){toast(e.message)}
  },
  copyLink(){const t=document.getElementById('lnk');if(!t)return;t.select();(navigator.clipboard?.writeText?navigator.clipboard.writeText(t.value):Promise.reject()).catch(()=>document.execCommand&&document.execCommand('copy')).then(()=>toast('Link copiado.'),()=>toast('Copie o link manualmente.'))},
  /* administração: abas e catálogos */
  adminTab(el){S.adminTab=el.dataset.v;renderMain();if(S.adminTab==='catalog'&&CLOUD)Catalog.refresh().then(ch=>{if(ch&&S.screen==='admin')renderMain()}).catch(()=>{})},
  async catMove(el){
    const {t,id,parent}=el.dataset,d=+el.dataset.dir,list=catList(t,parent),i=list.findIndex(x=>x.id===id),k=i+d;
    if(i<0||k<0||k>=list.length)return;
    const order=list.map(x=>x.id);[order[i],order[k]]=[order[k],order[i]];
    await catWrite(async()=>{for(let n=0;n<order.length;n++){const it=list.find(x=>x.id===order[n]);if(it.position!==n+1){const r=await SB.from(CAT_TABLE[t]).update({position:n+1}).eq('id',it.id);if(r.error)return r}}return{error:null}});
  },
  async catAdd(el){
    const {t,parent}=el.dataset,inp=document.getElementById(el.dataset.inp),v=(inp?.value||'').trim();
    if(!v){toast('Digite o nome.');return}
    const pos=catList(t,parent).reduce((m,x)=>Math.max(m,x.position),0)+1;
    const row=t==='activity'?{sector_id:parent,name:v,position:pos}:{name:v,position:pos};
    await catWrite(()=>SB.from(CAT_TABLE[t]).insert(row));
  },
  /* documentos em PDF */
  async docDownloadNow(el){
    const b=el.closest?.('button')||el;b.setAttribute?.('aria-busy','true');
    try{const r=cur(),rec=await Docs.generate(r,'');saveBytes(rec.bytes,rec.fileName);toast('PDF gerado.')}catch(e){console.error(e);toast('Não foi possível gerar o PDF.')}
    finally{b.removeAttribute?.('aria-busy')}
  },
  docGen(){
    dialog(`<form class="dlg-body" data-submit="docgen"><h2>Gerar e arquivar documento</h2><p>Será criada uma nova versão em PDF com os dados atuais do processo. As versões anteriores continuam guardadas.</p><div class="field"><label for="dnote">Observação da versão <span class="muted">(opcional)</span></label><textarea id="dnote" name="note" rows="3" data-keep-case placeholder="Ex.: revisão após aprovação do cliente"></textarea></div><div class="actions end"><button class="btn" type="button" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit">Gerar e arquivar</button></div></form>`);
  },
  async docOpen(el){
    const d=Docs.find(el.dataset.id);if(!d)return;
    const win=window.open('','_blank');if(win)win.opener=null;   // abre a aba no toque (evita bloqueio de pop-up) e só depois carrega o link
    try{const u=await Docs.url(d);if(win&&!win.closed)win.location.href=u;else window.open(u,'_blank')}
    catch(e){if(win)win.close();toast(cloudErrMsg(e))}
  },
  async docSave(el){
    const d=Docs.find(el.dataset.id);if(!d)return;
    try{const u=await Docs.url(d,{download:true}),a=document.createElement('a');a.href=u;a.download=d.local?d.local.fileName:'';document.body.append(a);a.click();a.remove()}catch(e){toast(cloudErrMsg(e))}
  },
  async docDel(el){
    const d=Docs.find(el.dataset.id)?.srv;if(!d)return;
    if(!await ask({title:`Excluir a versão ${d.version}?`,body:'O PDF e o registro desta versão serão apagados definitivamente. Se ela for a atual, a anterior volta a ser a atual.',ok:'Excluir',danger:true}))return;
    try{
      const a=await SB.storage.from(DOCS_BUCKET).remove([d.storage_path,d.snapshot_path].filter(Boolean));if(a.error)throw a.error;
      const b=await SB.from('process_documents').delete().eq('id',d.id);if(b.error)throw b.error;
      await Docs.refresh(d.process_id);renderMain();toast('Versão excluída.');
    }catch(e){toast(cloudErrMsg(e))}
  },
  /* nuvem */
  syncPill(){
    if(!CLOUD){toast('Modo local: os dados ficam só neste aparelho.');return}
    if(Sync.conflicts().length)return ACT.conflictsDlg();
    if(!navigator.onLine){toast('Sem conexão. A sincronização acontece quando a internet voltar.');return}
    toast('Sincronizando…',{ms:1500});Sync.run();
  },
  conflictsDlg(){
    const l=Sync.conflicts();if(!l.length)return;
    dialog(`<div class="dlg-body"><h2>Conflito de edição</h2><p>Outra pessoa alterou estes processos enquanto você também editava. Escolha qual versão manter.</p><div class="stack">${l.map(p=>`<div class="mat"><b>${esc(p.equipamento)||'Sem equipamento'}</b><div class="actions" style="margin-top:10px"><button class="btn primary" data-act="keepMine" data-id="${p.id}">Manter a minha versão</button><button class="btn" data-act="useServer" data-id="${p.id}">Usar a do servidor</button></div></div>`).join('')}</div><div class="actions end"><button class="btn" data-act="closeDlg">Fechar</button></div></div>`);
  },
  keepMine(el){const p=PROCS.find(x=>x.id===el.dataset.id);if(!p||!p._conflict)return;p._rev=p._conflict.rev;p._conflict=null;p._dirty=true;Store.put('processes',p).catch(()=>{});el.closest('dialog')?.close();renderMain();Sync.kick(300)},
  useServer(el){const p=PROCS.find(x=>x.id===el.dataset.id);if(!p||!p._conflict)return;replaceLocal(p,fromRow(p._conflict));Store.put('processes',p).catch(()=>{});el.closest('dialog')?.close();renderMain();Sync.kick(300)},
  async recheck(){try{const prof=await loadProfile({id:S.user.id});enter(prof,S.user.login);if(S.screen==='blocked')toast('O acesso continua bloqueado.')}catch(e){toast(cloudErrMsg(e))}},
  /* início */
  filter(el){if(S.filter!==el.dataset.v)S.rowsIn=true;S.filter=el.dataset.v;renderMain()},
  pick(el){
    if(!wide()){openProcess(el.dataset.id);return}
    S.sel=el.dataset.id;const all=PROCS.filter(p=>!p.deletedAt),rows=$('#rows'),y=rows?rows.scrollTop:0;
    if(rows){rows.innerHTML=rowsHTML(filtered(all));rows.scrollTop=y;const n=rows.querySelector(`[data-fk="row-${qAttr(S.sel)}"]`);if(n)n.focus({preventScroll:true})}
    const d=$('.detail');if(d){d.innerHTML=detail(all.find(p=>p.id===S.sel),all);if(d.firstElementChild)d.firstElementChild.classList.add('swap')}
  },
  newProcess(){newProcess()},
  openProcess(el){openProcess(el.dataset.id)},
  async openDoc(el){await openProcess(el.dataset.id);go('execution')},
  async delProcess(el){
    const r=PROCS.find(p=>p.id===el.dataset.id);if(!r)return;
    if(!await ask({title:'Excluir este processo?',body:`“${r.equipamento||'Sem equipamento'}” será removido, com componentes e fotos. Você terá alguns segundos para desfazer.`,ok:'Excluir',danger:true}))return;
    r.deletedAt=new Date().toISOString();touch(r);await Store.put('processes',r).catch(()=>{});if(S.sel===r.id)S.sel=null;renderMain();
    toast('Processo excluído.',{label:'Desfazer',ms:8000,
      action:()=>{delete r.deletedAt;touch(r);Store.put('processes',r).catch(()=>{});S.sel=r.id;renderMain()},
      onExpire:async()=>{
        if(CLOUD){Sync.kick(300);return}   // a exclusão vai para a nuvem primeiro; o registro local é limpo depois
        PROCS=PROCS.filter(p=>p!==r);await Store.del('processes',r.id).catch(()=>{});for(const p of await Store.photosOf(r.id))await Photos.drop(p.id)}});
  },
  /* informações */
  status(el){const r=cur(),v=el.dataset.v;if(v==='Concluído'&&VALIDATED.some(k=>check(k).length)){const g=el.closest?.('.seg');if(g&&!RM()){g.classList.remove('shake');void g.offsetWidth;g.classList.add('shake')}toast('Não é possível concluir: há campos obrigatórios pendentes.');return}if(r.status!==v)S.pulse=[].concat(S.pulse||[],'cb-st');r.status=v;changed();renderMain()},
  set(el){cur()[el.dataset.k]=el.dataset.v;changed();renderMain()},
  pickPhoto(el){const i=document.createElement('input');i.type='file';i.accept='image/*';i.multiple=true;if(el.dataset.cap)i.setAttribute('capture','environment');i.onchange=()=>addPhotos(i.files,el.dataset.t);i.click()},
  pickAnexo(el){
    const t=el.dataset.t;
    dialog(`<div class="dlg-body"><h2>Anexos</h2><p>De onde você quer anexar?</p><div class="actions col"><button class="btn" data-act="anexFrom" data-w="gal" data-t="${t}">${ic('image')}Galeria de fotos</button><button class="btn" data-act="anexFrom" data-w="arq" data-t="${t}">${ic('doc')}Arquivos (PDF, Word, Excel, desenhos…)</button><button class="btn ghost" data-act="closeDlg">Cancelar</button></div></div>`);
  },
  anexFrom(el){
    const {w,t}=el.dataset,i=document.createElement('input');i.type='file';i.multiple=true;
    i.accept=w==='gal'?'image/*':'.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.dwg,.dxf,.zip,.rar,.7z,application/pdf,image/*';
    i.onchange=()=>{addPhotos(i.files,t)};ACT.closeDlg(el);i.click();
  },
  openAnexo(el){
    const u=Photos.url(el.dataset.pid);if(!u){toast('O arquivo ainda não foi baixado neste aparelho. Aguarde a sincronização.');return}
    const a=document.createElement('a');a.href=u;a.download=el.dataset.nm||'arquivo';
    if(/pdf|image\//.test(el.dataset.ty||'')){a.target='_blank';a.rel='noopener';a.removeAttribute('download')}
    document.body.append(a);a.click();a.remove();
  },
  delAnexo(el){
    const {kind,cid,pid}=el.dataset,r=cur(),arr=kind==='equip'?r.anexos:C(cid)?.anexos;if(!arr)return;
    const i=arr.findIndex(p=>p.id===pid);if(i<0)return;const [p]=arr.splice(i,1);changed(r);renderMain();
    toast('Anexo removido.',{label:'Desfazer',ms:7000,action:()=>{arr.splice(i,0,p);changed(r);renderMain()},onExpire:()=>Photos.drop(p.id)});
  },
  zoom(el){dialog(`<div class="lb-body"><img src="${Photos.url(el.dataset.pid)}" alt="Foto ampliada"><button class="btn primary" data-act="closeDlg" autofocus>Fechar</button></div>`,{cls:'lb'})},
  delPhoto(el){
    const {kind,cid,pid}=el.dataset,r=cur(),arr=kind==='equip'?r.equipmentPhotos:C(cid)?.photos;if(!arr)return;
    const i=arr.findIndex(p=>p.id===pid);if(i<0)return;const [p]=arr.splice(i,1);changed(r);renderMain();
    toast('Foto removida.',{label:'Desfazer',ms:7000,action:()=>{arr.splice(i,0,p);changed(r);renderMain()},onExpire:()=>Photos.drop(p.id)});
  },
  /* componentes */
  addComp(){
    const r=cur(),c=newComp();
    r.components.unshift(c);S.open[c.id]=true;S.opening=c.id;changed();
    if(S.screen!=='components'){S.errs=null;S.screen='components';render()}else renderMain();
    const n=document.getElementById('cn-'+c.id);if(n)n.focus();
  },
  addCommon(el){
    const r=cur(),c=newComp({name:String(el.dataset.v).toUpperCase()});
    r.components.unshift(c);S.open[c.id]=true;S.opening=c.id;changed();renderMain();
  },
  toggleComp(el){
    const id=el.dataset.cid;
    if(S.open[id]&&!RM()){const a=el.closest('.comp');if(a){a.classList.add('closing');setTimeout(()=>{S.open[id]=false;renderMain()},130);return}}
    S.open[id]=!S.open[id];if(S.open[id])S.opening=id;renderMain();
  },
  async delComp(el){
    const r=cur(),c0=r.components.find(c=>c.id===el.dataset.cid);if(!c0)return;
    const sub=descOf(r,c0.id);   // subcomponentes saem junto; sem eles o fluxo continua síncrono
    if(sub.size&&!await ask({title:'Excluir componente e subcomponentes?',body:`"${c0.name||'Sem descrição'}" tem ${sub.size} subcomponente(s), que também serão excluídos. Dá para desfazer logo em seguida.`,ok:'Excluir',danger:true}))return;
    const ids=new Set([c0.id,...sub]),gone=[];
    for(let i=r.components.length-1;i>=0;i--)if(ids.has(r.components[i].id))gone.unshift({c:r.components.splice(i,1)[0],i});
    changed(r);renderMain();
    toast(sub.size?`Componente e ${sub.size} subcomponente(s) excluídos.`:'Componente excluído.',{label:'Desfazer',ms:7000,action:()=>{gone.forEach(({c,i})=>r.components.splice(i,0,c));changed(r);renderMain()},onExpire:()=>gone.forEach(({c})=>c.photos.forEach(p=>Photos.drop(p.id)))});
  },
  toggleProv(el){
    const c=C(el.dataset.cid),v=el.dataset.v;
    const legacy=c.acoes.filter(a=>!PROV.includes(a));
    const hadMp=precisaMat(c);
    c.acoes=PROV.includes(v)?[v]:c.acoes.filter(a=>a!==v);   // uma providência só: escolher outra substitui; opção descontinuada só pode ser removida
    c.action=c.acoes[0]||'';
    changed();renderMain();
    if(hadMp&&!precisaMat(c)&&hiddenMp(c))toast(hiddenMp(c)===1?'A matéria-prima ficou guardada: volta ao escolher Fabricar ou Substituir.':`${hiddenMp(c)} matérias-primas ficaram guardadas: voltam ao escolher Fabricar ou Substituir.`,{ms:6000});
  },
  addMat(el){C(el.dataset.cid).materials.push(newLeaf('mp'));changed();renderMain()},
  addLeaf(el){const c=C(el.dataset.cid);c.materials.push(newLeaf(el.dataset.t));S.tc[c.id]=false;changed();renderMain()},
  delMat(el){const c=C(el.dataset.cid),j=+el.dataset.j,[m]=c.materials.splice(j,1);changed();renderMain();toast(m.tipo==='serv'?'Serviço excluído.':'Matéria-prima excluída.',{label:'Desfazer',ms:6000,action:()=>{c.materials.splice(j,0,m);changed();renderMain()}})},
  addSub(el){
    const r=cur(),pid=el.dataset.pid;if(!r.components.some(x=>x.id===pid))return;
    const c=newComp({parentId:pid});r.components.unshift(c);
    S.open[c.id]=true;S.opening=c.id;S.focus='cn-'+c.id;changed();renderMain();
    const a=document.querySelector(`.comp[data-cid="${qAttr(c.id)}"]`);if(a&&a.scrollIntoView)a.scrollIntoView({block:'start'});
  },
  structView(el){S.sv=el.dataset.v==='buy'?'buy':'tree';renderMain()},
  addNode(el){
    const r=cur(),pid=r.components.some(x=>x.id===el.dataset.pid)?el.dataset.pid:null;
    const c=newComp({parentId:pid});r.components.unshift(c);if(pid)S.tc[pid]=false;
    S.focus='sn-'+c.id;changed();renderMain();
  },
  toggleNode(el){S.tc[el.dataset.cid]=!S.tc[el.dataset.cid];renderMain()},
  treeAll(el){const r=cur();S.tc={};if(el.dataset.v==='close')r.components.forEach(c=>{if(kidsOf(r,c.id).length||visLeaves(c).length)S.tc[c.id]=true});renderMain()},
  openComp(el){const id=el.dataset.cid;S.open[id]=true;S.opening=id;go('components');const a=document.querySelector(`.comp[data-cid="${qAttr(id)}"]`);if(a&&a.scrollIntoView)a.scrollIntoView({block:'start'})},
  pickSector(el){S.sec[el.dataset.cid]=el.dataset.sid;renderMain()},
  toggleAct(el){
    const c=C(el.dataset.cid),sec=CATALOG.sectors.find(x=>x.id===el.dataset.sid);if(!c||!sec)return;
    const act=sec.activities.find(a=>a.id===el.dataset.aid);if(!act)return;
    const j=c.atividades.findIndex(l=>sameAct(l,sec,act));
    if(j>=0){
      const [l]=c.atividades.splice(j,1);changed();renderMain();
      toast('Atividade removida.',{label:'Desfazer',ms:6000,action:()=>{c.atividades.splice(j,0,l);changed();renderMain()}});
      return;
    }
    const l={id:uid('AT'),sectorId:sec.id,sector:sec.name,actId:act.id,act:act.name,detail:'',reqDetail:!!act.requiresDetail};
    c.atividades.push(l);S.sec[c.id]=sec.id;if(l.reqDetail)S.focus='at-'+l.id;changed();renderMain();
  },
  delAtiv(el){
    const c=C(el.dataset.cid),j=c.atividades.findIndex(a=>a.id===el.dataset.aid);if(j<0)return;
    const [a]=c.atividades.splice(j,1);changed();renderMain();
    toast('Atividade excluída.',{label:'Desfazer',ms:6000,action:()=>{c.atividades.splice(j,0,a);changed();renderMain()}});
  },
  moveAtiv(el){
    const c=C(el.dataset.cid),j=c.atividades.findIndex(a=>a.id===el.dataset.aid),k=j+(+el.dataset.dir);
    if(j<0||k<0||k>=c.atividades.length)return;
    [c.atividades[j],c.atividades[k]]=[c.atividades[k],c.atividades[j]];S.focus=null;changed();renderMain();
  },
  toggleServ(el){
    const c=C(el.dataset.cid),sv=CATALOG.services.find(x=>x.id===el.dataset.sv);if(!c||!sv)return;
    const j=c.servicos.findIndex(y=>sameServ(y,sv));
    if(j>=0){const [x]=c.servicos.splice(j,1);changed();renderMain();toast('Serviço removido.',{label:'Desfazer',ms:6000,action:()=>{c.servicos.splice(j,0,x);changed();renderMain()}});return}
    c.servicos.push({id:uid('SV'),serviceId:sv.id,nome:sv.name,obs:''});changed();renderMain();
  },
  addServOutro(el){const c=C(el.dataset.cid),x={id:uid('SV'),serviceId:null,nome:'',obs:''};c.servicos.push(x);S.focus='sv-'+x.id;changed();renderMain()},
  delServ(el){
    const c=C(el.dataset.cid),j=c.servicos.findIndex(x=>x.id===el.dataset.sid);if(j<0)return;
    const [x]=c.servicos.splice(j,1);changed();renderMain();
    toast('Serviço excluído.',{label:'Desfazer',ms:6000,action:()=>{c.servicos.splice(j,0,x);changed();renderMain()}});
  },
  addExtra(){T().extras.push({id:uid('EX'),desc:'',fluido:'',pressaoVal:'',pressaoUn:'',duracao:'',rep:'',obs:''});changed();renderMain()},
  delExtra(el){const t=T(),j=+el.dataset.j,[x]=t.extras.splice(j,1);changed();renderMain();toast('Ensaio excluído.',{label:'Desfazer',ms:6000,action:()=>{t.extras.splice(j,0,x);changed();renderMain()}})},
  /* testes e embalagem */
  sentido(el){T().sede.sentido=el.dataset.v;changed();renderMain()},
  embSet(el){const r=cur();r.embalagem={...(r.embalagem||{}),tipo:el.dataset.v};changed();renderMain()},
  /* conta e administração */
  userMenu(){
    const u=S.user;
    dialog(`<div class="dlg-body"><h2>${esc(u.name)}</h2><p>${esc(u.role)} — usuário ${esc(u.login)}</p><div class="stack"><button class="btn" data-act="chPw">Alterar senha</button>${u.role==='Administrador'?'<button class="btn" data-act="adminGo">Administração de usuários</button>':''}<button class="btn" data-act="closeDlg">Fechar</button></div><p class="hint">Versão ${APP_VERSION}</p></div>`);
  },
  chPw(el){el.closest('dialog')?.close();pwDialog(false)},
  adminGo(el){el.closest('dialog')?.close();ACT.home();S.screen='admin';S.adminTab='users';render();if(CLOUD)loadAdmin()},
  resetPw(el){
    dialog(`<form class="dlg-body" data-submit="reset" data-id="${el.dataset.id}"><h2>Redefinir senha</h2><p>Defina uma senha temporária. O usuário precisará trocá-la no próximo acesso.</p><div class="field"><label for="rp">Senha temporária (mínimo 6 caracteres)</label><input id="rp" name="pw" type="password" required minlength="6" autocomplete="new-password" autofocus></div><div class="actions end"><button class="btn" type="button" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit">Redefinir</button></div></form>`);
  },
  async delUser(el){
    const u=Auth.list().find(x=>x.id===el.dataset.id);if(!u)return;
    if(!await ask({title:'Excluir usuário?',body:`${u.name} (${u.login}) perderá o acesso a este aparelho.`,ok:'Excluir',danger:true}))return;
    Auth.save(Auth.list().filter(x=>x.id!==u.id));renderMain();
  }
};
async function openProcess(id){
  S.id=id;S.errs=null;S.screen='process';S.anim='up';
  try{await Photos.load(id)}catch(e){console.error(e)}
  render();scrollTo(0,0);
}
function newProcess(){
  const now=new Date().toISOString();
  const r=normalize({id:uid('REP'),createdAt:now,updatedAt:now,status:'Rascunho',process:'',pedido:'',ordem:'',equipamento:'',cliente:'',observacoes:'',vedacao:'',acionamento:'',fluido:'',createdBy:S.user.name,updatedBy:S.user.name});
  PROCS.unshift(r);Saver.queue(r.id);S.id=r.id;S.errs=null;S.screen='process';S.anim='up';render();scrollTo(0,0);
}
function pwDialog(forced){
  dialog(`<form class="dlg-body" data-submit="pw" data-forced="${forced?1:0}"><h2>${forced?'Defina uma nova senha':'Alterar senha'}</h2>${forced?'<p>Por segurança, troque a senha temporária antes de continuar.</p>':''}${forced?'':'<div class="field"><label for="pw0">Senha atual</label><input id="pw0" name="cur" type="password" required autocomplete="current-password" autofocus></div>'}<div class="field"><label for="pw1">Nova senha (mínimo 6 caracteres)</label><input id="pw1" name="n1" type="password" required minlength="6" autocomplete="new-password" ${forced?'autofocus':''}></div><div class="field"><label for="pw2">Repita a nova senha</label><input id="pw2" name="n2" type="password" required minlength="6" autocomplete="new-password"></div><div class="actions end">${forced?'':'<button class="btn" type="button" data-act="closeDlg">Cancelar</button>'}<button class="btn primary" type="submit">Salvar senha</button></div></form>`,{lock:forced});
}

/* ============================== Entrada de dados (input/change/submit) ============================== */
const INP={
  q(el){S.q=el.value;const all=PROCS.filter(p=>!p.deletedAt);$('#rows').innerHTML=rowsHTML(filtered(all))},
  p(el){const r=cur();r[el.dataset.k]=el.value;changed()},
  c(el){const c=C(el.dataset.cid);c[el.dataset.k]=el.value;changed();liveComp(el.dataset.cid)},
  m(el){const c=C(el.dataset.cid);c.materials[+el.dataset.j][el.dataset.k]=el.value;changed();liveComp(el.dataset.cid)},
  opObs(el){const o=C(el.dataset.cid).ops.find(x=>x.key===el.dataset.k);if(o){o.obs=el.value;changed()}},
  t(el){T()[el.dataset.g][el.dataset.k]=el.value;changed()},
  embDesc(el){const r=cur();r.embalagem={...(r.embalagem||{}),descricao:el.value};changed()},
  ativ(el){const a=C(el.dataset.cid).atividades.find(x=>x.id===el.dataset.aid);if(a){a[el.dataset.k||'t']=el.value;changed();liveComp(el.dataset.cid)}},
  serv(el){const x=C(el.dataset.cid).servicos.find(y=>y.id===el.dataset.sid);if(x){x[el.dataset.k]=el.value;changed();liveComp(el.dataset.cid)}},
  plaq(el){cur().plaq[el.dataset.k]=el.value;changed()},
  tx(el){T().extras[+el.dataset.j][el.dataset.k]=el.value;changed()}
};
const CHG={
  nameCaps(el){const n=el.form&&el.form.elements.name;if(n&&el.checked)n.value=n.value.toUpperCase()},
  m(el){const c=C(el.dataset.cid);c.materials[+el.dataset.j][el.dataset.k]=el.value;changed();liveComp(el.dataset.cid)},
  c(el){C(el.dataset.cid)[el.dataset.k]=el.value;changed()},
  cchk(el){C(el.dataset.g).semCadastro=el.checked;changed();renderMain()},
  mchk(el){C(el.dataset.g).materials[+el.dataset.j].semCadastro=el.checked;changed();renderMain()},
  cpar(el){
    const r=cur(),c=C(el.dataset.cid),v=el.value||null;
    if(v&&(v===c.id||descOf(r,c.id).has(v)))return;   // nunca dentro de si mesmo ou de um descendente
    c.parentId=v;if(v)S.tc[v]=false;changed();renderMain();
  },
  tchk(el){T()[el.dataset.g][el.dataset.k]=el.checked;changed();renderMain()},
  tsel(el){T()[el.dataset.g][el.dataset.k]=el.value;changed();if(el.value)el.classList.remove('invalid')},
  plaqsel(el){cur().plaq[el.dataset.k]=el.value;changed()},
  txsel(el){T().extras[+el.dataset.j][el.dataset.k]=el.value;changed();if(el.value)el.classList.remove('invalid')},
  async catName(el){
    const v=el.value.trim();if(!v){toast('O nome não pode ficar vazio.');renderMain();return}
    await catWrite(()=>SB.from(CAT_TABLE[el.dataset.t]).update({name:v}).eq('id',el.dataset.id));
  },
  async catActive(el){await catWrite(()=>SB.from(CAT_TABLE[el.dataset.t]).update({active:el.checked}).eq('id',el.dataset.id))},
  async catReq(el){await catWrite(()=>SB.from('catalog_activities').update({requires_detail:el.checked}).eq('id',el.dataset.id))},
  async role(el){
    try{await callAdmin({action:'update',userId:el.dataset.id,role:el.value});toast('Perfil atualizado.')}catch(e){toast(e.message)}
    loadAdmin();
  },
  async userStatus(el){
    const bloquear=!el.checked;
    if(bloquear&&!await ask({title:`Bloquear ${el.dataset.name||'este usuário'}?`,body:'A pessoa perde o acesso a todos os dados imediatamente. Você pode desbloquear depois.',ok:'Bloquear',danger:true})){loadAdmin();return}
    try{await callAdmin({action:'update',userId:el.dataset.id,status:bloquear?'bloqueado':'ativo'});toast(bloquear?'Usuário bloqueado.':'Usuário desbloqueado.')}catch(e){toast(e.message)}
    loadAdmin();
  }
};
const SUB={
  async login(f){
    const btn=f.querySelector('button[type=submit]'),l=f.elements.login.value,p=f.elements.pw.value;
    btn.setAttribute('aria-busy','true');
    try{
      if(CLOUD){
        if(!navigator.onLine){toast('Sem conexão. A primeira entrada em cada aparelho precisa de internet.');return}
        const u=await Cloud.login(l,p),prof=await loadProfile(u);
        enter(prof,u.email);
      }else{
        const u=Auth.find(l),ok=u&&await Auth.check(u,p).catch(()=>false);
        if(!ok){toast(u&&u.alg==='pbkdf2'&&!window.crypto?.subtle?'Abra o aplicativo por HTTPS para entrar.':'Usuário ou senha inválidos.');return}
        S.user=u;sessionStorage.setItem('minc_sess',u.id);S.screen='home';S.anim='up';render();
        if(u.mustChange)pwDialog(true);
      }
    }catch(e){console.error(e);toast(cloudErrMsg(e))}
    finally{btn.removeAttribute('aria-busy')}
  },
  async docgen(f){
    const btn=f.querySelector('button[type=submit]'),note=f.elements.note.value;btn.setAttribute('aria-busy','true');
    try{
      const r=cur(),rec=await Docs.generate(r,note);closeDialog(f.closest('dialog'));
      toast(navigator.onLine?'Documento gerado. Enviando para a nuvem…':'Documento gerado. Será enviado quando a internet voltar.',{ms:4000});
      renderMain();Sync.run();
    }catch(e){console.error(e);toast('Não foi possível gerar o PDF.')}
    finally{btn.removeAttribute('aria-busy')}
  },
  async setpw(f){
    const e=f.elements,btn=f.querySelector('button[type=submit]');
    if(e.n1.value!==e.n2.value){toast('As senhas não coincidem.');return}
    if(e.n1.value.length<8){toast('Use ao menos 8 caracteres.');return}
    btn.setAttribute('aria-busy','true');
    try{
      const up=await SB.auth.updateUser({password:e.n1.value});if(up.error)throw up.error;
      try{history.replaceState(null,'',location.pathname)}catch{}
      AUTH_LINK.type=null;
      const prof=await loadProfile({id:S.user.id});enter(prof,S.user.login);toast('Senha definida. Bem-vindo!');
    }catch(err){console.error(err);toast(cloudErrMsg(err))}
    finally{btn.removeAttribute('aria-busy')}
  },
  async pw(f){
    const forced=f.dataset.forced==='1',e=f.elements;
    if(e.n1.value!==e.n2.value){toast('As senhas não coincidem.');return}
    if(e.n1.value.length<6||e.n1.value==='123456'||e.n1.value==='1234'){toast('Escolha uma senha mais forte (mínimo 6 caracteres).');return}
    if(CLOUD){
      if(!navigator.onLine){toast('Sem conexão. Para trocar a senha é preciso estar online.');return}
      const chk=await SB.auth.signInWithPassword({email:S.user.login,password:e.cur.value});
      if(chk.error){toast('Senha atual incorreta.');return}
      const up=await SB.auth.updateUser({password:e.n1.value});
      if(up.error){toast(cloudErrMsg(up.error));return}
      f.closest('dialog').close();toast('Senha alterada.');return;
    }
    const u=Auth.list().find(x=>x.id===S.user.id);
    if(!forced&&!await Auth.check(u,e.cur.value)){toast('Senha atual incorreta.');return}
    S.user=await Auth.setPw(u.id,e.n1.value,false);f.closest('dialog').close();toast('Senha alterada.');
  },
  async inviteUser(f){
    const e=f.elements,btn=f.querySelector('button[type=submit]');btn.setAttribute('aria-busy','true');
    try{
      const r=await callAdmin({action:'invite',name:e.name.value,email:e.email.value,role:e.role.value,mode:e.mode.value});
      f.reset();
      if(r.link)linkDialog(r.link,r.user.email);else toast(`Convite enviado para ${r.user.email}.`,{ms:5000});
      loadAdmin();
    }catch(err){toast(err.message,{ms:7000})}
    finally{btn.removeAttribute('aria-busy')}
  },
  async reset(f){await Auth.setPw(f.dataset.id,f.elements.pw.value,true);f.closest('dialog').close();toast('Senha redefinida. O usuário deverá trocá-la no próximo acesso.')},
  async newUser(f){
    const e=f.elements,name=e.name.value.trim(),login=e.login.value.trim();
    if(Auth.find(login)){toast('Já existe um usuário com esse login.');return}
    const l=Auth.list();l.push(await Auth.make(name,login,e.pw.value,e.role.value,true));Auth.save(l);toast('Usuário cadastrado.');renderMain();
  }
};

document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');if(!el||el.disabled)return;
  const f=ACT[el.dataset.act];if(!f)return;
  if(el.dataset.fk&&el.matches('.chip,.rcard,.seg-b,.ap'))S.pulse=el.dataset.fk;   // confirma a escolha com um pulso curto
  f(el,e);Promise.resolve().then(()=>{S.pulse=null});
});
document.addEventListener('change',e=>{const el=e.target.closest('[data-chg]');if(el)CHG[el.dataset.chg]?.(el)});
document.addEventListener('submit',e=>{const f=e.target.closest('[data-submit]');if(f){e.preventDefault();SUB[f.dataset.submit]?.(f)}});
/* iPhone/iPad: sem um ouvinte de toque o Safari não aplica :active, e o botão não responde na hora do toque */
document.addEventListener('touchstart',()=>{},{passive:true});
/* Maiúsculas em campos de texto (login, senha, busca e pressões ficam fora via data-keep-case). Roda antes dos handlers. */
document.addEventListener('input',e=>{
  const t=e.target;if(!(t.tagName==='TEXTAREA'||(t.tagName==='INPUT'&&t.type==='text'))||'keepCase' in t.dataset)return;
  if(t.name==='name'&&t.form&&t.form.elements.caps&&!t.form.elements.caps.checked)return;   // cadastro de usuário: caixa alta é opcional
  const v=t.value,u=v.toUpperCase();if(v!==u){const a=t.selectionStart,b=t.selectionEnd;t.value=u;try{t.setSelectionRange(a,b)}catch{}}
},true);
document.addEventListener('input',e=>{const el=e.target.closest('[data-inp]');if(!el)return;INP[el.dataset.inp]?.(el);if(el.classList.contains('invalid')&&!emp(el.value))el.classList.remove('invalid')});

/* Atalhos de teclado (notebook): Ctrl+S salva, Alt+←/→ troca de etapa, "/" busca */
document.addEventListener('keydown',e=>{
  const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(S.id)ACT.saveNow();return}
  if(e.altKey&&(e.key==='ArrowRight'||e.key==='ArrowLeft')&&FLOW.includes(S.screen)){
    e.preventDefault();const t=FLOW[FLOW.indexOf(S.screen)+(e.key==='ArrowRight'?1:-1)];if(t)go(t);return}
  if(e.key==='/'&&!typing&&S.screen==='home'){const q=$('#q');if(q){e.preventDefault();q.focus()}}
});

/* ============================== Boot ============================== */
async function migrateLegacy(){
  if(!Store.db||localStorage.getItem('minc_migrated_v4'))return;
  let list=[];
  try{list=JSON.parse(localStorage.getItem('minc_db_v2'))?.processes||[]}catch{}
  if(!list.length){try{const v1=JSON.parse(localStorage.getItem('minc_peritagem_v1'));if(v1?.id)list=[v1]}catch{}}
  if(!list.length){localStorage.setItem('minc_migrated_v4','1');return}
  let fail=0;
  const conv=async(arr,pid)=>{const out=[];for(const p of arr||[]){
    if(!p.data){out.push(p);continue}
    try{const blob=await(await fetch(p.data)).blob(),id=uid('IMG');await Store.put('photos',{id,procId:pid,blob,name:p.name||'foto.jpg',at:Date.now()});out.push({id,name:p.name||'foto.jpg'})}catch{fail++}}return out};
  for(const p of list){p.equipmentPhotos=await conv(p.equipmentPhotos,p.id);for(const c of p.components||[])c.photos=await conv(c.photos,p.id);await Store.put('processes',p)}
  localStorage.setItem('minc_migrated_v4','1');
  if(!fail){localStorage.removeItem('minc_db_v2');localStorage.removeItem('minc_peritagem_v1');toast(`${list.length} processo(s) migrado(s) para o novo armazenamento.`,{ms:5000})}
  else toast(`Migração parcial: ${fail} foto(s) não puderam ser convertidas. Os dados antigos foram mantidos.`,{ms:8000});
}
async function gc(){
  const keep=new Set();PROCS.forEach(p=>{[...p.equipmentPhotos,...p.anexos].forEach(x=>keep.add(x.id));p.components.forEach(c=>[...c.photos,...c.anexos].forEach(x=>keep.add(x.id)))});
  for(const k of await Store.photoKeys())if(!keep.has(k))await Store.del('photos',k).catch(()=>{});
}
async function boot(){
  Catalog.load();
  const safety=setTimeout(()=>{   // nada deveria chegar até aqui; é a última rede de segurança contra uma tela presa
    if(S.screen==='boot'){console.error('boot: tempo esgotado, forçando a tela de login');S.screen='login';render();toast('A inicialização demorou mais que o esperado. Tente novamente se algo parecer faltando.',{ms:7000})}
  },15000);
  try{
    try{await Store.open()}catch(e){console.error(e);toast('Armazenamento do navegador indisponível: os dados não serão guardados.',{ms:8000})}
    if(!CLOUD)await Auth.init();
    await migrateLegacy();
    const raw=(await Store.all('processes')).map(normalize);
    // exclusões já concluídas somem; no modo nuvem, as que ainda não subiram ficam como "lápide" até sincronizar
    const keepTomb=p=>CLOUD&&(p._dirty||p._conflict);
    for(const p of raw.filter(p=>p.deletedAt&&!keepTomb(p))){await Store.del('processes',p.id).catch(()=>{});for(const ph of await Store.photosOf(p.id))await Store.del('photos',ph.id).catch(()=>{})}
    PROCS=raw.filter(p=>!p.deletedAt||keepTomb(p));
    gc().catch(()=>{});
    let u=null;
    if(CLOUD){
      S.screen='login';
      const cu=await withTimeout(Cloud.restore(),10000).catch(()=>null);
      if(AUTH_LINK.error&&!cu)setTimeout(()=>toast('Link inválido ou expirado. Peça um novo acesso ao administrador.',{ms:7000}),400);
      if(cu){try{const prof=await withTimeout(loadProfile(cu),10000);S.user=userFromProfile(prof,cu.email);S.screen=['invite','recovery'].includes(AUTH_LINK.type)?'setpw':homeScreen(prof);u=S.user}catch(e){console.error(e);toast('Não foi possível confirmar sua sessão agora. Entre novamente se necessário.',{ms:6000})}}
      SB.auth.onAuthStateChange(ev=>{if(ev==='PASSWORD_RECOVERY'&&S.user){S.screen='setpw';render();return}if(ev==='SIGNED_OUT'&&S.user&&!S.loggingOut){S.user=null;S.id=null;S.screen='login';Sync.stop();render();toast('Sessão encerrada. Entre novamente.')}});
    }else{
      const sid=sessionStorage.getItem('minc_sess');u=sid&&Auth.list().find(x=>x.id===sid);
      if(u){S.user=u;S.screen='home'}else S.screen='login';
    }
    S.anim='up';render();
    if(CLOUD&&u&&S.screen==='home')Sync.start();
    if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
    if(!CLOUD&&u?.mustChange)pwDialog(true);
  }catch(e){
    console.error(e);
    if(S.screen==='boot')$('#app').innerHTML=`<div class="container"><div class="empty"><h2>Não foi possível iniciar o aplicativo</h2><p>Recarregue a página. Se o problema continuar, os dados salvos neste aparelho não foram apagados.</p><button class="btn primary" onclick="location.reload()">Recarregar</button></div></div>`;
  }finally{clearTimeout(safety)}
}
window.addEventListener('online',()=>{Sync.ui();Sync.kick(500)});
window.addEventListener('offline',()=>Sync.ui());
document.addEventListener('visibilitychange',()=>{if(document.hidden)Saver.flushAll();else Sync.kick(500)});
window.addEventListener('pagehide',()=>{Saver.flushAll()});
let lastErr=0;
window.addEventListener('error',()=>{if(Date.now()-lastErr>5000){lastErr=Date.now();toast('Ocorreu um erro inesperado. Os dados já salvos foram preservados.')}});
window.addEventListener('unhandledrejection',()=>{if(Date.now()-lastErr>5000){lastErr=Date.now();toast('Não foi possível concluir a operação. Tente novamente.')}});
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  const had=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(had)toast('Nova versão instalada.',{label:'Recarregar',action:()=>location.reload(),ms:12000})});
}
boot();
