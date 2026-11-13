/** Local gesture feedback; never delay capture or play decorative audio over recording. */
export function createAssistantFeedback(assistant,reactions,win){
 const doc=win.document,field=doc.createElement('div');field.className='assistant-field';field.setAttribute('aria-hidden','true');assistant._overlay.prepend(field);
 const sheet=new CSSStyleSheet();sheet.replaceSync(`
 .assistant-field{position:absolute;inset:10% -18% -22%;pointer-events:none;background:radial-gradient(ellipse at 50% 74%,color-mix(in srgb,var(--fu-accent) 22%,transparent),transparent 62%);opacity:.12;transform-origin:50% 80%;transition:opacity 120ms linear;contain:paint}
 .phone[data-reaction=listening] .mic,.phone[data-reaction=requesting] .mic{border-color:color-mix(in srgb,var(--fu-accent) 80%,transparent);background:color-mix(in srgb,var(--fu-accent) 19%,var(--glass-fill));box-shadow:0 0 24px color-mix(in srgb,var(--fu-accent) 14%,transparent)}
 .phone .mic{touch-action:none;transition:transform 100ms cubic-bezier(.2,0,0,1),background-color 140ms,border-color 140ms}
 .phone .mic[aria-pressed=true]{transform:scale(.93)}
 .phone .star-core{border:0!important;background:none!important;box-shadow:none!important;filter:none!important;overflow:visible}
 .phone .s26-live-star{border:0!important;background:none!important;box-shadow:none!important;filter:none!important;border-radius:50%;mask-image:radial-gradient(ellipse,#000 52%,transparent 75%)}
 .phone[data-s26-answer=true] .halo{display:none}
 .phone[data-motion-off=true] .mic,.phone[data-motion-off=true] .assistant-field{transition:none;transform:none}
 `);assistant.shadowRoot.adoptedStyleSheets=[...assistant.shadowRoot.adoptedStyleSheets,sheet];
 let ambient=null,lastPhase='idle',lastError='',disposed=false;
 const quiet=()=>assistant.quiet()||doc.hidden;
 function haptic(kind){
  if(disposed||doc.hidden||!assistant.isOpen)return;
  try{if(typeof win.SorokaAndroid?.assistantHaptic==='function'){win.SorokaAndroid.assistantHaptic(kind);return;}
   const tg=win.Telegram?.WebApp?.HapticFeedback;if(tg){if(kind==='success'||kind==='error')tg.notificationOccurred(kind);else tg.impactOccurred(kind==='press'?'medium':'light');return;}
   win.navigator.vibrate?.(kind==='success'?[12,30,9]:kind==='error'?[15,35,15]:kind==='press'?16:8);
  }catch{}
 }
 const sound=kind=>{if(!disposed&&!doc.hidden&&win.flowSound?.getState?.().focus!=='recording')win.flowSound?.feedback?.(kind);};
 function stopAmbient(){ambient?.cancel();ambient=null;for(const animation of field.getAnimations())animation.cancel();}
 function phase(value){
  if(value===lastPhase)return;lastPhase=value;assistant._phone.dataset.reaction=value;stopAmbient();
  const live=['listening','requesting','thinking'].includes(value);field.style.opacity=live?'.62':'.14';
  if(live&&!quiet())ambient=field.animate([{transform:'scale(.96) translateY(1%)'},{transform:'scale(1.06) translateY(-1%)'},{transform:'scale(.96) translateY(1%)'}],{duration:value==='thinking'?2600:1800,iterations:Infinity,easing:'ease-in-out'});
 }
 function pulse(){if(quiet())return;field.animate([{opacity:.7,transform:'scale(.98)'},{opacity:.16,transform:'scale(1.08)'}],{duration:520,easing:'cubic-bezier(.2,0,0,1)'});}
 const press=()=>{haptic('press');reactions.react('press');phase('requesting');};
 const release=e=>{haptic(e.detail.cancelled?'cancel':'release');reactions.react('press');};
 const opened=()=>{haptic('open');sound('open');phase('idle');};
 const closed=()=>{stopAmbient();lastPhase='idle';};
 const submit=()=>sound('send');
 const stage=e=>{const value=e.detail.phase;phase(value);if(value==='response'){haptic('success');sound('reply');pulse();}if(assistant.model.error&&assistant.model.error!==lastError){lastError=assistant.model.error;haptic('error');sound('error');}};
 const voice=e=>{if(assistant.isOpen&&assistant.model.phase==='listening')field.style.opacity=String(.28+Math.max(0,Math.min(1,e.detail?.level||0))*.64);};
 const visibility=()=>{if(doc.hidden)stopAmbient();};
 const motion=()=>{if(quiet())stopAmbient();};
 assistant.addEventListener('flow-assistant-voice-start',press,true);assistant.addEventListener('flow-assistant-voice-stop',release,true);assistant.addEventListener('flow-assistant-open',opened);assistant.addEventListener('flow-assistant-close',closed);assistant.addEventListener('flow-assistant-submit',submit,true);assistant.addEventListener('flow-assistant-stage',stage);doc.addEventListener('flow:voice',voice);doc.addEventListener('visibilitychange',visibility);
 const observer=new MutationObserver(motion);observer.observe(doc.documentElement,{attributes:true,attributeFilter:['data-motion','data-reduce']});
 observer.observe(assistant._phone,{attributes:true,attributeFilter:['data-motion-off']});
 return{getState:()=>({phase:lastPhase,ambient:!!ambient}),dispose(){disposed=true;stopAmbient();observer.disconnect();field.remove();assistant.removeEventListener('flow-assistant-voice-start',press,true);assistant.removeEventListener('flow-assistant-voice-stop',release,true);assistant.removeEventListener('flow-assistant-open',opened);assistant.removeEventListener('flow-assistant-close',closed);assistant.removeEventListener('flow-assistant-submit',submit,true);assistant.removeEventListener('flow-assistant-stage',stage);doc.removeEventListener('flow:voice',voice);doc.removeEventListener('visibilitychange',visibility);}};
}
