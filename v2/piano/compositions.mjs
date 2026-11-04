import { LESSONS } from './session.mjs?v=ee88d828b262';
import { FUR_ELISE_DATA } from './fur-elise.mjs?v=ee88d828b262';
import { BEGINNER_SONGS } from './beginner-songs.mjs?v=ee88d828b262';

export const MIDI_LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, notes: 5000, tracks: 64, events: 50000, seconds: 3600, minMidi: 48, maxMidi: 84 });

export class CompositionError extends Error {
  constructor(code, message) { super(message); this.name = 'CompositionError'; this.code = code; }
}
const fail = (code, message) => { throw new CompositionError(code, message); };
const text = (value, fallback) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 80) || fallback : fallback;

function describeTrack(track) {
  const notes = track.notes;
  const issues = [];
  if (track.channel === 9 || track.percussion) issues.push('percussion');
  if (notes.some(n => n.midi < MIDI_LIMITS.minMidi || n.midi > MIDI_LIMITS.maxMidi)) issues.push('range');
  let end = -Infinity;
  for (const note of notes) {
    if (note.time < end - 0.00001 && !issues.includes('polyphonic')) issues.push('polyphonic');
    end = Math.max(end, note.time + note.duration);
  }
  return { ...track, noteCount: notes.length, minMidi: Math.min(...notes.map(n => n.midi)), maxMidi: Math.max(...notes.map(n => n.midi)), issues, playable: notes.length > 0 && !issues.length };
}

function builtin(lesson) {
  let time = 0;
  const notes = lesson.notes.map((note, sourceIndex) => {
    const event = { ...note, time, duration: note.beats * 0.8, track: 'melody', sourceIndex };
    time += note.beats;
    return event;
  });
  const track = describeTrack({ id: 'melody', name: 'Мелодия', channel: 0, notes });
  return { id: lesson.id, arrangementVersion: 'flow-melody-v1', title: lesson.title, author: lesson.author, description: lesson.description, level: lesson.level, source: 'builtin', status: 'ready', legacyLessonId: lesson.id, tempo: 60, notes, tracks: [track], defaultTrack: track.id, fragments: buildFragments(notes), duration: time, hand: 'right' };
}

function furElise() {
  const source = FUR_ELISE_DATA;
  const secondsPerTick = 60 / source.tempo / source.ppq;
  const originalTracks = source.tracks.map((track, trackIndex) => describeTrack({
    id: track.id, name: trackIndex === 0 ? 'Вся верхняя партия · оригинал' : 'Вся нижняя партия · оригинал',
    channel: track.channel,
    notes: track.notes.map(([midi, ticks, durationTicks, velocity], sourceIndex) => ({
      id: `fur-elise/${track.id}/${sourceIndex}`, midi, ticks, durationTicks, velocity,
      time: ticks * secondsPerTick, duration: durationTicks * secondsPerTick,
      beats: durationTicks / source.ppq, track: track.id, sourceIndex,
    })),
  }));
  const notes = originalTracks[0].notes.slice(0, 35).map((note, index) => ({
    ...note, id: `fur-elise/theme/${index}`, track: 'theme',
    phraseStart: [0, 9, 17, 27].includes(index),
  }));
  const theme = describeTrack({ id: 'theme', name: 'Главная тема · правая рука · 35 нот', channel: 0, notes });
  return {
    id: 'fur-elise', arrangementVersion: 'mutopia-931-opening-35-v1',
    title: 'К Элизе · Für Elise', author: 'Людвиг ван Бетховен',
    description: 'Настоящая главная тема. Играй правую руку, левую или обе вместе. Трудное место можно повторить отдельно прямо в занятии.',
    level: 'После первых уроков', source: 'builtin-midi', status: 'ready',
    sourceUrl: source.sourceUrl, sourceLabel: 'Mutopia · Stelios Samelis · Public Domain',
    sourceLicense: source.license, sourceEdition: source.edition, sourceMidiSha256: source.sha256,
    fullMidiDataUrl: `data:audio/midi;base64,${source.midiBase64}`,
    fullMidiFilename: 'Beethoven-Fur-Elise-Mutopia-931.mid', midiSourceUrl: source.midiSourceUrl,
    tempo: source.tempo, hand: 'right', notes, tracks: [theme, ...originalTracks],
    defaultTrack: theme.id, fragments: buildFragments(notes),
    duration: Math.max(...notes.map(note => note.time + note.duration)),
    originalDuration: Math.max(...originalTracks.flatMap(track => track.notes.map(note => note.time + note.duration))),
    timeSignatures: [{ ticks: 0, numerator: 3, denominator: 8 }],
  };
}

export const FUR_ELISE = furElise();

