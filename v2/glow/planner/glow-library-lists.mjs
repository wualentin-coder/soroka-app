import { fromRow, libraryLease, newId, palette, rowId, safeURL, saveRecord, titleOf } from './glow-library-store.mjs';
import { openRecordEditor } from './glow-library-form.mjs';
import { cookSteps } from './recipe-format.mjs';
import { paintLibraryCounter } from './glow-library-counter.mjs';

const groceryTitle = /^(продукты|покупки|список покупок|для .+ · \d+ порц\.)$/i;
const packingKinds = { documents: 'docs', clothes: 'wear', shoes: 'wear', tech: 'tech' };
const measures = /^(.*?)\s+[—–]\s+(\d+(?:[.,]\d+)?)(?:\s+([^<>]+))?$/u;
const mealTypes = { breakfast: 'b', lunch: 'm', dinner: 'm', salad: 's', dessert: 'd', завтрак: 'b', обед: 'm', ужин: 'm', салат: 's', десерт: 'd' };
const displayItem = (text, quantity, unit) => quantity ? `${text} — ${String(quantity).replace('.', ',')}${unit ? ' ' + unit : ''}` : text;
const groceryCat = name => CATALOG.find(([known]) => norm(known) === norm(name))?.[1] || 'dry';
const itemsOf = (record, packing) => packing ? record.packing.items : (record.items ||= []);
const listId = L => fromRow(L.id);
let addDraft;
let shoppingDraft;
let cookingRecipe;

function measure(value) {
  const text = String(value || '').trim();
  const match = text.match(measures);
  return match ? [match[1], Number(match[2].replace(',', '.')), match[3] || ''] : [text, null, ''];
}

export function adoptListsAndRecipes(snapshot) {
  const lists = snapshot?.saved.lists || [];
  const notes = snapshot?.notes.filter(row => row.packing) || [];
  LISTS.splice(0, LISTS.length, ...[...lists, ...notes].map(record => {
    const packing = !!record.packing;
    const type = packing ? 'travel' : groceryTitle.test(record.title) ? 'grocery' : 'plain';
    return { id: rowId(record.id), t: titleOf(record), type, packing, record, items: itemsOf(record, packing).map(item => {
      const [t, amount, u] = measure(item.text);
      const cat = packing ? packingKinds[item.section] || 'misc' : groceryCat(t);
      return { id: rowId(item.id), t, q: packing ? item.quantity : amount, u: esc2(u), unit: u, cat, done: item.done,
        sub: item.subtasks?.map(sub => [sub.text, sub.done]), item };
    }) };
  }));
  RECIPES.splice(0, RECIPES.length, ...(snapshot?.saved.recipes || []).map(record => ({
    id: rowId(record.id), t: titleOf(record), p: palette, img: safeURL(record.image), m: mealTypes[String(record.meal || '').toLowerCase()] || '',
    min: Number(record.minutes) || 0, dif: ({ easy: 1, medium: 2, hard: 3, легко: 1, средне: 2, сложно: 3 })[record.difficulty] || 0,
    serv: Math.max(1, Number(record.servings) || 2), ing: (record.ingredients || []).map(line => {
      const [t, q, u] = measure(line);
      return [t, q, esc2(u), groceryCat(t), u];
    }),
    steps: cookSteps(record).map(step => [step.text, Math.max(0, step.timer || 0), step.uses]),
    record,
  })));
  if (!snapshot) {
    addDraft = shoppingDraft = cookingRecipe = null;
    S.have = [];
    S.portions = {};
    S.rhave = {};
    S.lq = '';
    if ($('#cook').classList.contains('on')) {
      $('#cook').classList.remove('on');
      $('#cook').setAttribute('aria-hidden', 'true');
      phone.classList.remove('cooking');
    }
    CK.timers.clear();
  }
}

rimg = (r, cls = '') => `<span class="rimg ${cls}" style="--p1:${r.p[0]};--p2:${r.p[1]}"><b>${esc2(Array.from(r.t)[0] || '')}</b>
  ${r.img ? `<img src="${esc2(r.img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" draggable="false"
    onload="this.parentElement.classList.add('has-img')" onerror="this.remove()">` : ''}</span>`;

