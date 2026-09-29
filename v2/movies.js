/*
 * Фильмы: оценка 10 звёздами, «неинтересно» и подборка «Что посмотреть».
 *
 * Вкус считается по тому, что уже отмечено: просмотренный фильм с оценкой выше
 * 6 поднимает его жанр, ниже — опускает, «неинтересно» опускает сильнее.
 * Новые названия приносит бот (window.sorokaRecommend в мосте): подборка
 * считается на сервере в фоне и лежит там, пока не откроете вкладку.
 */

const MOVIE_RECO_KEY = "soroka-movie-reco";

/** Оценка звёздами: десять кнопок, нажатие на текущую оценку снимает её. */
function starsRow(rating, interactive = true, label = "Моя оценка", action = "movie-rate") {
  const value = Number(rating) || 0;
  const stars = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    const on = n <= value;
    return interactive
      ? `<button type="button" class="star ${on ? "on" : ""}" data-action="${action}" data-value="${n}" aria-label="${label}: ${n} из 10" aria-pressed="${n === value}">${icon("star", "icon-sm")}</button>`
      : `<span class="star ${on ? "on" : ""}">${icon("star", "icon-sm")}</span>`;
  }).join("");
  return `<div class="stars ${interactive ? "" : "static"}" role="group" aria-label="${label}">${stars}</div>`;
}

/** Блок «Моя оценка» в карточке фильма. */
function movieRatingBlock(item) {
  const value = Number(item.rating) || 0;
  const skip = movieIsViewed(item) ? "" : `<button type="button" class="text-action movie-skip" data-action="movie-skip">${icon("thumbDown", "icon-sm")}${item.skipped ? "Вернуть в планы" : "Не интересно"}</button>`;
  return `<section class="movie-my-rating"><div class="movie-my-rating-head"><strong>Моя оценка</strong><span>${value ? `${value} из 10` : "не оценён"}</span></div>${starsRow(value)}${value ? "" : `<small>Поставьте оценку — фильм отметится просмотренным, а бот лучше поймёт ваш вкус.</small>`}${skip}</section>`;
}

function setMovieRating(item, n) {
  if (!item) return;
  const next = Number(item.rating) === n ? 0 : n;
  item.rating = next;
  // Оценка — значит, посмотрел.
  if (next && !movieIsViewed(item)) { item.statusBeforeViewed = item.status || "Хочу посмотреть"; item.status = "Посмотрел"; item.viewed = true; }
  if (next && item.skipped) item.skipped = false;
  save();
  render();
  toast(next ? `Оценка ${next} из 10` : "Оценка снята");
}

function toggleMovieSkipped(item, quiet = false) {
  if (!item) return;
  item.skipped = !item.skipped;
  save();
  if (!quiet) { render(); toast(item.skipped ? "Не интересно — учту в подборке" : "Вернул в планы"); }
}

// ------------------------------------------------------------ вкус

/** Жанры по вкусу: оценка выше 6 — плюс, ниже — минус; без оценки просмотр чуть плюс; «неинтересно» — минус. */
function movieTaste() {
  const weight = new Map();
  for (const m of savedItems("movies")) {
    const genres = [m.genre, ...(m.tags || [])].filter(Boolean).slice(0, 2);
    const delta = m.skipped ? -1.5 : movieIsViewed(m) ? (m.rating ? (Number(m.rating) - 6) / 2 : 0.4) : 0;
    if (!delta) continue;
    for (const g of genres) weight.set(g, (weight.get(g) || 0) + delta);
  }
  return [...weight.entries()].map(([name, score]) => ({ name, score: Math.round(score * 10) / 10 })).sort((a, b) => b.score - a.score);
}

// ------------------------------------------------------------ строка оценок

const scoreText = value => Number(value).toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** «КП 6,8 · IMDb 6,5 · ★ 7» — одной строкой; чего нет, того не показываем. */
function movieScoresLine(item) {
  const kp = Number(item.kinopoiskRating) > 0 ? `<span class="score kp"><i>КП</i>${scoreText(item.kinopoiskRating)}</span>` : "";
  const imdb = Number(item.imdbRating) > 0 ? `<span class="score imdb"><i>IMDb</i>${scoreText(item.imdbRating)}</span>` : "";
  const mine = Number(item.rating) > 0 ? `<span class="score mine">${icon("star", "icon-sm")}${item.rating}</span>` : "";
  return kp || imdb || mine ? `<span class="movie-card-scores">${kp}${imdb}${mine}</span>` : "";
}

