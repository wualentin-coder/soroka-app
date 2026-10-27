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
  const rule = { id: 7, key: "a2-perfect", title: "Present Perfect: I have been, have you ever…?", formula: "have / has + 3-я форма", status: "assigned", errors: 3, uses: 0, need: 3, course: true, example: { said: "I was never in London.", correction: "I've never been to London.", explain: "Опыт за всю жизнь — Present Perfect: have been." } };
  if (op === "today") return { streak: 4, unit, plan: { wordReviews: 12, newWords: 10, phraseReviews: 4, fromMistakes: 2, minutes: 16, doneToday: false }, words: { known: 1240, total: 4380, learning: 36, seen: 1300 }, placed: null, facts: 3,
    rules: { assigned: [rule, { ...rule, id: 8, key: "articles-unique", title: "Артикль the с единственными в своём роде", formula: "the + sun / moon / world", errors: 1, course: false, example: { said: "Sun is hot today.", correction: "The sun is hot today.", explain: "" } }], studied: [{ ...rule, id: 9, title: "Past Simple: did в вопросах", status: "studied", uses: 1, errors: 2 }], counts: { assigned: 2, studied: 1, mastered: 4 } } };
  if (op === "facts") return { facts: ["Работает видеографом", "Есть кот по имени Боря", "Летом хочет в Грузию"] };
  if (op === "forget") return { facts: ["Работает видеографом", "Летом хочет в Грузию"] };
  if (op === "rule") return { rule, steps: [
    { mode: "theory", section: "Правило", grammar: rule.title, theory: { title: "Опыт — have been", text: "Когда важен сам опыт за всю жизнь, а не когда именно, — Present Perfect: have / has + третья форма.", examples: [["I've been to Paris.", "Я был в Париже."], ["Have you ever tried sushi?", "Ты когда-нибудь пробовал суши?"]] } },
    { mode: "theory", section: "Правило", grammar: rule.title, theory: { title: "Ваша ошибка", text: `Вы сказали: «${rule.example.said}». ${rule.example.explain}`, examples: [[rule.example.correction, "Так правильно"]] } },
    { en: "I have never seen this film.", ru: "Я никогда не видел этот фильм.", mode: "gap", text: "I have never ___ this film.", answer: "seen", options: ["saw", "seen", "see"], tip: rule.formula, section: "Тренировка" },
    { en: "She has been to Rome twice.", ru: "Она была в Риме дважды.", mode: "gap", text: "She ___ been to Rome twice.", answer: "has", options: ["has", "have", "was"], tip: rule.formula, section: "Тренировка" },
    { en: "Have you ever lost your phone?", ru: "Ты когда-нибудь терял телефон?", mode: "build", tiles: ["lost", "Have", "phone", "you", "your", "ever"], section: "Тренировка" },
  ] };
  if (op === "ruledone") return { passed: args.score >= .8, status: args.score >= .8 ? "studied" : "assigned", need: 3 };
  if (op === "debrief") return { good: ["Уверенно рассказали про выходные: «We went to the lake»"], work: ["Опыт за жизнь — Present Perfect: «I've never been to London», а не «I was never in London»"], next: "Расскажите Эмме о трёх местах, где вы уже были, — через I've been." };
  if (op === "deck") return { due, fresh, newGoal: 3 };
  if (op === "words") return { total: 4380, known: 1240, learning: 36, seen: 1300, perDay: 9.5, forecast: "2027-09-01", newWords: 10, placed: null, bands: [{ from: 1, to: 1000, known: 860, size: 1000 }, { from: 1001, to: 2000, known: 310, size: 1000 }, { from: 2001, to: 3000, known: 60, size: 1000 }, { from: 3001, to: 4000, known: 10, size: 1000 }, { from: 4001, to: 4380, known: 0, size: 380 }] };
  if (op === "wordlist") return { items: [...due, w(1, "the", "определённый артикль", "артикль", "", "", "A1", "known")] };
  if (op === "placement") return { items: [...fresh, ...due].map((x, i) => ({ ...x, layer: [[1, 500], [501, 1000], [1001, 2000], [2001, 3000], [3001, 4380]][i % 5] })) };
  if (op === "placed") return { estimate: 1650, level: "A2", unit: { ...unit, key: "a2-compare", number: 13, title: "Выбор и покупки", grammar: "Сравнение", level: "A2" } };
  if (op === "course") return { current: 9, units: [...Array(42)].map((_, i) => ({ key: `u${i}`, number: i + 1, level: i < 12 ? "A1" : i < 24 ? "A2" : i < 34 ? "B1" : "B2", title: `Урок ${i + 1}`, grammar: i === 9 ? unit.grammar : "Тема", status: i < 9 ? "done" : i === 9 ? "current" : "next", score: i < 9 ? .85 : null })) };
  if (op === "check") return { verdict: String(args.answer).toLowerCase().includes("went") ? "correct" : "close", correction: "We went to the country.", explain: "Go в прошедшем — went." };
  if (op === "chat") return { reply: "Ooh, almost — 'I've never been there'. Say it again?", replyRu: "О, почти — «I've never been there». Скажешь ещё раз?", correction: "I've never been to London.", explain: "Опыт за всю жизнь — Present Perfect.", saved: 3, rule: { id: 7, title: rule.title, errors: 3, isNew: false, again: false }, words: [{ en: "abroad", ru: "за границей", deck: 2210 }], used: [] };
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
  if (op === "books") return { items: [{ id: 1, key: "a1-flat", title: "A New Flat", author: "Flow", level: "A1", source: "builtin", pages: 2, page: 0, marks: 0, opened_at: null }, { id: 2, key: "b1-market", title: "The Night Market", author: "Flow", level: "B1", source: "builtin", pages: 4, page: 1, marks: 3, opened_at: "2026-10-26" }] };
  if (op === "book") return { id: args.id, title: "The Night Market", author: "Flow", level: "B1", page: args.page ?? 1, pages: 4, marks: ["stalls"], body: "I had been living in Bangkok for three weeks before I found the night market. To be honest, I hadn't been looking for it.\n\nIt was almost ten o'clock, but the street was full of light and noise. Hundreds of small stalls stretched as far as I could see." };
  if (op === "booktrall") return { trAll: args.on !== false, trPages: 0, pages: 4, part: { from: 0, to: 1, ready: 0 } };
  if (op === "booktr") return { page: args.page, tr: ["Я прожил в Бангкоке три недели, прежде чем нашёл ночной рынок.", "Это был перевод второго абзаца.", "И третьего.", "И четвёртого."] };
  if (op === "bookword") return { lemma: "stretch", ru: "тянуться, простираться", phrase: "stretched as far as I could see", phraseRu: "тянулись насколько хватало глаз", deck: 1460 };
  if (op === "bookadd") return { id: 3, pages: 10 };
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

