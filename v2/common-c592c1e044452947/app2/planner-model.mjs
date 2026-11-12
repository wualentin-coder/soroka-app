// Extracted from app2/bridge.js prepare/collections/diff/applyChanges.
// No transport, credentials, storage or UI. The caller owns the canonical raw snapshot.
const copy = value => JSON.parse(JSON.stringify(value));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const savedKeys = ['notes', 'recipes', 'movies', 'files', 'posts', 'links', 'lists', 'products', 'tickets', 'addresses'];
const savedCollections = ['cards', 'files', 'posts', 'links', 'lists', 'recipes', 'movies', 'products', 'tickets', 'addresses'];
const financeCollections = ['accounts', 'transactions', 'transfers', 'budgets', 'goals', 'debts', 'payments'];
const icons = { notes: 'note', recipes: 'bookmark', movies: 'event', files: 'archive', posts: 'note', links: 'link', lists: 'check', products: 'wallet', tickets: 'ticket' };
const colors = ['#8dbbb4', '#ba9ad9', '#8ba9df', '#d8a572', '#d9949e'];

export const PLANNER_COL_OF_KIND = Object.freeze({
  task: 'tasks', event: 'events', note: 'notes', link: 'saved.links', movie: 'saved.movies', recipe: 'saved.recipes',
  list: 'saved.lists', product: 'saved.products', place: 'saved.addresses', metric: 'metrics', tx: 'finance.transactions',
  debt: 'finance.debts', budget: 'finance.budgets', goal: 'finance.goals', payment: 'finance.payments', project: 'projects',
});

function invalid(path) { throw new TypeError(`planner_full_snapshot_required:${path}`); }
function records(value, path) {
  if (!Array.isArray(value)) invalid(path);
  const ids = new Set();
  for (const record of value) {
    if (!object(record) || !Object.hasOwn(record, 'id') ||
      !(typeof record.id === 'string' && record.id.length > 0 || Number.isSafeInteger(record.id))) invalid(path);
    const id = String(record.id);
    if (ids.has(id)) invalid(path + ':duplicate_id');
    ids.add(id);
  }
}

/** A delta/error/partial payload must be expanded by the runtime before projection.
 * Required collection names are the full native planner.ts snapshot, not fixture defaults.
 */
export function validateFullPlannerSnapshot(snapshot) {
  if (!object(snapshot) || snapshot.__partial === true) invalid('snapshot');
  for (const key of ['tasks', 'events', 'notes', 'inbox', 'projects', 'metrics']) records(snapshot[key], key);
  if (!Array.isArray(snapshot.trash) || !snapshot.trash.every(object)) invalid('trash');
  if (!object(snapshot.saved)) invalid('saved');
  for (const key of savedCollections) records(snapshot.saved[key], 'saved.' + key);
  // Native diff also includes newly introduced saved collections; retain and validate them.
  for (const [key, value] of Object.entries(snapshot.saved)) if (!savedCollections.includes(key)) records(value, 'saved.' + key);
  if (!object(snapshot.finance)) invalid('finance');
  for (const key of financeCollections) records(snapshot.finance[key], 'finance.' + key);
  if (!Array.isArray(snapshot.finance.rules)) invalid('finance.rules');
  if (!object(snapshot.settings)) invalid('settings');
  if (snapshot.savedSections != null) {
    if (!object(snapshot.savedSections)) invalid('savedSections');
    for (const key of savedKeys) if (snapshot.savedSections[key] != null &&
      (!Array.isArray(snapshot.savedSections[key]) || !snapshot.savedSections[key].every(section => object(section) && typeof section.name === 'string'))) invalid('savedSections.' + key);
  }
  if (snapshot.mapCategories != null && (!Array.isArray(snapshot.mapCategories) ||
    !snapshot.mapCategories.every(category => object(category) && typeof category.name === 'string'))) invalid('mapCategories');
}

function sectionId(key, name) {
  let h = 0;
  for (const ch of `${key}:${name.toLowerCase()}`) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return `s${h.toString(36)}`;
}

/** Native presentation projection. Unknown fields inside records are retained.
 * Unknown top-level raw snapshot fields remain the caller's responsibility, as in bridge.prepare.
 * Clone before enriching sections/addresses: neither snapshot nor injected history is mutated.
 */
