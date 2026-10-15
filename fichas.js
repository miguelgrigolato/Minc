/* MINC · Peritagem — Item sem cadastro: ficha por família + Lista de cadastro  (v5.16.0)
   Quando o funcionário não acha a matéria-prima na lista do Nomus (materiais.js), ele toca em "Não encontrei: item sem cadastro",
   escolhe a FAMÍLIA do Nomus e preenche a ficha dela. Cada família cobra campos diferentes (catalogo.js > MP_FICHAS); o app monta a
   descrição no padrão do Nomus. Esses itens aparecem na Estrutura > "Lista de cadastro" (e na planilha "Para cadastro") para a
   engenharia cadastrar no Nomus. Os campos obrigatórios impedem seguir com a ficha incompleta; "Não se aplica" é uma resposta válida.
   Carregado ANTES do app.js: tudo que usa funções do app roda só quando chamado. */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};
const CAT=()=>window.MINC_CATALOGO||{};
const norm=s=>String(s??'').trim();
const fold=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const NA='—';           // "Não se aplica": conta como respondido, mas some da descrição
const OUTRO='__outro';
const COLL=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});

/* ============================== Regras das fichas ============================== */
const Fich={
  /* ficha da família (compara sem acento/caixa); família sem ficha própria usa a genérica */
  def(fam){
    const F=CAT().MP_FICHAS||{},k=Object.keys(F).find(x=>fold(x)===fold(fam));
    return k?{...F[k],nome:k,propria:true}:{...(CAT().MP_FICHA_GENERICA||{modelo:'{familia} {tipo}',campos:[]}),nome:norm(fam),propria:false};
  },
  /* famílias oferecidas: as do cadastro do Nomus (lista importada) + as que têm ficha própria */
  families(){
    const set=new Map();
    for(const [n] of (window.Mats?Mats.families():[]))if(n&&n!=='SEM FAMÍLIA')set.set(fold(n),n);
    for(const n of Object.keys(CAT().MP_FICHAS||{}))set.set(fold(n),n);
    return [...set.values()].sort(COLL.compare);
  },
  unidade(fam){const U=CAT().MP_UNIDADE_FAMILIA||{},k=Object.keys(U).find(x=>fold(x)===fold(fam));return k?U[k]:'un'},
  /* monta a descrição: {campo} = valor; [ ... ] some se algum campo dentro estiver vazio */
  compose(fam,vals){
    const d=Fich.def(fam),val=k=>{const v=k==='familia'?norm(fam).toUpperCase():norm(vals?.[k]);return v===NA?'':v};
    let out=d.modelo.replace(/\[([^\]]*)\]/g,(_,inner)=>{const toks=[...inner.matchAll(/\{(\w+)\}/g)].map(m=>m[1]);return toks.length&&toks.every(t=>val(t))?inner:''});
    out=out.replace(/\{(\w+)\}/g,(_,k)=>val(k));
    return out.replace(/\s+/g,' ').replace(/\s+([,.])/g,'$1').replace(/(?:\s*[-.]\s*)+$/,'').replace(/\s+x\s*$/i,'').trim();
  },
  /* rótulos dos campos obrigatórios ainda vazios */
  missing(m){
    if(!m||!m.familia)return[];
    const d=Fich.def(m.familia);
    return d.campos.filter(c=>(c.req||c.na)&&emp(m.ficha?.[c.k])).map(c=>c.l);
  },
  /* "Campo: valor; ..." só com o que foi preenchido */
  fichaText(m){
    const d=Fich.def(m.familia);
    return d.campos.map(c=>{const v=norm(m.ficha?.[c.k]);return v&&v!==NA?`${c.l}: ${v}`:''}).filter(Boolean).join('; ');
  },
  /* linhas da lista de cadastro, na ordem do documento: folhas com ficha (por família) e os demais itens marcados "sem cadastro" */
  cadRows(r){
    const com=[],outros=[];
    treeList(r).forEach(({c,no})=>{
      if(c.semCadastro)outros.push({no,comp:c.name,tipo:'Componente',desc:c.name,un:c.unid,qty:c.qtd,obs:c.obs});
      visLeaves(c).forEach(m=>{
        if(m.familia)com.push({no,comp:c.name,familia:m.familia,desc:m.raw,ficha:Fich.fichaText(m),un:m.unit,qty:m.qty,obs:m.obs,falta:Fich.missing(m)});
        else if(m.semCadastro)outros.push({no,comp:c.name,tipo:leafKind(m),desc:m.raw,un:m.unit,qty:m.qty,obs:m.obs});
      });
    });
    return{com,outros};
  }
};
window.Fich=Fich;

