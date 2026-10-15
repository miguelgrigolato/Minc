/* MINC ServiceHub — Baixa da Lista de cadastro (v5.25.0)
   Item que o perito marcou "sem cadastro" (ficha por família) deixa de ser pendência quando o cadastro é feito no Nomus e a
   lista do app é atualizada: o app compara a descrição do item com a lista e liga o código do Nomus ao item.
   - Descrição IGUAL (ignorando maiúsculas, acento, espaço e pontuação) e uma única correspondência: vincula sozinho
     (Configurações > "Vincular sozinho…"), roda quando gestor/administrador abre o app.
   - PARECIDO (mesmos números e medidas, texto quase igual): só vincula com a confirmação do gestor.
   Item vinculado vira matéria-prima da lista (código, descrição e unidade do Nomus; quantidade e observação ficam) e sai da Lista de cadastro.
   Carregado depois do materiais.js e antes do app.js. */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};
MX.sync=MX.sync||[];MX.boot=MX.boot||[];

const nz=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const compact=s=>nz(s).replace(/ /g,'');
const fam=f=>String(f??'').replace(/\s+/g,' ').trim().toUpperCase();
const mgr=()=>typeof isManager==='function'&&isManager();
const info=new WeakMap();   // dados de comparação de cada item da lista (não vai para o armazenamento)
const inf=x=>{let i=info.get(x);if(!i){const t=nz(x.descricao).split(' ');i={cn:compact(x.descricao),tk:new Set(t),nums:t.filter(w=>/\d/.test(w)).sort().join('|')};info.set(x,i)}return i};
const dice=(A,B)=>{if(!A.size||!B.size)return 0;let n=0;A.forEach(w=>{if(B.has(w))n++});return 2*n/(A.size+B.size)};

const Cad={
  n:0,igual:0,busy:false,
  live(){return(typeof PROCS!=='undefined'?PROCS:[]).filter(p=>!p.deletedAt)},
  /* todos os itens "sem cadastro" de todos os processos */
  pendentes(procId){
    const out=[];
    for(const p of this.live()){if(procId&&p.id!==procId)continue;
      (p.components||[]).forEach(c=>(c.materials||[]).forEach((m,j)=>{if(m.semCadastro&&m.tipo==='mp'&&String(m.raw||'').trim())out.push({p,c,j,m})}));}
    return out;
  },
  /* itens da lista que podem ser o mesmo produto */
  achar(m){
    const lista=(window.Mats&&Mats.list?Mats.list:[]).filter(x=>x.active!==false);
    const f=fam(m.familia||m.famNomus);
    const pool=f?lista.filter(x=>fam(x.familia)===f):lista;
    const ta=nz(m.raw).split(' '),cn=compact(m.raw),tk=new Set(ta),nums=ta.filter(w=>/\d/.test(w)).sort().join('|');
    const igual=pool.filter(x=>inf(x).cn===cn);
    if(igual.length)return igual.slice(0,3).map(x=>({x,nivel:'igual'}));
    const par=[];
    for(const x of pool){const i=inf(x);if(i.nums===nums){const d=dice(tk,i.tk);if(d>=.8)par.push({x,nivel:'parecido',d})}}
    return par.sort((a,b)=>b.d-a.d).slice(0,3);
  },
  achados(procId){return this.pendentes(procId).map(e=>({...e,cands:this.achar(e.m)})).filter(e=>e.cands.length)},
  vincular(e,x){
    const {p,m}=e;
    Object.assign(m,{materialId:x.id,raw:x.descricao,codigo:x.codigo,codigo2:x.codigo2||'',familia:'',famNomus:x.familia||'',semCadastro:false,unit:x.unidade||m.unit,material:'',dimensao:''});
    delete m.ficha;
    touch(p);
  },
  /* confere tudo; vincula sozinho os idênticos únicos (se ligado) */
  async verificar({silencioso=false}={}){
    if(this.busy||!window.Mats||!Mats.list.length)return 0;
    this.busy=true;
    try{
      let ach=this.achados(),auto=0;
      if(mgr()&&window.Settings&&Settings.on('cadAuto')){
        for(const e of ach){if(e.cands.length===1&&e.cands[0].nivel==='igual'){this.vincular(e,e.cands[0].x);auto++}}
        if(auto){ach=this.achados();
          toast(`${auto} ${auto===1?'item sem cadastro foi vinculado':'itens sem cadastro foram vinculados'} ao código do Nomus.`,{ms:7000});
          if(typeof renderMain==='function'&&S.user)try{renderMain()}catch{}}
      }
      this.n=ach.length;this.igual=ach.filter(e=>e.cands.some(c=>c.nivel==='igual')).length;
      const b=document.querySelector('.bell');if(b&&window.bellBtn)b.outerHTML=window.bellBtn();
      return auto;
    }finally{this.busy=false}
  }
};
window.Cad=Cad;
MX.sync.push(async()=>{if(mgr())Cad.verificar().catch(e=>console.error('cadastros',e));return false});
MX.boot.push(()=>{setTimeout(()=>{if(mgr())Cad.verificar().catch(()=>{})},4000)});

