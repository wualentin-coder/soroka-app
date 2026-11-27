import { confirmMore, moreField, moreInput, moreOptions } from './glow-more-ui.mjs';
import { delegatePractice, label, moreEmpty, practiceButton, practiceDay } from './glow-practice-ui.mjs';

const directionOptions = [['profile', 'По анкете'], ['main', 'Сила'], ['splits', 'Растяжка']];
const waiting = draft => ['queued', 'running'].includes(draft?.status);

export function createSportPlan(dependencies) {
  let screen, model, preferences = {}, messages = [], choices = [], options, pending, busy = false, timer, error = '';
  const active = () => screen?.isConnected && curId() === 'spchat' && dependencies.host()?.isCurrent();
  const fields = () => {
    if (!options) {
      const [start, end] = dependencies.dates();
      options = { start, end, direction: 'profile', withHealth: true, brief: '' };
    }
    return options;
  };
  async function request(op, args = {}) {
    const lease = dependencies.host();
    if (!lease?.isCurrent()) throw Error('Открой Спорт заново');
    const answer = await lease.request(op, args);
    if (!lease.isCurrent() || lease !== dependencies.host()) throw Error('Подключение Спорта изменилось');
    return answer;
  }
  function view() {
    if (!dependencies.host()?.isCurrent()) return moreEmpty('Спорт недоступен');
    const draft = fields(), [today, , latest] = dependencies.dates(), profile = dependencies.profile();
    let preview = null, previewError = '';
    if (model?.status === 'ready') {
      try { preview = dependencies.preview(model.json); }
      catch (failure) { previewError = failure.message; }
    }
    const inProgress = waiting(model);
    const status = inProgress ? model.status === 'queued' ? 'Программа в очереди' : 'Готовим программу' :
      model?.status === 'failed' ? model.error || 'Подготовка прервалась' : '';
    const count = inProgress && Number.isFinite(model.totalWeeks) ? ` · ${Number(model.completedWeeks) || 0} из ${model.totalWeeks} нед.` : '';
    return `<form data-sport-plan class="glass glow-practice-form">
      ${moreInput('Начало', 'start', draft.start, `type="date" min="${today}" max="${latest}" required`)}
      ${moreInput('Окончание', 'end', draft.end, `type="date" min="${label(draft.start)}" required`)}
      ${moreField('Направление', `<select name="direction">${moreOptions(directionOptions, draft.direction)}</select>`)}
      ${moreField('Учесть здоровье', `<input type="checkbox" name="withHealth"${draft.withHealth ? ' checked' : ''}>`)}
      <details><summary>Частота, длительность и инвентарь</summary>
        ${moreInput('Тренировок в неделю', 'frequency', draft.frequency || '', `type="number" min="1" max="7" step="1" placeholder="${label(profile.schedule || '')}"`)}
        ${moreInput('Минут на тренировку', 'minutes', draft.minutes || '', `type="number" min="15" max="120" step="1" placeholder="${label(profile.sessionMinutes || '')}"`)}
        ${moreInput('Инвентарь', 'equipment', draft.equipment || '', 'maxlength="2000"')}</details>
      ${moreField('Пожелания', `<textarea name="brief" maxlength="2500" rows="2" placeholder="Цель, инвентарь, ограничения">${label(draft.brief)}</textarea>`)}
      <div class="glow-practice-actions">
        <button type="submit" class="btn main" name="mode" value="generate">${busy ? 'Подожди…' : 'Составить программу'}</button>
        <button type="submit" class="btn glass" name="mode" value="consult">Обсудить</button>
      </div>
      </form>
      ${messages.length ? `<div class="glass glow-practice-form glow-coach-messages">${messages.slice(-10).map(item => `<div class="msg ${item.role === 'user' ? 'me' : 'bot'}">${label(item.text)}</div>`).join('')}
      <div class="glow-practice-actions">${choices.map((choice, index) => practiceButton('answer', choice, '', `data-choice="${index}"`)).join('')}</div></div>` : ''}
      ${status || error || previewError || pending && !model ? `<div class="glass syh glow-practice-status" role="status">${label(error || previewError || status + count || 'Ждём подтверждение сервера')}</div>` : ''}
      ${preview ? `<div class="glass glow-practice-form"><div class="syh">${label(preview.plan.program.title)}<small>${preview.plan.workouts.length} занятий · ${label(preview.plan.program.timezone)}</small></div>
        ${preview.plan.workouts.map(workout => `<details class="syrow in"><summary>${label(practiceDay(workout.date))} · ${label(workout.title)}</summary>
          ${workout.blocks.map(block => `<p><b>${label(block.title)}</b></p><ul>${block.exercises.map(exercise =>
            `<li>${label(exercise.name)} · ${exercise.sets} × ${label(exercise.reps || exercise.target || exercise.work_seconds + ' с')}</li>`).join('')}</ul>`).join('')}</details>`).join('')}
        <div class="glow-practice-actions">${preview.sport2 ? (dependencies.currentPlan()?.id === model.requestId
          ? '<span role="status">Программа активна</span>' : practiceButton('activate', 'Активировать программу'))
          : practiceButton('import', 'Добавить в программу')}${practiceButton('download', 'Скачать JSON')}</div></div>` : ''}
      ${inProgress || model?.canRetry || error && pending ? `<div class="glow-practice-actions">
        ${practiceButton('refresh', 'Проверить состояние')}${model?.canRetry ? practiceButton('resume', 'Повторить подготовку') : ''}
        ${inProgress ? practiceButton('cancel', 'Остановить') : ''}</div>` : ''}`;
  }
  function paint() {
    if (!active()) return;
    screen.innerHTML = view();
    wire();
  }
  function schedule() {
    clearTimeout(timer);
    if (active() && !error && waiting(model)) timer = setTimeout(() => void refresh(), 2300);
  }
  function adopt(answer, expected) {
    if (!answer || !['empty', 'queued', 'running', 'ready', 'failed'].includes(answer.status) ||
      answer.status !== 'empty' && !/^[a-f0-9-]{36}$/i.test(answer.requestId || '')) throw Error('Сервер не подтвердил состояние программы');
    model = answer;
    if (expected && expected !== answer.requestId) {
      error = waiting(answer) ? 'На сервере уже готовится другая программа' : 'Сервер пока не подтвердил этот запрос';
      return;
    }
    if (answer.requestId === pending?.requestId) pending = null;
    if (answer.options) {
      Object.assign(fields(), {
        start: answer.options.start, end: answer.options.end, direction: answer.options.direction || 'profile',
      });
    }
    if (answer.preferences) preferences = answer.preferences;
    if (Array.isArray(answer.messages) && answer.messages.length) messages = answer.messages;
  }
  async function act(job) {
    if (busy || !active()) return;
    const currentScreen = screen, lease = dependencies.host();
    busy = true;
    error = '';
    paint();
    try {
      return await job(() => lease === dependencies.host() && lease.isCurrent());
    } catch (failure) {
      if (lease === dependencies.host() && lease.isCurrent()) error = failure.message || 'Действие не выполнено';
    } finally {
      if (lease === dependencies.host()) busy = false;
      if (screen === currentScreen) paint();
      schedule();
    }
  }
  function refresh() {
    return act(async valid => {
      const answer = await request('generation');
      if (valid()) adopt(answer, pending?.requestId);
    });
  }
  function packet() {
    const { start, end, direction, withHealth, frequency, minutes, equipment } = fields();
    const [today, , latest] = dependencies.dates();
    if (!start || !end || start < today || start > latest || end < start) throw Error('Проверь даты программы');
    return { start, end, direction, context: dependencies.context(withHealth), messages, preferences: { ...preferences,
      ...(frequency ? { frequency: Number(frequency) } : {}), ...(minutes ? { minutes: Number(minutes) } : {}),
      ...(equipment?.trim() ? { equipment: equipment.trim() } : {}) } };
  }
  function consult(text) {
    return act(async valid => {
      if (text) messages = [...messages, { role: 'user', text }].slice(-30);
      const answer = await request('consult', packet());
      if (!valid()) return;
      if (typeof answer?.message !== 'string' || !Array.isArray(answer.choices)) throw Error('Тренер не вернул ответ');
      messages = [...messages, { role: 'assistant', text: answer.message }];
      preferences = answer.preferences || preferences;
      choices = answer.choices.filter(choice => typeof choice === 'string').slice(0, 3);
    });
  }
  function generate() {
    const brief = fields().brief.trim();
    return act(async valid => {
      if (!pending) {
        const input = packet();
        pending = { ...input, requestId: crypto.randomUUID(),
          preferences: { ...input.preferences, direction: input.direction, ...(brief ? { brief } : {}) } };
      }
      const answer = await request('generate', pending);
      if (valid()) adopt(answer, pending.requestId);
    });
  }
  function importPlan() {
    return act(async valid => {
      const preview = dependencies.preview(model.json);
      const answer = await request('import', { json: model.json });
      if (!valid()) return;
      const canonical = answer?.catalog?.[preview.plan.program.id]?.workouts;
      if (!canonical || !preview.plan.workouts.every(item => Object.hasOwn(canonical, item.id))) {
        throw Error(answer?.error || 'Сервер не подтвердил импорт. Можно повторить');
      }
      await dependencies.imported();
      if (active()) { pop(); toast(answer.added ? `Добавлено занятий: ${answer.added}` : 'Программа уже добавлена'); }
    });
  }
  function activatePlan() {
    const key = model.requestId, plan = dependencies.currentPlan();
    const title = dependencies.parse(model.json).program.title;
    const description = plan ? `«${title}» станет активной. «${plan.title}» уйдёт в архив.` : `«${title}» станет активной.`;
    confirmMore('Активировать программу?', description, 'Активировать', () => act(async valid => {
      if (key !== model?.requestId) throw Error('Черновик изменился. Обнови предпросмотр');
      let answer;
      try {
        answer = await request('activate_generation', { requestId: key,
          expectedPlanId: plan?.id || null, expectedVersion: plan?.current_version || null });
      } catch (failure) {
        if (failure.message === 'open_session_exists') throw Error('Сначала закончи текущую тренировку');
        if (failure.message === 'plan_version_stale') throw Error('Программа или черновик изменились. Обнови раздел');
        throw failure;
      }
      if (!valid()) return false;
      if (answer?.ok !== true || answer.plan_id !== key || answer.status !== 'active') throw Error('Сервер не подтвердил активацию');
      await dependencies.imported();
      if (active()) { pop(); toast('Программа активирована'); }
      return true;
    }));
  }
  function download() {
    const { plan } = dependencies.preview(model.json);
    const url = URL.createObjectURL(new Blob([model.json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${plan.program.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function wire() {
    const form = $('[data-sport-plan]', screen);
    if (!form) return;
    const locked = busy || waiting(model);
    Array.from(form.elements).forEach(input => { input.disabled = locked; });
    const read = () => {
      const data = new FormData(form);
      Object.assign(fields(), Object.fromEntries(data), { withHealth: data.has('withHealth') });
      form.elements.end.min = fields().start || '';
    };
    form.oninput = read;
    form.onsubmit = event => {
      event.preventDefault();
      read();
      if (event.submitter?.value === 'consult') {
        const text = fields().brief.trim();
        fields().brief = '';
        void consult(text);
      } else void generate();
    };
    delegatePractice(screen, {
      refresh, import: importPlan, activate: activatePlan, download,
      answer: button => consult(choices[Number(button.dataset.choice)]),
      cancel: () => act(async valid => {
        const answer = await request('cancel_generation', { requestId: model.requestId });
        if (valid()) adopt(answer, model.requestId);
      }),
      resume: () => act(async valid => {
        const answer = await request('generate', { requestId: model.requestId, retry: true });
        if (valid()) adopt(answer, model.requestId);
      }),
    });
    if (busy) $$('[data-practice-action]', screen).forEach(button => { button.disabled = true; });
  }
  return {
    render: view,
    bind(element) { screen = element; wire(); void refresh(); },
    leave() { clearTimeout(timer); screen = null; },
    reset() { clearTimeout(timer); screen = model = options = pending = null; preferences = {}; messages = []; choices = []; error = ''; busy = false; },
  };
}
