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

  /* ---------- Checklist de verificação de itens reutilizados (desmontagem -> fábrica), gerado a partir do DEP ----------
     Código definido pela Qualidade: R-MINC-078-IRS-PT, Rev. 00. Para uma nova revisão, troque rev e data aqui. */
  CHECKLIST: {
    titulo: 'CHECKLIST DE VERIFICAÇÃO DE ITENS REUTILIZADOS PARA SERVIÇO',
    tipo: 'REGISTRO',
    codigo: 'R-MINC-078-IRS-PT',
    rev: '00',
    data: '2026-10-16'
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

/* ============================================================================================================================
   FICHAS DE CADASTRO POR FAMÍLIA (matéria-prima "sem cadastro")
   Quando o funcionário não acha o item na lista, ele escolhe a FAMÍLIA do Nomus e preenche a ficha dela. Cada família "cobra" campos
   diferentes (parafuso: norma, classe, material, acabamento, rosca…; chapa: material, norma, espessura…). O app monta a descrição no
   padrão do Nomus a partir da ficha. Campos e opções vieram da análise das 3.417 descrições do relatório de produtos do Nomus.
   - t:'sel' = lista de opções (com "Outro" para digitar); t:'txt' = texto/medida.
   - req:1 = obrigatório. na:1 = obrigatório, mas pode marcar "Não se aplica" (o campo some da descrição).
   - modelo: como a descrição é montada. {campo} = valor; [ ... ] = trecho que só aparece se TODOS os campos dentro dele estiverem preenchidos.
   Famílias que não estão aqui usam a ficha genérica (MP_FICHA_GENERICA). Para ajustar: edite este bloco e republique.
   ============================================================================================================================ */
(function(){
  const sel=(k,l,o,x)=>Object.assign({k,l,t:'sel',o},x||{});
  const txt=(k,l,x)=>Object.assign({k,l,t:'txt'},x||{});
  const ACAB=['ZINCADO PRETO','ZINCADO BRANCO','ZINCADO','BICROMATIZADO'];
  const F={};
  F['PARAFUSO']={modelo:'PARAFUSO {tipo} {norma} [CL {classe}] {material} {acab} {rosca}[ - P.{passo}] x {comp}',campos:[
    sel('tipo','Tipo / cabeça',['SEXTAVADO','SEXTAVADO FLANGEADO','ALLEN CABEÇA CILÍNDRICA','ALLEN CABEÇA CILÍNDRICA SEXTAVADO INTERNO','ALLEN CABEÇA ESCAREADA','ALLEN SEM CABEÇA','ESTOJO','PRISIONEIRO','AUTOATARRAXANTE','CABEÇA CILÍNDRICA COM FENDA','PHILIPS'],{req:1}),
    sel('norma','Norma',['DIN933','DIN931','DIN 912','DIN 913','DIN 915','DIN 916','DIN 939','DIN 835','DIN 898','DIN 7991','DIN 7970','ASTM A193'],{req:1}),
    sel('classe','Classe de resistência',['8.8','10.9','12.9','8'],{na:1}),
    sel('material','Material',['AÇO CARBONO','AÇO CARBONO ASTM A307','INOX AISI 304','INOX AISI 316','INOX AISI 317','AÇO LIGA'],{req:1}),
    sel('acab','Acabamento',ACAB,{na:1}),
    txt('rosca','Rosca (diâmetro)',{req:1,ph:'M10  ou  1/2"'}),
    txt('passo','Passo da rosca',{ph:'1,5'}),
    txt('comp','Comprimento (mm)',{req:1,ph:'30'})]};
  F['PORCA']={modelo:'PORCA {tipo} - {norma} [CL. {classe}] {material} {acab} {rosca}[ - P.{passo}]',campos:[
    sel('tipo','Tipo',['SEXTAVADA','SEXTAVADA AUTO TRAVANTE ALTA','SEXTAVADA AUTO TRAVANTE BAIXA','SEXTAVADA BAIXA','SEXTAVADA FLANGEADA','CASTELO','CASTELO BAIXA','CALOTA','BORBOLETA'],{req:1}),
    sel('norma','Norma',['DIN 934','DIN 982','DIN 985','DIN 936','DIN 1587','ASTM A194 Gr. 2H','ASTM A307'],{req:1}),
    sel('classe','Classe de resistência',['8','8.8','10','12'],{na:1}),
    sel('material','Material',['AÇO CARBONO','AÇO CARBONO ASTM A307','INOX AISI 304','INOX AISI 316','AÇO LIGA'],{req:1}),
    sel('acab','Acabamento',ACAB,{na:1}),
    txt('rosca','Rosca (diâmetro)',{req:1,ph:'M16  ou  5/8"'}),
    txt('passo','Passo da rosca',{ph:'2,0'})]};
  F['ARRUELA']={modelo:'ARRUELA {tipo}[ - {norma}] {material} {acab} {diam}',campos:[
    sel('tipo','Tipo',['LISA','PRESSÃO','PRESSÃO HELICOIDAL','SERRILHADA','TRAVAMENTO','CÔNICA','NORD-LOCK','VEDAÇÃO','LISA BORRACHA','LISA ACETAL'],{req:1}),
    sel('norma','Norma',['DIN 125 A','DIN 127-A','DIN 432','DIN 435','DIN 6798','DIN 9250'],{na:1}),
    sel('material','Material',['AÇO CARBONO','AÇO MOLA','SAE 1020','INOX AISI 304','INOX AISI 316','BORRACHA NBR'],{req:1}),
    sel('acab','Acabamento',ACAB,{na:1}),
    txt('diam','Diâmetro',{req:1,ph:'M10'})]};
  F['CHAPA']={modelo:'CHAPA {tipo} {material} - {norma} - {esp}[ x {larg}][ x {comp}]',campos:[
    sel('tipo','Tipo',['LISA','LAMINADA','XADREZ'],{req:1}),
    sel('material','Material',['AÇO CARBONO','INOX','ALUMÍNIO','POLIURETANO','HARDOX'],{req:1}),
    sel('norma','Norma / grau',['ASTM A 36','ASTM A 516 Gr 70','ASTM A 516 Gr 60','ASTM A 516','ASTM A 283 Gr.C','ASTM A 572','SAE 1020','SAE 1045','AISI 304','AISI 316','AISI 310','AISI 420'],{req:1}),
    txt('esp','Espessura',{req:1,ph:'1/2"  ou  6 mm'}),
    txt('larg','Largura (opcional)',{ph:'1500'}),
    txt('comp','Comprimento (opcional)',{ph:'3000'})]};
  F['BARRA']={modelo:'BARRA {tipo} {bitola} {material} {norma}',campos:[
    sel('tipo','Tipo',['REDONDA','CHATA','QUADRADA','SEXTAVADA','RETANGULAR','ROSCADA','REDONDA FORJADA'],{req:1}),
    txt('bitola','Bitola / dimensões',{req:1,ph:'2 1/4"   ou   3 1/4" X 1/8"'}),
    sel('material','Material',['AÇO CARBONO','AÇO CARBONO ESPECIAL','AÇO INOX','AÇO INOX MARTENSÍTICO','BRONZE'],{req:1}),
    sel('norma','Norma / grau',['SAE 1020','SAE 1045','SAE 4140','SAE 8550','SAE 1010','ASTM A36','ASTM A105','AISI 304','AISI 316','AISI 420'],{req:1})]};
  F['TUBO']={modelo:'TUBO {diam} {norma}[ {parede}]',campos:[
    txt('diam','Diâmetro',{req:1,ph:'2"   ou   Ø105 x Ø60'}),
    sel('norma','Norma / material',['ASTM A106','ASTM A36','ASTM A516 Gr 70','AISI 304','AISI 316','SAE 8550','SAE 1020','SAE 4140'],{req:1}),
    txt('parede','Parede / schedule',{na:1,ph:'SCH 40   ou   PD 3 mm'})]};
  F["O'RING"]={modelo:"O'RING {material} {norma} {dureza} SHORE A {medidas} mm",campos:[
    sel('material','Material',['NITRÍLICA','VITON','FFKM','FFKM CHEMRAZ','SILICONE','FEPM','AFLAS (FEPM)','FKM','EPDM','PTFE','NEOPRENE'],{req:1}),
    sel('norma','Norma',['ISO 3601','DIN 3771'],{na:1}),
    txt('dureza','Dureza (Shore A)',{req:1,ph:'70'}),
    txt('medidas','Medidas (Ø interno X seção)',{req:1,ph:'Ø25,12 X 1,78'})]};
  F['GAXETA']={modelo:'GAXETA {tipo} {medidas} {material}',campos:[
    sel('tipo','Tipo',['QUADRADA TRANÇADA','TRANÇADA','CHEVRON','U1','U2','U4','U5','BORRACHA UA2','QUADRADA'],{req:1}),
    txt('medidas','Medidas',{req:1,ph:'1/4" x 200 mm   ou   Ø80 X Ø104 X 36 mm'}),
    sel('material','Material',['GRAFITE','PTFE','NITRÍLICA (NBR)','VITON','INCONEL','BORRACHA','POLIURETANO','EPDM'],{req:1})]};
  F['ROLAMENTOS']={modelo:'ROLAMENTO {tipo} {marca} {desig}',campos:[
    sel('tipo','Tipo',['RÍGIDO DE ESFERAS','AUTOCOMPENSADOR DE ROLOS','ROLOS CÔNICOS','AXIAL DE ESFERAS','ROLOS CILÍNDRICOS','MANCAL'],{req:1}),
    sel('marca','Marca',['SKF','FAG','NSK','NTN','TIMKEN'],{na:1}),
    txt('desig','Designação do rolamento',{req:1,ph:'6304   ou   23030 CCK/C3W33'})]};
  F['BUCHAS']={modelo:'BUCHA {tipo} {material} {medidas}',campos:[
    sel('tipo','Tipo',['AUTOLUBRIFICANTE','BIPARTIDA AUTOLUBRIFICANTE','TM 23','CILÍNDRICA COM FLANGE','CILÍNDRICA','BIPARTIDA','REDUÇÃO','FIXAÇÃO'],{req:1}),
    sel('material','Material',['BRONZE','BRONZE TM-23','AÇO CARBONO + PTFE','INOX + GRAFITE','AÇO GALVANIZADO COM REVESTIMENTO INTERNO EM GRAFITE SÓLIDO','PTFE'],{req:1}),
    txt('medidas','Medidas (Ø externo X Ø interno)',{req:1,ph:'Ø70 X Ø75'})]};
  F['ANEL DE VEDAÇÃO']={modelo:'ANEL DE VEDAÇÃO {tipo} . {material} {medidas} mm[ CONF. {desenho}]',campos:[
    sel('tipo','Tipo',['PLANO','TIPO RASPADOR','TIPO ARRUELA','COM MOLA','PERFIL ESPECIAL','COMPENSADOR','CÔNICO','LIP SEAL','TIPO V'],{req:1}),
    sel('material','Material',['PTFE','BORRACHA NITRÍLICA','GRAFITE','NEOPRENE','VITON','SILICONE','FKM','INOX','BRONZE'],{req:1}),
    txt('medidas','Medidas (Ø X Ø X espessura)',{req:1,ph:'Ø65 x Ø75 x 10'}),
    txt('desenho','Nº do desenho (se houver)',{ph:'041-000448'})]};
  F['JUNTA']={modelo:'JUNTA {tipo}[ {norma}] {material} {medidas} mm[ CONF. {desenho}]',campos:[
    sel('tipo','Tipo',['VEDAÇÃO','ESPIRALADA','NÃO METÁLICA RF','NÃO METÁLICA FF','RETANGULAR','MOLDADA','QUADRADA','EXPANSÃO'],{req:1}),
    sel('norma','Norma',['ASME B16.21','ASME B16.20','ANSI B16.5'],{na:1}),
    sel('material','Material',['PAPELÃO HIDRÁULICO','GRAFITE','INOX + GRAFITE','PTFE','NEOPRENE','NITRÍLICA (NBR)','AISI 304','AISI 321'],{req:1}),
    txt('medidas','Medidas',{req:1,ph:'Ø569 x Ø645 x 1,6'}),
    txt('desenho','Nº do desenho (se houver)',{})]};
  F['ANEL ELÁSTICO']={modelo:'ANEL ELÁSTICO {tipo} {norma} {material} {medidas} mm',campos:[
    sel('tipo','Tipo',['EXTERNO','INTERNO','RETENÇÃO'],{req:1}),
    sel('norma','Norma',['DIN 471','DIN 472','DIN 7993'],{req:1}),
    sel('material','Material',['AÇO MOLA','AÇO INOX 304','AÇO INOX'],{req:1}),
    txt('medidas','Medidas',{req:1,ph:'Ø50  ou  Ø90 x 3'})]};
  F['PINO']={modelo:'PINO {tipo} {norma} {material} {acab} {medidas} mm',campos:[
    sel('tipo','Tipo',['ELÁSTICO','GRAXEIRO','GRAXEIRO RETO','CÔNICO','CILÍNDRICO','RANHURADO','ROSCADO','TRAVA','GUIA'],{req:1}),
    sel('norma','Norma',['DIN 1481','ISO 8752','ISO 8741','DIN 71412','DIN 976','DIN 7977'],{na:1}),
    sel('material','Material',['AÇO MOLA','AÇO INOX AISI 304','AÇO INOX AISI 420','AÇO CARBONO','AÇO GALVANIZADO'],{req:1}),
    sel('acab','Acabamento',ACAB.concat(['GALVANIZADO']),{na:1}),
    txt('medidas','Medidas',{req:1,ph:'Ø7 x 50'})]};
  F['PERFIL']={modelo:'PERFIL "{tipo}" {material} {norma} . {medidas}',campos:[
    sel('tipo','Perfil',['L','U','I'],{req:1}),
    sel('material','Material',['AÇO CARBONO','AÇO INOX'],{req:1}),
    sel('norma','Norma / grau',['ASTM A36','SAE 1020','SAE 1010','ASTM A6','AISI 304','AISI 316'],{req:1}),
    txt('medidas','Medidas',{req:1,ph:'3" X 3" X 1/4"'})]};
  F['MOLA']={modelo:'MOLA {tipo} {medidas} {material}[ - DES. {desenho}]',campos:[
    sel('tipo','Tipo',['HELICOIDAL DE COMPRESSÃO','HELICOIDAL DE TRAÇÃO','HELICOIDAL DE COMPRESSÃO (ESQUADREJADA)','HELICOIDAL DE COMPRESSÃO (FACETADA)'],{req:1}),
    txt('medidas','Medidas (Ø externo, Ø do fio, comprimento, passo)',{req:1,ph:'Ø39,3 mm Ø3,9 mm 32 mm P.13 mm'}),
    sel('material','Material',['AISI 302','AÇO MOLA','SAE 6150','SAE 1080','ASTM A228','INCONEL'],{req:1}),
    txt('desenho','Nº do desenho (se houver)',{})]};
  F['RETENTOR']={modelo:'RETENTOR {material} {medidas} {norma}',campos:[
    sel('material','Material',['NBR','VITON','NBR COM MOLA'],{req:1}),
    txt('medidas','Medidas (Ø interno X Ø externo X largura)',{req:1,ph:'Ø50 X Ø65 X 8 mm'}),
    sel('norma','Norma',['DIN 3760','DIN 3761'],{na:1})]};
  F['CHAVETA']={modelo:'CHAVETA {tipo} - {norma} {material} {medidas}',campos:[
    sel('tipo','Tipo',['PARALELA COM DUAS EXTREMIDADES ARREDONDADAS','PARALELA COM DUAS EXTREMIDADES RETAS','PARALELA RETANGULAR'],{req:1}),
    sel('norma','Norma',['DIN 6885 A','DIN 6885 B','BS 4235-1'],{req:1}),
    sel('material','Material',['AÇO SAE 1045','AÇO 1045 TREFILADO','ASTM A307'],{req:1}),
    txt('medidas','Medidas (largura X altura X comprimento)',{req:1,ph:'18 X 11 X 90 mm'})]};
  F['FLANGE']={modelo:'FLANGE {tipo} {norma} {classe} {material} DN {dn}',campos:[
    sel('tipo','Tipo',['SOBREPOSTO FF','SOBREPOSTO PLANO RF','SOBREPOSTO FF COM RANHURAS CONCÊNTRICAS','WN RF','PLANO','CEGO'],{req:1}),
    sel('norma','Norma',['ASME B16.5','ANSI B16.5','AWWA C207'],{req:1}),
    sel('classe','Classe / pressão',['150 lbs','300 lbs','150#','300#','CLASSE D'],{req:1}),
    sel('material','Material',['ASTM A105','ASTM A36','ASTM A283 Gr.C'],{req:1}),
    txt('dn','DN',{req:1,ph:'8"'})]};
  F['TINTA']={modelo:'TINTA {base} {espec} {cor}',campos:[
    sel('base','Base',['LÍQUIDA BASE SOLVENTE','LÍQUIDA BASE D\'ÁGUA'],{req:1}),
    txt('espec','Especificação / tipo',{req:1,ph:'EPÓXI ÓXIDO DE FERRO N-1202'}),
    txt('cor','Cor',{req:1,ph:'VERMELHA'})]};
  /* demais famílias: ficha genérica */
  const GEN={modelo:'{familia} {tipo}[ {material}][ {norma}][ {medidas}][ {obs}]',campos:[
    txt('tipo','Descrição do item (tipo / modelo)',{req:1,ph:'o que é o item'}),
    txt('material','Material',{}),
    txt('norma','Norma',{}),
    txt('medidas','Medidas / dimensões',{ph:'Ø50 x 100 mm'}),
    txt('obs','Marca, referência ou nº do desenho',{})]};
  Object.assign(window.MINC_CATALOGO,{MP_FICHAS:F,MP_FICHA_GENERICA:GEN,
    MP_UNIDADE_FAMILIA:{"ABRAÇADEIRA": "un", "ACESSÓRIOS": "un", "ACOPLAMENTO": "un", "ANEL DE VEDAÇÃO": "un", "ANEL ELÁSTICO": "un", "ARRUELA": "un", "ARRUELA DE TRAVA": "un", "ATUADOR ELÉTRICO": "un", "ATUADOR PNEUMÁTICO": "un", "BARRA": "mm", "BUCHAS": "mm", "BUJÃO": "un", "CHAPA": "kg", "CHAVETA": "un", "CONTRA PINO": "un", "CORDÃO O'RING": "m", "CORRENTE": "un", "DIAFRAGMA": "un", "EIXO": "un", "ENGRENAGEM": "un", "FLANGE": "un", "GAXETA": "kg", "GRAMPOS": "un", "GUIA": "un", "JOELHO": "un", "JUNTA": "un", "MANCAL": "un", "MANGUEIRA": "m", "MATERIAL FORJADO": "un", "MATERIAL FUNDIDO": "un", "MOLA": "un", "MOTOREDUTOR": "un", "MOTORES ELÉTRICOS": "un", "O'RING": "un", "PARAFUSO": "un", "PERFIL": "mm", "PEÇA FUNDIDA": "pç", "PEÇA USINADA": "pç", "PINO": "un", "PORCA": "un", "PORCA DE FIXAÇÃO": "un", "QUADRIRING": "un", "REBITE": "un", "REDUTOR": "un", "RETENTOR": "un", "ROLAMENTOS": "un", "SENSORS ELÉTRICOS": "un", "SUCATA": "kg", "TAMPÃO": "un", "TELA": "m²", "TINTA": "galão", "TUBO": "mm", "TÊ": "un", "UNIÃO": "un", "V'RING": "un", "VÁLVULA AGULHA": "un", "VÁLVULA BORBOLETA": "un", "VÁLVULA DE RETENÇÃO": "un", "VÁLVULA ESFERA": "un"}});
})();
