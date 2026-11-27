import { label, progress } from './glow-practice-ui.mjs';
import { spShapes } from './practice/sport-figure-shapes.mjs';

const button = (action, content, cls, attrs = '') => `<button type="button" class="${cls}" data-sr="${action}" ${attrs}>${content}</button>`;
const compact = (action, icon, title) => button(action, icon, 'glass ib', `aria-label="${title}"`);
const more = () => LI('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>');
const loadText = exercise => exercise.load
  ? `${exercise.load.units ? exercise.load.units + ' × ' : ''}${String(exercise.load.kg).replace('.', ',')} кг`
  : exercise.bodyweight ? 'Свой вес' : '';
const objective = exercise => exercise.mode === 'timed' ? exercise.work_seconds + ' с' : exercise.reps || exercise.target || '—';

function header(model, workout, camera) {
  const bars = workout.blocks.flatMap(block => block.exercises).map(exercise => {
    const rows = model.projection.sets.filter(row => row.plan_exercise_id === exercise.plan_exercise_id);
    const done = rows.filter(row => row.status === 'confirmed').length;
    return `<i class="${done >= exercise.sets ? 'ok' : exercise === model.current.exercise || exercise.plan_exercise_id === model.current.plan_exercise_id ? 'cur' : ''}" style="--p:${progress(done, exercise.sets)}"></i>`;
  }).join('');
  return `<header class="splh2 glow-workout-head">${compact('close-menu', spI.x, 'Завершить или свернуть')}
    <div class="sprtop" aria-hidden="true">${bars}</div>
    ${camera ? compact('camera-coach', spI.eye, 'Тренер по камере') : ''}${compact('menu', more(), 'Действия тренировки')}</header>`;
}

function figure(exercise) {
  const figures = window.SportFigures;
  if (!figures) return '';
  const primary = spShapes(exercise.muscles?.primary || []);
  const secondary = spShapes(exercise.muscles?.secondary || []);
  const layers = ['i', 's', 'p'].map(tone => Object.entries(figures.MUSCLE_SHAPES).filter(([id]) => {
    const layer = primary.has(id) ? 'p' : secondary.has(id) ? 's' : 'i';
    return layer === tone;
  }).flatMap(([, shape]) => shape.paths.map(path => `<path class="z ${tone}" d="${path}"/>`)).join('')).join('');
  return `<svg class="spfig" viewBox="${figures.FIGURE_VIEWBOX}" aria-hidden="true">${figures.SILHOUETTE.map(shape =>
    `<path class="sk" d="${shape.d}"/>`).join('')}${layers}</svg>`;
}

function setup(model, workout, technique) {
  const { exercise } = model.current;
  const rows = workout.blocks.flatMap(block => block.exercises);
  const index = rows.findIndex(row => row.plan_exercise_id === model.current.plan_exercise_id);
  const media = spGid({ id: exercise.exercise_id, n: exercise.name });
  return `<div class="glass spig${media ? ' real' : ''}">${media ? spMedia(media, 'Техника: ' + label(exercise.name)) : ''}
    <div class="glow-workout-figure" data-sr-figure="current"></div></div><div class="spii">
    <span class="ezt"><small>Упражнение ${Math.max(1, index + 1)} из ${rows.length}</small><b>${label(exercise.name)}</b></span>
    <div class="spich">${[`${exercise.sets} × ${objective(exercise)}`, loadText(exercise), `отдых ${exercise.rest_seconds || 0} с`]
      .filter(Boolean).map(text => `<span>${label(text)}</span>`).join('')}</div>
    <div class="glow-workout-technique">${technique(exercise).replace('<ol>', '<ol class="spit">')}</div>
    <div class="spib"><div class="sr-timer glow-workout-clock">${button('pause', '<b>0:00</b><small></small>', 'sr-clock btn glass', model.paused ? 'aria-label="Продолжить"' : 'aria-label="Пауза"')}</div>
      ${button('start', `${spI.play}Начать подход`, 'btn main')}</div></div>`;
}

