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

  /* Serviços padrão com código do Nomus (cópia usada sem nuvem e antes do aparelho baixar a lista). Com a nuvem, o administrador
     edita a lista em Administração > Configurações. */
  SERVICOS_EXTERNOS_PADRAO: [
    { codigo: '09.1.0011', name: 'SERVIÇO DE TRATAMENTO DE SUPERFÍCIE' },
    { codigo: '09.1.0002', name: 'SERVIÇO DE TRATAMENTO TÉRMICO' },
    { codigo: '09.19.069', name: 'SERVIÇO DE BRUNIMENTO' },
    { codigo: '09.1.0004', name: 'SERVIÇO DE REVESTIMENTO' },
    { codigo: '09.1.0009', name: 'SERVIÇO DE CALANDRAGEM DE CHAPA' },
    { codigo: '09.1.0003', name: 'SERVIÇO DE CORTE DE CHAPA' }
  ],

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
  RTS_PRAZO_REF: ['após a liberação do serviço pelo cliente', 'a partir da data da colocação do pedido'],

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

  /* Padrões de pintura (variam por cliente). Nas atividades abaixo, a linha "{PINTURA}" é trocada pelas linhas do padrão
     escolhido no RTS. Fonte: RTS 1135 (padrão MINC) e 1168/1188 (Ternium: alta temperatura). */
  RTS_PINTURAS: [
    { nome: 'Padrão MINC (epóxi óxido de ferro)', linhas: ['Pintura protetiva em epóxi óxido de ferro padrão MINC'] },
    { nome: 'Alta temperatura (N-1661 + WEGTERM HPA 660 alumínio)', linhas: [
      'Jatear – jato padrão ao metal quase branco ISO 8501-1 S.A 2 ½',
      'Efetuar pintura de fundo N-1661, etil silicato de Zinco com 75 microns de espessura seca',
      'Realizar pintura de acabamento WEGTERM HPA 660, Silicone 25 microns de espessura seca na cor alumínio' ] },
    { nome: 'Fundo N-1661 + amarelo segurança 5Y8/12', linhas: [
      'Jatear, jato ao metal quase branco ASTM SA 2 1/2 (NBR 7348)',
      'Efetuar pintura de fundo N-1661',
      'Realizar pintura para alta temperatura e manter a cor amarelo segurança 5Y8/12' ] }
  ],

  /* Biblioteca de atividades por providência. Ao escolher a providência de uma POS, estas linhas entram prontas e o
     usuário apaga o que não se aplica (mesmo fluxo do DEP). */
  RTS_BIBLIOTECA: {
    Recuperar: ['Marcação de identificação', 'Limpeza / Jateamento abrasivo', 'Levantamento dimensional para Engenharia Reversa', 'Repassar roscas onde necessário', 'Recompor com solda, usinar e lapidar sede de vedação', 'Limpeza e polimento das sedes', '{PINTURA}'],
    Reutilizar: ['Realizar marcação de identificação', 'Realizar limpeza', 'Realizar limpeza / polimento', 'Reutilizar', '{PINTURA}'],
    Substituir: ['Substituir conforme projeto MINC', 'Substituir completo o conjunto', 'Substituir onde necessário'],
    Adequar: ['Marcação de identificação', 'Limpeza / Jateamento abrasivo', 'Levantamento dimensional para Engenharia Reversa', 'Repassar roscas onde necessário', 'Preencher com solda canal de alojamento da vedação', 'Usinar canal conforme perfil de vedação MINC', 'Modificar conforme arranjo do projeto MINC', '{PINTURA}'],
    Fabricar: ['Fabricar conforme projeto MINC', 'Revestir área do alojamento com XYLAN 1010', '{PINTURA}']
  },
  /* Outras atividades que aparecem no seletor de qualquer POS (não entram sozinhas) */
  RTS_BIBLIOTECA_EXTRA: {
    'Soldagem e usinagem': [
      'Recompor com solda, usinar e lapidar sede de vedação',
      'Realizar recomposição com solda nas áreas desgastadas',
      'Recuperar as faces dos flanges, danificadas na área da furação, através do processo de soldagem e usinagem',
      'Recuperar faces dos flanges, normalizando ranhuras, furos e roscas',
      'Uniformizar as faces dos flanges de conexão com a linha de operação e refazer as ranhuras de vedação',
      'Polir área da passagem do eixo, com recomposição de solda e usinagem, somente se necessário',
      'Normalizar área de passagem do eixo',
      'Realizar normalização das roscas',
      'Recuperar furo e rosca do mancal',
      'Remover cantos vivos e rebarbas, se necessário',
      'Fabricar conforme projeto MINC',
      'Projetar, fabricar e fornecer conforme projeto MINC' ],
    'Preparação e pintura': [
      'Jatear – jato padrão ao metal quase branco ISO 8501-1 S.A 2 ½',
      'Efetuar pintura de fundo N-1661, etil silicato de Zinco com 75 microns de espessura seca',
      'Realizar pintura de acabamento WEGTERM HPA 660, Silicone 25 microns de espessura seca na cor alumínio',
      'Pintura protetiva em epóxi óxido de ferro padrão MINC',
      'Jatear e pintar' ],
    'Retrofit e modificações': [
      'Realizar adequação no corpo para inclusão de sistema de lubrificação',
      'Substituir para inclusão de sistema de lubrificação conforme projeto MINC',
      'Realizar adaptação conforme projeto MINC',
      'Promover uma segunda janela de inspeção no lado oposto à existente, conforme projeto MINC' ]
  },

  /* Etapas finais (montagem, testes, pintura, embalagem). Já vêm marcadas as genéricas; as de teste ficam como sugestões
     ("RTS_TESTES_SUGESTOES") para o usuário incluir quando valer. */
  RTS_MONTAGEM_TITULO: 'MONTAGEM DO CONJUNTO GERAL – TESTES – PINTURA',
  RTS_MONTAGEM: [
    'Efetuar montagem e ajustes do conjunto geral',
    'Efetuar inspeção do equipamento montado',
    'Efetuar limpeza final',
    'Pintura Final conforme padrão MINC',
    'Embalagem'
  ],
  RTS_TESTES_SUGESTOES: [
    'Realizar teste de acionamento',
    'Realizar teste conforme classe de pressão da válvula',
    'Realizar os testes de acionamento e testes de vedação',
    'Efetuar a regulagem de abertura para exatos 90 graus',
    'Efetuar teste de movimentação do Disco através do atuador elétrico',
    'Comissionamento dos limites de posição Aberto / Fechado',
    'Regular a posição / topador final do Disco ( Fechado )',
    'Pressurizar o sistema pneumático de atuação do selo pressurizado ( Vedação da Sede ). O mesmo deverá estar 100% estanque e funcional. Efetuar 03 ciclos de pressurização e despressurização.',
    'Efetuar o teste de estanqueidade das sedes. Promover o fechamento do disco, pressurizar o selo de vedação e preencher o interior do Disco com água ( Selo d’água ); o mesmo deverá estar 100% estanque, sem nenhum vazamento visual.',
    'Efetuar teste presencial com o cliente. Testes de funcionamento e estanqueidade',
    'Elaborar e enviar Data book ao cliente',
    'Realizar a Embalagem com emissão de Databook'
  ],

  /* Observações Técnicas: biblioteca (o usuário escolhe quais entram e a ordem). "padrao" = já vem em todo RTS novo.
     Fonte: RTS 1135, 1168 e 1188. */
  RTS_OBS_BIBLIOTECA: [
    { nome: 'Peritagem (eixo livre)', titulo: 'PERITAGEM', padrao: true, texto: 'Este escopo contempla apenas o reparo da válvula com eixo livre, não contemplando reparo do atuador.' },
    { nome: 'Teste de desempenho – resumido', titulo: 'TESTE DE DESEMPENHO', padrao: true, texto: 'Teste será realizado conforme padrão Minc somente de corpo e acionamento “manual” com base nos padrões do fabricante informado na plaqueta original do equipamento, para garantir a vedação dos mancais do eixo:\n- O equipamento será submetido a teste de acionamento, observando a movimentação dos componentes sem ocorrência de travamento.\n- O equipamento será submetido a teste de estanqueidade, observando a não ocorrência de vazamentos externos.' },
    { nome: 'Teste de desempenho – completo (corpo e sede)', titulo: 'TESTE DE DESEMPENHO', texto: 'O equipamento será submetido a teste de acionamento, observando a movimentação dos componentes sem ocorrência de travamento.\n- Realizar teste de acionamento; verificação do assento do disco de vedação na sede de vedação.\n- Durante os testes será realizado medição na corrente elétrica e registrado, para verificação do livre movimento de abertura e fechamento da válvula.\n- Durante os testes faremos inspeção para confirmação de que todos os pontos internos estão sendo alcançados pela graxa lubrificante.\n- Válvula será devidamente comissionada, com os limites de posição de válvula aberta e válvula fechada ajustada de fábrica.\n- O equipamento será submetido a teste de estanqueidade de corpo e sede, observando a não ocorrência de vazamentos internos e externos.\n\nCORPO: a válvula deverá ser submetida a pressão pneumática de 5,5 bar para avaliação da vedação do corpo. Tempo de teste: 10 minutos.\nSEDE: teste da sede será realizado com pressão pneumática de 5,5 kgf/cm². Tempo de teste: 10 minutos.' },
    { nome: 'Pintura – conforme escopo', titulo: 'PINTURA', texto: 'Conforme indicado no escopo.' },
    { nome: 'Pintura – alta temperatura', titulo: 'PINTURA', texto: 'Realizar pintura conforme padrão Minc, indicado abaixo:\n- Jateamento ao metal quase branco SA 2 ½\n- Pintura de fundo – interno e externo – etil silicato de zinco.\n- Pintura de acabamento: alumínio silicone.' },
    { nome: 'Embalagem – estrado e filme', titulo: 'EMBALAGEM', padrao: true, texto: '- Acondicionar o equipamento em estrado de madeira;\n- Envolver em filme plástico.' },
    { nome: 'Embalagem – conforme escopo', titulo: 'EMBALAGEM', texto: 'Conforme indicado no escopo.' },
    { nome: 'Databook', titulo: 'DATABOOK', padrao: true, texto: 'A MINC fornecerá um databook contendo todas as fases do processo de reparo + certificados de materiais empregados e relatórios de testes.' },
    { nome: 'Identificação – plaqueta de serviço', titulo: 'IDENTIFICAÇÃO', padrao: true, texto: 'O equipamento será identificado com uma plaqueta de serviço, constando nome do equipamento, cliente, número de ordem de produção e data da manutenção.' },
    { nome: 'Identificação – plaqueta de reparo', titulo: 'IDENTIFICAÇÃO', texto: 'A Minc fornecerá plaqueta do equipamento, e acrescentar plaqueta de reparo MINC contendo:\n* EQUIPAMENTO – TIPO DE SERVIÇO – TAG – DATA.' },
    { nome: 'Desenhos', titulo: 'DESENHOS', texto: 'Neste documento contempla os desenhos utilizados para execução do serviço de recuperação do equipamento.' },
    { nome: 'Devolução', titulo: 'DEVOLUÇÃO', padrao: true, texto: 'Em processo de reparo que o equipamento esteja na planta da Industria Minc, que não for aprovado pelo cliente, será necessário um prazo de 5 dias úteis para disponibilização do material, contado a partir do recebimento da solicitação formal de retirada feita pelo cliente.' },
    { nome: 'Observações / notas gerais', titulo: 'OBSERVAÇÕES / NOTAS GERAIS', padrao: true, texto: 'Não estão inclusos neste escopo: fornecimento de certificado específico, manuais, desenhos, cronograma de entrega, reuniões de acompanhamento presencial de teste do equipamento ou qualquer outra atividade não expressamente descrita neste escopo de fornecimento. Caso haja alguma necessidade específica, é fundamental que seja informada durante as tratativas comerciais.' },
    { nome: 'Testes – conforme escopo', titulo: 'TESTES', texto: 'Conforme indicado no escopo.' }
  ],

  /* Sugestões de títulos (campo com lista) */
  RTS_EXTRAS_TITULOS: ['Relatório de Delineamento Contratual', 'Serão demandados da Minc', 'Condições de fornecimento'],
  RTS_ANEXOS_TITULOS: ['Imagens do Recebimento', 'Imagens da Peritagem', 'Desenhos de referência', 'Escopo do Serviço Minc'],

  /* Termo de garantia */
  RTS_GARANTIAS: [
    { nome: '6 meses em operação / 12 em armazenamento', texto: '06 meses em operação ou 12 meses em armazenamento, após emissão da Nota Fiscal, contados à partir da data de entrega.\n\nGarantia será considerada nula quando houver dano por acidente, uso abusivo ou inadequado, armazenamento inadequado ou apresentar sinais de violação na tentativa de ajustes ou conserto por pessoas não autorizadas.' },
    { nome: '12 meses em operação / 18 em armazenamento', texto: '12 meses em operação ou 18 meses em armazenamento, após emissão da Nota Fiscal, contados à partir da data de entrega.\n\nGarantia será considerada nula quando houver dano por acidente, uso abusivo ou inadequado, ou apresentar sinais de violação na tentativa de ajustes ou conserto por pessoas não autorizadas.' }
  ],

  /* Textos fixos (editáveis em cada RTS) */
  RTS_TEXTOS: {
    notaLocal: 'Os serviços de reparo serão realizados no site da Ind. Minc.',
    notaEmbalagem: '',
    validade: 'A proposta comercial atrelado ao recebimento deste documento pelo cliente possui validade de 15 dias, podendo após esse período haver alteração de preços e prazos.'
  },

  /* Embalagem "Padrão MINC". CONFIRMAR: texto copiado do item EMBALAGEM da OS 2104. */
  EMBALAGEM_PADRAO: [
    'Acondicionar a válvula em estrado de madeira',
    'Travar com fita própria para travamento',
    'Envolver toda a válvula em filme plástico',
    'Colocar identificação comercial na embalagem'
  ]
};
