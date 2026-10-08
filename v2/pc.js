/*
 * «Компьютер» — домашний ПК: включить (ESP32 по сети), выключить, загрузка,
 * тяжёлые процессы, скриншот. Команды идут через Flow: ПК и ESP32 сами
 * забирают их (soroka-pc), поэтому ответ приходит за несколько секунд.
 * Без моста — демо, чтобы экран рисовался отдельно.
 */

function pcCall(payload) {
  if (typeof window.sorokaPc === "function") return window.sorokaPc(payload);
  return new Promise(done => setTimeout(() => {
    if (payload.op === "state") done({ on: true, agent: true, hub: true, status: { cpu_percent: 7, memory_percent: 64, gpu_percent: 11, uptime_seconds: 83616, active_user: "Administrator" } });
    else if (payload.op === "send") done({ id: Date.now(), target: "agent" });
    else done({ status: "done", cmd: ui.pc?.pending?.cmd, result: ui.pc?.pending?.cmd === "processes" ? { processes: [{ pid: 4412, name: "houdini.exe", cpu_percent: 38.5, memory_percent: 21 }, { pid: 920, name: "chrome.exe", cpu_percent: 6.1, memory_percent: 9 }] } : { cpu_percent: 9, memory_percent: 63, gpu_percent: 14, uptime_seconds: 84000, active_user: "Administrator" } });
  }, 400));
}

function pcLoad(force = false) {
  ui.pc ||= { state: "idle" };
  const fresh = ui.pc.data && Date.now() - ui.pc.at < 15000;
  if (ui.pc.loading || (fresh && !force)) return;
  ui.pc.loading = true;
  pcCall({ op: "state" }).then(answer => {
    if (answer?.error) throw new Error(answer.error);
    ui.pc = { ...ui.pc, data: answer, at: Date.now(), error: "" };
  }).catch(error => { ui.pc = { ...ui.pc, error: String(error?.message || error) }; })
    .finally(() => { ui.pc.loading = false; if (ui.page === "pc") render(); });
}

const pcPct = v => `${Math.round(Number(v) || 0)}%`;
function pcUptime(s) {
  s = Number(s) || 0;
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return d ? `${d} д ${h} ч` : h ? `${h} ч ${m} мин` : `${m} мин`;
}

function pcStatusKpis(st) {
  if (!st) return "";
  const k = (label, value, hint) => `<div class="kpi"><span class="kpi-label">${label}</span><span class="kpi-value">${value}</span>${hint ? `<span class="kpi-hint">${hint}</span>` : ""}</div>`;
  return `<div class="kpi-grid pc-kpis">${k("Процессор", pcPct(st.cpu_percent))}${k("Память", pcPct(st.memory_percent))}${k("Видеокарта", pcPct(st.gpu_percent))}${k("Работает", pcUptime(st.uptime_seconds), st.active_user ? esc(st.active_user) : "")}</div>`;
}

