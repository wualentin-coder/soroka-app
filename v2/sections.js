/* Дополнительные экраны дизайн-прототипа. Серверные интеграции здесь не вызываются. */
const SAVED_CATEGORIES = [
  ["notes", "Заметки", "note"], ["files", "Файлы", "archive"],
  ["posts", "Посты", "inbox"], ["links", "Ссылки", "link"],
  ["lists", "Списки", "check"], ["recipes", "Рецепты", "bowl"],
  ["movies", "Фильмы", "film"], ["products", "Товары", "wallet"],
  ["addresses", "Адреса", "pin"], ["tickets", "Билеты", "ticket"],
  ["cards", "Карты", "card"]
];
const SAVED_NAMES = Object.fromEntries(SAVED_CATEGORIES.map(([key, label]) => [key, label]));

function extraSeed() {
  const now = todayIso();
  return {
    saved: {
      files: [
        { id: id(), title: "Бриф проекта.pdf", description: "Короткое описание проекта и референсы.", topic: "Работа", tags: ["проект", "бриф"], minutes: 12, viewed: false, pinned: true, source: "Документ из чата", filePath: "./demo-files/project-brief.pdf", previewPath: "./demo-files/project-brief-preview.png", fileType: "application/pdf", created: now },
        { id: id(), title: "Инструкция к кофемашине.pdf", description: "Руководство и уход.", topic: "Дом", tags: ["техника"], minutes: 8, viewed: true, pinned: false, source: "Файл из Telegram", filePath: "./demo-files/coffee-guide.pdf", previewPath: "./demo-files/coffee-guide-preview.png", fileType: "application/pdf", created: offsetIso(-8) }
      ],
      posts: [
        { id: id(), title: "Идеи для выходных в городе", description: "Маршрут по тихим улицам и два небольших музея.", body: "Когда хочется сменить обстановку без долгой поездки, попробуйте провести день в знакомом городе по новому маршруту. Начните с тихих улиц, где приятно идти без спешки и заглядывать во дворы.\n\nПосле прогулки зайдите в небольшой музей, а затем устройте перерыв на кофе. Вторую выставку оставьте на вечер: так день не превратится в гонку по точкам.\n\nПеред выходом проверьте часы работы музеев и сохраните адреса. Маршрут легко сократить до пары часов или растянуть на весь день.", summary: "Неспешный маршрут на выходной: прогулка по тихим улицам, два небольших музея и пауза на кофе. Перед выходом стоит проверить часы работы.", media: [{ type: "image", src: "./assets/weekend-street.png", alt: "Тихая городская улица и здание музея" }, { type: "image", src: "./assets/weekend-museum.png", alt: "Зал небольшого музея" }], topic: "Поездки", tags: ["маршрут"], minutes: 5, viewed: false, pinned: false, source: "Канал «Город рядом»", created: offsetIso(-2) }
      ],
      links: [
        { id: id(), title: "Понимание CSS Grid", description: "Урок по современной раскладке интерфейсов.", topic: "Учёба", tags: ["вёрстка", "дизайн"], minutes: 24, viewed: false, pinned: true, source: "YouTube", url: "https://developer.mozilla.org/ru/docs/Web/CSS/CSS_grid_layout", created: offsetIso(-6) },
        { id: id(), title: "Маршрут по Казани", description: "Места для короткой поездки.", topic: "Поездки", tags: ["путешествие"], minutes: 9, viewed: false, pinned: false, source: "Ссылка из чата", url: "https://example.com/kazan", created: offsetIso(-3) }
      ],
      lists: [
        { id: id(), title: "Покупки на неделю", description: "", topic: "Дом", tags: ["покупки"], pinned: false, created: now, items: [{ id: id(), text: "Молоко", done: false }, { id: id(), text: "Кофе", done: false }, { id: id(), text: "Овощи", done: true }] },
        { id: id(), title: "Для поездки", description: "Что не забыть перед выездом.", topic: "Поездки", tags: ["поездка"], pinned: false, created: offsetIso(-3), items: [{ id: id(), text: "Билеты", done: true }, { id: id(), text: "Зарядка", done: false }] }
      ],
      recipes: [
        { id: id(), title: "Лимонный пирог", description: "Сохранено из видео. Мягкий пирог с цедрой.", topic: "Еда", tags: ["выпечка"], minutes: 45, servings: 4, ingredients: ["Мука — 220 г", "Лимон — 2 шт.", "Яйца — 3 шт."], steps: ["Смешать сухие ингредиенты", "Добавить яйца и цедру", "Выпекать 35 минут"], source: "Видео из чата", viewed: false, pinned: false, created: offsetIso(-4) }
      ],
      movies: [
        { id: id(), title: "Патерсон", description: "Тихая история о привычном и важном.", topic: "Кино", tags: ["драма"], year: 2016, director: "Джим Джармуш", where: "Кинопоиск", status: "Хочу посмотреть", kinopoiskUrl: "https://www.kinopoisk.ru/film/954059/", kinopoiskRating: 7.2, imdbRating: 7.3, source: "Совет из переписки", coverPath: "./assets/paterson-cover.webp", pinned: false, created: offsetIso(-7) }
      ],
      products: [
        { id: id(), title: "Настольная лампа", description: "Тёплый свет для рабочего стола.", topic: "Дом", tags: ["хотелки"], price: 3490, store: "Маркетплейс", tracked: true, source: "Ссылка из чата", pinned: false, created: offsetIso(-5) }
      ],
      tickets: [
        { id: id(), title: "Концерт в филармонии", description: "Вечерний концерт", ticketType: "event", eventDate: offsetIso(12), eventTime: "19:00", venue: "Большой зал филармонии", seat: "Ряд 8 · место 12", reference: "SRK-48216", codeType: "qr", codeValue: "DEMO-SRK-48216", topic: "Мероприятия", pinned: true, source: "Билет из чата", created: now },
        { id: id(), title: "Поезд Москва — Санкт-Петербург", description: "Скоростной поезд", ticketType: "train", eventDate: offsetIso(18), eventTime: "07:00", origin: "Москва", destination: "Санкт-Петербург", seat: "Вагон 5 · место 18", reference: "RZD-19482", codeType: "barcode", codeValue: "DEMO-RZD-19482", topic: "Поезд", source: "Письмо с билетом", created: now },
        { id: id(), title: "Рейс в Казань", description: "Поездка на выходные", ticketType: "flight", eventDate: offsetIso(26), eventTime: "10:45", origin: "Москва", destination: "Казань", carrier: "Рейс SU 1206", seat: "14A", reference: "KZN-62451", codeType: "qr", codeValue: "DEMO-KZN-62451", topic: "Самолёт", source: "Билет из чата", created: now }
      ],
      addresses: [
        { id: id(), title: "Третьяковская галерея", description: "Главное здание, вход со стороны Лаврушинского переулка.", address: "Москва, Лаврушинский переулок, 10", city: "Москва", topic: "Клиенты", categoryId: "clients", lat: 55.7415, lng: 37.6208, tags: ["музей"], source: "Ссылка из чата", pinned: true, viewed: false, created: offsetIso(-2) },
        { id: id(), title: "Новая Голландия", description: "Место для прогулки и встреч.", address: "Санкт-Петербург, набережная Адмиралтейского канала, 2", city: "Санкт-Петербург", topic: "Поехать", categoryId: "travel", lat: 59.9293, lng: 30.2892, tags: ["парк"], source: "Геолокация из Telegram", pinned: false, viewed: false, created: offsetIso(-5) },
        { id: id(), title: "Магазин у дома", description: "Забрать заказ после работы.", address: "Москва, Пятницкая улица, 28", city: "Москва", topic: "Покупки", categoryId: "shopping", lat: 55.7392, lng: 37.6271, tags: [], source: "Координаты из чата", pinned: false, viewed: false, created: offsetIso(-1) }
      ]
    },
    mapCategories: [
      { id: "home", name: "Дом", icon: "event", color: "#8dbbb4", sortOrder: 0 },
      { id: "work", name: "Работа", icon: "project", color: "#8ba9df", sortOrder: 1 },
      { id: "clients", name: "Клиенты", icon: "bookmark", color: "#d8a572", sortOrder: 2 },
      { id: "travel", name: "Поехать", icon: "arrow", color: "#ba9ad9", sortOrder: 3 },
      { id: "shopping", name: "Покупки", icon: "wallet", color: "#d9949e", sortOrder: 4 }
    ],
    savedSections: {
      notes: [{ id: "ideas", name: "Идеи", icon: "note", color: "#8dbbb4", sortOrder: 0 }, { id: "trips", name: "Поездки", icon: "arrow", color: "#ba9ad9", sortOrder: 1 }],
      recipes: [{ id: "food", name: "Еда", icon: "bookmark", color: "#d8a572", sortOrder: 0 }, { id: "drinks", name: "Напитки", icon: "event", color: "#8ba9df", sortOrder: 1 }],
      movies: [{ id: "cinema", name: "Кино", icon: "event", color: "#ba9ad9", sortOrder: 0 }, { id: "series", name: "Сериалы", icon: "overview", color: "#8ba9df", sortOrder: 1 }],
      files: [{ id: "work", name: "Работа", icon: "project", color: "#8ba9df", sortOrder: 0 }, { id: "home", name: "Дом", icon: "archive", color: "#8dbbb4", sortOrder: 1 }],
      posts: [{ id: "trips", name: "Поездки", icon: "arrow", color: "#ba9ad9", sortOrder: 0 }, { id: "ideas", name: "Идеи", icon: "note", color: "#8dbbb4", sortOrder: 1 }],
      links: [{ id: "study", name: "Учёба", icon: "bookmark", color: "#8ba9df", sortOrder: 0 }, { id: "trips", name: "Поездки", icon: "arrow", color: "#ba9ad9", sortOrder: 1 }],
      lists: [{ id: "home", name: "Дом", icon: "event", color: "#8dbbb4", sortOrder: 0 }, { id: "trips", name: "Поездки", icon: "arrow", color: "#ba9ad9", sortOrder: 1 }, { id: "food", name: "Еда", icon: "bookmark", color: "#d8a572", sortOrder: 2 }],
      products: [{ id: "home", name: "Дом", icon: "event", color: "#8dbbb4", sortOrder: 0 }, { id: "wish", name: "Хочу купить", icon: "wallet", color: "#d9949e", sortOrder: 1 }],
      tickets: [{ id: "events", name: "Мероприятия", icon: "ticket", color: "#d8a572", sortOrder: 0 }, { id: "trains", name: "Поезд", icon: "arrow", color: "#8ba9df", sortOrder: 1 }, { id: "flights", name: "Самолёт", icon: "arrow", color: "#8dbbb4", sortOrder: 2 }]
    },
    finance: {
      accounts: [
        { id: "main", name: "Основная карта", currency: "RUB", opening: 30000 },
        { id: "cash", name: "Наличные", currency: "RUB", opening: 7200 },
        { id: "usd", name: "Валютный счёт", currency: "USD", opening: 120 }
      ],
      transactions: [
        { id: id(), title: "Зарплата", kind: "income", amount: 30000, currency: "RUB", category: "Работа", accountId: "main", date: offsetIso(-11), project: "Работа", manual: true },
        { id: id(), title: "Продукты", kind: "expense", amount: 3500, currency: "RUB", category: "Еда", accountId: "main", date: offsetIso(-4), project: "Личное", manual: true },
        { id: id(), title: "Такси", kind: "expense", amount: 2200, currency: "RUB", category: "Транспорт", accountId: "main", date: offsetIso(-3), project: "Личное", manual: true },
        { id: id(), title: "Материалы", kind: "expense", amount: 4200, currency: "RUB", category: "Работа", accountId: "main", date: offsetIso(-2), project: "Работа", manual: true },
        { id: id(), title: "Кофейня", kind: "expense", amount: 1500, currency: "RUB", category: "Еда", accountId: "main", date: offsetIso(-1), project: "Личное", manual: true }
      ],
      budgets: [{ id: id(), category: "Еда", limit: 25000 }, { id: id(), category: "Транспорт", limit: 8000 }],
      goals: [{ id: id(), title: "Подушка", target: 100000, saved: 32000, note: "Резерв на непредвиденные расходы" }],
      transfers: [],
      debts: [{ id: id(), person: "Рома", direction: "to-me", amount: 5000, paid: 0, note: "За билеты" }, { id: id(), person: "Катя", direction: "i-owe", amount: 3000, paid: 1000, note: "За общий заказ" }],
      payments: [{ id: id(), title: "Связь", amount: 690, day: 28, category: "Подписки", status: "pending" }, { id: id(), title: "Облако", amount: 399, day: 5, category: "Подписки", status: "upcoming" }],
      rules: [{ name: "Подушка", percent: 10 }, { name: "Валюта", percent: 20 }, { name: "Инвестиции", percent: 10 }, { name: "Свободно", percent: 60 }]
    },
    projects: [
      { id: id(), name: "Работа", description: "Текущие задачи, документы и рабочие расходы.", status: "Активен", color: "#58d0cf" },
      { id: id(), name: "Личное", description: "Дом, встречи и планы на выходные.", status: "Активен", color: "#e0c27f" },
      { id: id(), name: "Финансы", description: "Платежи, цели и документы.", status: "Активен", color: "#f49e7b" }
    ],
    metrics: [{ id: id(), title: "Сон", value: 7.5, unit: "ч", date: offsetIso(-2) }, { id: id(), title: "Сон", value: 8, unit: "ч", date: offsetIso(-1) }, { id: id(), title: "Сон", value: 7, unit: "ч", date: now }],
    vault: [{ id: id(), service: "Пример сервиса", login: "demo@example.com", password: "demo-only-123", note: "Только тестовая запись" }],
    trash: [],
    searchHistory: [],
    settings: { density: "comfortable", startPage: "today", context: 10, digest: "08:00", notifications: "important", accent: "teal", gcal: false, overviewHidden: [] }
  };
}

