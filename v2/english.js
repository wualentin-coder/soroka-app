/*
 * «Английский» — курс A1 → B2, колода 5000 частотных слов, разговор с тренером.
 *
 * Одна кнопка «Начать»: занятие собирает сервер (english.ts) — слова
 * (повторить и новые, свайп «знаю / не знаю»), повторение фраз, правило урока,
 * упражнения, диктант, проверка без подсказки и разговор по теме урока.
 * Урок засчитывается от 70% верных — иначе завтра он же, с другими
 * предложениями. Ответ можно сказать голосом или написать; проверяет сервер:
 * эталон бесплатно, иначе по смыслу моделью.
 * Без моста — демо-данные, чтобы экран рисовался отдельно.
 */

function enCall(op, args = {}) {
  if (typeof window.sorokaEnglish === "function") return window.sorokaEnglish(op, args);
  return new Promise(done => setTimeout(() => done(enDemo(op, args)), 300));
}
function enDemo(op, args) {
  const topic = { title: "Прошедшие выходные", goal: "Рассказать, что вы делали в выходные", role: "friend", opener: "Good morning! How was your weekend? What did you do?" };
  const unit = { key: "a1-past", index: 9, number: 10, total: 42, level: "A1", title: "Выходные", grammar: "Past Simple: worked, went", topic, status: "current", score: null, parts: 2 };
  const w = (id, en, ru, pos, ex, exRu, level, status = "new") => ({ id, en, ru, pos, ex, exRu, ipa: "", level, status, isNew: status === "new", strength: 0 });
  const fresh = [w(312, "pick", "выбирать, собирать", "гл.", "Pick a card, any card.", "Выбери карту, любую.", "A2"), w(313, "wall", "стена", "сущ.", "The picture is on the wall.", "Картина на стене.", "A1"), w(314, "dream", "мечта, сон", "сущ., гл.", "I had a strange dream.", "Мне приснился странный сон.", "A2"), w(315, "sell", "продавать", "гл.", "They sell fresh bread here.", "Здесь продают свежий хлеб.", "A1")];
  const due = [w(120, "still", "всё ещё", "нареч.", "Are you still at work?", "Ты всё ещё на работе?", "A2", "learning")];
  if (op === "today") return { streak: 4, unit, plan: { wordReviews: 12, newWords: 10, phraseReviews: 4, fromMistakes: 2, minutes: 16, doneToday: false }, words: { known: 1240, total: 4380, learning: 36, seen: 1300 }, placed: null };
  if (op === "deck") return { due, fresh, newGoal: 3 };
  if (op === "words") return { total: 4380, known: 1240, learning: 36, seen: 1300, perDay: 9.5, forecast: "2027-09-01", newWords: 10, placed: null, bands: [{ from: 1, to: 1000, known: 860, size: 1000 }, { from: 1001, to: 2000, known: 310, size: 1000 }, { from: 2001, to: 3000, known: 60, size: 1000 }, { from: 3001, to: 4000, known: 10, size: 1000 }, { from: 4001, to: 4380, known: 0, size: 380 }] };
  if (op === "wordlist") return { items: [...due, w(1, "the", "определённый артикль", "артикль", "", "", "A1", "known")] };
  if (op === "placement") return { items: [...fresh, ...due].map((x, i) => ({ ...x, layer: [[1, 500], [501, 1000], [1001, 2000], [2001, 3000], [3001, 4380]][i % 5] })) };
  if (op === "placed") return { estimate: 1650, level: "A2", unit: { ...unit, key: "a2-compare", number: 13, title: "Выбор и покупки", grammar: "Сравнение", level: "A2" } };
  if (op === "course") return { current: 9, units: [...Array(42)].map((_, i) => ({ key: `u${i}`, number: i + 1, level: i < 12 ? "A1" : i < 24 ? "A2" : i < 34 ? "B1" : "B2", title: `Урок ${i + 1}`, grammar: i === 9 ? unit.grammar : "Тема", status: i < 9 ? "done" : i === 9 ? "current" : "next", score: i < 9 ? .85 : null })) };
  if (op === "check") return { verdict: String(args.answer).toLowerCase().includes("went") ? "correct" : "close", correction: "We went to the country.", explain: "Go в прошедшем — went." };
  if (op === "chat") return { reply: "Sounds great! Where did you go?", replyRu: "Звучит здорово! Куда вы ездили?", correction: "", explain: "" };
  if (op === "phrases") return { items: [{ id: 2, en: "I'd like a coffee, please.", ru: "Я бы хотел кофе", source: "mistake", strength: .25 }], counts: { due: 4, mistakes: 9, learned: 12 } };
  if (op === "progress") return { streak: 4, days: [...Array(28)].map((_, i) => ({ day: "", count: i % 3 ? 20 : 0 })), words: enDemo("words"), phrases: { total: 60, learned: 14, mistakes: 9 }, course: { done: 9, total: 42, level: "A1", passed: 9 } };
  if (op === "speech") return { error: "demo" };
  if (op === "swipe" || op === "grade" || op === "newwords") return { ok: true };
  if (op === "unitdone") return { passed: args.score >= .7, advanced: args.score >= .7, next: { number: 11, title: "Поездка", grammar: "did в вопросах" } };
  if (op === "lesson") return { unit, steps: [
    { mode: "words", section: "Слова", due, fresh, newGoal: 2 },
    { id: 2, en: "I'd like a coffee, please.", ru: "Я бы хотел кофе, пожалуйста.", mode: "recall", section: "Разминка", introduced: true },
    { mode: "theory", section: "Правило", grammar: unit.grammar, theory: { title: "Правильные глаголы: -ed", text: "Большинство глаголов в прошедшем получают -ed: work → worked.", examples: [["I watched a film.", "Я посмотрел фильм."]] } },
    { id: 5, en: "We went to the country.", ru: "Мы ездили за город.", mode: "gap", text: "We ___ to the country.", answer: "went", options: ["goed", "went", "gone"], tip: unit.grammar, section: "Тренировка" },
    { id: 6, en: "She bought a new dress.", ru: "Она купила новое платье.", mode: "build", tiles: ["new", "She", "dress", "a", "bought"], section: "Тренировка" },
    { id: 6, en: "She bought a new dress.", ru: "Она купила новое платье.", mode: "dictation", section: "Аудирование" },
    { id: 5, en: "We went to the country.", ru: "Мы ездили за город.", mode: "recall", section: "Проверка", first: true },
    { mode: "talk", section: "Разговор", situation: unit.key, title: topic.title, goal: topic.goal, grammar: unit.grammar, targets: ["We went to the country."] },
  ] };
  if (op === "word") return { lemma: "weekend", ru: "выходные", phrase: "last weekend", phraseRu: "в прошлые выходные", deck: 900 };
  if (op === "theory") return { key: unit.key, title: "Урок 10 · A1", heading: unit.grammar, goal: unit.title, parts: [{ title: "Правильные глаголы: -ed", text: "Большинство глаголов в прошедшем получают -ed.", examples: [["I watched a film.", "Я посмотрел фильм."]] }] };
  if (op === "practice") {
    const base = [{ id: 5, en: "We went to the country.", ru: "Мы ездили за город.", introduced: true }, { id: 6, en: "She bought a new dress.", ru: "Она купила новое платье.", introduced: true }];
    if (args.mode === "gap") return { mode: "gap", unit, items: [{ ...base[0], text: "We ___ to the country.", answer: "went", options: ["goed", "went", "gone"], tip: unit.grammar }] };
    if (args.mode === "build") return { mode: "build", unit, items: [{ ...base[1], tiles: ["new", "She", "dress", "a", "bought"] }] };
    return { mode: args.mode, unit, items: base };
  }
  return { ok: true };
}

