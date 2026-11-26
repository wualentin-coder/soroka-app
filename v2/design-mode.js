/* One device-local presentation choice. Native data and features remain shared. */
(() => {
  'use strict';
  if (window.flowDesign) return;
  const root=document.documentElement,key='flow-design-mode-v1',themeKey='soroka-planner-theme';
  const read=()=>{try{const value=localStorage.getItem(key);return value==='classic'||value==='glow'?value:'magic';}catch{return 'magic';}};
  /* Glow is drawn over Digital Magic: markup and behaviour stay magic, data-flow-skin adds the Glow look. */
  const mode=read(),base=mode==='glow'?'magic':mode;root.dataset.flowDesign=base;if(mode==='glow')root.dataset.flowSkin='glow';
  function configure(link){
    if(!(link instanceof HTMLLinkElement)||link.rel!=='stylesheet')return;
    const name=new URL(link.href,document.baseURI).pathname.split('/').pop();
    if(/^digital-[^/]+\.css$/.test(name))link.disabled=base==='classic';
    else if(/^glow-[^/]+\.css$/.test(name))link.disabled=mode!=='glow';
  }
  for(const link of document.querySelectorAll('link[rel="stylesheet"]'))configure(link);
  new MutationObserver(records=>{for(const record of records){if(record.type==='attributes')configure(record.target);for(const node of record.addedNodes){if(node.nodeType!==1)continue;configure(node);for(const link of node.querySelectorAll('link[rel="stylesheet"]'))configure(link);}}}).observe(document.head,{childList:true,subtree:true,attributes:true,attributeFilter:['href','rel']});
  const boot=document.currentScript,icon=document.querySelector('link[rel="icon"]');
  if(mode==='classic'&&icon)icon.href=boot?.dataset.classicIcon||'./assets/flow-logo.svg';
  if(mode==='glow'&&boot?.dataset.glowShell){const shell=document.createElement('script');shell.src=boot.dataset.glowShell;shell.defer=true;document.head.appendChild(shell);}
  const visible=node=>!!node&&node.getClientRects().length>0&&getComputedStyle(node).visibility!=='hidden';
  function activeWork(){const voice=window.flowVoice?.getState?.();return voice?.active||['requesting','listening','transcribing'].includes(voice?.state)||[...document.querySelectorAll('[aria-modal="true"],.composer-layer,.sp-bar,.enm-recording,.voice-bar,.flow-assistant-layer:not([hidden])')].some(visible)||document.body?.classList.contains('piano-playing')||[...document.querySelectorAll('audio,video')].some(media=>!media.paused&&!media.ended);}
  function tell(message){const choice=document.querySelector('[data-flow-design-choice]'),hint=choice?.closest('.flow-design-row')?.querySelector('span');if(hint&&document.activeElement===choice){hint.textContent=message;hint.setAttribute('role','status');}else if(typeof window.toast==='function')window.toast(message);document.dispatchEvent(new CustomEvent('flow:designchange',{detail:{mode,preferred:read(),message}}));}
  function select(next){
    if(!['magic','classic','glow'].includes(next))return false;
    try{
      const theme=(typeof ui!=='undefined'&&ui.theme)||localStorage.getItem(themeKey);if(theme)localStorage.setItem('flow-design-theme-'+mode,theme);
      localStorage.setItem(key,next);
      if(next===mode){if(theme)localStorage.setItem(themeKey,theme);tell('Этот дизайн уже включён');return true;}
      const remembered=localStorage.getItem('flow-design-theme-'+next);
      const nextTheme=next!=='classic'?(['dark','midnight','graphite'].includes(remembered)?remembered:['dark','midnight','graphite'].includes(theme)?theme:'dark'):(remembered||theme||'dark');
      localStorage.setItem(themeKey,nextTheme);
      if(activeWork()){tell('Дизайн сохранён. Применится при следующем открытии Flow.');return true;}
    }catch{tell('Не удалось сохранить выбор дизайна в этом браузере');return false;}
    location.reload();return true;
  }
  window.flowDesign=Object.freeze({mode,base,get preference(){return read();},get pending(){return read()!==mode;},setMode:select});
  document.addEventListener('change',event=>{const choice=event.target.closest?.('[data-flow-design-choice]');if(!choice)return;if(!select(choice.value))choice.value=read();});
})();
