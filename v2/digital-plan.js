/* Plan presentation from the reviewed prototype. Native save/edit/swipe owners stay.
 * TaskStack's movement: 120ms settle, 820ms travel, same easing for every row.
 * Unlike the isolated prototype, native render may run again after a server ACK;
 * keep unchanged keyed rows so that ACK cannot cut an in-flight movement short. */
(() => {
 'use strict';
 if(document.documentElement.dataset.flowDesign==='classic'||window.flowPlanMotion)return;
 const active=new Map(),lights=new Set(),models=new Map(),completedOverdue=new Set(),media=matchMedia('(prefers-reduced-motion:reduce)');
 let scope='',moves=0,disposed=false;
 const noMotion=()=>disposed||document.hidden||document.documentElement.dataset.motion==='off'||(document.documentElement.dataset.motion!=='on'&&media.matches);
 const record=id=>data.tasks.find(task=>String(task.id)===String(id));
 const model=id=>{const task=record(id);return task?JSON.stringify(task):'';};
 const rows=()=>[...document.querySelectorAll('.dm-main .task-card[data-task-id]')];
 const owner=node=>node.closest('.swipe-row')||node;
 function cancel(){for(const item of active.values())item.animation.cancel();active.clear();for(const animation of lights)animation.cancel();lights.clear();}
 function animate(node,delta,id){
  if(noMotion()||Math.abs(delta)<.5)return;
  const prior=node.style.zIndex,z=node.querySelector('.is-done')?'2':'1';node.style.zIndex=z;
  const animation=node.animate([{translate:`0 ${delta}px`},{translate:'0 0'}],{duration:820,delay:120,fill:'backwards',easing:'cubic-bezier(.4,0,.2,1)'}),item={animation,node};
  active.set(id,item);moves++;
  animation.finished.catch(()=>{}).finally(()=>{if(active.get(id)===item)active.delete(id);if(node.style.zIndex===z)node.style.zIndex=prior;});
 }
 const nativeRender=window.render;
 window.render=function(...args){
  const nextScope=ui.page+':'+(ui.selected||''),inPlan=['today','tasks','upcoming'].includes(ui.page),sameScope=scope===nextScope;
  if(!sameScope){cancel();models.clear();completedOverdue.clear();}
  const before=new Map((inPlan&&sameScope?rows():[]).map(node=>[String(node.dataset.taskId),{node,owner:owner(node),top:owner(node).getBoundingClientRect().top,done:node.classList.contains('is-done'),model:models.get(String(node.dataset.taskId))}]));
  for(const [id,old] of before){const task=record(id);if(!task?.done)completedOverdue.delete(id);else if(!old.done&&old.node.closest('.dm-overdue'))completedOverdue.add(id);}
  const result=nativeRender.apply(this,args);scope=ui.page+':'+(ui.selected||'');
  if(!inPlan||scope!==nextScope){cancel();models.clear();return result;}
  // Preserve complete existing swipe owners, including pointer listeners/focus.
  for(const node of rows()){const id=String(node.dataset.taskId),old=before.get(id),freshOwner=owner(node);if(old&&old.model===model(id)&&freshOwner!==old.owner&&!old.owner.isConnected&&freshOwner.tagName===old.owner.tagName)freshOwner.replaceWith(old.owner);}
  const after=rows(),changed=after.some(node=>{const old=before.get(String(node.dataset.taskId));return old&&old.done!==node.classList.contains('is-done');});
  const continuing=new Set([...active].filter(([,item])=>!item.node.isConnected).map(([id])=>id));
  if(changed)cancel();else for(const id of continuing){active.get(id)?.animation.cancel();active.delete(id);}
  if(!noMotion())for(const node of after){const id=String(node.dataset.taskId),old=before.get(id);if(old&&(changed||continuing.has(id)))animate(owner(node),old.top-owner(node).getBoundingClientRect().top,id);}
  models.clear();for(const node of after)models.set(String(node.dataset.taskId),model(node.dataset.taskId));
  return result;
 };
 window.flowPlanMotion={overdue(pending){const ids=new Set(pending.map(task=>String(task.id)));return [...pending,...[...completedOverdue].filter(id=>!ids.has(id)).map(record).filter(task=>task?.done)];},getState:()=>({moves,active:active.size,lights:lights.size}),dispose(){disposed=true;cancel();models.clear();completedOverdue.clear();}};
 document.addEventListener('pointerdown',event=>{if(noMotion())return;const row=event.target.closest('.dm-plan13 .task-card'),clock=row?.querySelector('.dm-task-clock');if(!clock)return;try{const animation=clock.animate([{transform:'translateX(-45%)',opacity:0},{opacity:.75,offset:.2},{transform:'translateX(45%)',opacity:0}],{duration:1350,easing:'cubic-bezier(.22,.75,.2,1)',pseudoElement:'::after'});lights.add(animation);animation.finished.catch(()=>{}).finally(()=>lights.delete(animation));}catch{}},{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});document.addEventListener('flow:effectschange',()=>{if(noMotion())cancel();});media.addEventListener('change',()=>{if(noMotion())cancel();});window.addEventListener('pagehide',cancel);
 window.render();
})();
