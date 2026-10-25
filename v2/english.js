/*
 * «Английский» — занятие на сегодня, карточки-фразы, разговор с тренером.
 *
 * Одна кнопка «Начать»: приложение само собирает занятие — что пора повторить,
 * три новые фразы текущей ситуации, в конце диалог. Новую фразу сначала
 * показываем (послушать, повторить), а в конце занятия спрашиваем её же —
 * вспомнить сразу после показа полезнее, чем просто перечитать.
 * Ответ можно сказать голосом или написать; проверяет сервер (english.ts):
 * эталон бесплатно, иначе по смыслу моделью. Оценку «не вспомнил / с трудом /
 * легко» ставит человек — по ней FSRS назначает следующий повтор.
 * Без моста — демо-данные, чтобы экран рисовался отдельно.
 */

function enCall(op, args = {}) {
  if (typeof window.sorokaEnglish === "function") return window.sorokaEnglish(op, args);
  return new Promise(done => setTimeout(() => done(enDemo(op, args)), 300));
}
function enDemo(op, args) {
  const sit = { key: "cafe", title: "В кафе", goal: "Заказать, спросить цену, попросить счёт", grammar: "a / an / some · I'd like", tip: "Вежливо просить — I'd like, а не I want.", done: 9, total: 15, role: "barista", opener: "Hi there! What can I get you?" };
  if (op === "today") return { streak: 4, situation: sit, plan: { reviews: 8, fromMistakes: 3, newOnes: 3, minutes: 10 }, stats: { total: 40, learned: 12, mistakes: 9 }, situations: [{ key: "meet", title: "Знакомство" }, { key: "cafe", title: "В кафе" }] };
  if (op === "session") return { situation: sit, items: [
    { id: 1, kind: "new", en: "Can I have the bill, please?", ru: "Можно счёт, пожалуйста?", strength: 0 },
    { id: 2, kind: "review", en: "I'd like a coffee, please.", ru: "Я бы хотел кофе, пожалуйста.", strength: .3, source: "mistake" },
  ] };
  if (op === "check") return { verdict: String(args.answer).toLowerCase().includes("the bill") ? "correct" : "close", correction: "Can I have the bill, please?", explain: "Пропущено the — счёт конкретный, в этом кафе." };
  if (op === "chat") return { reply: "Sure! Small or large?", replyRu: "Конечно! Маленький или большой?", correction: /want/i.test(args.text) ? "I'd like a coffee with milk." : "", explain: /want/i.test(args.text) ? "I want звучит резко — вежливее I'd like." : "" };
  if (op === "phrases") return { items: [{ id: 2, en: "I'd like a coffee, please.", ru: "Я бы хотел кофе", source: "mistake", strength: .25 }, { id: 3, en: "Is there a pharmacy nearby?", ru: "Рядом есть аптека?", source: "lesson", strength: 1, learned: true }], counts: { due: 8, mistakes: 9, learned: 12 } };
  if (op === "progress") return { streak: 4, total: 40, learned: 12, learning: 28, mistakes: 9, days: [...Array(28)].map((_, i) => ({ day: "", count: i % 3 ? 6 : 0 })), situations: [{ key: "meet", title: "Знакомство", done: 15, total: 15 }, { key: "cafe", title: "В кафе", done: 9, total: 15 }] };
  if (op === "speech") return { error: "demo" };
  return { ok: true };
}

const EN_TABS = [["today", "Сегодня"], ["chat", "Разговор"], ["phrases", "Фразы"], ["progress", "Прогресс"]];
const EN_RATINGS = [[1, "Не вспомнил"], [2, "С трудом"], [3, "Легко"]];

function enState() {
  ui.en ||= { tab: "today", today: null, run: null, chat: null, list: null, filter: "due", q: "", progress: null };
  return ui.en;
}
function enRerender() { if (ui.page === "english" || ui.page === "today") render(); }

