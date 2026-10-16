/* MINC · Peritagem — Comparativo RTS x D.E (v5.19.0)
   O RTS é vinculado a um processo (a D.E). Ao vincular — ou ao tocar em "Comparar" — o app gera um relatório de diferenças
   (cabeçalho, componentes/POS, providências, quantidades e materiais) e envia ao Painel de gestão para avaliação.
   Nuvem: tabela rts_dep_reports. Sem nuvem: lista guardada neste aparelho. Carregado ANTES do app.js. */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};
MX.sync=MX.sync||[];MX.boot=MX.boot||[];
const LS='minc_cmp_reports_v1';

/* ---------------- normalização e semelhança ---------------- */
const nz=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const toks=s=>new Set(nz(s).split(' ').filter(w=>w.length>1||/\d/.test(w)));
const dice=(a,b)=>{const A=toks(a),B=toks(b);if(!A.size||!B.size)return 0;let i=0;A.forEach(x=>{if(B.has(x))i++});return 2*i/(A.size+B.size)};
const posKey=p=>String(p??'').trim().toUpperCase().replace(/^0+(?=\d)/,'');
const num=v=>{const n=parseFloat(String(v??'').replace(/\./g,'').replace(',','.'));return isNaN(n)?null:n};
const sameNum=(a,b)=>{const x=num(a),y=num(b);return x===null||y===null?true:Math.abs(x-y)<1e-9};
const cleanName=n=>String(n||'').replace(/^\s*POS\.?\s*[A-Za-z0-9.\-]+\s*[-–—]\s*/i,'').trim();
const posOfName=n=>{const m=/^\s*POS\.?\s*([A-Za-z0-9.\-]+)\s*[-–—]/i.exec(String(n||''));return m?m[1]:''};
const lab=x=>`${x.pos?'POS. '+x.pos+' – ':''}${x.nome||'(sem nome)'}`;
const provTxt=a=>(a&&a.length?a.join(' / '):'—');
const sameSet=(a,b)=>{const A=new Set(a.map(nz)),B=new Set(b.map(nz));return A.size===B.size&&[...A].every(x=>B.has(x))};

