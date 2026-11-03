import { createArrangement } from './arrangement.mjs?v=902d86820b77';

export const COMPOSITION_STUDY_VERSION = 'composition-study-v2';
const WINDOW = .035, EPSILON = 1e-9, REFERENCE_GROUPS = 8, MAX_GROUPS = 16;
const MAX_STAGES = 2048, MAX_PLAN_EVENTS = 60000;
const handTitles = { right: 'Правая рука', left: 'Левая рука', both: 'Обе руки' };
const tooLarge = () => { throw new RangeError('Этот MIDI слишком большой для пошагового обучения. Попробуй более короткую аранжировку.'); };

function onsetGroups(notes) {
  const groups = [];
  for (let start = 0; start < notes.length;) {
    let end = start + 1;
    while (end < notes.length && notes[end].time - notes[start].time <= WINDOW + EPSILON) end++;
    groups.push({ time: notes[start].time, last: notes[end - 1].time, notes: notes.slice(start, end) });
    start = end;
  }
  return groups;
}

function absoluteNotes(arrangement, field) {
  return arrangement[field].map(note => ({ ...note, time: note.time + arrangement.sourceStart }))
    .sort((a, b) => a.time - b.time || a.midi - b.midi);
}

function commonSections(notes, referenceHand) {
  const combined = onsetGroups(notes), references = onsetGroups(notes.filter(note => note.hand === referenceHand));
  const refIds = new Map(); references.forEach((group, index) => group.notes.forEach(note => refIds.set(note, index)));
  // Protect each hand's 35 ms chord as well as the combined groups. The window
  // is anchored to its first onset; nearby arpeggios are not chained together.
  const guards = [...combined, ...references, ...onsetGroups(notes.filter(note => note.hand !== referenceHand))]
    .filter(group => group.last > group.time + EPSILON)
    .map(group => ({ start: group.time, end: group.last })).sort((a, b) => a.start - b.start);
  const intervals = [];
  for (const guard of guards) {
    const last = intervals.at(-1);
    if (last && guard.start <= last.end + EPSILON) last.end = Math.max(last.end, guard.end);
    else intervals.push({ ...guard });
  }
  let interval = 0;
  const safeBoundary = time => {
    while (interval < intervals.length && intervals[interval].end < time - EPSILON) interval++;
    const guard = intervals[interval];
    return !guard || guard.start >= time - EPSILON || guard.end < time - EPSILON;
  };
  const sections = []; let start = notes[0].time, count = 0, ids = new Set();
  for (const group of combined) {
    if (count && (ids.size >= REFERENCE_GROUPS || count >= MAX_GROUPS) && safeBoundary(group.time)) {
      sections.push({ start, end: group.time }); start = group.time; count = 0; ids = new Set();
    }
    for (const note of group.notes) if (refIds.has(note)) ids.add(refIds.get(note));
    if (++count > 128) tooLarge(); // pathological crossing chords cannot make one unbounded part
  }
  sections.push({ start, end: Math.max(...notes.map(note => note.time + note.duration)) });
  return sections;
}

function clippedBacking(events, start, end) {
  return events.flatMap(note => {
    const from = Math.max(start, note.time), to = Math.min(end, note.time + note.duration);
    return to > from ? [{ ...note, time: from - start, duration: to - from }] : [];
  });
}

/**
 * Guided coverage is separate from mastery. The caller must require a real
 * non-demo score >= 8/10 to advance and must not turn chunk coverage into a
 * passed whole-composition check. Every source onset appears once per phase.
 */
