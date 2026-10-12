/* Просмотр отделён от #app: обновление карточки не перезапускает видео. */
const MOVIE_PLAYER_SOURCES = [
  { id: "alloha", name: "Alloha" },
  { id: "turbo", name: "Turbo" },
  { id: "collaps", name: "Collaps" },
];

function moviePlayerKinopoiskId(item) {
  const explicit = String(item?.kinopoiskId || item?.kpId || "");
  if (/^[1-9]\d{0,9}$/.test(explicit)) return explicit;
  try {
    const url = new URL(String(item?.kinopoiskUrl || ""));
    if (!/^https?:$/.test(url.protocol) || !/^(www\.)?kinopoisk\.ru$/i.test(url.hostname)) return "";
    return url.pathname.match(/^\/(?:film|series)\/([1-9]\d{0,9})(?:\/|$)/)?.[1] || "";
  } catch { return ""; }
}

function moviePlayerSafeUrl(value) {
  if (typeof value !== "string" || value.length > 4096) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return "";
    if (url.origin === window.location?.origin) return "";
    if (!url.hostname.includes(".") || /^[\d.]+$/.test(url.hostname) || /(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname)) return "";
    return url.href;
  } catch { return ""; }
}

function moviePlayerSources(payload) {
  if (!payload || !Array.isArray(payload.data)) throw new Error("invalid_player_response");
  return MOVIE_PLAYER_SOURCES.map(source => {
    const row = payload.data.find(row => String(row?.type || "").toLowerCase() === source.id && moviePlayerSafeUrl(row?.iframeUrl));
    return { ...source, url: row ? moviePlayerSafeUrl(row.iframeUrl) : "" };
  });
}

function moviePlayerFrameUrl(source, kinopoiskId) {
  if (!MOVIE_PLAYER_SOURCES.some(row => row.id === source?.id)) return "";
  // Обычная ссылка Alloha привязана к сайту партнёра. Публичный маршрут
  // Kinomix принимает только ID фильма и сам открывает разрешённый плеер.
  if (source.id === "alloha") return /^[1-9]\d{0,9}$/.test(String(kinopoiskId)) ? `https://kinomix.web.app/embed/${kinopoiskId}` : "";
  return moviePlayerSafeUrl(source.url);
}

