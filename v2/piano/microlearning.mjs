import {COURSE} from './course.mjs?v=b9fc53831534';
import {createScoreTimeline} from './score.mjs?v=b9fc53831534';
import {songOnsetGroups,songFingerprint} from './song-learning.mjs?v=b9fc53831534';
import {MICROLESSONS,MICRO_CUES,MICRO_HAND_BLOCKS} from './microlearning-data.mjs?v=b9fc53831534';
import {LESSON_GUIDES,FOUNDATION_TRANSITIONS} from './lesson-guides.mjs?v=b9fc53831534';
import {createMixedPracticeStages} from './mixed-practice.mjs?v=b9fc53831534';
import {supportLevel} from './support-policy.mjs?v=b9fc53831534';

const MAX_NOTES=5000,MAX_STAGES=48;
const canonical=new Map(COURSE.map(lesson=>[lesson.id,lesson]));
const clone=value=>structuredClone(value);
const supportedKind=new Set(['new','reading','recall','rhythm']);
const presentation=(target,names,staff,falling,preview,fingers)=>({target,names,staff,falling,preview,fingers});
const GUIDED=presentation(true,true,true,true,true,true);
const STAFF=presentation(false,false,true,false,false,false);
const HIDDEN=presentation(false,false,false,false,false,false);
const stable=value=>value&&typeof value==='object'?Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const familyFor=(lesson,kind)=>kind==='recall'?'memory':kind==='reading'?'reading':kind==='rhythm'?'rhythm':lesson.id==='course-memory'||['echo','recall'].includes(lesson.practiceKind)?'memory':lesson.practiceKind==='reading'?'reading':lesson.practiceKind==='rhythm'?'rhythm':'notes';
const handFor=lesson=>['Левая рука','left'].includes(lesson.hand)?'left':'right';
const sameHand=(a,b)=>a===b||['Левая рука','left'].includes(a)&&['Левая рука','left'].includes(b)||['Правая рука','right'].includes(a)&&['Правая рука','right'].includes(b);
const pitches=notes=>[...new Set(notes.map(note=>note.midi))];

function validate(lesson,kind){
  if(!lesson||typeof lesson.id!=='string'||!/^[-A-Za-z0-9._:]{1,160}$/.test(lesson.id)||!supportedKind.has(kind)||
    !Array.isArray(lesson.notes)||!lesson.notes.length||lesson.notes.length>MAX_NOTES||Array.from(lesson.notes).some(note=>!note||!Number.isInteger(note.midi)||note.midi<0||note.midi>127))throw new TypeError('A micro lesson needs bounded actual notes and a known task kind.');
  const preserveTiming=lesson.notes.some(note=>note.time!==undefined||note.duration!==undefined);
  const timeline=createScoreTimeline(lesson.notes,{tempo:60,sourceTempo:60,preserveTiming});
  return songOnsetGroups(timeline);
}
function clip(notes,groups,start,end){
  const first=groups.find(group=>group.end>start),last=groups.find(group=>group.end>=Math.min(notes.length,end));
  if(!first||!last)throw new RangeError('A micro scene range must exist in the source.');
  return {notes:clone(notes.slice(first.start,last.end)),sourceRange:{start:first.start,end:last.end}};
}
function original(lesson,values,{beats=[],rests=[]}={}){
  const hand=handFor(lesson),known=pitches(lesson.notes);
  if(!values?.length||values.some(midi=>!known.includes(midi)))return null;
  return values.map((midi,index)=>({midi,beats:beats[index]??1,hand,
    ...(rests[index]>0?{restBefore:rests[index]}:{}),
    ...([60,62,64,65,67].includes(midi)?{finger:hand==='left'?5-[60,62,64,65,67].indexOf(midi):[60,62,64,65,67].indexOf(midi)+1}:{})}));
}
function whole(lesson,family){
  return {id:'whole',title:'Самостоятельно',instruction:family==='memory'?'Вспомни весь рисунок без показа.':family==='rhythm'?'Сыграй весь ритм; продолжай, даже если ошибся.':'Сыграй весь рисунок без подсветки клавиш.',
    notes:clone(lesson.notes),mode:family==='rhythm'?'flow':'check',presentation:clone(family==='memory'?HIDDEN:STAFF),purpose:'whole',assessment:true,supportLevel:3,transitionIndices:[],
    sourceRange:{start:0,end:lesson.notes.length},goal:{type:family,pitches:pitches(lesson.notes)}};
}

