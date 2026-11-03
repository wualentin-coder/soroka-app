const API = '/api/tutor/';
const AUDIO_LIMIT = 1_500_000;
const SPEECH_LIMIT = 3_000_000;

function aborted() { const error = new Error('Разговор отменён.'); error.name = 'AbortError'; return error; }
function failure(message, code = 'teacher_failed') { const error = new Error(message); error.code = code; return error; }
function text(value, max) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

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
    speechSynthesis: pick('speechSynthesis', globalThis.speechSynthesis),
    Utterance: pick('SpeechSynthesisUtterance', globalThis.SpeechSynthesisUtterance),
    AudioContext: pick('AudioContext', globalThis.AudioContext || globalThis.webkitAudioContext),
    getUserMedia: pick('getUserMedia', globalThis.navigator?.mediaDevices?.getUserMedia?.bind(globalThis.navigator.mediaDevices)),
    now: pick('now', Date.now),
  };
  let generation = 0, playbackContext = null, cachedStatus = null;
  let localStop = null, audioStop = null, recordingStop = null;
  const controllers = new Set(), cancelHooks = new Set();
  const emit = (value, detail) => onStatus(value, detail);
  const current = epoch => epoch === generation;
  const assertCurrent = epoch => { if (!current(epoch)) throw aborted(); };

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
      const response = await environment.fetch(API + route, { method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      assertCurrent(epoch);
      if (!response.ok) {
        let data; try { data = await response.json(); } catch {}
        throw failure(text(data?.error, 220) || 'Преподаватель временно недоступен. Попробуй ещё раз.', text(data?.code, 80) || 'request_failed');
      }
      if (!audio) {
        const data = await response.json(); assertCurrent(epoch); return data;
      }
      if (!(response.headers.get('content-type') || '').toLowerCase().startsWith('audio/')) throw failure('Не удалось получить голосовой ответ.', 'invalid_audio');
      const parts = []; let size = 0;
      const reader = response.body?.getReader();
      if (!reader) throw failure('Голосовой ответ оказался пустым.', 'invalid_audio');
      while (true) {
        const chunk = await reader.read(); assertCurrent(epoch);
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
      const response = await environment.fetch(API + 'status', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      const data = response.ok ? await response.json() : {};
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
        if (localStop === stop) localStop = null;
        resolve(success && current(epoch));
      };
      const stop = () => { environment.speechSynthesis.cancel(); finish(false); };
      localStop = stop;
      utterance.onend = () => finish(true); utterance.onerror = () => finish(false);
      timer = setTimeout(stop, Math.max(4000, Math.min(60000, value.length * 90 + 3000)));
      try { environment.speechSynthesis.speak(utterance); } catch { finish(false); }
    });
  }

  async function speakRemote(value, epoch) {
    const ready = await status(); assertCurrent(epoch);
    if (!ready.ready || !ready.speech || !environment.AudioContext) return false;
    const bytes = await request('speech', { text: value }, epoch, true);
    assertCurrent(epoch);
    if (!playbackContext || playbackContext.state === 'closed') return false;
    await playbackContext.resume(); assertCurrent(epoch);
    if (playbackContext.state !== 'running') return false;
    const buffer = await playbackContext.decodeAudioData(bytes.buffer.slice(0)); assertCurrent(epoch);
    emit('speaking', 'openrouter');
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

  async function speak(value, { remote = false } = {}) {
    value = text(value, 1600); if (!value) return false;
    const epoch = begin('preparing'); onText(value);
    try {
      const methods = remote ? [speakRemote, speakLocal] : [speakLocal, speakRemote];
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
    const body = { lesson: { id: text(lesson?.id, 80), title: text(lesson?.title, 120), instruction: text(lesson?.instruction, 1000) },
      report: { total: report?.total, firstAttemptCorrect: report?.firstAttemptCorrect,
        wrong: report?.wrong, skipped: report?.skipped, finished: report?.finished,
        demo: report?.demo === true, mode: report?.mode === 'check' ? 'check' : 'learn', errors: Array.isArray(report?.errors) ? report.errors.slice(0, 24) : [] } };
    if (route === 'reply') { body.question = text(question, 800); body.previousResponse = text(previousResponse, 1600); }
    try {
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
    stopRecording() { recordingStop?.(true); } };
}
