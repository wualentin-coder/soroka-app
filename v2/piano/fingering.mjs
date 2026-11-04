import {COURSE} from './course.mjs?v=b9fc53831534';
import {COMPOSITIONS} from './compositions.mjs?v=b9fc53831534';
import {noteInfo} from './pitch.mjs?v=b9fc53831534';
import {COURSE_FINGERINGS,SONG_FINGERINGS} from './fingering-data.mjs?v=b9fc53831534';

const NAMES=['','большой палец','указательный палец','средний палец','безымянный палец','мизинец'];
const COURSES=new Map(COURSE.map(lesson=>[lesson.id,lesson]));
const SONGS=new Map(COMPOSITIONS.map(song=>[song.id,song]));
const black=midi=>[1,3,6,8,10].includes(midi%12);
const side=value=>['right','Правая рука'].includes(value)?'right':['left','Левая рука'].includes(value)?'left':
  ['both','Обе руки','Руки по очереди'].includes(value)?'both':null;
const validFinger=value=>Number.isInteger(value)&&value>=1&&value<=5;
const samePosition=(a,b)=>a&&b&&a.hand===b.hand&&a.keys.every((key,index)=>key===b.keys[index]);
const selected=(rows,index)=>rows?.findLast(row=>row.start<=index);
const handName=hand=>hand==='left'?'Левая':'Правая';
const keyName=midi=>`${noteInfo(midi).name}${noteInfo(midi).octave}`;

/** Numbers identify fingers, never a measurement of the player's technique. */
export function fingerLegend(hand){
  const prefix=side(hand)==='right'?'Правая рука: ':side(hand)==='left'?'Левая рука: ':'';
  return prefix+NAMES.slice(1).map((name,index)=>`${index+1} — ${name}`).join('; ')+'.';
}

function positionFor(row,hand,transpose=0){
  if(!row)return null;
  const keys=row.keys.map(midi=>midi+transpose),startMidi=Math.min(...keys),endMidi=Math.max(...keys);
  if(startMidi<0||endMidi>127)return null;
  const thumbMidi=keys[0],littleMidi=keys[4];
  return {hand,keys,startMidi,endMidi,thumbMidi,littleMidi,
    text:`${handName(hand)}: большой на ${keyName(thumbMidi)}, мизинец на ${keyName(littleMidi)}. Рука свободная, без растяжения.`};
}

function sourceHand(lesson,data,note,index){
  const assigned=side(note.hand);
  if(note.hand!==undefined&&!['right','left'].includes(assigned))return null;
  if(assigned)return assigned;
  if(data?.handBlock)return Math.floor(index/data.handBlock)%2?'left':'right';
  const declared=side(lesson.hand);
  return declared==='both'?null:declared;
}

