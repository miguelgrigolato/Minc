/* MINC · Peritagem — Cadastro padronizado de matéria-prima com código do Nomus  (v5.16.0)
   - Lista única (tabela catalog_materials): código do Nomus, código secundário (informação complementar), descrição, unidade e FAMÍLIA
     (PARAFUSO, PORCA, ARRUELA, CHAPA, BARRA, O'RING, ROLAMENTOS…), como no cadastro de produtos do Nomus.
   - Administração > Configurações > "Lista de matéria-prima": SÓ o administrador adiciona, edita, desativa, exclui, importa a planilha
     do Nomus (.xlsx/.csv) e exporta. Tem filtros (família, unidade) e ordenação.
   - Nos componentes (Componentes e Estrutura): "Adicionar matéria-prima" abre a lista para MARCAR os itens. Nome, códigos e unidade entram
     prontos; o funcionário só informa quantidade e observação. A caixa de texto é BUSCA, com "%" para pular palavras:
     "paraf%sext%m10%30" acha "PARAFUSO SEXTAVADO ... M10 ... x 30". Sem "%", todas as palavras digitadas precisam aparecer.
   - Não achou? "Item sem cadastro": o funcionário escolhe a FAMÍLIA e preenche a ficha daquela família (fichas.js).
   - Os documentos já feitos guardam uma cópia do nome e dos códigos: editar/excluir da lista não muda documento antigo.
   - A lista fica no aparelho (IndexedDB) para funcionar offline; os aparelhos só baixam de novo quando a versão da lista muda.
   Carregado ANTES do app.js: tudo que usa funções do app roda só quando chamado. */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};
MX.sync=MX.sync||[];MX.boot=MX.boot||[];
const isAdmin=()=>CLOUD?['admin','gestor'].includes(S.user?.cloudRole):['Administrador','Gestor'].includes(S.user?.role);
const norm=s=>String(s??'').trim();
const fold=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const missing=e=>!!e&&(e.code==='PGRST205'||e.code==='42P01'||/relation .* does not exist|schema cache/i.test(e.message||''));
const dupMsg='Já existe uma matéria-prima com esse código.';
const SHOW=60;          // linhas mostradas por vez no seletor
const ADM_PAGE=100;     // linhas por vez na administração
const COLL=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});   // M6 vem antes de M10

/* unidades do Nomus -> unidades do aplicativo */
const UN={UNIDADE:'un',UN:'un',UNID:'un',PECA:'pç',PC:'pç',QUILOGRAMA:'kg',KG:'kg',MILIMETRO:'mm',MM:'mm',METRO:'m',M:'m','METRO QUADRADO':'m²',CENTIMETRO:'cm',LITRO:'L',L:'L',MILILITRO:'mL',GALAO:'galão',CONJUNTO:'cj',JOGO:'jogo',LATA:'lata',CARTELA:'cartela'};
const mapUn=u=>{const k=fold(u).toUpperCase().replace(/\s+/g,' ').trim();return UN[k]||(norm(u)?norm(u).toLowerCase():'un')};
/* código do Nomus: tira espaço que encosta em ponto ("21 .1" -> "21.1") e nas pontas; espaço no meio de uma palavra ("… REV.1") fica */
const cleanCode=c=>String(c??'').trim().replace(/\s*\.\s*/g,'.').replace(/\s+/g,' ');
const cleanDesc=d=>String(d??'').replace(/\s+/g,' ').trim();
const cleanFam=f=>String(f??'').replace(/\s+/g,' ').trim().toUpperCase();

