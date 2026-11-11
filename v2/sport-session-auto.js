/* Automatic session sequence. One clock: the existing spTimer / Countdown. */
(() => {
  'use strict';
  let key='flow.sport.auto.preview.v4',settingsKey='flow.sport.auto.settings.v4',owner=null;
  const defaults={prep:5,warmup:true};
  let sequence=null,finishHandler=null,lastNativeAdoption=null,startError='';
  function settings(){try{const saved=JSON.parse(settingsKey&&localStorage.getItem(settingsKey)||'{}');return{...defaults,warmup:typeof saved.warmup==='boolean'?saved.warmup:defaults.warmup};}catch{return{...defaults};}}
  function configure(name,value){const next=settings();if(!settingsKey||name!=='warmup')return next;next.warmup=!!value;try{localStorage.setItem(settingsKey,JSON.stringify(next));}catch{}return next;}
  function makeSteps(option,counts,config){
    const C=SP(),steps=[];
    const add=(kind,block,index,e,set,total,seconds)=>{if(seconds>0)steps.push({kind,block,index,exercise:e,set,total,seconds,group:`${block}:${index}`});};
    const workSeconds=e=>C.holdSecondsFor(e)||e.executionSeconds||0;
    const restSeconds=e=>C.restSecondsFor(e,option.plan.routine_type);
    const warm=config.warmup?option.warmup?.exercises||[]:[];
    if(warm.length){
      add('prep','warmup',0,warm[0],1,C.exerciseSets(warm[0]),config.prep);
      warm.forEach((e,index)=>{const total=C.exerciseSets(e);for(let set=1;set<=total;set++){
        add('work','warmup',index,e,set,total,workSeconds(e));
        const next=set<total?e:warm[index+1];
        if(next){const nextIndex=set<total?index:index+1,nextSet=set<total?set+1:1;add(set<total?'rest':'between','warmup',nextIndex,next,nextSet,C.exerciseSets(next),restSeconds(e));add('prep','warmup',nextIndex,next,nextSet,C.exerciseSets(next),config.prep);}
      }});
      steps.push({kind:'boundary',block:'warmup',group:'warmup:end',index:0,exercise:warm.at(-1),set:1,total:1,seconds:0});
    }
    const pending=option.plan.exercises.flatMap((e,index)=>counts[index]<C.exerciseSets(e)?[{e,index}]:[]);
    if(pending.length)add('prep','main',pending[0].index,pending[0].e,(counts[pending[0].index]||0)+1,C.exerciseSets(pending[0].e),config.prep);
    pending.forEach(({e,index},position)=>{const total=C.exerciseSets(e);for(let set=(counts[index]||0)+1;set<=total;set++){
      add('work','main',index,e,set,total,workSeconds(e));
      if(set<total)add('rest','main',index,e,set+1,total,restSeconds(e));
      else if(pending[position+1]){const next=pending[position+1];add('between','main',next.index,next.e,(counts[next.index]||0)+1,C.exerciseSets(next.e),restSeconds(e));}
    }});
    return steps;
  }
  const ready=()=>!window.flowSportRuntime||window.flowSportRuntime.canWrite();
  const owned=phase=>ready()&&!!sequence?.active&&phase?.guided===sequence.token;
  const prescription=option=>JSON.stringify([option.key,option.date,option.kind,option.plan,option.warmup]);
  const matches=option=>!!sequence&&sequence.prescription===prescription(option);
  function bindOwner(scope){
    if(sequence?.active){if(spTimer.clock?.running){sequence.pausedAt=Date.now();spTimer.clock.pause();}persist();}
    sequence=null;lastNativeAdoption=null;startError='';owner=scope;
    key=scope?`flow.sport.session.v1:${scope}`:null;
    settingsKey=scope?`flow.sport.settings.v1:${scope}`:null;
  }
  function elapsed(){return sequence?Math.max(0,Math.floor(((sequence.pausedAt||Date.now())-sequence.startedAt-(sequence.pausedTotal||0))/1000)):0;}
  function view(){if(!sequence)return null;return{active:sequence.active,step:sequence.steps[sequence.position],next:sequence.steps.slice(sequence.position+1).find(x=>x.kind==='work'),position:sequence.position,length:sequence.steps.length,skipped:[...sequence.skipped],error:sequence.error||'',paused:!!spTimer.clock&&!spTimer.clock.running,fast:sequence.fast,elapsed:elapsed()};}
  function persist(){
    if(!sequence?.active||!key)return;
    try{localStorage.setItem(key,JSON.stringify({...sequence,clock:spTimer.clock?.snapshot(),savedAt:Date.now()}));}
    catch{sequence.error='Не удалось сохранить таймер на устройстве. Не закрывай страницу.';}
  }
  function phaseFor(step){return{index:step.block==='main'?step.index:0,kind:step.kind==='prep'?'prep':step.kind==='work'?'hold':'rest',setNumber:step.set,guided:sequence.token,guidedSeconds:step.seconds};}
  function finish(){
    if(!sequence)return;
    const model=window.flowSportSession.current(),info={skipped:[...sequence.skipped],automatic:true};
    sequence.active=false;spSetPhase(null);try{localStorage.removeItem(key);}catch{}
    finishHandler?.(model,info);
  }
  function enter(){
    if(!ready()||!sequence?.active)return;
    // A journal edit can already have completed a queued set. Do not repeat it.
    while(sequence.position<sequence.steps.length){
      const step=sequence.steps[sequence.position];
      if(step.block!=='main')break;
      const done=SP().completedSets(spChecks()[step.index],SP().exerciseSets(step.exercise));
      if(done<step.set)break;
      sequence.position++;
    }
    if(sequence.position>=sequence.steps.length)return finish();
    spTimer.videoOpen=false;
    if(sequence.steps[sequence.position].kind==='boundary'){sequence.pausedAt=Date.now();spSetPhase(null);persist();return;}
    resumeElapsed();spSetPhase(phaseFor(sequence.steps[sequence.position]));persist();
  }
  function begin(model,fast=false){
    startError='';
    if(!ready()||window.flowSportRuntime&&fast){startError='Тренировка пока недоступна. Попробуй ещё раз.';return false;}
    if(sequence?.active)return false;
    const config=settings();
    const exercises=[...model.option.plan.exercises,...(config.warmup?model.option.warmup?.exercises||[]:[])];
    if(exercises.some(e=>!SP().holdSecondsFor(e)&&!(e.executionSeconds>0))){startError='В плане нет времени выполнения. Дополни длительности через ИИ.';return false;}
    if(model.phase)spSetPhase(null);
    const effective=fast?{...config,prep:2}:config;
    // Short preview also shortens timed holds; the ordinary workout keeps plan durations.
    const steps=makeSteps(model.option,model.counts,effective).map(step=>fast&&step.kind!=='boundary'?{...step,seconds:step.kind==='work'?6:step.kind==='prep'?2:4}:step);
    const started=SP().startOption(spState().state,model.option);
    spUpdate(()=>started).catch(()=>{});
    if(spState().state!==started){startError='Не удалось сохранить старт. Освободи место и повтори.';return false;}
    sequence={schema:1,owner,prescription:prescription(model.option),initialCounts:[...model.counts],active:true,token:crypto.randomUUID(),workout:model.option.key,steps,position:0,skipped:[],fast,config:effective,startedAt:Date.now(),pausedAt:null,pausedTotal:0};
    spTimer.runner=true;spTimer.dismissed=false;
    enter();return true;
  }
  function advance(expected,reason='timer'){
    if(!owned(expected)||spTimer.phase!==expected)return;
    const step=sequence.steps[sequence.position];
    if(step.kind==='work'&&step.block==='main'){
      const option=spTimer.session.option;
      spUpdate(prev=>SP().confirmWorkoutSet(prev,option,step.index,step.set)).catch(()=>{});
      if(SP().completedSets(spChecks()[step.index],step.total)<step.set){
        sequence.error='Подход не сохранился. Освободи место и повтори.';
        const clock=spTimer.clock.snapshot();
        spTimer.clock=SP().Countdown.restore({...clock,pausedMs:clock.pausedMs??Math.max(0,clock.deadline-Date.now())});
        sequence.pausedAt??=Date.now();spNoteClock();spOverlay(true);return;
      }
    }
    sequence.error='';
    sequence.position++;enter();
  }
  const commandKey=()=>ready()&&sequence?.active?`${sequence.token}:${sequence.position}`:'';
  const accepts=stamp=>!!stamp&&stamp===commandKey();
  function skipRest(stamp=commandKey()){const step=view()?.step;if(!accepts(stamp)||!step||!['rest','between','prep'].includes(step.kind))return;advance(spTimer.phase,'skip-rest');}
  function completeNow(stamp=commandKey()){if(accepts(stamp)&&view()?.step?.kind==='work')advance(spTimer.phase,'complete');}
  function skipExercise(stamp=commandKey()){
    if(!accepts(stamp))return;
    const step=view().step;
    if(!sequence.skipped.includes(step.group))sequence.skipped.push(step.group);
    let position=sequence.position+1;
    while(position<sequence.steps.length&&(sequence.steps[position].group===step.group||sequence.steps[position].kind!=='work'))position++;
    sequence.position=position;
    if(position<sequence.steps.length){const next=sequence.steps[position];sequence.steps.splice(position,0,{...next,kind:'prep',seconds:sequence.config.prep});}
    enter();
  }
  function resumeElapsed(){if(sequence.pausedAt){sequence.pausedTotal=(sequence.pausedTotal||0)+Date.now()-sequence.pausedAt;sequence.pausedAt=null;}}
  function continueBlock(){if(!ready()||view()?.step?.kind!=='boundary')return;resumeElapsed();sequence.position++;enter();}
  function skipWarmup(){if(!ready()||!sequence?.active||view().step.block!=='warmup')return;const next=sequence.steps.findIndex((x,i)=>i>sequence.position&&x.block==='main');if(next<0)return finish();resumeElapsed();sequence.position=next;enter();}
  function pause(){if(!ready()||!sequence?.active||!spTimer.clock)return;if(spTimer.clock.running){sequence.pausedAt=Date.now();spTimer.clock.pause();}else{resumeElapsed();spTimer.clock.resume();}spNoteClock();persist();spOverlay(true);}
  function pauseOnly(){if(sequence?.active&&spTimer.clock?.running){sequence.pausedAt=Date.now();spTimer.clock.pause();spNoteClock();persist();}}
  function adoptNativeClock({owner:lease,command,phase,token,clock,reference,nativeAction}={}){
    const runtime=window.flowSportRuntime,session=spTimer.session,now=Date.now(),local=spTimer.clock?.snapshot();
    if(!runtime||!runtime.current(lease)||!runtime.canWrite()||lease.scope!==owner||!accepts(command)||!owned(phase)||
      phase!==spTimer.phase||token!==spTimer.nativeToken||sequence.fast||!session||session.readOnly||session.finished||
      !matches(session.option)||sequence.steps[sequence.position].kind==='boundary')return false;
    const valid=c=>c&&Number.isSafeInteger(c.deadline)&&c.deadline>0&&c.deadline<=now+7200000&&
      (c.pausedMs===null||Number.isSafeInteger(c.pausedMs)&&c.pausedMs>=0&&c.pausedMs<=7200000);
    if(!Number.isSafeInteger(now)||!valid(local)||!valid(clock)||!valid(reference)||
      !Number.isSafeInteger(sequence.startedAt)||sequence.startedAt<=0||sequence.startedAt>now||!Number.isSafeInteger(sequence.pausedTotal)||sequence.pausedTotal<0||sequence.pausedTotal>now-sequence.startedAt||
      sequence.pausedAt!==null&&(!Number.isSafeInteger(sequence.pausedAt)||sequence.pausedAt<sequence.startedAt||sequence.pausedAt>now))return false;
    if(local.pausedMs!==null&&clock.pausedMs===null&&nativeAction!=='resume')return false;
    const equal=(a,b)=>a.deadline===b.deadline&&a.pausedMs===b.pausedMs,paused=clock.pausedMs!==null;
    const samePause=(sequence.pausedAt!==null)===paused,clockChanged=!equal(local,clock),last=lastNativeAdoption;
    if(!clockChanged&&samePause&&last?.owner===lease&&last.phase===phase&&last.token===token&&equal(last.clock,clock))return true;
    // Keep signed running remainders: a late Pause must remove all time after the real pause, even past the old deadline.
    const remaining=c=>c.pausedMs??c.deadline-now,wall=now-sequence.startedAt;
    const precise=Math.max(0,(sequence.pausedAt??now)-sequence.startedAt-sequence.pausedTotal);
    const adjusted=Math.max(0,Math.min(wall,precise+remaining(reference)-remaining(clock)));
    const changed=clockChanged||!samePause||adjusted!==precise;
    if(changed){
      sequence.pausedTotal=wall-adjusted;sequence.pausedAt=paused?now:null;
      if(clockChanged)spTimer.clock=SP().Countdown.restore({deadline:clock.deadline,pausedMs:clock.pausedMs});
      persist();
    }
    lastNativeAdoption={owner:lease,phase,token,clock:{deadline:clock.deadline,pausedMs:clock.pausedMs}};
    return true;
  }
  function stop(){if(!sequence)return;sequence.active=false;spSetPhase(null);try{localStorage.removeItem(key);}catch{}sequence=null;}
  function restore(){
    if(!ready()||!key)return false;
    let saved;try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch{return false;}
    if(!saved?.active||saved.workout!==spTimer.session?.key||!Array.isArray(saved.steps)||!Number.isInteger(saved.position)||!saved.steps[saved.position]||Date.now()-saved.savedAt>6*3600000)return false;
    if(window.flowSportRuntime){
      const option=spTimer.session.option,C=SP(),finite=n=>typeof n==='number'&&Number.isFinite(n),limit=7*86400000;
      if(saved.schema!==1||saved.owner!==owner||saved.prescription!==prescription(option)||saved.fast!==false||saved.config?.prep!==5||typeof saved.config.warmup!=='boolean')return false;
      if(!finite(saved.savedAt)||saved.savedAt>Date.now()||!finite(saved.startedAt)||saved.startedAt>saved.savedAt||!finite(saved.pausedTotal)||saved.pausedTotal<0||!Array.isArray(saved.skipped))return false;
      if(saved.pausedAt!==null&&(!finite(saved.pausedAt)||saved.pausedAt>saved.savedAt))return false;
      if(typeof saved.token!=='string'||!saved.token||!Array.isArray(saved.initialCounts)||saved.initialCounts.length!==option.plan.exercises.length)return false;
      const counts=option.plan.exercises.map((e,i)=>C.completedSets(spChecks()[i],C.exerciseSets(e)));
      if(saved.initialCounts.some((n,i)=>!Number.isInteger(n)||n<0||n>counts[i]))return false;
      const canonical=makeSteps(option,saved.initialCounts,saved.config),signature=s=>JSON.stringify([s.kind,s.block,s.index,s.set,s.total,s.seconds,s.group]);
      if(saved.steps.length>canonical.length*2)return false;
      let cursor=0;
      for(const step of saved.steps){
        const expected=canonical[cursor];if(!step||!expected)return false;
        if(signature(step)===signature(expected)){cursor++;continue;}
        // A swipe can insert preparation immediately before the next original work interval.
        if(expected.kind!=='work'||signature(step)!==signature({...expected,kind:'prep',seconds:5}))return false;
      }
      if(cursor!==canonical.length||saved.skipped.some(group=>!canonical.some(s=>s.group===group))||saved.skipped.includes(saved.steps[saved.position].group))return false;
      if(saved.steps.slice(0,saved.position).some(s=>s.block==='main'&&s.kind==='work'&&s.set>counts[s.index]&&!saved.skipped.includes(s.group)))return false;
      const clock=saved.clock;
      if(saved.steps[saved.position].kind!=='boundary'&&(!clock||!finite(clock.deadline)||clock.deadline<0||clock.deadline>Date.now()+limit||clock.pausedMs!==null&&(!finite(clock.pausedMs)||clock.pausedMs<0||clock.pausedMs>limit)))return false;
      // Stored exercise objects are never authority for the prescription or the next rendered instruction.
      saved.steps=saved.steps.map(s=>({...s,exercise:(s.block==='main'?option.plan:option.warmup).exercises[s.index]}));
    }
    sequence=saved;
    const step=saved.steps[saved.position];
    if(window.flowSportRuntime&&step.block==='main'&&SP().completedSets(spChecks()[step.index],step.total)>=step.set){enter();return true;}
    if(saved.steps[saved.position].kind==='boundary'){spTimer.phase=null;spTimer.clock=null;spTimer.runner=true;spOverlay(true);return true;}
    if(!saved.clock)return false;
    const p=phaseFor(saved.steps[saved.position]);
    spTimer.phase=p;spTimer.clock=SP().Countdown.restore(saved.clock);spTimer.nativeToken=crypto.randomUUID();
    // A reload must not award multiple missed intervals while no screen was visible.
    if(spTimer.clock.remaining()===0){sequence.pausedAt=Date.now();spTimer.clock.pause();}
    spTimer.runner=true;spTimer.dismissed=false;persist();spOverlay(true);return true;
  }
  const oldSeconds=spSecondsFor,oldDone=spPhaseDone,oldPublish=spPublishTimer,oldClockActivity=spClockActivity;
  spSecondsFor=phase=>owned(phase)?phase.guidedSeconds:oldSeconds(phase);
  spPhaseDone=phase=>phase?.guided?(owned(phase)?advance(phase):undefined):oldDone(phase);
  spClockActivity=active=>{
    if(!owned(spTimer.phase))return oldClockActivity(active);
    const step=view().step;
    document.dispatchEvent(new CustomEvent('flow:sport-clock',{detail:{active:active!==false,token:spTimer.nativeToken,stage:step.kind==='work'?'Упражнение':step.kind==='prep'?'Готовься':'Отдых',remaining:spTimer.clock.remaining(),total:step.seconds,running:spTimer.clock.running}}));
  };
  spPublishTimer=()=>{
    if(!owned(spTimer.phase))return oldPublish();
    spClockActivity();persist();
    // This isolated web prototype does not send new sequence metadata to Android.
  };
  const oldPaint=spTimerPaint;
  spTimerPaint=()=>{
    oldPaint();
    if(!sequence?.active)return;
    const left=spTimer.clock?.remaining(),format=n=>n<60?String(n):`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
    if(left!==undefined)for(const el of document.querySelectorAll('.ss-page [data-sp-time]'))el.textContent=format(left);
    for(const el of document.querySelectorAll('[data-sp-elapsed]'))el.textContent=`${String(Math.floor(elapsed()/60)).padStart(2,'0')}:${String(elapsed()%60).padStart(2,'0')}`;
    const root=document.querySelector('.ss-page');if(root&&left!==undefined)root.style.setProperty('--ss-timer-fill',`${100*Math.min(1,left/Math.max(view().step.seconds,left,1))}%`);
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseOnly();});
  window.flowSportAuto={settings,configure,makeSteps,begin,view,startError:()=>startError,skipRest,completeNow,skipExercise,pause,pauseOnly,adoptNativeClock,stop,restore,bindOwner,matches,continueBlock,skipWarmup,commandKey,accepts,onFinish:fn=>finishHandler=fn};
})();
