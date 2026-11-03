const WINDOW=.035,EPSILON=1e-9,MAX_NOTES=5000;
const primitive=value=>['string','boolean'].includes(typeof value)||typeof value==='number'&&Number.isFinite(value)?value:null;

/** Playback identity only; never serializes embedded MIDI, URLs or arbitrary metadata. */
export function musicalNoteKey(note){
  return [note.midi,note.time,note.duration,...['id','hand','sourceTrack','track','sourceIndex','originalMidi','sourceTime','sourceDuration','studySourceTime','beats','velocity','channel','percussion','ticks','durationTicks'].map(key=>primitive(note[key]))];
}

/** Cache/progress invalidation, not an authorization or cryptographic token. */
export function songFingerprint(values){
  let a=2166136261,b=0x9e3779b9;
  for(const value of values){const text=typeof value==='string'?value:JSON.stringify(value);for(let i=0;i<text.length;i++){const code=text.charCodeAt(i);a=Math.imul(a^code,16777619)>>>0;b=Math.imul(b^code,2246822519)>>>0;}a=Math.imul(a^255,16777619)>>>0;b=Math.imul(b^255,2246822519)>>>0;}
  return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0');
}

export function songOnsetGroups(notes){
  if(!Array.isArray(notes)||notes.length>MAX_NOTES)throw new TypeError('Song learning needs at most 5000 source notes.');
  const groups=[];let previous=-Infinity;
  for(let start=0;start<notes.length;){
    const first=notes[start];if(!Number.isFinite(first?.time)||first.time<0||first.time<previous)throw new TypeError('Song notes must retain ordered source times.');
    let end=start+1;while(end<notes.length&&notes[end].time-first.time<=WINDOW+EPSILON){if(!Number.isFinite(notes[end].time)||notes[end].time<first.time)throw new TypeError('Song notes must retain ordered source times.');end++;}
    groups.push({start,end,time:first.time,last:notes[end-1].time,notes:notes.slice(start,end)});previous=notes[end-1].time;start=end;
  }
  return groups;
}

/** Phrase markers/rests are preferred; the bound still protects very long MIDI. */
export function songPhraseSections(notes,{referenceHand='right',sourceTempo=60}={}){
  const combined=songOnsetGroups(notes);if(!combined.length)return[];
  const references=songOnsetGroups(notes.filter(note=>note.hand===referenceHand));
  const refIds=new Map();references.forEach((group,index)=>group.notes.forEach(note=>refIds.set(note,index)));
  const guards=[...combined,...references,...songOnsetGroups(notes.filter(note=>note.hand!==referenceHand))]
    .filter(group=>group.last>group.time+EPSILON).map(group=>({start:group.time,end:group.last})).sort((a,b)=>a.start-b.start);
  const intervals=[];for(const guard of guards){const last=intervals.at(-1);if(last&&guard.start<=last.end+EPSILON)last.end=Math.max(last.end,guard.end);else intervals.push({...guard});}
  const safe=time=>!intervals.some(guard=>guard.start<time-EPSILON&&guard.end>=time-EPSILON);
  const restThreshold=Math.max(.35,60/(Number.isFinite(sourceTempo)&&sourceTempo>0?sourceTempo:60));
  let referenceEnd=-Infinity;
  const boundaries=combined.map((group,index)=>{
    const primary=group.notes.filter(note=>note.hand===referenceHand),rest=primary.length&&Number.isFinite(referenceEnd)&&group.time-referenceEnd>=restThreshold-EPSILON;
    const phrase=group.notes.some(note=>note.phraseStart===true);
    for(const note of primary)referenceEnd=Math.max(referenceEnd,note.time+note.duration);
    return {index,time:group.time,safe:safe(group.time),reason:phrase?'phrase':rest?'rest':null};
  });
  const sections=[];let start=0;
  while(start<combined.length){
    let refs=new Set(),end=start+1,reason='end',soft=null,pendingSemantic=null;
    for(let index=start;index<combined.length;index++){
      const boundary=boundaries[index],count=index-start;
      if(index>start){
        if(boundary.reason)pendingSemantic=boundary.reason;
        if(boundary.safe&&pendingSemantic){end=index;reason=pendingSemantic;break;}
        if(boundary.safe&&(refs.size>=8||count>=16)){
          // Give an approaching marked phrase/rest a chance before falling back
          // to a count boundary, while keeping the maximum phrase bounded.
          soft??=index;
          const later=boundaries.slice(index+1,Math.min(combined.length,start+17)).find(candidate=>candidate.reason);
          if(!later&&combined.length-index<=3&&combined.length-start<=16){end=combined.length;reason='end';break;}
          if(!later||count>=16){end=index;reason='bounded';break;}
        }
      }
      for(const note of combined[index].notes)if(refIds.has(note))refs.add(refIds.get(note));
      end=index+1;
      if(end-start>128)throw new RangeError('Этот MIDI слишком большой для пошагового обучения. Попробуй более короткую аранжировку.');
    }
    // A semantic marker inside overlapping 35 ms guards can be deferred only
    // to a safe group boundary; no hand's chord is split to meet a note count.
    if(end<=start)end=soft??start+1;
    sections.push({start:combined[start].time,end:end<combined.length?combined[end].time:Math.max(...notes.map(note=>note.time+note.duration)),boundary:reason});start=end;
  }
  return sections;
}