/* ============================== Lista (aparelho + nuvem) ============================== */
const Mats={
  list:[],ver:'',src:'none',missing:false,
  prep(x){x._d=fold(x.descricao);x._c=fold(x.codigo+' '+(x.codigo2||''));return x},
  map(r){return this.prep({id:r.id,codigo:r.codigo||'',codigo2:r.codigo2||'',descricao:r.descricao||'',unidade:r.unidade||'un',familia:r.familia||'',active:r.active!==false})},
  async load(){
    try{const r=await Store.get('kv','materials');if(r&&Array.isArray(r.v?.list)){this.list=r.v.list.map(x=>this.prep(x.grupo&&!x.familia?{...x,familia:cleanFam(x.grupo)}:x));this.ver=r.v.ver||'';this.src=r.v.src||'local'}}catch{}
  },
  async persist(){
    try{await Store.put('kv',{k:'materials',v:{list:this.list.map(({_d,_c,...x})=>x),ver:this.ver,src:this.src,at:new Date().toISOString()}})}catch(e){console.error('lista de matéria-prima (local)',e)}
  },
  active(){return this.list.filter(x=>x.active)},
  /* [[nome, quantidade]] em ordem alfabética */
  count(items,key){const m=new Map();for(const x of items){const g=x[key]||(key==='familia'?'SEM FAMÍLIA':'—');m.set(g,(m.get(g)||0)+1)}return[...m.entries()].sort((a,b)=>COLL.compare(a[0],b[0]))},
  families(items=this.list){return this.count(items,'familia')},
  units(items=this.list){return this.count(items,'unidade')},
  /* só baixa tudo de novo quando a versão publicada pelo administrador mudou */
  async refresh(force=false){
    if(!CLOUD||this.missing)return false;
    const v=await SB.from('app_settings').select('value').eq('key','materiais_versao');
    if(v.error)throw v.error;
    const ver=String(v.data[0]?.value?.v||'0');
    if(!force&&this.src==='cloud'&&ver===this.ver)return false;
    const all=[];
    for(let from=0;;from+=1000){
      const r=await SB.from('catalog_materials').select('*').order('codigo').range(from,from+999);
      if(r.error){if(missing(r.error)){this.missing=true;return false}throw r.error}
      all.push(...r.data);if(r.data.length<1000)break;
    }
    this.list=all.map(r=>this.map(r));this.ver=ver;this.src='cloud';await this.persist();return true;
  },
  async bump(){
    if(!CLOUD)return;
    const v=String(Date.now());
    const r=await SB.from('app_settings').upsert({key:'materiais_versao',value:{v}},{onConflict:'key'});
    if(r.error)throw r.error;
    this.ver=v;
  }
};
window.Mats=Mats;
MX.boot.push(()=>Mats.load());
MX.sync.push(async()=>{const ch=await Mats.refresh();if(ch&&S.screen==='admin')renderMain();return false});

/* ============================== Busca com "%", filtros e ordem ============================== */
/* "paraf%sext%m10%30": os trechos precisam aparecer NESTA ordem (como um LIKE '%paraf%sext%m10%30%').
   Sem "%": cada palavra digitada precisa aparecer, em qualquer ordem. Ignora maiúsculas e acentos; também procura no código. */
function compile(q){
  q=fold(q).trim();
  if(!q)return()=>true;
  if(q.includes('%')){
    const segs=q.split('%').map(s=>s.trim()).filter(Boolean);
    if(!segs.length)return()=>true;
    const ordered=h=>{let i=0;for(const s of segs){const k=h.indexOf(s,i);if(k<0)return false;i=k+s.length}return true};
    return x=>ordered(x._d)||ordered(x._c);
  }
  const words=q.split(/\s+/);
  return x=>words.every(w=>x._d.includes(w))||x._c.includes(q.replace(/\s+/g,''));
}
const ORD={
  desc:['Descrição A → Z',(a,b)=>COLL.compare(a.descricao,b.descricao)],
  descz:['Descrição Z → A',(a,b)=>COLL.compare(b.descricao,a.descricao)],
  cod:['Código (crescente)',(a,b)=>COLL.compare(a.codigo,b.codigo)],
  codz:['Código (decrescente)',(a,b)=>COLL.compare(b.codigo,a.codigo)],
  fam:['Família A → Z, depois descrição',(a,b)=>COLL.compare(a.familia,b.familia)||COLL.compare(a.descricao,b.descricao)]
};
/* st = {q, fam, un, ord}; fam/un vazios = todos */
window.matQuery=(items,st)=>{
  const f=compile(st.q),out=items.filter(x=>(!st.fam||(x.familia||'SEM FAMÍLIA')===st.fam)&&(!st.un||x.unidade===st.un)&&f(x));
  return out.sort((ORD[st.ord]||ORD.desc)[1]);
};
window.matSearch=(items,q,fam)=>matQuery(items,{q,fam:fam==='Todos'?'':fam,un:'',ord:'desc'});
/* linha de filtros usada na administração e no seletor: família, unidade, ordem; w identifica de onde vem */
function filtersHTML(w,st,items){
  const fams=Mats.families(items),uns=Mats.units(items);
  return `<div class="mat-filters"><div class="field"><label for="${w}-fam">Família</label><select id="${w}-fam" data-chg="matFilt" data-w="${w}" data-k="fam"><option value="">Todas (${items.length})</option>${fams.map(([n,c])=>`<option value="${esc(n)}" ${st.fam===n?'selected':''}>${esc(n)} (${c})</option>`).join('')}</select></div><div class="field"><label for="${w}-un">Unidade</label><select id="${w}-un" data-chg="matFilt" data-w="${w}" data-k="un"><option value="">Todas</option>${uns.map(([n,c])=>`<option value="${esc(n)}" ${st.un===n?'selected':''}>${esc(n)} (${c})</option>`).join('')}</select></div><div class="field"><label for="${w}-ord">Ordenar por</label><select id="${w}-ord" data-chg="matFilt" data-w="${w}" data-k="ord">${Object.entries(ORD).map(([k,[l]])=>`<option value="${k}" ${st.ord===k?'selected':''}>${l}</option>`).join('')}</select></div></div>`;
}
/* caixa de busca com o botão "%" (no tablet o % fica escondido no teclado de símbolos) */
const searchHTML=(id,inp,val,auto)=>`<div class="search mat-search">${ic('search')}<input type="search" id="${id}" placeholder="Buscar: paraf%sext%m10%30" aria-label="Buscar matéria-prima" data-keep-case data-inp="${inp}" value="${esc(val)}" autocomplete="off" ${auto?'autofocus':''}><button type="button" class="pct" data-act="pctIns" data-for="${id}" aria-label="Inserir o sinal % (pula palavras na busca)" title="Inserir %">%</button></div><p class="hint" style="margin:6px 0 0">Use <b>%</b> para pular palavras: <b>paraf%sext%m10%30</b>. Também busca pelo código. Sem <b>%</b>, as palavras podem estar em qualquer ordem.</p>`;

