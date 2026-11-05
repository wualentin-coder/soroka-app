import { summarizeTimingOffsets } from './timing-feedback.mjs?v=0b58b5803e6f';

const EPSILON=1e-9,MAX_NOTES=5000,MAX_SECONDS=86400,GROUP_WINDOW=.035;
const validClock=value=>Number.isFinite(value)&&value>=0;
const validPitch=value=>Number.isInteger(value)&&value>=0&&value<=127;

function copyScore(notes,timeline) {
  if(!Array.isArray(notes)||!notes.length||notes.length>MAX_NOTES||!Array.isArray(timeline)||timeline.length!==notes.length)
    throw new TypeError('TimedSession needs matching note and timeline arrays of 1–5000 events.');
  let sourcePrevious=-Infinity,timelinePrevious=-Infinity;
  const copiedNotes=Array.from(notes,(note,index)=>{
    if(!note||!validPitch(note.midi)||
      (note.time!==undefined&&(!Number.isFinite(note.time)||note.time<0||note.time>MAX_SECONDS||note.time<sourcePrevious))||
      (note.duration!==undefined&&(!Number.isFinite(note.duration)||note.duration<=0||note.duration>MAX_SECONDS))||
      (note.time!==undefined&&note.duration!==undefined&&note.time+note.duration>MAX_SECONDS)||
      (note.beats!==undefined&&(!Number.isFinite(note.beats)||note.beats<=0)))
      throw new TypeError(`TimedSession note ${index} has invalid pitch or source timing.`);
    if(note.time!==undefined)sourcePrevious=note.time;
    return {...note};
  });
  const copiedTimeline=Array.from(timeline,(event,index)=>{
    if(!event||event.midi!==copiedNotes[index].midi||!Number.isFinite(event.time)||event.time<0||
      event.time<timelinePrevious||!Number.isFinite(event.duration)||event.duration<=0||event.time+event.duration>MAX_SECONDS||
      (event.index!==undefined&&event.index!==index))
      throw new TypeError(`TimedSession timeline ${index} must preserve ordered note pitches and valid scaled seconds.`);
    timelinePrevious=event.time;
    return {midi:event.midi,time:event.time,duration:event.duration,index};
  });
  return {notes:copiedNotes,timeline:copiedTimeline};
}

/**
 * Continuous attack timing and pitch assessment. It measures fresh note-on
 * events only; key holds, fingering and note duration are not graded.
 * Source groups retain their identity while the supplied scaled timeline owns
 * the clock. Resolving a future event never moves an earlier pending target.
 * Optional bounded inputGrace delays expiry for acoustic confirmation only;
 * play(...,{onsetAt}) measures that evidence without rewinding the score.
 */
export class TimedSession {
  constructor(notes,{timeline,now=0,leadIn=1.6,window=.28,maxConsecutive=4,inputGrace=0,strictRests=false}={}) {
    if(!validClock(now)||!Number.isFinite(leadIn)||leadIn<0||leadIn>MAX_SECONDS||
      !Number.isFinite(window)||window<=0||window>10||!Number.isInteger(maxConsecutive)||maxConsecutive<0||maxConsecutive>MAX_NOTES||
      !Number.isFinite(inputGrace)||inputGrace<0||inputGrace>.3||typeof strictRests!=='boolean')
      throw new RangeError('Invalid timed session clock, lead-in, window or error limit.');
    const score=copyScore(notes,timeline);this.notes=score.notes;this.timeline=score.timeline;
    this.window=window;this.maxConsecutive=maxConsecutive;this.inputGrace=inputGrace;this.strictRests=strictRests;this.extraAttacks=0;this._lastNow=now;
    this._inputFloor=now;this._lastOnsetAt=-Infinity;
    this._value=this.timeline[0].time-leadIn;this._running=true;this._ended=false;this._earlyAbort=false;
    this.elapsedMs=0;this.correct=0;this.wrong=0;this.skipped=0;this.errors=[];this.results=[];
    this.targetOutcomes=this.notes.map(()=>null);this._resolved=this.notes.map(()=>false);
    this.hitOffsetsMS=this.notes.map(()=>null);
    this._firstIndex=0;this._expireCursor=0;this._streakCursor=0;this.consecutiveErrors=0;this._groups=[];
    this._eventGroups=new Int32Array(this.notes.length);
    const sourceTimed=this.notes.every(note=>Number.isFinite(note.time));
    for(let index=0;index<this.notes.length;index++) {
      const sourceTime=sourceTimed?this.notes[index].time:this.timeline[index].time;
      let group=this._groups.at(-1);
      if(!group||sourceTime-group.sourceTime>GROUP_WINDOW+EPSILON) {
        group={start:index,end:index,sourceTime,time:this.timeline[index].time,remaining:0,failed:false,missed:false};this._groups.push(group);
      }
      group.end=index+1;group.remaining++;this._eventGroups[index]=this._groups.length-1;
    }
    this._end=Math.max(...this.timeline.map(event=>event.time+event.duration),this._groups.at(-1).time+window+inputGrace);
  }

