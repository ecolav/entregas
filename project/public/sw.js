// Bump version to force update
const SW_VERSION = 'v2025-10-01-6';

self.addEventListener('push', event => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'ECOLAV';
    const body = data.body || '';
    const url = data.url || '/';
    event.waitUntil(self.registration.showNotification(title, {
      body,
      icon: '/ecolav.png',
      badge: '/ecolav.png',
      data: { url }
    }));
  } catch {
    event.waitUntil(self.registration.showNotification('ECOLAV', { body: 'Nova notificação' }));
  }
});

// Activate: claim clients and clear old caches to avoid stale UI
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
    } catch {}
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.matchAll({ type: 'window' }).then(windowClients => {
    for (const client of windowClients) {
      if ('focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});


