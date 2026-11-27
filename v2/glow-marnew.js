/* Flow · Glow — новый марафон и правка марафона (этап 1), пересадка R.marnew прототипа (mnAuto, mnRes, mnWant, mnRows,
   bindMarNew, saveMarathon). Разметка и классы — прототипа, стили — glow-screens.css.
   Данные — черновик приложения universeUi.draft (название, части с imdbId); сохраняет прежняя форма #mu-edit-form
   (universeSave). Поиск — window.sorokaMovieFind (как «Найти фильм» приложения), автоподбор — киновселенные каталога
   (universeApi search/open), «Из Хочу» — фильмы коллекции с IMDb. Добавление, удаление и порядок — на месте, без
   перерисовки (клавиатура не прячется). Удаление марафона — прежнее mu-delete. Только Glow. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset.flowSkin !== 'glow' || window.flowGlowMarnew || typeof window.renderUniverseSheet !== 'function') return;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const e = v => esc(String(v ?? ''));
  const norm = s => String(s || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
  const I = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ic = { back: I('<path d="M15 5l-7 7 7 7"/>'), plus: I('<path d="M12 5v14M5 12h14"/>'), search: I('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'),
    x: I('<path d="M6 6l12 12M18 6 6 18"/>'), grip: I('<path d="M8 7h8M8 12h8M8 17h8"/>'), trash: I('<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>'),
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' };
  const G = () => window.flowGlowSavedMore;
  const poster = (p, cls = 'sm') => G()?.poster ? G().poster({ title: p.title, year: p.year, coverPath: p.coverPath || p.poster || '' }, cls) : '';
  const rchips = p => G()?.rchips ? G().rchips({ kinopoiskRating: p.kpRating, imdbRating: p.imdbRating }) : '';
  const st = { q: '', found: [], finding: false, timer: 0, fly: new Set(), picking: false };
  const D = () => universeUi.draft;
  const ours = () => ui.sheet?.kind === 'universe-edit' && universeUi.draft;
  const imdbOf = m => (String(m.imdbUrl || '').match(/tt\d+/) || [m.imdbId || ''])[0];

  /* ── части экрана ── */
  const fan = () => { const it = D().parts.slice(0, 3); return it.length ? it.map(p => `<span class="mp2">${poster(p)}</span>`).join('') : '<span class="mp2 gw-ghost"></span><span class="mp2 gw-ghost"></span><span class="mp2 gw-ghost"></span>'; };
  // автоподбор: киновселенные каталога; совпавшие с названием или поиском — первыми и подсвечены
  const frHit = (c, q) => { const n = norm(q).trim(); return n.length >= 3 && (norm(c.title).includes(n) || n.split(/\s+/).some(w => w.length >= 4 && norm(c.title).includes(w))); };
  function auto() {
    const cat = (universeUi.catalog || []).slice(0, 14); if (!cat.length) return '';
    const q = [D().title || '', st.q], hit = c => q.some(x => frHit(c, x)), have = new Set(D().parts.map(p => p.imdbId));
    return [...cat].sort((a, b) => hit(b) - hit(a)).map(c => { const parts = c.parts || [], left = parts.filter(p => !have.has(p.imdbId)).length, used = parts.length && !left;
      const art = (parts.length ? parts : [c]).slice(0, 3).map(p => `<span class="mpa">${poster(p)}</span>`).join('');
      return `<button type="button" class="glass mna${hit(c) ? ' hit' : ''}${used ? ' gw-used' : ''}" data-gw-fr="${e(c.source)}" aria-label="Подобрать: ${e(c.title)}"><span class="mnas">${art}</span><b>${e(c.title)}</b><em>${used ? ic.check : parts.length || c.count || ''}</em></button>`; }).join('');
  }
  function res() {
    const q = st.q.trim(); if (!q) return '';
    if (typeof window.sorokaMovieFind !== 'function') return '<div class="gw-empty">Фильмы ищет бот — в рабочем приложении</div>';
    if (st.finding) return '<div class="rsk"><i></i><span><b></b><b></b><b></b></span></div>';
    const have = new Set(D().parts.map(p => p.imdbId)), list = st.found.filter(p => !have.has(p.imdbId));
    return list.length ? list.map(p => `<div class="fsr"><span class="fsp">${poster(p)}</span><span class="fsb"><b>${e(p.title)}</b><small>${e(p.year || '')}${p.kind === 'series' ? ' · сериал' : ''}</small><span class="rcs">${rchips(p)}</span></span>
      <button type="button" class="fadd" data-gw-mnadd="${e(p.imdbId)}" aria-label="Добавить в марафон: ${e(p.title)}">${ic.plus}</button></div>`).join('') : (q.length >= 2 ? '<div class="gw-empty">Ничего не нашлось</div>' : '');
  }
  const wantParts = () => { const have = new Set(D().parts.map(p => p.imdbId));
    return savedItems('movies').filter(m => !movieIsViewed(m) && !m.skipped && imdbOf(m) && !have.has(imdbOf(m)))
      .map(m => ({ imdbId: imdbOf(m), title: m.title, originalTitle: m.originalTitle || '', year: m.year || '', released: '', coverPath: typeof movieCoverSource === 'function' ? movieCoverSource(m) : m.coverPath || '', kind: isSeries(m) ? 'series' : 'movie' })); };
  const want = () => { const w = wantParts(); return w.length ? `<div class="fsl">Из «Хочу»</div><div class="mnwant">${w.map(p => `<button type="button" class="mnw" data-gw-mnwant="${e(p.imdbId)}" aria-label="Добавить: ${e(p.title)}">${poster(p)}<span class="mnwp">${ic.plus}</span></button>`).join('')}</div>` : ''; };
  const rows = () => D().parts.length ? D().parts.map((p, i) => `<div class="mrow2 mnr" data-gw-ci="${e(p.imdbId)}"><span class="mn">${i + 1}</span><span class="mpost"${st.fly.has(p.imdbId) ? ' style="opacity:0"' : ''}>${poster(p)}</span>
    <span class="mb"><b>${e(p.title)}</b><small>${e(p.year || '')}${p.kind === 'series' ? ' · сериал' : ''}</small></span>
    <span class="mnh" data-gw-drag role="button" tabindex="0" aria-label="Перетащить: ${e(p.title)}">${ic.grip}</span>
    <button type="button" class="ldel" data-gw-mnrm="${i}" aria-label="Убрать: ${e(p.title)}">${ic.x}</button></div>`).join('') : '<div class="gw-empty mnempty">Добавьте фильмы — порядок можно менять перетаскиванием</div>';
  const barTxt = () => { const n = D().parts.length, edit = D().version !== undefined; return universeUi.busy ? 'Сохраняю…' : edit ? `Сохранить${n ? ' · ' + n : ''}` : n < 2 ? (n ? 'Добавьте ещё фильм' : 'Создать марафон') : `Создать марафон · ${n}`; };

  /* ── экран ── */
  const native = window.renderUniverseSheet;
  window.renderUniverseSheet = function (...args) {
    if (!ours()) return native.apply(this, args);
    if (!universeUi.loaded && !universeUi.loading) setTimeout(() => void universeLoad(), 0); // каталог для автоподбора
    const d = D(), edit = d.version !== undefined;
    const act = edit ? `<button type="button" class="ib glass" data-action="mu-delete" aria-label="Удалить марафон">${ic.trash}</button>` : '<button type="button" class="ib glass" style="visibility:hidden" tabindex="-1" aria-hidden="true"></button>';
    return `<div class="gw gw-sheet" data-s="marnew" role="dialog" aria-modal="true" aria-label="${edit ? 'Изменить марафон' : 'Новый марафон'}">
  <header class="gw-head gw-sub"><button type="button" class="ib glass gw-back" data-action="close-sheet" aria-label="Назад">${ic.back}</button><div class="tt"><h1></h1></div>${act}</header>
  <div class="gw-screen on gw-sub" data-s="marnew">
    <div class="mhero mnhero"><i class="fback" style="--p1:var(--a3);--p2:var(--a1)"></i><div class="mfan" id="gw-mnfan">${fan()}</div></div>
    <form id="mu-edit-form"><input class="ntitle mnt" id="gw-mnt" name="title" placeholder="Название марафона" autocomplete="off" enterkeyhint="next" maxlength="120" value="${e(d.title)}"></form>
    <div class="mnauto" id="gw-mnauto">${auto()}</div>
    <label class="glass search mnsearch"><span>${ic.search}</span><input id="gw-mnq" type="search" placeholder="Найти фильм" autocomplete="off" enterkeyhint="search" value="${e(st.q)}"></label>
    <div id="gw-mnres">${res()}</div><div id="gw-mnwant">${want()}</div>
    <div class="glass mlist" id="gw-mnlist">${rows()}</div>
    ${universeUi.error ? `<p class="gw-fsnote" role="alert">${e(universeUi.error)}</p>` : ''}
  </div>
  <div class="glass mnbar" id="gw-mnbar"><button type="submit" form="mu-edit-form" class="btn gw-main" id="gw-mnsave"${(d.version === undefined && d.parts.length < 2) || universeUi.busy ? ' disabled' : ''}>${barTxt()}</button></div>
</div>`;
  };

  /* перерисовка частей на месте; строки списка переезжают (FLIP), новые проявляются */
  function refresh(first) {
    if (!ours() || !$('#gw-mnlist')) return; const list = $('#gw-mnlist');
    first = first || new Map($$('[data-gw-ci]', list).map(r => [r.dataset.gwCi, r.getBoundingClientRect().top]));
    list.innerHTML = rows(); $('#gw-mnfan').innerHTML = fan(); $('#gw-mnwant').innerHTML = want(); $('#gw-mnres').innerHTML = res(); $('#gw-mnauto').innerHTML = auto();
    const b = $('#gw-mnsave'); b.textContent = barTxt(); b.disabled = (D().version === undefined && D().parts.length < 2) || universeUi.busy;
    $$('[data-gw-ci]', list).forEach(r => { const f = first.get(r.dataset.gwCi);
      if (f == null) { r.animate([{ opacity: 0, transform: 'translateY(-10px)', filter: 'blur(5px)', background: 'color-mix(in srgb,var(--a3) 30%,transparent)' }, { opacity: 1, transform: 'none', filter: 'blur(0)', background: 'transparent' }], { duration: 600, easing: 'cubic-bezier(.19,1,.22,1)' }); return; }
      const dy = f - r.getBoundingClientRect().top; if (Math.abs(dy) > 1) r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.19,1,.22,1)' }); });
  }
  // добавить часть — как mu-pick приложения: список становится личным, порядок ручной
  function addPart(p) {
    const d = D(); if (!p?.imdbId || d.parts.some(x => x.imdbId === p.imdbId) || d.parts.length >= 200) return false;
    d.parts.push({ imdbId: p.imdbId, title: p.title, originalTitle: p.originalTitle || '', year: p.year || '', released: p.released || '', coverPath: p.coverPath || p.poster || '', kind: p.kind || 'movie' });
    d.source = null; d.order_mode = 'manual'; return true;
  }
  // полёт постера из подсказки в строку списка (цель читается каждый кадр)
  const flyPoster = (r0, p) => new Promise(done => {
    const wrap = document.createElement('div'); wrap.className = 'gw'; const cl = document.createElement('span'); cl.className = 'mnfly'; cl.innerHTML = poster(p); wrap.appendChild(cl); document.body.appendChild(wrap);
    const t0 = performance.now(), DUR = 620, ease = t => 1 - Math.pow(1 - t, 3);
    const step = now => { const t = Math.min(1, (now - t0) / DUR), k = ease(t), tg = $(`[data-gw-ci="${CSS.escape(p.imdbId)}"] .mpost`), r1 = tg ? tg.getBoundingClientRect() : r0;
      cl.style.cssText = `left:${r0.left + (r1.left - r0.left) * k}px;top:${r0.top + (r1.top - r0.top) * k - Math.sin(Math.PI * k) * 60}px;width:${r0.width + (r1.width - r0.width) * k}px;height:${r0.height + (r1.height - r0.height) * k}px;transform:rotate(${(1 - k) * -8}deg);opacity:${t < .08 ? t / .08 : 1}`;
      if (t < 1) { requestAnimationFrame(step); return; }
      wrap.remove(); st.fly.delete(p.imdbId); if (tg) { tg.style.opacity = ''; tg.animate([{ filter: 'brightness(1.8)', transform: 'scale(1.12)' }, { filter: 'none', transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.2)' }); } done(); };
    requestAnimationFrame(step); });
  // автоподбор: части киновселенной из каталога по одной прилетают в список, пустое название печатается само
  async function autoPick(b) {
    if (st.picking) return; const src = b.dataset.gwFr, c = (universeUi.catalog || []).find(x => x.source === src); if (!c) return;
    st.picking = true; b.classList.add('gw-busy'); document.activeElement?.blur();
    try {
      let parts = c.parts; if (!parts?.length) { const a = await universeApi('open', { source: src }); parts = a?.parts || []; c.parts = parts; }
      const todo = parts.filter(p => !D().parts.some(x => x.imdbId === p.imdbId)).slice(0, 200 - D().parts.length);
      if (!todo.length) { b.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 300 }); return; }
      const nt = $('#gw-mnt'); if (!D().title.trim()) { D().title = ''; for (const ch of c.title) { D().title += ch; if (nt) nt.value = D().title; await new Promise(r => setTimeout(r, 30)); } }
      const r0 = ($('.mnas', b) || b).getBoundingClientRect(), flights = [];
      for (const p of todo) { if (!addPart(p)) continue; st.fly.add(p.imdbId); refresh(); $(`[data-gw-ci="${CSS.escape(p.imdbId)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); flights.push(flyPoster(r0, p)); await new Promise(r => setTimeout(r, 150)); }
      await Promise.all(flights); $('#gw-mnfan')?.animate([{ transform: 'scale(.94)' }, { transform: 'scale(1.03)', offset: .6 }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
    } catch (err) { toast(typeof universeError === 'function' ? universeError(err) : 'Не удалось получить состав'); }
    finally { st.picking = false; b.classList.remove('gw-busy'); refresh(); }
  }
  function find() {
    clearTimeout(st.timer); const q = st.q.trim(); if (q.length < 2 || typeof window.sorokaMovieFind !== 'function') return;
    st.timer = setTimeout(() => { st.finding = true; $('#gw-mnres').innerHTML = res();
      Promise.resolve(window.sorokaMovieFind(q)).then(a => { if (st.q.trim() !== q) return;
        st.found = (a?.found || []).map(p => ({ imdbId: p.imdbUrl?.match(/tt\d+/)?.[0], title: p.title, originalTitle: p.originalTitle, year: p.year, released: '', coverPath: p.poster || '', kind: p.kind || 'movie', kpRating: p.kpRating, imdbRating: p.imdbRating })).filter(p => p.imdbId); })
        .catch(() => { st.found = []; }).finally(() => { st.finding = false; const r = $('#gw-mnres'); if (r) r.innerHTML = res(); }); }, 400);
  }

  document.addEventListener('input', ev => {
    if (!ours()) return; const t = ev.target;
    if (t.id === 'gw-mnt') { clearTimeout(st.ta); st.ta = setTimeout(() => { const a = $('#gw-mnauto'); if (a) a.innerHTML = auto(); }, 140); } // draft.title пишет прежний обработчик формы
    if (t.id === 'gw-mnq') { st.q = t.value; st.found = []; $('#gw-mnres').innerHTML = res(); find(); const a = $('#gw-mnauto'); if (a) a.innerHTML = auto(); }
  });
  document.addEventListener('keydown', ev => { if (!ours()) return; if (ev.key === 'Enter' && ev.target.id === 'gw-mnt') { ev.preventDefault(); $('#gw-mnq')?.focus(); } if (ev.key === 'Enter' && ev.target.id === 'gw-mnq') ev.preventDefault();
    const h = ev.target.closest?.('[data-gw-drag]'); if (h && ['ArrowUp', 'ArrowDown'].includes(ev.key)) { ev.preventDefault(); const idv = h.closest('[data-gw-ci]').dataset.gwCi, a = D().parts, i = a.findIndex(p => p.imdbId === idv), j = i + (ev.key === 'ArrowUp' ? -1 : 1);
      if (j < 0 || j >= a.length) return; const [it] = a.splice(i, 1); a.splice(j, 0, it); D().source = null; D().order_mode = 'manual'; refresh(); $(`[data-gw-ci="${CSS.escape(idv)}"] [data-gw-drag]`)?.focus(); } }, true);
  // пустое название — как saveMarathon прототипа: «Новый марафон», с заглавной
  document.addEventListener('submit', ev => { if (ev.target.id !== 'mu-edit-form' || !ours() || !$('.gw-sheet[data-s=marnew]')) return; const d = D(); let t = String(d.title || '').trim() || 'Новый марафон'; d.title = t[0].toUpperCase() + t.slice(1); }, true);
  document.addEventListener('pointerdown', ev => { if (ev.target.closest?.('.gw-sheet[data-s=marnew] [data-gw-mnadd],.gw-sheet[data-s=marnew] [data-gw-mnwant]')) ev.preventDefault(); }, true); // клавиатура не прячется
  document.addEventListener('click', ev => {
    if (!ours()) return; const t = ev.target.closest?.('[data-gw-mnadd],[data-gw-mnwant],[data-gw-mnrm],[data-gw-fr]'); if (!t) return;
    ev.preventDefault(); ev.stopImmediatePropagation(); const d = t.dataset;
    if (d.gwFr) return void autoPick(t);
    if (d.gwMnrm !== undefined) { const row = t.closest('[data-gw-ci]'), i = Number(d.gwMnrm);
      // данные меняются по таймеру, а не по концу анимации (в фоне браузер анимации не доигрывает)
      row.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(40px)', filter: 'blur(5px)' }], { duration: 240, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
      setTimeout(() => { D().parts.splice(i, 1); D().source = null; refresh(); }, 240); return; }
    const p = d.gwMnadd ? st.found.find(x => x.imdbId === d.gwMnadd) : wantParts().find(x => x.imdbId === d.gwMnwant);
    if (p && addPart(p)) { refresh(); $('#gw-mnfan')?.animate([{ transform: 'scale(.94)' }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1.2)' }); }
  }, true);
  // перетаскивание за ручку: строка едет за пальцем, остальные расступаются
  document.addEventListener('pointerdown', ev => {
    const h = ev.target.closest?.('.gw-sheet[data-s=marnew] [data-gw-drag]'); if (!h) return; ev.preventDefault();
    const list = $('#gw-mnlist'), row = h.closest('[data-gw-ci]'), rws = $$('[data-gw-ci]', list), from = rws.indexOf(row), H = row.offsetHeight, y0 = ev.clientY; let to = from;
    try { h.setPointerCapture(ev.pointerId); } catch (_) {} row.classList.add('drag');
    const mv = e2 => { const dy = e2.clientY - y0; row.style.transform = `translateY(${dy}px) scale(1.02)`; to = Math.max(0, Math.min(rws.length - 1, from + Math.round(dy / H)));
      rws.forEach((r, i) => { if (r === row) return; const s = from < to && i > from && i <= to ? -H : from > to && i < from && i >= to ? H : 0; r.style.transform = s ? `translateY(${s}px)` : ''; }); };
    const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
      const first = new Map(rws.map(r => [r.dataset.gwCi, r.getBoundingClientRect().top])); const a = D().parts, [it] = a.splice(from, 1); a.splice(to, 0, it);
      if (to !== from) { D().source = null; D().order_mode = 'manual'; } rws.forEach(r => { r.style.transform = ''; r.classList.remove('drag'); }); refresh(first); };
    h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  }, true);
  // каталог догрузился, пока экран открыт — подсказки появляются
  setInterval(() => { if (!ours()) return; const a = $('#gw-mnauto'); if (a && !a.children.length && (universeUi.catalog || []).length) a.innerHTML = auto(); }, 700);
  window.flowGlowMarnew = { native };
})();
