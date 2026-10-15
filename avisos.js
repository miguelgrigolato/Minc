/* MINC ServiceHub — Avisos (sino na barra) e proteção do trabalho sem internet (v5.21.0)
   Avisos:
   - Administrador / gestor: RTS enviado para aprovação e comparativo RTS × D.E aguardando avaliação.
   - Quem enviou: RTS aprovado ou devolvido; comparativo avaliado.
   Aparecem no sino da barra superior e como aviso do sistema (celular/computador) quando a pessoa permitir.
   Os avisos são conferidos a cada sincronização (a cada minuto com o app aberto); com o app fechado não há aviso.
   Sem internet: faixa fixa avisando que tudo fica no aparelho, pedido de armazenamento persistente ao navegador
   e alerta ao fechar a página com alterações ainda não enviadas. Carregado depois do rts.js e antes do app.js. */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};
MX.sync=MX.sync||[];MX.boot=MX.boot||[];
const KEY='minc_avisos_v1';

/* ---------------- lista de avisos (calculada) ---------------- */
const me=()=>S.user?.name||'';
function compute(){
  const out=[],mgr=typeof isManager==='function'&&isManager(),rtsOn=!!(window.Settings&&Settings.rtsOn());
  const rts=(window.RTSLIST?RTSLIST():[]).filter(r=>!r.deletedAt);
  if(rtsOn){
    if(mgr)rts.filter(r=>r.status==='Aguardando aprovação').forEach(r=>out.push({id:'apr:'+r.id+':'+(r.enviadoEm||''),kind:'rts',rid:r.id,t:`RTS ${r.numero||'sem nº'} aguarda a sua aprovação`,s:`Enviado por ${r.enviadoPor||'—'} · ${r.cliente||''}`,at:r.enviadoEm||r.updatedAt}));
    rts.filter(r=>r.enviadoPor===me()||r.elaboradoPor===me()).forEach(r=>{
      if(r.status==='Aprovado')out.push({id:'ok:'+r.id+':'+(r.aprovadoEm||''),kind:'rts',rid:r.id,t:`RTS ${r.numero||'sem nº'} aprovado`,s:`Por ${r.aprovadoPor||'—'}`,at:r.aprovadoEm||r.updatedAt,info:true});
      if(r.status==='Rascunho'&&r.motivoDevolucao)out.push({id:'dev:'+r.id+':'+(+r.devolucoes||0),kind:'rts',rid:r.id,t:`RTS ${r.numero||'sem nº'} devolvido para ajustes`,s:r.motivoDevolucao,at:r.updatedAt});
    });
    const cmp=window.Cmp?Cmp.list:[];
    if(mgr)cmp.filter(x=>x.status==='Pendente').forEach(x=>out.push({id:'cmp:'+x.id+':'+x.updated_at,kind:'cmp',cid:x.id,t:`Diferenças RTS ${x.data?.rts?.numero||''} × D.E para avaliar`,s:`${x.total} ${x.total===1?'diferença':'diferenças'} · enviado por ${x.created_by_name||'—'}`,at:x.updated_at}));
    cmp.filter(x=>x.status!=='Pendente'&&x.created_by_name===me()).forEach(x=>out.push({id:'cmpok:'+x.id+':'+x.status,kind:'cmp',cid:x.id,t:`Comparativo RTS ${x.data?.rts?.numero||''} × D.E avaliado: ${x.status}`,s:x.note||`Por ${x.evaluated_by_name||'—'}`,at:x.evaluated_at||x.updated_at,info:true}));
  }
  return out.sort((a,b)=>new Date(b.at||0)-new Date(a.at||0));
}
const seen=()=>{try{return new Set(JSON.parse(localStorage.getItem(KEY+':'+(S.user?.id||'')))||[])}catch{return new Set()}};
const saveSeen=s=>{try{localStorage.setItem(KEY+':'+(S.user?.id||''),JSON.stringify([...s].slice(-400)))}catch{}};
let first=true;
const unread=()=>{const s=seen();return compute().filter(a=>!s.has(a.id))};

/* sino na barra superior */
window.bellBtn=()=>{if(!S.user)return '';const n=unread().length;return `<button class="iconbtn bell" data-act="avisos" aria-label="Avisos${n?': '+n+' novos':''}" title="Avisos">${ic('bell')}${n?`<span class="bell-n">${n>9?'9+':n}</span>`:''}</button>`};
function refreshBell(){const b=document.querySelector('.bell');if(b)b.outerHTML=window.bellBtn()}

/* confere a cada sincronização e avisa o que é novo */
async function check(){
  if(!S.user)return false;
  if(window.Cmp)try{await Cmp.load()}catch{}
  const s=seen(),news=compute().filter(a=>!s.has(a.id));
  const notified=new Set(JSON.parse(sessionStorage.getItem(KEY+':notified')||'[]'));
  const fresh=news.filter(a=>!notified.has(a.id));
  if(fresh.length&&!first){
    fresh.slice(0,3).forEach(a=>toast(a.t,{ms:6000}));
    if('Notification' in window&&Notification.permission==='granted'&&document.hidden){
      try{const reg=await navigator.serviceWorker?.getRegistration();const opt={body:fresh.length>1?`${fresh[0].s}\n(+${fresh.length-1} aviso${fresh.length>2?'s':''})`:fresh[0].s,icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:'minc-avisos'};
        if(reg&&reg.showNotification)await reg.showNotification('MINC ServiceHub — '+fresh[0].t,opt);else new Notification('MINC ServiceHub — '+fresh[0].t,opt)}catch(e){console.error('aviso do sistema',e)}
    }
  }
  fresh.forEach(a=>notified.add(a.id));sessionStorage.setItem(KEY+':notified',JSON.stringify([...notified].slice(-400)));
  first=false;refreshBell();return false;
}
MX.sync.push(check);
MX.boot.push(()=>{setTimeout(()=>{check().catch(()=>{})},1500)});

