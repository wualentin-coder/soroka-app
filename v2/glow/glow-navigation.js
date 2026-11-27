(() => {
  'use strict';

  let transition = null;
  let blurFrame = 0;
  const originalSwap = swap;
  const originalBlur = blurPulse;
  const practiceVisual = document.documentElement.dataset.glowPractice === 'prototype';
  const practiceRoute = id => practiceVisual && (id === 'practice' || SUBS[id] === 'practice');
  let prototypeTransition = false;

  const style = document.createElement('style');
  style.textContent = `
    .phone.glow-transitioning:not(.calm) .screen.on { filter: url(#mbx); }
  `;
  document.head.append(style);

  // The calendar and screen transitions share the same horizontal SVG blur.
  blurPulse = (peak, duration) => {
    cancelAnimationFrame(blurFrame);
    if (practiceVisual && (prototypeTransition || practiceRoute(curId()))) return originalBlur(peak, duration);
    if (reduce || !mbK) {
      mbB.setAttribute('stdDeviation', '0 0');
      return;
    }
    const start = performance.now();
    const strength = peak * mbK;
    function frame(now) {
      const progress = Math.max(0, Math.min(1, (now - start) / duration));
      const radius = strength * (1 - progress) ** 2;
      mbB.setAttribute('stdDeviation', `${radius.toFixed(2)} 0`);
      if (progress < 1) blurFrame = requestAnimationFrame(frame);
    }
    frame(start);
  };

  function currentFrame(screen) {
    const { opacity, transform } = getComputedStyle(screen);
    return { opacity, transform };
  }

  function finish(run) {
    if (transition !== run) return;
    transition = null;
    clearTimeout(run.leaveTimer);
    clearTimeout(run.finishTimer);
    run.from.classList.remove('on');
    run.outgoing.cancel();
    run.incoming.cancel();
    phone.classList.remove('glow-transitioning');
  }

  swap = (fromId, id, direction) => {
    const from = document.querySelector(`.screen[data-s="${fromId}"]`);
    const target = document.querySelector(`.screen[data-s="${id}"]`);
    if (practiceRoute(fromId) || practiceRoute(id)) {
      if (transition) finish(transition);
      from.inert = target.inert = false;
      prototypeTransition = true;
      try { return originalSwap(fromId, id, direction); }
      finally { prototypeTransition = false; }
    }
    const outgoingStart = transition ? currentFrame(from) : { opacity: 1, transform: 'none' };
    const incomingStart = transition && target.classList.contains('on') ? currentFrame(target)
      : { opacity: 0, transform: `translateX(${90 * direction}px)` };
    const to = paint(id);
    to.inert = false;
    to.scrollTop = 0;
    setHead(id, direction);
    if (from === to) {
      to.classList.add('on');
      return;
    }

    if (document.documentElement.dataset.glowAndroid === 'true') {
      // On mobile the screen enters as one surface. Local card actions keep their motion.
      for (const item of to.querySelectorAll('.in')) item.classList.add('glow-route-entry');
    }
    if (transition) finish(transition);
    phone.classList.add('glow-transitioning');
    from.inert = true;

    const outgoing = from.animate([outgoingStart, { opacity: 0, transform: `translateX(${-70 * direction}px)` }],
      { duration: 360, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    const incoming = to.animate([incomingStart, { opacity: 1, transform: 'none' }],
      { duration: 620, easing: 'cubic-bezier(.19,1,.22,1)', fill: 'backwards' });
    const startTime = document.timeline.currentTime;
    outgoing.startTime = incoming.startTime = startTime;
    to.classList.add('on');
    blurPulse(14, 520);
    const run = { from, outgoing, incoming };
    transition = run;
    // A delayed compositor frame must not keep old layers interactive or blurred.
    run.leaveTimer = setTimeout(() => {
      if (transition !== run) return;
      from.classList.remove('on');
      outgoing.cancel();
    }, 360);
    run.finishTimer = setTimeout(() => finish(run), 620);
  };
})();