function hydrateExtra(value, fresh) {
  const saved = { ...fresh.saved, ...(value.saved || {}) };
  const notes = value.notes || fresh.notes;
  const savedSections = {};
  for (const [key, defaults] of Object.entries(fresh.savedSections)) {
    const sections = Array.isArray(value.savedSections?.[key]) ? value.savedSections[key] : defaults.map(section => ({ ...section }));
    savedSections[key] = sections;
    for (const item of key === "notes" ? notes : saved[key] || []) {
      if (item.categoryId || !item.topic) continue;
      let section = sections.find(candidate => candidate.name.toLocaleLowerCase("ru-RU") === item.topic.toLocaleLowerCase("ru-RU"));
      if (!section) {
        section = { id: id(), name: item.topic, icon: savedIcon(key), color: "#8dbbb4", sortOrder: sections.length };
        sections.push(section);
      }
      item.categoryId = section.id;
    }
  }
  const samplePoints = Object.fromEntries(fresh.saved.addresses.map(item => [item.title, item]));
  saved.addresses = (saved.addresses || []).map(item => {
    const sample = samplePoints[item.title];
    return sample && !Number.isFinite(Number(item.lat)) ? { ...item, lat: sample.lat, lng: sample.lng, categoryId: sample.categoryId } : item;
  });
  const demoFiles = { "Бриф проекта.pdf": ["./demo-files/project-brief.pdf", "application/pdf", "./demo-files/project-brief-preview.png"], "Инструкция к кофемашине.pdf": ["./demo-files/coffee-guide.pdf", "application/pdf", "./demo-files/coffee-guide-preview.png"] };
  saved.files = (saved.files || []).map(item => {
    const sample = demoFiles[item.title];
    return sample && !item.fileData ? { ...item, filePath: sample[0], fileType: sample[1], previewPath: sample[2] } : item;
  });
  const demoTickets = Object.fromEntries(fresh.saved.tickets.map(item => [item.title, item]));
  saved.tickets = (saved.tickets || []).map(item => item.codeValue === undefined && demoTickets[item.title] ? { ...item, codeType: demoTickets[item.title].codeType, codeValue: demoTickets[item.title].codeValue } : item);
  return {
    ...fresh, ...value,
    saved,
    notes,
    savedSections,
    mapCategories: Array.isArray(value.mapCategories) ? value.mapCategories : fresh.mapCategories,
    finance: { ...fresh.finance, ...(value.finance || {}) },
    settings: { ...fresh.settings, ...(value.settings || {}) },
    vault: fresh.vault,
    trash: Array.isArray(value.trash) ? value.trash : [],
    searchHistory: Array.isArray(value.searchHistory) ? value.searchHistory : []
  };
}

