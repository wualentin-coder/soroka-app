/* Native Flow navigation; the audio/score engine lives outside render(). */
(() => {
  const base=new URL('./piano/',document.currentScript.src);
  const revision='d7139bace65d';
  const state={tab:'today',module:null,index:0,busy:false,error:'',sync:'loading',profile:null,snapshot:{},library:[],daily:null,readyDate:'',player:null,engine:null,screen:null,request:0,saveTimer:0,saveBusy:false,dirty:false,serverRevision:0,loaded:false,moduleOpen:false,songQuery:'',songFilter:'all',returnTab:null,settingsReturnTab:null,focusSong:''};
  let modulePromise=null,apiModule=null,loadPromise=null,practiceFocus=false,resizeTimer=0;
  const publicStudyPlans=new Map();
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const key=()=>`flow-piano-profile:${state.profile||'local'}`;
  const call=(op,args={})=>typeof window.sorokaPiano==='function'?window.sorokaPiano(op,args):Promise.reject(new Error('Нет подключения к Flow. Заниматься можно на этом устройстве.'));
  function cache(){try{localStorage.setItem(key(),JSON.stringify({...state.snapshot,_sync:{dirty:state.dirty,revision:state.serverRevision}}));localStorage.setItem('flow-piano-active-profile',state.profile||'local');}catch{state.error='Не удалось сохранить прогресс на устройстве.';}}
  function save(snapshot){state.snapshot=apiModule.mergePianoState(state.snapshot,{...snapshot,learningProgress:state.snapshot.learningProgress,dailyRun:state.snapshot.dailyRun,updatedAt:Date.now()});state.dirty=true;state.sync='pending';cache();clearTimeout(state.saveTimer);state.saveTimer=setTimeout(sync,700);}
  async function sync(){
    if(!state.profile){state.sync='offline';paintStatus();return;}
    if(state.saveBusy||!state.dirty)return;state.saveBusy=true;
    const sent=state.snapshot,stamp=sent.updatedAt,profile=state.profile;
    try{const answer=await call('progress_save',{progress:apiModule.toPianoProgress(sent),baseRevision:state.serverRevision});if(profile!==state.profile)return;state.serverRevision=answer.revision;if(state.snapshot.updatedAt===stamp){state.dirty=false;state.sync='saved';}cache();}
    catch(error){
      if(profile!==state.profile)return;
      try{const remote=await call('progress_load');if(profile!==state.profile||remote.profileId!==profile)return;const conflict=remote.revision!==state.serverRevision;state.serverRevision=remote.revision;state.snapshot=apiModule.mergePianoState(remote.progress,state.snapshot);state.sync=conflict?'pending':'offline';cache();}catch{state.sync='offline';cache();}
    }finally{state.saveBusy=false;if(state.dirty&&state.sync==='pending'){clearTimeout(state.saveTimer);state.saveTimer=setTimeout(sync,1500);}paintStatus();}
  }
  function audioFocus(active){if(practiceFocus===active)return;practiceFocus=active;document.dispatchEvent(new CustomEvent('flow:audiofocus',{detail:{owner:'piano-practice',active}}));}
  function showPlayer(show){if(state.player)state.player.hidden=!show;document.body.classList.toggle('piano-playing',show);const app=document.getElementById('app');if(app)app.inert=show;if(!show){state.busy=false;audioFocus(false);}}
  const syncLabel=()=>state.sync==='saved'?'Сохранено в Flow':state.sync==='offline'?'На устройстве · синхронизируем позже':state.sync==='pending'?'Сохраняем…':'Загружаем прогресс…';
  function paintStatus(){const node=document.querySelector('#pn-sync');if(node)node.textContent=syncLabel();}
  function syncStickyTop(){const page=document.querySelector('.pnw-page');if(!page)return;const bar=document.querySelector('.dm-topbar');page.style.setProperty('--pnw-sticky-top',Math.max(0,Math.round(bar?bar.getBoundingClientRect().height:0))+'px');syncHeaderScroll();}
  function syncHeaderScroll(){const page=document.querySelector('.pnw-page');if(!page)return;if(matchMedia('(orientation:landscape) and (max-height:500px)').matches){page.classList.remove('is-scrolled');return;}const header=page.querySelector('.pnw-head'),bar=document.querySelector('.dm-topbar'),top=bar?bar.getBoundingClientRect().height:0;page.classList.toggle('is-scrolled',!!header&&header.getBoundingClientRect().top<top-1);}
  let scrollFrame=0;
  const scheduleHeaderScroll=()=>{if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;syncHeaderScroll();});};
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
    if(!readOnly){homeWarmOnly=false;state.error='';}
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
    })().catch(error=>{state.error='Не удалось загрузить занятие. Проверь подключение и попробуй ещё раз.';state.sync='offline';paint();throw error;});
    return loadPromise;
  }
  function practiceActivity(){
    if(typeof apiModule?.readPracticeActivity!=='function')return new Map();
    const latest=new Map();
    for(const row of apiModule.readPracticeActivity(localStorage,key()+':player'))if(row.lessonId&&(!latest.has(row.lessonId)||latest.get(row.lessonId).at<=row.at))latest.set(row.lessonId,row);
    return latest;
  }
  function deferredLessons(){return [...practiceActivity().values()].filter(row=>row.status==='skipped').map(row=>row.lessonId);}
  function planOptions(){const song=state.library.find(c=>c.id===state.snapshot.favoriteSongId)||state.library.find(c=>c.id==='joy-beginner');return {date:localDate(),minutes:15,input:state.snapshot.input||'mic',courseVersion:apiModule?.ACTIVE_COURSE?2:1,deferredLessonIds:deferredLessons(),song,goal:apiModule.learningGoals.getLearningGoal(song,state.snapshot.learningProgress,{date:localDate(),input:state.snapshot.input||'mic',hand:'right'})};}
  function updatePlan(){if(!apiModule)return;state.daily=apiModule.learning.createDailyPlan(state.snapshot.learningProgress,planOptions());}
  let homeLoad=false,homeWarmOnly=false;
  function practiceStatus(){
    const date=localDate();
    if(!state.loaded||!apiModule){
      if(!homeLoad){homeLoad=true;homeWarmOnly=!state.active;load(true).then(()=>{if(typeof ui!=='undefined'&&ui.page==='today')render();}).catch(()=>{});}
      return{date,status:'unknown'};
    }
    if(state.sync==='offline')return{date,status:'unknown'};
    const options=planOptions();
    return{date,status:options.deferredLessonIds.length||apiModule.learning.createDailyPlan(state.snapshot.learningProgress,options).tasks.some(task=>!task.completed)?'pending':'done'};
  }
  const plural=(n,one,few,many)=>{const form=new Intl.PluralRules('ru').select(n);return `${n} ${form==='one'?one:form==='few'?few:many}`;};
  const pad=value=>String(value).padStart(2,'0');
  function course(){return apiModule?.ACTIVE_COURSE||apiModule?.COURSE||[];}
  function lessonDone(lesson){return !!apiModule&&(apiModule.learning.isLessonIndependentlyComplete(state.snapshot.learningProgress,lesson.id)||(!lesson.id.startsWith('v2-')&&state.snapshot.courseProgress?.lessons?.[lesson.id]?.passed));}
  function courseGroups(){return [...new Set(course().map(lesson=>lesson.moduleId))];}
  function courseStats(){const list=course();return {total:list.length,done:list.filter(lessonDone).length,modules:courseGroups().length};}
  function moduleLessons(id){return course().filter(lesson=>lesson.moduleId===id);}
  function moduleDone(id){return moduleLessons(id).filter(lessonDone).length;}
  function lessonTitle(id){return course().find(lesson=>lesson.id===id)?.title||'';}
  function lastPractice(){if(typeof apiModule?.readPracticeActivity!=='function')return null;try{return apiModule.readPracticeActivity(localStorage,key()+':player').sort((a,b)=>b.at-a.at)[0]||null;}catch{return null;}}
  const activityLabel=status=>status==='passed'?'сыграно':status==='skipped'?'пропущено':status==='input-problem'?'не услышали звук':'попытка';
  function dayLabel(at){const date=new Date(at),now=new Date(),same=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();const time=date.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});if(same(date,now))return `сегодня, ${time}`;const yesterday=new Date(now);yesterday.setDate(now.getDate()-1);if(same(date,yesterday))return `вчера, ${time}`;return date.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})+','+time;}
  const songCount=n=>`${n} ${new Intl.PluralRules('ru').select(n)==='one'?'композиция':new Intl.PluralRules('ru').select(n)==='few'?'композиции':'композиций'}`;
  const loading=()=>`<div class="pnw-loading" role="status">${icon('piano','pnw-loading-mark')}<p>Готовим твоё занятие…</p></div>`;
  const pianoArt=()=>`<div class="pnw-art" aria-hidden="true"><i class="pnw-planet"></i><i class="pnw-orbit"></i><span class="pnw-mini-keys">${'<i></i>'.repeat(10)}</span></div>`;
  function progressLine(done,total,label){const max=Math.max(1,total),pct=total?Math.round(done/total*100):0;return `<div class="pnw-progress-line" role="progressbar" aria-label="${escape(label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${done}"><i style="width:${pct}%"></i></div>`;}
  function tabs(){return [['today','Занятие'],['songs','Композиции'],['progress','Прогресс'],['program','Программа']].map(([id,label])=>`<button type="button" role="tab" id="pnw-tab-${id}" data-pn-action="tab" data-tab="${id}" aria-controls="pn-content" aria-selected="${id==='today'}" tabindex="${id==='today'?0:-1}" class="${id==='today'?'is-active':''}">${label}</button>`).join('');}
  function today(){
    if(!apiModule||!state.daily)return loading();
    const options=planOptions(),task=apiModule.learning.nextLearningTask(state.snapshot.learningProgress,options),tasks=state.daily.tasks||[],activity=practiceActivity();
    const deferred=!task&&options.deferredLessonIds.length>0;
    const done=tasks.filter(item=>item.completed).length;
    const title=task?.title||(deferred?'Вернись к пропущенному':'Закрепим знакомое'),detail=task?task.notice||(task.continuation?'Дневная цель выполнена. Продолжай, пока хочется играть.':'Короткий показ, твоя игра и один понятный совет.'):deferred?'Пропущенные уроки доступны в программе. Их можно открыть в любой момент.':'Можно повторить знакомый приём в программе или разучить композицию.';
    const kicker=task?.continuation||(!task&&!deferred)?'Дневная цель выполнена':!task?'Есть пропущенные уроки':`Твоё занятие · ${state.daily.minutes} мин`;
    const primary=task?['continue','Продолжить занятие','play']:deferred?['program','К программе','right']:['tab','Выбрать композицию','right'];
    const action=primary[0]==='tab'?'data-pn-action="tab" data-tab="songs"':`data-pn-action="${primary[0]}"`;
    const stats=courseStats(),song=options.song;
    const goal=song?`<button type="button" class="pnw-link" data-pn-action="goal"><img class="pnw-link-cover" src="${cover(song)}" alt="" draggable="false"><span class="pnw-link-copy"><small>Моя цель</small><strong>${escape(song.title)}</strong><em>${escape(options.goal.status==='unknown'?'Своя композиция · разберём по частям':options.goal.status==='ready'?'Можно начать первую фразу':options.goal.label+' для первого фрагмента')}</em></span>${icon('right','pnw-chev')}</button>`:`<button type="button" class="pnw-link" data-pn-action="tab" data-tab="songs"><span class="pnw-link-mark">${icon('music')}</span><span class="pnw-link-copy"><small>Моя цель</small><strong>Выбери первую композицию</strong><em>Разберём по фразам, руками отдельно и вместе</em></span>${icon('right','pnw-chev')}</button>`;
    const steps=tasks.length?tasks.map(item=>{const skipped=activity.get(item.id)?.status==='skipped',current=item.id===task?.id,status=item.completed?'Пройдено':current?'Сейчас':skipped?'Пропущено':'Впереди',classes=`pnw-step${item.completed?' is-done':''}${current?' is-current':''}${skipped&&!item.completed?' is-skipped':''}`;return `<li class="${classes}"${current?' aria-current="step"':''}><span class="pnw-step-dot" aria-hidden="true">${item.completed?icon('check','pnw-step-check'):''}</span><span class="pnw-step-copy"><strong>${escape(item.title)}</strong><small>${status}</small></span></li>`;}).join(''):'<li class="pnw-step is-empty"><span class="pnw-step-dot" aria-hidden="true"></span><span class="pnw-step-copy"><strong>На сегодня шагов нет</strong><small>Можно выбрать композицию</small></span></li>';
    const todayKey=new Date().toDateString(),skippedToday=[...activity.values()].filter(row=>row.status==='skipped'&&row.lessonId&&new Date(row.at).toDateString()===todayKey&&!tasks.some(task=>task.lessonId===row.lessonId)),skippedLine=skippedToday.length?`<p class="pnw-skipped"><strong>Пропущено:</strong> ${skippedToday.map(row=>escape(lessonTitle(row.lessonId)||row.title||'урок')).join(', ')}</p>`:'';
    return `<div class="pnw-today"><section class="pnw-focus"><p class="pnw-kicker">${escape(kicker)}</p><h2>${escape(title)}</h2><p class="pnw-lede">${escape(detail)}</p><div class="pnw-focus-foot"><button type="button" class="pnw-action" ${action} ${state.busy?'disabled':''}>${state.busy?'Открываем…':primary[1]}${state.busy?'':icon(primary[2],'pnw-icon')}</button><span id="pn-sync" class="pnw-sync" role="status" aria-live="polite">${escape(syncLabel())}</span></div>${pianoArt()}</section><aside class="pnw-route"><header><h2>Сегодня</h2><span>${done} из ${tasks.length}</span></header><ol>${steps}</ol>${skippedLine}</aside><div class="pnw-links">${goal}<button type="button" class="pnw-link" data-pn-action="program"><span class="pnw-link-mark">${icon('piano')}</span><span class="pnw-link-copy"><small>Программа</small><strong>${plural(stats.total,'урок','урока','уроков')} · ${plural(stats.modules,'модуль','модуля','модулей')}</strong><em>Пройдено ${stats.done} из ${stats.total}</em></span>${icon('right','pnw-chev')}</button></div></div>`;
  }
  function program(){
    if(!apiModule)return loading();
    const groups=courseGroups();state.module=groups.includes(state.module)?state.module:groups[0];
    const lessons=moduleLessons(state.module),done=moduleDone(state.module),stats=courseStats(),activity=practiceActivity(),nextId=apiModule.learning.nextLearningTask(state.snapshot.learningProgress,planOptions())?.lessonId||'';
    const moduleIndex=groups.indexOf(state.module),title=lessons[0]?.moduleTitle||'Программа';
    const modules=groups.map((id,index)=>{const list=moduleLessons(id),complete=list.filter(lessonDone).length;return `<button type="button" class="pnw-module${id===state.module?' is-active':''}" data-pn-action="module" data-module="${escape(id)}" aria-current="${id===state.module?'true':'false'}"><span class="pnw-module-num">${pad(index+1)}</span><span class="pnw-module-copy"><strong>${escape(list[0]?.moduleTitle||'Модуль')}</strong><small>${complete} из ${list.length}</small></span></button>`;}).join('');
    const rows=lessons.map((lesson,index)=>{const complete=lessonDone(lesson),skipped=activity.get(lesson.id)?.status==='skipped',current=!complete&&lesson.id===nextId,label=complete?'Пройдено':current?'Сейчас':skipped?'Пропущено':'';const note=skipped?(complete?'Повторение пропущено · можно вернуться':'Можно вернуться в любой момент'):lesson.description;return `<button type="button" class="pnw-lesson${complete?' is-done':''}${current?' is-current':''}${skipped&&!complete?' is-skipped':''}" data-pn-action="course" data-lesson="${escape(lesson.id)}"><span class="pnw-lesson-num">${pad(index+1)}</span><span class="pnw-lesson-copy"><strong>${escape(lesson.title)}</strong><small>${escape(note)}</small></span><span class="pnw-lesson-state">${complete?icon('check','pnw-icon')+'<span class="sr-only">Пройдено</span>':label?`<em>${label}</em>`:'<span class="sr-only">Впереди</span>'}${icon('right','pnw-chev')}</span></button>`;}).join('');
    return `<div class="pnw-program"><button type="button" class="pnw-module-toggle" data-pn-action="toggle-modules" aria-expanded="${state.moduleOpen}" aria-controls="pnw-module-menu"><span><small>Программа · ${plural(stats.modules,'модуль','модуля','модулей')}</small><strong>Сменить модуль</strong></span>${icon('down','pnw-chev')}</button><nav id="pnw-module-menu" class="pnw-module-menu${state.moduleOpen?' is-open':''}" aria-label="Модули программы">${modules}</nav><section class="pnw-module-view"><header class="pnw-module-head"><p class="pnw-kicker">Модуль ${moduleIndex+1} из ${groups.length}</p><h2>${escape(title)}</h2><p>${done} из ${lessons.length} уроков</p>${progressLine(done,lessons.length,`Модуль пройден на ${done} из ${lessons.length}`)}</header><div class="pnw-lessons">${rows}</div></section></div>`;
  }
  function songs(){
    if(!apiModule)return loading();
    const total=state.library.length,builtinCount=state.library.filter(item=>(item.source||'').startsWith('builtin')).length,mineCount=total-builtinCount,cards=state.library.map((item,index)=>songCard(item,index)).join(''),filters=[['all','Все',total],['mine','Мои',mineCount],['learning','Учебные',builtinCount]].map(([id,label,count])=>`<button type="button" data-pn-action="filter" data-filter="${id}" aria-pressed="${state.songFilter===id}">${label} <span>${count}</span></button>`).join('');
    return `<div class="pnw-songs"><div class="pnw-tools"><button type="button" class="pnw-import" data-pn-action="import">${icon('plus','pnw-icon')} Добавить MIDI</button><input id="pn-midi-import" type="file" accept=".mid,.midi,audio/midi" hidden><span id="pnw-song-count">${songCount(total)}</span></div>${total?`<div class="pnw-search">${icon('search','pnw-icon')}<input id="pnw-song-search" type="search" placeholder="Найти композицию" aria-label="Найти композицию" autocomplete="off" value="${escape(state.songQuery)}"><button type="button" class="pnw-search-clear" data-pn-action="clear-search" aria-label="Очистить поиск" ${state.songQuery?'':'hidden'}>${icon('close','pnw-icon')}</button></div><div class="pnw-filters" role="group" aria-label="Источник композиции"><span class="pnw-filter-ink" aria-hidden="true"></span>${filters}</div><div class="pnw-song-list">${cards}</div><p class="pnw-no-results" id="pnw-song-empty" hidden>Ничего не нашлось. <button type="button" data-pn-action="clear-filters">Сбросить</button></p>`:`<div class="pnw-empty"><h2>Первая композиция</h2><p>Добавь MIDI-файл. Flow разделит его на короткие участки для изучения.</p></div>`}</div>`;
  }
  function cover(c){const id=/moon|fly/i.test(c.id)?'moon':/elise/i.test(c.id)?'elise':/joy/.test(c.id)?'joy':/star/.test(c.id)?'star':'custom';return new URL('covers/'+id+'.svg',base).href;}
  function songProgress(c){const saved=state.snapshot.studyProgress?.[c.id],builtin=apiModule.COMPOSITIONS.find(x=>x.id===c.id);if(builtin){if(!saved)return '';if(!publicStudyPlans.has(c.id))publicStudyPlans.set(c.id,apiModule.createCompositionStudy(builtin));const plan=publicStudyPlans.get(c.id),summary=apiModule.studySummary(plan,saved);return summary.complete?'Сыграно самостоятельно':summary.guidedCompleted?`${summary.guidedCompleted} из ${summary.guidedTotal} шагов разобрано`:saved.version&&saved.version!==plan.version?'Прежний разбор сохранён':saved.cursor?'Продолжить с сохранённого места':'';}return saved?.mastery?'Самостоятельный проход сохранён':saved?.completed?.length?`${saved.completed.length} шагов в истории`:saved?.cursor?'Продолжить с сохранённого места':'';}
  function songCard(c,index){const data=apiModule.COMPOSITIONS.find(item=>item.id===c.id)||c,builtin=(c.source||data.source||'').startsWith('builtin'),level=data.level||(builtin?'Учебная версия':'Своя композиция'),tracks=Array.isArray(data.tracks)?data.tracks:[],hands=tracks.length?(tracks.length>1?'Две руки':'Правая рука'):'',seconds=Number.isFinite(data.duration)?Math.round(data.duration):0,duration=seconds?`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'',progressLabel=songProgress(c),meta=[data.author,level].filter(Boolean).join(' · '),status=tracks.length?`${hands}${duration?' · '+duration:''}`:'Свой MIDI';return `<button type="button" class="pnw-song" data-pn-action="song" data-song="${escape(c.id)}" data-source="${escape(c.source||data.source||'import')}" data-index="${index}"><img class="pnw-cover" src="${cover(c)}" alt="" draggable="false"><span class="pnw-song-copy"><strong>${escape(data.title||c.title)}</strong><span class="pnw-song-meta">${escape(meta)}</span><span class="pnw-song-status">${escape(status)}${progressLabel?` <em>${escape(progressLabel)}</em>`:''}</span></span>${icon('right','pnw-chev')}</button>`;}
  function progress(){
    if(!apiModule)return loading();
    const summary=apiModule.learning.learningSummary(state.snapshot.learningProgress,{date:localDate(),courseVersion:apiModule.ACTIVE_COURSE?2:1});
    const next=apiModule.learning.nextLearningTask(state.snapshot.learningProgress,planOptions()),currentSkills=new Set(next?.skillIds||[]);
    const skillRow=skill=>{const current=skill.due||currentSkills.has(skill.id),state=current?'current':(skill.ready||skill.retained)?'done':skill.covered?'practiced':'ahead',label=state==='current'?(skill.due?'Повторить':''):state==='done'?(skill.retained?(apiModule.ACTIVE_COURSE?'Получается в разные дни':'Сохраняется в памяти'):'Получается без помощи'):'',mark=state==='done'?icon('check','pnw-icon'):'';return `<div class="pnw-skill is-${state}"><span class="pnw-skill-mark" aria-hidden="true">${mark}</span><span class="pnw-skill-copy"><strong>${escape(skill.title)}</strong>${label?`<small>${escape(label)}</small>`:''}</span></div>`;};
    const current=summary.skills.filter(skill=>skill.due||currentSkills.has(skill.id)),done=summary.skills.filter(skill=>!current.includes(skill)&&(skill.ready||skill.retained)),practiced=summary.skills.filter(skill=>!current.includes(skill)&&!skill.ready&&!skill.retained&&skill.covered),ahead=summary.skills.filter(skill=>!skill.covered&&!current.includes(skill));
    const group=(title,items)=>items.length?`<section class="pnw-skill-group"><h3>${title}</h3>${items.map(skillRow).join('')}</section>`:'';
    const last=lastPractice(),recent=last?`<div class="pnw-recent"><small>Последняя попытка</small><strong>${escape(last.title||lessonTitle(last.lessonId)||'Занятие')}</strong><span>${escape(dayLabel(last.at))} · ${escape(activityLabel(last.status))}</span></div>`:'';
    return `<div class="pnw-progress"><div class="pnw-metrics"><div><strong>${summary.coveredSkills}<em>/${summary.totalSkills}</em></strong><span>Приёмов попробовал</span></div><div><strong>${summary.readySkills}</strong><span>Сыграл самостоятельно</span></div><div><strong>${summary.retainedSkills}</strong><span>${apiModule.ACTIVE_COURSE?'Повторил в разные дни':'Вспомнил в разные дни'}</span></div></div>${recent}${group('Сейчас',current)}${group('Получается',done)}${group('Пробовал',practiced)}${group('Впереди',ahead)}</div>`;
  }
  function readiness(){return `<section class="pnw-ready"><p class="pnw-kicker">Перед игрой · Casio CT-S200</p><h2>Устрой руки удобно</h2><p class="pnw-ready-lede">Выбери тембр Piano. Поставь телефон так, чтобы видеть экран и не поднимать плечи.</p><ul class="pnw-checks"><li><span class="pnw-check-num" aria-hidden="true">1</span><span>Плечи свободны, локти не прижаты.</span></li><li><span class="pnw-check-num" aria-hidden="true">2</span><span>Запястье ровное, пальцы слегка согнуты.</span></li><li><span class="pnw-check-num" aria-hidden="true">3</span><span>Играй мягко. Если рукам неудобно — сделай паузу.</span></li></ul><div class="pnw-ready-foot"><button type="button" class="pnw-action" data-pn-action="ready">Проверил, начинаем ${icon('play','pnw-icon')}</button><p class="pnw-note">Это твоя проверка удобства: приложение не видит руки.</p></div></section>`;}
  function errorState(){return `<div class="pnw-state" role="alert"><h2>Не удалось открыть раздел</h2><p>${escape(state.error)}</p><button type="button" class="pnw-action" data-pn-action="retry">Попробовать снова</button></div>`;}
  function notice(){return `<div class="pnw-notice" role="alert"><span class="pnw-notice-mark" aria-hidden="true">!</span><p>${escape(state.error)}</p><button type="button" data-pn-action="dismiss">Понятно</button></div>`;}
  function filterSongs(){
    const list=document.querySelector('.pnw-song-list');if(!list)return;
    const words=state.songQuery.toLocaleLowerCase('ru').trim().split(/\s+/).filter(Boolean);let visible=0,total=0;
    for(const card of list.querySelectorAll('.pnw-song')){total++;const builtin=(card.dataset.source||'').startsWith('builtin'),text=(card.textContent||'').toLocaleLowerCase('ru'),match=words.every(word=>text.includes(word))&&(state.songFilter==='all'||state.songFilter==='mine'&&!builtin||state.songFilter==='learning'&&builtin);card.hidden=!match;if(match)visible++;}
    const count=document.getElementById('pnw-song-count');if(count)count.textContent=visible===total?songCount(total):`${visible} из ${total}`;
    for(const button of document.querySelectorAll('.pnw-filters [data-filter]'))button.setAttribute('aria-pressed',String(button.dataset.filter===state.songFilter));
    const empty=document.getElementById('pnw-song-empty');if(empty)empty.hidden=visible>0;
    const clear=document.querySelector('.pnw-search-clear');if(clear)clear.hidden=!state.songQuery;
    placeFilterInk();
  }
  function placeFilterInk(){const row=document.querySelector('.pnw-filters'),ink=row?.querySelector('.pnw-filter-ink');if(!row||!ink)return;const active=row.querySelector('[data-filter][aria-pressed="true"]');if(!active){ink.style.width='0px';return;}ink.style.left=active.offsetLeft+'px';ink.style.width=active.offsetWidth+'px';}
  function focusSong(){if(!state.focusSong)return;const node=[...document.querySelectorAll('.pnw-song')].find(item=>item.dataset.song===state.focusSong);state.focusSong='';if(!node)return;node.scrollIntoView({block:'center'});node.focus({preventScroll:true});}
  function paint(){
    const content=document.getElementById('pn-content');if(!content)return;
    const tabKey=state.tab==='ready'?'today':state.tab;
    const view=state.error&&!state.loaded?errorState():!state.loaded?loading():state.tab==='program'?program():state.tab==='ready'?readiness():state.tab==='songs'?songs():state.tab==='progress'?progress():today();
    content.innerHTML=(state.error&&state.loaded?notice():'')+view;
    content.setAttribute('aria-labelledby','pnw-tab-'+tabKey);
    content.setAttribute('aria-busy',String(state.busy));
    for(const tab of document.querySelectorAll('.pnw-nav [role="tab"]')){const active=tab.dataset.tab===tabKey;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
    const back=document.getElementById('pn-back');if(back)back.setAttribute('aria-label',['program','ready'].includes(state.tab)?'Назад к занятию':'К разделам Flow');
    paintStatus();
    syncStickyTop();
    if(state.tab==='songs'&&state.library.length){filterSongs();requestAnimationFrame(focusSong);}
  }
  function ensureNativeSettingsTarget(){
    const root=document.getElementById('pn-player-root')?.shadowRoot;if(!root||root.getElementById('pn-settings-target'))return;
    const style=document.createElement('style');style.id='pn-settings-target';
    style.textContent='#settings-dialog .icon-button{min-width:44px!important;min-height:44px!important}';
    root.append(style);
  }
  async function engine(){
    await load();if(state.engine)return state.engine;if(state.enginePromise)return state.enginePromise;
    if(!state.player){state.player=document.createElement('section');state.player.className='pn-player-shell';state.player.hidden=true;state.player.setAttribute('aria-label','Занятие на пианино');state.player.setAttribute('role','dialog');state.player.setAttribute('aria-modal','true');document.body.append(state.player);}
    const host=document.createElement('div');host.id='pn-player-root';state.player.replaceChildren(host);
    state.enginePromise=apiModule.createNativePlayer(host,{call,isActive:()=>state.active,storageKey:key()+':player',initialState:state.snapshot,getLearningProgress:()=>state.snapshot.learningProgress,onStateChange:save,onNavigate:view=>{
      if(view==='practice'){showPlayer(true);audioFocus(true);}
      else{showPlayer(false);state.tab=state.settingsReturnTab||state.returnTab||(view==='library'?'songs':view==='progress'?'progress':'today');state.settingsReturnTab=null;state.returnTab=null;updatePlan();paint();}
    },onAssistance:task=>{state.snapshot.dailyRun={...state.snapshot.dailyRun,assistance:{...state.snapshot.dailyRun?.assistance,[task.id]:{helpedAt:Math.max(Date.now(),(state.snapshot.dailyRun?.assistance?.[task.id]?.helpedAt||0)+1,(state.snapshot.dailyRun?.assistance?.[task.id]?.consumedAt||0)+1),consumedAt:state.snapshot.dailyRun?.assistance?.[task.id]?.consumedAt||0}}};save(state.snapshot);},onReport:handleReport,onTaskSkip:handleTaskSkip,onTaskComplete:task=>{if(!state.active)return;updatePlan();if(task&&!apiModule.learning.isLearningTaskComplete(state.snapshot.learningProgress,task)){state.engine.pause();state.returnTab=null;showPlayer(false);state.tab='today';paint();return;}const next=apiModule.learning.nextLearningTask(state.snapshot.learningProgress,planOptions());if(next)openTask(next);else{state.engine.pause();state.returnTab=null;showPlayer(false);state.tab='today';paint();}}});
    try{state.engine=await state.enginePromise;ensureNativeSettingsTarget();return state.engine;}catch(error){state.enginePromise=null;throw error;}
  }
  function helpActive(id){const flag=state.snapshot.dailyRun?.assistance?.[id];return !!flag&&flag.helpedAt>flag.consumedAt;}
  async function handleTaskSkip(){
    if(!state.active)return;
    updatePlan();
    const next=apiModule.learning.nextLearningTask(state.snapshot.learningProgress,planOptions());
    if(next){await openTask(next);return;}
    state.engine?.pause();state.returnTab=null;showPlayer(false);state.tab='program';paint();
  }
  function handleReport(event){
    if(!event.task||event.source==='demo'||event.report?.demo===true)return;
    state.snapshot.learningProgress=apiModule.learning.recordLearningAttempt(state.snapshot.learningProgress,event.task,event.report,{at:Date.now(),date:event.task.date||localDate(),attemptId:event.attemptId,mode:event.mode,source:event.source,assisted:event.assisted||helpActive(event.task.id),cueVisible:event.cueVisible,beta:event.beta,breakdown:event.breakdown});
    if(state.snapshot.dailyRun?.assistance?.[event.task.id])state.snapshot.dailyRun.assistance[event.task.id].consumedAt=Math.max(Date.now(),state.snapshot.dailyRun.assistance[event.task.id].helpedAt);state.snapshot.updatedAt=Date.now();state.dirty=true;state.sync='pending';cache();clearTimeout(state.saveTimer);state.saveTimer=setTimeout(sync,700);updatePlan();
  }
  async function openTask(task,returnTab=null){
    if(!task)return;if(returnTab)state.returnTab=returnTab;state.busy=true;paint();
    try{const token=++state.request,p=await engine();if(!state.active||token!==state.request)return;if(task.kind==='song'||!task.lessonId){const id=task.compositionId||task.songId||state.snapshot.favoriteSongId;if(!id){state.pendingSongTask=task;state.tab='songs';showPlayer(false);paint();return;}await openSong(id,task);return;}showPlayer(true);p.openTask({...task,assisted:helpActive(task.id)});}
    catch(error){state.busy=false;state.error=error.message||'Не удалось открыть занятие.';paint();}finally{state.busy=false;}
  }
  async function openSong(id,task=null,returnTab=null){
    if(!id)throw new Error('Выбери композицию.');if(returnTab)state.returnTab=returnTab;state.busy=true;
    try{const token=++state.request,p=await engine(),profile=state.profile;if(!state.active||token!==state.request)return;if(!apiModule.COMPOSITIONS.some(c=>c.id===id)){let composition;try{const answer=await call('composition_get',{id});composition=answer.composition;void apiModule.putCachedComposition(profile,composition);}catch{composition=await apiModule.getCachedComposition(profile,id);if(!composition)throw new Error('Открой эту композицию один раз с интернетом, чтобы сохранить её на телефоне.');}if(!state.active||token!==state.request||profile!==state.profile)return;p.addComposition(composition);}state.snapshot.favoriteSongId=id;save(state.snapshot);showPlayer(true);p.openComposition(id,task);}
    finally{state.busy=false;}
  }
  async function action(button){
    const name=button.dataset.pnAction;
    if(name==='tab'){state.request++;state.tab=button.dataset.tab;state.error='';state.moduleOpen=false;paint();window.scrollTo(0,0);return;}
    if(name==='back'){if(['program','ready'].includes(state.tab)){state.tab='today';state.moduleOpen=false;paint();window.scrollTo(0,0);}else navigate('more');return;}
    if(name==='program'){state.tab='program';state.moduleOpen=false;state.error='';paint();window.scrollTo(0,0);return;}
    if(name==='toggle-modules'){state.moduleOpen=!state.moduleOpen;paint();requestAnimationFrame(()=>{(state.moduleOpen?document.querySelector('.pnw-module'):document.querySelector('.pnw-module-toggle'))?.focus();});return;}
    if(name==='module'){state.module=button.dataset.module;state.moduleOpen=false;paint();requestAnimationFrame(()=>{const toggle=document.querySelector('.pnw-module-toggle');if(toggle&&toggle.offsetParent!==null)toggle.focus();else document.querySelector('.pnw-module.is-active')?.focus();});return;}
    if(name==='goal'){const options=planOptions();state.focusSong=options.song?.id||'';state.songFilter='all';state.songQuery='';state.tab='songs';state.error='';paint();return;}
    if(name==='retry'){state.error='';loadPromise=null;await load();return;}
    if(name==='dismiss'){state.error='';paint();return;}
    if(name==='import'){document.getElementById('pn-midi-import')?.click();return;}
    if(name==='filter'){state.songFilter=button.dataset.filter||'all';filterSongs();return;}
    if(name==='clear-search'){state.songQuery='';const input=document.getElementById('pnw-song-search');if(input){input.value='';input.focus();}filterSongs();return;}
    if(name==='clear-filters'){state.songQuery='';state.songFilter='all';const input=document.getElementById('pnw-song-search');if(input)input.value='';filterSongs();input?.focus();return;}
    if(name==='settings'){const token=++state.request,p=await engine();if(!state.active||token!==state.request)return;state.settingsReturnTab=state.tab;showPlayer(true);ensureNativeSettingsTarget();p.showSettings();return;}
    if(name==='course'){const task=apiModule.learning.createPracticeTask(button.dataset.lesson,{...planOptions(),progress:state.snapshot.learningProgress});await openTask(task,'program');return;}
    if(name==='continue'){await load();if((state.readyDate||state.snapshot.dailyRun?.readyDate)!==localDate()){state.tab='ready';paint();window.scrollTo(0,0);return;}await openTask(apiModule.learning.nextLearningTask(state.snapshot.learningProgress,planOptions()),'today');return;}
    if(name==='ready'){state.readyDate=localDate();state.snapshot.dailyRun={...state.snapshot.dailyRun,readyDate:state.readyDate};save(state.snapshot);state.tab='today';await action({dataset:{pnAction:'continue'}});return;}
    if(name==='song'){const task=state.pendingSongTask||null;state.pendingSongTask=null;if(task)await openSong(button.dataset.song,task);else await openSong(button.dataset.song,null,'songs');}
  }
  document.addEventListener('click',event=>{const b=event.target.closest('[data-pn-action]');if(!b)return;event.preventDefault();event.stopImmediatePropagation();action(b).catch(error=>{state.busy=false;state.error=error.message||'Не получилось. Попробуй ещё раз.';paint();});});
  document.addEventListener('input',event=>{if(event.target.id!=='pnw-song-search')return;state.songQuery=event.target.value;filterSongs();});
  document.addEventListener('change',async event=>{
    if(event.target.id!=='pn-midi-import')return;const file=event.target.files?.[0];if(!file)return;event.target.value='';
    try{if(file.size>2*1024*1024)throw new Error('Выбери MIDI-файл до 2 МБ.');await load();const profile=state.profile,composition=apiModule.parseMidiComposition(await file.arrayBuffer(),file.name);const answer=await call('composition_import',{composition});if(profile!==state.profile)return;void apiModule.putCachedComposition(profile,composition);const added=answer.metadata||{id:composition.id,title:composition.title,author:composition.author};state.library=[...state.library.filter(c=>c.id!==added.id),added];(await engine()).addComposition(composition);state.songQuery='';state.songFilter='all';state.focusSong=added.id;if(state.active)paint();}
    catch(error){state.error=error.message||'Не удалось добавить MIDI.';paint();}
  });
  document.addEventListener('keydown',event=>{
    const tab=event.target.closest?.('.pnw-nav [role="tab"]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const tabs=[...document.querySelectorAll('.pnw-nav [role="tab"]')],index=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
    if(tabs[next]){tabs[next].click();tabs[next].focus();}
  });
  window.addEventListener('scroll',scheduleHeaderScroll,{passive:true});
  window.addEventListener('resize',()=>{if(!state.active||document.body.classList.contains('piano-playing'))return;clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{syncStickyTop();if(state.active&&['program','progress'].includes(state.tab))paint();else if(state.active&&state.tab==='songs')placeFilterInk();},160);});
  window.addEventListener('online',async()=>{if(!state.profile||state.sync==='offline'){loadPromise=null;try{await load(homeWarmOnly);if(homeWarmOnly&&typeof ui!=='undefined'&&ui.page==='today')render();}catch{}}if(state.dirty&&!homeWarmOnly)sync();});
  window.FlowPiano={practiceStatus,render:()=>`<section class="pnw-page" aria-labelledby="pnw-title"><header class="pnw-head"><button id="pn-back" class="pnw-head-button" type="button" data-pn-action="back" aria-label="К разделам Flow">${icon('left')}</button><h1 id="pnw-title">Пианино</h1><button id="pn-settings" class="pnw-head-button" type="button" data-pn-action="settings" aria-label="Настройки пианино">${icon('settings')}</button></header><nav class="pnw-nav" role="tablist" aria-label="Разделы пианино">${tabs()}</nav><div id="pn-content" class="pnw-content" role="tabpanel" aria-labelledby="pnw-tab-today"></div></section>`,mount:()=>{
    const active=typeof ui!=='undefined'&&ui.page==='piano';document.body.classList.toggle('piano-page',active);if(!active){if(!state.active)return;state.active=false;state.request++;state.busy=false;state.engine?.pause();if(state.player)showPlayer(false);document.body.classList.remove('piano-deck-open');state.screen=null;return;}
    state.active=true;document.body.classList.remove('piano-deck-open');const screen=document.querySelector('.pnw-page');if(screen!==state.screen){state.screen=screen;paint();load().catch(()=>{});}
  }};
})();
function renderPianoPage(){return window.FlowPiano.render();}
