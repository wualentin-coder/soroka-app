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
      .glow-boot-ring {
        display: block; width: 44px; height: 44px; margin: auto;
        color: var(--a4, #ffd078);
        filter: drop-shadow(0 0 8px color-mix(in srgb, var(--a3, #ff9635) 72%, transparent));
      }
      .glow-boot-ring circle { fill: none; stroke: currentColor; stroke-width: 2; }
      .glow-boot-ring circle:first-child { opacity: .17; }
      .glow-boot-ring circle:last-child {
        stroke-linecap: round; stroke-dasharray: 28 100;
        transform-origin: center; animation: glow-boot-spin .95s linear infinite;
      }
      @keyframes glow-boot-spin { to { transform: rotate(1turn); } }
      @media (prefers-reduced-motion: reduce) {
        .glow-boot-ring circle:last-child { animation: none; }
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
      status.innerHTML = '<svg class="glow-boot-ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="16"/><circle cx="22" cy="22" r="16" pathLength="100"/></svg>';
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
