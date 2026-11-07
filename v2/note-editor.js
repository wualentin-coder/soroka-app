/*
 * Редактор заметки «как в Заметках телефона»: текст всегда оформлен —
 * заголовки, списки, галочки, таблицы — и правится прямо так. Хранится
 * по-прежнему простой разметкой («# », «- », «- [ ] », «| … |»): её понимают
 * бот, поиск и «Улучшить», а редактор переводит туда и обратно.
 */

function noteInlineHtml(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/_([^_]+)_/g,"<i>$1</i>").replace(/~~(.+?)~~/g,"<s>$1</s>");
}

/** Разметка → HTML для правки. */
function noteEditableHtml(text) {
  const ink=window.flowNoteInk?.metadata(text);
  const lines = String(ink?.body ?? text ?? "").split("\n");
  const out = [];
  let list = null; // { tag, cls, items }
  const flush = () => { if (list) { out.push(`<${list.tag}${list.cls ? ` class="${list.cls}"` : ""}>${list.items.join("")}</${list.tag}>`); list = null; } };
  const push = (tag, cls, li) => { if (!list || list.tag !== tag || list.cls !== cls) { flush(); list = { tag, cls, items: [] }; } list.items.push(li); };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if ((m=line.match(/^>\s?(.*)$/))) { flush();out.push(`<blockquote>${noteInlineHtml(m[1])||"<br>"}</blockquote>`);continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = r => r.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const body = rows.filter(r => !/^[\s|:-]+$/.test(r));
      out.push(`<table><tbody>${body.map((r, n) => `<tr>${cells(r).map(c => n ? `<td>${noteInlineHtml(c) || "<br>"}</td>` : `<th>${noteInlineHtml(c) || "<br>"}</th>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    if ((m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) { flush(); out.push(`<figure class="note-image"><img src="${esc(m[2])}" alt="${esc(m[1])}" loading="lazy"></figure>`); continue; }
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { flush(); out.push(`<h${m[1].length + 2}>${noteInlineHtml(m[2]) || "<br>"}</h${m[1].length + 2}>`); continue; }
    // Отступ пункта (вложенный список) — data-indent, по два пробела на уровень.
    const lvl = s => { const n = Math.min(4, Math.floor(s.replace(/	/g, "  ").length / 2)); return n ? ` data-indent="${n}"` : ""; };
    if ((m = line.match(/^(\s*)[-*]\s+\[( |x)\]\s?(.*)$/i))) { push("ul", "checks", `<li${lvl(m[1])}${m[2].toLowerCase() === "x" ? ' data-done="1"' : ""}>${noteInlineHtml(m[3]) || "<br>"}</li>`); continue; }
    if ((m = line.match(/^(\s*)[-*•]\s+(.*)$/))) { push("ul", "", `<li${lvl(m[1])}>${noteInlineHtml(m[2]) || "<br>"}</li>`); continue; }
    if ((m = line.match(/^(\s*)\d+[.)]\s+(.*)$/))) { push("ol", "", `<li${lvl(m[1])}>${noteInlineHtml(m[2]) || "<br>"}</li>`); continue; }
    flush();
    out.push(`<p>${noteInlineHtml(line) || "<br>"}</p>`);
  }
  flush();
  return (out.join("") || "<p><br></p>")+(ink?.html||"");
}

/** HTML редактора → разметка. */
function noteSerialize(root) {
  const inline = node => [...node.childNodes].map(child => {
    if (child.nodeType === 3) return child.textContent.replace(/ /g, " ");
    if (child.nodeType !== 1) return "";
    const tag = child.tagName;
    if(child.classList.contains("note-ink-data")||child.classList.contains("note-ink-layer"))return "";
    if (tag === "BR") return "";
    const inner = inline(child);
    if ((tag === "B" || tag === "STRONG") && inner.trim()) return `**${inner}**`;
    if ((tag==="I"||tag==="EM")&&inner.trim())return `_${inner}_`;
    if ((tag==="S"||tag==="STRIKE"||tag==="DEL")&&inner.trim())return `~~${inner}~~`;
    return inner;
  }).join("");
  const lines = [];
  const block = node => {
    if (node.nodeType === 3) { if (node.textContent.trim()) lines.push(node.textContent.replace(/ /g, " ")); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if(node.classList.contains("note-ink-data")||node.classList.contains("note-ink-layer"))return;
    if(tag==="BLOCKQUOTE"){lines.push(`> ${inline(node)}`);return;}
    if(tag==="FIGURE"&&node.querySelector("img")){const img=node.querySelector("img");lines.push(`![${img.getAttribute("alt")||""}](${img.getAttribute("src")||""})`);return;}
    if(tag==="IMG"){lines.push(`![${node.getAttribute("alt")||""}](${node.getAttribute("src")||""})`);return;}
    if (/^H[1-6]$/.test(tag)) { lines.push(`${"#".repeat(Math.max(1, Math.min(3, Number(tag[1]) - 2)))} ${inline(node).trim()}`); return; }
    if (tag === "UL" || tag === "OL") {
      const checks = node.classList.contains("checks");
      [...node.children].forEach((li, n) => {
        const text = inline(li).trim();
        const pad = "  ".repeat(Number(li.dataset.indent) || 0);
        lines.push(pad + (checks ? `- [${li.dataset.done === "1" ? "x" : " "}] ${text}` : tag === "OL" ? `${n + 1}. ${text}` : `- ${text}`));
      });
      return;
    }
    if (tag === "TABLE") {
      [...node.querySelectorAll("tr")].forEach((tr, n) => {
        const cells = [...tr.children].map(cell => inline(cell).replace(/\|/g, "/").trim());
        lines.push(`| ${cells.join(" | ")} |`);
        if (n === 0) lines.push(`|${cells.map(() => "---").join("|")}|`);
      });
      return;
    }
    // Браузер иногда кладёт список внутрь абзаца или div — разбираем содержимое по блокам.
    if ((tag === "DIV" || tag === "P") && node.querySelector(":scope > ul, :scope > ol, :scope > table, :scope > h3, :scope > h4, :scope > h5, :scope > p, :scope > div")) { [...node.childNodes].forEach(block); return; }
    lines.push(inline(node));
  };
  [...root.childNodes].forEach(block);
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const body=lines.join("\n");
  return window.flowNoteInk?window.flowNoteInk.pack(body,window.flowNoteInk.strokes(root)):body;
}

function noteFormatBar() {
  const paths={h:'M4 18l5-12 5 12M6 14h6M16 11h4v7M16 15h4',ul:'M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1',ol:'M10 6h11M10 12h11M10 18h11M3 4h2v5M3 13c4-2 4 1 0 5h4',check:'M4 4h16v16H4ZM7 12l3 3 7-7',bold:'M7 4h6a4 4 0 010 8H7ZM7 12h7a4 4 0 010 8H7Z',table:'M3 4h18v16H3ZM3 9h18M3 15h18M10 4v16',italic:'M10 4h9M5 20h9M15 4L9 20',strikeThrough:'M17 6c-7-5-14 4-5 6M7 18c5 4 12 0 9-4M3 12h18',quote:'M4 6h6v7H5l-1 5M14 6h6v7h-5l-1 5',undo:'M4 9h10a6 6 0 010 12M4 9l5-5M4 9l5 5',redo:'M20 9H10a6 6 0 000 12M20 9l-5-5M20 9l-5 5'};
  const b = (cmd, label, title) => `<button type="button" data-note-cmd="${cmd}" aria-label="${title}" title="${title}">${paths[cmd]?`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[cmd]}"/></svg>`:label}</button>`;
  return `<div class="note-format" role="toolbar" aria-label="Оформление">${b("h", "<b>Aa</b>", "Заголовок")}${b("ul", "•—", "Список")}${b("ol", "1.", "Нумерация")}${b("check", "☑", "Чек-лист")}${b("bold", "<b>B</b>", "Жирный")}${b("table", "▦", "Таблица")}${b("italic","<i>I</i>","Курсив")}${b("strikeThrough","<s>S</s>","Зачёркнутый")}${b("quote","❞","Цитата")}${b("undo","↶","Отменить")}${b("redo","↷","Повторить")}<button type="button" data-note-ink aria-label="Рисовать поверх текста" aria-pressed="false" title="Рисовать"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20l4-1L20 7l-3-3L5 16Z M14 7l3 3 M4 20h16"/></svg></button><button type="button" data-note-voice aria-label="Надиктовать" title="Надиктовать"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg></button></div>`;
}

function syncRichNote() {
  const editor = document.querySelector(".note-rich");
  if (!editor || ui.sheet?.kind !== "saved" || ui.sheet.category !== "notes") return;
  const text = noteSerialize(editor);
  noteDraft(ui.sheet.id ? savedItem("notes", ui.sheet.id) : null).description = text;
  editor.classList.toggle("is-empty", !text.trim() && !editor.querySelector("table, ul, ol"));
}

document.addEventListener("input", event => { if (event.target.closest?.(".note-rich")) syncRichNote(); });
// Новая строка — абзацем <p>, а не <div>: так разметка остаётся простой.
document.addEventListener("focusin", event => { if (event.target.closest?.(".note-rich")) { try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (_) {} } });

// Вставка: текст — как текст, картинка — в Storage и Markdown-ссылкой в заметке.
document.addEventListener("paste", event => {
  if (!event.target.closest?.(".note-rich")) return;
  const data = event.clipboardData;
  const files = [...(data?.files || [])].filter(file => /^image\/(png|jpeg|webp)$/.test(file.type));
  if (!files.length) for (const item of data?.items || []) if (item.kind === "file" && /^image\/(png|jpeg|webp)$/.test(item.type)) { const file = item.getAsFile(); if (file) files.push(file); }
  event.preventDefault();
  if (files.length) { void insertNoteImage(files[0]); return; }
  document.execCommand("insertText", false, data?.getData("text/plain") || "");
});

async function insertNoteImage(file) {
  if (file.size > 6 * 1024 * 1024) { notifyNote("Картинка больше 6 МБ"); return; }
  const selection = getSelection(), range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const url = window.sorokaUploadNoteImage
      ? await window.sorokaUploadNoteImage(base64, file.type)
      : await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
    if (!url) throw new Error("upload");
    if (range) { selection.removeAllRanges(); selection.addRange(range); }
    document.execCommand("insertHTML", false, `<figure class="note-image"><img src="${esc(url)}" alt="" loading="lazy"></figure><p><br></p>`);
    window.syncRichNote?.();
  } catch { notifyNote("Не удалось вставить картинку"); }
}

function notifyNote(message) {
  if (typeof window.toast === "function") window.toast(message);
  else window.notesUI?.status?.(message);
}

/** Блок верхнего уровня под курсором. */
function noteCaretBlock() {
  const editor = document.querySelector(".note-rich");
  let node = getSelection()?.anchorNode;
  while (node && node.parentNode !== editor) node = node.parentNode;
  return node && node.nodeType === 1 ? node : null;
}

// Кнопки панели не забирают фокус у текста.
document.addEventListener('keydown',event=>{
  if(!(event.ctrlKey||event.metaKey)||!['z','y'].includes(event.key.toLowerCase())||!event.target.closest?.('.note-rich[contenteditable="true"]'))return;
  event.preventDefault();event.stopImmediatePropagation();
  document.execCommand(event.key.toLowerCase()==='y'||event.shiftKey?'redo':'undo');syncRichNote();
},true);
document.addEventListener("pointerdown", event => { if (event.target.closest?.("[data-note-cmd]")) event.preventDefault(); });
document.addEventListener("mousedown", event => { if (event.target.closest?.("[data-note-cmd]")) event.preventDefault(); });
document.addEventListener("click", event => {
  const button = event.target.closest?.("[data-note-cmd]");
  if (!button) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const editor = document.querySelector(".note-rich");
  if (!editor) return;
  if (!editor.contains(getSelection()?.anchorNode)) {
    editor.focus();
    const r = document.createRange(); r.selectNodeContents(editor); r.collapse(false);
    getSelection().removeAllRanges(); getSelection().addRange(r);
  }
  try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (_) {}
  const cmd = button.dataset.noteCmd;
  const block = noteCaretBlock();
  if (["bold","italic","strikeThrough","undo","redo"].includes(cmd)) document.execCommand(cmd);
  else if(cmd==="quote")document.execCommand("formatBlock",false,block?.tagName==="BLOCKQUOTE"?"p":"blockquote");
  else if (cmd === "h") document.execCommand("formatBlock", false, block && /^H\d$/.test(block.tagName) ? "p" : "h3");
  else if (cmd === "ul" || cmd === "ol") {
    if (block?.classList?.contains("checks") && cmd === "ul") block.classList.remove("checks");
    else document.execCommand(cmd === "ul" ? "insertUnorderedList" : "insertOrderedList");
  } else if (cmd === "check") {
    const list = () => { const n = getSelection()?.anchorNode; return (n?.nodeType === 1 ? n : n?.parentElement)?.closest?.(".note-rich ul, .note-rich ol"); };
    const current = list();
    if (current?.tagName === "UL") current.classList.toggle("checks");
    else { document.execCommand("insertUnorderedList"); list()?.classList.add("checks"); }
  } else if (cmd === "table") {
    document.execCommand("insertHTML", false, "<table><tbody><tr><th><br></th><th><br></th></tr><tr><td><br></td><td><br></td></tr></tbody></table><p><br></p>");
  }
  syncRichNote();
}, true);

// Галочка: нажатие по кружку слева отмечает пункт.
document.addEventListener("click", event => {
  const li = event.target.closest?.(".note-rich ul.checks > li");
  if (!li) return;
  if (event.clientX - li.getBoundingClientRect().left > 30) return;
  event.preventDefault();
  if (li.dataset.done === "1") delete li.dataset.done; else li.dataset.done = "1";
  syncRichNote();
});

// Таблица: Tab — в следующую ячейку, из последней — новая строка.
document.addEventListener("keydown", event => {
  if (event.key !== "Tab" || !event.target.closest?.(".note-rich")) return;
  const cell = getSelection()?.anchorNode?.parentElement?.closest?.("td, th") || (getSelection()?.anchorNode?.closest?.("td, th"));
  if (!cell) return;
  event.preventDefault();
  const cells = [...cell.closest("table").querySelectorAll("td, th")];
  let next = cells[cells.indexOf(cell) + 1];
  if (!next) {
    const tr = document.createElement("tr");
    tr.innerHTML = [...cell.parentElement.children].map(() => "<td><br></td>").join("");
    cell.closest("tbody").append(tr);
    next = tr.firstElementChild;
  }
  const r = document.createRange(); r.selectNodeContents(next); r.collapse(true);
  getSelection().removeAllRanges(); getSelection().addRange(r);
  syncRichNote();
});

// Enter в названии — к тексту заметки.
document.addEventListener("keydown", event => {
  if (event.key !== "Enter" || !event.target.matches?.(".note-title-input")) return;
  const rich = event.target.form?.querySelector(".note-rich");
  if (!rich) return;
  event.preventDefault(); event.stopImmediatePropagation();
  rich.focus();
}, true);
