const STATIC_CACHE = 'cifrashub-static-v3';
const PAGES_CACHE = 'cifrashub-pages-v3';
const KNOWN_CACHES = [STATIC_CACHE, PAGES_CACHE];
const MAX_PAGE_ENTRIES = 50;

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', handleInstall);
self.addEventListener('activate', handleActivate);
self.addEventListener('fetch', handleFetch);

function handleInstall(event) {
  event.waitUntil(precacheAssets());
  self.skipWaiting();
}

function precacheAssets() {
  return caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS));
}

function handleActivate(event) {
  event.waitUntil(cleanOldCaches());
  self.clients.claim();
}

function cleanOldCaches() {
  return caches
    .keys()
    .then((keys) => Promise.all(keys.filter(isOldCache).map(deleteCache)));
}

function isOldCache(key) {
  return !KNOWN_CACHES.includes(key);
}

function deleteCache(key) {
  return caches.delete(key);
}

function handleFetch(event) {
  const { request } = event;
  const url = new URL(request.url);

  if (shouldSkipRequest(request, url)) return;
  if (isStaticNextAsset(url)) return event.respondWith(cacheFirstWithStore(request));
  if (isPublicAsset(url)) return event.respondWith(cacheFirst(request));

  event.respondWith(networkFirst(request));
}

function shouldSkipRequest(request, url) {
  return request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/');
}

function isStaticNextAsset(url) {
  return url.pathname.startsWith('/_next/static/');
}

function isPublicAsset(url) {
  return publicAssetPattern().test(url.pathname) || url.pathname === '/manifest.json';
}

function publicAssetPattern() {
  return /\.(png|ico|svg|webp|jpg|jpeg|gif|woff2?|ttf)$/;
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => cached || fetch(request));
}

function cacheFirstWithStore(request) {
  return caches.match(request).then((cached) => cached || fetchAndStore(request));
}

function networkFirst(request) {
  return fetch(request)
    .then((response) => storeIfOk(PAGES_CACHE, request, response))
    .catch(() => caches.match(request).then((cached) => cached || caches.match('/')));
}

function fetchAndStore(request) {
  return fetch(request).then((response) => storeIfOk(STATIC_CACHE, request, response));
}

function isCacheable(response) {
  const control = (response.headers.get('Cache-Control') || '').toLowerCase();
  return response.ok && !control.includes('no-store') && !control.includes('private');
}

function storeIfOk(cacheName, request, response) {
  if (isCacheable(response)) {
    const clone = response.clone();
    caches.open(cacheName).then((cache) =>
      cache.put(request, clone).then(() => (cacheName === PAGES_CACHE ? trimCache(cache) : undefined)),
    );
  }
  return response;
}

// Cache.keys() returns entries in insertion order, so the oldest come first.
function trimCache(cache) {
  return cache.keys().then((keys) =>
    Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_PAGE_ENTRIES)).map((key) => cache.delete(key))),
  );
}
