/* Pure extraction of canonical Auto and workout option projections. */
  export function makeSteps(C,option,counts,config){
    const steps=[];
    const add=(kind,block,index,e,set,total,seconds)=>{if(seconds>0)steps.push({kind,block,index,exercise:e,set,total,seconds,group:`${block}:${index}`});};
    const workSeconds=e=>C.holdSecondsFor(e)||e.executionSeconds||0;
    const restSeconds=e=>C.restSecondsFor(e,option.plan.routine_type);
    const warm=config.warmup?option.warmup?.exercises||[]:[];
    if(warm.length){
      add('prep','warmup',0,warm[0],1,C.exerciseSets(warm[0]),config.prep);
      warm.forEach((e,index)=>{const total=C.exerciseSets(e);for(let set=1;set<=total;set++){
        add('work','warmup',index,e,set,total,workSeconds(e));
        const next=set<total?e:warm[index+1];
        if(next){const nextIndex=set<total?index:index+1,nextSet=set<total?set+1:1;add(set<total?'rest':'between','warmup',nextIndex,next,nextSet,C.exerciseSets(next),restSeconds(e));add('prep','warmup',nextIndex,next,nextSet,C.exerciseSets(next),config.prep);}
      }});
      steps.push({kind:'boundary',block:'warmup',group:'warmup:end',index:0,exercise:warm.at(-1),set:1,total:1,seconds:0});
    }
    const pending=option.plan.exercises.flatMap((e,index)=>counts[index]<C.exerciseSets(e)?[{e,index}]:[]);
    if(pending.length)add('prep','main',pending[0].index,pending[0].e,(counts[pending[0].index]||0)+1,C.exerciseSets(pending[0].e),config.prep);
    pending.forEach(({e,index},position)=>{const total=C.exerciseSets(e);for(let set=(counts[index]||0)+1;set<=total;set++){
      add('work','main',index,e,set,total,workSeconds(e));
      if(set<total)add('rest','main',index,e,set+1,total,restSeconds(e));
      else if(pending[position+1]){const next=pending[position+1];add('between','main',next.index,next.e,(counts[next.index]||0)+1,C.exerciseSets(next.e),restSeconds(e));}
    }});
    return steps;
  }
  export const prescription=(option,date=option.date)=>JSON.stringify([option.key,date,option.kind,option.plan,option.warmup]);
  export function samePrescription(C,saved,option){
    if(option.historyOnly||option.date>C.todayKey())return false;
    if(saved===prescription(option))return true;
    // V2 keys identify the assignment independently of its rescheduled calendar date.
    // Retain the saved fingerprint format so existing scoped snapshots can resume.
    if(option.legacy)return false;
    try{const parts=JSON.parse(saved);return Array.isArray(parts)&&parts.length===5&&typeof parts[1]==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(parts[1])&&saved===prescription(option,parts[1]);}catch{return false;}
  }

