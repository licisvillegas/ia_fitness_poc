/**
 * Reusable Sidebar Logic for User and Admin panels.
 * Handles:
 * 1. Collapse/Expand state (persisted via localStorage)
 * 2. Position Left/Right (persisted via localStorage)
 * 3. Mobile Sidebar toggle and overlay
 * 
 * Usage:
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

    // --- 1. Load Preferences ---
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

    // Apply initial state
    if (savedCollapsed) body.classList.add("sb-collapsed");

    if (savedRight) {
        body.classList.add("sb-right");
        updatePosButtons(true);
    } else {
        updatePosButtons(false);
    }
    updateToggleIcon();

    // --- 2. Toggle Sidebar Event ---
    if (sidebarToggle) {
        sidebarToggle.addEventListener("click", () => {
            body.classList.toggle("sb-collapsed");
            const isCollapsed = body.classList.contains("sb-collapsed");
            localStorage.setItem(collapsedKey, isCollapsed);
            updateToggleIcon();
        });
    }

    // --- 3. Position Toggle Events ---
    posButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetPos = btn.dataset.pos; // 'left' or 'right'
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

    // --- 4. Mobile Sidebar Logic ---
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

    // Close sidebar when clicking a link on mobile (UX improvement)
    const navLinks = sidebarFixed ? sidebarFixed.querySelectorAll(".nav-link") : [];
    navLinks.forEach(link => {
        link.addEventListener("click", () => {
            if (window.innerWidth < 992) {
                closeMobileSidebar();
            }
        });
    });
    // --- 5. User Menu Floating Fix (iOS/Overflow) ---
    const userCollapse = document.getElementById("user-collapse");
    if (userCollapse && sidebarFixed) {
        userCollapse.addEventListener('show.bs.collapse', function () {
            // Only if sidebar is visually collapsed (desktop mode)
            if (document.body.classList.contains("sb-collapsed")) {
                sidebarFixed.classList.add("overflow-visible");
            }
        });

        userCollapse.addEventListener('hide.bs.collapse', function () {
            sidebarFixed.classList.remove("overflow-visible");
        });

        // Improve click outside behavior for the "floating" menu
        document.addEventListener('click', function (event) {
            if (document.body.classList.contains("sb-collapsed") &&
                userCollapse.classList.contains('show') &&
                !userCollapse.contains(event.target) &&
                !event.target.closest('.dropdown-toggle-user')) {

                // If we clicked outside the menu AND outside the toggle, close it.
                // NOTE: We need to use Bootstrap's API to close it properly if possible,
                // or just remove the class if simple toggle isn't enough.
                const bsCollapse = bootstrap.Collapse.getInstance(userCollapse);
                if (bsCollapse) {
                    bsCollapse.hide();
                }
            }
        });
    }
}
