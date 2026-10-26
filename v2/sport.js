/*
 * «Спорт» — WooSport внутри Flow.
 *
 * Расчёты (таймеры, программы, цели, замеры, привычки, счётчики, импорт плана)
 * — это код WooSport, собранный в sport-core.js (window.SportCore); здесь только
 * экраны в стиле Flow и синхронизация. Состояние — один объект, как в WooSport:
 * правка меняет его на месте (интерфейс отзывается сразу), а на сервер уходит
 * разница путями (stateChanges), которую сервер накладывает на свежую строку —
 * правка с телефона и кнопка «✓ Душ» в Telegram не затирают друг друга.
 *
 * Файлы: sport.js — данные, «Сегодня», привычки, счётчики, подъём, календарь;
 * sport-train.js — тренировка, таймеры и полноэкранный режим; sport-more.js —
 * цели, профиль, замеры, инвентарь, история, настройки, импорт программ.
 * Без моста (window.sorokaSport) — демо WooSport, данные не сохраняются.
 */

const SP = () => window.SportCore;
const SP_ACTIONS = {};
const SP_FORMS = {};
const SP_SHEETS = {};

function spCall(op, args = {}) {
  if (typeof window.sorokaSport === "function") return window.sorokaSport(op, args);
  return Promise.resolve(spDemo(op, args));
}
function spDemo(op, args) {
  const C = SP();
  if (op === "load") {
    const day = C.DEMO_PROGRAM_DAY;
    return { state: C.createDemoState(), catalog: {}, startedOn: C.offsetDateKey(C.todayKey(), 1 - day), updatedAt: "", demo: true };
  }
  if (op === "import") {
    const merged = C.mergeCatalog(spState().catalog, C.parsePlan(args.json));
    return { ...merged, catalog: merged.catalog };
  }
  return { ok: true };
}

function spState() {
  ui.sp ||= { tab: "today", state: null, catalog: {}, planDays: [], startedOn: null, date: null, weekStart: null, kind: "main", sheet: null, pending: [], open: {}, wakeAsked: false };
  return ui.sp;
}
const spEsc = value => esc(value ?? "");
const spPlural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };
const spDateLong = date => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const spDateShort = date => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).replace(".", "");

// ------------------------------------------------------------ загрузка и запись

function spReady() { const s = spState(); return Boolean(SP() && s.state); }
function spLoad() {
  const s = spState();
  if (s.loading || !SP()) return;
  s.loading = true;
  spCall("load").then(answer => {
    if (!answer || answer.error) throw new Error(answer?.error || "load");
    const C = SP();
    s.state = answer.state || {};
    for (const key of ["notes", "tests", "checks", "showers", "readiness"]) s.state[key] ||= {};
    s.catalog = answer.catalog || {};
    s.startedOn = answer.startedOn;
    s.demo = Boolean(answer.demo);
    s.planDays = s.demo ? C.DEMO_PLAN_DAYS : [];
    C.setTimerIdentity("owner");
    spZone();
    s.date ||= C.todayKey();
    s.weekStart ||= C.startOfWeekKey(s.date);
    s.error = "";
    // Первый вход в раздел заводит настройки уведомлений (как в WooSport):
    // с ними сервер начинает напоминать о душе, подъёме и тренировке.
    if (!s.state.notificationSettings) {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow";
      spUpdate(prev => ({ ...prev, notificationSettings: C.notificationSettings({ timeZone: zone }) }));
    }
  }).catch(error => { s.error = "Не удалось загрузить данные спорта. Проверьте связь."; console.warn(error); })
    .finally(() => { s.loading = false; spRerender(true); });
}
function spZone() {
  const C = SP(), s = spState();
  C.setCalendarTimeZone(C.notificationSettings(s.state?.notificationSettings).timeZone);
}

let spFlushing = Promise.resolve();
/** Правка состояния: сразу на экране, на сервер — разницей путями. Возвращает
 *  обещание записи: формы ждут его, чтобы честно сказать «сохранено». */
function spUpdate(fn) {
  const s = spState(), C = SP();
  const prev = s.state;
  const next = fn(prev);
  if (!next || next === prev) return Promise.resolve();
  s.state = next;
  spZone();
  if (!s.demo) s.pending.push(...C.stateChanges(prev, next));
  spRerender();
  if (s.demo) return Promise.resolve();
  const run = spFlushing.then(async () => {
    if (!s.pending.length) return;
    const sent = s.pending; s.pending = [];
    try {
      const answer = await spCall("patch", { changes: sent });
      if (!answer || answer.error) throw new Error(answer?.error || "patch");
      // Что успели поменять, пока шёл ответ, накладываем поверх серверного.
      s.state = C.applyStateChanges(answer.state, s.pending);
      s.saveError = "";
    } catch (error) {
      s.pending = [...sent, ...s.pending];
      s.saveError = "Изменения не сохранились — проверьте связь, они отправятся при следующей правке.";
      throw error;
    } finally { spRerender(); }
  });
  spFlushing = run.catch(() => {});
  return run;
}
/** Перерисовка без потери набранного: пока курсор в поле окна, ждём. */
function spRerender(force = false) {
  if (!["sport", "today"].includes(ui.page)) return;
  const field = document.activeElement;
  if (!force && field && field.closest?.(".sp-sheet, .sp-page") && /INPUT|TEXTAREA|SELECT/.test(field.tagName) && field.type !== "checkbox" && field.type !== "range") return;
  render();
}
// Вернулись в приложение — подтянуть то, что отметили кнопкой в Telegram.
document.addEventListener("visibilitychange", () => {
  const s = spState();
  if (document.hidden || !s.state || s.demo || s.pending.length || typeof window.sorokaSport !== "function") return;
  spCall("load").then(answer => { if (answer?.state && !s.pending.length) { s.state = answer.state; s.catalog = answer.catalog || {}; spZone(); spRerender(); } }).catch(() => {});
});

function spDay() { const s = spState(); return SP().programDaySince(s.startedOn || SP().todayKey()); }
function spOptions() {
  const s = spState(), C = SP();
  const all = C.workoutOptions(s.planDays, s.catalog, spDay(), s.startedOn || undefined);
  return { all, visible: C.visibleWorkoutOptions(all, s.state) };
}

// ------------------------------------------------------------ значки (из WooSport)

