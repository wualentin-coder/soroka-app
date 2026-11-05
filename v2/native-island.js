/* Native overlay requests reuse the current assistant and the section owners. */
(() => {
  'use strict';
  const bridge=()=>window.SorokaAndroid;
  let pending=null,working=false,timer=0,lastState='',activity={kind:'idle',label:'Flow',progress:null},observedAt=Date.now();
  const done=new Set(),allowed=new Set(['assistant','render','sport','today']);
  const root=document.documentElement;
  let popup=false,popupOpened=false,closing=false,expanding=false,suspended=false,entrySheet=null,entryComposer=null,closeFrame=0,classicDraft=null;
  let entryCaptures=new Set();
  const sheet=()=>typeof ui==='undefined'?null:ui.sheet;
  function syncPopup(fresh=false){
    let value=false;try{value=bridge()?.assistantPopup?.()===true;}catch{}
    if(expanding&&value&&!fresh)return;
    if(value&&(!popup||fresh)){
      entrySheet=sheet();entryComposer=window.flowCompose?.getState()?.layer||null;
      entryCaptures=new Set(document.querySelectorAll?.('.live-capture-backdrop')||[]);
      popupOpened=false;closing=false;
    }
    popup=value;expanding=false;root.dataset.assistantPopup=String(value);
  }
  function rememberClassic(){
    if(!popup||window.flowAssistant||!window.flowCompose?.getState()?.open)return;
    const current=window.flowCompose.getState();classicDraft={...window.flowCompose.getDraft(),context:current.context};
  }
  function settlePopup(){
    closeFrame=0;
    if(!popup||!popupOpened||closing||expanding||suspended||document.hidden||pending)return;
    if(window.flowAssistant?.getState().open)return;
    const composer=window.flowCompose?.getState();
    if(composer?.open&&(!window.flowAssistant||composer.layer!==entryComposer))return;
    if(sheet()&&sheet()!==entrySheet)return;
    if([...document.querySelectorAll?.('.live-capture-backdrop')||[]].some(node=>!entryCaptures.has(node)))return;
    closing=true;try{bridge()?.assistantPopupClose?.();}catch{closing=false;}
  }
  function scheduleClose(){if(popup&&!closeFrame)closeFrame=requestAnimationFrame(settlePopup);}
  window.flowAssistantPopup=Object.freeze({
    get active(){return popup;},
    expand(){
      if(!popup)return;
      popup=false;expanding=true;root.dataset.assistantPopup='false';
      if(closeFrame)cancelAnimationFrame(closeFrame);closeFrame=0;
      try{bridge()?.assistantPopupExpand?.();}catch{}
    }
  });
  window.addEventListener('flow:assistantpopupchange',()=>syncPopup(true));
  window.addEventListener('flow:suspend',()=>{rememberClassic();suspended=true;});
  document.addEventListener('flow:assistantphase',scheduleClose);
  document.addEventListener('flow:composer',event=>{if(event.detail?.reason==='submitted')classicDraft=null;scheduleClose();});
  for(const name of ['input','change','pointerdown','keydown'])document.addEventListener(name,rememberClassic,true);
  const app=document.body||document.getElementById?.('app');
  if(app)new MutationObserver(scheduleClose).observe(app,{subtree:true,childList:true});

  function publish(){
    clearTimeout(timer);timer=0;
    const api=bridge();if(typeof api?.islandUpdate!=='function')return;
    const raw=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const accent=/^(#[\da-f]{3,8}|rgba?\([\d.,%\s]+\))$/i.test(raw)?raw:'#75a7ff';
    const kind=String(activity.kind||'idle').slice(0,24),ttl=['event','task'].includes(kind)?60000:15000;
    const fresh=activity.fresh!==false&&(kind==='idle'||Date.now()-observedAt<=ttl);
    const state={kind,label:String(activity.label||'Flow').slice(0,120),progress:fresh&&typeof activity.progress==='number'&&Number.isFinite(activity.progress)?Math.max(0,Math.min(100,activity.progress)):null,fresh,accent};
    const key=JSON.stringify(state);if(key===lastState)return;
    try{api.islandUpdate(JSON.stringify({...state,at:observedAt}));lastState=key;}catch{}
  }
  function ack(id){try{bridge()?.islandAck?.(id);}catch{}done.add(id);if(done.size>64)done.delete(done.values().next().value);}
  function consume(){
    if(working||!pending||document.hidden||suspended)return;
    const request=pending;
    if(done.has(request.id)){pending=null;ack(request.id);return;}
    working=true;
    try{
      let opened=false;
      if(request.action==='assistant'){
        if(window.flowAssistant){
          if(!window.flowAssistant.getState().open)window.flowAssistant.open(document.querySelector('.activity-island'));
          opened=window.flowAssistant.getState().open;
        }else if(document.documentElement.dataset.flowDesign==='classic'&&window.flowCompose){
          if(!window.flowCompose.getState().open)window.flowCompose.open({context:'any',...classicDraft,focus:false});
          opened=window.flowCompose.getState().open;
        }
      }else if(typeof navigate==='function'&&typeof ui!=='undefined'){
        if(ui.page!==request.action)navigate(request.action);
        // Declining the owner's unsaved-form prompt consumes this tap too.
        opened=true;
      }
      if(opened){if(popup&&request.action==='assistant')popupOpened=true;pending=null;ack(request.id);}
    }catch{if(typeof toast==='function')toast('Не удалось открыть Flow. Попробуй ещё раз.');}
    finally{working=false;}
  }
  function ready(){
    suspended=false;syncPopup();
    const manual=sheet()&&sheet()!==entrySheet;
    if(popup&&popupOpened&&!closing&&!document.hidden&&!manual&&window.flowAssistant&&!window.flowAssistant.getState().open)window.flowAssistant.open();
    lastState='';publish();consume();try{bridge()?.islandReady?.();}catch{}
  }
  window.addEventListener('flow:nativeisland',event=>{
    const value=event.detail,id=String(value?.id||'');
    if(!/^[\w:-]{1,96}$/.test(id)||!allowed.has(value?.action))return;
    syncPopup();pending={id,action:value.action};consume();
  });
  document.addEventListener('flow:activity',event=>{activity=event.detail||activity;observedAt=Date.now();if(!timer)timer=setTimeout(publish,120);});
  document.addEventListener('flow:effectschange',()=>{lastState='';publish();});
  window.addEventListener('flow:resume',ready);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)ready();});
  window.addEventListener('pageshow',ready);
  window.addEventListener('pagehide',()=>{clearTimeout(timer);timer=0;});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
