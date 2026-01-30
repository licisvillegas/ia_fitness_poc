(function () {
    const { useState, useEffect, useCallback, useRef } = React;

    window.Runner.hooks.useNotifications = (options = {}) => {
        const { logSource = "useNotifications" } = options;
        const [notificationPermission, setNotificationPermission] = useState('default');
        const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);
        const hasLoggedMissingRef = useRef(false);
        const hasEnsuredOnMountRef = useRef(false);

        const logClient = useCallback((message) => {
            if (!message) return;
            fetch('/api/push/client-log', {
                method: 'POST',
                body: JSON.stringify({ message }),
                headers: { 'Content-Type': 'application/json' }
            }).catch(() => { });
        }, []);

        const ensurePushSubscriptionSafe = useCallback(async (reason) => {
            if (typeof window.ensurePushSubscription !== "function") {
                if (!hasLoggedMissingRef.current) {
                    logClient(`${logSource}: window.ensurePushSubscription missing`);
                    hasLoggedMissingRef.current = true;
                }
                return false;
            }

            if (reason) {
                logClient(`${logSource}: ${reason}`);
            }

            try {
                return await window.ensurePushSubscription();
            } catch (e) {
                console.warn("Push subscription error", e);
                return false;
            }
        }, [logClient, logSource]);

        useEffect(() => {
            if ("Notification" in window) {
                const perm = Notification.permission;
                setNotificationPermission(perm);
                setIsNotificationsEnabled(perm === 'granted');
            }

            if (!hasEnsuredOnMountRef.current) {
                hasEnsuredOnMountRef.current = true;
                setTimeout(() => {
                    ensurePushSubscriptionSafe("ensurePushSubscription on mount");
                }, 2000);
            }
        }, [ensurePushSubscriptionSafe]);

        const toggleNotifications = useCallback(async () => {
            if (!("Notification" in window)) return;

            if (notificationPermission === 'default') {
                try {
                    const permission = await Notification.requestPermission();
                    setNotificationPermission(permission);
                    setIsNotificationsEnabled(permission === 'granted');
                    if (permission === 'granted') {
                        ensurePushSubscriptionSafe("ensurePushSubscription after toggle");
                    }
                } catch (e) {
                    console.error("Notification permission error", e);
                }
            } else if (notificationPermission === 'granted') {
                setIsNotificationsEnabled(prev => !prev);
            } else {
                alert("Las notificaciones estan bloqueadas por el navegador. Habilitalas en la configuracion del sitio.");
            }
        }, [notificationPermission, ensurePushSubscriptionSafe]);

        const ensureNotificationPermission = useCallback(async () => {
            if (!("Notification" in window)) return;
            if (notificationPermission === 'granted') {
                setIsNotificationsEnabled(true);
                ensurePushSubscriptionSafe("ensurePushSubscription after permission check");
                return;
            }
            if (notificationPermission !== 'default') return;
            try {
                const permission = await Notification.requestPermission();
                setNotificationPermission(permission);
                setIsNotificationsEnabled(permission === 'granted');
                if (permission === 'granted') {
                    ensurePushSubscriptionSafe("ensurePushSubscription after permission request");
                }
            } catch (e) {
                console.error("Notification permission error", e);
            }
        }, [notificationPermission, ensurePushSubscriptionSafe]);

        const sendNotification = useCallback((title, body) => {
            if (isNotificationsEnabled && notificationPermission === 'granted') {
                try {
                    new Notification(title, { body, icon: '/static/icons/icon-192x192.png' });
                } catch (e) {
                    console.error("Notification error", e);
                }
            }
        }, [isNotificationsEnabled, notificationPermission]);

        return {
            notificationPermission,
            isNotificationsEnabled,
            toggleNotifications,
            ensureNotificationPermission,
            sendNotification,
            ensurePushSubscriptionSafe
        };
    };
})();
