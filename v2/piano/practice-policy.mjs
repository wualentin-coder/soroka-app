// Preparation is a short UI cue, independent of the learner's musical tempo.
export function practicePolicy({lesson={},mode='learn',source='midi',retry=false,timeline=[]}={}){
  const beginner=['orientation','pulse-and-space','five-notes'].includes(lesson.moduleId);
  const times=[...new Set(timeline.map(n=>n.time).filter(Number.isFinite))].sort((a,b)=>a-b);
  const gaps=times.slice(1).map((time,index)=>time-times[index]).filter(gap=>gap>.035);
  const gap=gaps.length?Math.min(...gaps):Infinity;
  const windowSeconds=beginner?Math.min(.42,gap*.45):.28;
  return {beginner,windowSeconds,maxConsecutive:beginner?0:4,
    leadIn:mode==='flow'?(retry ? .7 : 1.2):(retry ? .25 : .65),
    inputGrace:source==='mic'&&!lesson.polyphonic ? .22 : 0};
}