export const COMPOSITIONS = [
  ...BEGINNER_SONGS,
  FUR_ELISE,
  
  ...LESSONS.filter(lesson => lesson.id !== 'first').map(builtin),
];

/** Divide a selected part into small sections without merging tracks or changing notes. */
export function buildFragments(notes, { maxNotes = 10 } = {}) {
  if (!Array.isArray(notes) || notes.length > MIDI_LIMITS.notes || !Number.isInteger(maxNotes) || maxNotes < 1 || maxNotes > 50) fail('fragment', 'Не удалось разбить композицию на фразы.');
  const fragments = [];
  for (let start = 0; start < notes.length;) {
    let end = Math.min(start + maxNotes, notes.length);
    for (let index = start + 1; index < end; index++) {
      if (notes[index].phraseStart === true) { end = index; break; }
    }
    const section = notes.slice(start, end).map(n => ({ ...n }));
    const index = fragments.length;
    fragments.push({ id: `fragment-${index}`, index, label: `Фраза ${index + 1} · ${section.length} нот`, start, end: start + section.length, startTime: section[0].time || 0, endTime: Math.max(...section.map(n => (n.time || 0) + (n.duration || 0))), notes: section });
    start = end;
  }
  return fragments;
}

function bytesFor(input) {
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  fail('file', 'Выбери MIDI-файл.');
}

