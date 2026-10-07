/* MINC · Peritagem — CATÁLOGO EDITÁVEL
   Listas extraídas dos documentos R-MINC-046-DEP-PT (OS 2104 e Nomus 3709).
   A engenharia pode editar este arquivo sem mexer na lógica do app; basta republicar.
   ATENÇÃO: itens marcados "CONFIRMAR" foram deduzidos dos documentos e precisam de validação do responsável. */
window.MINC_CATALOGO = {
  /* Cabeçalho do formulário. CONFIRMAR a revisão vigente: o documento da OS 2104 está na Rev. 01 (20/04/2026)
     e o do Nomus 3709 na Rev. 00 (16/10/2025). Foi usada a mais recente. */
  FORM: {
    titulo: 'DOCUMENTO DE EXECUÇÃO DE PERITAGEM E SERVIÇOS',
    tipo: 'REGISTRO',
    codigo: 'R-MINC-046-DEP-PT',
    rev: '01',
    data: '2026-04-20'
  },

  /* Providências. "Retrofit" foi retirado (decisão da engenharia); itens antigos que o usavam continuam exibindo a marca "descontinuada". */
  PROVIDENCIAS: ['Fabricar', 'Recuperar', 'Reutilizar', 'Substituir'],   // "Serviço externo" foi retirado (decisão da engenharia); itens antigos que o usavam continuam exibindo a marca "descontinuada"

  /* Providências que pedem a lista "Materiais a comprar". CONFIRMAR se Serviço externo também precisa. */
  COM_MATERIAIS: ['Fabricar', 'Substituir'],

  /* SETORES E ATIVIDADES (quadro da engenharia). Esta é a cópia PADRÃO, usada no modo local e quando o aparelho ainda não
     baixou o catálogo da nuvem. Com a nuvem ligada, o administrador edita o catálogo em Administração > Catálogos
     (sem republicar o app). Mantenha igual à carga inicial do banco. requiresDetail = a linha exige texto complementar. */
  SETORES_PADRAO: [
    { name: 'Usinagem', atividades: [
      { name: 'Normalizar Faces' }, { name: 'Refazer/Fazer Ranhura' }, { name: 'Normalizar Furos' },
      { name: 'Fazer Furos' }, { name: 'Calibrar Rosca' }, { name: 'Polimento' } ] },
    { name: 'Caldeiraria', atividades: [
      { name: 'Preencher Área com Solda' }, { name: 'Fazer Modificação na Peça Conforme Desenho', requiresDetail: true } ] },
    { name: 'Mecânica', atividades: [ { name: 'Montar Produto' }, { name: 'Lapidar Sede' } ] },
    { name: 'Pintura', atividades: [
      { name: 'Jateamento' }, { name: 'Aplicar Primer N1202' }, { name: 'Aplicar Tinta Conforme Observação', requiresDetail: true } ] },
    { name: 'Qualidade', atividades: [ { name: 'Realizar Ensaio de LP' } ] }
  ],

  /* Serviços externos padrão (exemplos dados pela engenharia). Também editáveis em Administração > Catálogos. */
  SERVICOS_EXTERNOS_PADRAO: ['Serviço de Tratamento Térmico', 'Serviço de Recuperação'],

  /* Itens que se repetem nos documentos (atalho "Itens comuns" na aba Componentes) */
  ITENS_COMUNS: ['Montagem final', 'Pintura', 'Elementos de fixação', 'Elementos de vedação', 'Sistema de lubrificação'],

  /* Embalagem "Padrão MINC". CONFIRMAR: texto copiado do item EMBALAGEM da OS 2104. */
  EMBALAGEM_PADRAO: [
    'Acondicionar a válvula em estrado de madeira',
    'Travar com fita própria para travamento',
    'Envolver toda a válvula em filme plástico',
    'Colocar identificação comercial na embalagem'
  ]
};
