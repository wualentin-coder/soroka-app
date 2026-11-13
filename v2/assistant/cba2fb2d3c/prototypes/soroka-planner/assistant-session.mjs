const PHONE=/^\+?\d{7,15}$/;
const REF=/^(task|event|note|link|recipe|movie|product|debt|payment|money|list|place|metric|card):[1-9]\d{0,14}$/;
const failure=code=>Object.assign(new Error(code),{code});
function actionValid(action,requestId){
 if(!action||typeof action.id!=='string'||!action.id.startsWith(requestId+':'))return false;
 if(action.kind==='dial')return PHONE.test(action.phone)&&!/^\+?0+$/.test(action.phone)&&REF.test(action.source?.ref)&&typeof action.source?.title==='string';
 if(action.kind==='open_record')return REF.test(action.source?.ref)&&typeof action.source?.title==='string';
 return action.kind==='open_section'&&typeof action.section==='string'&&/^[a-z_/-]{1,80}$/.test(action.section);
}
/** Captured host ownership and sequence guards apply before every device action. */
export function createAssistantSession(getHost,{executeAction,canAct=()=>true}={}){
 let sequence=0,choices=new Map(),activations=new Map(),history=[];const delivered=new Set();
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
  const token=++sequence;choices.clear();activations.clear();const host=await getHost();check(token,host);
  const requestId=crypto.randomUUID();const response=await host.request(op,{...args,requestId});check(token,host);
  if(response?.requestId!==requestId||typeof response.text!=='string'||!Array.isArray(response.actions)||response.actions.length>1||!response.actions.every(action=>actionValid(action,requestId)))throw failure('assistant_invalid_response');
  const result={...response,activations:[]};
  for(const choice of response.choices||[]){if(typeof choice.id!=='string'||!choice.id.startsWith(requestId+':phone:')||!PHONE.test(choice.phone)||!REF.test(choice.source?.ref))throw failure('assistant_invalid_choice');choices.set(choice.id,{choice:structuredClone(choice),token,host});}
  if(op==='turn')history=[...history,{role:'user',text:String(args.text).slice(0,1200)},{role:'assistant',text:response.text.slice(0,1200)}].slice(-8);
  for(const action of response.actions){const outcome=await execute(action,token,host);if(outcome.status==='activation_required'){result.activations.push(action);if(action.kind==='dial')result.text=`Номер из «${action.source.title}»: ${action.phone}. Открыть набор?`;}}
  return result;
 }
 return{
  turn(text,context={}){return request('turn',{text,context,history:structuredClone(history)});},
  choose(id){const pending=choices.get(id);if(!pending)throw failure('assistant_choice_expired');check(pending.token,pending.host);const choice=pending.choice;return request('dial',{ref:choice.source.ref,phone:choice.phone});},
  async activate(id){const current=activations.get(id);if(!current)throw failure('assistant_choice_expired');activations.delete(id);return execute(current.action,current.token,current.host,true);},
  cancel(){sequence++;choices.clear();activations.clear();},
  dispose(){sequence++;choices.clear();activations.clear();history=[];delivered.clear();}
 };
}

/** tel: asks for a dialer. Android's native URL policy uses ACTION_DIAL, not CALL. */
export function createAssistantDeviceExecutor({window:win=globalThis.window,navigate,openRecord,isCurrent=()=>true}={}){
 return async(action,meta={})=>{
  if(!isCurrent()||meta.isCurrent?.()===false||win.document.hidden)throw failure('assistant_owner_changed');
  if(action.kind==='dial'){
   if(!PHONE.test(action.phone)||/^\+?0+$/.test(action.phone))throw failure('assistant_invalid_phone');
   if(!win.SorokaAndroid&&!win.SorokaNative&&!meta.activation)return{status:'activation_required'};
   win.location.assign('tel:'+action.phone);return{status:'requested'};
  }
  if(action.kind==='open_section'&&typeof navigate==='function'){if(await navigate(action.section,meta)===false)throw failure('assistant_navigation_cancelled');return{status:'requested'};}
  if(action.kind==='open_record'&&typeof openRecord==='function'){if(await openRecord(action.source.ref,meta)===false)throw failure('assistant_navigation_cancelled');return{status:'requested'};}
  throw failure('assistant_action_unavailable');
 };
}
