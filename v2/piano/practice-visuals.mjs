const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

/** Pixel geometry only: the session remains the authority for accepted timing. */
export function practiceVisualGeometry({height,windowSeconds=.28}={}){
  if(!Number.isFinite(height)||height<=0||!Number.isFinite(windowSeconds)||windowSeconds<0||windowSeconds>2)throw new RangeError('Practice geometry needs a positive height and a bounded timing window.');
  const strikeInsetPx=Math.min(24,height/2),pxPerSecond=clamp(height/3.5,48,110);
  return {strikeY:height-strikeInsetPx,strikeInsetPx,pxPerSecond,
    windowHalfPx:Math.min(24,strikeInsetPx,windowSeconds*pxPerSecond),
    lineWidthPx:4,minNoteHeightPx:24,barWidthRatio:.88,barMaxWidthPx:88};
}

/** Shares the rendered keyboard's normalized key position; no second MIDI grid. */
export function noteBarBounds({keyPosition,canvasWidth,noteTime,duration,playhead,geometry}={}){
  if(!keyPosition||!Number.isFinite(keyPosition.center)||!Number.isFinite(keyPosition.width)||keyPosition.center<0||keyPosition.center>1||keyPosition.width<=0||keyPosition.width>1||
    !Number.isFinite(canvasWidth)||canvasWidth<=0||!Number.isFinite(noteTime)||!Number.isFinite(duration)||duration<0||!Number.isFinite(playhead)||
    !geometry||!Number.isFinite(geometry.strikeY)||!Number.isFinite(geometry.pxPerSecond)||geometry.pxPerSecond<=0||
    !Number.isFinite(geometry.minNoteHeightPx)||geometry.minNoteHeightPx<=0||!Number.isFinite(geometry.barWidthRatio)||geometry.barWidthRatio<=0||geometry.barWidthRatio>1||
    !Number.isFinite(geometry.barMaxWidthPx)||geometry.barMaxWidthPx<=0)throw new RangeError('A note bar needs the actual key position and finite score geometry.');
  const x=keyPosition.center*canvasWidth,width=Math.min(geometry.barMaxWidthPx,keyPosition.width*canvasWidth*geometry.barWidthRatio),
    height=Math.max(geometry.minNoteHeightPx,duration*geometry.pxPerSecond),bottom=geometry.strikeY+(playhead-noteTime)*geometry.pxPerSecond;
  return {x,y:bottom-height,width,height,bottom,radius:Math.min(7,width/3)};
}

const routeLabels={right:'Правая',left:'Левая',both:'Вместе',join:'Соединяем',independent:'Самостоятельно'};
const routeAria={right:'Правая рука',left:'Левая рука',both:'Две руки',join:'Соединение фрагментов',independent:'Самостоятельная игра'};
const partNumber=value=>Number.isSafeInteger(value)&&value>=1&&value<=1000;

/** Current musical context, never an inferred achievement or a plan of the whole course. */
export function buildPracticeRoute({stage,availableHands,mode='learn',goalPercent=80,completedPhases=[],isCourse=false,memory=false}={}){
  const hidden={visible:false,fragment:'',goal:'',ariaLabel:'',steps:[]};
  if(isCourse||memory||!stage||typeof stage!=='object'||!['right','left','both'].includes(stage.hand))return hidden;
  if(!['learn','check','flow'].includes(mode)||!Number.isFinite(goalPercent)||goalPercent<0||goalPercent>100)throw new RangeError('Practice route needs a real mode and a percentage goal.');
  const kind=stage.kind||(stage.whole?'whole':'fragment');
  if(!['fragment','connection','whole','check'].includes(kind))return hidden;
  const independent=kind==='check'&&stage.purpose==='independent';
  if(kind==='check'&&!independent)return hidden;
  const whole=kind==='whole'||kind==='check',connection=kind==='connection';
  const hands=['right','left','both'].filter(hand=>(Array.isArray(availableHands)?availableHands:Array.isArray(stage.availableHands)?stage.availableHands:[stage.hand]).includes(hand));
  if(!hands.includes(stage.hand))return hidden;
  const phases=whole?['join','independent']:connection?['join']:hands;
  const current=independent?'independent':whole||connection?'join':stage.hand;
  const completed=new Set(Array.isArray(completedPhases)?completedPhases:[]);
  const steps=phases.map(phase=>({phase,label:routeLabels[phase],ariaLabel:routeAria[phase],state:phase===current?'current':completed.has(phase)?'done':'next'}));
  const fragment=whole?'Вся композиция':connection?
    partNumber(stage.fromPart)&&partNumber(stage.toPart)&&stage.fromPart<=stage.toPart?`Фрагменты ${stage.fromPart}–${stage.toPart}`:'Соединение фрагментов':
    partNumber(stage.part)&&partNumber(stage.parts)&&stage.part<=stage.parts?`Фрагмент ${stage.part} из ${stage.parts}`:'Текущий фрагмент';
  const timed=mode==='flow'||independent&&stage.requiredMode==='flow',percent=Math.round(goalPercent*10)/10,
    grade=String(percent/10).replace('.',','),goal=timed?`${independent?'Цель':'В темпе'} · ≥${String(percent).replace('.',',')}%`:`Цель · ≥${grade}/10`;
  return {visible:true,fragment,goal,ariaLabel:`${fragment}. ${routeAria[current]}. ${goal.replace('≥','не меньше ')}.`,steps};
}

/** Steady light on the present target, with no clock, blinking or score changes. */
export function noteBarMaterial({active=false,due=false,approaching=false,waiting=false,played=false,reducedMotion=false}={}){
  const current=active===true&&played!==true,arrived=current&&(due===true||waiting===true);
  return {opacity:played===true?.12:arrived?1:current?.92:.62,
    shadowBlur:reducedMotion===true?0:arrived?7:current&&approaching===true?3:0,
    shadowOffsetY:arrived&&reducedMotion!==true?1:0,
    glossTop:.32,glossMid:.07,glossBottom:.2,
    rimAlpha:arrived?.5:current?.3:.2,rimWidth:arrived?1.25:.8};
}