// ------------------------------------------------------------ экран «Что посмотреть»

const RECO_PHRASES = ["Смотрю ваши оценки…", "Ищу похожее по духу…", "Проверяю по IMDb…", "Отбираю лучшее…"];
const recoPending = new Map(); // ключ предложения → { mode, timer }
let recoPoll = null;
let recoPhraseTimer = null;

const pickKey = p => `${p.title}|${p.year || ""}`;
const libraryKey = m => `${String(m.title).toLocaleLowerCase("ru-RU")}|${m.year || ""}`;

function movieRecoState() {
  if (!ui.movieReco) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(MOVIE_RECO_KEY) || "{}") || {}; } catch (_) {}
    ui.movieReco = { loading: false, fetched: false, picks: Array.isArray(saved.picks) ? saved.picks : [], note: "", at: saved.at || 0, phrase: 0 };
  }
  return ui.movieReco;
}

/** Предложения без тех, что уже в библиотеке (добавили, отметили, отказались). */
function recoVisible() {
  const known = new Set(savedItems("movies").flatMap(m => [libraryKey(m), `${String(m.originalTitle || "").toLocaleLowerCase("ru-RU")}|${m.year || ""}`]));
  return movieRecoState().picks.filter(p => !known.has(`${p.title.toLocaleLowerCase("ru-RU")}|${p.year || ""}`) || recoPending.has(pickKey(p)));
}

/** Предложение как «запись фильма» — чтобы рисовать его теми же карточками, что и библиотеку. */
function pickAsMovie(p) {
  return { id: `pick:${pickKey(p)}`, title: p.title, year: p.year || undefined, genre: p.genre || "", description: p.why || "", status: "Предложение",
    kinopoiskRating: p.kpRating ?? "", imdbRating: p.imdbRating ?? "", coverPath: p.poster || "", tags: [] };
}

function recoCard(p) {
  const m = pickAsMovie(p);
  const key = pickKey(p);
  const pending = recoPending.get(key);
  if (pending) {
    const label = { plans: "Добавлено в планы", skip: "Не интересно — учту в подборке" }[pending.mode];
    return `<div class="reco-item"><div class="swipe-undo reco-strip"><span>${icon(pending.mode === "plans" ? "plus" : "thumbDown", "icon-sm")}${label}</span><button type="button" data-action="reco-undo" data-key="${esc(key)}">Вернуть</button></div></div>`;
  }
  return `<div class="reco-item" data-reco-key="${esc(key)}">
    <div class="reco-under reco-under-plans" aria-hidden="true">${icon("plus")}<span>В планы</span></div>
    <div class="reco-under reco-under-actions"><button type="button" class="reco-act seen" data-action="reco-seen" data-key="${esc(key)}">${icon("eye")}<span>Смотрел</span></button><button type="button" class="reco-act skip" data-action="reco-skip" data-key="${esc(key)}">${icon("thumbDown")}<span>Не интересно</span></button></div>
    <div class="reco-swipe-content"><button type="button" class="record-card movie-card reco-card-v2" data-action="reco-open" data-key="${esc(key)}">${movieCoverMarkup(m)}<span class="movie-card-body"><span class="movie-card-kicker">Предложение</span><span class="movie-card-title">${esc(p.title)}</span><span class="movie-card-facts">${[p.year, p.genre].filter(Boolean).map(esc).join(" · ")}</span>${p.why ? `<span class="movie-card-description">${esc(p.why)}</span>` : ""}${movieScoresLine(m)}</span></button></div>
  </div>`;
}

function recoSkeleton() {
  return Array.from({ length: 3 }, () => `<div class="reco-skeleton"><span class="sk-cover"></span><span class="sk-lines"><i></i><i></i><i></i></span></div>`).join("");
}

