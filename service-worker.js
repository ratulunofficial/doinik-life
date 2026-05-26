// Daily Life — Service Worker
// Caches the app shell so the app loads instantly and works offline.
// Strategy: network-first (always try fresh content), fall back to cache when offline.
// Updated automatically on each deploy via the CACHE_NAME bump below.

const CACHE_NAME = 'daily-life-v2';
const SHELL_URLS = ['/', '/index.html', '/about.html', '/privacy.html', '/terms.html', '/manifest.json'];

// Install: pre-cache the app shell so first offline launch works.
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(SHELL_URLS).catch(() => {
        // Best-effort pre-cache; if it fails we'll still cache on first fetch.
      })
    )
  );
});

// Activate: drop any old caches from previous versions and take control.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
});

// Fetch: network-first for same-origin GETs, fall back to cache when offline.
// Cross-origin requests (Firebase, Google fonts, gstatic) are NOT intercepted
// so live data sync still goes straight to the network.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response && response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        // Last-resort: serve the cached shell for any navigation request.
        if (req.mode === 'navigate') {
          const shell = await caches.match('/') || await caches.match('/index.html');
          if (shell) return shell;
        }
        return new Response('Offline — no cached copy available.', {
          status: 504,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
  );
});

// Allow the page to force-update the SW (e.g. on user-triggered refresh).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
