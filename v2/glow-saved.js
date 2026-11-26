/* Flow · Glow — главная «Сохранённого» (этап 1), пересадка R.saved и itemCard из docs/design/glow-prototype/index.html:
   поиск сверху, сетка 9 категорий плитками по 3 со свечением по числу записей, ниже — недавнее.
   Записи — настоящие (savedItems), действия — прежние: saved-section, saved-open, saved-new.
   Разделы приложения, которых нет в прототипе (Дни рождения, Мини-сайты, Пароли, Документы), пока стоят
   теми же плитками после девяти — до решения пользователя (GLOW-ROLLOUT.md, «Решить пользователю» п. 6).
   Проекты открываются из «Ещё». Работает только в Glow. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset.flowSkin !== 'glow' || window.flowGlowSaved) return;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const e = v => esc(String(v ?? ''));
  const I = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ic = { search: I('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'), plus: I('<path d="M12 5v14M5 12h14"/>') };

  const GPAL = [['#ff7a2b', '#1b3a6b'], ['#9fd6ff', '#1a2a6b'], ['#f2a24b', '#7a2a12'], ['#ff7aa8', '#6b2bd9'], ['#d9e46b', '#1f3a2a'], ['#ff3d6e', '#2a1fd1'], ['#4a86a8', '#0b1a24'], ['#d9a35b', '#2a1a0f'], ['#7ad6c8', '#2a1f5b'], ['#c9b8ff', '#2a1f5b']];
  const gwPal = s => { const [a, b] = GPAL[[...String(s)].reduce((x, ch) => (x * 31 + ch.charCodeAt(0)) >>> 0, 7) % GPAL.length]; return `--p1:${a};--p2:${b}`; };
  /* категории прототипа (CATS) → разделы приложения */
  const CATS = [['notes', 'Заметки', 'notes'], ['lists', 'Списки', 'lists'], ['movies', 'Фильмы', 'movies'], ['recipes', 'Рецепты', 'recipes'], ['links', 'Материалы', 'materials'], ['products', 'Товары', 'products'], ['addresses', 'Адреса', 'addresses'], ['tickets', 'Билеты', 'tickets'], ['cards', 'Карты', 'cards']];
  /* контурные знаки в стиле нижней панели (LINE прототипа) */
  const LINE = {
    notes: '<path d="M7 3.5h7l4.5 4.5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15.5a1 1 0 0 1 1-1Z"/><path d="M14 3.5V8h4.5M9 12.5h6M9 16h4"/>',
    lists: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 12.5l2.8 2.8L16.5 9"/>',
    movies: '<rect x="3.5" y="5" width="17" height="14" rx="4"/><path d="M10.5 9.5v5l4.2-2.5Z"/>',
    recipes: '<path d="M3.5 12h17a8.5 8.5 0 0 1-17 0Z"/><path d="M12.5 3l-3.5 6M17.5 4l-4.5 5"/>',
    links: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>',
    products: '<path d="M5.5 8.5h13l-1 11a1.5 1.5 0 0 1-1.5 1.4H8a1.5 1.5 0 0 1-1.5-1.4Z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
    addresses: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
    tickets: '<path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2.5 2.5 0 0 0 0-5Z"/><path d="M14.5 6.5v11" stroke-dasharray="1.6 2.4"/>',
    cards: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M3 10h18M7 14.5h4"/>',
    // временные плитки разделов приложения — значки из набора прототипа (ic.key, ic.file, подарок, рабочий стол)
    birthdays: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-2-4-6-3-5 0M12 8c2-4 6-3 5 0"/>',
    sites: '<rect x="3" y="4.5" width="18" height="12" rx="2.5"/><path d="M9 20h6M12 16.5V20"/>',
    vault: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2"/>',
    docs: '<path d="M7 3.5h7l4.5 4.5v12a1 1 0 0 1-1 1h-10.5a1 1 0 0 1-1-1v-15.5a1 1 0 0 1 1-1Z"/><path d="M14 3.5V8h4.5"/>'
  };
  const EXTRA = [
    ['birthdays', 'Дни рождения', 'data-action="saved-section" data-category="birthdays"', () => typeof birthdays === 'function' ? birthdays().length : 0],
    ['sites', 'Мини-сайты', 'data-action="saved-section" data-category="sites"', () => typeof siteItems === 'function' ? siteItems().length : 0],
    ['vault', 'Пароли', 'data-action="navigate" data-page="vault"', () => 0],
    ['docs', 'Документы', 'data-action="navigate" data-page="docs"', () => 0]
  ];
  const glyph = c => `<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${LINE[c]}</svg>`;
  const count = key => savedItems(key).length;

  /* запись → карточка itemCard прототипа */
  const realCategory = (key, item) => key === 'materials' ? materialCategoryOf(item) : key;
  const plain = v => String(v || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  function cardModel(key, item) {
    const cat = realCategory(key, item);
    if (key === 'notes') return { k: 'Заметка', t: item.title || 'Без названия', p: typeof notePlain === 'function' ? notePlain(item.description, item.title) : plain(item.description) };
    if (key === 'lists') { const list = item.items || [], done = list.filter(x => x.done).length;
      return { k: 'Список', t: item.packing?.config?.destination || item.title, p: list.length ? (done ? `${done} из ${list.length}` : `${list.length} ${word(list.length, 'позиция', 'позиции', 'позиций')}`) : plain(item.description), v: list.length ? done / list.length : null }; }
    if (key === 'movies') return { k: item.seasons || item.series ? 'Сериал' : 'Фильм', t: item.title, poster: true, img: typeof movieCoverSource === 'function' ? movieCoverSource(item) : '' };
    if (key === 'recipes') return { k: 'Рецепт', t: item.title, p: [item.minutes ? `${item.minutes} мин` : '', (item.ingredients || []).slice(0, 3).map(x => x.name || x.title || x).filter(v => typeof v === 'string').join(', ')].filter(Boolean).join(' · ') || plain(item.description) };
    if (key === 'materials') return { k: { links: 'Ссылка', posts: 'Пост', files: 'Файл' }[cat] || 'Материал', t: item.title, p: plain(item.description) || item.source || item.topic || '' };
    if (key === 'products') return { k: 'Товар', t: item.title, p: [typeof productStoreName === 'function' ? productStoreName(item) : item.store, Number(item.price) > 0 && typeof rub === 'function' ? rub(item.price) : ''].filter(Boolean).join(' · ') };
    if (key === 'addresses') return { k: 'Адрес', t: item.title, p: [item.address, item.city].filter(Boolean).join(', ') };
    if (key === 'tickets') return { k: 'Билет', t: item.title, p: [item.eventDate ? shortDate(item.eventDate) : '', item.seat].filter(Boolean).join(' · ') };
    return { k: 'Карта', t: item.title, p: plain(item.description) };
  }
  function itemCard(key, item, k) {
    const x = cardModel(key, item), attrs = `data-action="saved-open" data-category="${e(realCategory(key, item))}" data-id="${e(item.id)}"`;
    return x.poster
      ? `<button type="button" class="glass card poster in press${x.img ? ' has-img' : ''}" ${attrs} style="${gwPal(x.t || x.title || '')};animation-delay:${k * 50}ms"><span class="art">${x.img ? `<img class="pimg" src="${e(x.img)}" alt="" loading="lazy" onerror="this.parentElement.parentElement.classList.remove('has-img');this.remove()">` : ''}</span><span class="cap"><span class="k">${x.k}</span><b style="display:block">${e(x.t)}</b></span></button>`
      : `<button type="button" class="glass card in press" ${attrs} style="animation-delay:${k * 50}ms"><span class="k">${x.k}</span><b>${e(x.t)}</b><p>${e(x.p)}</p>${x.v != null ? `<span class="gw-bar" style="--v:${x.v}"><i></i></span>` : ''}</button>`;
  }
  const stamp = item => String(item.updated || item.created || '');
  function allItems() { return CATS.flatMap(([, , key]) => savedItems(key).map(item => ({ key, item }))); }

  let query = '';
  function foundHTML() {
    const s = query.trim().toLocaleLowerCase('ru-RU'); if (!s) return '';
    const hits = allItems().filter(({ key, item }) => { const x = cardModel(key, item); return `${x.t} ${x.p || ''} ${x.k}`.toLocaleLowerCase('ru-RU').includes(s); });
    return hits.length ? `<div class="sect"><h2>Найдено</h2><em>${hits.length}</em></div><div class="grid" style="margin-top:0">${hits.slice(0, 40).map(({ key, item }, k) => itemCard(key, item, k)).join('')}</div>`
      : '<div class="glass gw-empty in" style="margin-top:14px">Ничего не нашлось</div>';
  }

  /* ── R.saved ── */
  const native = window.renderSavedOverview;
  window.renderSavedOverview = function () {
    const tiles = [...CATS.map(([c, l, key]) => [c, l, `data-action="saved-section" data-category="${key}"`, count(key)])]; // только 9 разделов прототипа: Пароли и Документы — в «Ещё», дни рождения — в «Ближайшем» Плана
    const max = Math.max(1, ...tiles.map(t => t[3]));
    const s = query.trim().toLocaleLowerCase('ru-RU');
    const recent = allItems().sort((a, b) => stamp(b.item).localeCompare(stamp(a.item))).slice(0, 4);
    return `<div class="gw gw-saved">
  <div class="srow"><label class="glass search"><span>${ic.search}</span><input id="gw-q" type="search" placeholder="Найти в сохранённом" autocomplete="off" value="${e(query)}" aria-label="Найти в сохранённом"></label><button type="button" class="ib glass" data-action="saved-new" aria-label="Сохранить">${ic.plus}</button></div>
  <div id="gw-found">${foundHTML()}</div>
  <div class="cats" id="gw-cats">${tiles.map(([c, l, attrs, n], k) => `<button type="button" class="glass cat press in" ${attrs} data-name="${e(l.toLocaleLowerCase('ru-RU'))}" aria-label="${e(l)}, ${n}" style="animation-delay:${k * 35}ms;--gw-lvl:${(.2 + .8 * n / max).toFixed(2)}${s && !l.toLocaleLowerCase('ru-RU').includes(s) ? ';display:none' : ''}"><span class="cg"></span>${glyph(c)}<b>${l}</b></button>`).join('')}</div>
  <div class="gap" id="gw-recentH"${s ? ' style="display:none"' : ''}></div>
  <div class="grid" id="gw-recent" style="margin-top:0${s ? ';display:none' : ''}">${recent.map(({ key, item }, k) => itemCard(key, item, k)).join('')}</div></div>`;
  };
  window.flowGlowSaved = { native };

  /* поиск на месте, без перерисовки раздела (как q.oninput прототипа) */
  document.addEventListener('input', ev => {
    const q = ev.target.closest?.('.gw-saved #gw-q'); if (!q) return;
    query = q.value; const el = q.closest('.gw-saved'), s = query.trim().toLocaleLowerCase('ru-RU');
    $$('#gw-cats .cat', el).forEach(b => { b.style.display = !s || b.dataset.name.includes(s) ? '' : 'none'; });
    $('#gw-recent', el).style.display = $('#gw-recentH', el).style.display = s ? 'none' : '';
    $('#gw-found', el).innerHTML = foundHTML();
  });
  // перерисовка приложения (тост, синхронизация) пересобирает раздел — поле поиска остаётся в фокусе
  let focused = false, caret = 0;
  document.addEventListener('focusin', ev => { if (ev.target.id === 'gw-q') focused = true; });
  document.addEventListener('focusout', ev => { if (ev.target.id === 'gw-q') { caret = ev.target.selectionStart || 0; setTimeout(() => { if (!document.getElementById('gw-q')?.isConnected || document.activeElement?.id !== 'gw-q') focused = document.activeElement === document.body && focused; }, 0); } });
  new MutationObserver(() => {
    const q = document.getElementById('gw-q');
    if (q && focused && document.activeElement !== q && (document.activeElement === document.body || !document.activeElement)) { q.focus({ preventScroll: true }); try { q.setSelectionRange(caret, caret); } catch {} }
  }).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  // уход в раздел — поиск сбрасывается, как в прототипе при новом показе экрана
  document.addEventListener('click', ev => { if (ev.target.closest?.('.gw-saved [data-action="saved-section"],.gw-saved [data-action="navigate"]')) { query = ''; focused = false; } }, true);

  if (typeof render === 'function' && ui.page === 'saved' && ui.savedCategory === 'overview' && document.querySelector('.dm-main')) render();
})();
