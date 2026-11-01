// Подключения расширения живут отдельно от ключей телефона и хранилища.
function enBrowserOpen(){
 const sheet={kind:'en-browser',justRendered:false,items:[],loading:true,busy:false,error:''};
 ui.sheet=sheet;render();
 enBrowserCall('browserdevices').then(result=>{if(ui.sheet!==sheet)return;sheet.items=(result.items||[]).filter(x=>!x.revokedAt&&(!x.expiresAt||Date.parse(x.expiresAt)>Date.now()));})
  .catch(error=>{if(ui.sheet===sheet)sheet.error=error.message;})
  .finally(()=>{if(ui.sheet===sheet){sheet.loading=false;sheet.justRendered=true;render();}});
}
async function enBrowserCall(op,args={}){const result=await enCall(op,args);if(!result||result.error)throw new Error(result?.message||'Не получилось связаться с Flow. Повтори попытку.');return result;}
function renderEnBrowserSheet(){
 const s=ui.sheet,disabled=s.busy||s.loading?' disabled':'';
 const until=s.expiresAt?new Date(s.expiresAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):'';
 const code=s.code?`<label class="field en-browser-code">Одноразовый код<input id="en-browser-code" readonly value="${esc(s.code)}" aria-label="Код подключения расширения"></label><div class="en-browser-row"><small>Действует до ${esc(until)}</small><button type="button" class="ghost-button" data-action="en-browser-copy">${icon('copy','icon-sm')}Копировать</button></div>`:'';
 const devices=s.items.map(x=>`<div class="en-browser-device"><div><b>${esc(x.name)}</b><small>${x.lastSeen?'Последний вход: '+esc(new Date(x.lastSeen).toLocaleDateString('ru-RU')):'Ещё не использовалось'}</small></div><button type="button" class="ghost-button" data-action="en-browser-revoke" data-id="${esc(x.id)}"${disabled}>Отключить</button></div>`).join('');
 return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet en-browser-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Расширение Chrome</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon('close')}</button></div><p class="section-note">Выделяй слова на сайтах и добавляй видео с YouTube в музыку Flow.</p><div class="en-browser-connect"><p>Открой расширение в Chrome и введи код подключения.</p>${code}<button type="button" class="primary-button" data-action="en-browser-code"${disabled}>${s.busy==='code'?'Создаю код…':s.code?'Новый код':'Создать код'}</button><small>Код действует 10 минут, используется один раз.</small></div>${s.error?`<p class="en-browser-error" role="alert">${esc(s.error)}</p>${s.loading?'':`<button class="ghost-button" type="button" data-action="en-browser-open">Повторить</button>`}`:''}<h3>Подключённые браузеры</h3>${s.loading?'<p class="section-note" role="status">Загружаю подключения…</p>':devices||'<p class="section-note">Пока нет подключений.</p>'}<p class="section-note">Расширению доступны только слова и добавление музыки. Здесь можно отключить его доступ.</p></section></div>`;
}
function enBrowserAction(action,control){
 if(!action.startsWith('en-browser-'))return false;
 if(action==='en-browser-open'){enBrowserOpen();return true;}
 const s=ui.sheet;if(s?.kind!=='en-browser')return true;
 if(action==='en-browser-copy'){
  if(s.code)Promise.resolve().then(()=>navigator.clipboard.writeText(s.code)).then(()=>toast('Код скопирован')).catch(()=>{document.getElementById('en-browser-code')?.select();toast('Выделил код — скопируй его');});
  return true;
 }
 if(s.busy||s.loading)return true;
 const op=action==='en-browser-code'?'browserpair':action==='en-browser-revoke'?'browserrevoke':null;if(!op)return true;
 const id=control?.dataset?.id;s.busy=op==='browserpair'?'code':id;s.error='';s.justRendered=true;render();
 enBrowserCall(op,op==='browserrevoke'?{id}:{}).then(result=>{
  if(ui.sheet!==s)return;
  if(op==='browserpair'){
   if(!/^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2}$/.test(result.code)||!Number.isFinite(Date.parse(result.expiresAt)))throw new Error('Не удалось получить код. Повтори попытку.');
   s.code=result.code;s.expiresAt=result.expiresAt;
  }else{if(result.ok!==true)throw new Error('Не удалось отключить расширение.');s.items=s.items.filter(x=>x.id!==id);}
 }).catch(error=>{if(ui.sheet===s)s.error=error.message;}).finally(()=>{if(ui.sheet===s){s.busy=false;s.justRendered=true;render();}});
 return true;
}