// Pure state projections taken from sport-plan.js; no renderer or fake demo fallback.
function freeExercise(e,i){const sets=Math.max(1,Number(e.sets)||1),timed=Number(e.seconds)>0;return{id:e.id||`e${i+1}`,name:e.name,sets,mode:timed?'timed':'reps',sets_reps:timed?`${sets} × ${e.seconds} сек`:`${sets} × ${e.reps||'10'}`,hold:timed?Number(e.seconds):0,rest:Number(e.rest??90),technique:e.technique||'',bodyweight:e.bodyweight};}
export function resolveWorkouts(C,{state,catalog,startedOn,planDays=[]}){
 const programs=C.workoutOptions(planDays,catalog,C.programDaySince(startedOn||C.todayKey()),startedOn||undefined,state);
 const free=Object.entries(state.freeWorkouts||{}).filter(([,w])=>!w.deleted).map(([id,w])=>({key:`free|${id}`,date:w.date,kind:'main',programTitle:'Свободная тренировка',legacy:false,addedAt:w.createdAt,plan:{day_number:0,routine_type:'main',title:w.title||'Свободная тренировка',focus:'',exercises:(w.exercises||[]).map(freeExercise)}}));
 const options=[...programs,...free].map(o=>{const extras=Object.entries(state.workoutExtras?.[o.key]||{}).map(([id,e],i)=>freeExercise({...e,id},i));return extras.length?{...o,plan:{...o.plan,exercises:[...o.plan.exercises,...extras]}}:o;}).map(o=>{
  const swaps=state.exerciseSwaps||{},program=C.optionProgramKey(o);let changed=false;
  const exercises=o.plan.exercises.map((e,i)=>{const id=e.id??String(i),swap=swaps[`${o.key}|${id}`]||swaps[`${program}|name:${C.exerciseKey(e.name)}`];if(!swap)return e;changed=true;return{...e,name:swap.name,technique:swap.technique||'',video:undefined,muscles:swap.muscles,bodyweight:swap.bodyweight,swappedFrom:e.name};});
  return changed?{...o,plan:{...o.plan,exercises}}:o;
 });
 return{all:options,visible:C.visibleWorkoutOptions(options,state)};
}
// Same structural restore checks as the current canonical Auto; stored exercises are never trusted.
export function validateCheckpoint(C,saved,option,state,scope,now){
 const finite=n=>typeof n==='number'&&Number.isFinite(n),limit=7*86400000;
 if(!saved?.active||saved.workout!==option?.key||!Array.isArray(saved.steps)||!Number.isInteger(saved.position)||!saved.steps[saved.position]||now-saved.savedAt>6*3600000)return null;
 if(saved.schema!==1||saved.owner!==scope||!samePrescription(C,saved.prescription,option)||saved.fast!==false||saved.config?.prep!==5||typeof saved.config.warmup!=='boolean')return null;
 if(!finite(saved.savedAt)||saved.savedAt>now||!finite(saved.startedAt)||saved.startedAt>saved.savedAt||!finite(saved.pausedTotal)||saved.pausedTotal<0||!Array.isArray(saved.skipped))return null;
 if(saved.pausedAt!==null&&(!finite(saved.pausedAt)||saved.pausedAt>saved.savedAt))return null;
 if(typeof saved.token!=='string'||!saved.token||!Array.isArray(saved.initialCounts)||saved.initialCounts.length!==option.plan.exercises.length)return null;
 const counts=option.plan.exercises.map((e,i)=>C.completedSets(C.optionChecks(option,state)[i],C.exerciseSets(e)));
 if(saved.initialCounts.some((n,i)=>!Number.isInteger(n)||n<0||n>counts[i]))return null;
 const canonical=makeSteps(C,option,saved.initialCounts,saved.config),signature=s=>JSON.stringify([s.kind,s.block,s.index,s.set,s.total,s.seconds,s.group]);
 if(saved.steps.length>canonical.length*2)return null;
 let cursor=0;
 for(const step of saved.steps){const expected=canonical[cursor];if(!step||!expected)return null;if(signature(step)===signature(expected)){cursor++;continue;}if(expected.kind!=='work'||signature(step)!==signature({...expected,kind:'prep',seconds:5}))return null;}
 if(cursor!==canonical.length||saved.skipped.some(group=>!canonical.some(s=>s.group===group))||saved.skipped.includes(saved.steps[saved.position].group))return null;
 if(saved.steps.slice(0,saved.position).some(s=>s.block==='main'&&s.kind==='work'&&s.set>counts[s.index]&&!saved.skipped.includes(s.group)))return null;
 const clock=saved.clock;
 if(saved.steps[saved.position].kind!=='boundary'&&(!clock||!finite(clock.deadline)||clock.deadline<0||clock.deadline>now+limit||clock.pausedMs!==null&&(!finite(clock.pausedMs)||clock.pausedMs<0||clock.pausedMs>limit)))return null;
 const result=structuredClone(saved);result.steps=result.steps.map(s=>({...s,exercise:(s.block==='main'?option.plan:option.warmup).exercises[s.index]}));return result;
}
