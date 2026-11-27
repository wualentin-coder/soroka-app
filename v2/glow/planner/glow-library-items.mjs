import { libraryLease, openExternal, palette, refreshLibraryScreen, rowId, safeURL, saveRecord, svgImage, titleOf } from './glow-library-store.mjs';
import { openRecordEditor } from './glow-library-form.mjs';
import { showSavedCode } from './glow-plan-tickets.mjs';
import { paintLibraryCounter } from './glow-library-counter.mjs';

const colors = ['#e6a363', '#3c2243'];
const cardKinds = { magnit: ['#e44048', '#611f2c'], pyaterochka: ['#c83945', '#2e6044'], perekrestok: ['#27845c', '#1d3d48'] };
const color = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : null;
const kindOfAddress = text => /еда|ресторан|кафе|коф|магазин/i.test(text) ? 'food' : /дом|семья/i.test(text) ? 'home' :
  /зал|спорт|фитнес/i.test(text) ? 'sport' : 'work';
const dateLabel = value => {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Intl.DateTimeFormat('ru', { day: 'numeric', month: 'short' }).format(time) : '';
};
let myLocation = null;
let addressMap;
let leaveMap;
const fullSummaries = new Map();

export function adoptLibraryItems(snapshot) {
  const saved = snapshot?.saved;
  if (!saved) {
    myLocation = null;
    fullSummaries.clear();
    addressMap?.remove();
    addressMap = null;
    $('.live-file-close')?.click();
  }
  const materials = saved ? ['links', 'posts', 'files'].flatMap(collection => saved[collection].map(record => {
    const kind = { links: 'link', posts: 'post', files: 'file' }[collection];
    const url = safeURL(record.url);
    const summary = fullSummaries.get(record.id) || record.summary || record.description;
    return {
      id: rowId(record.id), k: kind, t: titleOf(record), dom: esc2(url ? new URL(url).hostname : 'Материал'),
      min: Number(record.minutes) || 0, c: colors, read: record.viewed, when: dateLabel(record.postedAt || record.created),
      sum: summary ? String(summary).split(/\n+/).filter(Boolean) : [], sumDone: kind !== 'file' && !!summary,
      ch: record.source || 'Пост', ext: (record.fileName || record.title || '').match(/\.([a-z0-9]{1,6})$/i)?.[1]?.toUpperCase() || 'Файл',
      size: '', url, record, collection,
    };
  })) : [];
  MATS.splice(0, MATS.length, ...materials.sort((a, b) => String(b.record.created).localeCompare(String(a.record.created))));
  PRODS.splice(0, PRODS.length, ...(saved?.products || []).map(record => {
    const now = Math.max(0, Number(record.price) || 0);
    const previous = Number(record.oldPrice) || Number(record.startPrice) || now;
    return { id: rowId(record.id), t: titleOf(record), st: esc2(record.store || 'Товар'), img: safeURL(record.image),
      h: [now && previous || 0, now], tg: Math.max(0, Number(record.targetPrice) || 0), c: palette, record };
  }));
  ADDRS.splice(0, ADDRS.length, ...(saved?.addresses || []).map(record => ({
    id: rowId(record.id), t: titleOf(record), a: [record.city, record.address].filter(Boolean).join(', '), k: kindOfAddress(record.topic || ''),
    ll: Number.isFinite(record.lat) && Number.isFinite(record.lng) ? [record.lat, record.lng] : null,
    note: [record.description, ...Object.entries({ entrance: 'Подъезд', floor: 'Этаж', apartment: 'Квартира', intercom: 'Домофон' })
      .filter(([key]) => record[key]).map(([key, label]) => label + ' ' + record[key])].filter(Boolean).join(' · '), record,
  })));
  LCARDS.splice(0, LCARDS.length, ...(saved?.cards || []).map(record => {
    const scheme = cardKinds[record.brand] || palette;
    return { id: rowId(record.id), brand: titleOf(record), prog: 'Карта', num: record.number || record.code || '',
      bg: [color(record.color) || scheme[0], color(record.accent) || scheme[1]], logo: safeURL(record.logo), svg: svgImage(record.svg), record };
  }));
}

