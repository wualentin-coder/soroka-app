/*
 * «Сон» — дневник ночей и план восстановления режима (КПТ-Б + сдвиг позднего ритма).
 *
 * Всё считает сервер (sleep-core.ts): фаза, подъём на сегодня, окно сна,
 * итоги недели. Здесь — только показать и записать: утром ночь отмечается за
 * минуту, а план на день — одна карточка: подъём со светом, кофе, тусклый
 * вечер, отбой не раньше. Без моста — демо-данные, чтобы экран рисовался отдельно.
 */

function slCall(op, args = {}) {
  if (typeof window.sorokaSleep === "function") return window.sorokaSleep(op, args);
  return new Promise(done => setTimeout(() => done(slDemo(op, args)), 250));
}
function slDemo(op, args) {
  const d = slState().demo ||= {
    today: "2026-10-28", phase: "shift", settings: { targetWake: "08:30", startedOn: "2026-10-21", wakeNow: 760, baseline: { wake: 790, tst: 400, se: 0.78, nights: 5 }, window: { minutes: 405, changedOn: "2026-10-26", log: [] }, reminders: true, isi: [{ on: "2026-10-21", score: 16, answers: [3, 2, 1, 3, 2, 2, 3] }] },
    plan: { phase: "shift", wake: "12:40", bed: "05:55", coffee: "23:55", dim: "03:55", windDown: "04:55", window: 405, restricted: true, target: "08:30", note: "" },
    week: { nights: 6, tst: 395, se: 81, sol: 48, waso: 22, wake: "12:55", wakeSpread: 41, bedSpread: 55, jetlag: 70, onPlan: { kept: 4, of: 6 }, quality: 2.8 },
    nights: [["2026-10-27", "05:10", "05:20", 55, 20, "12:50", "13:05", 2], ["2026-10-26", "04:40", "04:50", 40, 15, "12:40", "12:50", 3], ["2026-10-25", "06:00", "06:05", 70, 30, "14:20", "14:40", 2], ["2026-10-24", "05:00", "05:10", 35, 10, "13:00", "13:10", 3], ["2026-10-23", "04:30", "04:40", 45, 25, "12:45", "12:55", 3]]
      .map(([day, bed, lights, sol, waso, wake, rise, quality]) => { const n = { day, bed, lights, sol, wakes: waso ? 1 : 0, waso, wake, rise, quality, tags: day === "2026-10-25" ? ["coffee_late"] : [] }; return { ...n, metrics: slDemoMetrics(n) }; }),
    sinceStart: 7, lastNight: null,
    isiQuestions: ["Трудно заснуть", "Трудно сохранять сон (просыпаюсь ночью)", "Просыпаюсь слишком рано", "Насколько доволен своим сном сейчас", "Насколько проблемы со сном заметны другим", "Насколько беспокоят проблемы со сном", "Насколько мешают днём (усталость, внимание, настроение)"],
  };
  if (op === "setup") { d.settings.targetWake = args.targetWake; d.plan.target = args.targetWake; }
  if (op === "night") { const n = { ...args, metrics: slDemoMetrics(args) }; d.nights = [n, ...d.nights.filter(x => x.day !== n.day)]; if (n.day === d.today) d.lastNight = n; }
  if (op === "delete") { d.nights = d.nights.filter(x => x.day !== args.day); if (args.day === d.today) d.lastNight = null; }
  if (op === "isi") d.settings.isi = [...d.settings.isi, { on: d.today, score: args.answers.reduce((a, b) => a + b, 0), answers: args.answers }];
  if (op === "reminders") d.settings.reminders = args.on !== false;
  if (op === "debrief") return { text: "Подъём сдвинулся на 30 минут раньше, 4 из 6 дней по плану — хорошее начало. Засыпание всё ещё долгое, 48 минут: ложитесь только когда клонит в сон, а если не спится больше 20 минут — вставайте. В субботу кофе после 18:00 — в ту ночь засыпали 70 минут. Главное на неделю: тот же подъём в 12:40 все 7 дней, и в выходные тоже." };
  return JSON.parse(JSON.stringify(d));
}
function slDemoMetrics(n) {
  const m = t => { const [h, mm] = String(t).split(":").map(Number); return h * 60 + mm; };
  const wake = m(n.wake), b = x => (x > wake + 60 ? x - 1440 : x);
  const bed = b(m(n.bed)), lights = b(m(n.lights)), rise = m(n.rise);
  const tib = rise - bed, tst = Math.max(0, wake - lights - n.sol - n.waso);
  return { tib, tst, se: tst / tib, sol: n.sol, waso: n.waso, wake, bed, mid: (lights + n.sol + wake) / 2 };
}

