// The connected build binds the existing Glow screens and keypad to planner records.
const originalMore = R.more;
const originalGoalCard = goalCard;
const colors = ['var(--a3)', 'var(--a2)', '#5fd68f', '#6cb6ff'];
const categories = { food: 'Продукты', cafe: 'Кафе и рестораны', taxi: 'Транспорт',
  home: 'Дом и быт', health: 'Здоровье', fun: 'Развлечения', gift: 'Подарки' };
const currency = { RUB: '₽', USD: '$', EUR: '€' };
const money = (amount, code = 'RUB') => `${fmt(amount)} ${esc2(currency[code] || code)}`;
const cents = amount => Math.round(amount * 100);
const shift = (date, days) => new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
const todayKey = () => [TODAY.getFullYear(), String(TODAY.getMonth() + 1).padStart(2, '0'),
  String(TODAY.getDate()).padStart(2, '0')].join('-');
const dateLabel = date => date === todayKey() ? 'Сегодня' : date === shift(todayKey(), -1) ? 'Вчера'
  : /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', timeZone: 'UTC', ...(date.slice(0, 4) !== todayKey().slice(0, 4) ? { year: 'numeric' } : {}),
  }).format(new Date(date)) : '';
const empty = text => `<div class="glass empty">${text}</div>`;
const ak = id => encodeURIComponent(id);
const plus = (key, rows) => rows.reduce((sum, row) => sum + cents(row[key] || 0), 0) / 100;
const spent = row => row.kind === 'expense' && row.currency === 'RUB' && row.category !== 'не записал';
function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(row);
  }
  return groups;
}

let snapshot = null;
let write;
let splitIncome;
let resolveId;
let pendingFinance;
let saving = false;
let draftId, goalDraft, billDraft, debtDraft, splitPreview, splitOpen;
let accounts = [];

export function connectFinance(commit, split, resolve, hasPending) {
  write = commit;
  splitIncome = split;
  resolveId = resolve;
  pendingFinance = hasPending;
}

function resetFinance() {
  closeFn();
  S.facc = S.fcat = S.fgo = null;
  S.ft = 'ops';
  S.fin = 0;
  accounts = [];
  [draftId, goalDraft, billDraft, debtDraft, splitPreview, splitOpen] = [];
}

export function adoptFinance(next) {
  if (!next || !snapshot) resetFinance();
  snapshot = next;
  if (!next) return;
  const { finance } = next;
  const balance = new Map(finance.accounts.map(a => [a.id, cents(a.opening || 0)]));
  const add = (id, value) => { if (balance.has(id)) balance.set(id, balance.get(id) + cents(value || 0)); };
  for (const row of finance.transactions) add(row.accountId, (row.kind === 'income' ? 1 : -1) * row.amount);
  for (const row of finance.transfers) { add(row.fromId, -row.amount); add(row.toId, row.toAmount ?? row.amount); }
  accounts = finance.accounts.filter(a => !a.archived && a.kind !== 'goal').map((a, index) => ({
    ...a, balance: balance.get(a.id) / 100, color: colors[index % colors.length],
  }));
  if (!accounts.some(a => a.id === S.facc)) S.facc = null;
  if (!finance.goals.some(g => g.id === S.fgo)) S.fgo = null;
  if (splitOpen && !splitCandidates().some(row => row.id === splitOpen)) { splitOpen = null; splitPreview = null; }
}

