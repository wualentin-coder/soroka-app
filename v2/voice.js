/*
 * Голосовой ввод: надиктовать заметку, задачу, что угодно в «+».
 * Пишем звук сами в WAV 16 кГц (его понимает модель, что расшифровывает
 * голосовые в чате), а не через распознавание браузера — в Telegram его нет.
 * Пока идёт запись, внизу плашка с уровнем звука и временем.
 */

const VOICE_MAX = 180; // секунд

let voice = null;
let voiceGeneration = 0;
let voiceState = "idle";
let voiceLevel = 0;

function voicePublish(state, level = 0) {
  voiceState = state;
  voiceLevel = Math.max(0, Math.min(1, Number(level) || 0));
  document.dispatchEvent(new CustomEvent("flow:voice", { detail: { state, level: voiceLevel } }));
}
function voiceCurrent(session) {
  return voice === session && session.generation === voiceGeneration && !session.cancelled;
}
function voiceRelease(session) {
  if (!session) return;
  clearInterval(session.timer);
  session.timer = null;
  if (session.node) { session.node.onaudioprocess = null; try { session.node.disconnect(); } catch (_) {} }
  try { session.source?.disconnect(); } catch (_) {}
  session.stream?.getTracks().forEach(track => track.stop());
  session.stream = session.node = session.source = null;
  const ctx = session.ctx;
  session.ctx = null;
  if (ctx && ctx.state !== "closed") { try { Promise.resolve(ctx.close()).catch(() => {}); } catch (_) {} }
}
function voiceCancel() {
  const session = voice;
  voiceGeneration++;
  voice = null;
  if (session) { session.cancelled = true; voiceRelease(session); session.bar?.remove(); session.chunks = []; }
  voicePublish("idle");
}
function voiceFail(session, message) {
  const current = voiceCurrent(session);
  voiceRelease(session);
  session.bar?.remove();
  session.chunks = [];
  if (!current) return;
  voice = null;
  voicePublish("error");
  if(typeof session.onError==='function')session.onError(message);else toast(message);
}

function voiceSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia) && typeof window.sorokaHear === "function";
}

