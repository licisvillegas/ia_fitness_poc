(function initAppHeight() {
    // Ajusta CSS var para viewport en mobile
    function setAppHeight() {
        const doc = document.documentElement;
        const height = window.innerHeight;
        doc.style.setProperty('--app-height', `${height}px`);
    }

    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', setAppHeight);
    setAppHeight();
})();

(function initNavigationGuard() {
    // Evita salir accidentalmente del runner
    window.history.pushState({ guard: true }, '', window.location.href);

    window.addEventListener('popstate', function () {
        const confirmExit = confirm(
            '¿Estás seguro de que quieres salir del entrenamiento? Tu progreso actual podría no guardarse automáticamente.'
        );

        if (confirmExit) {
            window.history.back();
        } else {
            window.history.pushState({ guard: true }, '', window.location.href);
        }
    });
})();
