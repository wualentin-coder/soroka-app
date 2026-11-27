import { showPlanTicket } from './glow-plan-tickets.mjs';
import { adoptNotes, openSavedNote } from './glow-notes.mjs';
import { libraryReady, libraryScreens, rowId, setLibrary } from './glow-library-store.mjs';
import { openRecordEditor } from './glow-library-form.mjs';
import { adoptLibraryItems, editLibraryItem, openMaterial, releaseAddressMap } from './glow-library-items.mjs';
import { adoptListsAndRecipes, editListOrRecipe } from './glow-library-lists.mjs';
import { adoptMovies, editFilm, editMarathon } from './glow-library-films.mjs';

const prototypeCard = itemCard;
const prototypeAfter = after;
const prototypeSavedCategory = R.savedCat;
const prototypeSavedHead = HEAD.savedCat;
const prototypeTicketHero = tkHero;
const libraryStyle = document.createElement('style');
libraryStyle.textContent = `
  .screen[data-s="savedCat"] > .srow[data-library-filter] .kseg button:not(.on) {
    flex: 1 1 40px; min-width: 24px; padding-inline: 2px;
  }
  .screen[data-s="savedCat"] > .srow[data-library-filter] .kseg button.on {
    flex: 1 0 auto; min-width: max-content; padding-inline: 8px;
  }
  .srow[data-library-filter] .kseg button.on .kl { margin-left: 6px; }
  .library-add-menu .rw {
    grid-template-columns: 34px minmax(0, 1fr) 16px; min-height: 48px; gap: 10px; padding: 7px 10px;
  }
  .library-add-menu .rw .ic { width: 34px; height: 34px; border-radius: 12px; }
  .library-add-menu .rw .chev { display: block; width: 16px; height: 16px; }
  @media (max-width: 359px) {
    .screen[data-s="savedCat"] > .srow[data-library-filter]:first-child {
      display: grid; grid-template-columns: minmax(0, 1fr) auto; margin-left: 0; gap: 8px 10px;
    }
    .srow[data-library-filter]::before {
      content: attr(data-library-filter) / ""; grid-area: 1 / 1; margin-left: 56px;
      color: var(--text); font-size: 17px; font-weight: 700;
    }
    .srow[data-library-filter] .ib { grid-area: 1 / 2; }
    .srow[data-library-filter] .kseg { grid-area: 2 / 1 / auto / -1; width: 100%; }
  }
`;
document.head.append(libraryStyle);

const empty = '<div class="glass empty">Пусто</div>';
const ticketColors = {
  film: ['#f2a24b', '#7a2a12'], train: ['#9fd6ff', '#1a2a6b'], plane: ['#c9b8ff', '#2a1f5b'],
};
const months = new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' });
const plural = new Intl.PluralRules('ru');
const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const plain = value => String(value ?? '').replace(/\s+/g, ' ').trim();

function ticketWhen(offset, time) {
  const day = offset === null ? 'Без даты' : offset === 0 ? 'Сегодня' : offset === 1 ? 'Завтра' : months.format(dayIn(offset));
  return time ? `${day} · ${time}` : day;
}

export function adoptSaved(snapshot, dateDistance, validTime, clock) {
  SAVED.length = 0;
  TKS.length = 0;
  setLibrary(snapshot);
  adoptListsAndRecipes(snapshot);
  adoptLibraryItems(snapshot);
  adoptMovies(snapshot);
  adoptNotes(snapshot);
  if (!snapshot) {
    if ($('#sySheet').classList.contains('on') && $('.glow-record', $('#sySheet'))) {
      closeSy();
      $('#syIn').replaceChildren();
    }
    return;
  }

  const { notes, saved } = snapshot;
  const groups = {
    notes: notes.filter(record => !record.packing), lists: [...saved.lists, ...notes.filter(record => record.packing)],
    links: [...saved.links, ...saved.posts, ...saved.files], movies: saved.movies, recipes: saved.recipes,
    products: saved.products, addresses: saved.addresses, tickets: saved.tickets, cards: saved.cards,
  };
  const tickets = new Map();
  for (const ticket of saved.tickets) {
    const d = dateDistance(ticket.eventDate);
    const time = validTime(ticket.eventTime);
    const k = { train: 'train', flight: 'plane' }[ticket.ticketType] || 'film';
    const where = [ticket.origin, ticket.destination].filter(Boolean).join(' → ') || ticket.venue || ticket.carrier || '';
    const codes = Array.isArray(ticket.codes) ? ticket.codes.filter(code => code && typeof code === 'object') : [];
    const row = {
      id: encodeURIComponent(ticket.id), k, t: plain(ticket.title) || 'Билет', d: d ?? Infinity, tm: time || '00:00',
      where: where || ' ', c: ticketColors[k], codes: codes.length ? codes : [{ seat: ticket.seat || '' }],
      when: ticketWhen(d, time), pl: where, ticket,
      remaining: d !== null && time ? d * 1440 + minutes(time) - minutes(clock) : null,
    };
    tickets.set(ticket, row);
    TKS.push(row);
  }
  TKS.sort((a, b) => a.d - b.d || a.tm.localeCompare(b.tm));

  for (const [category, records] of Object.entries(groups)) {
    for (const record of records) {
      const ticketRow = tickets.get(record);
      const detail = ticketRow ? [ticketRow.when, ticketRow.where].filter(Boolean).join(' · ')
        : category === 'notes' ? window.flowNoteInk.unpack(record.description).body
          : record.description || record.summary || record.address || record.note || record.url || record.topic || '';
      SAVED.push({ c: category, k: catName(category), t: plain(record.title || record.name) || 'Без названия',
        p: plain(detail).slice(0, 220), ticketRow, id: record.id, stamp: Date.parse(record.created || record.created_at) || 0 });
    }
  }
  SAVED.sort((a, b) => b.stamp - a.stamp);
  SAVED.forEach((row, index) => { row.index = index; });
}

