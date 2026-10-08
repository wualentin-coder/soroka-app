/*
 * «Компьютер» — домашний ПК: включить (ESP32 по сети), выключить и усыпить
 * (сразу или по таймеру), звук и музыка, загрузка, процессы, скриншот,
 * блокировка, что делать после рендера, ссылка на ПК. Команды идут через Flow:
 * ПК и ESP32 сами забирают их (soroka-pc), ответ приходит за несколько секунд.
 *
 * Долгие действия (включение, выключение, статус, скриншот) показывают карточку
 * с шагами и анимацией; быстрые (звук, плей, блокировка) — отклик на самой
 * кнопке, без лишних карточек. Без моста — демо, чтобы экран рисовался отдельно.
 */

function pcCall(payload) {
  if (typeof window.sorokaPc === "function") return window.sorokaPc(payload);
  return new Promise(done => setTimeout(() => {
    if (payload.op === "state") done({ on: true, agent: true, hub: true, render: { then: "notify" }, status: { cpu_percent: 7, memory_percent: 64, gpu_percent: 11, uptime_seconds: 83616, active_user: "Administrator" }, statusAt: new Date().toISOString() });
    else if (payload.op === "send") { pcDemo.last = payload; done({ id: Date.now(), target: "agent" }); }
    else {
      const p = pcDemo.last || {};
      if (p.cmd === "volume") { if (p.args?.level !== undefined) pcDemo.audio.level = p.args.level; if (p.args?.mute !== undefined) pcDemo.audio.muted = p.args.mute; done({ status: "done", cmd: "volume", result: { audio: { ...pcDemo.audio } } }); return; }
      done({ status: "done", cmd: p.cmd, result: p.cmd === "processes" ? { processes: [{ pid: 4412, name: "AfterFX.exe", cpu_percent: 38.5, memory_percent: 21 }, { pid: 920, name: "chrome.exe", cpu_percent: 6.1, memory_percent: 9 }] } : { cpu_percent: 9, memory_percent: 63, gpu_percent: 14, uptime_seconds: 84000, active_user: "Administrator" } });
    }
  }, 500));
}
const pcDemo = { last: null, audio: { level: 76, muted: false } };

// ------------------------------------------------------------ состояние

function pcLoad(force = false) {
  ui.pc ||= { state: "idle" };
  const fresh = ui.pc.data && Date.now() - ui.pc.at < 15000;
  if (ui.pc.loading || (fresh && !force)) return;
  ui.pc.loading = true;
  pcCall({ op: "state" }).then(answer => {
    if (answer?.error) throw new Error(answer.error);
    ui.pc = { ...ui.pc, data: answer, at: Date.now(), error: "" };
    // Громкость спрашиваем сами при открытии: ползунку нужно настоящее значение.
    if (answer.agent && (!ui.pc.audioAt || Date.now() - ui.pc.audioAt > 30000)) pcQuick("volume", {}, "audio");
  }).catch(error => { ui.pc = { ...ui.pc, error: String(error?.message || error) }; })
    .finally(() => { ui.pc.loading = false; if (ui.page === "pc") render(); });
}

// ------------------------------------------------------------ иконки

const PC_SVG = {
  power: '<path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  playPause: '<path d="M5 6v12l8-6z" class="fill"/><path d="M16 6v12"/><path d="M20 6v12"/>',
  next: '<path d="M6 6v12l9-6z" class="fill"/><path d="M18 6v12"/>',
  prev: '<path d="M18 6v12l-9-6z" class="fill"/><path d="M6 6v12"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>',
  muted: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6"/><path d="M22 9l-5 6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14"/><path d="M17 5v14"/><path d="M3 12h18"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
  x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
};
const pcIcon = (name, cls = "") => `<svg class="pc-ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PC_SVG[name] || ""}</svg>`;