/* ============================== Operações do administrador ============================== */
async function guard(){
  if(!isAdmin()){toast('Só o administrador ou o gestor altera a lista de matéria-prima.');return false}
  if(CLOUD){
    if(!navigator.onLine){toast('Sem conexão: a lista só pode ser editada online.');return false}
    if(Mats.missing){toast('A tabela da lista de matéria-prima ainda não existe na nuvem.');return false}
    if(Mats.src!=='cloud'){toast('Carregue a lista da nuvem antes de editar (entre com internet).');return false}
  }
  return true;
}
const codeClash=(codigo,exceptId)=>{const c=fold(codigo);return c?Mats.list.find(x=>x.id!==exceptId&&fold(x.codigo)===c):null};
function toRow(x){return{codigo:x.codigo,codigo2:x.codigo2||null,descricao:x.descricao,unidade:x.unidade||null,familia:x.familia||null,active:x.active!==false}}
const Mat={
  async add(d){
    d={codigo:cleanCode(d.codigo),codigo2:norm(d.codigo2),descricao:cleanDesc(d.descricao),unidade:mapUn(d.unidade||'un'),familia:cleanFam(d.familia),active:true};
    if(!d.codigo||!d.descricao){toast('Informe o código e a descrição.');return false}
    if(!await guard())return false;
    if(codeClash(d.codigo)){toast(dupMsg);return false}
    try{
      if(!CLOUD){Mats.list.push(Mats.prep({id:uid('lmt'),...d}))}
      else{const r=await SB.from('catalog_materials').insert(toRow(d)).select('*').single();if(r.error)throw r.error;Mats.list.push(Mats.map(r.data));await Mats.bump()}
      await Mats.persist();renderMain();toast('Matéria-prima adicionada.');return true;
    }catch(e){console.error(e);toast(e.code==='23505'?dupMsg:cloudErrMsg(e),{ms:6000});return false}
  },
  async update(id,patch){
    const cur=Mats.list.find(x=>x.id===id);if(!cur||!await guard())return false;
    const p={...patch};
    if('codigo'in p)p.codigo=cleanCode(p.codigo);
    if('descricao'in p)p.descricao=cleanDesc(p.descricao);
    if('codigo2'in p)p.codigo2=norm(p.codigo2);
    if('familia'in p)p.familia=cleanFam(p.familia);
    if('unidade'in p)p.unidade=mapUn(p.unidade);
    if(('codigo'in p&&!p.codigo)||('descricao'in p&&!p.descricao)){toast('Código e descrição não podem ficar vazios.');renderMain();return false}
    if('codigo'in p&&codeClash(p.codigo,id)){toast(dupMsg);renderMain();return false}
    try{
      if(CLOUD){const row=toRow({...cur,...p});const r=await SB.from('catalog_materials').update(row).eq('id',id).select('*').single();if(r.error)throw r.error;Object.assign(cur,Mats.map(r.data));await Mats.bump()}
      else Object.assign(cur,p);
      Mats.prep(cur);await Mats.persist();renderMain();return true;
    }catch(e){console.error(e);toast(e.code==='23505'?dupMsg:cloudErrMsg(e),{ms:6000});renderMain();return false}
  },
  async remove(id){
    const cur=Mats.list.find(x=>x.id===id);if(!cur||!await guard())return false;
    if(!await ask({title:`Excluir “${cur.codigo}”?`,body:`${cur.descricao}\n\nO item sai da lista de escolha. Documentos já feitos não mudam (guardam uma cópia). Se quiser só esconder, use o interruptor "Ativo".`,ok:'Excluir',danger:true}))return false;
    try{
      if(CLOUD){const r=await SB.from('catalog_materials').delete().eq('id',id);if(r.error)throw r.error;await Mats.bump()}
      Mats.list=Mats.list.filter(x=>x.id!==id);await Mats.persist();renderMain();toast('Item excluído.');return true;
    }catch(e){console.error(e);toast(cloudErrMsg(e),{ms:6000});return false}
  }
};
window.Mat=Mat;