const available = () => plus('balance', accounts.filter(a => a.currency === 'RUB'));
const acc = id => accounts.find(a => a.id === id);
const rubAccounts = () => accounts.filter(a => a.currency === 'RUB');
function monthBalanceChange() {
  const { transactions, transfers } = snapshot.finance;
  const liquid = new Set(rubAccounts().map(account => account.id));
  const today = todayKey();
  const month = today.slice(0, 7);
  const inMonth = row => row.date?.startsWith(month) && row.date <= today;
  const operations = transactions.filter(row => inMonth(row) && liquid.has(row.accountId)).reduce(
    (sum, row) => sum + (row.kind === 'income' ? 1 : -1) * cents(row.amount), 0);
  const moves = transfers.filter(inMonth).reduce((sum, row) => sum + (liquid.has(row.toId) ? cents(row.toAmount ?? row.amount) : 0)
    - (liquid.has(row.fromId) ? cents(row.amount) : 0), 0);
  return (operations + moves) / 100;
}
const eligible = () => accounts.filter(a => FS.ty !== 'tr' || accounts.some(b => b.id !== a.id && b.currency === a.currency));
const paymentPending = row => row.status !== 'confirmed';
const canConfirm = row => paymentPending(row) && (!row.nextOn || row.nextOn <= shift(todayKey(), 14));
const remaining = row => Math.max(0, (cents(row.amount) - cents(row.paid || 0)) / 100);
const dateForPayment = row => dateLabel(row.status === 'confirmed' ? row.paidAt : row.nextOn);
const splitCandidates = () => snapshot?.finance.transactions.filter(t => /^tx:\d+$/.test(t.id) && t.kind === 'income'
  && t.currency === 'RUB' && t.category !== 'не записал' && !t.split && t.amount > 0
  && t.date >= shift(todayKey(), -40) && t.date <= todayKey() && !snapshot.settings?.splitSkipped?.includes(t.id))
  .sort((a, b) => b.date.localeCompare(a.date)) || [];

R.more = () => {
  const container = document.createElement('template');
  container.innerHTML = originalMore();
  const metadata = $('[data-go="finance"] small', container.content);
  if (snapshot) {
    const due = snapshot.finance.payments.filter(paymentPending).map(row => row.nextOn).filter(Boolean).sort()[0];
    metadata.innerHTML = [money(available()), due ? `платёж · ${dateLabel(due).toLowerCase()}` : 'платежей к оплате нет'].join(' · ');
  } else metadata.textContent = 'Финансы Flow';
  return container.innerHTML;
};

function financeRow({ attr, id, title, subtitle, amount, code = 'RUB', icon, color, status = '', action = '' }) {
  return `<div class="tx fnr ${status}" ${attr}="${ak(id)}" style="--c:${color || 'var(--a3)'}">
    <span class="ic">${icon}</span><span><b>${esc2(title)}</b><small>${esc2(subtitle)}</small></span>
    <span class="fnbr"><span class="am ${status.includes('income') ? 'plus' : ''}">${amount < 0 ? '−' : status.includes('income') ? '+' : ''}${money(Math.abs(amount), code)}</span>${action}</span></div>`;
}

const accountView = () => accounts.map(a => `<button type="button" class="glass fnacc${S.facc === a.id ? ' on' : ''}" data-facc="${ak(a.id)}" style="--c:${a.color}">
  <i></i><span><small>${esc2(a.name)}</small><b>${money(a.balance, a.currency)}</b></span></button>`).join('');

const categoryInfo = name => {
  const key = Object.keys(categories).find(k => [categories[k].toLowerCase(), FCAT[k][0].toLowerCase()].includes(name.toLowerCase()));
  return { color: key ? FCAT[key][1] : 'var(--a3)', icon: fic()[key] || fic().wallet };
};

fnHist = () => {
  if (!snapshot) return '';
  const { finance } = snapshot;
  const transactions = finance.transactions.filter(row => (!S.facc || row.accountId === S.facc) && (!S.fcat || row.category === S.fcat));
  const transfers = S.fcat ? [] : finance.transfers.filter(t => !S.facc || t.fromId === S.facc || t.toId === S.facc);
  const rows = [...transactions, ...transfers].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const days = groupBy(rows, 'date');
  return Array.from(days, ([day, entries]) => `<div class="fsl fnday">${dateLabel(day)}${plus('amount', entries.filter(spent)) ? `<span>−${money(plus('amount', entries.filter(spent)))}</span>` : ''}</div>
    <div class="glass fnl">${entries.map(row => {
    if ('fromId' in row) {
      const from = finance.accounts.find(a => a.id === row.fromId);
      const to = finance.accounts.find(a => a.id === row.toId);
      const received = S.facc === row.toId;
      return financeRow({ attr: 'data-tx', id: row.id, title: row.note || 'Перевод',
        subtitle: [from?.name, to?.name].filter(Boolean).join(' → '),
        amount: received ? row.toAmount ?? row.amount : -row.amount,
        code: (received ? to : from)?.currency, icon: fic().debts, status: received ? 'income' : '' });
    }
    const income = row.kind === 'income';
    return financeRow({ attr: 'data-tx', id: row.id, title: row.title || row.category || 'Операция',
      subtitle: [row.category, !S.facc && acc(row.accountId)?.name].filter(Boolean).join(' · '),
      amount: income ? row.amount : -row.amount, code: row.currency, status: income ? 'income' : '',
      ...categoryInfo(row.category || ''), ...(income ? { icon: fic().wallet, color: '#5fd68f' } : {}) });
  }).join('')}</div>`).join('') || empty('Операций нет');
};

