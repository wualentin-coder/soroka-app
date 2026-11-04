(() => {
  'use strict';
  if (document.documentElement.dataset.flowDesign === 'classic') return;
  const active=()=>document.documentElement.dataset.flowDesign==='magic';
  const escape=value=>esc(String(value??''));
  const symbol=name=>typeof icon==='function'?icon(name):'';
  const heading=(kicker,title,side='')=>window.flowMagicUI.heading(escape(kicker),escape(title),side);
  const parse=html=>{const t=document.createElement('template');t.innerHTML=html;return t;};
  function replace(name,renderer){if(typeof window[name]!=='function')return;const original=window[name];window[name]=function(...args){return active()?renderer.call(this,original,...args):original.apply(this,args);};}
  const modules = [
    ['piano', 'Пианино', 'От первой ноты к своей мелодии', 'piano'], ['english', 'Английский', 'Слова, разговоры и чтение', 'study'],
    ['sport', 'Спорт', 'Тренировки, привычки и цели', 'heart'],
    ['tasks', 'Все дела', 'С датой и без срока', 'check'], ['projects', 'Проекты', 'Связанные задачи и материалы', 'project'],
    ['vault', 'Пароли', 'Отдельное зашифрованное хранилище', 'key'], ['docs', 'Документы', 'Личные документы под рукой', 'file'],
    ['vpn', 'VPN', 'Ключи, устройства и трафик', 'locate'], ['server', 'Сервер', 'Службы, нагрузка и копии', 'server'],
    ['pc', 'Компьютер', 'Управление и состояние', 'desktop'], ['render', 'Рендер', 'Очередь Karma и After Effects', 'film'],
    ['archive', 'Архив и корзина', 'История и удалённые записи', 'archive'], ['settings', 'Настройки', 'Вид, уведомления и данные', 'settings']
  ];
  const byPage = new Map(modules.map(item=>[item[0],item]));
  const groups = [
    ['practice','Занятия',['piano','english','sport']],
    ['personal','Дела и личное',['tasks','projects','docs','vault','archive']],
    ['devices','Устройства и работа',['pc','render','server','vpn']],
    ['preferences','Предпочтения',['settings']]
  ];
  function moduleCard([page,title,description,name],practice=false){
    const art=window.flowMagicObject?window.flowMagicObject(page):symbol(name);
    return `<button class="dc-module-card ${practice?'dc-practice-card':'dc-route-row'} dc-module-${page}" type="button" data-action="navigate" data-page="${page}"><span class="module-symbol" aria-hidden="true">${art}</span><span class="dc-route-copy"><h3>${escape(title)}</h3><p>${escape(description)}</p></span><span class="dc-route-arrow" aria-hidden="true">${symbol('right')}</span></button>`;
  }
  let practiceMarkup='';
  window.flowMagicUI.practiceCards=()=>practiceMarkup||(practiceMarkup=`<div class="dc-directory dc-practice-directory">${['piano','english','sport'].map(page=>moduleCard(byPage.get(page),true)).join('')}</div>`);
  replace('renderMorePage',()=>`<div class="wide-content dc-more">${heading('Все части твоего пространства','Ещё')}<div class="dc-module-groups">${groups.map(([id,title,pages],index)=>`<section class="dc-module-group dc-module-group-${id}" style="--group-delay:${index*70}ms"><h2>${title}</h2><div class="dc-directory ${id==='practice'?'dc-practice-directory':'dc-route-directory'}">${pages.map(page=>moduleCard(byPage.get(page),id==='practice')).join('')}</div>${id==='personal'?`<div class="dc-aux-routes" aria-label="Работа с записями">${[['inbox','Входящие'],['metrics','Показатели']].map(([page,label])=>`<button type="button" data-action="navigate" data-page="${page}"><span aria-hidden="true">${window.flowMagicObject?.(page,true)||symbol('chart')}</span>${label}${symbol('right')}</button>`).join('')}</div>`:''}</section>`).join('')}</div><section class="dc-chat-return"><div><h2>Продолжить в чате</h2><p>Текст, голос и файлы попадут в нужный раздел.</p></div><button class="secondary-button" type="button" data-action="return-chat">Открыть чат ${symbol('arrow')}</button></section>${window.SOROKA_LIVE?`<div class="dc-sync-line"><span>Записи Flow</span><button class="text-button" type="button" data-action="reset">Обновить записи ${symbol('reset')}</button></div>`:''}</div>`);
  const preferenceOpen=new Map();
  function effectState(){return window.flowDigital?.getState?.()||null;}
  function effectSummary(state=effectState()){
    if(!state||state.disposed)return 'Эффекты недоступны';
    return `${state.motionMode==='system'?'По настройке устройства':state.motion?'Движение включено':'Без движения'} · ${state.sound?'звук включён':'без звука'}`;
  }
  function effectsGroup(){
    const state=effectState(),available=Boolean(window.Telegram?.WebApp?.HapticFeedback||typeof navigator.vibrate==='function');
    const rows=[['motion','Движение и свет','Переходы, живые поверхности и отклик на ввод'],['sound','Звуковые отклики','Цифровые сигналы действий'],['haptics','Тактильный отклик','Если поддерживается устройством'],['ambient','Звуковая атмосфера','Отдельный тихий фон']];
    return `<section class="settings-group dc-effects-group dv-feedback" data-settings-title="Движение, свет и звук"><h2>Живой отклик</h2><p class="dv-group-caption" data-directory-effect-summary>${escape(effectSummary(state))}</p><div class="list-panel">${rows.map(([key,title,hint])=>`<div class="settings-row"><div><strong id="directory-effect-${key}">${title}</strong><span>${hint}</span></div><label class="switch"><input type="checkbox" role="switch" data-directory-effect="${key}" aria-labelledby="directory-effect-${key}" ${state?.[key]?'checked':''} ${!state||state.disposed||key==='haptics'&&!available?'disabled':''}><span></span></label></div>`).join('')}</div><div class="dv-effect-footer"><button class="text-button" type="button" data-directory-motion-system ${!state||state.disposed?'disabled':''}>Движение как в устройстве</button><button class="text-button" type="button" data-flow-digital-settings ${!state||state.disposed?'disabled':''}>Настроить звучание ${symbol('right')}</button></div><p class="dv-runtime-note" data-directory-motion-source>${state?.motionMode==='system'?'Движение следует настройке устройства.':'Для Flow выбран отдельный режим движения.'}</p></section>`;
  }
  function summaryFor(group){
    const name=group.dataset.settingsTitle||group.querySelector('h2')?.textContent||'',s=data.settings;
    if(name==='Внешний вид')return `${THEMES[ui.theme]?.label||'Тёмная'} · ${(ACCENTS.find(([id])=>id===(s.accent||'teal'))||[])[1]||'Акцент'}`;
    if(name==='Поведение')return `${{spacious:'Просторно',comfortable:'Обычная плотность',compact:'Компактно'}[s.density]||'Обычная плотность'} · старт: ${{today:'План',saved:'Сохранённое',finance:'Финансы'}[s.startPage]||'План'}`;
    if(name==='Бот')return `Утро ${s.digest||'08:30'} · вечер ${s.digestEvening||'21:00'}`;
    if(name==='Модели ИИ'||name==='Ассистент')return s.manualOnly?'Ввод вручную':s.openRouter&&Number(s.openRouter.left)>0?'Разбор записей доступен':'Возможности обработки';
    if(name==='Данные')return 'Экспорт и хранение записей';
    if(name==='Подключения')return 'Расширение для браузера';
    if(name==='Телефон')return 'Уведомления, карты и обновления';
    return '';
  }
  function settingsPage(original){
    const template=parse(original()),native=[...template.content.querySelectorAll('.settings-group')],appearance=native.find(group=>group.querySelector('[data-setting=theme]')),aside=template.content.querySelector('.content-aside');
    const workspace=document.createElement('section');workspace.className='settings-group';workspace.innerHTML='<h2>Поведение</h2><div class="list-panel"></div>';
    if(appearance){
      appearance.classList.add('dv-appearance');appearance.dataset.settingsTitle='Внешний вид';
      for(const key of['density','startPage']){const row=appearance.querySelector('[data-setting="'+key+'"]')?.closest('.settings-row');if(row)workspace.querySelector('.list-panel').append(row);}
      const title=appearance.querySelector('h2');if(title)title.insertAdjacentHTML('afterend','<p class="dv-group-caption" data-settings-accent>'+escape(summaryFor(appearance))+'</p>');
    }
    for(const old of template.content.querySelectorAll('[data-setting=notifySleep]'))old.closest('.settings-row')?.remove();
    for(const range of template.content.querySelectorAll('.settings-range')){
      range.setAttribute('role','group');range.setAttribute('aria-label','Тихие часы');range.closest('.settings-row')?.classList.add('dv-quiet-row');
      for(const[index,input]of[...range.querySelectorAll('input')].entries()){const label=document.createElement('label');label.innerHTML='<span>'+(index?'До':'С')+'</span>';input.before(label);label.append(input);}range.querySelector(':scope>span')?.remove();
    }
    const storage=native.find(group=>group.querySelector('[data-action=export-json]'));if(storage&&aside){aside.className='dv-storage-note';storage.append(aside);}
    const assistant=native.find(group=>group.querySelector('[data-setting=manualOnly]'));
    if(assistant){assistant.dataset.settingsTitle='Ассистент';assistant.querySelector('h2').textContent='Помощь Flow';const billing=document.createElement('details');billing.className='dv-billing';billing.innerHTML='<summary>Лимиты и расходы '+symbol('down')+'</summary>';for(const child of[...assistant.children])if(child.matches('.side-card,.section-note'))billing.append(child);assistant.append(billing);}
    const other=native.filter(group=>group!==appearance);if(workspace.querySelector('.settings-row'))other.unshift(workspace);
    const disclosures=other.map((group,index)=>{
      const title=group.dataset.settingsTitle||group.querySelector('h2')?.textContent||'Настройки',name={Бот:'Бот и уведомления',Ассистент:'Помощь Flow'}[title]||title,key={Поведение:'workspace',Бот:'bot',Подключения:'connections',Телефон:'phone',Ассистент:'assistant',Данные:'data'}[title]||'group-'+index;
      const detail=document.createElement('details');detail.className='settings-group dv-preference-group';detail.dataset.preferenceGroup=key;detail.dataset.settingsTitle=title;detail.open=preferenceOpen.get(key)||false;
      detail.innerHTML=`<summary><span><strong>${escape(name)}</strong><small data-settings-caption>${escape(summaryFor(group))}</small></span><span class="dv-disclosure-mark" aria-hidden="true">${symbol('down')}</span></summary>`;
      for(const child of[...group.children])if(child.tagName!=='H2')detail.append(child);return detail.outerHTML;
    }).join('');
    queueMicrotask(syncEffects);
    return `<div class="wide-content dc-settings dv-preferences">${heading('Личный Flow','Настройки')}<div class="dv-preference-workbench"><div class="dv-visual-preferences">${appearance?.outerHTML||''}</div><div class="dv-sensory-preferences">${effectsGroup()}</div><div class="dv-other-preferences">${disclosures}</div></div></div>`;
  }
  replace('renderSettingsPage',settingsPage);
  function syncEffects(){
    const state=effectState();for(const input of document.querySelectorAll('[data-directory-effect]'))input.checked=Boolean(state?.[input.dataset.directoryEffect]);
    const summary=document.querySelector('[data-directory-effect-summary]');if(summary)summary.textContent=effectSummary(state);
    const note=document.querySelector('[data-directory-motion-source]');if(note)note.textContent=!state||state.disposed?'Эффекты сейчас недоступны.':state.motionMode==='system'?'Движение следует настройке устройства.':'Для Flow выбран отдельный режим движения.';
    for(const group of document.querySelectorAll('.dv-preference-group')){const caption=group.querySelector('[data-settings-caption]');if(caption)caption.textContent=summaryFor(group);}
    const accent=document.querySelector('[data-settings-accent]');if(accent)accent.textContent=summaryFor(accent.closest('.settings-group'));
  }
  document.addEventListener('click',event=>{if(active()&&event.target.closest('[data-directory-motion-system]'))window.flowDigital?.setMotionMode?.('system');});
  document.addEventListener('change',event=>{if(!active())return;const input=event.target.closest('[data-directory-effect]');if(input)window.flowDigital?.setEffect?.(input.dataset.directoryEffect,input.checked);if(event.target.closest('.dv-preferences'))queueMicrotask(syncEffects);});
  document.addEventListener('toggle',event=>{const group=event.target;if(group.matches?.('[data-preference-group]'))preferenceOpen.set(group.dataset.preferenceGroup,group.open);},true);
  document.addEventListener('flow:effectschange',syncEffects);

})();
