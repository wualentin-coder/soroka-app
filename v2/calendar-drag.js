(() => {
 'use strict';
 const root=document.documentElement,animations=new Set(),media=matchMedia('(prefers-reduced-motion:reduce)');
 let start=null,drag=null,suppressed=0,observed=null,observedSurface=null,frame=0;
 const particles=new Set(),completionTimers=new Set();
 const moving=()=>!document.hidden&&root.dataset.motion!=='off'&&!(root.dataset.motion!=='on'&&media.matches);
 const card=()=>document.querySelector('.dm-calendar-surface');
 const surface=()=>card()?.closest('.dm-calendar-living')||card();
 function box(node,base){if(!node||!base)return null;const a=node.getBoundingClientRect(),b=base.getBoundingClientRect();return{x:a.x-b.x-base.clientLeft,y:a.y-b.y-base.clientTop,w:a.width,h:a.height};}
 function place(node,value){if(!node||!value)return;node.hidden=false;node.style.width=value.w+'px';node.style.height=value.h+'px';node.style.transform=`translate(${value.x}px,${value.y}px)`;}
 function align(){
  const current=card(),grid=current?.querySelector('.calendar-grid'),tabs=current?.querySelector('.segmented');if(!grid||!tabs)return;
  const selected=grid.querySelector('.selected'),selection=grid.querySelector('.dm-calendar-selection'),band=grid.querySelector('.dm-calendar-week-band'),point=box(selected,grid);
  const origin=point?box(grid,surface()):null,gridWidth=grid.clientWidth,indicatorBox=box(tabs.querySelector('.active'),tabs);
  if(point){place(selection,point);place(band,{x:0,y:point.y,w:gridWidth,h:point.h});surface()?.style.setProperty('--dm-calendar-x',`${origin.x+point.x+point.w/2}px`);surface()?.style.setProperty('--dm-calendar-y',`${origin.y+point.y+point.h/2}px`);}else{if(selection)selection.hidden=true;if(band)band.hidden=true;}
  place(tabs.querySelector('.dm-calendar-view-indicator'),indicatorBox);
 }
 function clear(){for(const timer of completionTimers)clearTimeout(timer);completionTimers.clear();for(const animation of animations)animation.cancel();animations.clear();for(const node of particles)node.remove();particles.clear();const current=card();current?.classList.remove('cal-dragging');if(current){current.style.removeProperty('--cal-p');current.querySelector('.calendar-grid')?.style.removeProperty('height');}}
 function animate(node,frames,options={}){if(!node||!moving())return;const animation=node.animate(frames,{duration:460,easing:'cubic-bezier(.19,1,.22,1)',...options});animations.add(animation);animation.finished.catch(()=>{}).finally(()=>{animations.delete(animation);if(!animations.size)align();});return animation;}
 function travel(node,from,to,duration=460){if(!from||!to)return;animate(node,[{transform:`translate(${from.x}px,${from.y}px)`,width:from.w+'px',height:from.h+'px'},{transform:`translate(${to.x}px,${to.y}px)`,width:to.w+'px',height:to.h+'px'}],{duration});}
 function spark(node,complete=false){
  const host=surface();if(!moving()||!node||!host)return;const r=box(node,host),count=complete?10:6;
  for(let i=0;i<count;i++){const dot=document.createElement('i');dot.className='dm-calendar-spark';dot.setAttribute('aria-hidden','true');dot.style.left=(r.x+r.w/2)+'px';dot.style.top=(r.y+r.h/2)+'px';host.append(dot);particles.add(dot);const angle=i/count*Math.PI*2,distance=complete?24:15,dx=Math.cos(angle)*distance,dy=Math.sin(angle)*distance;const animation=animate(dot,[{transform:'scale(.4)',opacity:0},{transform:`translate(${dx*.35}px,${dy*.35}px) scale(1)`,opacity:.75,offset:.2},{transform:`translate(${dx}px,${dy}px) scale(0)`,opacity:0}],{duration:580+i%3*45,easing:'cubic-bezier(.16,1,.3,1)'});const remove=()=>{particles.delete(dot);dot.remove();};if(animation)animation.finished.catch(()=>{}).finally(remove);else remove();}
 }
 function snapshot(){const current=card(),grid=current?.querySelector('.calendar-grid'),tabs=current?.querySelector('.segmented');if(!current||!grid)return null;const cells=new Map([...grid.querySelectorAll('[data-date]')].map(node=>[node.dataset.date,box(node,grid)])),selection=grid.querySelector('.dm-calendar-selection'),indicator=tabs?.querySelector('.dm-calendar-view-indicator'),focus=document.activeElement;return{height:current.getBoundingClientRect().height,cells,selection:selection&&!selection.hidden?box(selection,grid):null,indicator:indicator&&!indicator.hidden?box(indicator,tabs):null,focus:current.contains(focus)||focus?.matches('.dm-calendar-toggle')?{date:focus.dataset.date,action:focus.dataset.action,mode:focus.dataset.mode}:null};}
 function change(update,{kind='view',direction=0,cue=false}={}){
  const before=snapshot();clear();update();align();const current=card(),grid=current?.querySelector('.calendar-grid');
  if(current&&before){
   const after=current.getBoundingClientRect().height;if(Math.abs(before.height-after)>.5)animate(current,[{height:before.height+'px'},{height:after+'px'}]);
   [...grid.querySelectorAll('[data-date]')].forEach((node,index)=>{const prior=before.cells.get(node.dataset.date),next=box(node,grid);if(prior&&kind==='view')animate(node,[{transform:`translate(${prior.x-next.x}px,${prior.y-next.y}px)`},{transform:'translate(0,0)'}]);else if(!prior||kind==='period')animate(node,[{opacity:0,transform:`translate(${direction*15}px,${kind==='view'?6:0}px)`},{opacity:1,transform:'translate(0,0)'}],{duration:340,delay:Math.min(Math.floor(index/7)*16,65)});});
   const selection=grid.querySelector('.dm-calendar-selection'),tabs=current.querySelector('.segmented'),indicator=tabs.querySelector('.dm-calendar-view-indicator');travel(selection,before.selection,box(selection,grid));travel(grid.querySelector('.dm-calendar-week-band'),before.selection?{x:0,y:before.selection.y,w:grid.clientWidth,h:before.selection.h}:null,box(grid.querySelector('.dm-calendar-week-band'),grid));travel(indicator,before.indicator,box(indicator,tabs),360);
   if(kind!=='view'){document.querySelectorAll('.dm-plan-agenda .dm-task-row,.dm-plan-agenda .event-card,.dm-plan-agenda .dm-free-day').forEach((node,index)=>animate(node,[{opacity:0,transform:`translate(${direction*9}px,7px)`},{opacity:1,transform:'translate(0,0)'}],{duration:380,delay:Math.min(index*35,140)}));spark(grid.querySelector('.selected'));}
   if(before.focus){const f=before.focus,target=f.date?current.querySelector(`[data-date="${ui.selected}"]`):document.querySelector(`[data-action="${f.action}"]${f.mode?`[data-mode="${f.mode}"]`:''}`);target?.focus({preventScroll:true});}
  }
  if(cue)window.flowDigital?.feedback(kind==='view'?'open':'tap');
  document.dispatchEvent(new CustomEvent('flow:calendarinteraction',{detail:{kind,date:ui.selected,expanded:ui.calendarExpanded}}));observe();
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
 document.addEventListener('pointerdown',event=>{const current=event.target.closest('.dm-calendar-surface');if(!current||event.button>0||event.target.closest('.calendar-controls,.calendar-toolbar'))return;start={id:event.pointerId,x:event.clientX,y:event.clientY,from:!!ui.calendarExpanded,handle:!!event.target.closest('.calendar-handle'),touch:event.pointerType==='touch'};},true);
 document.addEventListener('pointermove',event=>{
  if(!start||start.id!==event.pointerId)return;const dx=event.clientX-start.x,dy=event.clientY-start.y;
  if(!drag){if(Math.abs(dy)<12||Math.abs(dy)<Math.abs(dx)*1.3||start.touch&&!start.handle)return;if(start.from&&dy>0||!start.from&&dy<0)return;const held={...start};if(!held.from){ui.calendarExpanded=true;ui.mode='month';ui.month=ui.selected.slice(0,7)+'-01';render();}const current=card(),grid=current?.querySelector('.calendar-grid');if(!grid)return;clear();const full=grid.getBoundingClientRect().height,one=44;drag={card:current,grid,full,one,from:held.from?1:0,p:held.from?1:0,baseY:event.clientY};current.classList.add('cal-dragging');try{current.setPointerCapture(event.pointerId);}catch{}suppressed=Date.now()+500;}
  const span=Math.max(80,drag.full-drag.one);drag.p=Math.max(0,Math.min(1,drag.from+(event.clientY-drag.baseY)/span));drag.grid.style.height=(drag.one+(drag.full-drag.one)*drag.p)+'px';drag.card.style.setProperty('--cal-p',drag.p);if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();
 },{capture:true,passive:false});
 function finish(event,cancelled=false){if(!start||event.pointerId!==start.id)return;const prior=start;start=null;if(drag){const open=cancelled?!!drag.from:drag.from?drag.p>.7:drag.p>.3;drag=null;suppressed=Date.now()+450;window.__calendarDragged=Date.now();event.preventDefault();event.stopImmediatePropagation();mode(open,!cancelled);return;}const dx=event.clientX-prior.x,dy=event.clientY-prior.y;if(!cancelled&&Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.4){suppressed=Date.now()+450;event.preventDefault();event.stopImmediatePropagation();period(dx<0?1:-1);}}
 document.addEventListener('pointerup',event=>finish(event),true);document.addEventListener('pointercancel',event=>finish(event,true),true);
 const intersection=new IntersectionObserver(entries=>{for(const entry of entries)entry.target.classList.toggle('dm-calendar-inactive',!entry.isIntersecting||document.hidden);});
 const sizeObserver=new ResizeObserver(()=>{if(!animations.size)align();});
 function observe(){const current=card();if(current===observed)return;if(observedSurface)intersection.unobserve(observedSurface);sizeObserver.disconnect();observed=current;observedSurface=surface();if(current){align();intersection.observe(observedSurface);sizeObserver.observe(current);for(const animation of animations)if(!animation.effect?.target?.isConnected)animation.cancel();}else clear();}
 new MutationObserver(()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;observe();});}).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){start=null;drag=null;clear();}surface()?.classList.toggle('dm-calendar-inactive',document.hidden);});
 document.addEventListener('flow:effectschange',()=>{if(!moving())clear();});media.addEventListener('change',()=>{if(!moving())clear();});window.addEventListener('pagehide',()=>{start=null;drag=null;clear();});
 window.flowCalendarMotion={change,mode,period,getState:()=>({activeAnimations:animations.size,particles:particles.size,dragging:!!drag,expanded:ui.calendarExpanded,selected:ui.selected})};observe();
})();
