/* English native session adapter. Requires shared sorokaEnglishSession version 2. */
(()=>{
'use strict';
const SCHEMA=2,REVISION='english-native-20261112',MAX_BYTES=512*1024,TTL=7*86400000;
const EXERCISES=['lesson','rule','cards','build','gap','dictation','translate','structured'];
const copy=value=>JSON.parse(JSON.stringify(value));
const fail=reason=>{throw Error('english_'+reason);};
const fields=(value,names)=>Object.fromEntries(names.filter(k=>value[k]!==undefined).map(k=>[k,value[k]]));
function deck(value){
 if(!value||value.loading||!Array.isArray(value.queue)||!Array.isArray(value.fresh)||value.queue.length+value.fresh.length>600)fail('bad_deck');
 if(!Number.isInteger(value.i)||value.i<0||value.i>value.queue.length)fail('bad_position');
 const result=fields(value,['queue','fresh','newGoal','newUnknown','i','flipped','helped','answer','know','dont','learned','placement','inLesson','results','done','sessionId','sent','outcome']);
 result.graded=[...value.graded];
 if(result.graded.length>600)fail('bad_graded');
 return copy(result);
}
function checkpoint(state){
 if(state.deck&&!state.deck.loading)return {kind:'deck',task:deck(state.deck)};
 const ex=state.ex;
 if(!EXERCISES.includes(ex?.mode)||ex.loading||!Array.isArray(ex.items)||ex.items.length>500)return null;
 if(!Number.isInteger(ex.index)||ex.index<0||ex.index>ex.items.length)fail('bad_position');
 const task=copy(fields(ex,['mode','unit','rule','back','items','index','ok','done','practiceDone','picked','answer','draft','sessionId','sent','result','practiceKind','contentId','contentRevision','seed','branch','title','level','blockedReason','sourceMeta']));
 if(ex.deck)task.deck=deck(ex.deck);
 return {kind:'lesson',task};
}

function validateCheckpoint(value){
 if(value===null)return;
 if(!value||!['deck','lesson'].includes(value.kind))fail('bad_checkpoint');
 const task=value.task;
 if(value.kind==='deck'){deck(task);return;}
 if(!EXERCISES.includes(task?.mode)||!Array.isArray(task.items)||!Number.isInteger(task.index)||task.index<0||task.index>task.items.length||task.items.length>500)fail('bad_lesson');
 if(task.mode==='structured'&&(!['mission','sounds','story','radio','media'].includes(task.practiceKind)||! /^[a-f0-9]{64}$/.test(task.contentRevision)||typeof task.contentId!=='string'||task.contentId.length>80||!Number.isInteger(task.seed)||task.seed<0||task.seed>4294967295||!Number.isInteger(task.branch)||task.branch<0||task.branch>7||task.items.length>100||new Set(task.items.map(x=>x?.id)).size!==task.items.length))fail('bad_structured');
 if(task.practiceKind==='media'&&(!task.sourceMeta||JSON.stringify(task.sourceMeta).length>40000||!['song','youtube','file'].includes(task.sourceMeta.type)))fail('bad_media_source');
 if(task.deck)deck(task.deck);
}
function restoreCheckpoint(value){
 validateCheckpoint(value);if(value===null)return null;
 const task=copy(value.task);
 const hydrate=d=>({...d,graded:new Set(d.graded)});
 if(value.kind==='deck')return {deck:hydrate(task)};
 if(task.deck)task.deck=hydrate(task.deck);
 return {ex:{...task,checking:false}};
}
function openJournal({captureOwner,isCurrent,storage,now=Date.now,revision=REVISION,onAck=(cp)=>cp,afterAck=()=>{},onReject=(cp)=>cp,afterReject=()=>{}}){
 const lease=captureOwner();
 if(!lease?.authorized||!/^[a-f0-9]{64}$/.test(lease.scope))fail('owner_unavailable');
 const guard=()=>{if(!isCurrent(lease))fail('owner_changed');};
 const key=`flow.english.journal.v2:${lease.scope}`;
 guard();
 const raw=storage.getItem(key);let lastRaw=raw,resumeStatus='empty';
 const fresh=()=>{guard();if(storage.getItem(key)!==lastRaw)fail('journal_conflict');};
 let state={schema:SCHEMA,owner:lease.scope,revision,savedAt:now(),checkpointAt:null,sequence:0,checkpoint:null,outbox:[],failed:[],quarantined:[],legacyArchives:[]};
 if(raw){
  if(raw.length>MAX_BYTES)fail('journal_too_large');
  const saved=JSON.parse(raw);
  if(saved.schema!==SCHEMA||saved.owner!==lease.scope)fail('journal_incompatible');
  if(!Number.isInteger(saved.sequence)||saved.sequence<0||!Array.isArray(saved.outbox)||saved.outbox.length>1000)fail('bad_outbox');
  for(const item of saved.outbox)if(typeof item.id!=='string'||!item.id||typeof item.op!=='string'||!item.args||item.args.attempt!==item.id)fail('bad_attempt');
  const compatible=saved.revision===revision;
  const recent=Number.isFinite(saved.checkpointAt)&&saved.checkpointAt<=now()&&now()-saved.checkpointAt<=TTL;
  resumeStatus=!saved.checkpoint?'empty':!compatible?'content_changed':!recent?'expired':'available';
  if(resumeStatus==='available')validateCheckpoint(saved.checkpoint);
  // Position expiry/content change must never strand same-owner durable answers.
  state={...saved,failed:Array.isArray(saved.failed)?saved.failed:[],quarantined:Array.isArray(saved.quarantined)?saved.quarantined:[],legacyArchives:saved.legacyArchives??[],revision,checkpoint:resumeStatus==='available'?saved.checkpoint:null,checkpointAt:resumeStatus==='available'?saved.checkpointAt:null};
  if(!Array.isArray(state.legacyArchives)||state.legacyArchives.length>100||new Set(state.legacyArchives.map(x=>x?.id)).size!==state.legacyArchives.length||state.legacyArchives.some(x=>!x||x.claimedOwner!==lease.scope||x.provenance!=='user-claim-unverified'||x.disposition!=='review-only'||x.replayAllowed!==false||typeof x.raw!=='string'||x.raw.length>128*1024||! /^[a-f0-9]{64}$/.test(x.sourceHash)||x.id!=='legacy-v1:'+x.sourceHash))fail('bad_legacy_archive');
 }
 guard();
 function persist(next){
  fresh();validateCheckpoint(next.checkpoint);
  const text=JSON.stringify(next);if(text.length>MAX_BYTES)fail('journal_too_large');
  storage.setItem(key,text);lastRaw=text;guard();state=copy(next);
 }
 function commit(nextCheckpoint,operations=[]){
  fresh();
  if(operations.length>500)fail('too_many_answers');
  const outbox=copy(state.outbox);
  for(const operation of operations){
   if(typeof operation.id!=='string'||!operation.id||operation.id.length>80||!['swipe','grade','unitdone','placed','ruledone','forget','newwords','tone','practiceevent','practiceword'].includes(operation.op))fail('bad_operation');
   const entry={id:operation.id,op:operation.op,args:{...copy(operation.args),attempt:operation.id},target:operation.target||null};
   const old=outbox.find(x=>x.id===entry.id);
   if(old&&JSON.stringify(old)!==JSON.stringify(entry))fail('attempt_conflict');
   if(!old)outbox.push(entry);
  }
  if(outbox.length>1000)fail('too_many_answers');
  persist({...state,checkpoint:copy(nextCheckpoint),checkpointAt:nextCheckpoint?now():null,outbox,savedAt:now(),sequence:state.sequence+1});
  resumeStatus=nextCheckpoint?'available':'empty';
 }
 let flushing=false;
 async function flush(sendBound){
  fresh();if(flushing)return;flushing=true;
  try{
   while(state.outbox.length){
    fresh();const item=copy(state.outbox[0]);
    // Shared transport must bind/verify this lease before dispatch, not re-read B's credentials.
    let response;
    try{response=await sendBound(item.op,item.args,lease);guard();if(response?.error)throw Error(response.error);}
    catch(error){
     if(livePractice(item)&&error?.message==='practice_content_changed'){
      guard();const sessionId=item.args.sessionId,related=state.outbox.filter(entry=>entry.id===item.id||typeof sessionId==='string'&&livePractice(entry)&&entry.args.sessionId===sessionId),ids=new Set(related.map(entry=>entry.id));
      persist({...state,checkpoint:onReject(copy(state.checkpoint),item,error),outbox:state.outbox.filter(entry=>!ids.has(entry.id)),quarantined:[...(state.quarantined||[]),{sessionId,reason:error.message,entries:related}],savedAt:now(),sequence:state.sequence+1});
      for(const entry of related)afterReject(entry,error);continue;
     }
     guard();if(!['not_found','bad_unit','unknown_op'].includes(error?.message))throw error;
     persist({...state,checkpoint:onReject(copy(state.checkpoint),item,error),outbox:state.outbox.filter(x=>x.id!==item.id),failed:[...(state.failed||[]).slice(-49),{id:item.id,op:item.op,reason:error.message}],savedAt:now(),sequence:state.sequence+1});
     afterReject(item,error);continue;
    }
    // Preserve a newer local checkpoint committed while the request was in flight.
    persist({...state,checkpoint:onAck(copy(state.checkpoint),item,response),outbox:state.outbox.filter(x=>x.id!==item.id),savedAt:now(),sequence:state.sequence+1});
    afterAck(item,response);
   }
  }finally{flushing=false;}
 }
 async function archiveLegacy(plan){
  fresh();const recovery=window.FlowEnglishLegacyRecovery;if(!recovery)fail('legacy_unavailable');
  const checked=await recovery.validate(plan,{raw:storage.getItem(recovery.sourceKey),owner:lease,isCurrent,archives:state.legacyArchives});
  fresh();recovery.commitGuard(plan,{raw:storage.getItem(recovery.sourceKey),owner:captureOwner(),isCurrent});
  const existing=state.legacyArchives.find(x=>x.id===checked.archive.id);
  if(existing){if(existing.raw!==plan.raw||existing.claimedOwner!==lease.scope)fail('legacy_archive_conflict');return{archiveId:existing.id,duplicate:true};}
  if(state.legacyArchives.length>=100)fail('legacy_archive_limit');
  persist({...state,legacyArchives:[...state.legacyArchives,checked.archive],savedAt:now(),sequence:state.sequence+1});return{archiveId:checked.archive.id,duplicate:false};
 }
 return Object.freeze({key,lease,commit,flush,archiveLegacy,legacySummary(hash,raw){fresh();return{count:state.legacyArchives.length,archived:state.legacyArchives.some(x=>x.sourceHash===hash&&x.raw===raw)};},read(){fresh();return copy(state);},restore(){fresh();return restoreCheckpoint(state.checkpoint);},resumeStatus(){fresh();return resumeStatus;}});
}
function livePractice(item){return ['practiceevent','practiceword'].includes(item?.op);}

const host=window.sorokaEnglishSession;
if(host?.version!==2||window.flowEnglishSession)return;
if(typeof window.render!=='function')throw Error('english_session_load_after_app');
const required=['captureOwner','isCurrent','send','subscribeInvalidation'];
if(required.some(name=>typeof host[name]!=='function'))throw Error('english_session_bridge_contract');
const originals={};for(const name of ['enState','enCall','enQueue','enFlush','enSyncBanner','enDeckAnswer','enDeckNext','enDeckFlip','enExAnswer','enExNext','enLessonEnter','enTranslate','englishAction','render','enSpeak'])originals[name]=window[name];
let binding=null,preparing=null,transaction=null,release=null,hydrated=null,stopped=false,retry=null,notice='',serial=0,blockedLease=null,sending=null,legacyView=null,legacyPending=null,legacySerial=0;
const waiters=new Map();
const paint=()=>window.render();
function state(){try{return originals.enState();}catch{return null;}}
const live=lease=>window.sorokaEnglishSession===host&&!!binding&&binding.lease===lease&&host.isCurrent(lease)&&!stopped;
function clear(){
 legacySerial++;legacyView=null;legacyPending=null;
 serial++;binding=null;preparing=null;hydrated=null;blockedLease=null;sending=null;clearTimeout(retry);retry=null;
 release?.();release=null;
 for(const waiter of waiters.values())waiter.reject(Error('english_owner_changed'));waiters.clear();
 try{window.enLeaveEnglish();ui.en=null;}catch{}
}
function hydrate(s){
 if(!binding||hydrated===binding||!live(binding.lease))return;
 const saved=binding.journal.restore();hydrated=binding;
 if(saved){Object.assign(s,saved);s.tab=saved.deck?'words':'today';}
 s.failedLoads={};s.error='';
}
function prepare(){
 if(window.sorokaEnglishSession!==host){if(binding)clear();notice='Подключение изменилось. Откройте приложение заново.';return null;}
 const lease=host.captureOwner();
 if(binding&&!live(binding.lease))clear();
 if(!lease?.authorized||stopped)return null;
 if(!/^[a-f0-9]{64}$/.test(lease.scope)){blockedLease=lease;notice='Не удалось подтвердить владельца сохранённого занятия.';return null;}
 if(blockedLease===lease)return null;
 if(binding){hydrate(state());return binding;}
 if(preparing)return null;
 if(!navigator.locks?.request){blockedLease=lease;notice='Не удалось включить сохранение занятия: блокировка хранилища недоступна.';return null;}
 const epoch=serial;
 const job={lease};preparing=job;
 navigator.locks.request('flow.english.writer.v2:'+lease.scope,{mode:'exclusive',ifAvailable:true},async lock=>{
  if(epoch!==serial||!host.isCurrent(lease)||stopped)return;
  if(!lock){blockedLease=lease;notice='Занятие открыто в другом окне. Закройте его и повторите.';paint();return;}
  let finish;const held=new Promise(resolve=>finish=resolve);release=finish;
  try{
   binding={lease,journal:null};
   const journal=openJournal({captureOwner:()=>lease,isCurrent:current=>live(current),storage:localStorage,
    onAck(cp,item,response){if(cp?.task?.sessionId===item.target?.sessionId){if(['unitdone','ruledone'].includes(item.op))cp.task.result=response;if(item.op==='placed')cp.task.outcome=response;if(cp?.task?.mode==='structured')window.enStructuredAck?.(cp.task,item,response);}return cp;},
    afterAck(item,response){
     const s=state(),task=s?.deck||s?.ex;
     if(task?.sessionId===item.target?.sessionId){if(['unitdone','ruledone'].includes(item.op))task.result=response;if(item.op==='placed')task.outcome=response;if(task?.mode==='structured')window.enStructuredAck?.(task,item,response);}
     waiters.get(item.id)?.resolve(response);waiters.delete(item.id);
    },onReject(cp,item,error){if(cp?.task?.sessionId===item.target?.sessionId){if(['unitdone','ruledone'].includes(item.op))cp.task.result={error:true};if(item.op==='placed')cp.task.outcome={error:true};if(cp?.task?.mode==='structured'&&error.message==='practice_content_changed')cp.task.blockedReason=error.message;}return cp;},
    afterReject(item,error){const task=state()?.deck||state()?.ex;if(task?.sessionId===item.target?.sessionId){if(['unitdone','ruledone'].includes(item.op))task.result={error:true};if(item.op==='placed')task.outcome={error:true};if(task?.mode==='structured'&&error.message==='practice_content_changed')task.blockedReason=error.message;}waiters.get(item.id)?.reject(error);waiters.delete(item.id);}});
   binding={lease,journal};notice='';hydrate(state());refreshLegacy(binding);
   if(preparing===job)preparing=null;
   paint();flush();await held;
  }catch(error){blockedLease=lease;notice='Не удалось восстановить занятие. Сохранённые ответы оставлены на устройстве.';binding=null;finish();paint();}
 }).catch(()=>{blockedLease=lease;notice='Не удалось получить доступ к сохранению занятия.';}).finally(()=>{if(preparing===job)preparing=null;});
 return null;
}
function ready(){const current=prepare();if(!current)throw Error('english_owner_not_ready');return current;}
function legacyInfo(){
 const b=prepare();if(!b||!live(b.lease)||!window.FlowEnglishLegacyRecovery)return null;
 refreshLegacy(b);let raw;try{raw=localStorage.getItem(FlowEnglishLegacyRecovery.sourceKey);}catch{return null;}if(!legacyView||legacyView.binding!==b||legacyView.raw!==raw)return null;
 const summary=legacyView.summary;if(summary.status==='missing'||summary.status==='empty')return null;
 const archives=b.journal.legacySummary(summary.fingerprint,raw);return Object.freeze({...summary,token:legacyView.token,archived:archives.archived,archives:archives.count});
}
async function refreshLegacy(b=binding){
 const recovery=window.FlowEnglishLegacyRecovery;if(!b||!live(b.lease)||!recovery)return null;
 let raw;try{raw=localStorage.getItem(recovery.sourceKey);}catch{return null;}if(legacyView?.binding===b&&legacyView.raw===raw)return legacyView.summary;
 if(legacyPending?.binding===b&&legacyPending.raw===raw)return legacyPending.promise;
 const number=++legacySerial,job={binding:b,raw,promise:null};legacyPending=job;
 job.promise=(async()=>{const summary=await recovery.inspect(raw);if(number!==legacySerial||!live(b.lease)||binding!==b||localStorage.getItem(recovery.sourceKey)!==raw)return null;legacyView={binding:b,raw,summary,token:crypto.randomUUID()};paint();return summary;})().catch(()=>null).finally(()=>{if(legacyPending===job)legacyPending=null;});return job.promise;
}
function legacySelection(token){
 const b=ready(),recovery=window.FlowEnglishLegacyRecovery;if(!recovery||!legacyView||legacyView.binding!==b||legacyView.token!==token||legacyView.raw!==localStorage.getItem(recovery.sourceKey)||!live(b.lease))fail('legacy_source_changed');return{b,recovery,raw:legacyView.raw};
}
const legacyAPI=Object.freeze({info:legacyInfo,refresh:()=>refreshLegacy(),async archive({token,confirmed}={}){
 const {b,recovery,raw}=legacySelection(token),plan=await recovery.plan({raw,owner:b.lease,isCurrent:lease=>live(lease),confirmed});
 legacySelection(token);const result=await b.journal.archiveLegacy(plan);if(!live(b.lease))fail('owner_changed');paint();return result;
},export({token}={}){const {recovery,raw}=legacySelection(token);return recovery.exportRaw(raw);}});
function ensureIds(s){const task=s.deck||s.ex;if(task&&!task.loading)task.sessionId||=crypto.randomUUID();}
function save(){
 try{const b=ready(),s=state();ensureIds(s);b.journal.commit(checkpoint(s));return true;}
 catch{toast(notice||'Не удалось сохранить занятие. Переход не выполнен.');return false;}
}
function pending(op,args){
 const id=crypto.randomUUID(),s=state(),task=s.deck||s.ex;
 let resolve,reject;const result=new Promise((a,b)=>{resolve=a;reject=b;});
 const item={id,op,args:{...args,attempt:id},target:task?.sessionId?{sessionId:task.sessionId}:null};
 return {item,result,resolve,reject};
}
function queue(op,args={}){
 if(['practiceevent','practiceword'].includes(op)&&host.capabilities?.practiceEvents!==true){notice='Сохранение практики пока недоступно. Ответы оставлены на устройстве.';if(transaction)throw Error('english_practice_contract');const rejected=Promise.reject(Error('english_practice_contract'));rejected.accepted=false;return rejected;}
 if(['unitdone','placed','ruledone'].includes(op)&&host.capabilities?.completionAttempts!==true){
  notice='Сохранение итогового результата пока недоступно. Ответы сохранены на устройстве.';
  if(transaction)throw Error('english_completion_contract');
  const rejected=Promise.reject(Error('english_completion_contract'));rejected.accepted=false;return rejected;
 }
 let entry;
 try{
  const b=ready();ensureIds(state());entry=pending(op,args);
  if(transaction){transaction.entries.push(entry);return entry.result;}
  b.journal.commit(checkpoint(state()),[entry.item]);waiters.set(entry.item.id,entry);flush();return entry.result;
 }catch(error){const result=entry?.result||Promise.reject(error);if(entry)entry.reject(error);result.accepted=false;return result;}
}
function transition(fn){
 if(transaction)return fn();
 let b;try{b=ready();}catch{toast(notice||'Сохранение занятия пока недоступно. Попробуйте снова.');return false;}
 const before=state(),snapshot={...before},working={...before};
 for(const key of ['deck','ex'])if(before[key])working[key]=structuredClone(before[key]);
 const active={entries:[],effects:[],render:false};transaction=active;Object.assign(before,working);
 try{
  ensureIds(before);const result=fn();
  b.journal.commit(checkpoint(before),active.entries.map(entry=>entry.item));
  for(const entry of active.entries)waiters.set(entry.item.id,entry);
  transaction=null;
  if(active.render)paint();for(const effect of active.effects)if(live(b.lease))effect();flush();return result;
 }catch(error){
  transaction=null;if(live(b.lease)&&ui.en===before){for(const key of Object.keys(before))if(!(key in snapshot))delete before[key];Object.assign(before,snapshot);}
  for(const entry of active.entries)entry.reject(error);
  toast(notice||'Не удалось сохранить ответ. Повторите после освобождения памяти или восстановления доступа.');paint();return false;
 }
}
async function flush(){
 const b=prepare();if(!b||retry||sending?.binding===b||!b.journal.read().outbox.length)return;
 const turn={binding:b};sending=turn;
 try{await b.journal.flush((op,args,lease)=>{
  if(['practiceevent','practiceword'].includes(op)&&host.capabilities?.practiceEvents!==true)throw Error('english_practice_contract');
  if(['unitdone','placed','ruledone'].includes(op)&&host.capabilities?.completionAttempts!==true){
   notice='Сохранение итогового результата пока недоступно. Ответы сохранены на устройстве.';
   throw Error('english_completion_contract');
  }
  if(['unitdone','placed','ruledone'].includes(op))notice='';
  return host.send(op,args,lease);
 });if(live(b.lease))paint();}
 catch(error){if(!live(b.lease))return;retry=setTimeout(()=>{retry=null;flush();},10000);}
 finally{if(sending===turn)sending=null;}
}
window.enState=function(){prepare();const s=originals.enState();hydrate(s);if(!binding&&notice){s.error=notice;for(const failure of Object.values(s.failedLoads||{}))failure.error=notice;}return s;};
window.enCall=function(op,args={},options){try{const b=ready();return host.send(op,args,b.lease,op==='speech'?options:undefined);}catch(error){return Promise.reject(error);}};
window.enQueue=queue;window.enFlush=flush;
window.render=function(...args){if(transaction){transaction.render=true;return;}return originals.render(...args);};
window.enSpeak=function(...args){if(transaction){transaction.effects.push(()=>originals.enSpeak(...args));return Promise.resolve();}return originals.enSpeak(...args);};
for(const name of ['enDeckAnswer','enDeckNext','enDeckFlip','enExAnswer','enExNext','enLessonEnter'])window[name]=function(...args){return transition(()=>originals[name](...args));};
window.englishAction=function(action,...args){if(action==='en-retry'){blockedLease=null;prepare();}return action.startsWith('en-training-')||['en-tab','en-practice-course','en-practice-back','en-ex-quit','en-deck-quit','en-ex-show','en-skip','en-ex-rate','en-tile','en-tile-back','en-tile-clear','en-gap'].includes(action)?transition(()=>originals.englishAction(action,...args)):originals.englishAction(action,...args);};
window.enTranslate=function(text,...args){const ex=state()?.ex;if(EXERCISES.includes(ex?.mode)&&!ex.answer&&!ex.checking){ex.draft=text;if(!save())return Promise.resolve();}return originals.enTranslate(text,...args);};
function nativeSyncBanner(){
 const b=prepare(),snapshot=b?.journal.read(),n=snapshot?.outbox.length||0;
 const failed=snapshot?.failed?.length||0;
 const quarantined=snapshot?.quarantined?.reduce((n,group)=>n+(group.entries?.length||0),0)||0;
 if(quarantined)return `<p class="section-note" role="status">${quarantined} ответов из обновлённого материала сохранены для проверки. Остальные ответы продолжают отправляться.</p>`;
 if(!b&&notice&&Object.values(state()?.failedLoads||{}).some(failure=>failure.error===notice))return '';
 return notice?`<p class="section-note" role="status">${esc(notice)}</p>`:failed?`<p class="section-note" role="status">Не удалось отправить ${failed} ${enPlural(failed,'ответ','ответа','ответов')}: учебный материал больше недоступен. Остальные ответы продолжают отправляться.</p>`:n?`<p class="section-note" role="status">Ответы сохранены на устройстве · ожидают отправки: ${n}</p>`:'';
}
window.enSyncBanner=function(){const info=legacyInfo();return nativeSyncBanner()+(window.FlowEnglishLegacyUI?.banner(info)||'');};
document.addEventListener('input',event=>{
 const field=event.target;if(field?.name!=='answer'||!field.closest?.('[data-en-tr],[data-en-dict],[data-en-training-form]'))return;
 const s=state();if(!EXERCISES.includes(s?.ex?.mode)||s.ex.answer)return;s.ex.draft=field.value;save();
});
host.subscribeInvalidation(()=>{clear();prepare();paint();});
window.addEventListener('online',()=>{blockedLease=null;clearTimeout(retry);retry=null;prepare();flush();});
window.addEventListener('pagehide',()=>{if(binding)save();stopped=true;clear();});
window.addEventListener('pageshow',()=>{stopped=false;prepare();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){blockedLease=null;prepare();flush();}});
window.flowEnglishSession=Object.freeze({save,prepare,legacy:legacyAPI,effect(fn){const b=ready();if(typeof fn!=='function')throw Error('bad_effect');if(transaction)transaction.effects.push(fn);else if(live(b.lease))fn();},ready:()=>!!binding&&live(binding.lease)});
prepare();

})();
