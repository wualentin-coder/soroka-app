/*
 * Порядок дел в «Сегодня» — без кнопок: подержать карточку и перетащить.
 * Соседи плавно расступаются; отпустили — порядок дня запомнился (поле order
 * у дел этого дня, синхронизируется с ботом). Смахивание вбок работает как
 * раньше: перетаскивание включается только долгим нажатием на месте.
 */
(function installTaskDrag() {
  let press = null, drag = null, swallow = false;
  const rowOf = target => target.closest?.(".task-stack > .swipe-row:not(.pay-task), .task-stack > .task-card:not(.pay-task)");

  document.addEventListener("pointerdown", event => {
    if (event.button > 0 || ui.page !== "today") return;
    const row = rowOf(event.target);
    if (!row || event.target.closest(".task-sub, .task-check, button.check, [data-action='task-toggle']")) return;
    press = { row, x: event.clientX, y: event.clientY, timer: setTimeout(() => begin(row, event.clientY), 420) };
  });

  function begin(row, y) {
    press = null;
    const stack = row.parentElement;
    const rows = [...stack.children].filter(el => !el.matches(".pay-task") && el.matches(".swipe-row, .task-card"));
    if (rows.length < 2) return;
    drag = { row, stack, rows, y, from: rows.indexOf(row), to: rows.indexOf(row), step: row.getBoundingClientRect().height + parseFloat(getComputedStyle(stack).rowGap || getComputedStyle(stack).gap || 0) || row.offsetHeight + 10 };
    row.classList.add("task-dragging");
    stack.classList.add("is-sorting");
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("medium"); } catch (_) {}
    try { navigator.vibrate?.(12); } catch (_) {}
  }

  document.addEventListener("pointermove", event => {
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) { clearTimeout(press.timer); press = null; }
    if (!drag) return;
    const dy = event.clientY - drag.y;
    drag.row.style.transform = `translateY(${dy}px) scale(1.02)`;
    const to = Math.max(0, Math.min(drag.rows.length - 1, Math.round(drag.from + dy / drag.step)));
    if (to === drag.to) return;
    drag.to = to;
    try { window.Telegram?.WebApp?.HapticFeedback?.selectionChanged(); } catch (_) {}
    drag.rows.forEach((el, j) => {
      if (el === drag.row) return;
      const shift = drag.from < j && j <= to ? -drag.step : to <= j && j < drag.from ? drag.step : 0;
      el.style.transition = "transform .22s cubic-bezier(.2,.8,.3,1)";
      el.style.transform = shift ? `translateY(${shift}px)` : "";
    });
  }, { passive: true });

  document.addEventListener("touchmove", event => { if (drag) event.preventDefault(); }, { passive: false });
  document.addEventListener("contextmenu", event => { if (drag || press) event.preventDefault(); });

  function finish() {
    if (press) { clearTimeout(press.timer); press = null; }
    if (!drag) return;
    const { row, rows, from, to, stack } = drag;
    drag = null;
    swallow = true;
    setTimeout(() => { swallow = false; }, 350);
    rows.forEach(el => { el.style.transition = ""; el.style.transform = ""; });
    row.classList.remove("task-dragging");
    stack.classList.remove("is-sorting");
    if (from === to) return;
    const ids = rows.map(el => el.dataset.swipeId || el.dataset.id || el.querySelector("[data-id]")?.dataset.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    ids.forEach((taskId, i) => { const task = data.tasks.find(t => t.id === taskId); if (task) task.order = i + 1; });
    save();
    render();
  }
  document.addEventListener("pointerup", finish);
  document.addEventListener("pointercancel", finish);
  document.addEventListener("click", event => { if (swallow) { swallow = false; event.preventDefault(); event.stopImmediatePropagation(); } }, true);
})();
