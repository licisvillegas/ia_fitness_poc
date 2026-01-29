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

            if (!sub) {
                debugLog('Loading VAPID key...');
                const key = await loadVapidKey();
                if (!key) {
                    debugLog('Failed to load VAPID key');
                    return false;
                }
                debugLog('Subscribing to PushManager...');
                const appKey = urlBase64ToUint8Array(key);
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: appKey
                });
                debugLog('Subscribed successfully');
            }

            debugLog('Syncing with backend...');
            const syncRes = await syncSubscription(sub);
            debugLog(`Sync result: ${syncRes}`);
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
