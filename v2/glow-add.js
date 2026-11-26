/* Flow · Glow — окно «Новое дело» (этап 1), пересадка #addSheet прототипа (openAdd, aChips, datePickHTML, timePickHTML).
   Разметка и классы — прототипа, стили — glow-screens.css (кусок «Окно добавления дела», собран кодом).
   Окно — сама форма приложения #entry-form со скрытыми полями due, time, checklist, priority, repeat: сохраняет
   прежний обработчик (app.js, submit entry-form). Цвет — важность дела (на Плане цвет строки берётся из неё же:
   --a2 высокая, --a3 обычная, --a1 низкая). Правка дела, «Список» и «Заметка» — прежние окна. Только Glow. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset.flowSkin !== 'glow' || window.flowGlowAdd) return;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const e = v => esc(String(v ?? ''));
  const I = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const icCal = I('<rect x="3.5" y="5" width="17" height="15" rx="4"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'), icClock = I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>');
  const icBack = I('<path d="M15 5l-7 7 7 7"/>'), icChev = I('<path d="M9 5l7 7-7 7"/>');
  const TIMES = ['', '09:00', '12:00', '13:00', '15:00', '18:00', '19:00', '21:00'];
  const PRI = [['--a1', 'low', 'Не срочно'], ['--a2', 'high', 'Важно'], ['--a3', 'medium', 'Обычное']];
  const MONS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const MONN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const DN = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  const HH = [...Array(24)].map((_, i) => String(i).padStart(2, '0')), MM = [...Array(12)].map((_, i) => String(i * 5).padStart(2, '0'));
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addD = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const wd = d => (d.getDay() + 6) % 7;

  // окно приложения для нового дела — подменяем; правка, «Когда», список и заметка — прежние
  const nativeEntry = window.entrySheet;
  const ours = () => ui.sheet?.kind === 'entry' && ui.sheet.type === 'task' && !ui.sheet.id && !['list', 'note', 'when'].includes(ui.sheet.taskMode);
  window.entrySheet = function (...args) {
    if (!ours()) return nativeEntry.apply(this, args);
    const s = ui.sheet;
    const A = s.gwA || (s.gwA = { title: s.draft?.title || '', date: s.date ?? (ui.page === 'tasks' ? '' : ui.selected || todayIso()), time: '', pri: 'medium', subs: [], pick: null, pm: null });
    if (A.time === '' && A.date && !s.gwTimeSet) { A.time = A.date === todayIso() ? '13:00' : '09:00'; s.gwTimeSet = true; }
    return `<div class="modal-backdrop gw-addbg" data-action="backdrop"><div class="gw gw-addl"><form id="entry-form" class="glass addsheet on" role="dialog" aria-modal="true" aria-label="Новое дело" style="--c:var(${PRI.find(p => p[1] === A.pri)[0]})">
    <div class="grab" data-gw-agrab></div>
    <div class="ah"><input id="gw-aTitle" name="title" placeholder="Что сделать?" autocomplete="off" enterkeyhint="next" maxlength="120" value="${e(A.title)}" aria-label="Название дела"><button type="submit" class="btn sm gw-main" id="gw-aSave"${A.title.trim() ? '' : ' disabled'}>Добавить</button></div>
    <div class="arow" id="gw-aDate">${dateChips(A)}</div>
    <div class="arow" id="gw-aTime"${A.date ? '' : ' style="display:none"'}>${timeChips(A)}</div>
    <div class="apick${A.pick ? ' on' : ''}" id="gw-aPick"><div id="gw-aPickIn">${A.pick === 'date' ? datePick(A) : A.pick === 'time' ? timePick() : ''}</div></div>
    <div class="arow colors" id="gw-aColor">${colorDots(A)}</div>
    <div class="subs" id="gw-aSubs">${subsHTML(A)}</div>
    <label class="st-add"><span class="sp"></span><input id="gw-aSub" class="st-in" placeholder="Подзадача" autocomplete="off" enterkeyhint="done" maxlength="200" aria-label="Подзадача"></label>
    <input type="hidden" name="due" value="${e(A.date)}"><input type="hidden" name="time" value="${e(A.date ? A.time : '')}"><input type="hidden" name="checklist" value="${e(A.subs.join('\n'))}">
    <input type="hidden" name="priority" value="${e(A.pri)}"><input type="hidden" name="project" value=""><input type="hidden" name="description" value=""><input type="hidden" name="repeat" value="none">
  </form></div></div>`;
  };
  function dateChips(A) {
    const today = new Date(new Date().toDateString()), tm = addD(today, 1), sel = ui.selected ? fromIso(ui.selected) : today;
    const dates = [['Сегодня', today], ['Завтра', tm]];
    if (iso(sel) !== iso(today) && iso(sel) !== iso(tm)) dates.push([`${sel.getDate()} ${MONS[sel.getMonth()]}`, sel]);
    const custom = A.date && !dates.some(([, d]) => iso(d) === A.date), cd = A.date ? fromIso(A.date) : null;
    return `<button type="button" class="chip pk${A.pick === 'date' ? ' open' : ''}${custom ? ' on' : ''}" data-gw-pick="date" aria-label="Выбрать дату" aria-expanded="${A.pick === 'date'}">${icCal}${custom ? `${cd.getDate()} ${MONS[cd.getMonth()]}` : ''}</button>`
      + dates.map(([l, d]) => `<button type="button" class="chip${A.date === iso(d) ? ' on' : ''}" data-gw-d="${iso(d)}">${l}</button>`).join('')
      + `<button type="button" class="chip${!A.date ? ' on' : ''}" data-gw-d="">Без срока</button>`;
  }
  function timeChips(A) {
    const custom = !TIMES.includes(A.time);
    return `<button type="button" class="chip pk${A.pick === 'time' ? ' open' : ''}${custom ? ' on' : ''}" data-gw-pick="time" aria-label="Выбрать время" aria-expanded="${A.pick === 'time'}">${icClock}${custom ? A.time : ''}</button>`
      + TIMES.map(t => `<button type="button" class="chip${A.time === t ? ' on' : ''}" data-gw-tm="${t}">${t || 'Без времени'}</button>`).join('');
  }
  const colorDots = A => PRI.map(([c, k, l]) => `<button type="button" class="cdot${A.pri === k ? ' on' : ''}" style="--cc:var(${c})" data-gw-c="${k}" aria-label="${l}" title="${l}"><i></i></button>`).join('');
  const subsHTML = A => A.subs.map((t, i) => `<div class="st-i" data-gw-ai="${i}" role="button" aria-label="Убрать: ${e(t)}"><span class="sbox"></span><span>${e(t)}</span></div>`).join('');
  function datePick(A) {
    const today = new Date(new Date().toDateString()), base = A.pm || (A.date ? fromIso(A.date) : today), first = new Date(base.getFullYear(), base.getMonth(), 1);
    A.pm = first;
    const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(), start = addD(first, -wd(first)), n = Math.ceil((wd(first) + dim) / 7) * 7;
    let g = ''; for (let i = 0; i < n; i++) { const d = addD(start, i), mute = d.getMonth() !== first.getMonth();
      g += `<button type="button" class="d${mute ? ' mute' : ''}${i % 7 > 4 ? ' we' : ''}${iso(d) === iso(today) ? ' today' : ''}${A.date === iso(d) ? ' on' : ''}" data-gw-pd="${iso(d)}" aria-label="${d.getDate()} ${MONS[d.getMonth()]}">${d.getDate()}</button>`; }
    return `<div class="dp"><div class="dh"><b>${MONN[first.getMonth()]}${first.getFullYear() !== today.getFullYear() ? ' ' + first.getFullYear() : ''}</b>
    <button type="button" class="nav" data-gw-pm="-1" aria-label="Предыдущий месяц">${icBack}</button><button type="button" class="nav" data-gw-pm="1" aria-label="Следующий месяц">${icChev}</button></div>
    <div class="wk">${DN.map((x, i) => `<span${i > 4 ? ' class="we"' : ''}>${x}</span>`).join('')}</div><div class="g">${g}</div></div>`;
  }
  const timePick = () => `<div class="tp"><i class="band"></i><div class="wheel" data-w="h" aria-label="Часы">${HH.map(h => `<button type="button">${h}</button>`).join('')}</div><span class="colon">:</span><div class="wheel" data-w="m" aria-label="Минуты">${MM.map(m => `<button type="button">${m}</button>`).join('')}</div></div>`;

  /* перерисовка частей окна на месте (без render приложения — поле названия не теряет фокус) */
  const A = () => ui.sheet?.gwA;
  function paint() {
    const a = A(), f = $('#entry-form.addsheet'); if (!a || !f) return;
    $('#gw-aDate', f).innerHTML = dateChips(a); $('#gw-aTime', f).innerHTML = timeChips(a); $('#gw-aTime', f).style.display = a.date ? '' : 'none';
    $('#gw-aColor', f).innerHTML = colorDots(a); $('#gw-aSubs', f).innerHTML = subsHTML(a);
    f.style.setProperty('--c', `var(${PRI.find(p => p[1] === a.pri)[0]})`);
    f.elements.due.value = a.date; f.elements.time.value = a.date ? a.time : ''; f.elements.checklist.value = a.subs.join('\n'); f.elements.priority.value = a.pri;
  }
  function paintPick() {
    const a = A(), p = $('#gw-aPick'), inn = $('#gw-aPickIn'); if (!a || !p) return;
    if (!a.pick) { p.classList.remove('on'); return; }
    inn.innerHTML = a.pick === 'date' ? datePick(a) : timePick(); p.classList.add('on');
    if (a.pick !== 'time') return;
    const [h, m] = (a.time || '12:00').split(':');
    $$('.wheel', inn).forEach(w => { const vals = w.dataset.w === 'h' ? HH : MM, cur = w.dataset.w === 'h' ? h : MM.reduce((x, y) => Math.abs(y - m) < Math.abs(x - m) ? y : x);
      const mark = () => { const i = Math.round(w.scrollTop / 40); [...w.children].forEach((b, j) => b.classList.toggle('on', j === i)); return i; };
      w.scrollTop = vals.indexOf(cur) * 40; mark(); let t;
      w.onscroll = () => { mark(); clearTimeout(t); t = setTimeout(() => { a.time = `${HH[Math.round($('[data-w=h]', inn).scrollTop / 40)]}:${MM[Math.round($('[data-w=m]', inn).scrollTop / 40)]}`; const keep = a.pick; paint(); a.pick = keep; }, 120); }; });
  }
  document.addEventListener('click', ev => {
    const f = ev.target.closest?.('#entry-form.addsheet'); if (!f) return; const a = A(); if (!a) return;
    const t = ev.target.closest('[data-gw-pick],[data-gw-d],[data-gw-tm],[data-gw-c],[data-gw-ai],[data-gw-pd],[data-gw-pm],.wheel button'); if (!t) return;
    ev.preventDefault(); const d = t.dataset;
    if (d.gwPick) { a.pick = a.pick === d.gwPick ? null : d.gwPick; a.pm = null; if (a.pick) document.activeElement?.blur(); paint(); paintPick(); return; }
    if (d.gwPd) { a.date = d.gwPd; $$('#gw-aPickIn .d').forEach(x => x.classList.toggle('on', x === t)); t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop'); paint(); setTimeout(() => { a.pick = null; paint(); paintPick(); }, 320); return; }
    if (d.gwPm) { a.pm = new Date(a.pm.getFullYear(), a.pm.getMonth() + Number(d.gwPm), 1); const g = $('#gw-aPickIn');
      g.animate([{ opacity: .2, transform: `translateX(${d.gwPm * 18}px)`, filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 380, easing: 'cubic-bezier(.19,1,.22,1)' }); g.innerHTML = datePick(a); return; }
    if (t.matches('.wheel button')) { const w = t.parentElement; w.scrollTo({ top: [...w.children].indexOf(t) * 40, behavior: 'smooth' }); return; }
    if (d.gwD !== undefined) { a.date = d.gwD; if (a.date && !a.time) a.time = a.date === todayIso() ? '13:00' : '09:00'; if (a.pick === 'date') a.pick = null; paint(); paintPick(); return; }
    if (d.gwTm !== undefined) { a.time = d.gwTm; if (a.pick === 'time') a.pick = null; paint(); paintPick(); return; }
    if (d.gwC) { a.pri = d.gwC; paint(); return; }
    if (d.gwAi !== undefined) { const i = Number(d.gwAi); t.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(30px)', filter: 'blur(4px)' }], { duration: 260, fill: 'forwards' }); setTimeout(() => { a.subs.splice(i, 1); paint(); }, 260); }
  }, true);
  document.addEventListener('input', ev => { if (ev.target.id !== 'gw-aTitle') return; const a = A(); if (!a) return; a.title = ev.target.value; $('#gw-aSave').disabled = !a.title.trim(); });
  document.addEventListener('focusin', ev => { if (ev.target.matches?.('#gw-aTitle,#gw-aSub')) { const a = A(); if (a?.pick) { a.pick = null; paint(); paintPick(); } } });
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter') return;
    if (ev.target.id === 'gw-aTitle') { ev.preventDefault(); ev.stopImmediatePropagation(); $('#gw-aSub')?.focus(); return; }
    if (ev.target.id === 'gw-aSub') { ev.preventDefault(); ev.stopImmediatePropagation(); const a = A(), v = ev.target.value.trim(); if (!a || !v) return; a.subs.push(v[0].toUpperCase() + v.slice(1)); ev.target.value = ''; paint();
      $('#gw-aSubs').lastElementChild?.animate([{ opacity: 0, transform: 'translateY(-6px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 400, easing: 'cubic-bezier(.19,1,.22,1)' }); }
  }, true);
  // свайп вниз по ручке закрывает окно
  document.addEventListener('pointerdown', ev => {
    const g = ev.target.closest?.('[data-gw-agrab]'); if (!g) return; const sh = g.closest('.addsheet'); let y0 = ev.clientY, dy = 0;
    g.setPointerCapture(ev.pointerId); sh.classList.add('drag');
    const mv = e2 => { dy = Math.max(0, e2.clientY - y0); sh.style.transform = `translateY(${dy}px)`; };
    const up = () => { g.removeEventListener('pointermove', mv); sh.classList.remove('drag'); sh.style.transform = ''; if (dy > 90) { ui.sheet = null; render(); } };
    g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up, { once: true });
  });
  // фокус на названии при открытии, как в прототипе
  new MutationObserver(() => { const t = $('#gw-aTitle'); if (t && !t.dataset.gwFocused) { t.dataset.gwFocused = '1'; setTimeout(() => t.focus({ preventScroll: true }), 250); } }).observe(document.body, { childList: true, subtree: true });
  window.flowGlowAdd = { nativeEntry };
})();
