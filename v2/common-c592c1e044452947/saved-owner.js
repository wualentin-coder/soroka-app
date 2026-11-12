import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/saved-workspace.js';
const kinds=new Set(['materials','recipes','products','addresses','tickets','cards','birthdays','docs']);
const birthday=/д(ень|\.)\s*рожд|(^|\s)др(\s|$)/i;
const copy=value=>structuredClone(value);
export const isBirthday=record=>birthday.test(String(record?.title||''));
export function savedOwner(api){
 let host=null,kind='materials',generation=0,pending=null;
 const records=()=>{const state=api.getState();return kind==='materials'?['links','posts','files'].flatMap(key=>(state.saved[key]||[]).map(record=>({...copy(record),_kind:key}))):kind==='birthdays'?state.events.filter(isBirthday):kind==='docs'?(state.documents||[]):state.saved[kind]||[];};
 const model=()=>({kind,records:records(),categories:api.getState().savedSections,today:api.today});
 const locate=(state,record)=>kind==='materials'?{group:'saved',key:['links','posts','files'].includes(record?._kind)?record._kind:'links'}:kind==='birthdays'?{group:'root',key:'events'}:kind==='docs'?{group:'root',key:'documents'}:{group:'saved',key:kind};
 const pool=(state,target)=>target.group==='saved'?(state.saved[target.key]||=[]):(state[target.key]||=[]);
 async function guard(){if(!host?.isConnected)return true;if(pending?.host===host)return false;const current=host,token=generation,ownerEpoch=api.ownerEpoch?.();if(host.dirty&&!await api.confirm('discard',host))return false;if(current!==host||token!==generation||api.ownerEpoch?.()!==ownerEpoch)return false;host.closeWindows();return true;}
 function render(next){if(!kinds.has(next))throw Error('Unknown saved workspace');kind=next;const current=host=document.createElement('flow-saved-workspace'),token=++generation,ownerEpoch=api.ownerEpoch?.();let createId=null;current.model=model();
  const valid=()=>host===current&&current.isConnected&&token===generation&&api.ownerEpoch?.()===ownerEpoch;
  current.addEventListener('flow-saved-intent',async event=>{
   const detail=event.detail,{action,requestId,recordId}=detail;
   if(!requestId){if(action==='open'&&valid())api.compare('L02',current.model);if(['create','close-editor'].includes(action)&&pending?.host!==current)createId=null;return;}
   event.preventDefault();
   if(!valid())return;
   if(pending?.host===current){if(pending.requestId!==requestId)current.settle(requestId,{ok:false,error:'Дождись завершения сохранения.'});return;}
   const job={host:current,requestId},locked=[...current.shadowRoot.querySelectorAll('dialog[open]')];pending=job;for(const dialog of locked){dialog.inert=true;dialog.setAttribute('aria-busy','true');}
   try{
   if(['discard','delete'].includes(action)){const accepted=await api.confirm(action==='delete'?'delete':'discard',current);if(!valid())return;if(!accepted){current.settle(requestId,{ok:false});api.frame.respond('cancel');return;}if(action==='discard'){createId=null;current.settle(requestId,{ok:true});return;}}
   if(!valid())return;
   if(!['save','delete','pin','viewed'].includes(action)){current.settle(requestId,{ok:false,error:'Это действие требует подключения сервиса. Данные и правки доступны локально.'});return;}
   const old=records().find(record=>String(record.id)===String(recordId));
   if(action!=='save'&&!old){current.settle(requestId,{ok:false,error:'Запись уже изменилась. Открой раздел заново.'});return;}
   const nextRecord=action==='save'?{...copy(old||{}),...copy(detail.draft)}:{...copy(old),...copy(detail.changes)};
   if(action==='save'&&recordId&&!old){current.settle(requestId,{ok:false,error:'Запись больше не существует. Черновик сохранён в форме.'});return;}
   nextRecord.id=old?.id||(createId??=crypto.randomUUID());
   if(kind==='birthdays'&&!isBirthday(nextRecord))nextRecord.title='День рождения '+nextRecord.title;
   const target=locate(api.getState(),nextRecord),oldTarget=locate(api.getState(),old||nextRecord);let removed,index=-1;
   const accepted=await api.commit(state=>{if(!valid())throw Error('stale owner');const source=pool(state,oldTarget),at=source.findIndex(record=>String(record.id)===String(nextRecord.id));
    if(action==='delete'){if(at<0)throw Error('missing record');index=at;removed=copy(source[at]);source.splice(at,1);state.trash.push({type:'saved',target:oldTarget,record:removed,deleted:Date.now()});return;}
    const stored=copy(nextRecord);delete stored._kind;
    if(oldTarget.key!==target.key){if(at>=0)source.splice(at,1);pool(state,target).push(stored);}else if(at>=0)source[at]=stored;else source.push(stored);
   });
   if(!valid())return;
   if(accepted!==true){current.settle(requestId,{ok:false,error:'Не удалось сохранить. Правки остались в форме.'});return;}
   const resolved=api.resolveId?.(nextRecord.id)||nextRecord.id,canonical=removed?null:records().find(record=>String(record.id)===String(resolved));if(!removed&&!canonical)throw Error('missing receipt');
   if(removed){api.deleted({type:'saved',target:oldTarget,record:removed,index});api.restore();}
   current.model=model();current.settle(requestId,{ok:true,...(removed?{}:{record:canonical})});if(action==='save')createId=null;api.frame.respond();api.compare('L02',current.model);api.syncChrome?.();
   }catch{if(valid())current.settle(requestId,{ok:false,error:'Не удалось сохранить. Правки остались в форме.'});}finally{for(const dialog of locked){dialog.inert=false;dialog.removeAttribute('aria-busy');}if(pending===job)pending=null;}
  });
  api.screen.replaceChildren(current);api.restore();api.compare('L02',current.model);
 }
 return{render,guard,open:id=>pending?.host===host?false:host?.open(id),get model(){return model();},get isOpen(){return Boolean(host?.isConnected&&host.hasOpenEditor);}};
}