/* ---------------- o relatório ---------------- */
function depItems(proc){
  let list=[];try{list=treeList(proc)}catch{}
  return list.map(({c,no})=>({pos:c.pos||posOfName(c.name),nome:cleanName(c.name),provs:c.acoes||[],qtd:c.qtd||'',unid:c.unid||'',no}));
}
function depMats(proc){
  let rows=[];try{rows=structRows(proc)}catch{}
  return rows.filter(x=>x.tipo==='Matéria-prima').map(x=>({desc:x.desc||'',qtd:x.qty||'',unid:x.unit||'',codigo:x.codigo||''}));
}
function compare(rts,proc){
  const rep={cab:[],comp:{soRts:[],soDep:[],dif:[]},mats:{soRts:[],soDep:[],dif:[]}};
  // cabeçalho
  if(rts.cliente&&proc.cliente&&nz(rts.cliente)!==nz(proc.cliente)&&dice(rts.cliente,proc.cliente)<.8)rep.cab.push({campo:'Cliente',rts:rts.cliente,dep:proc.cliente});
  else if(!rts.cliente!==!proc.cliente)rep.cab.push({campo:'Cliente',rts:rts.cliente||'(vazio)',dep:proc.cliente||'(vazio)'});
  if(rts.produto&&proc.equipamento&&dice(rts.produto,proc.equipamento)<.5)rep.cab.push({campo:'Produto / equipamento',rts:rts.produto,dep:proc.equipamento});
  // componentes
  const R=(rts.pos||[]).map(p=>({pos:p.pos||'',nome:p.nome||'',provs:p.provs||[],qtd:p.qtd||'',unid:p.unid||''}));
  const D=depItems(proc),usedD=new Set(),pairs=[],restR=[];
  const take=(r,test)=>{const i=D.findIndex((d,k)=>!usedD.has(k)&&test(d));if(i<0)return false;usedD.add(i);pairs.push([r,D[i]]);return true};
  for(const r of R){if(posKey(r.pos)&&take(r,d=>posKey(d.pos)===posKey(r.pos)))continue;restR.push(r)}
  const rest2=[];
  for(const r of restR){if(take(r,d=>!posKey(d.pos)&&nz(d.nome)===nz(r.nome)&&nz(r.nome)))continue;rest2.push(r)}
  for(const r of rest2){
    let best=-1,bs=0;D.forEach((d,k)=>{if(usedD.has(k))return;const s=dice(r.nome,d.nome);if(s>bs){bs=s;best=k}});
    if(best>=0&&bs>=.7){usedD.add(best);pairs.push([r,D[best]])}else rep.comp.soRts.push({pos:r.pos,nome:r.nome,provs:r.provs,qtd:r.qtd})
  }
  D.forEach((d,k)=>{if(!usedD.has(k))rep.comp.soDep.push({pos:d.pos,nome:d.nome,provs:d.provs,qtd:d.qtd})});
  for(const [r,d] of pairs){
    const nome=r.nome||d.nome,pos=r.pos||d.pos;
    if(!sameSet(r.provs,d.provs)&&(r.provs.length||d.provs.length))rep.comp.dif.push({pos,nome,campo:'Providência',rts:provTxt(r.provs),dep:provTxt(d.provs)});
    if(!sameNum(r.qtd,d.qtd))rep.comp.dif.push({pos,nome,campo:'Quantidade',rts:r.qtd,dep:d.qtd});
  }
  // materiais: lista do RTS x matérias-primas da D.E
  const RM=(rts.materiais||[]).filter(m=>String(m.desc||'').trim()).map(m=>({desc:m.desc,qtd:m.qtd||'',unid:m.unid||''}));
  const DM=depMats(proc),usedM=new Set();
  for(const m of RM){
    let best=-1,bs=0;DM.forEach((d,k)=>{if(usedM.has(k))return;const s=Math.max(dice(m.desc,d.desc),d.codigo&&nz(m.desc).includes(nz(d.codigo))?1:0);if(s>bs){bs=s;best=k}});
    if(best>=0&&bs>=.75){usedM.add(best);const d=DM[best];if(!sameNum(m.qtd,d.qtd)||(nz(m.unid)&&nz(d.unid)&&nz(m.unid)!==nz(d.unid)))rep.mats.dif.push({desc:m.desc,rts:`${m.qtd} ${m.unid}`.trim(),dep:`${d.qtd} ${d.unid}`.trim()})}
    else rep.mats.soRts.push(m);
  }
  DM.forEach((d,k)=>{if(!usedM.has(k))rep.mats.soDep.push(d)});
  rep.total=rep.cab.length+rep.comp.soRts.length+rep.comp.soDep.length+rep.comp.dif.length+rep.mats.soRts.length+rep.mats.soDep.length+rep.mats.dif.length;
  rep.nR=R.length;rep.nD=D.length;
  return rep;
}
window.Cmp_compare=compare;

/* ---------------- guarda: nuvem ou aparelho ---------------- */
const Cmp={
  list:[],at:0,busy:false,
  localLoad(){try{return JSON.parse(localStorage.getItem(LS))||[]}catch{return[]}},
  localSave(l){try{localStorage.setItem(LS,JSON.stringify(l))}catch{}},
  async load(force){
    if(this.busy||(!force&&Date.now()-this.at<20000))return;
    if(!CLOUD){this.list=this.localLoad();this.at=Date.now();return}
    if(!navigator.onLine)return;
    this.busy=true;
    try{const r=await SB.from('rts_dep_reports').select('*').order('updated_at',{ascending:false}).limit(300);if(r.error)throw r.error;this.list=r.data;this.at=Date.now()}
    catch(e){if(!/PGRST205|42P01|schema cache/i.test(JSON.stringify(e)))console.error('comparativo',e)}
    finally{this.busy=false}
  },
  pending(){return this.list.filter(x=>x.status==='Pendente')},
  find(rtsId,procId){return this.list.find(x=>x.rts_id===rtsId&&x.process_id===procId&&x.status==='Pendente')},
  /* grava (ou atualiza o pendente do mesmo par) */
  async send(rts,proc,rep){
    const data={rep,rts:{numero:rts.numero,cliente:rts.cliente,produto:rts.produto},proc:{equipamento:proc.equipamento,cliente:proc.cliente,process:proc.process,pedido:proc.pedido}};
    const ex=this.find(rts.id,proc.id),now=new Date().toISOString(),who=S.user?.name||'';
    if(!CLOUD){
      const l=this.localLoad();
      if(ex){const i=l.findIndex(x=>x.id===ex.id);l[i]={...l[i],data,total:rep.total,updated_at:now,created_by_name:who}}
      else l.unshift({id:uid('CMP'),rts_id:rts.id,process_id:proc.id,status:'Pendente',total:rep.total,data,created_by_name:who,created_at:now,updated_at:now});
      this.localSave(l);this.list=l;this.at=Date.now();return true;
    }
    if(!navigator.onLine)throw new Error('Sem conexão: o comparativo só pode ser enviado ao painel com internet.');
    let r;
    if(ex)r=await SB.from('rts_dep_reports').update({data,total:rep.total,created_by_name:who}).eq('id',ex.id);
    else r=await SB.from('rts_dep_reports').insert({id:uid('CMP'),rts_id:rts.id,process_id:proc.id,total:rep.total,data,created_by_name:who});
    if(r.error)throw r.error;
    await this.load(true);return true;
  },
  /* avaliação pelo gestor */
  async evaluate(id,status,note){
    const now=new Date().toISOString(),who=S.user?.name||'';
    if(!CLOUD){const l=this.localLoad(),i=l.findIndex(x=>x.id===id);if(i>=0)l[i]={...l[i],status,note,evaluated_by_name:who,evaluated_at:now,updated_at:now};this.localSave(l);this.list=l;return}
    const r=await SB.from('rts_dep_reports').update({status,note,evaluated_by_name:who,evaluated_at:now,evaluated_by:S.user.id}).eq('id',id);
    if(r.error)throw r.error;await this.load(true);
  },
  sig(){return this.list.map(x=>x.id+x.updated_at+x.status).join('|')},
  ensure(){const before=this.sig();this.load().then(()=>{if(S.screen==='panel'&&this.sig()!==before)renderMain()})}
};
window.Cmp=Cmp;
MX.boot.push(()=>{if(!CLOUD)Cmp.list=Cmp.localLoad()});

