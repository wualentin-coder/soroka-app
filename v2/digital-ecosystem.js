/* Shared light responds to real controls and owner events. No field contents are read. */
(() => {
  'use strict';
  if (document.documentElement.dataset.flowDesign === 'classic') return;
  if (window.flowEcosystem) return;
  const root = document.documentElement, abort = new AbortController(), signal = abort.signal;
  const selector = '.sheet,.composer,.enm-song-sheet,.pins-drop-card,.pn-dialog,dialog,[role="dialog"]';
  const surfaces = new Set(), observers = new Map(), media = new Set(), inputs = new Map(), microphones = new Set(), pendingScopes = new Set();
  let frame = 0, disposed = false, active = null, voice = 'idle', voiceLevel = 0, activity = null, capture = 'idle', captureRequest = null, speaking = false, settleTimer = 0;
  const reduced = () => window.flowDigital?.reducedMotion?.() ?? matchMedia('(prefers-reduced-motion:reduce)').matches;
  const moving = () => !disposed && !document.hidden && !reduced();
  function visible(node) { return node.isConnected && !node.hidden && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'; }
  function clearInput(surface) { const owned = inputs.get(surface); if (!owned) return; for (const effect of owned.effects) effect.cancel(); owned.node.remove(); inputs.delete(surface); }
  function attach(surface) {
    if (surfaces.has(surface) || surface.closest('.dm-live-assistant') || surface.matches('.activity-island-card')) return;
    surfaces.add(surface); surface.classList.add('flow-living-surface');
    if (getComputedStyle(surface).position === 'static') surface.classList.add('flow-surface-static');
    const contour = document.createElement('i'); contour.className = 'flow-surface-contour'; contour.setAttribute('aria-hidden', 'true');surface.append(contour);
  }
  function scan(scope) {
    if(scope.matches?.(selector))attach(scope);
    for (const node of scope.querySelectorAll(selector)) attach(node);
    if(scope.shadowRoot&&!observers.has(scope.shadowRoot))watch(scope.shadowRoot);
    for (const host of scope.querySelectorAll('*')) if (host.shadowRoot && !observers.has(host.shadowRoot)) watch(host.shadowRoot);
  }
  function watch(scope) {
    if (observers.has(scope)) return;
    const observer = new MutationObserver(records => {
      let changed=false;
      for(const record of records){
        if(record.type==='attributes'){if(record.target.id==='mic-badge'||['open','hidden'].includes(record.attributeName))changed=true;continue;}
        for(const node of record.addedNodes)if(node.nodeType===1&&!node.matches('.flow-surface-contour,.flow-input-light,.flow-input-source,.flow-input-spread')){pendingScopes.add(node);changed=true;}
        if([...record.removedNodes].some(node=>node.nodeType===1&&!node.matches('.flow-surface-contour,.flow-input-light,.flow-input-source,.flow-input-spread')))changed=true;
      }
      if(changed)schedule();
    });
    observer.observe(scope, { childList: true, subtree: true, attributes:true, attributeFilter:['class','open','hidden'] }); observers.set(scope, observer); scan(scope);
  }
  function paint() {
    frame = 0; if (disposed) return;
    for(const scope of pendingScopes)if(scope.isConnected)scan(scope);pendingScopes.clear();
    for (const scope of observers.keys()) if (scope instanceof ShadowRoot) { if (!scope.host.isConnected) { observers.get(scope).disconnect(); observers.delete(scope);microphones.delete(scope); } else {const badge=scope.querySelector('#mic-badge');if(badge?.classList.contains('on'))microphones.add(scope);else microphones.delete(scope);} }
    for (const surface of surfaces) if (!surface.isConnected) { clearInput(surface); surfaces.delete(surface); }
    const list = [...surfaces].filter(visible); active = list.find(surface=>{const owner=surface.getRootNode();return surface.contains(owner.activeElement||document.activeElement);}) || list.at(-1) || null;
    for (const surface of surfaces) { surface.classList.toggle('flow-surface-attention', surface === active); surface.classList.toggle('flow-surface-resting', !moving() || !visible(surface)); }
    if (active) root.dataset.flowSurface = 'window'; else delete root.dataset.flowSurface;
    for (const [surface] of inputs) if (!moving() || !visible(surface)) clearInput(surface);
    avoidAssistant();syncProcess();
    const pill = document.querySelector('.dm-topbar .head-pill');
    if (pill && !window.flowCompose && window.FlowActivity && typeof ui !== 'undefined' && typeof data !== 'undefined') window.FlowActivity.mount(pill, { section: 'Flow', page: () => ui.page, data: () => data, pinned: () => window.flowCompose?.open?.(), open: (kind, id) => { if (typeof openEntry === 'function') openEntry(kind, '', id); } });
  }
  function schedule() { if (!frame && !disposed) frame = requestAnimationFrame(paint); }
  function avoidAssistant(){
    if(window.flowAssistant?.getState?.().open)return;
    const controls=[...document.querySelectorAll('.primary-button,button[type=submit],[data-assistant-reserve],input:not([type=hidden]),textarea,select,[contenteditable="true"],.finance-row .amount,.tx-day-head b,.dm-finance-root .list-copy,.dm-finance-obligations,.dm-category-ledger .cat-sum,.dm-finance-root button:not(.finance-row):not(.swipe-action),.dm-finance-root summary')].map(node=>{const rect=node.getBoundingClientRect();return rect.width>0&&rect.height>0?rect:null;}).filter(Boolean);
    for(const fab of document.querySelectorAll('.assistant-fab')){
      const previous=Number.parseFloat(fab.style.getPropertyValue('--assistant-avoid'))||0,measured=fab.getBoundingClientRect(),box={left:measured.left,right:measured.right,top:measured.top+previous,bottom:measured.bottom+previous};
      const overlap=(r,o)=>r.left<o.right+10&&r.right>o.left-10&&r.top<o.bottom+10&&r.bottom>o.top-10;
      let lift=0;for(let i=0;i<6;i++){const occupied=controls.find(rect=>overlap({left:box.left,right:box.right,top:box.top-lift,bottom:box.bottom-lift},rect));if(!occupied)break;lift=Math.max(lift,box.bottom-occupied.top+18);}
      const placed={left:box.left,right:box.right,top:box.top-lift,bottom:box.bottom-lift};
      const obstructed=placed.top<150||controls.some(rect=>overlap(placed,rect));
      fab.inert=obstructed;
      if(obstructed)fab.dataset.avoidHidden='true';else {fab.removeAttribute('data-avoid-hidden');if(lift!==previous)fab.style.setProperty('--assistant-avoid',lift+'px');}
    }
  }
  function fieldOf(event) { return event.composedPath().find(node => node instanceof Element && node.matches('input,textarea,[contenteditable="true"]')); }
  function fieldBounds(field) {
    const box = field.getBoundingClientRect();
    if (!field.isContentEditable) return box;
    const selection = field.ownerDocument.getSelection();
    let caret = null;
    if (selection?.rangeCount && field.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0).cloneRange();
      range.collapse(true);
      const measured = range.getBoundingClientRect();
      if (measured.height > 0 && measured.bottom > box.top && measured.top < box.bottom) caret = measured;
    }
    // A document editor answers at the current line, without outlining the entire page.
    // Geometry only: field contents never enter the effects layer.
    const top = Math.max(box.top, (caret?.top ?? box.top + 12) - 6);
    const bottom = Math.min(box.bottom, caret ? caret.bottom + 6 : top + (parseFloat(getComputedStyle(field).lineHeight) || 26) + 12);
    return { left: box.left, right: box.right, top, bottom, width: box.width, height: bottom - top };
  }
  function surfaceOf(field) { if(!field)return null;let surface=field.closest('.flow-living-surface');if(!surface){surface=field.closest(selector)||field.closest('form');if(surface&&!surface.closest('.dm-live-assistant'))attach(surface);}return surface?.classList.contains('flow-living-surface')?surface:null; }
  function focus(event) {
    const field = fieldOf(event), surface = surfaceOf(field); if (!surface) return;
    const a = surface.getBoundingClientRect(), b = fieldBounds(field);
    surface.style.setProperty('--surface-x', `${b.left + b.width / 2 - a.left}px`); surface.style.setProperty('--surface-y', `${b.top + b.height / 2 - a.top}px`);
    surface.classList.add('flow-surface-focused');schedule();
  }
  function input(event) {
    const field = fieldOf(event), surface = surfaceOf(field); if(!surface&&field?.closest('.dm-live-assistant')){if(moving())window.flowAssistantVisual?.react?.('typing');return;}if (!surface || field.matches('input[type=range],input[type=checkbox],input[type=radio],input[type=file]')) return;
    focus(event); if (!moving()) { clearInput(surface); return; }
    const now = performance.now(); let owned = inputs.get(surface);
    if (owned && now - owned.at < 48) return;
    const a = surface.getBoundingClientRect(), b = fieldBounds(field);
    if (b.bottom <= a.top || b.top >= a.bottom) return;
    const cadence = owned?.field === field ? Math.max(0, 1 - Math.min(360, now - owned.at) / 360) : 0, strength = .58 + cadence * .3, duration = 480 + Math.round(cadence * 130);
    const previous = owned ? [...owned.node.children].map(node => Number(getComputedStyle(node).opacity) || 0) : [0, 0];
    if (!owned) { const node = document.createElement('span'); node.className = 'flow-input-light'; node.setAttribute('aria-hidden', 'true'); node.innerHTML = '<i class="flow-input-source"></i><i class="flow-input-spread"></i>'; surface.append(node); owned = { node, effects: [], at: 0 }; inputs.set(surface, owned); }
    for (const effect of owned.effects) effect.cancel();
    owned.at = now; owned.field = field; owned.strength = strength;
    owned.node.toggleAttribute('data-rich', field.isContentEditable);
    for (const [key, value] of Object.entries({ x: b.left + b.width / 2 - a.left, y: b.top + b.height / 2 - a.top, left: b.left - a.left, top: b.top - a.top, width: b.width, height: b.height })) owned.node.style.setProperty('--input-' + key, `${value}px`);
    owned.node.style.setProperty('--input-radius', getComputedStyle(field).borderRadius);
    owned.effects = [...owned.node.children].map((node, i) => node.animate([{ opacity: previous[i] }, { opacity: strength, offset: i ? .2 : .12 }, { opacity: strength * .5, offset: .48 }, { opacity: 0 }], { duration: duration - (i ? 0 : 80), easing: 'cubic-bezier(.2,.6,.25,1)' }));
    const last = owned.effects[1]; last.finished.then(() => { if (inputs.get(surface)?.effects.includes(last)) clearInput(surface); }, () => {});
  }
  let publishedProcess='';
  function syncProcess() {
    const scenes={pause:'pause',render:'render',timer:'render',think:'think',disconnected:'error',error:'error',success:'success',music:'idle',practice:'idle'};
    const scene = microphones.size?'listen':speaking ? 'speak' : ['requesting', 'listening', 'transcribing'].includes(voice) ? (voice === 'listening' ? 'listen' : 'think') : capture !== 'idle' ? capture : scenes[activity?.kind]||'idle';
    const progress = ['render','pause'].includes(scene)&&['render','pause','timer'].includes(activity?.kind) ? activity.progress : null;
    const focus=microphones.size||['requesting','listening','transcribing'].includes(voice)?'recording':speaking?'voice':media.size?'media':'none';
    const stamp=JSON.stringify([scene,voiceLevel,progress,focus]);if(stamp===publishedProcess)return;publishedProcess=stamp;
    root.dataset.magicScene = scene; root.style.setProperty('--magic-level', String(voiceLevel)); root.style.setProperty('--magic-progress', String(progress ?? 0));
    window.flowSound?.setFocus(microphones.size||['requesting','listening','transcribing'].includes(voice) ? 'recording' : speaking ? 'voice' : media.size ? 'media' : 'none', 'ecosystem');
    document.dispatchEvent(new CustomEvent('flow:processstate', { detail: { state: scene, level: voiceLevel, progress } }));
  }
  window.addEventListener('keydown',event=>{if(event.key==='Escape')for(const [surface] of inputs)clearInput(surface);},{capture:true,signal});
  document.addEventListener('focusin', focus, { capture: true, signal });
  document.addEventListener('input', input, { capture: true, signal });
  document.addEventListener('compositionend', input, { capture: true, signal });
  document.addEventListener('focusout', event => { const field = fieldOf(event), surface = surfaceOf(field); if (surface) { clearInput(surface); surface.classList.remove('flow-surface-focused');schedule(); } }, { capture: true, signal });
  document.addEventListener('scroll', () => { for (const [surface] of inputs) clearInput(surface);schedule(); }, { capture: true, passive: true, signal });
  document.addEventListener('flow:voice', event => { voice = event.detail?.state || 'idle'; voiceLevel = event.detail?.level || 0; syncProcess(); }, { signal });
  document.addEventListener('flow:activity', event => { activity = event.detail; syncProcess(); }, { signal });
  document.addEventListener('flow:composecapture', event => {
    const value=event.detail||{};
    if(value.phase==='submitting')captureRequest=value.requestId;
    else if(value.phase==='closed'){if(value.retain)return;captureRequest=null;}
    else if(value.requestId!==captureRequest)return;
    clearTimeout(settleTimer);
    const empty=value.phase==='result'&&!String(value.reply||'').trim()&&!(Array.isArray(value.records)&&value.records.length);
    capture=empty?'error':({submitting:'think',accepted:'think',result:'success',error:'error',pending:'idle',closed:'idle'})[value.phase]||'idle';
    if(['success','error'].includes(capture))settleTimer=setTimeout(()=>{capture='idle';syncProcess();},capture==='error'?3200:1800);
    syncProcess();
  }, { signal });
  document.addEventListener('flow:speech', event => { speaking = event.detail?.speaking === true; syncProcess(); }, { signal });
  document.addEventListener('play', event => { if (event.target instanceof HTMLMediaElement) { media.add(event.target); syncProcess(); } }, { capture: true, signal });
  for (const name of ['pause', 'ended', 'emptied']) document.addEventListener(name, event => { media.delete(event.target); syncProcess(); }, { capture: true, signal });
  document.addEventListener('flow:audiofocus', event => { const owner = event.detail?.owner || 'practice'; if (event.detail?.active) media.add(owner); else media.delete(owner); syncProcess(); }, { signal });
  document.addEventListener('flow:effectschange', schedule, { signal });
  function viewportChanged() { for (const [surface] of inputs) clearInput(surface); schedule(); }
  window.addEventListener('resize', viewportChanged, { passive: true, signal });
  window.visualViewport?.addEventListener('resize', viewportChanged, { passive: true, signal });
  document.addEventListener('visibilitychange', () => { document.body.classList.toggle('digital-hidden', document.hidden); if (document.hidden) for (const [surface] of inputs) clearInput(surface); schedule(); }, { signal });
  window.addEventListener('pagehide', () => { for (const [surface] of inputs) clearInput(surface); if (frame) cancelAnimationFrame(frame); frame = 0; }, { signal });
  window.addEventListener('pageshow', schedule, { signal });
  window.flowEcosystem = { refresh() { pendingScopes.add(document.body);schedule(); }, getState: () => ({ surfaces: surfaces.size, activeSurface: !!active, typingLayers: inputs.size, typingAnimations: [...inputs.values()].reduce((n, item) => n + item.effects.filter(effect => effect.playState === 'running').length, 0), scene: root.dataset.magicScene, mediaOwners: media.size, microphoneOwners:microphones.size, voice, physicalHapticsVerified: false }), dispose() { disposed = true; abort.abort(); for(const fab of document.querySelectorAll('.assistant-fab')){fab.inert=false;fab.style.removeProperty('--assistant-avoid');fab.removeAttribute('data-avoid-hidden');} clearTimeout(settleTimer); if (frame) cancelAnimationFrame(frame); for (const observer of observers.values()) observer.disconnect(); for (const [surface] of inputs) clearInput(surface); for (const surface of surfaces) { surface.classList.remove('flow-living-surface','flow-surface-static','flow-surface-attention','flow-surface-resting','flow-surface-focused');surface.style.removeProperty('--surface-x');surface.style.removeProperty('--surface-y'); surface.querySelector(':scope>.flow-surface-contour')?.remove(); } } };
  document.addEventListener('click', event => {
    const button=event.target.closest?.('[data-action="list-toggle"]');
    if(!button||button.disabled||!moving())return;
    requestAnimationFrame(()=>{
      const surface=document.querySelector('.dc2-window-lists');
      if(!surface||!visible(surface))return;
      attach(surface);
      surface.animate([{borderColor:'rgba(var(--accent-rgb),.3)'},{borderColor:'rgba(var(--accent-rgb),.95)',offset:.22},{borderColor:'rgba(var(--accent-rgb),.4)'}],{duration:620,easing:'ease-out'});
    });
  }, {capture:true,signal});
  watch(document.body); schedule();
})();
