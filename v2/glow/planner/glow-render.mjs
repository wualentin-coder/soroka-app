import { getModuleHost } from './runtime-session.js';
import { createGlowRenderOwner, renderProgress, renderSnapshot } from './glow-render-owner.mjs';
import { makeRenderWizard } from './glow-render-wizard.mjs';

const styles = document.createElement('style');
styles.textContent = `
  #jobW :is(.rjp,.rjbar)[hidden], #pRead[hidden], .rw .mini[hidden] { display: none }
  #jobW .rjp:empty, #jobW .rjmid:has(.rjp[hidden]) .rjf:empty { display: none }
  #jobW .rjmid:has(.rjp[hidden]) { margin-top: 0 }
  .rdr .glow-rd-toggle { min-width: 0; align-self: stretch; text-align: left; color: inherit; background: none }
  .rdr .glow-rd-toggle :is(b,small), .nwhead .syh { overflow-wrap: anywhere }
  .rdr .glow-rd-toggle :is(b,small) { display: block }
  .rdr .glow-rd-toggle small { color: var(--muted); font-size: 12px }
  #islX .islxb [data-render-action] { font-size: 0; gap: 0 }
  .screen[data-s="render"] .rspv { flex-wrap: wrap }
  .nw-warning { padding: 10px 14px; margin-top: 10px }
  .nw-warning p { margin: 8px 0 }
  #nwFrames { width: 100% }
`;
document.head.append(styles);

const section = () => $('.screen[data-s="render"]');
const originalMore = R.more;
const originalIslandState = islState;
const originalIslandCompact = islCompact;
const originalIslandExpanded = islExpanded;
const originalIslandSync = islSync;
const originalIslandPanel = islPanel;
const tabs = ['queue', 'done', 'speed'];
const quiet = renderSnapshot(null);
const bodyMarkup = new WeakMap();
let owner, readError = false, pending = false;
let lastRead = -Infinity;
let armed = null;
let armTimeout;

// The original interval captured the demo function at startup. A zero total makes it inert.
RJ.total = 0;
RQ.length = RDONE.length = 0;
const view = () => owner?.current() || quiet;
const look = job => job?.app === 'ae' ? 'After Effects' : job?.app === 'karma' ? 'Houdini · Karma' : '';
const basename = path => String(path || '').split(/[\\/]/).pop();
const empty = label => '<div class="glass empty">' + esc2(label) + '</div>';
const stageLabel = job => String(job?.stage_label || job?.stage || '');
const percent = ctx => ctx.ready || !ctx.managed ? renderProgress(ctx.active) : null;
const fmtSeconds = value => Number(value) > 0 ? (value < 90 ? fmt(Math.max(1, Math.round(value))) + ' с' : rmMinutesLocal(value)) : '';
const rmMinutesLocal = value => value >= 3600 ? Math.floor(value / 3600) + ' ч ' + Math.floor(value % 3600 / 60) + ' мин' : Math.ceil(value / 60) + ' мин';
const mediaText = job => [look(job), job?.parallel > 1 ? job.parallel + ' части' : '', job?.ae_resolution === 'half' ? '½' : job?.ae_resolution === 'quarter' ? '¼' : ''].filter(Boolean).join(' · ');

function connection(ctx) {
  if (readError) return 'Не удалось обновить состояние';
  if (!ctx.state) return 'Связываюсь с компьютером…';
  if (ctx.state.on === false) return 'Компьютер выключен';
  if (!ctx.online) return 'Компьютер не на связи';
  if (ctx.q.service?.available === false) return 'Render Manager не отвечает';
  if (!ctx.known) return 'Нет свежих данных';
  return '';
}

function progressText(ctx) {
  const job = ctx.active;
  if (!job || ctx.managed && !ctx.ready) return '';
  if (job.status === 'delivering') {
    const { files, total } = job.delivery || {};
    return total > 0 ? 'Файлы ' + (files ?? 0) + ' / ' + total : 'Доставка';
  }
  if (job.patch_of || job.patch_frames) {
    const part = String(job.span || job.patch_frames || '').replace(/-/g, '–');
    return [part && part !== 'markers' ? 'Участок ' + part : '', job.span_total > 0 && job.stage_code === 'render'
      ? (job.span_done ?? 0) + ' / ' + job.span_total + ' кадров' : ''].filter(Boolean).join(' · ');
  }
  return job.total > 0 && job.done != null ? 'Кадры ' + job.done + ' / ' + job.total : '';
}

