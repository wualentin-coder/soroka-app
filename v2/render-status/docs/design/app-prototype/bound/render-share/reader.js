// No owner credentials, persistence, raw job handling, or logging in this module.
export function publicRenderTransport({apiBase,capability,fetcher=fetch}){
 if(!/^[A-Za-z0-9_-]{43}$/.test(capability||''))throw Error('invalid_share');
 const base=new URL(apiBase),local=['localhost','127.0.0.1','[::1]'].includes(base.hostname);
 if((base.protocol!=='https:'&&!(local&&base.protocol==='http:'))||base.username||base.password||base.search||base.hash||!base.pathname.replace(/\/$/,'').endsWith('/render-share'))throw Error('invalid_endpoint');
 base.pathname=base.pathname.replace(/\/$/,'');const endpoint=base.href;
 return signal=>fetcher(endpoint,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',headers:{Accept:'application/json','x-render-share-token':capability},signal});
}
async function smallJSON(response){
 const size=Number(response.headers.get('content-length'));if(Number.isFinite(size)&&size>16384){await response.body?.cancel();throw Error('invalid_response');}
 const stream=response.body?.getReader();if(!stream){const text=await response.text();if(text.length>16384)throw Error('invalid_response');return JSON.parse(text);}
 const decoder=new TextDecoder();let bytes=0,text='';try{for(;;){const {value,done}=await stream.read();if(done)break;bytes+=value.byteLength;if(bytes>16384){await stream.cancel();throw Error('invalid_response');}text+=decoder.decode(value,{stream:true});}return JSON.parse(text+decoder.decode());}finally{stream.releaseLock();}
}
const delayAfter=(value,now,fallback)=>{if(!value)return fallback;const n=Number(value);if(Number.isFinite(n))return Math.max(15000,Math.min(Number.MAX_SAFE_INTEGER,Math.max(0,n)*1000));const ms=Date.parse(value)-now;return Number.isFinite(ms)?Math.max(15000,ms):fallback;};
/** Inject read(signal) and the public schema decoder; one bounded GET at a time.
 * Replacing a share means disposing this instance and creating a new one.
 */
export function createCustomerRenderReader({read,decode,onView,onState=()=>{},intervalMs=15000,timeoutMs=12000,now=Date.now,schedule=setTimeout,cancel=clearTimeout}){
 if([read,decode,onView].some(fn=>typeof fn!=='function'))throw Error('reader_dependencies_required');
 let running=false,disposed=false,terminal=false,generation=0,timer=null,timeout=null,controller=null,last=null,notBefore=0;
 const clear=()=>{generation++;if(timer!==null)cancel(timer);if(timeout!==null)cancel(timeout);timer=timeout=null;controller?.abort();controller=null;};
 const publish=view=>{last=decode(view);onView(structuredClone(last));};
 const stale=()=>{if(last?.availability==='available'){const view=structuredClone(last);view.render.stale=true;view.render.etaSeconds=null;view.render.downloadUrl=null;if(view.render.phase==='ready')view.render.phase='unavailable';publish(view);}else publish({availability:'unavailable'});};
 const wait=delay=>{const token=generation;timer=schedule(()=>{timer=null;if(token===generation)void tick();},Math.min(2147483647,Math.max(1,Math.ceil(delay))));};
 async function tick(){
  if(!running||disposed||terminal)return;clear();if(now()<notBefore){onState('rate-limited');wait(notBefore-now());return;}const token=generation,abort=controller=new AbortController();let next=Math.max(1000,intervalMs);
  const current=()=>!disposed&&running&&token===generation&&!abort.signal.aborted;
  onState('loading');
  try{
   const work=(async()=>{const response=await read(abort.signal);if(response.status!==200)await response.body?.cancel();return {response,body:response.status===200?await smallJSON(response):null};})();
   const expired=new Promise((_,reject)=>{timeout=schedule(()=>{reject(Error('timeout'));abort.abort();},Math.max(1000,timeoutMs));});
   const {response,body}=await Promise.race([work,expired]);if(!current())return;
   if([401,403,404,410].includes(response.status)){terminal=true;publish({availability:response.status===410?'expired':'unavailable'});onState('closed');}
   else if(response.status===200){publish(body);terminal=['revoked','expired'].includes(last.availability);onState(terminal?'closed':last.availability==='available'?'fresh':'unavailable');}
   else{if(response.status===429){next=delayAfter(response.headers.get('retry-after'),now(),next);notBefore=Math.max(notBefore,now()+next);}stale();onState(response.status===429?'rate-limited':'offline');}
  }catch{if(!disposed&&running&&token===generation){stale();onState('offline');}}
  finally{if(token===generation){if(timeout!==null)cancel(timeout);timeout=null;controller=null;if(running&&!disposed&&!terminal)wait(Math.max(next,notBefore-now()));}}
 }
 return Object.freeze({start(){if(disposed||running||terminal)return;running=true;void tick();},refresh(){if(disposed||terminal)return;running=true;void tick();},suspend(){if(disposed)return;running=false;clear();},resume(){if(disposed||running||terminal)return;running=true;void tick();},dispose(){if(disposed)return;disposed=true;running=false;clear();last=null;},get active(){return running&&!disposed&&!terminal;}});
}
