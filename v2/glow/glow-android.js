(() => {
  'use strict';

  if (!/\bAndroid\b/i.test(navigator.userAgent)) return;
  document.documentElement.dataset.glowAndroid = 'true';

  // Android Chromium can drop paint layers when many cards use backdrop filters.
  // The navigation dock still needs its backdrop to soften the content behind it.
  const style = document.createElement('style');
  style.textContent = `
    .phone .glass:not(.dock) {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    .phone:has(#env[data-bg="caustic"]) .screen.on .glass:not(.glass .glass),
    .phone:has(#env[data-bg="caustic"]) .screen.on .tk {
      backdrop-filter: blur(10px) saturate(1.24) !important;
      -webkit-backdrop-filter: blur(10px) saturate(1.24) !important;
    }
    .phone .glow-route-entry.in {
      animation-name: none;
    }
    .phone:is(.glow-scrolling, .glow-transitioning) .glass::before,
    .phone:is(.glow-scrolling, .glow-transitioning) .glass::after,
    .phone:is(.glow-scrolling, .glow-transitioning) :is(.grain, .blob, .cat .cg, .bgc i),
    .phone:is(.glow-scrolling, .glow-transitioning) .bgc::before {
      animation-play-state: paused !important;
    }
  `;
  document.head.append(style);

  let resumeTimer = 0;
  function pauseMotion(screen) {
    const phone = screen.closest('.phone');
    phone.classList.add('glow-scrolling');
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => phone.classList.remove('glow-scrolling'), 140);
  }

  // Pause before Chrome paints the first scroll frame, then follow momentum scroll events.
  document.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    const screen = event.target.closest?.('.screen.on');
    if (screen) pauseMotion(screen);
  }, { capture: true, passive: true });

  document.addEventListener('scroll', event => {
    const screen = event.target;
    if (screen.matches?.('.screen.on')) pauseMotion(screen);
  }, { capture: true, passive: true });
})();
