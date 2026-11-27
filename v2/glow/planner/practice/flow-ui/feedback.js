import {sensoryGesture,stopSensory} from './sensory-feedback.js';
export const feedbackSheet=new CSSStyleSheet();feedbackSheet.replaceSync(`
:host,*{scrollbar-width:none}*::-webkit-scrollbar{display:none;width:0;height:0}
:where(.row,.button,.box,.frame,.tabs,.switch,.filters,.filter,.trigger){position:relative;isolation:isolate}
.flow-response{position:absolute;inset:0;z-index:2;border:0;border-radius:inherit;pointer-events:none;opacity:0;background:radial-gradient(ellipse at var(--response-x,50%) var(--response-y,50%),color-mix(in srgb,var(--response-color,var(--fu-accent)) 10%,transparent),transparent 72%)}
.flow-response::after{content:none;position:absolute;left:12px;right:12px;bottom:0;height:1px;background:linear-gradient(90deg,transparent,var(--response-color,var(--fu-accent)) var(--response-x,50%),transparent);box-shadow:0 0 7px color-mix(in srgb,var(--response-color,var(--fu-accent)) 30%,transparent);pointer-events:none}
.flow-response[data-feedback=outline]{border:1px solid var(--response-color,var(--fu-accent));box-shadow:0 0 14px color-mix(in srgb,var(--response-color,var(--fu-accent)) 18%,transparent)}
.flow-response[data-feedback=outline]::after,.flow-response[data-feedback=line]::after{content:''}
.flow-response[data-feedback=line]{border:0;box-shadow:none;background:none}
.flow-response[data-feedback=line]::after{left:0;right:0}

`);
const motionPreference=matchMedia('(prefers-reduced-motion:reduce)'),active=new Map(),moving=new Set();
export const motionDisabled=()=>document.documentElement.dataset.reduce==='true'||(document.documentElement.dataset.motion!=='on'&&motionPreference.matches);
const reduced=motionDisabled;
const quiet=()=>{if(reduced()||document.hidden){for(const host of active.keys())stopFeedback(host);for(const animation of moving)animation.cancel();moving.clear();}};
new MutationObserver(quiet).observe(document.documentElement,{attributes:true,attributeFilter:['data-reduce','data-motion']});
motionPreference.addEventListener('change',quiet);document.addEventListener('visibilitychange',quiet);
function visibleColor(color){if(color==='transparent')return false;if(/^(rgba|hsla)\(/.test(color)||color.includes('/')){const alpha=color.match(/(?:,|\/)\s*([^,\/\s]+)\s*\)$/);if(alpha)return parseFloat(alpha[1])>0;}return true;}
export function bindFeedback(host,selector){
 host._flowFeedbackTarget=event=>host.shadowRoot.querySelector('dialog[open]')||(typeof selector==='function'?selector(event):host.shadowRoot.querySelector(selector));
 const react=event=>{
  if(document.hidden)return;
  if(event.type==='keydown'&&(!['Enter',' '].includes(event.key)||event.repeat))return;
  const path=event.composedPath();if(path.some(n=>n instanceof Element&&(n.disabled||n.getAttribute('aria-disabled')==='true')))return;
  const owners=path.filter(n=>n._flowFeedbackTarget?.(event));
  const owner=owners.find(n=>n._flowFeedbackTarget(event).matches('dialog[open]'))||owners.find(n=>n._flowFeedbackLocal)||owners.at(-1);
  if(owner!==host)return;const target=host._flowFeedbackTarget(event);
  sensoryGesture(host,target,event);
  if(reduced())return;
  pulseFeedback(host,target,{event});
 };
 for(const type of ['pointerdown','keydown','input','change'])host.addEventListener(type,react);
}
export function stopFeedback(host){host._flowResponse?.cancel();host._flowResponse=null;host._flowResponseGeometry?.();host._flowResponseGeometry=null;active.delete(host);stopSensory(host);}
export function trackMotion(animation){moving.add(animation);animation.finished.catch(()=>{}).then(()=>moving.delete(animation));return animation;}

export function pulseFeedback(host,target,{event=null,tone='action'}={}){
 if(target?.isContentEditable||target?.matches('input,textarea,select')||!target?.isConnected||document.hidden||reduced()||!target.getClientRects().length)return;
  let layer=target.querySelector(':scope > .flow-response');
  const start=layer?Number(getComputedStyle(layer).opacity):0;host._flowResponse?.cancel();host._flowResponseGeometry?.();host._flowResponseGeometry=null;
  if(!layer?.isConnected){layer=document.createElement('span');layer.className='flow-response';layer.setAttribute('aria-hidden','true');target.append(layer);}
  // A dialog scrolls its contents, but its visible frame stays in place. Follow the
  // real scrollport during this finite response; release the layer/observers after it.
  let releaseGeometry=null;
  if(target.matches('dialog')){
   const align=()=>{layer.style.inset='auto';layer.style.left=target.scrollLeft+'px';layer.style.top=target.scrollTop+'px';layer.style.width=target.clientWidth+'px';layer.style.height=target.clientHeight+'px';};
   align();target.addEventListener('scroll',align,{passive:true});const observer=new ResizeObserver(align);observer.observe(target);
   releaseGeometry=()=>{target.removeEventListener('scroll',align);observer.disconnect();layer.remove();};host._flowResponseGeometry=releaseGeometry;
  }
  layer.style.setProperty('--response-color',tone==='cancel'?'var(--fu-danger)':'var(--fu-accent)');layer.dataset.tone=tone;
  const css=getComputedStyle(target),widths=['Top','Right','Bottom','Left'].map(side=>parseFloat(css['border'+side+'Width'])||0),rounded=['TopLeft','TopRight','BottomRight','BottomLeft'].every(corner=>parseFloat(css['border'+corner+'Radius'])>0),framed=widths.every(width=>width>0)&&['Top','Right','Bottom','Left'].every(side=>visibleColor(css['border'+side+'Color']));
  const mode=rounded&&framed?'outline':target.matches('.row')||(widths[2]>0&&widths.filter(width=>width>0).length===1)?'line':'wash';layer.dataset.feedback=mode;
  const r=target.getBoundingClientRect();
  if(event?.type==='pointerdown'){layer.style.setProperty('--response-x',Math.max(0,Math.min(100,(event.clientX-r.left)/r.width*100))+'%');layer.style.setProperty('--response-y',Math.max(0,Math.min(100,(event.clientY-r.top)/r.height*100))+'%');}
  const peak=mode==='line'?.65:Math.min(.38,.18+(parseFloat(getComputedStyle(host).getPropertyValue('--fu-glow'))||0));
  host._flowResponse=layer.animate([{opacity:start},{opacity:peak,offset:.24},{opacity:0}],{duration:event?.type==='input'?1000:780,easing:'cubic-bezier(.4,0,.2,1)'});
  const animation=host._flowResponse;active.set(host,animation);animation.finished.catch(()=>{}).then(()=>{if(active.get(host)===animation){active.delete(host);if(releaseGeometry&&host._flowResponseGeometry===releaseGeometry){releaseGeometry();host._flowResponseGeometry=null;}}});
}
