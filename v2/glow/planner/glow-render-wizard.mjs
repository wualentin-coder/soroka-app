import { rmFrameSummary, rmEffectiveMedia } from './render-formats.mjs';

const base = path => String(path || '').split(/[\\/]/).pop();
const formats = [['mp4', 'MP4 H.264'], ['prores', 'ProRes'], ['dxv', 'DXV'], ['png', 'Кадры'], ['scene', 'Как в AE']];
const formatTokens = { mp4: '@flow:mp4', prores: '@flow:mov-alpha', png: '@flow:png', scene: '' };
const key = (target, index) => String(target.comp_id || target.rq_index || index + 1) + ':' + index;
const availableTargets = scene => Array.isArray(scene?.targets) ? scene.targets : [];
const displayTime = stamp => Number(stamp) > 0 ? new Date(stamp * 1000).toLocaleDateString('ru-RU') : '';

function frameBounds(text) {
  const match = String(text || '').match(/^(-?\d+)(?:-(-?\d+))?$/);
  return match ? [Number(match[1]), Number(match[2] ?? match[1])] : null;
}

function validateFrames(frames, target, isAe) {
  const summary = rmFrameSummary(frames);
  if (isAe && summary.segments !== 1) throw Error('Для AE нужен непрерывный диапазон');
  const bounds = frameBounds(target.frames), requested = frameBounds(frames);
  if (isAe && bounds && requested && (requested[0] < bounds[0] || requested[1] > bounds[1])) throw Error('Кадры выходят за диапазон композиции');
  return summary;
}

function media(target, form, scene, template) {
  return rmEffectiveMedia(target, { ae_resolution: form.res, ae_template: template }, scene.app);
}

