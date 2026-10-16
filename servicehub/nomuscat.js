/* MINC ServiceHub — Atualização da lista de matéria-prima pelo Nomus (v5.25.0)
   Lê os produtos do Nomus (função do Netlify, somente leitura) e põe na lista do app: itens novos entram, descrição/unidade/família
   alteradas são corrigidas e itens inativos no Nomus são desativados (nunca excluídos). Só entram famílias que JÁ existem na lista
   (o Nomus tem produto acabado, subproduto etc.; as famílias de matéria-prima já estão na lista).
   Manual: botão "Atualizar pelo Nomus" (com prévia). Automático: 1x por dia, quando um gestor/administrador abre o app
   (Configurações > "Atualizar a lista pelo Nomus sozinha"). Carregado depois do materiais.js e antes do app.js. */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};
MX.sync=MX.sync||[];MX.boot=MX.boot||[];
const KEY='nomus_catalogo';
const fold=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const fam=f=>String(f??'').replace(/\s+/g,' ').trim().toUpperCase();
const cod=c=>fold(String(c??'').trim().replace(/\s*\.\s*/g,'.').replace(/\s+/g,' '));
const mgr=()=>typeof isManager==='function'&&isManager();

const NomusCat={
  busy:false,
  /* baixa todos os produtos do Nomus, página a página */
  async baixar(onProg,cancel){
    const rows=[];let pagina=1;
    for(let i=0;i<400;i++){
      if(cancel&&cancel())throw new Error('Cancelado.');
      const r=await Nomus.call({acao:'produtos',pagina});
      rows.push(...(r.itens||[]));onProg&&onProg(rows.length);
      if(!r.proxima)break;pagina=r.proxima;
    }
    return rows;
  },
  /* compara com a lista do app */
  montar(rows){
    const fams=new Set(Mats.list.map(x=>fam(x.familia)).filter(Boolean));
    const dentro=rows.filter(x=>x.codigo&&x.descricao&&fams.has(fam(x.familia)));
    const foraFam=new Map();for(const x of rows)if(x.familia&&x.codigo&&!fams.has(fam(x.familia)))foraFam.set(fam(x.familia),(foraFam.get(fam(x.familia))||0)+1);
    const a=window.matAnalisar([{aba:'',temFamilia:true,rows:dentro.filter(x=>x.ativo).map(x=>({codigo:x.codigo,codigo2:'',descricao:x.descricao,unidade:x.unidade,familia:x.familia}))}]);
    const p=window.matPlano(a.itens);
    const inativos=new Set(dentro.filter(x=>!x.ativo).map(x=>cod(x.codigo)));
    p.off=Mats.list.filter(x=>x.active&&inativos.has(cod(x.codigo))).map(x=>x.id);
    return{a,p,total:rows.length,dentro:dentro.length,foraFam:[...foraFam.entries()].sort((x,y)=>y[1]-x[1])};
  },
  async estado(){
    try{const r=await SB.from('app_settings').select('value').eq('key',KEY);return r.data&&r.data[0]?r.data[0].value:null}catch{return null}
  },
  async gravarEstado(v){try{await SB.from('app_settings').upsert({key:KEY,value:v},{onConflict:'key'})}catch(e){console.error(e)}},
  /* automático: 1 vez por dia, por qualquer gestor/administrador que abrir o app */
  async auto(){
    if(this.busy||!CLOUD||!navigator.onLine||!mgr()||!window.Settings||!Settings.on('nomus')||!Settings.on('nomusAuto'))return false;
    const est=await this.estado(),agora=Date.now();
    if(est&&agora-new Date(est.at||0)<22*3600e3)return false;                 // já atualizou hoje
    if(est&&est.tentou&&agora-new Date(est.tentou)<45*60e3&&!est.ok)return false;   // falhou há pouco: espera
    this.busy=true;
    await this.gravarEstado({...(est||{}),tentou:new Date().toISOString(),por:S.user?.name||'',ok:false});   // "reserva" a vez para os outros aparelhos
    try{
      const rows=await this.baixar();const r=this.montar(rows);
      if(r.p.add.length||r.p.upd.length||r.p.off.length)await window.matAplicar(r.p);
      await this.gravarEstado({at:new Date().toISOString(),tentou:new Date().toISOString(),ok:true,por:S.user?.name||'',auto:true,lidos:r.total,novos:r.p.add.length,alterados:r.p.upd.length,desativados:r.p.off.length});
      if(r.p.add.length||r.p.upd.length||r.p.off.length)toast(`Lista de matéria-prima atualizada pelo Nomus: ${r.p.add.length} novos, ${r.p.upd.length} alterados${r.p.off.length?`, ${r.p.off.length} desativados`:''}.`,{ms:6000});
      return true;
    }catch(e){
      console.error('atualização automática pelo Nomus',e);
      await this.gravarEstado({...(est||{}),tentou:new Date().toISOString(),ok:false,erro:String(e.message||e).slice(0,200),por:S.user?.name||''});
      return false;
    }finally{this.busy=false}
  }
};
window.NomusCat=NomusCat;
MX.sync.push(async()=>{NomusCat.auto().then(ch=>{if(ch&&window.Cad)Cad.verificar()}).catch(()=>{});return false});

