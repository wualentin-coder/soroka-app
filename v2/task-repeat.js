// Интервал хранится одним правилом, как остальные повторы задачи.
function taskRepeatFields(value) {
  const match = /^every:([1-9]\d{0,3})$/.exec(String(value));
  return `<div data-repeat-days ${match ? '' : 'hidden'}><label class="field">Каждые, дней<input name="repeatDays" type="number" inputmode="numeric" min="1" max="3650" step="1" value="${match ? Number(match[1]) : 14}" ${match ? '' : 'disabled'} required></label></div>`;
}
function readTaskRepeat(form) {
  const rule = String(form.get('repeat') || 'none');
  if (rule !== 'custom') return rule;
  const raw = String(form.get('repeatDays') || '');
  if (!/^[1-9]\d{0,3}$/.test(raw) || Number(raw) > 3650) throw new Error('Укажи интервал от 1 до 3650 дней.');
  return `every:${Number(raw)}`;
}
document.addEventListener('change', event => {
  const select = event.target;
  if (!select.matches('#entry-form select[name="repeat"]')) return;
  const field = select.form.querySelector('[data-repeat-days]');
  if (!field) return;
  field.hidden = select.value !== 'custom';
  field.querySelector('input').disabled = field.hidden;
});
