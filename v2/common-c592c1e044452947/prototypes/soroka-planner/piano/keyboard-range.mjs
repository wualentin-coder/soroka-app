const isBlack = midi => [1,3,6,8,10].includes(midi % 12);
const validMidi = midi => Number.isInteger(midi) && midi >= 0 && midi <= 127;

// The selected phrase remains fixed; only an explicit viewport change reframes it.
export function keyboardViewportOptions(width,height){
  return Number.isFinite(width)&&Number.isFinite(height)&&width<height?{padding:2,minWhiteKeys:12}:{padding:3,minWhiteKeys:29};
}

/**
 * Stable geometry for one selected lesson/part, independent of viewport pixels
 * or the current target note. Only the student's supplied notes choose a range.
 * Hardware boundaries must be white keys so cropped edge keys stay complete.
 */
export function createKeyboardRange(notes, { min = 36, max = 96, padding = 2, minWhiteKeys = 8 } = {}) {
  if (!Array.isArray(notes)) throw new TypeError('Keyboard range needs an array of notes.');
  if (!validMidi(min) || !validMidi(max) || min > max || isBlack(min) || isBlack(max)) {
    throw new RangeError('Keyboard hardware limits must be ordered white MIDI keys.');
  }
  if (!Number.isSafeInteger(padding) || padding < 0 || !Number.isSafeInteger(minWhiteKeys) || minWhiteKeys < 1) {
    throw new RangeError('Keyboard padding and minimum width must be non-negative whole keys.');
  }
  const hardwareWhites = [];
  for (let midi = min; midi <= max; midi++) if (!isBlack(midi)) hardwareWhites.push(midi);
  const used = notes.map(note => note?.midi).filter(midi => validMidi(midi) && midi >= min && midi <= max);
  let first, last;
  if (used.length) {
    const lowest = Math.min(...used), highest = Math.max(...used);
    first = hardwareWhites.findLastIndex(midi => midi <= lowest);
    last = hardwareWhites.findIndex(midi => midi >= highest);
    first = Math.max(0, first - padding);
    last = Math.min(hardwareWhites.length - 1, last + padding);
  } else {
    // Empty/invalid input has a familiar central C4–C5 fallback, constrained to
    // the actual hardware if it cannot contain that octave.
    const central = hardwareWhites.findIndex(midi => midi >= 60);
    first = central < 0 ? hardwareWhites.length - 1 : central;
    last = Math.min(hardwareWhites.length - 1, first + 7);
    first = Math.max(0, last - 7);
  }
  const wanted = Math.min(hardwareWhites.length, Math.max(minWhiteKeys, used.length ? 1 : 8));
  let missing = Math.max(0, wanted - (last - first + 1));
  const before = Math.min(first, Math.floor(missing / 2));
  first -= before; missing -= before;
  const after = Math.min(hardwareWhites.length - 1 - last, missing);
  last += after; missing -= after;
  first -= Math.min(first, missing);

  const rangeMin = hardwareWhites[first], rangeMax = hardwareWhites[last];
  const whiteKeys = hardwareWhites.slice(first, last + 1), keys = [], positions = new Map();
  const whiteCount = whiteKeys.length, whiteWidth = 1 / whiteCount;
  let whiteOrdinal = 0;
  for (let midi = rangeMin; midi <= rangeMax; midi++) {
    const black = isBlack(midi), width = whiteWidth * (black ? .62 : 1);
    const center = black ? whiteOrdinal * whiteWidth : (whiteOrdinal + .5) * whiteWidth;
    positions.set(midi, { left: center - width / 2, width, center, black });
    keys.push(midi); if (!black) whiteOrdinal++;
  }
  return { min: rangeMin, max: rangeMax, whiteKeys, keys, whiteCount, signature: `${rangeMin}:${rangeMax}`,
    position(midi) { const position = positions.get(midi); return position ? { ...position } : null; } };
}
