function savedItems(category = ui.savedCategory) {
  return category === "notes" ? data.notes : (data.saved[category] || []);
}
function savedItem(category, recordId) {
  return savedItems(category).find(item => item.id === recordId);
}
function savedIcon(category) {
  return (SAVED_CATEGORIES.find(([key]) => key === category) || [null, null, "note"])[2];
}
function savedSections(category = ui.savedCategory) {
  return (data.savedSections?.[category] || []).slice().sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}
function savedSection(category, sectionId) {
  return savedSections(category).find(section => section.id === sectionId);
}
function savedSectionBadge(category, sectionId) {
  const section = savedSection(category, sectionId);
  return section ? `<span class="map-category-badge" style="--map-color:${esc(section.color)}">${icon(section.icon || savedIcon(category), "icon-sm")}${esc(section.name)}</span>` : `<span class="map-category-badge">${icon(savedIcon(category), "icon-sm")}Без раздела</span>`;
}
function savedCount() {
  return SAVED_CATEGORIES.reduce((sum, [key]) => sum + savedItems(key).length, 0);
}
const SAVED_PRIMARY = ["notes", "recipes", "movies", "addresses", "files", "tickets"];
function savedRecordLabel(count) {
  const lastTwo = count % 100;
  const last = count % 10;
  return `${count} ${lastTwo >= 11 && lastTwo <= 14 ? "записей" : last === 1 ? "запись" : last >= 2 && last <= 4 ? "записи" : "записей"}`;
}
const SAVED_SECTION_DESCRIPTIONS = {
  notes: "Мысли, тексты и идеи",
  recipes: "Ингредиенты и шаги",
  movies: "Что посмотреть",
  addresses: "Места и маршруты",
  files: "Документы и вложения",
  posts: "Публикации из чатов",
  links: "Статьи и сайты",
  lists: "Покупки и чек-листы",
  products: "Товары и желания",
  tickets: "Поездки и мероприятия"
};
function savedSectionCard(category, compact = false) {
  const items = savedItems(category);
  const latest = items.slice().sort((a, b) => sortSavedItems(a, b, "newest"))[0];
  const detail = latest ? `${latest.pinned ? "Закреплено" : "Недавнее"}: ${latest.title}` : "Пока нет записей";
  return `<button class="saved-section-card ${compact ? "compact" : ""} saved-section-${category}" type="button" data-action="saved-section" data-category="${category}" aria-label="${esc(SAVED_NAMES[category])}, ${savedRecordLabel(items.length)}"><span class="saved-section-icon">${icon(savedIcon(category))}</span><span class="saved-section-copy"><strong>${esc(SAVED_NAMES[category])}</strong><small>${esc(SAVED_SECTION_DESCRIPTIONS[category])}</small>${!compact ? `<em>${esc(detail)}</em>` : ""}</span><span class="saved-section-count">${items.length}</span><span class="saved-section-arrow" aria-hidden="true">${icon("right", "icon-sm")}</span></button>`;
}
function renderSavedOverview() {
  const primary = SAVED_PRIMARY.map(key => savedSectionCard(key)).join("");
  const secondary = SAVED_CATEGORIES.map(([key]) => key).filter(key => !SAVED_PRIMARY.includes(key)).map(key => savedSectionCard(key, true)).join("");
  const pinned = SAVED_CATEGORIES.flatMap(([category]) => savedItems(category).filter(item => item.pinned).map(item => ({ category, item }))).sort((a, b) => String(b.item.updated || b.item.created || "").localeCompare(String(a.item.updated || a.item.created || "")));
  const open = ui.savedPinsOpen !== false;
  const query = String(ui.savedPinsQuery || "").toLocaleLowerCase("ru-RU");
  const pinRows = pinned.length ? pinned.map(({ category, item }) => `<button class="saved-pin-row" type="button" data-action="saved-open" data-category="${category}" data-id="${esc(item.id)}" data-search="${esc(`${item.title} ${SAVED_NAMES[category]} ${item.topic || ""}`.toLocaleLowerCase("ru-RU"))}" ${query && !`${item.title} ${SAVED_NAMES[category]} ${item.topic || ""}`.toLocaleLowerCase("ru-RU").includes(query) ? "hidden" : ""}><span class="saved-pin-icon">${icon(savedIcon(category), "icon-sm")}</span><span><strong>${esc(item.title)}</strong><small>${esc(SAVED_NAMES[category])}${item.topic ? ` · ${esc(item.topic)}` : ""}</small></span>${icon("right", "icon-sm")}</button>`).join("") : `<p class="saved-pins-empty">Закрепите нужную карточку в любом разделе, и она появится здесь.</p>`;
  const pinSearch = pinned.length > 3 ? `<label class="saved-pins-search">${icon("search", "icon-sm")}<input id="saved-pins-search" type="search" value="${esc(ui.savedPinsQuery || "")}" placeholder="Найти закреплённое" aria-label="Найти закреплённое"></label>` : "";
  return `${header("Сохранённое", "Заметки, файлы, места и другие записи", "Библиотека")}<section class="saved-pinned-panel"><button class="saved-pinned-toggle" type="button" data-action="saved-pins-toggle" aria-expanded="${open}" aria-controls="saved-pins-list"><span class="saved-pinned-heading">${icon("bookmark", "icon-sm")}<strong>Закреплённое</strong><small>${pinned.length}</small></span>${icon(open ? "up" : "down", "icon-sm")}</button>${open ? `<div id="saved-pins-list" class="saved-pins-list">${pinSearch}${pinRows}<p id="saved-pins-no-results" class="saved-pins-empty" ${!query || pinned.some(({ category, item }) => `${item.title} ${SAVED_NAMES[category]} ${item.topic || ""}`.toLocaleLowerCase("ru-RU").includes(query)) ? "hidden" : ""}>Ничего не найдено.</p></div>` : `<div id="saved-pins-list" hidden></div>`}</section><section class="saved-overview-group" aria-labelledby="saved-main-heading"><div class="section-heading"><h2 id="saved-main-heading">Основные разделы</h2></div><div class="saved-section-grid">${primary}</div></section><section class="saved-overview-group saved-overview-other" aria-labelledby="saved-other-heading"><div class="section-heading"><h2 id="saved-other-heading">Ещё в сохранённом</h2></div><div class="saved-section-grid saved-section-grid-compact">${secondary}<button class="saved-section-card compact saved-section-vault" type="button" data-action="navigate" data-page="vault" aria-label="Пароли"><span class="saved-section-icon">${icon("key")}</span><span class="saved-section-copy"><strong>Пароли</strong><small>Зашифрованное хранилище</small></span><span class="saved-section-arrow" aria-hidden="true">${icon("right", "icon-sm")}</span></button></div></section>`;
}
function renderSavedAddMenuSheet() {
  const category = ui.savedCategory;
  const overview = category === "overview";
  const ai = `<button type="button" class="saved-add-ai" data-action="universal-add">${icon("note", "icon-sm")}<span>Написать как боту — ИИ разберёт<small>Одно сообщение, одна или несколько записей</small></span>${icon("right", "icon-sm")}</button>`;
  const options = ai + (overview ? SAVED_CATEGORIES.map(([key, label]) => `<button type="button" data-action="saved-add-record" data-category="${key}">${icon(savedIcon(key), "icon-sm")}<span>${esc(label)}</span>${icon("right", "icon-sm")}</button>`).join("") : `<button type="button" data-action="saved-add-record" data-category="${category}">${icon(savedIcon(category), "icon-sm")}<span>${category === "lists" ? "Новый список" : category === "tickets" ? "Новый билет" : category === "notes" ? "Новая заметка" : `Новая запись · ${SAVED_NAMES[category]}`}</span>${icon("right", "icon-sm")}</button>${category === "addresses" ? `<button type="button" data-action="saved-add-map">${icon("pin", "icon-sm")}<span>Поставить метку на карте</span>${icon("right", "icon-sm")}</button>` : ""}`);
  const lists = !overview && category === "lists" && savedItems("lists").length ? `<form id="saved-add-list-item" class="saved-add-list-item"><h3>Пункт в существующий список</h3><label class="field">Список<select name="listId">${savedItems("lists").map(item => `<option value="${esc(item.id)}">${esc(item.title)}</option>`).join("")}</select></label><label class="field">Новый пункт<input name="text" type="text" placeholder="Что добавить?" maxlength="120" required></label><button class="primary-button" type="submit">Добавить пункт</button></form>` : "";
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet saved-add-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${overview ? "Добавить в сохранённое" : `Добавить · ${esc(SAVED_NAMES[category])}`}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><div class="saved-add-options ${overview ? "is-overview" : ""}">${options}</div>${lists}</section></div>`;
}
function openSavedRecord(category, recordId = null, mode = recordId ? "view" : "edit") {
  ui.savedCategory = category;
  ui.sheet = { kind: "saved", category, id: recordId, mode, draft: !recordId ? { categoryId: ui.savedSection === "__none__" ? "" : ui.savedSection } : null, justRendered: false };
  ui.menu = false;
  render();
}
function sortSavedItems(a, b, mode = ui.savedSort) {
  const pins = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
  if (pins) return pins;
  if (mode === "title") return a.title.localeCompare(b.title, "ru");
  if (mode === "time") return Number(b.minutes || 0) - Number(a.minutes || 0) || (b.created || "").localeCompare(a.created || "");
  return (b.created || "").localeCompare(a.created || "");
}
function savedVisibleItems() {
  const q = ui.savedQuery.trim().toLocaleLowerCase("ru-RU");
  const result = savedItems().filter(item => {
    const sectionId = ui.savedCategory === "notes" ? noteFolderId(item) : item.categoryId;
    if (ui.savedCategory !== "addresses" && ui.savedSection === "__none__" && sectionId) return false;
    if (ui.savedCategory !== "addresses" && ui.savedSection && ui.savedSection !== "__none__" && sectionId !== ui.savedSection) return false;
    if (ui.savedFilter === "unread" && (ui.savedCategory === "movies" ? movieIsViewed(item) : item.viewed)) return false;
    if (ui.savedFilter === "pinned" && !item.pinned) return false;
    // Посмотренный фильм уходит из списка «хочу посмотреть» — он в «Показать → Просмотренные».
    const seen = ui.savedCategory === "movies" ? movieIsViewed(item) : item.viewed;
    if (ui.savedFilter === "viewed" && !seen) return false;
    if (ui.savedCategory === "movies" && seen && !["viewed", "pinned"].includes(ui.savedFilter) && !q) return false;
    const sectionName = ui.savedCategory === "addresses" ? mapCategory(item.categoryId)?.name : savedSection(ui.savedCategory, sectionId)?.name;
    return !q || `${item.title} ${item.description || ""} ${item.topic || ""} ${item.address || ""} ${item.city || ""} ${item.origin || ""} ${item.destination || ""} ${item.venue || ""} ${item.reference || ""} ${sectionName || ""} ${(item.tags || []).join(" ")}`.toLocaleLowerCase("ru-RU").includes(q);
  });
  result.sort((a, b) => sortSavedItems(a, b));
  return result;
}
function movieCoverSource(item) {
  if (item.coverHidden) return "";
  if (item.coverData) return item.coverData;
  if (item.coverPath) return item.coverPath;
  return item.title?.trim().toLocaleLowerCase("ru-RU") === "патерсон" && Number(item.year) === 2016 ? "./assets/paterson-cover.webp" : "";
}
function movieIsViewed(item) { return item.status === "Посмотрел" || Boolean(item.viewed); }
function movieDemoInfo(item) {
  return item.title?.trim().toLocaleLowerCase("ru-RU") === "патерсон" && Number(item.year) === 2016
    ? { kinopoiskUrl: "https://www.kinopoisk.ru/film/954059/", kinopoiskRating: 7.2, imdbRating: 7.3 }
    : {};
}
function movieInfo(item, key) { return item[key] === undefined ? movieDemoInfo(item)[key] : item[key]; }
function movieScore(value) { return value === "" || value === null || value === undefined || Number(value) <= 0 ? "—" : Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 1 }); }
function toggleMovieViewed(item) {
  if (!item) return;
  if (movieIsViewed(item)) {
    item.status = item.statusBeforeViewed && item.statusBeforeViewed !== "Посмотрел" ? item.statusBeforeViewed : "Хочу посмотреть";
    item.viewed = false;
  } else {
    item.statusBeforeViewed = item.status || "Хочу посмотреть";
    item.status = "Посмотрел";
    item.viewed = true;
  }
  save();
  if (!ui.sheet) render();
  toast(item.viewed ? "Просмотрено — фильм в «Показать → Просмотренные»" : "Фильм возвращён в планы");
}
function postDemoInfo(item) {
  return item.title?.trim().toLocaleLowerCase("ru-RU") === "идеи для выходных в городе" && item.source === "Канал «Город рядом»"
    ? {
      body: "Когда хочется сменить обстановку без долгой поездки, попробуйте провести день в знакомом городе по новому маршруту. Начните с тихих улиц, где приятно идти без спешки и заглядывать во дворы.\n\nПосле прогулки зайдите в небольшой музей, а затем устройте перерыв на кофе. Вторую выставку оставьте на вечер: так день не превратится в гонку по точкам.\n\nПеред выходом проверьте часы работы музеев и сохраните адреса. Маршрут легко сократить до пары часов или растянуть на весь день.",
      summary: "Неспешный маршрут на выходной: прогулка по тихим улицам, два небольших музея и пауза на кофе. Перед выходом стоит проверить часы работы.",
      media: [{ type: "image", src: "./assets/weekend-street.png", alt: "Тихая городская улица и здание музея" }, { type: "image", src: "./assets/weekend-museum.png", alt: "Зал небольшого музея" }]
    }
    : {};
}
function postInfo(item, key) { return item[key] === undefined ? postDemoInfo(item)[key] : item[key]; }
function safePostMediaSource(source) { return /^(https?:\/\/|\.\/assets\/|data:(?:image\/(?:png|jpeg|webp)|video\/(?:mp4|webm));base64,)/i.test(String(source || "")) ? source : ""; }
function renderPostMedia(item, compact = false) {
  const media = (postInfo(item, "media") || []).filter(entry => safePostMediaSource(entry.src));
  if (!media.length) return "";
  return `<section class="post-media-block" aria-label="Медиа поста"><div class="post-media-head"><strong>Медиа из поста</strong><span>${media.length} ${media.length === 1 ? "вложение" : media.length < 5 ? "вложения" : "вложений"}</span></div><div class="post-media-gallery ${compact ? "is-compact" : ""}">${media.map((entry, index) => `<figure class="post-media-item">${entry.type === "video" ? `<video controls playsinline preload="metadata" src="${esc(entry.src)}" ${entry.poster && safePostMediaSource(entry.poster) ? `poster="${esc(entry.poster)}"` : ""} aria-label="Видео ${index + 1} из поста"></video>` : `<a href="${esc(entry.src)}" target="_blank" rel="noopener noreferrer" aria-label="Открыть изображение ${index + 1}"><img src="${esc(entry.src)}" alt="${esc(entry.alt || `Изображение ${index + 1} из поста`)}" loading="lazy"></a>`}${entry.caption ? `<figcaption>${esc(entry.caption)}</figcaption>` : ""}</figure>`).join("")}</div></section>`;
}
function movieCoverMarkup(item, context = "card") {
  const source = movieCoverSource(item);
  const demoCover = source === "./assets/paterson-cover.webp";
  return `<span class="movie-cover movie-cover-${context} ${source ? "has-image" : "is-empty"}">${source ? `<img src="${esc(source)}" alt="Обложка фильма «${esc(item.title)}»" loading="lazy">` : `<span class="movie-cover-fallback"><small>СОРОКА · КИНО</small><strong>${esc(item.title || "Без названия")}</strong><em>${item.year ? esc(item.year) : ""}</em></span>`}${demoCover ? `<span class="movie-cover-caption">${esc(item.title)}</span>` : ""}</span>`;
}
/** Карточка в списке — с закладкой поверх: закрепить, не открывая запись. */
function savedRecordCard(item, category) {
  return `<div class="record-card-shell" data-category="${esc(category)}" data-id="${esc(item.id)}">${savedRecordCardBody(item, category)}${(category === "movies" ? movieIsViewed(item) : item.viewed) ? `<span class="record-seen" title="Просмотрено" aria-label="Просмотрено">${icon("eye", "icon-sm")}</span>` : ""}<button class="record-pin-toggle ${item.pinned ? "is-pinned" : ""}" type="button" data-action="saved-pin-card" data-category="${esc(category)}" data-id="${esc(item.id)}" aria-pressed="${Boolean(item.pinned)}" aria-label="${item.pinned ? "Открепить" : "Закрепить"}: ${esc(item.title)}">${icon("bookmark", "icon-sm")}</button></div>`;
}
function savedRecordCardBody(item, category) {
  if (category === "tickets") {
    const type = { event: "Мероприятие", train: "Поезд", flight: "Самолёт" }[item.ticketType] || "Билет";
    const route = item.ticketType === "event" ? item.venue : [item.origin, item.destination].filter(Boolean).join(" → ");
    // Как бумажный билет: слева — что и где, справа отрывной корешок со
    // штрихкодом. Корешок — сразу код на весь экран (на входе не нужно
    // открывать карточку). Рисунок на корешке всегда штрихкод, даже если сам
    // код — QR: так билет читается с одного взгляда.
    const rows = ticketRows(item);
    const coded = rows.filter(row => row.text);
    const seats = rows.map(row => row.seat).filter(Boolean);
    const when = `${item.eventDate ? shortDate(item.eventDate) : "Дата не указана"}${item.eventTime ? ` · ${item.eventTime}` : ""}`;
    const main = `<button class="ticket-main" type="button" data-action="saved-open" data-category="tickets" data-id="${esc(item.id)}"><span class="ticket-kicker">${icon("ticket", "icon-sm")}${esc(type)} · ${esc(when)}</span><strong>${esc(item.title)}</strong><span class="ticket-route">${esc(route || "Место не указано")}</span>${seats.length ? `<span class="ticket-seats">${seats.map(esc).join("<br>")}</span>` : ""}</button>`;
    const stub = `<button class="ticket-stub ${coded.length ? "" : "is-empty"}" type="button" data-action="saved-open" data-category="tickets" data-id="${esc(item.id)}" ${coded.length ? `data-live-code="0" data-ticket="${esc(item.id)}"` : ""} aria-label="${coded.length ? "Код билета на весь экран" : "Кода пока нет"}">${stubBarcode(coded[0]?.text || item.id)}</button>`;
    return `<div class="record-card ticket-card ticket-paper">${main}${stub}</div>`;
  }
  if (category === "movies") {
    return `<button class="record-card movie-card" type="button" data-action="saved-open" data-category="movies" data-id="${esc(item.id)}">${movieCoverMarkup(item)}<span class="movie-card-body"><span class="movie-card-kicker">${esc(movieIsViewed(item) ? "Посмотрел" : item.status || "Сохранено")}</span><span class="movie-card-title">${esc(item.title)}</span><span class="movie-card-facts">${[item.year, item.genre || item.tags?.[0]].filter(Boolean).map(esc).join(" · ")}</span>${item.description ? `<span class="movie-card-description">${esc(item.description)}</span>` : ""}${item.where ? `<span class="movie-card-where">${esc(item.where)}</span>` : ""}</span>${item.pinned ? `<span class="record-pin">${icon("bookmark", "icon-sm")}</span>` : ""}</button>`;
  }
  if (category === "posts") {
    const image = (postInfo(item, "media") || []).find(entry => entry.type === "image" && safePostMediaSource(entry.src));
    const mediaCount = (postInfo(item, "media") || []).length;
    return `<button class="record-card post-card ${image ? "has-media" : ""}" type="button" data-action="saved-open" data-category="posts" data-id="${esc(item.id)}">${image ? `<span class="post-card-image"><img src="${esc(image.src)}" alt="" loading="lazy"></span>` : ""}<span class="post-card-content"><span class="record-kicker">${esc(item.source || "Пост")}</span><strong class="record-title">${esc(item.title)}</strong>${item.description ? `<span class="record-description">${esc(item.description)}</span>` : ""}<span class="record-meta">${item.viewed ? "Просмотрено" : `${item.minutes || 0} мин`}${mediaCount ? ` · ${mediaCount} ${mediaCount === 1 ? "вложение" : mediaCount < 5 ? "вложения" : "вложений"}` : ""}</span></span>${item.pinned ? `<span class="record-pin">${icon("bookmark", "icon-sm")}</span>` : ""}</button>`;
  }
  const status = category === "movies" ? item.status : category === "files" && (item.filePath || item.fileData) ? "Открыть файл" : item.viewed ? "Просмотрено" : category === "lists" ? `${(item.items || []).filter(x => x.done).length}/${(item.items || []).length} пунктов` : item.minutes ? `${item.minutes} мин` : "Сохранено";
  const extra = category === "products" ? demoMoney(item.price) : category === "recipes" ? `${item.servings || 1} порции` : category === "movies" ? String(item.year || "") : category === "addresses" ? item.city || item.address || "" : item.source || "";
  const description = category === "addresses" ? item.address : item.description;
  return `<button class="record-card" type="button" data-action="saved-open" data-category="${category}" data-id="${esc(item.id)}"><span class="record-kicker">${category === "addresses" ? mapCategoryBadge(item.categoryId) : savedSectionBadge(category, item.categoryId)}</span><span class="record-title">${esc(item.title)}</span>${category === "lists" ? listPreview(item) : ""}${description ? `<span class="record-description">${esc(description)}</span>` : ""}<span class="record-meta"><span>${esc(status || "Сохранено")}</span>${extra ? `<span>${esc(extra)}</span>` : ""}</span></button>`;
}
function ticketCodeBlock(item) {
  const kind = item.codeType === "barcode" ? "barcode" : "qr";
  const value = String(item.codeValue || "").trim();
  return `<section class="ticket-code-block"><div class="ticket-code-heading"><strong>Код билета</strong><span>${kind === "qr" ? "QR-код" : "Штрихкод"}</span></div>${value ? `<div class="ticket-code-preview ${kind}"><span class="ticket-code-art" aria-hidden="true"></span><code>${esc(value)}</code></div><p class="section-note">Код распознан из билета.</p>` : `<div class="ticket-code-placeholder">${icon("ticket")}<span>QR-код или штрихкод появится здесь после разбора билета</span></div><p class="section-note">При необходимости значение можно добавить вручную через «Изменить».</p>`}</section>`;
}
function renderSavedResults() {
  const items = savedVisibleItems();
  return items.length ? `<div class="${ui.savedView === "grid" ? "record-grid" : "record-list"}">${items.map(item => savedRecordCard(item, ui.savedCategory)).join("")}</div>` : emptyCard("Ничего не найдено", "Измените фильтр или добавьте новую запись.");
}
function noteDateLabel(item) {
  if (item.updated) return shortDate(localIso(new Date(item.updated)));
  return item.created ? shortDate(String(item.created).slice(0, 10)) : "Из чата";
}
function noteFolderId(item) {
  if (savedSection("notes", item.categoryId)) return item.categoryId;
  return savedSections("notes").find(section => section.name.toLocaleLowerCase("ru-RU") === String(item.topic || "").toLocaleLowerCase("ru-RU"))?.id || "";
}
function noteRow(item) {
  const folder = savedSection("notes", noteFolderId(item))?.name || "Без папки";
  return `<button class="note-row" type="button" data-action="saved-open" data-category="notes" data-id="${esc(item.id)}"><span class="note-row-title">${esc(item.title || "Без названия")}</span><span class="note-row-preview">${esc(item.description || "Пустая заметка")}</span><span class="note-row-foot"><time>${esc(noteDateLabel(item))}</time><span>${esc(folder)}</span>${item.viewed ? `<span class="note-row-seen" aria-label="Просмотрено">${icon("eye", "icon-sm")}</span>` : ""}${item.pinned ? `<span class="note-row-pin" aria-label="Закреплено">${icon("bookmark", "icon-sm")}</span>` : ""}</span></button>`;
}
function renderNotesResults() {
  const items = savedVisibleItems().slice().sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || String(b.updated || b.created || "").localeCompare(String(a.updated || a.created || "")));
  if (!items.length) return `<div class="notes-empty"><strong>${ui.savedQuery ? "Ничего не найдено" : "Здесь пока нет заметок"}</strong><p>${ui.savedQuery ? "Попробуйте другое слово или выберите другую папку." : "Нажмите «+», чтобы записать мысль."}</p></div>`;
  const pinned = items.filter(item => item.pinned);
  const rest = items.filter(item => !item.pinned);
  const group = (title, list) => list.length ? `<section class="notes-group"><h2>${title}</h2><div class="notes-list">${list.map(noteRow).join("")}</div></section>` : "";
  return group("Закреплённые", pinned) + group(ui.savedQuery ? "Результаты" : "Заметки", rest);
}
function renderNotesPage() {
  const sections = savedSections("notes");
  const folderCount = id => savedItems("notes").filter(item => noteFolderId(item) === id).length;
  const unfiled = folderCount("");
  const folders = `<div class="notes-folders" aria-label="Папки заметок"><button type="button" class="${!ui.savedSection ? "active" : ""}" data-action="saved-section-filter" data-id="" aria-pressed="${!ui.savedSection}">Все <span>${savedItems("notes").length}</span></button>${sections.map(section => `<button type="button" class="${ui.savedSection === section.id ? "active" : ""}" data-action="saved-section-filter" data-id="${esc(section.id)}" aria-pressed="${ui.savedSection === section.id}">${esc(section.name)} <span>${folderCount(section.id)}</span></button>`).join("")}${unfiled ? `<button type="button" class="${ui.savedSection === "__none__" ? "active" : ""}" data-action="saved-section-filter" data-id="__none__" aria-pressed="${ui.savedSection === "__none__"}">Без папки <span>${unfiled}</span></button>` : ""}</div>`;
  return `<div class="notes-screen"><div class="notes-topline"><button type="button" class="notes-back" data-action="saved-home">${icon("left", "icon-sm")}Сохранённое</button><button type="button" class="notes-folders-manage" data-action="saved-sections-manage">${icon("archive", "icon-sm")}Папки</button></div><header class="notes-heading saved-section-heading"><div><h1>Заметки</h1></div><span>${savedItems("notes").length}</span><button class="icon-button saved-section-add" type="button" data-action="saved-new" aria-label="Новая заметка">${icon("plus")}</button></header><label class="notes-search">${icon("search", "icon-sm")}<input id="saved-filter-input" type="search" value="${esc(ui.savedQuery)}" placeholder="Поиск по заметкам" aria-label="Поиск по заметкам"></label>${folders}<div id="saved-results" class="notes-results">${renderNotesResults()}</div></div>`;
}
function renderSavedSectionChips(category) {
  const sections = savedSections(category);
  const unassigned = savedItems(category).filter(item => !item.categoryId).length;
  // Одна папка или ни одной — выбирать не из чего, ряд не нужен.
  // Папки видны всегда, когда хоть одна не пуста: по ним и ходят внутри раздела.
  if (!sections.some(section => savedItems(category).some(item => item.categoryId === section.id))) return "";
  return `<div class="map-categories saved-subcategories" aria-label="Разделы: ${esc(SAVED_NAMES[category])}"><button class="map-category-chip ${!ui.savedSection ? "active" : ""}" type="button" data-action="saved-section-filter" data-id="" aria-pressed="${!ui.savedSection}">Все <span>${savedItems(category).length}</span></button>${sections.filter(section => savedItems(category).some(item => item.categoryId === section.id)).map(section => `<button class="map-category-chip ${ui.savedSection === section.id ? "active" : ""}" type="button" data-action="saved-section-filter" data-id="${esc(section.id)}" aria-pressed="${ui.savedSection === section.id}" style="--map-color:${esc(section.color)}">${icon(section.icon || savedIcon(category), "icon-sm")}${esc(section.name)}<span>${savedItems(category).filter(item => item.categoryId === section.id).length}</span></button>`).join("")}${unassigned ? `<button class="map-category-chip ${ui.savedSection === "__none__" ? "active" : ""}" type="button" data-action="saved-section-filter" data-id="__none__" aria-pressed="${ui.savedSection === "__none__"}">Без раздела <span>${unassigned}</span></button>` : ""}</div>`;
}
/** Разделы лентой — только непустые (и открытый), открытый — по центру. */
function savedSwitch() {
  const items = SAVED_CATEGORIES.filter(([key]) => key === ui.savedCategory || savedItems(key).length);
  return `<div class="subtabs saved-switch" role="tablist" aria-label="Разделы сохранённого">${items.map(([key, label, symbol]) => `<button type="button" role="tab" class="${ui.savedCategory === key ? "active" : ""}" aria-selected="${ui.savedCategory === key}" data-action="saved-tab" data-category="${key}">${icon(symbol, "icon-sm")}${label}<span class="tab-count">${savedItems(key).length}</span></button>`).join("")}</div>`;
}
function renderSavedPage() {
  if (ui.savedCategory === "overview") return renderSavedOverview();
  if (ui.savedCategory === "notes") return renderNotesPage();
  const allMinutes = ["files", "posts", "links"].flatMap(key => data.saved[key]).filter(item => !item.viewed).reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  // Раздел — как экран «Заметок»: назад и «Разделы» одной строкой, заголовок со
  // счётчиком, поиск и один выбор «Показать» вместо трёх рядов фильтров,
  // сортировки и вида. Лента всех разделов и второй заголовок убраны: раздел
  // выбирают на главной «Сохранённого».
  const category = ui.savedCategory;
  const show = ui.savedFilter === "all" ? ui.savedSort : ui.savedFilter;
  const showOptions = [["newest", "Новые сначала"], ["title", "По названию"], ["time", "По времени"], ["unread", "Не просмотрено"], ["viewed", "Просмотренные"], ["pinned", "Закреплённые"]];
  const toolbar = `<div class="saved-section-search"><label class="notes-search">${icon("search", "icon-sm")}<input id="saved-filter-input" type="search" value="${esc(ui.savedQuery)}" placeholder="Искать в разделе" aria-label="Искать в разделе"></label><select id="saved-show" class="filter-input" aria-label="Показать">${showOptions.map(([value, label]) => `<option value="${value}" ${show === value ? "selected" : ""}>${label}</option>`).join("")}</select></div>`;
  const heading = `<div class="notes-topline"><button type="button" class="notes-back" data-action="saved-home">${icon("left", "icon-sm")}Сохранённое</button>${category === "addresses" ? "" : `<button type="button" class="notes-folders-manage" data-action="saved-sections-manage">${icon("archive", "icon-sm")}Разделы</button>`}</div><header class="notes-heading saved-section-heading"><div><h1>${SAVED_NAMES[category]}</h1></div><span>${savedItems(category).length}</span><button class="icon-button saved-section-add" type="button" data-action="saved-new" aria-label="Добавить: ${esc(SAVED_NAMES[category])}">${icon("plus")}</button></header>`;
  const hint = category === "movies" && !savedHintSeen() ? `<p class="swipe-hint">Свайп вправо — просмотрено · влево — действия</p>` : "";
  const seenTabs = category === "movies" ? movieSeenTabs() : "";
  const main = category === "addresses" ? renderAddressWorkspace() : `${seenTabs}${renderSavedSectionChips(category)}${toolbar}${hint}<div id="saved-results" class="saved-results">${renderSavedResults()}</div>`;
  const aside = `<div class="side-card"><h3>Библиотека</h3><div class="side-row"><span>Всего сохранено</span><b>${savedCount()}</b></div><div class="side-row"><span>В очереди</span><b>${allMinutes} мин</b></div><p class="side-note">Ссылки, посты и файлы остаются рядом с заметками и списками.</p></div>`;
  return `<div class="saved-section-screen">${heading}<div class="content-grid"><div class="content-main">${main}</div><aside class="content-aside">${aside}</aside></div></div>`;
}
/** Фильмы: что посмотреть и что уже посмотрено — две вкладки, а не пункт в меню. */
function movieSeenTabs() {
  const all = savedItems("movies");
  const seen = all.filter(movieIsViewed).length;
  const tab = (filter, label, count) => `<button type="button" class="${(filter === "viewed") === (ui.savedFilter === "viewed") ? "active" : ""}" data-action="saved-filter" data-filter="${filter}" aria-pressed="${(filter === "viewed") === (ui.savedFilter === "viewed")}">${label}<span>${count}</span></button>`;
  return `<div class="movie-seen-tabs" role="group" aria-label="Фильмы">${tab("all", "Хочу посмотреть", all.length - seen)}${tab("viewed", "Просмотренные", seen)}</div>`;
}
/** Подсказка про свайп — один раз: дальше она только занимает место. */
function savedHintSeen() {
  try { if (localStorage.getItem("soroka-swipe-hint")) return true; localStorage.setItem("soroka-swipe-hint", "1"); } catch (_) {}
  return false;
}
function renderSavedSectionsSheet() {
  const category = ui.sheet.category;
  const sections = savedSections(category);
  const editing = sections.find(section => section.id === ui.sheet.editSectionId);
  const iconOptions = [["note", "Заметка"], ["bookmark", "Закладка"], ["event", "Календарь"], ["project", "Проект"], ["archive", "Папка"], ["arrow", "Поездка"], ["wallet", "Покупки"], ["inbox", "Входящие"], ["overview", "Сетка"], ["link", "Ссылка"], ["check", "Список"]];
  const isNotes = category === "notes";
  const rows = sections.map(section => { const count = savedItems(category).filter(item => (isNotes ? noteFolderId(item) : item.categoryId) === section.id).length; return `<div class="map-category-row"><span class="map-category-symbol" style="--map-color:${esc(section.color)}">${icon(section.icon || savedIcon(category))}</span><span><strong>${esc(section.name)}</strong><small>${savedRecordLabel(count)}</small></span><button type="button" data-action="saved-section-edit" data-id="${esc(section.id)}" aria-label="Изменить ${esc(section.name)}">${icon("note", "icon-sm")}</button><button type="button" data-action="saved-section-delete" data-id="${esc(section.id)}" aria-label="Удалить ${esc(section.name)}">${icon("trash", "icon-sm")}</button></div>`; }).join("");
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet map-categories-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${isNotes ? "Папки заметок" : `Разделы: ${esc(SAVED_NAMES[category])}`}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><p class="section-note">${isNotes ? "Создавайте папки для заметок. Заметки без папки остаются в списке «Все»." : "Создавайте собственные разделы. Записи без раздела остаются в «Все»."}</p><div class="map-category-list">${rows || `<p class="section-note">${isNotes ? "Папок пока нет." : "Разделов пока нет."}</p>`}</div><form id="saved-section-form"><h3>${editing ? (isNotes ? "Изменить папку" : "Изменить раздел") : (isNotes ? "Новая папка" : "Новый раздел")}</h3>${savedFormField("Название", "name", editing?.name || "", "text", 'maxlength="40" required autofocus')}<div class="field-row"><label class="field">Значок<select name="icon">${iconOptions.map(([value, label]) => `<option value="${value}" ${editing?.icon === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label class="field">Цвет<input name="color" type="color" value="${esc(editing?.color || "#8dbbb4")}"></label></div><p class="form-error" role="alert"></p><div class="sheet-actions">${editing ? `<button class="ghost-button" type="button" data-action="saved-section-cancel">Отмена</button>` : ""}<button class="primary-button" type="submit">${editing ? "Сохранить" : (isNotes ? "Создать папку" : "Создать раздел")}</button></div></form></section></div>`;
}
function savedFormField(label, name, value, type = "text", extra = "") {
  return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
}
/** Перерисовать, не сбрасывая прокрутку окна: в длинном списке иначе прыгает наверх. */
function renderKeepScroll(after) {
  const scroll = document.querySelector(".sheet")?.scrollTop || 0;
  render();
  const sheet = document.querySelector(".sheet");
  if (sheet) sheet.scrollTop = scroll;
  if (after) after();
}
/**
 * Список как чек-лист: отметить — кружком, изменить — нажать на текст, удалить —
 * крестиком, добавить — поле внизу. Выполненные уходят вниз, их можно очистить.
 */
function renderChecklist(item) {
  const items = item.items || [];
  const open = items.filter(entry => !entry.done);
  const done = items.filter(entry => entry.done);
  const row = entry => ui.sheet.editItemId === entry.id
    ? `<form class="check-row editing" id="list-edit-form" data-id="${esc(entry.id)}"><button class="task-check ${entry.done ? "checked" : ""}" type="button" data-action="list-toggle" data-id="${esc(entry.id)}" aria-label="Отметить">${icon("check", "icon-sm")}</button><input name="text" type="text" value="${esc(entry.text)}" maxlength="200" autocomplete="off" enterkeyhint="done" aria-label="Текст пункта"><button class="check-remove" type="button" data-action="list-remove" data-id="${esc(entry.id)}" aria-label="Удалить пункт">${icon("trash", "icon-sm")}</button></form>`
    : `<div class="check-row ${entry.done ? "done" : ""}"><button class="task-check ${entry.done ? "checked" : ""}" type="button" data-action="list-toggle" data-id="${esc(entry.id)}" aria-pressed="${Boolean(entry.done)}" aria-label="${entry.done ? "Вернуть" : "Выполнить"}: ${esc(entry.text)}">${icon("check", "icon-sm")}</button><button class="check-text" type="button" data-action="list-item-edit" data-id="${esc(entry.id)}" aria-label="Изменить: ${esc(entry.text)}">${esc(entry.text)}</button><button class="check-remove" type="button" data-action="list-remove" data-id="${esc(entry.id)}" aria-label="Удалить: ${esc(entry.text)}">${icon("close", "icon-sm")}</button></div>`;
  const percent = items.length ? Math.round(done.length / items.length * 100) : 0;
  return `<div class="checklist"><div class="checklist-progress"><div class="progress-track"><span style="width:${percent}%"></span></div><span id="saved-list-progress">${done.length} из ${items.length}</span></div>` +
    `<div class="checklist-rows">${open.map(row).join("")}</div>` +
    `<form id="list-item-form" class="check-add"><span class="check-add-icon">${icon("plus", "icon-sm")}</span><input name="text" type="text" placeholder="Добавить пункт" maxlength="200" autocomplete="off" enterkeyhint="done" aria-label="Новый пункт"></form>` +
    (done.length ? `<div class="checklist-done-head"><span>Выполнено · ${done.length}</span><button class="text-action" type="button" data-action="list-clear-done">Очистить</button></div><div class="checklist-rows">${done.map(row).join("")}</div>` : "") +
    `</div>`;
}
/** На карточке списка — первые невыполненные пункты, а не пустое место. */
function listPreview(item) {
  const open = (item.items || []).filter(entry => !entry.done);
  if (!open.length) return "";
  return `<span class="list-card-preview">${open.slice(0, 3).map(entry => `<span>${esc(entry.text)}</span>`).join("")}${open.length > 3 ? `<em>ещё ${open.length - 3}</em>` : ""}</span>`;
}
function renderListItems(item) {
  if (!item) return `<div class="detail-block"><p>Сначала сохраните список, затем добавьте пункты.</p></div>`;
  const rows = (item.items || []).map((entry, index) => `<div class="list-item ${entry.done ? "done" : ""}"><button class="task-check ${entry.done ? "checked" : ""}" type="button" data-action="list-toggle" data-id="${esc(entry.id)}" aria-label="${entry.done ? "Вернуть" : "Выполнить"} ${esc(entry.text)}">${icon("check", "icon-sm")}</button><span>${esc(entry.text)}</span><button class="icon-button" type="button" data-action="list-edit" data-id="${esc(entry.id)}" aria-label="Изменить пункт">${icon("note", "icon-sm")}</button><button class="icon-button" type="button" data-action="list-up" data-id="${esc(entry.id)}" ${index === 0 ? "disabled" : ""} aria-label="Выше">${icon("up", "icon-sm")}</button><button class="icon-button" type="button" data-action="list-down" data-id="${esc(entry.id)}" ${index === item.items.length - 1 ? "disabled" : ""} aria-label="Ниже">${icon("down", "icon-sm")}</button><button class="icon-button" type="button" data-action="list-remove" data-id="${esc(entry.id)}" aria-label="Удалить пункт">${icon("close", "icon-sm")}</button></div>`).join("");
  const editing = ui.sheet.editItemId ? item.items.find(x => x.id === ui.sheet.editItemId) : null;
  return `<div class="detail-block"><h3>Пункты списка</h3>${rows || `<p>Список пуст.</p>`}<form id="list-item-form" class="list-item-form"><input name="text" type="text" value="${esc(editing?.text || "")}" placeholder="Новый пункт" maxlength="100" required><button type="submit">${editing ? "Сохранить" : "Добавить"}</button></form></div>`;
}
function savedFileUrl(item) {
  if (/^data:(application\/pdf|image\/(png|jpeg|webp)|text\/plain)(;charset=[^;,]+)?;base64,/i.test(item.fileData || "")) return item.fileData;
  if (["./demo-files/project-brief.pdf", "./demo-files/coffee-guide.pdf"].includes(item.filePath)) return item.filePath;
  return "";
}
function savedPreviewUrl(item) {
  return ["./demo-files/project-brief-preview.png", "./demo-files/coffee-guide-preview.png"].includes(item.previewPath) ? item.previewPath : "";
}
function savedDetailLine(label, value) {
  return value ? `<div class="saved-detail-line"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>` : "";
}
const RECIPE_FRACTIONS = ["", "⅛", "¼", "⅜", "½", "⅝", "¾", "⅞"];
const RECIPE_COUNTABLE = /^(шт|штук|зубч|пучок|банк|упак|пачк|головк|батон|яйц)/i;
const RECIPE_UNITS = "ч\\.\\s*л\\.?|ст\\.\\s*л\\.?|кг|мг|г|мл|л|шт\\.?|штук|зубчик(?:а|ов)?|пуч(?:ок|ка|ков)|бан(?:ка|ки|ок)|упаков(?:ка|ки|ок)|пач(?:ка|ки|ек)|голов(?:ка|ки|ок)";
function recipeNumber(value) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (/^\d+\/\d+$/.test(raw)) { const [a, b] = raw.split("/").map(Number); return b ? a / b : NaN; }
  return /^\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : NaN;
}
function recipeMeasure(qty, unit, factor, shopping = false) {
  const value = recipeNumber(qty);
  if (!Number.isFinite(value) || value <= 0) return [qty, unit].filter(Boolean).join(" ");
  const spoon = /^(ч\.\s*л\.?|ст\.\s*л\.?)$/i.test(String(unit).trim());
  if (spoon) {
    const tablespoon = /^ст/i.test(unit) && value * factor >= 1;
    const amount = tablespoon ? value * factor : /^ст/i.test(unit) ? value * factor * 3 : value * factor;
    if (amount < .125) return "менее ⅛ ч. л.";
    const eighths = Math.round(amount * 8);
    const whole = Math.floor(eighths / 8);
    return `${whole || ""}${RECIPE_FRACTIONS[eighths % 8] || (whole ? "" : "⅛")} ${tablespoon ? "ст. л." : "ч. л."}`;
  }
  let scaled = Math.round(value * factor * 100) / 100;
  if (shopping && RECIPE_COUNTABLE.test(String(unit))) scaled = Math.ceil(scaled);
  return `${scaled.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}
function recipeIngredientLine(ingredient, factor, shopping = false) {
  if (ingredient && typeof ingredient === "object") {
    const measure = recipeMeasure(ingredient.qty, ingredient.unit, factor, shopping);
    return `${ingredient.name || "Ингредиент"}${measure ? ` — ${ingredient.estimated ? "≈" : ""}${measure}` : ""}`;
  }
  const raw = String(ingredient || "");
  if (factor === 1) return raw;
  const measured = new RegExp(`(\\d+(?:[.,]\\d+)?|\\d+\\/\\d+)\\s*(${RECIPE_UNITS})(?![\\p{L}])`, "iu");
  const match = measured.exec(raw);
  if (match) return raw.slice(0, match.index) + recipeMeasure(match[1], match[2], factor, shopping) + raw.slice(match.index + match[0].length);
  const afterDash = /([—–:]\s*)(\d+(?:[.,]\d+)?|\d+\/\d+)(?![\d.,/])/u.exec(raw);
  return afterDash ? raw.slice(0, afterDash.index) + afterDash[1] + recipeMeasure(afterDash[2], "", factor, shopping) + raw.slice(afterDash.index + afterDash[0].length) : raw;
}
function recipePortions(item) {
  const requested = Number(ui.sheet?.portions ?? item.servings ?? 1);
  return Math.max(1, Math.min(20, Math.round(Number.isFinite(requested) ? requested : 1)));
}
function updateRecipePortions(item, requested) {
  const portions = Math.max(1, Math.min(20, Math.round(Number(requested) || 1)));
  ui.sheet.portions = portions;
  const input = document.getElementById("recipe-portions");
  if (input) input.value = String(portions);
  const factor = portions / Math.max(1, Number(item.servings) || 1);
  document.querySelectorAll("#recipe-ingredients [data-ingredient-index]").forEach(node => {
    node.textContent = recipeIngredientLine(item.ingredients[Number(node.dataset.ingredientIndex)], factor);
  });
  const fact = document.getElementById("recipe-fact-portions");
  if (fact) fact.textContent = `${portions} порц.`;
  const caption = document.getElementById("recipe-scale-caption");
  if (caption) caption.textContent = factor === 1 ? "Количество ингредиентов для исходного рецепта" : `Количество пересчитано с ${item.servings || 1} на ${portions} порций`;
  document.querySelectorAll("[data-action='recipe-portion-step']").forEach(button => { button.disabled = portions === (button.dataset.step === "-1" ? 1 : 20); });
}
/** Штрихкод для корешка: полосы из номера — одинаковый номер, одинаковый рисунок. */
function stubBarcode(text) {
  let seed = 7;
  for (const ch of String(text)) seed = (seed * 31 + ch.codePointAt(0)) >>> 0;
  const bars = [];
  let y = 0;
  while (y < 96) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const bar = 1 + (seed >>> 16) % 3, gap = 1 + (seed >>> 20) % 2;
    if (y + bar > 96) break;
    bars.push(`<rect x="0" y="${y}" width="30" height="${bar}"/>`);
    y += bar + gap;
  }
  return `<svg class="ticket-stub-code" viewBox="0 0 30 96" preserveAspectRatio="none" aria-hidden="true">${bars.join("")}</svg>`;
}
/** Билеты записи: место и код каждого. Старые записи — один код в codeValue и место в seat. */
function ticketRows(item) {
  if (!item) return [];
  if (Array.isArray(item.codes)) return item.codes.map(code => ({ text: code.text || "", kind: code.kind === "barcode" ? "barcode" : "qr", seat: code.seat || "", format: code.format || "", svg: code.svg || "" }));
  return item.codeValue || item.seat ? [{ text: item.codeValue || "", kind: item.codeType === "barcode" ? "barcode" : "qr", seat: item.seat || "", format: "", svg: "" }] : [];
}
function ticketRowField(row, index) {
  return `<div class="ticket-row" data-ticket-row><div class="ticket-row-head"><strong>Билет ${index + 1}</strong><button class="icon-button" type="button" data-action="ticket-row-remove" aria-label="Удалить билет">${icon("trash", "icon-sm")}</button></div><label class="field">Ряд и место<input name="rowSeat" type="text" value="${esc(row.seat || "")}" placeholder="Партер, ряд 9, место 10" autocomplete="off"></label><div class="field-row ticket-row-code"><label class="field">Код<input name="rowText" type="text" value="${esc(row.text || "")}" placeholder="Номер под кодом" autocomplete="off" spellcheck="false"></label><label class="field">Вид<select name="rowKind"><option value="barcode" ${row.kind === "barcode" ? "selected" : ""}>Штрихкод</option><option value="qr" ${row.kind !== "barcode" ? "selected" : ""}>QR-код</option></select></label></div><input type="hidden" name="rowFormat" value="${esc(row.format || "")}"></div>`;
}
function renumberTicketRows() {
  document.querySelectorAll("[data-ticket-row]").forEach((row, index) => { const title = row.querySelector(".ticket-row-head strong"); if (title) title.textContent = `Билет ${index + 1}`; });
}
function renderSavedViewSheet(item, category) {
  const fileUrl = ["files", "tickets"].includes(category) ? savedFileUrl(item) : "";
  const details = [];
  let movieRatings = "";
  if (category === "recipes") {
    const portions = recipePortions(item);
    const factor = portions / Math.max(1, Number(item.servings) || 1);
    details.push(`<div class="saved-facts"><span>${icon("clock", "icon-sm")}${esc(item.minutes || 0)} мин</span><span id="recipe-fact-portions">${portions} порц.</span></div>`);
    details.push(`<div class="detail-block"><div class="section-heading"><h3>Ингредиенты</h3></div><div class="recipe-portions"><button type="button" data-action="recipe-portion-step" data-step="-1" aria-label="Уменьшить количество порций" ${portions === 1 ? "disabled" : ""}>−</button><label for="recipe-portions">Порций<input id="recipe-portions" type="number" inputmode="numeric" min="1" max="20" step="1" value="${portions}"></label><button type="button" data-action="recipe-portion-step" data-step="1" aria-label="Увеличить количество порций" ${portions === 20 ? "disabled" : ""}>+</button></div><p id="recipe-scale-caption" class="recipe-scale-caption">${factor === 1 ? "Количество ингредиентов для исходного рецепта" : `Количество пересчитано с ${item.servings || 1} на ${portions} порций`}</p>${(item.ingredients || []).length ? `<ul id="recipe-ingredients" class="saved-bullets">${item.ingredients.map((x, i) => `<li data-ingredient-index="${i}">${esc(recipeIngredientLine(x, factor))}</li>`).join("")}</ul>` : `<p>Ингредиенты ещё не добавлены.</p>`}</div>`);
    details.push(`<div class="detail-block"><h3>Приготовление</h3>${(item.steps || []).length ? `<ol class="saved-steps">${item.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol>` : `<p>Шаги ещё не добавлены.</p>`}</div>`);
    details.push(`<div class="detail-block"><h3>Список покупок</h3><p>Добавим ингредиенты на выбранное число порций.</p><button class="small-button" type="button" data-action="recipe-shopping" ${(item.ingredients || []).length ? "" : "disabled"}>Создать список</button></div>`);
  }
  if (category === "movies") {
    const kinopoiskUrl = movieInfo(item, "kinopoiskUrl");
    const kinopoisk = `<span class="movie-rating-label">Кинопоиск</span><strong>${esc(movieScore(movieInfo(item, "kinopoiskRating")))}</strong>`;
    movieRatings = `<div class="movie-ratings">${kinopoiskUrl && /^https?:\/\//i.test(kinopoiskUrl) ? `<a class="movie-rating movie-rating-link" href="${esc(kinopoiskUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Открыть фильм на Кинопоиске, оценка ${esc(movieScore(movieInfo(item, "kinopoiskRating")))}">${kinopoisk}${icon("external", "icon-sm")}</a>` : `<div class="movie-rating">${kinopoisk}</div>`}<div class="movie-rating"><span class="movie-rating-label">IMDb</span><strong>${esc(movieScore(movieInfo(item, "imdbRating")))}</strong></div></div>`;
    const extraFacts = `${savedDetailLine("Оригинальное название", item.originalTitle && item.originalTitle !== item.title ? item.originalTitle : "")}${savedDetailLine("Где смотреть", item.where === "Кинопоиск" && kinopoiskUrl ? "" : item.where)}${savedDetailLine("Моя оценка", item.rating ? `${item.rating}/10` : "")}${savedDetailLine("Почему сохранил", item.reason)}`;
    if (extraFacts) details.push(`<div class="saved-detail-table movie-extra-facts">${extraFacts}</div>`);
  }
  if (category === "posts") {
    const body = String(postInfo(item, "body") || item.description || "").trim();
    details.push(`<article class="post-article"><div class="post-byline"><strong>${esc(item.source || "Сохранённый пост")}</strong><time>${esc(item.postedAt ? shortDate(item.postedAt) : item.created ? shortDate(item.created) : "")}</time></div>${body ? `<div class="post-body">${body.split(/\n\s*\n/).map(paragraph => `<p>${esc(paragraph).replace(/\n/g, "<br>")}</p>`).join("")}</div>` : `<p class="section-note">Текст поста ещё не добавлен.</p>`}${renderPostMedia(item)}<div class="post-reading-actions"><button class="primary-button" type="button" data-action="post-summary">${icon("note", "icon-sm")}${ui.postSummaryId === item.id ? "Скрыть пересказ" : "Пересказать пост"}</button><button type="button" data-action="post-open-bot">${icon("arrow", "icon-sm")}Открыть в боте</button></div>${ui.postSummaryId === item.id ? `<section class="post-summary" aria-label="Пересказ поста"><h3>Коротко о посте</h3><p>${esc(postInfo(item, "summary") || "Пересказ этого поста пока не подготовлен. В рабочем приложении он появится после обработки ботом.")}</p></section>` : ""}</article>`);
  }
  if (category === "addresses") {
    const coords = mapPointCoordinates(item);
    details.push(`<div class="saved-address">${icon("pin")}<strong>${esc(item.address || "Адрес не указан")}</strong>${item.city ? `<span>${esc(item.city)}</span>` : ""}</div><div class="saved-detail-table">${savedDetailLine("Раздел", mapCategory(item.categoryId)?.name || "Без категории")}${coords ? "" : savedDetailLine("На карте", "Метка не поставлена")}</div>${coords ? `<a class="address-mini-map-link" href="${esc(mapExternalUrl(item))}" target="_blank" rel="noopener noreferrer" aria-label="Открыть в картах"><div id="address-mini-map" class="address-mini-map" data-id="${esc(item.id)}"></div></a>` : ""}<a class="small-button saved-link-button" href="${esc(mapExternalUrl(item))}" target="_blank" rel="noopener noreferrer">Открыть в картах ${icon("external", "icon-sm")}</a>`);
  }
  if (category === "tickets") {
    const type = { event: "Мероприятие", train: "Поезд", flight: "Самолёт" }[item.ticketType] || "Билет";
    const destination = item.ticketType === "event" ? item.venue : [item.origin, item.destination].filter(Boolean).join(" → ");
    const seats = ticketRows(item).map(row => row.seat).filter(Boolean);
    const venuePoint = { title: item.venue || item.title, address: item.venue, lat: item.venueLat, lng: item.venueLng };
    const venueCoords = mapPointCoordinates(venuePoint);
    const venueBlock = item.ticketType === "event" && item.venue ? `<div class="ticket-venue"><div class="saved-address">${icon("pin")}<strong>${esc(item.venue)}</strong></div>${venueCoords ? `<a class="address-mini-map-link" href="${esc(mapExternalUrl(venuePoint))}" target="_blank" rel="noopener noreferrer" aria-label="Открыть в картах"><div id="address-mini-map" class="address-mini-map" data-lat="${venueCoords[0]}" data-lng="${venueCoords[1]}"></div></a>` : ""}<a class="small-button saved-link-button" href="${esc(mapExternalUrl(venuePoint))}" target="_blank" rel="noopener noreferrer">Открыть в картах ${icon("external", "icon-sm")}</a></div>` : "";
    details.push(`<div class="ticket-detail"><div class="ticket-detail-main"><span>${icon("ticket", "icon-sm")}${type}</span><strong>${esc(item.title)}</strong><p>${esc(destination || item.description || "")}</p></div><div class="ticket-detail-stub"><span>${esc(item.eventDate ? shortDate(item.eventDate) : "Без даты")}${item.eventTime ? ` · ${esc(item.eventTime)}` : ""}</span><strong>${seats.length ? seats.map(esc).join("<br>") : "Место не указано"}</strong>${item.reference ? `<small>${esc(item.reference)}</small>` : ""}</div></div>${ticketCodeBlock(item)}${venueBlock}<div class="saved-detail-table">${savedDetailLine("Перевозчик / организатор", item.carrier)}${savedDetailLine("Откуда", item.origin)}${savedDetailLine("Куда", item.destination)}</div>${fileUrl ? `<a class="small-button saved-link-button" href="${esc(fileUrl)}" target="_blank" rel="noopener noreferrer">Открыть билет ${icon("external", "icon-sm")}</a>` : window.SOROKA_LIVE ? "" : `<p class="section-note">Файл билета можно прикрепить через «Изменить».</p>`}`);
  }
  if (category === "files") {
    const preview = savedPreviewUrl(item);
    const imagePreview = preview || /^data:image\//i.test(fileUrl) ? `<a class="saved-file-preview" href="${esc(fileUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Открыть файл ${esc(item.title)}"><img src="${esc(preview || fileUrl)}" alt="Первая страница: ${esc(item.title)}"></a>` : `<div class="saved-file-preview"><iframe src="${esc(fileUrl)}" title="Просмотр файла ${esc(item.title)}" loading="lazy"></iframe></div>`;
    details.push(fileUrl ? `${imagePreview}<a class="small-button saved-link-button" href="${esc(fileUrl)}" target="_blank" rel="noopener noreferrer">Открыть файл ${icon("external", "icon-sm")}</a>` : `<div class="empty-card"><strong>Файл не прикреплён</strong>Добавьте PDF, изображение или TXT через «Изменить».</div>`);
  }
  if (category === "lists") details.push(renderChecklist(item));
  if (category === "links" && item.url) details.push(`<a class="small-button saved-link-button" href="${esc(/^https?:\/\//i.test(item.url) ? item.url : "#")}" target="_blank" rel="noopener noreferrer">Открыть ссылку ${icon("external", "icon-sm")}</a>${item.summary ? `<div class="detail-block"><h3>Главное</h3><p class="saved-prose">${esc(item.summary)}</p></div>` : ""}`);
  if (category === "products") details.push(`<div class="saved-detail-table">${savedDetailLine("Цена", item.price ? demoMoney(item.price) : "")}${savedDetailLine("Магазин", item.store)}${savedDetailLine("Желаемая цена", item.targetPrice ? demoMoney(item.targetPrice) : "")}</div>`);
  if (category === "notes" && item.versions?.length) details.push(`<div class="detail-block"><h3>История заметки</h3>${item.versions.slice().reverse().slice(0, 3).map(v => `<div class="saved-version"><small>${esc(v.date || "Ранее")}</small><p>${esc(v.description || "")}</p></div>`).join("")}</div>`);
  const tags = item.tags?.length ? `<div class="tag-list">${item.tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join("")}</div>` : "";
  const movieGenres = category === "movies" ? [item.genre, ...(item.tags || [])].filter((value, index, all) => value && all.findIndex(other => String(other).toLocaleLowerCase("ru-RU") === String(value).toLocaleLowerCase("ru-RU")) === index) : [];
  // Фильм: постер слева, справа статус, год и жанр, режиссёр, оценки; описание —
  // во всю ширину под ними. Всё по одной сетке, без плавающих подписей.
  const movieHero = category === "movies" ? `<div class="movie-detail-hero">${movieCoverMarkup(item, "detail")}<div class="movie-detail-intro"><span class="movie-detail-status">${esc(movieIsViewed(item) ? "Посмотрел" : item.status || "Сохранено")}</span><span class="movie-detail-meta">${[item.year, movieGenres.slice(0, 2).join(", ")].filter(Boolean).map(esc).join(" · ")}</span>${item.director ? `<span class="movie-detail-director"><small>Режиссёр</small><b>${esc(item.director)}</b></span>` : ""}${movieRatings}</div></div>${item.description ? `<p class="saved-prose movie-detail-description">${esc(item.description)}</p>` : ""}` : "";
  // В шапке — закладка: закрепить карточку. «Просмотрено» — свайпом вправо по карточке списка.
  const topViewedAction = `<button class="icon-button sheet-pin-toggle ${item.pinned ? "is-pinned" : ""}" type="button" data-action="saved-pin" aria-pressed="${Boolean(item.pinned)}" aria-label="${item.pinned ? "Открепить" : "Закрепить"}">${icon("bookmark", "icon-sm")}</button>`;
  const bottomViewedAction = !["notes", "lists", "movies", "posts", "tickets"].includes(category) ? `<button type="button" data-action="saved-viewed">${icon("check")}${item.viewed ? "Вернуть в очередь" : "Просмотрено"}</button>` : "";
  const metadata = ["posts", "lists"].includes(category) ? "" : `<p class="detail-meta-line">${esc(item.source || "Добавлено вручную")} · ${esc(item.created ? shortDate(item.created) : "ранее")}</p>`;
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet saved-view-sheet ${category === "movies" ? "movie-view-sheet" : category === "posts" ? "post-view-sheet" : ""}" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${esc(item.title)}</h2>${topViewedAction}<button class="icon-button" type="button" data-action="saved-share" aria-label="Поделиться">${icon("share")}</button><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><p class="eyebrow">${icon(savedIcon(category), "icon-sm")}${esc(SAVED_NAMES[category])}${item.topic ? ` · ${esc(item.topic)}` : ""}</p>${movieHero}${!["movies", "posts"].includes(category) && item.description ? `<p class="saved-prose">${esc(item.description)}</p>` : ""}${!["movies", "posts"].includes(category) ? tags : ""}${details.join("")}${metadata}<div class="inline-actions saved-view-actions"><button class="primary-button" type="button" data-action="saved-edit">${icon("note")}Изменить</button><button type="button" class="danger" data-action="saved-delete">${icon("trash")}Удалить</button></div></section></div>`;
}
function renderPostBotPreviewSheet(item) {
  const body = String(postInfo(item, "body") || item.description || "").trim();
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet post-bot-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><button class="post-bot-back" type="button" data-action="post-bot-back">${icon("left", "icon-sm")}К посту</button><h2 id="sheet-title">Сорока · бот</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><div class="post-bot-chat"><div class="post-bot-message"><p class="post-bot-label">Сохранённый пост</p><h3>${esc(item.title)}</h3><small>${esc(item.source || "Из Telegram")}</small>${body ? `<div class="post-body">${body.split(/\n\s*\n/).map(paragraph => `<p>${esc(paragraph).replace(/\n/g, "<br>")}</p>`).join("")}</div>` : ""}${renderPostMedia(item, true)}<span class="post-bot-time">${esc(item.created ? shortDate(item.created) : "")}</span></div></div><p class="section-note">Пост откроется в чате Telegram.</p><a class="small-button saved-link-button" href="https://t.me/Wualentin_BOT" target="_blank" rel="noopener noreferrer">Перейти к боту ${icon("external", "icon-sm")}</a></section></div>`;
}
function renderNoteSheet(item) {
  const editing = !item || ui.sheet.mode === "edit";
  const folder = item ? savedSection("notes", noteFolderId(item))?.name || "Без папки" : "Новая заметка";
  const versions = item?.versions || [];
  const noteHistory = versions.length ? `<details class="note-history"><summary>История изменений <span>${versions.length}</span></summary>${versions.slice().reverse().map((version, index) => `<div class="note-history-entry"><time>${esc(version.date || "Ранее")}</time><p>${esc(version.description || "Пустая версия")}</p>${editing ? `<button type="button" data-action="saved-restore-version" data-version="${versions.length - 1 - index}">Вставить в редактор</button>` : ""}</div>`).join("")}</details>` : "";
  if (editing) {
    const categoryId = item ? noteFolderId(item) : ui.sheet.draft?.categoryId || "";
    return `<div class="modal-backdrop note-backdrop" data-action="backdrop"><section class="sheet note-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><header class="note-toolbar"><button type="button" class="note-back" data-action="note-cancel">${icon("left", "icon-sm")}Назад</button><span id="sheet-title">${item ? "Редактирование" : "Новая заметка"}</span><button class="note-done" type="submit" form="saved-form">Готово</button></header><form id="saved-form" class="note-editor"><input class="note-title-input" name="title" type="text" value="${esc(item?.title || "")}" placeholder="Название" maxlength="120" required ${item ? "" : "autofocus"} aria-label="Название заметки"><textarea class="note-body-input" name="description" placeholder="Начните писать…" aria-label="Текст заметки">${esc(item?.description || "")}</textarea><div class="note-editor-details"><label>Папка<select name="categoryId"><option value="">Без папки</option>${savedSections("notes").map(section => `<option value="${esc(section.id)}" ${categoryId === section.id ? "selected" : ""}>${esc(section.name)}</option>`).join("")}</select></label><label>Метки<input name="tags" type="text" value="${esc((item?.tags || []).join(", "))}" placeholder="Через запятую"></label></div><p class="form-error" role="alert"></p>${noteHistory}</form></section></div>`;
  }
  const tags = (item.tags || []).length ? `<div class="note-tags">${item.tags.map(tag => `<span>${esc(tag)}</span>`).join("")}</div>` : "";
  return `<div class="modal-backdrop note-backdrop" data-action="backdrop"><section class="sheet note-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><header class="note-toolbar"><button type="button" class="note-back" data-action="note-cancel">${icon("left", "icon-sm")}Заметки</button><span>${esc(folder)}</span><button class="note-toolbar-share" type="button" data-action="saved-share" aria-label="Поделиться заметкой">${icon("share", "icon-sm")}</button></header><div class="note-reader"><div class="note-paper"><p class="note-date">${esc(noteDateLabel(item))}</p><h2 id="sheet-title">${esc(item.title)}</h2><div class="note-body">${esc(item.description || "Пустая заметка")}</div>${tags}${noteHistory}</div></div><footer class="note-actions"><button type="button" class="note-edit-action" data-action="saved-edit">${icon("note", "icon-sm")}<span>Изменить</span></button><button type="button" class="note-delete-action" data-action="saved-delete">${icon("trash", "icon-sm")}<span>Удалить</span></button></footer></section></div>`;
}
function renderSavedSheet() {
  const { category, id: recordId } = ui.sheet;
  const item = recordId ? savedItem(category, recordId) : null;
  if (category === "notes") return renderNoteSheet(item);
  if (category === "posts" && item && ui.sheet.mode === "bot-preview") return renderPostBotPreviewSheet(item);
  if (item && ui.sheet.mode !== "edit") return renderSavedViewSheet(item, category);
  const value = key => item?.[key] ?? ui.sheet.draft?.[key] ?? "";
  const tags = (item?.tags || []).join(", ");
  const sectionField = category === "addresses" ? "" : `<div class="field-row"><label class="field">Раздел<select name="categoryId"><option value="">Без раздела</option>${savedSections(category).map(section => `<option value="${esc(section.id)}" ${value("categoryId") === section.id ? "selected" : ""}>${esc(section.name)}</option>`).join("")}</select></label>${savedFormField("Метки через запятую", "tags", tags)}</div>`;
  const common = `${savedFormField("Название", "title", value("title"), "text", 'maxlength="120" required autofocus')}<label class="field">${category === "notes" ? "Текст заметки" : category === "posts" ? "Короткое описание" : "Описание"}<textarea name="description" placeholder="Текст или подробности">${esc(value("description"))}</textarea></label>${sectionField}`;
  let extra = "";
  if (["files", "posts", "links"].includes(category)) extra += `<div class="field-row">${savedFormField("Время, мин", "minutes", value("minutes"), "number", 'min="0"')}${savedFormField("Источник", "source", value("source"))}</div>`;
  if (category === "posts") {
    const media = item ? postInfo(item, "media") || [] : [];
    const localMedia = media.map((entry, index) => ({ ...entry, index })).filter(entry => !/^https?:\/\//i.test(entry.src || ""));
    const remoteMedia = media.filter(entry => /^https?:\/\//i.test(entry.src || ""));
    extra += `<label class="field">Полный текст поста<textarea name="body" rows="9" placeholder="Текст сохранённого поста">${esc(item ? postInfo(item, "body") || "" : "")}</textarea></label><label class="field">Пересказ<textarea name="summary" rows="3" placeholder="Короткое содержание, которое появится по кнопке">${esc(item ? postInfo(item, "summary") || "" : "")}</textarea></label>${localMedia.length ? `<div class="post-editor-media"><strong>Прикреплённые медиа</strong>${localMedia.map(entry => `<label>${entry.type === "video" ? `<span class="post-editor-video">Видео</span>` : `<img src="${esc(entry.src)}" alt="" loading="lazy">`}<span>${esc(entry.alt || entry.name || `Вложение ${entry.index + 1}`)}</span><input name="removeMedia" type="checkbox" value="${entry.index}">Убрать</label>`).join("")}</div>` : ""}<label class="field">Ссылки на изображения или видео, по одной на строку<textarea name="mediaUrls" rows="3" placeholder="https://…jpg\nhttps://…mp4">${esc(remoteMedia.map(entry => entry.src).join("\n"))}</textarea></label><label class="field">Добавить фото или видео<input name="postAttachments" type="file" multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"></label><p class="section-note">Файлы до 2,5 МБ суммарно сохраняются только в этом браузере. Видео можно также добавить ссылкой.</p>`;
  }
  if (category === "links") extra += `${savedFormField("Ссылка", "url", value("url"), "url", 'placeholder="https://…"')}<label class="field">Конспект / главное<textarea name="summary" placeholder="Появится после пересказа ботом">${esc(value("summary"))}</textarea></label>`;
  if (category === "recipes") extra += `<div class="field-row">${savedFormField("Порции", "servings", value("servings") || 4, "number", 'min="1" max="20"')}${savedFormField("Время, мин", "minutes", value("minutes"), "number", 'min="0"')}</div><label class="field">Ингредиенты, каждый с новой строки<textarea name="ingredients">${esc((item?.ingredients || []).map(x => recipeIngredientLine(x, 1)).join("\n"))}</textarea></label><label class="field">Шаги, каждый с новой строки<textarea name="steps">${esc((item?.steps || []).join("\n"))}</textarea></label>`;
  if (category === "movies") extra += `<div class="movie-cover-editor">${movieCoverMarkup(item || { title: value("title"), year: value("year") }, "editor")}<div><label class="field">Обложка фильма<input name="coverAttachment" type="file" accept="image/png,image/jpeg,image/webp"></label><p class="section-note">JPG, PNG или WebP до 1,5 МБ. Обложка хранится только в этом браузере.</p>${item && movieCoverSource(item) ? `<label class="movie-cover-remove"><input name="removeCover" type="checkbox" value="true">Убрать обложку</label>` : ""}</div></div><div class="field-row">${savedFormField("Год", "year", value("year"), "number", 'min="1880"')}${savedFormField("Режиссёр", "director", value("director"))}</div><div class="field-row">${savedFormField("Оригинальное название", "originalTitle", value("originalTitle"))}${savedFormField("Жанр", "genre", value("genre"))}</div><div class="field-row">${savedFormField("Где смотреть", "where", value("where"))}<label class="field">Статус<select name="status">${["Хочу посмотреть", "Смотрю", "Посмотрел"].map(status => `<option ${value("status") === status ? "selected" : ""}>${status}</option>`).join("")}</select></label></div>${savedFormField("Ссылка на Кинопоиск", "kinopoiskUrl", item ? movieInfo(item, "kinopoiskUrl") || "" : "", "url", 'placeholder="https://www.kinopoisk.ru/film/…"')}<div class="field-row">${savedFormField("Оценка Кинопоиска", "kinopoiskRating", item ? movieInfo(item, "kinopoiskRating") ?? "" : "", "number", 'min="0" max="10" step="0.1"')}${savedFormField("Оценка IMDb", "imdbRating", item ? movieInfo(item, "imdbRating") ?? "" : "", "number", 'min="0" max="10" step="0.1"')}</div><div class="field-row">${savedFormField("Моя оценка 1–10", "rating", value("rating") || "", "number", 'min="1" max="10"')}${savedFormField("Почему сохранил", "reason", value("reason"))}</div>`;
  if (category === "products") extra += `<div class="field-row">${savedFormField("Цена, ₽", "price", value("price"), "number", 'min="0"')}${savedFormField("Магазин", "store", value("store"))}</div>${savedFormField("Желаемая цена, ₽", "targetPrice", value("targetPrice"), "number", 'min="0"')}`;
  if (category === "tickets") { const ticketType = value("ticketType") || "event"; extra += `<label class="field">Тип билета<select name="ticketType">${[["event","Мероприятие"],["train","Поезд"],["flight","Самолёт"]].map(([key,label]) => `<option value="${key}" ${ticketType === key ? "selected" : ""}>${label}</option>`).join("")}</select></label><div class="field-row">${savedFormField("Дата", "eventDate", value("eventDate"), "date")}${savedFormField("Время", "eventTime", value("eventTime"), "time")}</div><div data-ticket-use="event" ${ticketType !== "event" ? "hidden" : ""}>${savedFormField("Место проведения", "venue", value("venue"))}</div><div data-ticket-use="travel" ${ticketType === "event" ? "hidden" : ""}><div class="field-row">${savedFormField("Откуда", "origin", value("origin"))}${savedFormField("Куда", "destination", value("destination"))}</div>${savedFormField("Рейс / перевозчик", "carrier", value("carrier"))}</div>${window.SOROKA_LIVE ? "" : savedFormField("Номер бронирования", "reference", value("reference"))}<div class="ticket-code-editor"><div class="ticket-rows-head"><h3>Билеты</h3><small>Место и код у каждого свои</small></div><div class="ticket-rows" data-ticket-rows>${(ticketRows(item).length ? ticketRows(item) : [{}]).map((row, index) => ticketRowField(row, index)).join("")}</div><button class="small-button ticket-row-add" type="button" data-action="ticket-row-add">${icon("plus", "icon-sm")}Ещё билет</button></div>${window.SOROKA_LIVE ? `<p class="section-note">Фото или PDF билета пришлите боту в чат — он прикрепит файл и найдёт коды.</p>` : `<label class="field">Прикрепить билет<input name="attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"></label><p class="section-note">PDF или изображение до 2 МБ. Файл хранится только в этом браузере.</p>`}`; }
  if (category === "addresses") extra += `<label class="field">Раздел<select name="categoryId"><option value="">Без категории</option>${mapCategories().map(section => `<option value="${esc(section.id)}" ${value("categoryId") === section.id ? "selected" : ""}>${esc(section.name)}</option>`).join("")}</select></label><div class="field address-find"><span>Адрес</span><input name="address" type="text" value="${esc([value("address"), value("city") && !String(value("address")).includes(value("city")) ? value("city") : ""].filter(Boolean).join(", "))}" placeholder="Чистая 5 107" autocomplete="off" spellcheck="false" enterkeyhint="done"><div class="address-suggest" role="listbox" hidden></div><small class="address-find-state" aria-live="polite">${mapPointCoordinates({ lat: value("lat"), lng: value("lng") }) ? "✓ Адрес на карте" : "Улица, дом и квартира — дальше подскажу"}</small></div><input type="hidden" name="city" value="${esc(value("city"))}"><input type="hidden" name="lat" value="${esc(value("lat"))}"><input type="hidden" name="lng" value="${esc(value("lng"))}">`;
  if (category === "files") extra += `<label class="field">Прикрепить файл<input name="attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/png,image/jpeg,image/webp,text/plain"></label><p class="section-note">PDF, изображение или TXT до 2 МБ. Файл сохранится только в этом браузере.</p>`;
  // Закрепление — закладкой на карточке, «просмотрено» — свайпом вправо: в форме их нет.
  const flags = "";
  const source = item?.source || (category === "notes" ? "Сообщение из чата" : "Добавлено вручную");
  const history = category === "notes" && item?.versions?.length ? `<div class="detail-block"><h3>Предыдущие версии</h3>${item.versions.slice().reverse().slice(0, 3).map((version, index) => `<div class="side-row"><span>${esc(version.date || "Ранее")}</span><button class="text-action" type="button" data-action="saved-restore-version" data-version="${item.versions.length - 1 - index}">Вставить в редактор</button></div>`).join("")}</div>` : "";
  const listDetails = category === "lists" ? renderListItems(item) : category === "recipes" && item ? `<div class="detail-block"><h3>Список покупок</h3><label class="field">На сколько порций?<input id="recipe-portions" type="number" min="1" value="${esc(item.servings || 4)}"></label><p class="section-note">Количество ингредиентов пересчитается при создании списка.</p></div>` : "";
  const extraActions = item ? `<div class="inline-actions">${category === "links" && item.url ? `<button type="button" data-action="saved-link">${icon("external")}Открыть</button><button type="button" data-action="saved-summary">${icon("note")}Перескажи</button>` : ""}${category === "files" ? `<button type="button" data-action="saved-send">${icon("arrow")}В чат</button>` : ""}${category === "recipes" ? `<button type="button" data-action="recipe-shopping">${icon("check")}В список покупок</button>` : ""}${category === "products" ? `<button type="button" data-action="product-track">${icon("chart")}${item.tracked ? "Остановить отслеживание" : "Следить за ценой"}</button>` : ""}<button type="button" class="danger" data-action="saved-delete">${icon("trash")}В корзину</button></div>` : "";
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${item ? "Изменить запись" : "Новая запись"}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><p class="eyebrow">${esc(SAVED_NAMES[category])}</p>${item ? `<div class="detail-meta"><div><small>Источник</small><strong>${esc(source)}</strong></div><div><small>Создано</small><strong>${esc(item.created ? shortDate(item.created) : "в чате")}</strong></div></div>` : ""}<form id="saved-form">${common}${extra}${flags}<p class="form-error" role="alert"></p><div class="sheet-actions"><button class="primary-button" type="submit">${item ? "Сохранить изменения" : "Добавить"}</button></div></form>${listDetails}${history}${category === "notes" && item ? `<div class="detail-block"><h3>Исходное сообщение</h3><p>${esc(item.sourceText || item.description || "Запись добавлена вручную")}</p><button class="small-button" type="button" data-action="saved-insert-source">Вставить в редактор</button></div>` : ""}${extraActions}</section></div>`;
}
function deleteSavedRecord(category, recordId) {
  const item = savedItem(category, recordId);
  if (!item) return false;
  pushTrash(`saved:${category}`, item);
  if (category === "notes") data.notes = data.notes.filter(x => x.id !== recordId);
  else data.saved[category] = data.saved[category].filter(x => x.id !== recordId);
  ui.sheet = null;
  save();
  toast("Запись в корзине");
  return true;
}
function savedAction(action, control) {
  if (action === "saved-home") { ui.savedCategory = "overview"; ui.savedSection = ""; ui.savedQuery = ""; ui.savedFilter = "all"; ui.mapPlacing = false; render(); window.scrollTo({ top: 0, behavior: "smooth" }); return true; }
  if (action === "saved-section") { ui.savedCategory = control.dataset.category; ui.savedSection = ""; ui.savedQuery = ""; ui.savedFilter = "all"; ui.mapPlacing = false; render(); window.scrollTo({ top: 0, behavior: "smooth" }); return true; }
  if (action === "saved-tab") { ui.savedCategory = control.dataset.category; ui.savedSection = ""; ui.savedQuery = ""; ui.savedFilter = "all"; render(); return true; }
  if (action === "saved-section-filter") { ui.savedSection = control.dataset.id || ""; render(); return true; }
  if (action === "saved-sections-manage" && ui.savedCategory !== "addresses") { ui.sheet = { kind: "saved-sections", category: ui.savedCategory, editSectionId: null, justRendered: false }; render(); return true; }
  if (action === "saved-section-edit" && ui.sheet?.kind === "saved-sections") { ui.sheet.editSectionId = control.dataset.id; ui.sheet.justRendered = false; render(); return true; }
  if (action === "saved-section-cancel" && ui.sheet?.kind === "saved-sections") { ui.sheet.editSectionId = null; ui.sheet.justRendered = false; render(); return true; }
  if (action === "saved-section-delete" && ui.sheet?.kind === "saved-sections") {
    const category = ui.sheet.category, sectionId = control.dataset.id;
    const affected = savedItems(category).filter(item => (category === "notes" ? noteFolderId(item) : item.categoryId) === sectionId);
    data.savedSections[category] = data.savedSections[category].filter(section => section.id !== sectionId);
    affected.forEach(item => { item.categoryId = ""; item.topic = ""; });
    if (ui.savedSection === sectionId) ui.savedSection = "";
    ui.sheet.editSectionId = null;
    save(); render(); toast(category === "notes" ? "Папка удалена. Заметки остались в «Все»." : "Раздел удалён. Записи остались в «Все»."); return true;
  }
  if (action === "saved-filter") { ui.savedFilter = control.dataset.filter; render(); return true; }
  if (action === "saved-view") { ui.savedView = control.dataset.view; render(); return true; }
  if (action === "saved-pins-toggle") { ui.savedPinsOpen = ui.savedPinsOpen === false; render(); return true; }
  if (action === "saved-new") { ui.sheet = { kind: "saved-add-menu" }; render(); return true; }
  if (action === "saved-add-record" && ui.sheet?.kind === "saved-add-menu") { openSavedRecord(control.dataset.category); return true; }
  if (action === "saved-add-manage" && ui.sheet?.kind === "saved-add-menu") { ui.sheet = { kind: ui.savedCategory === "addresses" ? "map-categories" : "saved-sections", category: ui.savedCategory }; render(); return true; }
  if (action === "saved-add-map" && ui.sheet?.kind === "saved-add-menu") { ui.sheet = null; ui.addressView = "map"; ui.mapPlacing = true; render(); return true; }
  if (action === "saved-open") { openSavedRecord(control.dataset.category, control.dataset.id); return true; }
  if (action === "ticket-row-add") { const box = document.querySelector("[data-ticket-rows]"); if (box) { box.insertAdjacentHTML("beforeend", ticketRowField({}, box.children.length)); renumberTicketRows(); box.lastElementChild?.querySelector("input")?.focus(); } return true; }
  if (action === "ticket-row-remove") { const row = control.closest("[data-ticket-row]"); const box = row?.parentElement; if (row && box) { if (box.children.length > 1) row.remove(); else row.querySelectorAll("input:not([type=hidden])").forEach(input => { input.value = ""; }); renumberTicketRows(); } return true; }
  if (action === "saved-pin-card") { const target = savedItem(control.dataset.category, control.dataset.id); if (target) { target.pinned = !target.pinned; save(); render(); toast(target.pinned ? "Закреплено" : "Откреплено"); } return true; }
  if (action === "note-cancel" && ui.sheet?.kind === "saved" && ui.sheet.category === "notes") { if (ui.sheet.id && ui.sheet.mode === "edit") ui.sheet.mode = "view"; else ui.sheet = null; render(); return true; }
  if (!ui.sheet || ui.sheet.kind !== "saved") return false;
  const item = ui.sheet.id ? savedItem(ui.sheet.category, ui.sheet.id) : null;
  if (action === "recipe-portion-step" && item && ui.sheet.category === "recipes") { updateRecipePortions(item, recipePortions(item) + Number(control.dataset.step)); return true; }
  if (action === "post-summary" && item && ui.sheet.category === "posts") { ui.postSummaryId = ui.postSummaryId === item.id ? null : item.id; render(); if (ui.postSummaryId) requestAnimationFrame(() => document.querySelector(".post-summary")?.scrollIntoView({ block: "nearest" })); return true; }
  if (action === "post-open-bot" && item && ui.sheet.category === "posts") { ui.sheet.mode = "bot-preview"; render(); return true; }
  if (action === "post-bot-back" && item && ui.sheet.category === "posts") { ui.sheet.mode = "view"; render(); return true; }
  if (action === "saved-share" && item) { void shareRecord(`saved:${ui.sheet.category}`, item.id); return true; }
  if (action === "saved-edit" && item) { ui.sheet.mode = "edit"; ui.sheet.justRendered = false; render(); return true; }
  if (action === "saved-delete" && item) { deleteSavedRecord(ui.sheet.category, item.id); return true; }
  if (action === "saved-pin" && item) { item.pinned = !item.pinned; save(); render(); toast(item.pinned ? "Закреплено" : "Откреплено"); return true; }
  if (action === "saved-viewed" && item) { if (ui.sheet.category === "movies") toggleMovieViewed(item); else { item.viewed = !item.viewed; save(); toast(item.viewed ? "Отмечено просмотренным" : "Вернули в очередь"); } return true; }
  if (action === "saved-link" && item) { if (item.url && /^https?:\/\//i.test(item.url)) window.open(item.url, "_blank", "noopener,noreferrer"); return true; }
  if (action === "saved-summary" && item) { item.summary ||= `Короткий конспект: ${item.description || item.title}. Откройте источник для подробностей.`; save(); render(); return true; }
  if (action === "saved-send") { toast("В рабочем приложении запись отправится в чат Telegram"); return true; }
  if (action === "saved-insert-source" && item) { const input = document.querySelector('#saved-form textarea[name="description"]'); if (input) { input.value = item.sourceText || item.description || ""; input.focus(); } return true; }
  if (action === "saved-restore-version" && item) { const version = item.versions?.[Number(control.dataset.version)]; const input = document.querySelector('#saved-form textarea[name="description"]'); if (version && input) { input.value = version.description; input.focus(); input.dispatchEvent(new Event("input", { bubbles: true })); } return true; }
  if (action === "recipe-shopping" && item) { const portions = recipePortions(item); const factor = portions / Math.max(1, Number(item.servings) || 1); const ingredients = (item.ingredients || []).map(one => recipeIngredientLine(one, factor, true)); const foodSection = savedSections("lists").find(section => section.name === "Еда"); const list = { id: id(), title: `Для ${item.title} · ${portions} порц.`, description: "Из рецепта", topic: foodSection?.name || "", categoryId: foodSection?.id || "", tags: ["покупки"], created: todayIso(), items: ingredients.map(text => ({ id: id(), text, done: false })) }; data.saved.lists.push(list); save(); ui.sheet = null; ui.savedCategory = "lists"; ui.savedSection = ""; navigate("saved"); toast("Список покупок создан"); return true; }
  if (action === "product-track" && item) { item.tracked = !item.tracked; save(); toast(item.tracked ? "Бот следит за ценой" : "Отслеживание выключено"); return true; }
  if (action === "list-toggle" && item) {
    const entry = item.items?.find(x => x.id === control.dataset.id);
    if (entry) {
      entry.done = !entry.done;
      save();
      if (ui.sheet.mode === "view") { renderKeepScroll(); } else if (false) {
        const line = control.closest(".saved-list-line");
        line?.classList.toggle("done", entry.done);
        const check = line?.querySelector(".task-check");
        check?.classList.toggle("checked", entry.done);
        check?.setAttribute("aria-pressed", String(entry.done));
        line?.querySelectorAll("[data-action='list-toggle']").forEach(button => button.setAttribute("aria-label", `${entry.done ? "Вернуть" : "Выполнить"}: ${entry.text}`));
        const progress = document.getElementById("saved-list-progress");
        if (progress) progress.textContent = `${item.items.filter(x => x.done).length}/${item.items.length} выполнено`;
      } else render();
    }
    return true;
  }
  if (action === "list-edit" && item) { ui.sheet.editItemId = control.dataset.id; ui.sheet.justRendered = true; render(); document.querySelector('#list-item-form input')?.focus(); return true; }
  if (["list-up", "list-down"].includes(action) && item) { const index = item.items.findIndex(x => x.id === control.dataset.id); const target = index + (action === "list-up" ? -1 : 1); if (index >= 0 && target >= 0 && target < item.items.length) { [item.items[index], item.items[target]] = [item.items[target], item.items[index]]; save(); render(); } return true; }
  if (action === "list-remove" && item) { item.items = item.items.filter(x => x.id !== control.dataset.id); if (ui.sheet.editItemId === control.dataset.id) ui.sheet.editItemId = null; save(); renderKeepScroll(); return true; }
  if (action === "list-item-edit" && item) { ui.sheet.editItemId = control.dataset.id; renderKeepScroll(() => { const input = document.querySelector("#list-edit-form input"); if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); } }); return true; }
  if (action === "list-clear-done" && item) { item.items = (item.items || []).filter(x => !x.done); save(); renderKeepScroll(); toast("Выполненные убраны"); return true; }
  return false;
}
function savedSubmit(event) {
  if (event.target.id === "saved-add-list-item" && ui.sheet?.kind === "saved-add-menu") {
    event.preventDefault();
    const form = new FormData(event.target);
    const list = savedItem("lists", String(form.get("listId") || ""));
    const itemText = String(form.get("text") || "").trim();
    if (!list || !itemText) return true;
    list.items ||= [];
    list.items.push({ id: id(), text: itemText, done: false });
    save(); ui.sheet = null; toast("Пункт добавлен в список");
    return true;
  }
  if (event.target.id === "saved-section-form" && ui.sheet?.kind === "saved-sections") {
    event.preventDefault();
    const form = new FormData(event.target);
    const category = ui.sheet.category;
    const name = String(form.get("name") || "").trim();
    const error = event.target.querySelector(".form-error");
    if (!name) return true;
    const duplicate = savedSections(category).find(section => section.id !== ui.sheet.editSectionId && section.name.toLocaleLowerCase("ru-RU") === name.toLocaleLowerCase("ru-RU"));
    if (duplicate) { if (error) error.textContent = category === "notes" ? "Папка с таким названием уже есть." : "Раздел с таким названием уже есть."; return true; }
    const current = savedSection(category, ui.sheet.editSectionId);
    const affected = current ? savedItems(category).filter(item => (category === "notes" ? noteFolderId(item) : item.categoryId) === current.id) : [];
    const section = current || { id: id(), sortOrder: savedSections(category).length };
    section.name = name;
    section.icon = String(form.get("icon") || savedIcon(category));
    section.color = String(form.get("color") || "#8dbbb4");
    if (!current) data.savedSections[category].push(section);
    else affected.forEach(item => { item.categoryId = section.id; item.topic = name; });
    ui.sheet.editSectionId = null;
    save(); render(); toast(category === "notes" ? (current ? "Папка изменена" : "Папка создана") : (current ? "Раздел изменён" : "Раздел создан"));
    return true;
  }
  if (event.target.id === "saved-form" && ui.sheet?.kind === "saved") {
    event.preventDefault();
    const form = new FormData(event.target);
    const title = String(form.get("title") || "").trim();
    if (!title) return true;
    const category = ui.sheet.category;
    const recordId = ui.sheet.id;
    const attachment = ["files", "tickets"].includes(category) ? event.target.querySelector('input[name="attachment"]')?.files[0] : null;
    const coverAttachment = category === "movies" ? event.target.querySelector('input[name="coverAttachment"]')?.files[0] : null;
    const postAttachments = category === "posts" ? [...(event.target.querySelector('input[name="postAttachments"]')?.files || [])] : [];
    const mimeByExt = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", txt: "text/plain" };
    const ext = attachment?.name.split(".").pop()?.toLowerCase();
    const fileMime = attachment ? mimeByExt[ext] : "";
    const error = event.target.querySelector(".form-error");
    if (attachment && (!fileMime || attachment.size > 2 * 1024 * 1024)) { if (error) error.textContent = "Выберите PDF, изображение или TXT размером до 2 МБ."; return true; }
    if (coverAttachment && (!/^image\/(png|jpeg|webp)$/.test(coverAttachment.type) || coverAttachment.size > 1.5 * 1024 * 1024)) { if (error) error.textContent = "Выберите JPG, PNG или WebP размером до 1,5 МБ."; return true; }
    if (postAttachments.some(file => !/^(image\/(png|jpeg|webp)|video\/(mp4|webm))$/.test(file.type)) || postAttachments.reduce((total, file) => total + file.size, 0) > 2.5 * 1024 * 1024) { if (error) error.textContent = "Выберите JPG, PNG, WebP, MP4 или WebM общим размером до 2,5 МБ."; return true; }
    const postMediaUrls = category === "posts" ? String(form.get("mediaUrls") || "").split("\n").map(line => line.trim()).filter(Boolean) : [];
    if (postMediaUrls.some(url => !/^https:\/\//i.test(url))) { if (error) error.textContent = "Ссылки на медиа должны начинаться с https://"; return true; }
    if (category === "movies") {
      const url = String(form.get("kinopoiskUrl") || "").trim();
      if (url && !/^https?:\/\/(www\.)?kinopoisk\.ru\/film\/\d+\/?(?:\?.*)?$/i.test(url)) { if (error) error.textContent = "Укажите ссылку на страницу фильма на Кинопоиске."; return true; }
      for (const key of ["kinopoiskRating", "imdbRating"]) {
        const score = String(form.get(key) || "").trim().replace(",", ".");
        if (score && (!Number.isFinite(Number(score)) || Number(score) < 0 || Number(score) > 10)) { if (error) error.textContent = "Оценка должна быть от 0 до 10."; return true; }
      }
    }
    const commit = (fileData, uploadedPostMedia = []) => {
      if (ui.sheet?.kind !== "saved" || ui.sheet.category !== category || ui.sheet.id !== recordId) return;
      const before = JSON.parse(JSON.stringify(data));
      const existing = recordId ? savedItem(category, recordId) : null;
      const priorPostMedia = category === "posts" && existing ? postInfo(existing, "media") || [] : [];
      const item = existing || { id: id(), created: todayIso(), source: "Добавлено вручную", versions: [], items: [] };
      const nextDescription = String(form.get("description") || "").trim();
      if (existing && category === "notes" && existing.description !== nextDescription) { item.versions ||= []; item.versions.push({ date: todayIso(), description: existing.description || "" }); }
      item.title = title; item.description = nextDescription;
      if (category === "notes") item.updated = new Date().toISOString();
      if (category !== "addresses") { item.categoryId = String(form.get("categoryId") || ""); item.topic = savedSection(category, item.categoryId)?.name || ""; }
      item.tags = category === "addresses" ? (item.tags || []) : String(form.get("tags") || "").split(",").map(x => x.trim()).filter(Boolean);
      if (["files", "posts", "links"].includes(category)) { item.minutes = Math.max(0, Number(form.get("minutes") || 0)); item.source = String(form.get("source") || item.source).trim(); }
      if (["files", "tickets"].includes(category) && attachment) { item.fileData = fileData; item.filePath = ""; item.previewPath = ""; item.fileType = fileMime; item.fileName = attachment.name; }
      if (category === "posts") {
        const removed = new Set(form.getAll("removeMedia").map(Number));
        item.body = String(form.get("body") || "").trim();
        item.summary = String(form.get("summary") || "").trim();
        item.media = [...priorPostMedia.filter((entry, index) => !/^https?:\/\//i.test(entry.src || "") && !removed.has(index)), ...postMediaUrls.map(src => ({ type: /\.(?:mp4|webm)(?:[?#]|$)/i.test(src) ? "video" : "image", src, alt: "Медиа из поста" })), ...uploadedPostMedia];
      }
      if (category === "links") { item.url = String(form.get("url") || "").trim(); item.summary = String(form.get("summary") || "").trim(); }
      if (category === "recipes") { item.servings = Math.max(1, Number(form.get("servings") || 1)); item.minutes = Math.max(0, Number(form.get("minutes") || 0)); item.ingredients = String(form.get("ingredients") || "").split("\n").map(x => x.trim()).filter(Boolean); item.steps = String(form.get("steps") || "").split("\n").map(x => x.trim()).filter(Boolean); }
      if (category === "movies") { item.year = Number(form.get("year") || 0); item.director = String(form.get("director") || "").trim(); item.originalTitle = String(form.get("originalTitle") || "").trim(); item.genre = String(form.get("genre") || "").trim(); item.where = String(form.get("where") || "").trim(); item.status = String(form.get("status") || "Хочу посмотреть"); item.kinopoiskUrl = String(form.get("kinopoiskUrl") || "").trim(); item.kinopoiskRating = String(form.get("kinopoiskRating") || "").trim() ? Number(String(form.get("kinopoiskRating")).replace(",", ".")) : ""; item.imdbRating = String(form.get("imdbRating") || "").trim() ? Number(String(form.get("imdbRating")).replace(",", ".")) : ""; item.rating = Number(form.get("rating") || 0); item.reason = String(form.get("reason") || "").trim(); if (coverAttachment) { item.coverData = fileData; item.coverHidden = false; } else if (form.get("removeCover") === "true") { item.coverData = ""; item.coverPath = ""; item.coverHidden = true; } }
      if (category === "products") { item.price = Math.max(0, Number(form.get("price") || 0)); item.store = String(form.get("store") || "").trim(); item.targetPrice = Math.max(0, Number(form.get("targetPrice") || 0)); }
      if (category === "tickets") { for (const key of ["ticketType", "eventDate", "eventTime", "origin", "destination", "venue", "carrier", "reference"]) item[key] = String(form.get(key) || "").trim(); const before = ticketRows(item); const texts = form.getAll("rowText"), kinds = form.getAll("rowKind"), seats = form.getAll("rowSeat"), formats = form.getAll("rowFormat"); item.codes = texts.map((text, i) => { const row = { text: String(text || "").trim(), kind: kinds[i] === "barcode" ? "barcode" : "qr", seat: String(seats[i] || "").trim(), format: String(formats[i] || "") }; const same = before.find(old => old.text === row.text && old.kind === row.kind); return { ...row, svg: same?.svg || "" }; }).filter(row => row.text || row.seat); item.seat = item.codes.map(row => row.seat).filter(Boolean).join(" · "); item.codeType = item.codes[0]?.kind || ""; item.codeValue = item.codes[0]?.text || ""; if (!item.categoryId) { item.categoryId = { event: "events", train: "trains", flight: "flights" }[item.ticketType] || ""; item.topic = savedSection("tickets", item.categoryId)?.name || ""; } }
      if (category === "addresses") {
        // Не выбрал подсказку — берём первую: адрес без точки на карте никому не нужен.
        const typed = String(event.target.elements.address?.value || "").trim();
        if (!event.target.elements.lat?.value && addressHits.length && addressHitsFor === typed) pickAddress(event.target, addressHits[0]);
        const city = String(event.target.elements.city?.value || "").trim();
        const raw = String(event.target.elements.address?.value || "").trim();
        item.address = city && raw.toLowerCase().endsWith(`, ${city.toLowerCase()}`) ? raw.slice(0, -(city.length + 2)) : raw;
        item.city = city;
        item.categoryId = String(form.get("categoryId") || ""); item.topic = mapCategory(item.categoryId)?.name || "";
        const lat = String(event.target.elements.lat?.value || "").trim(), lng = String(event.target.elements.lng?.value || "").trim();
        if ((lat && !lng) || (!lat && lng) || (lat && (Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180))) { if (error) error.textContent = "Укажите обе координаты в допустимом диапазоне."; return; }
        item.lat = lat ? Number(lat) : null; item.lng = lng ? Number(lng) : null;
      }
      if (category !== "notes" && category !== "lists") { item.viewed = category === "movies" ? item.status === "Посмотрел" : Boolean(existing?.viewed); item.pinned = Boolean(existing?.pinned); }
      if (!existing) savedItems(category).push(item);
      if (!save()) { data = before; if (error) error.textContent = "Не хватило места в браузере для сохранения. Выберите файл меньше или удалите тестовые записи."; return; }
      if (category === "notes") { ui.sheet = { kind: "saved", category: "notes", id: item.id, mode: "view", justRendered: true }; render(); toast(existing ? "Заметка сохранена" : "Заметка создана"); }
      else { ui.sheet = null; toast(existing ? "Изменения сохранены" : "Запись добавлена"); }
    };
    if (postAttachments.length) {
      Promise.all(postAttachments.map(file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve({ type: file.type.startsWith("video/") ? "video" : "image", src: String(reader.result || ""), alt: file.name }); reader.onerror = reject; reader.readAsDataURL(file); }))).then(media => commit("", media)).catch(() => { if (error) error.textContent = "Не удалось прочитать медиа. Выберите файлы ещё раз."; });
    } else if (attachment || coverAttachment) {
      const reader = new FileReader();
      reader.onload = () => commit(String(reader.result || ""));
      reader.onerror = () => { if (error) error.textContent = "Не удалось прочитать файл. Попробуйте ещё раз."; };
      reader.readAsDataURL(attachment || coverAttachment);
    } else commit(null);
    return true;
  }
  if (event.target.id === "list-item-form" && ui.sheet?.kind === "saved") {
    event.preventDefault();
    const list = savedItem("lists", ui.sheet.id);
    const text = String(new FormData(event.target).get("text") || "").trim();
    // В просмотре поле внизу только добавляет — и остаётся в фокусе для следующего пункта.
    if (list && text && ui.sheet.mode === "view") { list.items.push({ id: id(), text, done: false }); save(); renderKeepScroll(() => document.querySelector("#list-item-form input")?.focus()); return true; }
    if (list && text) { const existing = ui.sheet.editItemId ? list.items.find(x => x.id === ui.sheet.editItemId) : null; if (existing) existing.text = text; else list.items.push({ id: id(), text, done: false }); ui.sheet.editItemId = null; save(); render(); }
    return true;
  }
  if (event.target.id === "list-edit-form" && ui.sheet?.kind === "saved") {
    event.preventDefault();
    const list = savedItem("lists", ui.sheet.id);
    const entry = list?.items.find(x => x.id === event.target.dataset.id);
    const text = String(new FormData(event.target).get("text") || "").trim();
    if (entry && text && entry.text !== text) { entry.text = text; save(); }
    ui.sheet.editItemId = null; renderKeepScroll();
    return true;
  }
  return false;
}
// Ушли из поля правки пункта — сохраняем, как в заметках телефона.
document.addEventListener("focusout", event => {
  const form = event.target?.closest?.("#list-edit-form");
  if (form && !(event.relatedTarget && form.contains(event.relatedTarget))) setTimeout(() => { if (document.body.contains(form)) form.requestSubmit(); }, 0);
});
function savedInput(event) {
  if (event.target.id === "saved-pins-search") {
    const query = event.target.value.trim().toLocaleLowerCase("ru-RU");
    ui.savedPinsQuery = event.target.value;
    const rows = [...document.querySelectorAll(".saved-pin-row")];
    rows.forEach(row => { row.hidden = Boolean(query) && !row.dataset.search.includes(query); });
    const empty = document.getElementById("saved-pins-no-results");
    if (empty) empty.hidden = rows.some(row => !row.hidden);
    return true;
  }
  if (event.target.id === "recipe-portions" && ui.sheet?.kind === "saved" && ui.sheet.category === "recipes") {
    const item = savedItem("recipes", ui.sheet.id);
    if (item && event.target.value !== "") updateRecipePortions(item, event.target.value);
    return true;
  }
  if (event.target.id !== "saved-filter-input") return false;
  ui.savedQuery = event.target.value;
  const results = document.getElementById("saved-results");
  if (results) {
    if (ui.savedCategory === "addresses") {
      const items = mapPointItems();
      results.innerHTML = items.length ? `<div class="record-list">${items.map(item => savedRecordCard(item, "addresses")).join("")}</div>` : emptyCard("Адресов нет", "Измените поиск или фильтр.");
    } else results.innerHTML = ui.savedCategory === "notes" ? renderNotesResults() : renderSavedResults();
    installSwipeCards(results);
  }
  return true;
}
function savedChange(event) {
  if (event.target.name === "ticketType" && ui.sheet?.kind === "saved" && ui.sheet.category === "tickets") {
    document.querySelectorAll("[data-ticket-use]").forEach(group => { group.hidden = group.dataset.ticketUse === "event" ? event.target.value !== "event" : event.target.value === "event"; });
    const section = event.target.form?.elements.categoryId;
    if (section && !section.value) section.value = { event: "events", train: "trains", flight: "flights" }[event.target.value] || "";
    return true;
  }
  if (event.target.id === "recipe-portions" && ui.sheet?.kind === "saved" && ui.sheet.category === "recipes") {
    const item = savedItem("recipes", ui.sheet.id);
    if (item) updateRecipePortions(item, event.target.value);
    return true;
  }
  if (event.target.name === "attachment") {
    const file = event.target.files?.[0];
    const title = event.target.form?.elements.title;
    if (file && title && !title.value.trim()) title.value = file.name;
    return true;
  }
  if (event.target.id === "saved-show") {
    const value = event.target.value;
    if (["unread", "viewed", "pinned"].includes(value)) ui.savedFilter = value;
    else { ui.savedFilter = "all"; ui.savedSort = value; }
    render(); return true;
  }
  if (event.target.id !== "saved-sort") return false;
  ui.savedSort = event.target.value; render(); return true;
}
