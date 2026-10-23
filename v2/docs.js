/*
 * «Документы»: паспорт, загранпаспорт, ИНН, СНИЛС, полис ОМС, свои документы
 * и копии. Каждый вид выглядит как сам документ, любое поле копируется текстом.
 *
 * В приложении документы шифруются тем же ключом, что и пароли (мастер-пароль):
 * сервер знает только вид и название. Здесь — хранилище демо в data.documents;
 * мост (app2/bridge.js) подменяет window.FlowDocs на зашифрованное.
 */
const DOC_PERSON = [["surname", "Фамилия"], ["name", "Имя"], ["patronymic", "Отчество"]];
const DOC_TYPES = {
  passport: { title: "Паспорт", icon: "passport", fields: [...DOC_PERSON, ["sex", "Пол", "sex"], ["birth", "Дата рождения", "date"], ["birthplace", "Место рождения"], ["series", "Серия", "series"], ["number", "Номер", "num6"], ["issuedBy", "Кем выдан", "long"], ["issued", "Дата выдачи", "date"], ["code", "Код подразделения", "code"], ["address", "Адрес регистрации", "long"]] },
  foreign: { title: "Загранпаспорт", icon: "plane", fields: [["surname", "Фамилия"], ["name", "Имя"], ["surnameLat", "Фамилия латиницей", "lat"], ["nameLat", "Имя латиницей", "lat"], ["sex", "Пол", "sex"], ["birth", "Дата рождения", "date"], ["birthplace", "Место рождения"], ["number", "Номер", "foreign"], ["issued", "Дата выдачи", "date"], ["expires", "Действителен до", "date"], ["authority", "Орган, выдавший документ"]] },
  inn: { title: "ИНН", icon: "certificate", fields: [...DOC_PERSON, ["inn", "ИНН", "inn"], ["birth", "Дата рождения", "date"], ["issued", "Дата постановки на учёт", "date"]] },
  snils: { title: "СНИЛС", icon: "snils", fields: [...DOC_PERSON, ["snils", "СНИЛС", "snils"], ["birth", "Дата рождения", "date"], ["sex", "Пол", "sex"], ["birthplace", "Место рождения"]] },
  oms: { title: "Медицинский полис", icon: "medical", fields: [...DOC_PERSON, ["oms", "Номер полиса", "oms"], ["birth", "Дата рождения", "date"], ["insurer", "Страховая компания"], ["phone", "Телефон страховой", "tel"]] },
  custom: { title: "Документ", icon: "document", fields: [] },
  copies: { title: "Копии документов", icon: "copies", fields: [] },
};
const DOC_ORDER = ["custom", "passport", "foreign", "inn", "snils", "oms", "copies"];
const DOC_ICONS = {
  document: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M8.5 16.5h3"/><circle cx="14.5" cy="16.5" r="1.4"/>',
  passport: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6"/><circle cx="12" cy="12.5" r="2.6"/><path d="M9 17.5h6"/>',
  plane: '<path d="M10.2 13.8 4 16l-1-1.4 5.6-4.4L6 6.8l1.3-1 5.4 2.6 3.6-3.6c1-1 2.6-1.3 3.1-.8s.2 2.1-.8 3.1l-3.6 3.6 2.6 5.4-1 1.3-3.4-2.6-4.4 5.6L7 18.4l2.2-6.2"/>',
  certificate: '<rect x="4" y="3" width="16" height="18" rx="1"/><rect x="6.5" y="5.5" width="11" height="13" rx=".5"/><path d="M9 9h6M9 11.5h6M9 14h3"/><circle cx="15" cy="15.5" r="1.2"/>',
  snils: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6.5 10h6M6.5 13h4M15.5 6v12"/><circle cx="18" cy="12" r="1.4"/>',
  medical: '<circle cx="12" cy="12" r="9"/><path d="M10 7.5h4v3h3v3h-3v3h-4v-3H7v-3h3z"/>',
  copies: '<path d="M15 3H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7z"/><path d="M15 3v4h4M4 7v12a2 2 0 0 0 2 2h9"/>',
};
function docIcon(name, cls = "") { return `<svg class="doc-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${DOC_ICONS[name] || DOC_ICONS.document}</svg>`; }

