/* MINC · Peritagem — Banco de modelos de válvula (projetos) + Checklist de entrega  (v5.11.0)
   - Modelos: cadastro na Administração > Modelos de válvula. Cada modelo guarda a lista de POS/componentes.
   - Peritagem: "Novo processo" oferece escolher um modelo; os componentes já entram na aba Componentes.
   - Checklist de entrega: PDF com as peças que a desmontagem entrega à fábrica, gerado a partir dos componentes do DEP.
   Este arquivo é carregado ANTES do app.js: tudo que usa funções do app roda só quando chamado (já com o app carregado). */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};
MX.sync=MX.sync||[];
const MKEY='minc_models_v1';
const CK=()=>(window.MINC_CATALOGO&&window.MINC_CATALOGO.CHECKLIST)||{titulo:'CHECKLIST DE ENTREGA DA DESMONTAGEM',tipo:'REGISTRO',codigo:'',rev:'00',data:''};
const MUNITS=['un','pç','cj','kg','m','mm'];
const byName=(a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR');
const missing=e=>!!e&&(e.code==='PGRST205'||e.code==='42P01'||/relation .* does not exist|schema cache/i.test(e.message||''));
const MSG_MISSING='A tabela de modelos ainda não existe na nuvem. Peça ao responsável técnico para aplicar a migração 20261013_modelos_valvula_e_rts.sql.';

/* ============================== Banco de modelos ============================== */
const Models={
  list:[],src:'none',missing:false,
  load(){
    try{const c=JSON.parse(localStorage.getItem(MKEY));if(c&&Array.isArray(c.list)){this.list=c.list;this.src=c.src||'local';return}}catch{}
    this.list=[];this.src=CLOUD?'none':'local';
  },
  persist(){try{localStorage.setItem(MKEY,JSON.stringify({list:this.list,src:this.src}))}catch{}},
  all(){return[...this.list].sort(byName)},
  active(){return this.all().filter(m=>m.active!==false&&(m.components||[]).length)},
  get(id){return this.list.find(m=>m.id===id)||null},
  fromRow(r){return{id:r.id,name:r.name,fabricante:r.fabricante||'',tipo:r.tipo||'',dn:r.dn||'',active:r.active!==false,components:Array.isArray(r.data?.components)?r.data.components:[],rev:r.rev,updatedAt:r.updated_at}},
  toRow(m){return{id:m.id,name:m.name,fabricante:m.fabricante||null,tipo:m.tipo||null,dn:m.dn||null,active:m.active!==false,data:{components:m.components}}},
  async refresh(){
    if(!CLOUD||this.missing)return false;
    const r=await SB.from('valve_models').select('*').order('name');
    if(r.error){if(missing(r.error)){this.missing=true;return false}throw r.error}
    const list=r.data.map(x=>this.fromRow(x)),before=JSON.stringify(this.list);
    this.list=list;this.src='cloud';this.persist();return before!==JSON.stringify(list);
  },
  /* grava (nuvem: só administrador, só online; local: neste aparelho). Devolve {error} em falha. */
  async save(m){
    m.updatedAt=new Date().toISOString();
    if(!CLOUD){const i=this.list.findIndex(x=>x.id===m.id);if(i<0)this.list.push(m);else this.list[i]=m;this.src='local';this.persist();return{}}
    if(!navigator.onLine)return{error:{message:'Sem conexão: os modelos só podem ser editados online.'}};
    const row=this.toRow(m);
    const r=this.list.some(x=>x.id===m.id)?await SB.from('valve_models').update(row).eq('id',m.id):await SB.from('valve_models').insert(row);
    if(r.error)return{error:missing(r.error)?{message:MSG_MISSING}:r.error};
    this.missing=false;await this.refresh().catch(()=>{});return{};
  },
  async remove(id){
    if(!CLOUD){this.list=this.list.filter(x=>x.id!==id);this.persist();return{}}
    if(!navigator.onLine)return{error:{message:'Sem conexão: os modelos só podem ser editados online.'}};
    const r=await SB.from('valve_models').delete().eq('id',id);
    if(r.error)return{error:r.error};
    await this.refresh().catch(()=>{});return{};
  }
};
window.Models=Models;
MX.boot=MX.boot||[];MX.boot.push(()=>Models.load());   // CLOUD só existe depois do app.js: carrega no boot, não aqui
MX.sync.push(()=>Models.refresh());

/* ============================== Administração > Modelos de válvula ============================== */
const newModel=()=>({id:uid('MOD'),name:'',fabricante:'',tipo:'',dn:'',active:true,components:[],rev:null});
const newMc=(o={})=>({id:uid('MC'),pos:'',name:'',qtd:'1',unid:'un',...o});
const canEditModels=()=>!CLOUD||['admin','gestor'].includes(S.user?.cloudRole);
const mErr=e=>e?.message||cloudErrMsg(e);

function mdlRow(m){
  const n=(m.components||[]).length;
  return `<div class="mdl-row ${m.active===false?'off':''}"><div class="mdl-i"><b>${esc(m.name)||'Sem nome'}</b><small>${[m.tipo,m.dn?'DN '+esc(m.dn):'',m.fabricante].filter(Boolean).map(esc).join(' · ')||'—'} · ${plural(n,'componente','componentes')}${m.active===false?' · <i>inativo</i>':''}</small></div><div class="actions"><button class="btn" data-act="mdlEdit" data-id="${esc(m.id)}">Editar</button><button class="btn" data-act="mdlDup" data-id="${esc(m.id)}">Duplicar</button><button class="btn danger" data-act="mdlDel" data-id="${esc(m.id)}">Excluir</button></div></div>`;
}
window.vModelsAdmin=function(){
  if(S.mdl)return mdlEditor();
  const list=Models.all(),edit=canEditModels();
  const note=CLOUD&&Models.missing?`<p class="errbox" style="margin-bottom:12px">${esc(MSG_MISSING)}</p>`:(CLOUD&&Models.src!=='cloud'?'<p class="errbox" style="margin-bottom:12px">Mostrando a cópia deste aparelho. Entre com internet para carregar os modelos da nuvem.</p>':'');
  return `${note}<div class="panel"><div class="ph-row"><div><h2>Modelos de válvula (projetos)</h2><p class="hint" style="margin:0">Cada modelo guarda a lista de POS/componentes de uma válvula que já tem projeto. Ao criar uma peritagem, o perito escolhe o modelo e todos os componentes entram prontos na aba Componentes; ele apaga o que não terá operação. Válvula sem projeto segue como hoje.</p></div>${edit?`<button class="btn primary" data-act="mdlNew">${ic('plus')}Novo modelo</button>`:''}</div>${list.length?`<div class="mdl-list">${list.map(mdlRow).join('')}</div>`:'<p class="hint" style="margin-top:14px">Nenhum modelo cadastrado ainda.</p>'}</div>`;
};
function mdlEditor(){
  const d=S.mdl.draft,rows=d.components;
  const unitOpts=u=>MUNITS.concat(MUNITS.includes(u)?[]:[u]).map(x=>`<option ${x===u?'selected':''}>${esc(x)}</option>`).join('');
  return `<div class="panel"><div class="ph-row"><div><h2>${S.mdl.isNew?'Novo modelo de válvula':'Editar modelo'}</h2><p class="hint" style="margin:0">Use a mesma numeração de POS do desenho do projeto.</p></div></div>
<div class="grid g4"><div class="field" style="grid-column:span 2"><label for="mf-name">Nome do modelo</label><input id="mf-name" value="${esc(d.name)}" data-inp="mdlF" data-k="name" placeholder="Ex.: VÁLVULA BORBOLETA DUPLO DISCO / SEDE" autocomplete="off"></div><div class="field"><label for="mf-tipo">Tipo</label><input id="mf-tipo" value="${esc(d.tipo)}" data-inp="mdlF" data-k="tipo" placeholder="Borboleta, gaveta…" autocomplete="off"></div><div class="field"><label for="mf-dn">DN</label><input id="mf-dn" value="${esc(d.dn)}" data-inp="mdlF" data-k="dn" inputmode="numeric" data-keep-case autocomplete="off"></div></div>
<div class="grid g4"><div class="field" style="grid-column:span 2"><label for="mf-fab">Fabricante / projeto</label><input id="mf-fab" value="${esc(d.fabricante)}" data-inp="mdlF" data-k="fabricante" autocomplete="off"></div><label class="switch" style="align-self:end;margin-bottom:10px"><input type="checkbox" data-chg="mdlActive" ${d.active!==false?'checked':''}><span class="track"></span><span>Disponível para escolha</span></label></div>
<h3 style="margin:18px 0 8px;font-size:16px">Componentes (${rows.length})</h3>
${rows.length?`<div class="mdl-comps"><div class="mdl-ch"><span>POS</span><span>Componente</span><span>Qtd</span><span>Un</span><span></span></div>${rows.map((c,i)=>`<div class="mdl-c"><input aria-label="POS" value="${esc(c.pos)}" data-inp="mdlC" data-i="${i}" data-k="pos" autocomplete="off" data-fk="mc-${i}-pos"><input aria-label="Componente" value="${esc(c.name)}" data-inp="mdlC" data-i="${i}" data-k="name" autocomplete="off" data-fk="mc-${i}-name"><input aria-label="Quantidade" value="${esc(c.qtd)}" data-inp="mdlC" data-i="${i}" data-k="qtd" inputmode="decimal" data-keep-case autocomplete="off" data-fk="mc-${i}-qtd"><select aria-label="Unidade" data-chg="mdlUnit" data-i="${i}">${unitOpts(c.unid)}</select><div class="mdl-mv"><button class="iconb" data-act="mdlMove" data-i="${i}" data-dir="-1" aria-label="Subir">${ic('up')}</button><button class="iconb" data-act="mdlMove" data-i="${i}" data-dir="1" aria-label="Descer">${ic('chev')}</button><button class="iconb" data-act="mdlRm" data-i="${i}" aria-label="Remover componente">${ic('trash')}</button></div></div>`).join('')}</div>`:'<p class="hint">Nenhum componente. Adicione um a um ou cole a lista inteira.</p>'}
<div class="actions" style="margin-top:12px"><button class="btn" data-act="mdlAddC">${ic('plus')}Componente</button><button class="btn" data-act="mdlPaste">${ic('doc')}Colar lista (Excel)</button></div>
<div class="actions end" style="margin-top:20px"><button class="btn" data-act="mdlCancel">Cancelar</button><button class="btn primary" data-act="mdlSave">${ic('save')}Salvar modelo</button></div></div>`;
}
/* colar lista: uma linha por componente — "POS ⇥ NOME ⇥ QTD" (Excel), "POS;NOME;QTD" ou "POS NOME" */
function parseList(txt){
  const out=[];
  for(const raw of String(txt||'').split(/\r?\n/)){
    const line=raw.trim();if(!line)continue;
    let parts=line.split(/\t|;/).map(x=>x.trim()).filter((x,i,a)=>x!==''||i<a.length-1);
    if(parts.length<2){const m=/^(?:POS\.?\s*)?(\d+[A-Za-z]?)\s*[-–.:)]?\s+(.+)$/i.exec(line);parts=m?[m[1],m[2]]:['',line]}
    let [pos,name,qtd]=parts.length>=3?parts:[parts[0],parts[1],''];
    pos=String(pos||'').replace(/^POS\.?\s*/i,'').trim();
    if(emp(name))continue;
    const q=num(qtd);
    out.push(newMc({pos,name:String(name).toUpperCase(),qtd:q>0?String(q).replace('.',','):'1'}));
  }
  return out;
}
Object.assign(MX.act,{
  mdlNew(){S.mdl={draft:newModel(),isNew:true};renderMain();scrollTo(0,0)},
  mdlEdit(el){const m=Models.get(el.dataset.id);if(!m)return;if(!canEditModels()){toast('Só o administrador ou o gestor edita os modelos.');return}S.mdl={draft:JSON.parse(JSON.stringify(m)),isNew:false};renderMain();scrollTo(0,0)},
  mdlDup(el){const m=Models.get(el.dataset.id);if(!m)return;const c=JSON.parse(JSON.stringify(m));c.id=uid('MOD');c.rev=null;c.name=(m.name+' (cópia)').slice(0,200);c.components.forEach(x=>x.id=uid('MC'));S.mdl={draft:c,isNew:true};renderMain();scrollTo(0,0)},
  async mdlDel(el){
    const m=Models.get(el.dataset.id);if(!m)return;
    if(!canEditModels()){toast('Só o administrador ou o gestor exclui modelos.');return}
    if(!await ask({title:`Excluir “${m.name}”?`,body:'Os processos já criados com este modelo não mudam (eles guardam uma cópia dos componentes).',ok:'Excluir',danger:true}))return;
    const r=await Models.remove(m.id);if(r.error){toast(mErr(r.error));return}
    renderMain();toast('Modelo excluído.');
  },
  mdlCancel(){S.mdl=null;renderMain()},
  mdlAddC(){S.mdl.draft.components.push(newMc());const i=S.mdl.draft.components.length-1;S.focus=null;renderMain();const n=document.querySelector(`[data-fk="mc-${i}-pos"]`);n&&n.focus()},
  mdlRm(el){S.mdl.draft.components.splice(+el.dataset.i,1);renderMain()},
  mdlMove(el){const a=S.mdl.draft.components,i=+el.dataset.i,j=i+ +el.dataset.dir;if(j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];renderMain()},
  mdlPaste(){
    dialog(`<form class="dlg-body" data-submit="mdlPaste"><h2>Colar lista de componentes</h2><p>Uma linha por componente. Pode copiar direto do Excel (colunas POS, Componente e Qtd) ou digitar assim: <b>02 CORPO</b>, <b>04;EIXO DE ACIONAMENTO;1</b>.</p><div class="field"><label for="mp-t">Lista</label><textarea id="mp-t" name="t" rows="10" data-keep-case placeholder="02&#9;CORPO&#9;1&#10;03&#9;DISCO&#9;1" autofocus></textarea></div><div class="actions end"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit">Adicionar à lista</button></div></form>`);
  },
  async mdlSave(){
    const d=S.mdl.draft;d.components=d.components.filter(c=>!emp(c.name)||!emp(c.pos));
    if(emp(d.name)){toast('Dê um nome ao modelo.');renderMain();return}
    if(!d.components.length||d.components.some(c=>emp(c.name))){toast('Todos os componentes precisam de nome. Adicione pelo menos um.');renderMain();return}
    const seen=new Set(),dup=d.components.find(c=>{const k=String(c.pos).trim().toUpperCase();if(!k)return false;if(seen.has(k))return true;seen.add(k);return false});
    if(dup&&!await ask({title:`POS ${dup.pos} repetida`,body:'Existem duas linhas com a mesma POS. Salvar assim mesmo?',ok:'Salvar'}))return;
    const r=await Models.save(d);
    if(r.error){toast(mErr(r.error),{ms:6000});return}
    S.mdl=null;renderMain();toast('Modelo salvo.');
  }
});
Object.assign(MX.sub,{
  mdlPaste(f){
    const add=parseList(f.elements.t.value);
    if(!add.length){toast('Nenhuma linha reconhecida.');return}
    S.mdl.draft.components.push(...add);closeDialog(f.closest('dialog'));renderMain();toast(`${plural(add.length,'componente adicionado','componentes adicionados')}.`);
  }
});
Object.assign(MX.inp,{
  mdlF(el){S.mdl.draft[el.dataset.k]=el.value},
  mdlC(el){S.mdl.draft.components[+el.dataset.i][el.dataset.k]=el.value}
});
Object.assign(MX.chg,{
  mdlActive(el){S.mdl.draft.active=el.checked},
  mdlUnit(el){S.mdl.draft.components[+el.dataset.i].unid=el.value}
});

