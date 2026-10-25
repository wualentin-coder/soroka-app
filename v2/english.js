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
  if (op === "lesson") return { situation: sit, steps: [
    { id: 2, en: "I'd like a coffee, please.", ru: "Я бы хотел кофе, пожалуйста.", mode: "recall", section: "Разминка", introduced: true },
    { mode: "theory", section: "Новое", grammar: "a / an / some", theory: { title: "Почему a coffee, но some water", text: "A/an — один исчисляемый предмет. Water — вещество: some water.", examples: [["Can I have some water?", "Можно немного воды?"]] } },
    { id: 1, en: "Can I have the bill, please?", ru: "Можно счёт, пожалуйста?", mode: "intro", section: "Новое" },
    { id: 1, en: "Can I have the bill, please?", ru: "Можно счёт, пожалуйста?", mode: "build", tiles: ["the", "Can", "bill", "have", "please", "I"], section: "Тренировка" },
    { id: 1, en: "Can I have the bill, please?", ru: "Можно счёт, пожалуйста?", mode: "dictation", section: "Аудирование" },
    { id: 1, en: "Can I have the bill, please?", ru: "Можно счёт, пожалуйста?", mode: "recall", section: "Проверка", first: true },
    { mode: "talk", section: "Разговор", goal: sit.goal, title: sit.title, situation: "cafe", targets: ["Can I have the bill, please?"] },
  ] };
  if (op === "word") return { lemma: "latte", ru: "латте", phrase: "a latte", phraseRu: "латте", saved: 1 };
  if (op === "theory") return { key: "cafe", title: "В кафе", heading: "Как заказать и звучать естественно", goal: "Заказать напиток и попросить счёт.", parts: [{ title: "I want и I would like", text: "I want — «я хочу»: звучит прямо. I would like — вежливое «я хотел бы».", examples: [["I'd like a coffee, please.", "Я хотел бы кофе, пожалуйста."]] }] };
  if (op === "practice") {
    const base = [{ id: 1, en: "Can I have the bill, please?", ru: "Можно счёт, пожалуйста?", introduced: true }, { id: 2, en: "I'd like a coffee, please.", ru: "Я бы хотел кофе, пожалуйста.", introduced: true }];
    if (args.mode === "gap") return { mode: "gap", situation: sit, items: [{ ...base[0], text: "Can I have ___ bill, please?", answer: "the", options: ["the", "an"], tip: "Счёт конкретный — the." }] };
    if (args.mode === "build") return { mode: "build", situation: sit, items: [{ ...base[0], tiles: ["the", "Can", "bill,", "have", "please", "I"] }] };
    return { mode: args.mode, situation: sit, items: base };
  }
  return { ok: true };
}

const EN_TABS = [["today", "Сегодня"], ["practice", "Практика"], ["chat", "Разговор"], ["phrases", "Фразы"]];
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
  if (s.ex) return enExScreen(s.ex);
  const tabs = `<div class="en-tabs" role="tablist">${EN_TABS.map(([key, label]) => `<button type="button" role="tab" class="${s.tab === key ? "active" : ""}" aria-selected="${s.tab === key}" data-action="en-tab" data-tab="${key}">${label}</button>`).join("")}</div>`;
  const body = s.tab === "chat" ? enChatScreen() : s.tab === "phrases" ? enPhrasesScreen() : s.tab === "progress" ? enProgressScreen() : s.tab === "practice" ? enPracticeScreen() : enTodayScreen();
  return `${header("Английский", "", "")}<div class="en-page">${tabs}${body}</div>`;
}

