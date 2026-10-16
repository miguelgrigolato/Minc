/* node servicehub/tests/custos-calc.test.js — testes das regras de custo (sem navegador) */
const assert=require('assert');const C=require('../custos-calc.js');
let n=0;const t=(nome,fn)=>{try{fn();n++;console.log('ok   '+nome)}catch(e){console.log('FALHA '+nome+'\n  '+e.message);process.exitCode=1}};
t('parseNum aceita padrão brasileiro',()=>{assert.strictEqual(C.parseNum('1.234,56'),1234.56);assert.strictEqual(C.parseNum('12,5'),12.5);assert.strictEqual(C.parseNum('R$ 1.000'),1000);assert.strictEqual(C.parseNum('12.5'),12.5);assert.strictEqual(C.parseNum(''),null);assert.strictEqual(C.parseNum('abc'),null)});
t('total = qtd x preço, 2 casas, meia-unidade para cima',()=>{assert.strictEqual(C.linha({qtd:2,preco:500}).total,1000);assert.strictEqual(C.linha({qtd:1.5,preco:12}).total,18);assert.strictEqual(C.linha({qtd:3,preco:0.335}).total,1.01);assert.strictEqual(C.linha({qtd:1.005,preco:1}).total,1.01)});
t('mão de obra = pessoas x horas x valor/h',()=>{assert.strictEqual(C.linha({sec:'mo',qtd:2,horas:32,preco:70}).total,4480)});
t('zero digitado é zero; vazio é vazio; falta dado é pendente (nunca zero)',()=>{
  assert.strictEqual(C.linha({qtd:1,preco:0}).total,0);assert.strictEqual(C.linha({qtd:1,preco:0}).estado,'ok');
  assert.strictEqual(C.linha({}).estado,'vazio');
  const l=C.linha({qtd:2});assert.strictEqual(l.estado,'pendente');assert.strictEqual(l.total,null);assert.deepStrictEqual(l.falta,['preço']);
  assert.strictEqual(C.linha({sec:'mo',qtd:1,preco:70}).estado,'vazio');
  assert.deepStrictEqual(C.linha({sec:'mo',qtd:1,horas:4}).falta,['valor da hora'])});
t('resumo: subtotais, total, contagens, parcial',()=>{
  const r=C.resumo([{qtd:2,preco:500,preco_tipo:'referencia'},{qtd:1.5},{sec:'mo',qtd:1,horas:32,preco:70,preco_tipo:'informado'},{}]);
  assert.strictEqual(r.total,3240);assert.strictEqual(r.subtotais.mat,1000);assert.strictEqual(r.subtotais.mo,2240);assert.strictEqual(r.itens,3);assert.strictEqual(r.pendentes,1);assert.strictEqual(r.estimados,1);assert.strictEqual(r.informados,1);assert.strictEqual(r.parcial,true)});
t('orçamento inicial: nenhuma linha conta enquanto estiver em branco',()=>{const o=C.orcamentoInicial();const r=C.resumo(o.itens);assert.strictEqual(r.itens,0);assert.strictEqual(r.total,0);assert.ok(o.itens.length>30)});
const hoje=new Date(Date.UTC(2026,9,16));
const reg=(o)=>Object.assign({data:'2026-08-01',situacao:'Atendido',quantidade:10,valorUnitario:10,unidade:'PÇ',moeda:'R$'},o);
t('referência: média ponderada pela quantidade',()=>{const r=C.refPrice([reg({quantidade:10,valorUnitario:10}),reg({quantidade:30,valorUnitario:20,data:'2026-05-02'})],{un:'PÇ',hoje});assert.strictEqual(r.valor,17.5);assert.strictEqual(r.n,2);assert.strictEqual(r.ultimaCompra,'2026-08-01');assert.strictEqual(r.confianca,'média')});
t('referência: 3+ compras recentes = confiança alta',()=>{const r=C.refPrice([reg({}),reg({data:'2026-07-01'}),reg({data:'2026-06-01'})],{un:'PÇ',hoje});assert.strictEqual(r.confianca,'alta')});
t('referência: exclui cancelada, devolvida, outra unidade, outra moeda, sem preço, data futura',()=>{
  const r=C.refPrice([reg({situacao:'Cancelado'}),reg({situacao:'Devolvido'}),reg({unidade:'KG'}),reg({moeda:'USD'}),reg({valorUnitario:null}),reg({data:'2027-01-01'}),reg({valorUnitario:7})],{un:'PÇ',hoje});
  assert.strictEqual(r.valor,7);assert.strictEqual(r.n,1);assert.strictEqual(Object.values(r.excluidos).reduce((a,b)=>a+b,0),6);assert.strictEqual(r.excluidos['cancelada ou devolvida'],2)});
