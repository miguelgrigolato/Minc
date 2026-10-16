/* MINC · ServiceHub — Aprovação de RTS e D.E. (v5.29.0)
   Quem aprova vem da tabela doc_approvers (IDs de usuário). O app só ESCONDE/MOSTRA botões; quem decide de verdade é o banco
   (gatilhos rts_guard_approval e de_guard_approval): o servidor confere a permissão, carimba quem aprovou e quando, congela o RTS
   aprovado e grava tudo em doc_audit. Sem nuvem (uso local), aprova quem é administrador/gestor, como antes.
   D.E.: estado em p.aprovacao = {estado: nenhum|aguardando|aprovado|reprovado, enviado*, aprovado*, reprovado*, motivo}.
   Carregado ANTES do app.js: tudo que usa funções do app roda só quando chamado. */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};
MX.sync=MX.sync||[];MX.boot=MX.boot||[];
const LSK='minc_approvers';

const Aprov={
  ids:new Set(),names:[],at:0,
  set(rows){this.ids=new Set(rows.map(x=>x.user_id));this.names=rows.map(x=>x.note).filter(Boolean);this.at=Date.now()},
  async load(){
    if(!CLOUD||!S.user||!navigator.onLine)return false;
    const before=[...this.ids].sort().join();
    const {data,error}=await SB.from('doc_approvers').select('user_id,note');
    if(error)throw error;
    this.set(data);try{localStorage.setItem(LSK,JSON.stringify(data))}catch{}
    return [...this.ids].sort().join()!==before;
  },
  restore(){try{const d=JSON.parse(localStorage.getItem(LSK));if(Array.isArray(d))this.set(d)}catch{}}
};
window.Aprov=Aprov;
window.canApprove=()=>CLOUD?!!S.user&&Aprov.ids.has(S.user.id):(typeof isManager==='function'&&isManager());
const quem=()=>Aprov.names.length?Aprov.names.join(' ou '):'quem tem permissão de aprovação';
window.aprovQuem=quem;
MX.boot.push(async()=>{Aprov.restore()});
MX.sync.push(async()=>{
  if(!CLOUD||!S.user)return false;
  if(Aprov.at&&Date.now()-Aprov.at<600000)return false;
  return Aprov.load();
});

/* ---------- rejeição do servidor: o documento vira "conflito" em vez de ficar tentando para sempre ---------- */
window.apReject=async(table,doc,err,after)=>{
  if(!err||!['42501','23514'].includes(err.code))return false;
  try{const q=await SB.from(table).select('*').eq('id',doc.id).single();if(!q.error){doc._conflict=q.data;after&&await after()}}catch{}
  toast(err.message||'Ação não permitida.',{ms:7000});
  return true;
};

/* ---------- histórico (doc_audit) ---------- */
const ACAO={criado:'Criado',enviado:'Enviado para aprovação',aprovado:'Aprovado',reprovado:'Reprovado',reaberto:'Reaberto para edição',envio_cancelado:'Envio cancelado',
  aprovacao_invalidada_por_edicao:'Aprovação invalidada por edição',excluido:'Excluído',restaurado:'Restaurado',custo_criado:'Orçamento de custos criado',custo_alterado:'Orçamento de custos alterado'};
window.histAprovBtn=(kind,id)=>`<button class="btn" data-act="histAprov" data-kind="${esc(kind)}" data-id="${esc(id)}">${ic('clock','ic')}Histórico</button>`;
Object.assign(MX.act,{
  async histAprov(el){
    if(!CLOUD){toast('O histórico de aprovação fica na nuvem (entre com internet).');return}
    const kind=el.dataset.kind,id=el.dataset.id;
    const {data,error}=await SB.from('doc_audit').select('at,action,actor_name,from_state,to_state,details').eq('kind',kind).eq('doc_id',id).order('at',{ascending:false}).limit(60);
    if(error){toast('Não foi possível carregar o histórico.');return}
    const li=data.map(x=>`<li><b>${esc(ACAO[x.action]||x.action)}</b> — ${esc(x.actor_name||'—')}<br><small class="muted">${fmt(x.at)}${x.details&&x.details.motivo?' · motivo: '+esc(x.details.motivo):''}</small></li>`).join('');
    dialog(`<div class="dlg-body"><h2>Histórico de aprovação</h2>${li?`<ul class="ap-hist">${li}</ul>`:'<p class="hint">Sem registros ainda.</p>'}<div class="actions end"><button class="btn" data-act="closeDlg">Fechar</button></div></div>`);
  }
});