const listOverviewBind = bindLists;
bindLists = screen => {
  listOverviewBind(screen);
  $('[data-newlist]', screen).onclick = () => openRecordEditor('lists', null, {
    saved: id => { S.list = rowId(id); go('list'); },
  });
};

async function changeList(L, change, fresh, reveal) {
  const id = L.id;
  const saved = await saveRecord(L.packing ? 'notes' : 'lists', listId(L), target => {
    const items = itemsOf(target, L.packing);
    change(items);
  });
  if (saved && curId() === 'list' && S.list === id && listById(id)) {
    const screen = $('.screen[data-s="list"]');
    lFlip(screen, null, fresh);
    if (reveal) $('[data-it="' + reveal + '"]', screen)?.classList.add('open');
  }
  return saved;
}

function changeItem(L, item, fn, reveal = true) {
  return changeList(L, items => {
    const target = items.find(row => row.id === item.item.id);
    if (target) fn(target);
  }, null, reveal ? item.id : null);
}

function removeItems(items, predicate) {
  const removed = new Set(items.filter(predicate).map(item => item.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      if (removed.has(item.parentId) && !removed.has(item.id)) { removed.add(item.id); changed = true; }
    }
  }
  for (let i = items.length - 1; i >= 0; i--) if (removed.has(items[i].id)) items.splice(i, 1);
}

const rawList = R.list;
R.list = () => listById(S.list) ? rawList() : '<div class="glass empty">Список недоступен</div>';

const bindListBody = bindList;
bindList = screen => {
  bindListBody(screen);
  paintLibraryCounter($('#lleft', screen));
};

const updateListCounter = lUpdate;
lUpdate = screen => {
  updateListCounter(screen);
  paintLibraryCounter($('#lleft', screen));
};
const rawListBar = lbarSetup;
lbarSetup = () => { if (listById(S.list)) rawListBar(); };

bindRows = screen => {
  const L = listById(S.list);
  if (!L) return;
  $$('#lbody [data-it]', screen).forEach(row => {
    const x = L.items.find(item => item.id === row.dataset.it);
    const check = $('[data-chk]', row);
    const setText = (target, name = x.t, amount = x.q, unit = x.unit) => {
      if (L.packing) {
        Object.assign(target, { text: name, quantity: Math.max(1, Math.round(amount || 1)), edited: true });
      } else target.text = displayItem(name, amount, unit);
    };
    const expand = () => {
      const expanded = row.classList.contains('open');
      $$('.lrow.open', screen).forEach(node => node.classList.remove('open'));
      row.classList.toggle('open', !expanded);
    };
    check.onclick = () => void changeItem(L, x, target => {
      target.done = !x.done;
      if (!L.packing && target.subtasks?.length) {
        for (const sub of target.subtasks) sub.done = target.done;
      }
    }, false);
    const quantity = $('[data-q]', row);
    if (quantity) quantity.onclick = expand;
    const heading = $('.ltw', row);
    heading.onclick = event => {
      if (event.target.closest('.sc') || x.done) { expand(); return; }
      row.classList.add('open');
      inlineEdit($('.lt', row), text => void changeItem(L, x, target => setText(target, text)));
    };
    row.onclick = event => { if (event.target === row) expand(); };
    $$('[data-step]', row).forEach(button => {
      button.onclick = () => {
        const step = x.unit === 'г' ? 50 : ['кг', 'л'].includes(x.unit) ? .5 : 1;
        const value = Math.max(0, Math.round(((x.q || 0) + step * Number(button.dataset.step)) * 10) / 10);
        void changeItem(L, x, target => setText(target, x.t, value, x.unit || (L.packing ? '' : 'шт')));
      };
    });
    const unit = $('[data-unit]', row);
    if (unit) {
      if (L.packing) unit.disabled = true;
      else unit.onclick = () => void changeItem(L, x, target =>
        setText(target, x.t, x.q || 1, UNITS[(UNITS.indexOf(x.unit) + 1) % UNITS.length]));
    }
    const subInput = $('.st-in', row);
    if (L.packing) subInput.remove();
    else {
      let draft;
      subInput.onkeydown = async event => {
        if (event.key !== 'Enter' || !subInput.value.trim()) return;
        event.preventDefault();
        draft ||= crypto.randomUUID();
        const text = subInput.value.trim();
        await changeItem(L, x, target => {
          target.subtasks ||= [];
          const before = target.subtasks.find(sub => sub.id === draft);
          if (before) before.text = text;
          else target.subtasks.push({ id: draft, text, done: false });
        });
      };
      $('.subs', row).onclick = event => {
        const subRow = event.target.closest('[data-si]');
        const sub = x.item.subtasks?.[Number(subRow?.dataset.si)];
        if (!sub) return;
        const edit = fn => void changeItem(L, x, target => {
          const items = target.subtasks || [];
          const index = items.findIndex(item => item.id === sub.id);
          if (index >= 0) fn(items, index);
        });
        if (event.target.closest('.sbox')) edit((items, i) => { items[i].done = !sub.done; });
        else inlineEdit($('span:last-child', subRow), text => edit((items, i) => { items[i].text = text; }),
          () => edit((items, i) => { items.splice(i, 1); }));
      };
    }
    const image = safeURL(x.item.image?.url);
    if (image) $('.more > div', row).insertAdjacentHTML('beforeend', `<img src="${esc2(image)}" alt="" loading="lazy" style="max-width:100%;max-height:180px;border-radius:12px">`);
    $('[data-del]', row).onclick = () => void changeList(L, items => removeItems(items, item => item.id === x.item.id));
  });
  const clear = $('[data-clear]', screen);
  if (clear) clear.onclick = () => {
    const done = new Set(L.items.filter(x => x.done && (x.item.kind !== 'group' || L.items.filter(child => child.item.parentId === x.item.id).every(child => child.done))).map(x => x.item.id));
    void changeList(L, items => removeItems(items, item => done.has(item.id)));
  };
};

