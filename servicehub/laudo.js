/* MINC · Peritagem — Leitura do laudo do cliente (v5.28.0)
   Lê o PDF do laudo/instruções que o cliente manda junto com a válvula e devolve a estrutura para o RTS:
   - itens do laudo com a lista de componentes (nº, nome, providência, quantidade) e as atividades de cada um;
   - observações gerais (data-book, identificação, embalagem, testes, pintura, devolução…);
   - ficha do equipamento (texto);
   - PDF sem texto (desenho escaneado) é devolvido como imagem para entrar como anexo.
   A leitura do PDF usa pdf.js (vendor/pdfjs), carregado só quando o botão é usado. O analisador de texto (parse) é puro e testável. */
(function(){
'use strict';
const VERBS={RECUPERAR:'Recuperar',SUBSTITUIR:'Substituir',APROVEITAR:'Reutilizar',REUTILIZAR:'Reutilizar',ADEQUAR:'Adequar',FABRICAR:'Fabricar'};
const VERB_RE=/\b(RECUPERAR|SUBSTITUIR|APROVEITAR|REUTILIZAR|ADEQUAR|FABRICAR)\b/i;
const UNITS={UN:'un',UND:'un',CJ:'cj',KIT:'kit',PC:'pç','PÇ':'pç',JG:'jg',PEÇA:'pç',PEÇAS:'pç',PECA:'pç',PECAS:'pç'};
const KEEP=new Set(['ASTM','ISO','ASME','ANSI','DN','WCB','TAG','MINC','USIMINAS','PTFE','NPT','BSP','API','AISI','SAE','DIN','NBR','CF8M','RH3','PN','HRC','ID','OD','EPDM','NBR','XYLAN','CIP','RTS','NI','UN','CJ','PSI','MPA','BAR','NSE']);
/* texto em caixa alta do laudo vira frase normal (mantém siglas e códigos) */
function sentence(t){
  t=String(t||'').replace(/\s+/g,' ').trim();if(!t)return t;
  const letters=t.replace(/[^A-Za-zÀ-ÿ]/g,'');
  if(letters&&letters!==letters.toUpperCase())return t;   // já tem minúsculas: respeita como veio
  let out=t.toLowerCase().replace(/[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\-\/\.]*/g,w=>{const u=w.toUpperCase().replace(/[\.,;:]+$/,'');return KEEP.has(u)||/\d/.test(w)&&/[a-z]/i.test(w)&&w.length<=6&&/[0-9]/.test(w)?w.toUpperCase():w});
  return out.replace(/(^|[.!?]\s+)([a-zà-ÿ])/g,(m,a,b)=>a+b.toUpperCase());
}
const isHeaderNoise=l=>/^GER[EÊ]NCIA DE OFICINAS/i.test(l)||/^LAUDO REPARO:/i.test(l)||/^Classifica[cç][aã]o da informa/i.test(l)||/^\*{5,}$/.test(l)||/^FOTO$/i.test(l)||/^DESCRI[CÇ][AÃ]O DOS ITENS$/i.test(l);
const COMP_RE=/^\s*(\d{1,2})\s*[-–.)]\s*(.+)$/;
/* uma linha "01 - CORPO: RECUPERAR – 01 UN." ou "01 – CAMISAS … - RECUPERAR: 02 UN." */
function parseComp(line){
  const m=COMP_RE.exec(line);if(!m)return null;
  const rest=m[2],v=VERB_RE.exec(rest);if(!v)return null;
  const q=/(\d+)\s*(UN|UND|CJ|KIT|P[CÇ]|JG|PE[ÇC]AS?)?\s*\.?\s*$/i.exec(rest.slice(v.index+v[0].length));
  const nome=rest.slice(0,v.index).replace(/[\s:–\-]+$/,'').trim();if(!nome)return null;
  return{nn:m[1],nome,prov:VERBS[v[1].toUpperCase()],qtd:q?String(+q[1]):'1',unid:q&&q[2]?(UNITS[q[2].toUpperCase()]||'un'):'un'};
}
const FIELD_RE=/^(ITEM DO LAUDO|DESCRI[CÇ][AÃ]O DO COMP|ESPECIFICA[CÇ][AÃ]O|QUANTIDADE|AVARIA|FOTO RECUPERA[CÇ][AÃ]O|RECUPERA[CÇ][AÃ]O)\s*:\s*(.*)$/i;
function parse(rawLines){
  const lines=rawLines.map(l=>String(l).replace(/\s+/g,' ').trim()).filter(l=>l&&l!=='\f');
  const out={numero:'',tag:'',equipamento:'',tipo:'',tecnico:'',cliente:'',cabecalho:[],itens:[],obsGerais:[],ficha:'',eLaudo:false};
  const all=lines.join('\n');
  let m=/LAUDO REPARO:\s*(\d+)/i.exec(all);if(m){out.numero=m[1];out.eLaudo=true}
  if(/ITEM DO LAUDO/i.test(all))out.eLaudo=true;
  if(/USIMINAS/i.test(all))out.cliente='USIMINAS';
  m=/\b([A-Z]-\d{6,})\b/.exec(all);if(m)out.tag=m[1];
  const iTipo=lines.findIndex(l=>/^TIPO DE EQUIPAMENTO/i.test(l));
  if(iTipo>0)out.equipamento=lines[iTipo-1].replace(/\s+/g,' ').trim();
  m=/^T[EÉ]CNICO RESP/i;const iT=lines.findIndex(l=>m.test(l));if(iT>=0&&lines[iT+1])out.tecnico=lines[iT+1].replace(/\s+\S+@\S+.*$/,'').trim();
  const iItens=lines.findIndex(l=>/^DESCRI[CÇ][AÃ]O DOS ITENS$/i.test(l));
  out.cabecalho=lines.slice(0,iItens>=0?iItens:Math.min(lines.length,25)).filter(l=>!isHeaderNoise(l));
  /* itens */
  let item=null,ctx=null,sec=null,fichaOn=false,fichaL=[],lastAct=null;
  const closeSec=()=>{if(sec){sec.texto=sec.texto.join('\n').trim();if(sec.titulo&&sec.texto)out.obsGerais.push({titulo:sec.titulo,texto:sec.texto});sec=null}};
  const pushAct=t=>{t=t.trim();if(!t)return;const a={t};(ctx&&ctx.acts?ctx.acts:null)&&ctx.acts.push(a);lastAct=a;return a};
  for(const l of lines){
    if(isHeaderNoise(l))continue;
    const f=FIELD_RE.exec(l);
    if(f){
      const k=f[1].toUpperCase();
      if(/^ITEM DO LAUDO/.test(k)){closeSec();item={n:f[2].trim(),desc:'',espec:'',qtd:'',avaria:'',recup:'',comps:[],obs:[]};out.itens.push(item);ctx=null;fichaOn=false;continue}
      if(item){
        if(/^DESCRI/.test(k))item.desc=f[2].trim();else if(/^ESPEC/.test(k))item.espec=f[2].trim();else if(/^QUANT/.test(k))item.qtd=f[2].trim();else if(/^AVARIA/.test(k))item.avaria=f[2].trim();else item.recup=f[2].trim();
        continue}
    }
    if(/^FOTO RECUPERA/i.test(l)&&item){item.recup=l.replace(/^FOTO\s*RECUPERA[CÇ][AÃ]O:\s*/i,'');continue}
    if(!item)continue;
    if(/^OBSERVA[CÇ][OÕ]ES:?$/i.test(l)){continue}
    if(/^EQUIPAMENTO:$/i.test(l)){fichaOn=true;fichaL=[];continue}
    if(fichaOn){
      if(/^FABRICANTE \/ REFER/i.test(l)){fichaL.push(l);continue}
      if(/^\d{1,2}\s*[-–]\s*[A-ZÀ-Ý]/.test(l)||/^OBS\.?\s*:/i.test(l)){fichaOn=false;if(!out.ficha)out.ficha=fichaL.join('\n')}
      else{fichaL.push(l);continue}
    }
    /* componente do laudo */
    const c=parseComp(l);
    if(c){closeSec();ctx={...c,acts:[],item:item.n};item.comps.push(ctx);lastAct=null;continue}
    /* seção geral (sem providência): "01 - DATA-BOOK:" ou "OBS.: DEVOLUÇÃO…:" */
    const s=/^\s*(\d{1,2})\s*[-–.)]\s*([A-ZÀ-Ý][A-ZÀ-Ý \/\-ÇÃÕ]{2,60}):\s*(.*)$/.exec(l)||/^\s*()OBS\.?\s*:\s*([A-ZÀ-Ý][^:]{2,60}):\s*(.*)$/i.exec(l);
    if(s&&!VERB_RE.test(s[2])){closeSec();ctx=null;sec={titulo:sentence(s[2]).replace(/^./,x=>x.toUpperCase()),texto:s[3]?[s[3]]:[]};lastAct=null;continue}
    if(sec){sec.texto.push(l);continue}
    /* atividade do componente: "- JATEAR…" (linhas seguintes sem hífen continuam a anterior) */
    if(ctx){
      if(/^[-–•]\s*/.test(l)){pushAct(l.replace(/^[-–•]\s*/,''));continue}
      if(lastAct&&!/^(OBSERVA|RECUPERAR V)/i.test(l)){lastAct.t+=' '+l;continue}
    }
    if(/^RECUPERAR V[ÁA]LVULA CONFORME/i.test(l))continue;
    item.obs.push(l);
  }
  closeSec();if(fichaOn&&!out.ficha)out.ficha=fichaL.join('\n');
  out.ficha=out.ficha||'';
  out.obsGerais.forEach(o=>{o.texto=o.texto.split('\n').map(x=>x.trim()).join('\n')});
  out.itens.forEach(it=>it.comps.forEach(c=>{c.acts=c.acts.map(a=>({t:sentence(a.t)}))}));
  return out;
}
/* texto do PDF em linhas (agrupa por posição vertical, ordena por horizontal) */
async function pdfjs(){
  if(window.pdfjsLib)return window.pdfjsLib;
  await new Promise((ok,no)=>{const s=document.createElement('script');s.src='vendor/pdfjs/pdf.min.js';s.onload=ok;s.onerror=()=>no(new Error('Não consegui carregar o leitor de PDF.'));document.head.appendChild(s)});
  window.pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdfjs/pdf.worker.min.js';
  return window.pdfjsLib;
}
async function readPdf(file,{renderIfEmpty=true}={}){
  const lib=await pdfjs(),doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const lines=[];
  for(let p=1;p<=doc.numPages;p++){
    const pg=await doc.getPage(p),tc=await pg.getTextContent(),rows=new Map();
    for(const it of tc.items){if(!it.str||!it.str.trim())continue;const k=Math.round(it.transform[5]/3);(rows.get(k)||rows.set(k,[]).get(k)).push({x:it.transform[4],s:it.str})}
    [...rows.entries()].sort((a,b)=>b[0]-a[0]).forEach(([,r])=>{r.sort((a,b)=>a.x-b.x);lines.push(r.map(i=>i.s).join(' ').replace(/\s+/g,' ').trim())});
  }
  const chars=lines.join('').length,res={name:file.name,pages:doc.numPages,lines,chars,images:[]};
  if(chars<60&&renderIfEmpty){   // PDF sem texto (escaneado): vira imagem para anexo
    for(let p=1;p<=Math.min(doc.numPages,4);p++){
      const pg=await doc.getPage(p),vp0=pg.getViewport({scale:1}),k=Math.min(2.2,2200/Math.max(vp0.width,vp0.height)),vp=pg.getViewport({scale:k});
      const cv=document.createElement('canvas');cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);
      await pg.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
      const blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',.85));
      if(blob)res.images.push({blob,name:`${file.name.replace(/\.pdf$/i,'')}${doc.numPages>1?'_p'+p:''}.jpg`});
    }
  }
  return res;
}
/* texto livre de documento do cliente que não é laudo (ex.: observações ao fornecedor) */
function freeText(lines){
  const noise=[/^Classifica[cç][aã]o da informa/i,/^https?:\/\//i];
  return lines.filter(l=>l&&!noise.some(r=>r.test(l))).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
window.RtsLaudo={parse,readPdf,freeText,sentence,parseComp};
})();