function demoMoney(amount, currency = "RUB") {
  const symbol = { RUB: "₽", USD: "$", EUR: "€" }[currency] || currency;
  const n = Number(amount || 0);
  const fraction = Math.round(Math.abs(n) * 100) % 100 !== 0;
  return `${n.toLocaleString("ru-RU", { minimumFractionDigits: fraction ? 2 : 0, maximumFractionDigits: 2 })} ${symbol}`;
}
function miniButton(label, action, extra = "") {
  return `<button class="small-button" type="button" data-action="${action}" ${extra}>${label}</button>`;
}
function cardSection(title, body, className = "", action = "") {
  return `<section class="section ${className}"><div class="section-heading"><h2>${title}</h2>${action}</div>${body}</section>`;
}

function extendedPage(page) {
  const pages = {
    tasks: renderTasksPage, saved: renderSavedPage, finance: renderFinancePage,
    vault: renderVaultPage, inbox: renderInboxPage, overview: renderOverviewPage,
    projects: renderProjectsPage, metrics: renderMetricsPage, archive: renderArchivePage,
    settings: renderSettingsPage, more: renderMorePage
  };
  return (pages[page] || renderMorePage)();
}
document.addEventListener("submit", event => {
  if (event.target?.id !== "goal-deposit-form") return;
  event.preventDefault(); event.stopImmediatePropagation();
  goalDepositApply(1);
}, true);
function renderExtendedSheet() {
  if (ui.sheet.kind === "goal-deposit") return renderGoalDepositSheet();
  if (ui.sheet.kind === "movie-rate") return renderMovieRateSheet();
  if (ui.sheet.kind === "movie-run") return renderMovieRunSheet();
  if (ui.sheet.kind === "cook") return renderCookSheet();
  if (ui.sheet.kind === "finance-reconcile") return renderReconcileSheet();
  if (ui.sheet.kind === "reco-detail") return renderRecoDetailSheet();
  if (ui.sheet.kind === "finance-accounts") return renderAccountsSheet();
  if (ui.sheet.kind === "income-split") return renderIncomeSplitSheet();
  if (ui.sheet.kind === "card-preview") return renderCardPreviewSheet();
  if (ui.sheet.kind === "saved-add-menu") return renderSavedAddMenuSheet();
  if (ui.sheet.kind === "saved" && ui.sheet.category === "cards") return renderLoyaltySheet();
  if (ui.sheet.kind === "loyalty-places") return renderLoyaltyPlacesSheet();
  if (ui.sheet.kind === "saved") return renderSavedSheet();
  if (ui.sheet.kind === "saved-sections") return renderSavedSectionsSheet();
  if (ui.sheet.kind === "map-categories") return renderMapCategoriesSheet();
  if (ui.sheet.kind === "finance") return renderFinanceSheet();
  if (ui.sheet.kind === "vault") return renderVaultSheet();
  if (ui.sheet.kind === "project") return renderProjectSheet();
  if (ui.sheet.kind === "metric") return renderMetricSheet();
  if (ui.sheet.kind === "inbox") return renderInboxSheet();
  if (ui.sheet.kind === "batch") return renderBatchSheet();
  if (ui.sheet.kind === "capture-done") return renderCaptureDone();
  if (ui.sheet.kind === "compare") return renderCompareSheet();
  return renderAddMenu();
}
function handleExtendedAction(action, control, event) {
  return noteAction(action, control) || siteAction(action, control) || birthdayAction(action, control) || recipeAction(action, control) || loyaltyAction(action, control) || movieAction(action, control) || mapAction(action, control, event) || savedAction(action, control, event) || financeAction(action, control, event) || moreAction(action, control, event);
}
function handleExtendedSubmit(event) {
  return loyaltySubmit(event) || mapSubmit(event) || savedSubmit(event) || financeSubmit(event) || moreSubmit(event);
}
function handleExtendedInput(event) {
  return loyaltyInput(event) || savedInput(event) || financeInput(event) || moreInput(event);
}
function handleExtendedChange(event) {
  return loyaltyChange(event) || savedChange(event) || financeChange(event) || moreChange(event);
}
