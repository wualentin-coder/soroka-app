import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/collection-workspace.js';
import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/record-card.js';
import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/search.js';

// Local owner: components publish intents; only a successful storage write is saved.
export function collectionOwner(api){
 const clone=value=>structuredClone(value),dialog=document.createElement('dialog');
 dialog.id='collection-workspace';document.body.append(dialog);let editor=null,kind=null,recordId=null,opener=null,generation=0,pendingSave=null,pendingWrite=null;
 const records=(state,type)=>type==='note'?state.notes:state.saved.lists;
 const family=type=>type==='note'?'W04':'W05';
 const returnFocus=()=>{let target=opener?.isConnected?opener:null;if(!target){const card=[...api.screen.querySelectorAll('flow-record-card')].find(card=>card.getAttribute('record-id')===String(recordId));target=card?.shadowRoot.querySelector('[data-open]')||api.screen.querySelector('.collection-head flow-button:last-child')?.shadowRoot.querySelector('button');}target?.focus?.({preventScroll:true});};
 async function close(force=false){if(!dialog.open)return true;const token=generation;
  if(!force&&pendingSave){await pendingSave.promise;return !dialog.open;}
  if(!force&&pendingWrite)return false;
  if(!force&&kind==='note'){
   if(editor.pending){editor.error('Дождись завершения текущего действия. Заметка осталась открыта.');return false;}
   if(editor.dirty&&(recordId||editor.hasContent)){editor.save();if(pendingSave)await pendingSave.promise;return !dialog.open;}
  }else if(!force&&editor.dirty&&!await api.confirm('discard',dialog)){api.frame.respond('cancel');return false;}
  if(token!==generation)return false;dialog.close();api.editingScene(false);generation++;editor?.remove();editor=null;pendingSave=null;pendingWrite=null;returnFocus();return true;
 }
 async function open(type,record=null,mode='read',meta={}){
  if(!await api.beforeOpen()||!await close()||meta.isCurrent&&!meta.isCurrent())return false;
  kind=type;recordId=record?.id||null;opener=document.activeElement;while(opener?.shadowRoot?.activeElement)opener=opener.shadowRoot.activeElement;const token=++generation;
  editor=document.createElement(type==='note'?'flow-note-workspace':'flow-list-workspace');
  editor.sections=api.getState().mapCategories||[];editor.record=clone(record||{title:'',description:'',...(type==='list'?{items:[]}:{}),tags:[],pinned:false});editor.mode=type==='note'?'edit':record?mode:'edit';
  const owned=editor,ownerEpoch=api.ownerEpoch?.(),createId=crypto.randomUUID();dialog.setAttribute('aria-label',type==='note'?'Заметка':'Список');dialog.replaceChildren(owned);
  const valid=()=>generation===token&&editor===owned&&dialog.open&&owned.isConnected&&api.ownerEpoch?.()===ownerEpoch;
  const write=(action,save=false)=>{if(!valid()||pendingWrite?.owned===owned)return null;const job={owned,promise:null};pendingWrite=job;if(save)pendingSave=job;owned.inert=true;owned.setAttribute('aria-busy','true');job.promise=(async()=>{try{return await action();}catch{if(valid())owned.error('Не удалось сохранить. Правки остались здесь.');return false;}finally{owned.inert=false;owned.removeAttribute('aria-busy');if(pendingWrite===job)pendingWrite=null;if(pendingSave===job)pendingSave=null;}})();return job.promise;};
  owned.addEventListener(`flow-${type}-workspace-close`,event=>{event.preventDefault();void close();});
  owned.addEventListener(`flow-${type}-workspace-change`,event=>{
   if(!valid())return;api.frame.respond();
   // A check in read mode is a real immediate mutation, without replacing its row.
   if(type==='list'&&owned.mode==='read'&&['toggle','toggle-subtask'].includes(event.detail.reason)){
    const draft=clone(event.detail.draft),id=recordId;
    void write(async()=>{const accepted=await api.commit(state=>{if(!valid())throw Error('stale owner');const pool=records(state,type),index=pool.findIndex(item=>item.id===id);if(index<0)throw Error('missing record');pool[index]={...pool[index],...draft,id};});if(!valid())return false;if(accepted!==true){owned.error('Не удалось сохранить отметку. Изменение осталось здесь.');return false;}
    const saved=records(api.getState(),type).find(item=>String(item.id)===String(api.resolveId?.(id)||id));if(!saved)throw Error('missing receipt');owned.acceptSaved(saved);refreshSummary(type,saved);api.compare(family(type),saved);return true;});
   }
  });
  owned.addEventListener(`flow-${type}-workspace-save`,event=>{
   event.preventDefault();if(!valid())return;const id=recordId||createId,draft=clone(event.detail);
   void write(async()=>{const accepted=await api.commit(state=>{if(!valid())throw Error('stale owner');const pool=records(state,type),index=pool.findIndex(item=>item.id===id),record={...(index>=0?pool[index]:{}),...draft,id};if(index<0)pool.unshift(record);else pool[index]=record;});if(!valid())return false;if(accepted!==true){owned.error('Не удалось сохранить. Текст и изображения остались в форме.');return false;}
   const resolved=api.resolveId?.(id)||id,saved=records(api.getState(),type).find(item=>String(item.id)===String(resolved));if(!saved)throw Error('missing receipt');recordId=saved.id;
   if(type==='note'){owned.acceptSaved(saved);api.render();api.compare(family(type),saved);api.frame.respond();await close(true);return true;}
   owned.record=saved;owned.mode='read';api.render();api.editingScene(true);api.compare(family(type),owned.record);api.frame.respond();return true;},true);
  });
  owned.addEventListener(`flow-${type}-workspace-delete`,async event=>{
   event.preventDefault();if(!valid()||!recordId)return;const id=recordId;void write(async()=>{if(!await api.confirm('delete',dialog)||!valid())return false;
   const pool=records(api.getState(),type),index=pool.findIndex(item=>item.id===id);if(index<0)throw Error('missing record');const record=clone(pool[index]);
   const accepted=await api.commit(state=>{if(!valid())throw Error('stale owner');const pool=records(state,type),index=pool.findIndex(item=>item.id===id);if(index<0)throw Error('missing record');pool.splice(index,1);state.trash.push({type,record,deleted:Date.now()});});if(!valid())return false;if(accepted!==true){owned.error('Не удалось удалить. Заметка или список остались открыты.');return false;}
   api.deleted({type,record,index});await close(true);api.render();api.frame.respond();return true;});
  });
  api.showWorkspace(dialog);api.compare(family(type),editor.record);return true;
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();void close();});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)void close();});
 const completed=item=>item.subtasks?.length?item.subtasks.every(sub=>sub.done):!!item.done;
 const recordMeta=(type,record)=>type==='list'?`${(record.items||[]).filter(completed).length} из ${(record.items||[]).length}`:(record.topic||'');
 function refreshSummary(type,record){if(!record)return;for(const card of api.screen.querySelectorAll('flow-record-card'))if(card.getAttribute('record-id')===String(record.id))card.setAttribute('meta',recordMeta(type,record));}
 const bookmarkWrites=new WeakSet();
 async function bookmark(type,record,card,event){if(bookmarkWrites.has(card))return;const ownerEpoch=api.ownerEpoch?.(),value=!!event.detail.bookmarked,valid=()=>card.isConnected&&api.screen.contains(card)&&api.ownerEpoch?.()===ownerEpoch;bookmarkWrites.add(card);card.setAttribute('state','loading');try{const accepted=await api.commit(state=>{if(!valid())throw Error('stale owner');const item=records(state,type).find(item=>item.id===record.id);if(!item)throw Error('missing record');item.pinned=value;});if(!valid())return;const saved=records(api.getState(),type).find(item=>String(item.id)===String(api.resolveId?.(record.id)||record.id));card.toggleAttribute('bookmarked',accepted===true?!!saved?.pinned:!!record.pinned);card.setAttribute('state',accepted===true?'rest':'error');}catch{if(valid()){card.toggleAttribute('bookmarked',!!record.pinned);card.setAttribute('state','error');}}finally{bookmarkWrites.delete(card);}}
 function render(type){
  const container=document.createElement('section');container.className='collection-page';
  const head=document.createElement('header');head.className='collection-head';head.append(api.button('Библиотека',()=>api.navigate('saved')));const title=document.createElement('h2');title.textContent=type==='note'?'Заметки':'Списки';head.append(title,api.button('Добавить',()=>open(type,null,'edit'),'primary'));
  const search=document.createElement('flow-search');search.setAttribute('placeholder',type==='note'?'Найти заметку':'Найти список');search.setAttribute('aria-label','Поиск');
  const list=document.createElement('div');list.className='collection-records';
  function paint(){const query=search.value?.trim().toLocaleLowerCase()||'',pool=records(api.getState(),type).filter(record=>[record.title,record.description].join(' ').toLocaleLowerCase().includes(query));list.replaceChildren();for(const record of pool){const card=document.createElement('flow-record-card');for(const [name,value]of Object.entries({'record-id':record.id,kind:type,title:record.title,meta:recordMeta(type,record)}))card.setAttribute(name,String(value));card.toggleAttribute('bookmarked',!!record.pinned);const image=record.images?.[0];if(typeof image==='string'&&/^data:image\//.test(image))card.setAttribute('thumbnail',image);card.addEventListener('flow-record-open',()=>open(type,records(api.getState(),type).find(item=>item.id===record.id)));card.addEventListener('flow-record-bookmark-change',event=>{void bookmark(type,record,card,event)});list.append(card);}if(!pool.length){const empty=document.createElement('flow-content-state');empty.setAttribute('state','empty');list.append(empty);}}
  search.addEventListener('input',paint);container.append(head,search,list);api.screen.replaceChildren(container);paint();api.restore();api.compare(family(type),records(api.getState(),type)[0]);
 }
 return{open,close,render,get isOpen(){return dialog.open;}};
}
