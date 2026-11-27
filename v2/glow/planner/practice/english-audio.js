import { englishLocalAsset } from './english-host-adapter.js';
import { setSensoryFocus } from './flow-ui/sensory-feedback.js';
export function localAudioEffects(core,{explicitOnly=false}={}){
 const active=new Set();
 const stop=()=>{for(const cancel of [...active])cancel();setSensoryFocus('none');};
 function play(request){
  stop();const {clip,signal,isCurrent=()=>true}=request;
  let url;try{url=englishLocalAsset(core,clip,{explicitOnly});}catch(error){return Promise.reject(error);}
  if(signal.aborted||!isCurrent())return Promise.resolve();
  return new Promise((resolve,reject)=>{
   const audio=new Audio(url);let timer,finished=false;audio.preload='auto';audio.playbackRate=request.slow?.8:1;setSensoryFocus('voice');
   const sample=ended=>{if(!isCurrent()||signal.aborted){finish();return;}request.onSample?.({time:audio.currentTime,paused:audio.paused,rate:audio.playbackRate,...(ended?{ended:true}:{})});};
   const finish=error=>{if(finished)return;finished=true;clearInterval(timer);active.delete(cancel);signal.removeEventListener('abort',cancel);audio.onloadedmetadata=audio.onended=audio.onerror=null;audio.pause();audio.removeAttribute('src');audio.load();if(!active.size)setSensoryFocus('none');error?reject(error):resolve();};
   const cancel=()=>finish();active.add(cancel);signal.addEventListener('abort',cancel,{once:true});
   audio.onloadedmetadata=()=>{if(!isCurrent()||signal.aborted)return finish();request.onMetadata?.({duration:audio.duration});};
   audio.onended=()=>{sample(true);request.onEnded?.();finish();};audio.onerror=()=>finish(Error('Не удалось воспроизвести запись.'));
   sample(false);timer=setInterval(()=>sample(false),80);audio.play().catch(finish);
  });
 }
 return{play,stop};
}