  get value(){return this._value;}
  get running(){return this._running;}
  get paused(){return !this._running;}
  get waiting(){return false;}
  get earlyAbort(){return this._earlyAbort;}
  get finished(){return this._ended||this._earlyAbort;}
  get index(){return this._firstIndex;}
  get expected(){return this.finished?null:this.notes[this._firstIndex]?.midi??null;}
  get expectedNotes(){return this.finished?[]:[...new Set(this._pending(this._currentGroup()).map(index=>this.notes[index].midi))];}
  get groupNotes(){const group=this._currentGroup();return this.finished||!group?[]:[...new Set(this.notes.slice(group.start,group.end).map(note=>note.midi))];}
  get firstAttemptCorrect(){return this.targetOutcomes.filter(outcome=>outcome===1).length;}
  get scorePercent(){return Math.floor(this.firstAttemptCorrect*100/this.notes.length);}
  get scoreOutOf10(){return this.scorePercent/10;}

  _snapshot(){return {time:this._value,running:this._running,finished:this.finished,waiting:false};}
  _currentGroup(){return this._firstIndex<this.notes.length?this._groups[this._eventGroups[this._firstIndex]]:null;}
  _pending(group){const pending=[];if(group)for(let index=group.start;index<group.end;index++)if(!this._resolved[index])pending.push(index);return pending;}
  _advanceIndex(){while(this._firstIndex<this.notes.length&&this._resolved[this._firstIndex])this._firstIndex++;}
  _outcome(index,value){if(this.targetOutcomes[index]===null)this.targetOutcomes[index]=value;}
  _abortIfNeeded(){if(this.maxConsecutive>0&&this.consecutiveErrors>=this.maxConsecutive){this._earlyAbort=true;this._running=false;}}
  _updateStreak(){
    // Resolve the streak in score order. A wrong pitch and its later timeout
    // belong to one failed onset group; correcting it cannot make it clean.
    while(this._streakCursor<this._groups.length){
      const group=this._groups[this._streakCursor];
      if(!group.failed&&group.remaining)break;
      this.consecutiveErrors=group.failed?this.consecutiveErrors+1:0;
      this._streakCursor++;this._abortIfNeeded();if(this._earlyAbort)break;
    }
  }
  _failGroup(group){group.failed=true;this._updateStreak();}
  _finishIfDue(){if(this._firstIndex>=this.notes.length&&this._value>=this._end-EPSILON){this._value=this._end;this._ended=true;this._running=false;}}
  _miss(group) {
    const pending=this._pending(group);
    for(const index of pending) {
      this._outcome(index,0);this._resolved[index]=true;this.skipped++;
      this.errors.push({index,expected:this.notes[index].midi,heard:null});
      this.results.push({index,kind:'skipped'});
    }
    group.remaining=0;this._advanceIndex();
    if(pending.length){group.missed=true;this._failGroup(group);}
    return pending;
  }