const pcPct = v => `${Math.round(Number(v) || 0)}%`;
function pcUptime(s) {
  s = Number(s) || 0;
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return d ? `${d} д ${h} ч` : h ? `${h} ч ${m} мин` : `${m} мин`;
}
const pcClock = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };
function pcAgo(at) {
  if (!at) return "";
  const m = Math.round((Date.now() - Date.parse(at)) / 60000);
  return m < 1 ? "только что" : m < 60 ? `${m} мин назад` : `${Math.round(m / 60)} ч назад`;
}

// ------------------------------------------------------------ шапка: состояние и загрузка

function pcMeters(st, animate) {
  if (!st) return "";
  const bar = (label, v) => `<div class="pc-meter"><span>${label}</span><i><b style="--v:${Math.min(100, Math.max(0, Number(v) || 0))}%"></b></i><em>${pcPct(v)}</em></div>`;
  return `<div class="pc-meters ${animate ? "grow" : ""}">${bar("Процессор", st.cpu_percent)}${bar("Память", st.memory_percent)}${bar("Видеокарта", st.gpu_percent)}</div>`;
}

function pcHero(d) {
  const on = d.on === true, off = d.on === false;
  const mode = on ? "on" : off ? "off" : "unknown";
  const title = on ? "Работает" : off ? "Выключен" : "Нет данных";
  const st = d.status;
  const line = on ? [st?.uptime_seconds ? `работает ${pcUptime(st.uptime_seconds)}` : "", st?.active_user || ""].filter(Boolean).join(" · ") || (d.agent ? "агент на связи" : "агент Flow не запущен")
    : off ? "можно включить по сети" : "ESP32 давно не выходила на связь";
  const hub = d.hub ? "ESP32 на связи" : "ESP32 не на связи";
  const fresh = ui.pc.last?.cmd === "status" && ui.pc.last.status === "done";
  return `<section class="pc-hero ${mode}">
    <div class="pc-hero-top"><div class="pc-orb">${pcIcon(off ? "moon" : "power")}</div><div class="pc-hero-text"><strong>${title}</strong><span>${esc(line)}</span><small>${esc(hub)}${d.statusAt && on ? ` · данные ${esc(pcAgo(d.statusAt))}` : ""}</small></div><button class="icon-button pc-refresh ${ui.pc.loading ? "spin" : ""}" type="button" data-action="pc-refresh" aria-label="Обновить">${pcIcon("refresh")}</button></div>
    ${on ? pcMeters(fresh ? ui.pc.last.result : st, fresh) : ""}
  </section>`;
}

/** Включить — когда выключен; выключить и сон — когда работает. */
function pcPowerRow(d, busy) {
  const on = d.on === true;
  const btn = (cmd, label, icon, cls, action, enabled) => `<button type="button" class="pc-power-btn ${cls}" data-action="${action}" data-cmd="${cmd}" ${busy || !enabled ? "disabled" : ""}>${pcIcon(icon)}<span>${label}</span></button>`;
  if (!on) return `<div class="pc-power-row single">${btn("on", "Включить", "power", "go", "pc-send", d.hub)}</div>`;
  return `<div class="pc-power-row">${btn("off", "Выключить", "power", "off", "pc-power", true)}${btn("sleep", "Сон", "moon", "sleep", "pc-power", d.agent)}</div>`;
}

// ------------------------------------------------------------ карточки процесса (с анимацией)

/** Общая карточка «идёт действие»: иконка в кольце, шаги, секунды. */
function pcProgressCard({ icon, tone, title, steps, step, sec, extra = "" }) {
  const list = steps.map((s, i) => `<li class="${i < step ? "done" : i === step ? "now" : ""}">${s}</li>`).join("");
  return `<div class="state-card pc-boot pc-tone-${tone}"><div class="pc-power pc-ring">${pcIcon(icon)}</div><div><h2>${title}</h2><ol class="pc-steps">${list}</ol><p class="pc-boot-time">${sec} с${extra}</p></div></div>`;
}

