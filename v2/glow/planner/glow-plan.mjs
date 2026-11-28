import { openPlannerRuntime } from './runtime-session.js';
import { createPlannerOfflineCache } from './planner-offline.mjs';
import { showPlanTicket, clearPlanTicket } from './glow-plan-tickets.mjs';
import { adoptSaved, openSavedRecord } from './glow-saved.mjs';
import { openSavedNote } from './glow-notes.mjs';
import { connectNoteWrites } from './glow-notes.mjs';
import { connectLibrary, libraryScreens } from './glow-library-store.mjs';
import { connectMetrics } from './glow-metrics.mjs';
import { adoptFinance, connectFinance } from './glow-finance.mjs';
import { connectRender } from './glow-render.mjs';
import { connectMoreRecords } from './glow-more-records.mjs';
import { connectMoreSecure } from './glow-more-secure.mjs';
import { connectMorePc } from './glow-more-pc.mjs';
import { connectMoreConnections } from './glow-more-connections.mjs';
import { applyMoreLayout, connectMoreSettings } from './glow-more-settings.mjs';

const root = document.documentElement;
const practiceVisual = root.dataset.glowPractice === 'prototype';
const priorityColors = { high: '--a1', low: '--a2', medium: '--a3' };
const colorPriorities = { '--a1': 'high', '--a2': 'low', '--a3': 'medium' };
const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? value : '';
const minutesOfDay = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const dateKey = date => [date.getFullYear(), date.getMonth() + 1, date.getDate()]
  .map((part, i) => String(part).padStart(i === 0 ? 4 : 2, '0')).join('-');

let state = null;
let openMetric;
let runtime = null;
let assistant = null;
let busy = false;
let formId = null;
let entryForm = null;
let projectForAdd = '';
let days = new Map();
let clock = '';
let clockTimer = 0;
let agendaTimer = 0;
let pendingWriteKey = null;
let booting = root.dataset.glowRelease === 'true';
let showingCachedPlan = false;
const practiceRoutes = new Set(['practice', 'sport', 'english', 'piano']);

const demoBindBody = bindBody;
const demoBindTaskList = bindTaskList;
const demoOpenAdd = openAdd;
const demoNearHTML = nearHTML;

function dateDistance(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const value = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(value) ? (value - Date.parse(`${dateKey(TODAY)}T00:00:00Z`)) / 86400000 : null;
}

