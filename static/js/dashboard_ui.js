/**
 * dashboard_ui.js - Gestión de eventos y inicialización de la interfaz del Dashboard.
 * Codificación: UTF-8
 */

document.addEventListener("DOMContentLoaded", async () => {
    // Referencias a elementos UI
    const btnLoad = document.getElementById("loadDataBtn");
    const userIdInput = document.getElementById("userIdInput");
    const message = document.getElementById("message");
    const refreshBtn = document.getElementById("btnRefreshDashboard");
    const aiBtn = document.getElementById("aiSuggestBtn");
    const aiHistoryBtn = document.getElementById("aiHistoryBtn");
    const btnSavePlan = document.getElementById('btnSaveAgentPlan');

    /**
     * Obtiene el ID de usuario objetivo (del input o del localStorage).
     */
    function getTargetUserId() {
        const typed = userIdInput.value.trim();
        let targetId = typed;
        try {
            const raw = localStorage.getItem('ai_fitness_user');
            if (raw) {
                const u = JSON.parse(raw);
                const loggedId = String(u.user_id || u._id || '').trim();
                const uname = (u.username || '').trim();
                const email = (u.email || '').trim().toLowerCase();
                // Si el input está vacío o coincide con el nombre/email, usamos el ID interno
                if (!typed || typed === uname || typed.toLowerCase() === email) {
                    targetId = loggedId || typed;
                }
            }
        } catch (e) { }
        return targetId;
    }

    /**
     * Sincroniza todos los módulos del dashboard para un usuario.
     */
    async function syncDashboard(userId) {
        if (!userId) return;
        if (window.showLoader) showLoader("Sincronizando dashboard...");
        try {
            await Promise.all([
                window.loadProgress ? window.loadProgress(userId) : Promise.resolve(),
                window.loadActivePlanIndicator ? window.loadActivePlanIndicator(userId) : Promise.resolve(),
                window.loadRoutines ? window.loadRoutines(userId) : Promise.resolve(),
                window.loadCreatedRoutines ? window.loadCreatedRoutines({ returnTo: '/dashboard', userId: userId }) : Promise.resolve(),
                window.loadSessions ? window.loadSessions(userId) : Promise.resolve(),
                window.loadHeatmap ? window.loadHeatmap(userId) : Promise.resolve()
            ]);
        } catch (e) {
            console.error("Error en sincronización de dashboard", e);
        } finally {
            if (window.hideLoader) hideLoader();
        }
    }

    // --- Manejadores de Eventos ---

    if (btnLoad) {
        btnLoad.addEventListener("click", () => {
            const targetId = getTargetUserId();
            if (!targetId) {
                if (message) message.textContent = "⚠️ Ingresa un ID de usuario o logueate.";
                return;
            }
            syncDashboard(targetId);
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            const targetId = getTargetUserId();
            if (targetId) syncDashboard(targetId);
        });
    }

    if (aiBtn) {
        aiBtn.addEventListener("click", () => {
            const targetId = getTargetUserId();
            if (targetId && window.loadAiAdjustments) window.loadAiAdjustments(targetId);
            else if (message) message.textContent = "Ingresa un ID de usuario.";
        });
    }

    if (aiHistoryBtn) {
        aiHistoryBtn.addEventListener("click", () => {
            const targetId = getTargetUserId();
            if (targetId && window.loadAiHistory) window.loadAiHistory(targetId);
            else if (message) message.textContent = "Ingresa un ID de usuario.";
        });
    }

    if (btnSavePlan) {
        btnSavePlan.addEventListener('click', async () => {
            const targetId = btnSavePlan.dataset.userId;
            const msg = document.getElementById('ai-save-msg');
            if (!targetId) return;
            if (msg) msg.textContent = 'Guardando...';
            if (window.showLoader) showLoader("Guardando plan...");
            try {
                const resp = await fetch(`/ai/adjustments/${encodeURIComponent(targetId)}/apply_latest`, { method: 'POST' });
                if (resp.ok) {
                    if (msg) msg.textContent = 'Plan activado';
                    btnSavePlan.style.display = 'none';
                    if (window.loadActivePlanIndicator) window.loadActivePlanIndicator(targetId);
                }
            } catch (e) {
                console.error("Error al guardar plan", e);
            } finally {
                if (window.hideLoader) hideLoader();
            }
        });
    }

    // --- Inicialización al cargar la página ---
    if (window.ensureRoutineDependencies) await window.ensureRoutineDependencies();

    let initialId = null;
    let displayLabel = null;
    try {
        const raw = localStorage.getItem('ai_fitness_user');
        if (raw) {
            const u = JSON.parse(raw);
            initialId = String(u.user_id || u._id || '').trim();
            displayLabel = (u.username || '').trim();
        }
    } catch (e) { }

    const lastUser = localStorage.getItem("ai_fitness_uid");
    if (!initialId && lastUser) {
        initialId = lastUser;
        displayLabel = lastUser;
    }

    if (displayLabel && userIdInput) userIdInput.value = displayLabel;

    if (initialId) {
        syncDashboard(initialId);
    } else {
        // Carga genérica si no hay ID
        if (window.loadCreatedRoutines) window.loadCreatedRoutines({ returnTo: '/dashboard', userId: null });
    }
});
