/* MINC · Peritagem — Painel de gestão, histórico de alterações, busca em tudo e detalhe da sincronização (v5.21.0)
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
/* Gráficos feitos aqui mesmo (HTML/SVG, sem biblioteca): barras finas, cor por papel (série 1 = azul, série 2 = laranja),
   legenda quando há 2 séries, dica ao passar o dedo/mouse em cada barra e "Ver tabela" em todo gráfico. */
const DAYS=[7,15,30,60];
const PERIODS=[[30,'Últimos 30 dias'],[90,'Últimos 90 dias'],[180,'Últimos 6 meses'],[365,'Últimos 12 meses'],[0,'Todo o período']];
const nome=p=>esc(p.equipamento)||'Sem equipamento';
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const median=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
const f1=v=>v==null||isNaN(v)?'—':(Math.round(v*10)/10).toLocaleString('pt-BR');
const pct=(a,b)=>b?Math.round(a/b*100)+'%':'—';
const normTxt=s=>String(s||'').trim().replace(/^\s*POS\.?\s*[A-Za-z0-9.\-]+\s*[-–—]\s*/i,'').replace(/\s+/g,' ').toUpperCase();
function cadRows(list){
  const by=new Map();
  for(const p of list){
    let rows=[];try{rows=structRows(p).filter(x=>x.sem)}catch{}
    for(const x of rows){const f=x.familia||'Sem família';const e=by.get(f)||{n:0,ps:new Set()};e.n++;e.ps.add(p.id);by.set(f,e)}
  }
  return [...by.entries()].map(([f,e])=>({f,n:e.n,p:e.ps.size})).sort((a,b)=>b.n-a.n||a.f.localeCompare(b.f,'pt-BR'));
}

/* histórico de status (nuvem): datas reais de cada mudança de status */
const Hist={rows:[],names:{},at:0,busy:false,
  async load(){
    if(!CLOUD||this.busy||Date.now()-this.at<60000||!navigator.onLine)return false;
    this.busy=true;
    try{
      const r=await SB.from('process_history').select('process_id,changed_at,changed_by,status_from,status_to').not('status_to','is',null).order('changed_at',{ascending:true}).limit(10000);
      if(r.error)throw r.error;this.rows=r.data;
      const ids=[...new Set(r.data.map(x=>x.changed_by).filter(Boolean))];
      if(ids.length){const u=await SB.from('profiles').select('id,name').in('id',ids);(u.data||[]).forEach(x=>this.names[x.id]=x.name)}
      this.at=Date.now();return true;
    }catch(e){console.error('histórico (painel)',e);return false}
    finally{this.busy=false}
  }
};