// Pure import merge: plaintext stays in memory and is encrypted by FlowDocs.save.
window.FlowDocumentImports = (() => {
  const MAX_BYTES = 8_000_000;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  function attachment(data, mime) {
    if (typeof data !== "string" || data.length > MAX_BYTES) return null;
    const match = data.match(/^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match || (mime && mime !== match[1]) || match[2].length % 4) return null;
    let head;
    try { head = atob(match[2].slice(0, 32)); } catch { return null; }
    const valid = match[1] === "application/pdf" ? head.startsWith("%PDF-")
      : match[1] === "image/jpeg" ? head.startsWith("\xff\xd8\xff")
      : match[1] === "image/png" ? head.startsWith("\x89PNG\r\n\x1a\n")
      : head.startsWith("RIFF") && head.slice(8, 12) === "WEBP";
    return valid ? { data, mime: match[1] } : null;
  }
  function merge(original, imports) {
    const doc = JSON.parse(JSON.stringify(original));
    doc.fields ||= {};
    doc.photos ||= [];
    doc.files ||= [];
    doc.conflicts ||= [];
    doc.appliedImports ||= [];
    const allowed = new Set((DOC_TYPES[doc.kind]?.fields || []).map(([key]) => key));
    const ids = [];
    const existing = new Set([...doc.photos, ...doc.files.map(file => file.data)]);
    for (const item of imports) {
      const id = String(item.id);
      ids.push(id);
      if (doc.appliedImports.includes(id)) continue;
      const payload = item.payload;
      if (!payload || typeof payload !== "object") throw new Error("docs_bad_import");
      for (const [key, proposed] of Object.entries(payload.fields || {})) {
        if (!allowed.has(key) || typeof proposed !== "string" || proposed.length > 2000 || !proposed.trim()) continue;
        const value = proposed.trim();
        const current = own(doc.fields, key) ? String(doc.fields[key] ?? "") : "";
        if (!current.trim()) doc.fields[key] = value;
        else if (current.trim() !== value && !doc.conflicts.some(c => c.field === key && c.proposed === value)) {
          doc.conflicts.push({ field: key, proposed: value, importId: id });
        }
      }
      const scans = [...(payload.photos || []).map(data => ({ data })), ...(payload.files || [])];
      for (const scan of scans) {
        const safe = attachment(scan?.data, scan?.mime);
        if (!safe) throw new Error("docs_bad_attachment");
        if (existing.has(safe.data)) continue;
        existing.add(safe.data);
        // Keep image bytes once: the full-screen preview offers an original download.
        const name = String(scan.name || (safe.mime === "application/pdf" ? "Скан.pdf" : "Скан." + safe.mime.split("/")[1]))
          .replace(/[\\/\x00-\x1f]/g, "_").slice(0, 120);
        if (safe.mime.startsWith("image/")) doc.photos.push(safe.data);
        else doc.files.push({ ...safe, name });
      }
      if (!String(doc.note || "").trim() && typeof payload.note === "string") doc.note = payload.note.slice(0, 2000);
      doc.appliedImports.push(id);
      if (JSON.stringify(doc).length > MAX_BYTES) throw new Error("docs_too_large");
    }
    return { doc, ids: [...new Set(ids)] };
  }
  return { merge, attachment };
})();

// ------------------------------------------------------------ хранилище демо

window.FlowDocs = window.FlowDocs || {
  ready: () => true,
  async list() { return (data.documents || []).map(({ id, kind, title }) => ({ id, kind, title })); },
  async get(id) { const doc = (data.documents || []).find(d => String(d.id) === String(id)); return doc ? JSON.parse(JSON.stringify(doc)) : null; },
  async save(doc) {
    data.documents ||= [];
    const id = doc.id || `doc-${Date.now().toString(36)}`;
    const at = data.documents.findIndex(d => d.id === id);
    const next = { ...doc, id };
    if (at >= 0) data.documents[at] = next; else data.documents.push(next);
    save();
    return id;
  },
  async remove(id) { data.documents = (data.documents || []).filter(d => String(d.id) !== String(id)); save(); },
};

function docsState() { return (ui.docs ||= { list: null, cache: {}, loading: false }); }
function docsReload() {
  const state = docsState();
  if (state.loading) return;
  state.loading = true;
  FlowDocs.list().then(list => { state.list = list; }).catch(() => { state.list = []; toast("Не удалось загрузить документы"); })
    .finally(() => { state.loading = false; if (ui.page === "docs") render(); });
}
/** Расшифровать документ и показать; пока идёт — окно с ожиданием. */
function docOpen(id) {
  const state = docsState();
  ui.sheet = { kind: "doc", id, loading: true, justRendered: false };
  render();
  FlowDocs.get(id).then(doc => { if (doc) state.cache[id] = doc; else toast("Документ не найден"); })
    .catch(() => toast("Не удалось открыть документ"))
    .finally(() => { if (ui.sheet?.kind === "doc" && ui.sheet.id === id) { ui.sheet.loading = false; render(); } });
}

