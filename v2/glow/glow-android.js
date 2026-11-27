(() => {
  'use strict';

  if (!/\bAndroid\b/i.test(navigator.userAgent)) return;
  document.documentElement.dataset.glowAndroid = 'true';

  // Android keeps a stable backdrop through idle, scrolling and route changes.
  const style = document.createElement('style');
  style.textContent = `
    .phone :is(.glass, .tk) {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    .phone .dock {
      background: linear-gradient(155deg, rgba(47,39,51,.72), rgba(18,15,24,.78) 63%, rgba(29,23,37,.72));
    }
    .phone :is(.grain, .blob, .bgf i, .bge i, .bgc i, .plate-w .halo, .plate-w .fill,
      .crt .scan, .nowl i, .ev.now .chk, .chk.ready, .cat .cg, .star svg, .star .rays),
    .phone .bgc::before,
    .phone .glass::before, .phone .glass::after, .phone .isl::before, .phone .isl::after,
    .phone #asLock:not(.on) .aarr,
    .phone:not([data-as="listen"]) .wave i {
      animation-name: none;
    }
    .phone .grain { inset: 0; }
    .phone .blob { will-change: auto; }
    .phone .glow-route-entry.in { animation-name: none; }
    .phone :is(.screen.mb, .daylamp.mv, .dock .glow.mv, #pracBody) {
      filter: none !important;
    }
  `;
  document.head.append(style);

  document.addEventListener('DOMContentLoaded', () => {
    const grain = document.querySelector('#phone > .grain');
    if (grain) document.querySelector('#env').append(grain);
    document.querySelector('#star animateTransform')?.remove();
  }, { once: true });
})();
