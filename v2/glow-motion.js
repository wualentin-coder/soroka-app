/* Flow · Glow — движение экранов как в прототипе (docs/design/glow-prototype/index.html: swap, blurPulse, bindCaps, flipSwap).
   Приложение перерисовывает экран целиком (render), поэтому переходы CSS прототипа не от чего проигрывать.
   Модуль оборачивает render и после перерисовки:
   • смена экрана (вкладка, раздел, запись, назад) — старый экран уходит (−70 px, 360 мс), новый въезжает (90 px, 620 мс),
     размытие движения по горизонтали затухает за 520 мс (blurPulse 14);
   • тот же экран — капсулы и вкладки (.kseg, .seg) проигрывают переход от прежнего выбора, карточки переезжают на новые
     места, новые проявляются (flipSwap).
   Выключается только явным «Без движения» (data-motion=off). Только Glow. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset.flowSkin !== 'glow' || window.flowGlowMotion || typeof window.render !== 'function') return;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const calm = () => root.dataset.motion === 'off' || document.hidden;
  const touchScreen = window.matchMedia('(hover:none) and (pointer:coarse)');
  const EIN = 'cubic-bezier(.4,0,1,1)', EOUT = 'cubic-bezier(.19,1,.22,1)';

  // размытие движения: один SVG-фильтр, stdDeviation по X затухает (blurPulse прототипа)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true'); svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML = '<filter id="gw-mbf" x="-10%" y="0" width="120%" height="100%"><feGaussianBlur id="gw-mbb" stdDeviation="0 0"/></filter>';
  document.body.appendChild(svg);
  const mbB = svg.querySelector('#gw-mbb');
  function blurPulse(peak, ms) {
    if (touchScreen.matches || calm()) return;
    const t0 = performance.now();
    (function f(t) { const p = Math.min(1, (t - t0) / ms), v = peak * (1 - p) ** 2; mbB.setAttribute('stdDeviation', v.toFixed(2) + ' 0'); if (p < 1) requestAnimationFrame(f); })(t0);
  }

  /* экран: что сейчас видно — экран записи поверх раздела или страница */
  const TAB = { today: 0, saved: 1, practice: 2, english: 2, sport: 2, piano: 2, finance: 3 };
  function current() {
    const sheet = $('.gw.gw-sheet') || $('.note-sheet.gw-note');
    const page = $('.dm-main > .gw') || $('.dm-main');
    if (sheet) return { el: sheet, key: `sheet:${sheet.dataset.s || 'note'}:${ui.sheet?.id || ''}`, depth: 3, tab: TAB[ui.page] ?? 4 };
    const reco = ui.page === 'saved' && ui.savedCategory === 'movies' && ui.savedFilter === 'reco';
    const settingsPane = ui.page === 'settings' ? page?.dataset.settingsPane || '' : '';
    const key = `${ui.page}|${ui.page === 'saved' ? ui.savedCategory || '' : settingsPane}|${reco ? 'reco:' + (typeof universeUi === 'object' ? universeUi.detail?.id || universeUi.tab : '') : ''}`;
    const depth = settingsPane ? 1 : ui.page !== 'saved' ? 0 : !ui.savedCategory || ui.savedCategory === 'overview' ? 0 : reco ? 2 : 1;
    return { el: page, key, depth, tab: TAB[ui.page] ?? 4 };
  }
  let last = null;

  /* капсулы и вкладки: запомнить выбор до перерисовки */
  function segState(scope) {
    return $$('.kseg, .seg', scope).map(s => ({ on: [...s.querySelectorAll(':scope > button')].findIndex(b => b.classList.contains('on')), i: s.style.getPropertyValue('--i') }));
  }
  function replaySegs(scope, before) {
    const segs = $$('.kseg, .seg', scope);
    segs.forEach((s, n) => {
      const was = before[n]; if (!was) return;
      const btns = [...s.querySelectorAll(':scope > button')], now = btns.findIndex(b => b.classList.contains('on')), iNow = s.style.getPropertyValue('--i');
      if (was.on === now && was.i === iNow) return;
      // прежнее состояние без перехода, затем новое — переход CSS прототипа проигрывается
      if (now >= 0) btns[now].classList.remove('on'); if (was.on >= 0 && btns[was.on]) btns[was.on].classList.add('on');
      if (was.i !== '') s.style.setProperty('--i', was.i);
      void s.offsetWidth;
      requestAnimationFrame(() => { if (was.on >= 0 && btns[was.on]) btns[was.on].classList.remove('on'); if (now >= 0) btns[now].classList.add('on'); if (iNow !== '') s.style.setProperty('--i', iNow);
        const ki = now >= 0 && btns[now].querySelector('.ki'); ki && ki.animate([{ transform: 'scale(.7) rotate(-12deg)' }, { transform: 'scale(1.15)', offset: .6 }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.9,.3,1.2)' }); });
    });
  }
  /* карточки: где стояли до перерисовки (flipSwap) */
  const FLIP = '[data-id],[data-gw-film],[data-gw-lc],[data-gw-addr],[data-ev],[data-gw-rc]';
  const fkey = el => `${el.dataset.category || ''}:${el.dataset.id || el.dataset.gwFilm || el.dataset.gwLc || el.dataset.gwAddr || el.dataset.ev || el.dataset.gwRc}`;
  function rects(scope) { const m = new Map(); const list = $$(FLIP, scope); if (list.length > 160) return m; list.forEach(el => { const k = fkey(el); if (!m.has(k)) m.set(k, el.getBoundingClientRect()); }); return m; }
  function replayFlip(scope, first) {
    if (!first.size) return; let j = 0;
    $$(FLIP, scope).forEach(el => {
      const k = fkey(el), f = first.get(k); if (el.closest('.ev') && el !== el.closest('.ev')) return;
      if (!f) { el.animate([{ opacity: 0, transform: 'translateY(10px) scale(.97)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 480, delay: (j++) * 25, easing: EOUT, fill: 'backwards' }); return; }
      const r = el.getBoundingClientRect(), dx = f.left - r.left, dy = f.top - r.top;
      if (Math.abs(dx) + Math.abs(dy) > 1 && Math.abs(dy) < innerHeight) el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 520, easing: EOUT });
    });
  }

  /* смена экрана: снимок старого уходит, новый въезжает */
  function swap(oldClone, rect, to, dir) {
    if (oldClone) {
      const layer = document.createElement('div');
      layer.inert = true;
      layer.setAttribute('aria-hidden', 'true');
      layer.className = 'gw-swapout'; layer.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${Math.min(rect.height, innerHeight - rect.top)}px;overflow:hidden;z-index:${oldClone.classList.contains('gw-sheet') ? 71 : 1};pointer-events:none`;
      if (!touchScreen.matches) layer.style.filter = 'url(#gw-mbf)';
      oldClone.style.position = oldClone.classList.contains('gw-sheet') ? 'absolute' : ''; oldClone.style.inset = oldClone.classList.contains('gw-sheet') ? '0' : '';
      oldClone.style.visibility = 'visible'; layer.appendChild(oldClone);
      (oldClone.classList.contains('gw-sheet') ? document.body : $('.dm-main')?.parentElement || document.body).appendChild(layer);
      layer.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-70 * dir}px)` }], { duration: 360, easing: EIN, fill: 'forwards' }).onfinish = () => layer.remove();
      setTimeout(() => layer.remove(), 500);
    }
    if (to) enter(to, dir, 0);
    entering = { t: performance.now(), dir };
    blurPulse(14, 520);
  }
  // въезд нового экрана; если приложение сразу перерисовало экран ещё раз — продолжаем на новом узле с того же места
  let entering = null;
  function enter(to, dir, elapsed) {
    if (!touchScreen.matches) to.style.filter = 'url(#gw-mbf)';
    to.animate([{ opacity: 0, transform: `translateX(${90 * dir}px)` }, { opacity: 1, transform: 'none' }], { duration: 620, delay: -elapsed, easing: EOUT }).onfinish = () => {
      if (to.style.filter.includes('#gw-mbf')) to.style.filter = '';
    };
  }

  /* Живое приложение перерисовывает экран и без нажатий (синхронизация, «показать пришедшие данные» раз в 700 мс).
     В прототипе экран перерисовывается только при переходе — поэтому:
     • появление (.in) играет только при смене экрана; при перерисовке того же экрана — сразу на месте (gw-settled);
     • бесконечные анимации (грань, свечение, ореолы) идут по общим часам и после перерисовки продолжаются с того же места;
     • переходы капсул и перестановка карточек — только в ответ на действие человека (касание или клавиша за последние 0,8 с). */
  let touched = 0;
  for (const type of ['pointerdown', 'keydown', 'input', 'change']) document.addEventListener(type, () => { touched = performance.now(); }, true);
  const byHand = () => performance.now() - touched < 800;
  function settle(el, on) { if (!el) return; el.classList.toggle('gw-settled', on); }
  function keepPhase(el) {
    if (!el?.getAnimations) return;
    for (const a of el.getAnimations({ subtree: true })) {
      const t = a.effect?.getTiming?.();
      if (t && t.iterations === Infinity && a.startTime !== 0) { try { a.startTime = 0; } catch (_) {} } // фаза = общее время (+ своя задержка элемента)
    }
  }
  /* stagger прототипа: у каждой плашки свой блик и фаза грани. Значения — от класса и места плашки (а не случайные),
     поэтому одинаковы после каждой перерисовки и ставятся в том же кадре — свет не перескакивает. */
  const hashS = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
  function stagger(scope) {
    if (!scope) return;
    $$('.glass,.plate-w', scope).forEach((g, n) => {
      if (g.dataset.gwSheenReady) return; g.dataset.gwSheenReady = '1';
      let seed = hashS(g.className + '|' + n);
      const R = (a, b) => { seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0; seed = (seed ^ (seed >>> 13)) >>> 0; return a + (seed % 10000) / 10000 * (b - a); };
      const s = g.style;
      s.setProperty('--rd', (-R(0, 16)).toFixed(2) + 's');
      if (!s.getPropertyValue('--sha')) { s.setProperty('--sha', R(95, 145).toFixed(0) + 'deg'); s.setProperty('--shp', R(30, 70).toFixed(0) + '%'); s.setProperty('--sy', R(-12, 22).toFixed(0) + '%');
        s.setProperty('--shw', R(42, 78).toFixed(0) + '%'); s.setProperty('--sho', R(.025, .055).toFixed(3)); s.setProperty('--shd', R(8, 15).toFixed(1) + 's'); s.setProperty('--cgx', R(-18, 18).toFixed(0) + '%'); }
    });
  }
  const native = window.render;
  window.render = function (...args) {
    const before = last || current();
    const hand = byHand(), scope = before.el, segs = scope && hand ? segState(scope) : [], first = scope && hand ? rects(scope) : new Map();
    const rect = scope && !calm() ? scope.getBoundingClientRect() : null;
    const out = native.apply(this, args);
    try { const cur = current(); settle(cur.el, cur.key === before.key); $$('.gw').forEach(stagger); keepPhase(cur.el); $$('.gw').forEach(g => { if (g !== cur.el) keepPhase(g); }); } catch (_) {}
    // уходящий слой — сам прежний узел: при смене экрана приложение убирает его из документа (копировать не нужно)
    let clone = scope && rect && !scope.isConnected ? scope : null;
    if (clone) { $$('[id]', clone).forEach(n => n.removeAttribute('id')); clone.removeAttribute('id'); }
    const now = current(); last = now;
    if (calm() || !now.el) return out;
    if (now.key !== before.key) {
      const dir = now.depth !== before.depth ? (now.depth > before.depth ? 1 : -1) : now.tab !== before.tab ? (now.tab > before.tab ? 1 : -1) : 1;
      // открыли запись поверх раздела: раздел остаётся в документе (спрятан под экраном записи) — уходит его копия
      if (!clone && scope && rect && scope.isConnected && now.depth === 3) clone = scope.cloneNode(true);
      swap(clone, rect, now.el, dir);
    } else if (now.el) {
      const since = entering ? performance.now() - entering.t : 1e9;
      if (since < 600 && now.el !== before.el) enter(now.el, entering.dir, since);
      else if (hand) { replaySegs(now.el, segs); replayFlip(now.el, first); }
    }
    return out;
  };
  // экраны записей, заметка и т. п. открываются тем же render — снимок «до» обновляем и после действий без render
  last = current(); $$('.gw').forEach(stagger);
  // слои вне render (код, готовка, окно фильмов) — тоже со своими бликами
  new MutationObserver(recs => { for (const r of recs) for (const n of r.addedNodes) if (n.nodeType === 1 && n.classList.contains('gw')) stagger(n); }).observe(document.body, { childList: true });
  window.flowGlowMotion = { native, blurPulse, state: () => ({ last, entering }) };
})();
