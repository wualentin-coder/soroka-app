import {frequencyForMidi,noteInfo} from './pitch.mjs?v=119118b1bfbc';

const NOISE_MS=900,REFERENCE_MS=120,RELEASE_MS=100,MAX_DURATION_MS=60000;
const MIN_NOISE_SAMPLES=8,MAX_NOISE_SAMPLES=64,MAX_PITCH_SAMPLES=16;
const MAX_BACKGROUND_RMS=.02,MAX_TUNING_CENTS=30,MIN_CONFIDENCE=.82;
const validTime=value=>Number.isFinite(value)&&value>=0&&value<=8640000000000000;
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
const pitchMidi=frequency=>69+12*Math.log2(frequency/440);
const validFrequency=value=>Number.isFinite(value)&&value>0&&value<=24000;

/** Local microphone profile. Never synced as lesson progress or reused on another input. */
export function readInputCalibration(storage,key,device='default'){
  try{const p=JSON.parse(storage.getItem(key));return p?.version===1&&p.device===device&&
    Number.isFinite(p.noiseFloor)&&p.noiseFloor>=0&&p.noiseFloor<=MAX_BACKGROUND_RMS&&
    Number.isFinite(p.minRms)&&p.minRms>=.003&&p.minRms<=.06&&
    Number.isFinite(p.centsOffset)&&Math.abs(p.centsOffset)<=MAX_TUNING_CENTS?p:null;}catch{return null;}
}
export function saveInputCalibration(storage,key,profile,device='default'){
  const value={version:1,device,noiseFloor:profile.noiseFloor,minRms:profile.minRms,centsOffset:profile.centsOffset};
  if(!readInputCalibration({getItem:()=>JSON.stringify(value)},key,device))return false;
  try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}
}