// ------------------------------------------------------------ форматирование

const docDigits = value => String(value || "").replace(/\D/g, "");
const DOC_FORMAT = {
  series: v => { const d = docDigits(v); return d.length === 4 ? `${d.slice(0, 2)} ${d.slice(2)}` : String(v || ""); },
  code: v => { const d = docDigits(v); return d.length === 6 ? `${d.slice(0, 3)}-${d.slice(3)}` : String(v || ""); },
  foreign: v => { const d = docDigits(v); return d.length === 9 ? `${d.slice(0, 2)} ${d.slice(2)}` : String(v || ""); },
  snils: v => { const d = docDigits(v); return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 9)} ${d.slice(9)}` : String(v || ""); },
  oms: v => { const d = docDigits(v); return d.length === 16 ? d.replace(/(\d{4})(?=\d)/g, "$1 ") : String(v || ""); },
  date: v => { const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}.${m[2]}.${m[1]}` : String(v || ""); },
  sex: v => ({ m: "Муж.", f: "Жен." }[v] || String(v || "")),
};
function docValue(type, key, value) {
  const kind = (DOC_TYPES[type]?.fields.find(([k]) => k === key) || [])[2];
  return (DOC_FORMAT[kind] || (x => String(x || "")))(value);
}
function docFullName(doc) { return ["surname", "name", "patronymic"].map(k => doc.fields?.[k]).filter(Boolean).join(" "); }
/** Все заполненные поля — текстом, как их удобно вставить в анкету. */
function docAsText(doc) {
  const rows = doc.kind === "custom" ? (doc.rows || []).filter(r => r.value).map(r => `${r.label || "Поле"}: ${r.value}`)
    : (DOC_TYPES[doc.kind]?.fields || []).filter(([key]) => doc.fields?.[key]).map(([key, label]) => `${label}: ${docValue(doc.kind, key, doc.fields[key])}`);
  return [doc.title, ...rows, doc.note ? `Заметка: ${doc.note}` : ""].filter(Boolean).join("\n");
}

// Загранпаспорт: машиночитаемая зона (ICAO 9303) из полей — как внизу настоящей страницы.
const DOC_LAT = { а: "A", б: "B", в: "V", г: "G", д: "D", е: "E", ё: "E", ж: "ZH", з: "Z", и: "I", й: "I", к: "K", л: "L", м: "M", н: "N", о: "O", п: "P", р: "R", с: "S", т: "T", у: "U", ф: "F", х: "KH", ц: "TS", ч: "CH", ш: "SH", щ: "SHCH", ъ: "IE", ы: "Y", ь: "", э: "E", ю: "IU", я: "IA" };
const docLatin = text => String(text || "").toLowerCase().split("").map(c => DOC_LAT[c] ?? c).join("").toUpperCase().replace(/[^A-Z]+/g, "<");
function docCheck(text) {
  const weights = [7, 3, 1];
  return String([...text].reduce((sum, c, i) => sum + (c === "<" ? 0 : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 55) * weights[i % 3], 0) % 10);
}
function docMrz(f) {
  const ymd = v => { const m = String(v || "").match(/^\d{2}(\d{2})-(\d{2})-(\d{2})$/); return m ? m[1] + m[2] + m[3] : "<<<<<<"; };
  const line1 = `P<RUS${docLatin(f.surnameLat || f.surname)}<<${docLatin(f.nameLat || f.name)}`.padEnd(44, "<").slice(0, 44);
  const number = docDigits(f.number).padEnd(9, "<").slice(0, 9);
  const birth = ymd(f.birth), expires = ymd(f.expires), sex = f.sex === "f" ? "F" : f.sex === "m" ? "M" : "<";
  const personal = "<".repeat(14);
  const body = `${number}${docCheck(number)}RUS${birth}${docCheck(birth)}${sex}${expires}${docCheck(expires)}${personal}${docCheck(personal)}`;
  const composite = body.slice(0, 10) + body.slice(13, 20) + body.slice(21, 43);
  return [line1, `${body}${docCheck(composite)}`];
}

// ------------------------------------------------------------ вид документа

