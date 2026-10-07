/*
 * «VPN» — свой сервер в Нидерландах: состояние, трафик, ключи устройств,
 * исключения маршрутизации. Данные живые: мост (`window.sorokaVpn`) ходит
 * через приложение бота к сервису управления на сервере. Без моста —
 * демо-данные, чтобы экран можно было рисовать отдельно.
 */

const VPN_DEMO = {
  server: { location: "Нидерланды, Амстердам", domain: "vpn.example.ru", ip: "203.0.113.10", uptime_s: 86400 * 3, load: 0.08, cpus: 1, mem_total: 1e9, mem_used: 4e8, disk_total: 4e10, disk_used: 3e9, xray_active: true, xray_version: "26.3.27", cert_days: 84 },
  traffic: { month_out: 182e9, month_in: 176e9, today_out: 6.4e9, today_in: 6.1e9, limit: 3e12 },
  clients: [
    { name: "windows", title: "Windows", enabled: true, online: true, ips: 1, last_seen: Date.now() / 1000, traffic: { today: 3.1e9, week: 21e9, month: 96e9, total: 96e9 } },
    { name: "android", title: "Android", enabled: true, online: true, ips: 1, last_seen: Date.now() / 1000, traffic: { today: 0.9e9, week: 7e9, month: 31e9, total: 31e9 } },
    { name: "iphone", title: "iPhone", enabled: true, online: false, ips: 0, last_seen: Date.now() / 1000 - 7200, traffic: { today: 0, week: 2e9, month: 9e9, total: 9e9 } },
    { name: "mac", title: "Mac", enabled: false, online: false, ips: 0, last_seen: null, traffic: { today: 0, week: 0, month: 4e9, total: 4e9 } }
  ],
  exceptions: { direct: ["twitch.tv"], proxy: [] }
};

function vpnCall(op, payload = {}) {
  if (typeof window.sorokaVpn === "function") return window.sorokaVpn(op, payload);
  return new Promise(done => setTimeout(() => done(op === "summary" ? JSON.parse(JSON.stringify(VPN_DEMO)) : op === "links" || op === "create"
    ? { name: payload.name || "demo", main: "vless://demo@vpn.example.ru:443#NL", reserve: "vless://demo@vpn.example.ru:2053#NL-reserve", subscription: "https://vpn.example.ru/sub/demo" }
    : { ok: true }), 350));
}

function vpnLoad(force = false) {
  ui.vpn ||= { state: "idle" };
  const fresh = ui.vpn.data && Date.now() - ui.vpn.at < 30000;
  if (ui.vpn.state === "loading" || (fresh && !force)) return;
  ui.vpn.state = "loading";
  vpnCall("summary").then(answer => {
    if (answer?.error) throw new Error(answer.error);
    ui.vpn = { state: "ready", data: answer, at: Date.now() };
  }).catch(error => {
    ui.vpn = { ...ui.vpn, state: "error", error: String(error?.message || error) };
  }).finally(() => { if (ui.page === "vpn") render(); });
}

function vpnBytes(n) {
  n = Number(n) || 0;
  if (n < 1e6) return `${Math.round(n / 1e3)} КБ`;
  if (n < 1e9) return `${Math.round(n / 1e6)} МБ`;
  if (n < 1e12) return `${(n / 1e9).toFixed(n < 1e10 ? 1 : 0).replace(".", ",")} ГБ`;
  return `${(n / 1e12).toFixed(2).replace(".", ",")} ТБ`;
}

