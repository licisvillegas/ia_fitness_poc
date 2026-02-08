(function () {
    const utils = window.Runner.utils;
    const scheduledByContext = {};

    const forgetScheduledTask = (taskId) => {
        if (!taskId) return;
        Object.keys(scheduledByContext).forEach(context => {
            if (scheduledByContext[context] === taskId) {
                delete scheduledByContext[context];
            }
        });
    };

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

    let audioCtx = null;
    const initAudio = () => {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
        return audioCtx;
    };

    utils.resumeAudio = () => {
        const ctx = initAudio();
        if (ctx && ctx.state === 'suspended') {
            ctx.resume().catch(e => console.log("Audio resume failed", e));
        }
    };

    utils.playAlert = (type = 'beep_short') => {
        try {

            // Web Audio API melody restored
            if (type === 'victory') {
                const ctx = initAudio();
                if (ctx) {
                    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
                    const now = ctx.currentTime;
                    // Melodía tipo 'Final Fantasy' corta: Do-Mi-Sol-Do(octava)
                    // Matched to dashboard_tools.js success tune parameters
                    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                        const osc = ctx.createOscillator();
                        const gain = ctx.createGain();
                        osc.connect(gain);
                        gain.connect(ctx.destination);
                        osc.frequency.value = freq;
                        // Reduce gain to 0.1 to match working dashboard implementation
                        // Removed invalid gain.type assignment
                        gain.gain.setValueAtTime(0.1, now + i * 0.15);
                        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);
                        osc.start(now + i * 0.15);
                        osc.stop(now + i * 0.15 + 0.4);
                    });
                    // Si el contexto funciona, terminamos aquí.
                    // Si está suspendido y no se reanuda, no sonará, pero habremos intentado.
                    // El fallback de abajo suena horrible si esto falla silenciosamente, 
                    // pero si ctx existe, asumimos que intenta sonar.
                    return;
                }
            } else if (type === 'rest_end') {
                const ctx = initAudio();
                if (ctx) {
                    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);

                    // High pitch for GO/Start Work (Matched to dashboard_tools.js)
                    osc.frequency.setValueAtTime(880, ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);

                    // Reduce gain to 0.1 to match dashboard levels
                    gain.gain.setValueAtTime(0.1, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

                    osc.start();
                    osc.stop(ctx.currentTime + 0.5);
                    return;
                }
            }

            const audio = utils.getAudio(type);
            audio.play().catch(e => console.warn("Audio play failed", e));
            return audio;
        } catch (e) {
            console.warn("Utils playAlert failed", e);
            try {
                // Fallback de emergencia
                new Audio(AUDIO_FILES.beep_short).play().catch(() => { });
            } catch (err) { }
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
            if (context && scheduledByContext[context] && utils.cancelPush) {
                await utils.cancelPush(scheduledByContext[context]);
            }
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
                if (context && data && data.task_id) {
                    scheduledByContext[context] = data.task_id;
                }
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
            forgetScheduledTask(taskId);
        } catch (e) {
            console.warn("Cancel push failed", e);
        }
    };

    utils.playTimerBeep = (type = 'go') => {
        const ctx = initAudio();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume().catch(() => { });

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'go') {
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
            return;
        }

        if (type === 'rest') {
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
            return;
        }

        if (type === 'finish') {
            const now = ctx.currentTime;
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.frequency.value = freq;
                gain2.gain.setValueAtTime(0.1, now + i * 0.15);
                gain2.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);
                osc2.start(now + i * 0.15);
                osc2.stop(now + i * 0.15 + 0.4);
            });
        }
    };
})();