/* ============================== Administração > Configurações > Lista de matéria-prima ============================== */
const A=()=>S.matAdm=S.matAdm||{q:'',fam:'',un:'',ord:'desc',lim:ADM_PAGE};
function admRows(){
  const st=A(),found=matQuery(Mats.list,st),shown=found.slice(0,st.lim),edit=isAdmin();
  const rows=shown.map(x=>`<div class="mat-adm ${x.active?'':'off'}"><input class="ma-cod" aria-label="Código do Nomus" data-keep-case value="${esc(x.codigo)}" data-chg="matEdit" data-id="${esc(x.id)}" data-k="codigo" ${edit?'':'disabled'}><input class="ma-des" aria-label="Descrição" data-keep-case value="${esc(x.descricao)}" data-chg="matEdit" data-id="${esc(x.id)}" data-k="descricao" ${edit?'':'disabled'}><input class="ma-un" aria-label="Unidade" data-keep-case list="dl-mat-un" value="${esc(x.unidade)}" data-chg="matEdit" data-id="${esc(x.id)}" data-k="unidade" ${edit?'':'disabled'}><input class="ma-gr" aria-label="Família" data-keep-case list="dl-mat-gr" value="${esc(x.familia)}" data-chg="matEdit" data-id="${esc(x.id)}" data-k="familia" placeholder="Sem família" ${edit?'':'disabled'}><input class="ma-c2" aria-label="Código secundário (informação complementar)" data-keep-case value="${esc(x.codigo2||'')}" placeholder="Cód. secundário" data-chg="matEdit" data-id="${esc(x.id)}" data-k="codigo2" ${edit?'':'disabled'}><label class="switch"><input type="checkbox" data-chg="matActive" data-id="${esc(x.id)}" ${x.active?'checked':''} ${edit?'':'disabled'}><span class="track"></span><span>Ativo</span></label>${edit?`<button class="iconb" data-act="matDel" data-id="${esc(x.id)}" aria-label="Excluir ${esc(x.codigo)}">${ic('trash')}</button>`:''}</div>`).join('');
  const more=found.length>shown.length?`<div class="actions" style="justify-content:center;margin-top:10px"><button class="btn" data-act="matMore">Mostrar mais ${Math.min(ADM_PAGE,found.length-shown.length)} (faltam ${found.length-shown.length})</button></div>`:'';
  return{html:rows?rows+more:'<p class="hint">Nada encontrado.</p>',count:`${found.length===Mats.list.length?plural(found.length,'item cadastrado','itens cadastrados'):plural(found.length,'item encontrado','itens encontrados')}${found.length>shown.length?` · mostrando ${shown.length}`:''}`};
}
window.vMaterialsAdmin=function(){
  const edit=isAdmin(),st=A(),fams=Mats.families(),r=admRows();
  const note=CLOUD&&Mats.missing?'<p class="errbox" style="margin-bottom:12px">A tabela da lista de matéria-prima ainda não existe na nuvem. Peça ao responsável técnico para aplicar a migração.</p>':(CLOUD&&Mats.src!=='cloud'?'<p class="errbox" style="margin-bottom:12px">Mostrando a cópia deste aparelho. Entre com internet para carregar e editar a lista da nuvem.</p>':'');
  return `${note}<div class="panel"><div class="ph-row"><div><h2>Lista de matéria-prima (Nomus)</h2><p class="hint" style="margin:0">É daqui que o perito escolhe a matéria-prima ao adicionar em um componente: ele só marca, não digita. Só o administrador adiciona, edita ou exclui. Itens desativados deixam de aparecer para escolha, mas continuam nos documentos já feitos. O código secundário aparece como informação complementar.</p></div><div class="actions"><button class="btn" data-act="matImport">${ic('doc')}Importar planilha</button><button class="btn" data-act="matExport">${ic('download')}Exportar CSV</button></div></div>
${edit?`<form class="mat-add" data-submit="matAdmAdd"><div class="field"><label for="ma-cod">Código do Nomus</label><input id="ma-cod" name="codigo" data-keep-case autocomplete="off" placeholder="01.03.1.1.1.1.2.15.19"></div><div class="field ma-add-d"><label for="ma-des">Descrição</label><input id="ma-des" name="descricao" data-keep-case autocomplete="off" placeholder="PARAFUSO SEXTAVADO DIN933 CL 8.8 … M10 x 30"></div><div class="field"><label for="ma-gr">Família</label><input id="ma-gr" name="familia" list="dl-mat-gr" data-keep-case autocomplete="off" placeholder="PARAFUSO"></div><div class="field"><label for="ma-un">Unidade</label><input id="ma-un" name="unidade" list="dl-mat-un" data-keep-case autocomplete="off" value="un"></div><div class="field"><label for="ma-c2">Cód. secundário</label><input id="ma-c2" name="codigo2" data-keep-case autocomplete="off" placeholder="opcional"></div><button class="btn primary" type="submit">${ic('plus')}Adicionar</button></form>`:''}
<datalist id="dl-mat-gr">${fams.map(([g])=>`<option value="${esc(g==='SEM FAMÍLIA'?'':g)}">`).join('')}</datalist><datalist id="dl-mat-un">${['un','pç','kg','m','mm','cm','m²','L','mL','cj','jogo','galão','lata','cartela'].map(u=>`<option value="${u}">`).join('')}</datalist>
<div style="margin-top:14px" id="mat-filt">${filtersHTML('adm',st,Mats.list)}</div>
${searchHTML('mat-q','matAdmQ',st.q)}
<p class="hint" id="mat-count" style="margin:8px 0">${r.count}</p>
<div class="mat-adm-list" id="mat-rows">${r.html}</div></div>`;
};
function refreshAdm(){const r=admRows(),el=document.getElementById('mat-rows'),c=document.getElementById('mat-count');if(el)el.innerHTML=r.html;if(c)c.textContent=r.count}
function csv(){
  const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  return '﻿'+['Código;Cód. secundário;Descrição;Unidade;Família;Ativo',...Mats.list.map(x=>[q(x.codigo),q(x.codigo2),q(x.descricao),q(x.unidade),q(x.familia),x.active?'sim':'não'].join(';'))].join('\r\n');
}

