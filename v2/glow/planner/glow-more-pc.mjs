import { getModuleHost } from './runtime-session.js';
import { createPreferencesPcProvider } from './preferences-pc-provider.mjs';
import { PC_SITES } from './glow-pc-formats.mjs';
import { renderSnapshot, renderProgress } from './glow-render-owner.mjs';
import { confirmMore, moreEmpty, moreList, moreRow, repaintMore } from './glow-more-ui.mjs';

const fresh = stamp => Number.isFinite(Date.parse(stamp)) && Date.now() - Date.parse(stamp) >= -30_000 && Date.now() - Date.parse(stamp) < 90_000;
export const fraction = (used, total) => Number(total) > 0 && Number.isFinite(Number(used)) ? Number(used) / Number(total) * 100 : null;
export const metric = (id, value, label, color) => typeof value === 'number' && Number.isFinite(value)
  ? gauge('real-' + id, Math.round(Math.max(0, Math.min(100, value))), label, color)
  : `<div class="syrow"><small>${esc2(label)}</small><b>—</b></div>`;
const labels = { screenshot: 'Экран', lock: 'Блокировка', sleep: 'Сон', shutdown: 'Выключить' };
const pcIcons = { screenshot: 'screen', lock: 'lock', sleep: 'moon', shutdown: 'power' };
const sites = [['Кинопоиск', 'Кинопоиск', 'globe'], ['Почта', 'Gmail', 'bell'], ['Музыка', 'Яндекс Музыка', 'vol'],
  ['Диск', 'Google Диск', 'cloud'], ['ВКонтакте', 'ВКонтакте', 'globe']];

