// Service Worker pour le mode offline
// Version: mise à jour automatique à chaque déploiement
const CACHE_NAME = 'erp-retripa-v' + new Date().getTime(); // Version dynamique basée sur timestamp
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Installation - Force l'activation immédiate
self.addEventListener('install', (event) => {
  console.log('[SW] Installation du nouveau Service Worker');
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(OFFLINE_URLS))
      .catch((err) => console.error('[SW] cache open/addAll error', err))
  );
  // Force l'activation immédiate sans attendre la fermeture des onglets
  self.skipWaiting();
});

// Activation - Nettoie les anciens caches et prend le contrôle immédiatement
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation du nouveau Service Worker');
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log('[SW] Suppression de l\'ancien cache:', cacheName);
              return caches.delete(cacheName);
            })
        )
      )
      .then(() => self.clients.claim())
      .catch((err) => console.error('[SW] activation cleanup error', err))
  );
});

// Message pour forcer la mise à jour
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'FORCE_UPDATE') {
    // Supprimer tous les caches et recharger
    caches
      .keys()
      .then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))))
      .then(() => self.clients.matchAll())
      .then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'FORCE_RELOAD' }));
      })
      .catch((err) => console.error('[SW] force update error', err));
  }
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  // Stratégie Network First pour les API
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Si la requête réussit, mettre en cache
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Si offline, retourner depuis le cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Retourner une réponse par défaut pour les API
            return new Response(
              JSON.stringify({ error: 'Mode hors ligne', offline: true }),
              {
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
  } else {
    // Stratégie Network First avec fallback cache pour les assets
    // Cela permet de toujours récupérer la dernière version
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Si la requête réussit, mettre à jour le cache
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Si offline, retourner depuis le cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // En cas d'erreur réseau, retourner une réponse offline
            return new Response('Mode hors ligne', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'text/plain' }
            });
          });
        })
    );
  }
});

// Gestion des notifications push
self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (error) {
    console.error('Erreur lors du parsing des données push:', error);
    // En cas d'erreur, utiliser les données par défaut
    data = {};
  }
  
  const title = data.title || 'Nouvelle notification';
  const options = {
    body: data.body || 'Vous avez une nouvelle notification',
    icon: '/icons/erp2-192.png',
    badge: '/icons/erp2-192.png',
    data: data
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Gestion des clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
