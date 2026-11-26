/* Flow · Glow — оболочка (этап 0). Загружается design-mode.js только в режиме Glow.
   Только вид: среда (фоны), зерно, палитра и фон на устройстве, свой блик у каждой плашки.
   Данные и поведение приложения не трогает. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset.flowSkin !== 'glow' || window.flowGlow) return;

  const PALETTES = [
    ['ember', 'Ember', ['#7b2cff', '#ff3d6e', '#ff8a1f', '#ffd36b']],
    ['abyss', 'Abyss', ['#2a1fd1', '#3d5bff', '#3fa2ff', '#b9e2ff']],
    ['signal', 'Signal', ['#0b6b3a', '#19c25a', '#5dff7e', '#d8ffd9']],
    ['aurora', 'Aurora', ['#0d5c63', '#2ec4b6', '#7cf2d6', '#e0fff7']],
    ['rose', 'Rose', ['#7a1846', '#d6336c', '#ff7aa8', '#ffe1ec']],
    ['ice', 'Ice', ['#1d3a8a', '#3a7bd5', '#7fd1ff', '#eaf8ff']],
    ['violet', 'Violet', ['#3b1a8f', '#7b3fe4', '#b18cff', '#efe6ff']],
    ['citrus', 'Citrus', ['#4a5a00', '#9bbb00', '#e3ff4f', '#fbffe0']],
    ['mono', 'Mono', ['#24242c', '#5f5f6c', '#c9c9d6', '#ffffff']]
  ];
  const BACKGROUNDS = [['light', 'Свет'], ['forms', 'Формы'], ['ellipse', 'Эллипсы'], ['caustic', 'Каустика']];
  const palKey = 'flow-glow-palette-v1', bgKey = 'flow-glow-background-v1';
  const load = (key, allowed, fallback) => { try { const v = localStorage.getItem(key); return allowed.includes(v) ? v : fallback; } catch { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  let palette = load(palKey, PALETTES.map(p => p[0]), 'ember');
  let background = load(bgKey, BACKGROUNDS.map(b => b[0]), 'light');

  /* цвет акцента магии в формате r,g,b (её правила пишут rgba(var(--accent-rgb),…)) */
  const accentStyle = document.createElement('style');
  accentStyle.id = 'glow-accent';
  function applyPalette() {
    root.dataset.glowPal = palette;
    const hex = PALETTES.find(p => p[0] === palette)[2][2];
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',');
    accentStyle.textContent = `html[data-flow-skin=glow]{--accent-rgb:${rgb}!important;--energy-rgb:${rgb}!important}`;
    if (!accentStyle.isConnected) document.head.appendChild(accentStyle);
  }
  applyPalette();

  let env = null;
  function mount() {
    if (env?.isConnected) return;
    env = document.createElement('div');
    env.className = 'glow-env';
    env.setAttribute('aria-hidden', 'true');
    env.dataset.bg = background;
    env.innerHTML = '<i class="gb b4"></i><i class="gb b1"></i><i class="gb b2"></i><i class="gb b3"></i><i class="gb b5"></i>'
      + '<div class="gf"><i class="fl"></i><i class="fq q1"></i><i class="fq q2"></i><i class="fq q3"></i><i class="fq q4"></i></div>'
      + '<div class="ge">' + Array.from({ length: 9 }, (_, i) => `<i style="--i:${i}"></i>`).join('') + '</div>'
      + '<div class="gc"><i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i><i class="c5"></i></div>';
    const grain = document.createElement('div');
    grain.className = 'glow-grain';
    grain.setAttribute('aria-hidden', 'true');
    /* заливка звезды ассистента, как в прототипе */
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    defs.setAttribute('aria-hidden', 'true');
    defs.setAttribute('width', '0'); defs.setAttribute('height', '0');
    defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    defs.innerHTML = '<defs><radialGradient id="glow-star-fill"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="var(--a4)"/></radialGradient>'
      + '<linearGradient id="glow-star-sheen" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/>'
      + '<animateTransform attributeName="gradientTransform" type="translate" values="-1 -1;-1 -1;1 1" keyTimes="0;.45;1" dur="5.5s" repeatCount="indefinite"/></linearGradient></defs>';
    document.body.prepend(env);
    document.body.append(grain, defs);
    syncPage();
  }

  /* раздел → расстановка пятен */
  const PRACTICE = ['english', 'sport', 'piano'];
  function pageGroup() {
    const page = (typeof ui !== 'undefined' && ui?.page) || location.hash.slice(1) || 'today';
    if (['today', 'upcoming', 'tasks'].includes(page)) return 'plan';
    if (page === 'saved' || page.startsWith('saved')) return 'saved';
    if (PRACTICE.includes(page)) return 'practice';
    if (page === 'finance' || page === 'render') return page;
    return 'more';
  }
  function syncPage() { if (env) { const group = pageGroup(); if (env.dataset.page !== group) env.dataset.page = group; } }

  /* у каждой плашки свой блик: угол, место, ширина, темп. Значения от названия и места плашки — стабильны между перерисовками. */
  const PLATES = '.dm-plan-schedule,.dm-overdue,.side-card,.list-panel,.saved-section-card,.dc2-module,.dc-module-card,.dm-finance-balance,.dm-finance-flow,.settings-group,.dv-preference-card,.ds-group,.ds-status,.server-kpis,.dsr-main,.dsr-card,.ds2-surface,.pc-hero,.en-lesson,.en-rules,.pnw-focus';
  function hash(text) { let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function vary(plate) {
    if (plate.dataset.glowSheen) return;
    const index = plate.parentElement ? [...plate.parentElement.children].indexOf(plate) : 0;
    let seed = hash(plate.className + '|' + index);
    const next = () => { seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0; seed ^= seed >>> 13; return (seed % 10000) / 10000; };
    const R = (a, b) => a + next() * (b - a);
    const s = plate.style;
    s.setProperty('--rd', (-R(0, 16)).toFixed(2) + 's');
    s.setProperty('--sha', R(95, 145).toFixed(0) + 'deg');
    s.setProperty('--shp', R(30, 70).toFixed(0) + '%');
    s.setProperty('--sy', R(-12, 22).toFixed(0) + '%');
    s.setProperty('--shw', R(42, 78).toFixed(0) + '%');
    s.setProperty('--sho', R(.025, .055).toFixed(3));
    s.setProperty('--shd', R(8, 15).toFixed(1) + 's');
    plate.dataset.glowSheen = '1';
  }
  let queued = false;
  function refresh() {
    queued = false;
    mount();
    syncPage();
    for (const plate of document.querySelectorAll('.main :is(' + PLATES + ')')) vary(plate);
    /* перелив света по звезде, как в прототипе: копия контура с бегущим бликом */
    for (const svg of document.querySelectorAll('.assistant-fab > svg')) {
      const path = svg.querySelector('path:not(.glow-ssh)');
      if (!path || svg.querySelector('.glow-ssh')) continue;
      const sheen = path.cloneNode(false);
      sheen.setAttribute('class', 'glow-ssh');
      sheen.setAttribute('fill', 'url(#glow-star-sheen)');
      svg.appendChild(sheen);
    }
    injectSettings();
  }
  const schedule = () => { if (!queued) { queued = true; setTimeout(refresh, 50); } };

  /* ассистент ведёт фон: слушает → свет собирается к звезде */
  document.addEventListener('flow:assistantphase', event => {
    if (!env) return;
    const state = String(event.detail?.state || 'idle');
    const as = !event.detail?.open ? '' : /listen|record/.test(state) ? 'listen' : /think|process|work|transcrib|send/.test(state) ? 'think' : /speak|answer|result/.test(state) ? 'speak' : '';
    if (as) env.dataset.as = as; else delete env.dataset.as;
  });

  /* настройки: палитра и фон — на этом устройстве, рядом с выбором дизайна */
  function injectSettings() {
    const row = document.querySelector('.flow-design-row');
    if (!row || row.nextElementSibling?.classList.contains('glow-pal-row')) return;
    const pal = document.createElement('div');
    pal.className = 'settings-row flow-design-row glow-pal-row';
    pal.innerHTML = '<div><strong>Палитра Glow</strong><span>' + PALETTES.find(p => p[0] === palette)[1] + '</span></div><div class="glow-pal" role="group" aria-label="Палитра Glow">'
      + PALETTES.map(([key, label, c]) => `<button type="button" data-glow-pal="${key}" aria-label="${label}" aria-pressed="${key === palette}" style="--p1:${c[0]};--p2:${c[1]};--p3:${c[2]};--p4:${c[3]}"></button>`).join('') + '</div>';
    const bg = document.createElement('div');
    bg.className = 'settings-row flow-design-row glow-bg-row';
    bg.innerHTML = '<div><strong>Фон Glow</strong><span>Медленная среда за плашками</span></div><select data-glow-bg aria-label="Фон Glow">'
      + BACKGROUNDS.map(([key, label]) => `<option value="${key}"${key === background ? ' selected' : ''}>${label}</option>`).join('') + '</select>';
    row.after(pal, bg);
  }
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-glow-pal]');
    if (!button || button.closest('html') !== root || !button.closest('.glow-pal')) return;
    palette = button.dataset.glowPal;
    save(palKey, palette);
    applyPalette();
    const group = button.closest('.glow-pal');
    for (const b of group.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === button));
    const hint = group.parentElement.querySelector('span');
    if (hint) hint.textContent = PALETTES.find(p => p[0] === palette)[1];
  });
  document.addEventListener('change', event => {
    const select = event.target.closest?.('[data-glow-bg]');
    if (!select) return;
    background = select.value;
    save(bgKey, background);
    if (env) env.dataset.bg = background;
  });

  window.addEventListener('hashchange', schedule);
  function start() {
    refresh();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });

  window.flowGlow = Object.freeze({
    palettes: PALETTES.map(p => p[0]),
    backgrounds: BACKGROUNDS.map(b => b[0]),
    get palette() { return palette; },
    get background() { return background; }
  });
})();
