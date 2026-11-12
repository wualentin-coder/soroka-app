// No inference, resampling or output monitoring in the render thread.
class FlowMicCapture extends AudioWorkletProcessor {
  constructor(){
    super();this.capturePort=null;this.samples=new Float32Array(512);this.used=0;
    this.port.onmessage=({data})=>{
      if(data?.type==='connect'&&data.port){this.capturePort?.close();this.capturePort=data.port;this.used=0;}
      else if(data?.type==='stop'){this.capturePort?.close();this.capturePort=null;this.used=0;}
    };
  }
  process(inputs,outputs){
    for(const output of outputs)for(const channel of output)channel.fill(0);
    const channels=inputs[0];
    if(!this.capturePort||!channels?.length||!channels[0]?.length)return true;
    for(let index=0;index<channels[0].length;index++){
      let mono=0;for(const channel of channels)mono+=channel[index]||0;
      this.samples[this.used++]=mono/channels.length;
      if(this.used===512){
        const samples=this.samples;this.samples=new Float32Array(512);this.used=0;
        this.capturePort.postMessage({type:'audio',samples,sampleRate,audioEndTime:(currentFrame+index+1)/sampleRate},[samples.buffer]);
      }
    }
    return true;
  }
}
registerProcessor('flow-mic-capture',FlowMicCapture);
