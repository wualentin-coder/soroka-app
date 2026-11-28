import { plannerCollections } from './planner-model.mjs';
import { plannerSyncLimit } from './planner-runtime.mjs';
import { newId, rowId, fromRow, titleOf } from './glow-library-store.mjs';
import { openSavedRecord } from './glow-saved.mjs';
import { openSavedNote } from './glow-notes.mjs';
import { confirmMore, moreEmpty, moreField, moreForm, moreInput, moreList, moreOptions, moreRow, repaintMore } from './glow-more-ui.mjs';

const projectStates = ['Активен', 'На паузе', 'Завершён'];
const projectColors = ['#3b5678', '#302343'];
const date = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' });
const labelDate = value => /^\d{4}-\d{2}-\d{2}/.test(value || '') && Number.isFinite(Date.parse(value))
  ? date.format(new Date(value.slice(0, 10) + 'T12:00:00')) : '';
const kindIcons = { projects: 'folder', tasks: 'check', events: 'calendar', notes: 'note', movies: 'film', lists: 'list',
  files: 'file', links: 'link', recipes: 'cup', products: 'wallet', transactions: 'wallet' };
const glyph = kind => ic[kindIcons[kind.split('.').at(-1)]] || ic.file;
const trashCollections = { task: 'tasks', event: 'events', note: 'notes', project: 'projects', metric: 'metrics', inbox: 'inbox',
  'saved:notes': 'notes', 'finance:transaction': 'finance.transactions', 'finance:debt': 'finance.debts',
  'finance:goal': 'finance.goals', 'finance:payment': 'finance.payments', 'finance:account': 'finance.accounts',
  'finance:budget': 'finance.budgets' };
const trashColumn = kind => trashCollections[kind] || (kind.startsWith('saved:') ? 'saved.' + kind.slice(6) : '');
const sectionNames = { finance:'Финансы', tasks:'Все дела', projects:'Проекты', metrics:'Показатели', docs:'Документы', vault:'Пароли',
  archive:'Архив и корзина', render:'Рендер', pc:'Компьютер', server:'Сервер', vpn:'VPN', settings:'Настройки' };