/* ============================== Peritagem a partir do projeto ============================== */
/* Carrega os componentes do modelo na peritagem. A aba Componentes lista do mais novo para o mais antigo e o documento numera
   do mais antigo para o mais novo, então a lista entra invertida: a POS 1 do modelo vira o item 1 do documento. */
window.applyModel=function(r,m){
  r.modeloId=m.id;r.modeloNome=m.name;
  if(emp(r.equipamento))r.equipamento=m.name;
  const comps=(m.components||[]).map(c=>newComp({name:emp(c.pos)?c.name:`POS. ${c.pos} – ${c.name}`,pos:c.pos||'',fromModelo:true,qtd:String(c.qtd||'1'),unid:c.unid||'un'}));
  r.components=comps.reverse().concat(r.components);
  comps.forEach(c=>{S.open[c.id]=false});
};
window.modelHint=function(r){
  if(!r.modeloId)return'';
  return `<div class="mdl-hint no-print"><b>Projeto: ${esc(r.modeloNome||'')}</b><span>Os componentes vieram do banco de projetos. Apague o que não terá operação e defina a providência dos que ficam.</span></div>`;
};
MX.act.newProcess=function(){
  const ms=Models.active();
  if(!ms.length){newProcess();return}
  dialog(`<div class="dlg-body"><h2>Novo processo</h2><p>Esta válvula tem projeto? Escolha o modelo para já carregar todos os componentes. Sem projeto, a peritagem começa em branco como sempre.</p><div class="field"><label for="nm-model">Modelo de válvula</label><select id="nm-model"><option value="">Selecione o modelo…</option>${ms.map(m=>`<option value="${esc(m.id)}">${esc(m.name)}${m.dn?' — DN '+esc(m.dn):''} (${plural(m.components.length,'componente','componentes')})</option>`).join('')}</select></div><div class="actions end"><button type="button" class="btn" data-act="newProcessPlain">Sem projeto</button><button type="button" class="btn primary" data-act="newProcessModel">${ic('check')}Carregar projeto</button></div></div>`);
};
MX.act.newProcessPlain=function(el){closeDialog(el.closest('dialog'));newProcess()};
MX.act.newProcessModel=function(el){
  const d=el.closest('dialog'),id=d.querySelector('#nm-model').value;
  if(!id){toast('Escolha o modelo ou toque em “Sem projeto”.');return}
  closeDialog(d);newProcess(id);
};

