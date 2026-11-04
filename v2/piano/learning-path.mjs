import { COURSE, normalizeCourseProgress } from './course.mjs?v=63e9fd53e452';
import { CURRICULUM_SKILLS, CURRICULUM_CHECKPOINT_ALTERNATIVES, CURATED_SONG_GOALS, MUSICAL_LESSONS } from './curriculum-data.mjs?v=63e9fd53e452';

export const LEARNING_PATH_VERSION = 'practical-path-v1';
export const SKILLS = CURRICULUM_SKILLS.map(skill => ({ ...skill, prerequisites: [...skill.prerequisites],
  checkpointIds: [...skill.checkpointIds], lessonIds: COURSE.filter(lesson => lesson.skillIds.includes(skill.id)).map(lesson => lesson.id) }));
const PATH_LESSONS = new Map(COURSE.map(lesson => [lesson.id, lesson]));
const REVIEW_INTERVALS = [1, 3, 7]; // Product policy, not a claim about a learner's retention.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finiteScore = (value, max) => Number.isFinite(value) && value >= 0 && value <= max ? value : 0;
const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const dayFor = at => new Date(at).toISOString().slice(0, 10);
const addDays = (date, days) => dayFor(Date.parse(date) + days * 86400000);
const todayFor = date => validDay(date) ? date : dayFor(Date.now());
const emptyEvidence = () => ({ guidedBest: 0, readingBest: 0, timedBest: 0, recallBest: 0, readingMidi: false,
  coverageBest: 0, timedCoverageBest: 0, attempts: 0, lastAt: 0, reviewStep: 0, reviewDays: [], reviewBlockedDays: [], nextReviewDate: null });
function normalizeSelection(value) {
  if (!Array.isArray(value?.tasks) || value.tasks.length < 1 || value.tasks.length > 5) return null;
  const tasks = value.tasks.filter(task => task && ['new','reading','recall','rhythm','song'].includes(task.kind) &&
    (task.kind === 'song' || PATH_LESSONS.has(task.lessonId)) && Number.isInteger(task.minutes) && task.minutes >= 1 && task.minutes <= 20)
    .map(task => ({ kind: task.kind, lessonId: task.lessonId || null, minutes: task.minutes,
      role: ['new','review','rhythm','recall','song'].includes(task.role) ? task.role : task.kind,
      songId: typeof task.songId === 'string' ? task.songId.slice(0,80) : null, title: String(task.title || '').slice(0,150) }));
  return tasks.length === value.tasks.length ? { tasks } : null;
}

function eventInput(event) {
  if (!event || typeof event.attemptId !== 'string' || !event.attemptId || event.attemptId.length > 180 || !validDay(event.taskDate) || !validDay(event.date) ||
      ![event.assisted,event.cueVisible,event.beta,event.reportAssisted,event.earlyAbort].every(value => typeof value === 'boolean')) return null;
  const lesson = PATH_LESSONS.get(event.lessonId), task = event.kind === 'song' ?
    { id: event.taskId, date: event.taskDate, kind: 'song' } : lesson ? taskFor(lesson, event.kind, event.taskDate, 2, event.source) : null;
  if (!task || task.id !== event.taskId) return null;
  task.daySelection = normalizeSelection(event.selection);
  return { task, report: { finished: true, metric: event.metric, total: event.total, firstAttemptCorrect: event.firstAttemptCorrect,
    targetOutcomes: event.outcomes, scorePercent: event.scorePercent, scoreOutOf10: event.scoreOutOf10, assisted: event.reportAssisted, earlyAbort: event.earlyAbort },
    options: { at: event.at, date: event.date, mode: event.mode, source: event.source, assisted: event.assisted, cueVisible: event.cueVisible, beta: event.beta } };
}
function canonicalEvent(event) {
  const keys = ['attemptId','at','date','taskDate','taskId','kind','lessonId','metric','total','firstAttemptCorrect','outcomes',
    'mode','source','assisted','cueVisible','beta','reportAssisted','earlyAbort','scorePercent','scoreOutOf10'];
  return { ...Object.fromEntries(keys.filter(key => event[key] !== undefined).map(key => [key,event[key]])),
    ...(event.selection ? { selection: normalizeSelection(event.selection) } : {}) };
}
function eventSignature(event) {
  const { at, date, selection, ...evidence } = canonicalEvent(event);
  return JSON.stringify(evidence);
}

