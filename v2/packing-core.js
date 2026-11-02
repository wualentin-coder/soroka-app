var PackingCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key2 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key2) && key2 !== except)
          __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // supabase/functions/_shared/packing-core.ts
  var packing_core_exports = {};
  __export(packing_core_exports, {
    PACKING_SECTIONS: () => PACKING_SECTIONS,
    applyPackingPlan: () => applyPackingPlan,
    importPackingMemory: () => importPackingMemory,
    mergePacking: () => mergePacking,
    normalizePacking: () => normalizePacking,
    normalizePackingMemory: () => normalizePackingMemory,
    normalizePackingPlan: () => normalizePackingPlan,
    normalizeTrip: () => normalizeTrip,
    packingChildren: () => packingChildren,
    packingConfigKey: () => packingConfigKey,
    packingProgress: () => packingProgress,
    packingText: () => packingText,
    tripDays: () => tripDays
  });
  var PACKING_SECTIONS = [
    { id: "documents", label: "Документы и деньги", icon: "note" },
    { id: "tech", label: "Телефон и техника", icon: "server" },
    { id: "clothes", label: "Одежда", icon: "shirt" },
    { id: "shoes", label: "Обувь", icon: "shoe" },
    { id: "hygiene", label: "Гигиена и защита", icon: "spark" },
    { id: "medicines", label: "Аптечка", icon: "health" },
    { id: "road", label: "В дорогу", icon: "plane" },
    { id: "personal", label: "Личное", icon: "bookmark" },
    { id: "before", label: "Подготовить до выезда", icon: "calendar" },
    { id: "final", label: "Последняя проверка", icon: "check" }
  ];
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var KEY = /^[a-z0-9][a-z0-9_-]{0,59}$/;
  var has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  var labelKey = (v) => v.normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  function record(v) {
    if (!v || typeof v !== "object" || Array.isArray(v)) throw Error("Проверь данные сборов.");
    return v;
  }
  function text(v, max, required = false) {
    if (v == null) v = "";
    if (typeof v !== "string" || v.includes("\0")) throw Error("Проверь текст в сборах.");
    const s = v.trim();
    if (s.length > max || required && !s) throw Error(required ? "Заполни название или текст пункта." : "Текст слишком длинный.");
    return s;
  }
  function integer(v, min, max, fallback) {
    if ((v === void 0 || v === "") && fallback !== void 0) return fallback;
    const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN;
    if (!Number.isInteger(n) || n < min || n > max) throw Error(`Нужно целое число от ${min} до ${max}.`);
    return n;
  }
  function choice(v, values, fallback) {
    if (v === void 0 || v === "") return fallback;
    if (typeof v !== "string" || !values.includes(v)) throw Error("Проверь параметры поездки.");
    return v;
  }
  function date(v) {
    const s = text(v, 10);
    if (!s) return "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Error("Укажи корректную дату поездки.");
    const value = /* @__PURE__ */ new Date(s + "T00:00:00Z");
    if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0, 10) !== s) throw Error("Укажи корректную дату поездки.");
    return s;
  }
  function normalizeTrip(raw, requireTrip = false) {
    const r = raw == null ? {} : record(raw), destination = text(r.destination, 180), startOn = date(r.startOn), endOn = date(r.endOn);
    let days = integer(r.days, 1, 365, 7);
    if (endOn && !startOn) throw Error("Сначала укажи дату начала поездки.");
    if (startOn && endOn) {
      days = (Date.parse(endOn + "T00:00:00Z") - Date.parse(startOn + "T00:00:00Z")) / 864e5 + 1;
      if (!Number.isInteger(days) || days < 1 || days > 365) throw Error("Поездка — от 1 до 365 дней; конец не раньше начала.");
    }
    if (requireTrip && (!destination || !startOn)) throw Error("Укажи, куда едешь и когда начинается поездка.");
    const rawActivities = r.activities === void 0 ? ["city"] : r.activities;
    if (!Array.isArray(rawActivities) || rawActivities.length > 8 || rawActivities.some((a) => !["city", "beach", "nature", "work"].includes(String(a)))) throw Error("Проверь занятия в поездке.");
    return {
      destination,
      startOn,
      endOn,
      days,
      transport: choice(r.transport, ["plane", "train", "car", "other"], "plane"),
      baggage: choice(r.baggage, ["backpack", "cabin", "checked"], "cabin"),
      laundryEvery: integer(r.laundryEvery, 0, 14, 5),
      activities: [...new Set(rawActivities)].sort(),
      special: text(r.special, 500)
    };
  }
  function tripDays(raw) {
    return normalizeTrip(raw).days;
  }
  function packingConfigKey(raw) {
    return JSON.stringify(normalizeTrip(raw));
  }
  function section(v) {
    if (typeof v !== "string" || !PACKING_SECTIONS.some((s) => s.id === v)) throw Error("Проверь раздел пункта.");
    return v;
  }
  function key(v) {
    if (typeof v !== "string" || !KEY.test(v)) throw Error("Не удалось распознать пункт списка.");
    return v;
  }
  function instant(v) {
    const s = text(v, 40, true), at = new Date(s);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(s) || !Number.isFinite(at.getTime())) throw Error("Некорректная дата изменения пункта.");
    date(s.slice(0, 10));
    return at.toISOString();
  }
  function planItem(v) {
    const r = record(v), note = text(r.note, 160), kind = choice(r.kind, ["group", "item"], "item");
    if (["templateId", "templateAt", "remember", "parentId"].some((k) => has(r, k))) throw Error("ИИ не может менять личные пункты.");
    const parentKey = r.parentKey === void 0 ? void 0 : key(r.parentKey);
    if (kind === "group" && parentKey) throw Error("В сборах поддерживается один уровень вложенности.");
    const quantity = integer(r.quantity, 1, 99, 1);
    if (kind === "group" && quantity !== 1) throw Error("Количество задаётся для вещей, а не для группы.");
    return { key: key(r.key), section: section(r.section), text: text(r.text, 120, true), quantity, ...r.kind !== void 0 ? { kind } : {}, ...parentKey ? { parentKey } : {}, ...note ? { note } : {} };
  }
  function normalizePackingPlan(raw) {
    const r = record(raw);
    if (!Array.isArray(r.items) || !r.items.length || r.items.length > 100) throw Error("ИИ должен составить не больше 100 строк и 80 вещей.");
    const items = r.items.map(planItem), keys = /* @__PURE__ */ new Set(), labels = /* @__PURE__ */ new Set();
    const leaves = items.filter((i) => i.kind !== "group");
    if (!leaves.length || leaves.length > 80) throw Error("В подборке ИИ должно быть от 1 до 80 вещей.");
    const byKey = new Map(items.map((i) => [i.key, i]));
    for (const item of items) {
      const label = (item.kind === "group" ? "group:" + item.section + ":" : "item:") + labelKey(item.text);
      if (keys.has(item.key) || labels.has(label)) throw Error("В списке повторяются одинаковые вещи.");
      keys.add(item.key);
      labels.add(label);
      if (item.parentKey) {
        const parent = byKey.get(item.parentKey);
        if (!parent || parent.kind !== "group" || parent.section !== item.section) throw Error("Проверь вложенные пункты списка.");
      }
      if (item.kind === "group" && !items.some((child) => child.parentKey === item.key)) throw Error("В группе ИИ должны быть вещи.");
    }
    return { items };
  }
  function savedItem(v) {
    const r = record(v), source = choice(r.source, ["ai", "manual"], "manual"), note = text(r.note, 160), kind = choice(r.kind, ["group", "item"], "item");
    const k = source === "ai" ? key(r.key) : void 0, id = source === "ai" ? "ai:" + k : text(r.id, 80, true);
    if (source === "manual" && !UUID.test(id)) throw Error("Не удалось распознать ручной пункт.");
    if (source === "ai" && r.id !== void 0 && r.id !== id) throw Error("Изменился идентификатор пункта.");
    const result = { id, ...k ? { key: k } : {}, section: section(r.section), text: text(r.text, 120, true), quantity: kind === "group" ? 1 : integer(r.quantity, 1, 99, 1), done: kind !== "group" && r.done === true, source, ...r.edited === true ? { edited: true } : {}, ...note ? { note } : {}, ...r.kind !== void 0 ? { kind } : {} };
    if (r.parentId !== void 0) {
      if (kind === "group") throw Error("В сборах поддерживается один уровень вложенности.");
      result.parentId = text(r.parentId, 80, true);
    }
    const memoryFields = ["templateId", "templateAt", "remember"];
    if (memoryFields.some((k2) => has(r, k2)) && (kind === "group" || source === "ai" && !result.edited)) throw Error("Запомнить можно только свой пункт списка.");
    if (r.templateId !== void 0) {
      const id2 = text(r.templateId, 36, true);
      if (!UUID.test(id2)) throw Error("Не удалось распознать запомненный пункт.");
      result.templateId = id2;
    }
    if (r.remember !== void 0) {
      if (typeof r.remember !== "boolean") throw Error("Проверь сохранение личного пункта.");
      result.remember = r.remember;
    }
    if (r.templateAt !== void 0) {
      if (!result.templateId) throw Error("Не удалось распознать запомненный пункт.");
      result.templateAt = instant(r.templateAt);
    }
    return result;
  }
  function validateHierarchy(items) {
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const item of items) if (item.parentId) {
      const parent = byId.get(item.parentId);
      if (!parent || parent.kind !== "group" || parent.section !== item.section) throw Error("Проверь вложенные пункты списка.");
    }
  }
  function normalizePacking(raw) {
    const r = record(raw), id = text(r.id, 36, true);
    if (!UUID.test(id) || r.version !== 1) throw Error("Обнови приложение, чтобы открыть эти сборы.");
    const entries = r.items === void 0 ? [] : r.items;
    if (!Array.isArray(entries) || entries.length > 200) throw Error("В сборах может быть не больше 200 пунктов.");
    const items = entries.map(savedItem), ids = /* @__PURE__ */ new Set();
    for (const item of items) {
      if (ids.has(item.id)) throw Error("Повторяется идентификатор пункта.");
      ids.add(item.id);
    }
    validateHierarchy(items);
    const userParents = new Set(items.filter((i) => i.source === "manual" || i.edited).map((i) => i.parentId));
    const generated = items.filter((i) => i.source === "ai" && !i.edited && !(i.kind === "group" && userParents.has(i.id)));
    if (generated.length > 100 || generated.filter((i) => i.kind !== "group").length > 80) throw Error("В подборке ИИ может быть не больше 100 строк и 80 вещей.");
    const removed = r.removedKeys === void 0 ? [] : r.removedKeys;
    if (!Array.isArray(removed) || removed.length > 200) throw Error("Слишком много удалённых пунктов.");
    const removedKeys = [...new Set(removed.map(key))];
    const doc = { version: 1, id, config: normalizeTrip(r.config), items, removedKeys };
    if (r.hierarchyVersion !== void 0 && r.hierarchyVersion !== 1) throw Error("Обнови приложение, чтобы открыть вложенные сборы.");
    if (r.hierarchyVersion === 1 || items.some((i) => i.kind === "group" || i.parentId)) doc.hierarchyVersion = 1;
    if (r.generatedFor !== void 0) {
      const v = text(r.generatedFor, 4e3);
      if (v) doc.generatedFor = v;
    }
    if (r.requestId !== void 0) {
      const v = text(r.requestId, 36);
      if (!UUID.test(v)) throw Error("Не удалось распознать запрос составления.");
      doc.requestId = v;
    }
    if (r.generating !== void 0) doc.generating = r.generating === true;
    if (doc.generating && !doc.requestId) throw Error("Не удалось распознать запрос составления.");
    if (r.generationStartedAt !== void 0) {
      const v = text(r.generationStartedAt, 40), at = new Date(v);
      if (!Number.isFinite(at.getTime())) throw Error("Некорректная дата составления.");
      doc.generationStartedAt = at.toISOString();
    }
    if (r.generationError !== void 0) {
      const v = text(r.generationError, 240);
      if (v) doc.generationError = v;
    }
    return doc;
  }
  var isProtected = (item) => item.source === "manual" || item.edited === true;
  function repairHierarchy(items) {
    const parents = new Map(items.filter((i) => i.kind === "group").map((i) => [i.id, i]));
    return items.map((item) => {
      if (!item.parentId || parents.get(item.parentId)?.section === item.section) return item;
      const next = { ...item };
      delete next.parentId;
      return next;
    });
  }
  function retainNeededParents(items, previous, removed, removedIds = /* @__PURE__ */ new Set()) {
    const result = [...items], ids = new Set(items.map((i) => i.id)), old = new Map(previous.map((i) => [i.id, i]));
    for (const child of items) {
      if (!isProtected(child) || !child.parentId || ids.has(child.parentId) || removedIds.has(child.parentId)) continue;
      const parent = old.get(child.parentId);
      if (parent?.kind === "group" && parent.section === child.section && !(parent.key && removed.has(parent.key))) {
        result.push(parent);
        ids.add(parent.id);
      }
    }
    return result;
  }
  function noExtraDuplicates(items, removed) {
    const protectedText = new Set(items.filter((i) => isProtected(i) && i.kind !== "group").map((i) => labelKey(i.text)));
    const groups = /* @__PURE__ */ new Map(), aliases = /* @__PURE__ */ new Map(), seen = /* @__PURE__ */ new Set();
    for (const item of items) if (item.kind === "group" && isProtected(item) && !(item.key && removed.has(item.key))) groups.set(item.section + ":" + labelKey(item.text), item.id);
    const deduped = items.filter((item) => {
      if (item.source === "ai" && item.key && removed.has(item.key)) return false;
      if (isProtected(item)) return true;
      if (item.kind === "group") {
        const label2 = item.section + ":" + labelKey(item.text), existing = groups.get(label2);
        if (existing) {
          aliases.set(item.id, existing);
          return false;
        }
        groups.set(label2, item.id);
        return true;
      }
      const label = labelKey(item.text);
      if (protectedText.has(label) || seen.has(label)) return false;
      seen.add(label);
      return true;
    });
    const repaired = repairHierarchy(deduped.map((item) => item.parentId && aliases.has(item.parentId) ? { ...item, parentId: aliases.get(item.parentId) } : item));
    const needed = new Set(repaired.map((i) => i.parentId));
    return repaired.filter((i) => i.kind !== "group" || isProtected(i) || needed.has(i.id));
  }
  function applyPackingPlan(raw, proposal, expectedConfigKey) {
    const current = normalizePacking(raw);
    if (packingConfigKey(current.config) !== expectedConfigKey) return current;
    const plan = normalizePackingPlan(proposal), old = new Map(current.items.map((i) => [i.id, i])), removed = new Set(current.removedKeys), used = /* @__PURE__ */ new Set();
    const items = plan.items.filter((i) => !removed.has(i.key) && !(i.parentKey && removed.has(i.parentKey))).map((row) => {
      const id = "ai:" + row.key, previous = old.get(id);
      used.add(id);
      const { parentKey, ...content } = row;
      return previous?.edited ? previous : { ...content, id, ...parentKey ? { parentId: "ai:" + parentKey } : {}, source: "ai", done: row.kind !== "group" && (previous?.done ?? false) };
    });
    items.push(...current.items.filter((i) => isProtected(i) && !used.has(i.id)));
    const next = { ...current, items: noExtraDuplicates(retainNeededParents(items, current.items, removed), removed), generatedFor: expectedConfigKey, generating: false };
    delete next.generationError;
    return normalizePacking(next);
  }
  function mergePacking(rawCurrent, rawBase, rawIncoming) {
    const current = rawCurrent == null ? null : normalizePacking(rawCurrent);
    if (rawIncoming == null) return current;
    const incoming = normalizePacking(rawIncoming);
    if (!current) return incoming;
    if (current.id !== incoming.id) throw Error("Запись сборов изменилась. Обнови её перед сохранением.");
    if (rawBase == null) return current;
    const base = normalizePacking(rawBase);
    if (base.id !== incoming.id) throw Error("Изменился идентификатор сборов.");
    const legacyHierarchy = current.hierarchyVersion === 1 && incoming.hierarchyVersion !== 1;
    const config = { ...current.config };
    for (const field of Object.keys(config)) if (!same(incoming.config[field], base.config[field])) Object.assign(config, { [field]: incoming.config[field] });
    const mergedConfig = normalizeTrip(config), freshKey = packingConfigKey(mergedConfig);
    const aiContent = (doc) => doc.items.filter((i) => i.source === "ai" && !i.edited).map((i) => ({ id: i.id, text: i.text, quantity: i.quantity, section: i.section, note: i.note, kind: i.kind, parentId: i.parentId }));
    const completion = incoming.generatedFor !== base.generatedFor || incoming.generating === false && base.generating === true && !incoming.generationError && incoming.generatedFor !== void 0 && !same(aiContent(incoming), aiContent(base));
    const inputMatchesFresh = packingConfigKey(incoming.config) === freshKey;
    const requestChanged = incoming.requestId !== base.requestId;
    const sameRequest = incoming.requestId === current.requestId;
    const newRequestAllowed = requestChanged && !sameRequest && inputMatchesFresh && (current.requestId === base.requestId || Date.parse(incoming.generationStartedAt || "") >= Date.parse(current.generationStartedAt || ""));
    const staleRequest = !sameRequest && !newRequestAllowed;
    const staleAI = completion && (staleRequest || incoming.generatedFor !== freshKey);
    const currentMap = new Map(current.items.map((i) => [i.id, i])), baseMap = new Map(base.items.map((i) => [i.id, i])), incomingMap = new Map(incoming.items.map((i) => [i.id, i]));
    const removed = /* @__PURE__ */ new Set([...current.removedKeys, ...incoming.removedKeys.filter((k) => !base.removedKeys.includes(k))]);
    const removedIds = /* @__PURE__ */ new Set();
    for (const old of base.items) {
      if (incomingMap.has(old.id)) continue;
      if (legacyHierarchy && old.kind === "group") continue;
      const latest = currentMap.get(old.id), aiRemoval = completion && old.source === "ai" && !old.edited;
      if (aiRemoval && (staleAI || latest?.edited)) continue;
      currentMap.delete(old.id);
      if (!aiRemoval) {
        removedIds.add(old.id);
        if (old.source === "ai" && old.key) removed.add(old.key);
      }
    }
    for (const item of incoming.items) {
      const was = baseMap.get(item.id), latest = currentMap.get(item.id);
      if (!was) {
        if (!latest && !(item.source === "ai" && staleAI) && !(item.key && removed.has(item.key))) currentMap.set(item.id, item);
        continue;
      }
      if (!latest) continue;
      const next2 = { ...latest };
      for (const field of ["text", "quantity", "section", "done", "edited", "note", "kind", "parentId", "templateId", "remember", "templateAt"]) {
        if (legacyHierarchy && ["kind", "parentId", "templateId", "remember", "templateAt"].includes(field)) continue;
        if (same(item[field], was[field])) continue;
        const generatedContent = completion && item.source === "ai" && !item.edited && field !== "done";
        if (generatedContent && (staleAI || latest.edited)) continue;
        if (item[field] === void 0) delete next2[field];
        else Object.assign(next2, { [field]: item[field] });
      }
      currentMap.set(item.id, next2);
    }
    const kept = retainNeededParents([...currentMap.values()], current.items, removed, removedIds);
    const next = { ...current, config: mergedConfig, items: noExtraDuplicates(kept, removed), removedKeys: [...removed] };
    if (incoming.hierarchyVersion === 1) next.hierarchyVersion = 1;
    if (newRequestAllowed) {
      for (const field of ["requestId", "generating", "generationStartedAt", "generationError"]) {
        if (incoming[field] === void 0) delete next[field];
        else Object.assign(next, { [field]: incoming[field] });
      }
    } else if (sameRequest && inputMatchesFresh) {
      for (const field of ["generating", "generationError"]) if (!same(incoming[field], base[field])) {
        if (field === "generating" && incoming.generating === true && current.generating === false) continue;
        if (incoming[field] === void 0) delete next[field];
        else Object.assign(next, { [field]: incoming[field] });
      }
    }
    if (!staleAI && incoming.generatedFor !== base.generatedFor && incoming.generatedFor === freshKey) next.generatedFor = incoming.generatedFor;
    if (freshKey !== packingConfigKey(current.config) && !(newRequestAllowed && packingConfigKey(incoming.config) === freshKey)) {
      next.generating = false;
      delete next.generationError;
    }
    return normalizePacking(next);
  }
  function packingChildren(raw, parentId) {
    const doc = normalizePacking(raw);
    return doc.items.filter((i) => parentId ? i.parentId === parentId : !i.parentId);
  }
  function packingProgress(raw, parentId) {
    const doc = normalizePacking(raw), leaves = doc.items.filter((i) => i.kind !== "group" && (!parentId || i.parentId === parentId));
    return { done: leaves.filter((i) => i.done).length, total: leaves.length };
  }
  function normalizePackingMemory(raw) {
    const rows = raw == null ? [] : Array.isArray(raw) ? raw : record(raw).items;
    if (!Array.isArray(rows) || rows.length > 200) throw Error("Можно запомнить не больше 200 личных вещей.");
    const ids = /* @__PURE__ */ new Set();
    return rows.map((row) => {
      const r = record(row), id = text(r.id, 36, true), parentLabel = text(r.parentLabel, 120);
      if (!UUID.test(id) || ids.has(id)) throw Error("Не удалось распознать запомненный пункт.");
      ids.add(id);
      return { id, text: text(r.text, 120, true), quantity: integer(r.quantity, 1, 99, 1), section: section(r.section), ...parentLabel ? { parentLabel } : {}, ...r.updatedAt !== void 0 ? { updatedAt: instant(r.updatedAt) } : {} };
    });
  }
  function importPackingMemory(raw, templates, makeId = () => crypto.randomUUID()) {
    const doc = normalizePacking(raw), memory = normalizePackingMemory(templates), items = [...doc.items];
    const present = new Set(items.map((i) => i.templateId));
    for (const template of memory) {
      if (present.has(template.id)) continue;
      let parentId;
      if (template.parentLabel) {
        parentId = items.find((i) => i.kind === "group" && i.section === template.section && labelKey(i.text) === labelKey(template.parentLabel))?.id;
        if (!parentId) {
          parentId = makeId();
          items.push({ id: parentId, kind: "group", section: template.section, text: template.parentLabel, quantity: 1, done: false, source: "manual" });
        }
      }
      items.push({ id: makeId(), section: template.section, text: template.text, quantity: template.quantity, done: false, source: "manual", templateId: template.id, remember: true, ...parentId ? { parentId } : {}, ...template.updatedAt ? { templateAt: template.updatedAt } : {} });
      present.add(template.id);
    }
    return normalizePacking({ ...doc, hierarchyVersion: 1, items: noExtraDuplicates(items, new Set(doc.removedKeys)) });
  }
  function packingText(raw) {
    if (raw == null) return "";
    const doc = normalizePacking(raw), c = doc.config;
    const rows = [`# Сборы${c.destination ? " · " + c.destination : ""}`, `${c.days} дн.${c.startOn ? " · " + c.startOn : ""}${c.endOn ? " — " + c.endOn : ""}`];
    const line = (i, indent = "") => `${indent}- ${i.kind === "group" ? "**" + i.text + "**" : "[ ] " + (i.quantity > 1 ? i.quantity + " × " : "") + i.text}${i.note ? " — " + i.note : ""}`;
    for (const group of PACKING_SECTIONS) {
      const items = doc.items.filter((i) => i.section === group.id);
      if (!items.length) continue;
      rows.push("", `## ${group.label}`);
      for (const item of items.filter((i) => !i.parentId)) {
        rows.push(line(item));
        if (item.kind === "group") rows.push(...items.filter((i) => i.parentId === item.id).map((i) => line(i, "  ")));
      }
    }
    return rows.join("\n");
  }
  return __toCommonJS(packing_core_exports);
})();
