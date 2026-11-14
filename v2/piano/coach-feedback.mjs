import {noteInfo} from './pitch.mjs?v=bc0d6f000e4b';
import {createScoreTimeline} from './score.mjs?v=bc0d6f000e4b';
import {chooseProblemSection} from './practice-section.mjs?v=bc0d6f000e4b';
import {recommendSongRepair,songOnsetGroups} from './song-learning.mjs?v=bc0d6f000e4b';
import {summarizeTimingOffsets} from './timing-feedback.mjs?v=bc0d6f000e4b';

const MAX_NOTES=5000,MAX_ERRORS=20000;
const midi=value=>Number.isInteger(value)&&value>=0&&value<=127;
const count=(value,max=MAX_NOTES)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
const spoken=midi=>noteInfo(midi).name.replace('♯','-диез');
const label=(value,limit)=>typeof value==='string'?value.slice(0,limit).replace(/[\u0000-\u001f\u007f]/g,' '):'';
const unavailable=kind=>({valid:false,kind,text:kind==='demo'?'Это был пример звучания. Теперь сыграй самостоятельно.':kind==='unfinished'?'Закончи проход, чтобы разобрать результат.':'Не получилось надёжно разобрать этот проход. Попробуй ещё раз.',question:null,askUnderstanding:false,focus:null,repair:null,llmContext:null});

// This is a local evidence boundary, not an award of course or song mastery.
function canonical(notes,report){
  if(!Array.isArray(notes)||!notes.length||notes.length>MAX_NOTES||Array.from(notes).some(note=>!midi(note?.midi))||
    !report||typeof report!=='object'||Array.isArray(report)||report.finished!==true||report.total!==notes.length||
    !['first-attempt-v1','timed-notes-v1'].includes(report.metric)||report.demo!==undefined&&report.demo!==false||
    ['assisted','earlyAbort','breakdown'].some(key=>report[key]!==undefined&&typeof report[key]!=='boolean')||
    !['correct','firstAttemptCorrect','skipped'].every(key=>count(report[key],notes.length))||!count(report.wrong,MAX_ERRORS)||
    report.firstAttemptCorrect>report.correct||report.correct+report.skipped>notes.length||
    report.earlyAbort&&report.metric!=='timed-notes-v1'||!report.earlyAbort&&report.correct+report.skipped!==notes.length||
    !Array.isArray(report.targetOutcomes)||report.targetOutcomes.length!==notes.length||
    Array.from(report.targetOutcomes).some(value=>value!==0&&value!==1&&!(value===null&&report.earlyAbort))||
    report.targetOutcomes.filter(value=>value===1).length!==report.firstAttemptCorrect||
    !Array.isArray(report.errors)||report.errors.length>MAX_ERRORS)return null;
  const scorePercent=Math.floor(report.firstAttemptCorrect*100/notes.length);
  if(report.scoreOutOf10!==scorePercent/10||report.scorePercent!==undefined&&report.scorePercent!==scorePercent)return null;
  const errors=[];
  for(const value of report.errors){
    const heard=value?.heard===undefined?value?.played:value.heard;
    if(!count(value?.index,notes.length-1)||value.expected!==notes[value.index].midi||
      heard!==null&&!midi(heard)||value.timing!==undefined&&value.timing!=='rest'||
      heard===value.expected&&value.timing!=='rest'||report.targetOutcomes[value.index]!==0)return null;
    errors.push({index:value.index,expected:value.expected,heard,...(value.timing==='rest'?{timing:'rest'}:{})});
  }
  if(errors.filter(error=>error.heard!==null).length!==report.wrong||
    report.metric==='timed-notes-v1'&&errors.filter(error=>error.heard===null).length!==report.skipped)return null;
  if(report.extraAttacks!==undefined&&(!count(report.extraAttacks,MAX_ERRORS)||report.extraAttacks!==errors.filter(error=>error.timing==='rest').length||
    report.extraAttacks>0&&report.strictRests!==true))return null;
  let timing=null;
  if(report.metric==='timed-notes-v1'&&report.hitOffsetsMS!==undefined){
    try{
      timing=summarizeTimingOffsets(report.hitOffsetsMS);
      if(report.hitOffsetsMS.length!==notes.length||timing.matched!==report.correct||
        !report.timing||Object.keys(timing).some(key=>report.timing[key]!==timing[key]))return null;
    }catch{return null;}
  }
  return {errors,scorePercent,timing};
}

function mainPitch(errors){
  const pairs=new Map();
  for(const error of errors){
    if(error.heard===null||error.heard===error.expected||error.timing==='rest')continue;
    const key=`${error.expected}:${error.heard}`,pair=pairs.get(key)||{...error,indices:new Set(),attempts:0};
    pair.indices.add(error.index);pair.attempts++;pairs.set(key,pair);
  }
  const found=[...pairs.values()].sort((a,b)=>b.indices.size-a.indices.size||a.index-b.index)[0];
  return found?{index:found.index,expected:found.expected,heard:found.heard,count:found.indices.size,attempts:found.attempts}:null;
}