/** Derived fields are rebuilt from deduplicated evidence, never merged as achievement flags. */
export function normalizeLearningProgress(saved, { courseProgress } = {}) {
  const value = saved?.version === LEARNING_PATH_VERSION ? saved : {};
  const result = { version: LEARNING_PATH_VERSION, legacyReading: {}, events: [], conflicts: [], lessons: {}, days: {} };
  const legacyRows = { ...value.legacyReading };
  if (courseProgress) for (const [id, legacy] of Object.entries(normalizeCourseProgress(courseProgress).lessons)) if (legacy.passed) {
    const old = legacyRows[id]; legacyRows[id] = { score: Math.max(finiteScore(old?.score,10), legacy.bestScore), at: Math.max(old?.at || 0, legacy.lastAt) };
  }
  for (const lesson of COURSE) {
    const row = legacyRows[lesson.id], score = finiteScore(row?.score,10), at = row?.at;
    if (score < 8 || !Number.isFinite(at) || at < 0 || at > 253370764800000) continue;
    result.legacyReading[lesson.id] = { score, at };
    result.lessons[lesson.id] = { ...emptyEvidence(), readingBest: score, coverageBest: score, lastAt: at, nextReviewDate: addDays(dayFor(at),1) };
  }
  const conflicts = new Set(Array.isArray(value.conflicts) ? value.conflicts.filter(id => typeof id === 'string' && id.length <= 180) : []);
  const unique = new Map();
  for (const event of Array.isArray(value.events) ? value.events : []) {
    const input = eventInput(event);
    if (!input || conflicts.has(event.attemptId) || !applyLearningAttempt({lessons:{},days:{}},input.task,input.report,input.options)) continue;
    const canonical = canonicalEvent(event), old = unique.get(event.attemptId);
    if (old && eventSignature(old) !== eventSignature(canonical)) { unique.delete(event.attemptId); conflicts.add(event.attemptId); }
    else if (old) {
      const preferred = old.at < canonical.at || old.at === canonical.at && JSON.stringify(old) <= JSON.stringify(canonical) ? old : canonical;
      const selection = [old.selection,canonical.selection].filter(Boolean).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))[0];
      unique.set(event.attemptId,{ ...preferred, ...(selection ? {selection} : {}) });
    } else unique.set(event.attemptId, canonical);
  }
  for (const event of [...unique.values()].sort((a,b) => a.at-b.at || a.attemptId.localeCompare(b.attemptId))) {
    const input = eventInput(event);
    if (applyLearningAttempt(result,input.task,input.report,input.options)) result.events.push(JSON.parse(JSON.stringify(event)));
  }
  result.conflicts = [...conflicts].sort();
  for (const date of Object.keys(result.days).sort().slice(0,-28)) delete result.days[date];
  return result;
}

export function mergeLearningProgress(a,b) {
  const left = normalizeLearningProgress(a), right = normalizeLearningProgress(b), legacyReading = { ...left.legacyReading };
  // This compatibility baseline is reading only; new achievements always come from events below.
  for (const [id,row] of Object.entries(right.legacyReading)) if (!legacyReading[id] || row.score > legacyReading[id].score || row.score === legacyReading[id].score && row.at > legacyReading[id].at) legacyReading[id] = row;
  return normalizeLearningProgress({ version: LEARNING_PATH_VERSION, legacyReading, events: [...left.events,...right.events], conflicts: [...left.conflicts,...right.conflicts] });
}

function criterionReached(lesson, entry) {
  if (!entry) return false;
  if (lesson.practiceKind === 'rhythm') return entry.timedBest >= 80;
  if (['echo','recall'].includes(lesson.practiceKind)) return entry.recallBest >= 8;
  return entry.readingBest >= 8 && (!lesson.requiresMidiForAssessment || entry.readingMidi);
}
const checkpointChoices = skill => [skill.checkpointIds, ...(CURRICULUM_CHECKPOINT_ALTERNATIVES[skill.id] || [])];
const checkpointsReached = (skill, progress, predicate) => checkpointChoices(skill).some(ids =>
  ids.every(id => predicate(PATH_LESSONS.get(id), progress.lessons[id])));