function slState() { ui.sl ||= { data: null, loading: false, sheet: null, error: "", debrief: null, open: {} }; return ui.sl; }
function slLoad() {
  const s = slState();
  if (s.loading) return;
  s.loading = true;
  slCall("load").then(d => { if (d?.error) throw new Error(d.error); s.data = d; s.error = ""; })
    .catch(e => { s.error = String(e?.message || "Не получилось загрузить"); })
    .finally(() => { s.loading = false; if (ui.page === "sleep" || ui.page === "today") render(); });
}
async function slDo(op, args, done) {
  const s = slState();
  try {
    const d = await slCall(op, args);
    if (d?.error) throw new Error(d.error);
    s.data = d; s.sheet = null; s.sheetError = "";
    done?.();
  } catch (e) { s.sheetError = String(e?.message || "Не сохранилось — проверьте связь"); }
  render();
}

const slEsc = v => (typeof esc === "function" ? esc(v) : String(v ?? ""));
const slDur = m => { if (m == null || Number.isNaN(m)) return "—"; const h = Math.floor(m / 60), mm = Math.round(m % 60); return h ? `${h} ч${mm ? ` ${String(mm).padStart(2, "0")} мин` : ""}` : `${mm} мин`; };
const slHm = m => { const v = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`; };
const slDate = d => new Date(`${d}T12:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
const slWeekday = d => new Date(`${d}T12:00:00Z`).toLocaleDateString("ru-RU", { weekday: "short", timeZone: "UTC" });
const SL_TAGS = [["coffee_late", "Кофе после обеда"], ["alcohol", "Алкоголь"], ["late_workout", "Поздняя тренировка"], ["nap", "Спал днём"], ["screen_bed", "Телефон в кровати"], ["stress", "Стресс, мысли"]];

// ------------------------------------------------------------ страница

function renderSleepPage() {
  const s = slState();
  const head = `${header("Сон", "", "")}<div class="sl-page">`;
  if (!s.data) { if (!s.loading && !s.error) slLoad(); return `${head}${s.error ? `<p class="section-note">${slEsc(s.error)}</p><button class="ghost-button" type="button" data-action="sl-reload">Повторить</button>` : `<div class="en-wait"><span class="live-spin"></span></div>`}</div>${slSheetHtml()}`; }
  const d = s.data;
  if (d.phase === "setup") return `${head}${slSetupCard(d)}</div>${slSheetHtml()}`;
  return `${head}${slHero(d)}${slNightCard(d)}${slPlanCard(d)}${slWeekCard(d)}${slIsiCard(d)}${slHowCard(d)}${slHistoryCard(d)}${slSettingsCard(d)}</div>${slSheetHtml()}`;
}

function slSetupCard(d, editing = false) {
  const s = d.settings || {}, screen = s.screen || {};
  const picks = ["07:00", "07:30", "08:00", "08:30", "09:00", "10:00"];
  return `<form class="sl-card sl-setup" data-sl-form="setup">
    ${editing ? "" : `<p class="sl-kicker">Восстановление режима сна</p><h2>Во сколько вы хотите вставать?</h2><p class="section-note">Подъём — главный рычаг: одно время каждый день, и ритм постепенно сдвигается. Будем двигать подъём на 20 минут раньше раз в 3 дня — резкий сдвиг почти всегда срывается.</p>`}
    <label class="field">Целевой подъём<input type="time" name="target" value="${slEsc(s.targetWake || "08:30")}" required></label>
    <div class="sl-chips">${picks.map(t => `<button type="button" class="sl-chip" data-action="sl-pick" data-time="${t}">${t}</button>`).join("")}</div>
    <p class="sl-kicker">Важно для безопасности</p>
    <label class="sl-check"><input type="checkbox" name="snore" ${screen.snore ? "checked" : ""}><span>Громкий храп или остановки дыхания во сне</span></label>
    <label class="sl-check"><input type="checkbox" name="sleepy" ${screen.sleepy ? "checked" : ""}><span>Засыпаю днём против воли, за рулём</span></label>
    <label class="sl-check"><input type="checkbox" name="condition" ${screen.condition ? "checked" : ""}><span>Эпилепсия, биполярное расстройство или беременность</span></label>
    <p class="section-note">Если что-то отмечено — сокращать время в постели не будем (только сдвиг подъёма и свет). Храп с остановками дыхания и сонливость днём — повод показаться врачу.</p>
    ${editing ? "" : `<label class="sl-check"><input type="checkbox" name="skip"><span>Начать сразу, без недели замера</span></label>`}
    <button class="primary-button sl-wide" type="submit">${editing ? "Сохранить" : "Начать"}</button>
    ${editing ? "" : `<p class="section-note">Первые 5 ночей — замер: живите как обычно и отмечайте ночь утром. План встанет под ваш настоящий сон.</p>`}
  </form>`;
}

function slHero(d) {
  const s = d.settings, p = d.plan || {};
  let title, sub, pct = 0;
  if (d.phase === "baseline") { title = "Неделя замера"; sub = `Отмечено ${Math.min(d.sinceStart, 5)} из 5 ночей. Пока живите как обычно — план встанет под ваш сон.`; pct = Math.min(1, d.sinceStart / 5); }
  else if (d.phase === "hold") { title = "Закрепление"; sub = `Цель ${slEsc(s.targetWake)} достигнута. Держим подъём каждый день, и в выходные тоже.`; pct = 1; }
  else {
    const from = s.baseline?.wake ?? s.wakeNow, to = (t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; })(s.targetWake);
    pct = from > to ? Math.max(0, Math.min(1, (from - s.wakeNow) / (from - to))) : 0;
    const left = Math.ceil(Math.max(0, s.wakeNow - to) / (s.stepMinutes || 20)) * (s.everyDays || 3);
    title = `Подъём ${slEsc(p.wake)} → ${slEsc(s.targetWake)}`;
    sub = `Шаг — на ${s.stepMinutes || 20} мин раньше раз в ${s.everyDays || 3} дня, если подъём держится. До цели ≈ ${Math.max(1, Math.round(left / 7))} нед.`;
  }
  return `<section class="sl-card sl-hero"><p class="sl-kicker">${d.phase === "baseline" ? "Этап 1 · замер" : d.phase === "hold" ? "Этап 3" : "Этап 2 · сдвиг ритма"}</p><h2>${title}</h2><p class="section-note">${sub}</p><span class="sl-bar"><i style="width:${Math.round(pct * 100)}%"></i></span></section>`;
}

