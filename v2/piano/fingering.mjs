import { COURSE } from './course.mjs?v=e22f21ea3ada';
import { noteInfo } from './pitch.mjs?v=e22f21ea3ada';

const FINGER_WHITE_POSITION = [60, 62, 64, 65, 67];
const FINGER_NAMES = ['', 'большой палец', 'указательный палец', 'средний палец', 'безымянный палец', 'мизинец'];
const FINGER_COURSE = new Map(COURSE.map(lesson => [lesson.id, lesson]));
const fingerHand = value => value === 'right' || value === 'Правая рука' ? 'right' :
  value === 'left' || value === 'Левая рука' ? 'left' :
  ['both', 'Обе руки', 'Руки по очереди'].includes(value) ? 'both' : null;
const validFinger = finger => Number.isInteger(finger) && finger >= 1 && finger <= 5;
const positionFinger = (midi, hand) => {
  const index = FINGER_WHITE_POSITION.indexOf(midi);
  return index < 0 ? null : hand === 'left' ? 5 - index : index + 1;
};

/** Numbers identify fingers on either hand; they do not measure the player's technique. */
export function fingerLegend(hand) {
  const side = fingerHand(hand);
  const prefix = side === 'right' ? 'Правая рука: ' : side === 'left' ? 'Левая рука: ' : '';
  return prefix + FINGER_NAMES.slice(1).map((name, index) => `${index + 1} — ${name}`).join('; ') + '.';
}

/** Occasional hints only. Source pitches are transposed exactly once via octave. */
export function getFingerHint(lesson, options = {}) {
  if (!lesson || !options || typeof options !== 'object' || Array.isArray(options)) return null;
  const { index = 0, hand: requested, octave = 0, reason = 'start' } = options;
  const notes = lesson.notes;
  if (!Array.isArray(notes) || !notes.length || notes.length > 5000 || !Number.isInteger(index) || index < 0 || index >= notes.length ||
      ![-1, 0, 1].includes(octave) || !['start', 'resume', 'rhythm'].includes(reason) ||
      requested !== undefined && !['left', 'right', 'both'].includes(requested)) return null;
  const note = notes[index], midi = note?.midi + octave * 12;
  if (!Number.isInteger(note?.midi) || note.midi < 0 || note.midi > 127 || midi < 0 || midi > 127) return null;
  const canonical = FINGER_COURSE.get(lesson.id);
  const declared = fingerHand(lesson.hand ?? canonical?.hand);
  const assigned = fingerHand(note.hand);
  if (note.hand !== undefined && !['left', 'right'].includes(assigned)) return null;
  const hand = assigned || (declared !== 'both' ? declared : null) || (!declared && ['left', 'right'].includes(requested) ? requested : null);
  if (!hand || requested && requested !== 'both' && requested !== hand || declared && declared !== 'both' && declared !== hand) return null;

  let finger, position;
  if (Object.hasOwn(note, 'finger')) {
    if (!validFinger(note.finger)) return null;
    finger = note.finger;
  } else {
    // An excerpt of a wide-range course or an arbitrary MIDI is not a five-finger exercise.
    const canonicalHand = fingerHand(canonical?.hand);
    if (!canonical || canonicalHand !== hand || !canonical.notes.every(item => FINGER_WHITE_POSITION.includes(item.midi)) ||
        !notes.every(item => FINGER_WHITE_POSITION.includes(item?.midi) &&
          (item.hand === undefined || fingerHand(item.hand) === hand) &&
          (!Object.hasOwn(item, 'finger') || validFinger(item.finger) && item.finger === positionFinger(item.midi, hand)))) return null;
    finger = positionFinger(note.midi, hand);
    const startMidi = 60 + octave * 12, endMidi = 67 + octave * 12;
    position = { startMidi, endMidi, thumbMidi: hand === 'right' ? startMidi : endMidi,
      littleMidi: hand === 'right' ? endMidi : startMidi,
      text: hand === 'right' ? 'Правая: большой на До слева от двух чёрных, мизинец на Соль.' :
        'Левая: мизинец на До слева от двух чёрных, большой на Соль.' };
  }
  const repeated = notes[index - 1]?.midi === note.midi || notes[index + 1]?.midi === note.midi;
  const text = `${noteInfo(midi).name} — ${finger}, ${FINGER_NAMES[finger]} ${hand === 'right' ? 'правой' : 'левой'} руки.` +
    (repeated ? ' Между повторами отпускай клавишу.' : '');
  return { midi, finger, hand, text, ...(position ? { position } : {}) };
}
