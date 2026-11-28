(() => {
  'use strict';

  const appearance = document.createElement('style');
  const release = document.documentElement.dataset.glowRelease === 'true';
  if (release) document.querySelector('#star animateTransform')?.remove();
  const prototypePractice = document.documentElement.dataset.glowPractice === 'prototype';
  const practiceScreens = prototypePractice ? ['practice', ...Object.keys(SUBS).filter(id => SUBS[id] === 'practice')] : [];
  const causticScreen = practiceScreens.length
    ? `.screen.on:not(${practiceScreens.map(id => `[data-s="${id}"]`).join(',')})`
    : '.screen.on';
  appearance.textContent = `
    ${release ? '.phone .star svg, .phone .star .rays { animation: none; }' : ''}
    html[data-glow-release] #phone:not(.land) { transition: none; }
    @media (min-width: 481px) {
      html[data-glow-release] #phone:not(.land):not(.pn-device-land) { max-height: calc(100dvh - 48px); }
    }
    html[data-glow-release] .cal .nav { flex: 0 0 44px; width: 44px; height: 44px; }
    html[data-glow-release] :is(.screen, #sheet) :is(button.chip, .btn.sm, .seg button, .kseg button, .ib.add, .spx, .sptsrc) { min-height: 44px; min-width: 44px; }
    html[data-glow-release] .screen :is(.st-i, .st-add, .st-in, .search input) { min-height: 44px; }
    html[data-glow-release] .screen .sbox::before { inset: -15px; }
    html[data-glow-release] .days.month { --h: 44px; }
    @media (min-width: 320px) and (max-width: 375px) {
      html[data-glow-release] :is(.cal, .spweek) { margin-inline: -12px; padding-inline: 2px; }
      html[data-glow-release] #days { margin-inline: 0; padding-inline: 0; }
      html[data-glow-release] :is(.cal .days, .cal .wk, .spweek) { column-gap: 0; }
      html[data-glow-release] .cal .westrip { left: calc(500% / 7); }
      html[data-glow-release] .cal .top { padding-inline: 8px; }
    }
    @media (max-width: 370px) {
      html[data-glow-release] .cal .top { display: grid; grid-template-columns: 1fr 44px 44px; }
      html[data-glow-release] .cal .top .seg { grid-column: 1 / -1; width: auto; margin-left: 0; }
    }
    #agc > .hd { padding-bottom: 0; }
    #agenda > .rail + .ev { padding-top: 8px; }
    #agc:has(> #agenda > .nowl:last-child) { padding-bottom: 16px; }
    #agenda > .nowl:last-child b { right: 16px; }
    #agenda > .nowl:has(.nowl-marker) { --now-travel: 12px; height: calc(14px + var(--now-travel)); }
    .nowl-marker {
      position: absolute; inset: 0 0 auto; height: 14px;
      transform: translateY(calc(var(--now-progress, 0) * var(--now-travel)));
      transition-property: none;
    }
    #agenda .ev[data-overdue]:not(.done) .chk {
      box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--a2) 68%, var(--text)),
        0 0 15px color-mix(in srgb, var(--a2) 68%, transparent);
    }

    .phone:has(#env[data-bg="caustic"]) .screen.on :is(.cal, .agc, .near, .cat, .search) {
      background: linear-gradient(152deg, rgba(255,255,255,.115), rgba(12,10,19,.11) 58%, rgba(12,10,19,.24));
    }
    .phone:has(#env[data-bg="caustic"]) ${causticScreen} .glass:not(.glass .glass) {
      backdrop-filter: blur(13px) saturate(1.32);
      -webkit-backdrop-filter: blur(13px) saturate(1.32);
    }
  `;
  document.head.append(appearance);

  // The existing Glow view uses the same device preference keys in glow-shell.js.
  const preferences = [
    ['pal', 'flow-glow-palette-v1'],
    ['bg', 'flow-glow-background-v1'],
    ['crt', 'flow-glow-crt-v1'],
    ['mb', 'flow-glow-motion-blur-v1'],
    ['motion', 'flow-glow-motion-v1'],
    ['snd', 'flow-glow-sound-v1'],
  ];

  for (const [id, key] of preferences) {
    const group = document.getElementById(id);
    if (!group) continue;

    const buttons = Array.from(group.querySelectorAll('button[data-v]'));
    try {
      const stored = localStorage.getItem(key);
      buttons.find(button => button.dataset.v === stored)?.click();
    } catch {
      // The prototype's controls also work when device storage is unavailable.
    }

    group.addEventListener('click', event => {
      const button = event.target.closest('button[data-v]');
      if (!buttons.includes(button)) return;
      try {
        localStorage.setItem(key, button.dataset.v);
      } catch {
        // Keep the selection active for this page.
      }
    });
  }
})();
