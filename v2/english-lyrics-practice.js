/* Sequential lyrics typing. The native English journal owns answers and receipts. */
(()=>{'use strict';
const core=()=>window.FlowEnglishLyricsPracticeCore?.forRevision(enState().ex?.contentRevision)||window.FlowEnglishLyricsPracticeCore;
const owns=ex=>ex?.practiceKind==='media'&&!!window.FlowEnglishLyricsPracticeCore?.forRevision(ex.contentRevision);
const terms=q=>q?.target?[q.target]:[];
const translation=(ex,q)=>q?ex.sourceMeta.lines[q.sourceLine]?.ru||'':'';
const h=value=>esc(String(value??''));
let run=null,primed=null,epoch=0;
const exNow=()=>{const ex=enState().ex;return owns(ex)?ex:null;};
const answerSelector='.en-lyrics-input input[type="text"]';
const answerInput=node=>node.querySelector(answerSelector);
const pauseIcon='<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>';
const label=(name,title)=>`<button type="button" class="icon-button ef-icon-control" data-lyrics="${name}" aria-label="${title}" title="${title}">${icon(name==='back'?'left':name==='play'?'play':name==='replay'?'reset':name==='hint'?'eye':name==='skip'?'arrow':'book','icon-sm')}</button>`;
const valid=r=>run===r&&ui.page==='english'&&exNow()?.sessionId===r.sid&&!exNow()?.blockedReason&&window.sorokaEnglishSession===r.host&&r.host.isCurrent(r.owner);
function cancelPrepared(ticket=primed,notify=true){if(!ticket||ticket!==primed)return;primed=null;ticket.node.remove();if(notify)ticket.onCancel?.();if(ticket.focus?.isConnected)ticket.focus.focus({preventScroll:true});}
function inputPrepared(ticket){return !!ticket&&primed===ticket&&ticket.node.isConnected&&window.sorokaEnglishSession===ticket.host&&ticket.host.isCurrent(ticket.owner);}
function keepPreparedDuring(callback){const ticket=primed;primed=null;try{return callback();}finally{if(ticket?.node.isConnected){if(!primed&&window.sorokaEnglishSession===ticket.host&&ticket.host.isCurrent(ticket.owner))primed=ticket;else ticket.node.remove();}}}
function prepareInput(){
 if(inputPrepared(primed))return primed;
 cancelPrepared();const host=window.sorokaEnglishSession,owner=host?.captureOwner();if(!owner?.authorized||!host.isCurrent(owner))return null;
 const node=document.createElement('section');node.className='en-lyrics en-page';node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');node.setAttribute('aria-label','Практика по песне');
 node.innerHTML=`<div data-lyrics-wait class="en-lyrics-wait"><button type="button" class="icon-button" aria-label="Отменить подготовку">${icon('left','icon-sm')}</button><p role="status">Готовим упражнение…</p></div><label class="field en-lyrics-input"><span class="en-lyrics-sr">Впиши пропущенное слово</span><input type="text" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="next" aria-label="Пропущенное слово" maxlength="200"></label>`;
 const ticket={node,host,owner,focus:document.activeElement,viewportHeight:Math.max(innerHeight,window.visualViewport?.height||0)};primed=ticket;document.body.append(node);
 node.addEventListener('compositionstart',()=>{if(primed===ticket)ticket.composing=true;});
 node.addEventListener('compositionend',()=>{if(primed===ticket)ticket.composing=false;});
 node.querySelector('[data-lyrics-wait] button').onclick=()=>cancelPrepared(ticket);
 node.addEventListener('keydown',e=>{if(primed===ticket&&e.key==='Escape'){e.preventDefault();cancelPrepared(ticket);}});
 // This focus runs in the song-selection gesture, before any network await.
 answerInput(node).focus({preventScroll:true});return ticket;
}
function stop(){epoch++;cancelPrepared();if(!run)return;const r=run;run=null;clearTimeout(r.next);cancelAnimationFrame(r.compositionFrame);r.viewportCleanup?.();r.media.pause();r.media.dispose();if(r.url)URL.revokeObjectURL(r.url);r.observer?.disconnect();r.node.remove();const app=document.getElementById('app');if(app)app.inert=r.previousInert;if(r.focus?.isConnected)r.focus.focus({preventScroll:true});}
function viewport(r){
 const v=window.visualViewport;let frame=0;r.maxViewport=Math.max(r.initialViewport||0,innerHeight,v?.height||0);
 const update=()=>{frame=0;if(!valid(r))return;const height=Math.min(innerHeight,v?.height||innerHeight);r.maxViewport=Math.max(r.maxViewport,height);r.node.style.setProperty('--lyrics-height',height+'px');r.node.style.setProperty('--lyrics-top',(v?.offsetTop||0)+'px');r.node.dataset.keyboard=String(r.maxViewport-height>120);};
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};v?.addEventListener('resize',schedule);v?.addEventListener('scroll',schedule);window.addEventListener('resize',schedule);update();
 r.viewportCleanup=()=>{cancelAnimationFrame(frame);v?.removeEventListener('resize',schedule);v?.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);};
}
function dispatch(name,extra={}){return englishAction('en-training-lyrics-'+name,{dataset:{},...extra});}
function payload(ex,index,event,extra={}){const q=ex.items[index];return{sessionId:ex.sessionId,kind:'media',contentId:ex.contentId,revision:ex.contentRevision,seed:ex.seed,index,event,answer:q?.answers||[],assistance:q?.assistance||{},heard:q?.heard||[],skipped:!!q?.skipped,...extra};}
function active(ex){return ex?.items[ex.index];}
function answered(q){return q?.kind==='info'||q?.answers?.length===q?.gaps?.length;}
function heard(q){return q?.heard?.includes('clip:0');}
const effect=fn=>window.flowEnglishSession.effect(fn);
function lineMarkup(q){
 if(!q)return'';let at=0,out='';const cursor=q.answers?.length||0;
 for(let i=0;i<(q.gaps||[]).length;i++){
  const gap=q.gaps[i];out+=h(q.en.slice(at,gap.start));const solved=i<cursor,typing=i===cursor,typed=typing?q.typed||'':'';
  out+=`<span class="en-lyrics-gap ${solved?'is-correct':typing?'is-active':''} ${typing&&typed&&!norm(gap.text).startsWith(norm(typed))?'is-error':''}" ${typing?'aria-current="true"':''}>${solved?h(q.answers[i]):h(typed)+`<span class="en-lyrics-dots">${'·'.repeat(Math.max(0,gap.text.length-typed.length))}</span>`}</span>`;at=gap.end;
 }
 return out+h(q.en.slice(at));
}
function norm(text){return String(text||'').normalize('NFKC').replace(/[’‘]/g,"'").trim().toLowerCase();}
function reviewWords(ex){
 const seen=new Set(),words=[];for(const [index,row]of (ex.items||[]).entries())for(const gap of row.gaps||[]){const key=norm(gap.text);if(!key||seen.has(key))continue;seen.add(key);words.push({key,word:gap.text,index,en:row.en,ru:translation(ex,row),state:row.vocabWords?.[key]||{}});}return words;
}
function paintWords(r,ex){
 const box=r.node.querySelector('[data-lyrics-vocab]'),done=!active(ex);box.hidden=!done;r.node.dataset.review=String(done);r.node.querySelector('header [data-lyrics=translation]').hidden=done;if(!done)return;
 const words=reviewWords(ex);r.vocabAt=Math.max(0,Math.min(r.vocabAt||0,words.length-1));const item=words[r.vocabAt],state=item?.state||{},stamp=JSON.stringify([r.vocabAt,words.length,state,!!ex.result?.completed]);
 if(r.vocabStamp!==stamp){const focused=document.activeElement?.dataset.lyrics,open=r.vocabKey===item?.key&&box.querySelector('.en-lyrics-word-context')?.open;r.vocabStamp=stamp;r.vocabKey=item?.key;
  box.innerHTML=item?`<p class="en-lyrics-vocab-label">Слова из пропусков</p><p class="en-lyrics-result-note" role="status">${ex.result?.completed?'Упражнение сохранено':'Ответы сохранены на устройстве'}</p><article class="en-lyrics-word-card"><h3 tabindex="-1" lang="en">${h(item.word)}</h3>${state.data?.ru?`<p class="en-lyrics-word-ru" lang="ru">${h(state.data.ru)}</p>`:''}<p class="en-lyrics-word-state" role="status" aria-live="polite">${state.saved?(state.receipt?.deck?'На изучении':'Добавлено'):state.saving?'Сохраняется…':state.lookup==='loading'?'Ищем перевод…':state.error||''}</p><details class="en-lyrics-word-context" ${open?'open':''}><summary>Строка из фрагмента</summary><p lang="en">${h(item.en)}</p>${item.ru?`<p lang="ru">${h(item.ru)}</p>`:''}</details><button type="button" class="primary-button" data-lyrics="vocab-add" ${state.saved||state.saving||state.lookup==='loading'?'disabled':''}>${state.saved?'Добавлено':state.saving?'Сохраняется…':'В мои слова'}</button></article><nav class="en-lyrics-word-nav" aria-label="Слова из упражнения"><button type="button" class="icon-button" data-lyrics="vocab-prev" aria-label="Предыдущее слово" ${r.vocabAt===0?'disabled':''}>${icon('left','icon-sm')}</button><span>${r.vocabAt+1} / ${words.length}</span><button type="button" class="icon-button" data-lyrics="vocab-next" aria-label="Следующее слово" ${r.vocabAt===words.length-1?'disabled':''}>${icon('arrow','icon-sm')}</button></nav>`:'<p>В этом фрагменте не было слов-пропусков.</p>';
  if(focused?.startsWith('vocab-'))(box.querySelector(`[data-lyrics="${focused}"]:not(:disabled)`)||box.querySelector('h3'))?.focus({preventScroll:true});
 }
 if(!r.reviewShown){r.reviewShown=true;box.querySelector('h3')?.focus({preventScroll:true});}
 if(item&&ex.sourceMeta.songId&&!state.lookup&&!state.saved&&!state.saving){queueMicrotask(()=>{if(valid(r))dispatch('vocab-load',{index:item.index,key:item.key});});}
}
function vocabAction(name,control,ex){
 const r=run;if(!r||!valid(r)||active(ex))return true;
 if(name==='vocab-prev'||name==='vocab-next'){r.vocabAt=(r.vocabAt||0)+(name==='vocab-next'?1:-1);paint(r);return true;}
 if(name==='vocab-reset'){for(const row of ex.items)for(const state of Object.values(row.vocabWords||{})){state.saving=false;if(state.lookup==='loading')delete state.lookup;}return true;}
 const item=name==='vocab-add'?reviewWords(ex)[r.vocabAt||0]:reviewWords(ex).find(word=>word.index===control.index&&word.key===control.key);if(!item)return true;
 const row=ex.items[item.index];row.vocabWords||={};const state=row.vocabWords[item.key]||={};
 if(name==='vocab-result'){if(control.mode==='lookup'){state.lookup=control.error?'error':'ready';if(control.data)state.data=control.data;}else{state.saving=false;if(control.data){state.saved=true;state.receipt={deck:control.data.deck??null,saved:control.data.saved??null};state.data={...state.data,...(control.data.ru?{ru:String(control.data.ru).slice(0,300)}:{})};const s=enState();s.words=null;s.wordlist=null;s.list=null;s.today=null;s.progress=null;}}state.error=control.error?'Не удалось связаться с Flow. Попробуй ещё раз.':'';effect(()=>{if(valid(r))paint(r);});return true;}
 if(name==='vocab-load'){
  if(state.lookup||state.saved||!ex.sourceMeta.songId)return true;state.lookup='loading';
  effect(()=>{if(!valid(r))return;paint(r);r.host.send('songlookup',{id:ex.sourceMeta.songId,word:item.word,sentence:item.en},r.owner).then(data=>{if(!data?.ru||data.error)throw Error('lookup_failed');if(valid(r))dispatch('vocab-result',{index:item.index,key:item.key,mode:'lookup',data:{ru:String(data.ru).slice(0,300),lemma:String(data.lemma||item.word).slice(0,80)}});}).catch(()=>{if(valid(r))dispatch('vocab-result',{index:item.index,key:item.key,mode:'lookup',error:true});});});return true;
 }
 if(name==='vocab-add'){
  if(state.saved||state.saving||state.lookup==='loading')return true;state.saving=true;state.error='';
  effect(()=>{if(!valid(r))return;paint(r);const op=state.data?.ru?'songlearn':'word',args={word:item.word,sentence:item.en,...(state.data?.ru?{ru:state.data.ru,lemma:state.data.lemma||item.word}:{})};r.host.send(op,args,r.owner).then(data=>{if(data?.error||!data?.saved&&!data?.deck)throw Error('word_save_failed');if(valid(r))dispatch('vocab-result',{index:item.index,key:item.key,mode:'save',data});}).catch(()=>{if(valid(r))dispatch('vocab-result',{index:item.index,key:item.key,mode:'save',error:true});});});return true;
 }
 return true;
}
function composingInput(r,full){
 const consumed=r.compositionConsumed||'';
 const hasPrefix=consumed&&norm(full.slice(0,consumed.length))===norm(consumed);
 r.compositionValue=(hasPrefix?full.slice(consumed.length):full).replace(/^\s+/,'');
 if(consumed&&!hasPrefix)r.compositionConsumed='';
 const q=active(exNow()),expected=q?.gaps?.[q.answers?.length||0]?.text;
 if(expected&&norm(r.compositionValue)===norm(expected)){
  // Accept the visible word immediately, but leave the IME's native buffer intact.
  dispatch('input',{value:r.compositionValue});r.compositionConsumed=full;r.compositionValue='';
 }
}
function paint(r){
 if(!valid(r)){if(run===r)stop();return;}const ex=exNow(),q=active(ex),done=!q;
 r.node.querySelector('[data-lyrics-count]').textContent=`${Math.min(ex.index+1,ex.items.length)} / ${ex.items.length}`;
 r.node.querySelector('progress').value=ex.index;r.node.querySelector('progress').max=ex.items.length;
 const line=r.node.querySelector('[data-lyrics-line]');line.innerHTML=done?'Готово':lineMarkup(r.composing||r.compositionPending?{...q,typed:r.compositionValue}:q);
 r.node.querySelector('[data-lyrics-translation]').textContent=done?'':q.showTranslation?translation(ex,q)||'Перевод не добавлен':'';
 const input=answerInput(r.node);input.disabled=done;if(!r.composing&&!r.compositionPending&&input.value!==(q?.typed||''))input.value=q?.typed||'';
 input.setAttribute('aria-label',done?'Упражнение завершено':answered(q)?'Строка заполнена':`Пропущенное слово ${(q?.answers?.length||0)+1} из ${q?.gaps?.length||0}`);
 const status=r.node.querySelector('[data-lyrics-status]');
 status.textContent=r.mediaProblem||(done?(ex.result?.completed?'Сохранено · самостоятельно '+(ex.result.summary?.independent||0)+' · с поддержкой '+(ex.result.summary?.aided||0):'Ответы сохранены на устройстве'):(q.typed&&!norm(q.gaps?.[q.answers?.length||0]?.text).startsWith(norm(q.typed))?'Исправь слово':answered(q)&&!heard(q)?'Дослушай строку':r.atEnd?'Впиши оставшиеся слова':''));
 const play=r.node.querySelector('[data-lyrics="play"]');play.innerHTML=r.media.paused?icon('play','icon-sm'):pauseIcon;play.setAttribute('aria-label',r.media.paused?'Слушать строку':'Пауза');
 r.node.querySelector('[data-lyrics="translation"]').setAttribute('aria-pressed',String(!!q?.showTranslation));
 for(const name of ['play','replay','hint','skip','translation'])r.node.querySelector(`[data-lyrics="${name}"]`).disabled=done;
 const history=r.node.querySelector('[data-lyrics-history]'),past=ex.items.slice(0,ex.index),historyStamp=JSON.stringify(past.map(row=>[row.id,row.skipped,row.assistance,row.wordSaves]));
 if(r.historyStamp!==historyStamp){const open=[...history.querySelectorAll('details')].map(n=>n.open);history.innerHTML=past.map((row,index)=>`<details ${open[index]?'open':''}><summary><span lang="en">${h(row.en)}</span><small>${row.skipped?'Пропущено':row.assistance?.hint||row.assistance?.shown||row.assistance?.transcript||row.assistance?.slow||row.assistance?.replays>1?'С поддержкой':'Самостоятельно'}</small></summary><p>${h(translation(ex,row))}</p>${terms(row).map((word,term)=>`<button type="button" class="ghost-button" data-lyrics-word="${index}" data-term="${term}" ${row.wordSaves?.[term]?'disabled':''}>${row.wordSaves?.[term]?.ok?'В словаре':row.wordSaves?.[term]?'Сохраняется…':'В мои слова'}</button>`).join('')}</details>`).join('');r.historyStamp=historyStamp;}
 r.node.querySelector('[data-lyrics-history-wrap]').hidden=!ex.index;
 r.node.querySelector('[data-lyrics-finish]').hidden=!done;
 paintWords(r,ex);
 schedule(r);
}
function schedule(r){
 clearTimeout(r.next);const ex=exNow(),q=active(ex);if(!valid(r)||!r.started||!r.atEnd||r.nextBlocked||document.hidden||!q||!answered(q)||!heard(q))return;
 const index=ex.index;r.next=setTimeout(()=>{if(valid(r)&&!document.hidden&&exNow().index===index&&dispatch('next')===false)r.nextBlocked=true;},380);
}
function seek(r,time){r.anchor=null;r.lastTime=null;r.seeking={target:time,at:performance.now()};r.media.currentTime=time;}
function selectLine(r){
 const ex=exNow(),q=active(ex);if(!q){r.media.pause();paint(r);return;}
 if(r.index===ex.index){paint(r);return;}
 if(r.index>=0){cancelAnimationFrame(r.compositionFrame);r.composing=false;r.compositionPending=false;r.compositionValue='';r.compositionConsumed='';}
 r.index=ex.index;r.lineStarted=false;r.ranges=[];r.anchor=null;r.lastTime=null;r.atEnd=false;r.counted=false;
 if(q.showTranslation===undefined){const previous=ex.items.slice(0,ex.index).reverse().find(row=>typeof row.showTranslation==='boolean');dispatch('translation-init',{value:previous?.showTranslation??true});}
 const clip=q.playbackClip||q.clips[0];r.clip=clip;if(r.initialized)seek(r,clip.start);paint(r);
}
function covered(r){return window.FlowEnglishMediaPractice.tools.coverage(r.ranges,r.clip.start,r.clip.end)>=.9*(r.clip.end-r.clip.start);}
function tick(r){
 if(!valid(r)){if(run===r)stop();return;}if(document.hidden)return;
 const t=r.media.currentTime,now=performance.now();
 if(r.seeking){
  const arrived=t>=r.seeking.target-.05&&t<=r.seeking.target+1;
  if(!arrived&&now-r.seeking.at<6000){r.anchor=null;return;}
  r.seeking=null;r.anchor=null;r.lastTime=null;
 }
 const last=r.anchor;
 if(r.lastTime!==null&&t<r.lastTime-.25)dispatch('support');r.lastTime=t;
 // The clock may report PAUSED/ENDED before its final timeupdate. An anchor
 // exists only for an interval which began playing; consume its real tail once.
 if(last){const elapsed=(now-last.at)/1000,delta=t-last.time;if(elapsed>0&&elapsed<=3&&delta>0&&delta<=elapsed*r.media.playbackRate*1.35+.15)r.ranges.push([last.time,t]);}
 r.anchor=r.media.paused?null:{time:t,at:now};
 if(covered(r)&&!r.counted)r.counted=dispatch('heard')!==false;
 if(t>=r.clip.end){r.atEnd=true;if(!r.media.paused)r.media.pause();paint(r);}else if(t<r.clip.start-.3){seek(r,r.clip.start);r.media.pause();}
}
function mount(ex){
 if(!owns(ex)||ex.blockedReason||ui.page!=='english')return;
 if(run?.sid===ex.sessionId){selectLine(run);return;}
 const ticket=inputPrepared(primed)?primed:null;if(!ticket)cancelPrepared(undefined,false);primed=null;stop();const host=window.sorokaEnglishSession,owner=host?.captureOwner();if(!owner?.authorized||!host.isCurrent(owner)){ticket?.node.remove();return;}
 const prepared=ticket||prepareInput(),node=prepared?.node;if(!node)return;primed=null;node.querySelector('[data-lyrics-wait]')?.remove();
 node.insertAdjacentHTML('beforeend',`<div class="en-lyrics-wrap"><header>${label('back','Вся практика')}<div><h2>${h(ex.title)}</h2><small>${h(ex.sourceMeta.artist||'')}</small></div><button type="button" class="icon-button ef-icon-control" data-lyrics="translation" aria-label="Перевод" aria-pressed="false">EN/RU</button></header><div class="en-lyrics-video"><video playsinline preload="metadata" disablepictureinpicture></video><div data-lyrics-youtube></div></div><div class="en-lyrics-toolbar"><div class="en-lyrics-progress"><span data-lyrics-count></span><progress value="0" max="1" aria-label="Строки"></progress></div><nav aria-label="Управление строкой">${label('replay','Повторить строку')}${label('play','Слушать строку')}${label('hint','Раскрыть слово')}${label('skip','Пропустить строку')}</nav></div><div class="en-lyrics-task"><p data-lyrics-line lang="en" class="en-lyrics-line"></p><p data-lyrics-translation class="en-lyrics-translation" lang="ru"></p><p data-lyrics-status role="status" aria-live="polite"></p></div><details data-lyrics-history-wrap hidden class="en-lyrics-history"><summary>Пройденные строки</summary><div data-lyrics-history></div></details><button type="button" class="primary-button" data-lyrics-finish hidden data-lyrics="back">К практике</button></div>`);
 node.querySelector('[data-lyrics-finish]').insertAdjacentHTML('beforebegin','<section class="en-lyrics-vocab" data-lyrics-vocab hidden aria-label="Слова из упражнения"></section>');
 const app=document.getElementById('app'),buffer=answerInput(node).value,r={node,host,owner,sid:ex.sessionId,focus:prepared.focus,initialViewport:prepared.viewportHeight,previousInert:app.inert,media:new FlowSongMedia(node.querySelector('video'),{controls:false,autoplay:ex.autoPlay===true}),clip:ex.items.at(-1)?.playbackClip||ex.items.at(-1)?.clips?.[0],index:-1,initialized:false,ranges:[],anchor:null,atEnd:false,counted:false,supported:new Set(),composing:!!prepared.composing,compositionValue:buffer,compositionIndex:ex.index};run=r;app.inert=true;viewport(r);if(!active(ex))dispatch('vocab-reset');selectLine(r);if(buffer){if(r.composing)composingInput(r,buffer);else dispatch('input',{value:buffer});paint(r);}
 node.addEventListener('input',e=>{if(!valid(r)||!e.target.matches(answerSelector))return;if(e.isComposing||r.composing||r.compositionPending){if(e.isComposing&&!r.composing){r.composing=true;r.compositionIndex=exNow().index;}composingInput(r,e.target.value);paint(r);return;}dispatch('input',{value:e.target.value});paint(r);});
 node.addEventListener('beforeinput',e=>{if(valid(r)&&e.target.matches(answerSelector)&&answered(active(exNow())))e.preventDefault();});
 node.addEventListener('compositionstart',e=>{if(!valid(r)||!e.target.matches(answerSelector))return;cancelAnimationFrame(r.compositionFrame);r.composing=true;r.compositionPending=false;r.compositionIndex=exNow().index;r.compositionConsumed='';r.compositionValue=e.target.value;});
 node.addEventListener('compositionend',e=>{if(!valid(r)||!e.target.matches(answerSelector))return;if(r.compositionIndex!==exNow().index){r.composing=false;r.compositionPending=false;r.compositionConsumed='';paint(r);return;}r.composing=false;r.compositionPending=true;composingInput(r,e.target.value);const index=exNow().index;cancelAnimationFrame(r.compositionFrame);r.compositionFrame=requestAnimationFrame(()=>{if(!valid(r)||exNow().index!==index)return;const value=r.compositionValue;r.compositionPending=false;r.compositionConsumed='';dispatch('input',{value});paint(r);});});
 node.addEventListener('keydown',e=>{
  if(!valid(r))return;
  if(e.key==='Escape'){e.preventDefault();dispatch('close');return;}
  if(e.target.matches(answerSelector)&&e.key==='Enter'&&!e.isComposing&&!r.composing&&!r.compositionPending){e.preventDefault();dispatch('input',{value:e.target.value});paint(r);}
  if(e.key==='Tab'){const nodes=[...node.querySelectorAll('button:not([disabled]),input:not([disabled]),summary,video,iframe')].filter(x=>x.getClientRects().length),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 });
 node.addEventListener('click',e=>{if(!valid(r))return;const word=e.target.closest('[data-lyrics-word]');if(word){dispatch('word',{index:Number(word.dataset.lyricsWord),term:Number(word.dataset.term)});paint(r);return;}const b=e.target.closest('[data-lyrics]');if(!b){if(e.target.closest('.en-lyrics-task')&&!answerInput(node).disabled)answerInput(node).focus({preventScroll:true});return;}dispatch(b.dataset.lyrics==='back'?'close':b.dataset.lyrics);if(valid(r)){paint(r);if(!answerInput(node).disabled)answerInput(node).focus({preventScroll:true});}});
 r.media.addEventListener('loadedmetadata',()=>{if(!valid(r))return;if(!r.media.error)r.mediaProblem='';if(!r.initialized){r.initialized=true;seek(r,r.clip.start);if(exNow().autoPlay)dispatch('start');}paint(r);});
 r.media.addEventListener('autoplayblocked',()=>{if(valid(r)){r.mediaProblem='Нажми ▶ в упражнении, чтобы включить звук.';paint(r);}});
 r.media.addEventListener('timeupdate',()=>tick(r));
 r.media.addEventListener('play',()=>{if(!valid(r)||document.hidden){r.media.pause();return;}if(!r.preparedPlay)dispatch('native-play');r.preparedPlay=false;r.lineStarted=true;r.started=true;r.mediaProblem='';const time=r.media.currentTime;if(r.seeking&&time>=r.seeking.target-.05&&time<=r.seeking.target+1)r.seeking=null;r.anchor=r.seeking?null:{time,at:performance.now()};paint(r);});
 r.media.addEventListener('ratechange',()=>{if(valid(r)&&r.media.playbackRate<1)dispatch('support');});
 r.media.addEventListener('pause',()=>{if(valid(r)){tick(r);paint(r);}else r.anchor=null;});
 r.media.addEventListener('ended',()=>tick(r));
 r.media.addEventListener('error',()=>{if(valid(r)){r.mediaProblem='Видео не загрузилось. Повтори воспроизведение или выбери другой источник.';paint(r);}});
 if(active(ex)){
 const source=ex.sourceMeta,local=window.FlowEnglishLyricsSource?.(source)||window.FlowEnglishMediaPractice.tools.fileSource?.(source),track=local?{source:local,start:r.clip.start}:source.youtubeId?{youtubeId:source.youtubeId,start:r.clip.start,watchUrl:'https://www.youtube.com/watch?v='+source.youtubeId}:{source:source.source,start:r.clip.start};
 if(!track.youtubeId&&!track.source){
  r.mediaProblem='Выбери исходное видео упражнения.';const attach=document.createElement('input');attach.type='file';attach.accept='video/*';attach.setAttribute('aria-label','Исходное видео');node.querySelector('.en-lyrics-video').append(attach);let selection=0;
  attach.onchange=async()=>{const serial=++selection,selected=()=>valid(r)&&serial===selection&&attach.isConnected;
   try{if(!selected())return;const file=attach.files[0];if(!file)return;const id=await FlowEnglishMediaPractice.tools.fileIdentity(file);if(!selected())return;if(id.sha256!==source.file?.sha256||id.size!==source.file?.size)throw Error('Выбери исходное видео упражнения.');
    const url=URL.createObjectURL(file);if(r.url)URL.revokeObjectURL(r.url);r.url=url;r.mediaProblem='';r.media.setTrack({source:url,start:r.clip.start});attach.remove();paint(r);answerInput(node).focus({preventScroll:true});
   }catch(error){if(selected()){r.mediaProblem=error.message||'Не удалось прочитать видео.';paint(r);}}
  };paint(r);
 }
 else{node.querySelector('video').hidden=!!track.youtubeId;r.media.setTrack(track);r.media.mount(node.querySelector('[data-lyrics-youtube]'));}
 }
 r.observer=new MutationObserver(()=>{if(run===r&&(!node.isConnected||!valid(r)))stop();});r.observer.observe(app,{childList:true,subtree:true});
 if(active(ex))answerInput(node).focus({preventScroll:true});
}
function screen(ex){queueMicrotask(()=>{if(exNow()?.sessionId===ex.sessionId)mount(exNow());});return'<div class="en-lyrics-placeholder" aria-hidden="true"></div>';}
function action(name,control){
 const ex=exNow();if(!ex)return true;const q=active(ex);
 if(name==='close'){const s=enState();s.ex=null;s.tab='course';s.practiceView='hub';effect(stop);render();return true;}
 if(ex.blockedReason)return true;
 if(name.startsWith('vocab-'))return vocabAction(name,control,ex);
 if(name==='word'){const index=control.index,term=control.term,row=ex.items[index];if(!row?.result||!terms(row)[term])return true;row.wordSaves||={};if(row.wordSaves[term])return true;if(!enRecord('practiceword',payload(ex,index,'word',{term})))throw Error('practice_word_save');row.wordSaves[term]='pending';return true;}
 if(!q)return true;q.answers||=[];q.assistance||={};
 if(name==='input'){
  if(answered(q))return true;const value=String(control.value||'').slice(0,200).replace(/^\s+/,'');q.typed=value;
  const expected=q.gaps[q.answers.length].text;if(value&&!norm(expected).startsWith(norm(value))){q.assistance.hint=true;run?.supported?.add(ex.index);q.mistakes=(q.mistakes||0)+1;}
  if(norm(value)===norm(expected)){q.answers.push(expected);q.typed='';}
  return true;
 }
 if(name==='translation'){q.showTranslation=!q.showTranslation;if(q.showTranslation){q.assistance.transcript=true;run?.supported?.add(ex.index);}return true;}
 if(name==='translation-init'){q.showTranslation=!!control.value&&!!translation(ex,q);if(q.showTranslation)q.assistance.transcript=true;return true;}
 if(name==='hint'){if(!answered(q)){q.assistance.shown=true;run?.supported?.add(ex.index);q.answers.push(q.gaps[q.answers.length].text);q.typed='';}return true;}
 if(name==='heard'){q.heard=['clip:0'];return true;}
 if(name==='support'){q.assistance.hint=true;run?.supported?.add(ex.index);return true;}
 if(name==='native-play'){if(!q.listens||!run?.lineStarted||run?.atEnd){q.listens=(q.listens||0)+1;q.assistance.replays=q.listens;if(q.listens>1){q.assistance.hint=true;run?.supported?.add(ex.index);}}return true;}
 if(name==='play'||name==='replay'||name==='continue'||name==='start'){
  const r=run;if(!r||!valid(r))return true;
  if(name==='start')ex.autoPlay=false;
  r.nextBlocked=false;
  if(name==='play'&&!r.media.paused){effect(()=>r.media.pause());return true;}
  const restart=name==='replay'||r.media.currentTime>=r.clip.end||r.media.currentTime<r.clip.start;
  if(restart||!q.listens||!r.lineStarted){q.listens=(q.listens||0)+1;q.assistance.replays=q.listens;if(q.listens>1){q.assistance.hint=true;run?.supported?.add(ex.index);}}
  effect(()=>{if(!valid(r)||document.hidden)return;if(restart){r.atEnd=false;seek(r,r.clip.start);}r.preparedPlay=true;r.lineStarted=true;r.media.play().catch(()=>{r.preparedPlay=false;if(valid(r))r.node.querySelector('[data-lyrics-status]').textContent='Нажми ▶ в упражнении, чтобы включить звук.';});});return true;
 }
 if(name==='next'||name==='skip'){
  if(run?.supported?.has(ex.index))q.assistance.hint=true;if(run?.media.playbackRate<1)q.assistance.slow=true;
  if(name==='skip'){q.skipped=true;q.result={correct:false,engine:'skipped'};}
  else{if(!answered(q)||!heard(q))return true;q.result=q.kind==='info'?{correct:null,engine:'instruction'}:core().check(q,q.answers);}
  q.typed='';if(!enRecord('practiceevent',payload(ex,ex.index,'answer')))throw Error('practice_save');ex.index++;
  if(ex.index===ex.items.length){if(!enRecord('practiceevent',payload(ex,ex.index,'complete')))throw Error('practice_complete');ex.sent=true;}
  enState().practiceProgress=null;
  effect(()=>{const r=run;if(!r||!valid(r))return;selectLine(r);const next=active(exNow());if(next){dispatch('continue');if(!answerInput(r.node).disabled)answerInput(r.node).focus({preventScroll:true});}});render();return true;
 }
 return true;
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&run){clearTimeout(run.next);run.media.pause();}});
window.addEventListener('pagehide',stop);window.sorokaEnglishSession?.subscribeInvalidation(stop);
window.FlowEnglishLyricsPractice={owns,screen,action,stop,prepareInput,inputPrepared,cancelPrepared,keepPreparedDuring,tools:{norm,lineMarkup,reviewWords}};
})();
