const MAX_VOICES = 24, MAX_EVENTS = 10000, LOOKAHEAD = .08, EPSILON = .000001;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

/**
 * A quiet, bounded synth following the score's virtual seconds. It never owns
 * a wall-clock transport: waiting/pausing the score also stops its accompaniment.
 * Percussion is deliberately omitted rather than played as pitched piano keys.
 */
export function createAccompanimentPlayer(context) {
  if (!context?.createGain || !context?.createOscillator) throw new TypeError('An AudioContext is required.');
  const master = context.createGain(); master.gain.value = .09; master.connect(context.destination);
  let events = [], excluded = 0, volume = .25, moving = false, lastCursor = null, lastGate = Infinity, disposed = false;
  const voices = new Map(), played = new Set();

  function disconnect(voice) {
    if (voice.disconnected) return;
    voice.disconnected = true; voice.oscillator.onended = null;
    try { voice.oscillator.disconnect(); } catch {}
    try { voice.gain.disconnect(); } catch {}
    if (voices.get(voice.index) === voice) voices.delete(voice.index);
  }
  function release(voice, hard = false) {
    if (voice.disconnected || voice.retiring && !hard) return;
    voice.retiring = true;
    const now = context.currentTime;
    const stopAt = hard || voice.startAt > now ? now : Math.max(now, Math.min(now + .018, voice.stopAt));
    try {
      voice.gain.gain.cancelScheduledValues(now);
      if (!hard && stopAt > now) voice.gain.gain.setTargetAtTime(0, now, .004);
      else voice.gain.gain.setValueAtTime(0, now);
      voice.oscillator.stop(stopAt);
    } catch {}
    voice.stopAt = stopAt;
    if (hard || stopAt <= now) disconnect(voice);
  }
  function silence(hard = false) {
    for (const voice of [...voices.values()]) release(voice, hard);
  }
  function stop() {
    silence(true); played.clear(); moving = false; lastCursor = null; lastGate = Infinity;
  }
  function load(source, { tempo = 60, sourceTempo = 60, octave = 0 } = {}) {
    if (disposed) throw new Error('Accompaniment player is disposed.');
    if (!Array.isArray(source) || source.length > MAX_EVENTS || !Number.isFinite(tempo) || tempo <= 0 ||
        !Number.isFinite(sourceTempo) || sourceTempo <= 0 || ![-1, 0, 1].includes(octave)) throw new TypeError('Invalid accompaniment configuration.');
    const speed = tempo / sourceTempo;
    if (!Number.isFinite(speed) || speed <= 0) throw new RangeError('Invalid accompaniment tempo.');
    let percussionExcluded = 0;
    const next = source.flatMap((note, index) => {
      if (!note || !Number.isFinite(note.time) || note.time < 0 || !Number.isFinite(note.duration) || note.duration <= 0 ||
          !Number.isInteger(note.midi) || note.midi < 0 || note.midi > 127) throw new TypeError('Invalid accompaniment note.');
      if (note.percussion === true || note.channel === 9) { percussionExcluded++; return []; }
      const midi = note.midi + octave * 12, time = note.time / speed, duration = note.duration / speed;
      if (midi < 0 || midi > 127 || !Number.isFinite(time + duration) || time + duration > 86400) throw new RangeError('Accompaniment note exceeds the supported range.');
      return [{ index, midi, time, duration, velocity: Number.isFinite(note.velocity) ? clamp(note.velocity, 0, 1) : .65 }];
    }).sort((a, b) => a.time - b.time || a.index - b.index);
    stop(); events = next; excluded = percussionExcluded;
    return { noteCount: events.length, percussionExcluded: excluded,
      duration: events.length ? Math.max(...events.map(note => note.time + note.duration)) : 0 };
  }
  function setVolume(value) {
    if (!Number.isFinite(value)) throw new TypeError('Volume must be finite.');
    volume = clamp(value, 0, 1);
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now); master.gain.setTargetAtTime(volume * .36, now, .018);
    return volume;
  }
  function startVoice(note, cursor, gate) {
    const end = Math.min(note.time + note.duration, gate), start = Math.max(cursor, note.time);
    if (end - start <= EPSILON) return;
    const priority = note.velocity + (note.midi < 52 ? 1 : 0);
    if (voices.size >= MAX_VOICES) {
      let quietest;
      for (const voice of voices.values()) if (!quietest || voice.priority < quietest.priority) quietest = voice;
      if (quietest && priority > quietest.priority) release(quietest, true);
      else return;
    }
    const now = context.currentTime, startAt = now + Math.max(0, note.time - cursor), stopAt = now + end - cursor;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = note.midi < 52 ? 'sine' : 'triangle'; oscillator.frequency.value = frequency(note.midi);
    oscillator.connect(gain); gain.connect(master);
    const duration = stopAt - startAt, peak = (.045 + note.velocity * .09) * (note.time < cursor ? .6 : 1);
    const attack = Math.min(.008, duration / 4), releaseTime = Math.min(.024, duration / 4);
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(peak, startAt + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0001, peak * .4), Math.max(startAt + attack, stopAt - releaseTime));
    gain.gain.linearRampToValueAtTime(0, stopAt);
    const voice = { index: note.index, oscillator, gain, startAt, stopAt, priority, retiring: false, disconnected: false };
    voices.set(note.index, voice); oscillator.onended = () => disconnect(voice);
    try { oscillator.start(startAt); oscillator.stop(stopAt); }
    catch { disconnect(voice); }
  }
  function sync(cursor, { moving: shouldMove = false, gate = Infinity } = {}) {
    if (!Number.isFinite(cursor) || !(Number.isFinite(gate) || gate === Infinity)) throw new TypeError('Invalid accompaniment clock.');
    if (disposed) return { activeVoices: 0, moving: false, percussionExcluded: excluded };
    const now = context.currentTime;
    for (const voice of [...voices.values()]) if (voice.stopAt <= now) disconnect(voice);
    const willMove = shouldMove === true && cursor < gate - EPSILON && context.state !== 'closed' && context.state !== 'suspended';
    if (!willMove) {
      if (moving) silence();
      moving = false; lastCursor = cursor; lastGate = gate;
      return { activeVoices: voices.size, moving: false, percussionExcluded: excluded };
    }
    // A seek, resume, or changed waiting boundary invalidates scheduled tails.
    // Rebuild only notes still sounding at this cursor and not yet-started notes.
    if (!moving || lastCursor !== null && cursor < lastCursor - .02 || gate !== lastGate) {
      silence(true); played.clear();
    }
    moving = true; lastCursor = cursor; lastGate = gate;
    const horizon = Math.min(cursor + LOOKAHEAD, gate);
    for (const note of events) {
      if (note.time > horizon) break;
      if (note.time >= gate - EPSILON || note.time + note.duration <= cursor + EPSILON || played.has(note.index)) continue;
      played.add(note.index); startVoice(note, cursor, gate);
    }
    return { activeVoices: voices.size, moving: true, percussionExcluded: excluded };
  }
  function dispose() {
    stop(); disposed = true; events = [];
    try { master.disconnect(); } catch {}
  }
  return { load, setVolume, sync, stop, dispose };
}