const EN_TABS = [["today", "Сегодня"], ["words", "Слова"], ["course", "Курс"], ["chat", "Разговор"], ["phrases", "Фразы"]];
const EN_RATINGS = [[1, "Не вспомнил"], [2, "С трудом"], [3, "Легко"]];
const EN_TOTAL = 4380;

function enState() {
  ui.en ||= { tab: "today", today: null, chat: null, list: null, filter: "due", q: "", progress: null, course: null, words: null, wordlist: null, wfilter: "learning", wq: "" };
  return ui.en;
}
function enRerender() { if (ui.page === "english" || ui.page === "today") render(); }
function enPlural(n, one, few, many) { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; }
function enWait() { return `<div class="en-wait"><span class="live-spin"></span></div>${enState().error ? `<p class="section-note">${esc(enState().error)}</p>` : ""}`; }
const enNum = n => Number(n || 0).toLocaleString("ru-RU");

/** Плитка на «Плане»: напоминание о занятии там, где человек и так смотрит каждый день. */
function enHomeTile() {
  const s = enState();
  if (!s.today || Date.now() - (s.todayAt || 0) > 10 * 60_000) {
    if (!s.todayLoading) { s.todayAt = Date.now(); enLoad("today", "today"); }
    if (!s.today) return "";
  }
  const t = s.today, done = t.plan.doneToday;
  const title = done ? "Урок пройден" : `Урок ${t.unit.number} · ≈ ${t.plan.minutes} мин`;
  const sub = `${enNum(t.words.known)} из ${enNum(t.words.total)} слов${t.streak ? ` · серия ${t.streak} ${enPlural(t.streak, "день", "дня", "дней")}` : ""}`;
  return `<section class="section"><button type="button" class="en-home ${done ? "done" : ""}" data-action="en-home"><span class="en-step-ic">${icon(done ? "check" : "study", "icon-sm")}</span><span class="en-home-text"><small>Английский</small><b>${title}</b><span>${sub}</span></span>${icon("arrow", "icon-sm")}</button></section>`;
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
      const typing = document.activeElement?.id;
      enRerender();
      if (typing === "en-search" || typing === "en-wsearch") { const box = document.getElementById(typing); box?.focus(); box?.setSelectionRange(box.value.length, box.value.length); }
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
  if (s.deck) return `<div class="en-run">${s.deck.loading ? enWait() : enDeckTop(s.deck) + enDeckScreen(s.deck)}</div>`;
  if (s.ex) return enExScreen(s.ex);
  const tabs = `<div class="en-tabs" role="tablist">${EN_TABS.map(([key, label]) => `<button type="button" role="tab" class="${s.tab === key ? "active" : ""}" aria-selected="${s.tab === key}" data-action="en-tab" data-tab="${key}">${label}</button>`).join("")}</div>`;
  const body = s.tab === "chat" ? enChatScreen() : s.tab === "phrases" ? enPhrasesScreen() : s.tab === "progress" ? enProgressScreen()
    : s.tab === "words" ? enWordsScreen() : s.tab === "course" ? enCourseScreen() : enTodayScreen();
  return `${header("Английский", "", "")}<div class="en-page">${tabs}${body}</div>`;
}

function enTodayScreen() {
  const s = enState();
  if (!s.today) { enLoad("today", "today"); return enWait(); }
  const t = s.today, p = t.plan, u = t.unit;
  const step = (ic, title, sub) => `<div class="en-step"><span class="en-step-ic">${icon(ic, "icon-sm")}</span><div><b>${title}</b><small>${sub}</small></div></div>`;
  const steps = [
    step("card", `Слова · ${p.newWords} ${enPlural(p.newWords, "новое", "новых", "новых")}`, p.wordReviews ? `и ${p.wordReviews} повторить · свайп «знаю / не знаю»` : "свайп «знаю / не знаю» — знакомые пролетают"),
    p.phraseReviews ? step("reset", `Разминка · ${p.phraseReviews} ${enPlural(p.phraseReviews, "фраза", "фразы", "фраз")}`, p.fromMistakes ? `вспомнить; ${p.fromMistakes} из ваших ошибок` : "вспомнить то, что пора повторить") : "",
    step("study", `Урок ${u.number} · ${esc(u.grammar)}`, "правило, упражнения, диктант, проверка"),
    step("mic", `Разговор · ${esc(u.topic.title)}`, "голосом, с новыми словами и грамматикой"),
  ].join("");
  const streak = t.streak ? `<span class="en-streak">${icon("star", "icon-sm")}${t.streak} ${enPlural(t.streak, "день", "дня", "дней")}</span>` : "";
  const place = t.placed ? "" : `<section class="en-place"><div><b>Узнайте свой уровень</b><small>40 слов свайпом, 3 минуты: сколько слов вы уже знаете и с какого урока начать</small></div><button class="primary-button" type="button" data-action="en-place">Пройти</button></section>`;
  const wordsPct = Math.round(t.words.known / t.words.total * 100);
  return `${place}<section class="en-hero"><div class="en-hero-top"><div><h2>${p.doneToday ? "Урок пройден" : "Занятие на сегодня"}</h2><small>${p.doneToday ? "Можно повторить слова или поговорить" : `≈ ${p.minutes} мин · ${u.level}`}</small></div>${streak}</div>
    <div class="en-steps">${steps}</div>
    <button class="primary-button en-go" type="button" data-action="en-start">${p.doneToday ? "Ещё занятие" : "Начать"}</button></section>
    <div class="en-goals">
      <button type="button" class="en-goal" data-action="en-tab" data-tab="words"><small>Слова</small><b>${enNum(t.words.known)} <span>из ${enNum(t.words.total)}</span></b><div class="en-bar slim"><i style="width:${Math.max(2, wordsPct)}%"></i></div></button>
      <button type="button" class="en-goal" data-action="en-tab" data-tab="course"><small>Курс · ${u.level}</small><b>${u.number} <span>из ${u.total}</span></b><div class="en-bar slim"><i style="width:${Math.max(2, Math.round((u.number - 1) / u.total * 100))}%"></i></div></button>
    </div>
    <div class="en-today-links"><button class="ghost-button" type="button" data-action="en-ex" data-mode="theory">${icon("study", "icon-sm")}Правило урока</button><button class="ghost-button" type="button" data-action="en-tab" data-tab="progress">${icon("chart", "icon-sm")}Прогресс</button></div>`;
}

