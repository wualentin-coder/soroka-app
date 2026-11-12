/* Native course orchestration only. No renderer, provider fallback, or second scheduler. */
import {createNativeLessonController,createNativeAnswerChecker} from './english-domain-lesson.mjs';
const bad=reason=>Error('english_domain_'+reason);
const exerciseModes=new Set(['cards','build','gap','dictation','translate']);
export function createEnglishCourseController(h){
 let view=null,checking=null,serial=0,viewSerial=0;
 const enabled=()=>h.host.capabilities?.lessons===true&&h.host.capabilities?.grades===true&&h.host.capabilities?.completionAttempts===true&&h.host.capabilities?.swipes!==false;
 const requireCourse=()=>{if(!enabled())throw bad('lesson_unsupported');h.ready();};
 const captureView=()=>{const current=h.captureView(),token=serial;return()=>token===serial&&current();};
 const native=createNativeLessonController({getState:h.state,record:h.record,queue:h.queue,captureView,deckMake:h.deck.make,deckFill:h.deck.fill,render:h.notify,speak:h.speak,stop:h.stop,scheduleSpeak:h.speak});
 const checker=createNativeAnswerChecker({getState:h.state,call:h.call,captureView,answer:(...args)=>h.mutate(()=>native.answer(...args)),render:h.notify,notify:h.issue});
 const current=()=>{const ex=h.state().ex;return ex&&ex.mode!=='structured'?ex:null;};
 const item=()=>{const ex=current();return ex?.items?.[ex.index]||null;};
 function requireTask(){requireCourse();const ex=current();if(!ex||!item())throw bad('no_course_step');return ex;}
 function install(response,mode,extra={}){
  const items=mode==='lesson'||mode==='rule'?response.steps:response.items;
  if(!Array.isArray(items)||!items.length||items.length>400)throw bad('bad_lesson_response');
  h.mutate(()=>{h.stop();view=null;const s=h.state();s.deck=null;s.ex={mode,unit:response.unit,items:structuredClone(items),index:0,ok:0,done:0,picked:[],answer:null,sessionId:h.id(),...extra};native.enter();});
 }
 function project(){
  const ex=current(),row=item();if(!ex)return null;const mode=row?.mode||ex.mode;
  return{step:row?{...row,nativeMode:mode}:null,rawStep:row,taskKind:ex.mode==='lesson'?'lesson':ex.mode==='rule'?'rule':'exercise',nativeMode:mode,checking:!!checking||!!ex.checking,assessed:native.assessed(ex),theoryView:view};
 }
 function readiness(active){
  const ex=current(),row=item(),mode=row?.mode||ex?.mode;
  if(!active||!enabled()||!row||ex.deck||checking||ex.checking)return{canSubmit:false,canNext:false,canSkip:!!row&&enabled()&&mode!=='talk',canSelfCheck:false,needs:[],heard:[]};
  const theory=mode==='theory',rated=['cards','listen'].includes(mode),talk=mode==='talk';
  return{canSubmit:['recall','translate','dictation'].includes(mode)&&!ex.answer&&!!ex.draft?.trim(),canNext:theory||!rated&&!talk&&!!ex.answer,canSkip:['lesson','rule'].includes(ex.mode)&&!talk,canSelfCheck:rated&&!!ex.answer?.shown,needs:[],heard:[],canChoose:mode==='gap'&&!ex.answer,canArrange:mode==='build'&&!ex.answer};
 }
 async function command(name,args={}){
  if(name==='theory.open'){requireCourse();const token=++viewSerial,response=await h.load('theory',{unit:args.unit});if(token!==viewSerial)throw bad('view_changed');view={kind:'theory',theory:response};h.notify();return response;}
  if(name==='theory.close'){viewSerial++;view=null;h.notify();return true;}
  if(name==='words.query')return h.load('wordlist',{filter:args.filter??'learning',q:args.q??''});
  if(name==='words.goal'){h.ready();if(h.host.capabilities?.preferences!==true)throw bad('preferences_unsupported');if(!Number.isInteger(args.n)||args.n<0||args.n>60)throw bad('bad_word_goal');return h.mutate(()=>{h.queue('newwords',{n:args.n}).catch(()=>{});const s=h.state();if(s.words)s.words={...s.words,newWords:args.n};});}
  if(name==='course.select'){requireCourse();if(h.host.capabilities?.preferences!==true)throw bad('preferences_unsupported');const response=await h.call('unit',{unit:args.unit});h.accept('course',response);return response;}
  if(name==='lesson.start'||name==='exercise.start'||name==='rule.start'){
   requireCourse();const token=++serial;viewSerial++;checking=null;
   if(name==='rule.start'&&h.host.capabilities?.rules!==true)throw bad('rules_unsupported');
   const mode=name==='lesson.start'?'lesson':name==='rule.start'?'rule':args.mode;if(name==='exercise.start'&&!exerciseModes.has(mode))throw bad('bad_exercise_mode');
   const op=mode==='lesson'?'lesson':mode==='rule'?'rule':'practice',payload=mode==='rule'?{id:args.id}:mode==='lesson'?(args.unit?{unit:args.unit}:{}):{mode,unit:args.unit||h.state().today?.unit?.key||''};
   return h.loadTask(op,payload,response=>{if(token!==serial)throw bad('owner_changed');install(response,mode,mode==='rule'?{rule:response.rule}:{});});
  }
  if(name==='lesson.close'||name==='exercise.close'||name==='rule.close'){serial++;viewSerial++;checking=null;return h.mutate(()=>{h.stop();view=null;h.state().ex=null;});}
  if(name==='lesson.draft'){requireTask();if(typeof args.value!=='string'||args.value.length>4000)throw bad('bad_draft');return h.mutate(()=>{h.state().ex.draft=args.value;});}
  if(name==='lesson.submit'){
   const ex=requireTask(),mode=item().mode||ex.mode;if(checking||ex.checking||ex.answer)throw bad('already_answered');
   const text=String(args.text??ex.draft??'').trim();if(!text||text.length>4000)throw bad('bad_answer');
   if(mode==='dictation')return h.mutate(()=>native.answer(native.normalize(text)===native.normalize(item().en),{typed:text}));
   if(!['recall','translate'].includes(mode))throw bad('wrong_answer_mode');if(h.host.capabilities?.serverChecking!==true)throw bad('checking_unsupported');
   h.mutate(()=>{h.state().ex.draft=text;});const token={sid:ex.sessionId,index:ex.index};checking=token;
   try{return await checker(text,args.spoken===true);}finally{if(checking===token){checking=null;const active=current();if(active?.sessionId===token.sid&&active.index===token.index)active.checking=false;h.notify();}}
  }
  if(name==='lesson.next'){
   const ex=requireTask(),mode=item().mode||ex.mode;if(ex.deck||mode==='talk'||['cards','listen'].includes(mode)||mode!=='theory'&&!ex.answer||checking)throw bad('answer_required');return h.mutate(()=>native.next());
  }
  if(name==='lesson.reveal'){
   const ex=requireTask(),mode=item().mode||ex.mode;if(ex.answer||mode==='theory'||mode==='words'||mode==='talk'||checking)throw bad('wrong_answer_mode');
   return h.mutate(()=>{const ex=h.state().ex;if(['cards','listen'].includes(mode)){ex.answer={ok:false,shown:true};if(mode==='cards')h.speak(item().en);}else native.answer(false,{verdict:'shown',rating:1});});
  }
  if(name==='lesson.rate'){
   const ex=requireTask(),mode=item().mode||ex.mode;if(!['cards','listen'].includes(mode)||![1,2,3].includes(args.rating)||!ex.answer?.shown)throw bad('bad_self_rating');
   return h.mutate(()=>{const ex=h.state().ex,row=item();if(row.introduced)h.record('grade',{id:row.id,rating:args.rating,correct:null,practice:true});ex.done++;ex.practiceDone=(ex.practiceDone||0)+1;native.next();});
  }
  if(name==='lesson.gap'){
   const ex=requireTask(),row=item();if((row.mode||ex.mode)!=='gap'||ex.answer||typeof args.pick!=='string'||!row.options.includes(args.pick))throw bad('bad_gap');return h.mutate(()=>native.answer(args.pick.toLowerCase()===row.answer,{pick:args.pick}));
  }
  if(name==='lesson.tile'||name==='lesson.untile'||name==='lesson.clearTiles'){
   const ex=requireTask(),row=item();if((row.mode||ex.mode)!=='build'||ex.answer)throw bad('wrong_answer_mode');
   return h.mutate(()=>{const ex=h.state().ex;if(name==='lesson.clearTiles')ex.picked=[];else if(name==='lesson.untile'){if(!Number.isInteger(args.index)||args.index<0||args.index>=ex.picked.length)throw bad('bad_tile');ex.picked.splice(args.index,1);}else{if(!Number.isInteger(args.index)||args.index<0||args.index>=row.tiles.length||ex.picked.includes(args.index))throw bad('bad_tile');ex.picked.push(args.index);if(ex.picked.length===row.tiles.length){const text=ex.picked.map(i=>row.tiles[i]).join(' ');native.answer(native.normalize(text)===native.normalize(row.en),{typed:text});}}});
  }
  if(name==='lesson.skipSection'){
   const ex=requireTask(),row=item();if(!['lesson','rule'].includes(ex.mode)||(row.mode||ex.mode)==='talk'||checking)throw bad('cannot_skip');return h.mutate(()=>{h.stop();const ex=h.state().ex,section=ex.items[ex.index].section;ex.deck=null;while(ex.index<ex.items.length&&ex.items[ex.index].section===section)ex.index++;ex.answer=null;ex.picked=[];if(ex.mode==='rule'){if(ex.index>=ex.items.length)native.ruleFinish(ex);}else native.enter();});
  }
  if(name==='deck.quit'&&h.state().ex?.deck){requireCourse();return h.mutate(()=>{h.stop();h.state().ex.deck=null;h.state().ex.index++;native.enter();});}
  throw bad('unsupported_command');
 }
 return Object.freeze({enabled,project,readiness,command,enter:()=>native.enter(),next:()=>native.next(),cancel(){serial++;viewSerial++;checking=null;view=null;},get view(){return view;}});
}
