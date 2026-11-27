import { label } from './glow-practice-ui.mjs';

const shape = { quads: 'legs', hamstrings: 'legs', calves: 'legs', adductors: 'legs', hip_flexors: 'legs', glutes: 'glutes',
  chest: 'chest', chest_upper: 'chest', chest_mid: 'chest', chest_lower: 'chest', lats: 'back', mid_back: 'back', lower_back: 'back',
  delts_front: 'shoulders', delts_side: 'shoulders', delts_rear: 'shoulders', abs: 'abs', abs_upper: 'abs', abs_lower: 'abs',
  obliques: 'abs', arms: 'arms', biceps: 'arms', triceps: 'arms', forearms: 'arms' };

export function prototypeExercise(raw, index) {
  const exercise = raw.raw || raw;
  const code = String(exercise.exercise_id || raw.catalogId || '').replace(/^(bw|db|bb)_/, '');
  const id = Object.hasOwn(SPGIF, code) ? code : '';
  const camera = { pushup: 'pushup', squat: 'squat', plank: 'plank', lateral: 'lateral' }[id];
  return { id, i: index, n: label(exercise.name), s: Number(exercise.sets) || 1,
    r: label(exercise.reps ?? exercise.target ?? '—'), hold: exercise.mode === 'timed' ? Number(exercise.work_seconds) : 0,
    kg: Number(exercise.load?.kg) || 0, m: label(exercise.muscles?.label || ''), cam: camera,
    z: [...(exercise.muscles?.primary || []), ...(exercise.muscles?.secondary || [])].map(key => shape[key]).filter(Boolean) };
}