itemCard = (row, index) => prototypeCard({ ...row, t: esc2(row.t), p: esc2(row.p), k: esc2(row.k) }, index)
  .replace('<button ', `<button data-glow-saved="${row.index}" `);

function bindResults(container) {
  for (const button of $$('[data-glow-saved]', container)) {
    button.onclick = () => {
      const row = SAVED[Number(button.dataset.glowSaved)];
      if (!row) return;
      openSavedRecord(row.id, button);
    };
  }
}

export function openSavedRecord(id, button) {
  const row = SAVED.find(item => item.id === id);
  if (!row) return;
  if (row.ticketRow) showPlanTicket(row.ticketRow, button);
  else if (row.c === 'notes') openSavedNote(row.id);
  else openLibraryResult(row);
}

function openLibraryResult(row) {
  S.cat = row.c;
  const id = rowId(row.id);
  if (row.c === 'lists') { S.list = id; go('list'); }
  else if (row.c === 'movies') openFilm(id);
  else if (row.c === 'recipes') openRecipe(id);
  else if (row.c === 'links') openMaterial(row.id);
  else if (row.c === 'products') { S.prod = id; go('prod'); }
  else {
    if (row.c === 'cards') S.lcard = id;
    if (row.c === 'addresses') { S.addr = id; S.ak = 'all'; }
    go('savedCat');
  }
}

function upcoming() {
  return TKS.filter(ticket => ticket.d >= 0);
}

function featuredTicket() {
  return upcoming().find(ticket => Number.isFinite(ticket.d));
}

function markup(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template;
}

function ticketCard(row, index) {
  const card = markup(tkCard({ ...row, codes: row.codes.map(code => ({ ...code, text: '' })) }, index));
  const category = $('.tkk', card.content);
  category.lastChild.textContent = `${row.k === 'film' ? 'Билет' : TKN[row.k]} · ${row.when}`;
  $('.tkstub svg', card.content)?.remove();
  $('.tkstub', card.content).insertAdjacentHTML('afterbegin', tic()[row.k]);
  const wrapper = document.createElement('div');
  wrapper.append(card.content);
  wrapper.firstElementChild?.insertAdjacentHTML('afterend', `<button class="mread" data-ticket-edit="${row.id}" aria-label="Изменить билет ${esc2(row.t)}">Изменить</button>`);
  return `<div data-tk2="${row.id}">${wrapper.innerHTML.replace(' data-tk2="' + row.id + '"', '')}</div>`;
}

function ticketHero() {
  const row = featuredTicket();
  if (!row) return '';
  const template = markup(prototypeTicketHero());
  const hero = $('.tkfocus', template.content);
  if (!hero) return '';
  $('.tkhb small', hero).textContent = [row.when, row.pl].filter(Boolean).join(' · ');
  const counter = $('.cds', hero);
  if (row.remaining === null || row.remaining < 0) counter.remove();
  else {
    const days = Math.floor(row.remaining / 1440);
    const dayLabel = { one: 'день', few: 'дня', many: 'дней' }[plural.select(days)] || 'дней';
    const tile = (value, label) => `<span class="cdt"><b>${String(value).padStart(2, '0')}</b><small>${label}</small></span>`;
    counter.innerHTML = (days ? tile(days, dayLabel) : '') + tile(Math.floor(row.remaining % 1440 / 60), 'ч') + tile(row.remaining % 60, 'мин');
  }
  hero.insertAdjacentHTML('afterend', `<button class="mread" data-ticket-edit="${row.id}" aria-label="Изменить билет ${esc2(row.t)}">Изменить</button>`);
  return template.innerHTML;
}

function ticketList() {
  const hero = featuredTicket();
  const rows = S.tk === 'up' ? upcoming().filter(row => row !== hero) : TKS.filter(row => row.d < 0).sort((a, b) => b.d - a.d);
  return rows.length ? rows.map(ticketCard).join('') : hero && S.tk === 'up' ? '' : empty;
}