function activeTitle(ctx) {
  return ctx.active?.name || (ctx.held ? 'Очередь на паузе' : ctx.waiting.length ? 'В ожидании' : ctx.state ? 'Активных задач нет' : 'Рендер');
}

function activeStatus(ctx) {
  const job = ctx.active;
  return connection(ctx) || (job?.status === 'paused' ? 'На паузе' : '')
    || (job && percent(ctx) !== null && job.status === 'rendering' && job.eta > 0 ? '≈ ' + fmtSeconds(job.eta) : '')
    || stageLabel(job) || (job?.status === 'delivering' ? 'Доставка' : job ? 'Рендер' : '');
}

const button = (action, label, icon = '', id, enabled = true) =>
  '<button type="button" class="btn sm glass" data-render-action="' + action + '"' + (id ? ' data-job="' + id + '"' : '')
  + (enabled ? '' : ' disabled') + '>' + icon + esc2(label) + '</button>';

function activeMarkup() {
  return '<div class="glass rjg" id="jobW"><div class="rjtop"><span><b id="rjT"></b><small id="rjScene"></small></span>'
    + '<span class="rjeta" id="rjS"></span></div><div class="rjmid"><span class="rjp"><b id="pct"></b><sup>%</sup></span>'
    + '<span class="rjf" id="frm"></span></div><div class="rjbar" role="progressbar" aria-label="Прогресс рендера"><i></i></div></div>';
}

function setText(root, selector, value) {
  const node = $(selector, root);
  if (node && node.textContent !== value) node.textContent = value;
}

function paintProgress(el, ctx) {
  const card = $('#jobW', el);
  if (!card) return;
  const job = ctx.active;
  const pct = percent(ctx);
  setText(card, '#rjT', activeTitle(ctx));
  setText(card, '#rjScene', [basename(job?.scene), mediaText(job)].filter(Boolean).join(' · '));
  setText(card, '#rjS', activeStatus(ctx));
  setText(card, '#frm', progressText(ctx));
  setText(card, '#pct', pct === null ? '' : String(Math.round(pct)));
  $('.rjp', card).hidden = pct === null;
  const bar = $('.rjbar', card);
  bar.hidden = !job || ctx.managed && !ctx.ready;
  if (pct === null) bar.removeAttribute('aria-valuenow');
  else bar.setAttribute('aria-valuenow', Math.round(pct));
  card.style.setProperty('--lvl', (pct ?? 0) / 100);
}

