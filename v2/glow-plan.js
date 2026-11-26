/* Flow · Glow — экран «План» (этап 1), пересадка из docs/design/glow-prototype/index.html:
   R.plan, календарь неделя/месяц (daysHTML, swapDays), повестка (agendaHTML, toggleDone, bindSubs),
   «Ближайшее» и билеты (nearHTML). Разметка и классы — прототипа, стили — glow-screens.css (собран кодом).
   Данные — настоящие (tasksOn, eventsOn, birthdays, билеты), действия — прежние data-action приложения:
   toggle-task, task-check-item, select-day, calendar-mode, edit, add, birthday-open, saved-open, payment-confirm.
   Работает только в Glow (html[data-flow-skin=glow]); в Магии и Классике ничего не меняет. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset.flowSkin !== 'glow' || window.flowGlowPlan) return;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const e = v => esc(String(v ?? ''));
  const reduce = () => root.dataset.motion === 'off' || (root.dataset.motion !== 'on' && matchMedia('(prefers-reduced-motion:reduce)').matches);
  const anim = (node, frames, opts) => { if (!node || reduce()) return null; try { return node.animate(frames, opts); } catch { return null; } };
  const EASE = 'cubic-bezier(.19,1,.22,1)';

  /* ── иконки прототипа (ic, nic) ── */
  const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
  const ic = {
    back: I('<path d="M15 5l-7 7 7 7"/>'), chev: I('<path d="M9 6l6 6-6 6"/>'), plus: I('<path d="M12 5v14M5 12h14"/>'),
    check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'stroke-width="3"'),
    ticket: I('<path d="M4 7.5a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-2a2.5 2.5 0 0 0 0-5Z"/><path d="M14 6v12" stroke-dasharray="2 2.5"/>'),
    wallet: I('<path d="M4 7.5a2 2 0 0 1 2-2h11v4"/><rect x="4" y="9.5" width="16" height="10" rx="2.5"/><path d="M16 14.5h.01"/>')
  };
  const nic = {
    film: I('<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M7.5 4v16M16.5 4v16M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4"/>'),
    train: I('<rect x="5" y="3.5" width="14" height="14" rx="4"/><path d="M5 11h14M8.5 21l2-3.5M15.5 21l-2-3.5M9 14.3h.01M15 14.3h.01"/>'),
    music: I('<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
    gift: I('<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-2-4-6-3-5 0M12 8c2-4 6-3 5 0"/>'),
    ev: I('<rect x="4" y="5.5" width="16" height="14.5" rx="3.5"/><path d="M4 10.5h16M8.5 3.5v4M15.5 3.5v4"/><circle cx="12" cy="15" r="1.3" fill="currentColor"/>')
  };

  /* ── даты ── */
  const DN = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const MONS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const dayDiff = iso => Math.round((parseDate(iso) - parseDate(todayIso())) / 864e5);
  const inDays = n => n <= 0 ? 'Сегодня' : n === 1 ? 'Завтра' : n === 2 ? 'Послезавтра' : `Через ${n} ${word(n, 'день', 'дня', 'дней')}`;
  const nowHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const tkey = t => t && t !== '—' ? t : '99';
  const expanded = () => Boolean(ui.calendarExpanded);

  function calTitle(days) {
    if (expanded()) { const m = parseDate(ui.month); return MONTHS_NOM[m.getMonth()] + (m.getFullYear() !== new Date().getFullYear() ? ' ' + m.getFullYear() : ''); }
    const a = days[0], b = days[6];
    return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS_GEN[b.getMonth()]}` : `${a.getDate()} ${MONS[a.getMonth()]} – ${b.getDate()} ${MONS[b.getMonth()]}`;
  }
  /* сетка: неделя — 7 ячеек с подписями; месяц — строка дней недели + 5–6 рядов (как daysHTML прототипа) */
  function daysHTML(days) {
    const week = !expanded(), sel = ui.selected || todayIso(), today = todayIso(), month = ui.month.slice(0, 7);
    const si = days.findIndex(d => localIso(d) === sel);
    let h = week ? '' : `<div class="wk">${DN.map((n, i) => `<span${i > 4 ? ' class="we"' : ''}>${n}</span>`).join('')}</div>`;
    h += `<div class="gw-days ${week ? 'week' : 'month'}"><i class="westrip"></i><i class="daylamp" style="--i:${Math.max(si, 0) % 7};--r:${Math.floor(Math.max(si, 0) / 7)};opacity:${si < 0 ? 0 : 1}"></i>`;
    days.forEach((d, i) => {
      const iso = localIso(d), mute = !week && iso.slice(0, 7) !== month;
      const pending = tasksOn(iso).filter(t => !t.done).length, events = eventsOn(iso).length;
      const info = typeof dayInfo === 'function' ? dayInfo(iso) : {};
      const cls = ['gw-day', i === si ? 'sel' : '', mute ? 'mute' : '', i % 7 > 4 ? 'we' : '', iso === today ? 'today' : ''].filter(Boolean).join(' ');
      const label = [fullDate(iso), iso === today ? 'сегодня' : '', pending ? `${pending} ${word(pending, 'дело', 'дела', 'дел')}` : '', events ? `${events} ${word(events, 'событие', 'события', 'событий')}` : '', info.holiday || ''].filter(Boolean).join(', ');
      h += `<button type="button" class="${cls}" data-action="select-day" data-date="${iso}" aria-label="${e(label)}" aria-pressed="${i === si}">${week ? `<span>${DN[i]}</span>` : ''}<b>${d.getDate()}</b>${pending + events ? '<i class="dot"></i>' : ''}</button>`;
    });
    return h + '</div>';
  }

  /* ── повестка выбранного дня: дела, события и платежи одной линией времени ── */
  const COLOR = { high: '--a2', medium: '--a3', low: '--a1' };
  function dayItems(day) {
    const isToday = day === todayIso();
    const tasks = tasksOn(day).map(t => ({ key: 't:' + t.id, kind: 'task', id: t.id, t: t.time || '', n: t.title, s: t.description || t.project || '', c: COLOR[t.priority] || '--a3', done: Boolean(t.done), subs: t.checklist || [] }));
    const events = eventsOn(day).map(ev => ({ key: 'e:' + ev.id, kind: 'event', id: ev.id, t: ev.time || '', n: ev.title, s: ev.description || (ev.time ? '' : 'Весь день'), c: '--a1', done: false, subs: [] }));
    const pays = isToday ? (data.finance?.payments || []).filter(p => p.status !== 'confirmed' && p.nextOn && p.nextOn <= day)
      .map(p => ({ key: 'p:' + p.id, kind: 'pay', id: p.id, t: '', n: p.title, s: `Платёж · ${demoMoney(p.amount, p.currency || 'RUB')}${p.nextOn < day ? ' · с ' + dateLabel(p.nextOn) : ''}`, c: '--a1', done: false, subs: [] })) : [];
    return [...tasks, ...events, ...pays];
  }
  function agendaOrder(list) {
    const idx = list.map((_, k) => k).sort((a, b) => tkey(list[a].t).localeCompare(tkey(list[b].t)) || a - b);
    return [...idx.filter(k => !list[k].done), ...idx.filter(k => list[k].done)];
  }
  function nowIndex(day, list, now) {
    if (day !== todayIso()) return -1; let i = -1, best = '';
    list.forEach((x, k) => { if (x.t && x.t <= now && x.t >= best) { best = x.t; i = k; } }); return i;
  }
  function subChip(subs) {
    if (!subs.length) return ''; const d = subs.filter(x => x.done).length;
    return `<span class="sc${d === subs.length ? ' full' : ''}"><i style="--v:${d / subs.length}"></i>${d}/${subs.length}</span>`;
  }
  const subItem = (x, i, id) => `<div class="st-i${x.done ? ' done' : ''}" data-si="${i}"><button type="button" class="sbox" data-action="task-check-item" data-id="${e(id)}" data-index="${i}" aria-label="${x.done ? 'Вернуть' : 'Готово'}: ${e(x.text)}">${ic.check}</button><span>${e(x.text)}</span></div>`;
  function subsHTML(x) {
    // подзадачи: отмеченные внизу, номер пункта прежний (как checklistBlock приложения)
    const order = x.subs.map((s, i) => [s, i]).sort((a, b) => Number(a[0].done) - Number(b[0].done));
    return `<div class="subs">${order.map(([s, i]) => subItem(s, i, x.id)).join('')}</div>
      <label class="st-add"><span class="sp">${ic.plus}</span><input class="st-in" data-gw-sub="${e(x.id)}" placeholder="Подзадача" enterkeyhint="done" autocomplete="off" maxlength="200"></label>`;
  }
  const openKeys = new Set();
  function rowHTML(x, j, nw) {
    const open = openKeys.has(x.key);
    const mark = x.kind === 'task' || x.kind === 'pay'
      ? `<button type="button" class="chk" data-action="${x.kind === 'pay' ? 'payment-confirm' : 'toggle-task'}" data-id="${e(x.id)}" aria-label="${x.done ? 'Вернуть' : x.kind === 'pay' ? 'Оплачено' : 'Выполнено'}: ${e(x.n)}">${ic.check}</button>`
      // событие в приложении не отмечается, но выглядит как в прототипе — тот же кружок, без действия
      : `<span class="chk" aria-hidden="true"></span>`;
    const acts = x.kind === 'task'
      ? `<button type="button" class="btn sm glass" data-gw-move="${e(x.id)}">Перенести</button><button type="button" class="btn sm glass" data-action="edit" data-type="task" data-id="${e(x.id)}">Изменить</button>`
      : x.kind === 'event' ? `<button type="button" class="btn sm glass" data-action="edit" data-type="event" data-id="${e(x.id)}">Изменить</button>`
      : `<button type="button" class="btn sm glass" data-action="finance-open-payments">Платежи</button>`;
    return `<div class="ev in${x.done ? ' done' : ''}${nw ? ' now' : ''}${open ? ' open' : ''}" style="--c:var(${x.c});animation-delay:${80 + j * 60}ms" data-ev="${e(x.key)}" data-t="${tkey(x.t)}" tabindex="0" role="button" aria-expanded="${open}">
      ${mark}<time>${e(x.t || '—')}</time>
      <span class="evt"><b>${e(x.n)}</b><small><span class="ss">${nw ? 'Сейчас · ' : ''}${e(x.s)}</span>${subChip(x.subs)}</small></span>
      <div class="more"><div>${x.kind === 'task' ? subsHTML(x) : ''}<span class="acts">${acts}</span></div></div></div>`;
  }
  function agendaHTML(day) {
    const add = `<button type="button" class="ib glass add" data-action="add" data-type="task" aria-label="Новое дело">${ic.plus}</button>`;
    const list = dayItems(day);
    if (!list.length) return `<div class="glass agc in"><div class="hd"><span class="free">Свободный день</span>${add}</div></div>`;
    const now = nowHM(), cur = nowIndex(day, list, now), doneN = list.filter(x => x.done).length;
    const order = agendaOrder(list);
    let rows = '', placed = day !== todayIso();
    const undone = order.filter(k => !list[k].done), after = undone.filter(k => tkey(list[k].t) <= now).pop();
    const line = `<div class="nowl"><i></i><span>${now}</span><b></b></div>`;
    order.forEach((k, j) => {
      if (!placed && after === undefined && k === undone[0]) { rows += line; placed = true; }
      rows += rowHTML(list[k], j, k === cur && !list[k].done);
      if (!placed && k === after) { rows += line; placed = true; }
    });
    const tasks = list.filter(x => x.kind === 'task'), tDone = tasks.filter(x => x.done).length;
    return `<div class="glass agc in" id="gw-agc">
      <div class="hd"><div class="prog" role="progressbar" aria-label="Выполнено ${doneN} из ${list.length}" aria-valuemin="0" aria-valuemax="${list.length}" aria-valuenow="${doneN}" id="gw-agN"><i id="gw-agP" style="--p:${doneN / list.length}"></i></div>${add}</div>
      <div class="list" id="gw-agenda" data-done="${tDone}"><i class="rail"></i>${rows}</div></div>`;
  }

  /* ── ближайшее: дни рождения и события на 2 недели, билеты на неделю ── */
  function nearHTML() {
    const today = todayIso();
    const bds = typeof birthdays === 'function' ? birthdays().filter(b => b.days <= 14).slice(0, 4) : [];
    const ids = new Set(bds.map(b => b.e.id));
    const evs = (data.events || []).filter(x => !ids.has(x.id) && x.due > today && x.due <= offsetIso(14))
      .sort((a, b) => (a.due + (a.time || '')).localeCompare(b.due + (b.time || ''))).slice(0, 4);
    const near = [
      ...bds.map(b => { const gifts = (b.e.gifts || []).filter(g => !g.done).length;
        return { d: b.days, date: b.date, t: b.name, s: 'День рождения' + (gifts ? ` · ${gifts} ${plural(gifts, 'идея', 'идеи', 'идей')} подарка` : ''), k: 'bd', c: 'var(--a1)', attrs: `data-action="birthday-open" data-id="${e(b.e.id)}"` }; }),
      ...evs.map(x => ({ d: dayDiff(x.due), date: parseDate(x.due), t: x.title, s: [x.time || 'Весь день', x.description].filter(Boolean).join(' · '), k: 'ev', c: 'var(--a3)', attrs: `data-action="edit" data-type="event" data-id="${e(x.id)}"` }))
    ].sort((a, b) => a.d - b.d);
    const rows = near.map((x, j) => `<button type="button" class="nr in" ${x.attrs} style="--c:${x.c};animation-delay:${j * 50}ms"><span class="ndot">${x.k === 'bd' ? nic.gift : nic.ev}</span><span class="nd"><b>${x.date.getDate()}</b><small>${x.date.toLocaleDateString('ru', { month: 'short' }).replace('.', '')}</small></span>
      <span class="nb"><b>${e(x.t)}</b><small>${e(x.s)}</small></span><em>${inDays(x.d)}</em></button>`).join('');
    const now = Date.now();
    const tix = typeof savedItems === 'function' && typeof ticketStart === 'function' ? savedItems('tickets').filter(t => { const at = ticketStart(t); return at && !ticketExpired(t, now) && at.getTime() - now <= 7 * 864e5; }).sort((a, b) => ticketStart(a) - ticketStart(b)) : [];
    const tIcon = t => t.ticketType === 'train' ? nic.train : t.ticketType === 'event' ? nic.music : /кино|фильм|imax/i.test(`${t.title} ${t.venue || ''}`) ? nic.film : ic.ticket;
    const tk = tix.map(t => { const where = t.ticketType === 'event' ? t.venue : t.carrier || [t.origin, t.destination].filter(Boolean).join(' → ');
      return `<button type="button" class="tk" data-action="saved-open" data-category="tickets" data-id="${e(t.id)}" style="--p1:var(--a3);--p2:var(--a1)"><i class="tkg"></i><span class="tks">${tIcon(t)}</span>
      <span class="tkb"><b>${e(t.title)}</b><small>${inDays(dayDiff(t.eventDate))}${t.eventTime ? ' · ' + e(t.eventTime) : ''}</small>${where || t.seat ? `<span class="tkm">${[where, t.seat].filter(Boolean).map(e).join(' · ')}</span>` : ''}</span></button>`; }).join('');
    return `${rows ? `<div class="glass near">${rows}</div>` : ''}${tk ? `<div class="tix">${tk}</div>` : ''}`;
  }

  function planBody(day) { return agendaHTML(day) + (day === todayIso() ? nearHTML() : ''); }

  /* ── R.plan ── */
  const nativeToday = window.todayPage;
  window.todayPage = function () {
    const days = calendarDays(), day = ui.selected || todayIso(), month = expanded();
    const period = (month ? 'month:' : 'week:') + localIso(days[0]);
    return `<div class="gw gw-plan dm-plan">
  <div class="glass cal" id="gw-cal">
    <div class="gw-top"><b class="ttl" id="gw-calT">${calTitle(days)}</b>
      <button type="button" class="nav" data-gw-nav="-1" aria-label="Назад">${ic.back}</button><button type="button" class="nav" data-gw-nav="1" aria-label="Вперёд">${ic.chev}</button>
      <div class="seg" style="--n:2;--i:${month ? 1 : 0}" id="gw-calSeg"><i class="lamp"></i><button type="button" class="${month ? '' : 'on'}" data-action="calendar-mode" data-mode="week" aria-pressed="${!month}">Неделя</button><button type="button" class="${month ? 'on' : ''}" data-action="calendar-mode" data-mode="month" aria-pressed="${month}">Месяц</button></div></div>
    <div id="gw-days" data-period="${period}">${daysHTML(days)}</div>
  </div>
  <div id="gw-planBody" data-date="${day}">${planBody(day)}</div></div>`;
  };
  window.flowGlowPlan = { nativeToday };

  /* ── перерисовка на месте: календарь и повестка живут, как в прототипе ── */
  const tpl = html => { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
  const attrs = (target, source) => { for (const a of [...target.attributes]) if (!source.hasAttribute(a.name)) target.removeAttribute(a.name); for (const a of source.attributes) if (target.getAttribute(a.name) !== a.value) target.setAttribute(a.name, a.value); };
  function fit(box, h0) { const h1 = box.scrollHeight; if (h1 !== h0) anim(box, [{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 560, easing: EASE }); }
  function clip(box) { box.classList.add('clip'); clearTimeout(box._unclip); box._unclip = setTimeout(() => box.classList.remove('clip'), 900); }
  function patchCalendar(old, next) {
    const ob = $('#gw-days', old), nb = $('#gw-days', next);
    attrs($('#gw-calSeg', old), $('#gw-calSeg', next));
    $$('#gw-calSeg button', next).forEach((b, i) => attrs($$('#gw-calSeg button', old)[i], b));
    const t = $('#gw-calT', old), nt = $('#gw-calT', next);
    const [om, os] = ob.dataset.period.split(':'), [nm, ns] = nb.dataset.period.split(':');
    if (om === nm && os === ns) {
      const oldDays = $$('.gw-day', ob), newDays = $$('.gw-day', nb);
      const wasSel = oldDays.findIndex(d => d.classList.contains('sel'));
      oldDays.forEach((d, i) => { const n = newDays[i]; const pop = d.classList.contains('pop'); attrs(d, n); if (pop) d.classList.add('pop'); if (d.innerHTML !== n.innerHTML) d.innerHTML = n.innerHTML; });
      const isSel = oldDays.findIndex(d => d.classList.contains('sel'));
      attrs($('.daylamp', ob), $('.daylamp', nb));
      if (isSel >= 0 && isSel !== wasSel) { const c = oldDays[isSel]; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
      return;
    }
    const h0 = ob.offsetHeight; clip(ob); attrs(ob, nb);
    if (t.textContent !== nt.textContent) { t.textContent = nt.textContent; anim(t, [{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 420, easing: EASE }); }
    if (om === nm) { // листание: сетка уезжает и приезжает с другой стороны
      const dir = ns > os ? 1 : -1;
      const out = anim(ob, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-46 * dir}px)` }], { duration: 150, easing: 'cubic-bezier(.4,0,1,1)' });
      const swap = () => { ob.innerHTML = nb.innerHTML; fit(ob, h0); anim(ob, [{ opacity: 0, transform: `translateX(${64 * dir}px)` }, { opacity: 1, transform: 'none' }], { duration: 500, easing: EASE }); };
      if (out) out.onfinish = swap; else swap();
      return;
    }
    // неделя ↔ месяц: ряды расходятся волной от ряда с выбранным днём
    ob.innerHTML = nb.innerHTML; fit(ob, h0);
    if (reduce()) return;
    const cells = $$('.gw-day', ob), si = Math.max(cells.findIndex(c => c.classList.contains('sel')), 0), sr = Math.floor(si / 7), sc = si % 7, toMonth = nm === 'month';
    cells.forEach((c, i) => { const r = Math.floor(i / 7), dr = r - sr; if (toMonth && dr === 0) return; c.style.setProperty('--dl', (Math.abs(dr) * 55 + Math.abs(i % 7 - sc) * 14) + 'ms'); c.style.setProperty('--dy', dr ? -Math.sign(dr) * 18 : 10); c.classList.add('rip'); });
    anim($('.wk', ob), [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 80, easing: EASE, fill: 'backwards' });
  }
  let reorderTimer = 0;
  function patchBody(old, next) {
    const ob = $('#gw-planBody', old), nb = $('#gw-planBody', next);
    if (ob.dataset.date !== nb.dataset.date) { // другой день
      clearTimeout(reorderTimer); attrs(ob, nb); ob.innerHTML = nb.innerHTML; stagger(ob);
      anim(ob.firstElementChild, [{ opacity: .4, filter: 'blur(6px)', transform: 'scale(.98)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 480, easing: EASE });
      return;
    }
    const oa = $('#gw-agenda', ob), na = $('#gw-agenda', nb);
    if (!oa || !na) { ob.innerHTML = nb.innerHTML; stagger(ob); return; }
    // отметка: галочка + вспышка + зачёркивание на месте, затем дело плавно уезжает (FLIP), как toggleDone
    let toggled = false;
    for (const row of $$('.ev', na)) {
      const was = $(`.ev[data-ev="${CSS.escape(row.dataset.ev)}"]`, oa); if (!was) continue;
      const nowDone = row.classList.contains('done');
      if (was.classList.contains('done') !== nowDone) {
        toggled = true; was.classList.toggle('done', nowDone); was.classList.remove('open', 'now');
        if (nowDone) { anim($('.chk', was), [{ boxShadow: '0 0 0 0 var(--c)' }, { boxShadow: '0 0 0 16px transparent' }], { duration: 650, easing: EASE }); anim(was, [{ background: 'color-mix(in srgb,var(--c) 22%,transparent)' }, { background: 'transparent' }], { duration: 900, easing: 'ease-out' }); }
      }
    }
    const op = $('#gw-agP', ob), np = $('#gw-agP', nb); if (op && np) op.style.setProperty('--p', np.style.getPropertyValue('--p'));
    const focus = document.activeElement?.matches?.('.st-in') ? document.activeElement.dataset.gwSub : null;
    clearTimeout(reorderTimer);
    reorderTimer = setTimeout(() => {
      const box = $('#gw-agenda', ob); if (!box) return;
      const first = new Map($$('.ev,.nowl', box).map(n => [n.dataset.ev || 'now', n.getBoundingClientRect().top]));
      const near = [...ob.children].slice(1).map(n => n.outerHTML).join(''), nearNext = [...nb.children].slice(1).map(n => n.outerHTML).join('');
      const ag = $('#gw-agc', ob), nag = $('#gw-agc', nb);
      attrs(ag, nag); $('.hd', ag).replaceWith($('.hd', nag)); box.replaceWith(na);
      if (near !== nearNext) { [...ob.children].slice(1).forEach(n => n.remove()); [...nb.children].slice(1).forEach(n => ob.append(n)); }
      $$('.ev,.nowl', na).forEach(n => { n.classList.remove('in'); const was = first.get(n.dataset.ev || 'now'); if (was === undefined) return; const dy = was - n.getBoundingClientRect().top; if (Math.abs(dy) > 1) anim(n, [{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 560, easing: EASE }); });
      if (focus) $(`.st-in[data-gw-sub="${CSS.escape(focus)}"]`, na)?.focus({ preventScroll: true });
      stagger(ob);
    }, toggled ? 380 : 0);
  }
  /* разнести фазы грани и блика (stagger прототипа): стабильно по месту, без случайных чисел в разметке */
  function stagger(scope) {
    $$('.glass', scope).forEach((g, i) => { const s = g.style; if (s.getPropertyValue('--rd')) return; const r = k => ((Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
      s.setProperty('--rd', (-r(1) * 16).toFixed(2) + 's'); });
  }
  const nativePatch = window.flowMagicPatchPlan;
  window.flowMagicPatchPlan = (main, markup) => {
    const next = tpl(markup).querySelector('.gw-plan'), old = main.querySelector(':scope>.gw-plan');
    if (!next) return nativePatch ? nativePatch(main, markup) : false;
    if (!old) { main.innerHTML = markup; stagger(main); return true; }
    patchCalendar(old, next); patchBody(old, next);
    return true;
  };
  // первая отрисовка раздела идёт полной сборкой — разнести блики и там
  new MutationObserver(() => { const p = $('.dm-main > .gw-plan'); if (p && !p.dataset.gwStaggered) { p.dataset.gwStaggered = '1'; stagger(p); } }).observe(document.getElementById('app') || document.body, { childList: true, subtree: true });

  /* ── жесты и действия, которых нет в data-action приложения ── */
  document.addEventListener('click', event => {
    const plan = event.target.closest?.('.gw-plan'); if (!plan) return;
    const nav = event.target.closest('[data-gw-nav]');
    if (nav) { stepCalendar(Number(nav.dataset.gwNav)); return; }
    const move = event.target.closest('[data-gw-move]');
    if (move) { // «Перенести»: окно дела сразу на выборе даты (прежний task-when)
      openEntry('task', ui.selected, move.dataset.gwMove);
      requestAnimationFrame(() => document.querySelector('.modal-backdrop [data-action="task-when"]')?.click());
      return;
    }
    if (event.target.closest('.more,.chk,button,input,a')) return;
    const row = event.target.closest('#gw-agenda .ev'); if (!row) return;
    const open = !row.classList.contains('open');
    $$('#gw-agenda .ev.open', plan).forEach(r => { r.classList.remove('open'); r.setAttribute('aria-expanded', 'false'); openKeys.delete(r.dataset.ev); });
    row.classList.toggle('open', open); row.setAttribute('aria-expanded', String(open)); if (open) openKeys.add(row.dataset.ev);
  });
  document.addEventListener('keydown', event => {
    const row = event.target.closest?.('.gw-plan #gw-agenda .ev');
    if (row && event.target === row && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); row.click(); return; }
    const inp = event.target.closest?.('.gw-plan .st-in');
    if (!inp || event.key !== 'Enter') return;
    event.preventDefault(); const text = inp.value.trim(); if (!text) return;
    const task = data.tasks.find(t => String(t.id) === inp.dataset.gwSub); if (!task) return;
    // подзадача — пункт чек-листа задачи, как в окне задачи; новый пункт открывает задачу снова
    task.checklist = [...(task.checklist || []), { text, done: false }];
    if (task.done) task.done = false;
    inp.value = ''; save(); render();
  });
  // листание календаря жестом (bindSwipe прототипа)
  let x0 = null, y0 = 0, swiped = 0;
  document.addEventListener('pointerdown', ev => { if (!ev.target.closest?.('.gw-plan #gw-days')) return; x0 = ev.clientX; y0 = ev.clientY; });
  document.addEventListener('pointerup', ev => {
    if (x0 == null) return; const dx = ev.clientX - x0, dy = ev.clientY - y0; x0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) { swiped = Date.now(); stepCalendar(dx < 0 ? 1 : -1); }
  });
  document.addEventListener('pointercancel', () => { x0 = null; });
  document.addEventListener('click', ev => { if (Date.now() - swiped < 350 && ev.target.closest?.('.gw-plan #gw-days')) { ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);

  if (typeof render === 'function' && ui.page === 'today' && document.querySelector('.dm-main')) render();
})();