// ------------------------------------------------------------ колода слов
// Свайп вправо — знаю, влево — не знаю, нажатие — перевернуть. «Не знаю» сразу
// показывает перевод и пример (немедленная обратная связь), а слово ещё раз
// выходит через несколько карточек — пока не скажете «знаю». Новые слова идут
// сверху частотного списка; знакомые пролетают и не считаются: за сессию учим
// столько незнакомых, сколько выбрано в настройке.

function enDeckMake({ due = [], fresh = [], newGoal = 10, placement = false, inLesson = false }) {
  return { queue: [...due], fresh: [...fresh], newGoal, newUnknown: 0, i: 0, flipped: false, answer: null, graded: new Set(), know: 0, dont: 0, learned: [], placement, inLesson, results: {}, done: false };
}
function enDeckFill(d) {
  // Очередь кончилась — новое слово, пока не набрали нужное число незнакомых.
  while (d.i >= d.queue.length && d.fresh.length && (d.placement || d.newUnknown < d.newGoal)) d.queue.push(d.fresh.shift());
  if (d.i >= d.queue.length) d.done = true;
}
function enDeckTop(d) {
  return `<div class="en-run-top"><button class="icon-button" type="button" data-action="en-deck-quit" aria-label="Закончить">${icon("close", "icon-sm")}</button><div class="en-bar"><i style="width:${d.placement ? Math.round(d.i / Math.max(1, d.queue.length) * 100) : Math.round(Math.min(1, d.newUnknown / Math.max(1, d.newGoal)) * 100)}%"></i></div><small>${d.placement ? `${d.i}/${d.queue.length}` : `${d.know + d.dont}`}</small></div>`;
}
function enDeckScreen(d) {
  enDeckFill(d);
  if (d.done) return d.placement ? enPlacementDone(d) : enDeckDone(d);
  const w = d.queue[d.i];
  const kicker = d.placement ? "Знаете это слово?" : w.again ? "Ещё раз" : w.isNew ? `Новое · №${w.id}${w.level ? ` · ${w.level}` : ""}` : "Повторить";
  const back = d.flipped || d.answer === "dont";
  const goal = d.placement ? "" : `<p class="en-deck-goal">Новых к изучению: <b>${Math.min(d.newUnknown, d.newGoal)} из ${d.newGoal}</b> · знаю ${d.know}</p>`;
  const card = `<div class="en-swipe ${back ? "back" : ""}" data-swipe>
      <span class="en-swipe-hint know">Знаю</span><span class="en-swipe-hint dont">Не знаю</span>
      <div class="en-swipe-front"><b class="en-word">${esc(w.en)}</b><small>${[w.ipa ? `/${esc(w.ipa)}/` : "", esc(w.pos || "")].filter(Boolean).join(" · ")}</small>${back ? "" : `<small class="en-swipe-tip">нажмите, чтобы перевернуть</small>`}</div>
      ${back ? `<div class="en-swipe-back"><p class="en-word-ru">${esc(w.ru)}</p>${w.ex ? `<p class="en-word-ex">${esc(w.ex)}</p><small>${esc(w.exRu || "")}</small>` : ""}</div>` : ""}
      <button class="icon-button en-play" type="button" data-action="en-say" data-text="${esc(w.ex && back ? w.ex : w.en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button>
    </div>`;
  const buttons = d.answer === "dont"
    ? `<div class="en-deck-btns"><button class="primary-button" type="button" data-action="en-deck-next">Запомнил · дальше</button></div>`
    : `<div class="en-deck-btns two"><button type="button" class="en-dont" data-action="en-dont">${icon("close", "icon-sm")}Не знаю</button><button type="button" class="en-know" data-action="en-know">${icon("check", "icon-sm")}Знаю</button></div>`;
  return `<p class="en-kicker">${kicker}</p>${card}${buttons}${goal}`;
}
function enDeckAnswer(know) {
  const s = enState();
  const d = s.deck || s.ex?.deck;
  if (!d || d.done || d.answer) return;
  const w = d.queue[d.i];
  // В расписание — только первый ответ на слово за сессию.
  if (!d.graded.has(w.id)) {
    d.graded.add(w.id);
    enCall("swipe", { id: w.id, know, attempt: `w${w.id}-${Date.now()}` }).catch(() => {});
    if (w.isNew && !know) { d.newUnknown++; d.learned.push(w.en); }
    if (d.placement && w.layer) { const key = w.layer.join("-"); const r = d.results[key] ||= { from: w.layer[0], to: w.layer[1], known: 0, shown: 0 }; r.shown++; if (know) r.known++; }
  }
  if (know) d.know++; else d.dont++;
  if (!know && !d.placement) {
    // Не знаю — перевод сразу, а слово ещё раз через несколько карточек (не больше двух раз:
    // дальше его вернёт расписание на следующих занятиях).
    d.answer = "dont";
    if ((w.repeats || 0) < 2) d.queue.splice(Math.min(d.queue.length, d.i + 4), 0, { ...w, again: true, isNew: false, repeats: (w.repeats || 0) + 1 });
    render();
    enSpeak(w.en);
    return;
  }
  enDeckNext();
}
function enDeckNext() {
  const s = enState();
  const d = s.deck || s.ex?.deck;
  if (!d) return;
  d.i++; d.flipped = false; d.answer = null;
  enDeckFill(d);
  // Урок: колода пройдена — дальше по шагам, новые слова — в задание для разговора.
  if (d.done && d.inLesson) {
    const ex = s.ex;
    const talk = ex.items.find(x => x.mode === "talk");
    if (talk && d.learned.length) talk.targets = [...(talk.targets || []), ...d.learned.slice(0, 4)];
    ex.deck = null; enExNext(); return;
  }
  render();
}
function enDeckDone(d) {
  enState().today = null; enState().words = null;
  return `<div class="en-done"><div class="en-done-mark">${icon("check")}</div><h2>Слова на сегодня</h2><p class="muted">Знаю ${d.know} · новых к изучению ${d.newUnknown}</p>${d.learned.length ? `<div class="en-targets"><small>Учим:</small>${d.learned.slice(0, 12).map(x => `<b>${esc(x)}</b>`).join("")}</div>` : ""}
    <button class="primary-button en-go" type="button" data-action="en-deck-more">Ещё слова</button><button class="ghost-button" type="button" data-action="en-deck-quit">Готово</button></div>`;
}
function enPlacementDone(d) {
  if (!d.sent) {
    d.sent = true;
    enCall("placed", { results: Object.values(d.results) }).then(r => { d.outcome = r; enState().today = null; enState().course = null; render(); }).catch(() => { d.outcome = { error: true }; render(); });
  }
  const r = d.outcome;
  if (!r) return enWait();
  if (r.error) return `<div class="en-done"><h2>Не получилось сохранить</h2><button class="primary-button en-go" type="button" data-action="en-deck-quit">Закрыть</button></div>`;
  return `<div class="en-done"><div class="en-done-mark">${icon("chart")}</div><h2>≈ ${enNum(r.estimate)} слов</h2><p class="muted">Это примерно уровень ${esc(r.level)}. Начнём с урока ${r.unit.number}: ${esc(r.unit.grammar)}.</p><p class="section-note">Слова, которые вы отметили, уже в колоде; остальные знакомые пролетят одним свайпом.</p>
    <button class="primary-button en-go" type="button" data-action="en-deck-quit">Отлично</button><button class="ghost-button" type="button" data-action="en-tab" data-tab="course">Выбрать урок самому</button></div>`;
}
async function enDeckStart(placement = false) {
  const s = enState();
  s.deck = { loading: true, queue: [], fresh: [] };
  render();
  try {
    const data = await enCall(placement ? "placement" : "deck");
    if (data?.error) throw new Error(data.error);
    s.deck = placement ? enDeckMake({ fresh: data.items, placement: true, newGoal: data.items.length }) : enDeckMake(data);
    if (placement) { s.deck.queue = s.deck.fresh; s.deck.fresh = []; }
  } catch (_) { s.deck = null; toast("Не получилось загрузить слова"); }
  render();
}