/** Плитка на «Плане»: напоминание о занятии там, где человек и так смотрит каждый день. */
function enHomeTile() {
  const s = enState();
  if (!s.today || Date.now() - (s.todayAt || 0) > 10 * 60_000) {
    if (!s.todayLoading) { s.todayAt = Date.now(); enLoad("today", "today"); }
    if (!s.today) return "";
  }
  const t = s.today, p = t.plan;
  const fresh = !t.stats.total;
  const left = p.reviews + p.newOnes;
  const title = fresh ? "Начать английский" : left ? `${left} ${enPlural(left, "фраза", "фразы", "фраз")} · ≈ ${p.minutes} мин` : "На сегодня всё";
  const sub = fresh ? "5–10 минут в день · фразы для поездок" : left ? `${esc(t.situation.title)}${t.streak ? ` · серия ${t.streak} ${enPlural(t.streak, "день", "дня", "дней")}` : ""}` : `серия ${t.streak} ${enPlural(t.streak, "день", "дня", "дней")} · можно поговорить`;
  return `<section class="section"><button type="button" class="en-home ${left || fresh ? "" : "done"}" data-action="en-home"><span class="en-step-ic">${icon(left || fresh ? "study" : "check", "icon-sm")}</span><span class="en-home-text"><small>Английский</small><b>${title}</b><span>${sub}</span></span>${icon("arrow", "icon-sm")}</button></section>`;
}
function enLoad(key, op, args = {}) {
  const s = enState();
  if (s[`${key}Loading`]) return;
  s[`${key}Loading`] = true;
  enCall(op, args).then(answer => { if (answer?.error) throw new Error(answer.error); s[key] = answer; s.error = ""; })
    .catch(error => { s.error = String(error?.message || error); })
    .finally(() => {
      s[`${key}Loading`] = false;
      // Поиск: после перерисовки курсор остаётся в поле, а не пропадает.
      const typing = document.activeElement?.id === "en-search";
      enRerender();
      if (typing) { const box = document.getElementById("en-search"); box?.focus(); box?.setSelectionRange(box.value.length, box.value.length); }
    });
}

// ------------------------------------------------------------ звук