function readySkills(progress) {
  return new Set(SKILLS.filter(skill => checkpointsReached(skill, progress, criterionReached)).map(skill => skill.id));
}
const coveredLesson = entry => entry && (entry.coverageBest >= 8 || entry.timedCoverageBest >= 80 || entry.readingBest >= 8 || entry.recallBest >= 8 || entry.timedBest >= 80);
function coveredSkills(progress) {
  return new Set(SKILLS.filter(skill => checkpointsReached(skill, progress, (_lesson, entry) => coveredLesson(entry))).map(skill => skill.id));
}
const hasIndependent = entry => entry && (entry.readingBest >= 8 || entry.recallBest >= 8 || entry.timedBest >= 80);

function lessonReady(lesson,progress,ready=readySkills(progress)) {
  return criterionReached(lesson,progress.lessons[lesson.id]) ||
    (lesson.id==='course-first-melody' || lesson.moduleId==='first-music') && lesson.skillIds.every(id=>ready.has(id));
}
function prerequisitesMet(lesson,progress,covered,ready) {
  return lesson.prerequisites.every(id=>covered.has(id)) && (lesson.lessonPrerequisiteIds || []).every(id=>{
    const prerequisite=PATH_LESSONS.get(id);return prerequisite && lessonReady(prerequisite,progress,ready);
  });
}

/** Bounded catalogue preparation; this never derives skill from a title or MIDI. */
export function evaluateLearningGoal(saved,{compositionId,hand='right',date}={}) {
  const progress=normalizeLearningProgress(saved),spec=Object.hasOwn(CURATED_SONG_GOALS,compositionId)?CURATED_SONG_GOALS[compositionId]:null;
  const availableHands=spec?.availableHands || ['right','left','both'];
  if(!spec || !['right','left','both'].includes(hand) || !availableHands.includes(hand))return {known:false,requiredSkillIds:[],missingSkillIds:[],recommendedLessonIds:[],ready:false};
  const ready=readySkills(progress),covered=coveredSkills(progress),requiredSkillIds=[...new Set(spec[hand])],missingSkillIds=requiredSkillIds.filter(id=>!ready.has(id));
  const needed=new Set();
  const include=id=>{if(ready.has(id)||needed.has(id))return;for(const prerequisite of SKILLS.find(skill=>skill.id===id)?.prerequisites || [])include(prerequisite);needed.add(id);};
  missingSkillIds.forEach(include);
  const recommendedLessonIds=[];
  for(const skillId of needed){
    const candidates=COURSE.filter(lesson=>lesson.skillIds.includes(skillId)&&!lessonReady(lesson,progress,ready)&&prerequisitesMet(lesson,progress,covered,ready));
    const firstKeyNeeded=skillId==='keyboard-landmarks'&&!(progress.lessons['course-first-key']?.readingBest>=8||progress.lessons['course-do']?.readingBest>=8);
    const preferred=(firstKeyNeeded&&candidates.find(lesson=>lesson.id==='course-first-key')) || candidates.find(lesson=>lesson.moduleId==='first-music') || candidates.find(lesson=>lesson.id==='course-first-melody') || candidates[0];
    if(preferred&&!recommendedLessonIds.includes(preferred.id))recommendedLessonIds.push(preferred.id);
    if(recommendedLessonIds.length>=4)break;
  }
  return {known:true,requiredSkillIds,missingSkillIds,recommendedLessonIds,ready:missingSkillIds.length===0};
}

export function skillState(progress, id, { date } = {}) {
  const skill = SKILLS.find(item => item.id === id); if (!skill) return null;
  const normalized = normalizeLearningProgress(progress), ready = readySkills(normalized), covered = coveredSkills(normalized), today = todayFor(date);
  const entries = skill.lessonIds.map(lessonId => normalized.lessons[lessonId]).filter(Boolean);
  const retained = ready.has(id) && checkpointsReached(skill, normalized, (_lesson, entry) => entry?.reviewStep >= 3);
  return { id, title: skill.title, ready: ready.has(id), covered: covered.has(id), retained,
    status: retained ? 'retained' : ready.has(id) ? 'ready' : entries.some(hasIndependent) ? 'practicing' : entries.length ? 'introduced' : 'new',
    due: entries.some(entry => hasIndependent(entry) && entry.nextReviewDate && entry.nextReviewDate <= today),
    prerequisitesMet: skill.prerequisites.every(prerequisite => covered.has(prerequisite)) };
}

