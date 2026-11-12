(() => {
  'use strict';
  if (document.documentElement.dataset.flowDesign === 'classic') return;
  const active=()=>document.documentElement.dataset.flowDesign==='magic';
  const escape=value=>esc(String(value??''));
  const symbol=name=>typeof icon==='function'?icon(name):'';
  const glyph=name=>window.flowMagicObject?.(name)||symbol(name);
  const section=(title,side='')=>window.flowMagicUI.sectionHeading(escape(title),side);
  const parse=html=>{const t=document.createElement('template');t.innerHTML=html;return t;};
  const openGroups=new Map();
  function replace(name,renderer){if(typeof window[name]!=='function')return;const original=window[name];window[name]=function(...args){return active()?renderer(original,...args):original.apply(this,args);};}
  function prepare(original){const t=parse(original());[...t.content.children].filter(n=>n.matches('.page-header')).forEach(n=>n.remove());const back=t.content.querySelector('.vault-back');if(back){back.classList.add('dc-back');back.setAttribute('aria-label',`Назад: ${back.textContent.trim()}`);}const backHTML=back?.outerHTML||'';back?.remove();return {t,backHTML};}
  function finish(route,title,{t,backHTML},action=''){
    const destination=route==='render'&&ui.fromPage==='pc'?'pc':'more',label=destination==='pc'?'Компьютер':'Ещё';
    const back=backHTML||`<button class="icon-button ds-work-back" type="button" data-action="navigate" data-page="${destination}" aria-label="Назад: ${label}">${symbol('left')}</button>`;
    return `<div class="dc-service dc-service-${route} ds2-workspace"><header class="ds-work-head">${back}<h1>${escape(title)}</h1>${action}</header><div class="dc-service-body">${t.innerHTML}</div></div>`;
  }
  function group(node,key,caption='',opened=false){if(!node)return null;const title=node.querySelector(':scope>.section-heading h2,:scope>h3')?.textContent||key;const details=document.createElement('details');details.className='ds-group';details.dataset.serviceGroup=key;details.open=openGroups.has(key)?openGroups.get(key):opened;details.innerHTML=`<summary><span><strong>${escape(title)}</strong>${caption?`<small>${escape(caption)}</small>`:''}</span>${symbol('down')}</summary>`;const oldHead=node.querySelector(':scope>.section-heading');if(oldHead){const actions=[...oldHead.children].filter(n=>n.tagName!=='H2');if(actions.length){const row=document.createElement('div');row.className='ds-group-actions';row.append(...actions);details.append(row);}oldHead.remove();}node.querySelector(':scope>h3')?.remove();while(node.firstChild)details.append(node.firstChild);node.replaceWith(details);return details;}
  function panel(title,body,className=''){const anchor=document.createComment('');body.before(anchor);const node=document.createElement('section');node.className=`ds-panel ${className}`;node.innerHTML=section(title);node.append(body);anchor.replaceWith(node);return node;}
  function statusObject(status,route,state){if(!status)return;status.classList.add('ds-status');status.dataset.serviceState=state;status.insertAdjacentHTML('afterbegin',`<span class="ds-status-object" aria-hidden="true">${glyph(route)}</span>`);}
  function snapshotNote(main,state,refresh,stamp,threshold){if(!main)return false;const old=Boolean(stamp&&Date.now()-stamp>threshold),stale=state?.state==='error'||old;if(!stale)return false;const note=document.createElement('div');note.className='ds-snapshot-note';note.setAttribute('role','status');note.innerHTML=`<div><strong>Показано последнее известное состояние</strong><p>${escape(state?.state==='error'?`Обновление не удалось: ${state.error||'нет связи'}`:'Данные устарели. Текущее состояние не подтверждено.')}</p></div><button class="small-button" type="button" data-action="${refresh}">Повторить ${symbol('reset')}</button>`;main.prepend(note);return true;}
  replace('renderServerPage',original=>{
    const view=prepare(original),main=view.t.content.querySelector('.content-main'),s=ui.server||{},d=s.data;let action='';
    if(main&&d){const stamp=Number(d.time)*1000,stale=snapshotNote(main,s,'server-refresh',stamp,120000);const status=main.querySelector('.vpn-status');statusObject(status,'server',stale?'stale':serverProblems(d).length?'problem':'ready');if(stale&&status){status.classList.remove('ok');status.querySelector('strong').textContent='Состояние требует обновления';}
      const refresh=status?.querySelector('[data-action="server-refresh"]');if(refresh){refresh.className='icon-button ds-header-action';refresh.setAttribute('aria-label','Обновить состояние сервера');refresh.innerHTML=symbol('reset');action=refresh.outerHTML;refresh.remove();}
      main.querySelector('.server-kpis')?.classList.add('ds-resource-strip');
      const descriptions={'За сутки':'Нагрузка и сеть за последние сутки','Службы':`${d.containers.filter(c=>c.state==='running').length} из ${d.containers.length} контейнеров работают`,'Flow':d.db.ok?'База, файлы и фоновые задачи':'База не отвечает','Копии':`${d.backups.count} ${word(d.backups.count,'копия','копии','копий')} · ${d.backups.running?'создаётся новая':'состояние хранения'}`,'Журнал сторожа':d.events.length?`${d.events.length} ${word(d.events.length,'событие','события','событий')}`:'Без новых событий','Действия':'Перезапуск, обслуживание и очистка','Настройки':'Уведомления и пороги ресурсов'};
      const sections=new Map([...main.querySelectorAll(':scope>.section')].map(node=>[node.querySelector('h2')?.textContent||'',node]));
      for(const title of ['Службы','Flow','Копии','За сутки','Журнал сторожа','Действия','Настройки']){const node=sections.get(title);if(!node)continue;main.append(node);group(node,`server-${title}`,descriptions[title]||'',title==='Службы'||title==='Flow'&&(!d.db.ok||d.db.worker_failed||d.functions.count)||title==='Копии'&&d.backups.offsite?.ok===false);}
    }
    return finish('server','Сервер',view,action);
  });
  replace('renderVpnPage',original=>{
    const view=prepare(original),main=view.t.content.querySelector('.content-main'),v=ui.vpn||{},d=v.data;let action='';
    if(main&&d){const stale=snapshotNote(main,v,'vpn-refresh',v.at,90000),status=main.querySelector('.vpn-status');statusObject(status,'vpn',stale?'stale':d.server.xray_active?'ready':'offline');const restart=status?.querySelector('[data-action="vpn-restart"]');const aside=view.t.content.querySelector('.content-aside'),refresh=aside?.querySelector('[data-action="vpn-refresh"]');if(refresh){refresh.className='icon-button';refresh.setAttribute('aria-label','Обновить состояние VPN-сервера');refresh.innerHTML=symbol('reset');status?.append(refresh);}restart?.remove();if(status){const title=status.querySelector('strong');title.textContent=stale?'Статус сервера устарел':d.server.xray_active?'VPN-сервер на связи':'VPN-сервер остановлен';status.insertAdjacentHTML('beforeend','<p class="ds-channel-note">Соединение этого устройства — в VPN-приложении.</p>');}
      const keys=[...main.querySelectorAll(':scope>.section')].find(n=>n.querySelector('h2')?.textContent==='Ключи');if(keys){keys.classList.add('ds-device-list');keys.querySelector('h2').textContent='Устройства и ключи';const add=keys.querySelector('[data-action="vpn-new"]');if(add){add.className='primary-button ds-header-action';add.innerHTML=`${symbol('plus')}<span>Устройство</span>`;action=add.outerHTML;add.remove();}for(const mark of keys.querySelectorAll('.vpn-client .list-icon'))mark.innerHTML=window.flowMagicObject?.('vpn',true)||symbol('key');const note=main.querySelector('.ds-snapshot-note');if(note)note.after(keys);else if(!d.server.xray_active)status?.after(keys);else main.prepend(keys);}
      const traffic=main.querySelector('.vpn-traffic');if(traffic)panel('Расход трафика',traffic,'ds-traffic-panel');
      for(const node of [...main.querySelectorAll(':scope>.section')]){if(node===keys)continue;const title=node.querySelector('h2')?.textContent||'';group(node,`vpn-${title}`,title==='Исключения'?'Правила маршрутизации':'Сервисы и периоды');}
      if(aside){const maintenance=document.createElement('section');maintenance.className='section';maintenance.innerHTML=section('Обслуживание сервера');while(aside.firstChild)maintenance.append(aside.firstChild);if(restart){const actions=document.createElement('div');actions.className='ds-maintenance-actions';actions.append(restart);maintenance.append(actions);}main.append(maintenance);aside.remove();group(maintenance,'vpn-maintenance','Ресурсы, версия и перезапуск');}
    }
    return finish('vpn','VPN',view,action);
  });
  const workButton=(action,label,mark,extra='',tone='')=>`<button type="button" class="ds2-control ${tone}" data-action="${action}" ${extra}>${symbol(mark)}<span>${escape(label)}</span></button>`;
  const workSurface=(title,body,extra='')=>`<section class="ds2-surface ${extra}"><h2 class="ds2-section-title">${escape(title)}</h2>${body}</section>`;
  function workPage(route,title,body,action=''){
    const destination=route==='render'&&ui.fromPage==='pc'?'pc':route==='vault'&&ui.fromPage==='saved'?'saved':'more';
    return `<div class="dc-service dc-service-${route} ds2-workspace"><header class="ds-work-head"><button class="icon-button ds-work-back" type="button" data-action="navigate" data-page="${destination}" aria-label="Назад: ${destination==='pc'?'Компьютер':destination==='saved'?'Сохранённое':'Ещё'}">${symbol('left')}</button><h1>${escape(title)}</h1>${action}</header><div class="dc-service-body">${body}</div></div>`;
  }
  function pcCommandControls(){
    const t=parse(pcActions(Boolean(ui.pc.pending)));t.content.querySelector('[data-action="pc-find-focus"]')?.remove();
    for(const button of t.content.querySelectorAll('button')){button.classList.add('ds2-control');button.dataset.assistantReserve='';}
    return `<div class="ds2-command-grid" data-assistant-reserve>${[...t.content.querySelectorAll('button')].map(n=>n.outerHTML).join('')}</div>`;
  }
  replace('pcHero',(original,d)=>{
    const t=parse(original(d)),old=t.content.querySelector('.pc-hero'),copy=old?.querySelector('.pc-hero-text');
    if(!old||!copy)return t.innerHTML;
    const refresh=old.querySelector('.pc-refresh'),error=old.querySelector('.pc-connection-error');
    const st=d.status,resource=st&&d.on===true?`<details class="ds2-resources" data-service-group="pc-resources" ${openGroups.get('pc-resources')?'open':''}><summary><span>Ресурсы</span><span>${escape(pcPct(st.cpu_percent))} CPU · ${escape(pcPct(st.memory_percent))} RAM</span>${symbol('down')}</summary>${pcMeters(ui.pc.last?.cmd==='status'&&ui.pc.last.status==='done'?ui.pc.last.result:st,false)}</details>`:'';
    return `<section class="pc-hero ds2-device ${old.classList.contains('is-stale')?'is-stale':''}" data-device-state="${escape(old.dataset.deviceState)}"><div class="ds2-device-top"><span class="ds2-device-mark" aria-hidden="true">${glyph('pc')}</span><div class="ds2-device-copy pc-hero-text">${copy.innerHTML}</div>${refresh?.outerHTML||''}</div>${error?.outerHTML||''}${resource}${d.agent?`<div class="ds2-device-commands">${pcCommandControls()}</div>`:''}</section>`;
  });
  replace('pcMedia',()=>{
    const a=ui.pc.audio,q=key=>ui.pc.quick?.[key]||'',level=a?a.level:50,muted=Boolean(a?.muted);
    const transport=(key,mark,label)=>`<button type="button" class="ds2-media-button ${key==='play'?'is-main':''} ${q(key)}" data-action="pc-media" data-key="${key}" aria-label="${label}">${pcIcon(mark)}</button>`;
    return `<section class="pc-media ds2-media ds2-surface"><div class="ds2-media-heading"><h2 class="ds2-section-title">Звук и музыка</h2>${!a?'<small>Узнаю громкость…</small>':''}</div><div class="ds2-media-body"><div class="pc-transport ds2-transport">${transport('prev','prev','Предыдущий трек')}${transport('play','playPause','Пауза или воспроизведение')}${transport('next','next','Следующий трек')}</div><div class="pc-volume ds2-volume ${muted?'is-muted':''} ${q('level')}"><button type="button" class="pc-mute ds2-media-button ${q('mute')}" data-action="pc-mute" aria-label="${muted?'Включить звук':'Выключить звук'}" aria-pressed="${muted}">${pcIcon(muted?'muted':'sound')}</button><input class="pc-vol-range" type="range" min="0" max="100" step="1" value="${level}" style="--v:${level}%" aria-label="Громкость" ${a?'':'disabled'}><b class="pc-vol-value">${muted?'тихо':`${level}%`}</b></div></div>${a&&window.SorokaNative?.pcVolumeKeys?'<small class="ds2-hint">Работают и кнопки громкости телефона</small>':''}</section>`;
  });
  replace('pcLinkBlock',()=>{
    const q=ui.pc.find||'';
    return workSurface('Открыть на компьютере',`<form id="pc-find-form" class="ds2-launch-form" role="search"><div class="pc-find-box ds2-launch-box">${symbol('search')}<input id="pc-find" type="search" aria-label="Программа, файл, сайт или запрос на компьютере" enterkeyhint="go" placeholder="Программа, файл или сайт" autocomplete="off" value="${escape(q)}"></div></form><details class="ds2-shortcuts" data-service-group="pc-shortcuts" ${openGroups.get('pc-shortcuts')??Boolean(q)?'open':''}><summary>Сайты и недавнее ${symbol('down')}</summary><div class="pc-find-results ds2-find-results">${pcFindResultsHtml(q)}</div></details><details class="ds2-file-help"><summary>Передать файл ${symbol('down')}</summary><p class="ds2-hint">На компьютер: пришлите боту файл с подписью «на комп». С компьютера: «скинь D:\\путь\\к\\файлу».</p></details>`,'ds2-launch');
  });
  replace('renderPcPage',original=>{
    original(); // The native owner starts and throttles loading.
    const d=ui.pc?.data;
    if(!d)return workPage('pc','Компьютер',`<section class="ds2-surface ds2-unavailable"><span class="ds2-state-mark">${glyph('pc')}</span><h2>${ui.pc?.error?'Нет связи с компьютером':'Подключаюсь'}</h2><p>${escape(ui.pc?.error||'Проверяю состояние компьютера')}</p>${ui.pc?.error?workButton('pc-refresh','Повторить','reset'):'<span class="ds2-loading" aria-label="Загрузка"></span>'}</section>`);
    const busy=Boolean(ui.pc.pending);
    const renderBusy=(d.rmQueue?.jobs||[]).some(j=>RM_ACTIVE.includes(j.status)||RM_WAITING.includes(j.status))||d.render?.rendering;
    const power=d.on===true&&d.agent?'':`<div class="ds2-power">${pcPowerRow(d,busy)}</div>`;
    const state=pcPowerCountdown(d)+pcResult();
    return workPage('pc','Компьютер',`<div class="pc-page ds2-pc">${pcHero(d)}${state?`<div class="ds2-command-result" data-assistant-reserve>${state}</div>`:''}${power}${!d.agent&&d.on?'<p class="ds2-hint">Агент Flow не запущен. Дистанционное управление пока недоступно.</p>':''}${d.agent?`<div class="ds2-pc-grid">${pcLinkBlock()}${pcMedia()}<div class="ds2-render-link ${renderBusy?'is-active':''}">${rmLinkRow(d)}</div></div>`:''}</div>`);
  });
  function renderPhase(d){
    if(!d)return {state:ui.pc?.error?'error':'loading',progress:null};
    const q=d.rmQueue||{},jobs=rmVisibleJobs(q),fresh=rmFresh(d),job=jobs.find(j=>RM_ACTIVE.includes(j.status)),paused=jobs.find(j=>j.status==='paused');
    if(!fresh)return {state:'stale',progress:null};
    if(job)return {state:'rendering',progress:rmProgress(job),job};
    if(d.render?.rendering){const value=d.render.percent;return {state:'rendering',progress:value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Math.max(0,Math.min(100,Number(value))):null};}
    if(paused||q.held&&jobs.some(j=>j.status==='queued'))return {state:'paused',progress:paused?rmProgress(paused):null,job:paused};
    return {state:jobs.some(j=>j.status==='queued')?'queued':'empty',progress:null};
  }
  function dsrJob(j,fresh){
    const native=parse(rmActiveRow(j,fresh)),row=native.content.firstElementChild;
    const name=row.querySelector('.pc-render-title strong')?.textContent||j.name||'Рендер';
    const pctText=row.querySelector('.pc-render-pct')?.textContent||'',percent=Number.parseInt(pctText,10),known=Number.isFinite(percent);
    const bar=row.querySelector('.pc-render-bar'),fill=bar?.querySelector('b'),facts=row.querySelector('.pc-render-facts'),memory=row.querySelector('.rm-memory'),resource=row.querySelector('.rm-resource'),warning=row.querySelector('.rm-warn');
    const actions=[...row.querySelectorAll('.rm-acts button')],share=actions.find(button=>button.dataset.action==='rm-customer-share'),main=actions.filter(button=>button!==share),resume=j.status==='paused'?`<button type="button" class="${rmBusyCls(`rm-resume-${j.id}`)}" data-action="rm-resume" data-id="${escape(j.id)}">Продолжить</button>`:'',memoryText=memory?.textContent.replace(/\s+/g,' ').trim()||'',showMemory=Boolean(memoryText&&memoryText!=='RAM нет данных · VRAM нет данных');
    const indeterminate=Boolean(bar?.classList.contains('indeterminate')),stale=Boolean(bar?.classList.contains('is-stale')),value=(fill?.style.getPropertyValue('--v')||'0%').trim();
    const label=!fresh?'Нет свежих данных':j.status==='delivering'?'Доставка результата':j.status==='paused'?'Рендер на паузе':j.stage&&!/^рендер/i.test(j.stage)?j.stage:'Сейчас рендерится';
    return `<article class="dsr-job" data-render-fresh="${fresh}"><div class="dsr-job-head"><div class="dsr-job-copy"><small class="dsr-eyebrow"><span class="dsr-live" aria-hidden="true"></span>${escape(label)}</small><h2>${escape(name)}</h2></div>${known?`<strong class="dsr-percent">${percent}%</strong>`:''}</div><div class="dsr-bar${indeterminate?' is-indeterminate':''}${stale?' is-stale':''}" style="--v:${escape(value)}" role="progressbar" aria-label="Прогресс рендера" aria-valuemin="0" aria-valuemax="100"${known?` aria-valuenow="${percent}"`:' aria-valuetext="Прогресс не определён"'}><b></b></div>${facts?.innerHTML?`<p class="dsr-facts">${facts.innerHTML}</p>`:''}${showMemory?`<p class="dsr-memory">${memory.innerHTML}</p>`:''}${resource?resource.outerHTML:''}${warning?warning.outerHTML:''}${resume||main.length?`<div class="dsr-actions" data-assistant-reserve>${resume}${main.map(button=>button.outerHTML).join('')}</div>`:''}${share?`<div class="dsr-share">${share.outerHTML}</div>`:''}</article>`;
  }
  function dsrStatus(d,q,fresh,active,waiting){
    if(!d.agent)return ['offline','Компьютер не на связи'];
    if(!fresh)return ['stale','Нет свежих данных'];
    if(q.held)return ['paused','Очередь остановлена'];
    if(active.length)return ['rendering','Очередь работает'];
    if(waiting.some(job=>job.status==='paused'))return ['paused','Рендер на паузе'];
    if(waiting.length)return ['queued','Ожидает запуска'];
    return ['empty','Очередь свободна'];
  }
  replace('renderRenderPage',original=>{
    original();
    const d=ui.pc?.data,add=workButton('rm-scenes','Сцена','plus','aria-label="Поставить сцену на рендер"','ds2-header-add');
    if(!d)return workPage('render','Рендер',`<div class="dsr-page"><section class="dsr-card dsr-unavailable"><span class="dsr-state-mark" aria-hidden="true">${glyph('render')}</span><h2>${ui.pc?.error?'Очередь недоступна':'Проверяю очередь'}</h2><p>${escape(ui.pc?.error||'Получаю состояние с компьютера')}</p>${ui.pc?.error?workButton('pc-refresh','Повторить','reset'):'<span class="dsr-loading" aria-label="Загрузка"></span>'}</section></div>`,add);
    const q=d.rmQueue||{},jobs=rmVisibleJobs(q),active=jobs.filter(job=>RM_ACTIVE.includes(job.status)),waiting=jobs.filter(job=>RM_WAITING.includes(job.status)),recent=jobs.filter(job=>['done','failed','cancelled'].includes(job.status)),fresh=rmFresh(d),state=renderPhase(d).state,total=active.length+waiting.length,heroJobs=active.length?active:waiting.filter(job=>job.status==='paused').slice(0,1),nextJobs=waiting.filter(job=>!heroJobs.includes(job));
    const [tone,status]=dsrStatus(d,q,fresh,active,waiting);
    const latest=recent.slice().sort((a,b)=>Number(b.finished_at||0)-Number(a.finished_at||0))[0],failure=!active.length&&!waiting.length&&fresh&&latest&&(latest.status==='failed'||latest.delivery?.status==='failed')?latest:null;
    const notice=failure?`<section class="dsr-notice" role="status"><div><strong>${failure.status==='failed'?'Рендер не завершён':'Результат не доставлен'}</strong><p>${escape(failure.error||failure.delivery?.error||'Откройте задачу в истории, чтобы проверить причину и повторить.')}</p></div><button type="button" class="dsr-link" data-action="rm-detail" data-id="${escape(failure.id)}">Открыть задачу ${symbol('right')}</button></section>`:'';
    const hint=!d.agent?'Компьютер не на связи. Постановка сцены включит его.':!fresh?'Показано последнее известное состояние. Обновите, когда компьютер ответит.':q.held?'Текущий рендер доработает, следующие ждут.':'';
    const manual=!heroJobs.length&&d.render?.rendering?`<div class="dsr-manual"><small>Вручную в After Effects</small>${pcRenderNow(d.render)}</div>`:'';
    const empty=!heroJobs.length&&!nextJobs.length&&!d.render?.rendering?`<div class="dsr-empty"><span class="dsr-empty-mark" aria-hidden="true">${glyph('render')}</span><h2>${fresh?'Очередь свободна':'Состояние неизвестно'}</h2><p>${fresh?'Выберите сцену и композицию.<br>Готовый результат появится здесь.':'Компьютер не подтвердил очередь. Показанное может быть неполным.'}</p>${fresh?`<button type="button" class="dsr-primary" data-action="rm-scenes">Выбрать сцену ${symbol('right')}</button>`:''}</div>`:'';
    const hold=active.length||q.held?`<button type="button" class="dsr-hold ${rmBusyCls('rm-hold')}" data-action="rm-hold" data-on="${q.held?'0':'1'}" data-assistant-reserve><span class="dsr-hold-mark" aria-hidden="true">${q.held?symbol('play'):'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="5" width="3.6" height="14" rx="1.4"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.4"/></svg>'}</span><span class="dsr-hold-copy"><b>${q.held?'Продолжить очередь':'Остановить очередь'}</b><small>${q.held?'Новые задачи начнутся после продолжения':'Новые задачи будут ждать'}</small></span></button>`:'';
    const next=nextJobs.length?`<section class="dsr-next"><header><h2>Дальше</h2><span>${nextJobs.length}</span></header><div class="rm-waiting dsr-waiting">${nextJobs.map(rmWaitingRow).join('')}</div></section>`:'';
    const history=recent.length?`<details class="dsr-history rm-history" ${ui.pc.rmHistoryOpen?'open':''}><summary data-action="rm-history-toggle"><span>История</span><small>${recent.length}</small>${symbol('down')}</summary><div class="dsr-history-tools"><button type="button" class="dsr-link ${rmBusyCls('rm-clear')}" data-action="rm-clear">Очистить историю</button></div><div class="rm-recents dsr-recents">${recent.map(job=>`<div class="rm-history-swipe" data-history-id="${job.id}"><span class="rm-history-remove" aria-hidden="true">Убрать</span><div class="rm-history-row">${rmRecentRow(job)}</div></div>`).join('')}</div></details>`:'';
    const queue=`<section class="dsr-main" data-queue-state="${escape(tone)}"><header class="dsr-top"><span class="dsr-status"><i class="dsr-dot" aria-hidden="true"></i>${escape(status)}</span><span class="dsr-count">${total?`${total} ${word(total,'задача','задачи','задач')}`:'Нет задач'}</span><button type="button" class="dsr-refresh" data-action="pc-refresh" aria-label="Обновить очередь">${symbol('reset')}</button></header>${hint?`<p class="dsr-hint">${escape(hint)}</p>`:''}${heroJobs.map(job=>dsrJob(job,fresh)).join('')}${manual}${empty}${hold}${next}${history}</section>`;
    let afterHTML='';
    if(d.agent){const holder=document.createElement('div');holder.innerHTML=pcRenderBlock(d,true);const box=holder.firstElementChild;if(box){box.className='dsr-card dsr-after';const head=box.querySelector('.pc-card-head');if(head)head.outerHTML='<h2>После рендера</h2>';box.querySelector('.pc-after-label')?.remove();box.querySelector('.segmented')?.classList.add('dsr-segmented');afterHTML=holder.innerHTML;}}
    const tools=`<details class="dsr-card dsr-tools" ${ui.pc.rmToolsOpen?'open':''}><summary data-action="rm-tools-toggle">${symbol('settings')}<span>Настройки и диагностика</span>${symbol('down')}</summary><div class="dsr-tools-body">${rmSettingsCard(d)}${rmCalibrationCard()}${rmHealthCard(d)}</div></details>`;
    return workPage('render','Рендер',`<div class="dsr-page">${notice}${queue}<div class="dsr-side">${afterHTML}${tools}</div></div>`,add);
  });
  replace('renderDocsPage',original=>{
    const view=prepare(original),grid=view.t.content.querySelector('.doc-grid');let action='';
    if(grid){grid.classList.add('ds-doc-catalog');const own=grid.querySelector('.doc-tile-new');if(own){own.className='icon-button ds-header-action';own.setAttribute('aria-label','Создать свой документ');own.setAttribute('title','Создать свой документ');own.innerHTML=symbol('plus');action=own.outerHTML;own.remove();}
      for(const row of grid.querySelectorAll('.doc-tile')){row.classList.add('ds-doc-identity');if(!row.classList.contains('is-filled'))row.querySelector('.doc-tile-status').textContent='Не добавлен';row.querySelector('.doc-tile-mark')?.setAttribute('aria-label','Документ добавлен');}
    }
    adaptVault(view.t);return finish('docs','Документы',view,action);
  });
  function adaptVault(t){
    const lock=t.content.querySelector('.vault-lock-card');
    if(lock){lock.className='ds2-vault-lock vault-lock-card';lock.dataset.vaultState=lock.id==='vault-setup-form'?'setup':ui.vaultError?'error':'locked';const old=lock.querySelector('.list-icon');if(old)old.outerHTML=`<span class="ds2-lock-symbol" aria-hidden="true">${glyph('vault')}</span>`;const title=lock.querySelector('h2');title?.insertAdjacentHTML('beforebegin','<small class="ds2-eyebrow">Личное хранилище</small>');const fields=[...lock.querySelectorAll(':scope>.field')],submit=lock.querySelector(':scope>button[type=submit]');if(fields.length){const area=document.createElement('div');area.className='ds2-unlock-fields';fields[0].before(area);area.append(...fields);if(submit)area.append(submit);}}
    const checking=t.content.querySelector('.state-card:not(form)');if(checking&&window.SOROKA_LIVE&&ui.vaultSetup===undefined){checking.className='ds2-surface ds2-unavailable';checking.querySelector('.list-icon')?.remove();checking.insertAdjacentHTML('afterbegin',`<span class="ds2-state-mark">${glyph('vault')}</span>`);}
    const security=t.content.querySelector('.vault-security');if(security)group(security,'vault-security','Мастер-пароль и доверенные устройства');
  }
  function vaultRows(){
    const q=ui.vaultQuery.trim().toLowerCase(),entries=data.vault.filter(v=>v.service.toLowerCase().includes(q));
    const cards=entries.map(v=>{const t=parse(vaultItem(v)),row=t.content.firstElementChild;row.classList.add('ds2-vault-item');const avatar=row.querySelector('.vault-avatar');if(avatar){avatar.removeAttribute('style');avatar.className='ds2-vault-avatar';}return t.innerHTML;}).join('');
    return cards||`<div class="ds2-vault-empty"><span>${glyph('vault')}</span><h2>${q?'Сервис не найден':'Ваши ключи — только у вас'}</h2><p>${q?'Попробуйте другое название.':'Добавьте сервис. Пароль зашифруется на этом устройстве.'}</p>${q?'':workButton('vault-new','Добавить сервис','plus')}</div>`;
  }
  replace('moreInput',(original,event)=>{if(event.target?.id!=='vault-search')return original(event);ui.vaultQuery=event.target.value;const area=document.getElementById('vault-results');if(area)area.innerHTML=vaultRows();return true;});
  replace('renderVaultPage',original=>{
    const native=parse(original());
    if(!ui.vaultUnlocked){native.content.querySelector('.vault-back')?.remove();native.content.querySelector('.page-header')?.remove();adaptVault(native);return workPage('vault','Пароли',native.innerHTML);}
    const legacy=native.content.querySelector('.vault-legacy'),security=native.content.querySelector('.vault-security');
    if(security){security.className='ds2-vault-security';security.querySelector('h3')?.remove();}
    return workPage('vault','Пароли',`<div class="ds2-vault"><div class="ds2-vault-toolbar"><label class="ds2-vault-search">${symbol('search')}<input id="vault-search" type="search" placeholder="Найти сервис" value="${escape(ui.vaultQuery)}" aria-label="Поиск сервиса"></label><button type="button" class="ds2-control ds2-lock-action" data-action="vault-lock" aria-label="Закрыть хранилище">${symbol('key')}</button></div><p class="ds2-vault-meta">${data.vault.length} ${word(data.vault.length,'сервис','сервиса','сервисов')} · зашифровано</p>${legacy?.outerHTML||''}<div id="vault-results" class="vault-list ds2-vault-list">${vaultRows()}</div><details class="ds2-security-panel" data-service-group="vault-security" ${openGroups.get('vault-security')?'open':''}><summary>${symbol('key')}<span>Защита хранилища</span>${symbol('down')}</summary>${security?.innerHTML||''}</details></div>`,workButton('vault-new','Сервис','plus','','ds2-header-add'));
  });
  function serviceWindow(name,kind){replace(name,(original,...args)=>{const t=parse(original(...args)),sheet=t.content.querySelector('.sheet');if(!sheet)return t.innerHTML;sheet.classList.add('ds2-window');sheet.dataset.serviceWindow=kind;
    if(kind==='power'){const pad=sheet.querySelector('.pc-pad');pad?.classList.add('ds2-time-options');for(const [i,button] of [...pad?.querySelectorAll('button')||[]].entries()){button.classList.add('ds2-time-option');button.querySelector('svg')?.remove();button.insertAdjacentHTML('afterbegin',`<span class="ds2-time-symbol">${pcIcon(i?'chart':ui.sheet.cmd==='sleep'?'moon':'power')}</span>`);}}
    if(kind==='vault'||kind==='master'){const form=sheet.querySelector('form');if(form){form.classList.add('ds2-secret-form');const note=form.querySelector('[name=note]')?.closest('label');if(note){const details=document.createElement('details');details.className='ds2-note-extra';details.innerHTML='<summary>Заметка без секрета</summary>';note.before(details);details.append(note);}}}
    if(kind==='render'){const title=sheet.querySelector('.sheet-head h2');if(ui.sheet?.scene&&title){const sceneName=title.textContent;title.textContent=sheet.querySelector('[data-action=rm-submit]')?'Параметры рендера':'Выбор композиций';sheet.querySelector('.sheet-head').insertAdjacentHTML('afterend',`<p class="ds2-scene-name">${escape(sceneName)}</p>`);}for(const node of sheet.querySelectorAll('.rm-scenes,.rm-targets,.rm-batch-opts'))node.classList.add('ds2-render-picker');}
    return t.innerHTML;
  });}
  serviceWindow('renderPcPowerSheet','power');serviceWindow('renderPcShotSheet','shot');serviceWindow('renderVaultSheet','vault');serviceWindow('renderVaultMasterSheet','master');serviceWindow('renderRmDetailSheet','render-detail');serviceWindow('renderRmSettingsSheet','render-settings');serviceWindow('renderRmScenesSheet','render');

  document.addEventListener('input',event=>{if(event.target?.id==='pc-find'&&event.target.value){const details=event.target.closest('.ds2-launch')?.querySelector('.ds2-shortcuts');if(details)details.open=true;}},true);
  document.addEventListener('toggle',event=>{const node=event.target;if(node.matches?.('[data-service-group]'))openGroups.set(node.dataset.serviceGroup,node.open);},true);

  // The Render page follows observed jobs. Its ambient layer survives polling.
  const renderRoot=document.documentElement,renderObserved=new Map();
  let renderFrame=0,renderLight=null,renderResult=null,renderResultTimer=0,renderPulses=0,renderSnapshot={state:'idle',progress:null};
  function syncRenderLight(){
    renderFrame=0;
    const onPage=active()&&typeof ui!=='undefined'&&ui.page==='render',d=typeof ui!=='undefined'?ui.pc?.data:null;
    const next=renderPhase(d),jobs=d?rmVisibleJobs(d.rmQueue||{}):[],fresh=d&&rmFresh(d);
    if(fresh){
      for(const job of jobs){
        const previous=renderObserved.get(job.id);
        if(previous&&['rendering','delivering','paused'].includes(previous)&&['done','failed'].includes(job.status)&&!document.hidden&&onPage){
          const success=job.status==='done'&&job.delivery?.status!=='failed';
          renderResult={state:success?'success':'error',id:job.id};
          clearTimeout(renderResultTimer);
          if(success){renderPulses++;renderResultTimer=setTimeout(()=>{renderResult=null;scheduleRenderLight();},1800);}
        }
      }
      renderObserved.clear();for(const job of jobs)renderObserved.set(job.id,job.status);
    }else renderObserved.clear();
    if(['rendering','paused','queued'].includes(next.state)){renderResult=null;clearTimeout(renderResultTimer);}
    if(!onPage){
      renderResult=null;clearTimeout(renderResultTimer);delete renderRoot.dataset.renderState;delete renderRoot.dataset.renderKnown;delete renderRoot.dataset.renderAttention;
      renderLight?.remove();renderLight=null;renderSnapshot={state:'idle',progress:null};return;
    }
    const state=renderResult&&next.state==='empty'?renderResult.state:next.state;
    if(!renderLight){const atmosphere=document.querySelector('.digital-atmosphere');if(atmosphere){renderLight=document.createElement('div');renderLight.className='ds2-render-light';renderLight.setAttribute('aria-hidden','true');atmosphere.append(renderLight);}}
    if(renderRoot.dataset.renderState!==state)renderRoot.dataset.renderState=state;
    const known=next.progress!==null;if(renderRoot.dataset.renderKnown!==String(known))renderRoot.dataset.renderKnown=String(known);
    const value=String(next.progress??0);if(renderRoot.style.getPropertyValue('--render-progress')!==value)renderRoot.style.setProperty('--render-progress',value);
    const attention=['listen','think','speak'].includes(renderRoot.dataset.magicScene)?'quiet':'available';if(renderRoot.dataset.renderAttention!==attention)renderRoot.dataset.renderAttention=attention;
    renderSnapshot={state,progress:next.progress};
  }
  function scheduleRenderLight(){if(!renderFrame)renderFrame=requestAnimationFrame(syncRenderLight);}
  const renderObserver=new MutationObserver(scheduleRenderLight);renderObserver.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  document.addEventListener('flow:activity',scheduleRenderLight);document.addEventListener('flow:processstate',scheduleRenderLight);
  document.addEventListener('flow:effectschange',scheduleRenderLight);document.addEventListener('visibilitychange',scheduleRenderLight);
  window.addEventListener('pagehide',()=>{if(renderFrame)cancelAnimationFrame(renderFrame);renderFrame=0;clearTimeout(renderResultTimer);renderResult=null;renderObserved.clear();});
  window.addEventListener('pageshow',scheduleRenderLight);
  window.flowRenderMotion={getState:()=>({...renderSnapshot,completionPulses:renderPulses,visible:!!renderLight?.isConnected}),refresh:scheduleRenderLight};
  scheduleRenderLight();
})();