lAdd = async (value, _cat, unit) => {
  const L = listById(S.list);
  const name = value.trim();
  if (!L || !name) return false;
  if (!addDraft || addDraft.list !== L.id) {
    const existing = L.type === 'grocery' && L.items.find(item => !item.done && norm(item.t) === norm(name));
    addDraft = { list: L.id, id: existing?.item.id || crypto.randomUUID(), quantity: existing ? (existing.q || 0) + 1 : 1,
      unit: existing?.unit || unit || CATALOG.find(([n]) => norm(n) === norm(name))?.[2] || 'шт' };
  }
  const { id, quantity, unit: measureUnit } = addDraft;
  const ok = await changeList(L, items => {
    const found = items.find(item => item.id === id);
    const text = L.type === 'grocery' ? displayItem(name, quantity, measureUnit) : name;
    if (found) found.text = text;
    else items.push({ id, text, done: false, ...(L.packing ? { quantity: 1, section: 'personal', source: 'manual' } : {}) });
  }, rowId(id));
  if (ok) addDraft = null;
  return ok;
};

async function addFromInput(value, cat, unit) {
  const input = $('#lin');
  const before = input.value;
  if (await lAdd(value, cat, unit) && curId() === 'list' && input.value === before) input.value = '';
  if (curId() === 'list') lsug(input.value);
}
$('#lin').onkeydown = event => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  void addFromInput(event.currentTarget.value);
};
$('#ladd').onclick = () => {
  const input = $('#lin');
  if (input.value.trim()) void addFromInput(input.value);
  else kbFocus(input);
};
$('#lsug').addEventListener('click', event => {
  const tile = event.target.closest('[data-add]');
  if (!tile) return;
  event.stopImmediatePropagation();
  void addFromInput(tile.dataset.add, tile.dataset.c, tile.dataset.u);
}, true);

let recipeTime = 0;
const originalRecList = recList;
const originalRecipeOverview = recipesOverview;
let inRecipeFilter = false;
function withRecipeTime(fn) {
  if (inRecipeFilter) return fn();
  const previous = S.rt;
  S.rt = recipeTime;
  inRecipeFilter = true;
  try { return fn(); }
  finally { recipeTime = S.rt; S.rt = previous; inRecipeFilter = false; }
}
recList = () => withRecipeTime(originalRecList);
recipesOverview = () => withRecipeTime(originalRecipeOverview);