function updateClock(timezone, first) {
  let zone = timezone || 'Europe/Moscow';
  try { new Intl.DateTimeFormat('sv-SE', { timeZone: zone }); }
  catch { zone = 'Europe/Moscow'; }
  const instant = new Date();
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(instant);
  clock = new Intl.DateTimeFormat('ru-RU', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(instant);
  const previousDay = dateKey(TODAY);
  const followsToday = same(S.sel, TODAY);
  const anchorFor = date => S.cal === 'month' ? new Date(date.getFullYear(), date.getMonth(), 1) : monday(date);
  const showsCurrentPeriod = same(S.anchor, anchorFor(TODAY));
  const [year, month, day] = today.split('-').map(Number);
  TODAY.setFullYear(year, month - 1, day);
  if (first || followsToday) S.sel = TODAY;
  if (first || showsCurrentPeriod) S.anchor = anchorFor(TODAY);
  $('.status span').textContent = clock;
  return previousDay !== today;
}

function indexPlan() {
  days = new Map();
  S.done.clear();
  S.subs = {};
  TASKS.length = 0;
  NEAR.length = 0;
  TIX.length = 0;
  if (!state) return;

  const today = dateKey(TODAY);
  const projectIds = new Map(state.projects.map(project => [project.name, encodeURIComponent(project.id)]));
  for (const [kind, records] of [['task', state.tasks], ['event', state.events]]) {
    for (const record of records) {
      const offset = dateDistance(record.due);
      if (kind === 'task') TASKS.push({ id: encodeURIComponent(record.id), t: record.title, d: offset, done: record.done, p: projectIds.get(record.project) });
      if (offset === null) continue;
      const overdue = kind === 'task' && !record.done && offset < 0;
      const day = overdue ? today : record.due;
      const list = days.get(day) || [];
      const key = `${iso(fromIso(day))}-${list.length}`;
      list.push({ kind, record, overdue });
      days.set(day, list);
      if (kind === 'task') {
        if (record.done) S.done.add(key);
        if (record.checklist?.length) S.subs[key] = record.checklist.map(item => [item.text, item.done]);
      } else if (offset > 0 && offset <= 14) {
        NEAR.push({ d: offset, t: record.title, s: [validTime(record.time), record.description].filter(Boolean).join(' · '), k: 'ev', c: 'var(--a3)' });
      }
    }
  }
  NEAR.sort((a, b) => a.d - b.d);
  for (const ticket of state.saved.tickets) {
    const offset = dateDistance(ticket.eventDate);
    if (offset === null || offset < 0 || offset > 7) continue;
    TIX.push({ d: offset, t: ticket.title, tm: validTime(ticket.eventTime) || 'Весь день', pl: ticket.venue || ticket.carrier || '',
      seat: ticket.seat || '', ic: ticket.ticketType === 'train' ? 'train' : 'film', p: ['#f2a24b', '#7a2a12'], ticket });
  }
  TIX.sort((a, b) => a.d - b.d);
}

function schedulePlanClock() {
  clearTimeout(clockTimer);
  if (!state || document.hidden) return;
  clockTimer = setTimeout(tickPlanClock, 60_000 - (Date.now() % 60_000));
}

function tickPlanClock() {
  if (state && !document.hidden) {
    if (updateClock(state.timezone)) {
      clearTimeout(agendaTimer);
      indexPlan();
      adoptSaved(state, dateDistance, validTime, clock);
      repaintCurrent();
    } else if (curId() === 'plan') placeNow($('.screen[data-s="plan"]'), true);
  }
  schedulePlanClock();
}

function adopt(snapshot) {
  const previous = state;
  const wasCached = showingCachedPlan;
  showingCachedPlan = !!snapshot && runtime?.usingOfflineSnapshot === true;
  const selectedDate = dateKey(S.sel);
  clearTimeout(agendaTimer);
  state = snapshot;
  const newDay = state && updateClock(state.timezone, !previous);
  indexPlan();
  schedulePlanClock();
  if (!state) {
    pendingWriteKey = null;
    adoptSaved(null);
    adoptFinance(null);
    clearPlanTicket();
    if (previous && sheetA.classList.contains('on')) closeAdd();
    if (previous) root.dataset.glowPlan = 'error';
    for (const id of ['plan', 'tasks', 'finance', 'projects', 'project', 'metrics', 'archive', ...libraryScreens]) $('.screen[data-s="' + id + '"]')?.replaceChildren();
    return;
  }

  applyMoreLayout(state.settings);
  adoptSaved(state, dateDistance, validTime, clock);
  adoptFinance(state);
  if (!booting) root.dataset.glowPlan = 'ready';
  if (previous && !newDay && curId() === 'plan' && showingCachedPlan === wasCached) updateVisibleAgenda(previous, selectedDate);
  else if (!practiceVisual && !previous && curId() === 'practice') {
    paint('practice');
    setHead('practice', 0);
  } else repaintCurrent();
}

function repaintCurrent() {
  const id = curId();
  if (!['plan', 'tasks', 'more', 'finance', 'projects', 'project', 'metrics', 'archive', 'settings', 'setp', 'saved', 'savedCat'].includes(id)) return;
  const screen = document.querySelector(`.screen[data-s="${id}"]`);
  const scroll = screen.scrollTop;
  paint(id);
  screen.scrollTop = scroll;
  setHead(id, 0);
}

const savedPages = { notes: ['notes','note'], lists: ['lists','list'], shop: ['lists','list'],
  links: ['links','link'], recipes: ['recipes','recipe'], movies: ['movies','movie'],
  goods: ['products','product'], places: ['addresses','place'], tickets: ['tickets','ticket'], cards: ['cards','card'] };

function openLegacy(params = {}) {
  const destination = new URL('../../classic.html', import.meta.url);
  destination.search = location.search;
  destination.hash = location.hash;
  for (const [name, value] of Object.entries(params)) {
    if (value == null) destination.searchParams.delete(name);
    else destination.searchParams.set(name, value);
  }
  location.assign(destination.href);
}

let pendingAndroidShare = '';
let forwardingAndroidShare = false;
async function openAndroidShare() {
  if (forwardingAndroidShare) return;
  pendingAndroidShare ||= window.SorokaAndroid?.takeShared?.() || '';
  if (!pendingAndroidShare) return;
  forwardingAndroidShare = true;
  try {
    const { stageAndroidShare } = await import('./glow-android-share.mjs');
    const id = await stageAndroidShare(pendingAndroidShare);
    pendingAndroidShare = '';
    openLegacy({ page: null, rid: null, open: null, share: id });
  } catch {
    toast('Не удалось открыть вложение');
  } finally {
    forwardingAndroidShare = false;
  }
}

function openPlannerDay(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(date))) return false;
  const selected = fromIso(date);
  if (dateKey(selected) !== date) return false;
  S.sel = selected;
  S.anchor = S.cal === 'month' ? new Date(selected.getFullYear(), selected.getMonth(), 1) : monday(selected);
  if (curId() === 'plan') repaintCurrent();
  else go('plan');
  return true;
}

