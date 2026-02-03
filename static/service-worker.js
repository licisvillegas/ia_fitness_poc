const CACHE_NAME = 'synapse-fit-v3';
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
    const url = new URL(request.url);

    // No interceptar llamadas a la API
    if (url.pathname.startsWith('/api/')) {
        return;
    }

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
        let payload = {};
        try {
            payload = event.data ? event.data.json() : {};
        } catch (e) {
            payload = { title: 'Synapse Fit', body: event.data ? event.data.text() : '' };
        }

        const title = payload.title || 'Synapse Fit';
        // Establecer explícitamente opciones de silencio/renotificación para un mejor manejo de vibración/sonido
        const options = {
            body: payload.body || '',
            icon: '/static/images/icon/synapse_fit_192.png',
            badge: '/static/images/icon/synapse_fit_192.png',
            vibrate: [200, 100, 200, 100, 200, 100, 200],
            tag: 'workout-timer',
            renotify: true, // Crucial para el sonido en temporizadores repetidos
            requireInteraction: true,
            data: {
                url: payload.url || '/',
                context: payload.context,
                meta: payload.meta
            }
        };

        // 1. Mostrar Notificación INMEDIATAMENTE (Crítico para iOS/Segundo plano)
        try {
            await self.registration.showNotification(title, options);
        } catch (e) {
            console.error('ShowNotification failed:', e);
        }

        // 2. Registrar después (Prioridad no bloqueante)
        try {
            const meta = payload.meta || {};
            await logClient(
                `SW notification shown (context=${payload.context || 'none'}, visibility=${meta.visibility || 'n/a'})`
            );
        } catch (e) {
            // Ignorar errores de registro
        }
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
    // Normalizar URL objetivo a absoluta para comparación
    const targetUrl = new URL(
        (event.notification.data && event.notification.data.url) || '/',
        self.location.origin
    ).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                // Comparar URLs absolutas
                // Comparar rutas (pathnames) para ignorar discrepancias en parámetros de consulta
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
