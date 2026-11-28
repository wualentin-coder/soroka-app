import { connectGlowSport } from './glow-practice-sport.mjs';
import { connectGlowEnglish } from './glow-practice-english.mjs';
import { connectGlowPiano } from './glow-practice-piano.mjs';
import { label } from './glow-practice-ui.mjs';

const practiceScreens = {
  sport: ['sprun', 'spset', 'spsetp', 'splib', 'spchat'],
  english: ['enrun', 'endeck', 'encourse', 'enphr', 'enprog', 'enlist', 'enchat', 'enread', 'ensong'],
  piano: ['pnrun'],
};
const focusRoutes = ['sprun', 'enrun', 'endeck', 'enread', 'enchat', 'pnrun'];

export function connectGlowPractice({ prototypeSport = false } = {}) {
  const routes = new Map(Object.entries(practiceScreens).filter(([kind]) => !prototypeSport || kind !== 'sport')
    .flatMap(([kind, list]) => list.map(id => [id, kind])));
  const views = {};
  let switchMotion = null;
  const style = document.createElement('style');
  style.textContent = `
    .glow-sport-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .glow-sport-actions .btn { flex: 1 1 auto; }
    .btn[data-practice-action] { gap: 8px; max-width: 100%; }
    .btn[data-practice-action] > svg { width: 18px; height: 18px; flex: none; }
    .glow-sport-home-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    .glow-muscles { position: relative; display: flex; align-items: center; justify-content: flex-start; padding: 10px; }
    .glow-muscles label { position: relative; min-width: 0; }
    .glow-muscles input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
    .glow-muscles .chip { height: auto; min-height: 36px; white-space: normal; text-align: center; }
    .glow-muscles input:checked + .chip { color: var(--a4); background: color-mix(in srgb, var(--a3) 22%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--a3) 68%, transparent); }
    .glow-muscles input:focus-visible + .chip { outline: 2px solid var(--a4); outline-offset: 2px; }
    .glow-practice-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .glow-practice-actions .btn { flex: 1 1 auto; }
    .glow-practice-form { display: grid; gap: 10px; margin: 10px 0; }
    .glass.glow-practice-form { padding: 12px; border-radius: 24px; }
    .glow-practice-form .syq { display: grid; gap: 4px; }
    .glow-practice-form textarea { width: 100%; resize: vertical; }
    .glow-practice-form details { display: block; }
    .glow-practice-form details ul { margin-left: 1.4em; }
    .glow-coach-messages { white-space: pre-wrap; overflow-wrap: anywhere; }
    .glow-practice-status { padding: 12px; }
    .glow-camera-preview { aspect-ratio: 4 / 3; border-radius: 22px; overflow: hidden; position: relative; }
    .glow-camera-preview video { width: 100%; height: 100%; object-fit: cover; display: block; }
    #sySheet [data-practice-camera] [hidden], .screen[data-s="ensong"] [hidden] { display: none !important; }
    [data-practice-camera] :is(.glow-practice-actions, [data-camera-measurement]), .screen[data-s="ensong"] [data-song-lyrics] { margin-top: 10px; }
    [data-practice-camera] .syq { margin-bottom: 8px; }
    [data-song-add] [data-song-results] { margin-top: 12px; }
    .glow-song-source[aria-pressed="true"], [data-song-line][aria-current="true"] {
      background: color-mix(in srgb, var(--a3) 19%, transparent);
    }
    .screen[data-s="ensong"] audio { max-width: 100%; width: 100%; }
    .phone :is(.glow-sport2-run:not(.prototype-sport-run), .glow-sport2-camera, .glow-sport2-history) {
      --page: var(--ink); --surface: var(--plate); --accent: var(--a4); --accent-ink: var(--ink);
      --line: color-mix(in srgb, var(--text) 17%, transparent);
      --surface-2: color-mix(in srgb, var(--text) 8%, var(--plate));
      width: min(390px, 100vw); height: min(844px, 100dvh); border-radius: 32px;
    }
    @media (max-width:480px) {
      .phone :is(.glow-sport2-run:not(.prototype-sport-run), .glow-sport2-camera, .glow-sport2-history) { width: 100vw; height: 100dvh; border-radius: 0; }
    }
    .screen[data-s="pnrun"] { padding: 0 0 28px; }
    .glow-piano-player {
      height: 100%; min-height: 0; contain: layout paint;
      --page: var(--ink); --surface: var(--plate);
      --surface-soft: color-mix(in srgb, var(--text) 8%, var(--plate));
      --surface-raised: color-mix(in srgb, var(--text) 12%, var(--plate));
      --line: color-mix(in srgb, var(--text) 17%, transparent);
      --subtle: var(--muted); --accent: var(--a4); --accent-strong: var(--a3); --accent-ink: var(--ink);
      --accent-soft: color-mix(in srgb, var(--a3) 19%, transparent);
      --warn: var(--a2); --warn-soft: color-mix(in srgb, var(--a2) 16%, transparent); --ease-out: var(--ease);
    }
    .glow-practice-workspace {
      --fu-text: var(--text); --fu-muted: var(--muted); --fu-accent: var(--a4);
      --fu-danger: var(--a2); --fu-line: color-mix(in srgb, var(--text) 17%, transparent);
      --fu-bg: color-mix(in srgb, var(--text) 6%, transparent); --fu-surface: var(--plate);
      --fu-font: Manrope, system-ui, sans-serif; --fu-display: var(--fu-font);
    }
    .phone.land:not(.pnplay) .head { opacity: 1; pointer-events: auto; }
    .phone.pnplay .head { visibility: hidden; }
    .phone.land .screen[data-s="pnrun"] { padding-top: 58px; }
    body:has(.pn-device-land) { padding: 0; }
    .phone.pn-device-land { width: 100vw; height: 100dvh; border-radius: 0; box-shadow: none; transition: none; }
    .phone.pn-device-land .screen[data-s="pnrun"] { padding: 0; }
    .phone.pn-device-land:not(.pnplay) .screen[data-s="pnrun"] { padding-top: 56px; }
  `;
  document.head.append(style);
  const home = () => $('.screen[data-s="practice"]');
  const selected = kind => curId() === 'practice' && S.prac === kind;
  const active = kind => selected(kind) || routes.get(curId()) === kind;
  function tiles(screen) {
    for (const [kind] of PRAC) {
      const tile = `[data-prac="${kind}"]`;
      const card = $(tile, screen);
      if (!card) continue;
      const model = views[kind].tile();
      card.setAttribute('aria-label', [card.querySelector('b')?.textContent, model.detail].filter(Boolean).join(', '));
      $('.plate-w', card)?.style.setProperty('--lvl', String(model.fraction || 0));
      $('.st', card)?.classList.toggle('ok', model.done === true);
    }
  }
  function redraw(kind) {
    if (curId() !== 'practice') return;
    const screen = home();
    tiles(screen);
    if (!selected(kind)) return;
    const body = $('#pracBody', screen);
    if (!body || body.dataset.practiceBody !== kind) return;
    const y = screen.scrollTop;
    const html = views[kind].render();
    body.innerHTML = html;
    views[kind].bind(body);
    screen.scrollTop = y;
    stagger(body);
  }
  const environment = { selected, active, redraw, updateTiles: () => tiles(home()) };
  views.sport = prototypeSport ? {
    render: R.sport, bind: body => bindSport(body.closest('.screen')),
    tile: () => ({}), open() {}, leave() {},
  } : connectGlowSport(environment);
  views.english = connectGlowEnglish(environment);
  views.piano = connectGlowPiano(environment);
  const landscapePhone = matchMedia('(orientation: landscape) and (max-height: 540px) and (pointer: coarse)');
  const landscapePreview = matchMedia('(min-width: 860px)');
  function orientation(id) {
    const pianoLandscape = id === 'pnrun' && landscapePhone.matches;
    phone.classList.toggle('pn-device-land', pianoLandscape);
    phone.classList.toggle('land', pianoLandscape || ['sprun', 'pnrun'].includes(id) && !!SPD.land
      && landscapePreview.matches && document.documentElement.dataset.glowAndroid !== 'true');
  }
  for (const media of [landscapePhone, landscapePreview]) media.addEventListener('change', () => orientation(curId()));
  pseg('spland', value => {
    SPD.land = value === 'land';
    orientation(curId());
  });
  if (!prototypeSport) spRunStart = () => go('sport');
  for (const [kind, view] of Object.entries(views)) R[kind] = view.render;
  for (const [id, kind] of routes) {
    R[id] = () => views[kind].screen(id);
    HEAD[id] = () => ['', views[kind].title(id)];
  }
  HEAD.practice = () => ['', 'Занятия'];
  R.practice = () => `
    <div class="practice" id="prac">${PRAC.map(([kind, icon, title]) => {
      const model = views[kind].tile();
      return `<button class="pr press${S.prac === kind ? ' on' : ''}" data-prac="${kind}" aria-pressed="${S.prac === kind}"
        aria-label="${label([title, model.detail].filter(Boolean).join(', '))}"><span class="plate-w" style="--lvl:${model.fraction || 0};display:block"><span class="halo"></span>
        <span class="plate"><span class="fill"></span><i class="st${model.done ? ' ok' : ''}"></i>${ic[icon].replace('<svg', '<svg class="glyph"')}<b>${title}</b></span></span></button>`;
    }).join('')}</div>
    <div id="pracBody" data-practice-body="${S.prac}" style="margin-top:14px">${R[S.prac]()}</div>`;
  const previousAfter = after;
  after = (id, screen) => {
    if (id !== 'practice' && !routes.has(id)) return previousAfter(id, screen);
    phone.classList.toggle('egfocus', focusRoutes.includes(id));
    phone.classList.remove('egchatting', 'pnplay');
    orientation(id);
    if (id !== 'practice') {
      views[routes.get(id)].bindScreen(id, screen);
      return;
    }
    const body = $('#pracBody', screen);
    views[S.prac].bind(body);
    void views[S.prac].open();
    $$('[data-prac]', screen).forEach(button => { button.onclick = () => {
      const kind = button.dataset.prac;
      if (kind === S.prac || !Object.hasOwn(views, kind)) return;
      const old = S.prac;
      const order = PRAC.map(row => row[0]);
      const dir = order.indexOf(kind) > order.indexOf(old) ? 1 : -1;
      S.prac = kind;
      views[old].leave('practice');
      switchMotion?.cancel();
      $$('[data-prac]', screen).forEach(item => {
        item.classList.toggle('on', item === button);
        item.setAttribute('aria-pressed', String(item === button));
      });
      const show = () => {
        if (!selected(kind) || !body.isConnected) return;
        body.dataset.practiceBody = kind;
        redraw(kind);
        void views[kind].open();
        if (window.glowSlide) {
          switchMotion = window.glowSlide(body, dir);
        } else if (!reduce) switchMotion = body.animate([{ opacity: 0, transform: `translateX(${60 * dir}px)` },
          { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.19,1,.22,1)' });
      };
      if (reduce || window.glowSlide) { show(); return; }
      blurPulse(12, 480);
      switchMotion = body.animate([{ opacity: 1, transform: 'none' },
        { opacity: 0, transform: `translateX(${-40 * dir}px)` }], { duration: 170, fill: 'forwards' });
      switchMotion.onfinish = () => { switchMotion.cancel(); show(); };
    }; });
  };
  const previousSwap = swap;
  function pianoRotation(enabled) {
    try { window.SorokaNative?.pianoRotation?.(enabled); } catch {}
  }
  swap = (from, to, direction) => {
    if (from === 'practice') switchMotion?.cancel();
    if (!routes.has(to)) phone.classList.remove('land', 'pn-device-land', 'pnplay');
    if (from !== to) {
      if (from === 'pnrun' || to === 'pnrun') pianoRotation(to === 'pnrun');
      const kind = routes.get(from) || (from === 'practice' && $('#pracBody', home())?.dataset.practiceBody);
      if (kind) views[kind].leave(from, to);
    }
    return previousSwap(from, to, direction);
  };
  window.addEventListener('pagehide', () => {
    if (curId() === 'pnrun') pianoRotation(false);
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted && curId() === 'pnrun') pianoRotation(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Object.values(views).forEach(view => view.suspend?.());
  });
  window.addEventListener('flow:suspend', () => Object.values(views).forEach(view => view.suspend?.()));
}
