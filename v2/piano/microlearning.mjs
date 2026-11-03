import {COURSE} from './course.mjs?v=157775a3eea1';
import {createScoreTimeline} from './score.mjs?v=157775a3eea1';
import {songOnsetGroups,songFingerprint} from './song-learning.mjs?v=157775a3eea1';
import {MICROLESSONS,MICRO_CUES,MICRO_MODULE_CUES,MICRO_HAND_BLOCKS} from './microlearning-data.mjs?v=157775a3eea1';

const MAX_NOTES=5000,MAX_STAGES=16;
const canonical=new Map(COURSE.map(lesson=>[lesson.id,lesson]));
const clone=value=>structuredClone(value);
const supportedKind=new Set(['new','reading','recall','rhythm']);
const presentation=(target,names,staff,falling,preview,fingers)=>({target,names,staff,falling,preview,fingers});
const GUIDED=presentation(true,true,true,true,true,true);
const STAFF=presentation(false,false,true,false,false,false);
const HIDDEN=presentation(false,false,false,false,false,false);
const stable=value=>value&&typeof value==='object'?Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const same=(a,b)=>JSON.stringify(stable(a))===JSON.stringify(stable(b));
const familyFor=(lesson,kind)=>kind==='recall'?'memory':kind==='reading'?'reading':kind==='rhythm'?'rhythm':['echo','recall'].includes(lesson.practiceKind)?'memory':lesson.practiceKind==='reading'?'reading':lesson.practiceKind==='rhythm'?'rhythm':'notes';
const handFor=lesson=>['Левая рука','left'].includes(lesson.hand)?'left':'right';
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
    notes:clone(lesson.notes),mode:family==='rhythm'?'flow':'check',presentation:clone(family==='memory'||family==='rhythm'?HIDDEN:STAFF),purpose:'whole',assessment:true,
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
function focusGroup(lesson,groups,cue){
  const has=(group,predicate)=>lesson.notes.slice(group.start,group.end).some(predicate);
  let index=groups.findIndex(group=>has(group,note=>note.restBefore>0));
  if(index<0&&MICRO_HAND_BLOCKS[lesson.id])index=groups.findIndex(group=>group.start>=MICRO_HAND_BLOCKS[lesson.id]);
  if(index<0&&cue.focus==='accidental')index=groups.findIndex(group=>has(group,note=>[1,3,6,8,10].includes(note.midi%12)));
  if(index<0&&cue.focus==='register')index=groups.findIndex(group=>has(group,note=>Math.abs(note.midi-lesson.notes[0].midi)>=5));
  if(index<0)index=groups.findIndex(group=>has(group,note=>note.beats!==undefined&&note.beats!==1));
  return Math.max(0,index-1);
}
function handInstruction(lesson,material){
  const size=MICRO_HAND_BLOCKS[lesson.id];if(!size)return null;
  const runs=[];
  for(let index=material.sourceRange.start;index<material.sourceRange.end;index++){
    const hand=Math.floor(index/size)%2?'левой':'правой';
    if(runs.at(-1)?.hand===hand)runs.at(-1).count++;else runs.push({hand,count:1});
  }
  return runs.map(run=>`${run.count} ${run.count===1?'нота':run.count<5?'ноты':'нот'} ${run.hand}`).join(', затем ')+'.';
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
function structuredScenes(lesson,groups,family,add){
  const cue=MICRO_MODULE_CUES[lesson.moduleId],plain={...GUIDED,fingers:false,preview:false};
  if(family==='reading'){
    const variants=readingMaterials(lesson,groups);
    if(variants.length<2)return false;
    add('warmup','orient','Знакомые ориентиры','Сравни ноты и клавиши на другом коротком рисунке.',variants[0],
      {presentation:plain,goal:{type:'reading',focus:'landmark',pitches:pitches(variants[0].notes)}});
    add('motif','phrase','Новый короткий рисунок','Прочитай другой порядок знакомых нот.',variants[1],
      {mode:'check',presentation:{...STAFF,names:true},goal:{type:'reading',pitches:pitches(variants[1].notes)}});
    add('fade','fade','Читаем без названий','Тот же маленький рисунок, теперь только по стану.',clone(variants[1]),
      {mode:'check',presentation:STAFF,goal:{type:'reading',pitches:pitches(variants[1].notes)}});
    return true;
  }
  const start=Math.min(focusGroup(lesson,groups,cue),Math.max(0,groups.length-2));
  const warmup=groupMaterial(lesson,groups,start,2),memory=family==='memory',rhythm=family==='rhythm';
  const hasRest=warmup.notes.some(note=>note.restBefore>0),poly=groups.some(group=>group.end-group.start>1);
  const warmText=memory?'Послушай маленькую часть и запомни направление.':hasRest?'Сначала найди ноты вокруг паузы без спешки.':cue.warmup;
  add('warmup','orient','Готовим трудное место',handInstruction(lesson,warmup)||warmText,warmup,
    {presentation:memory?{...HIDDEN,preview:true}:plain,goal:{type:hasRest?'rest':rhythm?'pulse':family,focus:cue.focus,pitches:pitches(warmup.notes)}});
  // Cover the whole source in short phrases; a final single attack joins the
  // preceding phrase. Boundaries are actual onset groups, including chords.
  const chunks=[];
  for(let at=0;at<groups.length;){
    const remaining=groups.length-at,count=remaining===5?3:Math.min(4,remaining);
    chunks.push(groupMaterial(lesson,groups,at,count));at+=count;
  }
  for(let index=0;index<chunks.length;index++){
    const material=chunks[index];
    const text=memory?'Послушай эту часть и повтори по памяти.':rhythm?'Считай ровно; в паузе не нажимай новую клавишу.':poly?'Ноты одного столбика сыграй вместе, затем следующий.':cue.motif;
    add(chunks.length===1?'motif':`motif-${index+1}`,'phrase',`Часть ${index+1} из ${chunks.length}`,handInstruction(lesson,material)||text,material,
      {mode:rhythm?'flow':'learn',presentation:memory?{...HIDDEN,preview:true}:plain,
        goal:{type:family,focus:cue.focus,pitches:pitches(material.notes)}});
  }
  const faded=groupMaterial(lesson,groups,start,Math.min(4,groups.length-start));
  add('fade','fade','Меньше подсказок',handInstruction(lesson,faded)|| (memory?'Повтори часть без нового показа.':rhythm?'Сохрани весь счёт без подсветки следующей клавиши.':'Сыграй часть по стану без названий и подсветки.'),faded,
    {mode:rhythm?'flow':'learn',presentation:memory||rhythm?HIDDEN:STAFF,goal:{type:family,focus:cue.focus,pitches:pitches(faded.notes)}});
  add('whole-guided','phrase','Соединяем весь рисунок',memory?'После показа повтори весь рисунок.':rhythm?'Соедини весь ритм, сохраняя паузы и счёт.':'Соедини знакомые части в полный рисунок.',
    {notes:clone(lesson.notes),sourceRange:{start:0,end:lesson.notes.length}},
    {coverage:true,mode:memory?'check':rhythm?'flow':'learn',presentation:memory?{...HIDDEN,preview:true}:rhythm?plain:STAFF,
      goal:{type:family,focus:cue.focus,pitches:pitches(lesson.notes)}});
  return true;
}

/** Teaching scenes are provisional; only the final canonical whole is assessment. */
export function createMicroLesson(lesson,{kind='new'}={}){
  const groups=validate(lesson,kind),family=familyFor(lesson,kind),known=canonical.get(lesson.id),data=MICROLESSONS[lesson.id];
  const exact=known&&(lesson.practiceKind===undefined||lesson.practiceKind===known.practiceKind)&&
    (lesson.hand===undefined||handFor(lesson)===handFor(known))&&
    (same(lesson.notes,known.notes)||kind==='recall'&&same(lesson.notes,recallSample(known)));
  const detailed=!!(data&&exact&&(family!=='reading'||known.practiceKind==='reading')),stages=[];
  let authored=!!exact;
  const add=(id,purpose,title,instruction,material,options={})=>{
    if(!material?.notes?.length)return;
    if(stages.some(stage=>stage.id===id))throw new Error('Duplicate micro scene.');
    const {presentation:cue,...extra}=options;
    stages.push({id,title,instruction,notes:material.notes,mode:options.mode||'learn',presentation:clone(cue||GUIDED),purpose,assessment:false,
      ...(material.sourceRange?{sourceRange:material.sourceRange}:{}),...extra});
  };
  if(detailed){
    if(family==='reading'){
      const guide=original(lesson,data.guide||[60,62,64,65]);
      add('staff-guide','orient','Ориентиры стана','Сравни линию, промежуток и клавишу.',{notes:guide},{spoken:data.cue,goal:{type:'reading',pitches:pitches(guide||[])}});
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
        {presentation:family==='memory'?HIDDEN:GUIDED,goal:{type:family,pitches:pitches(lesson.notes.slice(...range))}});
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
    // Module identity comes from the canonical course, not a caller's label.
    authored=structuredScenes({...lesson,moduleId:known.moduleId},groups,family,add);
  }
  stages.push(whole(lesson,family));
  if(stages.length>MAX_STAGES)throw new RangeError('A micro lesson has too many scenes.');
  const version='microlearning-v1:'+songFingerprint([JSON.stringify(stable({id:lesson.id,kind,family,notes:lesson.notes,stages}))]);
  return {id:lesson.id,version,authored,coverage:detailed?'detailed':authored?'structured':'legacy',stages};
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
  const selected=specific||pair||(plan.coverage==='structured'?local:null)||pitch||local||before.find(item=>item.goal?.type===stage.goal?.type)||before.at(-1);
  return selected?{index:selected.index,id:selected.id}:null;
}