t('referência: histórico antigo vira confiança baixa e é avisado; muito antigo não sugere',()=>{
  const a=C.refPrice([reg({data:'2025-01-10'})],{un:'PÇ',hoje});assert.strictEqual(a.confianca,'baixa');assert.strictEqual(a.antigo,true);assert.ok(a.valor>0);
  const b=C.refPrice([reg({data:'2020-01-10'})],{un:'PÇ',hoje});assert.strictEqual(b.valor,null);assert.ok(/antigo demais/.test(b.motivo))});
t('referência: sem histórico não inventa preço',()=>{const r=C.refPrice([],{un:'PÇ',hoje});assert.strictEqual(r.valor,null);assert.strictEqual(r.n,0)});
t('referência: descarta preço fora do padrão (>3x a mediana)',()=>{const r=C.refPrice([reg({valorUnitario:10}),reg({valorUnitario:11}),reg({valorUnitario:9}),reg({valorUnitario:500})],{un:'PÇ',hoje});assert.ok(r.valor<12);assert.strictEqual(r.excluidos['preço fora do padrão'],1)});
t('referência: datas em dd/mm/aaaa',()=>{const r=C.refPrice([reg({data:'01/08/2026'})],{un:'PÇ',hoje});assert.strictEqual(r.ultimaCompra,'2026-08-01')});
t('importação: novos, alterados e sumidos, sem tocar em preço',()=>{
  const it=C.itemNovo({desc:'PARAFUSO',qtd:4,preco:2,origem:{tipo:'de',chave:'k1',snap:C.snapOf({desc:'PARAFUSO',un:'PÇ',qtd:4})}});
  const it2=C.itemNovo({desc:'ANTIGO',origem:{tipo:'rts',chave:'k9',snap:C.snapOf({desc:'ANTIGO',un:'PÇ',qtd:1})}});
  const p=C.planoImportacao([it,it2],[{chave:'k1',desc:'PARAFUSO',un:'PÇ',qtd:6},{chave:'k2',desc:'NOVO',un:'PÇ',qtd:1}]);
  assert.strictEqual(p.novos.length,1);assert.strictEqual(p.alterados.length,1);assert.strictEqual(p.alterados[0].mud[0].campo,'qtd');assert.strictEqual(p.sumiram.length,1);
  const igual=C.planoImportacao([it],[{chave:'k1',desc:'parafuso',un:'pç',qtd:4}]);assert.strictEqual(igual.alterados.length,0)});

const L=(o)=>Object.assign({linha:2,disc:'Documento de entrada',codigo:'01.03.1',descricao:'PARAFUSO',familia:'PARAFUSO',tipo:'Materia prima',mov:'Compra',um:'UNIDADE',qtd:10,vtot:20,vun:2,fornecedor:'FORN A',data:new Date(Date.UTC(2026,5,1,10,0,0))},o);
t('unidades do Nomus casam com as do app',()=>{for(const [a,b] of [['PÇ','UNIDADE'],['KG','QUILOGRAMA'],['MM','MILIMETRO'],['M','METRO'],['LT','LITRO'],['CJ','JOGO'],['UN','PEÇA']])assert.strictEqual(C.normUn(a),C.normUn(b),a+' x '+b);assert.notStrictEqual(C.normUn('MM'),C.normUn('M'))});
t('limpeza: tira erro de valor/quantidade, código genérico e repetida; mantém serviço',()=>{
  const linhas=[L({}),L({qtd:5,vtot:10,vun:2,data:new Date(Date.UTC(2026,5,2))}),
    L({qtd:0.05,vtot:204.42,vun:204.42,codigo:'06.16.7.116'}),                       // total != qtd x unitário
    L({um:'MILIMETRO',qtd:405,vun:884.52,vtot:358.23,codigo:'01.09.1'}),             // unitário por metro em linha de mm
    L({vun:0,vtot:0,codigo:'01.03.9'}),L({codigo:'XML-NFe entrada',descricao:'Produto padrão'}),
    L({}),L({}),                                                                       // repetidas
    L({disc:'Documento de compra de serviço',tipo:'Serviço',codigo:'09.1.0003',descricao:'CORTE DE CHAPA',vun:6.8,vtot:6.8,qtd:1}),
    L({disc:'Documento de compra de serviço',tipo:'Serviço',codigo:'09.1.0003',descricao:'CORTE DE CHAPA',vun:15000,vtot:15000,qtd:1,data:new Date(Date.UTC(2026,6,1))})];
  const r=C.limparCompras(linhas);
  assert.strictEqual(r.descartadas.length,6);assert.strictEqual(r.mantidas.length,4);
  assert.strictEqual(r.mantidas.filter(C.ehServico).length,2);          // serviços ficam, mesmo com preço muito diferente
  assert.strictEqual(r.resumo['Linha repetida (ficou uma cópia)'],2)});