function pcDoneCard(icon, tone, title, note) {
  return `<div class="state-card pc-boot pc-boot-done pc-tone-${tone}"><div class="pc-power pc-pop">${pcIcon(icon, "pc-draw")}</div><div><h2>${title}</h2>${note ? `<p>${note}</p>` : ""}</div></div>`;
}

function pcPendingCard(p) {
  const sec = Math.max(0, Math.round((Date.now() - p.started) / 1000));
  const taken = p.status === "taken";
  if (p.cmd === "on") {
    return pcProgressCard({ icon: "power", tone: "go", title: "Включаю компьютер", steps: ["Сигнал отправлен", "ESP32 будит компьютер", "Windows загружается"], step: taken ? (sec > 20 ? 2 : 1) : 0, sec, extra: p.resent ? ` · сигнал повторён ${p.resent}×` : "" });
  }
  if (p.cmd === "off" || p.cmd === "sleep") {
    const sleep = p.cmd === "sleep";
    const step = p.stage === "shutting" || (p.target === "hub" && taken) ? 2 : taken ? 1 : 0;
    return pcProgressCard({ icon: sleep ? "moon" : "power", tone: sleep ? "sleep" : "off", title: sleep ? "Усыпляю компьютер" : "Выключаю компьютер", steps: ["Команда отправлена", p.target === "hub" ? "ESP32 передаёт команду (отсрочка 30 с)" : "Компьютер принял команду", sleep ? "Windows засыпает" : "Windows завершает работу"], step, sec });
  }
  const what = { status: ["chart", "Смотрю загрузку", "Собираю цифры"], processes: ["list", "Ищу, что грузит", "Сортирую процессы"], screenshot: ["camera", "Делаю скриншот", "Снимаю экран и отправляю"], kill: ["x", "Завершаю процесс", "Закрываю"] }[p.cmd] || ["chart", "Спрашиваю компьютер", "Готовлю ответ"];
  return pcProgressCard({ icon: what[0], tone: "info", title: what[1], steps: ["Команда отправлена", "Компьютер принял", what[2]], step: taken ? (sec > 1 ? 2 : 1) : 0, sec });
}

function pcResult() {
  const r = ui.pc?.last;
  const p = ui.pc?.pending;
  if (p) return pcPendingCard(p);
  if (!r) return "";
  if (r.status === "cancelled") return pcDoneCard("check", "go", "Отменено", "Компьютер работает дальше.");
  if (r.status === "failed" || r.status === "expired") return `<div class="state-card pc-boot pc-error"><div class="pc-power pc-pop">${pcIcon("x")}</div><div><h2>Не получилось</h2><p>${esc(r.result?.message || (r.status === "expired" ? "Компьютер не забрал команду" : "Компьютер не ответил"))}</p></div></div>`;
  if (r.cmd === "pc_on" && r.status === "done") return pcDoneCard("check", "go", "Компьютер включился", `За ${esc(r.result?.seconds ?? "")} с · уведомление в чате с ботом`);
  if (["off", "pc_off", "sleep"].includes(r.cmd) && r.status === "done") return pcDoneCard("moon", "sleep", r.cmd === "sleep" ? "Компьютер уснул" : "Компьютер выключился", `За ${esc(r.result?.seconds ?? "")} с · уведомление в чате с ботом`);
  if (r.cmd === "status") return ""; // свежие цифры уже в шапке, с анимацией
  if (r.cmd === "processes") {
    const list = r.result?.processes || [];
    const max = Math.max(1, ...list.map(x => Number(x.cpu_percent) || 0));
    return cardSection("Больше всего грузят", `<div class="list-panel pc-procs">${list.slice(0, 10).map((x, i) => `<div class="list-row pc-proc" style="--i:${i}"><span class="list-copy"><strong>${esc(x.name)}</strong><span>процессор ${pcPct(x.cpu_percent)} · память ${pcPct(x.memory_percent)} · PID ${esc(x.pid)}</span><i class="pc-proc-bar"><b style="--v:${(Number(x.cpu_percent) || 0) / max * 100}%"></b></i></span><button type="button" class="text-action" data-action="pc-kill" data-pid="${esc(x.pid)}" data-name="${esc(x.name)}">Завершить</button></div>`).join("")}</div>`);
  }
  if (r.cmd === "screenshot" && r.image) return cardSection("Скриншот", `<button type="button" class="pc-shot pc-flash" data-action="pc-shot-open"><img src="${r.image}" alt="Экран компьютера"></button><p class="section-note">Он же отправлен в чат с ботом. Нажмите, чтобы открыть крупно.</p>`);
  if (r.cmd === "kill") return pcDoneCard("check", "go", "Процесс завершён", esc(r.result?.message || ""));
  return "";
}