ticketsOverview = () => `<div class="srow">${capsHTML([['up', 'Предстоящие'], ['past', 'Прошедшие']], S.tk, 'data-tkf', { up: tic().up, past: tic().past })}<button class="ib glass" data-addtk aria-label="Добавить билет">${ic.plus}</button></div>
  ${S.tk === 'up' ? ticketHero() : ''}<div class="tkl" id="tkl">${ticketList()}</div>`;

bindTickets = screen => {
  const list = $('#tkl', screen);
  screen.onclick = event => {
    const button = event.target.closest('[data-tkopen], [data-tkhero]');
    const id = button?.dataset.tkhero || button?.closest('[data-tk2]')?.dataset.tk2;
    const row = TKS.find(item => item.id === id);
    if (row) showPlanTicket(row, button);
    if (event.target.closest('[data-addtk]')) openRecordEditor('tickets', null, { saved: () => { S.tk = 'up'; } });
    const edit = event.target.closest('[data-ticket-edit]');
    if (edit) {
      const selected = TKS.find(item => item.id === edit.dataset.ticketEdit);
      if (selected) openRecordEditor('tickets', selected.ticket);
    }
  };
  bindCaps(screen, 'data-tkf', filter => {
    S.tk = filter;
    const hero = $('.tkfocus', screen);
    if (hero) {
      if (hero.nextElementSibling?.matches('[data-ticket-edit]')) hero.nextElementSibling.remove();
      hero.remove();
    }
    if (filter === 'up') list.insertAdjacentHTML('beforebegin', ticketHero());
    flipSwap(list, ticketList(), 'data-tk2');
  });
};

R.savedCat = () => libraryReady() ? prototypeSavedCategory() : '';
ic.savedEdit = LI('<path d="m14 5 5 5M6 14l-2 6 6-2 10-10a1.5 1.5 0 0 0 0-2l-2-2a1.5 1.5 0 0 0-2 0Z"/>');
const editRoutes = { list: editListOrRecipe, recipe: editListOrRecipe, film: editFilm, mat: editLibraryItem,
  prod: editLibraryItem, marathon: editMarathon };
for (const id of Object.keys(editRoutes)) {
  const original = HEAD[id];
  HEAD[id] = () => [...original().slice(0, 2), 'savedEdit', 'Изменить'];
}
HEAD.savedCat = () => S.cat === 'cards' && S.lcard ? ['', '', 'savedEdit', 'Изменить карту'] : prototypeSavedHead();

const addCategories = ['notes', 'lists', 'movies', 'recipes', 'links', 'products', 'addresses', 'tickets', 'cards'];
function addToLibrary() {
  if (!libraryReady()) return;
  openSy(`<div class="syh">Сохранить</div><div class="glass list library-add-menu">${addCategories.map(kind =>
    `<button class="rw" data-library-add="${kind}"><span class="ic">${glyph(kind)}</span><b>${esc2(catName(kind))}</b>${ic.chev.replace('<svg','<svg class="chev"')}</button>`).join('')}</div>`, sheet => {
    $$('[data-library-add]', sheet).forEach(button => {
      button.onclick = () => {
        const kind = button.dataset.libraryAdd;
        closeSy();
        S.cat = kind;
        if (kind === 'notes') { openSavedNote(); return; }
        go('savedCat');
        const selector = { lists: 'newlist', movies: 'addfilm', recipes: 'addrec', links: 'addmat', products: 'addprod',
          addresses: 'addaddr', tickets: 'addtk', cards: 'addlc' }[kind];
        $('.screen[data-s="savedCat"] [data-' + selector + ']')?.click();
      };
    });
  });
}
const headAction = $('#hAct').onclick;
$('#hAct').onclick = () => {
  const id = curId();
  if (id === 'saved') addToLibrary();
  else if (id === 'savedCat' && S.cat === 'cards') editLibraryItem(id);
  else if (editRoutes[id] && libraryReady()) editRoutes[id](id);
  else if (!libraryScreens.includes(id) || id === 'note') headAction();
};

after = (id, screen) => {
  if (id !== 'savedCat' || S.cat !== 'addresses') releaseAddressMap();
  if (id === 'savedCat') screen.onclick = null;
  if (libraryScreens.includes(id) && !libraryReady()) return;
  if (id === 'savedCat' && ['recipes', 'addresses'].includes(S.cat)) {
    const row = $(':scope > .srow:first-child', screen);
    row.dataset.libraryFilter = catName(S.cat);
    $('#kseg', row).setAttribute('aria-label', S.cat === 'recipes' ? 'Виды рецептов' : 'Категории адресов');
  }
  prototypeAfter(id, screen);
  if (id !== 'saved') return;
  const search = $('#q', screen);
  const prototypeSearch = search.oninput;
  search.oninput = event => { prototypeSearch(event); bindResults($('#found', screen)); };
  bindResults($('#recent', screen));
  $('[data-add]', screen).onclick = addToLibrary;
};

adoptSaved(null);
