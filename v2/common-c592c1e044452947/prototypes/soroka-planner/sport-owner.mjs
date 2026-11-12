import {makeSteps, prescription, samePrescription, resolveWorkouts, validateCheckpoint} from './sport-sequence.mjs';

const copy = value => structuredClone(value);
const fail = (code, message) => Object.assign(new Error(message), {code});
const validDate = date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T12:00:00Z`)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) === date;
const text = value => typeof value === 'string' ? value.trim() : '';

/** One headless domain owner. The host atomically persists changes AND session before resolving commit. */
export function createSportOwner({core:C, host, scheduler=globalThis, autoTick=true}) {
  for (const key of ['Countdown','stateChanges','confirmWorkoutSet','workoutOptions','recordSets']) {
    if (!C?.[key]) throw new TypeError(`SportCore.${key} required`);
  }
  const captured = host.capture(), lease = captured ? Object.freeze({...captured}) : null;
  let envelope = null, sequence = null, clock = null, journal = null, viewRevision = 0;
  let disposed = false, closing = false, invalidated = false, error = null, minimized = false;
  let queue = Promise.resolve(), ticker = null, tickPending = null, mediaResource = null, mediaAbort = null;
  let media = {items:[], selectedId:null, source:null}, sessionFingerprint = '', requestCounter = 0;
  const listeners = new Set(), requests = new Map(), allowedMedia = new Set();
  const route = {tab:'today',date:C.todayKey(),kind:'main'};
  const uuid = () => host.uuid?.() || globalThis.crypto.randomUUID();
  const now = () => host.now();
  const current = () => !disposed && !invalidated && !!lease && host.current(lease);
  function releaseMedia() {
    mediaAbort?.abort(); mediaAbort=null;
    try { mediaResource?.release(); } catch {/* A failing optional provider must not retain owner resources. */}
    finally { mediaResource=null;media={items:[],selectedId:null,source:null};allowedMedia.clear(); }
  }
  function invalidate() {
    if(invalidated)return;
    invalidated=true;
    if(ticker!==null) scheduler.clearInterval(ticker);
    ticker=null;releaseMedia();sequence=null;clock=null;journal=null;envelope=null;requests.clear();error=null;
    // Subscribers must actively clear an already rendered private model on lease loss.
    emit();listeners.clear();
  }
  function assertCurrent() { if(!current()){invalidate();throw fail('stale','Владелец тренировки изменился.');} }
  const stepKey = () => sequence?.active ? `${sequence.token}:${sequence.position}` : null;
  const counts = (option,state=envelope.state) => option.plan.exercises.map((e,i)=>C.completedSets(C.optionChecks(option,state)[i],C.exerciseSets(e)));
  const options = () => resolveWorkouts(C,envelope);
  function optionFor(key, writable=false) {
    const o=options().visible.find(o=>o.key===key);
    if(!o)throw fail('not_ready','Занятие недоступно.');
    if(writable && (o.historyOnly || o.date>C.todayKey() || (envelope.state.programLifecycle?.[C.optionProgramKey(o)]?.status??'active')!=='active'))throw fail('not_ready','Это занятие нельзя изменить.');
    return o;
  }
  function bindClock() { clock=sequence?.active && sequence.clock ? C.Countdown.restore(sequence.clock) : null; }
  function pauseLocal(message) {
    if(sequence?.active && clock){
      const s=clock.snapshot();clock=C.Countdown.restore({...s,pausedMs:s.pausedMs??Math.max(0,s.deadline-now())});
      sequence.pausedAt??=now();sequence.clock=clock.snapshot();
    }
    error=message;
  }
  function readHost({restore=false}={}) {
    assertCurrent();
    const next=copy(host.read(lease));
    if(!Number.isSafeInteger(next.revision)||!next.state||!next.catalog)throw fail('not_ready','Данные спорта ещё не загружены.');
    const fingerprint=JSON.stringify(next.session??null);
    envelope=next;
    if(restore || fingerprint!==sessionFingerprint){
      sessionFingerprint=fingerprint;sequence=null;clock=null;
      if(next.session?.active){
        const option=options().visible.find(o=>o.key===next.session.workout);
        sequence=option&&validateCheckpoint(C,next.session,option,next.state,lease.scope,now());
        if(sequence){
          bindClock();
          if(clock?.remaining(now())===0)pauseLocal(null);
        }else error='Сохранённая тренировка изменилась. Начни её заново.';
      }else if(next.session?.active===false && next.session.owner===lease.scope && next.session.summary){
        // Summary contains no executable queue; actual counts always come from Core state.
        sequence=copy(next.session);
      }
    }
    if(sequence?.active){
      const option=options().visible.find(o=>o.key===sequence.workout);
      if(!option||!samePrescription(C,sequence.prescription,option)){
        sequence=null;clock=null;error='План изменился. Начни тренировку заново.';
      }
    }
    return envelope;
  }
  function exercise(e,index=0,o=null) {
    if(!e)return null;
    const seconds=C.holdSecondsFor(e)||e.executionSeconds||null;
    return {id:String(e.id??`index:${index}`),name:e.name,scheme:e.sets_reps||'',mode:e.mode||'manual',sets:C.exerciseSets(e),executionSeconds:seconds,
      restSeconds:C.restSecondsFor(e,o?.plan.routine_type||'main'),technique:e.technique||'',primary:[...(e.muscles?.primary||[])],secondary:[...(e.muscles?.secondary||[])],videoId:C.youtubeVideoId(e.video)};
  }
  function project() {
    if(!current())invalidate();
    const base={profileId:lease?.scope||'',ownerEpoch:lease?.epoch||'',viewRevision,dataRevision:envelope?.revision??0,
      sync:copy(envelope?.sync||{state:envelope?'ready':'loading',pending:envelope?.pending||0}),route:copy(route),workouts:[],selectedWorkoutKey:null,workoutKeys:[],session:null,profile:null,history:{sessions:[],exercises:[]},journal:null,
      error,capabilities:{privateMedia:false,nativePhaseOnlyV2:false,muscleMap:false},media:copy(media),minimized};
    if(!envelope)return base;
    const {visible}=options(),state=envelope.state;
    try{base.capabilities.privateMedia=!!host.privateMedia?.available(lease);}catch{base.capabilities.privateMedia=false;}
    base.selectedWorkoutKey=C.selectedOption(visible,route.date,route.kind,state)?.key??null;
    base.workoutKeys=visible.filter(o=>o.date===route.date&&o.kind===route.kind).map(o=>o.key);
    base.workouts=visible.map(o=>({key:o.key,date:o.date,kind:o.kind,title:o.plan.title,programTitle:o.programTitle,
      readOnly:!!o.historyOnly||o.date>C.todayKey()||(state.programLifecycle?.[C.optionProgramKey(o)]?.status??'active')!=='active',finished:!!state.workouts?.[o.key],
      exercises:o.plan.exercises.map((e,i)=>exercise(e,i,o)),counts:counts(o,state)}));
    if(sequence){
      const s=sequence.steps?.[sequence.position],o=visible.find(o=>o.key===sequence.workout),next=sequence.steps?.slice(sequence.position+1).find(s=>s.kind==='work');
      base.session={workoutKey:sequence.workout,stepKey:stepKey(),phase:sequence.active?s?.kind:'summary',block:s?.block||'main',
        index:s?.index??null,set:s?.set??null,total:s?.total??null,exercise:exercise(s?.exercise,s?.index,o),next:exercise(next?.exercise,next?.index,o),
        clock:clock?.snapshot()||null,totalMs:s?Math.max(s.seconds*1000,clock?.snapshot().pausedMs??(clock?.snapshot().deadline-now())??0):null,
        remainingSeconds:clock?.remaining(now())??null,elapsedSeconds:Math.max(0,Math.floor(((sequence.pausedAt??now())-sequence.startedAt-sequence.pausedTotal)/1000)),
        paused:!!clock&&!clock.running,skipped:[...sequence.skipped],error,active:!!sequence.active};
    }
    base.profile={fields:C.PROFILE_FIELDS.map(f=>{const value=state.trainingProfile?.[f.key]??null;return{key:f.key,label:f.label,value,type:f.date?'date':f.choice?'choice':f.slider?'range':f.health?'textarea':'text',
      optional:f.key==='medications',health:!!f.health,...(f.choice?{choices:[...f.choice]}:{}),...(f.slider?{min:f.slider.min,max:f.slider.max,step:f.slider.step??1}:{}),...(f.scale&&value!==null?{valueLabel:f.scale(Number(value))}:{})};}),
      gaps:C.profileGaps(state),targetMuscles:copy(state.targetMuscles||[]),equipment:copy(C.equipmentOf(state)),
      equipmentItems:C.EQUIPMENT.map(({kinds,...e})=>({...e,...(kinds?{kinds:kinds.map(({id,label})=>({id,label}))}:{})})),trainingPlace:copy(state.trainingPlace||null),
      trainingPlaces:copy(C.TRAINING_PLACES),weekdays:copy(C.WEEKDAYS),muscleGroups:copy(C.MUSCLE_GROUPS),favorites:C.favoriteExercises(state),
      measurementFields:C.measurementFields(state).map(f=>({...f,history:C.measurementHistory(state,f.id)}))};
    base.history={sessions:C.workoutJournal(visible,state),exercises:C.exerciseStats(visible,state)};
    base.journal=copy(journal);
    return copy(base);
  }
  function emit() {viewRevision++;const model=project();for(const fn of [...listeners])try{fn(copy(model));}catch{/* A renderer must not interrupt local commit. */}return model;}
  const serial = fn => {const job=queue.then(fn);queue=job.catch(()=>{});return job;};
  function ack(accepted='read',data) {return{ok:true,accepted,dataRevision:envelope.revision,pending:envelope.pending??envelope.sync?.pending??0,...(data!==undefined?{data}: {})};}
  function stamp(s) {if(!s)return null;return{...s,clock:s.active?s.clock:null,savedAt:now()};}
  async function commit(requestId,nextState,nextSession=sequence) {
    assertCurrent();const previousStep=stepKey(),packet={requestId,baseRevision:envelope.revision,changes:C.stateChanges(envelope.state,nextState),session:stamp(nextSession)};
    const result=await host.commit(lease,copy(packet));
    assertCurrent();
    if(!result||!Number.isSafeInteger(result.revision)||result.revision<=packet.baseRevision)throw fail('not_ready','Устройство не подтвердило сохранение.');
    const fresh=copy(host.read(lease));
    if(fresh.revision<result.revision)throw fail('not_ready','Сохранённое состояние пока недоступно.');
    envelope=fresh;sessionFingerprint=JSON.stringify(fresh.session??null);
    if(JSON.stringify(fresh.session??null)===JSON.stringify(packet.session)){
      sequence=copy(packet.session);bindClock();
    }else readHost({restore:true});
    if(previousStep!==stepKey())releaseMedia();
    error=null;emit();return ack('local');
  }
  function resumeElapsed(s) {if(s.pausedAt!==null){s.pausedTotal+=now()-s.pausedAt;s.pausedAt=null;}}
  function enter(s,o,state) {
    const done=counts(o,state);
    while(s.position<s.steps.length){const step=s.steps[s.position];if(step.block!=='main'||done[step.index]<step.set)break;s.position++;}
    if(s.position>=s.steps.length){s.active=false;s.summary=true;s.clock=null;s.pausedAt??=now();return C.finishOption(state,o,true,new Date(now()));}
    const step=s.steps[s.position];
    if(step.kind==='boundary'){s.pausedAt??=now();s.clock=null;}
    else{resumeElapsed(s);s.clock={deadline:now()+step.seconds*1000,pausedMs:null};}
    return state;
  }
  function requirePhase(intent) {
    if(!sequence?.active||intent.workoutKey!==sequence.workout||intent.stepKey!==stepKey())throw fail('stale','Этот этап уже сменился.');
    return optionFor(sequence.workout,true);
  }
  async function advance(id,intent) {
    const o=requirePhase(intent),s=copy(sequence),step=s.steps[s.position];let state=envelope.state;
    if(step.kind==='work'&&step.block==='main')state=C.confirmWorkoutSet(state,o,step.index,step.set);
    s.position++;state=enter(s,o,state);return commit(id,state,s);
  }
  async function sessionIntent(id,intent) {
    const o=optionFor(intent.workoutKey,true);
    switch(intent.action){
      case 'select':return commit(id,C.chooseOption(envelope.state,o));
      case 'start':{
        if(sequence?.active)throw fail('invalid','Тренировка уже идёт.');
        if(envelope.state.workouts?.[o.key])throw fail('invalid','Это занятие уже завершено.');
        const config={prep:5,warmup:envelope.settings?.warmup!==false};
        const exercises=[...o.plan.exercises,...(config.warmup?o.warmup?.exercises||[]:[])];
        if(exercises.some(e=>!C.holdSecondsFor(e)&&!(e.executionSeconds>0)))throw fail('not_ready','В плане нет времени выполнения. Дополни длительности через ИИ.');
        const initialCounts=counts(o),steps=makeSteps(C,o,initialCounts,config);
        if(!steps.length)throw fail('invalid','Все подходы уже отмечены.');
        const s={schema:1,owner:lease.scope,prescription:prescription(o),initialCounts,active:true,token:uuid(),workout:o.key,steps,position:0,skipped:[],fast:false,config,startedAt:now(),pausedAt:null,pausedTotal:0,clock:null};
        minimized=false;return commit(id,enter(s,o,C.startOption(envelope.state,o,new Date(now()))),s);
      }
      case 'minimize':if(!sequence||sequence.workout!==intent.workoutKey||intent.stepKey!==stepKey())throw fail('stale','Занятие уже сменилось.');minimized=true;emit();return ack();
      case 'stop':if(!sequence||sequence.workout!==intent.workoutKey||intent.stepKey!==stepKey())throw fail('stale','Занятие уже сменилось.');return commit(id,envelope.state,null);
      case 'finish':{requirePhase(intent);const s=copy(sequence);s.active=false;s.summary=true;s.pausedAt??=now();s.clock=null;return commit(id,C.finishOption(envelope.state,o,true,new Date(now())),s);}
      case 'continueBlock':{requirePhase(intent);if(sequence.steps[sequence.position].kind!=='boundary')throw fail('invalid','Нет перехода между блоками.');const s=copy(sequence);s.position++;return commit(id,enter(s,o,envelope.state),s);}
      case 'skipWarmup':{requirePhase(intent);if(sequence.steps[sequence.position].block!=='warmup')throw fail('invalid','Разминка уже закончилась.');const s=copy(sequence);const at=s.steps.findIndex((x,i)=>i>s.position&&x.block==='main');s.position=at<0?s.steps.length:at;return commit(id,enter(s,o,envelope.state),s);}
      default:throw fail('invalid','Неизвестное действие занятия.');
    }
  }
  async function clockIntent(id,intent) {
    const o=requirePhase(intent),s=copy(sequence),step=s.steps[s.position];
    if(intent.action==='skipExercise'){
      if(!s.skipped.includes(step.group))s.skipped.push(step.group);
      let at=s.position+1;while(at<s.steps.length&&(s.steps[at].group===step.group||s.steps[at].kind!=='work'))at++;
      s.position=at;if(at<s.steps.length)s.steps.splice(at,0,{...s.steps[at],kind:'prep',seconds:s.config.prep});
      return commit(id,enter(s,o,envelope.state),s);
    }
    if(intent.action==='skipRest'){
      if(!['prep','rest','between'].includes(step.kind))throw fail('invalid','Сейчас идёт упражнение.');return advance(id,intent);
    }
    if(intent.action==='completeNow'){
      if(step.kind!=='work')throw fail('invalid','Сейчас нет подхода.');return advance(id,intent);
    }
    if(!clock)throw fail('invalid','На этом этапе нет таймера.');
    // Mutate a plain candidate snapshot; the sole active Countdown changes only after local ACK.
    const candidate=clock.snapshot();
    if(intent.action==='pause'){
      if(candidate.pausedMs===null){candidate.pausedMs=Math.max(0,candidate.deadline-now());s.pausedAt??=now();}
    }else if(intent.action==='resume'){
      if(candidate.pausedMs!==null){candidate.deadline=now()+candidate.pausedMs;candidate.pausedMs=null;resumeElapsed(s);}
    }else if(intent.action==='adjust'){
      if(!Number.isFinite(intent.seconds)||Math.abs(intent.seconds)>3600)throw fail('invalid','Некорректная поправка таймера.');
      if(candidate.pausedMs===null)candidate.deadline=Math.max(now(),candidate.deadline+intent.seconds*1000);
      else candidate.pausedMs=Math.max(0,candidate.pausedMs+intent.seconds*1000);
    }else throw fail('invalid','Неизвестное действие таймера.');
    s.clock=candidate;return commit(id,envelope.state,s);
  }
  function journalTarget(intent) {
    const o=optionFor(intent.workoutKey,true),i=o.plan.exercises.findIndex((e,i)=>String(e.id??`index:${i}`)===intent.exerciseId);
    if(i<0||!text(intent.draftId))throw fail('invalid','Упражнение или черновик не найдены.');return{o,i,e:o.plan.exercises[i]};
  }
  async function journalIntent(id,intent) {
    const {o,i,e}=journalTarget(intent);
    if(intent.action==='open'){
      const today=C.exerciseSetLogs(envelope.state,o,i),previous=C.previousSetLogs(envelope.state,e.name,o.key),unit=C.holdSecondsFor(e)>0?'seconds':'reps';
      const entries=logs=>logs.filter(l=>Number.isInteger(l.actualReps)&&l.actualReps>0).map(l=>({reps:l.actualReps,kilograms:l.kilograms??null}));
      journal={workoutKey:o.key,exerciseId:intent.exerciseId,draftId:intent.draftId,unit,previousUnit:'unknown',today:entries(today),sets:entries(today),previous:entries(previous),previousDate:previous[0]?.date??null,basis:C.workoutLoad(envelope.state,o,i)?.basis??null};
      emit();return ack();
    }
    if(!journal||journal.draftId!==intent.draftId||journal.workoutKey!==o.key||journal.exerciseId!==intent.exerciseId)throw fail('stale','Черновик уже закрыт.');
    if(intent.action==='copyPrevious'){journal.sets=copy(journal.previous);emit();return ack();}
    if(intent.action!=='save')throw fail('invalid','Неизвестное действие журнала.');
    if(!Array.isArray(intent.sets))throw fail('invalid','Укажи фактические подходы.');
    const basis=intent.basis??undefined;
    if(basis!==undefined&&!Object.hasOwn(C.WEIGHT_BASIS,basis))throw fail('invalid','Укажи базу измерения веса.');
    C.validateSets(intent.sets);
    const result=await commit(id,C.recordSets(envelope.state,o,i,copy(intent.sets),basis,new Date(now())));
    journal=null;emit();return result;
  }
  function profileState(intent) {
    if(!text(intent.draftId)||!intent.changes||typeof intent.changes!=='object'||Array.isArray(intent.changes))throw fail('invalid','Нет черновика профиля.');
    const changes=intent.changes,state=envelope.state;
    if(intent.action==='saveFields'){
      const profile={...state.trainingProfile};
      for(const [key,value] of Object.entries(changes)){
        const f=C.PROFILE_FIELDS.find(f=>f.key===key);if(!f)throw fail('invalid','Неизвестное поле анкеты.');
        if(typeof value!=='string'||value.length>4000)throw fail('invalid','Проверь ответ анкеты.');const v=value.trim();
        if(v&&f.choice&&!f.choice.includes(v))throw fail('invalid','Выбери вариант ответа.');
        if(v&&f.date&&(!validDate(v)||C.ageFromBirthDate(v)===null))throw fail('invalid','Проверь дату рождения.');
        if(v&&f.slider){const n=Number(v),{min,max,step=1}=f.slider;if(!Number.isFinite(n)||n<min||n>max||Math.abs((n-min)/step-Math.round((n-min)/step))>1e-6)throw fail('invalid','Ответ вне шкалы.');}
        profile[key]=v;
      }
      return{...state,trainingProfile:{...profile,updatedAt:new Date(now()).toISOString()}};
    }
    if(intent.action==='saveEquipment'){
      const equipment={...state.equipment};
      for(const [key,value] of Object.entries(changes.equipment??(Object.hasOwn(changes,'trainingPlace')?{}:changes))){
        const item=C.EQUIPMENT.find(e=>e.id===key);if(!item||!value||typeof value.has!=='boolean')throw fail('invalid','Проверь инвентарь.');
        if(value.kg!==undefined&&value.kg!==null&&C.validEquipmentKg(String(value.kg))===undefined)throw fail('invalid','Проверь вес инвентаря.');
        if(value.kind!==undefined&&!item.kinds?.some(k=>k.id===value.kind))throw fail('invalid','Проверь вид инвентаря.');
        const entry={...equipment[key],has:value.has};if(value.kg===null)delete entry.kg;else if(value.kg!==undefined)entry.kg=value.kg;
        if(value.kind!==undefined)entry.kind=value.kind;equipment[key]=entry;
      }
      let trainingPlace=state.trainingPlace;
      if(changes.trainingPlace!==undefined){const p=changes.trainingPlace;if(!p||!C.TRAINING_PLACES.some(i=>i.id===p.where)||!Array.isArray(p.gymDays)||p.gymDays.some(d=>!Number.isInteger(d)||d<1||d>7))throw fail('invalid','Проверь дни зала.');trainingPlace={...trainingPlace,where:p.where,gymDays:[...new Set(p.gymDays)]};}
      return{...state,equipment,...(trainingPlace?{trainingPlace}: {})};
    }
    if(intent.action==='saveMuscles'){
      if(!Array.isArray(changes.targetMuscles)||changes.targetMuscles.some(id=>!C.MUSCLE_GROUPS.some(g=>g.id===id)))throw fail('invalid','Проверь мышцы.');
      return{...state,targetMuscles:C.knownMuscles(changes.targetMuscles)};
    }
    if(intent.action==='toggleFavorite'){
      if(!text(changes.name)||changes.name.length>160)throw fail('invalid','Укажи упражнение.');return C.toggleFavorite(state,changes.name);
    }
    if(intent.action==='saveMeasurement'){
      const field=C.measurementFields(state).find(f=>f.id===changes.fieldId&&!f.archived),value=text(changes.value);
      if(!field||!value||value.length>120)throw fail('invalid','Проверь замер.');
      return{...state,measurementEntries:{...state.measurementEntries,[uuid()]:{fieldId:field.id,value,recordedAt:new Date(now()).toISOString()}}};
    }
    throw fail('invalid','Неизвестное действие профиля.');
  }
  async function mediaIntent(id,intent) {
    const provider=host.privateMedia;
    if(!provider?.available(lease))throw fail('unavailable','Личная библиотека не подключена.');
    const o=optionFor(intent.workoutKey),e=o.plan.exercises.find((e,i)=>String(e.id??`index:${i}`)===intent.exerciseId);
    if(!e)throw fail('invalid','Упражнение не найдено.');
    if(intent.action==='close'){releaseMedia();emit();return ack();}
    if(intent.action==='search'){
      releaseMedia();const controller=new AbortController();mediaAbort=controller;
      const items=await provider.search(lease,text(intent.query).slice(0,160),controller.signal);assertCurrent();
      if(controller.signal.aborted||closing)throw fail('stale','Поиск закрыт.');
      media.items=items.map(item=>({id:String(item.id),name:String(item.name),instructions:(item.instructions||[]).map(String)}));for(const item of media.items)allowedMedia.add(item.id);
      emit();return ack('read',copy(media.items));
    }
    if(!allowedMedia.has(intent.mediaId))throw fail('invalid','Сначала выбери упражнение из поиска.');
    if(intent.action==='choose'){
      await provider.choose(lease,{workoutKey:o.key,exerciseId:intent.exerciseId,exerciseName:e.name,mediaId:intent.mediaId});assertCurrent();media.selectedId=intent.mediaId;emit();return ack();
    }
    if(intent.action==='play'){
      if(sequence?.active&&clock?.running)await clockIntent(`${id}:pause`,{kind:'clock',action:'pause',workoutKey:sequence.workout,stepKey:stepKey()});
      mediaResource?.release();mediaResource=null;mediaAbort?.abort();const controller=new AbortController();mediaAbort=controller;
      const resource=await provider.resolve(lease,intent.mediaId,'clip',controller.signal);
      if(!current()||closing||controller.signal.aborted){resource.release();throw fail('stale','Просмотр закрыт.');}
      mediaResource=resource;media.source={src:resource.src,mime:resource.mime};media.selectedId=intent.mediaId;emit();return ack();
    }
    throw fail('invalid','Неизвестное действие библиотеки.');
  }
  async function perform(request) {
    assertCurrent();if(closing)throw fail('stale','Тренировка закрывается.');readHost();
    const {intent,requestId}=request;
    if(request.ownerEpoch!==lease.epoch)throw fail('stale','Владелец тренировки изменился.');
    if(intent.kind==='refresh'){emit();return ack();}
    if(request.baseRevision!==envelope.revision)throw fail('stale','Данные изменились. Повтори действие.');
    if(intent.kind==='view'){
      if(intent.tab!==undefined&&!['today','training','profile','history'].includes(intent.tab)||intent.date!==undefined&&!validDate(intent.date)||intent.workoutKind!==undefined&&!['main','splits'].includes(intent.workoutKind))throw fail('invalid','Проверь раздел или дату.');
      if(intent.tab!==undefined)route.tab=intent.tab;if(intent.date!==undefined)route.date=intent.date;if(intent.workoutKind!==undefined)route.kind=intent.workoutKind;emit();return ack();
    }
    if(intent.kind==='session')return sessionIntent(requestId,intent);
    if(intent.kind==='clock')return clockIntent(requestId,intent);
    if(intent.kind==='journal')return journalIntent(requestId,intent);
    if(intent.kind==='profile')return commit(requestId,profileState(intent));
    if(intent.kind==='media')return mediaIntent(requestId,intent);
    throw fail('invalid','Неизвестное действие спорта.');
  }
  function rejected(e) {
    const code=['quota','stale','not_ready','invalid','unavailable'].includes(e?.code)?e.code:e?.name==='QuotaExceededError'||e?.message==='outbox_storage'?'quota':'not_ready';
    const message=code==='quota'?'Не удалось сохранить на устройстве. Освободи место и повтори.':e?.message||'Не удалось сохранить. Повтори действие.';
    if(current()){if(code==='quota'||code==='not_ready')pauseLocal(message);else error=message;emit();}
    return{ok:false,code,error:message};
  }
  function dispatch(request) {
    if(!current()){invalidate();return Promise.resolve({ok:false,code:'stale',error:'Тренировка закрыта.'});}
    if(closing)return Promise.resolve({ok:false,code:'stale',error:'Тренировка закрыта.'});
    if(!request||!text(request.requestId)||request.requestId.length>160||!request.intent)return Promise.resolve({ok:false,code:'invalid',error:'Нет идентификатора действия.'});
    if(request.ownerEpoch!==lease.epoch)return Promise.resolve({ok:false,code:'stale',error:'Владелец тренировки изменился.'});
    if(request.intent.kind==='media'&&['close','search'].includes(request.intent.action))mediaAbort?.abort();
    const key=request.requestId,body=JSON.stringify(request),previous=requests.get(key);
    if(previous)return previous.body===body?previous.promise:Promise.resolve({ok:false,code:'invalid',error:'Идентификатор действия уже использован.'});
    const job=serial(()=>perform(copy(request))).catch(rejected).then(result=>{if(!result.ok)requests.delete(key);return result;});
    requests.set(key,{body,promise:job});if(requests.size>256){for(const [id,value]of requests){if(id!==key&&value.settled){requests.delete(id);break;}}}job.then(()=>{const entry=requests.get(key);if(entry)entry.settled=true;});return job;
  }
  function tick() {
    if(!current()){invalidate();return Promise.resolve(false);}
    if(tickPending)return tickPending;
    const expected=stepKey();
    tickPending=serial(async()=>{
      assertCurrent();if(closing)return false;readHost();
      if(!sequence?.active||stepKey()!==expected||!clock){emit();return false;}
      if(!clock.expire(now())){emit();return false;}
      await advance(`sport-tick:${lease.epoch}:${++requestCounter}:${expected}`,{workoutKey:sequence.workout,stepKey:expected});return true;
    }).catch(e=>{rejected(e);return false;}).finally(()=>{tickPending=null;});
    return tickPending;
  }
  async function suspendWork() {
    assertCurrent();readHost();releaseMedia();
    if(sequence?.active&&clock?.running)return clockIntent(`sport-suspend:${uuid()}`,{kind:'clock',action:'pause',workoutKey:sequence.workout,stepKey:stepKey()});
    if(sequence?.active&&clock&&JSON.stringify(sequence)!==JSON.stringify(envelope.session))return commit(`sport-suspend:${uuid()}`,envelope.state,sequence);
    return ack();
  }
  function suspend(){releaseMedia();return serial(suspendWork).catch(rejected);}
  async function dispose(){
    if(disposed)return true;if(closing)return false;closing=true;
    if(ticker!==null)scheduler.clearInterval(ticker);ticker=null;releaseMedia();
    const result=await serial(suspendWork).catch(rejected);disposed=true;sequence=null;clock=null;journal=null;envelope=null;requests.clear();listeners.clear();return !!result.ok;
  }
  try{readHost({restore:true});}catch(e){rejected(e);}
  if(autoTick&&current())ticker=scheduler.setInterval(()=>{void tick();},200);
  return{snapshot:project,dispatch,tick,subscribe(fn){if(!current())throw new Error('Disposed Sport owner');listeners.add(fn);return()=>listeners.delete(fn);},
    async flush(){await queue;return current()&&!error;},suspend,dispose};
}
