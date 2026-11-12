/* Plan presentation from the reviewed prototype. Native save/edit/swipe owners stay.
 * TaskStack's movement: 120ms settle, 820ms travel, same easing for every row.
 * Unlike the isolated prototype, native render may run again after a server ACK;
 * keep unchanged keyed rows so that ACK cannot cut an in-flight movement short. */
(() => {
 'use strict';
 if(document.documentElement.dataset.flowDesign==='classic'||window.flowPlanMotion)return;
 const active=new Map(),lights=new Set(),models=new Map(),completedOverdue=new Set(),media=matchMedia('(prefers-reduced-motion:reduce)'),responses=new Map();
 let scope='',moves=0,reactions=0,entrances=0,disposed=false;
 const noMotion=()=>disposed||document.hidden||document.documentElement.dataset.motion==='off'||(document.documentElement.dataset.motion!=='on'&&media.matches);
 const record=id=>data.tasks.find(task=>String(task.id)===String(id));
 const model=id=>{const task=record(id);return task?JSON.stringify(task):'';};
 const rows=()=>[...document.querySelectorAll('.dm-main .task-card[data-task-id]')];
 const owner=node=>node.closest('.swipe-row')||node;
 function cancelMoves(){for(const item of active.values())item.animation.cancel();active.clear();}
 function clearResponses(){for(const item of responses.values()){item.animation.cancel();item.layer.remove();}responses.clear();}
 function cancel(){cancelMoves();for(const animation of lights)animation.cancel();lights.clear();clearResponses();}
 function light(node,frames,options,done){const animation=node.animate(frames,options);lights.add(animation);animation.finished.catch(()=>{}).finally(()=>{lights.delete(animation);done?.();});return animation;}
 const surfaceSelector='.dm-plan-schedule,.dm-overdue,.dm-plan-birthday,.dc-practice-card,.event-card,.ticket-card,.ticket-mini';
 const allSurfaces=()=>[...document.querySelectorAll('.dm-plan13 '+surfaceSelector.split(',').join(',.dm-plan13 '))];
 const surfaceKey=node=>[...node.classList].filter(name=>surfaceSelector.split(',').includes('.'+name)).join(':')+':'+(node.matches('.dm-plan-schedule,.dm-overdue')?'':node.dataset.id||node.dataset.page||node.querySelector('[data-id]')?.dataset.id||'');
 function planSurface(origin){let node=origin.closest(surfaceSelector);const first=node;while(node){const css=getComputedStyle(node);if(parseFloat(css.borderRadius)>0&&parseFloat(css.borderTopWidth)>0&&css.borderTopStyle!=='none')return {node,framed:true};node=node.parentElement?.closest(surfaceSelector);}return first?{node:first,framed:false}:null;}
 function response(event){
  if(noMotion()||document.querySelector('.modal-backdrop')||event.type==='keydown'&&(!['Enter',' '].includes(event.key)||event.repeat))return;
  const origin=event.target.closest?.('.dm-plan13 button,.dm-plan13 a,.dm-plan13 [data-calendar-swipe]');if(!origin||origin.disabled)return;
  const target=planSurface(origin);if(!target)return;const {node:surface,framed}=target;
  const box=surface.getBoundingClientRect(),style=getComputedStyle(surface);if(!box.width||!box.height)return;
  const prior=responses.get(surface);if(prior){prior.animation.cancel();prior.layer.remove();}
  // A detached light follows the existing rounded surface, surviving native DOM patches.
  // It never becomes a new frame around a flat task/subtask row.
  const layer=document.createElement('i');layer.className='dm-plan-response';layer.dataset.framed=String(framed);layer.setAttribute('aria-hidden','true');
  const x=event.type==='pointerdown'?Math.max(0,Math.min(100,(event.clientX-box.left)/box.width*100)):50;
  layer.style.cssText=`left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;border-radius:${style.borderRadius};--plan-hit:${x}%`;
  layer.innerHTML='<i class="dm-plan-response-material"></i><i class="dm-plan-response-edge"></i>';document.body.append(layer);
  const item={layer,animation:null,key:surfaceKey(surface)};responses.set(surface,item);reactions++;
  item.animation=light(layer,[{opacity:0},{opacity:.7,offset:.22},{opacity:.3,offset:.6},{opacity:0}],{duration:1100,easing:'cubic-bezier(.4,0,.2,1)'},()=>{layer.remove();if(responses.get(surface)===item)responses.delete(surface);});
  while(responses.size>3){const [node,old]=responses.entries().next().value;old.animation.cancel();old.layer.remove();responses.delete(node);}
  const symbol=surface.querySelector('.module-symbol,.dm-plan-birthday-date');if(symbol)light(symbol,[{transform:'scale(1)'},{transform:'scale(1.045)',offset:.35},{transform:'scale(1)'}],{duration:720,easing:'cubic-bezier(.4,0,.2,1)'});
 }
 function enter(){if(noMotion())return;const blocks=document.querySelectorAll('.dm-plan13 :is(.calendar-toolbar,.dm-plan-agenda>.section-heading,.dc-practice-card,.dm-overdue>.section-heading,.dm-plan-nearby>.section-heading)');for(const [index,node] of [...blocks].entries())light(node,[{opacity:.65,translate:'0 7px'},{opacity:1,translate:'0 0'}],{duration:600,delay:Math.min(index*65,195),fill:'backwards',easing:'cubic-bezier(.4,0,.2,1)'});if(blocks.length)entrances++;}
 function animate(node,delta,id){
  if(noMotion()||Math.abs(delta)<.5)return;
  const prior=node.style.zIndex,z=node.querySelector('.is-done')?'2':'1';node.style.zIndex=z;
  const animation=node.animate([{translate:`0 ${delta}px`},{translate:'0 0'}],{duration:820,delay:120,fill:'backwards',easing:'cubic-bezier(.4,0,.2,1)'}),item={animation,node};
  active.set(id,item);moves++;
  animation.finished.catch(()=>{}).finally(()=>{if(active.get(id)===item)active.delete(id);if(node.style.zIndex===z)node.style.zIndex=prior;});
 }
 const nativeRender=window.render;
 window.render=function(...args){
  const pageChanged=scope.split(':')[0]!==ui.page,nextScope=ui.page+':'+(ui.selected||''),inPlan=['today','tasks','upcoming'].includes(ui.page),sameScope=scope===nextScope;
  if(!sameScope){cancel();models.clear();completedOverdue.clear();}
  const before=new Map((inPlan&&sameScope?rows():[]).map(node=>[String(node.dataset.taskId),{node,owner:owner(node),top:owner(node).getBoundingClientRect().top,done:node.classList.contains('is-done'),model:models.get(String(node.dataset.taskId))}]));
  for(const [id,old] of before){const task=record(id);if(!task?.done)completedOverdue.delete(id);else if(!old.done&&old.node.closest('.dm-overdue'))completedOverdue.add(id);}
  const result=nativeRender.apply(this,args);scope=ui.page+':'+(ui.selected||'');
  if(document.querySelector('.modal-backdrop'))clearResponses();
  else for(const item of responses.values()){const surface=allSurfaces().find(node=>surfaceKey(node)===item.key);if(surface){const box=surface.getBoundingClientRect();Object.assign(item.layer.style,{left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px'});}else{item.animation.cancel();item.layer.remove();}}
  if(pageChanged&&ui.page==='today')enter();
  if(!inPlan||scope!==nextScope){cancel();models.clear();return result;}
  // Preserve complete existing swipe owners, including pointer listeners/focus.
  for(const node of rows()){const id=String(node.dataset.taskId),old=before.get(id),freshOwner=owner(node);if(old&&old.model===model(id)&&freshOwner!==old.owner&&!old.owner.isConnected&&freshOwner.tagName===old.owner.tagName)freshOwner.replaceWith(old.owner);}
  const after=rows(),changed=after.some(node=>{const old=before.get(String(node.dataset.taskId));return old&&old.done!==node.classList.contains('is-done');});
  const continuing=new Set([...active].filter(([,item])=>!item.node.isConnected).map(([id])=>id));
  if(changed)cancelMoves();else for(const id of continuing){active.get(id)?.animation.cancel();active.delete(id);}
  if(!noMotion())for(const node of after){const id=String(node.dataset.taskId),old=before.get(id);if(old&&(changed||continuing.has(id)))animate(owner(node),old.top-owner(node).getBoundingClientRect().top,id);}
  models.clear();for(const node of after)models.set(String(node.dataset.taskId),model(node.dataset.taskId));
  return result;
 };
 window.flowPlanMotion={overdue(pending){const ids=new Set(pending.map(task=>String(task.id)));return [...pending,...[...completedOverdue].filter(id=>!ids.has(id)).map(record).filter(task=>task?.done)];},getState:()=>({moves,active:active.size,lights:lights.size,reactions,responses:responses.size,entrances}),dispose(){disposed=true;cancel();models.clear();completedOverdue.clear();}};
 document.addEventListener('pointerdown',response,{capture:true,passive:true});document.addEventListener('keydown',response,true);
 document.addEventListener('scroll',clearResponses,{capture:true,passive:true});window.addEventListener('resize',clearResponses);
 document.addEventListener('pointerdown',event=>{if(noMotion())return;const row=event.target.closest('.dm-plan13 .task-card'),clock=row?.querySelector('.dm-task-clock');if(!clock)return;try{const animation=clock.animate([{transform:'translateX(-45%)',opacity:0},{opacity:.75,offset:.2},{transform:'translateX(45%)',opacity:0}],{duration:1350,easing:'cubic-bezier(.22,.75,.2,1)',pseudoElement:'::after'});lights.add(animation);animation.finished.catch(()=>{}).finally(()=>lights.delete(animation));}catch{}},{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});document.addEventListener('flow:effectschange',()=>{if(noMotion())cancel();});media.addEventListener('change',()=>{if(noMotion())cancel();});window.addEventListener('pagehide',cancel);
 window.render();
})();