function recallSample(lesson){
  if(!lesson.notes.some(note=>note.group!==undefined))return lesson.notes.slice(0,6);
  const ids=[...new Set(lesson.notes.map(note=>note.group))].slice(0,3);
  return lesson.notes.filter(note=>ids.includes(note.group));
}
function groupMaterial(lesson,groups,start,count){
  const end=Math.min(groups.length,start+count);
  return clip(lesson.notes,groups,groups[start].start,groups[end-1].end);
}
// Reading preparation uses new short orders of familiar pitches. It never
// rehearses an excerpt of the unseen canonical answer or assigns new fingers.
function readingMaterials(lesson,groups){
  if(groups.some(group=>group.end-group.start!==1)||lesson.hand==='Руки по очереди')return [];
  const known=pitches(lesson.notes).sort((a,b)=>a-b),source=lesson.notes.map(note=>note.midi);
  if(known.length<2)return [];
  const low=known[0],high=known.at(-1),middle=known[Math.floor(known.length/2)];
  const candidates=[[high,low,middle,high],[middle,high,low,middle],[low,high,middle,low]];
  const orders=candidates.filter(values=>!same(values,source)&&!source.some((_,index)=>same(source.slice(index,index+values.length),values)));
  return orders.slice(0,2).map(values=>({notes:values.map(midi=>{
    const match=lesson.notes.find(note=>note.midi===midi);
    return {midi,beats:1,...(match.hand?{hand:match.hand}:{})};
  })}));
}
function readingScenes(lesson,groups,add,guide){
  const variants=guide&&lesson.practiceKind==='reading'?[sourceExample(lesson,groups,guide.example.order),sourceExample(lesson,groups,guide.example.order)]:readingMaterials(lesson,groups);
  if(variants.length<2)return false;
  add('warmup','orient','Знакомые ориентиры',guide?.preparation||'Сравни ноты и клавиши на другом коротком рисунке.',variants[0],
    {spoken:guide?.concept,presentation:{...GUIDED,preview:false},supportLevel:0,goal:{type:'reading',focus:'landmark',pitches:pitches(variants[0].notes)}});
  add('motif','phrase','Новый короткий рисунок',guide?.example.instruction||'Прочитай другой порядок знакомых нот.',variants[1],
    {mode:'check',presentation:{...GUIDED,preview:false},supportLevel:0,goal:{type:'reading',pitches:pitches(variants[1].notes)}});
  if(guide)add('focused-repair','phrase','Проверяем нотный ориентир',guide.repair.instruction,clone(variants[1]),
    {commonMistake:guide.commonMistake,mode:'check',presentation:{...GUIDED,preview:false},supportLevel:0,goal:{type:'reading',pitches:pitches(variants[1].notes)}});
  return true;
}
function sourceExample(lesson,groups,order){
  const actual=order.filter(index=>index<groups.length),notes=[],sourceNoteIndices=[];
  for(const [onset,index] of actual.entries()){
    const range=groups[index];
    for(let at=range.start;at<range.end;at++){
      const note=clone(lesson.notes[at]);
      if(note.group!==undefined)note.group=onset;
      if(MICRO_HAND_BLOCKS[lesson.id])note.hand=Math.floor(at/MICRO_HAND_BLOCKS[lesson.id])%2?'left':'right';
      notes.push(note);sourceNoteIndices.push(at);
    }
  }
  return {notes,sourceAttackIndices:actual,sourceNoteIndices};
}
function authoredScenes(lesson,groups,family,add,guide){
  if(family==='reading'){
    return readingScenes(lesson,groups,add,guide);
  }
  const memory=family==='memory',rhythm=family==='rhythm',mode=rhythm?'flow':'learn';
  const rangeMaterial=range=>range[0]<lesson.notes.length?clip(lesson.notes,groups,range[0],Math.min(range[1],lesson.notes.length)):null;
  const warmup=rangeMaterial(guide.warmup)||groupMaterial(lesson,groups,0,Math.min(2,groups.length));
  add('warmup','orient','Готовим трудное место',guide.preparation,warmup,
    {spoken:guide.concept,presentation:memory?{...HIDDEN,preview:true}:GUIDED,
      goal:{type:warmup.notes.some(note=>note.restBefore>0)?'rest':rhythm?'pulse':family,pitches:pitches(warmup.notes),objective:guide.objective}});
  const chunks=guide.phrases.filter(range=>range.start<lesson.notes.length);
  for(const [index,phrase] of chunks.entries()){
    const material=rangeMaterial([phrase.start,phrase.end]);
    add(chunks.length===1?'motif':`motif-${index+1}`,'phrase',`Часть ${index+1} из ${chunks.length}`,phrase.instruction,material,
      {authoredPhrase:true,mode,presentation:memory?{...HIDDEN,preview:true}:GUIDED,goal:{type:family,pitches:pitches(material.notes)}});
  }
  const comparison=sourceExample(lesson,groups,guide.example.order);
  add('contrast','contrast','Сравни другой рисунок',guide.example.instruction,comparison,
    {mode,presentation:memory?{...HIDDEN,preview:true}:GUIDED,sourceAttackIndices:comparison.sourceAttackIndices,goal:{type:'contrast',pitches:pitches(comparison.notes)}});
  const repairMaterial=rangeMaterial([guide.repair.start,guide.repair.end]);
  if(repairMaterial)add('focused-repair','phrase','Закрепляем трудный переход',guide.repair.instruction,repairMaterial,
    {mode,presentation:memory?{...HIDDEN,preview:true}:GUIDED,commonMistake:guide.commonMistake,goal:{type:family,pitches:pitches(repairMaterial.notes)}});
  if(memory)add('fade','fade','Повторяем без показа','Повтори знакомую часть без нового прослушивания.',warmup,
    {mode,presentation:HIDDEN,goal:{type:family,pitches:pitches(warmup.notes)}});
  add('whole-guided','phrase','Соединяем весь рисунок',memory?'После показа повтори весь рисунок.':rhythm?'Соедини весь ритм, сохраняя паузы и счёт.':'Соедини знакомые части в полный рисунок.',
    {notes:clone(lesson.notes),sourceRange:{start:0,end:lesson.notes.length}},
    {coverage:true,mode:memory?'check':mode,presentation:memory?{...HIDDEN,preview:true}:GUIDED,goal:{type:family,pitches:pitches(lesson.notes)}});
  return true;
}