function queueBody(ctx) {
  const { active: job, waiting, held, ready, managed } = ctx;
  const stage = job?.status === 'delivering' ? 3 : /провер/i.test(stageLabel(job)) ? 2 : /склей|кодир|сборк/i.test(stageLabel(job)) ? 1 : 0;
  const steps = job ? '<div class="glass rqst"><div class="rqsteps" style="--s:' + stage + '">' + STAGES.map((name, i) =>
    '<span class="' + (i < stage ? 'ok' : i === stage ? 'cur' : '') + '"><i></i>' + name + '</span>').join('')
    + '</div><small class="rqinfo">' + esc2(mediaText(job)) + '</small></div>' : '';
  const controls = '<div class="rqctl">' + button('hold', held ? 'Продолжить очередь' : 'Пауза очереди', held ? sic().play : sic().pause, null, ready && (!!job || waiting.length > 0 || held))
    + (managed ? button('cancel', armed === job.id ? 'Точно отменить?' : 'Отменить', sic().x, job.id, ready) : '') + '</div>';
  const jobPause = managed && ['paused', 'rendering'].includes(job.status)
    ? '<div class="rqctl">' + button(job.status === 'paused' ? 'resume' : 'pause', job.status === 'paused' ? 'Продолжить задачу' : 'Пауза задачи',
      job.status === 'paused' ? sic().play : sic().pause, job.id, ready) + '</div>' : '';
  const rows = waiting.map((item, i) => '<div class="rw rqr" data-rq="' + item.id + '" style="--c:' + (item.app === 'ae' ? '#9b7bff' : '#ff8a3d') + '">'
    + '<span class="ic"><b>' + (item.app === 'ae' ? 'Ae' : 'K') + '</b></span><span><b' + (item.output ? ' title="' + esc2(item.output) + '"' : '')
    + '>' + esc2(item.name) + '</b><small>'
    + esc2([mediaText(item), item.frames ? 'Кадры ' + item.frames : '', item.status === 'paused' ? 'На паузе' : ''].filter(Boolean).join(' · '))
    + '</small></span><span class="rqa"><button type="button" class="ib" data-render-action="move" data-job="' + item.id
    + '" aria-label="Выше"' + (!ready || i === 0 ? ' disabled' : '') + '>' + sic().up
    + '</button><button type="button" class="ib" data-render-action="cancel" data-job="' + item.id + '" aria-label="Убрать"'
    + (ready ? '' : ' disabled') + '>' + sic().x + '</button></span></div>').join('');
  return steps + controls + jobPause + (held ? '<div class="rqnote">Текущий рендер доработает, следующие ждут</div>' : '')
    + '<div class="fsl">В очереди<span> · ' + waiting.length + '</span></div><div class="glass list" id="rqList">'
    + (rows || '<div class="empty">Сейчас в очереди ничего нет</div>') + '</div>';
}

function range(job) {
  const frames = String(job?.frames || '').match(/^(\d+)(?:-(\d+))?$/);
  if (!frames) return null;
  const first = Number(frames[1]), last = Number(frames[2] ?? first);
  return Number.isSafeInteger(first) && Number.isSafeInteger(last) && first <= last ? [first, last] : null;
}

const patchable = job => job.app === 'ae' && job.status === 'done' && range(job)
  && !/Output Module сохраняется/.test(String(job.warning || ''));

function compareMarkup(job) {
  const data = job.compare;
  if (!data) return '';
  if (data.status === 'running') return '<div class="rdcw"><i class="syspin"></i>Сравниваю с прошлой версией…</div>';
  if (data.status === 'failed') return '<div class="rdcr"><b>Сравнение не удалось</b><small>' + esc2(data.error || '') + '</small></div>';
  if (data.changed == null) return '';
  return '<div class="rdcr"><b>Изменено кадров: ' + esc2(data.changed) + '</b><small>'
    + esc2([data.outside > 0 ? 'Вне участка: ' + data.outside : '', data.seams_bad > 0 ? 'Проверьте стыки: ' + data.seams_bad : '',
      data.outside === 0 && data.seams_bad === 0 ? 'Стыки в порядке' : ''].filter(Boolean).join(' · ')) + '</small></div>';
}

