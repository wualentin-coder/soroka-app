import {songOnsetGroups,songFingerprint,musicalNoteKey} from './song-learning.mjs?v=bc0d6f000e4b';
import {getFingeringPlan} from './fingering.mjs?v=bc0d6f000e4b';

const MAX_NOTES=5000,MAX_PARENT_STAGES=2048,WINDOW=.035,EPSILON=1e-9;
// These flags keep notation formats available; practice-display selects the
// learner's format independently of keyboard answers, names and fingers.
const GUIDED={target:true,names:true,staff:true,falling:true,preview:false,fingers:true};
const NAMES={target:false,names:true,staff:true,falling:true,preview:false,fingers:true};
const FINGERS={target:false,names:false,staff:true,falling:true,preview:false,fingers:true};
const UNASSISTED={target:false,names:false,staff:true,falling:true,preview:false,fingers:false};
const clone=value=>structuredClone(value);
const noteKey=note=>[...musicalNoteKey(note),note.restBefore??null,note.group??null,note.finger??null];
const sameNotes=(a,b)=>a.length===b.length&&a.every((note,index)=>JSON.stringify(noteKey(note))===JSON.stringify(noteKey(b[index])));

function selectedStage(plan,candidate){
  if(typeof plan?.id!=='string'||!plan.id||plan.id.length>200||typeof plan.version!=='string'||
    !plan.version.startsWith(`composition-study-v3:${plan.id}:`)||!/^[a-f0-9]{16}$/.test(plan.version.slice(`composition-study-v3:${plan.id}:`.length))||
    !/^[a-f0-9]{16}$/.test(plan.sourceFingerprint)||!Array.isArray(plan.stages)||!plan.stages.length||plan.stages.length>MAX_PARENT_STAGES||
    typeof candidate?.id!=='string'||candidate.id.length>200)return null;
  const matches=plan.stages.filter(stage=>stage?.id===candidate.id);
  if(matches.length!==1)return null;
  const stage=matches[0];
  if(stage.kind!=='fragment'||stage.purpose!=='guided'||stage.whole!==false||
    candidate.kind!==stage.kind||candidate.purpose!==stage.purpose||candidate.whole!==stage.whole||candidate.hand!==stage.hand||
    !['right','left','both'].includes(stage.hand)||
    stage.requiredMode!==undefined&&!['learn','check','flow'].includes(stage.requiredMode)||candidate.requiredMode!==stage.requiredMode||
    !Array.isArray(stage.notes)||!stage.notes.length||stage.notes.length>MAX_NOTES||!Array.isArray(candidate.notes))return null;
  if(Array.from(stage.notes).some(note=>!note||!Number.isInteger(note.midi)||note.midi<0||note.midi>127||
    !Number.isFinite(note.time)||note.time<0||!Number.isFinite(note.duration)||note.duration<=0||note.time+note.duration>86400||
    note.restBefore!==undefined&&(!Number.isFinite(note.restBefore)||note.restBefore<0)||
    note.hand!==undefined&&!['right','left'].includes(note.hand)))return null;
  return sameNotes(stage.notes,candidate.notes)?stage:null;
}

function prepareEnd(notes,groups){
  // A combined 35 ms group boundary can still cross a chord of one hand.
  // Extend to the first boundary safe for both hands rather than split it.
  const guards=['right','left'].flatMap(hand=>songOnsetGroups(notes.filter(note=>note.hand===hand)))
    .filter(group=>group.last>group.time+EPSILON);
  for(let count=2;count<groups.length&&count<=8;count++){
    const boundary=groups[count].time;
    if(!guards.some(group=>group.time<boundary-EPSILON&&group.last>=boundary-EPSILON))return groups[count-1].end;
  }
  return null;
}

