/* MINC · Peritagem — Banco de modelos de válvula (projetos) + Checklist de entrega  (v5.11.0 · v5.27.0: desenho, material, código Nomus, subcomponente e importação de planilha)
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
/* componente do modelo: além de POS/nome/qtd/un guarda código Nomus, desenho, material, subcomponente (parentId) e a estrutura (matéria-prima e serviços) */
const normMc=c=>{c=c||{};
  c.id=c.id||uid('MC');c.pos=c.pos==null?'':String(c.pos);c.name=c.name==null?'':String(c.name);c.qtd=c.qtd==null?'':String(c.qtd);c.unid=c.unid||'un';
  c.codigo=c.codigo||'';c.drawing=c.drawing||'';c.material=c.material||'';c.parentId=c.parentId||null;
  c.materials=Array.isArray(c.materials)?c.materials:[];
  if(Array.isArray(c.servicos)&&c.servicos.length&&c.servicos.every(x=>x&&!x.serviceId)){   // formato antigo de importação: serviço vira folha 'serv'
    c.servicos.forEach(x=>c.materials.push({tipo:'serv',raw:x.name||x.nome||'',codigo:x.codigo||'',qty:x.qty==null?'':String(x.qty),unit:'un',obs:x.obs||''}));c.servicos=[];
  }
  return c};
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
  fromRow(r){return{id:r.id,name:r.name,fabricante:r.fabricante||'',tipo:r.tipo||'',dn:r.dn||'',active:r.active!==false,components:(Array.isArray(r.data?.components)?r.data.components:[]).map(normMc),nomus:r.data?.nomus||'',desenho:r.data?.desenho||'',rev:r.rev,updatedAt:r.updated_at}},
  toRow(m){return{id:m.id,name:m.name,fabricante:m.fabricante||null,tipo:m.tipo||null,dn:m.dn||null,active:m.active!==false,data:{components:m.components,nomus:m.nomus||'',desenho:m.desenho||''}}},
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
const newModel=()=>({id:uid('MOD'),name:'',fabricante:'',tipo:'',dn:'',nomus:'',desenho:'',active:true,components:[],rev:null});
const newMc=(o={})=>normMc({id:uid('MC'),pos:'',name:'',qtd:'1',unid:'un',...o});
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
<div class="grid g4"><div class="field" style="grid-column:span 2"><label for="mf-fab">Fabricante / projeto</label><input id="mf-fab" value="${esc(d.fabricante)}" data-inp="mdlF" data-k="fabricante" autocomplete="off"></div><div class="field"><label for="mf-nom">Código Nomus</label><input id="mf-nom" value="${esc(d.nomus)}" data-inp="mdlF" data-k="nomus" data-keep-case autocomplete="off"></div><div class="field"><label for="mf-des">Desenho geral</label><input id="mf-des" value="${esc(d.desenho)}" data-inp="mdlF" data-k="desenho" data-keep-case autocomplete="off"></div></div>
<div class="grid g4"><label class="switch" style="align-self:end;margin-bottom:10px"><input type="checkbox" data-chg="mdlActive" ${d.active!==false?'checked':''}><span class="track"></span><span>Disponível para escolha</span></label></div>
<h3 style="margin:18px 0 8px;font-size:16px">Componentes (${rows.length})</h3>
${rows.length?`<div class="mdl-comps"><div class="mdl-ch"><span>POS</span><span>Componente</span><span>Qtd</span><span>Un</span><span></span></div>${rows.map((c,i)=>`<div class="mdl-cw" style="--lvl:${mcDepth(rows,c)}"><div class="mdl-c"><input aria-label="POS" value="${esc(c.pos)}" data-inp="mdlC" data-i="${i}" data-k="pos" autocomplete="off" data-fk="mc-${i}-pos"><input aria-label="Componente" value="${esc(c.name)}" data-inp="mdlC" data-i="${i}" data-k="name" autocomplete="off" data-fk="mc-${i}-name"><input aria-label="Quantidade" value="${esc(c.qtd)}" data-inp="mdlC" data-i="${i}" data-k="qtd" inputmode="decimal" data-keep-case autocomplete="off" data-fk="mc-${i}-qtd"><select aria-label="Unidade" data-chg="mdlUnit" data-i="${i}">${unitOpts(c.unid)}</select><div class="mdl-mv"><button class="iconb" data-act="mdlMove" data-i="${i}" data-dir="-1" aria-label="Subir">${ic('up')}</button><button class="iconb" data-act="mdlMove" data-i="${i}" data-dir="1" aria-label="Descer">${ic('chev')}</button><button class="iconb" data-act="mdlRm" data-i="${i}" aria-label="Remover componente">${ic('trash')}</button></div></div><div class="mdl-c2"><input aria-label="Código Nomus" placeholder="Código Nomus" value="${esc(c.codigo)}" data-inp="mdlC" data-i="${i}" data-k="codigo" data-keep-case autocomplete="off"><input aria-label="Desenho" placeholder="Nº do desenho" value="${esc(c.drawing)}" data-inp="mdlC" data-i="${i}" data-k="drawing" data-keep-case autocomplete="off"><input aria-label="Material" placeholder="Material" value="${esc(c.material)}" data-inp="mdlC" data-i="${i}" data-k="material" data-keep-case autocomplete="off"><select aria-label="Subcomponente de" data-chg="mdlParent" data-i="${i}"><option value="">Sem pai (1º nível)</option>${rows.filter(x=>x.id!==c.id&&!mcUnder(rows,x,c.id)).map(x=>`<option value="${esc(x.id)}" ${c.parentId===x.id?'selected':''}>Sub de ${esc(x.pos?x.pos+' – ':'')}${esc((x.name||'').slice(0,40))}</option>`).join('')}</select><small class="mdl-mat">${c.materials.length?plural(c.materials.filter(m=>m.tipo!=='serv').length,'matéria-prima','matérias-primas')+' · '+plural(c.materials.filter(m=>m.tipo==='serv').length,'serviço','serviços'):''}</small></div></div>`).join('')}</div>`:'<p class="hint">Nenhum componente. Adicione um a um ou cole a lista inteira.</p>'}
<div class="actions" style="margin-top:12px"><button class="btn" data-act="mdlAddC">${ic('plus')}Componente</button><button class="btn" data-act="mdlPaste">${ic('doc')}Colar lista (Excel)</button><button class="btn" data-act="mdlImport">${ic('doc')}Importar planilha (.xlsx)</button><button class="btn" data-act="mdlTemplate">${ic('doc')}Baixar planilha modelo</button></div>
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

