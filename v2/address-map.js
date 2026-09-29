/* Интерактивная карта прототипа. Все изменения остаются только в этом браузере. */
let addressMap = null;

function mapCategories() {
  return (data.mapCategories || []).slice().sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}
function mapCategory(id) {
  return mapCategories().find(category => category.id === id);
}
function mapCategoryBadge(id) {
  const category = mapCategory(id);
  return category ? `<span class="map-category-badge" style="--map-color:${esc(category.color)}">${icon(category.icon || "pin", "icon-sm")}${esc(category.name)}</span>` : `<span class="map-category-badge">${icon("pin", "icon-sm")}Без категории</span>`;
}
function mapPointItems() {
  return savedVisibleItems().filter(item => !ui.mapCategory || item.categoryId === ui.mapCategory);
}
function mapPointCoordinates(item) {
  const lat = Number(item?.lat), lng = Number(item?.lng);
  // 0,0 — это пустые поля, а не точка в океане.
  if (lat === 0 && lng === 0) return null;
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && item?.lat != null && item?.lng != null && item?.lat !== "" && item?.lng !== "" ? [lat, lng] : null;
}
function mapExternalUrl(item) {
  const coords = mapPointCoordinates(item);
  const address = streetPart(item.address || "");
  const text = [address || item.title, address && item.city && !address.includes(item.city) ? item.city : ""].filter(Boolean).join(", ");
  return `https://yandex.ru/maps/?${coords ? `ll=${coords[1]},${coords[0]}&z=17&` : ""}text=${encodeURIComponent(text)}`;
}
/** Адрес без квартиры, подъезда и этажа — их на карте нет. */
function streetPart(address) {
  return String(address || "").replace(/,?\s*(кв\.?|квартира|подъезд|под\.|этаж|офис|оф\.)\s*[\wА-Яа-яЁё-]+.*$/i, "").trim();
}
function renderMapPointCard(item) {
  const coords = mapPointCoordinates(item);
  return `<div class="map-point-card"><div class="map-point-card-top">${mapCategoryBadge(item.categoryId)}<span>${esc(item.city || (coords ? "" : "Нет на карте"))}</span></div><h3>${esc(item.title)}</h3>${item.description ? `<p>${esc(item.description)}</p>` : ""}${item.address ? `<small>${esc(item.address)}</small>` : ""}<div class="map-point-actions"><button type="button" data-action="map-open-external" data-id="${esc(item.id)}">${icon("external", "icon-sm")}Открыть в картах</button><button type="button" data-action="map-edit-point" data-id="${esc(item.id)}">Изменить</button><button type="button" data-action="map-share-point" data-id="${esc(item.id)}">Поделиться</button><button class="danger" type="button" data-action="map-delete-point" data-id="${esc(item.id)}">Удалить</button></div></div>`;
}
/*
 * Подложка — OpenFreeMap: бесплатно, без ключа и без лимитов (векторные плитки
 * через MapLibre внутри карты Leaflet). CARTO с 2026 года просит ключ, а
 * серверы OpenStreetMap приложениям нагружать нельзя — они только запасной путь.
 * Библиотека (~0,8 МБ) грузится, только когда открыли карту.
 */
const VECTOR_MAPS = {
  css: "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css",
  js: "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js",
  plugin: "https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js"
};
let vectorMapsReady = null;
function loadVectorMaps() {
  if (vectorMapsReady) return vectorMapsReady;
  const script = src => new Promise((resolve, reject) => { const tag = document.createElement("script"); tag.src = src; tag.onload = resolve; tag.onerror = reject; document.head.appendChild(tag); });
  const css = document.createElement("link"); css.rel = "stylesheet"; css.href = VECTOR_MAPS.css; document.head.appendChild(css);
  vectorMapsReady = script(VECTOR_MAPS.js).then(() => script(VECTOR_MAPS.plugin));
  vectorMapsReady.catch(() => { vectorMapsReady = null; });
  return vectorMapsReady;
}
function addBaseLayer(map, alive = () => map === addressMap) {
  const light = document.documentElement.dataset.theme === "light";
  const attribution = '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';
  const raster = () => L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution }).addTo(map);
  loadVectorMaps()
    .then(() => mapStyle(light))
    .then(style => { if (alive() && L.maplibreGL) L.maplibreGL({ style, attribution, interactive: false }).addTo(map); else if (alive()) raster(); })
    .catch(() => { if (alive()) raster(); });
}
/**
 * Стиль карты: светлая — liberty (организации со значками), тёмная — dark.
 * В обоих стилях OpenFreeMap нет номеров домов, хотя в данных они есть, —
 * добавляем слой; подписи — по-русски, а не «латиница + кириллица».
 */
