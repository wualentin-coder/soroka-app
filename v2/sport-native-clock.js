/* Scoped current-phase native clock. The Sport owner remains the only workout/queue/restore owner. */
(() => {
  'use strict';
  if(window.flowSportNativeClock)return;
  let handle=null,readinessTimer=0,reads=0,disposed=false,publishing=false,wantedTarget=null,readyStamp='';
  const listeners=[],runtime=()=>window.flowSportRuntime,api=()=>window.sorokaSportTimer;
  function on(node,event,fn){node.addEventListener(event,fn);listeners.push(()=>node.removeEventListener(event,fn));}
  function read(){try{const value=api()?.read();return value?.contract===2&&value.bindingValid===true&&value.capabilities?.phaseOnly===2&&typeof value.ownerEpoch==='string'?value:null;}catch(_){return null;}}
  function current(){
    try{
      const owner=runtime()?.capture(),session=spTimer.session,phase=spTimer.phase,clock=spTimer.clock,A=window.flowSportAuto;
      if(!owner||!runtime().current(owner)||!runtime().canWrite()||!session||session.readOnly||session.finished||!phase||!clock||!spTimer.nativeToken)return null;
      // Android authenticates this native context by device; never infer native ownership from Telegram metadata.
      if(window.Telegram?.WebApp?.initData)return null;
      const view=A?.view(),guided=!!phase.guided;
      if(guided&&(!view?.active||view.fast||!A.matches(session.option)||!A.accepts(`${phase.guided}:${view.position}`)||view.step.kind==='boundary'))return null;
      const step=guided?view.step:null,exercise=step?.exercise||session.option.plan.exercises[phase.index];
      const total=guided?step.seconds:spSecondsFor(phase);
      if(!exercise||!Number.isInteger(total)||total<1||total>7200)return null;
      return{owner,session,phase,clock,total,exercise,stepKey:guided?A.commandKey():spTimer.nativeToken,guided,
        stage:guided?(step.kind==='work'?'Упражнение':step.kind==='prep'?'Готовься':'Отдых'):SP_PHASE_LABEL[phase.kind]};
    }catch(_){return null;}
  }
  function same(native,model){return native&&native.ownerScope===model.owner.scope&&native.key===model.session.key&&native.stepKey===model.stepKey&&
    native.phase?.index===model.phase.index&&native.phase?.kind===model.phase.kind&&native.phase?.setNumber===model.phase.setNumber;}
  function validClock(clock){return clock&&Number.isSafeInteger(clock.deadline)&&clock.deadline>0&&(clock.pausedMs===null||Number.isSafeInteger(clock.pausedMs)&&clock.pausedMs>=0&&clock.pausedMs<=7200000);}
  function clearReadiness(){clearTimeout(readinessTimer);readinessTimer=0;reads=0;}
  function cancelOwned(saved=handle){
    if(!saved)return false;
    saved.ready=false;clearReadiness();
    const native=read(),snapshot=native?.snapshot;
    const exact=native?.ownerEpoch===saved.epoch&&snapshot?.ownerScope===saved.scope&&snapshot?.key===saved.key&&snapshot?.token===saved.token&&snapshot?.stepKey===saved.step;
    if(!exact){if(handle===saved)handle=null;return !!native&&native.ownerEpoch===saved.epoch&&!snapshot;}
    saved.cancelPending=true;
    if((saved.cancelAttempts||0)>=3)return false;
    saved.cancelAttempts=(saved.cancelAttempts||0)+1;
    let ok=false;try{ok=api()?.stop({contract:2,ownerEpoch:saved.epoch,ownerScope:saved.scope,key:saved.key,token:saved.token,
      expectedToken:saved.token,expectedRevision:native.revision})===true;}catch(_){}
    if(ok){if(handle===saved)handle=null;return true;}
    if(saved.cancelAttempts===3&&!saved.warned){saved.warned=true;if(typeof toast==='function')toast('Не удалось остановить таймер');}
    return false;
  }
  function poll(){
    if(handle)handle.ready=false;
    if(handle?.cancelPending){cancelOwned(handle);return false;}
    const model=current(),native=read();
    if(!model||!native){if(handle)cancelOwned();return false;}
    const snapshot=native.snapshot;
    if(!same(snapshot,model)||!validClock(snapshot.clock)||!native.serviceRunning)return false;
    if(handle&&!runtime().current(handle.owner)){cancelOwned();return false;}
    if(handle&&(handle.epoch!==native.ownerEpoch||handle.key!==snapshot.key||handle.token!==snapshot.token||
      handle.token!==spTimer.nativeToken||handle.step!==model.stepKey))return false;
    const local=model.clock.snapshot(),incoming=snapshot.clock;
    // Returning to Flow never resumes by itself. Only an explicit native Resume can unpause a paused web clock.
    if(local.pausedMs!==null&&incoming.pausedMs===null&&native.nativeAction!=='resume')return false;
    if(model.guided){
      if(!window.flowSportAuto.adoptNativeClock?.({owner:model.owner,command:model.stepKey,phase:model.phase,token:spTimer.nativeToken,
        clock:incoming,reference:handle?.clock||local,nativeAction:native.nativeAction}))return false;
    }else if(incoming.deadline!==local.deadline||incoming.pausedMs!==local.pausedMs)spTimer.clock=SP().Countdown.restore(incoming);
    spTimer.nativeToken=snapshot.token;
    handle={owner:model.owner,epoch:native.ownerEpoch,scope:model.owner.scope,key:snapshot.key,token:snapshot.token,step:model.stepKey,
      revision:native.revision,total:snapshot.total,clock:{...incoming},ready:true};
    return true;
  }
  function checkReadiness(){
    readinessTimer=0;if(disposed||document.hidden||!handle||reads++>=20)return;
    if(!poll())readinessTimer=setTimeout(checkReadiness,50);
  }
  function publish(){
    if(disposed||publishing)return false;const model=current(),native=read();if(!model||!native){if(handle)cancelOwned();return false;}
    const before=native.snapshot;
    if(handle&&(!runtime().current(handle.owner)||handle.epoch!==native.ownerEpoch)){cancelOwned();return false;}
    if(before&&!same(before,model)&&(!handle||before.token!==handle.token||before.ownerScope!==handle.scope))return false;
    const clock=model.clock.snapshot();if(!validClock(clock))return false;
    const base=handle&&handle.token===spTimer.nativeToken?handle:null;
    // Total changes only with explicit clock adjustment; it is stable across normal deadline ticks and pause/resume.
    let total=base?.total||model.total;
    if(base&&clock.pausedMs!==null&&base.clock.pausedMs!==null)total=Math.max(1,total+Math.round((clock.pausedMs-base.clock.pausedMs)/1000));
    else if(base&&clock.pausedMs===null&&base.clock.pausedMs===null&&clock.deadline!==base.clock.deadline)total=Math.max(1,total+Math.round((clock.deadline-base.clock.deadline)/1000));
    if(total>7200)return false;
    const packet={contract:2,ownerEpoch:native.ownerEpoch,ownerScope:model.owner.scope,key:model.session.key,token:spTimer.nativeToken,
      expectedToken:base?.token??before?.token??null,expectedRevision:base?.revision??native.revision??0,stepKey:model.stepKey,
      date:model.session.option.date,kind:model.session.option.kind,title:String(model.exercise.name||'').slice(0,120),stage:model.stage,total,
      phase:{index:model.phase.index,kind:model.phase.kind,setNumber:model.phase.setNumber},clock};
    publishing=true;let accepted=false;try{accepted=api()?.update(packet)===true;}catch(_){}finally{publishing=false;}
    if(!accepted)return false;
    const reply=read();if(!reply||reply.ownerEpoch!==native.ownerEpoch||reply.snapshot?.token!==packet.token||!runtime().current(model.owner))return false;
    handle={owner:model.owner,epoch:reply.ownerEpoch,scope:model.owner.scope,key:packet.key,token:packet.token,step:model.stepKey,
      revision:reply.revision,total,clock:{...clock},ready:reply.serviceRunning===true};
    clearReadiness();if(!handle.ready&&!document.hidden)readinessTimer=setTimeout(checkReadiness,50);
    return true;
  }
  function suspend(){clearReadiness();poll();if(current()?.guided)window.flowSportAuto.pauseOnly();else if(current()?.clock.running){spTimer.clock.pause();spNoteClock();}publish();}
  const oldPublish=spPublishTimer,oldPoll=spPollNativeTimer,oldSet=spSetPhase;
  const publishHook=function(){const model=current();oldPublish();if(model?.guided)publish();};
  const pollHook=function(){if(current()||handle)poll();else oldPoll();};
  const setHook=function(next,existing){const saved=handle;if(!next&&spTimer.phase&&saved&&runtime()?.current(saved.owner)&&saved.key===spTimer.session?.key&&saved.token===spTimer.nativeToken)cancelOwned(saved);return oldSet(next,existing);};
  spPublishTimer=publishHook;spPollNativeTimer=pollHook;spSetPhase=setHook;
  function open(target){
    if(!target||target.contract!==2||typeof target.requestId!=='string')return false;
    const native=read(),owner=runtime()?.capture();
    if(native&&target.ownerEpoch===native.ownerEpoch&&target.token===native.snapshot?.token)wantedTarget=target;
    if(!owner||!runtime().canWrite()||!runtime().current(owner)||!native||target.ownerEpoch!==native.ownerEpoch||target.ownerScope!==owner.scope||
      target.key!==native.snapshot?.key||target.token!==native.snapshot?.token||target.stepKey!==native.snapshot?.stepKey)return false;
    if(typeof ui!=='undefined'&&ui.sheet||spState().sheet)return false;
    if(spTimer.phase&&spTimer.session?.key!==target.key)return false;
    if(typeof navigate==='function')navigate('sport');if(typeof ui!=='undefined'&&ui.page!=='sport')return false;const state=spState();state.tab='training';
    const option=spOptions().all.find(value=>value.key===target.key);if(!option||option.historyOnly||state.state?.workouts?.[option.key])return false;
    state.date=option.date;state.kind=option.kind;runtime().register(option,false,false);
    if(!current()||!same(native.snapshot,current())||!poll())return false;
    if(typeof render==='function')render();wantedTarget=null;readyStamp='';return true;
  }
  on(document,'visibilitychange',()=>{if(document.hidden)suspend();});on(window,'flow:suspend',suspend);
  on(window,'flow:resume',()=>{clearReadiness();poll();});on(window,'pagehide',suspend);
  on(document,'flow:sport-clock',()=>{const model=current();if(!wantedTarget||!model||document.hidden||typeof ui!=='undefined'&&ui.sheet||spState().sheet)return;const stamp=`${wantedTarget.requestId}:${model.stepKey}:${model.owner.scope}`;if(stamp===readyStamp)return;readyStamp=stamp;try{window.SorokaAndroid?.sportPhaseReady?.();}catch(_){}});
  window.flowSportNativeClock={publish,publishLegacy:state=>{const model=current();return !!model&&state?.key===model.session.key&&state?.token===spTimer.nativeToken&&publish();},poll,open,
    getState:()=>({phaseOnly:true,ready:!!handle?.ready,cancelPending:!!handle?.cancelPending,pendingReads:readinessTimer?1:0,ownerBound:!!handle,disposed}),
    dispose(){disposed=true;wantedTarget=null;clearReadiness();listeners.forEach(fn=>fn());cancelOwned();if(spPublishTimer===publishHook)spPublishTimer=oldPublish;if(spPollNativeTimer===pollHook)spPollNativeTimer=oldPoll;if(spSetPhase===setHook)spSetPhase=oldSet;}};
})();