/* números do painel, todos calculados a partir dos dados do aparelho + histórico da nuvem */
function stats(per){
  const all=live(),since=per?Date.now()-per*DAY:0;
  const byProc=new Map();for(const h of Hist.rows){const l=byProc.get(h.process_id)||[];l.push(h);byProc.set(h.process_id,l)}
  const tl=all.map(p=>{
    const hs=byProc.get(p.id)||[],c0=new Date(p.createdAt||p.updatedAt).getTime();
    const ex=hs.find(h=>h.status_to==='Em execução'),co=hs.filter(h=>h.status_to==='Concluído').pop();
    let tCon=co?new Date(co.changed_at).getTime():null,est=false;
    if(!tCon&&p.status==='Concluído'){tCon=new Date(p.updatedAt).getTime();est=true}
    const tEx=ex?new Date(ex.changed_at).getTime():null;
    const quem=co&&co.changed_by?(Hist.names[co.changed_by]||''):(p.status==='Concluído'?p.updatedBy||'':'');
    const comps=(p.components||[]).length,fotos=(p.equipmentPhotos||[]).length+(p.components||[]).reduce((s,c)=>s+(c.photos||[]).length,0);
    return{p,c0,tEx,tCon,est,quem,comps,fotos,lead:tCon?(tCon-c0)/DAY:null,ras:tEx?(tEx-c0)/DAY:null,exe:tEx&&tCon&&!est?(tCon-tEx)/DAY:null};
  });
  const criados=tl.filter(x=>x.c0>=since),concl=tl.filter(x=>x.tCon&&x.tCon>=since);
  // meses (até 12): criados x concluídos
  const nM=per&&per<=365?Math.max(1,Math.ceil(per/30.4)):12,months=[];
  const now=new Date();for(let i=nM-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({k:d.getFullYear()*12+d.getMonth(),lab:d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}).replace('.',''),cri:0,con:0})}
  const mk=t=>{const d=new Date(t);return d.getFullYear()*12+d.getMonth()};
  for(const x of tl){const a=months.find(m=>m.k===mk(x.c0));if(a)a.cri++;if(x.tCon){const b=months.find(m=>m.k===mk(x.tCon));if(b)b.con++}}
  // providências, componentes, serviços e matérias-primas (processos criados no período)
  const prov={Recuperar:0,Fabricar:0,Reutilizar:0,Substituir:0,'Sem providência':0},compN=new Map(),svcN=new Map(),mpN=new Map();
  const add=(m,k)=>{if(k)m.set(k,(m.get(k)||0)+1)};
  for(const x of criados){for(const c of x.p.components||[]){
    if(!(c.acoes||[]).length)prov['Sem providência']++;else c.acoes.forEach(a=>{if(a in prov)prov[a]++});
    add(compN,normTxt(c.name));
    (c.materials||[]).forEach(m=>add(m.tipo==='serv'?svcN:mpN,normTxt(m.raw)));
    (c.servicos||[]).forEach(s=>add(svcN,normTxt(s.nome)));
  }}
  const top=(m,n=10)=>[...m.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR')).slice(0,n).map(([k,v])=>({k,v}));
  // produtividade por pessoa
  const pes=new Map(),P=n=>{n=n||'(sem nome)';if(!pes.has(n))pes.set(n,{n,cri:0,con:0,comps:0,fotos:0,leads:[]});return pes.get(n)};
  for(const x of criados){const e=P(x.p.createdBy);e.cri++;e.comps+=x.comps;e.fotos+=x.fotos}
  for(const x of concl){const e=P(x.quem||x.p.updatedBy);e.con++;if(x.lead!=null)e.leads.push(x.lead)}
  // RTS e comparativos
  const rts=rtsList().filter(r=>new Date(r.createdAt||r.updatedAt).getTime()>=since);
  const apr=rts.filter(r=>r.status==='Aprovado'),aprT=apr.filter(r=>r.enviadoEm&&r.aprovadoEm).map(r=>(new Date(r.aprovadoEm)-new Date(r.enviadoEm))/DAY).filter(v=>v>=0);
  const cmp=(window.Cmp?Cmp.list:[]).filter(x=>new Date(x.created_at).getTime()>=since);
  return{all,tl,criados,concl,months,prov,topComp:top(compN),topSvc:top(svcN),topMp:top(mpN),pes:[...pes.values()].sort((a,b)=>b.cri+b.con-(a.cri+a.con)),
    leads:concl.map(x=>x.lead).filter(v=>v!=null),ras:tl.filter(x=>x.c0>=since&&x.ras!=null).map(x=>x.ras),exe:concl.filter(x=>x.exe!=null).map(x=>x.exe),est:concl.filter(x=>x.est).length,
    rts,apr,aprT,devol:rts.reduce((s,r)=>s+(+r.devolucoes||0),0),cmp};
}

