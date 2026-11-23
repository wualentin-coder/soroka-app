/* Sport 2.0: the browser owns the outbox and renders the shared session engine. */
(() => {
  "use strict";

  const C = () => window.SportCore;
  const H = () => window.SportHistory;
  const id = () => crypto.randomUUID();
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const keyOf = target => target ? JSON.stringify([target.plan_exercise_id, target.set_index]) : "";
  const error = (code, reply) => Object.assign(new Error(code), { reply });
  const terminal = phase => phase === "abandoned" || phase === "completed";
  const emptyStore = () => ({ active: null, records: {}, plans: {} });
  const networkError = reason => reason.reply?.retryable || reason.message === "sport2_unavailable"
    || (reason.status ? reason.status >= 500 : !reason.reply);
  const format = seconds => {
    const value = Math.max(0, seconds);
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
  };
  const sameTime = (a, b) => Date.parse(a) === Date.parse(b);
  const request = async (op, args = {}) => {
    const reply = await window.sorokaSport(op, args);
    if (reply?.ok !== true) throw error(reply?.error || "network", reply);
    return reply;
  };

  function manualPlan(option, sessionId) {
    const plan = option.plan;
    const blocks = [
      ["warmup", option.warmup],
      ["main", plan],
      ["mobility", option.mobility],
    ].filter(([, day]) => day?.exercises?.length).map(([type, day]) => ({
      type, title: day.title || "", order_policy: "fixed",
      exercises: day.exercises.map((exercise, index) => {
        const hold = C().holdSecondsFor(exercise);
        const reps = exercise.sets_reps.replace(/^\s*\d+\s*[×x]\s*/i, "").trim();
        return {
          plan_exercise_id: `${type}:${index + 1}`, exercise_id: null, name: exercise.name, sets: C().exerciseSets(exercise),
          mode: exercise.mode ?? (hold > 0 ? "timed" : "reps"), priority: null,
          load: exercise.weight_basis && exercise.weight_kg != null ? { kg: exercise.weight_kg, basis: exercise.weight_basis, units: null } : null,
          reps, work_seconds: hold, execution_seconds: exercise.executionSeconds,
          rest_seconds: C().restSecondsFor(exercise, day.routine_type),
          technique: exercise.technique, bodyweight: C().isBodyweight(exercise), muscles: exercise.muscles,
        };
      }),
    }));
    return C().validateSportRunSnapshot({
      schema_version: 3, snapshot_reconstructed: false,
      workout: { title: plan.title, focus: plan.focus ?? "", kind: option.kind, date: option.date, blocks },
    }, sessionId);
  }

  function storeFor(owner) {
    const key = `flow.sport.events.v2:${owner.scope}`;
    const read = () => {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : emptyStore();
      } catch {
        throw error("local_storage");
      }
    };
    const write = data => {
      try { localStorage.setItem(key, JSON.stringify(data)); }
      catch { throw error("local_storage"); }
    };
    const change = fn => navigator.locks
      ? navigator.locks.request(key, () => {
        if (!owner.current()) throw error("sport_owner_changed");
        const data = read();
        const result = fn(data);
        if (result !== false) write(data);
        return result;
      })
      : Promise.reject(error("local_lock"));
    return { key, read, change };
  }

  function view(record, now = Date.now()) {
    return C().readSportRun(record.snapshot, [...record.events, ...(record.undo?.events ?? [])], now, record.base);
  }

  function mergeReply(record, reply, batch = []) {
    const { session, projection } = reply;
    if (session.id !== record.id || session.stream_version < record.version) return;
    const server = {
      status: session.status, active_seconds: session.active_seconds, paused_seconds: session.paused_seconds,
      elapsed_seconds: session.elapsed_seconds, ...projection,
    };
    const receipts = [...(reply.accepted_ids ?? []), ...(reply.duplicate_ids ?? [])];
    let initial = null;
    if (record.start && !record.base && record.start.event.id === reply.receipt?.event_id) {
      if (session.stream_version === 1) initial = view({ ...record, events: [record.start.event], undo: null }).replay;
      record.events = C().sportRunOutbox(record.events, [record.start.event.id]);
      record.start = null;
    }
    const exact = record.base && batch.length && receipts.length === batch.length
      && session.stream_version === record.version + 1
      ? C().readSportRun(record.snapshot, batch, Date.now(), record.base).replay : null;
    const candidate = initial || exact || (session.stream_version === record.version ? record.base : null);
    const matches = candidate && candidate.projection.phase === server.phase
      && sameTime(candidate.projection.phase_started_at, server.phase_started_at)
      && keyOf(candidate.projection.open_set) === keyOf(server.open_set);
    record.base = matches ? { ...candidate, projection: server }
      : C().resumeSportRun(server, session.started_at, session.active_seconds ?? 0, session.paused_seconds ?? 0);
    record.version = session.stream_version;
    record.snapshot = session.plan_snapshot;
    record.events = C().sportRunOutbox(record.events, receipts);
    record.deferred = [...(record.deferred ?? []), ...batch.filter(event => event.type === "set_confirmed" && server.pending_event_ids.includes(event.id))]
      .filter(event => server.pending_event_ids.includes(event.id));
    record.lastAt = server.sets.reduce((last, row) => Math.max(last, Date.parse(row.recorded_at) || 0, Date.parse(row.work_ended_at) || 0),
      Math.max(record.lastAt ?? 0, Date.parse(server.phase_started_at)));
  }

  function adopt(data, reply) {
    const { session } = reply;
    const record = data.records[session.id] ??= {
      id: session.id, sourceKey: session.plan_snapshot.workout.workout_key, snapshot: session.plan_snapshot,
      version: 0, events: [], drafts: {}, lastAt: 0,
    };
    mergeReply(record, reply);
    return record;
  }

  function closeRun(data, record) {
    if (data.active === record.id) data.active = null;
    record.events = [];
    record.start = record.undo = record.complete = record.abandon = record.syncError = record.notice = null;
    record.drafts = {};
    record.deferred = [];
    if (data.editorDrafts) delete data.editorDrafts[`active:${record.id}`];
  }

  const glyphs = {
    close: '<path d="M6 6l12 12M18 6L6 18"/>', more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
    pause: '<path d="M9 6v12M15 6v12"/>', play: '<path d="M8 5.5v13l10-6.5z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  };
  const glyph = name => `<svg class="sr-icon" viewBox="0 0 24 24" aria-hidden="true">${glyphs[name]}</svg>`;
  const control = (action, label, cls = "ghost-button", extra = "") =>
    `<button type="button" class="${cls}" data-sr="${action}" ${extra}>${label}</button>`;
  const iconButton = (action, name, label, cls = "", extra = "") =>
    control(action, glyph(name), `sr-icon-button ${cls}`, `aria-label="${label}" ${extra}`);
  const techniques = exercise => String(exercise.technique ?? "").split(/\n+|(?<=[.!?])\s+/u).map(line => line.trim()).filter(Boolean);
  const technique = (exercise, preview = false) => {
    const lines = techniques(exercise);
    if (!lines.length) return '<p class="sr-muted">Техника для этого упражнения не добавлена.</p>';
    return preview ? `<p>${esc(lines[0])}</p>` : `<ol>${lines.map(line => `<li>${esc(line)}</li>`).join("")}</ol>`;
  };
  const muscleFigure = exercise => {
    const figures = window.SportFigures;
    if (!figures || typeof spFigureSvg !== "function") return "";
    const primary = spShapes(C().knownMuscles(exercise.muscles?.primary));
    const secondary = spShapes(C().knownMuscles(exercise.muscles?.secondary));
    return spFigureSvg(primary, secondary, figures.FIGURE_VIEWBOX, false);
  };
  const kg = value => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(value);
  const target = exercise => {
    if (exercise.mode === "timed" && exercise.work_seconds != null) return format(exercise.work_seconds);
    const reps = exercise.reps || exercise.target;
    const load = exercise.load;
    return [load ? `${load.units ? load.units + " × " : ""}${kg(load.kg)} кг` : "", reps ? `${reps}${!load && exercise.reps ? " раз" : ""}` : ""].filter(Boolean).join(" · ");
  };
  const phaseSignature = model => `${model.projection.phase}|${keyOf(model.current)}|${Date.parse(model.projection.phase_started_at)}`;
  const fieldLimits = () => C().runMetricLimits;
  const suggestions = model => C().sportRunSuggestions(model);
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const weightLabels = { per_dumbbell: "Вес", total: "Общий", machine: "Тренажёр", additional: "Доп. вес" };
  const inventoryKey = scope => `flow.sport.inventory.v1:${scope}`;
  const readInventory = scope => {
    try {
      const data = JSON.parse(localStorage.getItem(inventoryKey(scope)) || "null");
      return data && typeof data === "object" && !Array.isArray(data) ? data : null;
    } catch { return null; }
  };
  const lowerFirst = text => text ? text[0].toLocaleLowerCase("ru") + text.slice(1) : text;

  function metricField(name, label, placeholder, value, units = "") {
    const [min, max] = fieldLimits()[name];
    return `<div class="sr-field"><span id="sr-label-${name}">${label}</span><div class="sr-stepper">
      ${control("step", "−", "", `aria-label="Уменьшить: ${label}" data-field="${name}" data-delta="-1"`)}
      <div class="sr-value"><input id="sr-${name}" data-field="${name}" aria-labelledby="sr-label-${name}"
        type="number" inputmode="${name === "weight" ? "decimal" : "numeric"}" min="${min}" max="${max}"
        step="${name === "weight" ? "any" : 1}" placeholder="${esc(placeholder ?? "—")}" value="${esc(value)}">
        ${name === "weight" ? '<small aria-hidden="true">кг</small>' : ""}</div>
      ${control("step", "+", "", `aria-label="Увеличить: ${label}" data-field="${name}" data-delta="1"`)}${units}</div></div>`;
  }

  function resultCard(model, draft) {
    const { prior, current } = model;
    const idea = suggestions(model);
    const units = draft.units ?? idea.units;
    const count = idea.basis === "per_dumbbell" ? control("units", units ? `×${units}` : "×—", "sr-count",
      `aria-label="Гантелей: ${units ?? "не указано"}" aria-pressed="${draft.units != null}"`) : "";
    const rir = current.exercise.mode === "timed" ? "" : `<div class="sr-field">
      <span id="sr-rir-label">Запас</span><div class="sr-rir" role="group" aria-labelledby="sr-rir-label">
      ${[0, 1, 2, 3].map(value => control("rir", value === 3 ? "3+" : value, "", `data-value="${value}" aria-pressed="${draft.rir === value}"`)).join("")}</div></div>`;
    return `<section class="sr-card sr-input" aria-label="Результат подхода ${prior.set_index}">
      <div class="sr-input-head"><strong>Подход ${prior.set_index}</strong><div class="sr-result-state">
        <span class="sr-status" data-confirmed="false"><i></i><span class="sr-vh">не подтверждён</span></span>
        ${control("draft-reset", "↺", "sr-reset", 'aria-label="Вернуть как в плане" hidden')}</div></div>
      ${current.exercise.bodyweight !== true && current.exercise.mode !== "timed"
        ? metricField("weight", weightLabels[idea.basis] || "Вес, кг", idea.weight, draft.weight, count) : ""}
      ${current.exercise.mode === "timed" ? metricField("seconds", "Время, с", idea.seconds, draft.seconds)
        : metricField("reps", "Повторы", idea.reps, draft.reps)}${rir}</section>`;
  }

  const messages = {
    local_storage: "Не удалось сохранить данные на устройстве. Освободите место и повторите.",
    local_lock: "Этот браузер не поддерживает безопасную запись тренировки.",
    plan_not_found: "Тренировка отсутствует в новом плане.",
    plan_version_stale: "Версия плана изменилась. Журнал этой тренировки остался на устройстве.",
    no_offline_plan: "Для первого запуска этого плана нужна сеть.",
    invalid_measurement: "Проверьте значения в полях подхода.",
    measurement_required: "Введите вес, повторы или время подхода.",
    weight_required: "Укажите вес на гантель.",
    pending_events: "Есть конфликт результатов. Проверьте данные подхода.",
    stale_session: "Тренировка обновилась в другом окне. Проверьте результат и повторите.",
    sport2_disabled: "Спорт 2.0 недоступен для текущего аккаунта.",
    session_closed: "Тренировка уже закрыта на другом устройстве.",
  };
  const errorText = reason => messages[reason.message] ?? "Сервер не ответил. Можно повторить.";
  const invalidDraft = reason => ["invalid_measurement", "measurement_required"].includes(reason.message);
  let runner = null;
  let figureLoad;
  let sensory;
  let library;

  function loadFigures() {
    if (window.SportFigures) return Promise.resolve();
    return figureLoad ??= new Promise(resolve => {
      const script = document.createElement("script");
      script.src = "./assets/sport-figures.js";
      script.onload = resolve;
      script.onerror = () => { figureLoad = null; resolve(); };
      document.head.append(script);
    });
  }

  function libraryId(exercise, scope) {
    // The private helper is installed by the same-device server. Public builds
    // cannot resolve this catalogue, even when an exercise has a video URL.
    if (!window.flowSportLibrary || !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return Promise.resolve(null);
    const normalize = name => name.normalize("NFKC").toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    library ??= fetch("./sport-library/catalog.json", { cache: "no-cache" }).then(async reply => {
      if (!reply.ok) return [];
      const data = await reply.json();
      return data.schema === 1 && Array.isArray(data.exercises)
        ? data.exercises.filter(row => /^[a-zA-Z0-9_-]{1,40}$/.test(row.id) && typeof row.name === "string") : [];
    }).catch(() => { library = null; return []; });
    return library.then(rows => {
      const name = normalize(exercise.name);
      let mapped;
      try { mapped = JSON.parse(localStorage.getItem(`flow.sport.library.v1:${scope}`) || "{}")[name]; } catch {}
      const exact = rows.filter(row => normalize(row.name) === name);
      return rows.find(row => row.id === mapped)?.id ?? (exact.length === 1 ? exact[0].id : null);
    });
  }

  class Runner {
    constructor(owner) {
      this.owner = owner;
      this.storage = storeFor(owner);
      this.deviceId = id();
      this.seq = 0;
      this.option = null;
      this.modal = null;
      this.panel = null;
      this.inventory = readInventory(owner.scope);
      this.inventoryRequest = null;
      this.inventoryFetched = false;
      this.loadoutKey = "";
      this.loadoutText = "";
      this.conflict = null;
      this.interruption = null;
      this.message = "";
      this.retryTimer = null;
      this.interval = null;
      this.syncing = false;
      this.busy = false;
      this.listeners = new AbortController();
      const { signal } = this.listeners;
      window.addEventListener("storage", event => {
        if (event.key !== this.storage.key) return;
        this.clockFailure = null;
        this.refresh();
        if (!this.modal?.open) refreshSportSurface();
        this.syncSoon();
      }, { signal });
      window.addEventListener("online", () => { this.syncSoon(); this.refresh(); }, { signal });
      window.addEventListener("offline", () => this.refresh(), { signal });
      window.addEventListener("pageshow", () => this.syncSoon(), { signal });
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) { this.tick(); this.syncSoon(); }
        else this.modal?.querySelector("video")?.pause();
      }, { signal });
    }

    dispose() {
      this.close();
      this.listeners.abort();
      clearTimeout(this.retryTimer);
      clearInterval(this.interval);
      clearTimeout(this.noticeTimer);
    }

    read() {
      const data = this.storage.read();
      return data.records[data.active] ?? null;
    }

    async open(option, trigger, restoring = false) {
      if (this.modal?.open) return;
      this.option = option;
      this.trigger = trigger;
      this.message = "";
      this.mount();
      this.loadInventory();
      let record;
      try {
        record = this.read();
        if (option && (!record || terminal(view(record).projection.phase) && !record.events.length && !record.abandon)) {
          record = await this.storage.change(data => {
            const draft = Object.values(data.records).find(item => item.sourceKey === option.key && !terminal(view(item).projection.phase));
            if (!draft) return false;
            data.active = draft.id;
            return draft;
          }) || record;
        }
      }
      catch (reason) { this.fail(reason); return; }
      if (record && view(record).projection.phase === "completed" && record.events.length) {
        this.message = "Часть событий осталась на устройстве.";
      }
      if (record && (!terminal(view(record).projection.phase) || record.start || record.events.length || record.abandon)) {
        if (option && record.sourceKey !== option.key && !record.abandon && !terminal(view(record).projection.phase)) {
          this.conflict = { id: record.id, local: true };
        } else if (this.mountedId !== record.id) {
          if (navigator.onLine && !record.start && !record.abandon && !record.complete) {
            await this.reconcile(record);
          }
          await this.catchUp();
          this.recover(this.read());
        }
        this.render(true);
        this.syncSoon();
        return;
      }
      if (restoring) { this.close(); return; }
      this.busy = true;
      this.render(true);
      try {
        const remote = navigator.onLine ? await request("read_session", { open: true }).catch(reason => {
          if (reason.message === "session_not_found" || networkError(reason)) return null;
          throw reason;
        }) : null;
        if (!this.modal?.open || !this.owner.current()) return;
        if (remote?.session) {
          this.conflict = { id: remote.session.id, reply: remote };
        } else if (option) {
          await this.start(option);
        }
      } catch (reason) { this.fail(reason); }
      finally { this.busy = false; this.refresh(true); }
    }

    async resolvePlan(option, recordId) {
      if (!option.key.startsWith("v2|")) return { manual_workout: manualPlan(option, recordId) };
      const cached = () => this.storage.read().plans[option.key];
      if (!navigator.onLine) {
        const plan = cached();
        if (!plan) throw error("no_offline_plan");
        return plan;
      }
      try {
        const list = await request("read_session_plans");
        const details = await Promise.all(list.plans.map(plan => request("read_session_plans", { plan_id: plan.id })));
        const matches = details.flatMap(({ plan }) => plan.content.workouts.filter(workout => workout.workout_key === option.key).map(workout => ({
          plan_id: plan.id, plan_version: plan.current_version, workout_key: workout.workout_key,
          snapshot: { schema_version: 3, snapshot_reconstructed: false, workout },
        })));
        if (matches.length !== 1) throw error("plan_not_found", { error: "plan_not_found" });
        await this.storage.change(data => { data.plans[option.key] = matches[0]; });
        return matches[0];
      } catch (reason) {
        if (!networkError(reason)) throw reason;
        const plan = cached();
        if (!plan) throw error("no_offline_plan");
        return plan;
      }
    }

    async start(option) {
      const sessionId = id();
      const { snapshot, ...args } = await this.resolvePlan(option, sessionId);
      if (!this.modal?.open) return;
      const made = await this.storage.change(data => {
        const active = data.records[data.active];
        if (active && (!terminal(view(active).projection.phase) || active.start || active.events.length || active.abandon)) return false;
        const record = {
          id: sessionId, sourceKey: option.key, snapshot: snapshot ?? args.manual_workout,
          version: 0, events: [], drafts: {}, lastAt: 0, startSent: false,
        };
        const [start] = this.append(record, [{ type: "session_started" }], Date.now());
        record.start = { ...args, session_id: sessionId, event: start };
        data.active = sessionId;
        data.records[sessionId] = record;
        for (const [key, old] of Object.entries(data.records)) {
          if (key !== sessionId && !old.start && !old.events.length && !old.complete && terminal(view(old).projection.phase)) delete data.records[key];
        }
        return true;
      });
      if (!made) {
        const existing = this.read();
        if (existing?.sourceKey !== option.key) this.conflict = { id: existing.id, local: true };
      }
      this.mountedId = this.read()?.id;
      refreshSportSurface();
      this.syncSoon();
    }

    recover(record) {
      if (!record || record.abandon || terminal(view(record).projection.phase)) return;
      this.mountedId = record.id;
      const model = view(record);
      if (C().sportRunInterruption(model)) this.interruption = { key: phaseSignature(model), elapsed: model.elapsedMs, approximate: model.approximate };
      if (model.replay.open || model.replay.rest) {
        this.issue({ type: "interrupt" }, { signature: phaseSignature(model), silent: true }).catch(reason => this.fail(reason));
      }
    }

    mount() {
      const box = document.createElement("dialog");
      box.className = "sport-run";
      box.tabIndex = -1;
      box.setAttribute("aria-label", "Тренировка");
      box.addEventListener("cancel", event => { event.preventDefault(); if (this.panel) this.togglePanel(null); else this.close(); });
      box.addEventListener("click", event => this.click(event));
      box.addEventListener("input", event => {
        const input = event.target;
        if (input instanceof HTMLInputElement && input.dataset.field) this.field(input.dataset.field, input.value);
      });
      box.addEventListener("pointerdown", event => {
        this.byPointer = true;
        if (event.target.matches("input[data-field]") && event.isPrimary && event.button === 0 && this.model?.prior) {
          const name = event.target.dataset.field;
          this.field(name, suggestions(this.model)[name] ?? null, { onlyIfUntouched: true });
        }
        if (event.target.closest('[data-sr="done"]')) sensory?.sensoryGesture(box, event.target.closest("button"), event);
        if (!event.isPrimary || event.button !== 0 || event.target.closest("input,button:not(.sr-media-tap,.sr-clock)")) return;
        if (event.target.closest("[data-sr-swipe]")) this.swipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
      });
      box.addEventListener("keydown", event => {
        this.byPointer = false;
        if (event.target.closest('[data-sr="done"]')) sensory?.sensoryGesture(box, event.target, event);
      });
      box.addEventListener("pointercancel", () => { this.swipe = null; });
      box.addEventListener("pointerup", event => {
        const swipe = this.swipe;
        this.swipe = null;
        if (!swipe || event.pointerId !== swipe.id) return;
        const dx = swipe.x - event.clientX, dy = Math.abs(swipe.y - event.clientY);
        if (dx >= 52 && dx > 1.35 * dy) {
          this.swipedAt = performance.now();
          this.act("skip");
        }
      });
      document.body.append(box);
      this.modal = box;
      box.showModal();
      box.focus({ preventScroll: true });
      import("./flow-ui/sensory-feedback.js").then(module => { sensory = module; }).catch(() => {});
      this.interval ??= setInterval(() => this.tick(), 100);
      loadFigures().then(() => this.fillFigures());
    }

    close() {
      this.modal?.close();
      this.modal?.remove();
      this.modal = null;
      this.panel = null;
      this.confirmId = null;
      this.recordId = null;
      this.conflict = null;
      this.interruption = null;
      if (this.trigger?.isConnected) this.trigger.focus({ preventScroll: true });
      refreshSportSurface();
    }

    fail(reason) {
      if (!this.owner.current()) { this.dispose(); return; }
      this.message = errorText(reason);
      this.refresh(true);
    }

    refresh(force = false) {
      if (!this.modal?.open) return;
      if (!this.owner.current()) { this.dispose(); return; }
      this.render(force);
    }

    togglePanel(panel) {
      this.panel = this.panel === panel ? null : panel;
      if (this.panel !== "confirm-abandon") this.confirmId = null;
      this.render(true);
      if (this.panel === "confirm-abandon") this.modal?.querySelector('[data-sr="keep-training"]')?.focus({ preventScroll: true });
      else if (this.panel && !this.byPointer) this.modal?.querySelector(".sr-panel button")?.focus();
    }

    append(record, steps, now, staged = false) {
      const timestamp = record.lastDevice === this.deviceId ? Math.max(Math.floor(now), record.lastAt)
        : Math.max(Math.floor(now), record.lastAt + 1);
      const events = C().stampSportRunEvents(steps, this.deviceId, this.seq + 1, timestamp, id)
        .map(event => C().validateSportRunEvent(event, [event.type]));
      this.seq += events.length;
      if (events.length && !staged) {
        record.lastAt = timestamp;
        record.lastDevice = this.deviceId;
      }
      if (!staged) record.events.push(...events);
      return events;
    }

    commitUndo(record) {
      if (!record.undo) return;
      record.events.push(...record.undo.events);
      if (record.undo.draftKey) delete record.drafts[record.undo.draftKey];
      const last = record.undo.events.at(-1);
      if (last) {
        record.lastAt = Date.parse(last.occurred_at);
        record.lastDevice = last.device_id;
      }
      record.undo = null;
    }

    advanceClock(record, now) {
      let changed = false, notice;
      for (let transition = 0; transition < 64; transition++) {
        const model = view(record, now);
        if (model.paused || model.deadline == null || model.deadline > now || record.undo || record.complete || record.abandon) break;
        const key = model.phase === "rest" && keyOf(model.prior);
        const result = key ? C().sportRunDraftResult(model, record.drafts[key] ?? {}) : null;
        const steps = C().sportRunEvents(model, { type: "tick", result });
        if (!steps.length) break;
        this.append(record, steps, model.deadline);
        if (key) {
          delete record.drafts[key];
          if (!result && model.prior.status !== "confirmed") notice = `Подход ${model.prior.set_index} не подтверждён · Дополнить`;
        }
        changed = true;
      }
      if (notice) record.notice = { text: notice, until: now + 5000 };
      return changed;
    }

    async catchUp() {
      const now = Date.now();
      const result = await this.storage.change(data => {
        const record = data.records[data.active];
        if (!record || record.abandon || this.confirmId === record.id) return false;
        const expiredUndo = record.undo && now >= record.undo.until;
        if (expiredUndo) this.commitUndo(record);
        return this.advanceClock(record, now) || !!expiredUndo;
      });
      if (result) {
        this.syncSoon();
        this.refresh();
      }
    }

    async abandon(recordId) {
      const changed = await this.storage.change(data => {
        const record = data.records[data.active];
        if (!record || record.id !== recordId || record.complete || record.abandon) return false;
        const steps = C().sportRunEvents(view(record), { type: "abandon" });
        if (!steps.length) return false;
        // The undo window is still provisional. Only the durable outbox precedes cancellation.
        record.undo = null;
        const [event] = this.append(record, steps, Date.now(), true);
        if (record.startSent === false && record.start && record.events.length === 1) {
          record.base = C().readSportRun(record.snapshot, [...record.events, event], Date.now()).replay;
          closeRun(data, record);
        } else {
          record.abandon = event;
          record.notice = null;
          record.drafts = {};
          if (data.editorDrafts) delete data.editorDrafts[`active:${record.id}`];
        }
        return true;
      });
      this.togglePanel(null);
      if (changed) {
        this.syncSoon();
        refreshSportSurface();
      }
    }

    async issue(command, options = {}) {
      const now = Date.now();
      const result = await this.storage.change(data => {
        const record = data.records[data.active];
        if (!record || record.complete || record.abandon || (options.recordId && record.id !== options.recordId)) return false;
        const model = view(record, now);
        if (options.signature && phaseSignature(model) !== options.signature) return false;
        if (command.type === "undo") {
          if (!record.undo || now >= record.undo.until) return false;
          record.undo = null;
          return true;
        }
        if (record.undo) return false;
        if (command.type === "seal" && model.phase !== "review") return false;
        const draftKey = model.phase === "rest" && model.prior && ["advance", "skip", "review"].includes(command.type) ? keyOf(model.prior) : null;
        if (draftKey) {
          command = { ...command, result: C().sportRunDraftResult(model, record.drafts[draftKey] ?? {}, command.type === "advance") };
        }
        const steps = C().sportRunEvents(model, command);
        if (!steps.length && command.type !== "seal") return false;
        if (command.type === "seal") {
          if (steps.length) this.append(record, steps, now);
          const [event] = this.append(record, [{ type: "session_completed" }], now, true);
          record.complete = { event };
        } else if (command.type === "skip" || command.type === "skip-set") {
          record.undo = { until: now + C().SKIP_UNDO_MS, events: this.append(record, steps, now, true), draftKey,
            label: model.phase === "rest"
              ? `Отдых пропущен · подход ${model.prior.set_index} ${command.result || model.prior.status === "confirmed" ? "записан" : "не подтверждён"}`
              : command.type === "skip-set" ? "Подход пропущен" : "Упражнение пропущено" };
        } else {
          this.append(record, steps, now);
          if (draftKey) delete record.drafts[draftKey];
          if (command.type === "recover" && command.choice === "record") this.append(record, [{ type: "paused" }], now);
        }
        return true;
      });
      if (result) this.syncSoon();
      if (!options.silent) this.refresh();
      if (result && !this.modal?.open) refreshSportSurface();
      return result;
    }

    async field(name, value, { onlyIfUntouched = false } = {}) {
      const model = this.model;
      if (!model?.prior || this.busy) return;
      try {
        await this.storage.change(data => {
          const record = data.records[data.active];
          if (!record || record.abandon || record.undo || record.id !== this.recordId || phaseSignature(view(record)) !== phaseSignature(model)) return false;
          const key = keyOf(model.prior);
          const draft = record.drafts[key] ??= {};
          if (onlyIfUntouched && owns(draft, name)) return false;
          if (name === null) delete record.drafts[key];
          else draft[name] = value === "" ? null : value;
          return true;
        });
        this.clockFailure = null;
        this.message = "";
        this.refresh();
      } catch (reason) { this.fail(reason); }
    }

    async chooseConflict(finish) {
      const conflict = this.conflict;
      if (!conflict) return;
      const remote = conflict.reply ?? (conflict.local ? null : await request("read_session", { session_id: conflict.id }));
      const record = await this.storage.change(data => {
        const chosen = remote ? adopt(data, remote) : data.records[conflict.id];
        if (!chosen) throw error("session_not_found");
        data.active = chosen.id;
        return chosen;
      });
      this.conflict = null;
      this.mountedId = record.id;
      if (finish) await this.issue({ type: "review" }, { recordId: record.id });
      else this.recover(record);
    }

    openEditor(trigger) {
      const record = this.read();
      if (!record || record.complete || record.abandon || record.undo) return;
      const model = view(record);
      if (model.phase !== "review") return;
      const snapshot = record.snapshot;
      const sets = model.projection.sets;
      const openSet = keyOf(model.projection.open_set);
      H().editor({
        snapshot, sets, trigger, openSet, owner: this.owner, localDraft: this.editorDraft(record.id, "active"),
        target: H().preview(snapshot, sets, null, { openSet, hasPending: model.projection.pending_event_ids.length > 0 }).first,
        reload: async () => {
          const latest = this.read();
          if (latest?.id !== record.id || view(latest).phase !== "review") throw error("invalid_transition");
          return { sets: view(latest).projection.sets };
        },
        save: async ({ changes, baseline }) => {
          await this.storage.change(data => {
            const latest = data.records[data.active];
            if (latest?.id !== record.id || latest.complete || latest.abandon || latest.undo) throw error("invalid_transition");
            const current = view(latest);
            if (current.phase !== "review") throw error("invalid_transition");
            const rows = new Map(current.projection.sets.map(row => [keyOf(row), row]));
            const steps = [];
            for (const change of changes) {
              const { plan_exercise_id, set_index, ...payload } = change;
              const key = { plan_exercise_id, set_index };
              const rowId = keyOf(key);
              const before = H().result(rows.get(rowId));
              if (keyOf(current.projection.open_set) === rowId || !H().equal(before, baseline.get(rowId) ?? H().result(null))) {
                throw error("stale_active_result");
              }
              if (payload.status === "confirmed") steps.push({ type: "set_confirmed", key, payload });
              else {
                if (before.status !== payload.status) {
                  steps.push({ type: payload.status === "skipped" ? "set_skipped" : "set_unconfirmed", key });
                }
                if (payload.note !== before.note) steps.push({ type: "note_added", key, payload: { note: payload.note ?? "" } });
              }
            }
            const events = this.append(latest, steps, Date.now());
            const projected = view(latest).projection;
            if (events.some(event => projected.pending_event_ids.includes(event.id))) throw error("invalid_transition");
            return events.length > 0;
          });
          this.syncSoon();
          this.refresh();
        },
      });
    }

    editorDraft(sessionId, mode) {
      const key = `${mode}:${sessionId}`;
      const saved = this.storage.read().editorDrafts?.[key];
      const token = id();
      return {
        saved: saved?.state,
        write: state => this.storage.change(data => {
          if (state && mode === "active") {
            const record = data.records[sessionId];
            if (data.active !== sessionId || !record || record.abandon || view(record).phase !== "review") return false;
          }
          const drafts = data.editorDrafts ??= {};
          const current = drafts[key];
          if (current && current.token !== token && current.token !== saved?.token) {
            if (!state) return false;
            throw error("editor_draft_changed");
          }
          if (state) drafts[key] = { token, state };
          else if (current) delete drafts[key];
          else return false;
          return true;
        }),
      };
    }

    getEdit(sessionId) {
      return this.storage.read().edits?.[sessionId] ?? null;
    }

    storeEdit(sessionId, draft, expected) {
      return this.storage.change(data => {
        data.edits ??= {};
        const pending = data.edits[sessionId]?.args?.event.id;
        if (pending && pending !== expected) throw error("edit_already_pending");
        if (draft) data.edits[sessionId] = draft;
        else delete data.edits[sessionId];
      });
    }

    saveEdit(sessionId, { changes, revision, pending, persist }) {
      if (!navigator.locks) throw error("local_lock");
      return navigator.locks.request(`${this.storage.key}:edit:${sessionId}`, async () => {
        if (!this.owner.current()) throw error("sport_owner_changed");
        const stored = this.getEdit(sessionId)?.args;
        if (stored && stored.event.id !== pending?.event.id) throw error("edit_already_pending");
        let args = pending;
        if (!args) {
          const at = Date.now();
          const [event] = this.append({ events: [], lastAt: 0 },
            [{ type: "result_edited", payload: { changes } }], at, true);
          args = { session_id: sessionId, expected_results_revision: revision, event };
          await persist(args);
        }
        try {
          const reply = await request("edit_set_results", args);
          if (!reply.receipt || reply.receipt.event_id !== args.event.id
              || reply.receipt.committed_revision !== args.expected_results_revision + 1) throw error("network");
          await this.storeEdit(sessionId, null, args.event.id);
          return reply;
        } catch (reason) {
          if (reason.message === "no_changes") {
            await this.storeEdit(sessionId, null, args.event.id);
            return null;
          }
          if (reason.message === "stale_results_revision") await persist(null, true);
          else if (!networkError(reason)) await persist(null);
          throw reason;
        }
      });
    }

    async restoreDeferred() {
      await this.storage.change(data => {
        const record = data.records[data.active];
        if (!record || record.abandon || view(record).phase !== "review" || !record.deferred?.length) return false;
        this.append(record, record.deferred.map(event => ({
          type: "set_confirmed", key: event, payload: event.payload,
        })), Date.now());
        return true;
      });
      this.syncSoon();
    }

    syncSoon(delay = 0) {
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.sync(), delay);
    }

    async sync() {
      if (!navigator.onLine || !navigator.locks || !this.owner.current()) return;
      if (this.syncing) { this.syncSoon(250); return; }
      this.syncing = true;
      try {
        await navigator.locks.request(`${this.storage.key}:sync`, async () => {
          await this.send();
        });
      } catch (reason) {
        if (networkError(reason) && !["local_storage", "sport_owner_changed"].includes(reason.message) && this.owner.current()) {
          this.retryDelay = Math.min((this.retryDelay || 750) * 2, 15000);
          this.syncSoon(this.retryDelay);
        } else if (this.modal) this.fail(reason);
      } finally { this.syncing = false; }
    }

    async reconcile(record) {
      const reply = await request("read_session", { session_id: record.id }).catch(() => null);
      if (!reply || reply.session.id !== record.id || reply.session.stream_version <= record.version) return;
      const closed = terminal(reply.session.status);
      const changed = await this.storage.change(data => {
        const latest = data.records[record.id];
        if (!latest || latest.version >= reply.session.stream_version) return false;
        mergeReply(latest, reply);
        if (closed) closeRun(data, latest);
        return true;
      });
      if (changed) {
        if (reply.session.status === "completed") H().invalidate();
        this.refresh();
        if (!this.modal?.open) refreshSportSurface();
      }
    }

    async send() {
      let staleRetries = 0;
      while (this.owner.current() && navigator.onLine) {
        const data = this.storage.read();
        const record = data.records[data.active];
        if (!record) return;
        try {
          if (record.undo && Date.now() >= record.undo.until) {
            await this.storage.change(next => {
              const latest = next.records[record.id];
              if (!latest?.undo || Date.now() < latest.undo.until) return false;
              this.commitUndo(latest);
              return true;
            });
            this.refresh();
            continue;
          }
          if (record.syncError) return;
          if (record.start) {
            if (record.startSent === false) {
              const marked = await this.storage.change(next => {
                const latest = next.records[record.id];
                if (latest?.start?.event.id !== record.start.event.id) return false;
                latest.startSent = true;
                return true;
              });
              if (!marked) continue;
            }
            const reply = await request("start_session", record.start);
            await this.storage.change(next => {
              const latest = next.records[record.id];
              mergeReply(latest, reply);
              if (terminal(reply.session.status)) closeRun(next, latest);
            });
          } else if (record.events.length || record.abandon) {
            const legacyTerminal = record.events.findIndex(event => event.type === "session_abandoned");
            const batch = !record.events.length ? [record.abandon] : legacyTerminal === 0
              ? record.events.slice(0, 1) : record.events.slice(0, legacyTerminal < 0 ? 100 : Math.min(100, legacyTerminal));
            const reply = await request("apply_session_events", { session_id: record.id, events: batch });
            const acknowledged = (reply.accepted_ids?.length ?? 0) + (reply.duplicate_ids?.length ?? 0);
            if (reply.session?.id !== record.id || !acknowledged) throw error("network");
            if (batch[0].type === "session_abandoned" &&
                (!terminal(reply.session.status) || ![...(reply.accepted_ids ?? []), ...(reply.duplicate_ids ?? [])].includes(batch[0].id))) {
              throw error("network");
            }
            await this.storage.change(next => {
              const latest = next.records[record.id];
              mergeReply(latest, reply, batch);
              if (terminal(reply.session.status)) closeRun(next, latest);
            });
          } else if (record.complete) {
            if (record.complete.expectedStream == null) {
              await this.storage.change(next => {
                const latest = next.records[record.id];
                if (latest.complete?.event.id !== record.complete.event.id || latest.complete.expectedStream != null) return false;
                latest.complete.expectedStream = latest.version;
                return true;
              });
              continue;
            }
            const reply = await request("complete_session", {
              session_id: record.id, expected_stream_version: record.complete.expectedStream,
              expected_results_revision: 0, event: record.complete.event,
            });
            if (reply.receipt?.committed_revision !== 1 || reply.session?.status !== "completed") throw error("network");
            await this.storage.change(next => {
              const latest = next.records[record.id];
              mergeReply(latest, reply);
              if (latest.complete?.event.id === record.complete.event.id) latest.complete = null;
            });
            H().invalidate();
            window.SportCoach?.invalidate(record.id);
          } else {
            if (record.undo) this.syncSoon(Math.max(0, record.undo.until - Date.now()));
            if (!terminal(view(record).projection.phase)) await this.reconcile(record);
            return;
          }
          staleRetries = 0;
          this.retryDelay = 0;
          this.refresh();
          if (!this.modal?.open) refreshSportSurface();
        } catch (reason) {
          if (record.abandon && record.start && ["open_session_exists", "plan_version_stale", "plan_not_found", "workout_not_found"].includes(reason.message)) {
            // These start rejections happen only after the RPC has excluded this start UUID.
            await this.storage.change(next => {
              const latest = next.records[record.id];
              if (!latest?.abandon || latest.start?.event.id !== record.start.event.id) return false;
              latest.base = C().readSportRun(latest.snapshot, [...latest.events, latest.abandon], Date.now()).replay;
              closeRun(next, latest);
              return true;
            });
            this.refresh();
            refreshSportSurface();
            continue;
          }
          if (reason.message === "plan_version_stale" && record.start && record.events.length === 1 &&
            record.events[0].id === record.start.event.id && !record.undo && !record.complete && staleRetries < 2) {
            const { snapshot, ...args } = await this.resolvePlan({ key: record.sourceKey }, record.id);
            if (snapshot && args.plan_version !== record.start.plan_version) {
              const updated = await this.storage.change(next => {
                const latest = next.records[record.id];
                if (!latest?.start || latest.start.event.id !== record.start.event.id ||
                  latest.events.length !== 1 || latest.undo || latest.complete || latest.abandon) return false;
                latest.start = { ...latest.start, ...args };
                latest.snapshot = snapshot;
                return true;
              });
              if (updated) {
                staleRetries++;
                this.refresh(true);
                continue;
              }
            }
          }
          if (reason.message === "open_session_exists") {
            const open = await request("read_session", { open: true }).catch(() => null);
            if (open?.session) {
              if (this.read()?.id === record.id) this.conflict = { id: open.session.id, reply: open };
              this.refresh(true);
              return;
            }
          }
          const status = reason.status ?? (reason.reply && !networkError(reason) ? 409 : null);
          if (status >= 400 && status < 500 || reason.message === "stale_session") {
            const reply = await request("read_session", { session_id: record.id }).catch(() => null);
            if (reply?.session?.id === record.id && terminal(reply.session.status)) {
              await this.storage.change(next => {
                const latest = next.records[record.id];
                if (!latest || latest.version > reply.session.stream_version) return false;
                mergeReply(latest, reply);
                closeRun(next, latest);
                return true;
              });
              if (reply.session.status === "completed") {
                this.message = "Тренировка сохранена на другом устройстве.";
                H().invalidate();
              }
              this.refresh();
              refreshSportSurface();
              continue;
            }
            const staleComplete = reason.message === "stale_session" && record.complete?.expectedStream != null && !record.events.length;
            const retry = !staleComplete && reason.message === "stale_session" && reply && staleRetries < 2;
            await this.storage.change(next => {
              const latest = next.records[record.id];
              if (!latest) return false;
              if (reply) mergeReply(latest, reply);
              if (staleComplete && reply && latest.complete?.event.id === record.complete.event.id) {
                // A definite CAS rejection permits a new completion after checking the updated review.
                latest.complete = null;
                this.message = reply.session.status === "completed" ? "Тренировка сохранена на другом устройстве." : messages.stale_session;
              }
              if (!retry && (latest.start || latest.events.length || latest.complete || latest.abandon)) {
                latest.syncError = { code: reason.message, status: status ?? 409 };
              }
              return true;
            });
            this.refresh();
            if (retry) { staleRetries++; continue; }
            return;
          }
          throw reason;
        }
      }
    }

    tick() {
      if (!this.owner.current()) { this.dispose(); return; }
      if (this.busy || this.conflict || this.interruption || this.flashing || this.confirmId) return;
      let record;
      try { record = this.read(); } catch { return; }
      if (!record || record.abandon || terminal(view(record).projection.phase)) {
        this.stopClock();
        return;
      }
      const model = view(record);
      this.paintClock(model);
      this.paintLoadout(model);
      const ready = record.undo ? Date.now() >= record.undo.until
        : !record.complete && !model.paused && model.deadline != null && model.deadline <= Date.now();
      if (ready && !this.ticking && this.clockFailure !== phaseSignature(model)) {
        this.ticking = true;
        this.catchUp().catch(reason => {
          if (invalidDraft(reason)) this.clockFailure = phaseSignature(model);
          this.fail(reason);
        }).finally(() => { this.ticking = false; });
      }
    }

    stopClock() {
      clearInterval(this.interval);
      this.interval = null;
      this.modal?.querySelector("video")?.pause();
    }

    watchNotice(notice) {
      if (this.noticeUntil === notice?.until) return;
      this.noticeUntil = notice?.until;
      clearTimeout(this.noticeTimer);
      if (notice && notice.until > Date.now()) {
        this.noticeTimer = setTimeout(() => this.refresh(), notice.until - Date.now());
      }
    }

    async retrySync() {
      await this.storage.change(data => {
        const record = data.records[data.active];
        if (!record?.syncError) return false;
        delete record.syncError;
        return true;
      });
      this.refresh();
      this.syncSoon();
    }

    paintClock(model) {
      const timer = this.modal?.querySelector(".sr-timer");
      if (!timer) return;
      const elapsed = Math.floor(model.elapsedMs / 1000);
      const remaining = Math.ceil(model.remainingMs / 1000);
      const overtime = Math.floor(Math.max(0, -model.remainingMs) / 1000);
      const clock = timer.querySelector(".sr-clock");
      const number = clock.querySelector("b");
      const label = clock.querySelector("small");
      const digits = model.overtime ? "+" + format(overtime) : format(model.limit || model.phase === "rest" ? remaining : elapsed);
      const caption = !model.paused && !model.overtime && model.phase === "work" && model.limit
        ? `ориентир ${format(model.limit / 1000)}` : !model.paused && model.phase === "rest" ? "отдых" : "";
      if (number.textContent !== digits) number.textContent = digits;
      if (label.textContent !== caption) label.textContent = caption;
      timer.dataset.overtime = String(model.overtime);
      const level = model.limit ? Math.max(0, Math.min(1, model.remainingMs / model.limit)) : 0;
      timer.style.setProperty("--sr-waterline", `${100 * (1 - level)}%`);
    }

    // Справочник с сервера нужен только для подсказки о пересборке. Кэш на
    // устройстве позволяет показать её и без сети; ошибка ответа ничего не
    // меняет в тренировке.
    loadInventory() {
      if (this.inventoryFetched || this.inventoryRequest || !navigator.onLine || !this.owner.current()) return;
      this.inventoryRequest = request("analysis_settings")
        .then(reply => {
          if (!this.owner.current()) return;
          const inventory = reply?.settings?.inventory;
          if (!inventory || typeof inventory !== "object" || Array.isArray(inventory)) return;
          this.inventoryFetched = true;
          if (JSON.stringify(inventory) === JSON.stringify(this.inventory)) return;
          this.inventory = inventory;
          this.loadoutKey = "";
          try { localStorage.setItem(inventoryKey(this.owner.scope), JSON.stringify(inventory)); } catch {}
          this.refresh();
        })
        .catch(() => {})
        .finally(() => { this.inventoryRequest = null; });
    }

    loadoutLine(model) {
      if (!model || model.phase !== "rest" || !model.next || !model.prior || !this.inventory) return "";
      if (model.next.plan_exercise_id === model.prior.plan_exercise_id) return "";
      const load = model.next.exercise.load;
      if (!load || load.basis !== "per_dumbbell" || !(load.kg > 0) || (load.units !== 1 && load.units !== 2)) return "";
      const prior = model.prior;
      const basis = prior.actual_weight_basis ?? prior.planned?.basis ?? null;
      const kilograms = Number(prior.actual_kg ?? prior.planned?.kg);
      if (basis !== "per_dumbbell" || !(kilograms > 0)) return "";
      const units = prior.actual_units ?? prior.planned?.units ?? null;
      const key = `${JSON.stringify(this.inventory)}|${units}:${kilograms}|${load.units}:${load.kg}`;
      if (this.loadoutKey === key) return this.loadoutText;
      const hint = typeof C()?.sportLoadoutHint === "function"
        ? C().sportLoadoutHint(this.inventory, units === 1 || units === 2 ? { units, kg: kilograms } : null,
          { units: load.units, kg: load.kg }) : null;
      this.loadoutKey = key;
      this.loadoutText = hint && (hint.status === "change" || hint.status === "unreachable")
        ? `Следующее упражнение: ${lowerFirst(hint.text)}` : "";
      return this.loadoutText;
    }

    paintLoadout(model) {
      const node = this.modal?.querySelector("[data-sr-loadout]");
      if (!node) return;
      const text = this.loadoutLine(model);
      if (node.textContent !== text) node.textContent = text;
      node.hidden = !text;
      node.style.display = text ? "" : "none";
    }

    timer(model) {
      const rest = model.phase === "rest";
      const delta = rest && this.restDelta?.phase === phaseSignature(model) && this.restDelta.until > Date.now()
        ? this.restDelta : null;
      return `<div class="sr-timer" data-paused="${model.paused}" ${rest ? "data-sr-swipe" : ""}>
        <div class="sr-column" aria-hidden="true"><i></i></div>
        <span class="sr-pause-tag" ${model.paused ? "" : "hidden"}>${glyph("play")}Пауза</span>
        ${delta?.seconds ? `<span class="sr-delta" role="status">${delta.seconds > 0 ? "+" : "−"}${Math.abs(delta.seconds)} с</span>` : ""}
        <div class="sr-timer-row ${rest ? "" : "sr-solo"}">
          ${rest ? control("adjust", "−15", "sr-adjust", 'aria-label="Минус 15 секунд" data-value="-15"') : ""}
          ${control("pause", "<b>0:00</b><small></small>", "sr-clock", `aria-label="${model.paused ? "Продолжить" : "Пауза"}" aria-pressed="${model.paused}"`)}
          ${rest ? control("adjust", "+15", "sr-adjust", 'aria-label="Плюс 15 секунд" data-value="15"') : ""}
        </div>${rest ? this.swipeHint("Пропустить отдых") : ""}</div>`;
    }

    swipeHint(label) {
      return `<span class="sr-swipe-hint" aria-hidden="true">‹${this.hintVisible ? ` <span>${label}</span>` : ""}</span>`;
    }

    showSwipeHint() {
      if (this.hintSeen) return;
      this.hintSeen = true;
      const key = "flow.sport.swipe-hint.v2";
      try {
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, "1");
      } catch {}
      this.hintVisible = true;
      setTimeout(() => { this.hintVisible = false; this.refresh(); }, 3600);
    }

    head(model) {
      const { current } = model;
      const title = current?.exercise.name ?? this.option?.plan.title ?? "Тренировка";
      const sets = current ? Array.from({ length: current.exercise.sets }, (_, index) => {
        const row = model.projection.sets.find(item => item.plan_exercise_id === current.plan_exercise_id && item.set_index === index + 1);
        const name = row ? row.status : model.phase === "work" && current.set_index === index + 1 ? "current" : "";
        return `<i class="${name}"></i>`;
      }).join("") : "";
      return `<header class="sr-head">${iconButton("close-menu", "close", "Завершить или свернуть", "sr-bare")}
        <div class="sr-title"><span>${model.phase === "rest" ? `<small>Отдых · </small>` : ""}${esc(title)}</span>
          ${sets ? `<span class="sr-segments" aria-hidden="true">${sets}</span>` : ""}</div>
        ${iconButton("menu", "more", "Действия тренировки", "sr-bare", `aria-expanded="${this.panel === "menu"}"`)}</header>`;
    }

    pauseButton(model) {
      return iconButton("pause", model.paused ? "play" : "pause", model.paused ? "Продолжить" : "Пауза", "sr-big", `aria-pressed="${model.paused}"`);
    }

    work(model) {
      const { current } = model, e = current.exercise;
      const load = e.load;
      const primary = e.mode === "timed" ? format(e.work_seconds ?? 0)
        : load ? `${load.units ? load.units + " × " : ""}${kg(load.kg)}<small>кг</small>`
          : esc(e.reps || e.target || "");
      const goal = e.mode === "timed" ? `<b aria-label="На время">${glyph("clock")}</b>` : load && e.reps ? `<b>${esc(e.reps)}</b><small>повторов</small>`
        : e.bodyweight ? "<b>свой вес</b>" : "";
      return `${this.head(model)}<div class="sr-body">
        <div class="sr-media" data-sr-swipe><div class="sr-no-media">${technique(e, true)}<div data-sr-figure="current"></div></div>
          ${control("tech", "", "sr-media-tap", 'aria-label="Техника и мышцы"')}
          <span class="sr-flash" aria-hidden="true"><i>${glyph("check")}</i></span>${this.swipeHint("Пропустить упражнение")}</div>
        <div class="sr-target" data-sr-swipe><div><span aria-label="Подход ${current.set_index} из ${e.sets}">Подход ${current.set_index} / ${e.sets}</span><strong>${primary}</strong></div>
          <div class="sr-goal">${goal}</div></div>${this.timer(model)}</div>
        <footer class="sr-foot">${this.pauseButton(model)}${control("done", e.mode === "timed" ? "Закончить раньше" : "Подход выполнен", e.mode === "timed" ? "ghost-button" : "primary-button")}</footer>`;
    }

    rest(model, record) {
      const next = model.next, prior = model.prior;
      return `${this.head(model)}<div class="sr-body">${this.timer(model)}
        ${resultCard(model, record.drafts[keyOf(prior)] ?? {})}
        <section class="sr-card sr-next" data-sr-swipe>
        <div class="sr-thumb">${next ? '<div data-sr-figure="next"></div>' : glyph("check")}</div>
        <div><small>${next ? `Далее · подход ${next.set_index} / ${next.exercise.sets}` : "Последний подход"}</small>
        ${next ? `<strong>${esc([next.exercise.name !== model.current.exercise.name ? next.exercise.name : "", target(next.exercise)].filter(Boolean).join(" · "))}</strong>` : ""}
        ${next ? `<small class="sr-loadout" data-sr-loadout hidden style="display:none"></small>` : ""}</div></section></div>
        <footer class="sr-foot">${this.pauseButton(model)}${control("advance", next ? "Записать и начать подход" : "Записать и завершить", "primary-button")}</footer>`;
    }

    screen(model, record) {
      if (record.abandon) return this.simple("Отмена тренировки",
        '<p role="status">Отмена будет отправлена после синхронизации.</p>',
        control("dismiss", "Закрыть", "primary-button"));
      if (this.interruption) return this.simple("Тренировка прервалась",
        `<p>${esc(model.current.exercise.name)} · подход ${model.current.set_index} / ${model.current.exercise.sets}</p>` +
          (this.interruption.approximate ? "<p>Точное время этого подхода недоступно. Как его записать?</p>"
            : `<p>Подход шёл ${format(Math.floor(this.interruption.elapsed / 1000))}. Как его записать?</p>`),
        control("recover-record", this.interruption.approximate ? "Ввести результат" : "Записать как выполненный", "primary-button") +
          control("recover-unconfirmed", "Оставить неподтверждённым") + control("recover-continue", "Продолжить подход") +
          control("ask-abandon", "Отменить тренировку", "ghost-button danger-button"));
      if (model.phase === "preparing") return `${this.head(model)}<div class="sr-body sr-prep"><h2>Приготовьтесь</h2>${this.timer(model)}</div>
        <footer class="sr-foot">${this.pauseButton(model)}${control("start", "Начать", "primary-button")}</footer>`;
      if (model.phase === "work" && model.replay.open && model.current) return this.work(model);
      if (model.phase === "rest" && model.prior && model.current) return this.rest(model, record);
      if (model.phase === "review" || model.phase === "completed") {
        const completed = model.phase === "completed";
        const saved = completed && !record.events.length && !record.complete && !record.start;
        const seconds = completed ? model.projection.elapsed_seconds
          : Math.max(0, Math.floor((Date.now() - Date.parse(model.replay.startedAt)) / 1000));
        const active = completed ? null : {
          openSet: keyOf(model.projection.open_set), hasPending: model.projection.pending_event_ids.length > 0,
        };
        const info = H().preview(record.snapshot, model.projection.sets, seconds, active);
        const title = completed ? saved ? "Сохранено" : "Тренировка завершена" : "Итоги";
        const edit = completed
          ? saved ? control("open-history", info.first ? "Дополнить" : "Изменить", "ghost-button") : ""
          : !record.complete ? control("edit-review", info.first ? "Дополнить" : "Изменить", "ghost-button") : "";
        const menu = completed || record.complete ? "" : iconButton("menu", "more", "Действия тренировки", "sr-bare");
        return `<header class="sh-head sr-review-head"><h2>${title}</h2>${menu}</header><div class="sr-body sh-content">
          <h3>${saved ? esc(record.snapshot.workout.title) : "Проверьте перед сохранением"}</h3>${info.summary}${edit}
          ${saved ? window.SportCoach?.slot(record.id) || "" : ""}
          ${info.list}${record.deferred?.length ? control("restore-results", "Повторить запись результата") : ""}</div>
          <footer class="sr-foot sh-foot">${completed ? control("dismiss", "Закрыть", "primary-button")
            : (record.complete ? "" : control("return", "Вернуться")) +
              control("seal", record.complete ? record.syncError || !navigator.onLine ? "Ожидает отправки" : "Сохраняем…" : "Сохранить",
                "primary-button", record.complete ? "disabled" : "")}</footer>`;
      }
      if (model.phase === "abandoned") return this.simple("Тренировка отменена", "", control("dismiss", "Закрыть", "primary-button"));
      return this.simple("Тренировка", "", control("review", "Завершить") + control("dismiss", "Свернуть"));
    }

    simple(title, body, actions) {
      return `<main class="sr-simple"><h2>${title}</h2>${body}<div class="sr-actions">${actions}</div></main>`;
    }

    conflictDetails() {
      const { reply, id: recordId } = this.conflict;
      const record = this.storage.read().records[recordId];
      const snapshot = reply?.session.plan_snapshot ?? record?.snapshot;
      if (!snapshot) return "<p>Что сделать с начатой тренировкой?</p>";
      const local = record && view(record);
      const sets = reply?.projection.sets ?? local?.projection.sets ?? [];
      const started = reply?.session.started_at ?? local?.replay.startedAt;
      const total = snapshot.workout.blocks.flatMap(block => block.exercises).reduce((sum, exercise) => sum + exercise.sets, 0);
      const details = [snapshot.workout.title, started && "начата в " + new Date(started).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
        `записано ${sets.filter(row => row.status === "confirmed").length} из ${total}`].filter(Boolean);
      return `<p>${esc(details.join(" · "))}</p>`;
    }

    paintDraft(model, record) {
      const form = this.modal.querySelector(".sr-input");
      if (!form || !model?.prior) return;
      const draft = record.drafts[keyOf(model.prior)] ?? {};
      const idea = suggestions(model);
      const touched = Object.keys(draft).length > 0;
      let confirmed = model.prior.status === "confirmed";
      if (touched) {
        try { confirmed = !!C().sportRunDraftResult(model, draft); }
        catch { confirmed = false; }
      }
      for (const input of form.querySelectorAll("input[data-field]")) {
        const key = input.dataset.field;
        const value = owns(draft, key) ? draft[key] : null;
        input.placeholder = owns(draft, key) ? "—" : idea[key] ?? "—";
        if (input !== document.activeElement && input.value !== String(value ?? "")) input.value = value ?? "";
      }
      const units = form.querySelector('[data-sr="units"]');
      if (units) {
        const count = owns(draft, "units") ? draft.units : idea.units;
        units.textContent = count ? `×${count}` : "×—";
        units.setAttribute("aria-label", `Гантелей: ${count ?? "не указано"}`);
        units.setAttribute("aria-pressed", String(owns(draft, "units")));
      }
      for (const button of form.querySelectorAll('[data-sr="rir"]')) button.setAttribute("aria-pressed", String(draft.rir === Number(button.dataset.value)));
      const status = form.querySelector(".sr-status");
      status.dataset.confirmed = String(confirmed);
      const text = confirmed ? "подтверждён" : "не подтверждён";
      if (status.lastElementChild.textContent !== text) status.lastElementChild.textContent = text;
      form.querySelector('[data-sr="draft-reset"]').hidden = !touched;
    }

    panelMarkup(model) {
      if (!this.panel) return "";
      let title, items;
      if (this.panel === "close-menu") {
        title = "Тренировка идёт";
        const total = this.read().snapshot.workout.blocks.flatMap(block => block.exercises).reduce((sum, exercise) => sum + exercise.sets, 0);
        const confirmed = model.projection.sets.filter(row => row.status === "confirmed").length;
        items = `<p class="sr-muted">Записано ${confirmed} из ${total}</p>` + control("dismiss", "Свернуть")
          + (model.phase === "preparing" ? "" : control("review", "Завершить", "primary-button"))
          + control("ask-abandon", "Отменить тренировку", "ghost-button danger-button");
      } else if (this.panel === "confirm-abandon") {
        title = "Отменить тренировку?";
        items = '<p class="sr-muted">Тренировка не попадёт в историю.</p>'
          + control("keep-training", "Оставить тренировку")
          + control("confirm-abandon", "Отменить тренировку", "ghost-button danger-button");
      } else if (this.panel === "tech" && model.current) {
        title = "Техника и мышцы";
        items = `<div class="sr-panel-figure" data-sr-figure="current"></div>${technique(model.current.exercise)}`;
        const muscles = C().knownMuscles(model.current.exercise.muscles?.primary);
        if (muscles.length) items += `<p class="sr-muted">${muscles.map(value => esc(C().muscleLabel(value))).join(", ")}</p>`;
      } else {
        title = "Действия";
        items = model.current && model.phase !== "review" ? control("tech", "Техника и мышцы") : "";
        if (model.phase === "work" || model.phase === "rest") items += control("skip", model.phase === "rest" ? "Пропустить отдых" : "Пропустить упражнение");
        if (model.phase === "work" && model.replay.open) items += control("skip-set", "Пропустить подход");
        if (model.phase === "work" || model.phase === "rest") items += control("review", "Завершить");
        items += control("ask-abandon", "Отменить тренировку", "ghost-button danger-button");
      }
      return `<div class="sr-panel-backdrop"><section class="sr-panel" aria-label="${title}"><header><h2>${title}</h2>
        ${iconButton("panel-close", "close", "Закрыть", "sr-bare")}</header>${items}</section></div>`;
    }

    render(force = false) {
      if (!this.modal?.open || this.flashing) return;
      let record;
      try {
        const data = this.storage.read();
        const displayed = data.records[this.recordId];
        record = displayed && terminal(displayed.base?.projection.phase) ? displayed : data.records[data.active];
      } catch { record = null; }
      const model = record ? view(record) : null;
      const closing = record?.abandon || terminal(model?.projection.phase);
      if (closing) {
        if (this.panel) this.panel = null;
        this.confirmId = null;
        this.interruption = null;
        this.stopClock();
        if (this.runningId === record.id) navigator.vibrate?.(0);
      } else if (this.confirmId && this.confirmId !== record?.id) {
        this.panel = this.confirmId = null;
      }
      this.runningId = closing ? null : record?.id;
      if (this.runningId) this.interval ??= setInterval(() => this.tick(), 100);
      if (!closing && (model?.phase === "rest" || model?.phase === "work" && model.replay.open)) this.showSwipeHint();
      if (this.interruption && model && this.interruption.key !== phaseSignature(model)) this.interruption = null;
      const signature = JSON.stringify([record?.id, model && phaseSignature(model), model?.paused, model?.overtime && model.phase,
        model?.projection.sets.map(row => [keyOf(row), row.status, Date.parse(row.recorded_at)]), this.panel, this.conflict?.id, !!this.interruption,
        record?.abandon?.id, record?.complete?.event.id, record?.complete && navigator.onLine, record?.syncError?.code, record?.undo?.until,
        record?.deferred?.length, this.busy, this.hintVisible,
        this.restDelta?.until > Date.now() ? this.restDelta.until : null]);
      const screenKey = JSON.stringify([record?.id, record?.abandon ? "abandon-pending" : model?.phase, this.conflict?.id, !!this.interruption]);
      const rebuild = force || signature !== this.signature;
      this.model = model;
      this.recordId = record?.id;
      if (rebuild) {
        const oldFocus = this.modal.contains(document.activeElement) ? document.activeElement : null;
        const focusAction = oldFocus?.dataset.sr;
        const focusId = oldFocus?.id;
        const html = this.conflict ? this.simple("Есть незавершённая тренировка",
          this.conflictDetails(), control("conflict-continue", "Продолжить её", "primary-button") +
          control("conflict-finish", "Завершить её") + control("dismiss", "Не сейчас"))
          : model ? this.screen(model, record) : this.simple(this.busy ? "Открываем тренировку…" : "Тренировка",
            "", this.busy ? control("dismiss", "Закрыть") : control("retry", "Повторить", "primary-button") + control("dismiss", "Закрыть"));
        let screen = this.modal.querySelector(".sr-screen");
        if (!screen || this.screenKey !== screenKey) {
          const page = document.createElement("section");
          page.className = "sr-screen sr-enter";
          if (screen) screen.replaceWith(page);
          else this.modal.prepend(page);
          screen = page;
        }
        screen.dataset.phase = record?.abandon ? "abandon-pending" : model?.phase ?? "idle";
        screen.innerHTML = html;
        screen.inert = !!this.panel || (!!record?.undo && !this.conflict);
        this.modal.querySelector(".sr-notices")?.remove();
        this.modal.querySelector(".sr-panel-backdrop")?.remove();
        this.modal.insertAdjacentHTML("beforeend", `<aside class="sr-notices"><p data-sr-error role="alert" hidden></p>
          <p data-sr-sync role="status" hidden></p><p data-sr-notice role="status" hidden></p>
          <div data-sr-sync-error class="sr-undo" hidden><span role="alert"></span>${control("retry-sync", "Повторить", "sr-text")}</div>
          ${record?.undo && !this.conflict ? `<div class="sr-undo" role="status"><span>${esc(record.undo.label)}</span>${control("undo", "Отменить", "sr-text")}</div>` : ""}</aside>${model ? this.panelMarkup(model) : ""}`);
        this.screenKey = screenKey;
        this.signature = signature;
        this.fillFigures();
        if (model?.phase === "work" && this.modal.querySelector(".sr-media")) this.fillVideo(model.current.exercise);
        const focus = focusId ? this.modal.querySelector(`#${CSS.escape(focusId)}`) : focusAction
          ? this.modal.querySelector(`[data-sr="${CSS.escape(focusAction)}"]`) : null;
        if (screen.inert && record?.undo && !this.panel) this.modal.querySelector('[data-sr="undo"]')?.focus({ preventScroll: true });
        else if (!this.panel && !this.byPointer && focus?.getClientRects().length) focus.focus({ preventScroll: true });
        else if (!this.panel && (oldFocus || document.activeElement !== this.modal)) this.modal.focus({ preventScroll: true });
      }
      const pending = record ? record.events.length + Number(!!record.complete) + Number(!!record.abandon) : 0;
      const sync = this.modal.querySelector("[data-sr-sync]");
      const syncText = !navigator.onLine ? pending ? `Без сети · не отправлено: ${pending}` : "Без сети"
        : pending && !this.conflict ? `Не отправлено: ${pending}` : "";
      if (sync.textContent !== syncText) sync.textContent = syncText;
      sync.hidden = !syncText;
      const alert = this.modal.querySelector("[data-sr-error]");
      if (alert.textContent !== this.message) alert.textContent = this.message;
      alert.hidden = !this.message;
      const notice = this.modal.querySelector("[data-sr-notice]");
      this.watchNotice(record?.notice);
      const noticeText = record?.notice?.until > Date.now() ? record.notice.text : "";
      if (notice.textContent !== noticeText) notice.textContent = noticeText;
      notice.hidden = !noticeText;
      const blocked = this.modal.querySelector("[data-sr-sync-error]");
      blocked.hidden = !record?.syncError;
      if (record?.syncError) {
        const { code, status } = record.syncError;
        const label = `HTTP ${status} · ${messages[code] || "Не удалось отправить события."} Очередь сохранена.`;
        if (blocked.firstElementChild.textContent !== label) blocked.firstElementChild.textContent = label;
      }
      if (model && !this.conflict) this.paintDraft(model, record);
      if (model) this.paintClock(model);
      if (model && !this.conflict) this.paintLoadout(model);
    }

    fillFigures() {
      this.modal?.querySelectorAll("[data-sr-figure]").forEach(target => {
        const slot = this.model?.[target.dataset.srFigure];
        if (slot && window.SportFigures && !target.firstElementChild) target.innerHTML = muscleFigure(slot.exercise);
      });
    }

    async fillVideo(exercise) {
      const media = this.modal?.querySelector(".sr-media");
      if (!media || matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off") return;
      const clip = await libraryId(exercise, this.owner.scope);
      if (!clip || !media.isConnected || !this.owner.current()) return;
      const video = document.createElement("video");
      video.loop = video.muted = video.playsInline = true;
      video.setAttribute("aria-hidden", "true");
      video.addEventListener("playing", () => { media.querySelector(".sr-no-media").hidden = true; video.classList.add("sr-playing"); });
      video.addEventListener("error", () => { video.remove(); media.querySelector(".sr-no-media").hidden = false; });
      video.src = `./sport-library/clip/${clip}.mp4`;
      media.prepend(video);
      if (!document.hidden) video.play().catch(() => {});
    }

    click(event) {
      if (event.target.matches(".sr-panel-backdrop")) { this.togglePanel(null); return; }
      const button = event.target.closest("[data-sr]");
      if (!button || button.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      if (["tech", "pause"].includes(button.dataset.sr) && performance.now() - this.swipedAt < 350) return;
      this.act(button.dataset.sr, button.dataset);
    }

    async act(action, data = {}) {
      if (action === "dismiss") { this.close(); return; }
      if (this.busy || this.flashing) return;
      const model = this.model;
      this.message = "";
      try {
        if (action === "retry") { const { option, trigger } = this; this.close(); await this.open(option, trigger); return; }
        if (action === "retry-sync") { await this.retrySync(); return; }
        if (action === "conflict-continue" || action === "conflict-finish") {
          await this.chooseConflict(action === "conflict-finish");
          this.refresh(true);
          return;
        }
        if (!model) return;
        if (action === "keep-training") { this.togglePanel(null); return; }
        if (action === "confirm-abandon") {
          if (this.confirmId) await this.abandon(this.confirmId);
          return;
        }
        const record = this.read();
        if (!record || record.abandon) {
          if (action === "open-history") await H().open(this.recordId, this.modal.querySelector('[data-sr="open-history"]'));
          return;
        }
        if (action === "ask-abandon") {
          if (record.id !== this.recordId || record.complete || terminal(model.projection.phase)) return;
          this.confirmId = record.id;
          this.togglePanel("confirm-abandon");
          return;
        }
        if (record.undo && action !== "undo") return;
        if (["menu", "close-menu", "tech", "panel-close"].includes(action)) {
          this.togglePanel(action === "panel-close" ? null : action);
          return;
        }
        if (action === "restore-results") { await this.restoreDeferred(); this.refresh(true); return; }
        if (action === "edit-review") { this.openEditor(this.modal.querySelector('[data-sr="edit-review"]')); return; }
        if (action === "open-history") { await H().open(this.recordId, this.modal.querySelector('[data-sr="open-history"]')); return; }
        if (action === "draft-reset") { await this.field(null, null); return; }
        if (["step", "rir", "units"].includes(action)) {
          const record = this.read();
          const draft = record.drafts[keyOf(model.prior)] ?? {};
          const idea = suggestions(model);
          if (action === "rir") {
            const value = Number(data.value);
            await this.field("rir", draft.rir === value ? null : value);
          } else if (action === "units") {
            const current = draft.units ?? idea.units ?? 0;
            await this.field("units", current === 2 ? 1 : current + 1);
          } else {
            const [min, max, step] = fieldLimits()[data.field];
            const suggested = owns(draft, data.field) ? draft[data.field] : idea[data.field];
            const delta = Number(data.delta);
            const value = suggested == null
              ? delta > 0 ? Math.max(min, step) : null
              : Math.min(max, Math.max(min, Number(suggested) + delta * step));
            await this.field(data.field, value);
          }
          return;
        }
        if (action === "undo") { await this.issue({ type: "undo" }, { recordId: this.recordId }); return; }
        const command = action.startsWith("recover-") ? { type: "recover", choice: action.slice(8) }
          : action === "adjust" ? { type: "adjust", seconds: Number(data.value) } : { type: action };
        this.panel = null;
        if (this.interruption) {
          if (command.type !== "recover") return;
          this.interruption = null;
        }
        if (action === "done") this.flashing = true;
        const changed = await this.issue(command, { recordId: this.recordId, signature: phaseSignature(model) });
        if (action === "adjust" && changed) {
          this.restDelta = { phase: phaseSignature(model), until: Date.now() + 2500,
            seconds: view(this.read()).projection.rest_adjustment_seconds };
          setTimeout(() => this.refresh(), 2500);
        }
        if (action === "done" && changed && this.modal?.open) {
          sensory?.sensorySignal("success", { host: this.modal });
          const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";
          if (!reduced) {
            this.modal.classList.add("sr-done");
            await new Promise(resolve => setTimeout(resolve, 420));
            this.modal?.classList.remove("sr-done");
          }
          await new Promise(resolve => setTimeout(resolve, reduced ? 400 : 230));
        }
      } catch (reason) { this.fail(reason); }
      finally {
        const wasFlashing = this.flashing;
        this.flashing = false;
        this.refresh(wasFlashing);
      }
    }
  }

  function enabled() {
    return typeof ui !== "undefined" && typeof spState === "function" && typeof C()?.isSport2Enabled === "function"
      && C().isSport2Enabled(spState().state);
  }

  function owner() {
    if (!enabled()) return null;
    const runtime = window.flowSportRuntime;
    const lease = runtime?.capture();
    if (!lease || !runtime.canWrite() || typeof window.sorokaSport !== "function") return null;
    return {
      scope: lease.scope,
      current: () => runtime.current(lease) && runtime.canWrite() && enabled(),
    };
  }

  function acquire() {
    const active = owner();
    if (!active) return null;
    if (runner?.owner.current()) return runner;
    runner?.dispose();
    runner = new Runner(active);
    runner.syncSoon();
    return runner;
  }

  window.SportRunReview = { owner, acquire, request };

  function refreshSportSurface() {
    if (typeof spRerender === "function" && typeof ui !== "undefined" && ui.page === "sport") spRerender(true);
  }

  function activeRun() {
    if (!enabled()) return null;
    try {
      const next = acquire(), record = next?.read();
      if (!record) return null;
      const model = view(record);
      return !terminal(model.projection.phase) || record.start || record.events.length || record.complete || record.abandon ? { next, record, model } : null;
    } catch { return null; }
  }

  function activeCard(active) {
    const { record, model } = active;
    const slot = model.current;
    const status = model.paused ? "Пауза" : { preparing: "Подготовка", work: "Подход", rest: "Отдых", review: "Сохранение" }[model.phase];
    const info = record.abandon ? "" : [status, slot && `${slot.exercise.name} · ${slot.set_index} / ${slot.exercise.sets}`].filter(Boolean).join(" · ");
    return `<section class="sp-workout-surface sr-active-card"><div class="sp-workout-head"><div class="sp-workout-meta"><span>${record.abandon ? "Ожидается отмена" : "Идёт тренировка"}</span></div>
      <h2>${esc(record.snapshot.workout.title)}</h2>${info ? `<p class="section-note">${esc(info)}</p>` : ""}</div>
      <button type="button" class="primary-button" data-action="sp-run-resume">${record.abandon ? "Открыть" : "Продолжить"}</button></section>`;
  }

  if (typeof SP_ACTIONS === "undefined") return;
  for (const action of ["sp-runner", "sp-start-day"]) {
    const legacy = SP_ACTIONS[action];
    if (typeof legacy !== "function") continue;
    SP_ACTIONS[action] = function (trigger) {
      if (!enabled()) return legacy.apply(this, arguments);
      const next = acquire();
      if (!next) { toast("Откройте Flow в своём аккаунте."); return; }
      const option = action === "sp-start-day" ? spOptions().visible.find(item => item.key === trigger?.dataset.key)
        : spTimer.session?.option ?? spCurrentOption();
      if (!option || option.historyOnly || (action === "sp-runner" && spTimer.session?.readOnly)) return;
      next.open(option, trigger).catch(reason => next.fail(reason));
    };
  }
  SP_ACTIONS["sp-run-resume"] = trigger => {
    const active = activeRun();
    if (active) active.next.open(null, trigger, true).catch(reason => active.next.fail(reason));
  };

  if (typeof spTrainingScreen === "function" && typeof spDayWorkoutCard === "function") {
    const training = spTrainingScreen, today = spDayWorkoutCard;
    spTrainingScreen = function () { const active = activeRun(); return active ? activeCard(active) : training.apply(this, arguments); };
    spDayWorkoutCard = function () { const active = activeRun(); return active ? activeCard(active) : today.apply(this, arguments); };
    const hero = sp2DayHero;
    sp2DayHero = function () { const active = activeRun(); return active ? activeCard(active) : hero.apply(this, arguments); };
  }
  if (typeof spOverlay === "function" && typeof spTimerRegister === "function") {
    const overlay = spOverlay, register = spTimerRegister;
    spOverlay = function () {
      if (!activeRun()) return overlay.apply(this, arguments);
      const host = document.getElementById("sp-overlay");
      if (host?.firstChild) host.replaceChildren();
      document.body.classList.remove("sp-has-bar", "sp-runner-open");
    };
    spTimerRegister = function () { if (!activeRun()) return register.apply(this, arguments); };
  }
  if (typeof spUpdate === "function") {
    const update = spUpdate;
    const legacyWorkoutKeys = new Set(["workouts", "workoutSetLogs", "programChecks", "checks", "workoutTimes", "workoutDates",
      "workoutSelections", "workoutWeights", "freeWorkouts", "workoutExtras", "exerciseSwaps", "programLifecycle", "programOrder", "warmups"]);
    spUpdate = function (change) {
      if (!activeRun()) return update.apply(this, arguments);
      return update.call(this, previous => {
        const next = change(previous);
        if (next && C().stateChanges(previous, next).some(item => !item.path.length || legacyWorkoutKeys.has(item.path[0]))) return previous;
        return next;
      });
    };
  }

  // Sport's loaded render is the restore hook. With the flag off there is no observer or timer.
  if (typeof renderSportPage === "function") {
    const sportPage = renderSportPage;
    let restoredScope;
    renderSportPage = function () {
      if (enabled()) {
        const active = activeRun();
        if (active && restoredScope !== active.next.owner.scope) {
          restoredScope = active.next.owner.scope;
          queueMicrotask(() => {
            if (!active.next.modal?.open && active.next.owner.current()) active.next.open(null, null, true).catch(reason => active.next.fail(reason));
          });
        }
      }
      return sportPage.apply(this, arguments);
    };
  }
})();
