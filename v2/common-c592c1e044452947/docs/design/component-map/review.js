export const schema=1;
export function validateReview(raw,ids){
 if(!raw||raw.schema!==schema||!raw.items||typeof raw.items!=='object'||Array.isArray(raw.items))throw Error('Неверный формат файла');
 const cleanRecord=r=>{if(!r||typeof r.revision!=='string'||r.revision.length>200||typeof r.approved!=='boolean'||typeof r.comment!=='string'||r.comment.length>4000||typeof r.at!=='string')throw Error('Повреждена запись');return{revision:r.revision,approved:r.approved,comment:r.comment,at:r.at}};
 const items={};for(const id of ids){const row=raw.items[id];if(!row)continue;items[id]={...cleanRecord(row),history:Array.isArray(row.history)?row.history.slice(-60).map(cleanRecord):[]};}
 const p=raw.preferences||{},preferences={accent:/^#[a-f\d]{6}$/i.test(p.accent||'')?p.accent:'#8cbbff',radius:Math.min(36,Math.max(12,Number(p.radius)||24)),glow:Math.min(30,Math.max(0,Number(p.glow)||0)),reduce:p.reduce===true};
 return{schema,items,preferences};
}
export function status(record,revision,compatibleRevision=null){const matches=record?.revision===revision||!!compatibleRevision&&record?.revision===compatibleRevision;return{approved:!!record?.approved&&matches,stale:!!record&&!matches,comment:record?.comment||''};}
export function recordChange(previous,revision,patch,at=new Date().toISOString()){
 const history=[...(previous?.history||[])];if(previous&&previous.revision!==revision){const{history:_,...old}=previous;history.push(old);}
 return{revision,approved:previous?.revision===revision?previous.approved:false,comment:previous?.comment||'',...patch,at,history:history.slice(-60)};
}
export async function signature(value){const bytes=new TextEncoder().encode(JSON.stringify(value));const result=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(result)].map(b=>b.toString(16).padStart(2,'0')).join('');}
