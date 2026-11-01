/* Public lyric sources only. Audio stays in the visible official YouTube player. */
(function (global) {
  'use strict';
  const UNISON = 'https://unison.boidu.dev';
  const LYRICSPLUS = 'https://lyricsplus.prjktla.my.id';
  const CACHE = 'flow-song-import-v4:';
  const CLIP_MAP_SOURCE = 'https://wualentin-coder.github.io/soroka-app/v2/assets/music-alignments.json';
  let clipManifest;
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
    if (options.deadline && Date.now() >= options.deadline) throw new Error('Поиск занял слишком много времени. Попробуй ещё раз.');
    const host = new URL(url).hostname;
    if ((cooldowns.get(host) || 0) > Date.now()) {
      const error = new Error('Источник просит подождать перед повтором.');
      error.status = 429;
      throw error;
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, Math.max(1, Math.min(options.timeout || 8000, options.deadline ? options.deadline - Date.now() : Infinity)));
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
    const timed = rows.some(row => Number.isFinite(row.time));
    const seen = new Set();
    rows = rows.filter(row => {
      row.en = String(row.en || '').replace(/\s+/g, ' ').trim();
      if ((timed && (!Number.isFinite(row.time) || row.time < 0 || row.time > MAX_SECONDS)) || !row.en || /^[♪♫\s]+$/.test(row.en)) return false;
      if (row.en.length > 2000) throw new Error('Строка текста слишком длинная.');
      const key = `${row.time}:${row.en}`;
      if (timed && seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (timed) rows.sort((a, b) => a.time - b.time);
    return rows.map((row, index) => {
      const clean = { time: timed ? row.time : null,
        end: timed ? (Number.isFinite(row.end) && row.end > row.time && row.end <= MAX_SECONDS ? row.end : (rows[index + 1]?.time ?? null)) : null,
        en: row.en, ru: String(row.ru || '') };
      if (timed && Array.isArray(row.words) && row.words.length && row.words.length <= 150) {
        const words = row.words.filter(word => word && typeof word.text === 'string' && word.text.trim()
          && word.text.length <= 500 && Number.isFinite(word.start) && word.start >= Math.max(0, clean.time - .05)
          && Number.isFinite(word.end) && word.end > word.start && word.end <= MAX_SECONDS
          && (clean.end === null || word.end <= clean.end + .05))
          .map(word => ({ text: word.text, start: word.start, end: word.end }));
        // Timed fragments must reconstruct the line; never invent timings for missing text.
        if (words.length === row.words.length && words.every((word,i)=>!i||word.start>=words[i-1].start) && words.map(word => word.text).join('').replace(/\s+/g, ' ').trim() === clean.en) clean.words = words;
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
  function cleanTitle(text) {
    const versions = String(text || '').match(/[\[(][^\])]*\b(?:live|remix|cover|acoustic|instrumental|karaoke|slowed|sped[- ]up|version)\b[^\])]*[\])]/gi) || [];
    let clean = String(text || '').replace(/[\[(]([^\])]+)[\])]/g, (whole, label) => {
      return /\b(?:official|music video|lyric video|lyrics|visuali[sz]er)\b/i.test(label) || /^(?:hd|4k|8k)(?:\s+remaster(?:ed)?)?$/i.test(label.trim()) ? '' : whole;
    }).replace(/\s+(?:starring|featuring|feat\.?|ft\.?)\s+.+$/i, '')
      .replace(/\s*(?:[-|–—]\s*)?(?:official\s+(?:music\s+)?(?:video|audio)(?:\s+remaster(?:ed)?)?|lyrics?(?:\s+video)?|(?:hd|4k|8k)(?:\s+remaster(?:ed)?)?)\s*$/i, '')
      .replace(/\s+/g, ' ').trim();
    for (const version of versions) if (!clean.includes(version)) clean += ` ${version}`;
    return clean.trim();
  }
  function artistMatches(wanted, candidate) {
    const a = normalize(wanted), b = normalize(candidate);
    return !!a && !!b && (a === b || (` ${b} `).includes(` ${a} `));
  }
  function recordingMatches(metadata, record) {
    return normalize(cleanTitle(metadata.title)) === normalize(cleanTitle(record.song || record.trackName)) && artistMatches(metadata.artist, record.artist || record.artistName);
  }
  async function detectMetadata(videoId, options = {}) {
    if (!/^[\w-]{11}$/.test(videoId)) throw new Error('Некорректная ссылка YouTube.');
    let data;
    try {
      data = await request(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`, options);
      if (!data?.title?.trim()) throw new Error('YouTube не вернул название видео.');
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      checkAbort(options.signal);
      let video = options.videoMetadata;
      if (!video && typeof options.getVideoMetadata === 'function') {
        const remaining = Math.min(6000, options.deadline ? options.deadline - Date.now() : Infinity);
        if (remaining <= 0) throw error;
        let timer, abort;
        try {
          video = await Promise.race([Promise.resolve().then(() => options.getVideoMetadata()), new Promise((_, reject) => {
            timer = setTimeout(() => reject(error), remaining);
            abort = () => reject(abortError());
            options.signal?.addEventListener('abort', abort, { once: true });
          })]);
        } catch (fallbackError) { if (fallbackError.name === 'AbortError') throw fallbackError; throw error; }
        finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
      }
      checkAbort(options.signal);
      if (video?.video_id !== videoId || typeof video.title !== 'string' || !video.title.trim()) throw error;
      const artistTitle = video.title.match(/^(.+?)\s[-–—]\s(.+)$/);
      // Cued videos may expose a title but no author. Its explicit artist/title
      // pair is sufficient; a title alone must never become a guessed artist.
      if (!artistTitle?.[1]?.trim() || !cleanTitle(artistTitle[2]).trim()) {
        if (typeof video.author !== 'string' || !video.author.trim()) throw error;
      }
      data = { title: video.title, author_name: typeof video.author === 'string' ? video.author : '' };
    }
    const raw = String(data.title || '').slice(0, 500), split = raw.match(/^(.+?)\s[-–—]\s(.+)$/);
    const title = split ? split[2] : raw;
    const featured = title.match(/\s+(?:starring|featuring|feat\.?|ft\.?)\s+(.+)$/i)?.[1]?.replace(/[\[(].*$/, '').trim();
    return { title: cleanTitle(title), artist: (split ? split[1] : String(data.author_name || '').replace(/\s*-\s*Topic$|VEVO$/i, '')).trim().slice(0, 200),
      ...(featured ? { featuredArtist: featured.slice(0, 200) } : {}), videoTitle: raw };
  }
  function unwrap(body) { if (!body?.success || !body.data || typeof body.data !== 'object') throw new Error('Источник не нашёл текст.'); return body.data; }
  function parseRecord(record) {
    if (record.language && !/^en(?:-|$)/i.test(record.language)) throw new Error('Найденный текст не на английском языке.');
    const text = record.lyrics || record.plainLyrics || '';
    const lines = record.format === 'ttml' ? parseTTML(text) : record.syncedLyrics || record.format === 'lrc' ? parseLRC(record.syncedLyrics || text) : parsePlain(text);
    if (!lines.length) throw new Error('Источник не содержит текста.');
    return lines;
  }
  function parsePlain(text) {
    if (typeof text !== 'string' || text.length > MAX_BYTES) throw new Error('Некорректный текст песни.');
    return finish(text.split(/\r?\n/).map(en => ({ time: null, end: null, en, ru: '' })));
  }
  function timingOf(lines) { return lines.some(row => row.words?.length) ? 'word' : lines.some(row => Number.isFinite(row.time)) ? 'line' : 'none'; }
  function parseLyricsPlus(body) {
    if (!body || !['Word', 'Line', 'None'].includes(body.type) || !Array.isArray(body.lyrics) || body.lyrics.length > MAX_ROWS) throw new Error('Источник вернул некорректный текст.');
    if (body.type === 'None') return parsePlain(body.lyrics.map(row => String(row.text || '')).join('\n'));
    const rows = body.lyrics.map(row => ({ time: typeof row.time === 'number' ? row.time / 1000 : NaN,
      end: typeof row.time === 'number' && typeof row.duration === 'number' && row.duration > 0 ? (row.time + row.duration) / 1000 : null,
      en: row.text, ru: '', ...(body.type === 'Word' && Array.isArray(row.syllabus) ? { words: row.syllabus.map(word => ({ text: word.text,
        start: typeof word.time === 'number' ? word.time / 1000 : NaN,
        end: typeof word.time === 'number' && typeof word.duration === 'number' ? (word.time + word.duration) / 1000 : NaN })) } : {}) }));
    const lines = finish(rows);
    if (!lines.length) throw new Error('Источник не содержит текста.');
    return lines;
  }
  function lyricsPlusIdentity(body) {
    const selected = body?.processingTime?.selectedSongMetadata || {};
    return { title: selected.title || body?.metadata?.title || '', artist: selected.artist || body?.metadata?.artist || '',
      album: selected.album || body?.metadata?.album || '', isrc: selected.songISRC || '', platformId: selected.songPlatformId || '', source: selected.source || body?.metadata?.source || '' };
  }
  async function fetchLyricsPlus(metadata, options = {}) {
    const query = new URLSearchParams({ title: metadata.title, artist: metadata.artist });
    const directURL = `${LYRICSPLUS}/v2/lyrics/get?${query}`;
    try {
      const body = await request(directURL, options), identity = lyricsPlusIdentity(body);
      if (!recordingMatches(metadata, { song: identity.title, artist: identity.artist })) throw new Error('Источник вернул другую запись.');
      return { data: { song: identity.title, artist: identity.artist }, lines: parseLyricsPlus(body), source: { name: 'LyricsPlus', url: directURL, kind: body.type.toLowerCase(), exactVideo: false }, provider: identity.source };
    } catch (error) { if (error.name === 'AbortError' || error.status === 429) throw error; }
    const catalog = await request(`${LYRICSPLUS}/v1/songlist/search?q=${encodeURIComponent(`${metadata.artist} ${metadata.title}`)}`, options);
    const candidates = (Array.isArray(catalog?.results) ? catalog.results : []).filter(item => recordingMatches(metadata, { song: item.title, artist: item.artist }));
    // A different part, remix, or cover is never a substitute for the requested recording.
    const candidate = candidates.find(item => /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(item.isrc || ''));
    if (!candidate) throw new Error('В каталоге нет точного совпадения песни.');
    const url = `${LYRICSPLUS}/v2/lyrics/get?isrc=${encodeURIComponent(candidate.isrc)}`;
    const body = await request(url, options), identity = lyricsPlusIdentity(body);
    if (!recordingMatches(metadata, { song: identity.title, artist: identity.artist }) || (identity.isrc && identity.isrc !== candidate.isrc)) throw new Error('Источник вернул другую запись.');
    return { data: { song: identity.title, artist: identity.artist }, lines: parseLyricsPlus(body), source: { name: 'LyricsPlus', url, kind: body.type.toLowerCase(), exactVideo: false }, provider: identity.source };
  }
  async function fingerprintLines(lines) {
    const bytes = new TextEncoder().encode(JSON.stringify(lines.map(({ time, end, en, words }) => ({ time, end, en, words: words || [] }))));
    const digest = await global.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  async function loadClipManifest(options) {
    if (!global.location?.href) return null;
    if (!clipManifest) {
      const url = new URL('./assets/music-alignments.json', global.location.href).href;
      clipManifest = request(url, { ...options, timeout: 3000 }).catch(error => {
        clipManifest = null;
        if (error.name === 'AbortError') throw error;
        return null;
      });
    }
    const manifest = await clipManifest;
    checkAbort(options.signal);
    if (manifest?.schema === 1 && manifest.videos && typeof manifest.videos === 'object') return manifest;
    clipManifest = null;
    return null;
  }
  function checkedClipMap(entry, expectedDuration) {
    if (!entry || typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 500
        || typeof entry.artist !== 'string' || !entry.artist.trim() || entry.artist.length > 200
        || !Number.isFinite(entry.duration) || entry.duration <= 0 || entry.duration > MAX_SECONDS
        || (entry.timing !== undefined && !['line', 'word'].includes(entry.timing))
        || (Number.isFinite(expectedDuration) && expectedDuration > 0 && Math.abs(expectedDuration - entry.duration) > 2)
        || !Array.isArray(entry.parts) || !entry.parts.length || entry.parts.length > 6) throw new Error('Некорректная карта клипа.');
    let targetEnd = -1, count = 0;
    for (const part of entry.parts) {
      if (!part || typeof part.title !== 'string' || !part.title.trim() || part.title.length > 500
          || typeof part.artist !== 'string' || !part.artist.trim() || part.artist.length > 200
          || !/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(part.isrc || '') || !/^[a-f\d]{64}$/.test(part.fingerprint || '')
          || !Array.isArray(part.ranges) || !part.ranges.length || part.ranges.length > 100) throw new Error('Некорректная часть клипа.');
      let sourceEnd = -1;
      for (const range of part.ranges) {
        if (++count > 100 || !range || !['sourceStart', 'sourceEnd', 'targetStart', 'confidence'].every(key => Number.isFinite(range[key]))
            || range.sourceStart < 0 || range.sourceStart < sourceEnd || range.sourceEnd <= range.sourceStart || range.sourceEnd > MAX_SECONDS
            || range.targetStart < 0 || range.targetStart < targetEnd || range.confidence < .7 || range.confidence > 1) throw new Error('Некорректный интервал клипа.');
        sourceEnd = range.sourceEnd;
        targetEnd = range.targetStart + range.sourceEnd - range.sourceStart;
        if (targetEnd > entry.duration) throw new Error('Интервал выходит за длительность клипа.');
      }
    }
    return entry;
  }
  function mapClipPart(lines, ranges) {
    return lines.map(line => {
      const range = ranges.find(item => Number.isFinite(line.time) && Number.isFinite(line.end)
        && line.time >= item.sourceStart && line.end <= item.sourceEnd);
      if (!range || line.end <= line.time) throw new Error('У строки нет проверенного интервала клипа.');
      const shift = range.targetStart - range.sourceStart;
      const mapped = { ...line, time: line.time + shift, end: line.end + shift };
      if (line.words) mapped.words = line.words.map(word => {
        if (word.start < range.sourceStart || word.end > range.sourceEnd) throw new Error('У слова нет проверенного интервала клипа.');
        return { ...word, start: word.start + shift, end: word.end + shift };
      });
      return mapped;
    });
  }
  async function getVerifiedMapInfo(videoId, options = {}) {
    try {
      const manifest = await loadClipManifest(options);
      if (!manifest?.videos?.[videoId]) return null;
      checkedClipMap(manifest.videos[videoId], options.videoDuration);
      return { revision: 1 };
    } catch (error) { if (error.name === 'AbortError') throw error; return null; }
  }
  async function fetchVerifiedClip(videoId, metadata, options) {
    const manifest = await loadClipManifest(options), raw = manifest?.videos?.[videoId];
    if (!raw) return null;
    const entry = checkedClipMap(raw, options.videoDuration);
    if (metadata?.artist && !artistMatches(metadata.artist, entry.artist)) throw new Error('Карта относится к другому исполнителю.');
    let rows = [], firstURL;
    for (const part of entry.parts) {
      let url = `${LYRICSPLUS}/v2/lyrics/get?isrc=${encodeURIComponent(part.isrc)}`, body;
      try { body = await request(url, options); }
      catch (error) {
        if (error.status !== 404) throw error;
        url = `${LYRICSPLUS}/v2/lyrics/get?${new URLSearchParams({ title: part.title, artist: part.artist })}`;
        body = await request(url, options);
      }
      firstURL ||= url;
      const identity = lyricsPlusIdentity(body);
      if ((identity.isrc && identity.isrc !== part.isrc) || !recordingMatches(part, { song: identity.title, artist: identity.artist })) throw new Error('Запись карты клипа изменилась.');
      const lines = parseLyricsPlus(body);
      if (await fingerprintLines(lines) !== part.fingerprint) throw new Error('Текст или таймкоды карты клипа изменились.');
      checkAbort(options.signal);
      rows.push(...mapClipPart(lines, part.ranges));
      if (rows.length > MAX_ROWS) throw new Error('В клипе слишком много строк.');
    }
    rows = finish(rows);
    if (entry.timing === 'line') rows = rows.map(({ words, ...line }) => line);
    return { data: { song: entry.title, artist: entry.artist }, lines: rows,
      source: { name: 'LyricsPlus', url: firstURL, kind: timingOf(rows), exactVideo: false },
      alignment: { method: 'audio-correlation', sourceUrl: CLIP_MAP_SOURCE, videoDuration: entry.duration, mapId: videoId, revision: 1 } };
  }
  async function fetchLyrics(videoId, metadata, options = {}) {
    const failures = [];
    try {
      const verified = await fetchVerifiedClip(videoId, metadata, options);
      if (verified) return verified;
    } catch (error) { if (error.name === 'AbortError') throw error; failures.push(error); }
    let exactPlain = null;
    try {
      const data = unwrap(await request(`${UNISON}/lyrics?v=${encodeURIComponent(videoId)}`, options));
      if (data.videoId !== videoId) throw new Error('Источник вернул другую видеозапись.');
      if (metadata?.artist && !artistMatches(metadata.artist, data.artist)) throw new Error('Найденный текст относится к другому исполнителю.');
      const found = { data, lines: parseRecord(data), source: { name: 'Unison', url: `${UNISON}/lyrics/${Number(data.id)}`, kind: data.format, exactVideo: true } };
      if (timingOf(found.lines) !== 'none') return found;
      exactPlain = found;
    } catch (error) { if (error.name === 'AbortError') throw error; failures.push(error); }
    // The exact video can contain several songs. Keep its title as the anchor so a
    // catalog's one individual part can never replace the whole video's lyrics.
    const lookup = exactPlain ? { title: exactPlain.data.song, artist: exactPlain.data.artist } : metadata ? {
      ...metadata, artist: metadata.featuredArtist ? `${metadata.artist}, ${metadata.featuredArtist}` : metadata.artist
    } : null;
    if (lookup?.title && lookup?.artist) {
      const tasks = [async () => {
        const data = unwrap(await request(`${UNISON}/lyrics?song=${encodeURIComponent(lookup.title)}&artist=${encodeURIComponent(lookup.artist)}`, options));
        if (!recordingMatches(lookup, data)) throw new Error('Найденный текст относится к другой песне или исполнителю.');
        return { data, lines: parseRecord(data), source: { name: 'Unison', url: `${UNISON}/lyrics/${Number(data.id)}`, kind: data.format, exactVideo: data.videoId === videoId } };
      }, () => fetchLyricsPlus(lookup, options), async () => {
        const data = await request(`https://lrclib.net/api/get?track_name=${encodeURIComponent(lookup.title)}&artist_name=${encodeURIComponent(lookup.artist)}`,
          { ...options, headers: { 'Lrclib-Client': 'FlowMusic v1.0 (https://flow.woosport.ru)' } });
        if (!recordingMatches(lookup, data)) throw new Error('Найденный текст относится к другой песне или исполнителю.');
        return { data, lines: parseRecord(data), source: { name: 'LRCLIB', url: `https://lrclib.net/api/get/${Number(data.id)}`, kind: data.syncedLyrics ? 'lrc' : 'plain', exactVideo: false } };
      }];
      const results = await Promise.allSettled(tasks.map(task => task()));
      checkAbort(options.signal);
      const matches = [];
      for (const result of results) {
        if (result.status === 'fulfilled') matches.push(result.value);
        else { if (result.reason?.name === 'AbortError') throw result.reason; failures.push(result.reason); }
      }
      const rank = found => timingOf(found.lines) === 'word' ? 3 : timingOf(found.lines) === 'line' ? 2 : found.source.exactVideo ? 1 : 0;
      matches.sort((a, b) => rank(b) - rank(a));
      const timed = matches.find(found => timingOf(found.lines) !== 'none');
      if (timed) return timed;
      if (exactPlain) return exactPlain;
      if (matches.length) return matches[0];
    }
    if (exactPlain) return exactPlain;
    const error = new Error('Не удалось получить текст песни. Можно повторить поиск или вставить свой текст.');
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
    if (!segments.length || segments.length > 100) return null;
    const durations = records.filter(record => Number.isFinite(record.videoDuration) && record.videoDuration > 0 && record.videoDuration <= MAX_SECONDS).map(record => record.videoDuration);
    return { method: 'sponsorblock', segments, ...(knownDuration || durations.length ? { videoDuration: knownDuration || Math.max(...durations) } : {}), sourceUrl };
  }
  function getCache(videoId) {
    try {
      const item = JSON.parse(localStorage.getItem(CACHE + videoId));
      if (!item || item.videoId!==videoId || !Number.isFinite(item.savedAt) || Date.now() - item.savedAt > 86400000 || !item.source?.url || !Array.isArray(item.lines) || !item.lines.length || item.lines.length > MAX_ROWS) return null;
      const sourceURL=new URL(item.source.url);
      if(sourceURL.protocol!=='https:'||!['unison.boidu.dev','lrclib.net','lyricsplus.prjktla.my.id'].includes(sourceURL.hostname))return null;
      if (item.alignment) {
        const alignmentURL = new URL(item.alignment.sourceUrl);
        if (item.alignment.method === 'audio-correlation') {
          if (alignmentURL.href !== CLIP_MAP_SOURCE || item.alignment.mapId !== videoId || item.alignment.revision !== 1
            || !Number.isFinite(item.alignment.videoDuration) || item.alignment.videoDuration <= 0 || item.alignment.videoDuration > MAX_SECONDS) return null;
        } else if (item.alignment.method !== 'sponsorblock' || alignmentURL.origin !== 'https://sponsor.ajay.app'
          || !Array.isArray(item.alignment.segments) || item.alignment.segments.length > 100
          || !item.alignment.segments.every(segment => Array.isArray(segment) && segment.length === 2
            && segment.every(Number.isFinite) && segment[0] >= 0 && segment[1] > segment[0] && segment[1] <= MAX_SECONDS)) return null;
      }
      const lines=finish(item.lines);if(!lines.length)return null;
      return { ...item, lines, timing:timingOf(lines), translationComplete:lines.every(row=>!!row.ru), cached: true };
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
    options = { ...options, deadline: Math.min(options.deadline || Infinity, Date.now() + 45000) };
    let result = options.force ? null : getCache(videoId);
    if (!result) {
      progress(options, 'metadata', 'Определяю песню');
      let metadata;
      try { metadata = await detectMetadata(videoId, options); }
      catch (error) { if (error.name === 'AbortError') throw error; metadata = null; }
      if (metadata) options.onMetadata?.(metadata);
      progress(options, 'lyrics', 'Ищу текст с таймкодами');
      const found = await fetchLyrics(videoId, metadata, options);
      let lines = found.lines, alignment = found.alignment || null;
      const warnings = [];
      const timing = timingOf(lines);
      if (timing === 'none') warnings.push('Текст найден без таймкодов. Перевод доступен, синхронизация по строкам пока отсутствует.');
      if (!alignment && !found.source.exactVideo && timing !== 'none') {
        progress(options, 'lyrics', 'Подстраиваю таймкоды под клип');
        try {
          alignment = await fetchMusicAlignment(videoId, options);
          if (alignment) lines = alignLines(lines, alignment.segments);
        } catch (error) { if (error.name === 'AbortError') throw error; }
        warnings.push(alignment
          ? 'Учтены немузыкальные вставки по разметке сообщества SponsorBlock. Точность совпадения с аудио не проверялась.'
          : 'Таймкоды найдены для другой записи этой песни. У клипа может быть вступление — при необходимости сдвинь текст.');
      }
      result = { videoId, title: found.data.song || found.data.trackName || metadata?.title || 'YouTube', artist: found.data.artist || found.data.artistName || metadata?.artist || '', lines, timing, source: found.source, alignment, warnings, translationComplete: false, cached: false };
      saveCache(videoId, result);
    }
    if (!result.translationComplete) result = await retryTranslate(result, options);
    progress(options, 'done', result.translationComplete ? 'Текст и перевод готовы' : 'Текст готов');
    checkAbort(options.signal);
    saveCache(videoId, result);
    return result;
  }
  global.FlowSongImport = { prepare, retryTranslate, detectMetadata, fetchLyrics, translateUnison, parseLRC, parseTTML, parsePlain, parseLyricsPlus, lyricsPlusIdentity, cleanTitle, recordingMatches, timingOf, fingerprintLines, getVerifiedMapInfo,
    normalizeMusicSegments, mapCatalogTime, alignLines, fetchMusicAlignment };
})(globalThis);