  tick(now) {
    if(!validClock(now))throw new RangeError('TimedSession tick needs finite non-negative milliseconds.');
    if(now<this._lastNow)return this._snapshot();
    const elapsed=(now-this._lastNow)/1000;this._lastNow=now;
    if(!this._running||this.finished)return this._snapshot();
    const before=this._value,desired=before+elapsed;
    let stop=desired;
    while(this._expireCursor<this._groups.length) {
      const group=this._groups[this._expireCursor];
      if(!group.remaining){this._expireCursor++;continue;}
      const deadline=group.time+this.window+this.inputGrace;
      if(desired<=deadline+EPSILON)break;
      this._miss(group);this._expireCursor++;
      if(this._earlyAbort){stop=Math.max(before,deadline);break;}
    }
    if(!this._earlyAbort&&this._firstIndex>=this.notes.length)stop=Math.min(stop,this._end);
    this._value=stop;this.elapsedMs+=Math.max(0,stop-before)*1000;this._finishIfDue();
    return this._snapshot();
  }

  pause(now) {
    if(!validClock(now)||now<this._lastNow)return this._snapshot();
    this.tick(now);this._running=false;return this._snapshot();
  }
  resume(now) {
    if(!validClock(now)||now<this._lastNow||this.finished)return this._snapshot();
    const wasRunning=this._running;this.tick(now);if(this.finished||wasRunning)return this._snapshot();
    this._lastNow=now;this._inputFloor=now;this._running=true;return this._snapshot();
  }

  _nearGroups(at=this._value) {
    const near=[],earliest=at-this.window-EPSILON,latest=at+this.window+EPSILON;
    let low=0,high=this._groups.length;
    while(low<high){const middle=(low+high)>>1;if(this._groups[middle].time<earliest)low=middle+1;else high=middle;}
    for(let index=low;index<this._groups.length&&this._groups[index].time<=latest;index++)near.push(this._groups[index]);
    return near.sort((a,b)=>Math.abs(a.time-at)-Math.abs(b.time-at)||a.start-b.start);
  }

