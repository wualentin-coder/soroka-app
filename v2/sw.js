// Flow без интернета: страница и скрипты приложения — из кэша телефона.
//
// Данные и так лежат на телефоне (снимок в localStorage), но без сети не
// открывалась сама страница — и билет в поезде было не показать. Здесь:
// страница — сначала из сети (свежая версия), нет сети за 3 секунды — из кэша;
// скрипты и стили с отпечатком ?v= — из кэша (они не меняются); шрифты и
// библиотеки с CDN — из кэша с обновлением в фоне. Запросы к серверу Flow
// (POST) не трогаем: их отсутствие мост показывает плашкой «Нет связи».
const CACHE = "flow-8ea79b6e1b";
const SHELL = ["./","./styles.css?v=e42157b8e6","./sections.css?v=399c8ab8f6","./movie-player.css?v=0b1e058bdb","./movie-series.css?v=c864cf987a","./movie-universes.css?v=e4672f16be","./english.css?v=fad4c646e1","./sport.css?v=a076678ad3","./sleep.css?v=cc91bab3cf","./movie-player.js?v=0fda78d56a","./saved.js?v=13b44063d0","./movie-series.js?v=cd275959a4","./movie-universes.js?v=055e7e6727","./movie-universe-status.js?v=57999d157e","./movie-universe-episodes.js?v=b491d832d1","./movie-marathon-cards.js?v=61760ebbfe","./loop-deck.js?v=fdb0689cdf","./movie-carousel.js?v=e93de7a676","./movies.js?v=d1b03a6194","./recipes.js?v=a35bb7a125","./goods.js?v=fbd22b0a88","./product-wishes.js?v=b6015f6bb5","./birthdays.js?v=7e4240e22b","./sites.js?v=4b1ceed7a2","./vpn.js?v=68506f628c","./server.js?v=072fc7694d","./pc.js?v=f3f0de8b9b","./english-sync.js?v=29d14b5775","./english.js?v=871c80600c","./sport-core.js?v=819a71dc88","./sport.js?v=46363923d9","./sport-train.js?v=9c7fbd1905","./sport-plan.js?v=4725a6f0fa","./sport-more.js?v=bb6d6c7374","./sport-ai.js?v=e71074b322","./sport-assistant.js?v=72a3106f65","./sleep.js?v=9dacc5e92b","./render-queue.js?v=bc9bc7c945","./card-logos.js?v=52040d6e58","./cards.js?v=a25d21a433","./card-swipe.js?v=1c084bc4c0","./address-map.js?v=984a959754","./finance.js?v=d6659b411e","./vault-crypto.js?v=44894fa796","./docs.js?v=839cc1a66b","./more.js?v=90fd55be19","./capture.js?v=a841fbe2e4","./holidays.js?v=707e8c4040","./sections.js?v=f920f11e23","./sheet-state.js?v=40a3046ceb","./app.js?v=5ec9f60f74","./notes.js?v=f411f92b63","./note-editor.js?v=d301cab1bd","./voice.js?v=d3c1789428","./task-drag.js?v=d7ce68af9e","./motion.js?v=78effb6c7c","./calendar-drag.js?v=d8550fc456","./activity-island.js?v=ca8559eed2","./assets/emblem-fixprice.svg?v=68300aceb7","./assets/emblem-lenta.svg?v=6997a861f3","./assets/emblem-magnit.svg?v=e7d9675565","./assets/emblem-perekrestok.svg?v=1c3ff214b6","./assets/emblem-pyaterochka.svg?v=5c15adf86f","./assets/logo-fixprice.svg?v=b901c6b835","./assets/logo-lenta.svg?v=5657a7ca72","./assets/logo-magnit.svg?v=d846b50191","./assets/logo-perekrestok.svg?v=24a5197915","./assets/logo-pyaterochka.svg?v=de74840471","./assets/paterson-cover.webp?v=81dde6ef2d","./assets/sport-figures.js?v=33f55b557c","./assets/sport-instruction.md?v=7f6822a1b1","./assets/flow-logo.svg?v=7abced5cbb","./telegram-web-app.js?v=113b5c9cba","./live.css?v=1a3e48f355","./bridge.js?v=01f1b254df"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("flow-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const CDN = /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com)\//;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);

  if (req.mode === "navigate" && url.origin === scope.origin && url.pathname.startsWith(scope.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const network = fetch(req).then((res) => { if (res.ok) cache.put("./index.html", res.clone()); return res; });
      const timeout = new Promise((resolve) => setTimeout(resolve, 3000, null));
      const first = await Promise.race([network.catch(() => null), timeout]);
      if (first) return first;
      const kept = await cache.match("./index.html");
      return kept || network;
    })());
    return;
  }

  if (url.origin === scope.origin && url.pathname.startsWith(scope.pathname)) {
    event.respondWith(caches.open(CACHE).then(async (cache) => {
      const kept = await cache.match(req) || (url.search ? null : await cache.match(req, { ignoreSearch: true }));
      if (kept) return kept;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }));
    return;
  }

  if (CDN.test(req.url)) {
    event.respondWith(caches.open("cdn-flow").then(async (cache) => {
      const kept = await cache.match(req);
      const fresh = fetch(req).then((res) => { if (res.ok || res.type === "opaque") cache.put(req, res.clone()); return res; }).catch(() => null);
      return kept || (await fresh) || Response.error();
    }));
  }
});
