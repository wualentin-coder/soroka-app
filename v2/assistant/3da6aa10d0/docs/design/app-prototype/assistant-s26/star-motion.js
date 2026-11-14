// FLIP the existing star wrapper. Its core remains the only visible mark.
// Measure the core rather than the wrapper: its inset changes with the size.
export function createStarMotion(assistant, star, win) {
  let animation=null, pending=null, lastKey=null, last=null, count=0;
  const doc=win.document;
  star.style.transformOrigin='0 0';
  const read=()=>{
    const box=assistant._star.getBoundingClientRect();
    return {x:box.x,y:box.y,width:box.width,height:box.height};
  };
  const quiet=()=>assistant.quiet()||doc.hidden||win.matchMedia('(prefers-reduced-motion:reduce)').matches;
  function cancel(){
    const previous=animation;animation=null;previous?.cancel();
    star.style.removeProperty('will-change');
  }
  function capture(){
    if(!pending&&assistant.isOpen&&!assistant.closing&&!quiet()){
      const box=read();if(box.width&&box.height)pending=box;
    }
  }
  function settle(before,key){
    const requested=!!pending;pending=null;
    if(key===lastKey&&!requested)return;
    const initial=lastKey===null;lastKey=key;
    if(initial||!assistant.isOpen||assistant.closing||quiet())return cancel();
    // Leave the normal launcher flight alone; a keyboard gesture can interrupt it.
    if(!requested&&!animation&&assistant._star.getAnimations().length)return;
    cancel();
    for(const flight of assistant._star.getAnimations())flight.cancel();
    const target=read(),zone=star.getBoundingClientRect();
    if(!before?.width||!before.height||!target.width||!target.height)return;
    const sx=before.width/target.width,sy=before.height/target.height;
    const dx=before.x-target.x-(sx-1)*(target.x-zone.x);
    const dy=before.y-target.y-(sy-1)*(target.y-zone.y);
    if(Math.abs(dx)<.25&&Math.abs(dy)<.25&&Math.abs(sx-1)<.001&&Math.abs(sy-1)<.001)return;
    const base=win.getComputedStyle(star).transform==='none'?'translate(0px,0px)':win.getComputedStyle(star).transform;
    const frames=[{transform:`translate(${dx}px,${dy}px) ${base} scale(${sx},${sy})`},{transform:base}];
    star.style.willChange='transform';
    const duration=sx>1.05?780:680;
    const current=star.animate(frames,{duration,easing:'cubic-bezier(.42,0,.32,1)'});
    animation=current;count++;last={before,target,frames,duration};
    current.finished.catch(()=>{}).then(()=>{
      if(animation===current){animation=null;star.style.removeProperty('will-change');}
    });
  }
  function stopIfUnavailable(){if(quiet()||!assistant.isOpen||assistant.closing){pending=null;cancel();}}
  const observer=new win.MutationObserver(stopIfUnavailable);
  observer.observe(doc.documentElement,{attributes:true,attributeFilter:['data-motion','data-reduce']});
  observer.observe(assistant._overlay,{attributes:true,attributeFilter:['hidden','inert']});
  const reduced=win.matchMedia('(prefers-reduced-motion:reduce)');
  reduced.addEventListener('change',stopIfUnavailable);
  doc.addEventListener('visibilitychange',stopIfUnavailable);
  return {
    capture,before:()=>pending||read(),settle,cancel,
    get animation(){return animation;},get last(){return last;},get count(){return count;},
    dispose(){cancel();observer.disconnect();reduced.removeEventListener('change',stopIfUnavailable);doc.removeEventListener('visibilitychange',stopIfUnavailable);}
  };
}
