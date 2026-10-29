/* Movie discovery: personal marathons are saved independently of movie categories. */
const universeUi = { tab: "personal", loaded: false, loading: false, error: "", lists: [], catalog: [], query: "", detail: null, draft: null, search: "", found: [], finding: false, busy: false, story: new Map(), part: new Map() };
const universeApi = (action, fields) => window.sorokaUniverse ? window.sorokaUniverse(action, fields) : Promise.reject(Error("preview_only"));
const universeUuid = () => crypto.randomUUID();
const universeOwn = p => movieSeriesOwn(p);
const universeSeen = (p,d=universeUi.detail) => { if (typeof d?.progress?.[p.imdbId] === 'boolean') return d.progress[p.imdbId]; const own = universeOwn(p); return own ? movieIsViewed(own) : false; };
const universePartsVisible = d => (d.parts || []).filter(p => d.include_series !== false || p.kind !== "series");
const universeProgress = d => { const all = universePartsVisible(d); return { all: all.length, seen: all.filter(p=>universeSeen(p,d)).length, next: universeOrdered(d).find(p => !universeSeen(p,d) && !p.unplaced && !(p.released && p.released>new Date().toISOString().slice(0,10))) }; };
const universePaint = () => { if (ui.page === "saved" && ui.savedCategory === "movies" && ui.savedFilter === "reco" || ui.sheet?.kind?.startsWith("universe-")) render(); };
function universeError(error) {
  return /stale_list|409/.test(String(error)) ? "Список изменился на другом устройстве. Черновик сохранён здесь. Обновите списки и повторите правку."
    : /preview_only/.test(String(error)) ? "Сохранение доступно в рабочем приложении Flow."
    : "Не удалось подключиться. Проверьте связь и повторите — введённое осталось на месте.";
}
function universeOrdered(d) {
  const parts = universePartsVisible(d);
  if (d.order_mode === "manual") return parts;
  if (d.order_mode === "story") {
    const s = universeUi.story.get(universeStoryKey(d));
    if (s?.status !== "ready") return [];
    const byId = new Map(parts.map(p => [p.imdbId, p]));
    return [...s.order.map(id => byId.get(id)).filter(Boolean), ...s.unplaced.map(id => byId.has(id) ? { ...byId.get(id), unplaced: true } : null).filter(Boolean)];
  }
  return [...parts].sort((a, b) => (a.released || String(a.year || 9999)).localeCompare(b.released || String(b.year || 9999)));
}
const universeStoryKey = d => d.parts.map(p => p.imdbId).sort().join("|");
async function universeLoad(retry = false) {
  if (universeUi.loading || universeUi.loaded && !retry && Date.now()-(universeUi.loadedAt||0)<6*3600000) return;
  universeUi.loading = true; universeUi.error = "";
  try {
    const [own, catalog] = await Promise.all([universeApi("lists",{force:retry}), universeApi("search", { query: universeUi.query })]);
    universeUi.lists = own.lists || []; universeUi.catalog = catalog.items || []; universeUi.loaded = true; universeUi.loadedAt=Date.now();
    if(universeUi.detail?.id && !universeUi.busy && !ui.sheet){const current=universeUi.lists.find(x=>x.id===universeUi.detail.id);if(current)universeUi.detail=structuredClone(current);}
  } catch (e) { universeUi.error = universeError(e); }
  universeUi.loading = false; universePaint();
}
function universePoster(p, cls = "") {
  return `<span class="mu-poster ${cls}">${p?.coverPath ? `<img src="${esc(p.coverPath)}" alt="" loading="lazy" onerror="this.hidden=true">` : icon("event")}</span>`;
}
function universeCard(d) {
  const progress = universeProgress(d);
  return `<div class="mu-own-row"><button class="mu-card" type="button" data-action="mu-own" data-id="${esc(d.id)}"><span class="mu-card-art">${d.parts.slice(0, 3).map(p => universePoster(p)).join("")}</span><span class="mu-card-copy"><strong>${esc(d.title)}</strong><small>${progress.seen} из ${progress.all} просмотрено</small><span class="mu-progress"><i style="width:${progress.all ? progress.seen / progress.all * 100 : 0}%"></i></span><small>${d.order_mode === "manual" ? "Свой порядок" : d.order_mode === "story" ? "По сюжету" : "По выходу"}</small></span>${icon("right", "icon-sm")}</button><button class="icon-button mu-card-delete" type="button" data-action="mu-delete" data-id="${esc(d.id)}" aria-label="Удалить марафон ${esc(d.title)}">${icon("trash")}</button></div>`;
}
function renderMovieDiscovery() {
  const worlds = universeUi.tab === "universes";
  const tabs = `<div class="mu-discovery-tabs" role="group" aria-label="Что смотреть"><button type="button" data-action="mu-tab" data-tab="personal" aria-pressed="${!worlds}">Для вас</button><button type="button" data-action="mu-tab" data-tab="universes" aria-pressed="${worlds}">${icon("archive", "icon-sm")}Киновселенные</button></div>`;
  if (!worlds) return tabs + renderMovieReco();
  if (!universeUi.loaded && !universeUi.loading && !universeUi.error) setTimeout(() => void universeLoad(), 0);
  const s = universeUi;
  if (s.detail) return tabs + renderUniverseDetail(s.detail);
  return `${tabs}<section class="mu-workspace"><div class="mu-heading"><h2>Мои марафоны</h2><span class="mu-heading-actions"><button class="icon-button" type="button" data-action="mu-reload" aria-label="Обновить марафоны">${icon("reset")}</button><button class="small-button" type="button" data-action="mu-new">${icon("plus", "icon-sm")}Свой список</button></span></div>${s.error ? `<p class="form-error" role="alert">${esc(s.error)}</p><button class="small-button" data-action="mu-reload" type="button">Обновить</button>` : ""}${s.loading && !s.loaded ? '<p class="section-note" role="status">Загружаю марафоны…</p>' : s.lists.length ? `<div class="mu-own-list">${s.lists.map(universeCard).join("")}</div>` : '<p class="section-note">Выберите вселенную ниже или соберите свой порядок просмотра.</p>'}<div class="mu-heading"><h2>Выбрать вселенную</h2></div><form id="mu-search" class="mu-search"><label class="sr-only" for="mu-query">Название киновселенной</label><input id="mu-query" name="query" value="${esc(s.query)}" placeholder="Марвел, Форсаж, Гарри Поттер…" maxlength="100"><button class="icon-button" type="submit" aria-label="Найти вселенную" ${s.finding ? "disabled" : ""}>${icon("search")}</button></form>${s.finding ? '<p class="section-note" role="status">Ищу вселенные в каталоге…</p>' : ""}<div class="mu-catalog">${s.catalog.map(d => `<button class="mu-catalog-row" type="button" data-action="mu-source" data-source="${esc(d.source)}">${icon("archive")}<span><b>${esc(d.title)}</b><small>${esc(d.description || "Серия фильмов и связанных историй")}${d.count ? ` · ${d.count} частей` : ""}</small></span>${icon("right", "icon-sm")}</button>`).join("")}</div>${!s.catalog.length && !s.loading && !s.finding ? '<p class="section-note">Ничего не найдено. Попробуйте название первого фильма или создайте свой список.</p>' : ""}</section>`;
}
function renderUniverseDetail(d) {
  if (d.loading) return `<button class="text-action" type="button" data-action="mu-back">${icon("left")}Киновселенные</button><p class="section-note" role="status">Собираю порядок просмотра…</p>`;
  if (d.error) return `<button class="text-action" type="button" data-action="mu-back">${icon("left")}Киновселенные</button><p class="form-error" role="alert">${esc(d.error)}</p><button class="small-button" type="button" data-action="mu-source" data-source="${esc(d.source)}">Повторить</button>`;
  const progress = universeProgress(d), ordered = universeOrdered(d), story = universeUi.story.get(universeStoryKey(d));
  const rows = ordered.map((p, i) => `<div class="mu-part-row ${p.kind==='series'?'is-series':''} ${universeSeen(p) ? "is-seen" : ""}"><button class="mu-tick" type="button" data-action="mu-seen" data-imdb="${esc(p.imdbId)}" aria-label="${universeSeen(p) ? "Снять просмотр" : "Отметить просмотренным"}: ${esc(p.title)}" aria-pressed="${universeSeen(p)}">${universeSeen(p) ? icon("check", "icon-sm") : p.unplaced ? "?" : i + 1}</button><button class="mu-part-open" type="button" data-action="mu-part" data-imdb="${esc(p.imdbId)}">${universePoster(p)}<span><b>${esc(p.title)}</b><small>${[p.year, p.kind === "series" ? "Сериал" : "Фильм", p.released && p.released>new Date().toISOString().slice(0,10) ? "Скоро" : "", p.unplaced ? "Место в сюжете не подтверждено" : universeSeen(p) ? "Просмотрено" : ""].filter(Boolean).map(esc).join(" · ")}</small></span>${icon("right", "icon-sm")}</button></div>`);
  const route=d.order_mode==='release'&&d.parts.some(p=>p.phase) ? [...new Set(ordered.map(p=>p.phase||'Другие части'))].map(phase=>{
    const indices=ordered.map((p,i)=>[p,i]).filter(([p])=>(p.phase||'Другие части')===phase);
    const years=indices.map(([p])=>Number(p.year)).filter(Boolean),from=years.length?Math.min(...years):'',to=years.length?Math.max(...years):'';
    return `<details class="mu-phase" open><summary><span class="mu-phase-name"><b>${esc(phase)}</b><small>${from===to?from:`${from}–${to}`}</small></span><i class="mu-phase-rule"></i><span class="mu-phase-count">${indices.filter(([p])=>universeSeen(p,d)).length} / ${indices.length}</span>${icon('down','icon-sm')}</summary>${indices.map(([,i])=>rows[i]).join('')}</details>`;
  }).join('') : rows.join('');
  return `<section class="mu-workspace"><div class="mu-heading"><button class="text-action" type="button" data-action="mu-back">${icon("left", "icon-sm")}Киновселенные</button>${d.version !== undefined ? '<button type="button" class="small-button" data-action="mu-edit">Изменить</button>' : ""}</div><div class="mu-hero"><div class="mu-hero-art">${d.parts.slice(0, 3).map(p => universePoster(p)).join("")}</div><h2>${esc(d.title)}</h2><small>${d.parts.filter(p=>p.kind!=="series").length} фильмов · ${d.parts.filter(p=>p.kind==="series").length} сериалов</small><p>${esc(d.description || "Личный порядок просмотра")}</p><div class="mu-progress"><i style="width:${progress.all ? progress.seen / progress.all * 100 : 0}%"></i></div><small>${progress.seen} из ${progress.all} просмотрено</small>${d.version === undefined ? `<button class="primary-button" type="button" data-action="mu-start" ${universeUi.busy || !d.parts.length ? "disabled" : ""}>${universeUi.busy ? "Сохраняю…" : "Начать марафон"}</button>` : progress.next ? `<button class="primary-button" type="button" data-action="mu-part" data-imdb="${esc(progress.next.imdbId)}">Продолжить · ${esc(progress.next.title)}</button>` : progress.all && progress.seen === progress.all ? '<p class="mu-complete">Марафон завершён</p>' : ""}</div>${universeUi.error ? `<p class="form-error" role="alert">${esc(universeUi.error)}</p><button class="small-button" type="button" data-action="mu-save-retry" ${universeUi.busy ? "disabled" : ""}>Повторить сохранение</button>` : ""}<div class="movie-series-order" role="group" aria-label="Порядок просмотра">${[["release", "По выходу"], ["story", "По сюжету"], ...(!d.source ? [["manual", "Свой порядок"]] : [])].map(([mode, label]) => `<button type="button" data-action="mu-order" data-order="${mode}" aria-pressed="${d.order_mode === mode}">${label}</button>`).join("")}</div>${d.parts.some(p => p.kind === "series") ? `<button class="small-button mu-series" type="button" data-action="mu-series" aria-pressed="${d.include_series !== false}">${icon(d.include_series !== false ? "check" : "plus", "icon-sm")}Включать сериалы</button>` : ""}${d.order_mode === "story" && story?.loading ? '<p class="section-note" role="status">Проверяю сюжетную хронологию по источникам…</p>' : d.order_mode === "story" && story?.status !== "ready" ? `<p class="section-note">${story?.error ? "Не удалось проверить хронологию." : "Единая сюжетная хронология не подтверждена. Можно смотреть по выходу."}</p><button class="small-button" type="button" data-action="mu-story-retry">Повторить проверку</button>` : ""}${!d.parts.length ? '<p class="section-note">В каталоге не нашлись подтверждённые части. Можно собрать свой список через поиск фильмов.</p><button class="small-button" type="button" data-action="mu-new">Создать свой список</button>' : ""}${d.limited ? '<p class="section-note">Показаны первые 200 частей. Полный состав смотрите в источнике.</p>' : ""}<div class="mu-route">${route}</div>${story?.status === "ready" && d.order_mode === "story" ? `<div class="movie-series-sources">${story.sources.filter(s => /^https:\/\//.test(s.url)).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || "Источник хронологии")}</a>`).join("")}</div>` : ""}<p class="section-note">${d.source ? 'Состав обновляется при открытии, с проверкой раз в 6 часов. Новые части добавляются без сброса прогресса.' : 'Личный список: порядок и состав выбираете вы.'} Отметки марафона сохраняются отдельно от истории библиотеки.</p>${d.sync_error?'<p class="form-error" role="status">Сейчас источник недоступен или ответил не полностью. Сохранённый состав и прогресс на месте; повторить проверку можно кнопкой обновления.</p>':''}${d.version!==undefined?`<div class="mu-manage"><button class="small-button" type="button" data-action="mu-reset" ${universeUi.busy?'disabled':''}>Сбросить прогресс</button><button class="small-button danger-button" type="button" data-action="mu-delete" ${universeUi.busy?'disabled':''}>${icon('trash','icon-sm')}Удалить вселенную</button></div>`:''}${d.sourceUrl ? `<a class="text-action" href="${esc(d.sourceUrl)}" target="_blank" rel="noopener noreferrer">Источник состава${icon("external", "icon-sm")}</a>` : ""}</section>`;
}
async function universeOpenSource(source) {
  const detail = { source, loading: true }; universeUi.detail = detail; universeUi.error = ""; universePaint();
  try {
    const own = universeUi.lists.find(d => d.source === source);
    if (own) { if (universeUi.detail === detail) { universeUi.detail = structuredClone(own); if (own.order_mode === "story") void universeLoadStory(own); } }
    else Object.assign(detail, await universeApi("open", { source }), { order_mode: "release", include_series: true, loading: false });
  } catch (e) { detail.loading = false; detail.error = universeError(e); }
  universePaint();
}
async function universeSave(d, done) {
  if (universeUi.busy) return;
  universeUi.busy = true; universeUi.error = "";
  const snapshot = structuredClone(d); snapshot.id ||= universeUuid(); d.id ||= snapshot.id;
  // Keep the client identity on a failed request so a retry cannot create another list.
  universePaint();
  try {
    const { list } = await universeApi("save", snapshot);
    universeUi.lists = [list, ...universeUi.lists.filter(x => x.id !== list.id)];
    if (done) done(list); else if (universeUi.detail === d) universeUi.detail = structuredClone(list);
    toast("Марафон сохранён");
  } catch (e) { universeUi.error = universeError(e); }
  universeUi.busy = false; universePaint();
}
async function universeLoadStory(d, retry = false) {
  const key = universeStoryKey(d);
  if (universeUi.story.has(key) && !retry) return;
  const state = { loading: true }; universeUi.story.set(key, state); universePaint();
  try { Object.assign(state, await universeApi("order", { parts: d.parts })); } catch { state.error = true; }
  state.loading = false; universePaint();
}
function universeDraft(d) {
  universeUi.draft = d ? structuredClone(d) : { title: "", description: "", parts: [], order_mode: "manual", include_series: true };
  universeUi.draftBaseline = JSON.stringify(universeUi.draft); universeUi.search = ""; universeUi.found = []; universeUi.error = ""; ui.sheet = { kind: "universe-edit" }; render();
}
function renderUniverseSheet() {
  const partMode = ui.sheet.kind === "universe-part", s = universeUi;
  let title, body;
  if (partMode) {
    const p = ui.sheet.part, state = s.part.get(p.imdbId), info = state?.info;
    const own = universeOwn(p), movie = info ? { ...moviePartDto(info), kind: info.kind || p.kind } : { ...p, coverPath: p.coverPath };
    title = movie.title;
    body = `<div class="movie-detail-hero">${movieCoverMarkup(movie, "detail")}<div class="movie-detail-intro"><span class="movie-detail-meta">${[movie.year, info?.genres?.join(", "), info?.countries?.join(", ")].filter(Boolean).map(esc).join(" · ")}</span>${info?.director ? `<span class="movie-detail-director"><small>Режиссёр</small><b>${esc(info.director)}</b></span>` : ""}</div></div>${info ? movieScoresLine(movie) : `<p class="section-note" role="status">${state?.error ? "Не удалось загрузить сведения." : "Загружаю сведения…"}</p>`}${state?.error ? '<button class="small-button" type="button" data-action="mu-part-retry">Повторить</button>' : ""}<blockquote class="mu-hook">${esc(own?.hook || state?.hook || (state?.hookLoading ? "Готовлю короткий хук без спойлеров…" : "Краткий хук пока недоступен."))}</blockquote><div class="sheet-actions"><button class="primary-button" type="button" data-action="mu-add" data-imdb="${esc(p.imdbId)}">${own ? "Открыть карточку в Flow" : "Добавить в планы"}</button><button class="ghost-button" type="button" data-action="mu-seen" data-imdb="${esc(p.imdbId)}">${universeSeen(p) ? "Снять просмотр" : "Уже смотрел"}</button></div>`;
  } else {
    const d = s.draft; title = d.version === undefined ? "Свой список фильмов" : "Изменить марафон";
    body = `<form id="mu-edit-form"><label class="field">Название<input name="title" value="${esc(d.title)}" maxlength="120" required ${s.busy ? "disabled" : ""}></label><label class="field">Описание<textarea name="description" maxlength="300" rows="2" ${s.busy ? "disabled" : ""}>${esc(d.description || "")}</textarea></label></form><form id="mu-film-search" class="mu-search"><label class="sr-only" for="mu-film-query">Найти фильм для списка</label><input id="mu-film-query" name="query" value="${esc(s.search)}" placeholder="Найти фильм или сериал" maxlength="200"><button type="submit" class="icon-button" aria-label="Найти фильм" ${s.finding ? "disabled" : ""}>${icon("search")}</button></form>${s.finding ? '<p class="section-note" role="status">Ищу фильмы…</p>' : ""}<div class="mu-film-results">${s.found.map((p, i) => `<button class="mu-catalog-row" type="button" data-action="mu-pick" data-index="${i}" ${d.parts.some(x => x.imdbId === p.imdbId) ? "disabled" : ""}>${universePoster(p)}<span><b>${esc(p.title)}</b><small>${esc(p.year || "")}${d.parts.some(x => x.imdbId === p.imdbId) ? " · Уже в списке" : ""}</small></span>${icon("plus", "icon-sm")}</button>`).join("")}</div><p class="section-note">${d.parts.length} частей · стрелки меняют ваш порядок просмотра</p><ol class="mu-edit-parts">${d.parts.map((p, i) => `<li><span><b>${esc(p.title)}</b><small>${esc(p.year || "")}</small></span><button type="button" class="icon-button" data-action="mu-move" data-index="${i}" data-direction="-1" aria-label="Выше: ${esc(p.title)}" ${!i ? "disabled" : ""}>${icon("up")}</button><button type="button" class="icon-button" data-action="mu-move" data-index="${i}" data-direction="1" aria-label="Ниже: ${esc(p.title)}" ${i === d.parts.length - 1 ? "disabled" : ""}>${icon("down")}</button><button type="button" class="icon-button" data-action="mu-remove" data-index="${i}" aria-label="Убрать: ${esc(p.title)}">${icon("close")}</button></li>`).join("")}</ol>${s.error ? `<p class="form-error" role="alert">${esc(s.error)}</p><button class="small-button" type="button" data-action="mu-reload">Обновить списки</button>` : ""}<div class="sheet-actions"><button class="primary-button" type="submit" form="mu-edit-form" ${s.busy ? "disabled" : ""}>${s.busy ? "Сохраняю…" : "Сохранить список"}</button>${d.version !== undefined ? `<button class="ghost-button danger-button" type="button" data-action="mu-delete" ${s.busy ? "disabled" : ""}>Удалить марафон</button>` : ""}</div>`;
  }
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet mu-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${esc(title)}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div>${body}</section></div>`;
}
async function universePartLoad(p, retry = false) {
  if (universeUi.part.has(p.imdbId) && !retry) return;
  const state = { loading: true }; universeUi.part.set(p.imdbId, state);
  try { state.info = await universeApi("part", { imdbId: p.imdbId }); state.hookLoading = !universeOwn(p)?.hook; }
  catch { state.error = true; }
  state.loading = false; universePaint();
  if (state.hookLoading) {
    try { state.hook = (await universeApi("hook", { imdbId: p.imdbId }))?.hook; } catch { /* Facts remain available. */ }
    state.hookLoading = false; universePaint();
  }
  if (universeUi.part.size > 64) universeUi.part.delete(universeUi.part.keys().next().value);
}
function universeAdd(p) {
  let own = universeOwn(p);
  if (!own) {
    const state = universeUi.part.get(p.imdbId), info = state?.info;
    own = { ...(info ? moviePartDto(info) : p), id: id(), kind: info?.kind || p.kind, imdbUrl: `https://www.imdb.com/title/${p.imdbId}/`, hook: state?.hook || "", status: "Хочу посмотреть", viewed: false, source: "Киновселенные", created: new Date().toISOString() };
    data.saved.movies.push(own);
  }
  save(); return own;
}
async function universeToggleProgress(p) {
  const d=universeUi.detail;if(!d||universeUi.busy)return;
  d.progress={...d.progress,[p.imdbId]:!universeSeen(p,d)};
  await universeSave(d);
}
async function universeListMutation(op,d) {
  if(!d||d.version===undefined||universeUi.busy)return;
  const prompt=op==='reset'?'Сбросить прогресс этого марафона? История фильмов в библиотеке сохранится.':'Удалить марафон? Фильмы и история в библиотеке сохранятся.';
  if(!window.confirm(prompt))return;
  universeUi.busy=true;universeUi.error='';universePaint();
  try {
    const {list}=await universeApi(op,{id:d.id,version:d.version});
    if(op==='delete'){universeUi.lists=universeUi.lists.filter(x=>x.id!==d.id);if(universeUi.detail?.id===d.id)universeUi.detail=null;}
    else {universeUi.lists=universeUi.lists.map(x=>x.id===list.id?list:x);if(universeUi.detail?.id===list.id)universeUi.detail=structuredClone(list);}
    if(ui.sheet?.kind==='universe-edit')ui.sheet=null;
    toast(op==='reset'?'Прогресс сброшен':'Марафон удалён');
  }catch(e){universeUi.error=universeError(e);}
  universeUi.busy=false;universePaint();
}
function universeAction(action, control) {
  if (!action.startsWith("mu-")) return false;
  const s = universeUi, d = s.detail, key = control.dataset;
  if (s.busy && ["mu-new", "mu-edit", "mu-pick", "mu-move", "mu-remove"].includes(action)) return true;
  if (action === "mu-tab") { s.tab = key.tab === "universes" ? "universes" : "personal"; s.error = ""; if (s.tab === "universes") void universeLoad(); render(); }
  else if (action === "mu-reload") { if (confirmSheetDiscard()) { ui.sheet = null; s.detail = null; void universeLoad(true); render(); } }
  else if (action === "mu-save-retry" && d) void universeSave(d);
  else if (action === "mu-back") { s.detail = null; s.error = ""; render(); }
  else if (action === "mu-source") void universeOpenSource(key.source);
  else if (action === "mu-own") { const own = s.lists.find(x => x.id === key.id); if (own) { s.detail = structuredClone(own); s.error = ""; if (own.order_mode === "story") void universeLoadStory(own); render(); } }
  else if (action === "mu-new" || action === "mu-edit") { if (confirmSheetDiscard()) universeDraft(action === "mu-edit" ? d : null); }
  else if (action === "mu-start") void universeSave(d);
  else if (action === "mu-order" && d && !s.busy) { d.order_mode = key.order; if (key.order === "story") void universeLoadStory(d); if (d.version !== undefined) void universeSave(d); render(); }
  else if (action === "mu-story-retry" && d) void universeLoadStory(d, true);
  else if (action === "mu-series" && d && !s.busy) { d.include_series = d.include_series === false; if (d.version !== undefined) void universeSave(d); render(); }
  else if (action === "mu-pick" && s.draft) { const p = s.found[Number(key.index)]; if (p && !s.draft.parts.some(x => x.imdbId === p.imdbId) && s.draft.parts.length < 200) { s.draft.parts.push(p); s.draft.source = null; s.draft.order_mode = "manual"; } render(); }
  else if (action === "mu-move" && s.draft) { const i = Number(key.index), to = i + Number(key.direction), a = s.draft.parts; if (a[i] && to >= 0 && to < a.length) { [a[i], a[to]] = [a[to], a[i]]; s.draft.source = null; s.draft.order_mode = "manual"; } render(); }
  else if (action === "mu-remove" && s.draft) { s.draft.parts.splice(Number(key.index), 1); s.draft.source = null; render(); }
  else if (action === 'mu-delete' || action === 'mu-reset') void universeListMutation(action==='mu-delete'?'delete':'reset', key.id?s.lists.find(x=>x.id===key.id):ui.sheet?.kind==='universe-edit'?s.draft:d);
  else if (["mu-part", "mu-seen", "mu-add", "mu-part-retry"].includes(action)) {
    const p = ui.sheet?.kind === "universe-part" ? ui.sheet.part : d?.parts?.find(x => x.imdbId === key.imdb);
    if (!p) return true;
    if (action === "mu-part") { ui.sheet = { kind: "universe-part", part: p }; void universePartLoad(p); render(); }
    else if (action === "mu-part-retry") void universePartLoad(p, true);
    else if (action === "mu-seen") void universeToggleProgress(p);
    else { const own = universeOwn(p); if (own) openSavedRecord("movies", own.id); else { universeAdd(p); render(); toast("Добавил в планы"); } }
  }
  return true;
}
function universeInput(event) {
  if (event.target.form?.id !== "mu-edit-form" || !universeUi.draft) return false;
  universeUi.draft[event.target.name] = event.target.value; return true;
}
function universeSubmit(event) {
  const form = event.target, s = universeUi;
  if (!["mu-search", "mu-film-search", "mu-edit-form"].includes(form.id)) return false;
  event.preventDefault();
  if (form.id === "mu-edit-form") {
    if (!s.draft.title.trim()) return true;
    const draft = s.draft;
    void universeSave(draft, list => { if (s.draft === draft) { s.draftBaseline = JSON.stringify(draft); s.detail = structuredClone(list); if (ui.sheet?.kind === "universe-edit") { ui.sheet = null; render(); } } });
  } else if (!s.finding) {
    const films = form.id === "mu-film-search", query = String(new FormData(form).get("query") || "").trim();
    if (films && query.length < 2) return true;
    if (films) s.search = query; else s.query = query;
    s.finding = true; s.error = ""; render();
    const request = films ? window.sorokaMovieFind(query) : universeApi("search", { query });
    Promise.resolve(request).then(answer => {
      if (films) s.found = (answer.found || []).map(p => ({ imdbId: p.imdbUrl?.match(/tt\d+/)?.[0], title: p.title, originalTitle: p.originalTitle, year: p.year, released: "", coverPath: p.poster || "", kind: p.kind || "movie" })).filter(p => p.imdbId);
      else s.catalog = answer.items || [];
      if (films && !s.found.length) s.error = "Фильм не найден. Попробуйте оригинальное название или добавьте год.";
    }).catch(e => s.error = universeError(e)).finally(() => { s.finding = false; universePaint(); });
  }
  return true;
}

function universeSheetDirty() { return ui.sheet?.kind === "universe-edit" && universeUi.draft && JSON.stringify(universeUi.draft) !== universeUi.draftBaseline; }
