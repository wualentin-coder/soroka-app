import { createArrangement } from './arrangement.mjs?v=119118b1bfbc';
import { musicalNoteKey,songFingerprint,songPhraseSections } from './song-learning.mjs?v=119118b1bfbc';
export { recommendSongRepair } from './song-learning.mjs?v=119118b1bfbc';

export const COMPOSITION_STUDY_VERSION = 'composition-study-v3';
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

function legacySections(notes, referenceHand) {
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

// Only public, previously shipped arrangements may supply a legacy baseline.
// Unknown/private MIDI keeps its old receipt without guessing old note content.
const LEGACY_PUBLIC_SOURCES = Object.freeze({
  'fur-elise:mutopia-931-opening-35-v1':{fingerprint:'f9ab7847cdcf1257',v1:true},
  'joy:flow-melody-v1':{fingerprint:'4d321167b92ad5bf',v1:false},
  'star:flow-melody-v1':{fingerprint:'3db1a0e7a58fdee3',v1:false},
});
const stageKey=stage=>JSON.stringify([stage.hand,stage.whole,stage.start,stage.end,stage.sourceStart,stage.sourceTempo,
  stage.requiresMidi,stage.sourceTrackIds,stage.notes.map(musicalNoteKey),stage.backing.map(musicalNoteKey)]);

/** Fragments -> connections -> whole guided coverage -> a separate timed check. */
export function createCompositionStudy(composition) {
  if (typeof composition?.id !== 'string' || !composition.id) throw new TypeError('Composition study needs a stable composition id.');
  const right = createArrangement(composition), availableHands = [...right.availableHands];
  const arrangements = { right };
  for (const hand of ['left', 'both']) if (availableHands.includes(hand)) arrangements[hand] = createArrangement(composition, { hand });
  const reference = absoluteNotes(arrangements.both || right, 'notes');
  if (!reference.length || reference.length > 5000) tooLarge();
  const sections = songPhraseSections(reference,{referenceHand:'right',sourceTempo:right.sourceTempo}), stages = [];
  const absolute = Object.fromEntries(Object.entries(arrangements).map(([hand, arrangement]) => [hand, {
    notes: absoluteNotes(arrangement, 'notes'), backing: absoluteNotes(arrangement, 'backing'),
  }]));
  const sourceVersion = composition.arrangementVersion || composition.sourceMidiSha256 || 'midi-v1';
  const sourceFingerprint=songFingerprint([sourceVersion,...Object.entries(absolute).map(([hand,source])=>
    [hand,arrangements[hand].sourceTempo,arrangements[hand].sourceTrackIds,source.notes.map(musicalNoteKey),source.backing.map(musicalNoteKey)])]);
  const selectedIn=(source,section)=>source.notes.filter(note=>note.time>=section.start-EPSILON&&note.time<section.end-EPSILON);
  const handsIn=section=>{
    const rightPresent=selectedIn(absolute.right,section).length>0,leftPresent=absolute.left&&selectedIn(absolute.left,section).length>0;
    return [...(rightPresent?['right']:[]),...(leftPresent?['left']:[]),...(rightPresent&&leftPresent?['both']:[])];
  };
  let eventCount = 0;
  const makeStage = (hand, section, {part=null,whole=false,kind='fragment',fromPart=part,toPart=part,parts=sections.length}={}) => {
    const arrangement = arrangements[hand], source = absolute[hand];
    const selected = whole ? source.notes : selectedIn(source,section);
    if (!selected.length) return null;
    const sourceStart = selected[0].time;
    // Main note durations remain untouched, even if a held note crosses the
    // next section. Only backing tails are clipped to this common interval.
    const notes = selected.map(note => ({ ...note, studySourceTime: note.time, time: Math.max(0, note.time - sourceStart) }));
    const backing = clippedBacking(source.backing, sourceStart, section.end);
    const onlyRight = hand === 'both' && notes.every(note => note.hand === 'right');
    const onlyLeft = hand === 'both' && notes.every(note => note.hand === 'left');
    const instruction = kind==='check'?'Сыграй всю аранжировку без подсветки клавиш, читая нотный стан. Для самостоятельного результата нужно не меньше 80% верных вступлений в темпе. Удержание, пальцы и выразительность здесь не оцениваются.':
      kind==='connection'?`Соедини участки ${fromPart}–${toPart}. Сохрани общий пульс при переходах; дорожка подождёт. Для продолжения нужно 8 из 10.`:
      whole ? 'Соедини все участки и сыграй всю учебную аранжировку целиком с подсказками. Это разучивание; затем будет отдельная самостоятельная проверка.' :
      `${hand === 'right' ? 'Разучи этот участок правой рукой.' : hand === 'left' ? 'Теперь разучи тот же участок левой рукой.' :
        onlyRight ? 'Здесь играет правая рука; левая пока отдыхает.' : onlyLeft ? 'Здесь играет левая рука; правая пока отдыхает.' : 'Соедини знакомый участок обеими руками.'} ` +
      'Дорожка ждёт нужную клавишу. Набери не меньше 8 из 10, чтобы продолжить.';
    return { id: kind==='check'?`${hand}-whole-check`:kind==='connection'?`${hand}-connect-${fromPart}-${toPart}`:whole ? `${hand}-whole` : `${hand}-part-${part}`,
      title: kind==='check'?'Целиком · самостоятельно':kind==='connection'?`Соединяем участки ${fromPart}–${toPart}`:whole ? `Целиком · ${handTitles[hand].toLowerCase()}` :
      `${handTitles[hand]} · участок ${part} из ${parts}`, hand, part, parts,kind,purpose:kind==='check'?'independent':kind==='connection'?'connect':'guided',fromPart,toPart,
      start: section.start, end: section.end, sourceStart, whole, notes, backing,
      sourceTempo: arrangement.sourceTempo, instruction, description: arrangement.description,
      backingDescription: arrangement.backingDescription || '',
      requiresMidi: arrangement.requiresMidi, rangeIssue: arrangement.rangeIssue,
      sourceTrackIds: { ...arrangement.sourceTrackIds },availableHands:handsIn(section),activeHands:[...new Set(notes.map(note=>note.hand))],
      requiredMode:kind==='check'?'flow':'learn',requiredMetric:kind==='check'?'timed-notes-v1':'first-attempt-v1',passPercent:80,
      presentation:kind==='check'?{target:false,names:false,staff:true,falling:false,preview:false}:null };
  };
  const addStage=(...args)=>{
    const stage=makeStage(...args);if(!stage)return;
    eventCount+=stage.notes.length+stage.backing.length;if(eventCount>MAX_PLAN_EVENTS||stages.length>=MAX_STAGES)tooLarge();stages.push(stage);
  };
  sections.forEach((section, index) => {
    for (const hand of handsIn(section))addStage(hand,section,{part:index+1});
    if(index>0&&((index+1)%2===1||index===sections.length-1)){
      const from=Math.max(0,index-2),range={start:sections[from].start,end:section.end},hands=handsIn(range);
      const hand=hands.includes('both')?'both':hands[0];if(hand)addStage(hand,range,{kind:'connection',fromPart:from+1,toPart:index+1});
    }
  });
  const wholeHand = arrangements.both ? 'both' : 'right';
  const whole={start:reference[0].time,end:Math.max(...reference.map(note=>note.time+note.duration))};
  addStage(wholeHand,whole,{kind:'whole',whole:true});addStage(wholeHand,whole,{kind:'check',whole:true});
  const legacyMigration={versions:[],stages:Object.create(null)};
  const baseline=LEGACY_PUBLIC_SOURCES[`${composition.id}:${sourceVersion}`];
  if(baseline?.fingerprint===sourceFingerprint){
    legacyMigration.versions.push(`composition-study-v2:${composition.id}:${sourceVersion}`);
    if(baseline.v1)legacyMigration.versions.push(`composition-study-v1:${sourceVersion}`);
    const candidates=new Map(stages.filter(stage=>stage.kind!=='check').map(stage=>[stageKey(stage),stage.id]));
    const oldSections=legacySections(reference,'right');
    oldSections.forEach((section,index)=>{for(const hand of ['right','left','both'])if(arrangements[hand]){
      const old=makeStage(hand,section,{part:index+1,parts:oldSections.length});if(old){const match=candidates.get(stageKey(old));if(match)legacyMigration.stages[old.id]=match;}
    }});
    const oldWhole=makeStage(wholeHand,whole,{kind:'whole',whole:true});const match=candidates.get(stageKey(oldWhole));if(match)legacyMigration.stages[oldWhole.id]=match;
  }
  const fingerprint=songFingerprint([sourceFingerprint,...stages.map(stage=>[stage.id,stage.kind,stageKey(stage)])]);
  return { id: composition.id, title: composition.title || 'Композиция', sourceVersion,
    version: `${COMPOSITION_STUDY_VERSION}:${composition.id}:${fingerprint}`,sourceFingerprint,legacyMigration,
    stages, availableHands, sections: sections.map(section => ({ ...section })) };
}

function planIds(plan) {
  if (typeof plan?.version !== 'string' || !Array.isArray(plan.stages) || plan.stages.length > MAX_STAGES ||
      plan.stages.some(stage => typeof stage?.id !== 'string' || !stage.id)) throw new TypeError('Invalid composition study plan.');
  const ids = plan.stages.map(stage => stage.id);
  if (new Set(ids).size !== ids.length) throw new TypeError('Composition study stages need distinct ids.');
  return ids;
}

const validTime=at=>Number.isFinite(at)&&at>=0&&at<=253370764800000;
function typedMastery(value){
  return value&&typeof value.stageId==='string'&&value.stageId.length>0&&value.stageId.length<=200&&value.metric==='timed-notes-v1'&&
    Number.isInteger(value.scorePercent)&&value.scorePercent>=80&&value.scorePercent<=100&&validTime(value.at)&&['mic','midi'].includes(value.source)?
    {stageId:value.stageId,metric:value.metric,scorePercent:value.scorePercent,at:value.at,source:value.source}:null;
}
function legacyReceipt(saved){
  if(!saved||typeof saved.version!=='string'||!/^composition-study-v[123]:/.test(saved.version)||saved.version.length>300)return null;
  const mastery=typedMastery(saved.mastery);
  return {version:saved.version,completed:Array.isArray(saved.completed)?[...new Set(saved.completed.filter(id=>typeof id==='string'&&id.length<=200))].slice(0,MAX_STAGES):[],cursor:typeof saved.cursor==='string'&&saved.cursor.length<=200?saved.cursor:null,...(mastery?{mastery}:{})};
}
function validMastery(plan,value){
  const mastery=typedMastery(value),stage=plan.stages.find(stage=>stage.kind==='check'&&stage.id===mastery?.stageId);
  return stage&&(!stage.requiresMidi||mastery.source==='midi')?mastery:null;
}
/** Legacy receipts survive migration; coverage never implies an independent check. */
export function normalizeStudyProgress(plan, saved) {
  const ids = planIds(plan);
  const outerMatches=saved?.version===plan.version;
  // A newer snapshot from another device may have selected a different source
  // version while archiving this exact current plan. Recover that same-version
  // receipt, not evidence from a different song or changed note content.
  const exact=outerMatches?saved:saved?.legacy?.version===plan.version?saved.legacy:null;
  const sameVersion=!!exact,legacy=outerMatches?legacyReceipt(saved?.legacy):legacyReceipt(saved)||legacyReceipt(saved?.legacy);
  const canMigrate=!sameVersion&&plan.legacyMigration?.versions.includes(saved?.version);
  const sourceRow=sameVersion?exact:saved,sourceIds=Array.isArray(sourceRow?.completed)?sourceRow.completed:[];
  const migratedId=id=>typeof id==='string'&&Object.hasOwn(plan.legacyMigration?.stages||{},id)?plan.legacyMigration.stages[id]:null;
  const known=new Set(sameVersion?sourceIds:canMigrate?sourceIds.map(migratedId).filter(Boolean):[]);
  const guided=new Set(plan.stages.filter(stage=>stage.kind!=='check').map(stage=>stage.id));
  const completed=ids.filter(id=>known.has(id)&&guided.has(id));
  const mastery=sameVersion?validMastery(plan,exact.mastery):null;
  const migratedCursor=canMigrate?migratedId(saved.cursor):null;
  const finished=new Set(completed),done=id=>finished.has(id)||mastery?.stageId===id;
  const cursor=sameVersion&&ids.includes(exact.cursor)?exact.cursor:migratedCursor||ids.find(id=>!done(id))||ids.at(-1)||null;
  return {version:plan.version,completed,cursor,mastery,legacy};
}

export function isStudyStageComplete(plan,saved,stageId){const progress=normalizeStudyProgress(plan,saved);return progress.completed.includes(stageId)||progress.mastery?.stageId===stageId;}
export function studySummary(plan,saved){
  const progress=normalizeStudyProgress(plan,saved),guided=plan.stages.filter(stage=>stage.kind!=='check');
  return {guidedCompleted:progress.completed.length,guidedTotal:guided.length,complete:!!progress.mastery,mastery:progress.mastery,
    nextStageId:plan.stages.find(stage=>!progress.completed.includes(stage.id)&&progress.mastery?.stageId!==stage.id)?.id||null};
}

export function recordStudyAttempt(plan, saved, stageId, report, { demo = false, breakdown = false,mode,source,assisted,beta,answerShown,at } = {}) {
  const progress = normalizeStudyProgress(plan, saved), stageIndex = plan.stages.findIndex(stage => stage.id === stageId);
  const stage = plan.stages[stageIndex], total = stage?.notes?.length, correct = report?.firstAttemptCorrect;
  if (!stage || !Number.isInteger(total) || total < 1 || total>5000||report?.finished !== true || report.total !== total ||
      !Number.isInteger(correct) || correct < 0 || correct > total ||demo || breakdown ||
      report.demo!==undefined&&report.demo!==false||report.breakdown!==undefined&&report.breakdown!==false||
      report.earlyAbort!==undefined&&report.earlyAbort!==false||correct * 10 < total * 8) return progress;
  const score = Math.floor(correct * 100 / total) / 10;
  if (report.scoreOutOf10 !== undefined && (!Number.isFinite(report.scoreOutOf10) || Math.abs(report.scoreOutOf10 - score) > EPSILON)) return progress;
  if(report.targetOutcomes!==undefined&&(!Array.isArray(report.targetOutcomes)||report.targetOutcomes.length!==total||
    Array.from(report.targetOutcomes).some(value=>value!==0&&value!==1)||report.targetOutcomes.filter(value=>value===1).length!==correct))return progress;
  if(stage.kind==='check'){
    if(report.metric!=='timed-notes-v1'||mode!=='flow'||report.mode!==undefined&&report.mode!=='flow'||assisted!==false||
      report.assisted!==undefined&&report.assisted!==false||beta!==false||answerShown!==false||
      !['midi','mic'].includes(source)||stage.requiresMidi&&source!=='midi'||!validTime(at)||
      !Number.isInteger(report.correct)||report.correct<correct||report.correct>total||!Number.isInteger(report.skipped)||report.skipped<0||report.correct+report.skipped!==total||
      !Number.isInteger(report.wrong)||report.wrong<0||report.wrong>25_000_000||!Array.isArray(report.targetOutcomes)||report.scorePercent!==Math.floor(correct*100/total))return progress;
    const mastery={stageId,metric:'timed-notes-v1',scorePercent:report.scorePercent,at,source};
    const previous=progress.mastery,keep=previous&&(previous.scorePercent>mastery.scorePercent||previous.scorePercent===mastery.scorePercent&&
      (previous.at>mastery.at||previous.at===mastery.at&&previous.source==='midi'&&source!=='midi'));
    return {...progress,mastery:keep?previous:mastery,cursor:stageId};
  }
  if(report.metric!=='first-attempt-v1')return progress;
  const completed = new Set([...progress.completed, stageId]);
  return {...progress, completed: plan.stages.filter(stage=>stage.kind!=='check').map(stage => stage.id).filter(id => completed.has(id)),
    cursor: plan.stages[stageIndex + 1]?.id || stageId };
}
