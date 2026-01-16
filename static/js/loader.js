/**
 * Reusable Loader Utility
 */
(function () {
    const loader = document.getElementById('appLoader');
    const messageEl = document.getElementById('loaderMessage');
    const barEl = document.getElementById('loaderBar');

    /**
     * Shows the global loader
     * @param {string} message - Message to display
     * @param {number} [progress] - Optional progress percentage (0-100)
     */
    window.showLoader = function (message = 'Cargando...', progress = null) {
        if (!loader) return;

        messageEl.textContent = message;

        if (progress !== null) {
            barEl.classList.add('deterministic');
            barEl.style.width = `${progress}%`;
        } else {
            barEl.classList.remove('deterministic');
            barEl.style.width = '40%';
        }

        loader.classList.add('show');
    };

    /**
     * Hides the global loader
     */
    window.hideLoader = function () {
        if (!loader) return;
        loader.classList.remove('show');
    };

    /**
     * Updates the progress bar percentage
     * @param {number} percentage - 0 to 100
     */
    window.updateLoaderProgress = function (percentage) {
        if (!barEl) return;
        barEl.classList.add('deterministic');
        barEl.style.width = `${percentage}%`;
    };

    // Global Link Interceptor for Page Transitions
    document.addEventListener('click', function (e) {
        const link = e.target.closest('a');
        if (!link) return;

        // Ignore if modifier keys are pressed (new tab)
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

        // Ignore if target is blank or download
        if (link.target === '_blank' || link.hasAttribute('download')) return;

        // Ignore anchors on the same page
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

        // Show loader
        window.showLoader("Cargando...", null);
    });
})();
