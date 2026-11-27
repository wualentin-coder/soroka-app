const esc = value => esc2(value);
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


export { noteEditableHtml, noteSerialize };
