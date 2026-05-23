const CACHE_NAME = 'casacanil-v7';
const ASSETS_TO_CACHE = [
  '/',
  '/pagina.html',
  '/manifest.json',
  '/icon-192.jpeg',
  '/icon-512.jpeg',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// Instalação e Cache de ficheiros estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cache aberto com sucesso');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Limpeza de caches antigos quando houver atualização
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Removendo cache antigo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estratégia de Busca (Fetch)
self.addEventListener('fetch', (event) => {
  // Ignorar pedidos para o Firebase (para não travar o banco de dados em tempo real)
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('firebaseinstallations.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Retorna o cache se encontrar, senão vai à rede
      return response || fetch(event.request).then((fetchResponse) => {
        // Opcional: Adicionar novos pedidos ao cache dinamicamente
        return fetchResponse;
      });
    }).catch(() => {
      // Se estiver offline e não tiver no cache, retorna a página principal
      if (event.request.mode === 'navigate') {
        return caches.match('/pagina.html');
      }
    })
  );
});