function openRef(ref) {
  if (!/^[a-z]+:[1-9]\d{0,18}$/.test(ref || '')) return false;
  const [kind, id] = ref.split(':');
  const ticket = kind === 'event' && SAVED.find(item => item.id === 'ticket:' + id);
  const saved = ticket || SAVED.find(item => item.id === ref);
  if (saved) {
    openSavedRecord(saved.id);
    return true;
  }
  const collection = kind === 'task' ? state.tasks : kind === 'event' ? state.events : [];
  const record = collection.find(item => item.id === ref);
  if (record) {
    if (kind === 'event' && record.due) openPlannerDay(record.due);
    else go('tasks');
    openEntryForm(kind, record, 'edit');
    return true;
  }
  if (kind === 'metric') { openMetric(ref); return true; }
  if (kind === 'project') {
    const project = state.projects.find(row => row.id === ref);
    if (project) { S.proj = encodeURIComponent(project.id); go('project'); }
    else { go('projects'); toast('Проект недоступен'); }
    return true;
  }
  if (kind === 'goal') {
    const goal = state.finance.goals.find(row => row.id === ref && row.target > 0);
    S.ft = 'goals';
    S.fgo = goal?.id || null;
    go('finance');
    if (goal) $('.screen[data-s="finance"] .fng.open')?.scrollIntoView({ block: 'center' });
    else toast('Цель недоступна');
    return true;
  }
  // Individual finance links still need the full record editor.
  const legacyPages = { debt:'debts', payment:'payments', budget:'budgets', tx:'money' };
  if (!Object.hasOwn(legacyPages, kind)) return false;
  openLegacy({ page: legacyPages[kind], rid: id, open: null });
  return true;
}

function openInitialRoute() {
  const params = new URLSearchParams(location.search);
  if (showingCachedPlan) {
    openPlannerDay(params.get('date'));
    return;
  }
  const page = params.get('page');
  const rid = params.get('rid');
  const start = params.get('tgWebAppStartParam') || window.Telegram?.WebApp?.initDataUnsafe?.start_param;
  if (params.get('assistant') === '1') {
    if (assistant) { assistant.open(); return; }
    return openLegacy();
  }
  if (openRef(params.get('open'))) return;
  if (!page && /^note_[1-9]\d{0,18}$/.test(start || '')) {
    if (openRef('note:' + start.slice(5))) return;
  }
  if (page === 'notes' && params.get('create') === '1') { openSavedNote(); return; }
  if (page === 'tasks' && openPlannerDay(params.get('date'))) return;
  const tab = params.get('tab');
  if (tab === 'vault' || tab === 'docs') { go(tab); return; }
  if (Object.hasOwn(savedPages, page)) {
    const [category, kind] = savedPages[page];
    if (rid && openRef(kind + ':' + rid)) return;
    S.cat = category; go('savedCat'); return;
  }
  if (page === 'events' && rid && openRef('event:' + rid)) return;
  if (page === 'tasks' && rid && openRef('task:' + rid)) return;
  const financePages = { payments: ['bills', 'payment'], money: ['ops', 'tx'], goals: ['goals', 'goal'], debts: ['debts', 'debt'] };
  if (Object.hasOwn(financePages, page)) {
    const [section, kind] = financePages[page];
    if (rid && openRef(kind + ':' + rid)) return;
    S.ft = section; go('finance'); return;
  }
  if (page === 'metrics') { openMetric(/^[1-9]\d{0,18}$/.test(rid || '') ? 'metric:' + rid : null); return; }
  if (page === 'projects' && rid && openRef('project:' + rid)) return;
  if (['upcoming','inbox','overview','events','budgets'].includes(page)) return openLegacy();
  if (['plan','saved','more','tasks','finance','render','projects','archive','settings','pc','server','vpn','docs','vault','sport','english','piano'].includes(page)) {
    go(page); return;
  }
  const savedStart = state?.settings.startPage;
  if (curId() === 'plan' && ['saved', 'finance', 'more'].includes(savedStart)) go(savedStart);
}

const selectedEntries = () => days.get(dateKey(S.sel)) || [];
const entryKey = ({ kind, record }) => `${kind}:${record.id}`;
const agendaEvent = ({ kind, record, overdue }) => [overdue ? '' : validTime(record.time), record.title,
  kind === 'task' ? record.project || record.description || '' : record.description || '', priorityColors[record.priority] || '--a3'];

function markAgendaRows(container, entries) {
  for (const row of $$('#agenda .ev', container)) {
    const entry = entries[Number(row.dataset.ev)];
    if (!entry) continue;
    row.dataset.planEntry = entryKey(entry);
    row.toggleAttribute('data-overdue', entry.overdue);
    if (entry.overdue) {
      const check = $('.chk', row);
      check.title = 'Просрочено';
      check.setAttribute('aria-label', `Выполнено: ${entry.record.title}. Просрочено.`);
    }
  }
}