function renderMovieReco() {
  const state = movieRecoState();
  const taste = movieTaste();
  const loved = taste.filter(g => g.score > 0).slice(0, 6);
  const seen = savedItems("movies").filter(movieIsViewed);
  const rated = seen.filter(m => m.rating).length;
  const chips = loved.length
    ? loved.map((g, i) => `<span class="taste-chip ${i < 3 ? "top" : ""}">${esc(g.name)}</span>`).join("")
    : `<p class="section-note">Пока не хватает оценок: поставьте их просмотренным фильмам — вкус посчитается сам.</p>`;
  const picks = recoVisible();
  const ready = typeof window.sorokaRecommend === "function";
  const button = ready
    ? `<button type="button" class="reco-load ${state.loading ? "busy" : ""}" data-action="movie-reco-load" ${state.loading ? "disabled" : ""}><span class="reco-load-icon">${state.loading ? '<span class="reco-orbit"></span>' : icon("spark")}</span><span class="reco-load-text"><b>${state.loading ? "Подбираю" : picks.length ? "Подобрать другие" : "Подобрать новые"}</b><small class="reco-phase">${state.loading ? RECO_PHRASES[state.phrase % RECO_PHRASES.length] : "По вашим оценкам и жанрам"}</small></span><span class="reco-load-bar"></span></button>`
    : `<p class="section-note">Новые названия подбирает бот — в рабочем приложении.</p>`;
  let seenHint = true;
  try { seenHint = Boolean(localStorage.getItem("soroka-reco-hint")); if (picks.length && !seenHint) localStorage.setItem("soroka-reco-hint", "1"); } catch (_) {}
  const hint = picks.length && !seenHint ? `<p class="swipe-hint">Свайп вправо — в планы · влево — «Смотрел» или «Не интересно» (до конца)</p>` : "";
  return `<div class="movie-reco">
    <section class="reco-block"><h2>Ваш вкус</h2><div class="taste-chips">${chips}</div><small class="reco-hint">Считаю по ${seen.length} просмотренным, из них ${rated} с оценкой. Оценка выше 6 поднимает жанр, ниже — опускает, «не интересно» опускает сильнее.</small></section>
    <section class="reco-block reco-new"><h2>Новое для вас</h2>${button}${state.note && !state.loading ? `<p class="section-note">${esc(state.note)}</p>` : ""}${hint}<div class="reco-picks">${state.loading && !picks.length ? recoSkeleton() : picks.map(recoCard).join("")}</div></section>
  </div>`;
}

function saveRecoPicks() {
  const state = movieRecoState();
  try { localStorage.setItem(MOVIE_RECO_KEY, JSON.stringify({ picks: state.picks, at: state.at })); } catch (_) {}
}

/** Меняем фразу под кнопкой без перерисовки — иначе анимация дёргалась бы. */
function startRecoPhrases() {
  clearInterval(recoPhraseTimer);
  recoPhraseTimer = setInterval(() => {
    const state = movieRecoState();
    if (!state.loading) { clearInterval(recoPhraseTimer); return; }
    state.phrase++;
    const node = document.querySelector(".reco-phase");
    if (!node) return;
    node.classList.add("swap");
    setTimeout(() => { node.textContent = RECO_PHRASES[state.phrase % RECO_PHRASES.length]; node.classList.remove("swap"); }, 220);
  }, 2600);
}

function applyRecoAnswer(answer) {
  const state = movieRecoState();
  if (Array.isArray(answer?.picks) && answer.picks.length) { state.picks = answer.picks; state.at = Date.now(); saveRecoPicks(); }
  state.note = answer?.note || "";
}

/** Подборка идёт на сервере: спрашиваем, как дела, пока не будет готово. Приложение можно свернуть. */
function pollReco() {
  clearTimeout(recoPoll);
  const state = movieRecoState();
  const started = Date.now();
  const tick = async () => {
    if (!state.loading) return;
    try {
      const answer = await window.sorokaRecoGet();
      if (!answer.pending) {
        applyRecoAnswer(answer);
        state.loading = false;
        clearInterval(recoPhraseTimer);
        if (ui.savedCategory === "movies" && ui.savedFilter === "reco") render();
        return;
      }
    } catch (_) { /* связи нет — попробуем ещё раз */ }
    if (Date.now() - started > 200000) { state.loading = false; state.note = "Подборка задерживается — загляните сюда чуть позже, результат сохранится."; if (ui.savedFilter === "reco") render(); return; }
    recoPoll = setTimeout(tick, 2500);
  };
  recoPoll = setTimeout(tick, 2500);
}

