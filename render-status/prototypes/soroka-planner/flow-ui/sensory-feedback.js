// Optional, finite sensory layer for shared Flow controls. No action waits for it.
const cues=Object.freeze({tap:[587.33,610,.105],open:[369.99,659.26,.29],close:[440,293.66,.19],listen:[440,587.33,.21],stop:[369.99,220,.16],send:[440,739.99,.24],reply:[587.33,880,.34],success:[587.33,880,.36],error:[220,146.83,.28]});
const enabled=key=>['true','on'].includes(document.documentElement.dataset[key]);
const safe=fn=>{try{return fn()}catch{return undefined}};
let context=null,generation=0,unlocked=false,lastGesture=null,gestureAt=-Infinity,lastKind='',lastAt=-Infinity,focus='none',idle=null,vibrating=false,planned=0,hapticAttempts=0,lastHapticAt=-Infinity;
const voices=new Set();
const now=()=>performance.now();
const availableHaptic=()=>!!window.Telegram?.WebApp?.HapticFeedback||typeof navigator.vibrate==='function';

/** Same finite graph is used for real playback and an OfflineAudioContext proof. */
export function scheduleSensorySignal(ctx,destination,kind='tap',options={}){
 const name=Object.hasOwn(cues,kind)?kind:'tap',[from,to,duration]=cues[name],at=Math.max(ctx.currentTime,Number(options.at)||ctx.currentTime)+.003,nodes=[],sources=[];
 const own=node=>(nodes.push(node),node),carrier=own(ctx.createOscillator()),modulator=own(ctx.createOscillator()),depth=own(ctx.createGain()),envelope=own(ctx.createGain()),master=own(ctx.createGain()),delay=own(ctx.createDelay(.1)),echo=own(ctx.createGain()),filter=own(ctx.createBiquadFilter());
 sources.push(carrier,modulator);carrier.type='sine';modulator.type='sine';carrier.frequency.setValueAtTime(from,at);carrier.frequency.exponentialRampToValueAtTime(to,at+duration*.85);modulator.frequency.setValueAtTime(from*2,at);depth.gain.setValueAtTime(name==='error'?12:36,at);depth.gain.exponentialRampToValueAtTime(.01,at+duration);modulator.connect(depth);depth.connect(carrier.frequency);
 envelope.gain.setValueAtTime(.00001,at);envelope.gain.linearRampToValueAtTime(.13,at+.006);
 if(name==='error'||name==='listen'){envelope.gain.exponentialRampToValueAtTime(.0005,at+duration*.4);envelope.gain.linearRampToValueAtTime(.095,at+duration*.53);}
 envelope.gain.exponentialRampToValueAtTime(.00001,at+duration);const gain=Number(options.gain);master.gain.value=Number.isFinite(gain)?Math.max(0,Math.min(.3,gain)):.26;
 filter.type='lowpass';filter.frequency.value=2100;filter.Q.value=.5;delay.delayTime.value=.065;echo.gain.value=.12;
 carrier.connect(envelope);envelope.connect(master);envelope.connect(delay);delay.connect(filter);filter.connect(echo);echo.connect(master);master.connect(destination);
 for(const source of sources){source.start(at);source.stop(at+duration+.004);}
 let stopped=false;
 return {kind:name,duration,tailDuration:.08,at,sources,nodes,stop(){if(stopped)return;stopped=true;for(const source of sources)safe(()=>source.stop());for(const node of nodes)safe(()=>node.disconnect());}};
}
function release(voice){clearTimeout(voice.timer);voice.stop();voices.delete(voice);if(!voices.size){clearTimeout(idle);idle=setTimeout(()=>closeContext(),900);}}
function closeContext(){clearTimeout(idle);idle=null;generation++;for(const voice of [...voices]){clearTimeout(voice.timer);voice.stop();}voices.clear();const current=context;context=null;if(current&&current.state!=='closed')safe(()=>current.close().catch(()=>{}));}
function cancelHaptic(){if(vibrating){safe(()=>navigator.vibrate?.(0));vibrating=false;}}
function allowed(host){return !document.hidden&&focus!=='recording'&&(!host||host.isConnected);}
function audible(kind,host){
 if(!unlocked||!enabled('sound')||!allowed(host))return false;
 const clock=now();if(clock-lastAt<60||kind===lastKind&&clock-lastAt<95)return false;
 const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return false;
 if(!context||context.state==='closed'){try{context=new Audio({latencyHint:'interactive'});}catch{return false}}
 const ctx=context,token=generation,deadline=clock+160;
 const start=()=>{if(ctx!==context||token!==generation||ctx.state!=='running'||!enabled('sound')||!allowed(host)||now()>deadline)return false;clearTimeout(idle);while(voices.size>=2)release(voices.values().next().value);let voice;try{voice=scheduleSensorySignal(ctx,ctx.destination,kind,{gain:focus==='voice'?.057:focus==='media'?.031:.26})}catch{closeContext();return false;}voice.host=host;voices.add(voice);voice.timer=setTimeout(()=>release(voice),(voice.duration+voice.tailDuration+.04)*1000);lastAt=now();lastKind=kind;planned++;document.dispatchEvent(new CustomEvent('flow:soundevent',{detail:{kind:voice.kind,duration:voice.duration,tailDuration:voice.tailDuration,at:voice.at,source:'flow-ui-shared'}}));return true;};
 if(ctx.state==='running')return start();
 // Resume is requested inside the trusted gesture. Late/denied resumes never queue a cue.
 safe(()=>ctx.resume().then(start).catch(()=>{if(context===ctx)closeContext()}));clearTimeout(idle);idle=setTimeout(()=>{if(context===ctx&&!voices.size)closeContext()},200);return false;
}
function haptic(kind){
 if(!enabled('haptics')||!unlocked||!allowed()||lastGesture!=='touch'||['close','reply'].includes(kind))return false;
 if(now()-lastHapticAt<75)return false;lastHapticAt=now();
 const telegram=window.Telegram?.WebApp?.HapticFeedback;
 if(telegram){try{hapticAttempts++;if(kind==='success'||kind==='error')telegram.notificationOccurred(kind);else telegram.impactOccurred('light');return true}catch{return false}}
 if(typeof navigator.vibrate!=='function')return false;
 try{hapticAttempts++;vibrating=navigator.vibrate(kind==='success'?[7,24,9]:kind==='error'?[10,24,7]:6)===true;return vibrating}catch{return false}
}
const editable=path=>path.some(node=>node?.isContentEditable||node?.matches?.('input,textarea,select,[role=textbox],[contenteditable]:not([contenteditable=false])'));
const blocked=path=>path.some(node=>node instanceof Element&&(node.disabled||node.getAttribute('aria-disabled')==='true'));
export function sensoryGesture(host,target,event){
 if(!event?.isTrusted||(event.type!=='pointerdown'&&event.type!=='keydown')||!host?.isConnected||!target?.isConnected||document.hidden)return false;
 const path=event.composedPath();if(blocked(path)||editable(path)||!path.some(node=>node?.matches?.('button,a[href],[role=button],[role=tab],[role=switch],[role=checkbox],[role=option]')))return false;
 if(event.type==='keydown'&&(!['Enter',' '].includes(event.key)||event.repeat||event.isComposing))return false;
 if(event.type==='pointerdown'&&(event.button!==0||event.isPrimary===false))return false;
 if(!target.getClientRects().length)return false;
 unlocked=true;gestureAt=now();lastGesture=event.type==='pointerdown'&&['touch','pen'].includes(event.pointerType)?'touch':'keyboard';
 // The press cue means contact only. Success/error are supplied by a real owner ACK.
 const sound=audible('tap',host);const touch=haptic('tap');return sound||touch;
}
/** Owner hook: call only for a real, current result; never for background mock progress. */
export function sensorySignal(kind='tap',{host=null}={}){if(!Object.hasOwn(cues,kind)||!host?.isConnected||!host.getClientRects().length||!allowed(host)||!unlocked||now()-gestureAt>15000)return false;const sound=audible(kind,host),touch=haptic(kind);return sound||touch;}
export function stopSensory(host){queueMicrotask(()=>{if(host?.isConnected&&!document.hidden)return;for(const voice of [...voices])if(!host||voice.host===host)release(voice);if(!voices.size)closeContext();});}
export function setSensoryFocus(value='none'){focus=['recording','voice','media'].includes(value)?value:'none';if(focus!=='none'){closeContext();cancelHaptic();}return focus;}
export function sensoryState(){return {context:context?.state||'off',activeVoices:voices.size,activeSources:[...voices].reduce((sum,voice)=>sum+voice.sources.length,0),maxVoices:2,maxSources:4,planned,hapticAttempts,hapticsAvailable:availableHaptic(),sound:enabled('sound'),haptics:enabled('haptics'),unlocked,focus};}
function preferences(){if(!enabled('sound'))closeContext();if(!enabled('haptics'))cancelHaptic();}
new MutationObserver(preferences).observe(document.documentElement,{attributes:true,attributeFilter:['data-sound','data-haptics']});
document.addEventListener('flow-preferences-change',preferences);
// Typing must never inherit vibration eligibility from an earlier screen tap.
document.addEventListener('keydown',event=>{if(event.isTrusted)lastGesture='keyboard';},true);
document.addEventListener('visibilitychange',()=>{if(document.hidden){closeContext();cancelHaptic();}});
window.addEventListener('pagehide',()=>{closeContext();cancelHaptic();});
document.addEventListener('flow:voice',event=>{const state=event.detail?.state||event.detail?.status||'';if(['requesting','listening','recording','transcribing'].includes(state))setSensoryFocus('recording');else if(['idle','closed','stopped','error','done','cancelled'].includes(state))setSensoryFocus('none');});