const fileStyles = document.createElement('style');
fileStyles.textContent = `
  .live-file { position:fixed;inset:0;z-index:500;display:flex;flex-direction:column;background:#161018;color:var(--text);font:600 15px Manrope,sans-serif; }
  .live-file > header { display:flex;gap:10px;align-items:center;padding:12px 16px;border-bottom:1px solid #ffffff24; }
  .live-file > header strong { flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
  .live-file-close { border:0;border-radius:16px;padding:10px;background:#ffffff1c;color:inherit;font:inherit; }
  .live-file-body { display:flex;flex:1;min-height:0;overflow:auto; }
  .live-file-body iframe { width:100%;border:0;background:white; }
  .live-file-wait { display:grid;gap:14px;justify-items:center;margin:auto;padding:24px; }
  .live-file-image { max-width:100%;margin:auto;object-fit:contain; }
  .live-file-text { margin:0;padding:16px;white-space:pre-wrap; }
  .wcard :is(.llogo,.lcode) img { max-width:100%;max-height:100%;object-fit:contain; }
  .wcard .lcode img { width:auto;height:98px; }
  #wallet { --wallet-open-height: 236px; }
  #wallet .wcard.open { height: var(--wallet-open-height); }
  #wallet .lhd > span:last-child { min-width: 0; }
  #wallet .lhd b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pfocus > .plate { height: auto; min-height: 120px; padding: 16px 22px 14px; justify-content: center; }
  .pfocus .big { display: flex; flex-direction: column; align-items: stretch; gap: 5px; container-type: inline-size; }
  .pfocus .product-total {
    display: flex; align-items: baseline; gap: .18em;
    font-size: min(50px, calc(100cqi / var(--total-width)));
  }
  .pfocus .product-total b { font-size: inherit; white-space: nowrap; }
  .pfocus .product-total span { font-size: .5em; padding: 0; }
  .pfocus .product-summary { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 5px 10px; }
  .pfocus .product-summary .psv {
    margin: 0; height: auto; min-height: 28px; max-width: 100%; padding: 4px 9px;
    white-space: normal; overflow-wrap: anywhere; -webkit-backdrop-filter: none; backdrop-filter: none;
  }
  .pfocus .psv svg { flex: none; }
  .wcard .lcode.editless { gap:6px; }
  .mo-media { display:grid;gap:8px; }
  .mo-media img { width:100%;max-height:360px;object-fit:contain;border-radius:12px; }
  .leaflet-container { background:#211923; }
`;
document.head.append(fileStyles);

const materialGrid = bindMats;
bindMats = screen => {
  materialGrid(screen);
  $('[data-addmat]', screen).onclick = () => openRecordEditor('links', null, { saved: openMaterial });
};
export function openMaterial(id) { S.mat = rowId(id); go('mat'); }
const prototypeMaterial = R.mat;
R.mat = () => {
  const mat = matById(S.mat);
  if (!mat) return '<div class="glass empty">Материал недоступен</div>';
  const body = document.createElement('template');
  body.innerHTML = prototypeMaterial();
  if (mat.k === 'post') {
    $('.mtitle', body.content).textContent = mat.t;
    $('.mpost p', body.content).textContent = mat.record.body || mat.record.summary || '';
    $('.mpost p', body.content).style.whiteSpace = 'pre-line';
    const media = (mat.record.media || []).map(entry => safeURL(entry.src)).filter(Boolean);
    if (media.length) $('.mpost', body.content).insertAdjacentHTML('beforeend',
      `<div class="mo-media">${media.map(src => `<img src="${esc2(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join('')}</div>`);
    const controls = $('.mact', body.content);
    controls.insertAdjacentHTML('beforeend', `<button class="btn glass" data-msum>${pic().star}<span>Пересказ</span></button>`);
    controls.insertAdjacentHTML('afterend', '<div class="glass msumbox" id="msumbox"></div>');
  }
  if (!mat.min && mat.k === 'link') $('.fmeta', body.content).textContent = mat.url ? new URL(mat.url).hostname : '';
  return body.innerHTML;
};

function animateSummary(box, row) {
  box.innerHTML = sumHTML(row, false);
  box.classList.add('on');
  if (!reduce) box.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 420 });
}