/* ---- importar a planilha do Nomus ----
   Aceita o relatório de produtos do Nomus (Código do produto | Descrição do produto | Unidade de medida | Família de produto)
   e o formato antigo (uma aba por família, colunas Código do produto | [Cód. Secundário] | Descrição | U.M.). */
const HDR={codigo:/^codigo( do produto)?$/,codigo2:/^cod\.? secundario$|^codigo secundario$/,descricao:/^descricao( do produto)?$/,unidade:/^u\.?\s?m\.?$|^unidade( de medida)?$/,familia:/^familia( de produto)?$|^grupo$/};
async function readSheets(file){
  if(!window.XLSX)throw new Error('A biblioteca de planilhas não carregou. Recarregue a página.');
  const wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),out=[],avisos=[];
  for(const name of wb.SheetNames){
    const rows=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:'',blankrows:false});
    let hi=-1,cols={};
    for(let i=0;i<Math.min(rows.length,15)&&hi<0;i++){
      const c={};rows[i].forEach((h,j)=>{const f=fold(h).trim();for(const [k,re] of Object.entries(HDR))if(re.test(f)&&!(k in c))c[k]=j});
      if('codigo'in c&&'descricao'in c){hi=i;cols=c}
    }
    if(hi<0){avisos.push(`A aba “${name}” foi ignorada: não achei as colunas “Código do produto” e “Descrição”.`);continue}
    out.push({aba:norm(name),temFamilia:'familia'in cols,rows:rows.slice(hi+1).map(r=>({codigo:r[cols.codigo],codigo2:'codigo2'in cols?r[cols.codigo2]:'',descricao:r[cols.descricao],unidade:'unidade'in cols?r[cols.unidade]:'UNIDADE',familia:'familia'in cols?r[cols.familia]:''}))});
  }
  return{sheets:out,avisos};
}
/* limpa e confere o arquivo; devolve o que vai ser feito e os avisos para o administrador */
function analisar(sheets){
  const itens=[],avisos={codigoAjustado:[],repetidasIguais:0,conflitoCodigo:[],descRepetida:[],ignoradas:0,semFamilia:0};
  const porCodigo=new Map();
  for(const sh of sheets)for(const r of sh.rows){
    const bruto=String(r.codigo??''),codigo=cleanCode(bruto),descricao=cleanDesc(r.descricao);
    if(!codigo||!descricao){if(bruto.trim()||String(r.descricao??'').trim())avisos.ignoradas++;continue}
    if(codigo!==bruto.trim())avisos.codigoAjustado.push(`${bruto.trim()} → ${codigo}`);
    const familia=cleanFam(sh.temFamilia?r.familia:sh.aba)||'';
    if(!familia)avisos.semFamilia++;
    const it={codigo,codigo2:norm(r.codigo2),descricao,unidade:mapUn(r.unidade),familia};
    const ja=porCodigo.get(fold(codigo));
    if(ja){if(fold(ja.descricao)===fold(descricao))avisos.repetidasIguais++;else avisos.conflitoCodigo.push(`${codigo}: “${ja.descricao}” × “${descricao}”`);continue}
    porCodigo.set(fold(codigo),it);itens.push(it);
  }
  const pd=new Map();for(const it of itens){const k=fold(it.descricao);(pd.get(k)||pd.set(k,[]).get(k)).push(it)}
  for(const l of pd.values())if(l.length>1)avisos.descRepetida.push(l.map(x=>x.codigo).join(' e ')+': '+l[0].descricao);
  return{itens,avisos};
}
window.matAnalisar=analisar;
function plano(itens){
  const add=[],upd=[],same=[];
  for(const it of itens){
    const cur=Mats.list.find(x=>fold(x.codigo)===fold(it.codigo));
    if(!cur){add.push(it);continue}
    const ch=cur.descricao!==it.descricao||(cur.codigo2||'')!==it.codigo2||cur.unidade!==it.unidade||(cur.familia||'')!==it.familia;
    if(ch)upd.push({...it,id:cur.id});else same.push(it);
  }
  return{add,upd,same};
}
const lista=(arr,n=6)=>arr.slice(0,n).map(esc).join('<br>')+(arr.length>n?`<br>… e mais ${arr.length-n}`:'');
function previaHTML(a,p,sheets){
  const porFam=new Map();for(const it of a.itens)porFam.set(it.familia||'SEM FAMÍLIA',(porFam.get(it.familia||'SEM FAMÍLIA')||0)+1);
  const top=[...porFam.entries()].sort((x,y)=>y[1]-x[1]),av=a.avisos;
  return `<b>Prévia:</b> ${plural(a.itens.length,'item válido','itens válidos')} em ${plural(porFam.size,'família','famílias')} (${top.slice(0,6).map(([g,n])=>`${esc(g)}: ${n}`).join(' · ')}${top.length>6?' · …':''}).<br><b>${p.add.length}</b> novos, <b>${p.upd.length}</b> atualizados, ${p.same.length} já iguais. Nada é excluído.`
   +(av.codigoAjustado.length?`<details class="imp-w"><summary>${plural(av.codigoAjustado.length,'código com espaço foi corrigido','códigos com espaço foram corrigidos')}</summary>${lista(av.codigoAjustado)}<br><small>Confira se o código no Nomus é mesmo assim.</small></details>`:'')
   +(av.descRepetida.length?`<details class="imp-w"><summary>${plural(av.descRepetida.length,'descrição repetida com códigos diferentes (todos entram)','descrições repetidas com códigos diferentes (todos entram)')}</summary>${lista(av.descRepetida)}</details>`:'')
   +(av.conflitoCodigo.length?`<details class="imp-w" open><summary>${plural(av.conflitoCodigo.length,'código repetido com descrição diferente (entrou só o primeiro)','códigos repetidos com descrição diferente (entrou só o primeiro)')}</summary>${lista(av.conflitoCodigo)}</details>`:'')
   +(av.repetidasIguais?`<br>${plural(av.repetidasIguais,'linha repetida idêntica ignorada','linhas repetidas idênticas ignoradas')}.`:'')
   +(av.ignoradas?`<br>${plural(av.ignoradas,'linha sem código ou sem descrição ignorada','linhas sem código ou sem descrição ignoradas')}.`:'')
   +(av.semFamilia?`<br>${plural(av.semFamilia,'item sem família','itens sem família')}.`:'')
   +(sheets.avisos.length?`<br>${sheets.avisos.map(esc).join('<br>')}`:'');
}
Object.assign(MX.act,{
  matDel(el){Mat.remove(el.dataset.id)},
  matMore(){A().lim+=ADM_PAGE;refreshAdm()},
  matExport(){
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv()],{type:'text/csv;charset=utf-8'}));
    a.download='materia-prima-minc-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(a);a.click();a.remove();
  },
  /* botão % ao lado da busca: insere o sinal onde está o cursor */
  pctIns(el){
    const i=document.getElementById(el.dataset.for);if(!i)return;
    const a=i.selectionStart??i.value.length,b=i.selectionEnd??a;
    i.value=i.value.slice(0,a)+'%'+i.value.slice(b);i.focus();try{i.setSelectionRange(a+1,a+1)}catch{}
    i.dispatchEvent(new Event('input',{bubbles:true}));
  },
  matImport(){
    if(!isAdmin()){toast('Só o administrador ou o gestor altera a lista de matéria-prima.');return}
    dialog(`<form class="dlg-body" data-submit="matImport" data-step="0"><h2>Importar planilha do Nomus</h2><p>Escolha o arquivo (.xlsx ou .csv) do relatório de produtos. Colunas lidas: <b>Código do produto</b>, <b>Descrição do produto</b>, <b>Unidade de medida</b> e <b>Família de produto</b> (e <b>Cód. Secundário</b>, se existir). Itens com o mesmo código são atualizados; os novos entram. <b>Nada é excluído.</b></p><div class="field"><label for="mi-f">Arquivo</label><input id="mi-f" name="f" type="file" accept=".xlsx,.xls,.csv" required></div><div id="mi-prev" class="hint" aria-live="polite"></div><div class="actions end"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit" id="mi-go">Ver prévia</button></div></form>`);
  }
});
Object.assign(MX.sub,{
  matAdmAdd(f){const e=f.elements;Mat.add({codigo:e.codigo.value,codigo2:e.codigo2.value,descricao:e.descricao.value,unidade:e.unidade.value,familia:e.familia.value}).then(ok=>{if(ok){const n=document.getElementById('ma-cod');n&&n.focus()}})},
  async matImport(f){
    const go=f.querySelector('#mi-go'),prev=f.querySelector('#mi-prev'),file=f.elements.f.files[0];
    if(!file){prev.textContent='Escolha o arquivo.';return}
    go.setAttribute('aria-busy','true');
    try{
      if(f.dataset.step==='0'){
        const sheets=await readSheets(file),a=analisar(sheets.sheets);
        if(!a.itens.length){prev.innerHTML='Nenhum item reconhecido.'+(sheets.avisos.length?'<br>'+sheets.avisos.map(esc).join('<br>'):'');return}
        const p=plano(a.itens);f._plan={a,p};f.dataset.step='1';
        prev.innerHTML=previaHTML(a,p,sheets);
        go.textContent=`Confirmar importação (${p.add.length+p.upd.length})`;go.disabled=!(p.add.length+p.upd.length);
        f.elements.f.addEventListener('change',()=>{f.dataset.step='0';go.disabled=false;go.textContent='Ver prévia';prev.textContent='';f._plan=null},{once:true});
        return;
      }
      if(!await guard())return;
      const {p}=f._plan;
      if(!CLOUD){
        p.add.forEach(it=>Mats.list.push(Mats.prep({id:uid('lmt'),...it,active:true})));
        p.upd.forEach(it=>{const cur=Mats.list.find(x=>x.id===it.id);Object.assign(cur,{codigo2:it.codigo2,descricao:it.descricao,unidade:it.unidade,familia:it.familia});Mats.prep(cur)});
        await Mats.persist();
      }else{
        for(let i=0;i<p.add.length;i+=200){const r=await SB.from('catalog_materials').insert(p.add.slice(i,i+200).map(it=>toRow({...it,active:true})));if(r.error)throw r.error;go.textContent=`Gravando… ${Math.min(i+200,p.add.length)}/${p.add.length}`}
        for(const it of p.upd){const r=await SB.from('catalog_materials').update({codigo2:it.codigo2||null,descricao:it.descricao,unidade:it.unidade,familia:it.familia||null}).eq('id',it.id);if(r.error)throw r.error}
        await Mats.bump();await Mats.refresh(true);
      }
      closeDialog(f.closest('dialog'));renderMain();
      toast(`Importação concluída: ${p.add.length} novos, ${p.upd.length} atualizados.`,{ms:6000});
    }catch(e){console.error(e);prev.innerHTML=`<span style="color:var(--danger,#b00020)">${esc(e.code==='23505'?dupMsg:(e.message||cloudErrMsg(e)))}</span>`}
    finally{go.removeAttribute('aria-busy')}
  }
});
Object.assign(MX.chg,{
  matEdit(el){Mat.update(el.dataset.id,{[el.dataset.k]:el.value})},
  matActive(el){Mat.update(el.dataset.id,{active:el.checked})},
  /* filtros: administração (w=adm) e seletor (w=pick) */
  matFilt(el){
    const k=el.dataset.k;
    if(el.dataset.w==='adm'){const st=A();st[k]=el.value;st.lim=ADM_PAGE;refreshAdm()}
    else{const f=el.closest('form');f._st[k]=el.value;f._st.lim=SHOW;pickRows(f)}
  }
});
Object.assign(MX.inp,{
  matAdmQ(el){const st=A();st.q=el.value;st.lim=ADM_PAGE;refreshAdm()}
});