// ------------------------------------------------------------ отсчёт выключения

function pcPowerCountdown(d) {
  const p = d.power;
  if (!p?.at || ui.pc.pending) return "";
  const left = (Date.parse(p.at) - Date.now()) / 1000;
  const sleep = p.cmd === "sleep";
  return `<div class="state-card pc-boot pc-countdown pc-tone-${sleep ? "sleep" : "off"}" data-at="${esc(p.at)}"><div class="pc-power pc-clock">${pcIcon(sleep ? "moon" : "power")}</div><div><h2>${sleep ? "Усну" : "Выключусь"} через <span class="pc-left">${pcClock(left)}</span></h2><p>На экране компьютера тоже есть окно с «Отменой».</p><button type="button" class="primary-button ${ui.pc.quick?.cancel || ""}" data-action="pc-cancel">Отменить</button></div></div>`;
}
setInterval(() => {
  const card = document.querySelector(".pc-countdown");
  if (!card) return;
  const left = (Date.parse(card.dataset.at) - Date.now()) / 1000;
  const span = card.querySelector(".pc-left");
  if (span) span.textContent = pcClock(left);
  if (left < -5 && !ui.pc?.loading) pcLoad(true);
}, 1000);

// ------------------------------------------------------------ звук и музыка

function pcMedia() {
  const a = ui.pc.audio;
  const q = key => ui.pc.quick?.[key] || "";
  const level = a ? a.level : 50;
  const muted = Boolean(a?.muted);
  const t = (key, icon, label, cls = "") => `<button type="button" class="pc-media-btn ${cls} ${q(key)}" data-action="pc-media" data-key="${key}" aria-label="${label}">${pcIcon(icon)}</button>`;
  return `<section class="pc-card pc-media">
    <div class="pc-card-head"><h3>${pcIcon("sound")}Звук и музыка</h3>${a ? "" : `<small class="pc-wait-dot">узнаю громкость…</small>`}</div>
    <div class="pc-volume ${muted ? "is-muted" : ""} ${q("level")}">
      <button type="button" class="pc-mute ${q("mute")}" data-action="pc-mute" aria-label="${muted ? "Включить звук" : "Выключить звук"}" aria-pressed="${muted}">${pcIcon(muted ? "muted" : "sound")}</button>
      <input class="pc-vol-range" type="range" min="0" max="100" step="1" value="${level}" style="--v:${level}%" aria-label="Громкость" ${a ? "" : "disabled"}>
      <b class="pc-vol-value">${muted ? "тихо" : `${level}%`}</b>
    </div>
    <div class="pc-transport">${t("prev", "prev", "Предыдущий трек")}${t("play", "playPause", "Пауза или воспроизведение", "main")}${t("next", "next", "Следующий трек")}</div>
  </section>`;
}

// ------------------------------------------------------------ действия, рендер, ссылка

function pcActions(busy) {
  const a = (cmd, icon, label, action = "pc-send") => `<button type="button" class="pc-action ${ui.pc.quick?.[cmd] || ""}" data-action="${action}" data-cmd="${cmd}" ${busy ? "disabled" : ""}>${pcIcon(icon)}<span>${label}</span></button>`;
  return `<div class="pc-actions">${a("status", "chart", "Загрузка")}${a("processes", "list", "Процессы")}${a("screenshot", "camera", "Скриншот")}${a("lock", "lock", "Блокировка", "pc-lock")}</div>`;
}

