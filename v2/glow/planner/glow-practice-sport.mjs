import { getModuleHost } from './runtime-session.js';
import { createSportOwner } from './practice/sport-owner.mjs';
import { resolveWorkouts } from './practice/sport-sequence.mjs';
import { createSportServerAdapter } from './practice/sport-server.mjs';
import { createPracticeCamera } from './glow-practice-camera.mjs';
import { createSportPlan } from './glow-practice-sport-plan.mjs';
import { createGlowSport2 } from './glow-practice-sport2.mjs';
import { confirmMore, moreField, moreList, moreRow } from './glow-more-ui.mjs';
import { delegatePractice, label, moreEmpty, moreForm, moreInput, moreOptions, practiceButton, practiceDate,
  practiceDay, practiceMessage, practiceTabs, progress, slug, unslug } from './glow-practice-ui.mjs';

let coreLoading;
function sportCore() {
  if (window.SportCore) return Promise.resolve(window.SportCore);
  coreLoading ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('./practice/sport-core.js', import.meta.url).href;
    script.onload = () => window.SportCore ? resolve(window.SportCore) : reject(Error('SportCore недоступен'));
    script.onerror = () => { script.remove(); reject(Error('Не удалось загрузить движок тренировки')); };
    document.head.append(script);
  }).finally(() => { coreLoading = null; });
  return coreLoading;
}
const phases = { prep: 'Подготовка', work: 'Подход', rest: 'Отдых', between: 'Далее', boundary: 'Разминка закончена' };
const keyFor = button => unslug(button.dataset.workout || '');
const minutes = seconds => Math.floor(Math.max(0, seconds || 0) / 60);
const clockText = seconds => `${minutes(seconds)}:${String(Math.max(0, seconds || 0) % 60).padStart(2, '0')}`;
const count = workout => workout?.counts.reduce((sum, number) => sum + number, 0) || 0;
const total = workout => workout?.exercises.reduce((sum, item) => sum + item.sets, 0) || 0;

