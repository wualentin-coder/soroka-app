/* Keep the live English exercise and its input nodes during local state updates. */
(() => {
 'use strict';
 const runtime = node => node.nodeType===1 && node.matches('.flow-surface-contour,.flow-response-layer,.flow-input-feedback');
 function key(node){
  if(node.nodeType!==1)return '';
  if(node.id)return 'id:'+node.id;
  if(node.hasAttribute('data-swipe'))return 'card:'+node.dataset.enCardId;
  if(node.dataset.action)return ['action',node.dataset.action,node.dataset.id||'',node.dataset.value||'',node.dataset.key||'',node.dataset.term||''].join(':');
  if(node.matches('input,textarea,select'))return node.tagName+':'+node.getAttribute('name');
  return node.tagName+':'+[...node.classList].filter(c=>!c.startsWith('flow-')&&!c.startsWith('rf-')).join('.')+':'+(node.getAttribute('role')||'');
 }
 const same=(a,b)=>a.nodeType===b.nodeType&&(a.nodeType!==1||a.tagName===b.tagName&&key(a)===key(b));
 function attributes(node,next){
  for(const attr of [...node.attributes])if(!next.hasAttribute(attr.name)&&!['data-en-viewport','data-en-top'].includes(attr.name))node.removeAttribute(attr.name);
  for(const attr of next.attributes){let value=attr.value;
   if(attr.name==='class'){const kept=[...node.classList].filter(c=>c.startsWith('flow-')||c.startsWith('rf-'));value=[...new Set([...value.split(/\s+/),...kept])].join(' ');}
   if(node.getAttribute(attr.name)!==value)node.setAttribute(attr.name,value);
  }
 }
 function morph(node,next){
  if(node.nodeType!==1){if(node.nodeValue!==next.nodeValue)node.nodeValue=next.nodeValue;return;}
  attributes(node,next);
  if(node.matches('textarea,input,select')){
   // Native input owns its selection/composition until the learner leaves this step.
   if(node!==document.activeElement&&node.value!==next.value)node.value=next.value;
   return;
  }
  const old=[...node.childNodes].filter(n=>!runtime(n)),used=new Set();let cursor=node.firstChild;
  for(const fresh of [...next.childNodes]){
   if(runtime(fresh))continue;
   while(cursor&&runtime(cursor))cursor=cursor.nextSibling;
   const found=old.find(n=>!used.has(n)&&same(n,fresh));
   if(found){used.add(found);if(found!==cursor)node.insertBefore(found,cursor);morph(found,fresh);cursor=found.nextSibling;}
   else{const copy=fresh.cloneNode(true);node.insertBefore(copy,cursor);}
  }
  for(const child of old)if(!used.has(child))child.remove();
 }
 function patch(app,markup){
  const main=app.querySelector('.main'),old=main?.querySelector('.en-run');if(!old)return false;
  const template=document.createElement('template');template.innerHTML=markup;const next=template.content.querySelector('.en-run');if(!next)return false;
  const structured=old.matches('.en-practice-workspace')&&next.matches('.en-practice-workspace')&&old.dataset.session===next.dataset.session;
  const cards=!!old.querySelector('[data-swipe]')&&!!next.querySelector('[data-swipe]');
  const state=typeof window.enState==='function'?window.enState():null,mode=state?.ex?.items?.[state.ex.index]?.mode||state?.ex?.mode;
  const phraseCards=['cards','listen'].includes(mode);
  if(!structured&&!cards&&!phraseCards)return false;
  const changed=structured&&old.dataset.step!==next.dataset.step;
  if(changed){attributes(old,next);old.replaceChildren(...next.childNodes);}
  else morph(old,next);
  sync();if(changed)old.querySelector('[data-en-training-form]')?.scrollTo({top:0});
  return true;
 }
 let frame=0,revealPending=false;
 function sync(){
  frame=0;const node=document.querySelector('.en-practice-workspace');if(!node||innerWidth>760)return;
  if(!node.dataset.enTop){const top=node.getBoundingClientRect().top+scrollY;node.dataset.enTop=String(Math.max(0,top));}
  const top=Number(node.dataset.enTop),v=window.visualViewport,height=Math.max(120,(v?.height||innerHeight)+(v?.offsetTop||0)-top-8);
  node.style.setProperty('--en-practice-top',top+'px');node.style.setProperty('--en-practice-height',height+'px');node.dataset.enViewport='stable';
  if(revealPending){
   revealPending=false;const field=document.activeElement,form=field?.closest?.('[data-en-training-form]');
   if(form&&node.contains(form)){const r=field.getBoundingClientRect(),box=form.getBoundingClientRect();if(r.bottom>box.bottom-12)form.scrollTop+=r.bottom-box.bottom+12;else if(r.top<box.top+8)form.scrollTop-=box.top+8-r.top;}
  }
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(sync);}
 function viewportChanged(){revealPending=true;schedule();}
 window.FlowEnglishRender={patch,sync};
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
 document.addEventListener('focusin',event=>{if(event.target.matches?.('.en-practice-workspace textarea'))viewportChanged();});
 window.addEventListener('resize',viewportChanged);window.visualViewport?.addEventListener('resize',viewportChanged);window.visualViewport?.addEventListener('scroll',viewportChanged);schedule();
})();
