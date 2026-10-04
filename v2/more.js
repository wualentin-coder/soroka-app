function pushTrash(type, item) {
  data.trash.push({ id: id(), type, item: JSON.parse(JSON.stringify(item)), deletedAt: todayIso() });
}
function downloadText(name, content, mime = "application/json;charset=utf-8") {
  const blob = new Blob(["\uFEFF", content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function subtabButtons(items, selected, action, key = "filter") {
  return `<div class="subtabs">${items.map(([value, label]) => `<button type="button" class="${selected === value ? "active" : ""}" data-action="${action}" data-${key}="${value}">${label}</button>`).join("")}</div>`;
}
function renderTasksPage() {
  ui.tasksFilter ||= "all";
  const filters = [["all", "Все"], ["overdue", "Просрочено"], ["upcoming", "С датой"], ["undated", "Без даты"]];
  const tasks = openTasks().filter(t => ui.tasksFilter === "overdue" ? t.due && t.due < todayIso() : ui.tasksFilter === "upcoming" ? t.due && t.due >= todayIso() : ui.tasksFilter === "undated" ? !t.due : true).sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999") || (a.time || "99:99").localeCompare(b.time || "99:99"));
  const upcomingEvents = data.events.filter(e => e.due >= todayIso()).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4);
  return `${header("Дела", "Все открытые задачи, в том числе без срока", "План")}${subtabButtons(filters, ui.tasksFilter, "tasks-filter")}<div class="content-grid"><div class="content-main"><div class="section-heading"><h2>${ui.tasksFilter === "all" ? "Открытые задачи" : filters.find(([key]) => key === ui.tasksFilter)?.[1]}</h2><button class="text-action" type="button" data-action="tasks-add">Добавить ${icon("plus", "icon-sm")}</button></div><div class="task-stack">${tasks.length ? tasks.map(taskCard).join("") : emptyCard("Здесь пока пусто", "Добавьте дело или выберите другой фильтр.")}</div>${cardSection("Ближайшие события", upcomingEvents.length ? upcomingEvents.map(eventCard).join("") : emptyCard("Событий нет", "Добавьте встречу через кнопку ниже."))}</div><aside class="content-aside"><div class="side-card"><h3>Проекты</h3>${data.projects.filter(p => p.status === "Активен").map(p => `<div class="side-row"><span>${esc(p.name)}</span><b>${data.tasks.filter(t => !t.done && t.project === p.name).length} дел</b></div>`).join("")}<button class="text-action" type="button" data-action="navigate" data-page="projects">Открыть проекты ${icon("arrow", "icon-sm")}</button></div></aside></div>`;
}
function inboxEntries() {
  const items = data.inbox.map(item => ({ key: "message", id: item.id, title: item.title, subtitle: `${item.type} · ${item.detail}`, group: item.type === "Сообщение" ? "unclear" : item.type === "Дубликат" ? "duplicates" : "uncategorized", icon: item.type === "Ссылка" ? "link" : "inbox" }));
  data.finance.payments.filter(p => p.status === "pending").forEach(p => items.push({ key: "payment", id: p.id, title: p.title, subtitle: `Ожидает подтверждения · ${demoMoney(p.amount)}`, group: "payments", icon: "wallet" }));
  overdueTasks().forEach(t => items.push({ key: "task", id: t.id, title: t.title, subtitle: `Просрочено · ${dateLabel(t.due)}`, group: "overdue", icon: "today" }));
  return items;
}
function renderInboxPage() {
  const filters = [["all", "Все"], ["unclear", "Уточнить"], ["payments", "Платежи"], ["overdue", "Просрочено"], ["uncategorized", "Без раздела"], ["duplicates", "Дубли"]];
  const list = inboxEntries().filter(x => ui.inboxFilter === "all" || x.group === ui.inboxFilter);
  const row = entry => {
    const controls = entry.key === "payment" ? miniButton("Списалось", "payment-confirm", `data-id="${esc(entry.id)}"`) : entry.key === "task" ? miniButton("Открыть", "inbox-open-task", `data-id="${esc(entry.id)}"`) : `${miniButton("В дела", "inbox-task", `data-id="${esc(entry.id)}"`)}<button class="icon-button" type="button" data-action="inbox-save" data-id="${esc(entry.id)}" aria-label="Сохранить в библиотеку">${icon("bookmark", "icon-sm")}</button>`;
    return `<div class="list-row"><span class="list-icon">${icon(entry.icon)}</span><span class="list-copy"><strong>${esc(entry.title)}</strong><span>${esc(entry.subtitle)}</span></span>${controls}</div>`;
  };
  return `${header("Входящие", "Всё, что ещё требует решения", "Разобрать")}${subtabButtons(filters, ui.inboxFilter, "inbox-filter")}<div class="content-grid"><div class="content-main"><div class="overview-intro"><span class="mini-heading">Центр внимания</span><p>Неразобранные сообщения, платежи и просроченные дела собраны рядом. Можно превратить сообщение в задачу или материал.</p></div><div class="section-heading"><h2>${ui.inboxFilter === "all" ? "Ждут решения" : filters.find(([key]) => key === ui.inboxFilter)?.[1]}</h2><span class="count">${list.length}</span></div>${list.length ? `<div class="list-panel">${list.map(row).join("")}</div>` : emptyCard("Всё разобрано", "Здесь появятся новые записи из чата.")}</div><aside class="content-aside"><div class="side-card"><h3>Сейчас</h3>${filters.slice(1).map(([key, label]) => `<div class="side-row"><span>${label}</span><b>${inboxEntries().filter(x => x.group === key).length}</b></div>`).join("")}</div></aside></div>`;
}
function overviewBlocks() {
  const nextEvent = data.events.filter(e => e.due >= todayIso()).sort((a, b) => `${a.due}${a.time}`.localeCompare(`${b.due}${b.time}`))[0];
  const topTasks = openTasks().slice().sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] || 2) - ({ high: 0, medium: 1, low: 2 }[b.priority] || 2)).slice(0, 3);
  const pending = data.finance.payments.filter(p => p.status === "pending");
  const unread = ["files", "posts", "links"].flatMap(key => data.saved[key]).filter(x => !x.viewed);
  const last = ui.lastOpened || { category: "notes", id: data.notes[0]?.id, title: data.notes[0]?.title || "" };
  const blocks = {
    next: `<div class="mosaic-card wide"><small>Ближайшее событие</small><strong>${nextEvent ? esc(nextEvent.title) : "Свободное время"}</strong><p>${nextEvent ? `${esc(dateLabel(nextEvent.due))} · ${esc(nextEvent.time || "весь день")}` : "Можно добавить встречу в календарь."}</p><button class="text-action" type="button" data-action="navigate" data-page="upcoming">Открыть календарь ${icon("arrow", "icon-sm")}</button></div>`,
    tasks: `<div class="mosaic-card wide"><small>Главные задачи</small>${topTasks.map(t => `<div class="side-row"><span>${esc(t.title)}</span><b>${esc(dateLabel(t.due))}</b></div>`).join("") || `<p>Задач нет.</p>`}<button class="text-action" type="button" data-action="navigate" data-page="today">Мой день ${icon("arrow", "icon-sm")}</button></div>`,
    money: `<div class="mosaic-card"><small>Доступно</small><strong>${demoMoney(rubBalance())}</strong><p>На рублёвых счетах</p><button class="text-action" type="button" data-action="navigate" data-page="finance">Финансы</button></div>`,
    payments: `<div class="mosaic-card"><small>Платежи</small><strong>${pending.length} ждёт</strong><p>${pending[0] ? esc(pending[0].title) : "Всё подтверждено"}</p><button class="text-action" type="button" data-action="navigate" data-page="finance">Посмотреть</button></div>`,
    saved: `<div class="mosaic-card"><small>Материалы</small><strong>${unread.length} не просмотрено</strong><p>Ссылки, посты и файлы</p><button class="text-action" type="button" data-action="navigate" data-page="saved">Продолжить</button></div>`,
    continue: `<div class="mosaic-card"><small>Продолжить</small><strong>${esc(last.title || "Заметки")}</strong><p>Последняя открытая запись</p><button class="text-action" type="button" data-action="overview-continue">Открыть</button></div>`,
    weekly: `<div class="mosaic-card wide"><small>Неделя в Сороке</small><strong>${data.tasks.filter(t => t.done).length} задач завершено · ${data.saved.links.length + data.saved.posts.length} материала сохранено</strong><p>Бот пришлёт недельный обзор в Telegram. Здесь показан его дизайн.</p></div>`
  };
  return blocks;
}
function renderOverviewPage() {
  const blocks = overviewBlocks();
  const order = data.settings.overviewOrder || ["next", "tasks", "money", "payments", "saved", "continue", "weekly"];
  const visible = order.filter(key => !data.settings.overviewHidden.includes(key));
  return `${header("Обзор", "Задачи, события и сохранённое за день", "Сорока")}<div class="content-grid"><div class="content-main"><div class="quick-capture"><input id="overview-quick" type="text" placeholder="Запишите мысль или задачу…" aria-label="Быстрый ввод"><button type="button" data-action="overview-capture">Добавить</button></div><div class="overview-mosaic">${visible.map(key => blocks[key]).join("") || emptyCard("Блоки скрыты", "Включите нужные блоки в настройках.")}</div><button class="text-action" type="button" data-action="navigate" data-page="settings">Настроить обзор ${icon("arrow", "icon-sm")}</button></div><aside class="content-aside"><div class="side-card"><h3>Как устроен обзор</h3><p class="side-note">Задачи, деньги, материалы и события доступны из одного пространства. Порядок карточек можно менять в настройках.</p></div></aside></div>`;
}
function projectMatches(project) {
  const name = project.name;
  return {
    tasks: data.tasks.filter(t => t.project === name),
    events: data.events.filter(e => e.project === name),
    notes: data.notes.filter(n => n.project === name || n.topic === name),
    materials: SAVED_CATEGORIES.filter(([key]) => key !== "notes").flatMap(([key]) => data.saved[key].filter(x => x.project === name || x.topic === name).map(item => ({ ...item, category: key }))),
    transactions: data.finance.transactions.filter(t => t.project === name)
  };
}
function renderProjectsPage() {
  const selected = data.projects.find(p => p.id === ui.projectId);
  if (!selected) return `${header("Проекты", "Задачи, материалы и расходы по одной теме", "Пространства")}<div class="section-heading"><h2>Активные проекты</h2><button class="text-action" type="button" data-action="project-new">Добавить ${icon("plus", "icon-sm")}</button></div>${data.projects.map(p => { const matches = projectMatches(p); return `<button class="project-card" type="button" data-action="project-open" data-id="${esc(p.id)}"><i class="project-dot" style="background:${esc(p.color || "var(--accent)")}"></i><span class="list-copy"><strong>${esc(p.name)}</strong><span>${esc(p.description)}</span><span class="project-count">${matches.tasks.filter(t => !t.done).length} задач · ${matches.materials.length + matches.notes.length} материалов · ${matches.transactions.length} операций</span></span>${icon("right", "icon-sm")}</button>`; }).join("")}`;
  const matches = projectMatches(selected);
  const entries = [
    ...matches.tasks.map(t => ({ date: t.due || todayIso(), title: t.title, meta: "Задача", action: "project-task", id: t.id })),
    ...matches.events.map(e => ({ date: e.due, title: e.title, meta: "Событие", action: "project-event", id: e.id })),
    ...matches.notes.map(n => ({ date: n.created || todayIso(), title: n.title, meta: "Заметка", action: "project-note", id: n.id })),
    ...matches.materials.map(m => ({ date: m.created || todayIso(), title: m.title, meta: SAVED_NAMES[m.category], action: "project-saved", id: m.id, category: m.category })),
    ...matches.transactions.map(t => ({ date: t.date, title: t.title, meta: demoMoney(t.amount), action: "project-transaction", id: t.id }))
  ].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return `${header(esc(selected.name), esc(selected.description), "Проект")}<div class="inline-actions"><button type="button" data-action="project-back">${icon("left")}Все проекты</button><button type="button" data-action="project-edit" data-id="${esc(selected.id)}">${icon("note")}Изменить</button></div><div class="kpi-grid section"><div class="kpi"><span class="kpi-label">Задачи</span><span class="kpi-value">${matches.tasks.filter(t => !t.done).length}</span></div><div class="kpi"><span class="kpi-label">Материалы</span><span class="kpi-value">${matches.materials.length + matches.notes.length}</span></div><div class="kpi"><span class="kpi-label">Расходы</span><span class="kpi-value">${demoMoney(matches.transactions.filter(t => t.kind === "expense").reduce((sum, t) => sum + t.amount, 0))}</span></div></div><div class="content-grid"><div class="content-main">${cardSection("Лента проекта", entries.length ? `<div class="list-panel">${entries.map(e => `<button class="finance-row finance-row-button" type="button" data-action="${e.action}" data-id="${esc(e.id)}" ${e.category ? `data-category="${e.category}"` : ""}><span class="list-copy"><strong>${esc(e.title)}</strong><span>${esc(e.meta)} · ${esc(dateLabel(e.date))}</span></span>${icon("right", "icon-sm")}</button>`).join("")}</div>` : emptyCard("Записей нет", "Привяжите запись к проекту."))}</div><aside class="content-aside"><div class="side-card"><h3>Сводка</h3><p class="side-note">В проекте ${matches.tasks.filter(t => !t.done).length} открытых задач. Ближайшее действие — ${esc(matches.tasks.find(t => !t.done)?.title || "добавить первую задачу")}.</p></div></aside></div>`;
}
function renderProjectSheet() {
  const project = ui.sheet.id ? data.projects.find(p => p.id === ui.sheet.id) : null;
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${project ? "Проект" : "Новый проект"}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><form id="project-form"><label class="field">Название<input name="name" type="text" value="${esc(project?.name || "")}" required autofocus></label><label class="field">Описание<textarea name="description">${esc(project?.description || "")}</textarea></label><div class="field-row"><label class="field">Статус<select name="status"><option ${project?.status === "Активен" ? "selected" : ""}>Активен</option><option ${project?.status === "На паузе" ? "selected" : ""}>На паузе</option><option ${project?.status === "Завершён" ? "selected" : ""}>Завершён</option></select></label><label class="field">Цвет<input name="color" type="color" value="${esc(project?.color || "#58d0cf")}"></label></div><div class="sheet-actions">${project ? `<button class="ghost-button danger-button" type="button" data-action="project-delete">Удалить</button>` : ""}<button class="primary-button" type="submit">Сохранить</button></div></form></section></div>`;
}

