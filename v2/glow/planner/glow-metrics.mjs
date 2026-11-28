import { newId, rowId } from './glow-library-store.mjs';
import { confirmMore, moreEmpty, moreForm, moreInput, moreList, moreRow, repaintMore } from './glow-more-ui.mjs';

const seriesKey = item => JSON.stringify([String(item.title || 'Показатель').trim().toLocaleLowerCase('ru'), String(item.unit || '').trim()]);
const displayDate = date => /^\d{4}-\d\d-\d\d$/.test(date) ? date.split('-').reverse().join('.') : date;

function trend(items) {
  const values = items.slice(0, 12).reverse().map(item => Number(item.value)).filter(Number.isFinite);
  if (values.length < 2) return '';
  const low = Math.min(...values), high = Math.max(...values);
  const points = values.map((value, index) => [2 + 236 * index / (values.length - 1),
    high === low ? 22 : 42 - 40 * (value - low) / (high - low)].join(',')).join(' ');
  return `<svg viewBox="0 0 240 44" width="100%" height="44" aria-hidden="true"><polyline points="${points}" fill="none" stroke="var(--a3)" stroke-width="2"/></svg>`;
}

export function connectMetrics(snapshot, write, today) {
  const screen = document.createElement('section');
  screen.className = 'screen sub';
  screen.dataset.s = 'metrics';
  screen.inert = true;
  $('main.screens').append(screen);
  SUBS.metrics = 'more';
  HEAD.metrics = () => ['', 'Показатели', 'plus', 'Добавить измерение'];
  let selected;
  const rows = () => snapshot()?.metrics || [];
  const byId = id => rows().find(item => item.id === id);
  const groups = () => {
    const result = new Map();
    for (const row of [...rows()].sort((a, b) => String(b.date || '').localeCompare(a.date || ''))) {
      const key = seriesKey(row);
      if (!result.has(key)) result.set(key, []);
      result.get(key).push(row);
    }
    return result;
  };

  R.metrics = () => {
    const all = groups();
    if (!all.size) return moreEmpty('Измерений пока нет');
    if (!all.has(selected)) selected = all.keys().next().value;
    const items = all.get(selected), latest = items[0];
    const filters = [...all].map(([key, [row]]) => `<button class="chip${key === selected ? ' on' : ''}" data-series="${rowId(row.id)}" aria-pressed="${key === selected}">${esc2(row.title || 'Показатель')}${row.unit ? ' · ' + esc2(row.unit) : ''}</button>`);
    return `<div class="nsec" role="group" aria-label="Ряд измерений">${filters.join('')}</div>
      <div class="glass fnsh"><small>${esc2(displayDate(latest.date))}</small><b>${esc2(String(latest.value))} ${esc2(latest.unit || '')}</b>${trend(items)}</div>
      <div class="fsl">История измерений</div>${moreList(items.map(row => moreRow(ic.list, displayDate(row.date),
        [row.value, row.unit].filter(value => value != null).join(' '), `data-measure="${rowId(row.id)}"`)).join(''))}`;
  };

  function form(item) {
    const id = item?.id || newId();
    const previous = groups().get(selected)?.[0];
    const fields = moreInput('Название', 'title', item?.title ?? previous?.title, 'required')
      + moreInput('Значение', 'value', item?.value, 'type="number" step="any" required')
      + moreInput('Единица', 'unit', item?.unit ?? previous?.unit, 'required')
      + moreInput('Дата', 'date', item?.date || today(), 'type="date" required');
    moreForm(item ? 'Измерение' : 'Новое измерение', fields, async data => {
      const values = { title: data.get('title').trim(), unit: data.get('unit').trim(), value: Number(data.get('value')), date: data.get('date') };
      if (!values.title || !values.unit || !Number.isFinite(values.value) || !values.date) throw Error('Заполни название, значение, единицу и дату');
      const ok = await write(next => {
        const existing = next.metrics.find(row => row.id === id);
        if (existing) Object.assign(existing, values);
        else if (!item) next.metrics.unshift({ id, ...values });
        else throw Error('Измерение уже удалено');
      }, 'metric-save:' + id);
      if (ok) { selected = seriesKey(values); repaintMore('metrics'); }
      return ok;
    }, item ? {
      extra: '<button class="btn glass" type="button" data-remove>В корзину</button>',
      bind: el => { $('[data-remove]', el).onclick = () => confirmMore('Удалить измерение?', item.title, 'В корзину',
        () => write(next => { next.metrics = next.metrics.filter(row => row.id !== id); }, 'metric-delete:' + id)); },
    } : {});
  }

  screen.onclick = event => {
    const button = event.target.closest('[data-series], [data-measure]');
    if (!button) return;
    const row = byId(decodeURIComponent(button.dataset.series || button.dataset.measure));
    if (!row) return;
    if (button.hasAttribute('data-measure')) form(row);
    else { selected = seriesKey(row); repaintMore('metrics'); screen.scrollTop = 0; }
  };
  $('#hAct').addEventListener('click', event => {
    if (curId() !== 'metrics') return;
    event.stopImmediatePropagation();
    form();
  }, true);
  return id => {
    const row = byId(id);
    if (row) selected = seriesKey(row);
    go('metrics');
    if (row) form(row);
    else if (id) toast('Измерение недоступно');
  };
}
