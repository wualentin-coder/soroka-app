import {normalizeCourseProgress} from './course.mjs?v=ee88d828b262';
import {normalizeLearningProgress,mergeLearningProgress} from './learning-path.mjs?v=ee88d828b262';
import {normalizeMicroProgress,mergeMicroProgress} from './microlearning-progress.mjs?v=ee88d828b262';
import {normalizePerformanceProgress} from './learning-tempo.mjs?v=ee88d828b262';

const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const finite=v=>Number.isFinite(v)&&v>=0?v:0;
const MAX_TIMESTAMP=8640000000000000;
const resetEpoch=v=>Number.isSafeInteger(v)&&v>=0&&v<=MAX_TIMESTAMP?v:0;
const copy=v=>JSON.parse(JSON.stringify(v));
const maps=['compositionProgress','studyProgress','flowProgress'];
const text=(v,max=200)=>typeof v==='string'?v.slice(0,max):null;
const range=(v,max)=>Number.isFinite(v)&&v>=0&&v<=max?v:0;
const canonical=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const prefer=(x,y,tx=0,ty=0)=>tx>ty?x:ty>tx?y:JSON.stringify(canonical(x))>JSON.stringify(canonical(y))?x:y;
const mixedSourceId=value=>typeof value==='string'&&/^[-A-Za-z0-9._:]{1,160}$/.test(value)&&!['__proto__','prototype','constructor'].includes(value)?value:null;
function mergePerformance(a,b,atA,atB){
  if(!a||!b)return a||b;
  const cursorTieBreakKey=row=>({...row,completed:[],targetReached:false});
  const selected=atA>atB?a:atB>atA?b:JSON.stringify(canonical(cursorTieBreakKey(a)))>=JSON.stringify(canonical(cursorTieBreakKey(b)))?a:b;
  if(a.version!==b.version||a.sourceFingerprint!==b.sourceFingerprint||a.hand!==b.hand||a.noteCount!==b.noteCount||
    a.sourceBpm!==b.sourceBpm||a.baseBpm!==b.baseBpm||JSON.stringify(a.steps)!==JSON.stringify(b.steps))return selected;
  const completed=selected.steps.filter(bpm=>a.completed.includes(bpm)||b.completed.includes(bpm));
  return {...selected,completed,targetReached:a.targetReached||b.targetReached};
}
function studyMastery(value){
  const v=object(value);
  if(!text(v.stageId)||v.stageId.length>200||v.metric!=='timed-notes-v1'||!Number.isInteger(v.scorePercent)||v.scorePercent<80||v.scorePercent>100||!Number.isFinite(v.at)||v.at<0||v.at>8640000000000000||!['mic','midi'].includes(v.source))return null;
  return {stageId:v.stageId,metric:v.metric,scorePercent:v.scorePercent,at:v.at,source:v.source};
}
function studyLegacy(value){
  const v=object(value);if(typeof v.version!=='string'||!/^composition-study-v[123](?::|$)/.test(v.version)||v.version.length>300)return null;
  const mastery=studyMastery(v.mastery);return {version:v.version,completed:[...new Set((Array.isArray(v.completed)?v.completed:[]).filter(id=>typeof id==='string'&&id.length<=200))].slice(0,2048),cursor:typeof v.cursor==='string'&&v.cursor.length<=200?v.cursor:null,...(mastery?{mastery}:{})};
}
const bestStudyMastery=(a,b)=>[a,b].filter(Boolean).sort((x,y)=>y.scorePercent-x.scorePercent||y.at-x.at||JSON.stringify(x).localeCompare(JSON.stringify(y)))[0];
function mergeStudyLegacy(a,b,preferred){
  if(!a||!b)return a||b;
  if(a.version!==b.version)return preferred||prefer(a,b);
  const mastery=bestStudyMastery(a.mastery,b.mastery);
  return {...(preferred||prefer(a,b)),completed:[...new Set([...a.completed,...b.completed])].sort(),...(mastery?{mastery}:{})};
}
function mergeStudyRows(x,y,atX,atY){
  const latest=prefer(x,y,atX,atY);
  if(x.version===y.version){const mastery=bestStudyMastery(x.mastery,y.mastery),legacy=mergeStudyLegacy(x.legacy,y.legacy,latest.legacy);return {...latest,completed:[...new Set([...x.completed,...y.completed])].sort(),...(mastery?{mastery}:{}),...(legacy?{legacy}:{})};}
  // An older client must not downgrade the new study route. Its receipts remain
  // available as history, never as evidence for a different arrangement.
  const xNew=x.version.startsWith('composition-study-v3:'),yNew=y.version.startsWith('composition-study-v3:'),xOld=/^composition-study-v[12]:/.test(x.version),yOld=/^composition-study-v[12]:/.test(y.version);
  const selected=xNew&&yOld?x:yNew&&xOld?y:latest,other=selected===x?y:x,prior=studyLegacy(other);
  const legacy=mergeStudyLegacy(selected.legacy,prior,prior);
  return {...selected,...(legacy?{legacy}:{})};
}
function progressMap(value,name){const out={};for(const [id,raw]of Object.entries(object(value)).slice(0,2000)){
  if(!id||id.length>600||['__proto__','prototype','constructor'].includes(id))continue;const row=object(raw);
  if(name==='studyProgress'){if(!text(row.version,300))continue;const mastery=studyMastery(row.mastery),legacy=studyLegacy(row.legacy);out[id]={version:text(row.version,300),completed:[...new Set((Array.isArray(row.completed)?row.completed:[]).filter(v=>typeof v==='string'&&v.length<=200))].sort().slice(0,2048),cursor:text(row.cursor),...(mastery?{mastery}:{}),...(legacy?{legacy}:{})};}
  else if(name==='flowProgress'){
    const performance=normalizePerformanceProgress(row.performance),mixed=mixedSourceId(row.mixedSourceId);
    out[id]={best:range(row.best,100),last:range(row.last,100),at:finite(row.at),beta:row.beta===true,
      ...(Number.isFinite(row.practiceBpm)&&row.practiceBpm>=20&&row.practiceBpm<=300?{practiceBpm:row.practiceBpm}:{}),
      ...(Number.isInteger(row.stablePasses)&&row.stablePasses>=0&&row.stablePasses<=2?{stablePasses:row.stablePasses}:{}),
      ...(performance?{performance}:{}),...(mixed?{mixedSourceId:mixed}:{})};
  }
  else out[id]={practiced:row.practiced===true,passed:row.passed===true,score:range(row.score,10),at:finite(row.at)};
}return out;}
function historyRows(value){return(Array.isArray(value)?value:[]).filter(h=>h&&Number.isFinite(h.at)&&typeof h.lesson==='string').map(h=>({at:finite(h.at),lesson:text(h.lesson),title:text(h.title,200)||text(h.lesson),correct:range(h.correct,5000),accuracy:range(h.accuracy,100),seconds:range(h.seconds,86400),kind:text(h.kind,40)||'learn',metric:text(h.metric,80)||'first-attempt-v1',...(Number.isFinite(h.score)?{score:range(h.score,10)}:{})})).sort((a,b)=>b.at-a.at||JSON.stringify(a).localeCompare(JSON.stringify(b))).slice(0,50);}
function dailyRun(value){const v=object(value),out={assistance:{}};if(typeof v.readyDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.readyDate))out.readyDate=v.readyDate;for(const [id,raw]of Object.entries(object(v.assistance)).slice(-128)){if(id.length>240)continue;const row=object(raw);out.assistance[id]={helpedAt:finite(row.helpedAt),consumedAt:finite(row.consumedAt)};}return out;}
export function normalizePianoState(value){
  const v=object(value),out={...object(v.preferences),...v,version:1,updatedAt:finite(v.updatedAt),resetAt:resetEpoch(v.resetAt),courseProgress:normalizeCourseProgress(v.courseProgress)};
  out.learningProgress=normalizeLearningProgress(v.learningProgress,v.learningProgress?{}:{courseProgress:out.courseProgress});
  out.microProgress=normalizeMicroProgress(v.microProgress);
  for(const name of maps)out[name]=progressMap(v[name],name);
  out.history=historyRows(v.history);out.dailyRun=dailyRun(v.dailyRun);
  return out;
}
/** A new progress epoch clears achievements, never preferences or MIDI storage. */
export function resetPianoProgress(value,{at=Date.now()}={}){
  if(!Number.isSafeInteger(at)||at<=0||at>MAX_TIMESTAMP)throw new RangeError('Progress reset needs a positive timestamp.');
  const current=normalizePianoState(value),resetAt=Math.max(at,current.resetAt+1);
  if(resetAt>MAX_TIMESTAMP)throw new RangeError('Progress reset timestamp is exhausted.');
  return normalizePianoState({...current,resetAt,updatedAt:Math.max(current.updatedAt,resetAt),lesson:'joy',
    courseProgress:normalizeCourseProgress(null),learningProgress:normalizeLearningProgress(null),
    compositionProgress:{},studyProgress:{},flowProgress:{},microProgress:{},history:[],pendingFlow:null,dailyRun:{}});
}
export function mergePianoState(a,b){
  a=normalizePianoState(a);b=normalizePianoState(b);
  const latest=prefer(a,b,a.updatedAt,b.updatedAt),out={...a,...b,...latest};
  if(a.resetAt!==b.resetAt){
    // A stale device may have a later ordinary edit time. Its preferences can
    // win, but its old achievements must never re-enter the reset epoch.
    const current=a.resetAt>b.resetAt?a:b;
    for(const name of ['courseProgress','learningProgress','microProgress',...maps,'history','pendingFlow','dailyRun'])out[name]=current[name];
    out.lesson=typeof current.lesson==='string'?current.lesson:'joy';out.resetAt=current.resetAt;
    out.updatedAt=Math.max(a.updatedAt,b.updatedAt);
    return normalizePianoState(out);
  }
  out.courseProgress=normalizeCourseProgress({version:1,metric:'first-attempt-v1',lessons:{...a.courseProgress.lessons,...b.courseProgress.lessons}});
  for(const id of new Set([...Object.keys(a.courseProgress.lessons),...Object.keys(b.courseProgress.lessons)])){
    const x=a.courseProgress.lessons[id],y=b.courseProgress.lessons[id];if(!x||!y)continue;
    out.courseProgress.lessons[id]={...prefer(x,y,x.lastAt,y.lastAt),attempts:Math.max(x.attempts,y.attempts),bestScore:Math.max(x.bestScore,y.bestScore),passed:x.passed||y.passed};
  }
  out.learningProgress=mergeLearningProgress(a.learningProgress,b.learningProgress);
  out.microProgress=mergeMicroProgress(a.microProgress,b.microProgress);
  out.dailyRun={...latest.dailyRun,assistance:{...a.dailyRun.assistance,...b.dailyRun.assistance}};
  for(const id of Object.keys(out.dailyRun.assistance)){const x=a.dailyRun.assistance[id],y=b.dailyRun.assistance[id];if(x&&y)out.dailyRun.assistance[id]={helpedAt:Math.max(x.helpedAt,y.helpedAt),consumedAt:Math.max(x.consumedAt,y.consumedAt)};}
  for(const name of maps){out[name]={...a[name],...b[name]};for(const id of Object.keys(out[name])){
    const x=a[name][id],y=b[name][id];if(!x||!y)continue;
    if(name==='studyProgress')out[name][id]=mergeStudyRows(x,y,a.updatedAt,b.updatedAt);
    else if(name==='flowProgress'){
      const latest=prefer(x,y,x.at,y.at),performance=mergePerformance(x.performance,y.performance,x.at,y.at),mixed=latest.mixedSourceId||x.mixedSourceId||y.mixedSourceId;
      out[name][id]={...latest,best:Math.max(finite(x.best),finite(y.best)),...(performance?{performance}:{}),...(mixed?{mixedSourceId:mixed}:{})};
    }
    else if(name==='compositionProgress')out[name][id]={...prefer(x,y,x.at,y.at),practiced:!!(x.practiced||y.practiced),passed:!!(x.passed||y.passed),score:Math.max(finite(x.score),finite(y.score))};
  }}
  const history=new Map();for(const entry of [...a.history,...b.history])history.set([entry.at,entry.lesson,entry.kind,entry.metric,entry.correct,entry.score].join(':'),entry);
  out.history=[...history.values()].sort((x,y)=>y.at-x.at).slice(0,50);out.updatedAt=Math.max(a.updatedAt,b.updatedAt);
  return normalizePianoState(out);
}
export function toPianoProgress(value){
  const v=normalizePianoState(value),out={version:1,updatedAt:v.updatedAt,resetAt:v.resetAt,courseProgress:v.courseProgress,learningProgress:v.learningProgress,microProgress:v.microProgress,history:v.history};
  for(const name of maps)out[name]=v[name];out.pendingFlow=null;
  if(v.pendingFlow&&typeof v.pendingFlow==='object'){const row=v.pendingFlow;out.pendingFlow={courseId:text(row.courseId),compositionId:text(row.compositionId),stageId:text(row.stageId),...(text(row.studyVersion,300)?{studyVersion:text(row.studyVersion,300)}:{}),polish:row.polish===true,goalReached:row.goalReached===true,...(row.performance===true?{performance:true}:{})};}
  out.dailyRun=v.dailyRun;
  if(typeof v.favoriteSongId==='string')out.favoriteSongId=v.favoriteSongId.slice(0,80);
  out.preferences={};for(const name of ['voice','cropKeys','intros','accompaniment','metronome'])if(typeof v[name]==='boolean')out.preferences[name]=v[name];
  for(const [name,min,max]of [['tempo',20,300],['sensitivity',1,100],['backingVolume',0,1]])if(Number.isFinite(v[name])&&v[name]>=min&&v[name]<=max)out.preferences[name]=v[name];
  if(['mic','midi'].includes(v.input))out.preferences.input=v.input;if(['falling','staff','both'].includes(v.notation))out.preferences.notation=v.notation;if([-1,0,1].includes(v.octave))out.preferences.octave=v.octave;
  return out;
}
export function samePianoProgress(a,b){
  const canonical=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  return JSON.stringify(canonical(toPianoProgress(a)))===JSON.stringify(canonical(toPianoProgress(b)));
}