function slTimeline(n) {
  const m = n.metrics;
  if (!m) return "";
  // Ось — от 18:00 вчера до 18:00 сегодня: поздний сон тоже помещается.
  const x = v => Math.max(0, Math.min(100, ((v + 360) / 1440) * 100));
  const sleepFrom = m.wake - m.tst - m.waso;
  return `<div class="sl-tl" aria-hidden="true"><i class="bed" style="left:${x(m.bed)}%;width:${x(m.bed + m.tib) - x(m.bed)}%"></i><i class="sleep" style="left:${x(sleepFrom)}%;width:${x(m.wake) - x(sleepFrom)}%"></i><span style="left:0">18</span><span style="left:25%">00</span><span style="left:50%">06</span><span style="left:75%">12</span></div>`;
}

function slNightCard(d) {
  const n = d.lastNight;
  if (!n) {
    return `<section class="sl-card sl-night empty"><div class="sl-row"><div><p class="sl-kicker">Эта ночь</p><h3>Ещё не отмечена</h3><small class="section-note">Минута: во сколько легли, сколько засыпали, когда встали.</small></div><span class="sl-ic">${icon("moon", "icon-sm")}</span></div><button class="primary-button sl-wide" type="button" data-action="sl-night">Отметить ночь</button></section>`;
  }
  const m = n.metrics || {};
  return `<section class="sl-card sl-night"><div class="sl-row"><p class="sl-kicker">Ночь на ${slDate(n.day)}</p><button class="text-action" type="button" data-action="sl-night" data-day="${slEsc(n.day)}">Изменить</button></div>
    <div class="sl-stats"><div><small>Спали</small><b>${slDur(m.tst)}</b></div><div><small>Эффективность</small><b>${Math.round((m.se || 0) * 100)}%</b></div><div><small>Засыпали</small><b>${slDur(n.sol)}</b></div><div><small>Качество</small><b>${n.quality}/5</b></div></div>
    ${slTimeline(n)}<small class="section-note">Легли ${slEsc(n.bed)} · уснули ≈ ${slHm(toMinLocal(n.lights) + n.sol)} · проснулись ${slEsc(n.wake)}${n.wakes ? ` · просыпались ${n.wakes} раз` : ""}</small></section>`;
}
const toMinLocal = t => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };

