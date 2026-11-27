const validId=id=>typeof id==='string'&&/^[-A-Za-z0-9._:]{1,220}$/.test(id);
const states=new Set(['skipped','passed','failed','input-problem']);
/** Device-local attempts, under the existing explicit profile/player storage key.
 * This journal never supplies course evidence and is not a substitute for sync.
 */
export function readPracticeActivity(storage,storageKey){
  if(!validId(storageKey))return [];
  try{const raw=JSON.parse(storage.getItem(storageKey+':practice-v2')||'[]');return Array.isArray(raw)?raw.filter(r=>validId(r.key)&&states.has(r.status)&&Number.isSafeInteger(r.at)&&r.at>0&&r.at<=8640000000000000).slice(-256).map(r=>({key:r.key,status:r.status,at:r.at,lessonId:validId(r.lessonId)?r.lessonId:null,compositionId:validId(r.compositionId)?r.compositionId:null,stageId:validId(r.stageId)?r.stageId:null,title:typeof r.title==='string'?r.title.slice(0,180):''})):[];}catch{return [];}
}
export function recordPracticeActivity(storage,storageKey,entry){
  if(!validId(storageKey)||!validId(entry?.key)||!states.has(entry?.status)||!Number.isSafeInteger(entry?.at)||entry.at<=0)return false;
  const rows=readPracticeActivity(storage,storageKey).filter(r=>r.key!==entry.key);rows.push(entry);
  const clean=readPracticeActivity({getItem:()=>JSON.stringify(rows)},storageKey);if(!clean.some(r=>r.key===entry.key))return false;
  try{storage.setItem(storageKey+':practice-v2',JSON.stringify(clean));return true;}catch{return false;}
}