function pcResult() {
  const r = ui.pc?.last;
  const p = ui.pc?.pending;
  if (p?.cmd === "on") return pcBootCard(p);
  if (p?.cmd === "off" || p?.cmd === "sleep") return pcOffCard(p);
  if (p) return `<div class="state-card pc-wait"><span class="live-spin"></span><p>${p.cmd === "screenshot" ? "Делаю скриншот…" : "Спрашиваю компьютер…"}</p></div>`;
  if (!r) return "";
  if (r.cmd === "pc_on" && r.status === "done") return `<div class="state-card pc-boot pc-boot-done"><div class="pc-power"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="pc-check" d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><div><h2>Компьютер включился</h2><p>За ${esc(r.result?.seconds ?? "")} с · уведомление отправлено в чат с ботом</p></div></div>`;
  if (r.status === "failed" || r.status === "expired") return `<div class="state-card"><p>${esc(r.result?.message || (r.status === "expired" ? "Компьютер не забрал команду" : "Не получилось"))}</p></div>`;
  if (r.cmd === "status") return cardSection("Загрузка", pcStatusKpis(r.result));
  if (r.cmd === "processes") {
    const list = r.result?.processes || [];
    return cardSection("Больше всего грузят", `<div class="list-panel">${list.slice(0, 10).map(x => `<div class="list-row pc-proc"><span class="list-copy"><strong>${esc(x.name)}</strong><span>процессор ${pcPct(x.cpu_percent)} · память ${pcPct(x.memory_percent)} · PID ${esc(x.pid)}</span></span><button type="button" class="text-action" data-action="pc-kill" data-pid="${esc(x.pid)}" data-name="${esc(x.name)}">Завершить</button></div>`).join("")}</div>`);
  }
  if (r.cmd === "screenshot" && r.image) return cardSection("Скриншот", `<button type="button" class="pc-shot" data-action="pc-shot-open"><img src="${r.image}" alt="Экран компьютера"></button><p class="section-note">Он же отправлен в чат с ботом. Нажмите, чтобы открыть крупно.</p>`);
  if (["off", "pc_off", "sleep"].includes(r.cmd) && r.status === "done") return `<div class="state-card pc-boot pc-off-done"><div class="pc-power"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="pc-moon" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg></div><div><h2>${r.cmd === "sleep" ? "Компьютер уснул" : "Компьютер выключился"}</h2><p>За ${esc(r.result?.seconds ?? "")} с · уведомление отправлено в чат с ботом</p></div></div>`;
  if (r.status === "cancelled") return `<div class="state-card"><p>Отменено — компьютер работает дальше.</p></div>`;
  if (["kill", "off", "sleep", "cancel", "lock", "volume", "open"].includes(r.cmd)) return `<div class="state-card"><p>${esc(r.result?.message || "Готово")}</p></div>`;
  return "";
}

function renderPcPage() {
  pcLoad();
  const d = ui.pc?.data;
  const top = header("Компьютер", "Домашний ПК через Flow", "Дом");
  if (!d) return `${top}<div class="state-card"><h2>${ui.pc?.error ? "Нет связи" : "Загружаю…"}</h2><p>${esc(ui.pc?.error || "Спрашиваю, включён ли компьютер.")}</p>${ui.pc?.error ? `<button class="primary-button" type="button" data-action="pc-refresh">Повторить</button>` : ""}</div>`;
  const on = d.on === true, off = d.on === false;
  const line = on ? (d.agent ? "Включён, агент на связи" : "Включён") : off ? "Выключен" : "Неизвестно — ESP32 давно не выходила на связь";
  const hub = d.hub ? "ESP32 на связи — можно включить по сети" : "ESP32 не на связи — включить по сети не получится";
  const status = `<div class="vpn-status ${on ? "ok" : "down"}"><div><small>${esc(hub)}</small><strong>${on ? "Работает" : off ? "Выключен" : "Нет данных"}</strong><p>${esc(line)}</p></div><button class="small-button" type="button" data-action="pc-refresh">${icon("reset", "icon-sm")}Обновить</button></div>`;
  const busy = Boolean(ui.pc.pending);
  const lock = (need) => busy || (need === "agent" && !d.agent) || (need === "hub" && !d.hub) ? "disabled" : "";
  const b = (cmd, label, cls = "", need = "agent", action = "pc-send") => `<button type="button" class="pc-btn ${cls}" data-action="${action}" data-cmd="${cmd}" ${lock(need)}>${label}</button>`;
  const pad = `<div class="pc-pad">${b("on", "Включить ПК", "pc-on", "hub")}${b("off", "Выключить", "pc-off", "any", "pc-power")}${b("sleep", "Сон", "pc-sleep", "agent", "pc-power")}${b("status", "Статус")}${b("processes", "Процессы")}${b("screenshot", "Скриншот", "pc-wide")}</div>`;
  const note = !d.agent && on ? `<p class="section-note">Компьютер включён, но агент Flow на нём не запущен — статус и скриншот недоступны.</p>` : "";
  return `${top}<div class="content-grid"><div class="content-main">${status}${pcPowerCountdown(d)}${pad}${note}${pcResult()}${d.agent ? pcRenderBlock(d) + pcControls(busy) : ""}${!ui.pc.last && d.status ? cardSection("Последний статус", pcStatusKpis(d.status)) : ""}</div></div>`;
}

