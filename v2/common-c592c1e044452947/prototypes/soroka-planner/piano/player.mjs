import { detectPitch, noteInfo, frequencyForMidi } from './pitch.mjs?v=1458d8543105';
import { LESSONS, PracticeSession } from './session.mjs?v=1458d8543105';
import { PianoInputGate } from './piano-input-gate.mjs?v=1458d8543105';
import {createMicStream} from './mic-stream.mjs?v=1458d8543105';
import { ALL_COURSE as COURSE, ACTIVE_COURSE, RECOMMENDED_COURSE, MasterySession, normalizeCourseProgress, recordCourseAttempt, courseLessonStatus } from './course.mjs?v=1458d8543105';
import { COMPOSITIONS, parseMidiComposition, buildFragments, toPracticeNotes } from './compositions.mjs?v=1458d8543105';
import { createTeacher } from './teacher.mjs?v=1458d8543105';
import { createScoreTimeline } from './score.mjs?v=1458d8543105';
import { FollowTransport } from './transport.mjs?v=1458d8543105';
import { ChordSession } from './chord-session.mjs?v=1458d8543105';
import { createArrangement } from './arrangement.mjs?v=1458d8543105';
import { createAccompanimentPlayer } from './accompaniment.mjs?v=1458d8543105';
import { PolyphonicInputGate, requiredFrameSize } from './polyphonic.mjs?v=1458d8543105';
import { createMidiInput } from './midi-input.mjs?v=1458d8543105';
import { EarlyInputBuffer } from './early-input.mjs?v=1458d8543105';
import { chooseProblemSection, sectionBacking } from './practice-section.mjs?v=1458d8543105';
import { createKeyboardRange, keyboardViewportOptions } from './keyboard-range.mjs?v=1458d8543105';
import { createCompositionStudy, normalizeStudyProgress, recordStudyAttempt, isStudyStageComplete, recommendSongRepair } from './composition-study.mjs?v=1458d8543105';
import { createLessonIntro, createNotationGuide } from './lesson-intro.mjs?v=1458d8543105';
import { createLessonPresenter } from './lesson-presenter.mjs?v=1458d8543105';
import { drawNotation, describeStaffPosition } from './notation.mjs?v=1458d8543105';
import { createMicroLesson, chooseMicroRepair, chooseMicroNext } from './microlearning.mjs?v=1458d8543105';
import {normalizeLearningProgress} from './learning-path.mjs?v=1458d8543105';
import { isCompactFoundationLesson } from './microlearning-data.mjs?v=1458d8543105';
import { selectedPracticeDisplay } from './practice-display.mjs?v=1458d8543105';
import {practiceOutcome} from './practice-outcome.mjs?v=1458d8543105';
import {recordPracticeActivity,readPracticeActivity} from './practice-journal.mjs?v=1458d8543105';
import { createSongMicroLesson } from './song-microlearning.mjs?v=1458d8543105';
import { normalizeMicroProgress, getMicroRun, updateMicroRun } from './microlearning-progress.mjs?v=1458d8543105';
import { createMicrostepView } from './microstep-ui.mjs?v=1458d8543105';
import { supportLevel, resolveSupport, nextHelpLevel, supportLabel } from './support-policy.mjs?v=1458d8543105';
import { chooseNativeRoute } from './native-route.mjs?v=1458d8543105';
import { createPracticeFingering, selectPracticeFingerCue } from './fingering-cues.mjs?v=1458d8543105';
import { chooseLearningTempo, adaptLearningTempo, createPerformancePlan, advancePerformanceTempo } from './learning-tempo.mjs?v=1458d8543105';
import { TimedSession } from './timed-session.mjs?v=1458d8543105';
import { chooseFlowOutcome } from './flow-progression.mjs?v=1458d8543105';
import { chooseTimingAdvice } from './timing-feedback.mjs?v=1458d8543105';
import { practicePolicy } from './practice-policy.mjs?v=1458d8543105';
import { practiceVisualGeometry, noteBarBounds, buildPracticeRoute, noteBarMaterial } from './practice-visuals.mjs?v=1458d8543105';
import { createCoachFeedback } from './coach-feedback.mjs?v=1458d8543105';
import { createPostplayCoach } from './postplay-coach.mjs?v=1458d8543105';
import { createPracticeScene } from './practice-scene.mjs?v=1458d8543105';

