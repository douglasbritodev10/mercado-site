const CACHE_NAME = 'v6_casacanil'; // Subi para v6 para forçar o celular a atualizar
const assets = [
  './pagina.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Instalação e Cache
self.addEventListener('install', e => {
  self.skipWaiting(); // Força o novo SW a assumir o controle imediatamente
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

// Limpeza de caches antigos (Importante para o celular pegar seu JS novo)
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
});

// Interceptação de requisições
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request);
    })
  );
});

// --- SUPORTE A NOTIFICAÇÕES NO CELULAR ---
self.addEventListener('notificationclick', e => {
  e.notification.close(); // Fecha a notificação ao clicar
  e.waitUntil(
    clients.openWindow('./pagina.html') // Abre o app ao clicar na notificação
  );
});
