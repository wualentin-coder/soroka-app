/*
 * Анимации — одни на всё приложение, с одной кривой (быстрый старт, долгое
 * мягкое торможение):
 *  • смена раздела — содержимое проявляется и чуть поднимается, по очереди;
 *  • окно — выезжает снизу (на компьютере — всплывает), затемнение проявляется;
 *    закрывается так же плавно, обратным ходом.
 * Только при переходе или открытии, не при каждой перерисовке — иначе всё
 * дрожало бы от любого обновления данных. «Меньше движения» в системе — без них.
 */
(function installMotion() {
  let last = "";
  let sheetSeen = null;
  const calm = () => window.flowDigital?.reducedMotion?.() ?? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const before = render;
  render = function () {
    const result = before.apply(this, arguments);
    if (calm()) return result;
    const where = `${ui.page}|${ui.page === "saved" ? ui.savedCategory : ""}|${ui.page === "finance" ? ui.financeTab || "" : ""}`;
    if (where !== last) {
      const first = !last;
      last = where;
      if (!first && document.documentElement.dataset.flowDesign !== 'magic') {
        document.body.classList.remove("page-anim");
        void document.body.offsetWidth;
        document.body.classList.add("page-anim");
        clearTimeout(installMotion.timer);
        installMotion.timer = setTimeout(() => document.body.classList.remove("page-anim"), 700);
      }
    }
    // Новое окно — с въездом; то же окно после перерисовки — без.
    const currentSheetOwner = ui.sheet ? ['kind','category','id','type','mode'].map(key => String(ui.sheet[key] ?? '')).join('|') : null;
    if (ui.sheet && currentSheetOwner !== sheetSeen) {
      sheetSeen = currentSheetOwner;
      document.querySelectorAll(".modal-backdrop").forEach(node => node.classList.add("sheet-enter"));
    }
    if (!ui.sheet) sheetSeen = null;
    return result;
  };

  // Закрытие — обратным ходом, потом уже убираем.
  const closeBefore = closeSheet;
  closeSheet = function () {
    const backdrop = document.querySelector(".modal-backdrop");
    if (!confirmSheetDiscard(backdrop?.querySelector(".sheet"))) return;
    if (!backdrop || calm() || backdrop.classList.contains("sheet-leave")) return closeBefore.apply(this, arguments);
    backdrop.classList.remove("sheet-enter");
    backdrop.classList.add("sheet-leave");
    const args = arguments, self = this;
    const owner = sheetOwner(backdrop.querySelector(".sheet"));
    setTimeout(() => { if (sheetOwner(activeSheet()) === owner) closeBefore.apply(self, args); }, 200);
  };
})();
