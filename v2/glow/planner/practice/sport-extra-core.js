/* Sport 2.0 · E13 авторегуляция и E14 гибкость: чистые правила.
   Источник замен/тёплого старта — sport/catalog/substitutions.json. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SportExtraCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LIMIT_BLOCK = {
    shoulder: [/жим[^,.;]{0,24}(сидя|над головой|стоя)/i, /арнольд/i, /тяга к лицу/i, /face pull/i],
    back: [/станов(ая|ую|ой)/i, /наклон[^,.;]{0,24}(штанг|гантел)/i, /good morning/i, /румынск[^,.;]{0,12}тяга/i],
    knee: [/выпад/i, /прыж/i, /бег/i, /присед/i, /сплит/i, /зашагив/i, /жим ног/i, /разгибани[ея] ног/i,
      /на одной ноге/i, /squat/i, /lunge/i, /step_?up/i, /jump/i, /leg_press/i, /leg_extension/i, /single_leg/i],
  };
  const PAIN_ZONES = [
    { id: "knee", label: "Колено" },
    { id: "shoulder", label: "Плечо" },
    { id: "back", label: "Поясница" },
  ];
  const REMINDERS = [
    { id: "before", name: "В день тренировки", sub: "Если тренировка по плану ещё не сделана" },
    { id: "inactive", name: "Если 2 дня без тренировок", sub: "Мягкое напоминание, без давления" },
    { id: "rest", name: "В день отдыха", sub: "Короткая подсказка про сон и движение" },
  ];

  const roundHalf = (value) => Math.round(value * 2) / 2;

  function recommend({ readiness = null, pain = "none", rir = 2, kg = 0, sets = 1 } = {}) {
    const current = Number(kg) || 0;
    const currentSets = Math.max(1, Number(sets) || 1);
    if (pain === "sharp") {
      return { kind: "stop", canApply: false, stop: true, kg: current, sets: currentSets,
        title: "Стоп · отдых", reason: "Острая боль", note: "Тренировку не начинай. При боли и онемении — к врачу." };
    }
    if (!readiness) {
      return { kind: "none", canApply: false, kg: current, sets: currentSets,
        title: "Нет оценки", reason: "Готовность не отмечена", note: "Отметь самочувствие или оставь план как есть." };
    }
    if (rir === 0) {
      return { kind: "hold", canApply: false, kg: current, sets: currentSets,
        title: "Без повышения", reason: "RIR 0 · прошлый подход на пределе", note: "Рост и рекорд заблокированы." };
    }
    if (readiness <= 2 || pain === "mild") {
      const next = current > 0 ? Math.max(0.5, roundHalf(current * 0.9)) : 0;
      return { kind: "down", canApply: current > 0, kg: next, sets: Math.max(1, currentSets - 1),
        title: "Снижение −10%", reason: pain === "mild" ? `Готовность ${readiness}/5 · боль ноет` : `Готовность ${readiness}/5`,
        note: current > 0 ? "Вес ниже, один подход снят. Без работы до отказа." : "Упражнение без веса — подходы не меняем." };
    }
    if (readiness >= 4 && rir >= 2) {
      return { kind: "up", canApply: current > 0, kg: current > 0 ? current + 2 : 0, sets: currentSets,
        title: "Повышение +2 кг", reason: `Готовность ${readiness}/5 · RIR ${rir}`, note: "Только при отсутствии боли." };
    }
    return { kind: "keep", canApply: false, kg: current, sets: currentSets,
      title: "Без изменений", reason: `Готовность ${readiness}/5 · RIR ${rir}`, note: "План остаётся прежним." };
  }

  function limitBlocked(name, limits = [], id = "") {
    const text = `${String(name || "")} ${String(id || "")}`;
    return limits.some((limit) => (LIMIT_BLOCK[limit] || []).some((pattern) => pattern.test(text)));
  }

  /**
   * «Болит колено — замени на сегодня»: для каждого упражнения тренировки,
   * которое грузит больную зону, берём лучшую замену из матрицы, которая
   * зону не грузит и ещё не стоит в этой тренировке; если такой нет —
   * упражнение исключается. Возвращает операции для adapt_workout.
   */
  const ids = (list) => (list || []).map((item) => (typeof item === "string" ? item : item?.id)).filter(Boolean);

  /** Запасной вариант, когда в матрице нет безопасной замены: упражнение
   *  каталога на те же мышцы, с тем же инвентарём, что уже есть в тренировке. */
  function muscleFallback(source, zone, catalog, present, equipment) {
    const primary = new Set(ids(source?.primary)), secondary = new Set(ids(source?.secondary));
    if (!primary.size) return null;
    let best = null;
    for (const item of catalog) {
      if (present.has(item.id) || limitBlocked(item.name, [zone], item.id)) continue;
      if (!(item.measure || []).includes("reps")) continue;
      if (!ids(item.equipment).every((id) => equipment.has(id))) continue;
      const own = ids(item.primary), extra = ids(item.secondary);
      const score = own.filter((id) => primary.has(id)).length * 3 + own.filter((id) => secondary.has(id)).length
        + extra.filter((id) => primary.has(id)).length + (item.group && item.group === source.group ? 1 : 0);
      if (score >= 3 && (!best || score > best.score)) best = { id: item.id, score, why: "те же мышцы без нагрузки на зону" };
    }
    return best;
  }

  function dayFixOps(workout, zone, matrix, catalog) {
    if (!workout?.blocks || !LIMIT_BLOCK[zone]) return { ops: [], swaps: 0, drops: 0 };
    const all = workout.blocks.flatMap((block) => block.exercises || []);
    const present = new Set(all.map((exercise) => exercise.exercise_id).filter(Boolean));
    const equipment = new Set(["bodyweight", ...all.flatMap((exercise) => ids(byId(catalog, exercise.exercise_id)?.equipment))]);
    const label = PAIN_ZONES.find((item) => item.id === zone)?.label || "Боль";
    const ops = [];
    let swaps = 0, drops = 0;
    // Сначала основная работа, потом разминка: разминку не заменяем силовым, а убираем.
    const order = workout.blocks.flatMap((block) => (block.exercises || []).map((exercise) => ({ exercise, warmup: block.type === "warmup" })))
      .sort((a, b) => Number(a.warmup) - Number(b.warmup));
    for (const { exercise, warmup } of order) {
      if (!limitBlocked(exercise.name, [zone], exercise.exercise_id)) continue;
      const choice = warmup ? null : (matrix?.exercises?.find((item) => item.id === exercise.exercise_id)?.alternatives || [])
        .filter((alternative) => alternative.canonical && !present.has(alternative.id))
        .map((alternative) => ({ ...alternative, exercise: byId(catalog, alternative.id) }))
        .filter((alternative) => alternative.exercise && !limitBlocked(alternative.exercise.name, [zone], alternative.id))
        .sort((a, b) => b.score - a.score)[0]
        || muscleFallback(byId(catalog, exercise.exercise_id), zone, catalog, present, equipment);
      if (choice) {
        present.add(choice.id);
        ops.push({ op: "swap", plan_exercise_id: exercise.plan_exercise_id, exercise_id: choice.id,
          why: `${label}: ${choice.why || "без нагрузки на зону"}`.slice(0, 300) });
        swaps++;
      } else {
        ops.push({ op: "drop", plan_exercise_id: exercise.plan_exercise_id });
        drops++;
      }
    }
    // Нельзя выбросить всё: тогда честно говорим, что замен нет.
    if (all.length && drops === all.length) return { ops: [], swaps: 0, drops: 0, empty: true };
    return { ops, swaps, drops };
  }

  const byId = (catalog, id) => catalog.find((item) => item.id === id) || null;

  function alternativesFor(exerciseId, matrix, catalog, limits = []) {
    const entry = matrix?.exercises?.find((item) => item.id === exerciseId);
    if (!entry) return [];
    return entry.alternatives
      .filter((alternative) => alternative.canonical)
      .slice()
      .sort((a, b) => b.score - a.score)
      .map((alternative) => {
        const exercise = byId(catalog, alternative.id);
        return {
          id: alternative.id,
          name: exercise?.name || alternative.id,
          score: alternative.score,
          why: alternative.why || "",
          equipment: alternative.equipment || [],
          laterality_fit: alternative.laterality_fit,
          blocked: limitBlocked(exercise?.name || "", limits),
        };
      })
      .slice(0, 5);
  }

  function warmupFor(kind, matrix, catalog) {
    const warmup = matrix?.warmups?.[kind] || matrix?.warmups?.strength;
    if (!warmup) return null;
    return {
      id: warmup.id, title: warmup.title, duration_min: warmup.duration_min, note: warmup.note || "",
      items: warmup.items.map((item) => ({
        ...item, name: byId(catalog, item.exercise_id)?.name || item.exercise_id,
      })),
    };
  }

  function exerciseIdForName(name, catalog) {
    const needle = String(name || "").toLowerCase().replace(/ё/g, "е").trim();
    if (!needle) return null;
    const exact = catalog.find((item) => item.name.toLowerCase().replace(/ё/g, "е").trim() === needle);
    if (exact) return exact.id;
    const alias = catalog.find((item) => (item.aliases || []).some((value) => value.toLowerCase().replace(/ё/g, "е").trim() === needle));
    return alias ? alias.id : null;
  }

  function firstWeighted(snapshot) {
    for (const block of (snapshot?.workout || snapshot)?.blocks || []) {
      if (!["main", "splits"].includes(block.type)) continue;
      for (const exercise of block.exercises || []) {
        const kg = Number(exercise.load?.kg ?? exercise.weight_kg ?? 0);
        if (kg > 0) return exercise;
      }
    }
    return null;
  }

  return {
    LIMIT_BLOCK, PAIN_ZONES, REMINDERS, roundHalf, recommend, limitBlocked, alternativesFor, warmupFor,
    exerciseIdForName, firstWeighted, dayFixOps,
  };
});
