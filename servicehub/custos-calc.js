/* MINC · ServiceHub — Custos: regras de cálculo (v5.29.0). Sem tela, sem rede: roda no navegador e no Node (testes).
   - total da linha = quantidade × preço (mão de obra: pessoas × horas × preço/h), em centavos, arredondando meia-unidade para cima,
     igual ao gatilho rts_costs_calc do banco (que é quem vale);
   - linha sem quantidade/preço NÃO vira zero: fica "pendente" (zero só quando a pessoa digitou 0);
   - preço de referência do Nomus: média ponderada pela quantidade comprada, só do mesmo material (código) e da mesma unidade. */
(function(root){
'use strict';

const SECS=[
  {k:'mat',t:'Materiais',doc:'MATERIAIS'},
  {k:'mo',t:'Mão de obra (H/H setorial)',doc:'H/H SETORIAL'},
  {k:'out',t:'Despesas complementares',doc:'OUTROS CUSTOS COMPLEMENTARES'},
  {k:'srv',t:'Serviços externos e complementares',doc:'SERVIÇOS EXTERNOS E COMPLEMENTARES'}
];
const UNIDADES=['PÇ','CJ','KG','LT','UN','M','M²','H'];

/* ---------- números no padrão brasileiro ---------- */
function parseNum(v){
  if(v==null)return null;
  if(typeof v==='number')return Number.isFinite(v)?v:null;
  let s=String(v).trim().replace(/\s|R\$/g,'');
  if(!s)return null;
  if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
  else if(/^\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,'');
  const n=Number(s);
  return Number.isFinite(n)?n:null;
}
const dec=(v,d)=>{const n=parseNum(v);return n==null?null:Number(n.toFixed(d))};
const scaled=(n,d)=>BigInt(Math.round(n*10**d));
/* produto de fatores decimais, devolvido em centavos (meia-unidade para cima, como o round() do banco) */
function cents(parts){
  let prod=1n,sd=0;
  for(const [v,d] of parts){prod*=scaled(v,d);sd+=d}
  const k=BigInt(10**Math.max(0,sd-2));
  return Number((prod*2n+k)/(2n*k))/100;   // (prod/k) arredondado
}

/* ---------- linha e resumo ---------- */
/* estado: vazio (nada digitado: ignorada), pendente (falta quantidade, preço ou horas), ok */
function linha(it){
  const sec=it.sec||'mat',q=parseNum(it.qtd),p=parseNum(it.preco),h=parseNum(it.horas);
  let vazio,ok;
  if(sec==='mo'){vazio=h==null;ok=q!=null&&p!=null&&h!=null}
  else{vazio=q==null&&p==null;ok=q!=null&&p!=null}
  if(vazio)return{estado:'vazio',total:null,falta:[]};
  if(!ok){
    const falta=[];
    if(q==null)falta.push(sec==='mo'?'pessoas':'quantidade');
    if(p==null)falta.push(sec==='mo'?'valor da hora':'preço');
    if(sec==='mo'&&h==null)falta.push('horas');
    return{estado:'pendente',total:null,falta};
  }
  const total=sec==='mo'?cents([[q,3],[h,2],[p,4]]):cents([[q,3],[p,4]]);
  return{estado:'ok',total,falta:[]};
}
function resumo(itens){
  const sub={mat:0,mo:0,out:0,srv:0};let n=0,pend=0,est=0,inf=0,tot=0;
  for(const it of itens){
    const l=linha(it);
    if(l.estado==='vazio')continue;
    n++;
    if(l.estado==='pendente'){pend++;continue}
    sub[it.sec||'mat']=Math.round((sub[it.sec||'mat']+l.total)*100)/100;
    tot=Math.round((tot+l.total)*100)/100;
    if(it.preco_tipo==='referencia')est++;else inf++;
  }
  return{subtotais:sub,total:tot,itens:n,pendentes:pend,estimados:est,informados:inf,parcial:pend>0};
}

/* ---------- preço de referência a partir do histórico de compras ---------- */
const SIT_RUIM=/cancel|devolv|estorn|rejeit|reprov|exclu/i;
const fold=t=>String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
const normUn=u=>{
  const t=fold(u).replace(/[^A-Z0-9]/g,'');
  if(/^(PC|PCS|PECA|PECAS|UNID|UNIDADE|UND|UN)$/.test(t))return 'UN';
  if(/^(LITRO|LITROS|LT|L)$/.test(t))return 'LT';
  if(/^(QUILO|KILO|QUILOS|QUILOGRAMA|QUILOGRAMAS|KG)$/.test(t))return 'KG';
  if(/^(CONJUNTO|CJ|KIT|JG|JOGO)$/.test(t))return 'CJ';
  if(/^(METRO|METROS|MT|M)$/.test(t))return 'M';
  if(/^(MILIMETRO|MILIMETROS|MM)$/.test(t))return 'MM';
  if(/^(METROQUADRADO|M2)$/.test(t))return 'M2';
  if(/^(GL|GALAO|GALOES)$/.test(t))return 'GL';
  if(/^(HORA|HORAS|H|HR)$/.test(t))return 'H';
  return t;
};
function dataDe(s){
  if(!s)return null;
  const t=String(s).trim();let m=/^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if(m)return new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
  m=/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(t);
  if(m){const y=+m[3]<100?2000+ +m[3]:+m[3];return new Date(Date.UTC(y,+m[2]-1,+m[1]))}
  return null;
}
const meses=(a,b)=>(b-a)/(1000*60*60*24*30.4375);
const iso=d=>d.toISOString().slice(0,10);
function mediana(v){const s=[...v].sort((a,b)=>a-b),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2}
function refPrice(registros,{un='',hoje=new Date(),janela=12,maxJanela=36,servico=false}={}){
  const exc={};const bump=k=>{exc[k]=(exc[k]||0)+1};
  const ok=[];
  for(const r of registros||[]){
    const v=parseNum(r.valorUnitario),q=parseNum(r.quantidade),d=dataDe(r.data);
    if(v==null||v<=0){bump('sem preço');continue}
    if(q==null||q<=0){bump('sem quantidade');continue}
    if(!d){bump('sem data');continue}
    if(d>new Date(hoje.getTime()+864e5)){bump('data futura');continue}
    if(SIT_RUIM.test(r.situacao||'')){bump('cancelada ou devolvida');continue}
    if(r.moeda&&!/^(R\$|BRL|REAL|REAIS)$/i.test(String(r.moeda).trim())){bump('moeda diferente');continue}
    if(un&&r.unidade&&normUn(un)!==normUn(r.unidade)){bump('unidade diferente');continue}
    ok.push({v,q,d,idade:meses(d,hoje),fornecedor:r.fornecedor||'',pedido:r.pedido||''});
  }
  if(!ok.length)return{valor:null,n:0,motivo:registros&&registros.length?'Nenhuma compra utilizável (ver exclusões).':'Sem histórico de compras deste código.',excluidos:exc};
  let pool=ok.filter(x=>x.idade<=janela),antigo=false;
  if(!pool.length){pool=ok.filter(x=>x.idade<=maxJanela);antigo=true}
  if(!pool.length)return{valor:null,n:0,motivo:`Última compra há mais de ${maxJanela} meses (${iso(ok.sort((a,b)=>b.d-a.d)[0].d)}): histórico antigo demais para sugerir preço.`,excluidos:exc,ultimaCompra:iso(ok.sort((a,b)=>b.d-a.d)[0].d)};
  let outliers=0;
  if(pool.length>=3&&!servico){const md=mediana(pool.map(x=>x.v)),keep=pool.filter(x=>x.v>=md/3&&x.v<=md*3);outliers=pool.length-keep.length;if(outliers){exc['preço fora do padrão']=outliers;pool=keep}}
  /* uma quantidade fora de série (ex.: 6.000 no lugar de 6) não pode dominar a média: peso limitado a 5x a quantidade mediana */
  const capQ=5*mediana(pool.map(x=>x.q)),w=x=>Math.min(x.q,capQ);
  const sq=pool.reduce((s,x)=>s+w(x),0),valor=pool.reduce((s,x)=>s+x.v*w(x),0)/sq;
  const ult=[...pool].sort((a,b)=>b.d-a.d)[0];
  const confianca=antigo?'baixa':servico?(pool.length>=3?'média':'baixa'):pool.length>=3?'alta':pool.length===2?'média':'baixa';
  return{
    valor:Number(valor.toFixed(4)),n:pool.length,ultimaCompra:iso(ult.d),ultimoPreco:ult.v,min:Math.min(...pool.map(x=>x.v)),max:Math.max(...pool.map(x=>x.v)),
    confianca,antigo,excluidos:exc,un:un||'',
    servico,metodo:`${servico?'serviço (o preço varia com o escopo): ':''}média ponderada pela quantidade comprada, ${antigo?`compras de até ${maxJanela} meses (nenhuma nos últimos ${janela})`:`compras dos últimos ${janela} meses`}`
  };
}


/* ---------- referência pelo NOME do item (quando não há código do Nomus) ---------- */
const STOP=new Set('de da do das dos para com e em a o as os um uma no na nos nas por sem ao conjunto kit jogo peca pecas novo nova tipo completo servico servicos'.split(' '));
const stem=w=>w.length>3&&w.endsWith('s')&&!w.endsWith('ss')?w.slice(0,-1):w;
/* palavras que valem na busca: sem acento, sem artigos, no singular */
function tokensNome(desc){
  return [...new Set(fold(desc).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(' ').filter(w=>w&&!STOP.has(w)&&(w.length>1||/\d/.test(w))).map(stem))];
}
/* níveis de busca, do mais exato ao mais amplo: todas as palavras (até 4); depois tirando as mais curtas, mas nunca menos que 2 palavras (ou 1, se o item só tem 1) */
function niveisBusca(desc,minimo=2){
  const t=tokensNome(desc).sort((a,b)=>b.length-a.length).slice(0,4);
  const out=[],min=Math.min(minimo,t.length);
  for(let n=t.length;n>=min;n--)out.push(t.slice(0,n));
  return out;
}
/* registros: linhas do histórico {codigo,descricao,data,quantidade,valorUnitario,unidade,...}. Agrupa por código, calcula a referência de cada um e
   usa a MEDIANA dos preços por código (itens parecidos têm tamanhos diferentes: uma média simples seria enganosa). */
function refPorNome(registros,{un='',servico=false,hoje=new Date(),palavras=[],amplo=false}={}){
  const por={};for(const r of registros||[])(por[r.codigo]=por[r.codigo]||[]).push(r);
  const cands=[];
  for(const [cod,l] of Object.entries(por)){
    const rp=refPrice(l,{un,hoje,servico});
    if(rp.valor!=null)cands.push({codigo:cod,descricao:l[0].descricao||'',ref:rp});
  }
  if(!cands.length){
    const unidades=[...new Set((registros||[]).map(r=>r.unidade).filter(Boolean))].slice(0,3).join(', ');
    return{valor:null,n:0,porNome:true,motivo:registros&&registros.length?(unidades&&un&&!registros.some(r=>normUn(r.unidade)===normUn(un))?`Há compras parecidas, mas em outra unidade (${unidades}); este item está em ${un}.`:'Compras parecidas encontradas, mas nenhuma utilizável (muito antigas ou com dados incompletos).'):'Nenhuma compra com este nome na base.'};
  }
  cands.sort((a,b)=>b.ref.n-a.ref.n||b.ref.ultimaCompra.localeCompare(a.ref.ultimaCompra));
  const v=cands.map(c=>c.ref.valor),valor=Number(mediana(v).toFixed(4));
  const n=cands.reduce((s,c)=>s+c.ref.n,0),ult=cands.map(c=>c.ref.ultimaCompra).sort().pop();
  const antigo=cands.every(c=>c.ref.antigo);
  const um=cands.length===1;   // um único código parecido: é praticamente o item; vários: é uma estimativa pelo nome
  return{valor,n,ultimaCompra:ult,min:Math.min(...v),max:Math.max(...v),porNome:true,codigos:cands.length,palavras,amplo,antigo,servico,un,
    confianca:antigo||amplo||(!um&&cands.length>6)?'baixa':'média',
    metodo:um?'um único item com esse nome na base':`mediana dos preços de ${cands.length} itens parecidos (cada um pela média ponderada de suas compras)`,
    candidatos:cands.slice(0,8).map(c=>({codigo:c.codigo,descricao:c.descricao,ref:c.ref})),excluidos:{}};
}

/* ---------- importação da lista de materiais sem duplicar nem sobrescrever ---------- */
const nz=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
const snapOf=f=>({desc:nz(f.desc),un:String(f.un||'').toUpperCase(),qtd:parseNum(f.qtd)});
/* fontes: [{chave, sec, cat, codigo, desc, un, qtd, origemTipo}] ; itens: itens atuais do orçamento */
function planoImportacao(itens,fontes){
  const porChave=new Map(itens.filter(i=>i.origem&&i.origem.chave).map(i=>[i.origem.chave,i]));
  const novos=[],alterados=[],vistos=new Set();
  for(const f of fontes){
    vistos.add(f.chave);
    const ex=porChave.get(f.chave);
    if(!ex){novos.push(f);continue}
    const a=ex.origem.snap||{},b=snapOf(f);
    const mud=[];
    if(a.qtd!==b.qtd)mud.push({campo:'qtd',de:a.qtd,para:b.qtd});
    if((a.un||'')!==b.un)mud.push({campo:'un',de:a.un,para:b.un});
    if((a.desc||'')!==b.desc)mud.push({campo:'desc',de:ex.desc,para:f.desc});
    if(mud.length)alterados.push({item:ex,fonte:f,mud});
  }
  const sumiram=itens.filter(i=>i.origem&&['de','rts'].includes(i.origem.tipo)&&i.origem.chave&&!vistos.has(i.origem.chave));
  return{novos,alterados,sumiram};
}


/* ---------- importação da planilha de compras do Nomus ("BD - Custos") ---------- */
const COLS={disc:/^discriminador/,codigo:/^codigo do produto/,descricao:/^descricao do produto/,familia:/^familia/,tipo:/^tipo de produto/,mov:/^tipo de movimentacao/,um:/^u\.?m\. principal/,qtd:/^quantidade na u\.?m/,vtot:/^valor total/,vun:/^valor unitario/,fornecedor:/^pessoa/,data:/^data\/hora da criacao/};
const normH=t=>fold(t).toLowerCase().replace(/\s+/g,' ').trim();
/* aoa: matriz (1ª linha = cabeçalho). Devolve {linhas:[...]} ou {erro} */
function lerPlanilhaCompras(aoa){
  if(!aoa||aoa.length<2)return{erro:'A planilha está vazia.'};
  const hdr=aoa[0].map(normH),idx={},falta=[];
  for(const [k,re] of Object.entries(COLS)){const i=hdr.findIndex(h=>re.test(h));if(i<0)falta.push(k);else idx[k]=i}
  const obrig=['codigo','descricao','um','qtd','vtot','vun','data'];
  const sem=obrig.filter(k=>falta.includes(k));
  if(sem.length)return{erro:'Não achei estas colunas no cabeçalho: '+sem.join(', ')+'. Use o relatório “BD - Custos” do Nomus, sem mudar os títulos.'};
  const linhas=[];
  for(let r=1;r<aoa.length;r++){
    const row=aoa[r];if(!row||row.every(v=>v==null||v===''))continue;
    const g=k=>idx[k]==null?'':row[idx[k]];
    let d=g('data');
    if(d instanceof Date)d=isNaN(d)?null:new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate(),d.getHours(),d.getMinutes(),d.getSeconds()));   // hora de parede, igual em qualquer fuso
    else{const m=/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(d||''));d=m?new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0))):dataDe(d)}
    linhas.push({linha:r+1,disc:String(g('disc')||''),codigo:String(g('codigo')||'').trim(),descricao:String(g('descricao')||'').replace(/\s+/g,' ').trim(),familia:String(g('familia')||'').trim(),tipo:String(g('tipo')||'').trim(),mov:String(g('mov')||'').trim(),um:String(g('um')||'').trim(),qtd:parseNum(g('qtd')),vtot:parseNum(g('vtot')),vun:parseNum(g('vun')),fornecedor:String(g('fornecedor')||'').trim(),data:d});
  }
  return{linhas};
}
const ehServico=l=>/servi[cç]o/i.test(l.tipo)||/servi[cç]o/i.test(l.disc);
/* Limpa as linhas: o que tem valor ou quantidade errados NÃO entra (nem como referência). Serviços ficam. */
function limparCompras(linhas){
  const descartadas=[],resumo={};
  const out=(l,motivo)=>{descartadas.push({...l,motivo});resumo[motivo]=(resumo[motivo]||0)+1};
  const M={zero:'Quantidade, preço ou total zerado',total:'Total não confere com quantidade × valor unitário (unidade ou quantidade errada)',generico:'Código genérico de importação XML (sem produto real)',semdata:'Sem data ou sem código',rep:'Linha repetida (ficou uma cópia)',fora:'Preço fora do padrão do código (provável erro de quantidade ou unidade)'};
  const bons=[];
  for(const l of linhas){
    if(!l.codigo||!l.data||isNaN(l.data)){out(l,M.semdata);continue}
    if(!(l.qtd>=0.0001)||!(l.vtot>=0.01)||!(l.vun>=0.000001)){out(l,M.zero);continue}
    if(/^XML/i.test(l.codigo)){out(l,M.generico);continue}
    if(Math.abs(l.vtot/(l.qtd*l.vun)-1)>0.02){out(l,M.total);continue}
    bons.push(l);
  }
  const vistos=new Set(),sem=[];
  for(const l of bons){const k=[l.codigo,l.descricao,l.data.toISOString().slice(0,16),l.fornecedor,l.qtd,l.vtot].join('|');if(vistos.has(k)){out(l,M.rep);continue}vistos.add(k);sem.push(l)}
  const porCod=new Map();
  for(const l of sem)if(!ehServico(l)){(porCod.get(l.codigo)||porCod.set(l.codigo,[]).get(l.codigo)).push(l.vtot/l.qtd)}
  const med=new Map([...porCod].filter(([,v])=>v.length>=3).map(([k,v])=>[k,mediana(v)]));
  const mantidas=[];
  for(const l of sem){
    const m=med.get(l.codigo);
    if(m&&!ehServico(l)){const r=(l.vtot/l.qtd)/m;if(r>5||r<0.2){out(l,M.fora);continue}}
    mantidas.push(l);
  }
  return{mantidas,descartadas,resumo};
}
const chaveCompra=l=>[l.codigo,l.data.toISOString().slice(0,16),l.fornecedor,l.qtd,l.vtot].join('|');
/* linha pronta para a tabela purchase_history (o preço unitário gravado é total ÷ quantidade) */
const paraBanco=l=>({chave:chaveCompra(l),codigo:l.codigo,descricao:l.descricao,busca:fold(l.descricao).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(),familia:l.familia||null,tipo:l.tipo||null,tipo_item:ehServico(l)?'servico':'material',um:l.um,qtd:l.qtd,vtot:l.vtot,vun:Number((l.vtot/l.qtd).toFixed(6)),data:l.data.toISOString(),fornecedor:l.fornecedor||null,movimentacao:l.mov||null});

