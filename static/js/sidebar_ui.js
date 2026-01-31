/**
 * Lógica de Barra Lateral Reutilizable para paneles de Usuario y Administrador.
 * Maneja:
 * 1. Estado de Colapsar/Expandir (persistido vía localStorage)
 * 2. Posición Izquierda/Derecha (persistida vía localStorage)
 * 3. Alternancia y superposición de la barra lateral móvil
 * 
 * Uso:
 * initSidebar({
 *   collapsedKey: 'sidebar_collapsed', 
 *   rightKey: 'sidebar_right'
 * });
 */
function initSidebar(config) {
    const collapsedKey = config.collapsedKey || "sidebar_collapsed";
    const rightKey = config.rightKey || "sidebar_right";

    const body = document.body;
    const sidebarToggle = document.getElementById("sidebar-toggle");
    const toggleIcon = sidebarToggle ? sidebarToggle.querySelector("i") : null;
    const posButtons = document.querySelectorAll(".pos-toggle-btn");

    // --- 1. Cargar Preferencias ---
    const savedCollapsed = localStorage.getItem(collapsedKey) === "true";
    const savedRight = localStorage.getItem(rightKey) === "true";

    function updateToggleIcon() {
        if (!toggleIcon) return;

        if (body.classList.contains("sb-collapsed")) {
            toggleIcon.className = "fas fa-bars";
        } else {
            toggleIcon.className = "fas fa-arrow-left transition-icon";
            if (body.classList.contains("sb-right")) {
                toggleIcon.className = "fas fa-arrow-right transition-icon";
            }
        }
    }

    function updatePosButtons(isRight) {
        posButtons.forEach(btn => {
            const isBtnRight = btn.dataset.pos === "right";
            if ((isRight && isBtnRight) || (!isRight && !isBtnRight)) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    }

    // Aplicar estado inicial
    if (savedCollapsed) body.classList.add("sb-collapsed");

    if (savedRight) {
        body.classList.add("sb-right");
        updatePosButtons(true);
    } else {
        updatePosButtons(false);
    }
    updateToggleIcon();

    // --- 2. Evento de Alternar Barra Lateral ---
    if (sidebarToggle) {
        sidebarToggle.addEventListener("click", () => {
            body.classList.toggle("sb-collapsed");
            const isCollapsed = body.classList.contains("sb-collapsed");
            localStorage.setItem(collapsedKey, isCollapsed);
            updateToggleIcon();
        });
    }

    // --- 3. Eventos de Alternar Posición ---
    posButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetPos = btn.dataset.pos; // 'left' (izquierda) o 'right' (derecha)
            if (targetPos === "right") {
                body.classList.add("sb-right");
                localStorage.setItem(rightKey, "true");
                updatePosButtons(true);
            } else {
                body.classList.remove("sb-right");
                localStorage.setItem(rightKey, "false");
                updatePosButtons(false);
            }
            updateToggleIcon();
        });
    });

    // --- 4. Lógica de Barra Lateral Móvil ---
    const mobileToggle = document.getElementById("mobile-sidebar-toggle");
    const sidebarFixed = document.querySelector(".sidebar-fixed");
    const sidebarOverlay = document.getElementById("sidebar-overlay");

    function closeMobileSidebar() {
        if (sidebarFixed) sidebarFixed.classList.remove("show-mobile");
        if (sidebarOverlay) sidebarOverlay.classList.remove("show");
    }

    if (mobileToggle) {
        mobileToggle.addEventListener("click", function () {
            if (sidebarFixed) sidebarFixed.classList.toggle("show-mobile");
            if (sidebarOverlay) sidebarOverlay.classList.toggle("show");
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", closeMobileSidebar);
    }

    // Cerrar barra lateral al hacer clic en un enlace en móvil (mejora de UX)
    const navLinks = sidebarFixed ? sidebarFixed.querySelectorAll(".nav-link") : [];
    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            if (window.innerWidth < 992) {
                closeMobileSidebar();
            }
        });
    });
    // --- 5. Corrección de Menú de Usuario Flotante (iOS/Desbordamiento) ---
    const userCollapse = document.getElementById("user-collapse");
    if (userCollapse && sidebarFixed) {
        userCollapse.addEventListener('show.bs.collapse', function () {
            // Solo si la barra lateral está visualmente colapsada (modo escritorio)
            if (document.body.classList.contains("sb-collapsed")) {
                sidebarFixed.classList.add("overflow-visible");
            }
        });

        userCollapse.addEventListener('hide.bs.collapse', function () {
            sidebarFixed.classList.remove("overflow-visible");
        });

        // Mejorar comportamiento de clic fuera para el menú "flotante"
        document.addEventListener('click', function (event) {
            if (document.body.classList.contains("sb-collapsed") &&
                userCollapse.classList.contains('show') &&
                !userCollapse.contains(event.target) &&
                !event.target.closest('.dropdown-toggle-user')) {

                // Si hicimos clic fuera del menú Y fuera del toggle, cerrarlo.
                // NOTA: Necesitamos usar la API de Bootstrap para cerrarlo correctamente si es posible,
                // o simplemente eliminar la clase si la alternancia simple no es suficiente.
                const bsCollapse = bootstrap.Collapse.getInstance(userCollapse);
                if (bsCollapse) {
                    bsCollapse.hide();
                }
            }
        });
    }
}