function authoredReferences(lesson,options){
  const id=options.sourceLessonId||lesson.sourceLessonId||lesson.courseId||lesson.compositionId||lesson.id;
  const source=COURSES.get(id)||SONGS.get(id),course=COURSES.has(id);
  if(!source)return null;
  const offset=options.sourceOffset??options.sourceRange?.start??lesson.sourceRange?.start??0;
  if(!Number.isInteger(offset)||offset<0)return null;
  const data=course?COURSE_FINGERINGS[id]:SONG_FINGERINGS[id];
  if(!data)return null;
  const references=[];
  for(let index=0;index<lesson.notes.length;index++){
    const note=lesson.notes[index];
    const track=course?null:note.sourceTrack||note.track||source.defaultTrack;
    const trackSource=course?source.notes:source.tracks.find(item=>item.id===track)?.notes;
    const sourceIndex=Number.isInteger(note.sourceIndex)?note.sourceIndex:offset+index;
    const original=trackSource?.[sourceIndex],profile=course?data:data[track];
    if(!original||!profile||sourceIndex>=(profile.end??trackSource.length))return null;
    const hand=course?sourceHand(source,data,original,sourceIndex):profile.left?'left':'right';
    if(!hand||note.hand!==undefined&&side(note.hand)!==hand)return null;
    const appliedArrangementTranspose=note.midi-original.midi;
    if(note.originalMidi!==undefined?note.originalMidi!==original.midi:
      appliedArrangementTranspose!==0&&appliedArrangementTranspose!==options.octave*12)return null;
    if(![0,12,-12].includes(appliedArrangementTranspose))return null;
    const row=selected(profile[hand],sourceIndex);
    const finger=row?.keys.indexOf(original.midi)+1;
    if(!row||!validFinger(finger)||Object.hasOwn(note,'finger')&&note.finger!==finger)return null;
    let previousIndex=sourceIndex-1;
    if(course)while(previousIndex>=0&&sourceHand(source,data,source.notes[previousIndex],previousIndex)!==hand)previousIndex--;
    const previous=previousIndex>=0?trackSource[previousIndex]:null;
    const previousRow=previous?selected(profile[hand],previousIndex):null;
    const effectiveCueTranspose=appliedArrangementTranspose!==0?appliedArrangementTranspose:options.octave*12;
    references.push({index,sourceIndex,sourceTrack:track,hand,finger,row,previousRow,transpose:effectiveCueTranspose,sourceMidi:original.midi});
  }
  return references;
}

function makeMovement(note,previous,kind,index,previousIndex,afterRest=false){
  const from=previous?.position||note.position,to=note.position;
  const thumbUnder=(to.thumbMidi-from.thumbMidi)*(note.hand==='right'?1:-1)>0;
  let text=afterRest?'Во время паузы снова подготовь руку. ':'';
  text+=kind==='thumb-cross'?`Перед ${keyName(note.midi)} спокойно проведи ${thumbUnder?'большой палец под остальными':'пальцы над большим пальцем'}; без выворачивания кисти. `:
    kind==='adjustment'?'Заранее подготовь пальцы к чёрной или соседней белой клавише. ':kind==='reset'?'Снова найди опорную клавишу. ':'Отпусти прежнюю позицию и заранее перенеси свободную руку. ';
  text+=`${to.text} ${keyName(note.midi)} сыграй пальцем ${note.finger}.`;
  return {hand:note.hand,kind,from,to,at:index,prepareAt:previousIndex,sourceIndex:note.sourceIndex,
    ...(Number.isFinite(note.time)?{time:note.time}:{}),afterRest,text};
}

function uniquePositions(notes){
  const positions=[];
  for(const note of notes)if(note.position&&!positions.some(position=>samePosition(position,note.position)))positions.push(note.position);
  return positions;
}

function authoredPlan(lesson,references){
  const notes=[],movements=[];
  for(const ref of references){
    const sourceNote=lesson.notes[ref.index],position=positionFor(ref.row,ref.hand,ref.transpose);
    if(!position)return null;
    const hint={index:ref.index,sourceIndex:ref.sourceIndex,...(ref.sourceTrack?{sourceTrack:ref.sourceTrack}:{}),
      midi:ref.sourceMidi+ref.transpose,hand:ref.hand,finger:ref.finger,position,provenance:'authored'};
    const previousPosition=positionFor(ref.previousRow,ref.hand,ref.transpose),afterRest=sourceNote.restBefore>0;
    if(previousPosition&&!samePosition(position,previousPosition)||afterRest){
      const previousLocal=notes.findLast(item=>item.hand===ref.hand);
      const movement=makeMovement(hint,{position:previousPosition||position},afterRest&&samePosition(position,previousPosition)?'reset':ref.row.kind,ref.index,previousLocal?.index??-1,afterRest);
      hint.movement=movement;movements.push(movement);
    }
    notes.push(hint);
  }
  return {provenance:'authored',label:'Аппликатура учебной редакции',notes,positions:uniquePositions(notes),movements,limitations:[]};
}

