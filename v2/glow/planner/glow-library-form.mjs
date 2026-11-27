import { libraryLease, newId, parseLines, refreshLibraryScreen, safeURL, saveRecord } from './glow-library-store.mjs';

const schemas = {
  lists: [],
  recipes: [['description', 'Описание', 'area'], ['ingredients', 'Ингредиенты по одному на строку', 'lines'], ['steps', 'Шаги по одному на строку', 'lines'],
    ['minutes', 'Минуты', 'number'], ['servings', 'Порций', 'number']],
  links: [['url', 'Ссылка', 'url'], ['description', 'Краткое описание', 'area'], ['topic', 'Папка']],
  posts: [['body', 'Текст', 'area'], ['summary', 'Краткое описание', 'area'], ['topic', 'Папка']],
  files: [['description', 'Описание', 'area'], ['topic', 'Папка']],
  movies: [['kind', 'Вид', { movie: 'Фильм', series: 'Сериал' }], ['year', 'Год', 'number'], ['genre', 'Жанр'], ['where', 'Где смотреть'],
    ['kinopoiskUrl', 'Ссылка на Кинопоиск', 'url'], ['imdbUrl', 'Ссылка на IMDb', 'url'], ['description', 'Описание', 'area']],
  products: [['url', 'Ссылка на товар', 'url'], ['store', 'Магазин'], ['price', 'Цена, ₽', 'number'], ['targetPrice', 'Желаемая цена, ₽', 'number'], ['description', 'Заметка', 'area']],
  addresses: [['address', 'Адрес'], ['city', 'Город'], ['topic', 'Категория'], ['entrance', 'Подъезд'], ['floor', 'Этаж'],
    ['apartment', 'Квартира'], ['intercom', 'Домофон'], ['lat', 'Широта', 'coordinate'], ['lng', 'Долгота', 'coordinate'], ['description', 'Заметка', 'area']],
  tickets: [['ticketType', 'Вид', { event: 'Мероприятие', train: 'Поезд', flight: 'Самолёт' }], ['eventDate', 'Дата', 'date'],
    ['eventTime', 'Время', 'time'], ['venue', 'Место'], ['origin', 'Откуда'], ['destination', 'Куда'], ['carrier', 'Перевозчик']],
  cards: [['number', 'Номер карты'], ['format', 'Вид кода', { EAN13: 'EAN-13', Code128: 'Code 128', QRCode: 'QR-код' }], ['code', 'Данные в коде'], ['description', 'Заметка', 'area']],
};

const styles = document.createElement('style');
styles.textContent = `
  .glow-record { display:grid; gap:8px; }
  .glow-record .syq { min-height:44px; height:auto; display:grid; gap:4px; padding:7px 14px; }
  .glow-record .syq small { color:var(--muted); font-size:11px; }
  .glow-record :is(input,textarea,select) { width:100%; color:var(--text); color-scheme:dark; }
  .glow-record :is(textarea,select) { border:0; background:transparent; font:600 15px Manrope,sans-serif; }
  .glow-record select option { background:#211d25; }
  .glow-record .mact { position:sticky; bottom:0; z-index:2; margin:4px 0 0; padding:6px; flex-wrap:wrap;
    background:var(--ink, #141018); border-radius:20px; }
  .glow-record .mact .btn { flex:1 0 max-content; }
  .glow-record [data-code-fields] { display:grid; gap:8px; }
`;
document.head.append(styles);

function field([key, label, type], value = '') {
  const name = `name="${key}" aria-label="${label}"`;
  const string = esc2(Array.isArray(value) ? value.join('\n') : value ?? '');
  let input;
  if (typeof type === 'object') input = `<select ${name}>${Object.entries(type).map(([k, text]) =>
    `<option value="${k}" ${value === k ? 'selected' : ''}>${text}</option>`).join('')}</select>`;
  else if (type === 'area' || type === 'lines') input = `<textarea ${name} rows="3">${string}</textarea>`;
  else input = `<input ${name} type="${type === 'coordinate' ? 'number' : type || 'text'}"
    ${type === 'coordinate' ? 'step="any"' : type === 'number' ? 'step="1" min="0"' : ''}
    value="${string}" ${key === 'title' ? 'required' : ''} autocomplete="off">`;
  return `<label class="glass syq"><small>${label}</small>${input}</label>`;
}

const codeFields = [
  ['text', 'Номер или данные кода'], ['kind', 'Вид кода', { qr: 'QR-код', barcode: 'Штрихкод' }], ['seat', 'Место / ряд'],
];

