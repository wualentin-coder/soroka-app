(() => {
  'use strict';
  if (document.documentElement.dataset.flowDesign === 'classic') return;
  const active=()=>document.documentElement.dataset.flowDesign==='magic';
  const escape=value=>esc(String(value??''));
  const symbol=name=>typeof icon==='function'?icon(name):'';
  const heading=(kicker,title,side='')=>window.flowMagicUI.heading(escape(kicker),escape(title),side);
  const section=(title,side='')=>window.flowMagicUI.sectionHeading(escape(title),side);
  function replace(name,renderer){if(typeof window[name]!=='function')return;const original=window[name];window[name]=function(...args){return active()?renderer.call(this,original,...args):original.apply(this,args);};}
  const date=value=>value?dateLabel(value):'Без даты';
  const glyph=name=>window.flowMagicObject?.(name)||symbol(name);
  const action=(label,name,extra='',kind='secondary')=>`<button class="cw-action ${kind==='primary'?'primary-button':''}" type="button" data-action="${name}" ${extra}>${escape(label)}</button>`;
  const empty=(title,description,control='',subject='inbox')=>`<div class="cw-empty"><span class="cw-empty-symbol" aria-hidden="true">${glyph(subject)}</span><h2>${escape(title)}</h2><p>${escape(description)}</p>${control}</div>`;
  const page=(route,head,body)=>`<div class="cw-workspace cw-${route}">${head}${body}</div>`;

  replace('renderTasksPage',original=>{
    // Native filtering, ordering and TaskRow stay owned by the original page.
    const template=document.createElement('template');template.innerHTML=original();
    const tabs=template.content.querySelector('.subtabs'),stack=template.content.querySelector('.task-stack');
    tabs.className='cw-tabs cw-task-filters';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Открытые задачи');
    for(const button of tabs.querySelectorAll('button')){button.setAttribute('aria-pressed',String(button.dataset.filter===ui.tasksFilter));if(button.dataset.filter==='upcoming')button.textContent='Предстоящие';}
    const hasTasks=!!stack.querySelector('.task-card');
    const events=data.events.filter(event=>event.due>=todayIso()).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,4);
    const context=events.length?`<section class="cw-task-context dm-native-events">${section('Ближайшие события')}${events.map(eventCard).join('')}</section>`:'';
    return page('tasks',heading('Все открытые задачи','Дела',action('Новая задача','tasks-add','','primary')),`${tabs.outerHTML}${hasTasks?stack.outerHTML:empty('Здесь нет открытых дел','Выбери другой фильтр или добавь задачу.','','tasks')}${context}<div class="cw-task-project-link">${action('Открыть проекты','navigate','data-page="projects"')}</div>`);
  });

  replace('renderInboxPage',()=>{
    const filters=[['all','Все'],['unclear','Уточнить'],['payments','Платежи'],['overdue','Просрочено'],['uncategorized','Без раздела'],['duplicates','Дубли']];
    const all=inboxEntries(),selected=filters.some(([key])=>key===ui.inboxFilter)?ui.inboxFilter:'all',rows=all.filter(entry=>selected==='all'||entry.group===selected);
    const filterHTML=`<div class="cw-tabs cw-inbox-filters" role="group" aria-label="Вид входящих">${filters.map(([key,label])=>`<button type="button" data-action="inbox-filter" data-filter="${key}" aria-pressed="${selected===key}"><span>${label}</span><small>${key==='all'?all.length:all.filter(entry=>entry.group===key).length}</small></button>`).join('')}</div>`;
    const row=entry=>{
      const source=entry.key==='message'?data.inbox.find(item=>item.id===entry.id):null;
      const meta=entry.key==='payment'?'Платёж · ждёт подтверждения':entry.key==='task'?'Задача · просрочено':entry.group==='duplicates'?'Возможный дубль':`${source?.type||'Запись'} · ${entry.group==='unclear'?'уточнить':'без раздела'}`;
      const detail=source?.detail||entry.subtitle.split('·').slice(1).join('·').trim();
      const controls=entry.key==='payment'?action('Подтвердить списание','payment-confirm',`data-id="${escape(entry.id)}"`):entry.key==='task'?action('Открыть задачу','inbox-open-task',`data-id="${escape(entry.id)}"`):`<button class="cw-action cw-review" type="button" id="cw-inbox-review-${escape(entry.id)}" data-core-inbox-review="${escape(entry.id)}" data-swipe-inline>Разобрать ${symbol('right')}</button><details class="cw-destinations"><summary data-swipe-inline>Перенести ${symbol('down')}</summary><div>${action('В дела','inbox-task',`data-id="${escape(entry.id)}"`)}${action('В библиотеку','inbox-save',`data-id="${escape(entry.id)}" data-swipe-inline`)}</div></details>`;
      return `<article class="list-row cw-inbox-row" data-inbox-kind="${entry.key}"><div class="cw-inbox-copy"><div class="cw-row-top"><span class="cw-record-symbol" aria-hidden="true">${symbol(entry.icon)}</span><small>${escape(meta)}</small></div><h2 title="${escape(entry.title)}">${escape(entry.title)}</h2>${detail?`<p title="${escape(detail)}">${escape(detail)}</p>`:''}</div><div class="cw-row-actions">${controls}</div></article>`;
    };
    return page('inbox',heading('Очередь решений','Входящие'),`${filterHTML}${rows.length?`<p class="cw-queue-caption">${rows.length} ${word(rows.length,'запись ждёт решения','записи ждут решения','записей ждут решения')}</p><div class="cw-inbox-list">${rows.map(row).join('')}</div>`:empty('Всё разобрано',selected==='all'?'Новые сообщения и записи, требующие решения, появятся здесь.':'В этом фильтре нет записей. Остальные входящие — в соседних вкладках.')}`);
  });

  function projectRow(entry){return `<button class="finance-row-button cw-linked-row" type="button" data-action="${entry.action}" data-id="${escape(entry.id)}" ${entry.category?`data-category="${escape(entry.category)}"`:''}><span><strong>${escape(entry.title||'Без названия')}</strong><small>${escape(entry.meta)}${entry.date?` · ${escape(date(entry.date))}`:''}</small></span>${symbol('right')}</button>`;}
  const nextProjectTask=matches=>[...matches.tasks].filter(task=>!task.done).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||(a.time||'99').localeCompare(b.time||'99'))[0];
  replace('renderProjectsPage',()=>{
    const selected=data.projects.find(project=>project.id===ui.projectId);
    if(!selected){
      const cards=data.projects.map(project=>{const matches=projectMatches(project),count=matches.tasks.filter(task=>!task.done).length,next=nextProjectTask(matches);return `<button class="project-card cw-project-card" type="button" data-action="project-open" data-id="${escape(project.id)}" style="--project-color:${escape(project.color||'var(--accent)')}"><span class="cw-project-glyph" aria-hidden="true">${glyph('projects')}</span><span class="cw-project-copy"><span class="cw-project-title"><strong>${escape(project.name||'Без названия')}</strong>${project.status?`<small class="cw-project-status">${escape(project.status)}</small>`:''}</span><span class="cw-project-counts">${count} ${word(count,'дело','дела','дел')} · ${matches.materials.length+matches.notes.length} ${word(matches.materials.length+matches.notes.length,'материал','материала','материалов')} · ${matches.transactions.length} ${word(matches.transactions.length,'операция','операции','операций')}</span>${next?`<span class="cw-project-next" title="${escape(next.title)}"><span>${next.due&&next.due<todayIso()?'Просрочено':'Далее'}${next.due?` · ${escape(date(next.due))}`:''}</span> ${escape(next.title)}</span>`:project.description?`<span class="cw-project-next" title="${escape(project.description)}">${escape(project.description)}</span>`:''}</span>${symbol('right')}</button>`;}).join('');
      return page('projects',heading('Связанные дела и материалы','Проекты',action('Новый проект','project-new','', 'primary')),cards?`<div class="cw-project-grid">${cards}</div>`:empty('Место для нового проекта','Объедини задачи, события и материалы одной темой.','','projects'));
    }
    const matches=projectMatches(selected),next=nextProjectTask(matches);
    const groups=[
      ['Задачи',matches.tasks.map(task=>({date:task.due,title:task.title,meta:task.done?'Завершено':task.time||'Открытая задача',action:'project-task',id:task.id}))],
      ['События',matches.events.map(event=>({date:event.due,title:event.title,meta:event.time||'Событие',action:'project-event',id:event.id}))],
      ['Заметки',matches.notes.map(note=>({date:note.created,title:note.title,meta:'Заметка',action:'project-note',id:note.id}))],
      ['Материалы',matches.materials.map(item=>({date:item.created,title:item.title,meta:SAVED_NAMES[item.category],action:'project-saved',id:item.id,category:item.category}))],
      ['Операции',matches.transactions.map(item=>({date:item.date,title:item.title,meta:demoMoney(item.amount,item.currency||'RUB'),action:'project-transaction',id:item.id}))]
    ];
    const total=groups.reduce((n,[,entries])=>n+entries.length,0);
    return page('project-detail',`<div class="cw-project-tools">${action('Все проекты','project-back')}</div>${heading(selected.status||'Проект',selected.name,action('Изменить','project-edit',`data-id="${escape(selected.id)}"`))}`,`${selected.description?`<p class="cw-project-description">${escape(selected.description)}</p>`:''}${next?`<button class="cw-next-task" type="button" data-action="project-task" data-id="${escape(next.id)}"><span><small>${next.due&&next.due<todayIso()?'Просрочено':'Ближайшее дело'}${next.due?` · ${escape(date(next.due))}`:''}${next.time?` · ${escape(next.time)}`:''}</small><strong>${escape(next.title)}</strong></span>${symbol('arrow')}</button>`:''}${total?`<div class="cw-project-groups">${groups.filter(([,entries])=>entries.length).map(([label,entries])=>`<section class="cw-linked-group">${section(label,`<span>${entries.length}</span>`)}${entries.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(projectRow).join('')}</section>`).join('')}</div>`:empty('Проект пока пуст','Выбери этот проект в задаче, событии или материале — запись появится здесь.','','projects')}`);
  });

  let metricSelection='';
  const seriesKey=item=>JSON.stringify([String(item.title||'Показатель').trim().toLocaleLowerCase('ru-RU'),String(item.unit||'').trim()]);
  function metricSeries(){const groups=new Map();for(const item of [...data.metrics].sort((a,b)=>(b.date||'').localeCompare(a.date||''))){const key=seriesKey(item);if(!groups.has(key))groups.set(key,{key,title:item.title||'Показатель',unit:item.unit||'',items:[]});groups.get(key).items.push(item);}return [...groups.values()];}
  const number=value=>Number(value).toLocaleString('ru-RU',{maximumSignificantDigits:6});
  function metricChart(series){
    const points=series.items.filter(item=>item.value!==''&&item.value!=null&&Number.isFinite(Number(item.value))).slice(0,14).reverse();
    if(!points.length)return '<p class="cw-chart-empty">В этой серии пока нет числовых значений.</p>';
    const values=points.map(item=>Number(item.value)),min=Math.min(...values),max=Math.max(...values),times=points.map(item=>Date.parse(`${item.date}T12:00:00`));
    const validTime=times.every(Number.isFinite),start=validTime?Math.min(...times):0,end=validTime?Math.max(...times):0;
    const coordinates=values.map((value,i)=>({x:validTime&&end>start?18+(times[i]-start)/(end-start)*264:points.length>1?18+i/(points.length-1)*264:150,y:max===min?48:82-(value-min)/(max-min)*64,item:points[i]}));
    return `<div class="cw-metric-chart"><div class="cw-chart-scale"><span>${number(max)} ${escape(series.unit)}</span><span>${points.length===1?'Одно измерение':`${points.length} ${word(points.length,'значение','значения','значений')}${series.items.length>14?` из ${series.items.length}`:''}`}</span></div><svg class="cw-metric-plot" viewBox="0 0 300 102" role="img" aria-label="${escape(series.title)}, ${escape(series.unit)}: от ${number(min)} до ${number(max)}"><path class="cw-chart-guide" d="M18 18H282M18 82H282"/>${points.length>1?`<polyline points="${coordinates.map(point=>`${point.x},${point.y}`).join(' ')}"/>`:''}${coordinates.map((point,i)=>`<circle class="${i===coordinates.length-1?'is-latest':''}" cx="${point.x}" cy="${point.y}" r="${i===coordinates.length-1?4:2.5}"><title>${escape(date(point.item.date))}: ${escape(point.item.value)} ${escape(series.unit)}</title></circle>`).join('')}</svg><div class="cw-chart-dates"><span>${escape(date(points[0].date))}</span><span>${points.length>1?escape(date(points.at(-1).date)):''}</span></div><small class="cw-chart-min">Нижняя граница: ${number(min)} ${escape(series.unit)}</small></div>`;
  }
  replace('renderMetricsPage',()=>{
    const series=metricSeries();if(!series.some(item=>item.key===metricSelection))metricSelection=series[0]?.key||'';
    const selected=series.find(item=>item.key===metricSelection),add=action('Добавить','metric-new',selected?`data-metric-title="${escape(selected.title)}" data-metric-unit="${escape(selected.unit)}"`:'','primary');
    const head=heading('Личные измерения','Показатели',add);
    if(!selected)return page('metrics',head,empty('Первые измерения','Добавь показатель, его значение и единицу. Каждая серия будет иметь собственную шкалу.','','metrics'));
    const last=selected.items[0];
    return page('metrics',head,`<div class="cw-tabs cw-series-tabs" role="group" aria-label="Показатель и единица">${series.map(item=>`<button type="button" data-core-series="${escape(encodeURIComponent(item.key))}" aria-pressed="${item.key===selected.key}"><span>${escape(item.title)}</span><small>${escape(item.unit||'без единицы')}</small></button>`).join('')}</div><section class="cw-metric-stage" data-series-unit="${escape(selected.unit)}"><div class="cw-metric-current"><div><h2>${escape(selected.title)}</h2><p>Последнее · ${escape(date(last.date))}</p></div><strong>${escape(last.value)} <small>${escape(selected.unit)}</small></strong></div>${metricChart(selected)}</section>${section('История измерений',`<span>${selected.items.length}</span>`)}<div class="cw-metric-records">${selected.items.map(item=>`<button class="finance-row-button cw-linked-row" type="button" data-action="metric-edit" data-id="${escape(item.id)}"><span><strong>${escape(date(item.date))}</strong></span><b>${escape(item.value)} ${escape(item.unit)}</b>${symbol('right')}</button>`).join('')}</div>`);
  });

  const recordNames={task:'Задача',event:'Событие',note:'Заметка',project:'Проект',metric:'Показатель',inbox:'Входящее','finance:transaction':'Операция','finance:transfer':'Перевод','finance:debt':'Долг','finance:goal':'Цель','finance:payment':'Платёж','finance:budget':'Бюджет','finance:rule':'Правило','finance:account':'Счёт'};
  replace('renderArchivePage',()=>{
    const tabs=[['trash','Корзина'],['completed','Завершено'],['past','Прошедшие'],['viewed','Просмотрено']],tab=tabs.some(([key])=>key===ui.archiveTab)?ui.archiveTab:'trash';
    const now=new Date().toTimeString().slice(0,5),completed=data.tasks.filter(task=>task.done),past=data.events.filter(event=>event.due<todayIso()||event.due===todayIso()&&event.time&&event.time<now).sort((a,b)=>b.due.localeCompare(a.due)),viewed=SAVED_CATEGORIES.filter(([key])=>!['notes','lists'].includes(key)).flatMap(([category])=>savedItems(category).filter(item=>item.viewed).map(item=>({category,item})));
    const counts={trash:data.trash.length,completed:completed.length,past:past.length,viewed:viewed.length};
    let content='',count=0;
    if(tab==='trash'){
      count=data.trash.length;content=count?`<div class="cw-trash-list">${[...data.trash].reverse().map(entry=>`<article class="cw-trash-row"><small>${escape(entry.type.startsWith('saved:')?SAVED_NAMES[entry.type.slice(6)]||'Запись':recordNames[entry.type]||'Запись')} · удалено ${escape(date(entry.deletedAt))}</small><h2>${escape(entry.item.title||entry.item.name||entry.item.person||'Без названия')}</h2><div class="cw-row-actions">${action('Вернуть','archive-restore',`data-id="${escape(entry.id)}"`,'primary')}<button class="cw-action cw-danger" type="button" data-action="archive-purge" data-id="${escape(entry.id)}">Удалить навсегда</button></div></article>`).join('')}</div>`:empty('Корзина пуста','Здесь будут удалённые записи, которые ещё можно восстановить.');
    }else if(tab==='completed'){content=completed.length?`<div class="task-stack cw-history-tasks">${completed.map(taskCard).join('')}</div>`:empty('Пока нет завершённых дел','Отмеченные задачи останутся здесь как история.','','tasks');}
    else if(tab==='past'){content=past.length?`<div class="cw-history-events dm-native-events">${past.map(eventCard).join('')}</div>`:empty('Прошедших событий пока нет','События сохранятся здесь после своего времени.','','archive');}
    else{content=viewed.length?`<div class="cw-viewed-tools">${action('Случайный материал','archive-random')}</div><div class="cw-history-records">${viewed.map(({category,item})=>savedRecordCard(item,category)).join('')}</div>`:empty('Просмотренные материалы появятся здесь','Отметь материал в библиотеке после просмотра.','','archive');}
    return page('archive',heading('История и восстановление','Архив и корзина'),`<div class="cw-tabs cw-archive-tabs" role="group" aria-label="Архив">${tabs.map(([key,label])=>`<button type="button" aria-pressed="${tab===key}" data-action="archive-tab" data-tab="${key}"><span>${label}</span><small>${counts[key]}</small></button>`).join('')}</div>${tab==='trash'&&counts.trash?'<p class="cw-archive-note">Верни нужное в исходный раздел. Удаление навсегда нельзя отменить.</p>':''}${content}`);
  });

  replace('renderCaptureInput',original=>original().replace('class="sheet capture-input-sheet"','class="sheet capture-input-sheet cw-core-sheet cw-capture-sheet"').replace('rows="5"','rows="3"').replace('Напишите как боту — обычным текстом. Перед сохранением можно исправить разбор.','Запиши мысль, задачу или расход. Перед сохранением проверим детали.').replace('<div class="capture-examples"><span>Попробовать пример</span>','<details class="capture-examples cw-capture-examples"><summary>Примеры сообщений</summary><div class="cw-capture-samples">').replace('</div><details class="capture-manual">','</div></details><details class="capture-manual">'));

  function sizeSearch(){const layer=document.querySelector('.cw-search-backdrop');if(!layer)return;layer.style.setProperty('--cw-viewport',`${window.visualViewport?.height||innerHeight}px`);layer.style.setProperty('--cw-offset',`${window.visualViewport?.offsetTop||0}px`);}
  function revealTab(button){const strip=button?.closest('.cw-tabs');if(!strip)return;const a=strip.getBoundingClientRect(),b=button.getBoundingClientRect();if(b.right>a.right)strip.scrollLeft+=b.right-a.right+2;else if(b.left<a.left)strip.scrollLeft-=a.left-b.left+2;}
  function revealSelectedTabs(){if(active())document.querySelectorAll('.cw-workspace .cw-tabs button[aria-pressed="true"]').forEach(revealTab);}
  document.addEventListener('click',event=>{
    if(!active())return;
    const review=event.target.closest('[data-core-inbox-review]');
    if(review){openCardEditor('inbox',review.dataset.coreInboxReview);return;}
    const native=event.target.closest('[data-action="inbox-filter"],[data-action="archive-tab"],[data-action="search-filter"],[data-action="tasks-filter"]');
    if(native){
      const key=native.dataset.action==='archive-tab'?'tab':'filter',target=[...document.querySelectorAll(`[data-action="${native.dataset.action}"]`)].find(node=>node.dataset[key]===native.dataset[key]),strip=target?.closest('.cw-tabs,.cw-search-sheet .search-filters');
      if(strip){const a=strip.getBoundingClientRect(),b=target.getBoundingClientRect();if(b.right>a.right)strip.scrollLeft+=b.right-a.right+2;else if(b.left<a.left)strip.scrollLeft-=a.left-b.left+2;target.focus({preventScroll:true});}return;
    }
    const button=event.target.closest('[data-core-series]');if(!button)return;
    metricSelection=decodeURIComponent(button.dataset.coreSeries);const scroll=button.parentElement.scrollLeft;render();const target=[...document.querySelectorAll('[data-core-series]')].find(node=>node.dataset.coreSeries===button.dataset.coreSeries);if(target){target.parentElement.scrollLeft=scroll;revealTab(target);target.focus({preventScroll:true});}
  });
  window.addEventListener('resize',()=>{sizeSearch();revealSelectedTabs();});window.visualViewport?.addEventListener('resize',sizeSearch);window.visualViewport?.addEventListener('scroll',sizeSearch);
  const searchObserver=new MutationObserver(records=>{const added=records.flatMap(record=>[...record.addedNodes]).filter(node=>node.nodeType===1);if(added.some(node=>node.matches?.('.cw-search-backdrop')||node.querySelector?.('.cw-search-backdrop')))sizeSearch();if(added.some(node=>node.matches?.('.cw-workspace')||node.querySelector?.('.cw-workspace')))requestAnimationFrame(revealSelectedTabs);});
  searchObserver.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  sizeSearch();
})();