function doneBody(ctx) {
  const groups = new Map();
  for (const job of ctx.history) {
    const project = basename(job.scene).replace(/\.(aep|hiplc|hipnc|hip)$/i, '') || 'Без проекта';
    if (!groups.has(project)) groups.set(project, []);
    groups.get(project).push(job);
  }
  const row = job => {
    const problem = job.status === 'failed';
    const done = job.status === 'done';
    const ver = basename(job.output).match(/(?:^|[_ .-])v(\d+)(?=[_ .-]|$)/i)?.[1];
    const details = [problem ? job.error || 'Ошибка рендера' : job.status === 'cancelled' ? 'Отменено' : mediaText(job),
      job.missing ? 'Пропущены кадры: ' + job.missing : '',
      job.finished_at > 0 ? new Date(job.finished_at * 1000).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : ''].filter(Boolean);
    const cloud = job.delivery?.status === 'done';
    return '<div class="rw rdr' + (S.rdone === job.id ? ' open' : '') + (problem ? ' err' : '') + '" data-rd="' + job.id + '">'
      + '<span class="ic">' + (problem ? sic().retry : sic().film) + '</span><button type="button" class="glow-rd-toggle" data-render-action="details" data-job="'
      + job.id + '" aria-expanded="' + (S.rdone === job.id) + '"><b>' + esc2(job.name) + (ver ? ' <em class="rqtag">v' + ver + '</em>' : '')
      + '</b><small>' + esc2(details.join(' · ')) + '</small></button>' + (cloud ? '<span class="rdc" title="В облаке">' + sic().cloud + '</span>' : '<span></span>')
      + '<div class="rdx"' + (S.rdone === job.id ? '' : ' inert') + '><div><div class="rdi">' + compareMarkup(job) + '<div class="rdacts">'
      + (problem || job.status === 'cancelled' || job.missing > 0 ? button('retry', job.missing > 0 ? 'Дорендерить кадры' : 'Повторить', sic().retry, job.id, ctx.ready) : '')
      + (patchable(job) ? button('patch', 'Перерендер участка', sic().cut, job.id, ctx.ready) : '')
      + (done ? button('compare', 'Сравнить', sic().cmp, job.id, ctx.ready && job.compare?.status !== 'running')
        + button('reveal', 'Папка на ПК', sic().folder, job.id, ctx.ready)
        + (job.delivery?.status === 'failed' ? button('deliver', 'Повторить доставку', sic().cloud, job.id, ctx.ready) : '') : '')
      + (job.started_at > 0 ? button('link', 'Живой статус', sic().link, job.id) : '')
      + '</div></div></div></div></div>';
  };
  return groups.size ? '<div id="rdList">' + Array.from(groups, ([project, jobs]) => '<div class="fsl rdp">' + esc2(project)
    + '<span> · ' + jobs.length + '</span></div><div class="glass list">' + jobs.map(row).join('') + '</div>').join('') + '</div>' : empty('Готовых задач пока нет');
}

const frameStats = ctx => (ctx.active?.frame_stats?.points?.length ? ctx.active : ctx.history.find(job => job.frame_stats?.points?.length));
function drawSpeed(ctx, el) {
  const svg = $('#rfC', el);
  const points = frameStats(ctx)?.frame_stats?.points;
  const values = (points || []).map(point => Number(Array.isArray(point) ? point[1] : point.seconds)).filter(value => value > 0 && Number.isFinite(value));
  if (svg && values.length) curve(svg, values.length === 1 ? [values[0], values[0]] : values);
}

function speedBody(ctx) {
  const tests = ctx.jobs.filter(job => job.benchmark?.mode === 'parts')
    .sort((a, b) => Number(b.id) - Number(a.id));
  const group = tests[0]?.benchmark?.group;
  const results = group ? tests.filter(job => job.benchmark.group === group) : tests.slice(0, 8);
  const times = [1, 2, 3, 4].map(parts => {
    const samples = results.filter(job => Number(job.parallel) === parts);
    const seconds = samples.map(job => Number(job.benchmark_result?.seconds_per_frame))
      .filter(value => value > 0 && Number.isFinite(value));
    return { parts, value: seconds.length ? seconds.reduce((a, b) => a + b, 0) / seconds.length : null };
  });
  const speedRows = results.length ? times.map(({parts, value}) => '<span><b>' + (value == null ? '—' : fmt(Number(value.toFixed(2))))
    + '</b>' + (value == null ? '' : ' с/кадр') + '<small>' + parts + ' ' + fnPl(parts, 'часть', 'части', 'частей') + '</small></span>').join('')
    : '<small>Результатов пока нет</small>';
  const stats = frameStats(ctx);
  const slow = stats?.frame_stats?.slowest || [];
  const diag = [
    ['desktop', 'Агент ПК', ctx.online ? 'На связи' : 'Нет связи', ctx.online],
    ['film', 'Расширение AE', ctx.q.service?.ae_agent?.alive === true ? 'На связи' : 'Нет свежих данных', ctx.q.service?.ae_agent?.alive === true],
    ['server', 'Render Manager', ctx.ready ? 'На связи' : 'Нет свежих данных', ctx.ready],
  ];
  return '<div class="glass rsp"><div class="rsph"><div><small>Тест скорости ПК</small><div class="rspv">'
    + speedRows
    + '</div></div></div>' + button('benchmark', 'Общий тест скорости', sic().speed, null, ctx.canReadScene) + '</div>'
    + (stats ? '<div class="glass spend rfr"><div class="row"><div><small>Кадры · секунды</small><b>' + esc2(stats.name)
      + '</b></div></div><svg viewBox="0 0 358 110" preserveAspectRatio="none" id="rfC"></svg></div>' : '')
    + (slow.length ? '<div class="fsl">Самые долгие кадры</div><div class="glass list">' + slow.map(({ frame, seconds }) =>
      '<div class="rw"><span class="ic">!</span><span><b>Кадр ' + esc2(frame) + '</b><small>' + fmt(Number(Number(seconds).toFixed(2))) + ' с</small></span></div>').join('') + '</div>' : '')
    + '<div class="fsl">Связь и диагностика</div><div class="glass list">' + diag.map(([icon, title, text, up]) => '<div class="rw" style="--c:'
      + (up ? '#5dff9e' : 'var(--faint)') + '"><span class="ic">' + sic()[icon] + '</span><span><b>' + title
      + '</b><small>' + text + '</small></span><i class="sydot"></i></div>').join('') + '</div>';
}