const EN_TABS = [["today", "Сегодня"], ["words", "Слова"], ["course", "Курс"], ["read", "Чтение"], ["chat", "Разговор"]];
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
  if (s[`${key}Loading`]) { s[`${key}Next`] = { op, args }; return; }
  s[`${key}Loading`] = true;
  const token = Symbol(); s[`${key}Token`] = token;
  enCall(op, args).then(answer => { if (answer?.error) throw new Error(answer.error); if (!s[`${key}Next`] && s[`${key}Token`] === token) s[key] = answer; s.error = ""; })
    .catch(error => { s.error = String(error?.message || error); })
    .finally(() => {
      s[`${key}Loading`] = false;
      const next = s[`${key}Next`];
      if (next) { delete s[`${key}Next`]; s[key] = null; enLoad(key, next.op, next.args); return; }
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
  queueMicrotask(enFlush);
  const s = enState();
  if (s.deck) return `<div class="en-run">${enSyncBanner()}${s.deck.loading ? enWait() : enDeckTop(s.deck) + enDeckScreen(s.deck)}</div>`;
  if (s.ex) return enExScreen(s.ex);
  const tabs = `<div class="en-tabs" role="tablist">${EN_TABS.map(([key, label]) => `<button type="button" role="tab" class="${s.tab === key ? "active" : ""}" aria-selected="${s.tab === key}" data-action="en-tab" data-tab="${key}">${label}</button>`).join("")}</div>`;
  if (s.tab === "read" && s.book) return enReaderScreen();
  const body = s.tab === "chat" ? enChatScreen() : s.tab === "phrases" ? enPhrasesScreen() : s.tab === "progress" ? enProgressScreen() : s.tab === "read" ? enBooksScreen()
    : s.tab === "words" ? enWordsScreen() : s.tab === "course" ? enCourseScreen() : enTodayScreen();
  return `${header("Английский", "", "")}<div class="en-page">${enSyncBanner()}${tabs}${body}</div>`;
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
  return `${place}${enRulesCard(t)}<section class="en-hero"><div class="en-hero-top"><div><h2>${p.doneToday ? "Урок пройден" : "Занятие на сегодня"}</h2><small>${p.doneToday ? "Можно повторить слова или поговорить" : `≈ ${p.minutes} мин · ${u.level}`}</small></div>${streak}</div>
    <div class="en-steps">${steps}</div>
    <button class="primary-button en-go" type="button" data-action="en-start">${p.doneToday ? "Ещё занятие" : "Начать"}</button></section>
    <div class="en-goals">
      <button type="button" class="en-goal" data-action="en-tab" data-tab="words"><small>Слова</small><b>${enNum(t.words.known)} <span>из ${enNum(t.words.total)}</span></b><div class="en-bar slim"><i style="width:${Math.max(2, wordsPct)}%"></i></div></button>
      <button type="button" class="en-goal" data-action="en-tab" data-tab="course"><small>Курс · ${u.level}</small><b>${u.number} <span>из ${u.total}</span></b><div class="en-bar slim"><i style="width:${Math.max(2, Math.round((u.number - 1) / u.total * 100))}%"></i></div></button>
    </div>
    <div class="en-today-links"><button class="ghost-button" type="button" data-action="en-ex" data-mode="theory">${icon("study", "icon-sm")}Правило урока</button><button class="ghost-button" type="button" data-action="en-tab" data-tab="progress">${icon("chart", "icon-sm")}Прогресс</button></div>`;
}

/**
 * «Задано Эммой»: правила по вашим ошибкам в разговоре. Разобрать — объяснение,
 * ваша ошибка и упражнения; разобранное Эмма проверяет в речи, три верных
 * употребления — освоено. Тут же — что Эмма помнит о вас (можно стереть).
 */
function enRulesCard(t) {
  const s = enState(), r = t.rules;
  if (!r || (!r.assigned.length && !r.studied.length && !t.facts)) return "";
  const assigned = r.assigned.map(x => `<button type="button" class="en-rule-row" data-action="en-rule" data-id="${x.id}"><span><b>${esc(x.title)}</b><small>${x.errors} ${enPlural(x.errors, "ошибка", "ошибки", "ошибок")} в разговоре${x.example?.correction ? ` · «${esc(x.example.correction)}»` : ""}</small></span><span class="en-rule-go">Разобрать</span></button>`).join("");
  const studied = r.studied.map(x => `<div class="en-rule-row studied"><span><b>${esc(x.title)}</b><small>Разобрано · Эмма проверяет в разговоре: верно ${x.uses} из ${x.need}</small></span><span class="en-rule-meter">${[...Array(x.need)].map((_, i) => `<i class="${i < x.uses ? "on" : ""}"></i>`).join("")}</span></div>`).join("");
  const facts = s.facts ? `<div class="en-facts">${s.facts.loading ? `<span class="live-spin"></span>` : s.facts.list.length ? s.facts.list.map((f, i) => `<span>${esc(f)}<button type="button" class="icon-button" data-action="en-forget" data-index="${i}" aria-label="Забыть">${icon("close", "icon-sm")}</button></span>`).join("") : `<small>Пока ничего — расскажите о себе в разговоре.</small>`}</div>` : "";
  return `<section class="en-rules"><div class="en-rules-head"><div><h3>Задано Эммой</h3><small>${r.assigned.length ? "По вашим ошибкам в разговоре — разберите, и она проверит в речи" : "Новых правил нет — Эмма проверяет разобранное"}</small></div>${r.counts.mastered ? `<span class="en-rules-done">${icon("check", "icon-sm")}${r.counts.mastered}</span>` : ""}</div>
    ${assigned}${studied}${t.facts ? `<button type="button" class="text-action en-facts-toggle" data-action="en-facts">${s.facts ? "Скрыть" : `Что Эмма знает обо мне · ${t.facts}`}</button>${facts}` : ""}</section>`;
}

async function enRuleStart(id) {
  const s = enState();
  enStopPcm(); if (enLive.state !== "off") enLiveStop();
  const back = s.tab;
  s.ex = { mode: "rule", loading: true };
  render();
  try {
    const data = await enCall("rule", { id });
    if (data?.error || !data?.steps?.length) throw new Error(data?.error || "empty");
    s.ex = { mode: "rule", rule: data.rule, items: data.steps, index: 0, ok: 0, done: 0, picked: [], answer: null, back };
  } catch (_) { s.ex = null; toast("Не получилось открыть правило — попробуйте ещё раз"); }
  render();
}
/** Конец разбора: от 80% верных — «разобрано», дальше Эмма проверит в разговоре. */
function enRuleFinish(ex) {
  if (ex.sent) return;
  ex.sent = true;
  if (ex.done < 3) { ex.result = { few: true }; return; }
  enQueue("ruledone", { id: ex.rule.id, score: ex.ok / ex.done }).then(r => { ex.result = r; enState().rulesStale = true; render(); }).catch(() => {});
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
    if (!enRecord("swipe", { id: w.id, know, attempt: `w${w.id}-${Date.now()}` })) return;
    d.graded.add(w.id);
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
    enQueue("placed", { results: Object.values(d.results) }).then(r => { d.outcome = r; enState().today = null; enState().course = null; render(); }).catch(() => { d.outcome = { error: true }; render(); });
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
    <button type="button" class="en-goal en-phrases-link" data-action="en-tab" data-tab="phrases"><small>Мои фразы</small><b>Предложения уроков и ваши ошибки</b></button>
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
      <div class="en-modes">${EN_MODES.map(([key, title, sub, ic]) => `<button type="button" class="en-mode" data-action="en-ex" data-mode="${key}"><span class="en-step-ic">${icon(ic, "icon-sm")}</span><b>${title}</b><small>${sub}</small></button>`).join("")}<button type="button" class="en-mode" data-action="en-ex" data-mode="theory" data-unit="${esc(cur.key)}"><span class="en-step-ic">${icon("study", "icon-sm")}</span><b>Теория</b><small>Правила, листать по урокам</small></button></div>
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
const EN_LIVE_LABEL = { off: "Голосом", listen: "Слушаю — говорите", hear: "Слышу вас…", think: "Печатает…", speak: "Говорит · нажмите, чтобы перебить" };
function enChatScreen() {
  // Перерисовали чат — окно сообщений остаётся у последней реплики.
  const s = enState();
  const old = document.querySelector(".en-msgs"), count = s.chat?.msgs.length ?? 0;
  const keep = old && s.chat?.seen === count ? old.scrollTop : null;
  if (s.chat) s.chat.seen = count;
  // Недописанное сообщение и курсор переживают перерисовку.
  const field = document.querySelector("[data-en-chat] input"), draft = field?.value || "", focused = document.activeElement === field;
  queueMicrotask(() => {
    const box = document.querySelector(".en-msgs"); if (box) box.scrollTop = keep ?? box.scrollHeight;
    const input = document.querySelector("[data-en-chat] input");
    if (input && draft && !input.value && !s.chat?.sent) input.value = draft;
    if (input && focused) input.focus();
    if (s.chat) s.chat.sent = false;
  });
  if (!s.today) { enLoad("today", "today"); return enWait(); }
  if (!s.chat) enChatStart(s.today.unit.key);
  const c = s.chat;
  const live = enLive.state;
  const tone = s.today.tone || "friend";
  const wordCard = m => !m.word ? "" : `<div class="en-pop">${m.word.loading ? `<span class="live-spin"></span>` : m.word.error ? "Не получилось перевести" : `<span><b>${esc(m.word.lemma)}</b> — ${esc(m.word.ru)}</span>${m.word.phrase && m.word.phrase !== m.word.lemma ? `<small>${esc(m.word.phrase)} — ${esc(m.word.phraseRu)}</small>` : ""}<small class="en-pop-saved">${icon("check", "icon-sm")}${m.word.deck ? `В колоде слов · №${m.word.deck}` : "Во «Фразах»"}</small>`}</div>`;
  const msgs = c.msgs.map((m, i) => m.role === "debrief" ? enDebriefCard(m)
    : m.role === "me"
    ? `<div class="en-msg me"><div class="en-bub me">${esc(m.text)}</div>${m.correction ? `<div class="en-fixline"><span>Лучше сказать</span><b>${esc(m.correction)}</b>${m.explain ? `<small>${esc(m.explain)}</small>` : ""}${m.saved ? `<small class="en-pop-saved">${icon("check", "icon-sm")}В повторениях</small>` : ""}</div>` : ""}${enCoachChips(m)}</div>`
    : `<div class="en-msg ai"><div class="en-bub ai"><span class="en-say" data-say="${i}">${m.streaming ? esc(m.shown || "") : enWords(m.text, i, m.word?.at)}</span>${m.open && m.ru ? `<div class="en-bub-ru">${esc(m.ru)}</div>` : ""}</div>${wordCard(m)}${!m.streaming && m.ru && !m.ruOnly ? `<button type="button" class="en-bub-tr" data-action="en-bubble" data-index="${i}">${m.open ? "Скрыть перевод" : "Перевод"}</button>` : ""}</div>`).join("");
  const status = live === "off" ? esc(c.title || "Разговор") : esc(EN_LIVE_LABEL[live]);
  const aims = c.targets?.length ? `<div class="en-aims">${c.targets.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : "";
  return `<section class="en-chat">
    <div class="en-chat-head"><span class="en-avatar">E</span><div><b>Эмма</b><small class="en-chat-status">${status}</small></div>
      ${c.msgs.filter(m => m.role === "me").length >= 2 && !c.busy ? `<button type="button" class="en-tone" data-action="en-debrief" title="Итоги разговора">Итоги</button>` : ""}<button type="button" class="en-tone ${tone}" data-action="en-tone" title="Тон тренера">${tone === "friend" ? "Друг" : "Вежливо"}</button>
      <button class="icon-button" type="button" data-action="en-chat-reset" aria-label="Начать заново">${icon("reset", "icon-sm")}</button></div>${aims}
    <div class="en-msgs">${msgs}${c.busy && !c.msgs.some(m => m.streaming) ? `<div class="en-msg ai"><div class="en-bub ai typing"><i></i><i></i><i></i></div></div>` : ""}</div>
    <div class="en-live ${live}">
      <form class="en-compose" data-en-chat><input name="text" autocomplete="off" placeholder="Сообщение…" aria-label="Сообщение"><button type="submit" class="en-send" aria-label="Отправить">${icon("arrow", "icon-sm")}</button><button type="button" class="en-mic-btn" data-action="en-live" aria-label="Говорить голосом">${icon("mic", "icon-sm")}</button></form>
      <div class="en-livebar"><button type="button" class="en-livebar-main" data-action="en-live"><span class="en-dot"></span><span class="en-live-state">${esc(EN_LIVE_LABEL[live])}</span></button><button type="button" class="text-action danger" data-action="en-live-stop">Стоп</button></div>
    </div></section>`;
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
  const head = document.querySelector(".en-chat-status");
  if (head) head.textContent = state === "off" ? (enState().chat?.title || "Разговор") : EN_LIVE_LABEL[state];
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
  document.querySelector(".en-dot")?.style.setProperty("--level", Math.min(1, rms * 12).toFixed(2));
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

/** Что тренер сделал с репликой: правило в план, слова в колоду, верное употребление. */
function enCoachChips(m) {
  const chips = [];
  if (m.rule) chips.push(`<button type="button" class="en-chip rule" data-action="en-rule" data-id="${m.rule.id}">${icon("study", "icon-sm")}<span>${m.rule.again ? "Снова задано" : m.rule.isNew ? "Задано правило" : `Правило в работе · ${m.rule.errors}-я ошибка`}: <b>${esc(m.rule.title)}</b></span></button>`);
  if (m.words?.length) chips.push(`<span class="en-chip word">${icon("plus", "icon-sm")}<span>В слова: ${m.words.map(w => `<b>${esc(w.en)}</b> — ${esc(w.ru)}`).join(", ")}</span></span>`);
  for (const u of m.used || []) chips.push(`<span class="en-chip used">${icon("check", "icon-sm")}<span>${u.mastered ? `Освоено: <b>${esc(u.title)}</b>` : `Верно: ${esc(u.title)}`}</span></span>`);
  return chips.length ? `<div class="en-coach">${chips.join("")}</div>` : "";
}
function enApplyFix(mine, f) {
  if (!f) return;
  if (f.correction) Object.assign(mine, { correction: f.correction, explain: f.explain, saved: f.saved });
  if (f.rule) mine.rule = f.rule;
  if (f.words?.length) mine.words = f.words;
  if (f.used?.length) mine.used = f.used;
  if (f.rule || f.used?.length) enState().rulesStale = true;
}
/** Итоги разговора: что получилось, над чем работать, что дальше, что добавилось. */
function enDebriefCard(m) {
  if (m.loading) return `<div class="en-debrief"><b>Итоги разговора</b><span class="live-spin"></span></div>`;
  const list = (title, items) => items?.length ? `<h4>${title}</h4><ul>${items.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const added = [m.words ? `${m.words} ${enPlural(m.words, "слово", "слова", "слов")} в колоду` : "", m.rules ? `${m.rules} ${enPlural(m.rules, "правило", "правила", "правил")} задано` : ""].filter(Boolean).join(" · ");
  return `<div class="en-debrief"><b>Итоги разговора</b>${list("Получилось", m.good)}${list("Поработать", m.work)}${m.next ? `<h4>В следующий раз</h4><p>${esc(m.next)}</p>` : ""}${added ? `<small>${added}</small>` : ""}</div>`;
}

/** Реплика тренера словами-кнопками: нажали слово — перевод и в изучение. */
function enWords(text, index, selected) {
  return String(text || "").split(/(\s+)/).map((part, at) => /[A-Za-z]/.test(part)
    ? `<span class="en-w ${at === selected ? "on" : ""}" data-action="en-word" data-index="${index}" data-at="${at}" data-word="${esc(part.replace(/[^A-Za-z'’-]/g, ""))}">${esc(part)}</span>` : esc(part)).join("");
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
  // Тренер видит и поправки, которые уже показали, — чтобы дать сказать правильно.
  const history = c.msgs.filter(m => m.role !== "debrief").map(m => ({ role: m.role, text: m.text, ...(m.correction ? { correction: m.correction, rule: m.rule?.title } : {}) }));
  c.msgs.push(mine); c.busy = true; c.sent = true;
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
    await window.sorokaEnglishStream({ situation: c.situation, history, text: mine.text, targets: c.targets || [], tone: enState().today?.tone }, (type, data) => {
      if (type === "say") {
        if (!ai) { ai = { role: "ai", text: "", shown: "", streaming: true }; c.msgs.push(ai); index = c.msgs.length - 1; render(); if (enLive.state !== "off") enLiveSet("speak"); }
        ai.text += data.text; enRevealAt(ai, index, data.text);
      } else if (type === "audio") enPlayPcm(data);
      else if (type === "fix") { enApplyFix(mine, data); render(); }
      else if (type === "reply" && ai) { ai.text = data.reply || ai.text; ai.ruOnly = /[а-яё]/i.test(ai.text) && (ai.text.match(/[а-яё]/gi) || []).length > (ai.text.match(/[a-z]/gi) || []).length; }
      else if (type === "ru" && ai) ai.ru = data.ru;
      else if (type === "error" && !ai) throw new Error(data.error || "stream");
    });
    if (!ai) throw new Error("stream-empty");
    done();
  } catch (_) {
    // Без потока: обычный ответ, озвучка следом (файлом).
    try {
      const answer = await enCall("chat", { situation: c.situation, history, text: mine.text, targets: c.targets || [], tone: enState().today?.tone });
      enApplyFix(mine, answer);
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
    enQueue("unitdone", { unit: ex.unit.key, score: ex.ok / ex.done }).then(r => { ex.result = r; enState().today = null; enState().course = null; render(); }).catch(() => {});
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
  if (ex.loading) return `<div class="en-run">${enWait()}${ex.mode === "rule" ? `<p class="section-note en-center">Эмма готовит объяснение и упражнения — новое правило до минуты</p>` : ""}</div>`;
  if (ex.mode === "theory") return enTheoryScreen(ex.theory);
  const total = ex.items.length;
  if (ex.mode === "rule" && ex.index >= total) {
    const r = ex.result;
    const verdict = !r ? `<span class="live-spin"></span>` : r.few ? `<p class="section-note">Засчитывается по упражнениям — сделайте хотя бы три.</p>` : r.passed ? `<p class="en-ok">${icon("check", "icon-sm")}Разобрано. Теперь Эмма проверит его в разговоре: ${r.need} верных употребления — и правило освоено.</p>` : `<p class="en-fix">Верно меньше 80% — давайте ещё раз, предложения будут другие.</p>`;
    return `<div class="en-run en-done"><div class="en-done-mark">${icon("study")}</div><h2>${esc(ex.rule.title)}</h2><p class="muted">Верно ${ex.ok} из ${ex.done}</p>${verdict}
      ${r?.passed ? `<button class="primary-button en-go" type="button" data-action="en-rule-talk">${icon("mic", "icon-sm")}Проверить в разговоре</button>` : r && !r.few ? `<button class="primary-button en-go" type="button" data-action="en-rule" data-id="${ex.rule.id}">Ещё раз</button>` : ""}<button class="ghost-button" type="button" data-action="en-ex-quit">Готово</button></div>`;
  }
  if (ex.index >= total) {
    return `<div class="en-run en-done"><div class="en-done-mark">${icon("check")}</div><h2>Готово</h2><p class="muted">Верно ${ex.ok} из ${ex.done}</p>
      <button class="primary-button en-go" type="button" data-action="en-ex" data-mode="${ex.mode}">Ещё раз</button><button class="ghost-button" type="button" data-action="en-ex-quit">К курсу</button></div>`;
  }
  const item = ex.items[ex.index];
  const mode = item.mode || ex.mode;
  const lessonRun = ex.mode === "lesson" || ex.mode === "rule";
  const title = lessonRun ? "" : EN_MODES.find(m => m[0] === mode)?.[1] || "";
  const skip = lessonRun && item.section !== "Разговор" ? `<button class="text-action en-skip" type="button" data-action="en-skip">Пропустить</button>` : `<small>${ex.index + 1}/${total}</small>`;
  const top = `<div class="en-run-top"><button class="icon-button" type="button" data-action="en-ex-quit" aria-label="Закончить">${icon("close", "icon-sm")}</button><div class="en-bar"><i style="width:${Math.round(ex.index / total * 100)}%"></i></div>${skip}</div>${lessonRun ? enLessonTop(ex) : ""}${title ? `<p class="en-kicker">${esc(title)}</p>` : ""}`;
  if (mode === "words") return `<div class="en-run">${top}${ex.deck ? enDeckScreen(ex.deck) : enWait()}</div>`;
  if (mode === "theory") {
    const t = item.theory || {};
    return `<div class="en-run">${top}<p class="en-kicker">${ex.mode === "rule" ? "Задано Эммой" : `Урок ${ex.unit?.number || ""}`} · ${esc(item.grammar || "")}</p><h2 class="en-prompt">${esc(t.title || "")}</h2><section class="en-theory-part"><p>${esc(t.text || "")}</p>${(t.examples || []).map(([en, ru]) => `<div class="en-example"><button class="icon-button en-play" type="button" data-action="en-say" data-text="${esc(en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button><div><b>${esc(en)}</b><small>${esc(ru)}</small></div></div>`).join("")}</section><button class="primary-button en-go" type="button" data-action="en-ex-next">Понятно</button></div>`;
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
  // Теорию можно читать подряд, как учебник: соседние уроки — стрелками.
  const units = enState().course?.units || [];
  const at = units.findIndex(u => u.key === t.key);
  const prev = at > 0 ? units[at - 1] : null, next = at >= 0 && at < units.length - 1 ? units[at + 1] : null;
  const nav = at >= 0 ? `<div class="en-theory-nav">${prev ? `<button class="ghost-button" type="button" data-action="en-ex" data-mode="theory" data-unit="${esc(prev.key)}">${icon("left", "icon-sm")}Урок ${prev.number}</button>` : "<span></span>"}${next ? `<button class="ghost-button" type="button" data-action="en-ex" data-mode="theory" data-unit="${esc(next.key)}">Урок ${next.number}${icon("right", "icon-sm")}</button>` : "<span></span>"}</div>` : "";
  return `<div class="en-run"><div class="en-run-top"><button class="icon-button" type="button" data-action="en-ex-quit" aria-label="Закрыть">${icon("close", "icon-sm")}</button><small>${esc(t.title)}</small></div>
    <h2 class="en-prompt">${esc(t.heading)}</h2><p class="en-ru">${esc(t.goal)}</p>${parts}${nav}
    <div class="en-actions"><button class="ghost-button" type="button" data-action="en-ex" data-mode="gap" data-unit="${esc(t.key)}">Пропуск</button><button class="primary-button" type="button" data-action="en-ex" data-mode="build" data-unit="${esc(t.key)}">Собери фразу</button></div></div>`;
}

const enNorm = v => String(v || "").toLowerCase().replace(/[’`]/g, "'").replace(/\bi'm\b/g, "i am").replace(/\b(\w+)n't\b/g, "$1 not").replace(/\bi'd\b/g, "i would").replace(/[.,!?;:"]/g, " ").replace(/\s+/g, " ").trim();

function enExAnswer(ok, extra = {}) {
  const ex = enState().ex;
  const item = ex.items[ex.index];
// В расписание — только фразы, которые уже учатся; раньше срока сервер интервал не двигает.
  const mode = item.mode || ex.mode;
  const real = ex.mode === "lesson" && mode === "recall"; // проверка без подсказки — настоящая оценка
  if ((item.introduced || real) && !enRecord("grade", { id: item.id, rating: extra.rating ?? (ok ? 3 : 1), answer: extra.typed || extra.said || "", correct: ok, practice: !real, attempt: `${item.id}-${Date.now()}-${ex.index}` })) return;
  ex.answer = { ok, ...extra }; ex.done++; if (ok) ex.ok++;
  // Не вспомнили в уроке — ещё раз перед разговором (один раз).
  if (real && !ok && !item.again) { const talk = ex.items.findIndex(i => i.mode === "talk"); ex.items.splice(talk < 0 ? ex.items.length : talk, 0, { ...item, again: true }); }
  render();
  if (ok || ["dictation", "cards"].includes(mode)) enSpeak(item.en);
}
function enExNext() {
  const ex = enState().ex;
  ex.index++; ex.answer = null; ex.picked = []; ex.checking = false;
  if (ex.mode === "lesson") enLessonEnter();
  if (ex.mode === "rule" && ex.index >= ex.items.length) enRuleFinish(ex);
  render();
  if (ex.mode !== "lesson" && ex.items[ex.index] && ex.mode === "dictation") enSpeak(ex.items[ex.index].en);
}

// ------------------------------------------------------------ чтение
// Читать много и чуть ниже своего уровня — так слова учатся из контекста.
// Незнакомое слово: нажали — облачко с переводом по смыслу предложения,
// слово подсвечивается во всей книге и уходит в колоду (её повторит FSRS).

const EN_BOOK_LEVELS = ["A1", "A2", "B1", "B2"];
function enBooksScreen() {
  const s = enState();
  if (!s.books) { enLoad("books", "books"); return enWait(); }
  const items = s.books.items || [];
  const card = b => `<button type="button" class="en-book" data-action="en-book" data-id="${b.id}"><span class="en-book-cover lvl-${esc(b.level || "x")}">${esc(b.level || "📖")}</span><span class="en-book-text"><b>${esc(b.title)}</b><small>${esc(b.author || "")}${b.pages ? ` · ${b.pages} ${enPlural(b.pages, "страница", "страницы", "страниц")}` : ""}${b.marks ? ` · ${b.marks} ${enPlural(b.marks, "слово", "слова", "слов")}` : ""}${b.tr_pages ? ` · перевод ${Math.min(100, Math.round(b.tr_pages / b.pages * 100))}%` : b.tr_all ? " · переводится" : ""}</small>${b.page ? `<span class="en-bar slim"><i style="width:${Math.round((b.page + 1) / b.pages * 100)}%"></i></span>` : ""}</span>${icon("arrow", "icon-sm")}</button>`;
  const last = items.find(b => b.opened_at);
  const mine = items.filter(b => b.source === "upload");
  const ready = EN_BOOK_LEVELS.map(level => { const list = items.filter(b => b.source === "builtin" && b.level === level); return list.length ? `<p class="en-book-level">${EN_LEVEL_NAMES[level]}</p>${list.map(card).join("")}` : ""; }).join("");
  return `${last ? `<section class="en-hero en-continue"><small>Продолжить</small>${card(last)}</section>` : ""}
    <section class="en-hero"><div class="en-hero-top"><div><h2>Своя книга</h2><small>txt, fb2, epub или pdf · незнакомое слово — нажать, вся страница — «Перевод»</small></div></div>
      <label class="primary-button en-go en-upload">${icon("upload", "icon-sm")}${s.uploading ? esc(typeof s.uploading === "string" ? s.uploading : "Загружаю…") : "Загрузить книгу"}<input type="file" accept=".txt,.fb2,.epub,.pdf,text/plain,application/epub+zip,application/pdf" data-en-upload hidden></label>
      ${mine.map(card).join("")}</section>
    <section class="en-situation"><div class="en-row"><b>Рассказы по уровням</b><small>написаны для Flow</small></div>${ready}</section>`;
}

// Читалка на весь экран: тап в середину — панели, у краёв или свайп — листать.
// Настройки внешнего вида — только на этом телефоне (localStorage).
const EN_READER_THEMES = [["dark", "Тёмный"], ["black", "Чёрный"], ["sepia", "Сепия"], ["light", "Светлый"]];
const EN_READER_DEFAULT = { theme: "dark", size: 19, lh: 1.7, font: "serif", bright: 1, contrast: 1, tr: false };
function enReaderPrefs() {
  const s = enState();
  if (!s.readerPrefs) { let saved = {}; try { saved = JSON.parse(localStorage.getItem("flow-en-reader") || "{}"); } catch (_) {} s.readerPrefs = { ...EN_READER_DEFAULT, ...saved }; }
  return s.readerPrefs;
}
function enReaderSave(patch) {
  const r = Object.assign(enReaderPrefs(), patch);
  try { localStorage.setItem("flow-en-reader", JSON.stringify(r)); } catch (_) {}
  render();
}
// Кнопка «назад» Telegram (стрелка в шапке и «назад» на Android) закрывает книгу.
function enTgBack(show) {
  const back = window.Telegram?.WebApp?.BackButton;
  if (!back) return;
  if (!enTgBack.bound) { enTgBack.bound = true; back.onClick(() => { const s = enState(); if (s.readerSet || s.pop) { s.readerSet = false; s.pop = null; render(); } else if (s.book) { s.book = null; s.pop = null; s.books = null; render(); enTgBack(false); } }); }
  show ? back.show() : back.hide();
}
function enReaderScreen() {
  const s = enState(), b = s.book, r = enReaderPrefs();
  enTgBack(true);
  const style = `--rs:${r.size}px;--rl:${r.lh};--rfilter:brightness(${r.bright}) contrast(${r.contrast})`;
  if (b.loading) return `<div class="en-reader theme-${r.theme}" style="${style}"><div class="en-reader-wait">${enWait()}</div></div>`;
  const marks = new Set((b.marks || []).map(w => w.toLowerCase()));
  // Перевод — под каждым абзацем, как в двуязычных книгах: сверять предложение с предложением.
  const tr = r.tr ? b.tr : null;
  const blocks = String(b.body || "").split(/\n\s*\n/);
  // Двуязычная книга: русский абзац после английского — готовый перевод, показываем его вместо машинного.
  const ru = blocks.map(enIsRu);
  const paras = blocks.map((p, i) => ru[i] ? (r.tr ? `<p class="en-tr own">${esc(p)}</p>` : "") : `<p>${p.split(/(\s+)/).map(part => {
    const w = part.replace(/[^A-Za-z'’-]/g, "").replace(/^['’-]+|['’-]+$/g, "");
    if (!w) return esc(part);
    return `<span class="en-rw ${marks.has(w.toLowerCase()) ? "mark" : ""} ${s.pop?.w === w.toLowerCase() ? "on" : ""}" data-action="en-rword" data-w="${esc(w)}">${esc(part)}</span>`;
  }).join("")}</p>${!r.tr || ru[i + 1] ? "" : tr ? tr[i] ? `<p class="en-tr">${esc(tr[i])}</p>` : "" : b.trError ? "" : `<p class="en-tr wait"><i></i><i></i></p>`}`).join("");
  b.bilingual = ru.some(Boolean);
  const enter = b.enter ? `enter-${b.enter > 0 ? "next" : "prev"}` : "";
  b.enter = 0; // анимация — один раз, при следующей перерисовке страница уже стоит на месте
  // Машинный перевод нужен, только если есть английский абзац без русской пары.
  if (r.tr && blocks.some((p, i) => !ru[i] && /[A-Za-z]/.test(p) && !ru[i + 1])) enBookTr(b);
  const pop = s.pop ? `<div class="en-pop en-rpop" style="top:${s.pop.y}px;left:${s.pop.x}px">${s.pop.loading ? `<span class="live-spin"></span>` : s.pop.error ? "Не получилось перевести" : `<div class="en-pop-head"><b>${esc(s.pop.lemma)}</b><button class="icon-button en-play" type="button" data-action="en-say" data-text="${esc(s.pop.lemma)}" aria-label="Послушать">${icon("play", "icon-sm")}</button></div><span>${esc(s.pop.ru)}</span>${s.pop.phrase && s.pop.phrase !== s.pop.lemma ? `<small>${esc(s.pop.phrase)} — ${esc(s.pop.phraseRu)}</small>` : ""}<div class="en-pop-foot"><small class="en-pop-saved">${icon("check", "icon-sm")}${s.pop.deck ? "В колоде слов" : "Во «Фразах»"}</small><button class="text-action" type="button" data-action="en-unmark">Снять</button></div>`}</div>` : "";
  const range = (key, label, min, max, step, val, fmt) => `<label class="en-rset-row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-en-rset="${key}"><small>${fmt(val)}</small></label>`;
  const settings = s.readerSet ? `<div class="en-rset" data-en-rsheet>
      <div class="en-rset-themes">${EN_READER_THEMES.map(([k, l]) => `<button type="button" class="en-rtheme theme-${k} ${r.theme === k ? "on" : ""}" data-action="en-rtheme" data-theme="${k}">Аа<small>${l}</small></button>`).join("")}</div>
      ${range("bright", "Яркость", .4, 1.2, .05, r.bright, v => `${Math.round(v * 100)}%`)}
      ${range("contrast", "Контраст", .6, 1.5, .05, r.contrast, v => `${Math.round(v * 100)}%`)}
      ${range("size", "Шрифт", 14, 30, 1, r.size, v => `${v}`)}
      ${range("lh", "Интервал", 1.3, 2.2, .1, r.lh, v => Number(v).toFixed(1))}
      <div class="en-rset-fonts"><button type="button" class="${r.font === "serif" ? "on" : ""}" data-action="en-rfont" data-font="serif" style="font-family:Georgia,serif">С засечками</button><button type="button" class="${r.font === "sans" ? "on" : ""}" data-action="en-rfont" data-font="sans">Без засечек</button></div>
      ${enWholeBook(b)}
      <button type="button" class="text-action" data-action="en-rreset">Сбросить</button>
    </div>` : "";
  return `<div class="en-reader theme-${r.theme} font-${r.font} ${s.readerUi ? "ui" : ""}" style="${style}">
    <header class="en-reader-bar top"><button class="icon-button" type="button" data-action="en-book-close" aria-label="К книгам">${icon("left", "icon-sm")}</button><div class="en-reader-title"><b>${esc(b.title)}</b><small>${esc(b.author || "")}${b.level ? ` · ${esc(b.level)}` : ""}</small></div><button class="icon-button" type="button" data-action="en-say" data-text="${esc(String(b.body || "").split(/\n\s*\n/)[0].slice(0, 480))}" aria-label="Послушать начало страницы">${icon("play", "icon-sm")}</button><button class="en-aa ${r.tr ? "on" : ""}" type="button" data-action="en-rtr" aria-pressed="${Boolean(r.tr)}" aria-label="Перевод страницы">RU</button><button class="en-aa" type="button" data-action="en-rset" aria-label="Настройки чтения">Aa</button></header>
    <div class="en-reader-scroll"><article class="en-page-text ${enter}" data-reader-tap>${b.trError && r.tr ? `<p class="en-tr-error">Перевод не получился — <button type="button" class="text-action" data-action="en-rtr-retry">ещё раз</button></p>` : ""}${paras}${pop}<p class="en-page-num">${b.page + 1} / ${b.pages}</p></article></div>
    ${!s.readerUi && !s.readerSet ? `<button type="button" class="en-exit-fab" data-action="en-book-close" aria-label="Закрыть книгу">${icon("left", "icon-sm")}Книги</button><button type="button" class="en-tr-fab ${r.tr ? "on" : ""}" data-action="en-rtr" aria-pressed="${Boolean(r.tr)}">${r.tr ? "Скрыть перевод" : "Перевод"}</button>` : ""}
    <footer class="en-reader-bar bottom"><button class="icon-button" type="button" data-action="en-page" data-d="-1" ${b.page ? "" : "disabled"} aria-label="Назад">${icon("left", "icon-sm")}</button><input type="range" min="1" max="${b.pages}" value="${b.page + 1}" data-en-pageslider aria-label="Страница"><small>${b.page + 1}/${b.pages} · ${Math.round((b.page + 1) / b.pages * 100)}%</small><button class="icon-button" type="button" data-action="en-page" data-d="1" ${b.page + 1 < b.pages ? "" : "disabled"} aria-label="Дальше">${icon("right", "icon-sm")}</button></footer>
    ${settings}</div>`;
}
const enIsRu = p => (p.match(/[а-яё]/gi) || []).length > (p.match(/[a-z]/gi) || []).length;
/**
 * «Переводить книгу»: частями по 15% — та часть, где вы читаете; следующая —
 * когда до неё дойдёте. Переводит сервер в фоне, приложение можно закрыть.
 */
function enWholeBook(b) {
  if (b.bilingual) return `<div class="en-rset-whole"><span>Перевод уже в книге<small>Русские абзацы показываются по кнопке «Перевод», без машинного перевода</small></span></div>`;
  if ((b.trPages || 0) >= b.pages) return `<div class="en-rset-whole"><span>${icon("check", "icon-sm")} Вся книга переведена<small>Перевод каждой страницы открывается сразу</small></span></div>`;
  const pct = n => Math.round(n / b.pages * 100);
  if (b.trAll) {
    const p = b.part, left = p ? p.to - p.from - p.ready : 0;
    const now = p ? left ? `Сейчас ${pct(p.from)}–${pct(p.to)}% книги: готово ${p.ready} из ${p.to - p.from} стр., ≈ ${Math.ceil(left / 10)} мин` : `${pct(p.from)}–${pct(p.to)}% готово. Следующая часть — когда дочитаете до ${pct(p.to)}%` : "Включено";
    return `<div class="en-rset-whole"><span>Перевожу по частям<small>${now}</small></span><button type="button" class="text-action" data-action="en-trall" data-on="0">Выключить</button></div>`;
  }
  return `<div class="en-rset-whole"><span>Переводить книгу по частям<small>По 15% — та часть, где вы читаете; следующая — когда до неё дойдёте. На сервере в фоне</small></span><button type="button" class="ghost-button" data-action="en-trall" data-on="1">Включить</button></div>`;
}

// Страницы, которые уже видели или подгрузили заранее: листание без ожидания.
const enPages = new Map();
let enBookRequest = 0;
async function enBookOpen(id, page, dir = 0) {
  const request = ++enBookRequest;
  const s = enState();
  s.pop = null;
  const marks = s.book?.id === id ? s.book.marks : null;
  const hit = page !== undefined && enPages.get(`${id}:${page}`);
  const show = data => {
    if (request !== enBookRequest) return;
    s.book = { ...data, marks: marks ? [...new Set([...marks, ...(data.marks || [])])] : data.marks || [], enter: dir };
    render();
    document.querySelector(".en-reader-scroll")?.scrollTo({ top: 0 });
    enBookPeek(s.book.id, s.book.page + 1); enBookPeek(s.book.id, s.book.page - 1);
  };
  if (hit) { show(hit); enCall("book", { id, page }).catch(() => {}); return; } // закладка — на сервере, без ожидания
  s.book = { ...(s.book?.id === id ? s.book : {}), id, loading: !s.book || s.book.id !== id };
  render();
  try {
    const data = await enCall("book", page === undefined ? { id } : { id, page });
    if (data?.error) throw new Error(data.error);
    enPages.set(`${id}:${data.page}`, data);
    if (enPages.size > 80) enPages.delete(enPages.keys().next().value);
    show(data);
  } catch (_) { if (request === enBookRequest) { s.book = null; toast("Не получилось открыть книгу"); render(); } }
}
function enBookPeek(id, page) {
  const s = enState();
  if (page < 0 || page >= (s.book?.pages ?? 0) || enPages.has(`${id}:${page}`)) return;
  enPages.set(`${id}:${page}`, null);
  enCall("book", { id, page, peek: true }).then(data => { if (data && !data.error) { enPages.set(`${id}:${page}`, data); if (enReaderPrefs().tr) enBookTr(data, true); } else enPages.delete(`${id}:${page}`); })
    .catch(() => enPages.delete(`${id}:${page}`));
}
/** Перевод страницы: один раз на сервере, потом из базы; следующая — заранее, пока читаете эту. */
function enBookTr(b, quiet = false) {
  if (!b || b.tr || b.trLoading || b.trError || b.loading || !b.body) return;
  b.trLoading = true;
  enCall("booktr", { id: b.id, page: b.page }).then(r => {
    if (r?.error || !Array.isArray(r?.tr)) throw new Error(r?.error || "tr");
    b.tr = r.tr;
    const cached = enPages.get(`${b.id}:${b.page}`); if (cached) cached.tr = r.tr;
    const cur = enState().book;
    if (cur && cur.id === b.id && cur.page === b.page) { cur.tr = r.tr; if (!quiet || cur === b) render(); }
  }).catch(() => { b.trError = true; if (!quiet) render(); }).finally(() => { b.trLoading = false; });
}
/** Перелистнуть с анимацией: страница уезжает, новая въезжает с другой стороны. */
const enReduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function enTurn(d) {
  const s = enState(), b = s.book;
  const art = document.querySelector(".en-page-text");
  const next = b ? b.page + d : -1;
  if (!b || b.loading || next < 0 || next >= b.pages) { if (art) { art.style.transition = "transform .25s cubic-bezier(.2,.8,.2,1)"; art.style.transform = ""; art.style.opacity = ""; } return; }
  s.pop = null;
  if (!art || enReduceMotion()) { enBookOpen(b.id, next, 0); return; }
  art.style.transition = "transform .17s ease-in, opacity .17s ease-in";
  art.style.transform = `translateX(${d > 0 ? -38 : 38}%)`; art.style.opacity = "0";
  setTimeout(() => enBookOpen(b.id, next, d), 150);
}
/** Предложение вокруг слова — для перевода по смыслу. */
function enSentenceAround(span) {
  const text = span.closest("p")?.textContent || "";
  const at = text.indexOf(span.textContent);
  const start = Math.max(text.lastIndexOf(".", at - 1), text.lastIndexOf("!", at - 1), text.lastIndexOf("?", at - 1)) + 1;
  const ends = [".", "!", "?"].map(c => text.indexOf(c, at)).filter(i => i >= 0);
  return text.slice(start, ends.length ? Math.min(...ends) + 1 : undefined).trim().slice(0, 300);
}
const enBookCache = new Map();
// Нажатие в тексте мимо слова: открыто облачко — закрыть; у краёв — листать; в середине — панели.
document.addEventListener("click", event => {
  const s = enState();
  const page = event.target.closest?.("[data-reader-tap]");
  if (!page || event.target.closest(".en-rw, .en-rpop") || enReaderSwiped) return;
  if (s.pop || s.readerSet) { s.pop = null; s.readerSet = false; render(); return; }
  const x = event.clientX / window.innerWidth;
  if (x < .22 && s.book.page > 0) enTurn(-1);
  else if (x > .78 && s.book.page + 1 < s.book.pages) enTurn(1);
  else { s.readerUi = !s.readerUi; render(); }
});
let enReaderTouch = null, enReaderSwiped = false;
document.addEventListener("pointerdown", event => { if (event.target.closest?.("[data-reader-tap]")) { enReaderTouch = { x: event.clientX, y: event.clientY, t: Date.now(), drag: false }; enReaderSwiped = false; } });
// Свайп: страница идёт за пальцем; на первой и последней — тянется туго и возвращается.
document.addEventListener("pointermove", event => {
  const t = enReaderTouch;
  if (!t || enReduceMotion()) return;
  const dx = event.clientX - t.x, dy = event.clientY - t.y, b = enState().book;
  if (!t.drag) { if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) t.drag = true; else return; }
  const art = document.querySelector(".en-page-text");
  if (!art || !b) return;
  const edge = (dx > 0 && b.page === 0) || (dx < 0 && b.page + 1 >= b.pages);
  art.style.transition = "none";
  art.style.transform = `translateX(${edge ? dx * .22 : dx}px)`;
  art.style.opacity = String(1 - Math.min(.45, Math.abs(dx) / window.innerWidth * .55));
});
const enSwipeEnd = event => {
  const t = enReaderTouch;
  if (!t) return;
  enReaderTouch = null;
  const dx = event.clientX - t.x, dy = event.clientY - t.y, s = enState();
  const fast = Math.abs(dx) / Math.max(1, Date.now() - t.t) > .5;
  if (event.type !== "pointercancel" && (t.drag || Math.abs(dx) > 70) && (Math.abs(dx) > 70 || (fast && Math.abs(dx) > 30)) && Math.abs(dx) > Math.abs(dy) * 1.5 && s.book && !s.book.loading) {
    enReaderSwiped = true; setTimeout(() => { enReaderSwiped = false; }, 300);
    enTurn(dx < 0 ? 1 : -1);
  } else if (t.drag) {
    enReaderSwiped = true; setTimeout(() => { enReaderSwiped = false; }, 300);
    const art = document.querySelector(".en-page-text");
    if (art) { art.style.transition = "transform .25s cubic-bezier(.2,.8,.2,1), opacity .25s"; art.style.transform = ""; art.style.opacity = ""; }
  }
};
document.addEventListener("pointerup", enSwipeEnd);
document.addEventListener("pointercancel", enSwipeEnd);
document.addEventListener("keydown", event => {
  const s = enState();
  if (!s.book || s.book.loading || ui.page !== "english" || s.tab !== "read" || event.target.closest?.("input, textarea")) return;
  if (event.key === "ArrowRight" || event.key === "PageDown") { event.preventDefault(); enTurn(1); }
  if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); enTurn(-1); }
});
document.addEventListener("input", event => {
  const key = event.target.dataset?.enRset;
  if (!key) return;
  // Ползунок — сразу на экране, без перерисовки (иначе он «прыгает» под пальцем).
  const r = enReaderPrefs(); r[key] = Number(event.target.value);
  const box = document.querySelector(".en-reader");
  if (box) { box.style.setProperty("--rs", `${r.size}px`); box.style.setProperty("--rl", r.lh); box.style.setProperty("--rfilter", `brightness(${r.bright}) contrast(${r.contrast})`); }
  const out = event.target.nextElementSibling; if (out) out.textContent = key === "lh" ? Number(r.lh).toFixed(1) : key === "size" ? r.size : `${Math.round(r[key] * 100)}%`;
});
document.addEventListener("change", event => {
  if (event.target.dataset?.enRset) { enReaderSave({}); return; }
  if (event.target.matches?.("[data-en-pageslider]")) { const s = enState(); enBookOpen(s.book.id, Number(event.target.value) - 1); }
});
function enReadWord(control) {
  const s = enState(), b = s.book;
  const w = control.dataset.w, key = w.toLowerCase();
  if (s.pop?.w === key) { s.pop = null; render(); return; }
  const box = document.querySelector(".en-page-text").getBoundingClientRect(), r = control.getBoundingClientRect();
  const x = Math.max(6, Math.min(box.width - 236, r.left - box.left + r.width / 2 - 115)), y = r.bottom - box.top + 6;
  const cached = enBookCache.get(key);
  s.pop = cached ? { ...cached, w: key, x, y } : { loading: true, w: key, x, y };
  if (!b.marks.map(m => m.toLowerCase()).includes(key)) b.marks = [...b.marks, key];
  render();
  if (cached) return;
  enCall("bookword", { id: b.id, word: w, sentence: enSentenceAround(control) }).then(answer => {
    if (answer?.error) throw new Error(answer.error);
    enBookCache.set(key, answer);
    if (s.pop?.w === key) s.pop = { ...answer, w: key, x, y };
  }).catch(() => { if (s.pop?.w === key) s.pop = { error: true, w: key, x, y }; }).finally(() => render());
}

// Своя книга: txt (UTF-8 или Windows-1251), fb2 (XML), epub (zip с xhtml) — разбираем здесь.
function enDecode(bytes) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch (_) { return new TextDecoder("windows-1251").decode(bytes); }
}
async function enUnzip(buf) {
  const v = new DataView(buf), u8 = new Uint8Array(buf), files = new Map();
  let end = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if (v.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error("not_zip");
  let p = v.getUint32(end + 16, true);
  const count = v.getUint16(end + 10, true);
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), nameLen = v.getUint16(p + 28, true), extra = v.getUint16(p + 30, true), comment = v.getUint16(p + 32, true), local = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
    files.set(name, { method, size, local });
    p += 46 + nameLen + extra + comment;
  }
  return async name => {
    const f = files.get(name);
    if (!f) return null;
    const start = f.local + 30 + v.getUint16(f.local + 26, true) + v.getUint16(f.local + 28, true);
    const data = u8.subarray(start, start + f.size);
    if (f.method === 0) return data;
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  };
}
// PDF: текст достаёт pdf.js (грузится только когда выбрали pdf). Строки
// собираем по высоте, абзац — где межстрочный пропуск заметно больше обычного;
// перенос «exam-/ple» склеиваем, номера страниц и повторяющиеся колонтитулы убираем.
const EN_PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
let enPdfLib = null;
function enPdfJs() {
  return enPdfLib ||= new Promise((ok, fail) => {
    const tag = document.createElement("script");
    tag.src = `${EN_PDFJS}pdf.min.js`;
    tag.onload = () => { const lib = window.pdfjsLib; if (!lib) { fail(new Error("pdfjs")); return; } lib.GlobalWorkerOptions.workerSrc = `${EN_PDFJS}pdf.worker.min.js`; ok(lib); };
    tag.onerror = () => { enPdfLib = null; fail(new Error("pdfjs")); };
    document.head.append(tag);
  });
}
function enPdfLines(items) {
  const lines = [];
  let cur = null;
  for (const it of items) {
    if (typeof it.str !== "string") continue;
    const y = it.transform[5], h = Math.abs(it.transform[3]) || it.height || 10;
    if (!cur || Math.abs(cur.y - y) > h * .5) { cur = { y, h, text: "" }; lines.push(cur); }
    // Слова в PDF бывают отдельными кусками без пробела между ними — пробел по зазору.
    const space = cur.text && !/\s$/.test(cur.text) && !/^\s/.test(it.str) && it.transform[4] - (cur.x ?? it.transform[4]) > h * .15;
    cur.text += (space ? " " : "") + it.str;
    cur.x = it.transform[4] + (it.width || 0);
    if (it.hasEOL) cur = null;
  }
  return lines.map(l => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() })).filter(l => l.text);
}
function enPdfParas(lines, drop) {
  const kept = lines.filter(l => !/^\d{1,4}$/.test(l.text) && !drop.has(l.text.replace(/\d+/g, "#")));
  const gaps = kept.slice(1).map((l, i) => kept[i].y - l.y).filter(g => g > 0).sort((a, b) => a - b);
  const usual = gaps[Math.floor(gaps.length / 2)] || 14;
  const width = Math.max(...kept.map(l => l.text.length), 1);
  const paras = [];
  let cur = "";
  kept.forEach((l, i) => {
    const prev = kept[i - 1];
    const gap = prev ? prev.y - l.y : 0;
    const shortEnd = prev && prev.text.length < width * .7 && /[.!?:"”»)]$/.test(prev.text);
    if (cur && (gap > usual * 1.45 || gap < 0 || shortEnd)) { paras.push(cur); cur = ""; }
    cur = !cur ? l.text : /[A-Za-z]-$/.test(cur) && /^[a-z]/.test(l.text) ? cur.slice(0, -1) + l.text : `${cur} ${l.text}`;
  });
  if (cur) paras.push(cur);
  return paras;
}
async function enParsePdf(buf, name, progress) {
  const lib = await enPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    pages.push(enPdfLines((await page.getTextContent()).items));
    page.cleanup();
    if (i % 5 === 0 || i === doc.numPages) progress?.(`Читаю PDF: ${i} из ${doc.numPages}`);
  }
  // Колонтитулы — строка (без цифр) на трети страниц и больше.
  const seen = new Map();
  for (const lines of pages) for (const t of new Set(lines.map(l => l.text.replace(/\d+/g, "#")))) seen.set(t, (seen.get(t) || 0) + 1);
  const drop = new Set([...seen].filter(([t, n]) => pages.length >= 6 && n >= pages.length / 3 && t.length < 90).map(([t]) => t));
  const paras = [];
  for (const lines of pages) {
    const list = enPdfParas(lines, drop);
    // Абзац, оборванный на краю страницы, продолжается на следующей.
    if (paras.length && list.length && !/[.!?:"”»)]$/.test(paras[paras.length - 1]) && /^[a-z]/.test(list[0])) paras[paras.length - 1] += " " + list.shift();
    paras.push(...list);
  }
  const meta = await doc.getMetadata().catch(() => null);
  return { title: meta?.info?.Title?.trim() || name, author: meta?.info?.Author?.trim() || "", text: paras.join("\n\n") };
}
const enBlocks = doc => [...doc.querySelectorAll("h1, h2, h3, p, li, blockquote")].map(n => n.textContent.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n\n");
async function enParseBook(file, progress) {
  const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+pdf$/i, "").trim();
  const buf = await file.arrayBuffer();
  if (/\.pdf$/i.test(file.name) || new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(5, buf.byteLength))) === "%PDF-") return await enParsePdf(buf, name, progress);
  if (/\.epub$/i.test(file.name)) {
    const read = await enUnzip(buf);
    const text = async n => { const b = await read(n); return b ? new TextDecoder().decode(b) : ""; };
    const container = new DOMParser().parseFromString(await text("META-INF/container.xml"), "application/xml");
    const opfPath = container.querySelector("rootfile")?.getAttribute("full-path") || "";
    const opf = new DOMParser().parseFromString(await text(opfPath), "application/xml");
    const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
    const manifest = new Map([...opf.getElementsByTagName("item")].map(i => [i.getAttribute("id"), i.getAttribute("href")]));
    const parts = [];
    for (const ref of opf.getElementsByTagName("itemref")) {
      const href = manifest.get(ref.getAttribute("idref"));
      if (!href) continue;
      const html = await text(decodeURIComponent(base + href).replace(/[^/]+\/\.\.\//g, ""));
      parts.push(enBlocks(new DOMParser().parseFromString(html, "text/html")));
    }
    const meta = t => opf.getElementsByTagName(t)[0]?.textContent?.trim();
    return { title: meta("dc:title") || name, author: meta("dc:creator") || "", text: parts.filter(Boolean).join("\n\n") };
  }
  const raw = enDecode(new Uint8Array(buf));
  if (/\.fb2$/i.test(file.name) || /<FictionBook/i.test(raw.slice(0, 500))) {
    const enc = raw.slice(0, 200).match(/encoding="([^"]+)"/i)?.[1];
    const xml = enc && !/utf-?8/i.test(enc) ? new TextDecoder(enc).decode(new Uint8Array(buf)) : raw;
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const body = [...doc.getElementsByTagName("body")].filter(b => b.getAttribute("name") !== "notes");
    const text = body.map(b => [...b.getElementsByTagName("p")].map(p => p.textContent.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n\n")).join("\n\n");
    const first = doc.getElementsByTagName("first-name")[0]?.textContent || "", last = doc.getElementsByTagName("last-name")[0]?.textContent || "";
    return { title: doc.getElementsByTagName("book-title")[0]?.textContent?.trim() || name, author: `${first} ${last}`.trim(), text };
  }
  // Простой текст: одиночные переносы строк внутри абзаца склеиваем.
  return { title: name, author: "", text: raw.replace(/\r/g, "").replace(/([^\n])\n(?=[^\n\s])/g, "$1 ") };
}
document.addEventListener("change", async event => {
  const input = event.target.closest?.("[data-en-upload]");
  if (!input?.files?.[0]) return;
  const s = enState(), file = input.files[0];
  if (file.size > 60 * 1024 * 1024) { toast("Файл больше 60 МБ"); return; }
  s.uploading = /\.pdf$/i.test(file.name) ? "Открываю PDF…" : true; render();
  try {
    const book = await enParseBook(file, text => { s.uploading = text; render(); });
    if (!book.text || book.text.length < 200) throw new Error(/\.pdf$/i.test(file.name) ? "scan" : "empty");
    const latin = (book.text.slice(0, 5000).match(/[a-z]/gi) || []).length, cyr = (book.text.slice(0, 5000).match(/[а-яё]/gi) || []).length;
    if (cyr > latin) toast("Похоже, книга не на английском — всё равно загружаю");
    const answer = await enCall("bookadd", { title: book.title, author: book.author, text: book.text.slice(0, 3_000_000), attempt: crypto.randomUUID() });
    if (answer?.error) throw new Error(answer.error);
    s.books = null; s.uploading = false;
    toast(`«${book.title}» — ${answer.pages} ${enPlural(answer.pages, "страница", "страницы", "страниц")}`);
    enBookOpen(answer.id, 0);
  } catch (error) { s.uploading = false; render(); toast(error?.message === "scan" ? "В этом PDF нет текста — похоже, это скан страниц" : error?.message === "pdfjs" ? "Не загрузился модуль PDF — проверьте интернет" : "Не получилось прочитать файл — попробуйте txt, fb2, epub или pdf"); }
});

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
  if (action === "en-rule") { enRuleStart(Number(control.dataset.id)); return true; }
  if (action === "en-rule-talk") {
    const rule = s.ex?.rule;
    s.ex = null; s.tab = "chat";
    if (!s.chat) enChatStart();
    if (s.chat && rule?.example?.correction) s.chat.targets = [rule.example.correction];
    s.rulesStale = true;
    render(); return true;
  }
  if (action === "en-facts") {
    if (s.facts) { s.facts = null; render(); return true; }
    s.facts = { loading: true, list: [] }; render();
    enCall("facts").then(r => { s.facts = { list: r?.facts || [] }; render(); }).catch(() => { s.facts = null; render(); });
    return true;
  }
  if (action === "en-forget") {
    const index = Number(control.dataset.index);
    const fact = s.facts?.list[index];
    if (s.facts) { s.facts.list.splice(index, 1); if (s.today) s.today.facts = s.facts.list.length; render(); }
    enQueue("forget", { index, fact }).catch(() => toast("Не получилось стереть"));
    return true;
  }
  if (action === "en-debrief") {
    const c = s.chat;
    if (!c || c.busy) return true;
    const history = c.msgs.filter(m => m.role !== "debrief").map(m => ({ role: m.role, text: m.text, ...(m.correction ? { correction: m.correction } : {}) }));
    const card = { role: "debrief", loading: true, words: c.msgs.reduce((n, m) => n + (m.words?.length || 0), 0), rules: c.msgs.filter(m => m.rule?.isNew || m.rule?.again).length };
    c.msgs.push(card); render(); enScrollChat();
    enCall("debrief", { history }).then(r => Object.assign(card, { loading: false, good: r?.good || [], work: r?.work || [], next: r?.next || "" }))
      .catch(() => Object.assign(card, { loading: false, next: "Не получилось подвести итоги — попробуйте ещё раз." })).finally(() => { render(); enScrollChat(); });
    return true;
  }
  if (action === "en-tab") { if (s.tab === "chat" && control.dataset.tab !== "chat") { enStopPcm(); enLiveStop(); } if (s.rulesStale && control.dataset.tab === "today") { s.today = null; s.rulesStale = false; } s.deck = null; s.tab = control.dataset.tab; if (s.tab === "phrases") s.list = null; if (s.tab === "progress") s.progress = null; if (s.tab === "words") { s.words = null; s.wordlist = null; } if (s.tab === "course") s.course = null; if (s.tab === "read") { s.books = null; s.book = null; s.pop = null; } render(); return true; }
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
  if (action === "en-newwords") { const n = Number(control.dataset.n); if (s.words) s.words.newWords = n; render(); enQueue("newwords", { n }).then(() => { s.today = null; }); return true; }
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
  if (action === "en-tone") {
    // Друг без цензуры ↔ вежливый тренер (когда рядом люди).
    const tone = s.today?.tone === "polite" ? "friend" : "polite";
    if (s.today) s.today.tone = tone;
    render(); toast(tone === "friend" ? "Эмма — друг: сленг, шутки, без цензуры" : "Эмма — вежливый тренер");
    enQueue("tone", { tone }).catch(() => {});
    return true;
  }
  if (action === "en-chat-reset") { enStopPcm(); enLiveStop(); s.chat = null; render(); return true; }
  // упражнения
  if (action === "en-ex") { enExStart(control.dataset.mode, control.dataset.unit); return true; }
  if (action === "en-ex-quit") { const back = s.ex?.mode === "rule" ? s.ex.back || "today" : s.ex?.mode === "lesson" ? "today" : "course"; s.ex = null; s.tab = back; s.today = null; render(); return true; }
  if (action === "en-ex-next") { enExNext(); return true; }
  if (action === "en-ex-show") {
    const ex = s.ex, mode = ex.items[ex.index].mode || ex.mode;
    if (mode === "cards" || mode === "listen") { ex.answer = { ok: false, shown: true }; render(); if (mode === "cards") enSpeak(ex.items[ex.index].en); }
    else enExAnswer(false, { verdict: "shown", rating: 1 });
    return true;
  }
  if (action === "en-skip") { const ex = s.ex, sec = ex.items[ex.index].section; ex.deck = null; while (ex.index < ex.items.length && ex.items[ex.index].section === sec) ex.index++; ex.answer = null; ex.picked = []; if (ex.mode === "rule") { if (ex.index >= ex.items.length) enRuleFinish(ex); } else enLessonEnter(); render(); return true; }
  if (action === "en-talk") {
    const item = s.ex.items[s.ex.index], unit = s.ex.unit;
    s.ex = null; s.tab = "chat";
    enChatStart(item.situation, item.title, unit?.topic?.opener); s.chat.targets = item.targets || [];
    render(); enLiveStart();
    return true;
  }
  if (action === "en-ex-rate") {
    const r = Number(control.dataset.rating), ex = s.ex, item = ex.items[ex.index];

    const real = ex.mode === "lesson" && (item.mode === "listen" || item.mode === "recall");
    if (item.introduced && !enRecord("grade", { id: item.id, rating: r, practice: !real, attempt: `${item.id}-${Date.now()}-${ex.index}` })) return true;
    ex.done++; if (r >= 3) ex.ok++;
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
    const at = Number(control.dataset.at);
    // То же слово ещё раз — закрыть облачко.
    if (m.word && m.word.at === at && !m.word.loading) { m.word = null; render(); return true; }
    m.word = { loading: true, at };
    render();
    enCall("word", { word: w, sentence: m.text }).then(answer => { m.word = answer?.error ? { error: true, at } : { ...answer, at }; if (!answer?.error) toast(answer.deck ? `«${answer.lemma}» — в колоде, выйдет на занятии` : `«${answer.lemma}» — во «Фразах»`); })
      .catch(() => { m.word = { error: true, at }; }).finally(() => { render(); });
    return true;
  }
  if (action === "en-book") { enBookOpen(Number(control.dataset.id)); return true; }
  if (action === "en-book-close") { s.book = null; s.pop = null; s.books = null; s.readerSet = false; enTgBack(false); render(); return true; }
  if (action === "en-page") { const b = s.book; if (b && !b.loading) enTurn(Number(control.dataset.d)); return true; }
  if (action === "en-rword") { enReadWord(control); return true; }
  if (action === "en-rtr") {
    const on = !enReaderPrefs().tr;
    if (s.book) s.book.trError = false;
    enReaderSave({ tr: on });
    if (on && s.book) enBookPeek(s.book.id, s.book.page + 1);
    return true;
  }
  if (action === "en-trall") {
    const b = s.book, on = control.dataset.on === "1";
    if (!b) return true;
    b.trAll = on; render();
    enCall("booktrall", { id: b.id, on }).then(r => { if (r && !r.error) { Object.assign(b, r); s.books = null; render(); } }).catch(() => toast("Не получилось — попробуйте ещё раз"));
    toast(on ? "Перевожу по 15% книги — следующую часть, когда до неё дойдёте" : "Перевод по частям выключен");
    return true;
  }
  if (action === "en-rtr-retry") { if (s.book) { s.book.trError = false; enBookTr(s.book); render(); } return true; }
  if (action === "en-rset") { s.readerSet = !s.readerSet; s.pop = null; render(); return true; }
  if (action === "en-rtheme") { enReaderSave({ theme: control.dataset.theme }); return true; }
  if (action === "en-rfont") { enReaderSave({ font: control.dataset.font }); return true; }
  if (action === "en-rreset") { enReaderSave({ ...EN_READER_DEFAULT }); return true; }
  if (action === "en-unmark") {
    const b = s.book, w = s.pop?.w;
    if (!b || !w) return true;
    b.marks = b.marks.filter(m => m.toLowerCase() !== w); s.pop = null; render();
    enCall("bookunmark", { id: b.id, word: w }).catch(() => {});
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
