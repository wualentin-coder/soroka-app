/* Shared entry presentation. Native form values, validation and save owners remain intact. */
(()=>{
 'use strict';
 if(document.documentElement.dataset.flowDesign==='classic'||window.flowEntryUI)return;
 const parse=html=>{const t=document.createElement('template');t.innerHTML=html;return t;};
 const native=window.entrySheet;
 if(typeof native==='function')window.entrySheet=function(...args){
  const t=parse(native.apply(this,args)),sheet=t.content.querySelector('.sheet'),form=sheet?.querySelector('#entry-form');
  if(!sheet)return t.innerHTML;
  sheet.classList.add('df-entry-sheet');if(!form)return t.innerHTML;
  const editing=Boolean(ui.sheet.id&&record(ui.sheet.type,ui.sheet.id)),task=sheet.classList.contains('dm-task-add');
  sheet.dataset.entryEditing=String(editing);
  sheet.setAttribute('aria-label',(editing?'Изменить ':'Добавить ')+({event:'событие',note:'заметку',task:'задачу'}[ui.sheet.type]||'запись'));sheet.removeAttribute('aria-labelledby');
  sheet.querySelector(':scope>.sheet-head')?.remove();sheet.querySelector(':scope>.sheet-handle')?.remove();
  const title=form.querySelector('[name=title]');
  if(title?.tagName==='INPUT'){
   const textarea=document.createElement('textarea');for(const attr of title.attributes)if(!['type','value'].includes(attr.name))textarea.setAttribute(attr.name,attr.value);
   textarea.rows=1;textarea.textContent=title.value;textarea.setAttribute('aria-label','Название '+(ui.sheet.type==='event'?'события':'записи'));
   const frame=document.createElement('div');frame.className='df-entry-title';frame.append(textarea);title.closest('label')?.replaceWith(frame);
  }
  if(task){
   form.querySelector('.dm-task-add-star')?.remove();
   const send=form.querySelector('.dm-task-add-field>button[type=submit]');
   let footer=form.querySelector('.dm-plan-edit-actions');
   if(editing){send?.remove();form.querySelectorAll('[data-action=task-mode]').forEach(n=>n.remove());}
   else if(send){footer=document.createElement('footer');footer.className='df-entry-actions';send.className='primary-button';send.textContent='Добавить';footer.append(send);form.append(footer);}
   footer?.classList.add('df-entry-actions');
   const tools=form.querySelector('.dm-task-add-actions');if(tools)tools.style.setProperty('--df-entry-tools',String(tools.children.length));
  }else{
   form.querySelectorAll('.dm-entry-options').forEach(n=>n.removeAttribute('open'));
   const footer=form.querySelector('.sheet-actions');footer?.classList.add('df-entry-actions');
   if(editing){footer?.querySelector('[data-action=close-sheet]')?.remove();const del=footer?.querySelector('[data-action=delete-record]');if(del){del.classList.remove('icon-button');del.innerHTML=icon('trash','icon-sm')+'<span>Удалить</span>';}}
  }
  return t.innerHTML;
 };
 function sizeTitle(){const field=document.querySelector('.df-entry-sheet #entry-form [name=title]');if(!field||field.tagName!=='TEXTAREA')return;field.style.height='auto';const ceiling=Math.max(88,Math.min(innerHeight*.5,(visualViewport?.height||innerHeight)*.5));field.style.height=Math.max(48,Math.min(field.scrollHeight,ceiling))+'px';field.style.overflowY=field.scrollHeight>ceiling+1?'auto':'hidden';}
 const renderNative=window.render;window.render=function(...args){const result=renderNative.apply(this,args);sizeTitle();if(discard&&sheetOwner(activeSheet())!==discardOwner)cancelDiscard?.();return result;};
 document.addEventListener('input',event=>{if(event.target.matches('.df-entry-sheet [name=title]'))sizeTitle();});window.addEventListener('resize',sizeTitle);window.visualViewport?.addEventListener('resize',sizeTitle);
 let discard=null,cancelDiscard=null,discardOwner=null;
 window.addEventListener('keydown',event=>{if(!discard)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancelDiscard?.();}else if(event.key==='Tab'){const buttons=[...discard.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);event.preventDefault();event.stopImmediatePropagation();buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();}},true);
 const confirmNative=window.confirmSheetDiscard;
 if(typeof confirmNative==='function')window.confirmSheetDiscard=function(node=activeSheet()){
  if(!node?.classList.contains('df-entry-sheet')||!sheetHasChanges(node))return confirmNative(node);
  const owner=sheetOwner(node);if(!owner||sheetDiscardApproved.has(owner))return true;if(discard)return false;
  const opener=document.activeElement,dialog=document.createElement('dialog');dialog.className='df-entry-discard';dialog.setAttribute('aria-labelledby','df-entry-discard-title');dialog.innerHTML='<h2 id="df-entry-discard-title">Закрыть без сохранения?</h2><p>Введённые изменения будут потеряны.</p><div><button type="button" class="ghost-button" data-discard="cancel">Продолжить</button><button type="button" class="danger-button" data-discard="yes">Не сохранять</button></div>';document.body.append(dialog);discard=dialog;
  discardOwner=owner;
  function finish(yes){discard=null;cancelDiscard=null;discardOwner=null;dialog.close();dialog.remove();if(yes){sheetDiscardApproved.add(owner);const current=activeSheet();if(sheetOwner(current)===owner)closeActiveSheet(current);}else if(opener?.isConnected)opener.focus({preventScroll:true});}
  cancelDiscard=()=>finish(false);
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});dialog.addEventListener('click',event=>{const button=event.target.closest('[data-discard]');if(button)finish(button.dataset.discard==='yes');else if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)finish(false);}});dialog.showModal();dialog.querySelector('button').focus();return false;
 };
 window.flowEntryUI={resize:sizeTitle};render();
})();
