/* Device-local Digital Magic controls. Product settings and user records stay with Flow. */
(() => {
  'use strict';
  if (document.documentElement.dataset.flowDesign === 'classic') return;
  if (window.flowDigital) return;
  const root = document.documentElement;
  const base = new URL('.', document.currentScript?.src || document.baseURI);
  const shadowURL = new URL('digital-windows.css', base);
  const windowsVersion = '3f1de46ce8';
  shadowURL.searchParams.set('v', windowsVersion.startsWith('__') ? new URL(document.currentScript?.src || document.baseURI).searchParams.get('v') || '20261103-magic-1' : windowsVersion);
  const storageKey = 'flow-digital-runtime-v1';
  const query = matchMedia('(prefers-reduced-motion: reduce)');
  const settings = { sound: true, haptics: true, motion: true, ambient: false };
  const tokens = ['--page', '--surface', '--surface-raised', '--surface-soft', '--line', '--text', '--muted', '--subtle', '--accent', '--accent-ink', '--accent-strong', '--accent-soft', '--accent-rgb', '--energy-rgb'];
  const hosts = new Map(), waitingHosts = new Map();
  let motionMode = 'system', frame = 0, settingsNeeded = true, disposed = false;
  let modal = null, opener = null, observer = null, themeObserver = null, probe = null;
  let lastTap = -Infinity, lastColor = '', rgb = '88,208,207', gestureSeen = false;
  let soundParams = {};
  for (const type of ['pointerdown','keydown']) document.addEventListener(type, event => { if(event.isTrusted) gestureSeen = true; }, {capture:true,passive:true});
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && typeof saved === 'object') {
      for (const key of ['sound', 'haptics', 'ambient']) if (typeof saved[key] === 'boolean') settings[key] = saved[key];
      if (['system', 'on', 'off'].includes(saved.motionMode)) motionMode = saved.motionMode;
      if (saved.soundParams && typeof saved.soundParams === 'object') soundParams = saved.soundParams;
    }
  } catch { /* Storage is optional. */ }
  // Opening the explicitly labelled full-motion preview is a user choice, like the switch.
  try {
    const url = new URL(location.href), requested = url.searchParams.get('magicMotion');
    if (requested === 'on' || requested === 'off') {
      motionMode = requested;
      url.searchParams.delete('magicMotion');
      history.replaceState(history.state, '', url);
      localStorage.setItem(storageKey, JSON.stringify({ motionMode, sound: settings.sound, haptics: settings.haptics, ambient: settings.ambient, soundParams }));
    }
  } catch { /* A restricted preview still uses its stored or system preference. */ }

  const reducedMotion = () => motionMode === 'off' || (motionMode === 'system' && query.matches);
  const hapticAvailable = () => !!(window.Telegram?.WebApp?.HapticFeedback || typeof navigator.vibrate === 'function');
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify({ motionMode, sound: settings.sound, haptics: settings.haptics, ambient: settings.ambient, soundParams })); } catch {}
  }
  function audio() {
    window.flowSound?.setEnabled(settings.sound);
    window.flowSound?.setParams?.(soundParams);
    window.flowSound?.setAmbient(settings.ambient);
    if (document.hidden) window.flowSound?.suspend();
  }
  function feedback(kind = 'tap') {
    if (disposed || document.hidden) return;
    const now = performance.now();
    if (now - lastTap < 95) return;
    lastTap = now;
    if (settings.haptics && gestureSeen) {
      try {
        const haptic = window.Telegram?.WebApp?.HapticFeedback;
        if (haptic) {
          if (kind === 'success' || kind === 'error') haptic.notificationOccurred(kind);
          else haptic.impactOccurred('light');
        } else navigator.vibrate?.(kind === 'success' ? [8, 35, 12] : kind === 'error' ? [12, 35, 8] : kind === 'open' ? [10, 20, 6] : 6);
      } catch { /* Hardware may decline the effect. */ }
    }
    window.flowSound?.setEnabled(settings.sound);
    if (settings.sound) window.flowSound?.feedback(kind);
  }
  function motionNote() {
    return motionMode === 'system' ? `Как в системе${query.matches ? ': уменьшенное движение' : ''}.` : motionMode === 'on' ? 'Движение включено для Flow.' : 'Движение выключено для Flow.';
  }
  function syncControls() {
    if (!modal) return;
    for (const input of modal.querySelectorAll('[data-flow-effect]')) {
      const key = input.dataset.flowEffect;
      input.checked = !!settings[key] && !(key === 'haptics' && !hapticAvailable());
      input.setAttribute('aria-checked', String(input.checked));
    }
    modal.querySelector('[data-flow-motion-note]').textContent = motionNote();
    modal.querySelector('[data-flow-sound-note]').textContent = settings.sound ? 'Прослушайте звуковые отклики.' : 'Включите звуки, чтобы прослушать отклики.';
  }
  function apply(save = false) {
    settings.motion = !reducedMotion();
    if (root.dataset.motionMode !== motionMode) root.dataset.motionMode = motionMode;
    if (root.dataset.motion !== (settings.motion ? 'on' : 'off')) root.dataset.motion = settings.motion ? 'on' : 'off';
    audio();
    syncControls();
    if (save) persist();
    document.dispatchEvent(new CustomEvent('flow:effectschange', { detail: { ...settings, motionMode, reduced: reducedMotion() } }));
  }

  function copyTokens(host, style) {
    for (const key of tokens) {
      const value = style.getPropertyValue(key).trim();
      if (value && host.style.getPropertyValue(key).trim() !== value) host.style.setProperty(key, value);
    }
  }
  function syncTheme() {
    if (!probe || disposed) return;
    const color = getComputedStyle(probe).color;
    if (color !== lastColor) {
      const match = color.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
      if (match) rgb = match.slice(1, 4).map(value => Math.round(Number(value))).join(',');
      else {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        if (context) { context.fillStyle = color; context.fillRect(0, 0, 1, 1); rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).join(','); }
      }
      lastColor = color;
    }
    for (const key of ['--accent-rgb', '--energy-rgb']) if (root.style.getPropertyValue(key) !== rgb) root.style.setProperty(key, rgb);
    const style = getComputedStyle(root);
    for (const host of hosts.keys()) if (host.isConnected) copyTokens(host, style);
  }
  function ensureShadow(host, record) {
    if (!host.isConnected) return;
    let link = record.root.querySelector('link[data-flow-magic-shadow]');
    if (!link) {
      link = document.createElement('link'); link.rel = 'stylesheet'; link.href = shadowURL.href; link.dataset.flowMagicShadow = 'true';
      record.root.append(link);
    }
    const children = [...record.root.children];
    const lastStyle = children.reduce((last, node, index) => node !== link && (node.localName === 'style' || (node.localName === 'link' && node.rel === 'stylesheet')) ? index : last, -1);
    if (children.indexOf(link) < lastStyle) record.root.append(link);
  }
  function installShadow(host) {
    if (!host.isConnected) { waitingHosts.delete(host); return; }
    if (hosts.has(host)) return;
    const shadow = host.shadowRoot;
    if (!shadow) {
      const attempt = (waitingHosts.get(host) || 0) + 1;
      if (attempt < 4) waitingHosts.set(host, attempt); else waitingHosts.delete(host);
      return;
    }
    waitingHosts.delete(host);
    const record = { root: shadow, observer: null };
    record.observer = new MutationObserver(() => ensureShadow(host, record));
    record.observer.observe(shadow, { childList: true });
    hosts.set(host, record);
    copyTokens(host, getComputedStyle(root));
    ensureShadow(host, record);
  }
  function installSettings() {
    if (document.querySelector('.dc-effects-group')) return;
    const select = document.querySelector('[data-setting="theme"]');
    const panel = select?.closest('.settings-group')?.querySelector('.list-panel');
    if (!panel || panel.querySelector('[data-flow-digital-settings]')) return;
    const row = document.createElement('div'); row.className = 'settings-row';
    row.innerHTML = '<div><strong>Свет и звук</strong><span>Движение, звуковые отклики и вибрация</span></div><button type="button" class="small-button" data-flow-digital-settings>Настроить</button>';
    panel.append(row);
  }
  function flush() {
    frame = 0;
    if (disposed) return;
    for (const [host, record] of hosts) if (!host.isConnected) { record.observer.disconnect(); hosts.delete(host); }
    if (settingsNeeded) { settingsNeeded = false; installSettings(); }
    for (const host of [...waitingHosts.keys()]) installShadow(host);
    if (waitingHosts.size) schedule();
  }
  function schedule() { if (!frame && !disposed) frame = requestAnimationFrame(flush); }
  function collect(node) {
    if (node.nodeType !== 1) return false;
    let found = false;
    if (node.matches('[data-setting="theme"]') || node.querySelector('[data-setting="theme"]')) { settingsNeeded = true; found = true; }
    if (node.id === 'pn-player-root') { if (!hosts.has(node)) waitingHosts.set(node, 0); found = true; }
    for (const host of node.querySelectorAll('#pn-player-root')) { if (!hosts.has(host)) waitingHosts.set(host, 0); found = true; }
    return found;
  }
  function refresh() { if (document.body && !disposed) { collect(document.body); syncTheme(); schedule(); } }

  function closeSettings(restoreFocus = true) {
    if (!modal) return;
    const was = modal; modal = null; was.remove();
    if (restoreFocus) {
      const target = opener?.isConnected ? opener : document.querySelector('[data-flow-digital-settings]');
      target?.focus({ preventScroll: true });
      feedback('close');
    }
    opener = null;
  }
  function openSettings() {
    if (disposed) return false;
    if (modal?.isConnected) { modal.querySelector('button')?.focus({ preventScroll: true }); return true; }
    const other = [...document.querySelectorAll('[aria-modal="true"]')].find(node => !node.hidden && node.getClientRects().length);
    if (other) return false;
    opener = document.activeElement;
    const rows = [['motion', 'Движение и свет', 'Плавные переходы, орбиты и свечение'], ['sound', 'Звуковые отклики', 'Короткие звуки при нажатии и ответе'], ['haptics', 'Вибрация', hapticAvailable() ? 'Тактильный отклик на устройстве' : 'В этом браузере недоступна'], ['ambient', 'Звуковая атмосфера', 'Тихий фон, включается отдельно']];
    const cues = [['tap', 'Касание'], ['open', 'Открытие'], ['close', 'Закрытие'], ['listen', 'Слушаю'], ['stop', 'Остановка'], ['send', 'Отправка'], ['reply', 'Ответ'], ['success', 'Готово'], ['error', 'Ошибка']];
    modal = document.createElement('div'); modal.className = 'modal-backdrop flow-effects-backdrop';
    modal.innerHTML = `<section class="sheet flow-effects-sheet" role="dialog" aria-modal="true" aria-labelledby="flow-effects-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="flow-effects-title">Свет и звук</h2><button type="button" class="icon-button" data-flow-effects-close aria-label="Закрыть">×</button></div><div class="list-panel">${rows.map(([key, label, hint]) => `<div class="settings-row"><div><strong id="flow-effect-${key}-label">${label}</strong><span id="flow-effect-${key}-hint">${hint}</span></div><label class="switch"><input type="checkbox" role="switch" data-flow-effect="${key}" aria-labelledby="flow-effect-${key}-label" aria-describedby="flow-effect-${key}-hint" ${key === 'haptics' && !hapticAvailable() ? 'disabled' : ''}><span></span></label></div>`).join('')}</div><div class="settings-row"><span class="section-note" data-flow-motion-note></span><button type="button" class="small-button" data-flow-motion-system>Как в системе</button></div><section class="section"><h3>Звуки Digital Magic</h3><p class="section-note" data-flow-sound-note></p><div class="inline-actions" role="group" aria-label="Звуковые отклики">${cues.map(([key, label]) => `<button type="button" class="small-button" data-flow-sound-cue="${key}">${label}</button>`).join('')}</div></section><div class="flow-sound-params">${[['wet','Пространство',.7],['echo','Эхо',.75],['tone','Яркость',1],['volume','Громкость',.85]].map(([key,label,max])=>`<label>${label}<input type="range" data-flow-sound-param="${key}" aria-label="${label} звука" min="0" max="${max}" step=".01" value="${window.flowSound?.getParams?.()[key]??.3}"></label>`).join('')}</div><p class="section-note">Настройки сохраняются на этом устройстве.</p><div class="sheet-actions"><button type="button" class="primary-button" data-flow-effects-close>Готово</button></div></section>`;
    modal.addEventListener('click', event => { if (event.target === modal || event.target.closest('[data-flow-effects-close]')) { event.preventDefault(); event.stopPropagation(); closeSettings(); } });
    document.body.append(modal); syncControls(); modal.querySelector('button')?.focus({ preventScroll: true }); feedback('open');
    return true;
  }
  function keydown(event) {
    if (!modal?.isConnected) return;
    // Run before the native sheet-state document listener so its owner is untouched.
    event.stopImmediatePropagation();
    if (event.key === 'Escape') { event.preventDefault(); closeSettings(); return; }
    if (event.key !== 'Tab') return;
    const items = [...modal.querySelectorAll('button,input,[tabindex]')].filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
    const first = items[0], last = items.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (!modal.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) { event.preventDefault(); first.focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  }
  function click(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('[data-flow-digital-settings]')) { event.preventDefault(); event.stopPropagation(); openSettings(); return; }
    if (target.closest('[data-flow-motion-system]')) { motionMode = 'system'; apply(true); feedback('tap'); return; }
    const cue = target.closest('[data-flow-sound-cue]');
    if (cue) { if (settings.sound) feedback(cue.dataset.flowSoundCue); else syncControls(); return; }
    if (target.matches('input,select,textarea,audio,video') || target.closest('.flow-effects-backdrop,.flow-assistant-layer,.assistant-fab,.dm-live-assistant,.dm-live-fab,[data-flow-assistant],#pn-player-root,.piano-keyboard,.keyboard,.reader-text,.note-reader,.media-scrub')) return;
    const control = target.closest('button,a[href]');
    if (control) feedback('tap');
  }
  function change(event) {
    const input = event.target;
    if(input.matches?.('[data-flow-sound-param]') && modal?.contains(input)){soundParams=window.flowSound?.setParams?.({[input.dataset.flowSoundParam]:Number(input.value)})||{};persist();return;}
    if (!(input instanceof HTMLInputElement) || !input.matches('[data-flow-effect]') || !modal?.contains(input)) return;
    const key = input.dataset.flowEffect;
    if (key === 'motion') motionMode = input.checked ? 'on' : 'off'; else settings[key] = input.checked;
    apply(true); feedback('tap');
  }
  function visibility() {
    document.body?.classList.toggle('digital-hidden', document.hidden);
    if (document.hidden) window.flowSound?.suspend(); else { window.flowSound?.resume(); audio(); refresh(); }
  }
  function dispose() {
    disposed = true; if (frame) cancelAnimationFrame(frame); frame = 0;
    observer?.disconnect(); themeObserver?.disconnect();
    for (const record of hosts.values()) record.observer.disconnect();
    hosts.clear(); waitingHosts.clear(); closeSettings(false); probe?.remove();
    document.removeEventListener('click', click, true); document.removeEventListener('change', change, true); document.removeEventListener('input', change, true);
    document.removeEventListener('visibilitychange', visibility); window.removeEventListener('keydown', keydown, true);
    query.removeEventListener('change', onMotionChange);
  }
  function onMotionChange() { apply(); }
  function start() {
    root.dataset.flowDesign = 'magic';
    probe = document.createElement('span'); probe.hidden = true; probe.setAttribute('aria-hidden', 'true'); probe.dataset.flowAccentProbe = 'true'; probe.style.color = 'var(--accent, currentColor)'; document.body.append(probe);
    themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(root, { attributes: true, attributeFilter: ['data-accent', 'data-theme', 'data-palette', 'data-flow-design', 'style'] });
    observer = new MutationObserver(records => {
      let relevant = false;
      for (const record of records) {
        for (const node of record.addedNodes) relevant = collect(node) || relevant;
        if (record.removedNodes.length && [...hosts.keys()].some(host => !host.isConnected)) relevant = true;
      }
      if (relevant) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', click, true); document.addEventListener('change', change, true); document.addEventListener('input', change, true);
    document.addEventListener('visibilitychange', visibility); window.addEventListener('keydown', keydown, true);
    query.addEventListener('change', onMotionChange);
    refresh(); apply();
  }
  function setEffect(key,value){if(!['motion','sound','haptics','ambient'].includes(key))return false;if(key==='motion')motionMode=value?'on':'off';else settings[key]=Boolean(value);apply(true);return settings[key];}
  function setMotionMode(value){if(!['system','on','off'].includes(value))return motionMode;motionMode=value;apply(true);return motionMode;}
  window.flowDigital = { settings, feedback, reducedMotion, openSettings, refresh, dispose, setEffect, setMotionMode, setSound: value => setEffect('sound',value), getState: () => ({ ...window.flowSound?.getState?.(), ...settings, motionMode, motionReduced: reducedMotion(), accentRGB: rgb, pianoHosts: hosts.size, settingsOpen: !!modal?.isConnected, disposed }) };
  window.addEventListener('pageshow', () => { if (!disposed) { visibility(); apply(); } });
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