bindMat = screen => {
  const mat = matById(S.mat);
  if (!mat) return;
  const setRead = async viewed => {
    if (!await saveRecord(mat.collection, mat.record.id, target => { target.viewed = viewed; })) return;
    const text = $('[data-mread]', screen);
    if (text) text.textContent = viewed ? 'Отметить непрочитанным' : 'Прочитано';
  };
  const open = $('[data-mopen]', screen);
  if (open) {
    open.disabled = !mat.url && !(mat.k === 'file' && mat.record.inChat);
    open.onclick = () => {
      if (!openExternal(mat.url) && mat.k === 'file' && mat.record.inChat) window.sorokaOpenFile(mat.record);
      if (mat.k === 'link' && !matById(S.mat)?.read) void setRead(true);
    };
  }
  const read = $('[data-mread]', screen);
  if (read) read.onclick = () => void setRead(!matById(S.mat)?.read);
  const share = $('[data-mshare]', screen);
  if (share) {
    share.disabled = !mat.url;
    share.onclick = async () => {
      try {
        if (navigator.share) await navigator.share({ title: mat.t, url: mat.url });
        else { await navigator.clipboard.writeText(mat.url); toast('Ссылка скопирована'); }
      } catch (error) { if (error.name !== 'AbortError') toast('Не удалось поделиться'); }
    };
  }
  const summary = $('[data-msum]', screen);
  if (summary) summary.onclick = async () => {
    const box = $('#msumbox', screen);
    const local = fullSummaries.get(mat.record.id) || mat.sum.join('\n');
    if (local) {
      if (box.classList.contains('on')) box.classList.remove('on');
      else animateSummary(box, { sum: local.split(/\n+/).filter(Boolean) });
      return;
    }
    if (typeof window.sorokaSummarizeMaterial !== 'function') { toast('Пересказ пока недоступен'); return; }
    const lease = libraryLease();
    summary.disabled = true;
    $('span', summary).textContent = 'Читаю…';
    try {
      const answer = await window.sorokaSummarizeMaterial(mat.record.id);
      if (libraryLease() !== lease || !summary.isConnected) return;
      if (!answer?.ok) { toast(answer?.text || 'Не получилось пересказать'); return; }
      fullSummaries.set(mat.record.id, String(answer.text));
      animateSummary(box, { sum: String(answer.text).split(/\n+/).filter(Boolean) });
      summary.classList.add('done');
    } catch {
      if (libraryLease() === lease && summary.isConnected) toast('Не удалось получить пересказ');
    } finally {
      if (summary.isConnected) { summary.disabled = false; $('span', summary).textContent = 'Пересказ'; }
    }
  };
};

const productGrid = bindProds;
bindProds = screen => {
  productGrid(screen);
  paintLibraryCounter($('.pfocus .big b', screen));
  $('[data-addprod]', screen).onclick = () => openRecordEditor('products', null, {
    saved: id => { S.prod = rowId(id); go('prod'); },
  });
};
const prototypeProductCard = prodCard;
prodCard = (p, index) => pNow(p) ? prototypeProductCard(p, index) : prototypeProductCard(p, index).replaceAll('0 ₽', 'Цена неизвестна');
const prototypeProducts = prodsOverview;
prodsOverview = () => {
  const template = document.createElement('template');
  template.innerHTML = prototypeProducts();
  const total = PRODS.filter(p => !p.record.viewed).reduce((sum, p) => sum + pNow(p), 0);
  const content = $('.pfocus .big', template.content);
  const amount = $('b', content);
  const currency = document.createElement('span');
  const title = $('span', content);
  const saving = $('.psv', content);
  const totalLine = document.createElement('div');
  const summary = document.createElement('div');

  amount.textContent = Math.round(total).toLocaleString('ru-RU');
  currency.textContent = '₽';
  title.textContent = 'в желаниях';
  totalLine.className = 'product-total';
  const numberWidth = [...amount.textContent].reduce((width, char) => width + (/\s/.test(char) ? .25 : .62), .68);
  totalLine.style.setProperty('--total-width', numberWidth);
  totalLine.append(amount, currency);

  summary.className = 'product-summary';
  summary.append(title);
  if (PRODS.some(p => pNow(p) && pStart(p) > pNow(p))) summary.append(saving);
  content.replaceChildren(totalLine, summary);
  paintLibraryCounter(amount);
  return template.innerHTML;
};
const rawProduct = R.prod;
R.prod = () => {
  const p = prodById(S.prod);
  if (!p) return '<div class="glass empty">Товар недоступен</div>';
  const template = document.createElement('template');
  template.innerHTML = rawProduct();
  const graph = $('.pchw', template.content);
  const points = (p.record.priceHistory || []).filter(point => Number.isFinite(point.price) && point.price > 0 && Number.isFinite(Date.parse(point.at)));
  if (points.length > 1) {
    graph.innerHTML = priceChart({ ...p, h: points.map(point => point.price) }) +
      `<div class="pchx"><span>${dateLabel(points[0].at)}</span><span>${dateLabel(points.at(-1).at)}</span></div>`;
    graph.setAttribute('aria-label', 'История наблюдавшихся цен');
  } else if (p.record.startPrice > 0 && p.record.startPrice !== pNow(p) && pNow(p) > 0) {
    graph.innerHTML = `<div class="pchx"><span>Первая цена · ${rub(p.record.startPrice)}</span><span>Сейчас · ${rub(pNow(p))}</span></div>`;
  } else graph.remove();
  if (!pNow(p)) $('.ppr b', template.content).textContent = 'Цена неизвестна';
  const slider = $('#prng', template.content);
  const max = Math.max(10, Math.ceil(pNow(p)), Math.ceil(p.tg));
  slider.min = '0';
  slider.max = String(max);
  slider.step = '1';
  slider.value = String(p.tg);
  $('[data-pstore]', template.content).textContent = p.record.tracked ? 'Не следить' : 'Следить';
  const acts = $('.mact', template.content);
  acts.insertAdjacentHTML('afterend', `<button class="mread" data-pbought>${p.record.viewed ? 'Вернуть в желания' : 'Куплено'}</button>`);
  return template.innerHTML;
};

