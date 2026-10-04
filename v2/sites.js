/*
 * «Мини-сайты» — HTML-страницы одним файлом (трекер курса, шпаргалка, игра).
 * Это файлы .html из «Файлов»: прислали боту или загрузили здесь. Открываются
 * на весь экран в песочнице, со своим хранилищем — прогресс страницы
 * запоминается; копия лежит на телефоне, поэтому открытие мгновенное.
 */

const isSite = item => /\.html?$/i.test(String(item.title || "")) || /\.html?$/i.test(String(item.fileName || ""));
const siteItems = () => savedItems("files").filter(isSite);
const siteName = item => String(item.title || "Страница").replace(/\.html?$/i, "").replace(/[_-]+/g, " ").trim();

function siteCard(item) {
  const name = siteName(item);
  const hue = [...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 360;
  return `<button type="button" class="site-card" data-action="site-open" data-id="${esc(item.id)}" style="--h:${hue}"><span class="site-face"><i></i><i></i><i></i><b>${esc(name.charAt(0).toUpperCase())}</b></span><span class="site-name">${esc(name)}</span></button>`;
}

function renderSitesPage() {
  const list = siteItems();
  const heading = `<div class="notes-topline"><button type="button" class="notes-back" data-action="saved-home">${icon("left", "icon-sm")}Сохранённое</button></div><header class="notes-heading saved-section-heading"><div><h1>Мини-сайты</h1></div><span class="saved-heading-count">${list.length}</span><button type="button" class="icon-button" data-action="site-add" aria-label="Загрузить страницу">${icon("plus")}</button></header>`;
  const body = list.length ? `<div class="site-grid">${list.map(siteCard).join("")}</div>`
    : `<div class="empty-card"><strong>Пока пусто</strong><p>Пришлите боту HTML-файл или загрузите его здесь — страница откроется на весь экран и запомнит свой прогресс.</p><button type="button" class="primary-button" data-action="site-add">Загрузить .html</button></div>`;
  return `<div class="saved-section-screen">${heading}<div class="content-grid"><div class="content-main">${body}<input id="site-file" type="file" accept=".html,.htm,text/html" hidden></div></div></div>`;
}

function sitesTile() {
  const list = siteItems();
  return `<button class="saved-section-card compact saved-section-sites" type="button" data-action="saved-section" data-category="sites" data-order-key="sites" aria-label="Мини-сайты"><span class="saved-section-icon">${icon("overview")}</span><span class="saved-section-copy"><strong>Мини-сайты</strong><small>${list.length ? esc(siteName(list[0])) : "HTML-страницы одним файлом"}</small></span>${list.length ? `<span class="saved-section-count">${list.length}</span>` : ""}</button>`;
}

function siteAction(action, control) {
  if (action === "site-open") {
    const item = savedItem("files", control.dataset.id);
    if (item && typeof window.sorokaOpenFile === "function") window.sorokaOpenFile(item);
    else toast("Страницы открываются в приложении бота");
    return true;
  }
  if (action === "site-add") { document.getElementById("site-file")?.click(); return true; }
  return false;
}

document.addEventListener("change", async event => {
  if (event.target.id !== "site-file") return;
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > 3_000_000) { toast("Файл больше 3 МБ — такой не загрузить"); return; }
  if (typeof window.sorokaUploadSite !== "function") { toast("Загрузка работает в приложении бота"); return; }
  toast("Загружаю страницу…");
  try {
    const html = await file.text();
    await window.sorokaUploadSite(file.name, html);
    render();
    toast("Страница добавлена");
  } catch (_) { toast("Не получилось загрузить — попробуйте ещё раз"); }
});
