/* Sequential lyrics typing. The native English journal owns answers and receipts. */
(()=>{'use strict';
const core=()=>window.FlowEnglishLyricsPracticeCore;
const owns=ex=>ex?.practiceKind==='media'&&ex.contentRevision===core()?.revision;
const terms=q=>q?.target?[q.target]:[];
const translation=(ex,q)=>q?ex.sourceMeta.lines[q.sourceLine]?.ru||'':'';
const h=value=>esc(String(value??''));
let run=null,epoch=0;
const exNow=()=>{const ex=enState().ex;return owns(ex)?ex:null;};
const answerSelector='.en-lyrics-input input[type="text"]';
const answerInput=node=>node.querySelector(answerSelector);
const pauseIcon='<svg class="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z"/></svg>';
const label=(name,title)=>`<button type="button" class="icon-button ef-icon-control" data-lyrics="${name}" aria-label="${title}" title="${title}">${icon(name==='back'?'left':name==='play'?'play':name==='replay'?'reset':name==='hint'?'eye':name==='skip'?'arrow':'book','icon-sm')}</button>`;
const valid=r=>run===r&&ui.page==='english'&&exNow()?.sessionId===r.sid&&!exNow()?.blockedReason&&window.sorokaEnglishSession===r.host&&r.host.isCurrent(r.owner);
function stop(){epoch++;if(!run)return;const r=run;run=null;clearTimeout(r.next);r.media.pause();r.media.dispose();if(r.url)URL.revokeObjectURL(r.url);r.observer?.disconnect();r.node.remove();const app=document.getElementById('app');if(app)app.inert=r.previousInert;if(r.focus?.isConnected)r.focus.focus();}
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
function paint(r){
 if(!valid(r)){if(run===r)stop();return;}const ex=exNow(),q=active(ex),done=!q;
 r.node.querySelector('[data-lyrics-count]').textContent=`${Math.min(ex.index+1,ex.items.length)} / ${ex.items.length}`;
 r.node.querySelector('progress').value=ex.index;r.node.querySelector('progress').max=ex.items.length;
 const line=r.node.querySelector('[data-lyrics-line]');line.innerHTML=done?'Готово':lineMarkup(q);
 r.node.querySelector('[data-lyrics-translation]').textContent=done?'':q.showTranslation?translation(ex,q)||'Перевод не добавлен':'';
 const input=answerInput(r.node);input.disabled=done;if(input.value!==(q?.typed||''))input.value=q?.typed||'';
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
 schedule(r);
}
function schedule(r){
 clearTimeout(r.next);const ex=exNow(),q=active(ex);if(!valid(r)||!r.started||!r.atEnd||r.nextBlocked||document.hidden||!q||!answered(q)||!heard(q))return;
 const index=ex.index;r.next=setTimeout(()=>{if(valid(r)&&!document.hidden&&exNow().index===index&&dispatch('next')===false)r.nextBlocked=true;},380);
}
function selectLine(r){
 const ex=exNow(),q=active(ex);if(!q){r.media.pause();paint(r);return;}
 if(r.index===ex.index){paint(r);return;}
 r.index=ex.index;r.lineStarted=false;r.ranges=[];r.anchor=null;r.lastTime=null;r.atEnd=false;r.counted=false;
 if(q.showTranslation===undefined){const previous=ex.items.slice(0,ex.index).reverse().find(row=>typeof row.showTranslation==='boolean');dispatch('translation-init',{value:previous?.showTranslation??true});}
 const clip=q.clips[0];r.clip=clip;if(r.initialized)r.media.currentTime=clip.start;paint(r);
}
function covered(r){return window.FlowEnglishMediaPractice.tools.coverage(r.ranges,r.clip.start,r.clip.end)>=.9*(r.clip.end-r.clip.start);}
function tick(r){
 if(!valid(r)){if(run===r)stop();return;}if(document.hidden)return;
 const t=r.media.currentTime,now=performance.now(),last=r.anchor;
 if(r.lastTime!==null&&t<r.lastTime-.25)dispatch('support');r.lastTime=t;
 if(last&&!r.media.paused){const elapsed=(now-last.at)/1000,delta=t-last.time;if(elapsed>0&&elapsed<=3&&delta>0&&delta<=elapsed*r.media.playbackRate*1.35+.15)r.ranges.push([last.time,t]);}
 r.anchor={time:t,at:now};
 if(covered(r)&&!r.counted)r.counted=dispatch('heard')!==false;
 if(t>=r.clip.end){r.atEnd=true;r.media.pause();paint(r);}else if(t<r.clip.start-.3){r.anchor=null;r.media.pause();r.media.currentTime=r.clip.start;}
}
function mount(ex){
 if(!owns(ex)||ex.blockedReason||ui.page!=='english')return;
 if(run?.sid===ex.sessionId){selectLine(run);return;}
 stop();const host=window.sorokaEnglishSession,owner=host?.captureOwner();if(!owner?.authorized||!host.isCurrent(owner))return;
 const node=document.createElement('section');node.className='en-lyrics en-page';node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');node.setAttribute('aria-label','Практика по песне');
 node.innerHTML=`<div class="en-lyrics-wrap"><header>${label('back','Вся практика')}<div><h2>${h(ex.title)}</h2><small>${h(ex.sourceMeta.artist||'')}</small></div><button type="button" class="icon-button ef-icon-control" data-lyrics="translation" aria-label="Перевод" aria-pressed="false">EN/RU</button></header><div class="en-lyrics-video"><video playsinline controls preload="metadata"></video><div data-lyrics-youtube></div></div><div class="en-lyrics-toolbar"><div class="en-lyrics-progress"><span data-lyrics-count></span><progress value="0" max="1" aria-label="Строки"></progress></div><nav aria-label="Управление строкой">${label('replay','Повторить строку')}${label('play','Слушать строку')}${label('hint','Раскрыть слово')}${label('skip','Пропустить строку')}</nav></div><div class="en-lyrics-task"><p data-lyrics-line lang="en" class="en-lyrics-line"></p><p data-lyrics-translation class="en-lyrics-translation" lang="ru"></p><label class="field en-lyrics-input"><span class="en-lyrics-sr">Впиши пропущенное слово</span><input type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Пропущенное слово" placeholder="Впиши слово…" maxlength="200"></label><p data-lyrics-status role="status" aria-live="polite"></p></div><details data-lyrics-history-wrap hidden class="en-lyrics-history"><summary>Пройденные строки</summary><div data-lyrics-history></div></details><button type="button" class="primary-button" data-lyrics-finish hidden data-lyrics="back">К практике</button></div>`;
 const app=document.getElementById('app'),r={node,host,owner,sid:ex.sessionId,focus:document.activeElement,previousInert:app.inert,media:new FlowSongMedia(node.querySelector('video')),index:-1,initialized:false,ranges:[],anchor:null,atEnd:false,counted:false,supported:new Set()};run=r;app.inert=true;document.body.append(node);selectLine(r);
 node.addEventListener('input',e=>{if(valid(r)&&e.target.matches(answerSelector)&&!e.isComposing){dispatch('input',{value:e.target.value});paint(r);}});
 node.addEventListener('beforeinput',e=>{if(valid(r)&&e.target.matches(answerSelector)&&answered(active(exNow())))e.preventDefault();});
 node.addEventListener('compositionend',e=>{if(!valid(r)||!e.target.matches(answerSelector))return;dispatch('input',{value:e.target.value});paint(r);});
 node.addEventListener('keydown',e=>{
  if(!valid(r))return;
  if(e.key==='Escape'){e.preventDefault();dispatch('close');return;}
  if(e.target.matches(answerSelector)&&e.key==='Enter'){e.preventDefault();dispatch('input',{value:e.target.value});paint(r);}
  if(e.key==='Tab'){const nodes=[...node.querySelectorAll('button:not([disabled]),input:not([disabled]),summary,video,iframe')].filter(x=>x.getClientRects().length),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 });
 node.addEventListener('click',e=>{if(!valid(r))return;const word=e.target.closest('[data-lyrics-word]');if(word){dispatch('word',{index:Number(word.dataset.lyricsWord),term:Number(word.dataset.term)});paint(r);return;}const b=e.target.closest('[data-lyrics]');if(!b)return;dispatch(b.dataset.lyrics==='back'?'close':b.dataset.lyrics);if(valid(r)){paint(r);if(!answerInput(node).disabled)answerInput(node).focus({preventScroll:true});}});
 r.media.addEventListener('loadedmetadata',()=>{if(!valid(r))return;r.mediaProblem='';if(!r.initialized){r.initialized=true;r.media.currentTime=r.clip.start;if(exNow().autoPlay)dispatch('start');}paint(r);});
 r.media.addEventListener('timeupdate',()=>tick(r));
 r.media.addEventListener('play',()=>{if(!valid(r)||document.hidden){r.media.pause();return;}if(!r.preparedPlay)dispatch('native-play');r.preparedPlay=false;r.lineStarted=true;r.started=true;r.anchor={time:r.media.currentTime,at:performance.now()};paint(r);});
 r.media.addEventListener('ratechange',()=>{if(valid(r)&&r.media.playbackRate<1)dispatch('support');});
 r.media.addEventListener('pause',()=>{r.anchor=null;if(valid(r))paint(r);});
 r.media.addEventListener('ended',()=>tick(r));
 r.media.addEventListener('error',()=>{if(valid(r)){r.mediaProblem='Видео не загрузилось. Повтори воспроизведение или выбери другой источник.';paint(r);}});
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
 r.observer=new MutationObserver(()=>{if(run===r&&(!node.isConnected||!valid(r)))stop();});r.observer.observe(app,{childList:true,subtree:true});
 answerInput(node).focus({preventScroll:true});
}
function screen(ex){queueMicrotask(()=>{if(exNow()?.sessionId===ex.sessionId)mount(exNow());});return'<div class="en-lyrics-placeholder" aria-hidden="true"></div>';}
function action(name,control){
 const ex=exNow();if(!ex)return true;const q=active(ex);
 if(name==='close'){const s=enState();s.ex=null;s.tab='course';s.practiceView='hub';effect(stop);render();return true;}
 if(ex.blockedReason)return true;
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
  effect(()=>{if(!valid(r)||document.hidden)return;if(restart){r.anchor=null;r.atEnd=false;r.media.currentTime=r.clip.start;}r.preparedPlay=true;r.lineStarted=true;r.media.play().catch(()=>{r.preparedPlay=false;if(valid(r))r.node.querySelector('[data-lyrics-status]').textContent='Нажми Play на самом видео.';});});return true;
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
window.FlowEnglishLyricsPractice={owns,screen,action,stop,tools:{norm,lineMarkup}};
})();
