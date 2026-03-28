// Deep Research Generator — Service Worker v1
// Caches the app shell for offline use

const CACHE_NAME = 'drg-v1';

// Files to cache on install (the app shell)
const PRECACHE = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Source+Serif+4:ital,wght@0,300;0,400;0,600;1,400&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

// ── Install: pre-cache app shell ─────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Use individual adds so one failed external resource doesn't block install
      return Promise.allSettled(PRECACHE.map(url => cache.add(url).catch(() => {})));
    })
  );
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: Network-first for API calls, Cache-first for assets ───────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Always go network-first for API calls (Groq / Cerebras)
  if (url.includes('api.groq.com') || url.includes('api.cerebras.ai')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For everything else: try cache first, fall back to network, cache the result
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Only cache valid same-origin or CORS responses
        if (response && response.status === 200 &&
            (response.type === 'basic' || response.type === 'cors')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // If both cache and network fail — return a simple offline page for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
