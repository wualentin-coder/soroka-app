/** Cancellable narration followed by a short, ungraded keyboard demonstration. */
export function createLessonPresenter({ speak, cancelSpeech=()=>{}, onDemoStart=()=>{}, onStopAudio=()=>{}, onPhase=()=>{}, onFrame=()=>{}, onFinish=()=>{}, now=()=>performance.now(), requestFrame=callback=>requestAnimationFrame(callback), cancelFrame=id=>cancelAnimationFrame(id) }={}) {
  let generation=0, frame=0, resolveRun=null;
  const settle=value=>{const resolve=resolveRun;resolveRun=null;resolve?.(value);};
  function cancel(){
    generation++;if(frame)cancelFrame(frame);frame=0;cancelSpeech();onStopAudio();settle(false);onPhase('idle');
  }
  function play(plan,{voice=true}={}){
    if(!plan||!Array.isArray(plan.frames)||!plan.frames.length||plan.frames.length>64)throw new TypeError('An introduction needs a bounded note example.');
    let previous=-Infinity;
    for(const note of plan.frames){if(!Number.isInteger(note.midi)||note.midi<0||note.midi>127||!Number.isFinite(note.time)||note.time<0||note.time<previous||!Number.isFinite(note.duration)||note.duration<=0||note.time+note.duration>20)throw new TypeError('Invalid introduction timing.');previous=note.time;}
    cancel();const token=generation,leadIn=.65,end=Math.max(...plan.frames.map(n=>n.time+n.duration))+.3;
    const tempo=Number.isFinite(plan.tempo)&&plan.tempo>0?plan.tempo:60,beatSeconds=60/tempo;
    const result=new Promise(resolve=>{resolveRun=resolve;});
    onPhase('explaining');onFrame({playhead:-leadIn,active:[],index:0,beat:0,beatProgress:0,playing:false});
    (async()=>{
      if(voice&&typeof speak==='function')try{await speak(plan.spoken);}catch{}
      if(token!==generation)return;
      onPhase('demonstrating');const started=now();onDemoStart(plan.frames,leadIn);
      function tick(){
        if(token!==generation)return;
        const playhead=Math.round(((now()-started)/1000-leadIn)*1e9)/1e9;
        if(playhead>=end){frame=0;onStopAudio();onPhase('ready');settle(true);onFinish();return;}
        const active=plan.frames.filter(n=>playhead>=n.time&&playhead<n.time+n.duration).map(n=>n.midi);
        let index=plan.frames.findIndex(n=>playhead>=n.time&&playhead<n.time+n.duration);
        if(index<0)index=plan.frames.findIndex(n=>n.time>playhead);if(index<0)index=plan.frames.length-1;
        onFrame({playhead,active:[...new Set(active)],index,beat:playhead<0?0:Math.floor(playhead/beatSeconds)%4+1,beatProgress:playhead<0?0:(playhead%beatSeconds)/beatSeconds,playing:true});
        frame=requestFrame(tick);
      }
      tick();
    })();
    return result;
  }
  return {play,cancel};
}
