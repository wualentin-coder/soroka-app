/*
 * Товары — карточкой как в маркетплейсе: фото, цена крупно, старая цена
 * зачёркнута, скидка плашкой, магазин. Ссылку на карточку товара и магазин
 * можно вписать руками — раньше она терялась при правке.
 */

function productPriceChecksEnabled() { return window.SOROKA_PRICE_CHECKS_ENABLED === true; }
const rub = value => `${Math.round(Number(value)).toLocaleString("ru-RU")} ₽`;

// Состояние очереди отдельно от пользовательских данных и формы редактирования.
const productChecks = new Map();
function productCheckText(check, item) {
  if (!productPriceChecksEnabled()) return "Проверка цен временно отключена. Показана сохранённая цена.";
  const when = value => { const at = new Date(value); return Number.isFinite(at.getTime()) ? at.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""; };
  if (check?.actionRunning) return "Запускаю проверку…";
  if (check?.connectionError) return "Нет связи со статусом проверки. Показана последняя сохранённая цена.";
  if (check?.checkState === "queued" && check.needsPhoneUpdate) return "Ожидает телефон. Для запуска сразу обновите Flow до 4.13. Пока показана предыдущая цена.";
  if (check?.checkState === "queued") return "Ожидает телефон. Фоновый опрос — раз в 15 минут; Android может задержать запуск. Пока показана предыдущая цена.";
  if (check?.checkState === "running") return "Проверка выполняется: загружается страница магазина. Пока показана предыдущая цена.";
  if (check?.checkState === "failed" || (!check && item.checkFailed)) return "Проверка не удалась. Показана предыдущая цена. Можно попробовать ещё раз.";
  const checkedAt = check?.checkedAt || item.checkedAt;
  if (check?.checkState === "success" || (!check && checkedAt && !item.checkFailed)) return `Цена проверена${checkedAt ? " · " + when(checkedAt) : ""}`;
  return "Цена ещё не проверена.";
}
function productCheckOpen(ref) {
  return !document.hidden && ui.sheet?.category === "products" && ui.sheet.id === ref && ui.sheet.mode !== "edit";
}
function watchProductCheck(ref) {
  if (!productPriceChecksEnabled()) return;
  if (typeof window.sorokaProductStatus !== "function") return;
  const state = productChecks.get(ref) || {};
  if (state.timer || state.polling || state.actionRunning || Date.now() - (state.lastAsked || 0) < 10000) return;
  productChecks.set(ref, state);
  state.timer = setTimeout(async () => {
    state.timer = null;
    if (!productCheckOpen(ref)) return;
    state.polling = true;
    const revision = state.revision || 0;
    state.lastAsked = Date.now();
    try {
      const answer = await window.sorokaProductStatus(ref);
      if ((state.revision || 0) === revision) Object.assign(state, answer, { connectionError: false });
    } catch (_) { if ((state.revision || 0) === revision) state.connectionError = true; }
    finally {
      state.polling = false;
      if (productCheckOpen(ref)) render();
      if ((state.checkState === "queued" || state.checkState === "running" || state.connectionError) && productCheckOpen(ref)) {
        state.timer = setTimeout(() => { state.timer = null; watchProductCheck(ref); }, 10000);
      }
    }
  }, 0);
}

/**
 * Стартовая цена — та, по которой товар продавался, когда его сохранили
 * (первая из истории цен). Зачёркнутая цена магазина сюда не идёт: важно, как
 * цена изменилась для меня, а не «скидка» витрины.
 */
function productStart(item) {
  const price = Number(item.price), start = Number(item.startPrice);
  // Показываем всегда, как на карточке маркетплейса: цена не менялась — «0%».
  return price > 0 && start > 0 ? start : 0;
}
/** Изменение от стартовой цены в процентах: меньше нуля — подешевел, больше — подорожал. */
function productChange(item) {
  const start = productStart(item);
  return start ? Math.round((Number(item.price) - start) / start * 100) : 0;
}
/** Скидка от стартовой цены — для плашки на фото (только если подешевел). */
function productDiscount(item) {
  const change = productChange(item);
  return change < 0 ? -change : 0;
}
const signedPercent = n => n === 0 ? "0%" : `${n < 0 ? "−" : "+"}${Math.abs(n)}%`;