// Свайп пальцем: тянем карточку, отпустили дальше 90 px — ответ, короткое касание — перевернуть.
let enDrag = null;
document.addEventListener("pointerdown", event => {
  const card = event.target.closest?.("[data-swipe]");
  if (!card || event.target.closest("button")) return;
  enDrag = { card, x: event.clientX, y: event.clientY, dx: 0, id: event.pointerId };
  card.setPointerCapture?.(event.pointerId);
});
document.addEventListener("pointermove", event => {
  if (!enDrag || event.pointerId !== enDrag.id) return;
  enDrag.dx = event.clientX - enDrag.x;
  const d = enDrag.dx;
  enDrag.card.style.transform = `translateX(${d}px) rotate(${d / 18}deg)`;
  enDrag.card.classList.toggle("to-know", d > 40);
  enDrag.card.classList.toggle("to-dont", d < -40);
});
document.addEventListener("pointerup", event => {
  if (!enDrag || event.pointerId !== enDrag.id) return;
  const { card, dx } = enDrag;
  enDrag = null;
  const s = enState(), d = s.deck || s.ex?.deck;
  if (Math.abs(dx) > 90 && d && !d.answer) {
    card.style.transition = "transform .18s ease"; card.style.transform = `translateX(${dx > 0 ? 500 : -500}px) rotate(${dx > 0 ? 20 : -20}deg)`;
    setTimeout(() => enDeckAnswer(dx > 0), 160);
    return;
  }
  card.style.transition = "transform .15s ease"; card.style.transform = "";
  card.classList.remove("to-know", "to-dont");
  if (Math.abs(dx) < 6 && d) {
    if (d.answer === "dont") { enDeckNext(); return; }
    d.flipped = !d.flipped; render();
    if (d.flipped) enSpeak(d.queue[d.i].en);
  }
});
document.addEventListener("pointercancel", () => { if (enDrag) { enDrag.card.style.transform = ""; enDrag = null; } });
document.addEventListener("keydown", event => {
  const s = enState(), d = s.deck || s.ex?.deck;
  if (!d || ui.page !== "english" || event.target.closest?.("input, textarea")) return;
  if (event.key === "ArrowRight") { if (d.answer) enDeckNext(); else enDeckAnswer(true); }
  if (event.key === "ArrowLeft" && !d.answer) enDeckAnswer(false);
  if (event.key === " ") { event.preventDefault(); d.flipped = !d.flipped; render(); }
});

// ------------------------------------------------------------ слова: прогресс