export function prototypeWorkout({ request, refresh } = {}) {
  const original = R.sprun;
  let box, act, withoutCamera = false, leave, finishHTML, islandClock;
  function publishRest(next) {
    if (islandClock?.seconds === next?.seconds && islandClock?.paused === next?.paused
      && islandClock?.exercise === next?.exercise) return;
    islandClock = next;
    window.dispatchEvent(new CustomEvent('flow:glow-rest', { detail: next }));
  }
  const previousDay = spDay;
  const onFinishClose = () => { finishHTML = syOnClose = null; void act?.('panel-close'); };
  function clearFinish() {
    finishHTML = null;
    if (syOnClose !== onFinishClose) return;
    syOnClose = null;
    closeSy();
  }
  function mount(dialog, dispatch) {
    withoutCamera = false;
    box = dialog;
    act = dispatch;
    if (curId() !== 'sprun') go('sprun');
    const screen = $('.screen[data-s="sprun"]');
    screen.append(dialog);
    dialog.classList.add('prototype-sport-run');
    dialog.show();
    leave = new MutationObserver(() => {
      if (box && curId() !== 'sprun') void act('dismiss');
    });
    leave.observe(screen, { attributes: true, attributeFilter: ['class'] });
  }
  function unmount() {
    leave?.disconnect();
    clearFinish();
    box = act = null;
    publishRest(null);
    if (curId() === 'sprun') queueMicrotask(() => { if (!box && curId() === 'sprun') pop(); });
  }
  function workout({ model, workout, technique, inline, camera }) {
    const raw = workout.blocks.flatMap(block => block.exercises);
    const exercises = raw.map(prototypeExercise);
    const rows = model.projection.sets;
    const previous = model.prior;
    const rest = model.phase === 'rest';
    const index = raw.findIndex(row => row.plan_exercise_id === (rest ? previous.plan_exercise_id : model.current.plan_exercise_id));
    const exercise = raw[index];
    const last = rows.filter(row => row.plan_exercise_id === exercise.plan_exercise_id && row.status === 'confirmed');
    const log = [];
    if (rest) {
      for (const row of last) log[row.set_index - 1] = { r: row.actual_reps ?? row.actual_seconds ?? '—', kg: row.actual_kg ?? '—' };
      log[previous.set_index - 1] ??= { r: '—', kg: '—' };
    }
    const cameraOn = !!camera && !withoutCamera;
    if (!exercises[index].cam && cameraOn) exercises[index].cam = 'manual';
    const phase = rest ? 'rest' : model.phase === 'preparing' ? 'intro' : 'set';
    Object.assign(SPR, { i: index, phase, on: 1, perm: false, big: false, kg: {}, rp: {}, rir: previous?.rir ?? -1,
      done: raw.map(item => rows.filter(row => row.plan_exercise_id === item.plan_exercise_id && row.status === 'confirmed').length),
      last: rest ? index : null, log: { [index]: log } });
    const cameraSetting = SPD.cam;
    const timer = { ...TM };
    SPD.cam = cameraOn;
    if (rest) TM.left = Math.max(0, Math.ceil(model.remainingMs / 1000));
    spDay = () => exercises;
    const view = document.createElement('template');
    try { view.innerHTML = original(); }
    finally { SPD.cam = cameraSetting; Object.assign(TM, timer); spDay = previousDay; }
    const root = view.content;
    const bind = (selector, action) => root.querySelectorAll(selector).forEach(node => { node.dataset.sr = action; });
    bind('#spGo', 'start'); bind('#spDone', 'done'); bind('[data-spintro]', 'tech');
    bind('[data-spl="back"]', 'dismiss'); bind('[data-spl="x"]', 'close-menu');
    bind('[data-spcam="perm"]', 'camera-coach');
    root.querySelectorAll('[data-spcam="off"]').forEach(node => { node.dataset.prototypeCameraOff = ''; });
    const inlineHost = root.querySelector('.spcam');
    if (inlineHost && inline) {
      inlineHost.innerHTML = inline;
      inlineHost.dataset.srSwipe = '';
    }
    const steps = root.querySelector('.spit');
    if (steps) {
      const instructions = technique(exercise).replace(/^<ol>|<\/ol>$/g, '');
      if (instructions.startsWith('<li>')) steps.innerHTML = instructions;
      const restChip = root.querySelector('.spich span:last-child');
      if (restChip) restChip.textContent = `отдых ${exercise.rest_seconds || 0} с`;
    }
    const seconds = Math.max(0, Math.ceil(model.remainingMs / 1000));
    if (model.phase === 'preparing') {
      root.querySelector('.spich').insertAdjacentHTML('beforeend',
        `<span class="spready"${seconds ? '' : ' hidden'}>Подготовка <b data-sport-clock>${seconds}</b> с</span>`);
    } else if (model.timedWork) {
      const counter = root.querySelector('.spman > b');
      const number = `<span data-sport-clock>${seconds}</span><small class="prototype-clock-unit">с</small>`;
      if (counter) {
        counter.innerHTML = number;
        counter.nextElementSibling.textContent = 'Удержание';
      } else inlineHost?.insertAdjacentHTML('beforebegin',
        `<div class="glass spwork-clock"><span>Удержание</span><b>${number}</b></div>`);
      root.querySelector('#spDone').disabled = model.elapsedMs < 1000;
    }
    const previousGuess = root.querySelector('.spprev');
    previousGuess?.remove();
    root.querySelectorAll('[data-spiswap],[data-spgif]').forEach(button => { button.disabled = true; });
    if (rest) {
      if (model.next?.exercise.mode === 'timed' && model.next.set_index === 1 && model.next.plan_exercise_id !== previous.plan_exercise_id) {
        const clock = root.querySelector('#timerW');
        clock.dataset.sportNext = raw.find(item => item.plan_exercise_id === model.next.plan_exercise_id)?.name || '';
      }
      const resultCells = root.querySelectorAll('.splc > span');
      resultCells.forEach((cell, slot) => {
        const current = slot + 1 === previous.set_index;
        cell.className = current ? 'cur' : log[slot] ? 'ok' : 'nx';
        if (current) cell.dataset.prototypeResult = '';
      });
      bind('[data-sprt="skip"]', 'advance'); bind('[data-sprt="pause"]', 'pause');
      root.querySelector('.sprest').dataset.srSwipe = '';
      root.querySelector('#tGo').innerHTML = model.paused ? spI.play : spI.pause;
      root.querySelector('#tGo').ariaLabel = model.paused ? 'Продолжить отсчёт' : 'Пауза';
      for (const button of root.querySelectorAll('[data-sprt="15"],[data-sprt="-15"]')) {
        button.dataset.sr = 'adjust'; button.dataset.value = button.dataset.sprt;
      }
      for (const button of root.querySelectorAll('[data-sprir]')) {
        button.dataset.sr = 'rir'; button.dataset.value = button.dataset.sprir;
      }
    }
    for (const step of root.querySelectorAll('[data-spstep]')) {
      const field = ['kg', 'lkg'].includes(step.dataset.spstep) ? 'weight' : exercise.mode === 'timed' ? 'seconds' : 'reps';
      step.dataset.prototypeField = field;
      for (const button of step.querySelectorAll('button')) {
        Object.assign(button.dataset, { sr: 'step', field, delta: button.dataset.d });
      }
    }
    root.querySelector('canvas#spGif')?.parentElement.querySelector('small')?.remove();
    root.querySelector('canvas#spGif')?.remove();
    return view.innerHTML;
  }
  function summary({ completed, saved, title, workout, seconds, sets, edit, difficultyBlock, recover, actions, sessionId, difficulty }) {
    SPR.phase = completed ? 'done' : 'rest';
    const exercises = workout.blocks.flatMap(block => block.exercises);
    const count = sets.filter(set => set.status === 'confirmed').length;
    const total = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
    const duration = seconds < 60 ? `${seconds} с` : `${Math.floor(seconds / 60)} мин`;
    const view = document.createElement('template');
    view.innerHTML = `<div class="sprun fin">${spDoneHTML(exercises.map(prototypeExercise))}</div>`;
    const root = view.content.firstElementChild;
    for (const demo of root.querySelectorAll('.spwin,.span,.sptip')) demo.remove();
    const header = root.querySelector('.ezh1');
    header.firstElementChild.outerHTML = ezRing(total ? count / total : 0, '#5dff9e', completed ? ic.check : spI.clock);
    header.querySelector('.ezt > small').textContent = title;
    header.querySelector('.ezt > b').textContent = workout.title;
    header.querySelector('.ezt > em').textContent = `${count} из ${total} подходов`;
    const stats = root.querySelector('.ezsteps');
    const weighted = sets.filter(set => set.status === 'confirmed' && set.actual_kg != null && set.actual_reps != null);
    const volume = weighted.reduce((sum, set) => sum + set.actual_kg * set.actual_reps * (set.actual_weight_basis === 'per_dumbbell' ? (set.actual_units || 1) : 1), 0);
    stats.innerHTML = [[spI.clock, duration, 'время'], [spI.trophy, `${count}/${total}`, 'подходы'],
      [spI.heart, '—', 'пульс'], [spI.bolt || spI.today, weighted.length ? `${spFmt(Math.round(volume * 10) / 10)} кг` : '—', 'объём']]
      .map(([icon, value, name]) => `<span>${icon}<b>${value}</b><small>${name}</small></span>`).join('');
    const results = exercises.map((exercise, index) => {
      const planned = prototypeExercise(exercise, index);
      const slots = Array.from({ length: planned.s }, (_, i) => {
        const set = sets.find(row => row.plan_exercise_id === exercise.plan_exercise_id && row.set_index === i + 1);
        const value = set?.status === 'confirmed' ? resultText(set.actual_kg, set.actual_reps ?? set.actual_seconds, !!planned.hold) : '—';
        return `<span class="${set?.status === 'confirmed' ? 'ok' : 'nx'}" aria-label="Подход ${i + 1}: ${label(value)}">${label(value)}</span>`;
      });
      return `<div class="glass splog"><div class="splh"><span class="ezt"><small>План · ${spScheme(planned)}</small><b>${planned.n}</b></span></div><div class="splc">${slots.join('')}</div></div>`;
    }).join('');
    const detail = document.createElement('template');
    const review = `${results}${edit}${difficultyBlock ? `<details class="glass prototype-summary-difficulty"><summary>Сложность тренировки</summary>${difficultyBlock}</details>` : ''}${recover}`;
    if (completed) {
      const core = window.SportCore;
      const rir = sets.map(row => row.rir).filter(Number.isInteger);
      const tip = core.pickCoachTip(core.sessionTrigger({ difficulty, minRir: rir.length ? Math.min(...rir) : null }), core.todayKey());
      const tipHTML = tip ? spTipHTML({ tp: tip.topic, t: label(tip.title), x: label(tip.text), src: tip.cites.map(source => label(source.cite)) }, 'summary', false) : '';
      detail.innerHTML = `${saved ? `<div class="glass span run" data-sport-analysis="${label(sessionId)}"><span class="sptiph"><span class="spcav sm">${spI.spark}</span><small>Разбор тренировки</small></span><p>Загружаем разбор…</p></div>` : ''}${tipHTML}
        <div class="prototype-summary-actions">${actions}</div>`;
    } else detail.innerHTML = `${review}<div class="ezbtns prototype-summary-actions">${actions}</div>`;
    for (const button of detail.content.querySelectorAll('.ghost-button')) button.className = 'btn glass sygo';
    root.querySelector('#spFin').replaceWith(detail.content);
    return view.innerHTML;
  }
  async function showAnalysis(node, left = 8) {
    try {
      const { job } = await request('analysis_status', { session_id: node.dataset.sportAnalysis });
      if (!node.isConnected) return;
      const pending = job && ['queued', 'running'].includes(job.status);
      const heading = { proposed: 'Тренер предлагает на следующую', published: 'План обновлён',
        queued: 'Тренер разбирает тренировку', running: 'Тренер разбирает тренировку' }[job?.status] || 'Разбор тренировки';
      const changes = (job?.changes || []).slice(0, 5);
      const names = { load: 'вес', reps: 'повторы', seconds: 'время', sets: 'подходы', rest: 'отдых' };
      const value = input => typeof input === 'object' && input !== null ? input.kg ?? '—' : input ?? '—';
      node.classList.toggle('run', !!pending);
      node.innerHTML = `<span class="sptiph"><span class="spcav sm">${spI.spark}</span><small>${heading}</small></span>
        ${pending ? '<div class="spanbar"><i></i></div><p>Экран можно закрыть</p>' : `<b>${label(job?.summary || 'Предложений пока нет')}</b>`}
        ${changes.length ? `<div class="spdiff">${changes.map(row => `<div><span>${label(row.exercise_name || row.name || 'Упражнение')}<small>${label(names[row.field] || row.field)}</small></span><b>${label(value(row.before))} → ${label(value(row.after))}</b></div>`).join('')}</div>` : ''}
        ${job?.status === 'proposed' ? '<div class="spanb"><button class="btn sm main" data-sport-analysis-apply>Применить</button><button class="btn sm glass" data-sport-analysis-why>Почему</button></div>' : ''}`;
      if (pending && left > 0) setTimeout(() => { if (node.isConnected) void showAnalysis(node, left - 1); }, 2500);
      node.querySelector('[data-sport-analysis-why]')?.addEventListener('click', () =>
        openSy(`<div class="syh">Почему так</div><div class="glass spwhy">${(job.changes || []).map(row => `<p>${label(row.reason || row.exercise_name || '')}</p>`).join('') || `<p>${label(job.summary)}</p>`}</div>`));
      node.querySelector('[data-sport-analysis-apply]')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
          const result = await request('analysis_confirm', { job_id: job.id, expected_version: job.base_version, expected_revision: job.revision });
          if (result.status !== 'published') throw Error('План не обновлён');
          await refresh();
          if (node.isConnected) await showAnalysis(node, 0);
        } catch (error) { toast(error.message); button.disabled = false; }
      });
    } catch {
      if (node.isConnected) {
        node.classList.remove('run');
        node.innerHTML = `<span class="sptiph"><span class="spcav sm">${spI.spark}</span><small>Разбор тренировки</small></span><p>Разбор недоступен</p>`;
      }
    }
  }
  function resultText(kg, amount, timed) {
    const value = amount == null ? '—' : spFmt(amount) + (timed ? ' с' : '');
    return kg == null ? value : `${spFmt(kg)} × ${value}`;
  }
  function finishMarkup({ total, confirmed, openStatus, phase, abandon }) {
    if (abandon) return `<template data-sr-panel data-prototype-finish><div class="syh">Отменить тренировку?<small>Тренировка не попадёт в историю</small></div>
      <div class="glass list"><button class="rw" data-sport-finish="confirm-abandon"><span class="ic" style="--tc:#ff6b4a">${spI.x}</span><span><b>Отменить тренировку</b></span></button></div>
      <button class="btn glass sygo" data-sport-finish="panel-close">Оставить тренировку</button></template>`;
    const view = document.createElement('template');
    view.innerHTML = spFinishHTML(confirmed, total);
    const root = view.content;
    const save = root.querySelector('[data-spq="save"]');
    save.dataset.sportFinish = 'review';
    root.querySelector('[data-spq="drop"]').dataset.sportFinish = 'ask-abandon';
    root.querySelector('[data-spq="back"]').dataset.sportFinish = 'panel-close';
    if (openStatus === 'blocked' || openStatus === 'empty') {
      save.dataset.sportFinish = openStatus === 'blocked' ? 'go-to-set' : 'skip-set';
      save.querySelector('b').textContent = openStatus === 'blocked' ? 'Вернуться к подходу' : 'Закрыть пустой подход';
      save.querySelector('small').textContent = openStatus === 'blocked' ? 'Сначала завершите текущий подход' : 'Этот подход останется без результата';
    } else if (phase === 'preparing') save.disabled = true;
    return `<template data-sr-panel data-prototype-finish>${view.innerHTML}</template>`;
  }
  return { mount, unmount, workout, summary, figure: () => '', workDraft: true,
    cancelled: pending => toast(pending ? 'Отмена тренировки в очереди' : 'Тренировка отменена'),
    finishMarkup,
    closeMenu: () => act?.('close-menu'),
    paintClock(dialog, model) {
      const seconds = String(Math.max(0, Math.ceil(model.remainingMs / 1000)));
      const counter = dialog?.querySelector('[data-sport-clock]');
      if (counter) {
        if (counter.textContent !== seconds) counter.textContent = seconds;
        if (model.phase === 'preparing') counter.parentElement.hidden = seconds === '0';
        if (model.timedWork) {
          const done = dialog.querySelector('#spDone');
          const tooEarly = model.elapsedMs < 1000;
          if (done.disabled !== tooEarly) done.disabled = tooEarly;
        }
      }
      const clock = dialog?.querySelector('#timerW');
      publishRest(model.phase === 'rest' && clock ? { seconds: Number(seconds), paused: model.paused,
        exercise: model.current?.exercise?.name || '', toggle: () => dialog.querySelector('#tGo[data-sr]')?.click() } : null);
      if (!clock) return;
      const caption = clock.querySelector('.lbl');
      const title = clock.dataset.sportNext && Number(seconds) <= 5 ? `Подготовка · ${clock.dataset.sportNext}` : 'Отдых';
      if (caption.textContent !== title) caption.textContent = title;
      const number = clock.querySelector('#sec');
      if (number.textContent !== seconds) number.textContent = seconds;
      const fill = model.limit ? Math.max(0, Math.min(1, model.remainingMs / model.limit)).toFixed(3) : '0';
      if (clock.style.getPropertyValue('--lvl') !== fill) clock.style.setProperty('--lvl', fill);
    },
    paintDraft(dialog, draft, idea, model) {
      const prior = model.phase === 'rest' ? model.prior : null;
      const confirmed = prior?.status === 'confirmed';
      const valueFor = (key, actual) => Object.hasOwn(draft, key) ? draft[key] : confirmed ? actual : idea[key];
      const weight = valueFor('weight', prior?.actual_kg);
      const reps = valueFor('reps', prior?.actual_reps);
      const seconds = valueFor('seconds', prior?.actual_seconds);
      for (const step of dialog.querySelectorAll('[data-prototype-field]')) {
        const field = step.dataset.prototypeField;
        const number = step.querySelector('b').firstChild;
        const value = spFmt(({ weight, reps, seconds })[field] ?? '—');
        if (number.nodeValue !== value) number.nodeValue = value;
        if (model.phase === 'work' && !model.timedWork && field !== 'weight') {
          const target = dialog.querySelector('.spman > b');
          if (target && target.textContent !== value) target.textContent = value;
        }
      }
      const cell = dialog.querySelector('[data-prototype-result]');
      if (cell && prior) {
        const timed = model.current.exercise.mode === 'timed';
        const weighted = !timed && !model.current.exercise.bodyweight;
        const text = resultText(weighted ? weight : null, timed ? seconds : reps, timed);
        if (cell.textContent !== text) cell.textContent = text;
        const heading = dialog.querySelector('.splh small');
        const status = confirmed ? 'Записано' : 'Подход';
        const caption = `${status} · ${prior.set_index} из ${model.current.exercise.sets}`;
        if (heading.textContent !== caption) heading.textContent = caption;
      }
      for (const button of dialog.querySelectorAll('[data-sprir]')) {
        const active = Number(button.dataset.value) === draft.rir;
        button.classList.toggle('on', active);
        if (button.ariaPressed !== String(active)) button.ariaPressed = String(active);
      }
    },
    rendered(dialog) {
      const finish = dialog.querySelector('template[data-prototype-finish]');
      if (!finish) clearFinish();
      else if (finishHTML !== finish.innerHTML || syOnClose !== onFinishClose) {
        finishHTML = finish.innerHTML;
        openSy(finishHTML, sheet => {
          for (const button of sheet.querySelectorAll('[data-sport-finish]')) button.onclick = () => act?.(button.dataset.sportFinish);
        });
        syOnClose = onFinishClose;
      }
      const start = dialog.querySelector('#spGo');
      if (start) start.onclick = () => { sfx('ok'); buzz(10); blurPulse(8, 400); };
      for (const button of dialog.querySelectorAll('[data-prototype-camera-off]')) button.onclick = () => {
        withoutCamera = true;
        dialog.dispatchEvent(new Event('prototype-sport-refresh'));
      };
      const screen = dialog.querySelector('.sr-screen');
      if (screen) stagger(screen);
      const analysis = dialog.querySelector('[data-sport-analysis]');
      if (analysis) void showAnalysis(analysis);
      const tip = dialog.querySelector('.fin .sptip');
      if (tip) {
        tip.querySelector('[data-sptipx]')?.addEventListener('click', () => tip.remove());
        tip.querySelector('[data-sptsrc]')?.addEventListener('click', event => {
          const button = event.currentTarget, open = button.classList.toggle('open');
          button.setAttribute('aria-expanded', String(open)); button.nextElementSibling.classList.toggle('open', open);
        });
      }
      const close = $('#hAct');
      if (curId() === 'sprun' && close) close.hidden = SPR.phase === 'done';
    },
  };
}
