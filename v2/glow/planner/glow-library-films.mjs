import { getModuleHost } from './runtime-session.js';
import { libraryLease, newId, openExternal, palette, records, refreshLibraryScreen, rowId, safeURL, saveRecord, titleOf } from './glow-library-store.mjs';
import { openRecordEditor } from './glow-library-form.mjs';

const status = { want: 'Хочу посмотреть', watching: 'Смотрю', done: 'Посмотрел', dropped: 'Бросил' };
const phase = Object.fromEntries(Object.entries(status).map(([key, value]) => [value, key]));
const imdbId = value => String(value || '').match(/(?:^|\/title\/)(tt\d+)(?:\/|$)/)?.[1] || '';
const cartoon = title => /мультфильм|анимация|аниме|animation/i.test(title);
const seasonSelection = new Map();
const candidateIds = new Map();
let searchVersion = 0;
let marathonsLoaded = false;
let marathonsPending;
let marathonDraft;
let editingMarathon = null;
let lookupOwner;

function catalogueItem(row) {
  return { i: imdbId(row.imdbUrl), t: titleOf(row), y: Number(row.year) || '', s: row.kind === 'series', a: cartoon(row.genre || ''),
    g: esc2(row.genre || ''), img: esc2(safeURL(row.poster || row.coverPath)), kp: Number(row.kpRating ?? row.kinopoiskRating) || 0,
    im: Number(row.imdbRating) || 0, why: row.why || '', record: row };
}

export function adoptMovies(snapshot) {
  FILMS.splice(0, FILMS.length, ...(snapshot?.saved.movies || []).filter(row => !row.skipped).map(record => {
    const row = record;
    const c = catalogueItem(row);
    const seasons = Array.isArray(row.episodes) ? row.episodes.filter(season => Number.isInteger(season.count) && season.count > 0) : [];
    const series = seasons.length ? { seasons,
      cur: Math.min(seasons.length - 1, seasonSelection.get(record.id) || 0),
      eps: seasons.map(season => season.count), seen: seasons.map(season => season.seen?.length || 0) } : null;
    return { ...c, id: rowId(record.id), st: phase[row.status] || 'want', k: c.s ? 's' : c.a ? 'a' : 'f', p: palette,
      sh: 'ring', bm: !!row.pinned, r: Math.min(10, Math.max(0, Number(row.rating) || 0)), rev: row.review || '',
      desc: row.plot || row.hook || row.description, d: row.minutes > 0 ? Number(row.minutes) + ' мин' : '', series, record };
  }));
  CATF.splice(0, CATF.length, ...FILMS.filter(film => film.i));
  if (!snapshot) {
    MARATHONS.length = RECO.length = FR.length = 0;
    S.rpicks = [];
    S.rgone.clear();
    S.mnew = { t: '', items: [] };
    marathonsLoaded = false;
    marathonsPending = marathonDraft = editingMarathon = null;
    candidateIds.clear();
    seasonSelection.clear();
    lookupOwner = null;
    if ($('#fsheet').classList.contains('on')) closeFS();
  }
}
CATF.length = RECO.length = MARATHONS.length = FR.length = 0;
async function movieCall(operation, data = {}) {
  const lease = libraryLease();
  lookupOwner ||= getModuleHost('movies').catch(error => { lookupOwner = null; throw error; });
  const host = await lookupOwner;
  const result = await host.request(operation, data);
  if (!host.isCurrent() || lease !== libraryLease() || !result || result.error) throw Error('movie_provider');
  return result;
}

function match(candidate) {
  return records('movies').find(row => (candidate.i && imdbId(row.imdbUrl) === candidate.i) ||
    (norm(row.title || '') === norm(candidate.t) && (!row.year || !candidate.y || row.year === candidate.y)));
}
async function saveCandidate(candidate, stage, control) {
  const row = candidate.record;
  const existing = match(candidate);
  const key = candidate.i || candidate.t + candidate.y;
  if (!candidateIds.has(key)) candidateIds.set(key, newId());
  control.disabled = true;
  const id = await saveRecord('movies', existing?.id || candidateIds.get(key), target => {
    if (!existing) Object.assign(target, {
      title: candidate.t, year: candidate.y || undefined, kind: candidate.s ? 'series' : 'movie', originalTitle: row.originalTitle || '',
      genre: row.genre || '', description: row.why || '', imdbUrl: row.imdbUrl || '', kinopoiskUrl: row.kpUrl || '',
      kinopoiskRating: candidate.kp, imdbRating: candidate.im, coverPath: safeURL(row.poster || row.coverPath),
    });
    target.status = status[stage];
    target.skipped = stage === 'dropped';
  }, { create: !existing });
  control.disabled = false;
  if (id) { candidateIds.delete(key); sfx('pick'); buzz(8); }
  return id;
}

