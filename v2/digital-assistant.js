/* One Flow assistant, hosted by the existing app. External camera popups are paused. */
(()=>{
 'use strict';
 const popup=()=>window.SorokaAndroid?.assistantPopup?.()===true;
 const base=new URL('.',document.currentScript.src);let instance=null,pending=null,error=null;
 const load=import(new URL("assistant/cba2fb2d3c/prototypes/soroka-planner/assistant-app.mjs",base).href).then(module=>{instance=module.createAppAssistant();if(pending){const request=pending;pending=null;void instance.open(...request);}window.dispatchEvent(new Event('flow:assistantready'));return instance;}).catch(problem=>{error=problem;pending=null;console.error('Flow assistant failed to load');if(typeof toast==='function')toast('Ассистент не загрузился. Обнови приложение.');});
 const open=(...args)=>{if(popup()){window.SorokaAndroid?.assistantPopupClose?.();return false;}if(error)return false;if(instance){void instance.open(...args);return true;}pending=args;return true;};
 window.flowAssistant={open,openNote:session=>{if(instance)return instance.openNote(session);if(typeof toast==='function')toast('Дождись загрузки ассистента.');return false;},close:()=>{pending=null;return instance?.close();},dismiss:()=>{pending=null;return instance?.dismiss();},stop:()=>{pending=null;instance?.stop();},getState:()=>instance?.getState()||{open:!!pending,disabled:popup(),state:error?'error':'loading',microphone:false},ready:()=>load};
 document.documentElement.dataset.flowAssistant='app';
 if(popup())window.SorokaAndroid?.assistantPopupClose?.();
})();
