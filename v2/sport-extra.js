/* Sport 2.0 · E13 «Готовность» и E14 «Гибкость»: экраны, листы, состояние.
   Замены и тёплый старт берутся только из sport/catalog/substitutions.json. */
(() => {
  "use strict";
  const core = window.SportExtraCore;
  const catalogCore = window.SportCatalogCore;
  if (!core || !catalogCore) return;
  const esc = window.esc || ((value) => String(value ?? ""));
  const C = () => window.SportCore;
  const state = () => spState().state;
  const auto = () => state().sport2Autoreg || {};
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
        ${a.pain === "sharp" ? `<div class="sp2-ex-alert" role="alert">${icon("flag")}<span>Автоподбор и рекорды заблокированы. Острая боль — повод отдохнуть.</span></div>` : ""}
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
    const f = flex(), entry = target(), limits = C().readSport2Profile(state().sport2Profile).limits;
    const swapped = f.swap;
    const warm = f.warmup;
    const reminders = Array.isArray(f.reminders) ? f.reminders : [true, true, false];
    const on = reminders.filter(Boolean).length;
    return `<section class="sp2-ex">
      <section class="sp2-ex-card"><div class="sp2-ex-head"><h2>Замена упражнения</h2><span class="sp2-ex-pill ${limits.length ? "warn" : ""}">${limits.length ? "ограничения" : "замены"}</span></div>
        <div class="sp2-ex-now"><span>Сейчас</span><b>${esc(entry?.exercise?.name || "Нет упражнения")}</b><small>${entry?.exercise ? `${currentKg(entry.exercise) > 0 ? `${currentKg(entry.exercise)} кг` : "свой вес"} · ${currentSets(entry.exercise)} подхода` : ""}</small></div>
        ${swapped ? `<div class="sp2-ex-ok">${icon("check")}<div><b>${esc(swapped.name)}</b><span>${esc(swapped.why || "замена из матрицы")}</span></div><button type="button" class="text-action" data-action="sp2-flex-swap-undo">Вернуть</button></div>` : ""}
        <button class="ghost-button sp2-ex-wide" type="button" data-action="sp2-flex-swap-open">${icon("reset")}${swapped ? "Другая замена" : "Подобрать замену"}</button>
        <p class="sp2-ex-note">Замена меняет только сегодняшнюю тренировку; снимок плана не трогаем.</p>
      </section>
      <section class="sp2-ex-card"><div class="sp2-ex-head"><h2>Тёплый старт</h2><span class="sp2-ex-pill">${warm ? `${warm.items.length} движений` : "из матрицы"}</span></div>
        ${warm ? `<div class="sp2-ex-warm">${warm.items.map((item) => `<span>${esc(item.name)} · ${item.mode === "time" ? `${item.value} с` : `${item.value}`}</span>`).join("")}</div><div class="sp2-ex-ok">${icon("check")}Добавлено в начало <button type="button" class="text-action" data-action="sp2-flex-warm-remove">Убрать</button></div>`
          : `<p class="sp2-ex-note">Тёплый старт из матрицы: общая разминка и те же паттерны по одному подходу.</p><button class="primary-button sp2-ex-wide" type="button" data-action="sp2-flex-warm-open">Добавить в начало</button>`}
      </section>
      <section class="sp2-ex-card"><div class="sp2-ex-head"><h2>Напоминания</h2><span class="sp2-ex-pill ${on === 0 ? "warn" : ""}">${on} из 3</span></div>
        <div class="sp2-ex-reminders">${core.REMINDERS.map((reminder, index) => `<div class="sp2-ex-reminder"><span><b>${esc(reminder.name)}</b><small>${esc(reminder.sub)}</small></span><button class="sp2-ex-switch" type="button" role="switch" data-action="sp2-flex-reminder" data-index="${index}" aria-checked="${Boolean(reminders[index])}" aria-label="${esc(reminder.name)}"><i></i></button></div>`).join("")}</div>
        <p class="sp2-ex-note">${on ? "Сохранено. Время и канал — в настройках уведомлений." : "Напоминания выключены."}</p>
      </section>
      <p class="sp2-ex-note">Замена и тёплый старт не меняют снимок плана; настройки напоминаний не отправляют push сами.</p>
    </section>`;
  }

  function alternativesSheet(sheet) {
    const entry = target();
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
    "sp2-ar-ready": (control) => {
      const value = Number(control.dataset.value);
      spUpdate((prev) => ({ ...prev, sport2Autoreg: { ...(prev.sport2Autoreg || {}), readiness: value, applied: null } })).catch(() => {});
      render();
    },
    "sp2-ar-pain": (control) => {
      const value = control.dataset.value || "none";
      spUpdate((prev) => ({ ...prev, sport2Autoreg: { ...(prev.sport2Autoreg || {}), pain: value, applied: null } })).catch(() => {});
      render();
    },
    "sp2-ar-rir": (control) => {
      const value = Number(control.dataset.value);
      spUpdate((prev) => ({ ...prev, sport2Autoreg: { ...(prev.sport2Autoreg || {}), rir: value, applied: null } })).catch(() => {});
      render();
    },
    "sp2-ar-apply": () => {
      const entry = target();
      if (!entry?.option) return;
      const rec = recFor(entry);
      if (!rec.canApply) return;
      const applied = { optionKey: entry.option.key, date: entry.option.date, kg: rec.kg, sets: rec.sets,
        kind: rec.kind, title: rec.title, reason: rec.reason };
      spUpdate((prev) => ({ ...prev, sport2Autoreg: { ...(prev.sport2Autoreg || {}), applied } }))
        .then(() => toast("План на сегодня обновлён")).catch(() => toast("Не сохранилось — проверьте связь"));
      render();
    },
    "sp2-ar-undo": () => {
      spUpdate((prev) => ({ ...prev, sport2Autoreg: { ...(prev.sport2Autoreg || {}), applied: null } })).catch(() => {});
      render();
    },
    "sp2-flex-swap-open": () => { ensureData(); spOpen("sp2-swap"); },
    "sp2-flex-warm-open": () => { ensureData(); spOpen("sp2-warmup"); },
    "sp2-flex-swap-pick": (control) => {
      const entry = target();
      if (!entry?.option) return;
      const swap = { optionKey: entry.option.key, date: entry.option.date, slot: entry.exercise?.id || null,
        id: control.dataset.id, name: control.dataset.name, why: control.dataset.why || "" };
      spUpdate((prev) => ({ ...prev, sport2Flex: { ...(prev.sport2Flex || {}), ...swap } }))
        .then(() => toast(`Замена · ${swap.name}`)).catch(() => toast("Не сохранилось — проверьте связь"));
      spClose();
    },
    "sp2-flex-swap-undo": () => {
      spUpdate((prev) => ({ ...prev, sport2Flex: { swap: null } })).catch(() => {});
      render();
    },
    "sp2-flex-warm-add": () => {
      const entry = target();
      if (!entry?.option || !dataReady()) return;
      const warmup = core.warmupFor("strength", matrix, catalog);
      if (!warmup) return;
      spUpdate((prev) => ({ ...prev, sport2Flex: { ...(prev.sport2Flex || {}), optionKey: entry.option.key, date: entry.option.date, warmup } }))
        .then(() => toast(`Тёплый старт · ${warmup.items.length} движений`)).catch(() => toast("Не сохранилось — проверьте связь"));
      spClose();
    },
    "sp2-flex-warm-remove": () => {
      spUpdate((prev) => ({ ...prev, sport2Flex: { ...(prev.sport2Flex || {}), warmup: null } })).catch(() => {});
      render();
    },
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
    adjustPlan(key, snapshot) {
      const s = state();
      const autoload = s.sport2Autoreg?.applied?.optionKey === key ? s.sport2Autoreg.applied : null;
      const flexState = s.sport2Flex?.optionKey === key ? s.sport2Flex : null;
      return core.adjustSnapshot(snapshot, { autoload, swap: flexState?.swap || null, warmup: flexState?.warmup || null }, catalog || []);
    },
  };
})();