function docFace(doc) {
  const f = doc.fields || {};
  const v = key => esc(docValue(doc.kind, key, f[key]));
  const line = (label, key, cls = "") => `<div class="df-row ${cls}"><small>${label}</small><b>${v(key) || "—"}</b></div>`;
  const photo = doc.photos?.[0] && doc.kind !== "copies" ? `<img src="${esc(doc.photos[0])}" alt="">` : `<svg viewBox="0 0 40 50" aria-hidden="true"><circle cx="20" cy="18" r="8"/><path d="M5 48c1-10 7-15 15-15s14 5 15 15"/></svg>`;
  if (doc.kind === "passport") {
    const serial = esc(`${DOC_FORMAT.series(f.series)} ${f.number || ""}`.trim());
    return `<div class="doc-face df-passport"><div class="df-page df-top"><p class="df-state">Российская Федерация</p>${line("Паспорт выдан", "issuedBy", "wide")}<div class="df-pair">${line("Дата выдачи", "issued")}${line("Код подразделения", "code")}</div></div><div class="df-page df-bottom"><div class="df-photo">${photo}</div><div class="df-data">${line("Фамилия", "surname")}${line("Имя", "name")}${line("Отчество", "patronymic")}<div class="df-pair">${line("Пол", "sex")}${line("Дата рождения", "birth")}</div>${line("Место рождения", "birthplace")}</div><span class="df-serial">${serial}</span></div></div>`;
  }
  if (doc.kind === "foreign") {
    const [m1, m2] = docMrz(f);
    return `<div class="doc-face df-foreign"><div class="df-band"><b>Паспорт · Passport</b><span>Российская Федерация · Russian Federation</span></div><div class="df-body"><div class="df-photo">${photo}</div><div class="df-data">${line("Фамилия / Surname", "surname")}<small class="df-lat">${esc(f.surnameLat || docLatin(f.surname).replace(/</g, " ").trim())}</small>${line("Имя / Given names", "name")}<small class="df-lat">${esc(f.nameLat || docLatin(f.name).replace(/</g, " ").trim())}</small><div class="df-pair">${line("Пол / Sex", "sex")}${line("Дата рождения", "birth")}</div><div class="df-pair">${line("Выдан", "issued")}${line("Действителен до", "expires")}</div><div class="df-pair">${line("Номер", "number")}${line("Орган", "authority")}</div></div></div><div class="df-mrz"><span>${esc(m1)}</span><span>${esc(m2)}</span></div></div>`;
  }
  if (doc.kind === "inn") {
    const digits = docDigits(f.inn).padEnd(12, " ").slice(0, 12).split("").map(c => `<i>${c.trim() ? esc(c) : "&nbsp;"}</i>`).join("");
    return `<div class="doc-face df-inn"><div class="df-frame"><div class="df-emblem" aria-hidden="true"></div><p class="df-title">Свидетельство</p><p class="df-sub">о постановке на учёт физического лица в налоговом органе</p><p class="df-name">${esc(docFullName(doc)) || "—"}</p><div class="df-pair">${line("Дата рождения", "birth")}${line("Поставлен на учёт", "issued")}</div><small class="df-cap">ИНН</small><div class="df-boxes">${digits}</div></div></div>`;
  }
  if (doc.kind === "snils") {
    return `<div class="doc-face df-snils"><p class="df-title">Страховое свидетельство</p><p class="df-sub">обязательного пенсионного страхования</p><p class="df-number">${v("snils") || "—"}</p><div class="df-data">${line("Ф. И. О.", "surname")}<b class="df-rest">${esc([f.name, f.patronymic].filter(Boolean).join(" "))}</b><div class="df-pair">${line("Дата рождения", "birth")}${line("Пол", "sex")}</div></div></div>`;
  }
  if (doc.kind === "oms") {
    return `<div class="doc-face df-oms"><div class="df-stripe"><span class="df-cross" aria-hidden="true"></span><b>Полис ОМС</b></div><p class="df-sub">обязательного медицинского страхования</p><p class="df-number">${v("oms") || "—"}</p><div class="df-data"><b class="df-name">${esc(docFullName(doc)) || "—"}</b><div class="df-pair">${line("Дата рождения", "birth")}${line("Страховая", "insurer")}</div></div></div>`;
  }
  if (doc.kind === "copies") {
    const photos = doc.photos || [];
    return `<div class="doc-face df-copies">${photos.length ? photos.map((src, i) => `<button type="button" data-action="doc-photo" data-index="${i}"><img src="${esc(src)}" alt="Копия ${i + 1}"></button>`).join("") : `<p>Копий пока нет — добавьте фото или скан через «Изменить».</p>`}</div>`;
  }
  const rows = (doc.rows || []).filter(r => r.value).slice(0, 4);
  return `<div class="doc-face df-custom"><div class="df-custom-icon">${docIcon("document")}</div><p class="df-title">${esc(doc.title)}</p>${rows.map(r => `<div class="df-row"><small>${esc(r.label || "Поле")}</small><b>${esc(r.value)}</b></div>`).join("")}</div>`;
}