function timingKind(timing){
  if(!timing||timing.matched<4)return null;
  const majority=Math.ceil(timing.matched*.6);
  if(timing.early>=majority&&timing.trendMs<=-60)return 'early';
  if(timing.late>=majority&&timing.trendMs>=60)return 'late';
  if(timing.early>=Math.ceil(timing.matched*.2)&&timing.late>=Math.ceil(timing.matched*.2)&&timing.meanAbsMs>=90)return 'uneven';
  return null;
}

function repairFor(notes,stage,report,focus,kind){
  if(!focus||kind==='clean'||kind==='assisted')return null;
  try{
    const preserveTiming=notes.every(note=>Number.isFinite(note.time)&&Number.isFinite(note.duration));
    const timeline=createScoreTimeline(notes,{tempo:60,sourceTempo:60,preserveTiming});
    const timedNotes=notes.map((note,index)=>({...note,time:timeline[index].time,duration:timeline[index].duration}));
    const selected={...stage,notes:timedNotes};
    if(['early','late','uneven'].includes(kind)){
      // A measured timing focus is not a fictional wrong pitch or failed grade.
      const chosen=chooseProblemSection(timedNotes,{errors:[{index:focus.index}]},{size:6});
      if(chosen.end-chosen.start>64)return null;
      return {...chosen,focusStart:focus.index,focusEnd:focus.index+1,noteCount:chosen.end-chosen.start,reason:'timing',assessment:'practice-only'};
    }
    // Pick the spoken problem, not an unrelated denser cluster of other errors.
    const {targetOutcomes:_outcomes,...evidence}=report;
    evidence.errors=report.errors.filter(error=>error.index===focus.index);
    // Guided skip() has an outcome but no error entry. Its observed failed
    // target can still select a section; no replacement grade is constructed.
    if(!evidence.errors.length)evidence.errors=[{index:focus.index}];
    const repair=recommendSongRepair(selected,evidence);
    return repair?{...repair,reason:kind==='wrong-pitch'?'pitch':kind==='extra'?'timing':'notes'}:null;
  }catch{return null;}
}

