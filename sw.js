const CACHE_NAME = 'v2_casacanil';

// Apenas arquivos que REALMENTE existem no seu GitHub
const assets = [
  './',
  './index.html',
  './pagina.html',
  './clientes.html',
  './historico.html',
  './manifest.json',
  './icon-192.jpeg',
  './icon-512.jpeg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Instalando cache...');
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