export function connectMoreRecords({ snapshot, write, resolve, editEntry, addProjectTask }) {
  const findProject = () => snapshot()?.projects.find(project => rowId(project.id) === S.proj);
  const projectEntries = project => plannerCollections(snapshot()).flatMap(([kind, rows]) =>
    kind === 'projects' ? [] : (rows || []).filter(row => row.project === project.name
      || (kind === 'notes' || kind.startsWith('saved.')) && row.topic === project.name)
      .map(row => ({ kind, row })));
  const projectTasks = project => TASKS.filter(task => task.p === rowId(project.id));
  const percent = tasks => tasks.length ? Math.round(100 * tasks.filter(task => task.done).length / tasks.length) : 0;
  const openEntry = ({ kind, row }, button) => {
    if (kind === 'tasks' || kind === 'events') editEntry(kind === 'tasks' ? 'task' : 'event', row);
    else if (kind === 'notes') openSavedNote(row.id);
    else if (kind === 'finance.transactions') openSy(`<div class="syh">${esc2(titleOf(row))}<small>${esc2(labelDate(row.date))}</small></div>
      <div class="glass empty">${esc2(new Intl.NumberFormat('ru', { maximumFractionDigits: 2 }).format(row.amount))} ${esc2(row.currency || 'RUB')}</div>`);
    else if (kind.startsWith('saved.')) openSavedRecord(row.id, button);
  };
  const projectCard = (project, i) => {
    const related = projectEntries(project);
    const tasks = projectTasks(project);
    const v = percent(tasks);
    const detail = [project.status, tasks.filter(task => !task.done).length + ' открыто',
      related.filter(({kind}) => kind === 'notes' || kind.startsWith('saved.')).length + ' матер.'].filter(Boolean).join(' · ');
    return `<button class="glass pjc in" data-proj="${rowId(project.id)}" style="--p1:${projectColors[0]};--p2:${projectColors[1]};animation-delay:${i * 60}ms">
      <i class="pjg"></i><span class="pjh"><span class="pji">${ic.folder}</span><span><b>${esc2(project.name)}</b><small>${esc2(detail)}</small></span><em>${v}%</em></span>
      <span class="lbar2 pjb"><i style="--v:${v / 100}"></i></span></button>`;
  };
  R.projects = () => snapshot()?.projects.length
    ? `<div class="pjl">${snapshot().projects.map(projectCard).join('')}</div>` : moreEmpty('Проектов пока нет');
  R.project = () => {
    const project = findProject();
    if (!project) return moreEmpty('Проект недоступен');
    const tasks = projectTasks(project).sort((a, b) => Number(a.done) - Number(b.done) || (a.d ?? Infinity) - (b.d ?? Infinity));
    const completed = tasks.filter(task => task.done).length;
    const v = percent(tasks);
    const related = projectEntries(project).filter(({ kind }) => kind === 'notes' || kind === 'events' || kind === 'finance.transactions' || kind.startsWith('saved.'));
    return `<div class="glass pjhero" style="--p1:${projectColors[0]};--p2:${projectColors[1]}"><i class="pjg"></i>
      <span class="pjbig"><b class="lit">${v}</b><i>%</i></span><span class="pjhb"><b>${esc2(project.name)}</b>
      <small>${completed} из ${tasks.length} · ${esc2(project.status)}</small></span><span class="lbar2 pjb"><i style="--v:${v / 100}"></i></span></div>
      ${project.description ? `<p class="sylab">${esc2(project.description)}</p>` : ''}
      <div class="fsl">Задачи</div><div id="pjt">${tasks.length ? `<div class="glass tgl">${tasks.map((row, i) => taskRow({ ...row, t: esc2(row.t) }, i, 1)).join('')}</div>` : moreEmpty('Задач пока нет')}</div>
      <div class="more-secure-actions"><button class="btn glass" data-pj-add>${ic.plus}Добавить дело</button></div>
      ${related.length ? '<div class="fsl">Связанные записи</div>' + moreList(related.map(({kind, row}) =>
        moreRow(glyph(kind), titleOf(row), labelDate(row.date || row.due || row.created), `data-project-item="${rowId(row.id)}"`)).join('')) : ''}`;
  };
  ic.glowProjectEdit = LI('<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="M13.5 6.5l4 4"/>');
  HEAD.project = () => ['Проект', findProject()?.name || 'Проект', 'glowProjectEdit', 'Изменить проект'];
  bindProject = screen => {
    const taskRows = $('#pjt', screen);
    if (!taskRows) return;
    for (const label of $$('.tb', taskRows)) {
      label.setAttribute('role', 'button');
      label.tabIndex = 0;
      label.onkeydown = event => {
        if (!['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        label.click();
      };
    }
    taskRows.onclick = async event => {
      const button = event.target.closest('[data-tchk], .tb');
      const row = button && snapshot()?.tasks.find(task => rowId(task.id) === button.closest('[data-task]').dataset.task);
      if (!row) return;
      if (!button.matches('[data-tchk]')) { editEntry('task', row); return; }
      button.disabled = true;
      await write(next => {
        const task = next.tasks.find(item => item.id === row.id);
        if (task) task.done = !row.done;
      }, 'project-task:' + row.id + ':' + !row.done);
      button.disabled = false;
    };
    $('[data-pj-add]', screen).onclick = () => addProjectTask(findProject()?.name);
    for (const button of $$('[data-project-item]', screen)) button.onclick = () => {
      const project = findProject();
      const entry = project && projectEntries(project).find(({row}) => row.id === fromRow(button.dataset.projectItem));
      if (entry) openEntry(entry, button);
    };
  };

  function projectForm(project) {
    if (!snapshot()) return;
    const id = project?.id || newId();
    const fields = moreInput('Название', 'name', project?.name, 'required maxlength="120"')
      + moreField('Описание', `<textarea name="description" maxlength="5000">${esc2(project?.description || '')}</textarea>`)
      + moreField('Статус', `<select name="status">${moreOptions(projectStates.map(item => [item, item]), project?.status)}</select>`);
    moreForm(project ? 'Изменить проект' : 'Новый проект', fields, async data => {
      const name = String(data.get('name')).trim();
      if (!name) throw Error('Введи название проекта');
      if (snapshot()?.projects.some(item => item.id !== id && norm(item.name) === norm(name))) throw Error('Проект с таким названием уже есть');
      const draft = { name, description: String(data.get('description')).trim(), status: data.get('status') };
      if (!await write(next => {
        const current = next.projects.find(item => item.id === id || item.id === resolve(id));
        if (current) {
          if (current.name !== name) {
            for (const [kind, rows] of plannerCollections(next)) {
              for (const row of rows || []) {
                if (row.project === current.name) row.project = name;
                if ((kind === 'notes' || kind.startsWith('saved.')) && row.topic === current.name) row.topic = name;
              }
            }
            for (const section of [...Object.values(next.savedSections || {}).flat(), ...(next.mapCategories || [])]) {
              if (section.name === current.name) section.name = name;
            }
          }
          Object.assign(current, draft);
        } else if (!project) next.projects.unshift({ id, ...draft });
      }, 'project-save:' + id)) return false;
      closeSy();
      S.proj = rowId(resolve(id));
      go('project');
      return false;
    }, project ? {
      extra: '<button class="btn glass" type="button" data-project-delete>В корзину</button>',
      bind: form => { $('[data-project-delete]', form).onclick = () => confirmMore('Удалить проект?', project.name, 'В корзину', async () => {
        const ok = await write(next => { next.projects = next.projects.filter(item => item.id !== id); }, 'project-delete:' + id);
        if (ok && curId() === 'project') pop();
        return ok;
      }); },
    } : {});
  }

  function archiveItems() {
    const current = snapshot();
    if (!current) return [];
    if (S.at === 'trash') return [...current.trash].reverse().map(item =>
      ({ key: item.id, title: titleOf(item.item || {}), kind: trashColumn(item.type), stamp: item.deletedAt, item }));
    const today = [TODAY.getFullYear(), TODAY.getMonth() + 1, TODAY.getDate()].map(part => String(part).padStart(2, '0')).join('-');
    const groups = S.at === 'completed' ? [['tasks', current.tasks.filter(item => item.done)]]
      : S.at === 'past' ? [['events', current.events.filter(item => item.due && item.due < today)],
        ['saved.tickets', current.saved.tickets.filter(item => item.eventDate && item.eventDate < today)]]
      : [['notes', current.notes.filter(item => item.viewedAt || item.viewed)], ...['links', 'posts', 'files', 'movies', 'recipes', 'products'].map(kind =>
        ['saved.' + kind, current.saved[kind].filter(item => item.viewedAt || item.viewed || ['Прочитано', 'Просмотрено'].includes(item.status))])];
    return groups.flatMap(([kind, rows]) => rows.map(row => ({ key: row.id, row, kind, title: titleOf(row),
      stamp: row.viewedAt || row.doneAt || row.completionDate || row.due || row.eventDate || row.created })))
      .sort((a, b) => (b.stamp || '').localeCompare(a.stamp || ''));
  }
  function archiveList() {
    const rows = archiveItems();
    if (!rows.length) return moreEmpty('Пусто');
    const trash = S.at === 'trash';
    const body = rows.map(({ key, title, kind, stamp }, index) => {
      const meta = labelDate(stamp);
      if (!trash) return moreRow(glyph(kind), title, meta, `data-more-archive="${rowId(key)}"`);
      return `<div class="arw in" style="animation-delay:${index * 40}ms"><span class="ari">${glyph(kind)}</span><span class="arb">
        <b>${esc2(title)}</b><small>${meta ? 'Удалено ' + esc2(meta) : 'Корзина'}</small></span>
        <button class="ib arr" data-more-restore="${rowId(key)}" aria-label="Восстановить ${esc2(title)}">${wic().restore}</button></div>`;
    }).join('');
    return trash ? `<div class="glass arl">${body}</div><button class="btn glass arclr" data-more-clear>${wic().trash}Очистить корзину</button>
      <p class="arn">Через 30 дней записи удаляются сами</p>` : moreList(body);
  }
  R.archive = () => `<div class="srow wsrow hsrow">${capsHTML(AT, S.at, 'data-at',
    { trash: wic().trash, completed: wic().done, past: nic().ev, viewed: wic().viewed })}</div><div id="arb">${archiveList()}</div>`;
  bindArchive = screen => {
    const body = $('#arb', screen);
    bindCaps(screen, 'data-at', key => { S.at = key; body.innerHTML = archiveList(); stagger(body); });
    body.onclick = async event => {
      const button = event.target.closest('[data-more-archive], [data-more-restore], [data-more-clear]');
      if (!button) return;
      if (button.matches('[data-more-clear]')) {
        const ids = archiveItems().map(item => item.key);
        return confirmMore('Очистить корзину?', 'Записи будут удалены навсегда.', 'Удалить навсегда', async (_data, form) => {
          for (let index = 0; index < ids.length; index += plannerSyncLimit) {
            if (!form.isConnected || curId() !== 'archive') return false;
            const keys = new Set(ids.slice(index, index + plannerSyncLimit));
            if (!await write(next => { next.trash = next.trash.filter(item => !keys.has(item.id)); }, 'archive-purge:' + [...keys].join(','))) return false;
          }
          return true;
        });
      }
      const entry = archiveItems().find(item => rowId(item.key) === (button.dataset.moreArchive || button.dataset.moreRestore));
      if (!entry) return;
      if (!entry.item) { openEntry(entry, button); return; }
      button.disabled = true;
      const result = await write(next => {
        const item = next.trash.find(row => row.id === entry.key);
        const rows = new Map(plannerCollections(next)).get(entry.kind);
        if (!item && rows?.some(row => row.id === entry.item.item.id)) return;
        if (!rows || !item) throw Error('archive_restore_unavailable');
        // A create with a deleted native id restores the original row server-side.
        if (!rows.some(row => row.id === item.item.id)) rows.push(item.item);
        next.trash = next.trash.filter(row => row.id !== item.id);
      }, 'archive-restore:' + entry.key);
      button.disabled = false;
      if (result) toast('Запись восстановлена');
    };
  };

  function findSections() {
    openSy(`<div class="syh">Поиск в «Ещё»</div><label class="glass syq">${ic.search}<input aria-label="Найти раздел" placeholder="Найти раздел" autocomplete="off"></label><div id="glowMoreResults"></div>`, sheet => {
      const input = $('input', sheet);
      const results = $('#glowMoreResults', sheet);
      const render = () => {
        const matches = Object.entries(sectionNames).filter(([, title]) => norm(title).includes(norm(input.value)));
        results.innerHTML = matches.length ? moreList(matches.map(([key, title]) =>
          moreRow(ic.more || ic.search, title, '', `data-open-more="${key}"`)).join('')) : moreEmpty('Раздел не найден');
      };
      input.oninput = render;
      results.onclick = event => {
        const button = event.target.closest('[data-open-more]');
        if (button) { closeSy(); go(button.dataset.openMore); }
      };
      render();
    });
  }

  $('#hAct').addEventListener('click', event => {
    const id = curId();
    if (!['projects', 'project', 'more'].includes(id)) return;
    event.stopImmediatePropagation();
    if (id === 'more') findSections();
    else if (id === 'projects' || findProject()) projectForm(id === 'project' ? findProject() : null);
  }, true);
  repaintMore('more');
}
