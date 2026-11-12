/** Pure Saved hub model. Source: saved.js1–5/67–92, birthdays.js7–28/137–141,
 * sites.js8–9, address-map.js294–344. No host clock, storage, GPS or provider calls.
 * Context is PLAIN TEXT: the consuming component must escape it when rendering HTML.
 */
export const librarySections=Object.freeze(['notes','materials','recipes','movies','addresses','tickets','lists','products','cards','birthdays','sites','projects','vault','docs']);
const primary=['notes','materials','recipes','movies','addresses','tickets'];
const materialKinds=['links','posts','files'];
const rows=value=>Array.isArray(value)?value:[];
const birthdayRE=/д(ень|\.)\s*рожд|(^|\s)др(\s|$)/i;
const utc=(year,month,day)=>{const date=new Date(0);date.setUTCHours(0,0,0,0);date.setUTCFullYear(year,month-1,day);return date;};
const iso=date=>`${String(date.getUTCFullYear()).padStart(4,'0')}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
function dateParts(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return null;const parts=value.split('-').map(Number);return iso(utc(...parts))===value?parts:null;}
/** Native Date rollover is retained:29Feb occurs1Mar in a non-leap year. */
export function nextLibraryBirthday(due,today){const original=dateParts(due),anchor=dateParts(today);if(!original||!anchor)return null;const start=utc(...anchor);let next=utc(anchor[0],original[1],original[2]);if(next<start)next=utc(anchor[0]+1,original[1],original[2]);return{date:iso(next),days:Math.round((next-start)/86400000)};}
function stamp(record){for(const value of[record.created,record.created_at,record.date]){if(typeof value==='number'&&Number.isFinite(value))return value;if(typeof value!=='string')continue;const day=dateParts(value);if(day)return +utc(...day);if(/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)&&Number.isFinite(Date.parse(value)))return Date.parse(value);}return -Infinity;}
function recent(records){return rows(records).map((record,index)=>({record,index})).sort((a,b)=>Number(Boolean(b.record.pinned))-Number(Boolean(a.record.pinned))||stamp(b.record)-stamp(a.record)||a.index-b.index)[0]?.record;}
function latestText(records){const record=recent(records);return record?`${record.pinned?'Закреплено':'Недавнее'}: ${String(record.title||record.name||'Без названия')}`:'Пока нет записей';}
const canonical=keys=>[...new Set(rows(keys).map(key=>materialKinds.includes(key)?'materials':key))].filter(key=>librarySections.includes(key));
function layout(order){order=order&&typeof order==='object'?order:{};const configured=Array.isArray(order.main)&&(order.main.length>0||Array.isArray(order.other)&&order.other.length>0),main=(configured?canonical(order.main):primary).slice(0,6),rest=librarySections.filter(key=>!main.includes(key)),chosen=canonical(order.other).filter(key=>rest.includes(key));return{main,other:[...chosen,...rest.filter(key=>!chosen.includes(key))]};}
const finite=value=>value!=null&&typeof value!=='boolean'&&!(typeof value==='string'&&!value.trim())&&Number.isFinite(Number(value));
function point(record){if(!record||record.deleted_at||record.deletedAt||record.deleted||record.active===false||![record.lat,record.lng].every(finite))return null;const lat=Number(record.lat),lng=Number(record.lng);return Math.abs(lat)<=90&&Math.abs(lng)<=180&&(lat!==0||lng!==0)?{lat,lng}:null;}
function positionRecord(position,now){if(!position||!Number.isFinite(now)||![position.lat,position.lng,position.acc,position.at].every(finite))return null;const p=Object.fromEntries(['lat','lng','acc','at'].map(key=>[key,Number(position[key])]));return Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180&&p.acc>=0&&p.acc<=1000&&p.at>0&&p.at<=now+60000&&now-p.at<=5*60000?p:null;}
const distance=(a,b)=>{const radians=value=>value*Math.PI/180,dlat=radians(b.lat-a.lat),dlng=radians(b.lng-a.lng),v=Math.sin(dlat/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(dlng/2)**2;return 6371000*2*Math.atan2(Math.sqrt(Math.min(1,v)),Math.sqrt(Math.max(0,1-v)));};
const distanceLabel=meters=>meters<1000?`${Math.max(10,Math.round(meters/10)*10)} м`:`${(meters/1000).toFixed(meters<10000?1:0).replace('.',',')} км`;
function addressDetail(record){const address=String(record.address||record.city||'').replace(/(?:[,;]?\s*)(?:домофон|код\s+(?:двери|подъезда|домофона))(?:\s|[:№]).*$/iu,'').trim(),parts=[address];for(const[key,label,aliases]of[['apartment','кв.','кв\\.?|квартира'],['entrance','подъезд','подъезд|под\\.?']]){const value=record[key];if(value==null||!String(value).trim())continue;const clean=String(value).trim(),escaped=clean.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(!new RegExp(`(?:${aliases})\\s*${escaped}(?:[\\s,.;]|$)`,'iu').test(address))parts.push(`${label} ${clean}`);}return parts.filter(Boolean).join(' · ');}
function addressContext(records,position,now){if(!records.length)return'Пока нет адресов';const mapped=records.map(record=>({record,point:point(record)})).filter(row=>row.point);if(!mapped.length)return'Добавь метки к адресам';const pos=positionRecord(position,now);if(!pos)return'Геопозиция не определена';const nearest=mapped.map(row=>({...row,distance:distance(pos,row.point)})).sort((a,b)=>a.distance-b.distance||String(a.record.id).localeCompare(String(b.record.id)))[0];return`Ближайший: ${String(nearest.record.title||'Адрес')} · ≈ ${distanceLabel(nearest.distance)}${addressDetail(nearest.record)?' · '+addressDetail(nearest.record):''}`;}
/** state is native data (not {data}); root passes authoritative today/now/position/order. */
export function buildLibraryModel(state={},options={}){
 const saved=state.saved||{},notes=rows(state.notes),events=rows(state.events),today=options.today??state.today;
 const birthdays=events.filter(record=>birthdayRE.test(record.title||'')&&dateParts(record.due));
 const collections={notes:notes.filter(record=>!record.packing),materials:materialKinds.flatMap(key=>rows(saved[key])),recipes:rows(saved.recipes),movies:rows(saved.movies),addresses:rows(saved.addresses),tickets:rows(saved.tickets),lists:[...rows(saved.lists),...notes.filter(record=>record.packing)],products:rows(saved.products),cards:rows(saved.cards),birthdays,sites:rows(saved.files).filter(record=>/\.html?$/i.test(String(record.title||''))||/\.html?$/i.test(String(record.fileName||''))),projects:rows(state.projects),vault:rows(state.vault),docs:rows(state.documents)};
 const counts=Object.fromEntries(librarySections.map(key=>[key,collections[key].length])),context=Object.fromEntries(librarySections.map(key=>[key,key==='vault'?'':latestText(collections[key])]));
 if(!Array.isArray(state.vault))counts.vault=null;if(!Array.isArray(state.documents)){counts.docs=null;context.docs='';}
 context.addresses=addressContext(collections.addresses,options.position,options.now);
 const next=birthdays.map(record=>({record,next:nextLibraryBirthday(record.due,today)})).filter(row=>row.next).sort((a,b)=>a.next.days-b.next.days||String(a.record.title).localeCompare(String(b.record.title),'ru'))[0];
 context.birthdays=next?`${String(next.record.title||'').replace(/^\s*(д(ень|\.)\s*рожд\S*|др)\s*(у\s+)?[:—-]?\s*/i,'').trim()||next.record.title} · ${next.next.days===0?'сегодня':next.next.days===1?'завтра':shortBirthday(next.next.date)}`:birthdays.length?'Дата просмотра не определена':'Пока нет дней рождения';
 return{...layout(options.order??state.settings?.boundLibrary??state.settings?.savedOrder),counts,context};
}
function shortBirthday(date){const parts=dateParts(date);return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'}).format(utc(...parts));}
