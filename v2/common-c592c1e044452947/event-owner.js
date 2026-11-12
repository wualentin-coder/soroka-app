import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/event-editor.js';
export function eventOwner(api){
 const dialog=document.createElement('dialog'),editor=document.createElement('flow-event-editor');dialog.id='event-workspace';dialog.setAttribute('aria-label','Событие');dialog.append(editor);document.body.append(dialog);let editing=null,createId=null,generation=0,ownedEpoch,pending=null;
 const valid=(token,epoch)=>dialog.open&&editor.isConnected&&token===generation&&epoch===api.ownerEpoch?.();
 async function close(force=false){if(!dialog.open)return true;const token=generation,epoch=ownedEpoch;if(!force&&pending){await pending.promise;return !dialog.open;}if(!force&&editor.dirty&&!await api.confirm('discard',dialog)){if(valid(token,epoch))api.frame.respond('cancel');return false;}if(!valid(token,epoch)&&!force)return false;if(token!==generation)return false;dialog.close();generation++;editing=null;createId=null;pending=null;api.editingScene(false);return true;}
 async function open(record,meta={}){if(!await api.beforeOpen()||!await close()||meta.isCurrent&&!meta.isCurrent())return false;generation++;ownedEpoch=api.ownerEpoch?.();pending=null;editing=record?.id??null;createId=crypto.randomUUID();editor.projects=api.getState().projects;editor.record=structuredClone(record||{title:'',due:api.selected(),time:'',description:'',repeat:'none'});editor.pending=false;editor.inert=false;editor.removeAttribute('aria-busy');api.showWorkspace(dialog);api.compare('W06',editor.record);return true;}
 function write(action){const token=generation,epoch=ownedEpoch;if(pending||!valid(token,epoch))return;const current=()=>valid(token,epoch),job={promise:null};pending=job;editor.pending=true;editor.inert=true;editor.setAttribute('aria-busy','true');job.promise=(async()=>{try{return await action(current);}catch{if(current())editor.error('Не удалось сохранить. Правки остались в форме.');return false;}finally{if(token===generation&&epoch===ownedEpoch){editor.pending=false;editor.inert=false;editor.removeAttribute('aria-busy');}if(pending===job)pending=null;}})();return job.promise;}
 editor.addEventListener('flow-event-change',()=>api.frame.respond());editor.addEventListener('flow-event-close',event=>{event.preventDefault();void close();});dialog.addEventListener('cancel',event=>{event.preventDefault();void close();});
 editor.addEventListener('flow-event-save',event=>{event.preventDefault();const draft=structuredClone(event.detail.draft),id=editing||createId,wasEditing=editing!=null;
  void write(async current=>{if(wasEditing&&!api.getState().events.some(row=>String(row.id)===String(id))){editor.error('Событие больше не существует. Черновик остался здесь.');return false;}
   const accepted=await api.commit(state=>{if(!current())throw Error('stale owner');const at=state.events.findIndex(row=>String(row.id)===String(id));if(wasEditing&&at<0)throw Error('missing record');const value={...(at<0?{}:state.events[at]),...draft,id};if(at<0)state.events.push(value);else state.events[at]=value;});
   if(!current())return false;if(accepted!==true){editor.error('Не удалось сохранить. Правки остались в форме.');return false;}
   const resolved=api.resolveId?.(id)||id,canonical=api.getState().events.find(row=>String(row.id)===String(resolved));if(!canonical)throw Error('missing receipt');api.compare('W06',canonical);await close(true);api.render();api.outcome();return true;
  });
 });
 editor.addEventListener('flow-event-delete',event=>{event.preventDefault();const id=editing;if(!id)return;
  void write(async current=>{if(!await api.confirm('delete',dialog)||!current())return false;const record=api.getState().events.find(row=>String(row.id)===String(id));if(!record){editor.error('Событие уже удалено.');return false;}const index=api.getState().events.indexOf(record),removed=structuredClone(record);
   const accepted=await api.commit(state=>{if(!current())throw Error('stale owner');const at=state.events.findIndex(row=>String(row.id)===String(id));if(at<0)throw Error('missing record');state.events.splice(at,1);state.trash.push({type:'event',record:removed,index,deleted:Date.now()});});
   if(!current())return false;if(accepted!==true){editor.error('Удаление не сохранено.');return false;}api.deleted({type:'event',record:removed,index});await close(true);api.render();api.outcome();return true;
  });
 });
 return{open,close,guard:close,get isOpen(){return dialog.open;}};
}