function transitionIndices(parent,source,groups){
  const notes=source.notes,anchors=new Set([0]),groupStart=[];
  const restGap=Math.max(.12,60/(source.sourceTempo||60)*.25);
  for(const group of groups)for(let index=group.start;index<group.end;index++)groupStart[index]=group.start;
  const plan=getFingeringPlan({...source,id:parent.id},{sourceLessonId:parent.id});
  for(const movement of plan?.movements||[]){
    anchors.add(groupStart[movement.at]);
    if(movement.prepareAt>=0)anchors.add(groupStart[movement.prepareAt]);
  }
  const previous=new Map();
  for(let index=0;index<notes.length;index++){
    const note=notes[index],hand=note.hand||source.hand,last=previous.get(hand);
    const value=note.beats??note.duration,prior=last?.beats??last?.duration;
    if(!last||note.restBefore>0||Number.isFinite(value)&&Number.isFinite(prior)&&Math.abs(value-prior)>EPSILON||
      last&&note.time-last.time-last.duration>=restGap-EPSILON)anchors.add(groupStart[index]);
    previous.set(hand,note);
  }
  return [...anchors].filter(Number.isInteger).sort((a,b)=>a-b);
}

/** A preparation route for one guided song fragment, never a whole-song exam. */
export function createSongMicroLesson(parentPlan,parentStage){
  try{
    const source=selectedStage(parentPlan,parentStage);if(!source)return null;
    const notes=source.notes,groups=songOnsetGroups(notes);if(groups.length<3)return null;
    const end=prepareEnd(notes,groups);if(!end)return null;
    const first=notes[0].time,prepare=notes.slice(0,end).map(note=>({...clone(note),time:note.time-first}));
    const hand=source.hand==='left'?'левой рукой':source.hand==='right'?'правой рукой':'обеими руками';
    const simultaneous=groups.some(group=>group.end-group.start>1);
    const transitions=transitionIndices(parentPlan,source,groups);
    const goal={type:'notes',scope:'fragment',parentStageId:source.id,pitches:[...new Set(notes.map(note=>note.midi))]};
    const stage=(id,purpose,title,instruction,material,{assessment=false,presentation=GUIDED,supportLevel=0,mode='learn',range={start:0,end:notes.length}}={})=>
      ({id,title,instruction,notes:material,mode,presentation:clone(presentation),purpose,assessment,supportLevel,
        transitionIndices:transitions.filter(index=>index>=range.start&&index<range.end).map(index=>index-range.start),sourceRange:range,goal:clone(goal)});
    const stages=[
      stage('prepare','orient','Готовим начало',`Сыграй начало ${hand}, пока без спешки.`,prepare,{range:{start:0,end}}),
      stage('phrase','phrase','Фрагмент с подсказками',simultaneous?'Ноты одного столбика звучат вместе; соедини весь фрагмент.':`Соедини весь фрагмент ${hand}.`,clone(notes)),
      stage('fade-keyboard','fade','Без подсветки клавиши','Названия и пальцы ещё помогают; сыграй тот же фрагмент.',clone(notes),{presentation:NAMES,supportLevel:1}),
      stage('fade-names','fade','Без названий нот','Пальцы подскажем только в начале и в местах перехода.',clone(notes),{presentation:FINGERS,supportLevel:2}),
      stage('fade','fade','Без дополнительных подсказок','Повтори тот же фрагмент без названий и номеров пальцев.',clone(notes),{presentation:UNASSISTED,supportLevel:3}),
      stage('whole','whole','Фрагмент целиком','Сыграй этот фрагмент целиком с выбранным видом дорожки.',clone(notes),
        {assessment:true,presentation:UNASSISTED,supportLevel:3,mode:source.requiredMode||'learn'}),
    ];
    const signature=songFingerprint(['progressive-song-support-v2',parentPlan.version,source.id,source.hand,source.requiredMode||'learn',
      notes.map(noteKey),stages.map(item=>[item.id,item.instruction,item.presentation,item.supportLevel,item.transitionIndices,item.mode,item.sourceRange])]);
    return {id:'song-micro-'+signature,version:'microlearning-v1:'+signature,authored:true,song:true,stages};
  }catch{return null;}
}