/** This measures one microphone stream, never a lesson, octave, or finger grade. */
export function createInputCalibration({at=0,referenceMidi=60}={}){
  if(!validTime(at)||!Number.isInteger(referenceMidi)||referenceMidi<0||referenceMidi>127)throw new TypeError('Calibration needs a valid monotonic start and reference note.');
  const startedAt=at,referenceFrequency=frequencyForMidi(referenceMidi),name=noteInfo(referenceMidi);
  let lastAt=null,phase='noise',noiseStart=at,noise=[],noiseFloor=0,minRms=.003,strikes=0,offsets=[],centsOffset=null;
  let candidateStart=null,candidateCents=[],releaseStart=null,releaseFrames=0,expired=false,issue=null;
  let message='Сначала секунду не играй: послушаем фон.';
  const clearCandidate=()=>{candidateStart=null;candidateCents=[];};
  const view=()=>({phase,ready:phase==='ready',noiseFloor,minRms,referenceMidi,strikes,centsOffset,issue,message});
  function block(code,text){
    issue=code;message=text;clearCandidate();releaseStart=null;releaseFrames=0;
    if(phase==='noise'&&(code==='invalid-time'||code==='invalid-level')){noise=[];noiseStart=lastAt??startedAt;}
    return view();
  }
  function update(frame){
    if(phase==='ready')return view();
    const time=frame?.at,rms=frame?.rms,peak=frame?.peak,pitch=frame?.pitch;
    if(!validTime(time)||time<startedAt||lastAt!==null&&time<=lastAt)return block('invalid-time','Сигнал прервался. Подождём устойчивого звука.');
    if(expired||time-startedAt>MAX_DURATION_MS){expired=true;return block('timeout','Проверка заняла слишком долго. Запусти калибровку заново.');}
    const gap=lastAt===null?0:time-lastAt;lastAt=time;
    if(!Number.isFinite(rms)||rms<0||rms>1||!Number.isFinite(peak)||peak<0||peak>1||rms>peak+1e-7)return block('invalid-level','Не удалось измерить звук. Проверь микрофон.');
    if(peak>=.98){if(phase==='noise'){noise=[];noiseStart=time;}return block('clipping','Звук перегружен. Сделай синтезатор тише или отодвинь телефон.');}
    if(phase==='noise'){
      if(gap>250){noise=[];noiseStart=time;}
      if(rms>MAX_BACKGROUND_RMS||pitch?.confidence>=MIN_CONFIDENCE){noise=[];noiseStart=time;return block('noise','Сейчас слышен звук. Не играй секунду; убери громкий фон.');}
      noise.push(rms);if(noise.length>MAX_NOISE_SAMPLES)noise.shift();
      noiseFloor=median(noise);minRms=Math.max(.003,noiseFloor*3);
      issue=null;message='Сначала секунду не играй: послушаем фон.';
      if(noise.length>=MIN_NOISE_SAMPLES&&time-noiseStart>=NOISE_MS){
        phase='reference';message=`Нажми и немного подержи ${name.name} ${name.latin}.`;
      }
      return view();
    }
    if(phase==='release'){
      if(gap>80){releaseStart=null;releaseFrames=0;}
      if(rms>=minRms*.65){releaseStart=null;releaseFrames=0;issue=null;message='Отпусти клавишу, затем сыграй её ещё раз.';return view();}
      releaseStart??=time;releaseFrames++;issue=null;message='Отпусти клавишу, затем сыграй её ещё раз.';
      if(time-releaseStart>=RELEASE_MS&&releaseFrames>=3){phase='reference';clearCandidate();message=`Теперь ещё раз нажми ${name.name} ${name.latin}.`;}
      return view();
    }
    if(gap>80)clearCandidate();
    if(rms<minRms)return block('quiet',`Нажми ${name.name} ${name.latin} достаточно слышно и немного подержи.`);
    if(!pitch||!validFrequency(pitch.frequency)||!Number.isFinite(pitch.confidence)||pitch.confidence<MIN_CONFIDENCE||pitch.confidence>1)return block('unstable','Пока не слышу устойчивой ноты. Сыграй одну клавишу без педали.');
    const semitone=pitchMidi(pitch.frequency),heard=Math.round(semitone),cents=1200*Math.log2(pitch.frequency/referenceFrequency);
    if(heard!==referenceMidi||Math.abs(cents)>MAX_TUNING_CENTS){
      const heardName=Number.isInteger(heard)&&heard>=0&&heard<=127?noteInfo(heard).latin:'неустойчивый звук';
      return block('wrong-note',`Слышу ${heardName}. Проверь клавишу ${name.name} ${name.latin}; настройку октавы не меняем.`);
    }
    if(candidateCents.length&&Math.abs(cents-median(candidateCents))>12){clearCandidate();issue='unstable';message='Подержи одну клавишу ровно, без педали.';}
    candidateStart??=time;candidateCents.push(cents);if(candidateCents.length>MAX_PITCH_SAMPLES)candidateCents.shift();
    if(time-candidateStart<REFERENCE_MS||candidateCents.length<3){if(issue!=='unstable'){issue=null;message='Слышу нужную ноту. Подержи её ещё немного.';}return view();}
    const offset=median(candidateCents);
    if(offsets.length&&Math.abs(offset-offsets[0])>12)return block('unstable','Два нажатия звучат по-разному. Сыграй ту же клавишу ещё раз без педали.');
    offsets.push(offset);strikes=offsets.length;clearCandidate();issue=null;
    if(strikes===1){phase='release';releaseStart=null;releaseFrames=0;message='Первая нота услышана. Отпусти клавишу, затем сыграй её ещё раз.';}
    else{centsOffset=median(offsets);phase='ready';message='Сигнал настроен. Можно играть.';}
    return view();
  }
  return Object.freeze({update,view});
}

/** Correct small measured tuning only; never turn a neighbouring key into the target. */
export function compensatedPitch(pitch,offset){
  if(!pitch||!validFrequency(pitch.frequency))return null;
  const raw=pitchMidi(pitch.frequency),rawMidi=Math.round(raw);
  if(rawMidi<0||rawMidi>127)return null;
  const unchanged={...pitch,midi:rawMidi,cents:(raw-rawMidi)*100};
  if(!Number.isFinite(offset)||Math.abs(offset)>MAX_TUNING_CENTS)return unchanged;
  const frequency=pitch.frequency/2**(offset/1200),value=pitchMidi(frequency),midi=Math.round(value);
  if(midi!==rawMidi)return unchanged;
  return {...unchanged,frequency,midi,cents:(value-midi)*100,rawFrequency:pitch.frequency,calibratedCentsOffset:offset};
}
