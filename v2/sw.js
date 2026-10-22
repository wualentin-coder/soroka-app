// Flow без интернета: страница и скрипты приложения — из кэша телефона.
//
// Данные и так лежат на телефоне (снимок в localStorage), но без сети не
// открывалась сама страница — и билет в поезде было не показать. Здесь:
// страница — сначала из сети (свежая версия), нет сети за 3 секунды — из кэша;
// скрипты и стили с отпечатком ?v= — из кэша (они не меняются); шрифты и
// библиотеки с CDN — из кэша с обновлением в фоне. Запросы к серверу Flow
// (POST) не трогаем: их отсутствие мост показывает плашкой «Нет связи».
const CACHE = "flow-3e7128f641";
const SHELL = ["./","./styles.css?v=7abd48afe1","./sections.css?v=fa16073769","./movie-player.css?v=0b1e058bdb","./movie-player.js?v=86fc7c64d9","./saved.js?v=0349bbcf08","./movies.js?v=52897be919","./recipes.js?v=2ee2969b2b","./goods.js?v=90d70ed4c3","./product-wishes.js?v=b6015f6bb5","./birthdays.js?v=8fa522397e","./sites.js?v=4b1ceed7a2","./vpn.js?v=68506f628c","./server.js?v=c98ab3d156","./pc.js?v=538a0814e3","./render-queue.js?v=9550088bf2","./card-logos.js?v=52040d6e58","./cards.js?v=a25d21a433","./card-swipe.js?v=1c084bc4c0","./address-map.js?v=4b0cf29181","./finance.js?v=f5155b8503","./more.js?v=e0c8a37b18","./capture.js?v=a841fbe2e4","./sections.js?v=157a8cfb14","./app.js?v=b36489870c","./notes.js?v=94b07efdd9","./note-editor.js?v=d301cab1bd","./voice.js?v=d3c1789428","./task-drag.js?v=d7ce68af9e","./motion.js?v=8f3d9f5083","./calendar-drag.js?v=d8550fc456","./activity-island.js?v=38463cce39","./assets/emblem-fixprice.svg?v=68300aceb7","./assets/emblem-lenta.svg?v=6997a861f3","./assets/emblem-magnit.svg?v=e7d9675565","./assets/emblem-perekrestok.svg?v=1c3ff214b6","./assets/emblem-pyaterochka.svg?v=5c15adf86f","./assets/logo-fixprice.svg?v=b901c6b835","./assets/logo-lenta.svg?v=5657a7ca72","./assets/logo-magnit.svg?v=d846b50191","./assets/logo-perekrestok.svg?v=24a5197915","./assets/logo-pyaterochka.svg?v=de74840471","./assets/paterson-cover.webp?v=81dde6ef2d","./assets/flow-logo.svg?v=7abced5cbb","./telegram-web-app.js?v=113b5c9cba","./live.css?v=a1bc72ff40","./bridge.js?v=d8c5b81de2"];

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