export function connectGlowSport(env) {
  let core, source, adapter, owner, stop, stopScope, inflight, model, problem;
  let tab = 'today', date, busy = false;
  let screen, signature;
  const camera = createPracticeCamera();
  const envelope = () => adapter.read(adapter.capture());
  let sport2 = false;
  const modern = createGlowSport2({ source: () => source, state: () => adapter ? envelope().state : null,
    today: () => today(), redraw: () => env.redraw('sport'), presentation: env.presentation });
  const planner = createSportPlan({
    host: () => source,
    parse: json => core.parsePlan(json),
    dates: () => [today(), core.offsetDateKey(today(), 6), core.offsetDateKey(today(), 90)],
    profile: () => envelope().state.trainingProfile || {},
    currentPlan: () => modern.activePlan(),
    context(health) {
      const value = envelope();
      const state = { ...value.state, tests: value.state.tests || {} };
      return core.buildTrainingContext(state, resolveWorkouts(core, value).visible,
        core.programDaySince(value.startedOn || today()), 7, health, true);
    },
    preview(json) {
      const value = envelope(), plan = core.parsePlan(json);
      const lifecycle = value.state.programLifecycle?.['v2|' + plan.program.id]?.status;
      if (['deleted', 'archived'].includes(lifecycle)) throw Error('Этот план уже удалён или находится в архиве');
      core.mergeCatalog(value.catalog, plan);
      return { plan, sport2 };
    },
    async imported() {
      await retry();
      if (sport2) await modern.load();
      tab = 'prog';
    },
  });
  const workouts = () => sport2 ? modern.workouts() : model?.workouts || [];
  const byDate = key => workouts().filter(item => item.date === key);
  const today = () => core?.todayKey();
  const workoutBy = key => workouts().find(item => item.key === key);
  const exerciseBy = (key, index) => workoutBy(key)?.exercises[index];

  function adopt(next) {
    const previousRevision = model?.dataRevision;
    const previousError = model?.error;
    model = next;
    if (env.selected('sport') && (previousRevision !== next.dataRevision || previousError !== next.error)) env.redraw('sport');
    if (curId() === 'sprun' && screen?.isConnected) {
      const session = next.session;
      const nextSignature = JSON.stringify([session?.stepKey, session?.phase, session?.paused, next.dataRevision, next.error]);
      if (nextSignature !== signature) {
        screen.innerHTML = renderRun();
        signature = nextSignature;
        bindRun(screen);
      } else {
        const clock = $('[data-sport-clock]', screen);
        if (clock) clock.textContent = clockText(session?.remainingSeconds);
        const ring = $('[data-sport-ring]', screen);
        if (ring && session?.clock) ring.style.setProperty('--p', progress(session.remainingSeconds * 1000, session.totalMs));
      }
    }
  }
  function clear() {
    camera.close(true); planner.reset(); modern.reset(); sport2 = false;
    stop?.(); stopScope?.(); adapter?.dispose();
    void owner?.dispose();
    owner = adapter = model = source = stop = stopScope = null;
    problem = '';
    if (curId() === 'sprun') { screen?.replaceChildren(); pop(); }
    else env.redraw('sport');
  }
  async function open() {
    if (owner || inflight || problem || !env.active('sport')) return inflight;
    inflight = (async () => {
      try {
        [core, source] = await Promise.all([sportCore(), getModuleHost('sport')]);
        const bound = await createSportServerAdapter({ source });
        adapter = bound;
        const settings = bound.read(bound.capture()).state.notificationSettings;
        sport2 = core.isSport2Enabled(bound.read(bound.capture()).state);
        core.setCalendarTimeZone(core.notificationSettings(settings).timeZone);
        date ??= today();
        owner = createSportOwner({ core, host: bound, autoTick: false });
        stop = owner.subscribe(adopt);
        stopScope = source.subscribe(() => { if (!source?.isCurrent()) clear(); });
        adopt(owner.snapshot());
        if (sport2) await modern.load();
      } catch (error) {
        adapter?.dispose();
        adapter = owner = null;
        problem = error.message || 'Не удалось загрузить Спорт';
      } finally { inflight = null; env.redraw('sport'); }
    })();
    return inflight;
  }
  async function send(intent) {
    if (busy || !owner || !source?.isCurrent()) return false;
    const view = owner.snapshot();
    busy = true;
    try {
      const reply = await owner.dispatch({ requestId: crypto.randomUUID(), ownerEpoch: view.ownerEpoch,
        baseRevision: view.dataRevision, intent });
      if (!reply.ok) throw Error(reply.error || 'Сервер не подтвердил действие');
      return true;
    } finally { busy = false; }
  }
  async function retry() {
    if (!owner) { problem = ''; env.redraw('sport'); await open(); return; }
    await adapter.refresh();
    await send({ kind: 'refresh' });
  }
  const techniqueImage = exercise => {
    const key = spGid({ id: exercise.id, n: exercise.name });
    return key ? spMedia(key) : '';
  };
  function showExercise(workout, item, index) {
    if (!item) return;
    const image = techniqueImage(item);
    openSy(`<div class="syh">${label(item.name)}<small>${label(item.scheme)}</small></div>`
      + (image ? `<div class="glass sptechvis">${image}</div>` : '')
      + (item.technique ? `<p>${label(item.technique)}</p>` : '')
      + (workout && !sport2 && !workout.readOnly ? practiceButton('sets', 'Записать подходы', spI.check) : ''), sheet => {
      $('[data-practice-action="sets"]', sheet)?.addEventListener('click', () => { closeSy(); void journal(workout, item, index).catch(error => toast(error.message)); });
    });
  }
  async function journal(workout, exercise, index) {
    const draftId = crypto.randomUUID();
    const context = { kind: 'journal', workoutKey: workout.key, exerciseId: exercise.id, draftId };
    if (!await send({ ...context, action: 'open' })) return;
    const draft = model.journal;
    const fields = Array.from({ length: Math.max(1, exercise.sets) }, (_, i) => {
      const entry = draft.sets[i];
      return moreInput(`Подход ${i + 1} · ${draft.unit === 'seconds' ? 'секунды' : 'повторы'}`, 'reps-' + i, entry?.reps ?? '',
        'type="number" min="1" max="3600" step="1"')
        + moreInput('Вес, кг', 'weight-' + i, entry?.kilograms ?? '', 'type="number" min="0" max="2000" step="any"');
    }).join('');
    moreForm(exercise.name, fields, async values => {
      const sets = Array.from({ length: exercise.sets }, (_, i) => {
        const reps = Number(values.get('reps-' + i));
        const kg = values.get('weight-' + i);
        return reps > 0 ? { reps, kilograms: kg === '' ? null : Number(kg) } : null;
      }).filter(Boolean);
      if (!sets.length) throw Error('Укажи выполненные подходы');
      return send({ ...context, action: 'save', sets, ...(draft.basis ? { basis: draft.basis } : {}) });
    }, { extra: draft.previous?.length ? practiceButton('copy-previous', 'Как в прошлый раз', spI.repeat || ic.reset) : '',
      bind(form) {
        $('[data-practice-action="copy-previous"]', form)?.addEventListener('click', () => {
          for (const [i, entry] of draft.previous.entries()) {
            if (i >= exercise.sets) break;
            form.elements['reps-' + i].value = entry.reps;
            form.elements['weight-' + i].value = entry.kilograms ?? '';
          }
        });
      },
    });
  }
  function week() {
    const current = practiceDate(date || today());
    if (!current) return '';
    const start = new Date(current);
    start.setDate(current.getDate() - (current.getDay() + 6) % 7);
    return `<div class="glass spweek">${Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      const key = new Intl.DateTimeFormat('sv-SE').format(day);
      const on = key === date;
      const list = byDate(key);
      return `<button class="${on ? 'on' : ''} ${key === today() ? 'today' : ''} ${list.some(item => item.finished) ? 'done' : ''}"
        data-practice-action="day" data-day="${key}" aria-label="${label(day.toLocaleDateString('ru'))}" aria-pressed="${on}">
        <small>${day.toLocaleDateString('ru', { weekday: 'short' })}</small><b>${day.getDate()}</b><i></i></button>`;
    }).join('')}</div>`;
  }
  function workoutCard(workout) {
    const active = sport2 ? modern.activeWorkout()?.workout_key === workout.key : model.session?.active && model.session.workoutKey === workout.key;
    const done = count(workout), sum = total(workout);
    const attrs = `data-workout="${slug(workout.key)}"`;
    return `<div class="plate-w bal spday" style="--lvl:${progress(done, sum)}"><div class="halo"></div><div class="plate"><div class="fill"></div>
      <small>${label(workout.programTitle || practiceDay(workout.date))}</small><h3>${label(workout.title)}</h3>
      <div class="lbar2"><i style="--v:${progress(done, sum)}"></i></div><small>${done} из ${sum} подходов</small></div></div>
      ${!workout.readOnly && !workout.finished ? `<button class="btn main sygo" data-practice-action="start" ${attrs}>${spI.play}${active ? 'Продолжить тренировку' : 'Начать тренировку'}</button>` : ''}
      <div class="sylab">Упражнения</div>` + moreList(workout.exercises.map((item, index) =>
      moreRow(spI.target, item.name, [item.scheme, `${workout.counts[index] || 0}/${item.sets}`].filter(Boolean).join(' · '),
        `data-practice-action="exercise" data-index="${index}" ${attrs}`)).join(''));
  }
  function history() {
    if (sport2) {
      const rows = modern.sessions().filter(item => !item.status || item.status === 'completed');
      return rows.length ? moreList(rows.map(item => {
        const planned = workoutBy(item.workout_key);
        const title = item.title || item.workout_title || item.plan_snapshot?.workout?.title || planned?.title || 'Тренировка';
        return moreRow(spI.clock, title, [practiceDay(item.workout_date || planned?.date), item.elapsed_seconds ? minutes(item.elapsed_seconds) + ' мин' : ''].filter(Boolean).join(' · '),
          `data-practice-action="modern-history" data-session="${slug(item.id)}"`);
      }).join('')) : moreEmpty('Тренировок в истории пока нет');
    }
    const rows = model.history?.sessions || [];
    return rows.length ? moreList(rows.slice(0, 80).map((item, index) => moreRow(spI.clock, item.title || 'Тренировка',
      [practiceDay(item.date), item.seconds ? minutes(item.seconds) + ' мин' : ''].filter(Boolean).join(' · '),
      `data-practice-action="history" data-index="${index}"`)).join(''))
      : moreEmpty('Тренировок в истории пока нет');
  }
  function showHistory(index) {
    const item = model.history.sessions[index];
    if (!item) return;
    openSy(`<div class="syh">${label(item.title)}<small>${label(practiceDay(item.date))}</small></div>` +
      moreList(item.exercises.map(exercise => `<div class="syrow in"><span><b>${label(exercise.name)}</b><br>
        <small>${exercise.completedSets} из ${exercise.plannedSets} подходов</small>
        ${exercise.actualSets.map(set => `<small>${set.setNumber}. ${label([set.actualReps, set.kilograms !== null ? set.kilograms + ' кг' : set.basis].filter(Boolean).join(' · '))}</small>`).join('')}
        </span></div>`).join('')));
  }
  function program() {
    const grouped = new Map();
    for (const workout of workouts()) {
      const group = grouped.get(workout.programTitle) || [];
      group.push(workout);
      grouped.set(workout.programTitle, group);
    }
    return grouped.size ? [...grouped].map(([title, items]) => `<div class="sylab">${label(title || 'Программа')}</div>` +
      moreList(items.map(item => moreRow(spI.clock, item.title, [practiceDay(item.date), item.finished ? 'Завершена' : ''].filter(Boolean).join(' · '),
        `data-practice-action="past" data-workout="${slug(item.key)}"`)).join(''))).join('') : moreEmpty('Тренировочная программа пока пуста');
  }
  function render() {
    const header = `<div class="srow spcaps">${capsHTML(SPTAB, tab, 'data-sptab', spI)}
      <button class="glass ib" data-practice-action="profile" aria-label="Настройки спорта">${ic.gear}</button></div>`;
    if (!model) return header + practiceMessage(problem || 'Загружаем тренировки…', !!problem);
    const session = model.session;
    const visibleWorkouts = tab === 'today' ? byDate(date) : [];
    const current = sport2 && modern.activeWorkout();
    const resume = current && !visibleWorkouts.some(row => row.key === current.workout_key)
      ? practiceButton('modern-resume', 'Продолжить тренировку', spI.play)
      : !sport2 && session?.active && !visibleWorkouts.some(row => row.key === session.workoutKey)
      ? practiceButton('resume', 'Продолжить тренировку', spI.play) : '';
    const actions = resume + (tab === 'prog' ? practiceButton('new-plan', 'Новая программа', ic.plus) : '');
    return header + `<div id="spBody">${model.sync?.pending ? practiceMessage('Есть неподтверждённое действие') : ''}
      ${sport2 && modern.error() ? practiceMessage(modern.error()) : ''}
      ${actions ? `<div class="glow-sport-home-actions">${actions}</div>` : ''}
      ${tab === 'today' ? week() + (visibleWorkouts.map(workoutCard).join('') || moreEmpty('На эту дату тренировок нет'))
        : tab === 'prog' ? program() : history()}</div>`;
  }
  async function start(key, button) {
    if (!workoutBy(key)) return;
    if (sport2) return modern.start(key, button);
    if (model.session?.active) {
      if (model.session.workoutKey !== key) throw Error('Сначала закончи текущую тренировку');
      go('sprun');
      return;
    }
    if (await send({ kind: 'session', action: 'start', workoutKey: key })) go('sprun');
  }
  function bind(el) {
    practiceTabs(el, 'data-sptab', key => { tab = key; env.redraw('sport'); });
    delegatePractice(el, {
      retry: () => sport2 ? modern.load() : retry(), day(button) { date = button.dataset.day; env.redraw('sport'); },
      past(button) { const row = workoutBy(keyFor(button)); if (row) { date = row.date; tab = 'today'; env.redraw('sport'); } },
      history: button => showHistory(Number(button.dataset.index)),
      start: button => start(keyFor(button), button),
      'modern-resume': button => modern.start(null, button),
      async 'modern-history'(button) {
        const id = unslug(button.dataset.session), lease = source;
        const data = await lease.request('read_session', { session_id: id });
        if (lease !== source || !lease.isCurrent() || !env.selected('sport')) return;
        const workout = data?.session?.plan_snapshot?.workout;
        if (!workout) throw Error('История тренировки недоступна');
        const sets = data.projection?.sets || [];
        openSy(`<div class="syh">${label(workout.title)}<small>${label(practiceDay(workout.date))}</small></div>`
          + moreList(workout.blocks.flatMap(block => block.exercises).map(exercise => {
            const rows = sets.filter(item => item.plan_exercise_id === exercise.plan_exercise_id && item.status === 'confirmed');
            return `<div class="syrow in"><span><b>${label(exercise.name)}</b><br><small>${rows.length} из ${exercise.sets}</small>
              ${rows.map(row => `<small>${label([row.actual_kg != null ? row.actual_kg + ' кг' : '', row.actual_reps ?? (row.actual_seconds != null ? row.actual_seconds + ' с' : '')].filter(Boolean).join(' · '))}</small>`).join('')}</span></div>`;
          }).join('')));
      },
      resume: () => go('sprun'),
      profile: () => go('spset'),
      'new-plan': () => go('spchat'),
      exercise(button) { const key = keyFor(button); showExercise(workoutBy(key), exerciseBy(key, Number(button.dataset.index))); },
    });
  }
  function renderRun() {
    const session = model?.session;
    if (!session) return practiceMessage('Тренировка не запущена', false);
    const workout = workoutBy(session.workoutKey);
    if (!session.active) {
      return `<div class="sprun fin"><div class="glass spman"><span>${spI.trophy}</span><b>${count(workout)} / ${total(workout)}</b>
        <small>Подходов · ${minutes(session.elapsedSeconds)} мин</small></div>
        ${practiceButton('back', 'К тренировкам', ic.chev)}</div>`;
    }
    const item = session.exercise || {};
    const ratio = progress(session.remainingSeconds * 1000, session.totalMs);
    const isWork = session.phase === 'work', boundary = session.phase === 'boundary';
    const controls = boundary ? practiceButton('continue', 'Начать основную часть', spI.play)
      : practiceButton(session.paused ? 'play' : 'pause', session.paused ? 'Продолжить' : 'Пауза', session.paused ? spI.play : spI.pause)
        + practiceButton(isWork ? 'complete' : 'next', isWork ? 'Подход выполнен' : 'Далее', isWork ? ic.check : ic.chev);
    return `<div class="sprun${isWork ? '' : ' resting'}"><div class="sprtop">${(workout?.exercises || []).map((exercise, index) =>
      `<i class="${index === session.index ? 'cur' : (workout.counts[index] || 0) >= exercise.sets ? 'ok' : ''}"
        style="--p:${progress(workout.counts[index], exercise.sets)}"></i>`).join('')}</div>
      <div class="sprh"><span class="ezt"><small>${label(phases[session.phase])} · ${session.set || '—'} / ${session.total || '—'}</small>
        <b>${label(item.name || workout?.title)}</b><em>${label(item.scheme)}</em></span>
        <button class="glass ib" data-practice-action="finish" aria-label="Завершить тренировку">${spI.x}</button></div>
      ${session.clock ? `<div class="glass spman" data-sport-ring style="--p:${ratio}"><span>${isWork ? ic.dumbbell : spI.clock}</span>
        <b data-sport-clock>${clockText(session.remainingSeconds)}</b><small>${session.paused ? 'Пауза' : label(phases[session.phase])}</small></div>` : ''}
      <div class="spctl glow-sport-actions">${controls}</div>
      ${session.next ? `<div class="spnext"><small>Далее</small><b>${label(session.next.name)}</b><span>${label(session.next.scheme)}</span></div>` : ''}
      <div class="glow-sport-actions">${isWork && session.block === 'main' ? practiceButton('camera', 'Камера', spI.eye) : ''}${practiceButton('technique', 'Техника', spI.eye)}${practiceButton('skip', 'Пропустить упражнение', spI.skip)}</div>
      ${session.error ? practiceMessage(session.error) : ''}</div>`;
  }
  let clockTimer;
  const stopClock = () => { clearInterval(clockTimer); clockTimer = null; };
  async function clockAction(action, kind = 'clock') {
    const session = model?.session;
    if (!session?.active) return;
    return send({ kind, action, workoutKey: session.workoutKey, stepKey: session.stepKey });
  }
  async function openCamera() {
    const session = model?.session;
    if (session?.phase !== 'work' || session.block !== 'main') return;
    const lease = source;
    const active = () => lease === source && lease.isCurrent() && curId() === 'sprun' && model?.session?.stepKey === session.stepKey;
    if ((!session.paused && !await clockAction('pause')) || !active()) return;
    const [, programId, workoutId] = session.workoutKey.split('|');
    const row = envelope().catalog[programId]?.workouts?.[workoutId];
    const exercise = row?.blocks.flatMap(block => block.exercises)
      .find(item => item.id === session.exercise.id && item.name === session.exercise.name);
    camera.open({ session, catalogId: exercise?.exercise_id || session.exercise.id, active, save: measurement =>
      send({ kind: 'clock', action: 'completeNow', workoutKey: session.workoutKey, stepKey: session.stepKey, measurement }) });
  }
  function bindRun(el) {
    screen = el;
    delegatePractice(el, {
      back: () => pop(), retry,
      play: () => clockAction('resume'), pause: () => clockAction('pause'),
      complete: () => clockAction('completeNow'), next: () => clockAction('skipRest'),
      skip: () => clockAction('skipExercise'), continue: () => clockAction('continueBlock', 'session'),
      technique: () => { const session = model.session; showExercise(null, session?.exercise); },
      camera: openCamera,
      finish() {
        const workout = workoutBy(model.session?.workoutKey);
        confirmMore('Завершить тренировку?', workout?.title, 'Сохранить результат', () => clockAction('finish', 'session'));
      },
    });
    if (!clockTimer) clockTimer = setInterval(() => { if (curId() === 'sprun' && !document.hidden && model?.session?.active) void owner?.tick(); }, 250);
  }
  function profileScreen() {
    const profile = model?.profile;
    if (!profile) return practiceMessage(problem || 'Загружаем профиль…', !!problem);
    return moreList(moreRow(spI.user, 'Анкета', 'Параметры тренировок', 'data-practice-action="edit-profile"')
      + moreRow(spI.box, 'Инвентарь', 'Доступное оборудование', 'data-practice-action="edit-equipment"')
      + moreRow(spI.target, 'Мышцы', 'Приоритеты программы', 'data-practice-action="edit-muscles"')
      + moreRow(spI.clock, 'Замеры', 'История замеров', 'data-practice-action="measurements"'));
  }
  function measurements() {
    const fields = model.profile.measurementFields.filter(field => !field.archived);
    openSy('<div class="syh">Замеры</div>' + (fields.length ? moreList(fields.map((field, index) =>
      moreRow(spI.clock, field.label || field.title || field.id, field.history[0]?.value,
        `data-practice-action="measurement" data-index="${index}"`)).join('')) : moreEmpty('Нет полей для замеров')), sheet => {
      delegatePractice(sheet, { measurement: button => {
        const field = fields[Number(button.dataset.index)];
        if (!field) return;
        const title = field.label || field.title || field.id;
        moreForm(title, moreInput('Значение', 'value', '', 'required maxlength="120"'), values =>
          send({ kind: 'profile', action: 'saveMeasurement', draftId: crypto.randomUUID(),
            changes: { fieldId: field.id, value: values.get('value') } }), {
          extra: field.history.length ? moreList(field.history.slice(0, 12).map(row =>
            `<div class="syrow in"><b>${label(row.value)}</b><small>${label(practiceDay(row.recordedAt?.slice(0, 10)))}</small></div>`).join('')) : '',
        });
      } });
    });
  }
  function profileEdit(action) {
    const profile = model.profile;
    let fields, make;
    if (action === 'saveFields') {
      fields = profile.fields.map(field => field.choices ? moreField(field.label,
        `<select name="${field.key}">${moreOptions([['', '—'], ...field.choices.map(choice => [choice, choice])], field.value ?? '')}</select>`)
        : field.type === 'textarea' ? moreField(field.label,
          `<textarea name="${field.key}" maxlength="4000">${label(field.value ?? '')}</textarea>`)
          : moreInput(field.label, field.key, field.value ?? '', field.type === 'date' ? 'type="date"'
            : field.type === 'range' ? `type="number" min="${field.min}" max="${field.max}" step="${field.step}"` : 'maxlength="4000"')).join('');
      make = data => Object.fromEntries(data);
    } else if (action === 'saveEquipment') {
      fields = profile.equipmentItems.map(item => {
        const entry = profile.equipment?.[item.id];
        const toggle = moreField(item.label, `<input type="checkbox" name="${item.id}"${entry?.has ? ' checked' : ''}>`);
        const weight = item.weighed ? moreInput('Вес, кг', 'kg-' + item.id, entry?.kg ?? '', 'type="number" min="0" step="any"') : '';
        const type = item.kinds ? moreField('Вид', `<select name="kind-${item.id}">${moreOptions([['', '—'], ...item.kinds.map(kind => [kind.id, kind.label])], entry?.kind || '')}</select>`) : '';
        return toggle + weight + type;
      }).join('');
      make = data => ({ equipment: Object.fromEntries(profile.equipmentItems.map(item => {
        const kg = data.get('kg-' + item.id), kind = data.get('kind-' + item.id);
        return [item.id, { has: data.has(item.id), ...(kg !== null ? { kg: kg === '' ? null : Number(kg) } : {}), ...(kind ? { kind } : {}) }];
      })) });
    } else {
      fields = `<div class="glass spchips spcard glow-muscles" role="group" aria-label="Акцент на мышцы">${profile.muscleGroups.map(item =>
        `<label><input type="checkbox" name="${label(item.id)}"${profile.targetMuscles.includes(item.id) ? ' checked' : ''}><span class="chip">${label(item.label)}</span></label>`).join('')}</div>`;
      make = data => ({ targetMuscles: [...data.keys()] });
    }
    moreForm(action === 'saveMuscles' ? 'Акцент на мышцы' : 'Настройки спорта', fields,
      data => send({ kind: 'profile', action, draftId: crypto.randomUUID(), changes: make(data) }));
  }
  function suspend() { stopClock(); camera.close(true); planner.leave(); if (model?.session?.active) void owner?.suspend(); }
  window.addEventListener('pagehide', suspend);
  function resume() {
    if (curId() === 'sprun' && screen) bindRun(screen);
    if (curId() === 'spchat') planner.bind($('.screen[data-s="spchat"]'));
  }
  window.addEventListener('flow:resume', resume);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resume(); });
  return {
    prototype: { modern, workouts, today, start, retry, send, core: () => core, view: () => model,
      problem: () => problem || modern.error(),
      state: () => model && envelope().state,
      request: async (op, args) => {
        const host = source;
        if (!host?.isCurrent()) throw Error('Подключение Спорта изменилось');
        const reply = await host.request(op, args);
        if (host !== source || !host.isCurrent()) throw Error('Подключение Спорта изменилось');
        if (reply?.ok === false) throw Error(reply.error || 'Действие не подтверждено');
        return reply;
      },
      context: () => {
        const value = envelope();
        return core.buildTrainingContext({ ...value.state, tests: value.state.tests || {} },
          resolveWorkouts(core, value).visible, core.programDaySince(value.startedOn || today()), 7, false, true);
      },
    },
    tile: () => { const rows = byDate(today()), done = rows.length > 0 && rows.every(row => row.finished);
      return { detail: done ? 'Выполнено' : model?.session?.active ? 'Тренировка идёт' : '', done,
        fraction: progress(rows.reduce((sum, row) => sum + count(row), 0), rows.reduce((sum, row) => sum + total(row), 0)) }; },
    open, render, bind, suspend,
    leave: from => { if (from === 'sprun') suspend(); if (from === 'spchat') planner.leave(); },
    title: id => id === 'sprun' ? 'Тренировка' : id === 'spchat' ? 'Новая программа' : 'Настройки спорта',
    screen: id => id === 'sprun' ? renderRun() : id === 'spchat' ? planner.render() : profileScreen(),
    bindScreen(id, el) {
      if (id === 'sprun') { signature = null; bindRun(el); return; }
      if (id === 'spchat') { planner.bind(el); return; }
      delegatePractice(el, { retry, 'edit-profile': () => profileEdit('saveFields'), 'edit-equipment': () => profileEdit('saveEquipment'),
        'edit-muscles': () => profileEdit('saveMuscles'), measurements });
    },
  };
}
