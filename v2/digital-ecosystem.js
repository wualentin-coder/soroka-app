/* Shared light responds to real controls and owner events. No field contents are read. */
(() => {
  'use strict';
  if (document.documentElement.dataset.flowDesign === 'classic') return;
  if (window.flowEcosystem) return;
  const root = document.documentElement, abort = new AbortController(), signal = abort.signal;
  const selector = '.sheet,.composer,.enm-song-sheet,.pins-drop-card,.pn-dialog,dialog,[role="dialog"]';
  const surfaces = new Set(), observers = new Map(), media = new Set(), inputs = new Map(), microphones = new Set(), pendingScopes = new Set();
  let frame = 0, interactionFrame = 0, disposed = false, suspended = false, pageActive = true, active = null, voice = 'idle', voiceLevel = 0, activity = null, capture = 'idle', captureRequest = null, speaking = false, settleTimer = 0;
  // A surface operation is an exact DOM owner plus a superseding token, not a global scene.
  const operations = new Map(), surfaceOwners = new WeakMap();
  let operationSequence = 0, interactionEvents = [], interactionCleanup = 0;
  function ownerIdentity(surface) {
    const owner=surface.closest('#app')&&typeof sheetOwner==='function'?sheetOwner(surface):null;
    return owner&&owner!==surface?{owner,stamp:JSON.stringify([owner.kind,owner.type,owner.category,owner.id,owner.mode])}:null;
  }
  function foreground(surface) {
    return surface && visible(surface) && !surface.closest('[inert]') &&
      [...surfaces].filter(node => visible(node) && !node.closest('[inert]')).at(-1) === surface;
  }
  function clearResponse(surface, forget = true) {
    const record = operations.get(surface); if (!record) return;
    clearTimeout(record.decay); for (const effect of record.effects) effect.cancel();
    record.effects = []; record.layer?.remove(); record.layer = null;
    delete surface.dataset.windowPhase;
    if (forget) { clearTimeout(record.expiry); operations.delete(surface); }
  }
  function operationSurface(record) {
    const previous=record.surface;
    if(previous.isConnected)return previous;
    if(!record.identity)return null;
    for(const next of surfaces){
      const identity=surfaceOwners.get(next);
      if(!identity||identity.owner!==record.identity.owner||identity.stamp!==record.identity.stamp||!foreground(next)||operations.has(next))continue;
      delete previous.dataset.windowPhase;operations.delete(previous);record.surface=next;operations.set(next,record);
      if(record.layer){next.dataset.windowPhase=record.phase;for(const key of ['--surface-x','--surface-y']){const value=previous.style.getPropertyValue(key);if(value)next.style.setProperty(key,value);}next.append(record.layer);}
      return next;
    }
    return null;
  }
  function operationPhase(surface, record, phase) {
    if(!record.surface.isConnected){scan(document.body);surface=operationSurface(record)||surface;}else surface=record.surface;
    if (operations.get(surface) !== record || !foreground(surface) || !moving() || performance.now() > record.expires) {
      if (operations.get(surface) === record) clearResponse(surface); return false;
    }
    if (!['queued','processing','accepted','confirmed','rejected','pending','cancelled'].includes(phase)) return false;
    clearResponse(surface, false);
    if (phase === 'cancelled') { clearResponse(surface); return true; }
    record.phase = phase; surface.dataset.windowPhase = phase;
    const layer = document.createElement('i'); layer.className = 'flow-surface-response'; layer.setAttribute('aria-hidden','true');
    layer.innerHTML = '<i class="flow-response-contour"></i><i class="flow-response-echo"></i>'; surface.append(layer); record.layer = layer;
    const config = {
      queued: [650,.46,.18], processing: [1150,.82,.40], accepted: [800,.60,.24],
      confirmed: [1100,.96,.60], rejected: [1250,.92,.34], pending: [900,.38,.13]
    }[phase];
    record.effects = [...layer.children].map((node,index) => node.animate([
      {opacity:0,transform:'scale(.997)'},
      {opacity:config[index+1],transform:'scale(1)',offset:phase==='rejected'?.10:.20},
      {opacity:config[index+1]*(phase==='rejected'?.32:.55),transform:'scale(1)',offset:.50},
      ...(phase==='rejected'?[{opacity:config[index+1]*.72,transform:'scale(1)',offset:.64}]:[]),
      {opacity:0,transform:index?'scale(1.012)':'scale(1)'}
    ],{duration:config[0],easing:'cubic-bezier(.2,.6,.25,1)'}));
    record.decay = setTimeout(() => { if (operations.get(record.surface) === record) clearResponse(record.surface,false); },config[0]+40);
    document.dispatchEvent(new CustomEvent('flow:surfaceoperation',{detail:{id:record.id,phase}}));
    return true;
  }
  function beginOperation(origin, phase = 'queued') {
    const surface = origin instanceof Element ? surfaceOf(origin) : null;
    if (!foreground(surface) || !moving()) return null;
    clearResponse(surface);
    const record = {id:++operationSequence,surface,identity:surfaceOwners.get(surface),phase:'',effects:[],layer:null,expires:performance.now()+65000};
    operations.set(surface,record); record.expiry=setTimeout(()=>{if(operations.get(record.surface)===record)clearResponse(record.surface);},65000);
    const handle = Object.freeze({current:()=>operations.get(record.surface)===record&&foreground(record.surface)&&moving()&&performance.now()<=record.expires,sameOwner:node=>{const identity=surfaceOwners.get(node);return node===record.surface||!!(identity&&record.identity&&identity.owner===record.identity.owner&&identity.stamp===record.identity.stamp);}, update:value=>operationPhase(record.surface,record,value), cancel:()=>{if(operations.get(record.surface)===record)clearResponse(record.surface);}});
    operationPhase(surface,record,phase); return handle;
  }
  function clearInteractions() { clearTimeout(interactionCleanup);interactionCleanup=0;interactionEvents=[]; }
  function currentInteractionOwner() {
    // Chromium checkpoints microtasks between trusted listeners; dispatch itself is the authority.
    const current=interactionEvents.findLast(record=>record.event.eventPhase>0);
    if(!current?.surface)return null;
    if(foreground(current.surface)){
      const identity=ownerIdentity(current.surface);
      if(!current.identity||identity&&identity.owner===current.identity.owner&&identity.stamp===current.identity.stamp)return current.surface;
      return null;
    }
    if(current.surface.isConnected||!current.identity)return null;
    scan(document.body);
    return [...surfaces].findLast(surface=>{const identity=surfaceOwners.get(surface);return foreground(surface)&&identity&&identity.owner===current.identity.owner&&identity.stamp===current.identity.stamp;})||null;
  }
  function rememberInteraction(event) {
    const origin=event.composedPath?.().find(node=>node instanceof Element),surface=surfaceOf(origin);
    interactionEvents=interactionEvents.filter(record=>record.event.eventPhase>0);
    interactionEvents.push({event,surface:foreground(surface)?surface:null,identity:surface&&surfaceOwners.get(surface)});
    if(interactionEvents.length>8)interactionEvents.shift();
    clearTimeout(interactionCleanup);interactionCleanup=setTimeout(clearInteractions,0);
  }
  for (const name of ['pointerdown','click','input','change','submit']) document.addEventListener(name,rememberInteraction,{capture:true,signal});
  document.addEventListener('invalid',event=>{const surface=surfaceOf(event.target);if(foreground(surface)){focus(event);beginOperation(surface,'rejected');}},{capture:true,signal});
  const reduced = () => window.flowDigital?.reducedMotion?.() ?? matchMedia('(prefers-reduced-motion:reduce)').matches;
  const moving = () => !disposed && !suspended && pageActive && !document.hidden && root.dataset.motion !== 'off' && !reduced();
  const resize = new ResizeObserver(() => schedule());
  function visible(node) { return node.isConnected && !node.hidden && node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'; }
  function clearInput(surface) { const owned = inputs.get(surface); if (!owned) return; for (const effect of owned.effects) effect.cancel(); owned.node.remove(); inputs.delete(surface); }
  // Self-presented assistant controls own their shadow feedback and layout.
  function assistantSurface(node) {
    for(let current=node?.host||node;current;current=current.parentElement||current.getRootNode?.().host)if(current.matches?.('flow-assistant-study,.dm-live-assistant'))return true;
    return false;
  }
  function attach(surface) {
    if (surfaces.has(surface) || assistantSurface(surface) || surface.closest('.dm-live-assistant') || surface.matches('.activity-island-card')) return;
    surfaces.add(surface);surfaceOwners.set(surface,ownerIdentity(surface)); surface.classList.add('flow-living-surface');
    if (getComputedStyle(surface).position === 'static') surface.classList.add('flow-surface-static');
    const contour = document.createElement('i'); contour.className = 'flow-surface-contour'; contour.setAttribute('aria-hidden', 'true');surface.append(contour);
    resize.observe(surface);
  }
  function scan(scope) {
    if(assistantSurface(scope))return;
    if(scope.matches?.(selector))attach(scope);
    for (const node of scope.querySelectorAll(selector)) attach(node);
    if(scope.shadowRoot&&!observers.has(scope.shadowRoot))watch(scope.shadowRoot);
    for (const host of scope.querySelectorAll('*')) if (host.shadowRoot && !observers.has(host.shadowRoot)) watch(host.shadowRoot);
  }
  function watch(scope) {
    if (assistantSurface(scope) || observers.has(scope)) return;
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
    for (const surface of surfaces) if (!surface.isConnected) { clearInput(surface); const operation=operations.get(surface);if(operation)operationSurface(operation);clearResponse(surface); resize.unobserve(surface); surfaces.delete(surface); }
    const list = [...surfaces].filter(visible); active = list.at(-1) || null;
    for (const surface of surfaces) {
      surface.classList.toggle('flow-surface-attention', surface === active);
      surface.classList.toggle('flow-surface-resting', !moving() || surface !== active);
      const contour=surface.querySelector(':scope>.flow-surface-contour');
      if(contour){contour.style.height=surface.clientHeight+'px';contour.style.transform=`translate(${surface.scrollLeft}px,${surface.scrollTop}px)`;}
    }
    if (active) root.dataset.flowSurface = 'window'; else delete root.dataset.flowSurface;
    for (const [surface] of inputs) if (!moving() || !visible(surface) || surface !== active) clearInput(surface);
    for (const [surface] of operations) if (!moving() || !foreground(surface)) clearResponse(surface);
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
  const controls = 'button,input,textarea,select,summary,[role="checkbox"],[role="switch"],[contenteditable="true"]';
  function fieldOf(event) { return event.composedPath().find(node => node instanceof Element && node.matches(controls)); }
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
  function surfaceOf(field) { if(!field||assistantSurface(field))return null;let surface=field.closest('.flow-living-surface');if(!surface){surface=field.closest(selector)||field.closest('form');if(surface&&!surface.closest('.dm-live-assistant'))attach(surface);}return surface?.classList.contains('flow-living-surface')?surface:null; }
  function focus(event) {
    const field = fieldOf(event), surface = surfaceOf(field); if (!surface) return;
    const a = surface.getBoundingClientRect(), b = fieldBounds(field);
    surface.style.setProperty('--surface-x', `${b.left + b.width / 2 - a.left}px`); surface.style.setProperty('--surface-y', `${b.top + b.height / 2 - a.top}px`);
    surface.classList.add('flow-surface-focused');schedule();
  }
  function pulse(field,surface) {
    if (!moving()) { clearInput(surface); return; }
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
    for (const [key, value] of Object.entries({ x: b.left + b.width / 2 - a.left + surface.scrollLeft, y: b.top + b.height / 2 - a.top + surface.scrollTop, left: b.left - a.left + surface.scrollLeft, top: b.top - a.top + surface.scrollTop, width: b.width, height: b.height })) owned.node.style.setProperty('--input-' + key, `${value}px`);
    owned.node.style.setProperty('--input-radius', getComputedStyle(field).borderRadius);
    owned.effects = [...owned.node.children].map((node, i) => node.animate([{ opacity: previous[i] }, { opacity: strength, offset: i ? .2 : .12 }, { opacity: strength * .5, offset: .48 }, { opacity: 0 }], { duration: duration - (i ? 0 : 80), easing: 'cubic-bezier(.2,.6,.25,1)' }));
    const last = owned.effects[1]; last.finished.then(() => { if (inputs.get(surface)?.effects.includes(last)) clearInput(surface); }, () => {});
  }
  function input(event) {
    const field = fieldOf(event), surface = surfaceOf(field); if(!surface&&field?.closest('.dm-live-assistant')){if(moving())window.flowAssistantVisual?.react?.('typing');return;}if (!surface || field.matches('input[type=range],input[type=checkbox],input[type=radio],input[type=file]')) return;
    focus(event); pulse(field,surface);
  }
  function interact(event){const field=fieldOf(event),surface=surfaceOf(field);if(window.flowCommonControls?.owns(event)){if(surface)focus(event);return;}if(!surface||field.disabled)return;focus(event);pulse(field,surface);}
  function rest(){clearInteractions();for(const [surface]of operations)clearResponse(surface);for(const [surface]of inputs)clearInput(surface);for(const surface of surfaces)surface.classList.add('flow-surface-resting');if(interactionFrame)cancelAnimationFrame(interactionFrame);interactionFrame=0;}
  document.addEventListener('pointerdown', interact, { capture: true, signal });
  document.addEventListener('change', interact, { capture: true, signal });
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
  document.addEventListener('visibilitychange', () => { document.body.classList.toggle('digital-hidden', document.hidden); if (document.hidden) rest(); schedule(); }, { signal });
  window.addEventListener('flow:suspend',()=>{suspended=true;rest();}, {signal});
  window.addEventListener('flow:resume',()=>{suspended=false;schedule();}, {signal});
  window.addEventListener('pagehide', () => { pageActive=false;rest();if (frame) cancelAnimationFrame(frame); frame = 0; }, { signal });
  window.addEventListener('pageshow',()=>{pageActive=true;schedule();}, { signal });
  window.flowEcosystem = { beginOperation, interactionOwner:currentInteractionOwner, refresh() { pendingScopes.add(document.body);schedule(); }, getState: () => ({ surfaces: surfaces.size, activeSurface: !!active, responseLayers:[...operations.values()].filter(record=>record.layer).length,responseAnimations:[...operations.values()].reduce((n,record)=>n+record.effects.filter(effect=>effect.playState==='running').length,0),surfaceOperations:operations.size,typingLayers: inputs.size, typingAnimations: [...inputs.values()].reduce((n, item) => n + item.effects.filter(effect => effect.playState === 'running').length, 0), scene: root.dataset.magicScene, mediaOwners: media.size, microphoneOwners:microphones.size, voice, physicalHapticsVerified: false }), dispose() { disposed = true; abort.abort();rest();resize.disconnect();for(const fab of document.querySelectorAll('.assistant-fab')){fab.inert=false;fab.style.removeProperty('--assistant-avoid');fab.removeAttribute('data-avoid-hidden');} clearTimeout(settleTimer); if (frame) cancelAnimationFrame(frame); for (const observer of observers.values()) observer.disconnect(); for (const surface of surfaces) { surface.classList.remove('flow-living-surface','flow-surface-static','flow-surface-attention','flow-surface-resting','flow-surface-focused');surface.style.removeProperty('--surface-x');surface.style.removeProperty('--surface-y'); surface.querySelector(':scope>.flow-surface-contour')?.remove(); } } };
  document.addEventListener('click', event => {
    const field=fieldOf(event);if(!field||field.disabled)return;
    if(event.detail===0)interact(event);if(window.flowCommonControls?.owns(event))return;
    if(!field.matches('[data-action="list-toggle"]')||!moving())return;
    const id=field.dataset.id;
    if(interactionFrame)cancelAnimationFrame(interactionFrame);
    interactionFrame=requestAnimationFrame(()=>{
      interactionFrame=0;
      if(!moving())return;
      const surface=document.querySelector('.dc2-window-lists'),next=[...(surface?.querySelectorAll('[data-action="list-toggle"]')||[])].find(node=>node.dataset.id===id);
      if(!next||!visible(surface))return;
      attach(surface);pulse(next,surface);
    });
  }, {capture:true,signal});
  watch(document.body); schedule();
})();
