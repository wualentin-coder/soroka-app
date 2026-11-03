export const MICRO_PROGRESS_LIMITS=Object.freeze({runs:200,stages:64,idLength:160,maxTimestamp:8640000000000000});
const unsafe=new Set(['__proto__','prototype','constructor']);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value)&&!unsafe.has(value);
const version=value=>typeof value==='string'&&/^microlearning-v1:[a-z0-9][a-z0-9._:-]{0,159}$/.test(value);
const timestamp=value=>Number.isSafeInteger(value)&&value>=0&&value<=MICRO_PROGRESS_LIMITS.maxTimestamp;
const help=value=>Number.isInteger(value)&&value>=0&&value<=3;
const ordered=values=>[...new Set(values)].sort();
function stages(value){
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>MICRO_PROGRESS_LIMITS.stages)return null;
  return ordered(value.filter(id));
}
function row(value){
  if(!object(value)||!Object.hasOwn(value,'version')||!Object.hasOwn(value,'stageId')||!version(value.version)||!id(value.stageId)||
      !timestamp(value.at===undefined?0:value.at)||!help(value.helpLevel===undefined?0:value.helpLevel))return null;
  const completed=stages(value.completed),skipped=stages(value.skipped);
  if(!completed||!skipped)return null;
  return {version:value.version,stageId:value.stageId,completed,skipped:skipped.filter(stage=>!completed.includes(stage)).slice(0,MICRO_PROGRESS_LIMITS.stages-completed.length),helpLevel:value.helpLevel??0,at:value.at??0};
}
function compare(a,b){
  if(a.at!==b.at)return a.at>b.at?1:-1;
  // History union must not change which cursor/help wins an equal-time tie.
  const x=JSON.stringify([a.version,a.stageId,a.helpLevel]),y=JSON.stringify([b.version,b.stageId,b.helpLevel]);
  return x===y?0:x>y?1:-1;
}

/** Navigation receipts only; none of these fields is evidence of musical mastery. */
export function normalizeMicroProgress(value){
  const entries=[];
  for(const [key,raw] of Object.entries(object(value)?value:{})){
    if(!id(key))continue;const normalized=row(raw);if(normalized)entries.push([key,normalized]);
  }
  entries.sort(([keyA,a],[keyB,b])=>b.at-a.at||(keyA<keyB?-1:keyA>keyB?1:0));
  return Object.fromEntries(entries.slice(0,MICRO_PROGRESS_LIMITS.runs));
}

export function mergeMicroProgress(left,right){
  const a=normalizeMicroProgress(left),b=normalizeMicroProgress(right),out={};
  for(const key of new Set([...Object.keys(a),...Object.keys(b)])){
    const x=a[key],y=b[key];if(!x||!y){out[key]=x||y;continue;}
    const latest=compare(x,y)>=0?x:y;
    if(x.version!==y.version){out[key]=latest;continue;}
    const completed=ordered([...x.completed,...y.completed]).slice(0,MICRO_PROGRESS_LIMITS.stages);
    const skipped=ordered([...x.skipped,...y.skipped]).filter(stage=>!completed.includes(stage)).slice(0,MICRO_PROGRESS_LIMITS.stages-completed.length);
    out[key]={...latest,completed,skipped};
  }
  return normalizeMicroProgress(out);
}

function validatePlan(plan){
  if(!object(plan)||!id(plan.id)||!version(plan.version)||!Array.isArray(plan.stages)||!plan.stages.length||plan.stages.length>MICRO_PROGRESS_LIMITS.stages)
    throw new TypeError('Invalid microlearning plan.');
  const ids=plan.stages.map(stage=>object(stage)&&id(stage.id)?stage.id:null);
  if(ids.some(stage=>stage===null)||new Set(ids).size!==ids.length)throw new TypeError('Invalid microlearning stage IDs.');
  return new Set(ids);
}
const fresh=plan=>({version:plan.version,stageId:plan.stages[0].id,completed:[],skipped:[],helpLevel:0,at:0});

export function getMicroRun(map,plan){
  const allowed=validatePlan(plan),saved=normalizeMicroProgress(map)[plan.id];
  if(!saved||saved.version!==plan.version||![saved.stageId,...saved.completed,...saved.skipped].every(stage=>allowed.has(stage)))return fresh(plan);
  return {...saved,completed:[...saved.completed],skipped:[...saved.skipped]};
}

export function updateMicroRun(map,plan,change){
  const allowed=validatePlan(plan);
  if(!object(change)||Object.keys(change).some(key=>!['stageId','completedStageId','skippedStageId','helpLevel','at'].includes(key))||
      !allowed.has(change.stageId)||['completedStageId','skippedStageId'].some(key=>change[key]!==undefined&&!allowed.has(change[key])))
    throw new TypeError('Invalid microlearning progress update.');
  if(change.helpLevel!==undefined&&!help(change.helpLevel))throw new RangeError('Invalid microlearning help level.');
  const at=change.at===undefined?Date.now():change.at;if(!timestamp(at))throw new RangeError('Invalid microlearning update timestamp.');
  const out=normalizeMicroProgress(map),current=getMicroRun(out,plan);
  const completed=ordered([...current.completed,...(change.completedStageId?[change.completedStageId]:[])]);
  const skipped=ordered([...current.skipped,...(change.skippedStageId?[change.skippedStageId]:[])]).filter(stage=>!completed.includes(stage));
  out[plan.id]={version:plan.version,stageId:change.stageId,completed,skipped,helpLevel:change.helpLevel??current.helpLevel,at};
  return normalizeMicroProgress(out);
}