function slPlanCard(d) {
  const p = d.plan;
  if (!p) return "";
  if (d.phase === "baseline") {
    return `<section class="sl-card"><p class="sl-kicker">Сегодня</p><p>${slEsc(p.note)}</p>${slRuleList(false)}</section>`;
  }
  const row = (ic, title, sub) => `<div class="sl-plan-row"><span class="sl-ic">${icon(ic, "icon-sm")}</span><div><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</div></div>`;
  return `<section class="sl-card"><p class="sl-kicker">План на сегодня</p>
    ${row("sun", `Встать в ${slEsc(p.wake)}`, "Даже после плохой ночи. Сразу на свет 20–30 минут — к окну или на улицу")}
    ${row("coffee", `Кофе и крепкий чай — до ${slEsc(p.coffee)}`, "За 6 часов до сна кофеин ещё сокращает сон")}
    ${row("moon", `С ${slEsc(p.dim)} — тусклый свет`, "Вечерний яркий свет и экран отодвигают сон позже")}
    ${row("clock", `В кровать — не раньше ${slEsc(p.bed)}`, p.restricted ? `Окно сна ${slDur(p.window)}: так сон становится крепче и засыпание быстрее. Меняется раз в неделю по эффективности` : "И только когда клонит в сон")}
    ${p.note ? `<p class="section-note">${slEsc(p.note)}</p>` : ""}${slRuleList(true)}</section>`;
}
function slRuleList(compact) {
  const rules = [
    "Ложитесь, только когда клонит в сон, — не «потому что пора».",
    "Не спится дольше ~20 минут — встаньте, займитесь спокойным в тусклом свете, вернитесь, когда клонит.",
    "Кровать — только для сна: без телефона, сериалов и работы.",
    "Днём не спите, или не дольше 20 минут и до 15:00.",
  ];
  return `<details class="sl-rules" ${compact ? "" : "open"}><summary>Правила ночи</summary><ul>${rules.map(r => `<li>${r}</li>`).join("")}</ul></details>`;
}