function wavBase64(chunks, rate) {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const target = 16000;
  const ratio = rate / target;
  const out = new Int16Array(Math.floor(length / ratio));
  let pos = 0, index = 0;
  const all = new Float32Array(length);
  for (const c of chunks) { all.set(c, pos); pos += c.length; }
  for (let i = 0; i < out.length; i++) {
    // Усредняем отсчёты окна — простой фильтр перед прореживанием.
    const from = Math.floor(i * ratio), to = Math.min(length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = from; j < to; j++) sum += all[j];
    const v = Math.max(-1, Math.min(1, sum / Math.max(1, to - from)));
    out[index++] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const buffer = new ArrayBuffer(44 + out.length * 2);
  const view = new DataView(buffer);
  const str = (o, s) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF"); view.setUint32(4, 36 + out.length * 2, true); str(8, "WAVE"); str(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, target, true); view.setUint32(28, target * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, "data"); view.setUint32(40, out.length * 2, true);
  new Int16Array(buffer, 44).set(out);
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Начать запись; onText получит расшифровку (или ничего, если отменили). */
async function startVoice(onText, label = "Говорите…", options = {}) {
  if (voice) return;
  if (document.hidden) { voicePublish("idle"); return; }
  if (!voiceSupported()) { voicePublish("error"); toast("Голос работает в приложении бота"); return; }
  const session = { generation: ++voiceGeneration, phase: "requesting", ctx: null, stream: null, source: null, node: null, bar: null, timer: null, chunks: [], loudest: 0, cancelled: false, finish: null, onError: options.onError };
  voice = session;
  session.finish = async keep => {
    if (!voiceCurrent(session)) return;
    if (!keep || session.phase === "requesting") { voiceCancel(); return; }
    if (session.phase !== "listening") return;
    session.phase = "transcribing";
    const rate = session.ctx.sampleRate;
    voiceRelease(session);
    if (!session.chunks.length) { voiceCancel(); return; }
    // Тишину не отправляем: модель на пустой записи может «услышать» что-нибудь своё.
    if (session.loudest < 0.03) { voiceFail(session, "Ничего не слышно — проверьте микрофон"); return; }
    session.bar.classList.add("busy");
    session.bar.innerHTML = `<span class="live-spin"></span><small>Расшифровываю…</small>`;
    voicePublish("transcribing");
    let text;
    try {
      const audio = wavBase64(session.chunks, rate);
      session.chunks = [];
      const answer = await window.sorokaHear(audio);
      if (!voiceCurrent(session)) return;
      text = String(answer?.text || "").trim();
      if (!text) { voiceFail(session, "Не расслышал — попробуйте ещё раз"); return; }
    } catch (_) { voiceFail(session, "Не получилось расшифровать — попробуйте ещё раз"); return; }
    session.bar.remove();
    voice = null;
    voicePublish("idle");
    onText(text);
  };
  voicePublish("requesting");
  if (!voiceCurrent(session)) return;
  // Звук создаём сразу по нажатию: на Android, созданный позже, он «спит» и молчит.
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    session.ctx = ctx;
    session.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    if (!voiceCurrent(session) || document.hidden) { voiceRelease(session); if (voiceCurrent(session)) voiceCancel(); return; }
    try { await ctx.resume(); } catch (_) {}
    if (!voiceCurrent(session) || document.hidden) { voiceRelease(session); if (voiceCurrent(session)) voiceCancel(); return; }
    const source = ctx.createMediaStreamSource(session.stream), node = ctx.createScriptProcessor(4096, 1, 1);
    session.source = source; session.node = node;
    const bar = document.createElement("div"); session.bar = bar;
    bar.className = "voice-bar";
    bar.hidden = options.inline === true;
    bar.innerHTML = `<span class="voice-dot"></span><span class="voice-level"><i></i></span><b class="voice-time">0:00</b><small>${esc(label)}</small><button type="button" class="voice-cancel" aria-label="Отменить">${icon("close", "icon-sm")}</button><button type="button" class="voice-done">Готово</button>`;
    document.body.appendChild(bar);
    const started = Date.now();
    session.phase = "listening";
    node.onaudioprocess = event => {
      if (!voiceCurrent(session) || session.phase !== "listening") return;
      const data = event.inputBuffer.getChannelData(0);
      session.chunks.push(new Float32Array(data));
      let peak = 0;
      for (let i = 0; i < data.length; i += 16) peak = Math.max(peak, Math.abs(data[i]));
      session.loudest = Math.max(session.loudest, peak);
      const level = Math.min(1, peak * 2.5);
      bar.style.setProperty("--level", level.toFixed(2));
      voicePublish("listening", level);
    };
    source.connect(node); node.connect(ctx.destination);
    session.timer = setInterval(() => {
      if (!voiceCurrent(session)) return;
      const seconds = Math.floor((Date.now() - started) / 1000);
      bar.querySelector(".voice-time").textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      if (seconds >= VOICE_MAX) void session.finish(true);
    }, 250);
    bar.querySelector(".voice-done").addEventListener("click", () => { void session.finish(true); });
    bar.querySelector(".voice-cancel").addEventListener("click", () => { void session.finish(false); });
    voicePublish("listening");
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light"); } catch (_) {}
  } catch (error) {
    if (!voiceCurrent(session)) { voiceRelease(session); return; }
    try { window.SorokaAndroid?.log?.(`Микрофон: ${error?.name} ${error?.message}`); } catch (_) {}
    voiceFail(session, error?.name === "NotAllowedError" ? "Нет доступа к микрофону — разрешите его в настройках" : "Микрофон не включился — попробуйте ещё раз");
  }
}

window.flowVoice = {
  start: startVoice,
  finish: keep => voice?.finish(Boolean(keep)),
  cancel: voiceCancel,
  getState: () => ({ state: voiceState, level: voiceLevel, active: Boolean(voice), supported: voiceSupported() })
};
document.addEventListener("visibilitychange", () => { if (document.hidden) voiceCancel(); });
window.addEventListener("pagehide", voiceCancel);

// Микрофон в панели заметки: текст встаёт туда, где курсор (или в конец).
document.addEventListener("click", event => {
  const button = event.target.closest?.("[data-note-voice]");
  if (!button) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const editor = document.querySelector(".note-rich");
  if (!editor) return;
  const ownerSheet = typeof ui === "undefined" ? null : ui.sheet;
  const ownerId = ownerSheet?.id, ownerDraft = ownerSheet?.noteDraft;
  const sel = getSelection();
  const range = editor && sel?.rangeCount && editor.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  void startVoice(text => {
    const rich = document.querySelector(".note-rich");
    if (rich !== editor || !editor.isConnected) return;
    if (ownerSheet && (typeof ui === "undefined" || ui.sheet !== ownerSheet || ui.sheet.id !== ownerId || ui.sheet.noteDraft !== ownerDraft)) return;
    rich.focus();
    const r = range && rich.contains(range.startContainer) ? range : (() => { const x = document.createRange(); x.selectNodeContents(rich); x.collapse(false); return x; })();
    getSelection().removeAllRanges(); getSelection().addRange(r);
    document.execCommand("insertText", false, (r.startOffset ? " " : "") + text);
    syncRichNote();
  }, "Диктуйте заметку…");
}, true);