export function mountPianoPlayer(root, options = {}) {
const mountAbort=new AbortController();let embeddedActive=false,taskHelpSticky=false,homeSettings=false;
const listenDocument=(name,fn,opts={})=>document.addEventListener(name,fn,{...opts,signal:mountAbort.signal});
const listenWindow=(name,fn,opts={})=>window.addEventListener(name,fn,{...opts,signal:mountAbort.signal});
const $ = selector => root.querySelector(selector);
const $$ = selector => [...root.querySelectorAll(selector)];
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const STORE = options.storageKey || 'flow-piano-flow-v1';
const micAsset=name=>{
 const base=new URL(options.assetBase||import.meta.url,import.meta.url),asset=new URL(name,base);
 const revision=new URL(import.meta.url).searchParams.get('v')||base.searchParams.get('v');
 if(revision&&name.endsWith('.mjs'))asset.searchParams.set('v',revision);
 return asset.href;
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const now = () => performance.now();
const defaults = { theme:'dark', accent:false, octave:0, sensitivity:60, voice:true, teacherVoice:'tanya', tempo:60, lesson:'joy', history:[],accompaniment:true,backingVolume:.25,input:'mic',cropKeys:true,notation:'falling',intros:true,metronome:true };
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function readStorage() {
  try {
    const v = options.initialState || JSON.parse(localStorage.getItem(STORE) || '{}');
    return { ...defaults, theme:v.theme === 'light' ? 'light' : 'dark', accent:v.accent === true,
      octave:[-1,0,1].includes(v.octave) ? v.octave : 0, sensitivity:Number.isFinite(v.sensitivity) ? clamp(v.sensitivity,1,100) : 60,
      voice:true, teacherVoice:readIntroVoice(v.teacherVoice), tempo:Number.isFinite(v.tempo) ? clamp(v.tempo,20,300) : 60,
      cropKeys:v.cropKeys!==false,notation:['falling','staff','both'].includes(v.notation)?v.notation:'falling',intros:true,metronome:typeof v.metronome==='boolean'?v.metronome:true,
      accompaniment:v.accompaniment!==false,backingVolume:Number.isFinite(v.backingVolume)?clamp(v.backingVolume,0,.8):.25,input:v.input==='midi'?'midi':'mic',
      lesson:LESSONS.some(l=>l.id===v.lesson) ? v.lesson : 'joy',
      resetAt:Number.isSafeInteger(v.resetAt)&&v.resetAt>=0&&v.resetAt<=8640000000000000?v.resetAt:0,
      microProgress:normalizeMicroProgress(v.microProgress),
      courseProgress:normalizeCourseProgress(v.courseProgress),
      compositionProgress:v.compositionProgress && typeof v.compositionProgress==='object' ? v.compositionProgress : {},
      studyProgress:v.studyProgress && typeof v.studyProgress==='object' && !Array.isArray(v.studyProgress) ? v.studyProgress : {},
      flowProgress:v.flowProgress&&typeof v.flowProgress==='object'&&!Array.isArray(v.flowProgress)?v.flowProgress:{},
      pendingFlow:v.pendingFlow&&typeof v.pendingFlow==='object'&&((typeof v.pendingFlow.courseId==='string'&&COURSE.some(l=>l.id===v.pendingFlow.courseId))||(typeof v.pendingFlow.compositionId==='string'&&typeof v.pendingFlow.stageId==='string'))?v.pendingFlow:null,
      history:Array.isArray(v.history) ? v.history.filter(h=>h && (LESSONS.some(l=>l.id===h.lesson)||COURSE.some(l=>l.id===h.lesson)||typeof h.title==='string') && Number.isFinite(h.at) && Number.isFinite(h.accuracy) && h.accuracy>=0 && h.accuracy<=100 && Number.isFinite(h.correct) && h.correct>=0 && h.correct<=5000 && Number.isFinite(h.seconds) && h.seconds>=0 && h.seconds<86400).slice(0,50) : [] };
  } catch { return { ...defaults, resetAt:0,microProgress:{},history:[],courseProgress:normalizeCourseProgress(null),compositionProgress:{},studyProgress:{},flowProgress:{} }; }
}
const settings = readStorage();
let introVoiceInventory=null;
function readIntroVoice(fallback){
  let stored;try{stored=localStorage.getItem(STORE+':intro-voice');}catch{}
  return ['tanya','mikhail'].includes(stored)?stored:['tanya','mikhail'].includes(fallback)?fallback:'tanya';
}
function introductionRecordings(){
  if(!introVoiceInventory)introVoiceInventory=Object.freeze(Object.fromEntries(COURSE.map(lesson=>[createLessonIntro(lesson).spoken,null])));
  const packs=globalThis.FLOW_PIANO_VOICE_PACKS,chosen=packs?.[settings.teacherVoice]?.clips;
  const clips=chosen&&typeof chosen==='object'?chosen:settings.teacherVoice==='tanya'?globalThis.FLOW_PIANO_VOICES:null;
  return {...introVoiceInventory,...(clips&&typeof clips==='object'?clips:{})};
}
function chooseIntroVoice(value){
  if(!['tanya','mikhail'].includes(value))return;
  teacher.cancel();settings.teacherVoice=value;
  try{localStorage.setItem(STORE+':intro-voice',value);}catch{toast('Не удалось сохранить голос на устройстве.');}
}
const state = { view:'course', session:null, source:'mic', running:false, phase:'idle', mic:false,
  heard:null, heardAt:0, signal:0, noiseFloor:0, countdown:0, preview:false, previewStep:null, saved:false,
  courseId:null,customLesson:null,mode:'learn',revealed:false,breakdown:false,sectionRange:null,lastReport:null,reviewText:'',compositionKey:null,compositionId:null,hand:'right',waiting:false,polyNeedsRelease:false,feedbackMessage:'',feedbackUntil:0,
  studyPlan:null,studyStageId:null,studyPhase:'right',studyPage:0,courseModule:null,libraryPage:0,historyPage:0,
  nativeFlow:false,intro:null,needsIntro:false,transitioning:false,courseBrowse:false,tempoAutomatic:true,flowPolish:false,flowNext:null,flowGoalReached:false,flowLastIndex:-1,learningTask:null,assisted:false,attemptId:null,taskPassed:false,
  microPlan:null,microStageId:null,microHelpLevel:0,microRevealed:false,microRepairId:null,microReturnId:null,courseEntryPending:false,supportHintUntil:0,performancePlan:null,attemptBpm:null };
let micContext=null, stream=null, analyser=null, micSource=null, audioBuffer=null, micGeneration=0,inputIdleTimer=0;
let micCapture=null,micSpeechPaused=false;
let animationFrame=0, lastFrame=0, countdownTimer=0, synthContext=null, playbackGeneration=0;
let playbackNodes=[],playbackTimers=[],previewTimeline=[],previewStartedAt=0,scoreFrame=0,gateUntil=0,toastTimer=0;
let follow=null,followKey='',practiceTimeline=[],backingPlayer=null,backingKey='',lastPolyFrame=0,inputGeneration=0;
let feedback=[],lastScoreFrame=0,keyFeedbackTimer=0,lastStageLabel='';
const earlyNotes=new EarlyInputBuffer(),noteEvidence=new Map();
let earlyPromptAt=-Infinity;
const polyInput=new PolyphonicInputGate();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let musicFontReady=false;
const musicFontPromise=document.fonts?document.fonts.load('40px Bravura','\uE050\uE0A4\uE243').then(fonts=>{musicFontReady=fonts.length>0;queueScore();return musicFontReady;}).catch(()=>false):Promise.resolve(false);
const noteGate = new PianoInputGate();
const midiInput=createMidiInput({onNote:midi=>processNote(midi,'midi'),onDisconnect:()=>{pausePractice();toast('Синтезатор отключён. Подключи его и нажми продолжить.');}});
let lessonGeneration=0,autoGeneration=0,autoTimer=0,keyboardRange=null,programmaticResultCloses=0,programmaticReplyCloses=0;
let presentationGeneration=0,transitionTimer=0,carouselFrame=0,pendingNative=null,fingerTimer=0;
const teacher=createTeacher({dependencies:{recordedVoices:introductionRecordings,...(options.teacherDependencies||{})},onStatus:(status,detail)=>{const node=$('#review-status');const label={thinking:'Преподаватель готовит ответ…',preparing:'Готовим голос…',speaking:'Преподаватель говорит…',listening:'Слушаю твой ответ…',transcribing:'Распознаём ответ…',unavailable:'Голос недоступен. Ответ остаётся на экране.'}[status];if(node&&label)node.textContent=label;}});
let postplayAction=null,postplayFeedback=null,postplayNextLabel='Продолжить';
const postplay=createPostplayCoach({teacher,voice:()=>settings.voice,
  isActive:()=>!document.hidden&&state.view==='practice'&&(!options.embedded||!options.isActive||options.isActive()),
  onUpdate:renderPostplay,onClose:()=>{state.transitioning=false;if(state.phase==='coaching')state.phase='idle';renderPractice();},
  onContinue:()=>{const action=postplayAction;postplayAction=null;action?.();},
  onRepeat:()=>{const action=state.practiceOutcome?.assessed&&state.practiceOutcome.primary.action==='repeat'?postplayAction:null;postplayAction=null;(action||repeatLearningTask)();},
  onRepair:()=>{const repair=postplayFeedback?.repair,offset=state.breakdown?(state.sectionRange?.start||0):0;postplayAction=null;if(state.microPlan&&state.microRepairId&&!state.breakdown){const target=state.microRepairId;state.microReturnId=state.microStageId;enterMicroStage(target);return;}if(repair)repeatProblemSection(false,{start:repair.start+offset,end:repair.end+offset});else repeatLearningTask();}
});
const presenter=createLessonPresenter({speak:text=>teacher.speak(text),cancelSpeech:()=>teacher.cancel(),onStopAudio:()=>stopPlayback(),
  prepareAudio:async()=>{const ctx=ensureSynth();if(!ctx)throw new Error('Audio unavailable');await ctx.resume();if(ctx.state!=='running')throw new Error('Audio suspended');},
  onAudioError:()=>{if(!state.intro)return;state.intro.audioBlocked=true;$('#intro-eyebrow').textContent='Включи звук для примера';$('#intro-skip').textContent='Послушать пример';},
  onDemoStart:(frames,lead)=>{const ctx=ensureSynth();if(!ctx)return;const start=ctx.currentTime+lead;for(const frame of frames)soundNote(frame.midi,start+frame.time,frame.duration);},
  onPhase:phase=>{if(state.intro){state.intro.phase=phase;$('#intro-eyebrow').textContent=phase==='explaining'?'Слушай объяснение':phase==='demonstrating'?'Смотри и слушай пример':'Готово';}},
  onFrame:frame=>{if(!state.intro)return;Object.assign(state.intro,frame);$('#intro-beat').textContent=frame.beat?String(frame.beat):'♪';$('#intro-beat').style.setProperty('--beat-progress',String(frame.beatProgress));highlightKeys();drawScore();},
  onFinish:()=>finishLessonIntro()
});
const lesson = () => {const selected=state.customLesson || COURSE.find(l=>l.id===state.courseId) || LESSONS.find(l=>l.id===settings.lesson) || LESSONS[0],base=state.learningTask?.notes?.length?{...selected,notes:state.learningTask.notes}:selected,micro=state.microPlan?.stages.find(s=>s.id===state.microStageId);return micro?{...base,notes:micro.notes,instruction:micro.instruction,introSpeech:micro.spoken||micro.instruction}:base;};
function presentation(){
  const display=policy=>state.studyPlan||state.performancePlan||state.microPlan?.song||state.courseId?.startsWith('v2-')?selectedPracticeDisplay(policy,state.courseId?.startsWith('v2-')&&lesson().practiceKind==='reading'?'staff':settings.notation):policy;
  if(state.courseId==='course-memory'&&state.mode==='flow'&&!state.breakdown)return {target:false,names:false,staff:false,falling:false,fingers:false,preview:false};if(state.performancePlan&&!state.breakdown)return display(state.performancePlan.stage.presentation);const micro=state.microPlan?.stages.find(s=>s.id===state.microStageId);if(micro)return display(resolveSupport(micro,{helpLevel:state.microHelpLevel,index:state.session?.index||0,afterPause:now()<state.supportHintUntil,independentRhythm:!state.courseId?.startsWith('v2-')&&state.learningTask?.kind==='rhythm'&&micro.assessment&&!state.microRevealed}));const stage=state.studyPlan?.stages.find(s=>s.id===state.studyStageId),raw=(!state.breakdown&&stage?.purpose==='independent'?stage.presentation:null)||(state.rhythmGuided?state.learningTask?.guidedPresentation:null)||state.learningTask?.presentation||lesson().hintPolicy;if(!raw)return null;const memory=['echo','recall'].includes(lesson().practiceKind),reading=lesson().practiceKind==='reading';return display({target:state.mode==='check'?false:raw.target??true,names:state.mode==='check'?false:raw.names??true,preview:raw.preview??true,staff:raw.staff??(!memory&&(reading||settings.notation!=='falling')),falling:raw.falling??(!memory&&!reading&&settings.notation!=='staff')});}
function flowPassPercent(){return state.learningTask?.kind==='rhythm'||state.microPlan?.stages.find(s=>s.id===state.microStageId)?.assessment&&state.mode==='flow'||!state.breakdown&&state.studyPlan?.stages.find(s=>s.id===state.studyStageId)?.purpose==='independent'?80:60;}
function strictMemory(){const p=presentation();return !!p&&p.target===false&&p.staff===false&&p.falling===false&&!state.intro&&!state.preview;}
function markAssisted(){state.assisted=true;state.session?.markAssisted();if(state.learningTask||state.microPlan?.stages.find(s=>s.id===state.microStageId)?.assessment||state.studyPlan?.stages.find(s=>s.id===state.studyStageId)?.purpose==='independent')taskHelpSticky=true;if(state.learningTask)options.onAssistance?.(state.learningTask);}
function emitLearningReport(report,beta=false){if(!state.learningTask||state.source==='demo'||report.demo===true||state.learningTask.kind==='song'&&lesson().availableHands?.includes('both')&&state.hand!=='both')return;const p=presentation();options.onReport?.({task:state.learningTask,report,attemptId:state.attemptId,mode:state.mode,source:state.source,assisted:taskHelpSticky||state.assisted||report.assisted===true,cueVisible:p?!!(p.target||p.staff||p.falling):true,beta,breakdown:state.breakdown,hand:state.hand});taskHelpSticky=false;}
function finishDailyTask(){const task=state.learningTask;closeResult();pausePractice({keepInput:true});stopPlayback();state.learningTask=null;options.onTaskComplete?.(task);}
const microView=createMicrostepView(root,{onHelp:helpMicroLesson,onSkip:skipMicroStage,onRepeat:repeatLearningTask});
function microStage(){return state.microPlan?.stages.find(stage=>stage.id===state.microStageId)||null;}
function practiceFingering(){
  const material=lesson(),stage=microStage(),key=[lessonGeneration,state.courseId,state.compositionId,state.studyStageId,state.microStageId,settings.octave,state.hand].join(':');
  if(state.fingerPlanCache?.key!==key||state.fingerPlanCache.notes!==material.notes)state.fingerPlanCache={key,notes:material.notes,plan:createPracticeFingering(material,{stage,sourceLessonId:state.courseId||state.compositionId,hand:state.hand,octave:settings.octave})};
  return state.fingerPlanCache.plan;
}
function currentFingerCue(reason='start'){
  const index=(state.session?.index||0)+(state.breakdown?(state.sectionRange?.start||0):0);
  return selectPracticeFingerCue(practiceFingering(),{index,reason});
}
function teachingPhrase(phrase,offset=0){
  if(state.hand!=='both'||phrase.every(note=>note.hand==='right'||note.hand==='left'))return phrase;
  const plan=practiceFingering(),cache=state.teachingPhraseCache;if(!plan)return phrase;
  if(cache?.phrase===phrase&&cache.plan===plan&&cache.offset===offset)return cache.notes;
  const annotated=phrase.map((note,index)=>note.hand?note:{...note,...(plan.notes[index+offset]?.hand?{hand:plan.notes[index+offset].hand}:{})});
  state.teachingPhraseCache={phrase,plan,offset,notes:annotated};return annotated;
}
function microLevel(stage){return supportLevel(stage);}
function rememberMicro(change={}){
  if(!state.microPlan)return;
  const previous=getMicroRun(settings.microProgress,state.microPlan);
  settings.microProgress=updateMicroRun(settings.microProgress,state.microPlan,{stageId:state.microStageId,helpLevel:state.microHelpLevel,at:Math.min(8640000000000000,Math.max(Date.now(),previous.at+1)),...change});persist();
}
function clearMicroLesson(){state.microPlan=null;state.microStageId=null;state.microRevealed=false;state.microRepairId=null;state.microReturnId=null;state.courseEntryPending=false;}
function beginCourseEntry(){
  if(state.courseId?.startsWith('v2-'))return false;
  if(!settings.intros||!isCourse()||state.microPlan||state.studyStageId||state.learningTask&&state.learningTask.kind!=='new')return false;
  if(isCompactFoundationLesson(COURSE.find(item=>item.id===state.courseId)))return false;
  const run=settings.microProgress?.[state.courseId],progress=settings.courseProgress?.lessons?.[state.courseId];
  if(run&&(run.at>0||run.completed?.length||run.skipped?.length)||progress&&(progress.attempts>0||progress.passed===true))return false;
  state.courseEntryPending=true;startLessonIntro();return true;
}
function beginMicroLesson(){
  if(!state.courseId?.startsWith('v2-')&&state.learningTask&&state.learningTask.role!=='new'&&state.learningTask.kind!=='new')return false;
  const learned=normalizeLearningProgress(options.getLearningProgress?.()||options.initialState?.learningProgress||settings.learningProgress);
  const current=lesson(),earned=COURSE.filter(item=>settings.courseProgress.lessons[item.id]?.passed===true||learned.lessons[item.id]?.readingBest>=8||learned.lessons[item.id]?.timedBest>=80||learned.lessons[item.id]?.recallBest>=8).map(item=>item.id),saved=settings.flowProgress[current.id]?.mixedSourceId;
  const knownLessonIds=saved&&(saved===current.id||earned.includes(saved))?[saved]:earned;
  const plan=createMicroLesson(current,{kind:state.learningTask?.kind||'new',knownLessonIds});
  if(!plan.authored)return false;
  const mixed=plan.stages.find(stage=>stage.id==='mixed-familiar')?.goal.sourceLessonId;
  if(mixed)settings.flowProgress[current.id]={...settings.flowProgress[current.id],mixedSourceId:mixed};
  state.microPlan=plan;const run=getMicroRun(settings.microProgress,plan);
  enterMicroStage(run.stageId,{present:run.at===0&&!run.completed.length&&!run.skipped.length,resume:run.at>0});return true;
}
function beginSongMicroLesson(){
  const stage=state.studyPlan?.stages.find(item=>item.id===state.studyStageId);
  if(!stage||isStudyStageComplete(state.studyPlan,studyProgress(),stage.id))return false;
  const plan=createSongMicroLesson(state.studyPlan,stage);if(!plan)return false;
  state.microPlan=plan;const run=getMicroRun(settings.microProgress,plan);
  enterMicroStage(run.stageId,{present:run.at===0&&!run.completed.length&&!run.skipped.length,resume:run.at>0});return true;
}
function enterMicroStage(id,{present=false,resume=false}={}){
  const stage=state.microPlan?.stages.find(item=>item.id===id);if(!stage)return;
  pausePractice({keepInput:true});stopPlayback();closeResult();pendingNative=null;
  state.microStageId=id;const run=getMicroRun(settings.microProgress,state.microPlan),level=microLevel(stage);
  state.microHelpLevel=resume?run.helpLevel:level;state.microRevealed=state.microHelpLevel<level;
  state.mode=stage.mode;state.breakdown=false;state.sectionRange=null;state.session=null;state.saved=false;state.revealed=state.microRevealed&&state.microHelpLevel<=1;state.supportHintUntil=resume?now()+3200:0;
  state.quickStart=true;state.needsIntro=false;state.rhythmGuided=stage.mode==='flow'&&!!stage.presentation.target;
  state.source=settings.input;state.assisted=false;state.microRepairId=null;
  if(state.microRevealed&&stage.assessment)markAssisted();
  resetFollow();rememberMicro();coach(stage.instruction);renderPractice();
  const listening=stage.presentation.preview&&!stage.presentation.staff&&!stage.presentation.falling&&!stage.assessment;
  const orientation=present&&stage.purpose==='orient'&&!stage.assessment&&settings.intros;
  if(listening||orientation||present&&stage.spoken&&stage.presentation.preview&&!stage.assessment&&settings.intros)startLessonIntro();
  else startPractice().catch(()=>failMic({}));
}
function microCue(){
  const stage=microStage(),policy=presentation(),index=state.session?.index||0;
  if(!stage||!policy||state.intro||!state.microRevealed&&stage.assessment||index>=notes().length)return null;
  const source=lesson().notes[index],midi=source?.midi+settings.octave*12;if(!Number.isInteger(midi))return null;
  const staff=policy.staff&&(policy.names||policy.target||policy.fingers),hand=source.hand||(lesson().hand==='Левая рука'?'left':'right');
  const candidate=policy.fingers?currentFingerCue('transition'):null;
  const finger=candidate&&(index===0||now()<state.supportHintUntil||candidate.movement||stage.transitionIndices?.includes(index))?candidate:null;
  const position=finger?.movement?.to||finger?.position,keyName=value=>{const key=noteInfo(value);return key.name+key.octave;};
  const preparation=position?`${finger.movement?.at>index?'После этой ноты: ':finger.movement?'Перенос: ':''}${finger.hand==='left'?'Левая':'Правая'}: 1 — ${keyName(position.thumbMidi)}, 5 — ${keyName(position.littleMidi)}.`:'';
  if(!staff&&!finger&&!policy.target&&!policy.names)return null;
  const assignedHand=finger?.hand||practiceFingering()?.notes[index]?.hand||hand;
  return {midi,name:noteInfo(midi).name,showName:policy.names||policy.target,hand:assignedHand,...(staff?{staffText:describeStaffPosition(midi,{clef:assignedHand==='left'?'bass':'treble'}).text}:{}),
    ...(finger?{finger:finger.finger,position:finger.position?.text,preparation,suggested:finger.label==='Предложенная аппликатура'}:{})};
}
function renderMicroLesson(){
  const stage=microStage(),visible=!!stage&&state.view==='practice'&&!state.breakdown,cue=visible?microCue():null;
  const instruction=[cue?.suggested?'Предложенная аппликатура.':'',cue?.preparation,stage?.instruction].filter(Boolean).join(' ');
  const route=state.microPlan?.route?.stageIds,routeIndex=route?.indexOf(stage?.id),primary=routeIndex>=0;
  microView.render({visible,title:stage?.title||'',instruction,index:primary?routeIndex:state.microPlan?.stages.indexOf(stage)||0,total:primary?route.length:state.microPlan?.stages.length||0,
    helpLabel:stage?supportLabel(stage,state.microHelpLevel):'',
    cue,allowSkip:!!stage&&!stage.assessment,allowHelp:!!stage&&!state.intro,phase:state.session?.finished?'complete':cue?.finger&&now()<state.supportHintUntil?'ready':state.running&&state.session?.index>0?'playing':'ready'});
  const panel=$('.practice-panel');panel.classList.toggle('microlearning',visible);
  if(stage){panel.dataset.microStage=stage.id;panel.dataset.microPurpose=stage.purpose;}else{delete panel.dataset.microStage;delete panel.dataset.microPurpose;}
}
function helpMicroLesson(){
  const stage=microStage();if(!stage)return;
  state.microRevealed=true;state.microHelpLevel=nextHelpLevel(stage,state.microHelpLevel);state.revealed=state.microHelpLevel<=1;state.supportHintUntil=now()+3200;state.assisted=true;state.session?.markAssisted();
  if(stage.assessment)markAssisted();rememberMicro();renderPractice();showFingerHint('resume');
  coach('Посмотри на опору. После подсказки можно спокойно повторить самостоятельно.',true);
}
function skipMicroStage(){
  const stage=microStage();if(!stage||stage.assessment)return;
  const primary=state.microPlan.route?.stageIds,at=primary?.indexOf(stage.id);
  const id=primary?(at>=0?primary[at+1]:'whole'):state.microPlan.stages[state.microPlan.stages.indexOf(stage)+1]?.id;
  const next=state.microPlan.stages.find(item=>item.id===id);if(!next)return;
  rememberMicro({stageId:next.id,skippedStageId:stage.id,helpLevel:microLevel(next)});enterMicroStage(next.id);
}
function canonicalMicroCoverage(stage){
  const original=state.learningTask?.notes||COURSE.find(item=>item.id===state.courseId)?.notes;
  return stage.coverage===true&&Array.isArray(original)&&JSON.stringify(stage.notes)===JSON.stringify(original);
}
/** Only a real full-score stage can reach the existing course evidence pipeline. */
function completeMicroPractice(report,{beta=false,demo=false}={}){
  const stage=microStage();if(!stage||state.breakdown)return false;
  const independent=!state.assisted&&!taskHelpSticky&&!report.assisted&&!beta&&!demo;
  const pass=report.finished&&!report.earlyAbort&&report.firstAttemptCorrect*10>=report.total*8;
  const repairReport=settings.octave?{...report,errors:(report.errors||[]).map(error=>({...error,
    expected:Number.isInteger(error.expected)?error.expected-settings.octave*12:error.expected,
    ...(Number.isInteger(error.heard)?{heard:error.heard-settings.octave*12}:{}),
    ...(Number.isInteger(error.played)?{played:error.played-settings.octave*12}:{})}))}:report;
  if(stage.assessment){
    if(pass&&independent)rememberMicro({completedStageId:stage.id});
    else state.microRepairId=state.microPlan.song?null:chooseMicroRepair(state.microPlan,stage.id,repairReport)?.id||null;
    if(!state.learningTask&&!demo&&!beta)taskHelpSticky=false;
    return false;
  }
  keepInputWarm();hideFingerHint();state.session.pause(now());state.running=false;state.phase='idle';state.lastReport=report;
  if(demo){coach('Это экранный показ. Сыграй на синтезаторе, чтобы продолжить занятие.');renderPractice();return true;}
  const coverage=canonicalMicroCoverage(stage);
  if(coverage)emitLearningReport(report,beta);
  const demonstrated=coverage&&stage.mode==='check'&&stage.presentation.preview&&state.assisted;
  const ready=demonstrated?report.finished&&!report.earlyAbort&&report.correct===report.total&&!report.skipped:
    coverage||stage.mode!=='learn'?pass:report.finished&&report.correct===report.total;
  const nextId=state.microReturnId||(state.microPlan.route?chooseMicroNext(state.microPlan,stage.id,report):state.microPlan.stages[state.microPlan.stages.indexOf(stage)+1]?.id);
  if(ready&&nextId){
    const next=state.microPlan.stages.find(item=>item.id===nextId);state.microReturnId=null;
    rememberMicro({completedStageId:stage.id,stageId:next.id,helpLevel:microLevel(next)});
    const action=()=>enterMicroStage(next.id,{present:!!next.spoken&&next.purpose==='orient'});
    if(report.errors?.length)postplayTransition(report,action,{nextLabel:'Дальше'});
    else nativeTransition(next.instruction,action,{voice:false,delay:180});
  }else{
    state.microRepairId=state.microPlan.song?null:chooseMicroRepair(state.microPlan,stage.id,repairReport)?.id||null;
    postplayTransition(report,repeatLearningTask,{nextLabel:'Повторить место'});
  }
  renderPractice();return true;
}
let lastPulse=-Infinity;
function pulse(playhead){
  if(!state.running||state.mode!=='flow'){lastPulse=-Infinity;$('#practice-pulse').hidden=true;return;}
  if(strictMemory()){const pre=playhead<0;$('#recall-cover').classList.toggle('counting',pre);$('#recall-cover span').textContent=pre?'Приготовься':`Счёт: ${((Math.floor(playhead/(60/settings.tempo))%4)+4)%4+1}`;}
  const beat=60/settings.tempo,n=Math.floor(playhead/beat),phase=(playhead/beat)-n,node=$('#practice-pulse');node.hidden=false;node.classList.toggle('on',phase<.16);
  if(n===lastPulse)return;lastPulse=n;
  if(!settings.metronome||phase>.2||document.hidden)return;const ctx=ensureSynth();if(!ctx)return;
  const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.018),ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
  const click=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();click.buffer=buffer;filter.type='highpass';filter.frequency.value=3000;gain.gain.value=n%4===0?.09:.05;click.connect(filter);filter.connect(gain);gain.connect(ctx.destination);click.onended=()=>{click.disconnect();filter.disconnect();gain.disconnect();};click.start();
}
const isCourse = () => !!state.courseId;
const notes = () => (state.breakdown ? lesson().notes.slice(state.sectionRange?.start||0,state.sectionRange?.end||3) : lesson().notes).map(n=>({ ...n, midi:n.midi+settings.octave*12 }));
const expected = () => state.session && !state.session.finished ? state.session.expected : state.session?.finished ? null : notes()[0].midi;
const expectedNotes=()=>state.session?.expectedNotes??(expected()===null?[]:[expected()]);
const minRms = () => .001 * 2 ** ((60-settings.sensitivity)/30);
const durationText = seconds => `${Math.floor(seconds/60)}:${String(Math.round(seconds%60)).padStart(2,'0')}`;
function persist() { settings.voiceV2=settings.voice;try { localStorage.setItem(STORE,JSON.stringify(settings));options.onStateChange?.(JSON.parse(JSON.stringify(settings)));return true; } catch { toast('Не удалось сохранить прогресс на устройстве. Освободи место и попробуй ещё раз.');return false; } }
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent=message; $('#toast').hidden=false; toastTimer=setTimeout(()=>$('#toast').hidden=true,4500); }
function say(text) {
  if (!settings.voice || state.running) return;
  teacher.speak(text).catch(()=>{});
}
function coach(text, voice=false) { $('#coach-text').textContent=text; if(voice) say(text); }
function micMessage(text, error=false) { $('#mic-message').textContent=text; $('#mic-message').classList.toggle('error',error); }
function resetDetector() { noteGate.reset();polyInput.reset();state.polyNeedsRelease=false;noteEvidence.clear();lastPolyFrame=0; }
function resetFollow(){follow?.pause(now());follow=null;followKey='';practiceTimeline=[];backingPlayer?.stop();backingKey='';state.waiting=false;$('.practice-panel')?.classList.remove('waiting');state.feedbackMessage='';state.feedbackUntil=0;feedback=[];earlyNotes.clear();}
function ensureFollow(){
  if(state.mode==='flow'&&state.session instanceof TimedSession){
    practiceTimeline=state.session.timeline;
    return {tick:time=>state.session.tick(time),play:time=>state.session.resume(time),pause:time=>state.session.pause(time),seekIndex:()=>{},get value(){return state.session.value;},get running(){return state.session.running;},waiting:false};
  }
  const phrase=notes(),key=[lessonGeneration,settings.tempo,settings.octave,state.breakdown,phrase.length].join(':');
  if(key!==followKey){
    backingPlayer?.stop();backingKey='';
    practiceTimeline=createScoreTimeline(phrase,{tempo:settings.tempo,preserveTiming:!!lesson().preserveTiming,sourceTempo:lesson().sourceTempo||lesson().tempo||60});
    follow=new FollowTransport(practiceTimeline,{index:state.session?.index||0,leadIn:state.activePolicy?.leadIn??.65,now:now()});followKey=key;
  }
  return follow;
}
function syncBacking(time,moving,gate){
  if(!moving&&!backingPlayer)return;
  if(!state.breakdown&&state.studyPlan?.stages.find(s=>s.id===state.studyStageId)?.purpose==='independent'){backingPlayer?.stop();return;}
  if(!state.customLesson?.backing?.length||!settings.accompaniment){backingPlayer?.stop();return;}
  const key=[lessonGeneration,settings.tempo,settings.octave,state.breakdown,state.sectionRange?.start,state.sectionRange?.end].join(':');
  if(backingKey!==key){const ctx=ensureSynth();if(!ctx)return;backingPlayer?.dispose();backingPlayer=createAccompanimentPlayer(ctx);const events=state.breakdown&&state.sectionRange?sectionBacking(state.customLesson.backing,lesson().notes,state.sectionRange):state.customLesson.backing;backingPlayer.load(events,{tempo:settings.tempo,sourceTempo:state.customLesson.tempo||60,octave:settings.octave});backingKey=key;}
  backingPlayer.setVolume(settings.backingVolume);backingPlayer.sync(time,{moving,gate});
}
function queueScore(){if(!scoreFrame&&state.view==='practice')scoreFrame=requestAnimationFrame(()=>{scoreFrame=0;drawScore();});}
function startLessonIntro(){
  if(options.embedded&&options.isActive&&!options.isActive())return;
  embeddedActive=true;
  $('#intro-skip').textContent='Сразу играть';
  teacher.unlock().catch(()=>{});ensureSynth();pausePractice({keepInput:true});stopPlayback();
  if(state.view!=='practice')return;
  const courseEntry=state.courseEntryPending&&isCourse()&&!state.microPlan;
  const requiredListening=state.microPlan&&presentation()?.preview&&strictMemory();
  if(!settings.intros&&!requiredListening){state.needsIntro=false;if(courseEntry){state.courseEntryPending=false;if(beginMicroLesson())return;}startPractice().catch(()=>failMic({}));return;}
  const notationGuide=state.learningTask?.kind==='reading'?createNotationGuide(lesson(),{octave:settings.octave}):null;
  const orientation=state.microPlan&&microStage()?.purpose==='orient'&&!microStage().assessment;
  if(!courseEntry&&state.learningTask&&presentation()?.preview===false&&!notationGuide&&!orientation){state.needsIntro=false;state.phase='idle';nativeTransition(state.learningTask.kind==='recall'?'Вспомни рисунок без примера и подсказок.':lesson().instruction,()=>startPractice().catch(()=>failMic({})));return;}
  if(notes().some(n=>n.midi<36||n.midi>96)){toast('Ноты этого фрагмента выходят за диапазон Casio CT-S200.');return;}
  const stage=state.studyPlan?.stages.find(s=>s.id===state.studyStageId);
  const introLesson=isCourse()?{...lesson(),tempo:settings.tempo}:lesson();
  if(state.hand==='both')introLesson.notes=teachingPhrase(introLesson.notes);
  if(orientation&&isCourse()){
    const original=COURSE.find(item=>item.id===state.courseId);
    if(original?.introSpeech)introLesson.introSpeech=original.introSpeech;else delete introLesson.introSpeech;
  }
  const plan=courseEntry?createLessonIntro({...COURSE.find(item=>item.id===state.courseId),tempo:settings.tempo},{kind:'course',octave:settings.octave}):notationGuide||createLessonIntro(introLesson,{kind:state.studyStageId?'composition':'course',hand:state.hand,part:stage?.part||1,whole:stage?.whole||false,octave:settings.octave,complete:!!requiredListening||!!state.learningTask&&['rhythm','recall'].includes(state.learningTask.kind)});
  if(orientation&&microStage().spoken)plan.spoken=microStage().spoken;
  if(state.learningTask?.kind==='rhythm')plan.showNotation=false;
  state.needsIntro=true;state.intro={...plan,courseEntry:courseEntry?lessonGeneration:null,active:[],playhead:-.65,index:0};state.phase='intro';
  $('#intro-title').textContent=stage?`${lesson().hand} · ${studyStageLabel(stage)}`:plan.subtitle;$('#intro-text').textContent=plan.spoken;renderPractice();
  const intro=state.intro,token=presentationGeneration;musicFontPromise.then(()=>{if(state.intro!==intro||token!==presentationGeneration)return;presenter.play(plan,{voice:settings.voice&&settings.intros}).catch(()=>{if(state.intro===intro)skipLessonIntro();});});
}
function finishLessonIntro(){
  if(!state.intro)return;
  const entry=state.intro.courseEntry,continueMicro=entry!==null&&entry!==undefined&&state.courseEntryPending;
  state.intro=null;state.needsIntro=false;state.phase='idle';renderPractice();
  if(continueMicro){
    state.courseEntryPending=false;
    if(entry!==lessonGeneration||state.view!=='practice'||options.embedded&&options.isActive&&!options.isActive())return;
    if(beginMicroLesson())return;
  }
  startPractice().catch(()=>failMic({}));
}
function skipLessonIntro(){presenter.cancel();finishLessonIntro();}
function nativeTransition(text,action,{voice=true,delay=voice?420:180}={}){
  if(options.embedded&&options.isActive&&!options.isActive())return;
  clearTimeout(transitionTimer);
  const token=++presentationGeneration;state.transitioning=true;state.phase='coaching';pendingNative={lesson:lessonGeneration,run:action};
  $('#stage-transition').textContent=text;$('#stage-transition').hidden=false;renderPractice();
  (async()=>{if(settings.voice&&voice){let watchdog;try{await Promise.race([teacher.speak(text),new Promise(resolve=>{watchdog=setTimeout(()=>{if(token===presentationGeneration)teacher.cancel();resolve(false);},6500);transitionTimer=watchdog;})]);}catch{}finally{clearTimeout(watchdog);if(transitionTimer===watchdog)transitionTimer=0;}}if(token!==presentationGeneration||document.hidden||state.view!=='practice')return;
    transitionTimer=setTimeout(()=>{if(token!==presentationGeneration||document.hidden||state.view!=='practice')return;state.transitioning=false;state.phase='idle';$('#stage-transition').hidden=true;const next=pendingNative;pendingNative=null;if(next?.lesson===lessonGeneration)next.run();},delay);
  })().catch(()=>{});
}
function renderPostplay(view){
  const panel=$('#postplay-coach');if(!panel)return;
  if(view.open){state.running=false;state.phase='coaching';state.transitioning=true;}
  panel.hidden=!view.open;panel.dataset.state=view.state||'idle';
  const outcome=state.practiceOutcome;
  panel.dataset.outcome=outcome?.status||'';
  if(outcome){$('#postplay-title').textContent=outcome.title;$('#postplay-score').textContent=outcome.showScore?`${outcome.percent}%`:'';$('#postplay-score').hidden=!outcome.showScore;}
  $('#postplay-advice').textContent=view.advice||outcome?.description||'';$('#postplay-status').textContent=view.status||'';
  $('#postplay-question').hidden=!view.question;
  $('#postplay-question-label').textContent=typeof view.question==='string'?view.question:'Всё понятно?';
  $('#postplay-repair').hidden=!view.repair||outcome?.status==='skipped'||outcome?.status==='input-problem';
  const next=!!postplayAction&&outcome?.primary.action==='next';
  $('#postplay-next').hidden=!next;$('#postplay-next').textContent='Дальше';
  $('#postplay-repeat').hidden=false;$('#postplay-repeat').classList.toggle('primary-button',!next);$('#postplay-repeat').classList.toggle('secondary-button',next);
  $('#postplay-reply').hidden=!view.reply;$('#postplay-reply').textContent=view.reply||'';
  $('#postplay-voice').hidden=!!view.recording;$('#postplay-stop-voice').hidden=!view.recording;
}
function returnToCourse(){pausePractice();stopPlayback();closeResult();navigate(state.compositionId?'library':'course');}
function skipExercise(){
  if(state.view!=='practice'||state.practiceOutcome?.status==='skipped'&&!$('#postplay-coach').hidden)return;
  const task=state.learningTask,material=lesson(),study=state.studyPlan,stageId=state.studyStageId;
  const activity={key:state.compositionId?`song:${state.compositionId}:${stageId||'whole'}`:`course:${state.courseId||material.id}`,status:'skipped',at:Date.now(),lessonId:state.courseId,compositionId:state.compositionId,stageId:stageId||state.microStageId,title:material.title};
  pausePractice({keepInput:true});stopPlayback();closeResult();
  if(!recordPracticeActivity(localStorage,STORE,activity))toast('Не удалось сохранить пропуск. Можно повторить сохранение.');
  state.practiceOutcome=practiceOutcome({skipped:true});
  postplayAction=()=>{if(task&&options.onTaskSkip){state.learningTask=null;options.onTaskSkip(task,activity);return;}
    if(study&&stageId){const index=study.stages.findIndex(s=>s.id===stageId),next=study.stages[index+1];if(next){startStudyStage(next.id);return;}}
    returnToCourse();};
  postplayFeedback=null;postplayNextLabel='Дальше';
  postplay.show({feedback:{valid:false,text:state.practiceOutcome.description,askUnderstanding:false},lesson:{id:material.id,title:material.title},report:null,autoContinue:false}).catch(()=>{});
}
function inputProblem(report){
  if(state.source!=='mic'||!report?.finished||!state.inputInterrupted&&(report.correct>0||report.wrong>0))return false;
  pausePractice({keepInput:true});stopPlayback();closeResult();state.practiceOutcome=practiceOutcome({report,inputIssue:true});
  if(state.inputInterrupted){state.practiceOutcome.title='Проверка прервана';state.practiceOutcome.description='Слышна речь или помеха. Эта попытка без оценки — повторим в тишине.';}
  if(typeof localStorage!=='undefined')recordPracticeActivity(localStorage,STORE,{key:state.compositionId?`song:${state.compositionId}:${state.studyStageId||'whole'}`:`course:${state.courseId||lesson().id}`,status:'input-problem',at:Date.now(),lessonId:state.courseId,compositionId:state.compositionId,stageId:state.studyStageId||state.microStageId,title:lesson().title});
  postplayAction=repeatLearningTask;postplayFeedback=null;
  postplay.show({feedback:{valid:false,text:state.practiceOutcome.description,askUnderstanding:false},lesson:{id:lesson().id,title:lesson().title},report,autoContinue:false}).catch(()=>{});return true;
}
function postplayTransition(report,action,{autoContinue=true,nextLabel='Продолжить',allowNext=action!==repeatLearningTask}={}){
  if(state.source==='demo'||report?.demo||!report?.finished)return false;
  const stage=state.studyPlan?.stages.find(s=>s.id===state.studyStageId),beta=state.source==='mic'&&!!(lesson().polyphonic||stage?.requiresMidi);
  const feedback=createCoachFeedback({lesson:lesson(),notes:state.session?.notes||notes(),report,mode:state.mode,source:state.source,stage,assisted:state.assisted||report.assisted===true,beta,breakdown:state.breakdown});
  if(state.performancePlan&&!state.breakdown&&state.performanceNotice&&!feedback.creditNotice){feedback.creditNotice=state.performanceNotice;feedback.text=(feedback.text.match(/^[^.!?]+[.!?]?/u)?.[0]||feedback.text)+' '+state.performanceNotice;}
  if(!feedback.valid){nativeTransition(feedback.text,repeatLearningTask,{voice:true});return true;}
  if(state.microPlan?.route?.seamless){feedback.askUnderstanding=false;feedback.question=null;}
  if(autoContinue&&!feedback.askUnderstanding&&feedback.kind!=='no-input'&&microStage()&&!microStage().assessment){
    postplay.cancel();closeResult();follow?.pause(now());backingPlayer?.stop();hideFingerHint();
    const correction=report.wrong>0||report.skipped>0||report.earlyAbort||state.assisted||report.assisted;
    nativeTransition(feedback.text,action,{voice:!!correction,delay:correction?650:550});return true;
  }
  closeResult();follow?.pause(now());backingPlayer?.stop();teacher.cancel();hideFingerHint();
  ++presentationGeneration;clearTimeout(transitionTimer);pendingNative=null;$('#stage-transition').hidden=true;
  state.running=false;state.phase='coaching';state.transitioning=true;postplayAction=action;postplayFeedback=feedback;postplayNextLabel=nextLabel;
  state.practiceOutcome=practiceOutcome({report,source:state.source,assisted:state.assisted||taskHelpSticky||report.assisted,beta,step:!!microStage()&&!microStage().assessment,allowNext,passPercent:state.mode==='flow'?flowPassPercent():80});
  if(typeof localStorage!=='undefined'&&!state.breakdown&&(!microStage()||microStage().assessment))recordPracticeActivity(localStorage,STORE,{key:state.compositionId?`song:${state.compositionId}:${state.studyStageId||'whole'}`:`course:${state.courseId||lesson().id}`,status:state.practiceOutcome.status,at:Date.now(),lessonId:state.courseId,compositionId:state.compositionId,stageId:state.studyStageId||state.microStageId,title:lesson().title});
  $('#postplay-title').textContent=state.practiceOutcome.title;
  const contextLesson={id:lesson().id,title:lesson().title,instruction:JSON.stringify(feedback.llmContext).slice(0,1000)};
  const contextReport={...report,mode:state.mode,source:state.source,assisted:state.assisted||report.assisted===true,beta,askUnderstanding:feedback.askUnderstanding};
  renderPractice();postplay.show({feedback,lesson:contextLesson,report:contextReport,autoContinue:false}).catch(()=>{});
  return true;
}
function checkCurrentCourse(){pausePractice({keepInput:true});stopPlayback();state.quickStart=true;state.mode='check';state.session=null;state.saved=false;state.revealed=false;state.needsIntro=false;resetFollow();renderPractice();startPractice().catch(()=>failMic({}));}
function baseLearningTempo(){const stage=state.studyPlan?.stages.find(s=>s.id===state.studyStageId);return chooseLearningTempo(lesson(),{kind:isCourse()?'course':'composition',hand:state.hand,whole:stage?.whole||(!isCourse()&&!state.studyStageId)});}
function tempoProgressKey(){return state.compositionKey||state.courseId||lesson().id;}
function startPerformance(){
  const parent=state.studyPlan?.stages.find(stage=>stage.id===state.studyStageId);
  if(!parent?.whole||parent.purpose!=='independent'||state.breakdown)return false;
  const key=tempoProgressKey(),old=settings.flowProgress[key]||{};
  const plan=createPerformancePlan({...lesson(),id:state.compositionId,notes:parent.notes,sourceTempo:parent.sourceTempo},{hand:state.hand,progress:old.performance,sourceFingerprint:state.studyPlan.sourceFingerprint});
  if(!plan.supported){toast('Исходный темп этой записи вне диапазона 20–300. Самостоятельный разбор сохранён.');return false;}
  pausePractice({keepInput:true});stopPlayback();closeResult();if(state.microPlan)clearMicroLesson();
  state.performancePlan=plan;state.performanceNotice=null;state.mode='flow';state.flowGoalReached=false;state.flowPolish=false;state.flowNext={kind:'library'};state.needsIntro=false;state.quickStart=true;state.session=null;state.saved=false;state.revealed=false;state.assisted=false;taskHelpSticky=false;state.source=settings.input;
  settings.flowProgress[key]={...old,performance:plan.progress,at:Date.now()};settings.tempo=plan.currentBpm;state.tempoAutomatic=true;
  settings.pendingFlow={compositionId:state.compositionId,stageId:state.studyStageId,studyVersion:state.studyPlan.version,performance:true,polish:false,goalReached:false};
  $('#tempo').value=settings.tempo;$('#tempo-value').value=settings.tempo;resetFollow();persist();coach(plan.stage.instruction);renderPractice();startPractice().catch(()=>failMic({}));return true;
}
function completePerformance(report,{demo=false,beta=false}={}){
  if(!state.performancePlan||state.breakdown)return false;
  const key=tempoProgressKey(),old=settings.flowProgress[key]||{},plan=state.performancePlan;
  const result=advancePerformanceTempo(plan.progress,report,{source:state.source,actualBpm:state.attemptBpm,sourceFingerprint:plan.sourceFingerprint,whole:true,purpose:'performance',hand:state.hand,assisted:state.assisted||taskHelpSticky,answerShown:state.revealed,beta,demo});
  const passed=result.reason==='source-tempo-passed',qualified=result.reason==='speed-up'||passed;
  state.performanceNotice=passed?`Вся песня сыграна в исходном темпе: ${plan.sourceBpm} ударов в минуту.`:qualified?`Теперь попробуем ${result.bpm} из ${plan.sourceBpm} ударов в минуту.`:result.reason==='slow-down'?`Повторим медленнее: ${result.bpm} ударов в минуту.`:null;
  state.running=false;state.phase='idle';state.lastReport=report;state.flowGoalReached=passed;
  if(!demo){settings.flowProgress[key]={...old,performance:result.progress,at:Date.now()};
    settings.history.unshift({lesson:state.compositionId,title:lesson().title+' · '+state.attemptBpm+' BPM',at:Date.now(),accuracy:report.scorePercent,correct:report.firstAttemptCorrect,seconds:report.seconds,metric:report.metric,kind:beta?'beta':'performance',score:report.scoreOutOf10});settings.history=settings.history.slice(0,50);}
  if(settings.pendingFlow)settings.pendingFlow.goalReached=passed;
  taskHelpSticky=false;state.saved=!demo;persist();
  $('#result-title').textContent=passed?'Сыграно в исходном темпе':qualified?'Темп освоен':beta?'Практика без зачёта':'Закрепим этот темп';$('#result-subtitle').textContent=lesson().title;
  $('#result-accuracy').textContent=beta?'Без зачёта':report.scorePercent+'%';$('#result-correct').textContent=report.firstAttemptCorrect+'/'+report.total;$('#result-time').textContent=durationText(report.seconds);
  $('#result-advice').textContent=passed?'Вся песня сыграна самостоятельно в исходном темпе. Можно повторить или выбрать следующую.':qualified?`Следующий шаг — ${result.bpm} из ${plan.sourceBpm} уд/мин.`:result.reason==='slow-down'?`Спокойно повторим на ${result.bpm} уд/мин, затем снова поднимем темп.`:beta?'Для зачёта двух рук подключи USB MIDI. Микрофонный разбор остаётся тренировкой.':'Повтори целиком без подсказок: для следующего темпа нужно 8 из 10. Можно разобрать трудное место.';
  $('#review-status').textContent='Проверяются высоты и вступления. Пальцы, удержание и постановка рук не оцениваются.';
  for(const id of ['study-continue','next-course-button','reply-area','return-whole','flow-polish'])$('#'+id).hidden=true;
  $('#problem-repeat').hidden=demo||!report.errors?.length;$('#repeat-button').hidden=false;$('#repeat-button').textContent='Повторить';$('#next-lesson-button').hidden=true;$('#flow-next').hidden=!passed;$('#flow-next').textContent='К композициям';
  renderPractice();const action=passed?continueAfterFlow:()=>startPerformance();
  if(demo)openDialog('result',false);
  else postplayTransition(report,action,{autoContinue:false,nextLabel:passed?'К композициям':qualified?`Дальше · ${result.bpm} BPM`:result.reason==='slow-down'?`Медленнее · ${result.bpm} BPM`:'Повторить целиком'});
  return true;
}
function applyLessonTempo(){if(state.performancePlan&&!state.breakdown){settings.tempo=state.performancePlan.currentBpm;state.tempoAutomatic=true;$('#tempo').value=settings.tempo;$('#tempo-value').value=settings.tempo;state.session=null;resetFollow();persist();return;}const choice=baseLearningTempo(),saved=settings.flowProgress[tempoProgressKey()]?.practiceBpm;settings.tempo=Number.isFinite(saved)?clamp(saved,40,choice.bpm):choice.bpm;state.tempoAutomatic=true;$('#tempo').value=settings.tempo;$('#tempo-value').value=settings.tempo;if(state.mode==='flow')state.session=null;resetFollow();persist();}
function adaptPracticeTempo(report){if(!state.tempoAutomatic||state.saved||state.source==='demo')return null;const key=tempoProgressKey(),old=settings.flowProgress[key]||{},choice=adaptLearningTempo({currentBpm:settings.tempo,report,stablePasses:old.stablePasses,source:state.source,assisted:state.assisted||taskHelpSticky,beta:lesson().polyphonic&&state.source==='mic',breakdown:state.breakdown,minBpm:40,maxBpm:baseLearningTempo().bpm});settings.flowProgress[key]={...old,practiceBpm:choice.bpm,stablePasses:choice.stablePasses,at:Date.now()};return choice;}
function hideFingerHint({keepTimer=false}={}){if(!keepTimer){clearTimeout(fingerTimer);state.supportHintUntil=0;}$('#finger-hint').hidden=true;for(const key of $$('#piano [data-finger]')){key.removeAttribute('data-finger');key.classList.remove('finger-cue');}}
function showFingerHint(reason){
  hideFingerHint({keepTimer:true});if(!state.running||state.intro)return;
  if(presentation()?.fingers===false&&(!state.microPlan||state.microHelpLevel===3))return;
  const hint=currentFingerCue(reason);if(!hint)return;
  const stage=microStage(),index=state.session.index;
  if(reason==='transition'&&!hint.movement&&!stage?.transitionIndices?.includes(index))return;
  if(stage&&microLevel(stage)<3||state.microRevealed)state.supportHintUntil=now()+3200;
  const p=presentation();if(state.mode==='check'&&!state.microRevealed&&(!stage||stage.assessment)||p?.fingers===false||p?.target===false&&p?.fingers!==true)return;
  $('#finger-hint').textContent=hint.text;$('#finger-hint').hidden=false;
  const pending=new Set(expectedNotes()),offset=state.breakdown?(state.sectionRange?.start||0):0,plan=practiceFingering(),timeline=state.session.timeline||state.session.notes,start=state.session.index,attack=timeline[start]?.time;
  for(let at=start;at<timeline.length;at++){if(at>start&&(!Number.isFinite(attack)||timeline[at].time-attack>.035))break;const entry=plan?.notes[at+offset];if(!entry||!pending.has(entry.midi)||!entry.finger)continue;const key=$(`#piano [data-midi="${entry.midi}"]`);if(key){key.dataset.finger=entry.finger;key.classList.add('finger-cue');}pending.delete(entry.midi);if(!pending.size)break;}
  if(stage)renderMicroLesson();clearTimeout(fingerTimer);fingerTimer=setTimeout(()=>{hideFingerHint();if(state.microPlan&&state.running)renderMicroLesson();},3200);
}
function flowDestination(){return isCourse()?{kind:'course',id:lesson().nextId||null}:state.studyStageId?{kind:'study'}:{kind:'library'};}
function resetFlowState(){state.flowGoalReached=false;state.flowPolish=false;state.flowNext=null;state.flowLastIndex=-1;state.performancePlan=null;}
function startFlowLevel(destination=state.flowNext||flowDestination(),{polish=false,brief=false,immediate=false}={}){
  if(state.performancePlan&&!state.breakdown){startPerformance();return;}
  if(state.microPlan)clearMicroLesson();
  pausePractice({keepInput:true});stopPlayback();closeResult();state.quickStart=true;state.flowNext=destination;state.flowPolish=polish;state.mode='flow';state.needsIntro=false;state.session=null;state.saved=false;state.revealed=false;state.source=settings.input;state.flowLastIndex=-1;resetFollow();
  settings.pendingFlow={courseId:state.courseId,compositionId:state.compositionId,stageId:state.studyStageId,studyVersion:state.studyPlan?.version,polish,goalReached:state.flowGoalReached};persist();
  if(immediate){renderPractice();startPractice().catch(()=>failMic({}));return;}
  nativeTransition(brief?'Повторим. Продолжай играть, даже если ошибся.':polish?'Попробуем добить до 100 процентов.': `Теперь без остановок. Первая цель — ${flowPassPercent()} процентов.`,()=>startPractice().catch(()=>failMic({})));
}
function continueAfterFlow(){
  if(state.flowGoalReached&&state.learningTask){settings.pendingFlow=null;persist();finishDailyTask();return;}
  if(!state.flowGoalReached)return;const next=state.flowNext||flowDestination();closeResult();state.flowPolish=false;state.flowGoalReached=false;settings.pendingFlow=null;persist();
  if(next.kind==='course'&&next.id)chooseCourse(next.id);else if(next.kind==='study'){const index=state.studyPlan.stages.findIndex(s=>s.id===state.studyStageId),stage=state.studyPlan.stages[index+1];if(stage)startStudyStage(stage.id);else navigate('library');}else navigate(isCourse()?'course':'library');
}
function completeStudyCheck(report,{demo,beta}){
  const stage=state.studyPlan?.stages.find(s=>s.id===state.studyStageId);
  if(!stage||stage.purpose!=='independent'||state.breakdown)return false;
  const previous=studyProgress(),attempt=recordStudyAttempt(state.studyPlan,{...previous,mastery:null},stage.id,report,{demo,beta,breakdown:false,mode:state.mode,source:state.source,assisted:state.assisted||taskHelpSticky,answerShown:state.revealed||!!(presentation()?.target||presentation()?.names),at:Date.now()});
  const passed=isStudyStageComplete(state.studyPlan,attempt,stage.id);
  settings.studyProgress[state.studyPlan.id]=passed?{...attempt,mastery:previous.mastery?.scorePercent>attempt.mastery.scorePercent?previous.mastery:attempt.mastery}:previous;
  if(!demo)taskHelpSticky=false;
  state.flowGoalReached=passed;if(settings.pendingFlow)settings.pendingFlow.goalReached=passed;persist();
  $('#result-title').textContent=demo?'Демо завершено':passed?'Сыграно самостоятельно':beta?'Практика двумя руками':'Закрепим целую мелодию';
  $('#result-subtitle').textContent=lesson().title;$('#result-accuracy').textContent=beta?'Без зачёта':`${report.scorePercent}%`;$('#result-correct').textContent=`${report.firstAttemptCorrect}/${report.total}`;$('#result-time').textContent=durationText(report.seconds);
  $('#result-dialog .result-metrics div:nth-child(2) span').textContent='Вовремя и верно';
  $('#result-advice').textContent=demo?'Экранный показ не подтверждает игру на инструменте.':passed?'Ты сыграл всю учебную версию по нотам, без подсветки клавиш и сопровождения. В следующий раз попробуй ещё раз без показа.':beta?'Микрофонная полифония остаётся тренировкой. Для самостоятельной проверки двух рук выбери USB MIDI в настройках.':state.assisted||state.revealed?'Подсказка помогла. Теперь повтори целиком без неё.':'Нужно 80% верных вступлений без подсказки. Можно разобрать трудное место и вернуться к целому.';
  $('#review-status').textContent='Проверены высоты и вступления. Удержание, пальцы и постановка рук не оцениваются.';
  for(const id of ['study-continue','next-course-button','reply-area','return-whole'])$('#'+id).hidden=true;
  $('#problem-repeat').hidden=demo||!report.errors.length;$('#problem-repeat').textContent='Разобрать трудное место';$('#repeat-button').hidden=passed;$('#repeat-button').textContent=beta?'Потренироваться ещё':'Повторить целиком';$('#next-lesson-button').hidden=passed;$('#next-lesson-button').textContent='К композициям';$('#flow-next').hidden=!passed;$('#flow-next').textContent=state.learningTask?'Продолжить занятие':'К композициям';$('#flow-polish').hidden=!passed||report.scorePercent===100;
  renderPractice();if(demo)openDialog('result',false);else postplayTransition(report,passed?()=>{if(!startPerformance())continueAfterFlow();}:repeatLearningTask,{autoContinue:false,nextLabel:passed?'К исходному темпу':'Повторить целиком'});
  return true;
}
function completeFlowPractice(){
  $('#flow-next').textContent='Дальше →';
  state.session.pause(now());const report=state.session.report(now()),demo=state.source==='demo',microFinal=state.microPlan?.stages.find(s=>s.id===state.microStageId)?.assessment;
  if(inputProblem(report))return;
  const microFailed=microFinal&&(report.scorePercent<80||state.assisted||taskHelpSticky||report.assisted||lesson().polyphonic&&state.source==='mic');
  const outcome=!demo&&(microFailed||state.learningTask?.kind==='rhythm'&&report.scorePercent<80)?'retry':chooseFlowOutcome(report,{polish:state.flowPolish,demo});
  state.running=false;state.phase='idle';state.lastReport=report;++autoGeneration;clearTimeout(autoTimer);keepInputWarm();backingPlayer?.stop();teacher.cancel();hideFingerHint();
  if(state.performancePlan&&!state.breakdown&&completePerformance(report,{demo,beta:state.source==='mic'&&(lesson().polyphonic||state.hand==='both'||state.studyPlan?.stages.find(s=>s.id===state.studyStageId)?.requiresMidi)}))return;
  if(state.microPlan&&completeMicroPractice(report,{demo,beta:lesson().polyphonic&&state.source==='mic'}))return;
  const tempoChoice=adaptPracticeTempo(report);
  const studyStage=state.studyPlan?.stages.find(s=>s.id===state.studyStageId),independent=studyStage?.purpose==='independent'&&!state.breakdown,assessmentBeta=state.source==='mic'&&!!(lesson().polyphonic||independent&&studyStage.requiresMidi);
  if(!independent||report.scorePercent>=80)emitLearningReport(report,assessmentBeta);
  if(!demo&&!state.saved){const key=state.compositionKey||state.courseId||lesson().id,old=settings.flowProgress[key]||{};settings.flowProgress[key]={...old,best:Math.max(old.best||0,report.scorePercent),last:report.scorePercent,at:Date.now(),beta:assessmentBeta};settings.history.unshift({lesson:lesson().id,title:lesson().title+' · в темпе',at:Date.now(),accuracy:report.scorePercent,correct:report.firstAttemptCorrect,seconds:report.seconds,metric:report.metric,kind:assessmentBeta?'beta':'flow',score:report.scoreOutOf10});settings.history=settings.history.slice(0,50);state.saved=true;persist();}
  if(tempoChoice?.changed){settings.tempo=tempoChoice.bpm;$('#tempo').value=settings.tempo;$('#tempo-value').value=settings.tempo;persist();}
  if(completeStudyCheck(report,{demo,beta:assessmentBeta}))return;
  if(state.studyStageId&&outcome==='retry'&&!demo){state.songFailures=(state.songFailureStage===state.studyStageId?state.songFailures||0:0)+1;state.songFailureStage=state.studyStageId;}else state.songFailures=0;
  if(state.learningTask?.kind==='rhythm'&&state.rhythmGuided&&report.scorePercent>=80&&!demo){state.rhythmGuided=false;postplayTransition(report,()=>startFlowLevel(state.flowNext,{immediate:true}),{nextLabel:'Самостоятельно'});return;}
  if(outcome==='retry'){postplayTransition(report,()=>startFlowLevel(state.flowNext,{polish:state.flowPolish,immediate:true}),{nextLabel:'Повторить в темпе',allowNext:false});return;}
  if(outcome==='offer-polish'||outcome==='complete')state.flowGoalReached=true;
  if(settings.pendingFlow){settings.pendingFlow.goalReached=state.flowGoalReached;persist();}
  if(outcome==='complete'&&!demo){postplayTransition(report,continueAfterFlow);return;}
  $('#result-title').textContent=demo?'Демо в темпе':'Получилось! Можно идти дальше';$('#result-subtitle').textContent=lesson().title;$('#result-accuracy').textContent=report.scorePercent+'%';$('#result-correct').textContent=`${report.firstAttemptCorrect}/${report.total}`;$('#result-time').textContent=durationText(report.seconds);$('#result-dialog .result-metrics div:nth-child(2) span').textContent='Вовремя и верно';
  $('#result-advice').textContent=demo?'Экранное демо не сохраняется как игра на инструменте.':`Цель ${flowPassPercent()}% выполнена. Можно добить до 100% или продолжить обучение. ${state.source==='midi'?chooseTimingAdvice(report):'Держи общий счёт. Микрофон оценивает момент нажатия приблизительно.'}`;
  for(const id of ['study-continue','next-course-button','problem-repeat','return-whole','reply-area'])$('#'+id).hidden=true;
  $('#review-status').textContent='В темпе оцениваются ноты и момент нажатия. Удержание и техника не оцениваются.';$('#repeat-button').hidden=!demo;$('#next-lesson-button').hidden=true;$('#flow-polish').hidden=demo;$('#flow-next').hidden=demo;renderPractice();if(demo)openDialog('result',false);else postplayTransition(report,continueAfterFlow,{autoContinue:false});
}