function updateAgendaProgress(screen, entries) {
  const tasks = entries.filter(item => item.kind === 'task');
  const completed = tasks.filter(item => item.record.done).length;
  $('#agN', screen)?.setAttribute('aria-label', `Выполнено ${completed} из ${tasks.length}`);
  $('#agP', screen)?.style.setProperty('--p', tasks.length ? completed / tasks.length : 0);
}

const agendaPositions = agenda => new Map($$('[data-plan-entry]', agenda).map(row => [row, row.getBoundingClientRect().top]));

function animateAgendaShift(positions) {
  const shifts = [...positions].map(([row, top]) => [row, top - row.getBoundingClientRect().top]);
  for (const [row, dy] of shifts) {
    if (Math.abs(dy) > 1) row.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }],
      { duration: 560, easing: 'cubic-bezier(.19,1,.22,1)' });
  }
}

function moveAgendaRows(agenda, nextAgenda) {
  const rows = new Map($$('[data-plan-entry]', agenda).map(row => [row.dataset.planEntry, row]));
  const positions = agendaPositions(agenda);
  for (const nextRow of $$('.ev', nextAgenda)) {
    const row = rows.get(nextRow.dataset.planEntry);
    row.dataset.ev = nextRow.dataset.ev;
    row.classList.toggle('now', nextRow.classList.contains('now'));
    $('.ss', row).textContent = $('.ss', nextRow).textContent;
    agenda.append(row);
  }
  placeNow(agenda.parentElement);
  animateAgendaShift(positions);
}

function updateVisibleAgenda(previous, date) {
  const screen = $('.screen[data-s="plan"]');
  const body = $('#planBody', screen);
  if (!body || date !== dateKey(S.sel)) { repaintCurrent(); return; }

  const entries = selectedEntries();
  const byKey = new Map(entries.map(entry => [entryKey(entry), entry]));
  const oldTasks = new Map(previous.tasks.map(task => [String(task.id), task]));
  const confirmedTasks = new Map(state.tasks.map(record => [entryKey({ kind: 'task', record }), record]));
  let delay = 0;
  for (const row of $$('#agenda .ev', body)) {
    const task = confirmedTasks.get(row.dataset.planEntry);
    if (!task || !!task.done === row.classList.contains('done')) continue;
    const done = !!task.done;
    row.classList.toggle('done', done);
    row.classList.remove('open');
    row.setAttribute('aria-expanded', 'false');
    const button = $('.chk', row);
    button.classList.remove('ready');
    button.setAttribute('aria-label', `${done ? 'Вернуть' : 'Выполнено'}: ${task.title}`);
    if (done && !reduce) {
      row.classList.remove('now');
      const subtitle = $('.ss', row);
      subtitle.textContent = subtitle.textContent.replace(/^Сейчас · /, '');
      button.animate([{ boxShadow: '0 0 0 0 var(--c)' }, { boxShadow: '0 0 0 16px transparent' }],
        { duration: 650, easing: 'cubic-bezier(.19,1,.22,1)' });
      row.animate([{ background: 'color-mix(in srgb,var(--c) 22%,transparent)' }, { background: 'transparent' }],
        { duration: 900, easing: 'ease-out' });
    }
    if (!reduce) delay = Math.max(delay, done ? 380 : 60);
  }
  updateAgendaProgress(screen, entries);

  const render = () => {
    if (curId() !== 'plan' || $('#planBody', screen) !== body || dateKey(S.sel) !== date) return;
    const next = document.createElement('template');
    next.innerHTML = planBody();
    markAgendaRows(next.content, entries);
    placeNow(next.content);
    const expanded = $('#agenda .ev.open', body)?.dataset.planEntry;
    if (expanded) {
      const row = $$('#agenda .ev', next.content).find(item => item.dataset.planEntry === expanded);
      row?.classList.add('open');
      row?.setAttribute('aria-expanded', 'true');
    }

    const agenda = $('#agenda', body), nextAgenda = $('#agenda', next.content);
    if (agenda && nextAgenda) {
      const oldEvents = new Map(previous.events.map(event => [String(event.id), event]));
      const visibleRows = $$('.ev', agenda);
      const canMoveRows = delay && visibleRows.length === entries.length && visibleRows.every(row => {
        const entry = byKey.get(row.dataset.planEntry);
        if (!entry) return false;
        const { kind, record } = entry;
        const old = (kind === 'task' ? oldTasks : oldEvents).get(String(record.id));
        const display = agendaEvent(entry);
        return old?.due === date && agendaEvent({ kind, record: old }).every((value, i) => value === display[i])
          && JSON.stringify(old.checklist || []) === JSON.stringify(record.checklist || []);
      });
      if (canMoveRows) moveAgendaRows(agenda, nextAgenda);
      else if (reduce) agenda.innerHTML = nextAgenda.innerHTML;
      else flipSwap(agenda, nextAgenda.innerHTML, 'data-plan-entry');
    } else {
      $('.agc', body).replaceWith($('.agc', next.content));
    }
    for (const selector of ['.near', '.tix']) {
      const current = $(selector, body), nextPart = $(selector, next.content);
      if (current?.innerHTML === nextPart?.innerHTML) continue;
      if (current && nextPart) current.replaceWith(nextPart);
      else if (current) current.remove();
      else if (nextPart) {
        const ticketStrip = selector === '.near' && $('.tix', body);
        if (ticketStrip) ticketStrip.before(nextPart);
        else body.append(nextPart);
      }
    }
    for (const day of $$('#days .day', screen)) {
      const dot = $('.dot', day);
      if (days.has(dateKey(fromIso(day.dataset.iso)))) {
        if (!dot) day.insertAdjacentHTML('beforeend', '<i class="dot"></i>');
      } else dot?.remove();
    }
    bindBody(screen);
    if (!reduce) {
      for (const row of $$('#agenda .ev.open', body)) {
        const task = byKey.get(row.dataset.planEntry)?.record;
        const oldChecklist = oldTasks.get(String(task?.id))?.checklist || [];
        const checklist = task?.checklist || [];
        for (const item of $$('.st-i', row)) {
          const index = Number(item.dataset.si), before = oldChecklist[index], after = checklist[index];
          if (!before && after) item.animate([{ opacity: 0, transform: 'translateY(-6px)', filter: 'blur(4px)' },
            { opacity: 1, transform: 'none', filter: 'none' }], { duration: 420, easing: 'cubic-bezier(.19,1,.22,1)' });
          else if (after?.done && !before?.done) $('.sbox', item).animate([{ boxShadow: '0 0 0 0 var(--c)' },
            { boxShadow: '0 0 0 10px transparent' }], { duration: 500, easing: 'cubic-bezier(.19,1,.22,1)' });
        }
      }
    }
  };
  if (delay) agendaTimer = setTimeout(render, delay);
  else render();
}

