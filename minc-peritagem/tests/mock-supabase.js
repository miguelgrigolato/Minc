(function(){
  const K='__mockdb';
  let db;try{db=JSON.parse(localStorage.getItem(K))}catch{}
  db=db||{tables:{profiles:[{id:'u-admin',name:'ADMIN',email:'a@minc.com',role:'admin',status:'ativo'}],processes:[],photos:[],process_documents:[],catalog_sectors:[],catalog_activities:[],catalog_external_services:[],admin_audit:[]},files:{}};
  const save=()=>localStorage.setItem(K,JSON.stringify(db));save();
  window.__mock={db:()=>db,save};
  let tick=0;const ts=()=>new Date(Date.UTC(2026,9,7,12,0,0)+(++tick)*1000).toISOString();
  const b2s=async blob=>{const u=new Uint8Array(await blob.arrayBuffer());let s='';for(const x of u)s+=String.fromCharCode(x);return{t:blob.type,d:btoa(s)}};
  const s2b=o=>{const s=atob(o.d),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return new Blob([u],{type:o.t})};
  class Q{
    constructor(t){this.t=t;this.f=[];this.op='select';this.one=false;this.lim=null;this.ord=null}
    select(){return this} insert(r){this.op='insert';this.rows=[].concat(r);return this} update(p){this.op='update';this.patch=p;return this}
    upsert(r){this.op='upsert';this.rows=[].concat(r);return this} delete(){this.op='delete';return this}
    eq(k,v){this.f.push(r=>r[k]===v);return this} neq(k,v){this.f.push(r=>r[k]!==v);return this}
    in(k,a){this.f.push(r=>a.includes(r[k]));return this} gte(k,v){this.f.push(r=>String(r[k])>=String(v));return this}
    order(k,o={}){this.ord=[k,o.ascending!==false];return this} limit(n){this.lim=n;return this} single(){this.one=true;return this}
    then(a,b){return Promise.resolve().then(()=>this.run()).then(a,b)}
    run(){
      const T=db.tables[this.t]=db.tables[this.t]||[],m=r=>this.f.every(f=>f(r));let out;
      // regras de tamanho da migração 009 (o banco real recusa com o código 23514)
      if(this.t==='processes'&&(this.op==='insert'||this.op==='update')){
        const rows=this.op==='insert'?this.rows:[this.patch];
        for(const r of rows){if(['process_no','pedido','ordem','equipamento','cliente'].some(k=>r[k]&&String(r[k]).length>200)||String((r.data||{}).observacoes||'').length>4000)return{data:null,error:{code:'23514',message:'new row violates check constraint'}}}
      }
      if(this.op==='insert'){
        for(const r of this.rows)if(r.id&&T.some(x=>x.id===r.id))return{data:null,error:{code:'23505',message:'duplicate key'}};
        out=this.rows.map(r=>{const n={...r};if(this.t==='processes'){n.rev=1;n.updated_at=ts();n.created_at=n.updated_at}
          if(this.t==='process_documents'){n.id=n.id||crypto.randomUUID();n.version=T.filter(x=>x.process_id===n.process_id).length+1;n.is_current=true;n.generated_at=ts()}T.push(n);return n});
      }else if(this.op==='update'){out=T.filter(m);out.forEach(r=>{Object.assign(r,this.patch);if(this.t==='processes'){r.rev++;r.updated_at=ts()}})}
      else if(this.op==='upsert'){out=this.rows.map(r=>{const e=T.find(x=>x.id===r.id);if(e)Object.assign(e,r);else T.push({...r});return r})}
      else if(this.op==='delete'){out=T.filter(m);db.tables[this.t]=T.filter(r=>!m(r))}
      else{out=T.filter(m);if(this.ord){const[k,a]=this.ord;out=[...out].sort((x,y)=>(x[k]>y[k]?1:x[k]<y[k]?-1:0)*(a?1:-1))}if(this.lim)out=out.slice(0,this.lim)}
      save();out=JSON.parse(JSON.stringify(out));
      if(this.one)return out.length?{data:out[0],error:null}:{data:null,error:{code:'PGRST116',message:'no rows'}};
      return{data:out,error:null};
    }
  }
  const storage={from:b=>({
    async upload(p,blob,o={}){const k=b+'/'+p;if(db.files[k]&&!o.upsert)return{data:null,error:{message:'The resource already exists'}};db.files[k]=await b2s(blob);save();return{data:{path:p},error:null}},
    async download(p){const f=db.files[b+'/'+p];return f?{data:s2b(f),error:null}:{data:null,error:{message:'Object not found'}}},
    async remove(ps){ps.forEach(p=>delete db.files[b+'/'+p]);save();return{data:[],error:null}},
    async createSignedUrl(p){const f=db.files[b+'/'+p];return f?{data:{signedUrl:URL.createObjectURL(s2b(f))},error:null}:{data:null,error:{message:'not found'}}}
  })};
  const user={id:'u-admin',email:'a@minc.com'};
  const auth={
    async signInWithPassword(){localStorage.setItem('__mocksess','1');return{data:{user,session:{user}},error:null}},
    async getSession(){return{data:{session:localStorage.getItem('__mocksess')?{user}:null}}},
    async signOut(){localStorage.removeItem('__mocksess');return{error:null}},
    onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}}},
    async updateUser(){return{data:{user},error:null}}
  };
  window.supabase={createClient:()=>({from:t=>new Q(t),storage,auth,functions:{invoke:async()=>({data:{ok:true},error:null})}})};
})();
