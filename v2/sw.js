// Flow без интернета: страница и скрипты приложения — из кэша телефона.
//
// Данные и так лежат на телефоне (снимок в localStorage), но без сети не
// открывалась сама страница — и билет в поезде было не показать. Здесь:
// страница — сначала из сети (свежая версия), нет сети за 3 секунды — из кэша;
// скрипты и стили с отпечатком ?v= — из кэша (они не меняются); шрифты и
// библиотеки с CDN — из кэша с обновлением в фоне. Запросы к серверу Flow
// (POST) не трогаем: их отсутствие мост показывает плашкой «Нет связи».
const CACHE = "flow-3968a61d4c";
const SHELL = ["./","./styles.css?v=7abd48afe1","./sections.css?v=671cb67235","./movie-player.css?v=0b1e058bdb","./english.css?v=9ed36d6c0c","./sport.css?v=5a188bfca7","./movie-player.js?v=ed97f34cdc","./saved.js?v=748f4012ee","./loop-deck.js?v=53482c5d58","./movie-carousel.js?v=c8c6666684","./movies.js?v=d480164057","./recipes.js?v=a35bb7a125","./goods.js?v=fbd22b0a88","./product-wishes.js?v=b6015f6bb5","./birthdays.js?v=7e4240e22b","./sites.js?v=4b1ceed7a2","./vpn.js?v=68506f628c","./server.js?v=072fc7694d","./pc.js?v=e6dce3ce4e","./english-sync.js?v=29d14b5775","./english.js?v=28d40fae93","./sport-core.js?v=8b7ad7c700","./sport.js?v=84cc078ab2","./sport-train.js?v=ed27d17be2","./sport-plan.js?v=a578316676","./sport-more.js?v=758d8af175","./render-queue.js?v=964566dd70","./card-logos.js?v=52040d6e58","./cards.js?v=a25d21a433","./card-swipe.js?v=1c084bc4c0","./address-map.js?v=984a959754","./finance.js?v=5de55c1224","./vault-crypto.js?v=44894fa796","./docs.js?v=839cc1a66b","./more.js?v=c7df86f48b","./capture.js?v=a841fbe2e4","./holidays.js?v=707e8c4040","./sections.js?v=65122bb326","./app.js?v=2760f30930","./notes.js?v=f411f92b63","./note-editor.js?v=d301cab1bd","./voice.js?v=d3c1789428","./task-drag.js?v=d7ce68af9e","./motion.js?v=8f3d9f5083","./calendar-drag.js?v=d8550fc456","./activity-island.js?v=38463cce39","./assets/emblem-fixprice.svg?v=68300aceb7","./assets/emblem-lenta.svg?v=6997a861f3","./assets/emblem-magnit.svg?v=e7d9675565","./assets/emblem-perekrestok.svg?v=1c3ff214b6","./assets/emblem-pyaterochka.svg?v=5c15adf86f","./assets/logo-fixprice.svg?v=b901c6b835","./assets/logo-lenta.svg?v=5657a7ca72","./assets/logo-magnit.svg?v=d846b50191","./assets/logo-perekrestok.svg?v=24a5197915","./assets/logo-pyaterochka.svg?v=de74840471","./assets/paterson-cover.webp?v=81dde6ef2d","./assets/sport-figures.js?v=33f55b557c","./assets/sport-instruction.md?v=25d1fed5cf","./assets/flow-logo.svg?v=7abced5cbb","./telegram-web-app.js?v=113b5c9cba","./live.css?v=1ce2b8e2cb","./bridge.js?v=25229f7f44"];

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
