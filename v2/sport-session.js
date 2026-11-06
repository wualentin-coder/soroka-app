/* Local guided presentation. The existing SportCore/spTimer owns all results and clocks. */
(() => {
  'use strict';
  const preferenceKey = 'flow.sport.session.map.v1';
  let state = null, result = null;
  const readMap = () => { try { return localStorage.getItem(preferenceKey) === '1'; } catch { return false; } };
  const el = (action, label, classes = '', attrs = '') => `<button type="button" class="${classes}" data-action="${action}" ${attrs}>${label}</button>`;
  const text = value => spEsc(value ?? '');
  function current() {
    const session = spTimer.session;
    if (!session) return null;
    if (state?.key !== session.key) state = { key: session.key, view: 'setup', selected: null, media: null, map: readMap(), warmup: 0, warmed: false, started: false, work: '', trigger: null };
    const C = SP(), exercises = session.option.plan.exercises, checks = spChecks();
    const counts = exercises.map((e, i) => C.completedSets(checks[i], C.exerciseSets(e)));
    const totals = exercises.map(e => C.exerciseSets(e));
    const first = counts.findIndex((n, i) => n < totals[i]);
    const selected = Number.isInteger(state.selected) && counts[state.selected] < totals[state.selected] ? state.selected : first;
    const index = spTimer.phase ? spShownIndex(spTimer.phase, first) : selected;
    if (spTimer.phase) state.selected=index;
    const done = counts.filter((n, i) => n >= totals[i]).length;
    return { C, session, option: session.option, exercises, counts, totals, first, index, done,
      totalSets: totals.reduce((a, b) => a + b, 0), doneSets: counts.reduce((a, b) => a + b, 0),
      exercise: exercises[index], phase: spTimer.phase };
  }
  function redraw(focus = false) {
    spOverlay(true);
    if (focus) document.querySelector('.ss-page [data-ss-heading]')?.focus({ preventScroll: true });
  }
  function safe() {
    const m = current();
    return m && !m.session.readOnly && !m.session.finished ? m : null;
  }
  function target(exercise) {
    return String(exercise.sets_reps || '').replace(/^\s*\d+\s*[×xх]\s*/i, '') || 'По плану';
  }
  function muscleIds(m) { return m.C.knownMuscles(m.exercise?.muscles?.primary); }
  function hasMap(m) { return muscleIds(m).length || m.C.knownMuscles(m.exercise?.muscles?.secondary).length; }
  function header(m, label) {
    return `<header class="ss-head"><div class="ss-brand"><span class="ss-brand-mark" aria-hidden="true">${SP_ICON.play}</span><span>${ui.sp.kind==='splits'?'Растяжка':'Сила'}</span></div><div class="ss-head-actions">${flowSportAuto.view()?.active&&flowSportAuto.view().step.block==='warmup'&&flowSportAuto.view().step.kind!=='boundary'?el('sp-auto-skip-warmup','Пропустить','ss-text','aria-label="Пропустить разминку"'):''}${!result&&!m.session.finished?el('sp-session-list',icon('list'),'ss-icon','aria-label="Все упражнения"'):''}${el('sp-session-minimize', icon('close'), 'ss-icon', 'aria-label="Свернуть тренировку"')}</div></header>
      <div class="ss-route" aria-label="Выполнено ${m.doneSets} из ${m.totalSets} подходов">${m.exercises.map((e, i) => `<i class="${m.counts[i] >= m.totals[i] ? 'done' : i === m.index ? 'active' : ''}" style="--ss-fill:${Math.round(m.counts[i] / m.totals[i] * 100)}%"></i>`).join('')}</div>
      <div class="ss-breadcrumb"><span>${flowSportAuto.view()?.active?'<b data-sp-elapsed aria-label="Время тренировки">00:00</b>':''}</span><span aria-label="Выполнено подходов">${m.doneSets}/${m.totalSets}</span></div>`;
  }
  function row(m, e, i, interactive = true) {
    return `<${interactive ? 'button type="button" data-action="sp-session-select" data-i="'+i+'"' : 'div'} class="ss-row ${m.counts[i] >= m.totals[i] ? 'is-done' : ''}" ${interactive && m.phase ? 'disabled' : ''}><span class="ss-order">${m.counts[i] >= m.totals[i] ? icon('check') : String(i+1).padStart(2, '0')}</span><span><strong>${text(e.name)}</strong><small>${text(e.sets_reps)} · ${m.counts[i]}/${m.totals[i]} подходов</small></span>${interactive ? '<span class="ss-row-arrow" aria-hidden="true">↗</span>' : ''}</${interactive ? 'button' : 'div'}>`;
  }
  function setup(m) {
    const warmup = m.option.warmup?.exercises || [];
    const config=flowSportAuto.settings();
    return `<section class="ss-main ss-setup"><div class="ss-kind-switch" role="group" aria-label="Направление тренировки">${[['main','Сила'],['splits','Растяжка']].map(([kind,label])=>el('sp-session-kind',label,ui.sp.kind===kind?'on':'',`data-kind="${kind}" aria-pressed="${ui.sp.kind===kind}"`)).join('')}</div><h1 data-ss-heading tabindex="-1">${text(m.option.plan.title)}</h1>
      <p class="ss-setup-meta">${m.exercises.length} ${spPlural(m.exercises.length,'упражнение','упражнения','упражнений')} · ${m.totalSets} ${spPlural(m.totalSets,'подход','подхода','подходов')}</p>
      <details class="ss-disclosure"><summary>Упражнения</summary><div class="ss-program">${m.exercises.map((e,i)=>row(m,e,i,false)).join('')}</div></details>
      <details class="ss-disclosure"><summary>Настройки</summary>${warmup.length?`<label class="ss-preference"><span>Разминка</span><input type="checkbox" data-ss-auto-setting="warmup" ${config.warmup?'checked':''}></label>`:''}<label class="ss-preference"><span>Карта мышц</span><input type="checkbox" data-ss-map ${state.map?'checked':''}></label>${window.flowSportRuntime?'':el('sp-session-demo','Показ · 6 с','ss-text','aria-label="Быстрый показ с сокращёнными интервалами по 6 секунд"')}</details></section>
      <footer class="ss-footer">${el('sp-session-begin',m.doneSets?'Продолжить':'Старт','primary-button ss-primary')}</footer>`;
  }
  function automatic(m,auto){
    const stamp=`data-ss-step="${text(flowSportAuto.commandKey())}"`;
    const step=auto.step,e=step.exercise,resting=step.kind==='rest'||step.kind==='between',preparing=step.kind==='prep';
    if(step.kind==='boundary')return `<section class="ss-main ss-summary"><h1 data-ss-heading tabindex="-1">Разминка завершена</h1></section><footer class="ss-footer">${el('sp-auto-continue-block','Продолжить','primary-button ss-primary',stamp)}</footer>`;
    const upcoming=resting||preparing?step:auto.next;
    const nextCard=upcoming?`<aside class="ss-next"><div><small>Далее</small><strong>${text(upcoming.exercise.name)}</strong></div></aside>`:'';
    const digits=el('sp-auto-pause','<b data-sp-time>--:--</b>','ss-timer-tap',`${stamp} data-ss-clock-tap aria-label="${auto.paused?'Продолжить':'Приостановить'} таймер" aria-pressed="${auto.paused}"`);
    const clock=`<div class="ss-timer-cluster"><div class="ss-timer-line">${el('sp-adjust','−','ss-timer-adjust',`${stamp} data-d="-15" aria-label="Уменьшить время на 15 секунд"`)}${window.flowSportMagic?flowSportMagic.face(digits):digits}${el('sp-adjust','+','ss-timer-adjust',`${stamp} data-d="15" aria-label="Добавить 15 секунд"`)}</div></div>`;
    const dose=target(e),doseLabel=m.C.holdSecondsFor(e)||e.mode==='manual'?dose:`${dose} повт.`;
    const setTrack=`<div class="ss-approach"><strong>Подход <b>${step.set}</b><span> / ${step.total}</span></strong><small>${text(doseLabel)}</small></div>`;
    const headline=resting||preparing?`<div class="ss-rest-title"><h1 data-ss-heading tabindex="-1">${preparing?'Подготовка':'Отдых'}</h1></div>${setTrack}${clock}${nextCard}`:`<div class="ss-exercise-title"><h1 data-ss-heading tabindex="-1">${text(e.name)}</h1></div>${setTrack}${clock}${media({...m,exercise:e})}`;
    return `<section class="ss-main ${resting||preparing?'ss-rest':'ss-automatic-work'} ss-has-flow" data-ss-swipe="${resting?'rest':'exercise'}" ${stamp}>${window.flowSportMagic?.column()||''}${auto.fast?'<p class="ss-demo-pill">Показ · 6 с</p>':''}${headline}${auto.error?`<p class="ss-quiet" role="alert">${text(auto.error)}</p>`:''}</section><footer class="ss-footer ${resting?'':'ss-footer-minimal'}">${resting?el('sp-auto-skip-rest','← Пропустить','primary-button ss-primary',`${stamp} aria-label="Пропустить отдых"`):el('sp-auto-skip-exercise','← Пропустить','ss-text',`${stamp} aria-label="Пропустить упражнение"`)+el(preparing?'sp-auto-skip-rest':'sp-auto-complete',preparing?'Продолжить':'Готово','primary-button ss-primary',`${stamp} aria-label="${preparing?'Начать сейчас':'Закончить подход раньше'}"`)}</footer>`;
  }
  function warmup(m) {
    const list = m.option.warmup?.exercises || [], index = Math.min(state.warmup, list.length - 1), e = list[index];
    if (!e) return setup(m);
    return `<section class="ss-main ss-warmup"><p class="ss-eyebrow">Разминка · ${index+1}/${list.length}</p><h1 data-ss-heading tabindex="-1">${text(e.name)}</h1><div class="ss-dose"><strong>${text(e.sets_reps)}</strong><span>по твоему плану</span></div>${e.technique ? `<p class="ss-tech-copy">${text(e.technique)}</p>` : ''}<p class="ss-quiet">Переходи дальше, когда закончишь. Разминка не добавляет силовые подходы в журнал.</p>${index+1<list.length ? `<aside class="ss-next"><small>Дальше</small><strong>${text(list[index+1].name)}</strong><span>${text(list[index+1].sets_reps)}</span></aside>` : '<p class="ss-lead">Дальше — основная тренировка.</p>'}</section>
      <footer class="ss-footer">${el('sp-session-warm-next', index+1<list.length ? 'Следующее упражнение' : 'Разминка выполнена', 'primary-button ss-primary')}<div class="ss-footer-pair">${el('sp-session-setup', 'К подготовке', 'ss-text')}${el('sp-session-begin', 'Перейти к тренировке', 'ss-text')}</div></footer>`;
  }
  function videoHtml(m, id) {
    const playing=spTimer.videoOpen===id;
    return `<div class="ss-video">${playing?`<iframe title="Техника: ${text(m.exercise.name)}" src="${text(m.C.youtubeEmbedUrl(id))}&autoplay=1" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`:el('sp-video-play',`<span>${SP_ICON.play}</span><strong>Смотреть</strong>`,'ss-video-launch',`data-id="${text(id)}"`)}${el('sp-external','YouTube ↗','ss-text',`data-url="https://www.youtube.com/watch?v=${text(id)}"`)}</div>`;
  }
  function media(m) {
    const e = m.exercise, muscles = hasMap(m), video = m.C.exerciseVideoId(e);
    const tab = state.media === 'muscles' && !muscles ? 'technique' : state.media;
    const tabs = `<div class="ss-tabs" role="group" aria-label="Сведения об упражнении">${[['technique','Техника'],['video','Видео'],...(muscles ? [['muscles','Мышцы']] : [])].map(([key,label]) => el('sp-session-media', label, tab===key?'on':'',`aria-expanded="${tab===key}" aria-controls="ss-media-panel" data-media="${key}"`)).join('')}</div>`;
    if(!tab)return `<section class="ss-media">${tabs}</section>`;
    let body;
    if (tab === 'video') body = video ? videoHtml(m, video) : `<div class="ss-no-media">${el('sp-external','Найти на YouTube ↗','ghost-button',`data-url="${text(m.C.videoSearchUrl(e))}"`)}</div>`;
    else if (tab === 'muscles') body = spMuscleMap(e.muscles);
    else body = `${e.technique ? `<p class="ss-tech-copy">${text(e.technique)}</p>` : '<p class="ss-quiet">Описание не добавлено</p>'}${state.map && muscles ? `<div class="ss-inline-map">${spMuscleMap(e.muscles)}</div>` : ''}`;
    return `<section class="ss-media">${tabs}<div class="ss-media-body" id="ss-media-panel" role="region" aria-label="${tab==='technique'?'Техника':tab==='video'?'YouTube':'Мышцы'}">${body}</div></section>`;
  }
  function next(m) {
    const index = m.index;
    const e = m.exercises[index];
    if (!e) return '';
    return `<aside class="ss-next"><span class="ss-next-marker" aria-hidden="true">↗</span><div><small>Далее · подход ${Math.min(m.counts[index]+1,m.totals[index])}/${m.totals[index]}</small><strong>${text(e.name)}</strong><span>${text(target(e))}</span></div></aside>`;
  }
  function workKey(m) { return `${m.session.key}|${m.index}|${m.counts[m.index]}`; }
  function work(m) {
    const e = m.exercise, i = m.index, total = m.totals[i], done = m.counts[i], p = m.phase;
    const resting = p?.kind === 'rest' || p?.kind === 'between';
    const working = state.work === workKey(m), timed = m.C.holdSecondsFor(e) > 0;
    const label = resting ? p.kind==='between'?'Перерыв между упражнениями':'Отдых между подходами' : p ? SP_PHASE_LABEL[p.kind] : working ? 'Выполняй в своём темпе' : 'Приготовься к подходу';
    const muscleLabels = muscleIds(m).map(id=>m.C.muscleLabel(id));
    const clock = p ? `<div class="ss-clock" role="timer" aria-label="Осталось времени"><b data-sp-time>--:--</b><span>${resting ? 'восстановись перед следующим подходом' : p.kind==='prep'?'займи исходное положение':'до конца удержания'}</span></div>` : '';
    const headline = resting ? `<div class="ss-rest-title"><p class="ss-eyebrow">${text(label)}</p><h1 data-ss-heading tabindex="-1">Восстанови дыхание</h1></div>${clock}${next(m)}` : `<div class="ss-exercise-title"><p class="ss-eyebrow">Упражнение ${i+1}/${m.exercises.length} · подход ${Math.min(done+1,total)}/${total}</p><h1 data-ss-heading tabindex="-1">${text(e.name)}</h1>${muscleLabels.length ? `<p class="ss-muscle-caption">${text(muscleLabels.join(' · '))}</p>` : ''}</div>${p ? clock : `<div class="ss-dose"><strong>${text(target(e))}</strong><span>${working ? 'выполни подход' : 'цель этого подхода'}</span></div>`}<div class="ss-set-track" aria-label="Выполнено ${done} из ${total} подходов">${Array.from({length:total},(_,n)=>`<span class="${n<done?'done':n===done?'current':''}">${n<done?icon('check'):n+1}</span>`).join('')}</div>${media(m)}`;
    let controls;
    if (p) controls = `<div class="ss-clock-controls">${el('sp-adjust','−15 с','', 'data-d="-15" aria-label="Уменьшить таймер на 15 секунд"')}${el('sp-pause',`<span data-sp-pause-label>${spTimer.clock?.running?'Пауза':'Дальше'}</span>`)}${el('sp-adjust','+15 с','', 'data-d="15" aria-label="Добавить 15 секунд"')}</div>${el('sp-skip',resting?'Продолжить сейчас':SP_SKIP_LABEL[p.kind],'primary-button ss-primary')}${!resting?el('sp-cancel-set','Отменить подход','ss-text'):''}`;
    else controls = el(timed || working ? 'sp-session-complete' : 'sp-session-work',timed?'Начать удержание':working?'Подход выполнен':'Начать подход','primary-button ss-primary',`data-i="${i}"`);
    return `<section class="ss-main ${resting?'ss-rest':''}">${headline}${resting ? `<p class="ss-quiet ss-rest-note">${spTimer.clock?.running?'Отсчёт идёт':'Таймер на паузе'}. Время можно изменить под свой темп.</p>` : ''}</section><footer class="ss-footer">${controls}<div class="ss-footer-pair">${el('sp-session-list','Все упражнения','ss-text')}${el('sp-session-journal','Журнал подходов','ss-text',`data-i="${i}"`)}</div></footer>`;
  }
  function list(m) {
    return `<section class="ss-main"><h1 data-ss-heading tabindex="-1">Упражнения</h1><div class="ss-program">${m.exercises.map((e,i)=>row(m,e,i)).join('')}</div><div class="ss-session-links">${el('sp-session-journal','Журнал','ss-text')}${el('sp-session-finish','Завершить','ss-text')}${el('sp-session-stop','Остановить','ss-text')}</div></section><footer class="ss-footer">${el('sp-session-back','Назад','primary-button ss-primary')}</footer>`;
  }
  function summary(m, confirm = false) {
    const complete=m.done===m.exercises.length,saved=!spState().saveError&&!spState().pending?.length;
    return `<section class="ss-main ss-summary"><h1 data-ss-heading tabindex="-1">${confirm?'Завершить?':'Готово'}</h1><p class="ss-setup-meta">${m.doneSets}/${m.totalSets} подходов · ${m.done}/${m.exercises.length} упражнений</p>${confirm&&!complete?'<p class="ss-quiet">Оставшиеся подходы не засчитаются.</p>':''}<details class="ss-disclosure"><summary>Результаты</summary><div class="ss-program">${m.exercises.map((e,i)=>row(m,e,i,false)).join('')}</div><p class="ss-quiet">${m.automatic?'Повторы и вес не измерялись. ':''}${saved?'Сохранено.':'Ожидает синхронизации.'}</p></details></section><footer class="ss-footer">${el(confirm?'sp-session-confirm-finish':'sp-session-minimize',confirm?'Завершить':'Закрыть','primary-button ss-primary')}${confirm?el('sp-session-back','Продолжить','ss-text'):''}</footer>`;
  }
  function html() {
    if(result)return `<div class="sp-runner ss-page" role="dialog" aria-modal="true" aria-label="Результат тренировки">${header(result,'Итог')}<div class="ss-content">${summary(result)}</div></div>`;
    const m = current();
    if (!m) return '';
    if (m.phase) state.started = true;
    let content, label;
    if (state.view==='summary' || m.session.finished) { content=summary(m);label='Итог'; }
    else if (state.view==='confirm') { content=summary(m,true);label='Завершение'; }
    else if (state.view==='list') { content=list(m);label='Упражнения'; }
    else if (flowSportAuto.view()?.active) { const auto=flowSportAuto.view();content=automatic(m,auto);label=auto.step.block==='warmup'?'Разминка':auto.step.kind==='work'?'Упражнение':auto.step.kind==='prep'?'Подготовка':'Отдых'; }
    else if (state.view==='warmup'&&!m.phase) { content=warmup(m);label='Разминка'; }
    else if (state.view==='setup'&&!m.phase&&!state.started) { content=setup(m);label='Подготовка'; }
    else if (m.first<0) { content=summary(m,true);label='Все подходы выполнены'; }
    else { content=work(m);label=m.phase?SP_PHASE_LABEL[m.phase.kind]:'Тренировка'; }
    return `<div class="sp-runner ss-page" role="dialog" aria-modal="true" aria-label="Режим тренировки">${header(m,label)}<div class="ss-content">${content}</div></div>`;
  }
  const nativeFinish = SP_ACTIONS['sp-finish'],nativeDismiss=SP_ACTIONS['sp-dismiss'],nativeVideoPlay=SP_ACTIONS['sp-video-play'],nativeAdjust=SP_ACTIONS['sp-adjust'];
  spRunnerHtml = html;
  Object.assign(SP_ACTIONS, {
    'sp-dismiss': control=>{flowSportAuto.stop();if(state){state.started=false;state.view='setup';}nativeDismiss(control);},
    'sp-finish': control=>{flowSportAuto.stop();nativeFinish(control);},
    'sp-video-play': control=>{flowSportAuto.pauseOnly();nativeVideoPlay(control);},
    'sp-adjust':control=>{if(control.dataset.ssStep&&!flowSportAuto.accepts(control.dataset.ssStep))return;nativeAdjust(control);},
    'sp-runner': control => {
      result=null;
      const m=current();if(!m||m.session.readOnly)return;
      if(m.phase&&!flowSportAuto.view()?.active){spSetPhase(null);state.started=false;state.view='setup';}
      state.trigger=control||document.activeElement;
      if(flowSportAuto.view()?.active||m.session.finished){state.started=true;if(state.view==='setup')state.view='work';}else{state.started=false;state.view='setup';}
      spTimer.videoOpen=false;spTimer.runner=true;spTimer.dismissed=false;redraw(true);
    },
    'sp-session-minimize': () => {
      const m=current();if(!m)return;
      flowSportAuto.pauseOnly();
      SP_ACTIONS['sp-runner-close']();
      result=null;
      const trigger=state.trigger?.isConnected?state.trigger:document.querySelector('[data-action="sp-runner"]');trigger?.focus({preventScroll:true});
    },
    'sp-session-begin': () => {
      const m=safe();if(!m)return;
      if(flowSportAuto.begin(m)===false)return;state.started=true;state.view='work';state.media=null;redraw(true);
    },
    'sp-session-demo': () => {const m=safe();if(!m)return;if(flowSportAuto.begin(m,true)===false)return;state.started=true;state.view='work';redraw(true);},
    'sp-auto-pause':control=>{if(flowSportAuto.accepts(control.dataset.ssStep))flowSportAuto.pause();},
    'sp-auto-skip-rest':control=>flowSportAuto.skipRest(control.dataset.ssStep),
    'sp-auto-complete':control=>flowSportAuto.completeNow(control.dataset.ssStep),
    'sp-auto-skip-exercise':control=>flowSportAuto.skipExercise(control.dataset.ssStep),
    'sp-auto-continue-block':control=>{if(flowSportAuto.accepts(control.dataset.ssStep))flowSportAuto.continueBlock();},
    'sp-auto-skip-warmup':()=>flowSportAuto.skipWarmup(),
    'sp-session-kind':control=>{if(!['main','splits'].includes(control.dataset.kind))return;flowSportAuto.stop();result=null;state=null;ui.sp.kind=control.dataset.kind;ui.sp.kindPick={date:ui.sp.date,kind:ui.sp.kind};spTimer.session=null;render();const option=spCurrentOption();if(option)spTimerRegister(option,false,Boolean(ui.sp.state.workouts?.[option.key]));SP_ACTIONS['sp-runner'](control);},
    'sp-session-setup': () => { current();state.view='setup';state.started=false;redraw(true); },
    'sp-session-warmup': () => { const m=safe();if(!m||m.phase)return;state.view='warmup';state.warmup=0;redraw(true); },
    'sp-session-warm-next': () => { const m=safe();if(!m)return;const n=m.option.warmup?.exercises.length||0;if(++state.warmup>=n){state.warmed=true;state.view='setup';}redraw(true); },
    'sp-session-work': () => { const m=safe();if(!m||m.phase||!m.exercise)return;state.work=workKey(m);redraw(true); },
    'sp-session-complete': control => {
      const m=safe();if(!m||m.phase||!m.exercise||Number(control.dataset.i)!==m.index)return;
      if(!m.C.holdSecondsFor(m.exercise)&&state.work!==workKey(m))return;
      state.work='';state.selected=m.index;state.media=null;
      spStartSet(m.index,m.totals[m.index]);render();redraw(true);
    },
    'sp-session-media': control => {
      const m=current();if(!m)return;
      const selected=control.dataset.media;state.media=state.media===selected?null:selected;spTimer.videoOpen=false;redraw();
      document.querySelector(`.ss-tabs [data-media="${selected}"]`)?.focus({preventScroll:true});
    },
    'sp-session-list': () => { current();flowSportAuto.pauseOnly();state.view='list';spTimer.videoOpen=false;redraw(true); },
    'sp-session-back': () => { current();state.view=flowSportAuto.view()?.active||state.started?'work':'setup';redraw(true); },
    'sp-session-select': control => { const m=safe(),i=Number(control.dataset.i);if(!m||m.phase||!m.exercises[i]||m.counts[i]>=m.totals[i])return;state.selected=i;state.view='work';state.media=null;state.work='';spTimer.videoOpen=false;redraw(true); },
    'sp-session-journal': () => { const m=safe();if(!m||!m.exercise)return;flowSportAuto.pauseOnly();spTimer.runner=false;spTimer.videoOpen=false;spOverlay(true);spOpenWeight(m.option,m.index); },
    'sp-session-finish': () => { const m=safe();if(!m)return;flowSportAuto.pauseOnly();state.view='confirm';spTimer.videoOpen=false;redraw(true); },
    'sp-session-confirm-finish': () => { const m=safe();if(!m)return;flowSportAuto.stop();nativeFinish({dataset:{close:'1'}});result=m;result.automatic=true;spTimer.runner=true;redraw(true); },
    'sp-session-stop': () => { SP_ACTIONS['sp-dismiss'](); },
  });
  document.addEventListener('change',event=>{
    if(event.target.matches?.('[data-ss-auto-setting]')){flowSportAuto.configure(event.target.dataset.ssAutoSetting,event.target.type==='checkbox'?event.target.checked:event.target.value);return;}
    if(!event.target.matches?.('[data-ss-map]'))return;
    current();state.map=event.target.checked;try{localStorage.setItem(preferenceKey,state.map?'1':'0');}catch{}
  });
  // A gesture belongs to the phase on which it started, even if its timer expires mid-swipe.
  let swipe=null,suppressClickUntil=0;
  const cancelSwipe=()=>{swipe=null;};
  document.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||event.button!==0)return;
    const root=event.target.closest?.('[data-ss-swipe]');
    if(!root||event.target.closest('a,input,iframe,[role="tab"],button:not([data-ss-clock-tap])'))return;
    swipe={id:event.pointerId,x:event.clientX,y:event.clientY,root,stamp:root.dataset.ssStep,kind:root.dataset.ssSwipe,vertical:false};
  });
  document.addEventListener('pointermove',event=>{
    if(!swipe||swipe.id!==event.pointerId)return;
    const dx=event.clientX-swipe.x,dy=event.clientY-swipe.y;
    if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx))swipe.vertical=true;
    if(!swipe.vertical&&dx< -12&&Math.abs(dx)>Math.abs(dy)*1.4)event.preventDefault();
  },{passive:false});
  document.addEventListener('pointerup',event=>{
    const start=swipe;swipe=null;if(!start||start.id!==event.pointerId)return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(start.vertical||!start.root.isConnected||dx> -64||Math.abs(dx)<Math.abs(dy)*1.4||!flowSportAuto.accepts(start.stamp))return;
    suppressClickUntil=Date.now()+400;event.preventDefault();
    if(start.kind==='rest')flowSportAuto.skipRest(start.stamp);else flowSportAuto.skipExercise(start.stamp);
  });
  document.addEventListener('pointercancel',cancelSwipe);
  document.addEventListener('visibilitychange',cancelSwipe);
  document.addEventListener('click',event=>{if(Date.now()<suppressClickUntil&&event.target.closest?.('.ss-page')){event.preventDefault();event.stopImmediatePropagation();}},true);
  document.addEventListener('keydown',event=>{
    const root=document.querySelector('.ss-page');if(!root||spState().sheet)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();SP_ACTIONS['sp-session-minimize']();return;}
    if(event.key!=='Tab')return;
    const items=[...root.querySelectorAll('button:not(:disabled),input,summary,a[href],iframe,[tabindex="0"]')].filter(e=>e.getClientRects().length);
    const first=items[0],last=items.at(-1);
    if(event.shiftKey&&(document.activeElement===first||!root.contains(document.activeElement))){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&(document.activeElement===last||!root.contains(document.activeElement))){event.preventDefault();first?.focus();}
  },true);
  flowSportAuto.onFinish((model,info)=>{nativeFinish({dataset:{close:'1'}});result={...model,...info};spTimer.runner=true;redraw(true);});
  window.flowSportSession={current:()=>result||current(),html,reset:()=>{state=null;result=null;swipe=null;suppressClickUntil=0;}};
})();