const SP_ICON = {
  dumbbell: '<svg class="sp-ic" viewBox="0 0 24 24" fill="currentColor"><rect x="1.6" y="8.6" width="2.6" height="6.8" rx=".8"/><rect x="4.8" y="6.4" width="3.2" height="11.2" rx="1"/><rect x="8" y="10.4" width="8" height="3.2"/><rect x="16" y="6.4" width="3.2" height="11.2" rx="1"/><rect x="19.8" y="8.6" width="2.6" height="6.8" rx=".8"/></svg>',
  play: '<svg class="sp-ic" viewBox="0 0 512 512" fill="currentColor"><path d="m22.4 256v-166.3c0-68.9 74.6-112 134.2-77.5l144.1 83.2 144.1 83.2c59.7 34.4 59.7 120.6 0 155l-144.1 83.2-144.1 83.2c-59.6 34.3-134.2-8.7-134.2-77.6z"/></svg>',
  technique: '<svg class="sp-ic" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M4.4 2.6h15.2a1.8 1.8 0 0 1 1.8 1.8v15.2a1.8 1.8 0 0 1-1.8 1.8H4.4a1.8 1.8 0 0 1-1.8-1.8V4.4a1.8 1.8 0 0 1 1.8-1.8zm2 4.2v2.4h11.2V6.8zm0 4.6v2.4h11.2v-2.4zm0 4.6v2.4h7v-2.4z"/></svg>',
  reset: '<svg class="sp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.6 12a7.4 7.4 0 1 0 2.4-5.5"/><path d="M3.4 4.2v4.9h4.9"/></svg>',
  heart: '<svg class="sp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 20.4 4.3 12.9a4.8 4.8 0 0 1 0-6.9 5 5 0 0 1 7 0l.7.7.7-.7a5 5 0 0 1 7 0 4.8 4.8 0 0 1 0 6.9z"/></svg>',
  heartOn: '<svg class="sp-ic" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.4 4.3 12.9a4.8 4.8 0 0 1 0-6.9 5 5 0 0 1 7 0l.7.7.7-.7a5 5 0 0 1 7 0 4.8 4.8 0 0 1 0 6.9z"/></svg>',
  sun: '<svg class="sp-ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.4" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1.6v3M12 19.4v3M1.6 12h3M19.4 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1"/></g></svg>',
  moon: '<svg class="sp-ic" viewBox="0 0 24 24" fill="currentColor"><path d="M21.4 14.3A9.4 9.4 0 0 1 9.7 2.6a9.4 9.4 0 1 0 11.7 11.7z"/></svg>',
  pause: '<svg class="sp-ic" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5.5" width="3.6" height="13" rx="1"/><rect x="13.4" y="5.5" width="3.6" height="13" rx="1"/></svg>',
  resume: '<svg class="sp-ic" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5 19 12 8 18.5z"/></svg>',
  skip: '<svg class="sp-ic" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5.5 15 12 6 18.5z"/><rect x="16.5" y="5.5" width="3" height="13" rx="1"/></svg>',
};
const SP_EQUIPMENT_ICON = {
  gym: '<path d="M2 3h20v2H2zM3 5h2v16H3zM19 5h2v16h-2zM7 10h10v2H7zM7 16h10v2H7zM8 8h2v6H8zM14 8h2v6h-2z"/>',
  bodyweight: '<circle cx="12" cy="4.3" r="2.7"/><path d="M12 7.6c-1 0-1.9.4-2.5 1.1L6 12a1.4 1.4 0 0 0 1.6 2.3l1.8-.9v2.2l-2.6 5.1a1.5 1.5 0 0 0 2.6 1.3L12 17.7l2.6 4.3a1.5 1.5 0 0 0 2.6-1.3l-2.6-5.1v-2.2l1.8.9A1.4 1.4 0 0 0 18 12l-3.5-3.3c-.6-.7-1.5-1.1-2.5-1.1z"/>',
  dumbbells: '<rect x="1.6" y="8.6" width="2.6" height="6.8" rx=".8"/><rect x="4.8" y="6.4" width="3.2" height="11.2" rx="1"/><rect x="8" y="10.4" width="8" height="3.2"/><rect x="16" y="6.4" width="3.2" height="11.2" rx="1"/><rect x="19.8" y="8.6" width="2.6" height="6.8" rx=".8"/>',
  barbell: '<rect x="1.2" y="11" width="21.6" height="2" rx=".6"/><rect x="3" y="6.2" width="2.6" height="11.6" rx=".8"/><rect x="6.4" y="8.4" width="2" height="7.2" rx=".6"/><rect x="15.6" y="8.4" width="2" height="7.2" rx=".6"/><rect x="18.4" y="6.2" width="2.6" height="11.6" rx=".8"/>',
  kettlebell: '<path d="M12 1.8a6 6 0 0 0-5.4 8.6l2.6-1.4a3.4 3.4 0 1 1 5.6 0l2.6 1.4A6 6 0 0 0 12 1.8z"/><path d="M12 9.2c-4.1 0-7.4 3.6-7.4 8 0 2.1.8 4 2.1 5.2h10.6c1.3-1.2 2.1-3.1 2.1-5.2 0-4.4-3.3-8-7.4-8z"/>',
  plates: '<path fill-rule="evenodd" d="M15.2 3.4a8.9 8.9 0 1 1 0 17.8 8.9 8.9 0 0 1 0-17.8zm0 6.4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM7.4 6.2a6.1 6.1 0 0 1 2.6.6 10.5 10.5 0 0 0 0 10.6 6.1 6.1 0 1 1-2.6-11.2zm0 4.3a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6z"/>',
  band: '<g transform="rotate(-24 12 12)"><path fill-rule="evenodd" d="M5.4 8.2h13.2a3.8 3.8 0 0 1 0 7.6H5.4a3.8 3.8 0 0 1 0-7.6zm0 2.6a1.2 1.2 0 0 0 0 2.4h13.2a1.2 1.2 0 0 0 0-2.4z"/></g>',
  pullup_bar: '<rect x="1.8" y="3.4" width="20.4" height="2.2" rx="1.1"/><rect x="3.6" y="5.6" width="2.9" height="15.4" rx=".6"/><rect x="17.5" y="5.6" width="2.9" height="15.4" rx=".6"/>',
  bench: '<rect x="2.4" y="9.4" width="19.2" height="3" rx="1"/><rect x="2.4" y="4.6" width="6.4" height="2.6" rx="1"/><rect x="4.4" y="12.4" width="2.4" height="6.8" rx=".6"/><rect x="17.2" y="12.4" width="2.4" height="6.8" rx=".6"/>',
  expander: '<path fill-rule="evenodd" d="M12 2.6a9.4 9.4 0 1 1 0 18.8 9.4 9.4 0 0 1 0-18.8zm0 4.4a4.9 4.3 0 1 0 0 8.6 4.9 4.3 0 0 0 0-8.6zM7.2 8.9a2.1.7-42 1 1 3.1-2.8 2.1.7-42 1 1-3.1 2.8z"/>',
  powerball: '<circle cx="12" cy="12" r="6.6"/><ellipse cx="12" cy="12" rx="10.4" ry="4.2" transform="rotate(-62 12 12)" fill="none" stroke="currentColor" stroke-width="1.9"/>',
  weight: '<path fill-rule="evenodd" d="M4 4.4h16a1.9 1.9 0 0 1 1.9 1.9v11.4a1.9 1.9 0 0 1-1.9 1.9H4a1.9 1.9 0 0 1-1.9-1.9V6.3A1.9 1.9 0 0 1 4 4.4zm0 2.4a.6.6 0 0 0-.6.6v9.6h17.2V7.4a.6.6 0 0 0-.6-.6z"/><path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M7.4 14.6a5.4 5.4 0 0 1 9.2-3.8"/><path d="M12 14.9 15.6 10l1.3 1-4 4.6z"/>',
  height: '<path fill-rule="evenodd" d="M8.4 2.2h7.2a1.4 1.4 0 0 1 1.4 1.4v16.8a1.4 1.4 0 0 1-1.4 1.4H8.4A1.4 1.4 0 0 1 7 20.4V3.6a1.4 1.4 0 0 1 1.4-1.4zm.2 3.6v1.5h3.6V5.8zm0 3.6v1.5h2.2V9.4zm0 3.6v1.5h3.6V13zm0 3.6v1.5h2.2v-1.5z"/>',
};
const spEquipIcon = id => SP_EQUIPMENT_ICON[id] ? `<svg class="sp-ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${SP_EQUIPMENT_ICON[id]}</svg>` : "";

