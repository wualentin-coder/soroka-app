/* The approved wide island is an overlay. Its animation never changes page layout. */
(() => {
  'use strict';
  let active=null,suspended=false,fontEpoch=0;
  const root=document.documentElement;
  const reduced=()=>document.hidden||suspended||root.dataset.motion==='off'||window.flowDigital?.reducedMotion?.();
  function shape(width,center,floor,bottom,reveal){
    const half=(44+(floor-44)*reveal)/2,left=center-half,right=center+half;
    const y=42+(bottom-42)*reveal,sweep=Math.max(8,Math.min(72.8,left-8,width-right-8));
    const corner=Math.min(36,sweep*.72),upper=Math.min(36,sweep/2);
    return `M0 42H${left-sweep}C${left-sweep+upper} 42 ${left-corner} ${y} ${left} ${y}H${right}C${right+corner} ${y} ${right+sweep-upper} 42 ${right+sweep} 42H${width}`;
  }
  function draw(s){
    const d=shape(s.width,s.center,s.floor,s.bottom,s.reveal);
    s.fill.setAttribute('d',d+'V-5H0Z');s.rim.setAttribute('d',d);
  }
  function release(){if(!active)return;cancelAnimationFrame(active.frame);active.observer.disconnect();delete active.bar.dataset.islandSurface;active=null;}
  function sync(bar,pill){
    if(!bar?.isConnected||!pill?.isConnected)return;
    if(root.dataset.flowDesign!=='magic'||!(root.dataset.flowCompact==='true'||root.dataset.nativeCamera==='true')){release();return;}
    const canopy=bar.querySelector('.island-canopy');if(!canopy)return;
    let s=active;
    if(s?.bar!==bar){
      release();
      s=active={bar,pill,canopy,svg:canopy.querySelector('svg'),fill:canopy.querySelector('.island-canopy-fill'),rim:canopy.querySelector('.island-canopy-rim'),frame:0};
      s.sizes=new Map();s.dirty=true;
      s.observer=new ResizeObserver(entries=>{
        if(active!==s)return;
        for(const entry of entries){
          const before=s.sizes.get(entry.target),size=[entry.contentRect.width,entry.contentRect.height];
          if(before&&(before[0]!==size[0]||before[1]!==size[1]))s.dirty=true;
          s.sizes.set(entry.target,size);
        }
        sync(bar,s.pill);
      });s.observer.observe(bar);
      bar.dataset.islandSurface='true';
    }
    const text=pill.querySelector('.island-label');if(!text)return;
    if(s.text!==text){if(s.text){s.observer.unobserve(s.text);s.sizes.delete(s.text);}s.text=text;s.pill=pill;s.dirty=true;s.observer.observe(text);}
    const camera=root.dataset.flowNative==='true'&&root.dataset.nativeCamera==='true'&&root.dataset.nativeCameraEdge==='top';
    const input=JSON.stringify([text.textContent,camera,root.style.getPropertyValue('--native-camera-x'),innerWidth,window.visualViewport?.scale,fontEpoch,
      bar.className,bar.style.width,bar.style.maxWidth,bar.style.font,bar.style.letterSpacing]);
    const reveal=pill.dataset.islandOrb==='true'||root.dataset.cameraCalibration==='true'?0:1;
    if(!s.dirty&&s.input===input&&s.goal?.reveal===reveal)return;
    const width=bar.clientWidth;
    const center=camera?parseFloat(getComputedStyle(root).getPropertyValue('--native-camera-x'))||width/2:width/2;
    if(s.dirty||s.input!==input||s.width!==width||s.center!==center){
      const measure=document.createElement('span');measure.className='island-text-meter';measure.textContent=text.textContent;
      measure.style.maxWidth=Math.max(80,Math.min(center,width-center)*2-156)+'px';bar.append(measure);
      const rect=measure.getBoundingClientRect();s.labelWidth=Math.ceil(rect.width)+26;s.labelHeight=Math.max(18,Math.ceil(rect.height));measure.remove();
      s.input=input;s.dirty=false;
    }
    const labelWidth=s.labelWidth,labelHeight=s.labelHeight,target={floor:labelWidth+32,bottom:Math.max(82,51+labelHeight+13),reveal};
    if(s.goal&&s.width===width&&s.center===center&&Object.keys(target).every(k=>s.goal[k]===target[k]))return;
    for(const [property,value] of [['--island-label-width',labelWidth+'px'],['--island-label-height',labelHeight+'px'],['--island-tongue-bottom',target.bottom+'px']]){
      if(bar.style.getPropertyValue(property)!==value)bar.style.setProperty(property,value);
    }
    const viewBox=`0 0 ${width} 256`;if(s.svg.getAttribute('viewBox')!==viewBox)s.svg.setAttribute('viewBox',viewBox);
    cancelAnimationFrame(s.frame);s.frame=0;
    const first=!s.goal,was=s.goal?.reveal;s.goal=target;s.width=width;s.center=center;
    if(first||reduced()){Object.assign(s,target);draw(s);return;}
    const from={floor:s.floor,bottom:s.bottom,reveal:s.reveal},start=performance.now();
    const duration=target.reveal<from.reveal?560:target.reveal>from.reveal?720:620;
    if(was!==target.reveal)window.flowSound?.feedback(target.reveal?'open':'close');
    const step=now=>{
      if(active!==s||!bar.isConnected){release();return;}
      const t=reduced()?1:Math.min(1,(now-start)/duration),e=(1-(1+7*t)*Math.exp(-7*t))/(1-8*Math.exp(-7));
      for(const k of Object.keys(from))s[k]=from[k]+(target[k]-from[k])*e;
      draw(s);s.frame=t<1?requestAnimationFrame(step):0;
    };
    s.frame=requestAnimationFrame(step);
  }
  const refresh=()=>{const bar=document.querySelector('.dm-topbar');sync(bar,bar?.querySelector('.activity-island'));};
  const geometryChanged=()=>{if(active)active.dirty=true;refresh();};
  window.FlowIslandSurface={sync,shape,refresh};
  window.addEventListener('flow:windowgeometry',geometryChanged);
  window.addEventListener('resize',geometryChanged);
  const syncVisibility=()=>{root.dataset.islandSuspended=String(suspended||document.hidden);};
  window.addEventListener('flow:suspend',()=>{suspended=true;syncVisibility();if(active){active.goal=null;refresh();}});
  window.addEventListener('flow:resume',()=>{suspended=false;syncVisibility();refresh();});
  document.addEventListener('visibilitychange',()=>{syncVisibility();if(active){active.goal=null;refresh();}});
  window.addEventListener('pagehide',release);
  const fontsChanged=()=>{fontEpoch++;geometryChanged();};
  document.fonts?.ready.then(fontsChanged);
  document.fonts?.addEventListener('loadingdone',fontsChanged);
  document.fonts?.addEventListener('loadingerror',fontsChanged);
})();