/** One concise, factual teaching turn. It never changes a report or progress. */
export function createCoachFeedback({lesson={},notes=lesson?.notes,report,mode,source='mic',stage=null,assisted=false,answerShown=false,beta=false,breakdown=false}={}){
  if(!lesson||typeof lesson!=='object'||Array.isArray(lesson))lesson={};
  if(report?.demo)return unavailable('demo');
  if(report?.finished===false)return unavailable('unfinished');
  const evidence=canonical(notes,report);
  if(!evidence||![assisted,answerShown,beta,breakdown].every(value=>typeof value==='boolean'))return unavailable('unavailable');
  const explainedFailed=new Set(evidence.errors.map(error=>error.index));
  // Some chord/timed sessions record a hint in outcomes without an assisted
  // flag. Unexplained failed first attempts cannot become an independent turn.
  const inferredHelp=report.targetOutcomes.filter(value=>value===0).length>explainedFailed.size+report.skipped;
  const measuredMidi=source==='midi',helped=assisted||answerShown||report.assisted===true||report.answerShown===true||inferredHelp,repairPractice=breakdown||report.breakdown===true;
  const betaPractice=beta||!measuredMidi&&(stage?.requiresMidi===true||lesson.requiresMidiForAssessment===true||lesson.polyphonic===true);
  const measuredTiming=measuredMidi&&!betaPractice;
  const actualMode=['learn','check','flow'].includes(mode)?mode:report.metric==='timed-notes-v1'?'flow':'learn';
  const pitch=mainPitch(evidence.errors);
  let kind='clean',focus=null,text;
  if(pitch){
    kind='wrong-pitch';focus=pitch;
    const expected=spoken(pitch.expected),heard=spoken(pitch.heard);
    text=expected===heard?`${measuredMidi?'Прозвучала':'Распознана'} ${heard} в другой октаве, нужна ${noteInfo(pitch.expected).latin}. Повтори это место медленнее.`:
      `${measuredMidi?'Прозвучала':'Распознана'} ${heard} вместо ${expected}. Повтори это место медленнее.`;
  }else if(evidence.errors.some(error=>error.timing==='rest')){
    kind='extra';const error=evidence.errors.find(error=>error.timing==='rest');focus={index:error.index,expected:error.expected,heard:error.heard,count:report.extraAttacks||evidence.errors.filter(error=>error.timing==='rest').length};
    text='Между нотами появились лишние нажатия. Дождись следующей ноты и повтори этот участок.';
  }else if(report.correct===0&&report.wrong===0&&report.skipped>0){
    kind='no-input';text=measuredMidi?'Нажатия не получены. Проверь подключение синтезатора и повтори.':'Ноты не распознаны. Проверь звук и микрофон перед повтором.';
  }else if(report.skipped>0){
    kind='missed';
    const missed=evidence.errors.find(error=>error.heard===null);
    const index=missed?.index??(!helped&&report.firstAttemptCorrect===report.correct?report.targetOutcomes.findIndex(value=>value===0):-1);
    if(index>=0)focus={index,expected:notes[index].midi,heard:null,count:report.skipped};
    text=focus?`В этом месте не засчитана ${spoken(focus.expected)}. Повтори короткий участок медленнее.`:
      'Часть нот осталась без верного нажатия. Повтори короткий участок медленнее.';
  }else{
    const measured=measuredTiming?timingKind(evidence.timing):null;
    if(measured){
      kind=measured;let index=0;
      const values=report.hitOffsetsMS;
      for(let i=0;i<values.length;i++)if(values[i]!==null&&(values[index]===null||
        (kind==='early'?-values[i]:kind==='late'?values[i]:Math.abs(values[i]))>(kind==='early'?-values[index]:kind==='late'?values[index]:Math.abs(values[index]))))index=i;
      focus={index,expected:notes[index].midi,heard:notes[index].midi,count:kind==='early'?evidence.timing.early:kind==='late'?evidence.timing.late:evidence.timing.early+evidence.timing.late,offsetMs:values[index]};
      text=kind==='early'?'Ноты часто звучали раньше нужного момента. Повтори под общий счёт, не торопясь.':kind==='late'?'Ноты часто запаздывали. Готовь следующую клавишу заранее под общий счёт.':'Момент нажатия чередовался: то раньше, то позже. Повтори медленнее под ровный счёт.';
    }else if(helped||report.firstAttemptCorrect<report.correct){
      kind='assisted';text='Ноты найдены, но проход был с помощью. Повтори его самостоятельно.';
    }else if(betaPractice){text='Распознанные ноты совпали в тренировочном режиме. Для самостоятельной проверки двух партий нужен MIDI.';}
    else if(report.earlyAbort){text='Проход остановился раньше конца. Разбери короткий участок и вернись к целому.';}
    else if(actualMode==='learn'){text='Ноты найдены верно. Можно перейти к следующему шагу.';}
    else{text=measuredTiming&&evidence.timing?.matched>=4&&evidence.timing.onTime===evidence.timing.matched?'Ноты и момент нажатия получились ровно. Продолжай к следующему заданию.':'Распознанные ноты совпали с заданием. Продолжай к следующему заданию.';}
  }
  let polyphony=false;
  try{const timed=createScoreTimeline(notes,{preserveTiming:notes.every(note=>Number.isFinite(note.time)&&Number.isFinite(note.duration))});polyphony=songOnsetGroups(timed).some(group=>group.end-group.start>1);}catch{}
  const complex=notes.length>8||polyphony||!repairPractice&&(stage?.requiresMidi===true||['connection','whole','check'].includes(stage?.kind)||lesson.type==='phrase'&&notes.length>=6)||
    ['reading','coordination','recall','echo'].includes(lesson.practiceKind)||Array.isArray(lesson.skillIds)&&lesson.skillIds.some(id=>['treble-reading','bass-reading','memory-short','two-hands','coordination'].includes(id));
  const repair=repairFor(notes,stage,report,focus,kind);
  const assessment=repairPractice?'repair':betaPractice?'practice-beta':helped?'practice-assisted':stage?.kind==='check'||actualMode==='check'?'independent-check':'guided-practice';
  const excerpt=repair?notes.slice(repair.start,Math.min(repair.end,repair.start+8)).map((note,index)=>({index:repair.start+index,midi:note.midi,name:noteInfo(note.midi).latin})):[];
  const llmContext={version:1,lesson:{id:label(lesson.id,80),title:label(lesson.title,120)},assessment,mode:actualMode,source:measuredMidi?'midi':source==='mic'?'mic':'other',
    result:{metric:report.metric,total:report.total,firstAttemptCorrect:report.firstAttemptCorrect,scorePercent:evidence.scorePercent,wrongAttempts:report.wrong,missed:report.skipped,earlyAbort:report.earlyAbort===true},
    assisted:helped,beta:betaPractice,masteryClaim:false,primary:{kind,...focus},repair:repair?{start:repair.start,end:repair.end,assessment:'practice-only',excerpt,excerptIsPartial:excerpt.length<repair.noteCount}:null,
    timing:measuredTiming&&evidence.timing?{...evidence.timing}:null,
    unmeasured:['fingering','hand-technique','duration','legato','pedal','velocity',...(!measuredTiming?['precise-attack-timing']:[])]};
  const askUnderstanding=complex&&kind!=='no-input';
  const creditNotice=helped&&!betaPractice&&!repairPractice&&stage?.purpose==='independent'&&['check','flow'].includes(actualMode)&&
    !report.earlyAbort&&kind!=='no-input'?'Была подсказка — для зачёта повтори проход без неё.':null;
  if(creditNotice){
    const factual=kind==='assisted'?'Ноты найдены.':text.match(/^[^.!?]+[.!?]?/u)?.[0]?.trim()||text;
    text=`${factual} ${creditNotice}`;
  }
  return {valid:true,kind,text,creditNotice,question:askUnderstanding?'Всё понятно?':null,askUnderstanding,focus,repair,llmContext};
}