async function write(change, key = null) {
  if (!runtime || !state) return false;
  if (showingCachedPlan) { toast('Для сохранения нужна связь'); return false; }
  if (busy) { toast('Сохранение ещё идёт'); return false; }
  const retryOnly = key === 'recover-pending' || key === 'recover' && runtime.hasPendingFinance;
  const matched = key !== null && key === pendingWriteKey;
  if (runtime.hasPending && !matched && !retryOnly && (key || pendingWriteKey || runtime.hasPendingFinance)) {
    toast('Сначала повтори сохранение незавершённой операции');
    return false;
  }
  if (retryOnly && !runtime.hasPending) return false;
  busy = true;
  try {
    const retrySame = retryOnly || matched && runtime.hasPendingFinance;
    const ok = await (runtime.hasPending ? runtime.retry(retrySame ? undefined : change) : runtime.commit(change));
    pendingWriteKey = runtime.hasPending ? retryOnly ? pendingWriteKey : key : null;
    if (!ok) toast(runtime.hasPending ? 'Связь прервалась. Повтори сохранение' : 'Сервер не подтвердил сохранение');
    return ok;
  } catch {
    toast('Не удалось сохранить');
    return false;
  } finally {
    busy = false;
  }
}

function updateTask(id, edit) {
  return updateEntry('task', id, edit);
}

function updateEntry(kind, id, edit) {
  return write(next => {
    const entry = (kind === 'event' ? next.events : next.tasks).find(item => String(item.id) === String(id));
    if (entry) edit(entry);
  });
}

function bindEntryActions(row, kind, record) {
  const move = $('[data-act="move"]', row);
  move.onclick = event => { event.stopPropagation(); openEntryForm(kind, record, 'move'); };
  const action = $('[data-act="remind"]', row);
  if (kind === 'task') {
    action.textContent = 'Изменить';
    action.onclick = event => { event.stopPropagation(); openEntryForm(kind, record, 'edit'); };
    return;
  }
  const active = record.remindBefore === '15m';
  action.textContent = active ? 'Убрать напоминание' : 'За 15 мин';
  action.setAttribute('aria-pressed', String(active));
  action.onclick = async event => {
    event.stopPropagation();
    if (!active && !validTime(record.time)) { toast('Укажи время события'); return; }
    if (await updateEntry(kind, record.id, current => { current.remindBefore = active ? 'none' : '15m'; })) {
      toast(active ? 'Напоминание отключено' : 'Напоминание за 15 минут сохранено');
    }
  };
}

