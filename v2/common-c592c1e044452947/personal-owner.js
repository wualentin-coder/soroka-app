import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/personal-workspace.js';
const clone=value=>structuredClone(value);
const isSite=record=>/\.html?$/i.test(String(record.title||''))||/\.html?$/i.test(String(record.fileName||''))||typeof record.html==='string';
export function personalOwner(api){
 let host=null,kind='metrics',generation=0,pending=null;
 const records=()=>kind==='metrics'?api.getState().metrics||[]:(api.getState().saved.files||[]).filter(isSite);
 const model=()=>({kind,records:records(),today:api.today,projects:api.getState().projects,settings:api.getState().settings,siteContents:api.getState().boundSiteContents||{}});
 async function guard(){if(!host?.isConnected)return true;if(pending?.host===host)return false;const current=host,token=generation,ownerEpoch=api.ownerEpoch?.(),form=current.shadowRoot.querySelector('.editor[open] .fields');if(host.dirty&&!await api.confirm('discard',host))return false;if(current!==host||token!==generation||api.ownerEpoch?.()!==ownerEpoch||current.shadowRoot.querySelector('.editor[open] .fields')!==form)return false;host.closeWindows();return true;}
 function render(next){kind=next;const current=host=document.createElement('flow-personal-workspace'),token=++generation,ownerEpoch=api.ownerEpoch?.();let creation=null;current.model=model();const owns=()=>current===host&&current.isConnected&&generation===token&&api.ownerEpoch?.()===ownerEpoch;
  current.addEventListener('flow-personal-intent',async event=>{event.preventDefault();const d=clone(event.detail),{action,requestId,recordId}=d,form=current.shadowRoot.querySelector('.editor[open] .fields');if(!owns())return;
   const valid=()=>owns()&&current.shadowRoot.querySelector('.editor[open] .fields')===form;
   if(pending?.host===current){if(pending.requestId!==requestId)current.settle(requestId,{ok:false,error:'Дождись завершения сохранения.'});return;}
   const job={host:current,requestId},inert=current.inert,busy=current.getAttribute('aria-busy');pending=job;current.inert=true;current.setAttribute('aria-busy','true');
   const settle=(ok,error,record)=>{if(valid()){ok=ok===true;if(ok)current.model=model();current.settle(requestId,{ok,error,record});if(ok)api.frame.respond();}};
   try{
   if(['discard','delete'].includes(action)){if(!await api.confirm(action==='delete'?'delete':'discard',current)||!valid()){settle(false);return;}if(action==='discard'){settle(true);return;}}
   if(action==='open-source'){settle(false,'Исходный HTML не загружен. Открой локальный HTML-файл через редактор.');return;}
   if(!['save','delete','pin'].includes(action)){settle(false,'Действие не подключено.');return;}
   if(kind==='sites'&&action==='save'&&(typeof api.siteHTMLWritable==='function'?api.siteHTMLWritable():api.siteHTMLWritable)===false){settle(false,'Загрузка HTML на сервер не подключена. Исходный текст остался в редакторе.');return;}
   let id=recordId;if(!id&&action==='save'){if(!creation||creation.form!==form)creation={form,id:crypto.randomUUID()};id=creation.id;}
   const target=kind==='metrics'?{group:'root',key:'metrics'}:{group:'saved',key:'files'},patch=clone(action==='save'?(recordId&&d.changes!==undefined?d.changes:d.draft):d.changes||{});let removed,index;
   const ok=await api.commit(state=>{if(!valid())throw Error('stale owner');const pool=target.group==='root'?(state.metrics??=[]):(state.saved.files??=[]),resolved=api.resolveId?.(id)||id,at=pool.findIndex(row=>String(row.id)===String(resolved)),old=at<0?null:pool[at];if((action!=='save'||recordId)&&!old)throw Error('Запись больше не существует. Черновик остался здесь.');
    if(action==='delete'){removed=clone(old);index=at;pool.splice(at,1);(state.trash??=[]).push({type:'saved',target,record:removed,index,deleted:Date.now()});return;}
    const stored={...clone(old||{}),...patch,id:old?.id||id};if(kind==='sites'){if(action==='save'&&typeof stored.html==='string'){(state.boundSiteContents||={})[stored.id]=stored.html;delete stored.html;}stored.fileType=old?.fileType||'html';}if(at<0)pool.push(stored);else pool[at]=stored;
   });if(!valid())return;if(ok!==true){settle(false,'Не удалось сохранить. Правки остались здесь.');return;}
   const resolved=api.resolveId?.(id)||id,canonical=records().find(row=>String(row.id)===String(resolved));if(action==='delete'?!!canonical:!canonical)throw Error('Сохранённая запись не получена. Правки остались здесь.');
   let record=canonical;if(kind==='sites'&&action==='save'){const body=typeof canonical.html==='string'?canonical.html:api.getState().boundSiteContents?.[resolved];if(typeof body!=='string'||body!==d.draft.html)throw Error('HTML не подтверждён хранилищем. Исходный текст остался в редакторе.');record={...canonical,html:body};}
   if(removed){api.deleted({type:'saved',target,record:removed,index});api.restore();}if(action==='save')creation=null;settle(true,'',action==='delete'?undefined:record);
   }catch(error){settle(false,error.message||'Не удалось сохранить. Правки остались здесь.');}finally{current.inert=inert;if(busy===null)current.removeAttribute('aria-busy');else current.setAttribute('aria-busy',busy);if(pending===job)pending=null;}
  });api.screen.replaceChildren(current);api.restore();api.compare('L06',current.model);
 }
 return{render,guard,open:id=>pending?.host===host?false:host?.open(id),get model(){return model();}};
}
