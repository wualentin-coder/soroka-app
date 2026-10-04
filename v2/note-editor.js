/*
 * Редактор заметки «как в Заметках телефона»: текст всегда оформлен —
 * заголовки, списки, галочки, таблицы — и правится прямо так. Хранится
 * по-прежнему простой разметкой («# », «- », «- [ ] », «| … |»): её понимают
 * бот, поиск и «Улучшить», а редактор переводит туда и обратно.
 */

function noteInlineHtml(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

/** Разметка → HTML для правки. */
function noteEditableHtml(text) {
  const lines = String(text || "").split("\n");
  const out = [];
  let list = null; // { tag, cls, items }
  const flush = () => { if (list) { out.push(`<${list.tag}${list.cls ? ` class="${list.cls}"` : ""}>${list.items.join("")}</${list.tag}>`); list = null; } };
  const push = (tag, cls, li) => { if (!list || list.tag !== tag || list.cls !== cls) { flush(); list = { tag, cls, items: [] }; } list.items.push(li); };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
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
  return out.join("") || "<p><br></p>";
}

/** HTML редактора → разметка. */
function noteSerialize(root) {
  const inline = node => [...node.childNodes].map(child => {
    if (child.nodeType === 3) return child.textContent.replace(/ /g, " ");
    if (child.nodeType !== 1) return "";
    const tag = child.tagName;
    if (tag === "BR") return "";
    const inner = inline(child);
    if ((tag === "B" || tag === "STRONG") && inner.trim()) return `**${inner}**`;
    return inner;
  }).join("");
  const lines = [];
  const block = node => {
    if (node.nodeType === 3) { if (node.textContent.trim()) lines.push(node.textContent.replace(/ /g, " ")); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
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
  return lines.join("\n");
}

function noteFormatBar() {
  const b = (cmd, label, title) => `<button type="button" data-note-cmd="${cmd}" aria-label="${title}" title="${title}">${label}</button>`;
  return `<div class="note-format" role="toolbar" aria-label="Оформление">${b("h", "<b>Aa</b>", "Заголовок")}${b("ul", "•—", "Список")}${b("ol", "1.", "Нумерация")}${b("check", "☑", "Чек-лист")}${b("bold", "<b>B</b>", "Жирный")}${b("table", "▦", "Таблица")}<button type="button" data-note-voice aria-label="Надиктовать" title="Надиктовать">${icon("mic", "icon-sm")}</button></div>`;
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

// Вставка — только текстом: чужие стили в заметке не нужны.
document.addEventListener("paste", event => {
  if (!event.target.closest?.(".note-rich")) return;
  event.preventDefault();
  document.execCommand("insertText", false, event.clipboardData?.getData("text/plain") || "");
});

/** Блок верхнего уровня под курсором. */
function noteCaretBlock() {
  const editor = document.querySelector(".note-rich");
  let node = getSelection()?.anchorNode;
  while (node && node.parentNode !== editor) node = node.parentNode;
  return node && node.nodeType === 1 ? node : null;
}

// Кнопки панели не забирают фокус у текста.
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
  if (cmd === "bold") document.execCommand("bold");
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
