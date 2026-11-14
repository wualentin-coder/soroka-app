import {COURSE} from './course.mjs?v=bc0d6f000e4b';
import {createScoreTimeline} from './score.mjs?v=bc0d6f000e4b';
import {songOnsetGroups} from './song-learning.mjs?v=bc0d6f000e4b';

const clone=value=>structuredClone(value);
const canonical=new Map(COURSE.map(lesson=>[lesson.id,lesson]));
const pitchKey=notes=>JSON.stringify(notes.map(note=>[note.midi,note.hand??null]));
const contains=(source,notes)=>source.some((_,at)=>pitchKey(source.slice(at,at+notes.length))===pitchKey(notes));
const memory=lesson=>['echo','recall'].includes(lesson.practiceKind);
const sourceHand=lesson=>['Левая рука','left'].includes(lesson.hand)?'left':['Обе руки','both','Руки по очереди'].includes(lesson.hand)?'both':'right';

function sourceGroups(lesson){
  if(typeof lesson?.id!=='string'||!lesson.id||!Array.isArray(lesson.notes)||!lesson.notes.length||lesson.notes.length>5000)throw new TypeError('Mixed practice needs a bounded actual score.');
  const timed=lesson.notes.some(note=>note?.time!==undefined||note?.duration!==undefined);
  const timeline=createScoreTimeline(lesson.notes,{tempo:60,sourceTempo:60,preserveTiming:timed});
  const groups=songOnsetGroups(timeline);
  // A boundary must also respect each hand's chord, including slightly spread
  // imported MIDI chords which cross the combined35ms grouping boundary.
  const guards=['right','left'].flatMap(hand=>songOnsetGroups(timeline.filter(note=>lesson.notes[note.index].hand===hand)));
  const safe=at=>!guards.some(group=>group.time<at-1e-9&&group.last>=at-1e-9);
  return {timed,groups,blocks:groups.reduce((blocks,group,index)=>{
    if(index&&!safe(group.time))blocks.at(-1).end=group.end;
    else blocks.push({start:group.start,end:group.end});
    return blocks;
  },[])};
}

function material(lesson,info,selection){
  let offset=0,nextGroup=0;
  const notes=selection.flatMap(blockIndex=>{
    const block=info.blocks[blockIndex];
    const source=lesson.notes.slice(block.start,block.end),first=source[0].time;
    const onsets=info.groups.filter(group=>group.start>=block.start&&group.end<=block.end);
    const copied=source.map((note,index)=>({...clone(note),group:nextGroup+onsets.findIndex(group=>block.start+index>=group.start&&block.start+index<group.end),...(info.timed?{time:offset+note.time-first}:{})}));
    nextGroup+=onsets.length;
    if(info.timed){
      const next=info.blocks[blockIndex+1],previous=info.blocks[blockIndex-1];
      // MIDI durations may overlap the following onset; keep that onset clock.
      const gap=next?lesson.notes[next.start].time-first:previous?first-lesson.notes[previous.start].time:Math.max(...source.map(note=>note.time+note.duration))-first;
      offset+=Math.max(.04,gap);
    }
    return copied;
  });
  return notes;
}

function shortIndices(info,focus=0){
  let start=Math.max(0,Math.min(focus,info.blocks.length-1)),end=start;
  while(end<info.blocks.length){
    const count=info.groups.filter(group=>group.start>=info.blocks[start].start&&group.end<=info.blocks[end].end).length;
    if(count>4)break;
    end++;if(end-start>=3)break;
  }
  if(end===start)throw new RangeError('This source chord cannot be shortened safely for mixed practice.');
  return Array.from({length:end-start},(_,index)=>start+index);
}
const sourceNoteIndices=(info,selection)=>selection.flatMap(index=>{
  const block=info.blocks[index];return Array.from({length:block.end-block.start},(_,offset)=>block.start+offset);
});

function readingVariants(lesson,info){
  const candidates=[],seen=new Set();
  const add=indices=>{
    const notes=material(lesson,info,indices),key=pitchKey(notes);
    if(seen.has(key)||contains(lesson.notes,notes)||songOnsetGroups(createScoreTimeline(notes,{preserveTiming:info.timed})).length>4)return;
    seen.add(key);candidates.push({notes,newOrder:true,sourceNoteIndices:sourceNoteIndices(info,indices)});
  };
  for(let a=0;a<info.blocks.length-1&&candidates.length<2;a++){
    const b=a+1;if(pitchKey(lesson.notes.slice(info.blocks[a].start,info.blocks[a].end))===pitchKey(lesson.notes.slice(info.blocks[b].start,info.blocks[b].end)))continue;
    for(const indices of [[a,a,a,b],[a,a,b,b],[a,b,b,b],[a,b,b],[a,a,b]])add(indices);
  }
  if(!candidates.length){
    const indices=shortIndices(info),notes=material(lesson,info,indices);
    candidates.push({notes,newOrder:false,sourceNoteIndices:sourceNoteIndices(info,indices)});
  }
  return candidates;
}