bindProd = screen => {
  const p = prodById(S.prod);
  if (!p) return;
  instantRimgs(screen);
  const { record } = p;
  const slider = $('#prng', screen);
  const show = value => {
    $('#ptgv', screen).textContent = value ? rub(value) : 'Нет цели';
    $('#ptgs', screen).textContent = value && pNow(p) ? pNow(p) <= value ? 'Цель достигнута' : `Ещё ${rub(pNow(p) - value)} до цели` : 'Желаемая цена';
    slider.style.setProperty('--v', value / Number(slider.max));
    const line = $('#ptg', screen);
    if (line) {
      const low = Number(line.dataset.mn);
      const high = Number(line.dataset.mx);
      const y = Math.max(3, Math.min(117, 110 - (value - low) / (high - low) * 100));
      line.style.opacity = value ? 1 : 0;
      line.setAttribute('y1', y);
      line.setAttribute('y2', y);
    }
  };
  slider.oninput = () => show(Number(slider.value));
  slider.onchange = async () => {
    slider.disabled = true;
    const ok = await saveRecord('products', record.id, target => { target.targetPrice = Number(slider.value) || null; });
    slider.disabled = false;
    if (ok) refreshLibraryScreen('prod');
    else { slider.value = String(p.tg); show(p.tg); }
  };
  show(p.tg);
  const open = $('[data-popen]', screen);
  open.disabled = !safeURL(record.url);
  open.onclick = () => openExternal(record.url);
  const track = $('[data-pstore]', screen);
  track.disabled = !safeURL(record.url) || window.SOROKA_PRICE_CHECKS_ENABLED !== true;
  if (track.disabled && safeURL(record.url)) track.title = 'Проверка цен приостановлена';
  track.onclick = async () => {
    if (await saveRecord('products', record.id, target => { target.tracked = !record.tracked; })) refreshLibraryScreen('prod');
  };
  $('[data-pbought]', screen).onclick = async () => {
    if (await saveRecord('products', record.id, target => { target.viewed = !record.viewed; })) refreshLibraryScreen('prod');
  };
};

const prototypeCard = lcardHTML;
lcardHTML = (card, index) => {
  const body = document.createElement('template');
  body.innerHTML = prototypeCard({ ...card, brand: esc2(card.brand), prog: 'Карта', logo: '', num: '' }, index);
  $('.llogo', body.content).innerHTML = card.logo ? `<img alt="" src="${esc2(card.logo)}" loading="lazy">` : esc2(card.brand[0]);
  const code = $('.lcode', body.content);
  code.innerHTML = (card.svg ? `<img alt="Код карты" src="${card.svg}">` : '') + `<small>${esc2(card.num || 'Кода нет')}</small>`;
  return body.innerHTML;
};
const prototypeWalletLayout = layWallet;
layWallet = wallet => {
  const cards = $$('[data-lc]', wallet).filter(card => card.style.display !== 'none');
  const selected = cards.find(card => card.dataset.lc === S.lcard);
  if (!selected) { prototypeWalletLayout(wallet); return; }

  const openHeight = Number.parseFloat(getComputedStyle(wallet).getPropertyValue('--wallet-open-height'));
  let stackIndex = 0;
  for (const card of cards) {
    const open = card === selected;
    card.classList.toggle('open', open);
    card.style.zIndex = open ? 50 : 10 + stackIndex;
    card.style.transform = open ? 'none' : 'translateY(' + (openHeight + 14 + stackIndex * 12) +
      'px) scale(' + (.94 - stackIndex * .01) + ')';
    if (!open) stackIndex++;
  }
  wallet.style.height = (openHeight + (stackIndex ? 84 + (stackIndex - 1) * 12 : 0)) + 'px';
};

