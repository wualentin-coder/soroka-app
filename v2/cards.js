/*
 * Скидочные карты.
 *
 * Карта — номер и вид кода (штрихкод EAN-13 / Code128 или QR), оформление сети
 * или свой цвет и точки на карте, где она действует. Когда приложение открыто и
 * вы стоите в одной из точек, карта выезжает краем над нижним баром — как в
 * Wallet на iPhone; нажатие раскрывает код на весь экран.
 *
 * Точность важнее охвата: карта всплывает, только если телефон уверен в своём
 * месте лучше, чем радиус точки, и совпадение повторилось два раза подряд.
 */

const LOYALTY_BRANDS = {
  magnit: { name: "Магнит", program: "Карта «Магнит»" },
  pyaterochka: { name: "Пятёрочка", program: "Выручай-карта" },
  perekrestok: { name: "Перекрёсток", program: "Клуб Перекрёсток" },
  custom: { name: "", program: "Скидочная карта" },
};
const LOYALTY_COLORS = ["#2f6fdb", "#7b4bd6", "#d6406a", "#e08a1e", "#1f9d8a", "#3b4452"];

function loyaltyBrand(item) { return LOYALTY_BRANDS[item?.brand] ? item.brand : "custom"; }
function loyaltyNumber(number) { return String(number || "").replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 "); }

/** Лицо карты: цвета и надпись сети (своя — для остальных). */
function loyaltyFace(item, size = "") {
  const brand = loyaltyBrand(item);
  const info = LOYALTY_BRANDS[brand];
  const name = brand === "custom" ? item.title || "Карта" : info.name;
  const tail = String(item.number || "").replace(/\s+/g, "").slice(-4);
  const color = brand === "custom" ? (/^#[0-9a-f]{6}$/i.test(item.color || "") ? item.color : LOYALTY_COLORS[0]) : "";
  const mark = {
    magnit: `<span class="lw lw-magnit"><i></i>магнит</span>`,
    pyaterochka: `<span class="lw lw-pyat"><b>5</b>Пятёрочка</span>`,
    perekrestok: `<span class="lw lw-perek"><i></i>ПЕРЕКРЁСТОК</span>`,
    custom: `<span class="lw lw-custom">${esc(name)}</span>`,
  }[brand];
  return `<div class="loyalty-card brand-${brand} ${size}" ${color ? `style="--card-color:${esc(color)}"` : ""}>${mark}<span class="loyalty-program">${esc(brand === "custom" ? info.program : item.title && item.title !== info.name ? item.title : info.program)}</span>${tail ? `<span class="loyalty-tail">•••• ${esc(tail)}</span>` : ""}${(item.places || []).length ? `<span class="loyalty-geo" title="Всплывает рядом">${icon("pin", "icon-sm")}${item.places.length}</span>` : ""}</div>`;
}

function loyaltyCode(item, big = false) {
  if (item.svg) return `<div class="loyalty-code ${big ? "big" : ""} ${item.format === "QRCode" ? "qr" : "bar"}">${item.svg}<span>${esc(loyaltyNumber(item.number))}</span></div>`;
  if (!item.number) return `<div class="loyalty-code empty"><span>Номер карты не указан</span></div>`;
  return `<div class="loyalty-code empty"><span>${esc(loyaltyNumber(item.number))}</span><small>Код нарисуется после сохранения</small></div>`;
}

// ------------------------------------------------------------ окно карты

function renderLoyaltySheet() {
  const sheet = ui.sheet;
  const item = sheet.id ? savedItem("cards", sheet.id) : null;
  if (sheet.mode === "edit" || !item) return renderLoyaltyForm(item);
  const places = item.places || [];
  const where = places.length
    ? `<ul class="loyalty-places">${places.map((p, i) => `<li>${icon("pin", "icon-sm")}<span>${esc(p.label || `Точка ${i + 1}`)}</span><small>${Math.round(p.radius || 40)} м</small></li>`).join("")}</ul>`
    : `<p class="section-note">Отметьте магазины, где действует карта, — рядом с ними она будет выезжать сама.</p>`;
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet saved-view-sheet loyalty-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${esc(item.title)}</h2><button class="icon-button sheet-pin-toggle ${item.pinned ? "is-pinned" : ""}" type="button" data-action="saved-pin" aria-pressed="${Boolean(item.pinned)}" aria-label="${item.pinned ? "Открепить" : "Закрепить"}">${icon("bookmark", "icon-sm")}</button><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div>
    ${loyaltyFace(item, "large")}
    <button type="button" class="loyalty-code-button" data-action="loyalty-full" data-id="${esc(item.id)}" aria-label="Код на весь экран">${loyaltyCode(item)}</button>
    <section class="loyalty-where"><div class="loyalty-where-head"><h3>Где всплывает</h3><button type="button" class="small-button" data-action="loyalty-places" data-id="${esc(item.id)}">${icon("pin", "icon-sm")}${places.length ? "Изменить точки" : "Отметить на карте"}</button></div>${where}</section>
    ${item.description ? `<p class="saved-prose">${esc(item.description)}</p>` : ""}
    <div class="inline-actions saved-view-actions"><button class="primary-button" type="button" data-action="saved-edit">${icon("note")}Изменить</button><button type="button" class="danger" data-action="saved-delete">${icon("trash")}Удалить</button></div></section></div>`;
}

function renderLoyaltyForm(item) {
  const v = { brand: "magnit", format: "EAN13", ...(item || {}), ...(ui.sheet.draftCard || {}) };
  const brand = loyaltyBrand(v);
  const brands = Object.entries(LOYALTY_BRANDS).map(([key, b]) => `<button type="button" class="loyalty-pick ${brand === key ? "on" : ""}" data-action="loyalty-brand" data-brand="${key}">${loyaltyFace({ ...v, brand: key, title: key === "custom" ? (v.brand === "custom" ? v.title : "") || "Своя" : "", number: "", places: [] }, "mini")}<span>${key === "custom" ? "Другая" : esc(b.name)}</span></button>`).join("");
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet loyalty-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${item ? "Изменить карту" : "Новая карта"}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div>
    <form id="loyalty-form"><div class="loyalty-picks">${brands}</div><input type="hidden" name="brand" value="${esc(brand)}">
    <label class="field">Название<input name="title" type="text" maxlength="80" value="${esc(v.title || (brand === "custom" ? "" : LOYALTY_BRANDS[brand].name))}" placeholder="Например, Лента" required></label>
    <label class="field">Номер карты<input name="number" type="text" inputmode="numeric" autocomplete="off" maxlength="64" value="${esc(v.number || "")}" placeholder="Цифры под штрихкодом"></label>
    <label class="field">Вид кода<select name="format">${[["EAN13", "Штрихкод EAN-13 (13 цифр)"], ["Code128", "Штрихкод Code 128"], ["QRCode", "QR-код"]].map(([key, label]) => `<option value="${key}" ${v.format === key ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    ${brand === "custom" ? `<div class="field"><span>Цвет</span><div class="loyalty-colors">${LOYALTY_COLORS.map(c => `<label style="--c:${c}"><input type="radio" name="color" value="${c}" ${(v.color || LOYALTY_COLORS[0]) === c ? "checked" : ""}><i></i></label>`).join("")}</div></div>` : ""}
    <label class="field">Заметка<textarea name="description" rows="2" placeholder="Необязательно">${esc(v.description || "")}</textarea></label>
    <div class="sheet-actions">${item ? `<button type="button" class="ghost-button" data-action="loyalty-cancel">Отмена</button>` : ""}<button class="primary-button" type="submit">${item ? "Сохранить" : "Добавить карту"}</button></div></form></section></div>`;
}

function loyaltySubmit(event) {
  if (event.target.id !== "loyalty-form") return false;
  event.preventDefault();
  const form = new FormData(event.target);
  const existing = ui.sheet.id ? savedItem("cards", ui.sheet.id) : null;
  const item = existing || { id: id(), places: [], pinned: false, created: new Date().toISOString(), tags: [], topic: "" };
  item.brand = String(form.get("brand") || "custom");
  item.title = String(form.get("title") || "").trim() || LOYALTY_BRANDS[item.brand]?.name || "Карта";
  const number = String(form.get("number") || "").replace(/\s+/g, "");
  // Номер поменялся — старую картинку кода не показываем, новую пришлёт сервер.
  if (number !== item.number || String(form.get("format")) !== item.format) item.svg = "";
  item.number = number;
  item.format = String(form.get("format") || "EAN13");
  item.color = String(form.get("color") || "");
  item.description = String(form.get("description") || "").trim();
  if (!existing) { data.saved.cards = data.saved.cards || []; data.saved.cards.push(item); }
  // Из формы — обратно в кошелёк, карта раскрыта.
  ui.sheet = null; ui.walletOpen = item.id; ui.savedCategory = "cards";
  save(); render();
  toast(existing ? "Карта сохранена" : "Карта добавлена");
  return true;
}

// ------------------------------------------------------------ точки на карте

let loyaltyMap = null, loyaltyLayer = null;
function renderLoyaltyPlacesSheet() {
  const item = savedItem("cards", ui.sheet.id);
  const points = ui.sheet.points || [];
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet loyalty-places-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">Где всплывает «${esc(item?.title || "карта")}»</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div>
    <p class="section-note">Нажмите на карту у входа в магазин. Точнее всего — «Я здесь», стоя внутри: точка совпадёт с тем, где телефон видит этот магазин.</p>
    <div class="loyalty-map-wrap"><div id="loyalty-map"></div><button type="button" class="map-locate" data-action="loyalty-here" aria-label="Поставить точку здесь">${icon("locate")}</button></div>
    <p class="loyalty-accuracy" id="loyalty-accuracy"></p>
    <ul class="loyalty-points">${points.map((p, i) => `<li><span class="loyalty-point-dot">${i + 1}</span><input type="text" data-point-label="${i}" value="${esc(p.label || "")}" placeholder="Точка ${i + 1}" maxlength="80"><select data-point-radius="${i}" aria-label="Радиус">${[25, 40, 60, 100].map(r => `<option value="${r}" ${Math.round(p.radius || 40) === r ? "selected" : ""}>${r} м</option>`).join("")}</select><button type="button" class="icon-button" data-action="loyalty-point-remove" data-index="${i}" aria-label="Убрать точку">${icon("trash", "icon-sm")}</button></li>`).join("") || `<li class="loyalty-points-empty">Точек пока нет</li>`}</ul>
    <div class="sheet-actions"><button type="button" class="ghost-button" data-action="close-sheet">Отмена</button><button type="button" class="primary-button" data-action="loyalty-places-save">Сохранить точки</button></div></section></div>`;
}
function disposeLoyaltyMap() {
  if (loyaltyMap) { ui.loyaltyView = [loyaltyMap.getCenter(), loyaltyMap.getZoom()]; loyaltyMap.remove(); loyaltyMap = null; loyaltyLayer = null; }
}
function drawLoyaltyPoints() {
  if (!loyaltyMap) return;
  if (loyaltyLayer) loyaltyLayer.remove();
  loyaltyLayer = L.layerGroup().addTo(loyaltyMap);
  (ui.sheet?.points || []).forEach((p, i) => {
    L.circle([p.lat, p.lng], { radius: p.radius || 40, color: "#e0662a", weight: 2, fillColor: "#e0662a", fillOpacity: .15, interactive: false }).addTo(loyaltyLayer);
    L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "loyalty-marker-shell", html: `<span class="loyalty-marker">${i + 1}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }), interactive: false }).addTo(loyaltyLayer);
  });
}
function mountLoyaltyMap() {
  const host = document.getElementById("loyalty-map");
  if (!host || !window.L) return;
  const points = ui.sheet.points || [];
  const mine = cachedPosition();
  const start = ui.loyaltyView?.[0] ? [ui.loyaltyView[0].lat, ui.loyaltyView[0].lng] : points[0] ? [points[0].lat, points[0].lng] : mine ? [mine.lat, mine.lng] : mapDefaultCenter();
  loyaltyMap = L.map(host, { zoomControl: false }).setView(start, ui.loyaltyView?.[1] || (points.length || mine ? 17 : 12));
  const map = loyaltyMap;
  addBaseLayer(map, () => map === loyaltyMap);
  drawLoyaltyPoints();
  map.on("click", event => {
    ui.sheet.points = [...(ui.sheet.points || []), { lat: +event.latlng.lat.toFixed(6), lng: +event.latlng.lng.toFixed(6), radius: 40, label: "" }];
    renderKeepLoyalty();
  });
  if (!points.length && !ui.loyaltyView) requestPosition().then(pos => { if (pos && map === loyaltyMap) map.setView([pos.lat, pos.lng], 17); });
}
function renderKeepLoyalty() {
  const list = document.querySelector(".loyalty-points");
  const scroll = document.querySelector(".loyalty-places-sheet")?.scrollTop || 0;
  render();
  const sheet = document.querySelector(".loyalty-places-sheet");
  if (sheet) sheet.scrollTop = scroll;
  void list;
}

// ------------------------------------------------------------ код на весь экран

function openLoyaltyFull(item) {
  if (!item) return;
  const layer = document.createElement("div");
  layer.className = "loyalty-full";
  layer.innerHTML = `<div class="loyalty-full-top">${loyaltyFace(item, "mini")}<b>${esc(item.title)}</b></div>${loyaltyCode(item, true)}<button type="button" class="loyalty-full-close">Закрыть</button>`;
  document.body.appendChild(layer);
  // Сканеру на кассе нужен яркий экран: на телефоне поднимаем яркость, пока код открыт.
  try { window.SorokaAndroid?.brightness?.(1); } catch (_) {}
  const close = () => { layer.remove(); try { window.SorokaAndroid?.brightness?.(-1); } catch (_) {} document.removeEventListener("keydown", keys, true); };
  const keys = event => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", keys, true);
  layer.querySelector(".loyalty-full-close").addEventListener("click", close);
}

// ------------------------------------------------------------ рядом: карта выезжает сама

const loyaltyNear = { hits: new Map(), shown: [], dismissed: new Set(), timer: 0, watch: null, last: null };
function distanceM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Какие карты «здесь»: точка ближе радиуса, и погрешность телефона не больше радиуса. */
function loyaltyMatches(pos) {
  return savedItems("cards").filter(card => (card.places || []).some(p => {
    const radius = Number(p.radius) || 40;
    return (Number(pos.acc) || 999) <= Math.max(radius, 25) && distanceM(pos, p) <= radius;
  }));
}
function onLoyaltyPosition(pos) {
  if (!pos) return;
  loyaltyNear.last = pos;
  const now = new Set(loyaltyMatches(pos).map(card => card.id));
  // Два совпадения подряд — иначе одиночный скачок GPS вытащил бы карту зря.
  for (const cardId of [...loyaltyNear.hits.keys()]) if (!now.has(cardId)) { loyaltyNear.hits.delete(cardId); loyaltyNear.dismissed.delete(cardId); }
  for (const cardId of now) loyaltyNear.hits.set(cardId, (loyaltyNear.hits.get(cardId) || 0) + 1);
  const ready = [...loyaltyNear.hits.entries()].filter(([cardId, n]) => n >= 2 && !loyaltyNear.dismissed.has(cardId)).map(([cardId]) => cardId);
  if (ready.join() !== loyaltyNear.shown.join()) { loyaltyNear.shown = ready; drawLoyaltyPeek(); }
}
function drawLoyaltyPeek() {
  let peek = document.getElementById("loyalty-peek");
  const cards = loyaltyNear.shown.map(cardId => savedItem("cards", cardId)).filter(Boolean);
  const root = document.documentElement;
  if (!cards.length || ui.sheet) {
    root.classList.remove("loyalty-peek-on");
    if (peek) { peek.classList.add("leaving"); setTimeout(() => peek?.remove(), 220); }
    return;
  }
  if (!peek) { peek = document.createElement("div"); peek.id = "loyalty-peek"; document.body.appendChild(peek); }
  peek.classList.remove("leaving");
  // Видны края: у каждой карты полоска с названием, у верхней — чуть больше.
  const n = Math.min(cards.length, 4);
  peek.style.setProperty("--n", n);
  root.style.setProperty("--peek-h", `${62 + (n - 1) * 42}px`);
  root.classList.add("loyalty-peek-on");
  peek.innerHTML = cards.slice(0, 4).map((card, i) => `<button type="button" class="loyalty-peek-card" data-peek="${esc(card.id)}" style="--i:${i}" aria-label="Открыть карту ${esc(card.title)}">${loyaltyFace(card)}</button>`).join("") +
    `<button type="button" class="loyalty-peek-hide" aria-label="Скрыть">${icon("down", "icon-sm")}</button>`;
  peek.onclick = event => {
    const pick = event.target.closest("[data-peek]");
    if (pick) { openLoyaltyFull(savedItem("cards", pick.dataset.peek)); return; }
    if (event.target.closest(".loyalty-peek-hide")) { loyaltyNear.shown.forEach(cardId => loyaltyNear.dismissed.add(cardId)); loyaltyNear.shown = []; drawLoyaltyPeek(); }
  };
}
function watchLoyaltyPlaces() {
  const want = !document.hidden && savedItems("cards").some(card => (card.places || []).length);
  if (!want) { if (loyaltyNear.watch !== null) { navigator.geolocation?.clearWatch(loyaltyNear.watch); loyaltyNear.watch = null; } clearTimeout(loyaltyNear.timer); return; }
  // Приложение телефона и браузер: слежение браузера — точное и непрерывное.
  if (!window.Telegram?.WebApp?.initData && navigator.geolocation) {
    if (loyaltyNear.watch === null) loyaltyNear.watch = navigator.geolocation.watchPosition(p => onLoyaltyPosition({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }), () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    return;
  }
  // Telegram: геопозиция по запросу — спрашиваем каждые 12 секунд, пока приложение открыто.
  clearTimeout(loyaltyNear.timer);
  const tick = async () => {
    if (document.hidden) return;
    onLoyaltyPosition(await requestPosition());
    loyaltyNear.timer = setTimeout(tick, 12000);
  };
  tick();
}
document.addEventListener("visibilitychange", () => setTimeout(watchLoyaltyPlaces, 300));
setTimeout(watchLoyaltyPlaces, 2500);

// ------------------------------------------------------------ действия

function loyaltyAction(action, control) {
  if (walletAction(action, control)) return true;
  if (action === "loyalty-full") { openLoyaltyFull(savedItem("cards", control.dataset.id)); return true; }
  if (action === "loyalty-brand") {
    const form = document.getElementById("loyalty-form");
    const keep = form ? Object.fromEntries(new FormData(form).entries()) : {};
    const brand = control.dataset.brand;
    const item = ui.sheet.id ? savedItem("cards", ui.sheet.id) : null;
    const wasBrandName = !keep.title || Object.values(LOYALTY_BRANDS).some(b => b.name === keep.title);
    ui.sheet.draftCard = { ...(item || {}), ...keep, brand, title: wasBrandName ? LOYALTY_BRANDS[brand].name : keep.title };
    ui.sheet.brand = brand;
    render();
    const f = document.getElementById("loyalty-form");
    if (f) { for (const [name, value] of Object.entries(ui.sheet.draftCard)) { const input = f.elements[name]; if (input && typeof value === "string" && input.type !== "radio" && name !== "brand") input.value = value; } f.elements.brand.value = brand; }
    return true;
  }
  if (action === "loyalty-cancel") { ui.sheet = null; render(); return true; }
  if (action === "loyalty-places") {
    const item = savedItem("cards", control.dataset.id);
    ui.sheet = { kind: "loyalty-places", id: item.id, points: (item.places || []).map(p => ({ ...p })), justRendered: false };
    ui.loyaltyView = null;
    render();
    return true;
  }
  if (action === "loyalty-here") {
    const note = document.getElementById("loyalty-accuracy");
    if (note) note.textContent = "Определяю, где вы…";
    requestPosition().then(pos => {
      const out = document.getElementById("loyalty-accuracy");
      if (!pos) { if (out) out.textContent = "Не получилось определить место — разрешите геопозицию."; return; }
      const radius = Math.max(40, Math.min(100, Math.ceil((Number(pos.acc) || 40) / 5) * 5));
      ui.sheet.points = [...(ui.sheet.points || []), { lat: +pos.lat.toFixed(6), lng: +pos.lng.toFixed(6), radius: [25, 40, 60, 100].find(r => r >= radius) || 100, label: "" }];
      ui.loyaltyView = [{ lat: pos.lat, lng: pos.lng }, 18];
      renderKeepLoyalty();
      const after = document.getElementById("loyalty-accuracy");
      if (after) after.textContent = pos.acc > 60 ? `Телефон видит себя с точностью ±${Math.round(pos.acc)} м — лучше подойти к окну или выйти ко входу и поставить ещё раз.` : `Точка поставлена, точность ±${Math.round(pos.acc)} м.`;
    });
    return true;
  }
  if (action === "loyalty-point-remove") { ui.sheet.points.splice(Number(control.dataset.index), 1); renderKeepLoyalty(); return true; }
  if (action === "loyalty-places-save") {
    const item = savedItem("cards", ui.sheet.id);
    document.querySelectorAll("[data-point-label]").forEach(input => { const p = ui.sheet.points[Number(input.dataset.pointLabel)]; if (p) p.label = input.value.trim(); });
    if (item) item.places = ui.sheet.points;
    ui.sheet = null; ui.walletOpen = item?.id || null;
    save(); render(); watchLoyaltyPlaces();
    toast(item?.places?.length ? `Точек: ${item.places.length} — карта будет выезжать рядом` : "Точки убраны");
    return true;
  }
  return false;
}
function loyaltyInput(event) {
  const label = event.target.dataset?.pointLabel;
  if (label === undefined || ui.sheet?.kind !== "loyalty-places") return false;
  const p = ui.sheet.points[Number(label)];
  if (p) p.label = event.target.value;
  return true;
}
function loyaltyChange(event) {
  const radius = event.target.dataset?.pointRadius;
  if (radius === undefined || ui.sheet?.kind !== "loyalty-places") return false;
  const p = ui.sheet.points[Number(radius)];
  if (p) { p.radius = Number(event.target.value); drawLoyaltyPoints(); }
  return true;
}

// ------------------------------------------------------------ кошелёк

/*
 * Раздел «Карты» — как кошелёк: карты лежат стопкой, у каждой видна полоса с
 * названием, последняя — целиком. Нажали — карта поднимается наверх, под ней
 * код и действия, остальные сжимаются в стопку внизу. Нажали ещё раз — назад.
 */
/** Порядок — как человек разложил перетаскиванием; новые — в конец. */
function walletCards() {
  const order = (data.settings.savedOrder || {}).cards || [];
  const rank = card => { const at = order.indexOf(card.id); return at < 0 ? 1e6 + (Date.parse(card.created) || 0) / 1e10 : at; };
  return savedItems("cards").slice().sort((a, b) => rank(a) - rank(b));
}
function renderWallet() {
  const cards = walletCards();
  if (!cards.length) {
    return `<div class="wallet-empty">${loyaltyFace({ brand: "custom", title: "Ваша карта", number: "", places: [] })}<p>Добавьте скидочную карту — номер под штрихкодом, и она всегда будет под рукой. Отметьте магазины на карте, и рядом с ними она выедет сама.</p><button type="button" class="primary-button" data-action="saved-new">${icon("plus")}Добавить карту</button></div>`;
  }
  const open = cards.find(card => card.id === ui.walletOpen);
  if (!open) {
    return `<div class="wallet" data-order-group="cards">${cards.map((card, i) => `<button type="button" class="wallet-card" data-action="wallet-open" data-id="${esc(card.id)}" data-order-key="${esc(card.id)}" style="--i:${i}" aria-label="Открыть карту ${esc(card.title)}">${loyaltyFace(card)}</button>`).join("")}</div>`;
  }
  const rest = cards.filter(card => card !== open);
  const places = (open.places || []).length;
  const confirm = ui.walletDelete === open.id;
  return `<div class="wallet is-open">
    <div class="wallet-focus">
      <button type="button" class="wallet-card wallet-card-open" data-action="wallet-close" aria-label="Свернуть">${loyaltyFace(open)}</button>
      <button type="button" class="loyalty-code-button wallet-code" data-action="loyalty-full" data-id="${esc(open.id)}" aria-label="Код на весь экран">${loyaltyCode(open)}</button>
      <div class="wallet-actions" role="group" aria-label="Действия с картой">
        <button type="button" data-action="loyalty-places" data-id="${esc(open.id)}">${icon("pin", "icon-sm")}<span>${places ? `Точки · ${places}` : "Где всплывает"}</span></button>
        <button type="button" data-action="wallet-edit" data-id="${esc(open.id)}">${icon("note", "icon-sm")}<span>Изменить</span></button>
        <button type="button" data-action="wallet-delete" data-id="${esc(open.id)}" class="danger ${confirm ? "confirm" : ""}" aria-label="Удалить карту">${icon("trash", "icon-sm")}${confirm ? "<span>Удалить?</span>" : ""}</button>
      </div>
      ${open.description ? `<p class="wallet-note">${esc(open.description)}</p>` : ""}
    </div>
    ${rest.length ? `<div class="wallet-rest">${rest.map((card, i) => `<button type="button" class="wallet-card" data-action="wallet-open" data-id="${esc(card.id)}" style="--i:${i}" aria-label="Открыть карту ${esc(card.title)}">${loyaltyFace(card)}</button>`).join("")}</div>` : ""}
  </div>`;
}
function walletAction(action, control) {
  if (action === "wallet-open") { ui.walletOpen = control.dataset.id; ui.walletDelete = null; render(); window.scrollTo({ top: 0, behavior: "smooth" }); return true; }
  if (action === "wallet-close") { ui.walletOpen = null; ui.walletDelete = null; render(); return true; }
  if (action === "wallet-edit") { openSavedRecord("cards", control.dataset.id, "edit"); return true; }
  if (action === "wallet-pin") { const card = savedItem("cards", control.dataset.id); if (card) { card.pinned = !card.pinned; save(); render(); } return true; }
  if (action === "wallet-delete") {
    // Удаление — вторым нажатием: карта с кассы не должна пропасть от случайного касания.
    if (ui.walletDelete !== control.dataset.id) { ui.walletDelete = control.dataset.id; render(); setTimeout(() => { if (ui.walletDelete === control.dataset.id) { ui.walletDelete = null; render(); } }, 3500); return true; }
    data.saved.cards = savedItems("cards").filter(card => card.id !== control.dataset.id);
    ui.walletOpen = null; ui.walletDelete = null;
    save(); render(); toast("Карта удалена");
    return true;
  }
  return false;
}
