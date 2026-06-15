const CACHE_NAME = 'cifrashub-v1';

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
  return caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS));
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
  return key !== CACHE_NAME;
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
    .then((response) => storeIfOk(request, response))
    .catch(() => caches.match(request).then((cached) => cached || caches.match('/')));
}

function fetchAndStore(request) {
  return fetch(request).then((response) => storeIfOk(request, response));
}

function storeIfOk(request, response) {
  if (response.ok) {
    const clone = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
  }
  return response;
}
