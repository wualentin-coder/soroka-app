/* Native geometry is reported by Android, in physical pixels. No device guesses. */
(() => {
  'use strict';
  const root=document.documentElement;
  let page='',frame=0,compactMode=null;
  function route(){
    frame=0;
    const compact=root.dataset.flowNative==='true'||innerWidth<=760;
    if(root.dataset.flowCompact!==String(compact))root.dataset.flowCompact=String(compact);
    const rebuild=compactMode!==null&&compactMode!==compact;compactMode=compact;
    if(rebuild&&root.dataset.flowDesign==='magic'&&typeof render==='function')render();
    portalActions();const next=typeof ui==='undefined'?'':ui.page;if(!next||next===page)return;page=next;root.dataset.flowPage=page;
    if(root.dataset.flowNative==='true')try{window.SorokaNative?.pianoRotation?.(page==='piano');}catch{}
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(route);};
  function portalActions(){
    if(root.dataset.flowCompact!=='true'||root.dataset.flowDesign!=='magic')return;
    const bar=document.querySelector('.dm-topbar');if(!bar)return;
    const movie=typeof ui!=='undefined'&&ui.page==='saved'&&ui.savedCategory==='movies';
    const plans=movie&&typeof moviePlansTab==='function'&&moviePlansTab();
    let start=bar.querySelector('.dm-header-movie-start');
    if(plans&&!start){start=document.createElement('div');start.className='dm-header-movie-start';bar.prepend(start);}
    if(!plans){start?.remove();start=null;}
    for(const [action,host] of [['movie-carousel-toggle',start],['movie-filters-toggle',start],['movie-random',movie&&ui.savedFilter!=='reco'?bar.querySelector('.dm-toolbar'):null]]){
      const old=bar.querySelector(`[data-action="${action}"]`),fresh=document.querySelector(`.dm-main .dc-movie-tools [data-action="${action}"]`);
      if(!host){old?.remove();continue;}
      if(fresh){old?.remove();fresh.classList.add('dm-header-view');host.insertBefore(fresh,host.matches('.dm-toolbar')?host.querySelector('.header-menu-wrap'):null);}
    }
    bar.classList.toggle('dm-context-view',Boolean(start));
    const menu=bar.querySelector('.header-menu');if(!menu)return;
    const headings=document.querySelectorAll('.dm-main :is(.dm-page-heading,.dc2-library-head,.dc2-category-head,.dc-category-head,.dc-movie-title-row,.dl-heading,.ds2-heading,.ds-work-head,.dc-heading,.lv-heading,.dm-finance-view-action,.dc-movie-tools)');
    const controls=[...headings].flatMap(h=>[...h.querySelectorAll('button,details')].filter(n=>!n.closest('.head-pill')&&(!n.closest('details')||n.matches('details')))).filter(n=>!n.matches('[data-action=calendar-expand]'));
    if(!controls.length)return;
    let group=menu.querySelector('.dm-section-actions');if(!group){group=document.createElement('div');group.className='dm-section-actions';menu.prepend(group);}
    // Existing moved controls survive unrelated surface updates; new render wins.
    // The shell owns this group; app rerenders replace the whole shell or source.
    for(const control of controls){const key=control.dataset.action;if(key)for(const old of group.querySelectorAll('[data-action]'))if(old.dataset.action===key&&old.dataset.entity===control.dataset.entity)old.remove();}
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
  addEventListener('resize',()=>{update();schedule();});
  update();
  schedule();
})();