function slWeekCard(d) {
  const w = d.week, s = slState();
  if (!w) return `<section class="sl-card"><p class="sl-kicker">Неделя</p><p class="section-note">Итоги появятся после первых отмеченных ночей.</p></section>`;
  const nights = (d.nights || []).slice(0, 14).reverse();
  const max = Math.max(540, ...nights.map(n => n.metrics?.tst || 0));
  const bars = nights.map(n => `<span class="sl-col" title="${slDate(n.day)} · ${slDur(n.metrics?.tst)}"><i style="height:${Math.round(((n.metrics?.tst || 0) / max) * 100)}%" class="${(n.metrics?.se || 0) >= 0.85 ? "good" : ""}"></i><small>${slWeekday(n.day).slice(0, 2)}</small></span>`).join("");
  return `<section class="sl-card"><div class="sl-row"><p class="sl-kicker">Последние 7 дней</p><small class="section-note">${w.nights} ${w.nights === 1 ? "ночь" : w.nights < 5 ? "ночи" : "ночей"}</small></div>
    <div class="sl-stats"><div><small>Сон в среднем</small><b>${slDur(w.tst)}</b></div><div><small>Эффективность</small><b>${w.se}%</b></div><div><small>Засыпание</small><b>${slDur(w.sol)}</b></div><div><small>Разброс подъёма</small><b>${w.wakeSpread == null ? "—" : `±${w.wakeSpread} мин`}</b></div></div>
    ${w.onPlan ? `<p class="section-note">Подъём по плану: ${w.onPlan.kept} из ${w.onPlan.of}${w.jetlag != null && Math.abs(w.jetlag) >= 45 ? ` · в выходные середина сна сдвигается на ${slDur(Math.abs(w.jetlag))} — это откатывает ритм` : ""}</p>` : ""}
    ${nights.length ? `<div class="sl-chart">${bars}</div><small class="section-note">Столбик — сон за ночь; зелёный — эффективность от 85%.</small>` : ""}
    ${s.debrief ? `<div class="sl-debrief">${s.debrief.loading ? `<span class="live-spin"></span>` : slEsc(s.debrief.text)}</div>` : `<button class="ghost-button sl-wide" type="button" data-action="sl-debrief">Разбор недели</button>`}</section>`;
}

function slIsiCard(d) {
  const list = d.settings.isi || [], last = list[list.length - 1];
  const level = sc => (sc <= 7 ? "нет бессонницы" : sc <= 14 ? "лёгкая" : sc <= 21 ? "умеренная" : "тяжёлая");
  const due = !last || (Date.parse(d.today) - Date.parse(last.on)) / 86_400_000 >= 14;
  return `<section class="sl-card"><div class="sl-row"><div><p class="sl-kicker">Тяжесть бессонницы</p>${last ? `<h3>${last.score} из 28 · ${level(last.score)}</h3><small class="section-note">${slDate(last.on)}${list.length > 1 ? ` · было ${list[list.length - 2].score}` : ""}</small>` : `<h3>Анкета не пройдена</h3><small class="section-note">7 вопросов, минута — точка отсчёта, чтобы видеть прогресс.</small>`}</div>
    <button class="${due ? "primary-button" : "ghost-button"}" type="button" data-action="sl-isi">${last ? "Ещё раз" : "Пройти"}</button></div>${due && last ? `<small class="section-note">Прошло 2 недели — пора пройти снова.</small>` : ""}</section>`;
}

function slHowCard(d) {
  return `<details class="sl-card sl-how"><summary><b>Как это работает</b><small>и на чём основано</small></summary>
    <p>Это программа когнитивно-поведенческой терапии бессонницы (КПТ-Б) — лучшее доказанное средство: единственная сильная рекомендация Американской академии медицины сна. Цифровая версия работает без терапевта, эффект держится до года.</p>
    <p><b>Подъём</b> в одно время каждый день — якорь ритма. Утренний свет сдвигает сон раньше, вечерний — позже.</p>
    <p><b>Окно сна.</b> Время в постели — по вашему реальному сну, не меньше 5,5 ч. Первые 1–2 недели днём может клонить в сон — это нормально и проходит; за руль сонным не садитесь. Раз в неделю: эффективность от 90% — окно +15 мин, ниже 85% — −15 мин.</p>
    <p><b>Регулярность</b> важнее длительности: в исследовании 60 тысяч человек нерегулярный сон сильнее связан со здоровьем, чем короткий.</p>
    <p class="section-note">Не медицинский прибор. Мелатонин и снотворные — только после разговора с врачом.</p></details>`;
}

