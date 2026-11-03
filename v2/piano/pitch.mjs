/* Monophonic YIN pitch estimation, not polyphonic transcription.
 * Method: de Cheveigné & Kawahara (2002), doi:10.1121/1.1458024.
 * https://pubmed.ncbi.nlm.nih.gov/12002874/
 * Confidence measures frame periodicity; it is not a calibrated probability.
 */
const SOLFEGE = ['До', 'До♯', 'Ре', 'Ре♯', 'Ми', 'Фа', 'Фа♯', 'Соль', 'Соль♯', 'Ля', 'Ля♯', 'Си'];
const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function frequencyForMidi(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function noteInfo(midi) {
  const note = Math.round(midi);
  const index = ((note % 12) + 12) % 12;
  const octave = Math.floor(note / 12) - 1;
  return { name: SOLFEGE[index], latin: `${LETTERS[index]}${octave}`, octave };
}

/** Detect a single stable tone in a Float32Array audio frame (typically 4096 samples). */
export function detectPitch(samples, sampleRate, options = {}) {
  const { minFrequency = 110, maxFrequency = 1200, minRms = .006 } = options;
  if (!samples || samples.length < 256 || !Number.isFinite(sampleRate) || sampleRate < 4000 ||
      !(minFrequency > 0 && maxFrequency > minFrequency && maxFrequency < sampleRate / 2)) return null;

  let mean = 0;
  for (let i = 0; i < samples.length; i++) {
    if (!Number.isFinite(samples[i])) return null;
    mean += samples[i];
  }
  mean /= samples.length;
  let power = 0;
  for (let i = 0; i < samples.length; i++) power += (samples[i] - mean) ** 2;
  const rms = Math.sqrt(power / samples.length);
  if (rms < minRms || rms < 1e-7) return null;

  // Box-average before decimation. Keep at least 12 kHz for the target piano range.
  const stride = Math.max(1, Math.floor(sampleRate / Math.max(12000, maxFrequency * 8)));
  const rate = sampleRate / stride;
  const length = Math.floor(samples.length / stride);
  const frame = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let j = 0; j < stride; j++) sum += samples[i * stride + j] - mean;
    frame[i] = sum / stride;
  }
  const minLag = Math.max(2, Math.floor(rate / maxFrequency));
  const maxLag = Math.min(Math.ceil(rate / minFrequency), Math.floor(length / 2) - 1);
  if (maxLag <= minLag) return null;
  const windowLength = length - maxLag;
  const cmnd = new Float64Array(maxLag + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    let difference = 0;
    for (let i = 0; i < windowLength; i++) {
      const delta = frame[i] - frame[i + lag];
      difference += delta * delta;
    }
    running += difference;
    cmnd[lag] = running > 1e-15 ? difference * lag / running : 1;
  }

  let candidate = -1;
  for (let lag = minLag; lag < maxLag; lag++) {
    if (cmnd[lag] < .14) {
      while (lag + 1 <= maxLag && cmnd[lag + 1] < cmnd[lag]) lag++;
      candidate = lag;
      break;
    }
  }
  if (candidate < 0 || cmnd[candidate] > .18) return null;

  // A dominant overtone can produce an early dip. Prefer a substantially better
  // integer-multiple period, but never double an already clean sinusoid.
  // Compare interpolated dip depths: integer lag quantization alone must not
  // make a later (subharmonic) dip appear meaningfully better at high pitches.
  function dipDepth(lag) {
    if (lag <= 1 || lag >= maxLag) return cmnd[lag];
    const a = cmnd[lag - 1], b = cmnd[lag], c = cmnd[lag + 1];
    const curvature = a - 2 * b + c;
    return curvature > 1e-12 ? Math.max(0, b - (a - c) ** 2 / (8 * curvature)) : b;
  }
  const initial = candidate;
  for (const multiple of [2, 3]) {
    const center = initial * multiple;
    if (center > maxLag) continue;
    const radius = Math.max(2, Math.round(center * .025));
    let better = center;
    for (let lag = Math.max(minLag, center - radius); lag <= Math.min(maxLag, center + radius); lag++) {
      if (cmnd[lag] < cmnd[better]) better = lag;
    }
    const currentDepth = dipDepth(candidate), betterDepth = dipDepth(better);
    if (currentDepth - betterDepth > .008 && betterDepth < currentDepth * .35) candidate = better;
  }
  const confidence = Math.max(0, Math.min(1, 1 - cmnd[candidate]));
  if (confidence < .82) return null;

  let period = candidate;
  if (candidate > 1 && candidate < maxLag) {
    const a = cmnd[candidate - 1], b = cmnd[candidate], c = cmnd[candidate + 1];
    const denominator = 2 * (a - 2 * b + c);
    if (Math.abs(denominator) > 1e-12) period += Math.max(-1, Math.min(1, (a - c) / denominator));
  }
  const frequency = rate / period;
  if (!Number.isFinite(frequency) || frequency < minFrequency * .995 || frequency > maxFrequency * 1.005) return null;
  const semitone = 69 + 12 * Math.log2(frequency / 440);
  const midi = Math.round(semitone);
  return { frequency, midi, cents: (semitone - midi) * 100, confidence, rms };
}