function body(ctx) {
  if (!ctx.state) return empty(connection(ctx)) + (readError ? button('refresh', 'Повторить') : '');
  return ({queue: queueBody, done: doneBody, speed: speedBody})[S.rt](ctx);
}

function refreshBody(el, ctx, animate = false) {
  const box = $('#rBody', el);
  const markup = body(ctx);
  if (!box || bodyMarkup.get(box) === markup && S.rt !== 'speed') return;
  if (bodyMarkup.get(box) !== markup) {
    const focused = document.activeElement;
    const key = box.contains(focused) ? [focused.dataset.renderAction, focused.dataset.job || ''] : null;
    box.innerHTML = markup;
    bodyMarkup.set(box, markup);
    if (key) $$('[data-render-action]', box).find(node => node.dataset.renderAction === key[0]
      && (node.dataset.job || '') === key[1] && !node.disabled)?.focus({ preventScroll: true });
    if (animate && !reduce) {
      stagger(box);
      box.animate([{ opacity: .35, transform: 'translateX(18px)' }, { opacity: 1, transform: 'none' }],
        { duration: 380, easing: 'cubic-bezier(.19,1,.22,1)' });
    }
  }
  if (S.rt === 'speed') {
    const chart = $('#rfC', box);
    const key = JSON.stringify(frameStats(ctx)?.frame_stats?.points || []);
    if (chart && chart.dataset.points !== key) { drawSpeed(ctx, box); chart.dataset.points = key; }
  }
}

R.render = () => '<div class="srow wsrow hsrow">' + capsHTML(RTAB, S.rt, 'data-rt', sic()) + '</div>' + activeMarkup() + '<div id="rBody"></div>';
function moreRow(ctx, row) {
  const pct = percent(ctx);
  setText(row, 'small', ctx.active && (!ctx.managed || ctx.ready) ? ctx.active.name : connection(ctx)
    || (ctx.waiting.length ? 'В очереди: ' + ctx.waiting.length : 'Очередь пуста'));
  const bar = $('.mini', row);
  bar.hidden = pct === null;
  if (pct !== null) bar.style.setProperty('--v', pct / 100);
  setText(row, '.live', pct === null ? '' : Math.round(pct) + '%');
}
R.more = () => {
  const fragment = document.createElement('template');
  fragment.innerHTML = originalMore();
  moreRow(view(), $('[data-go="render"]', fragment.content));
  return fragment.innerHTML;
};

function update() {
  const ctx = view();
  const el = section();
  if (curId() === 'render') { paintProgress(el, ctx); refreshBody(el, ctx); }
  if (curId() === 'more') {
    const row = $('.screen[data-s="more"] [data-go="render"]');
    if (row) moreRow(ctx, row);
  }
  islSync();
}

async function refresh(force = false) {
  if (!owner || document.hidden || !force && (pending || performance.now() - lastRead < 3500)) return;
  lastRead = performance.now();
  try {
    await owner.read({ renew: force });
    readError = false;
  } catch {
    readError = true;
  }
  update();
}

