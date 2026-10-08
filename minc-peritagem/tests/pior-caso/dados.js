/* Dados de teste do seletor "Demo / Pior caso" (só teste local; não vai para o Netlify).
   Cada conjunto entra pela MESMA porta que os dados reais: a store "processes" do IndexedDB do app.
   O "pior caso" usa valores que um usuário real produz (nomes longos de equipamento e cliente, números de pedido
   sem espaço, campos vazios, acentos vietnamitas, aspas e &), espalhados pelas primeiras linhas da lista. */
(function () {
  const DIA = 864e5, AGORA = Date.UTC(2026, 9, 8, 14, 0, 0);
  const iso = d => new Date(d).toISOString();
  let n = 0; const id = p => `${p}-teste-${(++n).toString(36)}`;

  function proc(o) {
    const at = o.at ?? AGORA - (n + 1) * 3600e3;
    return Object.assign({
      id: id('REP'), createdAt: iso(at - 5 * DIA), updatedAt: iso(at), status: 'Rascunho',
      process: '', pedido: '', ordem: '', equipamento: '', cliente: '', observacoes: '',
      vedacao: '', acionamento: '', fluido: '', createdBy: 'ADMINISTRADOR', updatedBy: 'ADMINISTRADOR',
      components: [], equipmentPhotos: [], anexos: []
    }, o);
  }
  function comp(o) {
    return Object.assign({ id: id('CMP'), name: '', drawing: '', noDrawing: false, acoes: ['Recuperar'], materials: [], parentId: null,
      codigo: '', qtd: '1', unid: 'un', atividades: [], photos: [], anexos: [], obs: '', servicos: [] }, o);
  }
  const ativ = (sector, act, detail = '') => ({ id: id('AT'), sectorId: null, sector, actId: 'x-' + act, act, detail, reqDetail: false });

  /* ---------- Demo: o que a equipe costuma usar ao mostrar o app ---------- */
  function demo() {
    n = 0;
    return [
      proc({ status: 'Em execução', process: '4512', pedido: 'PV-778', ordem: 'OS-2104', equipamento: 'VÁLVULA GAVETA 6"', cliente: 'PETROBRAS', vedacao: 'Metal x Metal', acionamento: 'Manual',
        components: [comp({ name: 'HASTE', drawing: 'DES-001', acoes: ['Recuperar'], atividades: [ativ('Usinagem', 'Polimento')] }), comp({ name: 'CUNHA', drawing: 'DES-002', acoes: ['Fabricar'] })] }),
      proc({ status: 'Rascunho', process: '4513', pedido: 'PV-779', ordem: 'OS-2105', equipamento: 'VÁLVULA ESFERA 4"', cliente: 'GERDAU', vedacao: 'Resiliente', acionamento: 'Atuador Pneumático' }),
      proc({ status: 'Concluído', process: '4498', pedido: 'PV-760', ordem: 'OS-2090', equipamento: 'VÁLVULA BORBOLETA 8"', cliente: 'SABESP', vedacao: 'Resiliente', acionamento: 'Motor' })
    ];
  }

  /* ---------- Pior caso ---------- */
  function pior() {
    n = 0;
    const sub = comp({ name: 'CONJUNTO DE VEDAÇÃO SECUNDÁRIA DO MANCAL INFERIOR COM ANEL O-RING VITON 85 SHORE A E ANEL ANTIEXTRUSÃO PTFE', drawing: 'DES-MINC-2026-000184-FL-03-REV-B-FOLHA-12-DE-14', acoes: ['Substituir'] });
    const neto = comp({ name: 'ANEL', parentId: sub.id, acoes: ['Fabricar'], noDrawing: true });
    const bisneto = comp({ name: 'PARAFUSO-ALLEN-M12X1,75X80-AÇO-LIGA-CLASSE-12.9-ZINCADO-A-FOGO', parentId: neto.id, acoes: ['Substituir'], noDrawing: true });
    const longos = Array.from({ length: 11 }, (_, i) => comp({ name: i % 3 ? 'COMPONENTE ' + (i + 1) : 'TAMPA DO CASTELO COM SEDE INTEGRADA PARA GAXETA E BUCHA GUIA DA HASTE ' + (i + 1), drawing: i % 2 ? 'D-' + i : 'DES-MINC-2026-000184-FL-0' + i,
      acoes: [['Recuperar', 'Fabricar', 'Reutilizar', 'Substituir'][i % 4]], atividades: i % 4 === 0 ? [ativ('Caldeiraria', 'Preencher Área com Solda'), ativ('Usinagem', 'Normalizar Faces', 'NORMALIZAR AS DUAS FACES DE VEDAÇÃO DO FLANGE CONFORME DESENHO DES-MINC-2026-000184-FL-03-REV-B, TOLERÂNCIA ±0,05 MM')] : [] }));
    return [
      // 1 · tudo longo, todos os campos preenchidos, muitos componentes, subcomponentes em 4 níveis, anexos de nome longo
      proc({ status: 'Em execução', at: AGORA - 60e3, process: '2026-000184-REV-03', pedido: 'PV-0004512/2026-A', ordem: 'OS-0002104-COMPLEMENTAR-02',
        equipamento: 'VÁLVULA ESFERA TRIPARTIDA FLANGEADA CLASSE 300 AÇO INOX ASTM A351 CF8M 10" COM ATUADOR PNEUMÁTICO DUPLA AÇÃO',
        cliente: 'PETRÓLEO BRASILEIRO S.A. – PETROBRAS – REFINARIA PRESIDENTE GETÚLIO VARGAS (REPAR)',
        vedacao: 'Não aplicável', acionamento: 'Atuador Pneumático', fluido: 'ÓLEO TÉRMICO A 280 °C',
        createdBy: 'ALEKSANDRA WIŚNIEWSKA-KOWALCZYK', updatedBy: 'CHRISTOPHER ALEXANDER MONTGOMERY III',
        components: [sub, neto, bisneto, ...longos],
        anexos: [
          { id: id('ANX'), name: 'Laudo técnico de inspeção dimensional — VÁLVULA 10 pol — FINAL (revisado) v12 [aprovado pela engenharia].pdf', type: 'application/pdf', size: 24.9 * 1048576, ext: '.pdf' },
          { id: id('ANX'), name: 'R-MINC-046-DEP-PT_OS2104_Nomus3709_Rev01_assinado_digitalizado_scan_0001_0002_0003.pdf', type: 'application/pdf', size: 812345, ext: '.pdf' },
          { id: id('ANX'), name: 'a.dwg', type: '', size: 1, ext: '.dwg' }
        ],
        equipmentPhotos: [{ id: id('IMG'), name: 'IMG_20250914_183022_HDR_portrait_edited_edited.HEIC' }]   // referência sem a foto baixada
      }),
      // 2 · curtíssimo: uma letra, e "Concluído"
      proc({ status: 'Concluído', process: '1', pedido: '1', ordem: '1', equipamento: 'V', cliente: 'JO', vedacao: 'Resiliente', acionamento: 'Manual', components: [comp({ name: 'X', noDrawing: true })] }),
      // 3 · nada preenchido (rascunho recém-criado)
      proc({ status: 'Rascunho' }),
      // 4 · palavras sem espaço (não quebram sozinhas)
      proc({ status: 'Rascunho', process: '00000000000000000000184', pedido: 'PV/2026/0004512/ALTERAÇÃO-COMERCIAL-APROVADA',
        equipamento: 'VÁLVULA-GAVETA-CUNHA-SÓLIDA-ASTM-A216-WCB-CL600-RTJ-12POL-HASTE-ASCENDENTE',
        cliente: 'COMPANHIA-SIDERÚRGICA-NACIONAL-UNIDADE-PRESIDENTE-VARGAS-VOLTA-REDONDA' }),
      // 5 · acentos empilhados, aspas, & e < > (precisam aparecer como texto)
      proc({ status: 'Em execução', process: '4514', pedido: 'PV-780', equipamento: 'VÁLVULA "BORBOLETA" 6" & 8" <TRIPLO EXCÊNTRICA>', cliente: 'ĐẶNG THỊ NGỌC HÂN ENGENHARIA LTDA', ordem: 'OS-1' }),
      // 6 · editado há muito tempo e criado "no futuro" (relógio do aparelho errado)
      proc({ status: 'Concluído', at: Date.UTC(2019, 0, 2), createdAt: iso(AGORA + 40 * DIA), process: '12', pedido: 'P', equipamento: 'REDUTOR', cliente: 'SABESP', ordem: 'OS-9' })
    ];
  }

  /* ---------- Um ---------- */
  function um() {
    n = 0;
    return [proc({ status: 'Rascunho', process: '7', pedido: 'PV-1', equipamento: 'VÁLVULA RETENÇÃO 2"', cliente: 'GERDAU', components: [comp({ name: 'DISCO', drawing: 'D-1' })],
      anexos: [{ id: id('ANX'), name: 'laudo.pdf', type: 'application/pdf', size: 1024, ext: '.pdf' }] })];
  }

  /* ---------- 1.000 processos (a lista não tem paginação) ---------- */
  function mil() {
    n = 0;
    const st = ['Rascunho', 'Em execução', 'Concluído'], eq = ['VÁLVULA GAVETA', 'VÁLVULA ESFERA', 'VÁLVULA BORBOLETA', 'REDUTOR', 'ATUADOR'];
    return Array.from({ length: 1000 }, (_, i) => proc({ at: AGORA - i * 3600e3, status: st[i % 3], process: String(3000 + i), pedido: 'PV-' + (5000 + i), ordem: i % 5 ? 'OS-' + i : '',
      equipamento: `${eq[i % 5]} ${2 + (i % 10)}"`, cliente: ['PETROBRAS', 'GERDAU', 'SABESP', 'VALE', 'BRASKEM'][i % 5] }));
  }

  window.DADOS_TESTE = { demo, pior, vazio: () => [], um, mil };
})();