function slHistoryCard(d) {
  const s = slState(), list = d.nights || [];
  if (!list.length) return "";
  const shown = s.open.history ? list : list.slice(0, 5);
  return `<section class="sl-card"><div class="sl-row"><p class="sl-kicker">Ночи</p><button class="text-action" type="button" data-action="sl-night" data-day="">+ ночь</button></div>
    ${shown.map(n => `<button type="button" class="sl-list-row" data-action="sl-night" data-day="${slEsc(n.day)}"><span><b>${slWeekday(n.day)}, ${slDate(n.day)}</b><small>${slEsc(n.bed)} → ${slEsc(n.wake)} · засыпали ${slDur(n.sol)}${n.source === "device" ? " · с часов" : ""}</small></span><span class="sl-list-val">${slDur(n.metrics?.tst)}<small>${Math.round((n.metrics?.se || 0) * 100)}%</small></span></button>`).join("")}
    ${list.length > 5 ? `<button class="text-action" type="button" data-action="sl-history">${s.open.history ? "Свернуть" : `Все ${list.length}`}</button>` : ""}</section>`;
}

function slSettingsCard(d) {
  const s = d.settings;
  return `<section class="sl-card"><p class="sl-kicker">Настройки</p>
    <button type="button" class="sl-list-row" data-action="sl-edit-target"><span><b>Цель подъёма</b><small>${slEsc(s.targetWake)} · можно поменять, шаги сохранятся</small></span>${icon("right", "icon-sm")}</button>
    <label class="sl-list-row sl-toggle-row"><span><b>Напоминания ботом</b><small>подъём со светом, «как спалось?», за час до отбоя</small></span><input type="checkbox" data-sl-reminders ${s.reminders !== false ? "checked" : ""}></label>
    <button type="button" class="sl-list-row" data-action="sl-restart"><span><b>Начать заново</b><small>новая неделя замера; ночи и анкеты останутся</small></span>${icon("reset", "icon-sm")}</button>
    <p class="section-note">Часы или браслет: когда появятся, ночи будут подтягиваться сами через Health Connect — отметки дневника важнее и не затираются.</p></section>`;
}

// ------------------------------------------------------------ окна

function slSheetHtml() {
  const s = slState();
  if (!s.sheet) return "";
  const view = s.sheet.kind === "night" ? slNightSheet(s.sheet) : s.sheet.kind === "isi" ? slIsiSheet() : s.sheet.kind === "target" ? { title: "Цель подъёма", body: slSetupCard(s.data, true) } : null;
  if (!view) return "";
  return `<div class="modal-backdrop sl-backdrop" data-action="sl-backdrop"><section class="sheet sl-sheet" role="dialog" aria-modal="true" aria-label="${slEsc(view.title)}"><div class="sheet-handle"></div><div class="sheet-head"><h2>${slEsc(view.title)}</h2><button class="icon-button" type="button" data-action="sl-close" aria-label="Закрыть">${icon("close")}</button></div>${view.body}${s.sheetError ? `<p class="sl-error" role="alert">${slEsc(s.sheetError)}</p>` : ""}</section></div>`;
}

