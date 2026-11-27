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


export { DOC_TYPES, DOC_ORDER };
