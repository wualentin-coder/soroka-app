/* Sport 2.0 · экран «Библиотека»: 88 упражнений, поиск, группы, инвентарь,
   коллекция осанки. Данные — sport-catalog.json (seed каталога). */
(() => {
  "use strict";
  const core = window.SportCatalogCore;
  if (!core) return;
  const esc = window.esc || ((value) => String(value ?? ""));
  const lib = {
    ready: false, loading: false, error: "", catalog: [], version: 1,
    query: "", group: "Все", collection: null, equipment: new Set(),
    shown: 20, detailId: null, scroll: 0,
  };

  const onLibrary = () => spState().tab === "library";
  const hasFilters = () => Boolean(core.norm(lib.query)) || lib.group !== "Все" || lib.collection === "posture" || lib.equipment.size > 0;
  const rows = () => core.filterExercises(lib.catalog, {
    query: lib.query, group: lib.group, equipment: [...lib.equipment], collection: lib.collection,
  });

  function kitOf(exercise) {
    return exercise.equipment.filter((item) => item.id !== "bodyweight");
  }
  function kitLabel(exercise) {
    const kit = kitOf(exercise);
    return kit.length ? kit.map((item) => item.label).join(" · ") : "Свой вес";
  }
  function eqIcon(exercise) {
    return spEquipIcon(kitOf(exercise)[0]?.id || "bodyweight") || icon("health");
  }
  function countMarkup(list) {
    if (lib.collection === "posture") {
      return core.norm(lib.query)
        ? `Найдено <b>${list.length}</b> из ${core.POSTURE_COLLECTION.length}`
        : `<b>${list.length}</b> упражнений · комплекс осанки`;
    }
    return hasFilters() ? `Найдено <b>${list.length}</b>` : `<b>${lib.catalog.length}</b> ${core.plural(lib.catalog.length, "упражнение", "упражнения", "упражнений")}`;
  }
  function moreMarkup(list) {
    const left = list.length - Math.min(list.length, lib.shown);
    return left > 0 ? `<button type="button" class="sp2-lib-more" data-lib-act="more">Показать ещё · ${left}</button>` : "";
  }
  function activeMarkup() {
    if (!lib.equipment.size) return "";
    return `<div class="sp2-lib-active">${[...lib.equipment].map((id) => {
      const label = core.EQUIPMENT[id] || id;
      return `<span class="sp2-lib-active-chip">${esc(label)}<button type="button" data-lib-act="unfilter" data-id="${esc(id)}" aria-label="Убрать фильтр ${esc(label)}">${icon("close")}</button></span>`;
    }).join("")}</div>`;
  }
  function emptyMarkup() {
    const title = lib.query ? `Ничего по «${esc(lib.query)}»` : "Под фильтры ничего не подошло";
    return `<div class="sp2-lib-empty"><span class="sp2-lib-empty-ico">${icon("search")}</span><h2>${title}</h2>
      <p>${lib.query ? "Проверьте написание или попробуйте другое слово." : "Уберите один из фильтров."}</p>
      ${lib.query ? `<div class="sp2-lib-suggest"><button type="button" data-lib-act="suggest" data-q="жим">жим</button><button type="button" data-lib-act="suggest" data-q="планка">планка</button><button type="button" data-lib-act="suggest" data-q="гантели">гантели</button></div>` : ""}
      <button type="button" class="ghost-button" data-lib-act="reset">Сбросить всё</button></div>`;
  }
  function card(exercise) {
    const ready = core.READY_IDS.has(exercise.id)
      ? `<span class="sp2-lib-ready" title="Готово для комплекса осанки">${icon("eye")}готово</span>` : "";
    const muscles = exercise.primary.slice(0, 2).map((m) => m.label).join(", ");
    return `<button type="button" class="sp2-lib-card" data-lib-act="card" data-id="${esc(exercise.id)}">
      <span class="sp2-lib-thumb">${eqIcon(exercise)}</span>
      <span class="sp2-lib-main"><span class="sp2-lib-name">${esc(exercise.name)}</span>
        <span class="sp2-lib-sub"><span>${esc(muscles)}</span><i class="sp2-lib-sep"></i><span>${esc(kitLabel(exercise))}</span>${ready}</span></span>
      <span class="sp2-lib-chev">${icon("right")}</span></button>`;
  }

  function listInner() {
    if (lib.error) {
      return `<p class="sp2-lib-note" role="alert">Каталог не загрузился. Проверьте связь.</p><button type="button" class="ghost-button" data-lib-act="retry">Повторить</button>`;
    }
    const list = rows();
    const visible = list.slice(0, lib.shown);
    const groups = core.GROUPS.map(([group]) => `<button type="button" class="sp2-lib-chip" data-lib-act="group" data-group="${esc(group)}" aria-pressed="${!lib.collection && lib.group === group}">${esc(group)}</button>`).join("");
    return `<div class="sp2-lib-meta-row"><p class="sp2-lib-meta">${core.countLabel(lib.catalog.length)} · каталог v${lib.version}</p></div>
      <div class="sp2-lib-search"><div class="sp2-lib-field">${icon("search")}
        <input type="search" data-lib-search value="${esc(lib.query)}" placeholder="Упражнение" aria-label="Поиск упражнений" autocomplete="off" enterkeyhint="search">
        <button type="button" class="sp2-lib-clear" data-lib-act="clear" aria-label="Очистить поиск" ${lib.query ? "" : "hidden"}>${icon("close")}</button></div>
        <button type="button" class="sp2-lib-filter" data-lib-act="filter" aria-label="Фильтр по инвентарю" data-active="${lib.equipment.size ? "true" : "false"}">${icon("filter")}<span class="sp2-lib-filter-n" ${lib.equipment.size ? "" : "hidden"}>${lib.equipment.size}</span></button></div>
      <div class="sp2-lib-chips" role="group" aria-label="Фильтр по мышцам">
        <button type="button" class="sp2-lib-chip" data-lib-act="group" data-group="Все" aria-pressed="${!lib.collection && lib.group === "Все"}">Все</button>
        <button type="button" class="sp2-lib-chip sp2-lib-chip-eye" data-lib-act="collection" aria-pressed="${lib.collection === "posture"}">${icon("eye")}Коррекция осанки</button>
        ${groups}</div>
      <div class="sp2-lib-meta-row"><span class="sp2-lib-count" data-lib-count aria-live="polite">${countMarkup(list)}</span>
        <button type="button" class="sp2-lib-reset" data-lib-act="reset" ${hasFilters() ? "" : "hidden"}>Сбросить</button></div>
      <div data-lib-active>${activeMarkup()}</div>
      <div class="sp2-lib-list" data-lib-list>${visible.length ? visible.map(card).join("") : emptyMarkup()}</div>
      <div data-lib-more>${moreMarkup(list)}</div>`;
  }

  function detailInner() {
    const exercise = core.byId(lib.catalog, lib.detailId);
    if (!exercise) return `<div class="sp2-lib-empty"><h2>Упражнение не найдено</h2><button type="button" class="ghost-button" data-lib-act="back">К библиотеке</button></div>`;
    const kit = kitOf(exercise);
    const equipment = (kit.length ? kit : [{ id: "bodyweight", label: "Свой вес" }])
      .map((item) => `<span class="sp2-lib-tag">${item.id === "bodyweight" ? icon("health") : spEquipIcon(item.id) || icon("archive")}${esc(item.label)}</span>`).join("");
    const laterality = exercise.laterality && exercise.laterality !== "две стороны" ? `<span class="sp2-lib-tag">${esc(exercise.laterality)}</span>` : "";
    const primary = exercise.primary.map((m) => `<span class="sp2-lib-muscle primary">${esc(m.label)}</span>`).join("") || `<span class="sp2-lib-muscle">—</span>`;
    const secondary = exercise.secondary.map((m) => `<span class="sp2-lib-muscle">${esc(m.label)}</span>`).join("") || `<span class="sp2-lib-muscle">—</span>`;
    const steps = exercise.steps.length
      ? `<ol class="sp2-lib-steps">${exercise.steps.map((step, index) => `<li><span class="n">${index + 1}</span><p>${esc(step)}</p></li>`).join("")}</ol>`
      : `<p class="sp2-lib-note">Техника для этого упражнения не заполнена.</p>`;
    const errors = exercise.errors.length
      ? `<section class="sp2-lib-sec sp2-lib-errors"><h2>${icon("flag")}Частые ошибки</h2>${exercise.errors.map((error) => `<div>${icon("flag")}<span>${esc(error)}</span></div>`).join("")}</section>` : "";
    return `<div class="sp2-lib-dhead"><button type="button" class="sp2-lib-back" data-lib-act="back" aria-label="Назад к библиотеке">${icon("left")}</button><span class="sp2-lib-kicker">упражнение</span><span></span></div>
      <div class="sp2-lib-media"><span class="sp2-lib-media-badge">${icon("film")}медиа нет</span><div><span class="sp2-lib-media-glyph">${eqIcon(exercise)}</span><b>Видео и фото пока нет</b><span>Техника — текстом ниже</span></div></div>
      <h1 class="sp2-lib-title">${esc(exercise.name)}</h1>
      <div class="sp2-lib-tags">${equipment}<span class="sp2-lib-tag">${esc(exercise.load)}</span><span class="sp2-lib-tag">${exercise.measure.includes("time") ? "на время" : "повторы"}</span>${laterality}${core.READY_IDS.has(exercise.id) ? `<span class="sp2-lib-tag accent">${icon("eye")}готово</span>` : ""}</div>
      <section class="sp2-lib-sec"><h2>${icon("health")}Мышцы</h2><dl class="sp2-lib-muscles"><div><dt>Основные</dt><dd>${primary}</dd></div><div><dt>Дополнительно</dt><dd>${secondary}</dd></div></dl></section>
      <section class="sp2-lib-sec"><h2>${icon("note")}Техника</h2>${steps}${exercise.stepsStatus === "draft" ? `<p class="sp2-lib-draft">Текст техники — черновик каталога, ещё не проверен тренером.</p>` : ""}</section>
      ${errors}
      <footer class="sp2-lib-foot"><span>ID <code>${esc(exercise.id)}</code></span><span>каталог · v${lib.version}</span></footer>`;
  }

  function screen() {
    if (!lib.ready && !lib.error) {
      if (!lib.loading) queueMicrotask(load);
      return `<div class="sp2-lib" data-lib-root><p class="sp2-lib-note" role="status">Загружаем упражнения…</p></div>`;
    }
    return `<div class="sp2-lib" data-lib-root>${lib.detailId ? detailInner() : listInner()}</div>`;
  }

  function paintRoot(focusSearch = false) {
    const root = document.querySelector("[data-lib-root]");
    if (!root || !onLibrary()) return;
    root.innerHTML = lib.detailId ? detailInner() : listInner();
    if (focusSearch) {
      const input = root.querySelector("[data-lib-search]");
      if (input) { input.focus({ preventScroll: true }); input.setSelectionRange(input.value.length, input.value.length); }
    }
  }

  function syncList() {
    const root = document.querySelector("[data-lib-root]");
    if (!root) return;
    const list = rows();
    const visible = list.slice(0, lib.shown);
    const box = root.querySelector("[data-lib-list]");
    if (box) box.innerHTML = visible.length ? visible.map(card).join("") : emptyMarkup();
    const count = root.querySelector("[data-lib-count]");
    if (count) count.innerHTML = countMarkup(list);
    const more = root.querySelector("[data-lib-more]");
    if (more) more.innerHTML = moreMarkup(list);
    const reset = root.querySelector(".sp2-lib-reset");
    if (reset) reset.hidden = !hasFilters();
    const active = root.querySelector("[data-lib-active]");
    if (active) active.innerHTML = activeMarkup();
    const clear = root.querySelector(".sp2-lib-clear");
    if (clear) clear.hidden = !lib.query;
  }

  function openDetail(id) {
    lib.scroll = window.scrollY || 0;
    lib.detailId = id;
    paintRoot();
    window.scrollTo(0, 0);
  }
  function back() {
    lib.detailId = null;
    paintRoot();
    window.scrollTo(0, lib.scroll || 0);
  }
  function reset() {
    lib.query = "";
    lib.group = "Все";
    lib.collection = null;
    lib.equipment = new Set();
    lib.shown = 20;
    lib.detailId = null;
    paintRoot(true);
  }

  async function load() {
    if (lib.loading || lib.ready) return;
    lib.loading = true;
    lib.error = "";
    try {
      const response = await fetch("./sport-catalog.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("catalog_unavailable");
      const seed = await response.json();
      const catalog = core.normalize(seed);
      if (!catalog.length) throw new Error("catalog_empty");
      lib.catalog = catalog;
      lib.version = Number(seed.catalog_version) || 1;
      lib.ready = true;
    } catch (error) {
      lib.error = "catalog";
    } finally {
      lib.loading = false;
    }
    const root = document.querySelector("[data-lib-root]");
    if (root && onLibrary()) root.innerHTML = lib.detailId ? detailInner() : listInner();
  }

  document.addEventListener("input", (event) => {
    if (!event.target.matches("[data-lib-search]")) return;
    lib.query = event.target.value.slice(0, 120);
    lib.shown = 20;
    syncList();
  });
  document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-lib-act]");
    if (!control || !document.querySelector("[data-lib-root]")) return;
    const act = control.dataset.libAct;
    if (act === "card") openDetail(control.dataset.id);
    else if (act === "back") back();
    else if (act === "more") { lib.shown += 20; syncList(); }
    else if (act === "clear") { lib.query = ""; lib.shown = 20; paintRoot(true); }
    else if (act === "suggest") { lib.query = control.dataset.q || ""; lib.shown = 20; paintRoot(true); }
    else if (act === "reset") reset();
    else if (act === "group") { lib.collection = null; lib.group = control.dataset.group || "Все"; lib.shown = 20; paintRoot(); }
    else if (act === "collection") {
      lib.collection = lib.collection === "posture" ? null : "posture";
      lib.group = "Все";
      lib.equipment = new Set();
      lib.shown = 20;
      paintRoot();
    } else if (act === "unfilter") {
      lib.equipment.delete(control.dataset.id);
      lib.shown = 20;
      paintRoot();
    } else if (act === "filter") {
      spOpen("lib-filter");
    } else if (act === "retry") {
      lib.error = "";
      lib.ready = false;
      const root = document.querySelector("[data-lib-root]");
      if (root) root.innerHTML = `<p class="sp2-lib-note" role="status">Загружаем упражнения…</p>`;
      load();
    }
  });

  SP_SHEETS["lib-filter"] = (sheet) => {
    if (!(sheet.draft instanceof Set)) sheet.draft = new Set(lib.equipment);
    const draft = sheet.draft;
    const options = core.equipmentCounts(lib.catalog).map((item) => `<button type="button" data-action="lib-eq-toggle" data-id="${esc(item.id)}" aria-checked="${draft.has(item.id)}"><span class="box">${icon("check")}</span><span>${esc(item.label)}</span><span class="n">${item.count}</span></button>`).join("");
    const found = core.filterExercises(lib.catalog, { query: lib.query, group: lib.group, equipment: [...draft] }).length;
    return {
      title: "Инвентарь",
      body: `<p class="section-note">Можно выбрать несколько</p><div class="sp2-lib-eq">${options}</div>
        <div class="sheet-actions"><button class="ghost-button" type="button" data-action="lib-eq-reset">Сбросить</button><button class="primary-button" type="button" data-action="lib-eq-apply">${found ? `Показать ${found}` : "Ничего нет"}</button></div>`,
    };
  };
  Object.assign(SP_ACTIONS, {
    "sp-2-library": () => {
      const s = spState();
      s.libraryReturn = s.tab;
      s.tab = "library";
      render();
      window.scrollTo(0, 0);
    },
    "lib-eq-toggle": (control) => {
      const sheet = spState().sheet;
      if (!sheet || sheet.kind !== "lib-filter") return;
      if (!(sheet.draft instanceof Set)) sheet.draft = new Set(lib.equipment);
      const id = control.dataset.id;
      if (sheet.draft.has(id)) sheet.draft.delete(id); else sheet.draft.add(id);
      render();
    },
    "lib-eq-reset": () => {
      const sheet = spState().sheet;
      if (sheet) sheet.draft = new Set();
      render();
    },
    "lib-eq-apply": () => {
      const sheet = spState().sheet;
      if (!sheet) return;
      lib.equipment = new Set(sheet.draft instanceof Set ? sheet.draft : []);
      lib.collection = null;
      lib.shown = 20;
      spClose();
    },
  });

  window.SportCatalogUI = { screen, open: () => SP_ACTIONS["sp-2-library"](), reset };
})();
