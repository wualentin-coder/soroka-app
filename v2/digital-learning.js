/* Presentation port of Digital Magic learning pages. Actions and progress stay native. */
(() => {
  'use strict';
  if (document.documentElement.dataset.flowDesign === 'classic') return;
  const html = value => { const template = document.createElement('template'); template.innerHTML = String(value || ''); return template.content; };
  const node = value => html(value).firstElementChild;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const enabled = () => document.documentElement.dataset.flowDesign === 'magic';
  const helpers = () => window.flowMagicUI;
  const serialize = fragment => { const holder = document.createElement('div'); holder.append(fragment); return holder.innerHTML; };
  const icon = name => typeof window.icon === 'function' ? window.icon(name, 'icon-sm') : '';
  function section(title, side = '') { return helpers()?.sectionHeading(title, side) || `<div class="section-heading"><h2>${escape(title)}</h2>${side}</div>`; }
  function hero(options) {
    if (helpers()?.hero) return helpers().hero(options);
    return `<section class="hero-card"><div class="hero-kicker">${options.kicker || ''}</div><div class="hero-content"><h2>${options.title || ''}</h2><p>${options.description || ''}</p><div class="hero-bottom">${options.actionHTML || ''}</div></div></section>`;
  }
  function heading(fragment, kicker, title, piano = false) {
    const previous = fragment.querySelector(piano ? '.piano-header' : '.page-header,.page-heading');
    if (!previous || !helpers()?.heading) return;
    const side = piano ? [...previous.querySelectorAll('button')].map(button => button.outerHTML).join('') : previous.querySelector('.header-actions,.heading-side')?.innerHTML || '';
    previous.replaceWith(html(helpers().heading(kicker, title, side)));
  }
  function compactNavigation(fragment, page) {
    const tabs = page.querySelector(':scope > .en-tabs,:scope > .sp-tabs,:scope > .pn-tabs');
    const head = fragment.querySelector('.page-heading'); head?.classList.add('dl-learning-heading'); if (!tabs || !head) return;
    const navigation = document.createElement('nav'); navigation.className = 'dl-module-nav';
    navigation.setAttribute('aria-label', page.classList.contains('dl-english-page') ? 'Разделы английского' : page.classList.contains('dl-sport-page') ? 'Разделы спорта' : 'Разделы пианино');
    if (tabs.classList.contains('en-tabs') && !tabs.querySelector('[data-tab="progress"]')) {
      const progress = node('<button type="button" role="tab" data-action="en-tab" data-tab="progress">Прогресс</button>');
      progress.setAttribute('aria-selected', String(typeof enState === 'function' && enState().tab === 'progress')); tabs.append(progress);
    }
    if (tabs.classList.contains('en-tabs') && typeof enState==='function' && enState().tab==='phrases') {const words=tabs.querySelector('[data-tab=words]');words?.setAttribute('aria-selected','true');words?.classList.add('active');}
    if (tabs.classList.contains('pn-tabs') && !tabs.querySelector('[data-pn-action=program]')) tabs.append(node('<button type="button" role="tab" data-pn-action="program" data-tab="program" aria-selected="false">Программа</button>'));
    tabs.classList.add('dl-learning-nav-items'); navigation.append(tabs); if(page.contains(head)) head.after(navigation); else page.prepend(navigation);
    head.classList.add('dl-learning-heading');
  }
  function wrap(name, transform) {
    const original = window[name];
    if (typeof original !== 'function' || original.flowLearningWrapped) return;
    const wrapped = function (...args) {
      const originalHTML = original.apply(this, args);
      if (!enabled()) return originalHTML;
      const fragment = html(originalHTML);
      transform(fragment);
      return serialize(fragment);
    };
    wrapped.flowLearningWrapped = true;
    window[name] = wrapped;
  }
  function heroFromCard(card, kind, options = {}) {
    const title = card.querySelector('h2,h3');
    if (!title) return null;
    let kicker = card.querySelector('.sp-kicker,.pn-eyebrow')?.innerHTML || options.kicker || '';
    const program = card.querySelector('.sp-card-head:first-child > span'); if (program) kicker += ` · ${program.innerHTML}`;
    const description = options.description ?? card.querySelector('p.section-note,p:not([class]),.sp-today-title small')?.innerHTML ?? '';
    const actions = [...card.querySelectorAll('button,a[href]')].filter(button => !button.matches('.sp-today-title'));
    const actionHTML = actions.map(button => button.outerHTML).join('') + (card.querySelector('.sp-pill')?.outerHTML || '');
    const output = node(hero({ kicker, title: title.innerHTML, description, actionHTML, art: kind }));
    if (!output) return null;
    output.classList.add('dl-learning-hero', `dl-hero-${kind}`);
    return output;
  }

  // Learning v10 is composed around the native task, not the old card hierarchy.
  const learningOpen=new Map();
  const element=(tag,className,contents='')=>{const el=document.createElement(tag);el.className=className;if(contents)el.innerHTML=contents;return el;};
  function learningHeading(fragment,page,kind,title,caption){
    const original=fragment.querySelector('.page-heading,.page-header');
    const head=element('header','page-heading dm-page-heading lv-heading',`<span class="lv-module-mark" aria-hidden="true">${window.flowMagicObject?.(kind,true)||icon(kind==='english'?'study':'heart')}</span><div><p class="date">${escape(caption)}</p><h1>${escape(title)}</h1></div>`);
    if(original)original.replaceWith(head);else page.before(head);
    const tabs=page.querySelector(':scope>.en-tabs,:scope>.sp-tabs');if(!tabs)return;
    if(kind==='english'&&!tabs.querySelector('[data-tab=progress]'))tabs.append(node('<button type="button" role="tab" data-action="en-tab" data-tab="progress">Прогресс</button>'));
    const state=kind==='english'?enState():spState();
    for(const button of tabs.querySelectorAll('[data-tab]')){const selected=button.dataset.tab===(state.tab==='phrases'?'words':state.tab||'today');button.setAttribute('aria-selected',String(selected));button.classList.toggle('active',selected);}
    const nav=element('nav','lv-module-nav');nav.setAttribute('aria-label',kind==='english'?'Разделы английского':'Разделы спорта');nav.append(tabs);page.prepend(nav);
  }
  function region(title,className=''){
    const section=element('section','lv-region '+className);if(title)section.append(element('header','lv-region-head',`<h2>${escape(title)}</h2>`));return section;
  }
  function disclosure(title,key,open=false,className=''){
    const details=element('details','lv-disclosure '+className,`<summary>${escape(title)}<span aria-hidden="true">${icon('down')}</span></summary>`);details.dataset.learningDisclosure=key;details.open=learningOpen.has(key)?learningOpen.get(key):open;return details;
  }
  function extras(page,layout){
    const rest=[...page.children].filter(n=>n!==layout&&!n.matches('.lv-module-nav,.en-sync,.en-sync-banner,[role=status],.sp-demo,.sp-error'));
    if(!rest.length)return;const secondary=region('Ещё для практики','lv-secondary');secondary.append(...rest);layout.append(secondary);
  }
  function englishToday(page,state){
    const source=page.querySelector(':scope>.en-hero');if(!source)return;
    const layout=element('div','lv-overview'),lead=element('section','lv-lesson-scene'),topic=state.today?.unit?.topic;
    const stamp=source.querySelector('.en-hero-top small');
    lead.append(element('p','lv-eyebrow',stamp?.innerHTML||'Занятие на сегодня'));
    lead.append(element('h2','lv-scene-title',escape(topic?.title||source.querySelector('h2')?.textContent||'Моя практика')));
    if(topic?.goal)lead.append(element('p','lv-scene-copy',escape(topic.goal)));
    const path=element('div','lv-lesson-route');for(const step of source.querySelectorAll('.en-step')){step.classList.add('lv-lesson-step');path.append(step);}
    const actions=element('div','lv-scene-actions');for(const button of source.querySelectorAll(':scope>button'))actions.append(button);lead.append(actions);if(path.children.length)lead.append(path);
    const streak=source.querySelector('.en-streak');if(streak)lead.append(streak);
    source.replaceWith(layout);layout.append(lead);
    const rhythm=page.querySelector(':scope>.en-goals');if(rhythm){rhythm.classList.add('lv-rhythm');layout.append(rhythm);}
    const place=page.querySelector(':scope>.en-place');if(place){place.classList.add('lv-assessment');layout.append(place);}
    const links=page.querySelector(':scope>.en-today-links');if(links){links.classList.add('lv-quick-links');layout.append(links);}
    extras(page,layout);
  }
  function englishWords(page){
    const source=page.querySelector(':scope>.en-hero'),list=page.querySelector('.en-wlist'),search=page.querySelector('#en-wsearch')?.closest('label');if(!source||!list||!search)return;
    const filters=list.previousElementSibling,layout=element('div','lv-lexicon'),desk=element('section','lv-word-desk'),tools=element('div','lv-search-actions'),learn=source.querySelector('[data-action=en-deck]');
    tools.append(search);if(learn)tools.append(learn);desk.append(tools);if(filters?.matches('.map-categories'))desk.append(filters);desk.append(list);
    const side=region('Мой словарь','lv-word-rhythm');const title=source.querySelector('.en-hero-top'),bar=source.querySelector(':scope>.en-bar');if(title)side.append(title);if(bar)side.append(bar);
    for(const button of source.querySelectorAll('button'))side.append(button);
    const settings=disclosure('Ритм и частота слов','en-words-rhythm',false);for(const card of page.querySelectorAll(':scope>.en-situation'))settings.append(card);const note=source.querySelector('.section-note');if(note)settings.append(note);
    const phrases=page.querySelector('.en-phrases-link');if(phrases){phrases.classList.add('lv-destination');side.append(phrases);}side.append(settings);
    source.replaceWith(layout);layout.append(desk,side);extras(page,layout);
  }
  function englishCourse(page){
    const source=page.querySelector(':scope>.en-hero'),levels=[...page.querySelectorAll(':scope>.en-level')];if(!source)return;
    const layout=element('div','lv-course'),lesson=region('Текущий урок','lv-current-lesson'),path=element('div','lv-course-path');
    const modes=source.querySelector('.en-modes'),note=source.querySelector('.section-note');if(modes)modes.remove();if(note)note.remove();
    const title=source.querySelector('.en-hero-top');if(title)lesson.append(title);
    const current=page.querySelector('.en-unit.current');if(current){const go=node('<button type="button" class="primary-button" data-action="en-unit-go">Продолжить урок '+icon('arrow')+'</button>');go.dataset.key=current.dataset.key;lesson.append(go);}
    const formats=disclosure('Выбрать упражнение','en-practice-formats',false,'lv-practice-formats');if(modes)formats.append(modes);if(note)formats.append(note);
    for(const level of levels){
      const label=level.querySelector(':scope>.en-row'),name=label?.querySelector('b')?.textContent||'Уровень',count=label?.querySelector('small')?.textContent||'',active=!!level.querySelector('.en-unit.current,.en-unit-more');
      const group=active?region(name,'lv-path-level'):disclosure(name,'en-level-'+name,false,'lv-path-level');
      const summary=group.querySelector('summary,.lv-region-head');summary?.append(element('small','lv-path-count',escape(count)));label?.remove();
      const completed=disclosure('Пройденные уроки','en-done-'+name,!![...level.querySelectorAll('.en-unit.done')].some(n=>n.nextElementSibling?.matches('.en-unit-more')),'lv-past-lessons');
      for(const child of [...level.children]){
        if(child.matches('.en-unit')){child.classList.add('lv-path-unit');if(child.classList.contains('current'))child.setAttribute('aria-current','step');const target=child.classList.contains('done')?completed:group;target.append(child);}
        else if(child.matches('.en-unit-more')){const last=completed.lastElementChild?.matches('.en-unit.done')&&!(group.lastElementChild?.matches('.en-unit'));(last?completed:group).append(child);}
        else group.append(child);
      }
      if(completed.querySelector('.en-unit'))group.append(completed);
      path.append(group);level.remove();
    }
    source.replaceWith(layout);layout.append(lesson,path,formats);extras(page,layout);
  }
  function englishLibrary(page,state){
    const tabs=page.querySelector(':scope>.en-media-tabs');if(tabs)tabs.classList.add('lv-media-switch');if(state.mediaTab==='music'){page.classList.add('lv-music');return;}
    const upload=page.querySelector('[data-en-upload]')?.closest('.en-hero'),catalog=page.querySelector(':scope>.en-situation');if(!upload||!catalog)return;
    const layout=element('div','lv-library'),tools=element('div','lv-library-tools'),action=upload.querySelector('.en-upload');
    if(action){action.classList.remove('primary-button','en-go');action.classList.add('lv-upload','ghost-button');tools.append(action);}tools.append(element('span','lv-file-formats','txt · fb2 · epub · pdf'));
    const current=page.querySelector('.en-continue');if(current){const book=current.querySelector('.en-book');const resume=region('Продолжить чтение','lv-reading-now');if(book)resume.append(book);layout.append(resume);current.remove();}
    const mine=[...upload.querySelectorAll('.en-book')],personal=region('Мои книги','lv-my-books');
    if(mine.length){personal.querySelector('header').append(tools);const ownShelf=element('div','lv-book-shelf');ownShelf.append(...mine);personal.append(ownShelf);layout.append(personal);}upload.remove();
    const shelf=region('Библиотека Flow','lv-flow-books'),body=element('div','lv-book-shelf');
    for(const child of [...catalog.children]){if(child.matches('.en-row'))continue;body.append(child);}if(!body.querySelector('.en-book'))body.append(element('p','lv-empty-inline','В библиотеке пока нет книг. Можно загрузить свою.'));if(!mine.length)shelf.querySelector('header').append(tools);shelf.append(body);layout.append(shelf);catalog.replaceWith(layout);
  }
  wrap('renderEnglishPage',fragment=>{
    const practice=fragment.querySelector('.en-run');if(practice){practice.classList.add('lv-practice');return;}
    const reader=fragment.querySelector('.en-reader');if(reader){reader.classList.add('lv-reader');reader.querySelector('.en-rset')?.classList.add('lv-en-editor');return;}
    const page=fragment.querySelector('.en-page');if(!page)return;const state=enState();page.classList.add('lv-learning','lv-en-v10');page.dataset.lvView=state.tab||'today';
    const titles={today:'Английский',words:'Слова',course:'Мой курс',read:'Медиатека',chat:'Разговор',progress:'Мой прогресс',phrases:'Мои фразы'};
    learningHeading(fragment,page,'english',titles[state.tab]||'Английский','Английский · личная практика');
    if(!state.tab||state.tab==='today')englishToday(page,state);
    else if(state.tab==='words')englishWords(page);
    else if(state.tab==='course')englishCourse(page);
    else if(state.tab==='read')englishLibrary(page,state);
    else if(state.tab==='chat'){page.classList.add('lv-en-chat');page.querySelector('.en-chat')?.classList.add('lv-conversation');}
    else if(state.tab==='progress'){page.querySelector('.en-metrics')?.classList.add('lv-evidence');for(const card of page.querySelectorAll(':scope>.en-situation'))card.classList.add('lv-progress-section');if(state.progress?.days&&!state.progress.days.some(day=>day.count)){const days=page.querySelector('.en-days');if(days){days.classList.add('lv-no-history');days.append(element('p','lv-empty-inline','Ритм появится после первых занятий.'));}}}
    else if(state.tab==='phrases')page.classList.add('lv-phrase-library');
  });

  function sportCalendar(page,state,training=false){
    const week=page.querySelector(':scope>.sp-week'),four=page.querySelector(':scope>.sp-calendar');if(!week)return null;
    const frame=element('section','lv-day-scene'),calendar=element('div','lv-sport-calendar'),head=element('div','lv-calendar-heading'),nativeHead=week.querySelector('.sp-week-head'),label=nativeHead?.querySelector('b')?.textContent||'';
    head.append(element('h2','',escape(label)));const arrows=element('div','lv-calendar-arrows');const activeHead=four?.querySelector('.sp-cal-head')||nativeHead;for(const button of activeHead?.querySelectorAll('.icon-button')||[])arrows.append(button);head.append(arrows);
    const modes=element('div','lv-period-switch',`<button type="button" data-lv-sport-period="week" aria-pressed="${!state.monthOpen}">Неделя</button><button type="button" data-lv-sport-period="four" aria-pressed="${!!state.monthOpen}">4 недели</button>`);calendar.append(head,modes);
    if(state.monthOpen&&four){const period=four.querySelector('.sp-cal-head>div');if(period){period.classList.add('lv-period-caption');calendar.append(period);}for(const child of [...four.children])if(!child.matches('.sp-cal-head'))calendar.append(child);four.remove();}
    else{const days=week.querySelector('.sp-week-days');if(days)calendar.append(days);}
    for(const today of week.querySelectorAll('[data-action=sp-today]'))calendar.append(today);
    week.remove();frame.append(calendar);frame.dataset.date=state.date;
    if(training){const pick=disclosure(label,'sp-training-date',false,'lv-training-date');pick.append(calendar);return pick;}
    return frame;
  }
  function session(card,index=0){
    card.classList.add('lv-session');const title=card.querySelector('.sp-today-title'),progress=card.querySelector('.sp-progress'),head=card.querySelector('.sp-card-head'),foot=card.querySelector('.sp-card-head:last-child');
    if(!title)return card;
    const next=element('div','lv-session-top'),copy=element('div','lv-session-copy');if(head){head.classList.add('lv-session-source');copy.append(head);}copy.append(title);next.append(copy);
    const action=card.querySelector('.primary-button,.sp-pill');if(action)next.append(action);
    const remainder=[...card.children].filter(n=>n!==next&&n!==progress&&n!==foot&&n!==head&&n!==title);card.replaceChildren(next);if(progress)card.append(progress);if(foot&&foot!==head)card.append(foot);card.append(...remainder.filter(n=>n.isConnected||n.querySelector?.('button')));
    if(index)card.classList.add('lv-session-secondary');return card;
  }
  function sportProfile(page){
    const layout=element('div','lv-profile'),identity=page.querySelector(':scope>.sp-hero-card'),programs=page.querySelector(':scope>.sp-card [data-action=sp-import-open]')?.closest('.sp-card'),links=page.querySelector(':scope>.sp-links');
    if(identity){identity.classList.add('lv-profile-identity');const avatar=identity.querySelector('.sp-avatar');if(avatar?.textContent.trim()==='?')avatar.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>';layout.append(identity);}
    if(programs){programs.classList.add('lv-program-history');const action=programs.querySelector('[data-action=sp-import-open]');action?.classList.remove('primary-button');action?.classList.add('ghost-button');layout.append(programs);}
    if(links){const sections=[['Для тренировок',['equipment','favorites']],['Тело и история',['body','history']],['Мои настройки',[]]];for(const [name,keys]of sections){const group=region(name,'lv-profile-links');const rows=[...links.querySelectorAll(':scope>button')].filter(n=>keys.length?keys.includes(n.dataset.section):!['equipment','favorites','body','history'].includes(n.dataset.section));for(const row of rows)row.classList.add('lv-profile-row');group.append(...rows);if(rows.length)layout.append(group);}links.remove();}
    page.append(layout);extras(page,layout);
  }
  wrap('renderSportPage',fragment=>{
    const page=fragment.querySelector('.sp-page');if(!page)return;const state=spState();page.classList.add('lv-learning','lv-sp-v10');page.dataset.lvView=state.tab||'today';
    const titles={today:'Спорт',training:'Тренировка',goals:'Мои цели',profile:'Мой профиль'};learningHeading(fragment,page,'sport',titles[state.tab]||'Спорт','Спорт · мой ритм');
    if(!state.state)return;
    const nav=page.querySelector('.lv-module-nav'),error=page.querySelector(':scope>.sp-error');if(error)nav.after(error);
    if(state.tab==='profile'){sportProfile(page);return;}
    if(state.tab==='goals'){const layout=element('div','lv-goals');for(const card of [...page.children])if(card.matches('.sp-card')){card.classList.add('lv-goal-section');layout.append(card);}page.append(layout);return;}
    const calendar=sportCalendar(page,state,state.tab==='training');if(calendar)(error||nav).after(calendar);
    if(state.tab==='training'){
      const workout=page.querySelector('.sp-workout');if(workout){workout.classList.add('lv-workout');const start=workout.querySelector('.sp-start[data-action]');if(start){const estimate=start.querySelector('b')?.textContent;start.classList.add('primary-button','lv-workout-open');start.innerHTML=icon('play')+'<span>Открыть тренировку</span>'+(estimate?'<small>'+escape(estimate)+'</small>':'');}
        const warmup=page.querySelector(':scope>.sp-details'),head=workout.querySelector('.sp-workout-head');if(warmup&&head){warmup.classList.add('lv-warmup');head.after(warmup);}
      }
      page.querySelector(':scope>.sp-segment')?.classList.add('lv-training-kind');return;
    }
    const cards=[...page.querySelectorAll(':scope>.sp-today-workout')];if(calendar&&cards.length){const agenda=element('div','lv-day-sessions');cards.forEach((card,i)=>agenda.append(session(card,i)));calendar.append(agenda);}
    const secondary=element('div','lv-sport-support');for(const child of [...page.children])if(child.matches('.sp-card')){child.classList.add(child.querySelector('.sp-habit-row,.sp-habit,.sp-mobility')?'lv-day-marks':'lv-sport-record');secondary.append(child);}if(secondary.children.length)page.append(secondary);
  });
  wrap('spSheetHtml',fragment=>{const sheet=fragment.querySelector('.sp-sheet');if(!sheet)return;sheet.classList.add('lv-sp-editor');sheet.dataset.lvEditor=spState().sheet?.kind||'';for(const form of sheet.querySelectorAll('form'))form.classList.add('lv-editor-form');if(sheet.dataset.lvEditor==='profile'){const intro=sheet.querySelector('.section-note');if(intro)intro.textContent='Заполняй только то, что хочешь учитывать в плане. Любое значение можно изменить позже.';}});
  wrap('renderEnBrowserSheet',fragment=>{fragment.querySelector('.en-browser-sheet')?.classList.add('lv-en-editor');});

  function pianoShell(page, fragment = page) {
    if(!page||page.classList.contains('dl-piano-page'))return;
    page.classList.add('dl-learning-page', 'dl-piano-page');
    heading(fragment, 'Моя музыка · практика', 'Пианино', true);
    compactNavigation(fragment, page);
  }
  wrap('renderPianoPage', fragment => {
    pianoShell(fragment.querySelector('.piano-screen'),fragment);
  });

  function journey(summary, title) {
    if (!summary) return null;
    const rows = [...summary.querySelectorAll('.pn-session-item')]; if (!rows.length) return null;
    const current = rows.findIndex(row => row.children[0]?.textContent.trim() !== '✓' && row.children[1]?.textContent.trim() === title.trim());
    const stage = document.createElement('div'); stage.className = 'journey dl-learning-journey'; stage.setAttribute('aria-label', 'План занятия');
    for (const [index, row] of rows.entries()) {
      const done = row.children[0]?.textContent.trim() === '✓', active = index === current;
      const item = document.createElement('div'); item.className = `journey-stage${done ? ' completed' : active ? ' current' : ''}`;
      item.innerHTML = `<div class="stage-planet">${icon(done ? 'check' : active ? 'piano' : 'music')}</div><strong>${row.children[1]?.innerHTML || ''}</strong><small>${done ? 'Пройдено' : active ? 'Сейчас' : 'Впереди'}</small>`;
      stage.append(item);
    }
    return stage;
  }
  function songGrid(cards) {
    const grid = document.createElement('div'); grid.className = 'song-grid dl-song-grid';
    for (const [index, source] of cards.entries()) {
      const card = node(source); card.className = 'dl-song-card';
      for (const attribute of ['data-index', 'data-slot', 'aria-hidden', 'style']) card.removeAttribute(attribute);
      card.style.setProperty('--dl-index', String(Math.min(index, 8)));
      card.dataset.search = card.textContent.toLocaleLowerCase('ru-RU');
      const readiness = card.querySelector('.pn-song-readiness'), history = card.querySelector('.pn-song-state');
      if (readiness || history) { const more = document.createElement('details'); more.className = 'dl-song-readiness'; more.innerHTML = '<summary>Готовность и прогресс</summary>'; if(readiness)more.append(readiness);if(history)more.append(history);card.append(more); }
      card.querySelector('.movie-deck-poster')?.setAttribute('class', 'dl-song-cover');
      card.querySelector('.movie-deck-info')?.setAttribute('class', 'dl-song-copy');
      grid.append(card);
    }
    return grid;
  }
  function pianoPaint(content, model) {
    if (!enabled() || !content?.isConnected) return false;
    // A direct #piano entry can render before this presentation adapter loads.
    // The native public paint hook also mounts the shell, without rendering or changing lesson state.
    pianoShell(content.closest('.piano-screen'));
    content.classList.add('dl-piano-content'); content.dataset.learningTab = model.tab;
    const title = content.closest('.dl-piano-page')?.querySelector('.page-heading h1');
    if (title) title.textContent = ({songs:'Мои композиции', progress:'Мой прогресс', program:'Программа обучения', ready:'Готовность к композиции'})[model.tab] || 'Пианино';
    content.closest('.dl-piano-page')?.querySelector('.page-heading')?.classList.toggle('dl-workspace-heading', model.tab !== 'today');
    for (const tab of content.closest('.dl-piano-page')?.querySelectorAll('.pn-tabs [data-tab]') || []) {const active=tab.dataset.tab === (model.tab === 'ready' ? 'today' : model.tab);tab.setAttribute('aria-selected',String(active));tab.classList.toggle('active',active);}
    document.body.classList.remove('piano-deck-open');
    if (model.tab === 'songs') {
      model.disposeDeck?.();
      const tools = content.querySelector('.pn-library-tools');
      if (tools) {
        for (const button of tools.querySelectorAll('[data-pn-action="previous"],[data-pn-action="next"]')) button.remove();
        const count = tools.querySelector('#pn-deck-count'); if (count) { const form = new Intl.PluralRules('ru').select(model.cards.length); count.textContent = `${model.cards.length} ${{one:'композиция',few:'композиции',many:'композиций',other:'композиции'}[form]}`; }
      }
      const grid = songGrid(model.cards);
      content.querySelector('#pn-song-deck')?.replaceWith(grid);
      const search = node('<div class="dl-song-tools"><label class="notes-search">'+icon('search')+'<input id="dl-song-search" type="search" placeholder="Найти композицию" aria-label="Поиск композиции"></label><div class="dl-song-filters" aria-label="Источник композиции"><button type="button" data-dl-song-filter="all">Все</button><button type="button" data-dl-song-filter="mine">Мои</button><button type="button" data-dl-song-filter="learning">Учебные</button></div></div>');
      grid.before(search); search.querySelector('input').value = songQuery; filterSongs();
      return true;
    }
    if (model.tab === 'today') {
      const original = content.querySelector('.pn-lesson-card'), summary = content.querySelector('.pn-today-summary');
      if (original) {
        const output = heroFromCard(original, 'piano');
        if (output) {
          const sync = original.querySelector('#pn-sync'); if (sync) output.querySelector('.hero-bottom')?.append(sync);
          const plan = journey(summary, original.querySelector('h2')?.textContent || '');
          const group = content.querySelector('.pn-home-grid');
          if (group) {
            output.classList.add('piano-hero'); original.remove(); group.classList.add('dl-piano-support');
            group.querySelector('.pn-skills-button')?.remove();
            const home = document.createElement('div'); home.className = 'dl-piano-home'; group.before(home); home.append(output,group); if(plan) home.after(plan);
            if (model.cards.length) {
              const library = document.createElement('section'); library.className = 'dl-piano-library-preview';
              library.innerHTML = section('Твоя музыка', '<button type="button" class="text-button" data-pn-action="tab" data-tab="songs">Все композиции ' + icon('arrow') + '</button>');
              library.append(songGrid(model.cards.slice(0, 1))); (plan || home).after(library);
            }
          }
        }
      }
    } else if (model.tab === 'progress') {
      const metrics = content.querySelector('.pn-progress-grid'); if (metrics) metrics.classList.add('dl-learning-metrics');
    } else if (model.tab === 'ready') {
      content.querySelector('.pn-readiness')?.classList.add('lesson-card', 'dl-readiness-card');
    }
    return true;
  }

  let songQuery = '', songFilter = 'all', measureFrame = 0;
  function filterSongs() {
    const words = songQuery.toLocaleLowerCase('ru-RU').trim().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const card of document.querySelectorAll('.dl-piano-content .dl-song-card')) {
      const builtin = (card.dataset.source || '').startsWith('builtin');
      card.hidden = !words.every(word => (card.dataset.search || '').includes(word)) || songFilter === 'mine' && builtin || songFilter === 'learning' && !builtin;
      if (!card.hidden) count++;
    }
    const countNode = document.getElementById('pn-deck-count'); if (countNode) countNode.textContent = 'Найдено: '+count;
    for (const button of document.querySelectorAll('[data-dl-song-filter]')) button.setAttribute('aria-pressed', String(button.dataset.dlSongFilter === songFilter));
  }
  function measureWorkspace() {
    measureFrame = 0;
    for (const tabs of document.querySelectorAll('.dl-module-nav [role=tablist],.lv-module-nav [role=tablist]')) {
      const selected = tabs.querySelector('[aria-selected=true]'); if (!selected) continue;
      const strip = tabs.getBoundingClientRect(), target = selected.getBoundingClientRect();
      if (target.left < strip.left + 4) tabs.scrollLeft -= strip.left + 4 - target.left;
      else if (target.right > strip.right - 4) tabs.scrollLeft += target.right - strip.right + 4;
    }
    const chat = document.querySelector('.lv-en-chat .en-chat'); if (!chat) return;
    const viewport = window.visualViewport, bottom = (viewport?.offsetTop || 0) + (viewport?.height || innerHeight);
    const obstacles = [...document.querySelectorAll('.dm-bottom-nav,.mobile-nav,.sp-bar')].filter(n => getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden').map(n => n.getBoundingClientRect()).filter(r => r.height > 0 && r.top < bottom && r.bottom > 0);
    const limit = Math.min(bottom, ...obstacles.map(r=>r.top))-12;
    const height = Math.max(100, Math.floor(limit-chat.getBoundingClientRect().top));
    if(chat.style.getPropertyValue('--dl-chat-height') !== height+'px') chat.style.setProperty('--dl-chat-height', height+'px');
  }
  function scheduleMeasure() { if (!measureFrame && !document.hidden) measureFrame = requestAnimationFrame(measureWorkspace); }
  document.addEventListener('input', event => { if(event.target.id === 'dl-song-search') { songQuery=event.target.value; filterSongs(); } });
  document.addEventListener('click', event => { const button=event.target.closest('[data-dl-song-filter]'); if(button) { songFilter=button.dataset.dlSongFilter; filterSongs(); } });
  document.addEventListener('toggle', event => { const target=event.target;if(target.dataset?.learningDisclosure)learningOpen.set(target.dataset.learningDisclosure,target.open); },true);
  document.addEventListener('keydown', event => {
    const current=event.target.closest?.('.dl-module-nav [role=tab],.lv-module-nav [role=tab]'); if(!current||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    const tabs=[...current.parentElement.querySelectorAll('[role=tab]')],index=tabs.indexOf(current),target=event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):tabs[(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];
    event.preventDefault(); const tab=target.dataset.tab; target.click(); queueMicrotask(()=>{document.querySelector('.dl-module-nav [role=tab][data-tab="'+CSS.escape(tab)+'"],.lv-module-nav [role=tab][data-tab="'+CSS.escape(tab)+'"]')?.focus({preventScroll:true});scheduleMeasure();});
  });
  document.addEventListener('click',event=>{const button=event.target.closest('[data-lv-sport-period]');if(!button)return;const expanded=button.dataset.lvSportPeriod==='four';if(!!spState().monthOpen!==expanded)sportAction('sp-month',button,event);});
  window.addEventListener('resize',scheduleMeasure); window.visualViewport?.addEventListener('resize',scheduleMeasure); window.visualViewport?.addEventListener('scroll',scheduleMeasure);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&measureFrame){cancelAnimationFrame(measureFrame);measureFrame=0;}else scheduleMeasure();});
  const observer = new MutationObserver(scheduleMeasure); observer.observe(document.getElementById('app') || document.body,{childList:true,subtree:true});
  document.fonts?.ready.then(scheduleMeasure);
  window.flowDigitalLearning = { pianoPaint, version: 'bible-7' };
})();