fnShares = () => {
  const month = new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(TODAY);
  const rows = snapshot.finance.transactions.filter(t => spent(t) && t.date?.startsWith(todayKey().slice(0, 7)) && t.date <= todayKey());
  const totals = Array.from(groupBy(rows, 'category'), ([category, entries]) => {
    const name = category || 'Прочее';
    return { name, amount: plus('amount', entries), ...categoryInfo(name) };
  }).sort((a, b) => b.amount - a.amount);
  const total = plus('amount', totals);
  return `<div class="glass fnsh"><small>По категориям · ${month}</small><b>${money(total)}</b>
    ${total > 0 ? `<div class="fnbar">${totals.map(({ name, amount, color }) =>
      `<i data-k="${ak(name)}" class="${S.fcat && S.fcat !== name ? 'dim' : ''}" style="--c:${color};flex:${amount}"></i>`).join('')}</div>
    <div class="fnlg">${totals.map(({ name, amount, color }) =>
      `<button type="button" class="fnlc${S.fcat === name ? ' on' : ''}" data-fcat="${ak(name)}" style="--c:${color}"><i></i>${esc2(name)}<span>${Math.round(amount * 100 / total)}%</span></button>`).join('')}</div>` : ''}</div>`;
};

drawSpend = el => {
  const today = todayKey();
  const start = S.fin === 2 ? today.slice(0, 8) + '01' : S.fin === 1 ? shift(today, -6) : today;
  const rows = snapshot.finance.transactions.filter(row => spent(row) && row.date >= start && row.date <= today);
  $('#spSum', el).textContent = money(plus('amount', rows));
  const sums = groupBy(rows, 'date');
  const points = [];
  for (let date = start; date <= today; date = shift(date, 1)) points.push(plus('amount', sums.get(date) || []));
  const chart = $('#spC', el);
  if (!points.some(value => value > 0)) { chart.replaceChildren(); return; }
  curve(chart, points.length === 1 ? [points[0], points[0]] : points);
};

function bills() {
  const payments = [...snapshot.finance.payments].sort((a, b) => Number(paymentPending(b)) - Number(paymentPending(a)) || (a.nextOn || '').localeCompare(b.nextOn || ''));
  const monthly = payments.filter(row => row.currency === 'RUB');
  const monthlyRub = monthly.reduce((sum, row) => sum + row.amount / (row.repeat === 'yearly' ? 12 : 1), 0);
  const unpaid = monthly.filter(row => paymentPending(row) && row.nextOn?.slice(0, 7) === todayKey().slice(0, 7));
  const list = payments.map(p => financeRow({ attr: 'data-bill', id: p.id, title: p.title,
    subtitle: [p.status === 'confirmed' && 'Списано', dateForPayment(p), p.category].filter(Boolean).join(' · '),
    amount: p.amount, code: p.currency, icon: fic().bank, status: paymentPending(p) ? 'fnb' : 'fnb paid',
    action: canConfirm(p) ? `<button type="button" class="btn sm main" data-bpay="${ak(p.id)}">Списалось</button>`
      : !paymentPending(p) ? `<span class="fnok">${ic.check}</span>` : '',
  })).join('');
  return `<div class="glass fnsum"><div><small>В месяц</small><b>${money(cents(monthlyRub) / 100)}</b></div>
    <div><small>Ещё спишется в этом месяце</small><b class="acc">${money(plus('amount', unpaid))}</b></div></div>
    ${list ? `<div class="glass fnl">${list}</div>` : empty('Платежей нет')}`;
}