export function connectRender() {
  if (owner?.current()) return;
  owner = createGlowRenderOwner(() => getModuleHost('pc'), { publish: value => { if (value) readError = false; update(); } });
  void refresh();
}
islState = () => {
  const state = originalIslandState();
  const ctx = view();
  return state === 'idle' && ctx.active && (ctx.ready || !ctx.managed) ? 'render' : state;
};
const compactValue = ctx => percent(ctx) === null ? 'Рендер' : Math.round(percent(ctx)) + '%';
islCompact = state => state === 'render' ? '<span class="islic" id="islRing">' + islRing(percent(view()) ?? 0)
  + '</span><b class="isln" data-glow-render-percent>' + compactValue(view()) + '</b>' : originalIslandCompact(state);
islExpanded = state => {
  if (state !== 'render') return originalIslandExpanded(state);
  const ctx = view(), pct = percent(ctx);
  return '<div class="islx"><span class="islbig">' + islRing(pct ?? 0) + '</span><span class="islxt"><b>' + esc2(activeTitle(ctx))
    + '</b><small data-render-island-facts>' + esc2(progressText(ctx) || activeStatus(ctx)) + '</small></span><span class="islxb">'
    + (ctx.managed ? button('hold', ctx.held ? 'Продолжить очередь' : 'Пауза очереди', ctx.held ? sic().play : sic().pause, null, ctx.ready) : '')
    + '<button type="button" data-isl="render" aria-label="Открыть рендер">' + ic.chev + '</button></span></div>';
};
islSync = () => {
  // Keep the original state priorities and update only the fields it used to fill from the demo.
  const ctx = view();
  RJ.pct = Math.round(percent(ctx) || 0);
  originalIslandSync();
  if (ISL.st !== 'render') return;
  setText(document, '[data-glow-render-percent]', compactValue(ctx));
  setText(document, '#islX .islxt b', activeTitle(ctx));
  setText(document, '[data-render-island-facts]', progressText(ctx) || activeStatus(ctx));
  const hold = $('#islX [data-render-action="hold"]');
  if (hold && hold.dataset.held !== String(ctx.held)) {
    hold.dataset.held = String(ctx.held);
    hold.innerHTML = ctx.held ? sic().play : sic().pause;
    hold.setAttribute('aria-label', ctx.held ? 'Продолжить очередь' : 'Пауза очереди');
  }
};
islPanel = () => {
  const panel = document.createElement('template');
  panel.innerHTML = originalIslandPanel();
  $$('button[data-isl="plan"]', panel.content).find(node => node.textContent.includes('Рендер титров'))?.remove();
  return panel.innerHTML;
};
$('#isl').addEventListener('click', event => {
  const control = event.target.closest('[data-render-action="hold"]');
  if (!control) return;
  event.stopImmediatePropagation();
  void act(control);
}, true);
islSync();
setInterval(() => {
  if (!document.hidden && (['more', 'render'].includes(curId()) || view().active || performance.now() - lastRead > 30000)) void refresh();
}, 4500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });

const wizard = makeRenderWizard(view, perform);
openNewRender = () => wizard.open();
bindRender = el => {
  const ctx = view();
  paintProgress(el, ctx);
  refreshBody(el, ctx);
  bindCaps(el, 'data-rt', key => {
    if (tabs.includes(key)) { S.rt = key; refreshBody(el, view(), true); }
  });
  el.onclick = event => {
    const control = event.target.closest('[data-render-action]');
    if (control) void act(control);
  };
  if (!ctx.state || performance.now() - lastRead > 4500) void refresh();
};

async function perform(cmd, args, control, accept, message) {
  if (!owner || pending) return false;
  pending = true;
  if (control) control.disabled = true;
  try {
    const result = await owner.command(cmd, args);
    await accept?.(result);
    if (message !== false) toast(esc2(result.message || message || 'Готово'));
    if (!['rm_markers', 'rm_targets', 'rm_reveal'].includes(cmd)) await refresh(true);
    return true;
  } catch (error) {
    toast(esc2(error.message || 'Компьютер не ответил'));
    return false;
  } finally {
    pending = false;
    if (control?.isConnected) control.disabled = false;
  }
}

