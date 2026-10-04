/*
 * Голосовой ввод: надиктовать заметку, задачу, что угодно в «+».
 * Пишем звук сами в WAV 16 кГц (его понимает модель, что расшифровывает
 * голосовые в чате), а не через распознавание браузера — в Telegram его нет.
 * Пока идёт запись, внизу плашка с уровнем звука и временем.
 */

const VOICE_MAX = 180; // секунд

let voice = null;

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
async function startVoice(onText, label = "Говорите…") {
  if (voice) return;
  if (!voiceSupported()) { toast("Голос работает в приложении бота"); return; }
  // Звук создаём сразу по нажатию: на Android, созданный позже, он «спит» и молчит.
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (error) { ctx.close().catch(() => {}); try { window.SorokaAndroid?.log?.(`Микрофон: ${error?.name} ${error?.message}`); } catch (_) {} toast(error?.name === "NotAllowedError" ? "Нет доступа к микрофону — разрешите его в настройках" : "Микрофон не включился — попробуйте ещё раз"); return; }
  try { await ctx.resume(); } catch (_) {}
  const source = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const chunks = [];
  let loudest = 0;
  const bar = document.createElement("div");
  bar.className = "voice-bar";
  bar.innerHTML = `<span class="voice-dot"></span><span class="voice-level"><i></i></span><b class="voice-time">0:00</b><small>${esc(label)}</small><button type="button" class="voice-cancel" aria-label="Отменить">${icon("close", "icon-sm")}</button><button type="button" class="voice-done">Готово</button>`;
  document.body.appendChild(bar);
  const started = Date.now();
  node.onaudioprocess = event => {
    const data = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(data));
    let peak = 0;
    for (let i = 0; i < data.length; i += 16) peak = Math.max(peak, Math.abs(data[i]));
    loudest = Math.max(loudest, peak);
    bar.style.setProperty("--level", Math.min(1, peak * 2.5).toFixed(2));
  };
  source.connect(node); node.connect(ctx.destination);
  const timer = setInterval(() => {
    const s = Math.floor((Date.now() - started) / 1000);
    bar.querySelector(".voice-time").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    if (s >= VOICE_MAX) finish(true);
  }, 250);
  try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light"); } catch (_) {}
  const finish = async keep => {
    if (!voice) return;
    voice = null;
    clearInterval(timer);
    node.disconnect(); source.disconnect();
    stream.getTracks().forEach(track => track.stop());
    const rate = ctx.sampleRate;
    ctx.close().catch(() => {});
    if (!keep || !chunks.length) { bar.remove(); return; }
    // Тишину не отправляем: модель на пустой записи может «услышать» что-нибудь своё.
    if (loudest < 0.03) { bar.remove(); toast("Ничего не слышно — проверьте микрофон"); return; }
    bar.classList.add("busy");
    bar.innerHTML = `<span class="live-spin"></span><small>Расшифровываю…</small>`;
    try {
      const answer = await window.sorokaHear(wavBase64(chunks, rate));
      bar.remove();
      const text = String(answer?.text || "").trim();
      if (!text) { toast("Не расслышал — попробуйте ещё раз"); return; }
      onText(text);
    } catch (_) { bar.remove(); toast("Не получилось расшифровать — попробуйте ещё раз"); }
  };
  voice = { finish };
  bar.querySelector(".voice-done").addEventListener("click", () => finish(true));
  bar.querySelector(".voice-cancel").addEventListener("click", () => finish(false));
}

// Микрофон в панели заметки: текст встаёт туда, где курсор (или в конец).
document.addEventListener("click", event => {
  const button = event.target.closest?.("[data-note-voice]");
  if (!button) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const editor = document.querySelector(".note-rich");
  const sel = getSelection();
  const range = editor && sel?.rangeCount && editor.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
  void startVoice(text => {
    const rich = document.querySelector(".note-rich");
    if (!rich) return;
    rich.focus();
    const r = range && rich.contains(range.startContainer) ? range : (() => { const x = document.createRange(); x.selectNodeContents(rich); x.collapse(false); return x; })();
    getSelection().removeAllRanges(); getSelection().addRange(r);
    document.execCommand("insertText", false, (r.startOffset ? " " : "") + text);
    syncRichNote();
  }, "Диктуйте заметку…");
}, true);
