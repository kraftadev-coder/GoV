/**
 * CivicVoice — Service Worker
 * Module 8: Production Deployment
 *
 * PWA offline support with Cache-First strategy for static assets
 * and Network-First for API calls.
 *
 * Caching strategy:
 *   - Static assets (JS, CSS, images, fonts): Cache-First
 *   - API calls: Network-First with fallback
 *   - Navigation: Network-First with offline fallback
 *
 * Source: Implementation Plan Module 8, Feature Goal Matrix §"Network Reality"
 */

const CACHE_NAME = 'civicvoice-v1';
const STATIC_CACHE = 'civicvoice-static-v1';
const FONT_CACHE = 'civicvoice-fonts-v1';

// Static assets to precache on install
const PRECACHE_URLS = [
    '/',
    '/manifest.json',
];

// ─── Install: Precache essential assets ───
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// ─── Activate: Clean old caches ───
self.addEventListener('activate', (event) => {
    const currentCaches = [CACHE_NAME, STATIC_CACHE, FONT_CACHE];

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => !currentCaches.includes(name))
                        .map((name) => caches.delete(name))
                );
            })
            .then(() => self.clients.claim())
    );
});

// ─── Fetch: Routing strategy ───
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests (POST submissions go straight to network)
    if (request.method !== 'GET') return;

    // Skip admin routes — never cache admin data
    if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin')) return;

    // API calls: Network-First
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request, CACHE_NAME));
        return;
    }

    // Google Fonts: Cache-First (fonts rarely change)
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(cacheFirst(request, FONT_CACHE));
        return;
    }

    // Static assets (JS, CSS, images): Cache-First
    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirst(request, STATIC_CACHE));
        return;
    }

    // Navigation: Network-First with offline fallback
    if (request.mode === 'navigate') {
        event.respondWith(navigationHandler(request));
        return;
    }

    // Default: Network-First
    event.respondWith(networkFirst(request, CACHE_NAME));
});

// ─── Strategies ───

/**
 * Cache-First: Return cached version if available, else fetch and cache.
 */
async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return new Response('Offline', { status: 503 });
    }
}

/**
 * Network-First: Try network, fall back to cache.
 */
async function networkFirst(request, cacheName) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Navigation handler: Try network, fall back to cached index.html.
 * This enables SPA routing to work offline.
 */
async function navigationHandler(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put('/', response.clone());
        }
        return response;
    } catch {
        // Fall back to cached index page (SPA shell)
        const cached = await caches.match('/');
        if (cached) return cached;
        return new Response('CivicVoice is offline. Please check your connection.', {
            status: 503,
            headers: { 'Content-Type': 'text/html' },
        });
    }
}

// ─── Helpers ───

function isStaticAsset(pathname) {
    return /\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|eot|ico)$/i.test(pathname);
}
