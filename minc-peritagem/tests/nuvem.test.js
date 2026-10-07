const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
const MOCK=fs.readFileSync(path.join(__dirname,'mock-supabase.js'),'utf8');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1};
async function device(b,seed){
  const ctx=await b.newContext();
  await ctx.route('**/vendor/supabase.js',r=>r.fulfill({contentType:'application/javascript',body:MOCK}));
  await ctx.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:"window.MINC_CONFIG={supabaseUrl:'https://mock.supabase.co',supabaseKey:'sb_publishable_mock'};"}));
  await ctx.route('**/service-worker.js',r=>r.fulfill({status:404,body:''}));
  if(seed)await ctx.addInitScript(s=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('__mockdb',s);sessionStorage.setItem('seeded','1')}},seed);
  const pg=await ctx.newPage();pg.on('pageerror',e=>console.log('PAGEERR',e.message));
  await pg.goto('(process.env.URL||'http://localhost:8765/index.html')');await pg.waitForSelector('#lg',{timeout:20000});
  await pg.fill('#lg','a@minc.com');await pg.fill('input[type=password]','x');await pg.keyboard.press('Enter');
  await pg.waitForSelector('[data-act=newProcess]',{timeout:20000});await pg.waitForTimeout(800);
  return pg;
}
const run=pg=>pg.evaluate(async()=>{Sync.running=false;await Sync.run();await new Promise(r=>setTimeout(r,50));Sync.running=false;await Sync.run();return Sync.state});
(async()=>{
  const b=await chromium.launch({executablePath:process.env.CHROME||undefined});
  const A=await device(b);
  await A.click('[data-act=newProcess]');await A.waitForTimeout(500);
  const pid=await A.evaluate(async()=>{
    const c=document.createElement('canvas');c.width=40;c.height=30;c.getContext('2d').fillRect(0,0,20,20);
    const png=await new Promise(r=>c.toBlob(r,'image/png'));
    await addPhotos([new File([png],'foto.png',{type:'image/png'}),new File(['%PDF-1.4 teste'],'laudo.pdf',{type:'application/pdf'})],'equip');
    return cur().id});
  ok(await run(A)==='idle','sync sem identificação termina sem erro');
  let db=await A.evaluate(()=>__mock.db());
  ok(db.tables.processes.length===1,'processo foi para a nuvem mesmo sem identificação');
  ok(Object.keys(db.files).length===0,'nenhum arquivo sobe antes de Processo/Pedido/Equipamento/Cliente');
  ok(!db.tables.processes[0].data.pasta,'pasta ainda não definida');
  await A.evaluate(()=>{const r=cur();Object.assign(r,{process:'4512',pedido:'PV-778',equipamento:'Válvula gaveta 6"',cliente:'Petrobrás'});changed(r)});
  await A.evaluate(()=>Saver.flushAll());
  ok(await run(A)==='idle','sync com identificação');await run(A);
  db=await A.evaluate(()=>__mock.db());
  const pasta=db.tables.processes[0].data.pasta;
  ok(pasta==='4512_PV-778_Valvula-gaveta-6_Petrobras','pasta gravada no processo na nuvem: '+pasta);
  const keys=Object.keys(db.files);console.log('  arquivos:',keys);
  ok(keys.some(k=>new RegExp(`^peritagem-fotos/${pasta}/fotos/IMG[^/]*\\.jpg$`).test(k)),'foto em <pasta>/fotos/');
  ok(keys.some(k=>new RegExp(`^peritagem-fotos/${pasta}/anexos/ANX[^/]*\\.pdf$`).test(k)),'anexo PDF em <pasta>/anexos/');
  ok(db.tables.photos.length===2&&db.tables.photos.every(x=>x.storage_path.startsWith(pasta+'/')),'tabela photos registra o caminho da pasta');
  // documento arquivado
  await A.evaluate(async pid=>{await Store.put('docs',{id:crypto.randomUUID(),procId:pid,bytes:new TextEncoder().encode('%PDF doc').buffer,snapshot:'{}',fileName:'doc.pdf',size:8,sha256:null,formCode:'R',formRev:'01',processRev:1,byName:'ADMIN',at:Date.now()})},pid);
  await run(A);db=await A.evaluate(()=>__mock.db());
  const d=db.tables.process_documents[0];
  ok(d&&d.storage_path.startsWith(pasta+'/documentos/')&&d.snapshot_path.endsWith('.json'),'documento em <pasta>/documentos/: '+(d&&d.storage_path));
  ok(Object.keys(db.files).some(k=>k.startsWith('documentos-peritagem/'+pasta+'/documentos/')),'PDF no bucket de documentos, dentro da pasta');
  // foto antiga (antes das pastas) num segundo processo, para testar a leitura do caminho antigo
  await A.evaluate(async pid=>{
    const db=__mock.db(),p=db.tables.processes.find(x=>x.id===pid);
    const c=document.createElement('canvas');c.width=10;c.height=10;const jpg=await new Promise(r=>c.toBlob(r,'image/jpeg'));
    const u=new Uint8Array(await jpg.arrayBuffer());let s='';for(const x of u)s+=String.fromCharCode(x);
    db.files[`peritagem-fotos/${pid}/IMG-LEGADO.jpg`]={t:'image/jpeg',d:btoa(s)};
    p.data.equipmentPhotos.push({id:'IMG-LEGADO',name:'antiga.jpg'});p.rev++;p.updated_at='2026-10-07T13:00:00.000Z';__mock.save()},pid);
  const seed=await A.evaluate(()=>JSON.stringify(__mock.db()));
  // aparelho B: baixa tudo
  const B=await device(b,seed);await run(B);await run(B);
  const got=await B.evaluate(async pid=>{const p=PROCS.find(x=>x.id===pid),have=new Set(await Store.photoKeys());
    return{pasta:p&&p.pasta,refs:p?[...p.equipmentPhotos,...p.anexos].map(x=>[x.id,have.has(x.id)]):[],anexType:(await Store.get('photos',p.anexos[0].id))?.kind}},pid);
  console.log('  B:',JSON.stringify(got));
  ok(got.pasta===pasta,'outro aparelho recebe a pasta');
  ok(got.refs.length===3&&got.refs.every(x=>x[1]),'outro aparelho baixa foto nova, foto antiga (caminho antigo) e anexo');
  ok(got.anexType==='file','anexo baixado continua marcado como arquivo');
  // exclusão no aparelho A: apaga caminho novo e antigo
  await A.evaluate(async()=>{const r=cur(),ph=r.equipmentPhotos.find(x=>x.id.startsWith('IMG')&&x.id!=='IMG-LEGADO');r.equipmentPhotos=r.equipmentPhotos.filter(x=>x!==ph);changed(r);await Photos.drop(ph.id)});
  const q=await A.evaluate(()=>JSON.parse(localStorage.getItem('minc_photo_del')));
  ok(q.length===1&&q[0].path.length===2&&q[0].path.some(x=>x.includes('/fotos/')),'fila de exclusão leva o caminho da pasta e o antigo');
  await run(A);db=await A.evaluate(()=>__mock.db());
  ok(!Object.keys(db.files).some(k=>k.includes('/fotos/')),'foto apagada da pasta na nuvem');
  ok(db.tables.photos.length===1,'registro da foto removido');
  await b.close();
})();
