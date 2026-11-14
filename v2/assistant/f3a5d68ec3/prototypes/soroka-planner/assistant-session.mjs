const PHONE=/^\+?\d{7,15}$/;
const REF=/^(task|event|note|link|recipe|movie|product|debt|payment|money|list|place|metric|card):[1-9]\d{0,14}$/;
const failure=code=>Object.assign(new Error(code),{code});
const CONTACT=/^contact:[a-f\d]{24}$/;
const sourceValid=s=>s&&typeof s.title==='string'&&(REF.test(s.ref)||CONTACT.test(s.ref)&&safeSource(s.url));
function safeSource(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!/(?:^|\.)(?:localhost|local|internal)$/.test(u.hostname)&&u.hostname.includes('.');}catch{return false;}}
function actionValid(action,requestId){
 if(!action||typeof action.id!=='string'||!action.id.startsWith(requestId+':'))return false;
 if(action.kind==='dial')return PHONE.test(action.phone)&&!/^\+?0+$/.test(action.phone)&&sourceValid(action.source);
 if(action.kind==='open_document')return Number.isSafeInteger(action.documentId)&&action.documentId>0&&typeof action.title==='string';
 if(action.kind==='open_record')return REF.test(action.source?.ref)&&typeof action.source?.title==='string';
 return action.kind==='open_section'&&typeof action.section==='string'&&/^[a-z_/-]{1,80}$/.test(action.section);
}
/** Captured host ownership and sequence guards apply before every device action. */
export function createAssistantSession(getHost,{executeAction,canAct=()=>true,storage=globalThis.localStorage}={}){
 let prepared=null,lastUndo=null,operationChoices=new Map();let sequence=0,choices=new Map(),activations=new Map(),history=[],refs=[],scope=null,pending=null,sources=new Map(),confirmations=new Map(),followUp=null,lastSuggestionAt=0,proactive=true;
 function bind(host){
  const next=typeof host.owner?.scope==='string'?host.owner.scope:null;if(next===scope)return;
  scope=next;prepared=null;lastUndo=null;operationChoices.clear();history=[];refs=[];pending=null;followUp=null;lastSuggestionAt=0;proactive=true;
  if(!scope)return;
  try{const saved=JSON.parse(storage?.getItem('flow.assistant.v1.'+scope)||'null');proactive=saved?.proactive!==false;prepared=saved?.prepared&&saved.prepared.at>Date.now()-900000&&Array.isArray(saved.prepared.proofs)?saved.prepared:null;lastUndo=saved?.lastUndo&&typeof saved.lastUndo.proof==='string'&&saved.lastUndo.at>Date.now()-900000?saved.lastUndo:null;if(saved&&saved.at>Date.now()-86400000){history=Array.isArray(saved.history)?saved.history.slice(-8).filter(v=>['user','assistant'].includes(v?.role)&&typeof v.text==='string').map(v=>({role:v.role,text:v.text.slice(0,1200)})):[];followUp=validFollowUp(saved.followUp);lastSuggestionAt=typeof saved.lastSuggestionAt==='number'?saved.lastSuggestionAt:0;proactive=saved.proactive!==false;refs=Array.isArray(saved.refs)?saved.refs.filter(v=>REF.test(v)).slice(-6):[];pending=saved.pending&&typeof saved.pending.text==='string'&&/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(saved.pending.id)?saved.pending:null;}}catch{}
 }
 function persist(){if(scope)try{storage?.setItem('flow.assistant.v1.'+scope,JSON.stringify({at:Date.now(),history,refs,pending,followUp,lastSuggestionAt,proactive,prepared,lastUndo}));}catch{}}
function validFollowUp(f){if(!f||typeof f!=='object'||typeof f.at!=='number'||!Number.isFinite(f.at)||Date.now()-f.at>600000)return null;if(f.kind==='plan')return{kind:'plan',title:'План на сегодня',at:f.at};return f.kind==='record'&&REF.test(f.ref)&&typeof f.title==='string'?{kind:'record',ref:f.ref,title:f.title.slice(0,160),at:f.at}:null;}
const delivered=new Set();
 const available=host=>host&&typeof host.request==='function'&&typeof host.isCurrent==='function'&&host.isCurrent()===true;
 const check=(token,host)=>{if(token!==sequence||!available(host)||!canAct())throw failure('assistant_owner_changed');};
 async function execute(action,token,host,activation=false){
  check(token,host);if(delivered.has(action.id))return{status:'already_requested'};
  if(typeof executeAction!=='function')throw failure('assistant_action_unavailable');
  // A pending user button is not a device action; consuming it happens on activation.
  delivered.add(action.id);
  try{const result=await executeAction(action,{activation,isCurrent:()=>token===sequence&&available(host)&&canAct(),ownerCurrent:()=>available(host)});
   if(result?.status==='activation_required'){delivered.delete(action.id);activations.set(action.id,{action,token,host});}
   return result||{status:'requested'};
  }catch(error){throw error;}
 }
 async function request(op,args){
  args={...args,protocol:2};
  const token=++sequence;choices.clear();activations.clear();sources.clear();confirmations.clear();operationChoices.clear();const host=await getHost();check(token,host);bind(host);
  if(op==='turn'||op==='confirm_delete'||op==='apply_operations')args={...args,history:structuredClone(history),context:{...args.context,refs:[...refs],...(followUp?{followUp:structuredClone(followUp)}:{}),lastSuggestionAt,proactive}};
  const identity=JSON.stringify({text:args.text,section:args.context?.section,ref:args.context?.ref,attachments:(args.attachments||[]).map(f=>f.id)});
  const requestId=op==='turn'&&prepared?.identity===identity?prepared.originRequestId:op==='turn'&&pending?.identity===identity?pending.id:crypto.randomUUID();
  if(op==='turn'){pending={id:requestId,identity,text:String(args.text)};persist();}
  const {attachments:privateMedia,...operationArgs}=args;
  function finishPrepared(initial,applied){
   const failed=applied.errors?.length,result={...initial,...applied,operations:undefined,confirmations:failed?[]:initial.confirmations||[],sources:initial.sources||[],choices:failed?[]:initial.choices||[]};
   if(!failed){const question=initial.text?.match(/[^.!?\n]*\?/g)?.at(-1)?.trim();if(question)result.text+='\n\n'+question;const requires=(initial.operations||[]).filter(p=>p.confirm);if(requires.length){for(const plan of requires)operationChoices.set(plan.id,{plan,token,host});result.operationConfirmations=requires;result.actions=[];result.text+=(result.text?'\n\n':'')+requires.map(p=>'**'+p.title+'** — выполнить?'+(/Выключить|Усыпить/.test(p.title)?' Несохранённая работа может потеряться.':'')).join('\n');}}
   return result;
  }
  let response;
  if(op==='turn'&&prepared?.identity===identity){const initial=prepared.initial;const retry=prepared.attempted;prepared.attempted=true;persist();response=await host.request('apply_operations',{...operationArgs,requestId,proofs:prepared.proofs,originRequestId:prepared.originRequestId||requestId,confirmed:prepared.confirmed===true,actions:prepared.actions||[],retry});check(token,host);if(initial)response=finishPrepared(initial,response);prepared=null;persist();}
  else{
   response=await host.request(op,{...args,requestId});check(token,host);
   if(response?.requestId!==requestId||typeof response.text!=='string'||!Array.isArray(response.actions)||response.actions.length>1||!response.actions.every(action=>actionValid(action,requestId)))throw failure('assistant_invalid_response');
   if(response?.operations?.length){
    if(!Array.isArray(response.operations)||response.operations.length>8||response.operations.some(p=>typeof p.id!=='string'||typeof p.title!=='string'||typeof p.proof!=='string'||p.proof.length>180000))throw failure('assistant_invalid_response');
    const plans=response.operations,automatic=plans.filter(p=>!p.confirm),requires=plans.filter(p=>p.confirm),initial=response;
    if(automatic.length){prepared={at:Date.now(),identity,initial,originRequestId:requestId,proofs:automatic.map(p=>p.proof),actions:initial.actions||[],attempted:true};persist();response=await host.request('apply_operations',{...operationArgs,requestId,proofs:prepared.proofs,originRequestId:requestId,actions:prepared.actions,retry:false});check(token,host);prepared=null;persist();response=finishPrepared(initial,response);}
    else response={...initial,operations:undefined,actions:[],text:''};
    if(!automatic.length&&requires.length&&!response.errors?.length){for(const plan of requires)operationChoices.set(plan.id,{plan,token,host});response.operationConfirmations=requires;response.actions=[];response.text+=(response.text?'\n\n':'')+requires.map(p=>'**'+p.title+'** — выполнить?'+(/Выключить|Усыпить/.test(p.title)?' Несохранённая работа может потеряться.':'')).join('\n');}
   }
  }
  if(response?.requestId!==requestId||typeof response.text!=='string'||!Array.isArray(response.actions)||response.actions.length>1||!response.actions.every(action=>actionValid(action,requestId)))throw failure('assistant_invalid_response');
  const result={...response,activations:[]};
  for(const choice of response.choices||[]){if(typeof choice.id!=='string'||!choice.id.startsWith(requestId+':phone:')||!PHONE.test(choice.phone)||!sourceValid(choice.source)||CONTACT.test(choice.source?.ref)&&typeof choice.proof!=='string')throw failure('assistant_invalid_choice');choices.set(choice.id,{choice:structuredClone(choice),token,host});}
  for(const source of response.sources||[]){if(typeof source.id!=='string'||!source.id.startsWith(requestId+':source:')||!safeSource(source.url))throw failure('assistant_invalid_source');sources.set(source.id,{source:structuredClone(source),token,host});}
  if(response.confirmations!==undefined&&(!Array.isArray(response.confirmations)||response.confirmations.length>1))throw failure('assistant_invalid_response');
  for(const c of response.confirmations||[]){if(c.id!==requestId+':delete'||!REF.test(c.ref)||typeof c.title!=='string'||typeof c.proof!=='string'||c.proof.length>2000)throw failure('assistant_invalid_response');confirmations.set(c.id,{value:structuredClone(c),token,host});}
  if(op==='turn'||op==='confirm_delete'||op==='apply_operations')history=[...history,{role:'user',text:op==='turn'?String(args.text).slice(0,1200):op==='apply_operations'?'Применить подтверждённое действие.':'Подтверждаю удаление выбранной записи.'},{role:'assistant',text:response.text.slice(0,1200)}].slice(-8);
  if(response.undo?.proof)lastUndo={...response.undo,at:Date.now()};else if(response.receipts?.length||response.deleted?.length||response.errors?.length)lastUndo=null;if(lastUndo)result.undo=lastUndo;
  followUp=validFollowUp(response.followUp);if(followUp)lastSuggestionAt=followUp.at;if(typeof response.conversation?.proactive==='boolean')proactive=response.conversation.proactive;
  refs=[...new Set([...refs,...(response.refs||[]).filter(v=>REF.test(v))])].slice(-6);if(op==='turn')pending=null;persist();
  for(const action of response.actions){const outcome=await execute(action,token,host);if(outcome.status==='activation_required'){result.activations.push(action);if(action.kind==='dial')result.text=`Номер из «${action.source.title}»: ${action.phone}. Открыть набор?`;}}
  return result;
 }
 async function undoNow(){const host=await getHost();if(!available(host)||!canAct())throw failure('assistant_owner_changed');bind(host);if(prepared)throw failure('assistant_action_pending');if(!lastUndo||lastUndo.at<Date.now()-900000)throw failure('assistant_undo_unavailable');return request('apply_operations',{proofs:[lastUndo.proof],originRequestId:lastUndo.originRequestId,actions:[]});}
 return{
  turn(text,context={},attachments){if(!attachments?.length&&/^(?:отмени|отменить|верни)(?: последнее)? (?:действие|изменение)$/iu.test(String(text).trim()))return undoNow();return request('turn',{text,context,...(attachments?.length?{attachments}:{}),history:structuredClone(history)});},
  undo(){return undoNow();},
  confirmOperation(id){const item=operationChoices.get(id);if(!item)throw failure('assistant_choice_expired');check(item.token,item.host);operationChoices.delete(id);return request('apply_operations',{proofs:[item.plan.proof],originRequestId:item.plan.originRequestId,confirmed:true,actions:[]});},
  command(id){return request('command_status',{id:Number(id)});},
  next(){if(!followUp)throw failure('assistant_choice_expired');return request('turn',{text:'Да',context:{}});},
  confirm(id){const c=confirmations.get(id);if(!c)throw failure('assistant_choice_expired');check(c.token,c.host);confirmations.delete(id);return request('confirm_delete',{proof:c.value.proof,confirmed:true});},
  decline(){const generic=operationChoices.size>0,text=generic?'Хорошо, не выполняю.':'Хорошо, оставил запись.';confirmations.clear();operationChoices.clear();history=[...history,{role:'user',text:generic?'Не выполнять действие.':'Не удалять запись.'},{role:'assistant',text}].slice(-8);persist();return{text,actions:[],choices:[]};},
  choose(id){const pending=choices.get(id);if(!pending)throw failure('assistant_choice_expired');check(pending.token,pending.host);const choice=pending.choice;return request('dial',choice.proof?{proof:choice.proof}:{ref:choice.source.ref,phone:choice.phone});},
  source(id){const item=sources.get(id);if(!item)throw failure('assistant_choice_expired');check(item.token,item.host);globalThis.window.open(item.source.url,'_blank','noopener,noreferrer');return {text:'Открыл источник.',choices:[],activations:[]};},
  async activate(id){const current=activations.get(id);if(!current)throw failure('assistant_choice_expired');activations.delete(id);return execute(current.action,current.token,current.host,true);},
  cancel(){sequence++;choices.clear();activations.clear();sources.clear();confirmations.clear();},
  dispose(){sequence++;choices.clear();activations.clear();history=[];refs=[];pending=null;scope=null;prepared=null;lastUndo=null;operationChoices.clear();sources.clear();delivered.clear();}
 };
}

