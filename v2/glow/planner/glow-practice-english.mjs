import { getEnglishHost } from './runtime-session.js';
import { safeURL } from './glow-library-store.mjs';
import { moreList, moreRow } from './glow-more-ui.mjs';
import { createPracticeVoice, voiceAvailable } from './glow-practice-voice.mjs';
import { createPracticeSongs } from './glow-practice-songs.mjs';
import { delegatePractice, label, moreEmpty, numberOrDash, practiceButton, practiceMessage, practiceTabs, progress,
  slug, unslug } from './glow-practice-ui.mjs';

const tabsByRoute = { enrun: 'today', endeck: 'words', encourse: 'course', enphr: 'words', enprog: 'progress',
  enlist: 'words', enchat: 'chat', enread: 'read' };
const routeTitles = { enrun: 'Занятие', endeck: 'Слова', encourse: 'Курс', enphr: 'Фразы', enprog: 'Прогресс',
  enlist: 'Словарь', enchat: 'Эмма', enread: 'Медиатека', ensong: 'Песня' };
let runtime;
function loadEnglishRuntime() {
  runtime ||= Promise.all([
    import('./practice/flow-ui/english-workspace.js'),
    import('./practice/english-practice-core.js').then(() => import('./practice/english-media-practice-core.js'))
      .then(() => import('./practice/english-lyrics-practice-core.js')),
    import('./practice/english-domain.mjs'), import('./practice/english-host-adapter.js'),
    import('./practice/english-audio.js'), import('./practice/english-persistence.js'),
  ]).then(([, , domain, adapter, audio, persistence]) => ({ ...domain, ...adapter, ...audio, ...persistence }))
    .catch(error => { runtime = null; throw error; });
  return runtime;
}

