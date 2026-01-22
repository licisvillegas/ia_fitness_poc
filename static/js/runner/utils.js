(function () {
    const utils = window.Runner.utils;

    utils.formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    utils.getAudio = () => {
        return new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
    };

    utils.triggerHaptic = (pattern) => {
        if (navigator.vibrate) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                // Ignore errors
            }
        }
    };

    utils.getReturnUrl = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('return_to') || '/';
    };

    utils.schedulePush = async (delaySeconds, title, body) => {
        if (!delaySeconds || delaySeconds <= 0) return null;
        try {
            const res = await fetch("/api/push/schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    delay: delaySeconds,
                    title: title || "Alerta",
                    body: body || "Timer finalizado",
                    url: window.location.pathname || "/"
                })
            });
            if (res.ok) {
                const data = await res.json();
                return data.task_id;
            }
        } catch (e) {
            console.warn("Schedule push failed", e);
        }
        return null;
    };

    utils.cancelPush = async (taskId) => {
        if (!taskId) return;
        try {
            navigator.sendBeacon("/api/push/cancel-schedule", JSON.stringify({ task_id: taskId }));
            // Or use fetch if beacon not suitable (sendBeacon sends blob/string, complicated with json implies headers)
            // actually sendBeacon sends POST but setting content-type is tricky. 
            // Fallback to fetch with keepalive: true
            await fetch("/api/push/cancel-schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ task_id: taskId }),
                keepalive: true
            });
        } catch (e) {
            console.warn("Cancel push failed", e);
        }
    };
})();
