/* One Flow assistant, hosted by the existing app. External camera popups are paused. */
(()=>{
 'use strict';
 const popup=()=>window.SorokaAndroid?.assistantPopup?.()===true;
 const base=new URL('.',document.currentScript.src);let instance=null,pending=null,error=null;
 const load=import(new URL("assistant/c82704c9ac/prototypes/soroka-planner/assistant-app.mjs",base).href).then(module=>{instance=module.createAppAssistant();if(pending){const request=pending;pending=null;void instance.open(...request);}window.dispatchEvent(new Event('flow:assistantready'));return instance;}).catch(problem=>{error=problem;pending=null;console.error('Flow assistant failed to load');if(typeof toast==='function')toast('Ассистент не загрузился. Обнови приложение.');});
 const open=(...args)=>{if(popup()){window.SorokaAndroid?.assistantPopupClose?.();return false;}if(error)return false;if(instance){void instance.open(...args);return true;}pending=args;return true;};
 window.flowAssistant={open,openNote:session=>{if(instance)return instance.openNote(session);if(typeof toast==='function')toast('Дождись загрузки ассистента.');return false;},close:()=>{pending=null;return instance?.close();},dismiss:()=>{pending=null;return instance?.dismiss();},stop:()=>{pending=null;instance?.stop();},getState:()=>instance?.getState()||{open:!!pending,disabled:popup(),state:error?'error':'loading',microphone:false},ready:()=>load};
 document.documentElement.dataset.flowAssistant='app';
 let launcherSerial=0;
 function bindLaunchers(){
  for(const button of document.querySelectorAll('.fab:not([data-flow-assistant])')){
   button.dataset.flowAssistant='true';button.removeAttribute('data-action');button.classList.add('assistant-fab');button.type='button';button.setAttribute('aria-label','Открыть ассистента Flow');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
   const id='flow-launcher-'+(++launcherSerial);button.innerHTML='<span class="af-fab-orbit"></span><span class="af-fab-orbit af-fab-orbit-second"></span><span class="af-fab-halo"></span><svg viewBox="0 0 128 128" aria-hidden="true"><defs><radialGradient id="'+id+'" cx="46%" cy="42%" r="64%"><stop stop-color="var(--energy-hot,#fff3da)"/><stop offset=".6" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent-strong,var(--accent))"/></radialGradient></defs><path d="M64 12C67.25 47 76 60.75 116 64C76 67.25 67.25 76 64 116C60.75 76 52 67.25 12 64C52 60.75 60.75 47 64 12Z" fill="url(#'+id+')"/></svg>';
   button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();open(button);});
  }
 }
 bindLaunchers();new MutationObserver(bindLaunchers).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
 document.addEventListener('flow:assistantphase',event=>{for(const button of document.querySelectorAll('.assistant-fab'))button.setAttribute('aria-expanded',String(!!event.detail.open));document.body.classList.toggle('assistant-active',!!event.detail.open);});

 if(popup())window.SorokaAndroid?.assistantPopupClose?.();
})();
