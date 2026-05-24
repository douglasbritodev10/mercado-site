const CACHE_NAME = 'casacanil-v2';
const assets = [
  './pagina.html',
  './manifest.json',
  './icon-192.jpeg',
  './icon-512.jpeg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assets);
    })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
