/* Headless English controller. Same native journal/content, explicit host and lifecycle. */
import {createNativeJournalTools} from './english-domain-journal.mjs';
import {createNativeDeckController} from './english-domain-deck.mjs';
import {createMediaEvidence} from './english-domain-media.mjs';

const clone=value=>structuredClone(value),error=reason=>Error('english_domain_'+reason);
const frozen=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;};
const plain=value=>JSON.parse(JSON.stringify(value,(_key,x)=>x instanceof Set?[...x]:x));
const norm=value=>String(value??'').normalize('NFKC').replace(/[’‘]/g,"'").trim().toLowerCase();
const readOps=new Set(['today','words','wordlist','course','progress','practiceprogress','songs','song','books','book','theory','rules','phrases','facts']);
const completionOps=new Set(['unitdone','placed','ruledone']);

export function createEnglishDomain({host,storage,locks,cores,legacyRecovery,effects={},now=Date.now,id=()=>crypto.randomUUID()}={}){
 if(host?.version!==2||['captureOwner','isCurrent','send','subscribeInvalidation'].some(k=>typeof host[k]!=='function'))throw error('host_contract');
 if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||typeof locks?.request!=='function')throw error('storage_contract');
 if(!cores?.authored||!cores.media||!cores.lyrics||[cores.authored,cores.media,cores.lyrics].some(c=>! /^[a-f0-9]{64}$/.test(c.revision)))throw error('core_contract');
 const {checkpoint,openJournal}=createNativeJournalTools({legacyRecovery});
 const listeners=new Set(),requests=new Map(),controllers=new Set(),waiters=new Map();let state={deck:null,ex:null},data={},status='starting',issue=null,suspended=false,disposed=false,generation=0,binding=null,connecting=null,draining=null,transaction=null,unsubscribe,revision=0,course=null,courseLoading=null,reader=null,readerLoading=null,chat=null,chatLoading=null;
 const swipesAvailable=()=>host.capabilities?.swipes!==false;
 const capabilities=()=>({today:true,words:true,courseRead:true,progressRead:true,deck:swipesAvailable(),authoredPractice:host.capabilities?.practiceEvents===true,mediaPractice:host.capabilities?.practiceEvents===true,lyricsPractice:host.capabilities?.practiceEvents===true,lesson:!!course?.enabled(),reader:!!reader?.enabled(),conversation:!!chat?.enabled(),musicLibrary:false,musicImport:false,speech:typeof effects.speak==='function',mediaPlayback:typeof effects.play==='function',legacyReview:false,routes:{today:course?.enabled()?'lesson-and-read':'read',words:swipesAvailable()?'deck-and-read':'read',course:course?.enabled()?'native-course-and-practice':'catalog-and-practice',progress:'read',read:reader?.enabled()?'original-and-cached':'unavailable',chat:chat?.enabled()?'bound-conversation':chat?'context-only':'unavailable'},actions:{lesson:!!course?.enabled(),reader:!!reader?.enabled(),chat:!!chat?.enabled(),import:false,deck:swipesAvailable(),practice:host.capabilities?.practiceEvents===true,practicePreview:typeof effects.play==='function',serverChecking:host.capabilities?.serverChecking===true,preferences:host.capabilities?.preferences===true,rules:host.capabilities?.rules===true},audio:{play:typeof effects.play==='function',tts:typeof effects.speak==='function',asr:false,clockOwner:'injected-effects'}});
 const valid=b=>!!b&&!disposed&&binding===b&&b.generation===generation&&host.isCurrent(b.lease);
 const active=()=>state.deck||state.ex;
 const engine=ex=>ex?.practiceKind==='media'?(ex.contentRevision===cores.lyrics.revision?cores.lyrics:cores.media):cores.authored;
 const step=()=>state.ex?.mode!=='structured'?course?.project()?.step??null:state.ex&&state.ex.index<state.ex.items.length?engine(state.ex).resolve(state.ex.items[state.ex.index],state.ex.branch||0):null;
 const needs=q=>q?.audioMatch?(q.pairs||[]).map(p=>'pair:'+p.id):(q?.clips||[]).map((_,i)=>'clip:'+i);
 const supported=(q,raw)=>raw?.assistance?.transcript||raw?.assistance?.shown||needs(q).every(k=>raw?.heard?.includes(k));
 function readiness(){
  if(state.ex?.mode!=='structured')return course?.readiness(status==='ready'&&!suspended)||{canSubmit:false,canNext:false,canSkip:false,canSelfCheck:false,needs:[],heard:[]};
  const ex=state.ex,q=step(),raw=ex?.items?.[ex.index];
  if(status!=='ready'||suspended||!q||ex.blockedReason)return{canSubmit:false,canNext:false,canSkip:false,canSelfCheck:false,needs:[],heard:[]};
  const heard=raw.heard||[],listened=!!supported(q,raw),decision=q.kind==='decision'&&Number.isInteger(raw.choice)&&raw.choice>=0&&raw.choice<(q.options||[]).length;
  const lyricsFilled=ex.contentRevision===cores.lyrics.revision&&raw.answers?.length===q.gaps?.length;
  const entered=ex.contentRevision===cores.lyrics.revision?lyricsFilled:q.kind==='choice'?Number.isInteger(raw.choice):q.kind==='order'?raw.selection?.length===q.parts?.length:q.kind==='match'?raw.matches?.length===q.pairs?.length:q.kind==='speak'?!!raw.selfcheck:typeof ex.draft==='string'&&!!ex.draft.trim();
  return{canSubmit:!raw.result&&!['info','decision'].includes(q.kind)&&listened&&!!entered,canNext:q.kind==='info'?listened:q.kind==='decision'?listened&&decision:!!raw.result&&(raw.result.correct!==null||!!raw.selfcheck)||!!lyricsFilled&&listened,canSkip:true,canSelfCheck:q.kind==='speak'||raw.result?.correct===null,needs:needs(q),heard:[...heard]};
 }
 function getSnapshot(){
  let sync={pending:0,failed:0,quarantined:0,resume:'empty'};if(valid(binding)){try{const j=binding.journal.read();sync={pending:j.outbox.length,failed:j.failed.length,quarantined:j.quarantined.length,resume:binding.journal.resumeStatus()};}catch{sync={...sync,conflict:true};}}
  const task=active(),result=task?.result||task?.outcome,locallyDone=state.deck?!!state.deck.done:!!state.ex&&state.ex.index===state.ex.items.length;
  const native=course?.project(),nativeReceipt=!!result&&!result.error&&!result.few&&typeof result.passed==='boolean';
  const done=state.deck?locallyDone:state.ex?.mode==='structured'?result?.completed:['lesson','rule'].includes(state.ex?.mode)?nativeReceipt:locallyDone;
  const nativeData={...data};for(const key of readOps)if(Object.hasOwn(state,key))nativeData[key]=state[key];
  const reading=reader?.getSnapshot()||null,conversation=chat?.getSnapshot()||null;
  return frozen(plain({version:1,revision,status,owner:binding?.lease.scope??null,suspended,loading:requests.size>0||!!native?.checking||!!reading?.loading||!!conversation?.loading,pendingReads:[...requests.keys()],data:nativeData,reader:reading,chat:conversation,task:task||null,taskKind:state.deck?'deck':native?.taskKind||(state.ex?.mode==='structured'?'practice':state.ex?'unsupported-native':null),nativeView:course?.view||null,nativeMode:native?.nativeMode||null,assessed:native?.assessed??null,step:step(),resolvedStep:step(),rawStep:state.ex?.items?.[state.ex.index]||null,readiness:readiness(),sync,error:issue,capabilities:capabilities(),confirmed:!!done&&sync.pending===0&&sync.failed===0&&sync.quarantined===0,catalog:cores.authored.catalog()}));
 }
 function notify(){revision++;const snapshot=getSnapshot();for(const fn of [...listeners]){try{fn(snapshot);}catch{ /* UI subscriber cannot break the journal. */ }}}
 function requireReady(){if(disposed)throw error('disposed');if(!valid(binding)||!binding.journal)throw error('owner_not_ready');return binding;}
 function stopEffects(){for(const c of controllers)c.abort();controllers.clear();try{effects.stop?.();}catch{}}
 function invalidate(){generation++;for(const request of requests.values())request.abort?.();requests.clear();stopEffects();course?.cancel();reader?.cancel();chat?.cancel();for(const waiter of waiters.values())waiter.reject(error('owner_changed'));waiters.clear();const old=binding;binding=null;old?.release?.();state={deck:null,ex:null};data={};issue=null;status=disposed?'disposed':'starting';notify();}
 function ackCheckpoint(cp,item,response){
  if(!cp?.task||cp.task.sessionId!==item.target?.sessionId)return cp;
  if(item.op==='practiceword'){const row=cp.task.items?.[item.target.index];if(row){row.wordSaves||={};row.wordSaves[item.target.term]=response;}}
  else if(item.op==='practiceevent'&&item.args.event==='complete'||completionOps.has(item.op)){if(item.op==='placed')cp.task.outcome=response;else cp.task.result=response;}
  return cp;
 }
 function adopt(journal){const restored=journal.restore();state={...state,deck:null,ex:null,...restored};if(state.ex?.mode==='structured'&&state.ex.contentRevision!==engine(state.ex).revision)state.ex.blockedReason='practice_content_changed';}
 async function connect(){
  if(disposed)throw error('disposed');try{if((host.capabilities?.lessons===true||host.capabilities?.preferences===true)&&!course)await initializeCourse();if(host.capabilities?.reader===true&&!reader)await initializeReader();}catch(cause){if(!disposed){status='blocked';issue=cause.message;notify();}throw cause;}if(disposed)throw error('disposed');if(valid(binding)&&binding.journal)return true;if(connecting?.generation===generation)return connecting.promise;
  const lease=host.captureOwner();if(!lease?.authorized||! /^[a-f0-9]{64}$/.test(lease.scope)){status='blocked';issue='english_owner_not_ready';notify();return false;}
  const gen=generation;let resolveReady,rejectReady;const readyPromise=new Promise((a,b)=>{resolveReady=a;rejectReady=b;}),job={generation:gen,promise:readyPromise};connecting=job;
  const b={lease,generation:gen,journal:null,release:null};let release;const held=new Promise(r=>release=r);b.release=release;
  const lockRun=locks.request('flow.english.writer.v2:'+lease.scope,{mode:'exclusive',ifAvailable:true},async lock=>{
   if(disposed||gen!==generation||!host.isCurrent(lease)){release();resolveReady(false);return;}
   if(!lock){status='blocked';issue='english_writer_unavailable';notify();resolveReady(false);return;}
   binding=b;
   try{
    b.journal=openJournal({captureOwner:()=>lease,isCurrent:l=>l===lease&&valid(b),storage,now,
     onAck:ackCheckpoint,afterAck(item,response){if(!valid(b))return;adopt(b.journal);issue=null;const waiter=waiters.get(item.id);if(waiter){waiters.delete(item.id);if(!item.target?.sessionId||active()?.sessionId===item.target.sessionId)waiter.resolve(response);else waiter.reject(error('view_changed'));}if(['unitdone','ruledone','swipe','grade','newwords'].includes(item.op)){for(const key of ['today','words','wordlist','progress','course','rules']){data[key]=null;state[key]=null;}if(item.op==='ruledone')state.rulesStale=true;}notify();},
     onReject(cp,item,cause){if(cp?.task?.sessionId===item.target?.sessionId){if(cause.message==='practice_content_changed')cp.task.blockedReason=cause.message;else cp.task.result={error:true};}return cp;},
     afterReject(item,cause){const waiter=waiters.get(item.id);if(waiter){waiters.delete(item.id);waiter.reject(cause);}if(valid(b)){adopt(b.journal);issue=cause.message;notify();}}});
    adopt(b.journal);if((host.capabilities?.conversation===true||effects.chatContextStore)&&!chat){try{await initializeChat();}catch(cause){if(!chat||!valid(b))throw cause;}}if(!valid(b)){release();resolveReady(false);return;}status='ready';issue=null;notify();resolveReady(true);void drain();await held;
   }catch(cause){if(binding===b){binding=null;status='blocked';issue=cause.message;notify();}release();rejectReady(cause);}
  });
  b.lockRun=lockRun;lockRun.catch(cause=>{if(gen===generation&&!disposed){status='blocked';issue=cause.message;notify();}rejectReady(cause);});
  try{return await readyPromise;}finally{if(connecting===job)connecting=null;}
 }
 function requireCapability(op){if(op==='swipe'&&!swipesAvailable())throw error('swipes_unavailable');if(op==='grade'&&host.capabilities?.grades===false)throw error('grades_unavailable');if(['practiceevent','practiceword','practicesource','practiceprogress'].includes(op)&&host.capabilities?.practiceEvents!==true)throw error('practice_contract');if(completionOps.has(op)&&host.capabilities?.completionAttempts!==true)throw error('completion_contract');}
 function record(op,args,target){requireCapability(op);if(!transaction)throw error('transaction_required');const attempt=id();if(typeof attempt!=='string'||!/^[A-Za-z0-9:._-]{1,80}$/.test(attempt))throw error('bad_attempt');transaction.operations.push({id:attempt,op,args:{...clone(args),attempt},target:target||{sessionId:active()?.sessionId}});return true;}
 function effect(fn){if(transaction)transaction.effects.push(fn);else fn();}
 function queue(op,args){if(!transaction)throw error('transaction_required');record(op,args);const item=transaction.operations.at(-1);let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});promise.catch(()=>{});transaction.waiters.push({id:item.id,resolve,reject});return promise;}
 async function drain(){
  if(disposed||!valid(binding)||!binding.journal)return false;const b=binding;if(draining?.binding===b)return draining.promise;
  const run={binding:b,promise:null};draining=run;
  run.promise=(async()=>{try{await b.journal.flush((op,args,lease)=>{requireCapability(op);if(!valid(b)||lease!==b.lease)throw error('owner_changed');return host.send(op,args,lease);});if(valid(b)){adopt(b.journal);issue=null;notify();}return true;}catch(cause){if(valid(b)){issue=cause.message;notify();}return false;}finally{if(draining===run)draining=null;}})();return run.promise;
 }
 function transact(fn){
  const b=requireReady(),before=state;state=clone(state);const work={operations:[],effects:[],waiters:[]};transaction=work;
  try{const answer=fn();if(active())active().sessionId||=id();b.journal.commit(checkpoint(state),work.operations);for(const w of work.waiters)waiters.set(w.id,w);transaction=null;issue=null;notify();for(const fn of work.effects)if(valid(b)&&!suspended)try{fn();}catch(cause){issue=cause.message;notify();}void drain();return{accepted:true,durable:true,revision,result:answer??null};}
  catch(cause){transaction=null;for(const w of work.waiters)w.reject(cause);if(valid(b))state=before;issue=cause.message;notify();throw cause;}
 }
 function speak(text){if(typeof effects.speak!=='function')return;const b=binding,c=new AbortController();effect(()=>{controllers.add(c);Promise.resolve(effects.speak({text,signal:c.signal,isCurrent:()=>valid(b)&&!c.signal.aborted})).catch(cause=>{if(valid(b)&&!c.signal.aborted){issue=cause.message;notify();}}).finally(()=>controllers.delete(c));});}
 const deckController=createNativeDeckController({getState:()=>state,record:(op,args)=>record(op,args),render:()=>{},speak,stop:()=>effect(stopEffects),nextExercise:()=>course.next()});
 const captureView=()=>{const b=requireReady(),sid=state.ex?.sessionId,index=state.ex?.index;return()=>valid(b)&&!suspended&&state.ex?.sessionId===sid&&state.ex.index===index;};
 const call=async(op,args)=>{const b=requireReady(),response=await host.send(op,clone(args),b.lease);if(!valid(b))throw error('owner_changed');if(response?.error)throw Error(response.error);return response;};
 async function loadCourseTask(op,args,accept){const b=requireReady(),token={};requests.set('task',token);notify();try{const response=await host.send(op,clone(args),b.lease);if(!valid(b)||requests.get('task')!==token)throw error('owner_changed');if(response?.error)throw Error(response.error);return accept(response);}catch(cause){if(valid(b)){issue=cause.message;notify();}throw cause;}finally{if(requests.get('task')===token){requests.delete('task');if(valid(b))notify();}}}
 async function initializeCourse(){if(course)return course;if(!courseLoading)courseLoading=import('./english-domain-course.mjs').then(({createEnglishCourseController})=>{if(disposed)throw error('disposed');course=createEnglishCourseController({host,state:()=>state,ready:requireReady,id,deck:deckController,mutate:transact,record,queue,captureView,call,load,accept:(key,value)=>{data={...data,[key]:clone(value)};state[key]=clone(value);notify();},loadTask:loadCourseTask,notify:()=>{if(!transaction)notify();},issue:text=>{issue=text;notify();},speak,stop:()=>effect(stopEffects)});return course;}).catch(cause=>{courseLoading=null;throw cause;});return courseLoading;}
 async function initializeReader(){if(reader)return reader;if(!readerLoading)readerLoading=import('./english-domain-reader.mjs').then(({createEnglishReaderController})=>{if(disposed)throw error('disposed');reader=createEnglishReaderController({host,ready:requireReady,notify,preferences:effects.readerPreferences,isActive:()=>!disposed&&!suspended});return reader;}).catch(cause=>{readerLoading=null;throw cause;});return readerLoading;}
 async function initializeChat(){if(chat)return chat;if(!chatLoading)chatLoading=import('./english-domain-chat.mjs').then(async({createEnglishChatController})=>{if(disposed)throw error('disposed');chat=createEnglishChatController({host,ready:requireReady,notify,contextStore:effects.chatContextStore,effects:{speak:effects.speak,stop:effects.stop},isActive:()=>!disposed&&!suspended,getToday:()=>state.today||null,id});await chat.ready;return chat;}).catch(cause=>{chatLoading=null;throw cause;});return chatLoading;}
 function requirePractice(){const ex=state.ex;if(ex?.mode!=='structured')throw error('no_practice');if(ex.blockedReason)throw error(ex.blockedReason);if(ex.index>=ex.items.length)throw error('already_complete');if(ex.contentRevision!==engine(ex).revision)throw error('practice_content_changed');return ex;}
 function payload(ex,index,event,extra={}){const raw=ex.items[index];return{sessionId:ex.sessionId,kind:ex.practiceKind,contentId:ex.contentId,revision:ex.contentRevision,seed:ex.seed,index,event,answer:raw?.answer??null,assistance:raw?.checkedAssistance||raw?.assistance||{},heard:raw?.checkedHeard||raw?.heard||[],skipped:!!raw?.skipped,...extra};}
 function checkAnswer(ex,answer){const raw=ex.items[ex.index],q=engine(ex).resolve(raw,ex.branch||0);raw.assistance||={};if(!supported(q,raw))throw error('listen_first');
  if(q.kind==='info')raw.result={correct:null,engine:'instruction'};
  else if(q.kind==='speak'){if(!['ready','need-practice'].includes(answer))throw error('selfcheck_required');raw.selfcheck=answer;raw.result={correct:null,engine:'self-check',answer};}
  else raw.result=engine(ex).check(q,answer);
  raw.answer=clone(answer??null);raw.checkedAssistance=clone(raw.assistance);raw.checkedHeard=[...(raw.heard||[])];return raw.result;
 }
 function next(skip=false,args={}){
  const ex=requirePractice(),raw=ex.items[ex.index],q=engine(ex).resolve(raw,ex.branch||0);raw.assistance||={};
  if(skip){raw.skipped=true;raw.result={correct:false,engine:'skipped'};raw.answer=null;}
  else if(q.kind==='info'||q.kind==='decision')checkAnswer(ex,q.kind==='decision'?args.answer??raw.choice:null);
  else if(!raw.result&&ex.contentRevision===cores.lyrics.revision)checkAnswer(ex,raw.answers||[]);
  else if(!raw.result||raw.result.correct===null&&!raw.selfcheck)throw error('answer_required');
  const index=ex.index;record('practiceevent',payload(ex,index,'answer'),{sessionId:ex.sessionId,index});
  if(q.kind==='decision'&&!skip)ex.branch=Number(raw.answer);ex.index++;ex.draft='';
  if(ex.index===ex.items.length){record('practiceevent',payload(ex,ex.index,'complete'),{sessionId:ex.sessionId});ex.sent=true;}
  effect(stopEffects);return{accepted:true};
 }
 async function load(resource,args={}){
  if(!readOps.has(resource))throw error('unsupported_read');const b=requireReady();requireCapability(resource);const previous=requests.get(resource),request={};previous?.abort?.();requests.set(resource,request);notify();
  try{const answer=await host.send(resource,clone(args),b.lease);if(!valid(b)||requests.get(resource)!==request)throw error('owner_changed');if(answer?.error)throw Error(answer.error);data={...data,[resource]:clone(answer)};state[resource]=clone(answer);issue=null;notify();return clone(answer);}
  catch(cause){if(valid(b)&&requests.get(resource)===request){issue=cause.message;notify();}throw cause;}
  finally{if(requests.get(resource)===request){requests.delete(resource);if(valid(b))notify();}}
 }
 async function startDeck(args){const b=requireReady(),token={};requests.set('task',token);notify();try{const response=await host.send('deck',{},b.lease);if(!valid(b)||requests.get('task')!==token)throw error('owner_changed');if(!response||!Array.isArray(response.due)||!Array.isArray(response.fresh))throw error('bad_deck_response');return transact(()=>{effect(stopEffects);state.ex=null;state.deck=deckController.make(response);state.deck.sessionId=id();deckController.fill(state.deck);});}finally{if(requests.get('task')===token){requests.delete('task');if(valid(b))notify();}}}
 async function startMedia(args){const b=requireReady(),token={};requireCapability('practicesource');requests.set('task',token);notify();try{const response=await host.send('practicesource',clone(args),b.lease);if(!valid(b)||requests.get('task')!==token)throw error('owner_changed');const expected=args.style==='lyrics'?cores.lyrics:cores.media;if(response?.exercise?.contentRevision!==expected.revision)throw error('practice_content_changed');return transact(()=>{state.deck=null;state.ex=clone(response.exercise);state.ex.sessionId=id();effect(stopEffects);});}finally{if(requests.get('task')===token){requests.delete('task');if(valid(b))notify();}}}
 async function command(name,args={},options={}){
  if(disposed)throw error('disposed');if(options.baseRevision!==undefined&&options.baseRevision!==revision)throw error('stale_revision');if(name.startsWith('deck.')&&!swipesAvailable())throw error('swipes_unavailable');if(name==='connect')return connect();if(name==='flush'||name==='retry')return drain();
  if(name==='suspend'){suspended=true;stopEffects();chat?.cancel();notify();return true;}if(name==='resume'){suspended=false;notify();return drain();}
  if(suspended&&/^(deck\.|practice\.|media\.|lesson\.|exercise\.|rule\.|theory\.|words\.|reader\.|chat\.|course\.select|audio\.speak)/.test(name))throw error('suspended');
  if(name==='audio.stop'){stopEffects();return true;}if(name==='audio.speak'){requireReady();if(typeof effects.speak!=='function')throw error('speech_provider_unavailable');if(typeof args.text!=='string'||!args.text.trim()||args.text.length>4000)throw error('bad_speech');speak(args.text);return{accepted:true};}
  if(name==='load')return load(args.resource,args.args||{});if(name==='words.query')return load('wordlist',{filter:args.filter??'learning',q:args.q??''});if(name==='deck.start'){course?.cancel();reader?.cancel();chat?.cancel();return startDeck(args);}if(name==='media.start'){course?.cancel();reader?.cancel();chat?.cancel();return startMedia(args);}
  if(name.startsWith('chat.')){if(!chat)throw error('conversation_unsupported');const current=requireReady();if(['chat.start','chat.restore'].includes(name)){requests.delete('task');course?.cancel();reader?.cancel();stopEffects();}const result=await chat.command(name,args);if(valid(current)&&['chat.send','chat.word'].includes(name)){for(const key of ['words','wordlist','phrases','progress','rules']){data[key]=null;state[key]=null;}state.rulesStale=true;notify();}return result;}
  if(name.startsWith('reader.')){if(!reader)throw error('reader_unsupported');const current=requireReady();requests.delete('task');course?.cancel();chat?.cancel();stopEffects();const result=await reader.command(name,args);if(valid(current)&&['reader.word','reader.import','reader.delete'].includes(name)){for(const key of ['words','wordlist','phrases','progress','books']){data[key]=null;state[key]=null;}notify();}return result;}
  if(/^(lesson\.|exercise\.|rule\.|theory\.|words\.|course\.select)/.test(name)||name==='deck.quit'&&state.ex?.deck){if(!course)throw error('lesson_unsupported');if(['lesson.start','exercise.start','rule.start','theory.open'].includes(name)){reader?.cancel();chat?.cancel();}return course.command(name,args);}
  if(name==='practice.start'){requireCapability('practiceevent');requests.delete('task');course?.cancel();reader?.cancel();chat?.cancel();return transact(()=>{effect(stopEffects);state.deck=null;state.ex=cores.authored.create(args.kind,args.id,args.seed);state.ex.sessionId=id();});}
  if(name==='close'){reader?.cancel();chat?.cancel();return transact(()=>{requests.delete('task');course?.cancel();effect(stopEffects);state={deck:null,ex:null};});}
  if(name==='deck.quit')return transact(()=>{effect(stopEffects);state.deck=null;});
  if(name==='deck.answer'||name==='deck.next'||name==='deck.flip')return transact(()=>{const d=state.deck||state.ex?.deck;if(!d||d.done)return;if(name==='deck.answer')deckController.answer(!!args.know);else if(name==='deck.next'){if(d.answer!=='dont')throw error('answer_required');deckController.next();}else deckController.flip();});
  if(name==='practice.word')return transact(()=>{const ex=state.ex,index=args.index??ex?.index,raw=ex?.items?.[index];if(!ex||!raw?.result)throw error('word_after_answer');if(!Number.isInteger(index)||index<0||index>ex.index||ex.practiceKind!=='media'&&index!==ex.index)throw error('word_step_order');if(ex.blockedReason)throw error(ex.blockedReason);const q=engine(ex).resolve(raw,ex.branch||0),terms=[...(q.target?[q.target]:[]),...(q.pairs||[])].filter(x=>typeof x.word==='string'&&typeof x.ru==='string'&&x.word.trim()&&x.ru.trim()),term=args.term;if(!Number.isInteger(term)||!terms[term])throw error('bad_term');raw.wordSaves||={};if(raw.wordSaves[term])return;raw.wordSaves[term]='pending';record('practiceword',payload(ex,index,'word',{term}),{sessionId:ex.sessionId,index,term});});
  if(name.startsWith('practice.'))return transact(()=>{
   const ex=requirePractice(),raw=ex.items[ex.index],q=engine(ex).resolve(raw,ex.branch||0);raw.assistance||={};
   if(name==='practice.skip')return next(true,args);if(name==='practice.next')return next(false,args);
   if(name==='practice.preview'){
    if(typeof effects.play!=='function')throw error('media_provider_unavailable');const row=q.examples?.[args.example],part=args.part??0,text=q.phonetics?row?.[part]?.word:row?.[0];const asset=cores.authored.audio(text);if(!Number.isInteger(args.example)||!Number.isInteger(part)||typeof text!=='string'||!asset)throw error('bad_example');const b=binding,c=new AbortController(),sid=ex.sessionId,index=ex.index;effect(()=>{stopEffects();controllers.add(c);Promise.resolve(effects.play({preview:true,sessionId:sid,index,clip:{asset,audioText:text},signal:c.signal,isCurrent:()=>valid(b)&&!suspended&&!c.signal.aborted&&state.ex?.sessionId===sid&&state.ex.index===index})).catch(cause=>{if(valid(b)&&!c.signal.aborted){issue=cause.message;notify();}});});return;
   }
   if(name==='practice.self'){if(!['ready','need-practice'].includes(args.value))throw error('bad_selfcheck');if(q.kind==='speak')return checkAnswer(ex,args.value);if(raw.result?.correct!==null)throw error('bad_selfcheck');raw.selfcheck=args.value;return;}
   if(raw.result)throw error('already_answered');
   if(name==='practice.draft'){if(typeof args.value!=='string'||args.value.length>10000)throw error('bad_draft');ex.draft=args.value;return;}
   if(name==='practice.input'){if(ex.contentRevision!==cores.lyrics.revision||!q.gaps?.length)throw error('lyrics_only');raw.answers||=[];if(raw.answers.length===q.gaps.length)return;const value=String(args.value??'').slice(0,200).replace(/^\s+/,'');raw.typed=value;const expected=q.gaps[raw.answers.length].text;if(value&&!norm(expected).startsWith(norm(value))){raw.assistance.hint=true;raw.mistakes=(raw.mistakes||0)+1;}if(norm(value)===norm(expected)){raw.answers.push(expected);raw.typed='';}return;}
   if(name==='practice.choose'){if(!['choice','decision'].includes(q.kind)||!Number.isInteger(args.value)||args.value<0||args.value>=(q.options||[]).length)throw error('bad_choice');raw.choice=args.value;return;}
   if(name==='practice.pick'){if(q.kind!=='order'||!q.parts.some(p=>p.id===args.id))throw error('bad_part');if(!raw.selection?.includes(args.id))raw.selection=[...(raw.selection||[]),args.id];return;}
   if(name==='practice.unpick'){if(q.kind!=='order')throw error('bad_part');raw.selection=(raw.selection||[]).filter(x=>x!==args.id);return;}
   if(name==='practice.matchLeft'){if(q.kind!=='match'||!q.pairs.some(p=>p.id===args.id))throw error('bad_pair');raw.selectedLeft=args.id;return;}
   if(name==='practice.matchRight'){if(q.kind!=='match'||!q.pairs.some(p=>p.id===raw.selectedLeft)||!q.right.some(p=>p.id===args.id))throw error('bad_pair');raw.matches=[...(raw.matches||[]).filter(p=>p.leftId!==raw.selectedLeft&&p.rightId!==args.id),{leftId:raw.selectedLeft,rightId:args.id}];raw.selectedLeft=null;return;}
   if(name==='practice.translation'){if(ex.practiceKind!=='media')throw error('media_only');raw.showTranslation=!raw.showTranslation;if(raw.showTranslation)raw.assistance.transcript=true;return;}
   if(name==='practice.hint'){raw.assistance.transcript=true;raw.assistance.shown=true;return;}
   if(name==='practice.heard')throw error('media_samples_required');
   if(name==='practice.play'){
    if(typeof effects.play!=='function')throw error('media_provider_unavailable');if(!needs(q).includes(args.key))throw error('bad_clip');raw.playCounts||={};raw.playCounts[args.key]=(raw.playCounts[args.key]||0)+1;raw.assistance.replays=Math.max(...Object.values(raw.playCounts));if(args.slow)raw.assistance.slow=true;
    const b=binding,c=new AbortController(),sid=ex.sessionId,index=ex.index,clip=args.key.startsWith('pair:')?q.pairs.find(p=>p.id===args.key.slice(5)):q.clips?.[Number(args.key.split(':')[1])];
    const current=()=>valid(b)&&!suspended&&!c.signal.aborted&&state.ex?.sessionId===sid&&state.ex.index===index&&!state.ex.items[index]?.result;
    effect(()=>{stopEffects();controllers.add(c);let tracker,heard=false,ended=false,credited=false,sampleClock=now(),pendingSamples=[];const mark=()=>{if(credited||!current()||!heard||ex.practiceKind!=='media'&&!ended)return;try{transact(()=>{const row=state.ex.items[index];row.heard=[...new Set([...(row.heard||[]),args.key])];});credited=true;}catch{}};
     const metadata=({duration}={})=>{if(!current()||tracker)return;const bounds=ex.practiceKind==='media'?{start:clip.start,end:clip.end}:{start:0,end:duration};tracker=createMediaEvidence({clip:bounds,allowEnded:ex.practiceKind!=='media',now:()=>sampleClock,isCurrent:current,onHeard:()=>{heard=true;mark();},onSupport:kind=>{if(!current())return;try{transact(()=>{state.ex.items[index].assistance[kind==='slow'?'slow':'hint']=true;});}catch{}}});for(const sample of pendingSamples){sampleClock=sample.at;tracker.sample(sample.value);}pendingSamples=[];};
     if(ex.practiceKind==='media')metadata();c.signal.addEventListener('abort',()=>tracker?.dispose(),{once:true});
     const callback=fn=>(...values)=>{if(!current())return;try{return fn(...values);}catch(cause){issue=cause.message;c.abort();notify();}};
     Promise.resolve(effects.play({sessionId:sid,index,key:args.key,clip:clone(clip),step:clone(q),slow:!!args.slow,signal:c.signal,isCurrent:current,onMetadata:callback(metadata),onSample:callback(sample=>{sampleClock=now();if(tracker)tracker.sample(sample);else{if(pendingSamples.length===32)pendingSamples.shift();pendingSamples.push({value:clone(sample),at:sampleClock});}}),onEnded:callback(()=>{ended=true;mark();})})).catch(cause=>{if(valid(b)&&!c.signal.aborted){issue=cause.message;notify();}});
    });return;
   }
   if(name==='practice.answer'){const answer=args.answer!==undefined?args.answer:q.kind==='choice'||q.kind==='decision'?raw.choice:q.kind==='order'?raw.selection||[]:q.kind==='match'?raw.matches||[]:q.kind==='speak'?raw.selfcheck:ex.contentRevision===cores.lyrics.revision?raw.answers||[]:ex.draft||'';return checkAnswer(ex,answer);}throw error('unsupported_command');
  });
  throw error('unsupported_command');
 }
 async function dispose(){if(disposed)return;const old=binding;disposed=true;unsubscribe?.();reader?.dispose();chat?.dispose();invalidate();listeners.clear();await old?.lockRun?.catch(()=>{});}
 unsubscribe=host.subscribeInvalidation(()=>{invalidate();if(!disposed)void connect().catch(()=>{});});if(typeof unsubscribe!=='function')throw error('host_subscription');
 const ready=connect();ready.catch(()=>{});
 return Object.freeze({ready,getSnapshot,subscribe(fn){if(disposed)throw error('disposed');if(typeof fn!=='function')throw error('subscriber');listeners.add(fn);return()=>listeners.delete(fn);},command,dispose});
}
