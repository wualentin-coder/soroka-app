/* Fast app commands. Recognition supplies text; the existing section owners execute it. */
(() => {
  'use strict';
  const normalize = text => String(text || '').toLocaleLowerCase('ru').replace(/ё/g, 'е')
    .replace(/[«»"“”.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();
  const routes = new Map();
  function route(page, label, aliases, state = {}, action = null) {
    for (const alias of aliases.split('|')) routes.set(alias, { type: 'navigate', page, label, state, action });
  }
  route('today', 'План', 'план|планы|календарь|календарю|сегодня|главную|главная|обзор');
  route('tasks', 'Задачи', 'задачи|задачам|задания|дела|мои задачи|все задачи');
  route('saved', 'Библиотека', 'библиотека|библиотеку|библиотеке|сохраненное|материалы', { savedCategory: 'overview' });
  route('finance', 'Финансы', 'финансы|финансам|деньги', { financeTab: 'overview', financeCategory: '' });
  for (const [tab, label, aliases] of [
    ['debts', 'Долги', 'долги|долгам|долгов'], ['payments', 'Платежи', 'платежи|платежам'],
    ['transactions', 'Операции', 'операции|операциям|расходы|доходы'],
    ['accounts', 'Счета', 'счета|счетам|мои счета'], ['goals', 'Цели', 'финансовые цели|цели накопления'],
    ['budgets', 'Бюджеты', 'бюджет|бюджеты|лимиты'], ['transfers', 'Переводы', 'переводы'],
    ['rules', 'Правила финансов', 'правила финансов'],
  ]) {
    const names = aliases.split('|');
    route('finance', label, [...names, ...names.map(name => `финансы ${name}`)].join('|'), { financeTab: tab, financeCategory: '' });
  }
  for (const [category, label, aliases] of [
    ['notes', 'Заметки', 'заметки|заметкам'], ['lists', 'Списки', 'списки|спискам|списки покупок'],
    ['movies', 'Фильмы', 'фильмы|фильмам|кино'], ['files', 'Файлы', 'файлы|файлам'],
    ['posts', 'Посты', 'посты'], ['links', 'Ссылки', 'ссылки'], ['recipes', 'Рецепты', 'рецепты|рецептам'],
    ['products', 'Товары', 'товары|покупки'], ['addresses', 'Адреса', 'адреса|адресам|карту|карта'],
    ['tickets', 'Билеты', 'билеты|билетам'], ['cards', 'Карты', 'карты|карты лояльности|скидочные карты'],
    ['birthdays', 'Дни рождения', 'дни рождения'], ['sites', 'Сайты', 'сайты'],
  ]) {
    const names = aliases.split('|');
    route('saved', label, [...names, ...names.map(name => `библиотеку ${name}`), ...names.map(name => `библиотека ${name}`)].join('|'), { savedCategory: category });
  }
  for (const [page, label, aliases] of [
    ['pc', 'Компьютер', 'компьютер|пк|компьютеру'], ['render', 'Рендер', 'рендер|рендеры|очередь рендера|рендер менеджер'],
    ['english', 'Английский', 'английский|английский язык'], ['sport', 'Спорт', 'спорт|тренировки'],
    ['piano', 'Пианино', 'пианино|фортепиано|piano'], ['docs', 'Документы', 'документы|документам|читалку|читалка'],
    ['settings', 'Настройки', 'настройки|настройкам'], ['vault', 'Пароли', 'пароли|хранилище паролей'],
    ['inbox', 'Входящие', 'входящие'], ['projects', 'Проекты', 'проекты'], ['metrics', 'Статистика', 'статистику|статистика|метрики'],
    ['archive', 'Архив', 'архив|корзину|корзина'], ['more', 'Ещё', 'еще|разделы|все разделы'],
    ['vpn', 'VPN', 'vpn|впн|випиэн'], ['server', 'Сервер', 'сервер'],
  ]) route(page, label, aliases);
  for (const [tab, label, aliases] of [
    ['today', 'Сегодня', 'сегодня|урок'], ['words', 'Слова', 'слова|словарь'], ['course', 'Курс', 'курс'],
    ['read', 'Медиатека', 'медиатеку|медиатека|книги'], ['chat', 'Разговор', 'разговор'], ['progress', 'Прогресс', 'прогресс'],
  ]) route('english', `Английский · ${label}`, aliases.split('|').map(name => `английский ${name}`).join('|'), {}, { owner: 'english', tab });
  for (const [tab, label, aliases] of [
    ['today', 'Сегодня', 'сегодня'], ['training', 'Тренировка', 'тренировка|тренировку'],
    ['goals', 'Цели', 'цели'], ['profile', 'Профиль', 'профиль'],
  ]) route('sport', `Спорт · ${label}`, aliases.split('|').map(name => `спорт ${name}`).join('|'), {}, { owner: 'sport', tab });

  // STT commonly writes percentages as words. Only a whole 0..100 value is accepted.
  function percent(text) {
    if (/^\d{1,3}$/.test(text)) return Number(text) <= 100 ? Number(text) : null;
    const ones = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
    const tens = ['двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    if (ones.includes(text)) return ones.indexOf(text);
    if (text === 'сто') return 100;
    const parts = text.split(' '), ten = tens.indexOf(parts[0]);
    if (ten >= 0 && (parts.length === 1 || parts.length === 2 && ones.indexOf(parts[1]) > 0 && ones.indexOf(parts[1]) < 10))
      return (ten + 2) * 10 + (parts.length === 2 ? ones.indexOf(parts[1]) : 0);
    return null;
  }
  function parse(text) {
    const original = String(text || '').trim();
    const value = normalize(original).replace(/^(?:flow|флоу)[ ,]*/, '').replace(/^пожалуйста /, '').replace(/ пожалуйста$/, '');
    if (!value) return null;
    const task = value.match(/^(открой|покажи|заверши|выполни|отметь выполненной|отметь выполненным) (?:задачу|задание) (.+)$/);
    if (task) return { type: 'task', operation: /^(открой|покажи)$/.test(task[1]) ? 'open' : 'complete', query: task[2] };
    if (/^(?:(?:создай|добавь|запиши|поставь) (?:задачу|задание|событие|напоминание) .+|напомни .+)$/.test(value))
      return { type: 'capture', context: 'plan', text: original };
    if (/^(?:включи|разбуди|запусти) (?:пк|компьютер)$/.test(value)) return { type: 'pc', cmd: 'on', label: 'Включаю компьютер' };
    if (/^(?:выключи|усыпи) (?:пк|компьютер)$/.test(value)) return { type: 'power', cmd: value.startsWith('выключи') ? 'off' : 'sleep' };
    if (/^(?:заблокируй (?:пк|компьютер|экран)|переключи (?:музыку|воспроизведение)|следующий трек|предыдущий трек)$/.test(value)) {
      const key = value.startsWith('следующий') ? 'next' : value.startsWith('предыдущий') ? 'prev' : 'play';
      return { type: 'pc', cmd: value.startsWith('заблокируй') ? 'lock' : 'volume', args: value.startsWith('заблокируй') ? {} : { key }, label: 'Команда передана компьютеру' };
    }
    const volume = value.match(/^(?:(?:сделай|поставь|установи|выставь) )?громкость(?: (?:пк|компьютера|на компьютере))? (?:на )?(.+?)(?:\s*(?:%|процентов|процента|процент))?$/);
    if (volume) { const level = percent(volume[1]); if (level !== null) return { type: 'volume', level }; }
    const navigation = value.match(/^(?:открой|покажи|перейди|переключись)(?: (?:в|во|к|на))? (.+)$/);
    if (!navigation) return null;
    const destination = navigation[1].replace(/^мне /, '').replace(/^(?:раздел|страницу|вкладку) /, '')
      .replace(/ и (?:открой|покажи) /g, ' ').replace(/ (?:в |на )?(?:раздел|вкладку|вкладка) /g, ' ')
      .replace(/^финансах /, 'финансы ');
    const found = routes.get(destination);
    return found ? { ...found, state: { ...found.state } } : null;
  }
  function go(page) {
    if (typeof navigate !== 'function' || typeof ui === 'undefined') return false;
    navigate(page);
    return ui.page === page && !ui.sheet;
  }
  function execute(command) {
    if (!command) return { status: 'unhandled' };
    if (command.type === 'navigate') {
      if (!go(command.page)) return { status: 'cancelled', message: 'Переход отменён' };
      const state = { ...(command.page === 'saved' ? { savedSection: '', savedQuery: '', savedFilter: 'all', savedReturn: null, mapPlacing: false } : {}), ...command.state };
      const changed = Object.entries(state).some(([key, value]) => ui[key] !== value);
      Object.assign(ui, state);
      if (command.action?.owner === 'english' && typeof englishAction === 'function') englishAction('en-tab', { dataset: { tab: command.action.tab } });
      else if (command.action?.owner === 'sport' && typeof sportAction === 'function') sportAction('sp-tab', { dataset: { tab: command.action.tab } });
      else if (changed) render();
      return { status: 'done', message: command.label };
    }
    if (command.type === 'task') {
      const matches = (typeof data === 'undefined' ? [] : data.tasks || []).filter(task => !task.deleted && !task.deleted_at && normalize(task.title) === command.query);
      const selected = command.id ? matches.find(task => String(task.id) === String(command.id)) : matches.length === 1 ? matches[0] : null;
      if (!selected) return matches.length ? { status: 'choice', message: 'Есть несколько задач с этим названием. Выберите нужную.', choices: matches.map(task => ({ id: task.id, title: task.title, due: task.due || '', done: Boolean(task.done) })) } : { status: 'not-found', message: 'Задача с таким названием не найдена. Назовите её полностью.' };
      if (!go('tasks')) return { status: 'cancelled', message: 'Действие отменено' };
      if (command.operation === 'open') openEntry('task', selected.due || '', selected.id);
      else if (!selected.done) { toggleTask(selected.id); render(); }
      return { status: 'done', message: command.operation === 'open' ? selected.title : 'Задача выполнена' };
    }
    if (['pc', 'volume', 'power'].includes(command.type)) {
      if (typeof ui === 'undefined') return { status: 'unhandled' };
      if (ui.pc?.pending) return { status: 'busy', message: 'Дождитесь текущей команды компьютера' };
      if (!go('pc')) return { status: 'cancelled', message: 'Действие отменено' };
      ui.pc ||= {};
      if (command.type === 'volume') { pcVolumePreview(command.level); pcQueueVolume(command.level); render(); }
      else if (command.type === 'power') pcAction('pc-power', { dataset: { cmd: command.cmd } });
      else if (command.cmd === 'on') pcSend('on');
      else pcQuick(command.cmd, command.args || {}, 'assistant', () => toast('Команда выполнена'));
      return { status: 'done', message: command.type === 'volume' ? `Громкость: ${command.level}% · команда отправлена` : command.label || 'Выберите время действия' };
    }
    return { status: 'unhandled' };
  }
  window.flowAssistantCommands = { parse, execute };
})();