export function openRecordEditor(kind, existing, opts = {}) {
  const schema = schemas[kind];
  if (!schema) return;
  const row = existing || {};
  const id = existing?.id || newId();
  const lease = libraryLease();
  const fields = [['title', 'Название'], ...schema];
  const isTicket = kind === 'tickets';
  const codes = row.codes?.length ? row.codes : [{}];
  const renderCode = (code, i) => '<div class="glow-record" data-code-entry>' +
    codeFields.map(([name, label, type]) => field([`code_${i}_${name}`, label, type], code[name])).join('') + '</div>';
  let index = codes.length;
  let busy = false;
  openSy(`<div class="syh">${existing ? 'Изменить' : 'Добавить'}<small>${esc2(catName(({ posts: 'links', files: 'links' })[kind] || kind))}</small></div>
    <form class="glow-record">${fields.map(f => field(f, row[f[0]])).join('')}
    ${isTicket ? `<div data-code-fields>${codes.map(renderCode).join('')}</div>
      <button class="btn glass" type="button" data-more-code>${ic.plus}Ещё код</button>
      ${row.inChat ? '<button class="btn glass" type="button" data-original-file>Прислать билет в чат</button>' : ''}` : ''}
    <div class="mact"><button class="btn main" type="submit">Сохранить</button>
    ${existing ? `<button class="btn glass" type="button" data-record-pin>${row.pinned ? 'Открепить' : 'Закрепить'}</button>
      <button class="btn glass" type="button" data-record-delete>Удалить</button>` : ''}</div></form>`, sheet => {
    const form = $('form', sheet);
    const setBusy = value => { busy = value; for (const b of $$('button', form)) b.disabled = value; };
    async function apply(change, remove) {
      if (busy || libraryLease() !== lease) return;
      setBusy(true);
      const result = await saveRecord(opts.collection || kind, id, change, { create: !existing, remove });
      if (libraryLease() !== lease || !form.isConnected) return;
      setBusy(false);
      if (!result) return;
      closeSy();
      if (remove) opts.deleted?.();
      else opts.saved?.(result);
      refreshLibraryScreen(curId());
      if (curId() !== 'list') setHead(curId(), 0);
    }
    form.onsubmit = event => {
      event.preventDefault();
      const data = new FormData(form);
      const values = {};
      for (const [key, label, type] of fields) {
        const str = String(data.get(key) || '').trim();
        if (type === 'url' && str && !safeURL(str)) { toast('Введите ссылку http или https'); return; }
        values[key] = type === 'lines' ? parseLines(str) : ['coordinate', 'number'].includes(type) ? str === '' ? null : Number(str) : str;
      }
      if (!values.title) { toast('Введите название'); return; }
      if (isTicket && !values.eventDate) { toast('Укажите дату билета'); return; }
      if (isTicket) values.codes = Array.from({ length: index }, (_, i) => ({
        ...codes[i], ...Object.fromEntries(codeFields.map(([key]) => [key, String(data.get(`code_${i}_${key}`) || '').trim()])),
      })).filter(code => code.text || code.seat);
      if (kind === 'addresses' && (values.lat === null) !== (values.lng === null)) {
        toast('Введите обе координаты'); return;
      }
      if (kind === 'addresses' && existing && (values.address !== (row.address || '') || values.city !== (row.city || '')) &&
        values.lat === (row.lat ?? null) && values.lng === (row.lng ?? null)) values.lat = values.lng = null;
      void apply(target => Object.assign(target, values));
    };
    const addCode = $('[data-more-code]', form);
    if (addCode) addCode.onclick = () => {
      if (index === 20) return;
      $('[data-code-fields]', form).insertAdjacentHTML('beforeend', renderCode({}, index++));
      addCode.disabled = index === 20;
    };
    const original = $('[data-original-file]', form);
    if (original) original.onclick = async () => {
      original.disabled = true;
      try {
        const result = await window.sorokaSendSavedFile(row.id);
        if (libraryLease() === lease && original.isConnected) toast(result?.ok ? 'Билет отправлен в чат' : 'Не удалось отправить билет');
      } catch { if (libraryLease() === lease && original.isConnected) toast('Не удалось отправить билет'); }
      finally { original.disabled = false; }
    };
    const pin = $('[data-record-pin]', form);
    if (pin) pin.onclick = () => void apply(target => { target.pinned = !row.pinned; });
    const del = $('[data-record-delete]', form);
    if (del) del.onclick = () => {
      if (del.dataset.confirm === 'yes') { void apply(() => {}, true); return; }
      del.dataset.confirm = 'yes';
      del.textContent = 'Подтвердить удаление';
    };
  });
}

