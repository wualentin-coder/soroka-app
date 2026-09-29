/* Локальный сценарий проверки разбора. Здесь нет запроса к боту или ИИ. */
const CAPTURE_TYPES = [
  ["task", "Задача"], ["event", "Событие"], ["note", "Заметка"],
  ["expense", "Расход"], ["income", "Доход"], ["debt", "Долг"],
  ["link", "Ссылка"], ["list", "Список"], ["recipe", "Рецепт"],
  ["movie", "Фильм"], ["product", "Товар"], ["address", "Адрес"],
  ["metric", "Показатель"], ["post", "Пост"], ["file", "Файл"], ["ticket", "Билет"]
];
const CAPTURE_SAVED = { note: "notes", link: "links", list: "lists", recipe: "recipes", movie: "movies", product: "products", address: "addresses", post: "posts", file: "files", ticket: "tickets" };

function renderCaptureInput() {
  const examples = ["Завтра в 12:00 забрать заказ", "Кофе 350 ₽", "Сохрани рецепт лимонного пирога"];
  const choices = [["task", "Задача", "check"], ["event", "Событие", "calendar"], ["note", "Заметка", "note"], ["expense", "Расход", "wallet"], ["income", "Доход", "wallet"], ["link", "Ссылка", "link"], ["list", "Список", "bookmark"], ["recipe", "Рецепт", "bookmark"], ["movie", "Фильм", "event"], ["address", "Адрес", "pin"], ["file", "Файл", "archive"], ["ticket", "Билет", "ticket"], ["password", "Пароль", "key"], ["project", "Проект", "project"], ["metric", "Показатель", "chart"]];
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet capture-input-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Добавить в Сороку</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><p class="capture-intro">Напишите как боту — обычным текстом. Перед сохранением можно исправить разбор.</p><form id="quick-capture-form" class="capture-composer"><label for="capture-text" class="mini-heading">Сообщение</label><textarea id="capture-text" name="text" rows="5" placeholder="Например: завтра в 12 забрать заказ, кофе 350 ₽" required autofocus>${esc(ui.sheet?.draft || "")}</textarea><button class="primary-button" type="submit">Разобрать сообщение ${icon("arrow", "icon-sm")}</button></form><div class="capture-examples"><span>Попробовать пример</span>${examples.map((sample, i) => `<button type="button" data-action="capture-example" data-example="${i}">${esc(sample)}</button>`).join("")}</div><details class="capture-manual"><summary>Создать запись вручную</summary><div class="add-choice-grid">${choices.map(([key, label, symbol]) => `<button type="button" data-action="add-choice" data-type="${key}">${icon(symbol)}<span>${label}</span></button>`).join("")}</div></details></section></div>`;
}

function captureDate(text) {
  const lower = text.toLocaleLowerCase("ru-RU");
  if (/послезавтра/.test(lower)) return offsetIso(2);
  if (/завтра/.test(lower)) return offsetIso(1);
  if (/сегодня/.test(lower)) return todayIso();
  const weekdays = { понедельник: 1, вторник: 2, среду: 3, четверг: 4, пятницу: 5, субботу: 6, воскресенье: 0 };
  const match = lower.match(/(?:в|во|на)\s+(понедельник|вторник|среду|четверг|пятницу|субботу|воскресенье)/);
  if (match) {
    const target = weekdays[match[1]];
    const today = new Date().getDay();
    return offsetIso((target - today + 7) % 7 || 7);
  }
  const explicit = lower.match(/(?:^|\s)(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{4}))?(?=\s|$)/);
  if (explicit) {
    const year = explicit[3] || String(new Date().getFullYear());
    const value = `${year}-${explicit[2].padStart(2, "0")}-${explicit[1].padStart(2, "0")}`;
    if (!Number.isNaN(new Date(`${value}T12:00:00`).getTime())) return value;
  }
  return "";
}

function captureAmount(text) {
  const match = text.match(/(?:^|\s|[=+−-])(\d[\d\s]*(?:[.,]\d{1,2})?)\s*(тыс(?:яч[аиу]?)?|к|₽|руб(?:лей|ля|ль)?|р\b)(?![а-яё])/i)
    || text.match(/(?:^|\s)(\d{2,7}(?:[.,]\d{1,2})?)\s*$/);
  if (!match) return 0;
  const number = Number(match[1].replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(number) ? number * (/тыс|к\b/i.test(match[2] || "") ? 1000 : 1) : 0;
}

function captureGuess(line) {
  const source = line.trim();
  const lower = source.toLocaleLowerCase("ru-RU");
  const url = source.match(/https?:\/\/\S+/i)?.[0] || "";
  const amount = captureAmount(source);
  const date = captureDate(source);
  const timeMatch = source.match(/(?:^|\s)(?:в|к)\s*([01]?\d|2[0-3])(?::([0-5]\d))?(?=\s|$)/i);
  const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2] || "00"}` : "";
  let type = "note";
  let uncertain = false;
  if (/рецепт|ингредиент|приготов|испеч|сварить/i.test(lower)) type = "recipe";
  else if (/фильм|кино|сериал|посмотреть/i.test(lower)) type = "movie";
  else if (/список|чек.?лист/i.test(lower)) type = "list";
  else if (/билет|посадочный талон|электронный билет/i.test(lower)) type = "ticket";
  else if (/адрес|координат|локаци|геолокаци/i.test(lower) || /(?:maps\.google|yandex\.[a-z]+\/maps|2gis\.)/i.test(url)) type = "address";
  else if (/должен|должна|долг|одолжил|вернуть долг/i.test(lower) && amount) type = "debt";
  else if (/вес|сон|спал|пульс|шагов/i.test(lower) && /\d/.test(lower)) type = "metric";
  else if (/товар|купить|заказать/i.test(lower) && url) type = "product";
  else if (url) type = "link";
  else if (amount && /зарплат|зп|получил|пришло|доход|преми|вернули/i.test(lower) || /^\s*\+\s*\d/.test(source)) type = "income";
  else if (amount && (/потратил|заплатил|оплатил|купил|трата|расход|кофе|такси|продукты/i.test(lower) || /^\s*[-−]\s*\d/.test(source) || /\d+\s*(?:₽|руб)/i.test(source))) type = "expense";
  else if (/встреча|созвон|запись к|концерт|день рождения|событие/i.test(lower)) type = "event";
  else if (/надо|нужно|сделать|позвонить|забрать|отправить|напомни|задача/i.test(lower) || date) type = "task";
  else if (/заметка|идея|мысль|запиши/i.test(lower)) type = "note";
  else uncertain = true;
  let title = source.replace(/^#(?:заметка|встреча|доход|деньги|задача)\s+/i, "").trim();
  if (["task", "event"].includes(type)) title = title.replace(/сегодня|завтра|послезавтра/gi, "").replace(/(?:^|\s)(?:в|к)\s*\d{1,2}(?::\d{2})?(?=\s|$)/i, " ").replace(/\s+/g, " ").trim();
  if (["expense", "income"].includes(type)) title = title.replace(/[+−-]?\s*\d[\d\s]*(?:[.,]\d{1,2})?\s*(?:тыс(?:яч[аиу]?)?|к|₽|руб(?:лей|ля|ль)?|р\b)?\s*$/i, "").replace(/^(?:потратил|заплатил|оплатил|получил|купил)\s+/i, "").trim() || source;
  if (type === "recipe") title = title.replace(/^(?:сохрани|запиши)\s+/i, "").replace(/^рецепт\s+/i, "").trim();
  if (type === "movie") title = title.replace(/^(?:посмотреть|сохрани|запиши)\s+/i, "").replace(/^(?:фильм|кино|сериал)\s+/i, "").trim();
  if (type === "link" && title === url) title = url.replace(/^https?:\/\//i, "").split("/")[0];
  return {
    type, title: title || source, description: type === "note" ? source : "", date, time, amount,
    currency: "RUB", category: /кофе|продукт|молоко|обед|ужин/i.test(source) ? "Еда" : /такси|метро|автобус/i.test(source) ? "Транспорт" : "Другое",
    accountId: data.finance.accounts.find(x => x.currency === "RUB")?.id || "", project: "", priority: /срочно|важно/i.test(source) ? "high" : "medium",
    url, tags: "", sectionId: "", listItems: type === "list" ? source.replace(/^.*?список\s*:?/i, "").split(/[,;]+/).map(x => x.trim()).filter(Boolean).join("\n") : "",
    servings: 1, ingredients: "", steps: "", year: "", director: "", where: "", store: "", address: type === "address" ? source : "", person: "", direction: "to-me", value: "", unit: "", repeat: "none", remindBefore: "none", reminderRepeat: "none", ticketType: /поезд|вагон/i.test(lower) ? "train" : /самол|рейс|аэропорт/i.test(lower) ? "flight" : "event", codeType: "qr", codeValue: "", include: true, uncertain
  };
}

function startCaptureReview(raw) {
  const source = String(raw || "").trim();
  if (!source) return false;
  const parts = source.split(/\n+|\s*;\s*/).map(x => x.trim()).filter(Boolean);
  ui.sheet = { kind: "batch", source, items: parts.map(captureGuess), justRendered: true, error: "" };
  render();
  return true;
}

function captureField(label, name, value, extra = "") {
  return `<label class="field">${label}<input name="${name}" value="${esc(value ?? "")}" ${extra}></label>`;
}
function captureTextArea(label, name, value, rows = 3) {
  return `<label class="field">${label}<textarea name="${name}" rows="${rows}">${esc(value ?? "")}</textarea></label>`;
}
function captureSelect(label, name, options, selected) {
  return `<label class="field">${label}<select name="${name}">${options.map(([value, text]) => `<option value="${esc(value)}" ${String(selected ?? "") === String(value) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
}
function captureTypeFields(item, i) {
  const n = key => `${key}-${i}`;
  const group = (types, html) => `<div class="capture-type-fields" data-capture-for="${types}" ${types.split(" ").includes(item.type) ? "" : "hidden"}>${html}</div>`;
  const section = category => captureSelect("Раздел", n("sectionId"), [["", "Без раздела"], ...(category === "addresses" ? mapCategories() : savedSections(category)).map(x => [x.id, x.name])], item.sectionId);
  return [
    group("task event", `<div class="field-row">${captureField("Дата", n("date"), item.date, 'type="date"')}${captureField("Время", n("time"), item.time, 'type="time"')}</div>${captureSelect("Проект", n("project"), [["", "Без проекта"], ...data.projects.map(x => [x.name, x.name])], item.project)}${captureSelect("Важность", n("priority"), [["medium", "Обычно"], ["high", "Очень важно"], ["low", "Когда-нибудь"]], item.priority)}<div class="entry-reminders"><h3>Повтор и напоминания</h3>${captureSelect("Повторять", n("repeat"), [["none","Не повторять"],["daily","Каждый день"],["weekdays","По будням"],["weekly","Каждую неделю"],["monthly","Каждый месяц"],["yearly","Каждый год"]], item.repeat)}<div class="field-row">${captureSelect("Напомнить", n("remindBefore"), [["none","Не напоминать"],["at","В момент начала"],["5m","За 5 минут"],["15m","За 15 минут"],["1h","За 1 час"],["1d","За 1 день"]], item.remindBefore)}${captureSelect("Повтор уведомления", n("reminderRepeat"), [["none","Без повтора"],["5m","Каждые 5 минут"],["15m","Каждые 15 минут"],["1h","Каждый час"]], item.reminderRepeat)}</div></div>`),
    group("expense income", `<div class="field-row">${captureField("Сумма", n("amount"), item.amount || "", 'type="number" min="0" step="0.01"')}${captureSelect("Валюта", n("currency"), [["RUB", "₽"], ["USD", "$"], ["EUR", "€"]], item.currency)}</div><div class="field-row">${captureField("Категория", n("category"), item.category)}${captureSelect("Счёт", n("accountId"), data.finance.accounts.map(x => [x.id, x.name]), item.accountId)}</div>${captureField("Дата", n("date"), item.date || todayIso(), 'type="date"')}`),
    group("debt", `<div class="field-row">${captureField("Человек", n("person"), item.person)}${captureField("Сумма", n("amount"), item.amount || "", 'type="number" min="0" step="0.01"')}</div>${captureSelect("Кто кому", n("direction"), [["to-me", "Должны мне"], ["i-owe", "Должен я"]], item.direction)}`),
    group("note", `${captureTextArea("Полный текст", n("description"), item.description || ui.sheet.source, 4)}${section("notes")}${captureField("Метки через запятую", n("tags"), item.tags)}`),
    group("post", `${captureTextArea("Текст поста", n("description"), item.description || ui.sheet.source, 4)}${section("posts")}${captureField("Метки через запятую", n("tags"), item.tags)}`),
    group("link", `${captureField("Ссылка", n("url"), item.url, 'type="url" placeholder="https://…"')}${captureTextArea("Описание", n("description"), item.description)}${section("links")}`),
    group("list", `${captureTextArea("Пункты, каждый с новой строки", n("listItems"), item.listItems, 4)}${section("lists")}`),
    group("recipe", `<div class="field-row">${captureField("Порций", n("servings"), item.servings, 'type="number" min="1"')}${section("recipes")}</div>${captureTextArea("Ингредиенты, каждый с новой строки", n("ingredients"), item.ingredients, 3)}${captureTextArea("Шаги приготовления", n("steps"), item.steps, 3)}`),
    group("movie", `<div class="field-row">${captureField("Год", n("year"), item.year, 'type="number" min="1888" max="2100"')}${section("movies")}</div>${captureField("Режиссёр", n("director"), item.director)}${captureField("Где посмотреть", n("where"), item.where)}`),
    group("product", `<div class="field-row">${captureField("Цена", n("amount"), item.amount || "", 'type="number" min="0" step="0.01"')}${section("products")}</div>${captureField("Магазин", n("store"), item.store)}${captureField("Ссылка", n("url"), item.url, 'type="url" placeholder="https://…"')}`),
    group("address", `${section("addresses")}${captureField("Адрес", n("address"), item.address)}${captureTextArea("Описание", n("description"), item.description)}`),
    group("metric", `<div class="field-row">${captureField("Значение", n("value"), item.value, 'type="number" step="any"')}${captureField("Единица", n("unit"), item.unit)}</div>${captureField("Дата", n("date"), item.date || todayIso(), 'type="date"')}`),
    group("file", `${captureTextArea("Описание файла", n("description"), item.description)}${section("files")}<p class="section-note">Файл можно прикрепить в карточке после сохранения.</p>`),
    group("ticket", `${captureSelect("Тип билета", n("ticketType"), [["event","Мероприятие"],["train","Поезд"],["flight","Самолёт"]], item.ticketType)}<div class="field-row">${captureField("Дата", n("date"), item.date, 'type="date"')}${captureField("Время", n("time"), item.time, 'type="time"')}</div>${captureField("Откуда", n("origin"), item.origin)}${captureField("Куда / место проведения", n("destination"), item.destination)}${captureField("Место", n("seat"), item.seat)}${captureField("Номер бронирования", n("reference"), item.reference)}<div class="field-row">${captureSelect("Формат кода", n("codeType"), [["qr","QR-код"],["barcode","Штрихкод"]], item.codeType)}${captureField("Значение кода", n("codeValue"), item.codeValue)}</div><p class="section-note">Файл и изображение кода можно прикрепить в карточке после сохранения.</p>`)
  ].join("");
}

function renderCaptureReview() {
  const items = ui.sheet.items || [];
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet capture-review-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Проверьте разбор</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><div class="capture-source"><span class="mini-heading">Исходное сообщение</span><p>${esc(ui.sheet.source)}</p><button type="button" data-action="capture-edit-source">Изменить текст</button></div><div class="capture-review-intro"><strong>${items.length} ${word(items.length, "предложенная запись", "предложенные записи", "предложенных записей")}</strong><span>Исправьте тип и детали до сохранения.</span></div><form id="batch-form" class="capture-review-form">${ui.sheet.error ? `<p class="form-error" role="alert">${esc(ui.sheet.error)}</p>` : ""}${items.map((item, i) => `<article class="capture-card" data-capture-index="${i}"><div class="capture-card-head"><span class="capture-card-index">${String(i + 1).padStart(2, "0")}</span><strong>${esc(CAPTURE_TYPES.find(([key]) => key === item.type)?.[1] || "Запись")}</strong><button type="button" data-action="capture-remove-row" data-index="${i}" aria-label="Убрать запись ${i + 1}">${icon("close", "icon-sm")}</button></div>${item.uncertain ? `<p class="capture-uncertain">Проверьте тип: по тексту нельзя определить его уверенно.</p>` : ""}<div class="capture-card-fields">${captureSelect("Тип записи", `type-${i}`, CAPTURE_TYPES, item.type)}${captureField("Название", `title-${i}`, item.title, 'type="text" maxlength="150" required')}${captureTypeFields(item, i)}</div></article>`).join("")}<button class="capture-add-row" type="button" data-action="capture-add-row">${icon("plus", "icon-sm")}Добавить пропущенную запись</button><div class="capture-review-actions"><button class="ghost-button" type="button" data-action="capture-edit-source">Назад к тексту</button><button class="primary-button" type="submit" ${items.length ? "" : "disabled"}>Сохранить проверенное</button></div></form></section></div>`;
}

function captureDraftFromForm() {
  const form = document.getElementById("batch-form");
  if (!form || ui.sheet?.kind !== "batch") return;
  ui.sheet.items = ui.sheet.items.map((item, i) => {
    const next = { ...item };
    for (const key of ["type", "title", "description", "date", "time", "amount", "currency", "category", "accountId", "project", "priority", "repeat", "remindBefore", "reminderRepeat", "url", "tags", "sectionId", "listItems", "servings", "ingredients", "steps", "year", "director", "where", "store", "address", "person", "direction", "value", "unit", "ticketType", "origin", "destination", "seat", "reference", "codeType", "codeValue"]) {
      const fields = [...form.querySelectorAll(`[name="${key}-${i}"]`)];
      const visible = fields.find(field => !field.closest(".capture-type-fields")?.hidden);
      if (visible) next[key] = visible.value;
    }
    return next;
  });
}

function captureAction(action, control) {
  if (action === "capture-example") {
    const samples = ["Завтра в 12:00 забрать заказ", "Кофе 350 ₽", "Сохрани рецепт лимонного пирога"];
    const input = document.getElementById("capture-text");
    if (input) { input.value = samples[Number(control.dataset.example)] || ""; input.focus(); }
    return true;
  }
  if (action === "capture-edit-source" && ui.sheet?.kind === "batch") { ui.sheet = { kind: "addmenu", draft: ui.sheet.source, justRendered: false }; render(); return true; }
  if (action === "capture-add-row" && ui.sheet?.kind === "batch") { captureDraftFromForm(); ui.sheet.items.push({ ...captureGuess("Новая запись"), title: "", uncertain: true }); ui.sheet.error = ""; render(); return true; }
  if (action === "capture-remove-row" && ui.sheet?.kind === "batch") { captureDraftFromForm(); ui.sheet.items.splice(Number(control.dataset.index), 1); ui.sheet.error = ""; render(); return true; }
  if (action === "capture-again") { ui.sheet = { kind: "addmenu", draft: "", justRendered: false }; render(); return true; }
  if (action === "capture-open" && ui.sheet?.kind === "capture-done") { openSearchResult(control.dataset.type, control.dataset.id); return true; }
  return false;
}

function captureChange(event) {
  if (!event.target.matches(".capture-card select[name^='type-']")) return false;
  const card = event.target.closest(".capture-card");
  const type = event.target.value;
  card.querySelector(".capture-card-head strong").textContent = CAPTURE_TYPES.find(([key]) => key === type)?.[1] || "Запись";
  card.querySelectorAll("[data-capture-for]").forEach(group => { group.hidden = !group.dataset.captureFor.split(" ").includes(type); });
  card.querySelector(".capture-uncertain")?.remove();
  return true;
}

function captureSavedItem(type, item, source) {
  const category = CAPTURE_SAVED[type];
  const section = type === "address" ? mapCategory(item.sectionId) : savedSection(category, item.sectionId);
  const base = { id: id(), title: item.title.trim(), description: String(item.description || "").trim(), topic: section?.name || "", categoryId: item.sectionId || "", tags: String(item.tags || "").split(",").map(x => x.trim()).filter(Boolean), viewed: false, pinned: false, source: "Добавлено вручную", sourceText: source, created: todayIso() };
  if (type === "link") base.url = item.url || "";
  if (type === "list") base.items = String(item.listItems || "").split("\n").map(x => x.trim()).filter(Boolean).map(text => ({ id: id(), text, done: false }));
  if (type === "recipe") { base.servings = Math.max(1, Number(item.servings) || 1); base.ingredients = String(item.ingredients || "").split("\n").map(x => x.trim()).filter(Boolean); base.steps = String(item.steps || "").split("\n").map(x => x.trim()).filter(Boolean); }
  if (type === "movie") { base.year = Number(item.year) || 0; base.director = item.director || ""; base.where = item.where || ""; base.status = "Хочу посмотреть"; }
  if (type === "product") { base.price = Math.max(0, Number(item.amount) || 0); base.store = item.store || ""; base.url = item.url || ""; }
  if (type === "address") base.address = item.address || "";
  if (type === "file") base.fileName = item.title;
  if (type === "ticket") { base.ticketType = item.ticketType || "event"; base.eventDate = item.date || ""; base.eventTime = item.time || ""; base.origin = item.origin || ""; base.destination = base.ticketType === "event" ? "" : item.destination || ""; base.venue = base.ticketType === "event" ? item.destination || "" : ""; base.seat = item.seat || ""; base.reference = item.reference || ""; base.codeType = item.codeType || "qr"; base.codeValue = item.codeValue || ""; if (!base.categoryId) { base.categoryId = { event: "events", train: "trains", flight: "flights" }[base.ticketType] || ""; base.topic = savedSection("tickets", base.categoryId)?.name || ""; } }
  (category === "notes" ? data.notes : data.saved[category]).unshift(base);
  return { type: `saved:${category}`, id: base.id, title: base.title };
}

function submitCaptureReview(event) {
  event.preventDefault();
  if (ui.sheet?.kind !== "batch") return true;
  captureDraftFromForm();
  const items = ui.sheet.items;
  if (!items.length) { ui.sheet.error = "Добавьте хотя бы одну запись."; render(); return true; }
  const invalid = items.findIndex(x => !String(x.title || "").trim() || (["expense", "income", "debt"].includes(x.type) && !(Number(x.amount) > 0)) || (x.type === "link" && x.url && !/^https?:\/\//i.test(x.url)));
  if (invalid >= 0) { ui.sheet.error = `Проверьте запись ${invalid + 1}: заполните название, сумму или ссылку.`; render(); return true; }
  const source = ui.sheet.source;
  const created = [];
  for (const item of items) {
    let record;
    if (item.type in CAPTURE_SAVED) record = captureSavedItem(item.type, item, source);
    else if (item.type === "task") { const task = { id: id(), title: item.title.trim(), description: item.description || "", due: item.date || "", time: item.time || "", priority: item.priority || "medium", project: item.project || "Личное", repeat: item.repeat || "none", remindBefore: item.remindBefore || "none", reminderRepeat: item.reminderRepeat || "none", done: false, sourceText: source }; data.tasks.push(task); record = { type: "task", id: task.id, title: task.title }; }
    else if (item.type === "event") { const entry = { id: id(), title: item.title.trim(), description: item.description || "", due: item.date || todayIso(), time: item.time || "", project: item.project || "", repeat: item.repeat || "none", remindBefore: item.remindBefore || "none", reminderRepeat: item.reminderRepeat || "none", sourceText: source }; data.events.push(entry); record = { type: "event", id: entry.id, title: entry.title }; }
    else if (["expense", "income"].includes(item.type)) { const entry = { id: id(), title: item.title.trim(), kind: item.type, amount: Number(item.amount), currency: item.currency || "RUB", category: item.category || "Другое", accountId: item.accountId || data.finance.accounts[0]?.id, date: item.date || todayIso(), project: item.project || "", manual: true, sourceText: source }; data.finance.transactions.unshift(entry); record = { type: "finance:transaction", id: entry.id, title: entry.title }; }
    else if (item.type === "debt") { const entry = { id: id(), person: item.person || item.title.trim(), direction: item.direction || "to-me", amount: Number(item.amount), paid: 0, note: item.description || "", sourceText: source }; data.finance.debts.push(entry); record = { type: "finance:debt", id: entry.id, title: item.title.trim() }; }
    else if (item.type === "metric") { const entry = { id: id(), title: item.title.trim(), value: Number(item.value) || 0, unit: item.unit || "", date: item.date || todayIso(), sourceText: source }; data.metrics.push(entry); record = { type: "metric", id: entry.id, title: entry.title }; }
    if (record) created.push(record);
  }
  save();
  ui.sheet = { kind: "capture-done", created, justRendered: true };
  render();
  return true;
}

function renderCaptureDone() {
  const rows = ui.sheet.created || [];
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet capture-done-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Записи сохранены</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><div class="capture-done-mark">${icon("check", "icon-lg")}</div><p>${rows.length} ${word(rows.length, "запись добавлена", "записи добавлены", "записей добавлено")} . Откройте карточку, чтобы проверить.</p><div class="capture-done-list">${rows.map(row => `<button type="button" data-action="capture-open" data-type="${esc(row.type)}" data-id="${esc(row.id)}"><span>${esc(row.title)}</span>${icon("right", "icon-sm")}</button>`).join("")}</div><div class="sheet-actions"><button type="button" class="ghost-button" data-action="close-sheet">Закрыть</button><button type="button" class="primary-button" data-action="capture-again">Разобрать ещё</button></div></section></div>`;
}