/* profundidade na árvore (para recuo visual) e teste de descendência (para não criar laço) */
function mcDepth(rows,c){let n=0,x=c;const seen=new Set([c.id]);while(x&&x.parentId&&n<12){x=rows.find(y=>y.id===x.parentId);if(!x||seen.has(x.id))break;seen.add(x.id);n++}return n}
function mcUnder(rows,x,id){let n=0;while(x&&x.parentId&&n++<20){if(x.parentId===id)return true;x=rows.find(y=>y.id===x.parentId)}return false}

/* ---- planilha de modelo: abas Modelo | Componentes | Matéria-prima | Serviços ---- */
const T_HDR={
  modelo:['ID do modelo','Nome','Fabricante','Tipo','DN','Código Nomus','Nº desenho geral'],
  comp:['ID','Pos.','ID pai (subcomponente de)','Código Nomus','Nome','Nº desenho','Material','Qtd','Un','Peso acabado (kg)','Tipo'],
  mp:['ID do componente','Código Nomus','Descrição','Qtd','Un','Peso bruto (kg)'],
  serv:['ID do componente','Código Nomus do serviço','Descrição','Qtd']
};
function mdlTemplateFile(){
  if(!window.XLSX){toast('A biblioteca de planilhas não carregou. Recarregue a página.');return}
  const wb=XLSX.utils.book_new(),add=(t,rows,w)=>{const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=w.map(wch=>({wch}));XLSX.utils.book_append_sheet(wb,ws,t)};
  add('Instruções',[['MODELO DE IMPORTAÇÃO — MODELO DE VÁLVULA'],[''],['Preencha as abas Modelo (1 linha), Componentes, Matéria-prima e Serviços. Não mude os nomes das abas nem das colunas.'],['Componentes: 1 linha por peça/conjunto/comprado. “ID” é único (ex.: C1, C2…). “ID pai” = ID do componente de que ele é subcomponente (vazio = 1º nível).'],['Pos. = nº do item no desenho. Qtd = quantidade por 1 unidade do pai. Tipo = fabricado ou comprado.'],['Matéria-prima e Serviços: use o ID do componente. Serviços: 09.1.0003 corte de chapa; 09.1.0002 tratamento térmico.'],['Código Nomus em branco = item ainda sem cadastro.']],[140]);
  add('Modelo',[T_HDR.modelo,['VM-EXEMPLO','VÁLVULA BORBOLETA EXEMPLO DN 300','MINC','Borboleta','300','04.01.3.000000','022-000000']],[22,44,14,22,8,18,18]);
  add('Componentes',[T_HDR.comp,['C1','1','','03.022-000001','CORPO SOLDADO','022-000001','ASTM A516 GR70','1','un','100','fabricado'],['C2','2','C1','03.022-000002','FLANGE','022-000002','ASTM A516 GR70','2','un','5','fabricado'],['C3','3','','01.03.1.1.1.1.2.9.8','PARAFUSO SEXTAVADO M16 x 45','','Cl. 8.8','8','un','','comprado']],[10,8,22,22,50,14,18,8,6,14,12]);
  add('Matéria-prima',[T_HDR.mp,['C2','01.09.3.1.2.4.6','CHAPA LISA AÇO CARBONO - ASTM A 516 Gr 70 1"','6,2','kg','6,2']],[18,22,56,10,6,14]);
  add('Serviços',[T_HDR.serv,['C2','09.1.0003','SERVIÇO DE CORTE DE CHAPA','1']],[18,24,40,8]);
  XLSX.writeFile(wb,'MODELO_Importacao_Modelo_de_Valvula.xlsx');
}
const fold2=v=>String(v??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
async function mdlReadFile(file){
  if(!window.XLSX)throw new Error('A biblioteca de planilhas não carregou. Recarregue a página.');
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
  const sheet=k=>{const nm=wb.SheetNames.find(n=>fold2(n)===k);return nm?XLSX.utils.sheet_to_json(wb.Sheets[nm],{header:1,defval:'',blankrows:false}):null};
  const objs=(rows,keys)=>{   // primeira linha = cabeçalho; liga por posição das colunas conhecidas (tolera nomes um pouco diferentes)
    if(!rows||!rows.length)return[];const h=rows[0].map(fold2);
    const idx={};for(const [k,names] of Object.entries(keys)){idx[k]=h.findIndex(x=>names.some(n=>x===n||x.startsWith(n)))}
    return rows.slice(1).map(r=>{const o={};for(const k of Object.keys(keys))o[k]=idx[k]>=0?String(r[idx[k]]??'').trim():'';return o}).filter(o=>Object.values(o).some(v=>v))};
  const M=objs(sheet('modelo'),{id:['id do modelo'],name:['nome'],fabricante:['fabricante'],tipo:['tipo'],dn:['dn'],nomus:['codigo nomus'],desenho:['n desenho geral','no desenho geral','desenho geral']});
  const C=objs(sheet('componentes'),{id:['id'],pos:['pos'],pai:['id pai'],codigo:['codigo nomus'],name:['nome'],drawing:['n desenho','no desenho','desenho'],material:['material'],qtd:['qtd'],unid:['un'],peso:['peso'],tipo:['tipo']});
  const P=objs(sheet('materia prima'),{cid:['id do componente'],codigo:['codigo nomus'],raw:['descricao'],qty:['qtd'],unit:['un'],peso:['peso']});
  const S=objs(sheet('servicos'),{cid:['id do componente'],codigo:['codigo nomus'],raw:['descricao'],qty:['qtd']});
  if(!C.length)throw new Error('Não achei a aba “Componentes” com linhas. Use a planilha modelo.');
  return{M:M[0]||null,C,P,S};
}
function mdlBuild(d,src){
  const idMap=new Map(),comps=src.C.map(r=>{const c=newMc({pos:r.pos,name:String(r.name||'').toUpperCase(),qtd:r.qtd?String(r.qtd).replace('.',','):'1',unid:r.unid||'un',codigo:r.codigo,drawing:r.drawing,material:r.material});c._ref=r.id||('#'+r.pos);idMap.set(c._ref,c.id);c._pai=r.pai;return c});
  const avisos=[];
  comps.forEach(c=>{if(c._pai){const p=idMap.get(c._pai);if(p&&p!==c.id)c.parentId=p;else avisos.push(`“${c.name}”: ID pai ${c._pai} não existe — ficou no 1º nível.`)}});
  const byRef=new Map(comps.map(c=>[c._ref,c]));
  for(const r of src.P){const c=byRef.get(r.cid);if(!c){avisos.push(`Matéria-prima ${r.codigo||r.raw}: componente ${r.cid} não existe.`);continue}
    c.materials.push({tipo:'mp',raw:r.raw,material:c.material||'',dimensao:'',codigo:r.codigo,semCadastro:!r.codigo,peso:r.peso?String(r.peso).replace('.',','):'',unit:r.unit||'un',qty:r.qty?String(r.qty).replace('.',','):'',obs:''})}
  for(const r of src.S){const c=byRef.get(r.cid);if(!c){avisos.push(`Serviço ${r.codigo||r.raw}: componente ${r.cid} não existe.`);continue}
    c.materials.push({tipo:'serv',raw:r.raw,material:'',dimensao:'',codigo:r.codigo,semCadastro:!r.codigo,peso:'',unit:'un',qty:r.qty?String(r.qty).replace('.',','):'1',obs:''})}
  comps.forEach(c=>{c.semCadastro=!c.codigo;delete c._ref;delete c._pai});
  return{comps,avisos};
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
  mdlTemplate(){mdlTemplateFile()},
  mdlImport(){
    dialog(`<form class="dlg-body" data-submit="mdlImport"><h2>Importar planilha do projeto</h2><p>Escolha a planilha no formato do modelo (abas <b>Modelo</b>, <b>Componentes</b>, <b>Matéria-prima</b> e <b>Serviços</b>). Os componentes da planilha <b>substituem</b> a lista atual deste modelo; só vale depois de “Salvar modelo”. Se ainda não tem o arquivo, use “Baixar planilha modelo”.</p><div class="field"><label for="mi-mf">Arquivo</label><input id="mi-mf" name="f" type="file" accept=".xlsx,.xls" required></div><div id="mi-mprev" class="hint" aria-live="polite"></div><div class="actions end"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit">Importar</button></div></form>`);
  },
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
  async mdlImport(f){
    const prev=f.querySelector('#mi-mprev'),file=f.elements.f.files[0];if(!file){prev.textContent='Escolha o arquivo.';return}
    try{
      const src=await mdlReadFile(file),{comps,avisos}=mdlBuild(S.mdl.draft,src),d=S.mdl.draft;
      if(!comps.length||comps.some(c=>emp(c.name))){prev.textContent='Há componentes sem nome na planilha. Confira a coluna “Nome”.';return}
      d.components=comps;
      if(src.M){for(const k of ['name','fabricante','tipo','dn','nomus','desenho'])if(src.M[k]&&(emp(d[k])||k==='nomus'||k==='desenho'))d[k]=src.M[k]}
      closeDialog(f.closest('dialog'));renderMain();
      toast(`${plural(comps.length,'componente importado','componentes importados')}.`+(avisos.length?` ${plural(avisos.length,'aviso','avisos')}: ${avisos.slice(0,2).join(' ')}`:'')+' Confira e toque em “Salvar modelo”.',{ms:9000});
    }catch(e){prev.textContent=e.message||'Não consegui ler a planilha.'}
  },
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
  mdlParent(el){S.mdl.draft.components[+el.dataset.i].parentId=el.value||null;renderMain()},
  mdlUnit(el){S.mdl.draft.components[+el.dataset.i].unid=el.value}
});