export function connectGlowEnglish(env) {
  let host, owner, stop, audio, model, opening, error, work, song, selectedSong, songs = null, songError = '';
  let tab = 'today', wordQuery = '', wordTimer, touchWords, queryGeneration = 0, requested = new Set();
  let spoken;
  let voiceField, player, playerScope, songObjectURL, songMessage = '';
  const voice = createPracticeVoice((kind, state, message) => {
    if (work?.isConnected) work.voiceInput = { kind, state, message };
    if (state === 'idle') voiceField = null;
  });
  const music = createPracticeSongs({ host: () => host, active: () => env.selected('english') && tab === 'media',
    onOpen(item) { songs = null; songError = ''; showSong(item); } });
  const workspaceModel = (model, id) => id === 'enchat' ? { ...model, task: null, taskKind: null, nativeView: null } : model;
  const data = () => model?.data || {};
  const unit = () => data().today?.unit;
  const words = () => data().words || data().today?.words;
  const speak = ({ text, signal, isCurrent = () => true }) => {
    if (!window.speechSynthesis || typeof text !== 'string' || !text.trim() || signal?.aborted || !isCurrent()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    const voice = speechSynthesis.getVoices().find(item => item.localService && item.lang.startsWith('en'));
    if (voice) utterance.voice = voice;
    speakStop();
    return new Promise(resolve => {
      function finish() {
        signal?.removeEventListener('abort', cancel);
        if (spoken === cancel) spoken = null;
        resolve();
      }
      function cancel() {
        speechSynthesis.cancel();
        finish();
      }
      spoken = cancel;
      signal?.addEventListener('abort', cancel, { once: true });
      utterance.onend = utterance.onerror = finish;
      speechSynthesis.speak(utterance);
    });
  };
  function speakStop() { spoken?.(); }
  function adopt(next) {
    const previous = model;
    model = next;
    if (!next.owner) {
      music.stop(true); stopSong(); voice.cancel();
      song = songs = null; requested.clear();
      if (curId() === 'ensong') pop();
    }
    if (work?.isConnected) work.model = workspaceModel(next, curId());
    if (voiceField && (!voiceField.isConnected || next.suspended)) voice.cancel();
    if (env.selected('english') && (!previous || previous.status !== next.status ||
      JSON.stringify([previous.data.today, previous.data.words]) !== JSON.stringify([next.data.today, next.data.words]))) env.redraw('english');
  }
  function refreshResource(resource, args = {}) {
    if (!owner || requested.has(resource)) return;
    requested.add(resource);
    void owner.command('load', { resource, args }).catch(() => { requested.delete(resource); })
      .finally(() => {
        if (tab === 'media' && resource === 'books') env.redraw('english');
        if (resource === 'wordlist') paintWords(touchWords);
      });
  }
  function warm() {
    refreshResource('today');
    if (tab === 'learn') {
      refreshResource('words');
      refreshResource('wordlist', { q: wordQuery, filter: 'all' });
    } else if (tab === 'media') {
      refreshResource('books');
      if (songs === null && !songError) {
        const source = host, lease = source?.captureOwner();
        songError = 'Загрузка…';
        void music.list().then(value => { if (source === host && source.isCurrent(lease)) { songs = value.items; songError = value.warning; } })
          .catch(() => { if (source === host && source.isCurrent(lease)) songError = 'Песни недоступны'; })
          .finally(() => env.redraw('english'));
      }
    }
  }
  async function open() {
    if (owner) {
      if (model?.suspended) await owner.command('resume').catch(() => {});
      if (model?.status === 'ready') warm();
      return owner;
    }
    if (opening || error) return opening;
    opening = (async () => {
      try {
        const [tools, native] = await Promise.all([loadEnglishRuntime(), getEnglishHost()]);
        host = tools.bindEnglishHost(native);
        const cores = { authored: window.FlowEnglishPracticeCore, media: window.FlowEnglishMediaPracticeCore,
          lyrics: window.FlowEnglishLyricsPracticeCore };
        audio = tools.localAudioEffects(cores.authored, { explicitOnly: true });
        const domain = createEnglishDomainInstance(tools, cores);
        owner = domain;
        stop = domain.subscribe(adopt);
        await domain.ready;
        adopt(domain.getSnapshot());
        if (model.status !== 'ready') throw Error('Не удалось подтвердить учебную сессию');
        warm();
        return domain;
      } catch (failure) {
        stop?.();
        await owner?.dispose();
        owner = model = host = stop = null;
        error = failure.message === 'english_owner_not_ready' ? 'Открой Flow заново, чтобы продолжить занятия'
          : failure.message?.startsWith('english_') ? 'Не удалось подключить Английский' : failure.message || 'Английский недоступен';
      } finally { opening = null; env.redraw('english'); }
    })();
    return opening;
  }
  function createEnglishDomainInstance(tools, cores) {
    return tools.createEnglishDomain({ host, storage: localStorage, locks: navigator.locks, cores,
      effects: { ...audio, ...tools.englishPersistence(host, localStorage), ...(window.speechSynthesis ? { speak } : {}),
        stop() { audio.stop(); speakStop(); } } });
  }
  function lesson() {
    const today = data().today;
    if (!today) return practiceMessage(model?.error ? 'Не удалось загрузить урок' : 'Загружаем занятие…', !!model?.error);
    const u = today.unit || {}, plan = today.plan || {}, streak = today.streak;
    return `<div class="glass ezhero"><div class="ezh1">${ezRing(plan.doneToday ? 1 : 0, null, `<b>${numberOrDash(streak)}</b><small>дней</small>`)}
      <span class="ezt"><small>${label([u.level, Number.isFinite(plan.minutes) ? `≈ ${plan.minutes} мин` : ''].filter(Boolean).join(' · '))}</small>
      <b>${label(u.topic?.title || (plan.doneToday ? 'Занятие пройдено' : 'Занятие на сегодня'))}</b>
      <em>${label(u.title || (u.number ? 'Урок ' + u.number : ''))}</em></span></div>
      <div class="ezsteps">${[['words', plan.newWords, 'слов'], ['retry', plan.phraseReviews, 'фраз'], ['learn', u.number, 'урок'], ['mic', null, 'разговор']].map(([icon, value, title]) =>
        `<span class="${plan.doneToday ? 'ok' : ''}">${eic()[icon]}<b>${Number.isFinite(value) ? value : ''}</b><small>${title}</small></span>`).join('')}</div>
      ${model?.capabilities.lesson ? `<button class="btn main sygo" data-practice-action="lesson">${eic().play}${model.taskKind === 'lesson' && !model.confirmed ? 'Продолжить занятие' : plan.doneToday ? 'Ещё занятие' : 'Начать занятие'}</button>`
        : practiceButton('course', 'К курсу', eic().learn)}</div>
      <div class="ezrow"><button class="glass ezstat" data-practice-action="learn"><b>${numberOrDash(words()?.known)}</b><small>слов</small></button>
      <button class="glass ezstat" data-practice-action="course"><b>${numberOrDash(u.number)}<i>${u.total ? '/' + u.total : ''}</i></b><small>урок</small></button>
      <button class="glass ezstat" data-practice-action="progress">${eic().chart}<small>Прогресс</small></button></div>
      <div class="sylab">Разговор</div><div class="glass ezhero ezchat"><div class="ezh1"><span class="egav">Э<i></i></span>
      <span class="ezt"><b>Эмма</b><small>${label(u.topic?.title)}</small></span></div>
      ${practiceButton('chat', 'Написать', eic().chat)}</div>`;
  }
  function wordRows() {
    return (data().wordlist?.items || []).map(item => `<div class="ezwr"><b lang="en">${label(item.en)}</b><span>${label(item.ru)}</span>
      <button class="ezsay" data-practice-action="speak" data-english-word="${slug(item.en)}" aria-label="Послушать">${eic().say}</button></div>`).join('');
  }
  function paintWords(el) {
    if (env.selected('english') && el?.isConnected) el.innerHTML = wordRows() || moreEmpty(requested.has('wordlist') && !data().wordlist ? 'Поиск…' : 'Нет слов');
  }
  function learn() {
    const word = words(), level = unit(), fraction = progress(word?.known, word?.total);
    return `<div class="glass ezhero"><div class="ezh1">${ezRing(fraction, '#6cb6ff', `<b>${word?.total ? Math.round(fraction * 100) + '%' : '—'}</b>`)}
      <span class="ezt"><small>Словарь</small><b>${numberOrDash(word?.known)} <i>${word?.total ? 'из ' + numberOrDash(word.total) : ''}</i></b>
      <em>${Number.isFinite(word?.learning) ? 'Учу сейчас ' + word.learning : ''}</em></span></div>
      <div class="ezbtns">${model?.capabilities.deck ? practiceButton('deck', 'Учить слова', eic().words) : ''}${practiceButton('phrases', 'Фразы', eic().msg)}</div></div>
      <div class="sylab">Курс</div><button class="glass ezhero ezcourse" data-practice-action="course"><div class="ezh1"><span class="ezt">
      <small>${label(level?.level || 'Курс английского')}</small><b>${label(level?.title || level?.topic?.title || 'Программа')}</b></span>${eic().learn}</div></button>
      <div class="sylab">Словарь</div><label class="glass syq">${eic().search}<input id="egWq" value="${label(wordQuery)}" placeholder="Слово" aria-label="Найти слово"></label>
      <div class="glass ezwl" id="egWl">${wordRows() || moreEmpty('Нет слов')}</div>`;
  }
  function media() {
    const books = data().books?.items || [];
    return `<div class="sylab">Книги</div>${books.length ? `<div class="egshelf">${books.map(book => `<button class="ezbook" data-practice-action="book" data-book="${Number(book.id)}">
      <span class="egcov">${label(book.level || '')}</span><b>${label(book.title)}</b><small>${numberOrDash(book.pages)} стр.</small></button>`).join('')}</div>`
      : moreEmpty(data().books ? 'Книг пока нет' : 'Загружаем книги…')}
      ${practiceButton('reader', 'Открыть медиатеку', eic().book)}
      <div class="sylab"><span>Песни</span><button type="button" class="glass ib" data-practice-action="add-song" aria-label="Добавить песню">${ic.plus}</button></div>
      <label class="glass syq ezsq2">${eic().search}<input id="egSq" placeholder="Найти в песнях" aria-label="Найти в песнях"></label>
      ${songError === 'Сетевая медиатека недоступна' ? '<p role="status">Сетевая медиатека недоступна</p>' : ''}
      <div class="glass ezsongs" id="egSongs">${songRows('')}</div>
      ${songError && songError !== 'Загрузка…' ? practiceButton('retry-songs', 'Обновить песни') : ''}`;
  }
  function songRows(query) {
    const rows = (songs || []).filter(item => norm(String(item.title || '') + ' ' + String(item.artist || '')).includes(norm(query)));
    return rows.length ? rows.map(item => moreRow(eic().music, item.title || 'Песня', item.artist,
      `data-practice-action="song" data-song="${slug(item.id)}"`)).join('')
      : moreEmpty(songError || (query ? 'Ничего не найдено' : 'Песен пока нет'));
  }
  function render() {
    const header = `<div class="srow egcaps">${capsHTML(ETAB, tab, 'data-etab', eic())}</div>`;
    return header + (!owner || model?.status !== 'ready' ? practiceMessage(error || 'Подключаем английский…', !!error)
      : `<div id="egBody">${tab === 'today' ? lesson() : tab === 'learn' ? learn() : media()}</div>`);
  }
  async function to(route, operation, args) {
    const domain = await open();
    if (!domain || !env.selected('english')) return;
    if (operation) {
      if (operation === 'lesson.start' && model.taskKind === 'lesson' && !model.confirmed) {
        go(route);
        return;
      }
      await domain.command(operation, args);
    }
    if (env.selected('english')) go(route);
  }
  async function refresh() {
    if (owner && model?.status === 'ready') {
      requested.clear(); songError = ''; warm();
    } else { error = ''; env.redraw('english'); await open(); }
  }
  function bind(el) {
    practiceTabs(el, 'data-etab', key => { if (tab === 'media') music.stop(true); tab = key; env.redraw('english'); warm(); });
    const word = $('#egWq', el);
    touchWords = $('#egWl', el);
    if (word) word.oninput = () => {
      wordQuery = word.value;
      clearTimeout(wordTimer);
      const attempt = ++queryGeneration;
      wordTimer = setTimeout(() => {
        if (env.selected('english') && word.isConnected) void owner?.command('words.query', { filter: 'all', q: wordQuery })
          .then(() => { if (attempt === queryGeneration) paintWords(touchWords); }).catch(() => {});
      }, 230);
    };
    const songsFilter = $('#egSq', el);
    if (songsFilter) songsFilter.oninput = () => { $('#egSongs', el).innerHTML = songRows(songsFilter.value); };
    delegatePractice(el, {
      retry: refresh, lesson: () => to('enrun', 'lesson.start'), course: () => to('encourse'),
      deck: () => to('endeck', 'deck.start'), phrases: () => to('enphr'), progress: () => to('enprog'), chat: () => to('enchat'),
      reader: () => to('enread'), book: button => to('enread', 'reader.open', { id: Number(button.dataset.book) }),
      learn() { tab = 'learn'; env.redraw('english'); warm(); },
      speak: button => owner.command('audio.speak', { text: unslug(button.dataset.englishWord) }),
      'add-song': () => music.add(),
      'retry-songs'() { songs = null; songError = ''; warm(); },
      async song(button) {
        const item = songs?.find(row => row.id === unslug(button.dataset.song));
        if (!item) throw Error('Песня не найдена');
        showSong(await music.track(item));
      },
    });
  }
  function showSong(item) {
    if (!env.selected('english') || tab !== 'media') return;
    song = item;
    selectedSong = item.id;
    songMessage = '';
    go('ensong');
  }
  function lyricRows(lines) {
    return lines.length ? moreList(lines.map((line, index) => `<div class="syrow in" data-song-line="${index}"><span><b lang="en">${label(line.en)}</b><br><small>${label(line.ru)}</small></span></div>`).join(''))
      : moreEmpty('Текст пока недоступен');
  }
  function renderSong() {
    if (!song || song.id !== selectedSong) return moreEmpty('Песня недоступна');
    const watch = safeURL(song.watchUrl);
    const lines = Array.isArray(song.lines) ? song.lines : [];
    return `<div class="glass ezhero"><div class="ezh1"><span class="ic">${eic().music}</span>
      <span class="ezt"><small>${label(song.artist)}</small><b>${label(song.title)}</b></span></div>
      <audio controls preload="none"${song.youtubeId ? ' hidden' : ''}></audio>
      ${watch ? `<div class="glow-practice-actions">${practiceButton('play-video', 'Смотреть здесь', eic().play)}
        <a class="btn glass" href="${label(watch)}" target="_blank" rel="noopener noreferrer">Открыть YouTube</a></div><div data-song-video></div>` : ''}</div>
      <p data-song-status role="status">${label(songMessage)}</p>
      ${song.youtubeId ? practiceButton('load-lyrics', lines.length ? 'Обновить текст' : 'Загрузить текст') : ''}
      ${song.youtubeId && lines.length && song.lyricResult?.translationComplete === false ? practiceButton('translate-song', 'Повторить перевод') : ''}
      <div data-song-lyrics>${lyricRows(lines)}</div>`;
  }
  function stopSong() {
    playerScope?.abort();
    player?.dispose();
    player = playerScope = null;
    if (songObjectURL) URL.revokeObjectURL(songObjectURL);
    songObjectURL = null;
  }
  function bindSong(el) {
    if (!song || song.id !== selectedSong) return;
    stopSong();
    const track = song, id = track.id, current = () => el.isConnected && selectedSong === id && curId() === 'ensong';
    const note = $('[data-song-status]', el);
    const setStatus = text => { if (current()) { songMessage = text; note.textContent = text; } };
    const native = $('audio', el);
    const src = track.local && track.file instanceof Blob ? (songObjectURL = URL.createObjectURL(track.file)) : safeURL(track.source);
    const media = player = new window.FlowSongMedia(native);
    const signal = (playerScope = new AbortController()).signal;
    if (track.youtubeId || src) media.setTrack({ ...track, source: src });
    media.addEventListener('error', () => setStatus(media.error?.message || 'Не удалось воспроизвести песню'), { signal });
    let currentLine = -1;
    media.addEventListener('timeupdate', () => {
      if (!current()) return;
      const at = (song.lines || []).findLastIndex(line => Number.isFinite(line.time) && line.time <= media.currentTime);
      if (at === currentLine) return;
      $('[data-song-line="' + currentLine + '"]', el)?.removeAttribute('aria-current');
      $('[data-song-line="' + at + '"]', el)?.setAttribute('aria-current', 'true');
      currentLine = at;
    }, { signal });
    async function load(force, translation = false) {
      const buttons = $$('[data-practice-action="load-lyrics"],[data-practice-action="translate-song"]', el);
      buttons.forEach(button => { button.disabled = true; });
      try {
        const saved = await music.importLyrics(song, { force, translation, current, progress: setStatus });
        if (saved && current()) {
          song = saved;
          songs = null;
          $('[data-song-lyrics]', el).innerHTML = lyricRows(saved.lines);
          const loadButton = $('[data-practice-action="load-lyrics"]', el);
          loadButton.textContent = 'Обновить текст';
          const translate = $('[data-practice-action="translate-song"]', el);
          if (saved.lyricResult?.translationComplete === false && !translate) {
            loadButton.insertAdjacentHTML('afterend', practiceButton('translate-song', 'Повторить перевод'));
          } else if (translate && saved.lyricResult?.translationComplete !== false) translate.remove();
          setStatus(saved.lyricResult?.translationComplete === false ? 'Текст сохранён. Перевод можно повторить' : 'Текст сохранён');
        }
      } catch (error) { setStatus(error.message || 'Текст пока недоступен'); }
      finally { buttons.forEach(button => { button.disabled = false; }); }
    }
    delegatePractice(el, {
      'play-video': async button => { button.hidden = true; await media.mount($('[data-song-video]', el)); },
      'load-lyrics': () => load(!!song.lines?.length),
      'translate-song': () => load(false, true),
    });
    if (track.youtubeId && !track.lines?.length) void load(false);
  }
  async function bindScreen(id, el) {
    if (id === 'ensong') { bindSong(el); return; }
    const domain = await open();
    if (!domain || curId() !== id || !el.isConnected) {
      if (curId() === id && el.isConnected) el.innerHTML = practiceMessage(error || 'Английский недоступен', false);
      return;
    }
    const element = document.createElement('flow-english-workspace');
    element.className = 'glow-practice-workspace';
    work = element;
    el.replaceChildren(element);
    element.model = workspaceModel(model, id);
    element.tab = tabsByRoute[id] || 'today';
    if (voiceAvailable()) element.voiceInput = { state: 'idle' };
    element.addEventListener('flow-english-intent', async event => {
      event.preventDefault();
      const { requestId, name, args, options } = event.detail;
      if (name.startsWith('voice.')) {
        element.settle(requestId, { ok: true });
        if (name === 'voice.finish') { void voice.finish(); return; }
        if (name === 'voice.cancel') { voice.cancel(); return; }
        const field = element.shadowRoot.querySelector(`[data-input="${args.kind === 'chat' ? 'chat' : 'lesson-answer'}"]`);
        const lease = host?.captureOwner();
        if (!field || field.disabled || !lease) return;
        voiceField = field;
        void voice.start({ kind: args.kind, active: () => curId() === id && field.isConnected && element === work && host.isCurrent(lease),
          onText(text) {
            const limit = args.kind === 'chat' ? 600 : 4000;
            field.value = [field.value.trim(), text].filter(Boolean).join(' ').slice(0, limit);
            field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          } });
        return;
      }
      try {
        await domain.command(name, args, options);
        if (element.isConnected && curId() === id) {
          element.settle(requestId, { ok: true });
          if (['lesson.close', 'rule.close', 'exercise.close', 'deck.quit', 'reader.close', 'chat.close'].includes(name) &&
            ['enrun', 'endeck', 'enread', 'enchat'].includes(id)) pop();
        }
      } catch (failure) { if (element.isConnected) element.settle(requestId, { ok: false, error: failure.message }); }
    });
    if (id === 'enchat' || !model.task && !model.reader?.book) element.selectTab(element.tab);
    if (id === 'enphr') {
      await domain.command('load', { resource: 'phrases' }).catch(() => {});
      if (element.isConnected && model.data?.phrases?.items?.length) {
        const phrases = document.createElement('div');
        phrases.className = 'glass list';
        phrases.innerHTML = model.data.phrases.items.map(row => `<div class="syrow in"><span><b>${label(row.en || row.phrase)}</b><br><small>${label(row.ru)}</small></span></div>`).join('');
        el.prepend(phrases);
      }
    }
  }
  function suspend() { audio?.stop(); speakStop(); voice.cancel(); music.stop(true); player?.pause(); void owner?.command('suspend').catch(() => {}); }
  window.addEventListener('pagehide', suspend);
  window.addEventListener('flow:resume', () => { if (env.active('english')) void open(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && env.active('english')) void open(); });
  return {
    open, render, bind, suspend, bindScreen,
    leave(from, to) {
      voice.cancel();
      music.stop(true);
      if (to === 'practice' || tabsByRoute[to]) { audio?.stop(); speakStop(); }
      else suspend();
      if (from === 'ensong') { stopSong(); song = null; selectedSong = null; }
      if (from !== 'practice') work?.closeWindows();
    },
    title: id => routeTitles[id],
    screen: id => id === 'ensong' ? renderSong() : moreEmpty('Подключаем занятие…'),
    tile: () => ({ detail: data().today?.plan?.doneToday ? 'Выполнено' : unit()?.topic?.title,
      done: data().today?.plan?.doneToday === true, fraction: data().today?.plan?.doneToday ? 1 : 0 }),
  };
}
