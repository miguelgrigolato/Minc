/* MINC · Peritagem — Configurações do aplicativo (v5.13.0)
   Hoje: liga/desliga módulos. O interruptor fica em Administração > Configurações (só administrador).
   - Nuvem: tabela app_settings (chave "modulos"), lida por todos e gravada só pelo administrador; vale para todos os usuários.
   - Sem a tabela (migração ainda não aplicada) ou sem nuvem: a escolha vale só neste aparelho.
   Carregado ANTES do app.js: tudo que usa funções do app roda só quando chamado. */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};
MX.sync=MX.sync||[];MX.boot=MX.boot||[];
const KEY='minc_settings_v1';
/* módulos que podem ser desligados. rts: começa DESLIGADO (em desenvolvimento). */
const MODULOS=[
  {k:'mpLivre',nome:'Permitir item sem cadastro (ficha por família)',desc:'Mostra, ao adicionar matéria-prima, o botão "Não encontrei: item sem cadastro": o perito escolhe a família e preenche a ficha dela, e o item vai para a Lista de cadastro da Estrutura. Desligue para só entrar o que já está cadastrado.',padrao:true},
  {k:'nomus',nome:'Busca no Nomus (pedido/ordem)',desc:'Mostra o botão "Buscar no Nomus" no processo e o teste de conexão aqui em Configurações. Mantenha desligada até a conexão com o servidor do Nomus estar liberada.',padrao:false},
  {k:'nomusAuto',nome:'Atualizar a lista de matéria-prima pelo Nomus sozinha',desc:'Uma vez por dia, quando um gestor ou administrador abre o app, a lista de matéria-prima é atualizada com os produtos do Nomus (novos, alterados e inativos). Só funciona com "Busca no Nomus" ligada. O botão "Atualizar pelo Nomus" (Configurações > Lista de matéria-prima) faz o mesmo na hora, com prévia.',padrao:true},
  {k:'nomusProcAuto',nome:'Atualizar sozinha a situação dos processos do Nomus',desc:'Com o app aberto, a etapa, o responsável e o prazo dos processos em andamento (que têm o nº do Nomus, ex.: #1173) são consultados no Nomus a cada poucas horas. Alimenta os avisos de prazo no sino e a seção de prazos do Painel. Só funciona com "Busca no Nomus" ligada. Somente leitura.',padrao:true},
  {k:'cadAuto',nome:'Vincular sozinho os itens sem cadastro que já existem no Nomus',desc:'Depois que o cadastro é feito no Nomus e a lista do app é atualizada, os itens sem cadastro com descrição idêntica e uma única correspondência recebem o código automaticamente e saem da Lista de cadastro. Os parecidos sempre pedem a confirmação do gestor.',padrao:true},
  {k:'rts',nome:'Aba RTS (Relatório Técnico de Serviço)',desc:'Mostra a aba "RTS" na barra superior para todos os usuários. Desligada, a aba some, mas os RTS já criados continuam guardados e voltam quando ela for ligada de novo.',padrao:false}
];
const DEFAULTS=()=>({modulos:Object.fromEntries(MODULOS.map(m=>[m.k,m.padrao]))});
const missing=e=>!!e&&(e.code==='PGRST205'||e.code==='42P01'||/relation .* does not exist|schema cache/i.test(e.message||''));
const isAdmin=()=>CLOUD?['admin','gestor'].includes(S.user?.cloudRole):['Administrador','Gestor'].includes(S.user?.role);   // administrador ou gestor

