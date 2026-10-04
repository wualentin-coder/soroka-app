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
  const SCRIPTS = [{"src":"https://unpkg.com/leaflet@1.9.4/dist/leaflet.js","integrity":"sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="},{"src":"./saved.js?v=d1ab27c440","integrity":null},{"src":"./movies.js?v=a4ab4fbc79","integrity":null},{"src":"./cards.js?v=da416c2cd2","integrity":null},{"src":"./address-map.js?v=3d6d1ceed6","integrity":null},{"src":"./finance.js?v=26f86e3a17","integrity":null},{"src":"./more.js?v=a30bdec62f","integrity":null},{"src":"./capture.js?v=2ea89f646c","integrity":null},{"src":"./sections.js?v=bfd1772300","integrity":null},{"src":"./app.js?v=545f813263","integrity":null}];
  const tg = window.Telegram && window.Telegram.WebApp;
  const root = document.getElementById("app");

  window.SOROKA_LIVE = true;
  // Приложение телефона (Android) открывает это же окно без Telegram — на
  // случай, если Telegram заблокируют. Входит оно ключом устройства.
  const android = window.SorokaAndroid;
  function deviceKey() { try { return (android && android.deviceKey && String(android.deviceKey())) || ""; } catch (_) { return ""; } }
  const inTelegram = Boolean(tg && tg.initData);
  if (!inTelegram && deviceKey()) document.documentElement.classList.add("in-android");
  try { tg && tg.ready(); tg && tg.expand(); } catch (_) {}
  // Свайп вниз по карточкам не должен сворачивать приложение (Bot API 7.7+).
  try { tg && tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (_) {}

  // ------------------------------------------------------------ запросы

  async function call(body, timeout = 20000) {
    const init = tg && tg.initData;
    const device = init ? "" : deviceKey();
    if (!init && !device) throw new Error("no-telegram");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const answer = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(init ? { initData: init, ...body } : { device, ...body }),
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

  function closeApp() {
    try { if (inTelegram) tg.close(); else if (android && android.close) android.close(); } catch (_) {}
  }
  function say(message) { try { toast(message); } catch (_) {} }

  /** Подпись Telegram старше недели — её не примет сервер, нужно открыть приложение заново. */
  function staleInit() {
    const at = Number(tg && tg.initDataUnsafe && tg.initDataUnsafe.auth_date) || 0;
    return at > 0 && Date.now() / 1000 - at > 7 * 24 * 3600 - 600;
  }
  let reopenShown = false;
  /** Сервер перестал узнавать приложение посреди работы: объяснить и дать закрыть. */
  function askReopen() {
    if (reopenShown) return;
    reopenShown = true;
    const layer = document.createElement("div");
    layer.className = "modal-backdrop live-reopen";
    layer.innerHTML = `<section class="sheet" role="alertdialog" aria-modal="true"><div class="sheet-handle"></div><h2>Откройте приложение заново</h2><p class="section-note">Приложение долго было открыто или свёрнуто, и Telegram перестал подтверждать, что это вы. Закройте его и откройте снова — правки, которые не сохранились, придётся повторить.</p><div class="sheet-actions"><button type="button" class="primary-button" data-reopen>Закрыть приложение</button></div></section>`;
    layer.querySelector("[data-reopen]").addEventListener("click", closeApp);
    document.body.appendChild(layer);
  }
  const ERRORS = {
    reopen_app: "Откройте приложение заново из Telegram — доступ к паролям действует пять минут",
    complex_transaction: "Эту операцию бот завёл сам (перевод, сверка) — поправьте её словами в чате",
    read_only: "Это пока меняется только в чате с ботом",
    empty_title: "Нужно название",
    invalid_amount: "Проверьте сумму",
    invalid_date: "Проверьте дату",
    too_many_deletes: "Слишком много удалений разом — ничего не удалил",
    savings_account: "Накопительный счёт постоянный — переименовать можно, удалить нельзя",
    goal_has_money: "В цели есть деньги — сначала снимите их кнопкой «Снять»",
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
  let warming = false;    // открыты на снимке из прошлого запуска, свежий ещё идёт
  let heldRender = false; // свежие данные пришли при открытой форме — перерисуем после неё
  const SNAP_KEY = "soroka-snapshot-v1";
  function keepSnapshot(snapshot) {
    setTimeout(() => { try { localStorage.setItem(SNAP_KEY, JSON.stringify({ at: Date.now(), snapshot })); } catch (_) {} }, 0);
  }
  function lastSnapshot() {
    try {
      const saved = JSON.parse(localStorage.getItem(SNAP_KEY) || "null");
      return saved && Date.now() - saved.at < 3 * 86400000 ? saved.snapshot : null;
    } catch (_) { return null; }
  }
  let flying = false;
  let again = false;
  let timer = null;

  function schedule(ms = 350) {
    clearTimeout(timer);
    timer = setTimeout(push, ms);
  }

  async function push() {
    if (!base) return;
    // Открылись на прошлом снимке — правки ждут свежего, чтобы не спорить со старым.
    if (warming) { again = true; return; }
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
      if (error.status === 401) { askReopen(); return; }
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
    keepSnapshot(snapshot);
    base = clone(fresh);
    if (late && late.length) applyChanges(fresh, late, ids);
    fresh.vault = keep.vault;
    data = fresh;
    remapUi(ids);
    // На экране строка «Удалено · Вернуть» — не перерисовываем, пока человек
    // не уйдёт с экрана сам: иначе «Вернуть» исчезнет через секунду.
    // Открыта форма (кредит, платёж, заметка) — не перерисовываем: иначе всё,
    // что человек успел ввести, сбрасывается к старым значениям. Новые данные
    // покажутся, когда форму закроют.
    if (document.querySelector(".sheet form, .composer")) { heldRender = true; return; }
    if (!document.querySelector(".swipe-undo")) render();
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
    } catch (error) {
      if (error && error.status === 401) askReopen();
    }
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
      if (inTelegram) setTimeout(closeApp, 600);
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

  // ------------------------------------------------------------ файлы из чата

  const STORE_KEY = "soroka-html-file:";

  /**
   * Страница живёт в песочнице без доступа к приложению: чужой скрипт не видит
   * ни данных бота, ни подписи Telegram. Но у песочницы нет своего хранилища,
   * а страницы вроде трекера курса хранят прогресс в localStorage — поэтому
   * внутрь подкладывается «хранилище» и присылает изменения родителю, а тот
   * запоминает их отдельно для каждого файла.
   */
  function storageShim(saved) {
    return `<script>(function(){var s=${JSON.stringify(saved).replace(/</g, "\u003c")};function mk(track){var api={getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(s,k)?s[k]:null},setItem:function(k,v){s[String(k)]=String(v);if(track)parent.postMessage({soroka:"storage",data:s},"*")},removeItem:function(k){delete s[String(k)];if(track)parent.postMessage({soroka:"storage",data:s},"*")},clear:function(){s={};if(track)parent.postMessage({soroka:"storage",data:s},"*")},key:function(i){return Object.keys(s)[i]||null}};Object.defineProperty(api,"length",{get:function(){return Object.keys(s).length}});return api}try{Object.defineProperty(window,"localStorage",{value:mk(true),configurable:true});Object.defineProperty(window,"sessionStorage",{value:mk(false),configurable:true})}catch(e){}})();<\/script>`;
  }

  async function openFile(item) {
    if (!item) return;
    const layer = document.createElement("div");
    layer.className = "live-file";
    layer.innerHTML = `<header><strong>${escape(item.title)}</strong><button type="button" class="live-file-close" aria-label="Закрыть">Закрыть</button></header><div class="live-file-body"><div class="live-file-wait"><span class="live-spin big"></span><small>Открываю файл…</small></div></div>`;
    document.body.appendChild(layer);
    let channel = null;
    const close = () => { layer.remove(); if (channel) window.removeEventListener("message", channel); };
    layer.querySelector(".live-file-close").addEventListener("click", close);
    const body = layer.querySelector(".live-file-body");
    try {
      const file = await call({ action: "file_open", ref: String(item.id) }, 40000);
      if (file.kind === "html") {
        const key = STORE_KEY + item.id;
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (_) {}
        const frame = document.createElement("iframe");
        // Без allow-same-origin: страница чужая, приложению она не родная.
        frame.setAttribute("sandbox", "allow-scripts allow-forms allow-modals allow-popups allow-downloads");
        frame.title = item.title;
        const shim = storageShim(saved);
        const html = /<head[^>]*>/i.test(file.html) ? file.html.replace(/<head[^>]*>/i, (m) => m + shim) : shim + file.html;
        frame.srcdoc = html;
        body.innerHTML = "";
        body.appendChild(frame);
        channel = (event) => {
          if (event.source !== frame.contentWindow || !event.data || event.data.soroka !== "storage") return;
          try {
            const text = JSON.stringify(event.data.data || {});
            if (text.length < 1_000_000) localStorage.setItem(key, text);
          } catch (_) {}
        };
        window.addEventListener("message", channel);
      } else if (file.kind === "image") {
        body.innerHTML = `<img class="live-file-image" alt="${escape(item.title)}" src="data:${escape(file.mime)};base64,${file.base64}">`;
      } else if (file.kind === "text") {
        body.innerHTML = `<pre class="live-file-text">${escape(file.text)}</pre>`;
      } else {
        body.innerHTML = `<div class="live-file-wait"><small>${escape(file.reason || "Этот файл здесь не открыть.")}</small><button type="button" class="primary-button" data-file-send>Прислать в чат</button></div>`;
        body.querySelector("[data-file-send]").addEventListener("click", () => { close(); sendToChat(String(item.id)); });
      }
    } catch (error) {
      body.innerHTML = `<div class="live-file-wait"><small>${error.status === 404 ? "Файл не найден." : "Не получилось открыть файл — проверьте связь."}</small></div>`;
    }
  }

  function intercept(event) {
    const control = event.target.closest && event.target.closest("[data-action]");
    if (!control) return;
    const action = control.dataset.action;
    const stop = () => { event.preventDefault(); event.stopImmediatePropagation(); };
    if (action === "file-open") { stop(); openFile(sheetItem()); return; }
    // Карты — сразу форма: номер карты модели угадывать нечего.
    if (action === "saved-new" && ui.page === "saved" && ui.savedCategory === "cards") { stop(); openSavedRecord("cards"); return; }
    if (action === "universal-add" || action === "saved-new" || action === "saved-search") { stop(); openComposer(); return; }
    if (action === "ticket-code-kind" && !control.closest(".live-code-full")) {
      stop();
      const item = (data.saved.tickets || []).find((t) => t.id === control.dataset.ticket);
      if (flipCodes(item, control.dataset.kind)) render();
      return;
    }

    if (action === "reset") { stop(); ui.menu = false; render(); refresh(true).then(() => say("Обновлено")); return; }
    if (action === "return-chat") { stop(); closeApp(); return; }
    if (action === "android-settings") { stop(); ui.menu = false; render(); try { android.settings(); } catch (_) {} return; }
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
      // «+» — как сообщение боту: разбирает он. Пока думает — видно, что думает;
      // разобрал — видно, что завёл, и запись открывается отсюда же.
      event.preventDefault(); event.stopImmediatePropagation();
      const text = String(new FormData(form).get("text") || "").trim();
      if (!text) return;
      const button = form.querySelector("button[type=submit]");
      if (button) { button.disabled = true; button.innerHTML = '<span class="live-spin"></span>Отправляю…'; }
      call({ action: "planner_capture", text }).then((answer) => {
        ui.sheet = null; render();
        captureProgress(text, answer.item);
      }).catch(() => {
        if (button) { button.disabled = false; button.textContent = "Разобрать сообщение"; }
        say("Не отправилось — попробуйте ещё раз");
      });
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

  // ------------------------------------------------------------ ход разбора

  const KIND_NAME = { task: "Дело", event: "Событие", note: "Заметка", link: "Материал", recipe: "Рецепт", movie: "Фильм",
    product: "Товар", debt: "Долг", payment: "Платёж", tx: "Операция", place: "Адрес", metric: "Показатель", list: "Список" };

  function captureProgress(text, item) {
    const layer = document.createElement("div");
    layer.className = "modal-backdrop live-capture-backdrop";
    layer.innerHTML = `<section class="sheet live-capture" role="dialog" aria-modal="true" aria-live="polite"><div class="sheet-handle"></div>
      <div class="live-capture-state"><span class="live-spin big"></span><strong>Бот разбирает сообщение…</strong><small>Обычно это несколько секунд</small></div>
      <p class="live-capture-source">${escape(text)}</p><div class="live-capture-actions"><button type="button" class="ghost-button" data-close>Закрыть</button></div></section>`;
    document.body.appendChild(layer);
    let open = true;
    const close = () => { open = false; layer.remove(); };
    layer.addEventListener("click", (event) => {
      if (event.target === layer || event.target.closest("[data-close]")) close();
      const again = event.target.closest("[data-again]");
      if (again) { close(); openComposer(); }
      const ref = event.target.closest("[data-ref]");
      if (ref) { close(); openRef(ref.dataset.ref); }
    });
    const started = Date.now();
    const tick = async () => {
      if (!open) return;
      const status = await call({ action: "planner_capture_status", item }).catch(() => null);
      if (status && status.done) {
        await refresh(true);
        if (!open) return;
        const records = status.records || [];
        layer.querySelector(".live-capture-state").innerHTML = records.length
          ? `<span class="live-done">✓</span><strong>${records.length === 1 ? "Записал" : `Записал ${records.length}`}</strong>`
          : `<span class="live-done">✓</span><strong>Бот ответил в чате</strong><small>Записей из этого сообщения не получилось</small>`;
        layer.querySelector(".live-capture-actions").innerHTML =
          records.map((r) => `<button type="button" class="live-capture-record" data-ref="${escape(r.ref)}"><small>${escape(KIND_NAME[r.kind] || "Запись")}</small><span>${escape(r.title || "Без названия")}</span></button>`).join("") +
          `<div class="live-capture-buttons"><button type="button" class="ghost-button" data-close>Закрыть</button><button type="button" class="primary-button" data-again>Разобрать ещё</button></div>`;
        return;
      }
      if (Date.now() - started > 90000) {
        layer.querySelector(".live-capture-state").innerHTML = `<strong>Бот ещё думает</strong><small>Ответ придёт в чат, запись появится здесь сама</small>`;
        return;
      }
      setTimeout(tick, 1500);
    };
    setTimeout(tick, 1200);
  }

  /**
   * Открыть запись по ссылке «вид:номер» — ту самую карточку, а не раздел.
   * Событие с билетом открывается билетом: у него коды и места. Раньше здесь
   * открывалось окно вида «edit», которого в приложении нет, — и кнопка из
   * чата показывала просто главный экран.
   */
  function openRef(ref) {
    const [kind, num] = String(ref).split(":");
    const has = (list, id) => (list || []).some((r) => r.id === id);
    if (kind === "event" && has(data.saved.tickets, `ticket:${num}`)) { navigate("saved"); openSavedRecord("tickets", `ticket:${num}`); return; }
    if (kind === "task" && has(data.tasks, ref)) { navigate("tasks"); openEntry("task", undefined, ref); return; }
    if (kind === "event" && has(data.events, ref)) { navigate("upcoming"); openEntry("event", undefined, ref); return; }
    if (kind === "note") { navigate("saved"); openSavedRecord("notes", ref); return; }
    // Скидочная карта — раскрытой в кошельке, с кодом.
    if (kind === "card") { navigate("saved"); ui.savedCategory = "cards"; ui.walletOpen = ref; ui.sheet = null; render(); return; }
    for (const key of Object.keys(data.saved)) {
      if (has(data.saved[key], ref)) { navigate("saved"); openSavedRecord(key, ref); return; }
    }
    const f = data.finance || {};
    if (kind === "goal" && has(f.goals, ref)) { navigate("finance"); openGoalDeposit(ref); return; }
    const entity = kind === "debt" ? "debt" : kind === "payment" ? "payment" : kind === "budget" ? "budget"
      : kind === "tx" ? (has(f.transfers, ref) ? "transfer" : "transaction") : "";
    if (entity && has(financeEntityList(entity), ref)) { navigate("finance"); openFinanceForm(entity, ref); return; }
    if (kind === "metric") { navigate("metrics"); if (has(data.metrics, ref)) { ui.sheet = { kind: "metric", id: ref, justRendered: false }; render(); } return; }
    if (kind === "project") { navigate("projects"); if (has(data.projects, ref)) { ui.sheet = { kind: "project", id: ref, justRendered: false }; render(); } return; }
    if (["tx", "debt", "payment", "budget", "goal"].includes(kind)) navigate("finance");
  }

  // ------------------------------------------------------------ ссылка из бота

  // Кнопка «Открыть в приложении» у карточки: ?page=movies&rid=5.
  const PAGE_KIND = {
    tasks: "task", events: "event", notes: "note", links: "link", recipes: "recipe", movies: "movie", goods: "product",
    debts: "debt", payments: "payment", money: "tx", shop: "list", projects: "project", lists: "list", tickets: "ticket",
    places: "place", metrics: "metric", goals: "goal", budgets: "budget", cards: "card",
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
    // Билет из чата («Открыть в приложении» у события с билетом) — его карточка.
    openRef(kind === "ticket" ? `event:${rid}` : `${kind}:${rid}`);
  }

  // ------------------------------------------------------------ коды билетов

  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "\u003c": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function liveTicketCodes(item) {
    const codes = (Array.isArray(item.codes) ? item.codes : []).filter((c) => c.text);
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
    const flip = kindSwitch(item) || `<span>${kind}</span>`;
    // Миниатюры: коды мелко в ряд; нажал — на весь экран, дальше листаешь.
    return `<section class="ticket-code-block live-codes"><div class="ticket-code-heading"><strong>${codes.length > 1 ? `Коды · ${codes.length} билета` : "Код билета"}</strong>${flip}</div><div class="live-code-thumbs" style="--codes:${Math.min(codes.length, 3)}">` +
      codes.map((c, i) => `<button type="button" class="live-code-thumb ${c.kind}" data-live-code="${i}" aria-label="Открыть код ${i + 1} на весь экран">${c.svg || `<b class="live-code-text">${escape(c.text)}</b>`}<span>${escape(c.seat || (codes.length > 1 ? `Билет ${i + 1}` : "Открыть"))}</span></button>`).join("") +
      `</div>${send}</section>`;
  }

  /*
   * QR ↔ штрихкод одной кнопкой. Сервер присылает у кода и другой вид (alt),
   * поэтому картинка меняется сразу, а выбор сохраняется правкой билета.
   */
  function kindSwitch(item) {
    const codes = ((item && item.codes) || []).filter((c) => c.text);
    if (!codes.length || !codes.every((c) => c.alt)) return "";
    const now = codes[0].kind;
    return `<div class="code-kind-switch" role="group" aria-label="Вид кода">${[["qr", "QR"], ["barcode", "Штрихкод"]].map(([key, label]) => `<button type="button" class="${now === key ? "on" : ""}" data-action="ticket-code-kind" data-kind="${key}" data-ticket="${escape(item.id)}" aria-pressed="${now === key}">${label}</button>`).join("")}</div>`;
  }
  function flipCodes(item, kind) {
    if (!item || !Array.isArray(item.codes)) return false;
    let changed = false;
    item.codes = item.codes.map((c) => {
      if (!c.text || !c.alt || c.kind === kind) return c;
      changed = true;
      return { ...c, kind, svg: c.alt, alt: c.svg, format: "" };
    });
    if (!changed) return false;
    item.codeType = item.codes[0] ? item.codes[0].kind : "";
    save();
    return true;
  }

  /** Штрихкод на весь экран — повёрнутым вдоль экрана: так он во всю высоту, сканеру проще. */
  function fullArt(c) {
    const svg = c.svg || "";
    return c.kind === "barcode" ? svg.replace("<svg ", '<svg preserveAspectRatio="none" ') : svg;
  }

  /** Коды на весь экран: белый фон, крупно — для турникета; листаются свайпом. */
  function fullCode(button) {
    // Корешок билета в списке знает свой билет сам; в карточке — открытая запись.
    const sheet = ui.sheet || {};
    const item = (data.saved.tickets || []).find((t) => t.id === (button.dataset.ticket || sheet.id));
    const codes = ((item && item.codes) || []).filter((c) => c.text);
    if (!codes.length) return;
    const start = Number(button.dataset.liveCode) || 0;
    const layer = document.createElement("div");
    layer.className = "live-code-full";
    layer.innerHTML = `<div class="live-code-track">${codes.map((c, i) => `<figure class="live-code-slide"><div class="live-code-full-art ${c.kind}">${fullArt(c)}</div><figcaption><b>${escape(codes.length > 1 ? `Билет ${i + 1} из ${codes.length}` : item.title)}</b>${c.seat ? `<span>${escape(c.seat)}</span>` : ""}<small>${escape(c.text)}</small></figcaption></figure>`).join("")}</div>` +
      `${codes.length > 1 ? `<div class="live-code-dots">${codes.map((_, i) => `<i data-dot="${i}"></i>`).join("")}</div>` : ""}<div class="live-code-kind">${kindSwitch(item)}</div><button type="button" class="live-code-close">Закрыть</button>`;
    document.body.appendChild(layer);
    // Переключатель вида прямо у турникета: картинки меняются на месте.
    layer.addEventListener("click", (event) => {
      const pick = event.target.closest && event.target.closest('[data-action="ticket-code-kind"]');
      if (!pick) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (!flipCodes(item, pick.dataset.kind)) return;
      const shown = item.codes.filter((c) => c.text);
      layer.querySelectorAll(".live-code-full-art").forEach((art, i) => { art.className = `live-code-full-art ${shown[i].kind}`; art.innerHTML = fullArt(shown[i]); });
      layer.querySelector(".live-code-kind").innerHTML = kindSwitch(item);
      render();
    }, true);
    const track = layer.querySelector(".live-code-track");
    const dots = [...layer.querySelectorAll("[data-dot]")];
    const mark = () => {
      const at = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      dots.forEach((d, i) => d.classList.toggle("on", i === at));
    };
    track.scrollLeft = start * track.clientWidth;
    mark();
    track.addEventListener("scroll", () => requestAnimationFrame(mark), { passive: true });
    const close = () => { layer.remove(); document.removeEventListener("keydown", keys, true); };
    const keys = (event) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        track.scrollBy({ left: (event.key === "ArrowRight" ? 1 : -1) * track.clientWidth, behavior: "smooth" });
      }
    };
    document.addEventListener("keydown", keys, true);
    layer.querySelector(".live-code-close").addEventListener("click", close);
  }

  // ------------------------------------------------------------ запуск

  function loadScript(entry) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = entry.src; s.async = false;
      if (entry.integrity) { s.integrity = entry.integrity; s.crossOrigin = "anonymous"; }
      const slow = setTimeout(() => reject(new Error("timeout " + entry.src)), 20000);
      s.onload = () => { clearTimeout(slow); resolve(); };
      s.onerror = () => { clearTimeout(slow); reject(new Error("script " + entry.src)); };
      document.body.appendChild(s);
    });
  }

  function splash(text, retry) {
    root.innerHTML = `<div class="live-splash"><div class="splash-mark"><img src="./assets/soroka-avatar.png" alt=""></div>${retry ? "" : '<div class="splash-bar"></div>'}<p class="${retry ? "" : "dots"}">${text}</p>${retry ? '<button type="button" id="live-retry">Попробовать ещё раз</button>' : ""}</div>`;
    const button = document.getElementById("live-retry");
    if (button) button.onclick = () => location.reload();
  }

  async function boot() {
    if (!inTelegram && !deviceKey()) {
      splash("Откройте приложение из Telegram — кнопкой «Приложение» в меню бота.");
      return;
    }
    splash("Загружаю");
    // Скрипты приложения — сразу, параллельно с данными (раньше ждали снимок).
    for (const entry of SCRIPTS) {
      const link = document.createElement("link");
      link.rel = "preload"; link.as = "script"; link.href = entry.src;
      if (entry.integrity) { link.integrity = entry.integrity; link.crossOrigin = "anonymous"; }
      document.head.appendChild(link);
    }
    // Прошлый снимок есть — открываемся сразу на нём, свежий подхватим следом.
    const freshSnapshot = call({ action: "planner_snapshot" }, 30000);
    const cachedSnapshot = lastSnapshot();
    let snapshot;
    try {
      if (cachedSnapshot) { snapshot = cachedSnapshot; warming = true; freshSnapshot.catch(() => null); }
      else { snapshot = await freshSnapshot; keepSnapshot(snapshot); }
    } catch (error) {
      splash(error.message !== "unauthorized" ? "Бот не ответил. Проверьте связь."
        : staleInit() ? "Telegram открыл старую копию приложения. Закройте его и откройте снова — кнопкой меню у поля ввода."
        : "Это приложение открывается только владельцем бота.", error.message !== "unauthorized");
      return;
    }
    try { performance.mark("soroka-data"); } catch (_) {}
    window.SOROKA_LIVE_DATA = prepare(snapshot);
    try { sessionStorage.removeItem("soroka-boot-retry"); } catch (_) {}
    root.innerHTML = "";
    // Тема — у Telegram: светлый клиент открывает светлое приложение.
    try {
      if (!localStorage.getItem("soroka-planner-theme")) localStorage.setItem("soroka-planner-theme", "telegram");
    } catch (_) {}
    for (const entry of SCRIPTS) {
      // Карта (Leaflet) не должна валить всё приложение, если CDN недоступен.
      try { await loadScript(entry); } catch (error) { if (!entry.integrity) throw error; }
    }

    // «Поделиться» — меню Telegram «Переслать в чат»: системное меню браузера
    // внутри Telegram обычно недоступно, а копирование молча не срабатывает.
    const shareInBrowser = window.shareRecord;
    window.shareRecord = async function (type, recordId) {
      const payload = sharePayload(type, recordId);
      if (!payload) { say("Запись не найдена"); return; }
      let text = payload.text || payload.title || "";
      if (type === "saved:tickets") {
        const ticket = (data.saved.tickets || []).find((t) => t.id === recordId);
        const codes = (ticket && ticket.codes) || [];
        if (ticket) {
          const when = [ticket.eventDate ? fullDate(ticket.eventDate) : "", ticket.eventTime].filter(Boolean).join(", ");
          text = [ticket.title, when, ticket.venue].filter(Boolean).join("\n");
        }
        const rows = codes.filter((c) => c.text || c.seat);
        if (rows.length) text += "\n\n" + rows.map((c, i) => [rows.length > 1 ? `Билет ${i + 1}` : "Билет", c.seat, c.text && `код ${c.text}`].filter(Boolean).join(" · ")).join("\n");
        if (ticket && ticket.inChat) text += "\n\nФото билета — в чате с ботом («Прислать билет в чат»).";
      }
      const link = payload.url && /^https?:\/\//.test(payload.url) && !String(payload.url).startsWith(location.origin) ? payload.url : "";
      if (!inTelegram && android && android.share) {
        android.share([text, link].filter(Boolean).join("\n\n"));
        return;
      }
      if (inTelegram && tg.openTelegramLink) {
        try { closeSwipeRows(); } catch (_) {}
        tg.openTelegramLink(link
          ? `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
          : `https://t.me/share/url?url=${encodeURIComponent(text)}`);
        return;
      }
      return shareInBrowser(type, recordId);
    };

    // Подборка фильмов: вкус считает приложение, новые названия — бот (до полуминуты).
    window.sorokaRecommend = () => call({ action: "movie_recommend" }, 30000);
    window.sorokaRecoGet = () => call({ action: "movie_reco_get" }, 20000);

    // Адреса ищет сервер бота: из браузера в России бесплатный геокодер
    // отвечает через раз, а серверу — стабильно (Photon).
    window.suggestAddresses = async (query, city) => ((await call({ action: "geocode_suggest", q: query, city }, 15000)) || {}).hits || [];
    window.reverseGeocode = async (lat, lng) => {
      const answer = await call({ action: "geocode_reverse", lat, lng }, 15000).catch(() => null);
      const hit = answer && answer.hit;
      return hit ? { street: [hit.street, hit.house].filter(Boolean).join(", ") || hit.name, city: hit.city } : null;
    };

    // Коды билетов — настоящие, распознанные ботом с фото (вместо демо-картинки).
    window.ticketCodeBlock = liveTicketCodes;
    document.addEventListener("click", (event) => {
      const code = event.target.closest && event.target.closest("[data-live-code]");
      if (code) { event.preventDefault(); event.stopImmediatePropagation(); fullCode(code); }
    }, true);

    // Какая страница открыта — в разметку: по ней CSS прячет «+», где он мешает.
    const paint = window.render;
    window.render = function () {
      heldRender = false;
      paint();
      document.body.dataset.page = ui.page;
      document.body.dataset.financeTab = ui.financeTab || "";
      topTitle();
    };
    if (tg && tg.onEvent) ["fullscreenChanged", "safeAreaChanged", "contentSafeAreaChanged"].forEach((name) => { try { tg.onEvent(name, topTitle); } catch (_) {} });
    try { performance.mark("soroka-scripts"); } catch (_) {}
    render();
    try { performance.mark("soroka-ready"); } catch (_) {}
    root.classList.add("live-enter");
    setTimeout(() => root.classList.remove("live-enter"), 700);

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
    // Форму закрыли, а свежие данные ждали — показываем.
    setInterval(() => { if (heldRender && !document.querySelector(".sheet form, .composer")) render(); }, 700);
    setTimeout(() => {
      base = clone(data);
      openDeepLink();
      if (!warming) return;
      freshSnapshot.then((snapshot) => {
        // Правки, сделанные за эти секунды, ложатся поверх свежего снимка.
        const late = diff(base, data);
        warming = false;
        adopt(snapshot, {}, late);
        if (late.length) schedule(50);
      }).catch((error) => {
        warming = false;
        if (error && error.status === 401) askReopen();
        else say("Нет связи с ботом — показываю данные прошлого раза");
      });
    }, 0);
  }

  // ------------------------------------------------------------ «+»: ввод и поиск сразу

  /*
   * «+» — одно поле внизу, как строка сообщения: над ним сразу находится уже
   * сохранённое (набрали «Бо…» — вот «Борат»), а отправка добавляет новое с
   * пониманием, где вы: в «Фильмах» модель ищет фильм по названию или описанию,
   * в «Постах» текст сохраняется постом и т. д. Поле держится над клавиатурой.
   * Без ИИ (кончились деньги на OpenRouter или выключено в настройках) —
   * отправка открывает обычную форму.
   */
  const COMPOSE = {
    movies: { label: "Фильм", placeholder: "Название или о чём фильм", hint: "" },
    posts: { label: "Пост", placeholder: "Текст поста или ссылка t.me", hint: "Сохрани как пост: " },
    links: { label: "Ссылка", placeholder: "Ссылка или что сохранить", hint: "Сохрани ссылку: " },
    recipes: { label: "Рецепт", placeholder: "Ссылка на рецепт или сам рецепт", hint: "Сохрани рецепт: " },
    notes: { label: "Заметка", placeholder: "Текст заметки", hint: "Заметка: ", manual: true },
    files: { label: "Файл", placeholder: "Что за файл — сам файл пришлите боту", hint: "Сохрани в файлы: " },
    lists: { label: "Список", placeholder: "Например: купить молоко, хлеб, сыр", hint: "Список: ", manual: true },
    products: { label: "Товар", placeholder: "Ссылка на товар или название", hint: "Сохрани товар: " },
    addresses: { label: "Адрес", placeholder: "Адрес или место", hint: "Сохрани адрес: ", manual: true },
    tickets: { label: "Билет", placeholder: "Фото или PDF билета пришлите боту", hint: "Билет: ", manual: true },
    plan: { label: "Запись", placeholder: "Что угодно: завтра в 12 забрать заказ, кофе 350 ₽", hint: "", manual: true },
    finance: { label: "Деньги", placeholder: "Кофе 350 ₽ или зарплата 80 000", hint: "", manual: true },
    any: { label: "Сорока", placeholder: "Напишите как боту", hint: "", manual: true },
  };
  const norm = (s) => String(s || "").toLocaleLowerCase("ru-RU").replace(/ё/g, "е");
  function composeContext() {
    if (ui.page === "saved" && ui.savedCategory && COMPOSE[ui.savedCategory]) return ui.savedCategory;
    if (["today", "upcoming", "tasks"].includes(ui.page)) return "plan";
    if (ui.page === "finance") return "finance";
    return "any";
  }
  function aiOff() {
    const router = data.settings && data.settings.openRouter;
    return Boolean(data.settings && data.settings.manualOnly) || Boolean(router && Number(router.left) <= 0);
  }
  /** Уже сохранённое, что похоже на набранное: в разделе — его записи, в плане — дела и события. */
  function composeMatches(ctx, query) {
    const q = norm(query).trim();
    if (q.length < 2) return [];
    const hit = (...values) => values.some((v) => norm(v).includes(q));
    if (ctx === "plan") {
      return [...(data.tasks || []).map((x) => ({ kind: "task", x })), ...(data.events || []).map((x) => ({ kind: "event", x }))]
        .filter(({ x }) => hit(x.title)).slice(0, 6)
        .map(({ kind, x }) => ({ ref: x.id, open: () => openRef(x.id), title: x.title, meta: `${kind === "task" ? "Дело" : "Событие"}${x.due ? " · " + x.due.split("-").reverse().slice(0, 2).join(".") : ""}` }));
    }
    const list = (data.saved && data.saved[ctx]) || [];
    // Сначала названия, начинающиеся с набранного, потом — где слово с него начинается;
    // описание — только с трёх букв и не у фильмов («Бо» в описании — не «Борат»).
    const starts = (v) => norm(v).startsWith(q) ? 0 : norm(v).split(/[^a-zа-я0-9]+/).some((w) => w.startsWith(q)) ? 1 : 9;
    const rank = (x) => Math.min(starts(x.title), starts(x.originalTitle), ctx !== "movies" && q.length >= 3 && hit(x.title, x.description) ? 2 : 9);
    return list.map((x) => [rank(x), x]).filter(([r]) => r < 9).sort((a, b) => a[0] - b[0]).map(([, x]) => x).slice(0, 6).map((x) => ({
      title: x.title, cover: ctx === "movies" ? x.coverPath : "",
      meta: ctx === "movies" ? [x.year, x.status].filter(Boolean).join(" · ") : (x.topic || x.source || ""),
      open: () => { navigate("saved"); openSavedRecord(ctx, x.id); },
    }));
  }

  let composer = null;
  function openComposer() {
    closeComposer();
    const ctx = composeContext();
    const conf = COMPOSE[ctx];
    const off = aiOff();
    const layer = document.createElement("div");
    layer.className = "composer-layer";
    layer.innerHTML = `<div class="composer-scrim" data-close></div>
      <section class="composer" role="dialog" aria-label="Добавить: ${escape(conf.label)}">
        <div class="composer-results" aria-live="polite"></div>
        <div class="composer-head"><span class="composer-chip">${escape(conf.label)}</span>${off ? '<span class="composer-off">без ИИ</span>' : ""}${conf.manual || off ? '<button type="button" class="composer-manual" data-manual>Вручную</button>' : ""}</div>
        <form class="composer-row"><textarea rows="1" placeholder="${escape(conf.placeholder)}" aria-label="${escape(conf.placeholder)}"></textarea><button type="submit" class="composer-send" aria-label="${off ? "Открыть форму" : "Добавить"}" disabled>${off ? icon("note") : icon("arrow")}</button></form>
      </section>`;
    document.body.appendChild(layer);
    document.documentElement.classList.add("composer-open");
    const field = layer.querySelector("textarea");
    const send = layer.querySelector(".composer-send");
    const results = layer.querySelector(".composer-results");
    composer = { layer, ctx, conf, field, results, off, found: [] };
    const grow = () => { field.style.height = "auto"; field.style.height = Math.min(field.scrollHeight, 140) + "px"; };
    const show = () => {
      const text = field.value;
      send.disabled = !text.trim();
      grow();
      if (composer.found.length) return;
      const hits = composeMatches(ctx, text);
      results.innerHTML = hits.length ? `<p class="composer-caption">Уже есть</p>` + hits.map((h, i) => `<button type="button" class="composer-hit" data-hit="${i}">${h.cover ? `<img src="${escape(h.cover)}" alt="" loading="lazy" onerror="this.remove()">` : ""}<span><b>${escape(h.title)}</b>${h.meta ? `<small>${escape(h.meta)}</small>` : ""}</span>${icon("right", "icon-sm")}</button>`).join("") : "";
      composer.hits = hits;
    };
    field.addEventListener("input", () => { if (composer.found.length) { composer.found = []; } show(); });
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !/Android|iPhone|iPad/.test(navigator.userAgent)) { event.preventDefault(); layer.querySelector("form").requestSubmit(); }
      if (event.key === "Escape") closeComposer();
    });
    layer.addEventListener("click", (event) => {
      if (event.target.closest("[data-close]")) { closeComposer(); return; }
      if (event.target.closest("[data-manual]")) { const text = field.value.trim(); closeComposer(); composeManual(ctx, text); return; }
      const hit = event.target.closest("[data-hit]");
      if (hit) { const h = composer.hits[Number(hit.dataset.hit)]; closeComposer(); h.open(); return; }
      const add = event.target.closest("[data-add]");
      if (add) { addFoundMovie(Number(add.dataset.add)); return; }
      const own = event.target.closest("[data-own]");
      if (own) { const id = `movie:${own.dataset.own}`; closeComposer(); navigate("saved"); openSavedRecord("movies", id); }
    });
    layer.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const text = field.value.trim();
      if (!text) return;
      if (off) { closeComposer(); composeManual(ctx, text); return; }
      if (ctx === "movies") { findMovie(text); return; }
      send.disabled = true;
      send.innerHTML = '<span class="live-spin"></span>';
      call({ action: "planner_capture", text: (conf.hint || "") + text }).then((answer) => {
        closeComposer();
        captureProgress(text, answer.item);
      }).catch(() => { send.disabled = false; send.innerHTML = icon("arrow"); say("Не отправилось — попробуйте ещё раз"); });
    });
    setTimeout(() => field.focus(), 60);
    show();
  }
  function closeComposer() {
    if (!composer) return;
    composer.layer.remove();
    composer = null;
    document.documentElement.classList.remove("composer-open");
  }
  /** Обычная форма раздела — для того, что без ИИ не угадать (адрес на карте, билет с кодами). */
  function composeManual(ctx, text) {
    if (ctx === "plan") { openEntry("task"); prefill(text); return; }
    if (ctx === "finance") { openFinanceForm("transaction", null, "expense"); return; }
    if (ctx === "any") { pickManual(text); return; }
    if (ctx === "addresses" || ctx === "lists") { ui.sheet = { kind: "saved-add-menu" }; render(); return; }
    openSavedRecord(ctx);
    prefill(text);
  }
  const MANUAL_CHOICES = [["task", "Задача", "check"], ["event", "Событие", "calendar"], ["note", "Заметка", "note"], ["list", "Список", "list"],
    ["expense", "Расход", "wallet"], ["income", "Доход", "wallet"], ["link", "Ссылка", "link"], ["recipe", "Рецепт", "recipe"],
    ["movie", "Фильм", "event"], ["address", "Адрес", "pin"], ["ticket", "Билет", "ticket"], ["password", "Пароль", "key"]];
  /** «Вручную» без контекста: что создать — плитками в том же окне, без старого меню. */
  function pickManual(text) {
    openComposer();
    const c = composer;
    c.found = [{}];
    c.results.innerHTML = `<p class="composer-caption">Что создать</p><div class="composer-choices">${MANUAL_CHOICES.map(([key, label, symbol]) => `<button type="button" data-choice="${key}">${icon(symbol)}<span>${label}</span></button>`).join("")}</div>`;
    c.results.addEventListener("click", (event) => {
      const pick = event.target.closest("[data-choice]");
      if (!pick) return;
      closeComposer();
      openChoice(pick.dataset.choice);
      prefill(text);
    });
    c.field.value = text || "";
  }
  function prefill(text) {
    if (!text) return;
    setTimeout(() => { const input = document.querySelector('.sheet form input[name="title"]'); if (input && !input.value) input.value = text.slice(0, 120); }, 30);
  }

  /** Фильм по названию или описанию: модель предлагает, IMDb подтверждает. */
  function findMovie(text) {
    const c = composer;
    const send = c.layer.querySelector(".composer-send");
    send.disabled = true;
    send.innerHTML = '<span class="live-spin"></span>';
    c.results.innerHTML = `<p class="composer-caption composer-wait"><span class="live-spin"></span>Ищу «${escape(text.slice(0, 60))}»…</p>`;
    call({ action: "movie_find", query: text }, 40000).then((answer) => {
      if (composer !== c) return;
      send.disabled = false; send.innerHTML = icon("arrow");
      c.found = answer.found || [];
      if (!c.found.length) { c.results.innerHTML = `<p class="composer-caption">${escape(answer.note || "Не нашёл.")}</p><button type="button" class="composer-hit composer-manual-row" data-manual><span><b>Добавить вручную</b><small>${escape(text.slice(0, 60))}</small></span>${icon("right", "icon-sm")}</button>`; return; }
      c.results.innerHTML = `<p class="composer-caption">${c.found.length > 1 ? "Нашёл — выберите" : "Нашёл"}</p>` + c.found.map((f, i) => {
        const facts = [f.year, f.genre, f.kind === "series" ? "сериал" : ""].filter(Boolean).join(" · ");
        const scores = [f.kpRating ? `КП ${String(f.kpRating).replace(".", ",")}` : "", f.imdbRating ? `IMDb ${String(f.imdbRating).replace(".", ",")}` : ""].filter(Boolean).join(" · ");
        return `<article class="composer-movie">${f.poster ? `<img src="${escape(f.poster)}" alt="" loading="lazy" onerror="this.remove()">` : '<span class="composer-movie-blank"></span>'}<div><b>${escape(f.title)}</b>${f.originalTitle && f.originalTitle !== f.title ? `<small>${escape(f.originalTitle)}</small>` : ""}<small>${escape(facts)}${scores ? ` · ${escape(scores)}` : ""}</small>${f.why ? `<p>${escape(f.why)}</p>` : ""}</div>${f.existing ? `<button type="button" class="ghost-button" data-own="${f.existing}">Уже есть — открыть</button>` : `<button type="button" class="primary-button" data-add="${i}">В планы</button>`}</article>`;
      }).join("");
    }).catch(() => {
      if (composer !== c) return;
      send.disabled = false; send.innerHTML = icon("arrow");
      c.results.innerHTML = `<p class="composer-caption">Поиск не ответил — попробуйте ещё раз.</p>`;
    });
  }
  /** Найденный фильм — в «В планах»; такой уже есть — открыть его, а не заводить второй. */
  function addFoundMovie(index) {
    const c = composer;
    const f = c && c.found[index];
    if (!f) return;
    const key = (s) => norm(s).replace(/[^a-zа-я0-9]+/g, " ").trim();
    const twin = (data.saved.movies || []).find((m) => (key(m.title) === key(f.title) || (f.originalTitle && key(m.originalTitle) === key(f.originalTitle))) && (!m.year || !f.year || Math.abs(Number(m.year) - Number(f.year)) <= 1));
    closeComposer();
    navigate("saved");
    if (twin) { openSavedRecord("movies", twin.id); say("Этот фильм уже есть"); return; }
    data.saved.movies.push({
      id: id(), title: f.title, description: f.why || "", topic: f.kind === "series" ? "Сериалы" : "Кино", tags: [], genre: f.genre || "", year: f.year || undefined,
      originalTitle: f.originalTitle || "", status: "Хочу посмотреть", viewed: false, rating: 0, skipped: false,
      kinopoiskUrl: f.kpUrl || "", imdbUrl: f.imdbUrl || "", kinopoiskRating: f.kpRating ?? "", imdbRating: f.imdbRating ?? "",
      coverPath: f.poster || "", source: "Поиск", created: new Date().toISOString(), pinned: false,
    });
    ui.savedCategory = "movies"; ui.savedFilter = "all";
    save();
    render();
    say(`«${f.title}» — в планах`);
  }

  // ------------------------------------------------------------ клавиатура

  /*
   * Клавиатура: нижний бар и «+» прячутся, а окна и поле ввода встают над ней
   * (--kb — сколько экрана она заняла, --vvh — сколько осталось видно). На
   * Android окно само сжимается, на iOS — нет, поэтому считаем по visualViewport.
   */
  (function watchKeyboard() {
    const vv = window.visualViewport;
    if (!vv) return;
    let tallest = vv.height;
    const update = () => {
      tallest = Math.max(tallest, vv.height);
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      const typing = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && document.activeElement.type !== "checkbox";
      const open = typing && (kb > 80 || vv.height < tallest - 150);
      const root = document.documentElement;
      root.style.setProperty("--kb", `${Math.round(kb)}px`);
      root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
      root.classList.toggle("kb-open", Boolean(open));
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("orientationchange", () => { tallest = 0; setTimeout(update, 300); });
    document.addEventListener("focusin", () => setTimeout(update, 250));
    document.addEventListener("focusout", () => setTimeout(update, 250));
    update();
  })();

  /*
   * Полноэкранный Telegram: сверху его кнопки «Закрыть» и «⋯». Между ними —
   * название раздела такой же «таблеткой», но в акцентном цвете; страница
   * начинается ниже этой полосы, а не под кнопками.
   */
  let titleBar = null;
  function pinnedEntries() {
    const hidden = new Set((data.settings && data.settings.pinsHidden) || []);
    return Object.keys(data.saved || {}).flatMap((category) => (data.saved[category] || [])
      .filter((item) => item.pinned && !hidden.has(item.id)).map((item) => ({ category, item })));
  }
  function showPinned() {
    try { tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred("light"); } catch (_) {}
    if (ui.page === "saved" && (!ui.savedCategory || ui.savedCategory === "overview") && !ui.sheet) {
      ui.savedPinsOpen = true;
      render();
      const panel = root.querySelector(".saved-pinned-panel");
      if (panel) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        panel.classList.remove("pins-pulse"); void panel.offsetWidth; panel.classList.add("pins-pulse");
      }
      return;
    }
    const old = document.querySelector(".pins-drop");
    if (old) { old.classList.add("closing"); setTimeout(() => old.remove(), 180); return; }
    const pins = pinnedEntries();
    const layer = document.createElement("div");
    layer.className = "pins-drop";
    layer.innerHTML = `<div class="pins-drop-scrim"></div><section class="pins-drop-card" role="dialog" aria-label="Закреплённое"><header>${icon("bookmark", "icon-sm")}<strong>Закреплённое</strong><small>${pins.length}</small></header>` +
      (pins.length ? pins.map(({ category, item }, i) => `<button type="button" data-pin="${i}" style="--i:${i}"><b>${escape(item.title)}</b><small>${escape((typeof SAVED_NAMES !== "undefined" && SAVED_NAMES[category]) || "")}</small>${icon("right", "icon-sm")}</button>`).join("")
        : `<p>Закрепите карточку в любом разделе — она появится здесь.</p>`) + `</section>`;
    document.body.appendChild(layer);
    const close = () => { layer.classList.add("closing"); setTimeout(() => layer.remove(), 180); };
    layer.addEventListener("click", (event) => {
      const pick = event.target.closest("[data-pin]");
      if (pick) { const { category, item } = pins[Number(pick.dataset.pin)]; layer.remove(); navigate("saved"); openSavedRecord(category, item.id); return; }
      if (event.target.closest(".pins-drop-scrim")) close();
    });
  }
  // Приложение телефона: кнопок Telegram сверху нет, поэтому отдельной полосы
  // тоже нет — плашка с названием встаёт в строку заголовка страницы, между
  // надзаголовком и кнопками; настройки телефона — в меню «⋮».
  const androidApp = !inTelegram && Boolean(deviceKey());
  if (androidApp) {
    document.documentElement.style.setProperty("--tg-safe-area-inset-top", "0px");
    document.documentElement.style.setProperty("--tg-content-safe-area-inset-top", "0px");
  }
  function headPill(text) {
    const row = root.querySelector(".main .page-header, .main .notes-topline");
    if (!row || !text) return;
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "head-pill";
    pill.textContent = text;
    pill.setAttribute("aria-label", `${text} — закреплённое`);
    pill.addEventListener("click", showPinned);
    row.classList.add("has-pill");
    row.appendChild(pill);
  }
  let barsColor = "";
  function paintBars() {
    if (!androidApp || !android.bars) return;
    const rgb = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
    if (!rgb) return;
    const hex = "#" + rgb.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
    if (hex === barsColor) return;
    barsColor = hex;
    const light = (Number(rgb[0]) * 299 + Number(rgb[1]) * 587 + Number(rgb[2]) * 114) / 1000 > 150;
    try { android.bars(hex, light); } catch (_) {}
  }
  function topTitle() {
    paintBars();
    const full = Boolean(inTelegram && tg.isFullscreen) || androidApp;
    document.documentElement.classList.toggle("tg-fs", full);
    if (!full) { if (titleBar) titleBar.hidden = true; return; }
    if (androidApp) {
      const heading = root.querySelector(".main .page-header h1, .main .saved-section-heading h1");
      headPill(heading ? heading.textContent.trim() : "");
      return;
    }
    if (!titleBar) {
      titleBar = document.createElement("div");
      titleBar.className = "tg-title";
      titleBar.innerHTML = '<span role="button" tabindex="0" aria-label="Закреплённое"></span>';
      titleBar.firstChild.addEventListener("click", showPinned);
      document.body.appendChild(titleBar);
    }
    const heading = root.querySelector(".main .page-header h1, .main .saved-section-heading h1");
    const text = heading ? heading.textContent.trim() : "";
    const pill = titleBar.firstChild;
    pill.textContent = text;
    titleBar.hidden = !text && !androidApp;
    // Слово целиком: не влезает — шрифт чуть меньше, а не «Предсто…».
    let size = 14;
    pill.style.fontSize = size + "px";
    while (text && size > 10 && pill.scrollWidth > pill.clientWidth + 1) { size -= 0.5; pill.style.fontSize = size + "px"; }
  }

  // Загрузка не должна висеть молча: что бы ни сломалось — сказать и дать повторить.
  boot().catch((error) => {
    const why = String((error && (error.stack || error.message)) || error).slice(0, 300);
    try { if (android && android.log) android.log(why); } catch (_) {}
    // Первый сбой — сбрасываем данные прошлого запуска и пробуем заново один раз:
    // испорченный сохранённый снимок не должен запирать приложение.
    let tried = false;
    try { tried = sessionStorage.getItem("soroka-boot-retry") === "1"; } catch (_) {}
    if (!tried) {
      try { sessionStorage.setItem("soroka-boot-retry", "1"); localStorage.removeItem(SNAP_KEY); } catch (_) {}
      location.reload();
      return;
    }
    splash("Не получилось открыть приложение. Проверьте связь и попробуйте ещё раз.", true);
    const box = root.querySelector(".live-splash");
    if (box) {
      const note = document.createElement("small");
      note.className = "live-splash-error";
      note.textContent = why.split("\n")[0];
      box.appendChild(note);
      if (androidApp && android.settings) {
        const gear = document.createElement("button");
        gear.type = "button"; gear.textContent = "Настройки телефона";
        gear.addEventListener("click", () => { try { android.settings(); } catch (_) {} });
        box.appendChild(gear);
      }
    }
    try { sessionStorage.removeItem("soroka-boot-retry"); } catch (_) {}
  });
})();
