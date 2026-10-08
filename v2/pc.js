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
  if (r.cmd === "kill" || r.cmd === "off") return `<div class="state-card"><p>${esc(r.result?.message || "Готово")}</p></div>`;
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
  const b = (cmd, label, cls = "", need = "agent") => `<button type="button" class="pc-btn ${cls}" data-action="pc-send" data-cmd="${cmd}" ${busy || (need === "agent" && !d.agent) || (need === "hub" && !d.hub) ? "disabled" : ""}>${label}</button>`;
  const pad = `<div class="pc-pad">${b("on", "Включить ПК", "pc-on", "hub")}${b("off", "Выключить ПК", "pc-off", "any")}${b("status", "Статус")}${b("processes", "Процессы")}${b("screenshot", "Скриншот")}</div>`;
  const note = !d.agent && on ? `<p class="section-note">Компьютер включён, но агент Flow на нём не запущен — статус и скриншот недоступны.</p>` : "";
  return `${top}<div class="content-grid"><div class="content-main">${status}${pad}${note}${pcResult()}${!ui.pc.last && d.status ? cardSection("Последний статус", pcStatusKpis(d.status)) : ""}</div></div>`;
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

function pcWait(id, cmd, tries = 0) {
  const boot = cmd === "on";
  pcCall({ op: "result", id }).then(r => {
    const done = r && ["done", "failed", "expired"].includes(r.status);
    // Включение ждём до конца: сервер отметит команду, когда ПК выйдет на связь (до 4 минут).
    if (done || tries > (boot ? 140 : 25)) {
      ui.pc.pending = null;
      ui.pc.last = done ? r : { status: "failed", result: { message: boot ? "Компьютер так и не вышел на связь" : "Компьютер не ответил вовремя" } };
      if (boot && r?.status === "done") { toast("Компьютер включился"); try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success"); } catch {} }
      if (boot || cmd === "off") setTimeout(() => pcLoad(true), boot ? 500 : 8000);
      if (ui.page === "pc") render();
      return;
    }
    if (boot && ui.pc.pending) {
      ui.pc.pending.status = r?.status;
      ui.pc.pending.resent = Number(r?.args?.resent) || 0;
      // Тикают секунды — перерисовываем только карточку, а не весь экран.
      const card = document.querySelector(".pc-boot");
      if (card && ui.page === "pc") card.outerHTML = pcBootCard(ui.pc.pending);
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
    pcWait(made.id, cmd);
  }).catch(error => {
    ui.pc.pending = null;
    const m = String(error?.message || error);
    toast(m === "agent_offline" ? "Компьютер не на связи" : m === "pc_off" ? "Компьютер выключен" : m === "already_on" ? "Компьютер и так включён" : `Не получилось: ${m.slice(0, 60)}`);
    render();
  });
}

function pcAction(action, control) {
  if (!action.startsWith("pc-")) return false;
  if (action === "pc-refresh") { pcLoad(true); render(); return true; }
  if (action === "pc-send") {
    const cmd = control.dataset.cmd;
    if (cmd === "off" && !window.confirm("Выключить компьютер? Несохранённая работа пропадёт.")) return true;
    pcSend(cmd);
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
