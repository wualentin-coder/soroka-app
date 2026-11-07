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
    if ((m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) { out.push(`<figure class="note-image"><img src="${esc(m[2])}" alt="${esc(m[1])}" loading="lazy"></figure>`); continue; }
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
  if (typeof packingIsNote === "function" && packingIsNote(item)) { packingSaveQuietly(); return; }
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
  if (typeof packingIsNote === "function" && packingIsNote(item)) return renderPackingSheet(item);
  const d = noteDraft(item);
  const reading = ui.sheet.mode === "read";
  const returnLabel = ui.page === "saved" && ui.savedCategory === "notes" ? "Заметки" : "Назад";
  const folder = savedSection("notes", d.categoryId)?.name || "Без раздела";
  const versions = item?.versions || [];
  const history = versions.length ? `<details class="note-history" open><summary>История изменений <span>${versions.length}</span></summary>${versions.slice().reverse().map((version, index) => `<div class="note-history-entry"><time>${esc(version.date || "Ранее")}</time><p>${esc(version.description || "Пустая версия")}</p><button type="button" data-action="saved-restore-version" data-version="${versions.length - 1 - index}">Вставить в редактор</button></div>`).join("")}</details>` : "";
  const historyButton = versions.length ? `<button class="note-tool note-history-button" type="button" data-action="note-history" aria-label="История изменений" title="История изменений" aria-expanded="${Boolean(ui.sheet.historyOpen)}">${icon("reset", "icon-sm")}</button>` : "";
  const historyPanel = versions.length && ui.sheet.historyOpen ? history : "";
  const magic = document.documentElement.dataset.flowDesign === "magic";
  const assistant = `<button class="note-tool dc2-note-assistant" type="button" data-action="note-improve-menu" aria-label="Улучшить текст" title="Улучшить текст" aria-expanded="${Boolean(ui.sheet.improve)}"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 3C34 23 41 30 61 32C41 34 34 41 32 61C30 41 23 34 3 32C23 30 30 23 32 3Z"/></svg></button>`;
  const tools = `${magic ? assistant : `<button class="note-tool improve" type="button" data-action="note-improve-menu" aria-label="Улучшить">${icon("spark", "icon-sm")}<span>Улучшить</span></button>`}${historyButton}${item ? `<button class="note-tool" type="button" data-action="saved-share" aria-label="Поделиться">${icon("share", "icon-sm")}</button>` : ""}${magic ? `<button class="note-tool dc2-note-done" type="button" data-action="note-cancel">Готово</button>` : item ? `<button class="note-tool danger" type="button" data-action="saved-delete" aria-label="Удалить">${icon("trash", "icon-sm")}</button>` : ""}`;
  const undo = ui.sheet.prevText !== undefined ? `<button type="button" class="note-undo" data-action="note-improve-undo">${icon("reset", "icon-sm")}Вернуть как было</button>` : "";
  const menu = ui.sheet.improve ? `<div class="note-improve-menu" role="menu">${NOTE_STYLES.map(([key, label, about]) => `<button type="button" role="menuitem" data-action="note-improve" data-style="${key}"><b>${label}</b><small>${about}</small></button>`).join("")}</div>` : "";
  const busy = ui.sheet.improving ? `<div class="note-busy"><span class="live-spin big"></span><b>Оформляю…</b></div>` : "";
  const editor = `<form id="saved-form" class="note-editor note-plain"><textarea class="note-title-input" name="title" rows="1" placeholder="Название" maxlength="120" aria-label="Название заметки">${esc(d.title)}</textarea><div class="note-rich ${d.description.trim() ? "" : "is-empty"}" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Текст заметки" data-placeholder="Начните писать…">${noteEditableHtml(d.description)}</div><details class="note-meta"><summary>${icon("folder", "icon-sm")}${esc(folder)}${d.tags ? ` · ${esc(d.tags)}` : ""}</summary><div class="note-editor-details"><label>Папка<select name="categoryId"><option value="">Без папки</option>${savedSections("notes").map(section => `<option value="${esc(section.id)}" ${d.categoryId === section.id ? "selected" : ""}>${esc(section.name)}</option>`).join("")}</select></label><label>Метки<input name="tags" type="text" value="${esc(d.tags)}" placeholder="Через запятую"></label></div></details></form>`;
  const reader = `<div class="note-reader"><div class="note-paper note-rendered"><p class="note-date">${esc(item ? noteDateLabel(item) : "Новая заметка")}</p><h2>${esc(d.title || "Без названия")}</h2>${noteMarkdown(d.description) || "<p class=\"section-note\">Пустая заметка</p>"}</div></div>`;
  const composition = document.createElement("template"); composition.innerHTML = editor;
  if (magic) { const form = composition.content.querySelector("form"), meta = form.querySelector(".note-meta"); form.querySelector(".note-title-input").after(meta); if (item) meta.querySelector(".note-editor-details").insertAdjacentHTML("beforeend", `<button class="text-button danger dc2-note-delete" type="button" data-action="saved-delete">${icon("trash", "icon-sm")}Удалить заметку</button>`); }
  const format = document.createElement("template"); format.innerHTML = noteFormatBar();
  if (magic) {
    format.content.querySelector("[data-note-voice]")?.remove();
    const paths={h:'M5 5V21M16 5V21M5 13H16M20 7H27M23.5 7V21',ul:'M10 8H27M10 16H27M10 24H24M4 8H4.1M4 16H4.1M4 24H4.1',ol:'M12 8H28M12 16H28M12 24H26M4 4V11M3 4H4M2 16C2 13 7 13 7 16L2 20H7M2 24H6L3 27H7',check:'M3 9L6 12L11 5M15 9H28M3 23L6 26L11 19M15 23H28',bold:'M9 5H17C25 5 25 15 17 15H9ZM9 15H18C27 15 27 27 18 27H9Z',table:'M4 5H28V27H4ZM4 12H28M4 20H28M12 5V27M20 5V27',italic:'M14 5H24M8 27H18M21 5L11 27',strikeThrough:'M5 16H27M10 10C10 6 22 6 22 10C22 13 18 14 16 16C14 18 10 19 10 22C10 26 22 26 22 22',quote:'M12 9H5V15H9C9 19 8 22 5 24M27 9H20V15H24C24 19 23 22 20 24',undo:'M12 9L5 16L12 23M5 16H20C24 16 27 19 27 23',redo:'M20 9L27 16L20 23M27 16H12C8 16 5 19 5 23'};
    for(const button of format.content.querySelectorAll('[data-note-cmd]')){
      button.innerHTML=`<svg class="note-light-glyph" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[button.dataset.noteCmd]}"/></svg>`;
      button.setAttribute('aria-pressed','false');
    }
  }
  return `<div class="modal-backdrop note-backdrop" data-action="backdrop"><section class="sheet note-sheet ${magic ? "dc2-note-sheet" : ""}" role="dialog" aria-modal="true" aria-label="Заметка"><header class="note-toolbar"><button type="button" class="note-back" data-action="note-cancel">${icon("left", "icon-sm")}${returnLabel}</button><span class="note-tools">${tools}</span></header>${undo}${menu}${historyPanel}${composition.innerHTML}${format.innerHTML}${busy}</section></div>`;
}

