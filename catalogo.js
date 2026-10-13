/* MINC · Peritagem — CATÁLOGO EDITÁVEL
   Listas extraídas dos documentos R-MINC-046-DEP-PT (OS 2104 e Nomus 3709).
   A engenharia pode editar este arquivo sem mexer na lógica do app; basta republicar.
   ATENÇÃO: itens marcados "CONFIRMAR" foram deduzidos dos documentos e precisam de validação do responsável. */
window.MINC_CATALOGO = {
  /* Cabeçalho do formulário. Rev. 02 de 13/10/2026: novo layout do documento (rodapé com quem emitiu, resumo por
     providência, fotos maiores, cabeçalho resumido nas demais páginas). Para uma nova revisão, troque rev e data aqui. */
  FORM: {
    titulo: 'DOCUMENTO DE EXECUÇÃO DE PERITAGEM E SERVIÇOS',
    tipo: 'REGISTRO',
    codigo: 'R-MINC-046-DEP-PT',
    rev: '02',
    data: '2026-10-13'
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

  /* ---------- Checklist de entrega (desmontagem -> fábrica), gerado a partir do DEP ----------
     CONFIRMAR: o código do formulário ainda não foi definido pela Qualidade. Enquanto estiver vazio, o PDF mostra "-". */
  CHECKLIST: {
    titulo: 'CHECKLIST DE ENTREGA DA DESMONTAGEM',
    tipo: 'REGISTRO',
    codigo: '',
    rev: '00',
    data: '2026-10-13'
  },

  /* ---------- RTS — Relatório Técnico de Serviço (módulo RTS) ----------
     Cabeçalho e textos fixos copiados do RTS 1135-26 (R-MINC-060-RTS-PT, Rev. 00). Edite aqui e republique. */
  RTS_FORM: {
    titulo: 'RELATÓRIO TÉCNICO DE SERVIÇO',
    tipo: 'REGISTRO',
    codigo: 'R-MINC-060-RTS-PT',
    rev: '00',
    data: '2026-05-14',
    endereco: 'Estrada do Pedregoso, 2219 | Distrito Industrial de Campo Grande | Rio de Janeiro | RJ | 23078-450',
    contato: 't. 21 2131-1321 | www.minc.ind.br'
  },
  RTS_STATUS_DOC: ['Peritagem para orçamento', 'Execução do serviço', 'Revisão'],
  RTS_PROVIDENCIAS: ['Recuperar', 'Reutilizar', 'Substituir', 'Adequar', 'Fabricar'],

  /* Etapas do "Conjunto geral" (itens iniciais do RTS) */
  RTS_GERAL: [
    'Lavagem e descontaminação do conjunto.',
    'Desmontagem.',
    'Segregar os elementos.',
    'Inspecionar componentes.',
    'Registro fotográfico de todas as etapas.',
    'Análise Técnica. Estudo de Engenharia Reversa para adequação do projeto',
    'Liberação da lista de material.'
  ],

  /* Biblioteca de atividades por providência. Ao escolher a providência de uma POS, estas linhas entram prontas e o
     usuário apaga o que não se aplica (mesmo fluxo do DEP). */
  RTS_BIBLIOTECA: {
    Recuperar: ['Marcação de identificação', 'Limpeza / Jateamento abrasivo', 'Levantamento dimensional para Engenharia Reversa', 'Repassar roscas onde necessário', 'Limpeza e polimento das sedes', 'Pintura protetiva em epóxi óxido de ferro padrão MINC'],
    Reutilizar: ['Realizar marcação de identificação', 'Realizar limpeza', 'Realizar limpeza / polimento', 'Pintura protetiva em epóxi óxido de ferro padrão MINC'],
    Substituir: ['Substituir conforme projeto MINC', 'Substituir completo o conjunto'],
    Adequar: ['Marcação de identificação', 'Limpeza / Jateamento abrasivo', 'Levantamento dimensional para Engenharia Reversa', 'Repassar roscas onde necessário', 'Preencher com solda canal de alojamento da vedação', 'Usinar canal conforme perfil de vedação MINC', 'Modificar conforme arranjo do projeto MINC', 'Pintura protetiva em epóxi óxido de ferro padrão MINC'],
    Fabricar: ['Fabricar conforme projeto MINC', 'Revestir área do alojamento com XYLAN 1010', 'Pintura protetiva em epóxi óxido de ferro padrão MINC']
  },

  /* Etapas finais (montagem, testes, pintura, embalagem). Já vêm marcadas as genéricas; as de teste específicas da
     válvula do RTS 1135-26 ficam como sugestões ("RTS_TESTES_SUGESTOES") para o usuário incluir quando valer. */
  RTS_MONTAGEM_TITULO: 'MONTAGEM DO CONJUNTO GERAL – TESTES – PINTURA',
  RTS_MONTAGEM: [
    'Efetuar montagem e ajustes do conjunto geral',
    'Efetuar inspeção do equipamento montado',
    'Efetuar limpeza final',
    'Pintura Final conforme padrão MINC',
    'Embalagem'
  ],
  RTS_TESTES_SUGESTOES: [
    'Efetuar teste de movimentação do Disco através do atuador elétrico',
    'Comissionamento dos limites de posição Aberto / Fechado',
    'Regular a posição / topador final do Disco ( Fechado )',
    'Pressurizar o sistema pneumático de atuação do selo pressurizado ( Vedação da Sede ). O mesmo deverá estar 100% estanque e funcional. Efetuar 03 ciclos de pressurização e despressurização.',
    'Efetuar o teste de estanqueidade das sedes. Promover o fechamento do disco, pressurizar o selo de vedação e preencher o interior do Disco com água ( Selo d’água ); o mesmo deverá estar 100% estanque, sem nenhum vazamento visual.',
    'Efetuar teste presencial com o cliente. Testes de funcionamento e estanqueidade'
  ],

  /* Textos fixos (editáveis em cada RTS) */
  RTS_TEXTOS: {
    notaLocal: 'Os serviços de reparo serão realizados no site da Ind. Minc.',
    notaEmbalagem: 'MATERIAL DEVERÁ SER DEVIDAMENTE EMBALADO EM PALETE DE MADEIRA REFORÇADO, PROTEGIDO CONTRA QUALQUER MOTIVO QUE POSSA VIR A DANIFICAR QUANDO MOVIMENTADO E ARMAZENADO POR LONGO PERÍODO GARANTINDO SUAS CARACTERÍSTICAS DE QUALIDADE.',
    identificacao: 'A Minc fornecerá plaqueta do equipamento, e acrescentar plaqueta de reparo MINC contendo:\n* EQUIPAMENTO – TIPO DE SERVIÇO – TAG – DATA.',
    pintura: 'Conforme indicado no escopo.',
    embalagem: 'Conforme indicado no escopo.',
    devolucao: 'No processo de reparo não aprovado pelo cliente, será necessário um prazo de 5 dias úteis para disponibilização do material, contado a partir do recebimento da solicitação formal de retirada feita pelo cliente.',
    testes: 'Conforme indicado no escopo.',
    validade: 'A proposta comercial atrelado ao recebimento deste documento pelo cliente possui validade de 10 dias corridos, podendo após esse período haver alteração de preços e prazos.',
    garantia: '06 meses em operação ou 12 meses em armazenamento, após emissão da Nota Fiscal, contados à partir da data de entrega.\n\nGarantia será considerada nula quando houver dano por acidente, uso abusivo ou inadequado, armazenamento inadequado ou apresentar sinais de violação na tentativa de ajustes ou conserto por pessoas não autorizadas.'
  },

  /* Embalagem "Padrão MINC". CONFIRMAR: texto copiado do item EMBALAGEM da OS 2104. */
  EMBALAGEM_PADRAO: [
    'Acondicionar a válvula em estrado de madeira',
    'Travar com fita própria para travamento',
    'Envolver toda a válvula em filme plástico',
    'Colocar identificação comercial na embalagem'
  ]
};