function enWordsScreen() {
  const s = enState();
  if (!s.words) { enLoad("words", "words"); return enWait(); }
  const w = s.words;
  const pct = Math.round(w.known / w.total * 100);
  const bands = w.bands.map(b => `<div class="en-sit-row"><span>${enNum(b.from)}–${enNum(b.to)}</span><div class="en-bar slim"><i style="width:${Math.round(b.known / b.size * 100)}%"></i></div><small>${Math.round(b.known / b.size * 100)}%</small></div>`).join("");
  const forecast = w.forecast ? `≈ ${String(w.perDay).replace(".", ",")} слова в день · все ${enNum(w.total)} — к ${new Date(w.forecast).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}` : "Темп появится через пару занятий";
  const chips = [5, 10, 15, 20].map(n => `<button type="button" class="map-category-chip ${w.newWords === n ? "active" : ""}" data-action="en-newwords" data-n="${n}">${n}</button>`).join("");
  if (!s.wordlist) enLoad("wordlist", "wordlist", { filter: s.wfilter, q: s.wq });
  const chip = (key, label) => `<button type="button" class="map-category-chip ${s.wfilter === key ? "active" : ""}" data-action="en-wfilter" data-filter="${key}">${label}</button>`;
  const rows = (s.wordlist?.items || []).map(x => `<div class="en-wrow"><small>${x.id}</small><div><b>${esc(x.en)}</b><span>${esc(x.ru)}</span></div><button class="icon-button" type="button" data-action="en-say" data-text="${esc(x.en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button></div>`).join("");
  return `<section class="en-hero"><div class="en-hero-top"><div><h2>${enNum(w.known)} <span class="muted">из ${enNum(w.total)} слов</span></h2><small>${forecast}</small></div></div>
      <div class="en-bar"><i style="width:${Math.max(1, pct)}%"></i></div>
      <p class="section-note">5000 самых частых слов английского (список COCA). Первые 2000 покрывают большую часть живой речи — с них и начинаем.</p>
      <button class="primary-button en-go" type="button" data-action="en-deck">${icon("card", "icon-sm")}Учить слова</button>
      ${w.placed ? "" : `<button class="ghost-button" type="button" data-action="en-place">Проверка уровня · 3 минуты</button>`}</section>
    <section class="en-situation"><div class="en-row"><b>По частоте</b><small>учу сейчас ${w.learning}</small></div>${bands}</section>
    <section class="en-situation"><div class="en-row"><b>Новых слов за занятие</b><small>знакомые не считаются</small></div><div class="map-categories en-chips">${chips}</div></section>
    <label class="notes-search">${icon("search", "icon-sm")}<input id="en-wsearch" type="search" value="${esc(s.wq)}" placeholder="Найти слово" aria-label="Поиск слова"></label>
    <div class="map-categories en-chips">${chip("learning", "Учу")}${chip("known", "Знаю")}${chip("all", "Все по порядку")}</div>
    <div class="en-wlist">${rows || `<p class="section-note">${s.wordlist ? "Пока пусто — слова появятся после первого занятия." : ""}</p>`}</div>`;
}

// ------------------------------------------------------------ курс

const EN_LEVEL_NAMES = { A1: "A1 · начальный", A2: "A2 · базовый", B1: "B1 · средний", B2: "B2 · выше среднего" };
function enCourseScreen() {
  const s = enState();
  if (!s.course) { enLoad("course", "course"); return enWait(); }
  const c = s.course, cur = c.units.find(u => u.status === "current") || c.units[0];
  const levels = ["A1", "A2", "B1", "B2"].map(level => {
    const list = c.units.filter(u => u.level === level);
    const done = list.filter(u => u.status === "done").length;
    return `<section class="en-level"><div class="en-row"><b>${EN_LEVEL_NAMES[level]}</b><small>${done} из ${list.length}</small></div>${list.map(u => `<button type="button" class="en-unit ${u.status}" data-action="en-unit" data-key="${esc(u.key)}"><span class="en-unit-n">${u.status === "done" ? icon("check", "icon-sm") : u.number}</span><span><b>${esc(u.title)}</b><small>${esc(u.grammar)}</small></span>${u.score != null ? `<small class="en-unit-score">${Math.round(u.score * 100)}%</small>` : ""}</button>${s.openUnit === u.key ? `<div class="en-unit-more"><button class="primary-button" type="button" data-action="en-unit-go" data-key="${esc(u.key)}">Пройти урок</button><button class="ghost-button" type="button" data-action="en-ex" data-mode="theory" data-unit="${esc(u.key)}">Правило</button></div>` : ""}`).join("")}</section>`;
  }).join("");
  return `<section class="en-hero"><div class="en-hero-top"><div><small>Урок ${cur.number} из ${c.units.length} · ${cur.level}</small><h2>${esc(cur.title)}</h2><small>${esc(cur.grammar)}</small></div></div>
      <div class="en-modes">${EN_MODES.map(([key, title, sub, ic]) => `<button type="button" class="en-mode" data-action="en-ex" data-mode="${key}"><span class="en-step-ic">${icon(ic, "icon-sm")}</span><b>${title}</b><small>${sub}</small></button>`).join("")}</div>
      <p class="section-note">Упражнения — на предложениях текущего урока и на том, что пора повторить. Урок засчитывается от 70% верных ответов.</p></section>
    ${levels}`;
}

// ------------------------------------------------------------ разговор
// Живой режим: после реплики тренера микрофон слушает сам, пауза ~1,6 с —
// реплика уходит, тренер отвечает голосом, и снова слушаем. Пока тренер
// говорит, микрофон не пишет (чтобы не услышать его же). Нажатие на круг во
// время ответа — перебить. Текст ответа — расшифровка речи самой голосовой
// модели и появляется по словам, когда они звучат.