/** Teaching scenes are provisional; only the final canonical whole is assessment. */
export function createMicroLesson(lesson,{kind='new',knownLessonIds=[]}={}){
  const groups=validate(lesson,kind),family=familyFor(lesson,kind),known=canonical.get(lesson.id),data=MICROLESSONS[lesson.id],guide=LESSON_GUIDES[lesson.id];
  const transitions=guide?.transitionIndices||FOUNDATION_TRANSITIONS[lesson.id]||[];
  const exact=known&&(lesson.practiceKind===undefined||lesson.practiceKind===known.practiceKind)&&
    (lesson.hand===undefined||sameHand(lesson.hand,known.hand))&&
    (same(lesson.notes,known.notes)||kind==='recall'&&same(lesson.notes,recallSample(known)));
  const detailed=!!(data&&exact&&(family!=='reading'||known.practiceKind==='reading')),stages=[];
  let authored=!!exact;
  const add=(id,purpose,title,instruction,material,options={})=>{
    if(!material?.notes?.length)return;
    if(stages.some(stage=>stage.id===id))throw new Error('Duplicate micro scene.');
    const {presentation:cue,...extra}=options;
    stages.push({id,title,instruction,notes:material.notes,mode:options.mode||'learn',presentation:clone(cue||GUIDED),purpose,assessment:false,
      ...(material.sourceRange?{sourceRange:material.sourceRange}:{}),...(material.sourceNoteIndices?{sourceNoteIndices:clone(material.sourceNoteIndices)}:{}),...extra});
  };
  if(detailed){
    if(family==='reading'){
      const guide=original(lesson,data.guide||[60,62,64,65]);
      add('staff-guide','orient','Ориентиры стана','Сравни линию, промежуток и клавишу.',{notes:guide},{spoken:data.cue,presentation:{...GUIDED,preview:false},goal:{type:'reading',pitches:pitches(guide||[])}});
    }else if(family==='memory'){
      add('listen-part','orient','Сначала послушай','Послушай часть и повтори без дорожки.',clip(lesson.notes,groups,0,Math.min(3,lesson.notes.length)),
        {presentation:{...HIDDEN,preview:true},spoken:data.cue,goal:{type:'memory',pitches:pitches(lesson.notes.slice(0,3))}});
    }else{
      for(const midi of data.targets||[]){
        const index=lesson.notes.findIndex(note=>note.midi===midi);if(index<0)continue;
        const cue=MICRO_CUES[midi],left=handFor(lesson)==='left',position=[60,62,64,65,67].indexOf(midi),finger=left?5-position:position+1;
        const instruction=lesson.id==='course-first-key'?'До — белая слева от двух чёрных, ближе к середине.':cue?`${cue.name} — ${cue.keyboard}; ${finger}-й палец${left?' левой':''}.`:'Найди одну нужную клавишу.';
        const spoken=lesson.id==='course-first-key'?'Найди пару чёрных ближе к середине Casio. До — белая слева от пары.':cue?`${cue.name} — ${cue.keyboard}. Сыграй ${finger}-м пальцем ${left?'левой':'правой'} руки.`:data.cue;
        add(`orient-${midi}`,'orient',`Находим ${cue?.name||'клавишу'}`,instruction,clip(lesson.notes,groups,index,index+1),
          {spoken,goal:{type:'pitch',pitches:[midi]}});
      }
      if(!data.targets?.length){
        const range=data.motif||[0,3];
        add('prepare','orient',family==='rhythm'?'Считаем спокойно':'Готовим рисунок',family==='rhythm'?'Сначала найди ноты без спешки.':'Посмотри направление короткой фразы.',clip(lesson.notes,groups,...range),
          {spoken:data.cue,goal:{type:data.family==='rest'?'rest':family==='rhythm'?'pulse':'direction',pitches:pitches(lesson.notes)}});
      }
    }
    const contrast=original(lesson,data.contrast,{beats:data.contrastBeats,rests:data.contrastRests});
    if(contrast)add('contrast','contrast',family==='rhythm'?'Один маленький ритм':'Сравни и сыграй',data.contrastText||'Сравни знакомые ноты в другом порядке.',{notes:contrast},
      {mode:family==='reading'?'check':family==='rhythm'?'flow':'learn',presentation:family==='reading'?STAFF:family==='memory'?{...HIDDEN,preview:true}:GUIDED,
        goal:{type:data.contrastGoal||'contrast',pitches:pitches(contrast)}});
    if(family!=='reading'&&data.family!=='landmark'){
      const range=data.motif||[0,Math.min(4,lesson.notes.length)];
      add('motif','phrase','Маленькая фраза',family==='memory'?'Повтори короткую часть по памяти.':'Сыграй знакомую часть без спешки.',clip(lesson.notes,groups,...range),
        {presentation:family==='memory'?{...HIDDEN,preview:true}:GUIDED,goal:{type:family,pitches:pitches(lesson.notes.slice(...range))}});
      add('fade','fade','Меньше подсказок',family==='memory'?'Повтори часть без нового показа.':family==='rhythm'?'Сохрани счёт без показа следующей клавиши.':'Теперь ориентируйся по нотам без названий.',clip(lesson.notes,groups,...range),
        {mode:family==='rhythm'?'flow':'learn',presentation:family==='memory'||family==='rhythm'?HIDDEN:STAFF,goal:{type:family,pitches:pitches(lesson.notes.slice(...range))}});
    }
    const transfer=original(lesson,data.transfer,{beats:data.transferBeats,rests:data.transferRests});
    if(transfer)add('transfer','transfer','Другой короткий рисунок',family==='memory'?'Послушай другой рисунок и повтори.':family==='rhythm'?'Те же клавиши, другой ритм.':'Прочитай новый порядок знакомых нот.',{notes:transfer},
      {mode:family==='rhythm'?'flow':family==='memory'?'learn':'check',presentation:family==='memory'?{...HIDDEN,preview:true}:family==='rhythm'?HIDDEN:STAFF,
        goal:{type:family,pitches:pitches(transfer)}});
    if(family!=='reading')add('whole-guided','phrase','Соединяем весь рисунок',family==='memory'?'После показа повтори весь рисунок.':family==='rhythm'?'Весь ритм вместе с подсказками.':'Соедини части в полный рисунок.',
      {notes:clone(lesson.notes),sourceRange:{start:0,end:lesson.notes.length}},
      {coverage:true,mode:family==='memory'?'check':family==='rhythm'?'flow':'learn',presentation:family==='memory'?{...HIDDEN,preview:true}:family==='rhythm'?GUIDED:STAFF,
        goal:{type:family,pitches:pitches(lesson.notes)}});
  }else if(authored){
    authored=guide?authoredScenes(lesson,groups,family,add,guide):readingScenes(lesson,groups,add);
  }
  if(authored){
    if(family!=='memory'){
      const previous=stages.find(stage=>stage.purpose==='fade')||stages.find(stage=>stage.id==='focused-repair')||
        stages.findLast(stage=>!stage.coverage&&stage.purpose==='phrase')||stages.find(stage=>!stage.coverage);
      for(let at=stages.length-1;at>=0;at--)if(stages[at].purpose==='fade')stages.splice(at,1);
      const at=stages.findIndex(stage=>stage.coverage),tail=at<0?[]:stages.splice(at);
      const material={notes:clone(previous.notes),...(previous.sourceRange?{sourceRange:clone(previous.sourceRange)}:{}),...(previous.sourceNoteIndices?{sourceNoteIndices:clone(previous.sourceNoteIndices)}:{})};
      for(const [id,level,title,instruction] of [
        ['fade-keyboard',1,'Без подсветки клавиши','Тот же рисунок: названия и пальцы ещё помогают.'],
        ['fade-names',2,'Читаем без названий','Названия скрыты; пальцы подскажем только на переходах.'],
        ['fade-fingers',3,'Только нотный стан','Повтори тот же рисунок без названий и номеров пальцев.'],
      ])add(id,'fade',title,instruction,clone(material),{mode:family==='rhythm'?'flow':family==='reading'?'check':'learn',supportLevel:level,
        presentation:presentation(false,level===1,true,false,false,level<3),goal:clone(previous.goal)});
      stages.push(...tail);
    }
    for(const stage of stages){
      stage.supportLevel??=family==='memory'?3:supportLevel(stage);
      stage.transitionIndices=stage.sourceRange?transitions.filter(index=>index>=stage.sourceRange.start&&index<stage.sourceRange.end).map(index=>index-stage.sourceRange.start):
        stage.sourceNoteIndices?stage.sourceNoteIndices.flatMap((index,local)=>transitions.includes(index)?[local]:[]):[];
      if(family==='memory')stage.presentation={...HIDDEN,preview:stage.presentation.preview};
      else if(stage.supportLevel===0)stage.presentation={...GUIDED,preview:stage.presentation.preview};
      if(family==='reading')stage.presentation.preview=false;
    }
    const mixed=createMixedPracticeStages({...lesson,practiceKind:family==='memory'?'recall':family==='reading'?'reading':family==='rhythm'?'rhythm':lesson.practiceKind},
      {knownLessonIds,transitionIndices:transitions});
    if(family==='memory')for(const stage of mixed.filter(stage=>stage.goal.type==='memory')){
      stage.supportLevel=3;stage.presentation={...HIDDEN,preview:stage.id!=='mixed-return'};
    }
    const insert=stages.findIndex(stage=>stage.coverage);
    stages.splice(insert<0?stages.length:insert,0,...mixed);
  }
  stages.push({...whole(lesson,family),transitionIndices:authored?transitions.filter(index=>index<lesson.notes.length):[]});
  if(stages.length>MAX_STAGES)throw new RangeError('A micro lesson has too many scenes.');
  const version='microlearning-v1:'+songFingerprint([JSON.stringify(stable({id:lesson.id,kind,family,notes:lesson.notes,...(guide&&authored?{guide}:{}),stages}))]);
  return {id:lesson.id,version,authored,coverage:authored?'detailed':'legacy',...(guide&&authored?{guide:clone(guide)}:{}),stages};
}

