/* Nearby detection supplies availability; only an explicit island tap opens a card. */
(() => {
  'use strict';
  if (window.flowCardIsland) return;
  const MAX_CARDS = 3;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const text = (value, limit) => Array.from(String(value ?? '').trim()).slice(0, limit).join('');
  const bridge = () => window.SorokaAndroid;
  let nativeOwned = false, nativeRevision = -1;
  let entries = [], selected = '', mode = 'closed', expiryTimer = 0, positionFrame = 0;
  let suspended = document.hidden, generation = 0, anchor = null, panel = null, host = null, full = null, fullCode = null;
  let renderKey = '', published = '', returnFocus = null;
  const suppressed = new Map();

  function nativeSource() {
    if (!nativeOwned && typeof bridge()?.readNearbyCards === 'function') {
      nativeOwned = true;
      if (entries.some(entry => entry.source === 'web')) {
        generation++; endFull(); entries = []; selected = ''; mode = 'closed'; hideMini();
        suppressed.clear(); scheduleExpiry(); publish('native-source');
      }
    }
    return nativeOwned;
  }
  function currentEntry() { return entries.find(entry => entry.id === selected) || entries[0] || null; }
  function metadata(entry = currentEntry()) { return entry ? {id:entry.id,title:entry.title,source:entry.source,expiresAt:entry.expiresAt} : null; }
  function state() { return {mode,open:mode !== 'closed',selected:currentEntry()?.id || null,count:entries.length}; }
  function publish(reason = 'update', dismissedIds) {
    const detail = {...state(),available:entries.length > 0,current:metadata()};
    const key = JSON.stringify(detail);
    if (key === published && !dismissedIds) return;
    published = key;
    document.dispatchEvent(new CustomEvent('flow:cardislandchange', {detail:{...detail,reason,...(dismissedIds ? {dismissedIds} : {})}}));
  }
  function hideMini() { if (host) host.hidden = true; }
  function endFull() {
    const owned = full;
    full = null; fullCode = null;
    if (owned) owned.close();
  }
  function restoreFocus() {
    if (returnFocus?.isConnected && !document.hidden && !suspended) returnFocus.focus?.({preventScroll:true});
    returnFocus = null;
  }
  function close(options = {}) {
    if (nativeSource() && !options.clear) return false; // Native presentation owns its own dismissal.
    const dismissedIds = options.hide ? entries.map(entry => entry.id) : null;
    if (dismissedIds) for (const entry of entries) suppressed.set(entry.id, entry.expiresAt);
    generation++;
    endFull(); mode = 'closed'; hideMini();
    if (options.clear || options.hide) {
      entries = []; selected = ''; renderKey = '';
      if (options.clear) suppressed.clear();
      panel?.replaceChildren();
    }
    if (options.restoreFocus === true || (!options.clear && options.restoreFocus !== false)) restoreFocus(); else returnFocus = null;
    scheduleExpiry(); publish(options.reason || (options.hide ? 'hide' : 'close'), dismissedIds);
    return true;
  }
  function scheduleExpiry() {
    clearTimeout(expiryTimer); expiryTimer = 0;
    const next = Math.min(...entries.map(entry => entry.expiresAt), ...suppressed.values());
    if (Number.isFinite(next)) expiryTimer = setTimeout(() => sweep('expired'), Math.max(0, Math.min(2147483647, next - Date.now() + 1)));
  }
  function sweep(reason = 'expired') {
    const now = Date.now(), before = currentEntry()?.id;
    for (const [id, expiresAt] of suppressed) if (expiresAt <= now) suppressed.delete(id);
    entries = entries.filter(entry => entry.expiresAt > now);
    if (before && !entries.some(entry => entry.id === before)) {
      generation++; endFull(); mode = 'closed'; hideMini(); selected = entries[0]?.id || '';
    }
    if (!entries.length) { mode = 'closed'; hideMini(); selected = ''; }
    scheduleExpiry(); if (mode === 'mini' && !nativeSource()) renderMini(); publish(reason);
  }
  function accept(next, reason, presentation) {
    const previous = currentEntry(), pinned = next.find(entry => entry.id === selected);
    entries = next.slice(0, MAX_CARDS);
    if (pinned && !entries.some(entry => entry.id === pinned.id)) entries = [pinned,...entries.slice(0, MAX_CARDS - 1)];
    selected = entries.some(entry => entry.id === selected) ? selected : entries[0]?.id || '';
    if (previous && !entries.some(entry => entry.id === previous.id)) {
      generation++; endFull(); mode = 'closed'; hideMini();
    }
    if (fullCode) {
      const entry = currentEntry();
      if (!entry || entry.id !== fullCode.id || entry.item?.svg !== fullCode.svg || entry.item?.number !== fullCode.number) {
        generation++; endFull(); mode = 'closed'; hideMini();
      }
    }
    if (presentation) {
      const presented = entries.find(entry => entry.id === presentation.cardId);
      mode = presented && ['mini','full'].includes(presentation.mode) ? presentation.mode : 'closed';
      if (presented) selected = presented.id;
      hideMini();
    }
    if (!entries.length) { generation++; endFull(); mode = 'closed'; hideMini(); }
    scheduleExpiry(); if (mode === 'mini' && !nativeSource()) renderMini(); publish(reason);
  }
  function updateWeb(cards, {expiresAt} = {}) {
    if (nativeSource()) { readNative(); return state(); }
    if (suspended || document.hidden) return state();
    const until = finite(expiresAt), incoming = Array.isArray(cards) ? cards : [], present = new Set(incoming.map(card => String(card?.id ?? ''))), seen = new Set();
    for (const id of suppressed.keys()) if (!present.has(id)) suppressed.delete(id);
    const next = [];
    for (const item of incoming) {
      if (!item || item.id == null || until === null || until <= Date.now()) continue;
      const id = String(item.id); if (!id || seen.has(id) || suppressed.has(id)) continue;
      seen.add(id);
      next.push({id,title:text(item.title || 'Карта',80),tail:text(String(item.number || '').replace(/\s+/g,'').slice(-4),4),source:'web',expiresAt:until,item});
    }
    accept(next,'web'); return state();
  }
  function acceptNative(raw, fromRead = false) {
    if (suspended || document.hidden) return;
    let value = raw;
    try { if (typeof value === 'string') value = JSON.parse(value); } catch { return; }
    if (!value || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 || !Number.isInteger(value.count) || value.count < 0 || value.count > MAX_CARDS || value.revision < nativeRevision || (!fromRead && value.revision === nativeRevision)) return;
    nativeOwned = true; nativeRevision = value.revision;
    const next = [], seen = new Set();
    for (const card of (Array.isArray(value.cards) ? value.cards : []).slice(0,value.count)) {
      const expiresAt = finite(card?.expiresAt), id = text(card?.id,128);
      if (!/^card:[\w-]+$/.test(id) || seen.has(id) || expiresAt === null || expiresAt <= Date.now()) continue;
      seen.add(id); next.push({id,title:text(card.title || 'Карта',80),tail:text(card.tail,4),source:'native',expiresAt});
      if (next.length === MAX_CARDS) break;
    }
    const presentation = value.presentation || {};
    accept(next,'native',{mode:['mini','full'].includes(presentation.mode) ? presentation.mode : 'closed',cardId:text(presentation.cardId,128)});
  }
  function readNative() {
    if (!nativeSource() || suspended || document.hidden) return;
    try { acceptNative(bridge()?.readNearbyCards?.(), true); } catch {}
  }
  function ensureMini() {
    if (host) return;
    host = document.createElement('div'); host.className = 'nearby-card-island-layer'; host.hidden = true;
    panel = document.createElement('section'); panel.className = 'nearby-card-island'; panel.tabIndex = -1;
    panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','false'); panel.setAttribute('aria-labelledby','nearby-card-title');
    host.append(panel); document.body.append(host);
    panel.addEventListener('click', event => {
      const control = event.target instanceof Element ? event.target.closest('[data-card-island]') : null;
      if (!control) return;
      event.preventDefault(); event.stopPropagation();
      const action = control.dataset.cardIsland;
      if (action === 'assistant') { const from = anchor; close({restoreFocus:false,reason:'assistant'}); window.flowAssistant?.open?.(from); }
      else if (action === 'close') close();
      else if (action === 'hide') close({hide:true});
      else if (action === 'card') {
        sweep(); if (!entries.length) return;
        if (!entries.some(entry => entry.id === control.dataset.cardId)) return;
        selected = control.dataset.cardId; expand();
      }
    });
  }
  function position() {
    positionFrame = 0;
    if (!panel || host.hidden) return;
    const viewport = window.visualViewport, width = viewport?.width || innerWidth, height = viewport?.height || innerHeight, offset = viewport?.offsetTop || 0;
    const box = anchor?.isConnected ? anchor.getBoundingClientRect() : null, panelWidth = Math.min(360, Math.max(0,width - 24));
    const left = Math.max(12,Math.min(width - panelWidth - 12,(box ? box.x + box.width / 2 : width / 2) - panelWidth / 2));
    panel.style.width = `${panelWidth}px`;
    panel.style.maxHeight = `${Math.max(80,height - 24)}px`;
    const style = getComputedStyle(panel), border = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
    const needed = Math.min(panel.scrollHeight + border,Math.max(80,height - 24));
    const top = Math.max(offset + 12,Math.min(offset + height - needed - 12,(box ? box.bottom + 10 : offset + 64)));
    panel.style.left = `${left}px`; panel.style.top = `${top}px`;
    panel.style.maxHeight = `${Math.max(80,offset + height - top - 12)}px`;
  }
  function schedulePosition() { if (mode === 'mini' && !nativeSource() && !positionFrame) positionFrame = requestAnimationFrame(position); }
  function renderMini() {
    const entry = currentEntry(); if (!entry || mode !== 'mini' || entry.source !== 'web') { hideMini(); return; }
    ensureMini();
    const rows = entries.map(card => ({...card,badge:typeof loyaltyBadge === 'function' ? loyaltyBadge(card.item) : '',hasCode:typeof card.item.svg === 'string' && /<svg[\s>]/i.test(card.item.svg)}));
    const key = JSON.stringify(rows.map(card => [card.id,card.title,card.badge,card.hasCode]));
    if (renderKey !== key) {
      const focused = panel.contains(document.activeElement) ? {action:document.activeElement.dataset.cardIsland,id:document.activeElement.dataset.cardId} : null;
      panel.innerHTML = `<div class="nci-header"><h2 id="nearby-card-title">Скидочные карты рядом</h2><button type="button" class="nci-hide" data-card-island="hide">Скрыть</button><button type="button" class="nci-assistant" data-card-island="assistant" aria-label="Открыть ассистента Flow"><span aria-hidden="true">✦</span></button><button type="button" class="nci-icon" data-card-island="close" aria-label="Свернуть скидочные карты">×</button></div><div class="nci-list">${rows.map(card => `<button type="button" class="nci-store" data-card-island="card" data-card-id="${escape(card.id)}" aria-label="${card.hasCode ? 'Открыть код скидочной карты' : 'Нет сохранённого кода'} ${escape(card.title)}" ${card.hasCode ? '' : 'disabled'}><span class="nci-badge" aria-hidden="true">${card.badge}</span><span class="nci-store-title"><strong>${escape(card.title)}</strong><small>Скидочная карта</small></span><span class="nci-code-label">${card.hasCode ? 'Открыть код' : 'Нет кода'}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5H5v4m10-4h4v4M5 15v4h4m10-4v4h-4"/></svg></span></button>`).join('')}</div>`;
      renderKey = key;
      if (focused?.action) [...panel.querySelectorAll('[data-card-island]')].find(node => node.dataset.cardIsland === focused.action && node.dataset.cardId === focused.id)?.focus({preventScroll:true});
    }
    host.hidden = false; position();
  }
  function expand() {
    sweep(); const entry = currentEntry();
    if (!entry || entry.source !== 'web' || mode !== 'mini' || typeof openLoyaltyFull !== 'function' || !/<svg[\s>]/i.test(entry.item.svg || '')) return false;
    const sequence = ++generation, id = entry.id;
    mode = 'full'; hideMini(); fullCode = {id,svg:entry.item.svg,number:entry.item.number};
    full = openLoyaltyFull(entry.item,{onClose:() => {
      if (sequence !== generation) return;
      full = null; fullCode = null; sweep();
      if (!suspended && !document.hidden && currentEntry()?.id === id && currentEntry().expiresAt > Date.now()) { mode = 'mini'; renderMini(); panel.focus({preventScroll:true}); }
      else { mode = 'closed'; hideMini(); }
      publish('full-close');
    }});
    if (!full?.layer || typeof full.close !== 'function') { full = null; fullCode = null; mode = 'mini'; renderMini(); return false; }
    full.layer.classList.add('nci-owned-full');
    full.layer.setAttribute('role','dialog'); full.layer.setAttribute('aria-modal','true'); full.layer.setAttribute('aria-label',entry.title);
    full.layer.querySelector('.loyalty-full-close')?.focus({preventScroll:true});
    publish('full'); return true;
  }
  function open(anchorElement) {
    if (suspended || document.hidden) return false;
    if (nativeSource()) {
      readNative(); sweep(); const entry = currentEntry(); if (!entry) return false;
      try { return bridge()?.openNearbyCard?.(entry.id) === true; } catch { return false; }
    }
    sweep(); if (!currentEntry()) return false;
    if (mode === 'full') return true;
    anchor = anchorElement?.isConnected ? anchorElement : null;
    returnFocus = anchor || document.activeElement;
    mode = 'mini'; renderMini(); panel.focus({preventScroll:true}); publish('open'); return true;
  }
  function privacy(reason) {
    suspended = true;
    if (positionFrame) cancelAnimationFrame(positionFrame); positionFrame = 0;
    close({clear:true,restoreFocus:false,reason});
    if (panel) panel.replaceChildren(); renderKey = ''; anchor = null;
  }
  document.addEventListener('pointerdown', event => {
    if (mode !== 'mini' || nativeSource() || !(event.target instanceof Node) || host?.contains(event.target) || anchor?.contains(event.target)) return;
    close({restoreFocus:false});
  },true);
  window.addEventListener('keydown', event => {
    if (mode === 'closed' || nativeSource()) return;
    if (mode === 'full' && event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      const scope = mode === 'full' ? full?.layer : panel;
      const controls = [...scope?.querySelectorAll('button,a[href],input,select,textarea,[tabindex]') || []].filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
      if (!controls.length) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const index = controls.indexOf(document.activeElement), next = index < 0 ? (event.shiftKey ? controls.length - 1 : 0) : (index + (event.shiftKey ? controls.length - 1 : 1)) % controls.length;
      controls[next].focus({preventScroll:true}); return;
    }
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (mode === 'full' && full) full.close(); else close();
  },true);
  window.addEventListener('flow:nearbycards', event => { if (nativeSource()) acceptNative(event.detail); },true);
  document.addEventListener('flow:assistantphase', event => {
    if (event.detail?.open && mode !== 'closed' && !nativeSource()) close({restoreFocus:false,reason:'assistant'});
  });
  window.addEventListener('flow:suspend', () => privacy('suspend'));
  window.addEventListener('pagehide', () => privacy('pagehide'));
  document.addEventListener('visibilitychange', () => { if (document.hidden) privacy('hidden'); else { suspended = false; readNative(); } });
  for (const event of ['flow:resume','pageshow','flow:nativeready']) window.addEventListener(event, () => { suspended = document.hidden; readNative(); });
  window.addEventListener('resize', schedulePosition);
  window.visualViewport?.addEventListener('resize', schedulePosition);
  window.visualViewport?.addEventListener('scroll', schedulePosition);
  window.flowCardIsland = Object.freeze({updateWeb,open,close,getCurrent:() => { sweep(); return metadata(); },getState:() => { sweep(); return state(); }});
  readNative(); publish('ready');
})();
