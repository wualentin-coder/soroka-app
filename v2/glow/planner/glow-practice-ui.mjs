import { moreEmpty, moreForm, moreInput, moreOptions } from './glow-more-ui.mjs';

export { moreEmpty, moreForm, moreInput, moreOptions };
export const practiceDate = value => {
  const n = new Date(value + 'T12:00:00');
  return Number.isFinite(n.valueOf()) ? n : null;
};
export const practiceDay = value => practiceDate(value)?.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) || '';
export const numberOrDash = value => Number.isFinite(value) ? fmt(value) : '—';
export const label = value => esc2(value ?? '');
export const slug = value => encodeURIComponent(String(value));
export const unslug = value => decodeURIComponent(value);
export const progress = (done, total) => Number.isFinite(done) && total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
export const practiceButton = (action, title, icon = '', attrs = '') => `<button type="button" class="btn glass" data-practice-action="${action}" ${attrs}>${icon}<span>${label(title)}</span></button>`;
export const practiceMessage = (title, retry = true) => `${moreEmpty(title)}${retry ? practiceButton('retry', 'Повторить', ic.reset) : ''}`;

export function practiceTabs(el, attr, select) {
  if (!$('#kseg', el)) return;
  bindCaps(el, attr, select);
}

export function delegatePractice(el, actions) {
  el.onclick = event => {
    const button = event.target.closest('[data-practice-action]');
    if (!button || button.disabled || !el.contains(button) || !Object.hasOwn(actions, button.dataset.practiceAction)) return;
    Promise.resolve().then(() => actions[button.dataset.practiceAction](button)).catch(error => toast(error?.message || 'Действие не выполнено'));
  };
}
