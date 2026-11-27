(() => {
  'use strict';

  let transition = null;
  let blurFrame = 0;
  let androidSlide = null;
  const originalSwap = swap;
  const originalBlur = blurPulse;
  const android = document.documentElement.dataset.glowAndroid === 'true';
  const practiceVisual = document.documentElement.dataset.glowPractice === 'prototype';
  const practiceRoute = id => practiceVisual && (id === 'practice' || SUBS[id] === 'practice');
  let prototypeTransition = false;

  const style = document.createElement('style');
  style.textContent = `
    .phone.glow-transitioning:not(.calm) .screen.on { filter: url(#mbx); }
    .phone:not(.calm) .glow-slide-blur { filter: url(#mbx); }
  `;
  document.head.append(style);

  // The calendar and screen transitions share the same horizontal SVG blur.
  blurPulse = (peak, duration) => {
    cancelAnimationFrame(blurFrame);
    if (android || reduce || !mbK) {
      mbB.setAttribute('stdDeviation', '0 0');
      return;
    }
    if (practiceVisual && (prototypeTransition || practiceRoute(curId()))) return originalBlur(peak, duration);
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

  // Android filters only the moving surface, for the fast part of its slide.
  function slideAndroid(surface, direction) {
    androidSlide?.cancel();
    if (reduce || !direction) return null;

    const duration = 380;
    const peak = Math.min(12, 9 * mbK);
    const animation = surface.animate(
      [{ transform: `translateX(${48 * direction}px)` }, { transform: 'none' }],
      { duration, easing: 'cubic-bezier(.19,1,.22,1)' });
    let frame = 0;

    function clearBlur() {
      cancelAnimationFrame(frame);
      surface.classList.remove('glow-slide-blur');
      mbB.setAttribute('stdDeviation', '0 0');
    }
    function finishSlide() {
      if (androidSlide !== run) return;
      androidSlide = null;
      if (peak > 0) clearBlur();
    }
    const run = { cancel() { finishSlide(); animation.cancel(); } };
    androidSlide = run;
    animation.finished.then(finishSlide, finishSlide);

    if (peak > 0) {
      surface.classList.add('glow-slide-blur');
      const blur = () => {
        const progress = Math.min(1, Number(animation.currentTime) / 300);
        if (progress >= 1 || reduce || !mbK) { clearBlur(); return; }
        mbB.setAttribute('stdDeviation', `${(peak * (1 - progress) ** 2).toFixed(2)} 0`);
        frame = requestAnimationFrame(blur);
      };
      blur();
    }
    return animation;
  }

  if (android) {
    window.glowSlide = slideAndroid;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) androidSlide?.cancel();
    });
  }

  swap = (fromId, id, direction) => {
    const from = document.querySelector(`.screen[data-s="${fromId}"]`);
    const target = document.querySelector(`.screen[data-s="${id}"]`);
    if (android) {
      androidSlide?.cancel();
      const to = paint(id);
      for (const item of to.querySelectorAll('.in')) item.classList.add('glow-route-entry');
      to.scrollTop = 0;
      setHead(id, direction);
      for (const screen of document.querySelectorAll('.screen.on')) {
        if (screen === to) continue;
        screen.classList.remove('on');
        screen.inert = true;
      }
      to.inert = false;
      to.classList.add('on');
      if (from !== to) slideAndroid(to, direction);
      return;
    }
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
