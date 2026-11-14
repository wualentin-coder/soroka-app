const LIMIT=16000;
const TIME=/\b\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b|\b(?:[01]?\d|2[0-3]):[0-5]\d(?:\s*[–—-]\s*(?:[01]?\d|2[0-3]):[0-5]\d)?\b|\b(?:0?[1-9]|[12]\d|3[01])\.(?:0?[1-9]|1[0-2])(?:\.\d{4})?\b|(?<![\p{L}\p{N}])(?:сегодня|завтра|послезавтра|вчера|(?:[1-9]|[12]\d|3[01])\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+\d{4})?)(?![\p{L}\p{N}])/giu;
export function answerBlocks(value){
 const lines=String(value??'').slice(0,LIMIT).replace(/\r\n?/g,'\n').split('\n'),blocks=[];
 for(const line of lines){const item=line.match(/^\s*(?:([-*•])\s+|(\d{1,2})[.)]\s+)(.+)$/);if(item){const type=item[2]?'ol':'ul',last=blocks.at(-1);if(last?.type===type)last.items.push(item[3]);else blocks.push({type,start:item[2]?Number(item[2]):undefined,items:[item[3]]});}else if(!line.trim()){if(blocks.at(-1)?.type==='p')blocks.at(-1).closed=true;}else{const text=line.replace(/^#{1,4}\s+(.+)$/,'**$1**'),last=blocks.at(-1);if(last?.type==='p'&&!last.closed)last.text+='\n'+text;else blocks.push({type:'p',text});}}
 return blocks;
}
export function plainAnswer(value){return String(value??'').replace(/```[\s\S]*?```/g,'').replace(/\[([^\]]+)\]\([^\s)]+\)/g,'$1').replace(/^\s*(?:#{1,6}|[-*•]|\d+[.)])\s+/gm,'').replace(/\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`/g,(_,a,b,c)=>a??b??c).replace(/\s+/g,' ').trim();}
/** An extract of the shown answer, never a second model guess about success. */
export function speechSummary(value,meta={}){
 const blocks=answerBlocks(value);if(!blocks.length)return '';
 const failure=blocks.find(b=>b.type==='p'&&/^Не выполнено:/u.test(plainAnswer(b.text)));if(failure){const error=plainAnswer(failure.text),first=blocks[0]!==failure?plainAnswer(blocks[0].text||'').split(/(?<=[.!?…])\s/u)[0]:'';return(first&&first.length+error.length<260?first+' ':'')+(error.length<=260?error:'Часть поручения не удалось подтвердить. Подробности — на экране.');}
 if(Array.isArray(meta.warnings)&&meta.warnings.length)return 'Изменения сохранены. Есть пересечение в расписании. Подробности — на экране.';
 if(Array.isArray(meta.receipts)&&meta.receipts.length>1){const changed=meta.receipts.filter(r=>!r.commandId&&r.changed!==false).length,queued=meta.receipts.filter(r=>r.commandId).length;let summary=changed?'Сохранил '+changed+' '+(changed===1?'изменение':changed<5?'изменения':'изменений')+'.':'';if(queued)summary+=(summary?' ':'')+'Отправил '+queued+' '+(queued===1?'команду':'команды')+' на ПК.';return(summary||'Уже всё так, как ты попросил.')+' Подробности — на экране.';}
 const full=plainAnswer(value);if(full.length<=260&&blocks.filter(b=>b.type!=='p').every(b=>b.items.length<=2))return full;
 const first=blocks[0],parts=first.type==='p'?first.text.split(/(?<=[.!?…])\s+/u):[first.items[0]];
 let spoken='';for(const part of parts){const clean=plainAnswer(part);if(!clean)continue;if(spoken&&(spoken+' '+clean).length>240)break;if(clean.length>260){spoken='Подробный ответ — на экране.';break;}spoken+=(spoken?' ':'')+clean;if(spoken.length>=160)break;}
 if(!spoken)return 'Подробности — на экране.';
 if(full.length>spoken.length+40)spoken=spoken.replace(/[\s.]+$/,'')+'. Остальное — на экране.';
 return spoken;
}
function textWithDates(parent,text,doc){let end=0;for(const match of text.matchAll(TIME)){parent.append(doc.createTextNode(text.slice(end,match.index)));const mark=doc.createElement('span');mark.className='assistant-when';mark.textContent=match[0];parent.append(mark);end=match.index+match[0].length;}parent.append(doc.createTextNode(text.slice(end)));}
function inline(parent,text,doc){
 const pattern=/\*\*([^*\n]+)\*\*|__([^_\n]+)__|`([^`\n]+)`|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;let end=0;
 for(const m of text.matchAll(pattern)){textWithDates(parent,text.slice(end,m.index),doc);let node;if(m[1]||m[2]){node=doc.createElement('strong');textWithDates(node,m[1]??m[2],doc);}else if(m[3]){node=doc.createElement('code');node.textContent=m[3];}else{try{const url=new URL(m[5]);if(url.username||url.password)throw Error();node=doc.createElement('a');node.href=url.href;node.target='_blank';node.rel='noopener noreferrer';textWithDates(node,m[4],doc);}catch{node=doc.createTextNode(m[4]);}}parent.append(node);end=m.index+m[0].length;}
 textWithDates(parent,text.slice(end),doc);
}
export function renderAssistantAnswer(target,value){const doc=target.ownerDocument,fragment=doc.createDocumentFragment();for(const block of answerBlocks(value)){const node=doc.createElement(block.type);if(block.type==='p')inline(node,block.text,doc);else{if(block.type==='ol'&&block.start!==1)node.start=block.start;for(const item of block.items){const li=doc.createElement('li');inline(li,item,doc);node.append(li);}}fragment.append(node);}target.replaceChildren(fragment);}
export const answerStyles='.star-zone:focus-visible{outline:1px solid var(--fu-accent);outline-offset:4px;border-radius:50%}.phone[data-s26-answer=true] .request-copy{white-space:normal!important}.answer>p{margin:0!important;font:inherit!important;line-height:inherit!important;text-align:inherit!important;white-space:pre-line}.answer>:is(p,ul,ol)+:is(p,ul,ol){margin-top:12px!important}.answer>:is(ul,ol){margin:0;padding-left:22px;display:grid;gap:8px}.answer li{padding-left:2px;overflow-wrap:anywhere}.answer li::marker{color:var(--fu-accent);font-variant-numeric:tabular-nums}.answer strong{font-weight:750;color:var(--fu-text)}.answer .assistant-when{color:var(--fu-accent);font-weight:650;font-variant-numeric:tabular-nums}.answer a{color:var(--fu-accent);text-decoration:underline;text-underline-offset:3px;overflow-wrap:anywhere}.answer code{font-size:.9em;overflow-wrap:anywhere}';