// ------------------------------------------------------------ страница

function renderDocsPage() {
  const top = `${backLink("more")}${header("Документы", "", "")}`;
  if (window.SOROKA_LIVE && !ui.vaultUnlocked) return `${top}<p class="section-note docs-lock-note">Документы зашифрованы тем же мастер-паролем, что и пароли: сервер видит только их вид.</p>${vaultLockedCard()}`;
  const state = docsState();
  if (state.list === null) { docsReload(); return `${top}<div class="state-card"><h2>Открываю документы…</h2></div>`; }
  const byKind = kind => state.list.filter(d => d.kind === kind);
  const tile = (kind, doc) => {
    const type = DOC_TYPES[kind];
    const filled = Boolean(doc);
    const action = filled ? `data-action="doc-open" data-id="${esc(doc.id)}"` : `data-action="doc-new" data-kind="${kind}"`;
    return `<button type="button" class="doc-tile ${filled ? "is-filled" : ""}" ${action}>${docIcon(type.icon)}<span class="doc-tile-name">${esc(doc?.title || type.title)}</span>${filled ? `<span class="doc-tile-mark" aria-label="Заполнен">${icon("check", "icon-sm")}</span>` : `<span class="doc-tile-add">${icon("plus", "icon-sm")}</span>`}</button>`;
  };
  const standard = ["passport", "foreign", "inn", "snils", "oms"].flatMap(kind => byKind(kind).length ? byKind(kind).map(doc => tile(kind, doc)) : [tile(kind, null)]);
  const own = byKind("custom").map(doc => tile("custom", doc));
  const copies = byKind("copies").map(doc => tile("copies", doc));
  const add = `<button type="button" class="doc-tile doc-tile-new" data-action="doc-new" data-kind="custom">${docIcon("document")}<span class="doc-tile-name">Свой документ</span><span class="doc-tile-add">${icon("plus", "icon-sm")}</span></button>`;
  const addCopies = copies.length ? "" : tile("copies", null);
  return `${top}<div class="doc-grid">${standard.join("")}${own.join("")}${copies.join("")}${addCopies}${add}</div><p class="section-note">Нажмите на документ — поля копируются по одному или все сразу. ${window.SOROKA_LIVE ? "Хранится шифром: открыть можно только мастер-паролем." : ""}</p>`;
}

// ------------------------------------------------------------ окна

