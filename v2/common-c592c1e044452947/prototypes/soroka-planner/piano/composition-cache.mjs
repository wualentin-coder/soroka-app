const DATABASE='flow-piano-private-compositions-v1',DATA='compositions',META='metadata';
const MAX_BYTES=2*1024*1024,MAX_ENTRIES=8;
const profileOK=value=>typeof value==='string'&&/^piano-[a-f0-9]{24}$/.test(value);
const idOK=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function browserIDB(){try{return globalThis.indexedDB??null;}catch{return null;}}
function validated(value,id){
  try{
    const text=JSON.stringify(value);if(!text||new TextEncoder().encode(text).length>MAX_BYTES)return null;
    const c=JSON.parse(text);
    if(!object(c)||!idOK(c.id)||id!==undefined&&c.id!==id||typeof c.title!=='string'||!c.title.trim()||c.title.length>120||
      !Number.isFinite(c.tempo)||c.tempo<=0||!Array.isArray(c.tracks)||!c.tracks.length||c.tracks.length>64)return null;
    let count=0;const tracks=new Set();
    for(const track of c.tracks){
      if(!object(track)||typeof track.id!=='string'||!track.id||track.id.length>80||tracks.has(track.id)||!Array.isArray(track.notes))return null;
      tracks.add(track.id);count+=track.notes.length;if(count>5000)return null;
      let previous=-Infinity;
      for(const n of track.notes){
        if(!object(n)||!Number.isInteger(n.midi)||n.midi<0||n.midi>127||!Number.isFinite(n.time)||n.time<0||n.time<previous||
          !Number.isFinite(n.duration)||n.duration<=0||n.time+n.duration>3600)return null;
        previous=n.time;
      }
    }
    if(!c.tracks.some(track=>track.id===c.defaultTrack&&track.notes.length))return null;
    return c;
  }catch{return null;}
}
function metadata(c){
  const m={id:c.id,title:c.title,private:true,cached:true};
  for(const key of ['author','description','level','hand','status','source'])if(typeof c[key]==='string')m[key]=c[key].slice(0,key==='description'?1000:120);
  for(const key of ['tempo','duration'])if(Number.isFinite(c[key])&&c[key]>=0)m[key]=c[key];
  return m;
}
const newer=(a,b)=>(b.touched||0)-(a.touched||0)||a.id.localeCompare(b.id);

/** Private device cache only. It never fetches a URL or falls back to another profile. */
export function createCompositionCache(options={}){
  const factory=Object.hasOwn(options,'indexedDB')?options.indexedDB:browserIDB();
  const now=options.now??Date.now,timeout=Math.max(20,Math.min(10_000,options.timeoutMs??4000));
  let opening=null,connection=null;
  const close=()=>{try{connection?.close();}catch{}connection=null;opening=null;};
  function open(){
    if(!factory||typeof factory.open!=='function')return Promise.resolve(null);
    if(opening)return opening;
    opening=new Promise(resolve=>{
      let done=false,request;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
      const timer=setTimeout(()=>finish(null),timeout);
      try{
        request=factory.open(DATABASE,1);
        request.onupgradeneeded=()=>{
          try{
            const db=request.result;
            if(!db.objectStoreNames.contains(DATA))db.createObjectStore(DATA,{keyPath:['profileId','id']});
            if(!db.objectStoreNames.contains(META)){const store=db.createObjectStore(META,{keyPath:['profileId','id']});store.createIndex('byProfile','profileId',{unique:false});}
          }catch{try{request.transaction?.abort();}catch{}finish(null);}
        };
        request.onsuccess=()=>{
          const db=request.result;if(done){db.close();return;}
          connection=db;db.onversionchange=close;db.onclose=()=>{if(connection===db){connection=null;opening=null;}};finish(db);
        };
        request.onerror=()=>finish(null);request.onblocked=()=>finish(null);
      }catch{finish(null);}
    }).then(db=>{if(!db)opening=null;return db;});
    return opening;
  }
  async function transaction(mode,fallback,work){
    const db=await open();if(!db)return fallback;
    return new Promise(resolve=>{
      let tx,done=false,result=fallback;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
      const timer=setTimeout(()=>{try{tx?.abort();}catch{}finish(fallback);},timeout);
      try{
        tx=db.transaction([DATA,META],mode);
        tx.oncomplete=()=>finish(result);tx.onabort=()=>finish(fallback);tx.onerror=()=>{};
        const abort=()=>{try{tx.abort();}catch{finish(fallback);}};
        const success=(request,callback)=>{request.onsuccess=()=>{try{callback(request.result);}catch{abort();}};return request;};
        work(tx,value=>{result=value;},success,abort);
      }catch{try{tx?.abort();}catch{}finish(fallback);}
    });
  }
  function touch(tx,profileId,c,rows,writeData){
    const own=rows.filter(row=>row.profileId===profileId&&idOK(row.id));
    const clock=now(),maximum=Math.max(0,...own.map(row=>Number.isFinite(row.touched)?row.touched:0));
    const touched=Math.max(Number.isFinite(clock)&&clock>=0?clock:0,maximum+1);
    const row={profileId,id:c.id,touched,metadata:metadata(c)};
    if(writeData)tx.objectStore(DATA).put({profileId,id:c.id,composition:c});
    tx.objectStore(META).put(row);
    const keep=[...own.filter(item=>item.id!==c.id),row].sort(newer);
    for(const old of keep.slice(MAX_ENTRIES)){
      tx.objectStore(DATA).delete([profileId,old.id]);tx.objectStore(META).delete([profileId,old.id]);
    }
  }
  async function putCachedComposition(profileId,value){
    if(!profileOK(profileId))return false;const c=validated(value);if(!c)return false;
    return transaction('readwrite',false,(tx,set,success)=>{
      success(tx.objectStore(META).index('byProfile').getAll(profileId),rows=>{touch(tx,profileId,c,rows,true);set(true);});
    });
  }
  async function getCachedComposition(profileId,id){
    if(!profileOK(profileId)||!idOK(id))return null;
    return transaction('readwrite',null,(tx,set,success)=>{
      let row,rows,received=0;
      const ready=()=>{
        if(++received<2)return;
        const c=row?.profileId===profileId&&row?.id===id?validated(row.composition,id):null;
        if(!c)return;touch(tx,profileId,c,rows,false);set(c);
      };
      success(tx.objectStore(DATA).get([profileId,id]),value=>{row=value;ready();});
      success(tx.objectStore(META).index('byProfile').getAll(profileId),value=>{rows=value;ready();});
    });
  }
  async function listCachedCompositions(profileId){
    if(!profileOK(profileId))return [];
    return transaction('readonly',[],(tx,set,success)=>{
      success(tx.objectStore(META).index('byProfile').getAll(profileId),rows=>{
        set(rows.filter(row=>row.profileId===profileId&&idOK(row.id)&&object(row.metadata)).sort(newer).slice(0,MAX_ENTRIES).map(row=>metadata({...row.metadata,id:row.id})));
      });
    });
  }
  return {putCachedComposition,getCachedComposition,listCachedCompositions,close};
}
const cache=createCompositionCache();
export const putCachedComposition=(profileId,composition)=>cache.putCachedComposition(profileId,composition);
export const getCachedComposition=(profileId,id)=>cache.getCachedComposition(profileId,id);
export const listCachedCompositions=profileId=>cache.listCachedCompositions(profileId);