/* ---------- listas padrão (da planilha de custos real do RTS 1183-26) ---------- */
const CATALOGO=[
 ['Elementos de fixação','CJ',['ELEMENTOS DE FIXAÇÃO','CONJUNTO DE ELEMENTOS DE FIXAÇÃO INOX']],
 ['Elementos de fixação','PÇ',['PARAFUSOS','PORCAS','ARRUELAS']],
 ['Juntas e vedações','PÇ',['JUNTA DE VEDAÇÃO','GAXETAS DE VEDAÇÃO','ANEL V-RING VITON','SELO DO EIXO','KIT VEDAÇÃO DO ATUADOR','SELOS MECÂNICOS','VEDAÇÃO INFLÁVEL','PERFIL ESPECIAL EM BORRACHA',"O'RING"]],
 ['Rolamentos, mancais e buchas','PÇ',['CUSTO MÉDIO ELEMENTOS DE APOIO - ROLAMENTO','CUSTO MÉDIO ELEMENTOS DE APOIO - BUCHAS DE DESLIZAMENTO','CAIXA DE MANCAL FLANGE QUADRADO COM ROLAMENTO','CAIXA DE MANCAL FLANGE REDONDO COM ROLAMENTO','MANCAL AUTOLUBRIFICANTE','BARRA DE BRONZE - BUCHA DE ACIONAMENTO','ANEL ELÁSTICO','ANEL DE APERTO OU AJUSTE']],
 ['Chapas e barras','PÇ',['CHAPAS','BARRAS','ANEL CORTADO DE CHAPA']],
 ['Lixas e abrasivos','UN',['LIXAS']],
 ['Graxas','UN',['GRAXAS']],
 ['Óleos e lubrificantes','LT',['ÓLEO']],
 ['Desengraxantes e desengripantes','PÇ',['DESENGRAXANTE','DESENGRIPANTE WD 40','DESENGRAXANTE ESPECIAL - LIMPEZA PARA TRABALHO COM OXIGÊNIO']],
 ['Consumíveis de solda','KG',['CONSUMÍVEL DE SOLDA']],
 ['Tintas e solventes','LT',['TINTAS E SOLVENTES']],
 ['Limpeza e proteção','PÇ',['TRAPOS','PROTEÇÃO SANFONA VINIL/VELCRO','TAMPAS DE PROTEÇÃO DA HASTE','LUZ - LÂMPADA NEGRA + ACESSÓRIOS']],
 ['Atuadores e acionamentos','PÇ',['ATUADOR ELÉTRICO 440V','ATUADOR MANUAL CAIXA DE ENGRENAGEM','ATUADOR MANUAL CAIXA DE EMERGÊNCIA','MOTOR ELÉTRICO','CILINDRO HIDRÁULICO','ATUADOR PNEUMÁTICO DE DUPLA AÇÃO','ATUADOR HIDRÁULICO ROTATIVO','MOTOREDUTOR','ATUADOR DIAFRAGMA','DIAFRAGMA PARA ATUADOR','VOLANTE DE ACIONAMENTO']],
 ['Instrumentação, pneumática e hidráulica','PÇ',['SENSOR INDUTIVO','MONITOR DE POSIÇÃO','POSICIONADOR ELETROPNEUMÁTICO','FILTRO REGULADOR COM MANÔMETRO','MANÔMETRO','CONEXÕES PNEUMÁTICAS','CONEXÕES HIDRÁULICAS','MANGUEIRAS HIDRÁULICAS COM TERMINAIS PRENSADOS','TUBOS PNEUMÁTICOS PU','VÁLVULA DIRECIONAL 5 X 2 VIAS PNEUMÁTICA','VÁLVULA DIRECIONAL 3 X 2 VIAS PNEUMÁTICA','VÁLVULA DE ESCAPE RÁPIDO','BOOSTER PNEUMÁTICO','CHAVE FIM DE CURSO DE ALAVANCA','TOMADOR DE PRESSÃO']],
 ['Transmissão','PÇ',['RODAS DENTADAS','CORRENTES','POLIAS','CORREIAS','ACOPLAMENTO DE GRADE','ACOPLAMENTO ELÁSTICO','ENGRENAGEM','EIXO DE CAIXA DE ACIONAMENTO','MOLA DE COMPRESSÃO','MOLA DE TRAÇÃO']],
 ['Obturadores, sedes e fundidos','PÇ',['OBTURADOR EM AÇO INOX SEM REVESTIMENTO','OBTURADOR EM AÇO INOX COM REVESTIMENTO','OBTURADOR EM AÇO CARBONO COM ÁREA DE VEDAÇÃO REVESTIDA','OBTURADOR EM ASTM A 532 FERRO FUNDIDO BRANCO','SEDE DE VEDAÇÃO EM AÇO INOX SEM REVESTIMENTO','SEDE DE VEDAÇÃO EM AÇO CARBONO COM REVESTIMENTO','SEDE DE VEDAÇÃO EM PTFE CARREGADO','SEDE EM PTFE MODIFICADO NXT','SEDE DE VEDAÇÃO EM BORRACHA','SEDE DE VEDAÇÃO EM DELRIN','SEDE DE VEDAÇÃO EM UHMWPE','SEDE DE VEDAÇÃO EM ASTM A 532 FERRO FUNDIDO BRANCO','HASTE','CORPO FUNDIDO','SEDE FUNDIDA','TAMPA FUNDIDA','OBTURADOR FUNDIDO','PREME GAXETAS FUNDIDO','DISCO FUNDIDO','BRAÇO DE ALAVANCA FUNDIDO']],
 ['Outros materiais','PÇ',['PLACA DE INFORMAÇÃO TÉCNICA','TERMINAL ROTULAR','OUTROS MATERIAIS DE MANUTENÇÃO']]
];
const catalogoPlano=()=>CATALOGO.flatMap(([cat,un,l])=>l.map(desc=>({cat,un,desc})));
/* o que já vem na lista de um orçamento novo, sem quantidade nem preço (não entram no documento nem na conta enquanto ficarem em branco) */
const BASE_MAT=['ELEMENTOS DE FIXAÇÃO','JUNTA DE VEDAÇÃO','GAXETAS DE VEDAÇÃO','LIXAS','GRAXAS','ÓLEO','DESENGRAXANTE','DESENGRIPANTE WD 40','CONSUMÍVEL DE SOLDA','TINTAS E SOLVENTES','TRAPOS','CHAPAS','BARRAS','OUTROS MATERIAIS DE MANUTENÇÃO'];
const HH=[ // setor, valor/h da planilha de custos (editável)
 ['H/H DESMONTAGEM - LIMPEZA',70],['H/H D.E',70],['H/H CADASTRO',70],['H/H ROTEIRO',70],['H/H JATO',70],['H/H AJUSTAGEM (LAPIDAÇÃO)',70],['H/H USINAGEM',70],
 ['H/H SOLDAGEM / CALDEIRARIA',70],['H/H MONTAGEM',70],['H/H TESTES',70],['H/H PINTURA',70],['H/H TESTES COM INSPEÇÃO EXTERNA',70],['H/H QUALIDADE',70],['H/H EXPEDIÇÃO',70],
 ['H/H ENGENHARIA - LISTA DE MATERIAL',70],['H/H ENGENHARIA - ESCOPO TÉCNICO',120],['H/H ENGENHARIA - PROJETO',120]];
