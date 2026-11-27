export const moreScreen = id => $('.screen[data-s="' + id + '"]');
export const moreEmpty = message => '<div class="glass empty" role="status">' + esc2(message) + '</div>';
export const moreList = html => '<div class="glass list">' + html + '</div>';
export const moreRow = (icon, title, detail, data = '') =>
  `<button type="button" class="rw" ${data}><span class="ic">${icon}</span><span><b>${esc2(title)}</b>${detail ? `<small>${esc2(detail)}</small>` : ''}</span>${ic.chev.replace('<svg', '<svg class="chev"')}</button>`;
export const moreField = (label, input) => `<label class="glass syq"><small>${esc2(label)}</small>${input}</label>`;
export const moreInput = (label, name, value = '', attributes = '') =>
  moreField(label, `<input name="${name}" value="${esc2(value)}" ${attributes}>`);
export const moreOptions = (entries, selected) => entries.map(([key, label]) =>
  `<option value="${esc2(key)}"${key === selected ? ' selected' : ''}>${esc2(label)}</option>`).join('');
export const repaintMore = id => {
  if (curId() !== id) return;
  const top = moreScreen(id).scrollTop;
  paint(id).scrollTop = top;
  setHead(id, 0);
};

export function moreForm(title, fields, submit, { action = 'Сохранить', extra = '', bind } = {}) {
  openSy(`<div class="syh">${esc2(title)}</div><form class="glow-record more-form">
    ${fields}<p class="more-error" role="alert" hidden></p>
    <div class="more-actions"><button class="btn main" type="submit">${esc2(action)}</button>
    <button class="btn glass" type="button" data-more-close>Отмена</button>${extra}</div></form>`, sheet => {
    const form = $('.more-form', sheet);
    const error = $('.more-error', form);
    $('[data-more-close]', form).onclick = () => { if (!form.inert) closeSy(); };
    form.onsubmit = async event => {
      event.preventDefault();
      if (form.inert) return;
      const fields = new FormData(form);
      form.inert = true;
      error.hidden = true;
      try {
        const ok = await submit(fields, form);
        if (ok !== false && form.isConnected) closeSy();
      } catch (failure) {
        if (form.isConnected) {
          error.textContent = failure?.message || 'Действие не подтверждено';
          error.hidden = false;
        }
      } finally {
        form.inert = false;
      }
    };
    bind?.(form);
  });
}

export function confirmMore(title, detail, action, submit) {
  moreForm(title, detail ? `<p class="empty">${esc2(detail)}</p>` : '', submit, { action });
}

export async function copyMore(value) {
  try { await navigator.clipboard.writeText(value); toast('Скопировано'); }
  catch { toast('Не удалось скопировать'); }
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('#sySheet')?.classList.contains('on')) closeSy();
});

const style = document.createElement('style');
style.textContent = `
  .phone:has(#env[data-tab="more"]) .head:not(.sub) { opacity:1; transform:none; }
  .phone:has(#env[data-tab="more"]) .head:not(.sub) #hAct { pointer-events:auto; }
  .screen[data-s="more"] { padding-top:64px; }
  .phone #toast { pointer-events:none; }
  .more-form { display:grid; gap:8px; }
  .more-form .syq :is(input,select,textarea) { width:100%; }
  .more-form .syq :is(select,textarea), .more-setting-control { background:transparent; color:var(--text); border:0; font:inherit; }
  .more-form select option, .more-setting-control option { color:#fff; background:#211529; }
  .more-form textarea { resize:vertical; min-height:56px; }
  .more-form .more-actions { display:flex; flex-wrap:wrap; gap:8px; }
  .more-error { color:var(--a2); margin:0 4px; font-size:13px; }
  .more-secure-actions { display:flex; gap:8px; flex-wrap:wrap; padding:7px 12px 12px; }
  .more-setting { display:flex; align-items:center; justify-content:space-between; gap:10px; min-height:46px; }
  .more-setting-control { max-width:56%; color:var(--a3); text-align:end; }
  .more-setting :is(b,small) { display:block; }
  .more-setting small { color:var(--faint); }
`;
document.head.append(style);
