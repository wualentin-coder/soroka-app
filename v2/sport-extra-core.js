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
    knee: [/выпад/i, /прыж/i, /бег/i],
  };
  const REMINDERS = [
    { id: "before", name: "За 2 часа до тренировки", sub: "Вечером, если тренировка запланирована" },
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

  function limitBlocked(name, limits = []) {
    const text = String(name || "");
    return limits.some((limit) => (LIMIT_BLOCK[limit] || []).some((pattern) => pattern.test(text)));
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
    for (const block of snapshot?.workout?.blocks || []) {
      if (!["main", "splits"].includes(block.type)) continue;
      for (const exercise of block.exercises || []) {
        const kg = Number(exercise.load?.kg ?? exercise.weight_kg ?? 0);
        if (kg > 0) return exercise;
      }
    }
    return null;
  }

  function warmupBlock(warmup, catalog) {
    return {
      type: "warmup", title: "Тёплый старт", order_policy: "fixed",
      exercises: warmup.items.map((item) => {
        const exercise = byId(catalog, item.exercise_id);
        const timed = item.mode === "time";
        return {
          plan_exercise_id: `warmup-${item.exercise_id}`,
          exercise_id: item.exercise_id,
          name: exercise?.name || item.exercise_id,
          sets: 1,
          mode: timed ? "timed" : "reps",
          ...(timed ? { work_seconds: Number(item.value) || 30 } : { reps: String(item.value || 10), execution_seconds: 30 }),
          rest_seconds: 15,
          load: null, bodyweight: true, priority: null,
          technique: item.note || "Спокойно, без боли и онемения.",
          muscles: exercise?.muscles || { primary: [], secondary: [] },
        };
      }),
    };
  }

  function adjustSnapshot(snapshot, addons = {}, catalog = []) {
    if (!snapshot?.workout || !Array.isArray(snapshot.workout.blocks)) return null;
    const copy = JSON.parse(JSON.stringify(snapshot));
    let changed = false;
    const auto = addons.autoload;
    if (auto && Number(auto.kg) > 0) {
      const exercise = firstWeighted(copy);
      if (exercise) {
        if (exercise.load) exercise.load = { ...exercise.load, kg: Number(auto.kg) };
        if (exercise.weight_kg != null) exercise.weight_kg = Number(auto.kg);
        if (Number(auto.sets) > 0) exercise.sets = Number(auto.sets);
        changed = true;
      }
    }
    const swap = addons.swap;
    if (swap?.slot) {
      for (const block of copy.workout.blocks) for (const exercise of block.exercises || []) {
        if (exercise.plan_exercise_id !== swap.slot) continue;
        const target = byId(catalog, swap.id);
        if (!target) continue;
        exercise.exercise_id = target.id;
        exercise.name = target.name;
        exercise.muscles = target.muscles;
        exercise.technique = [exercise.technique, swap.why].filter(Boolean).join(" ");
        changed = true;
      }
    }
    const warmup = addons.warmup;
    if (warmup?.items?.length && !copy.workout.blocks.some((block) => block.title === "Тёплый старт")) {
      copy.workout.blocks.unshift(warmupBlock(warmup, catalog));
      changed = true;
    }
    return changed ? copy : null;
  }

  return {
    LIMIT_BLOCK, REMINDERS, roundHalf, recommend, limitBlocked, alternativesFor, warmupFor,
    exerciseIdForName, firstWeighted, adjustSnapshot,
  };
});
