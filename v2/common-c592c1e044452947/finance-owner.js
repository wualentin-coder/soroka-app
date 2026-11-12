import {applyFinanceIntent} from '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/finance-workspace.js';
const pools={transaction:'transactions',payment:'payments',debt:'debts',account:'accounts',transfer:'transfers',goal:'goals',budget:'budgets'};
export function financeOwner(api){
 let host=null,tab='overview',generation=0,pending=null;
 const model=()=>({finance:api.getState().finance,today:api.today,tab,projects:api.getState().projects});
 async function guard(){if(!host?.isConnected)return true;if(pending?.host===host)return false;const current=host,token=generation,ownerEpoch=api.ownerEpoch?.(),form=host.shadowRoot.querySelector('dialog[open] form');if(!form)return true;if(host.dirty&&!await api.confirm('discard',host))return false;if(current!==host||token!==generation||api.ownerEpoch?.()!==ownerEpoch||current.shadowRoot.querySelector('dialog[open] form')!==form)return false;host.closeForm();return true;}
 function render(requested){if(requested)tab=requested;generation++;const current=host=document.createElement('flow-finance-workspace');const token=generation,ownerEpoch=api.ownerEpoch?.();let creation=null;current.model=model();
  const owns=()=>current===host&&current.isConnected&&generation===token&&api.ownerEpoch?.()===ownerEpoch;
  current.addEventListener('flow-finance-tab',event=>{if(!owns())return;tab=event.detail.tab;api.tabChanged?.(tab);api.compare('F04',current.model);});
  current.addEventListener('flow-finance-intent',async event=>{
   event.preventDefault();const intent=structuredClone(event.detail),form=current.shadowRoot.querySelector('dialog[open] form');
   if(!owns())return;
   if(intent.action==='open'){creation=form&&!intent.id?{form,entity:intent.entity,id:null}:null;return;}
   if(pending?.host===current)return;
   const valid=()=>owns()&&current.shadowRoot.querySelector('dialog[open] form')===form;
   const job={host:current},inert=current.inert,busy=current.getAttribute('aria-busy');pending=job;current.inert=true;current.setAttribute('aria-busy','true');
   try{
    if(intent.action==='close-form'){if(!intent.context?.dirty||await api.confirm('discard',current)){if(valid()){creation=null;current.closeForm();}}return;}
    if(intent.action==='delete'&&(!await api.confirm('delete',current)||!valid()))return;
    if(!valid())return;
    const key=pools[intent.entity];if(!key)throw Error('Неизвестный тип финансовой записи.');
    let accepted=intent,removed=null,index=-1;
    if(intent.action==='create'&&!intent.id&&!intent.record?.id){
     if(!creation||creation.form!==form||creation.entity!==intent.entity)creation={form,entity:intent.entity,id:null};
     if(!creation.id){const state=api.getState(),reserved=new Set([...Object.values(state.finance).filter(Array.isArray).flatMap(rows=>rows.map(row=>String(row?.id))),...(state.trash||[]).map(item=>String(item.record?.id))]);do{creation.id=crypto.randomUUID();}while(reserved.has(creation.id));}
     accepted={...intent,id:creation.id,record:{...intent.record,id:creation.id}};
    }
    const saved=await api.commit(state=>{
     if(!valid())throw Error('stale owner');
     const resolved=api.resolveId?.(accepted.id)||accepted.id,existing=state.finance[key]?.find(record=>String(record.id)===String(resolved));
     // A lost receipt may already be represented in canonical state. Retry the
     // same form's reserved record rather than allocate another creation ID.
     const mutation=accepted.action==='create'&&existing&&creation?.id===accepted.id?{...accepted,action:'update',id:existing.id,record:{...accepted.record,id:existing.id}}:accepted;
     if(intent.action==='delete'&&existing){removed=structuredClone(existing);index=state.finance[key].indexOf(existing);}
     state.finance=applyFinanceIntent(state.finance,mutation,{today:api.today});
     if(removed)(state.trash??=[]).push({type:'finance',entity:intent.entity,record:removed,deleted:Date.now()});
    });
    if(!valid())return;
    if(saved!==true){current.error('Не удалось сохранить. Изменения остались в форме.');return;}
    const resolved=api.resolveId?.(accepted.id)||accepted.id,canonical=api.getState().finance[key]?.find(record=>String(record.id)===String(resolved));
    if(intent.action==='delete'?!!canonical:!canonical)throw Error('Не получено подтверждение сохранённой записи. Правки остались в форме.');
    if(removed)api.deleted({type:'finance',entity:intent.entity,record:removed,index});
    creation=null;current.acceptSaved(model());if(removed)api.restore();api.compare('F04',current.model);api.frame.respond();
   }catch(error){if(valid())current.error(error.message||'Изменение не сохранено.');}finally{current.inert=inert;if(busy===null)current.removeAttribute('aria-busy');else current.setAttribute('aria-busy',busy);if(pending===job)pending=null;}
  });
  api.screen.replaceChildren(current);api.restore();api.compare('F04',current.model);
 }
 return{render,guard,get model(){return model();}};
}
