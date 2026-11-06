/* Production Sport adapter. Uses the existing load/patch outbox; never a preview transport. */
(() => {
  'use strict';
  const telegram=window.Telegram?.WebApp,android=window.SorokaAndroid;
  let lease=null,preparing=null,generation=0,boundPrincipal=null;
  function principal(){
    // Match bridge.js authentication precedence. Raw credentials stay in this closure.
    if(window.Telegram?.WebApp!==telegram||window.SorokaAndroid!==android)return null;
    try{
      if(telegram?.initData){
        const user=JSON.parse(new URLSearchParams(telegram.initData).get('user')||'null');
        return Number.isSafeInteger(user?.id)&&user.id>0?`telegram:${user.id}`:null;
      }
      const key=android?.deviceKey&&String(android.deviceKey());
      return key?`device:${key}`:null;
    }catch{return null;}
  }
  function invalidate(){
    generation++;lease=null;boundPrincipal=null;preparing=null;
    if(spTimer.phase)spClockActivity(false);
    window.flowSportAuto.bindOwner(null);
    spResetOwner();
    Object.assign(spTimer,{session:null,phase:null,clock:null,runner:false,dismissed:false,videoOpen:false,nativeToken:null,ticked:null});
    window.flowSportSession.reset?.();
    SP().setTimerIdentity('unbound');
    spOverlay(true);
  }
  function capture(){
    if(lease&&principal()!==boundPrincipal)invalidate();
    return lease;
  }
  const current=value=>!!value&&capture()===value;
  const canWrite=()=>!!capture()?.authorized;
  async function prepare(){
    if(capture())return lease;
    if(preparing)return preparing;
    const identity=principal(),epoch=generation;
    if(!identity||typeof window.sorokaSport!=='function')throw Error('sport_owner_unavailable');
    const task=(async()=>{
      const bytes=new TextEncoder().encode(`${location.origin}\nflow-sport-v1\n${identity}`);
      const digest=await crypto.subtle.digest('SHA-256',bytes);
      if(epoch!==generation||identity!==principal())throw Error('sport_owner_changed');
      const scope=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      boundPrincipal=identity;lease={scope,authorized:false};
      window.flowSportAuto.bindOwner(scope);
      spResetOwner();SP().setTimerIdentity(scope);
      return lease;
    })();
    preparing=task;
    try{return await task;}finally{if(preparing===task)preparing=null;}
  }
  function storageKey(kind){
    const owner=capture();if(!owner)throw Error('sport_owner_unbound');
    if(!['outbox','session','settings','cache'].includes(kind))throw Error('sport_storage_kind');
    return `flow.sport.${kind}.v1:${owner.scope}`;
  }
  function register(option,readOnly,finished){
    if(!capture()||!spState().state)return true;
    if(spTimer.phase&&spTimer.session?.key!==option.key)return true;
    const changed=spTimer.session?.key!==option.key;
    if(window.flowSportAuto.view()?.active&&!window.flowSportAuto.matches(option)){
      window.flowSportAuto.stop();window.flowSportSession.reset?.();toast('План изменился. Начните тренировку заново.');
    }
    spTimer.session={key:option.key,option,readOnly,finished};
    if(finished&&window.flowSportAuto.view()?.active){window.flowSportAuto.stop();window.flowSportSession.reset?.();spTimer.runner=false;}
    if(!readOnly&&!finished&&canWrite()&&!spTimer.phase){
      if(!window.flowSportAuto.view()?.active&&!window.flowSportAuto.restore()&&changed){
        // Only scoped web snapshots are trusted here. Native snapshots have no owner contract yet.
        const saved=SP().loadTimer(option.key);
        if(saved&&!saved.phase.guided&&option.plan.exercises[saved.phase.index]){
          spTimer.phase=saved.phase;spTimer.clock=SP().Countdown.restore(saved.clock);
        }
      }
    }
    if(finished&&spTimer.phase)spSetPhase(null);
    return true;
  }
  function cache(s){
    localStorage.setItem(storageKey('cache'),JSON.stringify({owner:lease.scope,savedAt:Date.now(),state:s.state,catalog:s.catalog,startedOn:s.startedOn}));
  }
  function recover(){
    if(!capture())return null;
    try{
      const saved=JSON.parse(localStorage.getItem(storageKey('cache'))||'null');
      if(saved?.owner!==lease.scope||!Number.isFinite(saved.savedAt)||saved.savedAt>Date.now()||Date.now()-saved.savedAt>7*86400000||!saved.state||!saved.catalog)return null;
      // Validate the cached catalog before allowing a foreground offline continuation.
      SP().workoutOptions([],saved.catalog,1,saved.startedOn,saved.state);
      return{...saved,offline:true};
    }catch{return null;}
  }
  function loaded(s,readOnly,offline){
    if(!capture()||readOnly||s.demo)return;
    lease.authorized=true;
    if(!offline){try{cache(s);}catch{/* Outbox writes remain checked before any result credit. */}}
    if(spTimer.phase||window.flowSportAuto.view()?.active){
      const option=spOptions().all.find(o=>o.key===spTimer.session?.key);
      if(option)register(option,false,!!s.state.workouts?.[option.key]);
      else{window.flowSportAuto.stop();Object.assign(spTimer,{session:null,phase:null,clock:null,runner:false});window.flowSportSession.reset?.();}
      return;
    }
    let saved;try{saved=JSON.parse(localStorage.getItem(storageKey('session'))||'null');}catch{return;}
    if(!saved?.active||saved.owner!==lease.scope)return;
    const option=spOptions().all.find(o=>o.key===saved.workout);
    if(!option||option.historyOnly||s.state.workouts?.[option.key])return;
    s.date=option.date;s.kind=option.kind;
    register(option,false,false);
  }
  window.flowSportRuntime={prepare,capture,current,canWrite,storageKey,register,loaded,cache,recover};
  // Loaded before app.js: its ui binding does not exist until the first load.
  window.flowSportAuto.bindOwner(null);
  setInterval(()=>{
    if(capture()||!principal())return;
    prepare().then(()=>{if(['sport','today'].includes(ui.page))spLoad();}).catch(()=>{});
  },1000);
})();