const bindRecipeGrid = bindRecipes;
bindRecipes = screen => {
  bindRecipeGrid(screen);
  for (const button of $$('[data-rt]', screen)) {
    const fn = button.onclick;
    button.onclick = () => withRecipeTime(fn);
  }
  $('[data-addrec]', screen).onclick = () => openRecordEditor('recipes', null, {
    saved: id => openRecipe(rowId(id)),
  });
};

const rawRecipe = R.recipe;
R.recipe = () => recById(S.rec) ? rawRecipe() : '<div class="glass empty">Рецепт недоступен</div>';
const prototypeRecipe = bindRecipe;
bindRecipe = screen => {
  const recipe = recById(S.rec);
  if (!recipe) return;
  prototypeRecipe(screen);
  $('#rcgo').disabled = recipe.steps.length === 0;
  $('[data-shop]', screen).onclick = async event => {
    const button = event.currentTarget;
    const missing = recipe.ing.filter((_, i) => !S.rhave[recipe.id]?.has(i));
    if (!missing.length) return;
    const factor = portionsOf(recipe) / recipe.serv;
    if (!shoppingDraft || shoppingDraft.recipe !== recipe.id) {
      const list = LISTS.find(L => L.type === 'grocery' && norm(L.t) === 'продукты');
      const items = [];
      for (const [title, quantity, , , unit] of missing) {
        const matching = list?.items.find(item => !item.done && item.unit === unit && norm(item.t) === norm(title));
        const existing = items.find(item => item.unit === unit && norm(item.title) === norm(title));
        const amount = quantity === null ? 0 : Math.round(quantity * factor * 100) / 100;
        if (existing) existing.amount += amount;
        else items.push({ id: matching?.item.id || crypto.randomUUID(), title, unit, amount: (matching?.q || 0) + amount });
      }
      shoppingDraft = { recipe: recipe.id, listId: list ? list.record.id : newId(), create: !list, items };
    }
    const draft = shoppingDraft;
    button.disabled = true;
    const ok = await saveRecord('lists', draft.listId, list => {
      list.title ||= 'Продукты';
      list.items ||= [];
      for (const item of draft.items) {
        const existing = list.items.find(row => row.id === item.id);
        const text = displayItem(item.title, item.amount, item.unit);
        if (existing) existing.text = text;
        else list.items.push({ id: item.id, text, done: false });
      }
    }, { create: draft.create });
    button.disabled = false;
    if (ok) { shoppingDraft = null; toast('Добавлено в «Продукты»'); }
  };
};

const prototypeCook = openCook;
openCook = button => {
  if (!recById(S.rec)?.steps.length) return;
  if (cookingRecipe !== S.rec) {
    cookingRecipe = S.rec;
    CK.timers.clear();
  }
  prototypeCook(button);
};
$('#cook').addEventListener('click', async event => {
  const button = event.target.closest('[data-cdone]');
  if (!button) return;
  event.stopImmediatePropagation();
  button.disabled = true;
  const lease = libraryLease();
  const ok = await saveRecord('recipes', fromRow(S.rec), target => { target.viewed = true; });
  if (lease !== libraryLease()) return;
  button.disabled = false;
  if (ok) { closeCook(); toast('Рецепт отмечен как приготовленный'); }
}, true);

export function editListOrRecipe(screen) {
  if (screen === 'recipe') {
    const recipe = recById(S.rec);
    if (recipe) openRecordEditor('recipes', recipe.record, { deleted: pop });
  } else {
    const list = listById(S.list);
    if (!list) return;
    if (list.packing) openRecordEditor('lists', list.record, { deleted: pop, collection: 'notes', saved: () => { $('#hTitle').textContent = listById(S.list)?.t || ''; } });
    else openRecordEditor('lists', list.record, { deleted: pop, saved: () => setHead('list', 0) });
  }
}