async function act(control) {
  if (control.disabled) return;
  const { renderAction: action } = control.dataset;
  const ctx = view();
  const id = Number(control.dataset.job);
  const job = ctx.jobs.find(item => item.id === id);
  if (action === 'refresh') { await refresh(true); return; }
  if (action === 'details' && job) {
    S.rdone = S.rdone === id ? null : id;
    $$('[data-rd]', section()).forEach(row => {
      const open = Number(row.dataset.rd) === S.rdone;
      row.classList.toggle('open', open);
      $('.rdx', row).inert = !open;
      $('button[data-render-action="details"]', row).setAttribute('aria-expanded', open);
    });
    const box = $('#rBody', section());
    if (box) bodyMarkup.set(box, body(ctx));
    return;
  }
  if (action === 'benchmark') { wizard.open(true); return; }
  if (action === 'hold') { await perform('rm_hold', { on: !ctx.held }, control); return; }
  if (!job) return;
  if (action === 'patch' && patchable(job)) { patchSheet(job); return; }
  if (action === 'link') { await share(job, control); return; }
  if (action === 'cancel') {
    if (ctx.active?.id === id && armed !== id) {
      armed = id;
      refreshBody(section(), ctx);
      clearTimeout(armTimeout);
      armTimeout = setTimeout(() => { armed = null; update(); }, 2800);
      return;
    }
    clearTimeout(armTimeout); armed = null;
    await perform('rm_cancel', { id }, control);
  } else if (action === 'move') {
    const index = ctx.waiting.findIndex(j => j.id === id);
    if (index > 0) {
      const nativeIndex = ctx.jobs.filter(j => ['queued', 'paused'].includes(j.status)).findIndex(j => j.id === ctx.waiting[index - 1].id);
      if (nativeIndex >= 0) await perform('rm_move', { id, index: nativeIndex }, control);
    }
  } else if (['pause', 'resume', 'retry', 'deliver', 'compare', 'reveal'].includes(action)) {
    await perform('rm_' + action, action === 'retry' ? { id, missing_only: job.missing > 0 } : { id }, control);
  }
  update();
}

async function share(job, control) {
  if (pending || !job.started_at) return;
  pending = true; control.disabled = true;
  try {
    const session = await getModuleHost('render_share');
    const result = await session.request('create', { jobId: String(job.id), label: String(job.name || 'Рендер').slice(0, 120),
      requestId: 'app-share:' + job.id + ':' + job.started_at });
    const url = new URL(result.statusUrl);
    if (url.protocol !== 'https:') throw Error('Ссылка недоступна');
    try { await navigator.clipboard.writeText(url.href); toast('Ссылка на живой статус скопирована'); }
    catch {
      openSy('<div class="syh">Живой статус</div><label class="glass syq"><input id="glowRenderLink" readonly aria-label="Ссылка на живой статус"></label>',
        root => { const field = $('#glowRenderLink', root); field.value = url.href; field.focus(); field.select(); });
    }
  } catch { toast('Не удалось получить ссылку'); }
  finally { pending = false; if (control.isConnected) control.disabled = false; }
}