// ------------------------------------------------------------ страница

const SP_TABS = [["today", "Сегодня"], ["training", "Тренировка"], ["goals", "Цели"], ["profile", "Профиль"]];

function renderSportPage() {
  const s = spState();
  if (!SP()) return `${header("Спорт", "", "")}<div class="sp-page"><p class="section-note">Не загрузился модуль спорта — обновите приложение.</p></div>`;
  if (!s.state) { spLoad(); return `${header("Спорт", "", "")}<div class="sp-page"><div class="en-wait"><span class="live-spin"></span></div>${s.error ? `<p class="section-note">${spEsc(s.error)}</p>` : ""}</div>`; }
  const C = SP();
  const tabs = `<div class="sp-tabs" role="tablist">${SP_TABS.map(([key, label]) => `<button type="button" role="tab" class="${s.tab === key ? "active" : ""}" aria-selected="${s.tab === key}" data-action="sp-tab" data-tab="${key}">${label}${key === "profile" && C.profileGaps(s.state).any ? '<i class="sp-dot" aria-label="есть незаполненное"></i>' : ""}</button>`).join("")}</div>`;
  const body = s.tab === "training" ? spTrainingScreen() : s.tab === "goals" ? spGoalsScreen() : s.tab === "profile" ? spProfileScreen() : spTodayScreen();
  const banner = s.demo ? `<p class="sp-demo">Демо WooSport · данные не сохраняются</p>` : "";
  const failed = s.saveError ? `<p class="sp-error" role="alert">${spEsc(s.saveError)}</p>` : "";
  // Программу добавляют чаще, чем меняют настройки: плюс — в шапке, рядом с поиском.
  const head = header("Спорт", "", "").replace('<div class="header-actions">', `<div class="header-actions"><button class="icon-button" type="button" data-action="sp-import-open" aria-label="Добавить программу">${icon("plus")}</button><button class="icon-button" type="button" data-action="sp-settings-open" aria-label="Настройки спорта">${icon("settings")}</button>`);
  return `${head}<div class="sp-page">${banner}${failed}${tabs}${body}</div>${spSheetHtml()}`;
}

// ------------------------------------------------------------ окна (шторки Flow)

function spOpen(kind, extra = {}) { const s = spState(); s.sheet = { kind, ...extra }; s.sheetError = ""; render(); }
function spClose() { const s = spState(); s.sheet = null; s.sheetError = ""; render(); }
function spSheetHtml() {
  const s = spState();
  if (!s.sheet || !SP_SHEETS[s.sheet.kind]) return "";
  const view = SP_SHEETS[s.sheet.kind](s.sheet);
  if (!view) return "";
  return `<div class="modal-backdrop sp-backdrop" data-action="sp-backdrop"><section class="sheet sp-sheet ${view.wide ? "is-wide" : ""}" role="dialog" aria-modal="true" aria-label="${spEsc(view.title)}"><div class="sheet-handle"></div><div class="sheet-head"><h2>${spEsc(view.title)}</h2><button class="icon-button" type="button" data-action="sp-close" aria-label="Закрыть">${icon("close")}</button></div>${view.body}${s.sheetError ? `<p class="sp-error" role="alert">${spEsc(s.sheetError)}</p>` : ""}</section></div>`;
}
function spSheetError(message) { spState().sheetError = message; render(); }

// ------------------------------------------------------------ «Сегодня»

function spTodayScreen() {
  const s = spState(), C = SP();
  const today = C.todayKey();
  const date = s.date;
  const { visible } = spOptions();
  const label = spDateLong(date);
  const parts = [spCalendar(visible)];
  if (date > today) parts.push(`<p class="sp-marker">${label} · план</p>`);
  else {
    if (date !== today) parts.push(`<p class="sp-marker">${label} · журнал</p>`);
    parts.push(spHabitsCard(date));
    const mobility = ["main", "splits", "test"].map(kind => C.selectedOption(visible, date, kind, s.state)?.mobility).find(Boolean);
    parts.push(spWarmupCard(date, mobility));
    if (date === today) parts.push(spWakeCard(), spCountersCard());
  }
  parts.push(spTestCard(visible, date));
  // Вопрос «во сколько проснулся?» — один раз за запуск, после часа из настроек.
  if (!s.wakeAsked && date === today && C.shouldAskWakeTime(s.state) && !s.sheet) {
    s.wakeAsked = true;
    queueMicrotask(() => spOpen("wake", { date: today, asked: true }));
  }
  if (!visible.length && !s.demo) parts.unshift(spStartPrompt());
  return parts.join("");
}

