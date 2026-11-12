(() => {
 'use strict';
 const root=document.documentElement,animations=new Set(),media=matchMedia('(prefers-reduced-motion:reduce)');
 let start=null,drag=null,suppressed=0,observed=null,observedSurface=null,frame=0;
 const particles=new Set(),completionTimers=new Set();
 const moving=()=>!document.hidden&&root.dataset.motion!=='off'&&!(root.dataset.motion!=='on'&&media.matches);
 const card=()=>document.querySelector('.dm-calendar-surface');
 const surface=()=>card()?.closest('.dm-calendar-living')||card();
 function box(node,base){if(!node||!base)return null;const a=node.getBoundingClientRect(),b=base.getBoundingClientRect();return{x:a.x-b.x-base.clientLeft,y:a.y-b.y-base.clientTop,w:a.width,h:a.height};}
 function place(node,value){if(!node||!value)return;node.hidden=false;const values={width:value.w+'px',height:value.h+'px',transform:`translate(${value.x}px,${value.y}px)`};for(const [name,next]of Object.entries(values))if(node.style[name]!==next)node.style[name]=next;}
 function measure(){
  const current=card(),grid=current?.querySelector('.calendar-grid'),tabs=current?.querySelector('.segmented');if(!grid||!tabs)return;
  const host=surface(),gridRect=grid.getBoundingClientRect(),tabsRect=tabs.getBoundingClientRect(),hostRect=host.getBoundingClientRect();
  const gridBase={x:gridRect.x+grid.clientLeft,y:gridRect.y+grid.clientTop},tabsBase={x:tabsRect.x+tabs.clientLeft,y:tabsRect.y+tabs.clientTop};
  const relative=(node,base)=>{if(!node)return null;const a=node.getBoundingClientRect();return{x:a.x-base.x,y:a.y-base.y,w:a.width,h:a.height};};
  const selected=grid.querySelector('.selected'),selection=grid.querySelector('.dm-calendar-selection'),band=grid.querySelector('.dm-calendar-week-band'),point=relative(selected,gridBase);
  const origin={x:gridRect.x-hostRect.x-host.clientLeft,y:gridRect.y-hostRect.y-host.clientTop},gridWidth=grid.clientWidth,indicator=tabs.querySelector('.dm-calendar-view-indicator'),indicatorBox=relative(tabs.querySelector('.active'),tabsBase);
  return{current,grid,tabs,host,selected,selection,band,point,origin,gridWidth,indicator,indicatorBox};
 }
 function align(geometry=measure()){
  if(!geometry)return;const{host,selection,band,point,origin,gridWidth,indicator,indicatorBox}=geometry;
  if(point){place(selection,point);place(band,{x:0,y:point.y,w:gridWidth,h:point.h});for(const [axis,value]of [['x',origin.x+point.x+point.w/2],['y',origin.y+point.y+point.h/2]]){const name='--dm-calendar-'+axis,next=value+'px';if(host.style.getPropertyValue(name)!==next)host.style.setProperty(name,next);}}else{if(selection)selection.hidden=true;if(band)band.hidden=true;}
  place(indicator,indicatorBox);
 }
 function clear(){for(const timer of completionTimers)clearTimeout(timer);completionTimers.clear();for(const animation of animations)animation.cancel();animations.clear();for(const node of particles)node.remove();particles.clear();const current=card();current?.classList.remove('cal-dragging');if(current){current.style.removeProperty('--cal-p');current.querySelector('.calendar-grid')?.style.removeProperty('height');}}
 function animate(node,frames,options={}){if(!node||!moving())return;const animation=node.animate(frames,{duration:460,easing:'cubic-bezier(.19,1,.22,1)',...options});animations.add(animation);animation.finished.catch(()=>{}).finally(()=>{animations.delete(animation);if(!animations.size)align();});return animation;}
 function travel(node,from,to,duration=460){if(!from||!to||!to.w||!to.h)return;animate(node,[{transform:`translate(${from.x}px,${from.y}px) scale(${from.w/to.w},${from.h/to.h})`},{transform:`translate(${to.x}px,${to.y}px) scale(1,1)`}],{duration});}
 function spark(node,complete=false,known){
  const host=known?.host||surface();if(!moving()||!node||!host)return;const r=known?.rect||box(node,host),count=complete?10:6;
  for(let i=0;i<count;i++){const dot=document.createElement('i');dot.className='dm-calendar-spark';dot.setAttribute('aria-hidden','true');dot.style.left=(r.x+r.w/2)+'px';dot.style.top=(r.y+r.h/2)+'px';host.append(dot);particles.add(dot);const angle=i/count*Math.PI*2,distance=complete?24:15,dx=Math.cos(angle)*distance,dy=Math.sin(angle)*distance;const animation=animate(dot,[{transform:'scale(.4)',opacity:0},{transform:`translate(${dx*.35}px,${dy*.35}px) scale(1)`,opacity:.75,offset:.2},{transform:`translate(${dx}px,${dy}px) scale(0)`,opacity:0}],{duration:580+i%3*45,easing:'cubic-bezier(.16,1,.3,1)'});const remove=()=>{particles.delete(dot);dot.remove();};if(animation)animation.finished.catch(()=>{}).finally(remove);else remove();}
 }
 function snapshot(){const current=card(),grid=current?.querySelector('.calendar-grid'),tabs=current?.querySelector('.segmented');if(!current||!grid)return null;const selection=grid.querySelector('.dm-calendar-selection'),indicator=tabs?.querySelector('.dm-calendar-view-indicator'),focus=document.activeElement;return{selection:selection&&!selection.hidden?box(selection,grid):null,indicator:indicator&&!indicator.hidden?box(indicator,tabs):null,focus:current.contains(focus)||focus?.matches('.dm-calendar-toggle')?{calendar:focus===current,date:focus.dataset.date,action:focus.dataset.action,mode:focus.dataset.mode}:null};}
 function change(update,{kind='view',direction=0,cue=false}={}){
  const before=snapshot();clear();update();const geometry=measure();align(geometry);const current=geometry?.current,grid=geometry?.grid;
  if(current&&before){
   // Keep controls in normal flow; only the dates move. Animating the clipped
   // card's height laid out the whole Plan on every frame and each date made
   // another composited layer on a 42-day month.
   const {selection,band,indicator,indicatorBox,gridWidth,point:selectionBox,origin,host,selected}=geometry;
   const bandBox=selectionBox?{x:0,y:selectionBox.y,w:gridWidth,h:selectionBox.h}:null;
   if(kind!=='select')animate(grid,[{opacity:.65,transform:`translate(${direction*12}px,${kind==='view'?5:0}px)`},{opacity:1,transform:'none'}],{duration:300});
   travel(selection,before.selection,selectionBox);travel(band,before.selection?{x:0,y:before.selection.y,w:gridWidth,h:before.selection.h}:null,bandBox);travel(indicator,before.indicator,indicatorBox,360);
   if(kind!=='view'){document.querySelectorAll('.dm-plan-agenda .dm-task-row,.dm-plan-agenda .event-card,.dm-plan-agenda .dm-free-day').forEach((node,index)=>animate(node,[{opacity:0,transform:`translate(${direction*9}px,7px)`},{opacity:1,transform:'translate(0,0)'}],{duration:380,delay:Math.min(index*35,140)}));if(selectionBox)spark(selected,false,{host,rect:{...selectionBox,x:origin.x+selectionBox.x,y:origin.y+selectionBox.y}});}
   if(before.focus){const f=before.focus,target=f.calendar?current:f.date?current.querySelector(`[data-date="${ui.selected}"]`):document.querySelector(`[data-action="${f.action}"]${f.mode?`[data-mode="${f.mode}"]`:''}`);target?.focus({preventScroll:true});}
  }
  if(cue)window.flowDigital?.feedback(kind==='view'?'open':'tap');
  document.dispatchEvent(new CustomEvent('flow:calendarinteraction',{detail:{kind,date:ui.selected,expanded:ui.calendarExpanded}}));observe(false);
 }
 function mode(expanded,cue=true){change(()=>{ui.calendarExpanded=expanded;ui.mode=expanded?'month':'week';ui.calendarAnchor=ui.selected;if(expanded)ui.month=ui.selected.slice(0,7)+'-01';render();},{kind:'view',cue});}
 function period(direction){change(()=>{const date=parseDate(ui.selected||todayIso());if(ui.calendarExpanded){const next=new Date(parseDate(ui.month).getFullYear(),parseDate(ui.month).getMonth()+direction,1,12),day=Math.min(date.getDate(),new Date(next.getFullYear(),next.getMonth()+1,0).getDate());ui.month=localIso(next);ui.selected=localIso(new Date(next.getFullYear(),next.getMonth(),day,12));}else{ui.selected=localIso(shiftDay(parseDate(ui.calendarAnchor||ui.selected||todayIso()),direction*7));ui.month=ui.selected.slice(0,7)+'-01';}ui.calendarAnchor=ui.selected;render();},{kind:'period',direction,cue:true});}
 document.addEventListener('click',event=>{
  const taskControl=event.target.closest('.dm-plan-agenda [data-action="toggle-task"]');if(taskControl){const id=taskControl.dataset.id,was=Boolean(data.tasks.find(item=>item.id===id)?.done);const timer=setTimeout(()=>{completionTimers.delete(timer);if(!was&&data.tasks.find(item=>item.id===id)?.done){const next=[...document.querySelectorAll('.dm-plan-agenda [data-action="toggle-task"]')].find(node=>node.dataset.id===id);spark(next,true);}},0);completionTimers.add(timer);return;}
  const control=event.target.closest('[data-action]'),inside=control?.closest('.dm-calendar-surface');if(!control||(!inside&&!control.matches('.dm-calendar-toggle')))return;
  if(Date.now()<suppressed){event.preventDefault();event.stopImmediatePropagation();return;}
  const action=control.dataset.action;if(!['calendar-expand','calendar-mode','calendar-today','select-day','month-prev','month-next'].includes(action))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(action==='calendar-expand')mode(!ui.calendarExpanded);else if(action==='calendar-mode')mode(control.dataset.mode==='month');else if(action==='month-prev'||action==='month-next')period(action==='month-prev'?-1:1);else change(()=>{ui.selected=action==='calendar-today'?todayIso():control.dataset.date;ui.calendarAnchor=ui.selected;ui.month=ui.selected.slice(0,7)+'-01';render();},{kind:'select',cue:true});
 },true);
 document.addEventListener('keydown',event=>{if(event.target.matches('.dm-calendar-surface')&&['PageUp','PageDown'].includes(event.key)){event.preventDefault();period(event.key==='PageDown'?1:-1);}});
 document.addEventListener('pointerdown',event=>{const current=event.target.closest('.dm-calendar-surface');if(!current||event.button>0||event.target.closest('.calendar-controls,.calendar-toolbar'))return;start={id:event.pointerId,x:event.clientX,y:event.clientY,from:!!ui.calendarExpanded,handle:!!event.target.closest('.calendar-handle'),touch:event.pointerType==='touch'};},true);
 document.addEventListener('pointermove',event=>{
  if(!start||start.id!==event.pointerId)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;
  if(!drag&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.4){try{card()?.setPointerCapture(event.pointerId);}catch{}if(event.cancelable)event.preventDefault();return;}
  if(!drag){if(Math.abs(dy)<12||Math.abs(dy)<Math.abs(dx)*1.3||start.touch&&!start.handle)return;if(start.from&&dy>0||!start.from&&dy<0)return;const held={...start};if(!held.from){ui.calendarExpanded=true;ui.mode='month';ui.month=ui.selected.slice(0,7)+'-01';render();}const current=card(),grid=current?.querySelector('.calendar-grid');if(!grid)return;clear();const full=grid.getBoundingClientRect().height,one=44;drag={card:current,grid,full,one,from:held.from?1:0,p:held.from?1:0,baseY:event.clientY};current.classList.add('cal-dragging');try{current.setPointerCapture(event.pointerId);}catch{}suppressed=Date.now()+500;}
  const span=Math.max(80,drag.full-drag.one);drag.p=Math.max(0,Math.min(1,drag.from+(event.clientY-drag.baseY)/span));drag.grid.style.height=(drag.one+(drag.full-drag.one)*drag.p)+'px';drag.card.style.setProperty('--cal-p',drag.p);if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();
 },{capture:true,passive:false});
 function finish(event,cancelled=false){if(!start||event.pointerId!==start.id)return;const prior=start;start=null;if(drag){const open=cancelled?!!drag.from:drag.from?drag.p>.7:drag.p>.3;drag=null;suppressed=Date.now()+450;window.__calendarDragged=Date.now();event.preventDefault();event.stopImmediatePropagation();mode(open,!cancelled);return;}const dx=event.clientX-prior.x,dy=event.clientY-prior.y;if(!cancelled&&Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.4){suppressed=Date.now()+450;event.preventDefault();event.stopImmediatePropagation();period(dx<0?1:-1);}}
 document.addEventListener('pointerup',event=>finish(event),true);document.addEventListener('pointercancel',event=>finish(event,true),true);
 function abortGesture(){const previous=drag?.from;start=null;drag=null;clear();if(previous===0){ui.calendarExpanded=false;ui.mode='week';ui.calendarAnchor=ui.selected;render();align();observe();}}
 window.addEventListener('blur',abortGesture);window.addEventListener('flow:suspend',abortGesture);
 const intersection=new IntersectionObserver(entries=>{for(const entry of entries)entry.target.classList.toggle('dm-calendar-inactive',!entry.isIntersecting||document.hidden);});
 const sizeObserver=new ResizeObserver(()=>{if(!animations.size)align();});
 function observe(needsAlignment=true){const current=card();if(current===observed)return;if(observedSurface)intersection.unobserve(observedSurface);sizeObserver.disconnect();observed=current;observedSurface=surface();if(current){if(needsAlignment)align();intersection.observe(observedSurface);sizeObserver.observe(current);for(const animation of animations)if(!animation.effect?.target?.isConnected)animation.cancel();}else clear();}
 new MutationObserver(()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;observe();});}).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)abortGesture();surface()?.classList.toggle('dm-calendar-inactive',document.hidden);});
 document.addEventListener('flow:effectschange',()=>{if(!moving())clear();});media.addEventListener('change',()=>{if(!moving())clear();});window.addEventListener('pagehide',abortGesture);
 window.flowCalendarMotion={change,mode,period,getState:()=>({activeAnimations:animations.size,particles:particles.size,dragging:!!drag,expanded:ui.calendarExpanded,selected:ui.selected})};observe();
})();
