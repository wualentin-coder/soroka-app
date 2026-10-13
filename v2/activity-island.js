(function () {
  "use strict";
  const ONLINE_MS = 60000;
  const finite = value => (typeof value === "number" || (typeof value === "string" && value.trim() !== "")) && Number.isFinite(Number(value)) ? Number(value) : null;
  const percent = value => { const n = finite(value); return n === null ? null : Math.round(Math.max(0, Math.min(100, n))); };
  const escape = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  function zonedParts(at, timezone) {
    try { return Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at).map(p => [p.type, p.value])); }
    catch (_) { return null; }
  }
  function eventStart(event, timezone) {
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
    const fresh = !unavailable && pc?.agent === true && Number.isFinite(seen) && now - seen >= -5000 && now - seen < ONLINE_MS;
    const active = r.rendering === true;
    const events = (data.events || []).map(event => ({ ...event, at: eventStart(event, data.timezone) })).filter(e => e.at !== null && e.at >= now).sort((a, b) => a.at - b.at).slice(0, 3);
    const day = zonedParts(now, data.timezone);
    const today = day ? `${day.year}-${day.month}-${day.day}` : "";
    const tasks = (data.tasks || []).filter(t => !t.done && (t.priority === "high" || (today && t.due && t.due < today))).sort((a, b) => Number(b.priority === "high") - Number(a.priority === "high") || String(a.due || "9999").localeCompare(String(b.due || "9999"))).slice(0, 3);
    let kind = "idle", label = section, progress = null;
    if (active) {
      if (!fresh) { kind = "disconnected"; label = "ПК · связь потеряна"; }
      else { kind = "render"; progress = percent(r.percent); label = progress === null ? "AE · рендер" : `AE · ${progress}%`; }
    } else if (events[0] && events[0].at - now <= 3600000) {
      kind = "event"; label = `Через ${Math.max(1, Math.ceil((events[0].at - now) / 60000))} мин`;
    }
    const render = active ? { fresh, title: r.comp || r.app || "After Effects", frame: finite(r.frame), frames: finite(r.frames), eta: fresh ? finite(r.eta) : null, elapsed: fresh && finite(r.since) !== null ? Math.max(0, Math.round(now / 1000 - Number(r.since))) : null } : null;
    return { kind, label, progress, render, events, tasks, interval: active && fresh ? 6000 : 15000 };
  }
  function createStateSource(fetchState, { now = Date.now, hidden = () => document.hidden } = {}) {
    let snapshot = null, at = 0, pending = null;
    return {
      snapshot: () => snapshot,
      invalidate: () => { at = -Infinity; },
      read() {
        if (hidden()) return snapshot ? Promise.resolve(snapshot) : Promise.reject(new Error("hidden"));
        if (pending) return pending;
        const ttl = snapshot?.render?.rendering ? 6000 : 15000;
        if (snapshot && now() - at < ttl) return Promise.resolve(snapshot);
        pending = Promise.resolve().then(fetchState).then(value => {
          if (!value || value.error) throw new Error(value?.error || "PC state unavailable");
          snapshot = value; at = now(); return value;
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
    controller.attach(pill, options.section);
    return controller;
  }
  function createController(options) {
    let pill = null, section = "Flow", layer = null, pc = null, unavailable = false, page = options.page();
    const current = () => model({ section, pc, data: options.data(), unavailable });
    function close(restoreFocus = true) {
      if (!layer) return;
      layer.remove(); layer = null;
      pill?.setAttribute("aria-expanded", "false");
      if (restoreFocus) pill?.focus({ preventScroll: true });
    }
    const duration = value => value === null ? "" : `${Math.round(value / 60)} мин`;
    function panel(state) {
      const render = state.render;
      const facts = render ? [render.fresh && render.frame !== null && render.frames !== null ? `Кадр ${render.frame} из ${render.frames}` : "", render.elapsed !== null ? `Идёт ${duration(render.elapsed)}` : "", render.eta !== null ? `Осталось ~${duration(render.eta)}` : ""].filter(Boolean).join(" · ") : "";
      return `<header><strong>Сейчас в Flow</strong><button type="button" data-island-close aria-label="Закрыть">×</button></header>${render ? `<section class="island-render"><small>${render.fresh ? "After Effects" : "Связь с ПК потеряна"}</small><b>${escape(render.title)}</b>${state.progress === null ? "" : `<span>${state.progress}%</span>`}${facts ? `<p>${escape(facts)}</p>` : ""}</section>` : ""}${state.events.length ? `<section><h3>Ближайшее</h3>${state.events.map((event, i) => `<button type="button" data-island-event="${i}"><b>${escape(event.title)}</b><small>${escape(event.due || "")} ${escape(event.time || "")}</small></button>`).join("")}</section>` : ""}${state.tasks.length ? `<section><h3>Важные дела</h3>${state.tasks.map((task, i) => `<button type="button" data-island-task="${i}"><b>${escape(task.title)}</b><small>${escape(task.due || "Без срока")}</small></button>`).join("")}</section>` : ""}${!render && !state.events.length && !state.tasks.length ? "<p class=\"island-empty\">Сейчас всё спокойно.</p>" : ""}<button type="button" class="island-pins" data-island-pins>Закреплённое <span>→</span></button>`;
    }
    function paint() {
      const state = current();
      if (pill?.isConnected) {
        if (pill.textContent !== state.label) pill.textContent = state.label;
        pill.dataset.activity = state.kind;
        pill.dataset.progressKnown = String(state.progress !== null);
        pill.style.setProperty("--island-progress", `${state.progress ?? 0}%`);
        pill.setAttribute("aria-label", `${state.label} — текущая активность`);
      }
      if (layer) {
        const card = layer.querySelector(".activity-island-card");
        const html = panel(state);
        if (card.innerHTML !== html) {
          const focus = document.activeElement;
          const selector = focus?.getAttribute("data-island-event") !== null && focus?.hasAttribute("data-island-event") ? `[data-island-event="${focus.dataset.islandEvent}"]` : focus?.hasAttribute("data-island-task") ? `[data-island-task="${focus.dataset.islandTask}"]` : focus?.hasAttribute("data-island-pins") ? "[data-island-pins]" : "[data-island-close]";
          const inside = card.contains(focus), top = card.scrollTop;
          card.innerHTML = html; card.scrollTop = top;
          if (inside) card.querySelector(selector)?.focus({ preventScroll: true });
        }
      }
      return state.interval;
    }
    function toggle() {
      if (layer) { close(); return; }
      layer = document.createElement("div"); layer.className = "activity-island-layer";
      layer.innerHTML = '<div class="activity-island-scrim"></div><section class="activity-island-card" role="dialog" aria-modal="true" aria-label="Текущая активность" tabindex="-1"></section>';
      document.body.appendChild(layer);
      pill?.setAttribute("aria-expanded", "true");
      paint(); layer.querySelector(".activity-island-card").focus({ preventScroll: true });
      layer.addEventListener("click", event => {
        const target = event.target.closest("button, .activity-island-scrim");
        if (!target) return;
        if (target.matches("[data-island-close], .activity-island-scrim")) { close(); return; }
        if (target.hasAttribute("data-island-pins")) { close(false); options.pinned(); return; }
        const state = current();
        const task = target.hasAttribute("data-island-task");
        const index = Number(task ? target.dataset.islandTask : target.dataset.islandEvent);
        const record = (task ? state.tasks : state.events)[index];
        if (record) { close(false); options.open(task ? "task" : "event", record.id); }
      });
    }
    document.addEventListener("keydown", event => {
      if (!layer) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close(); }
      else if (event.key === "Tab") {
        const buttons = [...layer.querySelectorAll("button")];
        const first = buttons[0], last = buttons.at(-1);
        if (event.shiftKey && (document.activeElement === first || !buttons.includes(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !buttons.includes(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
    }, true);
    const poller = createPoller({ hidden: () => document.hidden, paint, read: async () => {
      if (typeof window.sorokaPc !== "function") return;
      try { pc = await window.sorokaPc({ op: "state" }); unavailable = false; }
      catch (_) { unavailable = true; }
    } });
    document.addEventListener("visibilitychange", () => poller.visibility());
    void poller.start();
    return { attach(next, title) {
      if (page !== options.page()) { close(false); page = options.page(); }
      pill = next; section = title || "Flow";
      pill.classList.add("activity-island"); pill.setAttribute("aria-haspopup", "dialog"); pill.setAttribute("aria-expanded", String(Boolean(layer)));
      if (!pill.dataset.islandBound) { pill.dataset.islandBound = "true"; pill.addEventListener("click", toggle); }
      paint();
    }, close };
  }
  window.FlowActivity = { model, eventStart, percent, createStateSource, createPoller, mount };
})();
