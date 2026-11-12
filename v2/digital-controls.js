/* Shared motion from the approved controls map. Presentation only: no commands,
 * timers for business actions, record contents or alternate event handlers. */
(() => {
 'use strict';if(document.documentElement.dataset.flowDesign==='classic'||window.flowCommonControls)return;
 const root=document.documentElement,scope=document.getElementById('app')||document.body;
 const ease='cubic-bezier(.4,0,.2,1)',media=matchMedia('(prefers-reduced-motion:reduce)'),active=new Set(),layers=new Set(),bars=new Map(),checks=new Map();
 const groups='.dm-bottom-nav,.segmented,.en-tabs,.sp-tabs,.finance-tabs,.movie-seen-tabs,.filter-buttons,.dc-filters';
 let scheduled=0,disposed=false,typed=0,presses=0,slides=0,ticks=0,lastInput=0,subLayout=null;
 const moving=()=>!disposed&&!document.hidden&&root.dataset.motion!=='off'&&!(root.dataset.motion!=='on'&&media.matches);
 const excluded=node=>!!node?.closest('.flow-assistant-layer,.dm-live-assistant,.pn-player-shell,.enm-player-host,.en-reader,[data-midi],.piano-key');
 const control=event=>event.composedPath().find(node=>node instanceof Element&&node.matches('button,a[href],input,textarea,select,summary,[contenteditable="true"]'));
 const owns=event=>{const node=control(event);return !!node&&!excluded(node)&&!node.matches('input[type=range],input[type=file]');};
 function track(animation,done){active.add(animation);animation.finished.catch(()=>{}).finally(()=>{active.delete(animation);done?.();});return animation;}
 function quiet(){for(const animation of active)animation.cancel();active.clear();for(const layer of layers)layer.remove();layers.clear();}
 function glow(node,event,typing=false){
  if(!moving()||!node?.isConnected||node.disabled||node.closest('[inert]'))return;
  const box=node.getBoundingClientRect();if(!box.width||!box.height)return;
  const layer=document.createElement('i'),css=getComputedStyle(node);layer.className='flow-control-response';layer.setAttribute('aria-hidden','true');
  const radius=css.borderRadius,rounded=parseFloat(radius)>0;layer.dataset.mode=typing||!rounded?'line':'wash';
  layer.style.cssText=`left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;border-radius:${radius};--flow-hit-x:${event?.type==='pointerdown'?Math.max(0,Math.min(100,(event.clientX-box.left)/box.width*100)):50}%`;
  document.body.append(layer);layers.add(layer);
  track(layer.animate([{opacity:0},{opacity:typing?.52:.38,offset:.2},{opacity:0}],{duration:typing?780:660,easing:ease}),()=>{layers.delete(layer);layer.remove();});
  while(layers.size>6){const first=layers.values().next().value;first.remove();layers.delete(first);}
 }
 function press(event){if(!owns(event)||event.type==='keydown'&&(!['Enter',' '].includes(event.key)||event.repeat))return;const node=control(event);if(node?.isContentEditable||node?.matches('input,textarea,select'))return;presses++;glow(node,event);}
 function input(event){const field=control(event);if(!owns(event)||!field?.matches('input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable="true"]'))return;const now=performance.now();if(now-lastInput<80)return;lastInput=now;typed++;glow(field,event,true);}
 const selected=node=>node.classList.contains('active')||node.getAttribute('aria-selected')==='true'||node.getAttribute('aria-pressed')==='true'||node.getAttribute('aria-current')==='page';
 function barKey(group,items){return (group.matches('.dm-bottom-nav')?'global-nav':typeof ui!=='undefined'?ui.page:'page')+':'+group.className.replace(/flow-motion-bar/g,'').trim().replace(/\s+/g,' ')+':'+items.map(node=>node.dataset.action||node.dataset.page||node.getAttribute('role')||node.tagName).join('|');}
 function syncBar(group){
  if(group.querySelector('.dm-calendar-view-indicator'))return;
  const items=[...group.children].filter(node=>node.matches('button,a,[role=tab]'));if(items.length<2||group.closest('[hidden],.pn-player-shell'))return;
  const chosen=items.find(selected);if(!chosen)return;const area=group.getBoundingClientRect(),box=chosen.getBoundingClientRect();if(!area.width||!box.width)return;
  if(getComputedStyle(group).position==='static')group.style.position='relative';
  const key=barKey(group,items),left=box.left-area.left+group.scrollLeft,top=box.top-area.top+group.scrollTop,old=bars.get(key);
  let indicator=group.querySelector(':scope>.flow-motion-indicator');if(!indicator){indicator=document.createElement('i');indicator.className='flow-motion-indicator';indicator.setAttribute('aria-hidden','true');group.prepend(indicator);group.classList.add('flow-motion-bar');}
  const final={left,width:box.width,top,height:box.height},same=old&&['left','top','width','height'].every(k=>Math.abs(old[k]-final[k])<.5);
  indicator.style.cssText=`left:0;top:${top}px;width:${box.width}px;height:${box.height}px;transform:translateX(${left}px);border-radius:${Math.max(10,parseFloat(getComputedStyle(chosen).borderRadius)||14)}px`;
  if(!same&&old&&moving()){indicator.getAnimations().forEach(a=>a.cancel());track(indicator.animate([{transform:`translateX(${old.left}px)`,width:old.width+'px'},{transform:`translateX(${left}px)`,width:box.width+'px'}],{duration:440,easing:ease}));slides++;}
  bars.set(key,final);if(bars.size>80)bars.delete(bars.keys().next().value);
 }
 function checkKey(node,index){const row=node.closest('[data-task-id],[data-id]');return [typeof ui!=='undefined'?ui.page:'page',node.dataset.action||node.name||node.id||'check',node.dataset.id||row?.dataset.taskId||row?.dataset.id||index].join(':');}
 function syncChecks(){
  const nodes=scope.querySelectorAll('.task-check,.task-checklist-item,.sub-check,.mu-episode-row,.mu-season-head>.mu-episode-tick,.sl-check,.gift-check,[role=checkbox],input[type=checkbox]:not(.switch input)');let index=0;
  for(const node of nodes){if(excluded(node))continue;const key=checkKey(node,index++)+':'+(node.dataset.index||'')+':'+(node.dataset.imdb||'')+':'+(node.dataset.season||'')+':'+(node.dataset.episode||''),now=node.matches('input')?node.checked:node.getAttribute('aria-checked')==='true'||node.getAttribute('aria-pressed')==='true'||node.classList.contains('checked')||node.classList.contains('is-done')||node.closest('.is-done,.done')!==null,previous=checks.get(key);checks.set(key,now);
   if(previous===undefined||previous===now||!moving())continue;ticks++;node.classList.add('flow-check-changed');setTimeout(()=>node.classList.remove('flow-check-changed'),560);
   if(now)for(const path of node.querySelectorAll('svg path')){try{const length=path.getTotalLength();if(!length)continue;path.style.strokeDasharray=String(length);track(path.animate([{strokeDashoffset:length},{strokeDashoffset:0}],{duration:520,easing:ease}),()=>path.style.removeProperty('stroke-dasharray'));}catch{}}
  }if(checks.size>600){checks.clear();}
 }
 function subRows(){return [...scope.querySelectorAll('.task-sub,.task-checklist [data-sub],.check-subs,.check-sub,.mu-episode-panel,.mu-episode-list')].map((node,index)=>{const task=node.closest('[data-task-id]'),entry=node.closest('.check-entry'),series=node.closest('.mu-series-entry'),key=task?'task:'+task.dataset.taskId+':'+(node.dataset.sub??'group'):entry?'list:'+entry.dataset.orderKey+':'+(node.dataset.subIndex??'group'):series?'series:'+(series.querySelector('[data-imdb]')?.dataset.imdb||index)+':'+node.className+':'+index:null;return {node,key};}).filter(row=>row.key);}
 function rememberSubLayout(event){const button=control(event);if(!moving()||!button?.matches('[data-action="task-check-item"],[data-action="task-checklist-toggle"],[data-action="list-sub-toggle"],[data-action="mu-season-open"],[data-action="mu-series-expand"]'))return;subLayout=new Map(subRows().map(({node,key})=>[key,node.getBoundingClientRect()]));}
 function animateSubLayout(){if(!subLayout)return;const before=subLayout;subLayout=null;if(!moving())return;const rows=subRows().map(row=>({...row,box:row.node.getBoundingClientRect()}));for(const {node,key,box} of rows){const old=before.get(key);if(!old){track(node.animate([{opacity:0,transform:'translateY(-5px)'},{opacity:1,transform:'none'}],{duration:520,easing:ease}));continue;}const group=node.matches('.task-sub,.check-subs,.mu-episode-panel,.mu-episode-list');if(group&&Math.abs(old.height-box.height)>1){node.style.overflow='clip';track(node.animate([{height:old.height+'px'},{height:box.height+'px'}],{duration:620,easing:ease}),()=>node.style.removeProperty('overflow'));}else if(!group&&Math.abs(old.top-box.top)>1){track(node.animate([{transform:`translateY(${old.top-box.top}px)`},{transform:'none'}],{duration:620,easing:ease}));}}}
 function sync(){scheduled=0;if(disposed)return;for(const group of scope.querySelectorAll(groups))syncBar(group);syncChecks();animateSubLayout();}
 function schedule(){if(!scheduled&&!disposed)scheduled=requestAnimationFrame(sync);}
 const observer=new MutationObserver(records=>{if(records.some(record=>record.type==='attributes'||[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1&&!node.classList.contains('flow-motion-indicator'))))schedule();});observer.observe(scope,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-selected','aria-checked','aria-pressed','checked']});
 document.addEventListener('click',rememberSubLayout,true);document.addEventListener('pointerdown',press,{capture:true,passive:true});document.addEventListener('keydown',press,true);document.addEventListener('input',input,true);document.addEventListener('change',schedule,true);
 document.addEventListener('scroll',quiet,{capture:true,passive:true});window.addEventListener('resize',()=>{quiet();schedule();});document.addEventListener('visibilitychange',()=>{if(document.hidden)quiet();else schedule();});document.addEventListener('flow:effectschange',()=>{if(!moving())quiet();schedule();});media.addEventListener('change',()=>{if(!moving())quiet();});window.addEventListener('pagehide',quiet);
 root.dataset.flowControls='on';window.flowCommonControls={owns,refresh:schedule,getState:()=>({presses,typed,slides,ticks,active:active.size,layers:layers.size,moving:moving()}),dispose(){disposed=true;observer.disconnect();quiet();if(scheduled)cancelAnimationFrame(scheduled);delete root.dataset.flowControls;}};schedule();
})();
