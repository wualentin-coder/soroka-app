import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/vault-crypto.js';
import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/vault-workspace.js';

const copy=value=>structuredClone(value),object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function nativeId(value){const n=Number(value);if(!((typeof value==='number'||typeof value==='string'&&/^[1-9]\d{0,15}$/.test(value))&&Number.isSafeInteger(n)&&n>0))throw Error('vault_bad_id');return n;}
function stateAnswer(value){
 if(!object(value)||typeof value.setup!=='boolean')throw Error('vault_state');
 if(value.setup&&(!object(value.publicKey)||value.publicKey.kty!=='EC'||value.publicKey.crv!=='P-256'||typeof value.publicKey.x!=='string'||typeof value.publicKey.y!=='string'||typeof value.wrappedKey!=='string'||typeof value.salt!=='string'||!Number.isInteger(value.iterations)||value.iterations<100000||value.iterations>5000000))throw Error('vault_state');
 return copy(value);
}
function listAnswer(value){
 if(!object(value)||!Array.isArray(value.items)||value.items.length>1000)throw Error('vault_list');
 const items=value.items.map(row=>{if(!object(row)||typeof row.service!=='string')throw Error('vault_list');return{id:nativeId(row.id),service:row.service};});
 if(new Set(items.map(row=>row.id)).size!==items.length)throw Error('vault_list');return items;
}
const publicMaterial=value=>Object.fromEntries(['kty','crv','x','y'].map(name=>[name,value?.[name]]));
const keysEqual=(a,b)=>a?.setup===true&&same(publicMaterial(a.publicKey),publicMaterial(b.publicKey))&&['salt','wrappedKey','iterations'].every(name=>same(a[name],b[name]));
const missing=error=>error?.message==='vault_not_found'||error?.code==='vault_not_found';
const ownerTag=host=>{if(!object(host?.owner)||!/^[a-f0-9]{64}$/.test(host.owner.scope||''))throw Error('vault_host');return host.owner.scope+':'+String(host.owner.epoch??'native');};
const nativeCall=(host,op,args)=>host.request(op.slice('vault2_'.length),args);

/** Existing native wire and FlowVault crypto only. App supplies the captured
 * realHost from getModuleHost('vault'): {owner,isCurrent(),request(op,args),subscribe}.
 * The existing SDK maps state/setup/rewrap/list/get/save/delete to vault2_*.
 * No boundVault, root commit, plaintext storage or synthetic setup fallback. */