function applyTheme() {
  if(options.embedded){drawScore();return;}

  document.documentElement.dataset.theme=settings.theme;
  document.documentElement.dataset.accent=settings.accent ? 'blue' : 'teal';
  if($('meta[name="theme-color"]'))$('meta[name="theme-color"]').content=settings.theme==='dark' ? '#101820' : '#f3f6f5';
  drawScore();
}
function keyboardPhrase(){
  if(state.breakdown)return notes();
  // Preparation, demonstrations, assistance and retries share the whole phrase.
  // Neither the current target nor the remaining suffix may move its keys.
  const phrase=state.studyPlan?.stages.find(stage=>stage.id===state.studyStageId)?.notes||state.learningTask?.notes||COURSE.find(item=>item.id===state.courseId)?.notes;
  const selected=phrase?phrase.map(note=>({...note,midi:note.midi+settings.octave*12})):notes();
  return selected;
}
function renderPiano() {
  const range=settings.cropKeys?createKeyboardRange(keyboardPhrase(),keyboardViewportOptions(innerWidth,innerHeight)):createKeyboardRange([{midi:36},{midi:96}],{padding:0}),piano=$('#piano');keyboardRange=range;
  if(piano.dataset.range!==range.signature){
    piano.innerHTML=range.keys.map(midi=>{const p=range.position(midi),info=noteInfo(midi);return `<button class="piano-key ${p.black?'black':'white'} ${midi%12===0?'anchor':''}" style="left:${p.left*100}%;width:${p.width*100}%" data-midi="${midi}" aria-label="Прослушать ${info.name}, ${info.latin}"><i class="piano-key-face" aria-hidden="true"></i><span class="note-name">${info.name}</span><span class="note-latin">${info.latin}</span></button>`;}).join('');
    piano.dataset.range=range.signature;
  }
  piano.setAttribute('aria-label',`Клавиши ${noteInfo(range.min).latin}–${noteInfo(range.max).latin} для этого фрагмента.${state.source==='demo'?' Экранное демо.':' Играй на синтезаторе.'}`);
  piano.classList.toggle('zoomed',range.whiteCount<=16);renderKeyboardMap(range);highlightKeys();
}
function renderKeyboardMap(range){
  const piano=$('#piano');let map=$('#phrase-keyboard-map');
  if(!map){piano.insertAdjacentHTML('beforebegin','<div id="phrase-keyboard-map" class="phrase-keyboard-map" role="img"><div class="phrase-map-keys"></div><div class="phrase-map-window"></div><span class="phrase-map-label"></span></div>');map=$('#phrase-keyboard-map');}
  const phraseId=[state.courseId,state.compositionId,state.studyStageId,settings.lesson,settings.octave,state.breakdown?range.signature:''].join(':');
  map.hidden=!settings.cropKeys||range.min===36&&range.max===96;
  if(map.dataset.range===range.signature&&map.dataset.phrase===phraseId)return;
  map.dataset.dismissed='false';
  map.setAttribute('aria-hidden','false');
  const full=createKeyboardRange([{midi:36},{midi:96}],{padding:0});
  map.querySelector('.phrase-map-keys').innerHTML=full.keys.map(midi=>{const p=full.position(midi);return `<i class="${p.black?'black':'white'}" style="left:${p.left*100}%;width:${p.width*100}%"></i>`;}).join('');
  const first=full.whiteKeys.indexOf(range.min),window=map.querySelector('.phrase-map-window');
  window.style.left=`${first/full.whiteCount*100}%`;window.style.width=`${range.whiteCount/full.whiteCount*100}%`;
  const label=`${noteInfo(range.min).latin}–${noteInfo(range.max).latin} · из 61 клавиши`;
  map.querySelector('.phrase-map-label').textContent=label;map.setAttribute('aria-label',`Видимый участок клавиатуры ${label}`);map.dataset.range=range.signature;map.dataset.phrase=phraseId;
}
function highlightKeys(pressed=null, wrong=false) {
  const showTarget=!!state.intro||state.preview||presentation()?.target!==false&&((!isCourse()&&!state.customLesson) || state.mode==='learn' || state.revealed || state.source==='demo');
  const targets=new Set(state.intro?state.intro.active||[]:state.preview?[notes()[state.previewStep??0]?.midi]:expectedNotes());
  const phrase=teachingPhrase(state.intro?.frames||state.session?.notes||notes(),state.breakdown?(state.sectionRange?.start||0):0),at=state.intro?.index??state.previewStep??state.session?.index??0,groupTime=phrase[at]?.time;
  const leftNotes=new Set(phrase.slice(at).filter((n,i)=>(i===0||n.time<=groupTime+.035)&&n.hand==='left').map(n=>n.midi));
  if(lesson().hand==='Левая рука')for(const midi of targets)leftNotes.add(midi);
  for(const key of $$('.piano-key')) {
    const midi=Number(key.dataset.midi);
    key.classList.toggle('target',showTarget&&targets.has(midi));
    key.classList.toggle('target-left',showTarget&&targets.has(midi)&&leftNotes.has(midi));
    const recent=feedback.findLast(hit=>hit.midi===midi&&now()-hit.at>=0&&now()-hit.at<160);
    key.classList.toggle('pressed',midi===pressed||!!recent||!!state.intro?.active?.includes(midi));
    key.classList.toggle('wrong',midi===pressed&&wrong||!!recent?.wrong);
    const info=noteInfo(midi);
    key.setAttribute('aria-label',`${state.source==='demo' ? 'Сыграть' : 'Прослушать'} ${info.name}, ${info.latin}${showTarget&&targets.has(midi)?', нужная нота':''}`);
  }
}
function noteX(midi,width) {
  const p=keyboardRange?.position(midi);return p?p.center*width:null;
}
function updateKeyTiming(pending,playhead,gate,waiting){
  const showing=!!state.intro||presentation()?.target!==false&&(state.mode==='learn'||state.mode==='flow'||state.revealed||state.source==='demo');
  const cueWindow=state.session instanceof TimedSession?state.session.window:state.activePolicy?.windowSeconds??.28;
  const arrival=!state.intro&&state.running&&showing&&(waiting||Math.abs(gate-playhead)<=cueWindow);
  $('.practice-panel').dataset.cue=arrival?'due':state.running&&gate-playhead>=0&&gate-playhead<cueWindow+.35?'approaching':'travel';
  for(const key of $$('.piano-key')){const target=showing&&pending.has(Number(key.dataset.midi));key.classList.toggle('due',target&&(arrival||!!state.intro?.active?.includes(Number(key.dataset.midi))));key.classList.toggle('imminent',target&&!arrival&&state.running&&gate-playhead>=0&&gate-playhead<cueWindow+.35);}
}
function needsMidiRelease(waiting){
  return waiting&&state.running&&state.source==='midi'&&state.mode!=='flow'&&!state.intro&&!state.preview&&
    expectedNotes().some(midi=>midiInput.heldNotes.includes(midi));
}
function drawScore() {
  const canvas=$('#score');if(!canvas)return;
  const width=canvas.clientWidth,canvasHeight=canvas.clientHeight;if(!width||!canvasHeight)return;
  const time=now(),intro=state.intro,previewing=!!intro||state.preview;
  $('.stage-label').classList.toggle('has-feedback',state.feedbackUntil>time);
  if(state.feedbackUntil>time)queueScore();
  const phrase=teachingPhrase(intro?intro.frames:state.session?.notes||notes(),state.breakdown?(state.sectionRange?.start||0):0),index=intro?intro.index||0:state.previewStep??state.session?.index??0;
  const transport=intro?null:ensureFollow(),tick=intro?{time:intro.playhead??-.65,waiting:false}:state.preview?null:transport.tick(time);
  if(state.mode==='flow'&&state.running&&state.session?.finished){completePractice();return;}
  const timeline=intro?intro.frames.map((n,i)=>({...n,index:i})):state.preview?previewTimeline:practiceTimeline;
  const playhead=intro?intro.playhead??-.65:state.preview?Math.max(-.08,(time-previewStartedAt)/1000):tick.time;
  const moving=state.preview||(state.running&&!tick.waiting),gate=previewing?Infinity:timeline[state.session?.index||0]?.time??Infinity;
  const waiting=!!(state.running&&tick?.waiting);pulse(playhead);
  $('.practice-panel').classList.toggle('waiting',waiting);
  if(waiting!==state.waiting){state.waiting=waiting;highlightKeys();}
  $('.practice-panel').dataset.playhead=playhead.toFixed(3);
  $('.practice-panel').dataset.flowReady=String(state.mode==='flow'&&state.running&&Math.abs(gate-playhead)<.2);
  if(state.mode==='flow'&&state.session&&state.flowLastIndex!==state.session.index){
    state.flowLastIndex=state.session.index;const total=state.session.notes.length,pitch=expected(),info=pitch===null?null:noteInfo(pitch),percent=state.session.index/total*100;
    $('#step-label').textContent=`${state.session.index} из ${total} нот · ${state.performancePlan&&!state.breakdown?`Исполнение ${settings.tempo}/${state.performancePlan.sourceBpm} BPM`:state.rhythmGuided?'Разучиваем ритм':'В темпе'}`;$('#target-note').innerHTML=info?`${expectedNotes().map(m=>noteInfo(m).name).join(' + ')}<span>${info.latin}</span>`:'Готово';
    $('#lesson-progress').style.transform=`scaleX(${percent/100})`;$('.progress-track').setAttribute('aria-valuenow',Math.round(percent));highlightKeys();
  }
  if(state.running){
    const label=strictMemory()?state.learningTask?.kind==='rhythm'?'Держи ровный пульс':'Играем по памяти':state.feedbackUntil>time?state.feedbackMessage:state.mode==='flow'&&playhead<0?'Приготовься':state.mode==='flow'?state.flowPolish?'Играем без остановок · цель 100%':`Играем без остановок · цель ${flowPassPercent()}%`:state.polyNeedsRelease?'Отпусти клавиши и сыграй оставшуюся ноту отдельно':needsMidiRelease(waiting)?'Отпусти клавишу и нажми заново':waiting?(state.mode==='check'||presentation()?.target===false)&&!state.revealed?'Играй самостоятельно':`Играй · ${expectedNotes().map(m=>noteInfo(m).name).join(' + ')}`:playhead<gate-.12?'Подготовь следующую ноту':'Сейчас';if($('#stage-state').textContent!==label)$('#stage-state').textContent=label;
    if(state.mode!=='flow'&&playhead>=gate-.03){const session=state.session,at=session.index,source=state.source;const ready=earlyNotes.take({index:at,source,now:time,isHeld:midi=>source==='midi'?midiInput.heldNotes.includes(midi):time-(noteEvidence.get(midi)??-Infinity)<220});if(ready.length)queueMicrotask(()=>{for(const midi of ready){if(!state.running||state.session!==session||session.index!==at||state.source!==source)break;processNote(midi,source);}});}
  }
  if(!intro&&(state.running||state.preview||backingPlayer))syncBacking(Math.max(0,playhead),moving&&playhead>=0,state.mode==='flow'?Infinity:gate);
  const pending=new Set(intro?intro.active||[]:expectedNotes());updateKeyTiming(pending,playhead,gate,waiting);
  const dpr=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(canvasHeight*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(canvasHeight*dpr);}
  const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,canvasHeight);
  const styles=getComputedStyle(root.host||document.documentElement),line=styles.getPropertyValue('--line').trim(),accent=styles.getPropertyValue('--accent').trim(),left=styles.getPropertyValue('--hand-left').trim()||accent;
  const ink=styles.getPropertyValue('--accent-ink').trim(),muted=styles.getPropertyValue('--muted').trim(),text=styles.getPropertyValue('--text').trim();
  const policy=intro?null:presentation(),requestedMode=intro?(intro.showNotation?'staff':'falling'):policy?policy.staff?(policy.falling?settings.notation:'staff'):'falling':settings.notation,grand=phrase.some(n=>n.hand==='left')&&phrase.some(n=>n.hand==='right');
  const compactGrand=grand&&requestedMode!=='falling'&&innerHeight<380;$('.practice-panel').classList.toggle('compact-grand',compactGrand);
  const notationTop=58,notationSpace=Math.max(1,canvasHeight-notationTop);
  const mode=requestedMode==='both'&&notationSpace<(grand?230:180)?'staff':requestedMode,staffOnly=mode==='staff',staffHeight=staffOnly?notationSpace:mode==='both'?Math.min(grand?180:120,Math.max(grand?171:100,notationSpace*.55)):0;
  $('#notation-size-note').hidden=!(requestedMode==='both'&&mode==='staff');
  $('.practice-panel').dataset.notation=mode;
  if(staffHeight){
    const offset=intro?width*.45:0;ctx.save();ctx.translate(offset,notationTop);if(musicFontReady)drawNotation(ctx,{width:width-offset,height:staffHeight,notes:phrase,timeline,playhead,index,expectedNotes:[...pending],hand:state.hand==='left'||lesson().hand==='Левая рука'?'left':state.hand,sourceTempo:lesson().tempo||60,tempo:settings.tempo,accent,leftColor:left,ink:text,muted,line,waiting,preview:previewing,showNames:state.microPlan&&canvasHeight>=140?!!(previewing||policy?.names):false,teachingCue:state.microPlan&&!previewing&&microCue()?.staffText?{index,finger:microCue()?.finger,label:microCue().staffText}:null});else{ctx.fillStyle=muted;ctx.font='12px "Segoe UI",sans-serif';ctx.fillText('Загружаем нотный стан…',20,28);}ctx.restore();
  }
  feedback=feedback.filter(f=>time-f.at<240);
  if(staffOnly){if(state.preview||(state.running&&!waiting)||feedback.length)queueScore();return;}
  const offset=staffHeight?staffHeight+notationTop:0,height=canvasHeight-offset,visual=practiceVisualGeometry({height,windowSeconds:state.session instanceof TimedSession?state.session.window:state.activePolicy?.windowSeconds??.28}),strike=visual.strikeY,pps=visual.pxPerSecond,whiteCount=keyboardRange?.whiteCount||8;
  $('#strike-zone').style.setProperty('--strike-inset',visual.strikeInsetPx+'px');$('#strike-zone').style.setProperty('--strike-window-half',visual.windowHalfPx+'px');
  ctx.save();ctx.beginPath();ctx.rect(0,offset,width,height);ctx.clip();ctx.translate(0,offset);
  ctx.strokeStyle=line;ctx.lineWidth=1;ctx.globalAlpha=.22;
  for(let i=1;i<whiteCount;i++){ctx.beginPath();ctx.moveTo(i*width/whiteCount,0);ctx.lineTo(i*width/whiteCount,height);ctx.stroke();}
  const beat=60/settings.tempo,firstBeat=Math.floor(playhead/beat);
  for(let i=firstBeat;i<firstBeat+18;i++){const y=strike+(playhead-i*beat)*pps;if(y<0||y>height)continue;ctx.globalAlpha=i%4===0?.27:.10;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke();}
  // The persistent DOM line remains visible even when no canvas frame moves.
  const gateTime=timeline[state.session?.index||0]?.time??0;
  for(let i=Math.min(timeline.length-1,index+128);i>=Math.max(0,index-6);i--){
    const n=timeline[i],keyPosition=keyboardRange?.position(n.midi);if(!keyPosition)continue;const bar=noteBarBounds({keyPosition,canvasWidth:width,noteTime:n.time,duration:n.duration,playhead,geometry:visual}),{bottom,y}=bar,h=bar.height;if(bottom<0||y>height)continue;
    const active=previewing?intro?pending.has(n.midi)&&playhead>=n.time&&playhead<n.time+n.duration:i===index:n.time<=gateTime+.035&&n.time>=gateTime-.035&&pending.has(n.midi);
    const played=!previewing&&n.time<gateTime-.035,hand=phrase[n.index]?.hand||(lesson().hand==='Левая рука'?'left':'right'),color=hand==='left'?left:accent,x=bar.x,w=bar.width;
    const cueWindow=state.session instanceof TimedSession?state.session.window:state.activePolicy?.windowSeconds??.28,due=active&&!previewing&&(waiting||Math.abs(n.time-playhead)<=cueWindow),material=noteBarMaterial({active,due,approaching:active&&n.time-playhead>0&&n.time-playhead<cueWindow+.35,waiting:active&&waiting,played,reducedMotion:reducedMotion.matches});
    ctx.globalAlpha=material.opacity;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=material.shadowBlur;ctx.shadowOffsetY=material.shadowOffsetY;
    ctx.beginPath();ctx.roundRect(x-w/2,y,w,h,bar.radius);ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
    const gloss=ctx.createLinearGradient(x-w/2,y,x+w/2,y+h);gloss.addColorStop(0,`rgba(255,255,255,${material.glossTop})`);gloss.addColorStop(.55,`rgba(255,255,255,${material.glossMid})`);gloss.addColorStop(1,`rgba(0,0,0,${material.glossBottom})`);ctx.fillStyle=gloss;ctx.fill();ctx.strokeStyle=`rgba(255,255,255,${material.rimAlpha})`;ctx.lineWidth=material.rimWidth;ctx.stroke();
    if(w>=12&&h>=14&&(intro||state.preview||presentation()?.names!==false)){ctx.globalAlpha=active?1:.8;ctx.fillStyle=active?ink:muted;ctx.font=`${active?700:500} ${clamp(w*.4,8,12)}px "Segoe UI",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(noteInfo(n.midi).name,x,Math.min(bottom-8,Math.max(9,y+h/2)));}
  }
  if(!reducedMotion.matches)for(const f of feedback){const age=(time-f.at)/240,x=noteX(f.midi,width);if(x===null)continue;ctx.globalAlpha=(1-age)*.55;ctx.fillStyle=f.wrong?styles.getPropertyValue('--warn').trim():accent;ctx.beginPath();ctx.ellipse(x,strike-3-age*10,5+age*9,3+age*3,0,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;ctx.restore();if(state.preview||(state.running&&!waiting)||feedback.length)queueScore();
}
function renderPracticeRoute(){
  const node=$('#practice-route');if(!node)return;
  if(state.breakdown||state.microPlan){node.hidden=true;return;}
  const stage=state.studyPlan?.stages.find(s=>s.id===state.studyStageId),progress=stage?studyProgress():null;
  const phases=stage?state.studyPlan.stages.filter(s=>s.part===stage.part&&s.kind==='fragment'&&progress.completed.includes(s.id)).map(s=>s.hand):[];
  if(stage?.purpose==='independent'&&state.studyPlan.stages.some(s=>s.kind==='whole'&&progress.completed.includes(s.id)))phases.push('join');
  const route=buildPracticeRoute({stage,availableHands:stage?.availableHands||state.studyPlan?.availableHands,mode:state.mode,goalPercent:state.mode==='flow'?flowPassPercent():80,completedPhases:phases,isCourse:isCourse(),memory:strictMemory()});
  node.hidden=!route.visible;if(!route.visible)return;
  $('#practice-route-fragment').textContent=state.breakdown?'Трудное место':route.fragment;$('#practice-route-goal').textContent=state.breakdown?'Разбор без зачёта':route.goal;node.setAttribute('aria-label',route.ariaLabel);
  for(const item of $$('#practice-route-steps [data-route-phase]')){const step=route.steps.find(s=>s.phase===item.dataset.routePhase);item.hidden=!step;if(!step){item.removeAttribute('aria-current');delete item.dataset.state;continue;}item.querySelector('.route-step-label').textContent=step.label;item.dataset.state=step.state;if(step.state==='current')item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');}
}
function renderPractice() {
  const song=lesson(), s=state.session, e=expected(), info=e!==null ? noteInfo(e) : null;
  const p=presentation(),memory=strictMemory();$('.practice-panel').dataset.cueLabel=String(['orientation','pulse-and-space'].includes(song.moduleId));$('.practice-panel').classList.toggle('memory-task',memory);$('.practice-panel').classList.toggle('hide-target',!state.intro&&!state.preview&&(memory||state.mode==='check'||p?.target===false)&&!state.revealed);$('.practice-panel').classList.toggle('hide-note-names',!!p&&p.names===false&&!state.intro);$('#recall-cover').hidden=!memory;$('#practice-pulse').hidden=state.mode!=='flow';
  $('#recall-cover strong').textContent=state.learningTask?.kind==='rhythm'?'Повтори ритм':state.learningTask?.kind==='recall'?'Сыграй по памяти':'Повтори на слух';$('#recall-cover span').textContent=state.running?'Играем без показа нужных клавиш':'Послушай рисунок, затем сыграй самостоятельно';
  renderPiano();
  $('#lesson-guide').hidden=!isCourse()&&!state.customLesson;
  const flat=!!state.learningTask&&(['reading','recall','rhythm'].includes(state.learningTask.kind)||state.learningTask.learningRoute==='guided-check');$('#practice-modes').hidden=flat||!!state.studyStageId;$('#practice-section').hidden=flat;
  $('#lesson-instruction').textContent=state.learningTask?.instruction||song.instruction||'';$('#lesson-tip').textContent=memory?'':state.breakdown?`Разбираем трудный участок: ноты ${(state.sectionRange?.start||0)+1}–${state.sectionRange?.end||3}. Затем вернёмся к полному упражнению.`:song.tip||'';
  $$('#practice-modes button').forEach(b=>{b.classList.toggle('selected',b.dataset.mode===state.mode);b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode));b.disabled=b.dataset.mode==='check'&&!!(lesson().polyphonic&&settings.input==='mic');});
  $('.practice-meta .small-pill').textContent=song.hand||'Одна партия';
  $('.practice-meta .small-pill:nth-child(2)').textContent=state.performancePlan&&!state.breakdown?`Исполнение · ${settings.tempo}/${state.performancePlan.sourceBpm} BPM`:state.mode==='flow'?`В темпе · цель ${state.flowPolish?'100':flowPassPercent()}%`:(isCourse()||state.customLesson) ? state.breakdown?'Разбор':state.mode==='check'?'Зачёт · 8/10':'С подсказками' : 'С ожиданием';
  $('#flow-skip').hidden=state.mode!=='flow'||!state.flowGoalReached;
  $('#tempo-description').textContent=state.performancePlan&&!state.breakdown?`Исполнение: ${settings.tempo} из ${state.performancePlan.sourceBpm} уд/мин. Для следующего темпа нужно 8 из 10.`:state.mode==='flow'?'Без остановок. Играй дальше, даже если ошибся.':'В разучивании мелодия ждёт нужную клавишу.';
  $('#lesson-title').textContent=state.breakdown?`Трудное место · ноты ${(state.sectionRange?.start||0)+1}–${state.sectionRange?.end||3}`:memory?state.learningTask?.kind==='rhythm'?'Повтори ритм':'Короткий рисунок по памяти':song.title;$('#lesson-author').textContent=song.author;
  $('.practice-panel').dataset.mode=state.mode;$('#step-label').textContent=`${state.breakdown?'Разбор без зачёта':state.performancePlan?`Исполнение · ${settings.tempo}/${state.performancePlan.sourceBpm} BPM`:memory&&state.learningTask?.kind!=='rhythm'?'По памяти':state.mode==='flow'?'В темпе':state.mode==='check'?'Самостоятельно':'Разучиваем'} · ${s?.index||0} из ${notes().length} нот${state.customLesson?` · ${song.hand}${song.polyphonic&&settings.input==='mic'?' · β':''}`:''}`;
  const percent=(s?.index||0)/notes().length*100;
  $('#lesson-progress').style.width='100%';$('#lesson-progress').style.transform=`scaleX(${percent/100})`;
  $('.progress-track').setAttribute('aria-valuenow',Math.round(percent));
  $('#target-note').innerHTML=info ? `${expectedNotes().map(m=>noteInfo(m).name).join(' + ')}<span>${info.latin}</span>` : s?.earlyAbort?'Повторим':'Готово';
  const stage=state.phase==='coaching'?'Преподаватель объясняет':state.phase==='permission' ? 'Разреши доступ к микрофону' : state.phase==='countdown' ? `Приготовься: ${state.countdown}` : state.preview ? 'Слушай пример' : s?.finished ? 'Попытка завершена' : state.running ? state.source==='demo' ? 'Демо на экранной клавиатуре' : 'Сыграй на синтезаторе' : s ? 'Практика на паузе' : 'Нажми ▶, чтобы начать';
  $('#stage-state').textContent=state.feedbackUntil>now()?state.feedbackMessage:stage;
  $('#score').setAttribute('aria-label',info ? `Дорожка нот. Следующая нота — ${info.name}, ${info.latin}.` : s?.earlyAbort?'Попытка завершена после серии ошибок.':'Попытка завершена.');
  if(memory)$('#score').setAttribute('aria-label','Игра без показа ответа.');else if(p?.names===false&&!state.preview&&!state.intro)$('#score').setAttribute('aria-label',settings.notation==='falling'?'Сыграй падающие ноты самостоятельно.':'Сыграй ноты самостоятельно.');
  const busy=['permission','countdown','coaching','intro'].includes(state.phase);
  $('.practice-panel').classList.toggle('introducing',!!state.intro);$('#intro-caption').hidden=!state.intro;

  $('#auto-tempo').classList.toggle('selected',state.tempoAutomatic);$('#auto-tempo').setAttribute('aria-pressed',String(state.tempoAutomatic));
  $('#crop-keys').checked=settings.cropKeys;
  $('#notation-options').closest('fieldset').hidden=false;
  for(const b of $$('#notation-options button')){b.classList.toggle('selected',b.dataset.notation===settings.notation);b.setAttribute('aria-pressed',String(b.dataset.notation===settings.notation));}
  $('.practice-panel').classList.toggle('coaching',state.phase==='coaching');
  const startLabel=state.intro?'Пауза объяснения':state.preview?'Пауза показа':busy ? 'Отменить' : state.running ? 'Пауза' : state.needsIntro?'Продолжить объяснение':s && !s.finished ? 'Продолжить' : s?.finished ? 'Сыграть ещё раз' : settings.input==='midi'?'Начать с MIDI':'Начать с микрофоном';
  $('#start-button').innerHTML=icon(state.preview||busy || state.running ? 'pause' : 'play')+`<span class="sr-only">${startLabel}</span>`;
  $('#start-button').setAttribute('aria-label',startLabel);$('#start-button').title=startLabel;
  $('#preview-button').innerHTML=icon(state.preview ? 'pause' : 'play')+`<span>${state.preview ? 'Стоп' : 'Послушать'}</span>`;
  $('#preview-button').disabled=busy;
  $('#demo-banner').hidden=state.source!=='demo' || !s;
  $('#demo-banner').textContent='Экранное демо · без сохранения';
  $('#demo-button').hidden=!!s && !s.finished;
  $('#skip-button').hidden=!state.running;
  $('#restart-button').disabled=!s || busy;
  $('#mic-toggle').innerHTML=icon('mic')+(state.phase==='permission' ? 'Отменить запрос' : state.mic ? 'Выключить микрофон' : 'Проверить микрофон');
  const badge=$('#mic-badge');
  badge.textContent=state.phase==='permission' ? 'Запрос доступа' : state.mic ? (micContext?.state==='running' ? 'Слушаю' : 'На паузе') : state.phase==='error' ? 'Нет доступа' : 'Выключен';
  badge.classList.toggle('on',state.mic && micContext?.state==='running');badge.classList.toggle('error',state.phase==='error');
  renderCompositionControls();$('#whole-piece').hidden=!state.breakdown;
  renderPracticeRoute();renderMicroLesson();
  highlightKeys();drawScore();
}
function updateSignal(pitch,rms,time) {
  practiceScene?.refresh();
  const level=rms>0 ? clamp((20*Math.log10(rms)+60)*2,0,100) : 0;
  $('#level-fill').style.width=`${level}%`;
  $('.level-meter').setAttribute('aria-valuenow',Math.round(level));
  $('#signal-label').textContent=!state.mic ? 'Нет сигнала' : rms>.3 ? 'Слишком громко' : rms<minRms() ? 'Тихий фон' : 'Есть звук';
  if(pitch) {state.heard=pitch;state.heardAt=time;state.inputHeard=pitch.midi;}
  if(state.heard && time-state.heardAt<450) {
    const info=noteInfo(state.heard.midi);
    $('#heard-note').innerHTML=`${info.name}<small>${info.latin}</small>`;
    $('#heard-detail').textContent=`${state.heard.frequency.toFixed(1)} Гц · ${Math.round(state.heard.cents)>0?'+':''}${Math.round(state.heard.cents)} центов`;
  } else {$('#heard-note').textContent='—';$('#heard-detail').textContent=state.mic ? 'Сыграй одну ноту' : 'Микрофон выключен';}
}

function failMic(error) {
  const name=error?.name||'';
  const message=['NotAllowedError','SecurityError'].includes(name) ? 'Микрофон недоступен. Открой сайт напрямую в Chrome или Safari и разреши микрофон в настройках сайта.' :
    name==='InputProtectionError' ? 'Не удалось включить защиту от речи. Попробуй снова в Chrome. Можно пропустить упражнение без оценки.' :
    name==='NotFoundError' ? 'Микрофон не найден. Проверь, подключён ли он, и попробуй снова.' :
    name==='NotReadableError' ? 'Микрофон занят или недоступен. Закрой другое приложение со звуком и попробуй снова.' :
    name==='UnsupportedError' ? 'В этом окне нет доступа к микрофону. Открой ссылку сайта напрямую в Chrome или Safari.' :
    'Не удалось включить микрофон. Проверь разрешение в настройках браузера и попробуй снова.';
  stopMic();state.phase='error';state.running=false;if(state.session) state.session.pause(now());
  micMessage(message,true);toast(message);coach('Можно пока попробовать демо на экранной клавиатуре. Реальная практика начнётся после доступа к микрофону.');renderPractice();
}
async function enableMic() {
  if('speechSynthesis' in window) speechSynthesis.cancel();
  if(state.mic && micContext) {
    // Called from a click so suspended mobile contexts can resume with a gesture.
    try {await micContext.resume();} catch{}
    if(micContext.state!=='running') {micMessage('Нажми «Проверить микрофон», чтобы активировать звук в браузере.',true);return false;}
    micCapture?.configure({minRms:minRms(),polyphonic:!!lesson().polyphonic});return true;
  }
  if(!navigator.mediaDevices?.getUserMedia || !window.isSecureContext || !(window.AudioContext||window.webkitAudioContext)) {failMic({name:'UnsupportedError'});return false;}
  const generation=++micGeneration;
  stopPlayback();state.phase='permission';renderPractice();
  const Audio=window.AudioContext||window.webkitAudioContext;
  let ctx;
  try {
    ctx=new Audio({latencyHint:'interactive'});micContext=ctx;
    // Start resume before the first await; iOS/Chrome require user activation.
    ctx.resume().catch(()=>{});
    const acquired=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!!(settings.accompaniment&&state.customLesson?.backing?.length),noiseSuppression:false,autoGainControl:false,channelCount:1},video:false});
    if(generation!==micGeneration) {acquired.getTracks().forEach(t=>t.stop());ctx.close().catch(()=>{});return false;}
    stream=acquired;micSource=ctx.createMediaStreamSource(stream);
    micCapture=createMicStream({context:ctx,source:micSource,assetURL:micAsset,
      onEvidence:evidence=>{if(generation===micGeneration)receiveMicEvidence(evidence);},
      onError:()=>{if(generation===micGeneration)failMic({name:'InputProtectionError'});}});
    micMessage('Готовим защиту от речи…');
    await micCapture.start();
    if(generation!==micGeneration){ctx.close().catch(()=>{});return false;}
    micCapture.configure({minRms:minRms(),polyphonic:!!lesson().polyphonic});
    // Capture's output is always zero; microphone monitoring is never audible.
    state.mic=true;state.phase='idle';
    state.noiseFloor=0;resetDetector();
    for(const track of stream.getAudioTracks()) {
      track.addEventListener('ended',()=>{if(generation===micGeneration) {pausePractice();state.phase='error';micMessage('Микрофон отключился. Нажми «Продолжить», чтобы подключить его снова.',true);renderPractice();}});
      track.addEventListener('mute',()=>{if(generation===micGeneration) {pausePractice();micMessage('Браузер приостановил микрофон. Вернись на страницу и нажми «Продолжить».');}});
    }
    ctx.onstatechange=()=>{
      if(ctx!==micContext || !state.mic) return;
      if(ctx.state!=='running' && (state.running || ['countdown'].includes(state.phase))) {pausePractice();micMessage('Звук приостановлен браузером. Нажми кнопку практики, когда вернёшься.');}
      renderPractice();
    };
    micMessage('Микрофон подключён. Играй по одной ноте тембром Piano.');
    if(ctx.state!=='running') micMessage('Нажми «Начать с микрофоном» ещё раз, чтобы активировать звук.',true);
    renderPractice();
    return ctx.state==='running';
  } catch(error) {
    if(generation!==micGeneration) {ctx?.close().catch(()=>{});return false;}
    failMic(error);return false;
  }
}
function stopMic() {
  clearTimeout(inputIdleTimer);
  ++micGeneration;cancelAnimationFrame(animationFrame);animationFrame=0;
  micCapture?.stop();micCapture=null;micSpeechPaused=false;
  const oldStream=stream,oldContext=micContext;stream=null;micContext=null;
  oldStream?.getTracks().forEach(t=>t.stop());micSource?.disconnect();micSource=null;analyser=null;audioBuffer=null;
  if(oldContext && oldContext.state!=='closed') oldContext.close().catch(()=>{});
  state.mic=false;state.heard=null;resetDetector();updateSignal(null,0,now());
}
function receiveMicEvidence(evidence) {
  if(evidence?.type!=='evidence'||!state.mic||!micContext||micContext.state!=='running')return;
  const time=now(),offset=time-micContext.currentTime*1000;
  const captureAge=micContext.currentTime-evidence.captureAt;
  if(!Number.isFinite(evidence.captureAt)||captureAge>.16||captureAge<-128/micContext.sampleRate){
    if(state.running){state.inputInterrupted=true;state.session?.pause(time);follow?.pause(time);state.running=false;}
    failMic({name:'InputProtectionError'});return;
  }
  if(evidence.speech){state.heard=null;state.inputHeard=null;}
  const heard=Number.isInteger(evidence.midi)||Number.isInteger(evidence.heldMidi);
  updateSignal(heard&&!evidence.speech?evidence.pitch:null,evidence.rms,time);
  if(!state.running&&!micSpeechPaused)return;
  if(time<gateUntil)return;
  const waiting=evidence.speech||evidence.uncertain&&evidence.midi===null;
  if(waiting){
    if(state.running){state.session?.pause(time);follow?.pause(time);backingPlayer?.stop();state.running=false;micSpeechPaused=true;}
    if(evidence.speech&&state.mode==='flow')state.inputInterrupted=true;
    renderPractice();$('#stage-state').textContent=evidence.speech?'Слышу речь — подожду тишины.':'Уточняю звук — это не ошибка.';return;
  }
  if(micSpeechPaused){
    micSpeechPaused=false;
    if(state.view!=='practice'||state.source!=='mic'||!state.session||state.session.finished)return;
    state.session.resume(time);follow?.play(time);state.running=true;renderPractice();
  }
  if(Number.isInteger(evidence.midi))noteEvidence.set(evidence.midi,time);
  if(Number.isInteger(evidence.heldMidi))noteEvidence.set(evidence.heldMidi,time);
  const polySession=state.session instanceof ChordSession||(state.mode==='flow'&&lesson().polyphonic&&state.session instanceof TimedSession);
  if(polySession&&evidence.polySamples&&time-lastPolyFrame>=95){
    lastPolyFrame=time;const group=state.session.groupNotes,pending=state.session.expectedNotes;
    const result=polyInput.process(evidence.polySamples,micContext.sampleRate,group,time,{minRms:minRms(),groupId:`${lessonGeneration}:${state.session.index}`,resolvedNotes:group.filter(m=>!pending.includes(m))});
    state.polyNeedsRelease=result.needsRelease.length>0;
    for(const hit of result.detected)noteEvidence.set(hit.midi,time);
    if(result.onsets.length){for(const midi of result.onsets)processNote(midi,'mic');return;}
  }
  if(Number.isInteger(evidence.midi)&&(!polySession||!state.session.groupNotes.includes(evidence.midi)))processNote(evidence.midi,'mic',Number.isFinite(evidence.onsetAt)?evidence.onsetAt+offset:null);
}

function beginCountdown() {
  if(!state.mic || state.view!=='practice' || micContext?.state!=='running') return;
  // The moving score supplies the only count-in; do not stack a second timer.
  clearInterval(countdownTimer);state.countdown=0;state.phase='idle';activateSession('mic');
}
function activateSession(source) {
  embeddedActive=true;
  clearTimeout(inputIdleTimer);
  state.source=source;
  if(!state.session || state.session.finished) {state.practiceOutcome=null;state.inputInterrupted=false;state.inputHeard=null;state.inputAccepted=null;resetFollow();const score=notes(),timeline=createScoreTimeline(score,{tempo:settings.tempo,preserveTiming:!!lesson().preserveTiming,sourceTempo:lesson().sourceTempo||lesson().tempo||60});state.activePolicy=practicePolicy({lesson:lesson(),mode:state.mode,source,retry:state.quickStart===true,timeline});state.quickStart=false;state.attemptId=globalThis.crypto?.randomUUID?.()||Date.now()+':'+Math.random();state.assisted=!!(taskHelpSticky||state.microRevealed||state.microPlan?.stages.find(s=>s.id===state.microStageId)?.coverage&&state.mode==='check');state.session=state.mode==='flow'?new TimedSession(score,{timeline,now:now(),leadIn:state.activePolicy.leadIn,window:state.activePolicy.windowSeconds,inputGrace:state.activePolicy.inputGrace,maxConsecutive:state.activePolicy.maxConsecutive,strictRests:!state.rhythmGuided&&(state.learningTask?.kind==='rhythm'||lesson().practiceKind==='rhythm')}):lesson().polyphonic?new ChordSession(score.map((n,i)=>({...n,time:n.time??timeline[i].time,duration:n.duration??timeline[i].duration})),now()):new MasterySession(score,now());state.saved=false;state.revealed=state.microRevealed===true&&state.microHelpLevel<=1;state.attemptBpm=settings.tempo;}
  else state.session.resume(now());
  if(state.microPlan&&state.assisted)state.session.markAssisted?.();
  resetDetector();state.running=true;state.phase='idle';
  ensureFollow().play(now());
  coach(state.performancePlan&&!state.breakdown?state.performancePlan.stage.instruction:state.microPlan?microStage().instruction:source==='demo' ? 'Это демо: микрофон не включён, результат не попадёт в историю.' : (isCourse()||state.customLesson) && state.mode==='check' ? 'Сыграй названные ноты на синтезаторе. Оценка от 0 до 10 за весь фрагмент; для перехода нужно 8 или больше.' : 'Сыграй подсвеченную ноту. Между повторами отпускай клавишу.');
  renderPractice();showFingerHint(state.session.index===0?'start':'resume');
}
function openLearningTask(task){
  if(!task||!COURSE.some(l=>l.id===task.lessonId))throw new Error('Не найдено упражнение для этого шага.');
  state.learningTask=null;chooseCourse(task.lessonId,{start:false});pausePractice({keepInput:true});stopPlayback();pendingNative=null;resetFollow();state.learningTask=task;state.rhythmGuided=!!task.guidedPresentation;taskHelpSticky=task.assisted===true;state.assisted=taskHelpSticky;state.nativeFlow=task.kind==='new';state.session=null;state.saved=false;state.revealed=false;state.taskPassed=false;state.needsIntro=true;
  state.mode=task.kind==='rhythm'?'flow':task.kind==='new'?'learn':'check';coach(task.instruction||'Сыграй короткий рисунок.');applyLessonTempo();renderPractice();
  if(!beginCourseEntry()&&!beginMicroLesson())startLessonIntro();
}
function repeatLearningTask(){if(state.performancePlan&&!state.breakdown){startPerformance();return;}pausePractice({keepInput:true});stopPlayback();closeResult();state.quickStart=true;state.session=null;state.saved=false;state.revealed=false;state.assisted=false;state.source=settings.input;if(state.microPlan){state.microRevealed=false;state.microHelpLevel=microLevel(microStage());rememberMicro();}resetFollow();renderPractice();startPractice().catch(()=>failMic({}));}
function completeFlatTask(report,beta,demo){
  state.session.pause(now());keepInputWarm();backingPlayer?.stop();hideFingerHint();
  const passed=!demo&&!beta&&!state.assisted&&!report.assisted&&report.firstAttemptCorrect*10>=report.total*8;
  if(!demo&&!state.saved){settings.history.unshift({lesson:lesson().id,title:lesson().title,at:Date.now(),accuracy:report.accuracy,correct:report.correct,seconds:report.seconds,metric:report.metric,score:report.scoreOutOf10,kind:state.learningTask.kind});settings.history=settings.history.slice(0,50);state.saved=true;persist();}
  if(passed){state.taskPassed=true;postplayTransition(report,finishDailyTask);return;}
  if(!demo){postplayTransition(report,repeatLearningTask,{nextLabel:'Повторить'});return;}
  $('#result-title').textContent='Демо завершено';$('#result-subtitle').textContent=lesson().title;$('#result-accuracy').textContent=report.scoreOutOf10+'/10';$('#result-correct').textContent=report.correct+'/'+report.total;$('#result-time').textContent=durationText(report.seconds);$('#result-advice').textContent='Игра на экранных клавишах не сохраняется как самостоятельная игра на инструменте.';$('#flow-polish').hidden=true;$('#flow-next').hidden=true;$('#study-continue').hidden=true;$('#next-course-button').hidden=true;$('#repeat-button').hidden=false;$('#repeat-button').textContent='Повторить';$('#next-lesson-button').hidden=false;$('#reply-area').hidden=true;openDialog('result',false);
}
async function startPractice() {
  if(options.embedded&&options.isActive&&!options.isActive())return;
  clearTimeout(inputIdleTimer);
  teacher.unlock().catch(()=>{});
  if(['permission','countdown','coaching','intro'].includes(state.phase)) {pausePractice();return;}
  if(state.running) {pausePractice();return;}
  teacher.cancel();
  stopPlayback();
  if(notes().some(n=>n.midi<36||n.midi>96)){toast('Эти ноты выходят за 61 клавишу. Выбери среднюю октаву в настройках.');return;}
  ensureSynth();
  if(state.source==='demo' && state.session && !state.session.finished) {activateSession('demo');return;}
  if(settings.input==='midi'){
    const generation=++inputGeneration;state.phase='permission';renderPractice();
    try{const ready=await midiInput.start();if(generation!==inputGeneration||state.view!=='practice')return;state.phase='idle';if(ready)activateSession('midi');}
    catch(error){if(generation===inputGeneration){state.phase='idle';toast(error.message||'Не удалось подключить MIDI.');renderPractice();}}return;
  }
  state.source='mic';
  const generation=++inputGeneration;
  const ready=await enableMic();
  if(generation!==inputGeneration || !ready || state.view!=='practice' || !state.mic) return;
  activateSession('mic');
}
function keepInputWarm(){clearTimeout(inputIdleTimer);inputIdleTimer=setTimeout(()=>{if(!state.running){midiInput.stop();stopMic();}},15000);}
function pausePractice({keepInput=false}={}) {
  micSpeechPaused=false;
  if(state.phase==='permission'&&!state.mic)stopMic();
  postplay.cancel();postplayAction=null;postplayFeedback=null;
  hideFingerHint();
  ++presentationGeneration;clearTimeout(transitionTimer);state.transitioning=false;$('#stage-transition').hidden=true;
  presenter.cancel();state.intro=null;
  ++inputGeneration;if(!keepInput)midiInput.stop();follow?.pause(now());backingPlayer?.stop();
  ++autoGeneration;clearTimeout(autoTimer);teacher.cancel();
  clearInterval(countdownTimer);
  if(state.session) state.session.pause(now());
  state.running=false;state.phase='idle';if(keepInput)keepInputWarm();else stopMic();
  if('speechSynthesis' in window) speechSynthesis.cancel();
  renderPractice();
}
function startDemo() {
  pausePractice();stopPlayback();state.nativeFlow=false;state.needsIntro=false;state.session=null;state.source='demo';activateSession('demo');
}
function processNote(midi,source,onsetAt=null) {
  if(!state.running || !state.session || state.source!==source) return;
  const map=$('#phrase-keyboard-map');if(map?.dataset){map.dataset.dismissed='true';map.setAttribute?.('aria-hidden','true');}
  const time=now(),transport=ensureFollow(),gateTime=practiceTimeline[state.session.index]?.time??Infinity;
  if(state.mode!=='flow'&&!strictMemory()&&transport.tick(time).time<gateTime-.12){if(expectedNotes().includes(midi))earlyNotes.remember(midi,{index:state.session.index,source,at:time});if(time-earlyPromptAt>3000){toast('Дождись, когда нота подойдёт к клавиатуре.');earlyPromptAt=time;}return;}
  const result=state.session instanceof TimedSession?state.session.play(midi,time,source==='mic'&&state.activePolicy?.inputGrace>0&&Number.isFinite(onsetAt)?{onsetAt}:{}):state.session.play(midi,time);
  state.inputHeard=midi;practiceScene?.refresh();
  if(result.kind!=='wrong'&&result.kind!=='ignored')state.inputAccepted=midi;
  if(result.kind==='ignored'){if(result.timing==='late'){state.feedbackMessage='Нота верная — сыграй чуть раньше.';state.feedbackUntil=time+1100;}return;}
  if(result.kind!=='wrong'){state.feedbackUntil=0;state.feedbackMessage='';follow?.seekIndex(state.session.index,now());}
  feedback.push({midi,at:now(),wrong:result.kind==='wrong'});
  clearTimeout(keyFeedbackTimer);keyFeedbackTimer=setTimeout(()=>highlightKeys(),220);
  if(result.kind==='wrong'&&result.timing==='rest'){state.feedbackMessage='Сейчас пауза. Дождись следующей ноты.';state.feedbackUntil=now()+1400;coach(state.feedbackMessage);renderPractice();highlightKeys(midi,true);return;}
  if(result.kind==='wrong'&&strictMemory()){state.revealed=false;coach('Продолжай рисунок самостоятельно. Если забыл, можно послушать пример в настройках.');renderPractice();highlightKeys(midi,true);return;}
  if(result.kind==='wrong') {
    const hiddenAnswer=presentation()?.target===false&&presentation()?.names===false;
    const wanted=noteInfo(result.expected), played=noteInfo(midi);
    const sameName=midi%12===result.expected%12;
    state.revealed=!hiddenAnswer;state.feedbackMessage=hiddenAnswer?'Не эта клавиша. Ориентируйся по нотам; после игры разберём ошибку.':sameName?`${wanted.name} нужна ${midi>result.expected?'ниже':'выше'} — в другой октаве.`:`Это ${played.name}. Нужна ${wanted.name}.`;state.feedbackUntil=now()+1800;
    const message=hiddenAnswer?state.feedbackMessage:sameName ? `Это тоже ${played.name}, но ${midi>result.expected ? 'выше' : 'ниже'} нужной. Найди ${wanted.name} ближе к ${midi>result.expected?'левому':'правому'} краю клавиатуры.` : `Это ${played.name}. Нужна ${wanted.name} — ${midi>result.expected?'левее':'правее'} по клавиатуре.`;
    coach(message);
    // Correct in place. The voice review comes after the phrase, without
    // interrupting the same physical attempt on each uncertain attack.
  } else if(result.kind==='complete') {completePractice();return;}
  else {state.revealed=false;if(state.session.index%4===0)coach(lesson().polyphonic?'Ноты одного столбика играй вместе. Продолжай спокойно.':'Хорошо, фраза складывается. Продолжай спокойно, по одной ноте.');}
  renderPractice();highlightKeys(midi,result.kind==='wrong');
  if(result.kind!=='wrong'&&state.running){const phrase=notes(),at=state.session.index;showFingerHint(at>0&&phrase[at]&&phrase[at].beats!==phrase[at-1].beats?'rhythm':'transition');}
}
function reportAdvice(report) {
  if(report.correct===0) return 'Все ноты были пропущены. Попробуй начать с «Первых пяти нот» и найти каждую клавишу без спешки.';
  if(report.errors.length) {
    const counts=new Map();for(const error of report.errors) counts.set(error.expected,(counts.get(error.expected)||0)+1);
    const [midi]=[...counts].sort((a,b)=>b[1]-a[1])[0], n=noteInfo(midi);
    return `Чаще всего было трудно найти ${n.name} (${n.latin}). Прослушай эту ноту на экранной клавиатуре, затем найди её на синтезаторе и повтори мелодию.`;
  }
  if(report.skipped) return `Верные ноты найдены. Осталось спокойно разобрать ${report.skipped} пропущенных — в следующем проходе попробуй обойтись без пропусков.`;
  return 'Все ноты найдены с первой попытки. Повтори мелодию, затем попробуй сыграть короткую фразу по памяти.';
}
function completePractice() {
  if(state.mode==='flow'){completeFlowPractice();return;}
  $('#result-dialog .result-metrics div:nth-child(2) span').textContent='С исправлениями';
  $('#flow-polish').hidden=true;$('#flow-next').hidden=true;$('#repeat-button').hidden=false;$('#next-lesson-button').hidden=false;
  follow?.pause(now());backingPlayer?.stop();
  const beta=lesson().polyphonic&&state.source==='mic';
  const report={...state.session.report(now()),mode:beta?'learn':state.mode}, demo=state.source==='demo';
  if(inputProblem(report))return;
  ++autoGeneration;
  state.running=false;state.phase='idle';state.lastReport=report;state.reviewText='';
  if(state.microPlan&&completeMicroPractice(report,{beta,demo}))return;
  emitLearningReport(report,beta);
  if(state.breakdown&&!demo){
    keepInputWarm();hideFingerHint();
    if(!state.saved){settings.history.unshift({lesson:lesson().id,title:lesson().title+' · короткий повтор',at:Date.now(),accuracy:report.accuracy,correct:report.correct,seconds:report.seconds,metric:report.metric,score:report.scoreOutOf10,kind:'repair'});settings.history=settings.history.slice(0,50);state.saved=true;persist();}
    const ready=report.firstAttemptCorrect*10>=report.total*8;
    postplayTransition(report,ready?returnToWhole:repeatLearningTask,{nextLabel:ready?'К целой фразе':'Повторить участок'});return;
  }
  if(state.learningTask&&['reading','recall'].includes(state.learningTask.kind)){completeFlatTask(report,beta,demo);return;}
  const isCheck=(isCourse()||state.customLesson) && state.mode==='check' && !state.breakdown&&!beta;
  const studyStage=state.studyPlan?.stages.find(s=>s.id===state.studyStageId),shortStudy=studyStage&&!studyStage.whole&&studyStage.hand!=='both';
  const route=chooseNativeRoute({native:state.nativeFlow,demo,breakdown:state.breakdown,kind:isCourse()?'course':'composition',mode:state.mode,report,next:isCourse()?!!lesson().nextId:!!studyStage&&!studyStage.whole,whole:!!studyStage?.whole,simple:isCourse()?lesson().type!=='phrase':!!shortStudy});
  const autoRetry=route==='retry'||(!demo&&((isCourse()&&isCheck&&!report.passed&&lesson().type!=='phrase')||(shortStudy&&report.firstAttemptCorrect/report.total<.8)));
  keepInputWarm();
  if(!demo && !state.saved) {
    if(state.studyPlan&&state.studyStageId)settings.studyProgress[state.studyPlan.id]=recordStudyAttempt(state.studyPlan,studyProgress(),state.studyStageId,report,{demo,breakdown:state.breakdown,mode:state.mode,source:state.source,assisted:state.assisted||taskHelpSticky,beta,answerShown:state.revealed,at:Date.now()});
    if(isCourse()&&isCheck&&!state.assisted&&!report.assisted)settings.courseProgress=recordCourseAttempt(settings.courseProgress,state.courseId,report,{at:Date.now()});
    if(state.compositionKey){const progressKey=state.breakdown?`${state.compositionKey}:section:${state.sectionRange?.start}:${state.sectionRange?.end}`:state.compositionKey;const previous=settings.compositionProgress[progressKey]||{};settings.compositionProgress[progressKey]={...previous,practiced:true,passed:previous.passed===true || (isCheck&&report.passed),score:report.scoreOutOf10,at:Date.now()};}
    settings.history.unshift({lesson:isCourse()?state.courseId:settings.lesson,title:state.breakdown?`${lesson().title} · ноты ${(state.sectionRange?.start||0)+1}–${state.sectionRange?.end||3}`:lesson().title,at:Date.now(),accuracy:report.accuracy,correct:report.correct,seconds:report.seconds,metric:report.metric,score:report.scoreOutOf10,kind:beta?'beta':isCheck?'check':'learn'});
    settings.history=settings.history.slice(0,50);state.saved=true;persist();
  }
  if(studyStage&&!demo){
    if(report.firstAttemptCorrect*10<report.total*8){state.songFailures=(state.songFailureStage===state.studyStageId?state.songFailures||0:0)+1;state.songFailureStage=state.studyStageId;if(shortStudy){postplayTransition(report,repeatLearningTask,{nextLabel:'Повторить фразу'});return;}}
    else state.songFailures=0;
  }
  $('#result-title').textContent=demo ? 'Демо пройдено' : state.breakdown?'Маленький фрагмент разобран':isCheck ? report.passed?'Упражнение освоено':'Попробуем ещё раз':'Фраза разобрана';
  $('#result-subtitle').textContent=demo ? 'Теперь попробуй ту же мелодию на синтезаторе через микрофон.' : lesson().title;
  $('#result-accuracy').textContent=`${report.scoreOutOf10}/10`;$('#result-correct').textContent=`${report.correct}/${report.total}`;
  if(beta)$('#result-accuracy').textContent='Бета';
  $('#result-time').textContent=durationText(report.seconds);$('#result-advice').textContent=demo ? 'В демо оценивались нажатия на экранные клавиши. Эти результаты не сохранены в прогресс.' : reportAdvice(report);
  const status=isCourse()?courseLessonStatus(settings.courseProgress,state.courseId):null;
  let advice=demo?'Это экранное демо. Результат не сохранён как игра на синтезаторе.':state.breakdown?'Разобрали трудный участок. Вернёмся к полному упражнению.':isCheck?report.passed?`Оценка ${report.scoreOutOf10} из 10. ${report.firstAttemptCorrect} из ${report.total} нот с первой попытки. Проверка пройдена.`:status?.needsBreakdown?'Повторим место, где были ошибки, затем вернёмся к полному упражнению.':`Оценка ${report.scoreOutOf10} из 10. Для перехода нужно 8 или больше. ${reportAdvice(report)}`:(isCourse()||state.customLesson)?'Ноты разобраны. Теперь попробуй проверку без подсветки нужной клавиши.':reportAdvice(report);
  if(state.studyStageId&&!demo&&!state.breakdown&&!isCheck)advice=`${report.scoreOutOf10} из 10. ${report.firstAttemptCorrect/report.total>=.8?'Этот фрагмент разобран с подсказками. Можно идти дальше или повторить.':'Для перехода нужно 8 из 10. Повторим этот фрагмент.'}`;
  $('#result-advice').textContent=advice;coach(advice);
  $('#repeat-button').textContent=state.breakdown?'Повторить этот участок':beta?'Повторить без оценки':(isCourse()||state.customLesson) && state.mode==='learn'?'Перейти к проверке':autoRetry?'Повторить сейчас':'Повторить фразу';
  const studyReady=!!(state.studyPlan&&state.studyStageId&&!demo&&!state.breakdown&&isStudyStageComplete(state.studyPlan,studyProgress(),state.studyStageId));
  $('#study-continue').hidden=!studyReady;
  $('#repeat-button').classList.toggle('primary-button',!studyReady);$('#repeat-button').classList.toggle('secondary-button',studyReady);
  if(state.studyStageId){
    const stages=state.studyPlan.stages,index=stages.findIndex(s=>s.id===state.studyStageId),next=stages[index+1];
    $('#study-continue').textContent=next?`Дальше: ${next.whole?'вся мелодия':next.hand!==state.hand?{right:'правая рука',left:'левая рука',both:'две руки'}[next.hand]:`кусок ${next.part}`}`:'Выбрать композицию';
    $('#repeat-button').textContent='Повторить фрагмент';$('#next-lesson-button').textContent='Этапы композиции';
  }else $('#next-lesson-button').textContent='К списку';
  $('#problem-repeat').hidden=!report.errors.length;$('#return-whole').hidden=!state.breakdown;
  $('#next-course-button').hidden=!(isCheck && report.passed && !demo && lesson().nextId);
  $('#reply-area').hidden=true;$('#review-status').textContent='';
  if(state.learningTask?.learningRoute==='guided-check'&&isCheck&&!demo){const passed=!beta&&report.firstAttemptCorrect/report.total>=.8&&!state.assisted&&!report.assisted;postplayTransition(report,passed?finishDailyTask:repeatLearningTask,{nextLabel:passed?'Продолжить':'Повторить самостоятельно'});return;}
  if(isCheck&&!demo&&!beta&&state.microPlan?.route?.kind==='adaptive-foundation'){
    const passed=report.passed&&!state.assisted&&!report.assisted;
    postplayTransition(report,passed?()=>{if(lesson().nextId)chooseCourse(lesson().nextId);else navigate('course');}:repeatLearningTask,{nextLabel:passed?'Следующий урок':'Повторить самостоятельно'});return;
  }
  if(beta&&isCourse()&&!demo&&report.firstAttemptCorrect/report.total>=.8){postplayTransition(report,()=>startFlowLevel(flowDestination(),{immediate:true}),{nextLabel:'В темпе'});return;}
  if(route==='course-check'){postplayTransition(report,checkCurrentCourse,{nextLabel:'Самостоятельно'});return;}
  if(route==='course-next'||(route==='finish'&&isCourse())){postplayTransition(report,()=>startFlowLevel(flowDestination(),{immediate:true}),{nextLabel:'В темпе'});return;}
  if(route==='study-next'){
    if(studyStage.hand==='both'){postplayTransition(report,()=>startFlowLevel(flowDestination(),{immediate:true}),{nextLabel:'В темпе'});return;}
    const index=state.studyPlan.stages.findIndex(s=>s.id===state.studyStageId),next=state.studyPlan.stages[index+1];
    const label=next.whole?'Теперь вся песня':next.part!==studyStage.part?'Следующий кусок':next.hand==='left'?'Теперь левая рука':next.hand==='both'?'Соединим обе руки':'Теперь правая рука';
    postplayTransition(report,advanceStudy,{nextLabel:label});return;
  }
  if(route==='finish'&&state.studyStageId){postplayTransition(report,()=>startFlowLevel(flowDestination(),{immediate:true}),{nextLabel:'В темпе'});return;}
  if(!demo){postplayTransition(report,autoRetry?repeatLearningTask:studyReady?advanceStudy:state.breakdown?returnToWhole:repeatLearningTask,{autoContinue:autoRetry,nextLabel:autoRetry?'Повторить':studyReady?'Продолжить':state.breakdown?'К целой фразе':'Повторить'});return;}
  renderPractice();openDialog('result',false);
}

function ensureSynth() {
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio) {toast('Браузер не поддерживает воспроизведение примера.');return null;}
  if(!synthContext||synthContext.state==='closed'){backingPlayer?.dispose();backingPlayer=null;backingKey='';synthContext=new Audio();}
  synthContext.resume().catch(()=>{});return synthContext;
}
function soundNote(midi,start,duration=.4) {
  const ctx=synthContext; if(!ctx) return;
  const gain=ctx.createGain(), filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.setValueAtTime(2600,start);filter.frequency.exponentialRampToValueAtTime(800,start+duration);
  const fundamental=ctx.createOscillator(),harmonic=ctx.createOscillator();fundamental.type='triangle';fundamental.frequency.value=frequencyForMidi(midi);harmonic.type='sine';harmonic.frequency.value=frequencyForMidi(midi)*2;
  const harmonicGain=ctx.createGain();harmonicGain.gain.value=.16;
  fundamental.connect(filter);harmonic.connect(harmonicGain);harmonicGain.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.19,start+.008);gain.gain.exponentialRampToValueAtTime(.015,start+duration);gain.gain.exponentialRampToValueAtTime(.0001,start+duration+.12);
  fundamental.start(start);harmonic.start(start);fundamental.stop(start+duration+.16);harmonic.stop(start+duration+.16);
  const pair=[fundamental,harmonic];playbackNodes.push(...pair);
  fundamental.onended=()=>{fundamental.disconnect();harmonic.disconnect();harmonicGain.disconnect();filter.disconnect();gain.disconnect();playbackNodes=playbackNodes.filter(n=>!pair.includes(n));};
}
function stopPlayback() {
  const wasPlaying=state.preview||playbackNodes.length>0||playbackTimers.length>0;
  ++playbackGeneration;
  cancelAnimationFrame(scoreFrame);scoreFrame=0;
  playbackTimers.forEach(clearTimeout);playbackTimers=[];
  for(const node of playbackNodes) {try{node.stop();}catch{}}playbackNodes=[];
  state.preview=false;state.previewStep=null;
  if(wasPlaying)gateUntil=Math.max(gateUntil,now()+300);
}
async function playExample() {
  const allowedStimulus=state.courseId?.startsWith('v2-')&&microStage()?.replayAllowed===true&&(state.session?.index||0)===0;
  if(state.microPlan&&!allowedStimulus){state.assisted=true;state.session?.markAssisted();state.microRevealed=true;state.microHelpLevel=0;state.revealed=true;if(microStage()?.assessment)markAssisted();rememberMicro();}
  else if(!allowedStimulus&&(state.learningTask||state.studyPlan?.stages.find(s=>s.id===state.studyStageId)?.purpose==='independent'))markAssisted();
  if(state.preview) {stopPlayback();renderPractice();return;}
  const ctx=ensureSynth();if(!ctx)return;
  pausePractice();stopPlayback();const generation=playbackGeneration;
  try{await ctx.resume();}catch{toast('Нажми «Послушать» ещё раз, чтобы включить звук.');return;}
  if(generation!==playbackGeneration||ctx.state!=='running')return;
  const phrase=notes();previewTimeline=createScoreTimeline(phrase,{tempo:settings.tempo,preserveTiming:!!lesson().preserveTiming,sourceTempo:lesson().sourceTempo||lesson().tempo||60});
  previewStartedAt=now()+80;state.preview=true;renderPractice();
  let offset=.08;const audioStart=ctx.currentTime;
  previewTimeline.forEach((n,i)=>{
    const start=.08+n.time;
    soundNote(n.midi,audioStart+start,n.duration);
    playbackTimers.push(setTimeout(()=>{if(generation!==playbackGeneration || !state.preview)return;state.previewStep=i;highlightKeys(n.midi);$('#step-label').textContent=`Показ · ${i+1} из ${phrase.length}`;const info=noteInfo(n.midi);$('#target-note').innerHTML=`${info.name}<span>${info.latin}</span>`;drawScore();},start*1000));
    offset=Math.max(offset,start+n.duration);
  });
  playbackTimers.push(setTimeout(()=>{if(generation!==playbackGeneration)return;stopPlayback();renderPractice();},(offset+.15)*1000));
}
function auditionKey(midi) {
  if(['permission','countdown','coaching','intro'].includes(state.phase)) return;
  const map=$('#phrase-keyboard-map');if(map?.dataset){map.dataset.dismissed='true';map.setAttribute?.('aria-hidden','true');}
  if((isCourse()||state.customLesson)&&['check','flow'].includes(state.mode)&&state.source!=='demo'&&state.session&&!state.session.finished){markAssisted();state.revealed=true;}
  const ctx=ensureSynth();if(ctx){soundNote(midi,ctx.currentTime,.35);gateUntil=now()+700;resetDetector();}
  if(state.source==='demo') processNote(midi,'demo');
  else {highlightKeys(midi);setTimeout(()=>{if(!state.running)highlightKeys();},450);}
}
const COVER_IMAGES=Object.fromEntries(['moon','elise','joy','star','custom'].map(id=>[id,new URL('./covers/'+id+'.svg',import.meta.url).href]));
function compositionCover(c){const name=(c.id+' '+c.title).toLowerCase();return /moon|fly/.test(name)?'moon':/elise|fur|элиз/.test(name)?'elise':/joy|радост/.test(name)?'joy':/star|звезд/.test(name)?'star':'custom';}
function updateCarousel(){
  carouselFrame=0;const list=$('#lesson-list'),cards=[...list.children];if(!cards.length||!list.clientWidth)return;
  const middle=list.getBoundingClientRect().left+list.clientWidth/2;let nearest=0,distance=Infinity;cards.forEach((card,i)=>{const r=card.getBoundingClientRect(),d=Math.abs(r.left+r.width/2-middle);if(d<distance){nearest=i;distance=d;}});state.libraryPage=nearest;
  cards.forEach((card,i)=>{card.classList.toggle('active',i===nearest);card.setAttribute('aria-current',String(i===nearest));});$('#library-page').textContent=(nearest+1)+' / '+cards.length;$('#library-prev').disabled=nearest===0;$('#library-next').disabled=nearest===cards.length-1;
}
function moveCarousel(delta){const cards=[...$('#lesson-list').children],at=clamp(state.libraryPage+delta,0,cards.length-1);cards[at]?.scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'nearest',inline:'center'});}
function renderLibrary() {
  const list=allCompositions(),selected=clamp(state.libraryPage,0,list.length-1);$('#lesson-list').innerHTML=list.map(c=>`<button class="lesson-card composition-card" data-composition="${escapeHtml(c.id)}" aria-label="${escapeHtml(c.title)} · ${settings.studyProgress[c.id]?.cursor?'Продолжить изучение':'Начать изучение'}"><div class="composition-cover"><img src="${COVER_IMAGES[compositionCover(c)]}" alt="" draggable="false"></div><div class="composition-copy"><h2>${escapeHtml(c.title)}</h2><p class="author">${escapeHtml(c.author||'Твой MIDI')}</p><span class="composition-action">${settings.studyProgress[c.id]?.cursor?'Продолжить':'Начать изучение'} ${icon('play')}</span></div></button>`).join('');
  requestAnimationFrame(()=>{if(state.view!=='library')return;$('#lesson-list').children[selected]?.scrollIntoView({behavior:'instant',block:'nearest',inline:'center'});updateCarousel();});
}
function readImportedCompositions(){try{const v=JSON.parse(localStorage.getItem('flow-piano-compositions-v1')||'[]');return Array.isArray(v)?v.filter(c=>c&&typeof c.id==='string'&&typeof c.title==='string'&&c.source==='midi'&&Array.isArray(c.tracks)&&c.tracks.length<=64&&c.tracks.every(t=>Array.isArray(t.notes)&&t.notes.length<=5000)).slice(0,8):[];}catch{return [];}}
let importedCompositions=readImportedCompositions();
let externalCompositions=options.compositions||[];
const allCompositions=()=>[...COMPOSITIONS,...externalCompositions,...importedCompositions].filter((c,i,a)=>a.findIndex(o=>o.id===c.id)===i);
const studyProgress=()=>normalizeStudyProgress(state.studyPlan,settings.studyProgress[state.studyPlan.id]);
const studyPhase=stage=>stage.kind==='check'?'independent':stage.kind==='connection'?'connection':stage.whole?'whole':stage.hand;
const phaseLabels={right:'Правая рука',left:'Левая рука',both:'Две руки',connection:'Соединяем фразы',whole:'Целая мелодия',independent:'Самостоятельно'};
const studyStageLabel=stage=>stage.kind==='check'?'Самостоятельно · целиком':stage.kind==='connection'?`Фразы ${stage.fromPart}–${stage.toPart} вместе`:stage.whole?'Вся учебная версия':`Фраза ${stage.part} из ${stage.parts}`;
function openCompositionStudy(id){
  const composition=allCompositions().find(c=>c.id===id);if(!composition)return;
  try{state.studyPlan=createCompositionStudy(composition);}catch(error){toast(error.message||'Не удалось подготовить обучение.');return;}
  state.compositionId=id;const progress=studyProgress(),pending=settings.pendingFlow,stage=state.studyPlan.stages.find(s=>s.id===(pending?.compositionId===id&&pending.studyVersion===state.studyPlan.version?pending.stageId:progress.cursor))||state.studyPlan.stages[0];
  if(pending?.compositionId===id&&pending.studyVersion!==state.studyPlan.version)settings.pendingFlow=null;
  state.studyPhase=studyPhase(stage);state.studyPage=0;state.nativeFlow=true;startStudyStage(stage.id);
}
function renderStudy(){
  const plan=state.studyPlan;if(!plan)return;const progress=studyProgress(),stages=plan.stages;
  const current=stages.find(s=>s.id===progress.cursor)||stages[0],phases=[...new Set(stages.map(studyPhase))];
  const guided=stages.filter(s=>s.purpose!=='independent'),done=guided.filter(s=>progress.completed.includes(s.id)).length;
  $('#study-summary').innerHTML=`<button class="navigation-back" data-view="library">← Композиции</button><h2>${escapeHtml(plan.title)}</h2><p>${progress.mastery?'Вся учебная версия сыграна самостоятельно':`${done} из ${guided.length} шагов разобрано`}</p><small>По фразам: руки отдельно, вместе, соединение и самостоятельный проход.${progress.legacy?' Прежние разборы сохранены; новый маршрут проверяем отдельно.':''}</small><button class="primary-button" data-study-stage="${escapeHtml(current.id)}">${settings.studyProgress[plan.id]?.cursor?'Продолжить':'Начать изучение'}${icon('arrow')}</button>`;
  $('#study-phase').innerHTML=phases.map((phase,i)=>`<option value="${phase}" ${state.studyPhase===phase?'selected':''}>${i+1} · ${phaseLabels[phase]}</option>`).join('');
  const phase=stages.filter(s=>studyPhase(s)===state.studyPhase),size=6,pages=Math.ceil(phase.length/size);state.studyPage=clamp(state.studyPage,0,pages-1);
  $('#study-stages').innerHTML=phase.slice(state.studyPage*size,(state.studyPage+1)*size).map(s=>`<button class="study-stage ${isStudyStageComplete(plan,progress,s.id)?'passed':''} ${s.id===current.id?'current':''}" data-study-stage="${escapeHtml(s.id)}"><strong>${escapeHtml(studyStageLabel(s))}</strong><span>Нот: ${s.notes.length}${isStudyStageComplete(plan,progress,s.id)?s.purpose==='independent'?' · самостоятельно':' · разобрано':''}</span></button>`).join('');
  $('#study-page').textContent=`${state.studyPage+1} / ${pages}`;$('#study-prev').disabled=!state.studyPage;$('#study-next').disabled=state.studyPage>=pages-1;
}
function startStudyStage(id,{present=true}={}){
  if(state.microPlan)clearMicroLesson();
  const plan=state.studyPlan,stage=plan?.stages.find(s=>s.id===id);if(!stage)return;
  const c=allCompositions().find(c=>c.id===plan.id);if(!c)return;
  pausePractice({keepInput:state.view==='practice'});stopPlayback();resetFollow();closeResult();pendingNative=null;++lessonGeneration;
  resetFlowState();
  state.nativeFlow=true;state.needsIntro=present&&stage.purpose!=='independent';state.courseId=null;state.studyStageId=id;state.compositionId=c.id;state.hand=stage.hand;state.mode=stage.requiredMode||'learn';state.breakdown=false;state.repairReturnMode=null;state.songFailures=0;state.sectionRange=null;state.revealed=false;state.assisted=false;state.session=null;state.source=settings.input;state.saved=false;state.lastReport=null;
  if(!state.learningTask)taskHelpSticky=false;
  state.customLesson={id:stage.id,compositionId:c.id,title:`${c.title} · ${studyStageLabel(stage)}`,author:c.author||'Твой MIDI',notes:stage.notes,backing:stage.backing,type:'phrase',tempo:stage.sourceTempo,preserveTiming:true,hand:{right:'Правая рука',left:'Левая рука',both:'Две руки'}[stage.hand],polyphonic:stage.notes.some((n,i)=>i>0&&n.time-stage.notes[i-1].time<=.035),availableHands:stage.availableHands,description:stage.description,backingDescription:stage.backingDescription,instruction:stage.instruction};
  state.compositionKey=[plan.id,plan.version,stage.id].join(':');settings.studyProgress[plan.id]={...studyProgress(),cursor:id};persist();applyLessonTempo();coach(stage.instruction);navigate('practice');if(stage.rangeIssue)toast(stage.rangeIssue);const pending=settings.pendingFlow;if(pending?.compositionId===plan.id&&pending.studyVersion===plan.version&&pending.stageId===stage.id){if(pending.performance&&startPerformance())return;state.flowGoalReached=pending.goalReached===true;startFlowLevel(flowDestination(),{polish:pending.polish===true});}else if(stage.purpose==='independent'){state.needsIntro=false;state.quickStart=true;startPractice().catch(()=>failMic({}));}else if(present&&!beginSongMicroLesson())startLessonIntro();
}
function advanceStudy(){
  if(!state.studyPlan||!state.studyStageId||state.source==='demo'||state.breakdown||!isStudyStageComplete(state.studyPlan,studyProgress(),state.studyStageId))return;
  const index=state.studyPlan.stages.findIndex(s=>s.id===state.studyStageId),next=state.studyPlan.stages[index+1];closeResult();if(next)startStudyStage(next.id);else navigate('library');
}
function showComposition(id,hand='right'){
  const c=allCompositions().find(c=>c.id===id);if(!c)return;
  if(c.status==='needsImport'){toast('Добавь MIDI-файл этой композиции.');return;}
  let arrangement;try{arrangement=createArrangement(c,{hand,tempo:settings.tempo});}catch(error){toast(error.message||'Не удалось открыть композицию.');return;}
  pausePractice();stopPlayback();resetFollow();++lessonGeneration;
  resetFlowState();pendingNative=null;
  state.courseId=null;state.studyStageId=null;state.mode='learn';state.breakdown=false;state.revealed=false;state.session=null;state.source=settings.input;state.saved=false;state.compositionId=id;state.hand=hand;
  state.customLesson={id:`${c.id}-${hand}`,title:c.title,author:c.author||'Твой MIDI',notes:arrangement.notes,backing:arrangement.backing,type:'phrase',tempo:arrangement.sourceTempo,preserveTiming:true,
    hand:{right:'Правая рука',left:'Левая рука',both:'Две руки'}[hand],polyphonic:hand==='both'||arrangement.notes.some((n,i)=>i>0&&n.time-arrangement.notes[i-1].time<=.035),availableHands:arrangement.availableHands,description:arrangement.description,backingDescription:arrangement.backingDescription,
    instruction:'Нажми воспроизведение и играй ноты, которые подходят к клавиатуре. Если не успел — дорожка подождёт. Начни в спокойном темпе.'};
  state.compositionKey=[c.id,c.arrangementVersion||'midi-v1',hand,'full-v2'].join(':');
  applyLessonTempo();coach(state.customLesson.instruction);navigate('practice');
  if(arrangement.rangeIssue)toast(arrangement.rangeIssue);
}
function renderCompositionControls(){
  const controls=$('#composition-controls');if(!controls)return;controls.hidden=!state.customLesson;
  $('#microphone-settings').hidden=settings.input!=='mic';
  $('#backing-volume-controls').hidden=!settings.accompaniment||!state.customLesson?.backing?.length;
  $('#sound-levels').hidden=settings.input!=='mic'&&(!settings.accompaniment||!state.customLesson?.backing?.length);
  $('#composition-audio').hidden=!state.customLesson;
  for(const button of $$('#input-options button')){button.classList.toggle('selected',button.dataset.input===settings.input);button.setAttribute('aria-pressed',String(button.dataset.input===settings.input));}
  if(!state.customLesson)return;
  $('#hand-options').closest('fieldset').hidden=!!state.studyStageId;
  for(const button of $$('#hand-options button')){button.disabled=!state.customLesson.availableHands.includes(button.dataset.hand);button.classList.toggle('selected',button.dataset.hand===state.hand);button.setAttribute('aria-pressed',String(button.dataset.hand===state.hand));}
  $('#composition-mode-note').textContent=(state.customLesson.polyphonic||state.studyPlan?.stages.find(s=>s.id===state.studyStageId)?.requiresMidi)&&settings.input==='mic'?'Две руки через микрофон — бета. Точный зачёт — с USB MIDI.':state.studyStageId?'':state.customLesson.description;
  $('#composition-mode-note').hidden=!((state.customLesson.polyphonic||state.studyPlan?.stages.find(s=>s.id===state.studyStageId)?.requiresMidi)&&settings.input==='mic');
  $('#backing-switch').checked=settings.accompaniment;$('#backing-switch').disabled=!state.customLesson.backing.length;
  $('#backing-volume').value=Math.round(settings.backingVolume*100);$('#backing-volume-value').value=`${Math.round(settings.backingVolume*100)}%`;
  $('#backing-note').textContent=state.customLesson.backing.length?(state.customLesson.backingDescription||'Остальные партии из MIDI.'):'В этом фрагменте нет отдельного сопровождения.';
  for(const button of $$('#input-options button')){button.classList.toggle('selected',button.dataset.input===settings.input);button.setAttribute('aria-pressed',String(button.dataset.input===settings.input));}
}
function renderCourse(){
  const recommended=ACTIVE_COURSE.find(l=>l.id===settings.pendingFlow?.courseId)||(RECOMMENDED_COURSE.find(l=>!courseLessonStatus(settings.courseProgress,l.id).passed)||RECOMMENDED_COURSE.at(-1)),completed=ACTIVE_COURSE.filter(l=>courseLessonStatus(settings.courseProgress,l.id).passed).length;
  const statusText=$('#tutor-availability')?.textContent||'Подключаем преподавателя…';
  $('#course-home').hidden=state.courseBrowse;$('#course-browse').hidden=!state.courseBrowse;
  $('#course-next').innerHTML=`<small class="home-eyebrow">${escapeHtml(recommended.moduleTitle||'Учимся играть')} · ${completed}/${ACTIVE_COURSE.length}</small><h1>${escapeHtml(recommended.title)}</h1><p>${escapeHtml(recommended.description)}</p><div class="course-home-actions"><button class="primary-button" data-course="${recommended.id}">Продолжить обучение${icon('play')}</button><button class="text-button" data-course-browse>Все уроки</button></div><small id="tutor-availability" role="status">${escapeHtml(statusText)}</small>`;

  const modules=[...new Set(ACTIVE_COURSE.map(l=>l.moduleId||'basics'))];
  state.courseModule=modules.includes(state.courseModule)?state.courseModule:recommended.moduleId||'basics';
  $('#course-module').innerHTML=modules.map((id,i)=>`<option value="${id}" ${id===state.courseModule?'selected':''}>${i+1} · ${escapeHtml(ACTIVE_COURSE.find(l=>(l.moduleId||'basics')===id).moduleTitle||'Первые навыки')}</option>`).join('');
  $('#course-list').innerHTML=ACTIVE_COURSE.filter(l=>(l.moduleId||'basics')===state.courseModule).map(l=>{const status=courseLessonStatus(settings.courseProgress,l.id);return `<button class="course-row ${status.passed?'passed':''}" data-course="${l.id}"><span class="course-number">${status.passed?'✓':ACTIVE_COURSE.indexOf(l)+1}</span><span class="course-copy"><strong>${escapeHtml(l.title)}</strong></span><span class="course-grade">${status.attempts?status.bestScore+'/10':'→'}</span></button>`;}).join('');
}
function chooseCourse(id,{start=true}={}){const l=COURSE.find(l=>l.id===id);if(!l)return;clearMicroLesson();state.rhythmGuided=false;pausePractice({keepInput:state.view==='practice'});stopPlayback();pendingNative=null;++lessonGeneration;resetFlowState();state.nativeFlow=true;state.needsIntro=true;state.studyStageId=null;state.courseModule=l.moduleId;state.courseId=id;state.practiceOutcome=null;state.inputHeard=null;state.inputAccepted=null;state.compositionId=null;state.hand=l.polyphonic||/Обе|Две|очеред/.test(l.hand)?'both':l.hand==='Левая рука'?'left':'right';state.customLesson=null;state.compositionKey=null;state.mode='learn';state.breakdown=false;state.session=null;state.source=settings.input;state.saved=false;state.revealed=false;applyLessonTempo();coach(l.instruction);navigate('practice');if(!start)return;const pending=settings.pendingFlow;if(pending?.courseId===id){state.flowGoalReached=pending.goalReached===true;startFlowLevel(flowDestination(),{polish:pending.polish===true});}else if(!beginCourseEntry()&&!beginMicroLesson())startLessonIntro();}

function renderProgress() {
  const history=settings.history,perPage=2,pages=Math.max(1,Math.ceil(history.length/perPage));state.historyPage=clamp(state.historyPage,0,pages-1);
  if(!history.length) {
    $('#progress-content').innerHTML=`<div class="empty-progress">${icon('chart')}<h2>Первая мелодия впереди</h2><p>Заверши практику через микрофон, и здесь появится результат. Демо на экране в историю не попадает.</p><button class="primary-button" data-view="course">Начать практику</button></div>`;return;
  }
  const correct=history.reduce((s,h)=>s+h.correct,0),seconds=history.reduce((s,h)=>s+h.seconds,0);
  $('#progress-content').innerHTML=`<div class="progress-metrics"><div><strong>${history.length}</strong><span>Завершено занятий</span></div><div><strong>${correct}</strong><span>Найдено нот</span></div><div><strong>${Math.max(1,Math.round(seconds/60))}</strong><span>Минут практики</span></div></div><div class="history-list">${history.slice(state.historyPage*perPage,(state.historyPage+1)*perPage).map(h=>{
    const title=h.title||COURSE.find(l=>l.id===h.lesson)?.title||LESSONS.find(l=>l.id===h.lesson)?.title||'Практика';
    const date=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(h.at));
    return `<div class="history-row"><div class="song-symbol" aria-hidden="true">♪</div><div><h3>${escapeHtml(title)}</h3><p>${date} · ${durationText(h.seconds)} · ${h.kind==='flow'?'в темпе':h.kind==='check'?'проверка':'практика'}</p></div><span class="history-score">${h.kind==='beta'?'Бета':h.kind==='flow'?`${Math.round(h.accuracy)}%`:Number.isFinite(h.score)?`${h.score}/10`:`${Math.round(h.accuracy)}%`}</span></div>`;
  }).join('')}</div><div class="pager"><button class="secondary-button" data-history-page="-1" ${state.historyPage?'':'disabled'} aria-label="Предыдущие результаты">←</button><span>${state.historyPage+1} / ${pages}</span><button class="secondary-button" data-history-page="1" ${state.historyPage<pages-1?'':'disabled'} aria-label="Следующие результаты">→</button></div>`;
}
function navigate(view) {
  if(!['course','practice','library','progress','study'].includes(view))return;
  if(view!=='practice'){state.courseEntryPending=false;pausePractice();stopPlayback();}
  state.view=view;
  for(const section of $$('.view'))section.hidden=section.id!==`${view}-view`;
  const navView=view==='study'?'library':view==='practice'?(isCourse()?'course':'library'):view;
  for(const b of $$('[data-view]')){b.classList.toggle('active',b.dataset.view===navView);if(b.dataset.view===navView)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
  if(view==='course'){state.courseBrowse=false;renderCourse();}
  if(view==='library')renderLibrary();
  if(view==='study'){const stage=state.studyPlan?.stages.find(s=>s.id===studyProgress().cursor);if(stage){state.studyPhase=studyPhase(stage);const phase=state.studyPlan.stages.filter(s=>studyPhase(s)===state.studyPhase);state.studyPage=Math.floor(phase.indexOf(stage)/6);}renderStudy();}
  if(view==='progress')renderProgress();
  if(view==='practice')renderPractice();
  if(options.embedded){embeddedActive=view==='practice';options.onNavigate?.(view);}else window.scrollTo({top:0,behavior:'instant'});
}
function chooseLesson(id) {
  state.courseEntryPending=false;
  if(state.microPlan)clearMicroLesson();
  if(!LESSONS.some(l=>l.id===id))return;
  pausePractice();stopPlayback();++lessonGeneration;state.courseId=null;state.customLesson=null;state.compositionId=null;state.compositionKey=null;state.breakdown=false;settings.lesson=id;state.session=null;state.source='mic';state.saved=false;persist();
  coach('Начни с прослушивания примера или сразу сыграй первую ноту. Я подожду.');navigate('practice');
}
function closeResult(){const dialog=$('#result-dialog');if(dialog.open){programmaticResultCloses++;dialog.close();}}
function closeTeacherReply(){const dialog=$('#teacher-reply-dialog');if(dialog.open){programmaticReplyCloses++;dialog.close();}}
function openDialog(name,pause=true) {
  if(name==='teacher-reply'){$('#teacher-reply-dialog').showModal();return;}
  if(pause) {pausePractice({keepInput:name==='settings'});stopPlayback();}
  renderPractice();
  for(const d of $$('dialog[open]')){if(d.id==='result-dialog')closeResult();else d.close();}
  $(`#${name}-dialog`)?.showModal();
  if(name==='settings')setSettingsTab(state.view==='practice'?'practice':'sound');
}
function setSettingsTab(name){
  for(const panel of $$('[data-settings-pane]'))panel.hidden=panel.dataset.settingsPane!==name;
  for(const button of $$('[data-settings-tab]')){const active=button.dataset.settingsTab===name;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;button.classList.toggle('selected',active);}
  $('#settings-dialog .dialog-body').scrollTop=0;
}
$('#settings-dialog .dialog-tabs').addEventListener('keydown',event=>{
  const tabs=$$('[data-settings-tab]'),index=tabs.indexOf(event.target);
  if(index<0||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;
  setSettingsTab(tabs[next].dataset.settingsTab);tabs[next].focus();
});

root.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button || button.disabled)return;
  if(button.dataset.view)navigate(button.dataset.view);
  if(button.dataset.open)openDialog(button.dataset.open);
  if(button.dataset.settingsTab)setSettingsTab(button.dataset.settingsTab);
  if(button.dataset.notation){settings.notation=button.dataset.notation;persist();renderPractice();}
  if(button.hasAttribute('data-close'))button.closest('dialog')?.close();
  if(button.dataset.lesson)chooseLesson(button.dataset.lesson);
  if(button.hasAttribute('data-course-browse')){state.courseBrowse=true;renderCourse();}
  if(button.dataset.course)chooseCourse(button.dataset.course);
  if(button.dataset.composition)openCompositionStudy(button.dataset.composition);
  if(button.dataset.studyStage)startStudyStage(button.dataset.studyStage);
  if(button.dataset.historyPage){state.historyPage+=Number(button.dataset.historyPage);renderProgress();}
  if(button.dataset.hand){const current=state.studyPlan?.stages.find(s=>s.id===state.studyStageId),next=current&&state.studyPlan.stages.find(s=>s.hand===button.dataset.hand&&s.part===current.part&&s.whole===current.whole);if(next)startStudyStage(next.id);else showComposition(state.compositionId,button.dataset.hand);}
  if(button.dataset.input){pausePractice();settings.input=button.dataset.input;state.source=settings.input;if(state.mode==='check'&&lesson().polyphonic&&settings.input==='mic')state.mode='learn';state.session=null;state.saved=false;resetFollow();persist();renderPractice();}
  if(button.dataset.mode){pausePractice();stopPlayback();state.breakdown=false;resetFlowState();if(button.dataset.mode==='flow'){$('#settings-dialog').close();startFlowLevel(flowDestination());return;}state.mode=button.dataset.mode;state.session=null;state.saved=false;state.revealed=false;resetFollow();coach(state.mode==='check'?`Проверим фрагмент из ${notes().length} нот. Для перехода нужна оценка от 8 из 10; подсказки не возвращают баллы.`:lesson().instruction);renderPractice();}
  if(button.dataset.answer==='yes'){if(state.studyStageId&&studyProgress().completed.includes(state.studyStageId))advanceStudy();else if(isCourse()&&state.mode==='check'&&state.lastReport?.passed&&lesson().nextId){closeResult();chooseCourse(lesson().nextId);}else repeatCurrent();}
  if(button.dataset.answer==='show'){closeTeacherReply();closeResult();playExample();}
  if(button.dataset.answer==='explain')sendTeacherReply('Объясни иначе, совсем простыми словами, и предложи короткий повтор.');
  if(button.dataset.midi)auditionKey(Number(button.dataset.midi));
});
for(const [id,action]of [['next','continue'],['repeat','repeat'],['repair','repair'],['explain','explain'],['voice','record'],['stop-voice','stopRecording'],['dismiss','course']]){
  $('#postplay-'+id).addEventListener('click',()=>{if(action==='course'){returnToCourse();return;}Promise.resolve(postplay[action]()).catch(()=>{});});
}
$('#start-button').addEventListener('click',()=>{if(state.intro||state.transitioning){pausePractice();return;}if(pendingNative?.lesson===lessonGeneration){const next=pendingNative;pendingNative=null;next.run();return;}if(state.preview){stopPlayback();renderPractice();return;}if(state.needsIntro){startLessonIntro();return;}startPractice().catch(()=>failMic({}));});
$('#mic-toggle').addEventListener('click',()=>{
  if(state.mic || state.phase==='permission'){pausePractice();return;}
  pausePractice();
  if(state.source==='demo'){state.session=null;state.source='mic';}
  enableMic().catch(()=>failMic({}));
});
$('#settings-dialog').addEventListener('close',()=>{if(options.embedded&&(homeSettings||state.view!=='practice')){homeSettings=false;options.onNavigate?.('course');}});
$('#intro-skip').addEventListener('click',()=>{if(state.intro?.audioBlocked)startLessonIntro();else skipLessonIntro();});
$('#close-course-browse').addEventListener('click',()=>{state.courseBrowse=false;renderCourse();});
$('#crop-keys').addEventListener('change',e=>{settings.cropKeys=e.target.checked;persist();renderPractice();});
$('#open-plan').addEventListener('click',()=>{$('#settings-dialog').close();if(state.studyPlan&&state.compositionId)navigate('study');else{navigate('course');state.courseBrowse=true;renderCourse();}});
$('#demo-button').addEventListener('click',()=>{for(const d of $$('dialog[open]'))d.close();startDemo();});
$('#practice-section').addEventListener('click',()=>repeatProblemSection(true));$('#whole-piece').addEventListener('click',returnToWhole);
$('#exit-practice').addEventListener('click',()=>navigate(isCourse()?'course':'library'));
$('#study-continue').addEventListener('click',advanceStudy);
$('#flow-next').addEventListener('click',continueAfterFlow);
$('#flow-skip').addEventListener('click',continueAfterFlow);
$('#flow-polish').addEventListener('click',()=>startFlowLevel(state.flowNext,{polish:true}));
$('#course-module').addEventListener('change',e=>{state.courseModule=e.target.value;renderCourse();});
$('#study-phase').addEventListener('change',e=>{state.studyPhase=e.target.value;state.studyPage=0;renderStudy();});
for(const [suffix,delta] of [['prev',-1],['next',1]]){$('#library-'+suffix).addEventListener('click',()=>moveCarousel(delta));$('#study-'+suffix).addEventListener('click',()=>{state.studyPage+=delta;renderStudy();});}
$('#lesson-list').addEventListener('scroll',()=>{if(!carouselFrame)carouselFrame=requestAnimationFrame(updateCarousel);},{passive:true});
$('#backing-switch').addEventListener('change',event=>{settings.accompaniment=event.target.checked;backingPlayer?.dispose();backingPlayer=null;backingKey='';persist();renderCompositionControls();});
$('#backing-volume').addEventListener('input',event=>{settings.backingVolume=Number(event.target.value)/100;$('#backing-volume-value').value=`${event.target.value}%`;backingPlayer?.setVolume(settings.backingVolume);});
$('#backing-volume').addEventListener('change',persist);
$('#preview-button').addEventListener('click',()=>{for(const d of $$('dialog[open]'))d.close();playExample();});