const rawFind = openFS;
openFS = mode => {
  searchVersion++;
  rawFind(mode);
  $('#fsres').candidates = null;
  $('#fsres').innerHTML = '<button class="btn glass" data-film-manual>Добавить вручную</button>';
};
let searchDelay;
$('#fsq').oninput = event => {
  clearTimeout(searchDelay);
  const input = event.currentTarget;
  const term = input.value.trim();
  const version = ++searchVersion;
  const lease = libraryLease();
  const box = $('#fsres');
  const manual = '<button class="btn glass" data-film-manual>Добавить вручную</button>';
  const mine = term ? FILMS.filter(film => norm(film.t).includes(norm(term))).map(f => fsRow(f, true)).join('') : '';
  box.innerHTML = mine + manual;
  if (term.length < 2) return;
  searchDelay = setTimeout(async () => {
    try {
      const answer = await movieCall('movie_find', { query: term.slice(0, 500) });
      if (version !== searchVersion || lease !== libraryLease() || !$('#fsheet').classList.contains('on')) return;
      const candidates = (answer.found || []).filter(item => item?.title).map(catalogueItem).filter(c => !match(c));
      const rows = candidates.map((c, i) => fsRow({ ...catFilm(c), i: String(i), s: c.s }, false)).join('');
      box.innerHTML = mine + rows + (!rows && !mine ? '<div class="empty">Ничего не нашлось</div>' : '') + manual;
      box.candidates = candidates;
    } catch {
      if (version === searchVersion && lease === libraryLease() && $('#fsheet').classList.contains('on')) box.innerHTML = mine + '<div class="empty">Каталог недоступен</div>' + manual;
    }
  }, 300);
};
$('#fsres').addEventListener('click', async event => {
  const add = event.target.closest('[data-addc]');
  const manual = event.target.closest('[data-film-manual]');
  if (!add && !manual) return;
  event.stopImmediatePropagation();
  if (manual) {
    closeFS();
    openRecordEditor('movies', null, { saved: id => openFilm(rowId(id)) });
    return;
  }
  const candidate = $('#fsres').candidates?.[Number(add.dataset.addc)];
  if (!candidate) return;
  const id = await saveCandidate(candidate, 'want', add);
  if (id && add.isConnected) { add.disabled = true; add.innerHTML = ic.check; add.setAttribute('aria-label', 'Добавлено'); }
}, true);

