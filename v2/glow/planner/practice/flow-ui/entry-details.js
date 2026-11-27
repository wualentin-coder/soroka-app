import './field.js';
import './text-area.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const cloneEntry = value => structuredClone(value ?? {});
const repeats = [['none','Не повторять'],['daily','Каждый день'],['weekdays','По будням'],['weekly','Каждую неделю'],['monthly','Каждый месяц'],['yearly','Каждый год'],['custom','Каждые N дней']];
const priorities = [['high','Очень важно'],['medium','Обычно'],['low','Когда-нибудь']];
const reminders = [['none','Не напоминать'],['at','В срок'],['5m','За 5 минут'],['15m','За 15 минут'],['1h','За 1 час'],['1d','За 1 день']];
const options = (items, value) => {
  const values = items.some(([key]) => key === value) || !value ? items : [...items, [value, value]];
  return values.map(([key,label]) => `<option value="${escape(key)}">${escape(label)}</option>`).join('');
};
const select = (name, label, items, value) => `<flow-select presentation="dialog" name="${name}" aria-label="${label}" value="${escape(value)}">${options(items,value)}</flow-select>`;

export const entryDetailSheet = new CSSStyleSheet();
entryDetailSheet.replaceSync(`
:host{min-width:0}.entry .head{margin-bottom:12px}.entry .fields{gap:10px}.entry footer{margin-top:12px}.entry output{margin:0}.entry output:empty{display:none}.entry label{min-width:0}.entry .pair{gap:10px}.entry flow-field,.entry flow-text-area,.entry flow-select,.entry flow-date-time{min-width:0;display:block}
.entry.rich{padding:16px}.entry.rich form{display:flex;flex-direction:column;min-height:0;max-height:calc(100dvh - 72px)}.entry.rich .entry-body{min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 2px 2px}.entry.rich .head,.entry.rich footer{flex:none}.entry.rich h2{font-size:22px}.entry-details{margin-top:12px}.entry-details>summary{min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:10px;list-style:none;color:var(--fu-muted);cursor:pointer;border-radius:12px;padding:8px 4px}.entry-details>summary::-webkit-details-marker{display:none}.entry-details>summary::after{content:'+';font-size:20px;color:var(--fu-accent)}.entry-details[open]>summary::after{content:'−'}.entry-details>summary:focus-visible{outline:0;text-decoration:underline;text-underline-offset:4px;text-decoration-color:var(--fu-accent)}.entry-details .fields{padding-block:2px 8px}.entry-checklist{margin-top:10px;padding-top:10px;border-top:1px solid var(--fu-line)}.entry-checklist .sub-row{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;gap:4px;align-items:center;margin-bottom:6px}.entry-checklist flow-field{--fu-bg:transparent}.entry-checklist flow-field::part(frame){border-radius:12px}.entry-sub-actions{display:flex;justify-content:flex-start;margin-top:6px}.entry-sub-actions flow-button{width:auto}.entry-interval{display:flex;align-items:center;gap:12px}.entry-interval span{flex:1}.entry-interval input{width:100px;min-height:44px;padding:9px 12px;font:inherit;border:1px solid var(--fu-line);border-radius:12px;background:var(--fu-bg);color:var(--fu-text)}.entry-interval input:focus-visible{outline:none;border-color:var(--fu-accent)}[hidden]{display:none!important}
@media(max-width:350px){.entry.rich{padding:12px}.entry.rich form{max-height:calc(100dvh - 56px)}.entry.rich .pair{gap:8px}}
`);

function checklistOf(record) {
  if (Array.isArray(record.checklist)) return cloneEntry(record.checklist).map(row => typeof row === 'string' ? {text:row,done:false} : row);
  return String(record.checklist || '').split('\n').filter(line => line.trim()).map(text => ({text:text.trim(),done:false}));
}

export function normalizedEntry(record = {}) {
  return {...cloneEntry(record), title:String(record.title ?? ''), due:String(record.due ?? record.date ?? ''), time:String(record.time ?? ''), repeat:String(record.repeat || 'none'), priority:String(record.priority || 'medium'), project:String(record.project ?? ''), description:String(record.description ?? ''), checklist:checklistOf(record)};
}