const fmtEst=e=>!e?'Ainda não atualizou pelo Nomus.':e.ok?`Última atualização: ${fmt(e.at)}${e.por?' por '+esc(e.por):''}${e.auto?' (automática)':''} — ${e.novos||0} novos, ${e.alterados||0} alterados, ${e.desativados||0} desativados.`:`Última tentativa: ${fmt(e.tentou)}${e.erro?' — falhou: '+esc(e.erro):''}.`;

window.nomusCatBtn=()=>window.Settings&&Settings.on('nomus')&&CLOUD?`<button class="btn" data-act="nomusCat">${ic('refresh')}Atualizar pelo Nomus</button>`:'';
Object.assign(MX.act,{
  async nomusCat(){
    if(!navigator.onLine){toast('Sem conexão com a internet.');return}
    let cancel=false;
    const d=dialog(`<div class="dlg-body"><h2>Atualizar a lista pelo Nomus</h2><p class="hint" id="nc-est">${fmtEst(null)}</p><div id="nc-out"><p>Lendo os produtos do Nomus… <b id="nc-n">0</b> lidos.</p><p class="hint">Pode levar alguns minutos (o Nomus limita o ritmo das consultas). Não feche esta janela.</p></div><div class="actions end"><button class="btn" data-act="nomusCatCancel">Cancelar</button><button class="btn primary" id="nc-go" data-act="nomusCatGo" hidden>${ic('check')}Aplicar</button></div></div>`,{lock:true});
    d._cancel=()=>{cancel=true};
    NomusCat.estado().then(e=>{const el=d.querySelector('#nc-est');if(el)el.innerHTML=fmtEst(e)});
    try{
      const rows=await NomusCat.baixar(n=>{const el=d.querySelector('#nc-n');if(el)el.textContent=fmtN(n)},()=>cancel);
      const r=NomusCat.montar(rows);d._r=r;
      d.querySelector('#nc-out').innerHTML=`<p><b>${fmtN(r.total)}</b> produtos lidos; <b>${fmtN(r.dentro)}</b> nas famílias da lista.</p><ul><li><b>${fmtN(r.p.add.length)}</b> novos</li><li><b>${fmtN(r.p.upd.length)}</b> com descrição, unidade ou família alterada</li><li><b>${fmtN(r.p.same.length)}</b> sem mudança</li><li><b>${fmtN(r.p.off.length)}</b> a desativar (inativos no Nomus)</li></ul>${r.foraFam.length?`<details class="imp-w"><summary>${fmtN(r.foraFam.reduce((s,x)=>s+x[1],0))} produtos em famílias que não estão na lista foram ignorados</summary>${r.foraFam.slice(0,40).map(([f,n])=>esc(f)+': '+n).join('<br>')}${r.foraFam.length>40?`<br>… e mais ${r.foraFam.length-40} famílias`:''}</details>`:''}${r.a.avisos.conflitoCodigo.length?`<details class="imp-w" open><summary>${r.a.avisos.conflitoCodigo.length} código(s) repetido(s) com descrição diferente</summary>${r.a.avisos.conflitoCodigo.slice(0,8).map(esc).join('<br>')}</details>`:''}<p class="hint">Nada é excluído. Itens novos entram na lista de escolha; documentos já feitos não mudam.</p>`;
      const go=d.querySelector('#nc-go');go.hidden=false;go.disabled=!(r.p.add.length+r.p.upd.length+r.p.off.length);
    }catch(e){const o=d.querySelector('#nc-out');if(o)o.innerHTML=`<p class="errbox">${esc(e.message||'Não foi possível ler o Nomus.')}</p>`}
  },
  nomusCatCancel(el){const d=el.closest('dialog');d._cancel&&d._cancel();closeDialog(d)},
  async nomusCatGo(el){
    const d=el.closest('dialog'),r=d._r;if(!r)return;el.disabled=true;el.textContent='Gravando…';
    try{
      await window.matAplicar(r.p,t=>{el.textContent=t});
      await NomusCat.gravarEstado({at:new Date().toISOString(),tentou:new Date().toISOString(),ok:true,por:S.user?.name||'',auto:false,lidos:r.total,novos:r.p.add.length,alterados:r.p.upd.length,desativados:r.p.off.length});
      closeDialog(d);renderMain();toast(`Lista atualizada: ${r.p.add.length} novos, ${r.p.upd.length} alterados, ${r.p.off.length} desativados.`,{ms:6000});
      if(window.Cad)Cad.verificar();
    }catch(e){console.error(e);el.disabled=false;el.textContent='Aplicar';const o=d.querySelector('#nc-out');if(o)o.insertAdjacentHTML('beforeend',`<p class="errbox">${esc(e.message||cloudErrMsg(e))}</p>`)}
  }
});
})();
