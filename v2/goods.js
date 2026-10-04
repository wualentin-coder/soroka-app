/*
 * Товары — карточкой как в маркетплейсе: фото, цена крупно, старая цена
 * зачёркнута, скидка плашкой, магазин. Ссылку на карточку товара и магазин
 * можно вписать руками — раньше она терялась при правке.
 */

const rub = value => `${Math.round(Number(value)).toLocaleString("ru-RU")} ₽`;

/** Начальная цена: цена до скидки со страницы, иначе самая высокая, что видели. */
function productOldPrice(item) {
  const price = Number(item.price);
  const old = Number(item.oldPrice) > price ? Number(item.oldPrice) : Number(item.maxPrice) > price * 1.01 ? Number(item.maxPrice) : 0;
  return old;
}
function productDiscount(item) {
  const price = Number(item.price), old = productOldPrice(item);
  return price > 0 && old > price ? Math.round((1 - price / old) * 100) : 0;
}

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
  const off = productDiscount(item);
  if (!Number(item.price)) return `<span class="product-price none">Цена не снята</span>`;
  return `<span class="product-price"><b class="${off ? "sale" : ""}">${rub(item.price)}</b>${off ? `<s>${rub(productOldPrice(item))}</s><em>−${off}%</em>` : ""}</span>`;
}

function productCard(item) {
  const off = productDiscount(item);
  const target = Number(item.targetPrice) > 0 ? `<span class="product-target">${icon("bell", "icon-sm")}жду ${rub(item.targetPrice)}</span>` : "";
  return `<button class="record-card product-card" type="button" data-action="saved-open" data-category="products" data-id="${esc(item.id)}">${productImage(item)}<span class="product-body">${productPrice(item)}<span class="product-title">${esc(item.title)}</span><span class="product-meta">${productStoreName(item) ? `<span>${esc(productStoreName(item))}</span>` : ""}${target}</span></span>${item.viewed ? `<span class="recipe-cooked" title="Куплено">${icon("check", "icon-sm")}</span>` : ""}</button>`;
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
  return `<div class="product-hero">${productImage(item, "hero")}${off ? `<span class="product-off big">−${off}%</span>` : ""}</div><div class="product-price-line">${productPrice(item)}${off ? `<span class="product-save">выгода ${rub(productOldPrice(item) - Number(item.price))}</span>` : ""}</div>${links ? `<div class="product-links">${links}</div>` : `<p class="section-note">Ссылки на товар нет — впишите её в «Изменить», и я буду следить за ценой.</p>`}${rows ? `<div class="saved-detail-table">${rows}</div>` : ""}`;
}
