(function () {
    const state = {
        vapidKey: null,
        syncing: false
    };

    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const loadVapidKey = async () => {
        if (state.vapidKey) return state.vapidKey;
        const res = await fetch('/api/push/vapid-public-key', { credentials: 'include' });
        if (!res.ok) return null;
        const data = await res.json();
        state.vapidKey = data.publicKey || null;
        return state.vapidKey;
    };

    const syncSubscription = async (subscription) => {
        if (!subscription) return false;
        const payload = { subscription: subscription.toJSON ? subscription.toJSON() : subscription };
        const res = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        return res.ok;
    };


    const debugLog = (msg) => {
        console.log('[PushManager]', msg);
        fetch('/api/push/client-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg })
        }).catch(() => { });
    };

    const ensurePushSubscription = async () => {
        debugLog('ensurePushSubscription called');
        if (state.syncing) {
            debugLog('Already syncing, skipping');
            return false;
        }

        if (!('serviceWorker' in navigator)) {
            debugLog('No ServiceWorker support');
            return false;
        }
        if (!('PushManager' in window)) {
            debugLog('No PushManager support');
            return false;
        }
        if (!('Notification' in window)) {
            debugLog('No Notification support');
            return false;
        }

        const perm = Notification.permission;
        debugLog(`Notification permission: ${perm}`);

        if (perm === 'default') {
            try {
                debugLog('Requesting permission...');
                const result = await Notification.requestPermission();
                debugLog(`Permission request result: ${result}`);
                if (result !== 'granted') return false;
            } catch (e) {
                debugLog(`Permission request error: ${e.message}`);
                console.warn('Permission request error', e);
                return false;
            }
        } else if (perm !== 'granted') {
            debugLog('Permission denied or ignored');
            return false;
        }

        state.syncing = true;
        try {
            debugLog('Waiting for SW ready...');
            const reg = await navigator.serviceWorker.ready;
            debugLog(`SW Ready. Scope: ${reg.scope}`);

            let sub = await reg.pushManager.getSubscription();
            debugLog(`Existing subscription: ${sub ? 'Yes' : 'No'}`);

            debugLog('Loading VAPID key...');
            const newKey = await loadVapidKey();
            if (!newKey) {
                debugLog('Failed to load VAPID key');
                return false;
            }

            // Comprobar si la suscripción existente es válida para la clave actual
            if (sub) {
                // Determinar si necesitamos reemplazar la suscripción
                let needsReplacement = false;

                // Comparar claves si están disponibles en opciones (algunos navegadores lo soportan)
                // Si no es propiedad estándar, podríamos asumir ciegamente que es buena O forzar actualización si sospechamos problemas
                // Para robustez en esta fase de depuración: si las claves cambiaron, DEBEMOS resuscribirnos.
                // Convirtiendo ArrayBuffers para comparar
                const existingKey = sub.options.applicationServerKey;
                if (existingKey) {
                    const newKeyArray = urlBase64ToUint8Array(newKey);
                    // Comparación simple
                    const existingArray = new Uint8Array(existingKey);
                    let match = true;
                    if (existingArray.length !== newKeyArray.length) {
                        match = false;
                    } else {
                        for (let i = 0; i < existingArray.length; i++) {
                            if (existingArray[i] !== newKeyArray[i]) {
                                match = false;
                                break;
                            }
                        }
                    }
                    if (!match) {
                        debugLog('VAPID Key mismatch detected. Rotation required.');
                        needsReplacement = true;
                    }
                } else {
                    // Chrome a veces oculta options.applicationServerKey
                    // Si estamos depurando problemas específicos, quizás queramos forzar rotación aquí, 
                    // pero por ahora esperemos que se adhiera a la especificación.
                }

                if (needsReplacement) {
                    debugLog('Unsubscribing old subscription...');
                    await sub.unsubscribe();
                    sub = null;
                }
            }

            if (!sub) {
                debugLog('Subscribing to PushManager...');
                const appKey = urlBase64ToUint8Array(newKey);
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: appKey
                });
                debugLog('Subscribed successfully');
            }

            debugLog('Syncing with backend...');
            const syncRes = await syncSubscription(sub);
            debugLog(`Sync result: ${syncRes}`);

            // Comprobar si el servidor marcó un requisito de resuscripción (ej., 403 BadJwtToken)
            try {
                const statusRes = await fetch('/api/push/status', { credentials: 'include' });
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    if (statusData && statusData.needs_resubscribe) {
                        debugLog('Server requires resubscribe. Forcing unsubscribe/subscribe.');
                        if (sub) {
                            await sub.unsubscribe();
                        }
                        const appKey = urlBase64ToUint8Array(newKey);
                        const newSub = await reg.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: appKey
                        });
                        await syncSubscription(newSub);
                        await fetch('/api/push/status/clear', {
                            method: 'POST',
                            credentials: 'include'
                        });
                        debugLog('Resubscribe completed and server flag cleared');
                    }
                }
            } catch (e) {
                debugLog(`Resubscribe status check failed: ${e.message}`);
            }

            return syncRes;
        } catch (e) {
            debugLog(`Push subscription error: ${e.message}`);
            console.warn('Push subscription error', e);
            return false;
        } finally {
            state.syncing = false;
        }
    };

    window.ensurePushSubscription = ensurePushSubscription;
})();