function goals() {
  return snapshot.finance.goals.filter(g => g.target > 0).map((g, index) => {
    const linked = snapshot.finance.accounts.find(a => a.id === g.accountId);
    const from = rubAccounts();
    const card = originalGoalCard({ id: ak(g.id), t: esc2(g.title), s: esc2(g.note || ''),
      v: g.saved, goal: g.target, c: colors[index % colors.length] });
    const holder = document.createElement('template');
    holder.innerHTML = card;
    const root = holder.content.firstElementChild;
    root.classList.toggle('open', g.id === S.fgo);
    const open = $('[data-gput]', root);
    open.disabled = !linked || !from.length || g.saved >= g.target;
    const field = $('.fngc span', root);
    if (from.length) field.innerHTML = `<select class="chip glass" aria-label="Счёт для цели" data-goal-from>${from.map(a =>
      `<option value="${ak(a.id)}"${goalDraft?.fromId === a.id ? ' selected' : ''}>${esc2(a.name)}</option>`).join('')}</select>`;
    else field.textContent = '';
    return holder.innerHTML;
  }).join('') || empty('Целей нет');
}

function debts() {
  const open = snapshot.finance.debts.filter(row => remaining(row) > 0);
  const totals = direction => open.filter(row => row.direction === direction).reduce((sum, row) => sum + cents(remaining(row)), 0) / 100;
  const rows = direction => open.filter(row => row.direction === direction).map(row => {
    const credit = row.kind === 'credit';
    const p = credit ? snapshot.finance.payments.find(p => p.creditId === row.id) : null;
    const canPay = !credit || (p && canConfirm(p) && row.monthly > 0);
    const label = credit ? `Внести ${fmt(Math.min(remaining(row), row.monthly))}` : direction === 'to-me' ? 'Вернули' : 'Отдал';
    return financeRow({ attr: 'data-debt', id: row.id, title: row.person, subtitle: [row.note, dateLabel(row.endsOn)].filter(Boolean).join(' · '),
      amount: remaining(row), icon: fic().bank, color: direction === 'to-me' ? '#5fd68f' : '',
      action: canPay ? `<button type="button" class="btn sm glass" data-dpay="${ak(row.id)}">${label}</button>` : '' });
  }).join('');
  return `<div class="glass fnsum"><div><small>Должны мне</small><b class="plus">${money(totals('to-me'))}</b></div>
    <div><small>Должен я</small><b class="acc">${money(totals('i-owe'))}</b></div></div>
    <div id="fnDl">${[['to-me', 'Должны мне'], ['i-owe', 'Должен я']].map(([dir, label]) => {
      const list = rows(dir);
      return list ? `<div class="fsl">${label}</div><div class="glass fnl">${list}</div>` : '';
    }).join('') || empty('Долгов нет')}</div>`;
}

