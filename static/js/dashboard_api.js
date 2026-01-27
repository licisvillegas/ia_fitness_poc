/**
 * dashboard_api.js - Gestión de llamadas API y datos para el Dashboard.
 * Codificación: UTF-8
 */

/**
 * Carga el progreso del usuario y actualiza la UI/Gráficos.
 * @param {string} userId - ID del usuario.
 */
async function loadProgress(userId) {
    if (!userId) return;
    const message = document.getElementById("message");
    if (message) message.textContent = "";

    showLoader("Cargando progreso...");

    try {
        const res = await fetch(`/get_progress/${userId}`);
        const data = await res.json();

        // Oculta overlays de "Sin datos" antes de validar la respuesta
        const overlays = ["weight", "fat", "performance", "metabolism"];
        overlays.forEach(id => {
            const el = document.getElementById(`msg-${id}`);
            if (el) el.style.visibility = "hidden";
        });

        // Manejo de error o falta de datos
        if (res.status !== 200 || !Array.isArray(data) || data.length === 0) {
            if (message) message.textContent = data.error || "❌ No se encontraron registros de progreso.";
            if (window.clearDashboard) window.clearDashboard();
            overlays.forEach(id => {
                const el = document.getElementById(`msg-${id}`);
                if (el) el.style.visibility = "visible";
            });
            return;
        }

        if (window.t && message) message.textContent = t('data_loaded');
        localStorage.setItem("ai_fitness_uid", userId);

        // Actualizar métricas rápidas
        const last = data[data.length - 1];
        const weightEl = document.getElementById("stat-weight");
        const fatEl = document.getElementById("stat-fat");
        if (weightEl) weightEl.innerText = `${last.weight_kg} kg`;
        if (fatEl) fatEl.innerText = `${last.body_fat}%`;

        // Fetch de métricas adicionales desde Body Assessments
        let latestUserWeight = null;
        try {
            const mRes = await fetch(`/api/user/${userId}/latest_metrics`);
            if (mRes.ok) {
                const mData = await mRes.json();
                if (mData.weight_kg) {
                    if (weightEl) weightEl.innerText = `${mData.weight_kg} kg`;
                    latestUserWeight = mData.weight_kg;
                }
                if (mData.body_fat && fatEl) fatEl.innerText = `${mData.body_fat}%`;
                const tmbEl = document.getElementById("stat-tmb");
                const dietEl = document.getElementById("stat-diet");
                if (mData.tmb && tmbEl) tmbEl.innerText = `${mData.tmb}`;
                if (mData.tdee && dietEl) dietEl.innerText = `${mData.tdee}`;
            }
        } catch (e) { console.error("Error fetching latest metrics", e); }

        // Si tenemos la lógica de gráficos cargada, inicializar/actualizar
        if (window.initializeDashboardCharts) {
            window.initializeDashboardCharts(data, latestUserWeight);
        }

    } finally {
        hideLoader();
    }
}

/**
 * Carga las recomendaciones de ajustes de la AI.
 * @param {string} userId 
 */
async function loadAiAdjustments(userId) {
    const section = document.getElementById('ai-section');
    const loadEl = document.getElementById('ai-loading');
    const errEl = document.getElementById('ai-error');
    const content = document.getElementById('ai-content');
    const btnSave = document.getElementById('btnSaveAgentPlan');

    if (section) section.style.display = 'block';
    if (loadEl) loadEl.style.display = 'block';
    if (errEl) errEl.style.display = 'none';
    if (content) content.style.display = 'none';

    try {
        if (window.showLoader) showLoader("Calculando ajustes AI...");
        const resp = await fetch(`/ai/reason/${encodeURIComponent(userId)}?limit=12`);
        if (!resp.ok) throw new Error("Error en respuesta");
        const data = await resp.json();
        const out = data.output || {};
        const adj = out.ajustes || {};
        const food = adj.plan_alimentacion || {};
        const macros = food.macros || {};
        const train = adj.plan_entrenamiento || {};

        document.getElementById('ai-kcal').textContent = `Objetivo kcal: ${food.kcal_obj ?? '-'} (delta: ${food.kcal_delta ?? 0})`;
        document.getElementById('ai-macros').textContent = `Macros (p/c/g): ${macros.p ?? '-'} / ${macros.c ?? '-'} / ${macros.g ?? '-'}`;
        document.getElementById('ai-train').textContent = `Volumen: ${train.volumen_delta_ratio ?? 0}, Cardio: ${train.cardio ?? '-'}`;
        document.getElementById('ai-reason').textContent = out.razonamiento_resumido || '';
        document.getElementById('ai-next').textContent = (out.proxima_revision_dias != null) ? `Próxima revisión: ${out.proxima_revision_dias} días` : '';

        if (content) content.style.display = 'block';
        if (btnSave) {
            btnSave.style.display = 'inline-block';
            btnSave.dataset.userId = userId;
        }
    } catch (e) {
        if (errEl) {
            errEl.textContent = `Error: ${e.message}`;
            errEl.style.display = 'block';
        }
    } finally {
        if (loadEl) loadEl.style.display = 'none';
        if (window.hideLoader) hideLoader();
    }
}