export function vaultRealOwner(api){
 let host=null,connection=null,unsubscribe=null,observer=null,key=null,keys=null,items=[],epoch=0,busy=false,timer=null,disposed=false;
 let pending=null,seenSetup=false,ownerIdentity=null;const revealed=new Map();
 const visible=()=>!disposed&&!document.hidden&&!!host?.isConnected;
 function touch(){clearTimeout(timer);timer=setTimeout(lock,5*60000);}
 function metadata(){return items.map(row=>({id:String(row.id),service:row.service}));}
 function sync(){if(host)host.model={mode:key?'unlocked':keys?.setup?'locked':'setup',records:key?metadata():[]};}
 function lock(){epoch++;key=null;revealed.clear();busy=false;clearTimeout(timer);host?.clearSecrets();if(host){host.model={mode:keys?.setup===false?'setup':'locked',records:[]};}}
 function stopLease(){unsubscribe?.();unsubscribe=null;observer?.disconnect();observer=null;connection=null;}
 function status(message,retry=false){const node=document.createElement('p');node.setAttribute('role','status');node.textContent=message;if(retry){const button=document.createElement('flow-button');button.setAttribute('label','Повторить');button.addEventListener('click',()=>{void render();});node.append(button);}return node;}
 function errorText(error){
  if(error?.message==='vault_master_wrong')return 'Неверный мастер-пароль.';
  if(error?.message==='vault_master_short')return 'Мастер-пароль должен быть не короче 8 символов.';
  if(error?.message==='vault_unconfirmed')return 'Ответ о сохранении не подтверждён. Проверим уже отправленную запись; новая копия не создаётся.';
  if(error?.message==='vault_bad_id')return 'Неверный идентификатор записи. Открой сейф заново.';
  if(error?.message==='vault_changed'||error?.message==='vault_exists')return 'Сейф изменился. Закрой его и открой заново.';
  if(error?.message==='vault_large')return 'Запись слишком большая. Сократи её и повтори сохранение.';
  if(error?.message==='vault_cleanup_required')return 'Смена мастер-пароля пока не подключена к защите этого устройства.';
  if(error?.message==='vault_cleanup_unconfirmed')return 'Новая обёртка сохранена, но сброс доступа устройства ещё не подтверждён. Повтори проверку.';
  return 'Не удалось открыть или сохранить запись. Правки не подтверждены; повтори действие.';
 }
 function leaseCheck(current,token,captured,ownerEpoch){
  if(disposed||epoch!==token||host!==current||!visible()||connection!==captured||captured.isCurrent()!==true||api.ownerEpoch?.()!==ownerEpoch)throw Error('vault_stale');
 }
 async function readRecord(id,request){const row=await request('vault2_get',{id});if(!object(row)||nativeId(row.id)!==id||typeof row.service!=='string'||!object(row.envelope))throw Error('vault_record');return copy(row);}
 async function plaintext(id,request,check){
  if(revealed.has(id))return copy(revealed.get(id));const privateKey=key;if(!privateKey)throw Error('vault_locked');
  const row=await readRecord(id,request);check();const secret=await FlowVault.decrypt(privateKey,row.envelope);check();
  if(key!==privateKey||!object(secret))throw Error('vault_locked');const record={id:String(id),service:row.service,login:String(secret.login||''),password:String(secret.password||''),note:String(secret.note||'')};revealed.set(id,record);touch();return copy(record);
 }
 function adoptRow(row){const id=nativeId(row.id);items=[...items.filter(item=>item.id!==id),{id,service:row.service}];revealed.delete(id);}
 async function reconcile(request,check){
  const operation=pending;if(!operation)return true;if(operation.owner!==ownerTag(connection))throw Error('vault_changed');
  if(operation.kind==='setup'||operation.kind==='rewrap'){
   const state=stateAnswer(await request('vault2_state',{}));check();
   if(operation.kind==='setup'&&state.setup&&!keysEqual(state,operation.state)){keys=state;seenSetup=true;pending=null;throw Error('vault_changed');}
   if(!keysEqual(state,operation.state))throw Error('vault_unconfirmed');
   keys=state;seenSetup=true;
   if(operation.kind==='rewrap'){
    if(typeof api.onRewrapConfirmed!=='function')throw Error('vault_cleanup_required');
    const cleared=await api.onRewrapConfirmed();check();if(cleared!==true)throw Error('vault_cleanup_unconfirmed');
   }
   pending=null;return true;
  }
  if(operation.kind==='delete'){
   try{await readRecord(operation.id,request);check();throw Error('vault_unconfirmed');}catch(error){check();if(!missing(error))throw error;}
   items=items.filter(row=>row.id!==operation.id);revealed.delete(operation.id);pending=null;return true;
  }
  if(operation.id!==null){
   const row=await readRecord(operation.id,request);check();if(row.service!==operation.service||!same(row.envelope,operation.envelope))throw Error('vault_unconfirmed');
   adoptRow(row);pending=null;return true;
  }
  // Native create has no client ID/idempotency key. Zero matches in a limited
  // list is never permission to POST again. Reuse this exact envelope only for
  // readback; retain an explicit unconfirmed outcome until a match is proven.
  const listed=listAnswer(await request('vault2_list',{}));check();const candidates=listed.filter(row=>row.service===operation.service);if(candidates.length>32)throw Error('vault_unconfirmed');
  const matches=[];for(const item of candidates){const row=await readRecord(item.id,request);check();if(row.service===operation.service&&same(row.envelope,operation.envelope))matches.push(row);}
  if(matches.length!==1)throw Error('vault_unconfirmed');items=listed;adoptRow(matches[0]);pending=null;return true;
 }
 async function write(kind,args,request,check){
  try{
   const answer=await request('vault2_'+kind,args);check();
   if(kind==='save'){
    const id=nativeId(answer?.id);if(pending.id!==null&&pending.id!==id)throw Error('vault_unconfirmed');pending.id=id;
   }else if(answer?.ok!==true)throw Error('vault_unconfirmed');
   if(kind==='delete'){items=items.filter(row=>row.id!==pending.id);revealed.delete(pending.id);pending=null;return;}
   await reconcile(request,check);
  }catch(error){
   check();
   if(!pending)throw error;
   // Read after a lost/malformed ACK, never blindly repeat a create/update.
   try{await reconcile(request,check);return;}catch(recovery){check();if(error?.status>=400&&error.status<500&&![408,429].includes(error.status)&&recovery?.message!=='vault_unconfirmed'){pending=null;throw error;}throw Error('vault_unconfirmed');}
  }
 }
 async function handle(event,current){
  event.preventDefault();event.stopImmediatePropagation();const {action,requestId,recordId,field}=event.detail;
  // Workspace erases these event fields immediately after synchronous dispatch.
  let master=event.detail.master,oldMaster=event.detail.oldMaster,draft=event.detail.draft;
  if(action==='lock'){lock();return;}if(!visible()||host!==current)return;if(busy){current.settle(requestId,{ok:false,error:'Дождись окончания текущего действия.'});return;}
  const token=epoch,captured=connection,ownerEpoch=api.ownerEpoch?.(),check=()=>leaseCheck(current,token,captured,ownerEpoch);
  const request=async(op,args)=>{check();const answer=await nativeCall(captured,op,args);check();if(answer?.error)throw Error('vault_remote');return answer;};
  busy=true;
  try{
   check();
   if(pending&&['save','setup','rewrap','delete'].includes(action)){
    if(action!==pending.kind)throw Error('vault_unconfirmed');
    if(action==='save'){
     if(!key)throw Error('vault_locked');const origin=recordId===null||recordId===undefined?null:nativeId(recordId);
     if(origin!==pending.originId||!object(draft)||String(draft.service||'').trim().slice(0,120)!==pending.service)throw Error('vault_unconfirmed');
     const original=await FlowVault.decrypt(key,pending.envelope);check();
     if(!same(original,{login:String(draft.login||''),password:String(draft.password||''),note:String(draft.note||'')}))throw Error('vault_unconfirmed');
    }
    if(action==='delete'&&nativeId(recordId)!==pending.id)throw Error('vault_unconfirmed');
    if(action==='rewrap'){await FlowVault.unlock(String(master||''),pending.state);check();}
    await reconcile(request,check);check();if(action==='setup'&&!key){const unlocked=await FlowVault.unlock(String(master||''),keys);check();key=unlocked;}
    sync();current.settle(requestId,{ok:true});touch();return;
   }
   if(['discard','delete'].includes(action)){const accepted=await api.confirm(action==='discard'?'discard':'delete',current);check();if(!accepted){current.settle(requestId,{ok:false});return;}if(action==='discard'){current.settle(requestId,{ok:true});return;}}
   if(action==='setup'){
    const actual=stateAnswer(await request('vault2_state',{}));check();if(actual.setup){keys=actual;seenSetup=true;throw Error('vault_exists');}if(seenSetup)throw Error('vault_exists');
    if(listAnswer(await request('vault2_list',{})).length)throw Error('vault_changed');check();
    const state=await FlowVault.setup(String(master||''));check();pending={kind:'setup',owner:ownerTag(captured),state:{setup:true,...copy(state)}};
    await write('setup',state,request,check);const unlocked=await FlowVault.unlock(String(master||''),keys);check();key=unlocked;items=[];sync();current.settle(requestId,{ok:true});touch();
   }else if(action==='unlock'){
    const actual=stateAnswer(await request('vault2_state',{}));check();if(!actual.setup)throw Error('vault_changed');keys=actual;seenSetup=true;
    const unlocked=await FlowVault.unlock(String(master||''),keys);check();const listed=listAnswer(await request('vault2_list',{}));check();key=unlocked;items=listed;
    if(pending)try{await reconcile(request,check);}catch{check();}
    sync();current.settle(requestId,{ok:true,...(pending?{message:'Есть неподтверждённая запись. Повторное создание заблокировано.'}:{})});touch();
   }else{
    if(!key)throw Error('vault_locked');const id=recordId===null||recordId===undefined?null:nativeId(recordId);
    if(id!==null&&!items.some(row=>row.id===id))throw Error('vault_changed');
    if(action==='open'){if(id===null)throw Error('vault_bad_id');const record=await plaintext(id,request,check);check();current.settle(requestId,{ok:true,record});}
    else if(action==='copy'){
     if(id===null||!['login','password'].includes(field))throw Error('vault_record');const record=await plaintext(id,request,check);check();await navigator.clipboard.writeText(record[field]);check();current.settle(requestId,{ok:true,message:'Скопировано.'});touch();
    }else if(action==='save'){
     if(!object(draft)||id===null&&draft.id!=null||id!==null&&draft.id!=null&&nativeId(draft.id)!==id)throw Error('vault_bad_id');
     const service=String(draft.service||'').trim().slice(0,120),secret={login:String(draft.login||''),password:String(draft.password||''),note:String(draft.note||'')};if(!service||!secret.password)throw Error('vault_record');
     const envelope=await FlowVault.encrypt(keys.publicKey,secret);check();if(typeof envelope.ct!=='string'||envelope.ct.length>=20000)throw Error('vault_large');
     pending={kind:'save',owner:ownerTag(captured),id,originId:id,service,envelope:copy(envelope)};
     await write('save',{...(id===null?{}:{id}),service,envelope},request,check);sync();current.settle(requestId,{ok:true});touch();
    }else if(action==='delete'){
     if(id===null)throw Error('vault_bad_id');pending={kind:'delete',owner:ownerTag(captured),id};await write('delete',{id},request,check);sync();current.settle(requestId,{ok:true});touch();
    }else if(action==='rewrap'){
     if(typeof api.onRewrapConfirmed!=='function')throw Error('vault_cleanup_required');
     const wrapped=await FlowVault.rewrap(String(oldMaster||''),String(master||''),keys);check();pending={kind:'rewrap',owner:ownerTag(captured),state:{...copy(keys),...copy(wrapped)}};
     await write('rewrap',wrapped,request,check);sync();current.settle(requestId,{ok:true});touch();
    }else throw Error('vault_action');
   }
  }catch(error){try{check();const message=errorText(error);current.settle(requestId,{ok:false,error:message});if(!key&&keys?.setup&&current.model?.mode==='setup'){sync();current.notice?.(message);}}catch{}}
  finally{master=null;oldMaster=null;draft=null;if(epoch===token)busy=false;}
 }
 async function render(){
  lock();stopLease();host=null;keys=null;items=[];const token=++epoch,ownerEpoch=api.ownerEpoch?.(),loading=status('Загружаем сейф…');api.screen.replaceChildren(loading);
  let captured=null;const check=()=>{if(disposed||token!==epoch||connection!==captured||captured?.isCurrent()!==true||api.ownerEpoch?.()!==ownerEpoch||!(host?host.isConnected:loading.isConnected))throw Error('vault_stale');};
  try{
   captured=await (typeof api.realHost==='function'?api.realHost():api.realHost);
   if(disposed||token!==epoch||!loading.isConnected)return null;
   if(!captured?.owner||typeof captured.isCurrent!=='function'||captured.isCurrent()!==true||typeof captured.request!=='function')throw Error('vault_host');
   connection=captured;const identity=ownerTag(captured);if(ownerIdentity!==null&&ownerIdentity!==identity&&pending)throw Error('vault_changed');if(ownerIdentity!==identity)seenSetup=false;ownerIdentity=identity;
   const invalidate=()=>{if(captured.isCurrent()===true)return;lock();stopLease();host=null;api.screen.replaceChildren(status('Подключение сейфа изменилось. Открой раздел заново.',true));};
   unsubscribe=captured.subscribe?.(invalidate);check();
   const actual=stateAnswer(await nativeCall(captured,'vault2_state',{}));check();const listed=listAnswer(await nativeCall(captured,'vault2_list',{}));check();
   if(!actual.setup&&(listed.length||seenSetup))throw Error('vault_changed');keys=actual;if(actual.setup)seenSetup=true;items=listed;
   if(pending)try{await reconcile(async(op,args)=>{check();const answer=await nativeCall(captured,op,args);check();return answer;},check);}catch{check();}
   const current=host=document.createElement('flow-vault-workspace');sync();current.ownerEvents.addEventListener('flow-vault-intent',event=>{void handle(event,current);});current.addEventListener('flow-vault-lock',()=>{if(current===host)lock();});
   api.screen.replaceChildren(current);api.compare?.('L07',{mode:keys.setup?'locked':'setup',records:[]});
   if(typeof MutationObserver==='function'){observer=new MutationObserver(()=>{if(host===current&&!current.isConnected){lock();stopLease();host=null;}});observer.observe(api.screen,{childList:true,subtree:true});}
   return current;
  }catch(error){if(token===epoch&&!disposed){stopLease();host=null;key=null;revealed.clear();api.screen.replaceChildren(status('Не удалось подтвердить состояние сейфа. Повтори загрузку.',true));}return null;}
 }
 async function guard(){
  if(busy){api.notice?.('Дождись подтверждения действия сейфа.');return false;}
  if(pending){api.notice?.('Сохранение сейфа не подтверждено. Проверь уже отправленную запись перед выходом.');return false;}
  if(!host?.isConnected){lock();return true;}const current=host,token=epoch;
  if(current.dirty&&!await api.confirm('discard',current))return false;if(token!==epoch||host!==current)return false;lock();return true;
 }
 const hidden=()=>{if(document.hidden)lock();};document.addEventListener('visibilitychange',hidden);window.addEventListener('flow:suspend',lock);window.addEventListener('pagehide',lock);
 function dispose(){lock();stopLease();disposed=true;host=null;document.removeEventListener('visibilitychange',hidden);window.removeEventListener('flow:suspend',lock);window.removeEventListener('pagehide',lock);}
 return{render,guard,lock,dispose,get isOpen(){return Boolean(host?.isConnected&&host.hasOpenEditor);},get model(){return{mode:key?'unlocked':keys?.setup?'locked':'unknown',records:[],unconfirmed:!!pending};}};
}
