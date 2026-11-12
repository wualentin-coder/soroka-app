import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/english-workspace.js';
import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/english-practice-core.js';
import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/english-media-practice-core.js';
import '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/english-lyrics-practice-core.js';
import {createEnglishDomain} from '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/english-domain.mjs';
import {englishSpecimenSnapshot} from '/soroka-app/v2/common-c592c1e044452947/docs/design/component-map/packet28.js';
import {setSensoryFocus} from '/soroka-app/v2/common-c592c1e044452947/prototypes/soroka-planner/flow-ui/sensory-feedback.js';
import {bindEnglishHost,englishLocalAsset} from './english-host-adapter.js';
import {englishPersistence} from './english-persistence.js';
const clone=value=>structuredClone(value);
function localAudioEffects(core,{explicitOnly=false}={}){
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
export function englishOwner(api){
 let element=null,domain=null,unsubscribe=null,generation=0,loading=null,activeHost=null,lastModel=null;
 const realMode=typeof api.realHost==='function';
 const emptyReal=(status='starting',error='')=>({version:1,revision:0,status,owner:null,data:{},catalog:[],task:null,taskKind:null,error,capabilities:{deck:false,lesson:false,reader:false,conversation:false,authoredPractice:false,mediaPractice:false,lyricsPractice:false,speech:false,mediaPlayback:false,actions:{},routes:{},audio:{}}});
 const cores={authored:globalThis.FlowEnglishPracticeCore,media:globalThis.FlowEnglishMediaPracticeCore,lyrics:globalThis.FlowEnglishLyricsPracticeCore};
 const effects=localAudioEffects(cores.authored,{explicitOnly:realMode}),fixture=realMode?null:englishSpecimenSnapshot();
 async function render(){
  if(element?.isConnected&&domain)return;
  const token=++generation,workspace=element=document.createElement('flow-english-workspace');
  if(realMode){lastModel=emptyReal();workspace.model=lastModel;}api.screen.replaceChildren(workspace);
  loading=(async()=>{try{
   let host;
   if(realMode){host=bindEnglishHost(await api.realHost());if(token!==generation||!workspace.isConnected)return;}
   else{
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(location.origin+'/bound-english-local'));
   const lease=Object.freeze({scope:[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join(''),epoch:Object.freeze({}),authorized:true});
   if(token!==generation||!workspace.isConnected)return;
   const current=captured=>captured===lease&&token===generation;
   host={version:2,capabilities:{practiceEvents:true,completionAttempts:false,swipes:false},captureOwner:()=>lease,isCurrent:current,subscribeInvalidation:()=>()=>{},async send(op,args,captured){
    if(!current(captured))throw Error('english_owner_changed');
    if(op!=='practiceprogress'&&Object.hasOwn(fixture.data,op)){const answer=clone(fixture.data[op]);if(op==='wordlist'&&args.q)answer.items=answer.items.filter(row=>[row.en,row.ru].join(' ').toLowerCase().includes(args.q.toLowerCase()));return answer;}
    if(op==='deck')return{due:[{id:1,en:'still',ru:'всё ещё',isNew:false}],fresh:[],newGoal:1};
    if(!['practiceevent','practiceword','practicesource','practiceprogress'].includes(op))throw Error('Это действие ещё не подключено к локальному учебному обработчику.');
    const response=await fetch('/local-english-practice',{method:'POST',headers:{'Content-Type':'application/json','X-Flow-Local-Fixture':'1'},body:JSON.stringify({op,args})});const answer=await response.json();if(!current(captured))throw Error('english_owner_changed');if(!response.ok||answer.error)throw Error(answer.error||'Не удалось сохранить учебный ответ.');return answer;
   }};}
   activeHost=host;
   const owner=domain=createEnglishDomain({host,storage:localStorage,locks:navigator.locks,cores,effects:realMode?{...effects,...englishPersistence(host,localStorage)}:effects});
   let readLease=null,readFlight=null;
   const reads=lease=>{if(!lease||!host.isCurrent(lease))return Promise.resolve();if(readLease===lease)return readFlight||Promise.resolve();readLease=lease;return readFlight=(async()=>{for(const resource of ['today','words','wordlist','course','progress','practiceprogress']){if(token!==generation||!workspace.isConnected||!host.isCurrent(lease))return;if(realMode&&resource==='practiceprogress'&&host.capabilities.practiceEvents!==true)continue;try{await owner.command('load',{resource});}catch{/* The authoritative error stays in the snapshot. */}}})();};
   const update=model=>{if(token!==generation||!workspace.isConnected)return;lastModel=realMode&&(!model.owner||model.status==='blocked')?emptyReal(model.status,model.error||''):model;workspace.model=lastModel;if(realMode&&model.status==='ready')void reads(host.captureOwner());};update(owner.getSnapshot());unsubscribe=owner.subscribe(update);
   workspace.addEventListener('flow-english-intent',async event=>{event.preventDefault();const {requestId,name,args,options}=event.detail,lease=host.captureOwner();if(token!==generation||!workspace.isConnected)return;const current=()=>token===generation&&workspace.isConnected&&host.isCurrent(lease);try{if(name.startsWith('deck.')&&(!realMode||host.capabilities.swipes!==true))throw Error('Словарная колода ещё не подключена к подтверждённому обработчику. Ответ не записан.');await owner.command(name,args,options);if(current())workspace.settle(requestId,{ok:true});}catch(error){if(current())workspace.settle(requestId,{ok:false,error:error.message});}});
   await owner.ready;if(token!==generation||!workspace.isConnected)return;
   await reads(host.captureOwner());if(token!==generation||!workspace.isConnected)return;
   api.compare('EN14',realMode?lastModel:owner.getSnapshot());
  }catch(error){if(token===generation&&workspace.isConnected){lastModel=realMode?emptyReal('blocked','Не удалось подтвердить подключение к английскому. Повтори вход в Flow.'):{...fixture,status:'blocked',error:error.message};workspace.model=lastModel;}}})();await loading;
 }
 async function guard(){if(!element?.isConnected)return true;const current=element,token=generation,lease=activeHost?.captureOwner();if(element.dirty&&!await api.confirm('discard',element))return false;if(current!==element||token!==generation||realMode&&lease!==activeHost?.captureOwner())return false;effects.stop();return true;}
 async function leave(){effects.stop();const owner=domain;generation++;unsubscribe?.();unsubscribe=null;domain=null;activeHost=null;loading=null;element?.closeWindows();if(owner){await owner.command('suspend');await owner.dispose();}if(realMode)lastModel=emptyReal();return true;}
 document.addEventListener('visibilitychange',()=>{if(domain&&element?.isConnected)void domain.command(document.hidden?'suspend':'resume').catch(()=>{});});
 window.addEventListener('pagehide',()=>{effects.stop();void domain?.command('suspend').catch(()=>{});});
 return{render,guard,leave,get model(){return clone(lastModel||domain?.getSnapshot()||fixture||emptyReal());}};
}
