/* Дизайн-прототип: все записи хранятся только в этом браузере. */
const STORAGE_KEY = "soroka-planner-prototype-v1";
function classicDesign() { return document.documentElement.dataset.flowDesign === "classic"; }
/** The classic shell retains its original theme choices; Magic has three dark surfaces. */
const THEMES = {
  ...(classicDesign() ? { telegram: { label: "Как в Telegram", tone: () => (window.Telegram?.WebApp?.colorScheme || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")) } } : {}),
  dark: { label: "Тёмная", tone: "dark" }, midnight: { label: "Ночь", tone: "dark" }, graphite: { label: "Графит", tone: "dark" },
  ...(classicDesign() ? { light: { label: "Светлая", tone: "light" }, sand: { label: "Песок", tone: "light" }, mint: { label: "Мята", tone: "light" } } : {})
};
function themeTone() { const t = THEMES[ui.theme] || THEMES.dark; return typeof t.tone === "function" ? t.tone() : t.tone; }
const ACCENTS = [["teal", "Бирюзовый", "#58d0cf"], ["blue", "Синий", "#76a9ff"], ["indigo", "Индиго", "#8b93ff"], ["violet", "Фиолетовый", "#b99aff"], ["pink", "Розовый", "#f58bb8"], ["red", "Красный", "#ff7b7b"], ["orange", "Оранжевый", "#ffa35c"], ["amber", "Янтарный", "#f2c14e"], ["green", "Зелёный", "#6fcf7f"]];
const THEME_KEY = "soroka-planner-theme";
const app = document.getElementById("app");

const icons = {
  piano: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M13 4v16M18 4v16M6 4v8h3M11 4v8h3M16 4v8h3"/>',
  shoe: '<path d="M3 15V8l5 1 3 4 7 2a4 4 0 0 1 3 4H3v-4Z"/><path d="M3 16h4m3-4 2-2m1 4 2-2M3 19h18"/>',
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
  subtask: '<circle cx="6" cy="4.2" r="1.35" fill="currentColor" stroke="none"/><path d="M6 5.7V17a2 2 0 0 0 2 2h6"/><path d="M6 11.2h9.5"/>',
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
  zzz: '<path d="M3 14h7l-7 7h7M10 8h6l-6 6h6M17 2h5l-5 5h5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v5h5"/>',
  event: '<path d="M4 20h16M6 20V7l6-4 6 4v13M9 12h6M9 16h6"/>',
  arrow: '<path d="M4 12h16m-7-7 7 7-7 7"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  bookmark: '<path d="M5 4h14v17l-7-5-7 5V4Z"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8m-9 5h4"/>',
  folder: '<path d="M3 8h18v12H3zM3 8V4h7l2 3"/>',
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
  assistantStar: '<path d="M12 2c.8 6.5 3.5 9.2 10 10-6.5.8-9.2 3.5-10 10-.8-6.5-3.5-9.2-10-10 6.5-.8 9.2-3.5 10-10Z" fill="currentColor" stroke="none"/>',
  locate: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  server: '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01M12 7.5h4M12 16.5h4"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  train: '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1M15 15l1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3M16 19l2 3"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 1.9-1.6L22 7H5.1"/>',
  coffee: '<path d="M10 2v2M14 2v2M6 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  health: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/><path d="M3.2 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.3"/>',
  wifi: '<path d="M12 20h.01M2 8.8a15 15 0 0 1 20 0M5 12.9a10 10 0 0 1 14 0M8.5 16.4a5 5 0 0 1 7 0"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  shirt: '<path d="M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.2a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.4-2.2z"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
  study: '<path d="M21.4 10.9a1 1 0 0 0 0-1.8l-8.6-3.9a2 2 0 0 0-1.7 0L2.6 9.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.7 0z"/><path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
  message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  transfer: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
  door: '<path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9M10 12v.01"/><path d="M13 4.6v16a1 1 0 0 1-1.2 1L5 20V5.6a2 2 0 0 1 1.5-1.9l4-1A2 2 0 0 1 13 4.6Z"/>'
};
/**
 * Иконка раздела: выбранная человеком, а у старых общих («стрелка», «закладка»)
 * — по названию: «Поезд» с поездом, «Самолёт» с самолётом.
 */
function sectionIcon(section, fallback = "bookmark") {
  const own = section?.icon;
  if (own && !["arrow", "bookmark", "note", "archive"].includes(own)) return own;
  const name = String(section?.name || "").toLowerCase();
  const rules = [[/(^|\s)поезд(а|ом|е)?($|\s)|ржд|электрич|сапсан/, "train"], [/самол|авиа|рейс|перел/, "plane"], [/концерт|мероприят|театр|кино|шоу/, "music"],
    [/дом|квартир/, "home"], [/покуп|магазин/, "cart"], [/еда|кафе|ресторан|рецепт/, "coffee"], [/подар/, "gift"], [/машин|авто/, "car"],
    [/здоров|врач|аптек/, "health"], [/учёб|учеб|курс|урок/, "study"], [/клиент|работ/, "project"]];
  return rules.find(([re]) => re.test(name))?.[1] || own || fallback;
}
/** Иконка категории расхода — по смыслу, а не один кошелёк на всё. */
function categoryIcon(category) {
  const c = String(category || "").toLowerCase();
  const rules = [[/продукт|еда|супермаркет/, "cart"], [/кафе|ресторан|кофе|доставк/, "coffee"], [/транспорт|такси|авто|бензин|топливо|парков/, "car"],
    [/путешеств|отпуск|отел|авиа|билет/, "plane"], [/жиль|аренд|коммунал|ипотек|дом/, "home"], [/здоров|аптек|медиц|врач|спорт/, "health"],
    [/связь|интернет|телефон/, "wifi"], [/подписк/, "repeat"], [/одежд|обув/, "shirt"], [/подар/, "gift"], [/образован|учёб|учеб|курс/, "study"],
    [/развлеч|кино|игр/, "film"], [/красот|уход/, "spark"], [/кредит|долг/, "card"]];
  return rules.find(([re]) => re.test(c))?.[1] || "wallet";
}
function icon(name, size = "") {
  return `<svg class="icon ${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.note}</svg>`;
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function localIso(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}
function parseDate(value) {
  // Дата или полная отметка времени (2026-10-23T12:00:00Z) — берём только день.
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
function shiftDay(date, count) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  next.setDate(next.getDate() + count);
  return next;
}
function offsetIso(count) { return localIso(shiftDay(new Date(), count)); }
function todayIso() { return localIso(new Date()); }
// Создать Intl.DateTimeFormat дорого (~0,3 мс), а дат на экране сотни: форматтеры — один раз.
const dateFormats = {
  full: new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }),
  short: new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }),
  month: new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }),
};
const dateCache = new Map();
function cachedDate(kind, value) {
  const key = kind + value;
  let text = dateCache.get(key);
  if (text === undefined) {
    if (dateCache.size > 4000) dateCache.clear();
    text = dateFormats[kind].format(parseDate(value));
    dateCache.set(key, text);
  }
  return text;
}
function fullDate(value) {
  return cachedDate("full", value);
}
function shortDate(value) {
  return cachedDate("short", value);
}
function monthName(value) {
  const text = cachedDate("month", value).replace(/\s*г\.?$/, "");
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
const validPages = ["today", "upcoming", "tasks", "saved", "finance", "vault", "inbox", "overview", "projects", "metrics", "archive", "settings", "more", "vpn", "server", "pc", "render", "docs", "english", "sport", "piano"];
function currentPage() { const name = location.hash.slice(1); if (name === "sleep") return "today"; const page = validPages.includes(name) ? name : validPages.includes(data.settings.startPage) ? data.settings.startPage : "today"; return page === "overview" ? "today" : page; }
if (location.hash === "#sleep") history.replaceState(null, "", "#today");
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
  ["projects", "Проекты", "project"],
  ["vault", "Пароли", "key"],
  ["docs", "Документы", "file"],
  ["archive", "Архив", "archive"],
  ["settings", "Настройки", "settings"],
  ["more", "Все разделы", "overview"]
];
const mobileNavigation = [["today", "План", "today"], navigation[3], navigation[4], ["more", "Ещё", "overview"]];
function navItem([page, label, symbol], mobile = false) {
  const planPage = ["today", "upcoming", "tasks"].includes(ui.page);
  const active = ui.page === page || (mobile && page === "today" && planPage) || (page === "more" && (mobile ? !planPage && !mobileNavigation.slice(0, 4).some(([name]) => name === ui.page) : !navigation.some(([name]) => name === ui.page)));
  const count = page === "inbox" && data.inbox.length && !mobile ? `<span class="nav-count">${data.inbox.length}</span>` : "";
  return `<button type="button" class="${active ? "active" : ""}" data-action="navigate" data-page="${page}" ${active ? 'aria-current="page"' : ""}>${mobile&&document.documentElement.dataset.flowDesign==='magic'&&window.flowMagicObject?window.flowMagicObject(page):icon(symbol)}<span>${label}</span>${count}</button>`;
}
function brand() {
  return `<img class="brand-mark" src="./assets/flow-vortex-magic.svg" alt=""><div><span class="brand-name">FLOW</span><span class="brand-label">личное пространство</span></div>`;
}
function header(title, subtitle, eyebrow) {
  return `<header class="page-header"><div><h1>${title}</h1></div><div class="header-actions"><button class="icon-button" type="button" data-action="search" aria-label="Поиск">${icon("search")}</button><div class="header-menu-wrap"><button class="icon-button" type="button" data-action="menu" aria-label="Меню" aria-expanded="${ui.menu}">${icon("more")}</button>${ui.menu ? `<div class="header-menu">${ui.page === "today" ? `<button type="button" data-action="today-cards">${icon("settings")}<span>Карточки на сегодня</span></button>` : ""}<button type="button" data-action="theme">${icon(themeTone() === "dark" ? "sun" : "moon")}<span>${themeTone() === "dark" ? "Светлая тема" : "Тёмная тема"}</span></button><button type="button" data-action="reset">${icon("reset")}<span>${window.SOROKA_LIVE ? "Обновить данные" : "Сбросить данные"}</span></button>${window.SorokaAndroid && window.SorokaAndroid.settings ? `<button type="button" data-action="android-settings">${icon("settings")}<span>Настройки телефона</span></button>` : ""}</div>` : ""}</div></div></header>`;
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
  const mainLabel = `Открыть задачу: ${task.title}`;
  const dragHandle = ui.page === "upcoming" ? `<span class="task-drag-handle" draggable="true" role="img" aria-label="Перетащить задачу на другой день" title="Перетащить на другой день">${icon("grip", "icon-sm")}</span>` : "";
  return `<article class="task-card ${late ? "overdue" : ""} ${task.done ? "is-done" : ""}" data-task-id="${esc(task.id)}"><button class="task-check ${task.done ? "checked" : ""}" type="button" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.done ? "Вернуть задачу" : "Завершить задачу"}: ${esc(task.title)}">${icon("check", "icon-sm")}</button><button class="task-main" type="button" data-action="edit" data-type="task" data-id="${esc(task.id)}" aria-label="${esc(mainLabel)}"><span class="task-title">${esc(task.title)}</span><span class="task-meta">${date}${time}${project}${noDate}</span></button>${checklistBlock(task)}<span class="task-card-trailing"><i class="priority-marker ${esc(task.priority)}" aria-hidden="true"></i>${dragHandle}</span></article>`;
}
/*
 * Поезд в расписании — сразу с билетом: билет на поезд из «Поездок и
 * мероприятий» в пределах суток от события показывается на карточке, одно
 * нажатие — и он открыт с кодом.
 */