/* ---------------- telas ---------------- */
const tbl=(head,rows)=>rows.length?`<div class="tw"><table class="tbl"><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td class="wrap">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'';
function repHTML(rep){
  if(!rep.total)return '<p class="hint">Nenhuma diferença encontrada entre o RTS e a D.E.</p>';
  const sec=(t,n,body)=>n?`<h3 class="cmp-h">${t} <span class="badge st-amber">${n}</span></h3>${body}`:'';
  return sec('Cabeçalho',rep.cab.length,tbl(['Campo','RTS','D.E'],rep.cab.map(x=>[x.campo,x.rts,x.dep])))
   +sec('Itens (POS) só no RTS — não estão na D.E',rep.comp.soRts.length,tbl(['Item','Providência no RTS','Qtd.'],rep.comp.soRts.map(x=>[lab(x),provTxt(x.provs),x.qtd])))
   +sec('Itens só na D.E — não estão no RTS',rep.comp.soDep.length,tbl(['Item','Providência na D.E','Qtd.'],rep.comp.soDep.map(x=>[lab(x),provTxt(x.provs),x.qtd])))
   +sec('Itens com valores diferentes',rep.comp.dif.length,tbl(['Item','O que difere','RTS','D.E'],rep.comp.dif.map(x=>[lab(x),x.campo,x.rts,x.dep])))
   +sec('Materiais só no RTS',rep.mats.soRts.length,tbl(['Descrição','Qtd.'],rep.mats.soRts.map(x=>[x.desc,`${x.qtd} ${x.unid}`.trim()])))
   +sec('Matérias-primas só na D.E',rep.mats.soDep.length,tbl(['Descrição','Código','Qtd.'],rep.mats.soDep.map(x=>[x.desc,x.codigo,`${x.qtd} ${x.unid}`.trim()])))
   +sec('Materiais com quantidade diferente',rep.mats.dif.length,tbl(['Descrição','RTS','D.E'],rep.mats.dif.map(x=>[x.desc,x.rts,x.dep])));
}
const procOpt=p=>`${p.equipamento||'Sem equipamento'} — ${p.cliente||'sem cliente'} (processo ${p.process||'—'}, pedido ${p.pedido||'—'})`;
const RA=()=>window.RtsApi||{};

/* painel dentro do editor do RTS */
window.cmpPanel=function(r){
  const procs=(typeof PROCS!=='undefined'?PROCS:[]).filter(p=>!p.deletedAt).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  const linked=r.processoId?procs.find(p=>p.id===r.processoId):null,locked=RA().locked&&RA().locked(r);
  const b0=Cmp.sig();Cmp.load().then(()=>{if(S.screen==='rtsEdit'&&Cmp.sig()!==b0){const m=document.getElementById('cmp-pend');if(m)m.innerHTML=pendHTML(r)}});
  return `<div class="panel"><div class="ph-row"><div><h2>Vínculo com a D.E (peritagem)</h2><p class="hint" style="margin:0">Vincule este RTS ao processo da peritagem. O app compara os dois e envia o relatório de diferenças ao Painel de gestão.</p></div></div><div class="field"><label for="cmp-proc">Processo vinculado</label><select id="cmp-proc" data-chg="cmpLink" ${locked?'disabled':''}><option value="">Sem vínculo</option>${procs.map(p=>`<option value="${esc(p.id)}" ${p.id===r.processoId?'selected':''}>${esc(procOpt(p))}</option>`).join('')}</select></div>${r.processoId&&!linked?'<p class="errbox">O processo vinculado não foi encontrado neste aparelho.</p>':''}${linked?`<div class="actions"><button type="button" class="btn" data-act="cmpOpen">${ic('search')}Comparar com a D.E</button></div>`:''}<p class="hint" id="cmp-pend">${pendHTML(r)}</p></div>`;
};
function pendHTML(r){
  if(!r.processoId)return '';
  const ex=Cmp.list.filter(x=>x.rts_id===r.id&&x.process_id===r.processoId).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at))[0];
  if(!ex)return 'Nenhum comparativo enviado ao painel ainda.';
  return `Último comparativo: ${ex.total} ${ex.total===1?'diferença':'diferenças'} — <b>${esc(ex.status)}</b>${ex.evaluated_by_name?` por ${esc(ex.evaluated_by_name)}`:''} (${fmt(ex.updated_at)}).${ex.note?` Nota do gestor: ${esc(ex.note)}`:''}`;
}
async function sendReport(rts,proc,{silent}={}){
  const rep=compare(rts,proc);
  if(!rep.total){
    const ex=Cmp.find(rts.id,proc.id);
    if(!silent)toast('Sem diferenças entre o RTS e a D.E.',{ms:4000});
    if(ex)await Cmp.send(rts,proc,rep).catch(()=>{});
    return rep;
  }
  await Cmp.send(rts,proc,rep);
  toast(`Comparativo enviado ao painel de gestão: ${rep.total} ${rep.total===1?'diferença':'diferenças'}.`,{ms:5000});
  return rep;
}
Object.assign(MX.chg,{
  async cmpLink(el){
    const api=RA(),r=api.cur&&api.cur();if(!r)return;
    if(api.locked(r)){toast('RTS travado: reabra para editar o vínculo.');el.value=r.processoId||'';return}
    const proc=PROCS.find(p=>p.id===el.value);
    r.processoId=proc?proc.id:'';r.processoNome=proc?procOpt(proc):'';api.touch(r);
    if(!proc){renderMain();return}
    try{await Cmp.load(true);await sendReport(r,proc)}catch(e){toast(e.message||'Não foi possível enviar o comparativo.',{ms:6000})}
    renderMain();
  }
});
Object.assign(MX.act,{
  cmpOpen(){
    const api=RA(),r=api.cur&&api.cur(),proc=r&&PROCS.find(p=>p.id===r.processoId);if(!r||!proc)return;
    const rep=compare(r,proc);Cmp._cur={rts:r,proc,rep};
    dialog(`<div class="dlg-body cmp-dlg"><h2>RTS ${esc(r.numero)||'(sem nº)'} × D.E</h2><p class="hint">${esc(proc.equipamento)||'Sem equipamento'} — ${esc(proc.cliente)||'sem cliente'} · ${rep.nR} POS no RTS · ${rep.nD} componentes na D.E</p>${repHTML(rep)}<div class="actions end"><button class="btn" data-act="closeDlg">Fechar</button><button class="btn primary" data-act="cmpSend" ${rep.total?'':'disabled'}>${ic('next')}Enviar ao painel de gestão</button></div></div>`,{cls:'svc-dialog'});
  },
  async cmpSend(el){
    const c=Cmp._cur;if(!c)return;el.disabled=true;
    try{await Cmp.send(c.rts,c.proc,c.rep);closeDialog(el.closest('dialog'));toast(`Comparativo enviado ao painel de gestão: ${c.rep.total} ${c.rep.total===1?'diferença':'diferenças'}.`,{ms:5000});const m=document.getElementById('cmp-pend');if(m)m.innerHTML=pendHTML(c.rts)}
    catch(e){toast(e.message||'Não foi possível enviar.',{ms:6000});el.disabled=false}
  },
  /* painel de gestão: abrir um relatório e avaliar */
  cmpView(el){
    const x=Cmp.list.find(r=>r.id===el.dataset.id);if(!x)return;
    const d=x.data||{},rep=d.rep||{total:0,cab:[],comp:{soRts:[],soDep:[],dif:[]},mats:{soRts:[],soDep:[],dif:[]}};
    const ev=isManager()?`<div class="cmp-ev"><div class="grid g2"><div class="field"><label for="cmp-st">Decisão</label><select id="cmp-st"><option value="Resolvido" ${x.status==='Resolvido'?'selected':''}>Resolvido (documentos corrigidos)</option><option value="Aceito" ${x.status==='Aceito'?'selected':''}>Diferença aceita (está certo assim)</option><option value="Descartado" ${x.status==='Descartado'?'selected':''}>Descartado</option><option value="Pendente" ${x.status==='Pendente'?'selected':''}>Manter pendente</option></select></div><div class="field"><label for="cmp-nt">Nota</label><input id="cmp-nt" value="${esc(x.note||'')}" maxlength="2000" placeholder="Opcional"></div></div></div>`:'';
    dialog(`<div class="dlg-body cmp-dlg" data-id="${esc(x.id)}"><h2>RTS ${esc(d.rts?.numero)||'(sem nº)'} × D.E</h2><p class="hint">${esc(d.proc?.equipamento)||'—'} — ${esc(d.proc?.cliente)||'—'} · enviado por ${esc(x.created_by_name)||'—'} em ${fmt(x.updated_at)} · <b>${esc(x.status)}</b></p>${repHTML(rep)}${ev}<div class="actions" style="justify-content:space-between;margin-top:12px"><div class="actions"><button class="btn" data-act="cmpGoRts" data-id="${esc(x.rts_id)}">Abrir RTS</button><button class="btn" data-act="cmpGoDep" data-id="${esc(x.process_id)}">Abrir D.E</button></div><div class="actions"><button class="btn" data-act="closeDlg">Fechar</button>${isManager()?`<button class="btn primary" data-act="cmpSave" data-id="${esc(x.id)}">${ic('check')}Salvar avaliação</button>`:''}</div></div></div>`,{cls:'svc-dialog'});
  },
  async cmpSave(el){
    const dlg=el.closest('dialog'),st=dlg.querySelector('#cmp-st').value,nt=dlg.querySelector('#cmp-nt').value.trim();
    el.disabled=true;
    try{await Cmp.evaluate(el.dataset.id,st,nt);closeDialog(dlg);toast('Avaliação salva.');if(S.screen==='panel')renderMain()}
    catch(e){toast(e.message||'Não foi possível salvar.',{ms:6000});el.disabled=false}
  },
  cmpGoRts(el){const id=el.dataset.id;closeDialog(el.closest('dialog'));if(window.Settings&&!Settings.rtsOn()){toast('A aba RTS está desligada.');return}MX.act.rtsOpen({dataset:{id}})},
  async cmpGoDep(el){const id=el.dataset.id;closeDialog(el.closest('dialog'));await openProcess(id)}
});

/* seção do Painel de gestão */
window.cmpPanelSection=function(){
  Cmp.ensure();
  const pend=Cmp.pending(),done=Cmp.list.filter(x=>x.status!=='Pendente').slice(0,8);
  const row=x=>{const d=x.data||{};return `<li class="doc"><div class="doc-h"><span class="badge ${x.status==='Pendente'?'st-amber':'st-green'}">${esc(x.status)}</span><b>RTS ${esc(d.rts?.numero)||'sem nº'} × D.E</b><small>${esc(d.proc?.equipamento)||'—'} · ${esc(d.proc?.cliente)||'—'}</small></div><div class="doc-m">${x.total} ${x.total===1?'diferença':'diferenças'} · enviado por ${esc(x.created_by_name)||'—'} em ${fmt(x.updated_at)}${x.evaluated_by_name?` · avaliado por ${esc(x.evaluated_by_name)}`:''}</div><div class="doc-a"><button class="btn ${x.status==='Pendente'?'primary':''}" data-act="cmpView" data-id="${esc(x.id)}">${x.status==='Pendente'?'Avaliar':'Ver'}</button></div></li>`};
  return `<div class="panel"><h2>Diferenças RTS × D.E para avaliar</h2><p class="hint">Gerado quando um RTS é vinculado a um processo (ou quando o comparativo é reenviado). Avalie, aceite a diferença ou peça correção.</p>${pend.length?`<ul class="docs">${pend.map(row).join('')}</ul>`:'<p class="hint">Nenhuma diferença aguardando avaliação.</p>'}${done.length?`<details class="imp-w"><summary>Últimas avaliações (${done.length})</summary><ul class="docs">${done.map(row).join('')}</ul></details>`:''}</div>`;
};
window.cmpPendingCount=()=>Cmp.pending().length;
})();