function distribution() {
  const row = snapshot.finance.rules.length ? splitCandidates()[0] : null;
  if (!row) return '';
  const opened = splitOpen === row.id;
  const display = splitPreview?.id === row.id ? splitPreview.data : null;
  const line = (title, amount, color) => `<div class="fndr" style="--c:${color}"><span>${esc2(title)}</span><b>${money(amount)}</b>
    <i class="fndb"><i style="--w:${Math.min(1, amount / row.amount)}"></i></i></div>`;
  let lines = '';
  let hasMoves = false;
  if (display) {
    const reserve = Math.min(row.amount, Math.max(0, display.obligations || 0));
    const free = (cents(row.amount) - cents(reserve)) / 100;
    const shares = display.shares.map(({ name, percent, account }) => ({
      dest: account || name, amount: Math.floor(free * Math.max(0, Number(percent))) / 100,
    })).filter(move => move.amount > 0);
    hasMoves = !!shares.length || reserve > 0 && !!(display.topupFrom || !display.topup && display.fixed);
    lines = (reserve ? line('На платежи', reserve, colors[0]) : '') + shares.map((move, i) =>
      line(move.dest, move.amount, colors[(i + 1) % colors.length])).join('') +
      line('На жизнь', Math.max(0, cents(free - plus('amount', shares))) / 100, colors[2]);
  }
  return `<div class="glass fnd${opened ? ' open' : ''}" id="fnd"><div class="tx fndh" style="--c:#5dff9e">
    <span class="ic">${fic().wallet}</span><span><b>Пришло ${money(row.amount)}</b><small>${esc2(row.title)}</small></span>
    <button type="button" class="btn sm main" id="fndGo">${opened ? 'Свернуть' : 'Распределить'}</button></div><div class="fndx"><div><div class="fndi">
    ${lines || (opened ? `<small>${splitPreview?.failed ? 'Не удалось загрузить расчёт' : 'Считаю…'}</small>` : '')}
    <div class="fnda"><button type="button" class="btn glass" id="fndNo">Не раскладывать</button>
    <button type="button" class="btn main" id="fndOk"${hasMoves ? '' : ' disabled'}>Разложить</button></div></div></div></div></div>`;
}

const body = () => ({ ops: fnOps, bills, goals, debts })[S.ft]();
const retryMarkup = '<button type="button" class="btn glass" id="financeRetry">Повторить сохранение</button>';
R.finance = () => {
  if (!snapshot) return '';
  const delta = monthBalanceChange();
  return `<div class="srow wsrow hsrow">${capsHTML(FT, S.ft, 'data-ft', fic())}</div>
  <div class="plate-w bal crt" style="--lvl:.6"><div class="halo"></div><div class="plate"><div class="fill"></div><i class="scan"></i>
  <small class="fnbl rgbt">Доступно в рублях</small><div class="sum"><b class="lit" id="fnBal" data-v="${available()}">${fmt(available())}</b><span class="rgbt">₽</span></div>
  <div class="delta rgbt">${delta ? fmtS(delta) : '0'} ₽ с начала месяца</div></div></div>
  <div class="fnaccs" id="fnAccs">${accountView()}</div><div id="fnRetry">${pendingFinance?.() ? retryMarkup : ''}</div>
  <div id="fnDist">${distribution()}</div><div id="fnBody">${body()}</div>`;
};

const selectTab = (el, key) => {
  const moving = $('#fnBody', el);
  if (!moving) return;
  S.ft = key;
  moving.innerHTML = body();
  bindFnBody(el);
  if (!reduce) { stagger(moving); moving.animate([{ opacity: 0, transform: 'translateX(18px)' }, { opacity: 1, transform: 'none' }],
    { duration: 360, easing: 'cubic-bezier(.19,1,.22,1)' }); }
};

function updateDistribution(el) {
  const box = $('#fnDist', el);
  if (box) box.innerHTML = distribution();
}

async function run(button, job) {
  if (!snapshot || saving) return false;
  saving = true;
  button.disabled = true;
  try { return await job(); }
  catch { toast('Не удалось выполнить действие'); return false; }
  finally {
    saving = false;
    button.disabled = false;
    const retry = $('#fnRetry');
    if (retry) retry.innerHTML = pendingFinance?.() ? retryMarkup : '';
  }
}

async function confirmBill(id) {
  const row = snapshot.finance.payments.find(p => p.id === id);
  if (!row || !canConfirm(row)) return false;
  if (billDraft?.id !== id) billDraft = { id, date: todayKey(), nextOn: row.nextOn };
  const draft = billDraft;
  const ok = await write(next => {
    const current = next.finance.payments.find(p => p.id === id);
    if (current && current.nextOn === draft.nextOn && paymentPending(current)) {
      current.status = 'confirmed';
      current.paidAt = draft.date;
    }
  }, 'bill:' + id);
  if (!ok) return false;
  const current = snapshot?.finance.payments.find(p => p.id === id);
  if (!current || !paymentPending(current) || current.nextOn !== draft.nextOn) return true;
  toast('Сервер не подтвердил списание');
  return false;
}

