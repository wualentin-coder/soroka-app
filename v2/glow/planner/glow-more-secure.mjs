import { DOC_ORDER, DOC_TYPES } from './glow-doc-formats.mjs';
import { getModuleHost } from './runtime-session.js';
import { createSecureStore } from './glow-secure-store.mjs';
import { confirmMore, copyMore, moreEmpty, moreField, moreForm, moreInput, moreOptions, moreScreen, repaintMore } from './glow-more-ui.mjs';

const securePages = ['docs', 'vault'];
const names = { docs: 'Документы', vault: 'Пароли' };
const docColors = { passport: ['#8a1f2e', '#2a0a10'], foreign: ['#1f3a8a', '#0a1230'], inn: ['#4a4f63', '#15161c'],
  snils: ['#2e8b57', '#0c2a1a'], oms: ['#1f7ab8', '#0a2438'], custom: ['#624055', '#211325'], copies: ['#473772', '#1e1535'] };
const message = error => ({
  vault_master_wrong: 'Неверный мастер-пароль.',
  vault_master_short: 'Нужно минимум 8 символов.',
  secure_unconfirmed: 'Сервер не подтвердил действие. Повторное сохранение сначала проверит предыдущий запрос.',
  secure_locked: 'Хранилище закрыто. Открой его снова.',
  secure_state: 'Состояние хранилища изменилось. Открой его заново.',
  secure_cleanup: 'Пароль изменён. Сброс доступа устройства требует повторной проверки.',
  secure_not_setup: 'Сначала настрой хранилище.',
  secure_size: 'Запись слишком большая. Убери лишние вложения.',
  secure_title: 'Введи название.',
  secure_attachment: 'Выбери корректное фото JPEG, PNG, WebP или PDF.',
  vault_master_mismatch: 'Пароли различаются.',
  biometric_unavailable: 'Биометрия недоступна.',
  biometric_cancel: 'Вход по биометрии отменён.',
  docs_conflict: 'Документ изменился. Открой его заново.',
}[error?.message] || 'Не удалось связаться с хранилищем.');
const secretInput = (label, name, auto = 'current-password') => moreInput(label, name, '', `required type="password" autocomplete="${auto}"`);
const sensitiveForm = (title, fields, submit, options = {}) => {
  moreForm(title, fields, async (data, form) => {
    try { return await submit(data, form); } catch (error) { throw Error(message(error)); }
  }, options);
  $('.more-form', $('#syIn')).setAttribute('data-secure-form', '');
  syOnClose = () => {
    $('#syIn').replaceChildren();
    syOnClose = null;
  };
};
const copyField = (label, value, index) => `<button class="dfr" data-secret-copy="${index}"><small>${esc2(label)}</small>
  <b>${esc2(value)}</b><span>${wic().copy}</span></button>`;

