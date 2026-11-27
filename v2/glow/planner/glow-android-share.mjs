const cacheName = 'soroka-native-share';
const expiresIn = 120000;
const cacheKey = id => new URL(`./incoming-share/${id}`, import.meta.url).href;

export async function stageAndroidShare(raw) {
  const cache = await caches.open(cacheName);
  const now = Date.now();
  for (const key of await cache.keys()) {
    const entry = await cache.match(key);
    if (Number(entry?.headers.get('X-Flow-Expires')) <= now) await cache.delete(key);
  }
  const id = crypto.randomUUID();
  await cache.put(cacheKey(id), new Response(raw, {
    headers: { 'Content-Type': 'application/json', 'X-Flow-Expires': String(now + expiresIn) },
  }));
  return id;
}

export async function takeAndroidShare(id) {
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/.test(id)) return '';
  const cache = await caches.open(cacheName);
  const key = cacheKey(id);
  const entry = await cache.match(key);
  if (!entry || !await cache.delete(key) || Number(entry.headers.get('X-Flow-Expires')) <= Date.now()) return '';
  return entry.text();
}
