/** Monophonic event gate. A stable pitch is an event, not one event per frame.
 * Repeated strikes use an amplitude valley followed by a sufficiently large
 * rise. This is an envelope heuristic, not a general-purpose onset model.
 */
export class NoteGate {
  constructor(options = {}) {
    this.options = {
      stableMs: 100,
      silenceMs: 70,
      refractoryMs: 250,
      minRms: .002,
      decayRatio: .65,
      riseRatio: 1.65,
      attackDelta: .003,
      ...options,
    };
    this.reset();
  }

  reset() {
    this._lastOnsetAt = null;
    this.candidate = null;
    this.candidateSince = 0;
    this.latched = null;
    this.lastEmitAt = -Infinity;
    this.quietSince = null;
    this.lastUpdateAt = null;
    this.peak = 0;
    this.trough = 0;
    this.troughAt = 0;
    this.armed = false;
  }

  /** Candidate/attack evidence time, not the later stability confirmation. */
  get lastOnsetAt() { return this._lastOnsetAt; }

  /** Returns one MIDI integer per stable note or newly detected repeated strike. */
  update(pitch, rms, timeMs) {
    if (!Number.isFinite(timeMs)) return null;
    if (this.lastUpdateAt !== null && timeMs < this.lastUpdateAt) this.reset();
    this.lastUpdateAt = timeMs;
    const level = Number.isFinite(rms) ? Math.max(0, rms) : 0;
    const valid = pitch && Number.isFinite(pitch.midi) && level >= this.options.minRms &&
      (!Number.isFinite(pitch.confidence) || pitch.confidence >= .82);

    if (!valid) {
      if (this.quietSince === null) this.quietSince = timeMs;
      if (timeMs - this.quietSince >= this.options.silenceMs) {
        this.candidate = null;
        this.latched = null;
        this.peak = 0;
        this.armed = false;
      }
      return null;
    }

    this.quietSince = null;
    const midi = Math.round(pitch.midi);
    if (this.candidate !== midi) {
      this.candidate = midi;
      this.candidateSince = timeMs;
      this.peak = level;
      this.trough = level;
      this.troughAt = timeMs;
      this.armed = false;
    }
    this.peak = Math.max(this.peak, level);
    if (timeMs - this.candidateSince < this.options.stableMs) return null;

    if (this.latched !== midi) {
      this.latched = midi;
      this.lastEmitAt = timeMs;
      this._lastOnsetAt = this.candidateSince;
      this.trough = level;
      this.troughAt = timeMs;
      this.armed = false;
      return midi;
    }

    if (!this.armed && level <= this.peak * this.options.decayRatio) {
      this.armed = true;
      this.trough = level;
      this.troughAt = timeMs;
    }
    if (!this.armed) return null;
    if (level <= this.trough) {
      this.trough = level;
      this.troughAt = timeMs;
    }
    const rise = level - this.trough;
    const attack = level >= this.trough * this.options.riseRatio &&
      rise >= Math.max(this.options.attackDelta, this.peak * .12) &&
      timeMs - this.troughAt <= 250;
    if (!attack) return null;
    // Consume an onset even inside the refractory interval. Otherwise a single
    // early level rebound could remain armed and emit a delayed false note.
    this.peak = level;
    this.trough = level;
    this.troughAt = timeMs;
    this.armed = false;
    if (timeMs - this.lastEmitAt < this.options.refractoryMs) return null;
    this.lastEmitAt = timeMs;
    this._lastOnsetAt = timeMs;
    return midi;
  }
}