function candidates(midi,hand){
  const result=[],seen=new Set();
  for(let low=Math.max(0,midi-8);low<=midi;low++){
    if(black(low))continue;
    const keys=[];
    for(let key=low;key<=127&&keys.length<5;key++)if(!black(key))keys.push(key);
    if(keys.length!==5||keys[4]-keys[0]>8)continue;
    const variants=[keys];
    if(black(midi))for(let finger=1;finger<4;finger++)if(keys[finger-1]<midi&&midi<keys[finger+1]){
      const variant=[...keys];variant[finger]=midi;variants.push(variant);
    }
    for(const ascending of variants){
      if(!ascending.includes(midi))continue;
      const ordered=hand==='left'?[...ascending].reverse():ascending;
      const finger=ordered.indexOf(midi)+1,key=ordered.join(',');
      if(black(midi)&&[1,5].includes(finger)||seen.has(key))continue;
      seen.add(key);result.push({finger,position:positionFor({keys:ordered},hand)});
    }
  }
  return result;
}

function suggestHand(entries,hand){
  if(entries.some((entry,index)=>index&&(
    entry.note.group!==undefined&&entry.note.group===entries[index-1].note.group||
    Number.isFinite(entry.note.time)&&Number.isFinite(entries[index-1].note.time)&&
    entry.note.time<=entries[index-1].note.time+.00001||
    Number.isFinite(entry.note.time)&&Number.isFinite(entries[index-1].note.time)&&
    entry.note.time<entries[index-1].note.time+(entries[index-1].note.duration||0)-.00001)))return null;
  let states=[];
  const candidateCache=new Map();
  for(let index=0;index<entries.length;index++){
    const entry=entries[index],next=[];
    if(!candidateCache.has(entry.midi))candidateCache.set(entry.midi,candidates(entry.midi,hand));
    for(const candidate of candidateCache.get(entry.midi)){
      if(Object.hasOwn(entry.note,'finger')&&entry.note.finger!==candidate.finger)continue;
      let best=null;
      if(!index)best={cost:Math.abs(candidate.finger-3)*.08,parent:null};
      else for(const state of states){
        const previous=state.note,same=samePosition(candidate.position,previous.position),distance=Math.abs(entry.midi-previous.midi);
        const elapsed=entry.note.time-entries[index-1].note.time;
        if(distance>12&&Number.isFinite(elapsed)&&elapsed<.25)continue;
        const direction=(entry.midi-previous.midi)*(candidate.finger-previous.finger)*(hand==='right'?1:-1);
        const cost=state.cost+(same?0:3+Math.abs(candidate.position.thumbMidi-previous.position.thumbMidi)*.15)+
          (direction<0?1:0)+(entry.midi!==previous.midi&&candidate.finger===previous.finger?1.5:0)+
          (entry.midi===previous.midi&&candidate.finger!==previous.finger?1:0);
        if(!best||cost<best.cost)best={cost,parent:state};
      }
      if(best)next.push({cost:best.cost,parent:best.parent,note:{...candidate,midi:entry.midi,index:entry.index,sourceIndex:entry.sourceIndex,hand,provenance:'suggested'}});
    }
    states=next.sort((a,b)=>a.cost-b.cost).slice(0,12);
    if(!states.length)return null;
  }
  const path=[];
  for(let state=states[0];state;state=state.parent)path.push(state.note);
  return path.reverse();
}

