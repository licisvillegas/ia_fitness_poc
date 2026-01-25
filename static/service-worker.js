const CACHE_NAME = 'synapse-fit-v2';
const OFFLINE_URL = '/offline.html';
const ASSETS_TO_CACHE = [
    OFFLINE_URL,
    '/',
    '/static/css/theme.css',
    '/static/css/sidebar.css',
    '/static/css/loader.css',
    '/static/js/lang.js',
    '/static/js/theme.js',
    '/static/js/loader.js',
    '/static/images/icon/synapse_fit_192.png',
    '/static/images/icon/synapse_fit_512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(async () => {
                const cache = await caches.open(CACHE_NAME);
                return cache.match(OFFLINE_URL);
            })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((response) => response || fetch(request))
    );
});

self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: 'AI Fitness', body: event.data ? event.data.text() : '' };
    }

    const title = data.title || 'AI Fitness';
    const options = {
        body: data.body || '',
        icon: '/static/images/icon/synapse_fit_192.png',
        badge: '/static/images/icon/synapse_fit_192.png',
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === targetUrl && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
            return undefined;
        })
    );
});
