const HANDS = ['right', 'left', 'both'];
const MIN_KEY = 36, MAX_KEY = 96, MAX_EVENTS = 10000;
const EPSILON = 0.00001;

export class ArrangementError extends Error {
  constructor(code, message) { super(message); this.name = 'ArrangementError'; this.code = code; }
}
const fail = (code, message) => { throw new ArrangementError(code, message); };
const endOf = notes => Math.max(...notes.map(note => note.time + note.duration));
const percussion = track => track.percussion === true || track.channel === 9;
const ordered = notes => notes.sort((a, b) => a.time - b.time || a.midi - b.midi || String(a.id || '').localeCompare(String(b.id || '')));

function validateTracks(composition) {
  if (!composition || !Array.isArray(composition.tracks) || composition.tracks.length > 64) fail('composition', 'В этой композиции нет подходящих партий.');
  let count = 0;
  for (const track of composition.tracks) {
    if (!track || typeof track.id !== 'string' || !Array.isArray(track.notes)) fail('composition', 'Не удалось прочитать партию композиции.');
    count += track.notes.length;
    if (count > MAX_EVENTS) fail('size', 'В композиции слишком много нот.');
    for (const note of track.notes) {
      if (!note || !Number.isInteger(note.midi) || note.midi < 0 || note.midi > 127 ||
          !Number.isFinite(note.time) || note.time < 0 || !Number.isFinite(note.duration) || note.duration <= 0 ||
          note.time + note.duration > 86400) fail('notes', 'В партии есть некорректные ноты или время.');
    }
  }
  return composition.tracks.filter(track => track.notes.length);
}

function hasOverlaps(notes) {
  let end = -Infinity;
  for (const note of notes) {
    if (note.time < end - EPSILON) return true;
    end = Math.max(end, note.time + note.duration);
  }
  return false;
}

function sourceParts(composition, tracks) {
  const right = tracks.find(track => track.id === composition.defaultTrack);
  if (!right || percussion(right)) fail('melody', 'В композиции не выбрана мелодия для игры.');
  if (composition.id === 'fur-elise' && right.id === 'theme') {
    return { right, left: tracks.find(track => track.id === 'original-1'),
      others: [], curated: true };
  }
  if (composition.id === 'fly-me-to-the-moon' && right.id === 'track-28') {
    const left = tracks.find(track => track.id === 'track-15');
    // This supplied MIDI is a big-band arrangement. Its real nylon-guitar
    // comping is the harmony; winds and solo lines are not a piano practice bed.
    const harmony = tracks.find(track => track.id === 'track-16' && !percussion(track));
    return { right, left, others: harmony ? [harmony] : [], curated: true,
      cleanBacking: true, originalBassBacking: true };
  }
  // Only an explicit part name can assign an imported lower part. Do not guess
  // hands from pitch, instrument ordering, channels or an arbitrary second track.
  const namedLeft = tracks.filter(track => track !== right && !percussion(track) &&
    /\bleft\b|\blh\b|\bbass\b|\blower\b|лев|бас/iu.test(track.name || ''));
  const left = namedLeft.length === 1 ? namedLeft[0] : null;
  return { right, left, others: tracks.filter(track => track !== right && track !== left), curated: false };
}

function partNotes(track, start, end, hand) {
  if (!track) return [];
  return track.notes.filter(note => note.time < end - EPSILON && note.time + note.duration > start + EPSILON)
    .map(note => ({ ...note, hand, sourceTrack: track.id,
      sourceTime: note.time, sourceDuration: note.duration,
      channel: track.channel ?? 0, percussion: percussion(track) }));
}

function clipAndRebase(notes, start, end, transpose = 0) {
  return notes.filter(note => note.time < end - EPSILON && note.time + note.duration > start + EPSILON).map(note => {
    const clippedStart = Math.max(start, note.time), clippedEnd = Math.min(end, note.time + note.duration);
    return { ...note, originalMidi: note.originalMidi ?? note.midi, midi: note.midi + transpose,
      time: Math.max(0, clippedStart - start), duration: clippedEnd - clippedStart };
  });
}

/**
 * Actual parts of the supplied MIDI, with source seconds retained at every
 * tempo. Times are rebased once to the first selected playable note. Apply
 * tempo/sourceTempo later to BOTH notes and backing; tempo does not rewrite
 * this data. Source tracks and notes are never changed.
 */
