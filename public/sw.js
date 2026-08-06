const CACHE_NAME = 'typstlab-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
  'https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignore non-HTTP/HTTPS schemes (e.g. chrome-extension://, moz-extension://, data:)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Bypass backend API endpoints from Service Worker caching
  if (
    url.pathname === '/health' ||
    url.pathname.endsWith('/health') ||
    url.pathname.startsWith('/projects') ||
    url.pathname.startsWith('/files') ||
    url.pathname === '/login' ||
    url.pathname === '/register' ||
    url.pathname === '/refresh' ||
    url.pathname === '/logout'
  ) {
    return;
  }

  // Network-first strategy with cache fallback to prevent React module version mismatch
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Offline fallback: attempt exact match first, then ignore query parameters
        const cachedResponse =
          (await caches.match(event.request)) ||
          (await caches.match(event.request, { ignoreSearch: true }));

        if (cachedResponse) {
          return cachedResponse;
        }

        // If navigating and offline, return cached root index.html
        if (event.request.mode === 'navigate') {
          return (await caches.match('/index.html')) || (await caches.match('/'));
        }

        return new Response('Offline resource not available', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
  );
});
