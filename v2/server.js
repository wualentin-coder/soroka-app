/*
 * «Сервер» — тот же сервер, что держит VPN, теперь и Flow: нагрузка, график
 * за сутки, службы и контейнеры, база, копии, журнал сторожа, действия и
 * пороги уведомлений. Данные отдаёт vpnctl на сервере (/api/server) через
 * мост `window.sorokaVpn`; без моста — демо, чтобы экран рисовался отдельно.
 */

function serverDemo() {
  const now = Math.floor(Date.now() / 1000);
  const history = Array.from({ length: 288 }, (_, i) => {
    const t = now - (287 - i) * 300, wave = Math.sin(i / 18) + 1;
    return [t, 3 + wave * 4 + (i % 37 === 0 ? 30 : 0), 0.95e9 + wave * 0.12e9, 0.2e9, 4e6 + wave * 3e7, 3e6 + wave * 2.5e7];
  });
  const box = (service, title, mem, limit) => ({ service, title, state: "running", status: "Up 3 hours", health: service === "db" ? "healthy" : "", cpu: 0.4, mem, limit });
  return {
    time: now,
    host: { cpu: 4.1, cpus: 2, load: [0.05, 0.08, 0.1], uptime_s: 86400 * 2 + 3600 * 5, mem_total: 2.06e9, mem_used: 1.1e9, swap_total: 3.2e9, swap_used: 0.2e9, disk_total: 61e9, disk_used: 10.4e9 },
    history,
    services: { xray: { active: true, uptime_s: 86400 }, nginx: { active: true, uptime_s: 86400 }, vpnctl: { active: true, uptime_s: 3600 }, docker: { active: true, uptime_s: 86400 } },
    containers: [box("db", "База данных", 130e6, 440e6), box("rest", "REST API", 32e6, 84e6), box("storage", "Файлы", 105e6, 268e6), box("functions", "Функции Flow", 260e6, 629e6), box("gw", "Шлюз", 10e6, 33e6)],
    db: { ok: true, size: 36.6e6, cron_ok: 60, cron_failed: 0, cron_last: now - 20, worker_ok: 60, worker_failed: 0 },
    functions: { count: 0, last: [] },
    storage_size: 154e6,
    backups: { files: [{ name: "db-2026-10-08.dump", size: 5.4e6, time: now - 3600 * 5 }, { name: "storage-2026-10-07.tgz", size: 121e6, time: now - 86400 }], count: 2, total: 126e6, running: false },
    events: [{ time: now - 7200, text: "Функции Flow перезапущены из приложения" }],
    settings: { ALERTS: 1, MEM_ALERT_MB: 150, DISK_ALERT_PCT: 85, BACKUP_DAYS: 14 }
  };
}

function serverCall(op, payload = {}) {
  if (typeof window.sorokaVpn === "function") return window.sorokaVpn(op, payload);
  return new Promise(done => setTimeout(() => done(op === "server" ? serverDemo() : op === "server-settings" ? { ...serverDemo().settings, ...payload } : { started: payload.op }), 300));
}

function serverLoad(force = false) {
  ui.server ||= { state: "idle", chart: "cpu" };
  const fresh = ui.server.data && Date.now() - ui.server.at < 20000;
  if (ui.server.state === "loading" || (fresh && !force)) return;
  ui.server.state = "loading";
  serverCall("server").then(answer => {
    if (answer?.error) throw new Error(answer.error);
    ui.server = { ...ui.server, state: "ready", data: answer, at: Date.now(), error: "" };
  }).catch(error => {
    ui.server = { ...ui.server, state: "error", error: String(error?.message || error) };
  }).finally(() => { if (ui.page === "server") render(); });
}

const serverPct = (used, total) => total ? Math.round(used / total * 100) : 0;
const serverTime = ts => new Date(ts * 1000).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