/* ============================== Escolha da matéria-prima no componente ============================== */
const has=(c,x)=>c.materials.some(m=>m.tipo==='mp'&&m.materialId===x.id);
const leafOf=x=>({...newLeaf('mp'),materialId:x.id,raw:x.descricao,material:'',dimensao:'',codigo:x.codigo,codigo2:x.codigo2||'',familia:'',famNomus:x.familia||'',semCadastro:false,unit:x.unidade||'un',qty:'1'});
function pickRows(f){
  const c=C(f.dataset.cid),st=f._st,found=matQuery(Mats.active(),st),shown=found.slice(0,st.lim);
  const rows=shown.map(x=>{
    const on=c&&has(c,x),sel=f._sel.has(x.id);
    return `<label class="svc-pick ${on?'on':''}"><input type="checkbox" value="${esc(x.id)}" data-chg="matSel" ${on?'checked disabled':sel?'checked':''}><span class="svc-pn"><b>${esc(x.descricao)}</b><small>Cód. ${esc(x.codigo)}${x.codigo2?' · Cód. secundário: '+esc(x.codigo2):''} · ${esc(x.unidade)}${x.familia?' · '+esc(x.familia):''}${on?' · já adicionado':''}</small></span></label>`;
  }).join('');
  const msg=!Mats.list.length?'A lista de matéria-prima está vazia. O administrador cadastra em Administração > Configurações.':!found.length?'Nada encontrado. Tente menos palavras, use % entre elas ou mude o filtro.':'';
  const more=found.length>shown.length?`<div class="actions" style="justify-content:center"><button type="button" class="btn" data-act="matpMore">Mostrar mais (faltam ${found.length-shown.length})</button></div>`:'';
  f.querySelector('#matp-list').innerHTML=(rows||`<p class="hint">${msg}</p>`)+more;
  f.querySelector('#matp-count').textContent=found.length?`${plural(found.length,'item','itens')}${found.length>shown.length?` · mostrando ${shown.length}`:''}`:'';
  const n=f._sel.size;f.querySelector('#matp-go').textContent=n?`Adicionar marcados (${n})`:'Adicionar marcados';
}
Object.assign(MX.act,{
  matPick(el){
    const c=C(el.dataset.cid);if(!c)return;
    const st={q:'',fam:'',un:'',ord:'desc',lim:SHOW};
    const d=dialog(`<form class="dlg-body svc-dlg" data-submit="matAdd" data-cid="${esc(c.id)}"><h2>Adicionar matéria-prima</h2><p>Marque os itens que serão usados neste componente. Nome, código do Nomus e unidade entram prontos; depois você só informa a quantidade.</p>${Mats.list.length?`${filtersHTML('pick',st,Mats.active())}${searchHTML('matp-q','matPickQ','',true)}`:''}<p class="hint" id="matp-count" style="margin:6px 0"></p><div class="svc-picks" id="matp-list"></div><div class="actions" style="justify-content:space-between;margin-top:12px">${Settings.on('mpLivre')?`<button type="button" class="btn ghost" data-act="fichNew" data-cid="${esc(c.id)}">Não encontrei: item sem cadastro</button>`:'<span></span>'}<div class="actions"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit" id="matp-go" ${Mats.list.length?'':'disabled'}>Adicionar marcados</button></div></div></form>`,{cls:'svc-dialog'});
    const f=d.querySelector('form');f._st=st;f._sel=new Set();pickRows(f);
  },
  matpMore(el){const f=el.closest('form');f._st.lim+=SHOW;pickRows(f)}
});
Object.assign(MX.inp,{
  matPickQ(el){const f=el.closest('form');f._st.q=el.value;f._st.lim=SHOW;pickRows(f)}
});
Object.assign(MX.chg,{
  matSel(el){const f=el.closest('form');el.checked?f._sel.add(el.value):f._sel.delete(el.value);const n=f._sel.size;f.querySelector('#matp-go').textContent=n?`Adicionar marcados (${n})`:'Adicionar marcados'}
});
Object.assign(MX.sub,{
  matAdd(f){
    const c=C(f.dataset.cid);if(!c)return;
    const its=Mats.active().filter(x=>f._sel.has(x.id)&&!has(c,x));
    if(!its.length){toast('Marque pelo menos um item.');return}
    its.forEach(x=>c.materials.push(leafOf(x)));
    closeDialog(f.closest('dialog'));S.tc[c.id]=false;changed();renderMain();
    toast(`${plural(its.length,'matéria-prima adicionada','matérias-primas adicionadas')}. Informe a quantidade.`);
  }
});
})();
