const gcd=(a,b)=>b?gcd(b,a%b):a;
function i0(x){let sum=1,term=1;for(let k=1;k<40;k++){term*=x*x/(4*k*k);sum+=term;if(term<sum*1e-16)break;}return sum;}
/** Streaming equivalent of resample_poly's default Kaiser5 FIR. Output is
 * aligned like its offline counterpart, but waits for the FIR's lookahead
 * (.625ms when downsampling to16kHz;1.25ms for8kHz input).
 * It never reads samples which have not arrived. */
export class MicResampler{
 constructor(sampleRate){
  if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw new RangeError('Unsupported microphone sample rate.');
  const divisor=gcd(sampleRate,16000);this.up=16000/divisor;this.down=sampleRate/divisor;
  if(Math.max(this.up,this.down)>1024)throw new RangeError('Unsupported microphone rate ratio.');
  this.identity=sampleRate===16000;this.half=this.identity?0:10*Math.max(this.up,this.down);
  const length=this.identity?1:this.half*2+1,cutoff=1/Math.max(this.up,this.down),denominator=i0(5);
  this.filter=new Float64Array(length);let scale=0;
  for(let j=0;j<length;j++){const d=j-this.half,x=cutoff*d;
   const h=this.identity?1:cutoff*(x===0?1:Math.sin(Math.PI*x)/(Math.PI*x))*i0(5*Math.sqrt(Math.max(0,1-(d/this.half)**2)))/denominator;
   this.filter[j]=h;scale+=h;
  }
  for(let j=0;j<length;j++)this.filter[j]*=this.up/scale;
  this.buffer=new Float32Array(2048);this.received=0;this.outputIndex=0;
 }
 push(samples){
  const result=[];
  for(const sample of samples){
   if(!Number.isFinite(sample))throw new TypeError('Non-finite microphone PCM.');
   const last=this.received++;this.buffer[last%this.buffer.length]=sample;
   while(Math.floor((this.outputIndex*this.down+this.half)/this.up)<=last){
    const center=this.outputIndex*this.down+this.half,lastNeeded=Math.floor(center/this.up),first=Math.ceil((center-this.filter.length+1)/this.up);let value=0;
    for(let n=Math.max(0,first);n<=lastNeeded;n++)value+=this.filter[center-n*this.up]*this.buffer[n%this.buffer.length];
    result.push(value);this.outputIndex++;
   }
  }
  return Float32Array.from(result);
 }
}
