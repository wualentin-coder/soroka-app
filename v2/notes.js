/*
 * Заметки — как в телефоне: открыл — сразу пишешь, без рамок полей; вышел —
 * всё сохранилось само. «Улучшить» оформляет текст моделью в выбранном стиле
 * (в том числе таблицей); «Вид» показывает оформление — заголовки, списки,
 * таблицы. Редактируется при этом обычный текст с простой разметкой.
 */

const NOTE_STYLES = [
  ["fix", "Исправить", "Опечатки, запятые, абзацы — без других изменений"],
  ["structure", "Структурировать", "Заголовки, разделы и списки"],
  ["short", "Кратко", "Только суть, короткими пунктами"],
  ["todo", "Список дел", "Шаги с галочками по порядку"],
  ["table", "Таблица", "Свести данные в таблицу"],
];

/** Простая разметка → HTML: «#» заголовки, «- » и «- [ ]» списки, «|» таблицы, **жирный**. */
function noteMarkdown(text) {
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  const lines = String(text || "").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const body = rows.filter(r => !/^[\s|:-]+$/.test(r));
      const [head, ...rest] = body;
      out.push(`<div class="note-table-wrap"><table class="note-table"><thead><tr>${cells(head || "").map(c => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rest.map(r => `<tr>${cells(r).map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { out.push(`<h${m[1].length + 2} class="note-h">${inline(m[2])}</h${m[1].length + 2}>`); continue; }
    if ((m = line.match(/^\s*[-*]\s+\[( |x)\]\s+(.*)$/i))) { out.push(`<div class="note-check ${m[1].toLowerCase() === "x" ? "done" : ""}"><i></i><span>${inline(m[2])}</span></div>`); continue; }
    if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { out.push(`<div class="note-li">${inline(m[1])}</div>`); continue; }
    if ((m = line.match(/^\s*(\d+)[.)]\s+(.*)$/))) { out.push(`<div class="note-li num"><b>${m[1]}.</b> ${inline(m[2])}</div>`); continue; }
    out.push(line.trim() ? `<p>${inline(line)}</p>` : `<div class="note-gap"></div>`);
  }
  return out.join("");
}

/** Черновик открытой заметки. Поля пишут в него на каждый ввод, так что перерисовка его не теряет. */
function noteDraft(item) {
  if (!ui.sheet.noteDraft) ui.sheet.noteDraft = { title: item?.title || "", description: item?.description || "", categoryId: item ? noteFolderId(item) : (ui.sheet.draft?.categoryId || ""), tags: (item?.tags || []).join(", ") };
  return ui.sheet.noteDraft;
}
function syncNoteDraft(field) {
  if (ui.sheet?.kind !== "saved" || ui.sheet.category !== "notes" || !field.name) return;
  const d = noteDraft(ui.sheet.id ? savedItem("notes", ui.sheet.id) : null);
  if (field.name in d) d[field.name] = field.value;
}
["input", "change"].forEach(type => document.addEventListener(type, event => { if (event.target.closest?.(".note-plain")) syncNoteDraft(event.target); }, true));