function vpnAgo(ts) {
  if (!ts) return "ещё не подключался";
  const min = Math.round((Date.now() / 1000 - ts) / 60);
  if (min < 2) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ${word(h, "час", "часа", "часов")} назад`;
  const d = Math.round(h / 24);
  return `${d} ${word(d, "день", "дня", "дней")} назад`;
}

function vpnUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600);
  return d ? `${d} д ${h} ч` : `${h} ч ${Math.floor(s % 3600 / 60)} мин`;
}

function vpnClientRow(c) {
  const state = !c.enabled ? "отключён" : c.online ? "в сети" : vpnAgo(c.last_seen);
  const dot = `<i class="vpn-dot ${!c.enabled ? "off" : c.online ? "on" : ""}"></i>`;
  return `<button class="list-row vpn-client" type="button" data-action="vpn-key" data-name="${esc(c.name)}"><span class="list-icon">${icon("key")}</span><span class="list-copy"><strong>${esc(c.title || c.name)}</strong><span>${dot}${esc(state)} · за месяц ${vpnBytes(c.traffic?.month)}</span></span>${icon("right", "icon-sm")}</button>`;
}

function renderVpnPage() {
  vpnLoad();
  const v = ui.vpn || {};
  const top = header("VPN", "Свой сервер, ключи и трафик", "Сервер");
  if (!v.data) {
    return `${top}${v.state === "error"
      ? `<div class="state-card"><h2>Сервер не ответил</h2><p>${esc(v.error || "Нет связи с сервисом управления.")}</p><button class="primary-button" type="button" data-action="vpn-refresh">Повторить</button></div>`
      : `<div class="state-card"><h2>Загружаю…</h2><p>Спрашиваю сервер о состоянии и трафике.</p></div>`}`;
  }
  const { server: s, traffic: t, clients, exceptions } = v.data;
  const used = Number(t.month_out) || 0;
  const pct = t.limit ? Math.min(100, used / t.limit * 100) : 0;
  const online = clients.filter(c => c.online).length;
  const status = `<div class="vpn-status ${s.xray_active ? "ok" : "down"}"><div><small>${esc(s.location)}</small><strong>${s.xray_active ? "Работает" : "VPN остановлен"}</strong><p>${online ? `${online} ${word(online, "устройство", "устройства", "устройств")} в сети` : "Сейчас никто не подключён"} · без перезагрузки ${vpnUptime(s.uptime_s)}</p></div><button class="small-button" type="button" data-action="vpn-restart">${icon("reset", "icon-sm")}Перезапустить</button></div>`;
  const traffic = `<div class="side-card vpn-traffic"><div class="budget-top"><span>Трафик за месяц</span><span>${vpnBytes(used)} из ${vpnBytes(t.limit)}</span></div><div class="progress-track"><span style="width:${pct}%;background:${pct > 80 ? "var(--warn)" : "var(--accent)"}"></span></div><div class="side-row"><span>Сегодня</span><b>${vpnBytes(t.today_out)}</b></div><div class="side-row"><span>Осталось</span><b>${vpnBytes(Math.max(0, t.limit - used))}</b></div>${t.error ? `<p class="side-note">Счётчик сервера: ${esc(t.error)}</p>` : ""}</div>`;
  const keys = cardSection("Ключи", `<div class="list-panel">${clients.length ? clients.map(vpnClientRow).join("") : `<div class="list-row"><span class="list-copy"><strong>Ключей нет</strong><span>Добавьте ключ для устройства.</span></span></div>`}</div>`, "", `<button class="text-action" type="button" data-action="vpn-new">Добавить ${icon("plus", "icon-sm")}</button>`);
  const exRow = (label, list) => `<div class="side-row"><span>${label}</span><b>${list.length ? esc(list.slice(0, 3).join(", ")) + (list.length > 3 ? ` +${list.length - 3}` : "") : "—"}</b></div>`;
  const ex = cardSection("Исключения", `<div class="side-card">${exRow("Напрямую, мимо VPN", exceptions.direct)}${exRow("Всегда через VPN", exceptions.proxy)}<p class="side-note">Российские сайты и сервисы идут напрямую сами. Здесь — то, что нужно добавить сверху. Приложения подхватят изменения из подписки.</p><button class="text-action" type="button" data-action="vpn-exceptions">Изменить ${icon("arrow", "icon-sm")}</button></div>`);
  const aside = `<aside class="content-aside"><div class="side-card"><h3>Сервер</h3><div class="side-row"><span>Адрес</span><b>${esc(s.domain)}</b></div><div class="side-row"><span>Нагрузка</span><b>${Math.round((s.load / (s.cpus || 1)) * 100)}%</b></div><div class="side-row"><span>Память</span><b>${vpnBytes(s.mem_used)} из ${vpnBytes(s.mem_total)}</b></div><div class="side-row"><span>Диск</span><b>${vpnBytes(s.disk_used)} из ${vpnBytes(s.disk_total)}</b></div><div class="side-row"><span>Сертификат</span><b>${s.cert_days === null ? "—" : `ещё ${s.cert_days} дн.`}</b></div><div class="side-row"><span>Xray</span><b>${esc(s.xray_version || "—")}</b></div><button class="text-action" type="button" data-action="vpn-refresh">Обновить ${icon("reset", "icon-sm")}</button></div></aside>`;
  return `${top}<div class="content-grid"><div class="content-main">${status}${traffic}${keys}${ex}</div>${aside}</div>`;
}

function vpnClient(name) {
  return ui.vpn?.data?.clients.find(c => c.name === name);
}

function renderVpnKeySheet() {
  const c = vpnClient(ui.sheet.name);
  const links = ui.sheet.links;
  const head = title => `<div class="modal-backdrop" data-action="backdrop"><section class="sheet vpn-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${esc(title)}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div>`;
  if (!c && !links) return `${head("Ключ")}<p class="section-note">Ключ не найден — обновите страницу.</p></section></div>`;
  const t = c?.traffic || {};
  const stats = c ? `<div class="kpi-grid"><div class="kpi"><span class="kpi-label">Сегодня</span><span class="kpi-value">${vpnBytes(t.today)}</span></div><div class="kpi"><span class="kpi-label">Неделя</span><span class="kpi-value">${vpnBytes(t.week)}</span></div><div class="kpi"><span class="kpi-label">Месяц</span><span class="kpi-value">${vpnBytes(t.month)}</span></div></div>` : "";
  const linkBlock = links
    ? `<div class="vpn-links"><button class="primary-button" type="button" data-action="vpn-copy" data-value="${esc(links.subscription)}">${icon("copy", "icon-sm")}Скопировать подписку</button><p class="section-note">В Happ или Incy: «+» → «Вставить из буфера». Подписка сама обновляет сервер и исключения.</p><div class="inline-actions"><button type="button" data-action="vpn-copy" data-value="${esc(links.main)}">${icon("copy")}Ключ</button><button type="button" data-action="vpn-copy" data-value="${esc(links.reserve)}">${icon("copy")}Запасной</button></div></div>`
    : `<button class="ghost-button" type="button" data-action="vpn-links" data-name="${esc(ui.sheet.name)}">${icon("link", "icon-sm")}Показать ссылки для подключения</button>`;
  const manage = c ? `<form id="vpn-rename" class="vpn-rename"><label class="field">Название<input name="title" type="text" maxlength="40" value="${esc(c.title || c.name)}"></label><button class="small-button" type="submit">Сохранить</button></form><div class="sheet-actions"><button class="ghost-button danger-button" type="button" data-action="vpn-delete">Удалить ключ</button><button class="ghost-button" type="button" data-action="vpn-toggle">${c.enabled ? "Отключить" : "Включить"}</button></div>` : "";
  const state = c ? `<p class="section-note">${!c.enabled ? "Ключ отключён — устройство не подключится, пока не включите." : c.online ? `Сейчас в сети${c.ips > 1 ? ` с ${c.ips} адресов` : ""}.` : `Последний раз — ${vpnAgo(c.last_seen)}.`}</p>` : "";
  return `${head(c?.title || ui.sheet.name)}${state}${stats}${linkBlock}${manage}</section></div>`;
}