function enChatStart(unitKey, title, opener) {
  const s = enState();
  const u = s.today?.unit;
  const own = !unitKey || u?.key === unitKey;
  s.chat = { situation: unitKey || u?.key || "", title: title || (own ? u?.topic?.title : "") || "Разговор", msgs: [], busy: false, typing: false };
  const first = opener || (own ? u?.topic?.opener : "");
  if (first) s.chat.msgs.push({ role: "ai", text: first, opener: true });
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
  if (!s.chat) enChatStart(s.today.unit.key);
  const c = s.chat;
  const live = enLive.state;
  const msgs = c.msgs.map((m, i) => m.role === "me"
    ? `<div class="en-bub me">${esc(m.text)}${m.correction ? `<div class="en-fixline">Лучше: <b>${esc(m.correction)}</b>${m.explain ? `<small>${esc(m.explain)}</small>` : ""}${m.saved ? `<small>В повторениях</small>` : ""}</div>` : ""}</div>`
    : `<div class="en-bub ai" data-action="en-bubble" data-index="${i}"><span class="en-say" data-say="${i}">${m.streaming ? esc(m.shown || "") : enWords(m.text, i)}</span>${m.word ? `<span class="en-wordcard">${m.word.loading ? `<span class="live-spin"></span>` : m.word.error ? "Не получилось перевести" : `<b>${esc(m.word.lemma)}</b> — ${esc(m.word.ru)}${m.word.phrase && m.word.phrase !== m.word.lemma ? `<small>${esc(m.word.phrase)} — ${esc(m.word.phraseRu)}</small>` : ""}<small>${icon("check", "icon-sm")}${m.word.deck ? `В колоде слов (№${m.word.deck})` : "Добавлено во «Фразы»"}</small>`}</span>` : ""}${m.open && m.ru ? `<small>${esc(m.ru)}</small>` : ""}</div>`).join("");
  const input = c.typing ? `<form class="en-write" data-en-chat><input name="text" autocomplete="off" placeholder="Напишите реплику" aria-label="Реплика"><button class="primary-button" type="submit">${icon("arrow", "icon-sm")}</button></form>` : "";
  const aims = c.targets?.length ? `<div class="en-aims">${c.targets.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : "";
  return `<section class="en-chat"><div class="en-chat-head"><span class="en-step-ic">${icon("message", "icon-sm")}</span><div><b>${esc(c.title || "Разговор")}</b><small>Нажмите слово — перевод и в изучение</small></div><button class="text-action" type="button" data-action="en-chat-reset">Заново</button></div>${aims}
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
      const answer = await enCall("chat", { situation: c.situation, history, text: mine.text, targets: c.targets || [] });
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

// ------------------------------------------------------------ упражнения
// Пять видов упражнений на одних и тех же предложениях. Разные пути к одной
// фразе (вспомнить перевод, собрать, вставить пропуск, услышать, сказать)
// закрепляют её прочнее, чем один способ много раз.
const EN_MODES = [
  ["cards", "Карточки", "Вспомнить перевод", "copy"],
  ["build", "Собери фразу", "Слова по порядку", "grip"],
  ["gap", "Пропуск", "Грамматика урока", "pen"],
  ["dictation", "Диктант", "Услышать и записать", "play"],
  ["translate", "Перевод", "Сказать по-английски", "message"],
];

async function enExStart(mode, unitKey) {
  const s = enState();
  s.ex = { mode, loading: true };
  render();
  try {
    const unit = unitKey || s.today?.unit?.key || "";
    const data = await enCall(mode === "theory" ? "theory" : "practice", { mode, unit });
    if (data?.error) throw new Error(data.error);
    s.ex = mode === "theory" ? { mode, theory: data } : { mode, unit: data.unit, items: data.items || [], index: 0, ok: 0, done: 0, picked: [], answer: null };
    if (mode !== "theory" && !s.ex.items.length) { s.ex = null; toast("Пока не из чего — пройдите занятие на «Сегодня»"); }
    else if (mode === "dictation") setTimeout(() => enSpeak(s.ex.items[0].en), 200);
  } catch (_) { s.ex = null; toast("Не получилось загрузить упражнение"); }
  render();
}

async function enLessonStart(unitKey) {
  const s = enState();
  s.ex = { mode: "lesson", loading: true };
  render();
  try {
    const data = await enCall("lesson", unitKey ? { unit: unitKey } : {});
    if (data?.error) throw new Error(data.error);
    s.ex = { mode: "lesson", unit: data.unit, items: data.steps || [], index: 0, ok: 0, done: 0, picked: [], answer: null };
    enLessonEnter();
  } catch (_) { s.ex = null; toast("Не получилось собрать урок"); }
  render();
}
/** Вход в шаг: колода слов, звук для новой фразы, «на слух», диктант. */
function enLessonEnter() {
  const ex = enState().ex, item = ex?.items[ex.index];
  if (!item) return;
  if (item.mode === "words" && !ex.deck) { ex.deck = enDeckMake({ ...item, inLesson: true }); enDeckFill(ex.deck); if (ex.deck.done) { ex.deck = null; ex.index++; enLessonEnter(); } return; }
  if (item.mode === "talk" && !ex.sent) {
    // Урок пройден до разговора — результат на сервер: от 70% — дальше по курсу.
    ex.sent = true;
    // Пропустили почти всё — урок не засчитываем: проходят упражнениями, а не кнопкой «Пропустить».
    if (ex.done < 4) { ex.result = { few: true }; return; }
    enCall("unitdone", { unit: ex.unit.key, score: ex.ok / ex.done }).then(r => { ex.result = r; enState().today = null; enState().course = null; render(); }).catch(() => {});
  }
  if (["listen", "dictation"].includes(item.mode)) setTimeout(() => enSpeak(item.en), 150);
}
const EN_SECTIONS = ["Слова", "Разминка", "Правило", "Тренировка", "Аудирование", "Проверка", "Разговор"];
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
      <button class="primary-button en-go" type="button" data-action="en-ex" data-mode="${ex.mode}">Ещё раз</button><button class="ghost-button" type="button" data-action="en-ex-quit">К курсу</button></div>`;
  }
  const item = ex.items[ex.index];
  const mode = item.mode || ex.mode;
  const lessonRun = ex.mode === "lesson";
  const title = lessonRun ? "" : EN_MODES.find(m => m[0] === mode)?.[1] || "";
  const skip = lessonRun && item.section !== "Разговор" ? `<button class="text-action en-skip" type="button" data-action="en-skip">Пропустить</button>` : `<small>${ex.index + 1}/${total}</small>`;
  const top = `<div class="en-run-top"><button class="icon-button" type="button" data-action="en-ex-quit" aria-label="Закончить">${icon("close", "icon-sm")}</button><div class="en-bar"><i style="width:${Math.round(ex.index / total * 100)}%"></i></div>${skip}</div>${lessonRun ? enLessonTop(ex) : ""}${title ? `<p class="en-kicker">${esc(title)}</p>` : ""}`;
  if (mode === "words") return `<div class="en-run">${top}${ex.deck ? enDeckScreen(ex.deck) : enWait()}</div>`;
  if (mode === "theory") {
    const t = item.theory || {};
    return `<div class="en-run">${top}<p class="en-kicker">Урок ${ex.unit?.number || ""} · ${esc(item.grammar || "")}</p><h2 class="en-prompt">${esc(t.title || "")}</h2><section class="en-theory-part"><p>${esc(t.text || "")}</p>${(t.examples || []).map(([en, ru]) => `<div class="en-example"><button class="icon-button en-play" type="button" data-action="en-say" data-text="${esc(en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button><div><b>${esc(en)}</b><small>${esc(ru)}</small></div></div>`).join("")}</section><button class="primary-button en-go" type="button" data-action="en-ex-next">Понятно</button></div>`;
  }
  if (mode === "listen") {
    const a2 = ex.answer;
    return `<div class="en-run">${top}<p class="en-kicker">Послушайте и поймите смысл</p><div class="en-listen"><button class="en-mic" type="button" data-action="en-say" data-text="${esc(item.en)}" aria-label="Послушать ещё раз">${icon("play")}</button><small>Нажмите, чтобы послушать ещё раз</small></div>
      ${a2 ? `<div class="en-card"><div class="en-en"><b>${esc(item.en)}</b></div><p class="en-ru">${esc(item.ru)}</p></div><p class="en-ask">Поняли на слух?</p><div class="en-rate">${[[1, "Не понял"], [2, "С трудом"], [3, "Понял"]].map(([r, l]) => `<button type="button" data-action="en-ex-rate" data-rating="${r}">${l}</button>`).join("")}</div>` : `<div class="en-answer"><button class="primary-button" type="button" data-action="en-ex-show">Показать текст</button></div>`}</div>`;
  }
  if (mode === "talk") {
    const r = ex.result;
    const verdict = !r ? "" : r.few ? `<p class="section-note">Урок засчитается, когда сделаете упражнения — сейчас их почти не было.</p>` : r.passed ? `<p class="en-ok">${icon("check", "icon-sm")}Урок засчитан${r.next ? ` · дальше урок ${r.next.number}: ${esc(r.next.grammar)}` : ""}</p>` : `<p class="en-fix">Верно меньше 70% — завтра этот урок ещё раз, с другими предложениями.</p>`;
    return `<div class="en-run en-done"><div class="en-done-mark">${icon("mic")}</div><h2>Разговор</h2><p class="muted">${esc(item.title)}: ${esc(item.goal)}</p>${ex.done ? `<p class="muted">Упражнения: верно ${ex.ok} из ${ex.done}</p>` : ""}${verdict}
      ${item.targets?.length ? `<div class="en-targets"><small>Постарайтесь использовать:</small>${item.targets.map(t => `<b>${esc(t)}</b>`).join("")}</div>` : ""}
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
    return `<div class="en-run">${top}<p class="en-kicker">Соберите фразу</p><h2 class="en-prompt">${esc(item.ru)}</h2><div class="en-line ${a ? (a.ok ? "ok" : "bad") : ""}">${line || `<small>Нажимайте слова по порядку</small>`}</div>${a ? result(a.ok) + next : `<div class="en-tiles">${pool}</div>${ex.picked.length ? `<button class="text-action" type="button" data-action="en-tile-clear">Сначала</button>` : ""}`}</div>`;
  }
  if (mo === "gap") {
    const opts = item.options.map(o => `<button type="button" class="en-opt ${a ? (o.toLowerCase() === item.answer ? "right" : o === a.pick ? "wrong" : "") : ""}" data-action="en-gap" data-opt="${esc(o)}" ${a ? "disabled" : ""}>${esc(o)}</button>`).join("");
    return `<div class="en-run">${top}<p class="en-kicker">Вставьте пропуск</p><h2 class="en-prompt en-gap-text">${esc(item.text).replace("___", `<span class="en-blank">${a ? esc(a.pick) : "&nbsp;"}</span>`)}</h2><p class="en-ru">${esc(item.ru)}</p><div class="en-opts">${opts}</div>${a ? `${a.ok ? `<p class="en-ok">${icon("check", "icon-sm")}Верно</p>` : `<p class="en-fix">Правильно: <b>${esc(item.en)}</b>${item.tip ? ` · ${esc(item.tip)}` : ""}</p>`}${next}` : ""}</div>`;
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
    <div class="en-actions"><button class="ghost-button" type="button" data-action="en-ex" data-mode="gap" data-unit="${esc(t.key)}">Пропуск</button><button class="primary-button" type="button" data-action="en-ex" data-mode="build" data-unit="${esc(t.key)}">Собери фразу</button></div></div>`;
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
  if (ex.mode === "lesson") enLessonEnter();
  render();
  if (ex.mode !== "lesson" && ex.items[ex.index] && ex.mode === "dictation") enSpeak(ex.items[ex.index].en);
}

// ------------------------------------------------------------ фразы и прогресс

function enPhrasesScreen() {
  const s = enState();
  if (!s.list) { enLoad("list", "phrases", { filter: s.filter, q: s.q }); return enWait(); }
  const k = s.list.counts || {};
  const chip = (key, label, n) => `<button type="button" class="map-category-chip ${s.filter === key ? "active" : ""}" data-action="en-filter" data-filter="${key}">${label}${n !== undefined ? `<span>${n}</span>` : ""}</button>`;
  const rows = (s.list.items || []).map(p => `<div class="en-phrase ${s.open === p.id ? "open" : ""}"><button type="button" class="en-phrase-main" data-action="en-phrase" data-id="${p.id}"><b>${esc(p.en)}</b><small>${esc(p.ru)}${p.source === "mistake" ? " · из ошибки" : ""}</small><span class="en-bar slim"><i class="${p.strength < .34 ? "weak" : ""}" style="width:${Math.max(6, Math.round(p.strength * 100))}%"></i></span></button><button class="icon-button" type="button" data-action="en-say" data-text="${esc(p.en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button>${s.open === p.id ? `<div class="en-phrase-more">${p.note ? `<p>${esc(p.note)}</p>` : ""}<small>${p.learned ? "Закреплено" : p.due ? `Повтор: ${new Date(p.due).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}` : ""}</small><button class="text-action danger" type="button" data-action="en-delete" data-id="${p.id}">Удалить</button></div>` : ""}</div>`).join("");
  return `<p class="section-note">Предложения пройденных уроков, ваши ошибки из разговоров и то, что вы спросили. Повторяются с интервалами на занятии.</p><label class="notes-search">${icon("search", "icon-sm")}<input id="en-search" type="search" value="${esc(s.q)}" placeholder="Найти фразу" aria-label="Поиск фраз"></label>
    <div class="map-categories en-chips">${chip("due", "Сегодня", k.due)}${chip("mistakes", "Из ошибок", k.mistakes)}${chip("learned", "Закреплено", k.learned)}${chip("all", "Все")}</div>
    <div class="en-phrases">${rows || `<p class="section-note">${s.filter === "due" ? "На сегодня повторять нечего." : "Здесь пока пусто — фразы появятся из уроков и разговоров."}</p>`}</div>`;
}

