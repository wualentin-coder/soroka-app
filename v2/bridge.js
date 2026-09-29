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
  const SCRIPTS = [{"src":"https://unpkg.com/leaflet@1.9.4/dist/leaflet.js","integrity":"sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="},{"src":"./saved.js?v=b8ad42ddb8","integrity":null},{"src":"./address-map.js?v=02bfe9223e","integrity":null},{"src":"./finance.js?v=03d9f50317","integrity":null},{"src":"./more.js?v=79e79cdb1e","integrity":null},{"src":"./capture.js?v=2ea89f646c","integrity":null},{"src":"./sections.js?v=3e8faa6cea","integrity":null},{"src":"./app.js?v=ced30dfa2f","integrity":null}];
  const tg = window.Telegram && window.Telegram.WebApp;
  const root = document.getElementById("app");

  window.SOROKA_LIVE = true;
  try { tg && tg.ready(); tg && tg.expand(); } catch (_) {}
  // Свайп вниз по карточкам не должен сворачивать приложение (Bot API 7.7+).
  try { tg && tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (_) {}

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
    layer.querySelector("[data-reopen]").addEventListener("click", () => { try { tg && tg.close(); } catch (_) {} });
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
    base = clone(fresh);
    if (late && late.length) applyChanges(fresh, late, ids);
    fresh.vault = keep.vault;
    data = fresh;
    remapUi(ids);
    // На экране строка «Удалено · Вернуть» — не перерисовываем, пока человек
    // не уйдёт с экрана сам: иначе «Вернуть» исчезнет через секунду.
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
      if (again) { close(); ui.sheet = { kind: "addmenu", justRendered: false }; render(); }
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
    places: "place", metrics: "metric", goals: "goal", budgets: "budget",
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

  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

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
    // Миниатюры: коды мелко в ряд; нажал — на весь экран, дальше листаешь.
    return `<section class="ticket-code-block live-codes"><div class="ticket-code-heading"><strong>${codes.length > 1 ? `Коды · ${codes.length} билета` : "Код билета"}</strong><span>${kind}</span></div><div class="live-code-thumbs" style="--codes:${Math.min(codes.length, 3)}">` +
      codes.map((c, i) => `<button type="button" class="live-code-thumb ${c.kind}" data-live-code="${i}" aria-label="Открыть код ${i + 1} на весь экран">${c.svg || `<b class="live-code-text">${escape(c.text)}</b>`}<span>${escape(c.seat || (codes.length > 1 ? `Билет ${i + 1}` : "Открыть"))}</span></button>`).join("") +
      `</div>${send}</section>`;
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
    layer.innerHTML = `<div class="live-code-track">${codes.map((c, i) => `<figure class="live-code-slide"><div class="live-code-full-art ${c.kind}">${c.svg || ""}</div><figcaption><b>${escape(codes.length > 1 ? `Билет ${i + 1} из ${codes.length}` : item.title)}</b>${c.seat ? `<span>${escape(c.seat)}</span>` : ""}<small>${escape(c.text)}</small></figcaption></figure>`).join("")}</div>` +
      `${codes.length > 1 ? `<div class="live-code-dots">${codes.map((_, i) => `<i data-dot="${i}"></i>`).join("")}</div>` : ""}<button type="button" class="live-code-close">Закрыть</button>`;
    document.body.appendChild(layer);
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
      splash(error.message !== "unauthorized" ? "Бот не ответил. Проверьте связь."
        : staleInit() ? "Telegram открыл старую копию приложения. Закройте его и откройте снова — кнопкой меню у поля ввода."
        : "Это приложение открывается только владельцем бота.", error.message !== "unauthorized");
      return;
    }
    window.SOROKA_LIVE_DATA = prepare(snapshot);
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
      if (tg && tg.openTelegramLink) {
        try { closeSwipeRows(); } catch (_) {}
        tg.openTelegramLink(link
          ? `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
          : `https://t.me/share/url?url=${encodeURIComponent(text)}`);
        return;
      }
      return shareInBrowser(type, recordId);
    };

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
