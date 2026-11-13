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

window.FlowEnglishComposition = Object.freeze({ version: 2 });
function enCall(op, args = {}) {
  if (window.sorokaEnglishSession?.version === 2 && !window.flowEnglishSession) return Promise.reject(new Error("english_owner_not_ready"));
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
  if (op === "course") {
    const topics = [
      ["Знакомство", "to be: am / is / are"],
      ["Мой день", "Present Simple"],
      ["Семья и друзья", "have got"],
      ["Дом и вещи", "there is / there are"],
      ["Еда и покупки", "some / any"],
      ["В городе", "can / can't"],
      ["Планы", "going to"],
      ["Опыт", "Present Perfect"],
      ["Сравнение", "better / the best"],
      ["Выходные", "Past Simple: worked, went"],
      ["Истории", "Past Continuous"],
      ["Советы", "should / shouldn't"],
      ["Работа", "Present Perfect Continuous"],
      ["Новости", "Passive voice"],
      ["Путешествия", "First Conditional"],
      ["Мечты", "Second Conditional"],
    ];
    return { current: 9, units: [...Array(42)].map((_, i) => {
      const [title, grammar] = topics[i % topics.length];
      return { key: `u${i}`, number: i + 1, level: i < 12 ? "A1" : i < 24 ? "A2" : i < 34 ? "B1" : "B2", title, grammar, status: i < 9 ? "done" : i === 9 ? "current" : "next", score: i < 9 ? .85 : null };
    }) };
  }
  if (op === "check") return { verdict: String(args.answer).toLowerCase().includes("went") ? "correct" : "close", correction: "We went to the country.", explain: "Go в прошедшем — went." };
  if (op === "chat") return { reply: "Ooh, almost — 'I've never been there'. Say it again?", replyRu: "О, почти — «I've never been there». Скажешь ещё раз?", correction: "I've never been to London.", explain: "Опыт за всю жизнь — Present Perfect.", saved: 3, rule: { id: 7, title: rule.title, errors: 3, isNew: false, again: false }, words: [{ en: "abroad", ru: "за границей", deck: 2210 }], used: [] };
  if (op === "phrases") return { items: [{ id: 2, en: "I'd like a coffee, please.", ru: "Я бы хотел кофе", source: "mistake", strength: .25 }], counts: { due: 4, mistakes: 9, learned: 12 } };
  if (op === "progress") {
    const counts = [3, 0, 7, 12, 5, 0, 9, 14, 2, 0, 6, 10, 4, 0, 8, 13, 1, 0, 5, 9, 3, 0, 7, 11, 2, 0, 6, 12];
    const labels = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
    return { streak: 4, days: counts.map((count, i) => ({ day: labels[i % 7], count })), words: enDemo("words"), phrases: { total: 60, learned: 14, mistakes: 9 }, course: { done: 9, total: 42, level: "A1", passed: 9 } };
  }
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
  if (op === "songs") return { items: [enDemoSong()] };
  if (op === "song") return { item: enDemoSong() };
  if (op === "songsave") return { item: { ...enDemoSong(), ...(args.track || {}) } };
  if (op === "songlookup") {
    const ru = { the: "определённый артикль", night: "ночь", train: "поезд", leaves: "уходит; листья", station: "станция", slow: "медленно", i: "я", watch: "смотреть", city: "город", lights: "огни", go: "идти", by: "мимо", every: "каждый", window: "окно", holds: "держит", a: "неопределённый артикль", story: "история", waits: "ждёт", for: "к; для", morning: "утро" };
    const word = String(args.word || "").toLowerCase().replace(/[^a-z'’-]/g, "");
    return { word, lemma: word, ru: ru[word] || "перевод", note: "Демо-словарь · Night Train" };
  }
  if (op === "songmark") return { marks: { [args.word]: { ru: args.ru } } };
  if (op === "book") return { id: args.id, title: "The Night Market", author: "Flow", level: "B1", page: args.page ?? 1, pages: 4, marks: ["stalls"], body: "I had been living in Bangkok for three weeks before I found the night market. To be honest, I hadn't been looking for it.\n\nIt was almost ten o'clock, but the street was full of light and noise. Hundreds of small stalls stretched as far as I could see." };
  if (op === "booktrall") return { trAll: args.on !== false, trPages: 0, pages: 4, part: { from: 0, to: 1, ready: 0 } };
  if (op === "booktr") return { page: args.page, tr: ["Я прожил в Бангкоке три недели, прежде чем нашёл ночной рынок.", "Это был перевод второго абзаца.", "И третьего.", "И четвёртого."] };
  if (op === "bookword") {
    const ru = { i: "я", had: "имел", been: "был", living: "живущий", in: "в", bangkok: "Бангкок", for: "в течение", three: "три", weeks: "недели", before: "до", found: "нашёл", night: "ночь", market: "рынок", it: "это", was: "был", almost: "почти", ten: "десять", street: "улица", full: "полный", light: "свет", noise: "шум", stalls: "прилавки", stretched: "тянулись", far: "далеко", could: "мог", see: "видеть" };
    const word = String(args.word || "").toLowerCase().replace(/[^a-z'’-]/g, "");
    return { lemma: word, ru: ru[word] || "перевод", phrase: "", phraseRu: "", deck: 1460 };
  }
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

const EN_TABS = [
  ["today", "День", "Сегодня", "Сегодня"],
  ["words", "Слова", "Слова", "Слова"],
  ["course", "Учить", "Практика", "Учить"],
  ["read", "Медиа", "Медиатека", "Медиа"],
  ["chat", "Чат", "Разговор", "Чат"],
];
const EN_RATINGS = [[1, "Не вспомнил"], [2, "С трудом"], [3, "Легко"]];
const EN_TOTAL = 4380;

// Демо-песня для локальной проверки музыкального экрана и упражнений.
// Живёт только в enDemo: серверная библиотека и нативный плеер её не видят.
let enDemoSongCache = null;
function enDemoSong() {
  if (enDemoSongCache) return enDemoSongCache;
  const rate = 8000, seconds = 12, samples = rate * seconds;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (at, value) => { for (let i = 0; i < value.length; i++) bytes[at + i] = value.charCodeAt(i); };
  text(0, "RIFF"); view.setUint32(4, 36 + samples, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
  text(36, "data"); view.setUint32(40, samples, true); bytes.fill(128, 44);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const source = typeof btoa === "function" ? "data:audio/wav;base64," + btoa(binary) : "";
  enDemoSongCache = {
    id: "demo-night-train",
    title: "Night Train",
    artist: "Flow · демо",
    duration: seconds,
    favorite: false,
    marks: {},
    position: 0,
    rate: 1,
    source,
    demo: true,
    lines: [
      { time: 0.4, end: 3.4, en: "The night train leaves the station slow", ru: "Ночной поезд медленно уходит от станции" },
      { time: 3.6, end: 6.4, en: "I watch the city lights go by", ru: "Я смотрю, как проплывают огни города" },
      { time: 6.6, end: 9.4, en: "Every window holds a story", ru: "В каждом окне — своя история" },
      { time: 9.6, end: 11.8, en: "Every story waits for morning", ru: "Каждая история ждёт утра" },
    ],
    lyricResult: { source: { name: "Демо-библиотека" }, alignment: { method: "manual" }, translationComplete: true },
    analysisStatus: { status: "done" },
  };
  return enDemoSongCache;
}

function enState() {
  ui.en ||= { tab: "today", today: null, chat: null, list: null, filter: "due", q: "", progress: null, course: null, words: null, wordlist: null, wfilter: "learning", wq: "" };
  return ui.en;
}
function enRerender() { if (ui.page === "english" || ui.page === "today") render(); }
function enPlural(n, one, few, many) { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; }
function enWait() {
  const s=enState(), key=({today:'today', chat:'today', words:'words', course:'course', read:'books', progress:'progress', phrases:'list'})[s.tab] || 'today';
  const failed=!s.ex&&!s.deck?s.failedLoads?.[key]:null, error=failed?.error || s.error;
  const action=failed ? 'en-retry' : s.ex ? 'en-ex-quit' : s.deck ? 'en-deck-quit' : 'en-tab';
  return error ? `<section class="en-wait en-load-error" role="status"><strong>Не удалось загрузить</strong><p class="section-note">${esc(error)}</p><button class="ghost-button" type="button" data-action="${action}" data-key="${esc(key)}" data-tab="${esc(s.tab || "today")}">${failed ? "Попробовать снова" : s.ex || s.deck ? "Вернуться к разделу" : "Открыть раздел заново"}</button></section>` : `<section class="en-wait" role="status" aria-busy="true"><span class="live-spin" aria-hidden="true"></span><p class="section-note">Загружаем занятие…</p></section>`;
}
const enNum = n => Number(n || 0).toLocaleString("ru-RU");
const number = enNum;
const enPct = (value, total) => Number.isFinite(value) && Number.isFinite(total) && total > 0
  ? Math.max(0, Math.min(100, Math.round(value / total * 100))) : 0;
const enBar = (value, total, cls = "") => `<div class="en-bar ${cls}" aria-hidden="true"><i style="width:${enPct(value, total)}%"></i></div>`;
const EN_MONTHS_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
function enForecastDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${EN_MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
}

/** Плитка на «Плане»: напоминание о занятии там, где человек и так смотрит каждый день. */
function enHomeTile() {
  const s = enState();
  if (!s.today || Date.now() - (s.todayAt || 0) > 10 * 60_000) {
    if (!s.todayLoading) { s.todayAt = Date.now(); enLoad("today", "today"); }
    if (!s.today) return "";
  }
  const t = s.today;
  if (!t?.plan) return "";
  const done = Boolean(t.plan.doneToday);
  const unit = t.unit?.number ? `Урок ${t.unit.number}` : "Урок";
  const minutes = t.plan.minutes ? ` · ≈ ${t.plan.minutes} мин` : "";
  const title = done ? "Урок пройден" : `${unit}${minutes}`;
  const words = t.words || {};
  const sub = words.total ? `${enNum(words.known)} из ${enNum(words.total)} слов${t.streak ? ` · серия ${t.streak} ${enPlural(t.streak, "день", "дня", "дней")}` : ""}` : "Продолжить занятие";
  return `<section class="section"><button type="button" class="en-home ${done ? "done" : ""}" data-action="en-home"><span class="en-step-ic">${icon(done ? "check" : "study", "icon-sm")}</span><span class="en-home-text"><small>Английский</small><b>${title}</b><span>${sub}</span></span>${icon("arrow", "icon-sm")}</button></section>`;
}
function enLoad(key, op, args = {}) {
  const s = enState(), failed=s.failedLoads?.[key];
  if (failed && failed.op===op && JSON.stringify(failed.args)===JSON.stringify(args)) return false;
  if (failed) delete s.failedLoads[key];
  if (s[`${key}Loading`]) { const current=s[`${key}Request`]; if(!current || current.op!==op || JSON.stringify(current.args)!==JSON.stringify(args))s[`${key}Next`] = { op, args }; return; }
  s[`${key}Request`] = {op,args};
  s[`${key}Loading`] = true;
  const token = Symbol(); s[`${key}Token`] = token;
  enCall(op, args).then(answer => { if (answer?.error) throw new Error(answer.error); if (!s[`${key}Next`] && s[`${key}Token`] === token) s[key] = answer; s.error = ""; })
    .catch(error => { s.error = String(error?.message || error); (s.failedLoads ||= {})[key] = {op, args, error:s.error}; })
    .finally(() => {
      s[`${key}Loading`] = false;
      const next = s[`${key}Next`];
      if (next) { delete s[`${key}Next`]; s[key] = null; if(enLoad(key, next.op, next.args)===false)enRerender(); return; }
      // Поиск: после перерисовки курсор остаётся в поле, а не пропадает.
      const typing = document.activeElement?.id;
      enRerender();
      if (typing === "en-search" || typing === "en-wsearch") { const box = document.getElementById(typing); box?.focus(); box?.setSelectionRange(box.value.length, box.value.length); }
    });
}

// ------------------------------------------------------------ звук

const enAudioUrls = new Map();
let enPlayer = null, enSpeechRequest = null;
let enSpeechGeneration = 0, enViewGeneration = 0, enChatTurn = 0, enSpeechButton = null;
function enCancelChat() {
  enChatTurn++;
  if (ui.en?.chat) ui.en.chat.busy = false;
}
// A rendered update is harmless; a different task, step, route or owner is not.
function enViewGuard() {
  const s = enState(), page = ui.page, tab = s.tab, ex = s.ex, index = ex?.index,
    deck = s.deck || ex?.deck, card = deck?.i, chat = s.chat, book = s.book, generation = enViewGeneration;
  return () => ui.en === s && ui.page === page && s.tab === tab && s.ex === ex && ex?.index === index &&
    (s.deck || s.ex?.deck) === deck && deck?.i === card && s.chat === chat && s.book === book && generation === enViewGeneration;
}
function enStopSpeech() {
  enSpeechGeneration++;
  enSpeechRequest?.abort(); enSpeechRequest = null;
  if(enPlayer){enPlayer.pause();enPlayer.removeAttribute?.('src');enPlayer.load?.();enPlayer=null;}
  try { speechSynthesis.cancel(); } catch (_) {}
  enSpeechButton?.classList.remove("is-busy"); enSpeechButton = null;
}
function enScheduleSpeak(text, delay) {
  const current = enViewGuard(), generation = enSpeechGeneration;
  enTimers.push(setTimeout(() => { if (current() && generation === enSpeechGeneration && !document.hidden) enSpeak(text); }, delay));
}
async function enSpeak(text, button) {
  if (!text || document.hidden || ui.page !== "english") return;
  enStopPcm();
  const generation = enSpeechGeneration, view = enViewGuard();
  const current = () => generation === enSpeechGeneration && view() && !document.hidden;
  const request=window.sorokaEnglishSession?.capabilities?.speechAbort===true?new AbortController():null;
  enSpeechRequest=request;
  enSpeechButton = button;
  button?.classList.add("is-busy");
  try {
    let url = enAudioUrls.get(text);
    if (!url) {
      const answer = await enCall("speech", { text },request?{signal:request.signal}:undefined);
      if (!current()) return;
      if (!answer?.url) throw new Error(answer?.error || "speech");
      url = answer.url; enAudioUrls.set(text, url);
    }
    if (!current()) return;
    enPlayer = new Audio(url);
    await enPlayer.play();
  } catch (_) {
    if (!current()) return;
    // Нет озвучки с сервера — голос телефона, если он есть.
    try { const u = new SpeechSynthesisUtterance(text); u.lang = "en-US"; u.rate = .9; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (__) { toast("Озвучка недоступна"); }
  } finally { if(enSpeechRequest===request)enSpeechRequest=null;if (generation === enSpeechGeneration) { button?.classList.remove("is-busy"); enSpeechButton = null; } }
}

// ------------------------------------------------------------ страница

function renderEnglishPage() {
  queueMicrotask(enFlush);
  const s = enState();
  if (s.deck) return `<div class="en-run">${enSyncBanner()}${s.deck.loading ? enWait() : enDeckTop(s.deck) + enDeckScreen(s.deck)}</div>`;
  if (s.ex) return enExScreen(s.ex);
  const active = s.tab === "phrases" ? "words" : s.tab === "progress" ? "today" : s.tab;
  const tabs = `<div class="en-tabs" role="tablist" aria-label="Разделы английского">${EN_TABS.map(([key, short, full, mid]) => `<button type="button" role="tab" class="${active === key ? "active" : ""}" aria-selected="${active === key}" data-action="en-tab" data-tab="${key}" aria-label="${esc(full)}"><span class="en-tab-short" aria-hidden="true">${esc(short)}</span><span class="en-tab-mid" aria-hidden="true">${esc(mid || short)}</span><span class="en-tab-long" aria-hidden="true">${esc(full)}</span></button>`).join("")}</div>`;
  if (s.tab === "read" && s.mediaTab !== "music" && s.book) return enReaderScreen();
  const body = s.tab === "chat" ? enChatScreen() : s.tab === "phrases" ? enPhrasesScreen() : s.tab === "progress" ? enProgressScreen() : s.tab === "read" ? enMediaScreen()
    : s.tab === "words" ? enWordsScreen() : s.tab === "course" ? enPracticeScreen() : enTodayScreen();
  const tabsRow = `<div class="en-tabs-row">${tabs}</div>`;
  return `${header("Английский", "", "")}<div class="en-page en-tab-${esc(s.tab || "today")}">${tabsRow}${enSyncBanner()}${body}</div>`;
}
function enSectionTitle(s) {
  if (s.tab === "phrases") return "Мои фразы";
  if (s.tab === "words") return "Слова";
  if (s.tab === "course") {
    if (s.practiceView === "course") return "Мой курс";
    if (s.practiceView === "media") return "Музыка и видео";
    if (s.practiceView?.startsWith("structured:")) return ({ mission: "Ситуации", sounds: "Звуки", story: "Истории", radio: "Аудирование" })[s.practiceView.slice(11)] || "Практика";
    return "Практика";
  }
  if (s.tab === "read") return "Медиатека";
  if (s.tab === "chat") return "Разговор";
  if (s.tab === "progress") return "Мой прогресс";
  return "Английский";
}

function enTodayScreen() {
  const s = enState();
  if (!s.today) { enLoad("today", "today"); return enWait(); }
  const t = s.today, p = t.plan || {}, u = t.unit || {}, words = t.words || {}, topic = u.topic || {};
  const step = (ic, title, sub) => `<div class="en-step"><span class="en-step-ic" aria-hidden="true">${icon(ic, "icon-sm")}</span><div><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</div></div>`;
  const steps = [
    step("card", `Слова · ${number(p.newWords)} ${enPlural(p.newWords || 0, "новое", "новых", "новых")}`, p.wordReviews ? `${number(p.wordReviews)} повторить · свайп «знаю / не знаю»` : "свайп «знаю / не знаю» — знакомые пролетают"),
    p.phraseReviews ? step("reset", `Разминка · ${number(p.phraseReviews)} ${enPlural(p.phraseReviews, "фраза", "фразы", "фраз")}`, p.fromMistakes ? `${number(p.fromMistakes)} из ваших ошибок` : "вспомнить то, что пора повторить") : "",
    step("study", `Урок ${number(u.number)} · ${esc(u.grammar || "")}`, "правило, упражнения, диктант, проверка"),
    topic.title ? step("mic", `Разговор · ${esc(topic.title)}`, "голосом, с новыми словами и грамматикой") : "",
  ].filter(Boolean).join("");
  const streak = t.streak ? `<span class="en-streak" role="img" aria-label="${number(t.streak)} ${enPlural(t.streak, "день", "дня", "дней")} подряд"><b>${number(t.streak)}</b>${icon("star", "icon-sm")}</span>` : "";
  const placement = t.placed ? "" : `<button type="button" class="en-link" data-action="en-place">Определить уровень</button>`;
  const facts = `<div class="en-lesson-facts">
    <button type="button" class="en-fact" data-action="en-tab" data-tab="words"><span class="en-fact-label">Слова</span><b>${enNum(words.known)}</b><small>из ${enNum(words.total)}</small>${enBar(words.known, words.total)}</button>
    <button type="button" class="en-fact" data-action="en-tab" data-tab="course"><span class="en-fact-label">Курс · ${esc(u.level || "—")}</span><b>${number(Math.max(0, (u.number || 1) - 1))}</b><small>из ${number(u.total)} пройдено</small>${enBar(Math.max(0, (u.number || 1) - 1), u.total)}</button>
  </div>`;
  const side = enRulesCard(t);
  return `<div class="en-today">
    <section class="en-lesson" aria-labelledby="en-today-title">
      <p class="en-kicker">${esc(u.level || "Английский")}${p.minutes ? ` · ≈ ${number(p.minutes)} мин` : ""}${p.doneToday ? " · занятие пройдено" : ""}</p>
      <div class="en-lesson-head">
        <h2 class="en-lesson-title" id="en-today-title">${esc(topic.title || (p.doneToday ? "Занятие пройдено" : "Занятие на сегодня"))}</h2>
        ${streak}
      </div>
      ${topic.goal ? `<p class="en-lesson-goal">${esc(topic.goal)}</p>` : ""}
      <div class="en-lesson-action"><button class="primary-button en-start" type="button" data-action="en-start">${p.doneToday ? "Ещё занятие" : "Начать"}</button></div>
      <div class="en-lesson-route">${steps}</div>
      ${facts}
      <div class="en-lesson-links"><button type="button" class="en-link" data-action="en-ex" data-mode="theory">Правило урока</button>${placement}<button type="button" class="en-link en-lesson-progress" data-action="en-progress" aria-label="Мой прогресс" title="Мой прогресс">${icon("chart", "icon-sm")}</button></div>
    </section>
    ${side ? `<aside class="en-today-side">${side}</aside>` : ""}
  </div>`;
}

/**
 * «Задано Эммой»: правила по вашим ошибкам в разговоре. Разобрать — объяснение,
 * ваша ошибка и упражнения; разобранное Эмма проверяет в речи, три верных
 * употребления — освоено. Тут же — что Эмма помнит о вас (можно стереть).
 */
function enRulesCard(t) {
  const s = enState(), r = t.rules;
  if (!r || (!r.assigned.length && !r.studied.length && !t.facts)) return "";
  const assigned = r.assigned.map(x => `<button type="button" class="en-rule-row" data-action="en-rule" data-id="${x.id}"><span class="en-rule-copy"><b>${esc(x.title)}</b><small>${number(x.errors)} ${enPlural(x.errors, "ошибка", "ошибки", "ошибок")} в разговоре${x.example?.correction ? ` · «${esc(x.example.correction)}»` : ""}</small></span><span class="en-rule-go">Разобрать</span></button>`).join("");
  const studied = r.studied.map(x => `<div class="en-rule-row studied"><span class="en-rule-copy"><b>${esc(x.title)}</b><small>Разобрано · Эмма проверяет в разговоре: верно ${number(x.uses)} из ${number(x.need)}</small></span><span class="en-rule-go studied">${number(x.uses)}/${number(x.need)}</span></div>`).join("");
  const facts = s.facts ? `<div class="en-facts">${s.facts.loading ? `<span class="live-spin"></span>` : s.facts.list.length ? s.facts.list.map((f, i) => `<span>${esc(f)}<button type="button" class="icon-button" data-action="en-forget" data-index="${i}" aria-label="Забыть">${icon("close", "icon-sm")}</button></span>`).join("") : `<small>Пока ничего — расскажите о себе в разговоре.</small>`}</div>` : "";
  return `<section class="en-rules" aria-labelledby="en-rules-title"><header class="en-section-head"><div><h3 id="en-rules-title">Задано Эммой</h3><small>${r.assigned.length ? "По вашим ошибкам в разговоре — разберите, и она проверит в речи" : "Новых правил нет — Эмма проверяет разобранное"}</small></div>${r.counts.mastered ? `<span class="en-rules-done">${number(r.counts.mastered)} разобрано</span>` : ""}</header>
    <div class="en-rule-list">${assigned}${studied}</div>
    ${t.facts ? `<button type="button" class="en-link en-facts-toggle" data-action="en-facts">${s.facts ? "Скрыть память" : `Что Эмма знает обо мне · ${number(t.facts)}`}<span aria-hidden="true">›</span></button>${facts}` : ""}</section>`;
}

async function enRuleStart(id) {
  const s = enState();
  enStopPcm(); if (enLive.state !== "off") enLiveStop();
  const back = s.tab;
  const pending = s.ex = { mode: "rule", loading: true }, current = enViewGuard();
  render();
  try {
    const data = await enCall("rule", { id });
    if (!current() || s.ex !== pending) return;
    if (data?.error || !data?.steps?.length) throw new Error(data?.error || "empty");
    s.ex = { mode: "rule", rule: data.rule, items: data.steps, index: 0, ok: 0, done: 0, picked: [], answer: null, back };
    window.flowEnglishSession?.save();
  } catch (_) { if (!current()) return; s.ex = null; toast("Не получилось открыть правило — попробуйте ещё раз"); }
  render();
}
/** Конец разбора: от 80% верных — «разобрано», дальше Эмма проверит в разговоре. */
function enRuleFinish(ex) {
  if (ex.sent) return;
  ex.sent = true;
  if (enAssessed(ex) < 3) { ex.result = { few: true }; return; }
  const current = enViewGuard();
  enQueue("ruledone", { id: ex.rule.id, score: ex.ok / enAssessed(ex) }).then(r => {
    if (!current() || enState().ex !== ex) return;
    ex.result = r; enState().rulesStale = true; render();
  }).catch(() => {
    if (!current() || enState().ex !== ex) return;
    ex.result = { error: true }; render();
  });
}

// ------------------------------------------------------------ колода слов
// Свайп вправо — знаю, влево — не знаю, нажатие — перевернуть. «Не знаю» сразу
// показывает перевод и пример (немедленная обратная связь), а слово ещё раз
// выходит ещё не больше двух раз за занятие. Новые слова идут
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
  const progress = d.done ? 1 : d.placement || (!d.fresh.length && !d.newUnknown)
    ? d.i / Math.max(1, d.queue.length) : Math.min(1, d.newUnknown / Math.max(1, d.newGoal));
  return `<div class="en-run-top"><button class="icon-button" type="button" data-action="en-deck-quit" aria-label="Закончить">${icon("close", "icon-sm")}</button><div class="en-bar"><i style="width:${Math.round(progress * 100)}%"></i></div><small>${d.placement ? `${d.i}/${d.queue.length}` : `Разобрано ${d.know + d.dont}`}</small></div>`;
}
function enDeckScreen(d) {
  enDeckFill(d);
  if (d.done) return d.placement ? enPlacementDone(d) : enDeckDone(d);
  const w = d.queue[d.i];
  const kicker = d.placement ? "Знаете это слово?" : w.again ? "Ещё раз" : w.isNew ? `Новое · №${w.id}${w.level ? ` · ${w.level}` : ""}` : "Повторить";
  const back = d.flipped || d.answer === "dont";
  const goal = d.placement ? "" : !d.fresh.length && !d.newUnknown
    ? `<p class="en-deck-goal">Разобрано слов: <b>${d.graded.size}</b></p>`
    : `<p class="en-deck-goal">Новых к изучению: <b>${Math.min(d.newUnknown, d.newGoal)} из ${d.newGoal}</b> · знаю ${d.know}</p>`;
  const card = `<div class="en-swipe ${back ? "back" : ""}" data-swipe>
      <span class="en-swipe-hint know">Знаю</span><span class="en-swipe-hint dont">Не знаю</span>
      <div class="en-swipe-front"><b class="en-word">${esc(w.en)}</b><small>${[w.ipa ? `/${esc(w.ipa)}/` : "", esc(w.pos || "")].filter(Boolean).join(" · ")}</small>${back ? "" : `<small class="en-swipe-tip">нажмите, чтобы перевернуть</small>`}</div>
      ${back ? `<div class="en-swipe-back"><p class="en-word-ru">${esc(w.ru)}</p>${w.ex ? `<p class="en-word-ex">${esc(w.ex)}</p><small>${esc(w.exRu || "")}</small>` : ""}</div>` : ""}
      <button class="icon-button en-play" type="button" data-action="en-say" data-text="${esc(w.ex && back ? w.ex : w.en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button>
    </div>`;
  const buttons = d.answer === "dont"
    ? `<div class="en-deck-btns"><button class="primary-button" type="button" data-action="en-deck-next">Дальше</button></div>`
    : `<div class="en-deck-btns two"><button type="button" class="en-dont" data-action="en-dont">${icon("close", "icon-sm")}Не знаю</button><button type="button" class="en-know" data-action="en-know">${icon("check", "icon-sm")}Знаю</button></div>`;
  return `<p class="en-kicker">${kicker}</p>${card}${buttons}${goal}`;
}
function enDeckAnswer(know) {
  const s = enState();
  const d = s.deck || s.ex?.deck;
  if (!d || d.done || d.answer) return;
  const w = d.queue[d.i];
  know = Boolean(know && !d.helped);
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
  enStopPcm();
  d.i++; d.flipped = false; d.helped = false; d.answer = null;
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
function enDeckFlip() {
  const s = enState(), d = s.deck || s.ex?.deck;
  if (!d || d.done || d.answer) return;
  d.flipped = !d.flipped; d.helped = true; render();
  if (d.flipped) enSpeak(d.queue[d.i].en);
}
function enDeckDone(d) {
  enState().today = null; enState().words = null;
  const count = d.graded.size;
  const summary = count ? `Разобрано ${count} ${enPlural(count, "слово", "слова", "слов")}` : "Нет слов для повторения";
  return `<div class="en-done"><div class="en-done-mark">${icon("check")}</div><h2>Слова на сегодня</h2><p class="muted">${summary}${d.newUnknown ? ` · Новых к изучению: ${d.newUnknown}` : ""}</p>${d.learned.length ? `<div class="en-targets"><small>Учим:</small>${d.learned.slice(0, 12).map(x => `<b>${esc(x)}</b>`).join("")}</div>` : ""}
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
  enStopPcm();
  const pending = s.deck = { loading: true, queue: [], fresh: [] }, current = enViewGuard();
  render();
  try {
    const data = await enCall(placement ? "placement" : "deck");
    if (!current() || s.deck !== pending) return;
    if (data?.error) throw new Error(data.error);
    s.deck = placement ? enDeckMake({ fresh: data.items, placement: true, newGoal: data.items.length }) : enDeckMake(data);
    if (placement) { s.deck.queue = s.deck.fresh; s.deck.fresh = []; }
    if (window.flowEnglishSession && !window.flowEnglishSession.save()) s.deck = null;
  } catch (_) { if (!current()) return; s.deck = null; toast("Не получилось загрузить слова"); }
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
    enDeckFlip();
  }
});
document.addEventListener("pointercancel", () => { if (enDrag) { enDrag.card.style.transform = ""; enDrag = null; } });
document.addEventListener("keydown", event => {
  const s = enState(), d = s.deck || s.ex?.deck;
  if (!d || ui.page !== "english" || event.target.closest?.("input, textarea")) return;
  if (event.key === "ArrowRight") { if (d.answer) enDeckNext(); else enDeckAnswer(true); }
  if (event.key === "ArrowLeft" && !d.answer) enDeckAnswer(false);
  if (event.key === " ") { event.preventDefault(); enDeckFlip(); }
});

// ------------------------------------------------------------ слова: прогресс

function enWordsScreen() {
  const s = enState();
  if (!s.words) { enLoad("words", "words"); return enWait(); }
  const w = s.words;
  const bands = (w.bands || []).map(b => `<div class="en-band"><span>${enNum(b.from)}–${enNum(b.to)}</span>${enBar(b.known, b.size)}<small>${enPct(b.known, b.size)}%</small></div>`).join("");
  const forecast = w.forecast ? `≈ ${String(w.perDay).replace(".", ",")} слова в день · до ${enForecastDate(w.forecast)}` : "Темп появится через пару занятий";
  const chips = [5, 10, 15, 20].map(n => `<button type="button" class="en-filter-chip ${w.newWords === n ? "active" : ""}" data-action="en-newwords" data-n="${n}" aria-pressed="${w.newWords === n}">${n}</button>`).join("");
  if (!s.wordlist) enLoad("wordlist", "wordlist", { filter: s.wfilter, q: s.wq });
  const chip = (key, label) => `<button type="button" class="en-filter-chip ${s.wfilter === key ? "active" : ""}" data-action="en-wfilter" data-filter="${key}" aria-pressed="${s.wfilter === key}">${label}</button>`;
  const rows = (s.wordlist?.items || []).map(x => `<div class="en-wrow" role="listitem"><small>${enNum(x.id)}</small><div><b lang="en">${esc(x.en)}</b><span>${esc(x.ru)}</span>${x.ex ? `<small lang="en">${esc(x.ex)}</small>` : ""}</div><button class="icon-button en-say" type="button" data-action="en-say" data-text="${esc(x.en)}" aria-label="Послушать ${esc(x.en)}">${icon("play", "icon-sm")}</button></div>`).join("");
  return `<div class="en-words">
    <section class="en-words-main" aria-labelledby="en-words-title">
      <section class="en-words-summary">
        <div class="en-words-number"><b id="en-words-title">${enNum(w.known)}</b><span>из ${enNum(w.total)} слов</span></div>
        <p class="en-words-forecast">${forecast}</p>
        ${enBar(w.known, w.total)}
        <div class="en-words-actions"><button class="primary-button" type="button" data-action="en-deck">${icon("card", "icon-sm")}Учить слова</button>${w.placed ? "" : `<button class="ghost-button" type="button" data-action="en-place">Проверка уровня · 3 минуты</button>`}</div>
      </section>
      <div class="en-words-tools">
        <label class="en-search">${icon("search", "icon-sm")}<input id="en-wsearch" type="search" value="${esc(s.wq)}" placeholder="Найти слово" aria-label="Поиск слова"></label>
        <div class="en-chips" role="group" aria-label="Фильтр слов">${chip("learning", "Учу")}${chip("known", "Знаю")}${chip("all", "Все по порядку")}</div>
      </div>
      <div class="en-wlist" role="list" aria-label="Слова">${s.failedLoads?.wordlist ? `<section class="en-load-error" role="status"><strong>Словарь не загрузился</strong><p class="section-note">${esc(s.failedLoads.wordlist.error)}</p><button class="ghost-button" type="button" data-action="en-retry" data-key="wordlist">Попробовать снова</button></section>` : rows || `<p class="en-empty">${s.wordlist ? "Пока пусто — слова появятся после первого занятия." : ""}</p>`}</div>
    </section>
    <aside class="en-words-side">
      <button type="button" class="en-destination" data-action="en-tab" data-tab="phrases"><span class="en-dest-copy"><small>Мои фразы</small><b>Предложения уроков и ваши ошибки</b></span>${icon("right", "icon-sm")}</button>
      <details class="en-settings">
        <summary><span>Ритм и частота</span><small>${number(w.newWords)} новых · ${number(w.learning)} учу</small>${icon("down", "icon-sm")}</summary>
        <div class="en-settings-body">
          <div class="en-setting"><div class="en-setting-head"><b>Новых слов за занятие</b><small>знакомые не считаются</small></div><div class="en-chips">${chips}</div></div>
          <div class="en-setting"><div class="en-setting-head"><b>По частоте</b><small>учу сейчас ${number(w.learning)}</small></div><div class="en-bands">${bands}</div></div>
          <p class="en-note">5000 самых частых слов английского (список COCA). Первые 2000 покрывают большую часть живой речи — с них и начинаем.</p>
        </div>
      </details>
    </aside>
  </div>`;
}

// ------------------------------------------------------------ курс

const EN_LEVEL_NAMES = { A1: "A1 · начальный", A2: "A2 · базовый", B1: "B1 · средний", B2: "B2 · выше среднего" };
function enPracticeScreen() {
  const s = enState();
  if (s.practiceView === 'media' && typeof enMediaPracticeScreen === 'function') return enMediaPracticeScreen();
  if (s.practiceView?.startsWith('structured:') && typeof enStructuredCatalog === 'function') return enStructuredCatalog(s.practiceView.slice(11));
  if (s.practiceView === "course") return `<button type="button" class="en-back" data-action="en-practice-back">${icon("left", "icon-sm")}Вся практика</button>${enCourseScreen()}`;
  const row = (action, title, sub, glyph, attrs = "") => `<button type="button" class="en-dest" data-action="${action}" ${attrs}><span class="en-dest-icon" aria-hidden="true">${icon(glyph, "icon-sm")}</span><span class="en-dest-copy"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span><span class="en-dest-arrow" aria-hidden="true">${icon("right", "icon-sm")}</span></button>`;
  const group = (title, rows, withHead = true) => rows ? `<section class="en-group">${withHead ? `<h2 class="en-group-title">${esc(title)}</h2>` : ""}<div class="en-dest-list">${rows}</div></section>` : "";
  const course = row("en-practice-course", "Курс A1–B2", "Уроки, правила и разговор", "study");
  const structured = typeof enStructuredCatalog === 'function'
    ? [['mission', 'Ситуации', 'Диалоги и ролевые задачи', 'flag'], ['sounds', 'Звуки', 'Слушать и различать', 'mic'], ['story', 'Истории', 'Читать и пересказывать', 'book'], ['radio', 'Аудирование', 'Понимать на слух', 'play']]
      .map(([kind, title, sub, glyph]) => row('en-training-catalog', title, sub, glyph, `data-kind="${kind}"`)).join("")
    : "";
  const media = typeof enMediaPracticeScreen === 'function' ? row('en-training-media-catalog', 'Песня или видео', 'Упражнения по фрагменту', 'film') : "";
  const training = EN_MODES.map(([key, title, sub, glyph]) => row("en-ex", key === "cards" ? "Карточки фраз" : title, sub, glyph, `data-mode="${key}"`)).join("");
  return `<div class="en-practice">
    ${group("Курс", course, false)}
    ${group("По ситуациям", structured)}
    ${group("Упражнения", media + training)}
  </div>`;
}
function enCourseScreen() {
  const s = enState();
  if (!s.course) { enLoad("course", "course"); return enWait(); }
  if (!Array.isArray(s.course.units) || !s.course.units.length) return `<section class="en-wait en-load-empty" role="status"><strong>В курсе пока нет уроков</strong><p class="section-note">Можно вернуться к сегодняшней практике.</p><button class="ghost-button" type="button" data-action="en-tab" data-tab="today">К занятию на сегодня</button></section>`;
  const c = s.course, cur = c.units.find(u => u.status === "current") || c.units[0];
  const levels = ["A1", "A2", "B1", "B2"].map(level => {
    const list = c.units.filter(u => u.level === level);
    if (!list.length) return "";
    const done = list.filter(u => u.status === "done").length;
    const open = list.some(u => u.status === "current") || list.some(u => u.key === s.openUnit);
    return `<details class="en-course-level" ${open ? "open" : ""}><summary><span>${EN_LEVEL_NAMES[level]}</span><small>${done} из ${list.length}</small>${icon("down", "icon-sm")}</summary><div class="en-level-list">${list.map(u => `<button type="button" class="en-unit ${esc(u.status || "")}" data-action="en-unit" data-key="${esc(u.key)}" aria-expanded="${s.openUnit === u.key}"><span class="en-unit-n" aria-hidden="true">${u.status === "done" ? icon("check", "icon-sm") : number(u.number)}</span><span class="en-unit-copy"><b>${esc(u.title)}</b><small>${esc(u.grammar || "")}</small></span>${u.score != null ? `<small class="en-unit-score">${Math.round(u.score * 100)}%</small>` : u.status === "current" ? `<small class="en-unit-score current">сейчас</small>` : ""}</button>${s.openUnit === u.key ? `<div class="en-unit-more"><button class="primary-button" type="button" data-action="en-unit-go" data-key="${esc(u.key)}">Пройти урок</button><button class="ghost-button" type="button" data-action="en-ex" data-mode="theory" data-unit="${esc(u.key)}">Правило</button></div>` : ""}`).join("")}</div></details>`;
  }).join("");
  return `<div class="en-course">
    <section class="en-current" aria-labelledby="en-current-title">
      <p class="en-kicker">Урок ${number(cur.number)} из ${number(c.units.length)} · ${esc(cur.level)}</p>
      <h2 class="en-current-title" id="en-current-title">${esc(cur.grammar || cur.title)}</h2>
      ${cur.title && cur.title !== cur.grammar ? `<p class="en-current-grammar">${esc(cur.title)}</p>` : ""}
      <div class="en-current-actions"><button type="button" class="primary-button" data-action="en-start">Продолжить урок</button>${cur.key ? `<button type="button" class="ghost-button" data-action="en-ex" data-mode="theory" data-unit="${esc(cur.key)}">Правило</button>` : ""}</div>
    </section>
    <section class="en-course-path" aria-label="Уроки курса">${levels}</section>
  </div>`;
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
  const field = document.querySelector("[data-en-chat] input"), draft = field?.value || s.chat?.draft || "", focused = document.activeElement === field;
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
    : `<div class="en-msg ai"><div class="en-bub ai"><span class="en-say" data-say="${i}">${m.streaming ? esc(m.shown || "") : enWords(m.text, i, m.word?.at)}</span>${m.open && m.ru ? `<div class="en-bub-ru">${esc(m.ru)}</div>` : ""}${!m.streaming && m.ru && !m.ruOnly ? `<button type="button" class="en-bub-tr" data-action="en-bubble" data-index="${i}">${m.open ? "Скрыть перевод" : "Перевод"}</button>` : ""}</div>${wordCard(m)}</div>`).join("");
  const status = live === "off" ? esc(c.title || "Разговор") : esc(EN_LIVE_LABEL[live]);
  const aims = c.targets?.length ? `<div class="en-aims" aria-label="Задачи разговора">${c.targets.map(t => `<span>${esc(t)}</span>`).join("")}</div>` : "";
  const spoken = c.msgs.filter(m => m.role === "me").length;
  return `<section class="en-chat" aria-label="Разговор с Эммой">
    <header class="en-chat-head">
      <span class="en-chat-avatar" aria-hidden="true">Э</span>
      <div class="en-chat-id"><b>Эмма</b><small class="en-chat-status">${status}</small></div>
      <button class="icon-button" type="button" data-action="en-chat-reset" aria-label="Начать разговор заново">${icon("reset", "icon-sm")}</button>
    </header>
    <div class="en-chat-tools">
      <button type="button" class="en-chat-tool ${tone}" data-action="en-tone" aria-pressed="${tone === "friend"}" aria-label="Тон тренера: ${tone === "friend" ? "друг" : "вежливый"}">Тон: ${tone === "friend" ? "Друг" : "Вежливо"}</button>
      ${spoken >= 2 && !c.busy ? `<button type="button" class="en-chat-tool" data-action="en-debrief" aria-label="Разбор разговора">Разбор</button>` : ""}
    </div>
    ${aims}
    ${aims}
    <div class="en-msgs" role="log" aria-live="polite" aria-label="Сообщения разговора">${msgs}${c.busy && !c.msgs.some(m => m.streaming) ? `<div class="en-msg ai"><div class="en-bub ai typing" aria-label="Эмма печатает"><i></i><i></i><i></i></div></div>` : ""}</div>
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
function enStopPcm() { enStopSpeech(); enSources.forEach(x => { try { x.stop(); } catch (_) {} }); enSources = []; enNextAt = 0; enTimers.forEach(clearTimeout); enTimers = []; }
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
  const current = enViewGuard(), request = enLive.request = Symbol();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (!current() || document.hidden || enLive.request !== request) { stream.getTracks().forEach(t => t.stop()); return; }
    enLive.stream = stream;
  } catch (error) { if (current() && enLive.request === request && !document.hidden) toast(error?.name === "NotAllowedError" ? "Нет доступа к микрофону — разрешите его в настройках" : "Микрофон не включился"); return; }
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
  enLive.request = null;
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
  if (window.sorokaEnglishSession?.version === 2 && !window.flowEnglishSession?.ready()) {
    toast("Не удалось подтвердить вход. Сообщение не отправлено."); return;
  }
  const c = enState().chat;
  if (!c || !text.trim() || c.busy) return;
  const mine = { role: "me", text: text.trim() };
  // Тренер видит и поправки, которые уже показали, — чтобы дать сказать правильно.
  const history = c.msgs.filter(m => m.role !== "debrief").map(m => ({ role: m.role, text: m.text, ...(m.correction ? { correction: m.correction, rule: m.rule?.title } : {}) }));
  c.msgs.push(mine); c.busy = true; c.sent = true; c.draft = "";
  enStopPcm();
  const view = enViewGuard(), generation = enSpeechGeneration, turn = ++enChatTurn;
  const active = () => turn === enChatTurn;
  const current = () => active() && view() && generation === enSpeechGeneration && !document.hidden;
  const release = () => { if (active()) c.busy = false; };
  if (enLive.state !== "off") enLiveSet("think");
  render(); enScrollChat();
  const done = () => {
    if (!active()) return;
    release();
    const quietGeneration = enSpeechGeneration;
    enWhenQuiet(() => {
      if (!active() || !view() || quietGeneration !== enSpeechGeneration || document.hidden) return;
      // Всё отзвучало — показываем текст целиком и снова слушаем.
      const last = c.msgs[c.msgs.length - 1];
      if (last?.role === "ai") { last.shown = last.text; last.streaming = false; }
      if (ui.page === "english") render();
      if (enLive.state !== "off") enLiveSet("listen");
    });
  };
  try {
    // The old stream reads current credentials at dispatch; version2 must use bound enCall below.
    if (window.sorokaEnglishSession?.version === 2 || typeof window.sorokaEnglishStream !== "function") throw new Error("no-stream");
    let ai = null, index = -1;
    await window.sorokaEnglishStream({ situation: c.situation, history, text: mine.text, targets: c.targets || [], tone: enState().today?.tone }, (type, data) => {
      if (!current()) return;
      if (type === "say") {
        if (!ai) { ai = { role: "ai", text: "", shown: "", streaming: true }; c.msgs.push(ai); index = c.msgs.length - 1; render(); if (enLive.state !== "off") enLiveSet("speak"); }
        ai.text += data.text; enRevealAt(ai, index, data.text);
      } else if (type === "audio") enPlayPcm(data);
      else if (type === "fix") { enApplyFix(mine, data); render(); }
      else if (type === "reply" && ai) { ai.text = data.reply || ai.text; ai.ruOnly = /[а-яё]/i.test(ai.text) && (ai.text.match(/[а-яё]/gi) || []).length > (ai.text.match(/[a-z]/gi) || []).length; }
      else if (type === "ru" && ai) ai.ru = data.ru;
      else if (type === "error" && !ai) throw new Error(data.error || "stream");
    });
    if (!current()) { release(); return; }
    if (!ai) throw new Error("stream-empty");
    done();
  } catch (_) {
    if (!current()) { release(); return; }
    // Без потока: обычный ответ, озвучка следом (файлом).
    try {
      const answer = await enCall("chat", { situation: c.situation, history, text: mine.text, targets: c.targets || [], tone: enState().today?.tone });
      if (!current()) { release(); return; }
      enApplyFix(mine, answer);
      c.msgs.push({ role: "ai", text: answer.reply, ru: answer.replyRu });
      render(); enScrollChat();
      if (enLive.state !== "off") enLiveSet("speak");
      await enSpeak(answer.reply);
      done();
    } catch (__) { release(); if (!active() || !view() || document.hidden) return; render(); toast("Тренер не ответил — попробуйте ещё раз"); if (enLive.state !== "off") enLiveSet("listen"); }
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
  enStopPcm();
  const pending = s.ex = { mode, loading: true }, current = enViewGuard();
  render();
  try {
    const unit = unitKey || s.today?.unit?.key || "";
    const data = await enCall(mode === "theory" ? "theory" : "practice", { mode, unit });
    if (!current() || s.ex !== pending) return;
    if (data?.error) throw new Error(data.error);
    s.ex = mode === "theory" ? { mode, theory: data } : { mode, unit: data.unit, items: data.items || [], index: 0, ok: 0, done: 0, picked: [], answer: null };
    if (mode !== "theory" && !s.ex.items.length) { s.ex = null; toast("Пока не из чего — пройдите занятие на «Сегодня»"); }
    else if (mode !== "theory" && (s.ex.items[0].mode || mode) === "dictation") enScheduleSpeak(s.ex.items[0].en, 200);
    if (mode !== "theory" && s.ex) window.flowEnglishSession?.save();
  } catch (_) { if (!current()) return; s.ex = null; toast("Не получилось загрузить упражнение"); }
  render();
}

async function enLessonStart(unitKey) {
  const s = enState();
  enStopPcm();
  const pending = s.ex = { mode: "lesson", loading: true }, current = enViewGuard();
  render();
  try {
    const data = await enCall("lesson", unitKey ? { unit: unitKey } : {});
    if (!current() || s.ex !== pending) return;
    if (data?.error) throw new Error(data.error);
    s.ex = { mode: "lesson", unit: data.unit, items: data.steps || [], index: 0, ok: 0, done: 0, picked: [], answer: null };
    enLessonEnter();
  } catch (_) { if (!current()) return; s.ex = null; toast("Не получилось собрать урок"); }
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
    if (enAssessed(ex) < 4) { ex.result = { few: true }; return; }
    enQueue("unitdone", { unit: ex.unit.key, score: ex.ok / enAssessed(ex) }).then(r => { ex.result = r; enState().today = null; enState().course = null; render(); }).catch(() => {});
  }
  if (["listen", "dictation"].includes(item.mode)) enScheduleSpeak(item.en, 150);
}
const EN_SECTIONS = ["Слова", "Разминка", "Правило", "Тренировка", "Аудирование", "Проверка", "Разговор"];
function enLessonTop(ex) {
  const present = EN_SECTIONS.filter(name => ex.items.some(i => i.section === name));
  const current = ex.items[ex.index]?.section || present[0] || "";
  const at = Math.max(0, present.indexOf(current));
  return `<div class="en-sections" aria-label="Раздел урока"><span class="on">${esc(current)}</span><small>${at + 1} из ${present.length}</small></div>`;
}

function enExScreen(ex) {
  if (ex.mode === 'structured' && typeof enStructuredScreen === 'function') return enStructuredScreen(ex);
  if (ex.loading) return `<div class="en-run">${enWait()}${ex.mode === "rule" ? `<p class="section-note en-center">Эмма готовит объяснение и упражнения — новое правило до минуты</p>` : ""}</div>`;
  if (ex.mode === "theory") return enTheoryScreen(ex.theory);
  const total = ex.items.length;
  if (ex.mode === "rule" && ex.index >= total) {
    const r = ex.result;
    const verdict = !r ? `<span class="live-spin"></span>` : r.error ? `<p class="section-note" role="status">Не удалось сохранить результат правила. Это не ошибка в ответах.</p>` : r.few ? `<p class="section-note">Засчитывается по упражнениям — сделайте хотя бы три.</p>` : r.passed ? `<p class="en-ok">${icon("check", "icon-sm")}Разобрано. Теперь Эмма проверит его в разговоре: ${r.need} верных употребления — и правило освоено.</p>` : `<p class="en-fix">Верно меньше 80% — давайте ещё раз, предложения будут другие.</p>`;
    return `<div class="en-run en-done"><div class="en-done-mark">${icon("study")}</div><h2>${esc(ex.rule.title)}</h2><p class="muted">${enExerciseSummary(ex)}</p>${verdict}
      ${r?.passed ? `<button class="primary-button en-go" type="button" data-action="en-rule-talk">${icon("mic", "icon-sm")}Проверить в разговоре</button>` : r && !r.few && !r.error ? `<button class="primary-button en-go" type="button" data-action="en-rule" data-id="${ex.rule.id}">Ещё раз</button>` : ""}<button class="ghost-button" type="button" data-action="en-ex-quit">Готово</button></div>`;
  }
  if (ex.index >= total) {
    return `<div class="en-run en-done"><div class="en-done-mark">${icon("check")}</div><h2>Готово</h2><p class="muted">${enExerciseSummary(ex)}</p>
      <button class="primary-button en-go" type="button" data-action="en-ex" data-mode="${ex.mode}">Ещё раз</button><button class="ghost-button" type="button" data-action="en-ex-quit">К курсу</button></div>`;
  }
  const item = ex.items[ex.index];
  const mode = item.mode || ex.mode;
  const lessonRun = ex.mode === "lesson" || ex.mode === "rule";
  const skip = lessonRun && item.section !== "Разговор" ? `<button class="text-action en-skip" type="button" data-action="en-skip">Пропустить</button>` : `<small>${ex.answer ? ex.index + 1 : ex.index}/${total}</small>`;
  const progress = total ? Math.round(((ex.answer ? ex.index + 1 : ex.index) / total) * 100) : 0;
  const top = `<div class="en-run-top"><button class="icon-button" type="button" data-action="en-ex-quit" aria-label="Закончить">${icon("close", "icon-sm")}</button><div class="en-bar"><i style="width:${progress}%"></i></div>${skip}</div>${lessonRun ? enLessonTop(ex) : ""}`;
  if (mode === "words") return `<div class="en-run">${top}${ex.deck ? enDeckScreen(ex.deck) : enWait()}</div>`;
  if (mode === "theory") {
    const t = item.theory || {}, topic = ex.mode === "rule" ? ex.rule?.title || item.grammar : item.grammar;
    return `<div class="en-run">${top}<p class="en-kicker">${ex.mode === "rule" ? "Задано Эммой" : `Урок ${ex.unit?.number || ""}`}</p><h2 class="en-prompt">${esc(t.title || "")}</h2>${topic ? `<p class="en-rule-topic">${esc(topic)}</p>` : ""}<section class="en-theory-part"><p>${esc(t.text || "")}</p>${(t.examples || []).map(([en, ru]) => `<div class="en-example"><button class="icon-button en-play" type="button" data-action="en-say" data-text="${esc(en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button><div><b>${esc(en)}</b><small>${esc(ru)}</small></div></div>`).join("")}</section><button class="primary-button en-go" type="button" data-action="en-ex-next">Понятно</button></div>`;
  }
  if (mode === "listen") {
    const a2 = ex.answer;
    return `<div class="en-run">${top}<p class="en-kicker">Послушайте и поймите смысл</p><div class="en-listen"><button class="en-mic" type="button" data-action="en-say" data-text="${esc(item.en)}" aria-label="Послушать ещё раз">${icon("play")}</button><small>Нажмите, чтобы послушать ещё раз</small></div>
      ${a2 ? `<div class="en-card"><div class="en-en"><b>${esc(item.en)}</b></div><p class="en-ru">${esc(item.ru)}</p></div><p class="en-ask">Поняли на слух?</p><div class="en-rate">${[[1, "Не понял"], [2, "С трудом"], [3, "Понял"]].map(([r, l]) => `<button type="button" data-action="en-ex-rate" data-rating="${r}">${l}</button>`).join("")}</div>` : `<div class="en-answer"><button class="primary-button" type="button" data-action="en-ex-show">Показать текст</button></div>`}</div>`;
  }
  if (mode === "talk") {
    const r = ex.result;
    const verdict = !r ? "" : r.error ? `<p class="section-note" role="status">Не удалось сохранить результат урока. Это не ошибка в ответах.</p>` : r.few ? `<p class="section-note">Урок засчитается, когда сделаете упражнения — сейчас их почти не было.</p>` : r.passed ? `<p class="en-ok">${icon("check", "icon-sm")}Урок засчитан${r.next ? ` · дальше урок ${r.next.number}: ${esc(r.next.grammar)}` : ""}</p>` : `<p class="en-fix">Верно меньше 70% — завтра этот урок ещё раз, с другими предложениями.</p>`;
    return `<div class="en-run en-done"><div class="en-done-mark">${icon("mic")}</div><h2>Разговор</h2><p class="muted">${esc(item.title)}: ${esc(item.goal)}</p>${ex.done ? `<p class="muted">${enExerciseSummary(ex)}</p>` : ""}${verdict}
      ${item.targets?.length ? `<div class="en-targets"><small>Постарайтесь использовать:</small>${item.targets.map(t => `<b>${esc(t)}</b>`).join("")}</div>` : ""}
      <button class="primary-button en-go" type="button" data-action="en-talk">${icon("mic", "icon-sm")}Начать разговор</button><button class="ghost-button" type="button" data-action="en-ex-quit">Закончить урок</button></div>`;
  }
  const mo = mode === "recall" ? "translate" : mode;
  const a = ex.answer;
  const next = `<button class="primary-button en-go" type="button" data-action="en-ex-next">Дальше</button>`;
  const result = ok => `<div class="en-card"><div class="en-en"><b>${esc(a?.correction || item.en)}</b><button class="icon-button en-play" type="button" data-action="en-say" data-text="${esc(a?.correction || item.en)}" aria-label="Послушать">${icon("play", "icon-sm")}</button></div><p class="en-ru">${esc(item.ru)}</p>${ok ? `<p class="en-ok">${icon("check", "icon-sm")}${a?.assisted ? "Верно с поддержкой" : "Верно"}</p>` : ""}${a?.explain || item.note || item.tip ? `<p class="en-fix">${esc(a?.explain || item.note || item.tip)}</p>` : ""}${a?.assisted && !ok ? `<small class="muted">С подсказкой · самостоятельный ответ не засчитан</small>` : ""}</div>`;
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
    const correct = String(item.answer || "").toLowerCase();
    const opts = item.options.map(o => {
      const isCorrect = String(o).toLowerCase() === correct;
      const state = !a ? "" : isCorrect ? " right" : o === a.pick ? " wrong" : " muted";
      const mark = !a ? "" : isCorrect ? `<span class="en-opt-mark" aria-hidden="true">✓</span>` : o === a.pick ? `<span class="en-opt-mark" aria-hidden="true">×</span>` : "";
      return `<button type="button" class="en-opt${state}" data-action="en-gap" data-opt="${esc(o)}" ${a ? "disabled" : ""}>${mark}<span>${esc(o)}</span></button>`;
    }).join("");
    const blank = a
      ? a.ok
        ? `<span class="en-blank right">${esc(a.pick)}</span>`
        : `<s class="en-blank wrong">${esc(a.pick)}</s> <span class="en-gap-correct">${esc(item.answer)}</span>`
      : `<span class="en-blank">&nbsp;</span>`;
    const verdict = a ? a.ok
      ? `<div class="en-gap-result" role="status"><p class="en-ok">${icon("check", "icon-sm")}Верно</p>${item.tip ? `<p class="en-note">${esc(item.tip)}</p>` : ""}${next}</div>`
      : `<div class="en-gap-result" role="status"><p class="en-result-label">Правильно</p><p class="en-result-text" lang="en">${esc(item.en)}</p>${item.tip ? `<p class="en-note">${esc(item.tip)}</p>` : ""}${next}</div>`
      : "";
    return `<div class="en-run">${top}<p class="en-kicker">Вставьте пропуск</p><h2 class="en-prompt en-gap-text">${esc(item.text).replace("___", blank)}</h2><p class="en-ru">${esc(item.ru)}</p><div class="en-opts">${opts}</div>${verdict}</div>`;
  }
  if (mo === "dictation") {
    return `<div class="en-run">${top}<div class="en-listen"><button class="en-mic" type="button" data-action="en-say" data-text="${esc(item.en)}" aria-label="Послушать ещё раз">${icon("play")}</button><small>Послушайте и запишите по-английски</small></div>
      ${a ? `${a.typed ? `<p class="en-said">Вы написали: «${esc(a.typed)}»</p>` : ""}${result(a.ok)}${next}` : `<form class="en-write" data-en-dict><input name="answer" value="${esc(ex.draft || "")}" autocomplete="off" autocapitalize="sentences" placeholder="Что вы услышали" aria-label="Что вы услышали"><button class="primary-button" type="submit">Проверить</button></form><button class="text-action" type="button" data-action="en-ex-show">Не разобрал — показать</button>`}</div>`;
  }
  // translate / recall
  return `<div class="en-run">${top}<p class="en-kicker">${item.source === "mistake" ? "Из ваших ошибок · " : ""}Скажите или напишите по-английски</p><h2 class="en-prompt">${esc(item.ru)}</h2>
    ${a ? `${a.said ? `<p class="en-said">Вы сказали: «${esc(a.said)}»</p>` : ""}${result(a.ok)}${next}`
    : ex.checking ? `<div class="en-wait small"><span class="live-spin"></span><small>Проверяю…</small></div>`
    : `<form class="en-write" data-en-tr><input name="answer" value="${esc(ex.draft || "")}" autocomplete="off" autocapitalize="sentences" placeholder="Напишите по-английски" aria-label="Перевод"><button class="primary-button" type="submit">Проверить</button></form><div class="en-answer"><button class="en-mic" type="button" data-action="en-tr-speak" aria-label="Сказать">${icon("mic")}</button><button class="text-action" type="button" data-action="en-ex-show">Не помню — показать</button></div>`}</div>`;
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

function enAssessed(ex) { return Math.max(0, ex.done - (ex.practiceDone || 0)); }
function enExerciseSummary(ex) { return `Самостоятельно: верно ${ex.ok} из ${enAssessed(ex)}${ex.practiceDone ? ` · С поддержкой / самопроверка: ${ex.practiceDone}` : ""}`; }
function enExAnswer(ok, extra = {}) {
  const ex = enState().ex;
  if (!ex || ex.answer) return;
  const item = ex.items[ex.index];
// В расписание — только фразы, которые уже учатся; раньше срока сервер интервал не двигает.
  const mode = item.mode || ex.mode;
  const repeat = Boolean(item.again), assisted = repeat || extra.verdict === "shown" || extra.assisted === true;
  const real = ex.mode === "lesson" && mode === "recall" && !repeat;
  if ((item.introduced || real) && !enRecord("grade", { id: item.id, rating: assisted ? 1 : extra.rating ?? (ok ? 3 : 1), answer: extra.typed || extra.said || "", correct: repeat ? null : ok && !assisted, practice: !real, attempt: `${item.id}-${Date.now()}-${ex.index}` })) return;
  ex.answer = { ok, ...extra, assisted }; ex.done++; if (repeat) ex.practiceDone = (ex.practiceDone || 0) + 1; else if (ok && !assisted) ex.ok++;
  // Не вспомнили в уроке — ещё раз перед разговором (один раз).
  if (real && !ok && !item.again) { const talk = ex.items.findIndex(i => i.mode === "talk"); ex.items.splice(talk < 0 ? ex.items.length : talk, 0, { ...item, again: true }); }
  render();
  if (ok || ["dictation", "cards"].includes(mode)) enSpeak(item.en);
}
function enExNext() {
  const ex = enState().ex;
  if (!ex) return;
  enStopPcm();
  ex.index++; ex.answer = null; ex.picked = []; ex.checking = false; ex.draft = "";
  if (ex.mode === "lesson") enLessonEnter();
  if (ex.mode === "rule" && ex.index >= ex.items.length) enRuleFinish(ex);
  render();
  if (ex.mode !== "lesson" && (ex.items[ex.index]?.mode || ex.mode) === "dictation" && ex.items[ex.index]?.en) enScheduleSpeak(ex.items[ex.index].en, 150);
}

// ------------------------------------------------------------ чтение
// Читать много и чуть ниже своего уровня — так слова учатся из контекста.
// Незнакомое слово: нажали — облачко с переводом по смыслу предложения,
// слово подсвечивается во всей книге и уходит в колоду (её повторит FSRS).

const EN_BOOK_LEVELS = ["A1", "A2", "B1", "B2"];
function enMediaScreen() {
  const s = enState(), music = s.mediaTab === "music";
  const tabs = `<div class="en-media-tabs" role="tablist" aria-label="Медиатека"><button type="button" role="tab" aria-selected="${!music}" class="${!music ? "active" : ""}" data-action="en-media-tab" data-tab="books">Книги</button><button type="button" role="tab" aria-selected="${music}" class="${music ? "active" : ""}" data-action="en-media-tab" data-tab="music">Музыка</button></div>`;
  return tabs + (music ? FlowEnglishMusic.screen() : enBooksScreen());
}
function enBooksScreen() {
  const s = enState();
  if (!s.books) { enLoad("books", "books"); return enWait(); }
  const items = s.books.items || [];
  const card = b => `<button type="button" class="en-book" data-action="en-book" data-id="${b.id}"><span class="en-book-cover lvl-${esc(b.level || "x")}" aria-hidden="true">${esc(b.level || "·")}</span><span class="en-book-text"><b>${esc(b.title)}</b><small>${esc(b.author || "")}${b.pages ? ` · ${b.pages} ${enPlural(b.pages, "страница", "страницы", "страниц")}` : ""}${b.marks ? ` · ${b.marks} ${enPlural(b.marks, "слово", "слова", "слов")}` : ""}${b.tr_pages ? ` · перевод ${enPct(b.tr_pages, b.pages)}%` : b.tr_all ? " · переводится" : ""}</small>${b.page ? enBar(b.page + 1, b.pages) : ""}</span><span class="en-book-arrow" aria-hidden="true">${icon("right", "icon-sm")}</span></button>`;
  const last = items.find(b => b.opened_at);
  const mine = items.filter(b => b.source === "upload");
  const ready = EN_BOOK_LEVELS.map(level => { const list = items.filter(b => b.source === "builtin" && b.level === level); return list.length ? `<div class="en-book-group"><h3>${EN_LEVEL_NAMES[level]}</h3>${list.map(card).join("")}</div>` : ""; }).join("");
  const uploadStatus = s.uploading ? `<span class="en-upload-status" role="status">${esc(typeof s.uploading === "string" ? s.uploading : "Загружаю…")}</span>` : "";
  const upload = `<label class="en-upload en-upload-fab" role="button" tabindex="0" aria-label="${s.uploading ? "Загружаю книгу" : "Загрузить книгу"}" aria-busy="${s.uploading ? "true" : "false"}">${icon("plus", "icon-sm")}<input type="file" accept=".txt,.fb2,.epub,.pdf,text/plain,application/epub+zip,application/pdf" data-en-upload hidden></label>`;
  return `<div class="en-library">
    ${last ? `<section class="en-reading" aria-labelledby="en-reading-title"><p class="en-kicker" id="en-reading-title">Продолжить чтение</p>${card(last)}</section>` : ""}
    ${mine.length ? `<section class="en-shelf" aria-labelledby="en-mybooks-title">
      <header class="en-section-head"><div><h2 id="en-mybooks-title">Мои книги</h2><small>Свои книги · txt, fb2, epub, pdf</small></div></header>
      <div class="en-book-list">${mine.map(card).join("")}</div>
    </section>` : ""}
    <section class="en-shelf" aria-labelledby="en-flowbooks-title">
      <header class="en-section-head"><div><h2 id="en-flowbooks-title">Библиотека Flow</h2><small>Рассказы по уровням — написаны для Flow</small></div></header>
      <div class="en-book-list">${ready || `<p class="en-empty">Библиотека пока не загрузилась.</p>`}</div>
    </section>
  </div>${uploadStatus}${upload}`;
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
let enReaderSettingsFrame = 0;
document.addEventListener("focusin", event => {
  const dialog = document.querySelector('.en-rset');
  if (enState().readerSet && ui.page === "english" && dialog && !dialog.contains(event.target)) dialog.querySelector('[data-action=en-rset-close]')?.focus({ preventScroll: true });
});
function enReaderSettingsFocus(bookId, previous) {
  const active = document.activeElement, inside = previous?.contains(active);
  const attributes = inside ? ["data-action", "data-theme", "data-font", "data-en-rset", "data-on"].filter(key => active.hasAttribute(key)).map(key => [key, active.getAttribute(key)]) : [];
  const scroll = previous?.querySelector('.en-rset-body')?.scrollTop || 0;
  cancelAnimationFrame(enReaderSettingsFrame);
  enReaderSettingsFrame = requestAnimationFrame(() => {
    const s = enState(), dialog = document.querySelector('.en-rset');
    if (!s.readerSet || s.book?.id !== bookId || ui.page !== "english" || !dialog) return;
    const body = dialog.querySelector('.en-rset-body');
    if (body) body.scrollTop = scroll;
    if (dialog.contains(document.activeElement)) return;
    const target = attributes.length ? [...dialog.querySelectorAll('button,input')].find(node => attributes.every(([key,value]) => node.getAttribute(key) === value)) : null;
    (target || dialog.querySelector('[data-action=en-rset-close]'))?.focus({ preventScroll: true });
  });
}
function enReaderSettingsClose() {
  const s = enState(), bookId = s.book?.id;
  s.readerSet = false; s.pop = null; s.readerUi = true;
  cancelAnimationFrame(enReaderSettingsFrame);
  render();
  if (ui.page === "english" && enState().book?.id === bookId) document.querySelector('[data-action=en-rset]')?.focus({ preventScroll: true });
}
// Закрытие книги окончательно отменяет ожидающий ответ: поздний enCall('book')
// может лечь в кэш, но не вправе снова открыть закрытую книгу.
function enBookClose() {
  enBookRequest++;
  const s = enState();
  s.book = null; s.pop = null; s.books = null; s.readerSet = false;
  enTgBack(false);
  render();
}
// Кнопка «назад» Telegram (стрелка в шапке и «назад» на Android) закрывает книгу.
function enTgBack(show) {
  const back = window.Telegram?.WebApp?.BackButton;
  if (!back) return;
  if (!enTgBack.bound) { enTgBack.bound = true; back.onClick(() => { if (window.FlowEnglishMusic?.back()) return; const s = enState(); if (s.readerSet) enReaderSettingsClose(); else if (s.pop) { s.pop = null; render(); } else if (s.book) enBookClose(); }); }
  show ? back.show() : back.hide();
}
function enReaderScreen() {
  const s = enState(), b = s.book, r = enReaderPrefs();
  enTgBack(true);
  const style = `--rs:${r.size}px;--rl:${r.lh};--rfilter:brightness(${r.bright}) contrast(${r.contrast})`;
  if (b.loading) return `<div class="en-reader en-reader-loading theme-${r.theme} ui" style="${style}">
    <header class="en-reader-bar top"><button class="icon-button" type="button" data-action="en-book-close" aria-label="К книгам">${icon("left", "icon-sm")}</button><div class="en-reader-title"><b>${esc(b.title || "Книга")}</b><small>${esc(b.author || "Загрузка")}</small></div></header>
    <div class="en-reader-wait" role="status" aria-live="polite" aria-busy="true"><span class="live-spin" aria-hidden="true"></span><p class="section-note">Открываем книгу…</p><button class="ghost-button" type="button" data-action="en-book-close">Вернуться к книгам</button></div>
  </div>`;
  const marks = new Set((b.marks || []).map(w => w.toLowerCase()));
  // Перевод — под каждым абзацем, как в двуязычных книгах: сверять предложение с предложением.
  const tr = r.tr ? b.tr : null;
  const blocks = String(b.body || "").split(/\n\s*\n/);
  // Двуязычная книга: русский абзац после английского — готовый перевод, показываем его вместо машинного.
  const ru = blocks.map(enIsRu);
  const paras = blocks.map((p, i) => ru[i] ? (r.tr ? `<p class="en-tr own">${esc(p)}</p>` : "") : `<p>${p.split(/(\s+)/).map(part => {
    const w = part.replace(/[^A-Za-z'’-]/g, "").replace(/^['’-]+|['’-]+$/g, "");
    if (!w) return esc(part);
    return `<span class="en-rw ${marks.has(w.toLowerCase()) ? "mark" : ""} ${s.pop?.w === w.toLowerCase() ? "on" : ""}" data-action="en-rword" data-w="${esc(w)}" role="button" tabindex="0" aria-label="Перевод слова ${esc(w)}">${esc(part)}</span>`;
  }).join("")}</p>${!r.tr || ru[i + 1] ? "" : tr ? tr[i] ? `<p class="en-tr">${esc(tr[i])}</p>` : "" : b.trError ? "" : `<p class="en-tr wait"><i></i><i></i></p>`}`).join("");
  b.bilingual = ru.some(Boolean);
  const enter = b.enter ? `enter-${b.enter > 0 ? "next" : "prev"}` : "";
  b.enter = 0; // анимация — один раз, при следующей перерисовке страница уже стоит на месте
  // Машинный перевод нужен, только если есть английский абзац без русской пары.
  if (r.tr && blocks.some((p, i) => !ru[i] && /[A-Za-z]/.test(p) && !ru[i + 1])) enBookTr(b);
  const pop = s.pop ? `<div class="en-pop en-rpop" style="top:${s.pop.y}px;left:${s.pop.x}px">${s.pop.loading ? `<span class="live-spin"></span>` : s.pop.error ? "Не получилось перевести" : `<div class="en-pop-head"><b>${esc(s.pop.lemma)}</b><button class="icon-button en-play" type="button" data-action="en-say" data-text="${esc(s.pop.lemma)}" aria-label="Послушать">${icon("play", "icon-sm")}</button></div><span>${esc(s.pop.ru)}</span>${s.pop.phrase && s.pop.phrase !== s.pop.lemma ? `<small>${esc(s.pop.phrase)} — ${esc(s.pop.phraseRu)}</small>` : ""}<div class="en-pop-foot"><small class="en-pop-saved">${icon("check", "icon-sm")}${s.pop.deck ? "В колоде слов" : "Во «Фразах»"}</small><button class="text-action" type="button" data-action="en-unmark">Снять</button></div>`}</div>` : "";
  const range = (key, label, min, max, step, val, fmt) => `<label class="en-rset-row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-en-rset="${key}"><small>${fmt(val)}</small></label>`;
  const previousSettings = document.querySelector('.en-rset');
  if (s.readerSet) enReaderSettingsFocus(b.id, previousSettings);
  const settings = s.readerSet ? `<div class="en-rset-backdrop" data-action="en-rset-close" aria-hidden="true"></div><section class="en-rset${previousSettings ? '' : ' en-rset-enter'}" data-en-rsheet role="dialog" aria-modal="true" aria-labelledby="en-rset-title">
      <header class="en-rset-head sheet-head"><h2 id="en-rset-title">Настройки чтения</h2><button type="button" class="icon-button" data-action="en-rset-close" aria-label="Закрыть настройки чтения">${icon("close", "icon-sm")}</button></header>
      <div class="en-rset-body">
      <div class="en-rset-themes">${EN_READER_THEMES.map(([k, l]) => `<button type="button" class="en-rtheme theme-${k} ${r.theme === k ? "on" : ""}" data-action="en-rtheme" data-theme="${k}">Аа<small>${l}</small></button>`).join("")}</div>
      ${range("bright", "Яркость", .4, 1.2, .05, r.bright, v => `${Math.round(v * 100)}%`)}
      ${range("contrast", "Контраст", .6, 1.5, .05, r.contrast, v => `${Math.round(v * 100)}%`)}
      ${range("size", "Шрифт", 14, 30, 1, r.size, v => `${v}`)}
      ${range("lh", "Интервал", 1.3, 2.2, .1, r.lh, v => Number(v).toFixed(1))}
      <div class="en-rset-fonts"><button type="button" class="${r.font === "serif" ? "on" : ""}" data-action="en-rfont" data-font="serif" style="font-family:Georgia,serif">С засечками</button><button type="button" class="${r.font === "sans" ? "on" : ""}" data-action="en-rfont" data-font="sans">Без засечек</button></div>
      ${enWholeBook(b)}
      <button type="button" class="text-action" data-action="en-rreset">Сбросить</button>
    </div></section>` : "";
  return `<div class="en-reader theme-${r.theme} font-${r.font} ${s.readerUi ? "ui" : ""}" style="${style}">
    <header class="en-reader-bar top"${s.readerSet ? " inert" : ""}><button class="icon-button" type="button" data-action="en-book-close" aria-label="К книгам">${icon("left", "icon-sm")}</button><div class="en-reader-title"><b>${esc(b.title)}</b><small>${esc(b.author || "")}${b.level ? ` · ${esc(b.level)}` : ""}</small></div><button class="icon-button" type="button" data-action="en-say" data-text="${esc(String(b.body || "").split(/\n\s*\n/)[0].slice(0, 480))}" aria-label="Послушать начало страницы">${icon("play", "icon-sm")}</button><button class="en-aa ${r.tr ? "on" : ""}" type="button" data-action="en-rtr" aria-pressed="${Boolean(r.tr)}" aria-label="Перевод страницы">RU</button><button class="en-aa" type="button" data-action="en-rset" aria-label="Настройки чтения">Aa</button></header>
    <div class="en-reader-scroll"${s.readerSet ? " inert" : ""}><article class="en-page-text ${enter}" data-reader-tap>${b.trError && r.tr ? `<p class="en-tr-error">Перевод не получился — <button type="button" class="text-action" data-action="en-rtr-retry">ещё раз</button></p>` : ""}${paras}${pop}<p class="en-page-num">${b.page + 1} / ${b.pages}</p></article></div>
    ${!s.readerUi && !s.readerSet ? `<button type="button" class="en-exit-fab" data-action="en-book-close" aria-label="Закрыть книгу">${icon("left", "icon-sm")}Книги</button><button type="button" class="en-tr-fab ${r.tr ? "on" : ""}" data-action="en-rtr" aria-pressed="${Boolean(r.tr)}">${r.tr ? "Скрыть перевод" : "Перевод"}</button>` : ""}
    <footer class="en-reader-bar bottom"${s.readerSet ? " inert" : ""}><button class="icon-button" type="button" data-action="en-page" data-d="-1" ${b.page ? "" : "disabled"} aria-label="Назад">${icon("left", "icon-sm")}</button><input type="range" min="1" max="${b.pages}" value="${b.page + 1}" data-en-pageslider aria-label="Страница"><small>${b.page + 1}/${b.pages} · ${Math.round((b.page + 1) / b.pages * 100)}%</small><button class="icon-button" type="button" data-action="en-page" data-d="1" ${b.page + 1 < b.pages ? "" : "disabled"} aria-label="Дальше">${icon("right", "icon-sm")}</button></footer>
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
  s.book = { ...(s.book?.id === id ? s.book : {}), id, title: s.books?.items?.find(x => x.id === id)?.title || (s.book?.id === id ? s.book.title : ""), loading: !s.book || s.book.id !== id };
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
  if (s.readerSet) { enReaderSettingsClose(); return; }
  if (s.pop) { s.pop = null; render(); return; }
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
  const upload = event.target.closest?.(".en-upload");
  if (upload && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    upload.querySelector("[data-en-upload]")?.click();
    return;
  }
  const s = enState();
  if (event.key === "Escape" && s.book && ui.page === "english" && s.tab === "read") {
    event.preventDefault();
    if (s.readerSet) enReaderSettingsClose();
    else if (s.pop) { s.pop = null; render(); }
    else enBookClose();
    return;
  }
  if (s.readerSet && s.book && ui.page === "english" && s.tab === "read") {
    if (event.key === "Tab") {
      const dialog = document.querySelector('.en-rset');
      const targets = [...(dialog?.querySelectorAll('button,input,[tabindex="0"]') || [])].filter(node => !node.disabled && node.getClientRects().length);
      const index = targets.indexOf(document.activeElement);
      event.preventDefault();
      const next = index < 0 ? (event.shiftKey ? targets.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + targets.length) % targets.length;
      targets[next]?.focus();
    }
    return; // Range arrows and scrolling belong to settings, never book pagination.
  }
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
document.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const word = event.target.closest?.('.en-rw[data-action="en-rword"]');
  if (!word) return;
  event.preventDefault();
  enReadWord(word);
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
  const chip = (key, label, n) => `<button type="button" class="en-filter-chip ${s.filter === key ? "active" : ""}" data-action="en-filter" data-filter="${key}" aria-pressed="${s.filter === key}">${label}${n !== undefined ? `<span>${number(n)}</span>` : ""}</button>`;
  const rows = (s.list.items || []).map(p => `<div class="en-phrase ${s.open === p.id ? "open" : ""}"><button type="button" class="en-phrase-main" data-action="en-phrase" data-id="${p.id}"><b lang="en">${esc(p.en)}</b><small>${esc(p.ru)}${p.source === "mistake" ? " · из ошибки" : ""}</small>${enBar(p.strength * 100, 100, p.strength < .34 ? "weak" : "")}</button><button class="icon-button en-say" type="button" data-action="en-say" data-text="${esc(p.en)}" aria-label="Послушать ${esc(p.en)}">${icon("play", "icon-sm")}</button>${s.open === p.id ? `<div class="en-phrase-more">${p.note ? `<p>${esc(p.note)}</p>` : ""}<small>${p.learned ? "Закреплено" : p.due ? `Повтор: ${new Date(p.due).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}` : ""}</small><button class="text-action danger" type="button" data-action="en-delete" data-id="${p.id}">Удалить</button></div>` : ""}</div>`).join("");
  return `<div class="en-phrases-screen">
    <div class="en-subhead"><button type="button" class="en-back" data-action="en-tab" data-tab="words">${icon("left", "icon-sm")}Слова</button></div>
    <p class="en-note">Фразы из уроков и ваших ошибок. Повторяются с интервалами на занятии.</p>
    <label class="en-search">${icon("search", "icon-sm")}<input id="en-search" type="search" value="${esc(s.q)}" placeholder="Найти фразу" aria-label="Поиск фраз"></label>
    <div class="en-chips" role="group" aria-label="Фильтр фраз">${chip("due", "Сегодня", k.due)}${chip("mistakes", "Из ошибок", k.mistakes)}${chip("learned", "Закреплено", k.learned)}${chip("all", "Все")}</div>
    <div class="en-phrase-list">${rows || `<p class="en-empty">${s.filter === "due" ? "На сегодня повторять нечего." : "Здесь пока пусто — фразы появятся из уроков и разговоров."}</p>`}</div>
  </div>`;
}

function enProgressScreen() {
  const s = enState();
  if (!s.progress) { enLoad("progress", "progress"); return enWait(); }
  const p = s.progress, days = Array.isArray(p.days) ? p.days : [];
  const max = Math.max(1, ...days.map(d => d.count));
  const metric = (n, label) => `<div class="en-metric"><b>${n}</b><small>${label}</small></div>`;
  const chart = days.length
    ? `<div class="en-progress-days" role="img" aria-label="${esc(days.map(d => `${d.day || "День"}: ${number(d.count)}`).join("; "))}">${days.map((d, index) => `<i title="${esc(d.day || "")}: ${number(d.count)}" style="height:${Math.max(3, Math.round((d.count || 0) / max * 100))}%" class="${d.count ? "" : "zero"}${index === days.length - 1 ? " today" : ""}"></i>`).join("")}</div>`
    : `<p class="en-empty">История ответов появится после первых занятий.</p>`;
  return `<div class="en-progress">
    <div class="en-progress-head"><h1 class="en-progress-title">Мой прогресс</h1></div>
    <div class="en-subhead"><button type="button" class="en-back" data-action="en-progress">${icon("left", "icon-sm")}Сегодня</button></div>
    <section class="en-progress-metrics" aria-label="Главное">${metric(number(p.streak), enPlural(p.streak || 0, "день подряд", "дня подряд", "дней подряд"))}${metric(enNum(p.words?.known), "слов знаю")}${metric(`${number(p.course?.done)}/${number(p.course?.total)}`, "уроков")}</section>
    <section class="en-progress-block" aria-labelledby="en-progress-days-title"><header><h2 id="en-progress-days-title">4 недели</h2><small>ответов в день · макс. ${number(max)}</small></header>${chart}${days.length ? `<div class="en-progress-weeks" aria-hidden="true"><span>1-я неделя</span><span>2-я</span><span>3-я</span><span>4-я</span></div><p class="en-progress-legend"><i aria-hidden="true"></i>сегодня</p>` : ""}</section>
    <section class="en-progress-block" aria-labelledby="en-progress-phrases-title"><header><h2 id="en-progress-phrases-title">Фразы</h2><small>${number(p.phrases?.mistakes)} из ошибок</small></header><div class="en-progress-line"><span>Закреплено</span>${enBar(p.phrases?.learned, p.phrases?.total)}<small>${number(p.phrases?.learned)}/${number(p.phrases?.total)}</small></div></section>
    <details class="en-settings en-progress-note"><summary><span>Как считается прогресс</span>${icon("down", "icon-sm")}</summary><p class="en-note">«Знаю» и «закреплено» — когда повтор держится хотя бы три недели. Слово, отмеченное «знаю» с первого взгляда, проверим ещё раз через пару недель.</p></details>
  </div>`;
}

// ------------------------------------------------------------ действия

function englishAction(action, control) {
  if(typeof enBrowserAction==='function'&&enBrowserAction(action,control))return true;
  if (!action.startsWith("en-")) return false;
  const s = enState();
  if (action.startsWith('en-training-') && typeof enStructuredAction === 'function') return enStructuredAction(action,control);
  if (action === "en-sync-send") { enSyncWake(); return true; }
  if (action === "en-tab" && control.dataset.tab === "course" && s.tab !== "course") s.practiceView = "hub";
  if (["en-tab", "en-progress", "en-ex-quit", "en-deck-quit", "en-skip", "en-talk", "en-rule-talk", "en-media-tab", "en-chat-reset", "en-live-stop"].includes(action)) { enViewGeneration++; enCancelChat(); enStopPcm(); }
  if (action === "en-retry") {
    const key=control.dataset.key, failed=s.failedLoads?.[key];
    if(failed){delete s.failedLoads[key];s.error="";enLoad(key,failed.op,failed.args);enRerender();}
    return true;
  }
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
  if (action === "en-media-tab") { s.mediaTab = control.dataset.tab === "music" ? "music" : "books"; s.book = null; s.pop = null; if (s.mediaTab === "books") s.books = null; render(); return true; }
  if (action === "en-progress") { if (s.tab === "progress") s.tab = "today"; else { s.tab = "progress"; s.progress = null; } render(); return true; }
  if (action === "en-tab") { const keys=({today:['today'],chat:['today'],words:['words','wordlist'],course:['course'],read:['books'],progress:['progress'],phrases:['list']})[control.dataset.tab] || []; for(const key of keys)if(s.failedLoads)delete s.failedLoads[key];s.error=""; if (s.tab === "chat" && control.dataset.tab !== "chat") { enStopPcm(); enLiveStop(); } if (s.rulesStale && control.dataset.tab === "today") { s.today = null; s.rulesStale = false; } s.deck = null; s.tab = control.dataset.tab; if (s.tab === "phrases") s.list = null; if (s.tab === "progress") s.progress = null; if (s.tab === "words") { s.words = null; s.wordlist = null; } if (s.tab === "course") s.course = null; if (s.tab === "read") { s.books = null; s.book = null; s.pop = null; } render(); return true; }
  if (action === "en-start") { enLessonStart(); return true; }
  if (action === "en-home") { s.tab = "today"; navigate("english"); if (s.today && !s.today.plan.doneToday) enLessonStart(); else render(); return true; }
  if (action === "en-say") { enCancelChat(); enSpeak(control.dataset.text, control); return true; }
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
  if (action === "en-practice-course" || action === "en-practice-back") { s.tab = "course"; s.practiceView = action === "en-practice-course" ? "course" : "hub"; render(); return true; }
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

    if (![1,2,3].includes(r) || !ex.answer?.shown) return true;
    if (item.introduced && !enRecord("grade", { id: item.id, rating: r, correct: null, practice: true, attempt: `${item.id}-${Date.now()}-${ex.index}` })) return true;
    ex.done++; ex.practiceDone = (ex.practiceDone || 0) + 1;
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
  if (action === "en-book-close") { enBookClose(); return true; }
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
  if (action === "en-rset-close") { enReaderSettingsClose(); return true; }
  if (action === "en-rset") { if (s.readerSet) enReaderSettingsClose(); else { s.readerSet = true; s.readerUi = true; s.pop = null; render(); } return true; }
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
  if (!ex || ex.checking || ex.answer) return;
  const current = enViewGuard();
  const item = ex.items[ex.index];
  ex.draft = text; ex.checking = true; render();
  let c;
  try { c = await enCall("check", { id: item.id, answer: text }); } catch (_) { c = null; }
  if (!current()) return;
  ex.checking = false;
  if (!c || c.error || !["correct", "close", "wrong"].includes(c.verdict)) { render(); toast("Проверка недоступна. Ответ сохранён — попробуйте ещё раз."); return; }
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
  if (event.target.closest?.("[data-en-chat]") && s.chat) s.chat.draft = event.target.value;
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
function enLeaveEnglish() {
  enViewGeneration++; enCancelChat(); enStopPcm();
  const s = ui.en;
  if (s?.ex?.loading) s.ex = null;
  if (s?.deck?.loading) s.deck = null;
  if (s?.ex) s.ex.checking = false;
  if (enLive.state !== "off") enLiveStop();
}
window.addEventListener("hashchange", () => { if (!location.hash.includes("english")) enLeaveEnglish(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) { enCancelChat(); enStopPcm(); enLiveStop(); } });
window.addEventListener("pagehide", enLeaveEnglish);