function enProgressScreen() {
  const s = enState();
  if (!s.progress) { enLoad("progress", "progress"); return enWait(); }
  const p = s.progress;
  const max = Math.max(1, ...p.days.map(d => d.count));
  const metric = (n, label) => `<div class="en-metric"><b>${n}</b><small>${label}</small></div>`;
  return `<section class="en-metrics">${metric(p.streak, enPlural(p.streak, "день подряд", "дня подряд", "дней подряд"))}${metric(enNum(p.words.known), "слов знаю")}${metric(`${p.course.done}/${p.course.total}`, "уроков")}</section>
    <section class="en-situation"><div class="en-row"><b>4 недели</b><small>ответов в день</small></div><div class="en-days">${p.days.map(d => `<i title="${esc(d.day)}: ${d.count}" style="height:${Math.round(d.count / max * 100)}%" class="${d.count ? "" : "zero"}"></i>`).join("")}</div></section>
    <section class="en-situation"><div class="en-row"><b>Фразы</b><small>${p.phrases.mistakes} из ошибок</small></div><div class="en-sit-row"><span>Закреплено</span><div class="en-bar slim"><i style="width:${p.phrases.total ? Math.round(p.phrases.learned / p.phrases.total * 100) : 0}%"></i></div><small>${p.phrases.learned}/${p.phrases.total}</small></div>
    <p class="section-note">«Знаю» и «закреплено» — когда повтор держится хотя бы три недели. Слово, отмеченное «знаю» с первого взгляда, проверим ещё раз через пару недель.</p></section>`;
}