function renderVpnNewSheet() {
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Новый ключ</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><p class="section-note">Отдельный ключ на каждое устройство: его можно отключить, не трогая остальные.</p><form id="vpn-new-form"><label class="field">Устройство<input name="title" type="text" maxlength="40" placeholder="Например, Планшет" required autofocus></label><div class="sheet-actions"><button class="primary-button" type="submit">Создать</button></div></form></section></div>`;
}

function renderVpnExceptionsSheet() {
  const ex = ui.sheet.draft;
  const chips = (key, list) => list.length ? `<div class="list-panel">${list.map(d => `<div class="vpn-ex-row"><span>${esc(d)}</span><button type="button" class="text-action" data-action="vpn-ex-del" data-kind="${key}" data-domain="${esc(d)}">Убрать</button></div>`).join("")}</div>` : `<p class="section-note">Пусто.</p>`;
  const add = key => `<form class="vpn-ex-add" data-kind="${key}"><input name="domain" placeholder="twitch.tv" maxlength="80" aria-label="Адрес сайта" autocomplete="off"><button type="submit" class="primary-button">Добавить</button></form>`;
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet vpn-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Исключения</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><h3 class="vpn-ex-head">Напрямую, мимо VPN</h3>${chips("direct", ex.direct)}${add("direct")}<h3 class="vpn-ex-head">Всегда через VPN</h3><p class="section-note">Например, российский сайт, который нужен с иностранного адреса.</p>${chips("proxy", ex.proxy)}${add("proxy")}<div class="sheet-actions"><button class="primary-button" type="button" data-action="vpn-ex-save">Сохранить</button></div></section></div>`;
}