const prototypeCards = bindCards2;
bindCards2 = screen => {
  prototypeCards(screen);
  $('[data-addlc]', screen).onclick = () => openRecordEditor('cards', null, {
    saved: id => { S.lcard = rowId(id); },
  });
  const wallet = $('#wallet', screen);
  const pick = wallet.onclick;
  wallet.onclick = event => {
    const button = event.target.closest('.wcard.open');
    const card = button && LCARDS.find(row => row.id === button.dataset.lc);
    if (card && event.target.closest('.lcode')) {
      showSavedCode({ kick: 'Карта', title: card.brand, codes: [{ kind: card.record.format === 'QRCode' ? 'qr' : 'bar',
        svg: card.record.svg, text: card.num }] }, button);
      return;
    }
    pick(event);
    setHead('savedCat', 0);
  };
  $('#lq', screen).addEventListener('input', () => setHead('savedCat', 0));
};

function addressesInView() {
  const addresses = ADDRS.filter(a => S.ak === 'all' || a.k === S.ak);
  return myLocation ? addresses.map(a => ({ ...a, d: a.ll ? distM(a.ll, myLocation) : Infinity })).sort((a, b) => a.d - b.d) : addresses;
}
function addressCard(a, index) {
  const html = addrRow({ ...a, d: a.d || 0 }, index);
  const template = document.createElement('template');
  template.innerHTML = html;
  const distance = $('.ad', template.content);
  if (Number.isFinite(a.d)) $('small', distance).remove();
  else distance.remove();
  $('.aacts', template.content).insertAdjacentHTML('beforeend', '<button class="btn sm glass" data-address-edit>Изменить</button>');
  if (!a.a) $('[data-acopy]', template.content).disabled = true;
  if (!a.ll && !a.a) $('[data-aroute]', template.content).disabled = true;
  return template.innerHTML;
}
const empty = '<div class="empty">Пусто</div>';
addrsOverview = () => {
  const addresses = addressesInView();
  return `<div class="srow">${capsHTML(AK, S.ak, 'data-ak', pic())}<button class="ib glass" data-addaddr aria-label="Добавить адрес">${ic.plus}</button></div>
    <div class="glass amap"><div id="amap"></div><i class="amapfx"></i><button class="ib glass ame" data-ame aria-label="Где я">${pic().me}</button></div>
    <div class="glass alst" id="alst">${addresses.map(addressCard).join('') || empty}</div>`;
};

export function releaseAddressMap() {
  leaveMap?.();
  leaveMap = null;
  addressMap?.remove();
  addressMap = null;
}

