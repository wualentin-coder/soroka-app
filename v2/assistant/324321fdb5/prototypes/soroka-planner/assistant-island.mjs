/** Presentation adapter. AI, WAV capture, attachments and speech keep their existing owners. */
export function createAssistantIsland(a,{owner,star,header,answerBody,attachments,speech,motion}){
 const root=a.shadowRoot,doc=a.ownerDocument,phone=a._phone;
 star.setAttribute('aria-label','Убрать клавиатуру');
 phone.dataset.assistantIsland='true';
 const surface=doc.createElement('div');surface.className='compact-assistant';
 const title=doc.createElement('div');title.className='compact-title';title.textContent='Flow';
 const subtitle=doc.createElement('small');subtitle.textContent='Я рядом';title.append(subtitle);
 const close=doc.createElement('button');close.type='button';close.className='compact-close';close.setAttribute('aria-label','Закрыть ассистента');close.textContent='×';close.onclick=()=>owner.close();
 const tools=root.querySelector('.s26-speech-tools');
 header.classList.add('compact-heading');header.replaceChildren(star,title,close);header.hidden=false;
 if(tools)a._response.append(tools);
 surface.append(header,a._interaction);a._overlay.append(surface);
 const field=doc.createElement('div');field.className='compact-field';a._input.before(field);field.append(a._input);
 const voice=doc.createElement('div');voice.className='compact-voice';voice.hidden=true;voice.setAttribute('aria-live','polite');
 voice.innerHTML='<span class="compact-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="compact-status"></span>';
 field.append(voice);
 const slot=doc.createElement('div');slot.className='compact-action';a._composer.append(slot);const send=a._composer.querySelector('.send');slot.append(a._mic,send);
 const extras=doc.createElement('div');extras.className='compact-extras';
 const bar=root.querySelector('.s26-attachment-bar'),status=root.querySelector('.s26-attachment-status'),attach=root.querySelector('.s26-camera-control');
 a._composer.after(extras);extras.append(bar,status,a._panel);
 attach.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
 attach.setAttribute('aria-label','Добавить фото или файл');
 const copy=doc.createElement('button');copy.type='button';copy.setAttribute('aria-label','Копировать ответ');copy.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/></svg>';
 tools?.append(copy);copy.onclick=async()=>{try{await navigator.clipboard.writeText(lastResponse?.text||answerBody.innerText);status.textContent='Ответ скопирован';}catch{status.textContent='Не удалось скопировать ответ';}};
 let lastResponse=null,lastTranscript='',lastEpoch=null,lastInlineError='',holding=false;
 const phase=()=>a.model.phase||'idle';
 function sync(){
  const p=phase(),recording=holding||['requesting','listening'].includes(p),working=['transcribing','thinking'].includes(p);
  phone.dataset.compactPhase=recording?'listening':p;
  voice.hidden=!recording&&!working;
  voice.querySelector('.compact-status').textContent=recording?(p==='listening'?'Слушаю… отпусти, чтобы отправить':'Включаю микрофон…'):p==='transcribing'?'Распознаю…':'Обдумываю…';
  field.classList.toggle('is-recording',recording||working);
  const hasText=!!a._input.value.trim()||attachments.getState().count>0;
  send.hidden=!hasText||recording||working;a._mic.hidden=false;slot.dataset.send=String(hasText);
  a._input.readOnly=recording||working;
  subtitle.textContent=recording?'Слушаю':working?'Обдумываю':speech.getState().state==='speaking'?'Отвечаю':'Я рядом';
  if(attach.parentElement!==a._composer)a._composer.prepend(attach);
  if(a._composer.hidden)a._composer.hidden=false;
  if(phone.dataset.editing!=='true')phone.dataset.editing='true';
  header.hidden=false;phone.dataset.compactAnswer=String(!!lastResponse);
 }
 // Retain the previous answer during the next utterance, without changing the transport model.
 const render=a.renderModel.bind(a);a.renderModel=()=>{
  const m=a._model;if(lastEpoch!==m.ownerEpoch){lastResponse=null;lastTranscript='';lastEpoch=m.ownerEpoch;}
  if(m.response?.text){lastResponse=m.response;lastTranscript=m.transcript||'';}
  const response=m.response,transcript=m.transcript,error=m.error;
  if(!response&&lastResponse){m.response=lastResponse;m.transcript=lastTranscript;}
  if(lastResponse&&error){status.textContent=error;lastInlineError=error;m.error=null;}
  else if(lastInlineError&&status.textContent===lastInlineError){status.textContent='';lastInlineError='';}
  try{render();if(!response)for(const button of root.querySelectorAll('.response-record'))button.disabled=true;}
  finally{m.response=response;m.transcript=transcript;m.error=error;}
  sync();
 };
 const oldSync=a.syncInput.bind(a);a.syncInput=()=>{oldSync();sync();};
 const hold=a.holdStart.bind(a);a.holdStart=()=>{
  if(!a.model.capabilities?.voice)return hold();
  holding=true;speech.stop();a._input.blur();a.toggleAdd(false);attach.setAttribute('aria-expanded','false');root.querySelector('.s26-attach-menu')?.remove();
  a._mic.focus({preventScroll:true});sync();a.request('flow-assistant-voice-start');
 };
 const end=a.holdEnd.bind(a);a.holdEnd=(...args)=>{holding=false;const result=end(...args);sync();return result;};
 // Text is always present. Focus only on an explicit text request, never after an answer.
 a.toggleText=force=>{if(!a.isOpen||a.closing)return;a._composer.hidden=false;if(force===false)a._input.blur();else if(!a.model.busy)a._input.focus({preventScroll:true});sync();};
 const dismiss=a.dismissMode.bind(a);a.dismissMode=()=>{if(root.querySelector('.s26-attach-menu')||!a._panel.hidden)return dismiss();if(root.activeElement===a._input){a._input.blur();return true;}return false;};
 a.resizeInput=()=>{a._input.style.height='44px';a._input.style.maxHeight='44px';};
 let surfaceMotion=null;
 const animateSurface=(closing=false)=>{surfaceMotion?.cancel();surfaceMotion=null;if(a.quiet()||doc.hidden)return;surfaceMotion=surface.animate(closing?[{opacity:1,translate:'0 0'},{opacity:0,translate:'0 16px'}]:[{opacity:0,translate:'0 16px'},{opacity:1,translate:'0 0'}],{duration:closing?240:360,easing:'cubic-bezier(.22,.75,.2,1)',fill:'both'});};
 const open=a.open.bind(a);a.open=options=>{position();return open(options);};
 const closeAssistant=a.close.bind(a);a.close=(immediate=false)=>{if(a.isOpen&&!a.closing&&!(doc.hidden&&attachments.getState().picking)&&!immediate)animateSurface(true);return closeAssistant(immediate);};
 a.addEventListener('flow-assistant-open',()=>{holding=false;sync();layout();animateSurface();});
 a.addEventListener('flow-assistant-close',()=>{holding=false;lastResponse=null;});
 a.addEventListener('flow-assistant-stage',sync);a.addEventListener('flow-assistant-attachments',sync);
 doc.addEventListener('flow:assistantphase',()=>{if(a.isOpen)sync();});
 doc.addEventListener('flow:voice',event=>{const n=Math.max(0,Math.min(1,Number(event.detail?.level)||0));phone.style.setProperty('--compact-level',String(n));});
 const sheet=new CSSStyleSheet();sheet.replaceSync(styles);root.adoptedStyleSheets=[...root.adoptedStyleSheets,sheet];
 function position(){
  const css=getComputedStyle(doc.documentElement),camera=doc.documentElement.dataset.nativeCamera==='true'&&doc.documentElement.dataset.nativeCameraEdge==='top';
  const popup=doc.documentElement.dataset.assistantPopup==='true';
  const top=popup&&camera?(parseFloat(css.getPropertyValue('--native-camera-center-y'))||21)+25:12;
  const keyboard=a.bounds?.keyboardInset||0,view=Math.max(160,(a.bounds?.height||innerHeight)-keyboard);
  surface.dataset.placement=popup?'camera':'bottom';
  surface.style.setProperty('--compact-top',top+'px');surface.style.setProperty('--compact-bottom',(keyboard+12)+'px');surface.style.setProperty('--compact-height',Math.max(120,view-top-12)+'px');
  return {top,view};
 }
 function layout(){
  if(!a.isOpen||a.closing)return;
  const {top,view}=position();
  const settings=root.querySelector('.s26-voice-settings'),settingsHeight=settings&&!settings.hidden?settings.getBoundingClientRect().height:0;
  const reserved=48+8+50+24+16+(lastResponse?44:0)+extras.getBoundingClientRect().height+settingsHeight;
  surface.style.setProperty('--compact-answer-space',Math.max(40,view-top-12-reserved)+'px');
  sync();
 }
 sync();return{layout};
}