function suggestedPlan(lesson,options){
  const declared=side(lesson.hand),entries=lesson.notes.map((note,index)=>{
    const assigned=side(note.hand),hand=['right','left'].includes(assigned)?assigned:declared==='both'?null:declared||(['right','left'].includes(options.hand)?options.hand:null);
    const appliedArrangementTranspose=Number.isInteger(note.originalMidi)?note.midi-note.originalMidi:0;
    return {note,index,hand,sourceIndex:Number.isInteger(note.sourceIndex)?note.sourceIndex:(options.sourceOffset??options.sourceRange?.start??0)+index,
      midi:note.midi+(appliedArrangementTranspose?0:options.octave*12)};
  });
  const notes=entries.map(entry=>({index:entry.index,sourceIndex:entry.sourceIndex,midi:entry.midi,hand:entry.hand,finger:null,provenance:'suggested'}));
  const limitations=[],movements=[];
  if(entries.some(entry=>!entry.hand))limitations.push('Рука не назначена однозначно. Выбери отдельную партию; пальцы не определяются по звуку.');
  for(const hand of ['right','left']){
    const handEntries=entries.filter(entry=>entry.hand===hand);
    if(!handEntries.length)continue;
    const path=suggestHand(handEntries,hand);
    if(!path){limitations.push(`${handName(hand)}: для этой последовательности не найдена безопасная автоматическая аппликатура. Нужен отдельный разбор.`);continue;}
    for(let index=0;index<path.length;index++){
      const current=path[index],previous=path[index-1];
      if(previous&&!samePosition(previous.position,current.position)||handEntries[index].note.restBefore>0){
        const direction=previous?(current.midi-previous.midi)*(current.finger-previous.finger)*(hand==='right'?1:-1):0;
        const movement=makeMovement(current,previous,direction<0&&(previous?.finger===1||current.finger===1)?'thumb-cross':'shift',current.index,previous?.index??-1,handEntries[index].note.restBefore>0);
        current.movement=movement;movements.push(movement);
      }
      notes[current.index]=current;
    }
  }
  return {provenance:'suggested',label:'Предложенная аппликатура',notes,positions:uniquePositions(notes),movements:movements.sort((a,b)=>a.at-b.at),limitations};
}

/** Pure source-aligned teaching plan. No score, finger or performance is measured. */
export function getFingeringPlan(lesson,options={}){
  if(!lesson||!options||typeof options!=='object'||Array.isArray(options)||!Array.isArray(lesson.notes)||
    !lesson.notes.length||lesson.notes.length>5000||lesson.notes.some(note=>!note||!Number.isInteger(note.midi)||note.midi<0||note.midi>127||
      note.hand!==undefined&&!['right','left','Правая рука','Левая рука'].includes(note.hand)||
      Object.hasOwn(note,'finger')&&!validFinger(note.finger))||options.hand!==undefined&&!['right','left','both'].includes(options.hand)||
    ![-1,0,1].includes(options.octave??0))return null;
  const normalized={...options,octave:options.octave??0};
  const references=authoredReferences(lesson,normalized);
  if(references)return authoredPlan(lesson,references);
  if(lesson.notes.some(note=>{
    const appliedArrangementTranspose=Number.isInteger(note.originalMidi)?note.midi-note.originalMidi:0;
    const midi=note.midi+(appliedArrangementTranspose?0:normalized.octave*12);
    return midi<0||midi>127;
  }))return null;
  return suggestedPlan(lesson,normalized);
}

export function getFingerHint(lesson,options={}){
  if(!options||typeof options!=='object'||Array.isArray(options))return null;
  const {index=0,reason='start'}=options;
  if(!Number.isInteger(index)||index<0||!['start','resume','rhythm','shift','transition','position'].includes(reason))return null;
  const plan=getFingeringPlan(lesson,options),hint=plan?.notes[index];
  if(!hint||!validFinger(hint.finger)||options.hand&&options.hand!=='both'&&options.hand!==hint.hand)return null;
  const repeat=lesson.notes[index-1]?.midi===lesson.notes[index].midi||lesson.notes[index+1]?.midi===lesson.notes[index].midi;
  const movement=hint.movement||(['shift','transition'].includes(reason)?plan.movements.find(move=>move.prepareAt===index):null);
  return {...hint,...(movement?{movement}:{}),text:(hint.provenance==='suggested'?'Предложенная аппликатура. ':'')+
    `${noteInfo(hint.midi).name} — ${hint.finger}, ${NAMES[hint.finger]} ${hint.hand==='right'?'правой':'левой'} руки.`+
    (repeat?' Между повторами отпускай клавишу.':'')};
}