export function connectMoreSecure() {
  const records = { docs: null, vault: null };
  const busy = { docs: null, vault: null };
  let expanded = null, pendingDocument = null;
  let generation = 0;
  const timeoutKey = 'flow-glow-vault-timeout-v1';
  let timeout = 5;
  try { const value = Number(localStorage.getItem(timeoutKey)); if ([1, 5, 15].includes(value)) timeout = value; } catch {}
  const store = createSecureStore(getModuleHost, () => {
    generation++;
    expanded = pendingDocument = null;
    records.docs = records.vault = busy.docs = busy.vault = null;
    S.unlocked = false;
    if (securePages.includes(curId()) || $('#syIn').querySelector('[data-secure-form]')) closeSy();
    for (const page of securePages) moreScreen(page).replaceChildren();
    if (securePages.includes(curId())) repaintMore(curId());
  }, () => timeout);
  const previousSwap = swap;
  swap = (from, to, direction) => {
    if (securePages.includes(from) && !securePages.includes(to)) store.lock();
    return previousSwap(from, to, direction);
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) store.lock(); });
  window.addEventListener('flow:suspend', () => store.lock());
  window.addEventListener('pagehide', () => store.lock());

  function setupForm(page, setup, biometric) {
    sensitiveForm(setup ? 'Создать мастер-пароль' : 'Мастер-пароль', secretInput('Мастер-пароль', 'master', setup ? 'new-password' : 'current-password')
      + (setup ? secretInput('Повтори пароль', 'repeatMaster', 'new-password') : ''), async data => {
      const master = String(data.get('master'));
      if (setup && master !== data.get('repeatMaster')) throw Error('vault_master_mismatch');
      await store.open(master, setup);
      S.unlocked = true;
      if (curId() === page) repaintMore(page);
      return true;
    }, { action: setup ? 'Создать' : 'Открыть',
      ...(biometric?.enrolled ? {
        extra: '<button class="btn glass" type="button" data-open-biometric>Биометрия</button>',
        bind(form) { $('[data-open-biometric]', form).onclick = async () => {
          form.inert = true;
          try {
            await store.biometric('read');
            S.unlocked = store.isUnlocked;
            if (form.isConnected) closeSy();
            repaintMore(page);
          } catch (error) { toast(message(error)); }
          finally { form.inert = false; }
        }; },
      } : {}),
    });
  }

  async function refresh(page, screen) {
    if (busy[page] || !store.isUnlocked) return;
    const lease = generation;
    const call = store.list(page);
    busy[page] = call;
    try {
      const items = await call;
      if (lease !== generation || !store.isUnlocked) return;
      records[page] = items;
      if (curId() === page) {
        repaintMore(page);
        if (page === 'docs') revealDocument();
      }
    } catch (error) {
      if (lease === generation && curId() === page) {
        const landing = $('[data-secure-list]', screen);
        if (landing) {
          landing.innerHTML = moreEmpty(message(error)) + '<button class="btn glass" data-secure-refresh>Повторить</button>';
          $('[data-secure-refresh]', landing).onclick = () => refresh(page, screen);
        }
      }
    } finally {
      if (busy[page] === call) busy[page] = null;
    }
  }

  const docMarkup = row => {
    const [a, b] = docColors[row.kind] || docColors.custom;
    return `<div class="dcrd in" data-secure-id="${row.id}" style="--b1:${a};--b2:${b};--ink:#f3d08a"><i class="lsheen"></i>
      <button class="dch" data-secure-open aria-expanded="false"><span class="dci">${wic().doc}</span><span class="dct"><b>${esc2(row.title)}</b>
      <small>${esc2(DOC_TYPES[row.kind]?.title || 'Документ')}</small></span><span class="dcm">${wic().lock}</span></button><div class="dcf"><div data-secure-body></div></div></div>`;
  };
  const passMarkup = row => `<div class="vrow in" data-secure-id="${row.id}" style="--p1:#565484;--p2:#252038">
    <button class="vh" data-secure-open aria-expanded="false"><span class="mtile"><b>${esc2([...row.service][0] || '•')}</b></span>
    <span class="vb"><b>${esc2(row.service)}</b></span><span class="vst">${wic().lock}</span></button><div class="vmore"><div data-secure-body></div></div></div>`;
  const rowsHTML = (page, query = '') => {
    if (!records[page]) return moreEmpty('Загрузка…');
    const rows = records[page].filter(row => norm(page === 'docs' ? row.title : row.service).includes(norm(query)));
    return rows.length ? rows.map(page === 'docs' ? docMarkup : passMarkup).join('') : moreEmpty(query ? 'Ничего не нашлось' : 'Пока пусто');
  };
  const actions = `<div class="more-secure-actions"><button class="btn glass" data-secret-edit>Изменить</button>
    <button class="btn glass" data-secret-delete>Удалить</button></div>`;
  const lockButton = '<div class="more-secure-actions"><button class="btn glass" data-secure-lock>Закрыть хранилище</button></div>';
  R.docs = () => store.isUnlocked ? `<div class="dcl" data-secure-list>${rowsHTML('docs')}</div>${lockButton}` : lockHTML(names.docs);
  R.vault = () => store.isUnlocked ? `<div class="srow"><label class="glass search lsrch"><span>${ic.search}</span><input id="vq" placeholder="Найти пароль" autocomplete="off"></label></div>
    <div class="glass vsum"><span class="vsi">${wic().lock}</span><span><b>Пароли</b><small>${records.vault?.length ?? '…'} записей</small></span></div>
    <div class="glass vl" data-secure-list>${rowsHTML('vault')}</div>${lockButton}` : lockHTML(names.vault);
  const bindSecure = (page, screen) => {
    if (!store.isUnlocked) {
      const button = $('[data-unlock]', screen);
      button.innerHTML = wic().lock + 'Открыть';
      button.onclick = async () => {
        button.disabled = true;
        try {
          const state = await store.state();
          const biometric = state.setup && window.SorokaNative?.vaultBiometricState ? await store.biometric('state').catch(() => null) : null;
          if (curId() === page && button.isConnected && !document.hidden) setupForm(page, !state.setup, biometric);
        } catch (error) { if (curId() === page) toast(message(error)); }
        finally { button.disabled = false; }
      };
      return;
    }
    const list = $('[data-secure-list]', screen);
    const query = $('#vq', screen);
    if (query) query.oninput = () => { expanded = null; list.innerHTML = rowsHTML(page, query.value); };
    $('[data-secure-lock]', screen).onclick = () => store.lock();
    if (!records[page]) void refresh(page, screen);
    list.onclick = event => {
      const button = event.target.closest('[data-secure-open]');
      if (!button) return;
      const card = button.closest('[data-secure-id]');
      for (const sibling of $$('.open[data-secure-id]', list)) {
        sibling.classList.remove('open');
        $('[data-secure-open]', sibling).setAttribute('aria-expanded', 'false');
        $('[data-secure-body]', sibling).replaceChildren();
        $('[data-secure-body]', sibling).onclick = null;
      }
      const id = Number(card.dataset.secureId);
      if (expanded === id) { expanded = null; return; }
      expanded = id;
      card.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
      void expandRecord(page, id, card);
    };
  };
  bindDocs = screen => bindSecure('docs', screen);
  bindVault = screen => bindSecure('vault', screen);

  function documentFields(record) {
    const type = DOC_TYPES[record.kind] || DOC_TYPES.custom;
    return [...type.fields.map(([key, label]) => [label, record.fields?.[key]]),
      ...(record.rows || []).map(row => [row.label, row.value]), ['Заметка', record.note]].filter(([, value]) => value);
  }
  function attachments(record) {
    return [
      ...(record.photos || []).map((data, index) => ({ data, name: 'Фото ' + (index + 1) })),
      ...(record.files || []),
    ].map(file => ({ ...file, safe: FlowDocumentImports.attachment(file.data, file.mime) })).filter(file => file.safe);
  }
  function download(file) {
    const [header, data] = file.safe.data.split(',');
    const bytes = Uint8Array.from(atob(data), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: header.slice(5, -7) }));
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name || 'Документ';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function expandRecord(page, id, card) {
    const body = $('[data-secure-body]', card);
    body.innerHTML = moreEmpty('Загрузка…');
    const current = () => curId() === page && card.isConnected && card.classList.contains('open') && expanded === id && store.isUnlocked;
    try {
      const row = await store.read(page, id);
      if (!current()) return;
      const docs = page === 'docs';
      const pairs = docs ? documentFields(row) : [['Логин', row.login || ''], ['Пароль', row.password || ''], ['Заметка', row.note || '']];
      const files = docs ? attachments(row) : [];
      body.innerHTML = docs ? pairs.map(([label, value], index) => copyField(label, value, index)).join('')
        + files.map((file, index) => `<button class="dfr" data-secret-file="${index}"><small>Скачать</small><b>${esc2(file.name)}</b><span>${ic.file}</span></button>`).join('')
        + (row._serverImportIds?.length ? '<p class="empty">Новые данные из бота. Открой «Изменить», чтобы сохранить их.</p>' : '')
        + (row._serverImportBlocked ? '<p class="empty">Для нового скана нужно освободить место в документе.</p>' : '')
        : `${copyField('Логин', row.login || '', 0)}<div class="vpw">${copyField('Пароль', '••••••••••••', 1)}
          <button class="ib glass veye" aria-label="Показать пароль" aria-pressed="false" data-secret-eye>${wic().viewed}</button></div>
          ${row.note ? copyField('Заметка', row.note, 2) : ''}`;
      body.insertAdjacentHTML('beforeend', actions);
      body.onclick = async event => {
        if (!current()) return;
        const button = event.target.closest('button');
        if (!button) return;
        if (button.hasAttribute('data-secret-copy')) {
          const value = pairs[Number(button.dataset.secretCopy)]?.[1];
          if (value) await copyMore(value);
        } else if (button.hasAttribute('data-secret-eye')) {
          const show = button.getAttribute('aria-pressed') !== 'true';
          button.setAttribute('aria-pressed', String(show));
          button.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
          button.innerHTML = show ? wic().eyeoff : wic().viewed;
          $('[data-secret-copy="1"] b', body).textContent = show ? row.password : '••••••••••••';
        } else if (button.hasAttribute('data-secret-file')) {
          const file = files[Number(button.dataset.secretFile)];
          if (file) download(file);
        } else if (button.hasAttribute('data-secret-edit')) {
          if (docs) editDocument(row.kind, row); else editPassword(row);
        } else if (button.hasAttribute('data-secret-delete')) {
          confirmMore('Удалить запись?', docs ? row.title : row.service, 'Удалить', async () => {
            try { await store.remove(page, row.id); } catch (error) { throw Error(message(error)); }
            expanded = null;
            await refresh(page, moreScreen(page));
            return true;
          });
        }
      };
    } catch (error) {
      if (current()) body.innerHTML = moreEmpty(message(error));
    }
  }

  async function save(page, draft) {
    const answer = await store.save(page, draft);
    expanded = null;
    await refresh(page, moreScreen(page));
    if (answer.recovered) {
      toast('Подтверждена предыдущая запись. Проверь её перед повторной правкой.');
    }
    return true;
  }
  function editPassword(row = {}) {
    sensitiveForm(row.id ? 'Изменить пароль' : 'Новый пароль',
      moreInput('Название', 'service', row.service, 'required maxlength="120" autocomplete="off"')
      + moreInput('Логин', 'login', row.login, 'autocomplete="off" maxlength="2000"')
      + moreInput('Пароль', 'password', row.password, 'required type="password" autocomplete="new-password" maxlength="4000"')
      + moreField('Заметка', `<textarea name="note" maxlength="4000">${esc2(row.note || '')}</textarea>`), data =>
      save('vault', { ...row, ...Object.fromEntries(data), service: String(data.get('service')).trim() }));
  }
  async function selectedAttachments(files) {
    let size = 0;
    const result = [];
    for (const file of files) {
      if (!file.size) continue;
      size += file.size;
      if (size > 5_500_000) throw Error('secure_size');
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const attachment = FlowDocumentImports.attachment(data);
      if (!attachment) throw Error('secure_attachment');
      result.push({ ...attachment, name: file.name.slice(0, 150) });
    }
    return result;
  }
  function editDocument(kind, row = {}) {
    const type = DOC_TYPES[kind];
    const fields = type.fields.map(([key, label]) => moreInput(label, 'f:' + key, row.fields?.[key], 'maxlength="2000"')).join('');
    const fileFields = (values, key, title) => (values || []).map((value, i) =>
      `<label class="syrow"><span>Убрать ${esc2(value?.name || title + ' ' + (i + 1))}</span><input type="checkbox" name="${key}:${i}"></label>`).join('');
    const custom = (row.rows || []).map(item => item.label + ': ' + item.value).join('\n');
    const extra = kind === 'custom' ? moreField('Поля, по одному на строку', `<textarea name="rows" placeholder="Поле: значение" maxlength="10000">${esc2(custom)}</textarea>`) : '';
    sensitiveForm(row.id ? 'Изменить документ' : 'Новый документ', moreInput('Название', 'title', row.title || type.title, 'required maxlength="80" autocomplete="off"')
      + fields + extra + moreField('Заметка', `<textarea name="note" maxlength="4000">${esc2(row.note || '')}</textarea>`)
      + fileFields(row.photos, 'photo', 'фото') + fileFields(row.files, 'file', 'файл')
      + moreField('Добавить фото или PDF', '<input name="attachment" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple>'),
    async (data, form) => {
      const title = String(data.get('title')).trim();
      if (!title) throw Error('secure_title');
      const incoming = await selectedAttachments(data.getAll('attachment'));
      if (!form.isConnected || !store.isUnlocked) return false;
      const values = { ...row.fields };
      for (const [key, value] of data) if (key.startsWith('f:')) values[key.slice(2)] = String(value).trim();
      const rows = kind === 'custom' ? String(data.get('rows') || '').split('\n').flatMap(line => {
        const index = line.indexOf(':');
        const label = line.slice(0, index).trim();
        return index > 0 && label ? [{ label, value: line.slice(index + 1).trim() }] : [];
      }) : row.rows;
      return save('docs', { ...row, title, kind, fields: values, rows, note: String(data.get('note')).trim(),
        photos: (row.photos || []).filter((_, i) => !data.has('photo:' + i)),
        files: [...(row.files || []).filter((_, i) => !data.has('file:' + i)), ...incoming] });
    });
  }
  $('#hAct').addEventListener('click', event => {
    const page = curId();
    if (!securePages.includes(page) || !store.isUnlocked) return;
    event.stopImmediatePropagation();
    if (page === 'vault') editPassword();
    else moreForm('Новый документ', moreField('Вид документа', `<select name="kind">${moreOptions(DOC_ORDER.map(kind => [kind, DOC_TYPES[kind].title]), 'custom')}</select>`), data => {
      editDocument(data.get('kind'));
      return false;
    }, { action: 'Продолжить' });
  }, true);

  function revealDocument() {
    if (!pendingDocument || curId() !== 'docs' || !store.isUnlocked || !records.docs) return;
    const card = $('[data-secure-id="' + pendingDocument + '"]', moreScreen('docs'));
    pendingDocument = null;
    if (!card) { toast('Документ не найден'); return; }
    const button = $('[data-secure-open]', card);
    if (button?.getAttribute('aria-expanded') === 'false') button.click();
    card.scrollIntoView({ block: 'nearest' });
  }

  return {
    openDocument(id) {
      if (!Number.isSafeInteger(id) || id < 1) return false;
      pendingDocument = id;
      if (curId() !== 'docs') go('docs');
      revealDocument();
      return true;
    },
    lock: () => store.lock(),
    get timeout() { return timeout; },
    setTimeoutMinutes(value) {
      if (![1, 5, 15].includes(value)) return;
      timeout = value;
      try { localStorage.setItem(timeoutKey, String(value)); } catch {}
    },
    configureBiometric: async () => {
      try {
        const state = await store.biometric('state');
        if (!state.available) { toast('Биометрия доступна в приложении на совместимом телефоне'); return; }
        if (curId() !== 'setp' || S.stp !== 'sec') return;
        if (state.enrolled) confirmMore('Отключить биометрию?', 'Вход на этом телефоне потребует мастер-пароль.', 'Отключить', async () => {
          const answer = await store.biometric('clear');
          if (answer.enrolled !== false) throw Error('Не удалось отключить биометрию');
          return true;
        });
        else sensitiveForm('Включить биометрию', secretInput('Мастер-пароль', 'master'), async data => {
          const answer = await store.biometric('save', String(data.get('master')));
          if (answer.enrolled !== true) throw Error('biometric_unavailable');
          return true;
        }, { action: 'Включить' });
      } catch (error) { toast(message(error)); }
    },
    changeMaster: () => sensitiveForm('Сменить мастер-пароль',
      secretInput('Текущий мастер-пароль', 'oldMaster') + secretInput('Новый мастер-пароль', 'master', 'new-password')
      + secretInput('Повтори новый пароль', 'repeatMaster', 'new-password'), async data => {
      if (data.get('master') !== data.get('repeatMaster')) throw Error('vault_master_mismatch');
      await store.rewrap(String(data.get('oldMaster')), String(data.get('master')));
      toast('Мастер-пароль изменён');
      return true;
    }),
  };
}
