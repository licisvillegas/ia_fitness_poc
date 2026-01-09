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
})();