/* ---- peças dos gráficos ---- */
const kpi=(v,t,sub,tone)=>`<div class="kpi ${tone||''}"><b>${v}</b><span>${t}</span>${sub?`<small>${sub}</small>`:''}</div>`;
const tableView=(head,rows)=>`<details class="viz-tbl"><summary>Ver tabela</summary><div class="tw"><table class="tbl"><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
/* barras horizontais (uma série): rótulo à esquerda, valor à direita da barra */
function hbars(items,{unit='',fmtV=v=>fmtN(v),empty='Sem dados no período.'}={}){
  if(!items.length||!items.some(x=>x.v>0))return `<p class="hint">${empty}</p>`;
  const max=Math.max(...items.map(x=>x.v||0),1);
  return `<div class="hb">${items.map(x=>`<div class="hb-r" tabindex="0" data-tip="${esc(x.k)}: ${x.v==null?'sem dados':esc(fmtV(x.v))+unit}"><span class="hb-l" title="${esc(x.k)}">${esc(x.k)}</span><span class="hb-t"><i style="width:${Math.max(x.v>0?1.5:0,(x.v||0)/max*100)}%"></i></span><span class="hb-v">${x.v==null?'sem dados':fmtV(x.v)+unit}</span></div>`).join('')}</div>`;
}
/* colunas agrupadas por mês: criados (série 1) x concluídos (série 2), um só eixo */
function monthCols(ms){
  const max=Math.max(1,...ms.flatMap(m=>[m.cri,m.con])),H=150,step=Math.ceil(max/4)||1,top=step*4;
  const W=Math.max(320,ms.length*56),bw=Math.min(16,(W/ms.length-14)/2),gx=W/ms.length;
  const y=v=>H-(v/top)*H+8;
  const grid=[0,1,2,3,4].map(i=>{const v=i*step,yy=y(v);return `<line x1="34" x2="${W}" y1="${yy}" y2="${yy}" class="vz-grid"/><text x="28" y="${yy+4}" class="vz-ax" text-anchor="end">${v}</text>`}).join('');
  const bar=(x,v,cls,tip)=>{const h=Math.max(v?2:0,(v/top)*H),yy=H+8-h;return `<path class="${cls}" d="M${x},${H+8} V${yy+Math.min(4,h)} Q${x},${yy} ${x+Math.min(4,bw/2)},${yy} H${x+bw-Math.min(4,bw/2)} Q${x+bw},${yy} ${x+bw},${yy+Math.min(4,h)} V${H+8} Z" data-tip="${esc(tip)}" tabindex="0"/>`};
  const cols=ms.map((m,i)=>{const cx=34+i*gx+gx/2-6;return bar(cx-bw-1,m.cri,'vz-s1',`${m.lab} — criados: ${m.cri}`)+bar(cx+1,m.con,'vz-s2',`${m.lab} — concluídos: ${m.con}`)+`<text x="${cx}" y="${H+24}" class="vz-ax" text-anchor="middle">${esc(m.lab)}</text>`}).join('');
  return `<div class="vz-leg"><span><i class="vz-k s1"></i>Criados</span><span><i class="vz-k s2"></i>Concluídos</span></div><div class="vz-wrap"><svg viewBox="0 0 ${W+34} ${H+34}" width="100%" preserveAspectRatio="xMinYMin meet" role="img" aria-label="Processos criados e concluídos por mês">${grid}<line x1="34" x2="${W}" y1="${H+8}" y2="${H+8}" class="vz-base"/>${cols}</svg></div>`;
}

MX.views.panel=function(){
  if(!isManager())return `<div class="empty"><h2>Acesso restrito</h2><p>O painel é só para administradores e gestores.</p></div>`;
  Hist.load().then(ch=>{if(ch&&S.screen==='panel')renderMain()});
  const per=S.panelPer??90,days=S.panelDays||15,st=stats(per),all=st.all;
  const abertos=all.filter(p=>p.status!=='Concluído');
  const parados=abertos.filter(p=>ageDays(p)>=days).sort((a,b)=>ageDays(b)-ageDays(a));
  const semOrdem=abertos.filter(p=>emp(p.ordem));
  const cad=cadRows(all),cadTot=cad.reduce((s,x)=>s+x.n,0);
  const rtsOn=!!(window.Settings&&Settings.rtsOn()),rtsAg=rtsList().filter(r=>r.status==='Aguardando aprovação');
  const cmpN=window.cmpPendingCount?cmpPendingCount():0;
  const pend=window.Sync?Sync.pendingCount():0,conf=window.Sync?Sync.conflicts().length:0;
  const rec=[...all].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,10);
  const perTxt=(PERIODS.find(x=>x[0]===per)||PERIODS[1])[1].toLowerCase();
  const nCri=st.criados.length,compMed=avg(st.criados.map(x=>x.comps)),fotoMed=avg(st.criados.map(x=>x.fotos));
  const provItems=Object.entries(st.prov).map(([k,v])=>({k,v})),provTot=provItems.reduce((s,x)=>s+x.v,0);
  const histNote=CLOUD?(Hist.rows.length?'':'<p class="hint">Os tempos por etapa usam o histórico de status, registrado a partir da versão 5.18. Processos concluídos antes disso usam a data da última alteração (estimado).</p>'):'<p class="hint">Modo local: sem histórico de status; os tempos usam a data da última alteração (estimado).</p>';
  return `<div class="ph"><div class="ph-row"><div><h1>Painel de gestão</h1><p>Indicadores da engenharia de serviço — ${perTxt}. Só administradores e gestores veem esta tela.</p></div><div class="actions"><div class="field" style="margin:0;min-width:190px"><label for="pn-per" class="sr-only">Período</label><select id="pn-per" data-chg="panelPer">${PERIODS.map(([v,t])=>`<option value="${v}" ${v===per?'selected':''}>${t}</option>`).join('')}</select></div><button class="btn" data-act="panelXlsx">${ic('download')}Exportar Excel</button></div></div></div>
