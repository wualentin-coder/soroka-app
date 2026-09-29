const FINANCE_TABS = [["overview", "Обзор"], ["transactions", "Операции"], ["accounts", "Счета"], ["transfers", "Переводы"], ["budgets", "Бюджеты"], ["goals", "Цели"], ["payments", "Платежи"], ["debts", "Долги"], ["rules", "Правила"]];
const FINANCE_CATEGORIES = ["Еда", "Транспорт", "Работа", "Подписки", "Дом", "Здоровье", "Другое"];
function monthTransactions() { return data.finance.transactions.filter(t => t.date?.startsWith(todayIso().slice(0, 7))); }
function sumTransactions(kind, currency = "RUB") { return monthTransactions().filter(t => t.kind === kind && t.currency === currency).reduce((sum, t) => sum + Number(t.amount || 0), 0); }
function accountBalance(account) {
  const operations = data.finance.transactions.filter(t => t.accountId === account.id && t.currency === account.currency).reduce((sum, t) => sum + (t.kind === "income" ? 1 : -1) * Number(t.amount || 0), 0);
  const transfers = data.finance.transfers.reduce((sum, t) => sum + (t.toId === account.id ? Number(t.toAmount || 0) : 0) - (t.fromId === account.id ? Number(t.amount || 0) : 0), 0);
  return Number(account.opening || 0) + operations + transfers;
}
function rubBalance() { return data.finance.accounts.filter(a => a.currency === "RUB").reduce((sum, a) => sum + accountBalance(a), 0); }
function categorySpent(category) { return monthTransactions().filter(t => t.kind === "expense" && t.category === category && t.currency === "RUB").reduce((sum, t) => sum + Number(t.amount || 0), 0); }
function financeTabs() { return `<div class="subtabs" role="tablist" aria-label="Разделы финансов">${FINANCE_TABS.map(([key, label]) => `<button type="button" role="tab" aria-selected="${ui.financeTab === key}" class="${ui.financeTab === key ? "active" : ""}" data-action="finance-tab" data-tab="${key}">${label}</button>`).join("")}</div>`; }
function financeTransactionRow(item) {
  const account = data.finance.accounts.find(a => a.id === item.accountId);
  return `<button class="finance-row finance-row-button" type="button" data-action="finance-edit" data-entity="transaction" data-id="${esc(item.id)}"><span class="list-icon">${icon(item.kind === "income" ? "download" : "wallet")}</span><span class="list-copy"><strong>${esc(item.title)}</strong><span>${esc(item.category)} · ${esc(dateLabel(item.date))}${account ? ` · ${esc(account.name)}` : ""}</span></span><span class="amount ${item.kind === "income" ? "income" : ""}">${item.kind === "income" ? "+" : "−"}${demoMoney(item.amount, item.currency)}</span></button>`;
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
function financeOverview() {
  const income = sumTransactions("income");
  const expense = sumTransactions("expense");
  const byCategory = FINANCE_CATEGORIES.map(category => [category, categorySpent(category)]).filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]);
  const top = Math.max(1, ...byCategory.map(([, amount]) => amount));
  const debtsToMe = data.finance.debts.filter(d => d.direction === "to-me").reduce((sum, d) => sum + Math.max(0, d.amount - d.paid), 0);
  const debtsIOwe = data.finance.debts.filter(d => d.direction === "i-owe").reduce((sum, d) => sum + Math.max(0, d.amount - d.paid), 0);
  const pending = data.finance.payments.filter(p => p.status === "pending");
  const accounts = data.finance.accounts.map(a => `<div class="side-row"><span>${esc(a.name)} · ${esc(a.currency)}</span><b>${demoMoney(accountBalance(a), a.currency)}</b></div>`).join("");
  const chart = byCategory.length ? `<div class="bar-chart">${byCategory.slice(0, 5).map(([, amount]) => `<span><i style="height:${Math.max(7, amount / top * 100)}%"></i></span>`).join("")}</div><div class="chart-labels">${byCategory.slice(0, 5).map(([name]) => `<span>${esc(name)}</span>`).join("")}</div>` : emptyCard("Расходов нет", "Добавьте расход, чтобы увидеть категории.");
  return `<button class="finance-hero finance-hero-button" type="button" data-action="finance-accounts" aria-label="Все счета"><p class="eyebrow">Доступно на счетах · ₽</p><strong>${demoMoney(rubBalance())}</strong><span class="section-note">Отдельно учитываются ${data.finance.accounts.filter(a => a.currency !== "RUB").map(a => demoMoney(accountBalance(a), a.currency)).join(" · ") || "валютные счета"}</span><span class="finance-hero-more">${data.finance.accounts.length} ${data.finance.accounts.length === 1 ? "счёт" : data.finance.accounts.length < 5 ? "счёта" : "счетов"} ${icon("right", "icon-sm")}</span></button><div class="kpi-grid finance-summary"><div class="kpi"><span class="kpi-label">Доходы</span><span class="kpi-value">${demoMoney(income)}</span><span class="kpi-hint">за месяц</span></div><div class="kpi"><span class="kpi-label">Расходы</span><span class="kpi-value">${demoMoney(expense)}</span><span class="kpi-hint">за месяц</span></div><div class="kpi"><span class="kpi-label">Должны мне</span><span class="kpi-value">${demoMoney(debtsToMe)}</span><span class="kpi-hint">отдельно от баланса</span></div><div class="kpi"><span class="kpi-label">Должен я</span><span class="kpi-value">${demoMoney(debtsIOwe)}</span><span class="kpi-hint">отдельно от баланса</span></div></div><div class="finance-quick"><button type="button" data-action="finance-add" data-entity="transaction" data-kind="expense">+ Расход</button><button type="button" data-action="finance-add" data-entity="transaction" data-kind="income">+ Доход</button><button type="button" data-action="finance-add" data-entity="transfer">+ Перевод</button></div>${cardSection("Расходы по категориям", `<div class="side-card">${chart}${byCategory.map(([name, amount]) => `<button class="finance-row finance-row-button" type="button" data-action="finance-category" data-category="${esc(name)}"><span class="list-copy"><strong>${esc(name)}</strong></span><span class="amount">${demoMoney(amount)}</span>${icon("right", "icon-sm")}</button>`).join("")}</div>`)}${cardSection("Бюджеты", data.finance.budgets.map(budgetCard).join(""))}${cardSection("Цели накопления", data.finance.goals.map(goalCard).join("") || emptyCard("Целей пока нет", "Задайте сумму — прогресс будет виден здесь."), "", `<button class="text-action" type="button" data-action="finance-add" data-entity="goal">Добавить ${icon("plus", "icon-sm")}</button>`)}${pending.length ? cardSection("Ждут подтверждения", `<div class="list-panel">${pending.map(p => `<div class="list-row"><span class="list-icon">${icon("clock")}</span><span class="list-copy"><strong>${esc(p.title)}</strong><span>${demoMoney(p.amount)} · ${p.day}-го числа</span></span>${miniButton("Списалось", "payment-confirm", `data-id="${esc(p.id)}"`)}</div>`).join("")}</div>`) : ""}${cardSection("Счета", `<div class="side-card">${accounts}</div>`, "", `<button class="text-action" type="button" data-action="finance-add" data-entity="account">Добавить ${icon("plus", "icon-sm")}</button>`)}`;
}
function financeTransactionsPage() {
  const items = monthTransactions().filter(t => !ui.financeCategory || t.category === ui.financeCategory).sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="section-heading"><h2>${ui.financeCategory ? `Операции · ${esc(ui.financeCategory)}` : "Операции месяца"}</h2><button class="text-action" type="button" data-action="finance-add" data-entity="transaction" data-kind="expense">Добавить ${icon("plus", "icon-sm")}</button></div>${ui.financeCategory ? `<button class="text-action" type="button" data-action="finance-clear-category">Все категории</button>` : ""}<div class="list-panel">${items.length ? items.map(financeTransactionRow).join("") : `<div class="empty-card"><strong>Операций нет</strong>Выберите другую категорию или добавьте запись.</div>`}</div><div class="inline-actions"><button type="button" data-action="finance-receipt">${icon("upload")}Проверить чек</button><button type="button" data-action="finance-export">${icon("download")}CSV</button></div>`;
}
function financeAccountsPage() {
  return `<div class="section-heading"><h2>Счета</h2><button class="text-action" type="button" data-action="finance-add" data-entity="account">Добавить ${icon("plus", "icon-sm")}</button></div><div class="list-panel">${data.finance.accounts.map(accountRow).join("")}</div><p class="section-note">Валюты показаны отдельно. Прототип не запрашивает курс и не пересчитывает суммы автоматически.</p>`;
}
function financeTransfersPage() {
  const accounts = data.finance.accounts;
  return `<div class="section-heading"><h2>Переводы между счетами</h2><button class="text-action" type="button" data-action="finance-add" data-entity="transfer">Новый перевод ${icon("plus", "icon-sm")}</button></div><p class="section-note">Перевод меняет остатки двух счетов, но не считается доходом или расходом. Для разных валют укажите сумму зачисления вручную.</p>${data.finance.transfers.length ? `<div class="list-panel section">${data.finance.transfers.slice().reverse().map(t => { const from = accounts.find(x => x.id === t.fromId); const to = accounts.find(x => x.id === t.toId); return `<button class="finance-row finance-row-button" type="button" data-action="finance-edit" data-entity="transfer" data-id="${esc(t.id)}"><span class="list-icon">${icon("arrow")}</span><span class="list-copy"><strong>${esc(from?.name || "Счёт")} → ${esc(to?.name || "Счёт")}</strong><span>${esc(dateLabel(t.date))}${t.note ? ` · ${esc(t.note)}` : ""}</span></span><span class="amount">${demoMoney(t.amount, from?.currency)}</span></button>`; }).join("")}</div>` : emptyCard("Переводов пока нет", "Добавьте первый перевод между счетами.")}`;
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
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet goal-deposit-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${esc(goal.title)}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><div class="goal-deposit-progress"><strong>${demoMoney(goal.saved)}</strong><span>из ${demoMoney(goal.target)} · ${progress}%</span><div class="progress-track"><span style="width:${progress}%"></span></div><small>${left > 0 ? `Осталось ${demoMoney(left)}` : "Цель достигнута"}</small></div><form id="goal-deposit-form">${goalAccountNote()}${savingsAccount() ? `<label class="field">Откуда<select name="from"><option value="">Уже лежат на «${esc(savingsAccount().name)}»</option>${data.finance.accounts.filter(a => a !== savingsAccount() && a.currency === savingsAccount().currency).map(a => `<option value="${esc(a.id)}">Перевести с «${esc(a.name)}» · ${demoMoney(accountBalance(a), a.currency)}</option>`).join("")}</select></label>` : ""}${amountSlider("Сколько отложить, ₽", "amount", "", left > 0 ? left : Math.max(goal.saved, goal.target), 'placeholder="0" required')}<div class="goal-chips">${chips}</div><p class="form-error" role="alert"></p><div class="sheet-actions"><button class="ghost-button" type="button" data-action="goal-withdraw">Снять</button><button class="primary-button" type="submit">Отложить</button></div></form><button class="text-action goal-settings" type="button" data-action="finance-edit" data-entity="goal" data-id="${esc(goal.id)}">Настроить цель</button></section></div>`;
}
/**
 * Накопительный счёт — постоянный: есть всегда, цели копятся в нём,
 * переименовать можно, удалить нельзя. Остальные счета — свои, любые.
 */