/* ============================== Checklist de entrega (PDF) ============================== */
function ckFileName(r,when=new Date()){
  const d=when.toISOString().slice(0,10);
  return ['CHECKLIST-ENTREGA',slug(r.process)||'SEM-PROCESSO',slug(r.pedido)||'SEM-PEDIDO',slug(r.equipamento)||'EQUIPAMENTO',d].join('_')+'.pdf';
}
window.buildChecklistPdf=async function(r){
  await pdfLib();
  const F=CK(),{jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4',compress:true}),M=12,W=210-2*M;
  const logo=await logoForPdf();
  const grid={theme:'grid',styles:{font:'helvetica',fontSize:8,cellPadding:1.6,lineColor:[0,0,0],lineWidth:.2,textColor:[0,0,0],valign:'middle'},headStyles:{fillColor:[236,236,236],textColor:[0,0,0],fontStyle:'bold',lineWidth:.2,lineColor:[0,0,0]},margin:{left:M,right:M,top:M,bottom:18}};
  const H=t=>({content:pdfTxt(t),styles:{fillColor:[236,236,236],fontStyle:'bold'}});
  const V=t=>pdfTxt(emp(t)?'-':t);
  doc.setProperties({title:pdfTxt(`${F.titulo} - ${r.equipamento||''}`),subject:pdfTxt(`Processo ${r.process||''}`),author:pdfTxt(S.user?.name||''),creator:'MINC Peritagem'});
  /* cabeçalho no mesmo desenho do DEP */
  doc.autoTable({...grid,startY:M,body:[[{content:logo?'':'MINC',rowSpan:4,styles:{halign:'center',valign:'middle',fontStyle:'bold',fontSize:18,cellWidth:26}},{content:pdfTxt(F.titulo),rowSpan:4,styles:{halign:'center',valign:'middle',fontStyle:'bold',fontSize:11}},H('Tipo:'),pdfTxt(F.tipo)],[H('Cód.:'),V(F.codigo)],[H('Rev.:'),V(F.rev)],[H('Data:'),V(fmtISO(F.data))]],
    didDrawCell:(data)=>{
      if(!logo||data.section!=='body'||data.column.index!==0||data.row.index!==0)return;
      const pad=1.5,aw=data.cell.width-pad*2,ah=data.cell.height-pad*2;let w=aw,h=w/logo.ratio;if(h>ah){h=ah;w=h*logo.ratio}
      if(!(w>0)||!(h>0))return;
      try{doc.addImage(logo.url,'PNG',data.cell.x+(data.cell.width-w)/2,data.cell.y+(data.cell.height-h)/2,w,h)}catch(e){console.error('logo no PDF',e)}
    }});
  const items=treeList(r);
  doc.autoTable({...grid,startY:doc.lastAutoTable.finalY+3,body:[[H('Equipamento'),{content:V(r.equipamento),colSpan:3}],[H('Cliente'),{content:V(r.cliente),colSpan:3}],[H('Processo'),V(r.process),H('Pedido / Ordem'),pdfTxt((r.pedido||'-')+' / '+(r.ordem||'-'))],[H('Peritagem Nomus'),V(r.nomus),H('Projeto (modelo)'),V(r.modeloNome)],[H('Data da entrega'),'____ / ____ / ________',H('Total de itens'),String(items.length)]],columnStyles:{0:{cellWidth:34},2:{cellWidth:34}}});
  /* lista de peças: cada linha com duas caixas (entregue pela desmontagem / recebido pela fábrica) */
  const box={halign:'center',minCellHeight:8};
  const body=items.map(({c,no,lvl})=>[String(no),pdfTxt(('- '.repeat(Math.min(lvl,3)))+(c.name||'-')),pdfTxt(emp(c.qtd)?'-':c.qtd+(c.unid&&c.unid!=='un'?' '+c.unid:'')),pdfTxt(c.acoes.length?c.acoes.join(' / '):'-'),'','',''],);
  const boxCols={4:{cellWidth:23},5:{cellWidth:23}};
  doc.autoTable({...grid,startY:doc.lastAutoTable.finalY+4,head:[[{content:'Item',styles:{halign:'center'}},'Componente / peça',{content:'Qtd',styles:{halign:'center'}},'Providência',{content:'Entregue\n(desmontagem)',styles:{halign:'center',fontSize:6.8}},{content:'Recebido\n(fábrica)',styles:{halign:'center',fontSize:6.8}},'Observação']],body:body.length?body:[[{content:'Nenhum componente neste processo.',colSpan:7,styles:{halign:'center'}}]],
    columnStyles:{0:{cellWidth:12,halign:'center',fontStyle:'bold'},1:{cellWidth:58},2:{cellWidth:14,halign:'center'},3:{cellWidth:24,fontSize:7},...boxCols,6:{cellWidth:'auto'}},
    styles:{...grid.styles,minCellHeight:8},rowPageBreak:'avoid',showHead:'everyPage',
    didDrawCell:(data)=>{
      if(data.section!=='body'||![4,5].includes(data.column.index)||!items.length)return;
      const s=4.6,x=data.cell.x+(data.cell.width-s)/2,y=data.cell.y+(data.cell.height-s)/2;
      doc.setDrawColor(0);doc.setLineWidth(.35);doc.rect(x,y,s,s);doc.setLineWidth(.2);
    }});
  let y=doc.lastAutoTable.finalY+6;
  if(y>297-62){doc.addPage();y=M}
  doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(0);doc.text('Conferência final',M,y);
  doc.autoTable({...grid,startY:y+2,head:[[H('Entregue por (desmontagem)'),H('Recebido por (fábrica)')]],body:[[{content:'Nome:\n\nAssinatura:\n\nData:      /      /',styles:{minCellHeight:30,valign:'top'}},{content:'Nome:\n\nAssinatura:\n\nData:      /      /',styles:{minCellHeight:30,valign:'top'}}]],columnStyles:{0:{cellWidth:W/2},1:{cellWidth:W/2}}});
  y=doc.lastAutoTable.finalY+3;
  if(y<297-28){doc.autoTable({...grid,startY:y,body:[[{content:'Divergências / peças faltando ou danificadas:\n\n\n',styles:{minCellHeight:20,valign:'top'}}]]})}
  /* rodapé em todas as páginas */
  const n=doc.getNumberOfPages(),stamp=new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).replace(',','');
  const who=pdfTxt(String(S.user?.name||S.user?.login||'-').slice(0,34));
  for(let i=1;i<=n;i++){
    doc.setPage(i);doc.setDrawColor(150);doc.setLineWidth(.2);doc.line(M,284,210-M,284);doc.setTextColor(90);doc.setFontSize(7);
    doc.setFont('helvetica','normal');doc.text(`Emitido por: ${who}  |  ${stamp}`,M,289);
    doc.text(pdfTxt(`${F.titulo}  |  Processo ${r.process||'-'}`),118,289,{align:'center'});
    doc.setFont('helvetica','bold');doc.text(`Página ${i} de ${n}`,210-M,289,{align:'right'});
  }
  return{bytes:doc.output('arraybuffer'),pages:n,fileName:ckFileName(r)};
};
MX.act.checklistPdf=async function(el){
  const b=el?.closest?.('button')||el;b?.setAttribute?.('aria-busy','true');
  try{
    const r=cur();if(!r)return;
    if(!r.components.length){toast('Este processo ainda não tem componentes.');return}
    const out=await buildChecklistPdf(r);saveBytes(out.bytes,out.fileName);toast('Checklist de entrega gerado.');
  }catch(e){console.error(e);toast('Não foi possível gerar o checklist.')}
  finally{b?.removeAttribute?.('aria-busy')}
};
window.checklistPanel=function(r){
  const n=r.components.length;
  return `<div class="panel no-print"><div class="ph-row"><div><h2>Checklist de entrega</h2><p class="hint" style="margin:0">Lista de conferência com as ${plural(n,'peça','peças')} que a desmontagem entrega à fábrica (uma linha por componente, com caixa de entrega e de recebimento e campos de assinatura). Gere depois de fechar o DEP.</p></div><button class="btn primary" data-act="checklistPdf" ${n?'':'disabled'}>${ic('download')}Gerar checklist (PDF)</button></div></div>`;
};
})();