// Первый запуск: без программы тренировок нечего показывать — три шага по порядку.
function spStartPrompt() {
  const gaps = SP().profileGaps(spState().state);
  return `<section class="sp-card sp-start"><p class="sp-kicker">Первый шаг</p><h2>Начнём с вашей программы</h2><p class="section-note">Три шага по порядку: рассказать о себе, забрать инструкцию для ИИ, вставить готовый план.</p>
    <ol class="sp-steps">
      <li><b>01</b><span><strong>Профиль</strong><small>Анкета, фокус мышц, инвентарь и замеры</small></span><button class="ghost-button" type="button" data-action="sp-tab" data-tab="profile">${gaps.any ? "Заполнить" : "Проверить"}</button></li>
      <li><b>02</b><span><strong>Инструкция для ИИ</strong><small>Правила и ваши данные одним текстом</small></span><button class="ghost-button" type="button" data-action="sp-copy-packet">Скопировать</button></li>
      <li><b>03</b><span><strong>Программа</strong><small>Вставьте JSON, который вернул ИИ</small></span><button class="primary-button" type="button" data-action="sp-import-open">Добавить</button></li>
    </ol></section>`;
}

function spCalendar(options) {
  const s = spState(), C = SP();
  const today = C.todayKey();
  const dates = Array.from({ length: 28 }, (_, i) => C.offsetDateKey(s.weekStart, i));
  const completion = date => date > today ? 0 : Math.max(0, ...options.filter(o => o.date === date && o.kind === "main").map(o => C.optionCompletion(o, s.state)));
  const planned = date => options.some(o => o.date === date && o.kind === "main");
  const tests = new Set(options.filter(o => o.kind === "test").map(o => o.date));
  const month = new Intl.DateTimeFormat("ru-RU", { month: "long", timeZone: "UTC" });
  const first = month.format(C.dateFromKey(dates[0])), last = month.format(C.dateFromKey(dates[27]));
  const cells = dates.map(date => {
    const pct = completion(date);
    const cls = ["sp-day", date === today ? "today" : "", date === s.date ? "selected" : "", pct === 100 ? "done" : date < today && planned(date) ? "missed" : "", tests.has(date) ? "test" : ""].filter(Boolean).join(" ");
    const marks = date <= today ? `<span class="sp-day-marks"><i class="${s.state.warmups?.[date] ? "on" : ""}"></i><i class="${s.state.showers?.[date] ? "on" : ""}"></i></span>` : "";
    return `<button type="button" class="${cls}" data-action="sp-date" data-date="${date}" aria-pressed="${date === s.date}" aria-label="${spDateLong(date)}${pct === 100 ? ", тренировка выполнена" : planned(date) ? `, тренировка ${pct}%` : ""}">${Number(date.slice(8))}${pct > 0 && pct < 100 ? `<em style="--p:${pct}%"></em>` : ""}${marks}</button>`;
  }).join("");
  return `<section class="sp-card sp-calendar"><div class="sp-cal-head"><button class="icon-button" type="button" data-action="sp-weeks" data-d="-1" aria-label="Неделя назад">${icon("left")}</button><div><small>4 недели</small><b>${first === last ? first : `${first} — ${last}`} <em>${dates[27].slice(0, 4)}</em></b></div><button class="icon-button" type="button" data-action="sp-weeks" data-d="1" aria-label="Неделя вперёд">${icon("right")}</button></div>
    <div class="sp-weekdays">${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(d => `<span>${d}</span>`).join("")}</div>
    <div class="sp-month" data-sp-swipe>${cells}</div>
    <div class="sp-cal-foot"><span class="sp-legend"><i class="done"></i>Выполнено<i class="missed"></i>Пропуск<i class="test"></i>Тест<i class="warm"></i>Разминка<i class="shower"></i>Душ</span>${s.date !== today ? `<button class="text-action" type="button" data-action="sp-today">Сегодня</button>` : ""}</div></section>`;
}

// Серия, которая «сгорит»: сегодня ещё не отмечено, а вчерашняя серия стоит.
function spStreak(entries, date, total = 1) {
  const C = SP();
  const count = from => { let n = 0, cursor = from; while (C.habitDone(entries[cursor], total) >= total) { n++; cursor = C.offsetDateKey(cursor, -1); } return n; };
  const done = C.habitDone(entries[date], total);
  if (done >= total) return { days: count(date), atRisk: false, done, total };
  const days = count(C.offsetDateKey(date, -1));
  const started = date === C.todayKey() && new Date().getHours() >= C.DAY_START_HOUR;
  return { days, atRisk: days > 0 && started, done, total };
}

function spHabitRow({ id, label, marks, date, total = 1, dayParts = false, since, reminders, editable }) {
  const s = spState(), C = SP();
  const st = spStreak(marks, date, total);
  const complete = st.done >= total;
  const open = s.open[`habit:${id}`];
  const check = complete ? icon("check", "icon-sm") : dayParts ? (st.done === 0 ? SP_ICON.sun : SP_ICON.moon) : total > 1 ? `<i class="sp-frac">${st.done}/${total}</i>` : "";
  const streak = `<span class="sp-streak ${st.atRisk ? "risk" : ""}"><b>${st.days}</b> ${st.atRisk ? `${spPlural(st.days, "день", "дня", "дней")} сгорит` : spPlural(st.days, "день", "дня", "дней")}</span>`;
  let details = "";
  if (open) {
    const stats = C.habitStats(marks, date, total);
    const began = C.habitStart(marks, since);
    const length = C.stripLength(began, date);
    const days = C.habitDays(marks, length, date, total, since);
    details = `<div class="sp-habit-more"><dl class="sp-stats"><div><dt>Сейчас</dt><dd>${stats.currentDays}</dd></div><div><dt>Рекорд</dt><dd>${stats.longestDays}</dd></div><div><dt>Всего дней</dt><dd>${stats.totalDays}</dd></div></dl>
      ${length ? spStrip(days.map(d => ({ date: d.date, state: d.state })), began) : ""}
      ${reminders?.length ? `<p class="section-note">Напоминания: ${reminders.join(", ")}</p>` : ""}
      ${editable ? `<button class="text-action" type="button" data-action="sp-habit-edit" data-id="${spEsc(id)}">Изменить</button>` : ""}</div>`;
  }
  return `<div class="sp-habit ${complete ? "done" : ""} ${open ? "open" : ""}"><div class="sp-habit-row"><button type="button" class="sp-habit-name" data-action="sp-toggle-open" data-key="habit:${spEsc(id)}" aria-expanded="${Boolean(open)}"><i class="sp-caret"></i>${spEsc(label)}</button>${streak}<button type="button" class="sp-check ${complete ? "on" : ""}" data-action="sp-habit" data-id="${spEsc(id)}" aria-pressed="${complete}" aria-label="${spEsc(label)}: ${complete ? "снять отметку" : "отметить"}">${check}</button></div>${details}</div>`;
}
function spStrip(days, began) {
  return `<div class="sp-strip-wrap"><div class="sp-strip" data-sp-strip>${days.map(d => `<span class="is-${d.state}" title="${spDateLong(d.date)}">${Number(d.date.slice(8))}</span>`).join("")}</div><small>С ${spDateLong(began)} · сегодня справа</small></div>`;
}

