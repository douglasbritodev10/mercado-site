const CACHE_NAME = 'v1_casacanil';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(['index.html', 'dashboard.html', 'clientes.html', 'historico.html'])));
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
