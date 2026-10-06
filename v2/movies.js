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
  if (next && !movieIsViewed(item)) { item.statusBeforeViewed = item.status || "Хочу посмотреть"; item.status = "Посмотрел"; item.viewed = true; item.viewedByRating = true; }
  if (!next && item.viewedByRating) { item.status = item.statusBeforeViewed || "Хочу посмотреть"; item.viewed = false; item.viewedByRating = false; }
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
    <div class="reco-under-del" aria-hidden="true">${icon("thumbDown")}<span>Не интересно</span></div>
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
    <section class="reco-block reco-new"><h2>Новое для вас</h2>${recoFilterBar(taste)}${button}${state.note && !state.loading ? `<p class="section-note">${esc(state.note)}</p>` : ""}${hint}<div class="reco-picks">${state.loading && !picks.length ? recoSkeleton() : picks.map(recoCard).join("")}</div></section>
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
    const answer = await window.sorokaRecommend(recoFilter());
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
      id: id(), title: p.title, description: p.why || "", topic: p.kind === "series" ? "Сериалы" : "Кино", tags: [], genre: p.genre || "", year: p.year || undefined,
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
  const score = v => movieScore(v);
  const kp = `<span class="movie-rating-label">Кинопоиск</span><strong>${esc(score(p.kpRating))}</strong>`;
  const imdb = `<span class="movie-rating-label">IMDb</span><strong>${esc(score(p.imdbRating))}</strong>`;
  const ratings = `<div class="movie-ratings">${p.kpUrl ? `<a class="movie-rating movie-rating-link" href="${esc(p.kpUrl)}" target="_blank" rel="noopener noreferrer">${kp}${icon("external", "icon-sm")}</a>` : `<div class="movie-rating">${kp}</div>`}${p.imdbUrl ? `<a class="movie-rating movie-rating-link" href="${esc(p.imdbUrl)}" target="_blank" rel="noopener noreferrer">${imdb}${icon("external", "icon-sm")}</a>` : `<div class="movie-rating">${imdb}</div>`}</div>`;
  const key = esc(pickKey(p));
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet saved-view-sheet movie-view-sheet reco-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${esc(p.title)}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><p class="eyebrow">${icon("event", "icon-sm")}Фильмы · Предложение</p><div class="movie-detail-hero">${movieCoverMarkup(m, "detail")}<div class="movie-detail-intro"><span class="movie-detail-status">Предложение</span><span class="movie-detail-meta">${[p.year, p.genre].filter(Boolean).map(esc).join(" · ")}</span>${ratings}</div></div>${p.why ? `<p class="saved-prose movie-detail-description">${esc(p.why)}</p>` : ""}<div class="inline-actions saved-view-actions"><button class="primary-button" type="button" data-action="reco-plans" data-key="${key}">${icon("plus")}В планы</button><button type="button" data-action="reco-seen" data-key="${key}">${icon("eye")}Смотрел</button><button type="button" data-action="reco-skip" data-key="${key}">${icon("thumbDown")}Не интересно</button></div></section></div>`;
}

// ------------------------------------------------------------ жесты по карточкам предложений

const RECO_OPEN = 176;
let recoDrag = null;
let recoSuppress = 0;

function closeRecoRows(except = null) {
  document.querySelectorAll(".reco-item.open").forEach(row => { if (row !== except) { row.classList.remove("open"); row.querySelector(".reco-swipe-content")?.style.removeProperty("--dx"); setTimeout(() => row.classList.remove("dir-left"), 300); } });
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
  drag.row.classList.toggle("dir-right", x > 0);
  drag.row.classList.toggle("dir-left", x < 0);
  drag.row.style.setProperty("--del", Math.max(0, Math.min(1, (-x - RECO_OPEN) / (-full - RECO_OPEN))).toFixed(3));
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
  drag.row.classList.remove("armed-plans", "armed-skip", "dir-right");
  drag.row.style.removeProperty("--del");
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
  if (movieMoreAction(action, control)) return true;
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

/*
 * «Моя оценка» в карточке фильма — слайдер из десяти звёзд: провёл пальцем —
 * звёзды зажигаются следом, отпустил — оценка сохранилась. Нажатие на текущую
 * оценку снимает её.
 */
function starSlider(item) {
  const value = Number(item.rating) || 0;
  const stars = Array.from({ length: 10 }, (_, i) => `<span class="star ${i < value ? "on" : ""}">${icon("star", "icon-sm")}</span>`).join("");
  return `<div class="star-slider" role="slider" tabindex="0" aria-label="Моя оценка" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${value}" aria-valuetext="${value ? `${value} из 10` : "не оценён"}" data-value="${value}">${stars}</div>`;
}

