const prefix='flow-planner-outbox-v1:';
const clone=structuredClone;
const scopeKey=scope=>{if(!/^[a-f0-9]{64}$/.test(scope||''))throw Error('planner_verified_scope_required');return prefix+scope;};
function parse(raw){
 if(raw===null)return null;
 if(raw.length>4_000_000)throw Error('planner_outbox_too_large');
 const value=JSON.parse(raw);
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),id=v=>typeof v==='string'&&v.length>0&&v.length<=256;
 const recordColumn=col=>['tasks','events','notes','inbox','projects','metrics'].includes(col)||/^saved\.[a-z][a-z0-9_]{0,50}$/.test(col)||/^finance\.(accounts|transactions|transfers|budgets|goals|debts|payments)$/.test(col);
 const valid=c=>{
  if(!object(c)||typeof c.col!=='string'||!['create','update','delete','purge','replace'].includes(c.op))return false;
  if(c.op==='replace')return object(c.rec)&&(c.col==='finance.rules'?Array.isArray(c.rec.list):c.col==='app'&&object(c.rec.settings)&&object(c.rec.savedSections)&&(c.rec.mapCategories===undefined||Array.isArray(c.rec.mapCategories)));
  if(!recordColumn(c.col)||!id(c.id)||c.section!==undefined&&typeof c.section!=='string')return false;
  if(['delete','purge'].includes(c.op))return true;
  return object(c.rec)&&String(c.rec.id)===c.id&&(c.op!=='update'||object(c.prev)&&String(c.prev.id)===c.id);
 };
 if(value?.version!==1||!id(value.id)||!Array.isArray(value.changes)||!value.changes.length||value.changes.some(c=>!valid(c)))throw Error('planner_outbox_invalid');
 return value;
}
// Account scope is returned by the authenticated server, never inferred from a
// Telegram URL or from an unverified user ID. The envelope contains no credentials.
export function createPlannerOutbox(storage){
 return Object.freeze({
  read(scope){return clone(parse(storage.getItem(scopeKey(scope))));},
  write(scope,changes){
   const key=scopeKey(scope);if(storage.getItem(key)!==null)throw Error('planner_outbox_owned');
   const value={version:1,id:crypto.randomUUID(),changes:clone(changes)},raw=JSON.stringify(value);parse(raw);
   storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('planner_outbox_changed');return value.id;
  },
  clear(scope,id){const key=scopeKey(scope),current=parse(storage.getItem(key));if(current?.id!==id)return false;storage.removeItem(key);return storage.getItem(key)===null;}
 });
}
