import {musicalNoteKey,songFingerprint} from './song-learning.mjs?v=119118b1bfbc';
import {createScoreTimeline} from './score.mjs?v=119118b1bfbc';

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

const PERFORMANCE_VERSION='performance-tempo-v1';
const supportedPerformanceBpm=value=>Number.isFinite(value)&&value>=20&&value<=300;
const performanceHands=new Set(['right','left','both']);
const validFingerprint=value=>typeof value==='string'&&/^[a-f0-9]{16}$/.test(value);
const sameValues=(a,b)=>a.length===b.length&&Array.from(a).every((value,index)=>value===b[index]);

function performanceSteps(base,source){
  if(base===source)return [source];
  return [...new Set([base,...[1,2].map(index=>Math.round(base+(source-base)*index/3)).filter(bpm=>bpm>base&&bpm<source),source])];
}

/** Only this additive child is persisted under flowProgress[id].performance. */
export function normalizePerformanceProgress(value){
  const row=value&&typeof value==='object'&&!Array.isArray(value)?value:null;
  if(!row||row.version!==PERFORMANCE_VERSION||!validFingerprint(row.sourceFingerprint)||!performanceHands.has(row.hand)||
    !Number.isInteger(row.noteCount)||row.noteCount<1||row.noteCount>5000||!supportedPerformanceBpm(row.sourceBpm)||
    !supportedPerformanceBpm(row.baseBpm)||row.baseBpm>row.sourceBpm||!Array.isArray(row.steps)||!row.steps.length||row.steps.length>5||
    Array.from(row.steps).some((bpm,index)=>!supportedPerformanceBpm(bpm)||index>0&&bpm<=row.steps[index-1])||row.steps[0]!==row.baseBpm||row.steps.at(-1)!==row.sourceBpm||
    !sameValues(row.steps,performanceSteps(row.baseBpm,row.sourceBpm))||!row.steps.includes(row.currentBpm)||
    !Array.isArray(row.completed)||row.completed.length>row.steps.length||Array.from(row.completed).some((bpm,index)=>bpm!==row.steps[index])||row.steps.indexOf(row.currentBpm)>row.completed.length||
    typeof row.targetReached!=='boolean'||row.targetReached!==row.completed.includes(row.sourceBpm))return null;
  return {version:PERFORMANCE_VERSION,sourceFingerprint:row.sourceFingerprint,sourceBpm:row.sourceBpm,baseBpm:row.baseBpm,hand:row.hand,noteCount:row.noteCount,
    steps:[...row.steps],currentBpm:row.currentBpm,completed:[...row.completed],targetReached:row.targetReached};
}

/** A whole-song performance route; all source notes and older grades stay intact. */
export function createPerformancePlan(lesson,options={}){
  const hand=performanceHands.has(options.hand)?options.hand:'right';
  const sourceBpm=lesson?.sourceTempo!==undefined?lesson.sourceTempo:lesson?.tempo??null;
  if(!supportedPerformanceBpm(sourceBpm))return {supported:false,reason:'unsupported-source-tempo',sourceBpm,stage:null,progress:null};
  const notes=lesson?.notes;
  if(typeof lesson?.id!=='string'||!lesson.id||!Array.isArray(notes)||!notes.length||notes.length>5000)throw new TypeError('A whole performance needs a bounded source score.');
  createScoreTimeline(notes,{tempo:sourceBpm,sourceTempo:sourceBpm,preserveTiming:notes.some(note=>note?.time!==undefined||note?.duration!==undefined)});
  const sourceFingerprint=validFingerprint(options.sourceFingerprint)?options.sourceFingerprint:songFingerprint([
    lesson.id,lesson.arrangementVersion||lesson.sourceMidiSha256||'',hand,sourceBpm,notes.map(musicalNoteKey)]);
  const baseBpm=Math.min(sourceBpm,chooseLearningTempo(lesson,{kind:'composition',hand}).bpm);
  const steps=performanceSteps(baseBpm,sourceBpm),saved=normalizePerformanceProgress(options.progress);
  const matches=saved&&saved.sourceFingerprint===sourceFingerprint&&saved.hand===hand&&saved.noteCount===notes.length&&saved.sourceBpm===sourceBpm&&sameValues(saved.steps,steps);
  const progress=matches?saved:{version:PERFORMANCE_VERSION,sourceFingerprint,sourceBpm,baseBpm,hand,noteCount:notes.length,steps:[...steps],currentBpm:baseBpm,completed:[],targetReached:false};
  const bpm=progress.currentBpm,stage={id:'performance-'+bpm,purpose:'performance',kind:'check',whole:true,mode:'flow',requiredMode:'flow',assessment:true,
    title:bpm===sourceBpm?'В исходном темпе':'Поднимаем темп',instruction:`Сыграй всю песню самостоятельно: ${bpm} уд/мин.`,
    hand,notes:structuredClone(notes),tempo:bpm,sourceTempo:sourceBpm,sourceFingerprint,
    presentation:{target:false,names:false,staff:true,falling:false,preview:false,fingers:false}};
  return {supported:true,version:PERFORMANCE_VERSION,sourceFingerprint,sourceBpm,baseBpm,steps:[...steps],currentBpm:bpm,progress,stage};
}