(function installStarSlider() {
  let drag = null;
  const valueAt = (box, x) => {
    const r = box.getBoundingClientRect();
    return Math.max(1, Math.min(10, Math.ceil(((x - r.left) / r.width) * 10)));
  };
  const paint = (box, n) => {
    box.querySelectorAll(".star").forEach((star, i) => star.classList.toggle("on", i < n));
    box.setAttribute("aria-valuenow", String(n));
    // Цифра рядом со звёздами — меняется вслед за пальцем.
    const out = box.parentElement?.querySelector(".star-value");
    if (out) out.innerHTML = n ? `${n}<small>/10</small>` : "<small>—</small>";
  };
  const movie = () => ui.sheet?.category === "movies" ? savedItem("movies", ui.sheet.id) : null;
  const commit = (n, tap) => {
    const item = movie();
    if (!item) return;
    // Нажатие на ту же оценку — снять; протяжка — поставить ровно ту, где отпустил.
    if (!tap && Number(item.rating) === n) return;
    setMovieRating(item, n);
  };
  // Оценка ставится только намеренно: коротким нажатием на месте или протяжкой
  // вбок. Палец пошёл вверх-вниз (листаете или смахиваете карточку) — ничего не
  // ставим: раньше звезда ловилась при сворачивании окна, и фильм «улетал» в просмотренные.
  document.addEventListener("pointerdown", event => {
    const box = event.target.closest?.(".star-slider");
    if (!box || event.button > 0) return;
    drag = { box, id: event.pointerId, x: event.clientX, y: event.clientY, at: Date.now(), sliding: false, n: valueAt(box, event.clientX) };
  });
  document.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.sliding) {
      if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) { drag = null; return; }
      if (Math.abs(dx) < 10) return;
      drag.sliding = true;
      drag.box.classList.add("is-sliding");
      try { drag.box.setPointerCapture(event.pointerId); } catch (_) {}
    }
    const n = valueAt(drag.box, event.clientX);
    if (n !== drag.n || !drag.painted) { drag.n = n; drag.painted = true; paint(drag.box, n); try { window.Telegram?.WebApp?.HapticFeedback?.selectionChanged(); } catch (_) {} }
  });
  document.addEventListener("pointerup", event => {
    if (!drag || event.pointerId !== drag.id) return;
    const { box, n, sliding, x, y, at } = drag;
    drag = null;
    box.classList.remove("is-sliding");
    if (sliding) { commit(n, false); return; }
    const still = Math.abs(event.clientX - x) < 8 && Math.abs(event.clientY - y) < 8 && Date.now() - at < 600;
    if (still) commit(valueAt(box, event.clientX), true);
  });
  document.addEventListener("pointercancel", () => { if (drag) { paint(drag.box, Number(drag.box.dataset.value) || 0); drag.box.classList.remove("is-sliding"); drag = null; } });
  document.addEventListener("keydown", event => {
    const box = event.target.closest?.(".star-slider");
    if (!box || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const now = Number(box.dataset.value) || 0;
    const n = Math.max(1, Math.min(10, now + (event.key === "ArrowRight" ? 1 : -1)));
    const item = movie();
    if (item && n !== now) setMovieRating(item, n);
  });
})();

// ------------------------------------------------------------ «Просмотрено»: когда смотрел, без оценки

/** Год просмотра; без даты — «раньше». */
const seenYear = m => /^\d{4}/.test(m.seenAt || "") ? m.seenAt.slice(0, 4) : "";

/** Подходит ли фильм под выбранный фильтр «Просмотрено». */
function movieSeenMatch(item) {
  const f = ui.movieSeen || "";
  if (!f) return true;
  if (f === "unrated") return !Number(item.rating);
  if (f === "rewatch") return Boolean(item.rewatch);
  if (f === "older") return !seenYear(item) || Number(seenYear(item)) < Number(movieSeenYears().at(-1) || 0);
  return seenYear(item) === f;
}

/** Последние годы, за которые есть просмотры (не больше четырёх), — свежие первыми. */
function movieSeenYears() {
  const years = [...new Set(savedItems("movies").filter(m => !m.skipped && movieIsViewed(m)).map(seenYear).filter(Boolean))].sort().reverse();
  return years.slice(0, 4);
}

