const validContext = (index, source) => Number.isSafeInteger(index) && index >= 0 && ['mic','midi','demo'].includes(source);
const validTime = time => Number.isFinite(time) && time >= 0;

/**
 * A one-group input buffer, consumed at the score's arrival gate. It cannot
 * create input from held state alone or carry a prior group's press forward.
 * The owner clears it on lesson/source reset as well as ordinary gate changes.
 */
export class EarlyInputBuffer {
  constructor() { this.clear(); }

  clear() { this._context = null; this._notes = new Map(); }

  remember(midi, { index, source, at } = {}) {
    if (!Number.isInteger(midi) || midi < 0 || midi > 127 || !validContext(index, source) || !validTime(at)) return false;
    if (!this._context || this._context.index !== index || this._context.source !== source) {
      this.clear(); this._context = { index, source };
    }
    this._notes.set(midi, at);
    return true;
  }

  take({ index, source, now, isHeld } = {}) {
    const context = this._context, notes = [...this._notes];
    // Consume before testing holds: even a failed predicate must not leave an
    // old press available to a later note group or another input source.
    this.clear();
    if (!context || !validContext(index, source) || !validTime(now) || context.index !== index || context.source !== source) return [];
    return notes.filter(([midi, at]) => now >= at && (source === 'demo' ? now - at <= 250 : typeof isHeld === 'function' && isHeld(midi)))
      .map(([midi]) => midi);
  }
}