function sampleNotes(lesson, kind) {
  if (kind !== 'recall') return lesson.notes.map(note => ({ ...note }));
  if (lesson.notes.some(note => Number.isInteger(note.group))) {
    const groups = [...new Set(lesson.notes.map(note => note.group))].slice(0, 3);
    return lesson.notes.filter(note => groups.includes(note.group)).map(note => ({ ...note }));
  }
  return lesson.notes.slice(0, 6).map(note => ({ ...note }));
}
function taskFor(lesson, kind, date, minutes, input, role = kind) {
  const memory = kind === 'recall' || ['echo','recall'].includes(lesson.practiceKind);
  const rhythm = kind === 'rhythm';
  const presentation = memory ? { target: false, names: false, staff: false, falling: false, preview: role === 'new' } : rhythm ?
    { target: false, names: false, staff: false, falling: false, preview: true, pulse: true } :
    { target: false, names: false, staff: true, falling: false, preview: lesson.practiceKind !== 'reading' };
  return { id: `${date}:${kind}:${lesson.id}`, date, kind, role, lessonId: lesson.id, skillIds: [...lesson.skillIds],
    title: kind === 'recall' && role !== 'new' ? `Вспомни: ${lesson.title}` : lesson.title, minutes, notes: sampleNotes(lesson, kind), presentation,
    displayPracticeKind: lesson.practiceKind, completion: kind === 'new' && lesson.learningRoute !== 'guided-check' ? 'flow-60' : rhythm ? 'flow-80' : 'independent-80',
    requiredMetric: rhythm ? 'timed-notes-v1' : 'first-attempt-v1', passPercent: 80,
    evidenceKind: rhythm ? 'timed' : memory ? 'recall' : 'reading',
    requiresMidiForAssessment: lesson.requiresMidiForAssessment === true,
    ...(kind==='reading'&&typeof lesson.notationGuide==='string'?{notationGuide:lesson.notationGuide}:{}),
    ...(kind === 'new' && lesson.learningRoute === 'guided-check' ? { learningRoute: 'guided-check', optionalFlow: true } : {}),
    ...(rhythm && role === 'new' ? { guidedPresentation: { target: true, names: true, staff: false, falling: true, preview: true, pulse: true } } : {}),
    notice: lesson.requiresMidiForAssessment && input !== 'midi' ? 'Через микрофон это тренировка. Независимая проверка двух звуков — с MIDI.' : '',
    instruction: kind === 'recall' && role !== 'new' ? 'Вспомни короткий рисунок без показа. Если забыл, можно послушать помощь и потренироваться; память проверим в другой день.' : memory ?
      'Сначала короткий показ. Затем ноты и подписи исчезнут: повтори сам. Повторный показ считается помощью.' : lesson.instruction,
    ...(kind === 'new' && !['echo','recall','reading'].includes(lesson.practiceKind) ? { presentation: null } : {}) };
}
function finishDailyPlan(tasks, today, budget, completed) {
  const selection = normalizeSelection({ tasks: tasks.map(({ kind, lessonId, minutes, role, songId, title }) =>
    ({ kind, lessonId: lessonId ?? null, minutes, role: role || kind, songId: songId ?? null, title })) });
  return { id: `piano-day:${today}`, date: today, minutes: budget,
    tasks: tasks.map(task => ({ ...task, ...(task.kind === 'song' ? { compositionId: task.songId || null, practiceScope: 'fragment-or-whole', preferredHand: 'both', completion: 'flow-60' } : {}), daySelection: selection, completed: completed.includes(task.id) })),
    title: 'Сегодня у клавиш', description: 'Немного вспомнить, освоить одно новое движение и сыграть музыку.' };
}
/** Optional program browsing uses the same evidence contract as the daily route. */
export function createPracticeTask(lessonId,{date,input='mic',progress}={}){
  const lesson=PATH_LESSONS.get(lessonId);if(!lesson)return null;const day=todayFor(date),kind=lesson.practiceKind==='reading'?'reading':['echo','recall'].includes(lesson.practiceKind)?'recall':lesson.practiceKind==='rhythm'?'rhythm':'new';
  const task=taskFor(lesson,kind,day,4,input,'new'),plan=createDailyPlan(progress,{date:day,input});task.daySelection=plan.tasks[0]?.daySelection||null;return task;
}