// ------------------------------------------------------------ действия

function englishAction(action, control) {
  if (!action.startsWith("en-")) return false;
  const s = enState();
  if (action === "en-tab") { s.deck = null; s.tab = control.dataset.tab; if (s.tab === "phrases") s.list = null; if (s.tab === "progress") s.progress = null; if (s.tab === "words") { s.words = null; s.wordlist = null; } if (s.tab === "course") s.course = null; render(); return true; }
  if (action === "en-start") { enLessonStart(); return true; }
  if (action === "en-home") { s.tab = "today"; navigate("english"); if (s.today && !s.today.plan.doneToday) enLessonStart(); else render(); return true; }
  if (action === "en-say") { enSpeak(control.dataset.text, control); return true; }
  // колода
  if (action === "en-deck") { enDeckStart(false); return true; }
  if (action === "en-place") { enDeckStart(true); return true; }
  if (action === "en-know") { enDeckAnswer(true); return true; }
  if (action === "en-dont") { enDeckAnswer(false); return true; }
  if (action === "en-deck-next") { enDeckNext(); return true; }
  if (action === "en-deck-more") { enDeckStart(false); return true; }
  if (action === "en-deck-quit") {
    if (s.ex?.deck) { s.ex.deck = null; s.ex.index++; enLessonEnter(); render(); return true; }
    s.deck = null; s.words = null; s.wordlist = null; s.today = null; render(); return true;
  }
  if (action === "en-newwords") { const n = Number(control.dataset.n); if (s.words) s.words.newWords = n; render(); enCall("newwords", { n }).then(() => { s.today = null; }); return true; }
  if (action === "en-wfilter") { s.wfilter = control.dataset.filter; s.wordlist = null; render(); return true; }
  // курс
  if (action === "en-unit") { s.openUnit = s.openUnit === control.dataset.key ? null : control.dataset.key; render(); return true; }
  if (action === "en-unit-go") {
    const key = control.dataset.key;
    // Выбранный урок становится текущим — дальше курс идёт от него.
    enCall("unit", { unit: key }).then(c => { s.course = c; s.today = null; });
    enLessonStart(key); return true;
  }
  // разговор
  if (action === "en-live") {
    if (enLive.state === "off") enLiveStart();
    else if (enLive.state === "speak") { enStopPcm(); enLiveSet("listen"); } // перебить тренера
    return true;
  }
  if (action === "en-live-stop") { enStopPcm(); enLiveStop(); render(); return true; }
  if (action === "en-chat-type") { s.chat.typing = !s.chat.typing; render(); setTimeout(() => document.querySelector("[data-en-chat] input")?.focus(), 30); return true; }
  if (action === "en-chat-reset") { enStopPcm(); enLiveStop(); s.chat = null; render(); return true; }
  // упражнения
  if (action === "en-ex") { enExStart(control.dataset.mode, control.dataset.unit); return true; }
  if (action === "en-ex-quit") { const wasLesson = s.ex?.mode === "lesson"; s.ex = null; s.tab = wasLesson ? "today" : "course"; s.today = null; render(); return true; }
  if (action === "en-ex-next") { enExNext(); return true; }
  if (action === "en-ex-show") {
    const ex = s.ex, mode = ex.items[ex.index].mode || ex.mode;
    if (mode === "cards" || mode === "listen") { ex.answer = { ok: false, shown: true }; render(); if (mode === "cards") enSpeak(ex.items[ex.index].en); }
    else enExAnswer(false, { verdict: "shown", rating: 1 });
    return true;
  }
  if (action === "en-skip") { const ex = s.ex, sec = ex.items[ex.index].section; ex.deck = null; while (ex.index < ex.items.length && ex.items[ex.index].section === sec) ex.index++; ex.answer = null; ex.picked = []; enLessonEnter(); render(); return true; }
  if (action === "en-talk") {
    const item = s.ex.items[s.ex.index], unit = s.ex.unit;
    s.ex = null; s.tab = "chat";
    enChatStart(item.situation, item.title, unit?.topic?.opener); s.chat.targets = item.targets || [];
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
    enCall("word", { word: w, sentence: m.text }).then(answer => { m.word = answer?.error ? { error: true } : answer; if (!answer?.error) toast(answer.deck ? `«${answer.lemma}» — в колоде, выйдет на занятии` : `«${answer.lemma}» — во «Фразах»`); })
      .catch(() => { m.word = { error: true }; }).finally(() => { render(); });
    return true;
  }
  if (action === "en-filter") { s.filter = control.dataset.filter; s.list = null; render(); return true; }
  if (action === "en-phrase") { const id = Number(control.dataset.id); s.open = s.open === id ? null : id; render(); return true; }
  if (action === "en-delete") { const id = Number(control.dataset.id); enCall("delete", { id }).then(() => { s.list = null; render(); toast("Фраза удалена"); }); return true; }
  return false;
}

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
  const chat = event.target.closest?.("[data-en-chat]");
  if (!chat) return;
  enAudioCtx();
  event.preventDefault(); event.stopImmediatePropagation();
  enChatSend(String(new FormData(event.target).get("text") || ""));
}, true);
let enSearchTimer = null;
document.addEventListener("input", event => {
  const s = enState();
  if (event.target.id === "en-search") {
    s.q = event.target.value;
    clearTimeout(enSearchTimer);
    enSearchTimer = setTimeout(() => { s.list = null; enLoad("list", "phrases", { filter: s.filter === "all" ? "" : s.filter, q: s.q }); }, 350);
  }
  if (event.target.id === "en-wsearch") {
    s.wq = event.target.value;
    clearTimeout(enSearchTimer);
    enSearchTimer = setTimeout(() => { s.wordlist = null; enLoad("wordlist", "wordlist", { filter: s.wfilter, q: s.wq }); }, 350);
  }
});

// Ушли из раздела — живой микрофон выключаем (иначе он слушал бы на других экранах).
window.addEventListener("hashchange", () => { if (!location.hash.includes("english") && enLive.state !== "off") { enStopPcm(); enLiveStop(); } });
document.addEventListener("visibilitychange", () => { if (document.hidden && enLive.state !== "off") { enStopPcm(); enLiveStop(); } });
