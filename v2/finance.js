// «Переводы» — вид операций, «Цели» — часть «Счетов»: отдельные вкладки дублировали их.
const FINANCE_TABS = [["overview", "Обзор"], ["transactions", "Операции"], ["accounts", "Счета и цели"], ["payments", "Платежи"], ["debts", "Долги"], ["budgets", "Бюджеты"], ["rules", "Правила"]];
/** Сверка остатка («не записал») — поправка счёта, а не доход или расход. */
const RECONCILE = "не записал";
const isReconcile = t => t.category === RECONCILE;
// Один список с сервером (categories.ts): «Еда» и «продукты» — одна категория.
const FINANCE_CATEGORIES = ["Продукты", "Кафе и рестораны", "Транспорт", "Жильё", "Связь и интернет", "Подписки", "Здоровье", "Развлечения", "Путешествия", "Дом и быт", "Подарки", "Одежда", "Образование", "Переводы", "Кредиты", "Прочее"];
function monthTransactions() { return data.finance.transactions.filter(t => t.date?.startsWith(todayIso().slice(0, 7))); }
function sumTransactions(kind, currency = "RUB") { return monthTransactions().filter(t => t.kind === kind && t.currency === currency && !isReconcile(t)).reduce((sum, t) => sum + Number(t.amount || 0), 0); }
function accountBalance(account) {
  const operations = data.finance.transactions.filter(t => t.accountId === account.id).reduce((sum, t) => sum + (t.kind === "income" ? 1 : -1) * Number(t.amount || 0), 0);
  const transfers = data.finance.transfers.reduce((sum, t) => sum + (t.toId === account.id ? Number(t.toAmount || 0) : 0) - (t.fromId === account.id ? Number(t.amount || 0) : 0), 0);
  return Number(account.opening || 0) + operations + transfers;
}
// Деньги целей в «Доступно» не входят: они отложены, их показывают цели.
function rubBalance() { return data.finance.accounts.filter(a => a.currency === "RUB" && a.kind !== "goal").reduce((sum, a) => sum + accountBalance(a), 0); }
function categorySpent(category) { return monthTransactions().filter(t => t.kind === "expense" && t.category === category && t.currency === "RUB").reduce((sum, t) => sum + Number(t.amount || 0), 0); }
/** Курс ЦБ к рублю: с сервера (data.finance.rates); нет курса — null, а не единица. */
function rateOf(code) { return code === "RUB" ? 1 : Number(data.finance.rates?.[code]) || null; }
const ruMoney = n => Math.round(n).toLocaleString("ru-RU").replace(/\u00a0/g, " ");
/** Валютные счета в рублях по курсу ЦБ и сумма всего. */
function foreignSummary() {
  const foreign = spendAccounts().filter(a => a.currency !== "RUB");
  if (!foreign.length) return null;
  const parts = foreign.map(a => ({ account: a, amount: accountBalance(a), rub: rateOf(a.currency) ? accountBalance(a) * rateOf(a.currency) : null }));
  const known = parts.filter(p => p.rub !== null);
  return { parts, rub: known.reduce((sum, p) => sum + p.rub, 0), complete: known.length === parts.length };
}
function ratesStrip() {
  const codes = ["USD", "EUR", "CNY"].filter(c => rateOf(c));
  if (!codes.length) return "";
  return `<div class="rates-strip" aria-label="Курсы ЦБ РФ">${codes.map(c => `<span><b>${c}</b> ${rateOf(c).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽</span>`).join("")}<small>ЦБ РФ</small></div>`;
}
function financeTabs() { return `<div class="subtabs" role="tablist" aria-label="Разделы финансов">${FINANCE_TABS.map(([key, label]) => `<button type="button" role="tab" aria-selected="${ui.financeTab === key}" class="${ui.financeTab === key ? "active" : ""}" data-action="finance-tab" data-tab="${key}">${label}</button>`).join("")}</div>`; }
function financeTransactionRow(item) {
  const account = data.finance.accounts.find(a => a.id === item.accountId);
  return `<button class="finance-row finance-row-button" type="button" data-action="finance-edit" data-entity="transaction" data-id="${esc(item.id)}"><span class="list-icon tx-icon" style="--cat:${isReconcile(item) ? "var(--muted)" : categoryColor(item.category)}">${icon(isReconcile(item) ? "reset" : item.kind === "income" ? "download" : "wallet")}</span><span class="list-copy"><strong>${esc(isReconcile(item) ? "Сверка остатка" : item.title)}</strong><span>${esc(isReconcile(item) ? "поправка счёта" : item.category)} · ${esc(dateLabel(item.date))}${account ? ` · ${esc(account.name)}` : ""}</span></span><span class="amount ${item.kind === "income" ? "income" : ""}">${item.kind === "income" ? "+" : "−"}${demoMoney(item.amount, item.currency)}</span></button>`;
}
function budgetCard(item) {
  const spent = categorySpent(item.category);
  const pct = item.limit ? Math.round(spent / item.limit * 100) : 0;
  const day = new Date().getDate();
  const monthDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const forecast = day ? Math.round(spent / day * monthDays) : 0;
  const predictedDay = spent > 0 ? Math.ceil(Number(item.limit) / (spent / day)) : null;
  const predictedDate = predictedDay && predictedDay <= monthDays ? localIso(new Date(new Date().getFullYear(), new Date().getMonth(), predictedDay, 12)) : null;
  const warning = spent > item.limit ? "Лимит превышен." : forecast > item.limit && predictedDate ? `При таком темпе лимит закончится ${dateLabel(predictedDate)}.` : "Темп в пределах лимита.";
  return `<div class="budget-card"><div class="budget-top"><span>${esc(item.category)}</span><span>${demoMoney(spent)} / ${demoMoney(item.limit)}</span></div><div class="progress-track"><span style="width:${Math.min(100, pct)}%;background:${pct > 100 ? "var(--warn)" : "var(--accent)"}"></span></div><span class="budget-note">${pct}% лимита · ${warning}</span><button class="text-action" type="button" data-action="finance-edit" data-entity="budget" data-id="${esc(item.id)}">Настроить</button></div>`;
}
/** Цвет категории — постоянный, по названию: одна и та же категория везде одного цвета. */
const CATEGORY_COLORS = ["#e0662a", "#2f80ed", "#1f9d8a", "#d6406a", "#7b4bd6", "#e0a21e", "#43a047", "#8d6e63", "#0b8fb3", "#c2185b", "#5c6bc0", "#9e9d24"];
function categoryColor(name) {
  // По месту в тратах месяца — соседние категории никогда не совпадают по цвету.
  const rank = monthCategories("expense").findIndex(([n]) => n === name);
  if (rank >= 0) return CATEGORY_COLORS[rank % CATEGORY_COLORS.length];
  let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) | 0; return CATEGORY_COLORS[Math.abs(h) % CATEGORY_COLORS.length];
}
/** Траты месяца по категориям — какие есть на самом деле, а не из заранее заданного списка. */
function monthCategories(kind = "expense") {
  const sums = new Map();
  for (const t of monthTransactions()) {
    if (t.kind !== kind || t.currency !== "RUB" || t.category === "не записал") continue;
    const name = t.category || "Прочее";
    sums.set(name, (sums.get(name) || 0) + Number(t.amount || 0));
  }
  return [...sums.entries()].sort((a, b) => b[1] - a[1]);
}
function thisMonthName() { return new Date().toLocaleDateString("ru-RU", { month: "long" }); }
function categoriesCard() {
  const rows = monthCategories();
  if (!rows.length) return emptyCard("Расходов пока нет", "Траты месяца по категориям появятся здесь.");
  const total = rows.reduce((s, [, v]) => s + v, 0);
  const bar = `<div class="cat-bar" role="img" aria-label="Доли категорий">${rows.map(([name, v]) => `<i style="flex:${v};background:${categoryColor(name)}"></i>`).join("")}</div>`;
  const list = rows.map(([name, v]) => `<button class="cat-row" type="button" data-action="finance-category" data-category="${esc(name)}"><i class="cat-dot" style="background:${categoryColor(name)}"></i><span class="cat-name">${esc(name)}</span><span class="cat-share">${Math.round(v / total * 100)}%</span><span class="cat-sum">${demoMoney(v)}</span>${icon("right", "icon-sm")}</button>`).join("");
  return `<div class="side-card cat-card"><div class="cat-head"><span>Всего за ${esc(thisMonthName())}</span><strong>${demoMoney(total)}</strong></div>${bar}<div class="cat-list">${list}</div></div>`;
}
function financeOverview() {
  // Сверки остатка («не записал») — поправка счёта, а не доход или расход.
  const real = kind => sumTransactions(kind);
  const income = real("income");
  const expense = real("expense");
  const debtsToMe = data.finance.debts.filter(d => d.direction === "to-me").reduce((sum, d) => sum + Math.max(0, d.amount - d.paid), 0);
  const debtsIOwe = data.finance.debts.filter(d => d.direction === "i-owe").reduce((sum, d) => sum + Math.max(0, d.amount - d.paid), 0);
  const pending = data.finance.payments.filter(p => p.status === "pending" && p.nextOn && p.nextOn <= offsetIso(3));
  const accounts = spendAccounts().map(a => `<div class="side-row"><span>${esc(a.name)} · ${esc(a.currency)}</span><b>${demoMoney(accountBalance(a), a.currency)}</b></div>`).join("");
  // Доходы и расходы — что записано за этот месяц. Нажатие — операции, как в банке.
  const count = kind => monthTransactions().filter(t => t.kind === kind && t.currency === "RUB" && !isReconcile(t)).length;
  const tile = (label, value, kind) => `<button type="button" class="kpi kpi-button" data-action="finance-kind" data-kind="${kind}"><span class="kpi-label">${label}</span><span class="kpi-value">${demoMoney(value)}</span><span class="kpi-hint">${esc(thisMonthName())} · ${count(kind)} ${word(count(kind), "операция", "операции", "операций")} ${icon("right", "icon-sm")}</span></button>`;
  return `<button class="finance-hero finance-hero-button" type="button" data-action="finance-accounts" aria-label="Все счета"><p class="eyebrow">Доступно на счетах · ₽</p><strong>${demoMoney(rubBalance())}</strong>${(() => { const fx = foreignSummary(); return fx ? `<span class="section-note">Ещё ${fx.parts.map(p => demoMoney(p.amount, p.account.currency)).join(" · ")}${fx.rub ? ` ≈ ${ruMoney(fx.rub)} ₽ по курсу ЦБ` : ""}</span>${fx.complete && fx.rub ? `<span class="section-note fx-total">Всего с валютой ≈ ${ruMoney(rubBalance() + fx.rub)} ₽</span>` : ""}` : ""; })()}<span class="finance-hero-more">${spendAccounts().length} ${spendAccounts().length === 1 ? "счёт" : spendAccounts().length < 5 ? "счёта" : "счетов"} ${icon("right", "icon-sm")}</span></button><div class="kpi-grid finance-summary">${tile("Доходы", income, "income")}${tile("Расходы", expense, "expense")}<div class="kpi"><span class="kpi-label">Должны мне</span><span class="kpi-value">${demoMoney(debtsToMe)}</span><span class="kpi-hint">отдельно от баланса</span></div><div class="kpi"><span class="kpi-label">Должен я</span><span class="kpi-value">${demoMoney(debtsIOwe)}</span><span class="kpi-hint">отдельно от баланса</span></div></div><div class="finance-quick"><button type="button" data-action="finance-add" data-entity="transaction" data-kind="expense">+ Расход</button><button type="button" data-action="finance-add" data-entity="transaction" data-kind="income">+ Доход</button><button type="button" data-action="finance-add" data-entity="transfer">+ Перевод</button></div>${pending.length ? cardSection("Ближайшие платежи", `<div class="list-panel">${pending.map(paymentRow).join("")}</div>`) : ""}${cardSection("Расходы по категориям", categoriesCard())}${data.finance.budgets.length ? cardSection("Бюджеты", data.finance.budgets.map(budgetCard).join("")) : ""}${cardSection("Цели накопления", data.finance.goals.map(goalCard).join("") || emptyCard("Целей пока нет", "Задайте сумму — прогресс будет виден здесь."), "", `<button class="text-action" type="button" data-action="finance-add" data-entity="goal">Добавить ${icon("plus", "icon-sm")}</button>`)}${cardSection("Счета", `<div class="side-card">${accounts}</div>`, "", `<button class="text-action" type="button" data-action="finance-add" data-entity="account">Добавить ${icon("plus", "icon-sm")}</button>`)}`;
}
function financeTransactionsPage() {
  // Как в банке: доходы или расходы месяца, сверху — итог и категории-фильтры.
  const kind = ui.financeKind || "";
  if (kind === "transfer") return `${financeKindTabs(kind)}${financeTransfersPage()}`;
  const pool = monthTransactions().filter(t => (!kind || t.kind === kind) && (!kind || !isReconcile(t)));
  const items = pool.filter(t => !ui.financeCategory || t.category === ui.financeCategory).sort((a, b) => b.date.localeCompare(a.date));
  const total = items.filter(t => t.currency === "RUB").reduce((s, t) => s + Number(t.amount || 0), 0);
  const cats = kind ? monthCategories(kind) : [];
  const chips = cats.length > 1 ? `<div class="map-categories tx-cats"><button class="map-category-chip ${!ui.financeCategory ? "active" : ""}" type="button" data-action="finance-clear-category">Все</button>${cats.map(([name, v]) => `<button class="map-category-chip ${ui.financeCategory === name ? "active" : ""}" type="button" data-action="finance-category" data-category="${esc(name)}" style="--map-color:${categoryColor(name)}"><i class="cat-dot" style="background:${categoryColor(name)}"></i>${esc(name)}<span>${ruMoney(v)}</span></button>`).join("")}</div>` : "";
  const kinds = financeKindTabs(kind);
  const head = kind ? `<div class="tx-total"><span>${kind === "income" ? "Доходы" : "Расходы"} · ${esc(thisMonthName())}${ui.financeCategory ? ` · ${esc(ui.financeCategory)}` : ""}</span><strong class="${kind === "income" ? "income" : ""}">${kind === "income" ? "+" : "−"}${demoMoney(total)}</strong></div>` : "";
  return `${kinds}${head}${chips}<div class="section-heading"><h2>${ui.financeCategory ? esc(ui.financeCategory) : "Операции месяца"}</h2><button class="text-action" type="button" data-action="finance-add" data-entity="transaction" data-kind="${kind === "income" ? "income" : "expense"}">Добавить ${icon("plus", "icon-sm")}</button></div><div class="list-panel">${items.length ? items.map(financeTransactionRow).join("") : `<div class="empty-card"><strong>Операций нет</strong>Выберите другую категорию или добавьте запись.</div>`}</div><div class="inline-actions">${window.SOROKA_LIVE ? "" : `<button type="button" data-action="finance-receipt">${icon("upload")}Проверить чек</button>`}<button type="button" data-action="finance-export">${icon("download")}CSV</button></div>`;
}
function financeKindTabs(kind) {
  return `<div class="subtabs tx-kinds" role="tablist">${[["", "Все"], ["expense", "Расходы"], ["income", "Доходы"], ["transfer", "Переводы"]].map(([k, label]) => `<button type="button" role="tab" class="${kind === k ? "active" : ""}" aria-selected="${kind === k}" data-action="finance-kind" data-kind="${k}">${label}</button>`).join("")}</div>`;
}
function financeAccountsPage() {
  return `<div class="section-heading"><h2>Счета</h2><button class="text-action" type="button" data-action="finance-add" data-entity="account">Добавить ${icon("plus", "icon-sm")}</button></div>${accountGroups()}${ratesStrip()}<p class="section-note">Рубли и валюта считаются отдельно; в «Доступно» валюта добавляется по курсу ЦБ на сегодня.</p>`;
}
function financeTransfersPage() {
  const accounts = data.finance.accounts;
  return `<div class="section-heading"><h2>Переводы между счетами</h2><button class="text-action" type="button" data-action="finance-add" data-entity="transfer">Новый перевод ${icon("plus", "icon-sm")}</button></div><p class="section-note">Перевод меняет остатки двух счетов, но не считается доходом или расходом. Для разных валют укажите сумму зачисления вручную.</p>${data.finance.transfers.length ? `<div class="list-panel section">${data.finance.transfers.slice().reverse().map(t => { const from = accounts.find(x => x.id === t.fromId); const to = accounts.find(x => x.id === t.toId); return `<button class="finance-row finance-row-button" type="button" data-action="finance-edit" data-entity="transfer" data-id="${esc(t.id)}"><span class="list-icon">${icon("arrow")}</span><span class="list-copy"><strong>${esc(from?.name || "Счёт")} → ${esc(to?.name || (t.toId ? "Счёт" : "вне учёта"))}</strong><span>${esc(dateLabel(t.date))}${t.note ? ` · ${esc(t.note)}` : ""}</span></span><span class="amount">${demoMoney(t.amount, from?.currency)}</span></button>`; }).join("")}</div>` : emptyCard("Переводов пока нет", "Добавьте первый перевод между счетами.")}`;
}
function financeBudgetsPage() { return `<div class="section-heading"><h2>Бюджеты</h2><button class="text-action" type="button" data-action="finance-add" data-entity="budget">Добавить ${icon("plus", "icon-sm")}</button></div>${data.finance.budgets.map(budgetCard).join("") || emptyCard("Бюджетов нет", "Добавьте лимит для категории.")}`; }
/** Цель: нажали — отложить сумму. Настройка цели — ссылкой внизу окна. */
function openGoalDeposit(recordId) { ui.sheet = { kind: "goal-deposit", id: recordId, justRendered: false }; render(); }
function renderGoalDepositSheet() {
  const goal = data.finance.goals.find(g => g.id === ui.sheet.id);
  if (!goal) return "";
  const progress = goal.target > 0 ? Math.min(100, Math.round(goal.saved / goal.target * 100)) : 0;
  const left = Math.max(0, goal.target - goal.saved);
  const chips = [500, 1000, 5000, 10000].map(n => `<button type="button" class="goal-chip" data-action="goal-deposit-chip" data-amount="${n}">+${n.toLocaleString("ru-RU")}</button>`).join("");
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet goal-deposit-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${esc(goal.title)}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><div class="goal-deposit-progress"><strong>${demoMoney(goal.saved)}</strong><span>из ${demoMoney(goal.target)} · ${progress}%</span><div class="progress-track"><span style="width:${progress}%"></span></div><small>${left > 0 ? `Осталось ${demoMoney(left)}` : "Цель достигнута"}</small></div><form id="goal-deposit-form">${goalAccountOf(goal) ? `<label class="field">Счёт<select name="from">${spendAccounts().filter(a => a.currency === "RUB").sort((a, b) => accountBalance(b) - accountBalance(a)).map(a => `<option value="${esc(a.id)}">${esc(a.name)} · ${demoMoney(accountBalance(a), a.currency)}</option>`).join("")}</select></label>` : ""}${amountSlider("Сумма, ₽", "amount", "", left > 0 ? left : Math.max(goal.saved, goal.target), 'placeholder="0" required')}<div class="goal-chips">${chips}</div><p class="form-error" role="alert"></p><div class="sheet-actions"><button class="ghost-button" type="button" data-action="goal-withdraw">Снять</button><button class="primary-button" type="submit">Отложить</button></div></form><button class="text-action goal-settings" type="button" data-action="finance-edit" data-entity="goal" data-id="${esc(goal.id)}">Настроить цель</button></section></div>`;
}
/** Счёт цели: у каждой цели свой, как «цели» в банковском приложении. */
function goalAccountOf(goal) {
  const account = data.finance.accounts.find(a => a.id === goal?.accountId);
  return account && account.kind === "goal" ? account : null;
}
/** Счета для трат и переводов — без счетов целей: деньги в цель идут только через «Отложить». */
function spendAccounts() { return data.finance.accounts.filter(a => a.kind !== "goal"); }
/** Основной накопительный — постоянный: переименовать можно, удалить нельзя. */
function savingsAccount() {
  return data.finance.accounts.find(a => a.savings) || data.finance.accounts.find(a => a.kind === "deposit") || null;
}
function accountRow(a) {
  const savings = a === savingsAccount();
  return `<button class="finance-row finance-row-button" type="button" data-action="finance-edit" data-entity="account" data-id="${esc(a.id)}"><span class="list-icon">${icon(savings ? "chart" : "wallet")}</span><span class="list-copy"><strong>${esc(a.name)}</strong><span>${savings ? "Накопительный" : esc(a.currency)}</span></span><span class="amount">${demoMoney(accountBalance(a), a.currency)}</span></button>`;
}
function goalRow(goal) {
  const progress = goal.target > 0 ? Math.min(100, Math.round(goal.saved / goal.target * 100)) : 0;
  return `<button class="finance-row finance-row-button goal-row" type="button" data-action="goal-open" data-id="${esc(goal.id)}"><span class="list-icon">${icon("check")}</span><span class="list-copy"><strong>${esc(goal.title)}</strong><span class="progress-track"><span style="width:${progress}%"></span></span></span><span class="amount">${demoMoney(goal.saved)}<small>из ${demoMoney(goal.target)}</small></span></button>`;
}
/** Счета, ниже — цели отдельными счетами. */
function accountGroups() {
  return `<div class="list-panel">${spendAccounts().map(accountRow).join("") || emptyCard("Счетов пока нет", "Добавьте первый счёт.")}</div><div class="accounts-group-head"><h3>Цели</h3><button class="text-action" type="button" data-action="finance-add" data-entity="goal">Новая цель ${icon("plus", "icon-sm")}</button></div><div class="list-panel">${data.finance.goals.map(goalRow).join("") || emptyCard("Целей пока нет", "У каждой цели будет свой счёт.")}</div>`;
}
/** Окно «Все счета»: остатки, нажатие — настройки счёта или пополнение цели. */
function renderAccountsSheet() {
  const rub = spendAccounts().filter(a => a.currency === "RUB");

  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet accounts-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Счета</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><div class="accounts-total"><small>В рублях на ${rub.length} ${rub.length === 1 ? "счёте" : "счетах"}</small><strong>${demoMoney(rubBalance())}</strong></div>${accountGroups()}<div class="sheet-actions"><button class="ghost-button" type="button" data-action="finance-add" data-entity="transfer">Перевод</button><button class="primary-button" type="button" data-action="finance-add" data-entity="account">Добавить счёт</button></div></section></div>`;
}
/** Верх ползунка по прошлым суммам: чтобы обычная сумма была в середине, а не у края. */
function typicalTop(values, floor) {
  const list = values.map(Number).filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  const high = list.length ? list[Math.floor(list.length * 0.9)] : 0;
  return Math.max(floor, high * 1.5);
}
function goalDepositApply(sign) {
  const goal = data.finance.goals.find(g => g.id === ui.sheet?.id);
  const input = document.querySelector('#goal-deposit-form input[name="amount"]');
  const error = document.querySelector("#goal-deposit-form .form-error");
  const amount = Math.round(Number(String(input?.value || "").replace(",", ".")) * 100) / 100;
  if (!goal || !(amount > 0)) { if (error) error.textContent = "Введите сумму"; return; }
  const home = goalAccountOf(goal);
  if (home) {
    // «Отложить» — перевод с выбранного счёта на счёт цели, «Снять» — обратно.
    const other = data.finance.accounts.find(a => a.id === document.querySelector('#goal-deposit-form select[name="from"]')?.value);
    if (!other) { if (error) error.textContent = "Выберите счёт"; return; }
    // В минус не уходим: ни счёт, с которого откладываем, ни сама цель.
    if (sign > 0 && accountBalance(other) < amount) { if (error) error.textContent = `На «${other.name}» только ${demoMoney(accountBalance(other))}`; return; }
    if (sign < 0 && accountBalance(home) < amount) { if (error) error.textContent = `В цели только ${demoMoney(accountBalance(home))}`; return; }
    data.finance.transfers.push({ id: id(), fromId: sign > 0 ? other.id : home.id, toId: sign > 0 ? home.id : other.id, amount, toAmount: amount, date: todayIso(), note: sign > 0 ? `В цель «${goal.title}»` : `Из цели «${goal.title}»` });
  }
  goal.saved = Math.max(0, Math.round((Number(goal.saved || 0) + sign * amount) * 100) / 100);
  const progress = goal.target > 0 ? Math.min(100, Math.round(goal.saved / goal.target * 100)) : 0;
  ui.sheet = null; save(); toast(`${sign > 0 ? "Отложено" : "Снято"} ${demoMoney(amount)} · цель на ${progress}%`);
}
function goalCard(goal) {
  const progress = goal.target > 0 ? Math.min(100, Math.round(goal.saved / goal.target * 100)) : 0;
  return `<div class="budget-card"><div class="budget-top"><span>${esc(goal.title)}</span><span>${demoMoney(goal.saved)} / ${demoMoney(goal.target)}</span></div><div class="progress-track"><span style="width:${progress}%"></span></div><span class="budget-note">${progress}% накоплено${(() => { const product = (data.saved?.products || []).find(p => p.goalId === goal.id); return product ? ` · на «${esc(product.title.slice(0, 40))}», сумма = его цена` : goal.note ? ` · ${esc(goal.note)}` : ""; })()}</span><button class="text-action" type="button" data-action="finance-edit" data-entity="goal" data-id="${esc(goal.id)}">Настроить</button></div>`;
}
function financeGoalsPage() { return `<div class="section-heading"><h2>Цели накопления</h2><button class="text-action" type="button" data-action="finance-add" data-entity="goal">Добавить ${icon("plus", "icon-sm")}</button></div>${data.finance.goals.map(goalCard).join("") || emptyCard("Целей пока нет", "Задайте сумму и отслеживайте прогресс.")}<p class="section-note">Прогресс цели — отдельная запись. Перевод на счёт задаётся во вкладке «Переводы».</p>`; }
/** Платёж в рублях по курсу ЦБ; курса нет — null (а не «как будто рубли»). */
function paymentRub(p) {
  const rate = rateOf(p.currency || "RUB");
  return rate ? Number(p.amount) * rate : null;
}
function paymentMoney(p) {
  const rub = (p.currency || "RUB") !== "RUB" ? paymentRub(p) : null;
  return `${demoMoney(p.amount, p.currency || "RUB")}${rub ? `<small class="amount-rub">≈ ${ruMoney(rub)} ₽</small>` : ""}`;
}
function paymentDate(p) {
  return p.nextOn ? dateLabel(p.nextOn) : `${p.day}-го`;
}
/** Строка платежа: дата, сумма, «Списалось»; кредит — из «Долгов», только оплатить. */
function paymentRow(p) {
  const late = p.status !== "confirmed" && p.nextOn && p.nextOn < todayIso();
  const facts = [paymentDate(p), p.category, p.endsOn ? `до ${dateLabel(p.endsOn)}${p.endsOn.slice(0, 4) !== todayIso().slice(0, 4) ? ` ${p.endsOn.slice(0, 4)}` : ""}` : "", p.locked ? "из «Долгов»" : ""].filter(Boolean).join(" · ");
  return `<article class="payment-card ${p.status === "confirmed" ? "done" : ""} ${late ? "late" : ""}"><span class="list-icon">${icon(p.locked ? "wallet" : "calendar")}</span><span class="list-copy"><strong>${esc(p.title)}</strong><span>${esc(facts)}${p.status === "confirmed" ? " · оплачено" : ""}</span></span><span class="amount">${paymentMoney(p)}</span><div class="payment-actions">${p.status !== "confirmed" ? miniButton("Списалось", "payment-confirm", `data-id="${esc(p.id)}"`) : ""}${p.locked ? miniButton("В долгах", "finance-edit", `data-entity="debt" data-id="${esc(p.creditId)}"`) : miniButton("Настроить", "finance-edit", `data-entity="payment" data-id="${esc(p.id)}"`)}</div></article>`;
}
function financePaymentsPage() {
  const known = data.finance.payments.map(paymentRub);
  const monthly = known.reduce((sum, v) => sum + (v || 0), 0);
  const gaps = known.some(v => v === null);
  const list = data.finance.payments.slice().sort((a, b) => String(a.nextOn || "9").localeCompare(String(b.nextOn || "9")));
  return `<div class="finance-hero"><p class="eyebrow">Обязательные платежи</p><strong>${demoMoney(monthly)}</strong><span class="section-note">в месяц · ${demoMoney(monthly * 12)} в год${data.finance.payments.some(p => (p.currency || "RUB") !== "RUB") ? " · валюта по курсу ЦБ" : ""}${gaps ? " · без платежей, для которых нет курса" : ""}</span></div><div class="section-heading"><h2>Подписки, счета и кредиты</h2><button class="text-action" type="button" data-action="finance-add" data-entity="payment">Добавить ${icon("plus", "icon-sm")}</button></div><div class="payment-list">${list.map(paymentRow).join("")}</div><p class="section-note">«Списалось» записывает расход днём оплаты. Если списание уже пришло уведомлением банка, второго не будет. Кредиты меняются в «Долгах».</p>`;
}
function creditRow(d) {
  const left = Math.max(0, d.amount - d.paid);
  const progress = d.amount > 0 ? Math.min(100, Math.round(d.paid / d.amount * 100)) : 0;
  const facts = [d.monthly ? `${demoMoney(d.monthly)}/мес` : "", d.payDay ? `${d.payDay}-го` : "", d.rate ? `${d.rate}%` : "", d.endsOn ? `до ${dateLabel(d.endsOn)}` : ""].filter(Boolean).join(" · ");
  return `<article class="credit-card"><button class="finance-row finance-row-button" type="button" data-action="finance-edit" data-entity="debt" data-id="${esc(d.id)}"><span class="list-icon">${icon("wallet")}</span><span class="list-copy"><strong>${esc(d.person)}</strong><span>${esc(facts || "Кредит")}</span></span><span class="amount">${demoMoney(left)}<small>осталось</small></span></button><div class="progress-track"><span style="width:${progress}%"></span></div><div class="payment-actions"><small>Выплачено ${progress}% · ${demoMoney(d.paid)} из ${demoMoney(d.amount)}</small>${d.monthly && left > 0 ? miniButton("Платёж внесён", "credit-pay", `data-id="${esc(d.id)}"`) : ""}</div></article>`;
}
function financeDebtsPage() {
  const debts = data.finance.debts.filter(d => d.kind !== "credit");
  const credits = data.finance.debts.filter(d => d.kind === "credit");
  const sum = dir => debts.filter(d => d.direction === dir).reduce((total, d) => total + Math.max(0, d.amount - d.paid), 0);
  const creditLeft = credits.reduce((total, d) => total + Math.max(0, d.amount - d.paid), 0);
  const monthly = credits.reduce((total, d) => total + (Number(d.monthly) || 0), 0);
  const kpis = `<div class="kpi-grid"><div class="kpi"><span class="kpi-label">Должны мне</span><span class="kpi-value">${demoMoney(sum("to-me"))}</span></div><div class="kpi"><span class="kpi-label">Должен я</span><span class="kpi-value">${demoMoney(sum("i-owe"))}</span></div>${credits.length ? `<div class="kpi"><span class="kpi-label">Кредиты</span><span class="kpi-value">${demoMoney(creditLeft)}</span><span class="kpi-hint">${monthly ? `${demoMoney(monthly)} в месяц` : "остаток"}</span></div>` : ""}</div>`;
  const debtRows = debts.map(d => `<button class="finance-row finance-row-button" type="button" data-action="finance-edit" data-entity="debt" data-id="${esc(d.id)}"><span class="list-icon">${icon("wallet")}</span><span class="list-copy"><strong>${esc(d.person)}</strong><span>${d.direction === "to-me" ? "Должен мне" : "Я должен"}${d.note ? ` · ${esc(d.note)}` : ""}</span></span><span class="amount">${demoMoney(Math.max(0, d.amount - d.paid))}</span></button>`).join("");
  return `${kpis}<div class="section-heading section"><h2>Долги</h2><button class="text-action" type="button" data-action="finance-add" data-entity="debt">Добавить ${icon("plus", "icon-sm")}</button></div>${debts.length ? `<div class="list-panel">${debtRows}</div>` : emptyCard("Долгов нет", "Кто-то должен вам или вы кому-то — запишите, чтобы не забыть.")}<div class="section-heading section"><h2>Кредиты</h2><button class="text-action" type="button" data-action="finance-add" data-entity="debt" data-kind="credit">Добавить ${icon("plus", "icon-sm")}</button></div>${credits.length ? `<div class="credit-list">${credits.map(creditRow).join("")}</div>` : emptyCard("Кредитов нет", "Кредит, ипотека, рассрочка: сумма, ставка и ежемесячный платёж — прогресс выплаты будет виден здесь.")}`;
}
/** Доходы и расходы в месяц: записано не всё — человек называет настоящие цифры. */
function reconcileForm() {
  const recorded = data.finance.rulesAuto?.recorded;
  return `<form id="rules-reconcile-form" class="rules-reconcile"><div class="rules-reconcile-head"><strong>Доходы и расходы в месяц</strong><small>${recorded ? `По записям за три месяца: доходы ${ruMoney(recorded.income)} ₽, расходы ${ruMoney(recorded.expense)} ₽.` : "Пока записей мало."} Записано не всё? Впишите настоящие цифры — по ним посчитается только распределение; обзор и операции всегда показывают записанное.</small></div><div class="field-row"><label class="field">Доходы, ₽<input name="rulesIncome" type="number" inputmode="numeric" min="0" step="100" value="${esc(data.settings?.rulesIncome || "")}" placeholder="${recorded ? ruMoney(recorded.income) : "как записано"}"></label><label class="field">Расходы, ₽<input name="rulesExpense" type="number" inputmode="numeric" min="0" step="100" value="${esc(data.settings?.rulesExpense || "")}" placeholder="${recorded ? ruMoney(recorded.expense) : "как записано"}"></label></div><div class="sheet-actions">${data.settings?.rulesIncome || data.settings?.rulesExpense ? `<button class="ghost-button" type="button" data-action="rules-reconcile-reset">Считать по записям</button>` : ""}<button class="primary-button" type="submit">Сохранить</button></div></form>`;
}
function renderReconcileSheet() {
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Доходы и расходы</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div>${reconcileForm()}</section></div>`;
}
function financeRulesPage() {
  const income = data.finance.transactions.filter(t => t.kind === "income" && t.currency === "RUB").sort((a, b) => b.date.localeCompare(a.date))[0];
  const auto = Boolean(data.settings?.rulesAuto);
  const info = data.finance.rulesAuto;
  const toggle = `<label class="rules-auto ${auto ? "on" : ""}"><input type="checkbox" ${auto ? "checked" : ""} data-action="rules-auto" aria-label="Считать проценты автоматически"><span class="rules-auto-box">${icon("check", "icon-sm")}</span><span class="rules-auto-copy"><strong>Считать автоматически</strong><small>${info ? esc(info.explain) : "Проценты подберутся по вашим доходам и тратам за три месяца."}</small></span></label>`;
  const rows = data.finance.rules.map((r, i) => `<div class="settings-row"><div><strong>${esc(r.name)}</strong><span>${auto ? "Считается по вашим тратам" : "Доля от поступления"}</span></div><label class="field rule-field"><input name="rule-${i}" type="number" min="0" max="100" value="${r.percent}" ${auto ? "readonly" : "required"}> %</label></div>`).join("");
  const total = data.finance.rules.reduce((sum, r) => sum + Number(r.percent || 0), 0);
  const reconcile = reconcileForm();
  // Цели: сколько откладывать на каждую, чтобы успеть к сроку (считает сервер).
  const goalRows = auto && info?.goals?.length ? `<div class="section-heading section"><h2>На цели</h2></div><div class="list-panel">${info.goals.map(g => `<div class="settings-row"><div><strong>${esc(g.name)}</strong><span>${demoMoney(g.monthly)} в месяц · осталось ${demoMoney(g.left)}${g.due ? ` · к ${esc(dateLabel(g.due))}` : " · за год"}</span></div><b class="rule-goal-pct">${g.percent}%</b></div>`).join("")}</div>` : "";
  return `<div class="overview-intro"><span class="mini-heading">Распределение дохода</span><p>Когда приходит доход, бот предложит отложить часть на эти счета.</p></div>${toggle}${goalRows}${reconcile}<form id="rules-form"><div class="list-panel">${rows}</div>${auto ? `<p class="section-note">Откладывается ${total}% дохода. Остальное остаётся на жизнь.</p>` : `<p class="form-error" role="alert"></p><button class="primary-button" type="submit">Сохранить правила</button>`}</form>${income ? cardSection(`Пример для «${esc(income.title)}» · ${demoMoney(income.amount)}`, `<div class="side-card">${data.finance.rules.map(r => `<div class="side-row"><span>${esc(r.name)} · ${r.percent}%</span><b>${demoMoney(income.amount * r.percent / 100)}</b></div>`).join("")}</div>`) : ""}`;
}
function renderFinancePage() {
  const sections = { overview: financeOverview, transactions: financeTransactionsPage, accounts: financeAccountsPage, transfers: financeTransfersPage, budgets: financeBudgetsPage, goals: financeGoalsPage, payments: financePaymentsPage, debts: financeDebtsPage, rules: financeRulesPage };
  const aside = `<div class="side-card"><h3>Этот месяц</h3><div class="side-row"><span>Доходы</span><b>${demoMoney(sumTransactions("income"))}</b></div><div class="side-row"><span>Расходы</span><b>${demoMoney(sumTransactions("expense"))}</b></div><div class="side-row"><span>Разница</span><b>${demoMoney(sumTransactions("income") - sumTransactions("expense"))}</b></div></div>`;
  return `${header("Финансы", "", "")}${financeTabs()}<div class="content-grid"><div class="content-main">${(sections[ui.financeTab] || financeOverview)()}</div><aside class="content-aside">${aside}</aside></div>`;
}
function financeEntityList(entity) { return { transaction: data.finance.transactions, account: data.finance.accounts, transfer: data.finance.transfers, budget: data.finance.budgets, goal: data.finance.goals, payment: data.finance.payments, debt: data.finance.debts }[entity] || []; }
function openFinanceForm(entity, recordId = null, kind = "expense") { ui.sheet = { kind: "finance", entity, id: recordId, txKind: kind, justRendered: false }; render(); }
/** Сумма ползунком и вводом: грубо — пальцем, точно — цифрами. Поля связаны. */
function amountSlider(label, name, value, max, extra = "", unit = "₽") {
  const top = Math.max(1, Math.round(Number(max) || 0));
  const step = top >= 100000 ? 1000 : top >= 20000 ? 500 : top >= 2000 ? 100 : 10;
  const current = Math.min(top, Math.max(0, Number(value) || 0));
  return `<div class="field amount-slider"><span>${label}</span><div class="amount-slider-row"><input type="range" min="0" max="${top}" step="${step}" value="${current}" data-amount-for="${name}" aria-label="${label}"><input name="${name}" type="number" inputmode="decimal" ${extra} min="0" step="0.01" value="${esc(value ?? "")}" data-amount-range></div><div class="amount-slider-scale"><span>0</span><span data-amount-top data-unit="${esc(unit)}">${top.toLocaleString("ru-RU")} ${esc(unit)}</span></div></div>`;
}
document.addEventListener("input", event => {
  const range = event.target.closest?.("[data-amount-for]");
  if (range) { const box = range.closest(".amount-slider"); const input = box?.querySelector(`input[name="${range.dataset.amountFor}"]`); if (input) { input.value = range.value; input.dispatchEvent(new Event("input", { bubbles: true })); } return; }
  const input = event.target.closest?.("[data-amount-range]");
  if (input) {
    const box = input.closest(".amount-slider"); const range = box?.querySelector("[data-amount-for]"); const value = Number(input.value) || 0;
    // Вписали больше, чем край ползунка, — край отодвигается, а не упирается.
    if (range && value > Number(range.max)) { const top = Math.ceil(value * 1.25 / Number(range.step || 1)) * Number(range.step || 1); range.max = String(top); const label = box.querySelector("[data-amount-top]"); if (label) label.textContent = `${top.toLocaleString("ru-RU")} ${label.dataset.unit || "₽"}`; }
    if (range) range.value = String(Math.min(Number(range.max), value));
    // «Всего» и «Нужно накопить» задают потолок ползунка «Уже погашено / отложено».
    const partner = { amount: "paid", target: "saved" }[input.name];
    const other = partner && input.form?.querySelector(`[data-amount-for="${partner}"]`);
    if (other) {
      const top = Math.max(1, Math.round(value));
      other.max = String(top);
      other.value = String(Math.min(top, Number(other.value)));
      const label = other.closest(".amount-slider")?.querySelector("[data-amount-top]");
      if (label) label.textContent = `${top.toLocaleString("ru-RU")} ${label.dataset.unit || "₽"}`;
    }
  }
}, true);
function financeField(label, name, value, type = "text", extra = "") { return `<label class="field">${label}<input name="${name}" type="${type}" value="${esc(value ?? "")}" ${extra}></label>`; }
function renderFinanceSheet() {
  const { entity, id: recordId } = ui.sheet;
  if (entity === "receipt") return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Разбор чека</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><p class="vault-warning">Фото чека лучше прислать боту в чат — он разберёт позиции и запишет траты.</p><label class="field">Фото чека<input id="receipt-file" type="file" accept="image/*"></label><form id="receipt-form">${[["Молоко", 120, "Еда"], ["Шампунь", 390, "Дом"], ["Хлеб", 80, "Еда"]].map(([title, amount, category], i) => `<div class="field-row receipt-row">${financeField("Позиция", `title-${i}`, title)}${financeField("Сумма, ₽", `amount-${i}`, amount, "number", 'min="0"')}</div><label class="field">Категория<select name="category-${i}">${FINANCE_CATEGORIES.map(c => `<option ${c === category ? "selected" : ""}>${c}</option>`).join("")}</select></label>`).join("")}<button class="primary-button" type="submit">Записать три расхода</button></form></section></div>`;
  const item = recordId ? financeEntityList(entity).find(x => x.id === recordId) : null;
  if (entity === "transfer" && item) { const from = data.finance.accounts.find(a => a.id === item.fromId); const to = data.finance.accounts.find(a => a.id === item.toId); return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Перевод между счетами</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><div class="detail-meta"><div><small>Откуда</small><strong>${esc(from?.name || "Счёт")}</strong></div><div><small>Куда</small><strong>${esc(to?.name || "Счёт")}</strong></div><div><small>Списано</small><strong>${demoMoney(item.amount, from?.currency)}</strong></div><div><small>Зачислено</small><strong>${demoMoney(item.toAmount, to?.currency)}</strong></div></div><p class="section-note">${esc(dateLabel(item.date))}${item.note ? ` · ${esc(item.note)}` : ""}</p><p class="vault-warning">Изменение перевода недоступно. Если удалить карточку свайпом, перевод попадёт в корзину, а остатки обоих счетов пересчитаются.</p></section></div>`; }
  const v = name => item?.[name] ?? "";
  let fields = "";
  const txKind = item?.kind || ui.sheet.txKind;
  if (entity === "transaction") fields = `${financeField("Название", "title", v("title"), "text", 'required autofocus')}${amountSlider("Сумма", "amount", v("amount"), typicalTop(data.finance.transactions.filter(t => t.kind === txKind).map(t => t.amount).concat(v("amount")), txKind === "income" ? 50000 : 5000), 'required')}<div class="field-row"><label class="field">Тип<select name="kind"><option value="expense" ${txKind === "expense" ? "selected" : ""}>Расход</option><option value="income" ${txKind === "income" ? "selected" : ""}>Доход</option></select></label></div><div class="field-row">${financeField("Дата", "date", v("date") || todayIso(), "date", "required")}<label class="field">Счёт<select name="accountId">${spendAccounts().map(a => `<option value="${esc(a.id)}" ${v("accountId") === a.id ? "selected" : ""}>${esc(a.name)} · ${esc(a.currency)}</option>`).join("")}</select></label></div><div class="field-row"><label class="field">Категория<select name="category">${FINANCE_CATEGORIES.map(c => `<option ${v("category") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="field">Проект<select name="project"><option value="">Без проекта</option>${data.projects.map(p => `<option ${v("project") === p.name ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label></div>`;
  if (entity === "account") fields = `${financeField("Название счёта", "name", v("name"), "text", 'required autofocus')}<div class="field-row"><label class="field">Валюта<select name="currency">${["RUB", "USD", "EUR"].map(c => `<option ${v("currency") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label></div>${item ? amountSlider("Остаток сейчас, ₽", "balance", Math.round(accountBalance(item) * 100) / 100, Math.max(100000, Math.abs(accountBalance(item)) * 1.5), 'min="-100000000" required') + `<p class="section-note">Не сходится с банком — впишите настоящую сумму: в истории появится строка «Сверка счёта».</p>` : amountSlider("Остаток сейчас, ₽", "balance", 0, 100000, 'min="-100000000" required')}`;
  if (entity === "transfer") fields = `<div class="field-row"><label class="field">Со счёта<select name="fromId">${spendAccounts().map(a => `<option value="${esc(a.id)}">${esc(a.name)} · ${esc(a.currency)}</option>`).join("")}</select></label><label class="field">На счёт<select name="toId">${spendAccounts().map((a, i) => `<option value="${esc(a.id)}" ${i === 1 ? "selected" : ""}>${esc(a.name)} · ${esc(a.currency)}</option>`).join("")}</select></label></div>${amountSlider("Списать", "amount", "", Math.max(1000, ...data.finance.accounts.filter(a => a.currency === "RUB").map(a => accountBalance(a))), 'required')}${amountSlider("Зачислить", "toAmount", "", Math.max(1000, ...data.finance.accounts.filter(a => a.currency === "RUB").map(a => accountBalance(a))), 'required')}<div class="field-row">${financeField("Дата", "date", todayIso(), "date", "required")}${financeField("Комментарий", "note", "")}</div><p class="section-note transfer-rate">Валюты разные — «Зачислить» посчитается по курсу ЦБ, его можно поправить.</p>`;
  if (entity === "budget") fields = `<label class="field">Категория<select name="category">${FINANCE_CATEGORIES.map(c => `<option ${v("category") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>${amountSlider("Лимит в месяц, ₽", "limit", v("limit"), Math.max(30000, (Number(v("limit")) || 0) * 2), 'required')}`;
  if (entity === "goal") fields = `${financeField("Название цели", "title", v("title"), "text", 'required autofocus')}${window.SOROKA_LIVE ? `<p class="goal-account-note">${icon("wallet", "icon-sm")}${item ? "У цели свой счёт — пополняется кнопкой «Отложить»" : "У цели будет свой счёт: деньги в неё — кнопкой «Отложить»"}</p>` : ""}${amountSlider("Нужно накопить, ₽", "target", v("target"), Math.max(300000, (Number(v("target")) || 0) * 2), 'required')}${window.SOROKA_LIVE ? "" : amountSlider("Уже отложено, ₽", "saved", v("saved") || 0, Math.max(Number(v("target")) || 0, Number(v("saved")) || 0, 1000), 'required')}${financeField("Пояснение", "note", v("note"))}`;
  if (entity === "payment") {
    // Повтор понятнее даты: «каждый месяц, 10-го» или «каждый год, 15 марта». Последний платёж — только если у платежа есть конец (кредит, рассрочка).
    const repeat = v("repeat") || (item ? "monthly" : "monthly");
    const day = v("day") || Number(String(v("nextOn") || todayIso()).slice(8, 10));
    const month = v("month") || Number(String(v("nextOn") || todayIso()).slice(5, 7));
    const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
    fields = `${financeField("Название", "title", v("title"), "text", 'required autofocus')}<label class="field">Валюта<select name="currency">${["RUB", "USD", "EUR", "CNY", "GBP", "KZT", "TRY", "AMD", "GEL"].map(c => `<option ${(v("currency") || "RUB") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>${amountSlider("Сумма", "amount", v("amount"), Math.max(5000, (Number(v("amount")) || 0) * 2), 'required')}<div class="field-row"><label class="field">Повторяется<select name="repeat" data-payment-repeat><option value="monthly" ${repeat === "monthly" ? "selected" : ""}>Каждый месяц</option><option value="yearly" ${repeat === "yearly" ? "selected" : ""}>Каждый год</option></select></label>${financeField("Число", "day", day, "number", 'min="1" max="31" required')}</div><label class="field payment-month" ${repeat === "yearly" ? "" : "hidden"}>Месяц<select name="month">${MONTHS.map((name, i) => `<option value="${i + 1}" ${Number(month) === i + 1 ? "selected" : ""}>${name}</option>`).join("")}</select></label>${financeField("Последний платёж", "endsOn", v("endsOn") || "", "date", `min="${todayIso()}"`)}<p class="section-note">Последний платёж — только если у платежа есть конец: кредит, рассрочка. Пусто — платёж бессрочный.</p><label class="field">Категория<select name="category">${FINANCE_CATEGORIES.map(c => `<option ${v("category") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>`;
  }
  const isCredit = entity === "debt" && (item ? item.kind === "credit" : ui.sheet.txKind === "credit");
  if (entity === "debt" && isCredit) fields = `${financeField("Кредит или банк", "person", v("person"), "text", 'required autofocus placeholder="Например: Ипотека, Т-Банк"')}<input type="hidden" name="kind" value="credit">${amountSlider("Сумма кредита, ₽", "amount", v("amount"), Math.max(500000, (Number(v("amount")) || 0) * 2), 'required')}${amountSlider("Уже выплачено, ₽", "paid", v("paid") || 0, Math.max(Number(v("amount")) || 0, 1))}${amountSlider("Платёж в месяц, ₽", "monthly", v("monthly") || "", Math.max(50000, (Number(v("monthly")) || 0) * 2))}<div class="field-row">${financeField("День платежа", "payDay", v("payDay"), "number", 'min="1" max="31" placeholder="9"')}${financeField("Ставка, % год", "rate", v("rate"), "number", 'min="0" max="200" step="0.01" placeholder="18"')}</div>${financeField("Последний платёж", "endsOn", v("endsOn"), "date")}${financeField("Заметка", "note", v("note"))}`;
  else if (entity === "debt") fields = `${financeField("Человек", "person", v("person"), "text", 'required autofocus')}<div class="field-row"><label class="field">Направление<select name="direction"><option value="to-me" ${v("direction") === "to-me" ? "selected" : ""}>Должны мне</option><option value="i-owe" ${v("direction") === "i-owe" ? "selected" : ""}>Должен я</option></select></label></div>${amountSlider("Всего, ₽", "amount", v("amount"), Math.max(50000, (Number(v("amount")) || 0) * 2), 'required')}${amountSlider("Уже погашено, ₽", "paid", v("paid") || 0, Math.max(Number(v("amount")) || 0, 1))}${financeField("За что", "note", v("note"))}`;
  const labels = { transaction: "Операцию", account: "Счёт", transfer: "Перевод", budget: "Бюджет", goal: "Цель", payment: "Платёж", debt: "Долг" };
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${item ? "Изменить" : "Добавить"} ${isCredit ? "кредит" : labels[entity].toLowerCase()}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><form id="finance-form">${fields}${entity === "account" && item && item === savingsAccount() ? `<p class="section-note">Основной накопительный счёт: название можно поменять, удалить нельзя.</p>` : ""}<p class="form-error" role="alert"></p><div class="sheet-actions">${item && !(entity === "account" && item === savingsAccount()) ? `<button class="ghost-button danger-button" type="button" data-action="finance-delete">Удалить</button>` : ""}<button class="primary-button" type="submit">Сохранить</button></div></form></section></div>`;
}
function financeAction(action, control) {
  if (action === "goal-deposit-chip" && ui.sheet?.kind === "goal-deposit") { const input = document.querySelector('#goal-deposit-form input[name="amount"]'); if (input) { input.value = String(Number(input.value || 0) + Number(control.dataset.amount)); input.dispatchEvent(new Event("input", { bubbles: true })); } return true; }
  if (action === "goal-withdraw" && ui.sheet?.kind === "goal-deposit") { goalDepositApply(-1); return true; }
  if (action === "credit-pay") {
    const credit = data.finance.debts.find(d => d.id === control.dataset.id);
    if (credit && credit.monthly) { credit.paid = Math.min(credit.amount, Math.round((Number(credit.paid) + Number(credit.monthly)) * 100) / 100); save(); toast(`Платёж по кредиту записан · осталось ${demoMoney(Math.max(0, credit.amount - credit.paid))}`); }
    return true;
  }
  if (action === "finance-reconcile") { ui.sheet = { kind: "finance-reconcile", justRendered: false }; render(); return true; }
  if (action === "rules-reconcile-reset") {
    data.settings.rulesIncome = 0; data.settings.rulesExpense = 0;
    if (ui.sheet?.kind === "finance-reconcile") ui.sheet = null;
    save(); toast("Считаю по записям");
    return true;
  }
  if (action === "rules-auto") {
    data.settings.rulesAuto = !data.settings.rulesAuto;
    save();
    toast(data.settings.rulesAuto ? "Проценты считаются по вашим тратам" : "Проценты — как вы задали");
    return true;
  }
  if (action === "goal-open") { openGoalDeposit(control.dataset.id); return true; }
  if (action === "finance-accounts") { ui.sheet = { kind: "finance-accounts", justRendered: false }; render(); return true; }
  if (action === "finance-tab") { ui.financeTab = control.dataset.tab; ui.financeCategory = ""; ui.financeKind = ""; render(); return true; }
  if (action === "finance-kind") { ui.financeKind = control.dataset.kind || ""; ui.financeCategory = ""; ui.financeTab = "transactions"; render(); window.scrollTo({ top: 0, behavior: "smooth" }); return true; }
  if (action === "finance-add") { openFinanceForm(control.dataset.entity, null, control.dataset.kind || "expense"); return true; }
  if (action === "finance-edit") { openFinanceForm(control.dataset.entity, control.dataset.id); return true; }
  if (action === "finance-category") { ui.financeCategory = control.dataset.category; ui.financeTab = "transactions"; render(); return true; }
  if (action === "finance-clear-category") { ui.financeCategory = ""; render(); return true; }
  if (action === "finance-receipt") { openFinanceForm("receipt"); return true; }
  if (action === "finance-export") { downloadText("soroka-demo-finance.csv", "Дата;Тип;Название;Сумма;Валюта;Категория\n" + data.finance.transactions.map(t => [t.date, t.kind, t.title, t.amount, t.currency, t.category].join(";")).join("\n"), "text/csv;charset=utf-8"); return true; }
  if (action === "payment-confirm") { const p = data.finance.payments.find(x => x.id === control.dataset.id); if (p) { data.finance.transactions.push({ id: id(), title: p.title, kind: "expense", amount: p.amount, currency: "RUB", category: p.category, accountId: data.finance.accounts.find(a => a.currency === "RUB")?.id || "main", date: todayIso(), project: "Финансы", manual: true }); p.status = "confirmed"; p.paidAt = todayIso(); save(); toast("Списание подтверждено и записано"); } return true; }
  if (action === "finance-delete" && ui.sheet?.kind === "finance") { const { entity, id: recordId } = ui.sheet; const list = financeEntityList(entity); const item = list.find(x => x.id === recordId); if (entity === "account" && item && item === savingsAccount()) { const error = document.querySelector("#finance-form .form-error"); if (error) error.textContent = "Накопительный счёт постоянный: переименовать можно, удалить нельзя."; return true; } if (entity === "account" && !window.SOROKA_LIVE && (data.finance.transactions.some(t => t.accountId === recordId) || data.finance.transfers.some(t => t.fromId === recordId || t.toId === recordId))) { const error = document.querySelector("#finance-form .form-error"); if (error) error.textContent = "Сначала перенесите связанные операции на другой счёт."; return true; } if (item) { pushTrash(`finance:${entity}`, item); const index = list.indexOf(item); list.splice(index, 1); } ui.sheet = null; save(); toast("Запись в корзине"); return true; }
  return false;
}
function financeSubmit(event) {
  if (event.target.id === "rules-form") { event.preventDefault(); const values = data.finance.rules.map((_, i) => Number(new FormData(event.target).get(`rule-${i}`) || 0)); const total = values.reduce((a, b) => a + b, 0); if (total !== 100) { event.target.querySelector(".form-error").textContent = "Сумма долей должна быть 100%. Сейчас: " + total + "%."; return true; } data.finance.rules.forEach((rule, i) => rule.percent = values[i]); save(); toast("Правила сохранены"); return true; }
  if (event.target.id === "rules-reconcile-form") {
    event.preventDefault();
    const f = new FormData(event.target);
    data.settings.rulesIncome = Math.max(0, Math.round(Number(f.get("rulesIncome") || 0)));
    data.settings.rulesExpense = Math.max(0, Math.round(Number(f.get("rulesExpense") || 0)));
    if (ui.sheet?.kind === "finance-reconcile") ui.sheet = null;
    save(); toast(data.settings.rulesIncome || data.settings.rulesExpense ? "Сохранил ваши цифры" : "Считаю по записям");
    return true;
  }
  if (event.target.id === "receipt-form") { event.preventDefault(); const form = new FormData(event.target); const accountId = data.finance.accounts.find(a => a.currency === "RUB")?.id || "main"; for (let i = 0; i < 3; i++) { const title = String(form.get(`title-${i}`) || "").trim(); const amount = Number(form.get(`amount-${i}`) || 0); if (title && amount > 0) data.finance.transactions.push({ id: id(), title, kind: "expense", amount, currency: "RUB", category: String(form.get(`category-${i}`) || "Другое"), accountId, date: todayIso(), project: "", manual: true }); } ui.sheet = null; ui.financeTab = "transactions"; save(); toast("Строки чека записаны"); return true; }
  if (event.target.id !== "finance-form" || ui.sheet?.kind !== "finance") return false;
  event.preventDefault();
  const form = new FormData(event.target);
  const { entity, id: recordId } = ui.sheet;
  const list = financeEntityList(entity);
  const existing = recordId ? list.find(x => x.id === recordId) : null;
  const item = existing || { id: id() };
  const error = event.target.querySelector(".form-error");
  if (entity === "transfer") {
    const fromId = String(form.get("fromId") || ""); const toId = String(form.get("toId") || "");
    const amount = Number(form.get("amount") || 0); const toAmount = Number(form.get("toAmount") || 0);
    const from = data.finance.accounts.find(a => a.id === fromId); const to = data.finance.accounts.find(a => a.id === toId);
    if (!from || !to || fromId === toId || amount <= 0 || toAmount <= 0) { error.textContent = "Выберите два разных счёта и положительные суммы."; return true; }
    if (from.currency === to.currency && amount !== toAmount) { error.textContent = "Для счетов в одной валюте суммы должны совпадать."; return true; }
    Object.assign(item, { fromId, toId, amount, toAmount, date: String(form.get("date") || todayIso()), note: String(form.get("note") || "").trim() });
  }
  if (entity === "transaction") { item.title = String(form.get("title") || "").trim(); item.kind = String(form.get("kind") || "expense"); item.amount = Number(form.get("amount") || 0); item.date = String(form.get("date") || todayIso()); item.accountId = String(form.get("accountId") || "main"); item.currency = data.finance.accounts.find(a => a.id === item.accountId)?.currency || "RUB"; item.category = String(form.get("category") || "Другое"); item.project = String(form.get("project") || ""); item.manual = true; }
  if (entity === "account") { const currency = String(form.get("currency") || "RUB"); if (existing && existing.currency !== currency && (data.finance.transactions.some(t => t.accountId === recordId) || data.finance.transfers.some(t => t.fromId === recordId || t.toId === recordId))) { error.textContent = "Валюту счёта со связанными операциями менять нельзя."; return true; } item.name = String(form.get("name") || "").trim(); item.currency = currency; item.kind = existing?.kind || "card"; const typed = Math.round(Number(form.get("balance") || 0) * 100) / 100; if (existing) { if (Math.abs(typed - accountBalance(existing)) >= 0.01) item.balanceNow = typed; } else item.opening = typed; }
  if (entity === "budget") { item.category = String(form.get("category") || "Другое"); item.limit = Number(form.get("limit") || 0); }
  if (entity === "goal") { item.accountId = existing?.accountId || ""; item.title = String(form.get("title") || "").trim(); item.target = Number(form.get("target") || 0); item.saved = window.SOROKA_LIVE ? Number(existing?.saved || 0) : Number(form.get("saved") || 0); item.note = String(form.get("note") || "").trim(); }
  if (entity === "payment") {
    item.title = String(form.get("title") || "").trim(); item.amount = Number(form.get("amount") || 0); item.currency = String(form.get("currency") || "RUB");
    item.repeat = form.get("repeat") === "yearly" ? "yearly" : "monthly";
    item.day = Math.min(31, Math.max(1, Number(form.get("day") || 1)));
    item.month = Math.min(12, Math.max(1, Number(form.get("month") || 1)));
    item.endsOn = String(form.get("endsOn") || "");
    // Ближайшая дата по повтору — чтобы платёж сразу встал на место в списке.
    const pad = n => String(n).padStart(2, "0"), today = todayIso(), [y, m] = today.split("-").map(Number);
    const at = (yy, mm) => `${yy}-${pad(mm)}-${pad(Math.min(item.day, new Date(yy, mm, 0).getDate()))}`;
    item.nextOn = item.repeat === "yearly" ? (at(y, item.month) >= today ? at(y, item.month) : at(y + 1, item.month)) : (at(y, m) >= today ? at(y, m) : at(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1));
    item.category = String(form.get("category") || "Подписки"); item.status ||= "upcoming";
  }
  if (entity === "debt") { const amount = Number(form.get("amount") || 0); const paid = Number(form.get("paid") || 0); if (paid > amount) { error.textContent = "Погашено больше общей суммы."; return true; } item.person = String(form.get("person") || "").trim(); item.kind = String(form.get("kind") || "") === "credit" || existing?.kind === "credit" ? "credit" : "debt"; item.direction = item.kind === "credit" ? "i-owe" : String(form.get("direction") || "to-me"); item.amount = amount; item.paid = paid; item.note = String(form.get("note") || "").trim(); if (item.kind === "credit") { item.monthly = Number(form.get("monthly") || 0) || ""; item.payDay = Number(form.get("payDay") || 0) || ""; item.rate = form.get("rate") === "" ? "" : Number(form.get("rate") || 0); item.endsOn = String(form.get("endsOn") || ""); } }
  if (!existing) list.push(item);
  ui.sheet = null; save(); toast(existing ? "Изменения сохранены" : "Запись добавлена"); return true;
}
document.addEventListener("change", event => {
  if (!event.target.matches?.("[data-payment-repeat]")) return;
  const row = event.target.closest("form")?.querySelector(".payment-month");
  if (row) row.hidden = event.target.value !== "yearly";
});
function financeInput(event) {
  if (ui.sheet?.kind === "finance" && ui.sheet.entity === "transfer" && event.target.name === "amount") {
    const form = event.target.form; const from = data.finance.accounts.find(a => a.id === form.elements.fromId.value); const to = data.finance.accounts.find(a => a.id === form.elements.toId.value);
    if (from?.currency === to?.currency) form.elements.toAmount.value = event.target.value;
    else if (from && to && rateOf(from.currency) && rateOf(to.currency)) {
      form.elements.toAmount.value = String(Math.round(Number(event.target.value || 0) * rateOf(from.currency) / rateOf(to.currency) * 100) / 100);
      form.elements.toAmount.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return true;
  }
  return false;
}
function financeChange(event) {
  if (ui.sheet?.kind === "finance" && ui.sheet.entity === "transfer" && ["fromId", "toId"].includes(event.target.name)) {
    const form = event.target.form; const from = data.finance.accounts.find(a => a.id === form.elements.fromId.value); const to = data.finance.accounts.find(a => a.id === form.elements.toId.value);
    if (from?.currency === to?.currency) form.elements.toAmount.value = form.elements.amount.value;
    return true;
  }
  return false;
}