/** A recommendation only: it cannot alter a result, coverage or mastery. */
export function recommendSongRepair(stage,report,{contextGroups=1,maxGroups=8,maxNotes=64}={}){
  const notes=stage?.notes,total=notes?.length;
  if(!Array.isArray(notes)||!total||total>MAX_NOTES||!Number.isInteger(contextGroups)||contextGroups<0||contextGroups>2||
    !Number.isInteger(maxGroups)||maxGroups<1||maxGroups>16||!Number.isInteger(maxNotes)||maxNotes<1||maxNotes>128||
    report?.finished!==true||report.demo||report.breakdown||report.total!==total||!['first-attempt-v1','timed-notes-v1'].includes(report.metric)||
    !Number.isInteger(report.firstAttemptCorrect)||report.firstAttemptCorrect<0||report.firstAttemptCorrect>total||
    notes.some(note=>!Number.isFinite(note?.time)||note.time<0||!Number.isFinite(note.duration)||note.duration<=0||note.time+note.duration>86400))return null;
  let groups;try{groups=songOnsetGroups(notes);}catch{return null;}
  const failed=new Set(),kinds=new Map();
  if(Array.isArray(report.targetOutcomes)){
    if(report.targetOutcomes.length!==total||Array.from(report.targetOutcomes).some(value=>![0,1,null].includes(value))||
      report.targetOutcomes.filter(value=>value===1).length!==report.firstAttemptCorrect||!report.earlyAbort&&report.targetOutcomes.includes(null))return null;
    report.targetOutcomes.forEach((value,index)=>{if(value===0)failed.add(index);});
  }
  for(const error of Array.isArray(report.errors)?report.errors.slice(0,10000):[]){
    if(!Number.isInteger(error?.index)||error.index<0||error.index>=total)continue;
    failed.add(error.index);const kind=error.timing==='rest'||error.heard===null&&report.metric==='timed-notes-v1'?'timing':
      Number.isInteger(error.heard)&&error.heard!==notes[error.index].midi?'pitch':'notes';
    const set=kinds.get(error.index)||new Set();set.add(kind);kinds.set(error.index,set);
  }
  if(!failed.size)return null;
  const weights=groups.map(group=>group.notes.reduce((sum,_note,index)=>sum+Number(failed.has(group.start+index)),0));
  let focusStart=weights.findIndex(Boolean),focusEnd=focusStart+1,best=-1;
  const focusSize=Math.max(1,Math.min(3,maxGroups-contextGroups*2));
  for(let start=0;start<groups.length;start++){
    const end=Math.min(groups.length,start+focusSize),weight=weights.slice(start,end).reduce((sum,n)=>sum+n,0);
    if(weight>best){best=weight;focusStart=start;focusEnd=end;}
  }
  while(focusStart<focusEnd-1&&!weights[focusStart])focusStart++;
  while(focusEnd>focusStart+1&&!weights[focusEnd-1])focusEnd--;
  let startGroup=Math.max(0,focusStart-contextGroups),endGroup=Math.min(groups.length,focusEnd+contextGroups);
  while(endGroup-startGroup>maxGroups||groups[endGroup-1].end-groups[startGroup].start>maxNotes){
    if(endGroup>focusEnd)endGroup--;else if(startGroup<focusStart)startGroup++;else if(focusEnd-focusStart>1){focusEnd--;endGroup=focusEnd;}else return null;
  }
  const start=groups[startGroup].start,end=groups[endGroup-1].end,focusFirst=groups[focusStart].start,focusLast=groups[focusEnd-1].end;
  const reasons=new Set([...failed].filter(index=>index>=focusFirst&&index<focusLast).flatMap(index=>[...(kinds.get(index)||[])]));
  const specific=[...reasons].filter(kind=>kind!=='notes'),reason=specific.length>1?'mixed':specific[0]||'notes';
  const origin=Number.isFinite(stage.sourceStart)?stage.sourceStart:0;
  return {start,end,focusStart:focusFirst,focusEnd:focusLast,startGroup,endGroup,noteCount:end-start,
    sourceStart:origin+notes[start].time,sourceEnd:origin+Math.max(...notes.slice(start,end).map(note=>note.time+note.duration)),reason,assessment:'practice-only'};
}
