/*
 * Фильмы: оценка 10 звёздами, «неинтересно» и подборка «Что посмотреть».
 *
 * Вкус считается по тому, что уже отмечено: просмотренный фильм с оценкой выше
 * 6 поднимает его жанр, ниже — опускает, «неинтересно» опускает сильнее.
 * Предложения из ваших планов ранжируются этим же вкусом; новые названия
 * приносит бот (см. window.sorokaRecommend в мосте) — в прототипе без бота
 * доступна только подборка из планов.
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

/** Из планов: то, что подходит вкусу больше всего. */
function movieRecoLocal() {
  const taste = new Map(movieTaste().map(g => [g.name, g.score]));
  return savedItems("movies").filter(m => !movieIsViewed(m) && !m.skipped).map(m => {
    const genres = [m.genre, ...(m.tags || [])].filter(Boolean).slice(0, 2);
    const affinity = genres.reduce((sum, g) => sum + (taste.get(g) || 0), 0);
    const critics = Math.max(Number(m.kinopoiskRating) || 0, Number(m.imdbRating) || 0);
    const why = genres.find(g => (taste.get(g) || 0) > 0);
    return { item: m, score: affinity + (critics ? (critics - 6.5) / 2 : 0), why: why ? `Любите жанр «${why}»` : critics >= 7.5 ? `Высокий рейтинг: ${critics.toLocaleString("ru-RU", { maximumFractionDigits: 1 })}` : "" };
  }).sort((a, b) => b.score - a.score).slice(0, 8);
}

// ------------------------------------------------------------ экран «Что посмотреть»

function movieRecoState() {
  if (!ui.movieReco) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(MOVIE_RECO_KEY) || "{}") || {}; } catch (_) {}
    ui.movieReco = { loading: false, picks: Array.isArray(saved.picks) ? saved.picks : [], note: "", at: saved.at || 0 };
  }
  return ui.movieReco;
}

function recoPoster(p) {
  return p.poster ? `<img class="reco-poster" src="${esc(p.poster)}" alt="" loading="lazy">` : `<span class="reco-poster reco-poster-empty">${icon("event")}</span>`;
}

function recoPickCard(p, i) {
  const score = [p.kpRating ? `КП ${Number(p.kpRating).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}` : "", p.imdbRating ? `IMDb ${Number(p.imdbRating).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}` : ""].filter(Boolean).join(" · ");
  return `<article class="reco-card">${recoPoster(p)}<div class="reco-body"><strong>${esc(p.title)}</strong><small>${[p.year, p.genre, score].filter(Boolean).map(esc).join(" · ")}</small>${p.why ? `<p>${esc(p.why)}</p>` : ""}<div class="reco-actions"><button type="button" class="small-button primary" data-action="movie-reco-add" data-index="${i}">${icon("plus", "icon-sm")}В планы</button><button type="button" class="small-button" data-action="movie-reco-skip" data-index="${i}">${icon("thumbDown", "icon-sm")}Не интересно</button></div></div></article>`;
}