function pcRenderBlock(d) {
  const r = d.render || {};
  const then = r.then || "notify";
  const opt = (value, label) => `<button type="button" class="segment ${then === value ? "active" : ""} ${ui.pc.quick?.[`after-${value}`] || ""}" data-action="pc-after" data-then="${value}" aria-pressed="${then === value}">${label}</button>`;
  const mins = r.since ? Math.round((Date.now() / 1000 - r.since) / 60) : 0;
  const line = r.rendering ? `<p class="pc-render-now"><span class="pc-render-dot"></span>Рендерит ${esc(r.app || "After Effects")} · ${mins} мин</p>`
    : r.done_at ? `<p class="section-note">Последний рендер закончился ${esc(new Date(r.done_at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}, шёл ${Math.round((r.seconds || 0) / 60)} мин.</p>`
      : `<p class="section-note">Замечу сам: After Effects, aerender или Media Encoder грузят ПК дольше 3 минут.</p>`;
  return `<section class="pc-card ${r.rendering ? "pc-rendering" : ""}"><div class="pc-card-head"><h3>${pcIcon("film")}После рендера</h3></div>${line}<div class="segmented pc-after">${opt("notify", "Сообщить")}${opt("off", "Выключить")}${opt("sleep", "Сон")}</div><p class="section-note">Перед выключением — минута на «отмену» в чате и окном на экране.</p></section>`;
}

function pcLinkBlock() {
  return `<section class="pc-card"><div class="pc-card-head"><h3>${pcIcon("link")}Открыть на компьютере</h3></div><div class="pc-open"><input id="pc-url" type="url" inputmode="url" placeholder="https://…" autocomplete="off"><button type="button" class="small-button ${ui.pc.quick?.open || ""}" data-action="pc-open">Открыть</button></div><p class="section-note">Файл на компьютер — пришлите боту с подписью «на комп» (сохранит в «Загрузки\\Flow»). С компьютера — «скинь D:\\путь\\к\\файлу».</p></section>`;
}

function renderPcPage() {
  pcLoad();
  const d = ui.pc?.data;
  const top = header("Компьютер", "Домашний ПК через Flow", "Дом");
  if (!d) return `${top}<div class="content-grid"><div class="content-main pc-page"><section class="pc-hero unknown"><div class="pc-hero-top"><div class="pc-orb">${pcIcon("power")}</div><div class="pc-hero-text"><strong>${ui.pc?.error ? "Нет связи" : "Подключаюсь…"}</strong><span>${esc(ui.pc?.error || "Спрашиваю, включён ли компьютер")}</span></div></div>${ui.pc?.error ? `<button class="primary-button" type="button" data-action="pc-refresh">Повторить</button>` : ""}</section></div></div>`;
  const busy = Boolean(ui.pc.pending);
  const note = !d.agent && d.on ? `<p class="section-note">Компьютер включён, но агент Flow на нём не запущен — остальное недоступно.</p>` : "";
  const agentPart = d.agent ? `${pcActions(busy)}${pcResult()}${pcMedia()}${pcRenderBlock(d)}${pcLinkBlock()}` : pcResult();
  // Карточки «въезжают» только при входе на экран, а не на каждое нажатие.
  const enter = !ui.pc.entered;
  if (enter) setTimeout(() => { if (ui.pc) ui.pc.entered = true; }, 600);
  return `${top}<div class="content-grid"><div class="content-main pc-page ${enter ? "pc-enter" : ""}">${pcHero(d)}${pcPowerCountdown(d)}${pcPowerRow(d, busy)}${note}${agentPart}</div></div>`;
}

