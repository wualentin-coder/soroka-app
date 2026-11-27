import { connectGlowSport } from './glow-practice-sport.mjs';
import { prototypeExercise, prototypeWorkout } from './glow-prototype-sport-run.mjs';
import { label } from './glow-practice-ui.mjs';
import { createPracticeVoice } from './glow-practice-voice.mjs';
import './practice/sport-tips.js';
import './practice/sport-catalog-core.js';
import './practice/sport-extra-core.js';

const dateFormat = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayFormat = new Intl.DateTimeFormat('ru', { weekday: 'short', timeZone: 'UTC' });
const dayTime = date => new Date(`${date}T12:00:00Z`);
const equipmentKeys = { db: 'dumbbells', kb: 'kettlebell', bar: 'barbell', pull: 'pullup', bench: 'bench', mat: 'mat' };
const muscleKeys = { Грудь: ['chest'], Спина: ['lats', 'mid_back', 'lower_back'], Плечи: ['delts_front', 'delts_side', 'delts_rear'],
  Руки: ['biceps', 'triceps', 'forearms'], Пресс: ['abs'], Ягодицы: ['glutes'], Ноги: ['quads', 'hamstrings', 'calves'] };
const targetUnits = { kg: 'кг', reps: 'повт.', seconds: 'с' };
let catalogRequest;
function exerciseCatalog() {
  const read = filename => fetch(new URL('./practice/' + filename, import.meta.url)).then(reply => {
    if (!reply.ok) throw Error('Каталог упражнений недоступен');
    return reply.json();
  });
  catalogRequest ||= Promise.all([read('sport-catalog.json'), read('sport-substitutions.json')]).then(([seed, matrix]) => ({
    catalog: window.SportCatalogCore.normalize(seed), matrix,
  })).catch(error => { catalogRequest = null; throw error; });
  return catalogRequest;
}
const disabled = (root, selector) => root.querySelectorAll(selector).forEach(button => { button.disabled = true; });
const template = html => { const node = document.createElement('template'); node.innerHTML = html; return node; };
const setText = (root, selector, value) => { const node = root.querySelector(selector); if (node) node.textContent = value; };
const remove = (root, selector) => root.querySelectorAll(selector).forEach(node => node.remove());
const report = task => void Promise.resolve().then(task).catch(error => toast(error.message));