function support(level,{hidden=false,preview=false}={}){
  return {target:!hidden&&level===0,names:!hidden&&level<=1,staff:!hidden,falling:!hidden&&level===0,preview,fingers:!hidden&&level<=2};
}

/** Interleaved2–4onset practice blocks, never a canonical lesson assessment. */
export function createMixedPracticeStages(lesson,{knownLessonIds=[],supportLevel,transitionIndices=[]}={}){
  const info=sourceGroups(lesson),reading=lesson.practiceKind==='reading',recall=memory(lesson),rhythm=lesson.practiceKind==='rhythm';
  const focusNote=Array.isArray(transitionIndices)?transitionIndices.find(index=>Number.isInteger(index)&&index>=0&&index<lesson.notes.length):undefined;
  let focus=focusNote===undefined?-1:info.blocks.findIndex(block=>block.start<=focusNote&&block.end>focusNote);
  if(focus<0)focus=info.blocks.findIndex(block=>lesson.notes.slice(block.start,block.end).some(note=>note.restBefore>0));
  const selection=shortIndices(info,Math.max(0,focus-1)),first=info.blocks[selection[0]].start,last=info.blocks[selection.at(-1)].end;
  const variants=readingVariants(lesson,info);
  const currentMeta=reading?{sourceNoteIndices:[...variants[0].sourceNoteIndices]}:{sourceRange:{start:first,end:last},sourceOffset:first,
    transitionIndices:(Array.isArray(transitionIndices)?transitionIndices:[]).filter(index=>Number.isInteger(index)&&index>=first&&index<last).map(index=>index-first)};
  const current=reading?variants[0].notes:clone(lesson.notes.slice(first,last));
  let familiar=current,familiarId=lesson.id,familiarity='current-warmup',familiarMeta=currentMeta;
  const introduced=new Set(lesson.notes.map(note=>note.midi)),hand=sourceHand(lesson);
  for(const id of [...new Set(Array.isArray(knownLessonIds)?knownLessonIds:[])].reverse()){
    const candidate=canonical.get(id);
    if(!candidate||candidate.id===lesson.id||sourceHand(candidate)!==hand)continue;
    const previous=sourceGroups(candidate),selection=shortIndices(previous),start=previous.blocks[selection[0]].start,end=previous.blocks[selection.at(-1)].end;
    const notes=clone(candidate.notes.slice(start,end));
    if(notes.some(note=>!introduced.has(note.midi))||reading&&contains(lesson.notes,notes))continue;
    familiar=notes;familiarId=id;familiarity='mastered';familiarMeta={provenanceRange:{start,end},sourceOffset:start};break;
  }
  const level=(at)=>Number.isInteger(supportLevel)&&supportLevel>=0&&supportLevel<=3?supportLevel:[1,1,2,3][at];
  const make=(id,title,instruction,notes,type,at,extra={})=>({
    id:'mixed-'+id,title,instruction,notes:clone(notes),mode:type==='rhythm'?'flow':type==='reading'?'check':'learn',purpose:'mixed',assessment:false,coverage:false,
    supportLevel:recall&&type==='memory'?3:level(at),presentation:support(level(at),{hidden:recall&&type==='memory',preview:recall&&type==='memory'&&id!=='return'}),
    transitionIndices:[],goal:{type,mixedSkill:id==='return'?'current-return':id,pitches:[...new Set(notes.map(note=>note.midi))],...extra},
  });
  const type=reading?'reading':rhythm?'rhythm':recall?'memory':'notes';
  const newReading=variants[1]||variants[0];
  const stages=[
    make('current','Сейчас: трудное место',rhythm?'Сохрани счёт в коротком знакомом месте.':recall?'Послушай короткий рисунок и повтори.':'Сыграй короткое место из текущей задачи.',current,type,0,{sourceLessonId:lesson.id}),
    make('familiar','Возвращаем знакомое',familiarity==='mastered'?'Сыграй знакомую фразу из освоенного урока.':'Вернись к короткому рисунку из разминки.',familiar,recall?'memory':reading?'reading':'notes',1,{sourceLessonId:familiarId,familiarity}),
    make('reading',newReading.newOrder?'Знакомые ноты, новый порядок':'Узнаём знакомые ноты',newReading.newOrder?'Прочитай другой порядок уже знакомых нот.':'Найди знакомые ноты на стане и сыграй их.',newReading.notes,'reading',2,{sourceLessonId:lesson.id,newOrder:newReading.newOrder}),
    make('return','Снова текущее место',recall?'Вспомни тот же короткий рисунок после показа.':rhythm?'Вернись к счёту в том же коротком месте.':'Вернись к первому короткому рисунку.',current,type,3,{sourceLessonId:lesson.id}),
  ];
  Object.assign(stages[0],clone(currentMeta));Object.assign(stages[1],clone(familiarMeta));Object.assign(stages[3],clone(currentMeta));
  stages[2].sourceNoteIndices=[...newReading.sourceNoteIndices];
  return stages;
}
