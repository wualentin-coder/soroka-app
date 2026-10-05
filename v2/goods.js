/*
 * Товары — карточкой как в маркетплейсе: фото, цена крупно, старая цена
 * зачёркнута, скидка плашкой, магазин. Ссылку на карточку товара и магазин
 * можно вписать руками — раньше она терялась при правке.
 */

const rub = value => `${Math.round(Number(value)).toLocaleString("ru-RU")} ₽`;

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
    : `<span class="product-image ${size} blank">${icon("wallet")}</span>`;
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
  const off = productDiscount(item);
  const store = productStoreUrl(item);
  const links = [
    /^https?:\/\//.test(item.url || "") ? `<a class="primary-button product-open" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${icon("external", "icon-sm")}Карточка товара</a>` : "",
    store ? `<a class="ghost-button product-open" href="${esc(store)}" target="_blank" rel="noopener noreferrer">${icon("external", "icon-sm")}${esc(productStoreName(item) || "Магазин")}</a>` : "",
  ].join("");
  const rows = [
    Number(item.targetPrice) > 0 ? savedDetailLine("Жду цену", rub(item.targetPrice)) : "",
    item.tracked ? savedDetailLine("Слежу за ценой", "раз в сутки") : "",
  ].join("");
  const refresh = /^https?:\/\//.test(item.url || "") ? `<button type="button" class="ghost-button product-refresh" data-product-refresh="${esc(item.id)}">${icon("reset", "icon-sm")}Обновить цену и фото</button>` : "";
  return `<div class="product-hero">${productImage(item, "hero")}${off ? `<span class="product-off big">−${off}%</span>` : ""}</div><div class="product-price-line">${productPrice(item)}${productStart(item) ? `<span class="product-save ${productChange(item) < 0 ? "" : "up"}">${Number(item.price) < productStart(item) ? `дешевле на ${rub(productStart(item) - Number(item.price))}` : Number(item.price) > productStart(item) ? `дороже на ${rub(Number(item.price) - productStart(item))}` : "цена не менялась"}</span>` : ""}</div>${links ? `<div class="product-links">${links}${refresh}</div>` : `<p class="section-note">Ссылки на товар нет — впишите её в «Изменить», и я буду следить за ценой.</p>`}${rows ? `<div class="saved-detail-table">${rows}</div>` : ""}`;
}

// «Обновить цену и фото»: сервер снимает их сейчас (магазины с защитой — через поиск).
document.addEventListener("click", async event => {
  const button = event.target.closest?.("[data-product-refresh]");
  if (!button) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (typeof window.sorokaProductRefresh !== "function") { toast("Работает в приложении бота"); return; }
  const item = savedItem("products", button.dataset.productRefresh);
  button.disabled = true;
  button.innerHTML = '<span class="live-spin"></span>Смотрю цену…';
  try {
    const answer = await window.sorokaProductRefresh(item.id);
    if (answer.price) { item.price = answer.price; item.maxPrice = Math.max(Number(item.maxPrice) || 0, answer.price); }
    if (answer.oldPrice !== undefined) item.oldPrice = answer.oldPrice || undefined;
    if (answer.image) item.image = answer.image;
    render();
    toast(answer.price ? `Цена: ${rub(answer.price)}` : "Цену снять не удалось — магазин не отвечает");
  } catch (_) { button.disabled = false; button.textContent = "Обновить цену и фото"; toast("Не получилось — попробуйте ещё раз"); }
}, true);
