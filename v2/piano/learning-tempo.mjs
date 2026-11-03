const LEARNING_MODULE_BPM = Object.freeze({ orientation: 56, 'five-notes': 64, phrases: 62,
  'left-hand': 56, 'hands-dialogue': 52, 'keyboard-range': 58, 'black-keys': 54, 'to-compositions': 58 });
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
    const bpm = learningClampBpm(assigned ? source.tempo : moduleBpm, 120);
    return { bpm, sourceBpm, label: assigned ? 'В темпе урока' : 'Учебный темп' };
  }
  const whole = context.whole === true;
  const fraction = whole ? .75 : hand === 'both' ? .5 : hand === 'left' ? .6 : .65;
  return { bpm: learningClampBpm(Math.round(sourceBpm * fraction / 5) * 5, 110), sourceBpm,
    label: whole ? 'Целиком, учебный темп' : hand === 'both' ? 'Для двух рук' : hand === 'left' ? 'Для левой руки' : 'Для правой руки' };
}
