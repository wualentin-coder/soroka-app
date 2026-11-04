/* Native geometry is reported by Android, in physical pixels. No device guesses. */
(() => {
  'use strict';
  const root=document.documentElement;
  let page='',frame=0,compactMode=null;
  const cameraKey='flow-camera-alignment-v1';
  let geometry=null,cameraPreference=null;
  try{cameraPreference=JSON.parse(localStorage.getItem(cameraKey)||'null');}catch{}
  const cameraAvailable=()=>root.dataset.flowNative==='true'&&root.dataset.nativeCamera==='true';
  const nativeCameraY=value=>Number.isFinite(value?.cameraY)&&value.cameraY>0&&value.cameraY<=value.cameraBottom?value.cameraY:null;
  const cameraProfile=value=>{
    const profile=[value.width,value.cameraX,value.cameraBottom].map(Math.round).join(':'),y=nativeCameraY(value);
    return y===null?profile:profile+':y='+y.toFixed(3);
  };
  function cameraY(){
    if(!geometry)return 27;
    const saved=cameraPreference?.version===1&&cameraPreference.profile===cameraProfile(geometry)&&Number.isFinite(cameraPreference.y)&&cameraPreference.y>=0&&cameraPreference.y<=.15?cameraPreference.y*innerWidth:null;
    // Use the native camera centre when available. The protected rectangle is
    // only a fallback; a manual correction belongs to this geometry profile.
    const precise=nativeCameraY(geometry);
    const initial=precise!==null?precise*innerWidth/geometry.width:Number.isFinite(geometry.cameraBottom)&&geometry.cameraBottom>0?geometry.cameraBottom*innerWidth/geometry.width/2:27;
    return Math.max(8,Math.min(44,saved??initial));
  }
  function paintCamera(){
    if(!cameraAvailable()||!geometry)return;
    const y=cameraY(),hitTop=Math.max(0,y-22);
    root.style.setProperty('--native-camera-center-y',y+'px');
    root.style.setProperty('--native-camera-hit-top',hitTop+'px');
    root.style.setProperty('--native-camera-light-offset',(y-hitTop)+'px');
    const range=document.querySelector('[data-native-camera-y]');if(range)range.value=String(y);
  }
  function setCameraY(y){
    if(!cameraAvailable()||!geometry||!Number.isFinite(y))return;
    cameraPreference={version:1,profile:cameraProfile(geometry),y:Math.max(8,Math.min(44,y))/innerWidth};
    try{localStorage.setItem(cameraKey,JSON.stringify(cameraPreference));}catch{if(typeof toast==='function')toast('Положение изменено, но не удалось сохранить его на устройстве');}
    paintCamera();
  }
  function previewCamera(on){
    if(on&&cameraAvailable())root.dataset.cameraCalibration='true';else delete root.dataset.cameraCalibration;
    const panel=document.querySelector('[data-native-camera-controls]');if(panel)panel.hidden=!on;
    const button=document.querySelector('[data-native-camera-open]');if(button)button.setAttribute('aria-expanded',String(on));
  }
  function mountCameraControl(){
    if(!cameraAvailable()||root.dataset.flowDesign!=='magic'||typeof ui==='undefined'||ui.page!=='settings'){
      previewCamera(false);document.querySelector('.native-camera-calibration')?.remove();return;
    }
    const host=document.querySelector('.dv-visual-preferences');if(!host||host.querySelector('.native-camera-calibration'))return;
    const section=document.createElement('section');section.className='native-camera-calibration dv-preference-card';
    section.innerHTML='<h2>Камера и свет</h2><p>Совмести центр свечения с камерой. Положение сохранится на этом телефоне.</p><button type="button" class="tool-button" data-native-camera-open aria-expanded="false">Подстроить положение</button><div data-native-camera-controls hidden><label for="native-camera-y">Положение свечения</label><input id="native-camera-y" data-native-camera-y type="range" min="8" max="44" step="0.1" aria-label="Положение свечения: выше или ниже"><div class="native-camera-nudge"><button type="button" class="tool-button" data-native-camera-nudge="-1">↑ Выше</button><button type="button" class="tool-button" data-native-camera-nudge="1">↓ Ниже</button></div><div class="native-camera-actions"><button type="button" class="text-button" data-native-camera-reset>Сбросить</button><button type="button" class="primary-button" data-native-camera-done>Готово</button></div></div>';
    host.append(section);paintCamera();previewCamera(root.dataset.cameraCalibration==='true');
  }
  document.addEventListener('click',event=>{
    if(event.target.closest?.('[data-native-camera-open]')){previewCamera(true);paintCamera();}
    const nudge=event.target.closest?.('[data-native-camera-nudge]');
    if(nudge&&geometry)setCameraY(cameraY()+Number(nudge.dataset.nativeCameraNudge)*innerWidth/geometry.width);
    if(event.target.closest?.('[data-native-camera-done]'))previewCamera(false);
    if(event.target.closest?.('[data-native-camera-reset]')){cameraPreference=null;try{localStorage.removeItem(cameraKey);}catch{if(typeof toast==='function')toast('Не удалось сохранить сброс положения на устройстве');}paintCamera();}
  });
  document.addEventListener('input',event=>{if(event.target.matches?.('[data-native-camera-y]'))setCameraY(Number(event.target.value));});
  document.addEventListener('flow:assistantphase',event=>{if(event.detail?.open)previewCamera(false);});
  function route(){
    frame=0;
    const compact=root.dataset.flowNative==='true'||innerWidth<=760;
    if(root.dataset.flowCompact!==String(compact))root.dataset.flowCompact=String(compact);
    const rebuild=compactMode!==null&&compactMode!==compact;compactMode=compact;
    if(rebuild&&root.dataset.flowDesign==='magic'&&typeof render==='function')render();
    portalActions();mountCameraControl();const next=typeof ui==='undefined'?'':ui.page;if(!next||next===page)return;page=next;root.dataset.flowPage=page;
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
    geometry=value;
    root.dataset.flowNative='true';
    root.dataset.nativeCamera=String(value.cameraX>=0&&value.top>0);
    for(const edge of ['top','right','bottom','left'])root.style.setProperty('--native-safe-'+edge,Math.max(0,value[edge]/scale)+'px');
    root.style.setProperty('--native-camera-x',(value.cameraX/scale)+'px');
    root.style.setProperty('--native-camera-bottom',(value.cameraBottom/scale)+'px');
    paintCamera();
    if(!cameraAvailable())previewCamera(false);
    schedule();
    root.dataset.nativeKeyboard=String(value.ime>0);
    if(page==='')route();else try{window.SorokaNative?.pianoRotation?.(page==='piano');}catch{}
    window.dispatchEvent(new CustomEvent('flow:windowgeometry',{detail:value}));
  }
  addEventListener('flow:nativeinsets',event=>update(event.detail));
  addEventListener('resize',()=>{update();schedule();});
  update();
  schedule();
})();
