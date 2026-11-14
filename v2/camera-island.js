/* One camera-centred surface. Geometry comes from native-window, never a guessed device model. */
(()=>{
 'use strict';
 const root=document.documentElement;let active=null,hold=0,held=false,start=null;
 function sync(bar,pill){
  if(!bar?.isConnected||!pill?.isConnected||root.dataset.flowDesign!=='magic')return;
  root.dataset.cameraLayer='true';bar.dataset.cameraLayer='true';
  const css=getComputedStyle(root),native=root.dataset.nativeCamera==='true'&&root.dataset.nativeCameraEdge==='top';
  const rect=bar.getBoundingClientRect(),x=native?parseFloat(css.getPropertyValue('--native-camera-x')):rect.x+rect.width/2;
  const y=native?parseFloat(css.getPropertyValue('--native-camera-center-y')):rect.y+22;
  const assistantOnly=['idle','return'].includes(pill.dataset.activity);
  pill.dataset.cameraAssistantOnly=String(assistantOnly);
  const compact=assistantOnly||pill.dataset.islandOrb==='true'||root.dataset.cameraCalibration==='true';
  const label=pill.querySelector('.island-label'),value=pill.dataset.compactValue||'';
  if(label&&label.textContent!==value)label.textContent=value;
  const textWidth=label?Math.ceil(label.scrollWidth):0,left=compact?22:42,width=compact?44:Math.max(82,42+16+Math.min(65,textWidth)+12);
  const top=Math.max(0,y-22);
  for(const[k,v]of Object.entries({'--camera-button-x':`${x-left}px`,'--camera-button-y':`${top}px`,'--camera-width':`${width}px`,'--camera-ring-x':`${left}px`,'--camera-ring-y':`${y-top}px`}))if(pill.style.getPropertyValue(k)!==v)pill.style.setProperty(k,v);
  pill.dataset.cameraCollapsed=String(compact);
  if(active!==pill){
   active=pill;
   if(!pill.dataset.cameraBound){pill.dataset.cameraBound='true';
    const cancel=()=>{clearTimeout(hold);hold=0;};
    pill.addEventListener('pointerdown',event=>{if(event.button!==0)return;cancel();held=false;start={x:event.clientX,y:event.clientY};hold=setTimeout(()=>{hold=0;if(!pill.isConnected||active!==pill)return;held=true;window.flowAssistant?.open(pill);},450);});
    pill.addEventListener('pointermove',event=>{if(start&&Math.hypot(event.clientX-start.x,event.clientY-start.y)>10)cancel();});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])pill.addEventListener(type,cancel);
    pill.addEventListener('pointerleave',cancel);
    pill.addEventListener('contextmenu',event=>event.preventDefault());
    pill.addEventListener('click',event=>{cancel();if(held||['idle','return'].includes(pill.dataset.activity)){event.preventDefault();event.stopImmediatePropagation();if(!held)window.flowAssistant?.open(pill);held=false;}},true);
   }
  }
  let search=bar.querySelector('.camera-search');if(!search){search=document.createElement('button');search.type='button';search.className='dm-icon-button camera-search';search.dataset.action='search';search.setAttribute('aria-label','Поиск по Flow');search.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg>';bar.prepend(search);}
 }
 window.FlowCameraIsland={sync};
 const refresh=()=>{const bar=document.querySelector('.dm-topbar');sync(bar,bar?.querySelector('.activity-island'));};
 window.addEventListener('resize',refresh);window.addEventListener('flow:windowgeometry',refresh);
 document.fonts?.ready.then(refresh);
 document.addEventListener('visibilitychange',()=>{clearTimeout(hold);hold=0;});
 window.addEventListener('flow:suspend',()=>{clearTimeout(hold);hold=0;});
})();
