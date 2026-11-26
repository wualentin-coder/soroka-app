/* Flow · Glow — разделы и записи «Сохранённого» (этап 1), пересадка из docs/design/glow-prototype/index.html:
   разделы — notesList, listsOverview, recipesOverview, matsOverview, prodsOverview, ticketsOverview (R.savedCat);
   записи — R.list, R.recipe, R.mat, R.prod (вложенные экраны с «Назад»).
   Классы и разметка — прототипа, стили — glow-screens.css (собран кодом). Данные — настоящие,
   действия — прежние data-action приложения (saved-open, saved-new, saved-section-filter, material-kind, saved-filter,
   list-toggle, list-sub-toggle, list-remove, list-item-edit, list-clear-done, recipe-portion-step, recipe-shopping,
   saved-link, saved-summary, saved-viewed, saved-share, post-open-bot, product-track, saved-edit) и прежние формы
   (#list-item-form, #list-edit-form). Фильмы, марафоны, подбор, адреса, карты, заметка-редактор — пока прежние экраны.
   Работает только в Glow. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset.flowSkin !== 'glow' || window.flowGlowSavedCats) return;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const e = v => esc(String(v ?? ''));
  const norm = s => String(s || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
  const plain = v => String(v || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const LI = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ic = { back: LI('<path d="M15 5l-7 7 7 7"/>'), plus: LI('<path d="M12 5v14M5 12h14"/>'), search: LI('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'),
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/></svg>' };
  const pic = { all: LI('<path d="M12 4 3 8.5l9 4.5 9-4.5L12 4Z"/><path d="m3 13 9 4.5 9-4.5"/>'),
    link: LI('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>'),
    post: LI('<path d="M4.5 5.5h15v10h-9l-4.5 3.5v-3.5h-1.5Z"/>'), file: LI('<path d="M7 3.5h6.5L18 8v12.5H7Z"/><path d="M13.5 3.5V8H18"/>'),
    ext: LI('<path d="M13 4.5h6.5V11M19.5 4.5 11 13M17 14v5.5H5.5V8H11"/>'),
    star: '<svg viewBox="0 0 100 100" fill="currentColor"><path d="M50 2C53 36 64 47 98 50C64 53 53 64 50 98C47 64 36 53 2 50C36 47 47 36 50 2Z"/></svg>',
    tag: LI('<path d="M3.5 12V4.5H11l9.5 9.5-7.5 7.5Z"/><circle cx="8" cy="9" r="1.4"/>'), bell: LI('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'),
    down: LI('<path d="M5 8l7 8 4-4 4 4"/><path d="M20 12v4h-4"/>') };
  const LG = { plain: LI('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
    travel: LI('<rect x="4" y="7.5" width="16" height="12" rx="3"/><path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M9 11v5M15 11v5"/>') };
  const ric = { all: pic.all, b: LI('<circle cx="12" cy="13" r="4"/><path d="M12 3v2.5M4.9 6l1.8 1.8M19.1 6l-1.8 1.8M3 20h18"/>'),
    m: LI('<path d="M3.5 11h17a8.5 8.5 0 0 1-17 0Z"/><path d="M9 3.5c-1 1.5 1 2.5 0 4M13 3.5c-1 1.5 1 2.5 0 4"/>'), s: LI('<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14Z"/><path d="M5 19 13 11"/>'),
    d: LI('<path d="M4 13h16v6.5H4z"/><path d="M4 13c0-3 3.5-5 8-5s8 2 8 5M12 8V4.5"/>'), clock: LI('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    cart: LI('<path d="M3.5 4.5h2l2 11h10l2-8H7"/><circle cx="9" cy="19.5" r="1.2"/><circle cx="17" cy="19.5" r="1.2"/>'), minus: LI('<path d="M5 12h14"/>'),
    x: LI('<path d="M6 6l12 12M18 6 6 18"/>'), house: LI('<path d="M4 11 12 4l8 7v8.5H4Z"/><path d="M10 19.5V14h4v5.5"/>') };
  const tic = { film: LI('<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M7.5 4v16M16.5 4v16M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4"/>'),
    train: LI('<rect x="5" y="3.5" width="14" height="14" rx="4"/><path d="M5 11h14M8.5 21l2-3.5M15.5 21l-2-3.5M9 14.3h.01M15 14.3h.01"/>'),
    music: LI('<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
    plane: LI('<path d="M10.5 13.5 4 11l1.5-1.5 7.5.8 3.8-3.8a1.8 1.8 0 0 1 2.5 2.5L15.5 12.8l.8 7.5L14.8 21.8 12.3 15.3 9.5 18v2.5L8 22l-1-3.5L3.5 17.5 5 16h2.5Z"/>'),
    up: LI('<rect x="4" y="5.5" width="16" height="14.5" rx="3.5"/><path d="M4 10.5h16M8.5 3.5v4M15.5 3.5v4"/>'), past: LI('<path d="M4 8.5h16v11H4Z"/><path d="M3 4.5h18v4H3ZM10 12.5h4"/>') };
  const subItem = (t, dn, i, id) => `<div class="st-i${dn ? ' done' : ''}" data-si="${i}"><button type="button" class="sbox" data-action="list-sub-toggle" data-id="${e(id)}" data-index="${i}" aria-label="${dn ? 'Вернуть' : 'Готово'}: ${e(t)}">${ic.check}</button><span>${e(t)}</span></div>`;
  /* капсула прототипа (capsHTML), кнопки несут прежние действия приложения */
  const caps = (list, cur, icons) => `<div class="glass seg kseg" role="tablist"><i class="lamp"></i>${list.map(([k, l, attrs]) => `<button type="button" class="${cur === k ? 'on' : ''}" role="tab" aria-selected="${cur === k}" ${attrs} title="${l}"><span class="ki">${icons[k]}</span><span class="kl"><span>${l}</span></span></button>`).join('')}</div>`;
  const head = (title, back, act = '') => `<header class="gw-head gw-sub"><button type="button" class="ib glass gw-back" data-action="${back}" aria-label="Назад">${ic.back}</button><div class="tt"><h1>${e(title)}</h1></div>${act || '<button type="button" class="ib glass" style="visibility:hidden" tabindex="-1" aria-hidden="true"></button>'}</header>`;
  const searchRow = (id, ph, q, add) => `<div class="srow"><label class="glass search"><span>${ic.search}</span><input id="gw-${id}" type="search" placeholder="${ph}" autocomplete="off" value="${e(q)}" aria-label="${ph}"></label>${add}</div>`;
  const addBtn = label => `<button type="button" class="ib glass" data-action="saved-new" aria-label="${label}">${ic.plus}</button>`;
  /* цвет записи: в прототипе у каждой записи своя пара цветов (данные); у записей приложения поля цвета нет —
     пара из той же палитры прототипа выбирается по названию, у одной записи всегда одна */
  const PAL = [['#ff7a2b', '#1b3a6b'], ['#9fd6ff', '#1a2a6b'], ['#f2a24b', '#7a2a12'], ['#ff7aa8', '#6b2bd9'], ['#d9e46b', '#1f3a2a'], ['#ff3d6e', '#2a1fd1'], ['#4a86a8', '#0b1a24'], ['#d9a35b', '#2a1a0f'], ['#7ad6c8', '#2a1f5b'], ['#c9b8ff', '#2a1f5b']];
  const palPair = s => PAL[[...String(s || '')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % PAL.length];
  const pal = s => { const [a, b] = palPair(s); return `--p1:${a};--p2:${b}`; };
  // билеты — цвет по виду, как в прототипе (кино, поезд, концерт, самолёт)
  const TKPAL = { film: ['#f2a24b', '#7a2a12'], train: ['#9fd6ff', '#1a2a6b'], music: ['#ff7aa8', '#6b2bd9'], plane: ['#c9b8ff', '#2a1f5b'] };
  const tkPal = t => { const [a, b] = TKPAL[tKind(t)]; return `--p1:${a};--p2:${b}`; };
  const local = {}; // поиск и фильтры вида — только на экране, как S.nq/S.lq/S.rk прототипа

  /* ── заметки ── */
  function notesCat() {
    const q = norm(local.nq), sec = ui.savedSection || '';
    const list = savedItems('notes').filter(n => (!sec || noteFolderId(n) === sec) && (!q || norm(`${n.title} ${plain(n.description)}`).includes(q)))
      .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || String(b.updated || b.created || '').localeCompare(String(a.updated || a.created || '')));
    const chips = [['', 'Все'], ...savedSections('notes').map(s => [s.id, s.name])];
    const card = (n, j) => `<button type="button" class="glass ncard in${n.pinned ? ' pinned' : ''}" data-action="saved-open" data-category="notes" data-id="${e(n.id)}" style="animation-delay:${j * 45}ms">${n.pinned ? '<i class="pdot"></i>' : ''}
      <b>${e(n.title || 'Без названия')}</b><p>${e((typeof notePlain === 'function' ? notePlain(n.description, n.title) : plain(n.description)).slice(0, 160))}</p><span class="nfoot"><span>${e(noteDateLabel(n))}</span></span></button>`;
    return `${searchRow('nq', 'Найти в заметках', local.nq || '', addBtn('Новая заметка'))}
  <div class="chips nsec">${chips.map(([id, n]) => `<button type="button" class="chip${sec === id ? ' on' : ''}" data-action="saved-section-filter" data-id="${e(id)}">${e(n)}</button>`).join('')}</div>
  <div class="ngrid" id="gw-ngrid">${list.length ? list.map(card).join('') : '<div class="glass gw-empty in" style="column-span:all">Ничего не нашлось</div>'}</div>`;
  }
  /* ── списки ── */
  const listTitle = L => L.packing?.config?.destination || L.title || 'Список';
  const listRows = L => L.packing ? (L.packing.items || []).filter(r => r.kind !== 'group') : (L.items || []);
  function listsCat() {
    const q = norm(local.lq);
    const ls = savedItems('lists').filter(L => !q || norm(listTitle(L) + ' ' + listRows(L).map(x => x.text).join(' ')).includes(q));
    const card = (L, j) => { const rows = listRows(L), d = rows.filter(x => x.done).length, n = rows.length, rest = rows.filter(x => !x.done).slice(0, 4).map(x => e(x.text)).join(' · ');
      return `<button type="button" class="glass lcard in" data-action="saved-open" data-category="lists" data-id="${e(L.id)}" style="animation-delay:${j * 50}ms"><span class="lic">${L.packing ? LG.travel : LG.plain}</span>
      <span class="lct"><b>${e(listTitle(L))}</b><small>${rest || (n ? 'Всё отмечено' : 'Пустой список')}</small><span class="lbar2"><i style="--v:${n ? d / n : 0}"></i></span></span><em>${d}/${n}</em></button>`; };
    return `${searchRow('lq', 'Найти в списках', local.lq || '', addBtn('Новый список'))}
  <div class="stack" id="gw-lcards" style="margin-top:14px">${ls.length ? ls.map(card).join('') : '<div class="glass gw-empty in">Ничего не нашлось</div>'}</div>`;
  }
  /* ── рецепты ── */
  const RK = [['all', 'Всё', []], ['b', 'Завтрак', ['завтрак']], ['m', 'Обед', ['обед', 'ужин', 'суп']], ['s', 'Салаты', ['салат']], ['d', 'Десерт', ['десерт', 'выпечка']]];
  const RT = [[0, 'Любое'], [15, '15 мин'], [30, '30 мин'], [60, '1 час']];
  const ingName = x => String(typeof x === 'string' ? x : x?.name || x?.title || '').split(/\s+[—–-]\s+/)[0].trim();
  const stem = w => { w = norm(w.trim()); return w.slice(0, Math.max(3, w.length - 2)); };
  const recScore = (r, have) => { const txt = norm((r.ingredients || []).map(ingName).join(' ')); return have.filter(w => txt.includes(stem(w))).length; };
  const minTxt = m => m >= 60 ? `${Math.floor(m / 60)} ч${m % 60 ? ' ' + m % 60 + ' мин' : ''}` : `${m} мин`;
  const difDots = level => { const n = (typeof DIFFICULTY_DOTS === 'object' && DIFFICULTY_DOTS[level]) || 0; return n ? `<span class="rdif" aria-label="Сложность ${n} из 3">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>` : ''; };
  const rimg = (r, cls = '') => `<span class="rimg ${cls}${r.image ? ' has-img' : ''}" style="${pal(r.title)}"><b>${e(String(r.title || '?').trim().charAt(0).toUpperCase())}</b>${r.image ? `<img src="${e(r.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" draggable="false" onerror="this.parentElement.classList.remove('has-img');this.remove()">` : ''}</span>`;
  function recipesCat() {
    const rk = local.rk || 'all', rt = local.rt || 0, have = local.have || [];
    let a = savedItems('recipes').filter(r => (rk === 'all' || RK.find(x => x[0] === rk)[2].includes(String(r.meal || '').toLowerCase())) && (!rt || (Number(r.minutes) || 0) <= rt));
    if (have.length) a = a.map(r => [r, recScore(r, have)]).filter(x => x[1]).sort((x, y) => y[1] - x[1] || (x[0].minutes || 0) - (y[0].minutes || 0)).map(x => x[0]);
    const card = (r, j) => { const sc = have.length ? recScore(r, have) : 0;
      return `<button type="button" class="rcard in${j === 0 ? ' gw-big' : ''}" data-action="saved-open" data-category="recipes" data-id="${e(r.id)}" style="${pal(r.title)};animation-delay:${j * 45}ms" aria-label="${e(r.title)}${r.minutes ? ', ' + minTxt(r.minutes) : ''}">${rimg(r)}
      ${sc ? `<span class="rmatch">${ric.house}${sc} из ${(r.ingredients || []).length}</span>` : ''}
      <span class="rcb"><b>${e(r.title)}</b><span class="rfx">${r.minutes ? `<span>${ric.clock}${minTxt(Number(r.minutes))}</span>` : ''}${difDots(r.difficulty)}</span></span></button>`; };
    const names = new Map(); savedItems('recipes').forEach(r => (r.ingredients || []).forEach(x => { const k = ingName(x).toLowerCase(); if (k && !have.some(h => norm(k).includes(stem(h)))) names.set(k, (names.get(k) || 0) + 1); }));
    const sugg = [...names].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k]) => `<button type="button" class="chip hvs" data-gw-hvadd="${e(k)}">${e(k)}</button>`).join('');
    return `<div class="srow">${caps(RK.map(([k, l]) => [k, l, `data-gw-rk="${k}"`]), rk, ric)}${addBtn('Добавить рецепт')}</div>
  <label class="glass hvbox" id="gw-hvbox"><span class="hvi">${ric.house}</span><span class="hvw" id="gw-hvw">${have.map((w, i) => `<span class="hvc">${e(w)}<button type="button" data-gw-hvrm="${i}" aria-label="Убрать: ${e(w)}">${ric.x}</button></span>`).join('')}<input id="gw-hv" placeholder="${have.length ? 'Ещё продукт' : 'Что есть дома?'}" autocomplete="off" enterkeyhint="done"></span></label>
  <div class="hvsug" id="gw-hvsug">${sugg}</div>
  <div class="rtime" id="gw-rtime">${ric.clock}${RT.map(([v, l]) => `<button type="button" class="${rt === v ? 'on' : ''}" data-gw-rt="${v}">${l}</button>`).join('')}</div>
  <div class="rgrid" id="gw-rgrid">${a.length ? a.map(card).join('') : `<div class="glass gw-empty" style="grid-column:1/-1">${have.length ? 'С этим ничего не нашлось' : 'Пусто'}</div>`}</div>`;
  }
  /* ── материалы ── */
  const host = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const matKind = m => materialCategoryOf(m);
  const matExt = m => (String(m.title || '').match(/\.([a-z0-9]{2,4})$/i)?.[1] || String(m.fileType || '').split('/').pop() || 'FILE').toUpperCase().slice(0, 4);
  const matTile = m => { const k = matKind(m); return `<span class="mtile ${k === 'links' ? 'link' : k === 'posts' ? 'post' : 'file'}" style="${pal(m.title)}"><b>${e(k === 'files' ? matExt(m) : k === 'posts' ? String(m.source || m.title || '?')[0] : (host(m.url) || m.title || '?')[0].toUpperCase())}</b></span>`; };
  const when = m => m.created ? dateLabel(String(m.created).slice(0, 10)) : '';
  function matsCat() {
    const kind = ui.materialKind || '', all = savedItems('materials');
    const hot = all.find(m => matKind(m) === 'links' && !m.viewed);
    const list = all.filter(m => (!kind || matKind(m) === kind) && m !== hot).sort((a, b) => String(b.created || '').localeCompare(String(a.created || '')));
    const row = (m, j) => { const k = matKind(m), unread = k === 'links' && !m.viewed;
      const meta = k === 'links' ? [host(m.url) || m.source, m.minutes ? `${m.minutes} мин` : ''] : k === 'posts' ? [m.source, when(m)] : [m.topic || m.source, when(m)];
      return `<button type="button" class="mrw in${unread ? ' unread' : ''}" data-action="saved-open" data-category="${k}" data-id="${e(m.id)}" style="--p1:var(--a3);animation-delay:${j * 35}ms">${matTile(m)}
      <span class="mrb"><b>${e(m.title)}</b><small>${unread ? '<i class="ud"></i>' : ''}${k === 'links' && m.summary ? `<span class="ms">${pic.star}</span>` : ''}${e(meta.filter(Boolean).join(' · '))}</small></span></button>`; };
    const MK = [['', 'Всё', 'all'], ['links', 'Ссылки', 'link'], ['posts', 'Посты', 'post'], ['files', 'Файлы', 'file']];
    return `<div class="srow">${caps(MK.map(([k, l]) => [k, l, `data-action="material-kind" data-kind="${k}"`]), kind, Object.fromEntries(MK.map(([k, , i]) => [k, pic[i]])))}${addBtn('Сохранить материал')}</div>
  ${hot && (!kind || kind === 'links') ? `<button type="button" class="glass mhot" data-action="saved-open" data-category="links" data-id="${e(hot.id)}" style="${pal(hot.title)}"><i class="mhg"></i>${matTile(hot)}<span class="mrb"><small class="mhk">${pic.link}Дочитать${hot.minutes ? ` · ${hot.minutes} мин` : ''}</small><b>${e(hot.title)}</b><small>${e(host(hot.url) || hot.source || '')}</small></span></button>` : ''}
  <div id="gw-mbox">${list.length ? `<div class="glass mlst">${list.map(row).join('')}</div>` : '<div class="glass gw-empty">Пусто</div>'}</div>`;
  }
  /* ── товары ── */
  const rubs = v => `${Math.round(v).toLocaleString('ru-RU')} ₽`;
  const pStart = p => (typeof productStart === 'function' ? productStart(p) : 0) || Number(p.price) || 0;
  const pOff = p => { const s = pStart(p), n = Number(p.price) || 0; return s && n ? Math.round((1 - n / s) * 100) : 0; };
  const pimg = p => `<span class="rimg${p.image ? ' has-img' : ''}" style="${pal(p.title)}"><b>${e(String(p.title || '?').trim().charAt(0).toUpperCase())}</b>${p.image ? `<img src="${e(p.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" draggable="false" onerror="this.parentElement.classList.remove('has-img');this.remove()">` : ''}</span>`;
  function prodsCat() {
    const pk = local.pk || 'all', all = savedItems('products');
    const tot = all.reduce((a, p) => a + (Number(p.price) || 0), 0), saved = all.reduce((a, p) => a + Math.max(0, pStart(p) - (Number(p.price) || 0)), 0);
    const list = all.filter(p => pk === 'all' || (pk === 'sale' ? pOff(p) > 0 : Number(p.targetPrice) > 0));
    const card = (p, j) => { const off = pOff(p), now = Number(p.price) || 0, tg = Number(p.targetPrice) || 0;
      return `<button type="button" class="pcard in" data-action="saved-open" data-category="products" data-id="${e(p.id)}" style="${pal(p.title)};animation-delay:${j * 40}ms" aria-label="${e(p.title)}${now ? ', ' + rubs(now) : ''}">
      <span class="pph">${pimg(p)}${off > 0 ? `<em class="poff">−${off}%</em>` : off < 0 ? `<em class="poff gw-up">+${-off}%</em>` : ''}${tg ? `<i class="pbell${now && now <= tg ? ' hit' : ''}">${pic.bell}</i>` : ''}</span>
      <span class="pbd"><span class="pprice"><b class="gw-lit">${now ? rubs(now) : '—'}</b>${off ? `<s>${rubs(pStart(p))}</s>` : ''}</span><span class="ptl">${e(p.title)}</span><small>${e(productStoreName(p))}</small></span></button>`; };
    return `<div class="srow">${caps([['all', 'Всё', 'data-gw-pk="all"'], ['sale', 'Скидки', 'data-gw-pk="sale"'], ['wait', 'Жду', 'data-gw-pk="wait"']], pk, { all: pic.all, sale: pic.tag, wait: pic.bell })}${addBtn('Добавить товар')}</div>
  <div class="plate-w pfocus" style="--gw-lvl:.55"><div class="halo"></div><div class="plate"><div class="fill"></div>
    <div class="gw-big"><b class="gw-lit">${Math.round(tot / 1000).toLocaleString('ru-RU')}</b><span>тыс ₽<br>в желаниях</span>${saved ? `<em class="psv">${pic.down}−${rubs(saved)}</em>` : ''}</div></div></div>
  <div class="pgrid" id="gw-pgrid">${list.length ? list.map(card).join('') : '<div class="glass gw-empty" style="grid-column:1/-1">Пусто</div>'}</div>`;
  }
  /* ── билеты ── */
  const tKind = t => t.ticketType === 'train' ? 'train' : t.ticketType === 'flight' ? 'plane' : /кино|фильм|imax/i.test(`${t.title} ${t.venue || ''}`) ? 'film' : 'music';
  const TKN = { film: 'Кино', train: 'Поезд', music: 'Концерт', plane: 'Самолёт' };
  const tkWhen = t => { const at = ticketStart(t); if (!at) return 'Без даты'; const d = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()) - new Date(new Date().toDateString())) / 864e5);
    return `${d === 0 ? 'Сегодня' : d === 1 ? 'Завтра' : at.toLocaleDateString('ru', { day: 'numeric', month: 'short' }).replace('.', '')}${t.eventTime ? ' · ' + t.eventTime : ''}`; };
  function ticketsCat() {
    const past = ui.savedFilter === 'expired', now = Date.now();
    const all = savedItems('tickets').filter(t => past ? ticketExpired(t, now) : !ticketExpired(t, now)).sort((a, b) => ((ticketStart(a) || 0) - (ticketStart(b) || 0)) * (past ? -1 : 1));
    const heroT = !past ? all.find(t => ticketStart(t)) : null, list = all.filter(t => t !== heroT);
    const card = (t, j) => { const k = tKind(t), rows = ticketRows(t), code = rows.find(r => r.svg), seats = [...new Set(rows.map(r => r.seat).filter(Boolean))];
      const route = t.origin || t.destination ? `<span class="tkr"><b>${e(t.origin || '')}</b><i><em>${tic[k]}</em></i><b>${e(t.destination || '')}</b></span>${t.carrier ? `<small class="tkrs">${e(t.carrier)}</small>` : ''}` : t.venue ? `<small class="tkrs">${e(t.venue)}</small>` : '';
      const open = `data-action="saved-open" data-category="tickets" data-id="${e(t.id)}"`;
      return `<div class="tkt in${past ? ' gw-past' : ''}" style="${tkPal(t)};animation-delay:${j * 60}ms"><i class="tkglow"></i>
      <button type="button" class="tkmain" ${open}><span class="tkk">${tic[k]}${TKN[k]} · ${tkWhen(t)}</span><b class="tkt2">${e(t.title)}</b>${route}
        <span class="tks2">${seats.map(s => `<span>${e(s)}</span>`).join('')}</span></button>
      <button type="button" class="tkstub" ${open} aria-label="Код билета">${code?.svg || tic[k]}<small>${rows.length > 1 ? `${rows.length} ${word(rows.length, 'билет', 'билета', 'билетов')}` : 'Код'}</small></button></div>`; };
    let hero = '';
    if (heroT) { const ms = ticketStart(heroT) - now, dd = Math.max(0, Math.floor(ms / 864e5)), hr = Math.max(0, Math.floor(ms % 864e5 / 36e5)), mi = Math.max(0, Math.floor(ms % 36e5 / 6e4)), k = tKind(heroT);
      const tile = (v, l) => `<span class="cdt"><b>${String(v).padStart(2, '0')}</b><small>${l}</small></span>`;
      hero = `<button type="button" class="glass tkfocus" data-action="saved-open" data-category="tickets" data-id="${e(heroT.id)}" style="${tkPal(heroT)}"><i class="tkhg"></i><span class="tkhp tkhi">${tic[k]}</span>
      <span class="tkhb"><small>${TKN[k]} · ${e(heroT.venue || [heroT.origin, heroT.destination].filter(Boolean).join(' → ') || tkWhen(heroT))}</small><b>${e(heroT.title)}</b>
        <span class="cds">${dd ? tile(dd, word(dd, 'день', 'дня', 'дней')) : ''}${tile(hr, 'ч')}${tile(mi, 'мин')}</span></span></button>`; }
    return `<div class="srow">${caps([['all', 'Предстоящие', 'data-action="saved-filter" data-filter="all"'], ['expired', 'Прошедшие', 'data-action="saved-filter" data-filter="expired"']], past ? 'expired' : 'all', { all: tic.up, expired: tic.past })}${addBtn('Добавить билет')}</div>
  ${hero}<div class="tkl" id="gw-tkl">${list.length ? list.map(card).join('') : hero ? '' : '<div class="glass gw-empty">Пусто</div>'}</div>`;
  }

  const CATS = { notes: notesCat, lists: listsCat, recipes: recipesCat, materials: matsCat, products: prodsCat, tickets: ticketsCat };
  const nativePage = window.renderSavedPage;
  window.renderSavedPage = function (...args) {
    const make = CATS[ui.savedCategory];
    if (!make || ui.savedReturn) return nativePage.apply(this, args);
    return `<div class="gw gw-cat">${head('', 'saved-home')}<div class="gw-screen on" data-s="savedCat">${make()}</div></div>`;
  };

  /* ── экраны записей ── */
  function listScreen(L) {
    const rows = [...(L.items || [])].sort(typeof listEntryOrder === 'function' ? listEntryOrder : () => 0), n = rows.length, left = rows.filter(x => !x.done).length;
    const open = local.openItem;
    const lrow = x => {
      const subs = x.subtasks || [], d = subs.filter(s => s.done).length;
      const chip = subs.length ? `<span class="sc${d === subs.length ? ' full' : ''}"><i style="--v:${d / subs.length}"></i>${d}/${subs.length}</span>` : '';
      if (ui.sheet.editItemId === x.id) // правка на месте: прежняя форма #list-edit-form
        return `<form class="lrow open" id="list-edit-form" data-id="${e(x.id)}"><span class="chk" aria-hidden="true"></span><textarea name="text" rows="1" maxlength="200" class="lt" style="background:none;border:0;outline:0;color:inherit;font:inherit;resize:none;width:100%" aria-label="Текст пункта" enterkeyhint="done">${e(x.text)}</textarea></form>`;
      return `<div class="lrow${x.done ? ' done' : ''}${open === x.id ? ' open' : ''}" data-it="${e(x.id)}">
      <button type="button" class="chk" data-action="list-toggle" data-id="${e(x.id)}" aria-label="${x.done ? 'Вернуть' : 'Отметить'}: ${e(x.text)}">${ic.check}</button><span class="ltw" data-gw-open="${e(x.id)}"><span class="lt">${e(x.text)}</span>${chip}</span>
      <div class="more"><div><div class="subs">${subs.map((s, i) => subItem(s.text, s.done, i, x.id)).join('')}</div>
      <div class="st-add"><span class="sp"></span><input class="st-in" data-gw-lsub="${e(x.id)}" placeholder="Подпункт" enterkeyhint="done" autocomplete="off" maxlength="200"><button type="button" class="ldel" data-action="list-remove" data-id="${e(x.id)}" aria-label="Удалить пункт">${LI('<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>')}</button></div>
      <div class="stepper"><button type="button" data-action="list-item-edit" data-id="${e(x.id)}" style="font-size:13px">Изменить</button></div></div></div></div>`;
    };
    const act = rows.filter(x => !x.done), dn = rows.filter(x => x.done);
    let body = '';
    if (act.length) body += `<div class="glass lgrp in" style="animation-delay:80ms">${act.map(lrow).join('')}</div>`;
    if (dn.length) body += `<div class="glass lgrp dg in" style="animation-delay:140ms"><div class="lgh"><b>Готово</b><button type="button" class="lclear" data-action="list-clear-done">Убрать</button></div>${dn.map(lrow).join('')}</div>`;
    if (!n) body = '<div class="glass gw-empty in">Список пуст</div>';
    return `<div class="plate-w lfocus" style="--gw-lvl:${(.25 + .75 * (n ? left / n : 0)).toFixed(2)}"><div class="halo"></div><div class="plate"><div class="fill"></div>
    <div class="gw-big"><b class="gw-lit">${left}</b><span>${word(left, 'пункт', 'пункта', 'пунктов')}<br>из ${n}</span></div></div></div>
  <div id="gw-lbody" style="display:flex;flex-direction:column;gap:10px;margin-top:12px">${body}</div>
  <form class="glass lbar" id="list-item-form"><div class="lin"><input id="gw-lin" name="text" placeholder="Добавить" autocomplete="off" enterkeyhint="done" maxlength="200" aria-label="Новый пункт"><button type="submit" class="ladd" aria-label="Добавить пункт">${ic.plus}</button></div></form>`;
  }
  function recipeScreen(r) {
    const n = recipePortions(r), k = n / Math.max(1, Number(r.servings) || 1), have = local.rhave?.[r.id] || new Set();
    const ings = (r.ingredients || []).map((x, i) => { const line = recipeIngredientLine(x, k), [t, q] = String(line).split(/\s+[—–]\s+/);
      return `<button type="button" class="ingr${have.has(i) ? ' have' : ''}" data-gw-ing="${i}" aria-pressed="${have.has(i)}"><span class="chk">${ic.check}</span><span class="it">${e(t)}</span><span class="iq">${e(q || '')}</span></button>`; }).join('');
    const steps = (r.steps || []).map((s, i) => { const sec = stepSec(s); return `<div class="rst"><span class="rsn">${i + 1}</span><span class="rstt">${e(stepTxt(s))}${sec ? `<em>${ric.clock}${tmTxt(sec)}</em>` : ''}</span></div>`; }).join('');
    const miss = (r.ingredients || []).length - have.size;
    return `<div class="rhero" style="${pal(r.title)}">${rimg(r, 'hero')}</div>
  <h2 class="ftitle rtitle">${e(r.title)}</h2>
  <div class="rfacts">${r.minutes ? `<span>${ric.clock}${minTxt(Number(r.minutes))}</span>` : ''}${difDots(r.difficulty)}<span>${(r.ingredients || []).length} ингр.</span></div>
  <div class="glass ingc">
    <div class="rport"><button type="button" class="ib" data-action="recipe-portion-step" data-step="-1" aria-label="Меньше порций">${ric.minus}</button><span class="rpn"><b class="gw-lit">${n}</b><small>${word(n, 'порция', 'порции', 'порций')}</small></span><button type="button" class="ib" data-action="recipe-portion-step" data-step="1" aria-label="Больше порций">${ic.plus}</button></div>
    <div class="ings">${ings}</div>
    <button type="button" class="btn glass rshop" data-gw-shop${miss ? '' : ' disabled'}>${ric.cart}<span id="gw-rshopt">${miss ? `Недостающее — в «Продукты» · ${miss}` : 'Всё есть'}</span></button></div>
  ${steps ? `<div class="glass rsteps">${steps}</div>` : ''}
  ${(r.steps || []).length ? `<div class="glass mnbar" id="gw-rcbar"><button type="button" class="btn gw-main" data-gw-cook><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l10.5-6.5Z"/></svg>Начать готовить</button></div>` : ''}`;
  }
  /* ── готовка на весь экран (openCook прототипа): шаги листаются, таймеры шагов идут параллельно ── */
  const stepTxt = s => typeof s === 'string' ? s : s?.text || '';
  // время шага — из текста («выпекать 35 минут», «варить 1,5 часа»): у шагов приложения нет отдельного поля
  const stepSec = s => { const t = stepTxt(s).toLocaleLowerCase('ru-RU'), m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:-\s*\d+\s*)?(мин|час|ч\b|сек)/); if (!m) return 0;
    const v = parseFloat(m[1].replace(',', '.')); return Math.round(m[2] === 'сек' ? v : m[2].startsWith('мин') ? v * 60 : v * 3600); };
  const tmTxt = sec => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };
  const CK = { i: -1, timers: new Map(), tick: 0, r: null };
  function cookSlide() {
    const r = CK.r, i = CK.i, N = r.steps.length, n = recipePortions(r), k = n / Math.max(1, Number(r.servings) || 1), h = local.rhave?.[r.id] || new Set();
    if (i < 0) return `<div class="cslide cprep"><small class="ckick">${n} ${word(n, 'порция', 'порции', 'порций')}</small><h2>${e(r.title)}</h2>
    <div class="cings">${(r.ingredients || []).map((x, j) => { const [t, q] = String(recipeIngredientLine(x, k)).split(/\s+[—–]\s+/); return `<button type="button" class="ingr${h.has(j) ? ' have' : ''}" data-gw-cing="${j}"><span class="chk">${ic.check}</span><span class="it">${e(t)}</span><span class="iq">${e(q || '')}</span></button>`; }).join('')}</div></div>`;
    if (i >= N) return `<div class="cslide cfin"><span class="cstar">${pic.star}</span><h2>Готово</h2><button type="button" class="btn gw-main" data-gw-cdone>Приятного аппетита</button></div>`;
    const txt = stepTxt(r.steps[i]), sec = stepSec(r.steps[i]), T = CK.timers.get(i), low = norm(txt);
    const uses = (r.ingredients || []).map(x => String(recipeIngredientLine(x, k))).filter(line => { const w = norm(line.split(/\s+[—–]\s+/)[0]).split(/\s+/)[0]; return w.length > 2 && low.includes(w.slice(0, Math.max(3, w.length - 2))); });
    return `<div class="cslide"><small class="ckick">${i + 1} / ${N}</small><p class="ctext">${e(txt)}</p>
    ${uses.length ? `<div class="cuses">${uses.map(u => `<span>${e(u.replace(/\s+[—–]\s+/, ' · '))}</span>`).join('')}</div>` : ''}
    ${sec ? `<button type="button" class="plate-w ctm${T?.run ? ' run' : ''}${T?.done ? ' done' : ''}" data-gw-ct="${i}" style="--gw-lvl:${T ? Math.max(0, T.left / T.total) : 1}"><div class="halo"></div><div class="plate"><div class="fill"></div>
      <div class="gw-big"><b class="gw-lit" data-gw-tt="${i}">${tmTxt(T ? T.left : sec)}</b><span data-gw-ts="${i}">${T?.done ? 'Готово' : T?.run ? 'Пауза' : 'Запустить'}</span></div></div></button>` : ''}</div>`;
  }
  const cookBars = () => [-1, ...CK.r.steps.map((_, j) => j), CK.r.steps.length].map(j => `<i class="${j < CK.i ? 'gw-past' : j === CK.i ? 'on' : ''}"></i>`).join('');
  const cookChips = () => [...CK.timers].filter(([j, T]) => j !== CK.i && (T.run || T.done)).map(([j, T]) => `<button type="button" class="cchip${T.done ? ' done' : ''}" data-gw-cgo="${j}">${ric.clock}${j + 1} · <span data-gw-tt="${j}">${T.done ? 'готово' : tmTxt(T.left)}</span></button>`).join('');
  function cookPaint(dir = 0) {
    const ck = $('#gw-cook'); if (!ck) return; const st = $('.cstage', ck), old = $('.cslide', st), N = CK.r.steps.length;
    $('.cbars', ck).innerHTML = cookBars(); $('.cchips', ck).innerHTML = cookChips();
    $('[data-gw-cprev]', ck).disabled = CK.i < 0; const nx = $('[data-gw-cnext]', ck); nx.textContent = CK.i < 0 ? 'Начать' : CK.i >= N - 1 ? (CK.i >= N ? '' : 'Готово') : 'Дальше';
    $('.cnav', ck).classList.toggle('fin', CK.i >= N);
    const html = cookSlide();
    if (!old || !dir) { st.innerHTML = html; return; }
    old.style.position = 'absolute';
    old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dir * 70}px)`, filter: 'blur(8px)' }], { duration: 260, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }); setTimeout(() => old.remove(), 260);
    st.insertAdjacentHTML('beforeend', html); const nw = st.lastElementChild;
    nw.animate([{ opacity: 0, transform: `translateX(${dir * 90}px)`, filter: 'blur(8px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 520, easing: 'cubic-bezier(.19,1,.22,1)' });
  }
  function cookGo(i) { const N = CK.r.steps.length; i = Math.max(-1, Math.min(N, i)); if (i === CK.i) return; const dir = i > CK.i ? 1 : -1; CK.i = i; cookPaint(dir); }
  function cookTick() {
    const now = performance.now(); let any = false;
    CK.timers.forEach((T, j) => { if (!T.run) return; any = true; T.left = Math.max(0, T.end - now) / 1000;
      $$(`[data-gw-tt="${j}"]`).forEach(x => { x.textContent = tmTxt(T.left); }); const w = $(`[data-gw-ct="${j}"]`); w && w.style.setProperty('--gw-lvl', T.left / T.total);
      if (T.left <= 0) { T.run = false; T.done = true; try { navigator.vibrate?.([30, 60, 30, 60, 30]); } catch (_) {} toast(`Шаг ${j + 1}: время вышло`);
        if (w) { w.classList.remove('run'); w.classList.add('done'); const s = $(`[data-gw-ts="${j}"]`); if (s) s.textContent = 'Готово'; }
        const c = $('#gw-cook .cchips'); if (c) c.innerHTML = cookChips(); } });
    if (!any) { clearInterval(CK.tick); CK.tick = 0; }
  }
  function cookTimer(j) {
    const sec = stepSec(CK.r.steps[j]); let T = CK.timers.get(j);
    if (!T) { T = { total: sec, left: sec, run: false, done: false }; CK.timers.set(j, T); }
    if (T.done) { T.left = T.total; T.done = false; }
    T.run = !T.run; if (T.run) T.end = performance.now() + T.left * 1000;
    const w = $(`[data-gw-ct="${j}"]`); w.classList.toggle('run', T.run); w.classList.remove('done'); $(`[data-gw-ts="${j}"]`).textContent = T.run ? 'Пауза' : 'Запустить';
    if (T.run && !CK.tick) CK.tick = setInterval(cookTick, 250);
  }
  function openCook(from) {
    const r = savedItem('recipes', ui.sheet?.id); if (!r) return;
    if (CK.r?.id !== r.id) { CK.timers.clear(); } CK.r = r; CK.i = -1;
    $('#gw-cookl')?.remove();
    const l = document.createElement('div'); l.className = 'gw gw-cookl'; l.id = 'gw-cookl';
    l.innerHTML = `<div class="cook on" id="gw-cook" role="dialog" aria-modal="true" aria-label="Готовка" style="${pal(r.title)}"><i class="cbg"${r.image ? ` style="background-image:url('${e(r.image)}')"` : ''}></i>
    <div class="ctop"><button type="button" class="ib glass" data-gw-cclose aria-label="Закрыть">${ric.x}</button><div class="cbars"></div></div>
    <div class="cchips"></div><div class="cstage"></div>
    <div class="cnav"><button type="button" class="ib glass" data-gw-cprev aria-label="Назад">${ic.back}</button><button type="button" class="btn gw-main" data-gw-cnext>Начать</button></div></div>`;
    document.body.appendChild(l); root.classList.add('gw-cooking'); cookPaint(0);
    const ck = $('#gw-cook'), b = (from || ck).getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
    ck.animate([{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${Math.hypot(innerWidth, innerHeight)}px at ${x}px ${y}px)` }], { duration: 620, easing: 'cubic-bezier(.65,0,.35,1)' });
    // свайп по шагу
    const st = $('.cstage', ck); let x0 = null, dx = 0;
    st.addEventListener('pointerdown', ev => { if (ev.target.closest('button')) return; x0 = ev.clientX; dx = 0; });
    st.addEventListener('pointermove', ev => { if (x0 == null) return; dx = ev.clientX - x0; const s = $('.cslide', st); if (s) { s.style.transform = `translateX(${dx * .4}px)`; s.style.opacity = 1 - Math.min(.5, Math.abs(dx) / 400); } });
    const up = () => { if (x0 == null) return; x0 = null; const s = $('.cslide', st); if (s) { s.style.transform = ''; s.style.opacity = ''; } if (Math.abs(dx) > 60) cookGo(CK.i + (dx < 0 ? 1 : -1)); };
    st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  }
  function closeCook() { const l = $('#gw-cookl'); if (!l) return; root.classList.remove('gw-cooking');
    l.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)', filter: 'blur(6px)' }], { duration: 280, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }); setTimeout(() => l.remove(), 280); }
  document.addEventListener('keydown', ev => { if (!$('#gw-cookl')) return; if (ev.key === 'Escape') { ev.stopImmediatePropagation(); closeCook(); } if (ev.key === 'ArrowRight') cookGo(CK.i + 1); if (ev.key === 'ArrowLeft') cookGo(CK.i - 1); }, true);
  /* «Недостающее — в Продукты»: в список покупок — только то, чего нет дома (как список из рецепта в приложении) */
  function shopMissing(btn) {
    const r = savedItem('recipes', ui.sheet?.id); if (!r) return; const have = local.rhave?.[r.id] || new Set(), n = recipePortions(r), k = n / Math.max(1, Number(r.servings) || 1);
    const miss = (r.ingredients || []).map((x, i) => [x, i]).filter(([, i]) => !have.has(i)).map(([x]) => recipeIngredientLine(x, k, true)); if (!miss.length) return;
    const food = savedSections('lists').find(s => s.name === 'Еда');
    data.saved.lists.push({ id: id(), title: `Для ${r.title} · ${n} порц.`, description: 'Из рецепта', topic: food?.name || '', categoryId: food?.id || '', tags: ['покупки'], created: todayIso(), items: miss.map(text => ({ id: id(), text, done: false })) });
    save(); toast(`В список покупок — ${miss.length} ${word(miss.length, 'продукт', 'продукта', 'продуктов')}`);
    btn.animate([{ filter: 'brightness(1.8)', transform: 'scale(.97)' }, { filter: 'none', transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
  }
  document.addEventListener('click', ev => {
    const t = ev.target.closest?.('[data-gw-cook],[data-gw-shop],[data-gw-cclose],[data-gw-cprev],[data-gw-cnext],[data-gw-ct],[data-gw-cgo],[data-gw-cing],[data-gw-cdone]'); if (!t) return;
    const d = t.dataset;
    if (d.gwCook !== undefined) return openCook(t);
    if (d.gwShop !== undefined) return shopMissing(t);
    if (d.gwCclose !== undefined) return closeCook();
    if (d.gwCprev !== undefined) return cookGo(CK.i - 1);
    if (d.gwCnext !== undefined) return cookGo(CK.i + 1);
    if (d.gwCt !== undefined) return cookTimer(Number(d.gwCt));
    if (d.gwCgo !== undefined) return cookGo(Number(d.gwCgo));
    if (d.gwCing !== undefined) { const r = CK.r, h = (local.rhave = local.rhave || {})[r.id] = local.rhave[r.id] || new Set(), j = Number(d.gwCing); h.has(j) ? h.delete(j) : h.add(j); t.classList.toggle('have', h.has(j)); return; }
    if (d.gwCdone !== undefined) { closeCook(); setTimeout(() => toast(`«${CK.r.title}» — приятного аппетита`), 300); }
  });
  function matScreen(m, k) {
    const domain = host(m.url);
    const body = k === 'links' ? `<div class="mact">${m.url ? `<button type="button" class="btn gw-main" data-action="saved-link">${pic.ext}Открыть</button>` : ''}<button type="button" class="btn glass msum${m.summary ? ' done' : ''}" data-action="saved-summary">${pic.star}<span>${m.summary ? 'Пересказано' : 'Перескажи'}</span></button></div>
      ${m.summary ? `<div class="glass msumbox on"><div class="msh">${pic.star}<b>Главное</b></div>${String(m.summary).split(/\n+/).filter(Boolean).map(s => `<p class="msl">${e(s)}</p>`).join('')}</div>` : ''}
      <button type="button" class="mread" data-action="saved-viewed">${m.viewed ? 'Отметить непрочитанным' : 'Прочитано'}</button>`
      : k === 'posts' ? `<div class="glass mpost"><p>${e(plain(postInfo(m, 'body')) || m.description || m.title)}</p></div><div class="mact"><button type="button" class="btn gw-main" data-action="post-open-bot">${pic.ext}Открыть в чате</button></div>`
      : `<div class="mact">${typeof savedFileUrl === 'function' && savedFileUrl(m) ? `<a class="btn gw-main" href="${e(savedFileUrl(m))}" target="_blank" rel="noopener">${pic.ext}Открыть</a>` : ''}<button type="button" class="btn glass" data-action="saved-share">Поделиться</button></div>`;
    const big = k === 'files' ? `<b>${e(matExt(m))}</b>` : `<b>${e((k === 'posts' ? m.source || m.title : domain || m.title || '?')[0].toUpperCase())}</b>`;
    return `<div class="mathero" style="${pal(m.title)}"><i class="fback"></i><span class="mbig ${k === 'links' ? 'link' : k === 'posts' ? 'post' : 'file'}">${big}</span></div>
    <h2 class="ftitle mtitle">${e(m.title)}</h2><div class="fmeta">${e(k === 'links' ? [domain || m.source, m.minutes ? `${m.minutes} мин чтения` : ''].filter(Boolean).join(' · ') : k === 'posts' ? ['Пост', m.source, when(m)].filter(Boolean).join(' · ') : [m.topic, when(m)].filter(Boolean).join(' · '))}</div>${m.description && k !== 'posts' ? `<p class="fdesc">${e(m.description)}</p>` : ''}${body}`;
  }
  function prodScreen(p) {
    const now = Number(p.price) || 0, off = pOff(p), tg = Number(p.targetPrice) || 0;
    const min = Math.round(now * .6 / 10) * 10, step = now > 50000 ? 1000 : now > 5000 ? 100 : 10;
    return `<div class="phero" style="${pal(p.title)}">${pimg(p).replace('class="rimg', 'class="rimg hero')}</div>
  <h2 class="ftitle ptitle">${e(p.title)}</h2><div class="fmeta">${e(productStoreName(p))}</div>
  <div class="ppr"><b class="gw-lit">${now ? rubs(now) : 'Цена не снята'}</b>${off ? `<s>${rubs(pStart(p))}</s><em class="${off > 0 ? '' : 'gw-up'}">${off > 0 ? '−' : '+'}${Math.abs(off)}%</em>` : ''}</div>
  ${now ? `<div class="glass ptgt"><div class="ptr"><span class="pti">${pic.bell}</span><span class="ptb"><b id="gw-ptgv">${tg ? rubs(tg) : 'Не жду'}</b><small id="gw-ptgs">${tg ? (now <= tg ? 'Цена уже ниже — пора брать' : `Ещё ${rubs(now - tg)} до цели`) : 'Сообщу, когда цена опустится'}</small></span></div>
    <input type="range" class="prng" id="gw-prng" data-gw-target="${e(p.id)}" min="${min}" max="${now}" step="${step}" value="${tg || now}" aria-label="Жду цену"></div>` : ''}
  <div class="mact">${p.url ? `<a class="btn gw-main" href="${e(p.url)}" target="_blank" rel="noopener">${pic.ext}Карточка товара</a>` : ''}<button type="button" class="btn glass" data-action="product-track">${p.tracked ? 'Не следить' : 'Следить за ценой'}</button></div>`;
  }
  const SCREENS = { lists: listScreen, recipes: recipeScreen, links: m => matScreen(m, 'links'), posts: m => matScreen(m, 'posts'), files: m => matScreen(m, 'files'), products: prodScreen };
  const nativeSheet = window.renderSavedSheet;
  window.renderSavedSheet = function (...args) {
    const s = ui.sheet, make = SCREENS[s?.category], item = s?.id && make ? savedItem(s.category, s.id) : null;
    if (!item || s.mode === 'edit' || s.mode === 'bot-preview' || item.packing) return nativeSheet.apply(this, args);
    const kind = s.category === 'lists' ? 'list' : s.category === 'recipes' ? 'recipe' : s.category === 'products' ? 'prod' : 'mat';
    // «…» — временно: изменить и удалить запись (в прототипе у вложенных экранов нет действий справа)
    const act = `<button type="button" class="ib glass" data-action="saved-edit" aria-label="Изменить или удалить">${ic.dots}</button>`;
    return `<div class="gw gw-sheet" data-s="${kind}" role="dialog" aria-modal="true" aria-label="${e(item.title)}">${head(kind === 'list' ? item.title : '', 'close-sheet', act)}<div class="gw-screen on gw-sub" data-s="${kind}">${make(item)}</div></div>`;
  };
  window.flowGlowSavedCats = { nativePage, nativeSheet };

  /* ── поиск и фильтры вида на месте, ввод подпунктов, ползунок цены ── */
  document.addEventListener('input', ev => {
    const t = ev.target;
    if (t.id === 'gw-nq' || t.id === 'gw-lq') { local[t.id.slice(3)] = t.value; rerenderKeepFocus(t); }
    if (t.id === 'gw-prng') { const p = savedItem('products', t.dataset.gwTarget), now = Number(p?.price) || 0, v = Number(t.value);
      $('#gw-ptgv').textContent = v >= now ? 'Не жду' : rubs(v); $('#gw-ptgs').textContent = v >= now ? 'Сообщу, когда цена опустится' : `Ещё ${rubs(now - v)} до цели`; }
  });
  document.addEventListener('change', ev => {
    const t = ev.target; if (t.id !== 'gw-prng') return;
    // «Жду цену» — то же поле targetPrice, что в окне товара
    const p = savedItem('products', t.dataset.gwTarget); if (!p) return; const v = Number(t.value);
    p.targetPrice = v >= (Number(p.price) || 0) ? '' : v; save(); toast(p.targetPrice ? `Жду ${rubs(v)}` : 'Цель снята');
  });
  function rerenderKeepFocus(input) { const id = input.id, pos = input.selectionStart; render(); const n = document.getElementById(id); if (n) { n.focus({ preventScroll: true }); try { n.setSelectionRange(pos, pos); } catch {} } }
  document.addEventListener('click', ev => {
    // порции приложение меняет точечно по своим id (updateRecipePortions) — экран прототипа перерисовываем целиком
    if (ev.target.closest?.('.gw-sheet [data-action="recipe-portion-step"]')) { queueMicrotask(() => render()); return; }
    const t = ev.target.closest?.('[data-gw-rk],[data-gw-rt],[data-gw-pk],[data-gw-hvadd],[data-gw-hvrm],[data-gw-ing],[data-gw-open]'); if (!t) return;
    if (t.dataset.gwRk) { local.rk = t.dataset.gwRk; render(); return; }
    if (t.dataset.gwRt !== undefined) { local.rt = Number(t.dataset.gwRt); render(); return; }
    if (t.dataset.gwPk) { local.pk = t.dataset.gwPk; render(); return; }
    if (t.dataset.gwHvadd) { local.have = [...(local.have || []), t.dataset.gwHvadd]; render(); return; }
    if (t.dataset.gwHvrm !== undefined) { local.have = (local.have || []).filter((_, i) => i !== Number(t.dataset.gwHvrm)); render(); return; }
    if (t.dataset.gwIng !== undefined) { const id = ui.sheet?.id; if (!id) return; local.rhave = local.rhave || {}; const h = local.rhave[id] = local.rhave[id] || new Set(), i = Number(t.dataset.gwIng);
      h.has(i) ? h.delete(i) : h.add(i); t.classList.toggle('have', h.has(i)); t.setAttribute('aria-pressed', String(h.has(i)));
      const r = savedItem('recipes', id), miss = (r?.ingredients || []).length - h.size, st = $('#gw-rshopt'); if (st) { st.textContent = miss ? `Недостающее — в «Продукты» · ${miss}` : 'Всё есть'; st.parentElement.disabled = !miss; } return; }
    if (t.dataset.gwOpen) { const row = t.closest('.lrow'), was = row.classList.contains('open');
      $$('.gw-sheet .lrow.open').forEach(r => r.classList.remove('open')); row.classList.toggle('open', !was); local.openItem = was ? null : t.dataset.gwOpen; }
  });
  document.addEventListener('keydown', ev => {
    const t = ev.target; if (ev.key !== 'Enter') return;
    if (t.id === 'gw-hv') { ev.preventDefault(); const v = t.value.trim(); if (v) { local.have = [...(local.have || []), v]; render(); requestAnimationFrame(() => document.getElementById('gw-hv')?.focus()); } return; }
    if (t.dataset?.gwLsub) { // подпункт пункта списка — в entry.subtasks, как в окне списка
      ev.preventDefault(); const v = t.value.trim(); if (!v) return; const L = savedItem('lists', ui.sheet?.id), x = L?.items?.find(i => i.id === t.dataset.gwLsub); if (!x) return;
      x.subtasks = [...(x.subtasks || []), { id: id(), text: v[0].toUpperCase() + v.slice(1), done: false }]; if (x.done) { x.done = false; delete x.doneAt; }
      local.openItem = x.id; save(); render(); requestAnimationFrame(() => $(`.gw-sheet [data-gw-lsub="${CSS.escape(x.id)}"]`)?.focus()); return; }
    if (t.closest?.('#list-edit-form') && !ev.shiftKey) { ev.preventDefault(); t.form.requestSubmit(); }
  });
  // после «Добавить» поле пункта остаётся в фокусе (как в окне списка)
  document.addEventListener('submit', ev => { if (ev.target.id === 'list-item-form' && ev.target.closest('.gw-sheet')) requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('gw-lin')?.focus())); });

  if (typeof render === 'function' && ui.page === 'saved' && CATS[ui.savedCategory] && document.querySelector('.dm-main')) render();
})();