function vpnRun(promise, done) {
  return promise.then(answer => {
    if (answer?.error) throw new Error(answer.error);
    if (done) done(answer);
    vpnLoad(true);
  }).catch(error => toast(`Не получилось: ${String(error?.message || error).slice(0, 80)}`));
}

function vpnAction(action, control) {
  if (!action.startsWith("vpn-")) return false;
  const name = control.dataset.name || ui.sheet?.name;
  if (action === "vpn-refresh") { vpnLoad(true); render(); return true; }
  if (action === "vpn-key") { ui.sheet = { kind: "vpn-key", name }; render(); return true; }
  if (action === "vpn-new") { ui.sheet = { kind: "vpn-new" }; render(); return true; }
  if (action === "vpn-links") {
    vpnRun(vpnCall("links", { name }), links => { if (ui.sheet?.kind === "vpn-key") { ui.sheet.links = links; render(); } });
    return true;
  }
  if (action === "vpn-copy") { copySharedText(control.dataset.value).then(ok => toast(ok ? "Скопировано" : "Не получилось скопировать")); return true; }
  if (action === "vpn-toggle") {
    const c = vpnClient(name);
    if (!c) return true;
    if (c.enabled && !window.confirm(`Отключить «${c.title}»? Устройство сразу потеряет VPN.`)) return true;
    vpnRun(vpnCall(c.enabled ? "disable" : "enable", { name }), () => toast(c.enabled ? "Ключ отключён" : "Ключ включён"));
    return true;
  }
  if (action === "vpn-delete") {
    const c = vpnClient(name);
    if (!c || !window.confirm(`Удалить ключ «${c.title}» насовсем? Ссылки и подписка перестанут работать.`)) return true;
    vpnRun(vpnCall("delete", { name }), () => { ui.sheet = null; toast("Ключ удалён"); });
    return true;
  }
  if (action === "vpn-restart") {
    if (!window.confirm("Перезапустить VPN? Все устройства отключатся на 2–3 секунды.")) return true;
    vpnRun(vpnCall("restart"), () => toast("Перезапускаю — через пару секунд всё вернётся"));
    return true;
  }
  if (action === "vpn-exceptions") {
    const ex = ui.vpn?.data?.exceptions || { direct: [], proxy: [] };
    ui.sheet = { kind: "vpn-exceptions", draft: { direct: [...ex.direct], proxy: [...ex.proxy] } };
    render();
    return true;
  }
  if (action === "vpn-ex-del") {
    const list = ui.sheet.draft[control.dataset.kind];
    ui.sheet.draft[control.dataset.kind] = list.filter(d => d !== control.dataset.domain);
    render();
    return true;
  }
  if (action === "vpn-ex-save") {
    vpnRun(vpnCall("exceptions", ui.sheet.draft), () => { ui.sheet = null; toast("Сохранено — приложения подхватят из подписки"); });
    return true;
  }
  return false;
}

document.addEventListener("submit", event => {
  const form = event.target;
  if (form?.id === "vpn-new-form") {
    event.preventDefault(); event.stopImmediatePropagation();
    const title = form.title.value.trim();
    if (!title) return;
    vpnRun(vpnCall("create", { title }), answer => { ui.sheet = { kind: "vpn-key", name: answer.name, links: answer }; toast("Ключ создан"); render(); });
    return;
  }
  if (form?.id === "vpn-rename") {
    event.preventDefault(); event.stopImmediatePropagation();
    vpnRun(vpnCall("rename", { name: ui.sheet.name, title: form.title.value.trim() }), () => toast("Переименовано"));
    return;
  }
  if (form?.classList?.contains("vpn-ex-add")) {
    event.preventDefault(); event.stopImmediatePropagation();
    const kind = form.dataset.kind;
    const domain = form.domain.value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (!/^[a-z0-9а-яё.-]+\.[a-z0-9а-яё-]+$/.test(domain)) { toast("Нужен адрес сайта, например twitch.tv"); return; }
    if (!ui.sheet.draft[kind].includes(domain)) ui.sheet.draft[kind].push(domain);
    render();
  }
}, true);
