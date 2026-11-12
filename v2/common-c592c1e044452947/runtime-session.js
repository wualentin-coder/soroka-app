import {createPlannerRuntime} from '/soroka-app/v2/common-c592c1e044452947/app2/planner-runtime.mjs';
import {createPlannerOutbox} from '/soroka-app/v2/common-c592c1e044452947/app2/planner-outbox.mjs';

let englishLoading=null;
export async function getModuleHost(module){
  const native=window.sorokaPlannerSession,token=native?.owner();
  if(!token)throw Error('provider_authorization_required');
  return native.moduleSession(token,module);
}
export async function getEnglishHost(){
  const native=window.sorokaPlannerSession,token=native?.owner();
  if(!token)throw Error('english_authorization_required');
  if(!window.flowEnglishHost){
    if(!englishLoading)englishLoading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/english-host.js';script.onload=resolve;script.onerror=()=>reject(Error('english_host_unavailable'));document.head.append(script);}).finally(()=>englishLoading=null);
    await englishLoading;
  }
  if(!native.isCurrent(token))throw Error('english_owner_changed');
  return native.englishSession(token);
}

export async function openPlannerRuntime(options={}){
  if(!window.sorokaPlannerSession){
    window.FLOW_HEADLESS_PLANNER=true;
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='/soroka-app/v2/common-c592c1e044452947/planner-bridge.js';
      script.onload=resolve;script.onerror=()=>reject(Error('planner_bridge_unavailable'));
      document.head.append(script);
    });
  }
  if(!window.sorokaPlannerSession)throw Error('planner_bridge_unavailable');
  const native=window.sorokaPlannerSession;let writable=false,lockedScope=null,release=null,leasedToken=null,lockGeneration=0;
  const unlock=()=>{lockGeneration++;release?.();release=null;writable=false;lockedScope=null;};
  const host={...native,async scope(token){
    const scope=await native.scope(token);
    if(!native.isCurrent(token))throw Error('planner_owner_changed');
    leasedToken=token;
    if(scope!==lockedScope){release?.();release=null;writable=false;lockedScope=scope;
      const attempt=++lockGeneration;
      if(navigator.locks)await new Promise(resolve=>navigator.locks.request('flow-planner-writer:'+scope,{ifAvailable:true},async lock=>{const current=attempt===lockGeneration&&lockedScope===scope&&native.isCurrent(token);if(!current){resolve();return;}writable=!!lock;resolve();if(lock)await new Promise(done=>release=done);}).catch(()=>resolve()));
    }
    return scope;
  },subscribe(listener){const off=native.subscribe(()=>{if(leasedToken&&!native.isCurrent(leasedToken))unlock();listener();});return()=>{off();unlock();};}};
  return createPlannerRuntime(host,{...options,outbox:createPlannerOutbox(localStorage),canWrite:()=>writable,onInvalidate:()=>{unlock();options.onInvalidate?.();}});
}
