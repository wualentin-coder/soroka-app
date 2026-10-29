/* Film-series navigation is a preview, never an automatic library import. */
const movieSeriesCache = new Map();
const moviePartCache = new Map();
// Public catalogue results only; never store library progress or user notes here.
const movieLookupStorage = 'flow.movie-lookups.v1';
function movieLookupRead(key) {
  try {
    const rows=JSON.parse(localStorage.getItem(movieLookupStorage)||'[]');
    const row=Array.isArray(rows)&&rows.find(r=>r.key===key&&r.until>Date.now());
    return row?{...row.value,cachedUntil:row.until,checkedAt:row.at||row.until-30*86400000}:null;
  } catch { return null; }
}
function movieLookupWrite(key,value,ttl) {
  try {
    const stored=JSON.parse(localStorage.getItem(movieLookupStorage)||'[]');
    const rows=(Array.isArray(stored)?stored:[]).filter(r=>r.key!==key&&r.until>Date.now());
    rows.push({key,value,at:Date.now(),until:Date.now()+ttl});
    while(rows.length>48||JSON.stringify(rows).length>600000)rows.shift();
    localStorage.setItem(movieLookupStorage,JSON.stringify(rows));
  } catch { /* Full/disabled storage must not prevent opening a film. */ }
}
const movieStoryCacheKey = parts => 'story:'+JSON.stringify(parts.map(p=>[p.imdbId,p.year||'',p.released||'']).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
function movieStoryValid(answer,parts) {
  if(answer?.status!=='ready'||!Array.isArray(answer.order)||!Array.isArray(answer.unplaced)||!Array.isArray(answer.sources))return false;
  const ids=[...answer.order,...answer.unplaced];
  return ids.length===parts.length&&new Set(ids).size===ids.length&&ids.every(id=>parts.some(p=>p.imdbId===id));
}
let movieSeriesOrder = (() => { try { return localStorage.getItem("flow.movie-series.order.v1") === "release" ? "release" : "story"; } catch { return "story"; } })();
function movieSeriesEligible(item) { return !!item && !movieIsViewed(item) && !item.skipped && !isSeries(item); }
function movieSeriesKey(item) { return JSON.stringify([item.id, item.title, item.year, item.imdbUrl, item.kinopoiskUrl]); }
function movieSeriesCachePut(cache, key, value) {
  if (cache.size >= 64) cache.delete(cache.keys().next().value);
  cache.set(key, value);
}
function movieSeriesVisible(sourceId) {
  return (ui.sheet?.kind === "saved" && ui.sheet.category === "movies" && ui.sheet.id === sourceId && ui.sheet.mode === "view")
    || (ui.sheet?.kind === "movie-series-part" && ui.sheet.sourceId === sourceId);
}
function movieSeriesState(item, retry = false) {
  const key = movieSeriesKey(item);
  let state = movieSeriesCache.get(key);
  if (state && !retry && (state.loading||state.until>Date.now())) return state;
  const stored=!retry&&movieLookupRead('series:'+key);
  if(stored&&Array.isArray(stored.parts)) {
    state={loading:false,error:false,parts:stored.parts,currentId:stored.currentId,until:stored.cachedUntil};
    movieSeriesCachePut(movieSeriesCache,key,state);return state;
  }
  state = { loading: true, error: false, parts: [], currentId: "",until:Date.now()+6*3600000 };
  movieSeriesCachePut(movieSeriesCache, key, state);
  setTimeout(async () => {
    try {
      const answer = await window.sorokaMovieSeries(item.id);
      if (!Array.isArray(answer?.parts)) throw Error("invalid-series");
      state.parts = answer.parts;
      state.currentId = answer.currentId;
      movieLookupWrite('series:'+key,{parts:state.parts,currentId:state.currentId},6*3600000);
    } catch { state.error = true;state.until=Date.now()+60000; }
    state.loading = false;
    const current = savedItem("movies", item.id);
    if (current && movieSeriesKey(current) === key && movieSeriesCache.get(key) === state && movieSeriesVisible(item.id)) render();
  }, 0);
  return state;
}
function movieSeriesOwn(part) {
  if(typeof movieSameIdentity==='function')return savedItems('movies').find(item=>movieSameIdentity(item,part));
  return savedItems("movies").find(item => item.imdbUrl?.match(/\/title\/(tt\d+)/)?.[1] === part.imdbId
    || (part.kinopoiskUrl && item.kinopoiskUrl === part.kinopoiskUrl)
    || (!item.imdbUrl && part.title && part.year && item.year === part.year && [item.title, item.originalTitle].filter(Boolean).some(t => [part.title, part.originalTitle].filter(Boolean).some(p => t.toLocaleLowerCase("ru") === p.toLocaleLowerCase("ru")))));
}
function movieStoryState(item, state, retry = false) {
  if(state.story?.loading&&!retry)return state.story;
  const cacheKey=movieStoryCacheKey(state.parts),stored=!retry&&movieLookupRead(cacheKey);
  if(movieStoryValid(stored,state.parts))return state.story={...stored,at:Date.now(),loading:false,error:false};
  if (state.story && !retry && (state.story.loading || Date.now() - state.story.at < (state.story.status === "ready" ? 6 * 3600000 : 900000))) return state.story;
  const story = { at: Date.now(), checkedAt:Date.now(), loading: true, error: false, status: "unavailable", order: [], unplaced: [], sources: [] };
  state.story = story;
  setTimeout(async () => {
    try {
      const answer = await window.sorokaMovieSeriesOrder(item.id);
      if (!["ready", "unavailable"].includes(answer?.status)) throw Error("invalid-story-order");
      if (answer.status === "ready") {
        const all = [...(answer.order || []), ...(answer.unplaced || [])];
        if (!Array.isArray(answer.order) || !Array.isArray(answer.unplaced) || answer.order.length < 2 || all.length !== state.parts.length
          || new Set(all).size !== all.length || all.some(id => !state.parts.some(p => p.imdbId === id))) throw Error("invalid-story-order");
      }
      Object.assign(story, { status: answer.status, order: answer.order || [], unplaced: answer.unplaced || [], sources: answer.sources || [] });
      if(movieStoryValid(story,state.parts))movieLookupWrite(cacheKey,{status:story.status,order:story.order,unplaced:story.unplaced,sources:story.sources},30*86400000);
    } catch { story.error = true; }
    story.loading = false;
    const current = savedItem("movies", item.id);
    if (current && movieSeriesEligible(current) && movieSeriesCache.get(movieSeriesKey(current)) === state && state.story === story && movieSeriesVisible(item.id)) render();
  }, 0);
  return story;
}
function movieSeriesTrack(item, state, parts, label, unplaced = false) {
  return `<div class="movie-series-track" tabindex="0" role="group" aria-label="${label}">${parts.map((part, i) => {
    const current = part.imdbId === state.currentId, own = movieSeriesOwn(part);
    return `<button type="button" class="movie-series-part ${current ? "is-current" : ""}" data-action="movie-series-open" data-id="${esc(item.id)}" data-imdb="${esc(part.imdbId)}" ${current ? 'aria-current="true"' : ""}><span class="movie-series-cover">${part.coverPath ? `<img src="${esc(part.coverPath)}" alt="" loading="lazy" onerror="this.hidden=true">` : icon("event")}<span class="movie-series-number">${unplaced ? "?" : i + 1}</span></span><b>${esc(part.title)}</b><small>${esc(part.year || "Год не указан")}</small><small class="movie-series-status">${current ? "Этот фильм" : own && movieIsViewed(own) ? "Просмотрено" : own ? "В планах" : ""}</small></button>`;
  }).join("")}</div>`;
}
function movieStoryBody(item, state) {
  const story = movieStoryState(item, state);
  if (story.loading) return `<p class="section-note" role="status">Проверяю сюжетную хронологию по источникам…</p>`;
  if (story.error) return `<p class="section-note" role="status">Не удалось загрузить хронологию.</p><button class="small-button" type="button" data-action="movie-series-story-retry" data-id="${esc(item.id)}">Повторить</button>`;
  if (story.status !== "ready") return `<p class="section-note" role="status">Единая сюжетная хронология не подтверждена. Можно смотреть по порядку выхода.</p>`;
  const byId = id => state.parts.find(p => p.imdbId === id);
  const same = !story.unplaced.length && state.parts.every((p, i) => p.imdbId === story.order[i]);
  const links = story.sources.map(source => {
    try { const u = new URL(source.url); return u.protocol === "https:" ? `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${esc(u.hostname.replace(/^www\./, ""))}${icon("external", "icon-sm")}</a>` : ""; } catch { return ""; }
  }).filter(Boolean).join("");
  return `<div class="mu-cache-state"><small>Сохранённая хронология${story.checkedAt?" · "+new Date(story.checkedAt).toLocaleDateString("ru-RU"):""}</small><button type="button" class="text-action" data-action="movie-series-story-retry" data-id="${esc(item.id)}">Проверить заново</button></div>${same ? '<p class="section-note">Сюжетный порядок совпадает с порядком выхода.</p>' : ""}${movieSeriesTrack(item, state, story.order.map(byId), "Части по хронологии сюжета")}${story.unplaced.length ? `<p class="movie-series-unplaced">Без подтверждённого места в сюжете</p>${movieSeriesTrack(item, state, story.unplaced.map(byId), "Части без подтверждённого места в сюжете", true)}` : ""}${links ? `<div class="movie-series-sources" aria-label="Источники хронологии">${links}</div>` : ""}`;
}
function renderMovieSeries(item) {
  if (!movieSeriesEligible(item) || typeof window.sorokaMovieSeries !== "function") return "";
  const state = movieSeriesState(item);
  if (!state.loading && !state.error && state.parts.length < 2) return "";
  const head = `<div class="movie-series-head"><h3>Серия фильмов</h3>${!state.loading && !state.error && state.parts.length > 1 ? `<button class="small-button" type="button" data-action="movie-series-marathon" data-id="${esc(item.id)}">${icon('plus','icon-sm')}В марафон</button>` : ''}</div>`;
  const tabs = state.loading || state.error ? "" : `<div class="movie-series-order" role="group" aria-label="Порядок просмотра">${[["story", "По сюжету"], ["release", "По выходу"]].map(([mode, label]) => `<button type="button" data-action="movie-series-order" data-id="${esc(item.id)}" data-order="${mode}" aria-pressed="${movieSeriesOrder === mode}">${label}</button>`).join("")}</div>`;
  const body = state.loading ? `<p class="section-note" role="status">Ищу связанные части…</p>`
    : state.error ? `<p class="section-note">Не удалось загрузить части.</p><button class="small-button" type="button" data-action="movie-series-retry" data-id="${esc(item.id)}">Повторить</button>`
    : movieSeriesOrder === "story" ? movieStoryBody(item, state) : movieSeriesTrack(item, state, state.parts, "Части серии по порядку выхода");
  return `<section class="movie-series-block">${head}${tabs}${body}</section>`;
}
function moviePartDto(info) {
  return { title: info.title || info.original_title || "Фильм", originalTitle: info.original_title || "", year: info.year,
    director: info.director || "", genre: info.genres?.[0] || "", tags: info.genres?.slice(1) || [], kind: "movie",
    countries: info.countries || [], minutes: info.runtime_minutes, coverPath: info.poster_url || "",
    imdbUrl: `https://www.imdb.com/title/${info.imdb_id}/`, kinopoiskUrl: info.kp_id ? `https://www.kinopoisk.ru/film/${info.kp_id}/` : "",
    kinopoiskRating: info.kp_rating, imdbRating: info.imdb_rating, infoReady: true };
}
async function moviePartLoad(sheet, retry = false) {
  const key = `${sheet.sourceId}|${sheet.imdbId}`;
  let state = moviePartCache.get(key);
  if (state?.loading || (state?.item && !retry)) return;
  state = { loading: true, item: null, error: false, hookLoading: false, hook: "" };
  movieSeriesCachePut(moviePartCache, key, state);
  try {
    const answer = await window.sorokaMovieSeriesPart(sheet.sourceId, sheet.imdbId);
    if (answer?.imdb_id !== sheet.imdbId || answer.kind !== "movie") throw Error("invalid-part");
    state.item = moviePartDto(answer);
    const own = movieSeriesOwn({ imdbId: sheet.imdbId, ...state.item });
    state.hook = own?.hook || "";
    state.hookLoading = !state.hook;
  } catch { state.error = true; }
  state.loading = false;
  const paint = () => { if (moviePartCache.get(key) === state && ui.sheet?.kind === "movie-series-part" && `${ui.sheet.sourceId}|${ui.sheet.imdbId}` === key) render(); };
  paint();
  if (!state.item || !state.hookLoading) return;
  try { state.hook = (await window.sorokaMovieSeriesHook(sheet.sourceId, sheet.imdbId))?.hook || ""; }
  catch { /* Facts remain usable when the hook is unavailable. */ }
  state.hookLoading = false;
  paint();
}
function renderMovieSeriesPartSheet() {
  const sheet = ui.sheet, state = moviePartCache.get(`${sheet.sourceId}|${sheet.imdbId}`);
  const item = state?.item, own = movieSeriesOwn({ imdbId: sheet.imdbId, ...item });
  const back = `<button type="button" class="small-button" data-action="movie-series-back">${icon("left", "icon-sm")}К исходному фильму</button>`;
  let body = `<p class="section-note" role="status">Загружаю сведения о фильме…</p>`;
  if (state?.error) body = `<p class="section-note">Не удалось загрузить сведения.</p><button class="ghost-button" type="button" data-action="movie-series-part-retry">Повторить</button>`;
  if (item) {
    body = `${movieDetailHero({...item,id:own?.id||""})}<blockquote class="movie-summary">${esc(state.hook || (state.hookLoading ? "Готовлю короткий хук…" : "Краткий хук пока недоступен."))}</blockquote>${moviePersonalRating(own||item)}<div class="sheet-actions">${own ? `<button class="primary-button" type="button" data-action="movie-series-library" data-id="${esc(own.id)}">${movieIsViewed(own) ? "Открыть просмотренный фильм" : "Открыть карточку"}</button>` : `<button class="primary-button" type="button" data-action="movie-series-add">${icon("plus", "icon-sm")}В планы</button>`}</div>`;
  }
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet saved-view-sheet movie-view-sheet movie-series-preview" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${esc(item?.title || sheet.title)}</h2><button type="button" class="icon-button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div>${back}${body}</section></div>`;
}
function movieSeriesAction(action, control) {
  if (action === 'movie-series-marathon') {
    const item = savedItem('movies', control.dataset.id), state = item && movieSeriesCache.get(movieSeriesKey(item));
    if (movieSeriesEligible(item) && state && !state.loading && !state.error && state.parts.length > 1 && confirmSheetDiscard()) universeFromSeries(item,state);
    return true;
  }
  if (action === "movie-series-order" || action === "movie-series-story-retry") {
    const item = savedItem("movies", control.dataset.id);
    if (!movieSeriesEligible(item)) return true;
    const state = movieSeriesCache.get(movieSeriesKey(item));
    if (!state || state.loading || state.error || state.parts.length < 2) return true;
    if (action === "movie-series-order") {
      if (!["release", "story"].includes(control.dataset.order)) return true;
      movieSeriesOrder = control.dataset.order;
      try { localStorage.setItem("flow.movie-series.order.v1", movieSeriesOrder); } catch { /* The selection still lasts for this session. */ }
    }
    if (action === "movie-series-story-retry") movieStoryState(item, state, true);
    const node = activeSheet(), scroll = node?.scrollTop || 0;
    render();
    if (activeSheet()) activeSheet().scrollTop = scroll;
    document.querySelectorAll?.(".movie-series-track").forEach(track => { track.scrollLeft = 0; });
    return true;
  }
  if (action === "movie-series-retry") {
    const item = savedItem("movies", control.dataset.id);
    if (movieSeriesEligible(item)) { movieSeriesState(item, true); render(); }
    return true;
  }
  if (action === "movie-series-open") {
    const item = savedItem("movies", control.dataset.id);
    if (!movieSeriesEligible(item) || !confirmSheetDiscard()) return true;
    const state = movieSeriesCache.get(movieSeriesKey(item)), part = state?.parts.find(p => p.imdbId === control.dataset.imdb);
    if (!part || part.imdbId === state.currentId) return true;
    const sheet = { kind: "movie-series-part", sourceId: item.id, imdbId: part.imdbId, title: part.title, parent: ui.sheet,
      parentScroll: activeSheet()?.scrollTop || 0, trackScroll: document.querySelector(".movie-series-track")?.scrollLeft || 0, justRendered: false };
    ui.sheet = sheet; void moviePartLoad(sheet); render(); return true;
  }
  if (ui.sheet?.kind !== "movie-series-part") return false;
  if (action === "movie-series-back") {
    const sheet = ui.sheet; ui.sheet = sheet.parent; render();
    const node = activeSheet(), track = document.querySelector(".movie-series-track");
    if (node) node.scrollTop = sheet.parentScroll;
    if (track) track.scrollLeft = sheet.trackScroll;
    return true;
  }
  if (action === "movie-series-part-retry") { void moviePartLoad(ui.sheet, true); render(); return true; }
  if (action === "movie-series-library") { openSavedRecord("movies", control.dataset.id); return true; }
  if (action === "movie-series-add") {
    const state = moviePartCache.get(`${ui.sheet.sourceId}|${ui.sheet.imdbId}`);
    if (!state?.item || movieSeriesOwn({ imdbId: ui.sheet.imdbId, ...state.item })) return true;
    data.saved.movies.push({ ...state.item, id: id(), hook: state.hook, status: "Хочу посмотреть", viewed: false, rating: 0, skipped: false, pinned: false, source: "Серия фильмов", created: new Date().toISOString() });
    save(); render(); toast("Добавил в планы"); return true;
  }
  return false;
}


