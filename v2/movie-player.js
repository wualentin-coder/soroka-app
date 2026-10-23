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
  return `<a class="movie-similar-btn movie-watch-btn movie-compact-action" data-action="movie-watch" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="Смотреть на Reyoho" title="Смотреть на Reyoho">${icon("play")}</a>`;
}

// В Telegram используем внешний браузер; в остальных случаях работает обычная ссылка.
document.addEventListener("click", event => {
  const link = event.target.closest?.('a[data-action="movie-watch"]');
  if (!link || (event.button !== undefined && event.button !== 0) || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const url = link.getAttribute("href") || "";
  if (!/^https:\/\/reyoho\.ru\/film\/[1-9]\d{0,9}$/.test(url)) return;
  const tg = window.Telegram?.WebApp;
  if (!tg?.initData || typeof tg.openLink !== "function") return;
  try {
    tg.openLink(url, { try_instant_view: false });
    event.preventDefault();
    event.stopImmediatePropagation();
  } catch { /* Если SDK недоступен, браузер откроет обычную ссылку. */ }
}, true);