/** A small queue: due retrieval, one new idea, rhythm, then music of the user's choice. */
export function createDailyPlan(saved, { date, minutes = 15, input = 'mic', song = null, goal = null, courseProgress } = {}) {
  const progress = normalizeLearningProgress(saved, { courseProgress }), today = todayFor(date), covered = coveredSkills(progress), ready=readySkills(progress);
  const budget = Number.isFinite(minutes) ? clamp(Math.round(minutes), 5, 20) : 15, tasks = [];
  const completed = progress.days[today]?.completed || [], frozen = progress.days[today]?.selection;
  if (frozen) return finishDailyPlan(frozen.tasks.map(item => item.kind === 'song' ? { ...item, id: `${today}:song:${item.songId || 'choice'}`, date: today, skillIds: [] } :
    taskFor(PATH_LESSONS.get(item.lessonId), item.kind, today, item.minutes, input,item.role)), today, frozen.tasks.reduce((sum, task) => sum + task.minutes, 0), completed);
  const goalEvidence=goal && goal.status!=='unknown' ? evaluateLearningGoal(progress,{compositionId:goal.compositionId,hand:goal.hand||'right',date:today}) : null;
  const suggestedSong=song?.id && (!goal || goalEvidence?.known&&goalEvidence.ready) ? song : null;
  const firstKey = progress.lessons['course-first-key'], firstMelody = progress.lessons['course-first-melody'];
  const firstMelodyReady = firstMelody?.readingBest >= 8;
  const olderLandmarksReady = ['course-do-re-mi','course-fa','course-first-answer'].some(id => progress.lessons[id]?.readingBest >= 8);
  // A fresh learner gets a short, musical entry. Old frozen days and reports keep
  // their exact exercise signatures; passing the new tune never invents old grades.
  if (!firstMelodyReady && !olderLandmarksReady) {
    if (!(firstKey?.readingBest >= 8 || progress.lessons['course-do']?.readingBest >= 8)) tasks.push(taskFor(PATH_LESSONS.get('course-first-key'),'new',today,2,input,'new'));
    const melody = taskFor(PATH_LESSONS.get('course-first-melody'),'new',today,Math.min(4,budget-tasks.reduce((sum, task) => sum+task.minutes,0)),input,'new');
    if (tasks.length) melody.afterTaskId = tasks[0].id;
    tasks.push(melody);
    if (suggestedSong && budget >= 10) tasks.push({ id: `${today}:song:${String(suggestedSong.id).slice(0,80)}`, date: today, kind: 'song',
      songId: String(suggestedSong.id).slice(0,80), title: `Моя музыка: ${String(suggestedSong.title || 'выбранная композиция').slice(0,100)}`,
      minutes: Math.max(1,budget-tasks.reduce((sum, task) => sum+task.minutes,0)), skillIds: [], role: 'song',
      instruction: 'Попробуй маленький кусок выбранной музыки. Можно закончить занятие после первой мелодии и вернуться к композиции позже.' });
    return finishDailyPlan(tasks,today,tasks.reduce((sum, task) => sum+task.minutes,0),completed);
  }
  const supersededByIntro = lesson => ['course-first-key','course-first-melody'].includes(lesson.id) && (firstMelodyReady || olderLandmarksReady) ||
    firstMelodyReady && ['course-do','course-do-re','course-do-re-mi'].includes(lesson.id) ||
    progress.lessons['course-music-step']?.readingBest>=8 && ['course-fa','course-first-answer','course-five','course-repeats','course-steps','course-skips','course-five-checkpoint'].includes(lesson.id) ||
    progress.lessons['course-music-pulse']?.timedBest>=80 && ['course-pulse-even','course-pulse-two-counts','course-pulse-long-short'].includes(lesson.id) ||
    progress.lessons['course-music-space']?.timedBest>=80 && lesson.id==='course-pulse-one-rest';
  const due = COURSE.filter(lesson => hasIndependent(progress.lessons[lesson.id]) && progress.lessons[lesson.id].nextReviewDate <= today &&
    progress.lessons[lesson.id].nextReviewDate && !(lesson.id === 'course-first-key' && firstMelodyReady) && (!lesson.requiresMidiForAssessment || input === 'midi'))
    .sort((a,b) => progress.lessons[a.id].nextReviewDate.localeCompare(progress.lessons[b.id].nextReviewDate));
  const add = (lesson, kind, length, role = kind) => { const task = taskFor(lesson, kind, today, length, input,role); if (!tasks.some(item => item.id === task.id)) tasks.push(task); };
  for (const lesson of due.slice(0, budget >= 12 ? 2 : 1)) add(lesson, lesson.practiceKind === 'rhythm' ? 'rhythm' : 'recall', 2, 'review');
  const unlocked = COURSE.filter(lesson => !supersededByIntro(lesson) && prerequisitesMet(lesson,progress,covered,ready));
  const musicalCandidate=MUSICAL_LESSONS.map(lesson=>PATH_LESSONS.get(lesson.id)).find(lesson=>unlocked.includes(lesson)&&!lessonReady(lesson,progress,ready));
  const goalCandidate=goalEvidence?.recommendedLessonIds.map(id=>PATH_LESSONS.get(id)).find(lesson=>unlocked.includes(lesson)&&!lessonReady(lesson,progress,ready));
  const candidate = musicalCandidate || goalCandidate || unlocked.find(lesson => !coveredLesson(progress.lessons[lesson.id]) && (!lesson.requiresMidiForAssessment || input === 'midi')) ||
    unlocked.find(lesson => !coveredLesson(progress.lessons[lesson.id]));
  if (candidate) add(candidate, candidate.practiceKind === 'reading' ? 'reading' : ['echo','recall'].includes(candidate.practiceKind) ? 'recall' : candidate.practiceKind === 'rhythm' ? 'rhythm' : 'new', budget >= 10 ? 5 : 2, 'new');
  if(musicalCandidate){
    if(suggestedSong&&budget>=10)tasks.push({id:`${today}:song:${String(suggestedSong.id).slice(0,80)}`,date:today,kind:'song',songId:String(suggestedSong.id).slice(0,80),
      title:`Моя музыка: ${String(suggestedSong.title||'выбранная композиция').slice(0,100)}`,minutes:Math.max(1,budget-tasks.reduce((sum,task)=>sum+task.minutes,0)),skillIds:[],role:'song',
      instruction:'Попробуй небольшой знакомый кусок выбранной песни. Это практика фрагмента, а не зачёт всей композиции.'});
    return finishDailyPlan(tasks,today,tasks.reduce((sum,task)=>sum+task.minutes,0),completed);
  }
  const rhythm = unlocked.find(lesson => lesson.practiceKind === 'rhythm' && !tasks.some(task => task.lessonId === lesson.id));
  if (rhythm && budget >= 10 && tasks.length < 4) add(rhythm, 'rhythm', 2);
  if (!tasks.some(task => task.kind === 'recall') && budget >= 10 && tasks.length < 4) {
    const memory = unlocked.find(lesson => hasIndependent(progress.lessons[lesson.id]) && !lesson.requiresMidiForAssessment) || candidate;
    if (memory) { add(memory, 'recall', 2); if (!hasIndependent(progress.lessons[memory.id])) tasks.at(-1).afterTaskId = tasks.find(task => task.lessonId === memory.id && task.kind !== 'recall')?.id; }
  }
  if(!goal||suggestedSong)tasks.push({ id: `${today}:song:${String(suggestedSong?.id || 'choice').slice(0,80)}`, date: today, kind: 'song',
    songId: typeof suggestedSong?.id === 'string' ? suggestedSong.id.slice(0, 80) : null, title: suggestedSong?.title ? `Моя музыка: ${String(suggestedSong.title).slice(0,100)}` : 'Сыграй любимый кусочек',
    minutes: Math.max(1, budget - tasks.reduce((sum, task) => sum + task.minutes, 0)), skillIds: [], role: 'song',
    instruction: 'Разучи небольшой знакомый кусок: правая, левая, вместе. Можно просто поиграть для себя — это не экзамен.' });
  while (tasks.length > 1 && tasks.reduce((sum, task) => sum + task.minutes, 0) > budget) {
    const task = tasks.find(item => item.minutes > 1); if (!task) break; task.minutes--;
  }
  return finishDailyPlan(tasks, today, budget, completed);
}

