/* Native chat state/fix provenance: english.js 269b51f261122c125c949293624604ed8c47d440b88ade22dc5a40ba5819173d.
 * Provider requests use only the injected confirmed host; no legacy stream or demo transport. */
export const nativeChatSource=Object.freeze({path:'prototypes/soroka-planner/english.js',sha256:'269b51f261122c125c949293624604ed8c47d440b88ade22dc5a40ba5819173d',functions:Object.freeze(['enChatStart','enApplyFix'])});
const FALLBACK='Sorry, could you say that again?';
const fail=reason=>Error('english_chat_'+reason),copy=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max)=>typeof value==='string'&&value.length<=max;
const identity=value=>text(value,80)&&/^[A-Za-z0-9:._-]+$/.test(value);
const savedId=value=>Number.isSafeInteger(value)&&value>0;
function bounded(value,depth=0,budget={nodes:0}){
 if(++budget.nodes>20000||depth>10)return false;
 if(value===null||typeof value==='boolean')return true;if(typeof value==='number')return Number.isFinite(value);if(typeof value==='string')return value.length<=12000;
 if(Array.isArray(value))return value.length<=200&&value.every(item=>bounded(item,depth+1,budget));
 return object(value)&&Object.keys(value).length<=40&&Object.entries(value).every(([key,item])=>!['__proto__','prototype','constructor'].includes(key)&&bounded(item,depth+1,budget));
}
function validateChat(chat){
 if(chat===null)return null;
 if(!bounded(chat)||!identity(chat.sessionId)||!text(chat.situation,200)||!text(chat.title,2000)||!text(chat.draft,600)||!Array.isArray(chat.targets)||chat.targets.length>8||chat.targets.some(item=>!text(item,400))||!Array.isArray(chat.msgs)||chat.msgs.length>200||new Set(chat.msgs.map(item=>item?.id)).size!==chat.msgs.length||chat.msgs.some(item=>!object(item)||!identity(item.id)||!['me','ai','debrief'].includes(item.role)||item.role!=='debrief'&&!text(item.text,12000))||!Array.isArray(chat.pending)||!Array.isArray(chat.uncertain)||chat.pending.length>20||chat.uncertain.length>200)throw fail('bad_context');
 for(const operation of [...chat.pending,...chat.uncertain])if(!identity(operation.id)||!['chat','debrief','word'].includes(operation.kind)||!identity(operation.messageId)||!chat.msgs.some(item=>item.id===operation.messageId))throw fail('bad_context');
 if(new Set([...chat.pending,...chat.uncertain].map(item=>item.id)).size!==chat.pending.length+chat.uncertain.length||JSON.stringify(chat).length>200000)throw fail('context_too_large');return chat;
}
function nativeHelpers(enState){
function enChatStart(unitKey, title, opener) {
  const s = enState();
  const u = s.today?.unit;
  const own = !unitKey || u?.key === unitKey;
  s.chat = { situation: unitKey || u?.key || "", title: title || (own ? u?.topic?.title : "") || "Разговор", msgs: [], busy: false, typing: false };
  const first = opener || (own ? u?.topic?.opener : "");
  if (first) s.chat.msgs.push({ role: "ai", text: first, opener: true });
}
function enApplyFix(mine, f) {
  if (!f) return;
  if (f.correction) Object.assign(mine, { correction: f.correction, explain: f.explain, saved: f.saved });
  if (f.rule) mine.rule = f.rule;
  if (f.words?.length) mine.words = f.words;
  if (f.used?.length) mine.used = f.used;
  if (f.rule || f.used?.length) enState().rulesStale = true;
}
 return{start:enChatStart,fix:enApplyFix};
}
function history(chat,debrief=false){return chat.msgs.filter(item=>item.role!=='debrief').map(item=>({role:item.role,text:item.text,...(item.correction?{correction:item.correction,...(!debrief?{rule:item.rule?.title}:{})}:{})}));}
function interrupt(chat,reason){
 const next=copy(chat);for(const operation of next.pending){next.uncertain.push({...operation,reason});const message=next.msgs.find(item=>item.id===operation.messageId);if(operation.kind==='word'){if(message.word){message.word.loading=false;message.word.status='uncertain';}}else{message.loading=false;message.status='uncertain';}}
 next.pending=[];next.busy=false;return validateChat(next);
}
function restored(checkpoint,lease){
 if(checkpoint===null||checkpoint===undefined)return null;
 if(!object(checkpoint)||checkpoint.version!==1||checkpoint.owner!==lease.scope||!Object.hasOwn(checkpoint,'chat'))throw fail('bad_context');
 const chat=validateChat(copy(checkpoint.chat));return chat?.pending.length?interrupt(chat,'interrupted'):chat;
}
function fixDTO(raw){
 const fix={};for(const [key,max]of [['correction',2000],['explain',4000]])if(raw[key]!==undefined){if(!text(raw[key],max))throw fail('bad_reply');fix[key]=raw[key];}
 if(raw.saved!==undefined){if(raw.saved!==null&&!savedId(raw.saved))throw fail('bad_reply');fix.saved=raw.saved;}
 if(raw.rule!==undefined&&raw.rule!==null){if(!object(raw.rule)||!savedId(raw.rule.id)||!text(raw.rule.title,2000))throw fail('bad_reply');fix.rule=copy(raw.rule);}
 for(const key of ['words','used'])if(raw[key]!==undefined){if(!Array.isArray(raw[key])||raw[key].length>20||raw[key].some(item=>!object(item)||key==='words'&&(!text(item.en,400)||!text(item.ru,400))||key==='used'&&(!savedId(item.id)||!text(item.title,2000))))throw fail('bad_reply');fix[key]=copy(raw[key]);}
 if(fix.correction){fix.explain??='';fix.saved??=null;}if(!bounded(fix))throw fail('bad_reply');return fix;
}

