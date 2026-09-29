/*
 * Мост между прототипом «Сорока — личное пространство» и ботом.
 *
 * Прототип — самостоятельная страница: держит всё в объекте data и после
 * каждого действия зовёт save(). Мост ничего в его экранах не переписывает:
 *   1. до запуска прототипа берёт у сервера снимок данных бота в том же
 *      формате (planner_snapshot) и отдаёт его load() через SOROKA_LIVE_DATA;
 *   2. подменяет save(): сравнивает data с последним снимком сервера и
 *      отправляет разницу списком «создать / изменить / удалить»;
 *   3. перехватывает то, что в прототипе было демо: «+» (разбирает бот),
 *      «в чат», пароли, подтверждение платежа.
 */
(function () {
  "use strict";
  const API = "https://snruckyliflxzpzybozr.functions.supabase.co/soroka-app";
  const SCRIPTS = [{"src":"https://unpkg.com/leaflet@1.9.4/dist/leaflet.js","integrity":"sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="},{"src":"./saved.js?v=aa7049716b","integrity":null},{"src":"./address-map.js?v=58140c052a","integrity":null},{"src":"./finance.js?v=cd4fdb5415","integrity":null},{"src":"./more.js?v=fe78e8138f","integrity":null},{"src":"./capture.js?v=a468bd1004","integrity":null},{"src":"./sections.js?v=2a2966ccf2","integrity":null},{"src":"./app.js?v=f437f899e2","integrity":null}];
  const tg = window.Telegram && window.Telegram.WebApp;
  const root = document.getElementById("app");

  window.SOROKA_LIVE = true;
  try { tg && tg.ready(); tg && tg.expand(); } catch (_) {}

  // ------------------------------------------------------------ запросы

  async function call(body, timeout = 20000) {
    const init = tg && tg.initData;
    if (!init) throw new Error("no-telegram");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const answer = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData: init, ...body }),
        signal: controller.signal,
      });
      const json = await answer.json().catch(() => ({}));
      if (!answer.ok) {
        const error = new Error(json.error || (answer.status === 401 ? "unauthorized" : "server"));
        error.status = answer.status;
        throw error;
      }
      return json;
    } finally {
      clearTimeout(timer);
    }
  }

  function say(message) { try { toast(message); } catch (_) {} }
  const ERRORS = {
    reopen_app: "Откройте приложение заново из Telegram — доступ к паролям действует пять минут",
    complex_transaction: "Эту операцию бот завёл сам (перевод, сверка) — поправьте её словами в чате",
    read_only: "Это пока меняется только в чате с ботом",
    empty_title: "Нужно название",
    invalid_amount: "Проверьте сумму",
    invalid_date: "Проверьте дату",
    too_many_deletes: "Слишком много удалений разом — ничего не удалил",
  };
  const human = (code) => ERRORS[code] || "Не сохранилось — попробуйте ещё раз";

  // ------------------------------------------------------------ снимок

  const SAVED_KEYS = ["notes", "recipes", "movies", "files", "posts", "links", "lists", "products", "tickets", "addresses"];

  /** Снимок сервера → объект в формате прототипа (как его ждёт load()). */
  function prepare(snapshot, keep) {
    const sections = snapshot.savedSections || {};
    const savedSections = {};
    for (const key of SAVED_KEYS) savedSections[key] = Array.isArray(sections[key]) ? sections[key] : [];
    const value = {
      tasks: snapshot.tasks, events: snapshot.events, notes: snapshot.notes, inbox: snapshot.inbox,
      saved: snapshot.saved, finance: snapshot.finance, projects: snapshot.projects, metrics: snapshot.metrics,
      trash: snapshot.trash, settings: snapshot.settings, savedSections,
      searchHistory: keep ? keep.searchHistory : readHistory(),
      vault: [],
    };
    // Папки, которых приложение ещё не видело, — с постоянным номером от
    // названия: случайный менялся бы при каждом обновлении, и открытая
    // папка терялась.
    const items = (key) => key === "notes" ? value.notes : (value.saved[key] || []);
    for (const key of SAVED_KEYS) {
      if (key === "addresses") continue;
      const list = savedSections[key];
      for (const item of items(key) || []) {
        const name = String(item.topic || "").trim();
        if (!name || list.some((s) => s.name.toLowerCase() === name.toLowerCase())) continue;
        list.push({ id: sectionId(key, name), name, icon: ICONS[key] || "bookmark", color: COLORS[list.length % COLORS.length], sortOrder: list.length });
      }
    }
    if (Array.isArray(snapshot.mapCategories)) value.mapCategories = snapshot.mapCategories;
    const places = value.saved.addresses || [];
    if (places.some((p) => p.topic)) {
      const cats = value.mapCategories || (value.mapCategories = []);
      for (const place of places) {
        const name = String(place.topic || "").trim();
        if (!name) continue;
        let cat = cats.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (!cat) { cat = { id: sectionId("map", name), name, icon: "pin", color: COLORS[cats.length % COLORS.length], sortOrder: cats.length }; cats.push(cat); }
        place.categoryId = cat.id;
      }
    }
    return value;
  }
  const ICONS = { notes: "note", recipes: "bookmark", movies: "event", files: "archive", posts: "note", links: "link", lists: "check", products: "wallet", tickets: "ticket" };
  const COLORS = ["#8dbbb4", "#ba9ad9", "#8ba9df", "#d8a572", "#d9949e"];
  function sectionId(key, name) {
    let h = 0;
    for (const ch of `${key}:${name.toLowerCase()}`) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return `s${h.toString(36)}`;
  }
  function readHistory() {
    try { const v = JSON.parse(localStorage.getItem("soroka-app-search") || "[]"); return Array.isArray(v) ? v : []; } catch (_) { return []; }
  }

  // ------------------------------------------------------------ разница

  const clone = (value) => JSON.parse(JSON.stringify(value));

  /** Коллекции, которые сравниваем по записям. */
  function collections(d) {
    const out = [
      ["tasks", d.tasks], ["events", d.events], ["notes", d.notes], ["inbox", d.inbox],
      ["projects", d.projects], ["metrics", d.metrics],
    ];
    for (const key of Object.keys(d.saved || {})) out.push([`saved.${key}`, d.saved[key]]);
    for (const key of ["accounts", "transactions", "transfers", "budgets", "goals", "debts", "payments"]) {
      out.push([`finance.${key}`, (d.finance || {})[key]]);
    }
    return out;
  }

  /** Имя раздела записи — сервер знает имена, а не номера разделов приложения. */
  function sectionOf(d, col, rec) {
    if (!rec || !rec.categoryId) return undefined;
    const key = col === "notes" ? "notes" : col.startsWith("saved.") ? col.slice(6) : "";
    const list = key === "addresses" ? d.mapCategories : (d.savedSections || {})[key];
    const found = (list || []).find((s) => s.id === rec.categoryId);
    return found ? found.name : undefined;
  }

  function diff(before, after) {
    const changes = [];
    const was = new Map(collections(before).map(([col, items]) => [col, items || []]));
    for (const [col, items] of collections(after)) {
      const old = new Map((was.get(col) || []).map((r) => [String(r.id), r]));
      const now = new Map((items || []).map((r) => [String(r.id), r]));
      for (const [id, rec] of now) {
        const prev = old.get(id);
        if (!prev) changes.push({ op: "create", col, id, rec, section: sectionOf(after, col, rec) });
        else if (JSON.stringify(prev) !== JSON.stringify(rec)) {
          changes.push({ op: "update", col, id, rec, prev, section: sectionOf(after, col, rec) });
        }
      }
      for (const id of old.keys()) if (!now.has(id)) changes.push({ op: "delete", col, id });
    }
    // Возврат из корзины в прототипе — снова «создать» с прежним номером:
    // сервер снимет отметку удаления. «Удалить навсегда» — запись ушла из
    // корзины и никуда не вернулась.
    const present = new Set(collections(after).flatMap(([, items]) => (items || []).map((r) => String(r.id))));
    const trashNow = new Set((after.trash || []).map((t) => t.id));
    for (const entry of before.trash || []) {
      if (trashNow.has(entry.id)) continue;
      const itemId = String(entry.item && entry.item.id || "");
      if (!present.has(itemId) && /^[a-z]+:\d+$/.test(itemId)) {
        changes.push({ op: "purge", col: COL_OF_KIND[itemId.split(":")[0]] || "tasks", id: itemId });
      }
    }
    if (JSON.stringify((before.finance || {}).rules) !== JSON.stringify((after.finance || {}).rules)) {
      changes.push({ op: "replace", col: "finance.rules", rec: { list: (after.finance || {}).rules || [] } });
    }
    const appState = (d) => JSON.stringify([d.savedSections, d.mapCategories, d.settings]);
    if (appState(before) !== appState(after)) {
      changes.push({ op: "replace", col: "app", rec: { savedSections: after.savedSections, mapCategories: after.mapCategories, settings: after.settings } });
    }
    return changes;
  }
  const COL_OF_KIND = {
    task: "tasks", event: "events", note: "notes", link: "saved.links", movie: "saved.movies", recipe: "saved.recipes",
    list: "saved.lists", product: "saved.products", place: "saved.addresses", metric: "metrics", tx: "finance.transactions",
    debt: "finance.debts", budget: "finance.budgets", goal: "finance.goals", payment: "finance.payments", project: "projects",
  };

  /** Правки, сделанные, пока летел запрос, — поверх свежего снимка. */
  function applyChanges(d, changes, ids) {
    const map = (id) => ids[id] || id;
    const lists = new Map(collections(d));
    for (const c of changes) {
      if (c.op === "replace") {
        if (c.col === "finance.rules") d.finance.rules = c.rec.list;
        if (c.col === "app") Object.assign(d, { savedSections: c.rec.savedSections, mapCategories: c.rec.mapCategories, settings: c.rec.settings });
        continue;
      }
      const list = lists.get(c.col);
      if (!list) continue;
      const at = list.findIndex((r) => String(r.id) === map(c.id));
      if (c.op === "delete" || c.op === "purge") { if (at >= 0) list.splice(at, 1); continue; }
      const rec = { ...c.rec, id: map(c.id) };
      if (at >= 0) list[at] = rec; else list.push(rec);
    }
  }

  // ------------------------------------------------------------ отправка

  let base = null;        // последнее, что знаем о сервере
  let flying = false;
  let again = false;
  let timer = null;

  function schedule(ms = 350) {
    clearTimeout(timer);
    timer = setTimeout(push, ms);
  }

  async function push() {
    if (!base) return;
    if (flying) { again = true; return; }
    const changes = diff(base, data);
    if (!changes.length) return;
    // Много удалений разом — почти наверняка сбой загрузки, а не решение
    // человека: не отправляем, перечитываем с сервера.
    if (changes.filter((c) => c.op === "delete").length > 12) {
      say("Похоже на сбой загрузки — ничего не удалил, перечитываю данные");
      await refresh(true);
      return;
    }
    flying = true;
    const sent = clone(data);
    try {
      const answer = await call({ action: "planner_sync", changes }, 30000);
      const late = diff(sent, data);
      adopt(answer.snapshot, answer.ids || {}, late);
      if (answer.errors && answer.errors.length) say(human(answer.errors[0].error));
      if (late.length) again = true;
    } catch (error) {
      say(error.message === "no-telegram" ? "Откройте приложение из Telegram" : "Нет связи с ботом — правка не сохранилась");
      // Возвращаемся к тому, что есть на сервере: иначе экран врёт.
      await refresh(true);
    } finally {
      flying = false;
      if (again) { again = false; schedule(50); }
    }
  }

  /** Принять снимок сервера. late — правки, сделанные за время запроса. */
  function adopt(snapshot, ids, late) {
    const keep = data;
    const fresh = hydrateExtra(prepare(snapshot, keep), seed());
    base = clone(fresh);
    if (late && late.length) applyChanges(fresh, late, ids);
    fresh.vault = keep.vault;
    data = fresh;
    remapUi(ids);
    render();
  }

  /** Номера, которые сервер выдал новым записям, — и в открытых окнах. */
  function remapUi(ids) {
    const entries = Object.entries(ids || {});
    if (!entries.length || !ui.sheet) return;
    let text = JSON.stringify(ui.sheet);
    for (const [from, to] of entries) text = text.split(JSON.stringify(from)).join(JSON.stringify(to));
    ui.sheet = JSON.parse(text);
  }

  async function refresh(force = false) {
    if (!base || flying) return;
    if (!force && diff(base, data).length) return;
    try {
      const snapshot = await call({ action: "planner_snapshot" });
      if (!force && (flying || diff(base, data).length)) return;
      adopt(snapshot, {}, []);
    } catch (_) {}
  }

  // ------------------------------------------------------------ перехваты

  function sheetItem() {
    const sheet = ui.sheet || {};
    if (!sheet.category || !sheet.id) return null;
    const list = sheet.category === "notes" ? data.notes : (data.saved[sheet.category] || []);
    return list.find((x) => x.id === sheet.id) || null;
  }

  async function sendToChat(ref) {
    try {
      await call({ action: "planner_send", ref });
      say("Прислал в чат");
      setTimeout(() => { try { tg && tg.close(); } catch (_) {} }, 600);
    } catch (error) {
      say(error.message === "no_file" ? "У записи нет файла" : "Не удалось прислать");
    }
  }

  // Пароли — настоящее хранилище: список без паролей, пароль по запросу.
  const vault = {
    async list() {
      const answer = await call({ action: "vault_list" });
      data.vault = (answer.entries || []).map((e) => ({ id: `v:${e.id}`, service: e.service, login: e.login || "", password: null, note: "" }));
    },
    async reveal(item) {
      if (!item || item.password !== null) return item;
      const answer = await call({ action: "vault_reveal", id: Number(String(item.id).slice(2)) });
      Object.assign(item, { password: answer.entry.password, note: answer.entry.note || "", login: answer.entry.login || item.login });
      return item;
    },
    fail(error) { say(human(error.message)); },
  };

  function intercept(event) {
    const control = event.target.closest && event.target.closest("[data-action]");
    if (!control) return;
    const action = control.dataset.action;
    const stop = () => { event.preventDefault(); event.stopImmediatePropagation(); };

    if (action === "reset") { stop(); ui.menu = false; render(); refresh(true).then(() => say("Обновлено")); return; }
    if (action === "return-chat") { stop(); try { tg && tg.close(); } catch (_) {} return; }
    if (action === "saved-send") {
      stop();
      const item = sheetItem();
      if (item) sendToChat(String(item.id));
      return;
    }
    if (action === "post-open-bot") { stop(); const item = sheetItem(); if (item) sendToChat(String(item.id)); return; }
    if (action === "payment-confirm") {
      // Списание запишет бот (как по кнопке в чате): сам платёж отмечаем, а
      // операцию не заводим здесь, иначе их будет две.
      stop();
      const p = data.finance.payments.find((x) => x.id === control.dataset.id);
      if (p) { p.status = "confirmed"; p.paidAt = todayIso(); save(); say("Отметил — списание запишется"); }
      return;
    }
    if (action === "vault-unlock") {
      stop();
      vault.list().then(() => { ui.vaultUnlocked = true; render(); }).catch((e) => vault.fail(e));
      return;
    }
    if (action === "vault-reveal" || action === "vault-edit" || action === "vault-copy") {
      const item = data.vault.find((x) => x.id === control.dataset.id);
      if (item && item.password === null) {
        stop();
        vault.reveal(item).then(() => control.click()).catch((e) => vault.fail(e));
      }
      return;
    }
    if (action === "vault-delete") {
      stop();
      const item = data.vault.find((x) => x.id === (ui.sheet && ui.sheet.id));
      if (!item || !window.confirm(`Удалить «${item.service}» из хранилища?`)) return;
      call({ action: "vault_delete", id: Number(String(item.id).slice(2)) })
        .then(() => vault.list()).then(() => { ui.sheet = null; render(); say("Удалено"); }).catch((e) => vault.fail(e));
    }
  }

  function interceptSubmit(event) {
    const form = event.target;
    if (!form || !form.id) return;
    if (form.id === "quick-capture-form") {
      // «+» — как сообщение боту: разбирает он, отвечает карточкой в чате.
      event.preventDefault(); event.stopImmediatePropagation();
      const text = String(new FormData(form).get("text") || "").trim();
      if (!text) return;
      const button = form.querySelector("button[type=submit]");
      if (button) button.disabled = true;
      call({ action: "planner_capture", text }).then(() => {
        ui.sheet = null; render();
        say("Отправил боту — ответит в чате, запись появится здесь");
        [6000, 15000, 30000].forEach((ms) => setTimeout(() => refresh(), ms));
      }).catch(() => { if (button) button.disabled = false; say("Не отправилось — попробуйте ещё раз"); });
      return;
    }
    if (form.id === "vault-form") {
      event.preventDefault(); event.stopImmediatePropagation();
      const f = new FormData(form);
      const existing = data.vault.find((x) => x.id === (ui.sheet && ui.sheet.id));
      const body = {
        action: existing ? "vault_update" : "vault_create",
        service: String(f.get("service") || "").trim(), login: String(f.get("login") || "").trim(),
        password: String(f.get("password") || ""), note: String(f.get("note") || "").trim(),
      };
      if (existing) body.id = Number(String(existing.id).slice(2));
      call(body).then(() => vault.list()).then(() => { ui.sheet = null; render(); say("Сохранено"); }).catch((e) => vault.fail(e));
    }
  }

  // ------------------------------------------------------------ ссылка из бота

  // Кнопка «Открыть в приложении» у карточки: ?page=movies&rid=5.
  const PAGE_KIND = {
    tasks: "task", events: "event", notes: "note", links: "link", recipes: "recipe", movies: "movie", goods: "product",
    debts: "debt", payments: "payment", money: "tx", shop: "list", projects: "project", lists: "list", tickets: "ticket",
  };
  function openDeepLink() {
    const params = new URLSearchParams(location.search);
    const page = params.get("page") || "";
    const rid = params.get("rid") || "";
    // «Открыть пароли» из чата.
    if (params.get("tab") === "vault") { navigate("vault"); return; }
    if (!page) return;
    const kind = PAGE_KIND[page];
    if (!rid || !kind) {
      const to = { tasks: "tasks", events: "upcoming", money: "finance", debts: "finance", payments: "finance", projects: "projects" }[page];
      if (to) navigate(to);
      return;
    }
    const id = `${kind}:${rid}`;
    if (kind === "task") { navigate("tasks"); ui.sheet = { kind: "edit", type: "task", id, justRendered: false }; render(); return; }
    if (kind === "event") { navigate("upcoming"); ui.sheet = { kind: "edit", type: "event", id, justRendered: false }; render(); return; }
    if (kind === "note") { navigate("saved"); openSavedRecord("notes", id); return; }
    for (const key of Object.keys(data.saved)) {
      if ((data.saved[key] || []).some((r) => r.id === id)) { navigate("saved"); openSavedRecord(key, id); return; }
    }
    if (["tx", "debt", "payment"].includes(kind)) navigate("finance");
  }

  // ------------------------------------------------------------ коды билетов

  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function liveTicketCodes(item) {
    const codes = Array.isArray(item.codes) ? item.codes : [];
    const send = item.inChat ? '<button class="ghost-button live-code-send" type="button" data-action="saved-send">Прислать билет в чат</button>' : "";
    if (!codes.length) {
      const why = item.codesPending
        ? "Бот распознаёт код с фото билета — через минуту он появится здесь."
        : item.inChat
          ? "На фото билета код не нашёлся (или билет в PDF). Вписать код можно через «Изменить»."
          : "К билету не прикреплён файл. Пришлите фото билета боту — он найдёт код.";
      return `<section class="ticket-code-block"><div class="ticket-code-heading"><strong>Код билета</strong></div><div class="ticket-code-placeholder"><span>${why}</span></div>${send}</section>`;
    }
    const kind = codes.every((c) => c.kind === "barcode") ? "Штрихкод" : "QR-код";
    return `<section class="ticket-code-block live-codes"><div class="ticket-code-heading"><strong>${codes.length > 1 ? `Коды · ${codes.length} билета` : "Код билета"}</strong><span>${kind}</span></div>` +
      codes.map((c, i) => `<button type="button" class="live-code ${c.kind}" data-live-code="${i}" data-label="${escape(codes.length > 1 ? `Билет ${i + 1} из ${codes.length}` : item.title)}" aria-label="Открыть код на весь экран">${c.svg || ""}<span>${codes.length > 1 ? `Билет ${i + 1} · ` : ""}${escape(c.text)}</span></button>`).join("") +
      `<p class="section-note">Нажмите на код — он откроется на весь экран.</p>${send}</section>`;
  }

  /** Код на весь экран: белый фон, крупно — для турникета. */
  function fullCode(button) {
    const svg = button.querySelector("svg");
    if (!svg) return;
    const layer = document.createElement("div");
    layer.className = "live-code-full";
    layer.innerHTML = `<div class="live-code-full-art">${svg.outerHTML}</div><p>${escape(button.dataset.label || "")}</p><small>${escape(button.querySelector("span")?.textContent || "")}</small><button type="button">Закрыть</button>`;
    layer.addEventListener("click", () => layer.remove());
    document.body.appendChild(layer);
  }

  // ------------------------------------------------------------ запуск

  function loadScript(entry) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = entry.src; s.async = false;
      if (entry.integrity) { s.integrity = entry.integrity; s.crossOrigin = "anonymous"; }
      s.onload = resolve; s.onerror = () => reject(new Error("script " + entry.src));
      document.body.appendChild(s);
    });
  }

  function splash(text, retry) {
    root.innerHTML = `<div class="live-splash"><img src="./assets/soroka-avatar.png" alt=""><p>${text}</p>${retry ? '<button type="button" id="live-retry">Попробовать ещё раз</button>' : ""}</div>`;
    const button = document.getElementById("live-retry");
    if (button) button.onclick = () => location.reload();
  }

  async function boot() {
    if (!(tg && tg.initData)) {
      splash("Откройте приложение из Telegram — кнопкой «Приложение» в меню бота.");
      return;
    }
    splash("Загружаю…");
    let snapshot;
    try {
      snapshot = await call({ action: "planner_snapshot" }, 30000);
    } catch (error) {
      splash(error.message === "unauthorized" ? "Это приложение открывается только владельцем бота." : "Бот не ответил. Проверьте связь.", true);
      return;
    }
    window.SOROKA_LIVE_DATA = prepare(snapshot);
    root.innerHTML = "";
    // Тема — у Telegram: светлый клиент открывает светлое приложение.
    try {
      if (!localStorage.getItem("soroka-planner-theme") && tg.colorScheme) localStorage.setItem("soroka-planner-theme", tg.colorScheme);
    } catch (_) {}
    for (const entry of SCRIPTS) {
      // Карта (Leaflet) не должна валить всё приложение, если CDN недоступен.
      try { await loadScript(entry); } catch (error) { if (!entry.integrity) throw error; }
    }

    // Коды билетов — настоящие, распознанные ботом с фото (вместо демо-картинки).
    window.ticketCodeBlock = liveTicketCodes;
    document.addEventListener("click", (event) => {
      const code = event.target.closest && event.target.closest("[data-live-code]");
      if (code) { event.preventDefault(); event.stopImmediatePropagation(); fullCode(code); }
    }, true);

    // Какая страница открыта — в разметку: по ней CSS прячет «+», где он мешает.
    const paint = window.render;
    window.render = function () {
      paint();
      document.body.dataset.page = ui.page;
      document.body.dataset.financeTab = ui.financeTab || "";
    };
    render();

    const original = window.save;
    window.save = function () {
      try { localStorage.setItem("soroka-app-search", JSON.stringify(data.searchHistory || [])); } catch (_) {}
      schedule();
      return true;
    };
    void original;
    document.addEventListener("click", intercept, true);
    document.addEventListener("submit", interceptSubmit, true);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
    setTimeout(() => { base = clone(data); openDeepLink(); }, 0);
  }

  boot();
})();
