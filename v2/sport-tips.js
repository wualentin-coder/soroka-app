// Совет тренера: одна короткая карточка из базы знаний (sport/core coachKnowledge)
// на «Сегодня» и под разбором тренировки. Факты и ссылки только из базы.
(() => {
  const KEY = "flow.sport.coachTips";
  const DAY = 86400000;
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const core = () => window.SportCore;

  function shownMap() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; }
  }
  function remember(id, date) {
    try {
      const map = shownMap();
      if (map[id] === date) return;
      map[id] = date;
      localStorage.setItem(KEY, JSON.stringify(map));
    } catch { /* приватный режим — просто без ротации */ }
  }

  const daysSince = (iso, today) => iso ? Math.floor((Date.parse(today + "T12:00:00Z") - Date.parse(String(iso).slice(0, 10) + "T12:00:00Z")) / DAY) : Infinity;

  /** Trigger for the Today screen. */
  function todayTrigger(state, visible, date, schedule) {
    if (schedule?.shifted && schedule.missed > 0) return "missed";
    const main = (visible || []).find((entry) => entry.kind === "main" && entry.date === date);
    if (main && /^Облегчённая неделя/.test(main.plan?.focus || main.workout?.focus || "")) return "deload";
    if (main) return "today";
    const last = Object.values(state?.measurementEntries || {}).map((entry) => entry.recordedAt).filter(Boolean).sort().at(-1);
    if (last && daysSince(last, date) >= 56) return "measure_due";
    return "rest_day";
  }

  function card(tip, date) {
    if (!tip) return "";
    remember(tip.id, date);
    const cites = tip.cites.filter((s) => s.url).map((s) =>
      `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.cite)}</a></li>`).join("");
    const course = tip.cites.some((s) => !s.url) ? "<li>Курс владельца</li>" : "";
    return `<section class="sp2-coach-tip" aria-label="Совет тренера"><small>Совет тренера</small>` +
      `<strong>${esc(tip.title)}</strong><p>${esc(tip.text)}</p>` +
      (cites || course ? `<details><summary>Источники</summary><ul>${cites}${course}</ul></details>` : "") + `</section>`;
  }

  const goalOf = (state) => core()?.readSport2Profile?.(state?.sport2Profile)?.goal ?? null;

  function today(state, visible, date, schedule) {
    const pick = core()?.pickCoachTip;
    if (typeof pick !== "function") return "";
    return card(pick(todayTrigger(state, visible, date, schedule), date, shownMap(), 21, goalOf(state)), date);
  }

  /** Under a finished workout's analysis: hard / easy / plain. */
  function afterSession(job, date) {
    const pick = core()?.pickCoachTip, trigger = core()?.sessionTrigger;
    if (typeof pick !== "function" || typeof trigger !== "function" || !job) return "";
    const hard = (job.safety || []).some((s) => s.level === "caution" || s.level === "stop");
    const state = window.spState?.()?.state;
    return card(pick(trigger({ difficulty: hard ? 8 : job.difficulty ?? null }), date, shownMap(), 21, goalOf(state)), date);
  }

  window.SportTips = { today, afterSession, todayTrigger };
})();
