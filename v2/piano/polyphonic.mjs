/* Experimental, known-target multipitch evidence for microphone practice.
 * General background: Klapuri, ISMIR 2006, harmonic-summation F0 estimation:
 * https://archives.ismir.net/ismir2006/paper/000125.pdf
 * This original small detector is NOT that paper's trained estimator, a neural
 * transcription model, or a calibrated probability of a physical key press.
 * Harmonic collisions are intentionally rejected instead of awarding a chord.
 * Always pass the WHOLE current chord, including already matched pitches.
 */
import { NoteGate } from './note-gate.mjs?v=e22f21ea3ada';
export const requiredFrameSize = 16384;
const MIN_FRAME_SIZE = 8192;
const MIN_MIDI = 36, MAX_MIDI = 96, HARMONICS = 8;
const plans = new Map();
const midiFrequency = midi => 440 * 2 ** ((midi - 69) / 12);

function planFor(length) {
  if (plans.has(length)) return plans.get(length);
  const bits = Math.log2(length), reversed = new Uint32Array(length), window = new Float64Array(length);
  for (let index = 0; index < length; index++) {
    let source = index, target = 0;
    for (let bit = 0; bit < bits; bit++) { target = target * 2 + (source & 1); source >>>= 1; }
    reversed[index] = target;
    window[index] = .5 - .5 * Math.cos(2 * Math.PI * index / (length - 1));
  }
  const plan = { reversed, window };
  if (plans.size >= 2) plans.delete(plans.keys().next().value);
  plans.set(length, plan); return plan;
}

function spectrum(samples, rate, length, mean) {
  const { reversed, window } = planFor(length), real = new Float64Array(length), imaginary = new Float64Array(length);
  const offset = samples.length - length;
  for (let index = 0; index < length; index++) real[reversed[index]] = (samples[offset + index] - mean) * window[index];
  for (let size = 2; size <= length; size *= 2) {
    const half = size / 2, angle = -2 * Math.PI / size, stepReal = Math.cos(angle), stepImaginary = Math.sin(angle);
    for (let start = 0; start < length; start += size) {
      let twiddleReal = 1, twiddleImaginary = 0;
      for (let index = 0; index < half; index++) {
        const first = start + index, second = first + half;
        const productReal = real[second] * twiddleReal - imaginary[second] * twiddleImaginary;
        const productImaginary = real[second] * twiddleImaginary + imaginary[second] * twiddleReal;
        real[second] = real[first] - productReal; imaginary[second] = imaginary[first] - productImaginary;
        real[first] += productReal; imaginary[first] += productImaginary;
        const nextReal = twiddleReal * stepReal - twiddleImaginary * stepImaginary;
        twiddleImaginary = twiddleReal * stepImaginary + twiddleImaginary * stepReal; twiddleReal = nextReal;
      }
    }
  }
  const magnitudes = new Float64Array(length / 2), scale = 4 / length;
  for (let bin = 1; bin < magnitudes.length; bin++) magnitudes[bin] = Math.hypot(real[bin], imaginary[bin]) * scale;
  return { magnitudes, binWidth: rate / length };
}

function median(values) {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] || 0;
}

function peakNear(magnitudes, binWidth, frequency, cents, threshold) {
  const low = Math.max(2, Math.floor(frequency * 2 ** (-cents / 1200) / binWidth) - 1);
  const high = Math.min(magnitudes.length - 2, Math.ceil(frequency * 2 ** (cents / 1200) / binWidth) + 1);
  let best = null;
  for (let bin = low; bin <= high; bin++) {
    const amplitude = magnitudes[bin];
    if (amplitude < threshold || amplitude < magnitudes[bin - 1] || amplitude < magnitudes[bin + 1]) continue;
    const a = Math.log(Math.max(1e-15, magnitudes[bin - 1])), b = Math.log(Math.max(1e-15, amplitude)), c = Math.log(Math.max(1e-15, magnitudes[bin + 1]));
    const denominator = a - 2 * b + c;
    const correction = Math.abs(denominator) > 1e-12 ? Math.max(-.5, Math.min(.5, .5 * (a - c) / denominator)) : 0;
    const measured = (bin + correction) * binWidth;
    if (Math.abs(1200 * Math.log2(measured / frequency)) > cents) continue;
    if (!best || amplitude > best.amplitude) best = { bin, amplitude, frequency: measured };
  }
  return best;
}

/**
 * Returns independently supported EXPECTED pitches, never a guessed full chord.
 * confidence is a spectral signal/noise score; rms estimates fundamental energy.
 * A frame cannot prove whether an octave partial came from another struck key.
 * Consequently a detected lower source suppresses its ambiguous upper harmonic.
 * In particular, true octave chords can be incomplete here. Use release/restrike
 * practice or MIDI for those, rather than counting a harmonic as a second hand.
 */
