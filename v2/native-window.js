/* Native geometry is reported by Android, in physical pixels. No device guesses. */
(() => {
  'use strict';
  const root=document.documentElement;
  let page='',frame=0,compactMode=null;
  const cameraKey='flow-camera-alignment-v1';
  let geometry=null,cameraPreference=null;
  try{cameraPreference=JSON.parse(localStorage.getItem(cameraKey)||'null');}catch{}
  const cameraAvailable=()=>root.dataset.flowNative==='true'&&root.dataset.nativeCamera==='true';
  const nativeCameraY=value=>Number.isFinite(value?.cameraY)&&value.cameraY>=0&&value.cameraY<=value.cameraBottom?value.cameraY:null;
  const cameraProperties=['--native-camera-x','--native-camera-bottom','--native-camera-center-y','--native-camera-hit-top','--native-camera-hit-left','--native-camera-light-offset','--native-camera-light-offset-x','--native-island-chrome-y'];
  const rotateCamera=(x,y,width,height,rotation)=>rotation===0?{x,y}:rotation===1?{x:y,y:width-x}:rotation===2?{x:width-x,y:height-y}:{x:height-y,y:x};
  function cameraReference(value){
    if(!value||value.cameraAvailable===false||value.fullDisplay===false||!Number.isFinite(value.width)||!Number.isFinite(value.height)||value.width<=0||value.height<=0)return null;
    const modern=value.cameraAvailable===true;
    if(modern&&(value.fullDisplay!==true||!Number.isInteger(value.rotation)))return null;
    const rotation=Number.isInteger(value.rotation)?value.rotation:0;
    if(rotation<0||rotation>3)return null;
    const x=value.cameraX,y=nativeCameraY(value);
    if(!Number.isFinite(x)||x<=0||x>=value.width||y===null||y<=0||y>=value.height)return null;
    if(!modern&&(rotation!==0||value.top<=0||value.width>value.height))return null;
    const bounds=modern?{left:value.cameraLeft,top:value.cameraTop,right:value.cameraRight,bottom:value.cameraBottom}:{left:0,top:0,right:value.width,bottom:value.cameraBottom};
    if(!Object.values(bounds).every(Number.isFinite)||bounds.left<0||bounds.top<0||bounds.right>value.width||bounds.bottom>value.height||bounds.right<=bounds.left||bounds.bottom<=bounds.top||x<bounds.left||x>=bounds.right||y<bounds.top||y>=bounds.bottom)return null;
    const naturalWidth=modern?value.cameraNaturalWidth:value.width,naturalHeight=modern?value.cameraNaturalHeight:value.height;
    const naturalX=modern?value.cameraNaturalX:x,naturalY=modern?value.cameraNaturalY:y,naturalBottom=modern?value.cameraNaturalBottom:value.cameraBottom;
    if(![naturalWidth,naturalHeight,naturalX,naturalY,naturalBottom].every(Number.isFinite)||naturalWidth<=0||naturalHeight<=0||naturalX<0||naturalX>=naturalWidth||naturalY<0||naturalY>=naturalHeight||naturalBottom<=naturalY||naturalBottom>naturalHeight)return null;
    if(value.width!==(rotation%2?naturalHeight:naturalWidth)||value.height!==(rotation%2?naturalWidth:naturalHeight))return null;
    const projected=rotateCamera(naturalX,naturalY,naturalWidth,naturalHeight,rotation);
    if(Math.abs(projected.x-x)>.01||Math.abs(projected.y-y)>.01)return null;
    const edge=modern?value.cameraEdge:'top';
    if(!['top','right','bottom','left'].includes(edge)||!({top:bounds.top===0,right:bounds.right===value.width,bottom:bounds.bottom===value.height,left:bounds.left===0}[edge]))return null;
    return {x,y,bounds,rotation,naturalWidth,naturalHeight,naturalX,naturalY,naturalBottom,edge};
  }
  const cameraProfile=value=>{
    const ref=cameraReference(value),profile=[ref?.naturalWidth??value.width,ref?.naturalX??value.cameraX,ref?.naturalBottom??value.cameraBottom].map(Math.round).join(':'),y=ref?.naturalY??nativeCameraY(value);
    return y===null?profile:profile+':y='+y.toFixed(3);
  };
  function cameraPoint(){
    const ref=cameraReference(geometry);if(!ref)return null;
    const saved=cameraPreference?.version===1&&cameraPreference.profile===cameraProfile(geometry)&&Number.isFinite(cameraPreference.y)&&cameraPreference.y>=0&&cameraPreference.y<=.15?cameraPreference.y*ref.naturalWidth:null;
    const corrected=saved===null?ref:rotateCamera(ref.naturalX,saved,ref.naturalWidth,ref.naturalHeight,ref.rotation);
    // Keep the user's matching portrait calibration through rotation, but never outside the actual cutout.
    const point=corrected.x>0&&corrected.y>0&&corrected.x<geometry.width&&corrected.y<geometry.height&&corrected.x>=ref.bounds.left&&corrected.x<ref.bounds.right&&corrected.y>=ref.bounds.top&&corrected.y<ref.bounds.bottom?corrected:ref;
    const scale=geometry.width/innerWidth;
    return {x:point.x/scale,y:point.y/scale,ref};
  }
  function cameraY(){
    return cameraPoint()?.y??27;
  }
  function paintCamera(){
    if(!cameraAvailable()||!geometry)return;
    const point=cameraPoint();if(!point)return;
    const {x,y,ref}=point,hitTop=Math.max(0,Math.min(innerHeight-44,y-22)),hitLeft=Math.max(0,Math.min(innerWidth-44,x-22));
    root.style.setProperty('--native-camera-x',x+'px');
    root.style.setProperty('--native-camera-bottom',(geometry.cameraBottom*innerWidth/geometry.width)+'px');
    root.style.setProperty('--native-camera-center-y',y+'px');
    root.style.setProperty('--native-camera-hit-top',hitTop+'px');
    root.style.setProperty('--native-camera-hit-left',hitLeft+'px');
    root.style.setProperty('--native-camera-light-offset-x',(x-hitLeft)+'px');
    root.style.setProperty('--native-camera-light-offset',(y-hitTop)+'px');
    root.style.setProperty('--native-island-chrome-y',(ref.edge==='top'?y:22)+'px');
    const range=document.querySelector('[data-native-camera-y]');if(range)range.value=String(y);
  }
  function setCameraY(y){
    if(!cameraAvailable()||!geometry||cameraReference(geometry)?.rotation!==0||!Number.isFinite(y))return;
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
    if(!cameraAvailable()||cameraReference(geometry)?.rotation!==0||root.dataset.flowDesign!=='magic'||typeof ui==='undefined'||ui.page!=='settings'){
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
    const clearCamera=()=>{root.dataset.nativeCamera='false';delete root.dataset.nativeCameraEdge;for(const property of cameraProperties)root.style.removeProperty(property);previewCamera(false);};
    if(!value||!Number.isFinite(value.width)||value.width<=0){clearCamera();return;}
    const scale=value.width/innerWidth;
    if(!Number.isFinite(scale)||scale<=0){clearCamera();return;}
    geometry=value;
    root.dataset.flowNative='true';
    const expectedHeight=(value.height-Math.max(0,value.ime||0))/scale;
    const viewportMatches=Number.isFinite(expectedHeight)&&Math.abs(innerHeight-expectedHeight)<=Math.max(8,innerHeight*.025);
    const reference=viewportMatches?cameraReference(value):null;
    root.dataset.nativeCamera=String(Boolean(reference));
    if(reference)root.dataset.nativeCameraEdge=reference.edge;else clearCamera();
    for(const edge of ['top','right','bottom','left'])root.style.setProperty('--native-safe-'+edge,(Number.isFinite(value[edge])?Math.max(0,value[edge]/scale):0)+'px');
    for(const [name,key] of [['top-left','cornerTopLeft'],['top-right','cornerTopRight'],['bottom-right','cornerBottomRight'],['bottom-left','cornerBottomLeft']]){
      const radius=value[key],property='--native-corner-'+name;
      if(typeof radius==='number'&&Number.isFinite(radius)&&radius>=0)root.style.setProperty(property,(radius/scale)+'px');
      else root.style.removeProperty(property);
    }
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