async function loadMovieReco() {
  const state = movieRecoState();
  if (state.loading || typeof window.sorokaRecommend !== "function") return;
  state.loading = true; state.note = ""; state.phrase = 0;
  render();
  startRecoPhrases();
  try {
    const answer = await window.sorokaRecommend();
    if (!answer.pending) { applyRecoAnswer(answer); state.loading = false; render(); return; }
    pollReco();
  } catch (_) {
    state.loading = false;
    state.note = "Не получилось подобрать — проверьте связь и попробуйте ещё раз.";
    render();
  }
}

/** Открыли вкладку: подтягиваем последнюю подборку с сервера (и подхватываем идущую). */
async function openMovieReco() {
  const state = movieRecoState();
  if (state.fetched || typeof window.sorokaRecoGet !== "function") return;
  state.fetched = true;
  try {
    const answer = await window.sorokaRecoGet();
    applyRecoAnswer(answer);
    if (answer.pending) { state.loading = true; startRecoPhrases(); pollReco(); }
    if (ui.savedCategory === "movies" && ui.savedFilter === "reco") render();
  } catch (_) { state.fetched = false; }
}

// ------------------------------------------------------------ что делаем с предложением

function findPick(key) { return movieRecoState().picks.find(p => pickKey(p) === key); }

/** Предложение → запись в библиотеке. mode: plans | skip | seen (с оценкой). */
function commitPick(key, mode, rating = 0) {
  const p = findPick(key);
  if (!p) return;
  if (!savedItems("movies").some(m => libraryKey(m) === `${p.title.toLocaleLowerCase("ru-RU")}|${p.year || ""}`)) {
    const seen = mode === "seen";
    data.saved.movies.push({
      id: id(), title: p.title, description: p.why || "", topic: "Кино", tags: [], genre: p.genre || "", year: p.year || undefined,
      originalTitle: p.originalTitle || "", status: seen ? "Посмотрел" : "Хочу посмотреть", viewed: seen, rating: seen ? Number(rating) || 0 : 0, skipped: mode === "skip",
      kinopoiskUrl: p.kpUrl || "", imdbUrl: p.imdbUrl || "", kinopoiskRating: p.kpRating ?? "", imdbRating: p.imdbRating ?? "",
      coverPath: p.poster || "", source: "Подборка", created: new Date().toISOString(), pinned: false,
    });
  }
  recoPending.delete(key);
  save();
  render();
}

/** «В планы» и «Не интересно» применяются через три секунды — есть время передумать. */
function deferPick(key, mode) {
  const old = recoPending.get(key);
  if (old) clearTimeout(old.timer);
  const timer = setTimeout(() => commitPick(key, mode), 3500);
  recoPending.set(key, { mode, timer });
  render();
}

function flushRecoPending() {
  for (const [key, entry] of [...recoPending]) { clearTimeout(entry.timer); commitPick(key, entry.mode); }
}
document.addEventListener("visibilitychange", () => { if (document.hidden) flushRecoPending(); });

// ------------------------------------------------------------ окно оценки