/* ============================== Diálogo da ficha ============================== */
const esc2=s=>esc(String(s??''));
function fieldHTML(c,v){
  const na=v===NA,known=c.t==='sel'&&(c.o||[]).includes(v),outro=c.t==='sel'&&!na&&norm(v)&&!known;
  const req=(c.req||c.na)?'<span class="req" title="Obrigatório"> *</span>':'';
  const flag=c.na?`<label class="fi-na"><input type="checkbox" data-na="${c.k}" ${na?'checked':''}> Não se aplica</label>`:'';
  let ctl;
  if(c.t==='sel')ctl=`<select data-fk="${c.k}" ${na?'disabled':''}><option value="">Escolha…</option>${(c.o||[]).map(o=>`<option ${v===o?'selected':''}>${esc2(o)}</option>`).join('')}<option value="${OUTRO}" ${outro?'selected':''}>Outro (digitar)</option></select><input type="text" class="fi-o" data-fo="${c.k}" data-keep-case placeholder="Digite" value="${outro?esc2(v):''}" ${outro?'':'hidden'} ${na?'disabled':''}>`;
  else ctl=`<input type="text" data-fk="${c.k}" data-keep-case ${c.ph?`placeholder="${esc2(c.ph)}"`:''} value="${na?'':esc2(v)}" autocomplete="off" ${na?'disabled':''}>`;
  return `<div class="field fi-f" data-f="${c.k}"><label>${esc2(c.l)}${req}</label>${ctl}${flag}</div>`;
}
/* lê os valores do formulário */
function readVals(f,fam){
  const d=Fich.def(fam),v={};
  for(const c of d.campos){
    const box=f.querySelector(`[data-f="${c.k}"]`);if(!box)continue;
    const na=box.querySelector('[data-na]')?.checked;
    if(na){v[c.k]=NA;continue}
    const el=box.querySelector('[data-fk]');let x=norm(el?.value);
    if(c.t==='sel'&&x===OUTRO)x=norm(box.querySelector('[data-fo]')?.value);
    v[c.k]=x;
  }
  return v;
}
function renderFields(f,fam,vals){
  const box=f.querySelector('#fi-fields');
  if(!fam){box.innerHTML='<p class="hint">Escolha a família para ver os campos.</p>';update(f);return}
  const d=Fich.def(fam);
  box.innerHTML=(d.propria?'':`<p class="hint" style="margin-top:0">Esta família ainda não tem ficha própria: preencha a descrição do item e o que souber (material, norma, medidas).</p>`)+`<div class="fi-grid">${d.campos.map(c=>fieldHTML(c,vals?.[c.k]??'')).join('')}</div>`;
  const u=f.querySelector('#fi-un');if(u&&!f.dataset.edit){const un=Fich.unidade(fam);if([...u.options].every(o=>o.value!==un))u.add(new Option(un,un));u.value=un}
  update(f);
}
function update(f){
  const fam=f.querySelector('#fi-fam').value,prev=f.querySelector('#fi-prev');
  if(!fam){prev.textContent='—';return}
  const vals=readVals(f,fam);
  f.querySelectorAll('.fi-f').forEach(b=>{const k=b.dataset.f,sel=b.querySelector('select'),o=b.querySelector('[data-fo]');if(sel&&o){o.hidden=sel.value!==OUTRO;}b.classList.remove('bad')});
  prev.textContent=Fich.compose(fam,vals)||'—';
}
function openFicha({cid,j}){
  const c=C(cid);if(!c)return;
  const m=j!=null?c.materials[j]:null,fams=Fich.families(),proprias=new Set(Object.keys(CAT().MP_FICHAS||{}).map(fold));
  const fam0=m?.familia||'';
  const optF=n=>`<option value="${esc2(n)}" ${fold(n)===fold(fam0)?'selected':''}>${esc2(n)}</option>`;
  const d=dialog(`<form class="dlg-body svc-dlg fich-dlg" data-submit="fichSave" data-cid="${esc2(cid)}" ${j!=null?`data-j="${j}" data-edit="1"`:''}><h2>${m?'Editar ficha do item sem cadastro':'Item sem cadastro'}</h2><p>Escolha a <b>família</b> do Nomus e preencha a ficha. A descrição é montada sozinha, no padrão do cadastro, e vai para a Lista de cadastro da Estrutura.</p><div class="field"><label for="fi-fam">Para qual família é o cadastro? <span class="req"> *</span></label><select id="fi-fam" data-chg="fichFam"><option value="">Escolha a família…</option><optgroup label="Famílias com ficha completa">${fams.filter(n=>proprias.has(fold(n))).map(optF).join('')}</optgroup><optgroup label="Outras famílias">${fams.filter(n=>!proprias.has(fold(n))).map(optF).join('')}</optgroup></select></div><div id="fi-fields"></div><div class="fich-prev" aria-live="polite"><small>Descrição que será cadastrada no Nomus</small><b id="fi-prev">—</b></div><div class="grid g-mat2" style="margin-top:12px"><div class="field"><label for="fi-q">Quantidade <span class="req"> *</span></label><input id="fi-q" type="number" step="any" inputmode="decimal" value="${esc2(m?.qty??'1')}"></div><div class="field"><label for="fi-un">Unidade</label><select id="fi-un">${withLegacy(UNITS,m?.unit||'un').map(o=>`<option ${(m?.unit||'un')===o?'selected':''}>${esc2(o)}</option>`).join('')}</select></div><div class="field wide"><label for="fi-obs">Observação <span class="muted">(opcional)</span></label><input id="fi-obs" type="text" data-keep-case value="${esc2(m?.obs||'')}"></div></div><div class="actions end" style="margin-top:14px"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit">${m?'Salvar ficha':'Adicionar à lista de cadastro'}</button></div></form>`,{cls:'svc-dialog'});
  const f=d.querySelector('form');
  f.addEventListener('input',()=>update(f));
  f.addEventListener('change',e=>{
    if(e.target.matches('[data-na]')){const b=e.target.closest('.fi-f');b.querySelectorAll('[data-fk],[data-fo]').forEach(x=>x.disabled=e.target.checked)}
    update(f);
  });
  f._fam=m?m.familia:'';
  if(m)renderFields(f,m.familia,m.ficha);else renderFields(f,'',{});
}
Object.assign(MX.act,{
  fichNew(el){const cid=el.dataset.cid;closeDialog(el.closest('dialog'));setTimeout(()=>openFicha({cid}),140)},
  fichEdit(el){openFicha({cid:el.dataset.cid,j:+el.dataset.j})},
  fichCopy(el){
    const r=cur(),{com}=Fich.cadRows(r);
    const t=com.map(x=>[x.familia,x.desc,x.un].join('\t')).join('\n');
    (navigator.clipboard?.writeText(t)||Promise.reject()).then(()=>toast('Lista copiada: cole no Excel ou no Nomus.'),()=>toast('Não foi possível copiar neste aparelho.'));
  }
});
Object.assign(MX.chg,{
  fichFam(el){
    const f=el.closest('form'),fam=el.value;
    f._fam=fam;renderFields(f,fam,{});   // trocar de família começa a ficha do zero (as opções mudam de uma família para outra)
  }
});
Object.assign(MX.sub,{
  fichSave(f){
    const c=C(f.dataset.cid);if(!c)return;
    const fam=f.querySelector('#fi-fam').value;
    if(!fam){toast('Escolha a família do cadastro.');f.querySelector('#fi-fam').focus();return}
    const vals=readVals(f,fam),d=Fich.def(fam);
    const miss=d.campos.filter(x=>(x.req||x.na)&&emp(vals[x.k]));
    f.querySelectorAll('.fi-f').forEach(b=>b.classList.toggle('bad',miss.some(x=>x.k===b.dataset.f)));
    const qty=norm(f.querySelector('#fi-q').value);
    if(miss.length){toast('Falta preencher: '+miss.map(x=>x.l).join(', ')+'.',{ms:6000});f.querySelector('.fi-f.bad select,.fi-f.bad input')?.focus();return}
    if(!(num(qty)>0)){toast('Informe a quantidade.');f.querySelector('#fi-q').focus();return}
    const raw=Fich.compose(fam,vals);
    if(emp(raw)){toast('A descrição ficou vazia.');return}
    const patch={familia:fam,ficha:vals,raw,qty,unit:f.querySelector('#fi-un').value,obs:norm(f.querySelector('#fi-obs').value),semCadastro:true,materialId:null,codigo:'',codigo2:'',material:'',dimensao:''};
    if(f.dataset.edit)Object.assign(c.materials[+f.dataset.j],patch);
    else c.materials.push({...newLeaf('mp'),...patch});
    closeDialog(f.closest('dialog'));S.tc[c.id]=false;changed();renderMain();
    toast(f.dataset.edit?'Ficha atualizada.':'Item sem cadastro adicionado. Ele entra na Lista de cadastro da Estrutura.',{ms:5000});
  }
});