const pcClock = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };

/** Отложенное выключение/сон: отсчёт и «Отмена». Время — от сервера, тикает на месте. */
function pcPowerCountdown(d) {
  const p = d.power;
  if (!p?.at || ui.pc.pending) return "";
  const left = (Date.parse(p.at) - Date.now()) / 1000;
  const what = p.cmd === "sleep" ? "Усну" : "Выключусь";
  return `<div class="state-card pc-boot pc-off pc-countdown" data-at="${esc(p.at)}" data-what="${what}"><div class="pc-power pc-power-off"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/></svg></div><div><h2>${what} через <span class="pc-left">${pcClock(left)}</span></h2><p>На экране компьютера тоже есть окно с «Отменой».</p><button type="button" class="primary-button" data-action="pc-cancel">Отменить</button></div></div>`;
}
setInterval(() => {
  const card = document.querySelector(".pc-countdown");
  if (!card) return;
  const left = (Date.parse(card.dataset.at) - Date.now()) / 1000;
  const span = card.querySelector(".pc-left");
  if (span) span.textContent = pcClock(left);
  if (left < -5 && !ui.pc?.loading) pcLoad(true);
}, 1000);

/** Рендер After Effects / Media Encoder: идёт ли и что сделать после. */
function pcRenderBlock(d) {
  const r = d.render || {};
  const then = r.then || "notify";
  const opt = (value, label) => `<button type="button" class="segment ${then === value ? "active" : ""}" data-action="pc-after" data-then="${value}" aria-pressed="${then === value}">${label}</button>`;
  const mins = r.since ? Math.round((Date.now() / 1000 - r.since) / 60) : 0;
  const line = r.rendering ? `<p class="pc-render-now"><span class="pc-render-dot"></span>Рендерит ${esc(r.app || "After Effects")} · ${mins} мин</p>`
    : r.done_at ? `<p class="section-note">Последний рендер закончился ${esc(new Date(r.done_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}, шёл ${Math.round((r.seconds || 0) / 60)} мин.</p>`
      : `<p class="section-note">Рендер замечу сам — по нагрузке After Effects, aerender или Media Encoder дольше 3 минут.</p>`;
  return cardSection("После рендера", `${line}<div class="segmented pc-after">${opt("notify", "Сообщить")}${opt("off", "Выключить")}${opt("sleep", "Сон")}</div><p class="section-note">Перед выключением будет минута на «отмену» — в чате и окном на экране.</p>`);
}

/** Мелочи: экран, звук, ссылка. */
function pcControls(busy) {
  const k = (key, label) => `<button type="button" class="pc-btn" data-action="pc-volume" data-key="${key}" ${busy ? "disabled" : ""}>${label}</button>`;
  return cardSection("Управление", `<div class="pc-pad pc-pad-3"><button type="button" class="pc-btn" data-action="pc-send" data-cmd="lock" ${busy ? "disabled" : ""}>Заблокировать</button>${k("mute", "Без звука")}${k("play", "Пауза / play")}${k("down", "Тише")}${k("up", "Громче")}${k("next", "След. трек")}</div><form class="pc-open" data-action="pc-open-form"><input id="pc-url" type="url" inputmode="url" placeholder="Ссылка — откроется на компьютере" autocomplete="off"><button type="button" class="small-button" data-action="pc-open">Открыть</button></form><p class="section-note">Файл на компьютер — пришлите боту с подписью «на комп», он сохранит его в «Загрузки\\Flow». С компьютера — «скинь D:\\путь\\к\\файлу».</p>`);
}

