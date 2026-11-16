/* Telegram-style voice lock for the Flow assistant microphone.
   Hold the microphone, slide toward the lock (down, or up when there is no room below) and the recording keeps
   going without the finger; one tap on the microphone then sends the dictation. Works for the in-app assistant
   and the compact camera popup: both use the same element and the same hold/release voice path. */
export function createMicLock(a,{win=window,doc=document}={}){
 const mic=a._mic;if(!mic)return{dispose(){}};
 const events=new AbortController(),signal=events.signal;
 const reduce=win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const accent='var(--accent,#a6e35a)',ink='#ece8e2';
 let locked=false,fromY=0,dir=1,bounce=null;
 const haptic=kind=>{try{win.SorokaAndroid?.assistantHaptic?.(kind);}catch{}};
 const hint=doc.createElement('div');hint.className='flow-mic-lock';hint.setAttribute('aria-hidden','true');
 hint.style.cssText='position:fixed;z-index:2147483000;width:34px;height:64px;border-radius:17px;background:rgba(20,21,25,.94);'+
  `box-shadow:inset 0 0 0 1px color-mix(in srgb,${accent} 28%,transparent),0 10px 24px rgba(0,0,0,.4);display:none;pointer-events:none;transform-origin:50% 50%;`;
 hint.innerHTML=`<svg viewBox="0 0 34 64" width="34" height="64" style="display:block;overflow:visible"><g data-part="lock"><path data-part="shackle" d="M12.4 22v-4.6a4.6 4.6 0 0 1 9.2 0V22" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/><rect data-part="body" x="10" y="21" width="14" height="10" rx="2.5" fill="${ink}"/></g><g data-part="arrow"><path d="M12.5 41.5 17 46l4.5-4.5" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
 doc.body.append(hint);
 const part=name=>hint.querySelector(`[data-part="${name}"]`);
 const holding=()=>!!a._held&&!a._held.locked;
 function place(){
  const r=mic.getBoundingClientRect(),below=win.innerHeight-r.bottom>96;dir=below?1:-1;
  hint.style.left=Math.round(r.left+r.width/2-17)+'px';hint.style.top=Math.round(below?r.bottom+10:r.top-74)+'px';
  // the lock sits on the side nearest the microphone, the arrow points away from it
  part('lock').setAttribute('transform',below?'':'translate(0 26)');
  part('arrow').setAttribute('transform',below?'':'translate(0 -26) rotate(180 17 44)');
 }
 function progress(p){
  part('shackle').setAttribute('transform',`translate(0 ${-4*(1-p)})`);
  part('arrow').style.opacity=String(Math.max(0,1-p*1.6));
  hint.style.transform=`translateY(${dir*12*p}px) scaleY(${1-.25*p})`;
  const done=p>=1;part('body').setAttribute('fill',done?accent:ink);part('shackle').setAttribute('stroke',done?accent:ink);
 }
 function show(){place();progress(0);hint.style.display='block';
  if(reduce)return;
  bounce?.cancel();bounce=part('arrow').animate([{transform:'translateY(-3px)'},{transform:'translateY(3px)'}],{duration:340,direction:'alternate',iterations:Infinity,easing:'ease-in-out',composite:'add'});
  hint.animate([{opacity:0,translate:`0 ${-dir*8}px`},{opacity:1,translate:'0 0'}],{duration:220,easing:'cubic-bezier(.22,1,.36,1)'});
 }
 function hide(click){bounce?.cancel();bounce=null;
  if(!click||reduce){hint.style.display='none';return;}
  hint.animate([{scale:1},{scale:1.18},{scale:.96},{scale:1,opacity:1},{opacity:0}],{duration:620,easing:'cubic-bezier(.22,1,.36,1)'}).finished
   .then(()=>{if(!holding())hint.style.display='none';}).catch(()=>{});
 }
 function mark(){mic.dataset.locked=String(locked);mic.style.boxShadow=locked?`inset 0 0 0 2px ${accent},0 0 18px color-mix(in srgb,${accent} 45%,transparent)`:'';
  mic.setAttribute('aria-label',locked?'Запись закреплена. Нажми, чтобы отправить':'Удерживай, чтобы говорить. Сдвинь к замку — закрепить');}
 mic.addEventListener('pointerdown',event=>{
  if(locked){event.preventDefault();event.stopImmediatePropagation();locked=false;mark();hide(false);haptic('send');a.holdEnd(false,'release');return;}
  fromY=event.clientY;
  // the element marks the hold in its own pointerdown handler, which runs after this capture listener
  win.setTimeout(()=>{if(holding()&&a.model?.capabilities?.voice)show();},0);
 },{capture:true,signal});
 mic.addEventListener('pointermove',event=>{
  if(locked||!holding()||a._held.pointerId!==event.pointerId)return;
  const travel=dir*(event.clientY-fromY);progress(Math.max(0,Math.min(1,travel/48)));
  if(travel<48)return;
  locked=true;a._held={locked:true};progress(1);mark();haptic('listening');hide(true);
  // The finger now lifts away from the microphone: the browser turns that into one click on whatever lies under it,
  // which the assistant would read as a tap outside and close. Swallow exactly that click.
  const swallow=e=>{e.preventDefault();e.stopImmediatePropagation();};
  const disarm=()=>{win.removeEventListener('click',swallow,true);win.removeEventListener('pointerup',later,true);};
  const later=()=>win.setTimeout(disarm,60);
  win.addEventListener('click',swallow,{capture:true,once:true,signal});win.addEventListener('pointerup',later,{capture:true,once:true,signal});
  try{mic.releasePointerCapture(event.pointerId);}catch{}
 },{signal});
 // While locked, losing the finger, capture or focus must not stop the recording.
 const guarded={};
 for(const name of['onlostpointercapture','onblur','onpointercancel']){guarded[name]=mic[name];mic[name]=event=>locked?undefined:guarded[name]?.call(mic,event);}
 const end=a.holdEnd;
 a.holdEnd=(...args)=>{if(locked){locked=false;mark();}hide(false);return end.apply(a,args);};
 return{getState:()=>({locked}),dispose(){events.abort();bounce?.cancel();hint.remove();for(const name in guarded)mic[name]=guarded[name];a.holdEnd=end;locked=false;mark();}};
}