/* ============================== Peritagem a partir do projeto ============================== */
/* Carrega os componentes do modelo na peritagem. A aba Componentes lista do mais novo para o mais antigo e o documento numera
   do mais antigo para o mais novo, então a lista entra invertida: a POS 1 do modelo vira o item 1 do documento. */
window.applyModel=function(r,m){
  r.modeloId=m.id;r.modeloNome=m.name;
  if(emp(r.equipamento))r.equipamento=m.name;
  const src=(m.components||[]).map(normMc),idMap=new Map();
  const comps=src.map(c=>{
    const mats=c.materials.map(x=>Object.assign({},x,{material:x.material||(x.tipo==='serv'?'':c.material)}));
    const n=newComp({name:emp(c.pos)?c.name:`POS. ${c.pos} – ${c.name}`,pos:c.pos||'',fromModelo:true,qtd:String(c.qtd||'1'),unid:c.unid||'un',
      codigo:c.codigo||'',drawing:c.drawing||'',noDrawing:emp(c.drawing),materials:mats});
    idMap.set(c.id,n.id);return n});
  src.forEach((c,i)=>{if(c.parentId&&idMap.has(c.parentId))comps[i].parentId=idMap.get(c.parentId)});
  r.components=comps.reverse().concat(r.components);
  comps.forEach(c=>{S.open[c.id]=false});
  if(typeof fixTree==='function')fixTree(r);
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
  return ['CHECKLIST-IRS',slug(r.process)||'SEM-PROCESSO',slug(r.pedido)||'SEM-PEDIDO',slug(r.equipamento)||'EQUIPAMENTO',d].join('_')+'.pdf';
}
window.buildChecklistPdf=async function(r,{todos=false}={}){
  await pdfLib();
  const F=CK(),{jsPDF}=window.jspdf,doc=new jsPDF({unit:'mm',format:'a4',compress:true}),M=12,W=210-2*M;
  const logo=await logoForPdf();
  const grid={theme:'grid',styles:{font:'helvetica',fontSize:8,cellPadding:1.6,lineColor:[0,0,0],lineWidth:.2,textColor:[0,0,0],valign:'middle'},headStyles:{fillColor:[236,236,236],textColor:[0,0,0],fontStyle:'bold',lineWidth:.2,lineColor:[0,0,0]},margin:{left:M,right:M,top:M,bottom:18}};
  const H=t=>({content:pdfTxt(t),styles:{fillColor:[236,236,236],fontStyle:'bold'}});
  const V=t=>pdfTxt(emp(t)?'-':t);
  doc.setProperties({title:pdfTxt(`${F.titulo} - ${r.equipamento||''}`),subject:pdfTxt(`Processo ${r.process||''}`),author:pdfTxt(S.user?.name||''),creator:'MINC ServiceHub'});
  /* cabeçalho no mesmo desenho do DEP */
  doc.autoTable({...grid,startY:M,body:[[{content:logo?'':'MINC',rowSpan:4,styles:{halign:'center',valign:'middle',fontStyle:'bold',fontSize:18,cellWidth:26}},{content:pdfTxt(F.titulo),rowSpan:4,styles:{halign:'center',valign:'middle',fontStyle:'bold',fontSize:11}},H('Tipo:'),pdfTxt(F.tipo)],[H('Cód.:'),V(F.codigo)],[H('Rev.:'),V(F.rev)],[H('Data:'),V(fmtISO(F.data))]],
    didDrawCell:(data)=>{
      if(!logo||data.section!=='body'||data.column.index!==0||data.row.index!==0)return;
      const pad=1.5,aw=data.cell.width-pad*2,ah=data.cell.height-pad*2;let w=aw,h=w/logo.ratio;if(h>ah){h=ah;w=h*logo.ratio}
      if(!(w>0)||!(h>0))return;
      try{doc.addImage(logo.url,'PNG',data.cell.x+(data.cell.width-w)/2,data.cell.y+(data.cell.height-h)/2,w,h)}catch(e){console.error('logo no PDF',e)}
    }});
  const all=treeList(r),items=todos?all:all.filter(({c})=>(c.acoes||[]).includes('Reutilizar'));
  doc.autoTable({...grid,startY:doc.lastAutoTable.finalY+3,body:[[H('Equipamento'),{content:V(r.equipamento),colSpan:3}],[H('Cliente'),{content:V(r.cliente),colSpan:3}],[H('Processo'),V(r.process),H('Pedido / Ordem'),pdfTxt((r.pedido||'-')+' / '+(r.ordem||'-'))],[H('Peritagem Nomus'),V(r.nomus),H('Projeto (modelo)'),V(r.modeloNome)],[H('Data da entrega'),'____ / ____ / ________',H(todos?'Total de itens':'Itens reutilizados'),String(items.length)+(todos?'':` de ${all.length}`)]],columnStyles:{0:{cellWidth:34},2:{cellWidth:34}}});
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
    doc.text(pdfTxt(`${F.codigo||'-'}  Rev. ${F.rev||'-'}  |  Processo ${r.process||'-'}`),118,289,{align:'center'});
    doc.setFont('helvetica','bold');doc.text(`Página ${i} de ${n}`,210-M,289,{align:'right'});
  }
  return{bytes:doc.output('arraybuffer'),pages:n,fileName:ckFileName(r)};
};
MX.act.checklistPdf=async function(el){
  const b=el?.closest?.('button')||el;b?.setAttribute?.('aria-busy','true');
  try{
    const r=cur();if(!r)return;
    if(!r.components.length){toast('Este processo ainda não tem componentes.');return}
    const todos=document.getElementById('ck-todos')?.checked;
    if(!todos&&!r.components.some(c=>(c.acoes||[]).includes('Reutilizar'))){toast('Nenhum componente com providência “Reutilizar”. Marque “Incluir todos os componentes” para gerar mesmo assim.',{ms:6000});return}
    const out=await buildChecklistPdf(r,{todos});saveBytes(out.bytes,out.fileName);toast('Checklist gerado.');
  }catch(e){console.error(e);toast('Não foi possível gerar o checklist.')}
  finally{b?.removeAttribute?.('aria-busy')}
};
window.checklistPanel=function(r){
  const n=r.components.length,nr=r.components.filter(c=>(c.acoes||[]).includes('Reutilizar')).length,F=CK();
  return `<div class="panel no-print"><div class="ph-row"><div><h2>Checklist de verificação de itens reutilizados</h2><p class="hint" style="margin:0">${esc(F.codigo)} — conferência de ${plural(nr,'peça reutilizada','peças reutilizadas')} (de ${plural(n,'componente','componentes')}) que a desmontagem entrega à fábrica, com caixas de entrega e recebimento e assinaturas. Gere depois de fechar o DEP.</p><label class="switch" style="margin-top:6px"><input type="checkbox" id="ck-todos"><span class="track"></span><span>Incluir todos os componentes</span></label></div><button class="btn primary" data-act="checklistPdf" ${n?'':'disabled'}>${ic('download')}Gerar checklist (PDF)</button></div></div>`;
};
})();