<h2 class="pn-h">Visão geral</h2>
<div class="kpis">${kpi(fmtN(abertos.length),'processos em andamento',STATUS.filter(s=>s!=='Concluído').map(s=>all.filter(p=>p.status===s).length+' '+s.toLowerCase()).join(' · '))}${kpi(fmtN(nCri),'processos abertos',perTxt)}${kpi(fmtN(st.concl.length),'processos concluídos',perTxt+(st.est?` · ${st.est} com data estimada`:''))}${kpi(f1(avg(st.leads)),'dias, em média, da abertura à conclusão',`mediana ${f1(median(st.leads))} dias · ${st.leads.length} processos`)}${kpi(f1(compMed),'componentes por processo',`fotos por processo: ${f1(fotoMed)}`)}${kpi(fmtN(parados.length),`parados há ${days}+ dias`,'em andamento, sem alteração',parados.length?'warn':'')}${kpi(fmtN(semOrdem.length),'sem ordem de serviço','em andamento',semOrdem.length?'warn':'')}${kpi(fmtN(cadTot),'itens sem cadastro no Nomus',`${cad.length} ${cad.length===1?'família':'famílias'}`,cadTot?'warn':'')}${rtsOn?kpi(fmtN(rtsAg.length),'RTS aguardando aprovação','',rtsAg.length?'warn':'')+kpi(fmtN(cmpN),'diferenças RTS × D.E','para avaliar',cmpN?'warn':''):''}${kpi(fmtN(pend+conf),'envios pendentes ou conflitos','dados que ainda não chegaram à nuvem',pend+conf?'warn':'')}</div>
<div class="pn-grid">
<div class="panel"><h2>Processos por mês</h2><p class="hint">Abertos (pela data de criação) e concluídos (pela data em que o status virou “Concluído”).</p>${monthCols(st.months)}${tableView(['Mês','Criados','Concluídos'],st.months.map(m=>[m.lab,m.cri,m.con]))}</div>
<div class="panel"><h2>Tempo médio por etapa</h2><p class="hint">Dias corridos, em média, em cada etapa (processos do período).</p>${hbars([{k:'Rascunho → em execução',v:avg(st.ras)},{k:'Em execução → concluído',v:avg(st.exe)},{k:'Abertura → conclusão (total)',v:avg(st.leads)}],{unit:' dias',fmtV:f1,empty:'Ainda não há processos com mudança de status registrada no período.'})}${histNote}${tableView(['Etapa','Média (dias)','Mediana (dias)','Processos'],[['Rascunho → em execução',f1(avg(st.ras)),f1(median(st.ras)),st.ras.length],['Em execução → concluído',f1(avg(st.exe)),f1(median(st.exe)),st.exe.length],['Abertura → conclusão',f1(avg(st.leads)),f1(median(st.leads)),st.leads.length]])}</div>
<div class="panel"><h2>Providências dos componentes</h2><p class="hint">${fmtN(provTot)} providências marcadas nos processos abertos no período.</p>${hbars(provItems,{fmtV:v=>`${fmtN(v)} (${pct(v,provTot)})`})}${tableView(['Providência','Quantidade','%'],provItems.map(x=>[x.k,x.v,pct(x.v,provTot)]))}</div>
<div class="panel"><h2>Componentes mais peritados</h2><p class="hint">Os 10 nomes de componente mais frequentes no período.</p>${hbars(st.topComp)}${tableView(['Componente','Vezes'],st.topComp.map(x=>[x.k,x.v]))}</div>
<div class="panel"><h2>Serviços externos mais pedidos</h2>${hbars(st.topSvc,{empty:'Nenhum serviço externo no período.'})}${tableView(['Serviço','Vezes'],st.topSvc.map(x=>[x.k,x.v]))}</div>
<div class="panel"><h2>Matérias-primas mais usadas</h2>${hbars(st.topMp,{empty:'Nenhuma matéria-prima no período.'})}${tableView(['Matéria-prima','Vezes'],st.topMp.map(x=>[x.k,x.v]))}</div>
</div>
<div class="panel"><h2>Produtividade por pessoa</h2><p class="hint">Processos abertos e concluídos no período por quem abriu / concluiu, componentes e fotos dos processos que abriu e tempo médio até a conclusão.</p>${st.pes.length?`<div class="tw"><table class="tbl"><thead><tr><th>Pessoa</th><th>Abertos</th><th>Concluídos</th><th>Componentes</th><th>Fotos</th><th>Componentes por processo</th><th>Dias até concluir (média)</th></tr></thead><tbody>${st.pes.map(e=>`<tr><td><b>${esc(e.n)}</b></td><td>${fmtN(e.cri)}</td><td>${fmtN(e.con)}</td><td>${fmtN(e.comps)}</td><td>${fmtN(e.fotos)}</td><td>${f1(e.cri?e.comps/e.cri:null)}</td><td>${f1(avg(e.leads))}</td></tr>`).join('')}</tbody></table></div>${hbars(st.pes.slice(0,10).map(e=>({k:e.n,v:e.cri+e.con})),{fmtV:v=>plural(v,'processo','processos')})}`:'<p class="hint">Sem processos no período.</p>'}</div>
${rtsOn?`<div class="panel"><h2>RTS e comparativos</h2><div class="kpis">${kpi(fmtN(st.rts.length),'RTS criados',perTxt)}${kpi(fmtN(st.apr.length),'RTS aprovados',pct(st.apr.length,st.rts.length)+' dos criados')}${kpi(f1(avg(st.aprT)),'dias do envio à aprovação',`mediana ${f1(median(st.aprT))} dias`)}${kpi(fmtN(st.devol),'devoluções para ajuste','RTS devolvidos pelo aprovador')}${kpi(fmtN(st.cmp.length),'comparativos RTS × D.E',`média de ${f1(avg(st.cmp.map(x=>x.total)))} diferenças`)}${kpi(fmtN(st.cmp.filter(x=>x.status!=='Pendente').length),'comparativos avaliados',pct(st.cmp.filter(x=>x.status!=='Pendente').length,st.cmp.length))}</div>${hbars(['Rascunho','Aguardando aprovação','Aprovado'].map(s=>({k:s,v:st.rts.filter(r=>r.status===s).length})),{fmtV:v=>fmtN(v)+' RTS',empty:'Nenhum RTS no período.'})}</div>`:''}
<div class="panel"><div class="ph-row"><div><h2>Processos parados</h2><p class="hint" style="margin:0">Em andamento e sem nenhuma alteração há pelo menos o prazo escolhido.</p></div><div class="field" style="margin:0;min-width:160px"><label for="pn-days" class="sr-only">Prazo</label><select id="pn-days" data-chg="panelDays">${DAYS.map(d=>`<option value="${d}" ${d===days?'selected':''}>${d} dias ou mais</option>`).join('')}</select></div></div>${procTable(parados,p=>`${ageDays(p)} dias · ${esc(p.updatedBy||p.createdBy||'')}`,'Nenhum processo parado neste prazo.')}</div>
<div class="panel"><div class="ph-row"><div><h2>Itens sem cadastro no Nomus</h2><p class="hint" style="margin:0">Matérias-primas marcadas como “sem cadastro”, por família (todos os processos). A lista completa de cada processo está em Estrutura &gt; Lista de cadastro.${window.Cad&&Cad.n?` <b>${Cad.n}</b> já ${Cad.n===1?'existe':'existem'} na lista do Nomus.`:''}</p></div>${window.cadBtn?cadBtn():''}</div>${cad.length?hbars(cad.map(x=>({k:x.f,v:x.n})),{fmtV:v=>plural(v,'item','itens')})+tableView(['Família','Itens','Processos'],cad.map(x=>[x.f,x.n,x.p])):'<p class="hint">Nenhum item sem cadastro.</p>'}</div>
<div class="panel"><h2>Sem ordem de serviço</h2>${procTable(semOrdem.slice(0,25),p=>`criado em ${fmtDay(p.createdAt)}`,'Todos os processos em andamento têm ordem.')}</div>
${rtsOn&&window.cmpPanelSection?cmpPanelSection():''}
${rtsOn?`<div class="panel"><h2>RTS aguardando aprovação</h2>${rtsAg.length?`<ul class="docs">${rtsAg.map(r=>`<li class="doc"><div class="doc-h"><b>${esc(r.numero)||'Sem nº'}</b><small>${esc(r.cliente)||'—'} · ${esc(r.produto)||'—'}</small></div><div class="doc-a"><button class="btn" data-act="rtsOpen" data-id="${esc(r.id)}">Abrir</button></div></li>`).join('')}</ul>`:'<p class="hint">Nenhum RTS aguardando.</p>'}</div>`:''}
<div class="panel"><h2>Atividade recente</h2><div class="tw"><table class="tbl"><thead><tr><th>Equipamento / cliente</th><th>Quem alterou</th><th>Quando</th><th></th></tr></thead><tbody>${rec.map(p=>`<tr><td class="wrap"><b>${nome(p)}</b><br><small>${esc(p.cliente)||'Sem cliente'}</small></td><td>${esc(p.updatedBy||p.createdBy)||'—'}</td><td>${fmt(p.updatedAt)}</td><td><button class="btn" data-act="openProcess" data-id="${esc(p.id)}">Abrir</button></td></tr>`).join('')}</tbody></table></div></div>`;
};
const procRow=(p,extra)=>`<tr><td class="wrap"><b>${nome(p)}</b><br><small>${esc(p.cliente)||'Sem cliente'}</small></td><td>${esc(p.process)||'—'}</td><td>${esc(p.pedido)||'—'} / ${esc(p.ordem)||'—'}</td><td>${esc(p.status)}</td><td>${extra}</td><td><button class="btn" data-act="openProcess" data-id="${esc(p.id)}">Abrir</button></td></tr>`;
const procTable=(l,extraFn,vazio)=>l.length?`<div class="tw"><table class="tbl"><thead><tr><th>Equipamento / cliente</th><th>Processo</th><th>Pedido / ordem</th><th>Status</th><th>Detalhe</th><th></th></tr></thead><tbody>${l.map(p=>procRow(p,extraFn(p))).join('')}</tbody></table></div>`:`<p class="hint">${vazio}</p>`;

/* Excel com todos os números do painel */
function panelXlsx(){
  if(!window.XLSX){toast('A biblioteca de Excel ainda não carregou. Tente de novo.');return}
  const per=S.panelPer??90,st=stats(per),d=v=>v?new Date(v).toLocaleDateString('pt-BR'):'',r1=v=>v==null?'':Math.round(v*10)/10;
  const wb=XLSX.utils.book_new(),sh=(t,h,rows,w)=>{const ws=XLSX.utils.aoa_to_sheet([h,...rows]);ws['!cols']=w.map(wch=>({wch}));XLSX.utils.book_append_sheet(wb,ws,t)};
  sh('Resumo',['Indicador','Valor'],[['Período',(PERIODS.find(x=>x[0]===per)||[])[1]||''],['Processos abertos',st.criados.length],['Processos concluídos',st.concl.length],['Dias abertura → conclusão (média)',r1(avg(st.leads))],['Dias abertura → conclusão (mediana)',r1(median(st.leads))],['Dias rascunho → execução (média)',r1(avg(st.ras))],['Dias execução → conclusão (média)',r1(avg(st.exe))],['Componentes por processo (média)',r1(avg(st.criados.map(x=>x.comps)))],['Fotos por processo (média)',r1(avg(st.criados.map(x=>x.fotos)))],['RTS criados',st.rts.length],['RTS aprovados',st.apr.length],['Dias envio → aprovação do RTS (média)',r1(avg(st.aprT))],['Devoluções de RTS',st.devol],['Comparativos RTS × D.E',st.cmp.length]],[42,22]);
  sh('Processos',['Processo','Pedido','Ordem','Equipamento','Cliente','Status','Aberto em','Aberto por','Em execução em','Concluído em','Data estimada','Dias até concluir','Componentes','Fotos'],st.tl.filter(x=>x.c0>=(per?Date.now()-per*DAY:0)||(x.tCon&&x.tCon>=(per?Date.now()-per*DAY:0))).map(x=>[x.p.process||'',x.p.pedido||'',x.p.ordem||'',x.p.equipamento||'',x.p.cliente||'',x.p.status,d(x.c0),x.p.createdBy||'',d(x.tEx),d(x.tCon),x.est?'sim':'',r1(x.lead),x.comps,x.fotos]),[12,14,12,34,28,13,12,20,14,13,10,12,12,8]);
  sh('Por mês',['Mês','Criados','Concluídos'],st.months.map(m=>[m.lab,m.cri,m.con]),[12,10,12]);
  sh('Produtividade',['Pessoa','Abertos','Concluídos','Componentes','Fotos','Dias até concluir (média)'],st.pes.map(e=>[e.n,e.cri,e.con,e.comps,e.fotos,r1(avg(e.leads))]),[28,10,12,13,8,22]);
  sh('Providências',['Providência','Quantidade'],Object.entries(st.prov),[18,12]);
  sh('Componentes',['Componente','Vezes'],st.topComp.map(x=>[x.k,x.v]),[40,8]);
  sh('Serviços',['Serviço','Vezes'],st.topSvc.map(x=>[x.k,x.v]),[46,8]);
  sh('Matérias-primas',['Matéria-prima','Vezes'],st.topMp.map(x=>[x.k,x.v]),[60,8]);
  XLSX.writeFile(wb,`MINC_ServiceHub_Painel_${new Date().toISOString().slice(0,10)}.xlsx`);toast('Planilha do painel gerada.');
}

/* dica (tooltip) dos gráficos: um só balão, segue o mouse ou o foco do teclado */
function tipShow(el,x,y){let t=document.getElementById('viz-tip');if(!t){t=document.createElement('div');t.id='viz-tip';t.setAttribute('role','tooltip');document.body.appendChild(t)}t.textContent=el.dataset.tip;t.hidden=false;const w=t.offsetWidth,h=t.offsetHeight;t.style.left=Math.min(window.innerWidth-w-8,Math.max(8,x+12))+'px';t.style.top=Math.max(8,y-h-10)+'px'}
const tipHide=()=>{const t=document.getElementById('viz-tip');if(t)t.hidden=true};
document.addEventListener('mousemove',e=>{const el=e.target.closest?.('[data-tip]');if(el)tipShow(el,e.clientX,e.clientY);else tipHide()});
document.addEventListener('focusin',e=>{const el=e.target.closest?.('[data-tip]');if(el){const r=el.getBoundingClientRect();tipShow(el,r.left+r.width/2,r.top)}});
document.addEventListener('focusout',tipHide);
document.addEventListener('scroll',tipHide,true);

Object.assign(MX.act,{
  panelHome(){
    if(!isManager()){toast('O painel é só para administradores e gestores.');return}
    if(S.screen==='panel'){scrollTo({top:0,behavior:RM()?'auto':'smooth'});return}
    if(window.RtsSave)RtsSave.flush();S.id=null;S.errs=null;S.screen='panel';S.anim='up';render();scrollTo(0,0);
    if(window.Sync)Sync.kick(500);
  },
  panelXlsx
});
Object.assign(MX.chg,{panelDays(el){S.panelDays=+el.value||15;renderMain()},panelPer(el){S.panelPer=+el.value;renderMain()}});

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
  const did='sd-'+Date.now();if(window.storageInfo)storageInfo().then(t=>{const e=document.getElementById(did);if(e)e.innerHTML=t});
  dialog(`<div class="dlg-body"><h2>Envio para a nuvem</h2><p class="hint" id="${did}"></p><p>${on?'Estas alterações ainda não chegaram à nuvem. O aplicativo envia sozinho; se quiser, envie agora.':'Sem internet. Pode continuar trabalhando: tudo fica guardado neste aparelho e é enviado quando a conexão voltar. Não limpe os dados do navegador antes disso.'}</p><ul class="hist">${dirty.map(p=>`<li><b>${nome(p)}</b><br><span>Peritagem · ${esc(p.cliente)||'sem cliente'}</span></li>`).join('')}${rts.map(r=>`<li><b>RTS ${esc(r.numero)||'sem nº'}</b><br><span>${esc(r.cliente)||'—'}</span></li>`).join('')}</ul><div class="actions end"><button class="btn" data-act="closeDlg">Fechar</button>${on?`<button class="btn primary" data-act="syncNow">${ic('refresh','ic')}Enviar agora</button>`:''}</div></div>`);
};
Object.assign(MX.act,{syncNow(el){closeDialog(el.closest('dialog'));toast('Sincronizando…',{ms:1500});Sync.run()}});
})();