/** One actual whole-song timed attempt, never a guided/repair pitch report. */
export function advancePerformanceTempo(value,report,options={}){
  const progress=normalizePerformanceProgress(value);
  const result=(reason='ignored',next=progress)=>({progress:next,bpm:next?.currentBpm??null,changed:!!next&&next.currentBpm!==progress?.currentBpm,reason,targetReached:next?.targetReached===true});
  if(!progress)return result('invalid-progress');
  if(!['midi','mic'].includes(options.source)||options.source==='mic'&&progress.hand==='both'||options.whole!==true||options.purpose!=='performance'||
    options.sourceFingerprint!==progress.sourceFingerprint||options.actualBpm!==progress.currentBpm||options.hand!==undefined&&options.hand!==progress.hand||
    [options,report].some(row=>row?.assisted===true||row?.beta===true||row?.demo===true||row?.repair===true||row?.partial===true||row?.breakdown===true)||
    report?.finished!==true||report?.metric!=='timed-notes-v1'||report.earlyAbort!==undefined&&report.earlyAbort!==false)return result();
  const total=report.total,correct=report.firstAttemptCorrect,outcomes=report.targetOutcomes,offsets=report.hitOffsetsMS;
  if(total!==progress.noteCount||!Number.isInteger(correct)||correct<0||correct>total||!Number.isInteger(report.correct)||report.correct<correct||report.correct>total||
    !Number.isInteger(report.skipped)||report.skipped<0||report.correct+report.skipped!==total||!Number.isInteger(report.wrong)||report.wrong<0||report.wrong>20000||
    !Array.isArray(outcomes)||outcomes.length!==total||Array.from(outcomes).some(value=>value!==0&&value!==1)||outcomes.filter(value=>value===1).length!==correct||
    !Array.isArray(offsets)||offsets.length!==total||Array.from(offsets).some((value,index)=>value!==null&&(!Number.isFinite(value)||Math.abs(value)>60000)||outcomes[index]===1&&!Number.isFinite(value)))return result();
  const percent=Math.floor(correct*100/total);
  if(report.scorePercent!==percent||report.scoreOutOf10!==undefined&&report.scoreOutOf10!==percent/10)return result();
  const current=progress.steps.indexOf(progress.currentBpm);
  if(percent<60){const next={...progress,currentBpm:progress.steps[Math.max(0,current-1)]};return result(current?'slow-down':'at-floor',next);}
  if(percent<80)return result('hold');
  const completed=progress.steps.filter(bpm=>progress.completed.includes(bpm)||bpm===progress.currentBpm);
  const next={...progress,completed,currentBpm:progress.steps[Math.min(progress.steps.length-1,current+1)],targetReached:completed.includes(progress.sourceBpm)};
  return result(next.targetReached?'source-tempo-passed':'speed-up',next);
}