bindFinance = el => {
  if (!snapshot) return;
  bindCaps(el, 'data-ft', key => selectTab(el, key));
  bindFnBody(el);
  el.onclick = event => {
    const button = event.target.closest('button');
    if (!button || saving || !snapshot) return;
    const { facc, fcat, gput, gadd, bpay, dpay } = button.dataset;
    if (facc) {
      const id = decodeURIComponent(facc);
      S.facc = S.facc === id ? null : id;
      $$('.fnacc', el).forEach(node => node.classList.toggle('on', node.dataset.facc === ak(S.facc)));
      if (S.ft !== 'ops') $('[data-ft="ops"]', el).click();
      else fnHistUpd(el);
    } else if (fcat) {
      const category = decodeURIComponent(fcat);
      S.fcat = S.fcat === category ? null : category;
      $$('.fnlc', el).forEach(node => node.classList.toggle('on', node.dataset.fcat === ak(S.fcat)));
      $$('.fnbar i', el).forEach(node => node.classList.toggle('dim', !!S.fcat && node.dataset.k !== ak(S.fcat)));
      fnHistUpd(el);
    } else if (gput) {
      const id = decodeURIComponent(gput);
      S.fgo = S.fgo === id ? null : id;
      $$('.fng', el).forEach(node => node.classList.toggle('open', node.dataset.goal === ak(S.fgo)));
    } else if (gadd) {
      const card = button.closest('[data-goal]');
      const id = decodeURIComponent(card.dataset.goal);
      const goal = snapshot.finance.goals.find(g => g.id === id);
      const from = acc(decodeURIComponent($('[data-goal-from]', card)?.value || ''));
      const to = snapshot.finance.accounts.find(a => a.id === goal?.accountId && a.currency === 'RUB' && !a.archived);
      if (!from || !to || !goal) return;
      const amount = Math.min(Number(gadd), (cents(goal.target) - cents(goal.saved)) / 100);
      if (goalDraft?.goalId !== id || goalDraft.fromId !== from.id || goalDraft.chip !== gadd) {
        goalDraft = { id: crypto.randomUUID(), goalId: id, fromId: from.id, toId: to.id, amount, chip: gadd, date: todayKey(), note: `В цель «${goal.title}»` };
      }
      const { id: transferId, fromId, toId, date, note } = goalDraft;
      const transfer = { id: transferId, fromId, toId, date, note, amount: goalDraft.amount, toAmount: goalDraft.amount };
      if (!(transfer.amount > 0) || transfer.amount > from.balance) { toast('На счёте недостаточно средств'); return; }
      // Only the transfer is written. The server derives the saved amount from the goal account.
      void run(button, async () => {
        if (!await write(next => addOnce(next.finance.transfers, transfer), 'goal:' + transfer.id)) return false;
        goalDraft = null; S.fgo = null;
        if (curId() === 'finance') $('.fng.open', el)?.classList.remove('open');
        toast('Отложено ' + money(transfer.amount));
        return true;
      });
    } else if (bpay || dpay) {
      const id = decodeURIComponent(bpay || dpay);
      const debt = dpay && snapshot.finance.debts.find(d => d.id === id);
      const linked = debt && snapshot.finance.payments.find(p => p.creditId === id);
      void run(button, async () => {
        let ok;
        if (bpay || linked) ok = await confirmBill(linked?.id || id);
        else if (debt && debt.kind !== 'credit') {
          if (debtDraft?.id !== id) debtDraft = { id, amount: debt.amount };
          const draft = debtDraft;
          ok = await write(next => {
            const current = next.finance.debts.find(d => d.id === id);
            if (current && current.amount === draft.amount) current.paid = draft.amount;
          }, 'debt:' + id);
        }
        if (ok) { billDraft = debtDraft = null; toast(debt && !linked ? 'Долг отмечен погашенным' : 'Списание подтверждено'); }
        return ok;
      });
    } else if (button.id === 'financeRetry') {
      void run(button, async () => { if (await write(null, 'recover')) { goalDraft = billDraft = debtDraft = null; toast('Операция сохранена'); } });
    } else if (button.id === 'fndGo' || button.id === 'fndNo' || button.id === 'fndOk') {
      const row = splitCandidates()[0];
      if (row) void handleDistribution(button, row, el);
    }
  };
};