$('#restart-button').addEventListener('click',()=>{const source=state.source;pausePractice({keepInput:true});stopPlayback();$('#settings-dialog').close();state.quickStart=true;state.needsIntro=false;state.session=null;state.saved=false;state.source=source;resetFollow();renderPractice();startPractice().catch(()=>failMic({}));});
$('#skip-button').addEventListener('click',()=>{if(!state.running)return;const result=state.session.skip(now());follow?.seekIndex(state.session.index,now());resetDetector();if(result.kind==='complete')completePractice();else{coach('Нота пропущена. Её можно будет разобрать в следующем проходе.');renderPractice();}});
$('#repeat-button').addEventListener('click',repeatCurrent);
$('#next-lesson-button').addEventListener('click',()=>{closeResult();const stage=state.studyPlan?.stages.find(s=>s.id===state.studyStageId);navigate(state.studyStageId&&stage?.purpose!=='independent'?'study':isCourse()?'course':'library');});
$('#theme-button').addEventListener('click',()=>{settings.theme=settings.theme==='dark'?'light':'dark';persist();applyTheme();});
$('#original-tempo').addEventListener('click',()=>{pausePractice();stopPlayback();state.tempoAutomatic=false;settings.tempo=clamp(lesson().tempo||60,20,300);$('#tempo').value=settings.tempo;$('#tempo-value').value=settings.tempo;if(state.mode==='flow')state.session=null;resetFollow();persist();renderPractice();});
$('#auto-tempo').addEventListener('click',()=>{pausePractice();stopPlayback();applyLessonTempo();renderPractice();});
$('#tempo').min='20';$('#tempo').max='300';$('#tempo').step='any';$('#tempo').value=settings.tempo;$('#tempo-value').value=settings.tempo;
$('#tempo').addEventListener('input',event=>{pausePractice();state.tempoAutomatic=false;settings.tempo=clamp(Number(event.target.value)||60,20,300);$('#tempo-value').value=settings.tempo;if(state.mode==='flow')state.session=null;resetFollow();persist();if(state.preview)stopPlayback();renderPractice();});
$('#sensitivity').value=settings.sensitivity;
function sensitivityLabel(){const v=settings.sensitivity;$('#sensitivity-value').textContent=v>75?'Высокая':v<35?'Низкая':'Средняя';}
$('#sensitivity').addEventListener('input',e=>{settings.sensitivity=Number(e.target.value);state.noiseFloor=0;micCapture?.configure({minRms:minRms()});sensitivityLabel();persist();});
$('#metronome').checked=settings.metronome;$('#metronome').addEventListener('change',e=>{settings.metronome=e.target.checked;persist();});
$('#intro-voice').value=settings.teacherVoice;$('#intro-voice').addEventListener('change',e=>chooseIntroVoice(e.target.value));
$('#accent').checked=settings.accent;$('#accent').addEventListener('change',e=>{settings.accent=e.target.checked;persist();applyTheme();});
for(const dialog of $$('dialog'))dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
listenDocument('visibilitychange',()=>{if(document.hidden&&(!options.embedded||embeddedActive)){pausePractice();stopPlayback();if(synthContext?.state==='running')synthContext.suspend().catch(()=>{});}});
listenWindow('pagehide',()=>{if(!options.embedded||embeddedActive){pausePractice();stopPlayback();}synthContext?.close().catch(()=>{});},{signal:mountAbort.signal});
const scoreObserver=new ResizeObserver(()=>drawScore());scoreObserver.observe($('#score'));
let layoutTimer;listenWindow('resize',()=>{clearTimeout(layoutTimer);layoutTimer=setTimeout(()=>{if(state.view==='library')renderLibrary();else if(state.view==='practice'){renderPiano();drawScore();}},100);});
const practiceScene=createPracticeScene(root,{onPaletteChange:drawScore,snapshot:()=>({phase:state.phase,intro:!!state.intro,transitioning:state.transitioning,hand:state.hand,
  stageTitle:microStage()?.title||'',instruction:!strictMemory()&&state.session?.index===0?microStage()?.instruction||lesson().instruction:'',
  canSkip:state.view==='practice',canHelp:!!microStage()&&!state.intro&&!state.transitioning,
  heard:Number.isInteger(state.inputHeard)?noteInfo(state.inputHeard).name+' '+noteInfo(state.inputHeard).latin:'—',
  accepted:Number.isInteger(state.inputAccepted)?noteInfo(state.inputAccepted).name+' '+noteInfo(state.inputAccepted).latin:'—',
  cue:$('#finger-hint').hidden?null:currentFingerCue('transition')}),
  onHelp:()=>{$('#settings-dialog').close();helpMicroLesson();startPractice().catch(()=>failMic({}));},onSkip:()=>{$('#settings-dialog').close();skipExercise();}});