/**
 * Carga el historial de ajustes de la AI.
 * @param {string} userId 
 */
async function loadAiHistory(userId) {
    const section = document.getElementById('ai-section');
    const listEl = document.getElementById('ai-history-list');
    if (section) section.style.display = 'block';
    if (listEl) listEl.innerHTML = '';

    if (window.showLoader) showLoader("Cargando historial AI...");
    try {
        const resp = await fetch(`/ai/adjustments/${encodeURIComponent(userId)}?limit=10`);
        const rows = await resp.json();
        if (!Array.isArray(rows)) return;

        const frag = document.createDocumentFragment();
        rows.forEach((r, idx) => {
            const li = document.createElement('li');
            li.className = 'list-group-item list-group-item-theme d-flex justify-content-between align-items-start';
            const title = document.createElement('div');
            const ts = (r.created_at || '').replace('T', ' ').replace('Z', '');
            title.innerHTML = `<div><strong>#${idx + 1}</strong> · ${ts || 'sin-fecha'}</div>`;
            const aj = (r.output && r.output.ajustes) || {};
            const food = aj.plan_alimentacion || {};
            const train = aj.plan_entrenamiento || {};
            const small = document.createElement('small');
            small.textContent = `kcal: ${food.kcal_obj ?? '-'}, vol: ${train.volumen_delta_ratio ?? 0}, cardio: ${train.cardio ?? '-'}`;
            title.appendChild(small);
            li.appendChild(title);
            frag.appendChild(li);
        });
        if (listEl) listEl.appendChild(frag);
    } catch (e) {
        console.error("Error cargando historial AI", e);
    } finally {
        if (window.hideLoader) hideLoader();
    }
}

/**
 * Muestra un indicador si hay un plan activo.
 * @param {string} userId 
 */
async function loadActivePlanIndicator(userId) {
    const el = document.getElementById('active-plan-indicator');
    try {
        if (!userId) { if (el) el.style.display = 'none'; return; }
        const resp = await fetch(`/plans/${encodeURIComponent(userId)}/active`);
        if (resp.ok) {
            const data = await resp.json();
            const ts = data.activated_at || data.created_at || '';
            let label = ts.split('T')[0];
            if (el) {
                el.innerHTML = `Plan activo desde ${label} · <a href="/plan" class="link-info">ver en Mi Plan</a>`;
                el.style.display = 'block';
            }
        } else {
            if (el) el.style.display = 'none';
        }
    } catch (e) {
        if (el) el.style.display = 'none';
    }
}

/**
 * Carga el mapa de calor de consistencia.
 * @param {string} userId 
 */
async function loadHeatmap(userId) {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const hRes = await fetch(`/workout/api/stats/heatmap?user_id=${userId}&timezone=${encodeURIComponent(tz)}`);
        const hMap = await hRes.json();
        const grid = document.getElementById("heatmapGrid");
        if (!grid) return;
        grid.innerHTML = "";
        grid.style.gridTemplateColumns = `repeat(10, 1fr)`;
        const today = new Date();
        for (let i = 59; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const key = d.toLocaleDateString('en-CA');
            const count = hMap[key] || 0;
            const cell = document.createElement("div");
            cell.className = "heatmap-cell";
            if (count > 0) cell.className += (count >= 2) ? " level-4" : " level-2";
            cell.title = `${key}: ${count} workouts`;
            grid.appendChild(cell);
        }
    } catch (e) { console.error("Heatmap error", e); }
}

// Hacer globales las funciones necesarias para dashboard.html
window.loadProgress = loadProgress;
window.loadAiAdjustments = loadAiAdjustments;
window.loadAiHistory = loadAiHistory;
window.loadActivePlanIndicator = loadActivePlanIndicator;
window.loadHeatmap = loadHeatmap;