/* ============================== Estrutura > Lista de cadastro ============================== */
window.vCad=function(r){
  const {com,outros}=Fich.cadRows(r),fams=new Set(com.map(x=>x.familia)).size;
  const t1=com.length?`<div class="tw"><table class="tbl"><thead><tr><th>Item</th><th>Componente</th><th>Família</th><th>Descrição para o cadastro no Nomus</th><th>Ficha</th><th>Un.</th><th>Qtd.</th><th>Obs.</th></tr></thead><tbody>${[...com].sort((a,b)=>COLL.compare(a.familia,b.familia)||COLL.compare(a.desc,b.desc)).map(x=>`<tr><td>${esc(x.no)}</td><td class="wrap">${esc(x.comp)}</td><td><b>${esc(x.familia)}</b></td><td class="wrap"><b>${esc(x.desc)}</b>${x.falta.length?`<br><span class="pend-t">ficha incompleta: ${esc(x.falta.join(', '))}</span>`:''}</td><td class="wrap muted">${esc(x.ficha)}</td><td>${esc(x.un)}</td><td>${esc(x.qty)}</td><td class="wrap">${esc(x.obs)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><p>Nenhum item sem cadastro com ficha. Quando o perito não achar uma matéria-prima na lista, a ficha dela aparece aqui.</p></div>';
  const t2=outros.length?`<h3 style="margin:18px 0 8px;font-size:16px">Outros itens marcados “Não tem cadastro” (sem ficha)</h3><div class="tw"><table class="tbl"><thead><tr><th>Item</th><th>Componente</th><th>Tipo</th><th>Descrição</th><th>Un.</th><th>Qtd.</th><th>Obs.</th></tr></thead><tbody>${outros.map(x=>`<tr><td>${esc(x.no)}</td><td class="wrap">${esc(x.comp)}</td><td>${esc(x.tipo)}</td><td class="wrap">${esc(x.desc)}</td><td>${esc(x.un)}</td><td>${esc(x.qty)}</td><td class="wrap">${esc(x.obs)}</td></tr>`).join('')}</tbody></table></div>`:'';
  return `<div class="panel"><div class="ph-row"><div><p class="hint" style="margin:0">Itens que o perito não achou na lista do Nomus. A engenharia cadastra cada um no Nomus usando a família e a descrição abaixo, que já seguem o padrão do cadastro.</p><b>${plural(com.length,'item com ficha','itens com ficha')}${com.length?` · ${plural(fams,'família','famílias')}`:''}${outros.length?` · ${plural(outros.length,'outro item sem ficha','outros itens sem ficha')}`:''}</b></div><div class="actions">${window.cadBtn?cadBtn(r.id):''}${com.length?`<button class="btn" data-act="fichCopy">${ic('doc')}Copiar lista</button>`:''}</div></div>${t1}${t2}</div>`;
};
})();
