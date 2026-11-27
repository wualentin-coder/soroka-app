const aborted=()=>{const error=new Error('Microphone capture start was cancelled.');error.name='AbortError';return error;};
/** Owns only the capture graph and worker, never the supplied context or source. */
export function createMicStream({context,source,assetURL,onEvidence=()=>{},onError=()=>{},dependencies={}}={}){
  const WorkerClass=dependencies.Worker??globalThis.Worker,NodeClass=dependencies.AudioWorkletNode??globalThis.AudioWorkletNode,
    ChannelClass=dependencies.MessageChannel??globalThis.MessageChannel,
    setTimer=dependencies.setTimeout??globalThis.setTimeout,clearTimer=dependencies.clearTimeout??globalThis.clearTimeout;
  let state='idle',startPromise=null,worker=null,node=null,gain=null,channel=null,timeout=null,cancelStart=null,errorReported=false,sourceConnected=false;
  const active=()=>state==='starting'||state==='running';
  const clean=()=>{
    if(timeout!==null){clearTimer(timeout);timeout=null;}
    if(sourceConnected){try{source.disconnect(node);}catch{}sourceConnected=false;}
    if(node){try{node.port.postMessage({type:'stop'});}catch{}try{node.disconnect();}catch{}try{node.port.close();}catch{}node.onprocessorerror=null;}
    if(gain)try{gain.disconnect();}catch{}
    if(channel)for(const port of [channel.port1,channel.port2])try{port.close();}catch{}
    if(worker){worker.onmessage=null;worker.onerror=null;worker.onmessageerror=null;try{worker.terminate();}catch{}}
  };
  const fail=error=>{
    if(!active())return;
    state='failed';clean();cancelStart?.(error);
    if(!errorReported){errorReported=true;try{onError(error);}catch{}}
  };
  function stop(){
    if(state==='stopped'||state==='failed')return;
    state='stopped';clean();cancelStart?.(aborted());
  }
  function start(){
    if(state==='stopped'||state==='failed')return Promise.reject(aborted());
    if(startPromise)return startPromise;
    state='starting';
    startPromise=(async()=>{
      try{
        if(!context?.audioWorklet||typeof context.audioWorklet.addModule!=='function'||typeof NodeClass!=='function')throw new Error('AudioWorklet is unavailable for microphone capture.');
        if(typeof WorkerClass!=='function'||typeof ChannelClass!=='function')throw new Error('Module worker and MessageChannel are required for microphone capture.');
        if(typeof source?.connect!=='function'||typeof source?.disconnect!=='function'||typeof assetURL!=='function'||!Number.isFinite(context.sampleRate)||context.sampleRate<=0)throw new TypeError('Microphone capture needs an audio source, sample rate and asset resolver.');
        let ready;
        const readyPromise=new Promise(resolve=>{ready=resolve;});
        const cancelled=new Promise((resolve,reject)=>{cancelStart=reject;});
        // A constructor or addModule can throw before the race is installed.
        cancelled.catch(()=>{});
        worker=new WorkerClass(assetURL('mic-analysis-worker.mjs'),{type:'module'});
        worker.onmessage=({data})=>{
          if(!active())return;
          if(data?.type==='ready'){ready();return;}
          if(data?.type==='error'){fail(new Error(data.message||'Microphone analysis worker failed.'));return;}
          if(state==='running')try{onEvidence(data);}catch(error){fail(error);}
        };
        worker.onerror=event=>{event.preventDefault?.();fail(new Error(event.message||'Microphone analysis worker failed.'));};
        worker.onmessageerror=()=>fail(new Error('Microphone analysis worker message could not be decoded.'));
        timeout=setTimer(()=>fail(new Error('Microphone analysis worker readiness timed out.')),10000);
        const modules=context.audioWorklet.addModule(assetURL('mic-capture-worklet.mjs'));
        worker.postMessage({type:'init',assetBase:assetURL('./')});
        await Promise.race([Promise.all([readyPromise,modules]),cancelled]);
        if(!active())throw aborted();
        clearTimer(timeout);timeout=null;
        channel=new ChannelClass();
        node=new NodeClass(context,'flow-mic-capture',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1],channelCount:1,channelCountMode:'explicit'});
        node.onprocessorerror=()=>fail(new Error('Microphone capture worklet failed.'));
        gain=context.createGain();gain.gain.value=0;
        worker.postMessage({type:'connect',port:channel.port2,sampleRate:context.sampleRate},[channel.port2]);
        node.port.postMessage({type:'connect',port:channel.port1},[channel.port1]);
        node.connect(gain);gain.connect(context.destination);source.connect(node);sourceConnected=true;
        if(!active())throw aborted();
        state='running';
      }catch(error){
        if(active())fail(error);
        else clean();
        throw error;
      }
    })();
    return startPromise;
  }
  return {start,stop,configure:values=>{if(active())worker?.postMessage({type:'configure',...values});},get running(){return state==='running';}};
}