const enAudioUrls = new Map();
let enPlayer = null;
async function enSpeak(text, button) {
  if (!text) return;
  button?.classList.add("is-busy");
  try {
    let url = enAudioUrls.get(text);
    if (!url) {
      const answer = await enCall("speech", { text });
      if (!answer?.url) throw new Error(answer?.error || "speech");
      url = answer.url; enAudioUrls.set(text, url);
    }
    enPlayer?.pause();
    enPlayer = new Audio(url);
    await enPlayer.play();
  } catch (_) {
    // Нет озвучки с сервера — голос телефона, если он есть.
    try { const u = new SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = .9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (__) { toast("Озвучка недоступна"); }
  } finally { button?.classList.remove("is-busy"); }
}

// ------------------------------------------------------------ страница

function renderEnglishPage() {
  const s = enState();
  if (s.run) return enRunScreen(s.run);
  const tabs = `<div class="en-tabs" role="tablist">${EN_TABS.map(([key, label]) => `<button type="button" role="tab" class="${s.tab === key ? "active" : ""}" aria-selected="${s.tab === key}" data-action="en-tab" data-tab="${key}">${label}</button>`).join("")}</div>`;
  const body = s.tab === "chat" ? enChatScreen() : s.tab === "phrases" ? enPhrasesScreen() : s.tab === "progress" ? enProgressScreen() : enTodayScreen();
  return `${header("Английский", "", "")}<div class="en-page">${tabs}${body}</div>`;
}

function enTodayScreen() {
  const s = enState();
  if (!s.today) { enLoad("today", "today"); return enWait(); }
  const t = s.today, p = t.plan, sit = t.situation;
  const nothing = !p.reviews && !p.newOnes;
  const step = (ic, title, sub, min) => `<div class="en-step"><span class="en-step-ic">${icon(ic, "icon-sm")}</span><div><b>${title}</b><small>${sub}</small></div><em>${min}</em></div>`;
  const steps = [
    p.reviews ? step("reset", `Повторить ${p.reviews} ${enPlural(p.reviews, "фразу", "фразы", "фраз")}`, p.fromMistakes ? `${p.fromMistakes} из ваших ошибок` : "пора освежить", `${Math.max(1, Math.round(p.reviews * .4))} мин`) : "",
    p.newOnes ? step("spark", `${p.newOnes} ${enPlural(p.newOnes, "новая фраза", "новые фразы", "новых фраз")}`, esc(sit.goal.toLowerCase()), `${p.newOnes} мин`) : "",
    step("mic", `Диалог · ${esc(sit.title)}`, "голосом, с подсказками", "3 мин"),
  ].join("");
  const streak = t.streak ? `<span class="en-streak">${icon("star", "icon-sm")}${t.streak} ${enPlural(t.streak, "день", "дня", "дней")}</span>` : "";
  return `<section class="en-hero"><div class="en-hero-top"><div><h2>${nothing ? "На сегодня всё" : "Занятие на сегодня"}</h2><small>${nothing ? "Новые фразы и повторения появятся завтра" : `≈ ${p.minutes} мин · ${esc(sit.title)}`}</small></div>${streak}</div>
    <div class="en-steps">${steps}</div>
    ${nothing ? `<button class="primary-button en-go" type="button" data-action="en-tab" data-tab="chat">${icon("mic", "icon-sm")}Поговорить</button>` : `<button class="primary-button en-go" type="button" data-action="en-start">Начать</button>`}</section>
    <section class="en-situation"><div class="en-row"><b>${esc(sit.title)}</b><small>${sit.done} из ${sit.total} фраз</small></div><div class="en-bar"><i style="width:${Math.round(sit.done / sit.total * 100)}%"></i></div><p class="en-tip">${icon("study", "icon-sm")}<span><b>${esc(sit.grammar)}.</b> ${esc(sit.tip)}</span></p>
    <label class="en-switch"><span>Ситуация</span><select data-en-situation>${t.situations.map(x => `<option value="${esc(x.key)}" ${x.key === sit.key ? "selected" : ""}>${esc(x.title)}</option>`).join("")}</select></label></section>
    <button class="ghost-button en-free" type="button" data-action="en-tab" data-tab="chat">${icon("message", "icon-sm")}Просто поговорить</button>`;
}

function enWait() { return `<div class="en-wait"><span class="live-spin"></span></div>${enState().error ? `<p class="section-note">${esc(enState().error)}</p>` : ""}`; }
function enPlural(n, one, few, many) { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; }

// ------------------------------------------------------------ занятие

async function enStart() {
  const s = enState();
  s.run = { loading: true, items: [], index: 0, done: 0, ok: 0 };
  render();
  try {
    const answer = await enCall("session");
    // Новая фраза: показ, а в конце — проверка её же (вспомнить сразу после показа).
    const items = [];
    const recalls = [];
    let familiar = 0;
    for (const item of answer.items || []) {
      if (item.kind === "new") { items.push({ ...item, step: "intro" }); recalls.push({ ...item, step: "recall" }); }
      // Знакомые фразы — вперемешку: каждая третья начинается со звука (понять на слух),
      // остальные — сказать самому. Разные стороны одной фразы закрепляют её прочнее.
      else items.push({ ...item, step: item.strength >= .3 && ++familiar % 3 === 0 ? "listen" : "recall" });
    }
    s.run = { items: [...items, ...recalls], index: 0, done: 0, ok: 0, situation: answer.situation, mode: "idle" };
  } catch (error) { s.run = null; toast("Не получилось собрать занятие"); }
  render();
}

function enRunScreen(run) {
  if (run.loading) return `<div class="en-run">${enWait()}</div>`;
  const total = run.items.length;
  if (run.index >= total) return enDoneScreen(run);
  const item = run.items[run.index];
  const bar = `<div class="en-run-top"><button class="icon-button" type="button" data-action="en-quit" aria-label="Закончить">${icon("close", "icon-sm")}</button><div class="en-bar"><i style="width:${Math.round(run.index / total * 100)}%"></i></div><small>${run.index + 1}/${total}</small></div>`;
  if (item.step === "intro") {
    return `<div class="en-run">${bar}<p class="en-kicker">Новая фраза</p><div class="en-card"><div class="en-en"><b>${esc(item.en)}</b><button class="icon-button en-play" type="button" data-action="en-say" data-text="${esc(item.en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button></div><p class="en-ru">${esc(item.ru)}</p>${run.said ? enVerdict(run) : `<p class="section-note">Послушайте и повторите вслух — так фраза запомнится быстрее.</p>`}</div>
      <div class="en-actions"><button class="ghost-button" type="button" data-action="en-speak">${icon("mic", "icon-sm")}Повторить вслух</button><button class="primary-button" type="button" data-action="en-next">Дальше</button></div></div>`;
  }
  if (item.step === "listen") {
    const shown = run.mode === "answered";
    return `<div class="en-run">${bar}<p class="en-kicker">Послушайте и поймите смысл</p>
      <div class="en-listen"><button class="en-mic" type="button" data-action="en-say" data-text="${esc(item.en)}" aria-label="Послушать ещё раз">${icon("play")}</button><small>Нажмите, чтобы послушать ещё раз</small></div>
      ${shown ? `<div class="en-card"><div class="en-en"><b>${esc(item.en)}</b></div><p class="en-ru">${esc(item.ru)}</p></div><p class="en-ask">Поняли на слух?</p><div class="en-rate">${[[1, "Не понял"], [2, "С трудом"], [3, "Понял"]].map(([r, label]) => `<button type="button" data-action="en-rate" data-rating="${r}">${label}</button>`).join("")}</div>`
      : `<div class="en-answer"><button class="primary-button" type="button" data-action="en-reveal">Показать текст</button></div>`}</div>`;
  }
  const answered = run.mode === "answered";
  const writing = run.mode === "write";
  const answer = answered ? `<div class="en-card"><div class="en-en"><b>${esc(run.check?.correction || item.en)}</b><button class="icon-button en-play" type="button" data-action="en-say" data-text="${esc(run.check?.correction || item.en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button></div>${enVerdict(run)}${item.note && run.check?.verdict !== "correct" ? `<p class="en-note">${esc(item.note)}</p>` : ""}</div>` : "";
  const input = writing ? `<form class="en-write" data-en-write><input name="answer" autocomplete="off" autocapitalize="sentences" placeholder="Напишите по-английски" aria-label="Ответ по-английски"><button class="primary-button" type="submit">Проверить</button></form>` : "";
  const controls = answered
    ? `<p class="en-ask">Как вспомнилось?</p><div class="en-rate">${EN_RATINGS.map(([r, label]) => `<button type="button" class="${enSuggested(run) === r ? "suggested" : ""}" data-action="en-rate" data-rating="${r}">${label}</button>`).join("")}</div>`
    : run.checking ? `<div class="en-wait small"><span class="live-spin"></span><small>Проверяю…</small></div>`
    : writing ? `<div class="en-answer"><div class="en-answer-alt"><button class="text-action" type="button" data-action="en-speak">Сказать голосом</button><button class="text-action" type="button" data-action="en-reveal">Показать ответ</button></div></div>`
    : `<div class="en-answer"><button class="en-mic" type="button" data-action="en-speak" aria-label="Сказать по-английски">${icon("mic")}</button><div class="en-answer-alt"><button class="text-action" type="button" data-action="en-write">Написать</button><button class="text-action" type="button" data-action="en-reveal">Показать ответ</button></div></div>`;
  return `<div class="en-run">${bar}<p class="en-kicker">${item.source === "mistake" ? "Из ваших ошибок · " : ""}Скажите по-английски</p><h2 class="en-prompt">${esc(item.ru)}</h2>${answer}${input}${controls}</div>`;
}

function enSuggested(run) {
  const v = run.check?.verdict;
  return v === "correct" ? 3 : v === "close" ? 2 : 1;
}
function enVerdict(run) {
  const c = run.check;
  if (!c) return "";
  const said = run.said ? `<p class="en-said">Вы сказали: «${esc(run.said)}»</p>` : "";
  if (c.verdict === "correct") return `${said}<p class="en-ok">${icon("check", "icon-sm")}Верно</p>`;
  return `${said}${c.explain ? `<p class="en-fix">${esc(c.explain)}</p>` : ""}`;
}

async function enAnswer(text) {
  const run = enState().run;
  if (!run) return;
  const item = run.items[run.index];
  run.said = text; run.checking = true; run.mode = item.step === "intro" ? "idle" : run.mode;
  render();
  try { run.check = await enCall("check", { id: item.id, answer: text }); }
  catch (_) { run.check = { verdict: "unknown", correction: item.en, explain: "Не получилось проверить — сравните сами." }; }
  run.checking = false;
  if (item.step !== "intro") run.mode = "answered";
  render();
  if (item.step !== "intro" || run.check?.verdict === "correct") enSpeak(run.check?.correction || item.en);
}

async function enRate(rating) {
  const s = enState(), run = s.run;
  const item = run.items[run.index];
  const attempt = `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const correct = run.check ? run.check.verdict === "correct" : null;
  run.done++; if (rating >= 3) run.ok++;
  // Не вспомнил — фраза ещё раз в конце этого занятия (один раз).
  if (rating === 1 && !item.again) run.items.push({ ...item, again: true });
  enCall("grade", { id: item.id, rating, answer: run.said || "", correct, attempt }).catch(() => toast("Оценка не сохранилась — проверьте связь"));
  enNext();
}
function enNext() {
  const run = enState().run;
  run.index++; run.mode = "idle"; run.check = null; run.said = ""; run.checking = false;
  render();
  const item = run.items[run.index];
  if (item?.step === "intro" || item?.step === "listen") enSpeak(item.en);
}

function enDoneScreen(run) {
  const sit = run.situation || {};
  enState().today = null;
  return `<div class="en-run en-done"><div class="en-done-mark">${icon("check")}</div><h2>Занятие готово</h2><p class="muted">${run.done} ${enPlural(run.done, "ответ", "ответа", "ответов")} · легко вспомнили ${run.ok}</p>
    <button class="primary-button en-go" type="button" data-action="en-dialog">${icon("mic", "icon-sm")}Диалог · ${esc(sit.title || "разговор")}</button><button class="ghost-button" type="button" data-action="en-quit">Закончить</button></div>`;
}

// ------------------------------------------------------------ разговор

function enChatStart(situationKey) {
  const s = enState();
  const sit = s.today?.situation?.key === situationKey || !situationKey ? s.today?.situation : null;
  s.chat = { situation: situationKey || s.today?.situation?.key || "cafe", title: sit?.title || "", msgs: [], busy: false, typing: false };
  const opener = sit?.opener;
  if (opener) { s.chat.msgs.push({ role: "ai", text: opener }); setTimeout(() => enSpeak(opener), 50); }
}
function enChatScreen() {
  const s = enState();
  if (!s.today) { enLoad("today", "today"); return enWait(); }
  if (!s.chat) enChatStart(s.today.situation.key);
  const c = s.chat;
  const msgs = c.msgs.map((m, i) => m.role === "me"
    ? `<div class="en-bub me">${esc(m.text)}${m.correction ? `<div class="en-fixline">Лучше: <b>${esc(m.correction)}</b>${m.explain ? `<small>${esc(m.explain)}</small>` : ""}</div>` : ""}</div>`
    : `<button type="button" class="en-bub ai" data-action="en-bubble" data-index="${i}">${esc(m.text)}${m.open && m.ru ? `<small>${esc(m.ru)}</small>` : ""}</button>`).join("");
  const input = c.typing ? `<form class="en-write" data-en-chat><input name="text" autocomplete="off" placeholder="Напишите реплику" aria-label="Реплика"><button class="primary-button" type="submit">${icon("arrow", "icon-sm")}</button></form>` : "";
  return `<section class="en-chat"><div class="en-chat-head"><span class="en-step-ic">${icon("message", "icon-sm")}</span><div><b>${esc(c.title || "Разговор")}</b><small>Тренер играет роль · нажмите на реплику — перевод</small></div><button class="text-action" type="button" data-action="en-chat-reset">Заново</button></div>
    <div class="en-msgs">${msgs}${c.busy ? `<div class="en-bub ai typing"><span class="live-spin"></span></div>` : ""}</div>${input}
    <div class="en-chat-controls"><button class="icon-button" type="button" data-action="en-chat-type" aria-label="Написать">${icon("pen", "icon-sm")}</button><button class="en-mic" type="button" data-action="en-chat-speak" aria-label="Сказать">${icon("mic")}</button><button class="icon-button" type="button" data-action="en-chat-ru" aria-label="Спросить по-русски">RU</button></div></section>`;
}
// ------------------------------------------------------------ живой голос
// Ответ тренера приходит кусками PCM (24 кГц) и играется сразу: до первого
// звука ~1–2 с вместо «дождаться всей записи». Звук включаем по нажатию
// (микрофон, «Отправить») — иначе браузер телефона его не пустит.
let enCtx = null, enNextAt = 0, enSources = [];
function enAudioCtx() {
  if (!enCtx) { const C = window.AudioContext || window.webkitAudioContext; if (C) enCtx = new C(); }
  enCtx?.resume?.().catch(() => {});
  return enCtx;
}
function enPlayPcm(b64) {
  const ctx = enAudioCtx();
  if (!ctx) return;
  const bin = atob(b64), n = bin.length >> 1;
  if (!n) return;
  const buffer = ctx.createBuffer(1, n, 24000);
  const ch = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v >= 32768) v -= 65536; ch[i] = v / 32768; }
  const src = ctx.createBufferSource();
  src.buffer = buffer; src.connect(ctx.destination);
  const at = Math.max(ctx.currentTime + 0.06, enNextAt);
  src.start(at); enNextAt = at + buffer.duration; enSources.push(src);
}
function enStopPcm() { enSources.forEach(s => { try { s.stop(); } catch (_) {} }); enSources = []; enNextAt = 0; enPlayer?.pause(); }

async function enChatSend(text) {
  const c = enState().chat;
  if (!c || !text.trim() || c.busy) return;
  const mine = { role: "me", text: text.trim() };
  const history = c.msgs.map(m => ({ role: m.role, text: m.text }));
  c.msgs.push(mine); c.busy = true; c.typing = false;
  enStopPcm();
  render(); enScrollChat();
  const apply = answer => {
    if (answer.correction) { mine.correction = answer.correction; mine.explain = answer.explain; }
    c.msgs.push({ role: "ai", text: answer.reply, ru: answer.replyRu });
    c.busy = false; render(); enScrollChat();
  };
  try {
    if (typeof window.sorokaEnglishStream !== "function") throw new Error("no-stream");
    let got = false;
    await window.sorokaEnglishStream({ situation: c.situation, history, text: mine.text }, (type, data) => {
      if (type === "text") { got = true; apply(data); }
      else if (type === "audio") enPlayPcm(data);
      else if (type === "error" && !got) throw new Error(data.error || "stream");
    });
    if (!got) throw new Error("stream-empty");
  } catch (_) {
    // Без потока: обычный ответ, озвучка следом (файлом).
    try {
      const answer = await enCall("chat", { situation: c.situation, history, text: mine.text });
      apply(answer); enSpeak(answer.reply);
    } catch (__) { c.busy = false; render(); toast("Тренер не ответил — попробуйте ещё раз"); }
  }
}
function enScrollChat() { requestAnimationFrame(() => { const box = document.querySelector(".en-msgs"); if (box) box.scrollTop = box.scrollHeight; window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }); }

// ------------------------------------------------------------ фразы и прогресс

function enPhrasesScreen() {
  const s = enState();
  if (!s.list) { enLoad("list", "phrases", { filter: s.filter, q: s.q }); return enWait(); }
  const k = s.list.counts || {};
  const chip = (key, label, n) => `<button type="button" class="map-category-chip ${s.filter === key ? "active" : ""}" data-action="en-filter" data-filter="${key}">${label}${n !== undefined ? `<span>${n}</span>` : ""}</button>`;
  const rows = (s.list.items || []).map(p => `<div class="en-phrase ${s.open === p.id ? "open" : ""}"><button type="button" class="en-phrase-main" data-action="en-phrase" data-id="${p.id}"><b>${esc(p.en)}</b><small>${esc(p.ru)}${p.source === "mistake" ? " · из ошибки" : ""}</small><span class="en-bar slim"><i class="${p.strength < .34 ? "weak" : ""}" style="width:${Math.max(6, Math.round(p.strength * 100))}%"></i></span></button><button class="icon-button" type="button" data-action="en-say" data-text="${esc(p.en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button>${s.open === p.id ? `<div class="en-phrase-more">${p.note ? `<p>${esc(p.note)}</p>` : ""}<small>${p.learned ? "Закреплено" : p.due ? `Повтор: ${new Date(p.due).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}` : ""}</small><button class="text-action danger" type="button" data-action="en-delete" data-id="${p.id}">Удалить</button></div>` : ""}</div>`).join("");
  return `<label class="notes-search">${icon("search", "icon-sm")}<input id="en-search" type="search" value="${esc(s.q)}" placeholder="Найти фразу или слово" aria-label="Поиск фраз"></label>
    <div class="map-categories en-chips">${chip("due", "Сегодня", k.due)}${chip("mistakes", "Из ошибок", k.mistakes)}${chip("learned", "Закреплено", k.learned)}${chip("all", "Все")}</div>
    <div class="en-phrases">${rows || `<p class="section-note">${s.filter === "due" ? "На сегодня повторять нечего." : "Здесь пока пусто — фразы появятся из занятий и разговоров."}</p>`}</div>`;
}

function enProgressScreen() {
  const s = enState();
  if (!s.progress) { enLoad("progress", "progress"); return enWait(); }
  const p = s.progress;
  const max = Math.max(1, ...p.days.map(d => d.count));
  const metric = (n, label) => `<div class="en-metric"><b>${n}</b><small>${label}</small></div>`;
  return `<section class="en-metrics">${metric(p.streak, enPlural(p.streak, "день подряд", "дня подряд", "дней подряд"))}${metric(p.learned, "закреплено")}${metric(p.learning, "учу сейчас")}</section>
    <section class="en-situation"><div class="en-row"><b>4 недели</b><small>ответов в день</small></div><div class="en-days">${p.days.map(d => `<i title="${esc(d.day)}: ${d.count}" style="height:${Math.round(d.count / max * 100)}%" class="${d.count ? "" : "zero"}"></i>`).join("")}</div></section>
    <section class="en-situation"><div class="en-row"><b>Ситуации</b><small>${p.mistakes} ${enPlural(p.mistakes, "фраза", "фразы", "фраз")} из ошибок</small></div>${p.situations.map(x => `<div class="en-sit-row"><span>${esc(x.title)}</span><div class="en-bar slim"><i style="width:${Math.round(x.done / x.total * 100)}%"></i></div><small>${x.done}/${x.total}</small></div>`).join("")}<p class="section-note">«Закреплено» — когда повтор держится хотя бы три недели.</p></section>`;
}

// ------------------------------------------------------------ действия

function englishAction(action, control) {
  if (!action.startsWith("en-")) return false;
  const s = enState();
  if (action === "en-tab") { s.tab = control.dataset.tab; if (s.tab === "phrases") s.list = null; if (s.tab === "progress") s.progress = null; render(); return true; }
  if (action === "en-start") { enStart(); return true; }
  if (action === "en-home") {
    const left = s.today ? s.today.plan.reviews + s.today.plan.newOnes : 0;
    s.tab = left || !s.today?.stats.total ? "today" : "chat";
    navigate("english");
    if (left) enStart(); else render();
    return true;
  }
  if (action === "en-quit") { s.run = null; s.today = null; render(); return true; }
  if (action === "en-say") { enSpeak(control.dataset.text, control); return true; }
  if (action === "en-speak") { startVoice(text => enAnswer(text), "Скажите по-английски"); return true; }
  if (action === "en-write") { s.run.mode = "write"; render(); setTimeout(() => document.querySelector("[data-en-write] input")?.focus(), 30); return true; }
  if (action === "en-reveal") { const it = s.run.items[s.run.index]; s.run.check = { verdict: "shown", correction: it.en, explain: "" }; s.run.mode = "answered"; render(); if (it.step !== "listen") enSpeak(it.en); return true; }
  if (action === "en-rate") { enRate(Number(control.dataset.rating)); return true; }
  if (action === "en-next") {
    // Показ новой фразы — без оценки: её спросим в конце занятия.
    enNext(); return true;
  }
  if (action === "en-dialog") { const key = s.run?.situation?.key; s.run = null; s.tab = "chat"; s.chat = null; s.today = null; enLoad("today", "today"); if (key) s.pendingChat = key; render(); return true; }
  if (action === "en-chat-speak") { enAudioCtx(); enStopPcm(); startVoice(text => enChatSend(text), "Говорите по-английски или по-русски"); return true; }
  if (action === "en-chat-type") { s.chat.typing = !s.chat.typing; render(); setTimeout(() => document.querySelector("[data-en-chat] input")?.focus(), 30); return true; }
  if (action === "en-chat-ru") { enAudioCtx(); enStopPcm(); startVoice(text => enChatSend(`(по-русски) ${text}`), "Спросите по-русски"); return true; }
  if (action === "en-chat-reset") { s.chat = null; render(); return true; }
  if (action === "en-bubble") { const m = s.chat?.msgs[Number(control.dataset.index)]; if (m) { m.open = !m.open; render(); } return true; }
  if (action === "en-filter") { s.filter = control.dataset.filter; s.list = null; render(); return true; }
  if (action === "en-phrase") { const id = Number(control.dataset.id); s.open = s.open === id ? null : id; render(); return true; }
  if (action === "en-delete") { const id = Number(control.dataset.id); enCall("delete", { id }).then(() => { s.list = null; render(); toast("Фраза удалена"); }); return true; }
  return false;
}

document.addEventListener("submit", event => {
  const write = event.target.closest?.("[data-en-write]");
  const chat = event.target.closest?.("[data-en-chat]");
  if (!write && !chat) return;
  if (chat) enAudioCtx();
  event.preventDefault(); event.stopImmediatePropagation();
  const value = new FormData(event.target).get(write ? "answer" : "text");
  if (write) enAnswer(String(value || "")); else enChatSend(String(value || ""));
}, true);
document.addEventListener("change", event => {
  const select = event.target.closest?.("[data-en-situation]");
  if (!select) return;
  const s = enState();
  enCall("situation", { key: select.value }).then(answer => { s.today = answer; s.chat = null; render(); });
});
let enSearchTimer = null;
document.addEventListener("input", event => {
  if (event.target.id !== "en-search") return;
  const s = enState();
  s.q = event.target.value;
  clearTimeout(enSearchTimer);
  enSearchTimer = setTimeout(() => { s.list = null; enLoad("list", "phrases", { filter: s.filter === "all" ? "" : s.filter, q: s.q }); }, 350);
});
