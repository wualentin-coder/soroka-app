/*
 * Карта в стопке кошелька: смахнуть влево — открыть её правку. Карта едет за
 * пальцем, из-под неё видна подпись «Изменить». Долгое нажатие на месте по-прежнему
 * включает перетаскивание (порядок карт), а короткое — открывает карту.
 */
(function installCardSwipe() {
  let swipe = null, swallow = false;
  document.addEventListener("pointerdown", event => {
    const card = event.target.closest?.(".wallet:not(.is-open) > .wallet-card");
    if (!card || event.button > 0) return;
    swipe = { card, x: event.clientX, y: event.clientY, dx: 0, on: false };
  });
  document.addEventListener("pointermove", event => {
    if (!swipe) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
    if (!swipe.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }
      if (dx > -14 || swipe.card.classList.contains("is-dragging")) return;
      swipe.on = true;
      swipe.card.classList.add("is-swiping");
    }
    swipe.dx = Math.min(0, dx);
    swipe.card.style.transform = `translateX(${swipe.dx}px)`;
    swipe.card.style.setProperty("--swipe", Math.min(1, -swipe.dx / 90).toFixed(2));
  }, { passive: true });
  const end = () => {
    if (!swipe) return;
    const { card, dx, on } = swipe;
    swipe = null;
    if (!on) return;
    swallow = true;
    setTimeout(() => { swallow = false; }, 350);
    card.style.transition = "transform .25s cubic-bezier(.2,.8,.3,1)";
    card.style.transform = "";
    setTimeout(() => { card.style.transition = ""; card.classList.remove("is-swiping"); }, 260);
    if (dx < -80) { try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred("light"); } catch (_) {} openSavedRecord("cards", card.dataset.id, "edit"); }
  };
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  document.addEventListener("click", event => { if (swallow && event.target.closest?.(".wallet")) { swallow = false; event.preventDefault(); event.stopImmediatePropagation(); } }, true);
})();