const desc=m=>esc(m.raw);
const badge=n=>n==='igual'?'<span class="badge st-green">Igual</span>':'<span class="badge st-amber">Parecido</span>';
function dlgBody(procId){
  const ach=Cad.achados(procId),pend=Cad.pendentes(procId).length;
  const iguais=ach.filter(e=>e.cands.length===1&&e.cands[0].nivel==='igual').length;
  const rows=ach.slice(0,80).map((e,i)=>`<li class="doc"><div class="doc-h"><b>${desc(e.m)}</b><small>${esc(e.m.familia||e.m.famNomus||'sem família')} · qtd ${esc(e.m.qty)} ${esc(e.m.unit)}</small></div><div class="doc-m">Processo ${esc(e.p.process)||'—'} · ${esc(e.p.equipamento)||'sem equipamento'} · componente “${esc(e.c.name)||'sem nome'}”</div>${e.cands.map(c=>`<div class="cad-c">${badge(c.nivel)}<span><b>${esc(c.x.codigo)}</b> — ${esc(c.x.descricao)} <small>(${esc(c.x.unidade)})</small></span><button class="btn ${c.nivel==='igual'?'primary':''}" data-act="cadVincular" data-pid="${esc(e.p.id)}" data-cid="${esc(e.c.id)}" data-j="${e.j}" data-xid="${esc(c.x.id)}">Vincular</button></div>`).join('')}</li>`).join('');
  return `<p>${pend===0?'Nenhum item sem cadastro.':`<b>${fmtN(pend)}</b> ${pend===1?'item sem cadastro':'itens sem cadastro'}${procId?' neste processo':''}; <b>${fmtN(ach.length)}</b> já ${ach.length===1?'existe':'existem'} na lista do Nomus.`}</p>${iguais?`<div class="actions"><button class="btn primary" data-act="cadTodos" data-pid="${esc(procId||'')}">Vincular todos os iguais (${iguais})</button></div>`:''}${ach.length?`<ul class="docs">${rows}</ul>${ach.length>80?`<p class="hint">Mostrando 80 de ${ach.length}. Vincule estes e abra de novo.</p>`:''}`:`<p class="hint">${pend?'Nenhum deles tem correspondente na lista ainda. Quando o cadastro for feito no Nomus, a lista do app é atualizada e este aviso aparece. “Igual” = mesma descrição; “Parecido” = mesmos números e medidas, texto quase igual (você confirma).':''}</p>`}${window.nomusCatBtn&&window.Settings&&Settings.on('nomus')?`<div class="actions" style="margin-top:10px">${nomusCatBtn()}</div>`:''}`;
}
function abrir(procId){
  const d=dialog(`<div class="dlg-body cmp-dlg"><h2>Cadastros novos no Nomus</h2><div id="cad-body">${dlgBody(procId)}</div><div class="actions end"><button class="btn" data-act="closeDlg">Fechar</button></div></div>`,{cls:'svc-dialog'});
  d._pid=procId||'';
}
const refresh=el=>{const d=el.closest('dialog');if(d){const b=d.querySelector('#cad-body');if(b)b.innerHTML=dlgBody(d._pid)}Cad.verificar().catch(()=>{});if(typeof renderMain==='function'&&S.user)try{renderMain()}catch{}};

Object.assign(MX.act,{
  cadAbrir(el){abrir(el&&el.dataset?el.dataset.pid:'')},
  cadVincular(el){
    const e=Cad.pendentes().find(z=>z.p.id===el.dataset.pid&&z.c.id===el.dataset.cid&&z.j===+el.dataset.j);
    const x=(window.Mats?Mats.list:[]).find(z=>z.id===el.dataset.xid);
    if(!e||!x){toast('Este item mudou. Abra a lista de novo.');return}
    Cad.vincular(e,x);toast(`Vinculado ao código ${x.codigo}.`);refresh(el);
  },
  cadTodos(el){
    const pid=el.dataset.pid||'';let n=0;
    for(const e of Cad.achados(pid||undefined)){if(e.cands.length===1&&e.cands[0].nivel==='igual'){Cad.vincular(e,e.cands[0].x);n++}}
    toast(`${n} ${n===1?'item vinculado':'itens vinculados'}.`,{ms:5000});refresh(el);
  }
});
window.cadBtn=procId=>mgr()?`<button class="btn" data-act="cadAbrir" data-pid="${esc(procId||'')}">${ic('refresh')}Verificar cadastros novos${Cad.n&&!procId?` (${Cad.n})`:''}</button>`:'';
})();
