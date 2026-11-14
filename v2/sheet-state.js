// Sheet drafts stay in memory only; never persist vault/document fields.
let sheetViewState = null;
let sheetReturnTarget = null;
const sheetDiscardApproved = new WeakSet();
// A new DOM defaultValue after visiting details is not a saved task.
const taskDraftBaselines = new WeakMap();
function registerTaskDraft(owner, values) {
  const previous = taskDraftBaselines.get(owner);
  taskDraftBaselines.set(owner, { initial: previous?.initial || { ...values }, current: { ...values } });
}
function taskDraftHasChanges(owner = ui.sheet) {
  const snapshot = owner && taskDraftBaselines.get(owner);
  if (!snapshot) return false;
  const current = { ...snapshot.current, ...owner.draft };
  const form = document.getElementById('entry-form');
  if (form) Object.assign(current, Object.fromEntries(new FormData(form).entries()));
  return Object.keys(snapshot.initial).some(key => String(current[key] ?? '') !== String(snapshot.initial[key] ?? ''));
}
function activeSheet() {
  return [...document.querySelectorAll('.sheet[aria-modal="true"]')].filter(n => n.getClientRects().length).at(-1) || null;
}
function sheetOwner(node) {
  if (!node) return null;
  if (node.closest('.sp-backdrop')) return ui.sp?.sheet || null;
  if (node.closest('.sl-backdrop')) return ui.sl?.sheet || null;
  return ui.sheet || node;
}
function sheetFieldRows(node) {
  return [...node.querySelectorAll('form input:not([type="file"]):not([type="hidden"]), form textarea, form select')].map((el, i) => {
    const check = el.type === 'checkbox' || el.type === 'radio';
    const base = el.tagName === 'SELECT' ? [...el.options].map(o => o.defaultSelected ? o.value : '').join('|') : check ? el.defaultChecked : el.defaultValue;
    return { key: `${el.form?.id || ''}${el.form?.dataset?.stateKey ? ':' + el.form.dataset.stateKey : ''}|${el.name || el.id || i}|${el.type}|${i}`, base,
      value: el.tagName === 'SELECT' && el.multiple ? [...el.selectedOptions].map(o => o.value) : check ? el.checked : el.value,
      start: el.selectionStart, end: el.selectionEnd, el };
  });
}
function sheetHasChanges(node = activeSheet()) {
  if (!node) return false;
  if (taskDraftHasChanges(sheetOwner(node))) return true;
  if (typeof universeSheetDirty === "function" && universeSheetDirty()) return true;
  if (typeof packingSheetDirty === "function" && packingSheetDirty()) return true;
  return sheetFieldRows(node).some(row => {
    const el = row.el;
    if (el.tagName === 'SELECT') {
      const defaults = [...el.options].filter(o => o.defaultSelected).map(o => o.value);
      if (!defaults.length && el.options.length && !el.multiple) defaults.push(el.options[0].value);
      return JSON.stringify(el.multiple ? row.value : [row.value]) !== JSON.stringify(defaults);
    }
    return row.value !== row.base;
  });
}
function confirmSheetDiscard(node = activeSheet()) {
  const owner = sheetOwner(node);
  if (!owner || sheetDiscardApproved.has(owner) || !sheetHasChanges(node)) return true;
  if (!window.confirm('Закрыть без сохранения? Введённые изменения будут потеряны.')) return false;
  sheetDiscardApproved.add(owner);
  return true;
}
function sheetFocusTarget(el) {
  if (!el || el === document.body || el.closest?.('.sheet')) return null;
  const attrs = ['id', 'data-action', 'data-id', 'data-page', 'data-tab', 'data-section', 'data-cmd', 'data-kind', 'data-key', 'data-then', 'data-entity', 'data-mode', 'data-target', 'data-value', 'data-index'];
  const selector = attrs.filter(a => el.hasAttribute?.(a)).map(a => `[${a}="${CSS.escape(el.getAttribute(a))}"]`).join('');
  return { el, selector };
}
function sheetDisclosures(node) {
  return [...node.querySelectorAll('details')].filter(el => el.tagName === 'DETAILS').map((el, index) => ({ el, key: el.id || el.dataset.stateKey || String(index), open: el.open }));
}
function captureSheetState() {
  const node = activeSheet();
  if (!node) sheetReturnTarget = sheetFocusTarget(document.activeElement) || sheetReturnTarget;
  if (!sheetViewState || sheetViewState.node !== node) return;
  sheetViewState.rows = sheetFieldRows(node);
  sheetViewState.disclosures = sheetDisclosures(node);
  sheetViewState.focus = node.contains(document.activeElement) ? sheetViewState.rows.find(r => r.el === document.activeElement)?.key : null;
}
function restoreSheetState() {
  const node = activeSheet(), owner = sheetOwner(node), previous = sheetViewState;
  if (!node) {
    if (previous) {
      const target = previous.returnTo;
      const el = target?.el?.isConnected ? target.el : target?.selector ? document.querySelector(target.selector) : null;
      el?.focus({ preventScroll: true });
    }
    sheetViewState = null;
    return;
  }
  const same = previous?.owner === owner;
  if (same && previous.node !== node) {
    const disclosureState = new Map((previous.disclosures || []).map(item => [item.key, item.open]));
    for (const item of sheetDisclosures(node)) if (disclosureState.has(item.key)) item.el.open = disclosureState.get(item.key);
    const old = new Map(previous.rows.map(r => [r.key, r]));
    for (const row of sheetFieldRows(node)) {
      const saved = old.get(row.key);
      // Respect a deliberate model update (e.g. a chosen preset).
      if (!saved || saved.base !== row.base) continue;
      if (row.el.type === 'checkbox' || row.el.type === 'radio') row.el.checked = saved.value;
      else if (row.el.tagName === 'SELECT' && row.el.multiple) [...row.el.options].forEach(o => o.selected = saved.value.includes(o.value));
      else row.el.value = saved.value;
      if (previous.focus === row.key) {
        row.el.focus({ preventScroll: true });
        if (saved.start !== null) try { row.el.setSelectionRange(saved.start, saved.end); } catch {}
      }
    }
  }
  sheetViewState = { owner, node, rows: sheetFieldRows(node), disclosures: sheetDisclosures(node), returnTo: same ? previous.returnTo : sheetReturnTarget };
  if (!same) {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const first = !coarse ? node.querySelector('[autofocus], input:not([type="hidden"]), textarea') : null;
    const focus = first || node.querySelector('button') || node;
    if (focus === node) node.tabIndex = -1;
    focus.focus({ preventScroll: true });
  }
  if (ui.sheet) ui.sheet.justRendered = true;
}
function closeActiveSheet(node = activeSheet()) {
  if (!node) return;
  const close = node.querySelector('[data-action="sp-close"], [data-action="sl-close"]');
  if (close) close.click(); else closeSheet();
}
document.addEventListener('keydown', event => {
  // The shared star can work with a note without dismissing its underlying sheet.
  if (window.flowAssistant?.getState?.().open) return;
  if (window.flowPickers?.isOpen()) {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation();
      window.flowPickers.cancel();
    }
    return;
  }
  const node = activeSheet();
  if (!node) return;
  if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeActiveSheet(node); return; }
  if (event.key !== 'Tab') return;
  const items = [...node.querySelectorAll('button, input:not([type="hidden"]), textarea, select, a[href], [tabindex]')].filter(n => !n.disabled && n.tabIndex >= 0 && n.getClientRects().length);
  if (!items.length) { event.preventDefault(); node.focus(); return; }
  const first = items[0], last = items.at(-1), active = document.activeElement;
  if (!node.contains(active) || (!event.shiftKey && active === last)) { event.preventDefault(); first.focus(); }
  else if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
}, true);