/** Recommend one preparatory scene; this never changes an outcome or progress. */
export function chooseMicroRepair(plan,stageId,report){
  if(!Array.isArray(plan?.stages)||plan.stages.length>MAX_STAGES||report?.finished!==true||report.demo)return null;
  const index=plan.stages.findIndex(stage=>stage.id===stageId),stage=plan.stages[index],notes=stage?.notes;
  const count=(value,max)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
  if(index<=0||!Array.isArray(notes)||!notes.length||notes.length>MAX_NOTES||report.total!==notes.length||report.metric!==(stage.mode==='flow'?'timed-notes-v1':'first-attempt-v1')||
    !['firstAttemptCorrect','correct','skipped'].every(key=>count(report[key],notes.length))||!count(report.wrong,20000)||
    report.firstAttemptCorrect>report.correct||report.correct+report.skipped>notes.length||!report.earlyAbort&&report.correct+report.skipped!==notes.length||
    report.earlyAbort!==undefined&&typeof report.earlyAbort!=='boolean'||report.earlyAbort&&report.metric!=='timed-notes-v1'||
    report.correct===0&&report.wrong===0&&report.skipped>0||
    !Array.isArray(report.targetOutcomes)||report.targetOutcomes.length!==notes.length||
    Array.from(report.targetOutcomes).some(value=>value!==0&&value!==1&&!(value===null&&report.earlyAbort))||
    report.targetOutcomes.filter(value=>value===1).length!==report.firstAttemptCorrect||
    !Array.isArray(report.errors)||report.errors.length>20000)return null;
  const percent=Math.floor(report.firstAttemptCorrect*100/notes.length);
  if(report.scoreOutOf10!==undefined&&report.scoreOutOf10!==percent/10||report.scorePercent!==undefined&&report.scorePercent!==percent)return null;
  const errors=[];
  for(const error of report.errors){
    const heard=error?.heard===undefined?error?.played:error.heard;
    if(!count(error?.index,notes.length-1)||error.expected!==notes[error.index].midi||
      heard!==null&&!count(heard,127)||heard===error.expected&&error.timing!=='rest'||report.targetOutcomes[error.index]!==0)return null;
    errors.push({...error,heard});
  }
  if(errors.filter(error=>error.heard!==null).length!==report.wrong)return null;
  errors.sort((a,b)=>a.index-b.index);
  let failed=errors[0]?.index;
  if(failed===undefined&&report.skipped>0&&report.assisted!==true&&Array.isArray(report.targetOutcomes))failed=report.targetOutcomes.findIndex(value=>value===0);
  if(failed===undefined||failed<0)return null;
  const expected=notes[failed].midi,heard=errors[0]?.heard??errors[0]?.played;
  const before=plan.stages.slice(0,index).map((item,at)=>({...item,index:at})).filter(item=>!item.assessment&&!item.coverage&&['orient','contrast','phrase'].includes(item.purpose));
  const rest=notes[failed].restBefore>0||errors[0]?.timing==='rest';
  const specific=before.find(item=>item.goal?.type===(rest?'rest':'pulse')&&stage.goal?.type==='rhythm');
  const pair=before.find(item=>item.purpose==='contrast'&&item.goal?.pitches?.includes(expected)&&item.goal.pitches.includes(heard));
  const pitch=before.find(item=>item.purpose==='orient'&&item.goal?.pitches?.includes(expected));
  const sourceIndex=stage.sourceRange?stage.sourceRange.start+failed:null;
  const local=sourceIndex===null?null:before.find(item=>item.purpose==='phrase'&&item.sourceRange&&item.sourceRange.start<=sourceIndex&&item.sourceRange.end>sourceIndex);
  const focused=sourceIndex===null?null:before.find(item=>item.id==='focused-repair'&&(item.sourceRange?
    item.sourceRange.start<=sourceIndex&&item.sourceRange.end>sourceIndex:stage.goal?.type==='reading'));
  const selected=focused||specific||pair||(plan.guide?local:null)||pitch||local||before.find(item=>item.goal?.type===stage.goal?.type)||before.at(-1);
  return selected?{index:selected.index,id:selected.id}:null;
}
