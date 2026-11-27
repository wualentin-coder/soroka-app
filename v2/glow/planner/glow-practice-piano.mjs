import { getModuleHost } from './runtime-session.js';
import { createPianoRealProvider, PIANO_NATIVE_OPERATIONS } from './practice/piano-real-provider.js';
import { delegatePractice, label, moreEmpty, practiceButton, practiceMessage, practiceTabs,
  progress, slug, unslug } from './glow-practice-ui.mjs';

const builtin = item => item.private !== true;
const localDay = () => {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
};
const keyFor = profile => 'flow-piano-profile:' + profile;
const chev = () => ic.chev.replace('<svg', '<svg class="chev"');

export function connectGlowPiano(env) {
  let api, host, provider, stopOwner, profile, saved, library = [], moduleIndex = 0, tab = 'today';
  let revision = 0, pending = false, saving, saveTimer, opening, error = '', status = '';
  let target, player, playerScreen, filter = 'all', query = '', midiLoading;
  const lease = () => host?.isCurrent() && profile;
  const redraw = () => env.redraw('piano');
  const options = () => {
    const song = library.find(item => item.id === saved.favoriteSongId) || library.find(item => item.id === 'joy-beginner');
    const input = saved.input || 'mic';
    return { date: localDay(), input, minutes: 15, courseVersion: 2, song,
      goal: api.learningGoals.getLearningGoal(song, saved.learningProgress, { date: localDay(), input, hand: 'right' }) };
  };
  const plan = () => api && saved ? api.learning.createDailyPlan(saved.learningProgress, options()) : null;
  const nextTask = () => api.learning.nextLearningTask(saved.learningProgress, options());
  const completed = lesson => api.learning.isLessonIndependentlyComplete(saved.learningProgress, lesson.id);
  const request = (op, args = {}) => provider.request(op, args);
  const helped = task => {
    const flag = saved.dailyRun?.assistance?.[task.id];
    return !!flag && flag.helpedAt > flag.consumedAt;
  };
  const changeStatus = value => {
    status = value;
    const node = $('#glow-piano-status');
    if (node) node.textContent = value;
  };
  function cache() {
    if (!lease()) return false;
    try {
      localStorage.setItem(keyFor(profile), JSON.stringify({ ...saved, _sync: { dirty: pending, revision } }));
      return true;
    } catch { return false; }
  }
  function queue(snapshot) {
    if (!lease()) return;
    saved = api.mergePianoState(saved, { ...snapshot, updatedAt: Math.max(Date.now(), saved.updatedAt + 1) });
    pending = true;
    changeStatus(cache() ? 'Сохраняем…' : 'Сохраняем в Flow…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(sync, 650);
    env.updateTiles();
  }
  async function sync() {
    if (!lease() || !pending || saving) return;
    const identity = host;
    const send = async () => {
      if (!lease() || identity !== host || !pending) return;
      const sent = saved;
      try {
        const answer = await request('progress_save', { progress: api.toPianoProgress(sent), baseRevision: revision });
        if (identity !== host || answer.profileId !== profile || !lease()) return;
        revision = answer.revision;
        pending = saved !== sent;
        saved = api.mergePianoState(answer.progress, saved);
        cache();
        changeStatus(pending ? 'Сохраняем…' : 'Сохранено в Flow');
      } catch {
        if (identity !== host || !lease()) return;
        try {
          const remote = await request('progress_load');
          if (identity !== host || remote.profileId !== profile || !lease()) return;
          const rebased = api.mergePianoState(remote.progress, saved);
          pending = !api.samePianoProgress(remote.progress, rebased);
          const changed = remote.revision !== revision;
          revision = remote.revision;
          saved = rebased;
          changeStatus(pending ? (changed ? 'Сохраняем…' : 'Синхронизация ожидает подключения') : 'Сохранено в Flow');
          cache();
        } catch {
          if (identity === host) changeStatus(cache() ? 'Сохранено на устройстве' : 'Не удалось сохранить прогресс');
        }
      }
    };
    saving = navigator.locks ? navigator.locks.request(keyFor(profile), send) : send();
    try { await saving; }
    finally {
      saving = null;
      if (pending && status === 'Сохраняем…' && lease()) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(sync, 1200);
      }
    }
  }
  function detachPlayer() {
    const previous = player;
    player = null;
    playerScreen = null;
    phone.classList.remove('pnplay');
    previous?.destroy();
  }
  function reset() {
    clearTimeout(saveTimer);
    stopOwner?.();
    stopOwner = null;
    detachPlayer();
    host = provider = saved = profile = target = null;
    library = [];
    pending = false;
    redraw();
  }
  async function open() {
    if (lease()) {
      if (error) {
        error = '';
        try {
          const { compositions } = await request('composition_list');
          if (lease()) library = [...api.COMPOSITIONS, ...compositions.filter(item => !api.COMPOSITIONS.some(row => row.id === item.id))];
        } catch { if (lease()) error = 'Личные композиции недоступны'; }
        redraw();
      }
      if (pending) void sync();
      return true;
    }
    if (opening || error) return opening;
    opening = (async () => {
      try {
        [api, host] = await Promise.all([import('./practice/piano/native.mjs'), getModuleHost('piano')]);
        const identity = host;
        provider = createPianoRealProvider({ request: (op, args) => identity.request(op, args) });
        stopOwner = host.subscribe(() => { if (!identity.isCurrent() && identity === host) reset(); });
        const remote = await request('progress_load');
        if (identity !== host || !host.isCurrent()) return false;
        profile = remote.profileId;
        revision = remote.revision;
        let cached;
        try { cached = JSON.parse(localStorage.getItem(keyFor(profile)) || '{}'); } catch { cached = {}; }
        saved = api.mergePianoState(remote.progress, cached);
        pending = !api.samePianoProgress(remote.progress, saved);
        library = [...api.COMPOSITIONS];
        changeStatus(pending ? 'Сохраняем…' : 'Сохранено в Flow');
        cache();
        try {
          const answer = await request('composition_list');
          if (identity !== host || !lease()) return false;
          library = [...library, ...answer.compositions.filter(item => !library.some(row => row.id === item.id))];
        } catch {
          if (identity === host) error = 'Личные композиции недоступны';
        }
        if (pending) void sync();
        return !!lease();
      } catch {
        reset();
        error = 'Не удалось подключить Пианино';
        return false;
      }
    })().finally(() => { opening = null; redraw(); });
    return opening;
  }
  function today() {
    const daily = plan(), steps = daily.tasks, task = nextTask();
    const done = steps.filter(item => item.completed).length;
    const favorite = options().song;
    return `<div class="plate-w keys-w pnhero" style="--lvl:${progress(done, steps.length)}"><div class="halo"></div><div class="plate keys"><div class="fill"></div>
      <small>Твоё занятие · ${label(daily.minutes || 15)} мин</small><h3>${label(task?.title || 'Занятие пройдено')}</h3>
      <div class="kb" aria-hidden="true">${Array.from({ length: 14 }, () => '<i></i>').join('')}${[0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map(index => `<u style="--p:${index}"></u>`).join('')}</div>
      </div></div>
      <div class="pnfoot"><button class="btn main sygo" data-practice-action="${task ? 'start' : 'program'}">${pnI.play}${task ? 'Начать занятие' : 'Открыть программу'}</button>
      <span class="pnsync" role="status">${pnI.sync}<span id="glow-piano-status">${label(status)}</span></span></div>
      <div class="sylab"><span>Сегодня</span><span>${done} из ${steps.length}</span></div>
      <div class="glass pnroute">${steps.map((item, index) => `<div class="pnst ${item.completed ? 'done' : item.id === task?.id ? 'cur' : ''}"><span class="pndot">${item.completed ? pnI.check : index + 1}</span><span><b>${label(item.title)}</b><small>${item.completed ? 'Пройдено' : item.id === task?.id ? 'Сейчас' : 'Впереди'}</small></span></div>`).join('')}</div>
      ${favorite ? `<button class="glass pngoal" data-practice-action="songs">${cover(favorite)}<span class="ezt"><small>Моя цель</small><b>${label(favorite.title)}</b></span>${chev()}</button>` : ''}
      <button class="glass pngoal" data-practice-action="settings"><span class="pnri">${pnI.hand}</span><span class="ezt"><small>Перед игрой</small><b>Настроить инструмент</b></span>${chev()}</button>`;
  }
  const cover = item => pnCover({ c: ({
    'joy-beginner': ['#ff8a3d', '#ffd08a'], 'fur-elise': ['#9b7bff', '#ff7aa8'],
  })[item.id] || (builtin(item) ? ['#64d2ff', '#9fd6ff'] : ['#5dff9e', '#64d2ff']) });
  function songRows() {
    const shown = library.filter(item => (filter === 'all' || (filter === 'learn') === builtin(item))
      && norm(item.title + ' ' + (item.author || '')).includes(norm(query)));
    return shown.map(item => {
      const record = saved.studyProgress?.[item.id];
      return `<button class="pnsong" data-practice-action="song" data-id="${slug(item.id)}">${cover(item)}
        <span><b>${label(item.title)}</b><small>${label([item.author, builtin(item) ? 'Учебная версия' : 'Своя композиция'].filter(Boolean).join(' · '))}</small>
        ${record ? `<em>${record.mastery ? 'Сыграно самостоятельно' : 'Разбор сохранён'}</em>` : ''}</span>${chev()}</button>`;
    }).join('') || moreEmpty('Композиции не найдены');
  }
  function songs() {
    return `<div class="ezfind"><label class="glass syq">${pnI.search}<input id="pnQ" value="${label(query)}" placeholder="Найти композицию" autocomplete="off"></label>
      <div class="ezmini">${[['all', 'Все'], ['learn', 'Учебные'], ['mine', 'Мои']].map(([id, title]) => `<button class="${filter === id ? 'on' : ''}" data-practice-action="filter" data-id="${id}">${title}</button>`).join('')}</div></div>
      ${error ? practiceMessage(error) : ''}<div class="glass list pnsongs" id="pnSl">${songRows()}</div>`;
  }
  function program() {
    const groups = [...new Set(api.ACTIVE_COURSE.map(lesson => lesson.moduleId))].map(id => api.ACTIVE_COURSE.filter(lesson => lesson.moduleId === id));
    const lessons = groups[moduleIndex] || groups[0];
    return `<div class="pnmods">${groups.map((list, index) => {
      const done = list.filter(completed).length;
      return `<button class="glass pnmod${index === moduleIndex ? ' on' : ''}" data-practice-action="module" data-index="${index}"><small>${String(index + 1).padStart(2, '0')}</small>
      <b>${label(list[0].moduleTitle)}</b><span class="pnbar"><i style="width:${progress(done, list.length) * 100}%"></i></span><em>${done} из ${list.length}</em></button>`;
    }).join('')}</div><div class="sylab"><span>Модуль ${moduleIndex + 1} из ${groups.length}</span><span>${lessons.filter(completed).length} из ${lessons.length}</span></div>
      <div class="glass list">${lessons.map((lesson, index) => `<button class="rw pnles ${completed(lesson) ? 'done' : ''}" data-practice-action="lesson" data-id="${slug(lesson.id)}">
      <span class="ic"><b>${completed(lesson) ? '✓' : String(index + 1).padStart(2, '0')}</b></span><span><b>${label(lesson.title)}</b><small>${completed(lesson) ? 'Пройдено' : 'Открыть урок'}</small></span>${chev()}</button>`).join('')}</div>`;
  }
  function results() {
    const summary = api.learning.learningSummary(saved.learningProgress, options());
    const current = new Set(nextTask()?.skillIds || []);
    const sections = [['Сейчас', 'now', skill => skill.due || current.has(skill.id)],
      ['Получается', 'ok', skill => skill.ready || skill.retained], ['Пробовал', 'tried', skill => skill.covered],
      ['Впереди', 'ahead', () => true]];
    const remaining = new Set(summary.skills);
    return `<div class="ezrow">${[[summary.coveredSkills, 'приёмов попробовал'], [summary.readySkills, 'сыграл сам'], [summary.retainedSkills, 'в разные дни']].map(([value, title]) =>
      `<div class="glass ezstat"><b>${value}</b><small>${title}</small></div>`).join('')}</div>
      ${sections.map(([title, css, includes]) => {
        const rows = [...remaining].filter(includes);
        rows.forEach(row => remaining.delete(row));
        return rows.length ? `<div class="sylab"><span>${title}</span><span>${rows.length}</span></div><div class="glass list pnsk">
          ${rows.map(skill => `<div class="pnskr ${css}"><span class="pndot">${css === 'ok' ? pnI.check : ''}</span><b>${label(skill.title)}</b></div>`).join('')}</div>` : '';
      }).join('')}`;
  }
  async function loadMidi() {
    if (window.Midi) return;
    midiLoading ||= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('./practice/piano/vendor/tone-midi.js', import.meta.url).href;
      script.onload = resolve;
      script.onerror = () => { script.remove(); reject(Error('Не удалось открыть MIDI')); };
      document.head.append(script);
    }).catch(error => { midiLoading = null; throw error; });
    await midiLoading;
  }
  async function add(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) throw Error('Выбери MIDI-файл до 2 МБ');
    const identity = host;
    await loadMidi();
    const composition = api.parseMidiComposition(await file.arrayBuffer(), file.name);
    if (identity !== host || !lease()) return;
    const { metadata } = await request('composition_import', { composition });
    if (identity !== host || !lease()) return;
    library = [...library.filter(item => item.id !== metadata.id), metadata];
    tab = 'songs';
    query = '';
    filter = 'mine';
    toast('Композиция сохранена');
    redraw();
  }
  function begin(record) {
    if (!record || !lease()) return;
    target = record;
    go('pnrun');
  }
  function beginTask(task) {
    if (!task) return;
    if (task.kind === 'song' || !task.lessonId) {
      const id = task.compositionId || task.songId || options().song?.id;
      if (id) begin({ id, task });
      else { tab = 'songs'; redraw(); }
      return;
    }
    begin({ task });
  }
  async function mount(screen) {
    if (!target || !lease()) return;
    const identity = host, nativeProvider = provider, selection = target;
    const container = $('.glow-piano-player', screen);
    const current = () => screen === playerScreen && screen.isConnected && curId() === 'pnrun' && host === identity && lease();
    const ready = await api.createNativePlayer(container, {
      call: (op, args) => PIANO_NATIVE_OPERATIONS.includes(op) ? nativeProvider.request(op, args) : identity.request(op, args),
      isActive: current, isolatedLibrary: true,
      storageKey: keyFor(profile) + ':player', initialState: saved, getLearningProgress: () => saved?.learningProgress,
      onStateChange: state => {
        if (current()) queue({ ...state, learningProgress: saved.learningProgress, dailyRun: saved.dailyRun });
      },
      onAssistance: task => {
        if (!current()) return;
        const prev = saved.dailyRun?.assistance?.[task.id];
        const next = { helpedAt: Math.max(Date.now(), (prev?.helpedAt || 0) + 1, (prev?.consumedAt || 0) + 1),
          consumedAt: prev?.consumedAt || 0 };
        queue({ ...saved, dailyRun: { ...saved.dailyRun, assistance: { ...saved.dailyRun?.assistance, [task.id]: next } } });
      },
      onReport: event => {
        if (!current() || !event.task || event.source === 'demo' || event.report?.demo === true) return;
        const flag = saved.dailyRun?.assistance?.[event.task.id];
        const dailyRun = flag ? { ...saved.dailyRun, assistance: { ...saved.dailyRun.assistance,
          [event.task.id]: { ...flag, consumedAt: Math.max(Date.now(), flag.helpedAt) } } } : saved.dailyRun;
        queue({ ...saved, learningProgress: api.learning.recordLearningAttempt(saved.learningProgress, event.task,
          event.report, { at: Date.now(), date: event.task.date || localDay(), attemptId: event.attemptId,
            mode: event.mode, source: event.source, assisted: event.assisted || helped(event.task), cueVisible: event.cueVisible,
            beta: event.beta, breakdown: event.breakdown }), dailyRun });
      },
      onTaskSkip: () => { if (current()) pop(); },
      onTaskComplete: () => { if (current()) pop(); },
      onNavigate: view => { if (view !== 'practice' && player && current()) pop(); },
    });
    if (!current()) { ready.destroy(); return; }
    const style = document.createElement('style');
    style.textContent = '#practice-view:not([hidden]){height:100%}';
    container.shadowRoot.append(style);
    player = ready;
    phone.classList.toggle('pnplay', !selection.settings);
    if (selection.settings) ready.showSettings();
    else if (selection.id) {
      if (!api.COMPOSITIONS.some(item => item.id === selection.id)) {
        const { composition } = await request('composition_get', { id: selection.id });
        if (!current()) return;
        ready.addComposition(composition);
      }
      queue({ ...saved, favoriteSongId: selection.id });
      ready.openComposition(selection.id, selection.task);
    } else ready.openTask({ ...selection.task, assisted: helped(selection.task) });
    $('[data-piano-loading]', screen)?.remove();
  }
  return {
    open,
    tile() {
      const daily = plan();
      if (!daily) return {};
      const done = daily.tasks.filter(item => item.completed).length;
      return { fraction: progress(done, daily.tasks.length), done: done === daily.tasks.length,
        detail: done + ' из ' + daily.tasks.length };
    },
    title: () => target?.settings ? 'Настройка инструмента' : 'Пианино',
    render: () => `<div class="srow pncaps">${capsHTML(PNTAB, tab, 'data-pntab', pnI)}
      <button class="glass ib" data-practice-action="import" aria-label="Добавить композицию"${lease() ? '' : ' disabled'}>${pnI.plus}</button>
      <input type="file" hidden data-piano-file accept=".mid,.midi,audio/midi,audio/x-midi"></div>
      <div id="pnBody">${lease() ? ({ today, songs, prog: results, plan: program })[tab]() : practiceMessage(error || 'Загружаем занятие…', !!error)}</div>`,
    bind(body) {
      practiceTabs(body, 'data-pntab', id => { tab = id; redraw(); });
      delegatePractice(body, {
        retry: () => { if (!lease()) error = ''; return open(); },
        start: () => beginTask(nextTask()),
        program: () => { tab = 'plan'; redraw(); },
        songs: () => { tab = 'songs'; redraw(); },
        settings: () => begin({ settings: true }),
        song: button => begin({ id: unslug(button.dataset.id) }),
        module: button => { moduleIndex = Number(button.dataset.index); redraw(); },
        lesson: button => beginTask(api.learning.createPracticeTask(unslug(button.dataset.id), { ...options(), progress: saved.learningProgress })),
        filter: button => { filter = button.dataset.id; redraw(); },
      });
      const file = $('[data-piano-file]', body);
      const importButton = $('[data-practice-action="import"]', body);
      if (importButton) importButton.onclick = () => file.click();
      if (file) file.onchange = () => {
        const selected = file.files[0];
        file.value = '';
        void add(selected).catch(error => toast(error.message || 'Не удалось добавить композицию'));
      };
      const search = $('#pnQ', body);
      if (search) search.oninput = () => { query = search.value; $('#pnSl', body).innerHTML = songRows(); };
    },
    screen: () => `<div data-piano-loading role="status">${moreEmpty('Открываем пианино…')}</div><div class="glow-piano-player"></div>`,
    bindScreen(_id, screen) {
      playerScreen = screen;
      void mount(screen).catch(error => {
        if (playerScreen !== screen || !screen.isConnected || curId() !== 'pnrun') return;
        detachPlayer();
        screen.innerHTML = practiceMessage(error?.message || 'Не удалось открыть пианино', false)
          + practiceButton('back', 'Вернуться к занятиям');
        delegatePractice(screen, { back: pop });
      });
    },
    leave(from) { if (from === 'pnrun') { detachPlayer(); target = null; } },
    suspend() { player?.pause(); if (pending) void sync(); },
  };
}
