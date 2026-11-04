const API = '/api/tutor/';
const AUDIO_LIMIT = 1_500_000;
const SPEECH_LIMIT = 3_000_000;
const REVIEW_LIMIT = 23_000;

function aborted() { const error = new Error('Разговор отменён.'); error.name = 'AbortError'; return error; }
function failure(message, code = 'teacher_failed') { const error = new Error(message); error.code = code; return error; }
function text(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

function prioritizeErrors(errors) {
  const pairs = new Map();
  for (const error of errors) {
    if (error.heard === null || error.heard === error.expected || error.timing === 'rest') continue;
    const key = `${error.expected}/${error.heard}`, pair = pairs.get(key) || { index: error.index, indices: new Map() };
    pair.index = Math.min(pair.index, error.index); if (!pair.indices.has(error.index)) pair.indices.set(error.index, error);
    pairs.set(key, pair);
  }
  const primary = [...pairs.values()].sort((a, b) => b.indices.size - a.indices.size || a.index - b.index)[0];
  if (!primary) return errors.slice(0, 24);
  const evidence = [...primary.indices.values()].sort((a, b) => a.index - b.index), selected = new Set(evidence);
  return [...evidence, ...errors.filter(error => !selected.has(error))].slice(0, 24);
}

function reviewBody(lesson, report, question, previousResponse) {
  if (!report || !['first-attempt-v1', 'timed-notes-v1'].includes(report.metric) ||
      !Number.isInteger(report.total) || report.total < 1 || report.total > 5000 || report.finished !== true || report.demo === true) {
    throw failure('Для разбора нужен завершённый проход на инструменте.', 'invalid_report');
  }
  const invalid = () => { throw failure('Не удалось прочитать результат прохода.', 'invalid_report'); };
  const count = (value, maximum) => Number.isInteger(value) && value >= 0 && value <= maximum;
  if (!['correct', 'firstAttemptCorrect', 'skipped'].every(key => count(report[key], report.total)) || !count(report.wrong, 20000) ||
      report.earlyAbort !== undefined && typeof report.earlyAbort !== 'boolean' ||
      report.scorePercent !== undefined && (!Number.isFinite(report.scorePercent) || report.scorePercent < 0 || report.scorePercent > 100) ||
      report.scoreOutOf10 !== undefined && (!Number.isFinite(report.scoreOutOf10) || report.scoreOutOf10 < 0 || report.scoreOutOf10 > 10) ||
      report.errors !== undefined && (!Array.isArray(report.errors) || report.errors.length > 25000)) invalid();
  const allowed = ['metric', 'total', 'correct', 'firstAttemptCorrect', 'wrong', 'skipped', 'finished',
    'scorePercent', 'scoreOutOf10', 'earlyAbort', 'source', 'assisted', 'beta', 'askUnderstanding'];
  if (report.source !== undefined && !['midi', 'mic'].includes(report.source) ||
      ['assisted', 'beta', 'askUnderstanding'].some(key => report[key] !== undefined && typeof report[key] !== 'boolean')) invalid();
  const bounded = Object.fromEntries(allowed.filter(key => report[key] !== undefined).map(key => [key, report[key]]));
  bounded.demo = false;
  bounded.mode = report.mode === 'check' ? 'check' : report.metric === 'timed-notes-v1' ? 'flow' : 'learn';
  bounded.errors = prioritizeErrors((report.errors || []).map(error => {
    const heard = Object.hasOwn(error || {}, 'heard') ? error.heard : error?.played;
    if (!count(error?.index, report.total - 1) || !count(error?.expected, 127) || heard !== null && !count(heard, 127)) invalid();
    return { index: error.index, expected: error.expected, heard, ...(error.timing === 'rest' ? { timing: 'rest' } : {}) };
  }));
  if (report.targetOutcomes !== undefined) {
    if (!Array.isArray(report.targetOutcomes) || report.targetOutcomes.length !== report.total || report.targetOutcomes.some(value => ![null, 0, 1].includes(value))) invalid();
    bounded.targetOutcomes = [...report.targetOutcomes];
  }
  if (report.metric === 'timed-notes-v1') {
    if (report.timing !== undefined) {
      if (!report.timing || !['matched', 'early', 'late', 'onTime'].every(key => count(report.timing[key], report.total)) ||
          !['meanAbsMs', 'trendMs'].every(key => Number.isFinite(report.timing[key]) && Math.abs(report.timing[key]) <= 86_410_000)) invalid();
      bounded.timing = Object.fromEntries(['matched', 'early', 'late', 'onTime', 'meanAbsMs', 'trendMs'].map(key => [key, report.timing[key]]));
    }
    if (report.hitOffsetsMS !== undefined) {
      if (!Array.isArray(report.hitOffsetsMS) || report.hitOffsetsMS.length !== report.total || report.hitOffsetsMS.some(value => value !== null && (!Number.isFinite(value) || Math.abs(value) > 86_410_000))) invalid();
      bounded.hitOffsetsMS = [...report.hitOffsetsMS];
    }
    if (report.strictRests !== undefined && typeof report.strictRests !== 'boolean' ||
        report.extraAttacks !== undefined && !count(report.extraAttacks, 25_000_000)) invalid();
    for (const key of ['strictRests', 'extraAttacks']) if (report[key] !== undefined) bounded[key] = report[key];
  }
  const body = { lesson: { id: text(lesson?.id, 80), title: text(lesson?.title, 120), instruction: text(lesson?.instruction, 1000) }, report: bounded };
  if (text(question, 800)) { body.question = text(question, 800); body.previousResponse = text(previousResponse, 1600); }
  const size = () => new TextEncoder().encode(JSON.stringify(body)).length;
  // The gateway accepts 24 kB. Optional evidence vectors are all-or-nothing;
  // the complete timing summary and exact aggregate scores stay intact.
  if (size() > REVIEW_LIMIT) delete bounded.hitOffsetsMS;
  if (size() > REVIEW_LIMIT) delete bounded.targetOutcomes;
  if (size() > REVIEW_LIMIT) throw failure('Слишком большой контекст разбора. Повтори небольшой фрагмент.', 'context_too_large');
  return body;
}

/** Encode bounded mono PCM16 WAV, averaging source samples when downsampling. */
export function encodeWav(samples, sampleRate, targetRate = 16000) {
  if (!(samples instanceof Float32Array) || !samples.length || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000 ||
      !Number.isInteger(targetRate) || targetRate < 8000 || targetRate > 16000) throw new TypeError('Invalid voice audio format.');
  const rate = Math.min(sampleRate, targetRate);
  const frames = Math.floor(samples.length * rate / sampleRate);
  if (samples.length / sampleRate > 20 || !frames || frames * 2 + 44 > AUDIO_LIMIT) throw new RangeError('Voice recording exceeds the limit.');
  const result = new Uint8Array(44 + frames * 2), view = new DataView(result.buffer);
  const ascii = (offset, value) => { for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index)); };
  ascii(0, 'RIFF'); view.setUint32(4, result.length - 8, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, frames * 2, true);
  for (let index = 0; index < frames; index++) {
    const start = index * sampleRate / rate, end = (index + 1) * sampleRate / rate;
    let sum = 0, weight = 0;
    for (let source = Math.floor(start); source < Math.ceil(end) && source < samples.length; source++) {
      const portion = Math.min(end, source + 1) - Math.max(start, source);
      const value = Number.isFinite(samples[source]) ? samples[source] : 0;
      sum += value * portion; weight += portion;
    }
    const value = Math.max(-1, Math.min(1, weight ? sum / weight : 0));
    view.setInt16(44 + index * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
  }
  return result;
}

