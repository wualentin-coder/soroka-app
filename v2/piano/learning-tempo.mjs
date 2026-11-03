const LEARNING_MODULE_BPM = Object.freeze({ orientation: 44, 'five-notes': 52, phrases: 56,
  'left-hand': 56, 'hands-dialogue': 52, 'keyboard-range': 58, 'black-keys': 54, 'to-compositions': 58 });
const STARTER_BPM = Object.freeze({ 'course-first-key':40, 'course-first-melody':44, 'course-do':40, 'course-do-re':44,
  'course-do-re-mi':44, 'course-fa':48, 'course-first-answer':48, 'course-five':48, 'course-repeats':48,
  'course-steps':50, 'course-skips':52, 'course-five-checkpoint':52, 'course-question':54, 'course-answer':54,
  'course-memory':52, 'course-long-phrase':56, 'course-phrase':56, 'course-pulse-even':44,
  'course-pulse-two-counts':44, 'course-pulse-long-short':46, 'course-pulse-one-rest':44, 'course-pulse-silence':44 });
const learningValidBpm = value => Number.isFinite(value) && value > 0;
const learningClampBpm = (value, maximum) => Math.max(40, Math.min(maximum, value));

/** A starting playback pace, not a timing grade. The original source clock stays intact.
 * practiced alone never proves independent mastery, so it does not accelerate the policy.
 */
export function chooseLearningTempo(lesson, options = {}) {
  const source = lesson && typeof lesson === 'object' ? lesson : {};
  const context = options && typeof options === 'object' ? options : {};
  const kind = context.kind === 'composition' ? 'composition' : 'course';
  const hand = ['right', 'left', 'both'].includes(context.hand) ? context.hand : 'right';
  const sourceBpm = learningValidBpm(source.sourceTempo) ? source.sourceTempo : learningValidBpm(source.tempo) ? source.tempo : 60;
  if (kind === 'course') {
    const assigned = learningValidBpm(source.tempo);
    const moduleBpm = Object.hasOwn(LEARNING_MODULE_BPM, source.moduleId) ? LEARNING_MODULE_BPM[source.moduleId] : 56;
    const base = assigned ? source.tempo : moduleBpm;
    const starter = Object.hasOwn(STARTER_BPM,source.id) ? STARTER_BPM[source.id] : null;
    const bpm = learningClampBpm(starter === null ? base : assigned ? Math.min(base,starter) : starter, 120);
    return { bpm, sourceBpm, label: starter === null ? assigned ? 'В темпе урока' : 'Учебный темп' : 'Для первых занятий' };
  }
  const whole = context.whole === true;
  const fraction = whole ? .75 : hand === 'both' ? .5 : hand === 'left' ? .6 : .65;
  return { bpm: learningClampBpm(Math.round(sourceBpm * fraction / 5) * 5, 110), sourceBpm,
    label: whole ? 'Целиком, учебный темп' : hand === 'both' ? 'Для двух рук' : hand === 'left' ? 'Для левой руки' : 'Для правой руки' };
}

/** Call once per finished physical attempt. This changes practice pace only;
 * it never rewrites source time, grades, skill evidence or the learner's state.
 */
export function adaptLearningTempo(options = {}) {
  const context = options && typeof options === 'object' ? options : {};
  const low = learningValidBpm(context.minBpm) ? Math.max(40,Math.min(120,context.minBpm)) : 40;
  const high = learningValidBpm(context.maxBpm) ? Math.max(low,Math.min(120,context.maxBpm)) : 120;
  const current = learningValidBpm(context.currentBpm) ? Math.max(low,Math.min(high,context.currentBpm)) : low;
  const stable = Number.isInteger(context.stablePasses) && context.stablePasses >= 0 ? Math.min(1,context.stablePasses) : 0;
  const report = context.report;
  const result = (bpm = current, stablePasses = stable, reason = 'ignored') => ({ bpm, stablePasses, changed: bpm !== current, reason });
  if (!report || report.finished !== true || report.metric !== 'timed-notes-v1' || report.demo === true || context.source === 'demo' ||
      !['midi','mic',undefined].includes(context.source) || context.beta === true || report.beta === true ||
      report.breakdown === true || context.breakdown === true) return result();
  const total = report.total, correct = report.firstAttemptCorrect, outcomes = report.targetOutcomes, aborted = report.earlyAbort === true;
  if (!Number.isInteger(total) || total < 1 || total > 5000 || !Number.isInteger(correct) || correct < 0 || correct > total ||
      report.earlyAbort !== undefined && typeof report.earlyAbort !== 'boolean' || !Array.isArray(outcomes) || outcomes.length !== total ||
      Array.from(outcomes).some(value => value !== 0 && value !== 1 && !(aborted && value === null)) ||
      outcomes.filter(value => value === 1).length !== correct || aborted && !outcomes.includes(0)) return result();
  const percent = Math.floor(correct*100/total);
  if (report.scorePercent !== percent || report.scoreOutOf10 !== undefined && report.scoreOutOf10 !== percent/10) return result();
  if (context.assisted === true || report.assisted === true) return result(current,0,'assisted');
  if (percent < 60 || aborted) {
    const bpm = Math.max(low,Math.floor(current*.9));
    return result(bpm,0,bpm === current ? 'at-floor' : 'slow-down');
  }
  if (percent < 80) return result(current,0,'hold');
  if (!stable) return result(current,1,'stable');
  const bpm = Math.min(high,Math.ceil(current*1.05));
  return result(bpm,0,bpm === current ? 'at-target' : 'speed-up');
}