async function handleDistribution(button, row, el) {
  if (button.id === 'fndGo') {
    splitOpen = splitOpen === row.id ? null : row.id;
    updateDistribution(el);
    if (!splitOpen || splitPreview?.id === row.id && splitPreview.data) return;
    await run(button, async () => {
      const answer = await splitIncome([row.id], false).catch(() => null);
      if (!snapshot) return;
      const data = Array.isArray(answer?.shares) && answer.total > 0 ? answer : null;
      splitPreview = { id: row.id, data, failed: !data };
      updateDistribution(el);
    });
    return;
  }
  await run(button, async () => {
    if (button.id === 'fndNo') {
      if (!await write(next => { next.settings.splitSkipped = [...new Set([...(next.settings.splitSkipped || []), row.id])]; }, 'split-skip:' + row.id)) return;
      toast('Доход не будет распределяться');
    } else {
      const answer = await splitIncome([row.id], true);
      if (!answer) return;
      toast(answer.made ? 'Распределение добавлено в «Все дела»' : answer.note || 'Нечего распределять');
    }
  });
}

function addOnce(rows, record) {
  if (rows.some(row => row.id === record.id || row.id === resolveId(record.id))) return;
  rows.push(record);
}

fnAmt = () => {
  const amount = Number(FS.amt);
  $('#fnAv').textContent = (amount && FS.ty !== 'tr' ? FS.ty === 'in' ? '+' : '−' : '') + fmt(amount);
  $('#fnAmt').classList.toggle('zero', !amount);
  $('#fnAmt').classList.toggle('inc', FS.ty === 'in');
  const from = acc(FS.acc);
  $('#fnAmt span').textContent = from ? currency[from.currency] || from.currency : '₽';
  $('#fnSave').disabled = !amount || !from || FS.ty === 'tr' && (!FS.to || FS.to === FS.acc) || saving;
};

fnSheetRender = () => {
  const valid = eligible();
  if (!valid.some(a => a.id === FS.acc)) FS.acc = valid[0]?.id || '';
  const from = acc(FS.acc);
  const to = valid.filter(a => a.id !== FS.acc && a.currency === from?.currency);
  if (!to.some(a => a.id === FS.to)) FS.to = to[0]?.id || '';
  $('#fnType').style.setProperty('--i', ['out', 'in', 'tr'].indexOf(FS.ty));
  $$('[data-fty]', $('#fnType')).forEach(b => b.classList.toggle('on', b.dataset.fty === FS.ty));
  $('#fnCats').innerHTML = FS.ty === 'out' ? Object.entries(FCAT).map(([key, [title, color]]) =>
    fnChip(key, title, fic()[key], color, 'data-fsc', FS.cat === key)).join('')
    : FS.ty === 'in' ? Object.entries(FINC).map(([key, [title, icon]]) =>
      fnChip(key, title, fic()[icon], '#5fd68f', 'data-fsc', FS.cat === key)).join('')
    : `<span class="fnlab">Куда</span>${to.map(a => fnChip(esc2(a.id), esc2(a.name), '', a.color, 'data-fst', FS.to === a.id)).join('')}`;
  $('#fnAcc').innerHTML = `<span class="fnlab">${FS.ty === 'in' ? 'На счёт' : FS.ty === 'tr' ? 'Откуда' : 'Со счёта'}</span>${valid.map(a =>
    fnChip(esc2(a.id), esc2(a.name), '', a.color, 'data-fsa', FS.acc === a.id)).join('')}`;
  fnAmt();
};

openFn = () => {
  if (!snapshot || saving) return;
  if (pendingFinance?.()) { toast('Сначала повтори сохранение незавершённой операции'); return; }
  if (!accounts.length) { toast('Нет счетов для операций'); return; }
  const sheet = $('#fnSheet');
  if (!sheet.onclick) bindKeypad(sheet);
  draftId = crypto.randomUUID();
  Object.assign(FS, { ty: 'out', amt: '', cat: 'cafe', acc: S.facc, to: '' });
  fnSheetRender();
  sheet.classList.add('on');
  sheet.setAttribute('aria-hidden', 'false');
  $('#fnscrim').classList.add('on');
  $('[data-fty="out"]', sheet).focus({ preventScroll: true });
};

