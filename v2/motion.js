/*
 * Анимации: смена раздела — содержимое мягко поднимается по очереди; открытие
 * раздела «Сохранённого» — так же. Только при переходе, не при каждой
 * перерисовке (иначе всё дрожало бы от любого изменения данных). Кто попросил
 * в системе «меньше движения» — без анимаций.
 */
(function installMotion() {
  let last = "";
  const calm = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const before = render;
  render = function () {
    const result = before.apply(this, arguments);
    const where = `${ui.page}|${ui.page === "saved" ? ui.savedCategory : ""}|${ui.page === "finance" ? ui.financeTab || "" : ""}`;
    if (where !== last) {
      const first = !last;
      last = where;
      if (!first && !calm()) {
        document.body.classList.remove("page-anim");
        void document.body.offsetWidth;
        document.body.classList.add("page-anim");
        clearTimeout(installMotion.timer);
        installMotion.timer = setTimeout(() => document.body.classList.remove("page-anim"), 650);
      }
    }
    return result;
  };
})();
