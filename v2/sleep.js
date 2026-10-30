/*
 * «Сон» — дневник ночей и осторожный ориентир режима, без автоматического ограничения сна.
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
    plan: { phase: "shift", wake: "12:40", bed: null, coffee: null, dim: null, windDown: null, window: null, restricted: false, target: "08:30", note: "" },
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
  if(n.detail === "quick") return null;
  const m = t => { const [h, mm] = String(t).split(":").map(Number); return h * 60 + mm; };
  const wake = m(n.wake), b = x => (x > wake + 60 ? x - 1440 : x);
  const bed = b(m(n.bed)), lights = b(m(n.lights)), rise = m(n.rise);
  const tib = rise - bed, tst = Math.max(0, wake - lights - n.sol - n.waso);
  return { tib, tst, se: tst / tib, sol: n.sol, waso: n.waso, wake, bed, mid: (lights + n.sol + wake) / 2 };
}

function slState() { ui.sl ||= { data: null, loading: false, sheet: null, error: "", debrief: null, open: {}, tab: "today", pending: false, revision: 0, at: 0 }; return ui.sl; }
function slLoad() {
  const s = slState();
  if (s.loading) return;
  s.loading = true;
  const revision = s.revision || 0;
  slCall("load").then(d => { if (d?.error) throw new Error(d.error); if ((s.revision || 0) !== revision) return; s.data = d; s.at = Date.now(); s.error = ""; })
    .catch(e => { s.error = String(e?.message || "Не получилось загрузить"); })
    .finally(() => { s.loading = false; if (ui.page === "sleep" || ui.page === "today") render(); });
}
async function slDo(op, args, done) {
  const s=slState(); if(s.pending)return;
  if(op==="setup")s.setupDraft={...args};
  s.pending=true;s.sheetError="";s.revision=(s.revision||0)+1;render();
  try {
    const d=await slCall(op,args);if(d?.error)throw new Error(d.error);
    s.revision++;s.data=d;s.at=Date.now();s.sheet=null;s.sheetError="";if(op==="setup")s.setupDraft=null;done?.();
  } catch(e) {s.sheetError=String(e?.message || "Не сохранилось — проверьте связь и повторите. Поля оставлены в окне.");}
  finally{s.pending=false;render();}
}

const slEsc = v => (typeof esc === "function" ? esc(v) : String(v ?? ""));
const slDur = m => { if (m == null || Number.isNaN(m)) return "—"; const h = Math.floor(m / 60), mm = Math.round(m % 60); return h ? `${h} ч${mm ? ` ${String(mm).padStart(2, "0")} мин` : ""}` : `${mm} мин`; };
const slHm = m => { const v = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`; };
const slDate = d => new Date(`${d}T12:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
const slWeekday = d => new Date(`${d}T12:00:00Z`).toLocaleDateString("ru-RU", { weekday: "short", timeZone: "UTC" });
const SL_TAGS = [["coffee_late", "Кофе после обеда"], ["alcohol", "Алкоголь"], ["late_workout", "Поздняя тренировка"], ["nap", "Спал днём"], ["screen_bed", "Телефон в кровати"], ["stress", "Стресс, мысли"]];

// ------------------------------------------------------------ страница

function renderSleepPage() {
  const s=slState(),head=`${header("Сон","","")}<div class="sl-page">`;
  if(!s.data){if(!s.loading&&!s.error)slLoad();return `${head}${s.error?`<p class="sl-error" role="alert">${slEsc(s.error)}</p><button class="ghost-button" data-action="sl-reload">Повторить</button>`:`<div class="en-wait"><span class="live-spin"></span></div>`}</div>${slSheetHtml()}`;}
  if(!s.error&&!s.pending&&!s.loading&&Date.now()-(s.at||0)>60000)slLoad();
  const d=s.data;
  if(d.phase==="setup")return `${head}${s.sheetError?`<p class="sl-error" role="alert">${slEsc(s.sheetError)}</p>`:""}${s.pending?`<fieldset class="sl-saving" disabled>${slSetupCard(d)}</fieldset>`:slSetupCard(d)}</div>${slSheetHtml()}`;
  const tabs=`<div class="sl-tabs" role="tablist" aria-label="Разделы сна">${[["today","Сегодня"],["progress","Прогресс"],["more","Ещё"]].map(([key,label])=>`<button type="button" role="tab" aria-selected="${(s.tab||"today")===key}" class="${(s.tab||"today")===key?"active":""}" data-action="sl-tab" data-tab="${key}">${label}</button>`).join("")}</div>`;
  const body=s.tab==="progress"?`${slWeekCard(d)}${slIsiCard(d)}${slHistoryCard(d)}`:s.tab==="more"?`${slSettingsCard(d)}${slHowCard(d)}`:`${slNightCard(d)}${slPlanCard(d)}${slWeekCard(d,true)}`;
  const error=s.error||(!s.sheet?s.sheetError:"");
  return `${head}${tabs}${error?`<p class="sl-error" role="alert">${slEsc(error)}</p><button class="text-action" data-action="sl-reload">Обновить</button>`:""}${body}</div>${slSheetHtml()}`;
}

function slSetupCard(d, editing = false) {
  const draft=slState().setupDraft;
  const s = {...(d.settings || {}),...(draft || {})}, screen = draft ? {snore:draft.snore,sleepy:draft.sleepy,condition:draft.condition} : s.screen || {};
  const picks = ["07:00", "07:30", "08:00", "08:30", "09:00", "10:00"];
  return `<form class="sl-card sl-setup" data-sl-form="setup">
    ${editing ? "" : `<p class="sl-kicker">Восстановление режима сна</p><h2>Во сколько вы хотите вставать?</h2><p class="section-note">Сначала отметьте 5 ночей в привычном режиме. Затем покажем ориентир подъёма; сокращать сон ради цели не нужно.</p>`}
    <label class="field">Целевой подъём<input type="time" name="target" value="${slEsc(s.targetWake || "08:30")}" required></label>
    <div class="sl-chips">${picks.map(t => `<button type="button" class="sl-chip" data-action="sl-pick" data-time="${t}">${t}</button>`).join("")}</div>
    <p class="sl-kicker">Важно для безопасности</p>
    <label class="sl-check"><input type="checkbox" name="snore" ${screen.snore ? "checked" : ""}><span>Громкий храп или остановки дыхания во сне</span></label>
    <label class="sl-check"><input type="checkbox" name="sleepy" ${screen.sleepy ? "checked" : ""}><span>Засыпаю днём против воли, за рулём</span></label>
    <label class="sl-check"><input type="checkbox" name="condition" ${screen.condition ? "checked" : ""}><span>Эпилепсия, биполярное расстройство или беременность</span></label>
    <p class="section-note">Если что-то отмечено — автоматический сдвиг будет на паузе; доступен дневник. Храп с остановками дыхания и сонливость днём — повод показаться врачу.</p>
    
    <button class="primary-button sl-wide" type="submit" ${slState().pending?"disabled":""}>${slState().pending?"Сохраняю…":editing ? "Сохранить" : "Начать"}</button>
    ${editing ? "" : `<p class="section-note">Первые 5 ночей — наблюдение. Короткая отметка показывает время в постели; подробная позволяет оценить сон и эффективность.</p>`}
  </form>`;
}

function slHero(d) {
  const s = d.settings, p = d.plan || {};
  let title, sub, pct = 0;
  if (d.phase === "baseline") { title = "Начальные отметки"; sub = `Отмечено ${Math.min(d.baselineCount ?? d.sinceStart, 5)} из 5 ночей. Пока живите как обычно — план встанет под ваш сон.`; pct = Math.min(1, (d.baselineCount ?? d.sinceStart) / 5); }
  else if (d.phase === "hold") { title = "Закрепление"; sub = `По трём последним отметкам подъём близок к ${slEsc(s.targetWake)}. Это прогресс режима, не диагноз.`; pct = 1; }
  else {
    const from = s.baseline?.wake ?? s.wakeNow, to = (t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; })(s.targetWake);
    pct = from > to ? Math.max(0, Math.min(1, (from - s.wakeNow) / (from - to))) : 0;
    const left = Math.ceil(Math.max(0, s.wakeNow - to) / (s.stepMinutes || 20)) * (s.everyDays || 3);
    title = p.paused ? "План на паузе" : `Подъём ${slEsc(p.wake || "—")} → ${slEsc(s.targetWake)}`;
    sub = p.paused ? p.note : "Ориентир меняется только после недавних подробных ночей с достаточным отдыхом, без выраженной сонливости. Срок достижения цели не обещаем.";
  }
  return `<div class="sl-plan-status"><p class="sl-kicker">${d.phase === "baseline" ? "Этап 1 · замер" : d.phase === "hold" ? "Этап 3" : "Этап 2 · сдвиг ритма"}</p><h2>${title}</h2><p class="section-note">${sub}</p><span class="sl-bar"><i style="width:${Math.round(pct * 100)}%"></i></span></div>`;
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
    return `<section class="sl-card sl-night empty"><div class="sl-row"><div><p class="sl-kicker">Эта ночь</p><h3>Ещё не отмечена</h3><small class="section-note">Когда легли, когда встали и как выспались. Подробности — по желанию.</small></div><span class="sl-ic">${icon("zzz", "icon-sm")}</span></div><button class="primary-button sl-wide" type="button" data-action="sl-night">Отметить ночь</button></section>`;
  }
  if(n.issue) return `<section class="sl-card"><p class="sl-kicker">Ночь на ${slDate(n.day)}</p><p class="sl-error">${slEsc(n.issue)}</p><button class="ghost-button" data-action="sl-night" data-day="${slEsc(n.day)}">Проверить запись</button></section>`;
  if(n.detail === "quick") {
    let minutes=toMinLocal(n.rise)-toMinLocal(n.bed);if(minutes<0)minutes+=1440;
    return `<section class="sl-card sl-night"><div class="sl-row"><p class="sl-kicker">Ночь на ${slDate(n.day)}</p><button class="text-action" data-action="sl-night" data-day="${slEsc(n.day)}">Изменить</button></div><h3>${slEsc(n.bed)} → ${slEsc(n.rise)}</h3><p class="section-note">В постели ${slDur(minutes)} · качество ${n.quality || "—"}/5</p><p class="section-note">Короткая отметка: длительность сна и эффективность неизвестны.</p></section>`;
  }
  const m = n.metrics || {};
  return `<section class="sl-card sl-night"><div class="sl-row"><p class="sl-kicker">Ночь на ${slDate(n.day)}</p><button class="text-action" type="button" data-action="sl-night" data-day="${slEsc(n.day)}">Изменить</button></div>
    <div class="sl-stats"><div><small>Спали</small><b>${slDur(m.tst)}</b></div><div><small>Эффективность</small><b>${Math.round((m.se || 0) * 100)}%</b></div><div><small>Засыпали</small><b>${slDur(n.sol)}</b></div><div><small>Качество</small><b>${n.quality || "—"}/5</b></div></div>
    ${slTimeline(n)}<small class="section-note">Легли ${slEsc(n.bed)} · уснули ≈ ${slHm(toMinLocal(n.lights) + n.sol)} · проснулись ${slEsc(n.wake)}${n.wakes ? ` · просыпались ${n.wakes} раз` : ""}</small></section>`;
}
const toMinLocal = t => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };

function slPlanCard(d) {
  const p=d.plan;if(!p)return "";
  const row=(ic,title,sub)=>`<div class="sl-plan-row"><span class="sl-ic">${icon(ic,"icon-sm")}</span><div><b>${title}</b><small>${sub}</small></div></div>`;
  if(d.phase==="baseline"||p.paused)return `<section class="sl-card">${slHero(d)}${p.paused?"":`<p class="section-note">${slEsc(p.note)}</p>`}${slRuleList(true)}</section>`;
  return `<section class="sl-card"><p class="sl-kicker">План на сегодня</p>${slHero(d)}
    ${row("sun",`Подъём — ориентир ${slEsc(p.wake)}`,"Без сокращения сна ради времени на часах. После подъёма полезен дневной свет.")}
    ${row("moon","Вечером — спокойный свет и привычный ритуал","Ложитесь, когда появляется сонливость. Точный отбой автоматически не назначаем.")}
    <p class="section-note">${slEsc(p.note)}</p>${slRuleList(true)}</section>`;
}

function slRuleList(compact) {
  const rules = [
    "Ложитесь, только когда клонит в сон, — не «потому что пора».",
    "Не спится дольше ~20 минут — встаньте, займитесь спокойным в тусклом свете, вернитесь, когда клонит.",
    "Кровать — только для сна: без телефона, сериалов и работы.",
    "Если дневной сон мешает заснуть вечером, отметьте его в дневнике и обсудите подходящий режим. Не боритесь с опасной сонливостью.",
  ];
  return `<details class="sl-rules" ${compact ? "" : "open"}><summary>Правила ночи</summary><ul>${rules.map(r => `<li>${r}</li>`).join("")}</ul></details>`;
}

function slWeekCard(d, compact=false) {
  const w = d.week, s = slState();
  if (!w) return `<section class="sl-card"><p class="sl-kicker">Неделя</p><p class="section-note">Итоги появятся после первых отмеченных ночей.</p></section>`;
  const since = new Date(Date.parse(`${d.today}T12:00:00Z`)-7*86400000).toISOString().slice(0,10);
  const nights = (d.nights || []).filter(n=>n.day>since&&n.day<=d.today).sort((a,b)=>a.day.localeCompare(b.day));
  const max = Math.max(540, ...nights.map(n => n.metrics?.tst || 0));
  const bars = nights.map(n => `<span class="sl-col" title="${slDate(n.day)} · ${n.metrics ? slDur(n.metrics.tst) : "длительность сна неизвестна"}"><i style="height:${Math.round(((n.metrics?.tst || 0) / max) * 100)}%" class="${!n.metrics ? "unknown" : n.metrics.se >= 0.85 ? "good" : ""}"></i><small>${slWeekday(n.day).slice(0, 2)}</small></span>`).join("");
  return `<section class="sl-card"><div class="sl-row"><p class="sl-kicker">Последние 7 дней</p><small class="section-note">${w.nights} ${w.nights === 1 ? "ночь" : w.nights < 5 ? "ночи" : "ночей"}</small></div>
    <div class="sl-stats"><div><small>Сон в среднем</small><b>${slDur(w.tst)}</b></div><div><small>Эффективность</small><b>${w.se == null ? "—" : w.se + "%"}</b></div><div><small>Засыпание</small><b>${slDur(w.sol)}</b></div><div><small>Разброс подъёма</small><b>${w.wakeSpread == null ? "—" : `±${w.wakeSpread} мин`}</b></div></div>
    ${w.onPlan ? `<p class="section-note">Подъём по плану: ${w.onPlan.kept} из ${w.onPlan.of}${w.jetlag != null && Math.abs(w.jetlag) >= 45 ? ` · в выходные середина сна сдвигается на ${slDur(Math.abs(w.jetlag))} — наблюдение, а не установленная причина` : ""}</p>` : ""}
    <p class="section-note">Длительность сна и эффективность — только по подробным ночам (${w.detailedNights ?? nights.filter(n=>n.metrics).length}). Прочерк означает, что данных нет.</p>
    ${!compact && nights.length ? `<div class="sl-chart">${bars}</div><small class="section-note">Столбик — сон по подробному дневнику; пунктир — короткая отметка без оценки длительности. Цвет показывает эффективность, а не достаточность сна.</small>` : ""}
    ${compact ? `<button class="text-action" type="button" data-action="sl-tab" data-tab="progress">Подробнее о прогрессе</button>` : s.debrief ? `<div class="sl-debrief">${s.debrief.loading ? `<span class="live-spin"></span>` : slEsc(s.debrief.text)}</div>` : `<button class="ghost-button sl-wide" type="button" data-action="sl-debrief">Разбор недели</button>`}</section>`;
}

function slIsiCard(d) {
  const list = d.settings.isi || [], last = list[list.length - 1];
  const level = sc => (sc <= 7 ? "нет выраженных симптомов" : sc <= 14 ? "подпороговые симптомы" : sc <= 21 ? "умеренные симптомы" : "выраженные симптомы");
  const due = !last || (Date.parse(d.today) - Date.parse(last.on)) / 86_400_000 >= 14;
  return `<section class="sl-card"><div class="sl-row"><div><p class="sl-kicker">Симптомы бессонницы · ISI</p>${last ? `<h3>${last.score} из 28 · ${level(last.score)}</h3><small class="section-note">${slDate(last.on)}${list.length > 1 ? ` · было ${list[list.length - 2].score}` : ""}</small>` : `<h3>Анкета не пройдена</h3><small class="section-note">7 вопросов, минута — точка отсчёта, чтобы видеть прогресс.</small>`}</div>
    <button class="${due ? "primary-button" : "ghost-button"}" type="button" data-action="sl-isi">${last ? "Ещё раз" : "Пройти"}</button></div><p class="section-note">Анкета оценивает симптомы и не ставит диагноз.</p>${due && last ? `<small class="section-note">Прошло 2 недели — можно сравнить симптомы.</small>` : ""}</section>`;
}

function slHowCard(d) {
  return `<details class="sl-card sl-how"><summary><b>Как это работает</b><small>доказательства и ограничения</small></summary>
  <p>Flow — дневник сна и помощник по режиму. Это не диагностический тест и не проверенная программа лечения бессонницы.</p>
  <p>Многокомпонентная КПТ-Б рекомендована при хронической бессоннице. Здесь используются отдельные поведенческие принципы, но не заменяется полный курс.</p>
  <p>Важны и достаточная длительность сна, и регулярность. Нельзя сокращать сон только ради графика. Время в постели не равно времени сна.</p>
  <p>Автоматическое ограничение времени в постели приостановлено. Если храп сопровождается остановками дыхания, сонливость мешает безопасности или есть другие отмеченные риски, план сдвига на паузе — стоит обсудить сон с врачом.</p>
  <p>Короткие отметки помогают видеть время подъёма. Для оценки длительности сна и эффективности нужны подробные записи. Шаг20мин раз в3дня — ориентир приложения, не обещание лечебного эффекта.</p>
  <p><a href="https://www.healthquality.va.gov/guidelines/CD/insomnia/index.asp" target="_blank" rel="noopener noreferrer">Руководство VA/DoD2025</a> · <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC7853203/" target="_blank" rel="noopener noreferrer">Рекомендации AASM</a></p></details>`;
}

function slHistoryCard(d) {
  const s = slState(), list = d.nights || [];
  if (!list.length) return "";
  const shown = s.open.history ? list : list.slice(0, 5);
  return `<section class="sl-card"><div class="sl-row"><p class="sl-kicker">Ночи</p><button class="text-action" type="button" data-action="sl-night" data-day="">+ ночь</button></div>
    ${shown.map(n => `<button type="button" class="sl-list-row" data-action="sl-night" data-day="${slEsc(n.day)}"><span><b>${slWeekday(n.day)}, ${slDate(n.day)}</b><small>${slEsc(n.bed)} → ${slEsc(n.rise || n.wake)} · ${n.detail === "quick" ? "короткая отметка" : `засыпали ${slDur(n.sol)}`}${n.source === "device" ? " · с часов" : ""}</small></span><span class="sl-list-val">${slDur(n.metrics?.tst)}<small>${n.metrics ? Math.round(n.metrics.se * 100)+"%" : "нет оценки сна"}</small></span></button>`).join("")}
    ${list.length > 5 ? `<button class="text-action" type="button" data-action="sl-history">${s.open.history ? "Свернуть" : `Все ${list.length}`}</button>` : ""}</section>`;
}

function slSettingsCard(d) {
  const s = d.settings;
  return `<section class="sl-card"><p class="sl-kicker">Настройки</p>
    <button type="button" class="sl-list-row" data-action="sl-edit-target"><span><b>Цель подъёма</b><small>${slEsc(s.targetWake)} · можно поменять, шаги сохранятся</small></span>${icon("right", "icon-sm")}</button>
    <label class="sl-list-row sl-toggle-row"><span><b>Напоминания ботом</b><small>ориентир подъёма и напоминание о дневнике; ночных сообщений нет</small></span><input type="checkbox" data-sl-reminders ${s.reminders !== false ? "checked" : ""}></label>
    <button type="button" class="sl-list-row" data-action="sl-restart"><span><b>Начать заново</b><small>новая неделя замера; ночи и анкеты останутся</small></span>${icon("reset", "icon-sm")}</button>
    <button class="ghost-button sl-wide" type="button" data-action="sl-reload">Обновить данные</button>
    <p class="section-note">Часы или браслет: когда появятся, ночи будут подтягиваться сами через Health Connect — отметки дневника важнее и не затираются.</p></section>`;
}

// ------------------------------------------------------------ окна

function slSheetHtml() {
  const s = slState();
  if (!s.sheet) return "";
  const view = s.sheet.kind === "night" ? slNightSheet(s.sheet) : s.sheet.kind === "isi" ? slIsiSheet() : s.sheet.kind === "target" ? { title: "Цель подъёма", body: slSetupCard(s.data, true) } : null;
  if (!view) return "";
  return `<div class="modal-backdrop sl-backdrop" data-action="sl-backdrop"><section class="sheet sl-sheet" role="dialog" aria-modal="true" aria-label="${slEsc(view.title)}"><div class="sheet-handle"></div><div class="sheet-head"><h2>${slEsc(view.title)}</h2><button class="icon-button" type="button" data-action="sl-close" aria-label="Закрыть">${icon("close")}</button></div>${s.pending?`<fieldset class="sl-saving" disabled>${view.body}</fieldset>`:view.body}${s.sheetError ? `<p class="sl-error" role="alert">${slEsc(s.sheetError)}</p>` : ""}</section></div>`;
}

function slRememberNight(form) {
  if(!form || !slState().sheet)return;
  const draft={};
  for(const input of form.querySelectorAll('input[name]')) {
    if(input.name==='tag')continue;
    if(input.type==='radio'){if(input.checked)draft[input.name]=Number(input.value);}
    else draft[input.name]=input.type==='checkbox'?input.checked:input.value;
  }
  draft.tags=[...form.querySelectorAll('[name="tag"]:checked')].map(x=>x.value);
  slState().sheet.draft=draft;
}
function slNightSheet(sheet) {
  const d=slState().data,day=sheet.day||d.today,have=(d.nights||[]).find(n=>n.day===day),lockedFull=have && have.detail!=="quick";
  const full=lockedFull || sheet.detail==="full",busy=slState().pending;
  const v={...(have||{}),...(sheet.draft||{})},detailAttrs=full?"required":"disabled";
  const time=(name,label,extra=false)=>`<label class="sl-field"><span>${label}</span><input type="time" name="${name}" value="${slEsc(v[name] ?? "")}" ${extra?detailAttrs:"required"}></label>`;
  const stepper=(name,label,unit,step,max)=>`<div class="sl-field"><label for="sl-${name}">${label}</label><div class="sl-stepper"><button type="button" data-action="sl-step" data-name="${name}" data-d="-${step}" aria-label="Уменьшить: ${label}">−</button><input id="sl-${name}" type="number" name="${name}" min="0" max="${max}" inputmode="numeric" value="${slEsc(v[name] ?? "")}" ${detailAttrs}><span>${unit}</span><button type="button" data-action="sl-step" data-name="${name}" data-d="${step}" aria-label="Увеличить: ${label}">+</button></div></div>`;
  const labels=["Очень плохо","Плохо","Средне","Хорошо","Отлично"];
  return {title:day===d.today?"Как спалось":`Ночь на ${slDate(day)}`,body:`<form class="sl-form" data-sl-form="night" novalidate data-detail="${full?"full":"quick"}">
    ${lockedFull?`<p class="section-note">Подробный дневник этой ночи сохранён. Его данные не заменяются короткой отметкой.</p>`:`<div class="sl-mode" role="group" aria-label="Подробность дневника"><button type="button" data-action="sl-detail" data-detail="quick" aria-pressed="${!full}">Коротко</button><button type="button" data-action="sl-detail" data-detail="full" aria-pressed="${Boolean(full)}">Подробно</button></div>`}
    <label class="sl-field"><span>Дата утра</span><input type="date" name="day" value="${slEsc(v.day||day)}" max="${slEsc(d.today)}" required></label>
    <div class="sl-pair">${time("bed","Лёг в кровать")}${time("rise","Встал с кровати")}</div>
    <div class="sl-extra" ${full?"":"hidden"}>
      <div class="sl-pair">${time("lights","Начал пытаться уснуть",true)}${time("wake","Проснулся окончательно",true)}</div>
      ${stepper("sol","Время засыпания","мин",5,600)}
      <div class="sl-pair">${stepper("wakes","Пробуждений","раз",1,50)}${stepper("waso","Не спал ночью всего","мин",5,900)}</div>
      <p class="section-note">Если пробуждений не было — укажите 0. Не помните минуты — оставьте короткую отметку, без оценки эффективности.</p>
    </div>
    <fieldset class="sl-quality-field"><legend>Как выспался</legend><div class="sl-quality">${labels.map((label,i)=>`<label><input type="radio" name="quality" value="${i+1}" ${v.quality===i+1?"checked":""} required><span><b>${i+1}</b><small>${label}</small></span></label>`).join("")}</div></fieldset>
    <label class="sl-check"><input type="checkbox" name="sleepy" ${v.sleepy?"checked":""}><span>Выраженная сонливость мешает вниманию и безопасности</span></label>
    <details class="sl-night-tags"><summary>Что могло повлиять</summary><div class="sl-tags">${SL_TAGS.map(([k,label])=>`<label><input type="checkbox" name="tag" value="${k}" ${(v.tags||[]).includes(k)?"checked":""}><span>${label}</span></label>`).join("")}</div></details>
    <p class="section-note">${full?"Оценка сна будет рассчитана по вашим ответам.":"Это отметка времени в постели. Длительность сна и эффективность по ней не рассчитываются."}</p>
    <p class="sl-error sl-night-error" role="alert" hidden></p><button class="primary-button sl-wide" type="submit" ${busy?"disabled":""}>${busy?"Сохраняю…":"Сохранить"}</button>
    ${have?`<button class="text-action danger" type="button" data-action="sl-night-delete" data-day="${slEsc(day)}" ${busy?"disabled":""}>Удалить ночь</button>`:""}</form>`};
}

function slIsiSheet() {
  const qs = slState().data.isiQuestions || [];
  const scale = i => i < 3 ? ["нет", "слабо", "умеренно", "сильно", "очень сильно"] : i === 3 ? ["очень доволен", "доволен", "так себе", "недоволен", "очень недоволен"] : ["совсем нет", "немного", "заметно", "сильно", "очень сильно"];
  return { title: "Симптомы бессонницы", body: `<form class="sl-form" data-sl-form="isi"><p class="section-note">За последние 2 недели. Индекс тяжести бессонницы (ISI) — оценка симптомов, не диагноз.</p>
    ${qs.map((q, i) => `<fieldset class="sl-isi"><legend>${i + 1}. ${slEsc(q)}</legend><div>${scale(i).map((l, k) => `<label><input type="radio" name="q${i}" value="${k}" required><span>${l}</span></label>`).join("")}</div></fieldset>`).join("")}
    <button class="primary-button sl-wide" type="submit">Посчитать</button></form>` };
}

// ------------------------------------------------------------ действия

function sleepAction(action, control, event) {
  if (!action.startsWith("sl-")) return false;
  const s = slState();
  if(action === "sl-tab"){if(["today","progress","more"].includes(control.dataset.tab)){s.tab=control.dataset.tab;render();}return true;}
  if(action === "sl-detail"){if(s.pending)return true;slRememberNight(control.closest('form'));s.sheet.detail=control.dataset.detail;render();return true;}
  if(s.pending)return true;
  if (action === "sl-backdrop") { if (event?.target === control && confirmSheetDiscard(document.querySelector(".sl-sheet"))) { s.sheet = null; render(); } return true; }
  if (action === "sl-close") { if (!confirmSheetDiscard(document.querySelector(".sl-sheet"))) return true; s.sheet = null; s.sheetError = ""; render(); return true; }
  if (action === "sl-reload") { s.error = ""; slLoad(); render(); return true; }
  if (action === "sl-home") { navigate("sleep"); render(); return true; }
  if (action === "sl-pick") { const input = control.closest("form")?.querySelector('[name="target"]'); if (input) input.value = control.dataset.time; return true; }
  if (action === "sl-night") { s.sheet = { kind: "night", day: control.dataset.day || "" }; s.sheetError = ""; render(); return true; }
  if (action === "sl-night-delete") { if (window.confirm("Удалить эту ночь из дневника?")) slDo("delete", { day: control.dataset.day }); return true; }
  if (action === "sl-step") { const input = control.closest("form").querySelector(`[name="${control.dataset.name}"]`); input.value = Math.max(0, Math.min(Number(input.max)||900, (Number(input.value) || 0) + Number(control.dataset.d))); return true; }
  if (action === "sl-isi") { s.sheet = { kind: "isi" }; s.sheetError = ""; render(); return true; }
  if (action === "sl-edit-target") { s.sheet = { kind: "target" }; s.sheetError = ""; render(); return true; }
  if (action === "sl-history") { s.open.history = !s.open.history; render(); return true; }
  if (action === "sl-restart") { if (window.confirm("Начать заново с недели замера? Ночи и анкеты останутся.")) slDo("restart", {}); return true; }
  if (action === "sl-debrief") {
    if(s.debrief?.loading)return true;
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
    slRememberNight(form);
    if(!form.checkValidity()) {
      const invalid=form.querySelector(':invalid');
      const label=invalid?.closest('.sl-field')?.querySelector('label,span')?.textContent || 'Как выспался';
      const error=form.querySelector('.sl-night-error');
      error.textContent=`Заполните поле «${label}». Если не помните подробности, выберите «Коротко».`;
      error.hidden=false;invalid?.focus();return;
    }
    const full=form.dataset.detail==="full";
    const observed={day:f.day.value,bed:f.bed.value,rise:f.rise.value,detail:full?"full":"quick",quality:Number(form.querySelector('[name="quality"]:checked')?.value),sleepy:f.sleepy.checked,tags:[...form.querySelectorAll('[name="tag"]:checked')].map(x=>x.value)};
    if(!Number.isInteger(observed.quality)||observed.quality<1||observed.quality>5){slState().sheetError="Укажите, как выспались.";render();return;}
    slDo("night", { ...observed,...(full?{lights:f.lights.value,wake:f.wake.value,sol:f.sol.value,wakes:f.wakes.value,waso:f.waso.value}:{}) },
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
  const title = d.phase === "baseline" ? `Наблюдение · ${Math.min(d.baselineCount ?? d.sinceStart, 5)} из 5 ночей` : p.paused ? "Дневник · план на паузе" : `Ориентир подъёма ${p.wake || "—"} · без сокращения сна`;
  const sub = d.lastNight ? d.lastNight.detail === "quick" ? "Короткая отметка сохранена · оценка сна неизвестна" : d.lastNight.metrics ? `Сон по дневнику: ${slDur(d.lastNight.metrics.tst)}` : "Отметка сохранена · проверьте подробности" : "Ночь ещё не отмечена";
  return `<section class="section"><button type="button" class="en-home ${d.lastNight ? "done" : ""}" data-action="sl-home"><span class="en-step-ic">${icon("zzz", "icon-sm")}</span><span class="en-home-text"><small>Сон</small><b>${slEsc(title)}</b><span>${slEsc(sub)}</span></span>${icon("arrow", "icon-sm")}</button></section>`;
}

document.addEventListener("visibilitychange",()=>{const s=slState();if(!document.hidden&&ui.page==="sleep"&&!s.pending&&!s.sheet)slLoad();});