function enTodayScreen() {
  const s = enState();
  if (!s.today) { enLoad("today", "today"); return enWait(); }
  const t = s.today, p = t.plan, sit = t.situation;
  const nothing = !p.reviews && !p.newOnes;
  const step = (ic, title, sub) => `<div class="en-step"><span class="en-step-ic">${icon(ic, "icon-sm")}</span><div><b>${title}</b><small>${sub}</small></div></div>`;
  const steps = [
    p.reviews ? step("reset", `Разминка · ${p.reviews} ${enPlural(p.reviews, "фраза", "фразы", "фраз")}`, p.fromMistakes ? `вспомнить; ${p.fromMistakes} из ваших ошибок` : "вспомнить то, что пора повторить") : "",
    p.newOnes ? step("study", "Новое", `${esc(sit.grammar)} · ${p.newOnes} ${enPlural(p.newOnes, "фраза", "фразы", "фраз")}`) : "",
    p.newOnes ? step("grip", "Тренировка и аудирование", "собрать, вставить пропуск, диктант") : "",
    p.newOnes ? step("check", "Проверка", "сказать новые фразы самому") : "",
    step("mic", `Разговор · ${esc(sit.title)}`, "роль-игра с новыми фразами"),
  ].join("");
  const streak = t.streak ? `<span class="en-streak">${icon("star", "icon-sm")}${t.streak} ${enPlural(t.streak, "день", "дня", "дней")}</span>` : "";
  return `<section class="en-hero"><div class="en-hero-top"><div><h2>${nothing ? "На сегодня всё" : "Занятие на сегодня"}</h2><small>${nothing ? "Новые фразы и повторения появятся завтра" : `≈ ${p.minutes} мин · ${esc(sit.title)}`}</small></div>${streak}</div>
    <div class="en-steps">${steps}</div>
    ${nothing ? `<button class="primary-button en-go" type="button" data-action="en-tab" data-tab="chat">${icon("mic", "icon-sm")}Поговорить</button>` : `<button class="primary-button en-go" type="button" data-action="en-start">Начать</button>`}</section>
    <section class="en-situation"><div class="en-row"><b>${esc(sit.title)}</b><small>${sit.done} из ${sit.total} фраз</small></div><div class="en-bar"><i style="width:${Math.round(sit.done / sit.total * 100)}%"></i></div><p class="en-tip">${icon("study", "icon-sm")}<span><b>${esc(sit.grammar)}.</b> ${esc(sit.tip)}</span></p>
    <label class="en-switch"><span>Ситуация</span><select data-en-situation>${t.situations.map(x => `<option value="${esc(x.key)}" ${x.key === sit.key ? "selected" : ""}>${esc(x.title)}</option>`).join("")}</select></label></section>
    <div class="en-today-links"><button class="ghost-button" type="button" data-action="en-ex" data-mode="theory">${icon("study", "icon-sm")}Теория темы</button><button class="ghost-button" type="button" data-action="en-tab" data-tab="progress">${icon("chart", "icon-sm")}Прогресс</button></div>`;
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
// Живой режим: после реплики тренера микрофон слушает сам, пауза ~1,6 с —
// реплика уходит, тренер отвечает голосом, и снова слушаем. Пока тренер
// говорит, микрофон не пишет (чтобы не услышать его же). Нажатие на круг во
// время ответа — перебить. Текст ответа — расшифровка речи самой голосовой
// модели и появляется по словам, когда они звучат.

function enChatStart(situationKey) {
  const s = enState();
  const sit = s.today?.situation?.key === situationKey || !situationKey ? s.today?.situation : null;
  s.chat = { situation: situationKey || s.today?.situation?.key || "cafe", title: sit?.title || "", msgs: [], busy: false, typing: false };
  if (sit?.opener) s.chat.msgs.push({ role: "ai", text: sit.opener, opener: true });
}
const EN_LIVE_LABEL = { off: "Нажмите, чтобы начать разговор", listen: "Слушаю — говорите", hear: "Слышу вас…", think: "Думаю…", speak: "Тренер говорит · нажмите, чтобы перебить" };
function enChatScreen() {
  // Перерисовали чат — окно сообщений остаётся у последней реплики.
  const s = enState();
  const old = document.querySelector(".en-msgs"), count = s.chat?.msgs.length ?? 0;
  const keep = old && s.chat?.seen === count ? old.scrollTop : null;
  if (s.chat) s.chat.seen = count;
  queueMicrotask(() => { const box = document.querySelector(".en-msgs"); if (box) box.scrollTop = keep ?? box.scrollHeight; });
  if (!s.today) { enLoad("today", "today"); return enWait(); }
  if (!s.chat) enChatStart(s.today.situation.key);
  const c = s.chat;
  const live = enLive.state;
  const msgs = c.msgs.map((m, i) => m.role === "me"
    ? `<div class="en-bub me">${esc(m.text)}${m.correction ? `<div class="en-fixline">Лучше: <b>${esc(m.correction)}</b>${m.explain ? `<small>${esc(m.explain)}</small>` : ""}${m.saved ? `<small>В повторениях</small>` : ""}</div>` : ""}</div>`
    : `<div class="en-bub ai" data-action="en-bubble" data-index="${i}"><span class="en-say" data-say="${i}">${m.streaming ? esc(m.shown || "") : enWords(m.text, i)}</span>${m.word ? `<span class="en-wordcard">${m.word.loading ? `<span class="live-spin"></span>` : m.word.error ? "Не получилось перевести" : `<b>${esc(m.word.lemma)}</b> — ${esc(m.word.ru)}${m.word.phrase && m.word.phrase !== m.word.lemma ? `<small>${esc(m.word.phrase)} — ${esc(m.word.phraseRu)}</small>` : ""}<small>${icon("check", "icon-sm")}Добавлено в «Фразы»</small>`}</span>` : ""}${m.open && m.ru ? `<small>${esc(m.ru)}</small>` : ""}</div>`).join("");
  const input = c.typing ? `<form class="en-write" data-en-chat><input name="text" autocomplete="off" placeholder="Напишите реплику" aria-label="Реплика"><button class="primary-button" type="submit">${icon("arrow", "icon-sm")}</button></form>` : "";
  return `<section class="en-chat"><div class="en-chat-head"><span class="en-step-ic">${icon("message", "icon-sm")}</span><div><b>${esc(c.title || "Разговор")}</b><small>Нажмите слово — перевод и в «Фразы»</small></div><button class="text-action" type="button" data-action="en-chat-reset">Заново</button></div>
    <div class="en-msgs">${msgs}${c.busy && !c.msgs.some(m => m.streaming) ? `<div class="en-bub ai typing"><span class="live-spin"></span></div>` : ""}</div>${input}
    <div class="en-live ${live}"><button class="en-orb" type="button" data-action="en-live" aria-label="${esc(EN_LIVE_LABEL[live])}"><i></i>${icon(live === "speak" ? "play" : live === "think" ? "spark" : "mic")}</button><small class="en-live-state">${esc(EN_LIVE_LABEL[live])}</small>
      <div class="en-live-tools"><button class="text-action" type="button" data-action="en-chat-type">${c.typing ? "Скрыть клавиатуру" : "Написать"}</button>${live !== "off" ? `<button class="text-action danger" type="button" data-action="en-live-stop">Закончить</button>` : ""}</div></div></section>`;
}

// ------------------------------------------------------------ живой голос
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
let enTimers = [];
function enStopPcm() { enSources.forEach(x => { try { x.stop(); } catch (_) {} }); enSources = []; enNextAt = 0; enPlayer?.pause(); enTimers.forEach(clearTimeout); enTimers = []; }
/** Когда отзвучит всё, что поставлено в очередь (и файл озвучки), — cb. */
function enWhenQuiet(cb) {
  const check = () => {
    const ctx = enCtx;
    const pcmBusy = ctx && ctx.currentTime < enNextAt - 0.05;
    const fileBusy = enPlayer && !enPlayer.paused && !enPlayer.ended;
    if (pcmBusy || fileBusy) setTimeout(check, 150); else cb();
  };
  setTimeout(check, 250);
}

// Микрофон в живом режиме: слушаем постоянно, пишем от начала речи до паузы.
const enLive = { state: "off", stream: null, node: null, source: null, chunks: [], pre: [], silence: 0, voiced: 0, total: 0 };
function enLiveSet(state) {
  enLive.state = state;
  const box = document.querySelector(".en-live");
  if (box) {
    box.className = `en-live ${state}`;
    const label = box.querySelector(".en-live-state");
    if (label) label.textContent = EN_LIVE_LABEL[state];
  }
}
async function enLiveStart() {
  const ctx = enAudioCtx();
  if (!ctx || !navigator.mediaDevices?.getUserMedia || typeof window.sorokaHear !== "function") { toast("Живой разговор работает в приложении Flow"); return; }
  try { enLive.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch (error) { toast(error?.name === "NotAllowedError" ? "Нет доступа к микрофону — разрешите его в настройках" : "Микрофон не включился"); return; }
  enLive.source = ctx.createMediaStreamSource(enLive.stream);
  enLive.node = ctx.createScriptProcessor(4096, 1, 1);
  enLive.node.onaudioprocess = event => enLiveHear(event.inputBuffer.getChannelData(0), ctx.sampleRate);
  enLive.source.connect(enLive.node); enLive.node.connect(ctx.destination);
  render();
  // Первая реплика тренера (приветствие) ещё не звучала — озвучиваем, потом слушаем.
  const c = enState().chat;
  const first = c?.msgs.length === 1 && c.msgs[0].opener && !c.msgs[0].spoken ? c.msgs[0] : null;
  if (first) { first.spoken = true; enLiveSet("speak"); await enSpeak(first.text); enWhenQuiet(() => enLive.state !== "off" && enLiveSet("listen")); }
  else enLiveSet("listen");
}
function enLiveStop() {
  enLive.node?.disconnect(); enLive.source?.disconnect();
  enLive.stream?.getTracks().forEach(t => t.stop());
  Object.assign(enLive, { stream: null, node: null, source: null, chunks: [], pre: [] });
  enLiveSet("off");
}
function enLiveHear(data, rate) {
  if (enLive.state !== "listen" && enLive.state !== "hear") return;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += data[i] * data[i];
  const rms = Math.sqrt(sum / (data.length / 4));
  const dt = data.length / rate;
  const chunk = new Float32Array(data);
  if (enLive.state === "listen") {
    // Пара кусков до начала речи — чтобы не съесть первый звук.
    enLive.pre.push(chunk); if (enLive.pre.length > 3) enLive.pre.shift();
    if (rms > 0.02) { enLive.chunks = [...enLive.pre]; enLive.pre = []; enLive.silence = 0; enLive.voiced = 0; enLive.total = 0; enLiveSet("hear"); }
    return;
  }
  enLive.chunks.push(chunk);
  enLive.total += dt;
  if (rms > 0.015) { enLive.voiced += dt; enLive.silence = 0; } else enLive.silence += dt;
  document.querySelector(".en-orb i")?.style.setProperty("--level", Math.min(1, rms * 12).toFixed(2));
  if (enLive.silence > 1.6 || enLive.total > 30) {
    const chunks = enLive.chunks; enLive.chunks = [];
    if (enLive.voiced < 0.35) { enLiveSet("listen"); return; } // кашель, шум — не реплика
    enLiveSet("think");
    window.sorokaHear(wavBase64(chunks, rate)).then(answer => {
      const text = String(answer?.text || "").trim();
      if (!text || enLive.state === "off") { if (enLive.state !== "off") enLiveSet("listen"); return; }
      enChatSend(text);
    }).catch(() => { toast("Не расслышал — скажите ещё раз"); if (enLive.state !== "off") enLiveSet("listen"); });
  }
}

/** Реплика тренера словами-кнопками: нажали слово — перевод и в изучение. */
function enWords(text, index) {
  return String(text || "").split(/(\s+)/).map(part => /[A-Za-z]/.test(part)
    ? `<span class="en-w" data-action="en-word" data-index="${index}" data-word="${esc(part.replace(/[^A-Za-z'’-]/g, ""))}">${esc(part)}</span>` : esc(part)).join("");
}

/** Показать кусок ответа тогда, когда он прозвучит. */
function enRevealAt(msg, index, words) {
  const ctx = enCtx;
  const delay = ctx ? Math.max(0, (Math.max(ctx.currentTime, enNextAt) - ctx.currentTime) * 1000) : 0;
  enTimers.push(setTimeout(() => {
    msg.shown = (msg.shown || "") + words;
    const el = document.querySelector(`[data-say="${index}"]`);
    if (el) { el.textContent = msg.shown; enScrollChat(); } else if (ui.page === "english") render();
  }, delay));
}

async function enChatSend(text) {
  const c = enState().chat;
  if (!c || !text.trim() || c.busy) return;
  const mine = { role: "me", text: text.trim() };
  const history = c.msgs.map(m => ({ role: m.role, text: m.text }));
  c.msgs.push(mine); c.busy = true; c.typing = false;
  enStopPcm();
  if (enLive.state !== "off") enLiveSet("think");
  render(); enScrollChat();
  const done = () => {
    c.busy = false;
    enWhenQuiet(() => {
      // Всё отзвучало — показываем текст целиком и снова слушаем.
      const last = c.msgs[c.msgs.length - 1];
      if (last?.role === "ai") { last.shown = last.text; last.streaming = false; }
      if (ui.page === "english") render();
      if (enLive.state !== "off") enLiveSet("listen");
    });
  };
  try {
    if (typeof window.sorokaEnglishStream !== "function") throw new Error("no-stream");
    let ai = null, index = -1;
    await window.sorokaEnglishStream({ situation: c.situation, history, text: mine.text, targets: c.targets || [] }, (type, data) => {
      if (type === "say") {
        if (!ai) { ai = { role: "ai", text: "", shown: "", streaming: true }; c.msgs.push(ai); index = c.msgs.length - 1; render(); if (enLive.state !== "off") enLiveSet("speak"); }
        ai.text += data.text; enRevealAt(ai, index, data.text);
      } else if (type === "audio") enPlayPcm(data);
      else if (type === "fix") { if (data.correction) { Object.assign(mine, { correction: data.correction, explain: data.explain, saved: data.saved }); render(); } }
      else if (type === "reply" && ai) ai.text = data.reply || ai.text;
      else if (type === "ru" && ai) ai.ru = data.ru;
      else if (type === "error" && !ai) throw new Error(data.error || "stream");
    });
    if (!ai) throw new Error("stream-empty");
    done();
  } catch (_) {
    // Без потока: обычный ответ, озвучка следом (файлом).
    try {
      const answer = await enCall("chat", { situation: c.situation, history, text: mine.text });
      if (answer.correction) Object.assign(mine, { correction: answer.correction, explain: answer.explain, saved: answer.saved });
      c.msgs.push({ role: "ai", text: answer.reply, ru: answer.replyRu });
      render(); enScrollChat();
      if (enLive.state !== "off") enLiveSet("speak");
      await enSpeak(answer.reply);
      done();
    } catch (__) { c.busy = false; render(); toast("Тренер не ответил — попробуйте ещё раз"); if (enLive.state !== "off") enLiveSet("listen"); }
  }
}
function enScrollChat() { requestAnimationFrame(() => { const box = document.querySelector(".en-msgs"); if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" }); }); }

// ------------------------------------------------------------ практика
// Теория темы и пять видов упражнений на одних и тех же фразах. Разные пути
// к одной фразе (вспомнить перевод, собрать, вставить пропуск, услышать,
// сказать) закрепляют её прочнее, чем один способ много раз.
const EN_MODES = [
  ["theory", "Теория", "Правила темы с примерами", "study"],
  ["cards", "Карточки", "Вспомнить перевод и оценить", "copy"],
  ["build", "Собери фразу", "Слова по порядку", "grip"],
  ["gap", "Вставь пропуск", "Грамматика: a/an, is/are, do…", "pen"],
  ["dictation", "Диктант", "Услышать и записать", "play"],
  ["translate", "Перевод", "Сказать или написать по-английски", "message"],
];
function enPracticeScreen() {
  const s = enState();
  if (!s.today) { enLoad("today", "today"); return enWait(); }
  const sit = s.today.situation;
  return `<p class="en-practice-sit">${icon("study", "icon-sm")}Тема: <b>${esc(sit.title)}</b> · ${esc(sit.grammar)}</p><div class="en-modes">${EN_MODES.map(([key, title, sub, ic]) => `<button type="button" class="en-mode" data-action="en-ex" data-mode="${key}"><span class="en-step-ic">${icon(ic, "icon-sm")}</span><b>${title}</b><small>${sub}</small></button>`).join("")}</div>
    <p class="section-note">Упражнения берут фразы, которые пора повторить и которые держатся слабее, плюс фразы текущей темы.</p>`;
}

async function enExStart(mode) {
  const s = enState();
  s.ex = { mode, loading: true };
  render();
  try {
    const situation = s.today?.situation?.key || "";
    const data = await enCall(mode === "theory" ? "theory" : "practice", { mode, situation });
    if (data?.error) throw new Error(data.error);
    s.ex = mode === "theory" ? { mode, theory: data } : { mode, situation: data.situation, items: data.items || [], index: 0, ok: 0, done: 0, picked: [], answer: null };
    if (mode !== "theory" && !s.ex.items.length) { s.ex = null; toast("Пока не из чего — пройдите занятие на «Сегодня»"); }
    else if (mode === "dictation") setTimeout(() => enSpeak(s.ex.items[0].en), 200);
  } catch (_) { s.ex = null; toast("Не получилось загрузить упражнение"); }
  render();
}

async function enLessonStart() {
  const s = enState();
  s.ex = { mode: "lesson", loading: true };
  render();
  try {
    const data = await enCall("lesson");
    if (data?.error) throw new Error(data.error);
    s.ex = { mode: "lesson", situation: data.situation, items: data.steps || [], index: 0, ok: 0, done: 0, picked: [], answer: null };
    enLessonEnter();
  } catch (_) { s.ex = null; toast("Не получилось собрать урок"); }
  render();
}
/** Звук при входе в шаг: новая фраза, «на слух», диктант. */
function enLessonEnter() {
  const ex = enState().ex, item = ex?.items[ex.index];
  if (item && ["intro", "listen", "dictation"].includes(item.mode)) setTimeout(() => enSpeak(item.en), 150);
}
const EN_SECTIONS = ["Разминка", "Новое", "Тренировка", "Аудирование", "Проверка", "Разговор"];
function enLessonTop(ex) {
  const present = EN_SECTIONS.filter(name => ex.items.some(i => i.section === name));
  const current = ex.items[ex.index]?.section;
  const at = present.indexOf(current);
  return `<div class="en-sections">${present.map((name, k) => `<span class="${k < at ? "done" : k === at ? "on" : ""}">${name}</span>`).join("")}</div>`;
}

function enExScreen(ex) {
  if (ex.loading) return `<div class="en-run">${enWait()}</div>`;
  if (ex.mode === "theory") return enTheoryScreen(ex.theory);
  const total = ex.items.length;
  if (ex.index >= total) {
    return `<div class="en-run en-done"><div class="en-done-mark">${icon("check")}</div><h2>Готово</h2><p class="muted">Верно ${ex.ok} из ${ex.done}</p>
      <button class="primary-button en-go" type="button" data-action="en-ex" data-mode="${ex.mode}">Ещё раз</button><button class="ghost-button" type="button" data-action="en-ex-quit">К практике</button></div>`;
  }
  const item = ex.items[ex.index];
  const mode = item.mode || ex.mode;
  const lessonRun = ex.mode === "lesson";
  const title = lessonRun ? "" : EN_MODES.find(m => m[0] === mode)?.[1] || "";
  const skip = lessonRun && item.section !== "Разговор" ? `<button class="text-action en-skip" type="button" data-action="en-skip">Пропустить</button>` : `<small>${ex.index + 1}/${total}</small>`;
  const top = `<div class="en-run-top"><button class="icon-button" type="button" data-action="en-ex-quit" aria-label="Закончить">${icon("close", "icon-sm")}</button><div class="en-bar"><i style="width:${Math.round(ex.index / total * 100)}%"></i></div>${skip}</div>${lessonRun ? enLessonTop(ex) : ""}${title ? `<p class="en-kicker">${esc(title)}</p>` : ""}`;
  if (mode === "theory") {
    const t = item.theory || {};
    return `<div class="en-run">${top}<p class="en-kicker">Правило · ${esc(item.grammar || "")}</p><h2 class="en-prompt">${esc(t.title || "")}</h2><section class="en-theory-part"><p>${esc(t.text || "")}</p>${(t.examples || []).map(([en, ru]) => `<div class="en-example"><button class="icon-button en-play" type="button" data-action="en-say" data-text="${esc(en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button><div><b>${esc(en)}</b><small>${esc(ru)}</small></div></div>`).join("")}</section><button class="primary-button en-go" type="button" data-action="en-ex-next">Понятно</button></div>`;
  }
  if (mode === "intro") {
    const a2 = ex.answer;
    return `<div class="en-run">${top}<p class="en-kicker">Новая фраза</p><div class="en-card"><div class="en-en"><b>${esc(item.en)}</b><button class="icon-button en-play" type="button" data-action="en-say" data-text="${esc(item.en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button></div><p class="en-ru">${esc(item.ru)}</p>${a2?.said ? `<p class="en-said">Вы сказали: «${esc(a2.said)}»</p>${a2.verdict === "correct" ? `<p class="en-ok">${icon("check", "icon-sm")}Похоже!</p>` : a2.explain ? `<p class="en-fix">${esc(a2.explain)}</p>` : ""}` : `<p class="section-note">Послушайте и повторите вслух — так фраза запомнится быстрее.</p>`}</div>
      <div class="en-actions"><button class="ghost-button" type="button" data-action="en-intro-speak">${icon("mic", "icon-sm")}Повторить вслух</button><button class="primary-button" type="button" data-action="en-ex-next">Дальше</button></div></div>`;
  }
  if (mode === "listen") {
    const a2 = ex.answer;
    return `<div class="en-run">${top}<p class="en-kicker">Послушайте и поймите смысл</p><div class="en-listen"><button class="en-mic" type="button" data-action="en-say" data-text="${esc(item.en)}" aria-label="Послушать ещё раз">${icon("play")}</button><small>Нажмите, чтобы послушать ещё раз</small></div>
      ${a2 ? `<div class="en-card"><div class="en-en"><b>${esc(item.en)}</b></div><p class="en-ru">${esc(item.ru)}</p></div><p class="en-ask">Поняли на слух?</p><div class="en-rate">${[[1, "Не понял"], [2, "С трудом"], [3, "Понял"]].map(([r, l]) => `<button type="button" data-action="en-ex-rate" data-rating="${r}">${l}</button>`).join("")}</div>` : `<div class="en-answer"><button class="primary-button" type="button" data-action="en-ex-show">Показать текст</button></div>`}</div>`;
  }
  if (mode === "talk") {
    return `<div class="en-run en-done"><div class="en-done-mark">${icon("mic")}</div><h2>Разговор</h2><p class="muted">${esc(item.title)}: ${esc(item.goal)}</p>${ex.done ? `<p class="muted">Ответов за урок: ${ex.done}, верно ${ex.ok}</p>` : ""}
      ${item.targets?.length ? `<div class="en-targets"><small>Постарайтесь сказать:</small>${item.targets.map(t => `<b>${esc(t)}</b>`).join("")}</div>` : ""}
      <button class="primary-button en-go" type="button" data-action="en-talk">${icon("mic", "icon-sm")}Начать разговор</button><button class="ghost-button" type="button" data-action="en-ex-quit">Закончить урок</button></div>`;
  }
  const mo = mode === "recall" ? "translate" : mode;
  const a = ex.answer;
  const next = `<button class="primary-button en-go" type="button" data-action="en-ex-next">Дальше</button>`;
  const result = ok => `<div class="en-card"><div class="en-en"><b>${esc(item.en)}</b><button class="icon-button en-play" type="button" data-action="en-say" data-text="${esc(item.en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button></div><p class="en-ru">${esc(item.ru)}</p>${ok ? `<p class="en-ok">${icon("check", "icon-sm")}Верно</p>` : ""}${a?.explain ? `<p class="en-fix">${esc(a.explain)}</p>` : ""}</div>`;
  if (mo === "cards") {
    return `<div class="en-run">${top}<h2 class="en-prompt">${esc(item.ru)}</h2>${a ? result(false) + `<p class="en-ask">Как вспомнилось?</p><div class="en-rate">${EN_RATINGS.map(([r, l]) => `<button type="button" data-action="en-ex-rate" data-rating="${r}">${l}</button>`).join("")}</div>`
      : `<p class="section-note">Вспомните фразу по-английски — вслух или про себя.</p><div class="en-answer"><button class="primary-button" type="button" data-action="en-ex-show">Показать</button></div>`}</div>`;
  }
  if (mo === "build") {
    const used = new Set(ex.picked);
    const line = ex.picked.map((ti, k) => `<button type="button" class="en-tile on" data-action="en-tile-back" data-k="${k}">${esc(item.tiles[ti])}</button>`).join("");
    const pool = item.tiles.map((w, ti) => used.has(ti) ? `<span class="en-tile ghost">${esc(w)}</span>` : `<button type="button" class="en-tile" data-action="en-tile" data-ti="${ti}">${esc(w)}</button>`).join("");
    return `<div class="en-run">${top}<h2 class="en-prompt">${esc(item.ru)}</h2><div class="en-line ${a ? (a.ok ? "ok" : "bad") : ""}">${line || `<small>Нажимайте слова по порядку</small>`}</div>${a ? result(a.ok) + next : `<div class="en-tiles">${pool}</div>${ex.picked.length ? `<button class="text-action" type="button" data-action="en-tile-clear">Сначала</button>` : ""}`}</div>`;
  }
  if (mo === "gap") {
    const opts = item.options.map(o => `<button type="button" class="en-opt ${a ? (o.toLowerCase() === item.answer ? "right" : o === a.pick ? "wrong" : "") : ""}" data-action="en-gap" data-opt="${esc(o)}" ${a ? "disabled" : ""}>${esc(o)}</button>`).join("");
    return `<div class="en-run">${top}<h2 class="en-prompt en-gap-text">${esc(item.text).replace("___", `<span class="en-blank">${a ? esc(a.pick) : "&nbsp;"}</span>`)}</h2><p class="en-ru">${esc(item.ru)}</p><div class="en-opts">${opts}</div>${a ? `${a.ok ? `<p class="en-ok">${icon("check", "icon-sm")}Верно</p>` : `<p class="en-fix">${esc(item.tip || "")}</p>`}${next}` : ""}</div>`;
  }
  if (mo === "dictation") {
    return `<div class="en-run">${top}<div class="en-listen"><button class="en-mic" type="button" data-action="en-say" data-text="${esc(item.en)}" aria-label="Послушать ещё раз">${icon("play")}</button><small>Послушайте и запишите по-английски</small></div>
      ${a ? `${a.typed ? `<p class="en-said">Вы написали: «${esc(a.typed)}»</p>` : ""}${result(a.ok)}${next}` : `<form class="en-write" data-en-dict><input name="answer" autocomplete="off" autocapitalize="sentences" placeholder="Что вы услышали" aria-label="Что вы услышали"><button class="primary-button" type="submit">Проверить</button></form><button class="text-action" type="button" data-action="en-ex-show">Не разобрал — показать</button>`}</div>`;
  }
  // translate / recall
  return `<div class="en-run">${top}<p class="en-kicker">${item.source === "mistake" ? "Из ваших ошибок · " : ""}Скажите или напишите по-английски</p><h2 class="en-prompt">${esc(item.ru)}</h2>
    ${a ? `${a.said ? `<p class="en-said">Вы сказали: «${esc(a.said)}»</p>` : ""}<div class="en-card"><div class="en-en"><b>${esc(a.correction || item.en)}</b><button class="icon-button en-play" type="button" data-action="en-say" data-text="${esc(a.correction || item.en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button></div>${a.verdict === "correct" ? `<p class="en-ok">${icon("check", "icon-sm")}Верно</p>` : a.explain ? `<p class="en-fix">${esc(a.explain)}</p>` : ""}</div>${next}`
    : ex.checking ? `<div class="en-wait small"><span class="live-spin"></span><small>Проверяю…</small></div>`
    : `<form class="en-write" data-en-tr><input name="answer" autocomplete="off" autocapitalize="sentences" placeholder="Напишите по-английски" aria-label="Перевод"><button class="primary-button" type="submit">Проверить</button></form><div class="en-answer"><button class="en-mic" type="button" data-action="en-tr-speak" aria-label="Сказать">${icon("mic")}</button><button class="text-action" type="button" data-action="en-ex-show">Не помню — показать</button></div>`}</div>`;
}

function enTheoryScreen(t) {
  const parts = (t.parts || []).map(p => `<section class="en-theory-part"><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p>${(p.examples || []).map(([en, ru]) => `<div class="en-example"><button class="icon-button en-play" type="button" data-action="en-say" data-text="${esc(en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button><div><b>${esc(en)}</b><small>${esc(ru)}</small></div></div>`).join("")}</section>`).join("");
  return `<div class="en-run"><div class="en-run-top"><button class="icon-button" type="button" data-action="en-ex-quit" aria-label="Закрыть">${icon("close", "icon-sm")}</button><small>${esc(t.title)}</small></div>
    <h2 class="en-prompt">${esc(t.heading)}</h2><p class="en-ru">${esc(t.goal)}</p>${parts}
    <div class="en-actions"><button class="ghost-button" type="button" data-action="en-ex" data-mode="gap">Вставь пропуск</button><button class="primary-button" type="button" data-action="en-ex" data-mode="build">Собери фразу</button></div></div>`;
}

const enNorm = v => String(v || "").toLowerCase().replace(/[’`]/g, "'").replace(/\bi'm\b/g, "i am").replace(/\b(\w+)n't\b/g, "$1 not").replace(/\bi'd\b/g, "i would").replace(/[.,!?;:"]/g, " ").replace(/\s+/g, " ").trim();

function enExAnswer(ok, extra = {}) {
  const ex = enState().ex;
  const item = ex.items[ex.index];
  ex.answer = { ok, ...extra };
  ex.done++; if (ok) ex.ok++;
  // В расписание — только фразы, которые уже учатся; раньше срока сервер интервал не двигает.
  const mode = item.mode || ex.mode;
  const real = ex.mode === "lesson" && mode === "recall"; // проверка без подсказки — настоящая оценка
  if (item.introduced || real) enCall("grade", { id: item.id, rating: extra.rating ?? (ok ? 3 : 1), answer: extra.typed || extra.said || "", correct: ok, practice: !real, attempt: `${item.id}-${Date.now()}-${ex.index}` }).catch(() => {});
  // Не вспомнили в уроке — ещё раз перед разговором (один раз).
  if (real && !ok && !item.again) { const talk = ex.items.findIndex(i => i.mode === "talk"); ex.items.splice(talk < 0 ? ex.items.length : talk, 0, { ...item, again: true }); }
  render();
  if (ok || ["dictation", "cards"].includes(mode)) enSpeak(item.en);
}
function enExNext() {
  const ex = enState().ex;
  ex.index++; ex.answer = null; ex.picked = []; ex.checking = false;
  render();
  if (ex.mode === "lesson") enLessonEnter();
  else if (ex.items[ex.index] && ex.mode === "dictation") enSpeak(ex.items[ex.index].en);
}

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
  if (action === "en-start") { enLessonStart(); return true; }
  if (action === "en-home") {
    const left = s.today ? s.today.plan.reviews + s.today.plan.newOnes : 0;
    s.tab = left || !s.today?.stats.total ? "today" : "chat";
    navigate("english");
    if (left) enLessonStart(); else render();
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
  if (action === "en-live") {
    if (enLive.state === "off") enLiveStart();
    else if (enLive.state === "speak") { enStopPcm(); enLiveSet("listen"); } // перебить тренера
    return true;
  }
  if (action === "en-live-stop") { enStopPcm(); enLiveStop(); render(); return true; }
  if (action === "en-chat-type") { s.chat.typing = !s.chat.typing; render(); setTimeout(() => document.querySelector("[data-en-chat] input")?.focus(), 30); return true; }
  if (action === "en-chat-reset") { enStopPcm(); enLiveStop(); s.chat = null; render(); return true; }
  if (action === "en-ex") { enExStart(control.dataset.mode); return true; }
  if (action === "en-ex-quit") { const wasLesson = s.ex?.mode === "lesson"; s.ex = null; s.tab = wasLesson ? "today" : "practice"; if (wasLesson) s.today = null; render(); return true; }
  if (action === "en-ex-next") { enExNext(); return true; }
  if (action === "en-ex-show") {
    const ex = s.ex, mode = ex.items[ex.index].mode || ex.mode;
    if (mode === "cards" || mode === "listen") { ex.answer = { ok: false, shown: true }; render(); if (mode === "cards") enSpeak(ex.items[ex.index].en); }
    else enExAnswer(false, { verdict: "shown", rating: 1 });
    return true;
  }
  if (action === "en-skip") { const ex = s.ex, sec = ex.items[ex.index].section; while (ex.index < ex.items.length && ex.items[ex.index].section === sec) ex.index++; ex.answer = null; ex.picked = []; render(); enLessonEnter(); return true; }
  if (action === "en-intro-speak") { startVoice(async text => { const ex = s.ex, item = ex.items[ex.index]; let c; try { c = await enCall("check", { id: item.id, answer: text }); } catch (_) { c = {}; } ex.answer = { said: text, ...c }; render(); }, "Повторите фразу"); return true; }
  if (action === "en-talk") {
    const item = s.ex.items[s.ex.index];
    s.ex = null; s.tab = "chat";
    enChatStart(item.situation); s.chat.targets = item.targets || [];
    render(); enLiveStart();
    return true;
  }
  if (action === "en-ex-rate") {
    const r = Number(control.dataset.rating), ex = s.ex, item = ex.items[ex.index];
    ex.done++; if (r >= 3) ex.ok++;
    const real = ex.mode === "lesson" && (item.mode === "listen" || item.mode === "recall");
    if (item.introduced) enCall("grade", { id: item.id, rating: r, practice: !real, attempt: `${item.id}-${Date.now()}-${ex.index}` }).catch(() => {});
    enExNext(); return true;
  }
  if (action === "en-tile") { const ex = s.ex; ex.picked.push(Number(control.dataset.ti)); const item = ex.items[ex.index]; if (ex.picked.length === item.tiles.length) { const said = ex.picked.map(i => item.tiles[i]).join(" "); enExAnswer(enNorm(said) === enNorm(item.en), { typed: said }); } else render(); return true; }
  if (action === "en-tile-back") { s.ex.picked.splice(Number(control.dataset.k), 1); render(); return true; }
  if (action === "en-tile-clear") { s.ex.picked = []; render(); return true; }
  if (action === "en-gap") { const ex = s.ex; const item = ex.items[ex.index]; const pick = control.dataset.opt; enExAnswer(pick.toLowerCase() === item.answer, { pick }); return true; }
  if (action === "en-tr-speak") { startVoice(text => enTranslate(text, true), "Скажите по-английски"); return true; }
  if (action === "en-bubble") { const m = s.chat?.msgs[Number(control.dataset.index)]; if (m) { m.open = !m.open; render(); } return true; }
  if (action === "en-word") {
    const m = s.chat?.msgs[Number(control.dataset.index)];
    const w = control.dataset.word;
    if (!m || !w) return true;
    m.word = { loading: true };
    render();
    enCall("word", { word: w, sentence: m.text }).then(answer => { m.word = answer?.error ? { error: true } : answer; if (!answer?.error) toast(`«${answer.lemma}» — в «Фразах»`); })
      .catch(() => { m.word = { error: true }; }).finally(() => { render(); });
    return true;
  }
  if (action === "en-filter") { s.filter = control.dataset.filter; s.list = null; render(); return true; }
  if (action === "en-phrase") { const id = Number(control.dataset.id); s.open = s.open === id ? null : id; render(); return true; }
  if (action === "en-delete") { const id = Number(control.dataset.id); enCall("delete", { id }).then(() => { s.list = null; render(); toast("Фраза удалена"); }); return true; }
  return false;
}

function enExAnswerSilent(ok) { const ex = enState().ex; ex.done++; if (ok) ex.ok++; }
async function enTranslate(text, spoken) {
  const ex = enState().ex;
  const item = ex.items[ex.index];
  ex.checking = true; render();
  let c;
  try { c = await enCall("check", { id: item.id, answer: text }); } catch (_) { c = { verdict: "unknown", correction: item.en, explain: "" }; }
  ex.checking = false;
  enExAnswer(c.verdict === "correct", { ...c, [spoken ? "said" : "typed"]: text, rating: c.verdict === "correct" ? 3 : c.verdict === "close" ? 2 : 1 });
}
document.addEventListener("submit", event => {
  const dict = event.target.closest?.("[data-en-dict]");
  const tr = event.target.closest?.("[data-en-tr]");
  if (dict || tr) {
    event.preventDefault(); event.stopImmediatePropagation();
    const value = String(new FormData(event.target).get("answer") || "").trim();
    if (!value) return;
    if (tr) { enTranslate(value, false); return; }
    const item = enState().ex.items[enState().ex.index];
    enExAnswer(enNorm(value) === enNorm(item.en), { typed: value });
    return;
  }
}, true);
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

// Ушли из раздела — живой микрофон выключаем (иначе он слушал бы на других экранах).
window.addEventListener("hashchange", () => { if (!location.hash.includes("english") && enLive.state !== "off") { enStopPcm(); enLiveStop(); } });
document.addEventListener("visibilitychange", () => { if (document.hidden && enLive.state !== "off") { enStopPcm(); enLiveStop(); } });
