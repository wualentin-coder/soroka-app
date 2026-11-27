import { getModuleHost } from './runtime-session.js';
import { confirmMore, copyMore, moreEmpty, moreForm, moreInput, moreList, moreOptions, moreRow, repaintMore } from './glow-more-ui.mjs';

const starts = [['today', 'План'], ['saved', 'Сохранённое'], ['finance', 'Финансы'], ['more', 'Ещё']];
const densities = [['compact', 'Компактно'], ['comfortable', 'Обычно'], ['spacious', 'Просторно']];
const modes = [['digest', 'В сводке'], ['timed', 'По времени'], ['off', 'Выключено']];
const notifications = [['notifyShower', 'Душ'], ['notifyHabits', 'Привычки'], ['notifyEnglish', 'Английский'], ['notifySleep', 'Сон']];
const times = [['digest', 'Утренняя сводка', '08:30'], ['digestEvening', 'Вечерний разбор', '21:00'],
  ['quietFrom', 'Тихие часы · с', '23:00'], ['quietTo', 'Тихие часы · до', '08:00']];
const appearanceGroups = ['pal', 'bg', 'crt', 'mb', 'motion', 'snd'];
const button = (action, text) => `<button class="btn sm glass" data-more-setting-action="${action}">${text}</button>`;
const entry = (title, input, detail = '') => `<label class="syrow more-setting"><span><b>${esc2(title)}</b>
  ${detail ? `<small>${esc2(detail)}</small>` : ''}</span>${input}</label>`;
const select = (title, key, items, value, attr = 'data-more-setting') => entry(title,
  `<select class="more-setting-control" ${attr}="${key}">${moreOptions(items, value)}</select>`);
const onOff = (title, key, value, attr = 'data-more-setting') => entry(title,
  `<input type="checkbox" class="more-setting-control" ${attr}="${esc2(key)}"${value ? ' checked' : ''}>`);
const statusRow = (icon, title, detail, action = '') => stRow(icon, esc2(title), esc2(detail), action || '<span></span>');
const card = (icon, title, detail, action) => moreList(statusRow(icon, title, detail, action));
const phone = () => {
  try { return JSON.parse(window.SorokaAndroid?.phoneState?.() || 'null'); }
  catch { return null; }
};
const safeTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function applyMoreLayout(settings) {
  document.documentElement.dataset.glowDensity = densities.some(([key]) => key === settings?.density) ? settings.density : 'comfortable';
  const phone = document.querySelector('.phone');
  phone?.classList.toggle('glow-hide-near', settings?.overviewHidden?.includes('next') === true);
}