const mapStyles = {};
function mapStyle(light) {
  const key = light ? "liberty" : "dark";
  mapStyles[key] ||= fetch(`https://tiles.openfreemap.org/styles/${key}`).then(r => r.json()).then(style => {
    for (const layer of style.layers) {
      const field = layer.layout?.["text-field"];
      if (field && JSON.stringify(field).includes("name")) layer.layout["text-field"] = ["coalesce", ["get", "name:ru"], ["get", "name"]];
    }
    const ink = light ? { "text-color": "#5d6670", "text-halo-color": "#ffffff", "text-halo-width": 1.2 } : { "text-color": "#b7c3cc", "text-halo-color": "#151d24", "text-halo-width": 1.2 };
    style.layers.push({ id: "soroka-housenumber", type: "symbol", source: "openmaptiles", "source-layer": "housenumber", minzoom: 16, layout: { "text-field": ["get", "housenumber"], "text-font": ["Noto Sans Regular"], "text-size": 11 }, paint: ink });
    if (!light) style.layers.push({ id: "soroka-poi", type: "symbol", source: "openmaptiles", "source-layer": "poi", minzoom: 16, filter: ["has", "name"], layout: { "text-field": ["coalesce", ["get", "name:ru"], ["get", "name"]], "text-font": ["Noto Sans Regular"], "text-size": 11, "text-max-width": 9, "text-anchor": "top" }, paint: ink });
    return style;
  }).catch(error => { delete mapStyles[key]; throw error; });
  return mapStyles[key];
}
/*
 * Адрес ↔ точка на карте: геокодер OpenStreetMap (Nominatim), бесплатно и без
 * ключа. Поставил метку — подставятся улица, дом и город; вписал улицу и дом —
 * «Найти» поставит метку.
 */
async function nominatim(path) {
  const answer = await fetch(`https://nominatim.openstreetmap.org/${path}&format=jsonv2&addressdetails=1&accept-language=ru`, { headers: { accept: "application/json" } });
  if (!answer.ok) throw new Error("geocoder");
  return answer.json();
}
function addressParts(a = {}) {
  const street = [a.road || a.pedestrian || a.footway || a.square || a.neighbourhood, a.house_number].filter(Boolean).join(", ");
  return { street, city: a.city || a.town || a.village || a.municipality || "" };
}
async function reverseGeocode(lat, lng) {
  const found = await nominatim(`reverse?lat=${lat}&lon=${lng}&zoom=18`).catch(() => null);
  return found?.address ? addressParts(found.address) : null;
}
async function forwardGeocode(query) {
  const [found] = await nominatim(`search?limit=1&q=${encodeURIComponent(query)}`).catch(() => []);
  return found ? { lat: Number(found.lat), lng: Number(found.lon), ...addressParts(found.address) } : null;
}
function setFormValue(form, name, value) { const input = form?.elements?.[name]; if (input && value !== undefined && value !== null && value !== "") input.value = value; }
/**
 * Подсказки адреса: дома и организации. В прототипе — Nominatim из браузера;
 * рабочее приложение подменяет на сервер бота (там Photon, он надёжнее).
 */