export function connectMorePc() {
  let provider, model = null, phase = 'idle', running = false, screenshot = null, stopping = null, timer, powerForm;
  function reset() {
    provider?.dispose();
    provider = model = screenshot = stopping = null;
    phase = 'idle';
    clearTimeout(timer);
    repaintMore('pc');
  }
  function owner() {
    provider ||= createPreferencesPcProvider({
      async getHost() {
        const captured = await getModuleHost('pc');
        const stop = captured.subscribe(() => { if (!captured.isCurrent()) { stop(); reset(); } });
        return captured;
      },
      publish(value) { model = value; },
      onQueued(cmd) {
        if (!['off', 'sleep'].includes(cmd)) return;
        stopping = cmd;
        if (powerForm?.isConnected && $('#sySheet').classList.contains('on')) closeSy();
        repaintMore('pc');
      },
    });
    return provider;
  }
  const online = () => model?.agent === true && model.on !== false && fresh(model.agentSeen || model.statusAt);
  const hub = () => model?.hub === true && fresh(model.hubSeen);
  const status = () => online() ? 'Агент на связи' : !model ? 'Статус неизвестен'
    : model.on === false ? 'Выключен' : 'Агент не отвечает';
  HEAD.pc = () => ['', 'Компьютер'];

  async function refresh({ silent = false } = {}) {
    if (phase === 'loading' || running || document.hidden) return;
    const current = owner();
    phase = 'loading';
    if (!model) repaintMore('pc');
    try { await current.load(); if (provider === current) phase = 'ready'; }
    catch { if (provider === current) phase = 'error'; }
    if (provider !== current) return;
    if (curId() === 'pc') {
      repaintMore('pc');
      if (!silent && phase === 'error' && model) toast('Часть данных компьютера недоступна');
    }
  }
  async function send(action, args = {}, recordId = '', form = null) {
    if (running) throw Error('Дождись текущей команды');
    const current = owner();
    running = true;
    powerForm = form;
    try {
      const answer = await current.intent({ action, args, recordId });
      if (current !== provider || answer?.ok !== true) return false;
      if (action === 'screenshot') {
        const media = answer.image || '';
        screenshot = curId() === 'pc' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(media) ? media : null;
        toast(screenshot ? 'Снимок получен' : 'Компьютер подтвердил снимок. Проверь чат с ботом');
      } else if (['connect', 'sleep', 'shutdown'].includes(action)) {
        toast({ connect: 'Включение подтверждено', sleep: 'Сон подтверждён', shutdown: 'Выключение подтверждено' }[action]);
        clearTimeout(timer);
        timer = setTimeout(() => { if (curId() === 'pc') void refresh({ silent: true }); }, 3000);
      } else if (['lock', 'open-app', 'open-site'].includes(action)) toast('Компьютер подтвердил команду');
      return true;
    } catch (error) {
      if (error?.status === 'cancelled') return false;
      const message = error?.message === 'pc_delivery_unconfirmed' || error?.commandId
        ? 'Ответ от компьютера не подтверждён. Обнови состояние перед повтором.'
        : 'Компьютер не подтвердил действие.';
      if (form && !$('#sySheet').classList.contains('on')) { toast(message); return false; }
      throw Error(message);
    } finally {
      running = false;
      powerForm = null;
      if (['shutdown', 'sleep'].includes(action)) stopping = null;
      if (current === provider) repaintMore('pc');
    }
  }
  const refreshButton = '<button class="btn glass sygo" data-more-pc="refresh">Обновить</button>';
  const pct = value => Number.isFinite(value) ? Math.round(value) + '%' : '—';
  const pRow = item => {
    const details = [item.cpu_percent == null ? '' : 'CPU ' + pct(item.cpu_percent),
      Number.isFinite(item.memory_mb) ? Math.round(item.memory_mb) + ' МБ' : 'Память ' + pct(item.memory_percent)].filter(Boolean).join(' · ');
    return `<div class="rw pcap"><span class="ic">${sic().desktop}</span><span><b>${esc2(item.name || 'Процесс')}</b>
      <small>${esc2(details)}</small></span><button class="btn sm glass" data-pc-kill="${Number(item.pid)}">Закрыть</button></div>`;
  };
  R.pc = () => {
    if (!model) return moreEmpty(phase === 'error' ? 'Компьютер не ответил' : 'Загрузка…') + refreshButton;
    const remote = online();
    const view = renderSnapshot(model);
    const progress = renderProgress(view.active);
    const stamp = model.statusAt ? new Date(model.statusAt).toLocaleTimeString('ru', {hour:'2-digit',minute:'2-digit'}) : '';
    const st = remote ? model.status || {} : {};
    let html = `<div class="glass pchero${remote ? '' : ' off'}"><div class="pcht"><span class="ic pcic" style="--c:${remote ? '#5dff9e' : '#8a8aa0'}">${sic().desktop}</span>
      <span><b>Компьютер</b><small>${esc2([status(), stamp].filter(Boolean).join(' · '))}</small></span></div>
      ${remote ? `<div class="pcacts">${Object.entries(labels).map(([id, title]) => `<button class="pca" data-more-pc="${id}"><span class="ib glass">${sic()[pcIcons[id]]}</span>${title}</button>`).join('')}</div>`
        : hub() && model.on !== true ? `<button class="btn main sygo" data-more-pc="connect">${sic().power}Включить</button>` : ''}
      ${stopping || model.power ? '<div class="more-secure-actions"><p class="empty">' + (model.power?.cmd === 'sleep' || stopping === 'sleep' ? 'Ожидается сон' : 'Ожидается выключение')
        + '</p><button class="btn glass" data-more-pc="cancel-power">Отменить</button></div>' : ''}
      ${screenshot ? '<div class="pcshot open"><div><img alt="Снимок экрана ПК" style="width:100%;border-radius:12px" src="' + screenshot + '"></div></div>' : ''}</div>`;
    if (!remote) return html + refreshButton;
    const audio = model.audio;
    if (audio) html += `<div class="glass pcvol"><button class="ib glass" data-more-pc="mute" aria-label="${audio.muted ? 'Включить звук' : 'Выключить звук'}">${audio.muted ? sic().mute : sic().vol}</button>
      <input type="range" class="prng pcrng" id="morePcVolume" aria-label="Громкость" min="0" max="100" value="${audio.level}" style="--v:${audio.level / 100}"><b id="morePcLevel">${audio.muted ? 'выкл' : pct(audio.level)}</b></div>`;
    html += `<div class="glass syres">${metric('cpu', st.cpu_percent, 'Процессор', '#ffb547')}${metric('ram', st.memory_percent, 'Память', '#a78bff')}
      ${metric('gpu', st.gpu_percent, 'Видеокарта', '#6cb6ff')}</div>`;
    html += `<button class="glass pcrend" data-more-pc="render"><span class="mini" style="--v:${(progress ?? 0) / 100}"><i></i></span>
      <span><b>${progress === null ? 'Рендер' : 'Рендер · ' + pct(progress)}</b><small>${esc2(view.active?.name || 'Очередь Render Manager')}</small></span>${syChev()}</button>`;
    html += '<div class="fsl">Программы</div><button class="btn glass sygo" data-more-pc="processes">Показать процессы</button>';
    if (model.processes) html += model.processes.length ? moreList(model.processes.slice(0, 20).map(pRow).join('')) : moreEmpty('Нет доступных процессов');
    const targets = model.apps || [];
    const targetRows = items => moreList(items.slice(0, 24).map(item =>
      moreRow(sic()[item.kind === 'app' ? 'desktop' : 'folder'], item.name, item.kind === 'app' ? 'Программа' : 'Недавний файл', `data-pc-open="${esc2(item.id)}"`)).join(''));
    if (targets.some(item => item.kind === 'app')) html += '<div class="fsl">Открыть программу</div>' + targetRows(targets.filter(item => item.kind === 'app'));
    html += '<div class="fsl">Сайты на компьютере</div><div class="chips pcsites">' + sites.map(([name, native, icon]) =>
      `<button class="chip pk" data-pc-site="${esc2(native)}">${sic()[icon]}${name}</button>`).join('') + '</div>';
    if (targets.some(item => item.kind === 'file')) html += '<div class="fsl">Недавние файлы</div>' + targetRows(targets.filter(item => item.kind === 'file'));
    return html + refreshButton;
  };
  bindPC = screen => {
    if (phase === 'idle') void refresh({ silent: true });
    const volume = $('#morePcVolume', screen);
    const report = error => toast(error.message);
    if (volume) {
      volume.oninput = () => { volume.style.setProperty('--v', Number(volume.value) / 100); $('#morePcLevel', screen).textContent = volume.value + '%'; };
      volume.onchange = () => { void send('volume', { level: Number(volume.value) }).catch(report); };
    }
    screen.onclick = event => {
      const button = event.target.closest('[data-more-pc], [data-pc-open], [data-pc-kill], [data-pc-site]');
      if (!button) return;
      const { morePc: action, pcOpen, pcKill, pcSite } = button.dataset;
      if (action === 'refresh') { void refresh(); return; }
      if (action === 'render') { go('render'); return; }
      if (pcSite) {
        const site = PC_SITES.find(item => item.name === pcSite);
        if (site) void send('open-site', { url: site.url }).catch(report);
        return;
      }
      if (action === 'cancel-power') {
        button.disabled = true;
        void owner().cancelPower().then(() => {
          stopping = null;
          if (model) model.power = null;
          toast('Отменено');
          repaintMore('pc');
        }).catch(() => toast('Отмена не подтверждена')).finally(() => { button.disabled = false; });
        return;
      }
      if (pcKill) {
        const item = model?.processes?.find(row => String(row.pid) === pcKill);
        if (item) confirmMore('Закрыть процесс?', item.name, 'Закрыть', () => send('process-stop', {}, pcKill));
      } else if (['shutdown', 'sleep', 'lock'].includes(action)) {
        const copy = { shutdown: 'Выключить компьютер?', sleep: 'Перевести компьютер в сон?', lock: 'Заблокировать компьютер?' };
        confirmMore(copy[action], 'Действие выполнится на подключённом ПК.', labels[action], (_data, form) =>
          send(action, {}, '', action === 'lock' ? null : form));
      } else void (pcOpen ? send('open-app', {}, pcOpen) : send(action)).catch(report);
    };
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { screenshot = null; if (curId() === 'pc') repaintMore('pc'); } });
  return { status, refresh, get model() { return model; } };
}