const OUT=['VISITA TÉCNICA','ALUGUEL DE CARRO','HOTEL','MOBILIZAÇÃO / DESMOBILIZAÇÃO','ALIMENTAÇÃO E ESTADIA (EQUIPE)','TRANSPORTE CAMINHÃO'];
const SRV=['DOCUMENTAÇÃO DE SOLDAGEM + SOLDAGEM EXTERNA (ESTIMADO)','DOCUMENTAÇÕES (IEIS, SOLDADOR QUALIFICADO, LP) - ESTIMADO','USINAGEM - SERVIÇO EXTERNO','TRANSPORTE DE EQUIPAMENTO','SERVIÇO DE REVESTIMENTO','SERVIÇO DE RECUPERAÇÃO DE CILINDRO'];
const novoId=(()=>{let n=0;return()=>'CI-'+Date.now().toString(36)+'-'+(n++).toString(36)+Math.random().toString(36).slice(2,5)})();
function itemNovo(o={}){
  return Object.assign({id:novoId(),sec:'mat',cat:'',codigo:'',desc:'',un:'PÇ',qtd:null,horas:null,preco:null,preco_tipo:null,ref:null,refHist:[],obs:'',origem:{tipo:'manual'}},o);
}
function orcamentoInicial(padrao){
  const p=padrao||{};
  const mat=(p.mat||BASE_MAT.map(d=>({desc:d}))).map(x=>{const c=catalogoPlano().find(y=>y.desc===x.desc);return itemNovo({sec:'mat',desc:x.desc,un:x.un||(c&&c.un)||'PÇ',cat:x.cat||(c&&c.cat)||'',origem:{tipo:'padrao'}})});
  const mo=(p.mo||HH.map(([desc,preco])=>({desc,preco}))).map(x=>itemNovo({sec:'mo',desc:x.desc,un:'H',qtd:1,preco:x.preco??null,preco_tipo:x.preco!=null?'informado':null,origem:{tipo:'padrao'}}));
  const out=(p.out||OUT.map(d=>({desc:d}))).map(x=>itemNovo({sec:'out',desc:x.desc,un:'UN',origem:{tipo:'padrao'}}));
  const srv=(p.srv||SRV.map(d=>({desc:d}))).map(x=>itemNovo({sec:'srv',desc:x.desc,un:'UN',origem:{tipo:'padrao'}}));
  return{versao:1,itens:[...mat,...mo,...out,...srv],solicitante:'',respEngenharia:'',respProjeto:'',prazoDias:'',comentarios:''};
}

const api={tokensNome,niveisBusca,refPorNome,lerPlanilhaCompras,limparCompras,paraBanco,chaveCompra,ehServico,SECS,UNIDADES,parseNum,dec,cents,linha,resumo,refPrice,normUn,planoImportacao,snapOf,nz,CATALOGO,catalogoPlano,BASE_MAT,HH,OUT,SRV,itemNovo,orcamentoInicial,novoId};
root.CustosCalc=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