function spHabitsCard(date) {
  const s = spState(), C = SP();
  const rows = [spHabitRow({ id: "shower", label: "Контрастный душ", marks: s.state.showers || {}, date })];
  for (const [id, habit] of Object.entries(s.state.customHabits || {})) {
    if (habit.archived || habit.createdOn > date) continue;
    rows.push(spHabitRow({ id, label: habit.name, marks: s.state.habitChecks?.[id] || {}, date, total: C.habitTarget(habit), dayParts: C.isMorningEvening(habit), since: habit.createdOn, reminders: C.habitReminders(habit).map(r => r.time), editable: true }));
  }
  return `<section class="sp-card"><div class="sp-card-head"><p class="sp-kicker">01 · Привычки</p><span>${date === C.todayKey() ? "Сегодня" : "Журнал дня"}<button class="sp-add" type="button" data-action="sp-habit-new" aria-label="Добавить привычку">${icon("plus", "icon-sm")}</button></span></div>${rows.join("")}</section>`;
}

function spWarmupCard(date, plan) {
  const s = spState(), C = SP();
  const exercises = plan?.exercises || [];
  const total = exercises.length || 5;
  const value = s.state.warmups?.[date];
  const done = typeof value === "number" ? Math.min(total, value) : value ? total : 0;
  const complete = done >= total;
  const flags = Object.fromEntries(Object.entries(s.state.warmups || {}).map(([k, v]) => [k, (typeof v === "number" ? v >= total : Boolean(v))]));
  const st = spStreak(flags, date);
  return `<section class="sp-card"><div class="sp-card-head"><p class="sp-kicker">02 · Утренняя разминка</p><span class="sp-streak ${st.atRisk ? "risk" : ""}"><b>${st.days}</b> ${spPlural(st.days, "день", "дня", "дней")}${st.atRisk ? " сгорит" : ""}</span></div>
    <div class="sp-habit ${complete ? "done" : ""}"><div class="sp-habit-row"><span class="sp-habit-name plain">Разминка сделана</span><button type="button" class="sp-check ${complete ? "on" : ""}" data-action="sp-warmup" aria-pressed="${complete}" aria-label="Утренняя разминка: ${complete ? "снять отметку" : "отметить"}">${complete ? icon("check", "icon-sm") : ""}</button></div></div>
    ${exercises.length ? `<details class="sp-details"><summary>Что делать · ${exercises.length}</summary><ol class="sp-steps-list">${exercises.map(e => `<li><span>${spEsc(e.name)}</span><b>${spEsc(e.sets_reps)}</b></li>`).join("")}</ol></details>` : `<p class="section-note">Разминка на подвижность не задана в программе — отметьте просто по факту.</p>`}</section>`;
}

function spWakeCard() {
  const s = spState(), C = SP();
  const points = C.wakeSeries(s.state, 14);
  const logged = points.filter(p => p.minutes !== null).map(p => p.minutes);
  const average = C.wakeAverage(points);
  const today = points[points.length - 1];
  const low = logged.length ? Math.min(...logged) - 45 : 300, high = logged.length ? Math.max(...logged) + 45 : 600;
  const span = Math.max(60, high - low);
  const bars = points.map(p => `<span class="${p.minutes === null ? "empty" : ""}"><i>${p.minutes !== null ? `<b style="top:${Math.min(92, Math.max(0, (p.minutes - low) / span * 100))}%"></b>` : ""}</i><small>${C.weekdayLabel(p.date)}</small></span>`).join("");
  return `<section class="sp-card"><div class="sp-card-head"><p class="sp-kicker">03 · Подъём</p><span>${today?.time ? `Сегодня в ${today.time}` : "Сегодня не отмечено"}</span></div>
    <button type="button" class="sp-wake" data-action="sp-wake-log" aria-label="Журнал подъёмов"><span class="sp-wake-sum"><b>${average === null ? "—" : C.formatMinutes(average)}</b><small>в среднем за 14 дней</small></span><span class="sp-wake-bars">${bars}</span></button>
    ${!today?.time ? `<button class="ghost-button sp-wide" type="button" data-action="sp-wake-edit" data-date="${C.todayKey()}">Отметить подъём</button>` : ""}</section>`;
}

function spCountersCard() {
  const s = spState(), C = SP();
  const now = Date.now();
  const entries = C.activeCounters(s.state.counters || {}, now);
  const rows = entries.map(([id, counter]) => {
    const t = C.elapsedTime(counter.startedAt, now);
    const st = C.counterStats(counter, now);
    const open = s.open[`counter:${id}`];
    const goal = st.goalDays !== undefined ? `<div class="sp-goalbar ${st.goalReached ? "done" : ""}"><i style="width:${Math.min(100, Math.round(st.currentDays / st.goalDays * 100))}%"></i><small>${st.goalReached ? `Цель ${st.goalDays} ${spPlural(st.goalDays, "день", "дня", "дней")} взята` : `${st.currentDays} из ${st.goalDays} · осталось ${st.goalRemaining}`}</small></div>` : "";
    let more = "";
    if (open) {
      const began = C.counterStart(counter), length = C.stripLength(began, C.todayKey());
      const days = C.counterDays(counter, length, C.todayKey());
      more = `<div class="sp-habit-more"><dl class="sp-stats"><div><dt>Сейчас</dt><dd>${st.currentDays}</dd></div><div><dt>Рекорд</dt><dd>${st.longestDays}</dd></div><div><dt>Срывов</dt><dd>${st.slips}</dd></div></dl>${length ? spStrip(days.map(d => ({ date: d.date, state: d.state })), began) : ""}
        <div class="sp-row-actions"><button class="text-action" type="button" data-action="sp-counter-edit" data-id="${spEsc(id)}">Изменить</button><button class="text-action danger" type="button" data-action="sp-relapse-ask" data-id="${spEsc(id)}">Сорвался</button></div></div>`;
    }
    return `<div class="sp-counter ${open ? "open" : ""}"><button type="button" class="sp-counter-row" data-action="sp-toggle-open" data-key="counter:${spEsc(id)}" aria-expanded="${Boolean(open)}"><span><strong><i class="sp-caret"></i>${spEsc(counter.name)}</strong><small>С ${new Date(counter.startedAt).toLocaleDateString("ru-RU")}</small></span><span class="sp-clock"><b>${t.days} <small>${spPlural(t.days, "день", "дня", "дней")}</small></b><span data-sp-clock="${spEsc(counter.startedAt)}">${[t.hours, t.minutes, t.seconds].map(n => String(n).padStart(2, "0")).join(":")}</span></span></button>${goal}${more}</div>`;
  }).join("");
  return `<section class="sp-card"><div class="sp-card-head"><p class="sp-kicker">04 · Счётчики</p><button class="sp-add" type="button" data-action="sp-counter-new" aria-label="Добавить счётчик">${icon("plus", "icon-sm")}</button></div>${rows || `<p class="section-note">«Не курю», «Без алкоголя» или любое событие — плюсом сверху.</p>`}</section>`;
}
// Часы счётчиков тикают без перерисовки страницы.
setInterval(() => {
  if (ui.page !== "sport" || !SP()) return;
  for (const el of document.querySelectorAll("[data-sp-clock]")) {
    const t = SP().elapsedTime(el.dataset.spClock);
    el.textContent = [t.hours, t.minutes, t.seconds].map(n => String(n).padStart(2, "0")).join(":");
  }
}, 1000);