function slNightSheet(sheet) {
  const d = slState().data, today = d.today;
  const day = sheet.day || today;
  const have = (d.nights || []).find(n => n.day === day);
  const prev = (d.nights || [])[0];
  const p = d.plan || {};
  const v = have || { bed: prev?.bed || p.bed || "00:00", lights: prev?.lights || p.bed || "00:15", sol: 30, wakes: 0, waso: 0, wake: p.wake || prev?.wake || "08:00", rise: p.wake || prev?.rise || "08:10", quality: 3, tags: [] };
  const stepper = (name, value, label, unit, step) => `<div class="sl-field"><span>${label}</span><div class="sp-stepper"><button type="button" data-action="sl-step" data-name="${name}" data-d="-${step}" aria-label="Меньше">−</button><input type="number" name="${name}" min="0" max="900" inputmode="numeric" value="${value}"><span>${unit}</span><button type="button" data-action="sl-step" data-name="${name}" data-d="${step}" aria-label="Больше">+</button></div></div>`;
  const time = (name, value, label) => `<label class="sl-field"><span>${label}</span><input type="time" name="${name}" value="${slEsc(value)}" required></label>`;
  return { title: day === today ? "Как спалось" : `Ночь на ${slDate(day)}`, body: `<form class="sl-form" data-sl-form="night">
    <label class="sl-field"><span>Ночь на (дата утра)</span><input type="date" name="day" value="${slEsc(day)}" max="${slEsc(today)}" required></label>
    <div class="sl-pair">${time("bed", v.bed, "Лёг в кровать")}${time("lights", v.lights, "Начал засыпать")}</div>
    ${stepper("sol", v.sol, "Сколько засыпал", "мин", 5)}
    <div class="sl-pair">${stepper("wakes", v.wakes, "Просыпался", "раз", 1)}${stepper("waso", v.waso, "Не спал ночью", "мин", 5)}</div>
    <div class="sl-pair">${time("wake", v.wake, "Проснулся")}${time("rise", v.rise, "Встал")}</div>
    <div class="sl-field"><span>Как выспался</span><div class="sl-quality">${[1, 2, 3, 4, 5].map(q => `<label><input type="radio" name="quality" value="${q}" ${Number(v.quality) === q ? "checked" : ""}><span>${q}</span></label>`).join("")}</div></div>
    <div class="sl-field"><span>Что было вчера</span><div class="sl-tags">${SL_TAGS.map(([k, l]) => `<label><input type="checkbox" name="tag" value="${k}" ${(v.tags || []).includes(k) ? "checked" : ""}><span>${l}</span></label>`).join("")}</div></div>
    <button class="primary-button sl-wide" type="submit">Сохранить</button>
    ${have ? `<button class="text-action danger" type="button" data-action="sl-night-delete" data-day="${slEsc(day)}">Удалить ночь</button>` : ""}
    <small class="section-note">Примерно, по ощущению — часы не нужны. Время «не спал ночью» — всего за ночь.</small></form>` };
}

function slIsiSheet() {
  const qs = slState().data.isiQuestions || [];
  const scale = i => i < 3 ? ["нет", "слабо", "умеренно", "сильно", "очень сильно"] : i === 3 ? ["очень доволен", "доволен", "так себе", "недоволен", "очень недоволен"] : ["совсем нет", "немного", "заметно", "сильно", "очень сильно"];
  return { title: "Тяжесть бессонницы", body: `<form class="sl-form" data-sl-form="isi"><p class="section-note">За последние 2 недели. Индекс тяжести бессонницы (ISI) — стандартная анкета.</p>
    ${qs.map((q, i) => `<fieldset class="sl-isi"><legend>${i + 1}. ${slEsc(q)}</legend><div>${scale(i).map((l, k) => `<label><input type="radio" name="q${i}" value="${k}" required><span>${l}</span></label>`).join("")}</div></fieldset>`).join("")}
    <button class="primary-button sl-wide" type="submit">Посчитать</button></form>` };
}

// ------------------------------------------------------------ действия