const styles=`
:host{width:100%!important;max-width:none!important;pointer-events:auto}
.phone[data-assistant-island] .assistant{background:color-mix(in srgb,var(--fu-bg) 38%,transparent)!important;backdrop-filter:blur(5px);border:0!important}
.phone[data-assistant-island] .assistant-field,.phone[data-assistant-island] .sky,.phone[data-assistant-island] .edge{display:none!important}
.compact-assistant{position:absolute;bottom:var(--compact-bottom,12px);left:50%;transform:translateX(-50%);width:min(400px,calc(100% - 16px));max-height:var(--compact-height,80vh);overflow:visible;overscroll-behavior:contain;background:color-mix(in srgb,var(--fu-bg) 96%,var(--fu-text) 4%);border:1px solid var(--fu-line);border-radius:26px;padding:12px;box-sizing:border-box;box-shadow:0 12px 48px color-mix(in srgb,var(--fu-bg) 48%,transparent)}
.compact-assistant[data-placement=camera]{top:var(--compact-top,12px);bottom:auto}
.compact-assistant[data-placement=bottom] .compact-extras{order:1}
.phone[data-assistant-island] .compact-assistant[data-placement=bottom] .composer{order:2!important}
.phone[data-assistant-island] .compact-heading{display:flex!important;align-items:center;gap:8px;margin:0 0 8px;padding:0;height:48px;position:relative}
.phone[data-assistant-island] .star-zone{position:relative!important;inset:auto!important;transform:none!important;translate:none!important;width:44px!important;height:44px!important;flex:none;pointer-events:auto}
.phone[data-assistant-island] .s26-live-star{width:104px!important;height:88px!important}
.compact-title{flex:1;font:22px/1.1 var(--fu-font);color:var(--fu-text)}.compact-title small{display:block;font:11px/1.5 var(--fu-font);color:var(--fu-muted);margin-top:3px}
.compact-close{width:44px;height:44px;flex:none;border:0;border-radius:50%;background:none;color:var(--fu-muted);font:24px var(--fu-font)}
.phone[data-assistant-island] .interaction{position:relative!important;inset:auto!important;transform:none!important;translate:none!important;width:auto!important;max-width:none!important;max-height:calc(var(--compact-height,80vh) - 82px);overflow:auto;display:flex!important;flex-direction:column;gap:8px;opacity:1!important;padding:0!important;margin:0!important}
.phone[data-assistant-island] .interaction:before{display:none!important}
.phone[data-assistant-island] .response{display:block!important;position:relative!important;inset:auto!important;order:0!important;width:auto!important;height:auto!important;max-height:none!important;padding:0!important;margin:0!important;background:none!important;border:0!important;box-shadow:none!important;overflow:visible!important}
.phone[data-assistant-island] .s26-answer-body{display:block!important;max-height:min(260px,35vh,var(--compact-answer-space,260px))!important;min-height:40px;overflow:auto;padding:0 7px 4px!important;margin:0!important}
.phone[data-assistant-island] .answer{font:13px/1.65 var(--fu-font)!important;color:var(--fu-text);text-align:left;overflow-wrap:anywhere;white-space:normal}
.phone[data-assistant-island] .phase-label{font:11px/1.5 var(--fu-font);margin:0 0 4px}.phone[data-assistant-island] .phase-label:empty{display:none}
.phone[data-assistant-island] .s26-speech-tools{display:flex;position:relative!important;inset:auto!important;gap:0;margin:0;padding:0;min-height:44px;flex-wrap:wrap}
.phone[data-assistant-island] .s26-speech-tools button{width:44px;height:44px;flex:none;margin:0;padding:12px;background:none;border:0;color:var(--fu-muted);border-radius:12px}.s26-speech-tools svg{width:20px;height:20px}
.phone[data-assistant-island] .s26-voice-hint{flex:1;min-width:40px;max-width:100%;height:44px;line-height:44px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}
.phone[data-compact-answer=false] .s26-speech-tools{display:none!important}
.phone[data-assistant-island] .controls{display:none!important}
.phone[data-assistant-island] .composer{position:relative!important;inset:auto!important;display:flex!important;align-items:center!important;gap:0!important;order:1!important;flex:none;width:100%!important;min-height:50px!important;margin:0!important;padding:2px!important;border:1px solid var(--fu-line)!important;border-radius:18px!important;background:color-mix(in srgb,var(--fu-text) 3%,transparent)!important;box-sizing:border-box;transform:none!important}
.phone[data-assistant-island] .composer:focus-within{border-color:var(--fu-accent)!important}
.compact-field{flex:1;min-width:0;position:relative;height:44px}
.phone[data-assistant-island] .composer textarea{display:block!important;width:100%!important;height:44px!important;min-height:44px!important;max-height:44px!important;margin:0!important;padding:11px 4px!important;box-sizing:border-box;resize:none;font:13px/22px var(--fu-font)!important;background:none!important;border:0!important;}
.phone[data-assistant-island] .composer .control,.phone[data-assistant-island] .composer .send{width:44px!important;height:44px!important;min-height:44px!important;margin:0!important;padding:12px!important;border:0!important;box-shadow:none!important;border-radius:14px!important;flex:none;transform:none!important;background:none!important;color:var(--fu-muted)!important}
.phone[data-assistant-island] .composer .send{color:var(--fu-accent)!important;background:color-mix(in srgb,var(--fu-accent) 10%,transparent)!important}
.phone[data-assistant-island] .composer svg{width:20px!important;height:20px!important}
.compact-action{position:relative;flex:none;width:44px;height:44px}.compact-action[data-send=true]{width:88px}.compact-action button{position:absolute;top:0;right:0}.compact-action .send{left:0;right:auto}.compact-action button[hidden]{display:none!important}
.compact-extras{order:2;display:flex;flex-direction:column;gap:6px;min-width:0}.compact-extras:empty{display:none}
.phone[data-assistant-island] .s26-attachment-bar{display:flex;flex-direction:column;align-items:stretch;gap:6px}
.phone[data-assistant-island] .s26-attachment-bar:has(.s26-attach-menu){display:flex!important}
.phone[data-assistant-island] .s26-attach-menu{display:flex!important;gap:8px;position:static!important;pointer-events:auto;order:-1;padding:0 4px;border-bottom:1px solid var(--fu-line)}
.phone[data-assistant-island] .s26-attach-menu button{display:flex!important;align-items:center;gap:8px;flex:1;width:auto;min-height:44px;font:12px var(--fu-font);color:var(--fu-muted);border:0;background:none;border-radius:10px;padding:0 8px}
.phone[data-assistant-island] .s26-attachments{width:100%}.phone[data-assistant-island] .s26-attachment-status{padding:0 7px}.phone[data-assistant-island] .s26-attachment-status:empty{display:none}
.phone[data-assistant-island] .add-panel{position:static!important;max-height:160px;overflow:auto}
.compact-voice{position:absolute;inset:0;display:flex;align-items:center;gap:7px;pointer-events:none;color:var(--fu-accent);font:11px var(--fu-font)}.compact-voice[hidden]{display:none}.compact-status{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.is-recording textarea{visibility:hidden}
.compact-bars{display:flex;align-items:center;gap:2px;height:24px;flex:none}.compact-bars i{width:2px;height:calc(3px + var(--compact-level,0)*20px);border-radius:3px;background:currentColor;transition:height 80ms}.compact-bars i:nth-child(2n){height:calc(3px + var(--compact-level,0)*12px)}
.phone[data-compact-phase=listening] .mic{color:var(--fu-accent)!important;background:color-mix(in srgb,var(--fu-accent) 12%,transparent)!important}
.phone[data-compact-phase=thinking] .compact-bars,.phone[data-compact-phase=transcribing] .compact-bars{animation:compact-think 1s ease-in-out infinite alternate}
@keyframes compact-think{to{opacity:.3}}@media(prefers-reduced-motion:reduce){.compact-bars{animation:none!important}.compact-bars i{transition:none}}
.phone[data-motion-off=true] .compact-bars{animation:none!important}.phone[data-assistant-island] button:focus-visible{outline:2px solid var(--fu-accent);outline-offset:-2px}
`;
