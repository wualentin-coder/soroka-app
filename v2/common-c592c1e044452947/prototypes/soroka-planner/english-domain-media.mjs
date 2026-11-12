/* Playback evidence only: clip intervals are supplied by the source, never word timings. */
export function createMediaEvidence({clip,isCurrent,now=()=>performance.now(),onHeard=()=>{},onSupport=()=>{},allowEnded=false}={}){
 const finite=value=>typeof value==='number'&&Number.isFinite(value);
 if(!clip||!finite(clip.start)||!finite(clip.end)||clip.start<0||clip.end<=clip.start||clip.end-clip.start>120||typeof isCurrent!=='function'||typeof now!=='function'||typeof onHeard!=='function'||typeof onSupport!=='function'||typeof allowEnded!=='boolean')throw Error('english_bad_media_evidence');
 const start=clip.start,end=clip.end,duration=end-start,support=new Set();
 let ranges=[],coverage=0,anchor=null,lastTime=null,heard=false,disposed=false,invalid=false;
 function current(){if(disposed||invalid)return false;try{if(isCurrent()===true)return true;}catch{}invalid=true;anchor=null;return false;}
 function snapshot(){return Object.freeze({ranges:Object.freeze(ranges.map(range=>Object.freeze([...range]))),coverage,ratio:coverage/duration,heard,support:Object.freeze([...support]),disposed,invalid});}
 function assisted(kind){if(support.has(kind)||!current())return;support.add(kind);onSupport(kind);}
 function add(from,to){
  from=Math.max(start,from);to=Math.min(end,to);if(to<=from)return;
  const merged=[];for(const pair of [...ranges,[from,to]].sort((a,b)=>a[0]-b[0])){const previous=merged.at(-1);if(previous&&pair[0]<=previous[1])previous[1]=Math.max(previous[1],pair[1]);else merged.push([...pair]);}
  if(merged.length>1024){invalid=true;anchor=null;return;}
  ranges=merged;coverage=ranges.reduce((sum,[left,right])=>sum+right-left,0);
 }
 function sample(value){
  if(!current())return snapshot();
  if(!value||typeof value!=='object'||!finite(value.time)||value.time<0||typeof value.paused!=='boolean'||(value.rate!==undefined&&(!finite(value.rate)||value.rate<=0))){invalid=true;anchor=null;return snapshot();}
  let at;try{at=now();}catch{invalid=true;anchor=null;return snapshot();}if(!finite(at)||at<0){invalid=true;anchor=null;return snapshot();}
  if(!current())return snapshot();
  const {time,paused}=value,rate=value.rate??1,last=anchor;
  if(rate<1)assisted('slow');if(!current())return snapshot();
  if(lastTime!==null&&time<lastTime-.25)assisted('seek');if(!current())return snapshot();lastTime=time;
  const finalTail=allowEnded&&value.ended===true&&last?.paused===false&&Math.abs(time-end)<=1e-6;
  if(last&&(!paused||finalTail)){const elapsed=(at-last.at)/1000,delta=time-last.time;if(elapsed>0&&elapsed<=3&&delta>0&&delta<=elapsed*rate*1.35+.15)add(last.time,time);}
  if(!current())return snapshot();anchor={time,at,paused};
  if(!heard&&coverage>=.9*duration&&current()){heard=true;onHeard();}
  return snapshot();
 }
 return Object.freeze({sample,snapshot,dispose(){disposed=true;anchor=null;}});
}