function verifiedReport(report, total, metric) {
  const partialAbort = metric === 'timed-notes-v1' && report?.earlyAbort === true;
  if (!report || report.finished !== true || report.metric !== metric || report.total !== total || !Number.isInteger(total) || total < 1 || total > 5000 ||
      !Number.isInteger(report.firstAttemptCorrect) || report.firstAttemptCorrect < 0 || report.firstAttemptCorrect > total || report.demo || report.breakdown ||
      report.earlyAbort !== undefined && typeof report.earlyAbort !== 'boolean' || report.assisted !== undefined && typeof report.assisted !== 'boolean' ||
      report.earlyAbort === true && !partialAbort ||
      !Array.isArray(report.targetOutcomes) || report.targetOutcomes.length !== total ||
      Array.from(report.targetOutcomes).some(value => value !== 0 && value !== 1 && !(partialAbort && value === null)) ||
      partialAbort && !report.targetOutcomes.includes(0) ||
      report.targetOutcomes.reduce((sum, value) => sum + (value === 1 ? 1 : 0), 0) !== report.firstAttemptCorrect) return false;
  const percent = Math.floor(report.firstAttemptCorrect * 100 / total);
  return (report.scorePercent === undefined || report.scorePercent === percent) &&
    (report.scoreOutOf10 === undefined || report.scoreOutOf10 === percent / 10);
}