/** Окно «Как вам фильм?»: десять звёзд; для предложения запись создаётся при выборе оценки. */
function renderMovieRateSheet() {
  const sheet = ui.sheet;
  const pick = sheet.pickKey ? findPick(sheet.pickKey) : null;
  const item = sheet.movieId ? savedItem("movies", sheet.movieId) : null;
  const title = pick ? pick.title : item?.title || "Фильм";
  const stars = Array.from({ length: 10 }, (_, i) => `<button type="button" class="star big" data-action="movie-rate-pick" data-value="${i + 1}" aria-label="${i + 1} из 10"><span>${icon("star")}</span><b>${i + 1}</b></button>`).join("");
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet movie-rate-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Как вам «${esc(title)}»?</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><p class="section-note">Оценка от 1 до 10 — по ней я подбираю дальше.</p><div class="star-pad">${stars}</div><div class="sheet-actions"><button class="ghost-button" type="button" data-action="movie-rate-pick" data-value="0">Смотрел, без оценки</button></div></section></div>`;
}

/** Подробности предложения: постер, почему, три действия. */
function renderRecoDetailSheet() {
  const p = findPick(ui.sheet.pickKey);
  if (!p) return "";
  const m = pickAsMovie(p);
  const links = [p.kpUrl ? `<a class="small-button" href="${esc(p.kpUrl)}" target="_blank" rel="noopener noreferrer">Кинопоиск ${icon("external", "icon-sm")}</a>` : "", p.imdbUrl ? `<a class="small-button" href="${esc(p.imdbUrl)}" target="_blank" rel="noopener noreferrer">IMDb ${icon("external", "icon-sm")}</a>` : ""].join("");
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet reco-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${esc(p.title)}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><div class="movie-detail-hero">${movieCoverMarkup(m, "detail")}<div class="movie-detail-intro"><span class="movie-detail-status">Предложение</span><span class="movie-detail-meta">${[p.year, p.genre].filter(Boolean).map(esc).join(" · ")}</span>${movieScoresLine(m)}</div></div>${p.why ? `<p class="saved-prose movie-detail-description">${esc(p.why)}</p>` : ""}<div class="reco-links">${links}</div><div class="reco-choices"><button class="primary-button" type="button" data-action="reco-plans" data-key="${esc(pickKey(p))}">${icon("plus", "icon-sm")}В планы</button><button class="ghost-button" type="button" data-action="reco-seen" data-key="${esc(pickKey(p))}">${icon("eye", "icon-sm")}Смотрел</button><button class="ghost-button" type="button" data-action="reco-skip" data-key="${esc(pickKey(p))}">${icon("thumbDown", "icon-sm")}Не интересно</button></div></section></div>`;
}

// ------------------------------------------------------------ жесты по карточкам предложений

const RECO_OPEN = 176;
let recoDrag = null;
let recoSuppress = 0;

function closeRecoRows(except = null) {
  document.querySelectorAll(".reco-item.open").forEach(row => { if (row !== except) { row.classList.remove("open"); row.querySelector(".reco-swipe-content")?.style.removeProperty("--dx"); } });
}

