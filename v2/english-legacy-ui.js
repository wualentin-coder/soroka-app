/* Owner-bound presentation only; the session journal owns archive and original data. */
(()=>{
 'use strict';
 let state=null,serial=0,watched=null,release=null;
 const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const count=(value,max)=>Number.isSafeInteger(value)&&value>=0&&value<=max?value:null;
 function watch(host){if(watched===host)return;release?.();release=null;watched=host;state=null;if(typeof host?.subscribeInvalidation==='function')release=host.subscribeInvalidation(()=>{if(watched===host)state=null;});}
 function current(record){
  if(!record||state!==record||window.sorokaEnglishSession!==record.host||window.flowEnglishSession?.legacy!==record.api)return false;
  try{return record.host.isCurrent(record.owner)===true&&record.api.info()?.token===record.token;}catch{return false;}
 }
 function paint(record){if(current(record)&&typeof window.render==='function')window.render();}
 function banner(info){
  const host=window.sorokaEnglishSession;watch(host);
  let owner;try{owner=host?.captureOwner();if(host?.isCurrent?.(owner)!==true)return '';}catch{return '';}
  const api=window.flowEnglishSession?.legacy;
  if(host?.version!==2||owner?.authorized!==true||! /^[a-f0-9]{64}$/.test(owner.scope)||typeof host.isCurrent!=='function'||host.isCurrent(owner)!==true||!api||typeof api.info!=='function'||typeof api.archive!=='function'||typeof api.export!=='function'||!info||['empty','missing'].includes(info.status)||typeof info.token!=='string'||!info.token||info.token.length>256){state=null;return '';}
  if(!state||state.owner!==owner||state.token!==info.token||state.api!==api)state={host,owner,api,token:info.token,view:String(++serial),expanded:false,confirmed:false,busy:false,error:'',success:false};
  const record=state;if(!current(record)){state=null;return '';}
  const entries=count(info.entries,1000),invalid=count(info.invalidEntries,1000),chars=count(info.chars,128*1024);
  const summary=entries!==null&&entries>0?`Записей: ${entries}.`:'На устройстве найдены старые данные.';
  const unsupported=['malformed','unsupported','too_many_entries','oversized'].includes(info.status)?'Формат не удалось полностью проверить. Исходник сохранён.':'';
  const archived=info.archived===true||record.success,canClaim=info.claimable===true&&!archived;
  return `<details class="section-note" data-en-legacy-view="${esc(record.view)}"${record.expanded?' open':''}><summary>Старые ответы на устройстве</summary><p>${esc(summary)}${invalid?esc(` Непроверенных записей: ${invalid}.`):''}${chars!==null?esc(` Размер: ${chars} знаков.`):''}</p><p>Аккаунт этих ответов неизвестен. Подтверждение принадлежности — ваше утверждение, а не проверенное происхождение. Ответы не отправляются автоматически и не засчитываются повторно.</p>${unsupported?`<p>${esc(unsupported)}</p>`:''}${archived?'<p role="status">Копия сохранена для проверки. Исходник оставлен на устройстве.</p>':canClaim?`<label class="section-note"><input type="checkbox" data-en-legacy-confirm${record.confirmed?' checked':''}${record.busy?' disabled':''}> Эти старые ответы принадлежат этому аккаунту</label>`:'<p>Можно сохранить исходник файлом для ручной проверки.</p>'}${record.error?`<p role="alert">${esc(record.error)}</p>`:''}<div><button type="button" class="ghost-button" data-en-legacy-action="archive"${!canClaim||!record.confirmed||record.busy?' disabled':''}>${record.busy?'Сохраняем…':'В архив для проверки'}</button> <button type="button" class="ghost-button" data-en-legacy-action="export"${info.exportable===false||record.busy?' disabled':''}>Экспорт исходника</button> <button type="button" class="ghost-button" data-en-legacy-action="leave"${record.busy?' disabled':''}>Оставить как есть</button></div></details>`;
 }
 function from(node){const root=node?.closest?.('[data-en-legacy-view]'),record=state;return root&&root.isConnected!==false&&record&&root.dataset.enLegacyView===record.view&&current(record)?{record,root}:null;}
 document.addEventListener('toggle',event=>{const match=from(event.target);if(match&&event.target===match.root)match.record.expanded=match.root.open===true;},true);
 document.addEventListener('change',event=>{
  if(!event.target?.matches?.('[data-en-legacy-confirm]'))return;const match=from(event.target);if(!match||match.record.busy)return;
  const {record,root}=match;record.confirmed=event.target.checked===true;record.error='';const button=root.querySelector('[data-en-legacy-action="archive"]');if(button)button.disabled=!record.confirmed||record.api.info()?.claimable!==true||record.api.info()?.archived===true;
 });
 async function archive(record){
  if(!current(record)||record.busy)return;
  if(!record.confirmed){record.error='Подтвердите, что старые ответы принадлежат этому аккаунту.';paint(record);return;}
  const info=record.api.info();if(info?.claimable!==true||info.archived===true)return;
  record.busy=true;record.error='';paint(record);
  try{const result=await record.api.archive({confirmed:true,token:record.token});if(!current(record))return;if(!result||typeof result.archiveId!=='string')throw Error('archive_failed');record.success=true;record.confirmed=false;}
  catch{if(current(record))record.error='Не удалось сохранить архив. Исходник остался на устройстве; его можно экспортировать.';}
  finally{if(current(record)){record.busy=false;paint(record);}}
 }
 function download(record){
  if(!current(record)||record.busy)return;let url=null,anchor=null;
  try{
   const raw=record.api.export({token:record.token});if(!current(record)||raw===null)return;if(typeof raw!=='string')throw Error('bad_export');
   const envelope=JSON.stringify({format:'flow-english-v1-original',version:1,sourceKey:'flow.english.outbox.v1',raw});
   const blob=new Blob([envelope],{type:'application/json;charset=utf-8'});if(!current(record))return;
   url=URL.createObjectURL(blob);if(!current(record))return;
   anchor=document.createElement('a');anchor.href=url;anchor.download='flow-english-old-answers.json';anchor.hidden=true;document.body.appendChild(anchor);if(!current(record))return;anchor.click();record.error='';
  }catch{if(current(record)){record.error='Не удалось экспортировать исходник. Данные остались на устройстве.';paint(record);}}
  finally{anchor?.remove();if(url){const done=url;setTimeout(()=>URL.revokeObjectURL(done),1000);}}
 }
 document.addEventListener('click',event=>{
  const button=event.target?.closest?.('[data-en-legacy-action]');if(!button)return;const match=from(button);if(!match)return;event.preventDefault();if(button.disabled)return;
  const {record}=match;switch(button.dataset.enLegacyAction){case'archive':void archive(record);break;case'export':download(record);break;case'leave':if(!record.busy){record.expanded=false;record.confirmed=false;record.error='';paint(record);}break;}
 });
 window.FlowEnglishLegacyUI=Object.freeze({banner});
})();