/** Выключить / усыпить: сейчас или через время. */
function renderPcPowerSheet() {
  const cmd = ui.sheet.cmd === "sleep" ? "sleep" : "off";
  const opts = [[0, "Сейчас"], [600, "Через 10 мин"], [1800, "Через 30 мин"], [3600, "Через час"], [7200, "Через 2 часа"]];
  const list = opts.map(([s, label]) => `<button type="button" class="pc-btn ${s ? "" : cmd === "off" ? "pc-off" : "pc-sleep"}" data-action="pc-power-go" data-cmd="${cmd}" data-delay="${s}">${label}</button>`).join("");
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${cmd === "sleep" ? "Усыпить компьютер" : "Выключить компьютер"}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><p class="section-note">${cmd === "sleep" ? "Открытые программы останутся как есть, проснётся за несколько секунд." : "Программы с несохранённой работой могут не дать выключиться — тогда придёт сообщение."} Отложенное можно отменить.</p><div class="pc-pad">${list}</div></section></div>`;
}

/** Скриншот крупно: листается и масштабируется пальцами. */
function renderPcShotSheet() {
  const img = ui.pc?.last?.image || "";
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet pc-shot-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Экран компьютера</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><div class="pc-shot-zoom"><img src="${img}" alt="Экран компьютера"></div></section></div>`;
}

/** Включение: шаги загрузки и ход времени, пока сервер не скажет «включился». */
function pcBootCard(p) {
  const sec = Math.max(0, Math.round((Date.now() - p.started) / 1000));
  const step = p.status === "taken" ? (sec > 20 ? 2 : 1) : 0;
  const steps = ["Сигнал отправлен", "ESP32 будит компьютер", "Windows загружается"];
  const list = steps.map((s, i) => `<li class="${i < step ? "done" : i === step ? "now" : ""}">${s}</li>`).join("");
  const resent = p.resent ? ` · сигнал повторён ${p.resent}×` : "";
  return `<div class="state-card pc-boot"><div class="pc-power pc-power-on"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/></svg></div><div><h2>Включаю компьютер</h2><ol class="pc-steps">${list}</ol><p class="pc-boot-time">${sec} с${resent}</p></div></div>`;
}

/** Выключение: от «команда ушла» до «ПК погас» — пока сервер не увидит, что агент замолчал. */
function pcOffCard(p) {
  const sec = Math.max(0, Math.round((Date.now() - p.started) / 1000));
  const sleep = p.cmd === "sleep";
  const step = p.stage === "shutting" || p.target === "hub" && p.status === "taken" ? 2 : p.status === "taken" ? 1 : 0;
  const steps = ["Команда отправлена", p.target === "hub" ? "ESP32 передаёт команду (отсрочка 30 с)" : "Компьютер принял команду", sleep ? "Windows засыпает" : "Windows завершает работу"];
  const list = steps.map((s, i) => `<li class="${i < step ? "done" : i === step ? "now" : ""}">${s}</li>`).join("");
  return `<div class="state-card pc-boot pc-off"><div class="pc-power pc-power-off"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/></svg></div><div><h2>${sleep ? "Усыпляю компьютер" : "Выключаю компьютер"}</h2><ol class="pc-steps">${list}</ol><p class="pc-boot-time">${sec} с</p></div></div>`;
}

