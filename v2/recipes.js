/*
 * Рецепты: карточка с картинкой, сложностью и временем; «Начать готовить» —
 * экран на весь телефон, шаг за шагом, с таймерами; «Что приготовить» —
 * подбор по времени, сложности, типу блюда и продуктам, что есть дома.
 *
 * Шаги для готовки сервер готовит заранее (recipe-cook.ts): короткие
 * действия, ингредиенты к каждому и таймер, если в шаге есть время. Пока их нет —
 * берём обычные шаги, а время ищем в тексте («10 минут»).
 */

const MEAL_NAMES = { завтрак: "Завтрак", обед: "Обед", ужин: "Ужин", перекус: "Перекус", десерт: "Десерт", напиток: "Напиток", выпечка: "Выпечка", салат: "Салат", суп: "Суп", соус: "Соус" };
const DIFFICULTY_DOTS = { легко: 1, средне: 2, сложно: 3 };

/** Картинка блюда; нет — тёплый градиент с первой буквой. */
function recipeImage(item, size = "card") {
  const hue = [...String(item.title || "")].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 50 + 10;
  return item.image
    ? `<span class="recipe-image ${size}"><img src="${esc(item.image)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('blank');this.remove()"></span>`
    : `<span class="recipe-image ${size} blank" style="--h:${hue}"><b>${esc(String(item.title || "?").trim().charAt(0).toUpperCase())}</b></span>`;
}

function difficultyMark(level) {
  const n = DIFFICULTY_DOTS[level] || 0;
  return n ? `<span class="recipe-difficulty" title="Сложность: ${esc(level)}">${[1, 2, 3].map(i => `<i class="${i <= n ? "on" : ""}"></i>`).join("")}${esc(level)}</span>` : "";
}

function recipeFacts(item) {
  return [item.minutes ? `<span>${icon("clock", "icon-sm")}${esc(item.minutes)} мин</span>` : "", difficultyMark(item.difficulty), (item.ingredients || []).length ? `<span>${(item.ingredients || []).length} ингр.</span>` : ""].filter(Boolean).join("");
}

function recipeCard(item) {
  return `<button class="record-card recipe-card" type="button" data-action="saved-open" data-category="recipes" data-id="${esc(item.id)}">${recipeImage(item)}<span class="recipe-card-body">${item.meal ? `<span class="recipe-card-kicker">${esc(MEAL_NAMES[item.meal] || item.meal)}</span>` : ""}<span class="recipe-card-title">${esc(item.title)}</span><span class="recipe-card-facts">${recipeFacts(item)}</span></span>${item.viewed ? `<span class="recipe-cooked" title="Готовили">${icon("check", "icon-sm")}</span>` : ""}</button>`;
}

/** Шапка карточки рецепта: картинка, факты и главная кнопка. */
function recipeHero(item) {
  const steps = cookSteps(item);
  return `<div class="recipe-hero">${recipeImage(item, "hero")}<div class="recipe-hero-facts">${item.meal ? `<span class="recipe-card-kicker">${esc(MEAL_NAMES[item.meal] || item.meal)}</span>` : ""}<div class="recipe-card-facts">${recipeFacts(item)}</div></div>${steps.length ? `<button type="button" class="primary-button recipe-start" data-action="cook-start">${icon("play", "icon-sm")}Начать готовить</button>` : ""}</div>`;
}

// ------------------------------------------------------------ шаги для готовки

/** Время в тексте шага: «10 минут», «1,5 часа», «30 сек» → секунды (берём наибольшее). */
function timerFromText(text) {
  let best = 0;
  for (const m of String(text).matchAll(/(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*(\d+(?:[.,]\d+)?))?\s*(час|ч\b|мин|сек)/gi)) {
    const n = Number((m[2] || m[1]).replace(",", "."));
    const unit = m[3].toLowerCase();
    const sec = unit.startsWith("ч") ? n * 3600 : unit.startsWith("м") ? n * 60 : n;
    if (sec > best) best = sec;
  }
  return best >= 10 ? Math.round(best) : null;
}