evs = date => (days.get(dateKey(date)) || []).map(agendaEvent);
nearHTML = () => {
  const html = demoNearHTML();
  return html.replace('<div class="glass near"></div>', '').replace('<div class="tix"></div>', '');
};
// The live marker owns the highlight as well as its position so the two stay in sync on a clock tick.
nowIndex = () => -1;
placeNow = (screen, animate = false) => {
  const agenda = $('#agenda', screen);
  if (!agenda) return;
  const current = $('.nowl', agenda);
  const rows = $$('.ev', agenda);
  if (!same(S.sel, TODAY) || !rows.length) { current?.remove(); return; }
  const timed = rows.filter(row => !row.classList.contains('done') && validTime(row.dataset.t));
  const after = timed.filter(row => row.dataset.t <= clock).at(-1);
  const before = timed.find(row => row.dataset.t > clock);
  const lower = after ? minutesOfDay(after.dataset.t) : 0;
  const upper = before ? minutesOfDay(before.dataset.t) : 1440;
  const progress = Math.max(0, Math.min(1, (minutesOfDay(clock) - lower) / (upper - lower)));
  const line = current || document.createElement('div');
  if (!current) {
    line.className = 'nowl';
    line.dataset.planEntry = 'now';
    line.innerHTML = '<div class="nowl-marker"><i></i><span></span><b></b></div>';
  }
  const label = $('span', line);
  if (label.textContent !== clock) label.textContent = clock;
  line.style.setProperty('--now-progress', String(progress));

  const placed = after ? after.nextElementSibling === line : line.nextElementSibling === rows[0];
  if (!placed) {
    const positions = animate && current && !reduce && !matchMedia('(prefers-reduced-motion: reduce)').matches
      ? agendaPositions(agenda) : null;
    agenda.insertBefore(line, after ? after.nextElementSibling : rows[0]);
    if (positions) animateAgendaShift(positions);
  }
  const previous = $('.ev.now', agenda);
  if (previous !== after) {
    if (previous) {
      previous.classList.remove('now');
      const subtitle = $('.ss', previous);
      subtitle.textContent = subtitle.textContent.replace(/^Сейчас · /, '');
    }
    if (after) {
      after.classList.add('now');
      const subtitle = $('.ss', after);
      subtitle.textContent = 'Сейчас · ' + subtitle.textContent;
    }
  }
};

bindBody = screen => {
  demoBindBody(screen);
  for (const button of $$('[data-tk]', screen)) {
    button.onclick = event => {
      const row = TIX[button.dataset.tk];
      if (!row?.ticket) return;
      event.stopPropagation();
      showPlanTicket(row, button);
    };
  }
  const entries = selectedEntries();
  markAgendaRows(screen, entries);
  updateAgendaProgress(screen, entries);
  for (const row of $$('#agenda .ev', screen)) {
    const item = entries[Number(row.dataset.ev)];
    if (!item) continue;
    const { kind, record } = item;
    const check = $('.chk', row);
    const input = $('.st-in', row);
    const list = $('.subs', row);
    check.disabled = kind === 'event';
    input.disabled = kind === 'event';
    check.classList.toggle('ready', kind === 'task' && !item.overdue && !record.done && !!record.checklist?.length && record.checklist.every(item => item.done));
    check.onclick = event => {
      event.stopPropagation();
      const current = state?.tasks.find(task => task.id === record.id);
      if (kind === 'task' && current) void updateTask(record.id, task => { task.done = !current.done; });
    };
    list.onclick = event => {
      const button = event.target.closest('.sbox');
      if (kind !== 'task' || !button) return;
      event.stopPropagation();
      const index = Number(button.closest('[data-si]').dataset.si);
      const previous = record.checklist?.[index];
      if (!previous) return;
      void updateTask(record.id, task => {
        const item = task.checklist?.[index];
        if (item?.text === previous.text) item.done = !previous.done;
      });
    };
    input.onkeydown = event => {
      if (event.key !== 'Enter' || kind !== 'task') return;
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      void updateTask(record.id, task => { (task.checklist ||= []).push({ text, done: false }); });
    };
    bindEntryActions(row, kind, record);
  }
};

bindTaskList = (screen, box, rebuild) => {
  if (box.id !== 'tgs') return demoBindTaskList(screen, box, rebuild);
  for (const label of $$('[data-task] .tb', box)) {
    label.setAttribute('role', 'button');
    label.tabIndex = 0;
    label.onkeydown = event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      label.click();
    };
  }
  box.onclick = event => {
    const button = event.target.closest('[data-tchk], .tb');
    if (!button) return;
    const id = decodeURIComponent(button.closest('[data-task]').dataset.task);
    const record = state?.tasks.find(task => String(task.id) === id);
    if (!record) return;
    if (button.matches('[data-tchk]')) void updateTask(id, task => { task.done = !record.done; });
    else openEntryForm('task', record, 'edit');
  };
};

function resetForm() {
  formId = null;
  entryForm = null;
  projectForAdd = '';
  aTitle.readOnly = false;
  aSub.disabled = false;
  $('#aColor').inert = false;
  aSave.textContent = 'Добавить';
}

