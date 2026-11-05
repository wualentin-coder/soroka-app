import {NoteGate} from './note-gate.mjs?v=119118b1bfbc';

/** Reject ambiguous microphone pitch tracks without consulting lesson targets.
 * Stable speech/singing can still resemble an instrument; this is not source separation.
 */
export class PianoInputGate extends NoteGate {
  constructor(options={}){super({...options,stableMs:0});}
  reset(){super.reset();this.track=[];this.trackMidi=null;this.trackAt=null;}
  update(pitch,rms,at){
    const valid=Number.isFinite(at)&&pitch&&Number.isFinite(pitch.cents)&&pitch.confidence>=.9&&
      Math.abs(pitch.cents)<=40&&rms>=this.options.minRms;
    if(!valid){this.track=[];this.trackMidi=null;this.trackAt=null;return super.update(null,rms,at);}
    if(this.trackMidi!==pitch.midi||this.trackAt!==null&&(at-this.trackAt>80||at<=this.trackAt))this.track=[];
    this.trackMidi=pitch.midi;this.trackAt=at;
    this.track.push({at,cents:pitch.cents});
    this.track=this.track.filter(frame=>at-frame.at<=190);
    const cents=this.track.map(frame=>frame.cents);
    if(Math.max(...cents)-Math.min(...cents)>20){this.track=[{at,cents:pitch.cents}];return super.update(null,rms,at);}
    if(this.track.length<4||at-this.track[0].at<100)return super.update(null,rms,at);
    const previous=this.latched,event=super.update(pitch,rms,at);
    if(event!==null&&previous!==pitch.midi)this._lastOnsetAt=this.track[0].at;
    return event;
  }
}