function docSheetShell(title, body, actions = "") {
  return `<div class="modal-backdrop" data-action="backdrop"><section class="sheet doc-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-handle"></div><div class="sheet-head"><h2 id="sheet-title">${esc(title)}</h2><button class="icon-button" type="button" data-action="close-sheet" aria-label="Закрыть">${icon("close")}</button></div>${body}${actions}</section></div>`;
}
function renderDocSheet() {
  const doc = docsState().cache[ui.sheet.id];
  if (!doc || ui.sheet.loading) return docSheetShell("Документ", `<div class="state-card"><h2>Расшифровываю…</h2></div>`);
  const type = DOC_TYPES[doc.kind] || DOC_TYPES.custom;
  const rows = doc.kind === "custom"
    ? (doc.rows || []).map((r, i) => r.value ? [`row:${i}`, r.label || "Поле", r.value] : null).filter(Boolean)
    : type.fields.filter(([key]) => doc.fields?.[key]).map(([key, label]) => [key, label, docValue(doc.kind, key, doc.fields[key])]);
  const list = rows.map(([key, label, value]) => `<button type="button" class="doc-field" data-action="doc-copy" data-field="${esc(key)}"><span><small>${esc(label)}</small><b>${esc(value)}</b></span>${icon("copy", "icon-sm")}</button>`).join("");
  const photos = doc.kind !== "copies" && (doc.photos || []).length ? `<div class="doc-photos">${doc.photos.map((src, i) => `<button type="button" data-action="doc-photo" data-index="${i}"><img src="${esc(src)}" alt="Скан ${i + 1}"></button>`).join("")}</div>` : "";
  const note = doc.note ? `<p class="doc-note">${esc(doc.note)}</p>` : "";
  const conflicts = (doc.conflicts || []).map((item, index) => {
    const label = type.fields.find(([key]) => key === item.field)?.[1] || item.field;
    return `<div class="doc-import-conflict"><b>${esc(label)}</b><small>Сейчас: ${esc(docValue(doc.kind, item.field, doc.fields?.[item.field]))}</small><small>На скане: ${esc(docValue(doc.kind, item.field, item.proposed))}</small><div><button type="button" class="ghost-button" data-action="doc-import-keep" data-index="${index}">Оставить прежнее</button><button type="button" class="ghost-button" data-action="doc-import-use" data-index="${index}">Взять со скана</button></div></div>`;
  }).join("");
  const review = conflicts ? `<section class="doc-import-review"><h3>Проверьте данные со скана</h3><p>Прежние значения сохранены. Выберите, какие оставить.</p>${conflicts}</section>` : "";
  const files = (doc.files || []).map((file, index) => FlowDocumentImports.attachment(file.data, file.mime) ? `<button type="button" class="ghost-button doc-file-download" data-action="doc-file" data-index="${index}">${icon("document", "icon-sm")}${esc(file.name || "Скан документа")} · Скачать</button>` : "").join("");
  const copyAll = rows.length ? `<button type="button" class="ghost-button doc-copy-all" data-action="doc-copy-all">${icon("copy", "icon-sm")}Скопировать всё текстом</button>` : "";
  const confirm = ui.sheet.confirmDelete;
  const actions = `<div class="sheet-actions"><button type="button" class="primary-button" data-action="doc-edit">${icon("pen", "icon-sm")}Изменить</button><button type="button" class="ghost-button danger ${confirm ? "confirm" : ""}" data-action="doc-delete">${icon("trash", "icon-sm")}${confirm ? "Точно удалить?" : "Удалить"}</button></div>`;
  return docSheetShell(doc.title, `${docFace(doc)}${copyAll}<div class="doc-fields">${list}</div>${review}${photos}${files}${note}`, actions);
}
function docInput(type, [key, label, kind], value) {
  const v = esc(value || "");
  if (kind === "sex") return `<label class="field">${label}<select name="f:${key}"><option value="">—</option><option value="m" ${value === "m" ? "selected" : ""}>Мужской</option><option value="f" ${value === "f" ? "selected" : ""}>Женский</option></select></label>`;
  if (kind === "date") return `<label class="field">${label}<input name="f:${key}" type="date" value="${v}"></label>`;
  if (kind === "long") return `<label class="field doc-wide">${label}<textarea name="f:${key}" rows="2">${v}</textarea></label>`;
  const mode = ["series", "num6", "code", "foreign", "inn", "snils", "oms", "tel"].includes(kind) ? 'inputmode="numeric"' : "";
  const hint = { series: "45 10", num6: "123456", code: "770-001", foreign: "75 1234567", inn: "12 цифр", snils: "123-456-789 01", oms: "16 цифр", lat: "IVANOV" }[kind] || "";
  return `<label class="field">${label}<input name="f:${key}" value="${v}" ${mode} ${hint ? `placeholder="${hint}"` : ""} autocomplete="off" ${kind === "lat" ? 'autocapitalize="characters"' : ""}></label>`;
}
function renderDocEditSheet() {
  const sheet = ui.sheet;
  const doc = sheet.draft;
  const type = DOC_TYPES[doc.kind] || DOC_TYPES.custom;
  const titleField = ["custom", "copies"].includes(doc.kind) ? `<label class="field doc-wide">Название<input name="title" value="${esc(doc.title || "")}" required maxlength="80" placeholder="${doc.kind === "copies" ? "Копии документов" : "Диплом, свидетельство, пропуск…"}"></label>` : "";
  const fields = doc.kind === "custom"
    ? `${(doc.rows || []).map((r, i) => `<div class="doc-row-edit"><input name="rl:${i}" value="${esc(r.label || "")}" placeholder="Поле"><input name="rv:${i}" value="${esc(r.value || "")}" placeholder="Значение"><button type="button" class="icon-button" data-action="doc-row-remove" data-index="${i}" aria-label="Убрать поле">${icon("close", "icon-sm")}</button></div>`).join("")}<button type="button" class="ghost-button doc-wide" data-action="doc-row-add">${icon("plus", "icon-sm")}Добавить поле</button>`
    : type.fields.map(field => docInput(doc.kind, field, doc.fields?.[field[0]])).join("");
  const photos = `<div class="doc-wide doc-photo-edit">${(doc.photos || []).map((src, i) => `<span><img src="${esc(src)}" alt=""><button type="button" class="icon-button" data-action="doc-photo-remove" data-index="${i}" aria-label="Убрать фото">${icon("close", "icon-sm")}</button></span>`).join("")}${(doc.photos || []).length < 4 ? `<label class="doc-photo-add">${icon("plus")}<small>${doc.kind === "copies" ? "Фото или скан" : "Скан, если нужен"}</small><input type="file" accept="image/*" multiple data-doc-photos hidden></label>` : ""}</div>`;
  const note = `<label class="field doc-wide">Заметка<textarea name="note" rows="2">${esc(doc.note || "")}</textarea></label>`;
  const files = (doc.files || []).map((file, index) => `<div class="doc-wide doc-file-row"><span>${esc(file.name || "Скан.pdf")}</span><button type="button" class="icon-button" data-action="doc-file-remove" data-index="${index}" aria-label="Убрать файл">${icon("close")}</button></div>`).join("");
  const body = `<form id="doc-form" class="doc-form">${titleField}${fields}${photos}${files}${note}<div class="sheet-actions doc-wide"><button type="submit" class="primary-button" ${sheet.saving ? "disabled" : ""}>${sheet.saving ? "Сохраняю…" : "Сохранить"}</button></div></form>`;
  return docSheetShell(sheet.isNew ? `Новый: ${type.title.toLowerCase()}` : `Изменить: ${doc.title}`, body);
}
function renderDocPhotoSheet() {
  const doc = docsState().cache[ui.sheet.id];
  const raw = doc?.photos?.[ui.sheet.index];
  const src = FlowDocumentImports.attachment(raw)?.mime.startsWith("image/") ? raw : "";
  return `<div class="modal-backdrop doc-photo-full" data-action="backdrop"><button type="button" class="icon-button" data-action="doc-photo-back" aria-label="Закрыть">${icon("close")}</button>${src ? `<img src="${esc(src)}" alt=""><button type="button" class="ghost-button doc-photo-download" data-action="doc-photo-download" data-index="${ui.sheet.index}">Скачать оригинал</button>` : ""}</div>`;
}

