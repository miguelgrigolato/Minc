/* MINC · Peritagem — Painel de gestão, histórico de alterações, busca em tudo e detalhe da sincronização (v5.18.0)
   Painel e histórico: só administrador e gestor. Busca em tudo e detalhe de envio: todos os perfis.
   Carregado ANTES do app.js: tudo que usa funções do app roda só quando chamado. */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};
MX.sync=MX.sync||[];MX.boot=MX.boot||[];

const DAY=864e5;
const norm=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const live=()=>PROCS.filter(p=>!p.deletedAt);
const ageDays=p=>Math.floor((Date.now()-new Date(p.updatedAt||p.createdAt))/DAY);
const rtsList=()=>(window.RTSLIST?RTSLIST():[]).filter(r=>!r.deletedAt);

/* ============================== Painel de gestão ============================== */
const DAYS=[7,15,30,60];
const nome=p=>esc(p.equipamento)||'Sem equipamento';
function cadRows(){
  const by=new Map();
  for(const p of live()){
    let rows=[];try{rows=structRows(p).filter(x=>x.sem)}catch{}
    for(const x of rows){const f=x.familia||'Sem família';const e=by.get(f)||{n:0,ps:new Set()};e.n++;e.ps.add(p.id);by.set(f,e)}
  }
  return [...by.entries()].map(([f,e])=>({f,n:e.n,p:e.ps.size})).sort((a,b)=>b.n-a.n||a.f.localeCompare(b.f,'pt-BR'));
}
const kpi=(v,t,sub,tone)=>`<div class="kpi ${tone||''}"><b>${fmtN(v)}</b><span>${t}</span>${sub?`<small>${sub}</small>`:''}</div>`;
const procRow=(p,extra)=>`<tr><td class="wrap"><b>${nome(p)}</b><br><small>${esc(p.cliente)||'Sem cliente'}</small></td><td>${esc(p.process)||'—'}</td><td>${esc(p.pedido)||'—'} / ${esc(p.ordem)||'—'}</td><td>${esc(p.status)}</td><td>${extra}</td><td><button class="btn" data-act="openProcess" data-id="${esc(p.id)}">Abrir</button></td></tr>`;
const procTable=(l,extraFn,vazio)=>l.length?`<div class="tw"><table class="tbl"><thead><tr><th>Equipamento / cliente</th><th>Processo</th><th>Pedido / ordem</th><th>Status</th><th>Detalhe</th><th></th></tr></thead><tbody>${l.map(p=>procRow(p,extraFn(p))).join('')}</tbody></table></div>`:`<p class="hint">${vazio}</p>`;