export function connectPrototypeSport() {
  const runner = prototypeWorkout({ request: (op, params) => api.modern.request(op, params),
    refresh: () => api.modern.load() });
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./glow-prototype-sport.css', import.meta.url).href;
  document.head.append(style);
  const selected = () => curId() === 'practice' && S.prac === 'sport';
  const sport = connectGlowSport({ active: () => true, selected, presentation: runner,
    redraw() { if (selected()) spPaint(); } });
  const api = sport.prototype;
  const original = { today: spToday, program: spProg, history: spHist, ai: spAiSheet,
    settings: R.spset, preferences: R.spsetp, sport: bindSport, exercise: spExSheet };
  const readiness = new Map();
  const substitutions = new Map();
  const dismissedTips = new Set(), dismissedShifts = new Set();
  let selectedDate, weekDays, history = [], generationId, openedSheet = 0, measurementId;
  let selectedWorkoutKey;
  let schedule, scheduleKey, tipSourcesOpen = false;
  let inventorySettings, inventoryLoading, inventoryEpoch, inventoryError, inventorySaving = false;

  function calendar() {
    const today = api.today();
    selectedDate ||= today;
    const core = api.core();
    const first = core.offsetDateKey(today, -((dayTime(today).getUTCDay() + 6) % 7));
    const workouts = api.workouts();
    weekDays = SPW.map((day, index) => core.offsetDateKey(first, index));
    for (const [index, key] of weekDays.entries()) {
      const day = dayTime(key);
      const rows = workouts.filter(row => row.date === key);
      const workout = rows[0];
      SPW[index] = { d: dayFormat.format(day), n: day.getUTCDate(), t: workout ? label(workout.title) : null,
        st: workout?.finished ? 'done' : key === today && workout ? 'today' : workout ? 'plan' : 'rest' };
    }
    SPD.sel = Math.max(0, weekDays.indexOf(selectedDate));
    return workouts.filter(row => row.date === selectedDate);
  }
  function activeKey() { return api.modern.activeWorkout()?.workout_key; }
  function shiftToday() {
    const shift = schedule?.last_shift;
    if (!shift || schedule.plan_version !== api.modern.activePlan()?.current_version) return null;
    const date = new Date(shift.created_at);
    return Number.isFinite(+date) && api.core().todayKey(date) === api.today() && Number(shift.days) > 0 ? shift : null;
  }
  function refreshSchedule() {
    const plan = api.modern.activePlan();
    if (!plan?.id || !api.today()) return;
    const key = JSON.stringify([plan.id, plan.current_version, api.today()]);
    if (key === scheduleKey) return;
    scheduleKey = key; schedule = null;
    void api.modern.request('schedule_status', { plan_id: plan.id }).then(value => {
      if (scheduleKey !== key) return;
      schedule = value;
      if (selected() && SPD.tab === 'today') spPaint();
    }).catch(() => {});
  }
  function coachTip(shift) {
    const workout = api.workouts().filter(row => row.date === api.today()).map(row => ({ ...row, kind: row.raw?.kind, workout: row.raw }));
    const tip = window.SportTips.pickToday(api.state(), workout, api.today(), shift && { shifted: true, missed: shift.missed });
    if (!tip || dismissedTips.has(tip.id)) return '';
    const view = template(spTipHTML({ tp: tip.topic, t: label(tip.title), x: label(tip.text), src: tip.cites.map(source => label(source.cite)) }, tip.id, tipSourcesOpen));
    view.content.querySelectorAll('.sptsl .chip').forEach((node, index) => {
      const url = tip.cites[index].url;
      if (!/^https:\/\//i.test(url)) return;
      const link = document.createElement('a');
      link.className = node.className; link.textContent = node.textContent;
      link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      node.replaceWith(link);
    });
    const more = view.content.querySelector('[data-sptsrc]');
    more.setAttribute('aria-expanded', String(tipSourcesOpen));
    return view.innerHTML;
  }
  function availability() {
    return `<div class="glass empty in" role="status">${label(api.problem() || 'Загружаем тренировки…')}
      ${api.problem() ? '<button class="btn glass" data-sport-retry>Повторить</button>' : ''}</div>`;
  }
  function renderToday() {
    if (!api.view() || !api.today()) return availability();
    const workouts = calendar();
    const first = workouts.find(row => row.key === selectedWorkoutKey) || workouts.find(row => row.key === activeKey())
      || workouts.find(row => row.raw?.kind === 'main') || workouts[0];
    selectedWorkoutKey = first?.key;
    const selectedIndex = SPD.sel;
    const day = SPW[selectedIndex];
    const input = readiness.get(selectedDate);
    Object.assign(SPD, { ready: input?.ready || 0, pain: input?.pain || 'none', zone: input?.zone || null, auto: false, fix: false, warm: false });
    const exerciseList = (first?.exercises || []).map(prototypeExercise);
    const previousDay = spDay;
    const oldOn = SPR.on, previousPhase = SPR.phase;
    const current = activeKey();
    SPD.banHide = true;
    SPD.tips = false;
    SPD.tipX = first && !first.finished && !first.readOnly ? 'today' : 'rest';
    SPD.cam = api.state()?.coachSettings?.cameraCoach !== false;
    SPR.on = current && current === first?.key ? 1 : 0;
    SPR.phase = 'intro';
    // Render the same training-day card when looking back at an unstarted day.
    if (first && !first.readOnly && !first.finished) SPW[selectedIndex] = { ...day, t: label(first.title), st: 'today' };
    spDay = () => exerciseList;
    let view;
    try { view = template(original.today()); }
    finally { spDay = previousDay; SPR.on = oldOn; SPR.phase = previousPhase; SPW[selectedIndex] = day; }
    const root = view.content;
    // The sample tips, posture block and streak were storyboard data.
    remove(root, '.spmot,.sptip,.sprec,.spwarm,.spwarmr');
    const post = root.querySelector('.sppost');
    post?.previousElementSibling?.remove();
    post?.remove();
    const title = root.querySelector('.sphero .ezh1 .ezt small');
    if (title) title.textContent = dateFormat.format(dayTime(selectedDate)) + (first?.finished ? ' · сделано' : '');
    const meta = root.querySelector('.sphero .ezh1 .ezt > em');
    if (meta && first) meta.textContent = `${exerciseList.length} упр. · ${spSets(exerciseList)} подходов`;
    const finished = root.querySelector('.sphero .spok');
    if (first?.finished && finished) {
      finished.classList.add('glass', 'prototype-sport-complete');
      finished.querySelector('span').textContent = `Готово · ${first.counts.reduce((sum, count) => sum + count, 0)} из ${spSets(exerciseList)} подходов`;
    }
    disabled(root, '[data-spnow],[data-spfix]');
    const changed = substitutions.get(first?.key);
    if (changed && changed.version === api.modern.activePlan()?.current_version && !first.finished && current !== first.key) {
      const replaced = root.querySelector(`[data-spswap="${changed.index}"]`);
      if (replaced) {
        replaced.removeAttribute('data-spswap'); replaced.dataset.sportUndoSwap = '';
        replaced.innerHTML = spI.undo; replaced.ariaLabel = 'Вернуть упражнение';
      }
    }
    if (current && current !== first?.key) {
      root.querySelector('.spweek').insertAdjacentHTML('afterend', `<button class="btn main sygo" data-sport-resume>${spI.play}Продолжить тренировку</button>`);
      disabled(root, '[data-sprun]');
    }
    if (api.problem()) root.querySelector('.spweek').insertAdjacentHTML('afterend', availability());
    if (first && !api.core().isSport2Enabled(api.state())) {
      disabled(root, '[data-sprun]');
      root.querySelector('.sphero').insertAdjacentHTML('beforeend', '<p class="spnote">Запуск на этом экране доступен в Спорте 2.0</p>');
    }
    if (selectedDate === api.today()) {
      const shift = shiftToday();
      const notice = shift && !dismissedShifts.has(shift.version) ? `<div class="glass spban moved"><span class="ic">${spI.prog}</span><span class="ezt"><b>Пропуск перенесён</b><em>Расписание сдвинуто на ${Number(shift.days)} ${fnPl(Number(shift.days), 'день', 'дня', 'дней')}</em></span><button class="spx" data-sport-shift-close aria-label="Скрыть">${spI.x}</button></div>` : '';
      const hero = root.querySelector('.sphero');
      if (hero) hero.insertAdjacentHTML('beforebegin', notice + coachTip(shift));
    }
    return view.innerHTML;
  }
  function renderProgram() {
    if (!api.view() || !api.today()) return availability();
    calendar();
    const plan = api.modern.activePlan();
    const workouts = api.workouts();
    const weeks = new Map();
    const start = workouts.map(row => row.date).sort()[0];
    const first = start && dayTime(start).getTime();
    const currentWeek = start ? Math.max(0, Math.floor((dayTime(api.today()).getTime() - first) / 604800000)) : 0;
    for (const row of workouts) {
      const week = Math.max(0, Math.floor((dayTime(row.date).getTime() - first) / 604800000));
      const days = weeks.get(week) || [];
      days.push(row.finished ? 1 : row.date === api.today() ? 't' : 0);
      weeks.set(week, days);
    }
    SPWEEKS.splice(0, SPWEEKS.length, ...Array.from({ length: weeks.size ? Math.max(...weeks.keys()) + 1 : 0 }, (_, index) => weeks.get(index) || []));
    SPV.splice(0, SPV.length, ...(plan ? [{ t: label(plan.title), s: `Версия ${Number(plan.current_version) || 1}`, d: dateFormat.format(dayTime(start || api.today())) }] : []));
    const view = template(original.program());
    const root = view.content;
    const done = workouts.filter(row => row.finished).length;
    const heading = root.querySelector('.ezh1');
    heading.firstElementChild.outerHTML = ezRing(workouts.length ? done / workouts.length : 0, null, `<b>${done}</b><small>из ${workouts.length}</small>`);
    setText(root, '.ezh1 .ezt small', start ? `Неделя ${Math.min(currentWeek + 1, SPWEEKS.length)} из ${SPWEEKS.length} · с ${dateFormat.format(dayTime(start))}` : 'Программа');
    setText(root, '.ezh1 .ezt b', plan?.title || 'Активной программы нет');
    setText(root, '.ezh1 .ezt em', workouts.length ? `Тренировок в плане: ${workouts.length}` : 'Можно составить новую программу');
    root.querySelectorAll('.spwks > span').forEach((node, index) => {
      node.className = index === currentWeek ? 'cur' : '';
      node.removeAttribute('title'); node.firstElementChild.textContent = index + 1;
    });
    remove(root, '.spdl');
    const list = root.querySelector('.sylab + .list');
    if (list) list.innerHTML = workouts.filter(row => weekDays.includes(row.date)).map(row => {
      const day = SPW[weekDays.indexOf(row.date)];
      return `<button class="rw" data-sport-workout="${label(row.key)}"><span class="ic"><b>${day.n}</b></span><span><b>${label(row.title)}</b><small>${day.d} · ${row.finished ? 'сделано' : row.date === api.today() ? 'сегодня' : 'по плану'}</small></span>${row.finished ? `<span class="spdone">${ic.check}</span>` : ic.chev.replace('<svg','<svg class="chev"')}</button>`;
    }).join('');
    disabled(root, '[data-spgo="sparch"]');
    return view.innerHTML;
  }
  function renderHistory() {
    if (!api.view() || !api.today()) return availability();
    history = api.modern.sessions().filter(row => !row.status || row.status === 'completed');
    SPH.splice(0, SPH.length, ...history.map(row => {
      const date = dayTime(row.workout_date);
      return { d: Number.isFinite(+date) ? dateFormat.format(date) : '—', w: Number.isFinite(+date) ? dayFormat.format(date) : '—',
        t: label(row.title || 'Тренировка'), min: Math.floor((row.elapsed_seconds || 0) / 60), b: [] };
    }));
    const view = template(original.history());
    const root = view.content;
    setText(root, '.ezrow .ezstat:first-child b', history.length);
    const lastMonth = api.core().offsetDateKey(api.today(), -30);
    const seconds = history.filter(row => row.workout_date >= lastMonth).reduce((sum, row) => sum + (row.elapsed_seconds || 0), 0);
    setText(root, '.ezrow .ezstat:nth-child(2) b', `${Math.floor(seconds / 3600)}ч ${Math.floor(seconds / 60) % 60}м`);
    setText(root, '.ezrow .ezstat:nth-child(3) b', '—');
    setText(root, '.sph .ezt b', '—'); setText(root, '.sph .ezt em', '');
    disabled(root, '.sph button');
    root.querySelectorAll('.sphr').forEach((row, index) => {
      const data = history[index];
      setText(row, 'small', [SPH[index].w, data.elapsed_seconds ? `${SPH[index].min} мин` : '', 'Подходы'].filter(Boolean).join(' · '));
    });
    if (!history.length) root.lastElementChild.innerHTML = '<div class="empty">Тренировок в истории пока нет</div>';
    return view.innerHTML;
  }
  async function readHistory(row, button) {
    if (!row) return;
    const list = button.querySelector('.rdx > span');
    if (button.classList.toggle('open') === false) return;
    list.textContent = 'Загружаем подходы…';
    const data = await api.modern.request('read_session', { session_id: row.id });
    if (!button.isConnected) return;
    const values = data.projection?.sets || [];
    list.innerHTML = (data.session?.plan_snapshot?.workout?.blocks || []).flatMap(block => block.exercises).map(exercise => {
      const sets = values.filter(set => set.plan_exercise_id === exercise.plan_exercise_id && set.status === 'confirmed');
      const suffix = sets.map(set => [set.actual_kg == null ? '' : `${Number(set.actual_kg)} кг`, set.actual_reps ?? (set.actual_seconds == null ? '—' : `${Number(set.actual_seconds)} с`)].filter(Boolean).join(' × ')).join(' · ');
      return `<span class="spbs"><span>${label(exercise.name)}</span><b>${label(suffix || `${sets.length} из ${exercise.sets}`)}</b></span>`;
    }).join('');
  }
  async function swapExercise(workout, index) {
    const exercise = workout?.exercises[index];
    if (!exercise) return;
    if (workout.finished || activeKey() === workout.key || workout.date < api.today()) {
      openSy('<div class="syh">Замена упражнения</div><p class="spnote">Состав можно менять до начала тренировки. Открытая тренировка уже сохранила свой состав.</p>');
      return;
    }
    const plan = api.modern.activePlan();
    if (!plan) throw Error('Активная программа недоступна');
    const { catalog, matrix } = await exerciseCatalog();
    const state = api.state();
    const profile = api.core().readSport2Profile(state?.sport2Profile);
    const available = new Set(['bodyweight', ...profile.equipment,
      ...Object.entries(state?.equipment || {}).filter(([, item]) => item.has).map(([id]) => id),
      ...workout.exercises.flatMap(row => catalog.find(item => item.id === row.catalogId)?.equipment || []).map(item => typeof item === 'string' ? item : item.id)]);
    if (available.has('pullup')) available.add('pullup_bar');
    const present = new Set(workout.raw.blocks.flatMap(block => block.exercises.map(row => row.exercise_id)));
    const source = exercise.catalogId || catalog.find(item => item.name === exercise.name)?.id;
    const options = window.SportExtraCore.alternativesFor(source, matrix, catalog, profile.limits).filter(item =>
      !item.blocked && !present.has(item.id) && item.equipment.every(id => available.has(id)));
    openSy(`<div class="syh">Заменить упражнение<small>${label(exercise.name)}</small></div><div class="glass list">${options.map((item, at) =>
      `<button class="rw" data-sport-pick-swap="${at}"><span class="ic">${spI.swap}</span><span><b>${label(item.name)}</b><small>${label(item.why)}</small></span>${ic.chev.replace('<svg', '<svg class="chev"')}</button>`).join('') || '<div class="empty">Доступных замен для этого упражнения нет</div>'}</div>
      <p class="spnote">Замена применяется к выбранной тренировке</p>`, sheet => {
      for (const button of $$('[data-sport-pick-swap]', sheet)) button.onclick = () => report(async () => {
        const option = options[Number(button.dataset.sportPickSwap)];
        const controls = $$('[data-sport-pick-swap]', sheet);
        controls.forEach(control => { control.disabled = true; });
        try {
          const result = await api.modern.request('adapt_workout', { plan_id: plan.id, expected_version: plan.current_version, workout_key: workout.key,
            ops: [{ op: 'swap', plan_exercise_id: exercise.raw.plan_exercise_id, exercise_id: option.id, why: option.why }] });
          substitutions.set(workout.key, { index, version: result.version, from: result.from_version });
          if (button.isConnected) closeSy();
          await api.modern.load();
          toast(`Замена · ${option.name}`);
        } catch (error) {
          if (error.message === 'plan_version_stale') { await api.modern.load(); throw Error('План обновился. Открой замены ещё раз'); }
          if (error.message === 'workout_started') throw Error('Тренировка уже начата');
          throw error;
        } finally { controls.forEach(control => { control.disabled = false; }); }
      });
    });
  }
  async function undoSwap(workout, button) {
    const update = substitutions.get(workout.key), plan = api.modern.activePlan();
    if (!update || update.version !== plan?.current_version) throw Error('Версия программы изменилась');
    button.disabled = true;
    try {
      await api.modern.request('restore_workout', { plan_id: plan.id, expected_version: plan.current_version,
        workout_key: workout.key, from_version: update.from });
      substitutions.delete(workout.key);
      await api.modern.load();
    } finally { button.disabled = false; }
  }
  function exerciseDetail(raw, index) {
    if (!raw) return;
    const item = prototypeExercise(raw, index);
    original.exercise(item);
    const sheet = $('#sySheet');
    const instructions = String(raw.technique || '').split(/\r?\n/).filter(Boolean);
    if (instructions.length) $('.sptech', sheet).innerHTML = instructions.map(step => `<li>${label(step)}</li>`).join('');
    else $('.sptech', sheet).remove();
    $('[data-spsw]', sheet).onclick = () => report(() => swapExercise(api.workouts().find(row => row.key === selectedWorkoutKey), index));
    const video = $('[data-spv]', sheet);
    const media = $('.spexg img', sheet);
    video.disabled = !media;
    video.onclick = () => media?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  spExSheet = item => {
    original.exercise(item);
    const sheet = $('#sySheet');
    disabled(sheet, '[data-spsw]');
    const media = $('.spexg img', sheet);
    const button = $('[data-spv]', sheet);
    if (!button) return;
    button.disabled = !media;
    button.onclick = () => media?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  spToday = renderToday; spProg = renderProgram; spHist = renderHistory;
  bindSport = el => {
    original.sport(el);
    $('[data-sptab="today"]', el)?.addEventListener('click', event => {
      if (SPD.tab !== 'today' || !event.currentTarget.classList.contains('on')) return;
      event.stopImmediatePropagation();
      if (!api.today() || selectedDate === api.today()) return;
      selectedDate = api.today(); selectedWorkoutKey = null;
      sfx('tick'); buzz(6); blurPulse(8, 360); spPaint();
    }, { capture: true });
  };
  bindSpBody = el => {
    const body = $('#spBody', el);
    if (!api.view() && !api.problem()) void sport.open();
    else if (SPD.tab === 'today') refreshSchedule();
    body.onclick = event => {
      const button = event.target.closest('button,[data-spex]');
      if (!button || button.disabled) return;
      const data = button.dataset;
      if (data.spday != null || data.spweek != null) {
        selectedDate = weekDays[Number(data.spday ?? data.spweek)];
        selectedWorkoutKey = null; SPD.tab = 'today';
        sfx('tick'); buzz(6); blurPulse(8, 360);
        if (data.spweek != null) paint('practice'); else spPaint();
      } else if (data.sportWorkout != null) {
        const row = api.workouts().find(workout => workout.key === data.sportWorkout);
        if (!row) return;
        selectedDate = row.date; selectedWorkoutKey = row.key; SPD.tab = 'today';
        paint('practice');
      } else if (data.spready || data.sppain || data.spzone) {
        const state = readiness.get(selectedDate) || {};
        if (data.spready) state.ready = SPD.ready = Number(data.spready);
        if (data.sppain) { state.pain = SPD.pain = data.sppain; state.zone = SPD.zone = null; }
        if (data.spzone) state.zone = SPD.zone = data.spzone;
        readiness.set(selectedDate, state); spPaint();
      } else if (data.sportShiftClose != null) {
        dismissedShifts.add(schedule.last_shift.version); button.closest('.spban').remove();
      } else if (data.sptipx) {
        dismissedTips.add(data.sptipx); button.closest('.sptip').remove();
      } else if (data.sptsrc) {
        tipSourcesOpen = button.classList.toggle('open');
        button.setAttribute('aria-expanded', String(tipSourcesOpen));
        button.nextElementSibling.classList.toggle('open', tipSourcesOpen);
      } else if (data.sprun) report(() => api.start(selectedWorkoutKey, button));
      else if (data.sportResume != null) report(() => api.modern.start(null, button));
      else if (data.sportRetry != null) report(() => api.view() ? api.modern.load() : api.retry());
      else if (data.spswap != null) report(() => swapExercise(api.workouts().find(row => row.key === selectedWorkoutKey), Number(data.spswap)));
      else if (data.sportUndoSwap != null) report(() => undoSwap(api.workouts().find(row => row.key === selectedWorkoutKey), button));
      else if (data.spex != null) exerciseDetail(api.workouts().find(row => row.key === selectedWorkoutKey)?.exercises[Number(data.spex)], Number(data.spex));
      else if (data.sphist != null) report(() => readHistory(history[Number(data.sphist)], button));
      else if (data.spai) spAiSheet();
    };
  };

  function planPacket() {
    const core = api.core();
    const start = api.today();
    if (!core || !start) throw Error('Дождись загрузки Спорта');
    const state = api.state();
    const context = api.context();
    const targets = sportTargets(state).map(item => `${item.name} · ${spFmt(item.value)} ${targetUnits[item.metric]}`);
    const focus = SPGOAL[state?.sport2Focus];
    context.profile = { ...context.profile, ...(focus ? { 'Направление тренировки': focus } : {}),
      ...(targets.length ? { 'Измеримые цели': targets.join('; ').slice(0, 450) } : {}) };
    return { start, end: core.offsetDateKey(start, 55), context };
  }
  async function runGeneration(sheet, button, ticket, request) {
    const current = () => ticket === openedSheet && button.isConnected && sheet.classList.contains('on');
    button.disabled = true;
    const status = document.createElement('p');
    status.className = 'spnote'; status.setAttribute('role', 'status');
    sheet.querySelector('[role="status"]')?.remove();
    sheet.querySelector('[data-sport-plan-preview]')?.remove();
    button.before(status); status.textContent = 'Составляем программу…';
    try {
      let reply = await request();
      generationId = reply.requestId || generationId;
      while (current() && ['queued', 'running', 'building', 'processing'].includes(reply.status)) {
        await new Promise(resolve => setTimeout(resolve, 2500));
        if (!current()) return;
        reply = await api.request('generation');
        if (reply.requestId && reply.requestId !== generationId) throw Error('Черновик программы изменился');
        status.textContent = `Составляем программу · ${Number(reply.completedWeeks) || 0} из ${Number(reply.totalWeeks) || 8} недель`;
      }
      if (!current()) return;
      if (reply.status !== 'ready' || !reply.json || !generationId) throw Error(reply.error || 'Программа пока недоступна');
      const result = api.core().parsePlan(reply.json);
      status.textContent = `${result.program.title} · ${result.workouts.length} тренировок`;
      const preview = document.createElement('div');
      preview.className = 'glass list'; preview.dataset.sportPlanPreview = '';
      preview.innerHTML = result.workouts.map(row => `<div class="rw"><span class="ic">${spI.prog}</span><span><b>${label(row.title)}</b><small>${label(row.date || '')}</small></span></div>`).join('');
      status.after(preview);
      const plan = api.modern.activePlan(), reviewedId = generationId;
      button.textContent = 'Активировать программу';
      button.onclick = () => report(async () => {
        if (activeKey()) throw Error('Сначала закончи текущую тренировку');
        button.disabled = true;
        try {
          const update = await api.request('activate_generation', { requestId: reviewedId,
            expectedPlanId: plan?.id || null, expectedVersion: plan?.current_version || null });
          if (update.plan_id !== reviewedId || update.status !== 'active') throw Error('Сервер не подтвердил активацию');
          generationId = null;
          await api.modern.load();
          if (current()) closeSy();
          toast('Программа активирована');
        } finally { button.disabled = false; }
      });
    } catch (error) { if (current()) status.textContent = error.message; }
    finally { if (current()) button.disabled = false; }
  }
  spAiSheet = () => {
    original.ai();
    const ticket = ++openedSheet;
    const sheet = $('#sySheet'), button = $('#spAiGo', sheet);
    button.onclick = () => {
      const selected = field => $(`[data-sseg="${field}"] .on`, sheet)?.dataset.v;
      const requestId = generationId || crypto.randomUUID();
      const direction = { str: 'Сила', tone: 'Тонус', fit: 'Общая физическая форма' }[selected('aig')];
      const place = { home: 'Дом', gym: 'Зал' }[selected('aip')];
      const limits = $$('[data-ail].on', sheet).map(node => node.dataset.ail);
      void runGeneration(sheet, button, ticket, () => generationId ? api.request('generation') : api.request('generate', {
        ...planPacket(), requestId, direction, preferences: { direction, frequency: Number(selected('aid')), equipment: place,
          ...(limits.length ? { brief: `Ограничения: ${limits.join(', ')}` } : {}) },
      }));
    };
    report(async () => {
      const draft = await api.request('generation');
      if (ticket !== openedSheet || !button.isConnected || button.disabled) return;
      if (draft.requestId && draft.requestId !== api.modern.activePlan()?.id && ['ready', 'queued', 'running'].includes(draft.status)) {
        generationId = draft.requestId;
        await runGeneration(sheet, button, ticket, () => draft);
      }
    });
  };
  SPC.msgs.splice(0, SPC.msgs.length, { r: 'ai', t: 'Спроси о своей программе или о следующей тренировке.' });
  spChatSend = async text => {
    const message = String(text || '').trim();
    if (!message || SPC.busy) return;
    SPC.msgs.push({ r: 'me', t: message }); SPC.busy = true;
    if (curId() === 'spchat') spChatPaint();
    try {
      const result = await api.request('consult', { ...planPacket(), direction: '',
        messages: SPC.msgs.slice(1).slice(-30).map(row => ({ role: row.r === 'me' ? 'user' : 'assistant', text: row.t })) });
      if (typeof result.message !== 'string') throw Error('Тренер не вернул ответ');
      SPC.msgs.push({ r: 'ai', t: result.message });
    } catch (error) { toast(error.message); }
    finally { SPC.busy = false; if (curId() === 'spchat') spChatPaint(); }
  };
  let voiceState = 'idle';
  const voice = createPracticeVoice((kind, state, message) => {
    voiceState = state;
    const mic = $('#egMic');
    if (curId() !== 'spchat' || !mic) return;
    $('#egBar').classList.toggle('dict', state !== 'idle');
    mic.disabled = state === 'requesting' || state === 'transcribing';
    mic.setAttribute('aria-label', state === 'listening' ? 'Завершить запись' : 'Говорить голосом');
    if (state === 'idle' && message) toast(message);
  });
  spChatVoice = () => {
    if (voiceState === 'listening') { void voice.finish(); return; }
    void voice.start({ kind: 'sport', active: () => curId() === 'spchat', onText(text) {
      const input = $('#egIn');
      input.value = [input.value.trim(), text].filter(Boolean).join(' ');
      input.focus({ preventScroll: true });
    } });
  };
  new MutationObserver(() => {
    if (!phone.classList.contains('egchatting') || curId() !== 'spchat') voice.cancel();
  }).observe(phone, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('pagehide', () => voice.cancel());

  function save(action, changes) {
    return api.send({ kind: 'profile', action, changes, draftId: crypto.randomUUID() });
  }
  async function patchSettings(changes) {
    const reply = await api.request('patch', { requestId: crypto.randomUUID(), changes });
    if (!reply?.state) throw Error('Сервер не подтвердил изменение');
    await api.retry();
  }
  function sportTargets(state) {
    return Object.entries(state?.sport2Targets || {}).filter(([id, item]) =>
      /^[0-9a-f-]{36}$/i.test(id) && typeof item?.name === 'string' && Object.hasOwn(targetUnits, item.metric) && Number.isFinite(item.value) && item.value > 0)
      .map(([id, item]) => ({ ...item, id }));
  }
  function editTarget(target) {
    openSy(`<div class="syh">${target ? 'Изменить цель' : 'Новая цель'}</div><form class="glass list stv" id="sportTargetForm">
      <label class="syrow in"><span>Упражнение</span><input name="name" value="${label(target?.name)}" maxlength="100" required></label>
      <label class="syrow in"><span>Показатель</span><select name="metric">${Object.entries(targetUnits).map(([key, unit]) =>
        `<option value="${key}"${key === target?.metric ? ' selected' : ''}>${unit}</option>`).join('')}</select></label>
      <label class="syrow in"><span>Цель</span><input name="value" type="number" min="0.001" max="10000" step="any" value="${target?.value || ''}" required></label>
      <button type="submit" class="btn main sygo">Сохранить</button></form>`, sheet => {
      const form = $('#sportTargetForm', sheet);
      form.onsubmit = event => {
        event.preventDefault();
        report(async () => {
          const data = new FormData(form);
          const name = String(data.get('name') || '').trim(), metric = data.get('metric'), value = Number(data.get('value'));
          if (!name || !Object.hasOwn(targetUnits, metric) || !Number.isFinite(value) || value <= 0 || (metric !== 'kg' && !Number.isInteger(value))) throw Error('Проверь название и значение цели');
          const button = $('button[type="submit"]', form);
          button.disabled = true;
          try {
            await patchSettings([{ path: ['sport2Targets', target?.id || crypto.randomUUID()], value: { name, metric, value } }]);
            if (form.isConnected) closeSy();
            if (curId() === 'spsetp' && S.spp === 'goals') paint('spsetp');
          } finally { button.disabled = false; }
        });
      };
    });
  }
  function readSettings() {
    const state = api.state() || {};
    const profile = state.trainingProfile || {};
    const body = api.core();
    const profileGoal = body?.readSport2Profile(state.sport2Profile).goal;
    SPS.goal = Object.hasOwn(SPGOAL, state.sport2Focus) ? state.sport2Focus : ({ strength: 'str', form: 'tone' })[profileGoal] || '';
    SPS.mus = Object.keys(muscleKeys).filter(key => muscleKeys[key].some(id => state.targetMuscles?.includes(id)));
    SPS.target = [];
    SPS.per = String(profile.schedule || ''); SPS.dur = String(profile.sessionMinutes || '');
    SPS.sex = profile.sex ? (profile.sex === 'Женский' ? 'f' : 'm') : '';
    SPS.age = body?.ageFromBirthDate(profile.birthDate) ?? '—';
    SPS.place = state.trainingPlace?.where || 'home';
    SPD.cam = state.coachSettings?.cameraCoach !== false;
    SPD.voice = !!state.coachSettings?.cameraVoice;
    for (const [key, server] of Object.entries(equipmentKeys)) SPS.eq[key] = [!!state.equipment?.[server]?.has, state.equipment?.[server]?.kg ?? '—'];
    return state;
  }
  R.spset = () => {
    readSettings();
    const view = template(original.settings());
    const root = view.content;
    setText(root, '[data-spsetp="goals"] small', [SPS.per ? `${SPS.per} в неделю` : '', SPS.dur ? `${SPS.dur} мин` : ''].filter(Boolean).join(' · ') || 'Готовность и цели');
    setText(root, '[data-spsetp="sched"] small', 'Расписание программы');
    setText(root, '[data-spsetp="prof"] small', SPS.age === '—' ? 'Анкета' : `${SPS.age} лет`);
    setText(root, '[data-spsetp="meas"] small', 'История измерений');
    setText(root, '[data-spsetp="watch"] small', 'Health Connect');
    setText(root, '[data-spgoprog] small', api.modern.activePlan()?.title || 'Программы');
    disabled(root, '[data-spvoice],[data-spcoach],[data-sptips],[data-sseg="sprest"] button,[data-sseg="spcmode"] button');
    return view.innerHTML;
  };
  bindSpSet = el => {
    bindSyBits(el, (button, on) => report(async () => {
      if (!button.dataset.spcam) return;
      button.disabled = true;
      try {
        const reply = await api.request('patch', { requestId: crypto.randomUUID(), changes: [{ path: ['coachSettings', 'cameraCoach'], value: on }] });
        if (reply.state?.coachSettings?.cameraCoach !== on) throw Error('Сервер не сохранил настройку камеры');
        await api.retry();
      } catch (error) { if (curId() === 'spset') paint('spset'); throw error; }
      finally { button.disabled = false; }
    }));
    el.onclick = event => {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      if (button.dataset.spsetp) { S.spp = button.dataset.spsetp; go('spsetp'); }
      if (button.dataset.spgoprog) { SPD.tab = 'prog'; pop(); }
      if (button.dataset.spgolib) go('splib');
      if (button.dataset.spexport) report(exportHistory);
    };
  };
  async function exportHistory() {
    const sessions = api.modern.sessions().filter(row => !row.status || row.status === 'completed');
    const csv = cell => `"${String(cell ?? '').replace(/^[=+@-]/, match => `'${match}`).replaceAll('"', '""')}"`;
    const items = await Promise.all(sessions.map(row => api.modern.request('read_session', { session_id: row.id })));
    const rows = items.flatMap(({ session, projection }) => session.plan_snapshot.workout.blocks.flatMap(block => block.exercises.flatMap(exercise =>
      (projection?.sets || []).filter(set => set.plan_exercise_id === exercise.plan_exercise_id && set.status === 'confirmed').map(set =>
        [session.workout_date, session.plan_snapshot.workout.title, exercise.name, set.set_index, set.actual_reps, set.actual_seconds, set.actual_kg]))));
    const file = new Blob(['\ufeff' + [['Дата', 'Тренировка', 'Упражнение', 'Подход', 'Повторы', 'Секунды', 'Вес, кг'], ...rows]
      .map(row => row.map(csv).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(file), link = document.createElement('a');
    link.href = url; link.download = 'sport-history.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Выгружено подходов: ${rows.length}`);
  }

  function measurementRows(state) {
    const core = api.core();
    return (core?.measurementFields(state) || []).filter(field => !field.archived).map(field => ({
      field, rows: core.measurementHistory(state, field.id),
    }));
  }

  const onInventory = () => curId() === 'spsetp' && S.spp === 'inv';
  function currentInventory() {
    return api.core().inventoryLite(inventorySettings?.inventory || {});
  }
  function refreshInventory() {
    if (inventoryLoading) return inventoryLoading;
    const epoch = inventoryEpoch = api.view()?.ownerEpoch;
    inventoryError = '';
    inventoryLoading = api.modern.request('analysis_settings').then(({ settings }) => {
      if (api.view()?.ownerEpoch !== epoch) return;
      if (!Number.isInteger(settings?.revision)) throw Error('Инвентарь недоступен');
      api.core().inventoryLite(settings.inventory);
      inventorySettings = settings;
    }).catch(error => { inventoryError = error.message; }).finally(() => {
      inventoryLoading = null;
      if (onInventory()) paint('spsetp');
    });
    return inventoryLoading;
  }
  async function changeInventory(edit) {
    if (!inventorySettings || inventorySaving || inventoryEpoch !== api.view()?.ownerEpoch) return;
    const { enabled, mode, revision } = inventorySettings;
    const current = currentInventory();
    const next = current.handles ? current : {
      handles: { mass_kg: 2, count: 2, sleeve_slots: 4, collar_kg: 0 }, plates: [], limits: { max_per_dumbbell_kg: null },
    };
    edit(next);
    const inventory = api.core().inventoryLite(next);
    inventorySaving = true;
    if (onInventory()) paint('spsetp');
    try {
      const { settings } = await api.modern.request('analysis_settings', { expected_revision: revision, settings: { enabled, mode, inventory } });
      if (!Number.isInteger(settings?.revision)) throw Error('Инвентарь не сохранён');
      api.core().inventoryLite(settings.inventory);
      inventorySettings = settings;
    } catch (error) {
      if (error.message === 'analysis_stale') {
        await refreshInventory();
        throw Error('Инвентарь уже изменился. Проверь значения и повтори');
      }
      throw error;
    } finally {
      inventorySaving = false;
      if (onInventory()) paint('spsetp');
    }
  }

  R.spsetp = () => {
    const state = readSettings();
    const inventory = S.spp === 'inv' && api.core() && inventoryEpoch === api.view()?.ownerEpoch ? currentInventory() : {};
    const weights = inventory.handles ? api.core().sportAchievable(inventory, inventory.handles.count) : [];
    if (S.spp === 'inv') {
      SPS.db.grip = inventory.handles?.mass_kg ?? 2;
      SPS.db.n = inventory.handles?.count ?? 2;
      SPS.db.plates = (inventory.plates || []).map(plate => [plate.mass_kg, plate.count]);
    }
    const view = template(original.preferences());
    const root = view.content;
    if (S.spp === 'goals') {
      const add = root.querySelector('[data-spsadd]');
      add.insertAdjacentHTML('beforebegin', sportTargets(state).map(item => `<button class="rw sptg" data-sport-target="${item.id}"><span class="ic">${spI.trophy}</span><span><b>${label(item.name)} · ${spFmt(item.value)} ${targetUnits[item.metric]}</b></span>${ic.chev.replace('<svg','<svg class="chev"')}</button>`).join(''));
    } else if (S.spp === 'inv') {
      const dumbbellWeight = root.querySelector('[data-speq="db"]')?.parentElement.querySelector('small');
      if (dumbbellWeight) dumbbellWeight.textContent = weights.length ? `${SPS.db.n} шт · до ${spFmt(weights.at(-1))} кг` : 'Разборные гантели';
      const db = root.querySelector('.spdb');
      if (db) {
        db.previousElementSibling.lastElementChild.textContent = weights.length ? `до ${spFmt(weights.at(-1))} кг на гантель` : '';
        const note = db.nextElementSibling;
        const steps = weights.slice(1).map((weight, index) => Math.round((weight - weights[index]) * 1000) / 1000).filter(step => step > 0);
        note.textContent = steps.length ? `Шаг ${spFmt(Math.min(...steps))} кг · для подсказок при сборке` : 'Укажи грифы и блины для расчёта веса';
        if (inventoryLoading || !inventorySettings || inventoryError) {
          note.textContent = inventoryError ? 'Инвентарь не загрузился' : 'Загружаем инвентарь…';
          if (inventoryError) note.insertAdjacentHTML('beforeend', ' <button type="button" class="btn sm glass" data-inventory-retry>Повторить</button>');
        }
        if (!inventorySettings || inventorySaving || inventoryLoading || inventoryError) disabled(db, 'button');
      }
      disabled(root, '[data-v="out"],[data-sps="eq-kb"] button,[data-sps="eq-bar"] button');
      for (const [key, server] of Object.entries(equipmentKeys)) {
        if (!api.core()?.EQUIPMENT.some(item => item.id === server)) disabled(root, `[data-speq="${key}"]`);
      }
    } else if (S.spp === 'prof') {
      setText(root, '[data-sps="hgt"] b', '—');
      disabled(root, '[data-sps] button,[data-sseg="spexp"] button,[data-splim]');
    } else if (S.spp === 'meas') {
      const fields = measurementRows(state);
      const current = fields.find(item => item.field.id === measurementId) || fields[0];
      const currentValue = current?.rows[0];
      setText(root, '.spmh small', current?.field.label || 'Замеры');
      setText(root, '.spmh b', currentValue ? `${currentValue.value} ${current.field.unit || ''}`.trim() : '—');
      setText(root, '.spmh em', currentValue && Number.isFinite(+new Date(currentValue.recordedAt)) ? dateFormat.format(new Date(currentValue.recordedAt)) : '');
      remove(root, '.spmd,.spmr,.spnote,.spf,.spfadd');
      root.querySelectorAll('.sylab').forEach((node, index) => { if (index > 0) node.remove(); });
      root.querySelector('.sylab span:last-child').textContent = `${fields.length} параметров`;
      root.querySelector('.list').innerHTML = fields.map(({ field, rows }, index) => `<button class="rw spmr${field.id === current?.field.id ? ' on' : ''}" data-sport-measurement="${index}"><span class="ic">${spI.ruler}</span><span><b>${label(field.label)}</b><small>${rows.length ? label(`${rows[0].value} ${field.unit || ''}`.trim()) : '—'}</small></span></button>`).join('');
    } else if (S.spp === 'watch') {
      setText(root, '.spwt .ezt small', 'Health Connect'); setText(root, '.spwt .ezt b', 'Часы');
      setText(root, '.spwt .ezt em', 'Открой на устройстве с Health Connect'); disabled(root, 'button');
    } else if (S.spp === 'sched') {
      const realDays = new Set(api.workouts().map(row => (dayTime(row.date).getUTCDay() + 6) % 7));
      root.querySelectorAll('[data-spdayp]').forEach(button => { button.className = realDays.has(Number(button.dataset.spdayp)) ? 'on' : ''; });
      remove(root, '.spnote'); setText(root, '[data-sps="time"] b', '—');
      setText(root, '.spval', 'По программе'); disabled(root, 'button');
    }
    return view.innerHTML;
  };
  bindSpSetp = el => {
    let pending = false;
    function submit(action, values) {
      if (pending) return;
      pending = true;
      report(async () => {
        try { if (!await save(action, values)) throw Error('Настройку не удалось сохранить'); }
        finally { pending = false; if (curId() === 'spsetp') paint('spsetp'); }
      });
    }
    bindSyBits(el, (button, on) => {
      const key = equipmentKeys[button.dataset.speq];
      if (key) submit('saveEquipment', { equipment: { [key]: { has: on } } });
    }, (field, value) => {
      if (field === 'spplace') submit('saveEquipment', { trainingPlace: { where: value, gymDays: api.state()?.trainingPlace?.gymDays || [] } });
      if (field === 'spsex') submit('saveFields', { sex: value === 'f' ? 'Женский' : 'Мужской' });
      if (field === 'spper') submit('saveFields', { schedule: value });
      if (field === 'spdur') submit('saveFields', { sessionMinutes: value });
      if (field === 'spgoal') report(async () => {
        const changes = [{ path: ['sport2Focus'], value }];
        const goal = { str: 'strength', tone: 'form' }[value];
        changes.push(goal ? { path: ['sport2Profile', 'goal'], value: goal } : { path: ['sport2Profile', 'goal'], remove: true });
        try { await patchSettings(changes); }
        finally { if (curId() === 'spsetp' && S.spp === 'goals') paint('spsetp'); }
      });
    });
    $('[data-spsadd]', el)?.addEventListener('click', () => editTarget(null));
    for (const row of $$('[data-sport-target]', el)) row.onclick = () => editTarget(sportTargets(api.state()).find(item => item.id === row.dataset.sportTarget));
    for (const chip of $$('[data-spmus]', el)) chip.onclick = () => {
      const keys = muscleKeys[chip.dataset.spmus];
      const previous = api.state()?.targetMuscles || [];
      const targetMuscles = chip.classList.contains('on') ? previous.filter(key => !keys.includes(key)) : [...new Set([...previous, ...keys])];
      submit('saveMuscles', { targetMuscles });
    };
    if (S.spp === 'inv') {
      if (inventoryEpoch !== api.view()?.ownerEpoch) { inventorySettings = null; inventoryError = ''; }
      if ($('.spdb', el) && !inventorySettings && !inventoryError) void refreshInventory();
      $('[data-inventory-retry]', el)?.addEventListener('click', refreshInventory);
      $('[data-spaddo]', el)?.addEventListener('click', () => { SPS.db.add = true; paint('spsetp'); });
      for (const button of $$('[data-spadd]', el)) button.onclick = () => report(async () => {
        await changeInventory(inventory => {
          inventory.plates.push({ mass_kg: Number(button.dataset.spadd), count: 2 });
          SPS.db.add = false;
        });
      });
      for (const step of $$('.spdb [data-sps]', el)) {
        for (const button of $$('button', step)) button.onclick = () => report(() => changeInventory(inventory => {
          const delta = Number(button.dataset.d);
          const key = step.dataset.sps;
          if (key === 'dbg') inventory.handles.mass_kg = Math.round(Math.max(.001, Math.min(80, inventory.handles.mass_kg + .5 * delta)) * 1000) / 1000;
          else if (key === 'dbn') inventory.handles.count = Math.max(1, Math.min(2, inventory.handles.count + delta));
          else {
            const index = Number(key.slice(3));
            const plate = inventory.plates[index];
            plate.count = Math.min(64, plate.count + delta * 2);
            if (plate.count <= 0) inventory.plates.splice(index, 1);
          }
        }));
      }
    }
    for (const button of $$('[data-sport-measurement]', el)) button.onclick = () => {
      measurementId = measurementRows(api.state() || {})[Number(button.dataset.sportMeasurement)]?.field.id;
      paint('spsetp');
    };
    if (S.spp === 'meas') {
      const data = measurementRows(api.state() || {});
      const series = (data.find(item => item.field.id === measurementId) || data[0])?.rows || [];
      const points = series.slice(0, 12).reverse().map(row => Number(String(row.value).replace(',', '.'))).filter(Number.isFinite);
      if (points.length > 1) curve($('#spMc', el), points.map(value => value - Math.min(...points) + 1));
    }
    $('[data-spmnew]', el)?.addEventListener('click', () => {
      const fields = api.core()?.measurementFields(api.state()).filter(field => !field.archived) || [];
      if (!fields.length) return toast('Нет доступных параметров');
      openSy(`<div class="syh">Новый замер</div><form class="glass list stv"><label class="syrow in"><span>Параметр</span><select name="field">${fields.map((field, index) => `<option value="${index}">${label(field.label)}</option>`).join('')}</select></label><label class="syrow in"><span>Значение</span><input name="value" required maxlength="120"></label><button class="btn main sygo">Сохранить</button></form>`, sheet => {
        $('form', sheet).onsubmit = event => {
          event.preventDefault();
          const form = event.currentTarget, button = $('button', form), data = new FormData(form);
          button.disabled = true;
          report(async () => {
            try {
              if (!await save('saveMeasurement', { fieldId: fields[Number(data.get('field'))].id, value: data.get('value') })) throw Error('Замер не сохранён');
              if (form.isConnected) closeSy();
              if (curId() === 'spsetp') paint('spsetp');
              toast('Замер сохранён');
            } finally { button.disabled = false; }
          });
        };
      });
    });
  };

  R.sprun = () => '';
  bindSpRun = () => {};
  spFinish = () => runner.closeMenu();
}