/** Сохранить заметку тихо — при выходе. Пустую новую не заводим; без названия — первая строка. */
function saveNoteQuietly() {
  if (ui.sheet?.kind !== "saved" || ui.sheet.category !== "notes") return;
  const item = ui.sheet.id ? savedItem("notes", ui.sheet.id) : null;
  const d = noteDraft(item);
  const text = d.description.trim();
  let title = d.title.trim();
  if (!item && !title && !text) return;
  // Без названия — первая строка текста; у таблицы — её столбцы.
  if (!title) {
    const line = text.split("\n").map(l => l.trim()).find(l => l && !l.startsWith("|"));
    const head = text.split("\n").find(l => l.trim().startsWith("|"));
    title = (line || (head ? `Таблица: ${head.split("|").map(c => c.trim()).filter(Boolean).join(", ")}` : "Заметка")).replace(/^#+\s*|^[-*]\s+(\[[ x]\]\s+)?/gi, "").slice(0, 80);
  }
  const tags = d.tags.split(",").map(x => x.trim()).filter(Boolean);
  if (item && item.title === title && (item.description || "") === text && noteFolderId(item) === d.categoryId && (item.tags || []).join(",") === tags.join(",")) return;
  const note = item || { id: id(), created: todayIso(), source: "Добавлено вручную", versions: [], items: [] };
  if (item && (item.description || "") !== text) { note.versions ||= []; note.versions.push({ date: todayIso(), description: item.description || "" }); }
  note.title = title; note.description = text; note.updated = new Date().toISOString();
  note.categoryId = d.categoryId; note.topic = savedSection("notes", d.categoryId)?.name || ""; note.tags = tags;
  if (!item) data.notes.push(note);
  save();
  toast(item ? "Заметка сохранена" : "Заметка создана");
}

function renderNoteSheet(item) {
  const d = noteDraft(item);
  const reading = ui.sheet.mode === "read";
  const folder = savedSection("notes", d.categoryId)?.name || "Без папки";
  const versions = item?.versions || [];
  const history = versions.length ? `<details class="note-history"><summary>История изменений <span>${versions.length}</span></summary>${versions.slice().reverse().map((version, index) => `<div class="note-history-entry"><time>${esc(version.date || "Ранее")}</time><p>${esc(version.description || "Пустая версия")}</p><button type="button" data-action="saved-restore-version" data-version="${versions.length - 1 - index}">Вставить в редактор</button></div>`).join("")}</details>` : "";
  const tools = `<button class="note-tool improve" type="button" data-action="note-improve-menu" aria-label="Улучшить">${icon("spark", "icon-sm")}<span>Улучшить</span></button><button class="note-tool ${reading ? "on" : ""}" type="button" data-action="note-read-toggle" aria-label="${reading ? "Писать" : "Вид"}">${icon(reading ? "note" : "eye", "icon-sm")}</button>${item ? `<button class="note-tool" type="button" data-action="saved-share" aria-label="Поделиться">${icon("share", "icon-sm")}</button><button class="note-tool danger" type="button" data-action="saved-delete" aria-label="Удалить">${icon("trash", "icon-sm")}</button>` : ""}`;
  const undo = ui.sheet.prevText !== undefined ? `<button type="button" class="note-undo" data-action="note-improve-undo">${icon("reset", "icon-sm")}Вернуть как было</button>` : "";
  const menu = ui.sheet.improve ? `<div class="note-improve-menu" role="menu">${NOTE_STYLES.map(([key, label, about]) => `<button type="button" role="menuitem" data-action="note-improve" data-style="${key}"><b>${label}</b><small>${about}</small></button>`).join("")}</div>` : "";
  const busy = ui.sheet.improving ? `<div class="note-busy"><span class="live-spin big"></span><b>Оформляю…</b></div>` : "";
  const editor = `<form id="saved-form" class="note-editor note-plain"><textarea class="note-title-input" name="title" rows="1" placeholder="Название" maxlength="120" aria-label="Название заметки">${esc(d.title)}</textarea><textarea class="note-body-input" name="description" placeholder="Начните писать…" aria-label="Текст заметки" ${item ? "" : "autofocus"}>${esc(d.description)}</textarea><details class="note-meta"><summary>${icon("archive", "icon-sm")}${esc(folder)}${d.tags ? ` · ${esc(d.tags)}` : ""}</summary><div class="note-editor-details"><label>Папка<select name="categoryId"><option value="">Без папки</option>${savedSections("notes").map(section => `<option value="${esc(section.id)}" ${d.categoryId === section.id ? "selected" : ""}>${esc(section.name)}</option>`).join("")}</select></label><label>Метки<input name="tags" type="text" value="${esc(d.tags)}" placeholder="Через запятую"></label></div></details>${history}</form>`;
  const reader = `<div class="note-reader"><div class="note-paper note-rendered"><p class="note-date">${esc(item ? noteDateLabel(item) : "Новая заметка")}</p><h2>${esc(d.title || "Без названия")}</h2>${noteMarkdown(d.description) || "<p class=\"section-note\">Пустая заметка</p>"}</div></div>`;
  return `<div class="modal-backdrop note-backdrop" data-action="backdrop"><section class="sheet note-sheet" role="dialog" aria-modal="true" aria-label="Заметка"><header class="note-toolbar"><button type="button" class="note-back" data-action="note-cancel">${icon("left", "icon-sm")}Заметки</button><span class="note-tools">${tools}</span></header>${undo}${menu}${reading ? reader : editor}${busy}</section></div>`;
}

function noteAction(action, control) {
  if (ui.sheet?.kind !== "saved" || ui.sheet.category !== "notes") {
    // Свайп по заметке в списке: «Улучшить» вместо «Настроить».
    if (action === "swipe-improve") { const row = control.closest(".swipe-row"); if (row) { openSavedRecord("notes", row.dataset.swipeId); ui.sheet.improve = true; render(); } return true; }
    return false;
  }
  const item = ui.sheet.id ? savedItem("notes", ui.sheet.id) : null;
  if (action === "note-cancel") { saveNoteQuietly(); ui.sheet = null; render(); return true; }
  if (action === "note-read-toggle") { noteDraft(item); ui.sheet.mode = ui.sheet.mode === "read" ? "edit" : "read"; ui.sheet.improve = false; render(); return true; }
  if (action === "note-improve-menu") { noteDraft(item); ui.sheet.improve = !ui.sheet.improve; render(); return true; }
  if (action === "note-improve-undo") { noteDraft(item); ui.sheet.noteDraft.description = ui.sheet.prevText; delete ui.sheet.prevText; render(); return true; }
  if (action === "note-improve") {
    const d = noteDraft(item);
    if (!d.description.trim()) { toast("Сначала напишите текст"); return true; }
    if (typeof window.sorokaImproveNote !== "function") { toast("Улучшение работает в приложении бота"); return true; }
    const sheet = ui.sheet;
    sheet.improve = false; sheet.improving = true; render();
    window.sorokaImproveNote(d.description, control.dataset.style).then(text => {
      if (ui.sheet !== sheet) return;
      sheet.prevText = d.description;
      sheet.noteDraft.description = text;
      sheet.improving = false;
      sheet.mode = control.dataset.style === "table" || control.dataset.style === "structure" ? "read" : "edit";
      render();
      toast("Готово — сохранится при выходе");
    }).catch(() => { sheet.improving = false; render(); toast("Не получилось — попробуйте ещё раз"); });
    return true;
  }
  if (action === "saved-restore-version") {
    const v = item?.versions?.[Number(control.dataset.version)];
    if (v) { noteDraft(item); ui.sheet.noteDraft.description = v.description || ""; ui.sheet.mode = "edit"; render(); }
    return true;
  }
  return false;
}

// Enter в названии — перейти к тексту, а не отправить форму.
document.addEventListener("submit", event => {
  if (!event.target.closest?.(".note-plain")) return;
  event.preventDefault(); event.stopImmediatePropagation();
  event.target.querySelector(".note-body-input")?.focus();
}, true);

// Поля растут вместе с текстом — листается вся заметка, а не окошко внутри.
function fitNoteFields() {
  document.querySelectorAll(".note-plain textarea").forEach(field => { field.style.height = "auto"; field.style.height = `${field.scrollHeight + 2}px`; });
}
document.addEventListener("input", event => { if (event.target.closest?.(".note-plain")) fitNoteFields(); });
document.addEventListener("keydown", event => {
  if (event.key !== "Enter" || !event.target.matches?.(".note-title-input")) return;
  event.preventDefault();
  const body = event.target.form?.querySelector(".note-body-input");
  if (body) { body.focus(); body.setSelectionRange(0, 0); }
});
const renderBeforeNotes = render;
render = function () { const result = renderBeforeNotes.apply(this, arguments); if (document.querySelector(".note-plain")) fitNoteFields(); return result; };

// Заметка закрывается свайпом вниз или тапом мимо — тоже сохраняем.
const closeSheetBeforeNotes = closeSheet;
closeSheet = function () { saveNoteQuietly(); return closeSheetBeforeNotes.apply(this, arguments); };