const filmGridBinding = bindFilms;
bindFilms = screen => {
  filmGridBinding(screen);
  screen.removeEventListener('click', screen._bmH, true);
  const $deck = $('#deck', screen);
  const saveWatching = async (film, card) => {
    if (!film || card?.dataset.saving) return;
    if (card) card.dataset.saving = '1';
    let flight = card && !reduce ? card.animate([{ opacity: 1 }, { opacity: .25, translate: '65px 0' }], { duration: 240 }) : null;
    const ok = await saveRecord('movies', film.record.id, target => { target.status = status.watching; });
    flight?.cancel();
    if (card) delete card.dataset.saving;
    if (ok) { sfx('pick'); toast('Перенесено в «Смотрю»'); }
    else card?.style.removeProperty('transform');
  };
  $('[data-watch]', screen).onclick = () => {
    const top = $('.dcard[data-k="0"]', $deck);
    if (top) void saveWatching(filmById(top.dataset.film), top);
  };
  let down;
  $deck.onpointerdown = event => {
    const card = event.target.closest('.dcard[data-k="0"]');
    down = card && !event.target.closest('[data-bm]') ? { id: event.pointerId, x: event.clientX, card } : null;
  };
  $deck.addEventListener('pointerup', event => {
    const gesture = down;
    down = null;
    if (gesture?.id !== event.pointerId || event.clientX - gesture.x <= 90) return;
    event.stopImmediatePropagation();
    gesture.card.onpointercancel?.();
    void saveWatching(filmById(gesture.card.dataset.film), gesture.card);
  }, true);
  // Capture runs before the card handler, even if pointer capture moved the target onto the card itself.
  $deck.addEventListener('pointerdown', $deck.onpointerdown, true);
  $deck.onpointerdown = null;
  $deck.addEventListener('keydown', event => {
    const card = event.target.closest('.dcard[data-k="0"]');
    if (!card || event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void saveWatching(filmById(card.dataset.film), card);
  }, true);
  screen.addEventListener('click', screen._bmH = event => {
    const button = event.target.closest('[data-bm]');
    if (!button || !screen.contains(button)) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    const film = filmById(button.dataset.bm);
    if (film) void saveRecord('movies', film.record.id, target => { target.pinned = !film.bm; });
  }, true);
  if (!marathonsLoaded && !marathonsPending) void loadMarathons();
  $('[data-newmar]', screen).addEventListener('click', () => { marathonDraft = null; editingMarathon = null; });
};

const rawFilm = R.film;
R.film = () => {
  const f = filmById(S.film);
  if (!f) return '<div class="glass empty">Фильм недоступен</div>';
  return rawFilm() + '<button class="btn glass" data-film-similar>Похожие</button><div id="film-similar"></div>';
};
const rawEpisodes = epsHTML;
epsHTML = s => {
  if (!s.seasons) return rawEpisodes(s);
  const season = s.seasons[s.cur];
  const seen = new Set(season.seen || []);
  const next = Array.from({ length: season.count }, (_, i) => i + 1).find(i => !seen.has(i));
  return Array.from({ length: season.count }, (_, i) => i + 1).map(i =>
    `<button class="ep${seen.has(i) ? ' on' : i === next ? ' next' : ''}" data-ep="${i}" aria-label="Серия ${i}" aria-pressed="${seen.has(i)}">${i}</button>`).join('');
};
const prototypeFilm = bindFilm;
bindFilm = screen => {
  const f = filmById(S.film);
  if (!f) return;
  prototypeFilm(screen);
  const filmId = f.record.id;
  const same = () => curId() === 'film' && S.film === f.id;
  const update = async (fn, repaint = true) => {
    const result = await saveRecord('movies', filmId, fn);
    if (repaint && same()) {
      const input = $('#frev', screen);
      const draft = input?.value;
      const reviewBefore = filmById(f.id)?.record.review || '';
      refreshLibraryScreen('film');
      if (input && draft !== reviewBefore) $('#frev', screen).value = draft;
    }
    return result;
  };
  const play = $('[data-fplay]', screen);
  const url = safeURL(f.record.where) || safeURL(f.record.kinopoiskUrl) || safeURL(f.record.imdbUrl);
  play.disabled = !url;
  play.onclick = () => {
    if (openExternal(url) && f.st === 'want') void update(target => { target.status = status.watching; });
  };
  $$('[data-st]', screen).forEach(button => {
    button.onclick = () => void update(target => { target.status = status[button.dataset.st]; });
  });
  const stars = $('#stars', screen);
  const rate = $('#frate', screen);
  const pointerUp = stars.onpointerup;
  const keyDown = rate.onkeydown;
  stars.onpointerup = event => {
    pointerUp(event);
    const score = f.r;
    void update(target => { target.rating = score; if (!f.series && phase[target.status] !== 'done') target.status = status.done; });
  };
  rate.onkeydown = event => {
    if (!['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault();
    keyDown(event);
    const score = f.r;
    void update(target => { target.rating = score; }, false);
  };
  const review = $('#frev', screen);
  review.oninput = null;
  const sendReview = () => {
    const text = review.value.trim();
    if (text !== (filmById(f.id)?.record.review || '')) void update(target => { target.review = text; }, false);
  };
  review.onchange = sendReview;
  if (f.series) {
    const eps = $('#eps', screen);
    const show = () => { eps.innerHTML = epsHTML(f.series); };
    show();
    $$('[data-season]', screen).forEach((button, index) => {
      button.textContent = 'Сезон ' + f.series.seasons[index].n;
      button.onclick = () => {
        f.series.cur = index;
        seasonSelection.set(filmId, index);
        $$('[data-season]', screen).forEach(node => node.classList.toggle('on', node === button));
        show();
      };
    });
    eps.onclick = event => {
      const button = event.target.closest('[data-ep]');
      if (!button) return;
      const episode = Number(button.dataset.ep);
      const season = f.series.seasons[f.series.cur];
      const seen = new Set(season.seen || []);
      seen.has(episode) ? seen.delete(episode) : seen.add(episode);
      void update(target => {
        const found = target.episodes?.find(row => row.n === season.n);
        if (found) found.seen = [...seen];
      });
    };
  }
  const similar = $('[data-film-similar]', screen);
  similar.onclick = async () => {
    similar.disabled = true;
    const target = $('#film-similar', screen);
    try {
      const answer = await movieCall('movie_similar', { title: f.t, original_title: f.record.originalTitle, year: f.y || null, kind: f.record.kind });
      if (!same() || !similar.isConnected) return;
      renderPicks(target, (answer.picks || []).map(catalogueItem), answer.note);
    } catch { if (same() && similar.isConnected) toast('Не удалось подобрать похожие фильмы'); }
    finally { similar.disabled = false; }
  };
};
export function editFilm() {
  const film = filmById(S.film);
  if (film) openRecordEditor('movies', film.record, { deleted: pop });
}

function renderPicks(box, picks, note) {
  box.innerHTML = picks.length ? picks.map((choice, index) => recoCard({ ...choice, i: String(index), g: choice.g }, index)).join('')
    : `<div class="glass empty">${esc2(note || 'Подборка пока пуста')}</div>`;
  const decide = async (card, stage, button) => {
    const candidate = picks[Number(card.dataset.rc)];
    if (!candidate || card.dataset.saving) return;
    card.dataset.saving = '1';
    const saved = await saveCandidate(candidate, stage, button);
    delete card.dataset.saving;
    if (saved && card.isConnected) card.animate([{ opacity: 1 }, { opacity: 0, translate: (stage === 'want' ? 60 : -60) + 'px 0' }], { duration: 260 }).onfinish = () => card.remove();
  };
  $$('[data-rc]', box).forEach(card => {
    const controls = [['data-rno', 'dropped'], ['data-rseen', 'done'], ['data-rwant', 'want']];
    for (const [key, stage] of controls) {
      const button = $('[' + key + ']', card);
      button.onclick = () => void decide(card, stage, button);
    }
    let x;
    card.onpointerdown = event => { if (!event.target.closest('button')) x = event.clientX; };
    card.onpointerup = event => {
      const delta = event.clientX - x;
      x = undefined;
      if (Math.abs(delta) < 70 || !Number.isFinite(delta)) return;
      const stage = delta > 0 ? 'want' : 'dropped';
      void decide(card, stage, $(delta > 0 ? '[data-rwant]' : '[data-rno]', card));
    };
    card.onpointercancel = () => { x = undefined; };
  });
}

bindReco = screen => {
  const go = $('#rgo', screen);
  const list = $('#rlist', screen);
  let filter = 0;
  const setFilter = () => { filter++; go.disabled = false; go.classList.remove('busy'); renderPicks(list, [], 'Нажмите «Подобрать»'); };
  bindCaps(screen, 'data-rkind', key => { S.rkind = key; setFilter(); });
  $$('[data-rgen]', screen).forEach(button => {
    button.onclick = () => {
      const name = button.dataset.rgen;
      S.rgen.has(name) ? S.rgen.delete(name) : S.rgen.add(name);
      button.classList.toggle('on', S.rgen.has(name));
      setFilter();
    };
  });
  setFilter();
  go.onclick = async () => {
    const current = ++filter;
    go.disabled = true;
    go.classList.add('busy');
    list.innerHTML = recoSkel();
    const kind = S.rkind === 's' ? 'series' : S.rkind === 'all' ? 'any' : 'movie';
    const genre = [...S.rgen, ...(S.rkind === 'a' ? ['Анимация'] : [])].join(', ');
    try {
      let answer = await movieCall('movie_recommend', { kind, genre });
      const began = Date.now();
      while (answer.pending && current === filter && go.isConnected && Date.now() - began < 170000) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (current !== filter || !go.isConnected) return;
        answer = await movieCall('movie_reco_get');
      }
      if (current !== filter || !go.isConnected) return;
      const picks = (answer.picks || []).filter(item => item?.title).map(catalogueItem);
      renderPicks(list, picks, answer.pending ? 'Подборка ещё готовится. Откройте её позже' : answer.note);
    } catch { if (current === filter && go.isConnected) renderPicks(list, [], 'Не удалось получить подборку'); }
    finally { if (current === filter) { go.disabled = false; go.classList.remove('busy'); } }
  };
};

async function universe(action, data = {}) {
  const lease = libraryLease();
  const owner = window.sorokaPlannerSession?.owner();
  if (!owner) throw Error('unauthorized');
  const answer = await window.sorokaUniverse(action, data);
  if (lease !== libraryLease() || !window.sorokaPlannerSession.isCurrent(owner) || !answer || answer.error) throw Error('universe_unavailable');
  return answer;
}
function makeMarathon(row) {
  return { id: rowId(row.id), t: esc2(titleOf(row)), p: palette, record: row,
    items: (row.parts || []).map(part => ({ ...catalogueItem(part), i: part.imdbId, part })),
    seen: new Set(Object.keys(row.progress || {}).filter(key => row.progress[key] === true)) };
}
async function loadMarathons() {
  const lease = libraryLease();
  marathonsPending = universe('lists');
  try {
    const answer = await marathonsPending;
    if (lease !== libraryLease() || !Array.isArray(answer.lists)) return;
    marathonsLoaded = true;
    MARATHONS.splice(0, MARATHONS.length, ...answer.lists.map(makeMarathon));
    if (curId() === 'savedCat' && S.cat === 'movies') refreshLibraryScreen('savedCat');
  } catch {
    if (lease === libraryLease() && curId() === 'savedCat' && S.cat === 'movies') toast('Не удалось загрузить марафоны');
  } finally { if (lease === libraryLease()) marathonsPending = null; }
}
const rawMarathon = R.marathon;
R.marathon = () => marById(S.mar) ? rawMarathon() : '<div class="glass empty">Марафон недоступен</div>';
const rawMarNew = bindMarNew;
bindMarNew = screen => {
  rawMarNew(screen);
  const input = $('#mnq', screen);
  const nativeInput = input.oninput;
  let request = 0;
  input.oninput = event => {
    nativeInput(event);
    const current = ++request;
    const query = input.value.trim();
    if (query.length < 2) return;
    setTimeout(async () => {
      if (current !== request || curId() !== 'marnew') return;
      try {
        const answer = await movieCall('movie_find', { query });
        if (current !== request || curId() !== 'marnew') return;
        CATF.splice(0, CATF.length, ...new Map([...FILMS, ...S.mnew.items, ...(answer.found || []).map(catalogueItem)]
          .filter(choice => choice.i).map(choice => [choice.i, choice])).values());
        $('#mnres', screen).innerHTML = mnRes(query);
      } catch { if (current === request && curId() === 'marnew') toast('Каталог недоступен'); }
    }, 300);
  };
};
function replaceMarathon(row) {
  const m = makeMarathon(row);
  const i = MARATHONS.findIndex(item => item.id === m.id);
  if (i < 0) MARATHONS.unshift(m);
  else MARATHONS[i] = m;
  return m;
}
saveMarathon = async () => {
  if (S.mnew.items.length < 2) return;
  const button = $('#mnsave');
  if (button.disabled) return;
  button.disabled = true;
  marathonDraft ||= crypto.randomUUID();
  const raw = editingMarathon?.record;
  const parts = S.mnew.items.map(choice => choice.part || {
    imdbId: choice.i, title: choice.t, kind: choice.s ? 'series' : 'movie',
    coverPath: safeURL(choice.record.poster || choice.record.coverPath), year: choice.y || null, originalTitle: choice.record.originalTitle || '',
  });
  try {
    const answer = await universe('save', { id: raw?.id || marathonDraft, version: raw?.version,
      title: S.mnew.t.trim() || 'Новый марафон', parts, order_mode: 'manual', source: raw?.source,
      description: raw?.description, include_series: raw?.include_series, progress: raw?.progress });
    const m = replaceMarathon(answer.list);
    marathonDraft = editingMarathon = null;
    if (curId() === 'marnew') { S.mar = m.id; go('marathon'); }
  } catch { if (curId() === 'marnew') toast('Не удалось сохранить марафон'); }
  finally { button.disabled = false; }
};

function showMarathonPart(part) {
  const candidate = { ...part, i: part.i, record: {
    ...part.record, imdbUrl: 'https://www.imdb.com/title/' + part.i + '/',
    kpUrl: /^\d+$/.test(part.part?.kpId || '') ? 'https://www.kinopoisk.ru/' + (part.s ? 'series/' : 'film/') + part.part.kpId + '/' : '',
  } };
  const movie = match(candidate);
  if (movie && !movie.skipped) { openFilm(rowId(movie.id)); return; }
  const lease = libraryLease();
  openSy(`<div class="syh">${esc2(part.t)}<small>${part.y || ''}</small></div>
    <div data-part-info></div><div class="mact"><button class="btn main" data-part-save>В «Хочу»</button>
    <button class="btn glass" data-part-open>Открыть в IMDb</button></div>`, sheet => {
    const info = $('[data-part-info]', sheet);
    $('[data-part-open]', sheet).onclick = () => openExternal(candidate.record.imdbUrl);
    $('[data-part-save]', sheet).onclick = async event => {
      const control = event.currentTarget;
      const id = await saveCandidate(candidate, 'want', control);
      if (id && control.isConnected && libraryLease() === lease) { closeSy(); openFilm(rowId(id)); }
    };
    void universe('part', { imdbId: part.i }).then(value => {
      if (libraryLease() !== lease || !info.isConnected) return;
      info.textContent = [value.genres?.join(', '), value.runtime_minutes ? value.runtime_minutes + ' мин' : '', value.plot].filter(Boolean).join(' · ');
    }).catch(() => {});
  });
}

bindMarathon = screen => {
  const m = marById(S.mar);
  if (!m) return;
  const list = $('#mlist', screen);
  let busy = false;
  for (const row of $$('[data-mi]', list)) {
    const heading = $('.mb', row);
    heading.setAttribute('role', 'button');
    heading.tabIndex = 0;
    heading.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); heading.click(); } };
  }
  list.onclick = async event => {
    const row = event.target.closest('[data-mi]');
    if (!row || busy) return;
    const id = row.dataset.mi;
    const button = event.target.closest('[data-mchk]');
    if (!button) {
      const part = m.items.find(item => item.i === id);
      if (part) showMarathonPart(part);
      return;
    }
    busy = true;
    try {
      const raw = m.record;
      const answer = await universe('save', { id: raw.id, version: raw.version, title: raw.title, parts: raw.parts, source: raw.source,
        description: raw.description, order_mode: raw.order_mode, include_series: raw.include_series,
        progress: { ...raw.progress, [id]: !m.seen.has(id) } });
      replaceMarathon(answer.list);
      refreshLibraryScreen('marathon');
    } catch { toast('Не удалось сохранить отметку'); }
    finally { busy = false; }
  };
};

export function editMarathon() {
  const m = marById(S.mar);
  if (!m) return;
  openSy(`<div class="syh">Марафон</div><div class="mact"><button class="btn main" data-maredit>Изменить</button>
    <button class="btn glass" data-mardelete>Удалить</button></div>`, sheet => {
    $('[data-maredit]', sheet).onclick = () => {
      editingMarathon = m;
      S.mnew = { t: m.record.title, items: m.items.slice() };
      closeSy();
      go('marnew');
    };
    const remove = $('[data-mardelete]', sheet);
    remove.onclick = async () => {
      if (remove.dataset.confirm !== 'yes') { remove.dataset.confirm = 'yes'; remove.textContent = 'Подтвердить удаление'; return; }
      remove.disabled = true;
      try {
        await universe('delete', { id: m.record.id, version: m.record.version });
        MARATHONS.splice(MARATHONS.indexOf(m), 1);
        closeSy();
        if (curId() === 'marathon') pop();
      } catch { toast('Не удалось удалить марафон'); }
      finally { remove.disabled = false; }
    };
  });
}