/** Call with the actual runtime mode and cue visibility. A planned hidden screen is not proof it stayed hidden. */
function applyLearningAttempt(progress, task, report, options = {}) {
  const lesson = PATH_LESSONS.get(task?.lessonId);
  const { at = Date.now(), date, source, assisted, cueVisible, beta = false, breakdown = false, mode = report?.mode } = options;
  if (!task || !['new','reading','recall','rhythm','song'].includes(task.kind) || !['mic','midi','tap'].includes(source) ||
      !Number.isFinite(at) || at < 0 || at > 253370764800000 || beta !== true && beta !== false || breakdown || report?.demo) return false;
  const today = todayFor(date || dayFor(at));
  if (task.kind === 'song') {
    if (mode !== 'flow' || !verifiedReport(report, report?.total, 'timed-notes-v1') || report.firstAttemptCorrect * 10 < report.total * 6 || report.earlyAbort) return false;
    const day = progress.days[today] ||= { completed: [], selection: normalizeSelection(task.daySelection) };
    if (task.date === today && !day.completed.includes(task.id)) day.completed.push(task.id);
    return true;
  }
  if (!lesson ||
      source === 'tap' && lesson.practiceKind !== 'rhythm' || breakdown || report?.demo || !Number.isFinite(at) || at < 0 || at > 8640000000000000 ||
      !Array.isArray(task.notes) || task.notes.length !== sampleNotes(lesson,task.kind).length ||
      task.notes.some((note,index) => note.midi !== lesson.notes[index].midi || note.beats !== lesson.notes[index].beats || note.group !== lesson.notes[index].group || note.restBefore !== lesson.notes[index].restBefore)) return false;
  const metric = task.kind === 'rhythm' || task.kind === 'new' && mode === 'flow' ? 'timed-notes-v1' : 'first-attempt-v1';
  if (!verifiedReport(report, task.notes.length, metric) || !['learn','check','flow'].includes(mode) || metric === 'timed-notes-v1' && mode !== 'flow' ||
      ['reading','recall'].includes(task.kind) && mode !== 'check') return false;
  const percent = Math.floor(report.firstAttemptCorrect * 100 / report.total), value = percent / 10;
  const day = progress.days[today] ||= { completed: [], selection: normalizeSelection(task.daySelection) };
  day.selection ||= normalizeSelection(task.daySelection);
  const entry = progress.lessons[lesson.id] ||= emptyEvidence();
  const hadGuidedPass = entry.guidedBest >= 8;
  entry.attempts = Math.min(1000000, entry.attempts + 1); entry.lastAt = Math.max(entry.lastAt, at);
  // A timed abort leaves future outcomes null. Preserve that failed attempt for
  // retrieval scheduling, without promoting any partial score to an achievement.
  if (report.earlyAbort) {
    if (task.kind === 'rhythm' || task.kind === 'recall' || ['rhythm','echo','recall'].includes(lesson.practiceKind)) {
      if (!entry.reviewBlockedDays.includes(today)) entry.reviewBlockedDays = [...entry.reviewBlockedDays,today].sort().slice(-28);
      entry.reviewStep = 0; entry.nextReviewDate = addDays(today,1);
    }
    return true;
  }
  if (mode === 'flow') entry.timedCoverageBest = Math.max(entry.timedCoverageBest, percent);
  else entry.coverageBest = Math.max(entry.coverageBest, value);
  if (task.kind === 'new' && lesson.learningRoute !== 'guided-check' && mode === 'flow' && percent >= 60 && entry.coverageBest >= 8 && !report.earlyAbort && task.date === today && !day.completed.includes(task.id)) day.completed.push(task.id);
  const independent = mode !== 'learn' && assisted === false && report.assisted !== true && !report.earlyAbort && !beta &&
    (!lesson.requiresMidiForAssessment || source === 'midi');
  if (task.kind === 'new' && lesson.learningRoute === 'guided-check' && mode === 'check' && percent >= 80 && hadGuidedPass && independent &&
      task.date === today && !day.completed.includes(task.id)) day.completed.push(task.id);
  const recall = task.kind === 'recall' || ['echo','recall'].includes(lesson.practiceKind);
  if ((recall || task.kind === 'rhythm') && (!independent || cueVisible !== false || percent < 80)) {
    if (!entry.reviewBlockedDays.includes(today)) entry.reviewBlockedDays = [...entry.reviewBlockedDays,today].sort().slice(-28);
    entry.reviewStep = 0; entry.nextReviewDate = addDays(today,1);
  }
  if (!independent || (recall || task.kind === 'rhythm') && cueVisible !== false) { entry.guidedBest = Math.max(entry.guidedBest, value); return true; }
  const field = metric === 'timed-notes-v1' ? 'timedBest' : recall ? 'recallBest' : 'readingBest';
  entry[field] = Math.max(entry[field], metric === 'timed-notes-v1' ? percent : value);
  if (field === 'readingBest' && source === 'midi' && value >= 8) entry.readingMidi = true;
  if (percent < 80) { if (recall || task.kind === 'rhythm') { entry.reviewStep = 0; entry.nextReviewDate = addDays(today, 1); } return true; }
  if (recall || task.kind === 'rhythm') {
    if (entry.nextReviewDate && today >= entry.nextReviewDate && !entry.reviewDays.includes(today) && !entry.reviewBlockedDays.includes(today)) {
      entry.reviewDays = [...entry.reviewDays, today].sort().slice(-8); entry.reviewStep = Math.min(3, entry.reviewStep + 1);
      entry.nextReviewDate = addDays(today, REVIEW_INTERVALS[entry.reviewStep] ?? 7);
    } else entry.nextReviewDate ||= addDays(today, 1);
  } else entry.nextReviewDate ||= addDays(today, 1);
  if (task.kind !== 'new' && task.date === today && !day.completed.includes(task.id)) day.completed.push(task.id);
  return true;
}

