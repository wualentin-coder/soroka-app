/* Native structured practice. Content, journal and shared vocabulary keep separate responsibilities. */
(()=>{'use strict';
const core=window.FlowEnglishPracticeCore;if(!core)return;
const names={mission:'Ситуации',sounds:'Звуки',story:'Истории',radio:'Аудирование',media:'Музыка и видео'};
const engine=ex=>window.FlowEnglishLyricsPractice?.owns(ex)?window.FlowEnglishLyricsPracticeCore.forRevision(ex.contentRevision):ex.practiceKind==='media'?window.FlowEnglishMediaPracticeCore:core;
const h=value=>esc(String(value??'')),button=(label,action,attrs='',primary=false)=>`<button type="button" class="${primary?'primary-button':'ghost-button'}" data-action="en-training-${action}" ${attrs}>${label}</button>`;
let sound=null,generation=0,audioRun=null,choiceTap=null;
function stop(){generation++;audioRun=null;choiceTap=null;window.FlowEnglishMediaPractice?.stop();window.FlowEnglishLyricsPractice?.stop();if(sound){sound.pause();sound.onended=null;sound.onerror=null;sound.ontimeupdate=null;sound=null;}}
const originalStop=window.enStopPcm;window.enStopPcm=function(...args){stop();return originalStop?.(...args);};
const task=()=>enState().ex?.mode==='structured'?enState().ex:null;
const step=ex=>engine(ex).resolve(ex.items[ex.index],ex.branch||0);
const needs=q=>q.audioMatch?(q.pairs||[]).map(p=>'pair:'+p.id):(q.clips||[]).map((_,i)=>'clip:'+i);
const supported=q=>!!q.assistance?.transcript||!!q.assistance?.shown||needs(q).every(key=>q.heard?.includes(key));
function terms(q){return[...(q.target?[q.target]:[]),...(q.pairs||[])].filter(x=>typeof x.word==='string'&&typeof x.ru==='string'&&x.word.length<=80&&x.ru.length<=300&&x.word.trim()&&x.ru.trim());}
function payload(ex,event,answer=null,extra={}){const q=ex.items[ex.index];return{sessionId:ex.sessionId,kind:ex.practiceKind,contentId:ex.contentId,revision:ex.contentRevision,seed:ex.seed,index:ex.index,event,answer,assistance:q?.checkedAssistance||q?.assistance||{},heard:q?.checkedHeard||q?.heard||[],skipped:!!q?.skipped,...extra};}
function transcript(q,raw,result){const text=q.clips?.map(c=>c.audioText||c.word).join(' / ');return text&&text!==result.expected&&(raw.assistance?.transcript||raw.assistance?.shown||raw.reviewTranscript)?`<p class="en-en" lang="en">${h(text)}</p>`:'';}
function reference(q){return q.clips?.map(c=>c.audioText||c.word).join(' / ')||(q.kind==='order'?q.correctOrder.map(id=>q.parts.find(p=>p.id===id)?.text).join(' '):q.kind==='match'?q.pairs.map(p=>p.word+' — '+p.ru).join('; '):typeof q.expected==='string'?q.expected:'')||q.explain||'Сравни ответ с образцом.';}
function effect(fn){if(!window.flowEnglishSession?.effect)throw Error('english_owner_not_ready');window.flowEnglishSession.effect(fn);}
const audioTime=value=>Number.isFinite(value)&&value>=0?Math.floor(value/60)+':'+String(Math.floor(value%60)).padStart(2,'0'):'—';
const pauseGlyph='<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
function updatePlayers(r){
 if(audioRun!==r)return;for(const node of document.querySelectorAll?.('[data-practice-player]')||[]){if(node.dataset.key!==r.key)continue;const a=r.audio,duration=Number.isFinite(a.duration)&&a.duration>0?a.duration:0,input=node.querySelector('input'),play=node.querySelector('button'),text=node.querySelector('output');input.max=String(duration||1);input.value=String(duration?Math.min(a.currentTime,duration):0);input.disabled=!duration;play.innerHTML=a.paused||r.ended?icon('play','icon-sm'):pauseGlyph;play.setAttribute('aria-label',a.paused||r.ended?'Воспроизвести запись':'Пауза');text.textContent=r.error||audioTime(a.currentTime)+' / '+audioTime(duration||NaN);}
}
function player(text,key,ex){const r=audioRun?.sid===ex.sessionId&&audioRun.index===ex.index&&audioRun.key===key?audioRun:null,a=r?.audio,duration=Number.isFinite(a?.duration)&&a.duration>0?a.duration:0;return `<div class="en-practice-player" data-practice-player data-key="${h(key)}"><button type="button" class="icon-button" data-action="en-training-audio" data-text="${h(text)}" data-key="${h(key)}" aria-label="${a&&!a.paused&&!r.ended?'Пауза':'Воспроизвести запись'}">${a&&!a.paused&&!r.ended?pauseGlyph:icon('play','icon-sm')}</button><input type="range" data-practice-seek data-key="${h(key)}" aria-label="Позиция записи" min="0" max="${duration||1}" step="0.05" value="${duration?Math.min(a.currentTime,duration):0}" ${duration?'':'disabled'}><output>${h(r?.error||audioTime(a?.currentTime||0)+' / '+audioTime(duration||NaN))}</output></div>`;}
function play(text,key,slow,ex){
 if(ex.practiceKind==='media'){effect(()=>window.FlowEnglishMediaPractice.play(ex,key,slow).catch(error=>toast(error.message)));return;}
 const asset=core.audio(text);if(!asset){toast('Запись недоступна. Можно пропустить задание.');return;}
 const session=window.sorokaEnglishSession,owner=session?.captureOwner(),sid=ex.sessionId,index=ex.index;
 effect(()=>{
  if(audioRun?.sid===sid&&audioRun.index===index&&audioRun.key===key&&!audioRun.ended&&!audioRun.error&&audioRun.slow===slow&&audioRun.current()){const r=audioRun;if(r.audio.paused)r.audio.play().catch(()=>{r.error='Не удалось включить запись';updatePlayers(r);});else r.audio.pause();updatePlayers(r);return;}
  enStopPcm();const epoch=generation,a=new Audio(asset);sound=a;a.playbackRate=slow?.75:1;
  const current=()=>epoch===generation&&task()?.sessionId===sid&&task()?.index===index&&ui.page==='english'&&!document.hidden&&window.sorokaEnglishSession===session&&session?.isCurrent(owner);
  let anchor={time:0,at:Date.now()},ranges=[];const r={sid,index,key,slow,audio:a,current,ended:false,error:'',seek(){anchor=null;}};audioRun=r;
  a.ontimeupdate=()=>{if(!current()){stop();return;}const now=Date.now();if(anchor){const delta=a.currentTime-anchor.time,elapsed=(now-anchor.at)/1000;if(elapsed>0&&elapsed<=5&&delta>0&&delta<=elapsed*a.playbackRate*1.35+.25)ranges.push([anchor.time,a.currentTime]);}anchor={time:a.currentTime,at:now};updatePlayers(r);};
  a.onplay=()=>{if(current()){anchor={time:a.currentTime,at:Date.now()};updatePlayers(r);}};
  a.onpause=()=>{if(current()){a.ontimeupdate?.();anchor=null;updatePlayers(r);}};
  a.onseeking=()=>{anchor=null;};a.onseeked=()=>{if(current()){anchor=a.paused?null:{time:a.currentTime,at:Date.now()};updatePlayers(r);}};
  a.onloadedmetadata=()=>{if(current())updatePlayers(r);};
  a.onended=()=>{if(!current())return;a.ontimeupdate?.();r.ended=true;anchor=null;ranges.sort((a,b)=>a[0]-b[0]);let covered=0,end=0;for(const[from,to]of ranges){covered+=Math.max(0,to-Math.max(from,end));end=Math.max(end,to);}updatePlayers(r);if(Number.isFinite(a.duration)&&a.duration>0&&covered>=a.duration*.9)englishAction('en-training-heard',{dataset:{sid,index:String(index),key}});else toast('Фрагмент прослушан не целиком. Повтори или открой текст.');};
  a.onerror=()=>{if(current()){r.error='Запись не загрузилась';updatePlayers(r);toast('Запись не загрузилась. Повтори или открой текст.');}};
  a.play().then(()=>{if(current())updatePlayers(r);}).catch(()=>{if(current()){r.error='Не удалось включить запись';updatePlayers(r);toast('Не удалось включить запись. Повтори нажатие.');}});
 });
}
window.enStructuredCatalog=function(kind){
 const s=enState();if(!names[kind])return '';
 if(!s.practiceProgress&&!s.practiceProgressLoading&&!s.failedLoads?.practiceProgress)enLoad('practiceProgress','practiceprogress');
 const progress=s.practiceProgress?.items||[];
 return `<button class="en-back" data-action="en-practice-back">${icon('left','icon-sm')}Вся практика</button><h2 class="en-catalog-title">${names[kind]}</h2><div class="en-steps en-practice-list">${core.catalog().filter(x=>x.kind===kind).map(item=>{const completed=progress.filter(x=>x.completed&&x.descriptor?.kind===kind&&x.descriptor?.contentId===item.id).length;return `<button type="button" class="en-step" data-action="en-training-start" data-kind="${kind}" data-id="${h(item.id)}"><span class="en-step-ic">${icon(kind==='sounds'?'mic':kind==='story'?'book':kind==='mission'?'flag':'play','icon-sm')}</span><div><b>${h(item.title)}</b><small>${h(item.level)} · ${item.steps} шагов${completed?' · завершено':''}</small></div></button>`;}).join('')}</div>`;
};
window.enStructuredScreen=function(ex){
 if(ex.blockedReason||ex.contentRevision!==engine(ex)?.revision)return `<section class="en-run en-practice-workspace"><h2>Материал обновился</h2><p>Прежние ответы сохранены на устройстве для проверки. Можно выбрать другое занятие.</p>${button('К практике','close')}</section>`;
 if(window.FlowEnglishLyricsPractice?.owns(ex))return window.FlowEnglishLyricsPractice.screen(ex);
 if(ex.index>=ex.items.length){const summary=ex.result?.summary||core.summary(ex.items),saved=ex.result?.completed;return `<section class="en-run en-done en-practice-workspace"><h2>${saved?'Занятие завершено':'Ответы сохранены на устройстве'}</h2><p>${h(ex.title)}</p><p>Самостоятельно: ${summary.independent||0}${summary.aided?' · с поддержкой: '+summary.aided:''}${summary.selfcheck?' · самопроверка: '+summary.selfcheck:''}${summary.skipped?' · пропущено: '+summary.skipped:''}</p>${!saved?'<p class="section-note" role="status">Ждём подтверждения сохранения результата.</p>':''}${button('К практике','close','',true)}${ex.sourceMeta?.songId?button('К песне','media-return'):''}</section>`;}
 const q=step(ex),raw=ex.items[ex.index],result=raw.result,parts=q.kind==='info'&&q.phonetics?q.examples.flat():null;
 const top=`<div class="en-run-top"><button type="button" class="icon-button" data-action="en-ex-quit" aria-label="Закончить">${icon('close','icon-sm')}</button><div class="en-bar" role="progressbar" aria-label="Прогресс занятия" aria-valuenow="${ex.index}" aria-valuemin="0" aria-valuemax="${ex.items.length}"><i style="width:${Math.round(ex.index/ex.items.length*100)}%"></i></div><small>${ex.index+1}/${ex.items.length}</small></div>`;
 const audioButton=(text,key,label='Послушать')=>button(`${icon('play','icon-sm')}<span>${h(label)}</span>`,'audio',`data-text="${h(text)}" data-key="${h(key)}"`);
 const examples=parts||(q.examples||[]).map(([word,ru])=>({word,ru}));
 let body=q.kind==='info'?`<header class="en-practice-heading"><p class="en-kicker">${h(q.section||names[ex.practiceKind])}</p><h2 class="en-prompt">${h(q.title||ex.title)}</h2></header><p class="en-practice-copy">${h(q.prompt)}</p>${q.formula?`<p class="en-en">${h(q.formula)}</p>`:''}${examples.length?`<div class="en-practice-examples">${examples.map((w,i)=>`<button type="button" class="en-practice-example" data-action="en-training-audio" data-text="${h(w.word)}" data-key="example:${i}" aria-label="Послушать ${h(w.word)}"><span><b lang="en">${h(w.word)}</b><small>${h(w.ru)}</small></span>${icon('play','icon-sm')}</button>`).join('')}</div>`:''}`:`<header class="en-practice-heading"><p class="en-kicker">${h(q.section||names[ex.practiceKind])}</p><h2 class="en-prompt">${h(q.prompt)}</h2></header>${q.text?`<p class="en-practice-context">${h(q.text)}</p>`:''}${q.dialogue?`<p class="en-practice-context" lang="en">${h(q.dialogue)}</p>`:''}${q.preparation?`<p class="section-note">${h(q.preparation)}</p>`:''}`;
 if(q.clips?.length)body+=`<div class="en-practice-audio">${q.clips.map((c,i)=>ex.practiceKind==='media'?audioButton(c.audioText||c.word,'clip:'+i,q.clips.length>1?'Запись '+(i+1):'Послушать'):player(c.audioText||c.word,'clip:'+i,ex)).join('')}</div>${!supported(raw)?'<p class="section-note en-practice-listen-state">Сначала послушай запись</p>':''}`;
 if(q.kind==='choice'||q.kind==='decision')body+=`<div class="en-structured-options" data-long="${q.options.some(text=>text.length>32)}">${q.options.map((text,i)=>button(`<span class="en-choice-marker" aria-hidden="true">${raw.choice===i?icon('check','icon-sm'):''}</span><span>${h(text)}</span>`,'choice',`data-value="${i}" data-sid="${h(ex.sessionId)}" data-step="${h(q.id)}" aria-pressed="${raw.choice===i}" ${result?'disabled':''}`)).join('')}</div>${q.kind==='choice'&&!result?'<p class="section-note en-practice-choice-hint">Нажми выбранный вариант ещё раз, чтобы ответить</p>':''}`;
 if(q.kind==='gap'||q.kind==='write')body+=`${q.sentence?`<p class="en-en">${h(q.sentence)}</p>`:''}<label class="field"><span>Твой ответ</span><textarea name="answer" rows="${q.kind==='write'?3:2}" maxlength="2000" autocomplete="off" spellcheck="false" ${result?'readonly':''}>${h(ex.draft||'')}</textarea></label>${q.rubric?`<details class="en-practice-details"><summary>Критерии ответа</summary>${Array.isArray(q.rubric)?`<ul>${q.rubric.map(row=>`<li>${h(row)}</li>`).join('')}</ul>`:`<p>${h(q.rubric)}</p>`}</details>`:''}`;
 if(q.kind==='order')body+=`<div class="en-card en-structured-actions">${(raw.selection||[]).map(id=>button(h(q.parts.find(p=>p.id===id).text),'unpick',`data-id="${h(id)}" ${result?'disabled':''}`)).join('')||'<span class="muted">Нажимай части фразы по порядку</span>'}</div><div class="en-structured-actions">${q.parts.map(p=>button(h(p.text),'pick',`data-id="${h(p.id)}" ${result||raw.selection?.includes(p.id)?'disabled':''}`)).join('')}</div>`;
 if(q.kind==='match'){const mark=(side,id)=>{const at=raw.matches?.findIndex(pair=>pair[side]===id)??-1;return at>=0?`<span class="en-practice-pair" aria-label="Пара ${at+1}">${at+1}</span>`:'';};body+=`<div class="en-structured-match"><div>${q.pairs.map((p,i)=>button(`${mark('leftId',p.id)}<span>${q.audioMatch?'Запись '+(i+1):h(p.word)}</span>`,'left',`data-id="${h(p.id)}" aria-pressed="${raw.selectedLeft===p.id}" ${result?'disabled':''}`)).join('')}</div><div>${q.right.map(p=>button(`${mark('rightId',p.id)}<span>${h(q.audioMatch?p.word:p.ru)}</span>`,'right',`data-id="${h(p.id)}" ${result?'disabled':''}`)).join('')}</div></div><p class="section-note">Сопоставлено: ${raw.matches?.length||0} / ${q.pairs.length}</p>`;}
 if(q.kind==='speak')body+=`<details class="en-practice-details"><summary>На что обратить внимание</summary><ul>${q.rubric.map(x=>`<li>${h(x)}</li>`).join('')}</ul></details><p class="section-note">Самопроверка</p><div class="en-structured-options">${button('Рассказал','self',`data-value="ready" aria-pressed="${raw.selfcheck==='ready'}"`)}${button('Нужна практика','self',`data-value="need-practice" aria-pressed="${raw.selfcheck==='need-practice'}"`)}</div>`;
 if(!result&&(raw.assistance?.shown||raw.assistance?.transcript))body+=`<aside class="en-card"><p>${h(reference(q))}</p>${q.explain&&q.explain!==reference(q)?`<small>${h(q.explain)}</small>`:''}</aside>`;
 if(result)body+=`<section class="en-card" role="status" aria-live="polite"><b>${result.correct===null?'Сравни с образцом':result.correct?'Верно'+(raw.hinted||raw.assisted?' с поддержкой':''):'Разберём ответ'}</b>${result.expected?`<p class="en-en">${h(Array.isArray(result.expected)?q.kind==='order'?result.expected.map(id=>q.parts.find(p=>p.id===id)?.text).join(' '):'Сопоставь одинаковые значения':result.expected)}</p>`:''}${transcript(q,raw,result)}${q.explain?`<p>${h(q.explain)}</p>`:''}${result.correct===null&&!raw.selfcheck&&q.kind==='write'?button('Смысл передан','self','data-value="ready"')+button('Нужна практика','self','data-value="need-practice"'):''}</section>`;
 const ready=q.kind==='info'&&supported(raw)||q.kind==='decision'&&Number.isInteger(raw.choice)||q.kind==='speak'&&raw.selfcheck||result&&(result.correct!==null||raw.selfcheck);
 const helpAvailable=(q.kind!=='info'&&q.kind!=='speak'||q.clips?.length)&&!result||result&&q.clips?.length&&!raw.reviewTranscript&&!raw.assistance?.transcript&&!raw.assistance?.shown;
 const old=document.querySelector?.('.en-practice-workspace'),helpOpen=old?.dataset.session===ex.sessionId&&old?.dataset.step===q.id&&old.querySelector('[data-practice-help]')?.open;
 const help=helpAvailable?`<details class="en-practice-details en-practice-help" data-practice-help ${helpOpen?'open':''}><summary>Помощь</summary><div>${q.clips?.length===1?button('Медленнее','audio',`data-text="${h(q.clips[0].audioText||q.clips[0].word)}" data-key="clip:0" data-slow="true"`):''}${button(result?'Показать текст':'Открыть текст',result?'transcript':'hint')}</div></details>`:'';
 const controls=ready||q.kind==='info'?button(ex.index===ex.items.length-1?'Завершить':'Дальше','next',ready?'':'disabled',true):q.kind==='choice'||q.kind==='decision'||q.kind==='speak'?'':`<button class="primary-button" type="submit" ${!supported(raw)?'disabled':''}>Проверить</button>`;
 const vocab=result?terms(q).map((word,i)=>{const receipt=raw.wordSaves?.[i];return `<div class="en-practice-word"><span><b lang="en">${h(word.word)}</b><small>${h(word.ru)}</small></span><button type="button" class="icon-button" data-action="en-training-word" data-term="${i}" aria-label="${receipt?.ok?'В словаре':receipt==='pending'?'Сохраняется':`Добавить ${h(word.word)} в мои слова`}" ${receipt==='pending'||receipt?.ok?'disabled':''}>${icon(receipt?.ok?'check':'plus','icon-sm')}</button></div>`;}).join(''):'';
 return `<div class="en-run en-structured en-practice-workspace" data-session="${h(ex.sessionId)}" data-step="${h(q.id)}" data-task="${h(q.kind)}">${top}<form data-en-training-form>${body}<footer class="en-practice-footer"><div class="en-practice-primary">${controls}</div><div class="en-practice-secondary">${help}${(q.kind!=='info'||q.clips?.length)&&!result?button('Пропустить','skip'):''}</div></footer></form>${vocab?`<details class="en-practice-details en-practice-vocab"><summary>В мои слова</summary>${vocab}</details>`:''}</div>`;
};
window.enStructuredAck=function(ex,item,result){if(item.op==='practiceevent'&&item.args.event==='complete')ex.result=result;if(item.op==='practiceword'){const q=ex.items[item.args.index];if(q){q.wordSaves||={};q.wordSaves[item.args.term]=result;}}};
window.enStructuredAction=function(action,control){
 if(!action.startsWith('en-training-'))return false;const s=enState(),a=action.slice(12),d=control.dataset||{};
 if(a.startsWith('media-'))return window.FlowEnglishMediaPractice?.action(a.slice(6),control)??true;
 if(a.startsWith('lyrics-'))return window.FlowEnglishLyricsPractice?.action(a.slice(7),control)??true;
 if(a==='catalog'){s.tab='course';s.practiceView='structured:'+d.kind;render();return true;}
 if(a==='close'){stop();s.ex=null;s.tab='course';s.practiceView='hub';render();return true;}
 if(a==='start'){if(window.sorokaEnglishSession?.capabilities?.practiceEvents!==true)throw Error('practice_contract');stop();s.ex=core.create(d.kind,d.id,crypto.getRandomValues(new Uint32Array(1))[0]);s.ex.sessionId=crypto.randomUUID();s.deck=null;s.tab='course';render();return true;}
 const ex=task();if(!ex||ex.blockedReason||ex.contentRevision!==engine(ex)?.revision||ex.index>=ex.items.length)return true;const raw=ex.items[ex.index],q=step(ex);raw.assistance||={};
 if(a!=='choice')choiceTap=null;
 if(a==='heard'){if(d.sid!==ex.sessionId||Number(d.index)!==ex.index)return true;if(needs(q).includes(d.key)){raw.heard=[...new Set([...(raw.heard||[]),d.key])];render();}return true;}
 if(a==='audio'){const resume=audioRun?.sid===ex.sessionId&&audioRun.index===ex.index&&audioRun.key===d.key&&!audioRun.ended&&!audioRun.error&&audioRun.slow===(d.slow==='true');if(!raw.result&&!resume){raw.playCounts||={};raw.playCounts[d.key]=(raw.playCounts[d.key]||0)+1;raw.assistance.replays=Math.max(...Object.values(raw.playCounts));if(d.slow==='true')raw.assistance.slow=true;if(raw.assistance.replays>1||raw.assistance.slow)raw.assisted=true;}play(d.text,d.key,d.slow==='true',ex);return true;}
 if(a==='hint'){if(raw.result)raw.reviewTranscript=true;else{raw.hinted=true;raw.assistance.transcript=true;raw.assistance.shown=true;}render();return true;}
 if(a==='transcript'&&raw.result){raw.reviewTranscript=true;render();return true;}
 if(a==='choice'&&!raw.result){
  const value=Number(d.value);if(!Number.isInteger(value)||!q.options?.[value]||d.sid&&d.sid!==ex.sessionId||d.step&&d.step!==q.id)return true;
  const confirm=q.kind==='choice'&&supported(raw)&&choiceTap?.sid===ex.sessionId&&choiceTap.index===ex.index&&choiceTap.value===value&&raw.choice===value;
  raw.choice=value;choiceTap=supported(raw)?{sid:ex.sessionId,index:ex.index,value}:null;
  if(confirm){raw.result=engine(ex).check(q,value);raw.checkedAssistance=structuredClone(raw.assistance);raw.checkedHeard=[...(raw.heard||[])];raw.answer=value;choiceTap=null;}
  render();if(!confirm)effect(()=>{if(task()?.sessionId===ex.sessionId&&task()?.index===ex.index)document.querySelector?.(`.en-structured-options [data-value="${value}"]`)?.focus({preventScroll:true});});return true;
 }
 if(a==='pick'&&!raw.result){if(q.parts?.some(p=>p.id===d.id)&&!raw.selection?.includes(d.id))raw.selection=[...(raw.selection||[]),d.id];render();return true;}
 if(a==='unpick'&&!raw.result){raw.selection=(raw.selection||[]).filter(id=>id!==d.id);render();return true;}
 if(a==='left'&&!raw.result){raw.selectedLeft=d.id;if(q.audioMatch){const p=q.pairs.find(p=>p.id===d.id);if(p){const key='pair:'+p.id;raw.playCounts||={};raw.playCounts[key]=(raw.playCounts[key]||0)+1;raw.assistance.replays=Math.max(...Object.values(raw.playCounts));if(raw.assistance.replays>1)raw.assisted=true;play(p.word,key,false,ex);}}render();return true;}
 if(a==='right'&&!raw.result){if(raw.selectedLeft&&q.pairs.some(p=>p.id===raw.selectedLeft)&&q.right.some(p=>p.id===d.id))raw.matches=[...(raw.matches||[]).filter(p=>p.leftId!==raw.selectedLeft&&p.rightId!==d.id),{leftId:raw.selectedLeft,rightId:d.id}];raw.selectedLeft=null;render();return true;}
 if(a==='self'){raw.selfcheck=d.value==='ready'?'ready':'need-practice';if(q.kind==='speak')raw.result={correct:null,engine:'self-check',answer:raw.selfcheck};render();return true;}
 if(a==='submit'&&!raw.result){if(!supported(raw))return true;const value=q.kind==='choice'?raw.choice:q.kind==='order'?raw.selection||[]:q.kind==='match'?raw.matches||[]:control.elements?.answer?.value??ex.draft??'';raw.result=engine(ex).check(q,value);raw.checkedAssistance=structuredClone(raw.assistance);raw.checkedHeard=[...(raw.heard||[])];raw.answer=value;render();return true;}
 if(a==='word'){const term=Number(d.term);if(!Number.isInteger(term)||!terms(q)[term])return true;raw.wordSaves||={};if(raw.wordSaves[term]==='pending'||raw.wordSaves[term]?.ok)return true;if(!enRecord('practiceword',payload(ex,'word',null,{term})))throw Error('practice_word_save');raw.wordSaves[term]='pending';render();return true;}
 if(a==='next'||a==='skip'){
  if(a==='skip'){raw.skipped=true;raw.result={correct:false,engine:'skipped'};}
  else if(q.kind==='decision'){core.check(q,raw.choice);raw.result={correct:null,engine:'instruction',answer:raw.choice};}
  else if(q.kind==='info'){if(!supported(raw))return true;raw.result={correct:null,engine:'instruction',answer:null};}
  else if(!raw.result||raw.result.correct===null&&!raw.selfcheck)return true;
  const answer=q.kind==='decision'?raw.choice:q.kind==='speak'?raw.selfcheck:raw.answer??null;
  if(!enRecord('practiceevent',payload(ex,'answer',answer)))throw Error('practice_save');
  if(q.kind==='decision'&&!raw.skipped)ex.branch=raw.choice;
  ex.index++;ex.draft='';ex.answer=null;stop();
  if(ex.index===ex.items.length){if(!enRecord('practiceevent',payload(ex,'complete')))throw Error('practice_complete');ex.sent=true;}
  s.practiceProgress=null;render();return true;
 }
 return true;
};
document.addEventListener('submit',event=>{if(event.target.matches?.('[data-en-training-form]')){event.preventDefault();if(task()&&step(task()).kind==='choice')return;try{englishAction('en-training-submit',event.target);}catch{toast('Проверь ответ и попробуй ещё раз.');}}});
document.addEventListener('click',event=>{if(!event.target.closest?.('[data-action=en-training-choice]'))choiceTap=null;},{capture:true});
document.addEventListener('keydown',event=>{if(event.repeat&&['Enter',' '].includes(event.key)&&event.target.matches?.('[data-action=en-training-choice]'))event.preventDefault();});
document.addEventListener('input',event=>{const field=event.target,r=audioRun;if(!field.matches?.('[data-practice-seek]')||!r||!r.current()||field.dataset.key!==r.key)return;const value=Number(field.value),duration=r.audio.duration;if(!Number.isFinite(value)||!Number.isFinite(duration)||duration<=0)return;r.seek();r.audio.currentTime=Math.max(0,Math.min(duration,value));updatePlayers(r);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('pagehide',stop);
})();
