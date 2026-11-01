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
function slDeviceBridge() {
  const bridge = window.sorokaSleepDevice;
  return bridge?.available === true && typeof bridge.state === "function" && typeof bridge.action === "function" ? bridge : null;
}
function slDeviceCurrent() { return slState().device || { available: Boolean(slDeviceBridge()), enabled: false, status: "permission" }; }
function slDeviceCanRender() {
  const s = slState();
  return ui.page === "sleep" && !s.pending && !ui.sheet && (!s.sheet || s.sheet.kind === "device");
}
function slDeviceFlush() {
  const s = slState();
  if (!s.deviceRefresh || !slDeviceCanRender() || s.loading) return;
  s.deviceRefresh = false;
  slLoad(true);
}
function slDeviceAccept(state) {
  if (!state || typeof state !== "object") return;
  const s = slState();
  s.deviceRevision = (s.deviceRevision || 0) + 1;
  s.device = { ...state, available: Boolean(slDeviceBridge()) && state.available !== false };
  const at = state.lastSuccessAt;
  if (at && state.status !== "syncing" && state.status !== "error" && at !== s.deviceSuccessSeen) {
    s.deviceSuccessSeen = at;
    s.deviceRefresh = true;
  }
  if (slDeviceCanRender()) { slDeviceFlush(); render(); }
}
async function slDeviceRead() {
  const s = slState(), bridge = slDeviceBridge();
  if (!bridge || s.deviceReading) return;
  s.deviceReading = true;
  const revision = s.deviceRevision || 0;
  try {
    const state = await bridge.state();
    if ((s.deviceRevision || 0) === revision) slDeviceAccept(state);
  } catch (e) {
    if ((s.deviceRevision || 0) === revision) slDeviceAccept({ ...slDeviceCurrent(), status: "error", error: String(e?.message || "Не получилось проверить подключение. Повторите.") });
  } finally { s.deviceReading = false; if (slDeviceCanRender()) render(); }
}
async function slDeviceDo(name) {
  const s = slState(), bridge = slDeviceBridge();
  if (!bridge || s.deviceBusy || !["connect", "sync", "disconnect", "settings"].includes(name)) return;
  s.deviceBusy = true; s.deviceRevision = (s.deviceRevision || 0) + 1;
  if (slDeviceCanRender()) render();
  try { slDeviceAccept(await bridge.action(name)); }
  catch (e) { slDeviceAccept({ ...slDeviceCurrent(), status: "error", error: String(e?.message || "Не получилось выполнить действие. Повторите.") }); }
  finally { s.deviceBusy = false; if (slDeviceCanRender()) render(); }
}
function slDeviceOpen() {
  const s = slState(), form = document.querySelector?.('[data-sl-form="setup"]');
  if (form?.elements) {
    const f = form.elements;
    s.setupDraft = { targetWake: f.target.value, snore: f.snore.checked, sleepy: f.sleepy.checked, condition: f.condition.checked };
  }
  s.sheet = { kind: "device" }; s.sheetError = "";
  render(); slDeviceRead();
}
function slDeviceWhen(at) {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
function slDeviceSummary() {
  const d = slDeviceCurrent();
  if (!slDeviceBridge()) return window.SorokaAndroid ? "Нужно обновить Android-приложение" : "Подключение в Android-приложении Flow";
  if (d.status === "syncing") return "Синхронизирую сон…";
  if (d.status === "install") return "Нужно установить или обновить Health Connect";
  if (d.status === "unsupported") return "Health Connect недоступен на этом телефоне";
  if (d.status === "error") return "Не получилось синхронизировать · можно повторить";
  if (d.status === "permission") return d.enabled ? "Нет разрешения на чтение сна" : "Разрешите чтение сна";
  if (d.enabled) return d.lastSuccessAt ? `Обновлено ${slDeviceWhen(d.lastSuccessAt)}` : "Подключено · записи ещё не получены";
  return "Импорт сна через Health Connect";
}
function slDeviceRow() {
  return `<button type="button" class="sl-list-row sl-device-row" data-action="sl-device"><span><b>Браслет и часы</b><small>${slEsc(slDeviceSummary())}</small></span>${icon("right", "icon-sm")}</button>`;
}
function slDeviceSheet() {
  const s = slState(), d = slDeviceCurrent(), bridge = slDeviceBridge();
  const busy = s.deviceBusy || d.status === "syncing";
  const button = (label, name, primary = false) => `<button type="button" class="${primary ? "primary-button" : "ghost-button"} sl-wide" data-action="sl-device-action" data-device-action="${name}" ${busy ? "disabled" : ""}>${label}</button>`;
  let body;
  if (!bridge) body = `<p class="section-note">${window.SorokaAndroid ? "Обновите Android-приложение Flow, чтобы разрешить чтение сна из Health Connect." : "Откройте Flow в Android-приложении, чтобы подключить сон из Mi Fitness через Health Connect."}</p>`;
  else if (d.status === "unsupported") body = `<p class="section-note">На этом телефоне Health Connect недоступен. Дневник сна можно заполнять вручную.</p>`;
  else if (d.status === "install") body = `<p class="section-note">Для передачи сна нужен Health Connect. После установки вернитесь в Flow и разрешите чтение сна.</p>${button("Установить или обновить", "connect", true)}`;
  else {
    const connected = d.enabled && d.status !== "permission";
    const action = connected ? "sync" : "connect";
    body = `<p class="section-note">Mi Fitness передаёт сон в Health Connect. Flow читает записи с вашего разрешения; ручной дневник имеет приоритет.</p>
      <div class="sl-device-status" role="status"><b>${slEsc(slDeviceSummary())}</b>${d.enabled ? `<small>${d.backgroundGranted ? "Фоновая синхронизация включена" : "Обновляется при открытии Flow"}</small>` : ""}</div>
      ${d.status === "error" ? `<p class="sl-error" role="alert">${slEsc(String(d.error || "Не получилось получить сон. Проверьте связь и разрешения, затем повторите.").slice(0, 400))}</p>` : ""}
      ${d.lastSuccessAt ? `<p class="section-note">Последний успешный импорт: ${slEsc(slDeviceWhen(d.lastSuccessAt))}. Добавлено ${Number(d.added) || 0}, обновлено ${Number(d.updated) || 0}, без изменений ${Number(d.skipped) || 0}.${Number(d.invalid) > 0 ? ` Не принято записей: ${Number(d.invalid)}.` : ""}</p>${!(Number(d.added) || Number(d.updated)) ? `<p class="section-note">Новых ночей нет. Если ночь ещё не появилась, откройте Mi Fitness и синхронизируйте браслет.</p>` : ""}` : ""}
      ${button(busy ? "Подождите…" : d.status === "error" ? "Повторить" : connected ? "Синхронизировать" : "Разрешить чтение сна", action, true)}
      ${d.enabled && d.backgroundAvailable && !d.backgroundGranted ? button("Разрешить в фоне", "connect") : ""}
      ${button("Разрешения Health Connect", "settings")}
      ${d.enabled ? `<button type="button" class="text-action sl-device-disconnect" data-action="sl-device-action" data-device-action="disconnect" ${busy ? "disabled" : ""}>Отключить синхронизацию</button><p class="section-note">Сохранённые ночи останутся в Flow.</p>` : ""}`;
  }
  return { title: "Браслет и часы", body: `<div class="sl-form sl-device">${body}</div>` };
}
if (!window.flowSleepSyncBound && typeof window.addEventListener === "function") {
  window.flowSleepSyncBound = true;
  window.addEventListener("flow:sleep-sync", event => slDeviceAccept(event.detail));
}
function slLoad(deviceRefresh = false) {
  const s = slState();
  if (s.loading) return;
  s.loading = true;
  const revision = s.revision || 0;
  slCall("load").then(d => { if (d?.error) throw new Error(d.error); if ((s.revision || 0) !== revision) return; s.data = d; s.at = Date.now(); s.error = ""; })
    .catch(e => { s.error = String(e?.message || "Не получилось загрузить"); })
    .finally(() => { s.loading = false; if (deviceRefresh ? slDeviceCanRender() : ui.page === "sleep" || ui.page === "today") render(); });
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
const slDur = m => { if (m == null || !Number.isFinite(m)) return "—"; const value=Math.round(m),h=Math.floor(value/60),mm=value%60; return h ? `${h} ч${mm ? ` ${String(mm).padStart(2, "0")} мин` : ""}` : `${mm} мин`; };
const slHm = m => { const v = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`; };
const slDate = d => new Date(`${d}T12:00:00Z`).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
const slWeekday = d => new Date(`${d}T12:00:00Z`).toLocaleDateString("ru-RU", { weekday: "short", timeZone: "UTC" });
const SL_TAGS = [["coffee_late", "Кофе после обеда"], ["alcohol", "Алкоголь"], ["late_workout", "Поздняя тренировка"], ["nap", "Спал днём"], ["screen_bed", "Телефон в кровати"], ["stress", "Стресс, мысли"]];

// ------------------------------------------------------------ страница

function renderSleepPage() {
  const s=slState(),head=`${header("Сон","","")}<div class="sl-page">`;
  if(!s.data){if(!s.loading&&!s.error)slLoad();return `${head}${s.error?`<p class="sl-error" role="alert">${slEsc(s.error)}</p><button class="ghost-button" data-action="sl-reload">Повторить</button>`:`<div class="en-wait"><span class="live-spin"></span></div>`}</div>${slSheetHtml()}`;}
  if(!s.error&&!s.pending&&!s.sheet&&!ui.sheet&&!s.loading&&Date.now()-(s.at||0)>60000)slLoad();
  const d=s.data;
  if (!s.deviceChecked) { s.deviceChecked = true; slDeviceRead(); }
  slDeviceFlush();
  const tabs=`<div class="sl-tabs" role="tablist" aria-label="Разделы сна">${[["today","Сегодня"],["progress","Прогресс"],["more","Ещё"]].map(([key,label])=>`<button type="button" role="tab" aria-selected="${(s.tab||"today")===key}" class="${(s.tab||"today")===key?"active":""}" data-action="sl-tab" data-tab="${key}">${label}</button>`).join("")}</div>`;
  const body=s.tab==="progress"?`${slWearablePeriods()}${slWeekCard(d)}${slWearableHistory(d)}`:s.tab==="more"?slMoreCard(d):`${slNightCard(d)}${slWeekCard(d,true)}${slWearable(d).latestNight?`<section class="sl-card">${slDeviceRow()}</section>`:""}`;
  const error=s.error||(!s.sheet?s.sheetError:"");
  return `${head}${tabs}${error?`<p class="sl-error" role="alert">${slEsc(error)}</p><button class="text-action" data-action="sl-reload">Обновить</button>`:""}${body}</div>${slSheetHtml()}`;
}

function slWearable(d) {
  if (d.wearable) return d.wearable;
  const history=(d.nights||[]).filter(n=>n.device).sort((a,b)=>String(b.device.endTime).localeCompare(String(a.device.endTime)));
  return { latestNight:history[0]||null, week:null, twoWeeks:null, month:{history} };
}
function slWearablePeriods() {
  const period=slState().wearPeriod||"week";
  return `<div class="sl-mode sl-periods" role="group" aria-label="Период статистики сна">${[["week","7 дней"],["twoWeeks","14 дней"],["month","30 дней"]].map(([key,label])=>`<button type="button" data-action="sl-period" data-period="${key}" aria-pressed="${period===key}">${label}</button>`).join("")}</div>`;
}
function slWearableClock(at, timeZone) {
  const date=new Date(at);
  if(Number.isNaN(date.getTime()))return "—";
  return date.toLocaleTimeString("ru-RU",{timeZone:timeZone||"Europe/Moscow",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
}
const SL_STAGE_LABELS={light:"Лёгкий",deep:"Глубокий",rem:"REM",awake:"Бодрствование",sleeping:"Сон без фазы",unknown:"Нет данных"};
function slWearableStages(device) {
  const start=Date.parse(device?.startTime),end=Date.parse(device?.endTime);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return {segments:[],minutes:{},complete:false,overlap:false};
  const events=[{at:start},{at:end}],active=new Map(),segments=[],minutes={};
  for(const [id,raw] of (Array.isArray(device.stages)?device.stages:[]).slice(0,2000).entries()) {
    const a=Math.max(start,Date.parse(raw.startTime)),b=Math.min(end,Date.parse(raw.endTime));
    if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)continue;
    const stage=raw.stage==="out_of_bed"?"awake":Object.hasOwn(SL_STAGE_LABELS,raw.stage)?raw.stage:"unknown";
    events.push({at:a,id,stage,add:true},{at:b,id,add:false});
  }
  events.sort((a,b)=>a.at-b.at);
  let cursor=start,overlap=false;
  for(let i=0;i<events.length;) {
    const at=events[i].at;
    if(at>cursor) {
      const conflict=active.size>1,stage=active.size===1?[...active.values()][0]:"unknown";
      overlap ||= conflict;
      const previous=segments[segments.length-1];
      if(previous?.stage===stage&&previous.overlap===conflict)previous.end=at;
      else segments.push({start:cursor,end:at,stage,overlap:conflict});
      minutes[stage]=(minutes[stage]||0)+(at-cursor)/60000;
    }
    while(i<events.length&&events[i].at===at) {
      const event=events[i++];if(event.id==null)continue;
      if(event.add)active.set(event.id,event.stage);else active.delete(event.id);
    }
    cursor=at;
  }
  return {segments,minutes,complete:segments.length>0&&!minutes.unknown&&!overlap,overlap,start,end};
}
function slWearableTimeline(device, stages) {
  if(!stages.segments.length)return `<p class="section-note">Стадии сна пока не переданы.</p>`;
  const total=stages.end-stages.start;
  const labels=["light","deep","rem","awake",...(stages.minutes.sleeping?["sleeping"]:[]),...(stages.minutes.unknown?["unknown"]:[])];
  return `<div class="sl-sleep-timeline" role="img" aria-label="Стадии сна по браслету${stages.overlap?"; пересекающиеся интервалы отмечены как неизвестные":""}">${stages.segments.map(s=>`<span class="sl-stage-${s.stage}" style="width:${((s.end-s.start)/total*100).toFixed(4)}%" title="${SL_STAGE_LABELS[s.stage]}: ${slDur((s.end-s.start)/60000)}"></span>`).join("")}</div><div class="sl-stage-legend">${labels.map(key=>`<span><i class="sl-stage-${key}" aria-hidden="true"></i><span>${SL_STAGE_LABELS[key]}</span><b>${stages.minutes[key]>0?slDur(stages.minutes[key]):"—"}</b></span>`).join("")}</div>${stages.overlap?`<p class="section-note">В переданных стадиях есть пересечения. Эти участки показаны как неизвестные.</p>`:stages.minutes.unknown?`<p class="section-note">Серые участки — стадии не переданы. Они не засчитываются как измеренный сон.</p>`:""}`;
}
function slWearableConnection(d) {
  const state=slDeviceCurrent(),bridge=slDeviceBridge(),connected=bridge&&state.enabled;
  return `<section class="sl-card sl-night empty"><div class="sl-row"><div><p class="sl-kicker">Сон с браслета</p><h3>${connected?"Ждём первую запись":"Подключите браслет"}</h3></div><span class="sl-ic">${icon("zzz","icon-sm")}</span></div><p class="section-note">${connected?"После синхронизации Mi Fitness здесь появятся время сна и переданные стадии.":"Ночи из Mi Fitness будут поступать через Health Connect. Заполнять дневник для этого не нужно."}</p><div class="sl-device-status" role="status"><b>${slEsc(slDeviceSummary())}</b></div>${state.status==="error"?`<p class="sl-error">${slEsc(String(state.error||"Проверьте связь и разрешения Health Connect.").slice(0,400))}</p>`:""}<button class="primary-button sl-wide" type="button" data-action="${connected?"sl-device-action":"sl-device"}" ${connected?'data-device-action="sync"':""} ${slState().deviceBusy||state.status==="syncing"?"disabled":""}>${connected?state.status==="syncing"?"Синхронизирую…":"Синхронизировать":"Подключить браслет"}</button>${connected?`<button class="text-action" type="button" data-action="sl-device">Настройки подключения</button>`:""}</section>`;
}
function slWearableHistory(d) {
  const w=slWearable(d),period=slState().wearPeriod||"week",history=w[period]?.history||w.month?.history||[];
  const list=[...history].sort((a,b)=>String(b.day).localeCompare(String(a.day)));
  if(!list.length)return "";
  return `<section class="sl-card"><p class="sl-kicker">Ночи с браслета</p>${list.map(n=>`<button type="button" class="sl-list-row" data-action="sl-wearable-night" data-day="${slEsc(n.day)}"><span><b>${slWeekday(n.day)}, ${slDate(n.day)}</b><small>${slEsc(slWearableClock(n.device?.startTime,d.timeZone))} → ${slEsc(slWearableClock(n.device?.endTime,d.timeZone))}</small></span><span class="sl-list-val">${slDur(n.sleepMinutes??n.device?.sleepMinutes??n.intervalMinutes??n.device?.intervalMinutes)}<small>${Number.isFinite(n.sleepMinutes??n.device?.sleepMinutes)?"сон по браслету":"период записи"}</small></span>${icon("right","icon-sm")}</button>`).join("")}</section>`;
}
function slMoreCard(d) {
  const manual=(d.nights||[]).filter(n=>n.source!=="device");
  return `<section class="sl-card">${slDeviceRow()}</section><details class="sl-card sl-more-extra"><summary><b>Дневник вручную</b><small>по желанию</small></summary><div class="sl-more-body"><p class="section-note">Для своих наблюдений и самочувствия. Синхронизация браслета работает независимо от дневника.</p><button class="ghost-button sl-wide" type="button" data-action="sl-night">Добавить запись</button>${slHistoryCard({...d,nights:manual})}</div></details><details class="sl-card sl-more-extra"><summary><b>Режим и цель</b><small>дополнительно</small></summary><div class="sl-more-body">${slSettingsCard(d)}${d.phase!=="setup"?slPlanCard(d):""}${slIsiCard(d)}</div></details>${slHowCard(d)}`;
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

function slNightCard(d, selected) {
  const n=selected||slWearable(d).latestNight;
  if(!n?.device)return slWearableConnection(d);
  const device=n.device,stages=slWearableStages(device),known=Number.isFinite(device.sleepMinutes)&&stages.complete;
  return `<section class="sl-card sl-night sl-wearable-night">${selected?"":`<div class="sl-row"><p class="sl-kicker">${n.day===d.today?"Эта ночь":"Последняя доступная ночь"} · ${slDate(n.day)}</p><span class="sl-device-source">По браслету</span></div>`}
    <div class="sl-duration"><small>${known?"Сон по браслету":"Период записи"}</small><strong>${slDur(known?device.sleepMinutes:device.intervalMinutes)}</strong></div>
    <div class="sl-sleep-times"><span><small>Начало</small><b>${slEsc(slWearableClock(device.startTime,d.timeZone))}</b></span>${icon("arrow","icon-sm")}<span><small>Окончание</small><b>${slEsc(slWearableClock(device.endTime,d.timeZone))}</b></span></div>
    ${slWearableTimeline(device,stages)}${!known?`<p class="section-note">Точная длительность сна неизвестна: показан весь период записи.</p>`:""}<p class="section-note">Стадии — оценка браслета, полученная через Health Connect.</p></section>`;
}

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
  const period=compact?"week":slState().wearPeriod||"week",days={week:7,twoWeeks:14,month:30}[period]||7,w=slWearable(d)[period];
  if(!w?.nights)return `<section class="sl-card"><p class="sl-kicker">Последние ${days} дней</p><p class="section-note">Здесь появятся длительность и регулярность сна после импорта первых ночей с браслета.</p></section>`;
  const measured=Number.isFinite(w.avgSleepMinutes),history=w.history||[],max=Math.max(540,...history.map(n=>n.sleepMinutes??n.device?.sleepMinutes??n.intervalMinutes??n.device?.intervalMinutes??0));
  const map=new Map(history.map(n=>[n.day,n]));
  const bars=Array.from({length:days},(_,i)=>{
    const day=new Date(Date.parse(`${d.today}T12:00:00Z`)-(days-1-i)*86400000).toISOString().slice(0,10),n=map.get(day),actual=n?.sleepMinutes??n?.device?.sleepMinutes,interval=n?.intervalMinutes??n?.device?.intervalMinutes;
    const value=actual??interval,label=n?`${Number.isFinite(actual)?"сон":"период записи"} ${slDur(value)}`:"нет записи";
    return `<span class="sl-col" title="${slDate(day)} · ${label}"><i class="${!n?"unknown":Number.isFinite(actual)?"sl-measured":"sl-interval"}" style="height:${Number.isFinite(value)?Math.round(value/max*100):4}%"></i><small>${days<=7?slWeekday(day).slice(0,2):i%5===0?Number(day.slice(-2)):""}</small></span>`;
  }).join("");
  return `<section class="sl-card"><div class="sl-row"><p class="sl-kicker">Последние ${days} дней</p><small class="section-note">${w.nights} ночей с браслета</small></div><div class="sl-stats"><div><small>${measured?"Сон в среднем":"Период записи в среднем"}</small><b>${slDur(measured?w.avgSleepMinutes:w.avgIntervalMinutes)}</b></div><div><small>Окончание сна в среднем</small><b>${Number.isFinite(w.avgWakeMinutes)?slHm(w.avgWakeMinutes):"—"}</b></div><div><small>Разброс окончания</small><b>${Number.isFinite(w.wakeSpreadMinutes)?`±${Math.round(w.wakeSpreadMinutes)} мин`:"—"}</b></div><div><small>С измеренной длительностью</small><b>${w.measuredNights??0} из ${w.nights}</b></div></div><p class="section-note">${measured?"Средний сон — только по ночам с полными стадиями.":"Период записи может включать бодрствование; это не измеренная длительность сна."} Прочерк означает, что данных пока недостаточно.</p>${compact?`<button class="text-action" type="button" data-action="sl-tab" data-tab="progress">Посмотреть прогресс</button>`:`<div class="sl-chart sl-wearable-chart">${bars}</div><small class="section-note">Заливка — сон по браслету, контур — только период записи, пунктир — ночь не передана.</small>`}</section>`;
}

function slIsiCard(d) {
  const list = d.settings.isi || [], last = list[list.length - 1];
  const level = sc => (sc <= 7 ? "нет выраженных симптомов" : sc <= 14 ? "подпороговые симптомы" : sc <= 21 ? "умеренные симптомы" : "выраженные симптомы");
  const due = !last || (Date.parse(d.today) - Date.parse(last.on)) / 86_400_000 >= 14;
  return `<section class="sl-card"><div class="sl-row"><div><p class="sl-kicker">Симптомы бессонницы · ISI</p>${last ? `<h3>${last.score} из 28 · ${level(last.score)}</h3><small class="section-note">${slDate(last.on)}${list.length > 1 ? ` · было ${list[list.length - 2].score}` : ""}</small>` : `<h3>Анкета не пройдена</h3><small class="section-note">7 вопросов, минута — точка отсчёта, чтобы видеть прогресс.</small>`}</div>
    <button class="${due ? "primary-button" : "ghost-button"}" type="button" data-action="sl-isi">${last ? "Ещё раз" : "Пройти"}</button></div><p class="section-note">Анкета оценивает симптомы и не ставит диагноз.</p>${due && last ? `<small class="section-note">Прошло 2 недели — можно сравнить симптомы.</small>` : ""}</section>`;
}

function slHowCard(d) {
  return `<details class="sl-card sl-how"><summary><b>Как читать данные</b><small>источник и точность</small></summary>
  <p>Браслет передаёт записи в Mi Fitness, затем в Health Connect. После синхронизации Flow показывает последнюю доступную ночь и историю.</p>
  <p>Стадии — оценка браслета. Если стадии переданы не полностью, Flow показывает период записи, а точную длительность сна оставляет неизвестной. Серые участки ленты — пропуски или противоречивые данные.</p>
  <p>Начало записи не означает, что вы легли в кровать, а окончание — что уже встали. Эффективность сна и время засыпания по этим границам не рассчитываются.</p>
  <p>Своё самочувствие можно записать в необязательном дневнике. Настройки режима, правила ночи и анкета сохранены в «Ещё»; они не нужны для импорта с браслета.</p>
  <p>Flow не ставит диагноз. Если храп сопровождается остановками дыхания или сонливость мешает безопасности, стоит обсудить сон с врачом.</p>
  <p><a href="https://www.mi.com/global/support/faq/details/KA-579104/" target="_blank" rel="noopener noreferrer">О данных Xiaomi Smart Band 10</a> · <a href="https://www.healthquality.va.gov/guidelines/CD/insomnia/index.asp" target="_blank" rel="noopener noreferrer">Руководство VA/DoD2025</a></p></details>`;
}

function slHistoryCard(d) {
  const s = slState(), list = d.nights || [];
  if (!list.length) return "";
  const shown = s.open.history ? list : list.slice(0, 5);
  return `<section class="sl-card"><p class="sl-kicker">Записи дневника</p>
    ${shown.map(n => `<button type="button" class="sl-list-row" data-action="sl-night" data-day="${slEsc(n.day)}"><span><b>${slWeekday(n.day)}, ${slDate(n.day)}</b><small>${slEsc(n.bed)} → ${slEsc(n.rise || n.wake)} · ${n.source === "device" ? "по браслету" : n.detail === "quick" ? "короткая отметка" : `засыпали ${slDur(n.sol)}`}</small></span><span class="sl-list-val">${slDur(n.source === "device" ? n.device?.sleepMinutes ?? n.device?.intervalMinutes : n.metrics?.tst)}<small>${n.source === "device" ? Number.isFinite(n.device?.sleepMinutes) ? "сон по браслету" : "период записи" : n.metrics ? Math.round(n.metrics.se * 100)+"%" : "нет оценки сна"}</small></span></button>`).join("")}
    ${list.length > 5 ? `<button class="text-action" type="button" data-action="sl-history">${s.open.history ? "Свернуть" : `Все ${list.length}`}</button>` : ""}</section>`;
}

function slSettingsCard(d) {
  const s = d.settings;
  return `<section class="sl-card"><p class="sl-kicker">Настройки</p>
    <button type="button" class="sl-list-row" data-action="sl-edit-target"><span><b>Цель подъёма</b><small>${s.targetWake?`${slEsc(s.targetWake)} · можно поменять, шаги сохранятся`:"Не задана · можно настроить по желанию"}</small></span>${icon("right", "icon-sm")}</button>
    ${s.startedOn?`<label class="sl-list-row sl-toggle-row"><span><b>Напоминания ботом</b><small>ориентир подъёма и напоминание о дневнике; ночных сообщений нет</small></span><input type="checkbox" data-sl-reminders ${s.reminders !== false ? "checked" : ""}></label><button type="button" class="sl-list-row" data-action="sl-restart"><span><b>Начать заново</b><small>новая неделя замера; ночи и анкеты останутся</small></span>${icon("reset", "icon-sm")}</button>`:""}
    <button class="ghost-button sl-wide" type="button" data-action="sl-reload">Обновить данные</button>
    </section>`;
}

// ------------------------------------------------------------ окна

function slSheetHtml() {
  const s = slState();
  if (!s.sheet) return "";
  const view = s.sheet.kind === "night" ? slNightSheet(s.sheet) : s.sheet.kind === "wearable" ? slWearableNightSheet(s.sheet) : s.sheet.kind === "device" ? slDeviceSheet() : s.sheet.kind === "isi" ? slIsiSheet() : s.sheet.kind === "target" ? { title: "Цель подъёма", body: slSetupCard(s.data, true) } : null;
  if (!view) return "";
  return `<div class="modal-backdrop sl-backdrop" data-action="sl-backdrop"><section class="sheet sl-sheet" role="dialog" aria-modal="true" aria-label="${slEsc(view.title)}"><div class="sheet-handle"></div><div class="sheet-head"><h2>${slEsc(view.title)}</h2><button class="icon-button" type="button" data-action="sl-close" aria-label="Закрыть">${icon("close")}</button></div>${s.pending?`<fieldset class="sl-saving" disabled>${view.body}</fieldset>`:view.body}${s.sheetError ? `<p class="sl-error" role="alert">${slEsc(s.sheetError)}</p>` : ""}</section></div>`;
}

function slWearableNightSheet(sheet) {
  const d=slState().data,w=slWearable(d),list=[w.latestNight,...w.month?.history||[],...w.twoWeeks?.history||[],...w.week?.history||[]];
  const n=list.find(n=>n?.day===sheet.day);
  return {title:`Ночь на ${slDate(sheet.day)}`,body:n?`<div class="sl-wearable-detail">${slNightCard(d,n)}</div>`:`<p class="section-note">Запись не найдена. Обновите данные сна.</p>`};
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
  const d=slState().data,day=sheet.day||d.today,have=(d.nights||[]).find(n=>n.day===day),lockedFull=have && have.source!=="device" && have.detail!=="quick";
  const full=lockedFull || sheet.detail==="full",busy=slState().pending;
  const v={...(have?.source === "device" ? {day:have.day} : have||{}),...(sheet.draft||{})},detailAttrs=full?"required":"disabled";
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
  if(action === "sl-period"){if(["week","twoWeeks","month"].includes(control.dataset.period)){s.wearPeriod=control.dataset.period;render();}return true;}
  if(action === "sl-detail"){if(s.pending)return true;slRememberNight(control.closest('form'));s.sheet.detail=control.dataset.detail;render();return true;}
  if(s.pending)return true;
  if (action === "sl-device") { slDeviceOpen(); return true; }
  if (action === "sl-device-action") { slDeviceDo(control.dataset.deviceAction); return true; }
  if (action === "sl-wearable-night") { s.sheet={kind:"wearable",day:control.dataset.day};s.sheetError="";render();return true; }
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

/** Плитка на «Плане»: последняя доступная запись браслета. */
function slHomeTile() {
  const s = slState();
  if (!s.data) { if (!s.loading && !s.error) slLoad(); return ""; }
  const d = s.data;
  const n=slWearable(d).latestNight,known=Number.isFinite(n?.device?.sleepMinutes);
  const title=n?`${known?"Сон":"Период записи"}: ${slDur(known?n.device.sleepMinutes:n.device?.intervalMinutes)}`:"Сон с браслета";
  const sub=n?`${slDate(n.day)} · ${slWearableClock(n.device?.startTime,d.timeZone)} → ${slWearableClock(n.device?.endTime,d.timeZone)}`:slDeviceSummary();
  return `<section class="section"><button type="button" class="en-home ${n?"done":""}" data-action="sl-home"><span class="en-step-ic">${icon("zzz", "icon-sm")}</span><span class="en-home-text"><small>Сон</small><b>${slEsc(title)}</b><span>${slEsc(sub)}</span></span>${icon("arrow", "icon-sm")}</button></section>`;
}

document.addEventListener("visibilitychange",()=>{const s=slState();if(!document.hidden&&ui.page==="sleep"&&!s.pending&&!s.sheet){slDeviceRead();slLoad();}});