  play(midi,now,input={}) {
    if(!input||typeof input!=='object'||Array.isArray(input))return {kind:'ignored'};
    const onsetAt=Object.hasOwn(input,'onsetAt')?input.onsetAt:now;
    if(!validPitch(midi)||!validClock(now)||!validClock(onsetAt)||now<this._lastNow||onsetAt>now||onsetAt<this._inputFloor||
      onsetAt<this._lastOnsetAt||now-onsetAt>this.inputGrace*1000+EPSILON||!this._running||this.finished)return {kind:'ignored'};
    this.tick(now);if(this.finished)return {kind:'ignored'};
    this._lastOnsetAt=onsetAt;
    // Confirmation may arrive after the attack. The score keeps moving at now;
    // only matching and measured offsets use the bounded input timestamp.
    const heardTime=this._value-(now-onsetAt)/1000;
    if(this.strictRests&&heardTime<this.timeline[0].time-this.window-EPSILON)return {kind:'ignored'};
    const near=this._nearGroups(heardTime),group=near.find(candidate=>this._pending(candidate).some(index=>this.notes[index].midi===midi));
    if(!group) {
      // Repeated attacks already consumed in a partial chord must not become
      // wrong pitches while the other hand is still resolving that chord.
      if(near.some(candidate=>{for(let index=candidate.start;index<candidate.end;index++)if(this._resolved[index]&&this.notes[index].midi===midi)return true;return false;}))return {kind:'ignored'};
      const closest=near.find(candidate=>candidate.remaining);
      if(!closest){
        if(!this.strictRests||near.length||this._firstIndex>=this.notes.length)return {kind:'ignored'};
        // A slightly late correct note already lost its own target. Do not also
        // punish the next target as a rest violation. Genuine later gap attacks
        // and extra attacks after a correctly played note remain measurable.
        const expired=this._groups[this._expireCursor-1];
        if(expired?.missed&&heardTime>expired.time+this.window&&heardTime<=expired.time+this.window+Math.min(.3,this.window)+EPSILON&&
          this.notes.slice(expired.start,expired.end).some(note=>note.midi===midi))return {kind:'ignored',timing:'late',targetIndex:expired.start};
        const targetIndex=this._firstIndex,expected=this.notes[targetIndex].midi,firstAttempt=this.targetOutcomes[targetIndex]===null;
        this._outcome(targetIndex,0);this.wrong++;this.extraAttacks++;
        this.errors.push({index:targetIndex,expected,heard:midi,timing:'rest'});this._failGroup(this._currentGroup());
        return {kind:'wrong',expected,heard:midi,played:midi,targetIndex,firstAttempt,targetOutcome:0,timing:'rest',earlyAbort:this._earlyAbort};
      }
      const pending=this._pending(closest),targetIndex=pending.find(index=>this.targetOutcomes[index]===null)??pending[0];
      const firstAttempt=this.targetOutcomes[targetIndex]===null,expected=this.notes[targetIndex].midi;
      this._outcome(targetIndex,0);this.wrong++;
      this.errors.push({index:targetIndex,expected,heard:midi});this._failGroup(closest);
      return {kind:'wrong',expected,heard:midi,played:midi,targetIndex,firstAttempt,targetOutcome:0,earlyAbort:this._earlyAbort};
    }
    const matches=this._pending(group).filter(index=>this.notes[index].midi===midi),targetIndex=matches[0];
    const firstAttempt=this.targetOutcomes[targetIndex]===null;
    for(const index of matches){this._outcome(index,1);this.hitOffsetsMS[index]=Math.round((heardTime-this.timeline[index].time)*1000000)/1000;this._resolved[index]=true;this.correct++;group.remaining--;this.results.push({index,kind:'correct'});}
    this._advanceIndex();const partial=group.remaining>0;this._updateStreak();
    this._finishIfDue();
    return {kind:this.finished?'complete':partial?'partial':'correct',expected:midi,next:this.expected,targetIndex,firstAttempt,
      targetOutcome:this.targetOutcomes[targetIndex],resolvedIndices:[...matches]};
  }

  skip(now) {
    if(!validClock(now)||now<this._lastNow||!this._running||this.finished)return {kind:'ignored'};
    this.tick(now);const group=this._currentGroup();if(this.finished||!group)return {kind:'ignored'};
    const targetIndex=this._firstIndex,skippedIndices=this._miss(group);this._finishIfDue();
    return {kind:this.finished?'complete':'skipped',targetIndex,firstAttempt:false,targetOutcome:0,skippedIndices,earlyAbort:this._earlyAbort};
  }
  markAssisted(){if(!this.finished)for(const index of this._pending(this._currentGroup()))this._outcome(index,0);}

  report(now) {
    if(!validClock(now))throw new RangeError('TimedSession report needs finite non-negative milliseconds.');
    this.tick(now);const attempts=this.correct+this.wrong+this.skipped;
    return {metric:'timed-notes-v1',finished:this.finished,total:this.notes.length,correct:this.correct,
      firstAttemptCorrect:this.firstAttemptCorrect,wrong:this.wrong,skipped:this.skipped,
      accuracy:attempts?Math.round(this.correct/attempts*100):0,scorePercent:this.scorePercent,scoreOutOf10:this.scoreOutOf10,
      seconds:Math.round(this.elapsedMs/1000),errors:this.errors.map(error=>({...error})),earlyAbort:this._earlyAbort,
      consecutiveErrors:this.consecutiveErrors,targetOutcomes:[...this.targetOutcomes],
      hitOffsetsMS:[...this.hitOffsetsMS],timing:summarizeTimingOffsets(this.hitOffsetsMS),strictRests:this.strictRests,extraAttacks:this.extraAttacks,demo:false};
  }
}