export function prepareSnapshot(snapshot, { searchHistory = [] } = {}) {
  validateFullPlannerSnapshot(snapshot);
  const source = copy(snapshot), sections = source.savedSections || {}, savedSections = {};
  for (const key of savedKeys) savedSections[key] = Array.isArray(sections[key]) ? sections[key] : [];
  const value = {
    timezone: source.timezone,
    tasks: source.tasks, events: source.events, notes: source.notes, inbox: source.inbox,
    saved: source.saved, finance: source.finance, projects: source.projects, metrics: source.metrics,
    trash: source.trash, settings: source.settings, savedSections,
    searchHistory: copy(searchHistory), vault: [],
  };
  const items = key => key === 'notes' ? value.notes.filter(item => !item.packing) : key === 'lists' ? [...(value.saved.lists || []), ...value.notes.filter(item => item.packing)] : (value.saved[key] || []);
  for (const key of savedKeys) {
    if (key === 'addresses') continue;
    const list = savedSections[key];
    for (const item of items(key) || []) {
      const name = String(item.topic || '').trim();
      if (!name || list.some(section => section.name.toLowerCase() === name.toLowerCase())) continue;
      list.push({ id: sectionId(key, name), name, icon: icons[key] || 'bookmark', color: colors[list.length % colors.length], sortOrder: list.length });
    }
  }
  if (Array.isArray(source.mapCategories)) value.mapCategories = source.mapCategories;
  const places = value.saved.addresses || [];
  if (places.some(place => place.topic)) {
    const categories = value.mapCategories || (value.mapCategories = []);
    for (const place of places) {
      const name = String(place.topic || '').trim();
      if (!name) continue;
      let category = categories.find(item => item.name.toLowerCase() === name.toLowerCase());
      if (!category) { category = { id: sectionId('map', name), name, icon: 'pin', color: colors[categories.length % colors.length], sortOrder: categories.length }; categories.push(category); }
      place.categoryId = category.id;
    }
  }
  return value;
}

/** Returns native collection references, in the same order as bridge.collections. */
export function plannerCollections(data) {
  const out = [['tasks', data.tasks], ['events', data.events], ['notes', data.notes], ['inbox', data.inbox], ['projects', data.projects], ['metrics', data.metrics]];
  for (const key of Object.keys(data.saved || {})) out.push([`saved.${key}`, data.saved[key]]);
  for (const key of financeCollections) out.push([`finance.${key}`, (data.finance || {})[key]]);
  return out;
}

export function plannerSectionOf(data, col, record) {
  if (!record || !record.categoryId) return undefined;
  const key = col === 'notes' ? 'notes' : col.startsWith('saved.') ? col.slice(6) : '';
  const list = key === 'addresses' ? data.mapCategories : (data.savedSections || {})[key];
  const found = (list || []).find(section => section.id === record.categoryId);
  return found ? found.name : undefined;
}

/** Same wire operations as bridge.diff; the result owns its record copies. */
export function plannerDiff(before, after) {
  const changes = [], was = new Map(plannerCollections(before).map(([col, items]) => [col, items || []]));
  for (const [col, items] of plannerCollections(after)) {
    const old = new Map((was.get(col) || []).map(record => [String(record.id), record]));
    const now = new Map((items || []).map(record => [String(record.id), record]));
    for (const [id, record] of now) {
      const previous = old.get(id);
      if (!previous) changes.push({ op: 'create', col, id, rec: record, section: plannerSectionOf(after, col, record) });
      else if (JSON.stringify(previous) !== JSON.stringify(record)) changes.push({ op: 'update', col, id, rec: record, prev: previous, section: plannerSectionOf(after, col, record) });
    }
    for (const id of old.keys()) if (!now.has(id)) changes.push({ op: 'delete', col, id });
  }
  const present = new Set(plannerCollections(after).flatMap(([, items]) => (items || []).map(record => String(record.id))));
  const trashNow = new Set((after.trash || []).map(entry => entry.id));
  for (const entry of before.trash || []) {
    if (trashNow.has(entry.id)) continue;
    const itemId = String(entry.item && entry.item.id || '');
    if (!present.has(itemId) && /^[a-z]+:\d+$/.test(itemId)) changes.push({ op: 'purge', col: PLANNER_COL_OF_KIND[itemId.split(':')[0]] || 'tasks', id: itemId });
  }
  if (JSON.stringify((before.finance || {}).rules) !== JSON.stringify((after.finance || {}).rules)) changes.push({ op: 'replace', col: 'finance.rules', rec: { list: (after.finance || {}).rules || [] } });
  const appState = data => JSON.stringify([data.savedSections, data.mapCategories, data.settings]);
  if (appState(before) !== appState(after)) changes.push({ op: 'replace', col: 'app', rec: { savedSections: after.savedSections, mapCategories: after.mapCategories, settings: after.settings } });
  // Keep undefined optional wire properties like native diff, while detaching nested records.
  return changes.map(change => ({ ...change, ...(change.rec ? { rec: copy(change.rec) } : {}), ...(change.prev ? { prev: copy(change.prev) } : {}) }));
}

/** Replays native changes into the caller's disposable data clone; never edits changes/ids.
 * ID mapping is exact and only at record.id, matching the existing native replay contract.
 */
export function applyPlannerChanges(data, changes, ids = {}) {
  const map = id => ids[id] || id, lists = new Map(plannerCollections(data));
  for (const original of changes) {
    const change = copy(original);
    if (change.op === 'replace') {
      if (change.col === 'finance.rules') data.finance.rules = change.rec.list;
      if (change.col === 'app') Object.assign(data, { savedSections: change.rec.savedSections, mapCategories: change.rec.mapCategories, settings: change.rec.settings });
      continue;
    }
    const list = lists.get(change.col);
    if (!list) continue;
    const at = list.findIndex(record => String(record.id) === map(change.id));
    if (change.op === 'delete' || change.op === 'purge') { if (at >= 0) list.splice(at, 1); continue; }
    const record = { ...change.rec, id: map(change.id) };
    if (at >= 0) list[at] = record; else list.push(record);
  }
}
