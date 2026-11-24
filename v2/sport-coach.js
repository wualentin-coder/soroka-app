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
  let scheduleState = null, scheduleKey = "", scheduleAt = 0;
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
      let result = await request("read_session_plans");
      if (!Array.isArray(result.plans)) throw new Error("network");
      const fresh = await reschedule(result.plans);
      if (fresh) result = fresh;
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

  /** E11b: ask the server what is missed, shift the tail once, then refresh. */
  async function reschedule(list) {
    const plan = list[0];
    if (!plan?.id || !navigator.onLine) return null;
    const key = plan.id + ":" + plan.current_version;
    if (scheduleKey === key && Date.now() - scheduleAt < 60000) return null;
    scheduleKey = key;
    scheduleAt = Date.now();
    let status;
    try { status = await request("schedule_status", { plan_id: plan.id }); } catch { return null; }
    if (!status || status.ok !== true) return null;
    scheduleState = { ...status, shifted: false };
    if (!(status.missed > 0) || status.blocked) return null;
    let reply;
    try { reply = await request("schedule_shift", { plan_id: plan.id, expected_version: status.plan_version }); }
    catch { return null; }
    if (!reply || reply.ok !== true) return null;
    scheduleState = { ...status, ...reply };
    if (reply.shifted !== true && reply.duplicate !== true) return null;
    if (reply.duplicate === true) scheduleState = null;
    scheduleKey = plan.id + ":" + reply.version;
    scheduleAt = Date.now();
    try {
      const fresh = await request("read_session_plans");
      return Array.isArray(fresh.plans) ? fresh : null;
    } catch { return null; }
  }

  function scheduleBanner() {
    const data = scheduleState;
    if (!data || data.ok !== true) return "";
    let text = "";
    if (data.shifted && data.days > 0) {
      text = `Программа сдвинута на ${data.days} дн. · пропущено ${data.missed}`;
    } else if (data.blocked === "consecutive") {
      text = `${data.missed} пропуска подряд · автоперенос остановлен. Соберите программу заново.`;
    } else if (data.blocked === "limit") {
      text = `Программа отстала на ${data.missed} дн. · лимит 14 дней за 30. Нужен ручной перенос или пересборка.`;
    } else if (data.blocked === "ended") {
      text = `Пропущено ${data.missed} занятий, но будущих дат в программе больше нет.`;
    } else if (data.missed > 0) {
      text = `Пропущено ${data.missed} силовых. Сдвиг ждёт сети или следующего открытия.`;
    }
    return text ? `<p class="sp2-schedule-banner" role="status">${escape(text)}</p>` : "";
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
    const make = (option, workout, plan) => {
      const warmup = workout.blocks.filter(b => b.type === "warmup");
      const main = workout.blocks.filter(b => !["warmup", "mobility"].includes(b.type));
      const mobility = workout.blocks.filter(b => b.type === "mobility");
      // E11c: a mobility-only day has no strength block. Render its mobility
      // block as the workout itself instead of dropping the day from the plan.
      const blocks = main.length ? main : mobility;
      return { ...option, sport2PlanId: plan.id,
        plan: versionDay(workout, blocks, option.plan, option.kind) || option.plan,
        warmup: versionDay(workout, warmup, option.warmup, "warmup") || option.warmup,
        mobility: main.length ? (versionDay(workout, mobility, option.mobility, "mobility") || option.mobility) : undefined,
      };
    };
    const known = new Set(options.map(o => o.key));
    const updated = options.map(option => {
      const match = planWorkouts.get(option.key);
      return match && !option.historyOnly ? make(option, match.workout, match.plan) : option;
    });
    for (const [key, { plan, workout }] of planWorkouts) {
      if (known.has(key) || !key.startsWith("v2|") || !workout.date || !["main", "splits", "test"].includes(workout.kind)) continue;
      updated.push(make({
        key, originalDate: workout.date, date: SP().scheduledWorkoutDate(state, key, workout.date),
        kind: workout.kind, programTitle: plan.title || plan.content.program.title, legacy: false,
      }, workout, plan));
    }
    return updated.filter(o => o.plan);
  }

  function value(field, data) {
    if (data == null) return "—";
    if (field === "load") return (data.units === 2 ? "2 × " : "") + data.kg + " кг";
    if (field === "rest_seconds" || field === "execution_seconds") return data + " с";
    return String(data);
  }

  function money(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return "";
    if (number >= 0.01) return "$" + number.toFixed(2);
    return "$" + number.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  }

  function exerciseName(slot) {
    if (!slot) return "";
    for (const entry of planWorkouts.values()) {
      for (const block of entry.workout.blocks || []) {
        const found = (block.exercises || []).find(item => item.plan_exercise_id === slot);
        if (found?.name) return found.name;
      }
    }
    return "";
  }

  function reference(ref) {
    const list = Array.isArray(ref?.refs) ? ref.refs : [];
    return list.map(entry => {
      const value = typeof entry === "string" ? entry : entry?.set || entry?.exercise_id;
      if (!value) return "";
      const cut = String(value).lastIndexOf("#");
      const slot = cut > 0 ? String(value).slice(0, cut) : String(value);
      const index = cut > 0 ? String(value).slice(cut + 1) : "";
      return (exerciseName(slot) || slot) + (index ? " · подход " + index : "");
    }).filter(Boolean).join("; ");
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
    if (job.status === "stale" || job.status === "superseded") {
      if (key === "latest") return "";
      return '<p class="section-note">' + (job.status === "stale"
        ? "Анализ не применён: план или результаты уже изменились."
        : "Этот анализ устарел: есть более свежий.") + "</p>";
    }
    let title = statusText[job.status];
    if (job.status === "published" && job.current_version !== job.published_version) title = "План менялся после этой тренировки";
    if (key === "latest") return btn("open-result", escape(title) + " ›", "text-action");
    const shown = (job.changes || []).slice(0, 3);
    const rest = (job.changes || []).length - shown.length;
    const meta = [job.model, job.tokens ? job.tokens.toLocaleString("ru-RU") + " токенов" : "", money(job.cost)]
      .filter(Boolean).join(" · ");
    return '<div role="status"><strong>' + escape(title || "Статус недоступен") + "</strong>" +
      (pending(job) ? '<div class="sp-coach-progress"></div><small>Экран можно закрыть.</small>' : "") +
      (job.summary && !pending(job) ? "<p>" + escape(job.summary) + "</p>" : "") +
      (meta && !pending(job) ? '<p class="section-note sp-coach-meta">' + escape(meta) + "</p>" : "") +
      (job.safety || []).filter(s => s.level !== "info").map(s => '<p class="section-note">' + escape(s.text) + "</p>").join("") +
      "</div>" + (["proposed", "published"].includes(job.status) ? diff(shown) : "") +
      (rest > 0 ? '<p class="section-note">Ещё ' + rest + " — в «Почему».</p>" : "") +
      '<div class="sp-coach-actions">' +
      (job.status === "failed" ? btn("retry-analysis", "Повторить", "primary-button") : "") +
      (job.status === "proposed" ? btn("confirm", "Применить", "primary-button") : "") +
      (job.status === "published" && job.current_version === job.published_version ? btn("undo", "Отменить") : "") +
      (job.summary || (job.items || []).length || (job.changes || []).length ? btn("why", "Почему", "text-action") : "") +
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
      btn("latest-history", "История изменений", "text-action") +
      (money(entry.data?.spent_usd) ? '<p class="section-note sp-coach-meta">Израсходовано на анализ: ' +
        money(entry.data.spent_usd) + "</p>" : "");
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
    const html = entry.loading ? empty : entry.error ? failure :
      ["settings", "inventory"].includes(key) ? settingsHtml(entry, key) : analysisHtml(entry, key);
    if (key === "latest") node.hidden = Boolean(entry.loading || !html || (!entry.data?.job && !entry.error));
    node.innerHTML = html;
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

  function whyHtml(job) {
    const items = Array.isArray(job.items) ? job.items : [];
    const of = kind => items.filter(item => item.kind === kind);
    const block = (title, rows) => rows.length ? '<section class="sp-coach-card"><strong>' + title + "</strong>" +
      rows.join("") + "</section>" : "";
    const observations = of("observation").map(item => "<p>" + escape(item.body?.text || "") +
      (reference(item.ref) ? '<br><small>Основание: ' + escape(reference(item.ref)) + "</small>" : "") + "</p>");
    const hypotheses = of("hypothesis").map(item => "<p>" + escape(item.body?.text || "") +
      '<br><small>Предположение · ' + escape(item.body?.confidence_label === "medium" ? "средняя уверенность" : "низкая уверенность") +
      "</small></p>");
    const safety = of("safety").map(item => "<p><strong>" +
      (item.body?.level === "stop" ? "Остановиться" : item.body?.level === "caution" ? "Осторожно" : "К сведению") +
      ".</strong> " + escape(item.body?.text || "") + "</p>");
    const questions = of("question").map(item => "<p><strong>Вопрос тренера.</strong> " + escape(item.body?.text || "") +
      (item.body?.reason ? '<br><small>' + escape(item.body.reason) + "</small>" : "") + "</p>");
    const notes = of("change_note").map(item => {
      const ref = item.ref || {};
      const body = item.body || {};
      const name = exerciseName(ref.plan_exercise_id) || ref.plan_exercise_id || "Упражнение";
      return "<p><strong>" + escape(name) + "</strong> · " + escape(labels[ref.field] || ref.field || "") + " " +
        escape(value(ref.field, body.before)) + " → " + escape(value(ref.field, body.after)) +
        (body.reason ? '<br><small>' + escape(body.reason) + "</small>" : "") + "</p>";
    });
    const changes = (job.changes || []).length
      ? '<section class="sp-coach-card"><strong>Что изменилось</strong>' + diff(job.changes) + "</section>" : "";
    const parts = [
      job.summary ? "<p>" + escape(job.summary) + "</p>" : "",
      changes,
      block("Наблюдения", observations),
      block("Предположения", hypotheses),
      block("Безопасность", safety),
      block("Вопросы", questions),
      !changes && notes.length ? '<section class="sp-coach-card"><strong>Причины изменений</strong>' + notes.join("") + "</section>" : "",
    ].filter(Boolean);
    const meta = [job.model, job.tokens ? job.tokens.toLocaleString("ru-RU") + " токенов" : "", money(job.cost)]
      .filter(Boolean).join(" · ");
    if (meta) parts.push('<p class="section-note sp-coach-meta">' + escape(meta) + "</p>");
    return parts.length ? parts.join("") : '<p class="section-note">Тренер не оставил пояснений.</p>';
  }

  function why(job, trigger) {
    const current = synchronize();
    if (!current) return;
    if (details?.open) details.close();
    const box = document.createElement("dialog");
    details = box;
    box.className = "sport-run sp-coach-history sp-coach-why";
    box.setAttribute("aria-label", "Почему тренер так решил");
    document.body.append(box);
    const frame = content => '<section class="sr-screen"><header class="sh-head"><h2>Почему</h2>' +
      btn("close-why", "Закрыть") + '</header><div class="sh-content">' + content + "</div></section>";
    box.innerHTML = frame(whyHtml(job));
    box.addEventListener("close", () => {
      box.remove();
      if (details === box) details = null;
      if (trigger?.isConnected) trigger.focus();
    }, { once: true });
    box.addEventListener("click", event => {
      if (event.target.closest('[data-coach-action="close-why"]')) box.close();
    });
    box.showModal();
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
    if (action === "retry-analysis" && job?.session_id) {
      for (const button of node.querySelectorAll("button")) button.disabled = true;
      try {
        await request("analysis_retry", { session_id: job.session_id });
        if (!current.current()) return;
        invalidate(job.session_id);
        read(key, true);
      } catch { if (current.current() && node.isConnected) alertIn(node, "Не удалось повторить анализ."); }
      return;
    }
    if (action === "clear-inventory") { saveSettings(node, { inventory: {} }); return; }
    if (action === "open-result" && job?.session_id) { window.SportHistory.open(job.session_id, control); return; }
    if (action === "why" && job) { why(job, control); return; }
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
  window.SportCoach = { slot, invalidate, overlay, loadPlans };
  window.SportSchedule = { banner: scheduleBanner };
})();
