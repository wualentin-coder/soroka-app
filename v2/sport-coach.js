/* Sport 2.0 analysis, plan versions and adjustable dumbbell inventory. */
(() => {
  "use strict";

  const statusText = {
    queued: "Анализирую тренировку", running: "Анализирую тренировку",
    proposed: "Проверьте изменения", published: "План обновлён", no_change: "Изменений не требуется",
    failed: "Анализ не завершился", stale: "План или результаты изменились", superseded: "Есть более свежие результаты",
  };
  const labels = { load: "Вес", reps: "Повторы", sets: "Подходы", rest_seconds: "Отдых", execution_seconds: "Время подхода", workout: "Тренировка" };
  const pending = job => ["queued", "running"].includes(job?.status);
  const escape = value => spEsc(String(value ?? ""));
  const btn = (action, text, cls = "ghost-button") => '<button type="button" class="' + cls + '" data-coach-action="' + action + '">' + text + "</button>";
  const empty = '<p class="section-note" role="status">Загрузка…</p>';
  const failure = '<p class="section-note" role="alert">Сервер не ответил.</p>' + btn("retry", "Повторить");
  const replyError = {
    analysis_stale: "Версия уже изменилась. Проверьте актуальные изменения.",
    no_changes: "Среди доступных тренировок нет изменений для отмены.",
    invalid_args: "Проверьте значения и количество блинов.",
    analysis_lease_lost: "Срок обработки истёк. План не обновлён.",
  };
  const owner = () => window.SportRunReview?.owner();
  const request = (op, args = {}) => window.SportRunReview.request(op, args);
  const records = new Map();
  const reads = new Map();
  let scope, planWorkouts = new Map(), planRequest, planTime = 0, timer, details, scheduled = false;
  let surfaceEntered = false;
  const nodeByKey = new WeakMap();

  function synchronize() {
    const current = owner();
    if (scope !== current?.scope) {
      scope = current?.scope;
      records.clear();
      reads.clear();
      surfaceEntered = false;
      planTime = 0;
      planRequest = null;
      planWorkouts = new Map();
      if (details?.open) details.close();
    }
    return current;
  }

  async function loadPlans(force = false) {
    const current = synchronize();
    if (!current || !navigator.onLine || planRequest || (!force && Date.now() - planTime < 15000)) return planRequest;
    planTime = Date.now();
    const run = (async () => {
      const result = await request("read_session_plans");
      if (!Array.isArray(result.plans)) throw new Error("network");
      const plans = await Promise.all(result.plans.map(p => request("read_session_plans", { plan_id: p.id })));
      if (!current.current()) return;
      const map = new Map();
      for (const { plan } of plans) for (const workout of plan.content.workouts) map.set(workout.workout_key, { plan, workout });
      const signature = m => JSON.stringify([...m].map(([key, v]) => [key, v.plan.id, v.plan.current_version]));
      if (signature(map) !== signature(planWorkouts)) {
        planWorkouts = map;
        if (ui.page === "sport") spRerender(true);
      }
    })().catch(() => {});
    planRequest = run;
    run.finally(() => { if (planRequest === run) planRequest = null; });
    return run;
  }

  function versionDay(workout, blocks, before, kind) {
    if (!blocks.length) return undefined;
    return {
      ...before, routine_type: before?.routine_type || kind, title: workout.title, focus: workout.focus,
      exercises: blocks.flatMap(block => block.exercises.map(e => ({
        id: e.plan_exercise_id, name: e.name, sets: e.sets, mode: e.mode,
        sets_reps: e.mode === "manual" && e.sets === 1 ? e.target || "" :
          e.sets + " × " + (e.mode === "timed" ? e.work_seconds + " сек" : e.mode === "reps" ? e.reps || "" : e.target || ""),
        hold: e.work_seconds, rest: e.rest_seconds, executionSeconds: e.execution_seconds, bodyweight: e.bodyweight,
        weight_kg: e.load?.kg, weight_basis: e.load?.basis, technique: e.technique, muscles: e.muscles,
      }))),
    };
  }

  function overlay(options, state) {
    if (!scope || !planWorkouts.size) return options;
    const make = (option, workout) => {
      const blocks = workout.blocks.filter(b => !["warmup", "mobility"].includes(b.type));
      return { ...option,
        plan: versionDay(workout, blocks, option.plan, option.kind) || option.plan,
        warmup: versionDay(workout, workout.blocks.filter(b => b.type === "warmup"), option.warmup, "warmup"),
        mobility: versionDay(workout, workout.blocks.filter(b => b.type === "mobility"), option.mobility, "mobility"),
      };
    };
    const known = new Set(options.map(o => o.key));
    const updated = options.map(option => {
      const match = planWorkouts.get(option.key);
      return match && !option.historyOnly ? make(option, match.workout) : option;
    });
    for (const [key, { plan, workout }] of planWorkouts) {
      if (known.has(key) || !key.startsWith("v2|") || !workout.date || !["main", "splits", "test"].includes(workout.kind)) continue;
      updated.push(make({
        key, originalDate: workout.date, date: SP().scheduledWorkoutDate(state, key, workout.date),
        kind: workout.kind, programTitle: plan.title || plan.content.program.title, legacy: false,
      }, workout));
    }
    return updated.filter(o => o.plan);
  }

  function value(field, data) {
    if (data == null) return "—";
    if (field === "load") return (data.units === 2 ? "2 × " : "") + data.kg + " кг";
    if (field === "rest_seconds" || field === "execution_seconds") return data + " с";
    return String(data);
  }

  function diff(changes) {
    if (!changes?.length) return "";
    return '<ul class="sp-coach-diff">' + changes.map(c => {
      const name = c.exercise_name || planWorkouts.get(c.workout_key)?.workout.blocks
        .flatMap(b => b.exercises).find(e => e.plan_exercise_id === c.plan_exercise_id)?.name;
      return "<li><strong>" + escape(name || labels[c.field]) + "</strong>" +
        (c.field === "workout" ? "" : "<span>" + escape(labels[c.field]) + " · " + escape(value(c.field, c.before)) +
          " → " + escape(value(c.field, c.after)) + "</span>") +
        (c.reason ? "<small>" + escape(c.reason) + (c.adjusted ? " · Достижимый вес" : "") + "</small>" : "") + "</li>";
    }).join("") + "</ul>";
  }

  function analysisHtml(entry, key) {
    const job = entry.data?.job;
    if (!job) return key === "latest" ? "" : '<p class="section-note">Для этой тренировки анализа нет.</p>';
    let title = statusText[job.status];
    if (job.status === "published" && job.current_version !== job.published_version) title = "План менялся после этой тренировки";
    if (key === "latest") return btn("open-result", escape(title) + " ›", "text-action");
    return '<div role="status"><strong>' + escape(title || "Статус недоступен") + "</strong>" +
      (pending(job) ? '<div class="sp-coach-progress"></div><small>Экран можно закрыть.</small>' : "") +
      (job.summary && !pending(job) ? "<p>" + escape(job.summary) + "</p>" : "") +
      (job.safety || []).filter(s => s.level !== "info").map(s => '<p class="section-note">' + escape(s.text) + "</p>").join("") +
      "</div>" + (["proposed", "published"].includes(job.status) ? diff(job.changes) : "") +
      '<div class="sp-coach-actions">' +
      (job.status === "proposed" ? btn("confirm", "Применить", "primary-button") : "") +
      (job.status === "published" && job.current_version === job.published_version ? btn("undo", "Отменить") : "") +
      btn("history", "История изменений", "text-action") + "</div>";
  }

  function settingsHtml(entry, key) {
    const settings = entry.data?.settings;
    if (!settings) return failure;
    if (key === "settings") return '<form data-coach-form="settings"><label><input name="enabled" type="checkbox" ' +
      (settings.enabled ? "checked" : "") + '> Обновлять план после тренировки</label><fieldset><legend>Применение изменений</legend>' +
      [["auto_within_limits", "Автоматически в пределах"], ["confirm", "С моим подтверждением"]].map(([v, title]) =>
        '<label><input name="mode" type="radio" value="' + v + '" ' + (settings.mode === v ? "checked" : "") +
          "> " + title + "</label>").join("") +
      '</fieldset><button type="submit" class="ghost-button" disabled>Сохранить</button><p data-coach-feedback role="status"></p></form>' +
      btn("latest-history", "История изменений", "text-action");
    const inventory = settings.inventory;
    const handles = inventory.handles || {};
    const num = (name, title, min, max, step, val, required = true) => "<label>" + title +
      '<input type="number" name="' + name + '" min="' + min + '" max="' + max + '" step="' + step +
      '" value="' + escape(val) + '"' + (required ? " required" : "") + "></label>";
    const rows = (inventory.plates || []).map(plate => plate.mass_kg + " × " + plate.count).join("\n");
    const hints = [2, 1].map(units => {
      const weights = SP().sportAchievable(inventory, units);
      const list = weights.length > 10 ? weights.slice(0, 8).join(" · ") + " … " + weights.at(-1) : weights.join(" · ");
      return weights.length ? "<p>" + (units === 2 ? "На гантель в паре" : "Одна гантель") + " · " + list + " кг</p>" : "";
    }).join("");
    return '<strong>Можно собрать</strong>' + (hints || '<p class="section-note">Укажите ручки и блины для расчёта.</p>') +
      '<form data-coach-form="inventory"><fieldset><legend>Состав гантелей</legend>' +
      num("mass", "Вес ручки, кг", 0.001, 80, 0.001, handles.mass_kg) +
      num("count", "Ручек", 1, 2, 1, handles.count) +
      num("slots", "Блинов на сторону", 1, 12, 1, handles.sleeve_slots) +
      num("collar", "Замки на ручку, кг", 0, 5, 0.001, handles.collar_kg ?? 0) +
      num("cap", "Максимум на гантель, кг", 0.001, 200, 0.001, inventory.limits?.max_per_dumbbell_kg, false) +
      '</fieldset><label>Блины, кг × шт. <textarea name="plates" rows="3" maxlength="240" placeholder="2,5 × 4">' +
      escape(rows) + '</textarea></label><div class="sp-coach-actions"><button type="submit" class="primary-button" disabled>Сохранить</button>' +
      (inventory.handles ? btn("clear-inventory", "Очистить") : "") + '</div><p data-coach-feedback role="status"></p></form>';
  }

  function draw(node, entry, key) {
    if (nodeByKey.get(node) === entry) return;
    nodeByKey.set(node, entry);
    if (key === "latest") node.hidden = Boolean(entry.loading || (!entry.data?.job && !entry.error));
    node.innerHTML = entry.loading ? empty : entry.error ? failure :
      ["settings", "inventory"].includes(key) ? settingsHtml(entry, key) : analysisHtml(entry, key);
  }

  async function read(key, force = false) {
    const current = synchronize();
    if (!current) return;
    const previous = records.get(key);
    if (reads.has(key) || (!force && previous)) return;
    const token = {};
    reads.set(key, token);
    const active = () => current.current() && reads.get(key) === token;
    const loading = { loading: true };
    if (!previous || previous.error) records.set(key, loading);
    try {
      const settings = key === "settings" || key === "inventory";
      const data = settings ? await request("analysis_settings") :
        await request("analysis_status", key === "latest" ? {} : { session_id: key });
      if (!active()) return;
      if (settings ? !data.settings : !Object.hasOwn(data, "job")) throw new Error("network");
      if (key === "latest" && data.job?.status === "published" &&
        data.job.current_version !== previous?.data?.job?.current_version) loadPlans(true);
      if (JSON.stringify(data) !== JSON.stringify(previous?.data)) records.set(key, { data });
    } catch {
      if (active()) records.set(key, { error: true });
    } finally {
      if (reads.get(key) === token) reads.delete(key);
      refresh();
    }
  }

  function hosts() {
    return [...document.querySelectorAll("[data-sport-coach]")].filter(node =>
      !node.closest("dialog") || node.closest("dialog").open);
  }
  function refresh() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const current = synchronize();
      const onSurface = Boolean(current && !document.hidden && ui.page === "sport" && document.querySelector(".sp2-f"));
      if (onSurface && !surfaceEntered) {
        records.delete("latest");
        reads.delete("latest");
        loadPlans(true);
      }
      surfaceEntered = onSurface;
      const mounted = current && !document.hidden ? hosts() : [];
      if (!mounted.length) { clearTimeout(timer); timer = null; return; }
      for (const node of mounted) {
        const key = node.dataset.sportCoach;
        if (!records.has(key)) read(key);
        draw(node, records.get(key) || { loading: true }, key);
      }
      if (mounted.some(node => node.dataset.sportCoach === "latest")) loadPlans();
      if (!timer && mounted.some(node => node.dataset.sportCoach !== "latest" && pending(records.get(node.dataset.sportCoach)?.data?.job))) {
        timer = setTimeout(() => {
          timer = null;
          const watched = new Set(hosts().map(node => node.dataset.sportCoach));
          if (!document.hidden) for (const key of watched) {
            if (key !== "latest" && pending(records.get(key)?.data?.job)) read(key, true);
          }
        }, 3000);
      }
    });
  }

  function invalidate(sessionId) {
    records.delete("latest");
    reads.delete("latest");
    if (sessionId) { records.delete(sessionId); reads.delete(sessionId); }
    refresh();
  }

  function slot(key) {
    return '<section class="sp-coach-card" data-sport-coach="' + escape(key) + '"' + (key === "latest" ? " hidden" : "") + "></section>";
  }

  async function history(planId, trigger) {
    const current = synchronize();
    if (!current) return;
    if (details?.open) details.close();
    const box = document.createElement("dialog");
    details = box;
    box.className = "sport-run sp-coach-history";
    box.setAttribute("aria-label", "История изменений плана");
    document.body.append(box);
    const frame = content => '<section class="sr-screen"><header class="sh-head"><h2>История изменений</h2>' +
      btn("close-history", "Закрыть") + '</header><div class="sh-content">' + content + "</div></section>";
    box.innerHTML = frame(empty);
    box.addEventListener("close", () => { box.remove(); if (details === box) details = null; if (trigger?.isConnected) trigger.focus(); }, { once: true });
    box.showModal();
    async function load() {
      const data = await request("analysis_history", { plan_id: planId });
      if (!box.open || !current.current()) return;
      if (!Array.isArray(data.versions) || !Number.isInteger(data.current_version)) throw new Error("network");
      box.innerHTML = frame(data.versions.map(v => '<section class="sp-coach-card"><strong>Версия ' + v.version +
        (v.version === data.current_version ? " · Текущая" : "") + '</strong><p class="section-note">' +
        escape(v.source === "ai_adapt" ? "Обновление после тренировки" : v.source === "revert" ? "Откат к версии " + v.reverted_to :
          "Сохранённая программа") + "</p>" + diff(v.change_set) + (v.version < data.current_version ?
          '<button type="button" class="ghost-button" data-restore="' + v.version + '" data-current="' + data.current_version +
          '">Вернуть цели версии ' + v.version + "</button>" : "") + "</section>").join(""));
    }
    box.addEventListener("click", async event => {
      const clicked = event.target.closest("button");
      if (!clicked) return;
      if (clicked.dataset.coachAction === "close-history") { box.close(); return; }
      if (clicked.dataset.coachAction === "retry") { await load().catch(() => {}); return; }
      if (!clicked.dataset.restore || !current.current()) return;
      clicked.disabled = true;
      try {
        const result = await request("analysis_revert", { plan_id: planId, expected_version: Number(clicked.dataset.current),
          target_version: Number(clicked.dataset.restore) });
        if (!Number.isInteger(result.version)) throw new Error("network");
        records.clear();
        await loadPlans(true);
        if (box.open && current.current()) await load();
      } catch (error) {
        if (box.open && current.current()) {
          alertIn(box.querySelector(".sh-content"), replyError[error.message] || "Не удалось вернуть версию.");
          clicked.disabled = false;
        }
      }
    });
    await load().catch(() => { if (box.open && current.current()) box.innerHTML = frame(failure); });
  }

  function alertIn(node, message) {
    let line = node.querySelector("[data-coach-feedback]");
    if (!line) {
      line = document.createElement("p");
      line.dataset.coachFeedback = "";
      line.setAttribute("role", "status");
      node.append(line);
    }
    line.textContent = message;
  }

  async function saveSettings(node, settings) {
    const key = node.dataset.sportCoach;
    const current = synchronize();
    const entry = records.get(key);
    if (!current || !entry?.data?.settings) return;
    const { revision, ...old } = entry.data.settings;
    const save = node.querySelector("button[type=submit]");
    if (save) save.disabled = true;
    try {
      const result = await request("analysis_settings", { expected_revision: revision, settings: { ...old, ...settings } });
      if (!result.settings || !Number.isInteger(result.settings.revision)) throw new Error("network");
      if (!current.current()) return;
      records.set(key, { data: result });
      records.delete(key === "settings" ? "inventory" : "settings");
      invalidate();
      draw(node, records.get(key), key);
      alertIn(node, "Сохранено.");
    } catch (error) {
      if (current.current() && node.isConnected) {
        alertIn(node, replyError[error.message] || "Не удалось сохранить.");
        if (save) save.disabled = false;
      }
    }
  }

  document.addEventListener("submit", event => {
    const form = event.target.closest("[data-coach-form]");
    if (!form) return;
    event.preventDefault();
    const node = form.closest("[data-sport-coach]");
    const inputs = new FormData(form);
    if (form.dataset.coachForm === "settings") {
      saveSettings(node, { enabled: inputs.has("enabled"), mode: inputs.get("mode") });
      return;
    }
    const num = key => Number(inputs.get(key));
    const lines = String(inputs.get("plates")).trim().split(/\n/).map(line => line.trim()).filter(Boolean);
    const parsed = lines.map(line => /^([0-9]+(?:[.,][0-9]+)?)\s*[×xх*]\s*(\d+)$/i.exec(line));
    if (parsed.some(line => !line)) { alertIn(node, "Укажите каждый номинал с новой строки, например 2,5 × 4."); return; }
    const inventory = { handles: { mass_kg: num("mass"), count: num("count"), sleeve_slots: num("slots"), collar_kg: num("collar") },
      limits: { max_per_dumbbell_kg: num("cap") || null },
      plates: parsed.map(line => ({ mass_kg: Number(line[1].replace(",", ".")), count: Number(line[2]) })) };
    try { saveSettings(node, { inventory: SP().inventoryLite(inventory) }); }
    catch { alertIn(node, "Проверьте номиналы, количество и предел веса."); }
  });

  document.addEventListener("input", event => {
    const form = event.target.closest("[data-coach-form]");
    if (form) form.querySelector("button[type=submit]").disabled = false;
  });

  document.addEventListener("click", async event => {
    const control = event.target.closest("[data-coach-action]");
    const node = control?.closest("[data-sport-coach]");
    if (!node) return;
    const current = synchronize();
    if (!current) return;
    const key = node.dataset.sportCoach;
    const job = records.get(key)?.data?.job;
    const action = control.dataset.coachAction;
    if (action === "retry") { read(key, true); return; }
    if (action === "clear-inventory") { saveSettings(node, { inventory: {} }); return; }
    if (action === "open-result" && job?.session_id) { window.SportHistory.open(job.session_id, control); return; }
    if (action === "history" && job?.plan_id) { history(job.plan_id, control); return; }
    if (action === "latest-history") {
      try {
        const latest = await request("analysis_status");
        if (!current.current() || !node.isConnected) return;
        if (latest.job?.plan_id) history(latest.job.plan_id, control);
        else alertIn(node, "Истории изменений пока нет.");
      } catch { if (current.current() && node.isConnected) alertIn(node, "История недоступна."); }
      return;
    }
    if (!job || !["confirm", "undo"].includes(action)) return;
    for (const button of node.querySelectorAll("button")) button.disabled = true;
    try {
      const result = action === "confirm" ? await request("analysis_confirm", { job_id: job.id,
        expected_version: job.base_version, expected_revision: job.revision }) :
        await request("analysis_revert", { plan_id: job.plan_id, expected_version: job.published_version, target_version: job.base_version });
      if (!Number.isInteger(result.version) || (action === "confirm" && result.status !== "published")) throw new Error("network");
      if (!current.current()) return;
      invalidate(job.session_id);
      loadPlans(true);
    } catch (error) {
      if (current.current() && node.isConnected) {
        alertIn(node, replyError[error.message] || "Не удалось обновить план.");
        for (const button of node.querySelectorAll("button")) button.disabled = false;
      }
    }
  });

  new MutationObserver(refresh).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { records.delete("latest"); loadPlans(true); } refresh(); });
  window.addEventListener("online", () => { invalidate(); loadPlans(true); });
  window.SportCoach = { slot, invalidate, overlay };
})();