function destination(scene, target, form, settings, template) {
  const out = String(target.output || '');
  const ext = { '@flow:mp4': '.mp4', '@flow:mov-alpha': '.mov', '@flow:png': '.[####].png' }[template];
  const file = ext && out ? out.replace(/(?:\.\[#+\])?\.[^.\\/]+$/, ext) : out;
  if (form.out === 'scene') return file;
  const project = base(scene.path).replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*]/g, '_');
  const folder = form.out === 'custom' ? form.dir : settings.render_root ? settings.render_root.replace(/[\\/]+$/, '') + '\\' + project : '';
  return folder && file ? folder.replace(/[\\/]+$/, '') + '\\' + base(file) : file;
}

function estimate(jobHistory, scene, target, frames) {
  const candidates = jobHistory.filter(job => job.scene === scene.path && job.target === target.target && job.status === 'done'
    && (!target.scene_stamp || job.scene_stamp === target.scene_stamp));
  const data = candidates.find(job => job.benchmark_result?.seconds_per_frame > 0)?.benchmark_result;
  const last = candidates.find(job => !job.benchmark && job.finished_at > job.started_at && job.total > 0);
  const perFrame = data?.seconds_per_frame || (last ? (last.finished_at - last.started_at) / last.total : 0);
  const elapsed = perFrame > 0 ? '≈ ' + Math.max(1, Math.round(perFrame * frames / 60)) + ' мин' : 'Нет замера времени';
  const ram = data?.resources?.peak_ram_bytes || data?.memory?.peak_ram_bytes || last?.resources?.peak_ram_bytes;
  return { elapsed, memory: ram > 0 ? fmt(Number((ram / 1073741824).toFixed(1))) + ' ГБ RAM · замер' : 'Нет замера памяти' };
}

export function makeRenderWizard(view, perform) {
  let flow = null;
  const current = () => flow;
  const isOpen = owner => current() === owner && $('#sySheet').classList.contains('on') && !!$('#syIn [data-render-wizard]');
  const settings = () => view().q.settings || {};
  const defaultFilter = () => ({ mode: 'queue', prefix: '[R]', label_id: 9 });
  const formatOf = (target, form) => form.fmt === 'dxv'
    ? (target.audit?.templates || []).find(name => /DXV/i.test(name)) || ''
    : formatTokens[form.fmt] || '';
  const chosen = owner => availableTargets(owner.scene).filter((target, i) => owner.selected.has(key(target, i)));
  const heading = (title, back, subtitle = '') => '<div class="nwhead">' + (back ? nwBack(back) : '') + '<div class="syh">'
    + esc2(title) + (subtitle ? '<small>' + esc2(subtitle) + '</small>' : '') + '</div></div>';

  function sceneStep(owner) {
    const scenes = view().scenes.filter(scene => typeof scene.id === 'string' && typeof scene.path === 'string' && ['ae', 'karma'].includes(scene.app)
      && (!owner.benchmark || scene.app === 'ae'));
    const row = scene => '<button type="button" class="rw nwsc" data-nwsc="' + esc2(scene.id) + '" data-q="'
      + esc2(norm(String(scene.name) + ' ' + scene.path)) + '" style="--c:' + (scene.app === 'ae' ? '#9b7bff' : '#ff8a3d')
      + '"><span class="ic"><b>' + (scene.app === 'ae' ? 'Ae' : 'K') + '</b></span><span><b>' + esc2(base(scene.path))
      + '</b><small>' + esc2(displayTime(scene.used_at)) + '</small></span>' + syChev() + '</button>';
    const groups = [['Основные проекты', scenes.filter(s => s.primary && !s.cloud)], ['Недавние', scenes.filter(s => !s.primary && !s.cloud)],
      ['В Облаке', scenes.filter(s => s.cloud)]];
    return heading(owner.benchmark ? 'Общий тест скорости' : 'Новый рендер')
      + (scenes.length > 6 ? '<label class="glass syq">' + ic.search + '<input id="nwQ" placeholder="Найти сцену" autocomplete="off" aria-label="Найти сцену"></label>' : '')
      + (scenes.length ? '<div class="nwgroups">' + groups.filter(([, list]) => list.length)
        .map(([title, list]) => '<section class="nwg"><div class="sylab">' + title + '</div><div class="glass list">' + list.map(row).join('') + '</div></section>').join('')
        + '<p class="synote nwnone" hidden>Ничего не нашлось</p></div>' : '<div class="glass empty">Сцены ещё не поступили с компьютера</div>');
  }

  function targetStep(owner) {
    const { scene, filter } = owner;
    const list = owner.read ? availableTargets(scene) : [];
    const label = AEL[filter.label_id - 1]?.[0];
    const filters = scene.app === 'ae' ? sseg('nwf', [['queue', 'Очередь AE'], ['prefix', 'По префиксу'], ['label', 'По метке']], filter.mode)
      + (filter.mode === 'prefix' ? '<label class="glass syq nwpre"><input id="nwPre" value="' + esc2(filter.prefix)
        + '" maxlength="24" placeholder="Префикс" aria-label="Префикс композиции"></label>' : '')
      + (filter.mode === 'label' ? '<div class="nwlbl">' + AEL.map(([title, color], i) => '<button type="button" class="nwl'
        + (filter.label_id === i + 1 ? ' on' : '') + '" data-nwl="' + (i + 1) + '" style="--c:' + color
        + '" aria-label="' + esc2(scene.ae_labels?.[i] || title) + '"></button>').join('')
        + '</div><small class="nwln">Метка: ' + esc2(scene.ae_labels?.[filter.label_id - 1] || label) + '</small>' : '') : '';
    const rows = list.map((target, i) => '<button type="button" class="rw nwt' + (owner.selected.has(key(target, i)) ? ' on' : '')
      + '" data-nwt="' + i + '"><span class="nwck">' + ic.check + '</span><span><b>' + esc2(target.target)
      + '</b><small>' + esc2([target.rq_index ? '#' + target.rq_index + ' в очереди' : '', target.frames ? 'Кадры ' + target.frames : ''].filter(Boolean).join(' · '))
      + '</small></span>' + (AEL[target.label_id - 1] ? '<i class="nwdot" style="--c:' + AEL[target.label_id - 1][1] + '"></i>' : '<span></span>') + '</button>').join('');
    const read = '<button class="btn ' + (owner.read ? 'glass' : 'main') + ' sygo" type="button" id="' + (owner.read ? 'nwReread' : 'nwRead')
      + '"' + (owner.busy ? ' disabled' : '') + '>' + (owner.busy ? 'Читаю сцену…' : owner.read ? 'Прочитать заново' : 'Прочитать сцену') + '</button>';
    return heading(base(scene.path), 1, scene.path) + filters + read
      + (owner.read ? '<div class="sylab">' + (scene.app === 'ae' ? 'Композиции' : 'ROP') + ' · ' + list.length
        + (!owner.benchmark && list.length && list.length <= 50 ? '<button type="button" class="sylink" id="nwAll">'
          + (owner.selected.size === list.length ? 'Снять все' : 'Выбрать все') + '</button>' : '') + '</div>'
        + (list.length ? '<div class="glass list nwtl">' + rows + '</div>' : '<div class="glass empty">По фильтру ничего не найдено</div>') : '')
      + '<button class="btn main sygo" type="button" id="nwNext"' + (!owner.selected.size || owner.busy ? ' disabled' : '') + '>Далее · '
      + owner.selected.size + ' ' + fnPl(owner.selected.size, 'цель', 'цели', 'целей') + '</button>';
  }

  function formStep(owner) {
    const targets = chosen(owner), target = targets[0], f = owner.form, ae = owner.scene.app === 'ae';
    const template = formatOf(target, f);
    const info = media(target, f, owner.scene, template);
    let frames = 0;
    try { frames = targets.reduce((sum, t) => sum + rmFrameSummary(targets.length === 1 ? f.frames : t.frames).count, 0); } catch {}
    const est = targets.length === 1 ? estimate(view().jobs, owner.scene, target, frames) : { elapsed: 'Оценка по одной цели', memory: '' };
    const warnings = [...new Set(targets.flatMap(t => [...(t.audit?.warnings || []), ...(t.problems || [])]).map(String))];
    const out = destination(owner.scene, target, f, settings(), template);
    const outputFormats = formats.filter(([id]) => id !== 'dxv' || targets.every(t => (t.audit?.templates || []).some(n => /DXV/i.test(n))));
    return heading(owner.benchmark ? 'Тест скорости' : 'Параметры', 2, base(owner.scene.path))
      + '<div class="glass nrsum"><div class="nwnames">' + targets.map(t => '<span>' + esc2(t.target) + '</span>').join('')
      + '</div><div class="nrsd"><span><b>' + esc2(info.width ? info.width + '×' + info.height : 'Как в сцене') + '</b><small>'
      + esc2(target.audit?.fps ? target.audit.fps + ' к/с' : '') + '</small></span><span><b>' + fmt(frames)
      + '</b><small>кадров</small></span><span><b>' + esc2(est.elapsed) + '</b><small>' + esc2(est.memory) + '</small></span></div></div>'
      + (targets.length === 1 ? '<div class="sylab">' + (owner.benchmark ? 'Проба · 2–120 кадров' : 'Кадры') + '</div>'
        + '<label class="glass syq nwpre"><input id="nwFrames" value="' + esc2(f.frames) + '" aria-label="Кадры" autocomplete="off"></label>' : '')
      + (owner.benchmark ? '' : '<div class="sylab">Сохранение</div>'
        + sseg('nwo', [['root','Общая папка'],['scene','Из сцены'],['custom','Своя папка']], f.out)
        + (f.out === 'custom' ? '<label class="glass syq nrpath">' + sic().folder + '<input id="nwDir" value="' + esc2(f.dir)
          + '" aria-label="Своя папка" autocomplete="off"></label>' : '')
        + '<div class="nrout nwout"><small>' + (targets.length === 1 ? 'Путь до резервирования имени' : 'Путь первого файла до резервирования имени')
        + '</small><code id="nwOut">'
        + esc2(out || 'Путь из сцены недоступен') + '</code></div>'
        + '<div class="syrow"><span>В облако после рендера</span>' + sw(f.cloud, 'data-nwsw="cloud"') + '</div>'
        + (ae ? '<button type="button" class="nwmore" id="nwMore" aria-expanded="' + !!f.more + '">Дополнительно<span>'
          + (f.more ? '▴' : '▾') + '</span></button>' : '')
        + (ae && f.more ? '<div class="glass nrset"><small class="nwk">Как рендерить</small>'
          + sseg('nwbk', [['background','В фоне'],['cep','В окне AE'],['auto','Авто']], f.backend) + '<small class="nwk">Формат</small>'
          + sseg('nwfm', outputFormats, f.fmt)
          + (f.fmt === 'mp4' ? '<small class="nwk">Битрейт H.264, Мбит/с</small>' + sseg('nwbr', [['auto','Авто'],['10','10'],['20','20'],['40','40'],['80','80']], f.br) : '')
          + '<small class="nwk">Разрешение</small>' + sseg('nwrs', [['inherit','Как в AE'],['full','Полное'],['half','½'],['quarter','¼']], f.res) + '</div>' : ''))
      + (warnings.length ? '<details class="glass nw-warning"><summary>! · ' + warnings.length + '</summary>'
        + warnings.slice(0, 20).map(warning => '<p>' + esc2(warning) + '</p>').join('') + '</details>' : '')
      + '<p class="synote" id="nwError" role="status">' + esc2(owner.error || '') + '</p><button class="btn main sygo" type="button" id="nwGo"'
      + (owner.busy ? ' disabled' : '') + '>' + (owner.busy ? 'Жду подтверждение компьютера…' : owner.benchmark ? 'Запустить тест' : 'Поставить в очередь')
      + '</button>';
  }

  function draw(owner, direction = 0) {
    const fragment = '<div data-render-wizard>' + [sceneStep, targetStep, formStep][owner.step - 1](owner) + '</div>';
    if (!isOpen(owner)) { openSy(fragment, root => bind(root, owner)); return; }
    const box = $('#syIn');
    const y = direction ? 0 : box.scrollTop;
    box.innerHTML = fragment;
    box.scrollTop = y;
    bind($('#sySheet'), owner);
    stagger(box);
    if (direction && !reduce) box.animate([{ opacity: .3, transform: 'translateX(' + direction * 26 + 'px)' }, { opacity: 1, transform: 'none' }],
      { duration: 420, easing: 'cubic-bezier(.19,1,.22,1)' });
  }

  function bind(root, owner) {
    const find = id => $('#' + id, root);
    const on = (id, fn) => { const element = find(id); if (element) element.onclick = fn; };
    const search = find('nwQ');
    if (search) search.oninput = () => {
      const query = norm(search.value.trim());
      for (const node of $$('.nwsc', root)) node.hidden = !node.dataset.q.includes(query);
      for (const group of $$('.nwg', root)) group.hidden = !$('.nwsc:not([hidden])', group);
      $('.nwnone', root).hidden = !!$('.nwsc:not([hidden])', root);
    };
    const filterChanged = () => { owner.read = false; owner.selected.clear(); owner.error = ''; };
    bindSyBits(root, (_b, enabled) => { owner.form.cloud = enabled; }, (name, value) => {
      if (name === 'nwf') { owner.filter.mode = value; filterChanged(); }
      else {
        const field = { nwo: 'out', nwbk: 'backend', nwfm: 'fmt', nwbr: 'br', nwrs: 'res' }[name];
        if (field) owner.form[field] = value;
        if (name === 'nwfm' && /^@flow:/.test(formatOf(chosen(owner)[0], owner.form))) owner.form.backend = 'background';
      }
      draw(owner);
    });
    const prefix = find('nwPre');
    if (prefix) prefix.oninput = () => {
      owner.filter.prefix = prefix.value.trim();
      filterChanged();
      for (const element of $$('[data-nwt], #nwAll, #nwNext', root)) element.disabled = true;
    };
    const dir = find('nwDir');
    if (dir) dir.oninput = () => {
      owner.form.dir = dir.value.trim();
      const target = chosen(owner)[0];
      find('nwOut').textContent = destination(owner.scene, target, owner.form, settings(), formatOf(target, owner.form)) || 'Укажите путь папки';
    };
    for (const node of $$('[data-nwto], [data-nwsc], [data-nwl], [data-nwt]', root)) node.onclick = () => {
      if (owner.busy) return;
      const { nwto, nwsc, nwl, nwt } = node.dataset;
      if (nwto) { owner.step = Number(nwto); draw(owner, -1); return; }
      if (nwsc) {
        const scene = view().scenes.find(s => s.id === nwsc);
        if (!scene) return;
        Object.assign(owner, {scene, filter: defaultFilter(), step: 2, form: null});
        filterChanged(); draw(owner, 1); return;
      }
      if (nwl) { owner.filter.label_id = Number(nwl); filterChanged(); draw(owner); return; }
      const item = availableTargets(owner.scene)[Number(nwt)];
      if (!item || !owner.read) return;
      const id = key(item, Number(nwt));
      if (owner.selected.has(id)) owner.selected.delete(id);
      else if (owner.benchmark) owner.selected = new Set([id]);
      else if (owner.selected.size < 50) owner.selected.add(id);
      draw(owner);
    };
    const read = async () => {
      if (owner.busy || owner.scene.app === 'ae' && !owner.filter.prefix) { toast('Укажите префикс композиции'); return; }
      owner.busy = true;
      const scene = owner.scene;
      filterChanged(); draw(owner);
      const ok = await perform('rm_targets', { path: scene.path, ...(scene.app === 'ae' ? owner.filter : {}) }, null, result => {
        if (!isOpen(owner) || owner.scene !== scene) return;
        if (!result.scene || result.scene.id !== scene.id || result.scene.path !== scene.path || !Array.isArray(result.scene.targets)) throw Error('Компьютер не вернул цели этой сцены');
        owner.scene = result.scene;
        owner.read = true;
      }, false);
      owner.busy = false;
      if (isOpen(owner)) { if (!ok) owner.read = false; draw(owner); }
    };
    on('nwRead', read); on('nwReread', read);
    on('nwAll', () => {
      const list = availableTargets(owner.scene);
      owner.selected = owner.selected.size === list.length ? new Set() : new Set(list.map(key));
      draw(owner);
    });
    on('nwNext', () => {
      const target = chosen(owner)[0];
      if (!target || !owner.read) return;
      const [first, last] = frameBounds(target.frames) || [];
      const conf = settings();
      owner.form = { frames: owner.benchmark && first != null ? first + '-' + Math.min(last, first + 15) : target.frames || '',
        fmt: owner.scene.app === 'ae' ? 'mp4' : 'scene',
        backend: owner.scene.app === 'ae' ? 'background' : '', br: 'auto', res: 'inherit',
        out: ['root','scene'].includes(conf.default_output) ? conf.default_output : 'root', dir: conf.render_root || '',
        cloud: ['move','copy'].includes(conf.default_deliver), more: false };
      owner.error = ''; owner.step = 3; draw(owner, 1);
    });
    on('nwMore', () => { owner.form.more = !owner.form.more; draw(owner); });
    const frameInput = find('nwFrames');
    if (frameInput) frameInput.oninput = () => { owner.form.frames = frameInput.value; };
    on('nwGo', () => { void submit(owner); });
  }

  async function submit(owner) {
    if (owner.busy) return;
    const f = owner.form, scene = owner.scene, ae = scene.app === 'ae', targets = chosen(owner);
    let payload;
    try {
      if (!targets.length || targets.length > 50) throw Error('Выберите цели для рендера');
      const items = targets.map(target => {
        const frames = String(targets.length === 1 ? f.frames : target.frames).replace(/\s+/g, '');
        const count = validateFrames(frames, target, ae).count;
        const template = owner.benchmark ? '@flow:mp4' : formatOf(target, f);
        const effective = media(target, f, scene, template);
        if (!target.audited_at || !target.scene_stamp) throw Error('Прочитайте сцену заново');
        if (!owner.benchmark && f.out === 'custom' && !/^[a-z]:\\.+/i.test(f.dir)) throw Error('Укажите полный путь папки');
        if (!owner.benchmark && f.out === 'scene' && !target.output) throw Error('В сцене не указан путь вывода');
        if (ae && template.startsWith('@flow:') && f.backend === 'cep') throw Error('Для выбранного формата нужен фоновый рендер');
        if (template === '@flow:mp4' && effective.width && (effective.width % 2 || effective.height % 2)) throw Error('MP4 H.264 требует чётные размеры');
        if (owner.benchmark && (count < 2 || count > 120 || !frameBounds(target.frames))) throw Error('Выберите от 2 до 120 кадров внутри композиции');
        const backend = template.startsWith('@flow:') ? 'background' : f.backend;
        return { target: target.target, frames, output: target.output || '', scene_stamp: target.scene_stamp,
          ...(target.comp_id ? { comp_id: target.comp_id } : {}), ...(target.rq_index ? { rq_index: target.rq_index } : {}),
          ...(target.audit?.fps > 0 ? { fps: Number(target.audit.fps) } : {}),
          ...(effective.width ? { width: effective.width, height: effective.height } : {}),
          format: template ? '' : target.audit?.format || '', audit: target.audit || {},
          output_mode: owner.benchmark ? 'root' : f.out, ...(f.out === 'custom' && !owner.benchmark ? { output_dir: f.dir } : {}),
          deliver: f.cloud && !owner.benchmark ? (settings().default_deliver === 'copy' ? 'copy' : 'move') : 'none',
          ...(ae ? { ae_backend: backend, ae_template: template,
            ae_resolution: f.res, ...(backend === 'background' ? { parallel: 4, ae_mfr: 'off' } : {}),
            ...(f.fmt === 'mp4' && f.br !== 'auto' && !owner.benchmark ? { video_bitrate: Number(f.br) } : {}) } : {}) };
      });
      payload = { path: scene.path, items: owner.benchmark ? [1,2,3,4,4,3,2,1].map((parallel, i) => ({
        ...items[0], parallel, benchmark: { full_frames: targets[0].frames, mode: 'parts', repeat: i >= 4 ? 2 : 1, scope: 'pc' },
      })) : items };
    } catch (error) {
      owner.error = error.message;
      draw(owner); return;
    }
    const signature = JSON.stringify(payload);
    if (owner.lastSubmission?.signature !== signature) owner.lastSubmission = { signature, id: crypto.randomUUID() };
    const requestId = owner.lastSubmission.id;
    if (owner.benchmark) payload.items.forEach(item => { item.benchmark.group = requestId; });
    owner.busy = true; owner.error = ''; draw(owner);
    const done = await perform('rm_batch', { ...payload, request_id: requestId }, null, null);
    owner.busy = false;
    if (!isOpen(owner)) return;
    if (done) { closeSy(); $('.screen[data-s="render"] [data-rt="queue"]')?.click(); }
    else { owner.error = 'Команда не подтверждена. Повтор с теми же параметрами использует прежний запрос.'; draw(owner); }
  }

  function open(benchmark = false) {
    if (!view().scenes.length) { toast('Сцены ещё не поступили с компьютера'); return; }
    flow = { step: 1, benchmark, selected: new Set(), busy: false, error: '' };
    $('#sySheet').classList.remove('pman');
    openSy('<div data-render-wizard>' + sceneStep(flow) + '</div>', root => bind(root, flow));
  }
  return { open };
}
