import {MicResampler} from './mic-resampler.mjs?v=bc0d6f000e4b';
import {MicDetector} from './mic-detector.mjs?v=bc0d6f000e4b';
let ort,session,port,queue=Promise.resolve(),pending=0,failed=false,settings={minRms:.001,polyphonic:false};
let rate,detector,resampler,ring,total=0,nextPitch=0,lastPolyAt=-Infinity,origin=null,expectedEnd=null,modelInput=new Float32Array(512),modelLength=0,context=new Float32Array(64),modelState;
const fail=error=>{if(!failed){failed=true;port?.close();self.postMessage({type:'error',message:String(error?.message||error)});}};
const tail=size=>{const out=new Float32Array(size);for(let i=0;i<size;i++)out[i]=ring[(total-size+i+ring.length)%ring.length];return out;};
async function infer(at){
 const input=new Float32Array(576);input.set(context);input.set(modelInput,64);
 const inputTensor=new ort.Tensor('float32',input,[1,576]),sr=new ort.Tensor('int64',BigInt64Array.from([16000n]),[]);
 const result=await session.run({input:inputTensor,state:modelState,sr});
 modelState.dispose();modelState=result.stateN;context=input.slice(-64);modelLength=0;
 detector.updateSpeech(result.output.data[0],at);result.output.dispose();inputTensor.dispose();sr.dispose();
}
async function audio(data){
 if(failed)return;
 const samples=data.samples;if(!(samples instanceof Float32Array)||samples.length!==512||data.sampleRate!==rate||!Number.isFinite(data.audioEndTime))throw Error('Invalid microphone capture block.');
 const begin=data.audioEndTime-samples.length/rate;
 if(expectedEnd!==null&&Math.abs(begin-expectedEnd)>2/rate)throw Error('Microphone capture lost continuity.');
 expectedEnd=data.audioEndTime;origin??=begin;
 const windowSize=Math.round(4096*rate/48000),hop=rate*.016;
 // Small segments retain causal VAD/analysis ordering. At48k the768-sample
 // analysis hop aligns exactly; other rates add at most64/sourceRate seconds.
 for(let offset=0;offset<samples.length;offset+=64){
  const block=samples.subarray(offset,offset+64);
  for(const x of block){if(!Number.isFinite(x))throw Error('Non-finite microphone PCM.');ring[total%ring.length]=x;total++;}
  const at=(origin+total/rate)*1000,resampled=resampler.push(block);
  for(const x of resampled){modelInput[modelLength++]=x;if(modelLength===512)await infer(at);}
  if(total<nextPitch)continue;
  nextPitch+=hop;
  detector.minRms=settings.minRms;detector.gate.options.minRms=settings.minRms;
  const result=detector.frame(tail(windowSize),at),evidence={type:'evidence',...result,captureAt:at/1000};
  if(settings.polyphonic&&total>=ring.length&&at-lastPolyAt>=95){lastPolyAt=at;evidence.polySamples=tail(ring.length);self.postMessage(evidence,[evidence.polySamples.buffer]);}
  else self.postMessage(evidence);
 }
}
self.onmessage=async({data})=>{try{
 if(data?.type==='init'){
  const base=new URL(data.assetBase,self.location.href);ort=await import(new URL('vendor/ort-1.24.3/ort.wasm.min.mjs',base));
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.wasm.wasmPaths=new URL('vendor/ort-1.24.3/',base).href;
  session=await ort.InferenceSession.create(new URL('models/silero-v6.2.1.onnx',base).href,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  self.postMessage({type:'ready'});
 }else if(data?.type==='configure'){
  if(Number.isFinite(data.minRms)&&data.minRms>=.0001&&data.minRms<=.1)settings.minRms=data.minRms;
  if(typeof data.polyphonic==='boolean')settings.polyphonic=data.polyphonic;
 }else if(data?.type==='connect'&&session&&!port){
  rate=data.sampleRate;resampler=new MicResampler(rate);detector=new MicDetector({sampleRate:rate});ring=new Float32Array(16384);nextPitch=Math.round(4096*rate/48000);
  modelState=new ort.Tensor('float32',new Float32Array(256),[2,1,128]);port=data.port;
  port.onmessage=({data})=>{if(failed)return;if(++pending>8){fail(Error('Microphone analysis fell behind.'));return;}
   queue=queue.then(()=>audio(data)).catch(fail).finally(()=>pending--);
  };port.onmessageerror=()=>fail(Error('Microphone capture data was lost.'));port.start();
 }
}catch(error){fail(error);}};
