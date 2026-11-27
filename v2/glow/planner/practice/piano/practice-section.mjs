const GROUP_WINDOW_SECONDS = .035;
const MAX_SECONDS = 86400;
const validTime = value => Number.isFinite(value) && value >= 0 && value <= MAX_SECONDS;

function bounds(notes, start, end) {
  if (!Array.isArray(notes) || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > notes.length) {
    throw new RangeError('Practice section bounds are outside the score.');
  }
}

/** Choose a short repeat around measured mistakes, never split a chord. */
export function chooseProblemSection(notes, report, { size = 6 } = {}) {
  if (!Array.isArray(notes) || notes.length > 5000) throw new TypeError('Practice section needs at most 5000 notes.');
  if (!Number.isInteger(size) || size <= 0 || size > 5000) throw new RangeError('Practice section size must be between 1 and 5000.');
  if (!notes.length) return { start: 0, end: 0 };
  const counts = new Map();
  for (const error of Array.isArray(report?.errors) ? report.errors : []) {
    if (Number.isInteger(error?.index) && error.index >= 0 && error.index < notes.length) counts.set(error.index, (counts.get(error.index) || 0) + 1);
  }
  const focus = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
  const length = Math.min(size, notes.length), before = Math.min(2, length - 1);
  let start = Math.max(0, Math.min(focus - before, notes.length - length)), end = start + length;
  const groupStart = [], groupEnd = [];
  // Anchor each group to its first onset, matching ChordSession rather than
  // chaining an entire fast arpeggio through small adjacent differences.
  for (let first = 0; first < notes.length;) {
    let last = first + 1;
    const firstTime = notes[first]?.time;
    if (validTime(firstTime)) {
      while (last < notes.length && validTime(notes[last]?.time) && notes[last].time >= firstTime && notes[last].time - firstTime <= GROUP_WINDOW_SECONDS + 1e-9) last++;
    }
    for (let index = first; index < last; index++) { groupStart[index] = first; groupEnd[index] = last; }
    first = last;
  }
  start = groupStart[start]; end = groupEnd[end - 1];
  return { start, end };
}

/** Clip accompaniment in source seconds, then rebase it exactly like the notes. */
export function sectionBacking(events, notes, { start, end } = {}) {
  if (!Array.isArray(events) || events.length > 10000) throw new TypeError('Practice accompaniment needs at most 10000 events.');
  bounds(notes, start, end);
  // Course exercises use beats and have no accompaniment; do not invent their
  // source seconds just to return an empty backing track.
  if (!events.length || start === end) return [];
  const sourceStart = notes[start]?.time;
  if (!validTime(sourceStart)) throw new TypeError('Timed notes are required to align accompaniment.');
  let sourceEnd = sourceStart, previous = -Infinity;
  for (let index = start; index < end; index++) {
    const note = notes[index];
    if (!note || !validTime(note.time) || note.time < previous || !Number.isFinite(note.duration) || note.duration <= 0 || note.time + note.duration > MAX_SECONDS) {
      throw new TypeError('Timed notes are required to align accompaniment.');
    }
    previous = note.time;
    sourceEnd = Math.max(sourceEnd, note.time + note.duration);
  }
  return events.flatMap(event => {
    if (!event || !validTime(event.time) || !Number.isFinite(event.duration) || event.duration <= 0 || event.time + event.duration > MAX_SECONDS) {
      throw new TypeError('Accompaniment events need valid source seconds.');
    }
    const clippedStart = Math.max(sourceStart, event.time), clippedEnd = Math.min(sourceEnd, event.time + event.duration);
    if (clippedEnd <= clippedStart) return [];
    return [{ ...event, time: clippedStart - sourceStart, duration: clippedEnd - clippedStart }];
  });
}
