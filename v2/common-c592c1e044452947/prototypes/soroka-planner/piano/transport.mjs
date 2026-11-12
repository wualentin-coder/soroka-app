const MAX_NOTES = 5000;
const MAX_SECONDS = 86400;

function clockTime(value) {
  if (!Number.isFinite(value) || value < 0) throw new RangeError('Clock time must be a finite, non-negative number of milliseconds.');
  return value;
}

function noteIndex(value, length) {
  if (!Number.isInteger(value) || value < 0 || value > length) throw new RangeError('Transport index is outside the score.');
  return value;
}

function copyTimeline(timeline) {
  if (!Array.isArray(timeline)) throw new TypeError('Transport needs a score timeline.');
  if (timeline.length > MAX_NOTES) throw new RangeError('Transport has more than 5000 notes.');
  let previous = -Infinity;
  return Array.from(timeline, note => {
    if (!note || !Number.isFinite(note.time) || note.time < 0 || note.time > MAX_SECONDS || note.time < previous) {
      throw new RangeError('Score times must be finite, non-negative and ordered.');
    }
    const duration = note.duration ?? 0;
    if (!Number.isFinite(duration) || duration < 0 || note.time + duration > MAX_SECONDS) {
      throw new RangeError('Score duration is outside the supported range.');
    }
    previous = note.time;
    return { time: note.time, duration };
  });
}

/**
 * Musical seconds driven by an absolute millisecond clock. The pending note is
 * a gate: its onset cannot pass until scoring moves the index. Waiting consumes
 * wall time, so releasing a gate never fast-forwards through a late player's gap.
 * This clock does not score, play audio, or advance the note index by itself.
 */
export class FollowTransport {
  constructor(timeline, options = {}) { this.reset(timeline, options); }

  reset(timeline, { index = 0, leadIn = 1.6, now = 0 } = {}) {
    const copied = copyTimeline(timeline);
    noteIndex(index, copied.length); clockTime(now);
    if (!Number.isFinite(leadIn) || leadIn < 0 || leadIn > MAX_SECONDS) throw new RangeError('Lead-in must be finite and non-negative.');
    this._timeline = copied;
    this._end = copied.reduce((end, note) => Math.max(end, note.time + note.duration), 0);
    this._index = index;
    this._value = index < copied.length ? copied[index].time - leadIn : this._end;
    this._lastNow = now;
    this._running = false;
    return this._snapshot();
  }

  get value() { return this._value; }
  get index() { return this._index; }
  get running() { return this._running; }
  get waiting() { return this._index < this._timeline.length && this._value >= this._timeline[this._index].time; }

  _snapshot() { return { time: this._value, waiting: this.waiting, running: this._running }; }

  tick(now) {
    clockTime(now);
    // A delayed RAF callback must not rewind an input event's newer timestamp.
    const elapsed = Math.max(0, now - this._lastNow) / 1000;
    this._lastNow = Math.max(this._lastNow, now);
    if (this._running) {
      const gate = this._index < this._timeline.length ? this._timeline[this._index].time : this._end;
      this._value = Math.min(gate, this._value + elapsed);
    }
    return this._snapshot();
  }

  play(now) {
    this.tick(now);
    this._running = true;
    return this._snapshot();
  }

  pause(now) {
    this.tick(now);
    this._running = false;
    return this._snapshot();
  }

  seekIndex(index, now) {
    noteIndex(index, this._timeline.length);
    this.tick(now);
    this._index = index;
    const gate = index < this._timeline.length ? this._timeline[index].time : this._end;
    // Explicit backwards seeks can rewind; ordinary forward matches never jump.
    this._value = Math.min(this._value, gate);
    return this._snapshot();
  }
}
