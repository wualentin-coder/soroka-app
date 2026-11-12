import {harmonicProfile, profileSimilarity} from './harmonic-profile.mjs?v=1458d8543105';

/** Target-independent periodic-attack gate. Not a speech classifier or source
 * separator. MIDI bypasses this gate. No lesson target is accepted as input.
 */
export class PianoInputGate {
  constructor(options = {}) {
    this.options = {minRms:.001, stableMs:90, silenceMs:90, refractoryMs:230,
      minConfidence:.9, meanConfidence:.97, lowRegisterConfidence:.9,
      centsRange:12, profileSimilarity:.94, requireFreshFirstAttack:false, lowRegisterConfirmationBudget:false, ...options};
    this.reset();
  }
  reset() {
    this.track=[];this.latched=null;this.lastUpdateAt=null;this.quietSince=null;
    this.lastEmitAt=-Infinity;this._lastOnsetAt=null;this._lastAccepted=null;this.peak=0;this.trough=0;
    this.armed=false;this.pendingAttack=null;this.previousLevel=0;
    this.diagnostics={state:'quiet',reason:'no-signal',heardMidi:null,acceptedMidi:null};
  }
  get lastOnsetAt() { return this._lastOnsetAt; }
  /** Last emitted source evidence persists through later sustain frames. */
  get lastAccepted() { return this._lastAccepted; }

  /** PCM is the same trailing frame used by detectPitch, ending at at.
   * Without it spectral checks are absent; pitch/envelope checks still apply.
   */
  update(pitch, rms, at, audio = null) {
    if (!Number.isFinite(at)) return null;
    if (this.lastUpdateAt !== null && at <= this.lastUpdateAt) this.reset();
    // A scheduling gap loses track continuity, not proof that a key was released.
    if (this.lastUpdateAt !== null && at-this.lastUpdateAt>80) {this.track=[];this.pendingAttack=null;}
    this.lastUpdateAt=at;
    const level=Number.isFinite(rms)?Math.max(0,rms):0;
    const heardMidi=Number.isFinite(pitch?.midi)?Math.round(pitch.midi):null;
    // Low fundamentals may establish periodicity late. Retain only the actual
    // confirmation budget after an observed attack; amplitude/confidence floors
    // and higher-register freshness remain unchanged.
    const attackBudget=220+(this.options.lowRegisterConfirmationBudget&&pitch?.frequency<100?this.options.stableMs:0);
    const diagnostic=(state,reason)=>this.diagnostics={state,reason,heardMidi,
      acceptedMidi:null,confidence:pitch?.confidence??null,pcmChecked:false,
      attackAt:this.pendingAttack,attackRecent:this.pendingAttack!==null&&at-this.pendingAttack<=attackBudget};
    if(level<this.options.minRms*.5){
      this.quietSince??=at;
      if(at-this.quietSince>=this.options.silenceMs){this.latched=null;this.peak=0;this.armed=false;}
    }else this.quietSince=null;
    // Missing periodicity does not mean the instrument was released. Otherwise
    // a decaying note/reverb can reappear as an unplayed fresh strike.
    this.peak=Math.max(this.peak,level);
    if(level<=this.peak*.6){this.armed=true;this.trough=this.trough?Math.min(this.trough,level):level;}
    const attack=level>=Math.max(this.previousLevel,this.trough)*1.6&&
      level-this.previousLevel>=Math.max(.0005,this.peak*.12);
    if(attack&&(this.armed||this.latched===null))this.pendingAttack=at;
    this.previousLevel=level;
    if(!pitch||heardMidi===null||!Number.isFinite(pitch.cents)||pitch.confidence<this.options.minConfidence||
       Math.abs(pitch.cents)>40||level<this.options.minRms){
      this.track=[];diagnostic(level<this.options.minRms?'quiet':'uncertain',level<this.options.minRms?'low-level':'unstable-pitch');return null;
    }
    if(this.track.length&&this.track.at(-1).midi!==heardMidi)this.track=[];
    const profile=audio?harmonicProfile(audio.samples,audio.sampleRate,pitch.frequency):null;
    if(audio&&!profile){this.track=[];diagnostic('uncertain','invalid-audio');return null;}
    this.track.push({at,midi:heardMidi,cents:pitch.cents,confidence:pitch.confidence,profile});
    this.track=this.track.filter(frame=>at-frame.at<=this.options.stableMs+55);
    const cents=this.track.map(frame=>frame.cents);
    if(Math.max(...cents)-Math.min(...cents)>this.options.centsRange){
      this.track=this.track.slice(-1);diagnostic('uncertain','moving-pitch');return null;
    }
    const first=this.track[0],similarity=profileSimilarity(first.profile,profile);
    diagnostic('candidate','confirming');this.diagnostics.pcmChecked=!!profile;
    this.diagnostics.profileSimilarity=similarity;
    if(similarity!==null&&similarity<this.options.profileSimilarity){
      this.track=this.track.slice(-1);this.diagnostics.state='uncertain';this.diagnostics.reason='changing-spectrum';return null;
    }
    // Below 100 Hz a short microphone frame contains fewer cycles and an
    // acoustic piano's inharmonic partials depress YIN periodicity. Only permit
    // this lower threshold with measured spectral consistency across the track.
    const meanConfidence=profile&&pitch.frequency<100?this.options.lowRegisterConfidence:this.options.meanConfidence;
    const recent=this.track.slice(-2),fast=recent.length===2&&
      at-recent[0].at>=45&&at-recent[0].at<=65&&
      recent.every(frame=>frame.confidence>=.985)&&
      Math.abs(recent[0].cents-recent[1].cents)<=6&&
      (profileSimilarity(recent[0].profile,recent[1].profile)??0)>=.995;
    if(!fast&&(this.track.length<3||at-first.at<this.options.stableMs||
       this.track.reduce((sum,frame)=>sum+frame.confidence,0)/this.track.length<meanConfidence))return null;
    const repeated=this.latched===heardMidi;
    const freshAttack=this.pendingAttack!==null&&this.pendingAttack>this.lastEmitAt&&at-this.pendingAttack<=attackBudget;
    if(this.latched===null&&this.options.requireFreshFirstAttack&&!freshAttack){
      this.diagnostics.state='uncertain';this.diagnostics.reason='no-new-attack';return null;
    }
    if(this.latched!==null&&!(freshAttack&&(!repeated||this.armed))){
      this.diagnostics.state='sustain';this.diagnostics.reason=repeated?'held-note':'no-new-attack';return null;
    }
    if(at-this.lastEmitAt<this.options.refractoryMs)return null;
    this.latched=heardMidi;this.lastEmitAt=at;
    this._lastOnsetAt=freshAttack?this.pendingAttack:first.at;
    this._lastAccepted=Object.freeze({midi:heardMidi,onsetAt:this._lastOnsetAt,confirmedAt:at,
      firstPeriodicAt:first.at,attackAt:this.pendingAttack,rms:level,
      meanPeriodicity:this.track.reduce((sum,frame)=>sum+frame.confidence,0)/this.track.length,
      profileSimilarity:similarity,pcmChecked:!!profile,sourceUnverified:true});
    this.pendingAttack=null;this.armed=false;this.peak=level;this.trough=level;
    this.diagnostics.state='accepted';this.diagnostics.reason='periodic-attack';this.diagnostics.acceptedMidi=heardMidi;
    this.diagnostics.acceptedEvidence=this._lastAccepted;
    return heardMidi;
  }
}