function patchSheet(job) {
  const [first, last] = range(job);
  let a = first, b = last, mode = 'rr', scanned = false;
  const input = (id, label) => '<label class="glass"><small>' + label + '</small><input id="' + id + '" inputmode="numeric" aria-label="' + label + '"></label>';
  openSy('<div class="syh">Перерендер участка<small>' + esc2(job.name) + '</small></div>'
    + sseg('pm', [['rr', 'По маркерам RR'], ['man', 'Вручную']], mode)
    + '<div class="prtl" id="ptl"><div class="ptlf"></div><div class="ptls" id="ptls"><i class="prh" data-ph="a"></i><i class="prh" data-ph="b"></i></div><div class="ptlr" id="ptlr"></div></div>'
    + '<div class="ptsc"><span>' + first + '</span><span>' + last + '</span></div><div class="pfr">' + input('pA', 'С кадра') + input('pB', 'По кадр') + '</div>'
    + '<p class="synote" id="pNote" role="status">Маркеры RR в сохранённом проекте AE</p>'
    + '<button class="btn glass sygo" type="button" id="pRead">Прочитать RR</button><button class="btn main sygo" type="button" id="pGo">Перерендерить участок</button>', root => {
    const strip = $('#ptl', root), selection = $('#ptls', root), marks = $('#ptlr', root), note = $('#pNote', root);
    const inputs = [$('#pA', root), $('#pB', root)], run = $('#pGo', root), read = $('#pRead', root);
    const active = () => run.isConnected && root.classList.contains('on');
    const pos = frame => (frame - first) * 100 / Math.max(1, last - first);
    const sync = () => {
      inputs.forEach((field, i) => { field.value = i ? b : a; field.readOnly = mode === 'rr'; });
      selection.style.left = pos(a) + '%';
      selection.style.width = Math.max(.6, pos(b) - pos(a)) + '%';
      run.textContent = 'Перерендерить участок · ' + (b - a + 1) + ' ' + fnPl(b - a + 1, 'кадр', 'кадра', 'кадров');
      run.disabled = mode === 'rr' && !scanned;
      read.hidden = mode !== 'rr';
    };
    bindSyBits(root, null, (_key, value) => {
      mode = value; root.classList.toggle('pman', mode === 'man');
      note.textContent = value === 'rr' ? 'Маркеры RR в сохранённом проекте AE' : 'Потяните края участка или впишите кадры';
      sync();
    });
    inputs.forEach((field, i) => { field.onchange = () => {
      const value = /^\d+$/.test(field.value) ? Number(field.value) : i ? b : a;
      if (i) b = Math.min(last, Math.max(a, value)); else a = Math.max(first, Math.min(b, value));
      sync();
    }; });
    for (const handle of $$('[data-ph]', root)) {
      handle.onpointerdown = event => {
        if (mode !== 'man') return;
        handle.setPointerCapture(event.pointerId);
        handle.onpointermove = move => {
          const rect = strip.getBoundingClientRect();
          const frame = first + Math.round(Math.max(0, Math.min(1, (move.clientX - rect.left) / rect.width)) * (last - first));
          if (handle.dataset.ph === 'a') a = Math.min(b, frame); else b = Math.max(a, frame);
          sync();
        };
      };
      handle.onpointerup = handle.onpointercancel = () => { handle.onpointermove = null; };
    }
    read.onclick = async () => {
      if (pending) return;
      scanned = false; sync(); note.textContent = 'Читаю маркеры RR…'; selection.classList.add('scan');
      const ok = await perform('rm_markers', { id: job.id }, read, result => {
        if (!active() || mode !== 'rr') return;
        const ranges = (Array.isArray(result.ranges) ? result.ranges : []).filter(pair => Array.isArray(pair)
          && pair.length === 2 && pair.every(Number.isSafeInteger) && pair[0] <= pair[1] && pair[0] >= first && pair[1] <= last);
        if (!ranges.length) { note.textContent = 'В пределах ролика маркеры RR не найдены'; return; }
        a = Math.min(...ranges.map(pair => pair[0])); b = Math.max(...ranges.map(pair => pair[1]));
        marks.innerHTML = ranges.flat().map(frame => '<i style="left:' + pos(frame) + '%"></i>').join('');
        scanned = true; note.textContent = 'Маркеры RR: ' + a + '–' + b;
      }, false);
      if (active()) { selection.classList.remove('scan'); if (!ok) note.textContent = 'Не удалось прочитать маркеры RR'; sync(); }
    };
    run.onclick = async () => {
      if (!active() || mode === 'rr' && !scanned) return;
      const frames = a === b ? String(a) : a + '-' + b;
      const ok = await perform('rm_patch', { id: job.id, frames }, run);
      if (ok && active()) { closeSy(); root.classList.remove('pman'); $('[data-rt="queue"]', section())?.click(); }
    };
    root.classList.remove('pman'); sync();
  });
}
