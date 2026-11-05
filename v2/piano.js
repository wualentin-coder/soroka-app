/* Native Flow navigation; the audio/score engine lives outside render(). */
(() => {
  const base=new URL('./piano/',document.currentScript.src);
  const revision='0b58b5803e6f';
  const state={tab:'today',module:null,index:0,busy:false,error:'',sync:'loading',profile:null,snapshot:{},library:[],daily:null,readyDate:'',player:null,engine:null,deck:null,screen:null,request:0,saveTimer:0,saveBusy:false,dirty:false,serverRevision:0,loaded:false};
  let modulePromise=null,apiModule=null,loadPromise=null,deckObserver=null,practiceFocus=false;
  const publicStudyPlans=new Map();
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const key=()=>`flow-piano-profile:${state.profile||'local'}`;
  const call=(op,args={})=>typeof window.sorokaPiano==='function'?window.sorokaPiano(op,args):Promise.reject(new Error('Нет подключения к Flow. Заниматься можно на этом устройстве.'));
  function cache(){try{localStorage.setItem(key(),JSON.stringify({...state.snapshot,_sync:{dirty:state.dirty,revision:state.serverRevision}}));localStorage.setItem('flow-piano-active-profile',state.profile||'local');}catch{state.error='Не удалось сохранить прогресс на устройстве.';}}
  function save(snapshot){state.snapshot=apiModule.mergePianoState(state.snapshot,{...snapshot,learningProgress:state.snapshot.learningProgress,dailyRun:state.snapshot.dailyRun,updatedAt:Date.now()});state.dirty=true;state.sync='pending';cache();clearTimeout(state.saveTimer);state.saveTimer=setTimeout(sync,700);}
  async function sync(){
    if(state.saveBusy||!state.dirty||!state.profile)return;state.saveBusy=true;
    const sent=state.snapshot,stamp=sent.updatedAt,profile=state.profile;
    try{const answer=await call('progress_save',{progress:apiModule.toPianoProgress(sent),baseRevision:state.serverRevision});if(profile!==state.profile)return;state.serverRevision=answer.revision;if(state.snapshot.updatedAt===stamp){state.dirty=false;state.sync='saved';}cache();}
    catch(error){
      if(profile!==state.profile)return;
      try{const remote=await call('progress_load');if(profile!==state.profile||remote.profileId!==profile)return;const conflict=remote.revision!==state.serverRevision;state.serverRevision=remote.revision;state.snapshot=apiModule.mergePianoState(remote.progress,state.snapshot);state.sync=conflict?'pending':'offline';cache();}catch{state.sync='offline';cache();}
    }finally{state.saveBusy=false;if(state.dirty&&state.sync==='pending'){clearTimeout(state.saveTimer);state.saveTimer=setTimeout(sync,1500);}paintStatus();}
  }
  function audioFocus(active){if(practiceFocus===active)return;practiceFocus=active;document.dispatchEvent(new CustomEvent('flow:audiofocus',{detail:{owner:'piano-practice',active}}));}
  function showPlayer(show){if(state.player)state.player.hidden=!show;document.body.classList.toggle('piano-playing',show);const app=document.getElementById('app');if(app)app.inert=show;if(!show)audioFocus(false);}
  function paintStatus(){const node=document.querySelector('#pn-sync');if(node)node.textContent=state.sync==='saved'?'Прогресс сохранён в Flow':state.sync==='pending'?'Сохраняем прогресс…':state.sync==='offline'?'Прогресс на устройстве · синхронизируем при подключении':state.sync==='loading'?'Загружаем твой прогресс…':'';}
  async function modules(){if(!modulePromise)modulePromise=import(new URL(`native.mjs?v=${revision}`,base).href).then(m=>apiModule=m);return modulePromise;}
  function addLibrary(items){state.library=[...state.library,...items].filter((c,i,a)=>a.findIndex(x=>x.id===c.id)===i);}
  async function restoreLibrary(){addLibrary(await apiModule.listCachedCompositions(state.profile));}
  function applyLocalReset(m){
    const at=window.flowPianoResetAt;
    if(!Number.isSafeInteger(at)||at<=0||at>8640000000000000)return;
    const keys=Object.keys(localStorage).filter(name=>name.startsWith('flow-piano-profile:')||name==='flow-piano-flow-v1');
    if(!keys.length)keys.push('flow-piano-profile:local');
    for(const name of keys){
      const raw=localStorage.getItem(name);let previous;
      try{previous=JSON.parse(raw||'{}');}catch{continue;}
      if((previous?.resetAt||0)>=at)continue;
      const backup='flow-piano-reset-backup:'+at+':'+name;
      if(raw&&!localStorage.getItem(backup))localStorage.setItem(backup,raw);
      const reset=m.resetPianoProgress(previous,{at});
      if(name.startsWith('flow-piano-profile:')&&!name.endsWith(':player'))reset._sync={dirty:false,revision:previous?._sync?.revision||0};
      localStorage.setItem(name,JSON.stringify(reset));
    }
  }
  async function load(readOnly=false){
    if(!readOnly)homeWarmOnly=false;
    if(loadPromise){if(!readOnly&&state.loaded&&state.dirty&&state.sync==='pending'){clearTimeout(state.saveTimer);state.saveTimer=setTimeout(sync,700);}return loadPromise;}
    loadPromise=(async()=>{
      const m=await modules();
      applyLocalReset(m);
      try{state.profile=localStorage.getItem('flow-piano-active-profile')||null;if(state.profile==='local')state.profile=null;const cached=JSON.parse(localStorage.getItem(key())||'{}');state.dirty=cached._sync?.dirty===true;state.snapshot=m.normalizePianoState(cached);}catch{state.snapshot=m.normalizePianoState({});}
      state.library=m.COMPOSITIONS.map(c=>({id:c.id,title:c.title,author:c.author,source:c.source}));
      try{
        const remote=await call('progress_load');
        if(state.profile!==remote.profileId){const unbound=state.profile===null?state.snapshot:null,unboundDirty=unbound&&state.dirty;if(state.engine){state.engine.destroy();state.engine=null;state.enginePromise=null;showPlayer(false);}state.profile=remote.profileId;try{const cached=JSON.parse(localStorage.getItem(key())||'{}');state.dirty=cached._sync?.dirty===true;state.snapshot=m.normalizePianoState(cached);}catch{state.snapshot=m.normalizePianoState({});}if(unbound){state.snapshot=m.mergePianoState(state.snapshot,unbound);state.dirty=state.dirty||unboundDirty;}}
        state.snapshot=m.mergePianoState(remote.progress,state.snapshot);state.serverRevision=remote.revision;state.dirty=state.dirty||!m.samePianoProgress(remote.progress,state.snapshot);state.sync=state.dirty?'pending':'saved';cache();if(state.dirty&&(!readOnly||state.active)){clearTimeout(state.saveTimer);state.saveTimer=setTimeout(sync,700);}
        const library=await call('composition_list');addLibrary(library.compositions||[]);
      }catch{state.sync='offline';}
      await restoreLibrary();
      state.loaded=true;updatePlan();paint();if(readOnly&&state.active&&state.dirty&&state.sync==='pending'&&!state.saveTimer)state.saveTimer=setTimeout(sync,700);return m;
    })().catch(error=>{state.error=error.message||'Не удалось открыть обучение.';state.sync='offline';paint();throw error;});
    return loadPromise;
  }
  function planOptions(){const song=state.library.find(c=>c.id===state.snapshot.favoriteSongId)||state.library.find(c=>c.id==='joy-beginner');return {date:localDate(),minutes:15,input:state.snapshot.input||'mic',song,goal:apiModule.learningGoals.getLearningGoal(song,state.snapshot.learningProgress,{date:localDate(),input:state.snapshot.input||'mic',hand:'right'})};}
  function updatePlan(){if(!apiModule)return;state.daily=apiModule.learning.createDailyPlan(state.snapshot.learningProgress,planOptions());}
  let homeLoad=false,homeWarmOnly=false;
  function practiceStatus(){
    const date=localDate();
    if(!state.loaded||!apiModule){
      if(!homeLoad){homeLoad=true;homeWarmOnly=!state.active;load(true).then(()=>{if(typeof ui!=='undefined'&&ui.page==='today')render();}).catch(()=>{});}
      return{date,status:'unknown'};
    }
    if(state.sync==='offline')return{date,status:'unknown'};
    return{date,status:apiModule.learning.createDailyPlan(state.snapshot.learningProgress,planOptions()).tasks.some(task=>!task.completed)?'pending':'done'};
  }
  const syncLabel=()=>state.sync==='saved'?'Прогресс сохранён в Flow':state.sync==='offline'?'На этом устройстве · офлайн':state.sync==='pending'?'Сохраняем…':'Загружаем твой прогресс…';
  function tabs(){return `<div class="pn-tabs" role="tablist" aria-label="Пианино">${[['today','Занятие'],['songs','Композиции'],['progress','Прогресс']].map(([id,label])=>`<button role="tab" data-pn-action="tab" data-tab="${id}" aria-selected="${id==='today'}" class="${id==='today'?'active':''}">${label}</button>`).join('')}</div>`;}
  function today(){
    if(!apiModule||!state.daily)return '<div class="pn-lesson-card" role="status">Готовим занятие…</div>';
    const options=planOptions(),task=apiModule.learning.nextLearningTask(state.snapshot.learningProgress,options),tasks=state.daily.tasks;
    const title=task?.title||'Закрепим знакомое',detail=task?task.notice||(task.continuation?'Дневная цель выполнена. Продолжай, пока хочется играть.':'Короткий показ, твоя игра и один понятный совет.'):'Можно повторить знакомый приём в программе или разучить композицию.';
    return `<div class="pn-home-grid"><article class="pn-lesson-card"><small class="pn-eyebrow">${escape(task?.continuation?'Дневная цель выполнена · учимся дальше':task?`Твоё занятие · около ${state.daily.minutes} минут`:'Все доступные шаги выполнены')}</small><h2>${escape(title)}</h2><p>${escape(detail)}</p><button class="primary-button pn-primary-action" data-pn-action="${task?'continue':'tab'}" ${task?'':'data-tab="songs"'} ${state.busy?'disabled':''}>${escape(state.busy?'Открываем…':task?'Продолжить обучение':'Выбрать композицию')}${icon('play','icon-sm')}</button><small id="pn-sync" class="pn-sync">${escape(syncLabel())}</small></article><aside class="pn-today-summary"><strong>Сегодня</strong><details class="pn-session-items"><summary>${tasks.filter(t=>t.completed).length} из ${tasks.length} шагов</summary>${tasks.map(t=>`<div class="pn-session-item"><span>${t.completed?'✓':'·'}</span><span>${escape(t.title)}</span></div>`).join('')}</details>${options.song?`<button class="pn-goal-link" data-pn-action="goal"><span>Моя цель</span><strong>${escape(options.song.title)}</strong>${icon('right','icon-sm')}</button><small>${escape(options.goal.status==='unknown'?'Своя композиция · можно разучивать по частям':options.goal.status==='ready'?'Можно начать первую фразу':options.goal.label+' для первого фрагмента')}</small>`:'<p>Повторение, новый приём и музыка.</p>'}</aside><button class="pn-skills-button" data-pn-action="program">Программа обучения ${icon('right','icon-sm')}</button></div>`;
  }
  function program(){
    const groups=[...new Set(apiModule.COURSE.map(l=>l.moduleId))];state.module=groups.includes(state.module)?state.module:groups[0];
    const allLessons=apiModule.COURSE.filter(l=>l.moduleId===state.module),size=innerHeight<600&&innerWidth>innerHeight?(innerHeight<=340?1:2):5,pages=Math.max(1,Math.ceil(allLessons.length/size));state.programPage=Math.max(0,Math.min(state.programPage||0,pages-1));const lessons=allLessons.slice(state.programPage*size,(state.programPage+1)*size);
    return `<div class="pn-program"><label class="sr-only" for="pn-module">Блок обучения</label><select id="pn-module">${groups.map((id,i)=>`<option value="${escape(id)}" ${state.module===id?'selected':''}>${i+1}. ${escape(apiModule.COURSE.find(l=>l.moduleId===id).moduleTitle)}</option>`).join('')}</select><div class="pn-skill-list">${lessons.map(l=>`<button class="pn-skill-row" data-pn-action="course" data-lesson="${escape(l.id)}"><span class="pn-skill-copy"><strong>${escape(l.title)}</strong><small>${escape(l.description)}</small></span><span class="pn-skill-value">${state.snapshot.courseProgress?.lessons?.[l.id]?.passed?'✓':icon('right','icon-sm')}</span></button>`).join('')}</div><div class="pn-page-controls"><button class="icon-button" data-pn-action="program-page" data-step="-1" aria-label="Предыдущие уроки" ${state.programPage?'':'disabled'}>${icon('left')}</button><span>${state.programPage+1} из ${pages}</span><button class="icon-button" data-pn-action="program-page" data-step="1" aria-label="Следующие уроки" ${state.programPage<pages-1?'':'disabled'}>${icon('right')}</button></div></div>`;
  }
  function songs(){return `<div class="pn-library-tools"><label class="ghost-button pn-import">${icon('plus','icon-sm')} Добавить MIDI<input id="pn-midi-import" type="file" accept=".mid,.midi,audio/midi" hidden></label><span id="pn-deck-count">${state.library.length?`${state.index+1} из ${state.library.length}`:''}</span><button class="icon-button" data-pn-action="previous" aria-label="Предыдущая композиция">${icon('left')}</button><button class="icon-button" data-pn-action="next" aria-label="Следующая композиция">${icon('right')}</button></div>${state.library.length?'<div id="pn-song-deck" class="pn-deck" role="group" aria-label="Композиции для изучения" tabindex="0"></div>':'<div class="pn-library-empty"><h2>Первая композиция</h2><p>Добавь MIDI-файл. Flow разделит его на короткие участки для изучения.</p></div>'}`;}
  function cover(c){const id=/moon|fly/i.test(c.id)?'moon':/elise/i.test(c.id)?'elise':/joy/.test(c.id)?'joy':/star/.test(c.id)?'star':'custom';return new URL('covers/'+id+'.svg',base).href;}
  function songProgress(c){const saved=state.snapshot.studyProgress?.[c.id],builtin=apiModule.COMPOSITIONS.find(x=>x.id===c.id);if(builtin){if(!publicStudyPlans.has(c.id))publicStudyPlans.set(c.id,apiModule.createCompositionStudy(builtin));const plan=publicStudyPlans.get(c.id),summary=apiModule.studySummary(plan,saved);return summary.complete?'Сыграно самостоятельно':summary.guidedCompleted?`${summary.guidedCompleted} из ${summary.guidedTotal} шагов разобрано`:saved?.version&&saved.version!==plan.version?'Прежний разбор сохранён · новый маршрут':'По фразам · руки отдельно и вместе';}return saved?.mastery?'Самостоятельный проход сохранён':saved?.completed?.length?`${saved.completed.length} шагов в истории`:'Свой MIDI · по частям';}
  function deckCard(i,slot){const c=state.library[i],progress=state.snapshot.studyProgress?.[c.id],goal=apiModule.learningGoals.getLearningGoal(c,state.snapshot.learningProgress,{date:localDate(),input:state.snapshot.input||'mic'});return `<article class="movie-deck-card pn-song-card" data-source="${escape(c.source || 'import')}" data-index="${i}" data-slot="${slot}"><button class="movie-deck-poster" data-pn-action="song" data-song="${escape(c.id)}" aria-label="Изучать ${escape(c.title)}"><img src="${cover(c)}" alt="" draggable="false"></button><button class="movie-deck-info" data-pn-action="song" data-song="${escape(c.id)}"><strong>${escape(c.title)}</strong><span class="pn-song-author">${escape(c.author||'Твоя композиция')}${c.source==='builtin-arrangement'?' · учебная версия Flow':''}</span><span class="pn-song-readiness">${escape(goal.status==='unknown'?'Разберём вместе':goal.label+' · первая фраза')}</span><span class="pn-song-state">${escape(songProgress(c))}</span><span class="pn-song-cta">${progress?.cursor?'Продолжить изучение':'Начать изучение'} ${icon('play','icon-sm')}</span></button></article>`;}
  function progress(){const s=apiModule.learning.learningSummary(state.snapshot.learningProgress,{date:localDate()}),size=innerWidth>innerHeight&&innerHeight<600?(innerHeight<=340?1:2):6,pages=Math.ceil(s.skills.length/size);state.progressPage=Math.max(0,Math.min(state.progressPage||0,pages-1));return `<div class="pn-progress-grid"><div class="pn-progress-stat"><strong>${s.coveredSkills}/${s.totalSkills}</strong><span>Приёмов попробовал</span></div><div class="pn-progress-stat"><strong>${s.readySkills}</strong><span>Сыграл самостоятельно</span></div><div class="pn-progress-stat"><strong>${s.retainedSkills}</strong><span>Вспомнил в разные дни</span></div></div><div class="pn-skill-list">${s.skills.slice(state.progressPage*size,(state.progressPage+1)*size).map(skill=>`<div class="pn-skill-row"><span class="pn-skill-copy"><strong>${escape(skill.title)}</strong><small>${escape(skill.retained?'Сохраняется в памяти':skill.ready?'Получается без помощи':skill.covered?'Пробовали · ещё закрепим':'Впереди')}</small></span><span class="pn-skill-value">${skill.retained?'✓':skill.due?'Повторить':''}</span></div>`).join('')}</div><div class="pn-page-controls"><button class="icon-button" data-pn-action="progress-page" data-step="-1" aria-label="Предыдущие навыки" ${state.progressPage?'':'disabled'}>${icon('left')}</button><span>${state.progressPage+1} из ${pages}</span><button class="icon-button" data-pn-action="progress-page" data-step="1" aria-label="Следующие навыки" ${state.progressPage<pages-1?'':'disabled'}>${icon('right')}</button></div>`;}
  function readiness(){return `<article class="pn-readiness"><small class="pn-eyebrow">Перед игрой · Casio CT-S200</small><h2>Устрой руки удобно</h2><p>Выбери тембр Piano. Поставь телефон так, чтобы видеть экран и не поднимать плечи.</p><div class="pn-check-row">${icon('check','icon-sm')} Плечи свободны, локти не прижаты.</div><div class="pn-check-row">${icon('check','icon-sm')} Запястье ровное, пальцы слегка согнуты.</div><div class="pn-check-row">${icon('check','icon-sm')} Играй мягко. Если рукам неудобно — сделай паузу.</div><button class="primary-button pn-primary-action" data-pn-action="ready">Проверил, начинаем ${icon('play','icon-sm')}</button><p class="pn-sync">Это твоя проверка удобства: приложение не видит руки.</p></article>`;}
  function paint(){
    document.body.classList.toggle('piano-deck-open',state.active===true&&state.tab==='songs');
    const content=document.getElementById('pn-content');if(!content)return;
    destroyDeck();content.innerHTML=state.error?`<div class="pn-library-empty"><p role="status">${escape(state.error)}</p><button class="ghost-button" data-pn-action="retry">Попробовать снова</button></div>`:state.tab==='program'&&apiModule?program():state.tab==='ready'?readiness():!state.loaded?'<div class="pn-lesson-card" role="status">Готовим твоё занятие…</div>':state.tab==='songs'?songs():state.tab==='progress'?progress():today();
    for(const tab of document.querySelectorAll('.pn-tabs [data-tab]')){const active=tab.dataset.tab===(['program','ready'].includes(state.tab)?'today':state.tab);tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));}
    if(state.tab==='songs'&&state.library.length)mountDeck();size();
    window.flowDigitalLearning?.pianoPaint?.(content,{tab:state.tab,cards:['today','songs'].includes(state.tab)&&apiModule?state.library.map((_,i)=>deckCard(i,i)):[],disposeDeck:destroyDeck});
  }
  function size(){const screen=document.querySelector('.piano-screen'),content=document.getElementById('pn-content');if(!screen||!content)return;const footer=document.querySelector('.mobile-nav'),nav=footer&&getComputedStyle(footer).display!=='none'?footer.getBoundingClientRect().height:0;const bottom=(window.visualViewport?.height||innerHeight)-nav-12;const height=Math.max(120,bottom-content.getBoundingClientRect().top);screen.style.setProperty('--pn-content-height',height+'px');if(state.deck){state.deck.track.dataset.heightLimit=String(Math.max(128,height-56));state.deck.paint();}}
  function mountDeck(){const track=document.getElementById('pn-song-deck');if(!track||typeof LoopDeck!=='function')return;track.dataset.heightLimit=String(Math.max(128,(window.visualViewport?.height||innerHeight)-track.getBoundingClientRect().top-14));state.deck=new LoopDeck(track,{count:state.library.length,index:Math.min(state.index,state.library.length-1),card:deckCard,onChange:i=>{state.index=i;const node=document.getElementById('pn-deck-count');if(node)node.textContent=`${i+1} из ${state.library.length}`;}});}
  function destroyDeck(){state.deck?.destroy();state.deck=null;deckObserver?.disconnect();deckObserver=null;}
  async function engine(){
    await load();if(state.engine)return state.engine;if(state.enginePromise)return state.enginePromise;
    if(!state.player){state.player=document.createElement('section');state.player.className='pn-player-shell';state.player.hidden=true;state.player.setAttribute('aria-label','Занятие на пианино');state.player.setAttribute('role','dialog');state.player.setAttribute('aria-modal','true');document.body.append(state.player);}
    const host=document.createElement('div');host.id='pn-player-root';state.player.replaceChildren(host);
    state.enginePromise=apiModule.createNativePlayer(host,{call,isActive:()=>state.active,storageKey:key()+':player',initialState:state.snapshot,onStateChange:save,onNavigate:view=>{
      if(view==='practice'){showPlayer(true);audioFocus(true);}
      else{showPlayer(false);state.tab=state.settingsReturnTab||(view==='library'?'songs':view==='progress'?'progress':'today');state.settingsReturnTab=null;updatePlan();paint();}
    },onAssistance:task=>{state.snapshot.dailyRun={...state.snapshot.dailyRun,assistance:{...state.snapshot.dailyRun?.assistance,[task.id]:{helpedAt:Math.max(Date.now(),(state.snapshot.dailyRun?.assistance?.[task.id]?.helpedAt||0)+1,(state.snapshot.dailyRun?.assistance?.[task.id]?.consumedAt||0)+1),consumedAt:state.snapshot.dailyRun?.assistance?.[task.id]?.consumedAt||0}}};save(state.snapshot);},onReport:handleReport,onTaskComplete:task=>{if(!state.active)return;updatePlan();if(task&&!apiModule.learning.isLearningTaskComplete(state.snapshot.learningProgress,task)){state.engine.pause();showPlayer(false);state.tab='today';paint();return;}const next=apiModule.learning.nextLearningTask(state.snapshot.learningProgress,planOptions());if(next)openTask(next);else{state.engine.pause();showPlayer(false);state.tab='today';paint();}}});
    try{state.engine=await state.enginePromise;return state.engine;}catch(error){state.enginePromise=null;throw error;}
  }
  function helpActive(id){const flag=state.snapshot.dailyRun?.assistance?.[id];return !!flag&&flag.helpedAt>flag.consumedAt;}
  function handleReport(event){
    if(!event.task||event.source==='demo'||event.report?.demo===true)return;
    state.snapshot.learningProgress=apiModule.learning.recordLearningAttempt(state.snapshot.learningProgress,event.task,event.report,{at:Date.now(),date:event.task.date||localDate(),attemptId:event.attemptId,mode:event.mode,source:event.source,assisted:event.assisted||helpActive(event.task.id),cueVisible:event.cueVisible,beta:event.beta,breakdown:event.breakdown});
    if(state.snapshot.dailyRun?.assistance?.[event.task.id])state.snapshot.dailyRun.assistance[event.task.id].consumedAt=Math.max(Date.now(),state.snapshot.dailyRun.assistance[event.task.id].helpedAt);state.snapshot.updatedAt=Date.now();state.dirty=true;state.sync='pending';cache();clearTimeout(state.saveTimer);state.saveTimer=setTimeout(sync,700);updatePlan();
  }
  async function openTask(task){
    if(!task)return;state.busy=true;paint();
    try{const token=++state.request,p=await engine();if(!state.active||token!==state.request)return;if(task.kind==='song'||!task.lessonId){const id=task.compositionId||task.songId||state.snapshot.favoriteSongId;if(!id){state.pendingSongTask=task;state.tab='songs';showPlayer(false);paint();return;}await openSong(id,task);return;}showPlayer(true);p.openTask({...task,assisted:helpActive(task.id)});}
    catch(error){state.error=error.message||'Не удалось открыть занятие.';paint();}finally{state.busy=false;}
  }
  async function openSong(id,task=null){
    if(!id)throw new Error('Выбери композицию.');state.busy=true;
    try{const token=++state.request,p=await engine(),profile=state.profile;if(!state.active||token!==state.request)return;if(!apiModule.COMPOSITIONS.some(c=>c.id===id)){let composition;try{const answer=await call('composition_get',{id});composition=answer.composition;void apiModule.putCachedComposition(profile,composition);}catch{composition=await apiModule.getCachedComposition(profile,id);if(!composition)throw new Error('Открой эту композицию один раз с интернетом, чтобы сохранить её на телефоне.');}if(!state.active||token!==state.request||profile!==state.profile)return;p.addComposition(composition);}state.snapshot.favoriteSongId=id;save(state.snapshot);showPlayer(true);p.openComposition(id,task);}
    finally{state.busy=false;}
  }
  async function action(button){
    const name=button.dataset.pnAction;if(name==='tab'){state.request++;state.tab=button.dataset.tab;state.error='';paint();return;}
    if(name==='back'){if(['program','ready'].includes(state.tab)){state.tab='today';paint();}else navigate('more');return;}
    if(name==='program'){state.tab='program';state.programPage=0;paint();return;}if(name==='program-page'){state.programPage=(state.programPage||0)+Number(button.dataset.step);paint();return;}
    if(name==='progress-page'){state.progressPage=(state.progressPage||0)+Number(button.dataset.step);paint();return;}
    if(name==='previous'||name==='next'){state.deck?.nudge(name==='next'?1:-1);return;}
    if(name==='goal'){const options=planOptions();state.index=Math.max(0,state.library.findIndex(c=>c.id===options.song?.id));state.tab='songs';paint();return;}
    if(name==='retry'){state.error='';loadPromise=null;await load();return;}
    if(name==='settings'){const token=++state.request,p=await engine();if(!state.active||token!==state.request)return;state.settingsReturnTab=state.tab;showPlayer(true);p.showSettings();return;}
    if(name==='course'){const token=++state.request,p=await engine();if(!state.active||token!==state.request)return;showPlayer(true);p.openTask(apiModule.learning.createPracticeTask(button.dataset.lesson,{date:localDate(),input:state.snapshot.input||'mic',progress:state.snapshot.learningProgress}));return;}
    if(name==='continue'){await load();if((state.readyDate||state.snapshot.dailyRun?.readyDate)!==localDate()){state.tab='ready';paint();return;}await openTask(apiModule.learning.nextLearningTask(state.snapshot.learningProgress,planOptions()));return;}
    if(name==='ready'){state.readyDate=localDate();state.snapshot.dailyRun={...state.snapshot.dailyRun,readyDate:state.readyDate};save(state.snapshot);state.tab='today';await action({dataset:{pnAction:'continue'}});return;}
    if(name==='song'){
      const card=button.closest('.movie-deck-card');if(card&&state.deck&&Number(card.dataset.slot)!==Math.round(state.deck.position)){state.deck.select(Number(card.dataset.index),Number(card.dataset.slot));return;}
      const task=state.pendingSongTask||null;state.pendingSongTask=null;await openSong(button.dataset.song,task);
    }
  }
  document.addEventListener('click',event=>{const b=event.target.closest('[data-pn-action]');if(!b)return;event.preventDefault();event.stopImmediatePropagation();action(b).catch(error=>{state.error=error.message||'Не получилось. Попробуй ещё раз.';paint();});});
  document.addEventListener('change',async event=>{
    if(event.target.id==='pn-module'){state.module=event.target.value;state.programPage=0;paint();return;}
    if(event.target.id!=='pn-midi-import')return;const file=event.target.files?.[0];if(!file)return;
    try{if(file.size>2*1024*1024)throw new Error('Выбери MIDI-файл до 2 МБ.');await load();const profile=state.profile,composition=apiModule.parseMidiComposition(await file.arrayBuffer(),file.name);const answer=await call('composition_import',{composition});if(profile!==state.profile)return;void apiModule.putCachedComposition(profile,composition);state.library=[...state.library.filter(c=>c.id!==composition.id),answer.metadata||{id:composition.id,title:composition.title,author:composition.author}];(await engine()).addComposition(composition);state.index=state.library.length-1;if(state.active)paint();}
    catch(error){state.error=error.message||'Не удалось добавить MIDI.';paint();}
  });
  document.addEventListener('keydown',event=>{if(event.target.closest('#pn-song-deck')&&state.deck&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();state.deck.nudge(event.key==='ArrowRight'?1:-1);}});
  window.addEventListener('resize',size);window.visualViewport?.addEventListener('resize',size);
  window.addEventListener('online',async()=>{if(!state.profile||state.sync==='offline'){loadPromise=null;try{await load(homeWarmOnly);if(homeWarmOnly&&typeof ui!=='undefined'&&ui.page==='today')render();}catch{}}if(state.dirty&&!homeWarmOnly)sync();});
  window.FlowPiano={practiceStatus,render:()=>`<section class="piano-screen"><header class="piano-header"><button id="pn-back" class="icon-button" data-pn-action="back" aria-label="К разделам Flow">${icon('left')}</button><span class="head-pill">${icon('piano','icon-sm')}Пианино</span><button id="pn-settings" class="icon-button" data-pn-action="settings" aria-label="Настройки пианино">${icon('settings')}</button></header>${tabs()}<div id="pn-content"></div></section>`,mount:()=>{
    const active=typeof ui!=='undefined'&&ui.page==='piano';document.body.classList.toggle('piano-page',active);if(!active){if(!state.active)return;state.active=false;state.request++;destroyDeck();state.engine?.pause();if(state.player)showPlayer(false);document.body.classList.remove('piano-deck-open');state.screen=null;return;}
    state.active=true;const screen=document.querySelector('.piano-screen');if(screen!==state.screen){state.screen=screen;paint();load().catch(()=>{});}
  }};
})();
function renderPianoPage(){return window.FlowPiano.render();}
