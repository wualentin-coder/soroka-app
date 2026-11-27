/* Sport 2.0 · каталог упражнений: чистые функции нормализации и фильтров.
   Один источник для экрана библиотеки и Node-проверок. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SportCatalogCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MUSCLES = {
    neck: "Шея", traps: "Трапеция", delts_front: "Передняя дельта", delts_side: "Средняя дельта",
    delts_rear: "Задняя дельта", chest: "Грудь", chest_upper: "Верх груди", chest_mid: "Середина груди",
    chest_lower: "Низ груди", lats: "Широчайшие", mid_back: "Середина спины", lower_back: "Поясница",
    biceps: "Бицепс", triceps: "Трицепс", forearms: "Предплечья", abs: "Пресс", abs_upper: "Верх пресса",
    abs_lower: "Низ пресса", obliques: "Косые живота", glutes: "Ягодицы", quads: "Квадрицепс",
    hamstrings: "Бицепс бедра", adductors: "Приводящие", hip_flexors: "Сгибатели бедра", calves: "Икры",
  };
  const EQUIPMENT = {
    gym: "Зал · блок", bodyweight: "Свой вес", dumbbells: "Гантели", barbell: "Штанга",
    kettlebell: "Гиря", plates: "Диски", band: "Резинка", pullup_bar: "Турник",
    pushup_bars: "Упоры", bench: "Скамья", expander: "Эспандер", powerball: "Повербол",
  };
  const EQUIPMENT_ORDER = ["gym", "dumbbells", "barbell", "kettlebell", "band", "pullup_bar", "pushup_bars", "bench", "bodyweight"];
  const LOAD = { external: "с весом", bodyweight: "свой вес", assisted: "с помощью", time: "на время" };
  const LATERALITY = { bilateral: "две стороны", unilateral: "одна сторона", alternating: "попеременно" };
  const GROUPS = [
    ["Плечи и шея", ["neck", "traps", "delts_front", "delts_side", "delts_rear"]],
    ["Грудь", ["chest", "chest_upper", "chest_mid", "chest_lower"]],
    ["Спина", ["lats", "mid_back", "lower_back"]],
    ["Руки", ["biceps", "triceps", "forearms"]],
    ["Корпус", ["abs", "abs_upper", "abs_lower", "obliques"]],
    ["Ноги", ["glutes", "quads", "hamstrings", "adductors", "hip_flexors", "calves"]],
  ];
  const GROUP_OF = new Map(GROUPS.flatMap(([group, ids]) => ids.map((id) => [id, group])));
  const POSTURE_COLLECTION = [
    "bw_chin_tuck", "bw_thoracic_extension", "bw_wall_slides", "db_one_arm_row",
    "bw_dead_bug", "bw_glute_bridge", "bw_doorway_stretch", "bw_hip_flexor_stretch",
  ];
  const READY_IDS = new Set(["db_one_arm_row", "bw_glute_bridge"]);

  const norm = (value) => String(value ?? "").toLowerCase().replace(/ё/g, "е").trim();

  function groupOf(exercise) {
    const ids = [...(exercise.muscles?.primary || []), ...(exercise.muscles?.secondary || [])];
    for (const id of ids) {
      const group = GROUP_OF.get(id);
      if (group) return group;
    }
    return "Корпус";
  }

  function normalize(seed) {
    // Merged/deprecated exercises stay for history but are not offered (no band, 26.11).
    return (seed?.exercises || []).filter((e) => !e.status || e.status === "active").map((e) => {
      const ru = (e.instructions || []).find((item) => item.lang === "ru");
      const equipment = [...new Set([...(e.equipment?.all_of || []), ...(e.equipment?.any_of || [])])]
        .filter((id) => EQUIPMENT[id])
        .map((id) => ({ id, label: EQUIPMENT[id] }));
      return {
        id: e.id,
        name: e.names?.ru || e.id,
        en: e.names?.en || "",
        aliases: (e.aliases || []).filter((a) => a.lang === "ru").map((a) => a.value),
        group: groupOf(e),
        primary: (e.muscles?.primary || []).map((id) => ({ id, label: MUSCLES[id] || id })),
        secondary: (e.muscles?.secondary || []).map((id) => ({ id, label: MUSCLES[id] || id })),
        equipment,
        load: LOAD[e.load_type] || e.load_type || "",
        measure: e.measure || [],
        laterality: LATERALITY[e.laterality] || e.laterality || "",
        steps: ru ? ru.steps : [],
        stepsStatus: ru ? ru.review_status : "draft",
        errors: (e.common_errors || []).filter((item) => item.lang === "ru").map((item) => item.value),
      };
    });
  }

  function searchMatch(exercise, query) {
    if (!query) return true;
    const hay = [
      exercise.name, exercise.en, ...(exercise.aliases || []),
      ...exercise.primary.map((m) => m.label), ...exercise.secondary.map((m) => m.label),
      ...exercise.equipment.map((e) => e.label), exercise.group, exercise.id,
    ].join(" ").toLowerCase().replace(/ё/g, "е");
    return hay.includes(query);
  }

  function byId(catalog, id) {
    return catalog.find((exercise) => exercise.id === id) || null;
  }

  function filterExercises(catalog, { query = "", group = "Все", equipment = [], collection = null } = {}) {
    const needle = norm(query);
    const selected = new Set(equipment);
    if (collection === "posture") {
      return POSTURE_COLLECTION
        .map((id) => byId(catalog, id))
        .filter(Boolean)
        .filter((exercise) => searchMatch(exercise, needle));
    }
    return catalog.filter((exercise) => {
      if (!searchMatch(exercise, needle)) return false;
      if (group !== "Все" && exercise.group !== group) return false;
      if (selected.size) {
        const ids = new Set(exercise.equipment.map((e) => e.id));
        if (![...selected].some((id) => ids.has(id))) return false;
      }
      return true;
    });
  }

  function equipmentCounts(catalog) {
    return EQUIPMENT_ORDER.map((id) => ({
      id,
      label: EQUIPMENT[id],
      count: catalog.filter((exercise) => exercise.equipment.some((e) => e.id === id)).length,
    })).filter((item) => item.count > 0);
  }

  function plural(n, one, few, many) {
    const mod100 = Math.abs(n) % 100;
    if (mod100 >= 11 && mod100 <= 14) return many;
    const mod10 = mod100 % 10;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
  }

  function countLabel(n) {
    return `${new Intl.NumberFormat("ru-RU").format(n)} ${plural(n, "упражнение", "упражнения", "упражнений")}`;
  }

  return {
    MUSCLES, EQUIPMENT, EQUIPMENT_ORDER, GROUPS, POSTURE_COLLECTION, READY_IDS,
    normalize, groupOf, searchMatch, filterExercises, equipmentCounts, countLabel, plural, norm, byId,
  };
});