/** Explicit, ephemeral bridge to the one Flow assistant. No note text leaves on open. */
window.flowNoteAssistantSession = function (opener) {
  if (ui.sheet?.kind !== "saved" || ui.sheet.category !== "notes") return null;
  const sheet = ui.sheet, item = sheet.id ? savedItem("notes", sheet.id) : null;
  let generation = 0;
  const current = () => { if (ui.sheet !== sheet) throw new Error("Заметка уже закрыта"); return noteDraft(item); };
  const applyText = text => { const draft = current(); sheet.prevText = draft.description; draft.description = window.flowNoteInk?.preserve(String(text||''),draft.description)??String(text||''); render(); return draft.description; };
  const applyVoice = text => { const draft = current(); return applyText([draft.description.trimEnd(), String(text || "").trim()].filter(Boolean).join("\n\n")); };
  return { opener, title: noteDraft(item).title || "Новая заметка", styles: NOTE_STYLES.map(([id,label,about]) => ({ id,label,about })), isCurrent: () => ui.sheet === sheet && sheet.kind === "saved" && sheet.category === "notes", getText: () => current().description, applyText, applyVoice, cancel: () => { generation++; },
    improve: async (style, options = {}) => {
      const source = current().description, request = ++generation;
      if (!source.trim()) throw new Error("Сначала напишите текст");
      if (typeof window.sorokaImproveNote !== "function") throw new Error("Обработка доступна в приложении Flow");
      const text = await window.sorokaImproveNote(window.flowNoteInk?.unpack(source).body??source, style);
      if (request !== generation || options.isCurrent?.() === false) throw new Error("Обработка отменена");
      if (current().description !== source) throw new Error("Текст уже изменился. Новая версия сохранена — повторите обработку.");
      return applyText(text);
    }
  };
};