function bindKeypad(sheet) {
  $('#fnKp').innerHTML = ['1','2','3','4','5','6','7','8','9','000','0','del'].map(key =>
    `<button type="button" class="fnk" data-k="${key}" aria-label="${key === 'del' ? 'Стереть' : key}">${key === 'del' ? fic().del : key}</button>`).join('');
  const close = () => {
    if (saving) return;
    draftId = null;
    closeFn();
    if (curId() === 'finance') $('#hAct').focus({ preventScroll: true });
  };
  const input = key => {
    const value = key === 'del' ? FS.amt.slice(0, -1) : (FS.amt + key).replace(/^0+/, '');
    if (value.length > 8) return;
    FS.amt = value;
    fnAmt();
    sfx('tick'); buzz(4);
    if (!reduce) $('#fnAv').animate([{ transform: 'scale(1.06)' }, { transform: 'none' }],
      { duration: 220, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
  };
  sheet.onclick = event => {
    const button = event.target.closest('button');
    if (!button || saving) return;
    if (pendingFinance?.() && button.id !== 'fnSave') return;
    const { fty, fsc, fsa, fst, k } = button.dataset;
    if (fty) { FS.ty = fty; FS.cat = fty === 'in' ? 'proj' : 'cafe'; }
    else if (fsc) FS.cat = fsc;
    else if (fsa) FS.acc = fsa;
    else if (fst) FS.to = fst;
    else if (k) { input(k); return; }
    else if (button.id === 'fnSave') { void fnSave(); return; }
    fnSheetRender();
    sfx('tick'); buzz(4);
  };
  sheet.onkeydown = event => {
    if (event.key === 'Escape') { close(); return; }
    if (saving || pendingFinance?.() || !/^(?:[0-9]|Backspace)$/.test(event.key)) return;
    event.preventDefault();
    input(event.key === 'Backspace' ? 'del' : event.key);
  };
  $('#fnscrim').onclick = close;
  const grab = $('#fnGrab');
  let start, distance;
  grab.onpointerdown = event => {
    start = event.clientY; distance = 0;
    grab.setPointerCapture(event.pointerId);
    sheet.classList.add('drag');
  };
  grab.onpointermove = event => {
    if (start == null) return;
    distance = Math.max(0, event.clientY - start);
    sheet.style.transform = `translateY(${distance}px)`;
  };
  grab.onpointerup = grab.onpointercancel = event => {
    if (start == null) return;
    start = null; sheet.style.transform = '';
    sheet.classList.remove('drag');
    if (event.type === 'pointerup' && distance > 90) close();
  };
}

fnSave = async () => {
  const amount = Number(FS.amt);
  const from = acc(FS.acc);
  const to = acc(FS.to);
  if (!(amount > 0) || !from || !draftId || FS.ty === 'tr' && (!to || from === to || from.currency !== to.currency)) return;
  const id = draftId;
  const transfer = FS.ty === 'tr';
  const income = FS.ty === 'in';
  const category = income ? FINC[FS.cat]?.[0] : categories[FS.cat];
  const date = todayKey();
  const operation = transfer ? { id, fromId: from.id, toId: to.id, amount, toAmount: amount, date, note: 'Перевод' }
    : { id, title: income ? category : FCAT[FS.cat]?.[0] || category, kind: income ? 'income' : 'expense',
      category, currency: from.currency, amount, accountId: from.id, date, manual: true };
  const button = $('#fnSave');
  await run(button, async () => {
    const result = await write(next => {
      const rows = transfer ? next.finance.transfers : next.finance.transactions;
      const previous = rows.find(row => row.id === id || row.id === resolveId(id));
      if (previous) Object.assign(previous, operation, { id: previous.id });
      else rows.push(operation);
    }, 'op:' + id);
    if (result && draftId === id) { draftId = null; closeFn(); toast('Записано ' + money(amount, from.currency)); }
  });
  fnAmt();
};
