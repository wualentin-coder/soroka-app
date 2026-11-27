import './practice/english-music-media.js';
import './practice/english-music-remote.js';
import { parseManual } from './practice/song-lyrics.mjs';
import { moreField, moreInput, moreList, moreRow } from './glow-more-ui.mjs';
import { label, moreEmpty } from './glow-practice-ui.mjs';

const videoId = /^[a-zA-Z0-9_-]{11}$/;
const modes = [['youtube', 'YouTube'], ['url', 'Аудиоссылка'], ['file', 'Файл']];
const webURL = /^[a-z][a-z0-9+.-]*:|^www\.|^[\w.-]+\.[a-z]{2,}(?:[/?#]|$)/i;

function audioURL(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('Нужна прямая ссылка HTTPS');
  return url.href;
}

async function localStore(scope, action, value) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('flow-english-music-v2:' + scope, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('tracks', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error('Хранилище аудио недоступно'));
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('tracks', action === 'put' ? 'readwrite' : 'readonly');
      const store = tx.objectStore('tracks');
      const result = action === 'put' ? store.put(value) : action === 'get' ? store.get(value) : store.getAll();
      tx.oncomplete = () => resolve(result.result);
      tx.onerror = tx.onabort = () => reject(Error('Не удалось открыть или сохранить аудио'));
    });
  } finally { db.close(); }
}