Object.assign(MX.act,{
  avisos(){
    const l=compute(),s=seen();
    const perm='Notification' in window?Notification.permission:'unsupported';
    const permRow=perm==='default'?`<div class="mdl-hint" style="margin:10px 0"><b>Receber avisos do sistema?</b> Com o app aberto em segundo plano, o celular ou o computador mostra um aviso quando chegar algo novo.<div class="actions" style="margin-top:8px"><button class="btn" data-act="avisosPerm">${ic('bell')}Ativar avisos do sistema</button></div></div>`:perm==='denied'?'<p class="hint">Os avisos do sistema estão bloqueados no navegador. Para ligar, libere as notificações deste site nas configurações do navegador.</p>':'';
    dialog(`<div class="dlg-body"><h2>Avisos</h2>${permRow}${l.length?`<ul class="docs">${l.map(a=>`<li class="doc ${s.has(a.id)?'':'new'}"><div class="doc-h">${s.has(a.id)?'':'<span class="badge st-amber">Novo</span>'}<b>${esc(a.t)}</b><small>${fmt(a.at)}</small></div><div class="doc-m">${esc(a.s||'')}</div><div class="doc-a"><button class="btn" data-act="avisoOpen" data-kind="${a.kind}" data-id="${esc(a.rid||a.cid)}">Abrir</button></div></li>`).join('')}</ul>`:'<p class="hint">Nenhum aviso.</p>'}<div class="actions end"><button class="btn" data-act="closeDlg">Fechar</button>${l.length?'<button class="btn primary" data-act="avisosLidos">Marcar todos como lidos</button>':''}</div></div>`,{cls:'svc-dialog'});
  },
  avisosLidos(el){const s=seen();compute().forEach(a=>s.add(a.id));saveSeen(s);closeDialog(el.closest('dialog'));refreshBell()},
  async avisosPerm(el){try{const r=await Notification.requestPermission();toast(r==='granted'?'Avisos do sistema ativados neste aparelho.':'Avisos do sistema não foram permitidos.');closeDialog(el.closest('dialog'))}catch{toast('Este navegador não permite avisos do sistema.')}},
  avisoOpen(el){
    const {kind,id}=el.dataset,s=seen();compute().filter(a=>(a.rid||a.cid)===id).forEach(a=>s.add(a.id));saveSeen(s);
    closeDialog(el.closest('dialog'));refreshBell();
    if(kind==='rts'){MX.act.rtsOpen({dataset:{id}});return}
    if(kind==='cmp'){if(typeof isManager==='function'&&isManager()){S.screen='panel';render();setTimeout(()=>MX.act.cmpView({dataset:{id}}),50)}else{const x=Cmp.list.find(c=>c.id===id);if(x)MX.act.rtsOpen({dataset:{id:x.rts_id}})}}
  }
});

/* ---------------- sem internet ---------------- */
window.offlineBar=()=>{
  if(navigator.onLine||!S.user)return '<div id="offbar" hidden></div>';
  const n=window.Sync?Sync.pendingCount():0;
  return `<div id="offbar" class="offbar no-print" role="status">${ic('alert','ic sm')}<span><b>Sem internet.</b> Pode continuar trabalhando: tudo fica salvo neste aparelho${n?` (${n} ${n===1?'alteração aguardando':'alterações aguardando'} envio)`:''} e é enviado quando a conexão voltar. Não limpe os dados do navegador nem desinstale o app antes disso.</span></div>`;
};
const updBar=()=>{const b=document.getElementById('offbar');if(b)b.outerHTML=window.offlineBar()};
window.addEventListener('online',()=>{updBar();if(S.user)toast('Conexão de volta. Enviando o que ficou pendente…',{ms:3500})});
window.addEventListener('offline',()=>{updBar();if(S.user)toast('Sem internet: o trabalho continua salvo neste aparelho.',{ms:4500})});
/* pede ao navegador para não apagar os dados do app quando faltar espaço */
MX.boot.push(async()=>{try{if(navigator.storage&&navigator.storage.persist&&!(await navigator.storage.persisted()))await navigator.storage.persist()}catch{}});
window.storageInfo=async()=>{
  try{const p=navigator.storage?.persisted?await navigator.storage.persisted():false;const e=navigator.storage?.estimate?await navigator.storage.estimate():null;
    return `Armazenamento deste aparelho: ${p?'<b>protegido</b> (o navegador não apaga sozinho)':'<b>não protegido</b> — o navegador pode apagar dados antigos se faltar espaço; instale o app (adicionar à tela inicial) para proteger'}${e&&e.usage!=null?` · em uso: ${(e.usage/1048576).toFixed(1)} MB`:''}.`}
  catch{return ''}
};
/* aviso ao fechar a página com alterações não enviadas */
window.addEventListener('beforeunload',e=>{if(S.user&&CLOUD&&window.Sync&&Sync.pendingCount()&&!navigator.onLine){e.preventDefault();e.returnValue=''}});
})();
