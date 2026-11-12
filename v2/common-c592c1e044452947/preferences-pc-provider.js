const copy = value => structuredClone(value);
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const active = job => ['rendering', 'delivering', 'paused'].includes(job.status);
const waiting = jobs => { const first = jobs.find(active); return jobs.filter(job => ['queued', 'paused'].includes(job.status) && job !== first); };
const supported = new Set(['refresh', 'find', 'processes', 'volume', 'mute', 'previous', 'playpause', 'next', 'connect', 'shutdown', 'sleep', 'lock', 'screenshot', 'pause', 'resume', 'cancel', 'retry', 'queue-pause', 'queue-resume', 'after-notify', 'after-shutdown', 'after-sleep', 'reorder', 'open-app', 'process-stop', 'scene-targets', 'queue-scene']);
const fail = (code, details = {}) => Object.assign(new Error(code), {code, ...details});
const fresh = stamp => typeof stamp === 'string' && Number.isFinite(Date.parse(stamp)) && Date.now() - Date.parse(stamp) >= -30000 && Date.now() - Date.parse(stamp) < 90000;

/** Uses the captured native module host. It owns no authentication, persistence or refresh timer. */
export function createPreferencesPcProvider({getHost, isCurrent = () => true, publish = () => {}, wait = ms => new Promise(resolve => setTimeout(resolve, ms))}) {
  let host, acquiring, unsubscribe, model = null, disposed = false, invalid = false, loading, busy = false;
  function valid() { return !disposed && !invalid && isCurrent() === true && (!host || host.isCurrent() === true); }
  function check() { if (!valid()) { invalidate(); throw fail('pc_host_changed'); } }
  function invalidate() { invalid = true; model = null; unsubscribe?.(); unsubscribe = null; }
  async function capture() {
    check();
    if (!host) {
      acquiring ||= Promise.resolve().then(getHost);
      let captured;
      try { captured = await acquiring; } catch (error) { acquiring = null; throw error; }
      check();
      if (!captured?.owner || typeof captured.request !== 'function' || typeof captured.isCurrent !== 'function' || typeof captured.subscribe !== 'function' || captured.isCurrent() !== true) throw fail('pc_host_unavailable');
      if (!host) {
        host = captured;
        const stop = host.subscribe(() => { if (!valid()) invalidate(); });
        if (typeof stop === 'function') { if (invalid || disposed) stop(); else unsubscribe = stop; }
      }
    }
    check(); return host;
  }
  async function request(op, args = {}) {
    const captured = await capture(); check();
    const answer = await captured.request(op, copy(args)); check();
    if (object(answer) && answer.error) throw fail(/^[a-z_]{1,64}$/.test(answer.error) ? answer.error : 'pc_request_failed');
    return answer;
  }
  function emit() { check(); const answer = copy(model); publish(answer); check(); return copy(model); }
  function selectApps(query = '') {
    const q = String(query).trim().toLowerCase(), index = model.openIndex || {};
    return [...(Array.isArray(index.apps) ? index.apps.map(row => ({...row, kind: 'app'})) : []), ...(Array.isArray(index.recent) ? index.recent.map(row => ({...row, kind: 'file'})) : [])]
      .filter(row => row.id && typeof row.name === 'string' && (!q || `${row.name} ${row.alias || ''}`.toLowerCase().includes(q)));
  }
  async function command(cmd, args = {}) {
    const made = await request('send', {cmd, args});
    if (!Number.isSafeInteger(made?.id) || made.id < 1) throw fail('pc_invalid_command_ack');
    const id = made.id, power = ['on', 'off', 'sleep'].includes(cmd), limit = power ? 145 : ['rm_targets', 'rm_add'].includes(cmd) ? 300 : 50;
    for (let attempt = 0; attempt < limit; attempt++) {
      let answer;
      try { answer = await request('result', {id}); }
      catch (error) { if (error && typeof error === 'object') error.commandId = id; throw error; }
      const expected = made.target === 'hub' && cmd === 'on' ? 'pc_on' : made.target === 'hub' && cmd === 'off' ? 'pc_off' : cmd;
      if (!object(answer) || answer.id !== id || answer.cmd !== expected) throw fail('pc_invalid_result', {commandId: id});
      if (answer.status === 'done') {
        if (!object(answer.result)) throw fail('pc_invalid_result', {commandId: id});
        return {id, cmd, result: copy(answer.result), ...(typeof answer.image === 'string' ? {image: answer.image} : {})};
      }
      if (['failed', 'expired', 'cancelled'].includes(answer.status)) throw fail('pc_command_failed', {commandId: id, status: answer.status});
      if (!['queued', 'taken'].includes(answer.status)) throw fail('pc_unknown_status', {commandId: id});
      if (attempt + 1 < limit) { await wait(power ? 1700 : 900); check(); }
    }
    throw fail('pc_command_timeout', {commandId: id});
  }
  async function readState() {
    const state = await request('state');
    if (!object(state) || typeof state.agent !== 'boolean' || typeof state.hub !== 'boolean' || ![true, false, null].includes(state.on) || !object(state.rmQueue) || !object(state.openIndex)) throw fail('pc_invalid_state');
    const previous = model;
    model = {...copy(state), ...(previous?.audio ? {audio: previous.audio} : {}), ...(previous?.processes ? {processes: previous.processes} : {})};
    model.apps = selectApps(previous?.query || ''); model.query = previous?.query || '';
    return emit();
  }
  function requireOnline(render = false) {
    if (!model?.agent || model.on === false) throw fail('agent_offline');
    if (!fresh(model.agentSeen || model.statusAt)) throw fail('pc_state_stale');
    if (render && (!fresh(model.rmQueue?.at || model.rmQueue?.observed_at) || model.rmQueue?.service?.available === false)) throw fail('pc_render_stale');
  }
  async function load() {
    check();
    if (loading) return loading;
    if (busy) return snapshot();
    loading = (async () => {
      await readState();
      if (model.agent && fresh(model.agentSeen || model.statusAt)) {
        const answer = await command('volume');
        if (!object(answer.result.audio) || !Number.isFinite(answer.result.audio.level) || typeof answer.result.audio.muted !== 'boolean') throw fail('pc_invalid_audio');
        model.audio = answer.result.audio; emit();
      }
      return snapshot();
    })();
    try { return await loading; } finally { loading = null; }
  }
  async function intent({action, recordId = '', args = {}} = {}) {
    if (!supported.has(action)) return undefined;
    check(); if (busy) throw fail('pc_busy');
    if (loading) await loading;
    check();
    if (action === 'refresh') return {ok: true, model: await load()};
    if (!model) await load();
    check(); if (busy) throw fail('pc_busy'); busy = true;
    try {
      if (action === 'find') { model.query = String(args.query || '').slice(0, 300); model.apps = selectApps(model.query); return {ok: true, model: emit()}; }
      let cmd, payload = {};
      const keys = {previous: 'prev', playpause: 'play', next: 'next', mute: 'mute'};
      if (action === 'connect') {
        if (model.hub !== true || !fresh(model.hubSeen)) throw fail('esp_offline');
        cmd = 'on';
      } else {
        requireOnline(['pause','resume','cancel','retry','reorder','queue-pause','queue-resume','after-notify','after-shutdown','after-sleep','scene-targets','queue-scene'].includes(action));
        if (keys[action]) { cmd = 'volume'; payload = {key: keys[action]}; }
        else if (action === 'volume') {
          if (!Number.isFinite(args.level) || args.level < 0 || args.level > 100) throw fail('pc_invalid_volume');
          cmd = 'volume'; payload = {level: args.level, mute: false};
        } else if (['shutdown','sleep','lock','screenshot','processes'].includes(action)) cmd = action === 'shutdown' ? 'off' : action;
        else if (['pause','resume','cancel','retry'].includes(action)) {
          const job = model.rmQueue.jobs?.find(row => String(row.id) === String(recordId));
          if (!job || !Number.isSafeInteger(job.id) || job.id < 1) throw fail('pc_job_missing');
          cmd = 'rm_' + action; payload = {id: job.id};
        } else if (action.startsWith('queue-') && action !== 'queue-scene') { cmd = 'rm_hold'; payload = {on: action === 'queue-pause'}; }
        else if (action.startsWith('after-')) { cmd = 'rm_after'; payload = {after: {'after-notify':'notify','after-shutdown':'off','after-sleep':'sleep'}[action]}; }
        else if (action === 'reorder') {
          const jobs = waiting(model.rmQueue.jobs || []), ids = jobs.map(row => String(row.id));
          if (!Array.isArray(args.ids) || args.ids.length !== ids.length || new Set(args.ids.map(String)).size !== ids.length || args.ids.some(id => !ids.includes(String(id))) || !ids.includes(String(recordId))) throw fail('pc_invalid_reorder');
          const ordered = args.ids.map(String), unchanged = ids.filter(id => id !== String(recordId));
          if (JSON.stringify(unchanged) !== JSON.stringify(ordered.filter(id => id !== String(recordId)))) throw fail('pc_invalid_reorder');
          const full = model.rmQueue.jobs.filter(job => ['queued', 'paused'].includes(job.status)).map(job => ids.includes(String(job.id)) ? ordered.shift() : String(job.id));
          cmd = 'rm_move'; payload = {id: jobs.find(row => String(row.id) === String(recordId)).id, index: full.indexOf(String(recordId))};
        } else if (action === 'open-app') {
          const item = selectApps().find(row => String(row.id) === String(recordId));
          if (!item) throw fail('pc_target_missing');
          cmd = 'open'; payload = {kind: item.kind, id: item.id};
        } else if (action === 'process-stop') {
          const process = model.processes?.find(row => String(row.pid) === String(recordId));
          if (!process || !Number.isSafeInteger(process.pid) || process.pid < 1) throw fail('pc_process_missing');
          cmd = 'kill'; payload = {pid: process.pid};
        } else if (['scene-targets', 'queue-scene'].includes(action)) {
          const scene = model.rmQueue.scenes?.find(row => String(row.id) === String(recordId));
          if (!scene || typeof scene.path !== 'string') throw fail('pc_scene_missing');
          cmd = action === 'scene-targets' ? 'rm_targets' : 'rm_add'; payload = {path: scene.path};
          if (cmd === 'rm_targets' && object(scene.target_filter)) for (const key of ['mode','prefix','label_id']) if (scene.target_filter[key] !== undefined) payload[key] = scene.target_filter[key];
          if (cmd === 'rm_add') {
            const targets = scene.targets?.filter(row => row.target === args.target) || [];
            if (targets.length !== 1 || typeof targets[0].frames !== 'string' || !targets[0].frames) throw fail('pc_target_ambiguous');
            for (const key of ['target','frames','output','rq_index','comp_id','scene_stamp','audit','fps','width','height','format']) if (targets[0][key] !== undefined) payload[key] = copy(targets[0][key]);
            if (object(targets[0].audit)) for (const key of ['fps','width','height','format']) if (targets[0].audit[key] !== undefined) payload[key] = targets[0].audit[key];
          }
        }
      }
      if (!cmd) throw fail('pc_unsupported');
      const answer = await command(cmd, payload);
      if (cmd === 'volume') {
        if (!object(answer.result.audio) || !Number.isFinite(answer.result.audio.level) || typeof answer.result.audio.muted !== 'boolean') throw fail('pc_invalid_audio');
        model.audio = answer.result.audio;
      }
      if (cmd === 'processes') {
        if (!Array.isArray(answer.result.processes)) throw fail('pc_invalid_processes');
        model.processes = answer.result.processes.map(row => ({...row, ...(Number.isFinite(row.memory_mb) ? {memory: row.memory_mb} : {})}));
      }
      if (cmd === 'kill') model.processes = model.processes.filter(row => row.pid !== payload.pid);
      if (cmd === 'rm_targets' && object(answer.result.scene)) {
        const scene = answer.result.scene;
        model.rmQueue.scenes = [copy(scene), ...(model.rmQueue.scenes || []).filter(row => row.id !== scene.id)];
      }
      // Queue commands return acknowledgement text, not a canonical queue snapshot.
      // The owner's next load supplies actual job state rather than predicting it.
      return {...answer, ok: true, model: emit()};
    } finally { busy = false; }
  }
  function snapshot() { return valid() && model ? copy(model) : null; }
  function dispose() { disposed = true; model = null; unsubscribe?.(); unsubscribe = null; }
  return Object.freeze({load, intent, dispose, snapshot});
}