function movieSeenFilters() {
  const seen = savedItems("movies").filter(m => !m.skipped && movieIsViewed(m));
  const unrated = seen.filter(m => !Number(m.rating)).length;
  const rewatch = seen.filter(m => m.rewatch).length;
  const years = movieSeenYears();
  const older = seen.filter(m => !seenYear(m) || Number(seenYear(m)) < Number(years.at(-1) || 0)).length;
  const now = ui.movieSeen || "";
  const chip = (value, label, count) => `<button type="button" class="map-category-chip ${now === value ? "active" : ""}" data-action="movie-seen-filter" data-value="${value}" aria-pressed="${now === value}">${label}${count !== undefined ? ` <span>${count}</span>` : ""}</button>`;
  const chips = [chip("", "Все", seen.length), unrated ? chip("unrated", "Без оценки", unrated) : "", rewatch ? chip("rewatch", "Пересмотреть", rewatch) : "",
    ...years.map(y => chip(y, y, seen.filter(m => seenYear(m) === y).length)), older ? chip("older", "Раньше", older) : ""].join("");
  const run = now === "unrated" && unrated ? `<button type="button" class="movie-run-start" data-action="movie-run-start">${icon("star", "icon-sm")}<span><b>Оценить подряд</b><small>По 10 фильмов: оценка, пара слов — и дальше</small></span>${icon("right", "icon-sm")}</button>` : "";
  return `<div class="map-categories movie-seen-filters" aria-label="Когда смотрел">${chips}</div>${run}`;
}

// ------------------------------------------------------------ отзыв и «Пересмотреть» в карточке

function movieReviewBlock(item) {
  if (!movieIsViewed(item) && !Number(item.rating)) return "";
  const rated = Number(item.rating) > 0;
  return `<form class="movie-review ${rated && !item.review ? "invite" : ""}" data-id="${esc(item.id)}"><label><span>${rated ? "Пара слов о фильме" : "Ваш отзыв"}</span><textarea name="review" rows="2" maxlength="2000" placeholder="Что зацепило, что нет — учту, когда буду подбирать">${esc(item.review || "")}</textarea></label><button type="button" class="movie-rewatch ${item.rewatch ? "on" : ""}" data-action="movie-rewatch" data-id="${esc(item.id)}" aria-pressed="${Boolean(item.rewatch)}">${icon("reset", "icon-sm")}${item.rewatch ? "В планах пересмотреть" : "Пересмотреть"}</button></form>`;
}

document.addEventListener("change", event => {
  const field = event.target.closest?.(".movie-review textarea");
  if (!field) return;
  const item = savedItem("movies", field.form.dataset.id);
  if (!item || (item.review || "") === field.value.trim()) return;
  item.review = field.value.trim();
  save();
  toast(item.review ? "Отзыв сохранён — учту в подборке" : "Отзыв убран");
});
document.addEventListener("submit", event => { if (event.target.matches?.(".movie-review")) event.preventDefault(); }, true);

function toggleRewatch(item) {
  if (!item) return;
  item.rewatch = !item.rewatch;
  save();
  toast(item.rewatch ? "Добавил в планы — пересмотреть" : "Убрал из планов пересмотра");
}

// ------------------------------------------------------------ «Оценить подряд»

/** Очередь из десяти неоценённых, свежие просмотры сначала. */
function movieRunQueue() {
  return savedItems("movies").filter(m => !m.skipped && movieIsViewed(m) && !Number(m.rating))
    .sort((a, b) => String(b.seenAt || "").localeCompare(String(a.seenAt || ""))).slice(0, 10).map(m => m.id);
}

