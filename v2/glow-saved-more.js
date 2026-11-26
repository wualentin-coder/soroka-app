/* Flow · Glow — остальное «Сохранённое» (этап 1), пересадка из docs/design/glow-prototype/index.html:
   фильмы (filmsOverview, R.film, R.marathon, R.reco), адреса (addrsOverview), карты (cardsOverview, кошелёк),
   код билета и карты на весь экран (openCode). Классы и разметка — прототипа, стили — glow-screens.css (собран кодом)
   и glow-saved-more.css (редактор заметки и места приложения). Данные — настоящие, действия — прежние data-action
   приложения (saved-open, saved-new, saved-home, movie-type-filter, movie-rate, movie-watch, movie-similar, saved-pin,
   series-open, series-ep, mu-plan-open, mu-back, mu-seen, mu-part, mu-new, map-filter, map-locate, saved-edit,
   wallet-edit, close-sheet). Своё: колода (листание, перемешать), вкладки Хочу/Смотрю/Посмотрел и вид сетка/широкие —
   только на экране; статус фильма — те же поля status/viewed, что ставит приложение. Работает только в Glow. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset.flowSkin !== 'glow' || window.flowGlowSavedMore) return;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const e = v => esc(String(v ?? ''));
  const norm = s => String(s || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
  const LI = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ic = { back: LI('<path d="M15 5l-7 7 7 7"/>'), plus: LI('<path d="M12 5v14M5 12h14"/>'), search: LI('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'),
    chev: LI('<path d="M9 5l7 7-7 7"/>'), x: LI('<path d="M6 6l12 12M18 6 6 18"/>'),
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/></svg>',
    route: LI('<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>'),
    copy: LI('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>'),
    me: LI('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/><circle cx="12" cy="12" r="7"/>'),
    edit: LI('<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="M13.5 6.5l4 4"/>'),
    star: '<svg viewBox="0 0 100 100" fill="currentColor"><path d="M50 2C53 36 64 47 98 50C64 53 53 64 50 98C47 64 36 53 2 50C36 47 47 36 50 2Z"/></svg>',
    shuffle: LI('<path d="M4 7h3.5c2 0 3.2 1 4.3 2.6l2.4 4.8c1.1 1.6 2.3 2.6 4.3 2.6H20M4 17h3.5c1.3 0 2.2-.4 3-1.1M14.5 8.1c.8-.7 1.7-1.1 3-1.1H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/>'),
    grid: LI('<rect x="4" y="4" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2"/>'),
    wide: LI('<rect x="3.5" y="4" width="17" height="7" rx="2.5"/><rect x="3.5" y="13" width="17" height="7" rx="2.5"/>') };
  const KIC = { '': LI('<path d="M12 4 3 8.5l9 4.5 9-4.5L12 4Z"/><path d="m3 13 9 4.5 9-4.5"/>'),
    movie: LI('<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M7.5 4v16M16.5 4v16M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4"/>'),
    series: LI('<rect x="3" y="7" width="18" height="13" rx="3"/><path d="m8.5 3 3.5 4 3.5-4"/>'),
    animation: LI('<circle cx="12" cy="12" r="8.5"/><path d="M8.8 14.2a4 4 0 0 0 6.4 0M9.3 9.6v.6M14.7 9.6v.6"/>') };
  const STAR = 'M50 2C53 36 64 47 98 50C64 53 53 64 50 98C47 64 36 53 2 50C36 47 47 36 50 2Z';
  const word = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? b : c;
  const caps = (list, cur, icons) => `<div class="glass seg kseg" role="tablist"><i class="lamp"></i>${list.map(([k, l, attrs]) => `<button type="button" class="${cur === k ? 'on' : ''}" role="tab" aria-selected="${cur === k}" ${attrs} title="${e(l)}"><span class="ki">${icons[k] || ''}</span><span class="kl"><span>${e(l)}</span></span></button>`).join('')}</div>`;
  const head = (back, act = '', title = '') => `<header class="gw-head gw-sub"><button type="button" class="ib glass gw-back" data-action="${back}" aria-label="Назад">${ic.back}</button><div class="tt"><h1>${e(title)}</h1></div>${act || '<button type="button" class="ib glass" style="visibility:hidden" tabindex="-1" aria-hidden="true"></button>'}</header>`;
  const addBtn = (label, action = 'saved-new') => `<button type="button" class="ib glass" data-action="${action}" aria-label="${label}">${ic.plus}</button>`;
  const local = { deck: 0, fst: 'want', fview: 'grid' };

  /* ═══ код на весь экран (openCode прототипа): билеты и карты ═══ */
  let code = null;
  function openCode(o) {
    closeCode(true);
    code = { ...o, i: 0 };
    const v = document.createElement('div');
    v.className = 'gw gw-codev';
    v.innerHTML = `<div class="codev on" role="dialog" aria-modal="true" aria-label="Код"><button type="button" class="ib glass" id="gw-cvx" aria-label="Закрыть">${ic.x}</button>
      ${o.act || ''}<div class="cvt"></div><div class="cvp"><div class="cva"></div><span class="cvn"></span><span class="cvs"></span><div class="cvd"></div></div>${o.foot || ''}</div>`;
    document.body.appendChild(v); code.el = v; paintCode();
    root.classList.add('gw-coding');
    try { window.SorokaAndroid?.brightness?.(1); } catch (_) {}
    $('.cvp', v).animate([{ transform: 'translateY(40px) scale(.94)', opacity: 0, filter: 'blur(8px)' }, { transform: 'none', opacity: 1, filter: 'blur(0)' }], { duration: 520, easing: 'cubic-bezier(.19,1,.22,1)' });
    v.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
    $('#gw-cvx', v).onclick = () => closeCode();
    let x0 = null; const p = $('.cvp', v);
    p.addEventListener('pointerdown', ev => { x0 = ev.clientX; });
    p.addEventListener('pointerup', ev => { if (x0 == null || !code) return; const dx = ev.clientX - x0; x0 = null; if (Math.abs(dx) < 50 || code.codes.length < 2) return;
      const n = Math.max(0, Math.min(code.codes.length - 1, code.i + (dx < 0 ? 1 : -1))); if (n === code.i) return; const dir = dx < 0 ? 1 : -1; code.i = n;
      const a = $('.cva', v); a.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${-dir * 40}px)`, opacity: 0 }], { duration: 160 }).onfinish = () => { paintCode(); a.animate([{ transform: `translateX(${dir * 40}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.19,1,.22,1)' }); }; });
    return code;
  }
  function paintCode() {
    const o = code, c = o.codes[o.i] || {}, v = o.el;
    $('.cvt', v).innerHTML = `<small>${e(o.kick)}</small><b>${e(o.title)}</b>${o.sub ? `<span>${e(o.sub)}</span>` : ''}`;
    const a = $('.cva', v);
    // код — только настоящий (картинка с сервера); нарисованный «для вида» код не сканируется
    a.innerHTML = c.svg || `<span class="gw-nocode">${c.text ? 'Код не нарисован — покажите номер' : 'Код не распознан'}</span>`;
    a.className = 'cva k-' + (c.kind === 'qr' ? 'qr' : 'bar');
    $('.cvn', v).textContent = c.text || ''; $('.cvs', v).textContent = c.seat || '';
    $('.cvd', v).innerHTML = o.codes.length > 1 ? o.codes.map((_, j) => `<i class="${j === o.i ? 'on' : ''}"></i>`).join('') : '';
  }
  function closeCode(now) {
    if (!code) return; const c = code; code = null; root.classList.remove('gw-coding');
    try { window.SorokaAndroid?.brightness?.(-1); } catch (_) {}
    if (now) c.el.remove(); else { c.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }); setTimeout(() => c.el.remove(), 220); }
    c.onClose?.();
  }
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && code) { ev.preventDefault(); ev.stopImmediatePropagation(); closeCode(); } }, true);

  /* билет: нажатие сразу открывает код на весь экран (как в прототипе); «…» — прежнее окно билета */
  const tkName = t => ({ train: 'Поезд', flight: 'Самолёт' }[t.ticketType] || (/кино|фильм|imax/i.test(`${t.title} ${t.venue || ''}`) ? 'Кино' : 'Концерт'));
  const tkWhen = t => { const at = typeof ticketStart === 'function' ? ticketStart(t) : null; if (!at) return 'Без даты';
    const d = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()) - new Date(new Date().toDateString())) / 864e5);
    return `${d === 0 ? 'Сегодня' : d === 1 ? 'Завтра' : at.toLocaleDateString('ru', { day: 'numeric', month: 'short' }).replace('.', '')}${t.eventTime ? ' · ' + t.eventTime : ''}`; };
  function openTicketCode(t) {
    const rows = ticketRows(t), url = typeof savedFileUrl === 'function' ? savedFileUrl(t) : '';
    const codes = rows.length ? rows.map(r => ({ svg: r.svg, kind: r.kind === 'barcode' ? 'bar' : 'qr', text: r.text, seat: r.seat })) : [{ svg: '', kind: 'qr', text: '', seat: '' }];
    openCode({ kick: `${tkName(t)} · ${tkWhen(t)}`, title: t.title, sub: t.ticketType === 'train' || t.ticketType === 'flight' ? [t.origin, t.destination].filter(Boolean).join(' → ') : t.venue || '', codes,
      act: `<button type="button" class="ib glass gw-cvmore" data-gw-tkmore="${e(t.id)}" aria-label="Билет целиком">${ic.dots}</button>`,
      foot: url ? `<a class="btn glass gw-cvfile" href="${e(url)}" target="_blank" rel="noopener">Открыть билет</a>` : '' });
  }

  /* ═══ карты: кошелёк стопкой (cardsOverview прототипа) ═══ */
  const lcColor = c => { const chain = typeof chainOf === 'function' ? chainOf(c) : null; return /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : chain?.color || (c.brand === 'pyaterochka' ? '#d71920' : c.brand === 'magnit' ? '#e30613' : c.brand === 'perekrestok' ? '#0b6e35' : '#2f6fdb'); };
  const darker = hex => { const p = [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * .3)); return '#' + p.map(v => v.toString(16).padStart(2, '0')).join(''); };
  function lcLogo(c) { const chain = typeof chainOf === 'function' ? chainOf(c) : null;
    return chain ? chain.svg : c.logo ? `<img src="${e(c.logo)}" alt="">` : `<b>${e(String(c.title || '?').trim().charAt(0).toUpperCase())}</b>`; }
  const lcProg = c => { const chain = typeof chainOf === 'function' ? chainOf(c) : null; const b = (typeof LOYALTY_BRANDS === 'object' && LOYALTY_BRANDS[c.brand]) || null;
    return chain && c.title && !chain.re.test(c.title) ? c.title : b?.program || 'Скидочная карта'; };
  const lcName = c => { const chain = typeof chainOf === 'function' ? chainOf(c) : null; return chain?.name || chain?.w || (LOYALTY_BRANDS?.[c.brand]?.name) || c.title || 'Карта'; };
  const lcCode = c => c.svg ? `${c.svg}<small>${e(loyaltyNumber(c.number))}</small>` : `<small>${c.number ? e(loyaltyNumber(c.number)) : 'Номер не указан'}</small>`;
  function lcardHTML(c, j) {
    const b1 = lcColor(c);
    return `<button type="button" class="glass wcard" data-gw-lc="${e(c.id)}" style="--b1:${b1};--b2:${darker(b1)};--i:${j};--rd:-${(j * 2.7).toFixed(1)}s" aria-label="${e(lcName(c))}"><i class="lsheen"></i><i class="lglow"></i>
      <span class="lhd"><span class="llogo">${lcLogo(c)}</span><span><b>${e(lcName(c))}</b><small>${e(lcProg(c))}</small></span></span>
      <span class="lcode${c.format === 'QRCode' ? ' gw-qr' : ''}">${lcCode(c)}</span></button>`;
  }
  function cardsCat() {
    const cards = walletCards();
    return `<div class="srow"><label class="glass search lsrch"><span>${ic.search}</span><input id="gw-lq" placeholder="Найти карту" autocomplete="off" aria-label="Найти карту"></label>${addBtn('Добавить карту')}</div>
  <div class="gw-wallet" id="gw-wallet">${cards.length ? cards.map(lcardHTML).join('') : ''}</div>${cards.length ? '' : '<div class="glass gw-empty">Карт пока нет</div>'}`;
  }
  function layWallet(w) {
    if (!w) return; const vis = $$('[data-gw-lc]', w).filter(c => c.style.display !== 'none'), open = local.lcard, PEEK = 68, H = 196, OPEN = 300;
    vis.forEach(c => c.classList.toggle('open', c.dataset.gwLc === open));
    const oi = vis.findIndex(c => c.dataset.gwLc === open);
    if (oi >= 0) { let k = 0; vis.forEach((c, j) => { if (j === oi) { c.style.zIndex = 50; c.style.transform = 'none'; return; } c.style.zIndex = 10 + k; c.style.transform = `translateY(${OPEN + 14 + k * 12}px) scale(${.94 - k * .01})`; k++; });
      w.style.height = (OPEN + 14 + Math.max(0, vis.length - 2) * 12 + 70) + 'px'; }
    else { vis.forEach((c, j) => { c.style.zIndex = j; c.style.transform = `translateY(${j * PEEK}px)`; }); w.style.height = (Math.max(0, vis.length - 1) * PEEK + H) + 'px'; }
    // правка открытой карты — «…» в шапке (в прототипе действий нет, а без них карту не изменить и не удалить)
    const act = $('.gw-cat[data-gw-cat="cards"] .srow > .ib');
    if (act) { act.dataset.action = open ? 'wallet-edit' : 'saved-new'; act.dataset.id = open || ''; act.innerHTML = open ? ic.dots : ic.plus; act.setAttribute('aria-label', open ? 'Изменить или удалить карту' : 'Добавить карту'); }
  }
  function openCardCode(c) {
    return openCode({ kick: lcProg(c), title: lcName(c), sub: '', codes: [{ svg: c.svg, kind: c.format === 'QRCode' ? 'qr' : 'bar', text: loyaltyNumber(c.number), seat: '' }] });
  }

  /* ═══ адреса (addrsOverview прототипа): карта приложения, ближайшее, список с расстояниями ═══ */
  const aColor = it => mapCategory(it.categoryId)?.color || '#78beb8';
  const aIcon = it => icon(sectionIcon(mapCategory(it.categoryId), 'pin'));
  const walk = m => Math.max(1, Math.round(m / 80));
  function addrRow(a, j) {
    const d = addressDistance(a), on = local.addr === a.id;
    return `<div class="adr in${on ? ' open' : ''}" data-gw-addr="${e(a.id)}" style="--c:${e(aColor(a))};animation-delay:${j * 35}ms"><button type="button" class="adh" data-gw-asel="${e(a.id)}" aria-expanded="${on}"><span class="ati">${aIcon(a)}</span>
      <span class="ab"><b>${e(a.title)}</b><small>${e([a.address, a.city].filter(Boolean).join(', ') || 'Без адреса')}</small></span>${d != null ? `<span class="ad"><b>${distanceLabel(d)}</b><small>${walk(d)} мин</small></span>` : ''}</button>
      <div class="amore"><div>${a.description ? `<p class="anote">${e(a.description)}</p>` : ''}<div class="aacts"><a class="btn sm glass" href="${e(mapExternalUrl(a))}" target="_blank" rel="noopener">${ic.route}Маршрут</a><button type="button" class="btn sm glass" data-gw-acopy="${e(a.id)}">${ic.copy}Адрес</button><button type="button" class="btn sm glass" data-action="saved-open" data-category="addresses" data-id="${e(a.id)}">${ic.edit}Изменить</button></div></div></div></div>`;
  }
  function addrsCat() {
    if (typeof addressPosition === 'function') addressPosition();
    const cats = mapCategories().filter(c => savedItems('addresses').some(a => a.categoryId === c.id));
    const items = mapPointItems().map(a => ({ a, d: addressDistance(a) })).sort((x, y) => (x.d ?? 1e12) - (y.d ?? 1e12)).map(x => x.a);
    const near = items.find(a => addressDistance(a) != null);
    const capsList = [['', 'Всё', 'data-action="map-filter" data-category=""'], ...cats.map(c => [c.id, c.name, `data-action="map-filter" data-category="${e(c.id)}"`])];
    const icons = { '': KIC[''] }; cats.forEach(c => { icons[c.id] = icon(sectionIcon(c, 'pin')); });
    return `<div class="srow">${caps(capsList, ui.mapCategory || '', icons)}${addBtn('Добавить адрес')}</div>
  <div class="glass amap"><div id="address-map" class="address-map" role="application" aria-label="Карта сохранённых адресов"></div><div class="gw-mapfail" id="map-fallback" hidden>Карта не загрузилась</div><i class="amapfx"></i>${near ? `<button type="button" class="anear" data-gw-asel="${e(near.id)}" style="--c:${e(aColor(near))}"><span class="ati">${aIcon(near)}</span><span><small>Ближайшее</small><b>${e(near.title)} · ${distanceLabel(addressDistance(near))}</b></span></button>` : ''}
    <button type="button" class="ib glass ame" data-action="map-locate" aria-label="Где я">${ic.me}</button></div>
  <div class="glass alst" id="gw-alst">${items.length ? items.map(addrRow).join('') : '<div class="gw-empty">Пусто</div>'}</div>`;
  }
  function selAddr(id) {
    local.addr = local.addr === id ? null : id;
    $$('[data-gw-addr]').forEach(r => { const on = r.dataset.gwAddr === local.addr; r.classList.toggle('open', on); $('.adh', r)?.setAttribute('aria-expanded', on); });
    const it = local.addr && savedItem('addresses', local.addr), at = it && mapPointCoordinates(it);
    if (at && typeof addressMap !== 'undefined' && addressMap) addressMap.flyTo(at, Math.max(addressMap.getZoom(), 15), { duration: .9 });
    if (local.addr) { const r = $(`[data-gw-addr="${CSS.escape(local.addr)}"]`); r && setTimeout(() => r.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 80); }
  }

  /* ═══ фильмы (filmsOverview прототипа) ═══ */
  const PAL = [['#ff7a2b', '#1b3a6b'], ['#9fd6ff', '#1a2a6b'], ['#f2a24b', '#7a2a12'], ['#ff7aa8', '#6b2bd9'], ['#d9e46b', '#1f3a2a'], ['#ff3d6e', '#2a1fd1'], ['#4a86a8', '#0b1a24'], ['#d9a35b', '#2a1a0f']];
  const SH = ['sun', 'wave', 'ring', 'grid', 'dune'];
  const hashS = s => [...String(s)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const palOf = m => PAL[hashS(m.title) % PAL.length];
  const SHAPES = { sun: '<i class="ps sun"></i><i class="ps hz"></i>', wave: '<i class="ps wave"></i><i class="ps wave w2"></i>', dune: '<i class="ps dune"></i><i class="ps dune d2"></i><i class="ps sun s2"></i>',
    grid: '<i class="ps grid"></i><i class="ps sun s3"></i>', ring: '<i class="ps ring"></i><i class="ps ring r2"></i>' };
  /* постер прототипа: абстрактная композиция в двух цветах + название; обложка — поверх, пока не загрузится — абстрактный */
  function poster(m, cls = '') {
    const p = palOf(m), src = m.coverPath && !m.id ? m.coverPath : (typeof movieCoverSource === 'function' && m.id ? movieCoverSource(m) : m.coverPath || '');
    const img = src ? `<img class="pimg" src="${e(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" draggable="false" onload="this.parentElement.classList.add('has-img')" onerror="this.remove()">` : '';
    return `<span class="poster-art ${cls}" style="--p1:${p[0]};--p2:${p[1]}">${SHAPES[SH[(Number(m.year) || hashS(m.title)) % 5]]}<span class="gw-pt">${e(m.title)}</span><span class="py">${e(m.year || '')}</span>${img}</span>`;
  }
  const r1 = v => Number(v) > 0 ? Number(v).toFixed(1).replace('.', ',') : '';
  const rchips = m => `${r1(m.kinopoiskRating) ? `<span class="rc kp">КП <b>${r1(m.kinopoiskRating)}</b></span>` : ''}${r1(m.imdbRating) ? `<span class="rc im">IMDb <b>${r1(m.imdbRating)}</b></span>` : ''}`;
  const bmBtn = m => `<span class="bmk${m.pinned ? ' on' : ''}" role="button" tabindex="0" data-gw-bm="${e(m.id)}" aria-label="${m.pinned ? 'Убрать из закладок' : 'В закладки'}" aria-pressed="${!!m.pinned}"><svg viewBox="0 0 24 24"><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1Z"/></svg></span>`;
  const seriesSeen = m => (m.episodes || []).reduce((s, x) => s + (x.seen?.length || 0), 0), seriesAll = m => (m.episodes || []).reduce((s, x) => s + (Number(x.count) || 0), 0);
  const watching = m => isSeries(m) && !movieIsViewed(m) && seriesSeen(m) > 0;
  const stOf = m => movieIsViewed(m) ? 'done' : watching(m) ? 'watching' : 'want';
  const inKind = m => !ui.movieType || movieBaseType(m) === ui.movieType;
  const genreTxt = m => [...new Set([m.genre, ...(m.tags || [])].filter(Boolean))].slice(0, 2).join(', ') || (isSeries(m) ? 'Сериал' : 'Фильм');
  const metaTxt = m => [m.year, genreTxt(m), m.minutes ? `${Math.floor(m.minutes / 60) ? Math.floor(m.minutes / 60) + ' ч ' : ''}${m.minutes % 60} мин` : ''].filter(Boolean).join(' · ');
  const descTxt = m => String(m.description || m.plot || (typeof movieCardBlurb === 'function' ? movieCardBlurb(m) : '') || '').trim();
  const byPin = (a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || String(b.created || '').localeCompare(String(a.created || ''));
  const wantDeck = () => savedItems('movies').filter(m => stOf(m) === 'want' && !m.skipped && inKind(m)).sort(byPin);
  function deckHTML() {
    const d = wantDeck(); if (!d.length) return `<div class="glass gw-empty dempty">${ui.movieType ? 'Здесь в «Хочу» пока пусто' : 'Список «Хочу» пуст'}</div>`;
    return [2, 1, 0].map(k => { const m = d[(local.deck + k) % d.length]; if (!(d.length > k || k === 0)) return '';
      const hook = k === 0 ? `<span class="dhook"><b>${e(m.title)}</b><small>${e(metaTxt(m))}</small>${descTxt(m) ? `<span class="dd">${e(descTxt(m))}</span>` : ''}</span><i class="stamp yes">Смотреть</i><i class="stamp no">Дальше</i>` : '';
      return `<button type="button" class="dcard" data-k="${k}" data-gw-film="${e(m.id)}" aria-label="${e(m.title)}${m.year ? ', ' + m.year : ''}. Вправо — смотреть, влево — дальше">${poster(m)}${hook}${k === 0 ? bmBtn(m) : ''}</button>`; }).join('');
  }
  const sprog = m => seriesAll(m) ? seriesSeen(m) / seriesAll(m) : 0;
  const filmTile = (m, j) => `<button type="button" class="ftile in" data-action="saved-open" data-category="movies" data-id="${e(m.id)}" style="animation-delay:${j * 40}ms" aria-label="${e(m.title)}">${poster(m, 'sm')}${bmBtn(m)}
    ${movieIsViewed(m) && Number(m.rating) ? `<span class="frate"><svg viewBox="0 0 100 100"><path d="${STAR}"/></svg>${m.rating}</span>` : ''}${watching(m) ? `<span class="fprog"><i style="--v:${sprog(m)}"></i></span>` : ''}</button>`;
  function filmWide(m, j) {
    const p = palOf(m); let side = '';
    if (watching(m)) { const k = typeof seriesKicker === 'function' ? seriesKicker(m).match(/С(\d+) · Е(\d+)/) : null; side = `<span class="wprog"><span>${k ? `Сезон ${k[1]} · серия ${k[2]}` : 'Смотрю'}</span><span class="lbar2"><i style="--v:${sprog(m)}"></i></span></span>`; }
    if (movieIsViewed(m) && Number(m.rating)) side = `<span class="wmine"><svg viewBox="0 0 100 100"><path d="${STAR}"/></svg>${m.rating}</span>`;
    return `<button type="button" class="glass fwide in" data-action="saved-open" data-category="movies" data-id="${e(m.id)}" style="--p1:${p[0]};--p2:${p[1]};animation-delay:${j * 50}ms" aria-label="${e(m.title)}">
    <i class="wglow"></i><span class="wpost">${poster(m, 'sm')}</span>
    <span class="wbody"><b>${e(m.title)}</b><small>${e(metaTxt(m))}</small><span class="rcs">${rchips(m)}${side}</span>${descTxt(m) ? `<span class="wd">${e(descTxt(m))}</span>` : ''}</span>${bmBtn(m)}</button>`;
  }
  function filmGrid() {
    const fs = savedItems('movies').filter(m => stOf(m) === local.fst && (local.fst !== 'want' || !m.skipped) && inKind(m)).sort(local.fst === 'done' ? (a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || String(b.seenAt || '').localeCompare(String(a.seenAt || '')) : byPin);
    if (!fs.length) return '<div class="glass gw-empty" style="grid-column:1/-1">Пусто</div>';
    return (local.fview === 'wide' ? fs.map(filmWide) : fs.map(filmTile)).join('');
  }
  const marLists = () => (typeof universeUi === 'object' ? universeUi.lists : []).filter(d => !d.deleted_at);
  function marCard(d) {
    const pr = universeProgress(d), parts = universePartsVisible(d), p = palOf({ title: d.title });
    return `<button type="button" class="glass mcard" data-action="mu-plan-open" data-id="${e(d.id)}" style="--p1:${p[0]};--p2:${p[1]}"><i class="mglow"></i>
      <span class="mstack">${parts.slice(0, 3).map(x => `<span class="mp">${poster(x, 'sm')}</span>`).join('')}</span>
      <b>${e(d.title)}</b><span class="lbar2"><i style="--v:${pr.all ? pr.seen / pr.all : 0}"></i></span><em>${pr.seen}/${pr.all}</em></button>`;
  }
  const FST = [['want', 'Хочу'], ['watching', 'Смотрю'], ['done', 'Посмотрел']];
  function filmsCat() {
    if (typeof movieMarathonEnsure === 'function') movieMarathonEnsure();
    const top = wantDeck()[local.deck % Math.max(1, wantDeck().length)], tp = top ? palOf(top) : null;
    const KINDS = [['', 'Всё'], ['movie', 'Фильмы'], ['series', 'Сериалы'], ['animation', 'Анимация']];
    return `<div class="srow">${caps(KINDS.map(([k, l]) => [k, l, `data-action="movie-type-filter" data-value="${k}"`]), ui.movieType || '', KIC)}<button type="button" class="ib glass" data-gw-fs aria-label="Найти или добавить фильм">${ic.plus}</button></div>
  <div class="deckw"><i class="dglow" id="gw-dglow" style="--p1:${tp?.[0] || 'var(--a3)'};--p2:${tp?.[1] || 'var(--a2)'}"></i><div class="deck" id="gw-deck">${deckHTML()}</div></div>
  <div class="dacts"><button type="button" class="ib glass" data-gw-shuffle aria-label="Перемешать">${ic.shuffle}</button>
    <button type="button" class="btn gw-main" data-gw-watch${top ? '' : ' disabled'}>Смотреть</button><button type="button" class="ib glass" data-gw-next aria-label="Следующий">${ic.chev}</button></div>
  <div class="mrow">${marLists().map(marCard).join('')}
    <button type="button" class="glass mcard madd" data-action="mu-new" aria-label="Новый марафон"><span class="mplus">${ic.plus}</span><b>Марафон</b></button></div>
  <div class="fbar"><div class="seg fseg" style="--n:3;--i:${FST.findIndex(s => s[0] === local.fst)}"><i class="lamp"></i>${FST.map(([k, l]) => `<button type="button" class="${local.fst === k ? 'on' : ''}" data-gw-fst="${k}">${l}</button>`).join('')}</div>
    <button type="button" class="ib glass fview" data-gw-fview aria-label="${local.fview === 'wide' ? 'Сеткой' : 'Широкие карточки'}">${local.fview === 'wide' ? ic.grid : ic.wide}</button></div>
  <div class="fgrid${local.fview === 'wide' ? ' gw-wide' : ''}" id="gw-fgrid">${filmGrid()}</div>`;
  }

  /* ═══ экран фильма (R.film прототипа) ═══ */
  function starsHTML(r) { return Array.from({ length: 10 }, (_, i) => `<i class="${i < r ? 'on' : ''}" data-action="movie-rate" data-value="${i + 1}" role="button" aria-label="Оценка ${i + 1} из 10"><svg viewBox="0 0 100 100"><path d="${STAR}"/></svg></i>`).join(''); }
  function epsBlock(m) {
    if (!isSeries(m)) return '';
    if (typeof seriesTracker === 'function') seriesTracker(m); // приложение само подтягивает сезоны из IMDb
    const ss = m.episodes || [];
    if (!ss.length) return `<div class="glass fser"><p class="gw-fsnote">Сезоны и серии ещё не получены из IMDb</p><button type="button" class="chip" data-action="series-sync">Обновить из IMDb</button></div>`;
    const next = (() => { for (let i = 0; i < ss.length; i++) for (let x = 1; x <= ss[i].count; x++) if (!ss[i].seen.includes(x)) return { i, x }; return null; })();
    const open = Math.min(ss.length - 1, ui.seriesSeason?.[m.id] ?? (next ? next.i : ss.length - 1)), s = ss[open];
    return `<div class="glass fser" id="gw-fser"><div class="sesc">${ss.map((x, i) => `<button type="button" class="chip${i === open ? ' on' : ''}" data-action="series-open" data-season="${i}">Сезон ${e(x.n)}</button>`).join('')}</div>
    <div class="eps">${Array.from({ length: s.count }, (_, k) => k + 1).map(x => `<button type="button" class="ep${s.seen.includes(x) ? ' on' : ''}${next && next.i === open && next.x === x ? ' gw-next' : ''}" data-action="series-ep" data-season="${open}" data-ep="${x}" aria-pressed="${s.seen.includes(x)}" aria-label="Серия ${x}">${x}</button>`).join('')}</div></div>`;
  }
  function filmScreen(m) {
    if (typeof ensureMovieFacts === 'function') ensureMovieFacts(m);
    const p = palOf(m), st = stOf(m), r = Number(m.rating) || 0, list = isSeries(m) ? FST : FST.filter(x => x[0] !== 'watching');
    const watchUrl = typeof movieWatchUrl === 'function' ? movieWatchUrl(m) : '';
    const cand = { title: m.title, year: m.year, kind: m.kind, imdbUrl: m.imdbUrl || (m.imdbId ? `https://www.imdb.com/title/${m.imdbId}/` : ''), kinopoiskUrl: m.kinopoiskUrl, kpId: typeof moviePlayerKinopoiskId === 'function' ? moviePlayerKinopoiskId(m) : '', coverPath: m.coverPath, genre: m.genre };
    const play = watchUrl ? `<a class="glass fplay" data-action="movie-watch" data-id="${e(m.id)}" data-movie="${e(JSON.stringify(cand))}" href="${e(watchUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Смотреть"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.2 6.2c0-.8.9-1.3 1.6-.9l8.4 5.8c.6.4.6 1.3 0 1.7l-8.4 5.8c-.7.4-1.6-.1-1.6-.9Z"/></svg></a>` : '';
    return `<div class="fhero" style="--p1:${p[0]};--p2:${p[1]}"><i class="fback"></i><div class="fpw">${poster(m, 'gw-big')}</div>${play}</div>
  <h2 class="ftitle">${e(m.title)}</h2><div class="fmeta">${e(metaTxt(m))}</div>
  <div class="rcs fr">${rchips(m)}</div>
  ${descTxt(m) ? `<p class="fdesc">${e(descTxt(m))}</p>` : ''}
  <div class="seg fseg2" style="--n:${list.length};--i:${Math.max(0, list.findIndex(x => x[0] === st))}"><i class="lamp"></i>${list.map(([k, l]) => `<button type="button" class="${st === k ? 'on' : ''}" data-gw-st="${k}">${l}</button>`).join('')}</div>
  <div class="glass frate-row" role="group" aria-label="Моя оценка"><span class="gw-stars">${starsHTML(r)}</span><b class="gw-lit">${r || '—'}</b></div>
  ${epsBlock(m)}
  <form class="glass frev movie-review" data-id="${e(m.id)}"><textarea name="review" rows="2" maxlength="2000" placeholder="Пара слов о фильме">${e(m.review || '')}</textarea></form>
  <div class="simw"><button type="button" class="chip gw-sim" data-action="movie-similar">${ic.star}Похожее</button></div>`;
  }

  /* ═══ марафон (R.marathon прототипа) ═══ */
  function marathonScreen(d) {
    const pr = universeProgress(d), story = d.order_mode === 'story' && universeUi.story.get(universeStoryKey(d))?.status !== 'ready';
    const parts = (story ? universeOrdered({ ...d, order_mode: 'release' }) : universeOrdered(d));
    const next = parts.find(x => !universeSeen(x, d) && !x.unplaced), pal = palOf({ title: d.title });
    const rows = parts.map((x, i) => { const dn = universeSeen(x, d), series = x.kind === 'series', ep = series && d.episode_progress?.[x.imdbId] ? universeEpisodeSummary(d.episode_progress[x.imdbId]) : null;
      return `<div class="mrow2${dn ? ' done' : ''}${x === next ? ' gw-next' : ''}"><span class="mn">${x.unplaced ? '?' : i + 1}</span><button type="button" class="mpost" data-action="${series ? 'mu-series-expand' : 'mu-part'}" data-imdb="${e(x.imdbId)}" aria-label="${e(x.title)}">${poster(x, 'sm')}</button>
      <span class="mb"><b>${e(x.title)}</b><small>${e([x.year, series ? 'Сериал' : '', ep ? `${ep.seen} / ${ep.total} серий` : '', x === next ? 'следующий' : ''].filter(Boolean).join(' · '))}</small><span class="rcs">${rchips({ kinopoiskRating: x.kpRating, imdbRating: x.imdbRating })}</span></span>
      <button type="button" class="chk" data-action="mu-seen" data-imdb="${e(x.imdbId)}" aria-pressed="${dn}" aria-label="${dn ? 'Не смотрел' : 'Посмотрел'}: ${e(x.title)}"${universeUi.busy ? ' disabled' : ''}>${ic.check}</button></div>
      ${series && universeEpisodeUi?.expanded?.has(x.imdbId) ? renderUniverseEpisodePanel(x, d) : ''}`; }).join('');
    return `<div class="mhero" style="--p1:${pal[0]};--p2:${pal[1]}"><i class="fback"></i><div class="mfan">${universePartsVisible(d).slice(0, 3).map(x => `<span class="mp2">${poster(x, 'sm')}</span>`).join('')}</div></div>
  <h2 class="ftitle">${e(d.title)}</h2><div class="fmeta">${pr.seen} из ${pr.all}${story ? ' · порядок по выходу' : ''}</div><span class="lbar2 mbar"><i style="--v:${pr.all ? pr.seen / pr.all : 0}"></i></span>
  ${universeUi.error ? `<p class="gw-fsnote" role="alert">${e(universeUi.error)}</p>` : ''}
  <div class="glass mlist">${rows || '<div class="gw-empty">Пусто</div>'}</div>`;
  }

  /* ═══ окно «+» у фильмов (#fsheet прототипа): «Найти» — коллекция и новые (поиск бота), «Подобрать» — подбор приложения ═══ */
  const FSTL = { want: 'Хочу', watching: 'Смотрю', done: 'Посмотрел' };
  const fs = { mode: 'find', q: '', found: [], finding: false, err: '', timer: 0, poll: 0, sig: '' };
  const fsRowMine = m => `<div class="fsr" data-gw-fopen="${e(m.id)}" role="button" tabindex="0"><span class="fsp">${poster(m, 'sm')}</span>
    <span class="fsb"><b>${e(m.title)}</b><small>${e(m.year || '')}${isSeries(m) ? ' · сериал' : ''}</small><span class="rcs">${rchips(m)}</span></span><span class="fsst">${FSTL[stOf(m)]}</span></div>`;
  const known = p => savedItems('movies').some(m => (p.imdbUrl && m.imdbUrl && m.imdbUrl.includes((p.imdbUrl.match(/tt\d+/) || ['@'])[0])) || (norm(m.title) === norm(p.title) && String(m.year || '') === String(p.year || '')));
  const fsRowNew = (p, i) => `<div class="fsr"><span class="fsp">${poster({ title: p.title, year: p.year, coverPath: p.poster || '' }, 'sm')}</span>
    <span class="fsb"><b>${e(p.title)}</b><small>${e(p.year || '')}${p.kind === 'series' ? ' · сериал' : ''}</small><span class="rcs">${rchips({ kinopoiskRating: p.kpRating, imdbRating: p.imdbRating })}</span></span>
    ${known(p) ? `<button type="button" class="fadd done" disabled aria-label="Уже в коллекции">${ic.check}</button>` : `<button type="button" class="fadd" data-gw-fadd="${i}" aria-label="Добавить в «Хочу»: ${e(p.title)}">${ic.plus}</button>`}</div>`;
  function fsResults() {
    const n = norm(fs.q.trim()), mine = n ? savedItems('movies').filter(m => norm(`${m.title} ${m.originalTitle || ''}`).includes(n)) : [];
    let h = '';
    if (mine.length) h += `<div class="fsl">В коллекции</div>${mine.slice(0, 12).map(fsRowMine).join('')}`;
    if (n.length >= 2) {
      if (typeof window.sorokaMovieFind !== 'function') h += '<div class="gw-empty">Новые фильмы ищет бот — в рабочем приложении</div>';
      else if (fs.finding) h += '<div class="fsl">Новые</div><div class="rsk"><i></i><span><b></b><b></b><b></b></span></div>';
      else if (fs.found.length) h += `<div class="fsl">Новые</div>${fs.found.map(fsRowNew).join('')}`;
      else if (fs.err) h += `<div class="gw-empty">${e(fs.err)}</div>`;
    }
    return h || (n ? '<div class="gw-empty">Ничего не нашлось</div>' : '<div class="gw-empty">Название фильма или сериала</div>');
  }
  const RKINDS = [['all', 'Всё', 'any', ''], ['f', 'Фильмы', 'movie', ''], ['s', 'Сериалы', 'series', ''], ['a', 'Анимация', 'any', 'Анимация']];
  const rkindNow = () => { const f = recoFilter(), g = recoSelectedGenres(); return f.kind === 'movie' ? 'f' : f.kind === 'series' ? 's' : g.includes('Анимация') ? 'a' : 'all'; };
  const KIC2 = { all: KIC[''], f: KIC.movie, s: KIC.series, a: KIC.animation };
  function recoCardG(p, j) {
    const m = pickAsMovie(p), pal = palOf(m), key = pickKey(p);
    return `<div class="rcc in" data-gw-rc="${e(key)}" style="--p1:${pal[0]};--p2:${pal[1]};animation-delay:${j * 90}ms"><i class="wglow"></i>
    <span class="wpost" data-action="reco-open" data-key="${e(key)}" role="button">${poster({ title: p.title, year: p.year, coverPath: p.poster || '' }, 'sm')}</span>
    <span class="rcb2"><b>${e(p.title)}</b><small>${e([p.year, p.genre, p.kind === 'series' ? 'сериал' : ''].filter(Boolean).join(' · '))}</small><span class="rcs">${rchips({ kinopoiskRating: p.kpRating, imdbRating: p.imdbRating })}</span>
      ${p.why ? `<span class="rwhy">${ic.star}${e(p.why)}</span>` : ''}
      <span class="racts"><button type="button" class="btn sm glass" data-gw-rno="${e(key)}" aria-label="Не интересно">${ic.x}</button><button type="button" class="btn sm glass" data-action="reco-seen" data-key="${e(key)}">Смотрел</button><button type="button" class="btn sm gw-main" data-gw-rwant="${e(key)}">${ic.plus}Хочу</button></span></span>
    <i class="stamp yes">Хочу</i><i class="stamp no">Мимо</i></div>`;
  }
  function recoInner() {
    const st = movieRecoState(), taste = movieTaste().filter(g => g.score > 0).map(g => g.name), sel = recoSelectedGenres();
    const gens = [...new Set([...taste, ...RECO_GENRES].map(g => g.charAt(0).toUpperCase() + g.slice(1)))].filter(g => g !== 'Анимация').slice(0, 10);
    const picks = recoVisible().filter(p => !recoPending.has(pickKey(p))), ready = typeof window.sorokaRecommend === 'function';
    const body = st.loading && !picks.length ? Array.from({ length: 3 }, (_, j) => `<div class="rsk" style="animation-delay:${j * 120}ms"><i></i><span><b></b><b></b><b></b></span></div>`).join('')
      : picks.length ? picks.map(recoCardG).join('') : `<div class="glass gw-empty rempty">${ready ? (st.note || 'Нажмите «Подобрать» — найду то, что вам понравится') : 'Новые названия подбирает бот — в рабочем приложении'}</div>`;
    return `<div class="tastes">${taste.slice(0, 6).map((g, i) => `<span class="${i < 2 ? 'top' : ''}">${e(g)}</span>`).join('')}</div>
  <div class="srow rsrow">${caps(RKINDS.map(([k, l]) => [k, l, `data-gw-rkind="${k}"`]), rkindNow(), KIC2)}</div>
  <div class="rgens">${gens.map(g => `<button type="button" class="chip${sel.includes(g) ? ' on' : ''}" data-gw-rgen="${e(g)}">${e(g)}</button>`).join('')}</div>
  <button type="button" class="btn gw-main rgo${st.loading ? ' gw-busy' : ''}" data-gw-rgo${ready ? '' : ' disabled'}><span class="rgoi">${ic.star}</span><span>${st.loading ? RECO_PHRASES[st.phrase % RECO_PHRASES.length] : picks.length ? 'Подобрать другие' : 'Подобрать'}</span></button>
  <div class="rlist">${body}</div>`;
  }
  const recoSig = () => { const st = movieRecoState(); return [st.loading, st.phrase, st.picks.length, recoPending.size, st.note].join('|'); };
  function openFS(mode = 'find') {
    closeFS(true); fs.mode = mode; fs.q = ''; fs.found = []; fs.err = '';
    const l = document.createElement('div'); l.className = 'gw gw-fsl'; l.id = 'gw-fsl';
    l.innerHTML = `<div class="scrim on" data-gw-fsclose></div><div class="glass fsheet on${mode === 'reco' ? ' reco' : ''}" id="gw-fsheet" role="dialog" aria-modal="true" aria-label="Поиск фильмов">
      <div class="fsh"><button type="button" class="ib" data-gw-fsclose aria-label="Закрыть поиск">${ic.back}</button>
        <label class="search"><span>${ic.search}</span><input id="gw-fsq" type="search" placeholder="Фильм или сериал" autocomplete="off" enterkeyhint="search"></label>
        <div class="seg fsmode" id="gw-fsmode" style="--n:2;--i:${mode === 'reco' ? 1 : 0}"><i class="lamp"></i><button type="button" class="${mode === 'find' ? 'on' : ''}" data-gw-fsm="find">Найти</button><button type="button" class="${mode === 'reco' ? 'on' : ''}" data-gw-fsm="reco"><span class="fsmi">${ic.star}</span>Подобрать</button></div></div>
      <div class="fsres" id="gw-fsres">${fsResults()}</div><div class="fsres fsreco" id="gw-fsreco">${mode === 'reco' ? recoInner() : ''}</div></div>`;
    document.body.appendChild(l); root.classList.add('gw-fsing');
    if (mode === 'find') setTimeout(() => $('#gw-fsq')?.focus(), 260);
    fs.sig = recoSig(); fs.poll = setInterval(() => { if (fs.mode !== 'reco') return; const s = recoSig(); if (s !== fs.sig) { fs.sig = s; const b = $('#gw-fsreco'); if (b) b.innerHTML = recoInner(); } }, 400);
  }
  function closeFS(now) { const l = $('#gw-fsl'); clearInterval(fs.poll); if (!l) return; root.classList.remove('gw-fsing'); document.activeElement?.blur();
    if (now) l.remove(); else { l.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }); setTimeout(() => { l.remove(); if (ui.page === 'saved' && ui.savedCategory === 'movies') render(); }, 220); } }
  function setFsMode(m) {
    const sh = $('#gw-fsheet'), seg = $('#gw-fsmode'); if (!sh) return; fs.mode = m; sh.classList.toggle('reco', m === 'reco'); seg.style.setProperty('--i', m === 'reco' ? 1 : 0);
    $$('[data-gw-fsm]', seg).forEach(b => b.classList.toggle('on', b.dataset.gwFsm === m));
    const box = m === 'reco' ? $('#gw-fsreco') : $('#gw-fsres');
    if (m === 'reco') { document.activeElement?.blur(); box.innerHTML = recoInner(); fs.sig = recoSig(); } else setTimeout(() => $('#gw-fsq')?.focus(), 120);
    box.animate([{ opacity: 0, transform: `translateX(${m === 'reco' ? 24 : -24}px)`, filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 420, easing: 'cubic-bezier(.19,1,.22,1)' });
  }
  function findNew() {
    clearTimeout(fs.timer); const q = fs.q.trim(); if (q.length < 2 || typeof window.sorokaMovieFind !== 'function') return;
    fs.timer = setTimeout(() => { fs.finding = true; fs.err = ''; const r = $('#gw-fsres'); if (r) r.innerHTML = fsResults();
      Promise.resolve(window.sorokaMovieFind(q)).then(a => { if (fs.q.trim() !== q) return; fs.found = (a?.found || []).slice(0, 10); if (!fs.found.length) fs.err = 'Не нашёл — попробуйте оригинальное название или год'; })
        .catch(() => { fs.err = 'Поиск не ответил — попробуйте ещё раз'; }).finally(() => { fs.finding = false; const r2 = $('#gw-fsres'); if (r2 && fs.mode === 'find') r2.innerHTML = fsResults(); }); }, 450);
  }
  // найденный фильм — в коллекцию «Хочу», теми же полями, что добавляет подборка приложения (commitPick)
  function addFound(p) {
    if (known(p)) return false;
    data.saved.movies.push({ id: id(), title: p.title, description: '', kind: p.kind === 'series' ? 'series' : 'movie', topic: p.kind === 'series' ? 'Сериалы' : 'Кино', tags: [], genre: p.genre || '', year: p.year || undefined,
      originalTitle: p.originalTitle || '', status: 'Хочу посмотреть', viewed: false, rating: 0, skipped: false, kinopoiskUrl: p.kpUrl || '', imdbUrl: p.imdbUrl || '', kinopoiskRating: p.kpRating ?? '', imdbRating: p.imdbRating ?? '',
      coverPath: p.poster || '', source: 'Поиск', created: new Date().toISOString(), pinned: false });
    save(); return true;
  }
  document.addEventListener('input', ev => { if (ev.target.id !== 'gw-fsq') return; fs.q = ev.target.value; fs.found = []; fs.err = ''; const r = $('#gw-fsres'); if (r) r.innerHTML = fsResults(); findNew(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && $('#gw-fsl')) { ev.preventDefault(); ev.stopImmediatePropagation(); closeFS(); } }, true);
  document.addEventListener('click', ev => {
    if (ev.target.closest?.('[data-gw-fs]')) { ev.preventDefault(); ev.stopImmediatePropagation(); openFS('find'); return; }
    const l = ev.target.closest?.('#gw-fsl'); if (!l) return;
    const t = ev.target.closest('[data-gw-fsclose],[data-gw-fsm],[data-gw-fadd],[data-gw-fopen],[data-gw-rkind],[data-gw-rgen],[data-gw-rgo],[data-gw-rno],[data-gw-rwant]'); if (!t) return;
    ev.preventDefault(); ev.stopImmediatePropagation(); const d = t.dataset;
    if (d.gwFsclose !== undefined) return closeFS();
    if (d.gwFsm) { if (fs.mode !== d.gwFsm) setFsMode(d.gwFsm); return; }
    if (d.gwFadd !== undefined) { const p = fs.found[Number(d.gwFadd)]; if (p && addFound(p)) { t.classList.add('done'); t.innerHTML = ic.check; t.disabled = true; toast(`«${p.title}» — в «Хочу»`);
      t.closest('.fsr').animate([{ background: 'color-mix(in srgb,var(--a3) 28%,transparent)' }, { background: 'transparent' }], { duration: 900 }); } return; }
    if (d.gwFopen) { const idv = d.gwFopen; closeFS(true); setTimeout(() => openFilm(idv), 60); return; }
    if (d.gwRkind) { const k = RKINDS.find(x => x[0] === d.gwRkind), f = recoFilter(); f.kind = k[2]; const g = recoSelectedGenres().filter(x => x !== 'Анимация'); if (k[3]) g.push(k[3]); f.genre = g.join(', '); keepRecoFilter(); $('#gw-fsreco').innerHTML = recoInner(); return; }
    if (d.gwRgen) { const f = recoFilter(); let g = recoSelectedGenres(); g = g.includes(d.gwRgen) ? g.filter(x => x !== d.gwRgen) : [...g, d.gwRgen]; f.genre = g.join(', '); keepRecoFilter(); t.classList.toggle('on'); return; }
    if (d.gwRgo !== undefined) { if (!movieRecoState().loading) void loadMovieReco(); setTimeout(() => { const b = $('#gw-fsreco'); if (b) b.innerHTML = recoInner(); }, 30); return; }
    const key = d.gwRno || d.gwRwant; if (key) { const card = t.closest('.rcc'), dir = d.gwRwant ? 1 : -1, p = findPick(key);
      card.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${dir * 420}px) rotate(${dir * 10}deg)`, opacity: 0 }], { duration: 320, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }); setTimeout(() => card.remove(), 320);
      commitPick(key, d.gwRwant ? 'plans' : 'skip'); toast(d.gwRwant ? `«${p?.title || ''}» — в «Хочу»` : 'Не интересно — учту в подборке'); return; }
  }, true);

  /* ═══ подключение ═══ */
  const PAGES = { movies: filmsCat, addresses: addrsCat, cards: cardsCat };
  const prevPage = window.renderSavedPage;
  window.renderSavedPage = function (...args) {
    const cat = ui.savedCategory;
    if (cat === 'movies' && ui.savedFilter === 'reco') {
      const d = universeUi.tab === 'universes' && universeUi.detail;
      if (d && !d.loading && !d.error && d.parts) {
        const act = d.version !== undefined ? `<button type="button" class="ib glass" data-action="mu-edit" aria-label="Изменить марафон">${ic.dots}</button>` : '';
        return `<div class="gw gw-cat">${head('mu-back', act)}<div class="gw-screen on gw-sub" data-s="marathon">${marathonScreen(d)}</div></div>`;
      }
      // подбор (R.reco): шапка и звезда прототипа, сам подбор — прежний (запрос к боту, жанры, решения по карточкам)
      return `<div class="gw gw-cat gw-recopage">${head('saved-filter" data-filter="all')}<div class="gw-screen on gw-sub" data-s="reco"><div class="rhero2"><i class="fback" style="--p1:var(--a3);--p2:var(--a1)"></i><span class="rstar">${ic.star}</span></div>
        <h2 class="ftitle">Новое для вас</h2></div></div><div class="gw-native">${renderMovieDiscovery()}</div>`;
    }
    const make = PAGES[cat];
    if (!make || ui.savedReturn || (cat === 'movies' && ['viewed', 'skipped'].includes(ui.savedFilter))) return prevPage.apply(this, args);
    return `<div class="gw gw-cat" data-gw-cat="${cat}">${head('saved-home')}<div class="gw-screen on" data-s="savedCat">${make()}</div></div>`;
  };
  const prevSheet = window.renderSavedSheet;
  window.renderSavedSheet = function (...args) {
    const s = ui.sheet;
    if (s?.category === 'movies' && s.id && s.mode !== 'edit' && !String(s.id).startsWith('pick:')) {
      const m = savedItem('movies', s.id);
      if (m) return `<div class="gw gw-sheet" data-s="film" role="dialog" aria-modal="true" aria-label="${e(m.title)}">${head('close-sheet', `<button type="button" class="ib glass" data-action="saved-edit" aria-label="Изменить или удалить">${ic.dots}</button>`)}<div class="gw-screen on gw-sub" data-s="film">${filmScreen(m)}</div></div>`;
    }
    return prevSheet.apply(this, args);
  };
  // код карты на весь экран — тот же экран кода (вызов из «рядом с магазином» тоже)
  const nativeLoyaltyFull = window.openLoyaltyFull;
  window.openLoyaltyFull = function (item, opts = {}) {
    if (!item) return null;
    const c = openCardCode(item); if (c) c.onClose = opts.onClose;
    return { layer: c?.el, close: () => closeCode() };
  };
  window.flowGlowSavedMore = { openCode, closeCode, nativeLoyaltyFull, poster, rchips, palOf };

  /* ── жесты и действия на месте ── */
  function stepDeck(dir) {
    const deck = $('#gw-deck'), top = deck && $('.dcard[data-k="0"]', deck); if (!top) return;
    top.animate([{ transform: 'none', opacity: 1 }, { transform: `translateX(${dir * 420}px) rotate(${dir * 12}deg)`, opacity: 0 }], { duration: 320, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).onfinish = () => {
      local.deck++; paintDeck(); };
  }
  function paintDeck() {
    const deck = $('#gw-deck'); if (!deck) return; deck.innerHTML = deckHTML();
    const d = wantDeck(), top = d[local.deck % Math.max(1, d.length)], g = $('#gw-dglow');
    if (g && top) { const p = palOf(top); g.style.setProperty('--p1', p[0]); g.style.setProperty('--p2', p[1]); }
    bindDeck();
  }
  function bindDeck() {
    const top = $('#gw-deck .dcard[data-k="0"]'); if (!top || top.dataset.gwBound) return; top.dataset.gwBound = '1';
    let x0 = null, y0 = 0, dx = 0, moved = false;
    top.addEventListener('pointerdown', ev => { if (ev.target.closest('[data-gw-bm]')) return; x0 = ev.clientX; y0 = ev.clientY; dx = 0; moved = false; top.setPointerCapture?.(ev.pointerId); top.style.transition = 'none'; });
    top.addEventListener('pointermove', ev => { if (x0 == null) return; dx = ev.clientX - x0; if (!moved && Math.abs(dx) < 8) return; if (!moved && Math.abs(ev.clientY - y0) > Math.abs(dx)) { x0 = null; return; } moved = true;
      top.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`; top.style.setProperty('--sx', Math.max(-1, Math.min(1, dx / 110)).toFixed(2));
      top.classList.toggle('yes', dx > 40); top.classList.toggle('no', dx < -40); });
    const end = () => { if (x0 == null) return; x0 = null; top.style.transition = ''; top.classList.remove('yes', 'no');
      if (moved && Math.abs(dx) > 100) { if (dx > 0) openFilm(top.dataset.gwFilm); else stepDeck(-1); }
      else { top.style.transform = ''; top.style.setProperty('--sx', 0); if (!moved) openFilm(top.dataset.gwFilm); } };
    top.addEventListener('pointerup', end); top.addEventListener('pointercancel', () => { x0 = null; top.style.transform = ''; });
    top.addEventListener('click', ev => ev.preventDefault());
  }
  const openFilm = id => { if (id && typeof openSavedRecord === 'function') openSavedRecord('movies', id); };
  function paintFilms(sel) { const g = $('#gw-fgrid'); if (!g) return; g.classList.toggle('gw-wide', local.fview === 'wide'); g.innerHTML = filmGrid(); if (sel) sel(); }

  document.addEventListener('click', ev => {
    const t = ev.target.closest?.('[data-gw-bm],[data-gw-shuffle],[data-gw-next],[data-gw-watch],[data-gw-fst],[data-gw-fview],[data-gw-st],[data-gw-lc],[data-gw-asel],[data-gw-acopy],[data-gw-tkmore],[data-gw-reco]');
    // билет: сразу код на весь экран (раздел «Билеты» прототипа)
    const tk = !t && ev.target.closest?.('.gw-cat [data-action="saved-open"][data-category="tickets"]');
    if (tk) { const it = savedItem('tickets', tk.dataset.id); if (it) { ev.preventDefault(); ev.stopImmediatePropagation(); openTicketCode(it); } return; }
    if (!t) return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    const d = t.dataset;
    if (d.gwBm) { const m = savedItem('movies', d.gwBm); if (!m) return; m.pinned = !m.pinned; save(); t.classList.toggle('on', m.pinned); t.setAttribute('aria-pressed', m.pinned); toast(m.pinned ? 'В закладках' : 'Убрано из закладок'); return; }
    if (d.gwShuffle !== undefined) { const n = wantDeck().length; if (n > 1) { local.deck += 1 + Math.floor(Math.random() * (n - 1)); paintDeck(); } return; }
    if (d.gwNext !== undefined) { stepDeck(-1); return; }
    if (d.gwWatch !== undefined) { const top = $('#gw-deck .dcard[data-k="0"]'); top && openFilm(top.dataset.gwFilm); return; }
    if (d.gwFst) { local.fst = d.gwFst; const seg = t.closest('.fseg'); seg.style.setProperty('--i', FST.findIndex(s => s[0] === local.fst)); $$('[data-gw-fst]', seg).forEach(b => b.classList.toggle('on', b === t)); paintFilms(); return; }
    if (d.gwFview !== undefined) { local.fview = local.fview === 'wide' ? 'grid' : 'wide'; t.innerHTML = local.fview === 'wide' ? ic.grid : ic.wide; paintFilms(); return; }
    if (d.gwSt) { const m = savedItem('movies', ui.sheet?.id); if (!m) return;
      if (d.gwSt === 'watching') { $('#gw-fser')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      // те же поля, что ставит приложение («Посмотрел» — status и viewed; оценка остаётся)
      if (d.gwSt === 'done' && !movieIsViewed(m)) { m.status = 'Посмотрел'; m.viewed = true; m.seenAt = new Date().toISOString(); m.skipped = false; toast('В «Посмотрел»'); }
      if (d.gwSt === 'want' && movieIsViewed(m)) { m.status = 'Хочу посмотреть'; m.viewed = false; m.viewedByRating = false; toast('Вернул в «Хочу»'); }
      save(); render(); return; }
    if (d.gwLc) { const w = $('#gw-wallet'), id = d.gwLc;
      if (t.classList.contains('open') && ev.target.closest('.lcode')) { const c = savedItem('cards', id); c && openCardCode(c); return; }
      local.lcard = local.lcard === id ? null : id; layWallet(w);
      if (local.lcard) { t.animate([{ scale: '.97', filter: 'brightness(1.4)' }, { scale: '1.015', offset: .45 }, { scale: '1', filter: 'none' }], { duration: 620, easing: 'cubic-bezier(.2,.9,.3,1.2)' }); window.scrollTo({ top: Math.max(0, w.getBoundingClientRect().top + scrollY - 120), behavior: 'smooth' }); }
      return; }
    if (d.gwAsel) { selAddr(d.gwAsel); return; }
    if (d.gwAcopy) { const a = savedItem('addresses', d.gwAcopy); navigator.clipboard?.writeText([a?.address, a?.city].filter(Boolean).join(', ')).then(() => toast('Адрес скопирован'), () => toast('Не удалось скопировать')); return; }
    if (d.gwReco !== undefined) { universeUi.tab = 'personal'; universeUi.detail = null; ui.savedFilter = 'reco'; ui.savedLimit = 60; render(); window.scrollTo(0, 0); if (typeof openMovieReco === 'function') void openMovieReco(); return; }
    if (d.gwTkmore) { const id = d.gwTkmore; closeCode(true); openSavedRecord('tickets', id); return; }
  }, true);
  document.addEventListener('input', ev => {
    if (ev.target.id !== 'gw-lq') return; const q = norm(ev.target.value.trim()), w = $('#gw-wallet');
    $$('[data-gw-lc]', w).forEach(c => { const it = savedItem('cards', c.dataset.gwLc); c.style.display = !q || norm(`${it?.title} ${lcName(it || {})} ${lcProg(it || {})}`).includes(q) ? '' : 'none'; });
    local.lcard = null; layWallet(w);
  });
  // открытая карта ловит свет за пальцем
  document.addEventListener('pointermove', ev => { const c = ev.target.closest?.('.gw .wcard.open'); if (!c) return; const r = c.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
    c.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); c.style.setProperty('--my', (y * 100).toFixed(1) + '%'); c.style.rotate = `${((x - .5) * 2).toFixed(2)}deg`; }, { passive: true });

  /* редактор заметки (R.note прототипа): поведение — прежнее (note-editor.js, note-ink.js), меняется только вид.
     Панель — как .ntool прототипа: две прокручиваемые группы и звезда «Улучшить» в центре (та же кнопка приложения). */
  function noteShape(sheet) {
    if (!sheet.classList.contains('gw-note')) sheet.classList.add('gw-note');
    const bar = $('.note-format', sheet), star = $('.dc2-note-assistant', sheet);
    if (bar && star && !bar.dataset.gwShaped) {
      bar.dataset.gwShaped = '1';
      const btns = [...bar.children], half = Math.ceil(btns.length / 2), box = document.createElement('div'), g1 = document.createElement('div'), g2 = document.createElement('div'), mid = document.createElement('span');
      bar.classList.add('gw'); box.className = 'glass gw-ntool'; g1.className = 'ts'; g2.className = 'ts'; mid.className = 'nstar'; mid.innerHTML = '<i class="rays"></i>';
      btns.slice(0, half).forEach(b => g1.appendChild(b)); btns.slice(half).forEach(b => g2.appendChild(b));
      star.innerHTML = ic.star; mid.appendChild(star); box.append(g1, mid, g2); bar.appendChild(box);
    }
    // шапка: «Назад» и «Поделиться» — стеклянные кнопки прототипа; «Готово» делает то же, что «Назад», — не дублируем
    const top = $('.note-toolbar', sheet);
    if (top && !$('.note-back.ib', top)) { top.classList.add('gw');
      const back = $('.note-back', top); if (back) { back.classList.add('ib', 'glass'); back.innerHTML = ic.back; back.setAttribute('aria-label', 'Назад'); }
      $$('.note-tool[data-action="saved-share"],.note-tool[data-action="note-history"]', top).forEach(b => b.classList.add('ib', 'glass')); }
    // строка «Раздел · время» вместо фишки папки (раскрытие с папкой, метками и «Удалить» — прежнее)
    const sum = $('.note-meta > summary', sheet), it = ui.sheet?.id ? savedItem('notes', ui.sheet.id) : null;
    if (sum && it && !sum.dataset.gwMeta) { sum.dataset.gwMeta = '1'; sum.insertAdjacentHTML('beforeend', `<span class="gw-ndot">·</span><span>${e(noteDateLabel(it))}</span>`); }
  }

  // после каждой отрисовки: колода, кошелёк, выбранный адрес, вид редактора заметки
  const after = () => {
    const ns = $('.note-sheet'); if (ns) noteShape(ns);
    if ($('#gw-deck')) bindDeck();
    const w = $('#gw-wallet'); if (w && !w.dataset.gwLaid) { w.dataset.gwLaid = '1'; if (local.lcard && !savedItem('cards', local.lcard)) local.lcard = null; layWallet(w);
      if (root.dataset.motion !== 'off') $$('[data-gw-lc]', w).forEach((c, j) => c.animate([{ translate: '0 70px', opacity: 0, filter: 'blur(6px)' }, { translate: '0 0', opacity: 1, filter: 'blur(0)' }], { duration: 620, delay: 60 + j * 70, easing: 'cubic-bezier(.19,1,.22,1)', fill: 'backwards' })); }
  };
  new MutationObserver(() => after()).observe(document.body, { childList: true, subtree: true });

  if (typeof render === 'function' && ui.page === 'saved' && (PAGES[ui.savedCategory] || ui.savedCategory === 'tickets') && document.querySelector('.dm-main')) render();
})();
