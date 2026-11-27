const MAX_NOTES=5000;
// Existing score clocks allow one day, a ten-second attack window, and source
// chord events whose individual scaled times can differ from the group leader.
const MAX_OFFSET_MS=86_410_000;
const ON_TIME_MS=80;
const round=value=>Math.round(value*10)/10 || 0;
const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=MAX_NOTES;
const attackCount=value=>Number.isSafeInteger(value)&&value>=0&&value<=MAX_NOTES*MAX_NOTES;
const offset=value=>Number.isFinite(value)&&Math.abs(value)<=MAX_OFFSET_MS;
const GENERAL='Держи общий счёт и продолжай спокойно.';

/** Signed offsets concern observed note attacks, never device latency or holds. */
export function summarizeTimingOffsets(values){
  if(!Array.isArray(values)||values.length>MAX_NOTES)throw new TypeError('Timing needs at most 5000 indexed offsets.');
  let matched=0,early=0,late=0,onTime=0,total=0,absolute=0;
  for(const value of values){
    if(value===null)continue;
    if(!offset(value))throw new RangeError('Timing offsets must be finite, bounded milliseconds or null.');
    matched++;total+=value;absolute+=Math.abs(value);
    if(value < -ON_TIME_MS)early++;else if(value > ON_TIME_MS)late++;else onTime++;
  }
  return {matched,early,late,onTime,meanAbsMs:matched?round(absolute/matched):0,trendMs:matched?round(total/matched):0};
}

function validTiming(report){
  if(!report||typeof report!=='object'||Array.isArray(report)||report.metric!=='timed-notes-v1'||report.finished!==true||report.demo!==undefined&&report.demo!==false)return null;
  const timing=report.timing;
  if(report.strictRests!==undefined&&typeof report.strictRests!=='boolean'||
    report.extraAttacks!==undefined&&(!attackCount(report.extraAttacks)||report.extraAttacks>0&&report.strictRests!==true)||
    report.wrong!==undefined&&(!attackCount(report.wrong)||report.extraAttacks!==undefined&&report.extraAttacks>report.wrong))return null;
  if(!timing||typeof timing!=='object'||Array.isArray(timing)||
    !['matched','early','late','onTime'].every(key=>count(timing[key]))||
    timing.early+timing.late+timing.onTime!==timing.matched||
    !offset(timing.meanAbsMs)||timing.meanAbsMs<0||!offset(timing.trendMs)||Math.abs(timing.trendMs)>timing.meanAbsMs+.051||
    timing.matched===0&&(timing.meanAbsMs!==0||timing.trendMs!==0))return null;
  if(report.total!==undefined&&(!count(report.total)||report.total===0||timing.matched>report.total))return null;
  if(report.correct!==undefined&&(!count(report.correct)||timing.matched>report.correct))return null;
  if(report.hitOffsetsMS!==undefined){
    try{
      const measured=summarizeTimingOffsets(report.hitOffsetsMS);
      if(Object.keys(measured).some(key=>measured[key]!==timing[key]))return null;
      if(report.total!==undefined&&report.hitOffsetsMS.length!==report.total)return null;
    }catch{return null;}
  }
  return timing;
}

/** Pick one useful direction from a completed, bounded timed-note report. */
export function chooseTimingAdvice(report){
  const timing=validTiming(report);
  if(!timing)return GENERAL;
  if(report.strictRests===true&&report.extraAttacks>0)return 'Появились лишние нажатия между нотами. Дождись следующей ноты.';
  if(timing.matched<4)return GENERAL;
  const majority=Math.ceil(timing.matched*.6);
  if(timing.early>=majority&&timing.trendMs<=-60)return 'Ноты часто приходят раньше нужного момента. Дождись счёта, не торопись.';
  if(timing.late>=majority&&timing.trendMs>=60)return 'Ноты чаще запаздывают. Готовь следующую клавишу заранее под общий счёт.';
  if(timing.early>=Math.ceil(timing.matched*.2)&&timing.late>=Math.ceil(timing.matched*.2)&&timing.meanAbsMs>=90)
    return 'Пульс пока неровный. Повтори медленнее, сохраняя один общий счёт.';
  return GENERAL;
}