function frameEvidence(samples, sampleRate, minRms) {
  if (!(samples instanceof Float32Array) || samples.length < MIN_FRAME_SIZE || samples.length > 65536 ||
      !Number.isFinite(sampleRate) || sampleRate < 16000 || sampleRate > 192000 ||
      !Number.isFinite(minRms) || minRms < 0) return null;
  const length = 2 ** Math.floor(Math.log2(Math.min(samples.length, requiredFrameSize)));
  const offset = samples.length - length;
  let mean = 0;
  for (let index = offset; index < samples.length; index++) { if (!Number.isFinite(samples[index])) return null; mean += samples[index]; }
  mean /= length;
  let power = 0;
  for (let index = offset; index < samples.length; index++) power += (samples[index] - mean) ** 2;
  const frameRms = Math.sqrt(power / length); if (frameRms < Math.max(minRms, 1e-7)) return { notes:[], frameRms };
  const { magnitudes, binWidth } = spectrum(samples, sampleRate, length, mean);
  const firstBin = Math.max(2, Math.floor(50 / binWidth)), lastBin = Math.min(magnitudes.length - 2, Math.floor(6500 / binWidth));
  let maximum = 0; const floorBins = [];
  for (let bin = firstBin; bin <= lastBin; bin++) { maximum = Math.max(maximum, magnitudes[bin]); floorBins.push(magnitudes[bin]); }
  const noise = Math.max(1e-9, median(floorBins));
  const threshold = Math.max(noise * 9, maximum * .012, minRms * .12);
  const candidates = [];
  // Inspect unrequested lower sources too: their overtones must not be mistaken
  // for multiple requested notes merely because the exercise expects a chord.
  for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
    const fundamental = peakNear(magnitudes, binWidth, midiFrequency(midi), 35, threshold);
    if (!fundamental) continue;
    const localBins = [];
    for (let bin = Math.max(firstBin, fundamental.bin - 12); bin <= Math.min(lastBin, fundamental.bin + 12); bin++) {
      if (Math.abs(bin - fundamental.bin) > 3) localBins.push(magnitudes[bin]);
    }
    const localNoise = Math.max(noise, median(localBins));
    if (fundamental.amplitude < localNoise * 7) continue;
    const partials = [fundamental];
    for (let harmonic = 2; harmonic <= HARMONICS; harmonic++) {
      const frequency = fundamental.frequency * harmonic;
      if (frequency > Math.min(6500, sampleRate * .45)) break;
      const partial = peakNear(magnitudes, binWidth, frequency, 12, Math.max(noise * 7, maximum * .006));
      if (partial) partials.push({ ...partial, harmonic });
    }
    if (partials.length < 2 && fundamental.amplitude < maximum * .18) continue;
    candidates.push({ midi, fundamental, partials, localNoise });
  }
  const notes = candidates.filter(candidate => {
    return !candidates.some(lower => {
      if (lower.midi >= candidate.midi || lower.fundamental.amplitude < threshold) return false;
      const octave = (candidate.midi - lower.midi) % 12 === 0;
      const ratio = candidate.fundamental.frequency / lower.fundamental.frequency, harmonic = Math.round(ratio);
      if (harmonic < 2 || harmonic > 16) return false;
      // Exact octave-key ambiguity remains even with instrument inharmonicity.
      if (octave) return true;
      const tolerance = Math.max(binWidth * .9, candidate.fundamental.frequency * .0015);
      return Math.abs(candidate.fundamental.frequency - lower.fundamental.frequency * harmonic) <= tolerance;
    });
  }).map(candidate => ({
    midi: candidate.midi, frequency: candidate.fundamental.frequency,
    confidence: Math.max(0, Math.min(1, 1 - candidate.localNoise / candidate.fundamental.amplitude)),
    rms: candidate.fundamental.amplitude / Math.sqrt(2),
  })).sort((a, b) => a.midi - b.midi);
  return { notes, frameRms };
}

const validPitches = pitches => Array.isArray(pitches) && pitches.length <= 12 &&
  Array.from(pitches).every(midi => Number.isInteger(midi) && midi >= MIN_MIDI && midi <= MAX_MIDI);

export function detectExpectedNotes(samples, sampleRate, expectedMidis, { minRms = .004 } = {}) {
  if (!validPitches(expectedMidis) || !expectedMidis.length) return [];
  const expected = new Set(expectedMidis);
  return frameEvidence(samples, sampleRate, minRms)?.notes.filter(note => expected.has(note.midi)) ?? [];
}

