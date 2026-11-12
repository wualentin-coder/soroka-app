import {detectPitch} from './pitch.mjs?v=1458d8543105';
import {PianoInputGate} from './piano-input-gate.mjs?v=1458d8543105';
/** A source check controls admission, never the expected exercise key. The
 * medium-confidence path retains the previous longer pitch confirmation. */
export class MicDetector{
 constructor({sampleRate=48000,minRms=.001}={}){
  this.sampleRate=sampleRate;this.minRms=minRms;this.gate=new PianoInputGate({stableMs:48,minRms,requireFreshFirstAttack:true,lowRegisterConfirmationBudget:true});
  this.probability=0;this.lastVadAt=-Infinity;this.positiveFrames=0;this.lastSpeechAt=-Infinity;this.admittedEvidence=null;
 }
 updateSpeech(probability,at){
  if(!Number.isFinite(probability)||probability<0||probability>1||!Number.isFinite(at)||at<=this.lastVadAt)throw new TypeError('Invalid speech evidence.');
  if(at-this.lastVadAt>40)this.positiveFrames=0;
  this.lastVadAt=at;this.probability=probability;
  this.positiveFrames=probability>=.85?this.positiveFrames+1:0;
  if(this.positiveFrames>=2)this.lastSpeechAt=at;
 }
 frame(longFrame,at){
  const short=longFrame.subarray(longFrame.length-Math.round(2048*this.sampleRate/48000));
  const quick=detectPitch(short,this.sampleRate,{minFrequency:60,maxFrequency:2150,minRms:this.minRms});
  let samples=short,pitch=quick;
  if(!quick||quick.frequency<220||quick.confidence<.9){samples=longFrame;pitch=detectPitch(samples,this.sampleRate,{minFrequency:60,maxFrequency:2150,minRms:this.minRms});}
  let sum=0;for(const x of samples)sum+=x*x;const rms=Math.sqrt(sum/samples.length);
  const vadAge=at-this.lastVadAt,speechAge=at-this.lastSpeechAt;
  const vadFresh=vadAge>=0&&vadAge<=65,speech=speechAge>=0&&speechAge<=128;
  this.gate.options.stableMs=vadFresh&&this.probability<.35?48:90;
  const candidate=this.gate.update(pitch,rms,at,{samples,sampleRate:this.sampleRate});
  const midi=!speech&&vadFresh?candidate:null;
  if(speech||!vadFresh)this.admittedEvidence=null;
  if(midi!==null)this.admittedEvidence=this.gate.lastAccepted;
  const heldMidi=!speech&&vadFresh&&this.probability<.35&&this.admittedEvidence&&
   this.gate.lastAccepted===this.admittedEvidence&&this.gate.diagnostics.state==='sustain'&&
   pitch?.midi===this.admittedEvidence.midi?this.admittedEvidence.midi:null;
  return {pitch,rms,midi,heldMidi,speech,vadFresh,probability:this.probability,
   uncertain:!vadFresh||this.probability>=.35&&candidate===null&&this.gate.diagnostics.state!=='sustain',
   onsetAt:midi===null?null:this.gate.lastOnsetAt,diagnostics:this.gate.diagnostics};
 }
}