function pcWait(id, cmd, tries = 0) {
  const boot = cmd === "on" || cmd === "off" || cmd === "sleep";
  pcCall({ op: "result", id }).then(r => {
    // Отложенное: ждать час с крутилкой незачем — дальше отсчёт рисует pcPowerCountdown.
    if ((cmd === "off" || cmd === "sleep") && Number(r?.result?.delay) > 0) {
      ui.pc.pending = null;
      toast(cmd === "sleep" ? "Усну по таймеру — можно отменить" : "Выключусь по таймеру — можно отменить");
      pcLoad(true);
      return;
    }
    const done = r && ["done", "failed", "expired", "cancelled"].includes(r.status);
    // Включение ждём до конца: сервер отметит команду, когда ПК выйдет на связь (до 4 минут).
    if (done || tries > (boot ? 140 : 25)) {
      ui.pc.pending = null;
      ui.pc.last = done ? r : { status: "failed", result: { message: cmd === "on" ? "Компьютер так и не вышел на связь" : cmd === "off" ? "Компьютер так и не выключился" : "Компьютер не ответил вовремя" } };
      if (boot && r?.status === "done") { toast(cmd === "on" ? "Компьютер включился" : cmd === "sleep" ? "Компьютер уснул" : "Компьютер выключился"); try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success"); } catch {} }
      if (boot) setTimeout(() => pcLoad(true), 500);
      if (ui.page === "pc") render();
      return;
    }
    if (boot && ui.pc.pending) {
      ui.pc.pending.status = r?.status;
      ui.pc.pending.resent = Number(r?.args?.resent) || 0;
      ui.pc.pending.stage = r?.result?.stage;
      // Тикают секунды — перерисовываем только карточку, а не весь экран.
      const card = document.querySelector(".pc-boot");
      if (card && ui.page === "pc") card.outerHTML = cmd === "on" ? pcBootCard(ui.pc.pending) : pcOffCard(ui.pc.pending);
    }
    setTimeout(() => pcWait(id, cmd, tries + 1), boot ? 1700 : 1500);
  }).catch(() => setTimeout(() => pcWait(id, cmd, tries + 1), 2500));
}

function pcSend(cmd, args = {}) {
  ui.pc.pending = { cmd, started: Date.now() };
  ui.pc.last = null;
  render();
  pcCall({ op: "send", cmd, args }).then(made => {
    if (made?.error) throw new Error(made.error);
    if (ui.pc.pending) ui.pc.pending.target = made.target;
    pcWait(made.id, cmd);
  }).catch(error => {
    ui.pc.pending = null;
    const m = String(error?.message || error);
    toast(m === "agent_offline" ? "Компьютер не на связи" : m === "pc_off" ? "Компьютер выключен" : m === "already_on" ? "Компьютер и так включён" : m === "nothing_to_cancel" ? "Отменять нечего" : m === "bad_url" ? "Нужна полная ссылка, с http" : `Не получилось: ${m.slice(0, 60)}`);
    render();
  });
}

function pcAction(action, control) {
  if (!action.startsWith("pc-")) return false;
  if (action === "pc-refresh") { pcLoad(true); render(); return true; }
  if (action === "pc-send") { pcSend(control.dataset.cmd); return true; }
  if (action === "pc-power") { ui.sheet = { kind: "pc-power", cmd: control.dataset.cmd, justRendered: false }; render(); return true; }
  if (action === "pc-power-go") {
    const cmd = control.dataset.cmd, delay = Number(control.dataset.delay) || 0;
    if (!delay && cmd === "off" && !window.confirm("Выключить компьютер сейчас? Несохранённая работа может пропасть.")) return true;
    ui.sheet = null;
    pcSend(cmd, { delay });
    return true;
  }
  if (action === "pc-cancel") { pcSend("cancel"); setTimeout(() => pcLoad(true), 2500); return true; }
  if (action === "pc-after") {
    const then = control.dataset.then;
    ui.pc.data.render = { ...(ui.pc.data.render || {}), then };
    pcSend("after_render", { then });
    return true;
  }
  if (action === "pc-volume") { pcSend("volume", { key: control.dataset.key }); return true; }
  if (action === "pc-open") {
    const url = (document.getElementById("pc-url")?.value || "").trim();
    if (!/^https?:\/\//i.test(url)) { toast("Нужна полная ссылка, с http"); return true; }
    pcSend("open", { url });
    return true;
  }
  if (action === "pc-kill") {
    if (!window.confirm(`Завершить «${control.dataset.name}»? Несохранённое в нём пропадёт.`)) return true;
    pcSend("kill", { pid: Number(control.dataset.pid) });
    return true;
  }
  if (action === "pc-shot-open") { if (ui.pc?.last?.image) { ui.sheet = { kind: "pc-shot", justRendered: false }; render(); } return true; }
  return false;
}