function noteAction(action, control) {
  if (ui.sheet?.kind !== "saved" || ui.sheet.category !== "notes") {
    // Свайп по заметке в списке: «Улучшить» вместо «Настроить».
    if (action === "swipe-improve") { const row = control.closest(".swipe-row"); if (row) { openSavedRecord("notes", row.dataset.swipeId); ui.sheet.improve = true; render(); } return true; }
    return false;
  }
  const item = ui.sheet.id ? savedItem("notes", ui.sheet.id) : null;
  if (action === "note-assistant") { const session = window.flowNoteAssistantSession(control); if (session) window.flowAssistant?.openNote?.(session); return true; }
  if (action === "note-cancel") { saveNoteQuietly(); ui.sheet = null; render(); return true; }
  if (action === "note-read-toggle") { noteDraft(item); ui.sheet.mode = ui.sheet.mode === "read" ? "edit" : "read"; ui.sheet.improve = false; render(); return true; }
  if (action === "note-history") { ui.sheet.historyOpen = !ui.sheet.historyOpen; render(); return true; }
  if (action === "note-improve-menu") { noteDraft(item); ui.sheet.improve = !ui.sheet.improve; render(); return true; }
  if (action === "note-improve-undo") { noteDraft(item); ui.sheet.noteDraft.description = ui.sheet.prevText; delete ui.sheet.prevText; render(); return true; }
  if (action === "note-improve") {
    const d = noteDraft(item);
    if (!d.description.trim()) { toast("Сначала напишите текст"); return true; }
    if (typeof window.sorokaImproveNote !== "function") { toast("Улучшение работает в приложении бота"); return true; }
    const sheet = ui.sheet;
    sheet.improve = false; sheet.improving = true; render();
    window.sorokaImproveNote(window.flowNoteInk?.unpack(d.description).body??d.description, control.dataset.style).then(text => {
      if (ui.sheet !== sheet) return;
      sheet.prevText = d.description;
      sheet.noteDraft.description = window.flowNoteInk?.preserve(text,d.description)??text;
      sheet.improving = false;
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
closeSheet = function () {
  const sheet=ui.sheet,item=sheet?.id?savedItem("notes",sheet.id):null;
  if (typeof packingIsNote === "function" && packingIsNote(item,sheet)) {
    const result=closeSheetBeforeNotes.apply(this,arguments);
    if(ui.sheet!==sheet)packingDidClose(sheet);
    return result;
  }
  saveNoteQuietly(); return closeSheetBeforeNotes.apply(this, arguments);
};

// The screen-edge frame answers typing as one smooth state, not per keystroke.
(() => {
  const timers = new WeakMap();
  document.addEventListener('input', event => {
    const sheet = event.target.closest?.('.dc2-note-sheet');
    if (!sheet) return;
    sheet.dataset.noteTyping = 'true';
    clearTimeout(timers.get(sheet));
    timers.set(sheet, setTimeout(() => {
      if (sheet.isConnected) delete sheet.dataset.noteTyping;
      timers.delete(sheet);
    }, 700));
  });
})();

// Formatting reads the current selection and keeps it when the toolbar receives keyboard focus.
(() => {
  let range=null,owner=null,frame=0;
  function update(){
    frame=0;
    const editor=document.querySelector('.dc2-note-sheet .note-rich');if(!editor)return;
    const selection=getSelection(),node=selection?.anchorNode,element=node?.nodeType===1?node:node?.parentElement;
    if(node&&editor.contains(node)&&selection.rangeCount){range=selection.getRangeAt(0).cloneRange();owner=editor;}
    const within=element&&editor.contains(element),list=within?element.closest('ul,ol'):null;
    for(const button of document.querySelectorAll('.dc2-note-sheet [data-note-cmd]')){
      const cmd=button.dataset.noteCmd,pressed=within&&({h:!!element.closest('h1,h2,h3,h4'),ul:list?.tagName==='UL'&&!list.classList.contains('checks'),ol:list?.tagName==='OL',check:!!list?.classList.contains('checks'),bold:document.queryCommandState('bold'),table:!!element.closest('table')}[cmd]);
      button.setAttribute('aria-pressed',String(Boolean(pressed)));
    }
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update);}
  document.addEventListener('selectionchange',schedule);
  document.addEventListener('input',event=>{if(event.target.closest?.('.dc2-note-sheet .note-rich'))schedule();});
  document.addEventListener('click',event=>{
    if(!event.target.closest?.('.dc2-note-sheet [data-note-cmd]'))return;
    const editor=document.querySelector('.dc2-note-sheet .note-rich');
    if(editor&&owner===editor&&range?.startContainer.isConnected&&!editor.contains(getSelection()?.anchorNode)){
      editor.focus({preventScroll:true});const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
    }
    schedule();
  },true);
})();
