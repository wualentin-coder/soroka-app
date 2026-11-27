const commands = new Set(['rm_hold', 'rm_cancel', 'rm_move', 'rm_pause', 'rm_resume', 'rm_retry',
  'rm_deliver', 'rm_reveal', 'rm_compare', 'rm_markers', 'rm_patch', 'rm_targets', 'rm_batch']);
const sceneCommands = new Set(['rm_targets', 'rm_batch']);
const waiting = new Set(['queued', 'paused']);
const finished = new Set(['done', 'failed', 'cancelled']);
const stagesWithoutProgress = /склей|кодир|сборк|провер|подготов|открыва|копир|исходник/i;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const fail = (code, message) => Object.assign(new Error(message), { code });
const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const fresh = (stamp, now) => {
  const age = now - Date.parse(stamp);
  return Number.isFinite(age) && age >= -30000 && age < 90000;
};
export const validJobId = id => Number.isSafeInteger(id) && id > 0;

export function renderProgress(job) {
  if (!job) return null;
  if (job.status === 'delivering') {
    const { total, files } = job.delivery || {};
    return Number(total) > 0 && number(files) !== null ? Math.max(0, Math.min(100, files * 100 / total)) : null;
  }
  const stage = job.stage_label || job.stage || '';
  if (job.patch_of || job.patch_frames) {
    return (job.stage_code === 'render' || !job.stage_code && /рендер в фоне|дорендер/i.test(stage))
      && Number(job.span_total) > 0 && number(job.span_done) !== null
      ? Math.max(0, Math.min(100, job.span_done * 100 / job.span_total)) : null;
  }
  const percent = number(job.percent);
  return percent === null || stagesWithoutProgress.test(stage) ? null : Math.max(0, Math.min(100, percent));
}

export function renderSnapshot(state, now = Date.now()) {
  const q = state?.rmQueue || {};
  const jobs = (Array.isArray(q.jobs) ? q.jobs : []).filter(job => validJobId(job?.id));
  const active = jobs.find(j => ['rendering', 'delivering'].includes(j.status)) || jobs.find(j => j.status === 'paused');
  const known = fresh(q.at || q.observed_at, now);
  const online = state?.agent === true && state.on !== false && fresh(state.agentSeen || state.statusAt, now);
  const ready = online && known && q.service?.available !== false;
  const manual = !active && online && state.render?.rendering ? { ...state.render, status: 'rendering', name: state.render.comp || 'Вручную в AE', app: 'ae' } : null;
  return { state, q, jobs, active: active || manual, managed: !!active, ready, online, known, held: q.held === true,
    waiting: jobs.filter(j => j !== active && waiting.has(j.status)),
    history: jobs.filter(j => finished.has(j.status) && !j.benchmark)
      .sort((a, b) => Number(b.finished_at || b.id) - Number(a.finished_at || a.id)),
    scenes: Array.isArray(q.scenes) ? q.scenes : [],
    canReadScene: online && q.service?.available !== false || state?.hub === true && fresh(state.hubSeen, now) };
}

export function createGlowRenderOwner(getHost, { publish, sleep = wait, now = Date.now } = {}) {
  let host, ownerFlight, readFlight, state = null, alive = true;
  const clear = () => { alive = false; state = null; publish?.(null); };
  async function session() {
    if (!alive) throw fail('owner', 'Сессия Flow изменилась');
    if (!host) {
      ownerFlight ||= Promise.resolve().then(getHost);
      try {
        const captured = await ownerFlight;
        if (!captured.isCurrent()) throw fail('owner', 'Сессия Flow изменилась');
        if (!host) {
          host = captured;
          const stop = host.subscribe(() => { if (!host.isCurrent()) { stop(); clear(); } });
        }
      } catch (error) { ownerFlight = null; throw error; }
    }
    if (!host.isCurrent()) { clear(); throw fail('owner', 'Сессия Flow изменилась'); }
    return host;
  }
  async function request(op, args) {
    const captured = await session();
    const answer = await captured.request(op, args);
    if (!alive || !captured.isCurrent()) { if (alive) clear(); throw fail('owner', 'Сессия Flow изменилась'); }
    if (answer?.error) throw fail('remote', String(answer.error));
    return answer;
  }
  function read({ renew = false } = {}) {
    if (readFlight) return renew ? readFlight.catch(() => {}).then(() => read()) : readFlight;
    readFlight = (async () => {
      const answer = await request('state');
      if (!object(answer) || typeof answer.agent !== 'boolean' || !object(answer.rmQueue)) throw fail('state', 'Нет ответа от Render Manager');
      state = answer;
      publish?.(state);
      return renderSnapshot(state, now());
    })().finally(() => { readFlight = null; });
    return readFlight;
  }
  async function command(cmd, args) {
    if (!commands.has(cmd)) throw fail('command', 'Команда недоступна');
    const view = await read();
    if (sceneCommands.has(cmd) ? !view.canReadScene : !view.ready) throw fail('offline', 'Нет свежей связи с Render Manager');
    const made = await request('send', { cmd, args });
    if (!validJobId(made?.id)) throw fail('ack', 'Компьютер не подтвердил приём команды');
    const deadline = now() + (made.woke ? 15 : 6) * 60000;
    while (alive && now() < deadline) {
      let result;
      try { result = await request('result', { id: made.id }); }
      catch (error) {
        if (!alive || error.code === 'owner' || error.code === 'remote' || [400, 401, 403, 404].includes(error.status)) throw error;
        await sleep(2500);
        continue;
      }
      if (result?.id !== made.id || result?.cmd !== cmd) throw fail('result', 'Получен ответ на другую команду');
      if (result.status === 'done' && object(result.result)) return result.result;
      if (!['taken', 'queued'].includes(result.status)) throw fail('failed', result.result?.message || 'Компьютер не выполнил команду');
      await sleep(1200);
    }
    throw fail('timeout', 'Время ожидания истекло. Проверьте очередь перед повтором');
  }
  return { read, command, current: () => alive ? renderSnapshot(state, now()) : null };
}