function renderMovieReco() {
  const state = movieRecoState();
  const taste = movieTaste();
  const loved = taste.filter(g => g.score > 0).slice(0, 6);
  const seen = savedItems("movies").filter(movieIsViewed);
  const rated = seen.filter(m => m.rating).length;
  const local = movieRecoLocal();
  const chips = loved.length
    ? loved.map((g, i) => `<span class="taste-chip ${i < 3 ? "top" : ""}">${esc(g.name)}</span>`).join("")
    : `<p class="section-note">Пока не хватает оценок: поставьте их просмотренным фильмам — вкус посчитается сам.</p>`;
  const localList = local.length
    ? local.map(({ item, why }) => `<button type="button" class="reco-row" data-action="saved-open" data-category="movies" data-id="${esc(item.id)}">${movieCoverMarkup(item)}<span><strong>${esc(item.title)}</strong><small>${[item.year, item.genre].filter(Boolean).map(esc).join(" · ")}${why ? ` · ${esc(why)}` : ""}</small></span>${icon("right", "icon-sm")}</button>`).join("")
    : `<p class="section-note">В планах пока нет фильмов — добавьте, и я скажу, какой смотреть первым.</p>`;
  const picks = state.picks.length ? state.picks.map(recoPickCard).join("") : "";
  const ready = typeof window.sorokaRecommend === "function";
  const button = ready
    ? `<button type="button" class="primary-button reco-load" data-action="movie-reco-load" ${state.loading ? "disabled" : ""}>${state.loading ? '<span class="live-spin"></span>Подбираю…' : `${icon("spark", "icon-sm")}${state.picks.length ? "Подобрать другие" : "Подобрать новые"}`}</button>`
    : `<p class="section-note">Новые названия подбирает бот — в рабочем приложении.</p>`;
  return `<div class="movie-reco">
    <section class="reco-block"><h2>Ваш вкус</h2><div class="taste-chips">${chips}</div><small class="reco-hint">Считаю по ${seen.length} просмотренным, из них ${rated} с оценкой. Оценка выше 6 поднимает жанр, ниже — опускает, «не интересно» опускает сильнее.</small></section>
    <section class="reco-block"><h2>Из ваших планов</h2><div class="reco-list">${localList}</div></section>
    <section class="reco-block"><h2>Новое для вас</h2>${button}${state.note ? `<p class="section-note">${esc(state.note)}</p>` : ""}${state.loading && !state.picks.length ? `<p class="section-note">Смотрю ваши оценки и ищу — это до полминуты.</p>` : ""}<div class="reco-picks">${picks}</div></section>
  </div>`;
}

async function loadMovieReco() {
  const state = movieRecoState();
  if (state.loading || typeof window.sorokaRecommend !== "function") return;
  state.loading = true; state.note = "";
  render();
  try {
    const answer = await window.sorokaRecommend();
    state.picks = Array.isArray(answer?.picks) ? answer.picks : [];
    state.note = answer?.note || "";
    state.at = Date.now();
    try { localStorage.setItem(MOVIE_RECO_KEY, JSON.stringify({ picks: state.picks, at: state.at })); } catch (_) {}
  } catch (_) {
    state.note = "Не получилось подобрать — попробуйте ещё раз.";
  }
  state.loading = false;
  render();
}

function dropRecoPick(index) {
  const state = movieRecoState();
  state.picks.splice(index, 1);
  try { localStorage.setItem(MOVIE_RECO_KEY, JSON.stringify({ picks: state.picks, at: state.at })); } catch (_) {}
}

/** Предложение → запись в библиотеке. «Не интересно» тоже запись: так вкус учится на отказах. */
function addRecoPick(index, skipped) {
  const p = movieRecoState().picks[index];
  if (!p) return;
  const key = `${p.title.toLocaleLowerCase("ru-RU")}|${p.year || ""}`;
  if (!savedItems("movies").some(m => `${m.title.toLocaleLowerCase("ru-RU")}|${m.year || ""}` === key)) {
    data.saved.movies.push({
      id: id(), title: p.title, description: p.why || "", topic: "Кино", tags: [], genre: p.genre || "", year: p.year || undefined,
      originalTitle: p.originalTitle || "", status: "Хочу посмотреть", rating: 0, skipped: Boolean(skipped),
      kinopoiskUrl: p.kpUrl || "", imdbUrl: p.imdbUrl || "", kinopoiskRating: p.kpRating ?? "", imdbRating: p.imdbRating ?? "",
      coverPath: p.poster || "", source: "Подборка", created: new Date().toISOString(), pinned: false,
    });
  }
  dropRecoPick(index);
  save();
  render();
  toast(skipped ? "Учту: это не для вас" : "Добавил в планы");
}

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
  if (action === "movie-reco-add") { addRecoPick(Number(control.dataset.index), false); return true; }
  if (action === "movie-reco-skip") { addRecoPick(Number(control.dataset.index), true); return true; }
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
