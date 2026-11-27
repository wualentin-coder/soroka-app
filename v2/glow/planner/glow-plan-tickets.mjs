const viewer = document.querySelector('#codev');
const codeArea = viewer.querySelector('.cva');
const kindSwitch = viewer.querySelector('#cvk');
const prototypePaintCode = paintCode;
let opener = null;
let bright = false;

const style = document.createElement('style');
style.textContent = `
  .screen[data-s="plan"] .tix > .tk:only-child { width: 100%; }
  #codev .cva img { display: block; width: 100%; object-fit: contain; pointer-events: none; }
  #codev .cva.k-qr img { max-width: 210px; aspect-ratio: 1; }
  #codev .cva.k-bar img { max-height: 120px; }
  #codev .cvk button:disabled { opacity: .45; }
  #codev .cvn { overflow-wrap: anywhere; }
`;
document.head.append(style);

function ticketCodes(ticket) {
  const rows = Array.isArray(ticket.codes) && ticket.codes.length ? ticket.codes : [{
    text: ticket.codeValue, seat: ticket.seat, kind: ticket.codeType,
  }];
  return rows.map(code => ({ ...code, kind: ['barcode', 'bar'].includes(code.kind) ? 'bar' : 'qr' }));
}

paintCode = () => {
  const view = CODEV;
  if (!view) return;
  if (!view.planTicket) {
    for (const button of kindSwitch.querySelectorAll('button')) button.disabled = false;
    prototypePaintCode();
    return;
  }

  const code = view.codes[view.i];
  if (!code.alt && view.view !== code.kind) view.view = null;
  const kind = view.view || code.kind;
  const svg = kind === code.kind ? code.svg : code.alt;
  viewer.querySelector('.cvt').innerHTML = `<small>${esc2(view.kick)}</small><b>${esc2(view.title)}</b>${view.sub ? `<span>${esc2(view.sub)}</span>` : ''}`;
  codeArea.className = `cva k-${kind}`;
  const showNumber = () => { codeArea.textContent = code.text ? 'Покажите номер' : 'Код не распознан'; };
  if (typeof svg === 'string' && /^\s*<svg[\s>]/i.test(svg)) {
    // Use the server's code as an image, outside the page's executable DOM.
    const image = document.createElement('img');
    image.draggable = false;
    image.alt = kind === 'qr' ? (view.kick === 'Карта' ? 'QR-код карты' : 'QR-код билета') : (view.kick === 'Карта' ? 'Штрихкод карты' : 'Штрихкод билета');
    image.onerror = () => { if (image.parentElement === codeArea) showNumber(); };
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    codeArea.replaceChildren(image);
  } else {
    showNumber();
  }
  kindSwitch.style.setProperty('--i', kind === 'qr' ? '0' : '1');
  for (const button of kindSwitch.querySelectorAll('[data-cvk]')) {
    button.classList.toggle('on', button.dataset.cvk === kind);
    button.disabled = button.dataset.cvk !== code.kind && !code.alt;
  }
  viewer.querySelector('.cvn').textContent = code.text || '';
  viewer.querySelector('.cvs').textContent = code.seat || '';
  viewer.querySelector('.cvd').innerHTML = view.codes.length > 1
    ? view.codes.map((_, i) => `<i class="${i === view.i ? 'on' : ''}"></i>`).join('') : '';
};

export function showSavedCode(view, button) {
  opener = button;
  if (view.kick === 'Карта' && typeof window.SorokaAndroid?.brightness === 'function') {
    try { window.SorokaAndroid.brightness(1); bright = true; } catch {}
  }
  openCode({ ...view, planTicket: true });
  viewer.querySelector('#cvx').focus({ preventScroll: true });
}

function clearTicket() {
  if (bright) {
    try { window.SorokaAndroid?.brightness?.(-1); } catch {}
    bright = false;
  }
  CODEV = null;
  for (const node of viewer.querySelectorAll('.cvt,.cva,.cvn,.cvs,.cvd')) node.replaceChildren();
}

new MutationObserver(() => {
  if (!opener || viewer.classList.contains('on')) return;
  if (CODEV?.planTicket) clearTicket();
  if (opener.isConnected) opener.focus({ preventScroll: true });
  opener = null;
}).observe(viewer, { attributes: true, attributeFilter: ['class'] });

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !CODEV?.planTicket || !viewer.classList.contains('on')) return;
  event.preventDefault();
  event.stopPropagation();
  closeCode();
}, true);

export function showPlanTicket(row, button) {
  const { ticket } = row;
  const kind = { train: 'Поезд', flight: 'Самолёт' }[ticket.ticketType] || 'Билет';
  opener = button;
  openCode({ planTicket: true, kick: `${kind} · ${row.when || `${row.d === 0 ? 'Сегодня' : inDays(row.d)} · ${row.tm}`}`, title: ticket.title,
    sub: [ticket.origin, ticket.destination].filter(Boolean).join(' → ') || row.pl, codes: ticketCodes(ticket) });
  viewer.querySelector('#cvx').focus({ preventScroll: true });
}

export function clearPlanTicket() {
  if (!CODEV?.planTicket) return;
  opener = null;
  viewer.classList.remove('on');
  viewer.setAttribute('aria-hidden', 'true');
  phone.classList.remove('coding');
  clearTicket();
}
