// Bump this version on each deploy to force the SW to update.
const CACHE = 'ascend-v3';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api')) return;

  // NETWORK-FIRST for navigations/HTML so new deploys show up immediately
  // (no reinstall needed). Falls back to cache only when offline.
  if (request.mode === 'navigate' || request.destination === 'document') {
    e.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match('/app')))
    );
    return;
  }

  // Stale-while-revalidate for other assets.
  e.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});

self.addEventListener('push', (e) => {
  let data = { title: 'Ascend', body: 'Time to show up.' };
  try { if (e.data) data = e.data.json(); } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'Ascend', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/app' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/app';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