/** Скриншот крупно: листается и масштабируется пальцами. */
function renderPcShotSheet() {
  const img = ui.pc?.last?.image || "";
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet pc-shot-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Экран компьютера</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><div class="pc-shot-zoom"><img src="${img}" alt="Экран компьютера"></div></section></div>`;
}

/** Выключить / усыпить: сейчас или через время. */
function renderPcPowerSheet() {
  const cmd = ui.sheet.cmd === "sleep" ? "sleep" : "off";
  const opts = [[0, "Сейчас"], [600, "Через 10 мин"], [1800, "Через 30 мин"], [3600, "Через час"], [7200, "Через 2 часа"]];
  const list = opts.map(([s, label]) => `<button type="button" class="pc-btn ${s ? "" : cmd === "off" ? "pc-off" : "pc-sleep"}" data-action="pc-power-go" data-cmd="${cmd}" data-delay="${s}">${label}</button>`).join("");
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${cmd === "sleep" ? "Усыпить компьютер" : "Выключить компьютер"}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><p class="section-note">${cmd === "sleep" ? "Открытые программы останутся как есть, проснётся за несколько секунд." : "Программы с несохранённой работой могут не дать выключиться — тогда придёт сообщение."} Отложенное можно отменить.</p><div class="pc-pad">${list}</div></section></div>`;
}

// ------------------------------------------------------------ отправка

/** Долгое действие: карточка с шагами, пока сервер не отметит команду. */
function pcWait(id, cmd, tries = 0) {
  const power = cmd === "on" || cmd === "off" || cmd === "sleep";
  pcCall({ op: "result", id }).then(r => {
    // Отложенное: ждать час с крутилкой незачем — дальше отсчёт рисует pcPowerCountdown.
    if ((cmd === "off" || cmd === "sleep") && Number(r?.result?.delay) > 0) {
      ui.pc.pending = null;
      toast(cmd === "sleep" ? "Усну по таймеру — можно отменить" : "Выключусь по таймеру — можно отменить");
      pcLoad(true);
      return;
    }
    const done = r && ["done", "failed", "expired", "cancelled"].includes(r.status);
    if (done || tries > (power ? 140 : 25)) {
      ui.pc.pending = null;
      ui.pc.last = done ? r : { status: "failed", result: { message: cmd === "on" ? "Компьютер так и не вышел на связь" : cmd === "off" ? "Компьютер так и не выключился" : "Компьютер не ответил вовремя" } };
      if (r?.status === "done" && power) { toast(cmd === "on" ? "Компьютер включился" : cmd === "sleep" ? "Компьютер уснул" : "Компьютер выключился"); try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success"); } catch {} }
      if (cmd === "status" && r?.status === "done" && ui.pc.data) { ui.pc.data.status = r.result; ui.pc.data.statusAt = new Date().toISOString(); }
      if (power) setTimeout(() => pcLoad(true), 500);
      if (ui.page === "pc") render();
      return;
    }
    if (ui.pc.pending) {
      ui.pc.pending.status = r?.status;
      ui.pc.pending.resent = Number(r?.args?.resent) || 0;
      ui.pc.pending.stage = r?.result?.stage;
      // Тикают секунды — перерисовываем только карточку, а не весь экран.
      // Меняем только шаги и секунды: целиком карточку не трогаем, иначе кольцо крутится рывками.
      const card = document.querySelector(".pc-page .pc-boot:not(.pc-countdown)");
      if (card && ui.page === "pc") {
        const next = document.createElement("div");
        next.innerHTML = pcPendingCard(ui.pc.pending);
        for (const part of [".pc-steps", ".pc-boot-time", "h2"]) {
          const from = next.querySelector(part), to = card.querySelector(part);
          if (from && to && to.innerHTML !== from.innerHTML) to.innerHTML = from.innerHTML;
        }
      }
    }
    setTimeout(() => pcWait(id, cmd, tries + 1), power ? 1700 : 900);
  }).catch(() => setTimeout(() => pcWait(id, cmd, tries + 1), 2500));
}

const PC_ERRORS = { agent_offline: "Компьютер не на связи", pc_off: "Компьютер выключен", already_on: "Компьютер и так включён", nothing_to_cancel: "Отменять нечего", bad_url: "Нужна полная ссылка, с http" };

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
    toast(PC_ERRORS[m] || `Не получилось: ${m.slice(0, 60)}`);
    render();
  });
}

