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

    const ensurePushSubscription = async () => {
        if (state.syncing) return false;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
        if (!('Notification' in window) || Notification.permission !== 'granted') return false;

        state.syncing = true;
        try {
            const reg = await navigator.serviceWorker.ready;
            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
                const key = await loadVapidKey();
                if (!key) return false;
                const appKey = urlBase64ToUint8Array(key);
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: appKey
                });
            }
            return await syncSubscription(sub);
        } catch (e) {
            console.warn('Push subscription error', e);
            return false;
        } finally {
            state.syncing = false;
        }
    };

    window.ensurePushSubscription = ensurePushSubscription;
})();