let vaultTimer = null;
function vaultVisible(idValue) { return ui.vaultShown?.id === idValue && ui.vaultShown.until > Date.now(); }
function hideVaultSecret() { ui.vaultShown = null; clearTimeout(vaultTimer); if (ui.page === "vault" || ui.sheet?.kind === "vault") render(); }
function renderVaultPage() {
  if (!ui.vaultUnlocked) return `<button class="notes-back vault-back" type="button" data-action="navigate" data-page="saved">${icon("left", "icon-sm")}Сохранённое</button>${header("Пароли", "Отдельное пространство для учётных записей", "Хранилище")}<div class="state-card"><div class="list-icon" style="margin:0 auto 14px">${icon("key")}</div>${window.SOROKA_LIVE ? `<h2>Открыть пароли</h2><p>Пароли лежат в зашифрованном хранилище. Доступ — пять минут после открытия приложения из Telegram.</p><button class="primary-button" type="button" data-action="vault-unlock">Открыть</button></div>` : `<h2>Открыть пароли</h2><p>Пароли открываются отдельно от остальных записей.</p><button class="primary-button" type="button" data-action="vault-unlock">Открыть</button></div>`}`;
  const q = ui.vaultQuery.trim().toLowerCase();
  const entries = data.vault.filter(v => v.service.toLowerCase().includes(q));
  return `<button class="notes-back vault-back" type="button" data-action="navigate" data-page="saved">${icon("left", "icon-sm")}Сохранённое</button>${header("Пароли", "Быстрый доступ к нужному сервису", "Хранилище")}<div class="section-toolbar"><input id="vault-search" class="filter-input" type="search" placeholder="Найти сервис…" value="${esc(ui.vaultQuery)}" aria-label="Поиск сервиса"><button class="tool-button" type="button" data-action="vault-lock">${icon("key")}Закрыть</button></div><div id="vault-results" class="section">${entries.length ? entries.map(v => `<div class="budget-card"><div class="section-heading"><h2>${esc(v.service)}</h2><button class="text-action" type="button" data-action="vault-edit" data-id="${esc(v.id)}">Изменить</button></div><div class="side-row"><span>Логин</span><b>${esc(v.login)}</b></div><div class="vault-secret"><span>${vaultVisible(v.id) ? esc(v.password) : "••••••••••••"}</span><button class="icon-button" type="button" data-action="vault-reveal" data-id="${esc(v.id)}" aria-label="${vaultVisible(v.id) ? "Скрыть" : "Показать"} пароль">${icon(vaultVisible(v.id) ? "eyeOff" : "eye", "icon-sm")}</button></div><div class="inline-actions"><button type="button" data-action="vault-copy" data-field="login" data-id="${esc(v.id)}">${icon("copy")}Логин</button><button type="button" data-action="vault-copy" data-field="password" data-id="${esc(v.id)}">${icon("copy")}Пароль</button></div>${v.note ? `<p class="section-note">${esc(v.note)}</p>` : ""}</div>`).join("") : emptyCard("Сервис не найден", "Попробуйте другое название.")}</div><button class="text-action" type="button" data-action="vault-new">Добавить сервис ${icon("plus", "icon-sm")}</button>`;
}
function renderVaultSheet() {
  const item = ui.sheet.id ? data.vault.find(v => v.id === ui.sheet.id) : null;
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${item ? "Изменить сервис" : "Новый сервис"}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><p class="section-note">Пароль шифруется и хранится отдельно от остальных записей.</p><form id="vault-form"><label class="field">Сервис<input name="service" type="text" value="${esc(item?.service || "")}" required autofocus></label><label class="field">Логин<input name="login" type="text" value="${esc(item?.login || "")}" required></label><label class="field">Пароль<input name="password" type="password" value="${esc(item?.password || "")}" required autocomplete="new-password"></label><label class="field">Заметка без секрета<textarea name="note">${esc(item?.note || "")}</textarea></label><div class="sheet-actions">${item ? `<button class="ghost-button danger-button" type="button" data-action="vault-delete">Удалить навсегда</button>` : ""}<button class="primary-button" type="submit">Сохранить на время сеанса</button></div></form></section></div>`;
}

function renderMetricsPage() {
  const latest = data.metrics.slice().sort((a, b) => b.date.localeCompare(a.date));
  const max = Math.max(1, ...latest.map(m => Number(m.value || 0)));
  return `${header("Показатели", "Личные измерения по датам", "Метрики")}<div class="section-heading"><h2>Записи</h2><button class="text-action" type="button" data-action="metric-new">Добавить ${icon("plus", "icon-sm")}</button></div><div class="side-card"><h3>Сон · последние записи</h3><div class="bar-chart">${latest.slice(0, 7).reverse().map(m => `<span><i style="height:${Math.max(5, Number(m.value || 0) / max * 100)}%"></i></span>`).join("")}</div><p class="section-note">График собран из тестовых значений.</p></div><div class="list-panel section">${latest.map(m => `<button class="finance-row finance-row-button" type="button" data-action="metric-edit" data-id="${esc(m.id)}"><span class="list-copy"><strong>${esc(m.title)}</strong><span>${esc(dateLabel(m.date))}</span></span><span class="amount">${esc(m.value)} ${esc(m.unit)}</span></button>`).join("") || `<div class="empty-card"><strong>Записей нет</strong>Добавьте показатель.</div>`}</div>`;
}
function renderMetricSheet() {
  const item = ui.sheet.id ? data.metrics.find(m => m.id === ui.sheet.id) : null;
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Показатель</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><form id="metric-form"><label class="field">Название<input name="title" type="text" value="${esc(item?.title || "Сон")}" required autofocus></label><div class="field-row"><label class="field">Значение<input name="value" type="number" step="0.1" value="${esc(item?.value || "")}" required></label><label class="field">Единица<input name="unit" type="text" value="${esc(item?.unit || "ч")}" required></label></div><label class="field">Дата<input name="date" type="date" value="${esc(item?.date || todayIso())}" required></label><div class="sheet-actions">${item ? `<button class="ghost-button danger-button" type="button" data-action="metric-delete">Удалить</button>` : ""}<button class="primary-button" type="submit">Сохранить</button></div></form></section></div>`;
}
function renderArchivePage() {
  const tabs = [["trash", "Корзина"], ["completed", "Завершённые"], ["past", "Прошедшие"], ["viewed", "Просмотренные"]];
  let content = "";
  if (ui.archiveTab === "trash") {
    content = data.trash.length ? `<div class="list-panel">${data.trash.slice().reverse().map(entry => `<div class="list-row"><span class="list-icon">${icon("trash")}</span><span class="list-copy"><strong>${esc(entry.item.title || entry.item.name || entry.item.person || "Запись")}</strong><span>${esc(entry.type)} · удалено ${esc(dateLabel(entry.deletedAt))}</span></span><button class="small-button" type="button" data-action="archive-restore" data-id="${esc(entry.id)}">Вернуть</button><button class="icon-button" type="button" data-action="archive-purge" data-id="${esc(entry.id)}" aria-label="Удалить навсегда">${icon("close", "icon-sm")}</button></div>`).join("")}</div>` : emptyCard("Корзина пуста", "Удалённые записи появятся здесь на 30 дней в рабочем приложении.");
  } else if (ui.archiveTab === "completed") {
    const done = data.tasks.filter(t => t.done);
    content = done.length ? `<div class="task-stack">${done.map(taskCard).join("")}</div>` : emptyCard("Завершённых задач пока нет", "Отметьте задачу на экране «Сегодня».");
  } else if (ui.archiveTab === "past") {
    const past = data.events.filter(e => e.due < todayIso() || e.due === todayIso() && e.time && e.time < new Date().toTimeString().slice(0, 5)).sort((a, b) => b.due.localeCompare(a.due));
    content = past.length ? `<div class="task-stack">${past.map(eventCard).join("")}</div>` : emptyCard("Прошедших событий нет", "После времени события оно появится здесь.");
  } else {
    const viewed = SAVED_CATEGORIES.filter(([category]) => !["notes", "lists"].includes(category)).flatMap(([category]) => data.saved[category].filter(x => x.viewed).map(item => ({ category, item })));
    content = viewed.length ? `<div class="record-list">${viewed.map(({ category, item }) => savedRecordCard(item, category)).join("")}</div>` : emptyCard("Просмотренных материалов пока нет", "Отметьте материал в библиотеке.");
  }
  return `${header("Архив и корзина", "Завершённое рядом, удалённое можно вернуть", "История")}${subtabButtons(tabs, ui.archiveTab, "archive-tab", "tab")}<div class="content-grid"><div class="content-main"><button class="tool-button" type="button" data-action="archive-random">${icon("bookmark")}Случайное из сохранённого</button><div class="section">${content}</div></div><aside class="content-aside"><div class="side-card"><h3>Хранение</h3><p class="side-note">Удалённое хранится в корзине 30 дней, потом стирается само.</p></div></aside></div>`;
}
function overviewBlockSettings() {
  const labels = { next: "Ближайшее событие", tasks: "Главные задачи", money: "Доступные деньги", payments: "Платежи", saved: "Материалы", continue: "Продолжить", weekly: "Недельная сводка" };
  const order = data.settings.overviewOrder || Object.keys(labels);
  return order.map((key, index) => `<div class="settings-row"><div><strong>${labels[key]}</strong><span>${data.settings.overviewHidden.includes(key) ? "Скрыт" : "Показан"}</span></div><div class="toolbar-right"><button class="icon-button" type="button" data-action="overview-block-up" data-key="${key}" ${index === 0 ? "disabled" : ""} aria-label="Переместить выше">${icon("up", "icon-sm")}</button><button class="icon-button" type="button" data-action="overview-block-down" data-key="${key}" ${index === order.length - 1 ? "disabled" : ""} aria-label="Переместить ниже">${icon("down", "icon-sm")}</button><input type="checkbox" data-setting="overview-block" data-key="${key}" ${data.settings.overviewHidden.includes(key) ? "" : "checked"} aria-label="Показывать ${labels[key]}"></div></div>`).join("");
}
function renderSettingsPage() {
  const s = data.settings;
  const row = (title, hint, control) => `<div class="settings-row"><div><strong>${title}</strong><span>${hint}</span></div>${control}</div>`;
  const select = (setting, value, options) => `<select data-setting="${setting}">${options.map(([key, label]) => `<option value="${key}" ${String(value) === String(key) ? "selected" : ""}>${label}</option>`).join("")}</select>`;
  const accents = `<div class="accent-swatches" role="radiogroup" aria-label="Акцент">${ACCENTS.map(([key, label, color]) => `<label class="accent-swatch" title="${label}"><input type="radio" name="accent" data-setting="accent" value="${key}" ${(s.accent || "teal") === key ? "checked" : ""} aria-label="${label}"><span style="--swatch:${color}"></span></label>`).join("")}</div>`;
  const router = s.openRouter;
  const money = value => `${Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} $`;
  const routerRows = router ? `<div class="side-row"><span>Осталось</span><b>${money(router.left)}</b></div><div class="side-row"><span>Потрачено за сутки</span><b>${money(router.today || 0)}</b></div><div class="side-row"><span>Потрачено за неделю</span><b>${money(router.week)}</b></div><div class="side-row"><span>Хватит</span><b>${router.weeksLeft === null ? "расхода не было" : `≈ ${router.weeksLeft} нед.`}</b></div>` : `<div class="side-row"><span>OpenRouter</span><b>${window.SOROKA_LIVE ? "не ответил" : "не подключён"}</b></div>`;
  return `${header("Настройки", "Подстройте пространство под себя", "Сорока")}<div class="content-grid"><div class="content-main">
<section class="settings-group"><h2>Внешний вид</h2><div class="list-panel">
${row("Тема", "Фон и карточки", select("theme", ui.theme, Object.entries(THEMES).filter(([key]) => key !== "telegram" || window.SOROKA_LIVE).map(([key, t]) => [key, t.label])))}
<div class="settings-row settings-row-wide"><div><strong>Акцент</strong><span>Цвет кнопок и выделения</span></div>${accents}</div>
${row("Плотность", "Размер карточек", select("density", s.density, [["comfortable", "Комфортная"], ["compact", "Компактная"]]))}
${row("Стартовый экран", "Что открывать первым", select("startPage", s.startPage, [["today", "Сегодня"], ["overview", "Обзор"], ["saved", "Сохранённое"], ["finance", "Финансы"]]))}
</div></section>
<section class="settings-group"><h2>Главный экран</h2><div class="list-panel">${overviewBlockSettings()}</div></section>
<section class="settings-group"><h2>Бот</h2><div class="list-panel">
${row("Контекст диалога", "Сколько последних сообщений бот учитывает", select("context", s.context, [[5, "5"], [10, "10"], [20, "20"]]))}
${row("Утренняя сводка", "Когда бот присылает план дня", `<input data-setting="digest" type="time" value="${esc(s.digest || "08:30")}">`)}
${row("Вечерняя сводка", "Итоги дня", `<input data-setting="digestEvening" type="time" value="${esc(s.digestEvening || "21:00")}">`)}
${row("Тихие часы", "Бот не беспокоит, кроме срочного", `<span class="settings-range"><input data-setting="quietFrom" type="time" value="${esc(s.quietFrom || "23:00")}" aria-label="С"><span>–</span><input data-setting="quietTo" type="time" value="${esc(s.quietTo || "08:00")}" aria-label="До"></span>`)}
${row("Google Календарь", s.gcal ? "События уходят в календарь сами" : "Подключается в боте: команда /calendar", `<b class="settings-status ${s.gcal ? "ok" : ""}">${s.gcal ? "Подключён" : "Не подключён"}</b>`)}
</div></section>
<section class="settings-group"><h2>Модели ИИ</h2><div class="list-panel">${row("Ввод без ИИ", s.manualOnly ? "«+» открывает обычные формы" : router && Number(router.left) <= 0 ? "Деньги на OpenRouter кончились — ввод сейчас ручной" : "«+» разбирает текст и ищет фильмы моделью", `<label class="switch"><input type="checkbox" data-setting="manualOnly" ${s.manualOnly ? "checked" : ""}><span></span></label>`)}</div><div class="side-card">${routerRows}</div><p class="section-note">Бот разбирает сообщения моделями OpenRouter; пополнить — openrouter.ai.</p></section>
<section class="settings-group"><h2>Данные</h2><div class="inline-actions"><button type="button" data-action="export-json">${icon("download")}Экспорт JSON</button><button type="button" data-action="export-csv">${icon("download")}Экспорт CSV</button>${window.SOROKA_LIVE ? `<button type="button" data-action="reset">${icon("reset")}Обновить данные</button>` : ""}</div><p class="section-note">Экспорт — всё, кроме паролей.</p></section>
</div><aside class="content-aside"><div class="side-card"><h3>Личные данные</h3><p class="side-note">Записи живут в базе бота и доступны только вам. Пароли — в зашифрованном хранилище и в экспорт не попадают.</p></div></aside></div>`;
}
function renderComponentGallery() {
  return `<div class="side-card"><h3>Компоненты</h3><div class="inline-actions"><button type="button">Обычное действие</button><button type="button" class="danger">Удаление</button></div><div class="tag-list"><span class="tag">Работа</span><span class="tag">Личное</span><span class="pill">Активно</span><span class="pill warn">Просрочено</span></div><div class="progress-track"><span style="width:62%"></span></div><p class="section-note">Карточки, поля и состояния используют общие цвета и размеры.</p></div>`;
}
function renderDemoStatePage() {
  const modes = {
    empty: ["Пустой раздел", "Добавьте первую запись через общую кнопку «+».", "inbox"],
    loading: ["Загружаем записи", "После загрузки здесь появятся карточки и сводки.", "clock"],
    error: ["Не удалось обновить данные", "Проверьте соединение и попробуйте ещё раз. Это демонстрация состояния ошибки.", "close"],
    many: ["Много данных", "Пример плотного списка из разных записей.", "overview"]
  };
  const [title, description, symbol] = modes[ui.demoState] || modes.empty;
  const many = ui.demoState === "many" ? `<div class="record-list section">${Array.from({ length: 18 }, (_, i) => `<div class="record-card"><span class="record-kicker">${icon("note")}Запись ${i + 1}</span><span class="record-title">Материал из библиотеки № ${i + 1}</span><span class="record-meta">Пример длинного списка</span></div>`).join("")}</div>` : "";
  return `${header("Состояние экрана", "Режим демонстрации дизайна", "Демо")}<div class="demo-state-banner">Показано состояние «${ui.demoState}». Данные не изменены.</div><div class="state-card">${icon(symbol)}<h2>${title}</h2><p>${description}</p><button class="primary-button" type="button" data-action="demo-normal">Вернуться к данным</button></div>${many}`;
}
function renderCompareSheet() {
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet compare-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Две темы рядом</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><div class="theme-comparison"><div class="theme-phone dark"><small>ТЁМНАЯ</small><h3>Сегодня</h3><p>3 дела на сегодня</p><div class="theme-sample">○ Подготовить смету проекта</div><div class="theme-sample">○ Позвонить стоматологу</div></div><div class="theme-phone light"><small>СВЕТЛАЯ</small><h3>Сегодня</h3><p>3 дела на сегодня</p><div class="theme-sample">○ Подготовить смету проекта</div><div class="theme-sample">○ Позвонить стоматологу</div></div></div></section></div>`;
}
function renderMorePage() {
  const items = [["overview", "Обзор", "Сводка дня", "overview"], ["inbox", "Входящие", "Нужны решения", "inbox"], ["tasks", "Все дела", "Включая без даты", "check"], ["projects", "Проекты", "Связанные записи", "project"], ["vault", "Пароли", "Отдельное хранилище", "key"], ["metrics", "Показатели", "График измерений", "chart"], ["archive", "Архив и корзина", "История записей", "archive"], ["settings", "Настройки", "Вид и уведомления", "settings"], ["search", "Поиск", "По всем разделам", "search"], ["add", "Разобрать сообщение", "Одна или несколько строк", "plus"]];
  return `${header("Ещё", "Разделы и действия", "Пространство")}<div class="more-grid">${items.map(([page, label, detail, symbol]) => `<button class="more-tile" type="button" data-action="${page === "search" ? "search" : page === "add" ? "universal-add" : "navigate"}" ${page === "search" || page === "add" ? "" : `data-page="${page}"`}>${icon(symbol)}<span><strong>${label}</strong><small>${detail}</small></span></button>`).join("")}</div><section class="section"><div class="overview-intro"><span class="mini-heading">Связь с ботом</span><p>В рабочем Mini App текст, голосовые, фото, файлы, видео и пересланные посты бот разложит по разделам. Здесь можно проверить карточки и пакетный ввод на примере текста.</p><div class="inline-actions"><button type="button" data-action="return-chat">${icon("arrow")}Вернуться в чат</button><button type="button" data-action="demo-refresh">${icon("reset")}Обновить</button></div></div></section>`;
}

function searchCatalog() {
  const catalog = [];
  const add = (type, group, label, item, details = "") => catalog.push({ type, group, label, item, details });
  data.tasks.forEach(x => add("task", "tasks", "Задача", x, `${x.description || ""} ${x.project || ""}`));
  data.events.forEach(x => add("event", "events", "Событие", x, x.description || ""));
  data.notes.forEach(x => add("note", "notes", "Заметка", x, `${x.description || ""} ${x.topic || ""}`));
  data.inbox.forEach(x => add("inbox", "inbox", "Входящие", x, `${x.detail || ""} ${x.type || ""}`));
  SAVED_CATEGORIES.filter(([key]) => key !== "notes").forEach(([key, label]) => data.saved[key].forEach(x => add(`saved:${key}`, "materials", label, x, `${x.description || ""} ${x.summary || ""} ${(x.tags || []).join(" ")} ${x.topic || ""} ${savedSection(key, x.sectionId)?.name || ""} ${x.reason || ""} ${x.address || ""} ${x.city || ""} ${JSON.stringify(x.ingredients || [])} ${JSON.stringify(x.items || [])}`)));
  data.finance.transactions.forEach(x => add("finance:transaction", "finance", x.kind === "income" ? "Доход" : "Расход", x, `${x.category} ${x.amount} ${x.project || ""}`));
  data.finance.debts.forEach(x => add("finance:debt", "finance", "Долг", { ...x, title: x.person }, `${x.amount} ${x.note || ""}`));
  data.finance.payments.forEach(x => add("finance:payment", "finance", "Платёж", x, `${x.amount} ${x.category || ""}`));
  data.finance.budgets.forEach(x => add("finance:budget", "finance", "Бюджет", { ...x, title: x.category }, `${x.limit}`));
  data.finance.accounts.forEach(x => add("finance:account", "finance", "Счёт", { ...x, title: x.name }, `${x.currency}`));
  data.finance.goals.forEach(x => add("finance:goal", "finance", "Цель", x, `${x.target} ${x.saved}`));
  data.finance.transfers.forEach(x => add("finance:transfer", "finance", "Перевод", { ...x, title: `${data.finance.accounts.find(a => a.id === x.fromId)?.name || "Счёт"} → ${data.finance.accounts.find(a => a.id === x.toId)?.name || "Счёт"}` }, `${x.amount} ${x.toAmount} ${x.note || ""}`));
  data.projects.forEach(x => add("project", "projects", "Проект", { ...x, title: x.name }, x.description || ""));
  data.metrics.forEach(x => add("metric", "materials", "Показатель", x, `${x.value} ${x.unit}`));
  return catalog;
}
function searchMatches() {
  // Удалённое лежит в корзине и в поиск не попадает, даже если экран ещё не обновился.
  const removed = new Set((data.trash || []).map(entry => String(entry.item?.id)));
  const words = ui.searchQuery.trim().toLocaleLowerCase("ru-RU").split(/\s+/).filter(Boolean);
  return searchCatalog()
    .filter(x => !removed.has(String(x.item.id)) && (ui.searchType === "all" || x.group === ui.searchType) && words.every(word => `${x.item.title} ${x.label} ${x.details}`.toLocaleLowerCase("ru-RU").includes(word)))
    .sort((a, b) => Number(Boolean(b.item.pinned)) - Number(Boolean(a.item.pinned)));
}
function searchResultRows() {
  if (!ui.searchQuery.trim() && ui.searchType === "all") return `<div class="search-start">${icon("search", "icon-lg")}<strong>Что найти?</strong><p>Ищите по названию, тексту, разделу, сумме или проекту. Можно также выбрать раздел выше.</p></div>`;
  const matches = searchMatches();
  const pages = Math.max(1, Math.ceil(matches.length / 8));
  ui.searchPage = Math.min(ui.searchPage, pages);
  const slice = matches.slice((ui.searchPage - 1) * 8, ui.searchPage * 8);
  return `<div class="search-count">${matches.length} ${word(matches.length, "запись", "записи", "записей")}</div>${slice.length ? slice.map(x => `<button class="search-result" type="button" data-action="search-open" data-type="${x.type}" data-id="${esc(x.item.id)}"><span class="list-icon">${icon(x.group === "finance" ? "wallet" : x.group === "projects" ? "project" : x.group === "tasks" ? "check" : x.group === "events" ? "calendar" : x.group === "inbox" ? "inbox" : "bookmark")}</span><span class="list-copy"><strong>${esc(x.item.title)}</strong><small>${x.item.pinned ? "Закреплено · " : ""}${esc(x.label)}${x.item.date || x.item.due ? ` · ${esc(dateLabel(x.item.date || x.item.due))}` : ""}</small></span>${icon("right", "icon-sm")}</button>`).join("") : `<div class="search-empty">${icon("search", "icon-lg")}<strong>Ничего не найдено</strong><p>Проверьте запрос или выберите другой раздел.</p></div>`}${pages > 1 ? `<div class="search-pager"><button type="button" data-action="search-page" data-page="${ui.searchPage - 1}" ${ui.searchPage <= 1 ? "disabled" : ""}>Назад</button><span>${ui.searchPage} из ${pages}</span><button type="button" data-action="search-page" data-page="${ui.searchPage + 1}" ${ui.searchPage >= pages ? "disabled" : ""}>Дальше</button></div>` : ""}`;
}
function renderSearchSheetExt() {
  const filters = [["all", "Везде"], ["tasks", "Дела"], ["events", "События"], ["notes", "Заметки"], ["materials", "Сохранённое"], ["finance", "Финансы"], ["projects", "Проекты"], ["inbox", "Входящие"]];
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet search-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Поиск по Сороке</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><div class="search-box">${icon("search")}<input id="search-input" type="search" placeholder="Название, текст, сумма…" value="${esc(ui.searchQuery)}" autocomplete="off" aria-label="Поисковый запрос"><button class="search-clear" type="button" data-action="search-clear" aria-label="Очистить поиск" ${ui.searchQuery ? "" : "hidden"}>${icon("close", "icon-sm")}</button></div><div class="subtabs search-filters" role="group" aria-label="Раздел поиска">${filters.map(([key, label]) => `<button type="button" class="${ui.searchType === key ? "active" : ""}" data-action="search-filter" data-filter="${key}" aria-pressed="${ui.searchType === key}">${label}</button>`).join("")}</div><div id="search-results" class="search-results" aria-live="polite">${searchResultRows()}</div><p class="search-footnote">Поиск по всем разделам · пароли не ищутся</p></section></div>`;
}
function openSearchResult(type, recordId) {
  ui.sheet = null;
  if (type === "finance:goal") { openGoalDeposit(recordId); return; }
  if (type === "task" || type === "event" || type === "metric" || type === "inbox" || type.startsWith("finance:")) { openCardEditor(type, recordId); return; }
  if (type === "note") { openSavedRecord("notes", recordId); return; }
  if (type.startsWith("saved:")) { openSavedRecord(type.split(":")[1], recordId); return; }
  if (type === "project") { ui.projectId = recordId; navigate("projects"); return; }
}
function renderAddMenu() {
  return renderCaptureInput();
}
function openChoice(type) {
  ui.sheet = null;
  if (type === "task" || type === "event") { openEntry(type); return; }
  if (type === "note") { openSavedRecord("notes"); return; }
  if (type === "expense" || type === "income") { openFinanceForm("transaction", null, type); return; }
  if (["link", "list", "recipe", "movie", "address", "file", "ticket"].includes(type)) { openSavedRecord({ link: "links", list: "lists", recipe: "recipes", movie: "movies", address: "addresses", file: "files", ticket: "tickets" }[type]); return; }
  if (type === "password") { navigate("vault"); if (ui.vaultUnlocked) { ui.sheet = { kind: "vault", id: null, justRendered: false }; render(); } return; }
  if (type === "project" || type === "metric") { ui.sheet = { kind: type, id: null, justRendered: false }; render(); }
}
function quickCapture(raw) {
  return startCaptureReview(raw);
}
function renderBatchSheet() {
  return renderCaptureReview();
}
function exportDemoJson() {
  const { vault, ...safeData } = data;
  downloadText("soroka-demo.json", JSON.stringify({ exportedAt: new Date().toISOString(), data: safeData }, null, 2));
}
function exportDemoCsv() {
  const rows = [["тип", "дата", "название", "сумма"]];
  data.tasks.forEach(x => rows.push(["задача", x.due || "", x.title, ""]));
  data.events.forEach(x => rows.push(["событие", x.due || "", x.title, ""]));
  data.finance.transactions.forEach(x => rows.push([x.kind === "income" ? "доход" : "расход", x.date, x.title, x.amount]));
  const csv = rows.map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(";")).join("\r\n");
  downloadText("soroka-demo.csv", csv, "text/csv;charset=utf-8");
}
function sharePayload(type, recordId) {
  let item;
  let title;
  const lines = [];
  let url = "";
  if (type === "note" || type.startsWith("saved:")) {
    const category = type === "note" ? "notes" : type.split(":")[1];
    item = savedItem(category, recordId);
    if (!item) return null;
    title = item.title;
    if (item.description && category !== "posts") lines.push(item.description);
    if (category === "posts") { lines.push(postInfo(item, "body") || item.description || "", item.source || ""); }
    if (category === "recipes") {
      const portions = ui.sheet?.kind === "saved" && ui.sheet.id === recordId ? recipePortions(item) : Math.max(1, Number(item.servings) || 1);
      const factor = portions / Math.max(1, Number(item.servings) || 1);
      lines.push(`На ${portions} порций`);
      if (item.ingredients?.length) lines.push(`Ингредиенты:\n${item.ingredients.map(x => `• ${recipeIngredientLine(x, factor)}`).join("\n")}`);
      if (item.steps?.length) lines.push(`Приготовление:\n${item.steps.map((x, i) => `${i + 1}. ${x}`).join("\n")}`);
    }
    if (category === "lists" && item.items?.length) lines.push(item.items.map(x => `${x.done ? "☑" : "☐"} ${x.text}`).join("\n"));
    if (category === "addresses") {
      if (item.address) lines.push(item.address);
      const coordinates = mapPointCoordinates(item);
      if (coordinates) lines.push(`${coordinates[0].toFixed(6)}, ${coordinates[1].toFixed(6)}`);
      url = mapExternalUrl(item);
    }
    if (category === "links") url = /^https?:\/\//i.test(item.url || "") ? item.url : "";
    if (category === "movies") {
      lines.push([item.year, item.director, item.where].filter(Boolean).join(" · "));
      if (movieInfo(item, "kinopoiskRating")) lines.push(`Кинопоиск: ${movieScore(movieInfo(item, "kinopoiskRating"))}`);
      if (movieInfo(item, "imdbRating")) lines.push(`IMDb: ${movieScore(movieInfo(item, "imdbRating"))}`);
      url = movieInfo(item, "kinopoiskUrl") || "";
    }
    if (category === "products") lines.push([item.price ? demoMoney(item.price) : "", item.store].filter(Boolean).join(" · "));
    return { title, text: [title, ...lines.filter(Boolean)].join("\n\n"), url, fileItem: category === "files" ? item : null };
  }
  if (type === "task" || type === "event") {
    item = (type === "task" ? data.tasks : data.events).find(x => x.id === recordId);
    if (!item) return null;
    title = item.title;
    if (item.description) lines.push(item.description);
    if (item.due) lines.push(`${type === "task" ? "Срок" : "Дата"}: ${dateLabel(item.due)}${item.time ? `, ${item.time}` : ""}`);
    if (item.project) lines.push(`Проект: ${item.project}`);
    return { title, text: [title, ...lines].join("\n"), url };
  }
  if (type.startsWith("finance:")) {
    const entity = type.split(":")[1];
    item = financeEntityList(entity).find(x => x.id === recordId);
    if (!item) return null;
    if (entity === "transaction") { title = item.title; lines.push(`${item.kind === "income" ? "Доход" : "Расход"}: ${demoMoney(item.amount, item.currency)}`, [item.date, item.category].filter(Boolean).join(" · ")); }
    if (entity === "account") { title = item.name; lines.push(`Баланс: ${demoMoney(accountBalance(item), item.currency)}`); }
    if (entity === "transfer") { const from = data.finance.accounts.find(x => x.id === item.fromId); const to = data.finance.accounts.find(x => x.id === item.toId); title = "Перевод"; lines.push(`${from?.name || "Счёт"} → ${to?.name || "Счёт"}`, `${demoMoney(item.amount, from?.currency)} → ${demoMoney(item.toAmount, to?.currency)}`, item.date || ""); }
    if (entity === "budget") { title = `Бюджет: ${item.category}`; lines.push(`Лимит: ${demoMoney(item.limit)}`, `Потрачено: ${demoMoney(categorySpent(item.category))}`); }
    if (entity === "goal") { title = item.title; lines.push(`Цель: ${demoMoney(item.target)}`, `Отложено: ${demoMoney(item.saved)}`, item.note || ""); }
    if (entity === "payment") { title = item.title; lines.push(`Платёж: ${demoMoney(item.amount)}`, `${item.day}-го числа`, item.category || ""); }
    if (entity === "debt") { title = `Долг: ${item.person}`; lines.push(`${item.direction === "to-me" ? "Должны мне" : "Должен я"}: ${demoMoney(Math.max(0, item.amount - item.paid))}`, item.note || ""); }
    return title ? { title, text: [title, ...lines.filter(Boolean)].join("\n"), url } : null;
  }
  if (type === "project") { item = data.projects.find(x => x.id === recordId); if (item) return { title: item.name, text: [item.name, item.description, item.status].filter(Boolean).join("\n"), url }; }
  if (type === "metric") { item = data.metrics.find(x => x.id === recordId); if (item) return { title: item.title, text: [item.title, `${item.value} ${item.unit || ""}`.trim(), item.date].filter(Boolean).join("\n"), url }; }
  if (type === "inbox") { item = data.inbox.find(x => x.id === recordId); if (item) return { title: item.title, text: [item.title, item.detail, item.type].filter(Boolean).join("\n"), url }; }
  if (type === "vault") { item = data.vault.find(x => x.id === recordId); if (item) return { title: item.service, text: `${item.service}\nДанные для входа не включены.`, url }; }
  return null;
}
async function shareAttachedFile(item) {
  const source = savedFileUrl(item);
  if (!source) return null;
  try {
    const blob = await (await fetch(source)).blob();
    return new File([blob], item.fileName || item.title, { type: item.fileType || blob.type || "application/octet-stream" });
  } catch (_) { return null; }
}
async function copySharedText(value) {
  try { await navigator.clipboard.writeText(value); return true; } catch (_) {}
  const helper = document.createElement("textarea");
  helper.value = value;
  helper.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
  document.body.appendChild(helper);
  try { helper.select(); return document.execCommand("copy"); }
  catch (_) { return false; }
  finally { helper.remove(); }
}
async function shareRecord(type, recordId) {
  const payload = sharePayload(type, recordId);
  if (!payload) { toast("Запись не найдена"); return; }
  const fullText = [payload.text, payload.url].filter(Boolean).join("\n");
  if (navigator.share) {
    const shareData = { title: payload.title, text: payload.text };
    if (payload.url) shareData.url = payload.url;
    if (payload.fileItem && navigator.canShare) {
      const file = await shareAttachedFile(payload.fileItem);
      try { if (file && navigator.canShare({ files: [file] })) shareData.files = [file]; } catch (_) {}
    }
    try { await navigator.share(shareData); closeSwipeRows(); return; }
    catch (error) { if (error?.name === "AbortError") return; }
  }
  const copied = await copySharedText(fullText);
  closeSwipeRows();
  toast(copied ? payload.fileItem ? "Описание скопировано. Файл можно открыть в карточке." : "Содержимое скопировано — его можно отправить" : "Не удалось поделиться записью");
}
function moreAction(action, control) {
  const itemId = control.dataset.id;
  if (captureAction(action, control)) return true;
  if (action === "swipe-skip") { const row = control.closest(".swipe-row"); if (row) { closeSwipeRows(); swipeSkipQuiet(row, savedItem("movies", row.dataset.swipeId)); } return true; }
  if (["swipe-edit", "swipe-share", "swipe-delete"].includes(action)) { const row = control.closest(".swipe-row"); if (row) { if (action === "swipe-delete") deleteSwipeCard(row); else if (action === "swipe-share") void shareRecord(row.dataset.swipeType, row.dataset.swipeId); else openSwipeCard(row, "edit"); } return true; }
  if (action === "card-preview-settings" && ui.sheet?.kind === "card-preview") { const { type, recordId } = ui.sheet; openCardEditor(type, recordId); return true; }
  if (action === "card-preview-share" && ui.sheet?.kind === "card-preview") { void shareRecord(ui.sheet.type, ui.sheet.recordId); return true; }
  if (action === "universal-add") { ui.sheet = { kind: "addmenu", justRendered: false }; render(); return true; }
  if (action === "add-choice") { openChoice(control.dataset.type); return true; }
  if (action === "tasks-filter") { ui.tasksFilter = control.dataset.filter; render(); return true; }
  if (action === "tasks-add") { openEntry("task", ""); return true; }
  if (action === "inbox-filter") { ui.inboxFilter = control.dataset.filter; render(); return true; }
  if (action === "inbox-open-task") { openEntry("task", todayIso(), itemId); return true; }
  if (action === "inbox-save") {
    const source = data.inbox.find(x => x.id === itemId);
    if (source) { const category = source.type === "Ссылка" ? "links" : "posts"; data.saved[category].unshift({ id: id(), title: source.title, description: source.detail || "", topic: "Входящие", tags: [], source: "Telegram", created: todayIso(), viewed: false, pinned: false }); data.inbox = data.inbox.filter(x => x.id !== itemId); save(); toast("Сохранено в библиотеке"); }
    return true;
  }
  if (action === "overview-capture") { const input = document.getElementById("overview-quick"); if (input) quickCapture(input.value); return true; }
  if (action === "overview-continue") { openSavedRecord(control.dataset.category, itemId); return true; }
  if (action === "project-new" || action === "project-edit") { ui.sheet = { kind: "project", id: action === "project-edit" ? itemId : null, justRendered: false }; render(); return true; }
  if (action === "project-open") { ui.projectId = itemId; render(); return true; }
  if (action === "project-back") { ui.projectId = null; render(); return true; }
  if (action === "project-task" || action === "project-event") { openEntry(action.slice(8), todayIso(), itemId); return true; }
  if (action === "project-note") { openSavedRecord("notes", itemId); return true; }
  if (action === "project-saved") { openSavedRecord(control.dataset.category, itemId); return true; }
  if (action === "project-transaction") { openFinanceForm("transaction", itemId); return true; }
  if (action === "project-delete") { const target = data.projects.find(x => x.id === ui.sheet?.id); if (target && window.confirm(`Удалить проект «${target.name}»?`)) { pushTrash("project", target); data.projects = data.projects.filter(x => x.id !== target.id); ui.projectId = null; ui.sheet = null; save(); toast("Проект в корзине"); } return true; }
  if (action === "vault-unlock") { ui.vaultUnlocked = true; render(); return true; }
  if (action === "vault-lock") { ui.vaultUnlocked = false; ui.vaultShown = null; clearTimeout(vaultTimer); render(); return true; }
  if (action === "vault-new" || action === "vault-edit") { ui.sheet = { kind: "vault", id: action === "vault-edit" ? itemId : null, justRendered: false }; render(); return true; }
  if (action === "vault-reveal") { ui.vaultShown = vaultVisible(itemId) ? null : { id: itemId, until: Date.now() + 30000 }; clearTimeout(vaultTimer); if (ui.vaultShown) vaultTimer = setTimeout(hideVaultSecret, 30000); render(); return true; }
  if (action === "vault-copy") { const item = data.vault.find(x => x.id === itemId); const value = item?.[control.dataset.field]; if (value) navigator.clipboard?.writeText(value).then(() => toast("Скопировано")).catch(() => toast("Не удалось скопировать")); return true; }
  if (action === "vault-delete") { if (window.confirm("Удалить тестовую учётную запись навсегда?")) { data.vault = data.vault.filter(x => x.id !== ui.sheet?.id); ui.sheet = null; toast("Удалено"); } return true; }
  if (action === "metric-new" || action === "metric-edit") { ui.sheet = { kind: "metric", id: action === "metric-edit" ? itemId : null, justRendered: false }; render(); return true; }
  if (action === "metric-delete") { const item = data.metrics.find(x => x.id === ui.sheet?.id); if (item) pushTrash("metric", item); data.metrics = data.metrics.filter(x => x.id !== ui.sheet?.id); ui.sheet = null; save(); toast("Запись в корзине"); return true; }
  if (action === "archive-tab") { ui.archiveTab = control.dataset.tab; render(); return true; }
  if (action === "archive-random") { const pool = [{ category: "notes", items: data.notes }, ...SAVED_CATEGORIES.filter(([key]) => key !== "notes").map(([category]) => ({ category, items: data.saved[category] }))].flatMap(({ category, items }) => items.map(item => ({ category, item }))); const picked = pool[Math.floor(Math.random() * pool.length)]; if (picked) openSavedRecord(picked.category, picked.item.id); else toast("Сохранённых записей пока нет"); return true; }
  if (action === "swipe-undo") { const entry = data.trash.slice().reverse().find(x => String(x.item?.id) === control.dataset.undoId); if (entry) { control.dataset.id = entry.id; return moreAction("archive-restore", control); } render(); return true; }
  if (action === "archive-restore") { const entry = data.trash.find(x => x.id === itemId); if (entry) { if (["task", "event", "note"].includes(entry.type)) data[`${entry.type}s`].push(entry.item); else if (entry.type === "saved:notes") data.notes.push(entry.item); else if (entry.type.startsWith("saved:")) data.saved[entry.type.split(":")[1]].push(entry.item); else if (entry.type.startsWith("finance:")) financeEntityList(entry.type.split(":")[1]).push(entry.item); else if (entry.type === "project") data.projects.push(entry.item); else if (entry.type === "metric") data.metrics.push(entry.item); else if (entry.type === "inbox") data.inbox.push(entry.item); data.trash = data.trash.filter(x => x.id !== itemId); save(); toast("Запись восстановлена"); } return true; }
  if (action === "archive-purge") { if (window.confirm("Удалить эту запись навсегда?")) { data.trash = data.trash.filter(x => x.id !== itemId); save(); toast("Удалено окончательно"); } return true; }
  if (action === "overview-block-up" || action === "overview-block-down") { const order = data.settings.overviewOrder ||= ["next", "tasks", "money", "payments", "saved", "continue", "weekly"]; const i = order.indexOf(control.dataset.key); const next = i + (action === "overview-block-up" ? -1 : 1); if (i >= 0 && next >= 0 && next < order.length) { [order[i], order[next]] = [order[next], order[i]]; save(); render(); } return true; }
  if (action === "export-json") { exportDemoJson(); return true; }
  if (action === "export-csv") { exportDemoCsv(); return true; }
  if (action === "demo-compare") { ui.sheet = { kind: "compare", justRendered: false }; render(); return true; }
  if (action === "demo-components") { ui.componentGallery = !ui.componentGallery; render(); return true; }
  if (action === "demo-state") { ui.demoState = control.dataset.state; render(); return true; }
  if (action === "demo-normal") { ui.demoState = "normal"; render(); return true; }
  if (action === "search-filter") { ui.searchType = control.dataset.filter; ui.searchPage = 1; render(); return true; }
  if (action === "search-clear") { ui.searchQuery = ""; ui.searchPage = 1; const input = document.getElementById("search-input"); if (input) { input.value = ""; input.focus(); } const area = document.getElementById("search-results"); if (area) area.innerHTML = searchResultRows(); control.hidden = true; return true; }
  if (action === "search-page") { ui.searchPage = Number(control.dataset.page); const area = document.getElementById("search-results"); if (area) { area.innerHTML = searchResultRows(); installSwipeCards(area); area.scrollTop = 0; } return true; }
  if (action === "return-chat") { toast("Откройте чат с ботом в Telegram"); return true; }
  if (action === "demo-refresh") { toast("Данные актуальны"); return true; }
  return false;
}
function moreSubmit(event) {
  const formId = event.target.id;
  if (formId === "quick-capture-form") { event.preventDefault(); quickCapture(new FormData(event.target).get("text")); return true; }
  if (formId === "batch-form") return submitCaptureReview(event);
  if (formId === "inbox-form") { event.preventDefault(); const item = data.inbox.find(x => x.id === ui.sheet?.id); if (item) { const form = new FormData(event.target); item.title = String(form.get("title") || "").trim(); item.detail = String(form.get("detail") || "").trim(); item.type = String(form.get("type") || "Сообщение"); save(); } ui.sheet = null; toast("Входящее обновлено"); return true; }
  if (!["project-form", "vault-form", "metric-form"].includes(formId)) return false;
  event.preventDefault();
  const form = new FormData(event.target);
  if (formId === "project-form") {
    const existing = data.projects.find(x => x.id === ui.sheet?.id);
    const oldName = existing?.name;
    const name = String(form.get("name") || "").trim();
    if (!name) return true;
    const project = existing || { id: id() };
    Object.assign(project, { name, description: String(form.get("description") || "").trim(), status: String(form.get("status") || "Активен"), color: String(form.get("color") || "#58d0cf") });
    if (!existing) data.projects.push(project);
    if (oldName && oldName !== name) { data.tasks.filter(x => x.project === oldName).forEach(x => x.project = name); data.events.filter(x => x.project === oldName).forEach(x => x.project = name); data.notes.filter(x => x.project === oldName).forEach(x => x.project = name); data.finance.transactions.filter(x => x.project === oldName).forEach(x => x.project = name); }
    ui.projectId = project.id; ui.sheet = null; save(); toast("Проект сохранён"); return true;
  }
  if (formId === "vault-form") {
    const existing = data.vault.find(x => x.id === ui.sheet?.id);
    const item = existing || { id: id() };
    Object.assign(item, { service: String(form.get("service") || "").trim(), login: String(form.get("login") || "").trim(), password: String(form.get("password") || ""), note: String(form.get("note") || "").trim() });
    if (!existing) data.vault.push(item);
    ui.sheet = null; toast("Сохранено на время сеанса"); return true;
  }
  const existing = data.metrics.find(x => x.id === ui.sheet?.id);
  const item = existing || { id: id() };
  Object.assign(item, { title: String(form.get("title") || "").trim(), value: Number(form.get("value") || 0), unit: String(form.get("unit") || "").trim(), date: String(form.get("date") || todayIso()) });
  if (!existing) data.metrics.push(item);
  ui.sheet = null; save(); toast("Показатель сохранён"); return true;
}
function moreInput(event) {
  if (event.target.id === "search-input") { ui.searchQuery = event.target.value; ui.searchPage = 1; const area = document.getElementById("search-results"); if (area) { area.innerHTML = searchResultRows(); installSwipeCards(area); area.scrollTop = 0; } const clear = document.querySelector(".search-clear"); if (clear) clear.hidden = !ui.searchQuery; return true; }
  if (event.target.id === "vault-search") { ui.vaultQuery = event.target.value; const q = ui.vaultQuery.toLocaleLowerCase("ru-RU"); document.querySelectorAll("#vault-results .budget-card").forEach(card => card.hidden = !card.textContent.toLocaleLowerCase("ru-RU").includes(q)); return true; }
  return false;
}
function moreChange(event) {
  if (captureChange(event)) return true;
  const setting = event.target.dataset.setting;
  if (!setting) return false;
  if (setting === "overview-block") { const key = event.target.dataset.key; data.settings.overviewHidden = event.target.checked ? data.settings.overviewHidden.filter(x => x !== key) : [...new Set([...data.settings.overviewHidden, key])]; }
  else if (setting === "theme") { ui.theme = event.target.value; try { localStorage.setItem(THEME_KEY, ui.theme); } catch (_) {} }
  else if (setting === "gcal") data.settings.gcal = event.target.checked;
  else if (setting === "manualOnly") data.settings.manualOnly = event.target.checked;
  else data.settings[setting] = event.target.value;
  save(); render(); return true;
}
function renderInboxSheet() {
  const item = data.inbox.find(x => x.id === ui.sheet?.id);
  if (!item) return "";
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Запись из входящих</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><form id="inbox-form"><label class="field">Название<input name="title" type="text" value="${esc(item.title)}" required autofocus></label><label class="field">Детали<textarea name="detail">${esc(item.detail || "")}</textarea></label><label class="field">Тип<select name="type">${["Сообщение", "Ссылка", "Файл", "Дубликат"].map(type => `<option ${item.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></label><div class="sheet-actions"><button class="primary-button" type="submit">Сохранить</button></div></form></section></div>`;
}
function swipeDescriptor(node) {
  if (node.matches(".task-card")) return ["task", node.dataset.taskId];
  if (node.matches(".event-card")) return ["event", node.dataset.id];
  if (node.matches(".record-card-shell, .record-card, .note-row")) return [`saved:${node.dataset.category}`, node.dataset.id];
  if (node.matches(".project-card")) return ["project", node.dataset.id];
  if (node.matches(".search-result")) return [node.dataset.type, node.dataset.id];
  if (node.matches(".finance-row-button")) {
    const action = node.dataset.action;
    if (action === "finance-edit") return [`finance:${node.dataset.entity}`, node.dataset.id];
    if (action === "metric-edit") return ["metric", node.dataset.id];
    if (action === "project-task" || action === "project-event") return [action.slice(8), node.dataset.id];
    if (action === "project-note") return ["note", node.dataset.id];
    if (action === "project-saved") return [`saved:${node.dataset.category}`, node.dataset.id];
    if (action === "project-transaction") return ["finance:transaction", node.dataset.id];
  }
  if (node.matches(".budget-card")) {
    const edit = node.querySelector('[data-action="finance-edit"], [data-action="vault-edit"]');
    if (edit) return [edit.dataset.action === "vault-edit" ? "vault" : `finance:${edit.dataset.entity}`, edit.dataset.id];
  }
  if (node.matches(".list-row")) {
    const inbox = node.querySelector('[data-action="inbox-task"]');
    if (inbox) return ["inbox", inbox.dataset.id];
    const task = node.querySelector('[data-action="inbox-open-task"]');
    if (task) return ["task", task.dataset.id];
    const payment = node.querySelector('[data-action="payment-confirm"]') || node.nextElementSibling?.querySelector('[data-action="finance-edit"][data-entity="payment"]');
    if (payment) return ["finance:payment", payment.dataset.id];
  }
  return null;
}
function installSwipeCards(root) {
  const selector = ".task-card, .event-card, .record-card-shell, .record-card, .note-row, .finance-row-button, .project-card, .budget-card, .list-row, .search-result";
  root.querySelectorAll(selector).forEach(node => {
    if (node.closest(".swipe-row") || node.closest(".sheet") && !node.matches(".search-result")) return;
    // Карточку с закладкой свайпают целиком — вместе с закладкой.
    if (node.matches(".record-card") && node.closest(".record-card-shell")) return;
    const descriptor = swipeDescriptor(node);
    if (!descriptor?.[0] || !descriptor?.[1]) return;
    const [type, recordId] = descriptor;
    const wrapper = document.createElement("div");
    wrapper.className = "swipe-row";
    if (type === "saved:movies") wrapper.classList.add("swipe-movie");
    // Свайп вправо — «просмотрено» (глазик) у заметок, файлов, постов, ссылок и фильмов.
    if (["saved:movies", "saved:notes", "saved:files", "saved:posts", "saved:links"].includes(type)) wrapper.classList.add("swipe-seen");
    if (node.matches(".note-row")) wrapper.classList.add("swipe-note");
    if (node.matches(".budget-card, .project-card")) wrapper.classList.add("swipe-spaced");
    if (node.matches(".event-card")) wrapper.classList.add("swipe-event");
    wrapper.dataset.swipeType = type;
    wrapper.dataset.swipeId = recordId;
    const seenItem = ["saved:movies", "saved:notes", "saved:files", "saved:posts", "saved:links"].includes(type) ? savedItem(type.split(":")[1], recordId) : null;
    const seenNow = type === "saved:movies" ? movieIsViewed(seenItem) : Boolean(seenItem?.viewed);
    const movieSwipeHint = seenItem ? `<span class="swipe-right-indicator" aria-hidden="true">${icon(seenNow ? "eyeOff" : "eye", "icon-sm")}</span>` : "";
    wrapper.innerHTML = `${movieSwipeHint}<button class="swipe-action edit" type="button" data-action="swipe-edit" tabindex="-1" aria-label="Настроить запись">${icon("settings")}</button><button class="swipe-action skip" type="button" data-action="swipe-skip" tabindex="-1" aria-label="Не интересно">${icon("thumbDown")}</button><button class="swipe-action share" type="button" data-action="swipe-share" tabindex="-1" aria-label="Поделиться записью">${icon("share")}</button><button class="swipe-action delete" type="button" data-action="swipe-delete" tabindex="-1" aria-label="Удалить запись">${icon("trash")}</button><div class="swipe-content"></div>`;
    node.parentNode.insertBefore(wrapper, node);
    wrapper.querySelector(".swipe-content").appendChild(node);
  });
}
function closeSwipeRows(except = null) {
  document.querySelectorAll(".swipe-row.is-open-left").forEach(row => {
    if (row === except) return;
    row.classList.remove("is-open-left");
    // Кнопки гаснут, пока карточка едет обратно, — а не пропадают разом.
    setTimeout(() => { if (!row.classList.contains("is-open-left") && !row.classList.contains("swiping")) row.classList.remove("dir-left"); }, 280);
    row.querySelectorAll(".swipe-action").forEach(button => button.tabIndex = -1);
  });
}
function openSwipeCard(row, mode = "view") {
  const { swipeType: type, swipeId: recordId } = row.dataset;
  closeSwipeRows();
  // Окна «просмотр записи» нет: в нём не было ничего, чего не видно на карточке.
  if (mode === "view" && type === "finance:goal") { openGoalDeposit(recordId); return; }
  openCardEditor(type, recordId, mode);
}
function openCardEditor(type, recordId, mode = "edit") {
  if (type === "task" || type === "event") { openEntry(type, todayIso(), recordId); return; }
  if (type === "note") { openSavedRecord("notes", recordId, mode); return; }
  if (type.startsWith("saved:")) { openSavedRecord(type.split(":")[1], recordId, mode); return; }
  if (type.startsWith("finance:")) { openFinanceForm(type.split(":")[1], recordId); return; }
  if (type === "project") { ui.sheet = { kind: "project", id: recordId, justRendered: false }; render(); return; }
  if (type === "metric") { ui.sheet = { kind: "metric", id: recordId, justRendered: false }; render(); return; }
  if (type === "vault" && ui.vaultUnlocked) { ui.sheet = { kind: "vault", id: recordId, justRendered: false }; render(); return; }
  if (type === "inbox") { ui.sheet = { kind: "inbox", id: recordId, justRendered: false }; render(); }
}
function renderCardPreviewSheet() {
  const { type, recordId } = ui.sheet;
  const payload = sharePayload(type, recordId);
  if (!payload) return "";
  const lines = payload.text.split("\n").slice(1).filter(Boolean);
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet card-preview-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${esc(payload.title)}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><p class="eyebrow">Просмотр записи</p>${lines.length ? `<div class="detail-block">${lines.map(line => `<p>${esc(line)}</p>`).join("")}</div>` : `<p class="section-note">Подробностей пока нет.</p>`}<div class="inline-actions"><button type="button" data-action="card-preview-settings">${icon("settings")}Настроить</button><button type="button" data-action="card-preview-share">${icon("share")}Поделиться</button></div></section></div>`;
}
/** Удаление полным свайпом: без перерисовки — на месте строки остаётся «Вернуть». */
function swipeDeleteFull(row) {
  const { swipeType: type, swipeId: recordId } = row.dataset;
  const before = data.trash.length;
  const paint = window.render, say = window.toast;
  window.render = () => {}; window.toast = () => {};
  try { deleteSwipeCard(row); } finally { window.render = paint; window.toast = say; }
  if (data.trash.length === before) { closeSwipeRows(); toast(type === "finance:account" ? (savingsAccount()?.id === recordId ? "Накопительный счёт постоянный — удалить нельзя" : "Счёт связан с операциями") : "Не удалось удалить"); return; }
  row.classList.remove("is-open-left");
  row.classList.add("is-deleted");
  row.innerHTML = `<div class="swipe-undo"><span>${icon("trash", "icon-sm")}Удалено</span><button type="button" data-action="swipe-undo" data-undo-id="${esc(recordId)}">Вернуть</button></div>`;
}
/**
 * Фильм смахнули вправо («просмотрено») или влево («не интересно»): он уходит
 * из списка, но строка остаётся полоской с «Вернуть» — как при удалении.
 */
function swipeMovieQuiet(row, change, label, iconName, undoAction, extra = "") {
  const recordId = row.dataset.swipeId;
  const paint = window.render, say = window.toast;
  window.render = () => {}; window.toast = () => {};
  try { change(); } finally { window.render = paint; window.toast = say; }
  row.classList.remove("is-open-left");
  row.classList.add("is-deleted");
  row.innerHTML = `<div class="swipe-undo"><span>${icon(iconName, "icon-sm")}${label}</span><span class="swipe-undo-buttons">${extra}<button type="button" data-action="${undoAction}" data-undo-id="${esc(recordId)}">Вернуть</button></span></div>`;
}
function swipeSeenQuiet(row, item) {
  if (!item) return;
  const becameSeen = !movieIsViewed(item);
  swipeMovieQuiet(row, () => toggleMovieViewed(item), becameSeen ? "Просмотрено" : "Снова в планах", becameSeen ? "eye" : "eyeOff", "swipe-seen-undo", becameSeen ? `<button type="button" data-action="movie-rate-open" data-id="${esc(item.id)}">Оценить</button>` : "");
}
function swipeSkipQuiet(row, item) {
  if (!item) return;
  const becomes = !item.skipped;
  swipeMovieQuiet(row, () => toggleMovieSkipped(item, true), becomes ? "Не интересно — учту в подборке" : "Вернул в планы", "thumbDown", "swipe-skip-undo");
}
function deleteSwipeCard(row) {
  const { swipeType: type, swipeId: recordId } = row.dataset;
  closeSwipeRows();
  if (type === "note" || type.startsWith("saved:")) { deleteSavedRecord(type === "note" ? "notes" : type.split(":")[1], recordId); return; }
  if (type === "finance:account" && typeof savingsAccount === "function" && savingsAccount()?.id === recordId) { toast("Накопительный счёт постоянный — удалить нельзя"); return; }
  if (type === "vault") {
    if (!ui.vaultUnlocked || !window.confirm("Удалить тестовую учётную запись навсегда?")) return;
    data.vault = data.vault.filter(x => x.id !== recordId); ui.vaultShown = null; render(); toast("Удалено окончательно"); return;
  }
  if (type.startsWith("finance:")) {
    const entity = type.split(":")[1];
    if (entity === "account" && (data.finance.transactions.some(x => x.accountId === recordId) || data.finance.transfers.some(x => x.fromId === recordId || x.toId === recordId))) { toast("Счёт связан с операциями. Сначала перенесите их."); return; }
    const list = financeEntityList(entity);
    const item = list.find(x => x.id === recordId);
    if (!item) return;
    pushTrash(type, item); list.splice(list.indexOf(item), 1); save(); toast("Запись в корзине"); return;
  }
  const list = { task: data.tasks, event: data.events, project: data.projects, metric: data.metrics, inbox: data.inbox }[type];
  if (!list) return;
  const item = list.find(x => x.id === recordId);
  if (!item) return;
  pushTrash(type, item); list.splice(list.indexOf(item), 1);
  if (type === "project" && ui.projectId === recordId) ui.projectId = null;
  save(); toast("Запись в корзине");
}
let swipeGesture = null;
let swipeSuppressUntil = 0;
let swipeSuppressRow = null;
let swipeSuppressKey = "";
// Свайп: две кнопки по 76 px (Изменить, Удалить). Палец захватывается, у края —
// мягкий упор, открывается по расстоянию или быстрому взмаху.
const SWIPE_OPEN = 132;
/** Сколько тянуть, чтобы открыть кнопки: у фильма их три (настроить, «не интересно», поделиться). */
const swipeOpenOf = () => SWIPE_OPEN;
const SWIPE_RIGHT = 112;
/** Докуда тянуть, чтобы удалить: большая часть ширины карточки. */
const swipeDeleteAt = row => -Math.max(SWIPE_OPEN + 70, Math.min(row.clientWidth * 0.62, 280));
function swipeResist(value, min, max) {
  if (value < min) return min + (value - min) * 0.25;
  if (value > max) return max + (value - max) * 0.25;
  return value;
}
document.addEventListener("pointerdown", event => {
  const row = event.target.closest(".swipe-row");
  if (!row || event.target.closest(".swipe-action, .task-drag-handle, .record-pin-toggle")) return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  swipeGesture = { row, id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp, lastX: event.clientX, lastT: event.timeStamp, speed: 0, base: row.classList.contains("is-open-left") ? -swipeOpenOf(row) : 0, open: swipeOpenOf(row), horizontal: false };
});
document.addEventListener("pointermove", event => {
  const gesture = swipeGesture;
  if (!gesture || gesture.id !== event.pointerId) return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  if (!gesture.horizontal) {
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { swipeGesture = null; return; }
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      gesture.horizontal = true;
      try { gesture.row.setPointerCapture(event.pointerId); } catch (_) {}
    }
  }
  if (!gesture.horizontal) return;
  const dt = Math.max(1, event.timeStamp - gesture.lastT);
  gesture.speed = (event.clientX - gesture.lastX) / dt;
  gesture.lastX = event.clientX; gesture.lastT = event.timeStamp;
  const right = gesture.row.classList.contains("swipe-seen") && gesture.base === 0 ? SWIPE_RIGHT : 0;
  const distance = swipeResist(gesture.base + dx, -gesture.row.clientWidth, right);
  gesture.row.classList.add("swiping");
  // Под карточкой видна только та сторона, куда её тянут.
  gesture.row.classList.toggle("dir-right", distance > 0);
  gesture.row.classList.toggle("dir-left", distance < 0);
  // Красный слой проявляется постепенно: от раскрытых кнопок до порога удаления.
  const deleteAt = swipeDeleteAt(gesture.row);
  const del = Math.max(0, Math.min(1, (-distance - gesture.open) / (-deleteAt - gesture.open)));
  gesture.row.style.setProperty("--del", del.toFixed(3));
  gesture.row.classList.toggle("delete-armed", distance < deleteAt);
  gesture.row.classList.toggle("swipe-armed", right > 0 && distance > 72);
  gesture.row.style.setProperty("--swipe-x", `${distance}px`);
});
document.addEventListener("pointerup", event => {
  const gesture = swipeGesture;
  if (!gesture || gesture.id !== event.pointerId) return;
  swipeGesture = null;
  const armedDelete = gesture.row.classList.contains("delete-armed");
  gesture.row.classList.remove("swiping", "swipe-armed", "delete-armed", "dir-right");
  gesture.row.style.removeProperty("--swipe-x");
  gesture.row.style.removeProperty("--del");
  if (!gesture.horizontal) return;
  const distance = gesture.base + event.clientX - gesture.x;
  const flick = Math.abs(gesture.speed) > 0.45;
  swipeSuppressUntil = Date.now() + 400;
  swipeSuppressRow = gesture.row;
  swipeSuppressKey = `${gesture.row.dataset.swipeType}:${gesture.row.dataset.swipeId}`;
  if (gesture.row.classList.contains("swipe-seen") && gesture.base === 0 && (distance > 72 || (flick && gesture.speed > 0 && distance > 30))) {
    closeSwipeRows();
    const [, category] = gesture.row.dataset.swipeType.split(":");
    const target = savedItem(category, gesture.row.dataset.swipeId);
    if (category === "movies") { swipeSeenQuiet(gesture.row, target); return; }
    else if (target) { target.viewed = !target.viewed; save(); render(); toast(target.viewed ? "Отмечено просмотренным" : "Отметка снята"); }
    return;
  }
  if (armedDelete && gesture.row.dataset.swipeType !== "vault") { swipeDeleteFull(gesture.row); return; }
  closeSwipeRows(gesture.row);
  const open = gesture.base === 0
    ? distance < -gesture.open / 2.5 || (flick && gesture.speed < 0 && distance < -24)
    : !(distance > -gesture.open + 36 || (flick && gesture.speed > 0));
  gesture.row.classList.toggle("is-open-left", open);
  gesture.row.querySelectorAll(".swipe-action").forEach(button => button.tabIndex = open ? 0 : -1);
});
document.addEventListener("pointercancel", () => { if (swipeGesture) { swipeGesture.row.classList.remove("swiping", "dir-right", "dir-left", "delete-armed", "swipe-armed"); swipeGesture.row.style.removeProperty("--swipe-x"); swipeGesture.row.style.removeProperty("--del"); swipeGesture = null; } });
document.addEventListener("click", event => {
  if (event.target.closest(".swipe-action")) return;
  const row = event.target.closest(".swipe-row");
  if (row && (row === swipeSuppressRow || `${row.dataset.swipeType}:${row.dataset.swipeId}` === swipeSuppressKey) && Date.now() < swipeSuppressUntil) {
    event.preventDefault(); event.stopImmediatePropagation(); return;
  }
  if (row && row.classList.contains("is-open-left")) {
    closeSwipeRows();
    event.preventDefault(); event.stopImmediatePropagation(); return;
  }
  if (row && event.target.closest(".swipe-content")) {
    if (event.target.closest(".task-drag-handle")) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if ((ui.page === "today" || ui.page === "upcoming") && row.dataset.swipeType === "task" && event.target.closest(".task-card") && !event.target.closest(".task-check, .task-drag-handle, .task-sub")) {
      event.preventDefault(); event.stopImmediatePropagation();
      toggleTask(row.dataset.swipeId); return;
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    const nativeViews = new Set(["saved-open", "project-open", "project-note", "project-saved"]);
    const inlineActions = new Set(["toggle-task", "task-check-item", "task-checklist-toggle", "finance-open-payments", "vault-reveal", "vault-copy", "payment-confirm", "inbox-task", "inbox-archive", "saved-pin-card"]);
    const explicitSettings = event.target.closest('.budget-card [data-action="finance-edit"], .budget-card [data-action="vault-edit"]');
    if (!inlineActions.has(action) && !nativeViews.has(action) && !explicitSettings) {
      event.preventDefault(); event.stopImmediatePropagation();
      openSwipeCard(row, "view"); return;
    }
  }
  closeSwipeRows();
}, true);
document.addEventListener("visibilitychange", () => { if (document.hidden && ui.vaultShown) hideVaultSecret(); });