openAdd = () => {
  if (!state) { toast('Открой Flow в приложении или Telegram'); return; }
  if (showingCachedPlan) { toast('Для сохранения нужна связь'); return; }
  resetForm();
  demoOpenAdd();
};

function openEntryForm(kind, record, mode) {
  if (busy || !state) return;
  if (showingCachedPlan) { toast('Для изменения нужна связь'); return; }
  resetForm();
  entryForm = { kind, record, mode };
  aTitle.value = record.title;
  aTitle.readOnly = mode === 'move';
  aSub.value = '';
  aSub.disabled = true;
  $('#aColor').inert = mode === 'move';
  aSave.textContent = mode === 'move' ? 'Перенести' : 'Сохранить';
  aSave.disabled = false;
  A.date = record.due ? fromIso(record.due) : null;
  A.time = validTime(record.time) || '—';
  A.color = priorityColors[record.priority] || '--a3';
  A.subs = [];
  const date = A.date || TODAY;
  A.pm = new Date(date.getFullYear(), date.getMonth(), 1);
  A.pick = mode === 'move' ? 'date' : null;
  aChips();
  renderPick();
  sheetA.style.transform = '';
  sheetA.classList.add('on');
  sheetA.setAttribute('aria-hidden', 'false');
  ascrim.classList.add('on');
}

aSave.onclick = async () => {
  const title = aTitle.value.trim();
  if (!title || busy || !state) return;
  const form = entryForm;
  const id = formId ??= form?.record.id || crypto.randomUUID();
  const due = A.date ? dateKey(A.date) : '';
  const time = due ? validTime(A.time) : '';
  if (form?.kind === 'event' && !due) { toast('У события должна быть дата'); return; }
  aSave.disabled = true;
  if (form) {
    const ok = await updateEntry(form.kind, id, current => {
      current.due = due;
      current.time = time;
      if (form.mode === 'edit') {
        current.title = title;
        current.priority = colorPriorities[A.color] || 'medium';
      }
    });
    if (formId === id) {
      aSave.disabled = false;
      if (ok) { closeAdd(); toast(form.mode === 'move' ? 'Срок изменён' : 'Дело сохранено'); }
    }
    return;
  }
  const draft = { id, title, due, time, repeat: 'none',
    priority: colorPriorities[A.color] || 'medium', project: projectForAdd, description: '', done: false,
    checklist: A.subs.map(text => ({ text, done: false })) };
  try {
    const ok = await write(next => {
      const existing = next.tasks.find(task => task.id === id);
      if (existing) Object.assign(existing, draft);
      else next.tasks.push(draft);
    });
    if (ok && formId === id) { closeAdd(); toast('Дело добавлено'); }
  } finally {
    if (formId === id) aSave.disabled = !aTitle.value.trim();
  }
};