bindAddrs = screen => {
  releaseAddressMap();
  const box = $('#amap', screen);
  const list = $('#alst', screen);
  let active = true;
  leaveMap = () => { active = false; };
  const redraw = () => flipSwap(list, addressesInView().map(addressCard).join('') || empty, 'data-addr');
  const reveal = id => {
    S.addr = S.addr === id ? null : id;
    $$('[data-addr]', list).forEach(node => {
      const on = node.dataset.addr === S.addr;
      node.classList.toggle('open', on);
      $('.adh', node).setAttribute('aria-expanded', on);
    });
    const selected = ADDRS.find(a => a.id === S.addr);
    if (selected?.ll) addressMap?.flyTo(selected.ll, 15);
  };
  const nearLabel = () => {
    $('.anear', screen)?.remove();
    const closest = addressesInView()[0];
    if (!myLocation || !Number.isFinite(closest?.d)) return;
    const icon = pic()[closest.k];
    $('.amapfx', screen).insertAdjacentHTML('afterend', `<button class="anear" data-asel="${closest.id}" style="--c:${ACATS[closest.k][1]}">
      <span class="ati">${icon}</span><span><small>Ближайшее</small><b>${esc2(closest.t)} · ${distTxt(closest.d)}</b></span></button>`);
  };
  let drawMap = () => {};
  nearLabel();
  screen.onclick = async event => {
    const button = event.target.closest('button');
    if (!button || !screen.contains(button)) return;
    const row = ADDRS.find(a => a.id === button.closest('[data-addr]')?.dataset.addr);
    if (button.matches('[data-asel]')) reveal(button.dataset.asel);
    if (row && button.matches('[data-address-edit]')) openRecordEditor('addresses', row.record);
    if (row && button.matches('[data-aroute]')) {
      const params = new URLSearchParams(row.ll ? { rtext: '~' + row.ll.join(','), rtt: 'auto' } : { text: row.a });
      openExternal('https://yandex.ru/maps/?' + params);
    }
    if (row && button.matches('[data-acopy]')) {
      try { await navigator.clipboard.writeText(row.a); toast('Адрес скопирован'); } catch { toast('Не удалось скопировать'); }
    }
    if (button.matches('[data-addaddr]')) openRecordEditor('addresses', null, {
      saved: id => { S.ak = 'all'; S.addr = rowId(id); },
    });
    if (button.matches('[data-ame]')) {
      if (!navigator.geolocation) { toast('Геолокация недоступна'); return; }
      navigator.geolocation.getCurrentPosition(position => {
        if (!active) return;
        myLocation = [position.coords.latitude, position.coords.longitude];
        redraw();
        nearLabel();
        drawMap();
        addressMap?.flyTo(myLocation, 15);
      }, () => { if (active) toast('Не удалось определить местоположение'); }, { timeout: 10000, maximumAge: 30000 });
    }
  };
  bindCaps(screen, 'data-ak', kind => { S.ak = kind; S.addr = null; redraw(); nearLabel(); drawMap(); });
  if (!ADDRS.some(a => a.ll) && !myLocation) {
    box.textContent = 'Нет точек на карте';
    box.classList.add('empty');
  }
  if (!ADDRS.some(a => a.ll) && !myLocation && !navigator.geolocation) return;
  loadLeaflet().then(L => {
    if (!active || !box.isConnected || S.cat !== 'addresses' || curId() !== 'savedCat') return;
    box.replaceChildren();
    box.classList.remove('empty');
    addressMap = L.map(box, { zoomControl: false, attributionControl: true }).setView([0, 0], 1);
    const markers = L.layerGroup().addTo(addressMap);
    let tiles = null;
    drawMap = () => {
      markers.clearLayers();
      const points = addressesInView().filter(a => a.ll);
      const coordinates = points.map(point => point.ll);
      for (const a of points) {
        L.marker(a.ll, { icon: L.divIcon({ className: '', html: `<i class="apin" style="--c:${ACATS[a.k][1]}">${pic()[a.k]}</i>`, iconSize: [34,34], iconAnchor: [17,30] }) })
          .on('click', () => { reveal(a.id); $('[data-addr="' + a.id + '"]', list)?.scrollIntoView({ block: 'nearest' }); }).addTo(markers);
      }
      if (myLocation) {
        L.marker(myLocation, { icon: L.divIcon({ className: '', html: '<i class="mepin"></i>', iconSize: [18,18] }), interactive: false }).addTo(markers);
        coordinates.push(myLocation);
      }
      if (coordinates.length) {
        if (!tiles) tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(addressMap);
        addressMap.fitBounds(coordinates, { padding: [28,28], maxZoom: 15 });
      } else if (tiles) { tiles.remove(); tiles = null; }
    };
    drawMap();
    requestAnimationFrame(() => { if (active) addressMap?.invalidateSize(); });
  }).catch(() => { if (active && box.isConnected) box.textContent = 'Карта недоступна'; });
};

export function editLibraryItem(screen) {
  if (screen === 'mat') {
    const mat = matById(S.mat);
    if (mat) openRecordEditor(mat.collection, mat.record, { deleted: pop });
  } else if (screen === 'prod') {
    const p = prodById(S.prod);
    if (p) openRecordEditor('products', p.record, { deleted: pop });
  } else if (S.cat === 'cards' && S.lcard) {
    const card = LCARDS.find(item => item.id === S.lcard);
    if (card) openRecordEditor('cards', card.record, { deleted: () => { S.lcard = null; } });
  }
}