export function connectMoreSettings({ snapshot, write, refresh, hasPending, retryPending, secure, pc }) {
  const current = () => snapshot()?.settings || {};
  const homeName = () => starts.find(([key]) => key === current().startPage)?.[1] || 'План';
  const user = () => window.Telegram?.WebApp?.initDataUnsafe?.user;
  const userName = () => [user()?.first_name, user()?.last_name].filter(Boolean).join(' ') || 'Flow';
  const isTelegram = () => !!window.Telegram?.WebApp?.initData;
  const calendar = () => statusRow('task', 'Google Календарь', current().gcal ? 'Подключён' : 'Подключается в боте', button('calendar', 'Команда'));
  const settingsChange = (key, value) => write(next => { next.settings[key] = value; }, 'settings:' + key);
  const label = value => esc2(value ?? '');
  const lookOriginal = STP.look.h;
  function appearance() {
    const template = document.createElement('template');
    template.innerHTML = lookOriginal();
    $('[data-sseg="dense"]', template.content)?.closest('.syrow')?.remove();
    $('.list', template.content)?.insertAdjacentHTML('beforeend', select('Плотность', 'density', densities, current().density || 'comfortable'));
    if (document.documentElement.dataset.glowRelease === 'true') {
      const url = esc2('../' + location.search + location.hash);
      $('.list', template.content)?.insertAdjacentHTML('beforeend',
        statusRow('sun', 'Предыдущая версия', 'Flow', `<a class="btn sm glass" href="${url}">Открыть</a>`));
    }
    return template.innerHTML;
  }

  const summaries = {
    look: () => PALS.find(([key]) => key === sideVal('pal'))?.[1] || '',
    home: homeName,
    notif: () => current().digest || '08:30',
    bot: () => isTelegram() ? 'Подключён' : 'Настройки канала',
    phone: () => phone()?.linked ? 'Подключён' : phone() ? 'Android' : 'На телефоне',
    links: () => current().gcal ? 'Календарь подключён' : '',
    ai: () => current().manualOnly ? 'Ручной ввод' : '',
    sec: () => 'Хранилище',
    data: () => '',
  };
  R.settings = () => `<div class="glass sta"><span class="ic pcic" style="--c:var(--a3)"><b>${label([...userName()][0])}</b></span>
    <span><b>${label(userName())}</b><small>${isTelegram() ? 'Telegram' : phone() ? 'Flow для Android' : 'Flow'}</small></span></div>
    ${STG.map(group => '<div class="glass list stgrp">' + group.map(key => {
      const entry = STP[key];
      return `<button class="rw syset" data-stp="${key}" style="--c:${entry.c}"><span class="ic">${sic()[entry.i]}</span>
        <span><b>${entry.t}</b></span><span class="stv2">${label(summaries[key]())}${syChev()}</span></button>`;
    }).join('') + '</div>').join('')}`;
  function phoneSettings() {
    const p = phone();
    if (!p) return moreEmpty('Настройки телефона открываются в Flow на Android');
    const toggle = (title, key, value) => onOff(title, key, value, 'data-glow-phone');
    const act = (id, title) => `<button class="btn sm glass" data-glow-phone-action="${esc2(id)}">${title}</button>`;
    const bankList = (items, extra) => (items || []).filter(item => item.on).map(item => item.name).concat(extra || []).join(', ') || 'Ничего не выбрано';
    const checkPermission = (key, active, text) => p[key] === false && active ? '<div class="more-secure-actions">' + act(key, text) + '</div>' : '';
    return card('phone', 'Flow' + (p.version ? ' ' + p.version : ''), p.linked ? 'Подключён к боту' : 'Нужен код из бота', act('native', 'Подключение'))
      + card('shield', 'Работа в фоне', p.awake ? 'Без ограничений' : 'Телефон может приостанавливать Flow', p.awake ? '' : act('battery', 'Разрешить'))
      + '<div class="fsl">Банки</div>' + moreList(toggle('Уведомления банков', 'notify', p.notify)
        + checkPermission('notifyAccess', p.notify, 'Разрешить уведомления банков')
        + statusRow('wallet', 'Приложения банков', bankList(p.apps, (p.customApps || []).map(row => row.label)), button('bank-app', 'Изменить'))
        + statusRow('fn', 'SMS банков', bankList(p.smsPresets, p.customSms), button('bank-sms', 'Изменить'))
        + checkPermission('smsPermission', true, 'Разрешить чтение SMS'))
      + '<div class="fsl">На экране</div>' + moreList(toggle('Уведомления бота', 'feed', p.feed)
        + toggle('Сообщать, что записал', 'results', p.results)
        + checkPermission('notifyPermission', p.feed || p.results || p.renderLive || p.islandEnabled, 'Разрешить уведомления')
        + (p.islandAvailable ? toggle('Островок поверх приложений', 'island', p.islandEnabled)
          + (p.islandEnabled && !p.islandPermission ? '<div class="more-secure-actions">' + act('overlay', 'Разрешить поверх окон') + '</div>' : '') : '')
        + (p.renderLiveAvailable ? toggle('Рендер в Now Bar', 'renderLive', p.renderLive)
          + (p.renderLive ? '<div class="more-secure-actions">' + act('renderSettings', 'Живые уведомления') + '</div>' : '') : '')
        + toggle('Карты у края экрана', 'edge', p.edge)
        + (p.edgeFix ? '<div class="more-secure-actions">' + act(p.edgeFix, 'Выдать разрешение') + '</div>' : ''))
      + card('retry', 'Обновление', p.update?.text || 'Проверить версию', p.update?.busy ? '' : act(p.update?.found ? 'updateInstall' : 'updateCheck', p.update?.found ? 'Обновить' : 'Проверить'))
      + card('list', 'Журнал телефона', (p.log || []).length + ' записей', button('phone-log', 'Открыть'));
  }
  const pages = {
    look: appearance,
    home: () => moreList(select('Открывать первым', 'startPage', starts, current().startPage || 'today')
      + onOff('Ближайшие события и билеты', 'next', !current().overviewHidden?.includes('next'), 'data-more-overview')),
    notif: () => moreList(times.map(([key, title, fallback]) => entry(title,
      `<input type="time" class="more-setting-control" data-more-setting="${key}" value="${safeTime(current()[key]) ? current()[key] : fallback}">`)).join(''))
      + moreList(notifications.map(([key, title]) => select(title, key, modes, current()[key] || (['notifyShower', 'notifyEnglish'].includes(key) ? 'digest' : 'timed'))).join('')),
    bot: () => moreList(statusRow('bot', 'Telegram', isTelegram() ? 'Подключён' : 'Настройки бота доступны в Telegram')
      + select('Контекст диалога', 'context', [5, 10, 20].map(value => [value, String(value)]), current().context || 10) + calendar()),
    phone: phoneSettings,
    links: () => moreList(statusRow('globe', 'Расширение Chrome', 'Слова и видео для «Английского»', button('browser', 'Подключения'))
      + statusRow('desktop', 'Агент ПК', pc.status(), button('pc', 'Открыть')) + calendar()),
    ai: () => {
      const quota = current().openRouter;
      const left = quota?.left != null && Number.isFinite(Number(quota.left)) ? Number(quota.left) : null;
      return (left == null ? moreEmpty('Баланс OpenRouter недоступен')
        : `<div class="glass stai"><small>Баланс OpenRouter</small><b>${label(new Intl.NumberFormat('ru', {style:'currency',currency:'USD'}).format(left))}</b></div>`)
        + moreList(onOff('Ввод без ИИ', 'manualOnly', current().manualOnly));
    },
    sec: () => moreList(statusRow('face', 'Биометрия', window.SorokaNative?.vaultBiometricState ? 'Доступ к хранилищу на телефоне' : 'Доступна в приложении на телефоне',
      window.SorokaNative?.vaultBiometricState ? button('biometric', 'Настроить') : '')
      + select('Блокировать при бездействии', 'timeout', [1, 5, 15].map(value => [value, value + ' мин']), secure.timeout, 'data-more-security')
      + statusRow('lock', 'Мастер-пароль', 'Для документов и паролей', button('master', 'Сменить'))
      + statusRow('key', 'Пароли', 'Зашифрованное хранилище', button('vault', 'Открыть'))),
    data: () => moreList(statusRow('data', 'Экспорт JSON', 'Записи и настройки Flow', button('export', 'Скачать'))
      + statusRow('folder', 'Импорт настроек', 'Из JSON, экспортированного из Flow', button('import', 'Выбрать'))
      + (hasPending() ? statusRow('retry', 'Незавершённое сохранение', 'Ожидает ответа Flow', button('retry', 'Повторить')) : '')
      + statusRow('retry', 'Данные Flow', 'Загрузить текущий снимок', button('reload', 'Обновить'))),
  };
  R.setp = () => (pages[S.stp] || appearance)();

  function downloadExport() {
    const all = snapshot();
    if (!all) { toast('Данные ещё не загружены'); return; }
    const { vault, searchHistory, settings, ...records } = all;
    const { openRouter, ...preferences } = settings;
    const appearance = Object.fromEntries(appearanceGroups.map(key => [key, sideVal(key)]));
    const contents = JSON.stringify({ format: 'flow-glow', version: 1, records, settings: preferences, appearance }, null, 2);
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const a = document.createElement('a');
    a.download = 'Flow-' + new Date().toISOString().slice(0, 10) + '.json';
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function importPreferences() {
    moreForm('Импорт настроек', '<label class="glass syq"><small>Файл Flow JSON</small><input name="file" type="file" accept="application/json,.json" required></label>', async data => {
      const file = data.get('file');
      if (!file || file.size > 12_000_000) throw Error('Выбери файл Flow JSON до 12 МБ');
      let parsed;
      try { parsed = JSON.parse(await file.text()); } catch { throw Error('Файл не читается как JSON'); }
      if (parsed?.format !== 'flow-glow' || parsed.version !== 1 || !parsed.settings) throw Error('Нужен экспорт из этой версии Flow');
      const source = parsed.settings, patch = {};
      if (starts.some(([key]) => key === source.startPage)) patch.startPage = source.startPage;
      if (densities.some(([key]) => key === source.density)) patch.density = source.density;
      if (typeof source.manualOnly === 'boolean') patch.manualOnly = source.manualOnly;
      if ([5, 10, 20].includes(source.context)) patch.context = source.context;
      for (const [key] of times) if (safeTime(source[key])) patch[key] = source[key];
      for (const [key] of notifications) if (modes.some(([mode]) => mode === source[key])) patch[key] = source[key];
      if (!await write(next => Object.assign(next.settings, patch), 'settings-import')) return false;
      for (const key of appearanceGroups) if (typeof parsed.appearance?.[key] === 'string') applyAppearance(key, parsed.appearance[key]);
      toast('Настройки импортированы');
      return true;
    }, { action: 'Применить настройки' });
  }
  const phoneSet = (key, value) => {
    try { window.SorokaAndroid.phoneSet(key, String(value)); }
    catch { toast('Телефон не подтвердил настройку'); }
  };
  const phoneAction = key => {
    try { window.SorokaAndroid.phoneAction(key); }
    catch { toast('Действие недоступно на телефоне'); }
  };
  function bankSheet(mode) {
    const p = phone();
    if (!p) return;
    const sms = mode === 'sms';
    const presets = sms ? p.smsPresets : p.apps;
    const custom = sms ? (p.customSms || []).map(name => ({ name, id: name }))
      : (p.customApps || []).map(item => ({ name: item.label, id: item.token }));
    const input = sms ? moreInput('Свой отправитель', 'sender', '', 'required maxlength="40"')
      : '<button class="btn glass" type="button" data-bank-apps>Другое приложение</button>';
    const entries = (presets || []).map(item => onOff(item.name, mode + ':' + item.name, item.on, 'data-bank-preset')).join('')
      + custom.map(item => moreRow(ic.wallet, item.name, 'Убрать', `data-bank-remove="${esc2(item.id)}"`)).join('');
    moreForm(sms ? 'SMS от банков' : 'Уведомления от банков', moreList(entries) + input, data => {
      const sender = String(data.get('sender') || '').trim();
      if (!sms) return true;
      if (!sender) throw Error('Введи имя отправителя');
      phoneSet('smsAdd:' + sender, 1);
      return true;
    }, { action: sms ? 'Добавить отправителя' : 'Готово', bind(form) {
      form.onchange = event => { if (event.target.dataset.bankPreset) phoneSet(event.target.dataset.bankPreset, Number(event.target.checked)); };
      form.onclick = event => {
        const row = event.target.closest('[data-bank-remove]');
        if (row) { phoneSet((sms ? 'smsDel:' : 'appDel:') + row.dataset.bankRemove, 1); closeSy(); bankSheet(mode); }
        if (event.target.closest('[data-bank-apps]')) {
          let apps = [];
          try { apps = JSON.parse(window.SorokaAndroid.phoneApps()).all || []; } catch {}
          closeSy();
          openSy(`<div class="syh">Приложения</div><label class="glass syq"><input placeholder="Поиск приложений" aria-label="Поиск приложений"></label><div data-bank-results></div>`, sheet => {
            const query = $('input', sheet), results = $('[data-bank-results]', sheet);
            const update = () => { results.innerHTML = moreList(apps.filter(app => norm(app.label).includes(norm(query.value))).slice(0, 50)
              .map(app => moreRow(sic().phone, app.label, '', `data-bank-add="${esc2(app.pkg)}"`)).join('')); };
            query.oninput = update;
            results.onclick = event => {
              const row = event.target.closest('[data-bank-add]');
              if (row) { phoneSet('appAdd:' + row.dataset.bankAdd, 1); closeSy(); }
            };
            update();
          });
        }
      };
    } });
  }
  function phoneLog() {
    const log = phone()?.log || [];
    openSy(`<div class="syh">Журнал телефона</div>${log.length ? moreList(log.map(row => statusRow('phone', row.s, row.t)).join('')) : moreEmpty('Журнал пуст')}
      ${log.length ? '<button class="btn glass" data-clear-phone-log>Очистить журнал</button>' : ''}`, sheet => {
      const clear = $('[data-clear-phone-log]', sheet);
      if (clear) clear.onclick = () => confirmMore('Очистить журнал?', 'Записи журнала хранятся на телефоне.', 'Очистить', () => { phoneAction('clearLog'); return true; });
    });
  }

  function browserSheet() {
    let session, code, records = [], busy = false;
    openSy('<div class="syh">Расширение Chrome</div><div data-glow-browser></div>', sheet => {
      const box = $('[data-glow-browser]', sheet);
      const active = () => box.isConnected && sheet.classList.contains('on') && !document.hidden && session?.isCurrent();
      async function load() {
        const result = await session.request('browserdevices');
        if (!Array.isArray(result?.items)) throw Error();
        records = result.items.filter(row => !row.revokedAt && (!row.expiresAt || Date.parse(row.expiresAt) > Date.now()));
      }
      const display = () => {
        if (!active()) return;
        box.innerHTML = '<p class="empty">Введи одноразовый код в расширении Chrome.</p>' + (code
          ? moreList(moreRow(sic().copy, code.code, 'Копировать · до ' + new Date(code.expiresAt).toLocaleTimeString('ru', {hour:'2-digit',minute:'2-digit'}), 'data-copy-browser-code')) : '')
          + '<button class="btn glass" data-make-browser-code>Создать код</button>'
          + '<div class="fsl">Подключённые браузеры</div>'
          + (records.length ? moreList(records.map(row => moreRow(sic().globe, row.name, 'Отключить', `data-drop-browser="${esc2(row.id)}"`)).join('')) : moreEmpty('Подключений нет'));
      };
      const start = async () => {
        box.innerHTML = moreEmpty('Загрузка…');
        try {
          session = await getModuleHost('browser');
          if (!active()) return;
          stop?.();
          stop = session.subscribe(() => { if (!session.isCurrent() && box.isConnected) closeSy(); });
          await load();
          display();
        }
        catch { if (box.isConnected) box.innerHTML = moreEmpty('Не удалось получить подключения') + '<button class="btn glass" data-retry-browsers>Повторить</button>'; }
      };
      box.onclick = async event => {
        const control = event.target.closest('button');
        if (!control || busy) return;
        if (control.matches('[data-retry-browsers]')) { await start(); return; }
        if (!active()) return;
        if (control.matches('[data-copy-browser-code]') && Date.parse(code?.expiresAt) > Date.now()) { void copyMore(code.code); return; }
        if (control.matches('[data-make-browser-code]')) {
          control.disabled = busy = true;
          try {
            const answer = await session.request('browserpair');
            if (!/^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2}$/.test(answer?.code || '') || Date.parse(answer.expiresAt) <= Date.now()) throw Error();
            code = answer;
            display();
          } catch { toast('Код подключения не подтверждён'); }
          finally { control.disabled = busy = false; }
        }
        if (control.dataset.dropBrowser) {
          const row = records.find(item => item.id === control.dataset.dropBrowser);
          if (!row) return;
          const host = session;
          closeSy();
          confirmMore('Отключить браузер?', row.name, 'Отключить', async () => {
            const result = await host.request('browserrevoke', { id: row.id });
            if (!host.isCurrent() || result?.ok !== true) throw Error('Отключение не подтверждено');
            closeSy();
            browserSheet();
            return false;
          });
        }
      };
      let stop;
      syOnClose = () => { stop?.(); code = null; $('#syIn').replaceChildren(); syOnClose = null; };
      void start();
    });
  }
  function applyAppearance(key, value) {
    const choice = Array.from($$('#' + key + ' button[data-v]')).find(button => button.dataset.v === value);
    choice?.click();
  }
  bindSetp = screen => {
    bindSyBits(screen, (button, on) => {
      if (button.dataset.stsw === 'snd') applyAppearance('snd', on ? '1' : '0');
    }, (key, value) => { if (appearanceGroups.includes(key)) applyAppearance(key, value); });
    screen.onchange = async event => {
      const input = event.target;
      const { glowPhone, moreSetting, moreOverview, moreSecurity } = input.dataset;
      if (glowPhone) phoneSet(glowPhone, Number(input.checked));
      if (moreSecurity === 'timeout') secure.setTimeoutMinutes(Number(input.value));
      if (moreOverview === 'next') {
        input.disabled = true;
        const ok = await write(next => {
          const hidden = new Set(next.settings.overviewHidden || []);
          if (input.checked) hidden.delete('next'); else hidden.add('next');
          next.settings.overviewHidden = [...hidden];
        }, 'settings:next');
        if (!ok) repaintMore('setp');
      }
      if (!moreSetting) return;
      const value = input.type === 'checkbox' ? input.checked : moreSetting === 'context' ? Number(input.value) : input.value;
      if (input.type === 'time' && !safeTime(value)) { repaintMore('setp'); return; }
      input.disabled = true;
      if (!await settingsChange(moreSetting, value)) repaintMore('setp');
    };
    screen.onclick = event => {
      const control = event.target.closest('[data-more-setting-action], [data-stpal], [data-glow-phone-action]');
      if (!control) return;
      if (control.dataset.stpal) { applyAppearance('pal', control.dataset.stpal); repaintMore('setp'); return; }
      if (control.dataset.glowPhoneAction) { phoneAction(control.dataset.glowPhoneAction); return; }
      const action = control.dataset.moreSettingAction;
      if (['pc', 'vault'].includes(action)) go(action);
      else if (action === 'master') secure.changeMaster();
      else if (action === 'biometric') void secure.configureBiometric();
      else if (action === 'browser') browserSheet();
      else if (action === 'calendar') openSy('<div class="syh">Google Календарь</div><p class="empty">Отправь команду /calendar боту Flow.</p><button class="btn glass" data-copy-calendar>Скопировать /calendar</button>',
        sheet => { $('[data-copy-calendar]', sheet).onclick = () => copyMore('/calendar'); });
      else if (action === 'export') downloadExport();
      else if (action === 'import') importPreferences();
      else if (action === 'retry') {
        control.disabled = true;
        void retryPending().then(ok => { if (ok) toast('Сохранение подтверждено'); })
          .finally(() => { control.disabled = false; repaintMore('setp'); });
      } else if (action === 'reload') {
        control.disabled = true;
        void refresh().then(() => toast('Данные обновлены')).catch(() => toast('Не удалось обновить данные'))
          .finally(() => { control.disabled = false; });
      } else if (action === 'bank-app' || action === 'bank-sms') bankSheet(action.slice(5));
      else if (action === 'phone-log') phoneLog();
    };
  };
  const phoneChanged = window.sorokaPhoneChanged;
  window.sorokaPhoneChanged = () => {
    phoneChanged?.();
    if (curId() === 'setp' && S.stp === 'phone') repaintMore('setp');
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && $('#syIn').querySelector('[data-glow-browser]')) closeSy(); });

  const style = document.createElement('style');
  const practiceVisual = document.documentElement.dataset.glowPractice === 'prototype';
  const practiceScreens = practiceVisual ? ['practice', ...Object.keys(SUBS).filter(id => SUBS[id] === 'practice')] : [];
  const densityScreen = practiceScreens.length
    ? `.screen.on:not(${practiceScreens.map(id => `[data-s="${id}"]`).join(',')})`
    : '.screen.on';
  style.textContent = `
    .glow-hide-near .screen[data-s="plan"] :is(.near,.tix) { display:none; }
    [data-glow-density="compact"] ${densityScreen} :is(.rw,.trow,.arw) { padding-block:8px; }
    [data-glow-density="spacious"] ${densityScreen} :is(.rw,.trow,.arw) { padding-block:15px; }
  `;
  document.head.append(style);
}
