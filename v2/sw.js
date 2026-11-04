// Flow без интернета: страница и скрипты приложения — из кэша телефона.
//
// Данные и так лежат на телефоне (снимок в localStorage), но без сети не
// открывалась сама страница — и билет в поезде было не показать. Здесь:
// страница — сначала из сети (свежая версия), нет сети за 3 секунды — из кэша;
// скрипты и стили с отпечатком ?v= — из кэша (они не меняются); шрифты и
// библиотеки с CDN — из кэша с обновлением в фоне. Запросы к серверу Flow
// (POST) не трогаем: их отсутствие мост показывает плашкой «Нет связи».
const CACHE = "flow-3b6956467a";
const SHELL = ["./","./design-mode.css?v=9a05e3d6a0","./assets/manrope.css?v=00e4585c52","./styles.css?v=255529511f","./sections.css?v=75a1852657","./packing.css?v=bc7f42da08","./movie-player.css?v=0b1e058bdb","./movie-series.css?v=c864cf987a","./movie-universes.css?v=92d88479bf","./english.css?v=18115a9537","./english-music.css?v=4afb6846f9","./english-music-quiz.css?v=122f9b6a62","./english-browser.css?v=ea996cdbfd","./sport.css?v=e87c941833","./piano.css?v=2584768a6d","./assets/cormorant.css?v=5e7119b3aa","./digital-magic.css?v=92d25b49b3","./digital-windows.css?v=9fe41a5446","./digital-effects.css?v=552d46759b","./digital-layout.css?v=5b00f95ff4","./digital-pages.css?v=aa15676ab3","./digital-collections.css?v=9b5b378aa4","./digital-directory.css?v=dab4a6e1af","./digital-services.css?v=57c1c84e11","./digital-workspaces.css?v=fdd6aee326","./digital-icons.css?v=6cf4d55f48","./digital-learning.css?v=a2806fe22a","./digital-assistant.css?v=649588fdbf","./design-mode.js?v=527cb75cef","./movie-player.js?v=0fda78d56a","./saved.js?v=32846c92af","./movie-series.js?v=c3b2324a21","./movie-universes.js?v=6e01e0ad17","./movie-universe-status.js?v=57999d157e","./movie-universe-episodes.js?v=b491d832d1","./movie-marathon-cards.js?v=fc0fd565b4","./loop-deck.js?v=fdb0689cdf","./movie-carousel.js?v=903c70d1f6","./movies.js?v=f4e511e1f2","./recipes.js?v=a35bb7a125","./goods.js?v=fbd22b0a88","./product-wishes.js?v=b6015f6bb5","./birthdays.js?v=7e4240e22b","./sites.js?v=4b1ceed7a2","./vpn.js?v=67f482c70e","./server.js?v=e9537e8f86","./pc.js?v=2861a05007","./english-sync.js?v=29d14b5775","./english-music-import.js?v=f26e0e61f0","./english-music-media.js?v=368e691eb5","./english-music-remote.js?v=2ce8f2712a","./english-music-quiz.js?v=5d825081b6","./english-music.js?v=236808be43","./english-browser.js?v=e2971b7278","./english.js?v=e5395cb4ab","./sport-core.js?v=45cae9ab62","./sport.js?v=33ff58d43f","./sport-train.js?v=9c7fbd1905","./sport-plan.js?v=4725a6f0fa","./sport-more.js?v=8c9ddd8b60","./sport-fingers.js?v=583a827080","./sport-ai.js?v=e71074b322","./sport-assistant.js?v=72a3106f65","./render-queue.js?v=36ac70040a","./card-logos.js?v=52040d6e58","./cards.js?v=dcb7934637","./card-swipe.js?v=1c084bc4c0","./address-map.js?v=48c2939ebf","./finance.js?v=ff789b9674","./vault-crypto.js?v=44894fa796","./docs.js?v=8ecc60432e","./more.js?v=294ca9db2e","./capture.js?v=a841fbe2e4","./holidays.js?v=707e8c4040","./today-cards.js?v=659041b4d7","./sections.js?v=b8d5a7d318","./packing-core.js?v=42d1c55510","./packing.js?v=30074c8e0c","./sheet-state.js?v=c249cf4b04","./task-repeat.js?v=fb04dd4907","./piano/vendor/tone-midi.js?v=9165a2b3de","./piano.js?v=341c66b9ef","./app.js?v=225a8b9bfb","./notes.js?v=1327bb7588","./note-editor.js?v=d301cab1bd","./voice.js?v=7731bd9a42","./task-drag.js?v=d7ce68af9e","./native-window.js?v=b25a31fbec","./motion.js?v=a7efad2b0b","./calendar-drag.js?v=0f02462b44","./activity-island.js?v=643f68e54f","./digital-sound.js?v=3c27d0feab","./digital-icons.js?v=a0f9371442","./digital-pages.js?v=b91c1af853","./digital-collections.js?v=58cee095e7","./digital-directory.js?v=f1840da70c","./digital-services.js?v=5430d3fd5a","./digital-workspaces.js?v=1409e7ff79","./digital-learning.js?v=4ca392148f","./digital-runtime.js?v=730dc15909","./digital-brand.js?v=c57321afce","./digital-assistant.js?v=d3eea4dbc9","./digital-assistant-visual.js?v=b62dbdeb41","./digital-effects.js?v=3065372a0e","./digital-ecosystem.js?v=f80df2aebf","./assets/cormorant-garamond-cyrillic-500.woff2?v=30aec8d9cd","./assets/cormorant-garamond-cyrillic-ext-500.woff2?v=acab2d007a","./assets/cormorant-garamond-latin-500.woff2?v=8197bf5361","./assets/cormorant-garamond-latin-ext-500.woff2?v=3de1b0f235","./assets/CormorantGaramond-OFL.txt?v=60700d351c","./assets/emblem-fixprice.svg?v=68300aceb7","./assets/emblem-lenta.svg?v=6997a861f3","./assets/emblem-magnit.svg?v=e7d9675565","./assets/emblem-perekrestok.svg?v=1c3ff214b6","./assets/emblem-pyaterochka.svg?v=5c15adf86f","./assets/flow-vortex-magic-mono.svg?v=39172c27a3","./assets/flow-vortex-magic.svg?v=a2e75fa07f","./assets/logo-fixprice.svg?v=b901c6b835","./assets/logo-lenta.svg?v=5657a7ca72","./assets/logo-magnit.svg?v=d846b50191","./assets/logo-perekrestok.svg?v=24a5197915","./assets/logo-pyaterochka.svg?v=de74840471","./assets/manrope-cyrillic-2.woff2?v=447c49583b","./assets/manrope-cyrillic-ext-1.woff2?v=3c09135e88","./assets/manrope-latin-4.woff2?v=8c2def024c","./assets/manrope-latin-ext-3.woff2?v=2f73351190","./assets/Manrope-OFL.txt?v=58172e0c0f","./assets/music-alignments.json?v=2f4f0f5140","./assets/paterson-cover.webp?v=81dde6ef2d","./assets/paterson-poster-official.jpg?v=c7affcec0c","./assets/sport-figures.js?v=33f55b557c","./assets/sport-instruction.md?v=7f6822a1b1","./assets/flow-logo.svg?v=7abced5cbb","./piano/player.mjs?v=63e9fd53e452","./piano/player-template.mjs?v=63e9fd53e452","./piano/native.mjs?v=63e9fd53e452","./piano/state.mjs?v=63e9fd53e452","./piano/composition-cache.mjs?v=63e9fd53e452","./piano/course.mjs?v=63e9fd53e452","./piano/curriculum-data.mjs?v=63e9fd53e452","./piano/learning-path.mjs?v=63e9fd53e452","./piano/learning-goals.mjs?v=63e9fd53e452","./piano/session.mjs?v=63e9fd53e452","./piano/score.mjs?v=63e9fd53e452","./piano/transport.mjs?v=63e9fd53e452","./piano/timed-session.mjs?v=63e9fd53e452","./piano/timing-feedback.mjs?v=63e9fd53e452","./piano/teacher.mjs?v=63e9fd53e452","./piano/coach-feedback.mjs?v=63e9fd53e452","./piano/postplay-coach.mjs?v=63e9fd53e452","./piano/pitch.mjs?v=63e9fd53e452","./piano/note-gate.mjs?v=63e9fd53e452","./piano/polyphonic.mjs?v=63e9fd53e452","./piano/midi-input.mjs?v=63e9fd53e452","./piano/lesson-intro.mjs?v=63e9fd53e452","./piano/lesson-presenter.mjs?v=63e9fd53e452","./piano/learning-tempo.mjs?v=63e9fd53e452","./piano/keyboard-range.mjs?v=63e9fd53e452","./piano/notation.mjs?v=63e9fd53e452","./piano/native-route.mjs?v=63e9fd53e452","./piano/compositions.mjs?v=63e9fd53e452","./piano/beginner-songs.mjs?v=63e9fd53e452","./piano/fur-elise.mjs?v=63e9fd53e452","./piano/composition-study.mjs?v=63e9fd53e452","./piano/song-learning.mjs?v=63e9fd53e452","./piano/chord-session.mjs?v=63e9fd53e452","./piano/arrangement.mjs?v=63e9fd53e452","./piano/accompaniment.mjs?v=63e9fd53e452","./piano/early-input.mjs?v=63e9fd53e452","./piano/practice-section.mjs?v=63e9fd53e452","./piano/flow-progression.mjs?v=63e9fd53e452","./piano/fingering.mjs?v=63e9fd53e452","./piano/practice-policy.mjs?v=63e9fd53e452","./piano/practice-visuals.mjs?v=63e9fd53e452","./piano/microlearning.mjs?v=63e9fd53e452","./piano/microlearning-data.mjs?v=63e9fd53e452","./piano/microlearning-progress.mjs?v=63e9fd53e452","./piano/microstep-ui.mjs?v=63e9fd53e452","./piano/song-microlearning.mjs?v=63e9fd53e452","./piano/lesson-guides.mjs?v=63e9fd53e452","./piano/fingering-data.mjs?v=63e9fd53e452","./piano/fingering-cues.mjs?v=63e9fd53e452","./piano/mixed-practice.mjs?v=63e9fd53e452","./piano/support-policy.mjs?v=63e9fd53e452","./piano/fonts/Bravura.woff2?v=e68df66446","./piano/fonts/Bravura-LICENSE.txt?v=c24929be70","./piano/fonts/README.md?v=c3bbea04a3","./piano/covers/moon.svg?v=e668463e36","./piano/covers/elise.svg?v=d5212b588f","./piano/covers/joy.svg?v=f5132172b6","./piano/covers/star.svg?v=c5db23ae3f","./piano/covers/custom.svg?v=fd5d49e421","./piano/vendor/tone-midi.LICENSE?v=19302b65bb","./piano/vendor/MUTOPIA-FUR-ELISE.LICENSE?v=f6848e3bfb","./piano/player.css?v=8fab476fa3","./piano/manifest.json?v=068b2ef3a0","./telegram-web-app.js?v=113b5c9cba","./live.css?v=22a82ed3e6","./bridge.js?v=d250fbdf0e"];

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
      const kept = await cache.match("./index.html") || await cache.match("./");
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
