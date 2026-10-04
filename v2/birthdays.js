/*
 * «Дни рождения» в «Сохранённом» — это события календаря с повтором каждый
 * год, а не отдельный список: добавили здесь — появилось в календаре, и
 * наоборот. Сверху — ближайшие, с днями до праздника; можно смотреть по месяцам.
 */

const BIRTHDAY_RE = /д(ень|\.)\s*рожд|(^|\s)др(\s|$)/i;
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

/** Кого поздравляем: «День рождения Ильи» → «Ильи»; иначе название целиком. */
function birthdayName(title) {
  return String(title || "").replace(/^\s*(д(ень|\.)\s*рожд\S*|др)\s*(у\s+)?[:—-]?\s*/i, "").trim() || title;
}

/** Ближайшая дата праздника и сколько до неё дней. */
function birthdayNext(due) {
  const [, m, d] = String(due).split("-").map(Number);
  const today = parseDate(todayIso());
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d);
  return { date: next, days: Math.round((next - today) / 86400000), month: m - 1, day: d };
}

function birthdays() {
  return data.events.filter(e => BIRTHDAY_RE.test(e.title || "") && /^\d{4}-\d{2}-\d{2}$/.test(e.due || ""))
    .map(e => ({ e, name: birthdayName(e.title), ...birthdayNext(e.due) }))
    .sort((a, b) => a.days - b.days);
}

function birthdayWhen(b) {
  return b.days === 0 ? "сегодня" : b.days === 1 ? "завтра" : b.days < 7 ? `через ${b.days} ${plural(b.days, "день", "дня", "дней")}` : b.days < 60 ? `через ${b.days} ${plural(b.days, "день", "дня", "дней")}` : "";
}

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
}

function birthdayRow(b) {
  const soon = b.days <= 7;
  const hue = [...b.name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 360;
  return `<button type="button" class="birthday-row ${b.days === 0 ? "today" : soon ? "soon" : ""}" data-action="birthday-open" data-id="${esc(b.e.id)}"><span class="birthday-avatar" style="--h:${hue}">${b.days === 0 ? "🎉" : esc(b.name.charAt(0).toUpperCase())}</span><span class="birthday-copy"><b>${esc(b.name)}</b><small>${b.day} ${MONTHS_GEN[b.month]}${b.e.repeat === "yearly" ? "" : " · без повтора"}</small></span>${birthdayWhen(b) ? `<span class="birthday-when">${birthdayWhen(b)}</span>` : ""}</button>`;
}

function renderBirthdaysPage() {
  const list = birthdays();
  const view = ui.birthdayView || "near";
  const tabs = `<div class="movie-seen-tabs" role="group" aria-label="Показать">${[["near", "Ближайшие"], ["months", "По месяцам"]].map(([key, label]) => `<button type="button" class="${view === key ? "active" : ""}" data-action="birthday-view" data-value="${key}" aria-pressed="${view === key}">${label}</button>`).join("")}</div>`;
  let body;
  if (!list.length) body = `<div class="empty-card"><strong>Пока пусто</strong><p>Добавьте день рождения — он появится в календаре и будет повторяться каждый год.</p></div>`;
  else if (view === "months") {
    const byMonth = Array.from({ length: 12 }, (_, m) => list.filter(b => b.month === m).sort((a, b) => a.day - b.day));
    const start = parseDate(todayIso()).getMonth();
    body = Array.from({ length: 12 }, (_, i) => (start + i) % 12).filter(m => byMonth[m].length).map(m => `<section class="birthday-month"><h3>${MONTHS_NOM[m]}</h3>${byMonth[m].map(birthdayRow).join("")}</section>`).join("");
  } else {
    const near = list.filter(b => b.days <= 30), later = list.filter(b => b.days > 30);
    body = `${near.length ? `<section class="birthday-month"><h3>В ближайший месяц</h3>${near.map(birthdayRow).join("")}</section>` : ""}${later.length ? `<section class="birthday-month"><h3>Дальше</h3>${later.map(birthdayRow).join("")}</section>` : ""}`;
  }
  const heading = `<div class="notes-topline"><button type="button" class="notes-back" data-action="saved-home">${icon("left", "icon-sm")}Сохранённое</button></div><header class="notes-heading saved-section-heading"><div><h1>Дни рождения</h1></div><span class="saved-heading-count">${list.length}</span><button type="button" class="icon-button" data-action="birthday-add" aria-label="Добавить день рождения">${icon("plus")}</button></header>`;
  return `<div class="saved-section-screen">${heading}<div class="content-grid"><div class="content-main">${tabs}<div class="birthday-list">${body}</div><p class="section-note">Это события календаря с повтором каждый год: добавили здесь — они и в календаре.</p></div></div></div>`;
}

/** Плитка на главной «Сохранённого»: сколько и чей ближайший. */
function birthdayTile() {
  const list = birthdays();
  const next = list[0];
  const about = next ? `${next.name} — ${birthdayWhen(next) || `${next.day} ${MONTHS_GEN[next.month]}`}` : "Повторяются каждый год";
  return `<button class="saved-section-card compact saved-section-birthdays" type="button" data-action="saved-section" data-category="birthdays" data-order-key="birthdays" aria-label="Дни рождения"><span class="saved-section-icon">${icon("calendar")}</span><span class="saved-section-copy"><strong>Дни рождения</strong><small>${esc(about)}</small></span>${list.length ? `<span class="saved-section-count">${list.length}</span>` : ""}</button>`;
}

function birthdayAction(action, control) {
  if (action === "birthday-view") { ui.birthdayView = control.dataset.value; render(); return true; }
  if (action === "birthday-open") { const e = data.events.find(x => x.id === control.dataset.id); if (e) openEntry("event", e.due, e.id); return true; }
  if (action === "birthday-add") {
    openEntry("event", todayIso());
    setTimeout(() => {
      const form = document.querySelector(".sheet form");
      if (!form) return;
      const title = form.querySelector('[name="title"]');
      if (title && !title.value) { title.value = "День рождения "; title.focus(); title.setSelectionRange(title.value.length, title.value.length); }
      const repeat = form.querySelector('select[name="repeat"]');
      if (repeat) repeat.value = "yearly";
    }, 40);
    return true;
  }
  return false;
}
