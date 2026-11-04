(function () {
  "use strict";
  const ONLINE_MS = 60000;
  const finite = value => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value)) ? Number(value) : null;
  const percent = value => { const n = finite(value); return n === null ? null : Math.round(Math.max(0, Math.min(100, n))); };
  const escape = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  let zoneFormatter = null, formatterZone = null;
  const eventTimes = new WeakMap();
  function zonedParts(at, timezone) {
    try {
      if (!zoneFormatter || formatterZone !== timezone) {
        zoneFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
        formatterZone = timezone;
      }
      return Object.fromEntries(zoneFormatter.formatToParts(at).map(p => [p.type, p.value]));
    }
    catch (_) { return null; }
  }
  function eventStart(event, timezone) {
    const cached = eventTimes.get(event);
    if (cached && cached.timezone === timezone && cached.due === event.due && cached.time === event.time && cached.startsAt === event.startsAt) return cached.at;
    const at = calculateEventStart(event, timezone);
    eventTimes.set(event, { timezone, due: event.due, time: event.time, startsAt: event.startsAt, at });
    return at;
  }
  function calculateEventStart(event, timezone) {
    if (event.startsAt) { const at = Date.parse(event.startsAt); return Number.isFinite(at) ? at : null; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.due || "") || !/^\d{2}:\d{2}$/.test(event.time || "") || !timezone) return null;
    const target = Date.parse(`${event.due}T${event.time}:00Z`);
    if (!Number.isFinite(target)) return null;
    let at = target;
    for (let i = 0; i < 3; i++) {
      const parts = zonedParts(at, timezone);
      if (!parts) return null;
      const wall = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
      at += target - wall;
    }
    const p = zonedParts(at, timezone);
    return p && `${p.year}-${p.month}-${p.day}` === event.due && `${p.hour}:${p.minute}` === event.time ? at : null;
  }
  function model({ section = "Flow", pc = null, data = {}, now = Date.now(), unavailable = false }) {
    const r = pc?.render || {};
    const seen = Date.parse(pc?.agentSeen);
    const renderAt = r.at ? Date.parse(r.at) : seen;
    const fresh = !unavailable && pc?.agent === true && Number.isFinite(seen) && now - seen >= -5000 && now - seen < ONLINE_MS
      && Number.isFinite(renderAt) && now - renderAt >= -30000 && now - renderAt < 90000;
    const active = r.rendering === true;
    const job=(pc?.rmQueue?.jobs||[]).find(item=>['rendering','paused'].includes(item.status));
    const queueStamp=Date.parse(pc?.rmQueue?.at||pc?.rmQueue?.observed_at||pc?.agentSeen);
    const queueFresh=!unavailable&&pc?.agent===true&&Number.isFinite(seen)&&now-seen>=-5000&&now-seen<ONLINE_MS&&Number.isFinite(queueStamp)&&now-queueStamp>=-30000&&now-queueStamp<90000;
    const events = (data.events || []).map(event => ({ ...event, at: eventStart(event, data.timezone) })).filter(e => e.at !== null && e.at >= now).sort((a, b) => a.at - b.at).slice(0, 3);
    const day = zonedParts(now, data.timezone);
    const today = day ? `${day.year}-${day.month}-${day.day}` : "";
    const tasks = (data.tasks || []).filter(t => !t.done && (t.priority === "high" || (today && t.due && t.due < today))).sort((a, b) => Number(b.priority === "high") - Number(a.priority === "high") || String(a.due || "9999").localeCompare(String(b.due || "9999"))).slice(0, 3);
    let kind = "idle", label = section, progress = null;
    if (active) {
      if (!fresh) { kind = "disconnected"; label = "ПК · нет связи"; }
      else { kind = "render"; progress = percent(r.percent); const app = r.app === "Karma" ? "Karma" : "AE"; label = progress === null ? `${app} · рендер` : `${app} · ${progress}%`; }
    } else if (job?.status === 'paused') {
      kind=queueFresh?'pause':'disconnected';label=queueFresh?'Рендер · пауза':'ПК · нет связи';
    } else if (events[0] && events[0].at - now <= 3600000) {
      kind = "event"; label = `Через ${Math.max(1, Math.ceil((events[0].at - now) / 60000))} мин`;
    }
    const render = active ? { fresh, title: r.comp || r.app || "After Effects", frame: finite(r.frame), frames: finite(r.frames), eta: fresh ? finite(r.eta) : null, elapsed: fresh && finite(r.since) !== null ? Math.max(0, Math.round(now / 1000 - Number(r.since))) : null } : null;
    return { kind, label, progress, render, job:job?{id:job.id,name:job.name,status:job.status,fresh:queueFresh}:null, events, tasks, interval: active || (pc?.rmQueue?.jobs || []).some(j => ["queued","paused","rendering","delivering"].includes(j.status)) ? 3000 : 15000 };
  }
  function createStateSource(fetchState, { now = Date.now, hidden = () => document.hidden, publish = () => {} } = {}) {
    let snapshot = null, at = 0, pending = null, generation = 0;
    return {
      snapshot: () => snapshot,
      invalidate: () => { generation++; at = -Infinity; },
      read() {
        if (hidden()) return snapshot ? Promise.resolve(snapshot) : Promise.reject(new Error("hidden"));
        if (pending) return pending;
        const ttl = snapshot?.render?.rendering || snapshot?.rmQueue?.jobs?.some(j => ["queued","paused","rendering","delivering"].includes(j.status)) ? 3000 : 15000;
        if (snapshot && now() - at < ttl) return Promise.resolve(snapshot);
        const requestedGeneration = generation;
        pending = Promise.resolve().then(fetchState).then(value => {
          if (!value || value.error) throw new Error(value?.error || "PC state unavailable");
          snapshot = value; at = requestedGeneration === generation ? now() : -Infinity;
          if (requestedGeneration === generation) publish(value);
          return value;
        }).finally(() => { pending = null; });
        return pending;
      },
    };
  }
  function createPoller({ read, paint, hidden, setTimer = setTimeout, clearTimer = clearTimeout }) {
    let timer = null, pending = false, stopped = false;
    const cancel = () => { if (timer !== null) clearTimer(timer); timer = null; };
    async function tick() {
      cancel();
      if (stopped || hidden() || pending) return;
      pending = true;
      try { await read(); } catch (_) {}
      finally { pending = false; if (!stopped && !hidden()) timer = setTimer(tick, paint()); }
    }
    return { start: tick, visibility() { cancel(); if (!hidden()) void tick(); }, stop() { stopped = true; cancel(); } };
  }
  let controller = null;
  function mount(pill, options) {
    if (!controller) controller = createController(options);
    controller.attach(pill, options.section, options);
    return controller;
  }
  function createController(options) {
    let pill = null, section = "Flow", layer = null, shown = null, pc = null, unavailable = false, page = options.page(), lastPanelHTML="";
    const current = () => model({ section, pc, data: options.data(), unavailable });
    function close(restoreFocus = true) {
      if (!layer) return;
      layer.remove(); layer = null; shown = null; lastPanelHTML="";
      pill?.setAttribute("aria-expanded", "false");
      if (restoreFocus) pill?.focus({ preventScroll: true });
    }
    const duration = value => value === null ? "" : `${Math.round(value / 60)} мин`;
    function panel(state) {
      const render = state.render;
      const controls=state.job?.fresh&&typeof window.rmAction==='function'?`<div class="island-render-controls"><button type="button" data-island-command="${state.job.status==='paused'?'rm-resume':'rm-pause'}">${state.job.status==='paused'?'Продолжить':'Пауза'}</button><button type="button" data-island-command="rm-cancel">Остановить</button></div>`:'';
      const facts = render ? [render.fresh && render.frame !== null && render.frames !== null ? `Кадр ${render.frame} из ${render.frames}` : "", render.elapsed !== null ? `Идёт ${duration(render.elapsed)}` : "", render.eta !== null ? `Осталось ~${duration(render.eta)}` : ""].filter(Boolean).join(" · ") : "";
      return `<header><strong>Сейчас в Flow</strong><button type="button" data-island-close aria-label="Закрыть">×</button></header>${render ? `<section class="island-render"><small>${render.fresh ? "After Effects" : "Связь с ПК потеряна"}</small><b>${escape(render.title)}</b>${state.progress === null ? "" : `<span>${state.progress}%</span>`}${facts ? `<p>${escape(facts)}</p>` : ""}</section>` : ""}${state.events.length ? `<section><h3>Ближайшее</h3>${state.events.map((event, i) => `<button type="button" data-island-event="${i}"><b>${escape(event.title)}</b><small>${escape(event.due || "")} ${escape(event.time || "")}</small></button>`).join("")}</section>` : ""}${state.tasks.length ? `<section><h3>Важные дела</h3>${state.tasks.map((task, i) => `<button type="button" data-island-task="${i}"><b>${escape(task.title)}</b><small>${escape(task.due || "Без срока")}</small></button>`).join("")}</section>` : ""}${controls}${!render && !state.events.length && !state.tasks.length ? "<p class=\"island-empty\">Сейчас всё спокойно.</p>" : ""}<button type="button" class="island-pins" data-island-pins>Закреплённое <span>→</span></button>`;
    }
    function paint() {
      const state = current();
      if (pill?.isConnected) {
        const label=state.kind==='idle'&&section==='Flow'?'Flow рядом':state.label; if(pill.textContent!==label)pill.textContent=label;
        pill.dataset.activity = state.kind;
        pill.dataset.progressKnown = String(state.progress !== null);
        pill.style.setProperty("--island-progress", `${state.progress ?? 0}%`);
        pill.setAttribute("aria-label", `${state.label} — текущая активность`);
      }
      if (layer) {
        shown = state;
        const card = layer.querySelector(".activity-island-card");
        const html = panel(state);
        if (lastPanelHTML !== html) {
          lastPanelHTML=html;
          const focus = document.activeElement;
          const selector = focus?.hasAttribute("data-island-command") ? `[data-island-command="${focus.dataset.islandCommand}"]` : focus?.getAttribute("data-island-event") !== null && focus?.hasAttribute("data-island-event") ? `[data-island-event="${focus.dataset.islandEvent}"]` : focus?.hasAttribute("data-island-task") ? `[data-island-task="${focus.dataset.islandTask}"]` : focus?.hasAttribute("data-island-pins") ? "[data-island-pins]" : "[data-island-close]";
          const inside = card.contains(focus), top = card.scrollTop;
          card.innerHTML = html; card.scrollTop = top;
          if (inside) card.querySelector(selector)?.focus({ preventScroll: true });
        }
      }
      if (typeof CustomEvent === "function") document.dispatchEvent(new CustomEvent("flow:activity", { detail: { kind:state.kind, progress:state.progress, label:state.label, fresh:state.render?.fresh??true } }));
      return state.interval;
    }
    function toggle() {
      if (layer) { close(); return; }
      layer = document.createElement("div"); layer.className = "activity-island-layer";
      layer.innerHTML = '<section class="activity-island-card" role="region" aria-label="Текущая активность" tabindex="-1"></section>';
      document.body.appendChild(layer);
      pill?.setAttribute("aria-expanded", "true");
      position(); paint(); layer.querySelector(".activity-island-card").focus({ preventScroll: true });
      layer.addEventListener("click", event => {
        const target = event.target.closest("button, .activity-island-scrim");
        if (!target) return;
        if (target.matches("[data-island-close], .activity-island-scrim")) { close(); return; }
        if(target.hasAttribute('data-island-command')){const job=shown.job;if(job?.fresh&&typeof window.rmAction==='function')window.rmAction(target.dataset.islandCommand,{dataset:{id:String(job.id),name:job.name||'Рендер'}});return;}
        if (target.hasAttribute("data-island-pins")) { close(false); options.pinned(); return; }
        const state = shown;
        const task = target.hasAttribute("data-island-task");
        const index = Number(task ? target.dataset.islandTask : target.dataset.islandEvent);
        const record = (task ? state.tasks : state.events)[index];
        if (record) { close(false); options.open(task ? "task" : "event", record.id); }
      });
    }
    document.addEventListener("keydown", event => {
      if (!layer) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close(); }

    }, true);
    function position(){if(!layer||!pill?.getBoundingClientRect)return;const r=pill.getBoundingClientRect(),width=Math.min(360,innerWidth-24);layer.style.setProperty('--island-left',`${Math.max(12,Math.min(innerWidth-width-12,r.left+r.width/2-width/2))}px`);layer.style.setProperty('--island-top',`${r.top}px`);layer.style.setProperty('--island-width',`${width}px`);}
    document.addEventListener('pointerdown',event=>{if(layer&&!layer.contains(event.target)&&!pill?.contains(event.target))close(false);},true);
    window.addEventListener?.('resize',position);window.addEventListener?.('scroll',position,{passive:true});
    const poller = createPoller({ hidden: () => document.hidden, paint, read: async () => {
      if (typeof window.sorokaPc !== "function") return;
      try { pc = await window.sorokaPc({ op: "state" }); unavailable = false; }
      catch (_) { unavailable = true; }
    } });
    document.addEventListener("visibilitychange", () => poller.visibility());
    void poller.start();
    return { attach(next, title, nextOptions) {
      if(nextOptions)options=nextOptions;
      if (page !== options.page()) { close(false); page = options.page(); }
      pill = next; section = title || "Flow";
      pill.classList.add("activity-island"); pill.setAttribute("aria-haspopup", "false"); pill.setAttribute("aria-expanded", String(Boolean(layer)));
      if (!pill.dataset.islandBound) { pill.dataset.islandBound = "true"; pill.addEventListener("click", toggle); }
      position();paint();
    }, close };
  }
  window.FlowActivity = { model, eventStart, percent, createStateSource, createPoller, mount };
})();
