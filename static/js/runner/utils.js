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
})();