export function createPracticeSongs({ host, active, onOpen }) {
  const Media = window.FlowSongMedia;
  let editor, importing;
  function owner() {
    const source = host(), lease = source?.captureOwner();
    if (!lease || !source.isCurrent(lease)) throw Error('Открой Английский заново, чтобы продолжить');
    return { source, lease };
  }
  const valid = binding => host() === binding.source && binding.source.isCurrent(binding.lease);
  async function request(binding, op, args = {}) {
    if (!valid(binding)) throw Error('Подключение Английского изменилось');
    const reply = await binding.source.send(op, args, binding.lease);
    if (!valid(binding)) throw Error('Подключение Английского изменилось');
    if (!reply || reply.error) throw Error(reply?.error || 'Медиатека не ответила');
    return reply;
  }
  function saveRemote(binding, track) {
    const { source, local, file, lyricResult, ...rest } = track;
    const metadata = lyricResult ? { ...lyricResult, lines: undefined } : undefined;
    return request(binding, 'songsave', { track: { ...rest, source, lyricResult: metadata } }).then(({ item }) => {
      if (typeof item?.id !== 'string' || !Array.isArray(item.lines)) throw Error('Сервер не подтвердил сохранение песни');
      return item;
    });
  }
  async function list() {
    const binding = owner();
    const [remote, local] = await Promise.allSettled([
      request(binding, 'songs').then(reply => {
        if (!Array.isArray(reply.items)) throw Error('Не удалось прочитать медиатеку');
        return reply.items;
      }),
      localStore(binding.lease.scope, 'list'),
    ]);
    if (!valid(binding)) throw Error('Подключение Английского изменилось');
    if (remote.status === 'rejected' && local.status === 'rejected') throw remote.reason;
    return { items: [...(remote.value || []), ...(local.value || []).map(({ file, ...item }) => item)],
      warning: remote.status === 'rejected' ? 'Сетевая медиатека недоступна' : '' };
  }
  async function track(item) {
    const binding = owner();
    const answer = item.local ? await localStore(binding.lease.scope, 'get', item.id)
      : (await request(binding, 'song', { id: item.id })).item;
    if (!valid(binding) || !answer || answer.id !== item.id) throw Error('Песня недоступна');
    return answer;
  }
  const editorCurrent = value => value === editor && value.form.isConnected && value.sheet.classList.contains('on') && active() && valid(value.binding);
  function setStatus(value, text) {
    if (editorCurrent(value)) value.note.textContent = text;
  }
  function closeEditor(hide = false) {
    const value = editor;
    editor = null;
    if (hide && value?.form.isConnected && value.sheet.classList.contains('on')) closeSy();
  }
  function renderFields(value, mode) {
    value.mode = mode;
    value.results.innerHTML = '';
    $$('.glow-song-source', value.form).forEach(button => button.setAttribute('aria-pressed', String(button.dataset.source === mode)));
    const input = mode === 'file' ? moreField('Аудиофайл', '<input name="file" type="file" accept="audio/*" required>')
      : moreInput(mode === 'youtube' ? 'Название или ссылка' : 'Аудиоссылка', 'url', value.query[mode] || '',
        `maxlength="1500" required inputmode="${mode === 'url' ? 'url' : 'text'}" autocomplete="off"`);
    value.fields.innerHTML = input + (mode === 'youtube' ? '' : moreInput('Название', 'title', value.title || '', 'maxlength="100" required')
      + moreInput('Исполнитель', 'artist', value.artist || '', 'maxlength="100"')
      + moreField('Текст и перевод', `<textarea name="lyrics" rows="3" maxlength="180000" required
        placeholder="[00:12.00] English line | Перевод">${label(value.lyrics || '')}</textarea>`));
    value.submit.textContent = mode === 'youtube' && !webURL.test(value.query.youtube || '') ? 'Найти' : 'Добавить';
    setStatus(value, mode === 'file' ? 'Файл останется на этом устройстве' : '');
  }
  function validateResults(rows) {
    if (!Array.isArray(rows)) throw Error('Поиск не вернул список');
    return rows.filter(item => videoId.test(item?.videoId || '') && typeof item.title === 'string' && item.title.trim())
      .filter((item, index, list) => list.findIndex(row => row.videoId === item.videoId) === index).slice(0, 10);
  }
  async function submit(value, selected) {
    if (!editorCurrent(value) || value.busy) return;
    const form = value.form;
    const text = form.elements.url?.value.trim() || '';
    const mode = value.mode;
    const serial = ++value.serial;
    value.busy = true;
    value.submit.disabled = true;
    $$('.glow-song-source', form).forEach(button => { button.disabled = true; });
    try {
      let video;
      if (mode === 'youtube') {
        if (selected || webURL.test(text)) video = Media.parseLink(selected ? `https://www.youtube.com/watch?v=${selected.videoId}` : text);
        else {
          if (text.length < 2 || text.length > 200) throw Error('Введи название или исполнителя от 2 до 200 символов');
          setStatus(value, 'Ищем на YouTube…');
          value.results.innerHTML = '';
          const answer = await request(value.binding, 'songsearch', { query: text });
          if (!editorCurrent(value) || serial !== value.serial) return;
          const results = validateResults(answer.items);
          value.results.innerHTML = results.length ? moreList(results.map((item, index) =>
            moreRow(eic().music, item.title, item.channel, `data-song-result="${index}"`)).join('')) : moreEmpty('Песни не найдены');
          $$('[data-song-result]', value.results).forEach(button => {
            button.onclick = () => void submit(value, results[Number(button.dataset.songResult)]);
          });
          setStatus(value, '');
          return;
        }
      }
      const id = value.id ||= crypto.randomUUID();
      const base = { id, duration: 0, lines: [], favorite: false };
      let saved;
      setStatus(value, 'Сохраняем песню…');
      if (video) {
        saved = await saveRemote(value.binding, { ...base, youtubeId: video.id, watchUrl: video.url, start: video.start,
          title: selected?.title || 'Видео с YouTube', artist: selected?.channel || 'YouTube', duration: selected?.duration || 0 });
      } else {
        const title = form.elements.title.value.trim(), artist = form.elements.artist.value.trim();
        if (!title) throw Error('Укажи название песни');
        const item = { ...base, title, artist, lines: parseManual(form.elements.lyrics.value) };
        if (mode === 'file') {
          const file = form.elements.file.files?.[0];
          if (!file || file.size < 1 || file.size > 100 * 1024 * 1024) throw Error('Выбери аудиофайл до 100 МБ');
          if (!file.type.startsWith('audio/') && !/\.(?:mp3|m4a|ogg|opus|wav|flac|aac|webm)$/i.test(file.name)) throw Error('Нужен аудиофайл');
          saved = { ...item, local: true, file };
          await localStore(value.binding.lease.scope, 'put', saved);
        } else saved = await saveRemote(value.binding, { ...item, source: audioURL(text) });
      }
      if (editorCurrent(value)) {
        closeSy();
        onOpen(saved);
      }
    } catch (error) {
      if (serial === value.serial) setStatus(value, error.message || 'Не удалось добавить песню');
    } finally {
      if (editorCurrent(value) && serial === value.serial) {
        value.busy = false;
        value.submit.disabled = false;
        $$('.glow-song-source', form).forEach(button => { button.disabled = false; });
      }
    }
  }
  function add() {
    closeEditor();
    const binding = owner();
    openSy(`<form data-song-add><div class="syh">Добавить песню</div>
      <div class="ezmini">${modes.map(([mode, title]) => `<button class="glow-song-source" type="button" data-source="${mode}">${title}</button>`).join('')}</div>
      <div class="glow-practice-form" data-song-fields></div><p role="status" data-song-add-status></p>
      <button type="submit" class="btn main sygo">Найти</button><div data-song-results></div></form>`, sheet => {
      const form = $('[data-song-add]', sheet);
      const value = editor = { binding, form, sheet, serial: 0, query: {},
        note: $('[data-song-add-status]', form), fields: $('[data-song-fields]', form),
        results: $('[data-song-results]', form), submit: $('button[type="submit"]', form) };
      syOnClose = () => { if (editor === value) closeEditor(); };
      $$('.glow-song-source', form).forEach(button => {
        button.onclick = () => { if (!value.busy) renderFields(value, button.dataset.source); };
      });
      form.onsubmit = event => { event.preventDefault(); void submit(value); };
      form.oninput = () => {
        if (value.busy) return;
        value.id = null;
        if (form.elements.url) value.query[value.mode] = form.elements.url.value;
        for (const key of ['title', 'artist', 'lyrics']) if (form.elements[key]) value[key] = form.elements[key].value;
        if (value.mode === 'youtube') {
          value.submit.textContent = webURL.test(form.elements.url.value.trim()) ? 'Добавить' : 'Найти';
          value.results.innerHTML = '';
          setStatus(value, '');
        }
      };
      renderFields(value, 'youtube');
    });
  }
  function haltImport() { importing?.abort(); importing = null; }
  async function importLyrics(item, { force = false, translation = false, current, progress }) {
    haltImport();
    const binding = owner();
    const controller = importing = new AbortController();
    const validTrack = () => !controller.signal.aborted && current() && valid(binding);
    const remote = window.FlowSongRemote.create((op, args) => request(binding, op, args));
    try {
      const result = await (translation ? remote.retryTranslate : remote.prepare)(item.youtubeId, {
        signal: controller.signal, force, videoDuration: item.duration || undefined,
        onProgress: state => { if (validTrack()) progress(state.label); },
      });
      if (!validTrack()) return null;
      let lines = result.lines;
      if (translation) {
        const norm = text => String(text || '').replace(/\s+/g, ' ').trim();
        if (item.lines.length !== lines.length || item.lines.some((line, i) => norm(line.en) !== norm(lines[i].en)))
          throw Error('Текст песни изменился. Сохранённые строки и таймкоды остались прежними');
        lines = item.lines.map((line, i) => ({ ...line, ru: line.ru?.trim() || lines[i].ru || '' }));
      }
      const lyricResult = translation ? { ...item.lyricResult, translationComplete: lines.every(line => !!line.ru?.trim()) } : result;
      const saved = await saveRemote(binding, { ...item, lines, lyricResult,
        duration: item.duration || result.videoDuration || 0, title: result.title || item.title, artist: result.artist || item.artist });
      return validTrack() ? saved : null;
    } finally { if (importing === controller) importing = null; }
  }
  return { add, list, track, importLyrics, stop(hide = false) { closeEditor(hide); haltImport(); } };
}