export function recordLearningAttempt(saved,task,report,options = {}) {
  if (!options || typeof options !== 'object') return normalizeLearningProgress(saved);
  const progress = normalizeLearningProgress(saved), at = options.at ?? Date.now(), mode = options.mode ?? report?.mode;
  const probe = normalizeLearningProgress(progress);
  if (!applyLearningAttempt(probe,task,report,{ ...options,at,mode })) return progress;
  const row = { attemptId: String(options.attemptId || `${task.id}:${mode}:${at}`), at, date: todayFor(options.date || dayFor(at)),
    taskDate: task.date, taskId: task.id, kind: task.kind, lessonId: task.lessonId || null, metric: report.metric, total: report.total,
    firstAttemptCorrect: report.firstAttemptCorrect, outcomes: [...report.targetOutcomes], mode, source: options.source,
    assisted: options.assisted === false ? false : true, cueVisible: options.cueVisible === false ? false : true,
    beta: options.beta === true, reportAssisted: report.assisted === true, earlyAbort: report.earlyAbort === true,
    ...(report.scorePercent !== undefined ? { scorePercent: report.scorePercent } : {}), ...(report.scoreOutOf10 !== undefined ? { scoreOutOf10: report.scoreOutOf10 } : {}),
    ...(!progress.days[todayFor(options.date || dayFor(at))]?.selection ? { selection: normalizeSelection(task.daySelection) } : {}) };
  return mergeLearningProgress(progress,{ version: LEARNING_PATH_VERSION, events: [row] });
}

export function isLearningTaskComplete(progress,task) {
  return !!task && (normalizeLearningProgress(progress).days[task.date]?.completed.includes(task.id) || false);
}

export function learningSummary(saved, { date, courseProgress } = {}) {
  const progress = normalizeLearningProgress(saved, { courseProgress }), today = todayFor(date);
  const skills = SKILLS.map(skill => skillState(progress, skill.id, { date: today }));
  return { totalSkills: skills.length, coveredSkills: skills.filter(skill => skill.covered).length, readySkills: skills.filter(skill => skill.ready).length, retainedSkills: skills.filter(skill => skill.retained).length,
    dueLessons: Object.values(progress.lessons).filter(entry => hasIndependent(entry) && entry.nextReviewDate && entry.nextReviewDate <= today).length,
    completedToday: progress.days[today]?.completed.length || 0, skills };
}
export function nextLearningTask(progress, options) {
  return createDailyPlan(progress, options).tasks.find(task => !task.completed) || null;
}