function serverAgo(ts) {
  if (!ts) return "—";
  const min = Math.round((Date.now() / 1000 - ts) / 60);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${word(h, "час", "часа", "часов")} назад`;
  const d = Math.round(h / 24);
  return `${d} ${word(d, "день", "дня", "дней")} назад`;
}

/** Что сейчас не так — коротко, для шапки; пусто — всё в порядке. */
function serverProblems(d) {
  const p = [];
  if (!d.services.xray?.active) p.push("VPN остановлен");
  if (!d.services.nginx?.active) p.push("nginx остановлен");
  const down = d.containers.filter(c => c.state !== "running").map(c => c.title);
  if (down.length) p.push(`не работает: ${down.join(", ")}`);
  if (!d.db.ok) p.push("база не отвечает");
  else if (d.db.cron_failed || d.db.worker_failed) p.push("worker ошибается");
  const free = (d.host.mem_total - d.host.mem_used) / 1e6;
  if (free < d.settings.MEM_ALERT_MB) p.push(`мало памяти: ${Math.round(free)} МБ`);
  if (serverPct(d.host.disk_used, d.host.disk_total) > d.settings.DISK_ALERT_PCT) p.push("диск почти заполнен");
  return p;
}

function serverKpi(label, value, hint, pct) {
  const bar = pct === null ? "" : `<div class="progress-track"><span style="width:${Math.min(100, pct)}%;background:${pct > 85 ? "var(--warn)" : "var(--accent)"}"></span></div>`;
  return `<div class="kpi server-kpi"><span class="kpi-label">${label}</span><span class="kpi-value">${value}</span>${bar}<span class="kpi-hint">${hint}</span></div>`;
}

/** График за сутки: площадь под линией, подписи — максимум и время по краям. */
function serverChart(d) {
  const kind = ui.server.chart || "cpu";
  const h = d.history || [];
  const tabs = [["cpu", "Процессор"], ["mem", "Память"], ["net", "Сеть"]];
  const seg = `<div class="segmented server-chart-tabs" role="group" aria-label="Что показать">${tabs.map(([k, l]) => `<button type="button" class="${kind === k ? "active" : ""}" data-action="server-chart" data-value="${k}" aria-pressed="${kind === k}">${l}</button>`).join("")}</div>`;
  if (h.length < 2) return cardSection("За сутки", `<div class="side-card"><p class="section-note">История копится: первая точка появится через 5 минут, полные сутки — завтра.</p></div>`, "", seg);
  const values = h.map(p => kind === "cpu" ? p[1] : kind === "mem" ? p[2] / 1e6 : (p[4] + p[5]) / 300 / 1e6 * 8);
  const top = kind === "cpu" ? Math.max(10, ...values) : kind === "mem" ? d.host.mem_total / 1e6 : Math.max(1, ...values);
  const W = 600, H = 140;
  const pts = values.map((v, i) => [i / (values.length - 1) * W, H - Math.min(1, v / top) * (H - 8)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const unit = kind === "cpu" ? "%" : kind === "mem" ? " МБ" : " Мбит/с";
  const fmt = v => kind === "net" ? v.toFixed(v < 10 ? 1 : 0).replace(".", ",") : Math.round(v);
  const peak = Math.max(...values), avg = values.reduce((a, b) => a + b, 0) / values.length;
  const chart = `<svg class="server-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${tabs.find(t => t[0] === kind)[1]} за сутки"><path d="${line}L${W},${H}L0,${H}Z" class="server-chart-area"/><path d="${line}" class="server-chart-line" vector-effect="non-scaling-stroke"/></svg>`;
  const legend = `<div class="server-chart-axis"><span>${serverTime(h[0][0])}</span><span>сейчас</span></div><div class="side-row"><span>В среднем</span><b>${fmt(avg)}${unit}</b></div><div class="side-row"><span>Пик</span><b>${fmt(peak)}${unit}</b></div>${kind === "mem" ? `<div class="side-row"><span>Шкала</span><b>до ${Math.round(top)} МБ</b></div>` : ""}`;
  return cardSection("За сутки", `<div class="side-card server-chart-card">${chart}${legend}</div>`, "", seg);
}

function serverServiceRow(title, hint, ok, extra = "") {
  return `<div class="list-row server-row"><span class="list-copy"><strong><i class="vpn-dot ${ok ? "on" : "off"}"></i>${esc(title)}</strong><span>${esc(hint)}</span></span>${extra}</div>`;
}

/** «Up About an hour (healthy)» → «работает 1 ч · проверка пройдена». */
function serverDockerUp(c) {
  const m = /^Up (?:About )?(an?|less than a|\d+) (second|minute|hour|day|week|month)/i.exec(c.status || "");
  const units = { second: "с", minute: "мин", hour: "ч", day: "дн", week: "нед", month: "мес" };
  const n = !m ? "" : /^\d+$/.test(m[1]) ? m[1] : m[1].startsWith("less") ? "<1" : "1";
  const up = m ? `работает ${n} ${units[m[2].toLowerCase()]}` : "работает";
  return c.health === "healthy" ? `${up} · проверка пройдена` : c.health === "unhealthy" ? `${up} · не проходит проверку` : up;
}

function serverUptime(s) {
  if (s === null || s === undefined) return "";
  return `работает ${vpnUptime(s)}`;
}

function renderServerPage() {
  serverLoad();
  const s = ui.server || {};
  const top = header("Сервер", "Flow и VPN на одной машине", "Нидерланды");
  if (!s.data) {
    return `${top}${s.state === "error"
      ? `<div class="state-card"><h2>Сервер не ответил</h2><p>${esc(s.error || "Нет связи со службой управления.")}</p><button class="primary-button" type="button" data-action="server-refresh">Повторить</button></div>`
      : `<div class="state-card"><h2>Загружаю…</h2><p>Спрашиваю сервер о нагрузке и службах.</p></div>`}`;
  }
  const d = s.data, h = d.host;
  const problems = serverProblems(d);
  const status = `<div class="vpn-status ${problems.length ? "down" : "ok"}"><div><small>${h.cpus} ${word(h.cpus, "ядро", "ядра", "ядер")} · ${vpnBytes(h.mem_total)} · на ${serverTime(d.time)}</small><strong>${problems.length ? "Есть проблемы" : "Всё работает"}</strong><p>${problems.length ? esc(problems.join(" · ")) : `без перезагрузки ${vpnUptime(h.uptime_s)}`}</p></div><button class="small-button" type="button" data-action="server-refresh">${icon("reset", "icon-sm")}Обновить</button></div>`;
  const memPct = serverPct(h.mem_used, h.mem_total), diskPct = serverPct(h.disk_used, h.disk_total), swapPct = serverPct(h.swap_used, h.swap_total);
  const kpis = `<div class="kpi-grid server-kpis">${serverKpi("Процессор", `${Math.round(h.cpu)}%`, `нагрузка ${h.load[0].toFixed(2).replace(".", ",")}`, h.cpu)}${serverKpi("Память", `${memPct}%`, `${vpnBytes(h.mem_used)} из ${vpnBytes(h.mem_total)}`, memPct)}${serverKpi("Подкачка", `${swapPct}%`, `${vpnBytes(h.swap_used)} из ${vpnBytes(h.swap_total)}`, swapPct)}${serverKpi("Диск", `${diskPct}%`, `свободно ${vpnBytes(h.disk_total - h.disk_used)}`, diskPct)}</div>`;

  const sv = d.services;
  const memBar = c => c.limit ? `<span class="server-mem"><b>${vpnBytes(c.mem)}</b><small>из ${vpnBytes(c.limit)}</small></span>` : "";
  const services = cardSection("Службы", `<div class="list-panel">${serverServiceRow("VPN", serverUptime(sv.xray?.uptime_s) || "остановлен", sv.xray?.active)}${serverServiceRow("Веб-сервер nginx", serverUptime(sv.nginx?.uptime_s) || "остановлен", sv.nginx?.active)}${serverServiceRow("Управление сервером", serverUptime(sv.vpnctl?.uptime_s), sv.vpnctl?.active)}${d.containers.map(c => serverServiceRow(c.title, c.state === "running" ? serverDockerUp(c) : `остановлен (${c.state})`, c.state === "running", memBar(c))).join("")}</div>`);

  const db = d.db;
  const workerHint = !db.ok ? "база не отвечает" : `${db.worker_ok} из ${db.worker_ok + db.worker_failed} за час${db.cron_last ? ` · ${serverAgo(db.cron_last)}` : ""}`;
  const flow = cardSection("Flow", `<div class="side-card"><div class="side-row"><span>База данных</span><b>${db.ok ? vpnBytes(db.size) : "—"}</b></div><div class="side-row"><span>Файлы</span><b>${vpnBytes(d.storage_size)}</b></div><div class="side-row"><span>Фоновые задачи</span><b class="${db.worker_failed ? "server-bad" : ""}">${esc(workerHint)}</b></div><div class="side-row"><span>Ошибки функций за час</span><b class="${d.functions.count ? "server-bad" : ""}">${d.functions.count || "нет"}</b></div>${d.functions.last.length ? `<p class="side-note server-log">${d.functions.last.map(esc).join("<br>")}</p>` : ""}</div>`);

  const b = d.backups, last = b.files.find(f => f.name.startsWith("db-"));
  const backups = cardSection("Копии", `<div class="side-card"><div class="side-row"><span>Последняя копия базы</span><b>${last ? `${serverAgo(last.time)} · ${vpnBytes(last.size)}` : "ещё не было"}</b></div><div class="side-row"><span>Всего копий</span><b>${b.count} · ${vpnBytes(b.total)}</b></div><div class="side-row"><span>Хранятся</span><b>${d.settings.BACKUP_DAYS} ${word(d.settings.BACKUP_DAYS, "день", "дня", "дней")}</b></div><p class="side-note">Каждую ночь в 3:30 — база, раз в неделю — файлы.</p><button class="ghost-button server-wide" type="button" data-action="server-run" data-op="backup" ${b.running ? "disabled" : ""}>${icon("download", "icon-sm")}${b.running ? "Копия делается…" : "Сделать копию сейчас"}</button></div>`);

  const ev = d.events;
  const events = cardSection("Журнал сторожа", ev.length ? `<div class="list-panel">${ev.slice(0, 8).map(e => `<div class="list-row server-row"><span class="list-copy"><strong>${esc(e.text)}</strong><span>${serverAgo(e.time)} · ${new Date(e.time * 1000).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span></div>`).join("")}</div>` : `<div class="side-card"><p class="side-note">Сторож проверяет VPN и Flow каждую минуту. Пока ему ничего не пришлось чинить.</p></div>`);

  const act = (op, title, hint) => `<button class="list-row server-action" type="button" data-action="server-run" data-op="${op}"><span class="list-copy"><strong>${title}</strong><span>${hint}</span></span>${icon("right", "icon-sm")}</button>`;
  const actions = cardSection("Действия", `<div class="list-panel">${act("restart-functions", "Перезапустить функции Flow", "Если бот или приложение подвисли. 5–10 секунд")}${act("restart-flow", "Перезапустить Flow целиком", "База, файлы и функции. До минуты без Flow, VPN работает")}${act("reload-nginx", "Перечитать настройки nginx", "Без разрыва соединений")}${act("prune-images", "Удалить старые образы", "Освобождает место на диске после обновлений")}</div><p class="section-note">Перезапуск VPN — в разделе VPN.</p>`);

  const st = d.settings;
  const chips = (key, values, unit) => `<div class="server-chips">${values.map(v => `<button type="button" class="map-category-chip ${st[key] === v ? "active" : ""}" data-action="server-set" data-key="${key}" data-value="${v}" aria-pressed="${st[key] === v}">${v}${unit}</button>`).join("")}</div>`;
  const settings = cardSection("Настройки", `<div class="list-panel"><div class="list-row server-row"><span class="list-copy"><strong>Сообщать в бот</strong><span>Когда сторож что-то чинит или ресурсов мало</span></span><label class="switch"><input type="checkbox" data-server-alerts ${st.ALERTS ? "checked" : ""}><span></span></label></div><div class="server-setting"><span>Предупреждать, когда свободной памяти меньше</span>${chips("MEM_ALERT_MB", [100, 150, 250, 400], " МБ")}</div><div class="server-setting"><span>Предупреждать, когда диск заполнен больше</span>${chips("DISK_ALERT_PCT", [80, 85, 90, 95], "%")}</div><div class="server-setting"><span>Хранить копии</span>${chips("BACKUP_DAYS", [7, 14, 30], " дн")}</div></div>`);

  return `${top}<div class="content-grid"><div class="content-main">${status}${kpis}${serverChart(d)}${services}${flow}${backups}${events}${actions}${settings}</div></div>`;
}

const SERVER_CONFIRM = {
  "restart-functions": "Перезапустить функции Flow? Бот и приложение замолчат на 5–10 секунд.",
  "restart-flow": "Перезапустить Flow целиком? До минуты бот и приложение не будут отвечать. VPN продолжит работать.",
  "prune-images": "Удалить неиспользуемые образы Docker? Работающее не пострадает."
};
const SERVER_DONE = {
  "restart-functions": "Перезапускаю функции — через 10 секунд обновите",
  "restart-flow": "Перезапускаю Flow — через минуту обновите",
  backup: "Делаю копию — займёт около минуты",
  "reload-nginx": "nginx перечитал настройки",
  "prune-images": "Удаляю старые образы"
};

function serverAction(action, control) {
  if (!action.startsWith("server-")) return false;
  if (action === "server-refresh") { serverLoad(true); render(); return true; }
  if (action === "server-chart") { ui.server.chart = control.dataset.value; render(); return true; }
  if (action === "server-run") {
    const op = control.dataset.op;
    if (SERVER_CONFIRM[op] && !window.confirm(SERVER_CONFIRM[op])) return true;
    serverCall("server-action", { op }).then(answer => {
      if (answer?.error) throw new Error(answer.error);
      toast(SERVER_DONE[op] || "Готово");
      setTimeout(() => serverLoad(true), op === "backup" ? 60000 : 12000);
    }).catch(error => toast(`Не получилось: ${String(error?.message || error).slice(0, 80)}`));
    return true;
  }
  if (action === "server-set") {
    serverSave({ [control.dataset.key]: Number(control.dataset.value) });
    return true;
  }
  return false;
}

function serverSave(patch) {
  const d = ui.server?.data;
  if (d) { d.settings = { ...d.settings, ...patch }; render(); }
  serverCall("server-settings", patch).then(answer => {
    if (answer?.error) throw new Error(answer.error);
    if (ui.server?.data) { ui.server.data.settings = answer; render(); }
  }).catch(error => { toast(`Не сохранилось: ${String(error?.message || error).slice(0, 80)}`); serverLoad(true); });
}

document.addEventListener("change", event => {
  if (!event.target.matches?.("[data-server-alerts]")) return;
  serverSave({ ALERTS: event.target.checked ? 1 : 0 });
});
