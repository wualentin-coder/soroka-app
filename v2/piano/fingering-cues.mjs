import {getFingeringPlan} from './fingering.mjs?v=0b58b5803e6f';
import {noteInfo} from './pitch.mjs?v=0b58b5803e6f';

const NAMES=['','большой палец','указательный палец','средний палец','безымянный палец','мизинец'];
const validFinger=value=>Number.isInteger(value)&&value>=1&&value<=5;
const keyName=midi=>`${noteInfo(midi).name}${noteInfo(midi).octave}`;
const handName=hand=>hand==='left'?'Левая':'Правая';
const samePosition=(a,b)=>a&&b&&a.hand===b.hand&&a.keys.every((key,index)=>key===b.keys[index]);

function shiftedPosition(position,delta){
  if(!position)return null;
  const keys=position.keys.map(key=>key+delta),startMidi=position.startMidi+delta,endMidi=position.endMidi+delta;
  if(startMidi<0||endMidi>127)return null;
  const thumbMidi=position.thumbMidi+delta,littleMidi=position.littleMidi+delta;
  return {...position,keys,startMidi,endMidi,thumbMidi,littleMidi,
    text:`${handName(position.hand)}: большой на ${keyName(thumbMidi)}, мизинец на ${keyName(littleMidi)}. Рука свободная, без растяжения.`};
}

function movementText(movement,note){
  const thumbUnder=(movement.to.thumbMidi-movement.from.thumbMidi)*(note.hand==='right'?1:-1)>0;
  const action=movement.kind==='thumb-cross'?`Плавно проведи ${thumbUnder?'большой палец под остальными':'пальцы над большим пальцем'}, не выворачивая кисть. `:
    movement.kind==='adjustment'?'Подготовь пальцы к следующей клавише. ':movement.kind==='reset'?'Во время паузы снова найди опорную клавишу. ':
      'Отпусти прежнюю позицию и перенеси свободную руку. ';
  return action+movement.to.text+` ${keyName(note.midi)} сыграй пальцем ${note.finger}.`;
}

/** Build once per actual practice scene/octave; callers own the cache lifetime. */
export function createPracticeFingering(lesson,options={}){
  if(!lesson||!options||typeof options!=='object'||Array.isArray(options)||!Array.isArray(lesson.notes))return null;
  const {stage,sourceLessonId,hand,octave=0}=options;
  if(![-1,0,1].includes(octave))return null;
  const reorderedSourceIndices=stage?.sourceNoteIndices;
  if(reorderedSourceIndices!==undefined&&(!Array.isArray(reorderedSourceIndices)||reorderedSourceIndices.length!==lesson.notes.length||
    reorderedSourceIndices.some(index=>!Number.isInteger(index)||index<0||index>=5000)))return null;
  const origin=stage?.goal?.sourceLessonId||sourceLessonId||stage?.sourceLessonId||lesson.sourceLessonId||lesson.courseId||lesson.compositionId||lesson.id;
  const sourceRange=stage?.sourceRange||lesson.sourceRange;
  const notes=reorderedSourceIndices?lesson.notes.map((note,index)=>({...note,sourceIndex:reorderedSourceIndices[index]})):lesson.notes;
  const requestHand=hand??stage?.hand;
  const base=getFingeringPlan({...lesson,hand:lesson.hand??stage?.hand,notes},
    {octave:0,...(origin?{sourceLessonId:origin}:{}),...(requestHand?{hand:requestHand}:{}),...(sourceRange?{sourceRange}:{} )});
  if(!base||base.notes.length!==lesson.notes.length)return null;
  const delta=octave*12,result={...base,notes:[],positions:[],movements:[],limitations:[...base.limitations]},previous=new Map(),movesAt=new Map();
  for(const movement of base.movements)if(!movesAt.has(movement.at))movesAt.set(movement.at,movement);
  for(let index=0;index<base.notes.length;index++){
    const original=base.notes[index],midi=lesson.notes[index].midi+delta;
    if(original.midi!==lesson.notes[index].midi||midi<0||midi>127)return null;
    const current={...original,midi};delete current.movement;
    if(!validFinger(original.finger)){result.notes.push(current);continue;}
    const position=shiftedPosition(original.position,delta);if(!position)return null;
    current.position=position;
    const last=previous.get(current.hand),sourceMove=original.movement||movesAt.get(index);
    let movement=sourceMove?{...sourceMove,from:shiftedPosition(sourceMove.from,delta),to:shiftedPosition(sourceMove.to,delta)}:null;
    if(movement&&(!movement.from||!movement.to))return null;
    if(reorderedSourceIndices&&last){
      const positionChanged=!samePosition(last.position,current.position);
      if(positionChanged&&(!movement||!samePosition(movement.from,last.position))){
        movement={hand:current.hand,kind:'shift',from:last.position,to:current.position,at:index,prepareAt:last.index,
          sourceIndex:current.sourceIndex,afterRest:lesson.notes[index].restBefore>0,provenance:'suggested'};
        result.provenance='suggested';result.label='Предложенная аппликатура';
      }else if(!positionChanged&&movement&&!movement.afterRest)movement=null;
      else if(movement)movement.prepareAt=last.index;
    }
    if(movement){
      movement.text=movementText(movement,current);current.movement=movement;result.movements.push(movement);
    }
    if(!result.positions.some(item=>samePosition(item,position)))result.positions.push(position);
    result.notes.push(current);previous.set(current.hand,current);
  }
  return result;
}

/** Select a cue without recalculating fingers or replacing the current target. */
export function selectPracticeFingerCue(plan,options={}){
  if(!plan||!options||typeof options!=='object'||Array.isArray(options))return null;
  const {index=0,reason='start'}=options;
  if(!Number.isInteger(index)||index<0||!['start','resume','rhythm','position','shift','transition'].includes(reason))return null;
  const current=plan.notes?.[index];
  if(!current||!validFinger(current.finger)||!current.position||!['left','right'].includes(current.hand))return null;
  const movement=['shift','transition'].includes(reason)?plan.movements?.find(move=>move.at===index)||plan.movements?.find(move=>move.prepareAt===index):current.movement;
  const suggested=plan.provenance==='suggested'||current.provenance==='suggested'||movement?.provenance==='suggested';
  const text=(suggested?'Предложенная аппликатура. ':'')+
    `${keyName(current.midi)} — ${current.finger}, ${NAMES[current.finger]} ${current.hand==='left'?'левой':'правой'} руки. ${current.position.text}`+
    (movement?(movement.at>index?' После этой ноты: ':' ')+movement.text:'');
  return {...current,provenance:suggested?'suggested':current.provenance,...(movement?{movement}:{}),label:suggested?'Предложенная аппликатура':plan.label,text};
}
