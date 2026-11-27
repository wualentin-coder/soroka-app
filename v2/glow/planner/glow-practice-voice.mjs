import { getModuleHost } from './runtime-session.js';
import { wavBase64 } from './practice/voice-wav.mjs';

const maximumSeconds = 25;
const lockedSeconds = 120;
const sampleFloor = .03;

function audioSlices(chunks, rate) {
  const limit = rate * maximumSeconds;
  const slices = [];
  let pending = [], frames = 0;
  for (const chunk of chunks) {
    if (frames + chunk.length > limit && pending.length) {
      slices.push(pending);
      pending = []; frames = 0;
    }
    pending.push(chunk);
    frames += chunk.length;
  }
  if (pending.length) slices.push(pending);
  return slices;
}
export const voiceAvailable = () => !!(navigator.mediaDevices?.getUserMedia && (window.AudioContext || window.webkitAudioContext));

export function createPracticeVoice(onState) {
  let session;
  const current = value => value === session && !document.hidden && value.active();
  function release(value) {
    clearTimeout(value.limit);
    if (value.input) value.input.onaudioprocess = null;
    value.input?.disconnect();
    value.source?.disconnect();
    value.stream?.getTracks().forEach(track => track.stop());
    if (value.context?.state !== 'closed') void value.context?.close().catch(() => {});
    value.stream = value.source = value.input = value.context = null;
  }
  function end(value, state = 'idle', message = '') {
    release(value);
    value.chunks = [];
    if (value !== session) return;
    session = null;
    onState(value.kind, state, message);
  }
  function arm(value) {
    clearTimeout(value.limit);
    const duration = value.extended ? lockedSeconds : maximumSeconds;
    value.limit = setTimeout(() => void finish(), Math.max(0, duration * 1000 - (performance.now() - value.started)));
  }
  async function start({ kind, active, onText, onLevel }) {
    if (session) return;
    const value = session = { kind, active, onText, state: 'requesting', chunks: [], peak: 0 };
    onState(kind, value.state, 'Запрашиваем микрофон…');
    try {
      if (!voiceAvailable()) throw Error('Микрофон недоступен в этом браузере');
      const Context = window.AudioContext || window.webkitAudioContext;
      value.context = new Context();
      // Open the microphone in the gesture. Authorization is checked again before sending.
      const access = getModuleHost('englishVoice');
      void access.catch(() => {});
      value.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }, video: false,
      });
      if (!current(value)) { end(value); return; }
      value.host = await access;
      if (!current(value) || !value.host.isCurrent()) { end(value); return; }
      await value.context.resume();
      if (!current(value) || !value.host.isCurrent()) { end(value); return; }
      value.source = value.context.createMediaStreamSource(value.stream);
      value.input = value.context.createScriptProcessor(2048, 1, 1);
      value.input.onaudioprocess = event => {
        if (!current(value) || value.state !== 'listening') return;
        const data = event.inputBuffer.getChannelData(0);
        value.chunks.push(new Float32Array(data));
        let peak = 0;
        for (let i = 0; i < data.length; i += 16) peak = Math.max(peak, Math.abs(data[i]));
        value.peak = Math.max(value.peak, peak);
        onLevel?.(peak);
      };
      value.source.connect(value.input);
      value.input.connect(value.context.destination);
      value.state = 'listening';
      value.started = performance.now();
      arm(value);
      onState(kind, value.state, 'Идёт запись');
    } catch (error) {
      end(value, 'idle', error.name === 'NotAllowedError' ? 'Разреши доступ к микрофону' : error.message || 'Не удалось включить микрофон');
    }
  }
  async function finish() {
    const value = session;
    if (value?.state !== 'listening') return;
    if (!current(value) || !value.host.isCurrent()) { end(value); return; }
    const rate = value.context.sampleRate;
    release(value);
    if (!value.chunks.length || value.peak < sampleFloor) { end(value, 'idle', 'Ничего не слышно. Попробуй ещё раз'); return; }
    value.state = 'transcribing';
    onState(value.kind, value.state, 'Распознаём речь…');
    try {
      const slices = audioSlices(value.chunks, rate);
      value.chunks = [];
      const phrases = [];
      for (const frames of slices) {
        if (!current(value) || !value.host.isCurrent()) { end(value); return; }
        if (!frames.some(chunk => chunk.some(sample => Math.abs(sample) >= sampleFloor))) continue;
        const answer = await value.host.request('transcribe', { audio: wavBase64(frames, rate) });
        if (!current(value) || !value.host.isCurrent()) { end(value); return; }
        if (typeof answer?.text === 'string' && answer.text.trim()) phrases.push(answer.text.trim());
      }
      const text = phrases.join(' ').slice(0, 4000);
      if (!text) throw Error('Речь не распознана. Попробуй ещё раз');
      value.onText(text);
      end(value);
    } catch (error) { end(value, 'idle', error.message || 'Не удалось распознать речь'); }
  }
  return {
    start, finish,
    extend() {
      if (!session || !['requesting', 'listening'].includes(session.state)) return;
      session.extended = true;
      if (session.state === 'listening') arm(session);
    },
    cancel: () => { if (session) end(session); },
  };
}