MX.views.panel=function(){
  if(!isManager())return `<div class="empty"><h2>Acesso restrito</h2><p>O painel é só para administradores e gestores.</p></div>`;
  const all=live(),days=S.panelDays||15;
  const abertos=all.filter(p=>p.status!=='Concluído');
  const parados=abertos.filter(p=>ageDays(p)>=days).sort((a,b)=>ageDays(b)-ageDays(a));
  const semOrdem=abertos.filter(p=>emp(p.ordem));
  const cad=cadRows(),cadTot=cad.reduce((s,x)=>s+x.n,0);
  const rts=rtsList(),rtsAg=rts.filter(r=>r.status==='Aguardando aprovação');
  const pend=window.Sync?Sync.pendingCount():0,conf=window.Sync?Sync.conflicts().length:0;
  const rec=[...all].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,10);
  const porStatus=STATUS.map(s=>[s,all.filter(p=>p.status===s).length]);
  return `<div class="ph"><h1>Painel de gestão</h1><p>Visão geral dos processos. Só administradores e gestores veem esta tela.</p></div>
<div class="kpis">${kpi(abertos.length,'processos em andamento',porStatus.filter(x=>x[0]!=='Concluído').map(x=>x[1]+' '+x[0].toLowerCase()).join(' · '))}${kpi(parados.length,`parados há ${days}+ dias`,'sem alteração',parados.length?'warn':'')}${kpi(semOrdem.length,'sem ordem de serviço','em andamento',semOrdem.length?'warn':'')}${kpi(cadTot,'itens sem cadastro',`${cad.length} ${cad.length===1?'família':'famílias'}`,cadTot?'warn':'')}${window.Settings&&Settings.rtsOn()?kpi(rtsAg.length,'RTS aguardando aprovação','',rtsAg.length?'warn':''):''}${kpi(pend+conf,'envios pendentes ou conflitos','dados que ainda não chegaram à nuvem',pend+conf?'warn':'')}</div>
<div class="panel"><div class="ph-row"><div><h2>Processos parados</h2><p class="hint" style="margin:0">Em andamento e sem nenhuma alteração há pelo menos o prazo escolhido.</p></div><div class="field" style="margin:0;min-width:160px"><label for="pn-days" class="sr-only">Prazo</label><select id="pn-days" data-chg="panelDays">${DAYS.map(d=>`<option value="${d}" ${d===days?'selected':''}>${d} dias ou mais</option>`).join('')}</select></div></div>${procTable(parados,p=>`${ageDays(p)} dias · ${esc(p.updatedBy||p.createdBy||'')}`,'Nenhum processo parado neste prazo.')}</div>
<div class="panel"><h2>Itens sem cadastro no Nomus</h2><p class="hint">Matérias-primas que o perito marcou como “sem cadastro”, por família. A lista completa de cada processo está em Estrutura &gt; Lista de cadastro.</p>${cad.length?`<div class="tw"><table class="tbl"><thead><tr><th>Família</th><th>Itens</th><th>Processos</th></tr></thead><tbody>${cad.map(x=>`<tr><td>${esc(x.f)}</td><td>${fmtN(x.n)}</td><td>${fmtN(x.p)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">Nenhum item sem cadastro.</p>'}</div>
<div class="panel"><h2>Sem ordem de serviço</h2>${procTable(semOrdem.slice(0,25),p=>`criado em ${fmtDay(p.createdAt)}`,'Todos os processos em andamento têm ordem.')}</div>
${window.Settings&&Settings.rtsOn()?`<div class="panel"><h2>RTS aguardando aprovação</h2>${rtsAg.length?`<ul class="docs">${rtsAg.map(r=>`<li class="doc"><div class="doc-h"><b>${esc(r.numero)||'Sem nº'}</b><small>${esc(r.cliente)||'—'} · ${esc(r.produto)||'—'}</small></div><div class="doc-a"><button class="btn" data-act="rtsOpen" data-id="${esc(r.id)}">Abrir</button></div></li>`).join('')}</ul>`:'<p class="hint">Nenhum RTS aguardando.</p>'}</div>`:''}
<div class="panel"><h2>Atividade recente</h2><div class="tw"><table class="tbl"><thead><tr><th>Equipamento / cliente</th><th>Quem alterou</th><th>Quando</th><th></th></tr></thead><tbody>${rec.map(p=>`<tr><td class="wrap"><b>${nome(p)}</b><br><small>${esc(p.cliente)||'Sem cliente'}</small></td><td>${esc(p.updatedBy||p.createdBy)||'—'}</td><td>${fmt(p.updatedAt)}</td><td><button class="btn" data-act="openProcess" data-id="${esc(p.id)}">Abrir</button></td></tr>`).join('')}</tbody></table></div></div>`;
};
Object.assign(MX.act,{
  panelHome(){
    if(!isManager()){toast('O painel é só para administradores e gestores.');return}
    if(S.screen==='panel'){scrollTo({top:0,behavior:RM()?'auto':'smooth'});return}
    if(window.RtsSave)RtsSave.flush();S.id=null;S.errs=null;S.screen='panel';S.anim='up';render();scrollTo(0,0);
    if(window.Sync)Sync.kick(500);
  }
});
Object.assign(MX.chg,{panelDays(el){S.panelDays=+el.value||15;renderMain()}});

/* ============================== Histórico de alterações (por processo) ============================== */
const ROT={process:'Nº do processo',pedido:'Pedido',ordem:'Ordem',equipamento:'Equipamento',cliente:'Cliente',excluido:'Exclusão/restauração',vedacao:'Tipo de vedação',acionamento:'Acionamento',fluido:'Fluido de trabalho',observacoes:'Observações',components:'Componentes',plaq:'Plaqueta',nomus:'Peritagem Nomus',dataDoc:'Data do documento',revisao:'Revisão',motivoRevisao:'Motivo da revisão',elaboradoPor:'Elaborado por',elaboradoData:'Data da elaboração',aprovadoPor:'Aprovado por',aprovadoData:'Data da aprovação',pasta:'Pasta na nuvem'};
const rot=k=>ROT[k]||(/test|teste/i.test(k)?'Teste':/pack|embal/i.test(k)?'Embalagem':k);
window.histBtn=id=>CLOUD&&isManager()?`<button class="btn" data-act="procHist" data-id="${esc(id)}">${ic('clock','ic')}Histórico</button>`:'';
Object.assign(MX.act,{
  async procHist(el){
    const id=el.dataset.id;
    const d=dialog(`<div class="dlg-body"><h2>Histórico de alterações</h2><div id="hs-out"><div class="sk" style="height:80px"></div></div><div class="actions end"><button class="btn" data-act="closeDlg">Fechar</button></div></div>`);
    const out=d.querySelector('#hs-out');
    try{
      if(!navigator.onLine)throw new Error('Sem conexão: o histórico fica na nuvem.');
      const r=await SB.from('process_history').select('changed_by,changed_at,fields,status_from,status_to').eq('process_id',id).order('changed_at',{ascending:false}).limit(60);
      if(r.error)throw r.error;
      const ids=[...new Set(r.data.map(x=>x.changed_by).filter(Boolean))];
      const nm={};
      if(ids.length){const u=await SB.from('profiles').select('id,name').in('id',ids);(u.data||[]).forEach(x=>nm[x.id]=x.name)}
      out.innerHTML=r.data.length?`<ul class="hist">${r.data.map(x=>`<li><b>${fmt(x.changed_at)}</b> — ${esc(nm[x.changed_by]||'usuário')}<br><span>${x.status_to?`Status: ${esc(x.status_from)} → ${esc(x.status_to)}. `:''}${x.fields&&x.fields.length?'Alterou: '+x.fields.map(rot).map(esc).join(', ')+'.':''}</span></li>`).join('')}</ul>`:'<p class="hint">Ainda não há alterações registradas para este processo. O histórico começou na versão 5.18.</p>';
    }catch(e){out.innerHTML=`<p class="errbox">${esc(e.message||cloudErrMsg(e))}</p>`}
  }
});

/* ============================== Busca em tudo ============================== */
function match(q){
  const t=norm(q).trim();if(!t)return()=>false;
  if(t.includes('%')){const parts=t.split('%').map(x=>x.trim()).filter(Boolean);return h=>{h=norm(h);let i=0;for(const p of parts){const j=h.indexOf(p,i);if(j<0)return false;i=j+p.length}return true}}
  const ws=t.split(/\s+/);return h=>{h=norm(h);return ws.every(w=>h.includes(w))};
}
function gsResults(q){
  const m=match(q),g=[];
  const procs=live().filter(p=>m([p.equipamento,p.cliente,p.process,p.pedido,p.ordem,p.observacoes,p.status].join(' '))).slice(0,8);
  if(procs.length)g.push(['Processos',procs.map(p=>`<button class="gs-r" data-act="gsOpen" data-id="${esc(p.id)}"><b>${nome(p)}</b><small>${esc(p.cliente)||'Sem cliente'} · processo ${esc(p.process)||'—'} · pedido ${esc(p.pedido)||'—'}</small></button>`)]);
  const comps=[];
  for(const p of live()){for(const c of (p.components||[])){
    const leaves=(c.materials||[]).map(x=>[x.raw,x.codigo].join(' ')).join(' ');
    if(m([c.name,leaves].join(' ')))comps.push(`<button class="gs-r" data-act="gsOpen" data-id="${esc(p.id)}" data-go="components"><b>${esc(c.name)||'Componente sem nome'}</b><small>em ${nome(p)} · ${esc(p.cliente)||'sem cliente'}</small></button>`);
    if(comps.length>=8)break}
    if(comps.length>=8)break}
  if(comps.length)g.push(['Componentes e materiais',comps]);
  const rts=rtsList().filter(r=>m([r.numero,r.cliente,r.produto,r.status].join(' '))).slice(0,8);
  if(rts.length&&window.Settings&&Settings.rtsOn())g.push(['RTS',rts.map(r=>`<button class="gs-r" data-act="gsRts" data-id="${esc(r.id)}"><b>RTS ${esc(r.numero)||'sem nº'}</b><small>${esc(r.cliente)||'—'} · ${esc(r.produto)||'—'} · ${esc(r.status)}</small></button>`)]);
  const mods=(window.Models?Models.list:[]).filter(x=>m([x.name,x.dn].join(' '))).slice(0,5);
  if(mods.length)g.push(['Modelos de válvula',mods.map(x=>`<div class="gs-r static"><b>${esc(x.name)}</b><small>${x.dn?'DN '+esc(x.dn)+' · ':''}${plural((x.components||[]).length,'componente','componentes')}</small></div>`)]);
  const mats=(window.Mats&&Mats.list?Mats.list:[]).filter(x=>x.active!==false&&m([x.codigo,x.descricao,x.familia,x.codigo2].join(' '))).slice(0,6);
  if(mats.length)g.push(['Matéria-prima (Nomus)',mats.map(x=>`<div class="gs-r static"><b>${esc(x.descricao)}</b><small>Cód. ${esc(x.codigo)} · ${esc(x.unidade)||'—'} · ${esc(x.familia)||'—'}</small></div>`)]);
  return g;
}
function gsRender(q){
  const out=document.getElementById('gs-out');if(!out)return;
  if(!q.trim()){out.innerHTML='<p class="hint">Digite para buscar processos, componentes, materiais, RTS, modelos e a lista do Nomus. Use <b>%</b> para pular palavras.</p>';return}
  const g=gsResults(q);
  out.innerHTML=g.length?g.map(([t,l])=>`<h3 class="gs-h">${t}</h3><div class="gs-l">${l.join('')}</div>`).join(''):'<p class="hint">Nada encontrado.</p>';
}
Object.assign(MX.act,{
  gSearch(){dialog(`<div class="dlg-body gs"><h2>Buscar em tudo</h2><div class="search mat-search">${ic('search')}<input type="search" id="gs-q" placeholder="Equipamento, cliente, pedido, componente, material…" aria-label="Buscar em tudo" data-keep-case data-inp="gsQ" autocomplete="off" autofocus></div><div id="gs-out"></div><div class="actions end"><button class="btn" data-act="closeDlg">Fechar</button></div></div>`,{cls:'svc-dialog'});gsRender('')},
  async gsOpen(el){const id=el.dataset.id,go2=el.dataset.go;closeDialog(el.closest('dialog'));await openProcess(id);if(go2)go(go2)},
  gsRts(el){const id=el.dataset.id;closeDialog(el.closest('dialog'));if(window.openR)openR(id);else if(MX.act.rtsOpen)MX.act.rtsOpen({dataset:{id}})}
});
Object.assign(MX.inp,{gsQ(el){gsRender(el.value)}});

/* ============================== Detalhe da sincronização ============================== */
window.syncDetail=function(){
  const dirty=PROCS.filter(p=>p._dirty&&!p.deletedAt),rts=rtsList().filter(r=>r._dirty);
  const on=navigator.onLine;
  dialog(`<div class="dlg-body"><h2>Envio para a nuvem</h2><p>${on?'Estas alterações ainda não chegaram à nuvem. O aplicativo envia sozinho; se quiser, envie agora.':'Sem internet. Pode continuar trabalhando: tudo fica guardado neste aparelho e é enviado quando a conexão voltar. Não limpe os dados do navegador antes disso.'}</p><ul class="hist">${dirty.map(p=>`<li><b>${nome(p)}</b><br><span>Peritagem · ${esc(p.cliente)||'sem cliente'}</span></li>`).join('')}${rts.map(r=>`<li><b>RTS ${esc(r.numero)||'sem nº'}</b><br><span>${esc(r.cliente)||'—'}</span></li>`).join('')}</ul><div class="actions end"><button class="btn" data-act="closeDlg">Fechar</button>${on?`<button class="btn primary" data-act="syncNow">${ic('refresh','ic')}Enviar agora</button>`:''}</div></div>`);
};
Object.assign(MX.act,{syncNow(el){closeDialog(el.closest('dialog'));toast('Sincronizando…',{ms:1500});Sync.run()}});
})();
