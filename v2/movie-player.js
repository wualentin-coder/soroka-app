/* Просмотр открывается на странице фильма в браузере, без встроенных iframe. */
function moviePlayerKinopoiskId(item) {
  const explicit = String(item?.kinopoiskId || item?.kpId || "");
  if (/^[1-9]\d{0,9}$/.test(explicit)) return explicit;
  try {
    const url = new URL(String(item?.kinopoiskUrl || ""));
    if (!/^https?:$/.test(url.protocol) || !/^(www\.)?kinopoisk\.ru$/i.test(url.hostname)) return "";
    return url.pathname.match(/^\/(?:film|series)\/([1-9]\d{0,9})(?:\/|$)/)?.[1] || "";
  } catch { return ""; }
}


function movieWatchUrl(item) {
  const id = moviePlayerKinopoiskId(item);
  return id ? `https://reyoho.ru/film/${id}` : "";
}

function movieWatchMarkup(item) {
  const url = movieWatchUrl(item);
  if (!url) return `<button type="button" class="movie-similar-btn movie-watch-btn movie-compact-action" disabled aria-label="Смотреть на Reyoho — добавьте ссылку на Кинопоиск" title="Добавьте ссылку на Кинопоиск в карточку фильма">${icon("play")}</button>`;
  return `<a class="movie-similar-btn movie-watch-btn movie-compact-action" data-action="movie-watch" data-id="${esc(item.id)}" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="Смотреть на Reyoho" title="Смотреть на Reyoho">${icon("play")}</a>`;
}

// Only the movie ID is retained in this tab; playback is not proof of viewing.
const MOVIE_WATCH_RETURN_KEY = "flow.movie.watch-return.v1";
let movieWatchPending = (() => {
  try {
    const value = JSON.parse(sessionStorage.getItem(MOVIE_WATCH_RETURN_KEY));
    return value && typeof value.id === "string" && Number.isFinite(value.at) && Date.now() - value.at >= 0 && Date.now() - value.at < 7 * 86400000
      ? { ...value, returned: true } : null;
  } catch { return null; }
})();
let movieWatchPromptQueued = false;
function movieWatchRemember(item) {
  movieWatchPending = item && !Number(item.rating) ? { id: String(item.id), at: Date.now(), away: false, returned: false } : null;
  try {
    if (movieWatchPending) sessionStorage.setItem(MOVIE_WATCH_RETURN_KEY, JSON.stringify({ id: movieWatchPending.id, at: movieWatchPending.at }));
    else sessionStorage.removeItem(MOVIE_WATCH_RETURN_KEY);
  } catch { /* The prompt still works for this session without storage. */ }
}
function movieWatchCanPrompt() {
  if (!movieWatchPending?.returned || document.hidden || ui.page !== "saved" || ui.savedCategory !== "movies") return false;
  const sheet = ui.sheet;
  const ownDetail = sheet?.kind === "saved" && sheet.category === "movies" && sheet.id === movieWatchPending.id && sheet.mode === "view";
  if ((sheet && !ownDetail) || ui.menu) return false;
  const node = activeSheet();
  return !node || (ownDetail && sheetOwner(node) === sheet && !sheetHasChanges(node));
}
function movieWatchReturnCheck() {
  if (!movieWatchPending) return;
  if (ui.page !== "saved" || ui.savedCategory !== "movies") { movieWatchPending.returned = true; return; }
  if (!movieWatchCanPrompt() || movieWatchPromptQueued) return;
  movieWatchPromptQueued = true;
  queueMicrotask(() => {
    movieWatchPromptQueued = false;
    if (!movieWatchCanPrompt()) return;
    const item = savedItem("movies", movieWatchPending.id);
    // The live library may still be loading. Never open a prompt for a missing item.
    if (!item) return;
    movieWatchRemember(null);
    if (Number(item.rating)) return;
    ui.sheet = { kind: "movie-rate", movieId: item.id, afterPlayback: true, justRendered: false };
    render();
  });
}
function movieWatchLeave() { if (movieWatchPending) movieWatchPending.away = true; }
function movieWatchReturn() {
  if (!movieWatchPending?.away) return;
  movieWatchPending.returned = true;
  movieWatchReturnCheck();
}
window.addEventListener("blur", movieWatchLeave);
window.addEventListener("focus", movieWatchReturn);
window.addEventListener("pageshow", event => { if (event.persisted) { movieWatchLeave(); movieWatchReturn(); } });
document.addEventListener("visibilitychange", () => { if (document.hidden) movieWatchLeave(); else movieWatchReturn(); });

// В Telegram используем внешний браузер; в остальных случаях работает обычная ссылка.
document.addEventListener("click", event => {
  const link = event.target.closest?.('a[data-action="movie-watch"]');
  if (!link || (event.button !== undefined && event.button !== 0) || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const url = link.getAttribute("href") || "";
  if (!/^https:\/\/reyoho\.ru\/film\/[1-9]\d{0,9}$/.test(url)) return;
  if (event.defaultPrevented) return;
  const item = savedItem("movies", link.dataset.id);
  if (item && movieWatchUrl(item) === url) movieWatchRemember(item);
  const tg = window.Telegram?.WebApp;
  if (!tg?.initData || typeof tg.openLink !== "function") return;
  try {
    tg.openLink(url, { try_instant_view: false });
    event.preventDefault();
    event.stopImmediatePropagation();
  } catch { /* Если SDK недоступен, браузер откроет обычную ссылку. */ }
}, true);
