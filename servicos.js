/* MINC · Peritagem — Cadastro padronizado de serviços com código do Nomus  (v5.14.0)
   - Lista única de serviços (tabela catalog_external_services, agora com a coluna "codigo").
   - Administração > Configurações > "Lista de serviços": SÓ o administrador adiciona, edita, desativa, exclui, importa e exporta.
   - Nos componentes (aba Componentes e aba Estrutura): "Adicionar serviço" abre a lista para MARCAR os serviços que serão feitos.
     O nome e o código do Nomus entram prontos e não são digitados; a caixa de texto do seletor serve só para BUSCAR. Não existe
     "serviço fora da lista": se faltar um serviço, o administrador o cadastra na lista.
   - Os documentos já feitos guardam uma cópia do nome e do código: editar ou excluir da lista não muda documento antigo.
   Carregado ANTES do app.js: tudo que usa funções do app roda só quando chamado. */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};
MX.sync=MX.sync||[];MX.boot=MX.boot||[];
const isAdmin=()=>CLOUD?S.user?.cloudRole==='admin':S.user?.role==='Administrador';
const norm=s=>String(s??'').trim();
const key=s=>norm(s).toLowerCase();
const byName=(a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR');
const dupMsg='Já existe um serviço com esse nome ou código.';

/* ============================== Operações na lista ============================== */
const all=()=>[...CATALOG.services].sort(byName);
const saveLocal=()=>{try{localStorage.setItem(CAT_KEY,JSON.stringify(CATALOG))}catch{}};
const nextPos=()=>CATALOG.services.reduce((m,x)=>Math.max(m,x.position||0),0)+1;
function clash(name,codigo,exceptId){
  const n=key(name),c=key(codigo);
  return CATALOG.services.find(x=>x.id!==exceptId&&(key(x.name)===n||(c&&key(x.codigo)===c)));
}
/* ações que mudam a lista: só administrador; na nuvem precisam de internet e da lista carregada */
async function guard(){
  if(!isAdmin()){toast('Só o administrador altera a lista de serviços.');return false}
  if(CLOUD){
    if(!navigator.onLine){toast('Sem conexão: a lista de serviços só pode ser editada online.');return false}
    if(CATALOG.src!=='cloud'){toast('Carregue o catálogo da nuvem antes de editar (entre com internet).');return false}
  }
  return true;
}
async function done(r,okMsg){
  if(r&&r.error){toast(r.error.code==='23505'?dupMsg:cloudErrMsg(r.error),{ms:6000});if(CLOUD)await Catalog.refresh().catch(()=>{});renderMain();return false}
  if(CLOUD)await Catalog.refresh().catch(()=>{});
  renderMain();if(okMsg)toast(okMsg);return true;
}
const Svc={
  async add(name,codigo){
    name=norm(name);codigo=norm(codigo);
    if(!name){toast('Informe o nome do serviço.');return false}
    if(!await guard())return false;
    if(clash(name,codigo)){toast(dupMsg);return false}
    if(!CLOUD){CATALOG.services.push({id:uid('lsv'),name,codigo,position:nextPos(),active:true});saveLocal();return done({},'Serviço adicionado.')}
    return done(await SB.from('catalog_external_services').insert({name,codigo:codigo||null,position:nextPos()}),'Serviço adicionado.');
  },
  async update(id,patch){
    const cur=CATALOG.services.find(x=>x.id===id);if(!cur||!await guard())return false;
    const p={...patch};if('name'in p)p.name=norm(p.name);if('codigo'in p)p.codigo=norm(p.codigo);
    if('name'in p&&!p.name){toast('O nome não pode ficar vazio.');renderMain();return false}
    if(('name'in p||'codigo'in p)&&clash('name'in p?p.name:cur.name,'codigo'in p?p.codigo:cur.codigo,id)){toast(dupMsg);renderMain();return false}
    if(!CLOUD){Object.assign(cur,p);saveLocal();return done({})}
    const row={...p};if('codigo'in row)row.codigo=row.codigo||null;
    return done(await SB.from('catalog_external_services').update(row).eq('id',id));
  },
  async remove(id){
    const cur=CATALOG.services.find(x=>x.id===id);if(!cur||!await guard())return false;
    if(!await ask({title:`Excluir “${cur.name}”?`,body:'O serviço sai da lista de escolha. Documentos já feitos não mudam (eles guardam uma cópia do nome e do código). Se quiser só esconder, use o interruptor "Ativo".',ok:'Excluir',danger:true}))return false;
    if(!CLOUD){CATALOG.services=CATALOG.services.filter(x=>x.id!==id);saveLocal();return done({},'Serviço excluído.')}
    return done(await SB.from('catalog_external_services').delete().eq('id',id),'Serviço excluído.');
  }
};
window.Svc=Svc;

/* ============================== Administração > Configurações > Lista de serviços ============================== */
window.vServicesAdmin=function(){
  const edit=isAdmin(),list=all();
  const note=CLOUD&&CATALOG.src!=='cloud'?'<p class="errbox" style="margin-bottom:12px">Mostrando a cópia deste aparelho. Entre com internet para carregar e editar a lista da nuvem.</p>':'';
  const rows=list.map(x=>`<div class="svc-row ${x.active?'':'off'}" data-q="${esc((x.codigo+' '+x.name).toLowerCase())}"><input class="svc-cod" aria-label="Código do Nomus" data-keep-case value="${esc(x.codigo||'')}" placeholder="Sem código" data-chg="svcEdit" data-id="${esc(x.id)}" data-k="codigo" ${edit?'':'disabled'}><input class="svc-nome" aria-label="Nome do serviço" value="${esc(x.name)}" data-chg="svcEdit" data-id="${esc(x.id)}" data-k="name" ${edit?'':'disabled'}><label class="switch"><input type="checkbox" data-chg="svcActive" data-id="${esc(x.id)}" ${x.active?'checked':''} ${edit?'':'disabled'}><span class="track"></span><span>Ativo</span></label>${edit?`<button class="iconb" data-act="svcDel" data-id="${esc(x.id)}" aria-label="Excluir ${esc(x.name)}">${ic('trash')}</button>`:''}</div>`).join('');
  return `${note}<div class="panel"><div class="ph-row"><div><h2>Lista de serviços (Nomus)</h2><p class="hint" style="margin:0">É daqui que o perito escolhe os serviços ao adicionar em um componente: ele só marca, não digita. Só o administrador adiciona, edita ou exclui. Itens desativados deixam de aparecer para escolha, mas continuam nos documentos já feitos.</p></div><div class="actions"><button class="btn" data-act="svcImport">${ic('doc')}Importar lista</button><button class="btn" data-act="svcExport">${ic('download')}Exportar CSV</button></div></div>
${edit?`<form class="svc-add" data-submit="svcAdmAdd"><div class="field"><label for="sa-cod">Código do Nomus</label><input id="sa-cod" name="codigo" data-keep-case autocomplete="off" placeholder="Ex.: 04.02.1.000123"></div><div class="field"><label for="sa-nome">Nome do serviço</label><input id="sa-nome" name="name" autocomplete="off" placeholder="Ex.: SERVIÇO DE CORTE DE CHAPA"></div><button class="btn primary" type="submit">${ic('plus')}Adicionar</button></form>`:''}
<div class="search" style="margin-top:14px">${ic('search')}<input type="search" id="svc-q" placeholder="Buscar por código ou nome…" aria-label="Buscar serviço" data-keep-case data-inp="svcAdmQ"></div>
<p class="hint" id="svc-count" style="margin:8px 0">${plural(list.length,'serviço cadastrado','serviços cadastrados')}</p>
<div class="svc-list" id="svc-list">${rows||'<p class="hint">Nenhum serviço cadastrado. Adicione um ou importe a lista.</p>'}</div></div>`;
};
function filterRows(root,q){
  q=key(q);let n=0;
  root.querySelectorAll('[data-q]').forEach(el=>{const show=!q||el.dataset.q.includes(q);el.hidden=!show;if(show)n++});
  return n;
}
function csv(){
  const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  return '﻿'+['Código;Nome;Ativo',...all().map(x=>[q(x.codigo||''),q(x.name),x.active?'sim':'não'].join(';'))].join('\r\n');
}
/* colar lista: "código ⇥ nome" (Excel), "código;nome" ou só "nome" por linha */
function parseList(txt){
  const out=[],seenC=new Set(),seenN=new Set();let ign=0;
  for(const raw of String(txt||'').split(/\r?\n/)){
    const line=raw.trim();if(!line)continue;
    let parts=line.split(/\t|;/).map(norm);
    let codigo='',name='';
    if(parts.length>=2){codigo=parts[0];name=parts.slice(1).filter(Boolean).join(' ')}else name=parts[0];
    if(/^(c[oó]digo|code)$/i.test(codigo)&&/^(nome|descri)/i.test(name))continue;   // linha de cabeçalho
    if(!name){ign++;continue}
    const kc=key(codigo),kn=key(name);
    if((kc&&seenC.has(kc))||seenN.has(kn)){ign++;continue}
    if(kc)seenC.add(kc);seenN.add(kn);
    out.push({codigo,name});
  }
  return{items:out,ignoradas:ign};
}
/* compara a lista colada com a atual: novos, alterados (mesmo código, outro nome) e iguais */
function plan(items){
  const add=[],upd=[],same=[],conf=[];
  for(const it of items){
    const byCode=it.codigo?CATALOG.services.find(x=>key(x.codigo)===key(it.codigo)):null;
    const byName=CATALOG.services.find(x=>key(x.name)===key(it.name));
    if(byCode){
      if(key(byCode.name)===key(it.name))same.push(it);
      else if(byName&&byName.id!==byCode.id)conf.push(it);
      else upd.push({...it,id:byCode.id});
    }else if(byName){
      if(it.codigo&&!norm(byName.codigo))upd.push({...it,id:byName.id});   // serviço já existia sem código: ganha o código
      else if(it.codigo&&key(byName.codigo)!==key(it.codigo))conf.push(it);
      else same.push(it);
    }else add.push(it);
  }
  return{add,upd,same,conf};
}
Object.assign(MX.act,{
  svcDel(el){Svc.remove(el.dataset.id)},
  svcExport(){
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv()],{type:'text/csv;charset=utf-8'}));
    a.download='servicos-minc-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(a);a.click();a.remove();
  },
  svcImport(){
    if(!isAdmin()){toast('Só o administrador altera a lista de serviços.');return}
    dialog(`<form class="dlg-body" data-submit="svcImport" data-step="0"><h2>Importar lista de serviços</h2><p>Uma linha por serviço: <b>código</b> e <b>nome</b>, separados por tabulação (cole direto do Excel) ou ponto e vírgula. Serviços com o mesmo código são atualizados; os novos são incluídos. Nada é excluído.</p><div class="field"><label for="si-t">Lista</label><textarea id="si-t" name="t" rows="10" data-keep-case placeholder="04.02.1.000123;SERVIÇO DE CORTE DE CHAPA" autofocus></textarea></div><div id="si-prev" class="hint" aria-live="polite"></div><div class="actions end"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit" id="si-go">Ver prévia</button></div></form>`);
  }
});
Object.assign(MX.sub,{
  svcAdmAdd(f){
    Svc.add(f.elements.name.value,f.elements.codigo.value).then(ok=>{if(ok){const n=document.getElementById('sa-cod');n&&n.focus()}});
  },
  async svcImport(f){
    const ta=f.elements.t,prev=f.querySelector('#si-prev'),go=f.querySelector('#si-go');
    const {items,ignoradas}=parseList(ta.value),p=plan(items);
    if(!items.length){prev.textContent='Nenhuma linha reconhecida.';return}
    if(f.dataset.step==='0'){
      f.dataset.step='1';
      prev.innerHTML=`<b>Prévia:</b> ${p.add.length} novos, ${p.upd.length} atualizados, ${p.same.length} já iguais${p.conf.length?`, <span style="color:var(--danger,#b00020)">${p.conf.length} em conflito (código e nome apontam para serviços diferentes: serão ignorados)</span>`:''}${ignoradas?`, ${ignoradas} linha(s) repetida(s) ou vazia(s) ignorada(s)`:''}.`;
      go.textContent=`Confirmar importação (${p.add.length+p.upd.length})`;go.disabled=!(p.add.length+p.upd.length);
      ta.addEventListener('input',()=>{f.dataset.step='0';go.disabled=false;go.textContent='Ver prévia';prev.textContent=''},{once:true});
      return;
    }
    if(!await guard())return;
    go.setAttribute('aria-busy','true');
    try{
      if(!CLOUD){
        p.add.forEach((it,i)=>CATALOG.services.push({id:uid('lsv'),name:it.name,codigo:it.codigo,position:nextPos()+i,active:true}));
        p.upd.forEach(it=>Object.assign(CATALOG.services.find(x=>x.id===it.id),{name:it.name,codigo:it.codigo}));
        saveLocal();
      }else{
        const base=nextPos();
        if(p.add.length){const r=await SB.from('catalog_external_services').insert(p.add.map((it,i)=>({name:it.name,codigo:it.codigo||null,position:base+i})));if(r.error)throw r.error}
        for(const it of p.upd){const r=await SB.from('catalog_external_services').update({name:it.name,codigo:it.codigo||null}).eq('id',it.id);if(r.error)throw r.error}
      }
      closeDialog(f.closest('dialog'));
      await done({},`Importação concluída: ${p.add.length} novos, ${p.upd.length} atualizados.`);
    }catch(e){console.error(e);toast(e.code==='23505'?dupMsg:cloudErrMsg(e),{ms:6000});go.removeAttribute('aria-busy')}
  }
});
Object.assign(MX.chg,{
  svcEdit(el){Svc.update(el.dataset.id,{[el.dataset.k]:el.value})},
  svcActive(el){Svc.update(el.dataset.id,{active:el.checked})}
});
Object.assign(MX.inp,{
  svcAdmQ(el){const n=filterRows(document.getElementById('svc-list'),el.value);const c=document.getElementById('svc-count');if(c)c.textContent=plural(n,'serviço encontrado','serviços encontrados')}
});