(function moviePlayerController() {
  const cache = new Map();
  const choices = new Map();
  const session = Math.trunc(Math.random() * 10000);
  let active = null;

  function close(restoreFocus = true) {
    if (!active) return false;
    const state = active;
    active = null;
    state.request?.abort();
    clearTimeout(state.frameTimer);
    state.overlay.remove();
    document.body.classList.remove("movie-player-open");
    if (state.backButton) {
      state.backButton.offClick(state.backClick);
      if (!state.backWasVisible) state.backButton.hide();
    }
    if (state.app) {
      state.app.inert = state.wasInert;
      if (state.oldAriaHidden === null) state.app.removeAttribute("aria-hidden");
      else state.app.setAttribute("aria-hidden", state.oldAriaHidden);
    }
    if (restoreFocus) {
      const target = state.returnFocus?.isConnected ? state.returnFocus : document.querySelector('[data-action="movie-watch"]');
      target?.focus();
    }
    return true;
  }

  function sync() {
    if (active && (ui.sheet?.category !== "movies" || String(ui.sheet.id) !== active.movieId || ui.sheet.mode === "edit")) close(false);
  }

  function displaySource(state) {
    if (active !== state) return;
    const source = state.sources.find(row => row.id === state.select.value && row.url);
    if (!source) return;
    const url = moviePlayerFrameUrl(source, state.kinopoiskId);
    if (!url) return;
    choices.set(state.kinopoiskId, source.id);
    if (choices.size > 30) choices.delete(choices.keys().next().value);
    if (state.frame.querySelector("iframe")?.getAttribute("src") === url) return;
    state.frame.classList.toggle("is-hosted", source.id === "alloha");
    clearTimeout(state.frameTimer);
    state.status.textContent = "Загружаю плеер…";
    state.frame.setAttribute("aria-busy", "true");
    const iframe = document.createElement("iframe");
    iframe.title = `${source.name} — ${state.title}`;
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-presentation");
    iframe.setAttribute("allow", "autoplay; fullscreen; encrypted-media; picture-in-picture");
    iframe.setAttribute("allowfullscreen", "");
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.addEventListener("load", () => {
      if (active !== state || iframe.parentElement !== state.frame) return;
      clearTimeout(state.frameTimer);
      state.frame.setAttribute("aria-busy", "false");
      state.status.textContent = source.id === "alloha" ? "Alloha открывается через плеер Kinomix." : source.id === "turbo" ? "Turbo может запросить ручную проверку браузера. Если видео недоступно, выберите другой плеер." : "Если видео недоступно, выберите другой плеер.";
    });
    iframe.addEventListener("error", () => {
      if (active === state && iframe.parentElement === state.frame) {
        clearTimeout(state.frameTimer);
        state.frame.setAttribute("aria-busy", "false");
        state.status.textContent = "Плеер не открылся. Выберите другой источник или попробуйте снова.";
      }
    });
    state.frameTimer = setTimeout(() => {
      if (active === state && iframe.parentElement === state.frame) {
        state.frame.setAttribute("aria-busy", "false");
        state.status.textContent = "Плеер долго загружается. Можно выбрать другой источник.";
      }
    }, 20000);
    iframe.src = url;
    state.frame.replaceChildren(iframe);
  }

  async function loadSources(state, force = false) {
    if (active !== state || state.loading) return;
    if (!state.kinopoiskId) {
      state.status.textContent = "Добавьте ссылку на Кинопоиск в карточку фильма, чтобы открыть плееры.";
      state.select.parentElement.hidden = true;
      state.frame.hidden = true;
      state.retry.hidden = true;
      return;
    }
    state.loading = true;
    state.retry.disabled = true;
    state.select.disabled = true;
    state.status.textContent = "Ищу доступные плееры…";
    const controller = new AbortController();
    state.request = controller;
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const saved = cache.get(state.kinopoiskId);
      let sources;
      if (!force && saved && Date.now() - saved.at < 5 * 60000) sources = saved.sources;
      else {
        const url = new URL("https://api.kinobox.tv/api/players");
        url.searchParams.set("kinopoisk", state.kinopoiskId);
        url.searchParams.set("ts", String(session));
        const response = await fetch(url, { credentials: "omit", redirect: "error", signal: controller.signal });
        if (!response.ok) throw new Error("player_service_unavailable");
        sources = moviePlayerSources(await response.json());
        if (cache.size >= 30) cache.delete(cache.keys().next().value);
        cache.set(state.kinopoiskId, { at: Date.now(), sources });
      }
      if (active !== state) return;
      state.sources = sources;
      state.select.replaceChildren(...sources.map(source => {
        const option = document.createElement("option");
        option.value = source.id;
        option.textContent = `Плеер ${source.name}${source.url ? "" : " — недоступен"}`;
        option.disabled = !source.url;
        return option;
      }));
      const preferred = sources.find(row => row.id === choices.get(state.kinopoiskId) && row.url);
      const available = preferred || sources.find(row => row.url);
      if (!available) {
        state.frame.replaceChildren();
        state.frame.hidden = true;
        state.status.textContent = "Для этого фильма плееры пока недоступны. Попробуйте позже.";
        return;
      }
      state.select.disabled = false;
      state.frame.hidden = false;
      state.select.value = available.id;
      if (force) state.frame.replaceChildren();
      displaySource(state);
    } catch {
      if (active === state) state.status.textContent = "Не удалось получить плееры. Проверьте соединение и попробуйте снова.";
    } finally {
      clearTimeout(timer);
      if (active === state) {
        state.loading = false;
        state.retry.disabled = false;
        state.select.disabled = !state.sources.some(source => source.url);
        state.request = null;
      }
    }
  }

  function open(item) {
    if (!item) return;
    close(false);
    const overlay = document.createElement("div");
    overlay.className = "movie-player-overlay";
    overlay.innerHTML = `<section class="movie-player-dialog" role="dialog" aria-modal="true" aria-labelledby="movie-player-title"><header class="movie-player-header"><h2 id="movie-player-title"></h2><button class="ghost-button movie-player-close" type="button" aria-label="Закрыть просмотр">Закрыть</button></header><div class="movie-player-controls"><label for="movie-player-source">Плеер</label><select id="movie-player-source" disabled></select><button class="text-action movie-player-retry" type="button">Попробовать снова</button></div><div class="movie-player-frame" aria-busy="false"></div><p class="movie-player-status" role="status" aria-live="polite"></p></section>`;
    const app = document.getElementById("app");
    const backButton = window.Telegram?.WebApp?.BackButton;
    const state = {
      movieId: String(item.id), kinopoiskId: moviePlayerKinopoiskId(item), title: String(item.title || "Фильм"),
      overlay, app, wasInert: app?.inert || false, oldAriaHidden: app?.getAttribute("aria-hidden") ?? null,
      returnFocus: document.activeElement, sources: [], loading: false,
      select: overlay.querySelector("select"), frame: overlay.querySelector(".movie-player-frame"),
      status: overlay.querySelector(".movie-player-status"), retry: overlay.querySelector(".movie-player-retry"),
      backButton: backButton?.onClick && backButton?.offClick ? backButton : null,
      backWasVisible: Boolean(backButton?.isVisible), backClick: () => close(),
    };
    active = state;
    overlay.querySelector("h2").textContent = state.title;
    overlay.querySelector(".movie-player-close").addEventListener("click", () => close());
    overlay.addEventListener("click", event => { if (event.target === overlay) close(); });
    state.select.addEventListener("change", () => displaySource(state));
    state.retry.addEventListener("click", () => loadSources(state, true));
    if (app) { app.inert = true; app.setAttribute("aria-hidden", "true"); }
    if (state.backButton) { state.backButton.onClick(state.backClick); state.backButton.show(); }
    document.body.classList.add("movie-player-open");
    document.body.appendChild(overlay);
    overlay.querySelector(".movie-player-close").focus();
    loadSources(state);
  }

  document.addEventListener("click", event => {
    const button = event.target.closest?.('[data-action="movie-watch"]');
    if (!button || ui.sheet?.category !== "movies") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    open(savedItem("movies", ui.sheet.id));
  }, true);

  document.addEventListener("keydown", event => {
    if (!active) return;
    if (event.key === "Escape") {
      event.preventDefault(); event.stopImmediatePropagation(); close(); return;
    }
    if (event.key !== "Tab") return;
    const controls = [...active.overlay.querySelectorAll('button:not([disabled]):not([hidden]), select:not([disabled]), iframe')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }, true);

  window.FlowMoviePlayer = { open, close, sync };
  // Эта обёртка загружается после motion.js: окно просмотра закрывается
  // сразу, прежде чем начнётся анимация закрытия лежащей под ним карточки.
  const closeCard = closeSheet;
  closeSheet = function () {
    if (close()) return;
    return closeCard.apply(this, arguments);
  };
})();
