(function initAssignRender() {
    // Renderiza tarjetas y contadores del panel de rutinas
    function updateCounts(total) {
        const countEl = document.getElementById('routinesCount');
        if (countEl) countEl.textContent = `${total} rutinas`;
    }

    // Dibuja lista de rutinas con estado de asignacion
    function renderRoutines(routines) {
        const routinesGrid = document.getElementById('routinesGrid');
        const emptyState = document.getElementById('emptyState');
        const loadingRoutines = document.getElementById('loadingRoutines');
        routinesGrid.innerHTML = '';

        if (loadingRoutines) loadingRoutines.style.display = 'none';

        if (!routines || routines.length === 0) {
            routinesGrid.style.display = 'none';
            if (emptyState) emptyState.style.display = 'block';
            updateCounts(0);
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        routinesGrid.style.display = 'grid';
        updateCounts(routines.length);

        routines.forEach(routine => {
            const card = document.createElement('div');
            card.className = 'routine-card';

            const exerciseCount = routine.items ? routine.items.length : (routine.exercises ? routine.exercises.length : 0);
            const dateStr = routine.created_at ? new Date(routine.created_at).toLocaleDateString() : 'N/A';
            const assignedInfo = window.AssignState.assignedMap[routine._id];
            const isAssigned = Boolean(assignedInfo);
            const assignedUntil = assignedInfo && assignedInfo.expires_at
                ? new Date(assignedInfo.expires_at).toLocaleDateString()
                : null;
            const daysValue = assignedInfo && assignedInfo.valid_days ? assignedInfo.valid_days : 30;
            const ownerName = routine.user_id
                ? (routine.user_name || window.AssignState.userMap[routine.user_id] || '')
                : '';
            const ownerLabel = routine.user_id
                ? (ownerName ? `${ownerName} (${routine.user_id})` : routine.user_id)
                : '';

            // Plantilla HTML de tarjeta de rutina
            card.innerHTML = `
                <div class="routine-header d-flex justify-content-between align-items-start">
                    <div style="max-width: 85%;">
                        <h5 class="mb-0 text-truncate fw-bold" title="${routine.name}">${routine.name}</h5>
                        <small class="text-muted" style="font-size: 0.75rem;">ID: ${routine._id}</small>
                    </div>
                    <button class="btn btn-sm btn-icon text-info" onclick="window.AssignRender.openRoutineModal('${routine._id}')" title="Ver detalle">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
                <div class="routine-body">
                    <div class="d-flex flex-wrap gap-2">
                        ${routine.user_id ? `<span class="badge bg-dark border border-secondary text-info badge-wrap">Usuario: ${ownerLabel}</span>` : `<span class="badge bg-secondary badge-wrap">Global</span>`}
                        ${isAssigned ? `<span class="badge bg-success">Asignada</span>` : `<span class="badge bg-secondary">Disponible</span>`}
                    </div>
                    <div class="routine-stats">
                        <div class="stat-item" title="Ejercicios">
                            <i class="fas fa-list-ol"></i>
                            <span>${exerciseCount} ejercicios</span>
                        </div>
                        <div class="stat-item" title="Fecha de creación">
                            <i class="far fa-calendar-alt"></i>
                            <span>${dateStr}</span>
                        </div>
                    </div>
                    <p class="text-muted small mb-0 text-truncate">${routine.description || 'Sin descripción disponible.'}</p>

                    <div>
                        <label class="form-label small text-muted mb-1">Vigencia (días)</label>
                        <input type="number" min="1" class="form-control form-control-sm"
                            id="days-${routine._id}" value="${daysValue}" ${!window.AssignState.selectedUserId ? 'disabled' : ''}>
                    </div>

                    <button class="btn btn-assign btn-sm"
                        onclick="assignRoutine('${routine._id}', event)"
                        ${!window.AssignState.selectedUserId || isAssigned ? 'disabled' : ''}>
                        ${!window.AssignState.selectedUserId ? 'Selecciona usuario' : (isAssigned ? 'Asignada' : '<i class="fas fa-plus-circle me-2"></i>Asignar rutina')}
                    </button>

                    ${isAssigned ? `
                        <button class="btn btn-secondary-action btn-sm btn-outline-secondary" onclick="updateAssignment('${routine._id}', event)" ${!window.AssignState.selectedUserId ? 'disabled' : ''}>
                            <i class="fas fa-sync-alt me-2"></i>Actualizar vigencia
                        </button>
                        <button class="btn btn-remove btn-sm" onclick="unassignRoutine('${routine._id}', event)" ${!window.AssignState.selectedUserId ? 'disabled' : ''}>
                            <i class="fas fa-times-circle me-2"></i>Remover asignación
                        </button>
                    ` : ''}

                    ${isAssigned ? `
                        <div class="text-muted small">
                            ${assignedUntil ? `Vence: ${assignedUntil}` : 'Asignada sin vencimiento'}
                        </div>
                    ` : ''}
                </div>
            `;

            routinesGrid.appendChild(card);
        });
    }

    function openRoutineModal(id) {
        // We need to look up the routine. assign/state.js has routines list usually?
        // Or we can find it in the data passed to renderRoutines if we store it.
        // But AssignState usually holds loaded routines. Let's assume window.AssignState.routines populated.
        // If not, we might need to pass it or look it up.
        // assign/state.js: window.AssignState = { routines: [], ... }

        const routine = window.AssignState.allRoutines.find(r => r._id === id);
        if (!routine) return;

        const modalTitle = document.getElementById("routineModalTitle");
        const modalBody = document.getElementById("routineModalBody");

        if (!modalTitle || !modalBody) return;

        // Use RoutineRenderer
        if (typeof RoutineRenderer === 'undefined') {
            console.error("RoutineRenderer not found");
            return;
        }

        const previewHtml = RoutineRenderer.buildPreviewHtml(routine);

        // Helper for parts array
        const parts = Array.isArray(routine.routine_body_parts) ? routine.routine_body_parts : [];
        const partsLabel = parts.map(p => RoutineRenderer.translateBodyPart(p)).join(", ");

        const exercises = (routine.items || []).filter(i => i.item_type === 'exercise').length;
        const day = routine.routine_day || "-";
        const updated = routine.updated_at ? new Date(routine.updated_at).toLocaleDateString() : "-"; // created_at fallback?

        modalTitle.textContent = routine.name || "Rutina";

        modalBody.innerHTML = `
            <div class="routine-preview-card" style="background: transparent; border: none; padding: 0;">
                <div class="text-center mb-3">
                    <h2 class="display-6 fw-bold text-white mb-2">${routine.name || "Rutina"}</h2>
                    <p class="text-secondary m-0">${exercises} ejercicios - Detalles de rutina</p>
                </div>
                
                <div class="row g-2 mb-3 border-bottom border-secondary pb-3">
                   <div class="col-4 text-center border-end border-secondary">
                      <div class="text-secondary small text-uppercase">Grupos</div>
                      <div class="text-white small">${partsLabel || "N/A"}</div>
                   </div>
                   <div class="col-4 text-center border-end border-secondary">
                      <div class="text-secondary small text-uppercase">Día</div>
                      <div class="text-white small">${day}</div>
                   </div>
                    <div class="col-4 text-center">
                      <div class="text-secondary small text-uppercase">Actualizado</div>
                      <div class="text-white small">${updated}</div>
                   </div>
                </div>

                <div class="routine-preview-scroll d-flex flex-column gap-2" style="max-height: 400px; overflow-y: auto;">
                    ${previewHtml}
                </div>
            </div>
        `;

        const modalEl = document.getElementById("routineModal");
        if (modalEl) new bootstrap.Modal(modalEl).show();
    }

    window.AssignRender = {
        renderRoutines,
        updateCounts,
        openRoutineModal
    };
})();