export function readEntry(host) {
  const form = host.shadowRoot.querySelector('form');
  if (!form) return normalizedEntry(host._record);
  const values = new FormData(form), rich = host.hasAttribute('rich');
  const due = String(values.get('date') || ''), value = {...cloneEntry(host._record), title:String(values.get('title') || '').trim(), due, date:due, time:String(values.get('time') || '')};
  const repeat = String(values.get('repeat') || 'none');
  value.repeat = repeat === 'custom' ? `every:${Number(values.get('repeatDays') || 14)}` : repeat;
  if (rich) {
    for (const key of ['priority','project','description','remindBefore']) value[key] = String(values.get(key) ?? '');
    value.checklist = readChecklist(host);
  }
  return value;
}

function readChecklist(host) {
  return [...host.shadowRoot.querySelectorAll('[data-sub-row]')].map(node => ({...cloneEntry(host._checkRows[Number(node.dataset.subRow)]),text:node.querySelector('flow-field').value.trim(),done:node.querySelector('flow-check').hasAttribute('checked')})).filter(row => row.text);
}

export function mountEntry(host) {
  const rich = host.hasAttribute('rich'), edit = host.getAttribute('mode') === 'edit';
  const bound = host._record !== undefined || rich;
  const record = normalizedEntry(host._renderDraft ?? host._record ?? (edit ? {title:'Вернуться к своей идее'} : {}));
  host._checkRows = checklistOf(record);
  const repeat = /^every:([1-9]\d{0,3})$/.exec(record.repeat), selection = repeat ? 'custom' : record.repeat;
  const projectNames = [...new Set((host._projects || []).map(project => typeof project === 'string' ? project : project.name).filter(Boolean))];
  const projects = [['','Без проекта'],...projectNames.map(name => [name,name])];
  const titleField = rich ? `<flow-field name="title" aria-label="Название задачи" placeholder="Что нужно сделать?" maxlength="120" value="${escape(record.title)}" required></flow-field>` : `<label><input aria-label="Название" name="title" required maxlength="200" placeholder="Что нужно сделать?" value="${escape(record.title)}"></label>`;
  host.shadowRoot.innerHTML = `<section class="surface entry ${rich ? 'rich' : ''}"><form><header class="head dialog-header"><h2>${edit ? 'Изменить задачу' : 'Новая задача'}</h2><flow-button variant="icon" icon="close" label="Закрыть" data-close></flow-button></header><div class="entry-body"><div class="fields">${titleField}<div class="pair"><flow-date-time kind="date" name="date" aria-label="Дата" value="${escape(record.due)}" ${rich ? '' : 'required'}></flow-date-time><flow-date-time kind="time" name="time" aria-label="Время" value="${escape(record.time)}"></flow-date-time></div>${select('repeat','Повтор',rich ? repeats : repeats.filter(([key]) => ['none','daily','weekly'].includes(key)),selection)}<label class="entry-interval" ${selection === 'custom' ? '' : 'hidden'}><span>Каждые, дней</span><input name="repeatDays" aria-label="Интервал в днях" type="number" inputmode="numeric" min="1" max="3650" step="1" required value="${repeat ? Number(repeat[1]) : 14}" ${selection === 'custom' ? '' : 'disabled'}></label></div>${rich ? `<details class="entry-details" ${(edit || record.description || record.project || record.checklist.length) ? 'open' : ''}><summary>Детали</summary><div class="fields"><div class="pair">${select('priority','Важность',priorities,record.priority)}${select('project','Проект',projects,record.project)}</div><flow-text-area name="description" aria-label="Описание" placeholder="Описание" maxlength="5000" value="${escape(record.description)}"></flow-text-area>${select('remindBefore','Напоминание',reminders,record.remindBefore || 'none')}</div></details><section class="entry-checklist" aria-label="Подзадачи"><div data-sub-rows></div><div class="entry-sub-actions"><flow-button icon="plus" label="Подзадача" data-sub-add></flow-button></div><input type="hidden" name="checklist"></section>` : ''}</div><output aria-live="polite"></output><footer><flow-actions>${edit ? '<flow-button label="Удалить" icon="trash" variant="danger" stretch data-delete></flow-button>' : ''}<flow-button label="${edit ? 'Сохранить' : 'Добавить'}" variant="primary" stretch data-save></flow-button></flow-actions></footer></form></section>`;
  const form = host.shadowRoot.querySelector('form'), surface = host.shadowRoot.querySelector('.surface');
  if (rich) renderChecklist(host);
  const changed = () => {
    const custom = host.shadowRoot.querySelector('[name=repeat]').value === 'custom';
    const interval = host.shadowRoot.querySelector('.entry-interval');
    interval.hidden = !custom; interval.querySelector('input').disabled = !custom;
    if (rich) form.querySelector('[name=checklist]').value = JSON.stringify(readChecklist(host));
    surface.dataset.state = 'input';clearTimeout(host._idle);host._idle = setTimeout(() => surface.dataset.state = 'rest',650);
    host.dispatchEvent(new CustomEvent('flow-entry-change',{detail:{draft:readEntry(host),dirty:host.dirty},bubbles:true,composed:true}));
  };
  form.addEventListener('input',changed);form.addEventListener('change',changed);
  if (host._checkChanged) host.shadowRoot.removeEventListener('flow-check-change',host._checkChanged);
  host._checkChanged = changed;host.shadowRoot.addEventListener('flow-check-change',changed);
  const intent = type => host.dispatchEvent(new CustomEvent(type,{detail:readEntry(host),cancelable:true,bubbles:true,composed:true}));
  const save = () => {
    if (!form.reportValidity()) return;
    if (!host.shadowRoot.querySelector('[name=title]').value.trim()) {const title = host.shadowRoot.querySelector('[name=title]');(title.shadowRoot?.querySelector('input') || title).focus();return;}
    intent('flow-entry-save');
    if (!bound) {surface.dataset.state='success';host.shadowRoot.querySelector('output').textContent='Сохранено в образце';}
  };
  form.onsubmit = event => {event.preventDefault();save();};
  host.shadowRoot.querySelector('[data-save]').onclick = save;
  host.shadowRoot.querySelector('[data-delete]')?.addEventListener('click',() => intent('flow-entry-delete'));
  host.shadowRoot.querySelector('[data-close]').onclick = () => host.dispatchEvent(new CustomEvent('flow-entry-close',{detail:{draft:readEntry(host),dirty:host.dirty},cancelable:true,bubbles:true,composed:true}));
  host.shadowRoot.querySelector('[data-sub-add]')?.addEventListener('click',() => {
    if (host._checkRows.length >= 60) return;
    host._checkRows = readChecklist(host);host._checkRows.push({text:'',done:false});renderChecklist(host);changed();
    host.shadowRoot.querySelector('[data-sub-rows] .sub-row:last-child flow-field')?.shadowRoot.querySelector('input').focus();
  });
  if (!host._baseline || !host._renderDraft) host._baseline = JSON.stringify(readEntry(host));
  host._renderDraft = null;
}

function renderChecklist(host) {
  const parent = host.shadowRoot.querySelector('[data-sub-rows]');
  parent.innerHTML = host._checkRows.map((row,index) => `<div class="sub-row" data-sub-row="${index}"><flow-check label="Выполнить подзадачу ${index+1}" ${row.done ? 'checked' : ''}></flow-check><flow-field name="checklist-text-${index}" aria-label="Подзадача ${index+1}" placeholder="Подзадача" maxlength="200" value="${escape(row.text)}"></flow-field><flow-button variant="icon" icon="close" label="Удалить подзадачу ${index+1}" data-sub-remove="${index}"></flow-button></div>`).join('');
  for (const button of parent.querySelectorAll('[data-sub-remove]')) button.onclick = () => {
    // Read by DOM index before removing, retaining unknown fields and completion.
    host._checkRows = [...parent.children].map(node => ({...cloneEntry(host._checkRows[Number(node.dataset.subRow)]),text:node.querySelector('flow-field').value,done:node.querySelector('flow-check').hasAttribute('checked')}));
    host._checkRows.splice(Number(button.dataset.subRemove),1);renderChecklist(host);
    parent.dispatchEvent(new Event('input',{bubbles:true,composed:true}));
  };
}
