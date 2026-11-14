/* Native form owners keep validation, events and persistence. D02/D03/D04
 * supply only the picker, using the actual component library modules. */
(() => {
  'use strict';
  if (document.documentElement.dataset.flowDesign === 'classic') return;
  const base = document.currentScript.src;
  let active = null, ready = false;
  const loaded = import(new URL('./flow-ui/components.js?v=644cff7ac9', base).href)
    .then(() => { ready = true; bindDateFields(); }).catch(error => console.error('Flow pickers unavailable', error));
  const labelFor = element => element.getAttribute('aria-label') ||
    [...(element.labels || [])].map(label => [...label.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()).find(Boolean) ||
    element.title || element.getAttribute('placeholder') || element.name || (element.type === 'time' ? 'Время' : element.type === 'date' ? 'Дата' : 'Выбрать');
  const boundDates = new WeakMap();
  function bindDateFields() {
    if (!ready) return;
    for (const source of document.querySelectorAll('#app input[type=date],#app input[type=time]')) {
      if (boundDates.has(source) || source.hidden || source.readOnly || source.closest('[hidden]')) continue;
      const picker = document.createElement('flow-date-time');
      picker.className = 'flow-bound-picker';
      picker.setAttribute('kind', source.type);
      picker.setAttribute('aria-label', labelFor(source));
      picker.setAttribute('placeholder', source.type === 'time' ? 'Время' : 'Дата');
      picker.setAttribute('value', source.value);
      picker.toggleAttribute('required', source.required);
      picker.toggleAttribute('disabled', source.disabled);
      source.after(picker);
      source.classList.add('flow-picker-source'); source.tabIndex = -1;
      source.setAttribute('aria-hidden', 'true');
      picker.tabIndex = source.disabled ? -1 : 0;
      picker.shadowRoot.querySelector('.trigger').tabIndex = -1;
      picker.addEventListener('focus', () => picker.shadowRoot.querySelector('.trigger').focus({ preventScroll: true }));
      if (document.activeElement === source) picker.focus({ preventScroll: true });
      picker.addEventListener('input', event => event.stopImmediatePropagation());
      picker.addEventListener('change', event => {
        event.stopImmediatePropagation();
        if (!source.isConnected) return;
        const previous = source.value; source.value = picker.value;
        if (!source.checkValidity()) { source.value = previous; picker.value = previous; if (typeof toast === 'function') toast('Выберите допустимое значение'); return; }
        if (previous === source.value) return;
        source.dispatchEvent(new Event('input', { bubbles: true }));
        source.dispatchEvent(new Event('change', { bubbles: true }));
      });
      source.addEventListener('change', () => { if (picker.isConnected) picker.value = source.value; });
      source.addEventListener('invalid', event => { event.preventDefault(); picker.reportValidity(); });
      boundDates.set(source, picker);
    }
  }
  const originalRender = window.render;
  if (originalRender) window.render = function(...args) { const result = originalRender.apply(this, args); bindDateFields(); return result; };
  const fieldsObserver = new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && node.tagName !== 'FLOW-DATE-TIME' && (node.matches('input[type=date],input[type=time]') || node.querySelector('input[type=date],input[type=time]'))))) bindDateFields();
  });
  fieldsObserver.observe(document.getElementById('app') || document.body, {childList:true,subtree:true});
  function dispose() {
    if (!active) return;
    const previous = active; active = null;
    previous.observer.disconnect(); previous.host.remove();
    if (previous.trigger.isConnected) previous.trigger.focus({ preventScroll: true });
  }
  function open(trigger, kind, value, options, commit, label) {
    if (!ready || !trigger.isConnected) return false;
    dispose();
    const host = document.createElement(kind === 'select' ? 'flow-select' : 'flow-date-time');
    host.className = 'flow-native-picker';
    host.setAttribute('aria-label', label);
    host.setAttribute('value', value || '');
    if (kind === 'select') {
      host.setAttribute('presentation', 'dialog');
      for (const item of options) {
        const option = document.createElement('option');
        option.value = item.value; option.textContent = item.label; option.disabled = item.disabled;
        host.append(option);
      }
    } else host.setAttribute('kind', kind);
    document.body.append(host);
    const style = document.createElement('style');
    // Keep the anchor measurable for the shared component's visibility guard.
    style.textContent = '.trigger{position:fixed;left:1px;top:1px;width:2px;height:2px;min-height:2px;padding:0;opacity:0;pointer-events:none}';
    host.shadowRoot.append(style);
    const owner = typeof ui !== 'undefined' ? ui.sheet : null;
    const observer = new MutationObserver(() => {
      if (!trigger.isConnected || (typeof ui !== 'undefined' && ui.sheet !== owner)) dispose();
    });
    observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
    active = { host, trigger, observer };
    host.addEventListener('change', () => {
      if (active?.host !== host || !trigger.isConnected || (typeof ui !== 'undefined' && ui.sheet !== owner)) return;
      commit(host.value);
    });
    host.shadowRoot.querySelector('dialog').addEventListener('close', () => {
      if (active?.host === host) dispose();
    });
    host.open();
    return true;
  }
  function handle(event) {
    if (!ready || event.defaultPrevented || event.composedPath().some(n => n === active?.host)) return;
    if (event.composedPath().some(node => node?.classList?.contains('flow-bound-picker'))) return;
    const labelPicker = event.target.closest?.('label')?.querySelector('.flow-bound-picker');
    if (event.type === 'click' && labelPicker && !event.target.closest('button,select,input')) { event.preventDefault(); event.stopImmediatePropagation(); labelPicker.open(); return; }
    const target = event.target.closest?.('select,input[type=date],input[type=time],[data-action="task-time-open"],[data-action="task-when-menu"]');
    if (!target || target.disabled || target.readOnly || target.multiple || target.closest('[inert]')) return;
    if (event.type === 'keydown' && !['Enter', ' ', 'ArrowDown'].includes(event.key)) return;
    const taskOwner = typeof ui !== 'undefined' ? ui.sheet : null;
    let kind, value, options, commit, label;
    if (target.dataset.action === 'task-time-open') {
      if (!taskOwner) return;
      kind = 'time'; value = taskOwner.draft?.time || ''; label = 'Время';
      commit = next => { if (ui.sheet !== taskOwner) return; taskOwner.draft = { ...taskOwner.draft, time: next }; render(); };
    } else if (target.dataset.action === 'task-when-menu') {
      if (!taskOwner) return;
      const field = target.dataset.field;
      kind = 'select'; value = taskOwner.draft?.[field] || (field === 'repeat' ? 'none' : field === 'priority' ? 'medium' : '');
      if (field === 'repeat' && value.startsWith('every:')) value = 'custom';
      const choices = field === 'repeat' ? TASK_REPEAT_OPTIONS : field === 'priority' ? [['high','Очень важно'],['medium','Обычно'],['low','Когда-нибудь']] : [['','Без проекта'],...taskProjectNames().map(name => [name,name])];
      label = { repeat: 'Повтор', priority: 'Важность', project: 'Проект' }[field];
      options = choices.map(([value,label]) => ({ value,label }));
      commit = next => { if (ui.sheet !== taskOwner) return; taskOwner.draft = { ...taskOwner.draft, [field]: field === 'repeat' && next === 'custom' ? 'every:14' : next }; render(); };
    } else {
      kind = target.tagName === 'SELECT' ? 'select' : target.type;
      value = target.value; label = labelFor(target);
      options = kind === 'select' ? [...target.options].map(option => ({ value: option.value, label: option.textContent, disabled: option.disabled || option.parentElement.disabled })) : null;
      commit = next => {
        const previous = target.value; target.value = next;
        if (!target.checkValidity()) { target.value = previous; if (typeof toast === 'function') toast('Выберите допустимое значение'); return; }
        if (previous === next) return;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
      };
    }
    event.preventDefault(); event.stopImmediatePropagation();
    open(target, kind, value, options, commit, label);
  }
  document.addEventListener('click', handle, true);
  document.addEventListener('keydown', handle, true);
  // Desktop select popups open on mousedown, before click. Suppress that default
  // only once the shared picker is ready; the normal click still opens D02.
  document.addEventListener('mousedown', event => {
    const select = event.target.closest?.('select');
    if (ready && select && !select.disabled && !select.multiple && !select.closest('[inert]')) event.preventDefault();
  }, true);
  window.addEventListener('pagehide', dispose);
  const currentDialog = () => active?.host.shadowRoot.querySelector('dialog[open]') || [...document.querySelectorAll('.flow-bound-picker')].map(node => node.shadowRoot?.querySelector('dialog[open]')).find(Boolean);
  window.flowPickers = {
    isOpen: () => !!currentDialog(), ready: loaded, close: dispose,
    cancel() { currentDialog()?.dispatchEvent(new Event('cancel', {cancelable:true})); }
  };
})();
