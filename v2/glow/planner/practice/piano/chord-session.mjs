const GROUP_WINDOW_SECONDS = .035;
const MASTERY_METRIC = 'first-attempt-v1';
const validTime = value => Number.isFinite(value) && value >= 0;

function copyNotes(notes) {
  if (!Array.isArray(notes) || !notes.length || notes.length > 5000) throw new TypeError('ChordSession needs between 1 and 5000 timed notes.');
  let previous = -Infinity;
  return Array.from(notes, note => {
    if (!note || !Number.isInteger(note.midi) || note.midi < 0 || note.midi > 127 ||
        !validTime(note.time) || note.time > 86400 || note.time < previous ||
        (note.duration !== undefined && (!Number.isFinite(note.duration) || note.duration <= 0)) ||
        (note.beats !== undefined && (!Number.isFinite(note.beats) || note.beats <= 0))) {
      throw new TypeError('ChordSession needs ordered notes with valid pitches and seconds.');
    }
    previous = note.time;
    return { ...note };
  });
}

/**
 * Pitch-only assessment of simultaneous note groups. Either hand can arrive
 * first; all pitches in the group must resolve before its score gate advances.
 * Unison events share one physical key, but retain separate source outcomes.
 */
export class ChordSession {
  constructor(notes, now = 0) {
    if (!validTime(now)) throw new TypeError('Session time must be finite and non-negative.');
    this.notes = copyNotes(notes);
    this._groups = [];
    for (let index = 0; index < this.notes.length; index++) {
      const note = this.notes[index], previous = this._groups.at(-1);
      if (previous && note.time - previous.time <= GROUP_WINDOW_SECONDS + 1e-9) previous.end = index + 1;
      else this._groups.push({ start: index, end: index + 1, time: note.time });
    }
    this._groupIndex = 0;
    this._resolved = this.notes.map(() => false);
    this.targetOutcomes = this.notes.map(() => null);
    this.correct = 0; this.wrong = 0; this.skipped = 0;
    this.errors = []; this.results = [];
    this.activeSince = now; this.elapsedMs = 0; this.paused = false;
    this._lastTime = now;
  }

  get index() { return this._groups[this._groupIndex]?.start ?? this.notes.length; }
  get finished() { return this._groupIndex >= this._groups.length; }
  get expected() { return this.notes[this._pending()[0]]?.midi ?? null; }
  get expectedNotes() { return [...new Set(this._pending().map(index => this.notes[index].midi))]; }
  get groupNotes() {
    const group = this._groups[this._groupIndex];
    return group ? [...new Set(this.notes.slice(group.start, group.end).map(note => note.midi))] : [];
  }
  get firstAttemptCorrect() { return this.targetOutcomes.filter(outcome => outcome === 1).length; }
  get scoreOutOf10() { return Math.floor(this.firstAttemptCorrect * 100 / this.notes.length) / 10; }
  get passed() { return this.finished && this.firstAttemptCorrect * 10 >= this.notes.length * 8; }

  _pending() {
    const group = this._groups[this._groupIndex], pending = [];
    if (group) for (let index = group.start; index < group.end; index++) if (!this._resolved[index]) pending.push(index);
    return pending;
  }

  _stamp(now) {
    if (!validTime(now)) return null;
    this._lastTime = Math.max(this._lastTime, now);
    return this._lastTime;
  }

  pause(now) {
    const stamp = this._stamp(now); if (stamp === null) return;
    if (!this.paused) this.elapsedMs += Math.max(0, stamp - this.activeSince);
    this.paused = true;
  }

  resume(now) {
    const stamp = this._stamp(now); if (stamp === null || this.finished) return;
    if (this.paused) { this.activeSince = stamp; this.paused = false; }
  }

  play(midi, now) {
    if (this.finished || this.paused || !Number.isInteger(midi) || midi < 0 || midi > 127 || !validTime(now)) return { kind: 'ignored' };
    const stamp = this._stamp(now), group = this._groups[this._groupIndex], pending = this._pending();
    const matches = pending.filter(index => this.notes[index].midi === midi);
    if (!matches.length) {
      // Repeated MIDI note-ons for a pitch already resolved in this chord must
      // not become wrong notes while the other hand is still arriving.
      for (let index = group.start; index < group.end; index++) {
        if (this._resolved[index] && this.notes[index].midi === midi) return { kind: 'ignored' };
      }
      const targetIndex = pending.find(index => this.targetOutcomes[index] === null) ?? pending[0];
      const firstAttempt = this.targetOutcomes[targetIndex] === null, expected = this.notes[targetIndex].midi;
      if (firstAttempt) this.targetOutcomes[targetIndex] = 0;
      this.wrong++;
      this.errors.push({ index: targetIndex, expected, played: midi });
      return { kind: 'wrong', expected, played: midi, targetIndex, firstAttempt, targetOutcome: this.targetOutcomes[targetIndex] };
    }

    const targetIndex = matches[0], firstAttempt = this.targetOutcomes[targetIndex] === null;
    for (const index of matches) {
      if (this.targetOutcomes[index] === null) this.targetOutcomes[index] = 1;
      this._resolved[index] = true; this.correct++;
      this.results.push({ index, kind: 'correct' });
    }
    const partial = this._pending().length > 0;
    if (!partial) this._groupIndex++;
    if (this.finished) this.pause(stamp);
    return { kind: partial ? 'partial' : this.finished ? 'complete' : 'correct',
      expected: midi, next: this.expected, targetIndex, firstAttempt,
      targetOutcome: this.targetOutcomes[targetIndex], resolvedIndices: [...matches] };
  }

  skip(now) {
    if (this.finished || this.paused || !validTime(now)) return { kind: 'ignored' };
    const stamp = this._stamp(now), pending = this._pending(), targetIndex = pending[0];
    for (const index of pending) {
      this.targetOutcomes[index] = 0; this._resolved[index] = true; this.skipped++;
      this.results.push({ index, kind: 'skipped' });
    }
    this._groupIndex++;
    if (this.finished) this.pause(stamp);
    return { kind: this.finished ? 'complete' : 'skipped', targetIndex,
      firstAttempt: false, targetOutcome: 0, skippedIndices: [...pending] };
  }

  markAssisted() {
    for (const index of this._pending()) if (this.targetOutcomes[index] === null) this.targetOutcomes[index] = 0;
  }

  report(now) {
    if (!validTime(now)) throw new RangeError('Report time must be finite and non-negative.');
    const attempts = this.correct + this.wrong + this.skipped;
    const elapsed = this.elapsedMs + (this.paused ? 0 : Math.max(0, Math.max(now, this._lastTime) - this.activeSince));
    return { correct: this.correct, wrong: this.wrong, skipped: this.skipped,
      total: this.notes.length, accuracy: attempts ? Math.round(this.correct / attempts * 100) : 0,
      seconds: Math.round(elapsed / 1000), errors: this.errors.map(error => ({ ...error })),
      finished: this.finished, metric: MASTERY_METRIC,
      firstAttemptCorrect: this.firstAttemptCorrect, scoreOutOf10: this.scoreOutOf10,
      passed: this.passed, targetOutcomes: [...this.targetOutcomes] };
  }
}
