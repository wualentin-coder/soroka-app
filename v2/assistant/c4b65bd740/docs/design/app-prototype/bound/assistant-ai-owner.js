import {speechSummary} from '../../../../prototypes/soroka-planner/assistant-answer.mjs';
import {createAssistantSession,createAssistantDeviceExecutor} from '../../../../prototypes/soroka-planner/assistant-session.mjs';

export function createAssistantAI({element,getHost,getSection,navigate,openReference,openDocument,close,onBusy}){
 let generation=0,running=false,activeOwner=null,activeSection=null;
 const same=request=>element.isOpen&&!element.closing&&request.ownerEpoch===element.model.ownerEpoch&&request.context?.key===getSection();
 const execute=createAssistantDeviceExecutor({
  navigate:async(section,meta)=>{const owner=element.model.ownerEpoch;if(!await close()||owner!==element.model.ownerEpoch||meta.ownerCurrent?.()===false)return false;return navigate(section,{source:'assistant',isCurrent:()=>owner===element.model.ownerEpoch&&meta.ownerCurrent?.()!==false});},
  openDocument:async(id,meta)=>{const owner=element.model.ownerEpoch;if(!await close()||owner!==element.model.ownerEpoch||meta.ownerCurrent?.()===false)return false;return openDocument(id,{source:'assistant',isCurrent:()=>owner===element.model.ownerEpoch&&meta.ownerCurrent?.()!==false});},
  openRecord:async(ref,meta)=>{const owner=element.model.ownerEpoch;if(!await close()||owner!==element.model.ownerEpoch||meta.ownerCurrent?.()===false)return false;return openReference(ref,{source:'assistant',isCurrent:()=>owner===element.model.ownerEpoch&&meta.ownerCurrent?.()!==false});}
 });
 const session=createAssistantSession(getHost,{executeAction:execute,canAct:()=>element.isOpen&&!element.closing&&!document.hidden&&(activeOwner===null||activeOwner===element.model.ownerEpoch&&activeSection===getSection())});
 const message=error=>/undo_unavailable/.test(String(error))?'Нет доступного изменения для отмены.':/choice_changed|delete_unconfirmed/.test(String(error))?'Запись изменилась или подтверждение устарело. Найдём её заново.':/timeout/.test(String(error))?'Ответ задержался. Попробуй ещё раз.':/unavailable|not_found|operation/.test(String(error))?'ИИ-ассистент сейчас недоступен. Можно добавить запись через «+».':'Не получилось выполнить действие. Попробуй ещё раз.';
 const response=result=>({text:result.text,speech:speechSummary(result.text,result),records:[...(result.undo?[{id:'undo',kind:'assistant-undo',title:'Отменить последнее изменение'}]:[]),...(result.receipts||[]).filter(r=>r.commandId).map(r=>({id:String(r.commandId),kind:'assistant-command',title:'Проверить выполнение команды'})),...(result.operationConfirmations||[]).flatMap(c=>[{id:c.id,kind:'assistant-operation',title:c.title},{id:c.id,kind:'assistant-decline',title:'Не выполнять'}]),...(result.followUp?[{id:'next',kind:'assistant-followup',title:result.followUp.kind==='plan'?'Посмотреть план на сегодня':'Открыть «'+result.followUp.title+'»'}]:[]),...(result.confirmations||[]).flatMap(c=>[{id:c.id,kind:'assistant-confirm',title:'В корзину · '+c.title},{id:c.id,kind:'assistant-decline',title:'Оставить'}]),...(result.sources||[]).map(source=>({id:source.id,kind:'assistant-source',title:'Источник · '+source.title})),...(result.choices||[]).map(choice=>({id:choice.id,kind:'assistant-choice',title:choice.label})),...(result.activations||[]).map(action=>({id:action.id,kind:'assistant-activation',title:action.kind==='dial'?'Открыть набор · '+action.phone:'Открыть'}))]});
 async function run(request,work,consumeDraft){
  if(running||!same(request))return false;const token=++generation;activeOwner=element.model.ownerEpoch;activeSection=getSection();running=true;onBusy(true);
  element.model={...element.model,busy:true,phase:'thinking',error:'',response:null,transcript:''};
  element.emit('flow-assistant-stage',{phase:'thinking'});
  try{
   const result=await work();if(token!==generation||!same(request))return false;
   element.settle(request.requestId,{ok:!result.errors?.length,consumeDraft:!result.errors?.length&&consumeDraft&&element.draft.trim()===String(request.text||'').trim(),model:{...element.model,busy:false,phase:'response',transcript:request.text||element.model.transcript||'',response:response(result),error:''}});
   element.emit('flow-assistant-stage',{phase:'response',ok:!result.errors?.length});return true;
  }catch(error){if(token===generation&&same(request)){element.settle(request.requestId,{ok:false,model:{...element.model,busy:false,phase:'idle',response:null,error:message(error)}});element.emit('flow-assistant-stage',{phase:'idle'});}return false;
  }finally{if(token===generation){running=false;onBusy(false);if(same(request))element.model={...element.model,busy:false};}}
 }
 return{
  submit:request=>run(request,()=>session.turn(request.text,{section:getSection()}),!request.voice),
  record:request=>request.kind==='assistant-undo'?run(request,()=>session.undo(),false):request.kind==='assistant-operation'?run(request,()=>session.confirmOperation(request.recordId),false):request.kind==='assistant-command'?run(request,()=>session.command(request.recordId),false):request.kind==='assistant-followup'?run(request,()=>session.next(),false):request.kind==='assistant-confirm'?run(request,()=>session.confirm(request.recordId),false):request.kind==='assistant-decline'?run(request,async()=>session.decline(),false):request.kind==='assistant-source'?(session.source(request.recordId),true):request.kind==='assistant-choice'?run(request,()=>session.choose(request.recordId),false):request.kind==='assistant-activation'?run(request,async()=>{await session.activate(request.recordId);return{text:'Открываю набор номера.',choices:[],activations:[]};},false):false,
  cancel(){generation++;activeOwner=activeSection=null;running=false;onBusy(false);session.cancel();},
  dispose(){generation++;running=false;onBusy(false);session.dispose();}
 };
}