// ------------------------------------------------------------ действия

/** Поля формы — в черновик, чтобы добавление поля или фото не стирало набранное. */
function docReadForm() {
  const form = document.getElementById("doc-form");
  const doc = ui.sheet?.draft;
  if (!form || !doc) return doc;
  const values = new FormData(form);
  if (values.has("title")) doc.title = String(values.get("title")).trim();
  doc.note = String(values.get("note") || "").trim();
  doc.fields ||= {};
  for (const [name, value] of values) if (name.startsWith("f:")) doc.fields[name.slice(2)] = String(value).trim();
  if (doc.kind === "custom") doc.rows = (doc.rows || []).map((r, i) => ({ label: String(values.get(`rl:${i}`) ?? r.label).trim(), value: String(values.get(`rv:${i}`) ?? r.value).trim() }));
  return doc;
}
/** Фото сжимаем на устройстве: шифр с оригиналом с камеры весил бы 5–10 МБ. */
function docShrink(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
    img.src = url;
  });
}
document.addEventListener("change", event => {
  const input = event.target.closest?.("[data-doc-photos]");
  if (!input || ui.sheet?.kind !== "doc-edit") return;
  const doc = docReadForm();
  const files = [...input.files].slice(0, 4 - (doc.photos || []).length);
  Promise.all(files.map(docShrink)).then(list => { doc.photos = [...(doc.photos || []), ...list]; render(); }).catch(() => toast("Не получилось прочитать фото"));
});
document.addEventListener("submit", event => {
  if (event.target?.id !== "doc-form") return;
  event.preventDefault(); event.stopImmediatePropagation();
  const sheet = ui.sheet;
  const doc = docReadForm();
  if (doc.kind === "custom") doc.rows = (doc.rows || []).filter(r => r.label || r.value);
  doc.title = doc.title || DOC_TYPES[doc.kind]?.title || "Документ";
  sheet.saving = true; render();
  FlowDocs.save(doc).then(id => {
    const state = docsState();
    const saved = { ...doc, id };
    state.cache[id] = saved;
    const at = (state.list || []).findIndex(d => String(d.id) === String(id));
    const row = { id, kind: doc.kind, title: doc.title };
    if (at >= 0) state.list[at] = row; else (state.list ||= []).push(row);
    ui.sheet = { kind: "doc", id, justRendered: true };
    toast("Документ сохранён");
  }).catch(error => { sheet.saving = false; render(); toast(error?.message === "docs_no_vault" ? "Сначала создайте хранилище в «Паролях»" : "Не удалось сохранить"); });
}, true);