/** Быстрое действие: отклик на кнопке (крутится → галочка), без карточки результата. */
function pcQuick(cmd, args, key, done) {
  ui.pc.quick ||= {};
  const quiet = key === "audio";
  if (!quiet) { ui.pc.quick[key] = "is-busy"; if (ui.page === "pc") render(); }
  const finish = (state, result) => {
    if (result?.audio) { ui.pc.audio = result.audio; ui.pc.audioAt = Date.now(); }
    if (!quiet) {
      ui.pc.quick[key] = state;
      setTimeout(() => { if (ui.pc.quick[key] === state) { delete ui.pc.quick[key]; if (ui.page === "pc") render(); } }, 1200);
    }
    if (state === "is-done") done?.(result);
    if (ui.page === "pc" && !document.querySelector(".pc-vol-range:active")) render();
  };
  pcCall({ op: "send", cmd, args }).then(made => {
    if (made?.error) throw new Error(made.error);
    if (!made.id) return finish("is-done", made);
    const poll = (tries = 0) => pcCall({ op: "result", id: made.id }).then(r => {
      if (r?.status === "done") return finish("is-done", r.result);
      if (r?.status === "failed" || r?.status === "expired" || tries > 20) { if (!quiet) toast(r?.result?.message || "Компьютер не ответил"); return finish("is-fail"); }
      setTimeout(() => poll(tries + 1), 600);
    }).catch(() => setTimeout(() => poll(tries + 1), 1500));
    poll();
  }).catch(error => { const m = String(error?.message || error); if (!quiet) toast(PC_ERRORS[m] || `Не получилось: ${m.slice(0, 60)}`); finish("is-fail"); });
}

// Ползунок громкости: подпись меняется сразу, на компьютер уходит, когда отпустили.
document.addEventListener("input", event => {
  const range = event.target.closest?.(".pc-vol-range");
  if (!range) return;
  range.style.setProperty("--v", `${range.value}%`);
  const value = range.closest(".pc-volume")?.querySelector(".pc-vol-value");
  if (value) value.textContent = `${range.value}%`;
});
document.addEventListener("change", event => {
  const range = event.target.closest?.(".pc-vol-range");
  if (!range) return;
  const level = Number(range.value);
  ui.pc.audio = { level, muted: false };
  pcQuick("volume", { level }, "level");
});

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
  if (action === "pc-cancel") { pcQuick("cancel", {}, "cancel", () => { toast("Отменил — компьютер работает дальше"); pcLoad(true); }); return true; }
  if (action === "pc-lock") { pcQuick("lock", {}, "lock", () => toast("Экран заблокирован")); return true; }
  if (action === "pc-after") {
    const then = control.dataset.then;
    ui.pc.data.render = { ...(ui.pc.data.render || {}), then };
    pcQuick("after_render", { then }, `after-${then}`);
    return true;
  }
  if (action === "pc-media") { pcQuick("volume", { key: control.dataset.key }, control.dataset.key); return true; }
  if (action === "pc-mute") {
    const muted = !ui.pc.audio?.muted;
    ui.pc.audio = { level: ui.pc.audio?.level ?? 50, muted };
    pcQuick("volume", { mute: muted }, "mute");
    return true;
  }
  if (action === "pc-open") {
    const url = (document.getElementById("pc-url")?.value || "").trim();
    if (!/^https?:\/\//i.test(url)) { toast("Нужна полная ссылка, с http"); return true; }
    pcQuick("open", { url }, "open", () => toast("Открыл на компьютере"));
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
