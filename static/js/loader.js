/**
 * Utilidad de Cargador Reutilizable
 */
(function () {
    const loader = document.getElementById('appLoader');
    const messageEl = document.getElementById('loaderMessage');
    const barEl = document.getElementById('loaderBar');

    /**
     * Muestra el cargador global
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
     * Oculta el cargador global
     */
    window.hideLoader = function () {
        if (!loader) return;
        loader.classList.remove('show');
    };

    /**
     * Actualiza el porcentaje de la barra de progreso
     * @param {number} percentage - 0 to 100
     */
    window.updateLoaderProgress = function (percentage) {
        if (!barEl) return;
        barEl.classList.add('deterministic');
        barEl.style.width = `${percentage}%`;
    };

    // Interceptor Global de Enlaces para Transiciones de Página
    document.addEventListener('click', function (e) {
        const link = e.target.closest('a');
        if (!link) return;

        // Ignorar si se presionan teclas modificadoras (nueva pestaña)
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

        // Ignorar si el destino está vacío o es descarga
        if (link.target === '_blank' || link.hasAttribute('download')) return;

        // Ignorar anclajes en la misma página
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

        // Mostrar cargador
        window.showLoader("Cargando...", null);
    });

    // Corrección para Caché Atrás-Adelante (BF Cache) que persiste el cargador
    window.addEventListener('pageshow', function (event) {
        if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
            window.hideLoader();
        }
    });

    // Asegurar que el cargador esté oculto en la carga inicial
    document.addEventListener('DOMContentLoaded', function () {
        window.hideLoader();
    });

    /**
     * Ayudante para cargar imágenes con efecto esqueleto
     * @param {HTMLImageElement} img - Image element
     * @param {string} src - New Source URL
     * @param {HTMLElement} [container] - Contenedor para clase esqueleto (por defecto es el padre)
     */
    window.loadImageWithSkeleton = function (img, src, container = null) {
        if (!img) return;
        const parent = container || img.parentElement;

        // Restablecer
        img.classList.remove('loaded');
        img.classList.add('img-skeleton'); // Asegurar que la clase exista
        if (parent) parent.classList.add('skeleton-pulse');

        img.onload = function () {
            img.classList.add('loaded');
            if (parent) parent.classList.remove('skeleton-pulse');
        };

        img.onerror = function () {
            // Manejar error (opcional: eliminar esqueleto para que no pulse por siempre)
            if (parent) parent.classList.remove('skeleton-pulse');
        };

        img.src = src;
    };
})();
