let write;
let resolveId;
let current = null;
let revision = 0;

export const libraryScreens = ['saved', 'savedCat', 'note', 'list', 'recipe', 'mat', 'prod', 'film', 'reco', 'marathon', 'marnew'];

export function connectLibrary(commit, resolve) {
  write = commit;
  resolveId = resolve;
}

export function setLibrary(snapshot) {
  if (!snapshot || !current) revision++;
  current = snapshot;
}

export const libraryReady = () => !!current;
export const libraryLease = () => revision;
export const rowId = id => encodeURIComponent(id);
export const fromRow = id => decodeURIComponent(id);
export const newId = () => 'local:' + crypto.randomUUID();
export const titleOf = record => String(record.title || record.name || '').trim() || 'Без названия';
export const parseLines = value => String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
export const palette = ['#bd8152', '#40213e'];
export const safeURL = value => {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
};
export const svgImage = svg => /^\s*<svg[\s>]/i.test(svg || '') ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) : '';
export const getCollection = (snapshot, kind) => kind === 'notes' ? snapshot?.notes : snapshot?.saved?.[kind];
export const records = kind => getCollection(current, kind) || [];
export const record = (kind, id) => records(kind).find(row => row.id === id);

export async function saveRecord(kind, id, change, { create = false, remove = false } = {}) {
  if (!current || !write) return false;
  const lease = revision;
  let found = false;
  const ok = await write(next => {
    const list = getCollection(next, kind);
    const index = list.findIndex(row => row.id === id || row.id === resolveId(id));
    found = index >= 0 || create;
    if (remove && index >= 0) list.splice(index, 1);
    else if (index >= 0) change(list[index]);
    else if (create) {
      const row = { id };
      change(row);
      list.unshift(row);
    }
  });
  return ok && found && lease === revision ? resolveId(id) : false;
}

export function refreshLibraryScreen(id) {
  if (!current || curId() !== id) return;
  const screen = $('.screen[data-s="' + id + '"]');
  const scroll = screen.scrollTop;
  paint(id);
  screen.scrollTop = scroll;
}

export function openExternal(value) {
  const url = safeURL(value);
  if (!url) return false;
  if (window.Telegram?.WebApp?.initData) window.Telegram.WebApp.openLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

