import { getModuleHost } from './runtime-session.js';
import { fraction, metric } from './glow-more-pc.mjs';
import { confirmMore, copyMore, moreEmpty, moreField, moreForm, moreInput, moreList, moreOptions, moreRow, repaintMore } from './glow-more-ui.mjs';

const clientName = /^[a-z0-9][a-z0-9-]{0,30}$/;
const domain = /^(?:[a-z0-9а-яё](?:[a-z0-9а-яё-]*[a-z0-9а-яё])?\.)+[a-zа-яё]{2,63}$/i;
const number = (value, digits = 0) => Number.isFinite(Number(value)) && value != null
  ? new Intl.NumberFormat('ru', { maximumFractionDigits: digits }).format(value) : '—';
const bytes = value => !Number.isFinite(Number(value)) || value == null ? '—'
  : value < 1e9 ? number(value / 1e6, 1) + ' МБ' : number(value / 1e9, 1) + ' ГБ';
const uptime = value => Number.isFinite(value) ? `${Math.floor(value / 86400)} д ${Math.floor(value % 86400 / 3600)} ч` : '';
const stamp = value => Number.isFinite(value) && value > 0 ? new Date(value * 1000).toLocaleString('ru', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
const details = (icon, title, hint, control = '', ok = null) =>
  `<div class="rw svs" style="--c:${ok === true ? '#5dff9e' : ok === false ? '#ff8a5c' : 'var(--a3)'}">
    <span class="ic">${icon}</span><span><b>${esc2(title)}</b><small>${esc2(hint)}</small></span>${control || '<span></span>'}</div>`;
const button = (action, label, value = '') => `<button class="btn sm glass" data-connect-act="${action}" data-connect-value="${esc2(value)}">${esc2(label)}</button>`;
const periods = [['today', 'Сегодня'], ['week', 'Неделя'], ['month', 'Месяц']];
const serverActions = {
  'restart-functions': ['Перезапустить функции', 'Бот и приложение могут ненадолго отключиться.'],
  'restart-flow': ['Перезапустить Flow', 'Приложение и бот будут недоступны во время перезапуска.'],
  'reload-nginx': ['Перечитать настройки nginx', 'Сервер применит текущую конфигурацию.'],
  'prune-images': ['Очистить образы Docker', 'Неиспользуемые образы будут удалены.'],
  backup: ['Сделать копию сейчас', 'Сервер запустит штатное резервное копирование.'],
};

export function connectMoreConnections() {
  let host, opening, stop, attempt = null;
  const state = { server: null, vpn: null };
  const phase = { server: 'idle', vpn: 'idle' };
  const loading = {};
  let operation = null, period = 'month', serverMetric = 'cpu', lastVpnLinks = null;

  function scrubLinks() {
    if (!lastVpnLinks) return;
    lastVpnLinks = null;
    $('#syIn').replaceChildren();
    closeSy();
  }
  async function hostFor() {
    if (host?.isCurrent()) return host;
    opening ||= getModuleHost('vpn');
    try {
      const captured = await opening;
      if (!captured.isCurrent()) throw Error('owner');
      if (!host) {
        host = captured;
        stop = host.subscribe(() => {
          if (host?.isCurrent()) return;
          stop?.();
          host = attempt = state.server = state.vpn = null;
          phase.server = phase.vpn = 'error';
          scrubLinks();
          if (['server', 'vpn'].includes(curId())) repaintMore(curId());
        });
      }
      return host;
    } finally { opening = null; }
  }
  async function request(op, args = {}) {
    const current = await hostFor();
    const answer = await current.request(op, args);
    if (!current.isCurrent() || !answer || typeof answer !== 'object' || answer.error || answer.ok === false) throw Error('request');
    return answer;
  }
  async function load(page, repaint = true) {
    if (loading[page]) return loading[page];
    phase[page] = 'loading';
    loading[page] = (async () => {
      const reply = await request(page === 'server' ? 'server' : 'summary');
      if (page === 'server' ? !reply.host : !reply.server || !Array.isArray(reply.clients)) throw Error('snapshot');
      state[page] = reply;
      phase[page] = 'ready';
      return reply;
    })();
    try { return await loading[page]; }
    catch { phase[page] = 'error'; return null; }
    finally { delete loading[page]; if (repaint) repaintMore(page); }
  }
  async function command(page, op, args, verify) {
    if (operation) throw Error('Дождись текущего действия');
    const ticket = {};
    operation = ticket;
    let answer;
    try {
      if (!await load(page, false)) throw Error('state');
      answer = await request(op, args);
      if (verify) {
        const fresh = await load(page);
        if (!fresh || !verify(fresh, answer)) throw Error('verify');
      } else if (page === 'server' && op === 'server-action') {
        if (answer.started !== args.op) throw Error('verify');
        toast('Сервер запустил действие');
      }
      return true;
    } catch {
      throw Error(answer ? 'Команда принята. Обнови состояние перед повтором.'
        : 'Сервис не подтвердил действие. Проверь состояние перед повтором.');
    } finally { if (operation === ticket) operation = null; }
  }
  const refresh = '<button class="btn glass sygo" data-connect-act="refresh">Обновить</button>';
  const offline = page => moreEmpty(phase[page] === 'error' ? 'Сервис не ответил' : 'Загрузка…') + refresh;
  const selectors = (items, current, action) => sseg(action, items, current);
  const overview = (icon, title, sub, ok) => `<div class="glass svh"><span class="ic pcic" style="--c:${ok ? '#5dff9e' : '#ff8a5c'}">${icon}</span>
    <span><b>${esc2(title)}</b><small>${esc2(sub)}</small></span>${ok ? '<i class="sydot"></i>' : ''}</div>`;
  const serverStat = title => title === 'cpu' ? 'Процессор' : title === 'mem' ? 'Память' : 'Сеть';
  function points(info) {
    return (info.history || []).slice(-288).map(p => serverMetric === 'cpu' ? p[1]
      : serverMetric === 'mem' ? fraction(p[2], info.host.mem_total) : (Number(p[4]) + Number(p[5])) / 300 / 1e6 * 8)
      .filter(Number.isFinite);
  }
  function serverChart(info) {
    const values = points(info);
    const unit = serverMetric === 'net' ? ' Мбит/с' : '%';
    return `<div class="glass spend"><div class="row"><div><small>За сутки · среднее / пик</small>
      <b>${values.length ? number(values.reduce((sum, value) => sum + value, 0) / values.length, 1) + unit + ' / ' + number(Math.max(...values), 1) + unit : '—'}</b></div></div>
      <div class="row vpr">${selectors(['cpu', 'mem', 'net'].map(key => [key, serverStat(key)]), serverMetric, 'more-srv-chart')}</div>
      ${values.length > 1 ? '<svg viewBox="0 0 358 110" preserveAspectRatio="none" aria-label="График за сутки" id="moreServerChart"></svg>' : '<p class="empty">История пока копится</p>'}</div>`;
  }
  const readings = (id, cpu, mem, storage) => `<div class="glass syres">${metric(id + '-cpu', cpu, 'Процессор', '#ffb547')}
    ${metric(id + '-mem', mem, 'Память', '#a78bff')}${metric(id + '-disk', storage, 'Диск', '#6cb6ff')}</div>`;
  const serverSettingRows = info => {
    const value = info.settings || {};
    const options = (name, values) => moreOptions([...new Set([Number(value[name]), ...values])].filter(Number.isFinite).sort((a, b) => a - b)
      .map(key => [key, name === 'ALERTS' ? key ? 'Включены' : 'Выключены' : number(key)]), Number(value[name]));
    return [
      ['BACKUP_DAYS', 'Хранить копии, дней', [7, 14, 30]],
      ['DISK_ALERT_PCT', 'Свободное место, порог % заполнения', [70, 75, 80, 85, 90, 95]],
      ['MEM_ALERT_MB', 'Свободная память, порог МБ', [100, 200, 300, 500, 750, 1000]],
      ['ALERTS', 'Уведомления в бот', [0, 1]],
    ].map(([key, label, values]) => `<label class="syrow more-setting"><b>${label}</b><select class="more-setting-control" data-server-setting="${key}">${options(key, values)}</select></label>`).join('');
  };
  HEAD.server = () => ['', 'Сервер'];
  R.server = () => {
    const info = state.server;
    if (!info) return offline('server');
    const { host: h, services = {}, containers = [], backups = {}, settings = {}, events = [], db = {}, functions = {} } = info;
    const incidents = [];
    if (services.xray?.active === false) incidents.push('VPN остановлен');
    if (services.nginx?.active === false) incidents.push('nginx остановлен');
    if (!db.ok) incidents.push('Проверь базу данных');
    if (containers.some(item => item.state !== 'running')) incidents.push('Есть остановленные контейнеры');
    if (db.worker_failed || functions.count) incidents.push('Есть ошибки Flow');
    const disk = fraction(h.disk_used, h.disk_total);
    if (disk != null && disk > settings.DISK_ALERT_PCT) incidents.push('Диск почти заполнен');
    if (Number.isFinite(h.mem_total - h.mem_used) && (h.mem_total - h.mem_used) / 1e6 < settings.MEM_ALERT_MB) incidents.push('Мало памяти');
    const heading = phase.server === 'error' ? 'Снимок устарел' : incidents.length ? 'Есть проблемы' : 'Службы в сети';
    const service = (key, title, icon, action) => details(sic()[icon], title, services[key]?.active ? uptime(services[key].uptime_s) || 'Работает' : 'Недоступно', action, services[key]?.active);
    const dbCopy = backups.files?.find(file => file.name?.startsWith('db-'));
    const fileCopy = backups.files?.find(file => !file.name?.startsWith('db-'));
    const copyHint = file => file ? [stamp(file.time), bytes(file.size)].filter(Boolean).join(' · ') : 'Копия не найдена';
    return overview(sic().server, heading, incidents.join(' · ') || [uptime(h.uptime_s), stamp(info.time)].filter(Boolean).join(' · '), !incidents.length && phase.server !== 'error')
      + readings('server', h.cpu, fraction(h.mem_used, h.mem_total), disk) + serverChart(info)
      + '<div class="fsl">Службы</div>' + moreList(
        service('xray', 'VPN', 'shield', button('vpn', 'Открыть')) +
        service('nginx', 'Веб-сервер nginx', 'server', button('server-action', 'Применить', 'reload-nginx')) +
        service('vpnctl', 'Управление сервером', 'gear') +
        containers.map(item => details(sic().fn, item.title || item.name || 'Контейнер',
          [item.state === 'running' ? 'Работает' : 'Остановлен', item.mem ? bytes(item.mem) : ''].filter(Boolean).join(' · '), '', item.state === 'running')).join('')
        + details(sic().db, 'База данных', db.ok ? bytes(db.size) : 'Недоступна', '', db.ok)
        + details(sic().task, 'Фоновые задачи', number(db.worker_ok) + ' выполнено · ' + number(db.worker_failed) + ' ошибок')
        + details(sic().fn, 'Функции Flow', number(functions.count) + ' ошибок за час', button('server-action', 'Перезапуск', 'restart-functions')))
      + '<div class="fsl">Сторож</div>' + (events.length ? moreList(events.slice(0, 8).map(event =>
        details(sic().shield, event.text || 'Событие', stamp(event.time))).join('')) : moreEmpty('Записей в журнале нет'))
      + '<div class="fsl">Резервные копии</div>' + moreList(details(sic().db, 'База данных', copyHint(dbCopy))
        + details(sic().folder, 'Файлы', copyHint(fileCopy))
        + details(sic().cloud, 'Облако Mail.ru', !backups.offsite ? 'Не настроено' : backups.offsite.ok ? number(backups.offsite.files) + ' файлов' : 'Ошибка', '', backups.offsite?.ok)
        + `<div class="svbk"><button class="btn glass" data-connect-act="server-action" data-connect-value="backup"${backups.running ? ' disabled' : ''}>${sic().db}${backups.running ? 'Копия делается…' : 'Сделать копию сейчас'}</button></div>`)
      + '<div class="fsl">Предупреждения</div>' + moreList(serverSettingRows(info))
      + '<div class="more-secure-actions">' + button('server-action', 'Перезапустить Flow', 'restart-flow') + button('server-action', 'Очистить образы Docker', 'prune-images') + '</div>'
      + refresh;
  };
  function renderServerChart(screen) {
    const chart = $('#moreServerChart', screen);
    if (!chart || !state.server) return;
    const values = points(state.server);
    if (Math.max(...values) > 0) curve(chart, values);
    else chart.innerHTML = '<path d="M18 96H340" stroke="var(--a3)" fill="none"/>';
  }

  HEAD.vpn = () => [state.vpn?.server.location || '', 'VPN', 'plus', 'Новый ключ'];
  const exceptList = (title, values) => details(sic().shield, title, values?.join(', ') || 'Пусто');
  R.vpn = () => {
    const info = state.vpn;
    if (!info) return offline('vpn');
    const { server: s, clients, exceptions = {}, traffic = {}, services = {} } = info;
    const total = period === 'today' ? traffic.today_out : period === 'month' ? traffic.month_out : undefined;
    const trafficLabel = total == null && period === 'week' ? 'По сервисам за неделю' : 'Исходящий трафик';
    const totals = (services.items || []).filter(row => Number.isFinite(row[period])).sort((a, b) => b[period] - a[period]);
    const periodBytes = total ?? (period === 'week' && totals.length ? totals.reduce((sum, row) => sum + row[period], 0) : undefined);
    const trafficLimit = period === 'month' && Number(traffic.limit) > 0 ? 'из ' + bytes(traffic.limit) : '';
    const size = bytes(periodBytes);
    const splitAt = size.lastIndexOf(' ');
    return `<div class="plate-w bal crt vph" style="--lvl:.5"><div class="halo"></div><div class="plate"><div class="fill"></div><i class="scan"></i>
      <small class="fnbl rgbt">${esc2([phase.vpn === 'error' ? 'Снимок устарел' : s.xray_active ? 'Работает' : 'VPN остановлен', s.location].filter(Boolean).join(' · '))}</small>
      <div class="sum"><b class="lit">${esc2(splitAt < 0 ? size : size.slice(0, splitAt))}</b><span class="rgbt">${esc2(splitAt < 0 ? '' : size.slice(splitAt + 1))}</span></div>
      <div class="delta rgbt">${esc2([trafficLabel, trafficLimit].filter(Boolean).join(' · '))}</div></div></div>`
      + `<div class="glass spend"><div class="row vpr">${selectors(periods, period, 'more-vpn-period')}</div></div>`
      + '<div class="fsl">Ключи по устройствам</div>'
      + (clients.length ? moreList(clients.map(client => details(sic().phone, client.title || client.name,
        [!client.enabled ? 'Отключён' : client.online ? 'В сети' : stamp(client.last_seen) || 'Не подключался',
          bytes(client.traffic?.[period])].join(' · '), button('key', 'Открыть', client.name), client.enabled)).join('')) : moreEmpty('Ключей пока нет'))
      + '<div class="fsl">Исключения</div>' + moreList(exceptList('Всегда через VPN', exceptions.proxy) + exceptList('Напрямую', exceptions.direct)
        + '<div class="more-secure-actions">' + button('exceptions', 'Изменить исключения') + '</div>')
      + (totals.length ? '<div class="fsl">Трафик по сервисам</div>' + moreList(totals.map(row => details(sic().globe, row.title || row.tag,
        bytes(row[period]) + (row.direct ? ' · Напрямую' : ' · Через VPN'), row.can_route ? button('route', 'Маршрут', row.tag) : '')).join('')) : '')
      + '<div class="fsl">Сервер</div>' + readings('vpn', fraction(s.load, s.cpus), fraction(s.mem_used, s.mem_total), fraction(s.disk_used, s.disk_total))
      + moreList(details(sic().shield, s.domain || 'VPN', [s.xray_version, s.cert_days == null ? '' : 'Сертификат · ' + number(s.cert_days) + ' дн.'].filter(Boolean).join(' · ')))
      + '<div class="more-secure-actions">' + button('restart', 'Перезапустить VPN') + '</div>' + refresh;
  };

  function showLinks(links, sheet) {
    const content = $('[data-vpn-links]', sheet);
    if (!content || !sheet.classList.contains('on')) return;
    lastVpnLinks = links;
    const choices = [['subscription', 'Подписка'], ['main', 'Основной ключ'], ['reserve', 'Резервный ключ']];
    const options = choices.filter(([key]) => typeof links[key] === 'string' && links[key].length > 0 && links[key].length <= 65_536);
    const qr = typeof links.qrImage === 'string' && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(links.qrImage)
      ? links.qrImage : null;
    content.innerHTML = options.length ? moreList(options.map(([key, title]) => moreRow(sic().copy, 'Скопировать · ' + title, '', `data-vpn-copy="${key}"`)).join(''))
      + (qr ? `<img alt="QR-код подписки" width="180" height="180" src="${qr}">` : '') : moreEmpty('Ссылки недоступны');
    content.onclick = event => { const key = event.target.closest('[data-vpn-copy]')?.dataset.vpnCopy; if (key && lastVpnLinks === links) void copyMore(links[key]); };
  }
  function keySheet(name) {
    const client = state.vpn?.clients.find(row => row.name === name);
    if (!client || !clientName.test(name)) return;
    const title = client.title || name;
    openSy(`<div class="syh">${esc2(title)}<small>${client.enabled ? 'Устройство подключено' : 'Ключ отключён'}</small></div>
      <div class="more-secure-actions">${button('links', 'Показать ссылки')}${button('rename', 'Переименовать')}
        ${button(client.enabled ? 'disable' : 'enable', client.enabled ? 'Отключить' : 'Включить')}${button('delete', 'Удалить ключ')}</div><div data-vpn-links></div>`, sheet => {
      $('#syIn').onclick = async event => {
        const button = event.target.closest('[data-connect-act]');
        if (!button || !sheet.classList.contains('on')) return;
        const action = button.dataset.connectAct;
        if (action === 'links') {
          button.disabled = true;
          const box = $('[data-vpn-links]', sheet);
          try {
            const links = await request('links', { name });
            if (curId() === 'vpn' && box.isConnected && !document.hidden) showLinks(links, sheet);
          } catch { if (box.isConnected) box.innerHTML = moreEmpty('Не удалось получить ссылки'); }
          finally { button.disabled = false; }
          return;
        }
        closeSy();
        if (action === 'rename') moreForm('Переименовать ключ', moreInput('Название', 'title', title, 'required maxlength="40"'), data => {
          const next = String(data.get('title')).trim();
          if (!next) throw Error('Введи название');
          return command('vpn', 'rename', { name, title: next }, info => info.clients.some(row => row.name === name && row.title === next));
        });
        else if (['enable', 'disable', 'delete'].includes(action)) {
          const label = { enable: 'Включить', disable: 'Отключить', delete: 'Удалить' }[action];
          confirmMore(label + ' ключ?', title, label, () => command('vpn', action, { name }, info =>
            action === 'delete' ? !info.clients.some(row => row.name === name) : info.clients.some(row => row.name === name && row.enabled === (action === 'enable'))));
        }
      };
      syOnClose = () => { $('#syIn').onclick = null; lastVpnLinks = null; $('#syIn').replaceChildren(); syOnClose = null; };
    });
  }
  function newKey() {
    moreForm('Новый ключ', moreInput('Название устройства', 'title', attempt?.title, 'required maxlength="40"'), async data => {
      const title = String(data.get('title')).trim();
      if (!title) throw Error('Введи название');
      if (operation) throw Error('Дождись текущего действия');
      const active = {};
      operation = active;
      try {
        const latest = await load('vpn');
        if (!latest) throw Error('state');
        if (attempt) {
          const existing = latest.clients.find(row => row.name === attempt.name);
          if (existing) {
            attempt = null;
            toast('Предыдущий ключ уже создан');
            return true;
          }
          if (attempt.title !== title) throw Error('previous');
        }
        attempt ||= { name: 'flow-' + crypto.randomUUID().replaceAll('-', '').slice(0, 22), title };
        await request('create', attempt);
        const confirmed = await load('vpn');
        if (!confirmed?.clients.some(row => row.name === attempt.name)) throw Error('ack');
        attempt = null;
        toast('Ключ создан');
        return true;
      } catch { throw Error('Создание не подтверждено. Повтор с тем же названием проверит предыдущий ключ.'); }
      finally { if (operation === active) operation = null; }
    }, { action: 'Создать' });
  }
  function exceptionForm() {
    const base = state.vpn?.exceptions;
    if (!base) return;
    moreForm('Исключения VPN', [['proxy', 'Всегда через VPN'], ['direct', 'Напрямую']].map(([key, label]) =>
      moreField(label, `<textarea name="${key}" rows="4" placeholder="Один домен на строку">${esc2((base[key] || []).join('\n'))}</textarea>`)).join(''), async data => {
      const split = key => [...new Set(String(data.get(key)).toLowerCase().split(/[\s,]+/).filter(Boolean))];
      const direct = split('direct'), proxy = split('proxy');
      if ([direct, proxy].some(rows => rows.length > 200 || rows.some(value => value.length > 253 || !domain.test(value)))) throw Error('Введи домены без протокола и пути');
      if (direct.some(value => proxy.includes(value))) throw Error('Укажи для каждого домена один маршрут');
      return command('vpn', 'exceptions', { direct, proxy }, current => ['direct', 'proxy'].every(key => {
        const desired = key === 'direct' ? direct : proxy;
        const saved = current.exceptions?.[key] || [];
        return saved.length === desired.length && desired.every(value => saved.includes(value));
      }));
    });
  }
  const report = error => toast(error.message);
  function bind(page, screen) {
    if (phase[page] === 'idle') void load(page);
    if (page === 'server') renderServerChart(screen);
    bindSyBits(screen, () => {}, (key, value) => {
      if (key === 'more-srv-chart') serverMetric = value;
      else if (key === 'more-vpn-period') period = value;
      repaintMore(page);
    });
    screen.onchange = event => {
      const input = event.target;
      const key = input.dataset.serverSetting;
      if (key) void command('server', 'server-settings', { [key]: Number(input.value) },
        fresh => Number(fresh.settings?.[key]) === Number(input.value)).catch(report);
    };
    screen.onclick = event => {
      const control = event.target.closest('[data-connect-act]');
      if (!control) return;
      const { connectAct: action, connectValue: value } = control.dataset;
      if (action === 'refresh') return void load(page);
      if (action === 'vpn') return go('vpn');
      if (action === 'key') return keySheet(value);
      if (action === 'exceptions') return exceptionForm();
      if (action === 'server-action') {
        const meta = serverActions[value];
        if (meta) confirmMore(meta[0] + '?', meta[1], meta[0], () => command('server', 'server-action', { op: value }));
      } else if (action === 'restart') {
        confirmMore('Перезапустить VPN?', 'Подключения ненадолго прервутся.', 'Перезапустить', () => command('vpn', 'restart', {},
          current => current.server?.xray_active === true));
      } else if (action === 'route') {
        const item = state.vpn?.services?.items?.find(row => row.tag === value);
        if (!item?.can_route || !/^s-[a-z]{2,20}$/.test(value)) return;
        const direct = !item.direct;
        confirmMore('Изменить маршрут?', item.title + (direct ? ' → напрямую' : ' → через VPN'), 'Изменить', () =>
          command('vpn', 'service-route', { tag: value, direct }, current => current.services?.items?.some(row => row.tag === value && !!row.direct === direct)));
      }
    };
  }
  bindServer = screen => bind('server', screen);
  bindVPN = screen => bind('vpn', screen);
  openNewKey = newKey;
  const previousSwap = swap;
  swap = (from, to, direction) => {
    if (from === 'vpn' && to !== 'vpn' && $('#syIn').querySelector('[data-vpn-links]')) closeSy();
    return previousSwap(from, to, direction);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && $('#syIn').querySelector('[data-vpn-links]')) closeSy();
  });
  return { status(page) {
    return !state[page] || phase[page] === 'error' ? 'Статус неизвестен' : page === 'server' ? 'Открыть мониторинг'
      : state.vpn.clients.filter(row => row.enabled).length + ' активных ключей';
  } };
}
