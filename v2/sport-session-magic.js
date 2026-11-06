/* Presentation only. The existing Countdown remains the sole clock and phase owner. */
(() => {
  'use strict';
  const query=matchMedia('(prefers-reduced-motion: reduce)');
  const drains=new WeakMap();
  const reduced=()=>window.flowDigital?.reducedMotion?.()??(document.documentElement.dataset.motion==='off'||query.matches);
  let face=null,column=null,signature='',phaseKey='',durationKey='',durationTotal=0;
  function stop(){for(const element of [face,column])if(element)for(const a of element.getAnimations({subtree:true}))a.cancel();face=null;column=null;signature='';}
  function respond(){if(!face||reduced()||document.hidden)return;const light=face.querySelector('.ss-timer-response');for(const a of light.getAnimations())a.cancel();light.animate([{opacity:0},{opacity:.65,offset:.25},{opacity:0}],{duration:480,easing:'ease-out'});}
  function paint(){
    const next=document.querySelector('.ss-magic-face'),clock=spTimer.clock,auto=window.flowSportAuto?.view();
    if(!next||!clock||!auto?.active){stop();return;}
    if(face!==next){stop();face=next;column=document.querySelector('.ss-flow-column');}
    const snapshot=clock.snapshot(),ms=Math.max(0,snapshot.pausedMs??snapshot.deadline-Date.now());
    const key=flowSportAuto.commandKey();
    if(durationKey!==key){durationKey=key;durationTotal=auto.step.seconds*1000;}
    durationTotal=Math.max(durationTotal,ms,1);
    // The user explicitly requests continuous time indication even with reduced decorations.
    const offset=1-ms/durationTotal,quiet=reduced()||document.hidden,smooth=!document.hidden;
    const id=`${key}|${snapshot.deadline}|${snapshot.pausedMs}|${quiet}`;
    face.dataset.paused=String(!clock.running);
    face.dataset.long=String(clock.remaining()>=60);
    if(column)column.dataset.paused=String(!clock.running);
    const button=face.querySelector('[data-ss-clock-tap]');
    button.setAttribute('aria-pressed',String(!clock.running));button.setAttribute('aria-label',clock.running?'Приостановить таймер':'Продолжить таймер');
    if(signature!==id){
      signature=id;
      if(column)for(const [selector,from,to]of [['.ss-flow-volume',`scaleY(${1-offset})`,'scaleY(0)'],['.ss-flow-surface',`translateY(${offset*100}%)`,'translateY(100%)']]){
        const layer=column.querySelector(selector);drains.get(layer)?.cancel();layer.style.transform=from;
        if(clock.running&&smooth&&ms>0)drains.set(layer,layer.animate([{transform:from},{transform:to}],{duration:ms,easing:'linear',fill:'forwards'}));
      }
      if(column){
        const sheen=column.querySelector('.ss-flow-refraction');drains.get(sheen)?.cancel();
        // The requested slow refraction is visual only and freezes with the same clock.
        const a=sheen.animate([{transform:'translate3d(-3%,0,0)',opacity:.55},{transform:'translate3d(3%,2%,0)',opacity:1},{transform:'translate3d(-3%,0,0)',opacity:.55}],{duration:9000,iterations:Infinity,easing:'ease-in-out'});
        a.currentTime=Math.max(0,durationTotal-ms)%9000;if(!clock.running||!smooth)a.pause();drains.set(sheen,a);
      }
      if(phaseKey!==key){
        if(phaseKey&&!quiet)respond();
        phaseKey=key;
      }
    }
  }
  const oldPaint=spTimerPaint;spTimerPaint=()=>{oldPaint();paint();};
  document.addEventListener('visibilitychange',paint);
  document.addEventListener('flow:effectschange',()=>{signature='';paint();});
  query.addEventListener('change',()=>{signature='';paint();});
  document.addEventListener('pointerdown',event=>{
    const button=event.target.closest?.('.ss-timer-line button');if(!button||reduced())return;
    respond();button.animate([{transform:'scale(.98)'},{transform:'scale(1)'}],{duration:180,easing:'ease-out'});
  });
  window.flowSportMagic={
    column:()=>document.documentElement.dataset.flowDesign==='classic'?'':'<div class="ss-flow-column" aria-hidden="true"><div class="ss-flow-volume"></div><div class="ss-flow-surface"><div class="ss-flow-refraction"></div></div></div>',
    face:content=>document.documentElement.dataset.flowDesign==='classic'?content:`<div class="ss-magic-face"><div class="ss-timer-material" aria-hidden="true"></div><div class="ss-timer-response" aria-hidden="true"></div>${content}</div>`,
    paint,
  };
})();