/* ============================== Escolha dos serviços no componente ============================== */
const has=(c,sv)=>c.materials.some(m=>m.tipo==='serv'&&(m.serviceId===sv.id));
const leafOf=sv=>({...newLeaf('serv'),serviceId:sv.id,raw:sv.name,codigo:sv.codigo||'',semCadastro:false,qty:'1',unit:'un'});
Object.assign(MX.act,{
  svcPick(el){
    const c=C(el.dataset.cid);if(!c)return;
    const list=Catalog.services().slice().sort(byName);
    const items=list.map(sv=>{const on=has(c,sv);return `<label class="svc-pick ${on?'on':''}" data-q="${esc((sv.codigo+' '+sv.name).toLowerCase())}"><input type="checkbox" name="sv" value="${esc(sv.id)}" ${on?'checked disabled':''}><span class="svc-pn"><b>${esc(sv.name)}</b><small>${sv.codigo?'Cód. '+esc(sv.codigo):'sem código'}${on?' · já adicionado':''}</small></span></label>`}).join('');
    dialog(`<form class="dlg-body svc-dlg" data-submit="svcAdd" data-cid="${esc(c.id)}"><h2>Adicionar serviços</h2><p>Marque os serviços que serão feitos neste item. Nome e código do Nomus entram prontos. A caixa de busca serve só para achar o serviço mais rápido.</p>${list.length?`<div class="search">${ic('search')}<input type="search" id="svcp-q" placeholder="Buscar por código ou nome…" aria-label="Buscar serviço" data-keep-case data-inp="svcPickQ" autocomplete="off"></div><p class="hint" id="svcp-count" style="margin:6px 0">${plural(list.length,'serviço','serviços')} na lista</p><div class="svc-picks" id="svcp-list">${items}</div>`:'<p class="hint">A lista de serviços está vazia. O administrador cadastra em Administração > Configurações.</p>'}<div class="actions end" style="margin-top:12px"><button type="button" class="btn" data-act="closeDlg">Cancelar</button><button class="btn primary" type="submit" ${list.length?'':'disabled'}>Adicionar marcados</button></div></form>`,{cls:'svc-dialog'});
  },
  /* sem "serviço fora da lista": o serviço só entra se estiver na lista; faltando um, o administrador cadastra em Configurações */
});
Object.assign(MX.inp,{
  svcPickQ(el){const root=document.getElementById('svcp-list');if(!root)return;const n=filterRows(root,el.value);const c=document.getElementById('svcp-count');if(c)c.textContent=plural(n,'serviço encontrado','serviços encontrados')}
});
Object.assign(MX.sub,{
  svcAdd(f){
    const c=C(f.dataset.cid);if(!c)return;
    const ids=[...f.querySelectorAll('input[name=sv]:checked:not(:disabled)')].map(x=>x.value);
    if(!ids.length){toast('Marque pelo menos um serviço.');return}
    const svs=Catalog.services().filter(sv=>ids.includes(sv.id)&&!has(c,sv));
    svs.forEach(sv=>c.materials.push(leafOf(sv)));
    closeDialog(f.closest('dialog'));S.tc[c.id]=false;changed();renderMain();
    toast(`${plural(svs.length,'serviço adicionado','serviços adicionados')}.`);
  }
});
})();