function renderMovieRunSheet() {
  const run = ui.sheet;
  const done = run.index >= run.queue.length;
  const head = `<div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${done ? "Готово" : `Оценка ${run.index + 1} из ${run.queue.length}`}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><div class="movie-run-progress"><i style="width:${Math.round(run.index / run.queue.length * 100)}%"></i></div>`;
  if (done) {
    const left = movieRunQueue().length;
    return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet movie-run-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">${head}<div class="movie-run-done">${icon("check")}<p>Оценено: <b>${run.rated}</b>${run.rewatch ? ` · пересмотреть: <b>${run.rewatch}</b>` : ""}</p><small>${left ? `Без оценки осталось ${left}.` : "Все просмотренные оценены."} По оценкам и отзывам подборка станет точнее.</small></div><div class="sheet-actions">${left ? `<button class="primary-button" type="button" data-action="movie-run-start">Ещё 10</button>` : ""}<button class="ghost-button" type="button" data-action="close-sheet">Закрыть</button></div></section></div>`;
  }
  const item = savedItem("movies", run.queue[run.index]);
  if (!item) { run.index++; return renderMovieRunSheet(); }
  const pad = Array.from({ length: 10 }, (_, i) => `<button type="button" class="run-star ${run.pick === i + 1 ? "on" : ""} ${run.pick > i ? "lit" : ""}" data-action="movie-run-pick" data-value="${i + 1}" aria-label="${i + 1} из 10">${i + 1}</button>`).join("");
  const facts = [item.originalTitle && item.originalTitle !== item.title ? item.originalTitle : "", item.year, item.genre].filter(Boolean).map(esc).join(" · ");
  const when = item.seenAt ? `Смотрели ${esc(shortDate(item.seenAt))}` : "";
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet movie-run-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">${head}
    <div class="movie-run-card" data-key="${esc(item.id)}">${movieCoverMarkup(item, "detail")}<div><b>${esc(item.title)}</b><span>${facts}</span>${when ? `<small>${when}</small>` : ""}</div></div>
    <div class="run-pad" role="group" aria-label="Оценка">${pad}</div>
    <form class="movie-run-form"><textarea name="review" rows="2" maxlength="2000" placeholder="Пара слов — необязательно">${esc(run.review || "")}</textarea></form>
    <div class="movie-run-actions"><button type="button" class="ghost-button" data-action="movie-run-skip">Не помню</button><button type="button" class="ghost-button ${run.rewatchNow ? "on" : ""}" data-action="movie-run-rewatch">${icon("reset", "icon-sm")}Пересмотреть</button><button type="button" class="primary-button" data-action="movie-run-next" ${run.pick || run.rewatchNow ? "" : "disabled"}>Дальше</button></div>
  </section></div>`;
}

function movieRunReview() { return document.querySelector(".movie-run-form textarea")?.value.trim() ?? (ui.sheet.review || ""); }

function movieRunAdvance() {
  const run = ui.sheet;
  run.index++; run.pick = 0; run.review = ""; run.rewatchNow = false;
  render();
  document.querySelector(".movie-run-card")?.animate([{ opacity: 0, transform: "translateX(40px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.2,.8,.3,1)" });
}

/*
 * Сериал: сезоны и серии. Нажал серию — отмечена просмотренной (и все до неё,
 * если зажать «до этой»); нажал сезон — весь сезон. Сколько серий в сезоне —
 * задаётся ±, по умолчанию 10.
 */
function isSeries(item) { return item && (item.topic === "Сериалы" || /сериал/i.test(item.genre || "")); }
/** Где я в сериале — для карточки в списке: «Смотрю · С3 · Е5» или «Досмотрен». */
function seriesKicker(item) {
  const seasons = isSeries(item) ? item.episodes || [] : [];
  if (!seasons.length || !seasons.some(s => s.seen.length)) return "";
  for (const s of seasons) for (let e = 1; e <= s.count; e++) if (!s.seen.includes(e)) return `Смотрю · С${s.n} · Е${e}`;
  return "Досмотрен";
}
/** То же для карточки: номер сезона и серии — крупно, акцентом. */
function seriesKickerHtml(item) {
  const text = seriesKicker(item);
  const m = text.match(/^Смотрю · С(\d+) · Е(\d+)$/);
  return m ? `<span class="series-now"><small>Смотрю</small><b>С${m[1]}</b><b>Е${m[2]}</b></span>` : text ? esc(text) : "";
}
/*
 * Сезоны и число серий — с IMDb, один раз за открытие приложения: у идущего
 * сериала выходят новые серии. Отмеченное сохраняется (сервер переносит).
 */
const seriesFilled = new Set();
function seriesFillOnce(item, manualFallback = false) {
  if (!window.sorokaSeriesFill || seriesFilled.has(item.id)) { if (manualFallback) seriesManualStart(item); return; }
  seriesFilled.add(item.id);
  window.sorokaSeriesFill(item.id).then(answer => {
    if (Array.isArray(answer?.episodes) && answer.episodes.length) {
      item.episodes = answer.episodes;
      save(); render();
    } else if (manualFallback) seriesManualStart(item);
  }).catch(() => { if (manualFallback) seriesManualStart(item); });
}
function seriesManualStart(item) {
  item.episodes = [{ n: 1, count: 10, seen: [] }];
  save(); render();
}
function seriesTracker(item) {
  if (!isSeries(item)) return "";
  if (window.sorokaSeriesFill && !seriesFilled.has(item.id) && (item.episodes?.length || /^tt\d/.test(String(item.imdbUrl || "").split("/title/")[1] || ""))) setTimeout(() => seriesFillOnce(item), 0);
  const seasons = item.episodes || [];
  if (!seasons.length) return `<section class="series-track empty"><span>Сезоны и серии</span><button type="button" class="ghost-button" data-action="series-add">${icon("plus", "icon-sm")}Отмечать серии</button></section>`;
  const total = seasons.reduce((s, x) => s + x.count, 0), seen = seasons.reduce((s, x) => s + x.seen.length, 0);
  const next = (() => { for (let i = 0; i < seasons.length; i++) for (let e = 1; e <= seasons[i].count; e++) if (!seasons[i].seen.includes(e)) return { i, e }; return null; })();
  // Открыт выбранный сезон, иначе — тот, где следующая серия.
  const open = Math.min(seasons.length - 1, ui.seriesSeason?.[item.id] ?? (next ? next.i : seasons.length - 1));
  const s = seasons[open];
  const chips = seasons.map((x, i) => {
    const done = x.seen.length === x.count;
    return `<button type="button" class="season-chip ${i === open ? "active" : ""} ${done ? "done" : ""}" data-action="series-open" data-season="${i}"><b>С${x.n}</b><small>${done ? "✓" : `${x.seen.length}/${x.count}`}</small><i style="width:${x.seen.length / x.count * 100}%"></i></button>`;
  }).join("");
  const eps = Array.from({ length: s.count }, (_, k) => k + 1).map(e => `<button type="button" class="ep ${s.seen.includes(e) ? "on" : ""}" data-action="series-ep" data-season="${open}" data-ep="${e}" aria-pressed="${s.seen.includes(e)}">${e}</button>`).join("");
  return `<section class="series-track"><div class="series-head"><div><h3>Сезоны и серии</h3><small>${seen} из ${total}</small></div>${next ? `<button type="button" class="series-next" data-action="series-ep" data-season="${next.i}" data-ep="${next.e}">${icon("check", "icon-sm")}С${seasons[next.i].n} · Е${next.e}</button>` : `<span class="series-done">${icon("check", "icon-sm")}Досмотрен</span>`}</div><div class="season-chips">${chips}<button type="button" class="season-chip add" data-action="series-add" aria-label="Добавить сезон">${icon("plus", "icon-sm")}</button></div><div class="season-eps">${eps}</div><div class="season-tools"><button type="button" class="text-action" data-action="series-season" data-season="${open}">${s.seen.length === s.count ? "Снять сезон" : "Весь сезон"}</button><span class="season-count">Серий: <button type="button" data-action="series-count" data-season="${open}" data-delta="-1" aria-label="Меньше серий">−</button><b>${s.count}</b><button type="button" data-action="series-count" data-season="${open}" data-delta="1" aria-label="Больше серий">+</button></span>${open === seasons.length - 1 ? `<button type="button" class="text-action muted" data-action="series-remove">Убрать сезон</button>` : ""}</div></section>`;
}
function seriesAction(action, control) {
  if (!action.startsWith("series-")) return false;
  const item = ui.sheet?.category === "movies" ? savedItem("movies", ui.sheet.id) : null;
  if (!item) return true;
  if (action === "series-open") { ui.seriesSeason = { ...(ui.seriesSeason || {}), [item.id]: Number(control.dataset.season) }; render(); return true; }
  item.episodes = (item.episodes || []).map(s => ({ ...s, seen: [...s.seen] }));
  const s = item.episodes[Number(control.dataset.season)];
  if (action === "series-add" && !item.episodes.length) { seriesFillOnce(item, true); return true; }
  if (action === "series-add") { item.episodes.push({ n: item.episodes.length + 1, count: item.episodes.at(-1)?.count || 10, seen: [] }); ui.seriesSeason = { ...(ui.seriesSeason || {}), [item.id]: item.episodes.length - 1 }; }
  if (action === "series-remove" && ui.seriesSeason) delete ui.seriesSeason[item.id];
  if (action === "series-remove") item.episodes.pop();
  if (action === "series-count" && s) { s.count = Math.max(1, Math.min(200, s.count + Number(control.dataset.delta))); s.seen = s.seen.filter(e => e <= s.count); }
  if (action === "series-season" && s) s.seen = s.seen.length === s.count ? [] : Array.from({ length: s.count }, (_, k) => k + 1);
  if (action === "series-ep" && s) { const e = Number(control.dataset.ep); s.seen = s.seen.includes(e) ? s.seen.filter(x => x !== e) : [...s.seen, e].sort((a, b) => a - b); }
  // Всё просмотрено — сериал «Посмотрел».
  const total = item.episodes.reduce((a, x) => a + x.count, 0), seen = item.episodes.reduce((a, x) => a + x.seen.length, 0);
  if (total && seen === total && !movieIsViewed(item)) { item.status = "Посмотрел"; item.viewed = true; toast("Сериал досмотрен"); }
  save(); render();
  return true;
}
function movieMoreAction(action, control) {
  if (seriesAction(action, control)) return true;
  if (action === "movie-seen-filter") { ui.movieSeen = control.dataset.value || ""; render(); return true; }
  if (action === "movie-rewatch") { toggleRewatch(savedItem("movies", control.dataset.id)); render(); return true; }
  if (action === "movie-run-start") {
    const queue = movieRunQueue();
    if (!queue.length) { toast("Все просмотренные уже оценены"); return true; }
    ui.sheet = { kind: "movie-run", queue, index: 0, pick: 0, rated: 0, rewatch: 0, justRendered: false };
    render(); return true;
  }
  if (ui.sheet?.kind !== "movie-run") return false;
  const run = ui.sheet;
  const item = savedItem("movies", run.queue[run.index]);
  if (action === "movie-run-pick") { run.review = movieRunReview(); run.pick = Number(control.dataset.value) || 0; render(); try { window.Telegram?.WebApp?.HapticFeedback?.selectionChanged(); } catch (_) {} return true; }
  if (action === "movie-run-rewatch") { run.review = movieRunReview(); run.rewatchNow = !run.rewatchNow; render(); return true; }
  if (action === "movie-run-skip") { movieRunAdvance(); return true; }
  if (action === "movie-run-next") {
    if (item) {
      const review = movieRunReview();
      if (run.pick) { item.rating = run.pick; run.rated++; }
      if (review) item.review = review;
      if (run.rewatchNow && !item.rewatch) { item.rewatch = true; run.rewatch++; }
      save();
    }
    movieRunAdvance();
    return true;
  }
  return false;
}

// ------------------------------------------------------------ что подбирать: фильмы, сериалы, жанр

const RECO_FILTER_KEY = "soroka-reco-filter";
const RECO_GENRES = ["Драма", "Комедия", "Триллер", "Детектив", "Фантастика", "Ужасы", "Мелодрама", "Боевик", "Приключения", "Фэнтези", "Мультфильм", "Документальный", "Криминал", "Военный", "Биография"];

function recoFilter() {
  if (!ui.recoFilter) {
    try { ui.recoFilter = JSON.parse(localStorage.getItem(RECO_FILTER_KEY) || "null"); } catch (_) {}
    if (!ui.recoFilter || typeof ui.recoFilter !== "object") ui.recoFilter = { kind: "any", genre: "" };
  }
  return ui.recoFilter;
}

function recoFilterBar(taste) {
  const f = recoFilter();
  const kinds = [["any", "Всё"], ["movie", "Фильмы"], ["series", "Сериалы"]];
  // Жанры: сначала любимые по оценкам, потом остальные частые.
  const genres = [...new Set([...taste.filter(g => g.score > 0).map(g => g.name), ...RECO_GENRES].map(g => g.charAt(0).toUpperCase() + g.slice(1)))].slice(0, 20);
  return `<div class="reco-filter"><div class="segmented reco-kind" role="group" aria-label="Что подбирать">${kinds.map(([value, label]) => `<button type="button" class="${f.kind === value ? "active" : ""}" data-action="reco-kind" data-value="${value}" aria-pressed="${f.kind === value}">${label}</button>`).join("")}</div><select id="reco-genre" class="filter-input saved-sort-pill" aria-label="Жанр"><option value="">Любой жанр</option>${genres.map(g => `<option value="${esc(g)}" ${f.genre === g ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></div>`;
}

function keepRecoFilter() { try { localStorage.setItem(RECO_FILTER_KEY, JSON.stringify(recoFilter())); } catch (_) {} }

document.addEventListener("change", event => {
  if (event.target.id !== "reco-genre") return;
  recoFilter().genre = event.target.value;
  keepRecoFilter();
});
document.addEventListener("click", event => {
  const button = event.target.closest?.('[data-action="reco-kind"]');
  if (!button) return;
  event.preventDefault(); event.stopImmediatePropagation();
  recoFilter().kind = button.dataset.value;
  keepRecoFilter();
  render();
}, true);