function cookSteps(item) {
  if (Array.isArray(item.cook) && item.cook.length) return item.cook.map(s => ({ text: String(s.text || ""), timer: Number(s.timer) || null, uses: Array.isArray(s.uses) ? s.uses : [] }));
  return (item.steps || []).filter(s => s && !/^не указан/i.test(s.trim())).map(text => ({ text, timer: timerFromText(text), uses: [] }));
}

// ------------------------------------------------------------ режим готовки

const cookTimers = new Map(); // шаг → { total, end, left, running }
let cookTick = null;
let cookWake = null;

const clock = sec => { const s = Math.max(0, Math.round(sec)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`; };

function timerLeft(t) { return t.running ? (t.end - Date.now()) / 1000 : t.left; }

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, .35, .7].forEach(at => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(.25, ctx.currentTime + at); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + at + .3); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + .3); });
  } catch (_) {}
  try { navigator.vibrate?.([300, 150, 300, 150, 300]); } catch (_) {}
  try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success"); } catch (_) {}
}

/** Раз в секунду — только цифры на экране, без перерисовки. */
function runCookTick() {
  clearInterval(cookTick);
  cookTick = setInterval(() => {
    if (ui.sheet?.kind !== "cook") { clearInterval(cookTick); return; }
    for (const [step, t] of cookTimers) {
      const left = timerLeft(t);
      if (t.running && left <= 0) { t.running = false; t.left = 0; t.done = true; beep(); toast(`Таймер шага ${step + 1} — готово`); render(); return; }
      document.querySelectorAll(`[data-timer-step="${step}"] .cook-time`).forEach(node => { node.textContent = clock(left); });
      document.querySelectorAll(`[data-timer-step="${step}"]`).forEach(node => node.style.setProperty("--p", String(1 - Math.max(0, left) / t.total)));
    }
  }, 500);
}

async function keepAwake(on) {
  try {
    if (on && !cookWake && navigator.wakeLock) cookWake = await navigator.wakeLock.request("screen");
    if (!on && cookWake) { await cookWake.release(); cookWake = null; }
  } catch (_) {}
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && ui.sheet?.kind === "cook") { cookWake = null; void keepAwake(true); } });

function renderCookSheet() {
  const item = savedItem("recipes", ui.sheet.id);
  if (!item) return "";
  const steps = cookSteps(item);
  const index = ui.sheet.step; // -1 — ингредиенты, steps.length — финал
  const total = steps.length;
  const dots = `<div class="cook-dots">${[-1, ...steps.map((_, i) => i)].map(i => `<i class="${i === index ? "on" : i < index ? "past" : ""}"></i>`).join("")}</div>`;
  const portions = recipePortions(item);
  const factor = portions / Math.max(1, Number(item.servings) || 1);
  let body;
  if (index < 0) {
    const have = ui.sheet.have || {};
    body = `<div class="cook-slide cook-prep"><p class="cook-kicker">Подготовьте · ${portions} порц.</p><h2>${esc(item.title)}</h2><ul class="cook-ingredients">${(item.ingredients || []).map((ing, i) => `<li><button type="button" class="${have[i] ? "done" : ""}" data-action="cook-have" data-index="${i}"><i></i><span>${esc(recipeIngredientLine(ing, factor))}</span></button></li>`).join("")}</ul></div>`;
  } else if (index >= total) {
    body = `<div class="cook-slide cook-finish">${icon("check")}<h2>Готово!</h2><p>Приятного аппетита. Отметить, что готовили?</p><button type="button" class="primary-button" data-action="cook-done">Готовил — отметить</button></div>`;
  } else {
    const step = steps[index];
    const t = cookTimers.get(index);
    const timer = step.timer ? `<button type="button" class="cook-timer ${t?.running ? "running" : ""} ${t?.done ? "done" : ""}" data-action="cook-timer" data-index="${index}" data-timer-step="${index}" style="--p:${t ? 1 - Math.max(0, timerLeft(t)) / t.total : 0}"><span class="cook-ring"></span><span class="cook-time">${clock(t ? timerLeft(t) : step.timer)}</span><small>${t?.done ? "Готово" : t?.running ? "Пауза" : t ? "Дальше" : "Запустить таймер"}</small></button>` : "";
    body = `<div class="cook-slide"><p class="cook-kicker">Шаг ${index + 1} из ${total}</p><p class="cook-text">${esc(step.text)}</p>${step.uses.length ? `<div class="cook-uses">${step.uses.map(u => `<span>${esc(u)}</span>`).join("")}</div>` : ""}${timer}</div>`;
  }
  // Идущие таймеры других шагов — полоской сверху: на них можно перейти.
  const others = [...cookTimers].filter(([i, t]) => i !== index && (t.running || t.done)).map(([i, t]) => `<button type="button" class="cook-chip ${t.done ? "done" : ""}" data-action="cook-go" data-index="${i}" data-timer-step="${i}">${icon("clock", "icon-sm")}Шаг ${i + 1} · <span class="cook-time">${t.done ? "готово" : clock(timerLeft(t))}</span></button>`).join("");
  return `<div class="cook-screen" role="dialog" aria-modal="true" aria-label="Готовим: ${esc(item.title)}">
    <header class="cook-top"><button type="button" class="icon-button" data-action="cook-close" aria-label="Закрыть">${icon("close")}</button><span>${esc(item.title)}</span></header>
    ${dots}${others ? `<div class="cook-chips">${others}</div>` : ""}
    <main class="cook-stage">${body}</main>
    <footer class="cook-nav"><button type="button" class="ghost-button" data-action="cook-prev" ${index < 0 ? "disabled" : ""}>${icon("left", "icon-sm")}Назад</button>${index < total ? `<button type="button" class="primary-button" data-action="cook-next">${index < 0 ? "Начать" : index === total - 1 ? "Последний шаг" : "Дальше"}${icon("right", "icon-sm")}</button>` : ""}</footer>
  </div>`;
}

function cookGo(next) {
  const item = savedItem("recipes", ui.sheet.id);
  const total = cookSteps(item).length;
  const to = Math.max(-1, Math.min(total, next));
  if (to === ui.sheet.step) return;
  const dir = to > ui.sheet.step ? 1 : -1;
  ui.sheet.step = to;
  render();
  document.querySelector(".cook-slide")?.animate([{ opacity: 0, transform: `translateX(${dir * 48}px)` }, { opacity: 1, transform: "none" }], { duration: 280, easing: "cubic-bezier(.2,.8,.3,1)" });
}

function recipeAction(action, control) {
  if (action === "cook-start" && ui.sheet?.kind === "saved") {
    const id = ui.sheet.id;
    cookTimers.clear();
    ui.sheet = { kind: "cook", id, step: -1, have: {}, back: { kind: "saved", category: "recipes", id, mode: "view", justRendered: true } };
    render(); runCookTick(); void keepAwake(true);
    return true;
  }
  if (ui.sheet?.kind !== "cook") {
    if (action === "recipe-surprise") { const pool = whatToCook(); if (!pool.length) { toast("Под фильтры ничего нет"); return true; } const pick = pool[Math.floor(Math.random() * pool.length)]; openSavedRecord("recipes", pick.id); return true; }
    if (action === "cook-web") { void findCookWeb(); return true; }
    if (action === "cook-web-save") { saveWebRecipe(Number(control.dataset.index)); return true; }
    if (action === "cook-filter") { const f = cookFilter(); const key = control.dataset.key, value = control.dataset.value; f[key] = f[key] === value ? "" : value; render(); return true; }
    return false;
  }
  if (action === "cook-close") { const back = ui.sheet.back; clearInterval(cookTick); void keepAwake(false); ui.sheet = back; render(); return true; }
  if (action === "cook-next") { cookGo(ui.sheet.step + 1); return true; }
  if (action === "cook-prev") { cookGo(ui.sheet.step - 1); return true; }
  if (action === "cook-go") { cookGo(Number(control.dataset.index)); return true; }
  if (action === "cook-have") { const i = control.dataset.index; ui.sheet.have[i] = !ui.sheet.have[i]; render(); return true; }
  if (action === "cook-timer") {
    const index = Number(control.dataset.index);
    const step = cookSteps(savedItem("recipes", ui.sheet.id))[index];
    const t = cookTimers.get(index);
    if (!t || t.done) cookTimers.set(index, { total: step.timer, end: Date.now() + step.timer * 1000, left: step.timer, running: true });
    else if (t.running) { t.left = timerLeft(t); t.running = false; }
    else { t.end = Date.now() + t.left * 1000; t.running = true; }
    render(); return true;
  }
  if (action === "cook-done") {
    const item = savedItem("recipes", ui.sheet.id);
    if (item) { item.viewed = true; save(); }
    clearInterval(cookTick); void keepAwake(false);
    ui.sheet = null; render(); toast("Отметил: готовили");
    return true;
  }
  return false;
}

// Свайп по шагу — следующий/предыдущий.
(function cookSwipe() {
  let start = null;
  document.addEventListener("pointerdown", event => { if (event.target.closest?.(".cook-stage")) start = { x: event.clientX, y: event.clientY }; });
  document.addEventListener("pointerup", event => {
    if (!start || ui.sheet?.kind !== "cook") { start = null; return; }
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) cookGo(ui.sheet.step + (dx < 0 ? 1 : -1));
  });
})();

// ------------------------------------------------------------ «Что приготовить»

function cookFilter() {
  if (!ui.cookFilter) ui.cookFilter = { time: "", difficulty: "", meal: "", have: "" };
  return ui.cookFilter;
}

/** Рецепты под фильтры; продукты «есть дома» — чем больше совпало, тем выше. */
function whatToCook() {
  const f = cookFilter();
  const words = f.have.toLocaleLowerCase("ru-RU").split(/[,;\n]+/).map(w => w.trim()).filter(w => w.length >= 3).map(w => w.slice(0, Math.max(3, w.length - 2)));
  return savedItems("recipes").map(item => {
    const text = (item.ingredients || []).join(" ").toLocaleLowerCase("ru-RU");
    return { item, score: words.filter(w => text.includes(w)).length };
  }).filter(({ item, score }) => {
    if (f.time && (!item.minutes || item.minutes > Number(f.time))) return false;
    if (f.difficulty && item.difficulty !== f.difficulty) return false;
    if (f.meal && item.meal !== f.meal) return false;
    if (words.length && !score) return false;
    return true;
  }).sort((a, b) => b.score - a.score || Number(a.item.minutes || 999) - Number(b.item.minutes || 999)).map(({ item }) => item);
}

function recipeTabs() {
  const now = ui.savedFilter === "whatcook" ? "whatcook" : "all";
  const tab = (filter, label) => `<button type="button" class="${filter === now ? "active" : ""}" data-action="saved-filter" data-filter="${filter}" aria-pressed="${filter === now}">${label}</button>`;
  return `<div class="movie-seen-tabs" role="group" aria-label="Рецепты">${tab("all", "Все рецепты")}${tab("whatcook", "Что приготовить")}</div>`;
}

function renderWhatToCook() {
  const f = cookFilter();
  const meals = [...new Set(savedItems("recipes").map(r => r.meal).filter(Boolean))];
  const chip = (key, value, label) => `<button type="button" class="map-category-chip ${f[key] === value ? "active" : ""}" data-action="cook-filter" data-key="${key}" data-value="${value}" aria-pressed="${f[key] === value}">${label}</button>`;
  const list = whatToCook();
  return `<div class="what-cook">
    <label class="what-cook-have">${icon("search", "icon-sm")}<input id="cook-have" type="text" value="${esc(f.have)}" placeholder="Что есть дома: курица, рис, сыр" autocomplete="off"></label>
    <div class="map-categories what-cook-chips">${chip("time", "20", "До 20 мин")}${chip("time", "40", "До 40 мин")}${chip("difficulty", "легко", "Легко")}${chip("difficulty", "средне", "Средне")}${meals.map(m => chip("meal", m, MEAL_NAMES[m] || m)).join("")}</div>
    <button type="button" class="movie-run-start what-cook-surprise" data-action="recipe-surprise" ${list.length ? "" : "disabled"}>${icon("spark", "icon-sm")}<span><b>Удиви меня</b><small>${list.length ? `Случайный из ${list.length} подходящих` : "Под фильтры ничего нет"}</small></span>${icon("right", "icon-sm")}</button>
    <div class="recipe-grid">${list.map(recipeCard).join("") || `<p class="section-note">У вас под эти фильтры ничего нет — поищем в интернете.</p>`}</div>
    ${renderWebCook()}
  </div>`;
}

// Поле «есть дома» — перерисовываем список, не теряя курсор.
document.addEventListener("input", event => {
  if (event.target.id !== "cook-have") return;
  cookFilter().have = event.target.value;
  const at = event.target.selectionStart;
  render();
  const field = document.getElementById("cook-have");
  if (field) { field.focus(); try { field.setSelectionRange(at, at); } catch (_) {} }
});

// ------------------------------------------------------------ «Что приготовить» в интернете

/** Запрос из фильтров: продукты, тип блюда, время и сложность — словами. */
function cookWebQuery() {
  const f = cookFilter();
  return [f.have.trim() ? `что приготовить из: ${f.have.trim()}` : "что приготовить", f.meal ? (MEAL_NAMES[f.meal] || f.meal).toLowerCase() : "", f.time ? `до ${f.time} минут` : "", f.difficulty ? `${f.difficulty} в приготовлении` : ""].filter(Boolean).join(", ");
}

function renderWebCook() {
  const web = ui.cookWeb || {};
  const ready = typeof window.sorokaFindRecipes === "function";
  const button = `<button type="button" class="movie-run-start what-cook-web ${web.loading ? "busy" : ""}" data-action="cook-web" ${web.loading || !ready ? "disabled" : ""}>${web.loading ? '<span class="live-spin"></span>' : icon("search", "icon-sm")}<span><b>${web.loading ? "Ищу в интернете…" : "Найти в интернете"}</b><small>${ready ? esc(cookWebQuery()) : "Работает в приложении бота"}</small></span>${icon("right", "icon-sm")}</button>`;
  const found = (web.found || []).map((r, i) => `<article class="web-recipe"><b>${esc(r.title)}</b><small>${[r.minutes ? `${r.minutes} мин` : "", r.servings ? `${r.servings} порц.` : "", `${r.ingredients.length} ингр.`].filter(Boolean).join(" · ")}</small>${r.summary ? `<p>${esc(r.summary)}</p>` : ""}<details><summary>Ингредиенты</summary><p>${r.ingredients.map(esc).join("<br>")}</p></details>${r.saved ? `<span class="composer-movie-done">${icon("check", "icon-sm")}Сохранено</span>` : `<button type="button" class="primary-button" data-action="cook-web-save" data-index="${i}">Сохранить в рецепты</button>`}</article>`).join("");
  return `<section class="what-cook-webblock"><h3>Из интернета</h3>${button}${web.note ? `<p class="section-note">${esc(web.note)}</p>` : ""}${found}</section>`;
}

async function findCookWeb() {
  ui.cookWeb = { loading: true, found: [] };
  render();
  try {
    const answer = await window.sorokaFindRecipes(cookWebQuery());
    ui.cookWeb = { loading: false, found: answer.found || [], note: answer.note || "" };
  } catch (_) { ui.cookWeb = { loading: false, found: [], note: "Поиск не ответил — попробуйте ещё раз." }; }
  if (ui.savedCategory === "recipes") render();
}

function saveWebRecipe(index) {
  const r = ui.cookWeb?.found?.[index];
  if (!r || r.saved) return;
  r.saved = true;
  data.saved.recipes.push({ id: id(), title: r.title, description: r.summary || "", topic: "", tags: [], minutes: r.minutes || undefined, servings: r.servings || 2, ingredients: r.ingredients, steps: r.steps, source: "Из интернета", url: r.source || "", viewed: false, pinned: false, created: new Date().toISOString() });
  save(); render();
  toast(`«${r.title}» — в рецептах. Шаги для готовки подготовлю за пару минут`);
}