/** tel: asks for a dialer. Android's native URL policy uses ACTION_DIAL, not CALL. */
export function createAssistantDeviceExecutor({window:win=globalThis.window,navigate,openRecord,openDocument,isCurrent=()=>true}={}){
 return async(action,meta={})=>{
  if(!isCurrent()||meta.isCurrent?.()===false||win.document.hidden)throw failure('assistant_owner_changed');
  if(action.kind==='dial'){
   if(!PHONE.test(action.phone)||/^\+?0+$/.test(action.phone))throw failure('assistant_invalid_phone');
   if(!win.SorokaAndroid&&!win.SorokaNative&&!meta.activation)return{status:'activation_required'};
   win.location.assign('tel:'+action.phone);return{status:'requested'};
  }
  if(action.kind==='open_document'&&typeof openDocument==='function'){if(await openDocument(action.documentId,meta)===false)throw failure('assistant_navigation_cancelled');return{status:'requested'};}
  if(action.kind==='open_section'&&typeof navigate==='function'){if(await navigate(action.section,meta)===false)throw failure('assistant_navigation_cancelled');return{status:'requested'};}
  if(action.kind==='open_record'&&typeof openRecord==='function'){if(await openRecord(action.source.ref,meta)===false)throw failure('assistant_navigation_cancelled');return{status:'requested'};}
  throw failure('assistant_action_unavailable');
 };
}