function harmonicRelation(lower, upper) {
  if (lower >= upper) return false;
  const ratio=2**((upper-lower)/12), harmonic=Math.round(ratio);
  return harmonic>=2 && harmonic<=16 && Math.abs(ratio-harmonic)/harmonic<.006;
}

/**
 * Stateful safe boundary between spectral evidence and physical note events.
 * A decaying low key can lose its fundamental while retaining an octave partial.
 * Such a newly visible partial is NOT a fresh key press. Ambiguous upper pitches
 * require a quiet interval after the lower source, then a new supported tone.
 * This intentionally makes some octave chords a release/restrike exercise.
 * Keep this instance across groups. Pass the original chord, stable groupId and
 * resolvedNotes after a capture pause/reset. Both output arrays are guarded:
 * do not bypass them with raw-spectral or monophonic early-note buffering.
 */
export class PolyphonicInputGate {
  constructor({ silenceMs=95, gateOptions={} }={}) {
    if (!Number.isFinite(silenceMs) || silenceMs<50 || silenceMs>2000) throw new RangeError('Invalid release interval.');
    this.silenceMs=silenceMs;
    this.gateOptions={ stableMs:100, silenceMs:70, refractoryMs:250, attackDelta:.0008, ...gateOptions };
    this.reset();
  }

  reset() {
    this._gates=new Map(); this._sources=new Map(); this._emitted=new Map();
    this._context=null; this._quietSince=null; this._releaseAt=-Infinity; this._lastNow=-Infinity;
  }

  process(samples, sampleRate, groupNotes, nowMs, { minRms=.004, groupId, resolvedNotes=[] }={}) {
    const empty=()=>({ onsets:[], detected:[], needsRelease:[] });
    if (!Number.isFinite(nowMs) || nowMs<0 || nowMs<this._lastNow || !validPitches(groupNotes) ||
        !validPitches(resolvedNotes) || !groupNotes.length) return empty();
    const group=[...new Set(groupNotes)].sort((a,b)=>a-b), requested=new Set(group), resolved=new Set(resolvedNotes);
    if ([...resolved].some(midi=>!requested.has(midi))) return empty();
    const evidence=frameEvidence(samples,sampleRate,minRms); if(!evidence)return empty();
    this._lastNow=nowMs;
    const context=groupId===undefined?group.join(','):`${typeof groupId}:${String(groupId)}|${group.join(',')}`;
    if(context!==this._context){this._context=context;this._emitted.clear();}
    for(const midi of resolved)if(!this._emitted.has(midi))this._emitted.set(midi,nowMs);

    const quiet=evidence.frameRms<Math.max(minRms,.001);
    if(quiet){
      this._quietSince??=nowMs;
      if(nowMs-this._quietSince>=this.silenceMs){this._releaseAt=nowMs;this._sources.clear();}
    }else{
      this._quietSince=null;
      for(const note of evidence.notes)this._sources.set(note.midi,nowMs);
    }

    const blocked=new Set(), needsRelease=new Set();
    for(const upper of group){
      if(resolved.has(upper))continue;
      const dependencies=group.filter(lower=>harmonicRelation(lower,upper));
      const acceptedDependencies=dependencies.filter(lower=>this._emitted.has(lower));
      const missingDependency=dependencies.some(lower=>!this._emitted.has(lower));
      const awaitingRelease=acceptedDependencies.some(lower=>this._releaseAt<=this._emitted.get(lower));
      const shadow=[...this._sources.keys()].some(lower=>harmonicRelation(lower,upper));
      if(missingDependency||awaitingRelease||shadow)blocked.add(upper);
      if(awaitingRelease||shadow)needsRelease.add(upper);
    }
    const detected=evidence.notes.filter(note=>requested.has(note.midi)&&!resolved.has(note.midi)&&!blocked.has(note.midi));
    const byPitch=new Map(detected.map(note=>[note.midi,note])), onsets=[];
    for(const midi of group)if(!this._gates.has(midi))this._gates.set(midi,new NoteGate(this.gateOptions));
    for(const [midi,gate] of this._gates){
      // Neither suppressed harmonics nor unrelated frame energy raise a gate.
      const hit=byPitch.get(midi);
      gate.options.minRms=Math.max(.0005,minRms*.25);
      const onset=gate.update(hit||null,hit?.rms??0,nowMs);
      if(onset!==null&&requested.has(onset)&&!resolved.has(onset)){
        onsets.push(onset);
        if(!this._emitted.has(onset))this._emitted.set(onset,nowMs);
      }
    }
    return { onsets, detected, needsRelease:[...needsRelease].sort((a,b)=>a-b) };
  }
}