// A small structural preflight bounds work before the third-party parser runs.
// @tonejs/midi remains responsible for all note, tempo and track interpretation.
function validateMidiEnvelope(bytes) {
  if (bytes.byteLength > MIDI_LIMITS.bytes) fail('size', 'MIDI-файл должен быть не больше 2 МБ.');
  if (bytes.byteLength < 14 || String.fromCharCode(...bytes.subarray(0, 4)) !== 'MThd') fail('file', 'Это не поддерживаемый MIDI-файл. Нужен файл .mid или .midi.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerSize = view.getUint32(4);
  if (headerSize < 6 || headerSize + 8 > bytes.length) fail('file', 'Повреждён заголовок MIDI-файла.');
  const format = view.getUint16(8), tracks = view.getUint16(10), division = view.getUint16(12);
  if (format > 1 || format === 0 && tracks !== 1) fail('format', 'Поддерживаются MIDI-файлы формата 0 и 1.');
  if (!tracks || tracks > MIDI_LIMITS.tracks) fail('tracks', 'В MIDI-файле слишком много дорожек.');
  if (!division || division & 0x8000) fail('timing', 'Нужен MIDI с обычным музыкальным темпом; SMPTE пока не поддерживается.');
  let position = 8 + headerSize, trackCount = 0, noteCount = 0, eventCount = 0;
  const bad = () => fail('file', 'MIDI-файл повреждён или содержит неподдерживаемые события.');
  while (position < bytes.length) {
    if (position + 8 > bytes.length) bad();
    const name = String.fromCharCode(...bytes.subarray(position, position + 4));
    const size = view.getUint32(position + 4), end = position + 8 + size;
    position += 8;
    if (end > bytes.length || name !== 'MTrk') bad();
    trackCount++;
    let running = null;
    const readVariable = () => {
      let value = 0;
      for (let i = 0; i < 4; i++) {
        if (position >= end) bad();
        const byte = bytes[position++]; value = value * 128 + (byte & 127);
        if (!(byte & 128)) return value;
      }
      bad();
    };
    while (position < end) {
      if (++eventCount > MIDI_LIMITS.events) fail('events', 'В MIDI-файле слишком много событий. Выбери короткую учебную версию.');
      readVariable();
      if (position >= end) bad();
      let status = bytes[position];
      if (status & 128) position++;
      else { if (running === null) bad(); status = running; }
      if (status === 255) {
        running = null;
        if (position >= end) bad();
        position++;
        const length = readVariable(); position += length;
      } else if (status === 240 || status === 247) {
        running = null; const length = readVariable(); position += length;
      } else if (status >= 128 && status <= 239) {
        running = status;
        const count = (status & 240) === 192 || (status & 240) === 208 ? 1 : 2;
        if (position + count > end || bytes[position] > 127 || count === 2 && bytes[position + 1] > 127) bad();
        if ((status & 240) === 144 && bytes[position + 1] > 0 && ++noteCount > MIDI_LIMITS.notes) fail('notes', 'В MIDI-файле больше 5000 нот. Выбери короткую учебную версию.');
        position += count;
      } else bad();
      if (position > end) bad();
    }
  }
  if (trackCount !== tracks) bad();
  return { noteCount, ppq: division };
}

function contentId(bytes) {
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return `midi-${hash.toString(16).padStart(8, '0')}-${bytes.length}`;
}

/** The caller loads vendor/tone-midi.js as a classic script before app.mjs. */
export function parseMidiComposition(input, filename = 'Моя композиция.mid', { MidiClass = globalThis.Midi } = {}) {
  const bytes = bytesFor(input), envelope = validateMidiEnvelope(bytes);
  if (typeof MidiClass !== 'function') fail('parser', 'Не загрузился модуль MIDI. Обнови страницу и попробуй снова.');
  let midi;
  try { midi = new MidiClass(bytes); } catch { fail('file', 'Не удалось прочитать MIDI-файл. Попробуй другую версию файла.'); }
  const id = contentId(bytes), tracks = [];
  let noteCount = 0;
  for (let index = 0; index < midi.tracks.length; index++) {
    const part = midi.tracks[index];
    if (!part.notes.length) continue;
    const trackId = `track-${index}`;
    const notes = Array.from(part.notes, (n, sourceIndex) => {
      if (!Number.isInteger(n.midi) || n.midi < 0 || n.midi > 127 || !Number.isFinite(n.time) || n.time < 0 || !Number.isFinite(n.duration) || n.duration <= 0 || n.time + n.duration > MIDI_LIMITS.seconds || !Number.isFinite(n.durationTicks) || n.durationTicks <= 0) fail('notes', 'В файле есть ноты с неподдерживаемой высотой или длительностью.');
      return { id: `${id}/${trackId}/${sourceIndex}`, midi: n.midi, time: n.time, duration: n.duration, beats: n.durationTicks / envelope.ppq, ticks: n.ticks, durationTicks: n.durationTicks, velocity: n.velocity, track: trackId, sourceIndex };
    }).sort((a, b) => a.time - b.time || a.midi - b.midi);
    noteCount += notes.length;
    tracks.push(describeTrack({ id: trackId, name: text(part.name, `Дорожка ${index + 1}`), channel: part.channel, percussion: part.instrument?.percussion === true, notes }));
  }
  if (noteCount !== envelope.noteCount || noteCount > MIDI_LIMITS.notes) fail('notes', 'Не все ноты файла удалось прочитать. Попробуй другой MIDI-файл.');
  if (!noteCount) fail('empty', 'В MIDI-файле не найдены ноты.');
  const notes = tracks.flatMap(track => track.notes).sort((a, b) => a.time - b.time || a.midi - b.midi);
  const defaultTrack = tracks.find(track => track.playable) || tracks[0];
  const sourceName = text(filename, 'Моя композиция.mid');
  const title = text(sourceName.replace(/\.(mid|midi)$/i, ''), 'Моя композиция');
  const tempo = midi.header.tempos?.[0]?.bpm || 120;
  return { id, arrangementVersion: id, title, author: 'Импортированный MIDI', description: 'Выбери дорожку и учи её короткими фразами.', source: 'midi', sourceName, status: 'ready', level: 'Мой файл', tempo, duration: Math.max(...notes.map(n => n.time + n.duration)), notes, tracks, defaultTrack: defaultTrack.id, fragments: buildFragments(defaultTrack.notes), hand: 'choose', timeSignatures: Array.from(midi.header.timeSignatures, s => ({ ticks: s.ticks, numerator: s.timeSignature[0], denominator: s.timeSignature[1] })) };
}

const issueMessages = {
  percussion: 'Эта дорожка содержит ударные. Выбери мелодию или партию фортепиано.',
  range: 'В этой дорожке есть ноты вне диапазона C3–C6. Выбери другую учебную версию; ноты не были перенесены или удалены.',
  polyphonic: 'В этой дорожке звучат несколько нот одновременно. Текущий микрофон проверяет одиночные ноты — выбери отдельную одноголосную партию.',
};

export function toPracticeNotes(composition, { track = composition?.defaultTrack, fragment = 'all' } = {}) {
  if (!composition || composition.status !== 'ready') fail('needsImport', 'Сначала добавь MIDI-файл учебной аранжировки.');
  const selected = typeof track === 'number' ? composition.tracks[track] : composition.tracks.find(t => t.id === track);
  if (!selected) fail('track', 'Выбери дорожку композиции.');
  if (!selected.playable) fail(selected.issues[0] || 'empty', issueMessages[selected.issues[0]] || 'На этой дорожке пока нечего играть.');
  let notes = selected.notes;
  if (fragment !== 'all') {
    const fragments = buildFragments(notes);
    const chosen = typeof fragment === 'number' ? fragments[fragment] : fragments.find(f => f.id === fragment);
    if (!chosen) fail('fragment', 'Выбери фразу композиции.');
    notes = chosen.notes;
  }
  return notes.map(n => ({ ...n }));
}
