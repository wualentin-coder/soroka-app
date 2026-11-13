import {createAssistantSession,createAssistantDeviceExecutor} from '../../../../prototypes/soroka-planner/assistant-session.mjs';

export function createAssistantAI({element,getHost,getSection,navigate,openReference,close,onBusy}){
 let generation=0,running=false,activeOwner=null,activeSection=null;
 const same=request=>element.isOpen&&!element.closing&&request.ownerEpoch===element.model.ownerEpoch&&request.context?.key===getSection();
 const execute=createAssistantDeviceExecutor({
  navigate:async(section,meta)=>{const owner=element.model.ownerEpoch;if(!await close()||owner!==element.model.ownerEpoch||meta.ownerCurrent?.()===false)return false;return navigate(section,{source:'assistant',isCurrent:()=>owner===element.model.ownerEpoch&&meta.ownerCurrent?.()!==false});},
  openRecord:async(ref,meta)=>{const owner=element.model.ownerEpoch;if(!await close()||owner!==element.model.ownerEpoch||meta.ownerCurrent?.()===false)return false;return openReference(ref,{source:'assistant',isCurrent:()=>owner===element.model.ownerEpoch&&meta.ownerCurrent?.()!==false});}
 });
 const session=createAssistantSession(getHost,{executeAction:execute,canAct:()=>element.isOpen&&!element.closing&&!document.hidden&&(activeOwner===null||activeOwner===element.model.ownerEpoch&&activeSection===getSection())});
 const message=error=>/choice_changed/.test(String(error))?'Номер в записи изменился. Давай найдём его заново.':/timeout/.test(String(error))?'Ответ задержался. Попробуй ещё раз.':/unavailable|not_found|operation/.test(String(error))?'ИИ-ассистент сейчас недоступен. Можно добавить запись через «+».':'Не получилось выполнить действие. Попробуй ещё раз.';
 const response=result=>({text:result.text,records:[...(result.choices||[]).map(choice=>({id:choice.id,kind:'assistant-choice',title:choice.label})),...(result.activations||[]).map(action=>({id:action.id,kind:'assistant-activation',title:action.kind==='dial'?'Открыть набор · '+action.phone:'Открыть'}))]});
 async function run(request,work,consumeDraft){
  if(running||!same(request))return false;const token=++generation;activeOwner=element.model.ownerEpoch;activeSection=getSection();running=true;onBusy(true);
  element.model={...element.model,busy:true,phase:'thinking',error:'',response:null,transcript:''};
  element.emit('flow-assistant-stage',{phase:'thinking'});
  try{
   const result=await work();if(token!==generation||!same(request))return false;
   element.settle(request.requestId,{ok:true,consumeDraft:consumeDraft&&element.draft.trim()===String(request.text||'').trim(),model:{...element.model,busy:false,phase:'response',transcript:request.text||element.model.transcript||'',response:response(result),error:''}});
   element.emit('flow-assistant-stage',{phase:'response'});return true;
  }catch(error){if(token===generation&&same(request)){element.settle(request.requestId,{ok:false,model:{...element.model,busy:false,phase:'idle',response:null,error:message(error)}});element.emit('flow-assistant-stage',{phase:'idle'});}return false;
  }finally{if(token===generation){running=false;onBusy(false);if(same(request))element.model={...element.model,busy:false};}}
 }
 return{
  submit:request=>run(request,()=>session.turn(request.text,{section:getSection()}),!request.voice),
  record:request=>request.kind==='assistant-choice'?run(request,()=>session.choose(request.recordId),false):request.kind==='assistant-activation'?run(request,async()=>{await session.activate(request.recordId);return{text:'Открываю набор номера.',choices:[],activations:[]};},false):false,
  cancel(){generation++;activeOwner=activeSection=null;running=false;onBusy(false);session.cancel();},
  dispose(){generation++;running=false;onBusy(false);session.dispose();}
 };
}