export function createCompositionStudy(composition) {
  if (typeof composition?.id !== 'string' || !composition.id) throw new TypeError('Composition study needs a stable composition id.');
  const right = createArrangement(composition), availableHands = [...right.availableHands];
  const arrangements = { right };
  for (const hand of ['left', 'both']) if (availableHands.includes(hand)) arrangements[hand] = createArrangement(composition, { hand });
  const reference = absoluteNotes(arrangements.both || right, 'notes');
  if (!reference.length || reference.length > 5000) tooLarge();
  const sections = commonSections(reference, 'right'), stages = [];
  const absolute = Object.fromEntries(Object.entries(arrangements).map(([hand, arrangement]) => [hand, {
    notes: absoluteNotes(arrangement, 'notes'), backing: absoluteNotes(arrangement, 'backing'),
  }]));
  let eventCount = 0;
  const addStage = (hand, section, sectionIndex, whole = false) => {
    const arrangement = arrangements[hand], source = absolute[hand];
    const selected = whole ? source.notes : source.notes.filter(note => note.time >= section.start - EPSILON &&
      (sectionIndex === sections.length - 1 || note.time < section.end - EPSILON));
    if (!selected.length) return;
    const sourceStart = selected[0].time;
    // Main note durations remain untouched, even if a held note crosses the
    // next section. Only backing tails are clipped to this common interval.
    const notes = selected.map(note => ({ ...note, studySourceTime: note.time, time: Math.max(0, note.time - sourceStart) }));
    const backing = clippedBacking(source.backing, sourceStart, section.end);
    eventCount += notes.length + backing.length;
    if (eventCount > MAX_PLAN_EVENTS || stages.length >= MAX_STAGES) tooLarge();
    const part = whole ? null : sectionIndex + 1;
    const onlyRight = hand === 'both' && notes.every(note => note.hand === 'right');
    const onlyLeft = hand === 'both' && notes.every(note => note.hand === 'left');
    const instruction = whole ? 'Соедини все участки и сыграй всю учебную аранжировку целиком. Это отдельный проход после разучивания частей.' :
      `${hand === 'right' ? 'Разучи этот участок правой рукой.' : hand === 'left' ? 'Теперь разучи тот же участок левой рукой.' :
        onlyRight ? 'Здесь играет правая рука; левая пока отдыхает.' : onlyLeft ? 'Здесь играет левая рука; правая пока отдыхает.' : 'Соедини знакомый участок обеими руками.'} ` +
      'Дорожка ждёт нужную клавишу. Набери не меньше 8 из 10, чтобы продолжить.';
    stages.push({ id: whole ? `${hand}-whole` : `${hand}-part-${part}`, title: whole ? `Целиком · ${handTitles[hand].toLowerCase()}` :
      `${handTitles[hand]} · участок ${part} из ${sections.length}`, hand, part, parts: sections.length,
      start: section.start, end: section.end, sourceStart, whole, notes, backing,
      sourceTempo: arrangement.sourceTempo, instruction, description: arrangement.description,
      backingDescription: arrangement.backingDescription || '',
      requiresMidi: arrangement.requiresMidi, rangeIssue: arrangement.rangeIssue,
      sourceTrackIds: { ...arrangement.sourceTrackIds } });
  };
  sections.forEach((section, index) => {
    for (const hand of ['right', 'left', 'both']) if (arrangements[hand]) addStage(hand, section, index);
  });
  const wholeHand = arrangements.both ? 'both' : 'right';
  addStage(wholeHand, { start: reference[0].time, end: Math.max(...reference.map(note => note.time + note.duration)) }, 0, true);
  const sourceVersion = composition.arrangementVersion || composition.sourceMidiSha256 || 'midi-v1';
  return { id: composition.id, title: composition.title || 'Композиция', sourceVersion,
    version: `${COMPOSITION_STUDY_VERSION}:${composition.id}:${sourceVersion}`,
    stages, availableHands, sections: sections.map(section => ({ ...section })) };
}

function planIds(plan) {
  if (typeof plan?.version !== 'string' || !Array.isArray(plan.stages) || plan.stages.length > MAX_STAGES ||
      plan.stages.some(stage => typeof stage?.id !== 'string' || !stage.id)) throw new TypeError('Invalid composition study plan.');
  const ids = plan.stages.map(stage => stage.id);
  if (new Set(ids).size !== ids.length) throw new TypeError('Composition study stages need distinct ids.');
  return ids;
}

/** Coverage of guided stages is intentionally not whole-composition mastery. */
export function normalizeStudyProgress(plan, saved) {
  const ids = planIds(plan);
  // v1 used the same ids and source boundaries, with hands as the outer loop.
  // Accept that exact source revision only; unrelated/unknown versions reset.
  const previousVersion = typeof plan.sourceVersion === 'string' && plan.version === `${COMPOSITION_STUDY_VERSION}:${plan.id}:${plan.sourceVersion}` ?
    `composition-study-v1:${plan.sourceVersion}` : null;
  const sameVersion = saved?.version === plan.version || previousVersion !== null && saved?.version === previousVersion;
  const known = new Set(sameVersion && Array.isArray(saved.completed) ? saved.completed : []);
  const completed = ids.filter(id => known.has(id));
  const cursor = sameVersion && ids.includes(saved.cursor) ? saved.cursor : ids.find(id => !known.has(id)) || ids.at(-1) || null;
  return { version: plan.version, completed, cursor };
}

export function recordStudyAttempt(plan, saved, stageId, report, { demo = false, breakdown = false } = {}) {
  const progress = normalizeStudyProgress(plan, saved), stageIndex = plan.stages.findIndex(stage => stage.id === stageId);
  const stage = plan.stages[stageIndex], total = stage?.notes?.length, correct = report?.firstAttemptCorrect;
  if (!stage || !Number.isInteger(total) || total < 1 || report?.finished !== true || report.total !== total ||
      report.metric !== 'first-attempt-v1' || !Number.isInteger(correct) || correct < 0 || correct > total ||
      demo || breakdown || report.demo === true || report.breakdown === true || correct * 10 < total * 8) return progress;
  const score = Math.floor(correct * 100 / total) / 10;
  if (report.scoreOutOf10 !== undefined && (!Number.isFinite(report.scoreOutOf10) || Math.abs(report.scoreOutOf10 - score) > EPSILON)) return progress;
  const completed = new Set([...progress.completed, stageId]);
  return { version: plan.version, completed: plan.stages.map(stage => stage.id).filter(id => completed.has(id)),
    cursor: plan.stages[stageIndex + 1]?.id || stageId };
}
