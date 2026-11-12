import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/vault-crypto.js';
import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/vault-workspace.js';

const clone=value=>structuredClone(value);
/** Local browser owner. The existing cryptographic wire format is unchanged. */
export function vaultOwner(api){
 let host=null,key=null,plain=[],epoch=0,busy=false;
 const stored=()=>api.getState().boundVault||null;
 const fingerprint=()=>JSON.stringify(stored());
 const model=()=>({mode:key?'unlocked':stored()?'locked':'setup',records:key?plain.map(record=>({id:record.id,service:record.service})):[]});
 const visible=()=>!document.hidden&&!!host?.isConnected;
 function sync(){if(host)host.model=model();}
 function lock(){epoch++;key=null;plain=[];busy=false;if(host){host.clearSecrets();sync();}}
 const hidden=()=>{if(document.hidden)lock();};document.addEventListener('visibilitychange',hidden);window.addEventListener('flow:suspend',lock);window.addEventListener('pagehide',lock);
 function errorText(error){if(error?.message==='vault_master_wrong')return 'Неверный мастер-пароль.';if(error?.message==='vault_master_short')return 'Мастер-пароль должен быть не короче 8 символов.';if(error?.message==='vault_storage')return 'Не удалось сохранить. Правки остались в форме.';if(error?.message==='vault_changed')return 'Хранилище изменилось. Закрой его и открой заново.';return 'Не удалось открыть или сохранить запись. Повтори действие.';}
 function checkedState(value){if(!value||value.version!==1||!value.state?.publicKey||!value.state.wrappedKey||!Array.isArray(value.records))throw Error('vault_state');return value;}
 async function handle(event,current){event.preventDefault();event.stopImmediatePropagation();const {action,requestId,recordId,field}=event.detail;let master=event.detail.master,oldMaster=event.detail.oldMaster,draft=event.detail.draft;
  if(action==='lock'){lock();return;}if(!visible()||host!==current)return;if(busy){current.settle(requestId,{ok:false,error:'Дождись окончания текущего действия.'});return;}
  const token=epoch,expected=fingerprint(),valid=()=>host===current&&visible()&&epoch===token;
  const assertCurrent=()=>{if(!valid())throw Error('vault_stale');if(fingerprint()!==expected)throw Error('vault_changed');};
  const commit=next=>{assertCurrent();if(!api.commit(state=>{if(JSON.stringify(state.boundVault||null)!==expected)throw Error('vault_changed');state.boundVault=next;}))throw Error('vault_storage');};
  busy=true;
  try{
   if(['discard','delete'].includes(action)){const accepted=await api.confirm(action==='discard'?'discard':'delete',current);assertCurrent();if(!accepted){current.settle(requestId,{ok:false});return;}if(action==='discard'){current.settle(requestId,{ok:true});return;}}
   if(action==='setup'){
    if(stored())throw Error('vault_changed');const state=await FlowVault.setup(String(master||''));assertCurrent();const unlocked=await FlowVault.unlock(String(master||''),state);assertCurrent();
    commit({version:1,state,records:[]});key=unlocked;plain=[];sync();current.settle(requestId,{ok:true});
   }else if(action==='unlock'){
    const data=checkedState(clone(stored())),unlocked=await FlowVault.unlock(String(master||''),data.state);assertCurrent();const records=[];
    for(const row of data.records){const value=await FlowVault.decrypt(unlocked,row.envelope);assertCurrent();if(!value||typeof value!=='object'||Array.isArray(value))throw Error('vault_record');records.push({...value,id:row.id});}
    key=unlocked;plain=records;sync();current.settle(requestId,{ok:true});
   }else{
    if(!key)throw Error('vault_locked');const data=checkedState(clone(stored())),previous=plain.find(record=>String(record.id)===String(recordId));
    if(action==='open'){if(!previous)throw Error('vault_record');current.settle(requestId,{ok:true,record:clone(previous)});}
    else if(action==='save'){
     if(recordId&&!previous)throw Error('vault_changed');if(!draft||!String(draft.service||'').trim()||!String(draft.password||''))throw Error('vault_record');
     const record={...clone(previous||{}),...clone(draft),id:previous?.id||crypto.randomUUID(),service:String(draft.service).trim()},envelope=await FlowVault.encrypt(data.state.publicKey,record);assertCurrent();
     const index=data.records.findIndex(row=>String(row.id)===String(record.id)),row={...(index>=0?data.records[index]:{}),id:record.id,envelope};if(index<0)data.records.push(row);else data.records[index]=row;
     commit(data);const at=plain.findIndex(row=>row.id===record.id);if(at<0)plain.push(record);else plain[at]=record;sync();current.settle(requestId,{ok:true});
    }else if(action==='delete'){
     if(!previous)throw Error('vault_record');data.records=data.records.filter(row=>String(row.id)!==String(recordId));commit(data);plain=plain.filter(row=>String(row.id)!==String(recordId));sync();current.settle(requestId,{ok:true});
    }else if(action==='rewrap'){
     const wrapped=await FlowVault.rewrap(String(oldMaster||''),String(master||''),data.state);assertCurrent();data.state={...data.state,...wrapped};commit(data);sync();current.settle(requestId,{ok:true});
    }else if(action==='copy'){
     if(!previous||!['login','password'].includes(field))throw Error('vault_record');assertCurrent();await navigator.clipboard.writeText(String(previous[field]||''));assertCurrent();current.settle(requestId,{ok:true,message:'Скопировано.'});
    }else throw Error('vault_action');
   }
  }catch(error){if(valid())current.settle(requestId,{ok:false,error:errorText(error)});}
  finally{master=null;oldMaster=null;draft=null;if(epoch===token)busy=false;}
 }
 function render(){lock();const current=host=document.createElement('flow-vault-workspace');current.model=model();current.ownerEvents.addEventListener('flow-vault-intent',event=>{void handle(event,current);});current.addEventListener('flow-vault-lock',()=>{if(current===host)lock();});api.screen.replaceChildren(current);api.compare?.('L07',{mode:model().mode,records:[]});}
 async function guard(){if(!host?.isConnected){lock();return true;}const current=host,token=epoch;if(current.dirty&&!await api.confirm('discard',current))return false;if(token!==epoch||current!==host)return false;lock();return true;}
 function dispose(){lock();document.removeEventListener('visibilitychange',hidden);window.removeEventListener('flow:suspend',lock);window.removeEventListener('pagehide',lock);host=null;}
 return{render,guard,lock,dispose,get isOpen(){return Boolean(host?.isConnected&&host.hasOpenEditor);},get model(){return{mode:model().mode,records:[]};}};
}