const Settings={
  data:null,missing:false,src:'local',
  load(){
    if(this.data)return;
    try{const c=JSON.parse(localStorage.getItem(KEY));if(c&&c.modulos){this.data={modulos:{...DEFAULTS().modulos,...c.modulos}};this.src=c.src||'local';return}}catch{}
    this.data=DEFAULTS();
  },
  persist(){try{localStorage.setItem(KEY,JSON.stringify({modulos:this.data.modulos,src:this.src}))}catch{}},
  on(k){this.load();return this.data.modulos[k]===true},
  rtsOn(){return this.on('rts')},
  async refresh(){
    if(!CLOUD||this.missing)return false;
    this.load();
    const r=await SB.from('app_settings').select('key,value').eq('key','modulos');
    if(r.error){if(missing(r.error)){this.missing=true;return false}throw r.error}
    const v=r.data[0]?.value||{},next={...DEFAULTS().modulos};
    for(const m of MODULOS)if(typeof v[m.k]==='boolean')next[m.k]=v[m.k];
    const changed=JSON.stringify(next)!==JSON.stringify(this.data.modulos)||this.src!=='cloud';
    this.data.modulos=next;this.src='cloud';this.persist();
    return changed;
  },
  /* grava um módulo. Devolve {error} se não deu; {local:true} se valeu só neste aparelho. */
  async set(k,on){
    this.load();
    const next={...this.data.modulos,[k]:!!on};
    if(!CLOUD||this.missing){this.data.modulos=next;this.src='local';this.persist();return{local:true}}
    if(!navigator.onLine)return{error:{message:'Sem conexão: a configuração só pode ser alterada online.'}};
    if(!isAdmin())return{error:{message:'Só o administrador ou o gestor altera as configurações.'}};
    const r=await SB.from('app_settings').upsert({key:'modulos',value:next},{onConflict:'key'});
    if(r.error){
      if(missing(r.error)){this.missing=true;this.data.modulos=next;this.src='local';this.persist();return{local:true}}
      return{error:r.error};
    }
    this.data.modulos=next;this.src='cloud';this.persist();return{};
  }
};
window.Settings=Settings;
MX.boot.push(()=>Settings.load());

/* o módulo foi desligado/ligado (aqui ou por outra pessoa): atualiza a barra e sai da tela do módulo, se for o caso */
function applyChange(){
  if(!Settings.rtsOn()&&['rts','rtsEdit'].includes(S.screen)){
    if(window.RtsSave)RtsSave.flush();S.screen='home';S.id=null;S.anim='up';render();toast('A aba RTS foi desligada pelo administrador.',{ms:5000});return;
  }
  if(S.user){const y=window.scrollY;S.anim=null;render();window.scrollTo(0,y)}   // redesenha tudo: a barra superior (aba RTS) também muda
}
MX.sync.push(async()=>{const ch=await Settings.refresh();if(ch)applyChange();return false});

/* ============================== Administração > Configurações ============================== */
window.vSettingsAdmin=function(){
  Settings.load();
  const edit=!CLOUD||isAdmin();
  const note=CLOUD&&Settings.missing?'<p class="errbox" style="margin-bottom:12px">A tabela de configurações ainda não existe na nuvem; por enquanto a escolha vale só neste aparelho. Peça ao responsável técnico para aplicar a migração 20261013_modelos_valvula_e_rts.sql.</p>':(CLOUD&&Settings.src!=='cloud'?'<p class="errbox" style="margin-bottom:12px">Mostrando a cópia deste aparelho. Entre com internet para carregar as configurações da nuvem.</p>':'');
  return `${note}<div class="panel"><h2>Módulos e regras</h2><p class="hint">Ligue ou desligue partes e regras do aplicativo para todos os usuários.</p><div class="set-list">${MODULOS.map(m=>`<div class="set-row"><div class="set-i"><b>${m.nome}</b><small>${m.desc}</small></div><label class="switch"><input type="checkbox" data-chg="setModulo" data-k="${m.k}" ${Settings.on(m.k)?'checked':''} ${edit?'':'disabled'}><span class="track"></span><span>${Settings.on(m.k)?'Ligado':'Desligado'}</span></label></div>`).join('')}</div>${edit?'':'<p class="hint">Só o administrador ou o gestor altera.</p>'}</div>${window.vNomusAdmin?vNomusAdmin():''}${window.vServicesAdmin?vServicesAdmin():''}${window.vMaterialsAdmin?vMaterialsAdmin():''}`;
};
Object.assign(MX.chg,{
  async setModulo(el){
    const k=el.dataset.k,want=el.checked;
    el.disabled=true;
    const r=await Settings.set(k,want);
    el.disabled=false;
    if(r.error){toast(r.error.message||cloudErrMsg(r.error),{ms:6000});if(S.screen==='admin')renderMain();return}
    toast(`${MODULOS.find(m=>m.k===k)?.nome||k}: ${want?'ligado':'desligado'}${r.local?' (só neste aparelho)':' para todos os usuários'}.`,{ms:5000});
    applyChange();
  }
});
})();