function spTestCard(options, date) {
  const s = spState(), C = SP();
  const chosen = C.selectedOption(options, date, "test", s.state);
  if (!chosen) return "";
  const readOnly = date > C.todayKey() || Boolean(chosen.historyOnly);
  const dates = C.measurementFields(s.state).flatMap(f => C.measurementHistory(s.state, f.id).map(r => r.recordedAt.slice(0, 10)));
  const last = dates.length ? dates.reduce((a, b) => (b > a ? b : a)) : null;
  const ago = last ? Math.round((Date.parse(`${C.todayKey()}T12:00:00Z`) - Date.parse(`${last}T12:00:00Z`)) / 86400000) : null;
  return `<section class="sp-card sp-test"><p class="sp-kicker">Контрольная точка</p><h2>${spEsc(chosen.plan.title)}</h2>${chosen.plan.focus ? `<p class="section-note">${spEsc(chosen.plan.focus)}</p>` : ""}
    <ol class="sp-steps-list">${chosen.plan.exercises.map(e => `<li><span>${spEsc(e.name)}</span><b>${spEsc(e.sets_reps)}</b></li>`).join("")}</ol>
    <button class="primary-button sp-wide" type="button" data-action="sp-tab" data-tab="goals" ${readOnly ? "disabled" : ""}>${readOnly ? "Тест по плану" : "Записать результаты"}</button>
    <div class="sp-test-measure"><span><strong>Обхваты и вес</strong><small>${ago === null ? "Ещё ни разу не записаны" : ago <= 0 ? "Записаны сегодня" : `Последний раз ${ago} ${spPlural(ago, "день", "дня", "дней")} назад`}</small></span><button class="ghost-button" type="button" data-action="sp-profile-section" data-section="body" ${readOnly ? "disabled" : ""}>Записать замеры</button></div></section>`;
}

// ------------------------------------------------------------ окна «Сегодня»