function work(model, inline, target) {
  const { exercise, set_index: set } = model.current;
  const title = button('tech', `<span class="ezt"><small>Подход ${set} / ${exercise.sets}</small><b>${label(exercise.name)}</b><em>${label(loadText(exercise))}</em></span>`, 'sprh glow-workout-title', 'aria-label="Техника и мышцы"');
  const main = inline ? `<div class="glass spcam glow-workout-camera" data-sr-swipe>${inline}</div>`
    : `<div class="glass spman" data-sr-swipe><span>${ic.dumbbell}</span><b>${label(objective(exercise).replace(/ с$/, ''))}</b><small>${exercise.mode === 'timed' ? 'секунд' : 'повторов'}</small></div>`;
  const controls = `<div class="spctl sr-timer glow-workout-clock" data-sr-swipe><div class="sr-clock glass"><b>0:00</b><small></small></div>
    ${compact('pause', model.paused ? spI.play : spI.pause, model.paused ? 'Продолжить' : 'Пауза')}</div>
    ${button('done', `${ic.check}${exercise.mode === 'timed' ? 'Закончить раньше' : 'Подход выполнен'}`, 'btn main sygo')}`;
  return `${title}${main}${controls}${nextRow(model.next, target)}`;
}

function nextRow(next, target) {
  return next ? `<div class="spnext"><small>Далее</small><b>${label(next.exercise.name)}</b><span>${label(target(next.exercise))}</span>
    <small class="sr-loadout" data-sr-loadout hidden></small></div>` : '';
}

function rest(model, result, swipeHint, target) {
  return `<div class="plate-w timer crt sprest sr-timer" data-glow-rest data-sr-swipe><div class="halo"></div><div class="plate">
    <div class="fill"></div><i class="scan"></i><div class="lbl">Отдых</div>
    ${button('pause', '<b class="lit">0</b><small hidden></small><sup class="rgbt">с</sup>', 'num sr-clock', 'aria-label="Таймер отдыха"')}${swipeHint}</div></div>
    <div class="ctrl sprctl">${button('adjust', '−15', 'btn glass', 'data-value="-15" aria-label="Минус 15 секунд"')}
      ${button('pause', model.paused ? spI.play : spI.pause, 'btn glass', `aria-label="${model.paused ? 'Продолжить' : 'Пауза'}"`)}
      ${button('adjust', '+15', 'btn glass', 'data-value="15" aria-label="Плюс 15 секунд"')}
      ${button('advance', spI.skip, 'btn main', 'aria-label="Записать и пропустить отдых"')}</div>
    ${result}${nextRow(model.next, target)}`;
}

function workout({model, workout, camera, technique, inline, result, swipeHint, target}) {
  const phase = model.phase;
  const content = phase === 'preparing' ? setup(model, workout, technique)
    : phase === 'rest' ? rest(model, result, swipeHint, target) : work(model, inline, target);
  return `<div class="sprun glow-workout ${phase === 'preparing' ? 'intro' : phase === 'rest' ? 'resting' : 'working'}">${header(model, workout, camera)}${content}</div>`;
}

function summary({completed, saved, title, workout, seconds, sets, menu, info, edit, difficultyBlock, coach, recover, actions}) {
  const total = workout.blocks.flatMap(block => block.exercises).reduce((sum, item) => sum + item.sets, 0);
  const confirmed = sets.filter(item => item.status === 'confirmed').length;
  const duration = seconds < 60 ? `${seconds} с` : `${Math.floor(seconds / 60)} мин`;
  return `<header class="sh-head glow-workout-head"><h2>${label(title)}</h2>${menu}</header><div class="sr-body glow-workout-summary">
    <div class="glass ezhero spfin"><div class="ezh1">${ezRing(progress(confirmed, total), 'var(--a4)', completed ? ic.check : spI.clock)}
      <span class="ezt"><b>${label(workout.title)}</b><em>${confirmed} из ${total} подходов · ${duration}</em></span></div></div>
    ${edit}${saved ? coach : ''}${difficultyBlock}${info.list}${recover}</div><footer class="sr-foot sh-foot">${actions}</footer>`;
}

export const glowWorkout = {
  mount(dialog) {
    phone.classList.toggle('land', !!SPD.land && matchMedia('(min-width: 860px)').matches);
    dialog.show();
  },
  unmount() { phone.classList.remove('land'); },
  workout, summary, figure,
};
