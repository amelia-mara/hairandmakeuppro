/**
 * Hair & Makeup Pro - Service Worker
 * Stage 10: PWA Features
 *
 * Provides offline support and caching for the mobile PWA.
 */

const CACHE_NAME = 'hmp-cache-v1';
const STATIC_CACHE_NAME = 'hmp-static-v1';
const DYNAMIC_CACHE_NAME = 'hmp-dynamic-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
    '/mobile/',
    '/mobile/index.html',
    '/mobile/css/app.css',
    '/mobile/js/app.js',
    '/mobile/js/script-processor.js',
    '/mobile/js/photo-storage.js',
    '/mobile/manifest.json',
    '/mobile/icons/icon-192x192.png',
    '/mobile/icons/icon-512x512.png'
];

// External resources to cache
const EXTERNAL_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

// ============================================
// INSTALL EVENT
// ============================================
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');

    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets...');
                // Cache static assets
                return cache.addAll(STATIC_ASSETS)
                    .then(() => {
                        // Try to cache external assets (non-critical)
                        return Promise.allSettled(
                            EXTERNAL_ASSETS.map(url =>
                                cache.add(url).catch(err =>
                                    console.log('[SW] Failed to cache external:', url)
                                )
                            )
                        );
                    });
            })
            .then(() => {
                console.log('[SW] Static assets cached');
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Failed to cache static assets:', error);
            })
    );
});

// ============================================
// ACTIVATE EVENT
// ============================================
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            // Delete old caches
                            return name.startsWith('hmp-') &&
                                   name !== STATIC_CACHE_NAME &&
                                   name !== DYNAMIC_CACHE_NAME;
                        })
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service worker activated');
                // Take control of all clients immediately
                return self.clients.claim();
            })
    );
});

// ============================================
// FETCH EVENT
// ============================================
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http(s) requests
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // Handle different fetch strategies based on request type
    if (isStaticAsset(url)) {
        // Cache-first strategy for static assets
        event.respondWith(cacheFirst(request));
    } else if (isExternalAsset(url)) {
        // Cache-first for external assets (CDN)
        event.respondWith(cacheFirst(request));
    } else {
        // Network-first for dynamic content
        event.respondWith(networkFirst(request));
    }
});

// ============================================
// CACHING STRATEGIES
// ============================================

/**
 * Cache-first strategy
 * Try cache first, fallback to network
 */
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        // Return cached response, but update cache in background
        updateCache(request);
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);

        // Cache the new response
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        // Return offline fallback if available
        return getOfflineFallback(request);
    }
}

/**
 * Network-first strategy
 * Try network first, fallback to cache
 */
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);

        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        // Fallback to cache
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // Return offline fallback
        return getOfflineFallback(request);
    }
}

/**
 * Update cache in background
 */
async function updateCache(request) {
    try {
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            await cache.put(request, networkResponse);
        }
    } catch (error) {
        // Silently fail - we still have the cached version
    }
}

/**
 * Get offline fallback response
 */
async function getOfflineFallback(request) {
    const url = new URL(request.url);

    // For navigation requests, return the cached index.html
    if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
        const cachedIndex = await caches.match('/mobile/index.html');
        if (cachedIndex) {
            return cachedIndex;
        }
    }

    // Return a generic offline response
    return new Response(
        JSON.stringify({
            error: 'offline',
            message: 'You are currently offline. Please check your connection.'
        }),
        {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'application/json' }
        }
    );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if URL is a static asset
 */
function isStaticAsset(url) {
    const staticExtensions = ['.css', '.js', '.html', '.json', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2'];
    return url.pathname.startsWith('/mobile/') &&
           staticExtensions.some(ext => url.pathname.endsWith(ext));
}

/**
 * Check if URL is an external asset (CDN)
 */
function isExternalAsset(url) {
    return url.hostname === 'cdnjs.cloudflare.com' ||
           url.hostname === 'fonts.googleapis.com' ||
           url.hostname === 'fonts.gstatic.com';
}

// ============================================
// MESSAGE HANDLING
// ============================================
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then((names) => {
            Promise.all(names.map(name => caches.delete(name)))
                .then(() => {
                    event.ports[0].postMessage({ success: true });
                });
        });
    }
});

// ============================================
// BACKGROUND SYNC (for future sync features)
// ============================================
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-photos') {
        console.log('[SW] Background sync: photos');
        // Future: Implement photo sync to cloud
    }

    if (event.tag === 'sync-timesheets') {
        console.log('[SW] Background sync: timesheets');
        // Future: Implement timesheet sync to cloud
    }
});

// ============================================
// PUSH NOTIFICATIONS (for future features)
// ============================================
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();

    const options = {
        body: data.body || 'New update available',
        icon: '/mobile/icons/icon-192x192.png',
        badge: '/mobile/icons/badge-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/mobile/index.html'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Hair & Makeup Pro', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // Focus existing window if available
            for (const client of clientList) {
                if (client.url.includes('/mobile/') && 'focus' in client) {
                    return client.focus();
                }
            }
            // Open new window
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});

console.log('[SW] Service worker loaded');
