/* MINC ServiceHub — Processo do CRM do Nomus (v5.26.0). SOMENTE LEITURA no Nomus.
   O nº do processo que a equipe usa ("# 1173") é o id do processo no CRM do Nomus. Com ele o app mostra, dentro da peritagem:
   etapa, responsável, prioridade, prazo e (quando o Nomus informar) os arquivos já anexados ao processo.
   - Situação guardada só neste aparelho (não gera sincronização) e atualizada sozinha, de tempos em tempos, para os processos em andamento.
   - Avisos no sino: prazo vencido ou perto de vencer.
   - Painel: tabela de prazos e etapas dos processos em andamento.
   - "Levar ao Nomus": gera o PDF da D.E ou do RTS com o nome padrão, baixa o arquivo e abre o processo no Nomus para anexar.
     (O Nomus não oferece, na API que temos, envio de arquivo para o processo; por isso o último passo é seu.)
   - Excel da Lista de cadastro (solicitação de cadastro).
   Carregado depois do nomus.js e antes do app.js: tudo que usa funções do app roda só quando chamado. */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};
MX.sync=MX.sync||[];MX.boot=MX.boot||[];
const KEY='minc_np_v1',URLKEY='nomus_url',DAY=864e5,BASE_URL='https://minc.nomus.com.br/minc/Ticket.do?metodo=acessar';
const mgr=()=>typeof isManager==='function'&&isManager();
const norm=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

