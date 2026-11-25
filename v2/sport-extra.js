/* Sport 2.0 · E13 «Готовность» и E14 «Гибкость»: экраны, листы, состояние.
   Замены и тёплый старт берутся только из sport/catalog/substitutions.json.
   Все правки тренировки (вес, замена, тёплый старт, замена дня по боли)
   сохраняются на сервере новой версией плана через adapt_workout, где
   изменена только эта тренировка; «Вернуть» — restore_workout. */
(() => {
  "use strict";
  const core = window.SportExtraCore;
  const catalogCore = window.SportCatalogCore;
  if (!core || !catalogCore) return;
  const esc = window.esc || ((value) => String(value ?? ""));
  const C = () => window.SportCore;
  const state = () => spState().state;
  const today = () => C().todayKey();
  // Самочувствие действует только в день, когда его отметили; правки
  // тренировок (applied, dayFix) живут, пока живёт их версия плана.
  const freshAuto = (prev) => {
    const raw = prev?.sport2Autoreg || {};
    return raw.date === today() ? raw : { applied: raw.applied || null, dayFix: raw.dayFix || null };
  };
  const auto = () => freshAuto(state());
  const setAuto = (patch) => spUpdate((prev) => ({ ...prev, sport2Autoreg: { ...freshAuto(prev), ...patch, date: today() } }));
  const flex = () => state().sport2Flex || { reminders: [true, true, false] };

  let catalog = null, matrix = null, loading = null, failed = false;
  const dataReady = () => Boolean(catalog && matrix);

  async function ensureData() {
    if (dataReady()) return true;
    if (loading) return loading;
    failed = false;
    loading = (async () => {
      try {
        const [seedReply, matrixReply] = await Promise.all([
          fetch("./sport-catalog.json", { cache: "no-cache" }),
          fetch("./sport-substitutions.json", { cache: "no-cache" }),
        ]);
        if (!seedReply.ok || !matrixReply.ok) throw new Error("data_unavailable");
        const seed = await seedReply.json();
        const matrixValue = await matrixReply.json();
        catalog = catalogCore.normalize(seed);
        matrix = matrixValue;
        return true;
      } catch {
        failed = true;
        return false;
      } finally {
        loading = null;
        if (spState().tab === "flex" || ["sp2-swap"].includes(spState().sheet?.kind)) render();
      }
    })();
    return loading;
  }
  queueMicrotask(ensureData);

  const api = (op, args = {}) => window.SportRunReview.request(op, args);
  let pending = false;
  const errors = {
    workout_started: "Эта тренировка уже начата — правка не применяется.",
    workout_past: "Тренировка в прошлом — её уже не изменить.",
    plan_version_stale: "План только что обновился. Попробуйте ещё раз.",
    workout_not_found: "Тренировки нет в текущем плане.",
    no_changes: "Менять нечего — тренировка уже такая.",
    nothing_to_fix: "В этой тренировке нет упражнений на эту зону.",
    no_safe_swap: "Безопасных замен нет — лучше отдохнуть сегодня.",
    data_unavailable: "Матрица замен не загрузилась. Проверьте связь.",
  };
  const failText = (reason) => !navigator.onLine ? "Нужна сеть — правка сохраняется на сервере."
    : errors[reason?.message] || "Не сохранилось — проверьте связь.";

  /** Тренировка текущей версии плана с сервера: id плана, версия и слоты. */
  async function serverWorkout(key) {
    const list = await api("read_session_plans");
    for (const item of list.plans || []) {
      const { plan } = await api("read_session_plans", { plan_id: item.id });
      const workout = plan?.content?.workouts?.find((row) => row.workout_key === key);
      if (workout) return { plan_id: plan.id, version: plan.current_version, workout };
    }
    throw new Error("workout_not_found");
  }
  const refreshPlans = () => { try { window.SportCoach?.loadPlans?.(true); } catch {} };

  async function adaptDay(key, build) {
    const info = await serverWorkout(key);
    const ops = build(info.workout);
    if (!ops?.length) throw new Error("no_changes");
    const reply = await api("adapt_workout", { plan_id: info.plan_id, expected_version: info.version, workout_key: key, ops });
    refreshPlans();
    return { optionKey: key, plan_id: info.plan_id, from_version: reply.from_version, version: reply.version };
  }

  async function restoreDay(edit) {
    const info = await serverWorkout(edit.optionKey);
    await api("restore_workout", { plan_id: info.plan_id, expected_version: info.version,
      workout_key: edit.optionKey, from_version: edit.from_version });
    refreshPlans();
  }

  /** Отмена возвращает тренировку к версии до правки — значит, снимаются и
   *  все более поздние правки этой же тренировки. */
  function dropEditsFrom(prev, key, from) {
    const later = (edit) => edit && edit.optionKey === key && Number(edit.from_version) >= Number(from);
    const a = { ...freshAuto(prev) }, f = { ...(prev.sport2Flex || {}) };
    if (later(a.applied)) a.applied = null;
    if (later(a.dayFix)) a.dayFix = null;
    if (later(f.swap)) f.swap = null;
    if (later(f.warmup)) f.warmup = null;
    return { ...prev, sport2Autoreg: a, sport2Flex: f };
  }

  async function guarded(work) {
    if (pending) return;
    pending = true;
    try { await work(); } catch (reason) { toast(failText(reason)); } finally { pending = false; render(); }
  }

  /** Slot of [exercise] in the server workout; strict = no guessing (a swap must hit the chosen one). */
  function slotFor(workout, exercise, strict = false) {
    const all = (workout?.blocks || []).flatMap((block) => block.exercises || []);
    return all.find((item) => exercise?.exercise_id && item.exercise_id === exercise.exercise_id)
      || all.find((item) => item.name === exercise?.name)
      || (strict ? null : core.firstWeighted(workout)) || null;
  }

  function target() {
    const s = spState();
    const options = spOptions().visible.filter((option) => ["main", "splits"].includes(option.kind));
    const option = options.find((item) => item.date === s.date && !s.state.workouts?.[item.key])
      || options.find((item) => item.kind === "main" && item.date >= s.date)
      || options.find((item) => item.kind === "main")
      || options[0];
    if (!option) return null;
    const exercises = option.plan?.exercises || [];
    const exercise = exercises.find((item) => Number(item.weight_kg ?? item.load?.kg ?? 0) > 0) || exercises[0] || null;
    return { option, exercise };
  }

  // E14: which exercise of the workout to replace (default — the first with weight).
  let swapPick = null;
  function swapTarget() {
    const entry = target();
    if (!entry) return null;
    const exercises = entry.option.plan?.exercises || [];
    const picked = swapPick?.optionKey === entry.option.key ? exercises[swapPick.index] : null;
    return { ...entry, exercises, exercise: picked || entry.exercise };
  }

  function currentKg(exercise) {
    return Number(exercise?.weight_kg ?? exercise?.load?.kg ?? 0) || 0;
  }
  function currentSets(exercise) {
    return Math.max(1, Number(exercise?.sets) || Number(C().exerciseSets(exercise)) || 1);
  }
  function catalogId(exercise) {
    return exercise?.exercise_id || exercise?.plan_exercise_id || core.exerciseIdForName(exercise?.name, catalog || []) || null;
  }

  function recFor(entry) {
    const a = auto();
    return core.recommend({
      readiness: a.readiness ?? null, pain: a.pain || "none", rir: a.rir ?? 2,
      kg: currentKg(entry?.exercise), sets: currentSets(entry?.exercise),
    });
  }

  function quick() {
    const a = auto(), f = flex();
    const applied = a.applied;
    return `<div class="sp2-ex-quick">
      <button type="button" data-action="sp-2-autoreg"><b>Готовность</b><span>${applied ? esc(applied.title) : "перед тренировкой"}</span></button>
      <button type="button" data-action="sp-2-flex"><b>Гибкость</b><span>${f.swap ? "замена выбрана" : f.warmup ? "тёплый старт" : "замена · старт"}</span></button>
    </div>`;
  }

  function dayFixCard(a, entry) {
    const fix = a.dayFix && a.dayFix.optionKey === entry?.option?.key ? a.dayFix : null;
    if (fix) {
      return `<div class="sp2-ex-ok">${icon("check")}<div><b>Тренировка на сегодня заменена</b><span>${esc(fix.label)} · заменено ${fix.swaps}, убрано ${fix.drops}. Остальной план не тронут.</span></div><button type="button" class="text-action" data-action="sp2-ar-dayfix-undo">Вернуть</button></div>`;
    }
    if (a.pain !== "mild") return "";
    const zones = core.PAIN_ZONES.map((zone) => `<button type="button" data-action="sp2-ar-zone" data-value="${zone.id}" aria-pressed="${a.zone === zone.id}">${esc(zone.label)}</button>`).join("");
    return `<div class="sp2-ex-pain"><span>Где</span><div class="sp2-ex-chips">${zones}</div></div>
      ${a.zone && entry?.option ? `<button class="primary-button sp2-ex-wide" type="button" data-action="sp2-ar-dayfix">Заменить упражнения на сегодня</button>
      <p class="sp2-ex-note">Уберём или заменим только упражнения этой тренировки, которые грузят зону. Это не диагноз.</p>` : ""}`;
  }

  function autoregScreen() {
    const a = auto(), entry = target(), rec = recFor(entry), applied = a.applied;
    const readiness = [1, 2, 3, 4, 5].map((n) => `<button type="button" data-action="sp2-ar-ready" data-value="${n}" aria-pressed="${a.readiness === n}" aria-label="Готовность ${n} из 5">${n}</button>`).join("");
    const rir = [[0, "0", "RPE 10"], [1, "1", "RPE 9"], [2, "2", "RPE 8"], [3, "3+", "RPE ≤7"]]
      .map(([value, label, rpe]) => `<button type="button" data-action="sp2-ar-rir" data-value="${value}" aria-pressed="${(a.rir ?? 2) === value}"><b>${label}</b><span>${rpe}</span></button>`).join("");
    const goal = rec.kind === "stop" ? `<div class="sp2-ex-stop" role="alert">${icon("flag")}<div><b>Стоп · отдых</b><span>Острая боль. Тренировку не начинай; при боли и онемении — к врачу.</span></div></div>`
      : `<div class="sp2-ex-value"><span class="was">${rec.from != null ? `${rec.from} кг` : rec.kg > 0 ? `${rec.kg} кг` : "свой вес"}</span>${rec.canApply ? `<i>${icon("right")}</i><b>${rec.kg > 0 ? `${rec.kg} кг` : "свой вес"}</b>` : `<span class="delta">${rec.kind === "hold" ? "без роста" : "без изменений"}</span>`}</div>
          <p class="sp2-ex-meta">${esc(rec.reason)} · подходы ${rec.sets}${rec.canApply ? " · " + esc(rec.note) : ""}</p>
          ${rec.canApply && !applied ? `<button class="primary-button sp2-ex-apply" type="button" data-action="sp2-ar-apply">Применить</button>` : ""}`;
    const appliedNote = applied ? `<div class="sp2-ex-ok">${icon("check")}План на сегодня обновлён <button type="button" class="text-action" data-action="sp2-ar-undo">Вернуть</button></div>` : "";
    return `<section class="sp2-ex">
      <section class="sp2-ex-card"><div class="sp2-ex-head"><h2>Как вы сегодня</h2><span class="sp2-ex-pill ${a.readiness && a.readiness <= 2 ? "warn" : ""}">${a.readiness ? `${a.readiness}/5` : "—"}</span></div>
        <p class="sp2-ex-note">Сон, мышцы, энергия</p><div class="sp2-ex-scale" role="group" aria-label="Готовность">${readiness}</div><div class="sp2-ex-ends"><span>Разбит</span><span>Свежий</span></div>
        <div class="sp2-ex-pain"><span>Боль</span><div class="sp2-ex-chips"><button type="button" data-action="sp2-ar-pain" data-value="none" aria-pressed="${(a.pain || "none") === "none"}">Нет</button><button type="button" data-action="sp2-ar-pain" data-value="mild" aria-pressed="${a.pain === "mild"}">Ноет</button><button type="button" data-action="sp2-ar-pain" data-value="sharp" aria-pressed="${a.pain === "sharp"}">Острая</button></div></div>
        ${a.pain === "sharp" ? `<div class="sp2-ex-alert" role="alert">${icon("flag")}<span>Тренировка сегодня не начнётся. Острая боль — повод отдохнуть; при боли и онемении — к врачу.</span></div>` : ""}
        ${dayFixCard(a, entry)}
      </section>
      <section class="sp2-ex-card"><div class="sp2-ex-head"><h2>План на сегодня</h2><span class="sp2-ex-pill ${rec.kind === "stop" || rec.kind === "hold" ? "warn" : ""}">${esc(applied ? "применено" : rec.title)}</span></div>
        <p class="sp2-ex-note">${esc(entry?.option?.plan?.title || "Ближайшая тренировка")}${entry?.exercise ? ` · ${esc(entry.exercise.name)}` : ""}</p>
        ${goal}${appliedNote}
        ${!rec.canApply && !applied && rec.kind !== "stop" ? `<p class="sp2-ex-note">План пока не меняется. Это не диагноз; при боли — не грузить.</p>` : ""}
      </section>
      <section class="sp2-ex-card"><div class="sp2-ex-head"><h2>RIR прошлого подхода</h2><span class="sp2-ex-pill">${(a.rir ?? 2) >= 3 ? "RPE ≤7" : `RPE ${10 - (a.rir ?? 2)}`}</span></div>
        <p class="sp2-ex-note">Сколько повторов осталось</p><div class="sp2-ex-rir" role="group" aria-label="RIR">${rir}</div>
        <p class="sp2-ex-map">RIR ${(a.rir ?? 2) >= 3 ? "3+" : (a.rir ?? 2)} = ${(a.rir ?? 2) >= 3 ? "RPE ≤7" : `RPE ${10 - (a.rir ?? 2)}`} · RIR — сколько повторов осталось.</p>
      </section>
      <section class="sp2-ex-rules"><div><h3>Показываем</h3><p>Причину изменения</p><p>RIR и его RPE</p><p>Что осталось прежним</p></div><div><h3>Блокируем</h3><p class="${a.pain === "sharp" ? "on" : ""}">Рост при острой боли</p><p class="${(a.rir ?? 2) === 0 ? "on" : ""}">Рекорд при RIR 0</p><p class="${!a.readiness ? "on" : ""}">Автоподбор без готовности</p></div><p class="sp2-ex-note">Блокируем нагрузку, не тренировку. Без обещаний лечения.</p></section>
    </section>`;
  }

  function flexScreen() {
    const f = flex(), entry = swapTarget(), limits = C().readSport2Profile(state().sport2Profile).limits;
    const swapped = f.swap;
    const warm = f.warmup;
    const reminders = Array.isArray(f.reminders) ? f.reminders : [true, true, false];
    const on = reminders.filter(Boolean).length;
    return `<section class="sp2-ex">
      <section class="sp2-ex-card"><div class="sp2-ex-head"><h2>Замена упражнения</h2><span class="sp2-ex-pill ${limits.length ? "warn" : ""}">${limits.length ? "ограничения" : "замены"}</span></div>
        ${entry?.exercises?.length > 1 ? `<div class="sp2-ex-pain"><span>Что заменить</span><div class="sp2-ex-chips">${entry.exercises.map((item, index) => `<button type="button" data-action="sp2-flex-swap-slot" data-index="${index}" aria-pressed="${item === entry.exercise}">${esc(item.name)}</button>`).join("")}</div></div>` : ""}
        <div class="sp2-ex-now"><span>Сейчас</span><b>${esc(entry?.exercise?.name || "Нет упражнения")}</b><small>${entry?.exercise ? `${currentKg(entry.exercise) > 0 ? `${currentKg(entry.exercise)} кг` : "свой вес"} · ${currentSets(entry.exercise)} подхода` : ""}</small></div>
        ${swapped ? `<div class="sp2-ex-ok">${icon("check")}<div><b>${esc(swapped.name)}</b><span>${esc(swapped.why || "замена из матрицы")}</span></div><button type="button" class="text-action" data-action="sp2-flex-swap-undo">Вернуть</button></div>` : ""}
        <button class="ghost-button sp2-ex-wide" type="button" data-action="sp2-flex-swap-open">${icon("reset")}${swapped ? "Другая замена" : "Подобрать замену"}</button>
        <p class="sp2-ex-note">Меняется только эта тренировка; «Вернуть» откатывает её на сервере.</p>
      </section>
      <section class="sp2-ex-card"><div class="sp2-ex-head"><h2>Тёплый старт</h2><span class="sp2-ex-pill">${warm ? `${warm.items.length} движений` : "из матрицы"}</span></div>
        ${warm ? `<div class="sp2-ex-warm">${warm.items.map((item) => `<span>${esc(item.name)} · ${item.mode === "time" ? `${item.value} с` : `${item.value}`}</span>`).join("")}</div><div class="sp2-ex-ok">${icon("check")}Добавлено в начало <button type="button" class="text-action" data-action="sp2-flex-warm-remove">Убрать</button></div>`
          : `<p class="sp2-ex-note">Тёплый старт из матрицы: общая разминка и те же паттерны по одному подходу.</p><button class="primary-button sp2-ex-wide" type="button" data-action="sp2-flex-warm-open">Добавить в начало</button>`}
      </section>
      <section class="sp2-ex-card"><div class="sp2-ex-head"><h2>Напоминания</h2><span class="sp2-ex-pill ${on === 0 ? "warn" : ""}">${on} из 3</span></div>
        <div class="sp2-ex-reminders">${core.REMINDERS.map((reminder, index) => `<div class="sp2-ex-reminder"><span><b>${esc(reminder.name)}</b><small>${esc(reminder.sub)}</small></span><button class="sp2-ex-switch" type="button" role="switch" data-action="sp2-flex-reminder" data-index="${index}" aria-checked="${Boolean(reminders[index])}" aria-label="${esc(reminder.name)}"><i></i></button></div>`).join("")}</div>
        <p class="sp2-ex-note">${on ? "Приходят в Telegram во время тренировки из настроек напоминаний Спорта, не больше одного в день." : "Напоминания выключены."}</p>
      </section>
      <p class="sp2-ex-note">Замена и тёплый старт меняют только эту тренировку — остальной план не трогаем.</p>
    </section>`;
  }

  function alternativesSheet(sheet) {
    const entry = swapTarget();
    if (!entry?.exercise) return { title: "Замена", body: `<p class="sp2-ex-note">Нет упражнения для замены.</p>` };
    if (!dataReady()) {
      if (!failed) ensureData();
      return { title: "Замена", body: `<p class="sp2-ex-note" role="status">${failed ? "Матрица замен недоступна. Проверьте связь." : "Загружаем матрицу замен…"}</p>` };
    }
    const id = catalogId(entry.exercise);
    const limits = C().readSport2Profile(state().sport2Profile).limits;
    const list = id ? core.alternativesFor(id, matrix, catalog, limits) : [];
    const rows = list.length ? list.map((item) => `<button type="button" class="sp2-ex-alt" data-action="sp2-flex-swap-pick" data-id="${esc(item.id)}" data-name="${esc(item.name)}" data-why="${esc(item.why)}" ${item.blocked ? "disabled aria-disabled=\"true\"" : ""}><span><b>${esc(item.name)}</b><small>${esc(item.why)}</small></span><em>${item.blocked ? "ограничение" : item.score}</em></button>`).join("")
      : `<p class="sp2-ex-note">Для «${esc(entry.exercise.name)}» в матрице нет замен.</p>`;
    return { title: "Заменить упражнение", body: `<p class="sp2-ex-note">${esc(entry.exercise.name)} · ${esc(entry.option.plan.title)}</p><div class="sp2-ex-alts">${rows}</div><p class="sp2-ex-note">Источник — матрица замен 88/88, без отдельной эвристики.</p>` };
  }

  function warmSheet() {
    if (!dataReady()) {
      if (!failed) ensureData();
      return { title: "Тёплый старт", body: `<p class="sp2-ex-note" role="status">${failed ? "Матрица недоступна. Проверьте связь." : "Загружаем матрицу…"}</p>` };
    }
    const warmup = core.warmupFor("strength", matrix, catalog);
    if (!warmup) return { title: "Тёплый старт", body: `<p class="sp2-ex-note">В матрице нет тёплого старта.</p>` };
    return { title: "Тёплый старт", body: `<p class="sp2-ex-note">${esc(warmup.title)} · ${warmup.duration_min} мин · ${warmup.items.length} движений</p><div class="sp2-ex-warm">${warmup.items.map((item) => `<span>${esc(item.name)} · ${item.mode === "time" ? `${item.value} с` : `${item.value}`}${item.note ? ` · ${esc(item.note)}` : ""}</span>`).join("")}</div><div class="sheet-actions"><button class="ghost-button" type="button" data-action="sp2-close">Отмена</button><button class="primary-button" type="button" data-action="sp2-flex-warm-add">Добавить</button></div>` };
  }

  SP_SHEETS["sp2-swap"] = (sheet) => alternativesSheet(sheet);
  SP_SHEETS["sp2-warmup"] = () => warmSheet();

  const toggleReminder = (list, index) => list.map((value, i) => i === index ? !value : value);

  Object.assign(SP_ACTIONS, {
    "sp-2-autoreg": () => { const s = spState(); s.extraReturn = s.tab; s.tab = "autoreg"; render(); window.scrollTo(0, 0); },
    "sp-2-flex": () => { const s = spState(); s.extraReturn = s.tab; s.tab = "flex"; render(); window.scrollTo(0, 0); },
    "sp2-ar-ready": (control) => { setAuto({ readiness: Number(control.dataset.value) }).catch(() => {}); render(); },
    "sp2-ar-pain": (control) => {
      const value = control.dataset.value || "none";
      setAuto({ pain: value, ...(value === "mild" ? {} : { zone: null }) }).catch(() => {});
      render();
    },
    "sp2-ar-zone": (control) => { setAuto({ zone: control.dataset.value || null }).catch(() => {}); render(); },
    "sp2-ar-rir": (control) => { setAuto({ rir: Number(control.dataset.value) }).catch(() => {}); render(); },
    "sp2-ar-apply": () => guarded(async () => {
      const entry = target();
      if (!entry?.option) return;
      const a = auto();
      let rec = null;
      const edit = await adaptDay(entry.option.key, (workout) => {
        const exercise = core.firstWeighted(workout);
        if (!exercise) return [];
        rec = core.recommend({ readiness: a.readiness ?? null, pain: a.pain || "none", rir: a.rir ?? 2,
          kg: Number(exercise.load?.kg) || 0, sets: Number(exercise.sets) || 1 });
        return rec.canApply ? [{ op: "load", plan_exercise_id: exercise.plan_exercise_id, kg: rec.kg, sets: rec.sets }] : [];
      });
      const applied = { ...edit, kg: rec.kg, sets: rec.sets, kind: rec.kind, title: rec.title, reason: rec.reason };
      await setAuto({ applied });
      toast("План на сегодня обновлён");
    }),
    "sp2-ar-undo": () => guarded(async () => {
      const applied = auto().applied;
      if (!applied?.from_version) { await setAuto({ applied: null }); return; }
      await restoreDay(applied);
      await spUpdate((prev) => dropEditsFrom(prev, applied.optionKey, applied.from_version));
      toast("Вернули как было");
    }),
    "sp2-ar-dayfix": () => guarded(async () => {
      const entry = target(), a = auto();
      if (!entry?.option || a.pain !== "mild" || !a.zone) return;
      if (!(await ensureData())) throw new Error("data_unavailable");
      let plan = null;
      const edit = await adaptDay(entry.option.key, (workout) => {
        plan = core.dayFixOps(workout, a.zone, matrix, catalog);
        return plan.ops;
      }).catch((reason) => {
        if (reason?.message === "no_changes") throw new Error(plan?.empty ? "no_safe_swap" : "nothing_to_fix");
        throw reason;
      });
      const label = core.PAIN_ZONES.find((zone) => zone.id === a.zone)?.label || "Боль";
      await setAuto({ dayFix: { ...edit, zone: a.zone, label, swaps: plan.swaps, drops: plan.drops } });
      toast(`Заменено ${plan.swaps}, убрано ${plan.drops}`);
    }),
    "sp2-ar-dayfix-undo": () => guarded(async () => {
      const fix = auto().dayFix;
      if (!fix?.from_version) return;
      await restoreDay(fix);
      await spUpdate((prev) => dropEditsFrom(prev, fix.optionKey, fix.from_version));
      toast("Вернули тренировку");
    }),
    "sp2-flex-swap-open": () => { ensureData(); spOpen("sp2-swap"); },
    "sp2-flex-warm-open": () => { ensureData(); spOpen("sp2-warmup"); },
    "sp2-flex-swap-slot": (control) => {
      const entry = target();
      if (!entry?.option) return;
      swapPick = { optionKey: entry.option.key, index: Number(control.dataset.index) || 0 };
      render();
    },
    "sp2-flex-swap-pick": (control) => guarded(async () => {
      const entry = swapTarget();
      if (!entry?.option) return;
      spClose();
      const picked = { id: control.dataset.id, name: control.dataset.name, why: control.dataset.why || "" };
      const edit = await adaptDay(entry.option.key, (workout) => {
        const slot = slotFor(workout, entry.exercise, true);
        return slot ? [{ op: "swap", plan_exercise_id: slot.plan_exercise_id, exercise_id: picked.id, why: picked.why }] : [];
      });
      const swap = { ...picked, ...edit };
      await spUpdate((prev) => ({ ...prev, sport2Flex: { ...(prev.sport2Flex || {}), optionKey: edit.optionKey, swap } }));
      toast(`Замена · ${swap.name}`);
    }),
    "sp2-flex-swap-undo": () => guarded(async () => {
      const swap = flex().swap;
      if (!swap?.from_version) { await spUpdate((prev) => ({ ...prev, sport2Flex: { ...(prev.sport2Flex || {}), swap: null } })); return; }
      await restoreDay(swap);
      await spUpdate((prev) => dropEditsFrom(prev, swap.optionKey, swap.from_version));
      toast("Вернули упражнение");
    }),
    "sp2-flex-warm-add": () => guarded(async () => {
      const entry = target();
      if (!entry?.option || !dataReady()) return;
      const warmup = core.warmupFor("strength", matrix, catalog);
      if (!warmup) return;
      spClose();
      const edit = await adaptDay(entry.option.key, () => [{ op: "warmup",
        items: warmup.items.map((item) => ({ exercise_id: item.exercise_id, mode: item.mode === "time" ? "time" : "reps",
          value: Number(item.value) || (item.mode === "time" ? 30 : 10), ...(item.note ? { note: item.note } : {}) })) }]);
      const saved = { ...warmup, ...edit };
      await spUpdate((prev) => ({ ...prev, sport2Flex: { ...(prev.sport2Flex || {}), optionKey: edit.optionKey, warmup: saved } }));
      toast(`Тёплый старт · ${warmup.items.length} движений`);
    }),
    "sp2-flex-warm-remove": () => guarded(async () => {
      const warm = flex().warmup;
      if (!warm?.from_version) { await spUpdate((prev) => ({ ...prev, sport2Flex: { ...(prev.sport2Flex || {}), warmup: null } })); return; }
      await restoreDay(warm);
      await spUpdate((prev) => dropEditsFrom(prev, warm.optionKey, warm.from_version));
      toast("Тёплый старт убран");
    }),
    "sp2-flex-reminder": (control) => {
      const index = Number(control.dataset.index);
      const current = Array.isArray(flex().reminders) ? flex().reminders : [true, true, false];
      spUpdate((prev) => ({ ...prev, sport2Flex: { ...(prev.sport2Flex || {}), reminders: toggleReminder(current, index) } })).catch(() => {});
      render();
    },
    "sp2-close": () => spClose(),
  });

  window.SportExtra = {
    quick, autoregScreen, flexScreen,
    /** Острая боль, отмеченная сегодня, — тренировка не начинается. */
    startBlocked() { try { return auto().pain === "sharp"; } catch { return false; } },
  };
})();
