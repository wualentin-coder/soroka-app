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

/*
 * Открытая карта: вместо ряда кнопок — свайпы. Вправо — из-под карты слева
 * «Точки» и «Изменить», влево — справа «Удалить». Карта едет за пальцем и
 * защёлкивается; нажатие по карте — вернуть на место.
 */
(function installOpenCardSwipe() {
  const LEFT = 176, RIGHT = -118;
  let drag = null, swallow = false;
  const snapOf = box => parseFloat(getComputedStyle(box).getPropertyValue("--snap")) || 0;
  document.addEventListener("pointerdown", event => {
    const card = event.target.closest?.(".wallet-swipe > .wallet-card-open");
    if (!card || event.button > 0) return;
    const box = card.parentElement;
    drag = { box, card, x: event.clientX, y: event.clientY, base: snapOf(box), dx: 0, on: false };
  });
  document.addEventListener("pointermove", event => {
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      if (Math.abs(dx) < 10) return;
      drag.on = true;
      drag.box.classList.add("is-dragging");
    }
    // За пределами — с сопротивлением, как резинка.
    let x = drag.base + dx;
    if (x > LEFT) x = LEFT + (x - LEFT) * 0.25;
    if (x < RIGHT) x = RIGHT + (x - RIGHT) * 0.25;
    drag.dx = x;
    drag.box.style.setProperty("--snap", `${x}px`);
    drag.box.style.setProperty("--sx", String(x));
  }, { passive: true });
  const end = () => {
    if (!drag) return;
    const { box, on, dx, base } = drag;
    drag = null;
    box.classList.remove("is-dragging");
    let snap;
    if (!on) {
      // Нажатие по сдвинутой карте — вернуть на место (а не свернуть кошелёк).
      if (base === 0) return;
      snap = 0;
    } else snap = dx > 70 ? LEFT : dx < -60 ? RIGHT : 0;
    swallow = true;
    setTimeout(() => { swallow = false; }, 350);
    box.style.setProperty("--snap", `${snap}px`);
    box.style.setProperty("--sx", String(snap));
    ui.walletSnap = snap ? { id: box.dataset.swipeCard, x: snap } : null;
    if (snap !== RIGHT) ui.walletDelete = null;
    try { window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(snap ? "light" : "soft"); } catch (_) {}
  };
  document.addEventListener("pointerup", end);
  document.addEventListener("pointercancel", end);
  document.addEventListener("click", event => {
    if (swallow && event.target.closest?.(".wallet-swipe > .wallet-card-open")) { swallow = false; event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
})();
