(() => {
  'use strict';
  if (document.documentElement.dataset.flowDesign === 'classic') return;
  const MAX_VOICES = 8;
  const defaults = Object.freeze({ wet: .28, echo: .36, tone: .62, volume: .55 });
  const params = { ...defaults };
  const notes = { D3:146.8324, A3:220, D4:293.6648, Fs4:369.9944, A4:440, E5:659.2551, D5:587.3295, Fs5:739.9888, A5:880, D6:1174.659, E6:1318.51 };
  const lengths = { tap:.10, open:.43, close:.27, listen:.26, stop:.19, send:.30, reply:.47, success:.49, error:.38 };
  const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
  const safe = fn => { try { return fn(); } catch { return undefined; } };
  const now = () => performance.now();
  let enabled = true, suspended = false, disposed = false, gestureSeen = false, ambientWanted = false;
  let context = null, graph = null, focus = 'none', lastCue = '', lastCueAt = -Infinity, lastTapAt = -Infinity, lastError = '', serial = 0;
  let planned = 0, focusOwner = '';
  const activated = () => gestureSeen || navigator.userActivation?.hasBeenActive === true;
  function rememberGesture(event) { if(event.isTrusted) gestureSeen = true; }
  document.addEventListener('pointerdown',rememberGesture,{capture:true,passive:true});
  document.addEventListener('touchstart',rememberGesture,{capture:true,passive:true});
  document.addEventListener('keydown',rememberGesture,true);

  function seededNoise(context,seconds,seed,stereo=false) {
    const buffer=context.createBuffer(stereo?2:1,Math.ceil(context.sampleRate*seconds),context.sampleRate);
    for(let channel=0;channel<buffer.numberOfChannels;channel++) {
      const data=buffer.getChannelData(channel); let state=(seed+channel*7919)>>>0,previous=0;
      for(let i=0;i<data.length;i++) {
        state=(Math.imul(state,1664525)+1013904223)>>>0;
        const random=state/2147483648-1;
        if(stereo) {
          const t=i/context.sampleRate,decay=Math.exp(-t*9.5),early=i<context.sampleRate*.022?0:1;
          previous=previous*.52+random*.48;
          data[i]=(random*.24+previous*.76)*decay*early*.54;
        } else data[i]=random;
      }
      if(stereo) for(const [time,value] of [[.029,.16],[.051,.10],[.083,.06],[.121,.025]]) {
        const index=Math.floor((time+channel*.003)*context.sampleRate); if(index<data.length)data[index]+=value;
      }
    }
    return buffer;
  }
  function makeGraph(ctx,settings,{offline=false}={}) {
    const nodes=[],voices=new Set(),ambient=new Set();
    const own=node => {nodes.push(node);return node;};
    const sourceBus=own(ctx.createGain()),dry=own(ctx.createGain()),roomSend=own(ctx.createGain()),echoSend=own(ctx.createGain());
    const lowpass=own(ctx.createBiquadFilter()); lowpass.type='lowpass'; lowpass.Q.value=.55;
    const master=own(ctx.createGain()),duck=own(ctx.createGain()),limiter=own(ctx.createDynamicsCompressor());
    limiter.threshold.value=-12;limiter.knee.value=8;limiter.ratio.value=8;limiter.attack.value=.0015;limiter.release.value=.13;
    sourceBus.connect(lowpass);lowpass.connect(dry);dry.connect(duck);duck.connect(master);master.connect(limiter);limiter.connect(ctx.destination);
    dry.gain.value=.88;
    const pre=own(ctx.createDelay(.05));pre.delayTime.value=.014;
    const convolver=own(ctx.createConvolver());convolver.normalize=false;convolver.buffer=seededNoise(ctx,.74,0x51a7,true);
    const roomHigh=own(ctx.createBiquadFilter()),roomLow=own(ctx.createBiquadFilter()),roomReturn=own(ctx.createGain());
    roomHigh.type='highpass';roomHigh.frequency.value=310;roomLow.type='lowpass';roomLow.frequency.value=4600;
    lowpass.connect(roomSend);roomSend.connect(pre);pre.connect(convolver);convolver.connect(roomHigh);roomHigh.connect(roomLow);roomLow.connect(roomReturn);roomReturn.connect(duck);roomReturn.gain.value=.36;
    lowpass.connect(echoSend);
    const echoes=[];
    for(const [time,level,pan] of [[.082,.24,-.65],[.164,.145,.65],[.246,.075,-.42],[.328,.035,.42]]) {
      const delay=own(ctx.createDelay(.4)),gain=own(ctx.createGain()),filter=own(ctx.createBiquadFilter());
      delay.delayTime.value=time;gain.gain.value=level;filter.type='lowpass';filter.frequency.value=3900-time*4000;filter.Q.value=.5;
      echoSend.connect(delay);delay.connect(filter);filter.connect(gain);
      if(ctx.createStereoPanner){const panner=own(ctx.createStereoPanner());panner.pan.value=pan;gain.connect(panner);panner.connect(duck);}else gain.connect(duck);
      echoes.push({delay,gain,filter});
    }
    const engine={ctx,nodes,voices,ambient,sourceBus,master,duck,lowpass,roomSend,echoSend,convolver,echoes,offline,settings:{...settings},destroyed:false,noise:seededNoise(ctx,.15,0x7a11)};
    applyParams(engine,settings,true);
    return engine;
  }
  function ramp(parameter,value,ctx,instant=false) {
    parameter.cancelScheduledValues(ctx.currentTime);
    if(instant)parameter.setValueAtTime(value,ctx.currentTime);
    else {parameter.setValueAtTime(parameter.value,ctx.currentTime);parameter.linearRampToValueAtTime(value,ctx.currentTime+.035);}
  }
  function focusGain() {return focus==='recording'?0:focus==='voice'?.22:focus==='media'?.12:1;}
  function applyParams(engine,settings,instant=false) {
    if(!engine||engine.destroyed)return;
    Object.assign(engine.settings,settings);
    ramp(engine.master.gain,engine.settings.volume,engine.ctx,instant);
    ramp(engine.roomSend.gain,engine.settings.wet,engine.ctx,instant);
    ramp(engine.echoSend.gain,engine.settings.echo,engine.ctx,instant);
    ramp(engine.lowpass.frequency,1900+engine.settings.tone*6100,engine.ctx,instant);
    ramp(engine.duck.gain,engine.offline?1:focusGain(),engine.ctx,instant);
  }
  function stopVoice(engine,record,stop=true) {
    if(record.cleaned)return;record.cleaned=true;clearTimeout(record.timer);
    for(const source of record.sources){source.onended=null;if(stop)safe(()=>source.stop());}
    for(const node of record.nodes)safe(()=>node.disconnect());
    engine.voices.delete(record);engine.ambient.delete(record);
  }
  function stopAmbient(engine=graph) {if(engine)for(const record of [...engine.ambient])stopVoice(engine,record);}
  function destroyGraph() {
    const owned=graph;graph=null;if(!owned)return;
    owned.destroyed=true;for(const record of [...owned.voices])stopVoice(owned,record);
    for(const node of owned.nodes)safe(()=>node.disconnect());
    owned.convolver.buffer=null;
  }
  function reserve(engine,at,end) {
    const overlaps=()=>[...engine.voices].filter(record=>!engine.offline||(record.start<end&&record.end>at));
    while(overlaps().length>=MAX_VOICES) {
      const active=overlaps(),oldest=active.find(record=>!record.ambient)||active[0];
      if(!oldest)break;stopVoice(engine,oldest);
    }
  }
  function makeVoice(engine,at,{frequency=notes.D5,endFrequency=0,duration=.15,attack=.003,gain=.05,ratio=2.001,depth=.65,pan=0,noise=false,type='sine',ambient=false}={}) {
    if(engine.destroyed)return;
    const ctx=engine.ctx,end=at+duration+.015;reserve(engine,at,end);
    const envelope=ctx.createGain(),filter=ctx.createBiquadFilter(),sources=[],nodes=[envelope,filter];
    filter.type='lowpass';filter.frequency.value=ambient?380:6500;filter.Q.value=.5;
    let carrier;
    if(noise){carrier=ctx.createBufferSource();carrier.buffer=engine.noise;carrier.playbackRate.value=1.15;}
    else {carrier=ctx.createOscillator();carrier.type=type;carrier.frequency.setValueAtTime(frequency,at);if(endFrequency)carrier.frequency.exponentialRampToValueAtTime(endFrequency,at+duration);}
    sources.push(carrier);nodes.push(carrier);carrier.connect(envelope);
    if(!noise&&depth>0) {
      const modulator=ctx.createOscillator(),modulation=ctx.createGain();
      modulator.type='sine';modulator.frequency.setValueAtTime(frequency*ratio,at);
      if(endFrequency)modulator.frequency.exponentialRampToValueAtTime(endFrequency*ratio,at+duration);
      modulation.gain.setValueAtTime(frequency*depth,at);modulation.gain.exponentialRampToValueAtTime(.01,at+duration*.82);
      modulator.connect(modulation);modulation.connect(carrier.frequency);sources.push(modulator);nodes.push(modulator,modulation);
    }
    envelope.gain.setValueAtTime(0,at);envelope.gain.linearRampToValueAtTime(gain,at+attack);
    if(ambient)envelope.gain.setValueAtTime(gain,at+duration);
    else {envelope.gain.exponentialRampToValueAtTime(.000015,at+duration);envelope.gain.linearRampToValueAtTime(0,end);}
    envelope.connect(filter);
    let tail=filter;
    if(ctx.createStereoPanner){const panner=ctx.createStereoPanner();panner.pan.value=pan;filter.connect(panner);tail=panner;nodes.push(panner);}
    tail.connect(ambient?engine.duck:engine.sourceBus);
    const record={id:++serial,sources,nodes,start:at,end,ambient,cleaned:false,timer:0};engine.voices.add(record);if(ambient)engine.ambient.add(record);
    for(const source of sources){source.start(at);if(!ambient)source.stop(end);}
    if(!engine.offline&&!ambient){carrier.onended=()=>stopVoice(engine,record,false);record.timer=setTimeout(()=>stopVoice(engine,record),Math.max(0,end-ctx.currentTime)*1000+180);}
    return record;
  }
  function scheduleCue(engine,kind,at) {
    const bell=(frequency,duration,gain,extra={})=>makeVoice(engine,at+(extra.delay||0),{frequency,duration,gain,...extra});
    const spark=(delay=0,pan=.4)=>makeVoice(engine,at+delay,{noise:true,duration:.035,attack:.001,gain:.007,pan});
    switch(kind) {
      case 'open':
        bell(notes.D4,.31,.052,{endFrequency:notes.D5,ratio:2.004,depth:1.4,pan:-.24,attack:.012});
        bell(notes.A5,.23,.023,{delay:.055,ratio:1.997,depth:.7,pan:.27,attack:.008});
        bell(notes.E6,.16,.009,{delay:.14,depth:.35,pan:-.1});spark(.055,.55);break;
      case 'close':
        bell(notes.A5,.18,.036,{endFrequency:notes.D4,ratio:2.01,depth:1.1,pan:.25});
        bell(notes.D3,.18,.028,{delay:.06,depth:.35,pan:-.2});spark(.03,-.4);break;
      case 'listen':
        bell(notes.D5,.10,.043,{depth:.42,pan:-.3});bell(notes.A5,.17,.035,{delay:.075,depth:.58,pan:.3});spark(.08,.5);break;
      case 'stop':
        bell(notes.A4,.12,.042,{endFrequency:notes.D4,ratio:1.5,depth:.7,pan:.15});bell(notes.D3,.10,.019,{delay:.065,depth:.22,pan:-.2});break;
      case 'send':
        bell(notes.D5,.18,.045,{endFrequency:notes.E6,ratio:2.005,depth:1.6,pan:-.32});
        bell(notes.A5,.14,.024,{delay:.11,depth:.48,pan:.35});spark(.14,.55);break;
      case 'reply':
        bell(notes.D5,.30,.041,{ratio:2.003,depth:.55,pan:-.2,attack:.012});
        bell(notes.Fs5,.31,.028,{delay:.045,ratio:1.998,depth:.45,pan:.17,attack:.01});
        bell(notes.A5,.30,.018,{delay:.10,depth:.35,pan:.4,attack:.01});spark(.18,-.4);break;
      case 'success':
        bell(notes.D5,.21,.039,{depth:.55,pan:-.25});bell(notes.A5,.23,.031,{delay:.075,depth:.65,pan:.25});
        bell(notes.E6,.22,.018,{delay:.17,depth:.4,pan:-.05});spark(.20,.55);break;
      case 'error':
        bell(notes.A3,.17,.047,{endFrequency:notes.D3,ratio:1.42,depth:.65,pan:-.13,attack:.008});
        bell(notes.D4,.18,.028,{delay:.15,endFrequency:notes.D3,ratio:1.5,depth:.4,pan:.13,attack:.012});break;
      default:
        bell(notes.D5,.075,.047,{endFrequency:notes.A4,ratio:3.999,depth:.5,pan:-.08,attack:.0015});spark(.009,.32);
    }
  }
  function ensureContext() {
    if(!enabled||suspended||disposed||document.hidden||!activated()||focus==='recording')return null;
    if(context?.state==='closed')context=null;
    if(!context) {
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio){lastError='Web Audio unavailable';return null;}
      try{context=new Audio({latencyHint:'interactive'});}catch(error){lastError=error.name||'audio-init';return null;}
    }
    if(!graph)graph=makeGraph(context,params);
    if(context.state==='suspended')safe(()=>context.resume().catch(error=>lastError=error.name||'audio-resume'));
    return context;
  }
  function startAmbient() {
    if(!ambientWanted||focus!=='none'||!ensureContext()||graph.ambient.size)return;
    for(const [frequency,gain,pan] of [[73.416,.0038,-.5],[110,.0028,.5]])makeVoice(graph,context.currentTime+.01,{frequency,gain,pan,duration:60,attack:.8,depth:0,ambient:true});
  }
  function feedback(kind='tap') {
    if(!enabled||suspended||disposed||document.hidden||!activated()||focus==='recording')return false;
    const name=Object.hasOwn(lengths,kind)?kind:'tap',clock=now();
    if(name==='tap'&&clock-lastTapAt<75||name===lastCue&&clock-lastCueAt<55)return false;
    if(!ensureContext())return false;
    if(name==='tap')lastTapAt=clock;lastCue=name;lastCueAt=clock;lastError='';
    startAmbient();scheduleCue(graph,name,context.currentTime+.006);planned++;
    document.dispatchEvent(new CustomEvent('flow:soundevent',{detail:{kind:name,duration:lengths[name],tailDuration:.74,at:context.currentTime+.006,source:'atlas-sound-lab'}}));
    return true;
  }
  function setEnabled(value) {
    enabled=Boolean(value);
    if(!enabled)destroyGraph();
    else if(ambientWanted)startAmbient();
  }
  function setAmbient(value){ambientWanted=Boolean(value);if(ambientWanted)startAmbient();else stopAmbient();}
  function setParams(values={}) {
    for(const key of Object.keys(defaults))if(Number.isFinite(Number(values[key])))params[key]=clamp(Number(values[key]),0,key==='volume'?.85:1);
    if(graph)applyParams(graph,params);
    return {...params};
  }
  function setFocus(value='none',owner='manual') {
    focus=['none','recording','voice','media'].includes(value)?value:'none';focusOwner=focus==='none'?'':String(owner).slice(0,80);
    if(focus==='recording')destroyGraph();
    else {if(focus!=='none')stopAmbient();if(graph)applyParams(graph,params);if(focus==='none'&&ambientWanted)startAmbient();}
    return focus;
  }
  function suspend(){suspended=true;destroyGraph();if(context?.state==='running')safe(()=>context.suspend().catch(()=>{}));}
  function resume(){suspended=false;if(!enabled||disposed||document.hidden||!activated())return;if(ambientWanted)startAmbient();}
  function dispose(){disposed=true;destroyGraph();const owned=context;context=null;if(owned&&owned.state!=='closed')safe(()=>owned.close().catch(()=>{}));}
  function getState() {
    return {brand:'Digital Magic',version:'product-7',context:context?.state||'off',audioState:context?.state||'off',enabled,suspended,disposed,gestureAllowed:activated(),
      activeVoices:graph?.voices.size||0,maxVoices:MAX_VOICES,activeSources:graph?[...graph.voices].reduce((n,record)=>n+record.sources.length,0):0,maxSources:MAX_VOICES*2,
      ambient:ambientWanted,ambientVoices:graph?.ambient.size||0,ambientOscillators:graph?.ambient.size||0,lastCue,lastError,plannedCues:planned,focus,focusOwner,
      params:{...params},graphReady:Boolean(graph),reverb:graph?{connected:true,seconds:.74,send:graph.roomSend.gain.value}: {connected:false,seconds:.74,send:0},
      echo:graph?{connected:true,taps:graph.echoes.length,send:graph.echoSend.gain.value}:{connected:false,taps:0,send:0},
      masterGain:graph?.master.gain.value||0,duckGain:graph?.duck.gain.value||0,filterHz:graph?.lowpass.frequency.value||0};
  }
  async function renderPreview(options={}) {
    const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Offline)throw Error('Offline Audio unavailable');
    const sampleRate=clamp(Number(options.sampleRate)||44100,22050,48000),gap=clamp(Number(options.gap)||1.35,1.2,2),names=Object.keys(lengths),duration=(names.length-1)*gap+1.5;
    const offline=new Offline(2,Math.ceil(sampleRate*duration),sampleRate),settings={...params},engine=makeGraph(offline,settings,{offline:true});
    const cues=names.map((kind,index)=>({kind,at:.05+index*gap,duration:lengths[kind]}));
    for(const cue of cues)scheduleCue(engine,cue.kind,cue.at);
    const buffer=await offline.startRendering();for(const record of [...engine.voices])stopVoice(engine,record,false);for(const node of engine.nodes)safe(()=>node.disconnect());
    return {buffer,cues,params:settings,duration};
  }
  window.flowSound?.dispose?.();
  window.flowSound={feedback,setEnabled,setAmbient,suspend,resume,dispose,getState,setParams,getParams:()=>({...params}),setFocus,renderPreview};
  document.addEventListener('flow:voice',event=>{
    const state=event.detail?.state;
    if(['requesting','recording','listening','transcribing'].includes(state))setFocus('recording','flow:voice');
    else if(['idle','error','cancelled'].includes(state)&&focusOwner==='flow:voice')setFocus('none','flow:voice');
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)suspend();else resume();});
  window.addEventListener('pagehide',dispose);
  window.addEventListener('pageshow',()=>{disposed=false;resume();});
})();