function savingsAccount() {
  return data.finance.accounts.find(a => a.savings) || data.finance.accounts.find(a => a.kind === "deposit") || data.finance.accounts.find(a => /накоп/i.test(a.name)) || null;
}
function goalAccountNote() {
  const account = savingsAccount();
  if (!account) return "";
  const inGoals = data.finance.goals.reduce((sum, g) => sum + Number(g.saved || 0), 0);
  return `<p class="goal-account-note">${icon("wallet", "icon-sm")}<b>${esc(account.name)}</b> · ${demoMoney(accountBalance(account), account.currency)}, в целях ${demoMoney(inGoals)}</p>`;
}
/** Строка счёта; у накопительного — цели внутри и сколько свободно. */
function accountRow(a) {
  const main = `<button class="finance-row finance-row-button" type="button" data-action="finance-edit" data-entity="account" data-id="${esc(a.id)}"><span class="list-icon">${icon(a === savingsAccount() ? "chart" : "wallet")}</span><span class="list-copy"><strong>${esc(a.name)}</strong><span>${a === savingsAccount() ? "Накопительный · цели внутри" : esc(a.currency)}</span></span><span class="amount">${demoMoney(accountBalance(a), a.currency)}</span></button>`;
  if (a !== savingsAccount()) return main;
  const goals = data.finance.goals;
  const inGoals = goals.reduce((sum, g) => sum + Number(g.saved || 0), 0);
  const free = accountBalance(a) - inGoals;
  const rows = goals.map(g => { const progress = g.target > 0 ? Math.min(100, Math.round(g.saved / g.target * 100)) : 0; return `<button class="savings-goal" type="button" data-action="goal-open" data-id="${esc(g.id)}"><span><strong>${esc(g.title)}</strong><small>${demoMoney(g.saved)} из ${demoMoney(g.target)}</small></span><span class="progress-track"><span style="width:${progress}%"></span></span></button>`; }).join("");
  return `<div class="savings-account">${main}<div class="savings-goals">${rows}<div class="savings-free"><span>${free >= 0 ? "Свободно, не в целях" : "В целях больше, чем на счёте"}</span><b>${demoMoney(Math.abs(free))}</b></div><button class="text-action" type="button" data-action="finance-add" data-entity="goal">Новая цель ${icon("plus", "icon-sm")}</button></div></div>`;
}
/** Окно «Все счета»: остатки, нажатие — настройки счёта. */
function renderAccountsSheet() {
  const rub = data.finance.accounts.filter(a => a.currency === "RUB");
  const rows = data.finance.accounts.map(accountRow).join("");
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet accounts-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Счета</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><div class="accounts-total"><small>В рублях на ${rub.length} ${rub.length === 1 ? "счёте" : "счетах"}</small><strong>${demoMoney(rubBalance())}</strong></div><div class="list-panel">${rows || emptyCard("Счетов пока нет", "Добавьте первый счёт.")}</div><div class="sheet-actions"><button class="ghost-button" type="button" data-action="finance-add" data-entity="transfer">Перевод</button><button class="primary-button" type="button" data-action="finance-add" data-entity="account">Добавить счёт</button></div></section></div>`;
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
  const amount = Math.round(Number(String(input?.value || "").replace(",", ".")) * 100) / 100;
  if (!goal || !(amount > 0)) { const error = document.querySelector("#goal-deposit-form .form-error"); if (error) error.textContent = "Введите сумму"; return; }
  const from = sign > 0 ? String(document.querySelector('#goal-deposit-form select[name="from"]')?.value || "") : "";
  const savings = savingsAccount();
  if (from && savings) data.finance.transfers.push({ id: id(), fromId: from, toId: savings.id, amount, toAmount: amount, date: todayIso(), note: `В цель «${goal.title}»` });
  goal.saved = Math.max(0, Math.round((Number(goal.saved || 0) + sign * amount) * 100) / 100);
  const progress = goal.target > 0 ? Math.min(100, Math.round(goal.saved / goal.target * 100)) : 0;
  ui.sheet = null; save(); toast(`${sign > 0 ? "Отложено" : "Снято"} ${demoMoney(amount)}${from ? " с переводом" : ""} · цель на ${progress}%`);
}
function goalCard(goal) {
  const progress = goal.target > 0 ? Math.min(100, Math.round(goal.saved / goal.target * 100)) : 0;
  return `<div class="budget-card"><div class="budget-top"><span>${esc(goal.title)}</span><span>${demoMoney(goal.saved)} / ${demoMoney(goal.target)}</span></div><div class="progress-track"><span style="width:${progress}%"></span></div><span class="budget-note">${progress}% накоплено${goal.note ? ` · ${esc(goal.note)}` : ""}</span><button class="text-action" type="button" data-action="finance-edit" data-entity="goal" data-id="${esc(goal.id)}">Настроить</button></div>`;
}
function financeGoalsPage() { return `<div class="section-heading"><h2>Цели накопления</h2><button class="text-action" type="button" data-action="finance-add" data-entity="goal">Добавить ${icon("plus", "icon-sm")}</button></div>${data.finance.goals.map(goalCard).join("") || emptyCard("Целей пока нет", "Задайте сумму и отслеживайте прогресс.")}<p class="section-note">Прогресс цели — отдельная запись. Перевод на счёт задаётся во вкладке «Переводы».</p>`; }
function financePaymentsPage() {
  const yearly = data.finance.payments.reduce((sum, p) => sum + p.amount * 12, 0);
  return `<div class="finance-hero"><p class="eyebrow">Регулярные платежи</p><strong>${demoMoney(yearly)}</strong><span class="section-note">в год · ${(yearly / 12).toLocaleString("ru-RU")} ₽ в месяц</span></div><div class="section-heading"><h2>Подписки и списания</h2><button class="text-action" type="button" data-action="finance-add" data-entity="payment">Добавить ${icon("plus", "icon-sm")}</button></div><div class="list-panel">${data.finance.payments.map(p => `<div class="list-row"><span class="list-icon">${icon("calendar")}</span><span class="list-copy"><strong>${esc(p.title)}</strong><span>${p.day}-го · ${esc(p.category)} · ${esc(p.status === "confirmed" ? "подтверждено" : "ожидается")}</span></span><span class="amount">${demoMoney(p.amount)}</span></div><div class="inline-actions payment-actions">${p.status !== "confirmed" ? miniButton("Списалось", "payment-confirm", `data-id="${esc(p.id)}"`) : ""}${miniButton("Настроить", "finance-edit", `data-entity="payment" data-id="${esc(p.id)}"`)}</div>`).join("")}</div><p class="section-note">Списание записывается только после подтверждения. Бот напомнит о платеже в день списания.</p>`;
}
function financeDebtsPage() {
  const sum = dir => data.finance.debts.filter(d => d.direction === dir).reduce((total, d) => total + Math.max(0, d.amount - d.paid), 0);
  return `<div class="kpi-grid"><div class="kpi"><span class="kpi-label">Должны мне</span><span class="kpi-value">${demoMoney(sum("to-me"))}</span></div><div class="kpi"><span class="kpi-label">Должен я</span><span class="kpi-value">${demoMoney(sum("i-owe"))}</span></div></div><div class="section-heading section"><h2>Долги</h2><button class="text-action" type="button" data-action="finance-add" data-entity="debt">Добавить ${icon("plus", "icon-sm")}</button></div><div class="list-panel">${data.finance.debts.map(d => `<button class="finance-row finance-row-button" type="button" data-action="finance-edit" data-entity="debt" data-id="${esc(d.id)}"><span class="list-icon">${icon("wallet")}</span><span class="list-copy"><strong>${esc(d.person)}</strong><span>${d.direction === "to-me" ? "Должен мне" : "Я должен"} · ${esc(d.note || "")}</span></span><span class="amount">${demoMoney(Math.max(0, d.amount - d.paid))}</span></button>`).join("")}</div>`;
}
function financeRulesPage() {
  const income = data.finance.transactions.filter(t => t.kind === "income" && t.currency === "RUB").sort((a, b) => b.date.localeCompare(a.date))[0];
  return `<div class="overview-intro"><span class="mini-heading">Распределение дохода</span><p>Правила задаёте вы. В рабочем приложении бот предложит применить их после распознавания дохода.</p></div><form id="rules-form"><div class="list-panel">${data.finance.rules.map((r, i) => `<div class="settings-row"><div><strong>${esc(r.name)}</strong><span>Доля от поступления</span></div><label class="field rule-field"><input name="rule-${i}" type="number" min="0" max="100" value="${r.percent}" required> %</label></div>`).join("")}</div><p class="form-error" role="alert"></p><button class="primary-button" type="submit">Сохранить правила</button></form>${income ? cardSection(`Пример для «${esc(income.title)}» · ${demoMoney(income.amount)}`, `<div class="side-card">${data.finance.rules.map(r => `<div class="side-row"><span>${esc(r.name)} · ${r.percent}%</span><b>${demoMoney(income.amount * r.percent / 100)}</b></div>`).join("")}</div><p class="section-note">Распределение по правилам бот предлагает, когда приходит доход.</p>`) : ""}`;
}
function renderFinancePage() {
  const sections = { overview: financeOverview, transactions: financeTransactionsPage, accounts: financeAccountsPage, transfers: financeTransfersPage, budgets: financeBudgetsPage, goals: financeGoalsPage, payments: financePaymentsPage, debts: financeDebtsPage, rules: financeRulesPage };
  const aside = `<div class="side-card"><h3>Этот месяц</h3><div class="side-row"><span>Доходы</span><b>${demoMoney(sumTransactions("income"))}</b></div><div class="side-row"><span>Расходы</span><b>${demoMoney(sumTransactions("expense"))}</b></div><div class="side-row"><span>Разница</span><b>${demoMoney(sumTransactions("income") - sumTransactions("expense"))}</b></div><p class="side-note">Тестовые суммы пересчитываются после добавления операций.</p></div>`;
  return `${header("Финансы", "Счета, расходы и обязательства без лишних цифр", "Деньги")}${financeTabs()}<div class="content-grid"><div class="content-main">${(sections[ui.financeTab] || financeOverview)()}</div><aside class="content-aside">${aside}</aside></div>`;
}
function financeEntityList(entity) { return { transaction: data.finance.transactions, account: data.finance.accounts, transfer: data.finance.transfers, budget: data.finance.budgets, goal: data.finance.goals, payment: data.finance.payments, debt: data.finance.debts }[entity] || []; }
function openFinanceForm(entity, recordId = null, kind = "expense") { ui.sheet = { kind: "finance", entity, id: recordId, txKind: kind, justRendered: false }; render(); }
/** Сумма ползунком и вводом: грубо — пальцем, точно — цифрами. Поля связаны. */
function amountSlider(label, name, value, max, extra = "") {
  const top = Math.max(1, Math.round(Number(max) || 0));
  const step = top >= 100000 ? 1000 : top >= 20000 ? 500 : top >= 2000 ? 100 : 10;
  const current = Math.min(top, Math.max(0, Number(value) || 0));
  return `<div class="field amount-slider"><span>${label}</span><div class="amount-slider-row"><input type="range" min="0" max="${top}" step="${step}" value="${current}" data-amount-for="${name}" aria-label="${label}"><input name="${name}" type="number" inputmode="decimal" ${extra} min="0" step="0.01" value="${esc(value ?? "")}" data-amount-range></div><div class="amount-slider-scale"><span>0</span><span data-amount-top>${top.toLocaleString("ru-RU")} ₽</span></div></div>`;
}
document.addEventListener("input", event => {
  const range = event.target.closest?.("[data-amount-for]");
  if (range) { const box = range.closest(".amount-slider"); const input = box?.querySelector(`input[name="${range.dataset.amountFor}"]`); if (input) { input.value = range.value; input.dispatchEvent(new Event("input", { bubbles: true })); } return; }
  const input = event.target.closest?.("[data-amount-range]");
  if (input) {
    const box = input.closest(".amount-slider"); const range = box?.querySelector("[data-amount-for]"); const value = Number(input.value) || 0;
    // Вписали больше, чем край ползунка, — край отодвигается, а не упирается.
    if (range && value > Number(range.max)) { const top = Math.ceil(value * 1.25 / Number(range.step || 1)) * Number(range.step || 1); range.max = String(top); const label = box.querySelector("[data-amount-top]"); if (label) label.textContent = `${top.toLocaleString("ru-RU")} ₽`; }
    if (range) range.value = String(Math.min(Number(range.max), value));
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
  if (entity === "transaction") fields = `${financeField("Название", "title", v("title"), "text", 'required autofocus')}${amountSlider("Сумма", "amount", v("amount"), typicalTop(data.finance.transactions.filter(t => t.kind === txKind).map(t => t.amount).concat(v("amount")), txKind === "income" ? 50000 : 5000), 'required')}<div class="field-row"><label class="field">Тип<select name="kind"><option value="expense" ${txKind === "expense" ? "selected" : ""}>Расход</option><option value="income" ${txKind === "income" ? "selected" : ""}>Доход</option></select></label></div><div class="field-row">${financeField("Дата", "date", v("date") || todayIso(), "date", "required")}<label class="field">Счёт<select name="accountId">${data.finance.accounts.map(a => `<option value="${esc(a.id)}" ${v("accountId") === a.id ? "selected" : ""}>${esc(a.name)} · ${esc(a.currency)}</option>`).join("")}</select></label></div><div class="field-row"><label class="field">Категория<select name="category">${FINANCE_CATEGORIES.map(c => `<option ${v("category") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label class="field">Проект<select name="project"><option value="">Без проекта</option>${data.projects.map(p => `<option ${v("project") === p.name ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label></div>`;
  if (entity === "account") fields = `${financeField("Название счёта", "name", v("name"), "text", 'required autofocus')}<div class="field-row"><label class="field">Валюта<select name="currency">${["RUB", "USD", "EUR"].map(c => `<option ${v("currency") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label></div>${amountSlider("Начальный остаток", "opening", v("opening"), Math.max(100000, Math.abs(Number(v("opening")) || 0) * 1.5), 'min="-100000000" required')}`;
  if (entity === "transfer") fields = `<div class="field-row"><label class="field">Со счёта<select name="fromId">${data.finance.accounts.map(a => `<option value="${esc(a.id)}">${esc(a.name)} · ${esc(a.currency)}</option>`).join("")}</select></label><label class="field">На счёт<select name="toId">${data.finance.accounts.map((a, i) => `<option value="${esc(a.id)}" ${i === 1 ? "selected" : ""}>${esc(a.name)} · ${esc(a.currency)}</option>`).join("")}</select></label></div>${amountSlider("Списать", "amount", "", Math.max(1000, ...data.finance.accounts.filter(a => a.currency === "RUB").map(a => accountBalance(a))), 'required')}${amountSlider("Зачислить", "toAmount", "", Math.max(1000, ...data.finance.accounts.filter(a => a.currency === "RUB").map(a => accountBalance(a))), 'required')}<div class="field-row">${financeField("Дата", "date", todayIso(), "date", "required")}${financeField("Комментарий", "note", "")}</div><p class="section-note">Если валюты различаются, укажите сумму зачисления по известному вам курсу. Прототип не загружает курс банка.</p>`;
  if (entity === "budget") fields = `<label class="field">Категория<select name="category">${FINANCE_CATEGORIES.map(c => `<option ${v("category") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>${amountSlider("Лимит в месяц, ₽", "limit", v("limit"), Math.max(30000, (Number(v("limit")) || 0) * 2), 'required')}`;
  if (entity === "goal") fields = `${financeField("Название цели", "title", v("title"), "text", 'required autofocus')}${savingsAccount() ? `<p class="goal-account-note">${icon("wallet", "icon-sm")}Копится на счёте «${esc(savingsAccount().name)}»</p>` : ""}${amountSlider("Нужно накопить, ₽", "target", v("target"), Math.max(300000, (Number(v("target")) || 0) * 2), 'required')}${amountSlider("Уже отложено, ₽", "saved", v("saved") || 0, Math.max(Number(v("target")) || 0, Number(v("saved")) || 0, 1000), 'required')}${financeField("Пояснение", "note", v("note"))}`;
  if (entity === "payment") fields = `${financeField("Название", "title", v("title"), "text", 'required autofocus')}${amountSlider("Сумма, ₽", "amount", v("amount"), Math.max(5000, (Number(v("amount")) || 0) * 2), 'required')}${financeField("День списания", "day", v("day") || 1, "number", 'min="1" max="31" required')}<label class="field">Категория<select name="category">${FINANCE_CATEGORIES.map(c => `<option ${v("category") === c ? "selected" : ""}>${c}</option>`).join("")}</select></label>`;
  if (entity === "debt") fields = `${financeField("Человек", "person", v("person"), "text", 'required autofocus')}<div class="field-row"><label class="field">Направление<select name="direction"><option value="to-me" ${v("direction") === "to-me" ? "selected" : ""}>Должны мне</option><option value="i-owe" ${v("direction") === "i-owe" ? "selected" : ""}>Должен я</option></select></label></div>${amountSlider("Всего, ₽", "amount", v("amount"), Math.max(50000, (Number(v("amount")) || 0) * 2), 'required')}${amountSlider("Уже погашено, ₽", "paid", v("paid") || 0, Math.max(Number(v("amount")) || 0, 1))}${financeField("За что", "note", v("note"))}`;
  const labels = { transaction: "Операцию", account: "Счёт", transfer: "Перевод", budget: "Бюджет", goal: "Цель", payment: "Платёж", debt: "Долг" };
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${item ? "Изменить" : "Добавить"} ${labels[entity].toLowerCase()}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><form id="finance-form">${fields}${entity === "account" && item && item === savingsAccount() ? `<p class="section-note">Постоянный счёт: в нём копятся цели. Название можно поменять, удалить счёт нельзя.</p>` : ""}<p class="form-error" role="alert"></p><div class="sheet-actions">${item && !(entity === "account" && item === savingsAccount()) ? `<button class="ghost-button danger-button" type="button" data-action="finance-delete">Удалить</button>` : ""}<button class="primary-button" type="submit">Сохранить</button></div></form></section></div>`;
}
function financeAction(action, control) {
  if (action === "goal-deposit-chip" && ui.sheet?.kind === "goal-deposit") { const input = document.querySelector('#goal-deposit-form input[name="amount"]'); if (input) { input.value = String(Number(input.value || 0) + Number(control.dataset.amount)); input.dispatchEvent(new Event("input", { bubbles: true })); } return true; }
  if (action === "goal-withdraw" && ui.sheet?.kind === "goal-deposit") { goalDepositApply(-1); return true; }
  if (action === "goal-open") { openGoalDeposit(control.dataset.id); return true; }
  if (action === "finance-accounts") { ui.sheet = { kind: "finance-accounts", justRendered: false }; render(); return true; }
  if (action === "finance-tab") { ui.financeTab = control.dataset.tab; ui.financeCategory = ""; render(); return true; }
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
  if (entity === "account") { const currency = String(form.get("currency") || "RUB"); if (existing && existing.currency !== currency && (data.finance.transactions.some(t => t.accountId === recordId) || data.finance.transfers.some(t => t.fromId === recordId || t.toId === recordId))) { error.textContent = "Валюту счёта со связанными операциями менять нельзя."; return true; } item.name = String(form.get("name") || "").trim(); item.currency = currency; item.opening = Number(form.get("opening") || 0); }
  if (entity === "budget") { item.category = String(form.get("category") || "Другое"); item.limit = Number(form.get("limit") || 0); }
  if (entity === "goal") { item.accountId = savingsAccount()?.id || ""; item.title = String(form.get("title") || "").trim(); item.target = Number(form.get("target") || 0); item.saved = Number(form.get("saved") || 0); item.note = String(form.get("note") || "").trim(); }
  if (entity === "payment") { item.title = String(form.get("title") || "").trim(); item.amount = Number(form.get("amount") || 0); item.day = Number(form.get("day") || 1); item.category = String(form.get("category") || "Подписки"); item.status ||= "upcoming"; }
  if (entity === "debt") { const amount = Number(form.get("amount") || 0); const paid = Number(form.get("paid") || 0); if (paid > amount) { error.textContent = "Погашено больше общей суммы."; return true; } item.person = String(form.get("person") || "").trim(); item.direction = String(form.get("direction") || "to-me"); item.amount = amount; item.paid = paid; item.note = String(form.get("note") || "").trim(); }
  if (!existing) list.push(item);
  ui.sheet = null; save(); toast(existing ? "Изменения сохранены" : "Запись добавлена"); return true;
}
function financeInput(event) {
  if (ui.sheet?.kind === "finance" && ui.sheet.entity === "transfer" && event.target.name === "amount") {
    const form = event.target.form; const from = data.finance.accounts.find(a => a.id === form.elements.fromId.value); const to = data.finance.accounts.find(a => a.id === form.elements.toId.value);
    if (from?.currency === to?.currency) form.elements.toAmount.value = event.target.value;
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