setupLearningUI();renderCourse();renderLibrary();sensitivityLabel();applyTheme();renderPiano();renderPractice();

function lessonForReview(report){
  const played=notes(),range=chooseProblemSection(played,report,{size:8}),excerpt=played.slice(range.start,range.end).map(n=>noteInfo(n.midi).name).join(' → ');
  return {...lesson(),instruction:`${lesson().instruction} ${state.breakdown?'Сейчас разобран только небольшой участок, не целая композиция. ':''}${lesson().polyphonic&&state.source==='mic'?'Распознавание двух рук через микрофон пробное, без зачёта. ':''}Ноты рядом с ошибкой в данном проходе: ${excerpt}.`};
}
function repeatProblemSection(fromCurrent=false,selectedRange=null){
  $('#settings-dialog').close();
  const full=lesson().notes,current=(state.session?.index||0)+(state.breakdown?(state.sectionRange?.start||0):0);
  const report=fromCurrent?{errors:[{index:Math.min(current,full.length-1)}]}:state.breakdown&&state.lastReport?{...state.lastReport,errors:state.lastReport.errors.map(error=>({...error,index:error.index+(state.sectionRange?.start||0)}))}:state.lastReport;
  const stage=state.studyPlan?.stages.find(s=>s.id===state.studyStageId),repair=stage?recommendSongRepair(stage,report):null;
  if(!state.breakdown)state.repairReturnMode=state.mode;
  const exact=Number.isInteger(selectedRange?.start)&&Number.isInteger(selectedRange?.end)&&selectedRange.start>=0&&selectedRange.end>selectedRange.start&&selectedRange.end<=full.length?selectedRange:null;
  pausePractice({keepInput:true});stopPlayback();closeResult();state.sectionRange=exact?{start:exact.start,end:exact.end}:repair?{start:repair.start,end:repair.end}:chooseProblemSection(full,report);state.breakdown=true;state.mode='learn';state.quickStart=true;state.session=null;state.saved=false;state.source=settings.input;resetFollow();
  coach('Разберём только это место. Когда станет удобно, вернись к целой мелодии.');renderPractice();startPractice().catch(()=>failMic({}));
}
function returnToWhole(){$('#settings-dialog').close();pausePractice({keepInput:true});stopPlayback();closeResult();state.breakdown=false;state.sectionRange=null;state.mode=state.repairReturnMode||(isCourse()?'check':'learn');state.repairReturnMode=null;state.quickStart=true;state.flowGoalReached=false;state.session=null;state.saved=false;state.revealed=false;state.assisted=false;state.source=settings.input;resetFollow();renderPractice();startPractice().catch(()=>failMic({}));}
function repeatCurrent(){
  pausePractice({keepInput:true});closeResult();state.quickStart=true;state.needsIntro=false;state.session=null;state.saved=false;state.source=settings.input;
  if(lesson().polyphonic&&settings.input==='mic'&&state.studyPlan?.stages.find(s=>s.id===state.studyStageId)?.purpose!=='independent'){state.mode='learn';}
  else if(!state.studyStageId&&(isCourse()||state.customLesson)){if(state.breakdown){state.mode='learn';}else if(state.mode==='learn')state.mode='check';}
  renderPractice();startPractice().catch(()=>failMic({}));
}
async function sendTeacherReply(question){
  closeTeacherReply();
  if(!state.lastReport||!question.trim())return;
  const token=lessonGeneration,generation=++autoGeneration;
  teacher.cancel();$('#reply-area').hidden=true;$('#review-status').textContent='Преподаватель отвечает…';
  try{const result=await teacher.review({lesson:lessonForReview(state.lastReport),report:state.lastReport},{question:question.slice(0,1000),previousResponse:state.reviewText});
    if(token!==lessonGeneration||generation!==autoGeneration||document.hidden)return;
    state.reviewText=result.text;$('#result-advice').textContent=result.text;$('#review-status').textContent='Ответ ИИ · OpenRouter';
    if(settings.voice)await teacher.speak(result.text);
  }catch(error){if(token===lessonGeneration&&generation===autoGeneration)$('#review-status').textContent=error.message||'Ответ недоступен. Можно повторить вопрос.';}
  finally{if(token===lessonGeneration&&generation===autoGeneration&&!document.hidden)$('#reply-area').hidden=false;}
}
function setupLearningUI(){
  const body=$('#result-dialog .dialog-body');
  body.querySelector('.field-note').textContent='С ожиданием оцениваются ноты. В темпе — ноты и момент нажатия. Исправления не возвращают баллы; удержание и техника не оцениваются.';
  body.querySelector('.result-metrics div:first-child span').textContent='С первой попытки';
  body.querySelector('.result-metrics div:nth-child(2) span').textContent='С исправлениями';
  $('#repeat-button').insertAdjacentHTML('beforebegin','<p id="review-status" class="tutor-source" role="status"></p><div id="reply-area" class="reply-area" hidden><p>Всё понятно?</p><div class="reply-choices"><button class="secondary-button" data-answer="yes">Понятно</button><button class="secondary-button" data-open="teacher-reply">Есть вопрос</button></div></div><button id="next-course-button" class="primary-button full-width" hidden>Следующий урок</button>');
  $('#repeat-button').insertAdjacentHTML('afterend','<button id="problem-repeat" class="secondary-button full-width" hidden>Повторить трудное место</button><button id="return-whole" class="secondary-button full-width" hidden>Вернуться к целой мелодии</button>');
  $('#problem-repeat').addEventListener('click',()=>repeatProblemSection());$('#return-whole').addEventListener('click',returnToWhole);
  $('#next-course-button').addEventListener('click',()=>{const id=lesson().nextId;closeResult();chooseCourse(id);});
  $('#reply-form').addEventListener('submit',event=>{event.preventDefault();sendTeacherReply($('#reply-input').value);});
  let recording=false;
  $('#teacher-reply-dialog').addEventListener('close',()=>{if(programmaticReplyCloses){programmaticReplyCloses--;return;}if(recording){++autoGeneration;teacher.cancel();recording=false;}});
  $('#voice-reply').addEventListener('click',async()=>{
    if(recording){teacher.stopRecording();return;}
    recording=true;const token=lessonGeneration,generation=autoGeneration;
    $('#voice-reply').textContent='Говори… Нажми, чтобы отправить';$('#review-status').textContent='Запись ответа · до 8 секунд';
    try{const text=await teacher.recordReply({seconds:8});if(token!==lessonGeneration||generation!==autoGeneration||document.hidden)return;$('#reply-input').value=text;await sendTeacherReply(text);}
    catch(error){if(token===lessonGeneration&&generation===autoGeneration)$('#review-status').textContent=error.message||'Не удалось распознать ответ. Используй кнопки или напиши.';}
    finally{recording=false;$('#voice-reply').textContent='Ответить голосом';}
  });
  $('#result-dialog').addEventListener('cancel',()=>pausePractice());
  $('#result-dialog').addEventListener('close',()=>{if(programmaticResultCloses){programmaticResultCloses--;return;}if(state.phase==='idle'&&!state.running)pausePractice();});
  $('#midi-import').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;pausePractice();
    try{if(file.size>2*1024*1024)throw new Error('Выбери MIDI-файл не больше 2 МБ.');const composition=parseMidiComposition(await file.arrayBuffer(),file.name);const next=[composition,...importedCompositions.filter(c=>c.id!==composition.id)].slice(0,8);localStorage.setItem('flow-piano-compositions-v1',JSON.stringify(next));importedCompositions=next;$('#import-message').textContent=`Добавлено: ${composition.title}. Выбери дорожку для практики.`;$('#import-message').hidden=false;renderLibrary();openCompositionStudy(composition.id);}
    catch(error){$('#import-message').hidden=false;$('#import-message').textContent=error.message||'Не удалось добавить MIDI-файл.';}finally{event.target.value='';}
  });
  $('#settings-dialog .settings-disclosure').innerHTML='<p>В темпе оцениваются ноты и моменты нажатий. Удержание и техника рук не оцениваются. Прогресс сохраняется в Flow при подключении.</p>';
  $('#help-title').textContent='Подготовь Casio CT-S200';
  $('#help-dialog .help-steps li:first-child p').textContent='Выбери тембр Piano. Выключи Sustain и автоматическое сопровождение. Начни со средней громкости.';
  teacher.status().then(status=>{$('#tutor-availability').textContent=status.ready?'Преподаватель готов':'Разбор ИИ сейчас недоступен. Уроки и голосовые подсказки браузера работают.';}).catch(()=>{$('#tutor-availability').textContent='Нет связи с преподавателем. Уроки доступны, разбор можно проверить позже.';});
}

return {
 openCourse:id=>{state.learningTask=null;state.rhythmGuided=false;chooseCourse(id);},openTask:openLearningTask,openComposition:(id,task=null)=>{state.learningTask=task;state.rhythmGuided=false;openCompositionStudy(id);},redraw:()=>renderPractice(),
 pause:()=>{if(!options.embedded||embeddedActive){pausePractice();stopPlayback();}embeddedActive=false;},showSettings:()=>{homeSettings=true;openDialog('settings');setSettingsTab('sound');},
 getState:()=>JSON.parse(JSON.stringify(settings)),getActivity:()=>readPracticeActivity(localStorage,STORE),
 getCompositions:()=>allCompositions().map(c=>({id:c.id,title:c.title,author:c.author,source:c.source})),
 addComposition:composition=>{createCompositionStudy(composition);externalCompositions=[...externalCompositions.filter(c=>c.id!==composition.id),composition];},
 destroy:()=>{pausePractice();stopPlayback();practiceScene.destroy();microView.destroy();mountAbort.abort();scoreObserver.disconnect();clearTimeout(layoutTimer);clearTimeout(toastTimer);clearTimeout(keyFeedbackTimer);embeddedActive=false;synthContext?.close().catch(()=>{});root.replaceChildren();}
};
}