/* ---------- D.E. ---------- */
const apOf=p=>Object.assign({estado:'nenhum'},p&&p.aprovacao);
const nowISO=()=>new Date().toISOString();
const todayD=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const deCur=()=>typeof cur==='function'?cur():null;
function deMissing(p){
  const out=[];
  for(const k of VALIDATED){const t=STEPS.find(s=>s.k===k).t;for(const m of check(k,p))out.push(t+': '+m)}
  return out;
}
window.deApLine=p=>{
  const a=apOf(p);
  if(a.estado==='aprovado')return `<div><dt>Aprovação</dt><dd><span class="badge st-green">Aprovada</span> ${esc(a.aprovadoPor||'')} · ${fmt(a.aprovadoEm)}</dd></div>`;
  if(a.estado==='aguardando')return `<div><dt>Aprovação</dt><dd><span class="badge st-amber">Aguardando aprovação</span></dd></div>`;
  if(a.estado==='reprovado')return `<div><dt>Aprovação</dt><dd><span class="badge st-red">Reprovada</span> ${esc(a.reprovadoPor||'')}</dd></div>`;
  return '';
};
window.deApprovalBar=p=>{
  if(!p)return '';
  const a=apOf(p),adm=canApprove(),hist=CLOUD?histAprovBtn('de',p.id):'';
  const inval=a.invalidadaEm&&a.estado==='nenhum'?`<div class="errbox" style="margin-bottom:10px" role="alert"><b>A aprovação anterior${a.aprovadoAnteriorPor?' de '+esc(a.aprovadoAnteriorPor):''} foi invalidada</b> porque a D.E. foi alterada por ${esc(a.invalidadaPor||'—')} em ${fmt(a.invalidadaEm)}. É preciso aprovar de novo.</div>`:'';
  let h='',acts='',cls='no';
  if(a.estado==='aprovado'){
    cls='yes';h=`<h2>Aprovada</h2><p class="hint" style="margin:0">Aprovada por <b>${esc(a.aprovadoPor)}</b> em ${fmt(a.aprovadoEm)}. Se a D.E. for alterada, a aprovação é invalidada e registrada.</p>`;
    acts=adm?`<button class="btn" data-act="deReopen">Reabrir</button>`:'';
  }else if(a.estado==='aguardando'){
    h=`<h2>Aguardando aprovação</h2><p class="hint" style="margin:0">Enviada por ${esc(a.enviadoPor||'—')} em ${fmt(a.enviadoEm)}.${adm?'':' Quem aprova: '+esc(quem())+'.'}</p>`;
    acts=adm?`<button class="btn" data-act="deReject">Reprovar</button><button class="btn primary" data-act="deApprove">${ic('check')}Aprovar</button>`:`<button class="btn" data-act="deCancel">Cancelar envio</button>`;
  }else{
    const rep=a.estado==='reprovado'?`<div class="errbox" style="margin-bottom:10px" role="alert"><b>Reprovada${a.reprovadoPor?' por '+esc(a.reprovadoPor):''}:</b> ${esc(a.motivo||'')}</div>`:'';
    h=`${rep}${inval}<h2>Aprovação</h2><p class="hint" style="margin:0">${adm?'Você pode aprovar esta D.E. diretamente.':'Quando estiver pronta, envie para aprovação ('+esc(quem())+').'}</p>`;
    acts=adm?`<button class="btn primary" data-act="deApprove">${ic('check')}Aprovar</button>`:`<button class="btn primary" data-act="deSubmit">${ic('next')}Enviar para aprovação</button>`;
  }
  return `<div class="panel rts-ap no-print" data-ap="${cls}"><div class="ph-row"><div>${h}</div><div class="actions">${hist}${acts}</div></div></div>`;
};
const miss=p=>{const m=deMissing(p);if(m.length){toast('Falta preencher: '+m.slice(0,5).join('; ')+(m.length>5?` e mais ${m.length-5}`:'')+'.',{ms:8000});return true}return false};
const reflect=p=>{touch(p);renderMain();Sync&&Sync.kick(300)};
Object.assign(MX.act,{
  deSubmit(){
    const p=deCur();if(!p||miss(p))return;
    p.aprovacao=Object.assign(apOf(p),{estado:'aguardando',enviadoPor:S.user?.name||'',enviadoPorId:S.user?.id||'',enviadoEm:nowISO(),motivo:''});
    reflect(p);toast('Enviada para aprovação.');
  },
  async deApprove(){
    const p=deCur();if(!p)return;
    if(!canApprove()){toast('Só '+quem()+' aprova.');return}
    if(miss(p))return;
    if(!await ask({title:'Aprovar esta D.E.?',body:`A D.E. passa a constar como aprovada por ${S.user?.name||''} agora. Se for alterada depois, a aprovação é invalidada e registrada.`,ok:'Aprovar'}))return;
    p.aprovacao=Object.assign(apOf(p),{estado:'aprovado',aprovadoPor:S.user?.name||'',aprovadoPorId:S.user?.id||'',aprovadoEm:nowISO(),motivo:''});
    p.aprovadoPor=S.user?.name||'';p.aprovadoData=todayD();
    reflect(p);toast('D.E. aprovada.');
  },
  deReject(){
    if(!canApprove()){toast('Só '+quem()+' reprova.');return}
    dialog(`<form class="dlg-body" data-submit="deReject"><h2>Reprovar D.E.</h2><p>O autor vê o motivo e pode corrigir e enviar de novo.</p><div class="field"><label for="dr-m">O que precisa ser ajustado</label><textarea id="dr-m" name="motivo" rows="4" data-keep-case required autofocus></textarea></div><div class="actions end"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit">Reprovar</button></div></form>`);
  },
  async deReopen(){
    const p=deCur();if(!p)return;
    if(!canApprove()){toast('Só '+quem()+' reabre uma D.E. aprovada.');return}
    if(!await ask({title:'Reabrir a D.E. aprovada?',body:'A aprovação atual é desfeita e a D.E. precisa ser aprovada de novo.',ok:'Reabrir'}))return;
    p.aprovacao=Object.assign(apOf(p),{estado:'nenhum'});p.aprovadoPor='';p.aprovadoData='';
    reflect(p);toast('D.E. reaberta.');
  },
  deCancel(){
    const p=deCur();if(!p)return;
    p.aprovacao=Object.assign(apOf(p),{estado:'nenhum'});reflect(p);toast('Envio cancelado.');
  }
});
Object.assign(MX.sub,{
  deReject(f){
    const p=deCur();if(!p||!canApprove())return;
    const m=f.elements.motivo.value.trim();if(!m){toast('Descreva o ajuste necessário.');return}
    p.aprovacao=Object.assign(apOf(p),{estado:'reprovado',reprovadoPor:S.user?.name||'',reprovadoPorId:S.user?.id||'',reprovadoEm:nowISO(),motivo:m});
    closeDialog(f.closest('dialog'));reflect(p);toast('D.E. reprovada.');
  }
});
})();
