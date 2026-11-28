import { createAssistantSession, createAssistantDeviceExecutor } from './assistant-session.mjs';
import { renderAssistantAnswer, speechSummary, answerStyles } from './assistant-answer.mjs';
import { attachmentLimits, prepareAttachment } from './assistant-attachments.mjs';
import { getModuleHost } from './runtime-session.js';
import { createPracticeVoice, voiceAvailable } from './glow-practice-voice.mjs';

export function connectGlowAssistant({ upcoming, openRecord, openDocument, openNote, openLegacy, navigationReady = () => true }) {
  const overlay = $('#asx'), heard = $('#asxT'), answer = $('#asxA'), actions = $('#asxC');
  const island = $('#isl'), lock = $('#asLock');
  const form = document.createElement('form');
  let generation = 0, capture = 'idle', opener, speech, adding = false, clearTimer;
  let attachments = [], lastSpeech = '', rest = null;
  const native = () => window.SorokaAndroid;
  const nativePopup = () => native()?.assistantPopup?.() === true;
  const handledRequests = new Set();
  function expandFlow() {
    if (nativePopup()) native().assistantPopupExpand?.();
  }
  const recording = () => capture === 'requesting' || capture === 'listening';
  const motion = () => !reduce && !matchMedia('(prefers-reduced-motion: reduce)').matches;

  const style = document.createElement('style');
  style.textContent = answerStyles + ' ' + [
    '.asx.glow-assistant{justify-content:safe center;overflow:auto}',
    'html[data-glow-assistant-popup],html[data-glow-assistant-popup] body,html[data-glow-assistant-popup] #phone{background:transparent}',
    'html[data-glow-release][data-glow-assistant-popup] #phone.assisting{visibility:visible}',
    'html[data-glow-assistant-popup] .glow-release-status,html[data-glow-assistant-popup] #phone > :is(.status,.env,.screens,.head,.home,.hbar){visibility:hidden}',
    'html[data-glow-assistant-popup] #phone .dock{background:none;border:0;box-shadow:none;pointer-events:none;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}',
    'html[data-glow-assistant-popup] .dock::before,html[data-glow-assistant-popup] .dock::after,html[data-glow-assistant-popup] .dock :is(.tab,.glow){visibility:hidden}',
    'html[data-glow-assistant-popup] #star{pointer-events:auto}',
    '.phone.assisting .glow-assistant.out{opacity:0;pointer-events:none}',
    '.glow-assistant[data-composer] {padding:64px 16px max(118px,calc(max(var(--glow-keyboard,0px),var(--kb,0px)) + 12px));justify-content:safe end;gap:10px}',
    '.glow-assistant [hidden],.glow-assistant :is(.asxt,.asxa,.asxc):empty{display:none!important}',
    '.glow-assistant .asxt,.glow-assistant .asxa,.glow-assistant .asxc,.glow-assistant form{width:100%;max-width:330px;overflow-wrap:anywhere}',
    '.glow-assistant .asxt.done{transform:translateY(-8px) scale(.78)}',
    '.glow-assistant .asxt[data-caption]{font-size:18px;color:var(--muted)}',
    '.glow-assistant .asxa{max-height:42dvh;overflow:auto;--fu-text:var(--text);--fu-accent:var(--a4)}',
    '.glow-assistant .asxa:has(ul,ol){text-align:left}',
    '.glow-assistant .asxc,.glow-a-files{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
    '.glow-assistant .asxc{justify-content:center}',
    '.glow-assistant[data-composer] :is(.asxt,.asxa,.asxc){margin:0}',
    '.glow-assistant .asxcard{width:100%;text-align:left}',
    '.glow-assistant .asxcard .chip{min-width:44px}',
    '.glow-assistant .asxp{margin:0}',
    '.glow-assistant .glow-a-keyboard{position:absolute;bottom:115px;right:16px}',
    '.glow-assistant[data-composer] .glow-a-keyboard{display:none}',
    '.glow-assistant .aw{display:inline-block;white-space:pre-wrap;animation-delay:min(calc(var(--glow-word,0) * 20ms),360ms)}',
    '.glow-assistant .asxt.think .aw{animation-delay:0ms}',
    '.glow-assistant .asxt.think + .asxa{animation:none}',
    '.glow-assistant .asxa:not(:empty){animation:islin .55s var(--ease) both}',
    '.glow-assistant .chip{min-height:44px;height:auto;max-width:100%;text-align:left;white-space:normal}',
    '.glow-assistant .glow-a-form{display:grid;grid-template-columns:minmax(0,1fr) repeat(3,44px);align-items:center;gap:4px;padding:5px;border-radius:20px}',
    '.glow-a-form input:not([type=file]){min-width:0;width:100%;font:inherit;padding:9px;color:var(--text);background:none;border:0}',
    '.glow-a-files{grid-column:1/-1}',
    '.glow-a-form .ib,.glow-a-keyboard{width:44px;height:44px;display:grid;place-items:center;padding:0}',
    '.glow-a-form svg,.glow-a-keyboard svg{width:19px;height:19px}',
    '#star{touch-action:none}',
    '#star.press{scale:1.06}',
    '.phone.assisting .dock .tab{pointer-events:none}',
    '.phone .isl.open .islxb button{width:44px;height:44px}',
    '.phone .isl:not(.open) #islX,.phone .isl.closing #islX{pointer-events:none}',
    '@media (prefers-reduced-motion:reduce){.glow-assistant,.glow-assistant *,#isl,#isl *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}',
    '#isl[data-st="listen"] .islbars i{animation:none;transform:scaleY(calc(.16 + var(--level,0)*var(--gain,1)));transition:transform 90ms linear}',
    '#isl[data-st="listen"] .islbars i:nth-child(2n){--gain:.63}',
    '#isl[data-st="listen"] .islbars i:nth-child(3){--gain:.85}',
    '.phone .isl.open{max-width:calc(100% - 18px)}',
    '.phone .isl.panel #islX{max-height:calc(100dvh - 80px);overflow:auto}',
  ].join('\n');
  document.head.append(style);
  overlay.classList.add('glow-assistant');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Ассистент Flow');
  overlay.removeAttribute('aria-live');
  overlay.inert = true;
  heard.setAttribute('role', 'status');
  answer.classList.add('answer');
  answer.setAttribute('aria-live', 'polite');
  form.className = 'glass glow-a-form';
  form.innerHTML = '<div class="glow-a-files" aria-label="Вложения" hidden></div>'
    + '<input name="prompt" type="text" aria-label="Сообщение для Flow" placeholder="Спросить Flow…" maxlength="4000" autocomplete="off" enterkeyhint="send">'
    + '<button type="button" class="glass ib" data-assistant="file" aria-label="Прикрепить файл">' + ic.plus + '</button>'
    + '<button type="button" class="glass ib" data-assistant="voice" aria-label="Записать голос">' + eic().mic + '</button>'
    + '<button type="submit" class="glass ib" aria-label="Отправить">' + eic().send + '</button>'
    + '<input type="file" multiple hidden accept="image/*,.pdf,.txt,.md,.csv,.json">';
  const keyboardButton = document.createElement('button');
  keyboardButton.type = 'button';
  keyboardButton.className = 'glass ib glow-a-keyboard';
  keyboardButton.setAttribute('aria-label', 'Написать ассистенту');
  keyboardButton.innerHTML = LI('<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M7 10h.01m3.3 0h.01m3.3 0h.01m3.3 0h.01M8 14h8"/>');
  overlay.append(keyboardButton, form);
  form.hidden = true;
  const input = form.elements.prompt, files = $('[type=file]', form), tray = $('.glow-a-files', form);
  const mic = $('[data-assistant=voice]', form), send = $('[type=submit]', form);
  function controls() {
    const busy = AS.state === 'think';
    input.disabled = busy || recording();
    send.disabled = busy || recording() || adding || !input.value.trim() && !attachments.length;
    $('[data-assistant=file]', form).disabled = busy || recording() || adding;
    mic.disabled = !voiceAvailable() || adding || busy;
    mic.innerHTML = recording() ? sic().x : eic().mic;
    mic.setAttribute('aria-label', recording() ? 'Завершить запись' : 'Записать голос');
    keyboardButton.disabled = busy || adding;
  }
  function renderAttachments() {
    tray.replaceChildren();
    tray.hidden = !attachments.length;
    for (const file of attachments) actionButton(file.name + ' ×', () => {
      attachments = attachments.filter(item => item !== file);
      renderAttachments(); controls();
    }, tray);
  }
  const view = () => ({plan:'today', practice:S.prac, savedCat:'saved', pnrun:'piano', enrun:'english', enchat:'english', enread:'english', sprun:'sport'})[curId()] || curId();
  const current = token => token === generation && AS.state !== 'off';
  const active = token => current(token) && !document.hidden;
  const changed = () => {
    ++generation;
    session.cancel();
    voice.cancel();
    stopSpeech();
    capture = 'idle';
    adding = false;
    AS.locked = 0;
    island.style.removeProperty('--level');
  };
  const navigate = section => {
    if (!navigationReady()) return false;
    if (section === 'today') section = 'plan';
    if (['inbox', 'upcoming', 'metrics'].includes(section)) {
      expandFlow(); close(false, false); openLegacy({ assistant: null, page: section, open: null, rid: null }); return true;
    }
    if (!['sport', 'english', 'piano', ...TABS, ...Object.keys(SUBS)].includes(section)) return false;
    expandFlow(); close(false, false); go(section); return true;
  };
  const executor = createAssistantDeviceExecutor({ navigate,
    openRecord: ref => {
      if (!navigationReady()) return false;
      expandFlow(); close(false, false); return openRecord(ref);
    },
    openDocument: id => {
      if (!navigationReady()) return false;
      expandFlow(); close(false, false); return openDocument(id);
    } });
  const session = createAssistantSession(() => getModuleHost('assistant'), {
    canAct: () => AS.state !== 'off' && !document.hidden,
    executeAction: executor,
  });
  function caption(text) {
    heard.className = 'asxt';
    heard.toggleAttribute('data-caption', Boolean(text));
    heard.textContent = text;
  }
  function transcript(text) {
    heard.removeAttribute('data-caption');
    const words = text.match(/\S+\s*/g) || [];
    if (words.length > 36) {
      heard.classList.add('long');
      heard.textContent = text;
      return;
    }
    heard.replaceChildren(...words.map((word, index) => {
      const span = document.createElement('span');
      span.className = 'aw';
      span.style.setProperty('--glow-word', index);
      span.textContent = word;
      return span;
    }));
  }
  const voice = createPracticeVoice((_, state, message) => {
    if (AS.state === 'off') return;
    capture = state;
    if (state !== 'listening') island.style.removeProperty('--level');
    if (state === 'idle' && !message) { controls(); refreshExpandedVoice(); return; }
    if (state === 'idle') {
      caption(message);
      AS.locked = 0;
      asSet('compose');
      showComposer(false);
      islFlash('Не расслышал', true);
    } else {
      caption(state === 'listening' ? 'Слушаю' : message);
      if (state === 'transcribing') heard.classList.add('think');
      asSet(state === 'transcribing' ? 'think' : 'listen');
    }
    controls();
    refreshExpandedVoice();
  });

  function clearScene() {
    attachments = [];
    lastSpeech = '';
    renderAttachments();
    caption('');
    answer.replaceChildren();
    actions.replaceChildren();
    input.value = '';
    form.hidden = true;
    delete overlay.dataset.composer;
    overlay.classList.remove('out', 'res');
  }
  function close(restore = true, dismissPopup = true) {
    if (AS.state === 'off') return;
    overlay.inert = true;
    overlay.classList.add('out');
    asSet('off');
    changed();
    star.classList.remove('live');
    for (const tab of $$('.dock .tab', phone)) tab.inert = false;
    const finish = () => { phone.classList.remove('assisting'); clearScene(); };
    clearTimeout(clearTimer);
    if (motion()) clearTimer = setTimeout(finish, 460);
    else finish();
    if (restore) opener?.focus({ preventScroll: true });
    if (dismissPopup && nativePopup()) native().assistantPopupClose?.();
  }
  function open(source = star) {
    if (phone.classList.contains('homing')) homeSet(false);
    if (ISL.open) islClose();
    if (AS.state !== 'off') return;
    ++generation;
    clearTimeout(clearTimer);
    clearScene();
    opener = source;
    ISL.flash = null;
    overlay.inert = false;
    phone.classList.add('assisting');
    star.classList.add('live');
    for (const tab of $$('.dock .tab', phone)) tab.inert = true;
    asSet('compose');
    controls();
  }
  function showComposer(focus = true) {
    if (recording()) {
      voice.cancel();
      capture = 'idle';
      island.style.removeProperty('--level');
      AS.locked = 0;
      caption('');
      asSet('compose');
    }
    form.hidden = false;
    overlay.dataset.composer = '';
    controls();
    if (focus) input.focus({ preventScroll: true });
    keyboard();
  }
  function reviewDictation(text) {
    AS.locked = 0;
    heard.className = 'asxt';
    transcript(text);
    lastSpeech = '';
    actions.replaceChildren();
    overlay.classList.add('res');
    actionButton('В заметки', () => {
      expandFlow();
      if (openNote(undefined, text)) close(false, false);
    });
    actionButton('Отправить', () => void submit(text, true));
    islFlash('Распознано');
    asSet('result');
  }
  function startVoice() {
    if (adding || recording() || AS.state === 'think') return;
    if (!voiceAvailable()) { caption('Микрофон недоступен'); showComposer(false); return; }
    stopSpeech();
    AS.locked = 0;
    answer.replaceChildren();
    actions.replaceChildren();
    overlay.classList.remove('res');
    const token = generation;
    void voice.start({ kind: 'assistant', active: () => active(token),
      onLevel: level => island.style.setProperty('--level', Math.min(.84, level * 2)),
      onText(text) {
        if (AS.locked) reviewDictation(text);
        else void submit(text, true);
      } });
  }
  function actionButton(title, perform, target = actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'glass chip';
    button.textContent = title;
    button.addEventListener('click', perform);
    target.append(button);
  }
  async function run(work, text, spoken = false, consumeDraft = false) {
    if (AS.state === 'off' || AS.state === 'think' && !spoken) return;
    const token = generation;
    stopSpeech();
    asSet('think');
    heard.className = 'asxt think';
    transcript(text);
    answer.replaceChildren();
    actions.replaceChildren();
    controls();
    try {
      const result = await work();
      if (!active(token)) return;
      heard.className = 'asxt done';
      if (!result.errors?.length && consumeDraft) {
        if (text === input.value.trim()) input.value = '';
        attachments = [];
        renderAttachments();
      }
      renderAssistantAnswer(answer, result.text);
      overlay.classList.add('res');
      lastSpeech = speechSummary(result.text, result);
      const receipt = !result.errors?.length && result.receipts?.find(item => item.changed && /^(task|event|note|list):[1-9]\d*$/.test(item.ref));
      if (receipt) {
        const card = document.createElement('div');
        card.className = 'glass asxcard';
        card.innerHTML = '<span class="ic">' + ic.check + '</span><span><b>Сохранено</b></span>';
        actionButton('Открыть', () => {
          expandFlow();
          if (openRecord(receipt.ref)) close(false, false);
        }, card);
        actions.append(card);
      }
      if (lastSpeech) {
        actionButton('Послушать', playSpeech);
        const listen = actions.lastElementChild;
        listen.className = 'asxp';
        listen.setAttribute('aria-label', 'Послушать');
        listen.innerHTML = eic().say;
      }
      const next = (title, action) => actionButton(title, () => void run(action, title));
      if (result.undo) next('Отменить · ' + result.undo.title, () => session.undo());
      if (result.followUp) next(result.followUp.title || 'Продолжить', () => session.next());
      for (const item of result.operationConfirmations || []) {
        next('Выполнить · ' + item.title, () => session.confirmOperation(item.id));
        next('Не выполнять', () => session.decline());
      }
      for (const item of result.confirmations || []) {
        next('В корзину · ' + item.title, () => session.confirm(item.id));
        next('Оставить', () => session.decline());
      }
      for (const item of result.receipts || []) if (item.commandId) {
        next('Проверить выполнение команды', () => session.command(item.commandId));
      }
      for (const item of result.choices || []) next(item.label, () => session.choose(item.id));
      for (const item of result.sources || []) actionButton(item.title || 'Открыть источник', () => session.source(item.id));
      for (const item of result.activations || []) actionButton('Открыть набор · ' + item.phone, () => {
        void session.activate(item.id).catch(() => { heard.textContent = 'Не удалось открыть номер'; });
      });
      islFlash(result.errors?.length ? 'Проверь ответ' : receipt ? 'Сохранено' : 'Готово', !!result.errors?.length);
      asSet('result');
    } catch (error) {
      if (!active(token)) return;
      heard.className = 'asxt done';
      answer.textContent = /choice_expired|choice_changed/.test(error.message) ? 'Выбор устарел. Повтори запрос.'
        : /action_pending/.test(error.message) ? 'Повтори предыдущий запрос, чтобы проверить результат.'
        : 'Не удалось получить ответ. Попробуй ещё раз.';
      islFlash('Ошибка', true);
      asSet('result');
      if (!input.value && text) input.value = text;
      if (nativePopup()) showComposer(false);
    } finally { if (active(token)) controls(); }
  }
  function submit(text, spoken = false) {
    if (!text && !attachments.length) return;
    return run(() => session.turn(text || 'Посмотри вложение', { section: view() }, attachments), text, spoken, true);
  }
  function stopSpeech() {
    if (!speech) return;
    speech.abort.abort();
    speech.audio?.pause();
    if (speech.url) URL.revokeObjectURL(speech.url);
    speech = null;
  }
  async function playSpeech() {
    if (!lastSpeech || AS.state !== 'result') return;
    const request = speech = { abort: new AbortController() };
    const requestId = crypto.randomUUID();
    asSet('think');
    controls();
    try {
      const host = await getModuleHost('assistant');
      if (speech !== request) return;
      const result = await host.request('speech', { text: lastSpeech, requestId }, { signal: request.abort.signal });
      if (speech !== request || !host.isCurrent()) return;
      if (result.requestId !== requestId || result.mime !== 'audio/mpeg' || typeof result.audio !== 'string') throw Error('speech_invalid');
      request.url = URL.createObjectURL(new Blob([Uint8Array.from(atob(result.audio), c => c.charCodeAt(0))], { type: result.mime }));
      request.audio = new Audio(request.url);
      await new Promise((resolve, reject) => {
        request.abort.signal.addEventListener('abort', resolve, { once: true });
        request.audio.onplaying = () => { if (speech === request) asSet('speak'); };
        request.audio.onended = resolve;
        request.audio.onerror = reject;
        request.audio.play().catch(reject);
      });
    } catch {
      if (speech === request) heard.textContent = 'Не удалось озвучить ответ';
    } finally {
      if (speech === request) { stopSpeech(); asSet('result'); controls(); }
    }
  }

  keyboardButton.onclick = () => showComposer();
  overlay.addEventListener('click', event => {
    if (event.target === overlay) asTap();
  });
  form.onsubmit = event => { event.preventDefault(); void submit(input.value.trim()); };
  input.oninput = controls;
  $('[data-assistant=file]', form).onclick = () => files.click();
  files.onchange = async () => {
    const chosen = Array.from(files.files);
    files.value = '';
    if (!chosen.length || adding) return;
    const token = generation;
    adding = true; controls();
    try {
      const prepared = [...attachments];
      for (const file of chosen.slice(0, attachmentLimits.count)) {
        const item = await prepareAttachment(file);
        if (!current(token)) return;
        if (prepared.some(entry => entry.id === item.id)) continue;
        if (prepared.length >= attachmentLimits.count || prepared.reduce((sum, entry) => sum + entry.size, item.size) > attachmentLimits.total) {
          throw Error('До четырёх вложений общим размером 6 МБ');
        }
        prepared.push(item);
      }
      attachments = prepared; renderAttachments();
    } catch (error) { if (current(token)) heard.textContent = error.message; }
    finally { if (current(token)) { adding = false; controls(); } }
  };
  function finishVoice() {
    if (capture === 'listening') void voice.finish();
    else if (capture === 'requesting') close();
  }
  mic.onclick = () => recording() ? finishVoice() : startVoice();
  const keyboard = () => {
    if (AS.state === 'off') return;
    const viewport = window.visualViewport;
    const bottom = viewport ? viewport.height + viewport.offsetTop : innerHeight;
    overlay.style.setProperty('--glow-keyboard', Math.max(0, phone.getBoundingClientRect().bottom - bottom) + 'px');
    if (document.activeElement === input) input.scrollIntoView({ block: 'nearest' });
  };
  window.visualViewport?.addEventListener('resize', keyboard);
  window.visualViewport?.addEventListener('scroll', keyboard);

  asClose = silent => close(!silent);
  asStart = () => { open(island); startVoice(); };
  asTap = () => {
    if (AS.state === 'off') { open(); startVoice(); }
    else if (recording()) finishVoice();
    else close();
  };
  bindAssistantHold(star, () => AS.state !== 'think' && !adding);
  asHoldStart = (source = island) => {
    if (AS.state === 'think' || adding) return;
    open(source);
    if (!recording()) startVoice();
    if (!recording() || AS.locked) return;
    lock.style.setProperty('--dy', '0px');
    lock.classList.remove('stay', 'locked');
    lock.classList.add('on');
  };
  asHoldDrag = dy => {
    if (!recording() || AS.locked) return;
    lock.style.setProperty('--dy', Math.min(70, Math.max(0, dy)) + 'px');
    if (dy <= 70) return;
    AS.locked = 1;
    lock.classList.add('locked');
    voice.extend();
    buzz([8,30,8]);
    sfx('tick');
    refreshExpandedVoice();
  };
  asHoldEnd = cancelled => {
    if (!recording()) return;
    if (cancelled) { close(); return; }
    if (AS.locked) { lock.classList.add('stay'); return; }
    finishVoice();
  };
  const restTime = () => Math.floor(rest.seconds / 60) + ':' + String(rest.seconds % 60).padStart(2, '0');
  const currentState = islState, compact = islCompact, expanded = islExpanded;
  islState = () => {
    const state = currentState();
    return rest && (state === 'idle' || state === 'render') ? 'timer' : state;
  };
  islCompact = state => rest && state === 'timer'
    ? '<span class="islic ok">' + ic.dumbbell + '</span><b class="isln" data-glow-rest-time>' + restTime() + '</b>' : compact(state);
  const voiceStage = () => AS.locked ? 'Диктовка' : capture === 'requesting' ? 'Подключаю микрофон' : 'Слушаю';
  function refreshExpandedVoice() {
    const title = $('[data-glow-voice-stage]', island);
    if (title) title.textContent = voiceStage();
    const finish = $('[data-isl=voice-finish]', island);
    if (finish) finish.disabled = capture !== 'listening';
  }
  islExpanded = state => {
    if (state === 'listen') return '<div class="islx"><span class="islbig">' + STARG + '</span><span class="islxt"><b data-glow-voice-stage>'
      + voiceStage() + '</b><small>Flow · ассистент</small></span><span class="islxb">'
      + '<button type="button" data-isl="voice-finish" aria-label="Завершить запись"' + (capture === 'listening' ? '' : ' disabled') + '>'
      + ic.check + '</button><button type="button" class="err" data-isl="stop" aria-label="Отменить запись">' + sic().x + '</button></span></div>';
    if (state === 'speak') return '<div class="islx"><span class="islbig">' + STARG + '</span><span class="islxt"><b>Отвечаю</b>'
      + '<small>Flow · ассистент</small></span><span class="islxb"><button type="button" data-isl="voice-stop" aria-label="Остановить озвучивание">'
      + sic().pause + '</button></span></div>';
    if (state !== 'timer' || !rest) return expanded(state);
    return '<div class="islx"><span class="islbig ok">' + ic.dumbbell + '</span><span class="islxt"><b>Отдых · <span data-glow-rest-time>'
      + restTime() + '</span></b><small>' + esc2(rest.exercise) + '</small></span><span class="islxb">'
      + '<button type="button" data-glow-rest-toggle aria-label="' + (rest.paused ? 'Продолжить отсчёт' : 'Пауза отсчёта')
      + '">' + (rest.paused ? spI.play : spI.pause) + '</button></span></div>';
  };
  window.addEventListener('flow:glow-rest', ({ detail }) => {
    const wasPaused = rest?.paused;
    rest = detail;
    islSync();
    if (!rest || ISL.st !== 'timer') return;
    $$('[data-glow-rest-time]', island).forEach(node => { node.textContent = restTime(); });
    const toggle = $('[data-glow-rest-toggle]', island);
    if (toggle && wasPaused !== rest.paused) {
      toggle.innerHTML = rest.paused ? spI.play : spI.pause;
      toggle.setAttribute('aria-label', rest.paused ? 'Продолжить отсчёт' : 'Пауза отсчёта');
    }
  });
  const originalPanel = islPanel;
  islPanel = () => {
    const template = document.createElement('template');
    template.innerHTML = originalPanel();
    const sampleEvents = $$('button[data-isl="plan"]', template.content);
    const heading = sampleEvents[0]?.previousElementSibling;
    if (heading?.classList.contains('ipl')) heading.remove();
    sampleEvents.forEach(row => row.remove());
    const events = upcoming();
    if (events.length) {
      const ask = $('.iask', template.content);
      ask.insertAdjacentHTML('afterend', '<div class="ipl">Ближайшее</div>' + events.map(item =>
        '<button class="irow" data-island-record="' + esc2(item.id) + '"><time>' + esc2(item.time) + '</time><span><b>' + esc2(item.title)
        + '</b><small>' + esc2(item.date) + '</small></span>' + ic.chev + '</button>').join(''));
    }
    const timer = $('[data-isl=q-timer]', template.content);
    if (timer) timer.replaceChildren($('span', timer), document.createTextNode('Спорт'));
    return template.innerHTML;
  };
  island.addEventListener('click', event => {
    if (event.target.closest('[data-glow-rest-toggle]')) {
      event.stopImmediatePropagation();
      rest?.toggle();
      return;
    }
    const button = event.target.closest('[data-isl], [data-island-record]');
    const action = button?.dataset.isl;
    if (!button || !button.dataset.islandRecord && !['ask','voice-finish','voice-stop','q-note','q-timer','sport'].includes(action)) return;
    event.stopImmediatePropagation();
    islClose();
    if (phone.classList.contains('homing')) homeSet(false);
    if (button.dataset.islandRecord) openRecord(button.dataset.islandRecord);
    else if (action === 'ask') asStart();
    else if (action === 'voice-finish') finishVoice();
    else if (action === 'voice-stop') { stopSpeech(); asSet('result'); controls(); }
    else if (action === 'q-note') openNote();
    else go('sport');
  }, true);
  window.sorokaPlannerSession?.subscribe(() => { if (AS.state !== 'off') close(false); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || native()?.assistantPopupFilePicker?.() === true
      || native()?.microphonePermissionPending?.() === true && capture === 'requesting') return;
    if (AS.state === 'think' || AS.state === 'speak') close(false);
    else if (recording()) close(false);
  });
  function syncNativePopup() {
    document.documentElement.toggleAttribute('data-glow-assistant-popup', nativePopup());
  }
  let ready = () => {};
  if (typeof native()?.islandReady === 'function') {
    let lastSignal = '', lastSignalAt = 0;
    function publishNativeSignal() {
      const state = ISL.st;
      const label = ({ listen: 'Слушаю', think: 'Обрабатываю', speak: 'Отвечаю' })[state] || ISL.flash?.label;
      const active = !document.hidden && label && ['listen', 'think', 'speak', 'success', 'error'].includes(state);
      const kind = active ? state : 'idle';
      const visibleLabel = active ? label : 'Flow';
      const now = Date.now();
      const accent = getComputedStyle(phone).getPropertyValue('--a3').trim();
      const key = JSON.stringify([kind, visibleLabel, accent]);
      if (key === lastSignal && (kind === 'idle' || now - lastSignalAt < 5000)) return;
      if (native()?.islandUpdate?.(JSON.stringify({ kind, label: visibleLabel, accent, at: now })) !== false) {
        lastSignal = key;
        lastSignalAt = now;
      }
    }
    const sync = islSync;
    islSync = () => { sync(); publishNativeSignal(); };
    window.flowAssistant = {
      getState: () => ({ open: AS.state !== 'off' }),
      close: () => close(false, false),
    };
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !ISL.open && AS.state === 'off') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (ISL.open) {
        islClose();
        island.focus({ preventScroll: true });
      } else close(true, event.isTrusted);
    }, true);
    window.addEventListener('flow:assistantpopupchange', syncNativePopup);
    window.addEventListener('flow:nativeisland', ({ detail }) => {
      const { id, action, text } = detail || {};
      if (document.hidden || typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(id)
        || !['assistant', 'today', 'render', 'sport'].includes(action)) return;
      if (!handledRequests.has(id)) {
        if (action === 'assistant') {
          syncNativePopup();
          open(island);
          const prompt = typeof text === 'string' ? text.trim().slice(0, 1200) : '';
          if (prompt) void submit(prompt, true);
          else showComposer(false);
        } else {
          if (!navigationReady()) return;
          expandFlow();
          close(false, false);
          go(action === 'today' ? 'plan' : action);
        }
        handledRequests.add(id);
        if (handledRequests.size > 64) handledRequests.delete(handledRequests.values().next().value);
      }
      native()?.islandAck?.(id);
    });
    ready = () => {
      syncNativePopup();
      publishNativeSignal();
      native()?.islandReady?.();
    };
    window.addEventListener('flow:resume', ready);
    ready();
  }
  window.addEventListener('pagehide', () => close(false, false));
  return { open() { open(); showComposer(false); }, ready };
}
