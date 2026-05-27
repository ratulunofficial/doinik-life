// Doinik Life — Service Worker
// Caches the app shell so the app loads instantly and works offline.
// Strategy: network-first (always try fresh content), fall back to cache when offline.
// Updated automatically on each deploy via the CACHE_NAME bump below.

const CACHE_NAME = 'daily-life-v3-premium';
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

// Activate: drop any old caches from previous versions, enable navigation
// preload for faster first paint, and take control of all clients.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
      // Navigation preload makes the browser kick off the network request for
      // the navigation in parallel with SW startup. Real-world it shaves
      // 50-200ms off cold-start on mobile.
      (async () => {
        if (self.registration.navigationPreload) {
          try { await self.registration.navigationPreload.enable(); } catch (_) {}
        }
      })(),
      self.clients.claim(),
    ])
  );
});

// Fetch: stale-while-revalidate for the shell (instant load + background refresh),
// network-first for everything else same-origin. Cross-origin requests
// (Firebase, Google fonts, gstatic) are NOT intercepted so live data sync still
// goes straight to the network.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // For navigation requests, prefer the cached shell for instant paint, then
  // refresh from the network in the background. Falls back to network if
  // nothing is cached yet.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match('/index.html') || await cache.match('/');
      const networkPromise = (async () => {
        try {
          // Use the navigation preload response if available (faster than re-fetching).
          const preload = await event.preloadResponse;
          const response = preload || await fetch(req);
          if (response && response.ok && response.type === 'basic') {
            cache.put(req, response.clone()).catch(() => {});
          }
          return response;
        } catch (_) {
          return cached || new Response('Offline', { status: 504 });
        }
      })();
      // Return cached immediately if we have it; otherwise wait for network.
      return cached || networkPromise;
    })());
    return;
  }

  // For non-navigation same-origin GETs: network-first, fallback to cache.
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