t('limpeza: preço fora do padrão do código sai (só com 3+ compras)',()=>{
  const l=[10,11,9,12,500].map((v,i)=>L({vun:v,vtot:v*10,data:new Date(Date.UTC(2026,5,1+i))}));
  const r=C.limparCompras(l);assert.strictEqual(r.descartadas.length,1);assert.strictEqual(r.descartadas[0].vun,500);
  const dois=C.limparCompras([L({vun:10,vtot:100}),L({vun:900,vtot:9000,data:new Date(Date.UTC(2026,5,5))})]);assert.strictEqual(dois.descartadas.length,0)});
t('referência: quantidade fora de série não domina a média',()=>{
  const reg=(v,q,d)=>({data:d,situacao:'',quantidade:q,valorUnitario:v,unidade:'KG',moeda:'R$'});
  const r=C.refPrice([reg(10,5,'2026-08-01'),reg(11,6,'2026-07-01'),reg(10.5,5000,'2026-06-01')],{un:'KG',hoje});
  assert.ok(r.valor>10&&r.valor<10.8,String(r.valor))});
t('leitura da planilha: cabeçalho do Nomus e hora preservada',()=>{
  const h=['Discriminador do item documento estoque/serviço','Código do produto do item de documento estoque/serviço','Descrição do produto do item de documento estoque/serviço','Família de produto do item de documento estoque/serviço','Tipo de produto do item de documento estoque/serviço','Tipo de movimentação do item de documento estoque/serviço','U.M. principal do item do documento de estoque/serviço','Quantidade na U.M. principal do item documento estoque/serviço','Valor total do item de documento estoque','Valor unitário do item de documento estoque/serviço','Classificação financeira do item de documento estoque','Pessoa do documento estoque/serviço','Data/hora da última modificação do documento','Data/hora da criação do documento estoque/serviço','Condição de pagamento do documento estoque/serviço'];
  const r=C.lerPlanilhaCompras([h,['Documento de entrada','07.15.5.23','TRAPO','MAT','Material de uso e consumo','Compra','QUILOGRAMA',80,792,9.9,'x','FORN','2025-09-30 13:49:02','2025-09-30 13:45:30','30 dias']]);
  assert.strictEqual(r.linhas.length,1);assert.strictEqual(r.linhas[0].data.toISOString(),'2025-09-30T13:45:30.000Z');assert.strictEqual(r.linhas[0].qtd,80);
  assert.ok(C.lerPlanilhaCompras([['a','b'],[1,2]]).erro)});
t('nome: palavras da busca (sem artigo, no singular, sem acento) e níveis',()=>{
  assert.deepStrictEqual(C.tokensNome('JUNTA DA VEDAÇÃO DO DISCO').sort(),['disco','junta','vedacao']);
  assert.deepStrictEqual(C.niveisBusca('TINTAS E SOLVENTES'),[['solvente','tinta']]);
  assert.deepStrictEqual(C.niveisBusca('CONJUNTO DE GAXETAS'),[['gaxeta']]);
  assert.strictEqual(C.niveisBusca('JUNTA DA VEDAÇÃO DO DISCO').length,2);
  assert.ok(C.niveisBusca('USINAGEM - SERVIÇO EXTERNO',1).some(n=>n.length===1))});
t('nome: mediana dos preços por item parecido; unidade incompatível não vira preço',()=>{
  const r=(cod,v,q,un='UNIDADE',d='2026-08-01')=>({codigo:cod,descricao:'ITEM '+cod,data:d,quantidade:q,valorUnitario:v,unidade:un,moeda:'R$'});
  const a=C.refPorNome([r('A',10,5),r('A',12,5),r('B',100,1),r('C',50,1)],{un:'PÇ',hoje});
  assert.strictEqual(a.valor,50);assert.strictEqual(a.codigos,3);assert.strictEqual(a.min,11);assert.strictEqual(a.max,100);assert.ok(a.candidatos.length===3&&a.porNome);
  const b=C.refPorNome([r('A',10,5,'LITRO')],{un:'PÇ',hoje});assert.strictEqual(b.valor,null);assert.ok(/outra unidade/.test(b.motivo));
  const c0=C.refPorNome([],{un:'PÇ',hoje});assert.strictEqual(c0.valor,null);
  const u=C.refPorNome([r('A',10,5)],{un:'PÇ',hoje});assert.strictEqual(u.confianca,'média');assert.strictEqual(u.codigos,1)});
console.log(n+' testes ok');
