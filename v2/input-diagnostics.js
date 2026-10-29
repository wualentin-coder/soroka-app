// Temporary, bounded phone measurements for the reported input lag. No content or targets.
(function () {
  const BUILD = 'input-20261029-1', KEY = 'flow-input-diagnostic';
  let active = false;
  window.startFlowInputDiagnostics = function (send) {
    if (active || typeof send !== 'function' || Date.now() > Date.parse('2026-11-01T00:00:00Z')) return;
    try { if (Date.now() - Number(localStorage.getItem(KEY) || 0) < 2 * 3600000) return; } catch (_) {}
    active = true;
    const abort = new AbortController(), observers = [];
    const queue = [], work = [], paint = [], total = [], dispatch = [], frames = [];
    let taps = 0, longN = 0, longMs = 0, longMax = 0, frame = 0, eventApi = false;
    const add = (list, n) => { if (Number.isFinite(n) && n >= 0 && n < 60000 && list.length < 128) list.push(Math.round(n)); };
    const max = a => a.length ? Math.max(...a) : 0;
    const p95 = a => a.length ? [...a].sort((a,b)=>a-b)[Math.ceil(a.length*.95)-1] : 0;
    function observe(type, consume) {
      try {
        const observer = new PerformanceObserver(list => {
          if (!document.hidden) for (const entry of list.getEntries()) consume(entry);
        });
        observer.observe({type, buffered:false, ...(type === 'event' ? {durationThreshold:16} : {})});
        observers.push(observer); return true;
      } catch (_) { return false; }
    }
    eventApi = observe('event', e => {
      if (!e.interactionId) return;
      add(queue, e.processingStart - e.startTime);
      add(work, e.processingEnd - e.processingStart);
      add(paint, Math.max(0, e.duration - (e.processingEnd - e.startTime)));
      add(total, e.duration);
    });
    observe('longtask', e => { longN++; longMs += e.duration; longMax = Math.max(longMax, e.duration); });
    document.addEventListener('pointerup', e => {
      if (document.hidden) return;
      taps++; add(dispatch, performance.now() - e.timeStamp);
    }, {capture:true, passive:true, signal:abort.signal});
    document.addEventListener('click', () => {
      if (document.hidden || frame) return;
      const at = performance.now();
      frame = requestAnimationFrame(() => { frame = 0; if (!document.hidden) add(frames, performance.now() - at); });
    }, {capture:true, passive:true, signal:abort.signal});
    const clearFrame = () => { cancelAnimationFrame(frame); frame = 0; };
    document.addEventListener('visibilitychange', clearFrame, {signal:abort.signal});
    setTimeout(() => {
      abort.abort(); observers.forEach(o=>o.disconnect()); clearFrame();
      // One report, after cleanup. No retries or background polling.
      const samples = [
        {build:BUILD,n:total.length,q95:p95(queue),qMax:max(queue),js95:p95(work),paint95:p95(paint),inpMax:max(total)},
        {build:BUILD,taps,dispatchMax:max(dispatch),frame95:p95(frames),frameMax:max(frames),longN,longMs:Math.round(longMs),longMax:Math.round(longMax)},
      ];
      const entries = samples.map((sample,i)=>({at:new Date().toISOString(),action:`ui_perf_${i}`,error:JSON.stringify(sample),ms:i?max(frames):max(total),online:navigator.onLine,hidden:document.hidden}));
      entries.push({at:new Date().toISOString(),action:'ui_perf_env',error:JSON.stringify({build:BUILD,eventApi,w:innerWidth,h:innerHeight,dpr:devicePixelRatio}),ms:0,online:navigator.onLine,hidden:document.hidden});
      Promise.resolve().then(()=>send(entries)).then(()=>{try{localStorage.setItem(KEY,String(Date.now()));}catch(_){}}).catch(()=>{});
    }, 45000);
  };
})();