const TRAIN_RE = /поезд|ржд|ласточк|сапсан|электрич|вагон|плацкарт|купе(?![а-яё])/i;
function eventTicket(event) {
  if (typeof savedItems !== "function" || typeof ticketStart !== "function" || !(event?.due || event?.date)) return null;
  if (!TRAIN_RE.test(`${event.title || ""} ${event.description || ""}`)) return null;
  const at = new Date(`${event.due || event.date}T${/^\d{2}:\d{2}$/.test(event.time || "") ? event.time : "12:00"}:00`).getTime();
  if (Number.isNaN(at)) return null;
  const near = savedItems("tickets").filter(t => {
    const start = ticketStart(t);
    if (!start || ticketExpired(t)) return false;
    const train = t.ticketType === "train" || TRAIN_RE.test(`${t.title || ""} ${t.carrier || ""}`);
    return train && Math.abs(start.getTime() - at) <= (event.time ? 18 : 30) * 3600000;
  });
  return near.sort((a, b) => Math.abs(ticketStart(a) - at) - Math.abs(ticketStart(b) - at))[0] || null;
}
function eventCard(event) {
  const ticket = eventTicket(event);
  const chip = ticket ? `<span class="event-ticket" role="button" tabindex="0" data-action="saved-open" data-category="tickets" data-id="${esc(ticket.id)}">${icon("ticket", "icon-sm")}Билет${ticket.seat ? ` · ${esc(ticket.seat.split(" · ")[0])}` : ""}</span>` : "";
  return `<button class="event-card" type="button" data-action="edit" data-type="event" data-id="${esc(event.id)}"><span class="event-time">${esc(event.time || "Весь день")}</span><i class="event-rule" aria-hidden="true"></i><span class="event-info"><span class="event-title">${esc(event.title)}</span>${event.description ? `<span class="event-place">${esc(event.description)}</span>` : ""}${chip}</span></button>`;
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
  const hero = `<div class="hero-panel"><div class="hero-top"><div><p class="hero-date">${esc(fullDate(today))}${typeof dayInfo === "function" && dayInfo(today).holiday ? ` · <span class="day-note is-off">${esc(dayInfo(today).holiday)}</span>` : ""}</p><div class="hero-number">${pending.length}<span>${word(pending.length, "дело", "дела", "дел")} на сегодня</span></div></div><div class="hero-mini">${percentage}%<br><span style="color:var(--subtle);font-weight:600">выполнено</span></div></div><div class="progress-track"><span style="width:${percentage}%"></span></div><div class="progress-caption"><span>${done} завершено</span><span>${daily.length} всего</span></div></div>`;
  const overdue = late.length ? `<section class="section overdue-section"><div class="section-heading overdue-heading"><h2>Просрочено <span class="count">${late.length}</span></h2><button class="text-action" type="button" data-action="move-overdue">Перенести на сегодня ${icon("arrow", "icon-sm")}</button></div>${ui.overdueOpen ? `<div class="overdue-list">${late.map(taskCard).join("")}</div>` : ""}<button class="text-action" type="button" data-action="toggle-overdue">${ui.overdueOpen ? "Свернуть" : "Показать"} ${icon(ui.overdueOpen ? "up" : "down", "icon-sm")}</button></section>` : "";
  // Платежи, срок которых настал (или прошёл), — тоже дела на сегодня.
  const duePays = (data.finance?.payments || []).filter(p => p.status !== "confirmed" && p.nextOn && p.nextOn <= today);
  const payCards = duePays.map(p => `<article class="task-card pay-task ${p.nextOn < today ? "overdue" : ""}"><button class="task-check" type="button" data-action="payment-confirm" data-id="${esc(p.id)}" aria-label="Оплачено: ${esc(p.title)}">${icon("check", "icon-sm")}</button><button class="task-main" type="button" data-action="finance-open-payments"><span class="task-title">${esc(p.title)}</span><span class="task-meta"><span>${icon("wallet", "icon-sm")}Платёж${p.nextOn < today ? ` · с ${esc(dateLabel(p.nextOn))}` : ""}</span></span></button><span class="pay-task-sum">${demoMoney(p.amount, p.currency || "RUB")}</span></article>`).join("");
  const tasks = !daily.length && !duePays.length ? "" : `<section class="section"><div class="section-heading"><h2>Задачи на сегодня</h2><span class="count">${daily.length + duePays.length}</span></div><div class="task-stack">${payCards}${daily.length ? daily.map(taskCard).join("") : duePays.length ? "" : emptyCard("План свободен", "Добавьте задачу кнопкой ниже или пришлите её боту обычным сообщением.")}</div></section>`;
  const events = !meetings.length ? "" : `<section class="section"><div class="section-heading"><h2>В расписании</h2><span class="count">${meetings.length}</span></div>${meetings.length ? meetings.map(eventCard).join("") : emptyCard("Событий пока нет", "Можно добавить встречу на сегодня.")}</section>`;
  const aside = `<div class="side-card"><h3>Ближайшие дни</h3>${[1, 2, 3].map(n => { const day = offsetIso(n); const count = tasksOn(day).filter(t => !t.done).length + eventsOn(day).length; return `<div class="side-row"><span>${esc(dateLabel(day))}</span><b>${count} ${word(count, "запись", "записи", "записей")}</b></div>`; }).join("")}<button class="text-action" type="button" data-action="navigate" data-page="upcoming">Открыть календарь ${icon("arrow", "icon-sm")}</button></div><div class="side-card"><h3>Быстрый ввод</h3><p class="side-note">Задачи удобно отправлять боту обычным текстом. </p></div>`;
  // Билет, уже приколотый к событию в расписании на сегодня, второй раз ниже не показываем.
  const shownTickets = new Set(meetings.map(eventTicket).filter(Boolean).map(t => t.id));
  const tickets = typeof todayTicketsSection === "function" ? todayTicketsSection(shownTickets) : "";
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
    // Платёж — только если он на этой неделе: счёт через месяц на «Плане» лишь отвлекает.
    const pending = (data.finance?.payments || []).filter(p => p.status === "pending" && p.nextOn && p.nextOn <= offsetIso(7)).sort((a, b) => a.nextOn.localeCompare(b.nextOn));
    const last = ui.lastOpened;
    return `<section class="section plan-glance"><button type="button" class="glance-tile" data-action="navigate" data-page="finance"><small>Доступно</small><strong>${demoMoney(rubBalance())}</strong>${pending[0] ? `<span>${esc(financeTitle(pending[0].title))} · ${esc(dateLabel(pending[0].nextOn))}</span>` : ""}</button>${last?.title ? `<button type="button" class="glance-tile" data-action="overview-continue"><small>Продолжить</small><strong>${esc(last.title)}</strong><span>Последняя открытая запись</span></button>` : ""}</section>`;
  })() : "";
  // Английский — короткое занятие дня (english.js): сколько повторить и серия.
  const english = isToday && todayCardVisible("english") && typeof enHomeTile === "function" ? enHomeTile() : "";
  // Спорт — тренировка дня и привычки (sport.js, перенос WooSport).
  const sport = isToday && todayCardVisible("sport") && typeof spHomeTile === "function" ? spHomeTile() : "";
  const body = isToday ? `${overdue}${tasks}${events}${free}${sport}${english}${birthdaysSoon}${tickets}${glance}` : dayAgenda(ui.selected);
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
  const info = typeof dayInfo === "function" ? dayInfo(value) : { off: false, holiday: "" };
  const cls = [outside ? "outside" : "", value === todayIso() ? "today" : "", value === ui.selected ? "selected" : "", info.off ? "is-off" : "", info.holiday ? "is-holiday" : "", info.workday ? "is-workday" : ""].join(" ");
  const dots = `<span class="calendar-dots">${hasTasks ? "<i></i>" : ""}${hasEvents ? '<i class="event-dot"></i>' : ""}</span>`;
  const taskCount = tasksOn(value).filter(t => !t.done).length;
  const eventCount = eventsOn(value).length;
  return `<button type="button" class="calendar-day ${cls}" data-action="select-day" data-date="${value}" aria-label="${esc(fullDate(value))}${info.holiday ? `, ${esc(info.holiday)}` : info.workday ? ", рабочая суббота" : ""}, ${taskCount} ${word(taskCount, "задача", "задачи", "задач")}, ${eventCount} ${word(eventCount, "событие", "события", "событий")}" ${value === ui.selected ? 'aria-pressed="true"' : ""}><span>${date.getDate()}</span>${dots}</button>`;
}
function calendarCard(summary = "", progress = null) {
  return `<div class="calendar-card ${ui.calendarExpanded ? "expanded" : ""} ${summary ? "with-summary" : ""}" data-calendar-swipe><div class="calendar-top"><button class="calendar-expand-title" type="button" data-action="calendar-expand" aria-expanded="${ui.calendarExpanded}" aria-label="${ui.calendarExpanded ? "Свернуть" : "Развернуть"} календарь">${esc(monthName(ui.month))}${icon(ui.calendarExpanded ? "up" : "down", "icon-sm")}</button>${summary}<div class="calendar-controls"><button type="button" data-action="month-prev" aria-label="Предыдущий месяц">${icon("left")}</button><button type="button" data-action="month-next" aria-label="Следующий месяц">${icon("right")}</button></div></div><div class="calendar-toolbar"><div class="segmented"><button type="button" data-action="calendar-mode" data-mode="week" class="${!ui.calendarExpanded ? "active" : ""}">Неделя</button><button type="button" data-action="calendar-mode" data-mode="month" class="${ui.calendarExpanded ? "active" : ""}">Месяц</button></div><button type="button" class="text-action" data-action="calendar-today">К сегодня</button></div><div class="calendar-weekdays"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div><div class="calendar-grid">${calendarDays().map(calendarDay).join("")}</div><div class="calendar-legend"><span><i></i>Задачи</span><span><i class="event-dot"></i>События</span><span><i class="holiday-dot"></i>Выходной</span></div>${progress !== null ? `<div class="plan-progress"><span style="width:${progress}%"></span></div>` : ""}<button type="button" class="calendar-handle" data-action="calendar-expand" aria-label="${ui.calendarExpanded ? "Свернуть" : "Развернуть"} календарь жестом"><span></span></button></div>`;
}
/** Подпись под датой: праздник или рабочая суббота. */
function dayNote(day) {
  const info = typeof dayInfo === "function" ? dayInfo(day) : null;
  if (info?.holiday) return `<small class="day-note is-off">${esc(info.holiday)}</small>`;
  if (info?.workday) return `<small class="day-note">Рабочий день (перенос)</small>`;
  return "";
}
function dayAgenda(day) {
  const tasks = tasksOn(day);
  const events = eventsOn(day);
  return `<section class="date-agenda"><div class="section-heading"><h2>${esc(fullDate(day))}${dayNote(day)}</h2><button class="text-action" type="button" data-action="add" data-type="task">Добавить ${icon("plus", "icon-sm")}</button></div>${tasks.length || events.length ? `${events.length ? `<div class="agenda-group-label">События</div>${events.map(eventCard).join("")}` : ""}${tasks.length ? `<div class="agenda-group-label">Задачи</div><div class="task-stack">${tasks.map(taskCard).join("")}</div>` : ""}` : emptyCard("Здесь пока свободно", "Выберите другую дату или добавьте задачу на этот день.")}</section>`;
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
function syncTaskChecklist(form) {
  const hidden = form?.querySelector('input[name="checklist"]');
  if (!hidden) return;
  hidden.value = [...form.querySelectorAll("[data-task-sub]")].map(input => input.value.trim()).filter(Boolean).join("\n");
}
function entrySheet() {
  const sheet = ui.sheet;
  const item = sheet.id ? record(sheet.type, sheet.id) : null;
  const draft = sheet.draft || {};
  const field = key => draft[key] ?? item?.[key] ?? "";
  const typeLabel = sheet.type === "event" ? "Событие" : sheet.type === "note" ? "Заметка" : "Задача";
  const title = item ? typeLabel : sheet.type === "event" ? "Новое событие" : sheet.type === "note" ? "Новая заметка" : "Новая задача";
  const typeExtra = item ? (() => { const bd = sheet.type === "event" && typeof BIRTHDAY_RE !== "undefined" && BIRTHDAY_RE.test(item.title || "") && /^\d{4}-\d{2}-\d{2}$/.test(item.due || "") ? birthdayNext(item.due) : null; return bd ? `<p class="entry-when">${bd.days === 0 ? "Сегодня" : `Через ${bd.days} ${plural(bd.days, "день", "дня", "дней")}`} · ${bd.day} ${MONTHS_GEN[bd.month]}</p>` : ""; })() : "";
  const defaultDue = item || Object.prototype.hasOwnProperty.call(draft, "due") ? field("due") : sheet.date ?? (ui.page === "tasks" ? "" : ui.selected || todayIso());
  const dateFields = sheet.type !== "note" ? `<div class="field-row"><label class="field">Дата<input name="due" type="date" value="${esc(defaultDue)}" ${sheet.type === "event" ? "required" : ""}></label><label class="field">Время<input name="time" type="time" value="${esc(field("time"))}"></label></div>` : "";
  const taskFields = sheet.type === "task" ? `<div class="field-row"><label class="field">Важность<select name="priority"><option value="high" ${field("priority") === "high" ? "selected" : ""}>Очень важно</option><option value="medium" ${!field("priority") || field("priority") === "medium" ? "selected" : ""}>Обычно</option><option value="low" ${field("priority") === "low" ? "selected" : ""}>Когда-нибудь</option></select></label><label class="field">Проект<select name="project"><option value="" ${!field("project") ? "selected" : ""}>Без проекта</option>${field("project") && !(data.projects || []).some(p => p.name === field("project")) ? `<option value="${esc(field("project"))}" selected>${esc(field("project"))}</option>` : ""}${(data.projects || []).map(p => `<option value="${esc(p.name)}" ${field("project") === p.name ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label></div>` : "";
  // Только то, что сервер выполняет: повтор задачи (день, будни, неделя, месяц, год),
  // у события — «каждый год» и «напомнить за…». О задаче со сроком бот напоминает в срок сам.
  const repeatValue = String(field("repeat") || "none");
  const repeatSelection = sheet.type === "task" && /^every:/.test(repeatValue) ? "custom" : repeatValue;
  const repeatOptions = sheet.type === "event" ? [["none", "Не повторять"], ["yearly", "Каждый год"]] : [["none", "Не повторять"], ["daily", "Каждый день"], ["weekdays", "По будням"], ["weekly", "Каждую неделю"], ["monthly", "Каждый месяц"], ["yearly", "Каждый год"], ["custom", "Каждые N дней"]];
  const reminderFields = sheet.type !== "note" ? `<div class="entry-reminders"><h3>${sheet.type === "event" ? "Повтор и напоминание" : "Повтор"}</h3><div class="field-row"><label class="field">Повторять<select name="repeat">${repeatOptions.map(([key, label]) => `<option value="${key}" ${repeatSelection === key ? "selected" : ""}>${label}</option>`).join("")}</select></label>${sheet.type === "event" ? `<label class="field">Напомнить<select name="remindBefore">${[["none", "Не напоминать"], ["at", "В момент начала"], ["5m", "За 5 минут"], ["15m", "За 15 минут"], ["1h", "За 1 час"], ["1d", "За 1 день"]].map(([key, label]) => `<option value="${key}" ${String(field("remindBefore") || (item ? "none" : "1h")) === key ? "selected" : ""}>${label}</option>`).join("")}</select></label>` : ""}</div>${sheet.type === "task" ? `${taskRepeatFields(repeatValue)}<p class="section-note">Следующая задача появится после выполнения; интервал считается от даты в плане. Со временем — бот напомнит в срок; без времени — утром в день срока.</p>` : ""}</div>` : "";
  if(!classicDesign()&&sheet.type==='task'){
    return taskAddSheet(sheet, item, field);
  }
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet dm-entry-workspace" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><header class="sheet-head dc2-window-head dm-quick-head"><div><p>${typeLabel}</p><h2 id="sheet-title">${title}</h2></div><div class="dc2-window-tools"><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div></header>${typeExtra}<form id="entry-form"><div class="dm-entry-body"><label class="field dm-entry-name">Название<input name="title" type="text" value="${esc(field("title"))}" placeholder="${sheet.type === "event" ? "Например, встреча в 15:00" : sheet.type === "note" ? "О чём заметка?" : "Что нужно сделать?"}" maxlength="120" required autofocus></label><div class="dm-entry-schedule">${dateFields}</div>${sheet.type !== "note" ? `<details class="dm-entry-options" ${item || field("description") || field("repeat") && field("repeat") !== "none" ? "open" : ""}><summary>Детали и повтор</summary>` : ""}<label class="field">${sheet.type === "event" ? "Место и детали" : sheet.type === "note" ? "Текст" : "Описание"}<textarea name="description" placeholder="Необязательно">${esc(field("description"))}</textarea></label>${taskFields}${sheet.type === "event" && (sheet.birthday || (typeof BIRTHDAY_RE !== "undefined" && BIRTHDAY_RE.test(item?.title || ""))) ? renderGiftFields(item) : ""}${sheet.type === "task" ? `<label class="field">Чек-лист<textarea name="checklist" rows="3" placeholder="Каждый пункт с новой строки. Все отмечены — задача закроется сама">${esc((item?.checklist || []).map(c => c.text).join("\n"))}</textarea></label>` : ""}${reminderFields}${sheet.type !== "note" ? "</details>" : ""}</div><div class="sheet-actions dm-entry-footer"><button class="ghost-button" type="button" data-action="close-sheet">Отмена</button>${item ? `<button class="icon-button danger-button" type="button" aria-label="Удалить запись" data-action="delete-record" data-type="${sheet.type}" data-id="${esc(item.id)}">${icon("trash")}</button>` : ""}<button class="primary-button" type="submit">${item ? "Сохранить" : "Добавить"}</button></div></form></section></div>`;
}
function taskEntryValues(sheet, item, field) {
  const draft = sheet.draft || {};
  const has = key => Object.prototype.hasOwnProperty.call(draft, key);
  const due = item || has("due") ? field("due") : sheet.date ?? (ui.page === "tasks" ? "" : ui.selected || todayIso());
  return {
    title: field("title"),
    due,
    time: field("time"),
    priority: field("priority") || "medium",
    project: field("project") || "",
    description: field("description"),
    checklist: typeof field("checklist") === "string" ? field("checklist") : (item?.checklist || []).map(c => c.text).join("\n"),
    repeat: String(field("repeat") || "none")
  };
}
const TASK_REPEAT_OPTIONS = [["none", "Нет"], ["daily", "Каждый день"], ["weekdays", "По будням"], ["weekly", "Каждую неделю"], ["monthly", "Каждый месяц"], ["yearly", "Каждый год"], ["custom", "Каждые N дней"]];
function taskProjectNames() {
  const names = (data.projects || []).map(project => project.name).filter(Boolean);
  return names.length ? names : ["Личное", "Работа", "Финансы"];
}
function taskProjectOptions(selected) {
  const names = taskProjectNames();
  const extra = selected && !names.includes(selected) ? `<option value="${esc(selected)}" selected>${esc(selected)}</option>` : "";
  return `<option value="" ${!selected ? "selected" : ""}>Без проекта</option>${extra}${names.map(name => `<option value="${esc(name)}" ${selected === name ? "selected" : ""}>${esc(name)}</option>`).join("")}`;
}
function taskSubtaskRows(checklist) {
  return checklist.split("\n").map(text => text.trim()).filter(Boolean).map(text => `<div class="dm-quick-sub"><span class="dm-quick-sub-dot" aria-hidden="true"></span><input type="text" value="${esc(text)}" placeholder="Введите подзадачу" aria-label="Подзадача" maxlength="120" data-task-sub><button type="button" data-action="task-subtask-remove" aria-label="Удалить подзадачу">${icon("close", "icon-sm")}</button></div>`).join("");
}
function taskAddSheet(sheet, item, field) {
  if (sheet.taskMode === "when") return taskWhenView(sheet, taskEntryValues(sheet, item, field));
  const draft = sheet.draft || {};
  const has = key => Object.prototype.hasOwnProperty.call(draft, key);
  const mode = sheet.taskMode === "list" ? "list" : sheet.taskMode === "note" ? "note" : "task";
  const due = item || has("due") ? field("due") : sheet.date ?? (ui.page === "tasks" ? "" : ui.selected || todayIso());
  const time = field("time");
  const title = field("title");
  const checklist = typeof field("checklist") === "string" ? field("checklist") : (item?.checklist || []).map(c => c.text).join("\n");
  const rowLabel = mode === "list" ? "Пункт списка" : "Подзадача";
  const rows = checklist.split("\n").map(text => text.trim()).filter(Boolean).map(text => `<div class="dm-task-add-sub"><span class="dm-task-add-dot" aria-hidden="true"></span><input type="text" value="${esc(text)}" placeholder="${rowLabel}" aria-label="${rowLabel}" maxlength="200" data-task-sub><button type="button" data-action="task-subtask-remove" aria-label="Удалить">${icon("close", "icon-sm")}</button></div>`).join("");
  const placeholder = mode === "list" ? "Название списка" : mode === "note" ? "О чём заметка?" : "Какой план на сегодня?";
  const kicker = mode === "list" ? "Новый список" : mode === "note" ? "Новая заметка" : "Новая задача";
  const sendLabel = mode === "list" ? "Создать список" : mode === "note" ? "Добавить заметку" : item ? "Сохранить" : "Добавить задачу";
  const glyph = (name, fallback) => typeof window.flowMagicObject === "function" ? `<span class="dm-task-add-glyph">${window.flowMagicObject(name, true)}</span>` : icon(fallback, "icon-sm");
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet dm-task-add" role="dialog" aria-modal="true" aria-label="${kicker}"><form id="entry-form"><div class="dm-task-add-field" data-has-text="${title.trim() ? "true" : "false"}"><textarea name="title" rows="1" placeholder="${placeholder}" aria-label="${mode === "list" ? "Название списка" : mode === "note" ? "Заголовок заметки" : "Название задачи"}" maxlength="120" required autofocus>${esc(title)}</textarea><button class="dm-task-add-star" type="button" data-action="task-dictate" aria-label="Надиктовать ассистенту"><span class="compose-assistant-star" aria-hidden="true"></span></button><button class="dm-task-add-send" type="submit" aria-label="${sendLabel}">${icon("arrow", "icon-sm")}</button></div><div class="dm-task-add-subs" data-task-sub-list ${mode === "note" ? "hidden" : ""}>${rows}</div><input type="hidden" name="checklist" value="${esc(checklist)}"><input type="hidden" name="due" value="${esc(due)}"><input type="hidden" name="time" value="${esc(time)}"><input type="hidden" name="priority" value="${esc(field("priority") || "medium")}"><input type="hidden" name="project" value="${esc(field("project") || "")}"><input type="hidden" name="description" value="${esc(field("description"))}"><input type="hidden" name="repeat" value="${esc(field("repeat") || "none")}"><div class="dm-task-add-actions"><button class="dm-task-add-action ${mode === "task" ? "active" : ""}" type="button" data-action="task-mode" data-mode="task" aria-label="Задача" title="Задача">${glyph("tasks", "check")}</button><button class="dm-task-add-action ${time ? "has-value" : ""}" type="button" data-action="task-when" ${mode !== "task" ? "disabled" : ""} aria-label="Время" title="Время">${glyph("today", "clock")}</button><button class="dm-task-add-action" type="button" data-action="task-subtask-add" ${mode === "note" ? "disabled" : ""} aria-label="Подзадача" title="Подзадача">${glyph("projects", "subtask")}</button><button class="dm-task-add-action ${mode === "note" ? "active" : ""}" type="button" data-action="task-mode" data-mode="note" aria-label="Заметка" title="Заметка">${glyph("notes", "note")}</button><button class="dm-task-add-action ${mode === "list" ? "active" : ""}" type="button" data-action="task-mode" data-mode="list" aria-label="Список" title="Список">${glyph("archive", "list")}</button></div></form></section></div>`;
}
function taskTimeDial(step, hour, minute) {
  if (step === "minute") {
    const values = Array.from({ length: 12 }, (_, index) => index * 5);
    const selected = minute - (minute % 5);
    return `<div class="dm-time-dial"><i class="dm-time-hand" style="--a:${minute * 6}deg;--h:118px"></i><span class="dm-time-center"></span>${values.map(value => `<button type="button" class="dm-time-num ${value === selected ? "selected" : ""}" style="--a:${value * 6}deg;--r:132px" data-action="task-time-pick" data-kind="minute" data-value="${value}">${String(value).padStart(2, "0")}</button>`).join("")}</div>`;
  }
  const outer = Array.from({ length: 12 }, (_, index) => index);
  const inner = Array.from({ length: 12 }, (_, index) => index + 12);
  const hand = (hour % 12) * 30;
  const handLength = hour >= 12 ? 88 : 122;
  const button = (value, radius) => `<button type="button" class="dm-time-num ${value === hour ? "selected" : ""}" style="--a:${(value % 12) * 30}deg;--r:${radius}px" data-action="task-time-pick" data-kind="hour" data-value="${value}">${value}</button>`;
  return `<div class="dm-time-dial"><i class="dm-time-hand" style="--a:${hand}deg;--h:${handLength}px"></i><span class="dm-time-center"></span>${outer.map(value => button(value, 132)).join("")}${inner.map(value => button(value, 96)).join("")}</div>`;
}
function taskWhenView(sheet, values) {
  const month = sheet.whenMonth || `${(values.due || todayIso()).slice(0, 7)}-01`;
  const [year, number] = month.split("-").map(Number);
  const cells = taskMonthCells(month, values.due);
  const repeatCurrent = /^every:/.test(values.repeat) ? "custom" : values.repeat;
  const repeatLabel = /^every:/.test(values.repeat) ? `Каждые ${Number(values.repeat.slice(6))} дн.` : (TASK_REPEAT_OPTIONS.find(([key]) => key === values.repeat)?.[1] || "Нет");
  const priorityLabel = { high: "Очень важно", medium: "Обычно", low: "Когда-нибудь" }[values.priority] || "Обычно";
  const projectLabel = values.project || "Без проекта";
  const menu = sheet.whenMenu || "";
  const timeOpen = Boolean(sheet.timePicker);
  const timeDraft = sheet.timeDraft || "";
  const [hour, minute] = (timeDraft || "09:00").split(":").map(Number);
  const timeStep = sheet.timeStep === "minute" ? "minute" : "hour";
  const option = (field, value, label, selected) => `<button type="button" class="dm-when-option ${selected ? "active" : ""}" data-action="task-when-pick" data-field="${field}" data-value="${esc(value)}">${esc(label)}${selected ? icon("check", "icon-sm") : ""}</button>`;
  const repeatOptions = TASK_REPEAT_OPTIONS.map(([key, label]) => option("repeat", key, label, repeatCurrent === key)).join("");
  const priorityOptions = [["high", "Очень важно"], ["medium", "Обычно"], ["low", "Когда-нибудь"]].map(([key, label]) => option("priority", key, label, values.priority === key)).join("");
  const projectOptions = [["", "Без проекта"], ...taskProjectNames().map(name => [name, name])].map(([key, label]) => option("project", key, label, values.project === key)).join("");
  const quick = [["Сегодня", todayIso()], ["Завтра", offsetIso(1)], ["3 дня спустя", offsetIso(3)], ["В это воскресенье", taskNextSundayIso()], ["Без даты", ""]];
  const timeChips = [["", "Нет времени"], ["07:00", "07:00"], ["09:00", "09:00"], ["10:00", "10:00"], ["12:00", "12:00"], ["14:00", "14:00"], ["16:00", "16:00"], ["18:00", "18:00"]].map(([value, label]) => `<button type="button" class="dm-time-chip ${timeDraft === value ? "active" : ""}" data-action="task-time-quick" data-time="${value}">${label}</button>`).join("");
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet dm-task-add dm-task-when-view" role="dialog" aria-modal="true" aria-label="Дата и время"><div class="dm-when-body"><div class="dm-when-month"><button type="button" data-action="task-month" data-dir="-1" aria-label="Предыдущий месяц">${icon("left", "icon-sm")}</button><strong>${MONTHS_NOM[number - 1]} ${year} г.</strong><button type="button" data-action="task-month" data-dir="1" aria-label="Следующий месяц">${icon("right", "icon-sm")}</button></div><div class="dm-when-week">${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(day => `<span>${day}</span>`).join("")}</div><div class="dm-when-grid">${cells.map(cell => `<button type="button" class="dm-when-day ${cell.selected ? "selected" : ""} ${cell.muted ? "muted" : ""} ${cell.today ? "today" : ""}" data-action="task-day" data-date="${cell.iso}" aria-label="${fullDate(cell.iso)}">${cell.day}</button>`).join("")}</div><div class="dm-when-quick">${quick.map(([label, iso]) => `<button type="button" class="dm-when-chip ${values.due === iso ? "active" : ""}" data-action="task-quick-date" data-date="${iso}">${label}</button>`).join("")}</div><div class="dm-when-rows"><div class="dm-when-row dm-when-row-pick"><button class="dm-when-pick" type="button" data-action="task-time-open" aria-expanded="${timeOpen}"><span>${icon("clock", "icon-sm")}Время</span><b>${esc(values.time || "Нет")}</b>${icon("down", "icon-sm")}</button></div><div class="dm-when-row dm-when-row-pick"><button class="dm-when-pick" type="button" data-action="task-when-menu" data-field="repeat" aria-expanded="${menu === "repeat"}"><span>${icon("repeat", "icon-sm")}Повтор</span><b>${esc(repeatLabel)}</b>${icon("down", "icon-sm")}</button></div><div class="dm-when-row dm-when-row-pick"><button class="dm-when-pick" type="button" data-action="task-when-menu" data-field="priority" aria-expanded="${menu === "priority"}"><span>${icon("flag", "icon-sm")}Важность</span><b>${esc(priorityLabel)}</b>${icon("down", "icon-sm")}</button></div><div class="dm-when-row dm-when-row-pick"><button class="dm-when-pick" type="button" data-action="task-when-menu" data-field="project" aria-expanded="${menu === "project"}"><span>${icon("folder", "icon-sm")}Проект</span><b>${esc(projectLabel)}</b>${icon("down", "icon-sm")}</button></div></div><div class="dm-when-extras">${taskRepeatFields(values.repeat)}<label class="field"><textarea name="description" data-task-when-desc placeholder="Описание" aria-label="Описание">${esc(values.description)}</textarea></label></div><div class="sheet-actions dm-when-footer"><button class="ghost-button" type="button" data-action="task-when-cancel">Отмена</button><button class="primary-button" type="button" data-action="task-when-done">Готово</button></div></div>${menu ? `<div class="dm-when-menu-layer" data-action="task-when-menu-layer-close"><div class="dm-when-menu-card" role="listbox" aria-label="${menu === "repeat" ? "Повтор" : menu === "priority" ? "Важность" : "Проект"}">${menu === "repeat" ? repeatOptions : menu === "priority" ? priorityOptions : projectOptions}</div></div>` : ""}${timeOpen ? `<div class="dm-time-layer" data-action="task-time-layer-close"><div class="dm-time-card"><h3 class="dm-time-title">Установить время</h3><div class="dm-time-display"><button type="button" class="${timeStep === "hour" ? "active" : ""}" data-action="task-time-step" data-step="hour">${timeDraft ? String(hour).padStart(2, "0") : "--"}</button><span>:</span><button type="button" class="${timeStep === "minute" ? "active" : ""}" data-action="task-time-step" data-step="minute">${timeDraft ? String(minute).padStart(2, "0") : "--"}</button></div>${taskTimeDial(timeStep, hour, minute)}<div class="dm-time-quick">${timeChips}</div><div class="dm-time-actions"><button class="ghost-button" type="button" data-action="task-time-cancel">Отмена</button><button class="primary-button" type="button" data-action="task-time-done">Готово</button></div></div></div>` : ""}</section></div>`;
}
function taskEntrySheet(sheet, item, values) {
  const mode = sheet.taskMode || "compose";
  if (mode === "when") return taskWhenSheet(sheet, values);
  if (mode === "time") return taskTimeSheet(sheet, values);
  if (mode === "list") return taskListSheet(sheet);
  return taskComposeSheet(sheet, item, values);
}
function taskComposeSheet(sheet, item, values) {
  const day = values.due ? values.due.slice(8, 10) : "";
  const hasText = values.title.trim() ? "true" : "false";
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet dm-entry-workspace dm-task-editor dm-task-quick dm-task-compact" role="dialog" aria-modal="true" aria-label="${item ? "Задача" : "Новая задача"}"><div class="sheet-handle"></div><h2 id="sheet-title" class="dm-quick-sr">${item ? "Задача" : "Новая задача"}</h2><form id="entry-form"><div class="dm-quick-body"><div class="dm-quick-subs" data-task-sub-list>${taskSubtaskRows(values.checklist)}</div><input type="hidden" name="checklist" value="${esc(values.checklist)}"><input type="hidden" name="due" value="${esc(values.due)}"><input type="hidden" name="time" value="${esc(values.time)}"><input type="hidden" name="priority" value="${esc(values.priority)}"><input type="hidden" name="project" value="${esc(values.project)}"><input type="hidden" name="description" value="${esc(values.description)}"><input type="hidden" name="repeat" value="${esc(values.repeat)}"><div class="check-add dc2-list-compose dm-task-compose" data-has-text="${hasText}"><div class="dc2-compose-main"><textarea name="title" rows="1" placeholder="Какой план на сегодня?" aria-label="Название задачи" maxlength="120" required autofocus>${esc(values.title)}</textarea><button class="dc2-compose-mic" type="button" data-action="task-dictate" aria-label="Надиктовать ассистенту"><span class="compose-assistant-star" aria-hidden="true"></span></button><button class="dc2-compose-send" type="submit" aria-label="${item ? "Сохранить задачу" : "Добавить задачу"}">${icon("arrow", "icon-sm")}</button></div><div class="dm-task-compose-actions"><button class="dc2-compose-add-sub" type="button" data-action="task-subtask-add">${icon("subtask", "icon-sm")}Подзадача</button><div class="dm-task-tools"><button class="dm-quick-tool dm-quick-date" type="button" data-action="task-when" aria-label="Дата и время">${icon("calendar", "icon-sm")}${day ? `<b>${day}</b>` : ""}</button><button class="dm-quick-tool" type="button" data-action="task-list" aria-label="Создать список" title="Список">${icon("list", "icon-sm")}</button><button class="dm-quick-tool" type="button" data-action="task-note" aria-label="Создать заметку" title="Заметка">${icon("note", "icon-sm")}</button></div></div></div></div></form></section></div>`;
}
function taskListSheet(sheet) {
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet dm-entry-workspace dm-task-editor dm-task-quick dm-task-list" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><header class="sheet-head dc2-window-head dm-quick-head"><div><p>Список</p><h2 id="sheet-title">Новый список</h2></div><div class="dc2-window-tools"><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div></header><form id="task-list-form"><div class="dm-quick-body"><label class="dm-quick-line"><input name="listTitle" type="text" placeholder="Название списка" aria-label="Название списка" maxlength="120" required autofocus></label><div class="dm-quick-subs" data-list-item-list></div><div class="dm-list-add"><input type="text" placeholder="Добавить пункт" aria-label="Новый пункт" maxlength="200" data-list-item-input><button type="button" data-action="task-list-item-add" aria-label="Добавить пункт">${icon("plus", "icon-sm")}</button></div></div><div class="sheet-actions dm-when-footer"><button class="ghost-button" type="button" data-action="task-list-cancel">Отмена</button><button class="primary-button" type="submit">Создать список</button></div></form></section></div>`;
}
function taskMonthCells(month, selected) {
  const [year, number] = month.split("-").map(Number);
  const first = new Date(year, number - 1, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const start = shiftDay(first, -offset);
  const today = todayIso();
  return Array.from({ length: 42 }, (_, index) => {
    const date = shiftDay(start, index);
    const iso = localIso(date);
    return { iso, day: date.getDate(), muted: date.getMonth() !== number - 1, today: iso === today, selected: iso === selected };
  });
}
function taskNextSundayIso() {
  const weekday = (new Date().getDay() + 6) % 7;
  return offsetIso((6 - weekday + 7) % 7);
}
function taskWhenSheet(sheet, values) {
  const month = sheet.whenMonth || `${(values.due || todayIso()).slice(0, 7)}-01`;
  const [year, number] = month.split("-").map(Number);
  const cells = taskMonthCells(month, values.due);
  const repeatCurrent = /^every:/.test(values.repeat) ? "custom" : values.repeat;
  const quick = [["Сегодня", todayIso()], ["Завтра", offsetIso(1)], ["3 дня спустя", offsetIso(3)], ["В это воскресенье", taskNextSundayIso()], ["Без даты", ""]];
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet dm-entry-workspace dm-task-editor dm-task-quick dm-task-when-sheet" role="dialog" aria-modal="true" aria-labelledby="when-title"><div class="sheet-handle"></div><h2 id="when-title" class="dm-quick-sr">Дата и время</h2><div class="dm-when-body"><div class="dm-when-month"><button type="button" data-action="task-month" data-dir="-1" aria-label="Предыдущий месяц">${icon("left", "icon-sm")}</button><strong>${MONTHS_NOM[number - 1]} ${year} г.</strong><button type="button" data-action="task-month" data-dir="1" aria-label="Следующий месяц">${icon("right", "icon-sm")}</button></div><div class="dm-when-week">${["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(day => `<span>${day}</span>`).join("")}</div><div class="dm-when-grid">${cells.map(cell => `<button type="button" class="dm-when-day ${cell.selected ? "selected" : ""} ${cell.muted ? "muted" : ""} ${cell.today ? "today" : ""}" data-action="task-day" data-date="${cell.iso}" aria-label="${fullDate(cell.iso)}">${cell.day}</button>`).join("")}</div><div class="dm-when-quick">${quick.map(([label, iso]) => `<button type="button" class="dm-when-chip ${values.due === iso ? "active" : ""}" data-action="task-quick-date" data-date="${iso}">${label}</button>`).join("")}</div><div class="dm-when-rows"><button type="button" class="dm-when-row" data-action="task-time"><span>${icon("clock", "icon-sm")}Время</span><b>${values.time ? esc(values.time) : "Нет"}</b></button><div class="dm-when-row"><span>${icon("repeat", "icon-sm")}Повтор</span><select name="repeat" data-task-when-field aria-label="Повтор">${TASK_REPEAT_OPTIONS.map(([key, label]) => `<option value="${key}" ${repeatCurrent === key ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="dm-when-row"><span>${icon("flag", "icon-sm")}Важность</span><select name="priority" data-task-when-field aria-label="Важность">${[["high", "Очень важно"], ["medium", "Обычно"], ["low", "Когда-нибудь"]].map(([key, label]) => `<option value="${key}" ${values.priority === key ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="dm-when-row"><span>${icon("folder", "icon-sm")}Проект</span><select name="project" data-task-when-field aria-label="Проект">${taskProjectOptions(values.project)}</select></div></div><div class="dm-when-extras">${taskRepeatFields(values.repeat)}<label class="field"><textarea name="description" data-task-when-desc placeholder="Описание" aria-label="Описание">${esc(values.description)}</textarea></label></div></div><div class="sheet-actions dm-when-footer"><button class="ghost-button" type="button" data-action="task-when-cancel">Отмена</button><button class="primary-button" type="button" data-action="task-when-done">Готово</button></div></section></div>`;
}
function taskTimeSheet(sheet, values) {
  const quick = [["Нет времени", ""], ["07:00", "07:00"], ["09:00", "09:00"], ["10:00", "10:00"], ["12:00", "12:00"], ["14:00", "14:00"], ["16:00", "16:00"], ["18:00", "18:00"]];
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet dm-entry-workspace dm-task-editor dm-task-quick dm-task-time-sheet" role="dialog" aria-modal="true" aria-labelledby="time-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="time-title">Установить время</h2></div><div class="dm-time-body"><input class="dm-time-input" type="time" value="${esc(values.time)}" data-task-time aria-label="Время"><div class="dm-when-quick">${quick.map(([label, value]) => `<button type="button" class="dm-when-chip ${values.time === value ? "active" : ""}" data-action="task-time-quick" data-time="${value}">${label}</button>`).join("")}</div></div><div class="sheet-actions dm-when-footer"><button class="ghost-button" type="button" data-action="task-time-cancel">Отмена</button><button class="primary-button" type="button" data-action="task-time-done">Готово</button></div></section></div>`;
}
function captureEntryDraft() {
  const form = document.getElementById("entry-form");
  if (!form || ui.sheet?.kind !== "entry") return;
  syncTaskChecklist(form);
  ui.sheet.draft = { ...(ui.sheet.draft || {}), ...Object.fromEntries(new FormData(form).entries()) };
}
function searchSheet() {
  return renderSearchSheetExt();
}
let renderedScrollIdentity = null;
let modalPageLock = null;
const sheetScrollSelectors = [".sheet", ".dm-entry-body", ".dc2-window-body", ".note-editor", ".note-reader", ".season-chips", ".pk-body"];
function sheetScrollIdentity() {
  const s = ui.sheet;
  return s ? JSON.stringify([ui.page, s.kind, s.category, s.id, s.mode, s.type, s.index]) : null;
}
function captureSheetScroll() {
  const identity = sheetScrollIdentity();
  if (!identity || identity !== renderedScrollIdentity) return null;
  return { identity, groups: sheetScrollSelectors.map(selector => ({ selector, positions: [...app.querySelectorAll(selector)].map(node => [node.scrollTop, node.scrollLeft]) })) };
}
function restoreSheetScroll(saved) {
  if (!saved || saved.identity !== sheetScrollIdentity()) return;
  for (const group of saved.groups) app.querySelectorAll(group.selector).forEach((node, i) => {
    const position = group.positions[i];
    if (position) { node.scrollTop = position[0]; node.scrollLeft = position[1]; }
  });
}
let scrollBeforeRender = null;
function syncModalScrollLock() {
  const open = Boolean(document.querySelector('[aria-modal="true"]:not([hidden]), .composer-layer, .live-file, .loyalty-full, .live-code-full'));
  const body = document.body;
  if (open && !modalPageLock) {
    // Прокрутку берём снятую до вставки окна: чтение после вставки заставляло
    // браузер пересчитать всю раскладку — больше половины времени открытия.
    const at = scrollBeforeRender || { x: window.scrollX, y: window.scrollY };
    modalPageLock = { x: at.x, y: at.y, page: ui.page, styles: Object.fromEntries(["position", "top", "left", "width"].map(key => [key, body.style[key]])) };
    Object.assign(body.style, { position: "fixed", top: `${-modalPageLock.y}px`, left: `${-modalPageLock.x}px`, width: "100%" });
  } else if (!open && modalPageLock) {
    const saved = modalPageLock;
    Object.assign(body.style, saved.styles);
    modalPageLock = null;
    document.documentElement.classList.remove("modal-open");
    body.classList.remove("modal-open");
    window.scrollTo({ top: saved.page === ui.page ? saved.y : 0, left: saved.x, behavior: "instant" });
  }
  document.documentElement.classList.toggle("modal-open", open);
  body.classList.toggle("modal-open", open);
}
// Некоторые окна мост добавляет вне app: они тоже должны удерживать фон.
new MutationObserver(syncModalScrollLock).observe(document.body, { childList: true, subtree: true });
let renderedShell = "";
let renderedShellChrome = "";
function focusRouteHeading() {
  const heading = app.querySelector(".main h1");
  if (!heading || ui.sheet) return;
  heading.tabIndex = -1;
  heading.dataset.flowRouteFocus = ui.page;
  heading.focus({ preventScroll: true });
}
function focusCurrentNavigation(selector) {
  const control = app.querySelector(`${selector} [aria-current="page"]`);
  if (!control || ui.sheet) return;
  control.dataset.flowNavFocus = ui.page;
  control.focus({ preventScroll: true });
}
function render() {
  const retainRouteFocus = !ui.sheet && document.activeElement?.dataset.flowRouteFocus === ui.page;
  const navigationFocus = !ui.sheet && document.activeElement?.dataset.flowNavFocus === ui.page
    ? document.activeElement.closest('.mobile-nav') ? '.mobile-nav' : '.sidebar' : null;
  if(typeof movieMarathonBegin==='function')movieMarathonBegin();
  captureSheetState();
  scrollBeforeRender = modalPageLock ? null : { x: window.scrollX, y: window.scrollY };
  const scroll = captureSheetScroll();
  const themeState={theme:themeTone(),palette:ui.theme,accent:data.settings.accent||"teal"};
  for(const [key,value] of Object.entries(themeState))if(document.documentElement.dataset[key]!==value)document.documentElement.dataset[key]=value;
  document.body.classList.toggle("density-compact", data.settings.density === "compact");
  document.body.classList.toggle("density-spacious", data.settings.density === "spacious");
  const page = ui.demoState !== "normal" && ui.page !== "settings" ? renderDemoStatePage() : ui.page === "today" ? todayPage() : ui.page === "upcoming" ? upcomingPage() : extendedPage(ui.page);
  const sheet = ui.sheet ? ui.sheet.kind === "search" ? searchSheet() : ui.sheet.kind === "entry" ? entrySheet() : renderExtendedSheet() : "";
  const shellChrome = typeof flowMagicShellStamp === "function" ? flowMagicShellStamp() : "";
  if(typeof movieMarathonEnd==='function')movieMarathonEnd();
  const overlay = `${sheet}${ui.toast ? `<div class="toast" role="status">${esc(ui.toast)}</div>` : ""}`;
  // Открыли или закрыли окно, показали подсказку, а экран под ними тот же —
  // меняем только окно. Пересборка всего экрана с картами и свайпами давала
  // 120–200 мс задержки на каждое открытие.
  const nav = app.querySelector(":scope > .app-shell > .mobile-nav");
  const hasMap = html => /id="(loyalty-map|mini-map|address-map)"/.test(html);
  if (nav && page === renderedShell && shellChrome === renderedShellChrome && !hasMap(sheet) && !(nav.parentElement.querySelector(":scope > .mobile-nav ~ * .leaflet-container"))) {
    while (nav.nextSibling) nav.nextSibling.remove();
    nav.insertAdjacentHTML("afterend", overlay);
    nav.parentElement.querySelectorAll(":scope > .mobile-nav ~ *").forEach(installSwipeCards);
    afterRender(scroll);
    return;
  }
  // Calendar changes replace their content, keeping the live header and navigation.
  const plan=app.querySelector('.dm-main > .dm-plan');
  if(!classicDesign()&&nav&&ui.page==='today'&&plan&&shellChrome===renderedShellChrome&&!hasMap(sheet)&&!nav.parentElement.querySelector(':scope > .mobile-nav ~ * .leaflet-container')){
    renderedShell=page;
    const main=plan.parentElement;if(!window.flowMagicPatchPlan?.(main,page))main.innerHTML=page;
    while(nav.nextSibling)nav.nextSibling.remove();nav.insertAdjacentHTML('afterend',overlay);
    const inboxButton=app.querySelector('.sidebar [data-page="inbox"]'),inbox=inboxButton?.querySelector('.nav-count');
    if(data.inbox.length){if(inbox)inbox.textContent=String(data.inbox.length);else inboxButton?.insertAdjacentHTML('beforeend',`<span class="nav-count">${data.inbox.length}</span>`);}else inbox?.remove();
    installSwipeCards(main);nav.parentElement.querySelectorAll(':scope > .mobile-nav ~ *').forEach(installSwipeCards);
    if(retainRouteFocus)focusRouteHeading();else if(navigationFocus)focusCurrentNavigation(navigationFocus);
    afterRender(scroll);return;
  }
  disposeAddressMap();
  if (typeof disposeLoyaltyMap === "function") disposeLoyaltyMap();
  renderedShell = page;
  renderedShellChrome = shellChrome;
  const sidebar = `<div class="sidebar-caption">План</div><nav class="sidebar-nav" aria-label="План">${navigation.slice(0, 3).filter(([name]) => name !== "upcoming").map(item => navItem(item)).join("")}</nav><div class="sidebar-caption sidebar-caption-gap">Пространство</div><nav class="sidebar-nav" aria-label="Разделы">${navigation.slice(3, 10).map(item => navItem(item)).join("")}</nav><div class="sidebar-caption sidebar-caption-gap">Другое</div><nav class="sidebar-nav" aria-label="Другое">${navigation.slice(10).map(item => navItem(item)).join("")}</nav>`;
  if (classicDesign()) {
    app.innerHTML = `<div class="app-shell"><aside class="sidebar"><div class="sidebar-brand">${brand()}</div>${sidebar}<div class="sidebar-foot"><p>Flow · личное пространство</p></div></aside><div><div class="mobile-brand">${brand()}</div><main class="main">${page}</main></div><button class="fab" type="button" data-action="${ui.page === "saved" ? "saved-new" : ui.page === "docs" ? "doc-new" : "universal-add"}" ${ui.page === "docs" ? 'data-kind="custom"' : ""} aria-label="Добавить запись">${icon("plus")}</button><nav class="mobile-nav" aria-label="Основная навигация">${mobileNavigation.map(item => navItem(item, true)).join("")}</nav>${overlay}</div>`;
  } else {
  app.innerHTML = `<div class="app-shell dm-app-shell"><aside class="sidebar dm-sidebar"><div class="sidebar-brand">${brand()}</div>${sidebar}<div class="sidebar-foot"><p>Flow · Digital Magic</p></div></aside><div class="dm-workspace">${typeof flowMagicTopbar === "function" ? flowMagicTopbar() : `<div class="mobile-brand">${brand()}</div>`}<main class="main dm-main">${page}</main></div><button class="fab" type="button" data-action="${ui.page === "saved" ? "saved-new" : ui.page === "docs" ? "doc-new" : "universal-add"}" ${ui.page === "docs" ? 'data-kind="custom"' : ""} aria-label="Добавить запись">${icon("plus")}</button><nav class="mobile-nav dm-bottom-nav" aria-label="Основная навигация">${mobileNavigation.map(item => navItem(item, true)).join("")}</nav>${overlay}</div>`;
  }
  if (retainRouteFocus) focusRouteHeading();
  else if (navigationFocus) focusCurrentNavigation(navigationFocus);
  const savedTabs = app.querySelector('.subtabs[role="tablist"]');
  const selectedSavedTab = savedTabs?.querySelector('[aria-selected="true"]');
  if (selectedSavedTab) savedTabs.scrollLeft = selectedSavedTab.offsetLeft - savedTabs.offsetLeft - (savedTabs.clientWidth - selectedSavedTab.offsetWidth) / 2;
  installSwipeCards(app);
  mountAddressMap();
  if (typeof mountLoyaltyMap === "function") { mountLoyaltyMap(); drawLoyaltyPeek(); }
  afterRender(scroll);
}
function afterRender(scroll) {
  if (window.FlowPiano) FlowPiano.mount();
  syncModalScrollLock();
  if (window.FlowEnglishMusic) FlowEnglishMusic.sync();
  if (typeof pcVolumeKeysSync === "function") pcVolumeKeysSync();
  scrollBeforeRender = null;
  restoreSheetState();
  // Restoring a draft also restores the selector; its dependent input must
  // remain enabled, otherwise FormData silently loses a custom repeat interval.
  const repeatForm=app.querySelector('.dm-task-editor #entry-form'),repeatDays=repeatForm?.querySelector('[data-repeat-days]');
  if(repeatDays){repeatDays.hidden=repeatForm.elements.repeat.value!=='custom';repeatDays.querySelector('input').disabled=repeatDays.hidden;}
  restoreSheetScroll(scroll);
  renderedScrollIdentity = sheetScrollIdentity();
  const quickTitle = app.querySelector(".dm-task-quick .dm-quick-title-input");
  if (quickTitle) {
    quickTitle.style.height = "auto";
    quickTitle.style.height = `${Math.min(120, Math.max(40, quickTitle.scrollHeight))}px`;
  }
  const compactTitle = app.querySelector(".dm-task-add .dm-task-add-field [name=title]");
  if (compactTitle) {
    compactTitle.style.height = "auto";
    compactTitle.style.height = `${Math.min(120, Math.max(44, compactTitle.scrollHeight))}px`;
    const wrap = compactTitle.closest(".dm-task-add-field");
    if (wrap) wrap.dataset.hasText = String(Boolean(compactTitle.value.trim()));
  }
  if (typeof startAssistantStarShimmer === "function") startAssistantStarShimmer();
  if (typeof movieWatchReturnCheck === "function") movieWatchReturnCheck();
  if (typeof syncMovieCarousel === "function") syncMovieCarousel();
  if (typeof refreshSavedAddressPreview === "function") refreshSavedAddressPreview();
  if (typeof watchLoyaltyPlaces === "function") watchLoyaltyPlaces();
}
function toast(message) {
  ui.toast = message;
  clearTimeout(toastTimer);
  render();
  toastTimer = setTimeout(() => { ui.toast = ""; app.querySelector(".toast")?.remove(); }, 2800);
}
function flowDictateInto(field, label = "Говорите…") {
  if (!field) return;
  const base = field.value.trim();
  const put = text => {
    const value = String(text || "").trim();
    if (!value) return;
    field.value = base ? `${base} ${value}` : value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.focus();
  };
  const voice = window.flowVoice;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const startRecognition = () => {
    if (!Recognition) return false;
    const recognition = new Recognition();
    recognition.lang = "ru-RU";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = event => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
      put(text);
    };
    recognition.onerror = () => toast("Не удалось включить микрофон");
    try { recognition.start(); } catch (_) { toast("Не удалось включить микрофон"); }
    return true;
  };
  const startVoice = () => {
    if (!voice?.getState?.().supported) return false;
    void voice.start(put, label);
    return true;
  };
  const localHost = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (localHost ? (startRecognition() || startVoice()) : (startVoice() || startRecognition())) return;
  toast("Голос работает в приложении бота");
}
window.flowDictateInto = flowDictateInto;
function toggleTask(recordId) {
  const task = data.tasks.find(item => item.id === recordId);
  if (!task) return;
  task.done = !task.done;
  save();
  toast(task.done ? "Задача завершена" : "Задача снова в плане");
}
function navigate(page) {
  if (!confirmSheetDiscard()) return;
  if (page === "sleep") page = "today";
  if (!validPages.includes(page)) return;
  // «Предстоящие» и «Обзор» теперь внутри «Плана».
  if (page === "upcoming" || page === "overview") page = "today";
  if (page === "today" && ui.page !== "today") { ui.selected = todayIso(); ui.calendarAnchor = ui.selected; ui.month = ui.selected.slice(0, 7) + "-01"; }
  if (ui.page !== page) ui.fromPage = ui.page; // кнопка «назад» ведёт туда, откуда пришли
  ui.page = page;
  ui.menu = false;
  ui.sheet = null;
  location.hash = page;
  render();
  window.scrollTo({ top: 0, behavior: window.flowDigital?.reducedMotion?.() ? "instant" : "smooth" });
}
function openEntry(type = "task", date = ["today", "upcoming"].includes(ui.page) ? ui.selected || todayIso() : ui.page === "tasks" ? "" : todayIso(), recordId = null) {
  if (type === "note") { openSavedRecord("notes", recordId); return; }
  ui.sheet = { kind: "entry", type, id: recordId, date, justRendered: false };
  ui.menu = false;
  render();
}
function closeSheet() {
  if (!confirmSheetDiscard()) return;
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
  if (event.type !== "touchcancel" && (drag.dy > Math.min(160, drag.sheet.offsetHeight * 0.3) || speed > 0.7) && confirmSheetDiscard(drag.sheet)) {
    drag.sheet.style.transform = "translateY(100%)";
    setTimeout(() => {
      if (!drag.sheet.isConnected) return;
      const componentClose = drag.sheet.querySelector('[data-action="sp-close"], [data-action="sl-close"]');
      if (componentClose) { componentClose.click(); return; }
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
  if (action === "navigate") {
    const navArea = event.detail === 0 ? control.closest(".dm-bottom-nav,.dm-sidebar") : null;
    const navSelector = navArea?.classList.contains("dm-bottom-nav") ? ".dm-bottom-nav" : ".dm-sidebar";
    if (control.dataset.page === "saved") ui.savedCategory = "overview";
    if (control.dataset.page === "finance") { ui.financeTab = "overview"; ui.financeCategory = ""; }
    navigate(control.dataset.page);
    if (navArea && !ui.sheet) focusCurrentNavigation(navSelector);
    else if (event.detail === 0 && !ui.sheet) focusRouteHeading();
    return;
  }
  if (action === "search") { if (!ui.sheet) { ui.searchQuery = ""; ui.searchPage = 1; ui.searchType = "all"; } ui.sheet = { kind: "search", justRendered: false }; ui.menu = false; render(); return; }
  if (action === "today-cards") { ui.menu = false; ui.sheet = { kind: "today-cards" }; render(); return; }
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
  if (action === "task-dictate") {
    const field = document.querySelector(".dm-task-add [name=title]");
    if (field) flowDictateInto(field, "Диктуйте задачу…");
    return;
  }
  if (action === "task-subtask-add") {
    const list = document.querySelector("#entry-form [data-task-sub-list]");
    if (list) {
      const mode = ui.sheet?.taskMode === "list" ? "list" : "task";
      const row = document.createElement("div");
      row.className = "dm-task-add-sub";
      row.innerHTML = `<span class="dm-task-add-dot" aria-hidden="true"></span><input type="text" placeholder="${mode === "list" ? "Пункт списка" : "Подзадача"}" aria-label="${mode === "list" ? "Пункт списка" : "Подзадача"}" maxlength="200" data-task-sub><button type="button" data-action="task-subtask-remove" aria-label="Удалить">${icon("close", "icon-sm")}</button>`;
      list.append(row);
      const input = row.querySelector("input");
      input.focus();
      row.scrollIntoView({ block: "nearest" });
    }
    return;
  }
  if (action === "task-subtask-remove") {
    const form = control.closest("#entry-form");
    control.closest(".dm-task-add-sub")?.remove();
    syncTaskChecklist(form);
    return;
  }
  if (action === "task-mode") {
    const form = document.getElementById("entry-form");
    if (form) { syncTaskChecklist(form); ui.sheet.draft = { ...(ui.sheet.draft || {}), ...Object.fromEntries(new FormData(form).entries()) }; }
    ui.sheet.taskMode = control.dataset.mode === "list" ? "list" : control.dataset.mode === "note" ? "note" : "task";
    ui.sheet.timeOpen = false;
    render();
    return;
  }
  if (action === "task-time-toggle") {
    const form = document.getElementById("entry-form");
    if (form) { syncTaskChecklist(form); ui.sheet.draft = { ...(ui.sheet.draft || {}), ...Object.fromEntries(new FormData(form).entries()) }; }
    ui.sheet.timeOpen = !ui.sheet.timeOpen;
    render();
    return;
  }
  if (action === "task-time-set") {
    const form = document.getElementById("entry-form");
    if (form) { syncTaskChecklist(form); ui.sheet.draft = { ...(ui.sheet.draft || {}), ...Object.fromEntries(new FormData(form).entries()), time: control.dataset.time || "" }; }
    ui.sheet.timeOpen = true;
    render();
    return;
  }
  if (action === "task-when") {
    captureEntryDraft();
    const draft = ui.sheet.draft || {};
    ui.sheet.whenBackup = { due: draft.due || "", time: draft.time || "", repeat: draft.repeat || "none", priority: draft.priority || "medium", project: draft.project || "", description: draft.description || "" };
    ui.sheet.whenMonth = `${(draft.due || todayIso()).slice(0, 7)}-01`;
    ui.sheet.whenMenu = null;
    ui.sheet.timePicker = false;
    ui.sheet.timeStep = "hour";
    ui.sheet.taskMode = "when";
    render();
    return;
  }
  if (action === "task-when-menu") {
    const field = control.dataset.field || "";
    ui.sheet.whenMenu = ui.sheet.whenMenu === field ? null : field;
    render();
    return;
  }
  if (action === "task-when-pick") {
    const field = control.dataset.field || "", value = control.dataset.value || "";
    ui.sheet.draft = { ...(ui.sheet.draft || {}) };
    if (field === "repeat" && value === "custom") ui.sheet.draft.repeat = "every:14";
    else ui.sheet.draft[field] = value;
    ui.sheet.whenMenu = null;
    render();
    return;
  }
  if (action === "task-when-menu-layer-close") {
    if (event.target === control) {
      ui.sheet.whenMenu = null;
      render();
    }
    return;
  }
  if (action === "task-time-open") {
    ui.sheet.timeDraft = ui.sheet.draft?.time || "09:00";
    ui.sheet.timeBackup = ui.sheet.draft?.time || "";
    ui.sheet.timeStep = "hour";
    ui.sheet.timePicker = true;
    ui.sheet.whenMenu = null;
    render();
    return;
  }
  if (action === "task-time-step") {
    ui.sheet.timeStep = control.dataset.step === "minute" ? "minute" : "hour";
    render();
    return;
  }
  if (action === "task-time-pick") {
    let draft = ui.sheet.timeDraft || "09:00";
    let [hours, minutes] = draft.split(":").map(Number);
    if (!Number.isFinite(hours)) hours = 9;
    if (!Number.isFinite(minutes)) minutes = 0;
    if (control.dataset.kind === "hour") {
      hours = Math.max(0, Math.min(23, Number(control.dataset.value) || 0));
      ui.sheet.timeStep = "minute";
    } else {
      minutes = Math.max(0, Math.min(55, Number(control.dataset.value) || 0));
    }
    ui.sheet.timeDraft = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    render();
    return;
  }
  if (action === "task-time-quick") {
    ui.sheet.timeDraft = control.dataset.time || "";
    render();
    return;
  }
  if (action === "task-time-cancel") {
    ui.sheet.draft.time = ui.sheet.timeBackup || "";
    ui.sheet.timePicker = false;
    render();
    return;
  }
  if (action === "task-time-layer-close") {
    if (event.target === control) {
      ui.sheet.draft.time = ui.sheet.timeBackup || "";
      ui.sheet.timePicker = false;
      render();
    }
    return;
  }
  if (action === "task-time-done") {
    ui.sheet.draft.time = ui.sheet.timeDraft || "";
    ui.sheet.timePicker = false;
    render();
    return;
  }
  if (action === "task-when-cancel") {
    Object.assign(ui.sheet.draft || (ui.sheet.draft = {}), ui.sheet.whenBackup || {});
    ui.sheet.taskMode = "task";
    ui.sheet.whenMenu = null;
    ui.sheet.timePicker = false;
    render();
    return;
  }
  if (action === "task-when-done") {
    const repeat = document.querySelector("[data-task-when-field][name=repeat]");
    if (repeat) {
      if (repeat.value === "custom") {
        const days = Number(document.querySelector(".dm-task-when-view [data-repeat-days] input")?.value || 0);
        ui.sheet.draft.repeat = /^[1-9]\d{0,3}$/.test(String(days)) ? `every:${days}` : "none";
      } else ui.sheet.draft.repeat = repeat.value;
    }
    const daysBox = document.querySelector(".dm-task-when-view [data-repeat-days]");
    if (daysBox && !daysBox.hidden) {
      const days = Number(daysBox.querySelector("input")?.value || 0);
      if (days >= 1) ui.sheet.draft.repeat = `every:${days}`;
    }
    const time = document.querySelector("[data-task-when-time]");
    if (time) ui.sheet.draft.time = time.value;
    const description = document.querySelector("[data-task-when-desc]");
    if (description) ui.sheet.draft.description = description.value;
    ui.sheet.taskMode = "task";
    ui.sheet.whenMenu = null;
    ui.sheet.timePicker = false;
    render();
    return;
  }
  if (action === "task-month") {
    const [year, number] = (ui.sheet.whenMonth || `${todayIso().slice(0, 7)}-01`).split("-").map(Number);
    ui.sheet.whenMonth = localIso(new Date(year, number - 1 + (Number(control.dataset.dir) || 0), 1, 12));
    render();
    return;
  }
  if (action === "task-day" || action === "task-quick-date") {
    const date = control.dataset.date || "";
    ui.sheet.draft = { ...(ui.sheet.draft || {}), due: date };
    if (date) ui.sheet.whenMonth = `${date.slice(0, 7)}-01`;
    render();
    return;
  }
  if (action === "task-time") {
    ui.sheet.timeBackup = ui.sheet.draft?.time || "";
    ui.sheet.taskMode = "time";
    render();
    return;
  }
  if (action === "task-time-cancel") {
    ui.sheet.draft.time = ui.sheet.timeBackup || "";
    ui.sheet.taskMode = "when";
    render();
    return;
  }
  if (action === "task-time-done") { ui.sheet.taskMode = "when"; render(); return; }
  if (action === "task-time-quick") { ui.sheet.draft.time = control.dataset.time || ""; render(); return; }
  if (action === "add") { openEntry(control.dataset.type || "task"); return; }
  if (action === "edit") { openEntry(control.dataset.type, ui.page === "tasks" ? "" : ui.selected, control.dataset.id); return; }
  if (action === "task-list") {
    captureEntryDraft();
    ui.sheet.taskMode = "list";
    render(); return;
  }
  if (action === "task-list-cancel") {
    ui.sheet.taskMode = "compose";
    render(); return;
  }
  if (action === "task-list-item-add") {
    const form = document.getElementById("task-list-form");
    const input = form?.querySelector("[data-list-item-input]");
    const list = form?.querySelector("[data-list-item-list]");
    if (input && list) {
      const text = input.value.trim();
      if (!text) { input.focus(); return; }
      const row = document.createElement("div");
      row.className = "dm-quick-sub";
      row.innerHTML = `<span class="dm-quick-sub-dot" aria-hidden="true"></span><input type="text" value="${esc(text)}" aria-label="Пункт списка" maxlength="200" data-list-item><button type="button" data-action="task-list-item-remove" aria-label="Удалить пункт">${icon("close", "icon-sm")}</button>`;
      list.append(row);
      input.value = "";
      input.focus();
    }
    return;
  }
  if (action === "task-list-item-remove") {
    control.closest(".dm-quick-sub")?.remove();
    return;
  }
  if (action === "task-note") {
    captureEntryDraft();
    ui.sheet.type = "note";
    ui.sheet.taskMode = "compose";
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
  if (ui.sheet.taskMode === "list") {
    const items = [...event.target.querySelectorAll("[data-task-sub]")].map(input => input.value.trim()).filter(Boolean).map(text => ({ id: id(), text, done: false }));
    data.saved ||= {};
    data.saved.lists ||= [];
    const list = { id: id(), title, items, created: new Date().toISOString() };
    data.saved.lists.push(list);
    save();
    if (typeof openSavedRecord === "function") openSavedRecord("lists", list.id, "view");
    else { ui.sheet = null; render(); }
    toast("Список создан");
    return;
  }
  if (ui.sheet.taskMode === "note") {
    const note = { id: id(), title, description: "", pinned: false, created: new Date().toISOString(), updated: new Date().toISOString() };
    data.notes.push(note);
    save();
    if (typeof openSavedRecord === "function") openSavedRecord("notes", note.id, "view");
    else { ui.sheet = null; render(); }
    toast("Заметка создана");
    return;
  }
  const type = ui.sheet.type;
  let repeat;
  try { repeat = type === "task" ? readTaskRepeat(form) : String(form.get("repeat") || "none"); } catch (error) { toast(error.message); return; }
  const key = type === "task" ? "tasks" : type === "event" ? "events" : "notes";
  const existing = ui.sheet.id ? record(type, ui.sheet.id) : null;
  const item = existing || { id: id() };
  item.title = title;
  item.description = String(form.get("description") || "").trim();
  if (type !== "note") { item.due = String(form.get("due") || (type === "event" ? todayIso() : "")); item.time = String(form.get("time") || ""); item.repeat = repeat; if (form.has("remindBefore")) item.remindBefore = String(form.get("remindBefore") || "none"); }
  if (type === "event" && form.has("gifts")) {
    item.gifts = readGiftFields(document.getElementById("entry-form"));
  }
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
  toast(existing ? "Изменения сохранены" : type === "event" ? "Событие добавлено" : `${type === "task" ? "Задача" : "Заметка"} добавлена`);
});
document.addEventListener("submit", event => {
  if (event.target.id !== "task-list-form" || !ui.sheet || ui.sheet.kind !== "entry") return;
  event.preventDefault();
  const title = String(new FormData(event.target).get("listTitle") || "").trim();
  if (!title) { event.target.elements.listTitle?.focus(); return; }
  const items = [...event.target.querySelectorAll("[data-list-item]")].map(input => input.value.trim()).filter(Boolean).map(text => ({ id: id(), text, done: false }));
  data.saved ||= {};
  data.saved.lists ||= [];
  data.saved.lists.push({ id: id(), title, items, created: new Date().toISOString() });
  ui.sheet = null;
  save();
  toast("Список создан");
});
document.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey && event.target.matches?.("[data-list-item-input]")) {
    event.preventDefault();
    document.querySelector("#task-list-form [data-action='task-list-item-add']")?.click();
  }
  if (event.key === "Enter" && !event.shiftKey && event.target.matches?.("[data-subtask-compose]")) {
    event.preventDefault();
    document.querySelector("#entry-form [data-action='task-subtask-compose-add']")?.click();
  }
  if (event.key === "Enter" && !event.shiftKey && event.target.matches?.(".dm-task-add .dm-task-add-field [name=title]")) {
    event.preventDefault();
    event.target.closest("form")?.requestSubmit();
  }
});
document.addEventListener("input", event => {
  handleExtendedInput(event);
  const subtask = event.target.closest?.("[data-task-sub]");
  if (subtask) syncTaskChecklist(subtask.closest("#entry-form"));
  const composeTitle = event.target.closest?.(".dm-task-add .dm-task-add-field [name=title]");
  if (composeTitle) {
    const wrap = composeTitle.closest(".dm-task-add-field");
    if (wrap) wrap.dataset.hasText = String(Boolean(composeTitle.value.trim()));
    composeTitle.style.height = "auto";
    composeTitle.style.height = `${Math.min(120, Math.max(44, composeTitle.scrollHeight))}px`;
  }
  const whenDescription = event.target.closest?.("[data-task-when-desc]");
  if (whenDescription && ui.sheet?.kind === "entry") ui.sheet.draft = { ...(ui.sheet.draft || {}), description: whenDescription.value };
  const whenTimeInput = event.target.closest?.("[data-task-when-time]");
  if (whenTimeInput && ui.sheet?.kind === "entry") ui.sheet.draft = { ...(ui.sheet.draft || {}), time: whenTimeInput.value };
  const repeatDays = event.target.closest?.(".dm-task-when-view [data-repeat-days] input");
  if (repeatDays && ui.sheet?.kind === "entry") {
    const days = Number(repeatDays.value);
    if (days >= 1) ui.sheet.draft = { ...(ui.sheet.draft || {}), repeat: `every:${days}` };
  }
  const time = event.target.closest?.("[data-task-time]");
  if (time && ui.sheet?.kind === "entry") ui.sheet.draft = { ...(ui.sheet.draft || {}), time: time.value };
});
document.addEventListener("change", event => {
  handleExtendedChange(event);
  const select = event.target.closest?.("[data-task-when-field]");
  if (select && ui.sheet?.kind === "entry") {
    ui.sheet.draft = { ...(ui.sheet.draft || {}), [select.name]: select.value };
    if (select.name === "repeat") {
      const days = document.querySelector(".dm-task-when-view [data-repeat-days]");
      if (days) { days.hidden = select.value !== "custom"; const input = days.querySelector("input"); if (input) input.disabled = days.hidden; }
    }
  }
  const whenTimeInput = event.target.closest?.("[data-task-when-time]");
  if (whenTimeInput && ui.sheet?.kind === "entry") ui.sheet.draft = { ...(ui.sheet.draft || {}), time: whenTimeInput.value };
  const repeatDays = event.target.closest?.(".dm-task-when-view [data-repeat-days] input");
  if (repeatDays && ui.sheet?.kind === "entry") {
    const days = Number(repeatDays.value);
    if (days >= 1) ui.sheet.draft = { ...(ui.sheet.draft || {}), repeat: `every:${days}` };
  }
  const time = event.target.closest?.("[data-task-time]");
  if (time && ui.sheet?.kind === "entry") ui.sheet.draft = { ...(ui.sheet.draft || {}), time: time.value };
});
window.addEventListener("hashchange", () => { if (location.hash === "#sleep") history.replaceState(null, "", "#today"); const page = currentPage(); if (page !== ui.page) { if (!confirmSheetDiscard()) { history.replaceState(null, "", `#${ui.page}`); return; } ui.page = page; ui.sheet = null; ui.menu = false; render(); } });
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
  if (!card || card.classList.contains("dm-calendar-surface") || event.target.closest(".calendar-handle")) return;
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
// Inline app choices: no Android system select dialog and no lost form draft.
function flowChoicePicker({value = '', label, options, attrs = ''}) {
  const selected = options.find(option => option.value === value);
  return `<details class="flow-choice"><summary class="tool-button"><span class="flow-choice-label">${esc((value && selected?.label) || label)}</span>${icon('down','icon-sm')}</summary><div class="flow-choice-options" role="group" aria-label="${esc(label)}">${options.map(option => `<button type="button" class="map-category-chip ${option.value === value ? 'active' : ''}" data-flow-choice="${esc(option.value)}" aria-pressed="${option.value === value}">${esc(option.label)}</button>`).join('')}</div><input type="hidden" value="${esc(value)}" ${attrs}></details>`;
}
document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-flow-choice]');
  if (!button) return;
  const picker = button.closest('.flow-choice');
  if (picker.dataset.busy === 'true') return;
  const input = picker.querySelector('input[type=hidden]');
  input.value = button.dataset.flowChoice;
  picker.querySelector('.flow-choice-label').textContent = button.textContent;
  picker.querySelectorAll('[data-flow-choice]').forEach(option => {
    const active = option === button; option.classList.toggle('active',active); option.setAttribute('aria-pressed',String(active));
  });
  picker.open = false;
  input.dispatchEvent(new Event('change',{bubbles:true}));
});
document.addEventListener("click", event => {
  if (Date.now() < swipeSuppressCalendar && event.target.closest(".calendar-card")) { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
/* Подпись поля живёт внутри как placeholder: убираем отдельную строку над полем. */
(() => {
  const textTypes = new Set(["text", "search", "email", "tel", "url", "number", "password"]);
  const skip = ".switch,.settings-row,.ss-preference,.sl-list-row,.sp-toggle,.sp-check-line,.sl-check,.gift-check,.accent-swatch,.loyalty-color-own,.loyalty-color-none,.rules-auto,.movie-cover-remove,.doc-photo-add,.pn-import,.en-go.en-upload";
  const done = new WeakSet();
  const controlOf = label => {
    const inside = label.querySelector("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=color]):not([type=submit]):not([type=button]), textarea, select");
    if (inside) return inside;
    if (!label.htmlFor) return null;
    const outside = document.getElementById(label.htmlFor);
    return outside && outside.matches("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=color]):not([type=submit]):not([type=button]), textarea, select") ? outside : null;
  };
  const captionOf = label => {
    const direct = [...label.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(" ").replace(/\s+/g, " ").trim();
    if (direct) return { text: direct, node: null };
    const child = [...label.children].find(node => /^(SPAN|STRONG|SMALL|B)$/.test(node.tagName) && !node.querySelector("input,textarea,select,button") && node.textContent.trim());
    return child ? { text: child.textContent.trim(), node: child } : null;
  };
  const simplify = root => {
    for (const label of root.querySelectorAll("label")) {
      if (done.has(label) || label.matches(skip)) continue;
      const control = controlOf(label);
      if (!control || !control.getClientRects().length) continue;
      const caption = captionOf(label);
      if (!caption) continue;
      const text = caption.text.replace(/\s+/g, " ").trim();
      if (!text || text.length > 80) continue;
      if (!control.getAttribute("aria-label")) control.setAttribute("aria-label", text);
      if (!control.dataset.inFieldLabel) {
        if ((control.tagName === "TEXTAREA" || (control.tagName === "INPUT" && textTypes.has(control.type))) && !control.placeholder) control.placeholder = text;
        control.dataset.inFieldLabel = "true";
      }
      if (caption.node) caption.node.hidden = true;
      else if (label.htmlFor) label.hidden = true;
      else for (const node of [...label.childNodes]) if (node.nodeType === Node.TEXT_NODE) node.remove();
      label.dataset.inFieldLabel = "true";
      done.add(label);
    }
  };
  let queued = false;
  const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; simplify(document); }); };
  const boot = () => { simplify(document); new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true }); else boot();
})();
