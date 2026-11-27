export const LESSONS = [
  { id: 'first', title: 'Первые пять нот', author: 'Упражнение Flow', description: 'Познакомься с клавишами и сыграй короткую фразу.', level: 'С самого начала', minutes: '2–3 минуты', notes: [60,62,64,65,67,65,64,62,60].map(midi => ({ midi, beats: 1 })) },
  { id: 'joy', title: 'Ода к радости', author: 'Людвиг ван Бетховен', description: 'Узнаваемая мелодия, пять клавиш и одна рука.', level: 'Легко', minutes: '3–5 минут', notes: [64,64,65,67,67,65,64,62,60,60,62,64,64,62,62].map((midi,i) => ({ midi, beats: i === 14 ? 2 : 1 })) },
  { id: 'star', title: 'Маленькая звезда', author: 'Народная мелодия', description: 'Научись повторять ноты и находить соседние клавиши.', level: 'Легко', minutes: '3–5 минут', notes: [60,60,67,67,69,69,67,65,65,64,64,62,62,60].map((midi,i) => ({ midi, beats: [6,13].includes(i) ? 2 : 1 })) }
];

// This first prototype scores note identity only. It never assigns a rhythm,
// fingering or duration grade from microphone pitch estimates.
export class PracticeSession {
  constructor(notes, now = 0) {
    this.notes = notes.map(n => ({ ...n }));
    this.index = 0;
    this.correct = 0;
    this.wrong = 0;
    this.skipped = 0;
    this.errors = [];
    this.results = [];
    this.activeSince = now;
    this.elapsedMs = 0;
    this.paused = false;
  }
  get expected() { return this.notes[this.index]?.midi ?? null; }
  get finished() { return this.index >= this.notes.length; }
  pause(now) {
    if (!this.paused) this.elapsedMs += Math.max(0, now - this.activeSince);
    this.paused = true;
  }
  resume(now) { if (this.paused) { this.activeSince = now; this.paused = false; } }
  play(midi, now) {
    if (this.finished || this.paused || !Number.isInteger(midi)) return { kind: 'ignored' };
    const expected = this.expected;
    if (midi !== expected) {
      this.wrong++;
      this.errors.push({ index: this.index, expected, played: midi });
      return { kind: 'wrong', expected, played: midi };
    }
    this.correct++;
    this.results.push({ index: this.index, kind: 'correct' });
    this.index++;
    if (this.finished) this.pause(now);
    return { kind: this.finished ? 'complete' : 'correct', expected, next: this.expected };
  }
  skip(now) {
    if (this.finished || this.paused) return { kind: 'ignored' };
    this.results.push({ index: this.index, kind: 'skipped' });
    this.skipped++;
    this.index++;
    if (this.finished) this.pause(now);
    return { kind: this.finished ? 'complete' : 'skipped' };
  }
  report(now) {
    const total = this.correct + this.wrong + this.skipped;
    return {
      correct: this.correct, wrong: this.wrong, skipped: this.skipped,
      total: this.notes.length, accuracy: total ? Math.round(this.correct / total * 100) : 0,
      seconds: Math.round((this.elapsedMs + (this.paused ? 0 : Math.max(0, now - this.activeSince))) / 1000),
      errors: this.errors.map(e => ({ ...e })), finished: this.finished
    };
  }
}