function docsAction(action, control) {
  if (!action.startsWith("doc-")) return false;
  const state = docsState();
  const doc = ui.sheet?.id ? state.cache[ui.sheet.id] : null;
  if ((action === "doc-import-keep" || action === "doc-import-use") && doc && !ui.sheet.saving) {
    const index = Number(control.dataset.index);
    const conflict = doc.conflicts?.[index];
    if (!conflict) return true;
    const next = JSON.parse(JSON.stringify(doc));
    if (action === "doc-import-use") next.fields[conflict.field] = conflict.proposed;
    next.conflicts.splice(index, 1);
    const sheet = ui.sheet;
    sheet.saving = true;
    FlowDocs.save(next).then(() => {
      state.cache[doc.id] = next;
    }).catch(() => toast("Не удалось сохранить выбор. Данные не изменены"))
      .finally(() => { sheet.saving = false; if (ui.sheet === sheet) render(); });
    return true;
  }
  if ((action === "doc-file" || action === "doc-photo-download") && doc) {
    const file = action === "doc-file" ? doc.files?.[Number(control.dataset.index)] : { data: doc.photos?.[Number(control.dataset.index)], name: "Скан" };
    const safe = FlowDocumentImports.attachment(file?.data, file?.mime);
    if (!safe) return true;
    const binary = atob(safe.data.slice(safe.data.indexOf(",") + 1));
    const url = URL.createObjectURL(new Blob([Uint8Array.from(binary, c => c.charCodeAt(0))], { type: safe.mime }));
    const link = document.createElement("a");
    link.href = url; link.download = String(file.name || "Скан").replace(/[\\/\x00-\x1f]/g, "_") + (action === "doc-photo-download" ? "." + safe.mime.split("/")[1] : "");
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  }
  if (action === "doc-open") { docOpen(control.dataset.id); return true; }
  if (action === "doc-new") {
    const kind = control.dataset.kind;
    const title = kind === "custom" ? "" : DOC_TYPES[kind].title;
    ui.sheet = { kind: "doc-edit", isNew: true, draft: { kind, title, fields: {}, rows: kind === "custom" ? [{ label: "Номер", value: "" }, { label: "Дата выдачи", value: "" }] : [], photos: [], note: "" }, justRendered: false };
    render(); return true;
  }
  if (action === "doc-edit" && doc) { ui.sheet = { kind: "doc-edit", draft: JSON.parse(JSON.stringify(doc)), justRendered: false }; render(); return true; }
  if (action === "doc-copy" && doc) {
    const key = control.dataset.field;
    const value = key.startsWith("row:") ? doc.rows?.[Number(key.slice(4))]?.value : docValue(doc.kind, key, doc.fields?.[key]);
    copySharedText(String(value || "")).then(ok => toast(ok ? "Скопировано" : "Не удалось скопировать"));
    return true;
  }
  if (action === "doc-copy-all" && doc) { copySharedText(docAsText(doc)).then(ok => toast(ok ? "Скопировано всё" : "Не удалось скопировать")); return true; }
  if (action === "doc-delete" && doc) {
    if (!ui.sheet.confirmDelete) { ui.sheet.confirmDelete = true; render(); return true; }
    FlowDocs.remove(doc.id).then(() => {
      state.list = (state.list || []).filter(d => String(d.id) !== String(doc.id));
      delete state.cache[doc.id];
      ui.sheet = null; toast("Документ удалён");
    }).catch(() => toast("Не удалось удалить"));
    return true;
  }
  if (action === "doc-photo") { ui.sheet = { kind: "doc-photo", id: ui.sheet.id, index: Number(control.dataset.index) || 0, justRendered: false }; render(); return true; }
  if (action === "doc-photo-back") { ui.sheet = { kind: "doc", id: ui.sheet.id, justRendered: true }; render(); return true; }
  if (action === "doc-row-add") { const draft = docReadForm(); draft.rows = [...(draft.rows || []), { label: "", value: "" }]; render(); return true; }
  if (action === "doc-row-remove") { const draft = docReadForm(); draft.rows.splice(Number(control.dataset.index), 1); render(); return true; }
  if (action === "doc-photo-remove") { const draft = docReadForm(); draft.photos.splice(Number(control.dataset.index), 1); render(); return true; }
  if (action === "doc-file-remove") { const draft = docReadForm(); draft.files.splice(Number(control.dataset.index), 1); render(); return true; }
  return false;
}
