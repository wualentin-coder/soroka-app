/** Relative partial energies for temporal consistency, not instrument ID.
 * A voiced vowel can also be harmonic; this cannot establish its source.
 */
export function harmonicProfile(samples, sampleRate, frequency) {
  if (!samples || samples.length < 256 || !Number.isFinite(sampleRate) ||
      !(frequency > 0 && frequency < sampleRate / 2)) return null;
  const stride = Math.max(1, Math.floor(sampleRate / 12000));
  const length = Math.floor(samples.length / stride), rate = sampleRate / stride;
  const frame = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let j = 0; j < stride; j++) {
      const value = samples[i * stride + j];
      if (!Number.isFinite(value)) return null;
      sum += value;
    }
    frame[i] = sum / stride * (.5 - .5 * Math.cos(2 * Math.PI * i / (length - 1)));
  }
  const profile = new Float64Array(12);
  let norm = 0;
  for (let partial = 1; partial <= profile.length; partial++) {
    if (frequency * partial >= rate * .46) break;
    let energy = 0;
    for (const shift of [.985, 1, 1.015]) {
      const coefficient = 2 * Math.cos(2 * Math.PI * frequency * partial * shift / rate);
      let previous = 0, before = 0;
      for (const value of frame) {
        const next = value + coefficient * previous - before;
        before = previous; previous = next;
      }
      energy += Math.max(0, previous ** 2 + before ** 2 - coefficient * previous * before);
    }
    profile[partial - 1] = energy; norm += energy ** 2;
  }
  if (norm < 1e-20) return null;
  norm = Math.sqrt(norm);
  return profile.map(value => value / norm);
}

export function profileSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return null;
  return Math.max(0, Math.min(1, a.reduce((sum, value, i) => sum + value * b[i], 0)));
}