SP_SHEETS.habit = sheet => {
  const s = spState(), C = SP();
  const habit = sheet.id ? s.state.customHabits?.[sheet.id] : null;
  sheet.draft ||= { name: habit?.name || "", reminders: habit ? C.habitReminders(habit).map(r => r.time) : [], notify: habit ? C.habitNotifies(habit) : true };
  const d = sheet.draft;
  const archived = sheet.id ? [] : Object.entries(s.state.customHabits || {}).filter(([, h]) => h.archived);
  return { title: "Ежедневная привычка", body: `<form data-sp-form="habit"><label class="field">Название<input name="name" maxlength="60" required value="${spEsc(d.name)}" placeholder="Например, читать 20 минут"></label>
    <p class="sp-kicker">Напоминания</p>${d.reminders.length ? "" : `<p class="section-note">Без напоминаний. Можно добавить, например, утро и вечер.</p>`}
    ${d.reminders.map((time, i) => `<div class="sp-reminder"><input type="time" name="r${i}" value="${spEsc(time)}" required aria-label="Напоминание ${i + 1}"><button class="text-action danger" type="button" data-action="sp-habit-rem-del" data-i="${i}">Убрать</button></div>`).join("")}
    ${d.reminders.length < C.MAX_REMINDERS ? `<button class="text-action" type="button" data-action="sp-habit-rem-add">+ Добавить напоминание</button>` : ""}
    ${d.reminders.length ? `<label class="sp-switch"><span><strong>Напоминать в Telegram</strong><small>${d.notify ? "Придёт сообщение в каждое из времён выше" : `Сообщений не будет, но отметок за день по-прежнему ${d.reminders.length}`}</small></span><input type="checkbox" name="notify" ${d.notify ? "checked" : ""}></label>` : ""}
    <p class="section-note">Пояс: ${spEsc(C.notificationSettings(s.state.notificationSettings).timeZone)}. Каждое срабатывает раз в день, если привычка ещё не отмечена.</p>
    <div class="sheet-actions">${sheet.id ? `<button class="ghost-button" type="button" data-action="sp-archive" data-field="customHabits" data-id="${spEsc(sheet.id)}" data-value="1">В архив</button>` : ""}<button class="primary-button" type="submit">Сохранить</button></div></form>
    ${archived.length ? `<div class="sp-archive"><p class="sp-kicker">Архив</p>${archived.map(([id, h]) => `<div><span>${spEsc(h.name)}</span><button class="text-action" type="button" data-action="sp-archive" data-field="customHabits" data-id="${spEsc(id)}" data-value="0">Вернуть</button></div>`).join("")}</div>` : ""}` };
};
function spHabitDraftFromForm() {
  const form = document.querySelector('[data-sp-form="habit"]'), sheet = spState().sheet;
  if (!form || !sheet?.draft) return;
  sheet.draft.name = form.elements.name.value;
  sheet.draft.reminders = sheet.draft.reminders.map((_, i) => form.elements[`r${i}`]?.value || "");
  if (form.elements.notify) sheet.draft.notify = form.elements.notify.checked;
}
SP_ACTIONS["sp-habit-rem-add"] = () => { spHabitDraftFromForm(); const d = spState().sheet.draft; d.reminders.push(d.reminders.length ? "20:00" : "09:00"); render(); };
SP_ACTIONS["sp-habit-rem-del"] = control => { spHabitDraftFromForm(); spState().sheet.draft.reminders.splice(Number(control.dataset.i), 1); render(); };
SP_FORMS.habit = form => {
  const s = spState(), C = SP(), sheet = s.sheet;
  spHabitDraftFromForm();
  const d = sheet.draft, name = d.name.trim();
  if (!name) return spSheetError("Введите название.");
  if (d.reminders.some(t => !C.validReminderTime(t))) return spSheetError("Проверьте время напоминаний.");
  if (new Set(d.reminders).size !== d.reminders.length) return spSheetError("Два напоминания на одно время — уберите повтор.");
  const key = sheet.id || crypto.randomUUID();
  const taken = ["контрастный душ", "утренняя разминка"].includes(name.toLocaleLowerCase()) || Object.entries(s.state.customHabits || {}).some(([id, h]) => id !== key && h.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (taken) return spSheetError("Такая привычка уже есть, в том числе в архиве.");
  const reminders = [...d.reminders].sort().map(time => ({ time }));
  spUpdate(prev => {
    const { reminder: _old, notify: _quiet, ...rest } = prev.customHabits?.[key] || {};
    return { ...prev, customHabits: { ...prev.customHabits, [key]: { ...rest, name, createdOn: prev.customHabits?.[key]?.createdOn || C.todayKey(), reminders, ...(d.notify ? {} : { notify: false }) } } };
  }).catch(() => {});
  spClose();
};

SP_SHEETS.counter = sheet => {
  const s = spState(), C = SP();
  const counter = sheet.id ? s.state.counters?.[sheet.id] : null;
  const archived = sheet.id ? [] : Object.entries(s.state.counters || {}).filter(([, c]) => c.archived);
  return { title: "Счётчик времени", body: `<form data-sp-form="counter"><label class="field">Название<input name="name" maxlength="60" required value="${spEsc(counter?.name || "")}" placeholder="Например, не курю"></label>
    <label class="field">Дата и время начала<input type="datetime-local" name="date" required max="${C.localDateTimeValue()}" value="${C.localDateTimeValue(counter?.startedAt)}"></label>
    <div class="field-row"><label class="field">Цель, дней<input type="number" name="goal" min="1" max="3650" inputmode="numeric" placeholder="например, 30" value="${counter?.goalDays || ""}"></label><label class="field">Поздравлять каждые, дней<input type="number" name="every" min="1" max="3650" inputmode="numeric" placeholder="например, 100" value="${counter?.milestoneEvery || ""}"></label></div>
    <p class="section-note">Цель — полоса прогресса под счётчиком. Поздравление — сообщение в Telegram на каждой такой отметке текущей серии. Оба необязательны.</p>
    <div class="sheet-actions">${sheet.id ? `<button class="ghost-button" type="button" data-action="sp-archive" data-field="counters" data-id="${spEsc(sheet.id)}" data-value="1">В архив</button>` : ""}<button class="primary-button" type="submit">Сохранить</button></div></form>
    ${archived.length ? `<div class="sp-archive"><p class="sp-kicker">Архив</p>${archived.map(([id, c]) => `<div><span>${spEsc(c.name)}</span><button class="text-action" type="button" data-action="sp-archive" data-field="counters" data-id="${spEsc(id)}" data-value="0">Вернуть</button></div>`).join("")}</div>` : ""}` };
};
SP_FORMS.counter = form => {
  const s = spState(), sheet = s.sheet;
  const name = form.elements.name.value.trim();
  if (!name) return spSheetError("Введите название.");
  const start = new Date(form.elements.date.value).getTime();
  if (!Number.isFinite(start) || start > Date.now()) return spSheetError("Выберите дату и время в прошлом или сейчас.");
  const days = value => { if (!value.trim()) return null; const n = Number(value); return Number.isInteger(n) && n > 0 && n <= 3650 ? n : undefined; };
  const goalDays = days(form.elements.goal.value), milestoneEvery = days(form.elements.every.value);
  if (goalDays === undefined) return spSheetError("Цель — целое число дней от 1 до 3650.");
  if (milestoneEvery === undefined) return spSheetError("Шаг поздравлений — целое число дней от 1 до 3650.");
  const key = sheet.id || crypto.randomUUID();
  spUpdate(prev => ({ ...prev, counters: { ...prev.counters, [key]: { ...prev.counters?.[key], name, startedAt: new Date(start).toISOString(), goalDays: goalDays ?? undefined, milestoneEvery: milestoneEvery ?? undefined } } })).catch(() => {});
  spClose();
};
SP_SHEETS.relapse = sheet => {
  const counter = spState().state.counters?.[sheet.id];
  return counter && { title: "Отметить срыв?", body: `<p class="section-note">«${spEsc(counter.name)}»: сегодняшний день станет красным в ленте, а отсчёт начнётся заново. Рекорд и прошлые дни останутся в истории.</p><div class="sheet-actions"><button class="ghost-button" type="button" data-action="sp-close">Отмена</button><button class="primary-button danger-button" type="button" data-action="sp-relapse" data-id="${spEsc(sheet.id)}">Да, сорвался</button></div>` };
};

SP_SHEETS.wake = sheet => {
  const C = SP();
  const current = spState().state.wakeups?.[sheet.date];
  const now = C.currentTimeValue();
  return { title: sheet.date === C.todayKey() ? "Во сколько вы проснулись?" : `Подъём · ${spDateShort(sheet.date)}`, body: `<form data-sp-form="wake">${sheet.asked ? `<p class="section-note">Отмечается один раз в день. Спрашиваю при первом открытии после ${String(C.WAKE_PROMPT_HOUR).padStart(2, "0")}:00.</p>` : ""}<label class="field">Время подъёма<input type="time" name="time" required value="${spEsc(current || now)}"></label><div class="sheet-actions"><button class="ghost-button" type="button" data-action="sp-close">Не сейчас</button><button class="primary-button" type="submit">Сохранить</button></div></form>` };
};
SP_FORMS.wake = form => {
  const s = spState(), C = SP(), date = s.sheet.date, time = form.elements.time.value;
  if (C.minutesOf(time) === null) return spSheetError("Время в формате ЧЧ:ММ.");
  spUpdate(prev => ({ ...prev, wakeups: { ...prev.wakeups, [date]: time } })).catch(() => {});
  spClose();
};
SP_SHEETS["wake-log"] = () => {
  const C = SP();
  const rows = C.wakeSeries(spState().state, 30).slice().reverse().map(p => `<button type="button" class="sp-list-row ${p.time ? "" : "muted"}" data-action="sp-wake-edit" data-date="${p.date}"><span>${spDateShort(p.date)} <small>${C.weekdayLabel(p.date)}</small></span><b>${p.time || "—"}</b></button>`).join("");
  return { title: "Журнал подъёмов", body: `<p class="section-note">Нажмите на день, чтобы поставить или исправить время.</p><div class="sp-list">${rows}</div>` };
};

// ------------------------------------------------------------ плитка на «Плане»

/** Спорт на главном экране: тренировка дня и привычки — там, куда смотрят каждый день. */
function spHomeTile() {
  const s = spState();
  if (!SP()) return "";
  if (!s.state) { spLoad(); return ""; }
  const C = SP(), today = C.todayKey();
  const { visible } = spOptions();
  const workout = C.selectedOption(visible, today, "main", s.state);
  const habits = 1 + Object.values(s.state.customHabits || {}).filter(h => !h.archived && h.createdOn <= today).length;
  const marked = (s.state.showers?.[today] ? 1 : 0) + Object.entries(s.state.customHabits || {}).filter(([id, h]) => !h.archived && h.createdOn <= today && C.habitDone(s.state.habitChecks?.[id]?.[today], C.habitTarget(h)) >= C.habitTarget(h)).length;
  const pct = workout ? C.optionCompletion(workout, s.state) : null;
  const title = workout ? `${workout.plan.title}${pct === 100 ? " · готово" : pct ? ` · ${pct}%` : ""}` : visible.length ? "День отдыха" : "Добавьте программу";
  return `<section class="section"><button type="button" class="en-home ${pct === 100 ? "done" : ""}" data-action="sp-home"><span class="en-step-ic">${SP_ICON.dumbbell}</span><span class="en-home-text"><small>Спорт</small><b>${spEsc(title)}</b><span>Привычки ${marked} из ${habits}</span></span>${icon("arrow", "icon-sm")}</button></section>`;
}

// ------------------------------------------------------------ действия

Object.assign(SP_ACTIONS, {
  "sp-tab": control => { const s = spState(); s.tab = control.dataset.tab; s.sheet = null; render(); window.scrollTo({ top: 0 }); },
  "sp-home": () => { spState().tab = "today"; navigate("sport"); render(); },
  "sp-close": () => spClose(),
  "sp-date": control => { if (spTimerGuard()) return; const s = spState(); s.date = control.dataset.date; render(); },
  "sp-today": () => { if (spTimerGuard()) return; const s = spState(), C = SP(); s.date = C.todayKey(); s.weekStart = C.startOfWeekKey(s.date); render(); },
  "sp-weeks": control => { const s = spState(); s.weekStart = SP().offsetDateKey(s.weekStart, Number(control.dataset.d) * 7); render(); },
  "sp-toggle-open": control => { const s = spState(), key = control.dataset.key; s.open[key] = !s.open[key]; render(); },
  "sp-habit": control => {
    const s = spState(), C = SP(), id = control.dataset.id, date = s.date;
    if (id === "shower") spUpdate(prev => ({ ...prev, showers: { ...prev.showers, [date]: !prev.showers[date] } })).catch(() => {});
    else spUpdate(prev => ({ ...prev, habitChecks: { ...prev.habitChecks, [id]: { ...prev.habitChecks?.[id], [date]: C.nextHabitMark(prev.habitChecks?.[id]?.[date], C.habitTarget(prev.customHabits?.[id] || {})) } } })).catch(() => {});
  },
  "sp-warmup": () => { const date = spState().date; spUpdate(prev => ({ ...prev, warmups: { ...prev.warmups, [date]: !prev.warmups?.[date] } })).catch(() => {}); },
  "sp-habit-new": () => spOpen("habit"),
  "sp-habit-edit": control => spOpen("habit", { id: control.dataset.id }),
  "sp-counter-new": () => spOpen("counter"),
  "sp-counter-edit": control => spOpen("counter", { id: control.dataset.id }),
  "sp-relapse-ask": control => spOpen("relapse", { id: control.dataset.id }),
  "sp-relapse": control => {
    const id = control.dataset.id, C = SP();
    spUpdate(prev => prev.counters?.[id] ? { ...prev, counters: { ...prev.counters, [id]: C.withRelapse(prev.counters[id], C.todayKey()) } } : prev).catch(() => {});
    spClose();
  },
  "sp-archive": control => {
    const field = control.dataset.field, id = control.dataset.id, value = control.dataset.value === "1";
    spUpdate(prev => ({ ...prev, [field]: { ...prev[field], [id]: { ...prev[field]?.[id], archived: value } } })).catch(() => {});
    if (value) spClose(); else render();
  },
  "sp-wake-log": () => spOpen("wake-log"),
  "sp-wake-edit": control => spOpen("wake", { date: control.dataset.date }),
});

function sportAction(action, control, event) {
  if (!action.startsWith("sp-")) return false;
  if (action === "sp-backdrop") { if (event?.target === control) spClose(); return true; }
  const handler = SP_ACTIONS[action];
  if (!handler) return false;
  if (!SP()) { toast("Модуль спорта не загрузился"); return true; }
  handler(control, event);
  return true;
}
document.addEventListener("submit", event => {
  const form = event.target.closest?.("[data-sp-form]");
  if (!form) return;
  event.preventDefault(); event.stopImmediatePropagation();
  SP_FORMS[form.dataset.spForm]?.(form, event);
}, true);

// Свайп по календарю — неделя вперёд/назад, как в WooSport.
let spSwipe = null;
document.addEventListener("pointerdown", event => { if (event.target.closest?.("[data-sp-swipe]")) spSwipe = { x: event.clientX, y: event.clientY }; });
document.addEventListener("pointerup", event => {
  if (!spSwipe) return;
  const dx = event.clientX - spSwipe.x, dy = event.clientY - spSwipe.y;
  spSwipe = null;
  if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.35) {
    const s = spState(); s.weekStart = SP().offsetDateKey(s.weekStart, dx < 0 ? 7 : -7);
    spSwipeIgnore = Date.now();
    render();
  }
});
let spSwipeIgnore = 0;
document.addEventListener("click", event => { if (Date.now() - spSwipeIgnore < 250 && event.target.closest?.("[data-sp-swipe]")) { event.stopPropagation(); event.preventDefault(); } }, true);
// Лента дней открывается на сегодняшнем краю.
new MutationObserver(() => { for (const el of document.querySelectorAll("[data-sp-strip]:not([data-scrolled])")) { el.dataset.scrolled = "1"; el.scrollLeft = el.scrollWidth; } })
  .observe(document.documentElement, { childList: true, subtree: true });