async function suggestAddresses(query, city) {
  const found = await nominatim(`search?limit=6&q=${encodeURIComponent([streetPart(query), city].filter(Boolean).join(", "))}`).catch(() => []);
  return (found || []).map(hit => { const parts = addressParts(hit.address); return { label: [hit.name && hit.name !== parts.street ? hit.name : "", parts.street, parts.city].filter(Boolean).join(" · "), name: hit.name || "", street: hit.address?.road || "", house: hit.address?.house_number || "", city: parts.city, lat: Number(hit.lat), lng: Number(hit.lon) }; });
}
let addressHits = [];
let addressHitsFor = "";
let addressTimer = null;
let addressAsked = 0;
async function findAddress(form, now = false) {
  const state = form?.querySelector(".address-find-state");
  const list = form?.querySelector(".address-suggest");
  const query = String(form?.elements.address?.value || "").trim();
  if (streetPart(query).length < 3) { if (list) { list.hidden = true; list.innerHTML = ""; } if (now && state) state.textContent = "Впишите улицу и дом"; return; }
  const asked = ++addressAsked;
  if (state) state.textContent = "Ищу…";
  const hits = await suggestAddresses(query, "").catch(() => []);
  if (asked !== addressAsked || !document.body.contains(form)) return;
  addressHits = hits;
  addressHitsFor = query;
  if (!hits.length) { list.hidden = true; list.innerHTML = ""; if (state) state.textContent = "Не нашёл — проверьте название улицы или поставьте метку на карте"; return; }
  list.innerHTML = hits.map((hit, i) => `<button type="button" class="address-suggest-row" data-address-hit="${i}">${icon(hit.name ? "bookmark" : "pin", "icon-sm")}<span><strong>${esc(hit.name || [hit.street, hit.house].filter(Boolean).join(", ") || hit.label)}</strong><small>${esc(hit.name ? [[hit.street, hit.house].filter(Boolean).join(", "), hit.city].filter(Boolean).join(" · ") : hit.city)}</small></span></button>`).join("");
  list.hidden = false;
  if (state) state.textContent = "Выберите адрес из списка";
}
/** Квартира из того, что человек напечатал: «кв. 107», «квартира 107» или второе число после дома. */
function typedFlat(typed) {
  const text = String(typed || "");
  const named = text.match(/(?:кв\.?|квартира)\s*(\d+[а-яА-Я]?)/i);
  if (named) return named[1];
  const numbers = text.match(/\d+[а-яА-Я]?(?:\s*к\s*\d+)?/g) || [];
  return numbers.length >= 2 ? numbers[1] : "";
}
function pickAddress(form, hit) {
  const typed = String(form.elements.address.value || "");
  const flat = hit.flat || typedFlat(typed);
  const line = [hit.street, hit.house].filter(Boolean).join(", ") || hit.name || hit.label;
  form.elements.address.value = [line, flat ? `кв. ${flat}` : ""].filter(Boolean).join(", ");
  if (form.elements.city) form.elements.city.value = hit.city || "";
  setFormValue(form, "lat", hit.lat.toFixed(6));
  setFormValue(form, "lng", hit.lng.toFixed(6));
  if (form.elements.title && !form.elements.title.value && hit.name) form.elements.title.value = hit.name;
  const list = form.querySelector(".address-suggest");
  if (list) { list.hidden = true; list.innerHTML = ""; }
  const state = form.querySelector(".address-find-state");
  if (state) state.textContent = `✓ На карте: ${[hit.name, line, hit.city].filter(Boolean).filter((x, i, all) => all.indexOf(x) === i).join(", ")}`;
}
document.addEventListener("click", event => {
  const button = event.target.closest?.('[data-action="address-geocode"]');
  const hit = event.target.closest?.("[data-address-hit]");
  if (!button && !hit) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const form = (button || hit).closest("form");
  if (hit) pickAddress(form, addressHits[Number(hit.dataset.addressHit)]);
  else void findAddress(form, true);
}, true);
// Печатает адрес — подсказки через паузу; прежняя точка уже не про этот адрес.
document.addEventListener("input", event => {
  const input = event.target;
  if (!input?.form || input.name !== "address" || !input.form.querySelector(".address-suggest")) return;
  const form = input.form;
  if (form.elements.lat) form.elements.lat.value = "";
  if (form.elements.lng) form.elements.lng.value = "";
  clearTimeout(addressTimer);
  addressTimer = setTimeout(() => void findAddress(form), 650);
}, true);
function renderAddressWorkspace() {
  const categories = mapCategories();
  const items = mapPointItems();
  const mapped = items.filter(item => mapPointCoordinates(item));
  const selected = items.find(item => item.id === ui.mapSelectedId);
  const categoryChips = `<div class="map-categories" aria-label="Категории адресов"><button class="map-category-chip ${!ui.mapCategory ? "active" : ""}" type="button" data-action="map-filter" data-category="" aria-pressed="${!ui.mapCategory}">Все <span>${savedItems("addresses").length}</span></button>${categories.filter(category => ui.mapCategory === category.id || savedItems("addresses").some(item => item.categoryId === category.id)).map(category => `<button class="map-category-chip ${ui.mapCategory === category.id ? "active" : ""}" type="button" data-action="map-filter" data-category="${esc(category.id)}" aria-pressed="${ui.mapCategory === category.id}" style="--map-color:${esc(category.color)}">${icon(category.icon || "pin", "icon-sm")}${esc(category.name)}<span>${savedItems("addresses").filter(item => item.categoryId === category.id).length}</span></button>`).join("")}<button class="map-manage-chip" type="button" data-action="map-manage-categories">${icon("settings", "icon-sm")}Разделы</button></div>`;
  const switcher = `<div class="map-view-switch" role="group" aria-label="Вид адресов"><button type="button" class="${ui.addressView === "list" ? "active" : ""}" data-action="map-view" data-view="list" aria-pressed="${ui.addressView === "list"}">${icon("note", "icon-sm")}Список</button><button type="button" class="${ui.addressView === "map" ? "active" : ""}" data-action="map-view" data-view="map" aria-pressed="${ui.addressView === "map"}">${icon("pin", "icon-sm")}Карта</button></div>`;
  const map = `<div class="map-frame ${ui.mapPlacing ? "is-placing" : ""}"><div id="address-map" class="address-map" role="application" aria-label="Карта сохранённых адресов"></div><button class="map-locate" type="button" data-action="map-locate" aria-label="Где я">${icon("locate")}</button><div class="map-empty-fallback" id="map-fallback" hidden>Карта не загрузилась. Адреса доступны в списке.</div>${ui.mapPlacing ? `<div class="map-place-hint">Нажмите на карте, чтобы поставить метку <button type="button" data-action="map-cancel-place">Отмена</button></div>` : ""}</div>${mapped.length ? `<div class="map-point-strip" aria-label="Метки на карте">${mapped.map(item => `<button type="button" class="${ui.mapSelectedId === item.id ? "active" : ""}" data-action="map-select-point" data-id="${esc(item.id)}" style="--map-color:${esc(mapCategory(item.categoryId)?.color || "#78beb8")}"><span></span>${esc(item.title)}</button>`).join("")}</div>` : ""}${selected ? renderMapPointCard(selected) : `<p class="map-caption">Нажмите на метку или выберите место под картой.</p>`}${items.length > mapped.length ? `<p class="section-note">${items.length - mapped.length} адресов пока без метки на карте. Координаты можно добавить при редактировании.</p>` : ""}`;
  const list = `<div class="section-toolbar"><input id="saved-filter-input" class="filter-input" type="search" placeholder="Искать адрес…" value="${esc(ui.savedQuery)}" aria-label="Искать адрес"><span class="section-note">${items.length} ${word(items.length, "точка", "точки", "точек")}</span></div><div id="saved-results" class="saved-results">${items.length ? `<div class="record-list">${items.map(item => savedRecordCard(item, "addresses")).join("")}</div>` : emptyCard("Адресов нет", "Добавьте точку на карте или измените фильтр.")}</div>`;
  return `<div class="address-workspace">${categoryChips}<div class="map-toolbar">${switcher}<button class="map-place-button ${ui.mapPlacing ? "active" : ""}" type="button" data-action="map-place">${icon("pin", "icon-sm")}${ui.mapPlacing ? "Выберите место" : "Поставить метку"}</button></div>${ui.addressView === "map" ? map : list}<div class="map-source-note"><strong>Как адрес появится в приложении</strong><span>Геолокация, координаты или ссылка на Google Maps, Яндекс Карты и 2ГИС из Telegram.</span></div></div>`;
}
function renderMapCategoriesSheet() {
  const editing = mapCategory(ui.sheet.editCategoryId);
  const options = [["event", "Дом"], ["project", "Работа"], ["bookmark", "Место"], ["arrow", "Поездка"], ["wallet", "Покупки"], ["pin", "Метка"]];
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet map-categories-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Разделы адресов</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div><p class="section-note">Создавайте свои категории и назначайте им цвет и значок.</p><div class="map-category-list">${mapCategories().map(category => { const count = savedItems("addresses").filter(item => item.categoryId === category.id).length; return `<div class="map-category-row"><span class="map-category-symbol" style="--map-color:${esc(category.color)}">${icon(category.icon || "pin")}</span><span><strong>${esc(category.name)}</strong><small>${count} ${word(count, "место", "места", "мест")}</small></span><button type="button" data-action="map-category-edit" data-id="${esc(category.id)}" aria-label="Изменить ${esc(category.name)}">${icon("note", "icon-sm")}</button><button type="button" data-action="map-category-delete" data-id="${esc(category.id)}" aria-label="Удалить ${esc(category.name)}">${icon("trash", "icon-sm")}</button></div>`; }).join("")}</div><form id="map-category-form"><h3>${editing ? "Изменить раздел" : "Новый раздел"}</h3>${savedFormField("Название", "name", editing?.name || "", "text", 'maxlength="40" required autofocus')}<div class="field-row"><label class="field">Значок<select name="icon">${options.map(([value, label]) => `<option value="${value}" ${editing?.icon === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label class="field">Цвет<input name="color" type="color" value="${esc(editing?.color || "#8dbbb4")}"></label></div><div class="sheet-actions">${editing ? `<button class="ghost-button" type="button" data-action="map-category-cancel">Отмена</button>` : ""}<button class="primary-button" type="submit">${editing ? "Сохранить" : "Создать раздел"}</button></div></form></section></div>`;
}
function disposeAddressMap() {
  if (miniMap) { miniMap.remove(); miniMap = null; }
  if (!addressMap) return;
  const center = addressMap.getCenter();
  ui.mapCenter = [center.lat, center.lng];
  ui.mapZoom = addressMap.getZoom();
  addressMap.remove();
  addressMap = null;
}
/** Где открыть карту: у последней поставленной метки, а не в Москве. */
function mapDefaultCenter() {
  const last = savedItems("addresses").filter(item => mapPointCoordinates(item)).sort((a, b) => String(b.created || "").localeCompare(String(a.created || "")))[0];
  return last ? mapPointCoordinates(last) : [55.747, 37.621];
}
let miniMap = null;
/** Карта в карточке адреса: одна метка, без жестов — нажатие ведёт в «Открыть в картах». */
function mountMiniMap() {
  const host = document.getElementById("address-mini-map");
  if (!host || !window.L) return;
  // Карточка адреса — по записи; билет передаёт точку места проведения сам.
  const item = host.dataset.id ? savedItem("addresses", host.dataset.id) : { lat: host.dataset.lat, lng: host.dataset.lng };
  const coordinates = mapPointCoordinates(item);
  if (!coordinates) return;
  const map = L.map(host, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, touchZoom: false, attributionControl: false }).setView(coordinates, 17);
  miniMap = map;
  addBaseLayer(map, () => map === miniMap);
  const category = mapCategory(item.categoryId);
  L.marker(coordinates, { icon: L.divIcon({ className: "map-marker-shell", html: `<span class="map-marker selected" style="--map-color:${esc(category?.color || "#78beb8")}">${icon(category?.icon || "pin", "icon-sm")}</span>`, iconSize: [38, 46], iconAnchor: [19, 43] }) }).addTo(map);
}
/*
 * Где я: точка и круг погрешности на карте. Сначала — геопозиция Telegram
 * (она спрашивает разрешение один раз и помнит его), иначе — браузерная.
 * Прошлая позиция рисуется сразу, чтобы карта не была пустой, пока ищем новую.
 */
const MY_POSITION_KEY = "soroka-my-position";
let myMarker = null, myCircle = null, myWatch = 0;
function cachedPosition() {
  try { const p = JSON.parse(localStorage.getItem(MY_POSITION_KEY) || "null"); return p && Number.isFinite(p.lat) && Number.isFinite(p.lng) ? p : null; } catch (_) { return null; }
}
/** Позиция: { lat, lng, acc } или null (не разрешили, нет сигнала). */
function requestPosition() {
  return new Promise(resolve => {
    let done = false;
    const finish = value => { if (!done) { done = true; resolve(value); } };
    setTimeout(() => finish(null), 12000);
    const browser = () => {
      if (!navigator.geolocation) return finish(null);
      navigator.geolocation.getCurrentPosition(p => finish({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }), () => finish(null), { enableHighAccuracy: true, timeout: 9000, maximumAge: 60000 });
    };
    const tg = window.Telegram?.WebApp;
    const lm = tg?.LocationManager;
    if (!lm || (tg.isVersionAtLeast && !tg.isVersionAtLeast("8.0"))) return browser();
    const ask = () => {
      if (!lm.isLocationAvailable) return browser();
      lm.getLocation(l => {
        if (l) return finish({ lat: l.latitude, lng: l.longitude, acc: l.horizontal_accuracy || 60 });
        // Отказали в Telegram — браузер тоже не поможет; пусть человек включит в настройках.
        if (lm.isAccessRequested && !lm.isAccessGranted) return finish(null);
        browser();
      });
    };
    try { lm.isInited ? ask() : lm.init(ask); } catch (_) { browser(); }
  });
}
function drawMyPosition(pos) {
  if (!addressMap || !pos) return;
  const at = [pos.lat, pos.lng];
  const radius = Math.min(Math.max(Number(pos.acc) || 60, 20), 400);
  if (myMarker) { myMarker.remove(); myMarker = null; }
  if (myCircle) { myCircle.remove(); myCircle = null; }
  myCircle = L.circle(at, { radius, color: "#2f80ed", weight: 1, opacity: .5, fillColor: "#2f80ed", fillOpacity: .13, interactive: false }).addTo(addressMap);
  myMarker = L.marker(at, { icon: L.divIcon({ className: "me-shell", html: '<span class="me-dot"><i></i></span>', iconSize: [24, 24], iconAnchor: [12, 12] }), interactive: false, keyboard: false, zIndexOffset: 900 }).addTo(addressMap);
}
async function showMyPosition(centre) {
  const map = addressMap;
  const old = cachedPosition();
  if (old) drawMyPosition(old);
  const pos = await requestPosition();
  if (!pos) {
    if (centre) {
      const lm = window.Telegram?.WebApp?.LocationManager;
      if (lm && lm.isAccessRequested && !lm.isAccessGranted && lm.openSettings) { toast("Разрешите доступ к геопозиции в настройках"); lm.openSettings(); }
      else toast("Не получилось определить, где вы");
    }
    return;
  }
  try { localStorage.setItem(MY_POSITION_KEY, JSON.stringify({ lat: pos.lat, lng: pos.lng, acc: pos.acc })); } catch (_) {}
  if (map !== addressMap) return;
  drawMyPosition(pos);
  if (centre) addressMap.flyTo([pos.lat, pos.lng], Math.max(addressMap.getZoom(), 15), { duration: .9 });
}

function mountAddressMap() {
  mountMiniMap();
  const host = document.getElementById("address-map");
  if (!host) return;
  if (!window.L) { document.getElementById("map-fallback").hidden = false; return; }
  const items = mapPointItems().filter(item => mapPointCoordinates(item));
  const center = ui.mapCenter || mapDefaultCenter();
  addressMap = L.map(host, { zoomControl: false }).setView(center, ui.mapZoom || 12);
  L.control.zoom({ position: "topright" }).addTo(addressMap);
  addBaseLayer(addressMap);
  myMarker = null; myCircle = null;
  void showMyPosition(false);
  items.forEach(item => {
    const category = mapCategory(item.categoryId);
    const markerIcon = L.divIcon({ className: "map-marker-shell", html: `<span class="map-marker ${item.id === ui.mapSelectedId ? "selected" : ""}" style="--map-color:${esc(category?.color || "#78beb8")}">${icon(category?.icon || "pin", "icon-sm")}</span>`, iconSize: [38, 46], iconAnchor: [19, 43] });
    L.marker(mapPointCoordinates(item), { icon: markerIcon, title: item.title }).addTo(addressMap).on("click", () => selectMapPoint(item.id));
  });
  addressMap.on("click", event => {
    if (!ui.mapPlacing) return;
    const { lat, lng } = event.latlng;
    addressMap.setView([lat, lng], addressMap.getZoom(), { animate: false });
    ui.mapPlacing = false;
    ui.sheet = { kind: "saved", category: "addresses", id: null, mode: "edit", draft: { lat: lat.toFixed(6), lng: lng.toFixed(6), categoryId: ui.mapCategory || "" }, justRendered: false };
    render();
    void reverseGeocode(lat, lng).then(found => {
      const form = document.getElementById("saved-form");
      if (!found || !form) return;
      if (!form.elements.address?.value) setFormValue(form, "address", found.street);
      if (!form.elements.city?.value) setFormValue(form, "city", found.city);
      if (!form.elements.title?.value && found.street) setFormValue(form, "title", found.street);
      const state = form.querySelector(".address-find-state");
      if (state) state.textContent = "Адрес подставлен по метке — поправьте, если нужно";
    });
  });
}
function selectMapPoint(recordId) {
  const item = savedItem("addresses", recordId);
  if (!item) return;
  const coordinates = mapPointCoordinates(item);
  if (coordinates && addressMap) addressMap.setView(coordinates, Math.max(addressMap.getZoom(), 13), { animate: false });
  else if (coordinates) { ui.mapCenter = coordinates; ui.mapZoom = Math.max(ui.mapZoom || 12, 13); }
  ui.mapSelectedId = item.id;
  render();
  requestAnimationFrame(() => document.querySelector(".map-point-card")?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
}
function mapAction(action, control) {
  if (action === "map-locate") { if (addressMap) { control.classList.add("busy"); showMyPosition(true).finally(() => control.classList.remove("busy")); } return true; }
  if (action === "map-view") { ui.addressView = control.dataset.view; ui.mapPlacing = false; render(); return true; }
  if (action === "map-filter") { ui.mapCategory = control.dataset.category || ""; ui.mapSelectedId = null; render(); return true; }
  if (action === "map-place") { ui.addressView = "map"; ui.mapPlacing = !ui.mapPlacing; ui.mapSelectedId = null; render(); return true; }
  if (action === "map-cancel-place") { ui.mapPlacing = false; render(); return true; }
  if (action === "map-select-point") { selectMapPoint(control.dataset.id); return true; }
  if (action === "map-manage-categories") { ui.sheet = { kind: "map-categories", editCategoryId: null, justRendered: false }; render(); return true; }
  if (action === "map-category-edit" && ui.sheet?.kind === "map-categories") { ui.sheet.editCategoryId = control.dataset.id; ui.sheet.justRendered = false; render(); return true; }
  if (action === "map-category-cancel" && ui.sheet?.kind === "map-categories") { ui.sheet.editCategoryId = null; ui.sheet.justRendered = false; render(); return true; }
  if (action === "map-category-delete" && ui.sheet?.kind === "map-categories") {
    const categoryId = control.dataset.id;
    data.mapCategories = data.mapCategories.filter(category => category.id !== categoryId);
    savedItems("addresses").forEach(item => { if (item.categoryId === categoryId) item.categoryId = ""; });
    if (ui.mapCategory === categoryId) ui.mapCategory = "";
    ui.sheet.editCategoryId = null;
    save(); render(); toast("Раздел удалён. Адреса остались без категории."); return true;
  }
  if (["map-open-external", "map-edit-point", "map-share-point", "map-delete-point"].includes(action)) {
    const item = savedItem("addresses", control.dataset.id);
    if (!item) return true;
    if (action === "map-open-external") window.open(mapExternalUrl(item), "_blank", "noopener,noreferrer");
    if (action === "map-edit-point") openSavedRecord("addresses", item.id, "edit");
    if (action === "map-share-point") void shareRecord("saved:addresses", item.id);
    if (action === "map-delete-point") { deleteSavedRecord("addresses", item.id); ui.mapSelectedId = null; render(); }
    return true;
  }
  return false;
}
function mapSubmit(event) {
  if (event.target.id !== "map-category-form" || ui.sheet?.kind !== "map-categories") return false;
  event.preventDefault();
  const form = new FormData(event.target);
  const name = String(form.get("name") || "").trim();
  if (!name) return true;
  const current = mapCategory(ui.sheet.editCategoryId);
  const category = current || { id: id(), sortOrder: data.mapCategories.length };
  category.name = name;
  category.icon = String(form.get("icon") || "pin");
  category.color = String(form.get("color") || "#8dbbb4");
  if (!current) data.mapCategories.push(category);
  save(); ui.sheet.editCategoryId = null; render(); toast(current ? "Раздел изменён" : "Раздел создан");
  return true;
}
