(function () {
    const utils = window.Runner.utils;

    utils.formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const AUDIO_FILES = {
        beep_short: '/static/audio/beep_strong.wav', // Usando beep_strong como short por defecto si no hay otro
        beep_strong: '/static/audio/beep_strong.wav',
        victory: '/static/audio/beep_strong.wav' // Placeholder si no hay victory.mp3, usaremos patrón rítmico
    };

    utils.getAudio = (type = 'beep_short') => {
        return new Audio(AUDIO_FILES[type] || AUDIO_FILES.beep_short);
    };

    utils.playAlert = (type = 'beep_short') => {
        try {
            const audio = utils.getAudio(type);
            audio.play().catch(e => console.warn("Audio play failed", e));
            return audio;
        } catch (e) {
            console.warn("Audio creation failed", e);
            return null;
        }
    };

    utils.triggerHaptic = (pattern) => {
        if (navigator.vibrate) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {
                // Ignorar errores
            }
        }
    };

    utils.getReturnUrl = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('return_to') || '/';
    };

    utils.schedulePush = async (delaySeconds, title, body, context, clientState = {}) => {
        if (!delaySeconds || delaySeconds <= 0) return null;
        try {
            const res = await fetch("/api/push/schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    delay: delaySeconds,
                    title: title || "Alerta",
                    body: body || "Timer finalizado",
                    url: window.location.pathname || "/",
                    context: context || null,
                    visibility: clientState.visibility || document.visibilityState || null,
                    display_mode: clientState.displayMode || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser')
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
            // Usar fetch con keepalive: true para una cancelación confiable
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
