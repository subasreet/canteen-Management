// ===================================================================
// College Canteen Progressive Web App (PWA) Service Worker
// Version: 1.0.0
// ===================================================================

const CACHE_NAME = 'canteen-shell-v1';
const DATA_CACHE_NAME = 'canteen-data-v1';

// Static assets to precache for offline application shell
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png'
];

// -------------------------------------------------------------------
// 1. INSTALL LIFECYCLE
// -------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Precache assets gracefully
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Precache partial warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// -------------------------------------------------------------------
// 2. ACTIVATE LIFECYCLE
// -------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME && name !== DATA_CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// -------------------------------------------------------------------
// 3. FETCH STRATEGY
// -------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // A. Only process HTTP/HTTPS GET requests; pass mutations (POST, PUT, DELETE) directly
  if (request.method !== 'GET') {
    return;
  }

  // B. API Requests Strategy
  if (url.pathname.startsWith('/api/')) {
    // Menu items (GET /api/food-items): Network-First with Cache Fallback
    if (url.pathname === '/api/food-items') {
      event.respondWith(
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(DATA_CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(async () => {
            // Offline fallback: serve cached menu items
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response(JSON.stringify([]), {
              headers: { 'Content-Type': 'application/json' }
            });
          })
      );
      return;
    }

    // Other GET APIs (e.g. orders, db-status): Network-First, don't crash when offline
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response(JSON.stringify({ offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // C. Navigation Requests (HTML Pages): Stale-While-Revalidate with fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('/index.html');
        })
    );
    return;
  }

  // D. Static Assets (Icons, Images, Scripts): Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // network failure, cachedResponse will be returned
      });

      return cachedResponse || fetchPromise;
    })
  );
});
