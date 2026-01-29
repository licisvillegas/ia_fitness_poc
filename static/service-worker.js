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
    const logClient = (message, level = 'INFO') => {
        return fetch('/api/push/client-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, level, source: 'service-worker' })
        }).catch(() => { });
    };

    event.waitUntil((async () => {
        const meta = data.meta || {};
        await logClient(
            `SW push event received (context=${data.context || 'none'}, visibility=${meta.visibility || 'n/a'}, display_mode=${meta.display_mode || 'n/a'})`
        );

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
            vibrate: [200, 100, 200, 100, 200, 100, 200],
            tag: 'workout-timer',
            renotify: true,
            requireInteraction: true,
            data: {
                url: data.url || '/'
            }
        };

        await self.registration.showNotification(title, options);
        await logClient(
            `SW showNotification completed (context=${data.context || 'none'}, visibility=${meta.visibility || 'n/a'}, display_mode=${meta.display_mode || 'n/a'})`
        );
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    fetch('/api/push/client-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: 'SW notificationclick',
            level: 'INFO',
            source: 'service-worker',
            data: {
                tag: event.notification?.tag || null,
                url: event.notification?.data?.url || null,
                timestamp: Date.now()
            }
        })
    }).catch(() => { });
    // Normalize target URL to absolute for comparison
    const targetUrl = new URL(
        (event.notification.data && event.notification.data.url) || '/',
        self.location.origin
    ).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                // Compare absolute URLs
                // Compare pathnames to ignore query params mismatch
                const clientPath = new URL(client.url).pathname;
                const targetPath = new URL(targetUrl).pathname;

                if (clientPath === targetPath && 'focus' in client) {
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
