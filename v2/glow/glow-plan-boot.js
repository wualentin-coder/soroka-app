(() => {
  'use strict';

  const root = document.documentElement;
  const release = root.dataset.glowRelease === 'true';
  if (!release && new URLSearchParams(location.search).get('runtime') !== 'server') return;
  const bootURL = new URL(document.currentScript.src);
  const moduleURL = new URL('./planner/glow-plan.mjs', bootURL);
  moduleURL.search = bootURL.search;
  const legacyURL = new URL('../classic.html', bootURL);
  root.dataset.glowPlan = 'loading';
  const style = document.createElement('style');
  style.textContent = `html:is([data-glow-plan='loading'], [data-glow-plan='error']) .screen:is([data-s='plan'], [data-s='tasks'], [data-s='finance'], [data-s='render'], [data-s='saved'], [data-s='savedCat'], [data-s='note'], [data-s='list'], [data-s='recipe'], [data-s='mat'], [data-s='prod'], [data-s='film'], [data-s='reco'], [data-s='marathon'], [data-s='marnew'], [data-s='more'], [data-s='projects'], [data-s='project'], [data-s='docs'], [data-s='vault'], [data-s='archive'], [data-s='pc'], [data-s='server'], [data-s='vpn'], [data-s='settings'], [data-s='setp']) { visibility: hidden; }
    html:is([data-glow-plan='loading'], [data-glow-plan='error']):not([data-glow-practice='prototype']) .screen[data-s='practice'] { visibility: hidden; }
    html[data-glow-plan='loading'] #isl[data-st='render'] #islC { visibility: hidden; }`;
  document.head.append(style);
  if (release) {
    const releaseStyle = document.createElement('style');
    releaseStyle.textContent = `
      html[data-glow-release] body > .panel { display: none; }
      html[data-glow-release]:not([data-glow-plan="ready"]) #phone { visibility: hidden; }
      .glow-release-status { position: fixed; inset: 50% auto auto 50%; transform: translate(-50%, -50%); width: min(320px, 90vw); text-align: center; }
      .glow-release-status a { color: inherit; }
      .glow-release-status:has(.glow-boot-mark) {
        inset: 0; transform: none; width: auto; display: grid; place-items: center;
        overflow: hidden; isolation: isolate;
        background:
          radial-gradient(ellipse 38% 23% at 50% 51%, color-mix(in srgb, var(--a3) 21%, transparent), transparent 100%),
          radial-gradient(ellipse 65% 35% at 26% 37%, color-mix(in srgb, var(--a1) 26%, transparent), transparent 100%),
          radial-gradient(ellipse 55% 35% at 68% 65%, color-mix(in srgb, var(--a2) 13%, transparent), transparent 100%),
          var(--ink);
      }
      .glow-release-status:has(.glow-boot-mark)::before {
        content: ''; position: absolute; inset: 0; pointer-events: none;
        opacity: var(--grain); mix-blend-mode: soft-light;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.86' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
      }
      .glow-boot-mark { position: relative; width: min(176px, 52vw); aspect-ratio: 1; overflow: visible; }
      .glow-boot-star {
        color: var(--a4); filter: drop-shadow(0 0 11px var(--a3));
        animation: glow-boot-arrive 520ms var(--ease) both;
      }
      .glow-boot-trail {
        transform-origin: center; filter: blur(4px); fill: var(--a3); opacity: 0;
        animation: glow-boot-trail 480ms var(--ease) both;
      }
      .glow-boot-satellites {
        transform-origin: center; fill: var(--a4); opacity: .58;
        animation: glow-boot-breathe 3.2s ease-in-out 520ms infinite alternate;
      }
      @keyframes glow-boot-arrive {
        from { opacity: .2; transform: translate(-14px, 9px); }
        to { opacity: 1; transform: none; }
      }
      @keyframes glow-boot-trail {
        0% { opacity: .54; transform: translate(-22px, 11px) rotate(-13deg) scale(1.6, .55); }
        72%, 100% { opacity: 0; transform: none; }
      }
      @keyframes glow-boot-breathe { to { opacity: .85; transform: scale(1.045); } }
      .glow-release-status[data-motion="calm"] :is(.glow-boot-star, .glow-boot-trail, .glow-boot-satellites) {
        animation: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .glow-release-status :is(.glow-boot-star, .glow-boot-trail, .glow-boot-satellites) { animation: none; }
      }
    `;
    document.head.append(releaseStyle);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const status = release ? document.createElement('section') : null;
    if (status) {
      status.className = 'glow-release-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-label', 'Загружаем Flow');
      status.dataset.pal = document.getElementById('phone')?.dataset.pal || 'ember';
      try {
        if (localStorage.getItem('flow-glow-motion-v1') === 'calm') status.dataset.motion = 'calm';
      } catch {}
      status.innerHTML = `<svg class="glow-boot-mark" viewBox="0 0 160 160" aria-hidden="true">
        <defs>
          <path id="glow-boot-shape" d="M50 2C53 36 64 47 98 50C64 53 53 64 50 98C47 64 36 53 2 50C36 47 47 36 50 2Z"/>
          <linearGradient id="glow-boot-light" x1="14%" y1="1%" x2="76%" y2="100%">
            <stop offset="29%" stop-color="var(--text)"/><stop offset="76%" stop-color="var(--a4)"/><stop offset="100%" stop-color="var(--a3)"/>
          </linearGradient>
        </defs>
        <g class="glow-boot-trail"><use href="#glow-boot-shape" transform="translate(45 45) scale(.70)"/></g>
        <g class="glow-boot-satellites">
          <use href="#glow-boot-shape" transform="translate(113 38) scale(.16)"/>
          <use href="#glow-boot-shape" transform="translate(36 108) scale(.092)"/>
        </g>
        <g class="glow-boot-star"><use href="#glow-boot-shape" transform="translate(45 45) scale(.70)" fill="url(#glow-boot-light)"/></g>
      </svg>`;
      document.body.append(status);
    }
    import(moduleURL.href).catch(() => {
      root.dataset.glowPlan = 'error';
      window.toast?.('Не удалось открыть План');
    }).then(() => {
      if (!status) return;
      if (root.dataset.glowPlan === 'ready') { status.remove(); return; }
      const authenticated = window.Telegram?.WebApp?.initData || window.SorokaAndroid;
      status.removeAttribute('aria-label');
      status.textContent = authenticated ? 'Не удалось загрузить Flow. Обнови страницу.' : 'Открой Glow из приложения Flow или Telegram.';
      const fallback = document.createElement('a');
      legacyURL.search = location.search;
      legacyURL.hash = location.hash;
      fallback.href = legacyURL.href;
      fallback.textContent = 'Открыть прежнюю версию';
      status.append(document.createElement('br'), fallback);
    });
  }, { once: true });
})();
