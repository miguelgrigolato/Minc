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
console.log(n+' testes ok');
