/* Дизайн-прототип: все записи хранятся только в этом браузере. */
const STORAGE_KEY = "soroka-planner-prototype-v1";
/** Темы: основа (тёмная или светлая) и палитра поверх неё. «Как в Telegram» — по клиенту. */
const THEMES = {
  telegram: { label: "Как в Telegram", tone: () => (window.Telegram?.WebApp?.colorScheme || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")) },
  dark: { label: "Тёмная", tone: "dark" }, midnight: { label: "Ночь", tone: "dark" }, graphite: { label: "Графит", tone: "dark" },
  light: { label: "Светлая", tone: "light" }, sand: { label: "Песок", tone: "light" }, mint: { label: "Мята", tone: "light" }
};
function themeTone() { const t = THEMES[ui.theme] || THEMES.dark; return typeof t.tone === "function" ? t.tone() : t.tone; }
const ACCENTS = [["teal", "Бирюзовый", "#58d0cf"], ["blue", "Синий", "#76a9ff"], ["indigo", "Индиго", "#8b93ff"], ["violet", "Фиолетовый", "#b99aff"], ["pink", "Розовый", "#f58bb8"], ["red", "Красный", "#ff7b7b"], ["orange", "Оранжевый", "#ffa35c"], ["amber", "Янтарный", "#f2c14e"], ["green", "Зелёный", "#6fcf7f"]];
const THEME_KEY = "soroka-planner-theme";
const app = document.getElementById("app");

const icons = {
  today: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/><path d="m9 15 2 2 4-4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  inbox: '<path d="M4 4h16l2 11v5H2v-5L4 4Z"/><path d="M2 15h6l2 3h4l2-3h6"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>',
  rows: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  close: '<path d="M5 5 19 19M19 5 5 19"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 3.8 4 7.1 4c2 0 3.6 1.1 4.9 2.9C13.3 5.1 14.9 4 16.9 4c3.3 0 5.5 3.2 4.3 6.6C19.5 15.4 12 20 12 20z"/>',
  clip: '<path d="m20.5 11.5-8.3 8.3a5.3 5.3 0 0 1-7.5-7.5l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.6 8.6a1.8 1.8 0 0 1-2.5-2.5l7.9-7.9"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  flag: '<path d="M5 21V4m0 1c4-3 7 3 14 0v11c-7 3-10-3-14 0"/>',
  note: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 .4l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7-.4l-2 2a5 5 0 0 0 7 7l1-1"/>',
  wallet: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M16 14h2"/>',
  moon: '<path d="M20 15.5A8 8 0 0 1 8.5 4 8 8 0 1 0 20 15.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v5h5"/>',
  event: '<path d="M4 20h16M6 20V7l6-4 6 4v13M9 12h6M9 16h6"/>',
  arrow: '<path d="M4 12h16m-7-7 7 7-7 7"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  bookmark: '<path d="M5 4h14v17l-7-5-7 5V4Z"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8m-9 5h4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9 2 2-2 2 1 1-2 2-2-2-2 2"/>',
  project: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 9v12"/>',
  settings: '<path d="M10.3 2.6h3.4l.5 2.6a7.6 7.6 0 0 1 1.9 1.1l2.5-.9 1.7 2.9-2 1.8a7.7 7.7 0 0 1 0 2.2l2 1.8-1.7 2.9-2.5-.9a7.6 7.6 0 0 1-1.9 1.1l-.5 2.6h-3.4l-.5-2.6a7.6 7.6 0 0 1-1.9-1.1l-2.5.9-1.7-2.9 2-1.8a7.7 7.7 0 0 1 0-2.2l-2-1.8 1.7-2.9 2.5.9a7.6 7.6 0 0 1 1.9-1.1Z"/><circle cx="12" cy="12" r="3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6"/>',
  chart: '<path d="M3 20h18M5 17V9m5 8V5m5 12v-6m5 6V3"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  eyeOff: '<path d="m3 3 18 18M9.9 6.2A11.7 11.7 0 0 1 12 6c6.5 0 10 6 10 6a14 14 0 0 1-3.2 3.5M6.1 8.2C3.5 10 2 12 2 12s3.5 6 10 6c1.5 0 2.8-.3 4-.8"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  share: '<circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="m8 11 8-5m-8 8 8 4"/>',
  external: '<path d="M13 4h7v7M20 4l-9 9"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
  grip: '<path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" stroke-width="3"/>',
  filter: '<path d="M3 4h18l-7 8v7l-4 2v-9L3 4Z"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 20h16"/>',
  upload: '<path d="M12 21V9m-4 4 4-4 4 4M4 4h16"/>',
  pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  ticket: '<path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Z"/><path d="M14 5v2m0 3v2m0 3v4"/>',
  thumbDown: '<path d="M17 14V3M21 12V5a2 2 0 0 0-2-2H7.4a2 2 0 0 0-1.9 1.4L3.1 12.3A2 2 0 0 0 5 15h4.6l-.8 4.2a2 2 0 0 0 2 2.3c.5 0 1-.2 1.3-.6L17 14"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  locate: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>'
};
function icon(name, size = "") {
  return `<svg class="icon ${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.note}</svg>`;
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&#39;" }[c]));
}
function localIso(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
function parseDate(value) {
  const [y, m, d] = String(value).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
function shiftDay(date, count) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  next.setDate(next.getDate() + count);
  return next;
}
function offsetIso(count) { return localIso(shiftDay(new Date(), count)); }
function todayIso() { return localIso(new Date()); }
function fullDate(value) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(parseDate(value));
}
function shortDate(value) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(parseDate(value));
}
function monthName(value) {
  const text = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(parseDate(value)).replace(/\s*г\.?$/, "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function dateLabel(value) {
  if (!value) return "Без даты";
  if (value === todayIso()) return "Сегодня";
  if (value === offsetIso(1)) return "Завтра";
  if (value === offsetIso(-1)) return "Вчера";
  return shortDate(value);
}
function word(count, one, few, many) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
function id() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function seed() {
  return {
    tasks: [
      { id: id(), title: "Отправить документы бухгалтеру", due: offsetIso(-1), time: "", priority: "high", project: "Работа", description: "Проверить последние страницы перед отправкой.", done: false },
      { id: id(), title: "Подготовить смету проекта", due: offsetIso(0), time: "10:30", priority: "high", project: "Работа", description: "Сверить материалы и сроки.", done: false },
      { id: id(), title: "Позвонить стоматологу", due: offsetIso(0), time: "13:00", priority: "medium", project: "Личное", description: "Уточнить запись на следующую неделю.", done: false },
      { id: id(), title: "Купить корм", due: offsetIso(0), time: "", priority: "low", project: "Личное", description: "", done: false },
      { id: id(), title: "Забрать заказ", due: offsetIso(1), time: "12:00", priority: "medium", project: "Личное", description: "", done: false },
      { id: id(), title: "Согласовать макеты", due: offsetIso(2), time: "", priority: "high", project: "Работа", description: "", done: false },
      { id: id(), title: "Оплатить подписку", due: offsetIso(5), time: "", priority: "medium", project: "Финансы", description: "", done: false }
    ],
    events: [
      { id: id(), title: "Встреча с дизайнером", due: offsetIso(0), time: "15:30", description: "Видеозвонок · обсудить новый экран" },
      { id: id(), title: "Планирование недели", due: offsetIso(2), time: "11:00", description: "Рабочий созвон" }
    ],
    notes: [
      { id: id(), title: "Идеи для поездки", description: "Маршрут, билеты и места, которые хочется посмотреть.", topic: "Поездки" },
      { id: id(), title: "Рецепт лимонного пирога", description: "Заметка, сохранённая из чата.", topic: "Идеи" }
    ],
    inbox: [
      { id: id(), type: "Сообщение", title: "Проверить предложение по ремонту", detail: "Из переписки · 12:40" },
      { id: id(), type: "Ссылка", title: "Статья о городских маршрутах", detail: "Сохранено из Telegram · вчера" },
      { id: id(), type: "Файл", title: "Смета_сентябрь.pdf", detail: "Документ · вчера" }
    ],
    ...extraSeed()
  };
}
function load() {
  const fresh = seed();
  // Рабочее приложение: данные бота уже загрузил bridge.js — демо и localStorage не нужны.
  if (window.SOROKA_LIVE_DATA) return hydrateExtra(window.SOROKA_LIVE_DATA, fresh);
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (value && Array.isArray(value.tasks) && Array.isArray(value.events) && Array.isArray(value.notes) && Array.isArray(value.inbox)) return hydrateExtra(value, fresh);
  } catch (_) { /* Демо работает и при запрете localStorage. */ }
  return hydrateExtra(fresh, fresh);
}
function save() {
  try { const safe = { ...data }; delete safe.vault; localStorage.setItem(STORAGE_KEY, JSON.stringify(safe)); return true; } catch (_) { return false; }
}
let data = load();
const validPages = ["today", "upcoming", "tasks", "saved", "finance", "vault", "inbox", "overview", "projects", "metrics", "archive", "settings", "more", "vpn"];
function currentPage() { const name = location.hash.slice(1); const page = validPages.includes(name) ? name : validPages.includes(data.settings.startPage) ? data.settings.startPage : "today"; return page === "overview" ? "today" : page; }
const ui = {
  page: currentPage(),
  selected: todayIso(),
  month: todayIso().slice(0, 7) + "-01",
  mode: "week",
  calendarExpanded: false,
  calendarAnchor: todayIso(),
  savedCategory: "overview",
  savedSection: "",
  savedView: "list",
  savedFilter: "all",
  savedSort: "newest",
  savedQuery: "",
  addressView: "list",
  mapCategory: "",
  mapPlacing: false,
  mapSelectedId: null,
  mapCenter: null,
  mapZoom: 12,
  financeTab: "overview",
  financeCategory: "",
  projectId: null,
  vaultUnlocked: false,
  vaultShown: null,
  vaultQuery: "",
  inboxFilter: "all",
  archiveTab: "trash",
  searchQuery: "",
  searchType: "all",
  searchPage: 1,
  demoState: "normal",
  overdueOpen: true,
  menu: false,
  sheet: null,
  toast: "",
  theme: (() => { try { const saved = localStorage.getItem(THEME_KEY); return THEMES[saved] ? saved : "dark"; } catch (_) { return "dark"; } })()
};
let toastTimer = null;

function openTasks() { return data.tasks.filter(t => !t.done); }
function overdueTasks() { return openTasks().filter(t => t.due && t.due < todayIso()).sort((a, b) => a.due.localeCompare(b.due)); }
// Порядок, заданный перетаскиванием, важнее времени; без него — по времени.
function tasksOn(date) { const ord = t => Number.isFinite(Number(t.order)) && t.order !== "" && t.order !== undefined ? Number(t.order) : 1e6; return data.tasks.filter(t => t.due === date).sort((a, b) => Number(a.done) - Number(b.done) || ord(a) - ord(b) || (a.time || "99:99").localeCompare(b.time || "99:99")); }
function eventsOn(date) { return data.events.filter(e => e.due === date).sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")); }
function isTodayPage() { return ui.page === "today"; }

const navigation = [
  ["today", "Сегодня", "today"],
  ["upcoming", "Предстоящие", "calendar"],
  ["tasks", "Дела", "check"],
  ["saved", "Сохранённое", "bookmark"],
  ["finance", "Финансы", "wallet"],
  ["inbox", "Входящие", "inbox"],
  ["projects", "Проекты", "project"],
  ["vault", "Пароли", "key"],
  ["archive", "Архив", "archive"],
  ["settings", "Настройки", "settings"],
  ["more", "Все разделы", "more"]
];
const mobileNavigation = [["today", "План", "today"], navigation[3], navigation[4], ["more", "Ещё", "more"]];
function navItem([page, label, symbol], mobile = false) {
  const active = ui.page === page || (page === "more" && mobile && !mobileNavigation.slice(0, 4).some(([name]) => name === ui.page));
  const count = page === "inbox" && data.inbox.length && !mobile ? `<span class="nav-count">${data.inbox.length}</span>` : "";
  return `<button type="button" class="${active ? "active" : ""}" data-action="navigate" data-page="${page}" ${active ? 'aria-current="page"' : ""}>${icon(symbol)}<span>${label}</span>${count}</button>`;
}
function brand() {
  return `<img class="brand-mark" src="./assets/flow-logo.svg" alt=""><div><span class="brand-name">FLOW</span><span class="brand-label">личное пространство</span></div>`;
}
function header(title, subtitle, eyebrow) {
  return `<header class="page-header"><div><h1>${title}</h1></div><div class="header-actions"><button class="icon-button" type="button" data-action="search" aria-label="Поиск">${icon("search")}</button><div class="header-menu-wrap"><button class="icon-button" type="button" data-action="menu" aria-label="Меню" aria-expanded="${ui.menu}">${icon("more")}</button>${ui.menu ? `<div class="header-menu"><button type="button" data-action="theme">${icon(themeTone() === "dark" ? "sun" : "moon")}<span>${themeTone() === "dark" ? "Светлая тема" : "Тёмная тема"}</span></button><button type="button" data-action="reset">${icon("reset")}<span>${window.SOROKA_LIVE ? "Обновить данные" : "Сбросить данные"}</span></button>${window.SorokaAndroid && window.SorokaAndroid.settings ? `<button type="button" data-action="android-settings">${icon("settings")}<span>Настройки телефона</span></button>` : ""}</div>` : ""}</div></div></header>`;
}
/*
 * Чек-лист в задаче: пункты отмечаются прямо в карточке. Все отмечены —
 * задача закрывается сама; закрыть раньше можно обычной галочкой задачи.
 */
function checklistProgress(task) {
  const list = task.checklist || [];
  if (!list.length) return "";
  return `<span class="task-checklist-count">${icon("check", "icon-sm")}${list.filter(c => c.done).length}/${list.length}</span>`;
}
function checklistBlock(task) {
  const list = task.checklist || [];
  if (!list.length) return "";
  const open = (ui.openChecklists || []).includes(task.id);
  const head = `<button type="button" class="task-checklist-toggle ${open ? "open" : ""}" data-action="task-checklist-toggle" data-id="${esc(task.id)}" aria-expanded="${open}">${icon(task.listRef ? "list" : "check", "icon-sm")}<span>${task.listRef ? "Список" : "Подзадачи"} · ${list.filter(c => c.done).length} из ${list.length}</span>${icon("down", "icon-sm")}</button>`;
  if (!open) return `<div class="task-sub">${head}</div>`;
  // Отмеченные — вниз, порядок внутри групп как в списке; номер пункта прежний.
  const order = list.map((c, i) => [c, i]).sort((a, b) => Number(a[0].done) - Number(b[0].done));
  return `<div class="task-sub">${head}<ul class="task-checklist">${order.map(([c, i]) => `<li data-sub="${i}"><button type="button" class="task-checklist-item ${c.done ? "done" : ""}" data-action="task-check-item" data-id="${esc(task.id)}" data-index="${i}" aria-pressed="${Boolean(c.done)}"><span class="task-checklist-box">${c.done ? icon("check", "icon-sm") : ""}</span><span>${esc(c.text)}</span></button></li>`).join("")}</ul></div>`;
}
function toggleChecklistItem(recordId, index) {
  const task = data.tasks.find(item => item.id === recordId);
  const row = task?.checklist?.[index];
  if (!row) return;
  row.done = !row.done;
  // Список из «Сохранённого» — отметка и в нём самом.
  const list = task.listRef ? (data.saved.lists || []).find(item => item.id === task.listRef) : null;
  const same = list?.items?.find(entry => entry.text === row.text);
  if (same) same.done = row.done;
  const all = task.checklist.every(c => c.done);
  if (all && !task.done) { task.done = true; toast("Все пункты отмечены — задача закрыта"); }
  else if (!all && task.done) task.done = false;
  save();
  // Пункт уезжает на новое место плавно (FLIP): запомнили, где был, — перерисовали — довели.
  const card = sel => document.querySelector(`.task-card[data-task-id="${CSS.escape(recordId)}"] ${sel}`);
  const before = new Map([...(document.querySelectorAll(`.task-card[data-task-id="${CSS.escape(recordId)}"] [data-sub]`))].map(li => [li.dataset.sub, li.getBoundingClientRect().top]));
  render();
  if (!card(".task-checklist")) return;
  document.querySelectorAll(`.task-card[data-task-id="${CSS.escape(recordId)}"] [data-sub]`).forEach(li => {
    const was = before.get(li.dataset.sub);
    const shift = was === undefined ? 0 : was - li.getBoundingClientRect().top;
    if (Math.abs(shift) > 1) li.animate([{ transform: `translateY(${shift}px)` }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,.8,.3,1)" });
  });
}
function taskCard(task) {
  const late = !task.done && task.due && task.due < todayIso();
  const date = task.due && (late || !isTodayPage()) ? `<span class="${late ? "late" : ""}">${icon("calendar", "icon-sm")}${esc(dateLabel(task.due))}</span>` : "";
  const time = task.time ? `<span>${icon("clock", "icon-sm")}${esc(task.time)}</span>` : "";
  const project = task.project ? `<span>${esc(task.project)}</span>` : "";
  const noDate = !task.due && ui.page === "tasks" ? `<span>Без даты</span>` : "";
  const completesOnTap = ui.page === "today" || ui.page === "upcoming";
  const mainLabel = completesOnTap ? `${task.done ? "Вернуть задачу" : "Завершить задачу"}: ${task.title}` : `Открыть задачу: ${task.title}`;
  const dragHandle = ui.page === "upcoming" ? `<span class="task-drag-handle" draggable="true" role="img" aria-label="Перетащить задачу на другой день" title="Перетащить на другой день">${icon("grip", "icon-sm")}</span>` : "";
  return `<article class="task-card ${late ? "overdue" : ""} ${task.done ? "is-done" : ""}" data-task-id="${esc(task.id)}"><button class="task-check ${task.done ? "checked" : ""}" type="button" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.done ? "Вернуть задачу" : "Завершить задачу"}: ${esc(task.title)}">${icon("check", "icon-sm")}</button><button class="task-main" type="button" data-action="edit" data-type="task" data-id="${esc(task.id)}" aria-label="${esc(mainLabel)}"><span class="task-title">${esc(task.title)}</span><span class="task-meta">${date}${time}${project}${noDate}</span></button>${checklistBlock(task)}<span class="task-card-trailing"><i class="priority-marker ${esc(task.priority)}" aria-hidden="true"></i>${dragHandle}</span></article>`;
}
function eventCard(event) {
  return `<button class="event-card" type="button" data-action="edit" data-type="event" data-id="${esc(event.id)}"><span class="event-time">${esc(event.time || "Весь день")}</span><i class="event-rule" aria-hidden="true"></i><span class="event-info"><span class="event-title">${esc(event.title)}</span>${event.description ? `<span class="event-place">${esc(event.description)}</span>` : ""}</span></button>`;
}
function emptyCard(title, detail) { return `<div class="empty-card"><strong>${title}</strong>${detail}</div>`; }
function todayPage() {
  const today = todayIso();
  const daily = tasksOn(today);
  const pending = daily.filter(t => !t.done);
  const done = daily.length - pending.length;
  const percentage = daily.length ? Math.round(done / daily.length * 100) : 100;
  const late = overdueTasks();
  const meetings = eventsOn(today);
  const hero = `<div class="hero-panel"><div class="hero-top"><div><p class="hero-date">${esc(fullDate(today))}</p><div class="hero-number">${pending.length}<span>${word(pending.length, "дело", "дела", "дел")} на сегодня</span></div></div><div class="hero-mini">${percentage}%<br><span style="color:var(--subtle);font-weight:600">выполнено</span></div></div><div class="progress-track"><span style="width:${percentage}%"></span></div><div class="progress-caption"><span>${done} завершено</span><span>${daily.length} всего</span></div></div>`;
  const overdue = late.length ? `<section class="section overdue-section"><div class="section-heading overdue-heading"><h2>Просрочено <span class="count">${late.length}</span></h2><button class="text-action" type="button" data-action="move-overdue">Перенести на сегодня ${icon("arrow", "icon-sm")}</button></div>${ui.overdueOpen ? `<div class="overdue-list">${late.map(taskCard).join("")}</div>` : ""}<button class="text-action" type="button" data-action="toggle-overdue">${ui.overdueOpen ? "Свернуть" : "Показать"} ${icon(ui.overdueOpen ? "up" : "down", "icon-sm")}</button></section>` : "";
  // Платежи, срок которых настал (или прошёл), — тоже дела на сегодня.
  const duePays = (data.finance?.payments || []).filter(p => p.status !== "confirmed" && p.nextOn && p.nextOn <= today);
  const payCards = duePays.map(p => `<article class="task-card pay-task ${p.nextOn < today ? "overdue" : ""}"><button class="task-check" type="button" data-action="payment-confirm" data-id="${esc(p.id)}" aria-label="Оплачено: ${esc(p.title)}">${icon("check", "icon-sm")}</button><button class="task-main" type="button" data-action="finance-open-payments"><span class="task-title">${esc(p.title)}</span><span class="task-meta"><span>${icon("wallet", "icon-sm")}Платёж${p.nextOn < today ? ` · с ${esc(dateLabel(p.nextOn))}` : ""}</span></span></button><span class="pay-task-sum">${demoMoney(p.amount, p.currency || "RUB")}</span></article>`).join("");
  const tasks = !daily.length && !duePays.length ? "" : `<section class="section"><div class="section-heading"><h2>Задачи на сегодня</h2><span class="count">${daily.length + duePays.length}</span></div><div class="task-stack">${payCards}${daily.length ? daily.map(taskCard).join("") : duePays.length ? "" : emptyCard("План свободен", "Добавьте задачу кнопкой ниже или пришлите её боту обычным сообщением.")}</div></section>`;
  const events = !meetings.length ? "" : `<section class="section"><div class="section-heading"><h2>В расписании</h2><span class="count">${meetings.length}</span></div>${meetings.length ? meetings.map(eventCard).join("") : emptyCard("Событий пока нет", "Можно добавить встречу на сегодня.")}</section>`;
  const aside = `<div class="side-card"><h3>Ближайшие дни</h3>${[1, 2, 3].map(n => { const day = offsetIso(n); const count = tasksOn(day).filter(t => !t.done).length + eventsOn(day).length; return `<div class="side-row"><span>${esc(dateLabel(day))}</span><b>${count} ${word(count, "запись", "записи", "записей")}</b></div>`; }).join("")}<button class="text-action" type="button" data-action="navigate" data-page="upcoming">Открыть календарь ${icon("arrow", "icon-sm")}</button></div><div class="side-card"><h3>Быстрый ввод</h3><p class="side-note">Задачи удобно отправлять боту обычным текстом. </p></div>`;
  const tickets = typeof todayTicketsSection === "function" ? todayTicketsSection() : "";
  // «Сегодня» и «Предстоящие» — одна вкладка: календарь сверху, под ним день.
  // Сегодня — как раньше (итог, просроченное, дела, расписание); другой день — его дела.
  // Календарь и «сегодня» — одна карточка: сколько дел и сколько сделано — в её шапке.
  const isToday = !ui.selected || ui.selected === today;
  const summary = isToday
    ? `<span class="plan-summary"><b>${pending.length}</b> ${word(pending.length, "дело", "дела", "дел")}${done ? ` · ${done} сделано` : ""}</span>`
    : `<button type="button" class="plan-summary is-link" data-action="calendar-today">К сегодня</button>`;
  // Пустой день — без полосы прогресса: «100%» при нуле дел только путает.
  const cal = calendarCard(summary, isToday && daily.length ? percentage : null);
  // Ближайшие дни рождения — на неделю вперёд: о них вспоминают заранее, а не в день.
  const birthdaysSoon = typeof todayBirthdaysSection === "function" ? todayBirthdaysSection() : "";
  // Ни дел, ни встреч — одна короткая строка вместо двух пустых карточек.
  const free = !tasks && !events ? `<p class="plan-free">${icon("check", "icon-sm")}На сегодня ни дел, ни встреч</p>` : "";
  // Из бывшего «Обзора» — деньги и «продолжить»: коротко, внизу дня.
  const glance = typeof rubBalance === "function" ? (() => {
    const pending = (data.finance?.payments || []).filter(p => p.status === "pending" && p.nextOn).sort((a, b) => a.nextOn.localeCompare(b.nextOn));
    const last = ui.lastOpened;
    return `<section class="section plan-glance"><button type="button" class="glance-tile" data-action="navigate" data-page="finance"><small>Доступно</small><strong>${demoMoney(rubBalance())}</strong>${pending[0] ? `<span>${esc(pending[0].title)} · ${esc(dateLabel(pending[0].nextOn))}</span>` : `<span>Платежи оплачены</span>`}</button>${last?.title ? `<button type="button" class="glance-tile" data-action="overview-continue"><small>Продолжить</small><strong>${esc(last.title)}</strong><span>Последняя открытая запись</span></button>` : ""}</section>`;
  })() : "";
  const body = isToday ? `${overdue}${tasks}${events}${free}${birthdaysSoon}${tickets}${glance}` : dayAgenda(ui.selected);
  return `${header("План", "Сегодня, неделя и месяц — в одном месте", "Мой день")}<div class="content-grid"><div class="content-main plan-main">${cal}${body}</div><aside class="content-aside">${aside}</aside></div>`;
}
function calendarDays() {
  // Месяц — столько недель, сколько нужно (5 или 6): раньше всегда было 35 дней,
  // и у месяцев, начавшихся в субботу или воскресенье, последние числа пропадали
  // (август 2027 — без 30 и 31).
  const anchor = parseDate(ui.calendarExpanded ? `${ui.month.slice(0, 7)}-01` : ui.calendarAnchor);
  const mondayOffset = (anchor.getDay() + 6) % 7;
  const start = shiftDay(anchor, -mondayOffset);
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const count = ui.calendarExpanded ? Math.ceil((mondayOffset + daysInMonth) / 7) * 7 : 7;
  return Array.from({ length: count }, (_, index) => shiftDay(start, index));
}
function calendarDay(date) {
  const value = localIso(date);
  const hasTasks = tasksOn(value).some(t => !t.done);
  const hasEvents = eventsOn(value).length > 0;
  const outside = value.slice(0, 7) < ui.month.slice(0, 7);
  const cls = [outside ? "outside" : "", value === todayIso() ? "today" : "", value === ui.selected ? "selected" : ""].join(" ");
  const dots = `<span class="calendar-dots">${hasTasks ? "<i></i>" : ""}${hasEvents ? '<i class="event-dot"></i>' : ""}</span>`;
  const taskCount = tasksOn(value).filter(t => !t.done).length;
  const eventCount = eventsOn(value).length;
  return `<button type="button" class="calendar-day ${cls}" data-action="select-day" data-date="${value}" aria-label="${esc(fullDate(value))}, ${taskCount} ${word(taskCount, "задача", "задачи", "задач")}, ${eventCount} ${word(eventCount, "событие", "события", "событий")}" ${value === ui.selected ? 'aria-pressed="true"' : ""}><span>${date.getDate()}</span>${dots}</button>`;
}
function calendarCard(summary = "", progress = null) {
  return `<div class="calendar-card ${ui.calendarExpanded ? "expanded" : ""} ${summary ? "with-summary" : ""}" data-calendar-swipe><div class="calendar-top"><button class="calendar-expand-title" type="button" data-action="calendar-expand" aria-expanded="${ui.calendarExpanded}" aria-label="${ui.calendarExpanded ? "Свернуть" : "Развернуть"} календарь">${esc(monthName(ui.month))}${icon(ui.calendarExpanded ? "up" : "down", "icon-sm")}</button>${summary}<div class="calendar-controls"><button type="button" data-action="month-prev" aria-label="Предыдущий месяц">${icon("left")}</button><button type="button" data-action="month-next" aria-label="Следующий месяц">${icon("right")}</button></div></div><div class="calendar-toolbar"><div class="segmented"><button type="button" data-action="calendar-mode" data-mode="week" class="${!ui.calendarExpanded ? "active" : ""}">Неделя</button><button type="button" data-action="calendar-mode" data-mode="month" class="${ui.calendarExpanded ? "active" : ""}">Месяц</button></div><button type="button" class="text-action" data-action="calendar-today">К сегодня</button></div><div class="calendar-weekdays"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div><div class="calendar-grid">${calendarDays().map(calendarDay).join("")}</div><div class="calendar-legend"><span><i></i>Задачи</span><span><i class="event-dot"></i>События</span></div>${progress !== null ? `<div class="plan-progress"><span style="width:${progress}%"></span></div>` : ""}<button type="button" class="calendar-handle" data-action="calendar-expand" aria-label="${ui.calendarExpanded ? "Свернуть" : "Развернуть"} календарь жестом"><span></span></button></div>`;
}
function dayAgenda(day) {
  const tasks = tasksOn(day);
  const events = eventsOn(day);
  return `<section class="date-agenda"><div class="section-heading"><h2>${esc(fullDate(day))}</h2><button class="text-action" type="button" data-action="add" data-type="task">Добавить ${icon("plus", "icon-sm")}</button></div>${tasks.length || events.length ? `${events.length ? `<div class="agenda-group-label">События</div>${events.map(eventCard).join("")}` : ""}${tasks.length ? `<div class="agenda-group-label">Задачи</div><div class="task-stack">${tasks.map(taskCard).join("")}</div>` : ""}` : emptyCard("Здесь пока свободно", "Выберите другую дату или добавьте задачу на этот день.")}</section>`;
}
function upcomingPage() {
  const late = overdueTasks();
  const tasks = tasksOn(ui.selected);
  const events = eventsOn(ui.selected);
  const cal = calendarCard();
  const agenda = dayAgenda(ui.selected);
  const banner = late.length ? `<div class="overdue-banner"><span>${late.length} ${word(late.length, "просроченная задача", "просроченные задачи", "просроченных задач")}</span><button type="button" data-action="move-overdue">Перенести на сегодня</button></div>` : "";
  const aside = `<div class="side-card"><h3>План на неделю</h3>${Array.from({ length: 7 }, (_, i) => { const day = offsetIso(i); return `<div class="side-row"><span>${esc(dateLabel(day))}</span><b>${tasksOn(day).filter(t => !t.done).length + eventsOn(day).length}</b></div>`; }).join("")}</div>`;
  return `${header("Предстоящие", "Выберите день и посмотрите его задачи и события", "Планировщик")}<div class="content-grid"><div class="content-main">${banner ? `${banner}<div style="height:13px"></div>` : ""}${cal}${agenda}</div><aside class="content-aside">${aside}</aside></div>`;
}
function inboxPage() {
  const rows = data.inbox.map(item => `<div class="list-row"><span class="list-icon">${icon(item.type === "Ссылка" ? "link" : item.type === "Файл" ? "note" : "inbox")}</span><span class="list-copy"><strong>${esc(item.title)}</strong><span>${esc(item.type)} · ${esc(item.detail)}</span></span><button class="small-button" type="button" data-action="inbox-task" data-id="${esc(item.id)}">В дела</button><button class="icon-button" type="button" data-action="inbox-archive" data-id="${esc(item.id)}" aria-label="Убрать из входящих">${icon("archive", "icon-sm")}</button></div>`).join("");
  return `${header("Входящие", "Собранное из чата, пока вы не решили, что с ним сделать", "Разобрать")}<div class="content-grid"><div class="content-main"><div class="overview-intro"><span class="mini-heading">Как работает Flow</span><p>Сообщения, ссылки и файлы попадают сюда, если им нужно ваше решение. Превратите запись в задачу или уберите её из входящих.</p></div><section class="section"><div class="section-heading"><h2>Ждут решения</h2><span class="count">${data.inbox.length}</span></div>${rows ? `<div class="list-panel">${rows}</div>` : emptyCard("Всё разобрано", "Новые материалы от бота появятся здесь.")}</section></div><aside class="content-aside"><div class="side-card"><h3>Рядом с делами</h3><p class="side-note">В рабочем приложении здесь появятся неоднозначные записи, подтверждения платежей и материалы без категории.</p></div></aside></div>`;
}
function overviewPage() {
  const upcoming = openTasks().filter(t => t.due && t.due >= todayIso()).length;
  const row = (label, value) => `<div class="side-row"><span>${label}</span><b>${value}</b></div>`;
  return `${header("Обзор", "Все важное из чата в одном спокойном месте", "Flow")}<div class="content-grid"><div class="content-main"><div class="overview-intro"><span class="mini-heading">Личное пространство</span><p><strong>Flow собирает разное и раскладывает по местам.</strong> Пишите боту как обычно — дела, события, заметки и траты появятся здесь сами.</p></div><div class="info-grid"><button class="info-tile" type="button" data-action="navigate" data-page="today">${icon("today")}<span><span class="tile-label">Сегодня</span><span class="tile-value">${tasksOn(todayIso()).filter(t => !t.done).length} дела</span></span></button><button class="info-tile" type="button" data-action="navigate" data-page="upcoming">${icon("calendar")}<span><span class="tile-label">Предстоящие</span><span class="tile-value">${upcoming} в плане</span></span></button><button class="info-tile" type="button" data-action="navigate" data-page="inbox">${icon("inbox")}<span><span class="tile-label">Входящие</span><span class="tile-value">${data.inbox.length} записи</span></span></button><button class="info-tile" type="button" data-action="search">${icon("search")}<span><span class="tile-label">Найти</span><span class="tile-value">Поиск</span></span></button></div><section class="overview-section"><h2>Сохранённое <span class="count">${data.notes.length}</span></h2><div class="list-panel">${data.notes.slice(0, 3).map(note => `<div class="list-row"><span class="list-icon">${icon("bookmark")}</span><span class="list-copy"><strong>${esc(note.title)}</strong><span>${esc(note.description)}</span></span><button class="small-button" type="button" data-action="edit" data-type="note" data-id="${esc(note.id)}">Открыть</button></div>`).join("") || `<div class="list-row"><span class="list-copy">Заметок пока нет</span></div>`}</div></section><section class="overview-section"><h2>Финансы <span class="count">предпросмотр</span></h2><div class="side-card">${row("На счетах", "48 600 ₽")}${row("Расходы за месяц", "12 400 ₽")}${row("Ожидает подтверждения", "1 платёж")}</div></section></div><aside class="content-aside"><div class="side-card"><h3>Что здесь можно проверить</h3><p class="side-note">Добавление, изменение и завершение задач, выбор даты, события, поиск, входящие и две темы интерфейса.</p></div></aside></div>`;
}

function record(type, recordId) {
  const list = type === "task" ? data.tasks : type === "event" ? data.events : data.notes;
  return list.find(item => item.id === recordId);
}
function entrySheet() {
  const sheet = ui.sheet;
  const item = sheet.id ? record(sheet.type, sheet.id) : null;
  const draft = sheet.draft || {};
  const field = key => draft[key] ?? item?.[key] ?? "";
  const title = item ? "Изменить запись" : "Добавить";
  const typeLabel = sheet.type === "event" ? "Событие" : sheet.type === "note" ? "Заметка" : "Задача";
  const types = !item ? `<div class="sheet-type">${[["task", "Задача"], ["event", "Событие"], ["note", "Заметка"]].map(([type, label]) => `<button type="button" class="${sheet.type === type ? "active" : ""}" data-action="sheet-type" data-type="${type}">${label}</button>`).join("")}</div>` : `<p class="eyebrow">${typeLabel}</p>`;
  const defaultDue = field("due") || sheet.date || (ui.page === "tasks" && !item ? "" : todayIso());
  const dateFields = sheet.type !== "note" ? `<div class="field-row"><label class="field">Дата<input name="due" type="date" value="${esc(defaultDue)}" ${sheet.type === "event" ? "required" : ""}></label><label class="field">Время<input name="time" type="time" value="${esc(field("time"))}"></label></div>` : "";
  const taskFields = sheet.type === "task" ? `<div class="field-row"><label class="field">Важность<select name="priority"><option value="high" ${field("priority") === "high" ? "selected" : ""}>Очень важно</option><option value="medium" ${!field("priority") || field("priority") === "medium" ? "selected" : ""}>Обычно</option><option value="low" ${field("priority") === "low" ? "selected" : ""}>Когда-нибудь</option></select></label><label class="field">Проект<select name="project">${data.projects.map(p => `<option value="${esc(p.name)}" ${field("project") === p.name ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label></div>` : "";
  // Только то, что сервер выполняет: повтор задачи (день, будни, неделя, месяц, год),
  // у события — «каждый год» и «напомнить за…». О задаче со сроком бот напоминает в срок сам.
  const repeatOptions = sheet.type === "event" ? [["none", "Не повторять"], ["yearly", "Каждый год"]] : [["none", "Не повторять"], ["daily", "Каждый день"], ["weekdays", "По будням"], ["weekly", "Каждую неделю"], ["monthly", "Каждый месяц"], ["yearly", "Каждый год"]];
  const reminderFields = sheet.type !== "note" ? `<div class="entry-reminders"><h3>${sheet.type === "event" ? "Повтор и напоминание" : "Повтор"}</h3><div class="field-row"><label class="field">Повторять<select name="repeat">${repeatOptions.map(([key, label]) => `<option value="${key}" ${String(field("repeat") || "none") === key ? "selected" : ""}>${label}</option>`).join("")}</select></label>${sheet.type === "event" ? `<label class="field">Напомнить<select name="remindBefore">${[["none", "Не напоминать"], ["at", "В момент начала"], ["5m", "За 5 минут"], ["15m", "За 15 минут"], ["1h", "За 1 час"], ["1d", "За 1 день"]].map(([key, label]) => `<option value="${key}" ${String(field("remindBefore") || (item ? "none" : "1h")) === key ? "selected" : ""}>${label}</option>`).join("")}</select></label>` : ""}</div>${sheet.type === "task" ? `<p class="section-note">Со временем — бот напомнит в срок; без времени — утром в день срока.</p>` : ""}</div>` : "";
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${title}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div>${types}<form id="entry-form"><label class="field">Название<input name="title" type="text" value="${esc(field("title"))}" placeholder="${sheet.type === "event" ? "Например, встреча в 15:00" : sheet.type === "note" ? "О чём заметка?" : "Что нужно сделать?"}" maxlength="120" required autofocus></label><label class="field">${sheet.type === "event" ? "Место и детали" : sheet.type === "note" ? "Текст" : "Описание"}<textarea name="description" placeholder="Необязательно">${esc(field("description"))}</textarea></label>${dateFields}${taskFields}${sheet.type === "task" ? `<label class="field">Чек-лист<textarea name="checklist" rows="3" placeholder="Каждый пункт с новой строки. Все отмечены — задача закроется сама">${esc((item?.checklist || []).map(c => c.text).join("\n"))}</textarea></label>` : ""}${reminderFields}<div class="sheet-actions">${item ? `<button class="ghost-button danger-button" type="button" data-action="delete-record" data-type="${sheet.type}" data-id="${esc(item.id)}">Удалить</button>` : ""}<button class="primary-button" type="submit">${item ? "Сохранить" : "Добавить"}</button></div></form></section></div>`;
}
function searchSheet() {
  return renderSearchSheetExt();
}
function render() {
  disposeAddressMap();
  if (typeof disposeLoyaltyMap === "function") disposeLoyaltyMap();
  document.documentElement.dataset.theme = themeTone();
  document.documentElement.dataset.palette = ui.theme;
  document.documentElement.dataset.accent = data.settings.accent || "teal";
  document.body.classList.toggle("modal-open", Boolean(ui.sheet));
  document.body.classList.toggle("density-compact", data.settings.density === "compact");
  document.body.classList.toggle("density-spacious", data.settings.density === "spacious");
  const page = ui.demoState !== "normal" && ui.page !== "settings" ? renderDemoStatePage() : ui.page === "today" ? todayPage() : ui.page === "upcoming" ? upcomingPage() : extendedPage(ui.page);
  const sidebar = `<div class="sidebar-caption">План</div><nav class="sidebar-nav" aria-label="План">${navigation.slice(0, 3).map(item => navItem(item)).join("")}</nav><div class="sidebar-caption sidebar-caption-gap">Пространство</div><nav class="sidebar-nav" aria-label="Разделы">${navigation.slice(3, 9).map(item => navItem(item)).join("")}</nav><div class="sidebar-caption sidebar-caption-gap">Другое</div><nav class="sidebar-nav" aria-label="Другое">${navigation.slice(9).map(item => navItem(item)).join("")}</nav>`;
  const sheet = ui.sheet ? ui.sheet.kind === "search" ? searchSheet() : ui.sheet.kind === "entry" ? entrySheet() : renderExtendedSheet() : "";
  app.innerHTML = `<div class="app-shell"><aside class="sidebar"><div class="sidebar-brand">${brand()}</div>${sidebar}<div class="sidebar-foot"><p>Flow · личное пространство</p></div></aside><div><div class="mobile-brand">${brand()}</div><main class="main">${page}</main></div><button class="fab" type="button" data-action="${ui.page === "saved" ? "saved-new" : "universal-add"}" aria-label="Добавить запись">${icon("plus")}</button><nav class="mobile-nav" aria-label="Основная навигация">${mobileNavigation.map(item => navItem(item, true)).join("")}</nav>${sheet}${ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : ""}</div>`;
  const savedTabs = app.querySelector('.subtabs[role="tablist"]');
  const selectedSavedTab = savedTabs?.querySelector('[aria-selected="true"]');
  if (selectedSavedTab) savedTabs.scrollLeft = selectedSavedTab.offsetLeft - savedTabs.offsetLeft - (savedTabs.clientWidth - selectedSavedTab.offsetWidth) / 2;
  installSwipeCards(app);
  mountAddressMap();
  if (typeof mountLoyaltyMap === "function") { mountLoyaltyMap(); drawLoyaltyPeek(); }
  if (ui.sheet && !ui.sheet.justRendered) {
    const input = app.querySelector(ui.sheet.kind === "search" ? "#search-input" : ui.sheet.kind === "entry" ? '#entry-form input[name="title"]' : '.sheet [autofocus], .sheet input');
    // На телефоне фокус открыл бы клавиатуру поверх окна — ставим его только в поиске.
    if (ui.sheet.kind === "search" || !window.matchMedia("(pointer: coarse)").matches) requestAnimationFrame(() => input?.focus());
    ui.sheet.justRendered = true;
  }
}
function toast(message) {
  ui.toast = message;
  clearTimeout(toastTimer);
  render();
  toastTimer = setTimeout(() => { ui.toast = ""; app.querySelector(".toast")?.remove(); }, 2800);
}
function toggleTask(recordId) {
  const task = data.tasks.find(item => item.id === recordId);
  if (!task) return;
  task.done = !task.done;
  save();
  toast(task.done ? "Задача завершена" : "Задача снова в плане");
}
function navigate(page) {
  if (!validPages.includes(page)) return;
  // «Предстоящие» и «Обзор» теперь внутри «Плана».
  if (page === "upcoming" || page === "overview") page = "today";
  if (page === "today" && ui.page !== "today") { ui.selected = todayIso(); ui.calendarAnchor = ui.selected; ui.month = ui.selected.slice(0, 7) + "-01"; }
  ui.page = page;
  ui.menu = false;
  ui.sheet = null;
  location.hash = page;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function openEntry(type = "task", date = ui.page === "upcoming" ? ui.selected : ui.page === "tasks" ? "" : todayIso(), recordId = null) {
  if (type === "note") { openSavedRecord("notes", recordId); return; }
  ui.sheet = { kind: "entry", type, id: recordId, date, justRendered: false };
  ui.menu = false;
  render();
}
function closeSheet() {
  // Закрыли поиск — в следующий раз он открывается пустым.
  if (ui.sheet?.kind === "search") { ui.searchQuery = ""; ui.searchPage = 1; ui.searchType = "all"; }
  ui.sheet = null; render();
}
/*
 * Окно закрывается свайпом вниз, как в Telegram: тянешь за шапку или за
 * содержимое, когда оно прокручено до верха. Отпустил далеко или быстро —
 * окно уезжает вниз; недотянул — возвращается на место.
 */
let sheetDrag = null;
document.addEventListener("touchstart", event => {
  const sheet = event.target.closest?.(".sheet");
  if (!sheet || event.touches.length !== 1) return;
  if (event.target.closest("input, textarea, select, .live-code-track, .leaflet-container, .swipe-row")) return;
  sheetDrag = { sheet, target: event.target, x: event.touches[0].clientX, y: event.touches[0].clientY, dy: 0, t: event.timeStamp, active: false };
}, { passive: true });
document.addEventListener("touchmove", event => {
  const drag = sheetDrag;
  if (!drag) return;
  const dx = event.touches[0].clientX - drag.x;
  const dy = event.touches[0].clientY - drag.y;
  if (!drag.active) {
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) { sheetDrag = null; return; }
    if (dy < 10) { if (dy < -10) sheetDrag = null; return; }
    // Прокручено не только само окно, но и любой блок внутри него (текст
    // заметки) — тогда жест вниз — это прокрутка вверх, а не «закрыть».
    for (let node = drag.target; node && node !== drag.sheet.parentElement; node = node.parentElement) {
      if (node.scrollTop > 0) { sheetDrag = null; return; }
    }
    drag.active = true;
    drag.sheet.classList.add("sheet-dragging");
  }
  event.preventDefault();
  drag.dy = Math.max(0, dy - 10);
  drag.sheet.style.transform = `translateY(${drag.dy}px)`;
  const backdrop = drag.sheet.parentElement;
  if (backdrop?.classList.contains("modal-backdrop")) backdrop.style.backgroundColor = `rgba(2, 9, 13, ${Math.max(0.15, 0.68 - drag.dy / 700)})`;
}, { passive: false });
function sheetDragEnd(event) {
  const drag = sheetDrag;
  sheetDrag = null;
  if (!drag?.active) return;
  const speed = drag.dy / Math.max(1, event.timeStamp - drag.t);
  drag.sheet.classList.remove("sheet-dragging");
  drag.sheet.style.transition = "transform .2s ease";
  const backdrop = drag.sheet.parentElement;
  if (drag.dy > Math.min(160, drag.sheet.offsetHeight * 0.3) || speed > 0.7) {
    drag.sheet.style.transform = "translateY(100%)";
    setTimeout(() => {
      // Окна моста (ход разбора) живут вне ui.sheet — их просто убираем.
      if (backdrop && !backdrop.hasAttribute("data-action") && backdrop.parentElement === document.body) backdrop.remove();
      else closeSheet();
    }, 170);
  } else {
    drag.sheet.style.transform = "";
    if (backdrop) backdrop.style.backgroundColor = "";
    setTimeout(() => { drag.sheet.style.transition = ""; }, 220);
  }
}
document.addEventListener("touchend", sheetDragEnd);
document.addEventListener("touchcancel", sheetDragEnd);
function monthStep(direction) {
  const month = parseDate(ui.month);
  month.setMonth(month.getMonth() + direction);
  ui.month = localIso(new Date(month.getFullYear(), month.getMonth(), 1, 12));
  ui.selected = ui.month;
  ui.calendarAnchor = ui.selected;
  render();
}

document.addEventListener("click", event => {
  const control = event.target.closest("[data-action]");
  if (!control) {
    if (ui.menu && !event.target.closest(".header-menu-wrap")) { ui.menu = false; render(); }
    return;
  }
  const action = control.dataset.action;
  if (action === "backdrop") { if (event.target === control) closeSheet(); return; }
  if (action === "navigate") { if (control.dataset.page === "saved") ui.savedCategory = "overview"; if (control.dataset.page === "finance") { ui.financeTab = "overview"; ui.financeCategory = ""; } navigate(control.dataset.page); return; }
  if (action === "search") { if (!ui.sheet) { ui.searchQuery = ""; ui.searchPage = 1; ui.searchType = "all"; } ui.sheet = { kind: "search", justRendered: false }; ui.menu = false; render(); return; }
  if (action === "menu") { ui.menu = !ui.menu; render(); return; }
  if (action === "theme") {
    ui.theme = themeTone() === "dark" ? "light" : "dark";
    try { localStorage.setItem(THEME_KEY, ui.theme); } catch (_) {}
    ui.menu = false; render(); return;
  }
  if (action === "reset") {
    if (window.confirm("Сбросить тестовые записи в этом браузере?")) { const fresh = seed(); data = hydrateExtra(fresh, fresh); save(); ui.selected = todayIso(); ui.month = todayIso().slice(0, 7) + "-01"; ui.calendarAnchor = ui.selected; ui.savedSection = ""; ui.vaultUnlocked = false; ui.vaultShown = null; ui.demoState = "normal"; ui.menu = false; toast("Данные сброшены"); }
    return;
  }
  if (action === "close-sheet") { closeSheet(); return; }
  if (action === "add") { openEntry(control.dataset.type || "task"); return; }
  if (action === "edit") { openEntry(control.dataset.type, ui.page === "tasks" ? "" : ui.selected, control.dataset.id); return; }
  if (action === "sheet-type") {
    const form = document.getElementById("entry-form");
    const formData = form ? new FormData(form) : null;
    ui.sheet.draft = formData ? Object.fromEntries(formData.entries()) : {};
    ui.sheet.type = control.dataset.type;
    ui.sheet.justRendered = false;
    render(); return;
  }
  if (action === "delete-record") {
    const type = control.dataset.type;
    const key = type === "task" ? "tasks" : type === "event" ? "events" : "notes";
    const item = data[key].find(entry => entry.id === control.dataset.id);
    if (item) pushTrash(type, item);
    data[key] = data[key].filter(item => item.id !== control.dataset.id);
    ui.sheet = null; save(); toast("Запись в корзине"); return;
  }
  if (action === "toggle-task") { toggleTask(control.dataset.id); return; }
  if (action === "finance-open-payments") { navigate("finance"); ui.financeTab = "payments"; render(); return; }
  if (action === "task-check-item") { toggleChecklistItem(control.dataset.id, Number(control.dataset.index)); return; }
  if (action === "task-checklist-toggle") { const openIds = new Set(ui.openChecklists || []); openIds.has(control.dataset.id) ? openIds.delete(control.dataset.id) : openIds.add(control.dataset.id); ui.openChecklists = [...openIds]; render(); return; }
  if (action === "move-overdue") {
    const late = overdueTasks();
    late.forEach(task => { task.due = todayIso(); });
    save(); toast(`${late.length} ${word(late.length, "задача перенесена", "задачи перенесены", "задач перенесено")} на сегодня`); return;
  }
  if (action === "toggle-overdue") { ui.overdueOpen = !ui.overdueOpen; render(); return; }
  if (action === "month-prev") { monthStep(-1); return; }
  if (action === "month-next") { monthStep(1); return; }
  if (action === "calendar-mode") { ui.mode = control.dataset.mode; ui.calendarExpanded = ui.mode === "month"; if (!ui.calendarExpanded) ui.calendarAnchor = ui.selected; render(); return; }
  if (action === "calendar-expand") { if (suppressCalendarClick) { suppressCalendarClick = false; return; } animateCalendar(() => { ui.calendarExpanded = !ui.calendarExpanded; ui.mode = ui.calendarExpanded ? "month" : "week"; if (!ui.calendarExpanded) ui.calendarAnchor = ui.selected; render(); }); return; }
  if (action === "calendar-today") { ui.selected = todayIso(); ui.month = todayIso().slice(0, 7) + "-01"; ui.calendarAnchor = ui.selected; render(); return; }
  if (action === "select-day") { ui.selected = control.dataset.date; ui.month = ui.selected.slice(0, 7) + "-01"; if (!ui.calendarExpanded) ui.calendarAnchor = ui.selected; render(); return; }
  if (action === "inbox-task") {
    const item = data.inbox.find(x => x.id === control.dataset.id);
    if (item) { data.tasks.push({ id: id(), title: item.title, description: "Из входящих", due: todayIso(), time: "", priority: "medium", project: "Личное", done: false }); data.inbox = data.inbox.filter(x => x.id !== item.id); save(); toast("Добавлено в дела на сегодня"); }
    return;
  }
  if (action === "inbox-archive") { data.inbox = data.inbox.filter(x => x.id !== control.dataset.id); save(); toast("Убрано из входящих"); return; }
  if (action === "search-open") { openSearchResult(control.dataset.type, control.dataset.id); return; }
  if (handleExtendedAction(action, control, event)) return;
});

document.addEventListener("submit", event => {
  if (handleExtendedSubmit(event)) return;
  if (event.target.id !== "entry-form" || !ui.sheet || ui.sheet.kind !== "entry") return;
  event.preventDefault();
  const form = new FormData(event.target);
  const title = String(form.get("title") || "").trim();
  if (!title) return;
  const type = ui.sheet.type;
  const key = type === "task" ? "tasks" : type === "event" ? "events" : "notes";
  const existing = ui.sheet.id ? record(type, ui.sheet.id) : null;
  const item = existing || { id: id() };
  item.title = title;
  item.description = String(form.get("description") || "").trim();
  if (type !== "note") { item.due = String(form.get("due") || (type === "event" ? todayIso() : "")); item.time = String(form.get("time") || ""); item.repeat = String(form.get("repeat") || "none"); if (form.has("remindBefore")) item.remindBefore = String(form.get("remindBefore") || "none"); }
  if (type === "task") {
    item.priority = String(form.get("priority") || "medium"); item.project = String(form.get("project") || "Личное"); if (!existing) item.done = false;
    const before = item.checklist || [];
    item.checklist = String(form.get("checklist") || "").split("\n").map(line => line.trim()).filter(Boolean).slice(0, 60)
      .map(text => ({ text, done: Boolean(before.find(c => c.text === text)?.done) }));
  }
  if (!existing) data[key].push(item);
  if (ui.page === "upcoming" && item.due) { ui.selected = item.due; ui.month = item.due.slice(0, 7) + "-01"; ui.calendarAnchor = item.due; }
  ui.sheet = null;
  save();
  toast(existing ? "Изменения сохранены" : `${type === "task" ? "Задача" : type === "event" ? "Событие" : "Заметка"} добавлена`);
});
document.addEventListener("input", event => { handleExtendedInput(event); });
document.addEventListener("change", event => { handleExtendedChange(event); });
document.addEventListener("keydown", event => {
  if (!ui.sheet) return;
  if (event.key === "Escape") { closeSheet(); return; }
  if (event.key !== "Tab") return;
  const focusable = [...document.querySelectorAll('.sheet button, .sheet input, .sheet textarea, .sheet select')].filter(element => !element.disabled && element.getClientRects().length);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
window.addEventListener("hashchange", () => { const page = currentPage(); if (page !== ui.page) { ui.page = page; ui.sheet = null; ui.menu = false; render(); } });
let calendarPointerStart = null;
let suppressCalendarClick = false;
document.addEventListener("pointerdown", event => {
  if (event.target.closest(".calendar-handle")) calendarPointerStart = { y: event.clientY, id: event.pointerId };
});
document.addEventListener("pointerup", event => {
  if (!calendarPointerStart || calendarPointerStart.id !== event.pointerId) return;
  const delta = event.clientY - calendarPointerStart.y;
  calendarPointerStart = null;
  if (Math.abs(delta) < 24) return;
  const expanded = delta > 0;
  if (ui.calendarExpanded !== expanded) { suppressCalendarClick = true; setTimeout(() => { suppressCalendarClick = false; }, 350); ui.calendarExpanded = expanded; ui.mode = expanded ? "month" : "week"; render(); }
});
document.addEventListener("dragstart", event => {
  const card = event.target.closest(".task-drag-handle")?.closest(".task-card");
  if (card && event.dataTransfer) event.dataTransfer.setData("text/plain", card.dataset.taskId);
});
document.addEventListener("dragover", event => { if (event.target.closest(".calendar-day") && event.dataTransfer?.types.includes("text/plain")) event.preventDefault(); });
document.addEventListener("drop", event => {
  const day = event.target.closest(".calendar-day");
  if (!day) return;
  event.preventDefault();
  const task = data.tasks.find(x => x.id === event.dataTransfer?.getData("text/plain"));
  if (task) { task.due = day.dataset.date; ui.selected = task.due; ui.calendarAnchor = task.due; ui.month = task.due.slice(0, 7) + "-01"; save(); toast("Задача перенесена на выбранный день"); }
});
render();

/*
 * Календарь «Плана»: раскрытие неделя ↔ месяц плавно (высота едет, а не
 * прыгает), свайп влево-вправо — следующая/прошлая неделя или месяц.
 */
function animateCalendar(change) {
  const before = document.querySelector(".calendar-card")?.offsetHeight || 0;
  change();
  const card = document.querySelector(".calendar-card");
  if (!card || !before) return;
  const after = card.offsetHeight;
  if (Math.abs(after - before) < 2) return;
  card.animate([{ height: `${before}px` }, { height: `${after}px` }], { duration: 300, easing: "cubic-bezier(.2,.8,.3,1)" });
  card.querySelector(".calendar-grid")?.animate([{ opacity: .3 }, { opacity: 1 }], { duration: 300 });
}
function stepCalendar(dir) {
  if (ui.calendarExpanded) { monthStep(dir); }
  else {
    const anchor = parseDate(ui.calendarAnchor || ui.selected || todayIso());
    ui.calendarAnchor = localIso(shiftDay(anchor, dir * 7));
    ui.month = ui.calendarAnchor.slice(0, 7) + "-01";
    render();
  }
  const grid = document.querySelector(".calendar-grid");
  grid?.animate([{ transform: `translateX(${dir * 36}px)`, opacity: .2 }, { transform: "none", opacity: 1 }], { duration: 260, easing: "cubic-bezier(.2,.8,.3,1)" });
}
let calendarSwipe = null;
document.addEventListener("pointerdown", event => {
  const card = event.target.closest(".calendar-card");
  if (!card || event.target.closest(".calendar-handle")) return;
  calendarSwipe = { x: event.clientX, y: event.clientY, id: event.pointerId };
});
document.addEventListener("pointerup", event => {
  if (!calendarSwipe || calendarSwipe.id !== event.pointerId) return;
  const dx = event.clientX - calendarSwipe.x, dy = event.clientY - calendarSwipe.y;
  calendarSwipe = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    suppressCalendarClick = true; setTimeout(() => { suppressCalendarClick = false; }, 350);
    swipeSuppressCalendar = Date.now() + 350;
    stepCalendar(dx < 0 ? 1 : -1);
  }
  // Вверх-вниз календарь раскрывается за пальцем — это calendar-drag.js.
});
let swipeSuppressCalendar = 0;
document.addEventListener("click", event => {
  if (Date.now() < swipeSuppressCalendar && event.target.closest(".calendar-card")) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