export function createArrangement(composition, { hand = 'right', octave = 0, tempo = 60 } = {}) {
  if (!HANDS.includes(hand)) fail('hand', 'Выбери правую руку, левую или обе руки.');
  if (![-1, 0, 1].includes(octave)) fail('octave', 'Нужна соседняя или исходная октава.');
  if (!Number.isFinite(tempo) || tempo <= 0) fail('tempo', 'Не удалось выбрать темп.');
  const tracks = validateTracks(composition), parts = sourceParts(composition, tracks);
  const sourceTempo = Number.isFinite(composition.tempo) && composition.tempo > 0 ? composition.tempo : 60;
  const windowStart = Math.min(...parts.right.notes.map(note => note.time));
  const windowEnd = endOf(parts.right.notes);
  const right = partNotes(parts.right, windowStart, windowEnd, 'right');
  const left = partNotes(parts.left, windowStart, windowEnd, 'left');
  const availableHands = left.length ? ['right', 'left', 'both'] : ['right'];
  if (!availableHands.includes(hand)) fail('hand_unavailable', 'В этом MIDI нет отдельной партии левой руки.');

  // The owner's bass part reaches E1 (28), below this 61-key Casio. Move the
  // entire bass part by one octave, report that arrangement change explicitly,
  // and keep its original pitches for source comparison. Never fold notes.
  const leftTranspose = left.length && Math.min(...left.map(note => note.midi)) < MIN_KEY &&
    Math.min(...left.map(note => note.midi)) + 12 >= MIN_KEY &&
    Math.max(...left.map(note => note.midi)) + 12 <= MAX_KEY ? 12 : 0;
  const adaptedLeft = left.map(note => ({ ...note, originalMidi: note.midi, midi: note.midi + leftTranspose }));
  let main = hand === 'right' ? right : hand === 'left' ? adaptedLeft : [...right, ...adaptedLeft];
  main = ordered(main.map(note => ({ ...note })));
  const sourceStart = Math.max(windowStart, main[0].time);
  const notes = ordered(clipAndRebase(main, sourceStart, windowEnd, octave * 12));
  const otherNotes = parts.others.flatMap(track => partNotes(track, windowStart, windowEnd, null));
  // Only the student's lower part needs the 61-key adaptation. Automated bass
  // playback can keep the supplied MIDI's original low register.
  const automaticLeft = parts.originalBassBacking ? left : adaptedLeft;
  const backingParts = hand === 'right' ? [...automaticLeft, ...otherNotes] : hand === 'left' ? [...right, ...otherNotes] : otherNotes;
  const backing = ordered(clipAndRebase(backingParts, sourceStart, windowEnd));
  const outside = notes.filter(note => note.midi < MIN_KEY || note.midi > MAX_KEY);
  const rangeIssue = outside.length ? 'В партии есть ноты за пределами 61 клавиши Casio. Выбери другую октаву.' : null;
  const descriptions = [hand === 'both' ? 'Обе партии вместе.' : hand === 'left' ? 'Партия левой руки.' : parts.curated ? 'Основная мелодия правой рукой.' : 'Основная мелодия; руку выбираешь сам.'];
  if (leftTranspose && (!parts.originalBassBacking || hand !== 'right')) descriptions.push('Бас поднят на октаву для 61-клавишного Casio.');
  if (octave) descriptions.push(octave > 0 ? 'Твоя партия звучит на октаву выше.' : 'Твоя партия звучит на октаву ниже.');
  if (rangeIssue) descriptions.push(rangeIssue);
  let backingDescription;
  if (parts.cleanBacking) {
    const labels = [];
    if (hand === 'right' && left.length) labels.push('бас');
    if (hand === 'left' && right.length) labels.push('мелодия');
    if (otherNotes.length) labels.push('аккорды');
    const label = labels.join(' и ');
    backingDescription = label ? `${label[0].toUpperCase()}${label.slice(1)} из исходного MIDI.` : 'В этом MIDI нет отдельного сопровождения.';
  }
  return { notes, backing, backingDescription, availableHands, sourceTempo, sourceStart, sourceEnd: windowEnd,
    duration: endOf(notes), playbackRate: tempo / sourceTempo, description: descriptions.join(' '),
    hand, rangeIssue, leftTranspose, requiresMidi: hand === 'both' || hasOverlaps(notes),
    sourceTrackIds: { right: parts.right.id, left: left.length ? parts.left.id : null },
    handAssignment: parts.curated ? 'curated' : parts.left ? 'explicit-track-name' : 'practice-choice' };
}