document.addEventListener("pointerdown", event => {
  const content = event.target.closest?.(".reco-swipe-content");
  if (!content) { if (!event.target.closest?.(".reco-act")) closeRecoRows(); return; }
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const row = content.parentElement;
  closeRecoRows(row);
  recoDrag = { row, content, id: event.pointerId, x: event.clientX, y: event.clientY, base: row.classList.contains("open") ? -RECO_OPEN : 0, horizontal: false, dx: 0 };
});
document.addEventListener("pointermove", event => {
  const drag = recoDrag;
  if (!drag || drag.id !== event.pointerId) return;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  if (!drag.horizontal) {
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { recoDrag = null; return; }
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.25) { drag.horizontal = true; try { drag.content.setPointerCapture(event.pointerId); } catch (_) {} }
  }
  if (!drag.horizontal) return;
  const width = drag.row.clientWidth;
  // Тянуть можно вправо до 110 px и влево почти на всю карточку; у краёв упор мягче.
  let x = drag.base + dx;
  if (x > 110) x = 110 + (x - 110) * 0.25;
  const full = -Math.max(RECO_OPEN + 50, width * 0.6);
  drag.dx = x;
  drag.row.classList.add("dragging");
  drag.row.classList.toggle("armed-plans", x > 78);
  drag.row.classList.toggle("armed-skip", x < full);
  drag.content.style.setProperty("--dx", `${x}px`);
});
document.addEventListener("pointerup", event => {
  const drag = recoDrag;
  if (!drag || drag.id !== event.pointerId) return;
  recoDrag = null;
  drag.row.classList.remove("dragging");
  if (!drag.horizontal) return;
  recoSuppress = Date.now() + 350;
  const key = drag.row.dataset.recoKey;
  const width = drag.row.clientWidth;
  const full = -Math.max(RECO_OPEN + 50, width * 0.6);
  const armedPlans = drag.row.classList.contains("armed-plans");
  const armedSkip = drag.row.classList.contains("armed-skip");
  drag.row.classList.remove("armed-plans", "armed-skip");
  if (armedPlans) { drag.content.style.removeProperty("--dx"); deferPick(key, "plans"); return; }
  if (armedSkip || drag.dx < full) { deferPick(key, "skip"); return; }
  const open = drag.dx < -RECO_OPEN / 2.4;
  drag.row.classList.toggle("open", open);
  drag.content.style.setProperty("--dx", open ? `${-RECO_OPEN}px` : "0px");
});
document.addEventListener("pointercancel", () => { if (recoDrag) { recoDrag.row.classList.remove("dragging"); recoDrag.content.style.removeProperty("--dx"); recoDrag = null; } });
// Палец отпустили — карточка не должна ещё и открыться.
document.addEventListener("click", event => {
  if (Date.now() < recoSuppress && event.target.closest?.(".reco-swipe-content")) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);

// ------------------------------------------------------------ действия

function movieAction(action, control) {
  if (action === "movie-rate") {
    const item = ui.sheet?.kind === "saved" && ui.sheet.category === "movies" ? savedItem("movies", ui.sheet.id) : null;
    if (item) { setMovieRating(item, Number(control.dataset.value)); return true; }
    return false;
  }
  if (action === "movie-rate-form") {
    // Звёзды в форме «Изменить»: пишут в скрытое поле, запись сохранит кнопка формы.
    const form = control.closest("form");
    const input = form?.elements?.rating;
    if (input) {
      const n = Number(control.dataset.value);
      input.value = String(Number(input.value) === n ? 0 : n);
      form.querySelectorAll(".stars .star").forEach((star, i) => star.classList.toggle("on", i < Number(input.value)));
    }
    return true;
  }
  if (action === "movie-reco-load") { void loadMovieReco(); return true; }
  if (action === "reco-open") { ui.sheet = { kind: "reco-detail", pickKey: control.dataset.key, justRendered: false }; render(); return true; }
  if (action === "reco-plans") { ui.sheet = null; deferPick(control.dataset.key, "plans"); return true; }
  if (action === "reco-skip") { ui.sheet = null; deferPick(control.dataset.key, "skip"); return true; }
  if (action === "reco-seen") { ui.sheet = { kind: "movie-rate", pickKey: control.dataset.key, justRendered: false }; render(); return true; }
  if (action === "reco-undo") {
    const entry = recoPending.get(control.dataset.key);
    if (entry) clearTimeout(entry.timer);
    recoPending.delete(control.dataset.key);
    render();
    return true;
  }
  if (action === "movie-rate-open") { ui.sheet = { kind: "movie-rate", movieId: control.dataset.id, justRendered: false }; render(); return true; }
  if (action === "movie-rate-pick" && ui.sheet?.kind === "movie-rate") {
    const value = Number(control.dataset.value) || 0;
    const { pickKey: key, movieId } = ui.sheet;
    ui.sheet = null;
    if (key) { commitPick(key, "seen", value); toast(value ? `Оценка ${value} из 10 — учту в подборке` : "Отметил просмотренным"); return true; }
    const item = savedItem("movies", movieId);
    if (item) {
      item.rating = value;
      if (!movieIsViewed(item)) { item.statusBeforeViewed = item.status || "Хочу посмотреть"; item.status = "Посмотрел"; item.viewed = true; }
      save(); render(); toast(value ? `Оценка ${value} из 10` : "Готово");
    }
    return true;
  }
  if (action === "movie-skip" && ui.sheet?.kind === "saved") { toggleMovieSkipped(savedItem("movies", ui.sheet.id)); return true; }
  if (action === "swipe-skip-undo" || action === "swipe-seen-undo") {
    const item = savedItem("movies", control.dataset.undoId);
    if (item) {
      if (action === "swipe-skip-undo") { item.skipped = !item.skipped; save(); }
      else toggleMovieViewed(item);
    }
    render();
    return true;
  }
  return false;
}
