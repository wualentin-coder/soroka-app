/*
 * Календарь раскрывается за пальцем: тянете вниз — из недели вырастает месяц
 * ровно настолько, насколько протянули; отпустили — докатывается до конца
 * (или обратно, если протянули мало). Вверх — сворачивается так же. Неделя,
 * которая была видна, остаётся на месте, остальные выезжают из-под неё.
 */
(function installCalendarDrag() {
  let drag = null;
  const ease = "cubic-bezier(.22, 1, .36, 1)";

  /** Геометрия раскрытого месяца: высота строки, высота сетки и строка выбранной недели. */
  function measure(grid) {
    const cells = [...grid.children];
    const first = cells[0]?.getBoundingClientRect();
    const eighth = cells[7]?.getBoundingClientRect();
    const row = eighth && first ? eighth.top - first.top : (first?.height || 40) + 4;
    const full = grid.scrollHeight;
    const anchor = ui.calendarAnchor || ui.selected || todayIso();
    const at = cells.findIndex(c => c.dataset.date === anchor);
    return { row, full, k: Math.max(0, Math.floor(Math.max(0, at) / 7)), one: first?.height || row };
  }

  /** p: 0 — неделя, 1 — месяц. */
  function paint(p) {
    const { grid, g } = drag;
    const height = g.one + (g.full - g.one) * p;
    grid.style.height = `${height}px`;
    grid.style.setProperty("--cal-shift", `${-g.k * g.row * (1 - p)}px`);
    drag.card.style.setProperty("--cal-p", p.toFixed(3));
  }

  function begin(card, startY, wasExpanded) {
    // Тянем из недели — сразу рисуем месяц, но показываем его высотой в одну неделю.
    if (!wasExpanded) { ui.calendarExpanded = true; ui.mode = "month"; ui.month = (ui.calendarAnchor || ui.selected || todayIso()).slice(0, 7) + "-01"; render(); }
    const fresh = document.querySelector(".calendar-card");
    const grid = fresh?.querySelector(".calendar-grid");
    if (!grid) return null;
    fresh.classList.add("cal-dragging");
    grid.style.height = "";
    const g = measure(grid);
    return { card: fresh, grid, g, startY, from: wasExpanded ? 1 : 0, p: wasExpanded ? 1 : 0 };
  }

  function settle(open) {
    const { card, grid, g, p } = drag;
    const target = open ? 1 : 0;
    const duration = Math.max(160, Math.abs(target - p) * 380);
    grid.style.transition = `height ${duration}ms ${ease}`;
    card.style.setProperty("--cal-dur", `${duration}ms`);
    requestAnimationFrame(() => {
      grid.style.height = `${g.one + (g.full - g.one) * target}px`;
      grid.style.setProperty("--cal-shift", `${-g.k * g.row * (1 - target)}px`);
      card.style.setProperty("--cal-p", String(target));
    });
    setTimeout(() => {
      document.body.classList.add("cal-just-dragged");
      setTimeout(() => document.body.classList.remove("cal-just-dragged"), 400);
      ui.calendarExpanded = open;
      ui.mode = open ? "month" : "week";
      if (!open) ui.calendarAnchor = ui.calendarAnchor || ui.selected;
      render();
    }, duration + 20);
  }

  let start = null;
  document.addEventListener("pointerdown", event => {
    const card = event.target.closest?.(".calendar-card");
    if (!card || event.button > 0 || event.target.closest(".calendar-controls, .calendar-toolbar, .calendar-expand-title, .plan-summary")) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  document.addEventListener("pointermove", event => {
    if (!start || event.pointerId !== start.id) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (!drag) {
      if (Math.abs(dy) < 10 || Math.abs(dy) < Math.abs(dx) * 1.3) return;
      const expanded = Boolean(ui.calendarExpanded);
      // Вниз в месяце и вверх в неделе — тянуть некуда.
      if ((expanded && dy > 0) || (!expanded && dy < 0)) { start = null; return; }
      drag = begin(null, event.clientY, expanded);
      if (!drag) { start = null; return; }
      window.__calendarDragged = Date.now();
    }
    const span = Math.max(60, drag.g.full - drag.g.one);
    drag.p = Math.max(0, Math.min(1, drag.from + (event.clientY - drag.startY) / span));
    paint(drag.p);
  }, { passive: true });
  document.addEventListener("touchmove", event => { if (drag) event.preventDefault(); }, { passive: false });
  const end = () => {
    start = null;
    if (!drag) return;
    const open = drag.from === 0 ? drag.p > 0.3 : drag.p > 0.7;
    settle(open);
    window.__calendarDragged = Date.now();
    setTimeout(() => { drag = null; }, 0);
  };
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  // После протяжки отпускание пальца не считается нажатием на день.
  document.addEventListener("click", event => {
    if (Date.now() - (window.__calendarDragged || 0) < 450 && event.target.closest?.(".calendar-card")) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
})();
