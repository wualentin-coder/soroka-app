import {normalizeCourseProgress} from './course.mjs?v=e55349755070';
import {normalizeLearningProgress,mergeLearningProgress} from './learning-path.mjs?v=e55349755070';

const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const finite=v=>Number.isFinite(v)&&v>=0?v:0;
const copy=v=>JSON.parse(JSON.stringify(v));
const maps=['compositionProgress','studyProgress','flowProgress'];
const text=(v,max=200)=>typeof v==='string'?v.slice(0,max):null;
const range=(v,max)=>Number.isFinite(v)&&v>=0&&v<=max?v:0;
const canonical=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const prefer=(x,y,tx=0,ty=0)=>tx>ty?x:ty>tx?y:JSON.stringify(canonical(x))>JSON.stringify(canonical(y))?x:y;
function progressMap(value,name){const out={};for(const [id,raw]of Object.entries(object(value)).slice(0,2000)){
  if(!id||id.length>600||['__proto__','prototype','constructor'].includes(id))continue;const row=object(raw);
  if(name==='studyProgress'){if(!text(row.version,300))continue;out[id]={version:text(row.version,300),completed:[...new Set((Array.isArray(row.completed)?row.completed:[]).filter(v=>typeof v==='string'&&v.length<=200))].sort().slice(0,2000),cursor:text(row.cursor)};}
  else if(name==='flowProgress')out[id]={best:range(row.best,100),last:range(row.last,100),at:finite(row.at),beta:row.beta===true,
    ...(Number.isFinite(row.practiceBpm)&&row.practiceBpm>=40&&row.practiceBpm<=180?{practiceBpm:row.practiceBpm}:{}),
    ...(Number.isInteger(row.stablePasses)&&row.stablePasses>=0&&row.stablePasses<=2?{stablePasses:row.stablePasses}:{})};
  else out[id]={practiced:row.practiced===true,passed:row.passed===true,score:range(row.score,10),at:finite(row.at)};
}return out;}
function historyRows(value){return(Array.isArray(value)?value:[]).filter(h=>h&&Number.isFinite(h.at)&&typeof h.lesson==='string').map(h=>({at:finite(h.at),lesson:text(h.lesson),title:text(h.title,200)||text(h.lesson),correct:range(h.correct,5000),accuracy:range(h.accuracy,100),seconds:range(h.seconds,86400),kind:text(h.kind,40)||'learn',metric:text(h.metric,80)||'first-attempt-v1',...(Number.isFinite(h.score)?{score:range(h.score,10)}:{})})).sort((a,b)=>b.at-a.at||JSON.stringify(a).localeCompare(JSON.stringify(b))).slice(0,50);}
function dailyRun(value){const v=object(value),out={assistance:{}};if(typeof v.readyDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.readyDate))out.readyDate=v.readyDate;for(const [id,raw]of Object.entries(object(v.assistance)).slice(-128)){if(id.length>240)continue;const row=object(raw);out.assistance[id]={helpedAt:finite(row.helpedAt),consumedAt:finite(row.consumedAt)};}return out;}
export function normalizePianoState(value){
  const v=object(value),out={...object(v.preferences),...v,version:1,updatedAt:finite(v.updatedAt),courseProgress:normalizeCourseProgress(v.courseProgress)};
  out.learningProgress=normalizeLearningProgress(v.learningProgress,v.learningProgress?{}:{courseProgress:out.courseProgress});
  for(const name of maps)out[name]=progressMap(v[name],name);
  out.history=historyRows(v.history);out.dailyRun=dailyRun(v.dailyRun);
  return out;
}
export function mergePianoState(a,b){
  a=normalizePianoState(a);b=normalizePianoState(b);
  const latest=prefer(a,b,a.updatedAt,b.updatedAt),out={...a,...b,...latest};
  out.courseProgress=normalizeCourseProgress({version:1,metric:'first-attempt-v1',lessons:{...a.courseProgress.lessons,...b.courseProgress.lessons}});
  for(const id of new Set([...Object.keys(a.courseProgress.lessons),...Object.keys(b.courseProgress.lessons)])){
    const x=a.courseProgress.lessons[id],y=b.courseProgress.lessons[id];if(!x||!y)continue;
    out.courseProgress.lessons[id]={...prefer(x,y,x.lastAt,y.lastAt),attempts:Math.max(x.attempts,y.attempts),bestScore:Math.max(x.bestScore,y.bestScore),passed:x.passed||y.passed};
  }
  out.learningProgress=mergeLearningProgress(a.learningProgress,b.learningProgress);
  out.dailyRun={...latest.dailyRun,assistance:{...a.dailyRun.assistance,...b.dailyRun.assistance}};
  for(const id of Object.keys(out.dailyRun.assistance)){const x=a.dailyRun.assistance[id],y=b.dailyRun.assistance[id];if(x&&y)out.dailyRun.assistance[id]={helpedAt:Math.max(x.helpedAt,y.helpedAt),consumedAt:Math.max(x.consumedAt,y.consumedAt)};}
  for(const name of maps){out[name]={...a[name],...b[name]};for(const id of Object.keys(out[name])){
    const x=a[name][id],y=b[name][id];if(!x||!y)continue;
    if(name==='studyProgress'&&x.version===y.version){const newest=prefer(x,y,a.updatedAt,b.updatedAt);out[name][id]={...newest,completed:[...new Set([...(x.completed||[]),...(y.completed||[])])].sort()};}
    else if(name==='flowProgress')out[name][id]={...prefer(x,y,x.at,y.at),best:Math.max(finite(x.best),finite(y.best))};
    else if(name==='compositionProgress')out[name][id]={...prefer(x,y,x.at,y.at),practiced:!!(x.practiced||y.practiced),passed:!!(x.passed||y.passed),score:Math.max(finite(x.score),finite(y.score))};
  }}
  const history=new Map();for(const entry of [...a.history,...b.history])history.set([entry.at,entry.lesson,entry.kind,entry.metric,entry.correct,entry.score].join(':'),entry);
  out.history=[...history.values()].sort((x,y)=>y.at-x.at).slice(0,50);out.updatedAt=Math.max(a.updatedAt,b.updatedAt);
  return normalizePianoState(out);
}
export function toPianoProgress(value){
  const v=normalizePianoState(value),out={version:1,updatedAt:v.updatedAt,courseProgress:v.courseProgress,learningProgress:v.learningProgress,history:v.history};
  for(const name of maps)out[name]=v[name];out.pendingFlow=null;
  if(v.pendingFlow&&typeof v.pendingFlow==='object'){const row=v.pendingFlow;out.pendingFlow={courseId:text(row.courseId),compositionId:text(row.compositionId),stageId:text(row.stageId),polish:row.polish===true,goalReached:row.goalReached===true};}
  out.dailyRun=v.dailyRun;
  if(typeof v.favoriteSongId==='string')out.favoriteSongId=v.favoriteSongId.slice(0,80);
  out.preferences={};for(const name of ['voice','cropKeys','intros','accompaniment','metronome'])if(typeof v[name]==='boolean')out.preferences[name]=v[name];
  for(const [name,min,max]of [['tempo',20,240],['sensitivity',1,100],['backingVolume',0,1]])if(Number.isFinite(v[name])&&v[name]>=min&&v[name]<=max)out.preferences[name]=v[name];
  if(['mic','midi'].includes(v.input))out.preferences.input=v.input;if(['falling','staff','both'].includes(v.notation))out.preferences.notation=v.notation;if([-1,0,1].includes(v.octave))out.preferences.octave=v.octave;
  return out;
}
export function samePianoProgress(a,b){
  const canonical=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  return JSON.stringify(canonical(toPianoProgress(a)))===JSON.stringify(canonical(toPianoProgress(b)));
}
