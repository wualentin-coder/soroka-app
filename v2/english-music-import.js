/* Public lyric sources only. Audio stays in the visible official YouTube player. */
(function (global) {
  'use strict';
  const UNISON = 'https://unison.boidu.dev';
  const CACHE = 'flow-song-import-v2:';
  const MAX_ROWS = 500, MAX_BYTES = 1500000, MAX_SECONDS = 7200;
  const cooldowns = new Map();
  const abortError = () => new DOMException('Отменено', 'AbortError');
  const checkAbort = signal => { if (signal?.aborted) throw abortError(); };
  const progress = (options, stage, label, extra = {}) => {
    checkAbort(options.signal);
    options.onProgress?.({ stage, label, ...extra });
  };
  async function request(url, options = {}) {
    checkAbort(options.signal);
    const host = new URL(url).hostname;
    if ((cooldowns.get(host) || 0) > Date.now()) {
      const error = new Error('Источник просит подождать перед повтором.');
      error.status = 429;
      throw error;
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, options.timeout || 12000);
    try {
      const response = await fetch(url, { method: options.method || 'GET', headers: options.headers,
        body: options.body, signal: controller.signal, credentials: 'omit' });
      if (!response.ok) {
        const error = new Error(response.status === 429 ? 'Источник просит подождать перед повтором.' : `Источник недоступен (${response.status}).`);
        error.status = response.status;
        error.retryAfter = response.headers.get('retry-after');
        if (response.status === 429) {
          const seconds = Number(error.retryAfter);
          const until = error.retryAfter && !Number.isFinite(seconds) ? Date.parse(error.retryAfter) : Date.now() + (seconds || 30) * 1000;
          cooldowns.set(host, Number.isFinite(until) ? Math.max(until, Date.now() + 1000) : Date.now() + 30000);
        }
        throw error;
      }
      if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Ответ источника слишком большой.');
      let text = '';
      if (response.body?.getReader) {
        const reader = response.body.getReader(), decoder = new TextDecoder();
        let size = 0;
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Ответ источника слишком большой.'); }
            text += decoder.decode(part.value, { stream: true });
          }
          text += decoder.decode();
        } finally { reader.releaseLock(); }
      } else text = await response.text();
      if (text.length > MAX_BYTES) throw new Error('Ответ источника слишком большой.');
      try { return JSON.parse(text); } catch { throw new Error('Источник вернул некорректный ответ.'); }
    } catch (error) {
      if (options.signal?.aborted) throw abortError();
      if (error.name === 'AbortError') throw new Error('Источник долго не отвечает. Попробуй ещё раз.');
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    }
  }
  function time(value) {
    const text = String(value || '').trim();
    if (/^\d+(?:\.\d+)?ms$/.test(text)) return Number(text.slice(0, -2)) / 1000;
    if (/^\d+(?:\.\d+)?s$/.test(text)) return Number(text.slice(0, -1));
    if (!/^\d+(?::\d{1,2}){1,2}(?:\.\d+)?$/.test(text)) return NaN;
    const parts = text.split(':').map(Number);
    if (parts.slice(1).some(part => part >= 60)) return NaN;
    return parts.reduce((sum, part) => sum * 60 + part, 0);
  }
  function finish(rows) {
    if (rows.length > MAX_ROWS) throw new Error('В тексте слишком много строк.');
    const seen = new Set();
    rows = rows.filter(row => {
      row.en = String(row.en || '').replace(/\s+/g, ' ').trim();
      if (!Number.isFinite(row.time) || row.time < 0 || row.time > MAX_SECONDS || !row.en || /^[♪♫\s]+$/.test(row.en)) return false;
      if (row.en.length > 2000) throw new Error('Строка текста слишком длинная.');
      const key = `${row.time}:${row.en}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.time - b.time);
    return rows.map((row, index) => {
      const clean = { time: row.time,
        end: Number.isFinite(row.end) && row.end > row.time ? row.end : (rows[index + 1]?.time ?? null),
        en: row.en, ru: String(row.ru || '') };
      if (Array.isArray(row.words) && row.words.length && row.words.length <= 2000) {
        const words = row.words.filter(word => word && typeof word.text === 'string' && word.text.trim()
          && word.text.length <= 2000 && Number.isFinite(word.start) && word.start >= 0
          && Number.isFinite(word.end) && word.end > word.start && word.end <= MAX_SECONDS)
          .map(word => ({ text: word.text, start: word.start, end: word.end }));
        // Timed fragments must reconstruct the line; never invent timings for missing text.
        if (words.length === row.words.length && words.map(word => word.text).join('').replace(/\s+/g, ' ').trim() === clean.en) clean.words = words;
      }
      return clean;
    });
  }
  function parseLRC(text) {
    if (typeof text !== 'string' || text.length > MAX_BYTES) throw new Error('Некорректный текст LRC.');
    const offset = Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000;
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
      const marks = [...line.matchAll(/\[(\d{1,3}:\d{2}(?:\.\d+)?)\]/g)];
      const en = line.replace(/\[[^\]]*\]/g, '').replace(/<\d{1,3}:\d{2}(?:\.\d+)?>/g, '').trim();
      for (const mark of marks) rows.push({ time: time(mark[1]) + offset, en });
    }
    return finish(rows);
  }
  function parseTTML(text) {
    if (typeof text !== 'string' || text.length > MAX_BYTES || /<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('Некорректный текст TTML.');
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    if (xml.getElementsByTagName('parsererror').length) throw new Error('Источник вернул повреждённый TTML.');
    const role = node => [...(node.attributes || [])].find(attr => attr.localName === 'role')?.value || '';
    const background = node => /(?:^|\s)x-bg(?:\s|$)/.test(role(node));
    function read(node) {
      if (node.nodeType === 3) return node.nodeValue;
      if (background(node)) return '';
      if (node.localName === 'br') return ' ';
      return [...node.childNodes].map(read).join('');
    }
    function timedWords(node) {
      const words = [];
      let pendingSpace = '', complete = true;
      function addText(text) {
        if (!text) return;
        if (text.trim()) { complete = false; return; }
        if (words.length) words[words.length - 1].text += text;
        else pendingSpace += text;
      }
      function visit(child) {
        if (child.nodeType === 3) { addText(child.nodeValue); return; }
        if (background(child)) return;
        if (child.localName === 'br') { addText(' '); return; }
        const children = [...(child.childNodes || [])];
        const timedDescendants = child.getElementsByTagNameNS ? [...child.getElementsByTagNameNS('*', 'span')].some(span => !background(span)
          && Number.isFinite(time(span.getAttribute('begin'))) && Number.isFinite(time(span.getAttribute('end')))) : false;
        const start = time(child.getAttribute?.('begin')), end = time(child.getAttribute?.('end'));
        if (child.localName === 'span' && !timedDescendants && Number.isFinite(start) && Number.isFinite(end) && end > start) {
          const text = pendingSpace + read(child);
          pendingSpace = '';
          if (!text.trim()) { addText(text); return; }
          const previous = words[words.length - 1];
          // Adjacent syllables without an XML space form one genuinely timed word.
          if (previous && !/\s$/.test(previous.text) && !/^\s/.test(text)) {
            previous.text += text;
            previous.start = Math.min(previous.start, start);
            previous.end = Math.max(previous.end, end);
          } else words.push({ text, start, end });
          return;
        }
        children.forEach(visit);
      }
      [...node.childNodes].forEach(visit);
      return complete ? words : [];
    }
    const rows = [];
    for (const node of xml.getElementsByTagNameNS('*', 'p')) {
      if (background(node) || [...ancestors(node)].some(background)) continue;
      const spans = [...node.getElementsByTagNameNS('*', 'span')].filter(span => !background(span) && ![...ancestors(span, node)].some(background));
      const spanStarts = spans.map(span => time(span.getAttribute('begin'))).filter(Number.isFinite);
      const spanEnds = spans.map(span => time(span.getAttribute('end'))).filter(Number.isFinite);
      const start = time(node.getAttribute('begin'));
      rows.push({ time: Number.isFinite(start) ? start : Math.min(...spanStarts),
        end: Number.isFinite(time(node.getAttribute('end'))) ? time(node.getAttribute('end')) : Math.max(...spanEnds), en: read(node), words: timedWords(node) });
    }
    return finish(rows);
  }
  function* ancestors(node, stop) { for (let parent = node.parentElement; parent && parent !== stop; parent = parent.parentElement) yield parent; }
  function normalize(text) { return String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
  function cleanTitle(text) { return String(text || '').replace(/[\[(](?:official\s*)?(?:music\s*)?(?:video|audio|lyrics?|visuali[sz]er|hd|4k)(?:\s*(?:video|hd|4k))*[\])]/gi, '').replace(/\s+/g, ' ').trim(); }
  function artistMatches(wanted, candidate) {
    const a = normalize(wanted), b = normalize(candidate);
    return !!a && !!b && (a === b || (` ${b} `).includes(` ${a} `));
  }
  function recordingMatches(metadata, record) {
    return normalize(cleanTitle(metadata.title)) === normalize(cleanTitle(record.song || record.trackName)) && artistMatches(metadata.artist, record.artist || record.artistName);
  }
  async function detectMetadata(videoId, options = {}) {
    if (!/^[\w-]{11}$/.test(videoId)) throw new Error('Некорректная ссылка YouTube.');
    const data = await request(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`, options);
    const raw = String(data.title || '').slice(0, 500), split = raw.match(/^(.+?)\s[-–—]\s(.+)$/);
    return { title: cleanTitle(split ? split[2] : raw), artist: (split ? split[1] : String(data.author_name || '').replace(/\s*-\s*Topic$|VEVO$/i, '')).trim().slice(0, 200), videoTitle: raw };
  }
  function unwrap(body) { if (!body?.success || !body.data || typeof body.data !== 'object') throw new Error('Источник не нашёл текст.'); return body.data; }
  function parseRecord(record) {
    if (record.language && !/^en(?:-|$)/i.test(record.language)) throw new Error('Найденный текст не на английском языке.');
    const lines = record.format === 'ttml' ? parseTTML(record.lyrics) : parseLRC(record.syncedLyrics || (record.format === 'lrc' ? record.lyrics : ''));
    if (lines.length < 2) throw new Error('Источник не содержит синхронизированного текста.');
    return lines;
  }
  async function fetchLyrics(videoId, metadata, options = {}) {
    const failures = [];
    try {
      const data = unwrap(await request(`${UNISON}/lyrics?v=${encodeURIComponent(videoId)}`, options));
      if (data.videoId !== videoId) throw new Error('Источник вернул другую видеозапись.');
      if (metadata && !recordingMatches(metadata, data)) throw new Error('Найденный текст относится к другой песне или исполнителю.');
      return { data, lines: parseRecord(data), source: { name: 'Unison', url: `${UNISON}/lyrics/${Number(data.id)}`, kind: data.format, exactVideo: true } };
    } catch (error) { if (error.name === 'AbortError') throw error; failures.push(error); }
    if (metadata?.title && metadata?.artist) {
      try {
        const data = unwrap(await request(`${UNISON}/lyrics?song=${encodeURIComponent(metadata.title)}&artist=${encodeURIComponent(metadata.artist)}`, options));
        if (!recordingMatches(metadata, data)) throw new Error('Найденный текст относится к другой песне или исполнителю.');
        return { data, lines: parseRecord(data), source: { name: 'Unison', url: `${UNISON}/lyrics/${Number(data.id)}`, kind: data.format, exactVideo: data.videoId === videoId } };
      } catch (error) { if (error.name === 'AbortError') throw error; failures.push(error); }
      try {
        const data = await request(`https://lrclib.net/api/get?track_name=${encodeURIComponent(metadata.title)}&artist_name=${encodeURIComponent(metadata.artist)}`,
          { ...options, headers: { 'Lrclib-Client': 'FlowSongsPrototype v0.1 (http://localhost:5635)' } });
        if (!recordingMatches(metadata, data)) throw new Error('Найденный текст относится к другой песне или исполнителю.');
        return { data, lines: parseRecord(data), source: { name: 'LRCLIB', url: `https://lrclib.net/api/get/${Number(data.id)}`, kind: 'lrc', exactVideo: false } };
      } catch (error) { if (error.name === 'AbortError') throw error; failures.push(error); }
    }
    const error = new Error('Не удалось получить текст с таймкодами. Можно повторить поиск или вставить свой текст.');
    error.causes = failures.map(item => ({ message: item.message, status: item.status }));
    throw error;
  }
  async function translateUnison(rows, options = {}) {
    checkAbort(options.signal);
    if (!Array.isArray(rows) || rows.length > MAX_ROWS) throw new Error('Некорректный список строк.');
    const result = rows.map(row => ({ ...row }));
    const unique = [...new Set(result.filter(row => !row.ru).map(row => row.en))];
    const translations = new Map();
    for (let index = 0; index < unique.length; index += 100) {
      progress(options, 'translation', 'Перевожу строки', { done: index, total: unique.length });
      const batch = unique.slice(index, index + 100);
      const body = await request(`${UNISON}/translate`, { ...options, timeout: 25000, method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lines: batch, to: 'ru', from: 'en' }) });
      if (!Array.isArray(body.lines) || body.lines.length !== batch.length) throw new Error('Источник вернул неполный перевод.');
      body.lines.forEach((row, at) => {
        const translated = typeof row.translation === 'string' ? row.translation.trim() : '';
        if (!translated || translated.length > 4000) throw new Error('Источник вернул неполный перевод.');
        translations.set(batch[at], translated);
      });
    }
    return result.map(row => ({ ...row, ru: row.ru || translations.get(row.en) || '' }));
  }
  function normalizeMusicSegments(records, expectedDuration) {
    if (!Array.isArray(records) || records.length > 200) return [];
    const validDuration = Number.isFinite(expectedDuration) && expectedDuration > 0 && expectedDuration <= MAX_SECONDS;
    const intervals = records.filter(record => record?.category === 'music_offtopic' && record.actionType === 'skip'
      && Number.isFinite(record.votes) && record.votes >= 0 && Array.isArray(record.segment) && record.segment.length === 2
      && record.segment.every(Number.isFinite) && record.segment[0] >= 0 && record.segment[1] > record.segment[0]
      && record.segment[1] <= MAX_SECONDS
      && (!validDuration || record.segment[1] <= expectedDuration + 1)
      && (!validDuration || !Number.isFinite(record.videoDuration) || Math.abs(record.videoDuration - expectedDuration) <= 2))
      .map(record => [...record.segment]).sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const interval of intervals) {
      const previous = merged[merged.length - 1];
      if (previous && interval[0] <= previous[1]) previous[1] = Math.max(previous[1], interval[1]);
      else merged.push(interval);
    }
    return merged;
  }
  function mapCatalogTime(value, segments) {
    if (!Number.isFinite(value)) return value;
    let removed = 0, delay = 0;
    for (const [start, end] of segments) {
      const duration = end - start;
      if (value >= start - removed) delay += duration;
      removed += duration;
    }
    return value + delay;
  }
  function alignLines(lines, segments) {
    return finish(lines.map(line => ({ ...line, time: mapCatalogTime(line.time, segments), end: mapCatalogTime(line.end, segments),
      ...(line.words ? { words: line.words.map(word => ({ ...word, start: mapCatalogTime(word.start, segments), end: mapCatalogTime(word.end, segments) })) } : {}) })));
  }
  async function fetchMusicAlignment(videoId, options = {}) {
    const sourceUrl = `https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(videoId)}&categories=${encodeURIComponent(JSON.stringify(['music_offtopic']))}`;
    const records = await request(sourceUrl, { ...options, timeout: 8000 });
    const knownDuration = Number.isFinite(options.videoDuration) && options.videoDuration > 0 ? options.videoDuration : null;
    const segments = normalizeMusicSegments(records, knownDuration);
    if (!segments.length) return null;
    const durations = records.filter(record => Number.isFinite(record.videoDuration) && record.videoDuration > 0 && record.videoDuration <= MAX_SECONDS).map(record => record.videoDuration);
    return { method: 'sponsorblock', segments, ...(knownDuration || durations.length ? { videoDuration: knownDuration || Math.max(...durations) } : {}), sourceUrl };
  }
  function getCache(videoId) {
    try {
      const item = JSON.parse(localStorage.getItem(CACHE + videoId));
      if (!item || item.videoId!==videoId || !Number.isFinite(item.savedAt) || Date.now() - item.savedAt > 86400000 || !item.source?.url || !Array.isArray(item.lines) || item.lines.length < 2 || item.lines.length > MAX_ROWS) return null;
      const sourceURL=new URL(item.source.url);
      if(sourceURL.protocol!=='https:'||!['unison.boidu.dev','lrclib.net'].includes(sourceURL.hostname))return null;
      if (item.alignment) {
        const alignmentURL = new URL(item.alignment.sourceUrl);
        if (item.alignment.method !== 'sponsorblock' || alignmentURL.origin !== 'https://sponsor.ajay.app'
          || !Array.isArray(item.alignment.segments) || item.alignment.segments.length > 200
          || !item.alignment.segments.every(segment => Array.isArray(segment) && segment.length === 2
            && segment.every(Number.isFinite) && segment[0] >= 0 && segment[1] > segment[0] && segment[1] <= MAX_SECONDS)) return null;
      }
      const lines=finish(item.lines);if(lines.length<2)return null;
      return { ...item, lines, translationComplete:lines.every(row=>!!row.ru), cached: true };
    } catch { return null; }
  }
  function saveCache(videoId, result) { try { localStorage.setItem(CACHE + videoId, JSON.stringify({ ...result, savedAt: Date.now() })); } catch {} }
  async function retryTranslate(result, options = {}) {
    const warnings = (result.warnings || []).filter(warning => !warning.startsWith('Перевод пока'));
    let lines = result.lines, translationComplete = lines.every(row => !!row.ru);
    try { lines = await translateUnison(lines, options); translationComplete = lines.every(row => !!row.ru); }
    catch (error) { if (error.name === 'AbortError') throw error; warnings.push('Перевод пока недоступен. Английский текст уже можно слушать; попробуй перевод ещё раз.'); }
    const next = { ...result, lines, warnings, translationComplete };
    if (result.videoId) saveCache(result.videoId, next);
    return next;
  }
  async function prepare(videoId, options = {}) {
    if (!/^[\w-]{11}$/.test(videoId)) throw new Error('Некорректная ссылка YouTube.');
    let result = options.force ? null : getCache(videoId);
    if (!result) {
      progress(options, 'metadata', 'Определяю песню');
      let metadata;
      try { metadata = await detectMetadata(videoId, options); }
      catch (error) { if (error.name === 'AbortError') throw error; metadata = null; }
      progress(options, 'lyrics', 'Ищу текст с таймкодами');
      const found = await fetchLyrics(videoId, metadata, options);
      let lines = found.lines, alignment = null;
      const warnings = [];
      if (!found.source.exactVideo) {
        progress(options, 'lyrics', 'Подстраиваю таймкоды под клип');
        try {
          alignment = await fetchMusicAlignment(videoId, options);
          if (alignment) lines = alignLines(lines, alignment.segments);
        } catch (error) { if (error.name === 'AbortError') throw error; }
        warnings.push(alignment
          ? 'Учтены немузыкальные вставки по разметке сообщества SponsorBlock. Точность совпадения с аудио не проверялась.'
          : 'Таймкоды найдены для другой записи этой песни. У клипа может быть вступление — при необходимости сдвинь текст.');
      }
      result = { videoId, title: found.data.song || found.data.trackName || metadata?.title || 'YouTube', artist: found.data.artist || found.data.artistName || metadata?.artist || '', lines, source: found.source, alignment, warnings, translationComplete: false, cached: false };
      saveCache(videoId, result);
    }
    if (!result.translationComplete) result = await retryTranslate(result, options);
    progress(options, 'done', result.translationComplete ? 'Текст и перевод готовы' : 'Текст готов');
    checkAbort(options.signal);
    saveCache(videoId, result);
    return result;
  }
  global.FlowSongImport = { prepare, retryTranslate, detectMetadata, fetchLyrics, translateUnison, parseLRC, parseTTML,
    normalizeMusicSegments, mapCatalogTime, alignLines, fetchMusicAlignment };
})(globalThis);
