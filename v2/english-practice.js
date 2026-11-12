/* Native structured practice. Content, journal and shared vocabulary keep separate responsibilities. */
(()=>{'use strict';
const core=window.FlowEnglishPracticeCore;if(!core)return;
const names={mission:'Ситуации',sounds:'Звуки',story:'Истории',radio:'Аудирование',media:'Музыка и видео'};
const engine=ex=>ex.practiceKind==='media'?window.FlowEnglishMediaPracticeCore:core;
const h=value=>esc(String(value??'')),button=(label,action,attrs='',primary=false)=>`<button type="button" class="${primary?'primary-button':'ghost-button'}" data-action="en-training-${action}" ${attrs}>${label}</button>`;
let sound=null,generation=0;
function stop(){generation++;window.FlowEnglishMediaPractice?.stop();if(sound){sound.pause();sound.onended=null;sound.onerror=null;sound.ontimeupdate=null;sound=null;}}
const originalStop=window.enStopPcm;window.enStopPcm=function(...args){stop();return originalStop?.(...args);};
const task=()=>enState().ex?.mode==='structured'?enState().ex:null;
const step=ex=>engine(ex).resolve(ex.items[ex.index],ex.branch||0);
const needs=q=>q.audioMatch?(q.pairs||[]).map(p=>'pair:'+p.id):(q.clips||[]).map((_,i)=>'clip:'+i);
const supported=q=>!!q.assistance?.transcript||!!q.assistance?.shown||needs(q).every(key=>q.heard?.includes(key));
function terms(q){return[...(q.target?[q.target]:[]),...(q.pairs||[])].filter(x=>typeof x.word==='string'&&typeof x.ru==='string'&&x.word.length<=80&&x.ru.length<=300&&x.word.trim()&&x.ru.trim());}
function payload(ex,event,answer=null,extra={}){const q=ex.items[ex.index];return{sessionId:ex.sessionId,kind:ex.practiceKind,contentId:ex.contentId,revision:ex.contentRevision,seed:ex.seed,index:ex.index,event,answer,assistance:q?.checkedAssistance||q?.assistance||{},heard:q?.checkedHeard||q?.heard||[],skipped:!!q?.skipped,...extra};}
function transcript(q,raw,result){const text=q.clips?.map(c=>c.audioText||c.word).join(' / ');return text&&text!==result.expected&&(raw.assistance?.transcript||raw.assistance?.shown||raw.reviewTranscript)?`<p class="en-en" lang="en">${h(text)}</p>`:'';}
function effect(fn){if(!window.flowEnglishSession?.effect)throw Error('english_owner_not_ready');window.flowEnglishSession.effect(fn);}
function play(text,key,slow,ex){
 if(ex.practiceKind==='media'){effect(()=>window.FlowEnglishMediaPractice.play(ex,key,slow).catch(error=>toast(error.message)));return;}
 const asset=core.audio(text);if(!asset){toast('Запись недоступна. Можно пропустить задание.');return;}
 const session=window.sorokaEnglishSession,owner=session?.captureOwner(),sid=ex.sessionId,index=ex.index;
 effect(()=>{
  enStopPcm();const epoch=generation,a=new Audio(asset);sound=a;a.playbackRate=slow?.75:1;
  const current=()=>epoch===generation&&task()?.sessionId===sid&&task()?.index===index&&ui.page==='english'&&!document.hidden&&window.sorokaEnglishSession===session&&session?.isCurrent(owner);
  let anchor={time:0,at:Date.now()},ranges=[];
  a.ontimeupdate=()=>{if(!current()){stop();return;}const now=Date.now(),delta=a.currentTime-anchor.time,elapsed=(now-anchor.at)/1000;if(elapsed>0&&elapsed<=5&&delta>0&&delta<=elapsed*a.playbackRate*1.35+.25)ranges.push([anchor.time,a.currentTime]);anchor={time:a.currentTime,at:now};};
  a.onended=()=>{if(!current())return;ranges.sort((a,b)=>a[0]-b[0]);let covered=0,end=0;for(const[from,to]of ranges){covered+=Math.max(0,to-Math.max(from,end));end=Math.max(end,to);}sound=null;if(Number.isFinite(a.duration)&&a.duration>0&&covered>=a.duration*.9)englishAction('en-training-heard',{dataset:{sid,index:String(index),key}});else toast('Фрагмент прослушан не целиком. Повтори или открой текст.');};
  a.onerror=()=>{if(current())toast('Запись не загрузилась. Повтори или открой текст.');};
  a.play().catch(()=>{if(current())toast('Не удалось включить запись. Повтори нажатие.');});
 });
}
window.enStructuredCatalog=function(kind){
 const s=enState();if(!names[kind])return '';
 if(!s.practiceProgress&&!s.practiceProgressLoading&&!s.failedLoads?.practiceProgress)enLoad('practiceProgress','practiceprogress');
 const progress=s.practiceProgress?.items||[];
 return `<button class="icon-button ef-icon-control" data-action="en-practice-back" aria-label="Вся практика">${icon('left','icon-sm')}</button><h2>${names[kind]}</h2><div class="en-steps en-practice-list">${core.catalog().filter(x=>x.kind===kind).map(item=>{const completed=progress.filter(x=>x.completed&&x.descriptor?.kind===kind&&x.descriptor?.contentId===item.id).length;return `<button type="button" class="en-step" data-action="en-training-start" data-kind="${kind}" data-id="${h(item.id)}"><span class="en-step-ic">${icon(kind==='sounds'?'mic':kind==='story'?'book':'play','icon-sm')}</span><div><b>${h(item.title)}</b><small>${h(item.level)} · ${item.steps} шагов${completed?' · завершено':''}</small></div>${icon('arrow','icon-sm')}</button>`;}).join('')}</div>`;
};
window.enStructuredScreen=function(ex){
 if(ex.blockedReason||ex.contentRevision!==engine(ex)?.revision)return `<section class="en-run"><h2>Материал обновился</h2><p>Прежние ответы сохранены на устройстве для проверки. Можно выбрать другое занятие.</p>${button('К практике','close')}</section>`;
 if(ex.index>=ex.items.length){const summary=ex.result?.summary||core.summary(ex.items),saved=ex.result?.completed;return `<section class="en-run en-done"><h2>${saved?'Занятие завершено':'Ответы сохранены на устройстве'}</h2><p>${h(ex.title)}</p><p>Самостоятельно: ${summary.independent||0}${summary.aided?' · с поддержкой: '+summary.aided:''}${summary.selfcheck?' · самопроверка: '+summary.selfcheck:''}${summary.skipped?' · пропущено: '+summary.skipped:''}</p>${!saved?'<p class="section-note" role="status">Ждём подтверждения сохранения результата.</p>':''}${button('К практике','close','',true)}${ex.sourceMeta?.songId?button('К песне','media-return'):''}</section>`;}
 const q=step(ex),raw=ex.items[ex.index],result=raw.result,parts=q.kind==='info'&&q.phonetics?q.examples.flat():null;
 const top=`<div class="en-run-top"><button class="icon-button" data-action="en-ex-quit" aria-label="Закончить">${icon('close','icon-sm')}</button><div class="en-bar"><i style="width:${Math.round(ex.index/ex.items.length*100)}%"></i></div><small>${ex.index+1}/${ex.items.length}</small></div><p class="en-kicker">${h(q.section||names[ex.practiceKind])}</p>`;
 const audioButton=(text,key,label='Послушать')=>button(`${icon('play','icon-sm')}${h(label)}`,'audio',`data-text="${h(text)}" data-key="${h(key)}"`);
 let body=q.kind==='info'?`<h2 class="en-prompt">${h(q.title||ex.title)}</h2><p>${h(q.prompt)}</p>${q.formula?`<p class="en-en">${h(q.formula)}</p>`:''}${parts?parts.map((w,i)=>`<div class="en-example"><div><b>${h(w.word)}</b><small>${h(w.ru)}</small></div>${audioButton(w.word,'example:'+i)}</div>`).join(''):(q.examples||[]).map(([en,ru],i)=>`<div class="en-example"><div><b>${h(en)}</b><small>${h(ru)}</small></div>${audioButton(en,'example:'+i)}</div>`).join('')}`:`${q.text?`<p class="en-card">${h(q.text)}</p>`:''}${q.dialogue?`<p class="en-en">${h(q.dialogue)}</p>`:''}${q.preparation?`<p class="section-note">${h(q.preparation)}</p>`:''}<h2 class="en-prompt">${h(q.prompt)}</h2>`;
 if(q.clips?.length)body+=`<div class="en-structured-actions">${q.clips.map((c,i)=>audioButton(c.audioText||c.word,'clip:'+i,q.clips.length>1?'Запись '+(i+1):'Послушать')).join('')}${q.clips.length===1?button('Медленнее','audio',`data-text="${h(q.clips[0].audioText||q.clips[0].word)}" data-key="clip:0" data-slow="true"`):''}</div><p class="section-note">${supported(raw)?'Можно ответить':'Прослушай фрагмент или открой текст'}</p>`;
 if(q.kind==='choice'||q.kind==='decision')body+=`<div class="en-structured-options">${q.options.map((text,i)=>button(h(text),'choice',`data-value="${i}" aria-pressed="${raw.choice===i}" ${result?'disabled':''}`)).join('')}</div>`;
 if(q.kind==='gap'||q.kind==='write')body+=`${q.sentence?`<p class="en-en">${h(q.sentence)}</p>`:''}<label class="field"><span>Твой ответ</span><textarea name="answer" rows="${q.kind==='write'?3:2}" maxlength="2000" autocomplete="off" spellcheck="false" ${result?'readonly':''}>${h(ex.draft||'')}</textarea></label>${q.rubric?`<p class="section-note">${h(q.rubric)}</p>`:''}`;
 if(q.kind==='order')body+=`<div class="en-card en-structured-actions">${(raw.selection||[]).map(id=>button(h(q.parts.find(p=>p.id===id).text),'unpick',`data-id="${h(id)}" ${result?'disabled':''}`)).join('')||'<span class="muted">Нажимай части фразы по порядку</span>'}</div><div class="en-structured-actions">${q.parts.map(p=>button(h(p.text),'pick',`data-id="${h(p.id)}" ${result||raw.selection?.includes(p.id)?'disabled':''}`)).join('')}</div>`;
 if(q.kind==='match')body+=`<div class="en-structured-match"><div>${q.pairs.map((p,i)=>button(q.audioMatch?'Запись '+(i+1):h(p.word),'left',`data-id="${h(p.id)}" aria-pressed="${raw.selectedLeft===p.id}" ${result?'disabled':''}`)).join('')}</div><div>${q.right.map(p=>button(h(q.audioMatch?p.word:p.ru),'right',`data-id="${h(p.id)}" ${result?'disabled':''}`)).join('')}</div></div><p class="section-note">Сопоставлено: ${raw.matches?.length||0} / ${q.pairs.length}</p>`;
 if(q.kind==='speak')body+=`<ul>${q.rubric.map(x=>`<li>${h(x)}</li>`).join('')}</ul><p class="section-note">Проверка по себе, без автоматической оценки произношения.</p>${button('Рассказал','self','data-value="ready"')}${button('Нужна практика','self','data-value="need-practice"')}`;
 if(!result&&(raw.assistance?.shown||raw.assistance?.transcript))body+=`<aside class="en-card"><p>${h(q.clips?.map(c=>c.audioText||c.word).join(' / ')||q.expected||q.explain||q.pairs?.map(p=>p.word+' — '+p.ru).join('; ')||'Сравни ответ с образцом.')}</p>${q.explain?`<small>${h(q.explain)}</small>`:''}</aside>`;
 if(result)body+=`<section class="en-card" role="status" aria-live="polite"><b>${result.correct===null?'Сравни с образцом':result.correct?'Верно'+(raw.hinted||raw.assisted?' с поддержкой':''):'Разберём ответ'}</b>${result.expected?`<p class="en-en">${h(Array.isArray(result.expected)?q.kind==='order'?result.expected.map(id=>q.parts.find(p=>p.id===id)?.text).join(' '):'Сопоставь одинаковые значения':result.expected)}</p>`:''}${transcript(q,raw,result)}${q.explain?`<p>${h(q.explain)}</p>`:''}${result.correct===null&&!raw.selfcheck&&q.kind==='write'?button('Смысл передан','self','data-value="ready"')+button('Нужна практика','self','data-value="need-practice"'):''}</section>`;
 const ready=q.kind==='info'&&supported(raw)||q.kind==='decision'&&Number.isInteger(raw.choice)||q.kind==='speak'&&raw.selfcheck||result&&(result.correct!==null||raw.selfcheck);
 if(result&&q.clips?.length&&!raw.reviewTranscript&&!raw.assistance?.transcript&&!raw.assistance?.shown)body+=button('Показать текст','transcript');
 const controls=ready||q.kind==='info'?button(ex.index===ex.items.length-1?'Завершить':'Дальше','next',ready?'':'disabled',true):q.kind==='decision'||q.kind==='speak'?'':`<button class="primary-button" type="submit" ${!supported(raw)?'disabled':''}>Проверить</button>`;
 const vocab=result?terms(q).map((word,i)=>{const receipt=raw.wordSaves?.[i];return button(receipt?.ok?'В словаре':receipt==='pending'?'Сохраняется…':h(word.word)+' — в мои слова','word',`data-term="${i}" ${receipt==='pending'||receipt?.ok?'disabled':''}`);}).join(''):'';
 return `<div class="en-run en-structured">${top}<form data-en-training-form>${body}<div class="en-structured-actions">${controls}${(q.kind!=='info'||q.clips?.length)&&!result?button('Открыть текст','hint'):''}${(q.kind!=='info'||q.clips?.length)&&!result?button('Пропустить','skip'):''}</div></form>${vocab?`<div class="en-structured-actions">${vocab}</div>`:''}</div>`;
};
window.enStructuredAck=function(ex,item,result){if(item.op==='practiceevent'&&item.args.event==='complete')ex.result=result;if(item.op==='practiceword'){const q=ex.items[item.args.index];if(q){q.wordSaves||={};q.wordSaves[item.args.term]=result;}}};
window.enStructuredAction=function(action,control){
 if(!action.startsWith('en-training-'))return false;const s=enState(),a=action.slice(12),d=control.dataset||{};
 if(a.startsWith('media-'))return window.FlowEnglishMediaPractice?.action(a.slice(6),control)??true;
 if(a==='catalog'){s.tab='course';s.practiceView='structured:'+d.kind;render();return true;}
 if(a==='close'){stop();s.ex=null;s.tab='course';s.practiceView='hub';render();return true;}
 if(a==='start'){if(window.sorokaEnglishSession?.capabilities?.practiceEvents!==true)throw Error('practice_contract');stop();s.ex=core.create(d.kind,d.id,crypto.getRandomValues(new Uint32Array(1))[0]);s.ex.sessionId=crypto.randomUUID();s.deck=null;s.tab='course';render();return true;}
 const ex=task();if(!ex||ex.blockedReason||ex.contentRevision!==engine(ex)?.revision||ex.index>=ex.items.length)return true;const raw=ex.items[ex.index],q=step(ex);raw.assistance||={};
 if(a==='heard'){if(d.sid!==ex.sessionId||Number(d.index)!==ex.index)return true;if(needs(q).includes(d.key)){raw.heard=[...new Set([...(raw.heard||[]),d.key])];render();}return true;}
 if(a==='audio'){if(!raw.result){raw.playCounts||={};raw.playCounts[d.key]=(raw.playCounts[d.key]||0)+1;raw.assistance.replays=Math.max(...Object.values(raw.playCounts));if(d.slow==='true')raw.assistance.slow=true;if(raw.assistance.replays>1||raw.assistance.slow)raw.assisted=true;}play(d.text,d.key,d.slow==='true',ex);return true;}
 if(a==='hint'){if(raw.result)raw.reviewTranscript=true;else{raw.hinted=true;raw.assistance.transcript=true;raw.assistance.shown=true;}render();return true;}
 if(a==='transcript'&&raw.result){raw.reviewTranscript=true;render();return true;}
 if(a==='choice'&&!raw.result){raw.choice=Number(d.value);render();return true;}
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
document.addEventListener('submit',event=>{if(event.target.matches?.('[data-en-training-form]')){event.preventDefault();try{englishAction('en-training-submit',event.target);}catch{toast('Проверь ответ и попробуй ещё раз.');}}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('pagehide',stop);
})();