const NP={
  c:null,tpl:null,busy:new Set(),tried:new Map(),lev:null,autoAt:0,
  load(){if(this.c)return;try{this.c=JSON.parse(localStorage.getItem(KEY))||{}}catch{this.c={}}},
  save(){try{const k=Object.keys(this.c);if(k.length>300)k.sort((a,b)=>(this.c[a].at||0)-(this.c[b].at||0)).slice(0,k.length-300).forEach(x=>delete this.c[x]);localStorage.setItem(KEY,JSON.stringify(this.c))}catch{}},
  on(){return !!(CLOUD&&window.Settings&&Settings.on('nomus'))},
  /* "#1173", "# 1173", "1173", "proc 1173" -> 1173 */
  idOf(p){const m=String(p&&p.process||'').match(/^\s*(?:proc(?:esso)?\.?)?\s*#?\s*(\d{2,7})\s*$/i);return m?+m[1]:null},
  get(id){this.load();return this.c[id]||null},
  dias(iso){if(!iso)return null;const d=new Date(iso+'T00:00:00'),h=new Date();h.setHours(0,0,0,0);return isNaN(d)?null:Math.round((d-h)/DAY)},
  /* situação do prazo: cor, texto e ordem */
  prazo(d){
    const n=this.dias(d&&d.prazo);if(n==null)return{n:null,cls:'st-gray',t:'sem prazo informado',ord:9e5};
    if(n<0)return{n,cls:'st-red',t:`vencido há ${-n} ${-n===1?'dia':'dias'}`,ord:n};
    if(n===0)return{n,cls:'st-red',t:'vence hoje',ord:0};
    if(n<=3)return{n,cls:'st-amber',t:`vence em ${n} ${n===1?'dia':'dias'}`,ord:n};
    return{n,cls:'st-green',t:`faltam ${n} dias`,ord:n};
  },
  async fetchOne(id){
    if(this.busy.has(id))return null;this.busy.add(id);
    try{const r=await Nomus.call({acao:'processo',id});this.load();this.c[id]={at:Date.now(),d:r};this.save();return r}
    catch(e){this.load();this.c[id]={...(this.c[id]||{}),at:Date.now(),err:String(e.message||e).slice(0,200)};this.save();return null}
    finally{this.busy.delete(id)}
  },
  /* busca em segundo plano quando a situação está velha (30 min) e atualiza a caixa na tela */
  ensure(id,cb){
    if(!this.on()||!navigator.onLine)return;
    const c=this.get(id),t=Date.now();
    if(c&&t-(c.at||0)<(c.err?5*60e3:30*60e3))return;
    if(this.busy.has(id)||t-(this.tried.get(id)||0)<20e3)return;
    this.tried.set(id,t);
    this.fetchOne(id).then(()=>cb&&cb());
  },
  /* todos os processos em andamento com nº do Nomus */
  abertos(){return(typeof PROCS!=='undefined'?PROCS:[]).filter(p=>!p.deletedAt&&p.status!=='Concluído'&&this.idOf(p))},
  async auto(force){
    if(!this.on()||!navigator.onLine||!S.user||!window.Settings||(!force&&!Settings.on('nomusProcAuto')))return false;
    if(this.autoRun||(!force&&Date.now()-this.autoAt<10*60e3))return false;
    this.autoRun=true;this.autoAt=Date.now();
    try{
      this.load();
      let ids=[...new Set(this.abertos().map(p=>this.idOf(p)))].filter(id=>force||!(this.c[id]&&Date.now()-(this.c[id].at||0)<3*3600e3)).slice(0,40);
      for(let volta=0;volta<4&&ids.length;volta++){
        const r=await Nomus.call({acao:'processos',ids});
        for(const [id,d] of Object.entries(r.itens||{})){
          if(d.erro||d.naoAchou)this.c[id]={...(this.c[id]||{}),at:Date.now(),err:d.erro||'Processo não encontrado no Nomus.'};
          else this.c[id]={at:Date.now(),d:{...((this.c[id]||{}).d||{}),...d}};
        }
        this.save();ids=r.faltam||[];
      }
      return true;
    }catch(e){console.error('processos do Nomus',e);return false}
    finally{this.autoRun=false;try{const b=document.querySelector('.bell');if(b&&window.bellBtn)b.outerHTML=window.bellBtn()}catch{}}
  },
  /* endereço do processo no Nomus (modelo guardado em Configurações; {id} vira o nº do processo) */
  async cfg(){
    try{const r=await SB.from('app_settings').select('value').eq('key',URLKEY);this.tpl=(r.data&&r.data[0]&&r.data[0].value&&r.data[0].value.tpl)||'';try{localStorage.setItem(URLKEY,this.tpl)}catch{}}
    catch{try{this.tpl=localStorage.getItem(URLKEY)||''}catch{this.tpl=''}}
  },
  url(id){const t=(this.tpl??(()=>{try{return localStorage.getItem(URLKEY)}catch{return ''}})())||'';return t&&/\{id\}/.test(t)&&id?t.replace(/\{id\}/g,id):BASE_URL},
  temUrl(){const t=this.tpl??(()=>{try{return localStorage.getItem(URLKEY)}catch{return ''}})();return !!(t&&/\{id\}/.test(t))}
};
window.NP=NP;

/* ---------- caixa "Processo no Nomus" dentro da peritagem ---------- */
const kvd=(t,v)=>`<div><dt>${t}</dt><dd>${v}</dd></div>`;
function anexosHTML(d){
  if(!d)return '';
  if(!Array.isArray(d.anexos))return `<p class="hint" style="margin:10px 0 0">O Nomus não informou a lista de anexos por esta conexão. Veja a aba “Arquivos anexos” do processo no Nomus.</p>`;
  const de=d.anexos.filter(a=>/^\s*(DE|DRS|D\.E)\b/i.test(a.nome)),rts=d.anexos.filter(a=>/\bRTS\b/i.test(a.nome));
  const marca=(rot,l)=>l.length?`<span class="badge st-green">${rot} já anexado${l.length>1?` (${l.length})`:''}</span>`:`<span class="badge st-gray">${rot} não anexado</span>`;
  return `<div style="margin-top:12px"><b>Arquivos anexados no Nomus (${d.anexos.length})</b> ${marca('D.E',de)} ${marca('RTS',rts)}${d.anexos.length?`<ul class="anx-list" style="margin-top:8px">${d.anexos.slice(0,12).map(a=>`<li class="anx"><span class="anx-t">${esc(a.data||'')}</span><span class="anx-n" style="cursor:default"><b>${esc(a.nome)}</b><small>${esc([a.tamanho,a.por].filter(Boolean).join(' · '))}</small></span></li>`).join('')}</ul>${d.anexos.length>12?`<p class="hint">Mostrando 12 de ${d.anexos.length}.</p>`:''}`:''}</div>`;
}
function box(r){
  if(!NP.on()||!r)return '';
  const id=NP.idOf(r);
  if(!id)return `<div class="panel" id="np-box"><h2>Processo no Nomus</h2><p class="hint" style="margin:0">Preencha o número do processo do Nomus (ex.: <b>#1173</b>) no campo “Processo” para ver aqui a etapa, o prazo e os anexos dele. Se não souber, use “Buscar no Nomus”.</p></div>`;
  NP.ensure(id,()=>{const el=document.getElementById('np-box'),cr=typeof cur==='function'?cur():null;if(el&&cr&&NP.idOf(cr)===id)el.outerHTML=box(cr)});
  const c=NP.get(id),d=c&&c.d,busy=NP.busy.has(id);
  const pz=d?NP.prazo(d):null;
  const corpo=d?`<dl class="kv">${kvd('Nº do processo',`#${esc(d.id)}`)}${kvd('Etapa',esc(d.etapa)||'—')}${kvd('Responsável',esc(d.responsavel)||'—')}${kvd('Prioridade',esc(d.prioridade)||'—')}${kvd('Prazo',d.prazo?`${fmtDay(d.prazo+'T12:00:00')} <span class="badge ${pz.cls}">${pz.t}</span>`:'—')}${kvd('Atualizado em',fmt(c.at))}</dl>${d.nome?`<p class="hint" style="margin:8px 0 0">${esc(d.nome)}</p>`:''}${anexosHTML(d)}`
    :busy||!c?'<div class="sk" style="height:64px"></div>':`<p class="errbox">${esc(c.err||'Não foi possível consultar o processo agora.')}</p>`;
  const aviso=d&&c.err?`<p class="hint" style="margin:8px 0 0">Não foi possível atualizar agora (${esc(c.err)}). Mostrando a última situação conhecida.</p>`:'';
  return `<div class="panel" id="np-box"><div class="ph-row"><h2>Processo no Nomus</h2><div class="actions"><button class="btn" data-act="npRefresh" ${busy?'disabled':''}>${ic('refresh')}Atualizar</button><button class="btn" data-act="npAbrir" data-id="${id}">${ic('doc')}Abrir no Nomus</button></div></div>${corpo}${aviso}</div>`;
}
window.npPanel=box;
/* linha curta na ficha do processo (só lê o que já está guardado) */
window.npLine=p=>{
  if(!NP.on())return '';const id=NP.idOf(p),c=id&&NP.get(id),d=c&&c.d;if(!d)return '';
  const pz=NP.prazo(d);
  return `<div><dt>Nomus</dt><dd>${esc(d.etapa)||'—'}${d.prazo?` · <span class="badge ${pz.cls}">${pz.t}</span>`:''}</dd></div>`;
};

/* ---------- avisos de prazo (usados pelo sino) ---------- */
NP.avisos=function(){
  if(!this.on())return [];
  const me=S.user?.name||'',isM=mgr(),out=[];
  for(const p of this.abertos()){
    if(!isM&&p.createdBy!==me&&p.updatedBy!==me)continue;
    const id=this.idOf(p),c=this.get(id),d=c&&c.d;if(!d||!d.prazo)continue;
    const pz=this.prazo(d);if(pz.n==null||pz.n>3)continue;
    out.push({id:`prazo:${p.id}:${d.prazo}:${pz.n<0?'atraso':'breve'}`,kind:'proc',rid:p.id,t:`Processo #${id} — prazo ${pz.t}`,s:`${p.equipamento||'Sem equipamento'}${p.cliente?' · '+p.cliente:''} · etapa no Nomus: ${d.etapa||'—'}`,at:new Date(d.prazo+'T08:00:00').toISOString()});
  }
  return out;
};

/* ---------- seção do Painel de gestão ---------- */
window.npPainel=function(abertos){
  if(!NP.on())return '';
  const l=abertos.map(p=>{const id=NP.idOf(p),c=id&&NP.get(id);return{p,id,d:c&&c.d,err:c&&c.err}}).filter(x=>x.id);
  const sem=abertos.length-l.length;
  const com=l.filter(x=>x.d),pzs=com.map(x=>({...x,pz:NP.prazo(x.d)})).sort((a,b)=>a.pz.ord-b.pz.ord);
  const atras=pzs.filter(x=>x.pz.n!=null&&x.pz.n<0).length,sem7=pzs.filter(x=>x.pz.n!=null&&x.pz.n>=0&&x.pz.n<=7).length,ok=pzs.filter(x=>x.pz.n!=null&&x.pz.n>7).length;
  const et={};com.forEach(x=>{const e=x.d.etapa||'Sem etapa';et[e]=(et[e]||0)+1});
  const etHtml=Object.entries(et).sort((a,b)=>b[1]-a[1]).map(([e,n])=>`<span class="badge st-gray">${esc(e)}: ${n}</span>`).join(' ');
  const rows=pzs.slice(0,30).map(x=>`<tr><td class="wrap"><b>${esc(x.p.equipamento)||'Sem equipamento'}</b><br><small>${esc(x.p.cliente)||'Sem cliente'}</small></td><td>#${esc(x.id)}</td><td>${esc(x.d.etapa)||'—'}<br><small>${esc(x.d.responsavel)||''}</small></td><td>${x.d.prazo?fmtDay(x.d.prazo+'T12:00:00'):'—'}<br><span class="badge ${x.pz.cls}">${x.pz.t}</span></td><td><button class="btn" data-act="openProcess" data-id="${esc(x.p.id)}">Abrir</button></td></tr>`).join('');
  return `<div class="panel"><div class="ph-row"><div><h2>Prazos e etapas no Nomus</h2><p class="hint" style="margin:0">Processos em andamento que têm o número do Nomus (${l.length} de ${abertos.length}${sem?`; ${sem} sem número`:''}). Só leitura; a situação é atualizada sozinha a cada poucas horas.</p></div><button class="btn" data-act="npAtualizarTodos">${ic('refresh')}Atualizar agora</button></div>${com.length?`<div class="kpis" style="margin:12px 0"><div class="kpi ${atras?'warn':''}"><b>${atras}</b><span>com prazo vencido</span></div><div class="kpi ${sem7?'warn':''}"><b>${sem7}</b><span>vencem em até 7 dias</span></div><div class="kpi"><b>${ok}</b><span>com prazo folgado</span></div></div><p style="margin:0 0 10px">${etHtml}</p><div class="tw"><table class="tbl"><thead><tr><th>Equipamento / cliente</th><th>Processo</th><th>Etapa / responsável</th><th>Prazo</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>${pzs.length>30?`<p class="hint">Mostrando os 30 de prazo mais próximo.</p>`:''}`:`<p class="hint" style="margin:12px 0 0">${l.length?'Ainda não há situação guardada. Toque em “Atualizar agora”.':'Nenhum processo em andamento tem o número do Nomus no campo “Processo” (ex.: #1173).'}</p>`}</div>`;
};

/* ---------- "Levar ao Nomus": nome padrão + download + abre o processo ---------- */
const limpa=(s,n=120)=>String(s||'').replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const nomeDE=r=>{const id=NP.idOf(r);return limpa(`DE - # ${id||'?'} ${r.pedido||''} ${r.equipamento||''} ${r.cliente||''}`)+'.pdf'};
const nomeRTS=(r,id)=>limpa(`RTS-${r.numero||''}- # ${id||'?'}- ${r.produto||''} - ${r.cliente||''}`)+'.pdf';
window.npLevarBtn=kind=>NP.on()?`<button class="btn" data-act="npLevar" data-kind="${kind}">${ic('download')}Levar ao Nomus</button>`:'';
function levDialog(titulo,aviso){
  dialog(`<div class="dlg-body" id="np-lev"><h2>${titulo}</h2><p>O arquivo é gerado com o nome padrão, baixado, e o Nomus abre em outra aba. No processo, vá em <b>Arquivos anexos</b> › <b>Anexar arquivo</b> e escolha o arquivo baixado. Nada é alterado no Nomus por aqui.</p>${aviso||''}<div id="np-lev-b"><p class="hint">Preparando o PDF…</p></div></div>`);
}
function levPronto(){
  const L=NP.lev,b=document.getElementById('np-lev-b');if(!b||!L)return;
  b.innerHTML=`<div class="field"><label for="np-nm">Nome do arquivo</label><input id="np-nm" data-keep-case value="${esc(L.name)}" autocomplete="off"></div>${L.pedeId?`<div class="field"><label for="np-id">Nº do processo no Nomus</label><input id="np-id" data-keep-case inputmode="numeric" value="${esc(L.id||'')}" placeholder="1173" autocomplete="off"></div>`:''}${NP.temUrl()?'':`<p class="hint">Dica: ${mgr()?'em Configurações, informe o endereço de um processo do Nomus para o botão abrir direto no processo. Por enquanto ele abre o CRM e você procura o processo pelo número.':'peça a um gestor para informar, em Configurações, o endereço de um processo do Nomus; assim o botão abre direto no processo.'}</p>`}<div class="actions end"><button class="btn" type="button" data-act="closeDlg">Fechar</button><button class="btn primary" type="button" data-act="npLevarGo">${ic('download')}Baixar e abrir o Nomus</button></div>`;
}
Object.assign(MX.act,{
  async npLevar(el){
    const kind=el.dataset.kind;
    if(kind==='de'){
      const r=cur();if(!r)return;
      levDialog('Levar a D.E ao Nomus',NP.idOf(r)?'':'<p class="errbox">Este processo ainda não tem o nº do Nomus (ex.: #1173) no campo “Processo”. Você pode digitar o número abaixo para abrir o processo certo.</p>');
      try{
        const rec=await Docs.generate(r,'Levado ao Nomus por '+(S.user?.name||''));
        NP.lev={bytes:rec.bytes,name:nomeDE(r),id:NP.idOf(r),pedeId:true};levPronto();
        if(CLOUD)Sync.run();
      }catch(e){console.error(e);const b=document.getElementById('np-lev-b');if(b)b.innerHTML='<p class="errbox">Não foi possível gerar o PDF.</p>'}
    }else{
      const r=window.RtsApi&&RtsApi.cur();if(!r)return;
      const aprov=r.status==='Aprovado';
      levDialog('Levar o RTS ao Nomus',aprov?'':'<p class="errbox">Este RTS ainda não foi aprovado: o PDF sai com a marca de “não aprovado”. O ideal é aprovar antes de anexar no Nomus.</p>');
      try{const out=await buildRtsPdf(r),id=(NP.lastId||'');NP.lev={bytes:out.bytes,name:nomeRTS(r,id),id,pedeId:true,rts:r};levPronto()}
      catch(e){console.error(e);const b=document.getElementById('np-lev-b');if(b)b.innerHTML='<p class="errbox">Não foi possível gerar o PDF.</p>'}
    }
  },
  npLevarGo(el){
    const L=NP.lev;if(!L)return;
    const d=el.closest('dialog'),nm=limpa(d.querySelector('#np-nm').value,160)||L.name,idv=d.querySelector('#np-id')?parseInt(d.querySelector('#np-id').value.replace(/\D/g,''),10)||null:L.id;
    const name=/\.pdf$/i.test(nm)?nm:nm+'.pdf';
    if(idv)NP.lastId=idv;
    saveBytes(L.bytes,name);
    window.open(NP.url(idv),'_blank','noopener');
    toast('Arquivo baixado. No Nomus: Arquivos anexos › Anexar arquivo.',{ms:9000});
    closeDialog(d);
  },
  npAbrir(el){window.open(NP.url(+el.dataset.id||null),'_blank','noopener')},
  async npRefresh(el){
    const r=cur();if(!r)return;const id=NP.idOf(r);if(!id)return;
    el.disabled=true;const b=document.getElementById('np-box');if(b)b.querySelectorAll('.btn').forEach(x=>x.disabled=true);
    await NP.fetchOne(id);const e=document.getElementById('np-box'),cr=cur();if(e&&cr)e.outerHTML=box(cr);
  },
  async npAtualizarTodos(el){
    el.disabled=true;toast('Consultando o Nomus…',{ms:3000});
    const ok=await NP.auto(true);toast(ok?'Situação dos processos atualizada.':'Não foi possível consultar o Nomus agora.',{ms:4500});
    if(S.screen==='panel')renderMain();
  },
  async npUrlSave(el){
    const f=el.closest('.panel'),tpl=f.querySelector('#np-url').value.trim();
    if(tpl&&!/\{id\}/.test(tpl)){toast('O endereço precisa ter {id} no lugar do número do processo.',{ms:6000});return}
    try{
      const r=await SB.from('app_settings').upsert({key:URLKEY,value:{tpl}},{onConflict:'key'});
      if(r.error)throw r.error;NP.tpl=tpl;try{localStorage.setItem(URLKEY,tpl)}catch{}
      toast(tpl?'Endereço do processo salvo para todos os usuários.':'Endereço removido.',{ms:5000});
    }catch(e){NP.tpl=tpl;try{localStorage.setItem(URLKEY,tpl)}catch{}toast('Salvo só neste aparelho (sem permissão para salvar para todos).',{ms:6000})}
  },
  /* Lista de cadastro do processo em Excel (solicitação de cadastro) */
  npCadXlsx(){
    const r=cur();if(!r)return;
    if(!window.XLSX){toast('A biblioteca de Excel ainda não carregou. Tente de novo.');return}
    const {com,outros}=Fich.cadRows(r);
    if(!com.length&&!outros.length){toast('Este processo não tem itens na Lista de cadastro.');return}
    const proc=r.process||'',id=NP.idOf(r),N=13;
    const cab=['Nº','Família','Descrição (padrão do cadastro)','Ficha (características)','Unid.','Qtd. necessária','Observação do perito','Item da estrutura','Código no Nomus','Cadastrado por','Data do cadastro','Situação','Observação da engenharia'];
    const itens=[...com.map(x=>[x.familia,x]),...outros.map(x=>[x.tipo||'',x])];
    const hoje=new Date().toLocaleDateString('pt-BR');
    const blank=()=>Array(N).fill('');
    const A=[blank(),blank(),blank(),blank(),blank(),blank(),blank(),blank(),blank(),blank()];
    A[0][0]='SOLICITAÇÃO DE CADASTRO DE PRODUTO — NOMUS';
    A[1][0]='Formulário: código a definir · Rev. 00 · MINC ServiceHub — peritagem / engenharia de serviço';
    const par=(row,l1,v1,l2,v2)=>{A[row][0]=l1;A[row][2]=v1;A[row][5]=l2;A[row][7]=v2};
    par(3,'Processo (Nomus)',proc||(id?'#'+id:''),'Pedido',r.pedido||'');
    par(4,'Ordem',r.ordem||'','Equipamento',r.equipamento||'');
    par(5,'Cliente',r.cliente||'','Solicitante',S.user?.name||'');
    par(6,'Data da solicitação',hoje,'Observação geral',r.observacoes||'');
    A[8][0]='Preenchido pelo perito / engenharia de serviço';A[8][8]='Preenchido pela engenharia / cadastro (Nomus)';
    A[9]=cab;
    itens.forEach(([fam,x],i)=>A.push([i+1,fam,x.desc||'',x.ficha||'',x.un||'',x.qty??'',x.obs||'',`${x.no||''} ${x.comp||''}`.trim(),'','','','Pendente','']));
    const ws=XLSX.utils.aoa_to_sheet(A);
    const M=(r1,c1,r2,c2)=>({s:{r:r1,c:c1},e:{r:r2,c:c2}});
    ws['!merges']=[M(0,0,0,N-1),M(1,0,1,N-1),M(8,0,8,7),M(8,8,8,N-1),...[3,4,5,6].flatMap(k=>[M(k,0,k,1),M(k,2,k,4),M(k,5,k,6),M(k,7,k,N-1)])];
    ws['!cols']=[5,16,46,40,7,10,26,24,16,16,13,13,28].map(wch=>({wch}));
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Solicitação de cadastro');
    XLSX.writeFile(wb,limpa(`SOLICITACAO DE CADASTRO - NOMUS - # ${id||proc||''} ${r.pedido||''} ${r.equipamento||''}`,120)+'.xlsx');
    toast('Planilha da solicitação de cadastro gerada.');
  }
});
window.npCadBtn=()=>`<button class="btn" data-act="npCadXlsx">${ic('download')}Excel da solicitação</button>`;

/* ---------- Configurações: endereço do processo no Nomus ---------- */
window.vNpAdmin=()=>{
  if(!NP.on())return '';
  const t=NP.tpl??(()=>{try{return localStorage.getItem(URLKEY)}catch{return ''}})()??'';
  return `<div class="panel"><h2>Abrir o processo direto no Nomus</h2><p class="hint">Abra um processo no Nomus, copie o endereço da barra do navegador e troque o número do processo por <b>{id}</b>. Exemplo: <code>https://…/CrmProcesso.exec?id={id}</code>. O botão “Levar ao Nomus” e “Abrir no Nomus” passam a abrir direto no processo. Vazio: abre o CRM do Nomus (Ticket.do?metodo=acessar), onde você procura o processo pelo número.</p><div class="field"><label for="np-url">Endereço de um processo (com {id})</label><input id="np-url" data-keep-case autocomplete="off" value="${esc(t||'')}" placeholder="https://minc.nomus.com.br/minc/...{id}..."></div><div class="actions"><button type="button" class="btn" data-act="npUrlSave">Salvar</button></div></div>`;
};

/* sincronização: situação dos processos + endereço */
MX.sync.push(async()=>{NP.auto().catch(()=>{});return false});
MX.boot.push(()=>{setTimeout(()=>{if(NP.on()){NP.cfg();NP.auto().catch(()=>{})}},5000)});
})();