/** Ссылка на магазин: из названия-адреса или из домена ссылки на товар. */
function productStoreUrl(item) {
  if (/^https?:\/\//.test(item.store || "")) return item.store;
  try { if (item.url) return new URL(item.url).origin; } catch (_) {}
  if (/^[\w-]+(\.[\w-]+)+$/.test(item.store || "")) return `https://${item.store}`;
  return "";
}

function productStoreName(item) {
  if (item.store && !/^https?:\/\//.test(item.store)) return item.store;
  try { return new URL(item.url || item.store).hostname.replace(/^www\./, ""); } catch (_) { return ""; }
}

function productImage(item, size = "card") {
  return item.image
    ? `<span class="product-image ${size}"><img src="${esc(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.add('blank');this.remove()"></span>`
    // Без картинки — буква на мягком цвете, как у рецептов: серый блок с кошельком выглядел недоделанным.
    : `<span class="product-image ${size} blank" style="--h:${placeholderHue(item.title)}"><b>${esc(String(item.title || "?").trim().charAt(0).toUpperCase())}</b></span>`;
}

function productPrice(item) {
  if (!Number(item.price)) return `<span class="product-price none">Цена не снята</span>`;
  // Как на Ozon: текущая — акцентом, стартовая — зачёркнута, рядом — насколько изменилась.
  const start = productStart(item), change = productChange(item);
  return `<span class="product-price"><b class="now">${rub(item.price)}</b>${start ? `<s>${rub(start)}</s><em class="${change < 0 ? "down" : change > 0 ? "up" : "same"}">${signedPercent(change)}</em>` : ""}</span>`;
}

function productCard(item) {
  const off = productDiscount(item);
  const target = Number(item.targetPrice) > 0 ? `<span class="product-target">${icon("bell", "icon-sm")}жду ${rub(item.targetPrice)}</span>` : "";
  // Как карточка на маркетплейсе: фото во всю ширину, цена со скидкой одной строкой, название — двумя.
  return `<button class="record-card product-card" type="button" data-action="saved-open" data-category="products" data-id="${esc(item.id)}">${productImage(item)}<span class="product-body">${productPrice(item)}<span class="product-title">${esc(item.title)}</span>${target || productStoreName(item) ? `<span class="product-meta">${productStoreName(item) ? `<span>${esc(productStoreName(item))}</span>` : ""}${target}</span>` : ""}</span>${item.viewed ? `<span class="recipe-cooked" title="Куплено">${icon("check", "icon-sm")}</span>` : ""}</button>`;
}

/** Подробности товара: фото, цена со скидкой, ссылки на карточку и на магазин. */
function productDetails(item) {
  watchProductCheck(item.id);
  const check = productChecks.get(item.id);
  const off = productDiscount(item);
  const store = productStoreUrl(item);
  const links = [
    /^https?:\/\//.test(item.url || "") ? `<a class="primary-button product-open" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${icon("external", "icon-sm")}Карточка товара</a>` : "",
    store ? `<a class="ghost-button product-open" href="${esc(store)}" target="_blank" rel="noopener noreferrer">${icon("external", "icon-sm")}${esc(productStoreName(item) || "Магазин")}</a>` : "",
  ].join("");
  const rows = [
    Number(item.targetPrice) > 0 ? savedDetailLine("Жду цену", rub(item.targetPrice)) : "",
    item.tracked ? savedDetailLine("Проверка цен", productPriceChecksEnabled() ? "раз в сутки" : "Приостановлена") : "",
  ].join("");
  const goal = (data.finance?.goals || []).find(g => g.id === item.goalId);
  const goalBlock = goal ? (() => { const pct = goal.target > 0 ? Math.min(100, Math.round(goal.saved / goal.target * 100)) : 0; return `<div class="product-goal"><div><small>Цель</small><strong>${esc(goal.title)}</strong></div><span>${rub(goal.saved)} из ${rub(goal.target)}</span><div class="progress-track"><span style="width:${pct}%"></span></div></div>`; })() : "";
  const refresh = /^https?:\/\//.test(item.url || "") ? `<button type="button" class="ghost-button product-refresh ${productPriceChecksEnabled() ? '' : 'price-paused'}" data-product-refresh="${esc(item.id)}" ${!productPriceChecksEnabled() || check?.actionRunning ? 'disabled aria-disabled="true"' : ''} title="${productPriceChecksEnabled() ? 'Обновить цену и фото' : 'Проверка цен временно отключена'}">${productPriceChecksEnabled() && check?.actionRunning ? '<span class="live-spin"></span>Смотрю цену…' : icon("reset", "icon-sm") + "Обновить цену и фото"}</button>` : "";
  return `<div class="product-hero">${productImage(item, "hero")}${off ? `<span class="product-off big">−${off}%</span>` : ""}</div><div class="product-price-line">${productPrice(item)}${productStart(item) ? `<span class="product-save ${productChange(item) < 0 ? "" : "up"}">${Number(item.price) < productStart(item) ? `дешевле на ${rub(productStart(item) - Number(item.price))}` : Number(item.price) > productStart(item) ? `дороже на ${rub(Number(item.price) - productStart(item))}` : "цена не менялась"}</span>` : ""}</div>${links ? `<div class="product-links">${links}${refresh}</div>` : `<p class="section-note">Ссылки на товар нет — впишите её в «Изменить», и я буду следить за ценой.</p>`}<p class="section-note" role="status" data-product-check-status="${esc(item.id)}">${esc(productCheckText(check, item))}</p>${goalBlock}${rows ? `<div class="saved-detail-table">${rows}</div>` : ""}`;
}

// Ручное обновление: очередь телефона и результат показаны в самой карточке.
document.addEventListener("click", async event => {
  const button = event.target.closest?.("[data-product-refresh]");
  if (!button) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (!productPriceChecksEnabled()) return;
  if (typeof window.sorokaProductRefresh !== "function") { toast("Работает в приложении бота"); return; }
  const item = savedItem("products", button.dataset.productRefresh);
  if (!item) return;
  const check = productChecks.get(item.id) || {};
  if (check.actionRunning) return;
  clearTimeout(check.timer); check.timer = null;
  check.revision = (check.revision || 0) + 1;
  check.actionRunning = true; check.connectionError = false;
  productChecks.set(item.id, check);
  render();
  try {
    const answer = await window.sorokaProductRefresh(item.id);
    Object.assign(check, answer);
    toast(answer.pending ? "Ожидает телефон — статус есть в карточке" : answer.processing ? "Проверка выполняется" : answer.unavailable ? "Цена не обновилась. Сохранена предыдущая" : answer.price ? `Цена: ${rub(answer.price)}` : "Цену снять не удалось");
  } catch (_) { check.connectionError = true; toast("Не получилось — проверьте связь и попробуйте ещё раз"); }
  finally {
    check.actionRunning = false;
    check.lastAsked = 0;
    if (productCheckOpen(item.id)) render();
    watchProductCheck(item.id);
  }
}, true);