export function createEnglishChatController({host,ready=()=>{},notify=()=>{},contextStore,effects={},isActive=()=>true,getToday=()=>null,id=()=>globalThis.crypto.randomUUID()}={}){
 if(host?.version!==2||['captureOwner','isCurrent','send','subscribeInvalidation'].some(key=>typeof host[key]!=='function')||[ready,notify,isActive,getToday,id].some(item=>typeof item!=='function')||contextStore!==undefined&&(!object(contextStore)||typeof contextStore.load!=='function'||typeof contextStore.commit!=='function'))throw fail('bad_contract');
 let binding=null,disposed=false,sequence=0,globalError=null;const speech=new Set();
 const active=()=>{try{return isActive()===true;}catch{return false;}};
 const enabled=()=>!disposed&&host.capabilities?.conversation===true&&host.capabilities?.conversationErrors===true&&host.capabilities?.conversationWrites===true;
 const capabilities=()=>Object.freeze({conversation:enabled(),conversationErrors:host.capabilities?.conversationErrors===true,conversationWrites:host.capabilities?.conversationWrites===true,durableContext:!!contextStore,stream:false,asr:false,speech:typeof effects.speak==='function',automaticRetry:false});
 const emit=()=>{if(!disposed)notify();};
 const valid=b=>{try{return!disposed&&binding===b&&host.isCurrent(b.lease)===true;}catch{return false;}};
 const assert=b=>{if(!valid(b))throw fail('owner_changed');};
 const nextId=()=>{const value=id();if(!identity(value))throw fail('bad_id');return value;};
 function stop(){for(const controller of speech)controller.abort();speech.clear();try{effects.stop?.();}catch{}}
 function clear(){binding=null;sequence++;stop();globalError=null;emit();}
 function markInterrupted(b,reason){b.view++;b.jobs.clear();if(b.chat)b.chat=interrupt(b.chat,reason);stop();}
 async function connect(){
  if(disposed)throw fail('disposed');await ready();const lease=host.captureOwner();
  if(!lease?.authorized||! /^[a-f0-9]{64}$/.test(lease.scope)||host.isCurrent(lease)!==true)throw fail('owner_changed');
  if(binding?.lease===lease){await binding.loaded;assert(binding);return binding;}
  stop();const b={lease,view:++sequence,chat:null,tail:Promise.resolve(),jobs:new Map(),error:null,loaded:null,draftDurable:!!contextStore};binding=b;
  b.loaded=(async()=>{
   if(contextStore){const checkpoint=await contextStore.load(lease);assert(b);b.chat=restored(checkpoint,lease);}
   assert(b);globalError=null;emit();
  })();
  try{await b.loaded;assert(b);return b;}catch(cause){if(valid(b)){globalError=cause.message;binding=null;stop();emit();}throw cause;}
 }
 function serial(b,fn){const result=b.tail.then(()=>{assert(b);return fn();});b.tail=result.catch(()=>{});return result;}
 async function persist(b,next){
  assert(b);validateChat(next);const checkpoint={version:1,owner:b.lease.scope,chat:copy(next)};
  if(contextStore){const ack=await contextStore.commit(checkpoint,b.lease);assert(b);if(!object(ack)||ack.durable!==true)throw fail('context_ack_required');}
  assert(b);return{durable:!!contextStore};
 }
 function publish(b,next){assert(b);b.chat=next;b.error=null;globalError=null;b.draftDurable=!!contextStore;emit();}
 function requireProvider(){if(!enabled())throw fail('provider_unavailable');}
 const jobCurrent=(b,job)=>valid(b)&&active()&&b.view===job.view&&b.chat?.sessionId===job.sessionId&&b.jobs.get(job.id)===job;
 function currentChat(b){assert(b);if(!active())throw fail('inactive');if(!b.chat)throw fail('not_started');return b.chat;}
 async function start(args){const b=await connect();return serial(b,async()=>{
  if(!active())throw fail('inactive');if(b.chat?.pending.length)throw fail('busy');const view=b.view;
  for(const [key,max]of [['unitKey',200],['title',2000],['opener',12000]])if(args[key]!==undefined&&!text(args[key],max))throw fail('bad_start');
  const today=args.today??getToday(),model={today,chat:null},helpers=nativeHelpers(()=>model);helpers.start(args.unitKey,args.title,args.opener);
  const next={...model.chat,sessionId:nextId(),targets:copy(args.targets??[]),draft:'',pending:[],uncertain:[]};for(const message of next.msgs)message.id=nextId();
  await persist(b,next);if(!active())throw fail('inactive');if(b.view!==view)throw fail('stale_request');markInterrupted(b,'replaced');publish(b,next);return{sessionId:next.sessionId,durable:!!contextStore};
 });}
 async function draft(value){const b=await connect();return serial(b,async()=>{
  currentChat(b);if(!text(value,600))throw fail('bad_draft');const view=b.view;b.chat.draft=value;b.draftDurable=false;emit();
  try{const next=copy(b.chat);await persist(b,next);if(!active())throw fail('inactive');if(b.view!==view)throw fail('stale_request');publish(b,next);return{durable:!!contextStore};}catch(cause){if(valid(b)){b.error=cause.message;emit();}throw cause;}
 });}
 function speak(b,job,value){
  if(typeof effects.speak!=='function'||!valid(b)||!active()||b.view!==job.view||b.chat?.sessionId!==job.sessionId)return;
  const controller=new AbortController(),isCurrent=()=>valid(b)&&active()&&b.view===job.view&&b.chat?.sessionId===job.sessionId&&!controller.signal.aborted;speech.add(controller);
  Promise.resolve().then(()=>{if(isCurrent())return effects.speak({text:value,signal:controller.signal,isCurrent});}).catch(cause=>{if(isCurrent()){b.error=cause.message;emit();}}).finally(()=>speech.delete(controller));
 }
 async function operation(kind,args){
  requireProvider();const b=await connect();
  const job=await serial(b,async()=>{
   requireProvider();const chat=currentChat(b);if(chat.pending.length)throw fail('busy');const next=copy(chat);let payload,message,messageId;
   if(kind==='chat'){
    const value=args.text===undefined?chat.draft:args.text;if(!text(value,600)||!value.trim())throw fail('bad_text');
    b.chat.draft=value;b.draftDurable=false;emit();messageId=nextId();payload={situation:chat.situation,history:history(chat),text:value.trim(),targets:copy(chat.targets),tone:getToday()?.tone};
    message={id:messageId,role:'me',text:value.trim(),status:'pending'};next.msgs.push(message);next.draft='';next.sent=true;next.busy=true;
   }else if(kind==='debrief'){
    if(chat.msgs.filter(item=>item.role==='me').length<2)throw fail('too_few_turns');messageId=nextId();payload={history:history(chat,true)};
    message={id:messageId,role:'debrief',loading:true,status:'pending',words:chat.msgs.reduce((n,item)=>n+(item.words?.length||0),0),rules:chat.msgs.filter(item=>item.rule?.isNew||item.rule?.again).length};next.msgs.push(message);
   }else{
    message=next.msgs.find(item=>item.id===args.messageId);if(!message||message.role==='debrief')throw fail('bad_message');
    const word=typeof args.word==='string'?args.word.replace(/[^A-Za-z'’-]/g,'').slice(0,40):'';
    const tokens=message.text.split(/(\s+)/),clean=value=>value.replace(/[^A-Za-z'’-]/g,'').toLowerCase();
    if(!word||args.word.length>80||args.at!==undefined&&(!Number.isSafeInteger(args.at)||args.at<0||clean(tokens[args.at]??'')!==word.toLowerCase())||args.at===undefined&&!tokens.some(token=>clean(token)===word.toLowerCase()))throw fail('bad_word');
    messageId=message.id;payload={word,sentence:message.text};message.word={loading:true,status:'pending',word,...(args.at===undefined?{}:{at:args.at})};
   }
   const value={id:nextId(),kind,messageId};next.pending.push(value);const job={...value,sessionId:chat.sessionId,view:b.view,payload,dispatched:false};
   try{await persist(b,next);if(!active())throw fail('inactive');if(b.view!==job.view)throw fail('stale_request');b.jobs.set(job.id,job);publish(b,next);stop();return job;}catch(cause){if(valid(b)){b.error=cause.message;emit();}throw cause;}
  });
  try{
   if(!jobCurrent(b,job))throw fail('stale_request');requireProvider();job.dispatched=true;
   const response=await host.send(kind,{...copy(job.payload),...(['chat','word'].includes(kind)?{attempt:job.id}:{})},b.lease);
   if(!jobCurrent(b,job))throw fail('stale_request');if(!object(response)||response.error)throw fail('provider_failed');
   if(['chat','word'].includes(kind)&&(response.receipt?.version!==1||response.receipt.operation!==kind||response.receipt.attempt!==job.id))throw fail('receipt_required');
   const result=await serial(b,async()=>{
    if(!jobCurrent(b,job))throw fail('stale_request');const next=copy(b.chat),message=next.msgs.find(item=>item.id===job.messageId);let speechText=null;
    if(kind==='chat'){
     if(!text(response.reply,12000)||!response.reply.trim()||response.reply.trim()===FALLBACK||response.replyRu!==undefined&&!text(response.replyRu,12000))throw fail('provider_failed');
     const model={rulesStale:false};nativeHelpers(()=>model).fix(message,fixDTO(response));next.rulesStale=next.rulesStale||model.rulesStale;message.status='complete';
     next.msgs.push({id:nextId(),role:'ai',text:response.reply,ru:response.replyRu??''});speechText=response.reply;
    }else if(kind==='debrief'){
     if(!Array.isArray(response.good)||!Array.isArray(response.work)||response.good.length>3||response.work.length>3||[...response.good,...response.work].some(item=>!text(item,2000))||!text(response.next,2000)||![...response.good,...response.work,response.next].some(item=>item.trim()))throw fail('bad_reply');
     Object.assign(message,{loading:false,status:'complete',good:copy(response.good),work:copy(response.work),next:response.next});
    }else{
     if(!text(response.lemma,400)||!response.lemma.trim()||!text(response.ru,400)||!response.ru.trim()||!bounded(response)||!savedId(response.saved)&&!savedId(response.deck))throw fail('word_unconfirmed');
     message.word={...copy(response),...(message.word.at===undefined?{}:{at:message.word.at}),loading:false,status:'server-reported'};next.wordsStale=true;
    }
    next.pending=next.pending.filter(item=>item.id!==job.id);next.busy=false;await persist(b,next);if(!jobCurrent(b,job))throw fail('stale_request');b.jobs.delete(job.id);publish(b,next);if(speechText)speak(b,job,speechText);return{durable:!!contextStore,requestId:job.id};
   });return result;
  }catch(cause){
   if(valid(b)&&!active()&&b.jobs.get(job.id)===job)markInterrupted(b,'inactive');
   if(jobCurrent(b,job))await serial(b,async()=>{
    if(!jobCurrent(b,job))return;const next=copy(b.chat),operation=next.pending.find(item=>item.id===job.id);next.pending=next.pending.filter(item=>item.id!==job.id);next.uncertain.push({...operation,reason:job.dispatched?'response_unknown':'not_dispatched'});next.busy=false;
    const message=next.msgs.find(item=>item.id===job.messageId);if(kind==='word'){message.word.loading=false;message.word.status='uncertain';}else{message.loading=false;message.status='uncertain';}
    b.jobs.delete(job.id);b.chat=next;b.error=cause.message;emit();try{await persist(b,next);}catch(error){if(valid(b)){b.error=error.message;emit();}}
   });throw cause;
  }
 }
 async function close(){const b=await connect();return serial(b,async()=>{
  const view=b.view;if(b.chat){const next=interrupt(b.chat,'closed');try{await persist(b,next);if(b.view!==view)throw fail('stale_request');}catch(cause){if(valid(b)){b.error=cause.message;emit();}throw cause;}}
  markInterrupted(b,'closed');b.chat=null;b.error=null;emit();return{durable:!!contextStore};
 });}
 async function command(name,args={}){
  if(disposed)throw fail('disposed');if(!object(args))throw fail('bad_arguments');
  if(name==='chat.restore'){const b=await connect();return serial(b,async()=>{if(!b.chat&&contextStore){const view=b.view,value=await contextStore.load(b.lease);assert(b);if(b.view!==view)throw fail('stale_request');b.chat=restored(value,b.lease);emit();}return getSnapshot();});}
  if(name==='chat.start')return start(args);if(name==='chat.draft')return draft(args.value);if(name==='chat.close')return close();
  if(name==='chat.send')return operation('chat',args);if(name==='chat.debrief')return operation('debrief',args);if(name==='chat.word')return operation('word',args);throw fail('unsupported_command');
 }
 function getSnapshot(){
  const b=binding&&valid(binding)?binding:null;
  return freeze({owner:b?.lease.scope??null,chat:copy(b?.chat??null),loading:!!b?.chat?.pending.length,error:b?.error??globalError,draftDurable:b?.draftDurable??false,capabilities:capabilities()});
 }
 const release=host.subscribeInvalidation(clear);
 const initial=connect();initial.catch(()=>{});
 return Object.freeze({ready:initial,enabled,capabilities,getSnapshot,command,cancel(){if(binding){markInterrupted(binding,'cancelled');emit();}},dispose(){if(disposed)return;disposed=true;binding=null;stop();release?.();}});
}
