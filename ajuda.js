/* MINC ServiceHub — Ajuda e manual de uso por perfil + roteiro de treinamento (v5.21.0)
   O mesmo conteúdo gera o manual em Word (docs/manual). Para alterar o texto, edite MINC_AJUDA e republique. */
(function(){
'use strict';
const MX=window.MINC_EXT=window.MINC_EXT||{};
for(const k of ['act','chg','sub','inp','views'])MX[k]=MX[k]||{};

window.MINC_AJUDA={
  geral:{titulo:'Primeiros passos (todos)',secoes:[
    {t:'Entrar e trocar a senha',l:['Abra minc-servicehub.netlify.app no navegador (de preferência instale: menu do navegador > “Adicionar à tela inicial”).','Entre com o usuário (ou e-mail) e a senha provisória que o administrador entregou. No primeiro acesso o app pede uma senha nova.','Esqueceu a senha? Peça ao administrador “Definir senha”.']},
    {t:'A barra superior',l:['Peritagens, RTS e Painel: os módulos (RTS e Painel aparecem conforme o perfil e as configurações).','Bolinha de sincronização: “Sincronizado”, “N pendentes” ou “Offline”. Toque em “N pendentes” para ver o que ainda não foi enviado e enviar agora.','Sino: avisos (RTS para aprovar, RTS aprovado ou devolvido, diferenças RTS × D.E). Lupa: busca em tudo (processos, componentes, materiais, RTS, modelos e lista do Nomus).','Seu nome: alterar senha, ajuda e, para gestor/administrador, a Administração.']},
    {t:'Sem internet',l:['O app continua funcionando: tudo fica salvo no aparelho e é enviado quando a internet voltar (aparece a faixa amarela “Sem internet”).','Antes de limpar dados do navegador, trocar de aparelho ou desinstalar o app, confirme que não há “pendentes” na barra.','Instalar o app na tela inicial protege os dados guardados no aparelho.']},
    {t:'Busca com %',l:['Sem %: todas as palavras precisam aparecer, em qualquer ordem (ex.: “parafuso m10 inox”).','Com %: pula palavras, na ordem (ex.: “paraf%sext%m10%30”). O botão % ao lado da caixa insere o sinal no tablet.']}
  ]},
  perfis:[
    {k:'func',nome:'Funcionário (perito)',secoes:[
      {t:'Abrir um processo (D.E)',l:['Peritagens > Novo processo. Se a válvula tem projeto cadastrado, escolha o modelo: os componentes já entram prontos; senão, “Sem projeto”.','Identificação: processo, pedido, ordem (opcional), equipamento e cliente. Status: Rascunho → Em execução → Concluído.','Siga as etapas na ordem; o app só deixa avançar com os campos obrigatórios preenchidos.']},
      {t:'Componentes',l:['Para cada componente: providência (Recuperar, Fabricar, Reutilizar, Substituir), atividades, fotos e observação.','Matéria-prima (só em Fabricar/Substituir): “Adicionar matéria-prima” abre a lista do Nomus — use filtros de família/unidade e a busca com %. Marque os itens e informe a quantidade.','Não achou na lista? “Não encontrei: item sem cadastro”: escolha a família e preencha a ficha (campos com * são obrigatórios). O item vai para a Lista de cadastro.','Serviços externos: “Adicionar serviço” e marque os da lista (com código do Nomus).']},
      {t:'Estrutura, documentos e checklist',l:['Estrutura: árvore do equipamento, Lista de compras e Lista de cadastro; “Exportar Excel” gera as três planilhas.','Documento de execução: confira e “Gerar e arquivar nova versão” (PDF na nuvem, com histórico de versões).','Checklist R-MINC-078-IRS-PT: depois de fechar a D.E, gere o checklist dos itens reutilizados (ou de todos os componentes).']},
      {t:'RTS (quando a aba estiver ligada)',l:['RTS > Novo RTS: proposta, cliente, produto; opcionalmente parta de um projeto.','Preencha dados, objetivo, escopo (POS, atividades), observações, cronograma e anexos.','Vincule o RTS ao processo da peritagem (painel “Vínculo com a D.E”): o app compara e envia as diferenças ao gestor.','“Enviar para aprovação”: o PDF só sai com “Aprovado por” depois que o gestor/administrador aprovar. Se for devolvido, o motivo aparece no topo do RTS e no sino.']}
    ]},
    {k:'gestor',nome:'Gestor',secoes:[
      {t:'Tudo do funcionário, e mais:',l:['Painel de gestão (aba Painel): indicadores do período, gráficos por mês, tempo médio por etapa, providências, componentes/serviços/matérias-primas mais frequentes, produtividade por pessoa, RTS e comparativos. “Exportar Excel” leva todos os números.','Processos parados, sem ordem, itens sem cadastro por família, RTS aguardando aprovação e atividade recente.','Histórico: na ficha do processo, botão “Histórico” mostra quem mudou o quê e quando.']},
      {t:'Aprovar RTS',l:['O sino avisa quando um RTS é enviado. Abra o RTS e use “Aprovar” ou “Devolver para ajustes” (com o motivo).','RTS aprovado fica travado; para alterar, “Reabrir” (a aprovação é desfeita).']},
      {t:'Avaliar diferenças RTS × D.E',l:['Painel > “Diferenças RTS × D.E para avaliar” > Avaliar.','Decida: Resolvido (documentos corrigidos), Diferença aceita, Descartado ou manter pendente, com uma nota. Quem enviou recebe o aviso.']},
      {t:'Administração (catálogos)',l:['Seu nome > Administração: Catálogos (setores/atividades), Modelos de válvula e Configurações (listas de serviços e matéria-prima do Nomus, módulos).','O gestor não vê nem altera a Administração de usuários.']}
    ]},
    {k:'admin',nome:'Administrador',secoes:[
      {t:'Tudo do gestor, e mais:',l:['Usuários: cadastrar com ou sem e-mail, definir perfil (Funcionário, Gestor, Administrador), definir senha, bloquear e acompanhar a auditoria.','O último administrador ativo não pode ser removido nem bloqueado.']},
      {t:'Configurações importantes',l:['Módulos: ligar/desligar a aba RTS, o item sem cadastro e a busca no Nomus (desligada até o suporte do Nomus liberar a conexão).','Lista de matéria-prima: importar a planilha exportada do Nomus (Código, Descrição, Unidade, Família) — o app mostra a prévia antes de gravar.','Lista de serviços: códigos 09.x do Nomus.']},
      {t:'Rotina de segurança',l:['Uma vez por mês: conferir usuários ativos e bloquear quem saiu da empresa.','Antes de grandes mudanças: exportar Excel do painel e das estruturas como cópia.']}
    ]}
  ],
  treinamento:{titulo:'Roteiro de treinamento (≈ 2 h por turma)',etapas:[
    {t:'1. Apresentação (10 min)',l:['O que é o MINC ServiceHub e o fluxo: peritagem (D.E) → estrutura → documentos → checklist; RTS → aprovação → comparativo.','Perfis e o que cada um faz.']},
    {t:'2. Acesso e barra superior (10 min)',l:['Cada participante entra, troca a senha e instala o app na tela inicial.','Sincronização, sino, lupa e menu do usuário.']},
    {t:'3. Peritagem guiada (40 min)',l:['Em dupla: abrir um processo de treino (cliente “TREINAMENTO”), com 3 componentes.','Uma matéria-prima da lista com busca %, um item sem cadastro com ficha, um serviço externo e fotos.','Gerar o documento de execução e o checklist R-MINC-078-IRS-PT.']},
    {t:'4. Sem internet (10 min)',l:['Ligar o modo avião, editar o processo, ver a faixa amarela e os pendentes; voltar a internet e conferir o envio.']},
    {t:'5. RTS e aprovação (25 min)',l:['Criar um RTS de treino, vincular ao processo, ver o comparativo.','Enviar para aprovação; o gestor devolve com motivo; corrigir e reenviar; o gestor aprova e gera o PDF.']},
    {t:'6. Painel e gestão (15 min, só gestores)',l:['Ler os indicadores, mudar o período, abrir um processo parado, avaliar um comparativo e exportar o Excel.']},
    {t:'7. Encerramento (10 min)',l:['Dúvidas, onde fica a ajuda (seu nome > Ajuda e manual) e combinar a semana de uso acompanhado.','Excluir os processos e RTS de treino (gestor/administrador).']}
  ],
  checklist:['Todos entraram e trocaram a senha','App instalado na tela inicial','Fez um processo completo com documento e checklist','Testou o modo sem internet','Fez e enviou um RTS (quem usa RTS)','Gestor aprovou/devolveu um RTS e avaliou um comparativo']}
};

const list=l=>`<ul>${l.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
const secs=s=>s.map(x=>`<h3>${esc(x.t)}</h3>${list(x.l)}`).join('');
function helpHTML(tab){
  const A=window.MINC_AJUDA,perfis=A.perfis;
  if(tab==='geral')return secs(A.geral.secoes);
  if(tab==='trein')return `${A.treinamento.etapas.map(e=>`<h3>${esc(e.t)}</h3>${list(e.l)}`).join('')}<h3>Conferência ao final</h3>${list(A.treinamento.checklist)}`;
  const p=perfis.find(x=>x.k===tab)||perfis[0];return secs(p.secoes);
}
const myTab=()=>typeof isAdminUser==='function'&&isAdminUser()?'admin':typeof isManager==='function'&&isManager()?'gestor':'func';
Object.assign(MX.act,{
  helpOpen(el){
    el?.closest?.('dialog')&&closeDialog(el.closest('dialog'));
    const tab=myTab(),tabs=[['geral','Primeiros passos'],['func','Funcionário'],['gestor','Gestor'],['admin','Administrador'],['trein','Treinamento']];
    dialog(`<div class="dlg-body help-dlg"><h2>Ajuda e manual</h2><p class="hint">Manual curto por perfil. O seu perfil abre primeiro.</p><div class="seg help-tabs" role="tablist">${tabs.map(([k,t])=>`<button class="seg-b ${k===tab?'on':''}" role="tab" data-act="helpTab" data-v="${k}">${t}</button>`).join('')}</div><div class="help-body" id="help-body">${helpHTML(tab)}</div><div class="actions end"><button class="btn" data-act="closeDlg">Fechar</button></div></div>`,{cls:'svc-dialog'});
  },
  helpTab(el){const d=el.closest('dialog');d.querySelectorAll('.help-tabs .seg-b').forEach(b=>b.classList.toggle('on',b===el));d.querySelector('#help-body').innerHTML=helpHTML(el.dataset.v)}
});
})();
