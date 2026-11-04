/* Native geometry is reported by Android, in physical pixels. No device guesses. */
(() => {
  'use strict';
  const root=document.documentElement;
  let page='',frame=0;
  function route(){
    frame=0;portalActions();const next=typeof ui==='undefined'?'':ui.page;if(!next||next===page)return;page=next;root.dataset.flowPage=page;
    if(root.dataset.flowNative==='true')try{window.SorokaNative?.pianoRotation?.(page==='piano');}catch{}
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(route);};
  function portalActions(){
    if(root.dataset.flowNative!=='true'||root.dataset.flowDesign!=='magic')return;
    const menu=document.querySelector('.dm-topbar .header-menu');if(!menu)return;
    const headings=document.querySelectorAll('.dm-main :is(.dm-page-heading,.dc2-library-head,.dc2-category-head,.dc-category-head,.dc-movie-title-row,.dl-heading,.ds2-heading,.ds-work-head,.dc-heading,.lv-heading)');
    const controls=[...headings].flatMap(h=>[...h.querySelectorAll('button,details')].filter(n=>!n.closest('.head-pill')&&(!n.closest('details')||n.matches('details')))).filter(n=>!n.matches('[data-action=calendar-expand]'));
    if(!controls.length)return;
    let group=menu.querySelector('.dm-section-actions');if(!group){group=document.createElement('div');group.className='dm-section-actions';menu.prepend(group);}
    group.replaceChildren();
    for(const control of controls){if(control.matches('[data-action=calendar-expand]'))continue;
      if(control.matches('button')&&!control.textContent.trim()){const label=control.getAttribute('aria-label')||control.title;if(label){const text=document.createElement('span');text.textContent=label;control.append(text);}}
      group.append(control);
    }
  }
  new MutationObserver(schedule).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  function update(value=window.flowNativeInsets){
    if(!value||!Number.isFinite(value.width)||value.width<=0)return;
    const scale=value.width/innerWidth;
    if(!Number.isFinite(scale)||scale<=0)return;
    root.dataset.flowNative='true';
    root.dataset.nativeCamera=String(value.cameraX>=0&&value.top>0);
    for(const edge of ['top','right','bottom','left'])root.style.setProperty('--native-safe-'+edge,Math.max(0,value[edge]/scale)+'px');
    root.style.setProperty('--native-camera-x',(value.cameraX/scale)+'px');
    root.style.setProperty('--native-camera-bottom',(value.cameraBottom/scale)+'px');
    root.dataset.nativeKeyboard=String(value.ime>0);
    if(page==='')route();else try{window.SorokaNative?.pianoRotation?.(page==='piano');}catch{}
    window.dispatchEvent(new CustomEvent('flow:windowgeometry',{detail:value}));
  }
  addEventListener('flow:nativeinsets',event=>update(event.detail));
  addEventListener('resize',()=>update());
  update();
  schedule();
})();