function sleepAction(action, control, event) {
  if (!action.startsWith("sl-")) return false;
  const s = slState();
  if (action === "sl-backdrop") { if (event?.target === control && confirmSheetDiscard(document.querySelector(".sl-sheet"))) { s.sheet = null; render(); } return true; }
  if (action === "sl-close") { if (!confirmSheetDiscard(document.querySelector(".sl-sheet"))) return true; s.sheet = null; s.sheetError = ""; render(); return true; }
  if (action === "sl-reload") { s.error = ""; slLoad(); render(); return true; }
  if (action === "sl-home") { navigate("sleep"); render(); return true; }
  if (action === "sl-pick") { const input = control.closest("form")?.querySelector('[name="target"]'); if (input) input.value = control.dataset.time; return true; }
  if (action === "sl-night") { s.sheet = { kind: "night", day: control.dataset.day || "" }; s.sheetError = ""; render(); return true; }
  if (action === "sl-night-delete") { if (window.confirm("Удалить эту ночь из дневника?")) slDo("delete", { day: control.dataset.day }); return true; }
  if (action === "sl-step") { const input = control.closest("form").querySelector(`[name="${control.dataset.name}"]`); input.value = Math.max(0, Math.min(900, (Number(input.value) || 0) + Number(control.dataset.d))); return true; }
  if (action === "sl-isi") { s.sheet = { kind: "isi" }; s.sheetError = ""; render(); return true; }
  if (action === "sl-edit-target") { s.sheet = { kind: "target" }; s.sheetError = ""; render(); return true; }
  if (action === "sl-history") { s.open.history = !s.open.history; render(); return true; }
  if (action === "sl-restart") { if (window.confirm("Начать заново с недели замера? Ночи и анкеты останутся.")) slDo("restart", {}); return true; }
  if (action === "sl-debrief") {
    s.debrief = { loading: true }; render();
    slCall("debrief").then(r => { s.debrief = { text: r?.text || "Не получилось подготовить разбор." }; }).catch(() => { s.debrief = { text: "Не получилось подготовить разбор — проверьте связь." }; }).finally(render);
    return true;
  }
  return false;
}

document.addEventListener("submit", event => {
  const form = event.target.closest?.("[data-sl-form]");
  if (!form) return;
  event.preventDefault();
  const kind = form.dataset.slForm, f = form.elements;
  if (kind === "setup") {
    slDo("setup", { targetWake: f.target.value, snore: f.snore.checked, sleepy: f.sleepy.checked, condition: f.condition.checked, skipBaseline: Boolean(f.skip?.checked) });
  } else if (kind === "night") {
    slDo("night", { day: f.day.value, bed: f.bed.value, lights: f.lights.value, sol: Number(f.sol.value), wakes: Number(f.wakes.value), waso: Number(f.waso.value), wake: f.wake.value, rise: f.rise.value, quality: Number(form.querySelector('[name="quality"]:checked')?.value || 3), tags: [...form.querySelectorAll('[name="tag"]:checked')].map(x => x.value) },
      () => typeof toast === "function" && toast("Ночь записана"));
  } else if (kind === "isi") {
    const answers = Array.from({ length: 7 }, (_, i) => Number(form.querySelector(`[name="q${i}"]:checked`)?.value));
    if (answers.some(Number.isNaN)) { slState().sheetError = "Ответьте на все 7 вопросов."; render(); return; }
    slDo("isi", { answers });
  }
}, true);
document.addEventListener("change", event => {
  if (!event.target.matches?.("[data-sl-reminders]")) return;
  slDo("reminders", { on: event.target.checked }, () => typeof toast === "function" && toast(event.target.checked ? "Напоминания включены" : "Напоминания выключены"));
});

/** Плитка на «Плане»: подъём на сегодня и отмечена ли ночь. */
function slHomeTile() {
  const s = slState();
  if (!s.data) { if (!s.loading && !s.error) slLoad(); return ""; }
  const d = s.data;
  if (d.phase === "setup") return "";
  const p = d.plan || {};
  const title = d.phase === "baseline" ? `Неделя замера · ${Math.min(d.sinceStart, 5)} из 5 ночей` : `Встать в ${p.wake} · в кровать не раньше ${p.bed}`;
  const sub = d.lastNight ? `Ночь: ${slDur(d.lastNight.metrics?.tst)} · засыпали ${slDur(d.lastNight.sol)}` : "Ночь ещё не отмечена";
  return `<section class="section"><button type="button" class="en-home ${d.lastNight ? "done" : ""}" data-action="sl-home"><span class="en-step-ic">${icon("moon", "icon-sm")}</span><span class="en-home-text"><small>Сон</small><b>${slEsc(title)}</b><span>${slEsc(sub)}</span></span>${icon("arrow", "icon-sm")}</button></section>`;
}
