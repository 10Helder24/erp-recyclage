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

// Limite de taille pour le cache (50 MB max)
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50 MB

// Fonction pour nettoyer le cache si trop volumineux
async function cleanCacheIfNeeded() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  let totalSize = 0;
  const entries = [];
  
  for (const key of keys) {
    const response = await cache.match(key);
    if (response) {
      const blob = await response.blob();
      const size = blob.size;
      totalSize += size;
      entries.push({ key: key, size: size });
    }
  }
  
  // Si le cache dépasse la limite, supprimer les plus anciennes entrées
  if (totalSize > MAX_CACHE_SIZE) {
    entries.sort((a, b) => a.size - b.size); // Supprimer les plus petites d'abord
    let sizeToRemove = totalSize - MAX_CACHE_SIZE;
    for (const entry of entries) {
      if (sizeToRemove <= 0) break;
      await cache.delete(entry.key);
      sizeToRemove -= entry.size;
    }
  }
}

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  // Ne pas mettre en cache les requêtes API volumineuses (PDFs, images)
  if (event.request.url.includes('/api/')) {
    const isLargeRequest = event.request.url.includes('/pdf') || 
                           event.request.url.includes('/download') ||
                           event.request.url.includes('base64');
    
    if (isLargeRequest) {
      // Pour les requêtes volumineuses, ne pas utiliser le cache
      event.respondWith(fetch(event.request));
      return;
    }
    
    // Stratégie Network First pour les API normales
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Ne mettre en cache que les petites réponses (< 1 MB)
          if (response.headers.get('content-length')) {
            const size = parseInt(response.headers.get('content-length') || '0', 10);
            if (size < 1024 * 1024) { // < 1 MB
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone).then(() => {
                  cleanCacheIfNeeded();
                });
              });
            }
          }
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
    // Ne mettre en cache que les petits assets (< 5 MB)
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const contentType = response.headers.get('content-type') || '';
          const isImage = contentType.startsWith('image/');
          const isLargeAsset = contentType.includes('pdf') || 
                              contentType.includes('video') ||
                              contentType.includes('application/octet-stream');
          
          // Ne pas mettre en cache les gros fichiers
          if (!isLargeAsset && (isImage || response.headers.get('content-length'))) {
            const size = parseInt(response.headers.get('content-length') || '0', 10);
            if (size < 5 * 1024 * 1024) { // < 5 MB
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseClone).then(() => {
                  cleanCacheIfNeeded();
                });
              });
            }
          }
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
