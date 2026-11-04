const TODAY_CARDS = [["sport", "Спорт"], ["english", "Английский"]];
const TODAY_CARDS_KEY = "flow.today-cards.v1";
let todayCardsHidden = (() => {
  try { const value = JSON.parse(localStorage.getItem(TODAY_CARDS_KEY)); return TODAY_CARDS.filter(([key]) => value?.[key] === true).map(([key]) => key); }
  catch (_) { return []; }
})();
function todayCardVisible(key) { return !todayCardsHidden.includes(key); }
function setTodayCardVisible(key, visible) {
  if (!TODAY_CARDS.some(([id]) => id === key)) return false;
  const next = visible ? todayCardsHidden.filter(id => id !== key) : [...new Set([...todayCardsHidden, key])];
  try { localStorage.setItem(TODAY_CARDS_KEY, JSON.stringify(Object.fromEntries(next.map(id => [id, true])))); }
  catch (_) { toast("Не получилось сохранить настройку на устройстве"); return false; }
  todayCardsHidden = next;
  return true;
}
function renderTodayCardsSheet() {
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Карточки на сегодня</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><p class="section-note">Показывать на экране «Сегодня» на этом устройстве. Разделы остаются доступны в «Ещё».</p><div class="list-panel">${TODAY_CARDS.map(([key, title]) => `<label class="settings-row"><div><strong>${title}</strong></div><span class="switch"><input type="checkbox" data-today-card="${key}" aria-label="Показывать: ${title}" ${todayCardVisible(key) ? "checked" : ""}><span></span></span></label>`).join("")}</div><div class="sheet-actions"><button class="primary-button" type="button" data-action="close-sheet">Готово</button></div></section></div>`;
}
document.addEventListener("change", event => {
  const key = event.target.dataset?.todayCard;
  if (!key) return;
  if (setTodayCardVisible(key, event.target.checked)) render();
  else event.target.checked = todayCardVisible(key);
});