try {
  if (!window.Telegram?.WebApp && !window.SorokaAndroid) {
    await new Promise((resolve, reject) => {
      const sdk = document.createElement('script');
      sdk.src = new URL('./telegram-web-app.js', import.meta.url).href;
      sdk.onload = resolve;
      sdk.onerror = reject;
      document.head.append(sdk);
    });
  }
  runtime = await openPlannerRuntime({ onState: adopt, snapshotCache: createPlannerOfflineCache(localStorage),
    isOffline: () => navigator.onLine === false || root.hasAttribute('data-flow-offline-shell') });
  const originalPlan = R.plan;
  R.plan = () => (showingCachedPlan ? '<div class="sylab" role="status" data-plan-offline>Без сети · План для просмотра</div>' : '') + originalPlan();
  const navigate = go;
  let modules;
  let practiceReady = false;
  let navigationSequence = 0;
  go = id => {
    const request = ++navigationSequence;
    if (showingCachedPlan && id !== 'plan' && id !== 'tasks') { toast('Раздел доступен при подключении'); return; }
    if (booting === false && root.dataset.glowRelease === 'true' && practiceRoutes.has(id) && !practiceReady) {
      return loadOnlineModules().then(() => {
        if (request !== navigationSequence || showingCachedPlan) return;
        if (practiceReady) navigate(id);
        else toast('Не удалось открыть Занятия');
      });
    }
    return navigate(id);
  };
  connectNoteWrites(write, id => runtime.resolveId(id));
  connectLibrary(write, id => runtime.resolveId(id));
  connectFinance(write, (ids, apply) => runtime.incomeSplit(ids, apply), id => runtime.resolveId(id), () => runtime.hasPendingFinance);
  openMetric = connectMetrics(() => state, write, () => dateKey(TODAY));
  connectMoreRecords({ snapshot: () => state, write, resolve: id => runtime.resolveId(id),
    editEntry: (kind, record) => openEntryForm(kind, record, 'edit'),
    addProjectTask: name => { if (name) { openAdd(); projectForAdd = name; } } });
  const secure = connectMoreSecure();
  const pc = connectMorePc();
  const connections = connectMoreConnections();
  connectMoreSettings({ snapshot: () => state, write, refresh: () => runtime.load(),
    hasPending: () => runtime.hasPending, retryPending: () => write(null, 'recover-pending'), secure, pc });
  const originalMore = R.more;
  R.more = () => {
    const template = document.createElement('template');
    template.innerHTML = originalMore();
    const projects = template.content.querySelector('[data-go="projects"]');
    projects?.insertAdjacentHTML('afterend', goRows([['metrics', 'list', 'Показатели', 'Личные измерения']]));
    const subtitles = {
      projects: state ? state.projects.filter(project => project.status === 'Активен').length + ' активных' : 'Проекты Flow',
      docs: 'Под замком',
      vault: 'Под замком',
      archive: state ? 'В корзине: ' + state.trash.length : 'История записей',
      pc: pc.status(),
      server: connections.status('server'),
      vpn: connections.status('vpn'),
    };
    for (const [id, title] of Object.entries(subtitles)) {
      const label = $(`[data-go="${id}"] small`, template.content);
      if (label) label.textContent = title;
    }
    return template.innerHTML;
  };
  async function connectAssistant() {
    const { connectGlowAssistant } = await import('./glow-assistant.mjs');
    assistant = connectGlowAssistant({
      navigationReady: () => !booting, openNote: openSavedNote, openRecord: openRef, openDocument: secure.openDocument, openLegacy,
      upcoming: () => (state?.events || []).filter(record => {
        const offset = dateDistance(record.due);
        const time = validTime(record.time);
        return !record.done && offset !== null && (offset > 0 || offset === 0 && (!time || time >= clock));
      }).sort((a, b) => a.due.localeCompare(b.due) || validTime(a.time).localeCompare(validTime(b.time)))
        .slice(0, 2).map(record => ({ id: record.id, title: record.title, time: validTime(record.time) || '—',
          date: dateDistance(record.due) === 0 ? 'Сегодня' : dateDistance(record.due) === 1 ? 'Завтра' : record.due.slice(8) + '.' + record.due.slice(5, 7) })),
    });
  }
  const release = root.dataset.glowRelease === 'true';
  const assistantReady = release ? connectAssistant().catch(error => {
    console.warn('Ассистент Glow не загрузился', error);
  }) : undefined;

  async function connectOnlineModules() {
    if (!practiceVisual) {
      const { connectGlowPractice } = await import('./glow-practice.mjs');
      connectGlowPractice();
    } else if (root.dataset.glowSport === 'connected') {
      if (root.dataset.glowRelease !== 'true') {
        const { connectPrototypeSport } = await import('./glow-prototype-sport.mjs');
        connectPrototypeSport();
      } else {
        const [{ connectPrototypeSport }, { connectGlowPractice }] = await Promise.all([
          import('./glow-prototype-sport.mjs'), import('./glow-practice.mjs'),
        ]);
        connectPrototypeSport();
        connectGlowPractice({ prototypeSport: true });
      }
    }
    practiceReady = true;
  }
  const loadOnlineModules = () => modules ??= connectOnlineModules().catch(() => { modules = null; });
  await runtime.load();
  document.addEventListener('visibilitychange', tickPlanClock);
  window.addEventListener('flow:resume', tickPlanClock);
  const params = new URLSearchParams(location.search);
  if (!showingCachedPlan) {
    connectRender();
    if (!release || practiceRoutes.has(params.get('page'))) {
      await loadOnlineModules();
      if (release && !practiceReady) throw Error('glow_practice_unavailable');
    }
  }
  window.addEventListener('online', () => {
    if (!showingCachedPlan) return;
    void runtime.load().then(() => {
      if (showingCachedPlan) return;
      connectRender();
      return loadOnlineModules();
    }).catch(() => {});
  });
  if (release) {
    window.sorokaOpenRef = openRef;
    window.sorokaOpenNote = id => openRef(id);
    window.sorokaCreateNote = () => { openSavedNote(); return true; };
    window.sorokaOpenPC = () => { go('pc'); return true; };
    window.sorokaOpenPlannerDay = openPlannerDay;
    window.addEventListener('soroka-shared', openAndroidShare);
    void openAndroidShare();
  }
  if (params.get('assistant') === '1') await assistantReady;
  openInitialRoute();
  booting = false;
  root.dataset.glowPlan = 'ready';
  void assistantReady?.then(() => assistant?.ready());
  if (!showingCachedPlan) void loadOnlineModules();
} catch (error) {
  root.dataset.glowPlan = 'error';
  if (window.SorokaAndroid?.assistantPopup?.() !== true) {
    toast(error?.message === 'planner_authorization_required' ? 'Открой Flow в приложении или Telegram' : 'Не удалось загрузить План');
  }
}
