/**
 * Праздники и выходные РФ для календаря.
 *
 * Праздничные дни берутся из ст. 112 ТК. Праздник, выпавший на субботу или
 * воскресенье (кроме январских), сам переходит на следующий рабочий день.
 * Январские переносит правительство отдельным постановлением на каждый год —
 * такие переносы записаны в TRANSFERS. Год без записи считается без
 * январских переносов, остальное верно и для него.
 */
const HOLIDAYS = {
  "01-01": "Новый год", "01-02": "Новогодние каникулы", "01-03": "Новогодние каникулы", "01-04": "Новогодние каникулы",
  "01-05": "Новогодние каникулы", "01-06": "Новогодние каникулы", "01-07": "Рождество", "01-08": "Новогодние каникулы",
  "02-23": "День защитника Отечества", "03-08": "Международный женский день", "05-01": "Праздник Весны и Труда",
  "05-09": "День Победы", "06-12": "День России", "11-04": "День народного единства",
};
// off — дополнительные выходные, work — рабочие субботы/воскресенья.
const TRANSFERS = {
  // Постановление от 24.09.2025 № 1466: 3 января → 9 января, 4 января → 31 декабря.
  2026: { off: { "2026-01-09": "Перенос с 3 января", "2026-12-31": "Перенос с 4 января" }, work: [] },
  // Постановление от 17.09.2026 № 1187: 2 января → 5 ноября, 3 января → 31 декабря, 20 февраля → 22 февраля.
  2027: { off: { "2027-11-05": "Перенос с 2 января", "2027-12-31": "Перенос с 3 января", "2027-02-22": "Перенос с 20 февраля" }, work: ["2027-02-20"] },
};
const holidayYears = new Map();

function holidayYear(year) {
  if (holidayYears.has(year)) return holidayYears.get(year);
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const days = new Map();
  const extra = TRANSFERS[year] || { off: {}, work: [] };
  const weekend = date => date.getDay() === 0 || date.getDay() === 6;
  for (const [md, name] of Object.entries(HOLIDAYS)) days.set(`${year}-${md}`, { holiday: name });
  for (const [day, name] of Object.entries(extra.off)) days.set(day, { holiday: days.get(day)?.holiday || name, transfer: true });
  // Праздник в выходной (не январский) — следующий рабочий день тоже выходной.
  for (const [md, name] of Object.entries(HOLIDAYS)) {
    if (md.startsWith("01-")) continue;
    const date = new Date(year, Number(md.slice(0, 2)) - 1, Number(md.slice(3)), 12);
    if (!weekend(date)) continue;
    const next = new Date(date);
    do next.setDate(next.getDate() + 1); while ((weekend(next) && !extra.work.includes(iso(next))) || days.has(iso(next)));
    days.set(iso(next), { holiday: `Перенос: ${name}`, transfer: true });
  }
  const result = { days, work: new Set(extra.work) };
  holidayYears.set(year, result);
  return result;
}

/** { off, holiday, workday } для даты YYYY-MM-DD. */
function dayInfo(value) {
  const day = String(value).slice(0, 10);
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return { off: false, holiday: "", workday: false };
  const year = holidayYear(y);
  const date = new Date(y, m - 1, d, 12);
  if (year.work.has(day)) return { off: false, holiday: "", workday: true };
  const special = year.days.get(day);
  if (special) return { off: true, holiday: special.holiday, workday: false };
  return { off: date.getDay() === 0 || date.getDay() === 6, holiday: "", workday: false };
}
