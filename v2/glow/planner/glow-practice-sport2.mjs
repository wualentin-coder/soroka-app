import { glowWorkout } from './glow-practice-workout.mjs';

let runtime;
function loadRunner() {
  if (runtime) return runtime;
  const css = document.createElement('link');
  const history = document.createElement('link');
  const glow = document.createElement('link');
  const js = document.createElement('script');
  css.rel = history.rel = glow.rel = 'stylesheet';
  css.href = new URL('./practice/sport-run.css', import.meta.url).href;
  history.href = new URL('./practice/sport-history.css', import.meta.url).href;
  glow.href = new URL('./glow-practice-workout.css', import.meta.url).href;
  js.src = new URL('./practice/sport-run.js', import.meta.url).href;
  const assets = [css, history, glow, js];
  const loaded = assets.map(node => new Promise((resolve, reject) => {
    node.onload = resolve;
    node.onerror = () => reject(Error('Не удалось загрузить тренировку'));
  }));
  runtime = Promise.all([import('./practice/sport-history.js'), ...loaded]).then(() => {
    if (!window.SportRunReview?.bindConnected) throw Error('Тренировка Спорта 2.0 недоступна');
    return window.SportRunReview;
  }).catch(error => {
    assets.forEach(node => node.remove());
    runtime = null;
    throw error;
  });
  document.head.append(...assets);
  return runtime;
}

export function createGlowSport2({ source, state, today, redraw, presentation = glowWorkout }) {
  let lease, runner, plans = [], sessions = [], open, loading, error = '';
  let results = new Map();
  const sessionKey = row => `${row.id}:${row.results_revision}`;
  const slotKey = row => JSON.stringify([row.date, row.title]);
  const active = () => !!lease?.isCurrent() && source() === lease;
  async function request(op, args = {}) {
    const host = lease;
    if (!active()) throw Error('Подключение Спорта изменилось');
    const result = await host.request(op, args);
    if (host !== lease || !active()) throw Error('Подключение Спорта изменилось');
    if (result?.ok !== true) throw Object.assign(Error(result?.error || 'Спорт 2.0 недоступен'), { reply: result });
    return result;
  }
  async function load() {
    if (loading) return loading;
    const host = lease = source();
    loading = (async () => {
      try {
        const [list, history, live] = await Promise.all([
          request('read_session_plans'), request('list_sessions', { limit: 50 }),
          request('read_session', { open: true }).catch(reason => {
            if (reason.message === 'session_not_found' || reason.status === 404) return null;
            throw reason;
          }),
        ]);
        if (!Array.isArray(list.plans) || !Array.isArray(history.sessions)) throw Error('Спорт 2.0 не вернул планы и историю');
        const details = await Promise.all(list.plans.map(row => request('read_session_plans', { plan_id: row.id })));
        if (host !== lease || !active()) return;
        plans = details.map(detail => detail.plan).filter(plan => Array.isArray(plan?.content?.workouts));
        sessions = history.sessions;
        open = live?.session ? live : null;
        error = '';
        redraw();
        const slots = new Set(plans.flatMap(plan => plan.content.workouts.map(slotKey)));
        const candidates = sessions.filter(row => slots.has(slotKey({ date: row.workout_date, title: row.title })));
        const previous = results;
        const matches = await Promise.all(candidates.map(async row => {
          const key = sessionKey(row);
          const detail = previous.get(key) || await request('read_session', { session_id: row.id }).catch(() => null);
          return [key, detail];
        }));
        if (host === lease && active()) results = new Map(matches.filter(([, detail]) => detail?.session));
      } catch (failure) {
        if (host === lease) error = failure.message;
      } finally {
        if (host === lease) { loading = null; redraw(); }
      }
    })();
    return loading;
  }
  function workouts() {
    const completed = new Map([...results.values()].reverse().map(detail => [detail.session.workout_key, detail]));
    return plans.flatMap(plan => plan.content.workouts.filter(row => row.date).map(row => {
      const result = completed.get(row.workout_key);
      const matching = result?.session.plan_id === plan.id ? result : null;
      const projection = matching?.projection || (open?.session.workout_key === row.workout_key ? open.projection : null);
      const confirmed = new Map();
      for (const set of projection?.sets || []) {
        if (set.status === 'confirmed') confirmed.set(set.plan_exercise_id, (confirmed.get(set.plan_exercise_id) || 0) + 1);
      }
      const blocks = row.blocks.filter(block => !['warmup', 'mobility'].includes(block.type));
      const exercises = (blocks.length ? blocks : row.blocks).flatMap(block => block.exercises).map(item => ({
        id: item.plan_exercise_id, catalogId: item.exercise_id, name: item.name, sets: item.sets,
        technique: item.technique || '', raw: item, scheme: `${item.sets} × ${item.mode === 'timed' ? item.work_seconds + ' с' : item.reps || item.target || '—'}`,
      }));
      return { key: row.workout_key, date: row.date, programTitle: plan.title, title: row.title, raw: row,
        exercises, counts: exercises.map(item => confirmed.get(item.id) || 0), readOnly: row.date > today(), finished: !!matching };
    }));
  }
  async function start(key, button) {
    if (!active()) throw Error('Открой Спорт заново');
    const host = lease;
    const api = await loadRunner();
    if (lease !== host || !active()) throw Error('Подключение Спорта изменилось');
    runner ||= api.bindConnected({ scope: host.owner.scope, current: () => lease === host && active(),
      state, request: (op, args) => host.request(op, args), container: phone, presentation, refresh() { void load(); } });
    const workout = workouts().find(row => row.key === key);
    if (key && !workout) throw Error('Тренировка не найдена в активной программе');
    return runner.open(workout ? { key } : null, button);
  }
  return {
    load, workouts, start, close: () => runner?.close(), request,
    activeWorkout: () => open?.session || runner?.status(),
    activePlan: () => plans[0] || null,
    sessions: () => sessions,
    error: () => error,
    reset() { runner?.dispose(); runner = lease = open = loading = null; plans = []; sessions = []; results = new Map(); error = ''; },
  };
}

