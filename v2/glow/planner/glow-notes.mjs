import './note-ink.js';
import { noteEditableHtml, noteSerialize } from './note-format.mjs';

const noteInk = window.flowNoteInk;
const prototypeList = notesList;
const prototypeEditor = R.note;
const prototypeGo = go;
const prototypePop = pop;
const prototypeHeadAction = $('#hAct').onclick;
const prototypePlaceEnd = placeEnd;
const updateLabel = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' });

let records = null;
let folders = [];
let filter = null;
let draft = null;
let writeNote;
let canonicalId;

export function connectNoteWrites(write, resolveId) {
  writeNote = write;
  canonicalId = resolveId;
}

function renderedBody(description) {
  const template = document.createElement('template');
  template.innerHTML = noteEditableHtml(description);
  for (const image of $$('img', template.content)) {
    const src = image.getAttribute('src');
    if (/^https?:\/\//i.test(src) || /^data:image\/(?:png|jpeg|webp|gif|avif);base64,/i.test(src)) continue;
    image.closest('figure').replaceWith(document.createTextNode(`![${image.alt}](${src})`));
  }
  return template.innerHTML;
}

function noteRow(record) {
  const stamp = new Date(record.updated ?? record.created ?? NaN);
  return { id: encodeURIComponent(record.id), t: record.title || '', sec: esc2(record.topic || 'Без папки'),
    topic: record.topic || '', pin: Boolean(record.pinned),
    upd: Number.isFinite(+stamp) ? updateLabel.format(stamp) : '', html: renderedBody(record.description) };
}

export function adoptNotes(snapshot) {
  NOTES.length = 0;
  if (!snapshot) {
    const closeEditor = draft && curId() === 'note';
    records = null;
    folders = [];
    filter = null;
    S.nq = '';
    draft = null;
    if (closeEditor) prototypePop();
    return;
  }
  const notes = snapshot.notes.filter(record => !record.packing);
  records = new Map(notes.map(record => [String(record.id), record]));
  folders = [...new Set([...(snapshot.savedSections?.notes || []).map(item => item.name),
    ...notes.map(record => record.topic)].filter(Boolean))];
  if (filter && !folders.includes(filter)) filter = null;
  NOTES.push(...notes.map(noteRow));
}

notesGrid = () => {
  const query = S.nq.trim().toLocaleLowerCase('ru');
  const rows = NOTES.filter(note => !note.unsaved && (filter === null || note.topic === filter) &&
    `${note.t} ${noteText(note.html)}`.toLocaleLowerCase('ru').includes(query));
  rows.sort((a, b) => Number(b.pin) - Number(a.pin));
  return rows.length ? rows.map(noteCard).join('') : '<div class="glass empty in" style="column-span:all">Ничего не нашлось</div>';
};

notesList = () => {
  const template = document.createElement('template');
  template.innerHTML = prototypeList();
  const chips = $('.nsec', template.content);
  chips.replaceChildren(...[null, ...folders].map((folder, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `chip${filter === folder ? ' on' : ''}`;
    button.dataset.noteFolder = index;
    button.setAttribute('aria-pressed', String(filter === folder));
    button.textContent = folder ?? 'Все';
    return button;
  }));
  return template.innerHTML;
};

bindNotes = screen => {
  const grid = $('#ngrid', screen);
  const refresh = () => { grid.innerHTML = notesGrid(); stagger(grid); };
  $('#nq', screen).oninput = event => { S.nq = event.target.value; refresh(); };
  grid.onclick = event => {
    const button = event.target.closest('[data-note]');
    if (button) openSavedNote(decodeURIComponent(button.dataset.note));
  };
  for (const button of $$('[data-note-folder]', screen)) {
    button.onclick = () => {
      filter = [null, ...folders][Number(button.dataset.noteFolder)] ?? null;
      for (const chip of $$('[data-note-folder]', screen)) {
        chip.classList.toggle('on', chip === button);
        chip.setAttribute('aria-pressed', String(chip === button));
      }
      refresh();
    };
  }
  $('[data-newnote]', screen).onclick = () => openSavedNote();
};

export function openSavedNote(id) {
  if (!records || draft) return;
  const existing = id == null ? null : records.get(String(id));
  if (id != null && !existing) { toast('Заметка недоступна'); return; }
  const record = existing || { id: crypto.randomUUID(), title: '', description: '', topic: filter || '', pinned: false };
  const row = noteRow(record);
  if (!existing) NOTES.push({ ...row, unsaved: true });
  const opened = { record, topic: record.topic || '', pending: false, isNew: !existing };
  draft = opened;
  S.cat = 'notes';
  S.note = row.id;
  prototypeGo('note');
  if (!existing) setTimeout(() => {
    if (draft === opened && curId() === 'note' && !opened.title.closest('.note-ed').contains(document.activeElement)) kbFocus(opened.title);
  }, 620);
}

R.note = () => draft && noteById(S.note) ? prototypeEditor() : '';

const prototypeBindNote = bindNote;
bindNote = screen => {
  if (!draft || !$('#nb', screen)) return;
  prototypeBindNote(screen);
  const opened = draft;
  opened.title = $('#nt', screen);
  opened.title.maxLength = 200;
  opened.body = $('#nb', screen);
  opened.ink = noteInk.mount(opened.body);
  opened.serialized = serialize(opened.body);
  const folder = $('#nsecBtn', screen);
  folder.onclick = () => {
    const options = ['', ...folders];
    opened.topic = options[(options.indexOf(opened.topic) + 1) % options.length];
    const label = opened.topic || 'Без папки';
    folder.textContent = label;
    folder.setAttribute('aria-label', `Раздел: ${label}`);
  };
  opened.body.addEventListener('paste', event => {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain');
    if (text) document.execCommand('insertText', false, text);
  });
  opened.body.addEventListener('drop', event => event.preventDefault());
};

placeEnd = node => {
  if (node !== draft?.body) { prototypePlaceEnd(node); return; }
  const last = [...node.children].findLast(child => !child.matches('.note-ink-data, .note-ink-layer')) || node;
  const range = document.createRange();
  if (last.matches('figure, table, [contenteditable="false"]')) range.setStartAfter(last);
  else { range.selectNodeContents(last); range.collapse(false); }
  getSelection().removeAllRanges();
  getSelection().addRange(range);
};

function serialize(body) {
  for (const item of $$('.checks li[data-done]', body)) item.dataset.done = '1';
  return noteSerialize(body);
}

function setPen(opened, active) {
  opened.ink.activate(active);
  phone.classList.toggle('inking', active);
  const button = $('#ntool [data-cmd="pen"]');
  button.classList.toggle('on', active);
  button.setAttribute('aria-pressed', String(active));
}

async function saveDraft(opened, pinned) {
  if (!opened?.body || opened.pending || !records) return false;
  const normalized = serialize(opened.body);
  const description = normalized === opened.serialized ? opened.record.description || '' : normalized;
  const text = noteInk.unpack(description).body;
  const enteredTitle = opened.title.value.trim();
  if (opened.isNew && !enteredTitle && !text.trim() && !noteInk.strokes(opened.body).length) {
    if (pinned !== undefined) { toast('Добавь текст заметки'); return false; }
    return true;
  }
  if (description.length > 50_000) { toast('Заметка превышает 50 000 символов'); return false; }
  const title = enteredTitle || text.split('\n').find(line => line.trim())?.trim().replace(/^#+\s*|^[-*]\s+(\[[ x]\]\s+)?/i, '').slice(0, 80) || 'Заметка';
  const patch = {};
  if (opened.isNew || enteredTitle !== (opened.record.title || '').trim()) patch.title = title;
  if (opened.isNew || description !== (opened.record.description || '')) patch.description = description;
  if (opened.isNew || opened.topic !== (opened.record.topic || '')) {
    patch.topic = opened.topic;
    patch.categoryId = null;
  }
  if (pinned !== undefined) patch.pinned = pinned;
  if (!Object.keys(patch).length) return true;

  const id = opened.record.id;
  const editor = opened.body.closest('.note-ed');
  const toolbar = $('#ntool');
  opened.pending = true;
  editor.inert = toolbar.inert = true;
  try {
    const ok = await writeNote(next => {
      const current = next.notes.find(note => String(note.id) === String(id));
      if (current) Object.assign(current, patch);
      else if (opened.isNew) next.notes.push({ id, pinned: false, tags: [], ...patch });
      else throw Error('note_missing');
    });
    if (!ok || draft !== opened) return false;
    const acknowledged = records.get(String(canonicalId(id)));
    if (!acknowledged) { toast('Сервер не вернул заметку'); return false; }
    opened.record = acknowledged;
    opened.isNew = false;
    opened.title.value = acknowledged.title || '';
    opened.serialized = normalized;
    S.note = encodeURIComponent(acknowledged.id);
    setHead('note', 0);
    toast(pinned === undefined ? 'Заметка сохранена' : pinned ? 'Заметка закреплена' : 'Заметка откреплена');
    return true;
  } finally {
    opened.pending = false;
    editor.inert = toolbar.inert = false;
  }
}

async function leaveNote(navigate) {
  const opened = draft;
  if (!opened) { navigate(); return; }
  if (!await saveDraft(opened) || draft !== opened) return;
  setPen(opened, false);
  const blank = NOTES.findIndex(note => note.unsaved && note.id === S.note);
  if (blank >= 0) NOTES.splice(blank, 1);
  draft = null;
  navigate();
}

go = id => {
  if (id === 'note') { if (!draft) openSavedNote(); return; }
  if (curId() === 'note') { void leaveNote(() => prototypeGo(id)); return; }
  return prototypeGo(id);
};
pop = () => curId() === 'note' ? void leaveNote(prototypePop) : prototypePop();
$('#back').onclick = () => pop();
$('#hAct').onclick = () => {
  if (curId() !== 'note') { prototypeHeadAction(); return; }
  if (draft) void saveDraft(draft, !draft.record.pinned);
};

document.addEventListener('keydown', event => {
  if (!draft || curId() !== 'note') return;
  if (event.key === 'Escape') { event.preventDefault(); pop(); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    void saveDraft(draft);
  }
});

$('#ntool').addEventListener('click', event => {
  const button = event.target.closest('[data-cmd]');
  if (!draft || !button || curId() !== 'note') return;
  const command = button.dataset.cmd;
  if (command === 'pen') {
    event.stopImmediatePropagation();
    setPen(draft, !draft.ink.active);
  } else if (draft.ink.active && ['undo', 'redo'].includes(command)) {
    event.stopImmediatePropagation();
    draft.ink.history(command === 'redo');
  } else if (command === 'img') {
    event.stopImmediatePropagation();
    if (draft.pending || draft.uploading) return;
    setPen(draft, false);
    pictureInput.opened = draft;
    pictureInput.value = '';
    pictureInput.click();
  } else if (draft.ink.active) setPen(draft, false);
}, true);

const pictureInput = document.createElement('input');
pictureInput.type = 'file';
pictureInput.accept = 'image/jpeg,image/png,image/webp';
pictureInput.hidden = true;
document.body.append(pictureInput);
pictureInput.onchange = async () => {
  const file = pictureInput.files[0];
  const opened = pictureInput.opened;
  pictureInput.opened = null;
  if (!file || opened !== draft) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024) {
    toast('Выберите PNG, JPEG или WebP до 6 МБ');
    return;
  }
  opened.uploading = true;
  try {
    const bytes = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',', 2)[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    if (draft !== opened) return;
    const url = await window.sorokaUploadNoteImage(bytes, file.type);
    if (draft !== opened || !/^https?:\/\//i.test(url)) return;
    const figure = document.createElement('figure');
    figure.className = 'note-image';
    figure.contentEditable = 'false';
    const image = document.createElement('img');
    image.src = url;
    image.alt = '';
    figure.append(image);
    const paragraph = document.createElement('p');
    paragraph.append(document.createElement('br'));
    const layer = $('.note-ink-layer, .note-ink-data', opened.body);
    opened.body.insertBefore(figure, layer);
    opened.body.insertBefore(paragraph, layer);
    opened.body.dispatchEvent(new Event('input', { bubbles: true }));
  } catch {
    if (draft === opened) toast('Не удалось загрузить изображение');
  } finally { opened.uploading = false; }
};

const improveStyles = ['fix', 'short', 'detail', 'plain', 'formal', 'friendly', 'structure', 'english'];
$('#imenu').addEventListener('click', async event => {
  const button = event.target.closest('[data-im]');
  const opened = draft;
  if (!button || !opened || curId() !== 'note') return;
  event.stopImmediatePropagation();
  imenu(false);
  if (opened.improving || opened.pending) return;
  const scope = getSelection();
  const selection = scope.rangeCount && !scope.isCollapsed && opened.body.contains(scope.getRangeAt(0).commonAncestorContainer)
    ? scope.getRangeAt(0).cloneRange() : null;
  const original = serialize(opened.body);
  const text = selection?.toString() || noteInk.unpack(original).body;
  if (!text.trim()) { toast('Введите текст заметки'); return; }
  if (text.length > 12000) { toast('Выделите фрагмент до 12 000 символов'); return; }
  const mode = improveStyles[$$('[data-im]', $('#imenu')).indexOf(button)];
  const star = $('.nstar', $('#ntool'));
  opened.improving = true;
  star.setAttribute('aria-busy', 'true');
  try {
    const result = await window.sorokaImproveNote(text, mode);
    if (draft !== opened) return;
    if (serialize(opened.body) !== original) { toast('Текст изменился. Запустите улучшение ещё раз'); return; }
    const template = document.createElement('template');
    template.innerHTML = renderedBody(result);
    if (selection && opened.body.contains(selection.commonAncestorContainer)) {
      selection.deleteContents();
      selection.insertNode(template.content);
      scope.removeAllRanges();
    } else {
      const currentImages = $$('figure.note-image', opened.body);
      const newImages = new Set($$('img', template.content).map(image => image.src));
      for (const figure of currentImages) {
        if (!newImages.has($('img', figure)?.src)) template.content.append(figure.cloneNode(true));
      }
      const ink = $$('.note-ink-layer, .note-ink-data', opened.body);
      opened.body.replaceChildren(template.content, ...ink);
    }
    opened.body.dispatchEvent(new Event('input', { bubbles: true }));
    toast('Текст обновлён');
  } catch { if (draft === opened) toast('Не удалось улучшить текст'); }
  finally { opened.improving = false; star.removeAttribute('aria-busy'); }
}, true);

const style = document.createElement('style');
style.textContent = `
  #nb { position: relative; }
  #nb .note-ink-layer { position: absolute; inset: 0; width: 100%; pointer-events: none; }
  #nb[data-inking="true"] .note-ink-layer { pointer-events: auto; touch-action: none; }
  #ink { pointer-events: none; }
  .nwrap > .note-ink-tools { display: none; }
  #nb .note-image { margin: 10px 0; }
  #nb .note-image img { display: block; max-width: 100%; border-radius: 16px; }
`;
document.head.append(style);