function base64(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

export function createTeacher({ onText = () => {}, onStatus = () => {}, dependencies = {} } = {}) {
  const pick = (name, fallback) => Object.hasOwn(dependencies, name) ? dependencies[name] : fallback;
  const environment = {
    fetch: pick('fetch', globalThis.fetch?.bind(globalThis)),
    recordedFetch: pick('recordedFetch', globalThis.fetch?.bind(globalThis)),
    speechSynthesis: pick('speechSynthesis', globalThis.speechSynthesis),
    Utterance: pick('SpeechSynthesisUtterance', globalThis.SpeechSynthesisUtterance),
    AudioContext: pick('AudioContext', globalThis.AudioContext || globalThis.webkitAudioContext),
    recordedVoices: pick('recordedVoices', () => globalThis.FLOW_PIANO_VOICES),
    getUserMedia: pick('getUserMedia', globalThis.navigator?.mediaDevices?.getUserMedia?.bind(globalThis.navigator.mediaDevices)),
    now: pick('now', Date.now),
  };
  let generation = 0, playbackContext = null, cachedStatus = null;
  let localStop = null, audioStop = null, recordingStop = null;
  const controllers = new Set(), cancelHooks = new Set();
  const emit = (value, detail) => onStatus(value, detail);
  const current = epoch => epoch === generation;
  const assertCurrent = epoch => { if (!current(epoch)) throw aborted(); };

  function waitCurrent(promise, epoch, signal) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, value) => {
        if (settled) return; settled = true;
        cancelHooks.delete(stop); signal?.removeEventListener('abort', stop);
        if (error) reject(error); else resolve(value);
      };
      const stop = () => finish(aborted());
      cancelHooks.add(stop); signal?.addEventListener('abort', stop, { once: true });
      Promise.resolve(promise).then(value => finish(current(epoch) ? null : aborted(), value), error => finish(error));
      if (!current(epoch) || signal?.aborted) stop();
    });
  }

  function cancel() {
    generation++;
    for (const controller of controllers) controller.abort();
    controllers.clear();
    for (const hook of [...cancelHooks]) hook();
    cancelHooks.clear();
    localStop?.(); audioStop?.();
    recordingStop?.(false);
    environment.speechSynthesis?.cancel?.();
    emit('idle');
  }
  function begin(phase) { cancel(); emit(phase); return generation; }

  async function unlock() {
    if (!environment.AudioContext) return false;
    try {
      if (!playbackContext || playbackContext.state === 'closed') playbackContext = new environment.AudioContext();
      await playbackContext.resume();
      if (playbackContext.state !== 'running') return false;
      const source = playbackContext.createBufferSource();
      source.buffer = playbackContext.createBuffer(1, 1, playbackContext.sampleRate);
      source.connect(playbackContext.destination);
      source.onended = () => source.disconnect();
      source.start();
      return true;
    } catch { return false; }
  }

  async function request(route, body, epoch, audio = false) {
    assertCurrent(epoch);
    if (!environment.fetch) throw failure('В этом браузере недоступно подключение преподавателя.', 'unavailable');
    const controller = new AbortController(); controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), route === 'speech' ? 25000 : 35000);
    try {
      const response = await waitCurrent(environment.fetch(API + route, { method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal }), epoch, controller.signal);
      assertCurrent(epoch);
      if (!response.ok) {
        let data; try { data = await waitCurrent(response.json(), epoch, controller.signal); } catch {}
        throw failure(text(data?.error, 220) || 'Преподаватель временно недоступен. Попробуй ещё раз.', text(data?.code, 80) || 'request_failed');
      }
      if (!audio) {
        const data = await waitCurrent(response.json(), epoch, controller.signal); assertCurrent(epoch); return data;
      }
      if (!(response.headers.get('content-type') || '').toLowerCase().startsWith('audio/')) throw failure('Не удалось получить голосовой ответ.', 'invalid_audio');
      const parts = []; let size = 0;
      const reader = response.body?.getReader();
      if (!reader) throw failure('Голосовой ответ оказался пустым.', 'invalid_audio');
      while (true) {
        const chunk = await waitCurrent(reader.read(), epoch, controller.signal); assertCurrent(epoch);
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > SPEECH_LIMIT) { await reader.cancel(); throw failure('Голосовой ответ слишком большой.', 'invalid_audio'); }
        parts.push(chunk.value);
      }
      if (!size) throw failure('Голосовой ответ оказался пустым.', 'invalid_audio');
      const bytes = new Uint8Array(size); let offset = 0;
      for (const part of parts) { bytes.set(part, offset); offset += part.length; }
      return bytes;
    } catch (error) {
      if (!current(epoch)) throw aborted();
      if (error.name === 'AbortError') throw failure('Преподаватель не ответил вовремя. Можно повторить запрос.', 'timeout');
      throw error;
    } finally { clearTimeout(timeout); controllers.delete(controller); }
  }

  async function status() {
    if (cachedStatus && environment.now() - cachedStatus.at < 30000) return { ...cachedStatus.value };
    const epoch = generation, controller = new AbortController(); controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      if (!environment.fetch) return { ready: false, speech: false, transcription: false, provider: 'openrouter' };
      const response = await waitCurrent(environment.fetch(API + 'status', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal }), epoch, controller.signal);
      const data = response.ok ? await waitCurrent(response.json(), epoch, controller.signal) : {};
      assertCurrent(epoch);
      const value = { ready: data.ready === true, speech: data.speech === true,
        transcription: data.transcription === true, provider: 'openrouter' };
      cachedStatus = { at: environment.now(), value }; return { ...value };
    } catch {
      assertCurrent(epoch);
      return { ready: false, speech: false, transcription: false, provider: 'openrouter' };
    } finally { clearTimeout(timer); controllers.delete(controller); }
  }

  async function russianVoice(epoch) {
    const synth = environment.speechSynthesis;
    if (!synth || !environment.Utterance) return null;
    const find = () => synth.getVoices().find(voice => voice.lang?.toLowerCase().startsWith('ru'));
    let voice = find(); if (voice) return voice;
    await new Promise(resolve => {
      let timer;
      const finish = () => { clearTimeout(timer); synth.removeEventListener?.('voiceschanged', finish); cancelHooks.delete(finish); resolve(); };
      timer = setTimeout(finish, 700);
      cancelHooks.add(finish); synth.addEventListener?.('voiceschanged', finish);
    });
    assertCurrent(epoch); voice = find(); return voice || null;
  }

  async function speakLocal(value, epoch) {
    const voice = await russianVoice(epoch); assertCurrent(epoch);
    if (!voice) return false;
    emit('speaking', 'browser');
    return new Promise(resolve => {
      const utterance = new environment.Utterance(value);
      utterance.voice = voice; utterance.lang = 'ru-RU'; utterance.rate = .95;
      let finished = false, timer;
      const finish = success => {
        if (finished) return; finished = true; clearTimeout(timer);
        utterance.onend = null; utterance.onerror = null;
        if (localStop === stop) { localStop = null; if (!success) environment.speechSynthesis.cancel?.(); }
        resolve(success && current(epoch));
      };
      const stop = () => finish(false);
      localStop = stop;
      utterance.onend = () => finish(true); utterance.onerror = () => finish(false);
      timer = setTimeout(stop, Math.max(4000, Math.min(60000, value.length * 90 + 3000)));
      try { environment.speechSynthesis.speak(utterance); } catch { finish(false); }
    });
  }

  async function speakRemote(value, epoch) {
    if (!environment.AudioContext || !playbackContext || playbackContext.state === 'closed') return false;
    await waitCurrent(playbackContext.resume(), epoch); assertCurrent(epoch);
    if (playbackContext.state !== 'running') return false;
    const ready = await status(); assertCurrent(epoch);
    if (!ready.ready || !ready.speech) return false;
    const bytes = await request('speech', { text: value }, epoch, true);
    assertCurrent(epoch);
    if (!playbackContext || playbackContext.state === 'closed') return false;
    await waitCurrent(playbackContext.resume(), epoch); assertCurrent(epoch);
    if (playbackContext.state !== 'running') return false;
    const buffer = await waitCurrent(playbackContext.decodeAudioData(bytes.buffer.slice(0)), epoch); assertCurrent(epoch);
    return playSpeechBuffer(buffer, epoch, 'openrouter');
  }

  function playSpeechBuffer(buffer, epoch, provider) {
    emit('speaking', provider);
    return new Promise(resolve => {
      const source = playbackContext.createBufferSource(); source.buffer = buffer; source.connect(playbackContext.destination);
      let finished = false, timer;
      const finish = success => {
        if (finished) return; finished = true; clearTimeout(timer); source.onended = null;
        try { source.disconnect(); } catch {}
        if (audioStop === stop) audioStop = null;
        resolve(success && current(epoch));
      };
      const stop = () => { source.onended = null; try { source.stop(); } catch {} finish(false); };
      audioStop = stop; source.onended = () => finish(true);
      timer = setTimeout(stop, Math.max(2000, Math.min(90000, buffer.duration * 1000 + 1500)));
      try { source.start(); } catch { finish(false); }
    });
  }

  async function speakRecorded(value, epoch, recordings) {
    const address = recordings?.[value];
    if (typeof address !== 'string' || !environment.recordedFetch || !environment.AudioContext) return false;
    const url = new URL(address, import.meta.url);
    const voice = /\/assets\/piano-intro-(tanya|mikhail)-v4-\d{2}\.mp3$/.exec(url.pathname)?.[1];
    if (url.origin !== new URL(import.meta.url).origin || !voice) return false;
    const controller = new AbortController(); controllers.add(controller);
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      if (!playbackContext || playbackContext.state === 'closed') playbackContext = new environment.AudioContext();
      await waitCurrent(playbackContext.resume(), epoch, controller.signal); assertCurrent(epoch);
      if (playbackContext.state !== 'running') return false;
      // Bundled recordings only: no text is sent to a speech provider.
      const response = await waitCurrent(environment.recordedFetch(url.href, {
        credentials: 'same-origin', cache: 'force-cache', signal: controller.signal,
      }), epoch, controller.signal);
      if (!response.ok || !(response.headers.get('content-type') || '').toLowerCase().startsWith('audio/') ||
        Number(response.headers.get('content-length')) > SPEECH_LIMIT) return false;
      const reader = response.body?.getReader();
      if (!reader) return false;
      const parts = []; let size = 0;
      try {
        while (true) {
          const chunk = await waitCurrent(reader.read(), epoch, controller.signal); assertCurrent(epoch);
          if (chunk.done) break;
          size += chunk.value.length;
          if (size > SPEECH_LIMIT) return false;
          parts.push(chunk.value);
        }
      } finally { try { reader.cancel()?.catch(() => {}); } catch {} }
      if (!size) return false;
      const bytes = new Uint8Array(size); let offset = 0;
      for (const part of parts) { bytes.set(part, offset); offset += part.length; }
      const buffer = await waitCurrent(playbackContext.decodeAudioData(bytes.buffer), epoch, controller.signal);
      assertCurrent(epoch);
      if (playbackContext.state !== 'running' || !Number.isFinite(buffer.duration) || buffer.duration <= 0 || buffer.duration > 90) return false;
      clearTimeout(timer);
      return await playSpeechBuffer(buffer, epoch, voice + '-v4-recording');
    } catch (error) { if (!current(epoch)) throw aborted(); return false; }
    finally { clearTimeout(timer); controllers.delete(controller); }
  }

  async function speak(value, { remote = false } = {}) {
    value = text(value, 1600); if (!value) return false;
    const epoch = begin('preparing'); onText(value);
    try {
      let recordings;
      try { recordings = typeof environment.recordedVoices === 'function' ? environment.recordedVoices() : environment.recordedVoices; } catch { recordings = null; }
      const recorded = recordings === null || Object.hasOwn(recordings || {}, value);
      const methods = recorded ? [(value, epoch) => speakRecorded(value, epoch, recordings), speakLocal] : remote ? [speakRemote, speakLocal] : [speakLocal, speakRemote];
      for (const method of methods) {
        try { if (await method(value, epoch)) { assertCurrent(epoch); emit('idle'); return true; } }
        catch (error) { if (!current(epoch) || error.name === 'AbortError') throw aborted(); }
        assertCurrent(epoch);
      }
      emit('unavailable', 'Голос недоступен. Ответ остался на экране.'); return false;
    } catch (error) {
      if (!current(epoch) || error.name === 'AbortError') return false;
      emit('error', error.message); return false;
    }
  }

  async function review({ lesson, report }, { question, previousResponse } = {}) {
    const epoch = begin('thinking');
    const route = text(question, 800) ? 'reply' : 'review';
    try {
      const body = reviewBody(lesson, report, question, previousResponse);
      const data = await request(route, body, epoch); assertCurrent(epoch);
      const answer = text(data?.text, 1600);
      if (!answer || data.provider !== 'openrouter') throw failure('Не удалось прочитать ответ преподавателя.', 'invalid_response');
      onText(answer); emit('idle'); return { text: answer, provider: data.provider, model: text(data.model, 120) };
    } catch (error) { if (current(epoch)) emit('error', error.message); throw error; }
  }

  async function recordReply({ seconds = 8 } = {}) {
    const epoch = begin('checking');
    if (!environment.getUserMedia || !environment.AudioContext) throw failure('Этот браузер не поддерживает запись ответа. Можно ответить кнопкой.', 'unsupported');
    const duration = Math.max(1, Math.min(20, Number.isFinite(seconds) ? seconds : 8));
    let capture;
    try { capture = new environment.AudioContext({ sampleRate: 16000 }); } catch { capture = new environment.AudioContext(); }
    // Resume during the button gesture, before the availability request yields.
    const resumed = Promise.resolve(capture.resume()).then(() => true, () => false);
    let stream = null, source = null, processor = null, silence = null;
    let timer, ended;
    const cleanup = () => {
      clearTimeout(timer);
      if (processor) processor.onaudioprocess = null;
      for (const node of [source, processor, silence]) { try { node?.disconnect(); } catch {} }
      for (const track of stream?.getTracks() ?? []) { track.removeEventListener?.('ended', ended); track.stop(); }
      if (capture.state !== 'closed') capture.close().catch(() => {});
    };
    try {
      const ready = await status(); assertCurrent(epoch);
      if (!ready.ready || !ready.transcription) { emit('unavailable'); throw failure('Голосовой ответ пока недоступен. Можно ответить кнопкой.', 'unavailable'); }
      await new Promise((resolve, reject) => {
        let settled=false, startTimer;
        const finish=error=>{if(settled)return;settled=true;clearTimeout(startTimer);cancelHooks.delete(cancelStart);if(error)reject(error);else resolve();};
        const cancelStart=()=>{cleanup();finish(aborted());};
        cancelHooks.add(cancelStart);
        startTimer=setTimeout(()=>finish(failure('Браузер не включил запись. Нажми «Ответить голосом» ещё раз.', 'audio_suspended')),4000);
        resumed.then(()=>finish());
        if(!current(epoch))cancelStart();
      }); assertCurrent(epoch);
      if (capture.state !== 'running') throw failure('Браузер не включил запись. Нажми «Ответить голосом» ещё раз или ответь кнопкой.', 'audio_suspended');
      stream = await new Promise((resolve, reject) => {
        const cancelPermission = () => { cleanup(); cancelHooks.delete(cancelPermission); reject(aborted()); };
        cancelHooks.add(cancelPermission);
        let permission;
        try { permission = environment.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false }); }
        catch (error) { cancelHooks.delete(cancelPermission); reject(error); return; }
        Promise.resolve(permission).then(acquired => {
          cancelHooks.delete(cancelPermission);
          if (!current(epoch)) { acquired.getTracks().forEach(track => track.stop()); reject(aborted()); return; }
          resolve(acquired);
        }, error => { cancelHooks.delete(cancelPermission); reject(error); });
      });
      assertCurrent(epoch);
      if (!capture.createScriptProcessor) throw failure('Запись голоса недоступна в этом браузере. Можно ответить кнопкой.', 'unsupported');
      const bytes = await new Promise((resolve, reject) => {
        const chunks = [], limit = Math.floor(capture.sampleRate * duration); let frames = 0, finished = false;
        const finish = send => {
          if (finished) return; finished = true; cleanup();
          if (recordingStop === finish) recordingStop = null;
          if (!send || !current(epoch)) { reject(aborted()); return; }
          if (frames / capture.sampleRate < .15) { reject(failure('Ответ слишком короткий. Попробуй сказать ещё раз.', 'too_short')); return; }
          const samples = new Float32Array(frames); let offset = 0;
          for (const chunk of chunks) { samples.set(chunk, offset); offset += chunk.length; }
          try { resolve(encodeWav(samples, capture.sampleRate)); } catch { reject(failure('Не удалось подготовить голосовую запись.', 'invalid_audio')); }
        };
        recordingStop = finish;
        ended = () => { if (!finished) { finish(false); } };
        stream.getTracks().forEach(track => track.addEventListener?.('ended', ended));
        source = capture.createMediaStreamSource(stream); processor = capture.createScriptProcessor(4096, 1, 1);
        silence = capture.createGain(); silence.gain.value = 0;
        source.connect(processor); processor.connect(silence); silence.connect(capture.destination);
        processor.onaudioprocess = event => {
          if (finished || !current(epoch)) return;
          const input = event.inputBuffer.getChannelData(0), remaining = limit - frames;
          const chunk = input.slice(0, remaining); chunks.push(chunk); frames += chunk.length;
          if (frames >= limit) finish(true);
        };
        timer = setTimeout(() => finish(true), duration * 1000);
        emit('listening');
      });
      assertCurrent(epoch); emit('transcribing');
      const data = await request('transcribe', { audio: { data: base64(bytes), format: 'wav' } }, epoch);
      assertCurrent(epoch);
      const answer = text(data?.text, 800);
      if (!answer) throw failure('Не удалось разобрать ответ. Попробуй ещё раз или нажми кнопку.', 'empty_transcript');
      emit('idle'); return answer;
    } catch (error) { if (current(epoch)) emit('error', error.message); throw error; }
    finally { cleanup(); }
  }

  return { unlock, cancel, speak, review, status, recordReply,
    stopRecording() { if (!recordingStop) return false; recordingStop(true); return true; } };
}
