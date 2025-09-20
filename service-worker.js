const CACHE_NAME = 'housing-onboarding-cache-v2';
const ASSETS = [
  './index.html',
  './assets/manifest.json',
  './assets/logo.svg',
  './assets/logo-192.png',
  './assets/logo-512.png',
  './sample_data.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Add assets individually; ignore failures (e.g., missing sample_data.json in some deployments)
    await Promise.all(
      ASSETS.map(async (url) => {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (res && res.ok) await cache.put(url, res);
        } catch (_) { /* ignore missing asset */ }
      })
    );
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    // Immediately control open pages
    self.clients && self.clients.claim && self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle GET requests; let others pass through
  if (request.method !== 'GET') return;
  // Only cache same-origin requests (avoid caching Firebase or other cross-origin APIs)
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return; // bypass caching for cross-origin
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) {
      // Update cache in background
      fetch(request).then(async (resp) => {
        try { if (resp && resp.ok) { const cache = await caches.open(CACHE_NAME); await cache.put(request, resp.clone()); } } catch {}
      }).catch(() => {});
      return cached;
    }
    try {
      const resp = await fetch(request);
      try { if (resp && resp.ok) { const cache = await caches.open(CACHE_NAME); await cache.put(request, resp.clone()); } } catch {}
      return resp;
    } catch (_) {
      // offline fallback: attempt cache again
      const fallback = await caches.match(request);
      return fallback || Response.error();
    }
  })());
});


