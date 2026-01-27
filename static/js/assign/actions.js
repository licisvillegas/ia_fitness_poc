(function initAssignActions() {
    // Acciones principales: asignar, actualizar vigencia y remover
    function showToast(msg, bgClass = 'bg-primary') {
        const toastEl = document.getElementById('liveToast');
        const toastBody = document.getElementById('toastMessage');
        toastEl.className = `toast align-items-center text-white border-0 ${bgClass}`;
        toastBody.textContent = msg;
        const toast = new bootstrap.Toast(toastEl);
        toast.show();
    }

    // Asignar rutina al usuario seleccionado
    async function assignRoutine(routineId, evt) {
        if (!window.AssignState.selectedUserId) {
            showToast('Debes seleccionar un usuario primero', 'bg-warning');
            return;
        }

        const daysInput = document.getElementById(`days-${routineId}`);
        const validDays = parseInt(daysInput ? daysInput.value : '0', 10);
        if (!validDays || validDays <= 0) {
            showToast('Selecciona días de vigencia válidos', 'bg-warning');
            return;
        }

        const btn = evt && evt.currentTarget ? evt.currentTarget : null;
        const originalText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Asignando...';
        }

        try {
            const resp = await fetch('/api/admin/routines/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: window.AssignState.selectedUserId,
                    routine_id: routineId,
                    valid_days: validDays
                })
            });

            const data = await resp.json();
            if (resp.ok) {
                showToast(data.message || 'Asignada con éxito', 'bg-success');
                await window.AssignApi.loadAssignmentsForUser(window.AssignState.selectedUserId);
                window.AssignFilters.applyFilters();
            } else {
                showToast(data.error || 'Error al asignar', 'bg-danger');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de conexión', 'bg-danger');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    }

    // Actualizar vigencia de una asignacion existente
    async function updateAssignment(routineId, evt) {
        if (!window.AssignState.selectedUserId) {
            showToast('Debes seleccionar un usuario primero', 'bg-warning');
            return;
        }

        const assignmentInfo = window.AssignState.assignedMap[routineId];
        if (!assignmentInfo || !assignmentInfo.assignment_id) {
            showToast('Asignación no encontrada', 'bg-danger');
            return;
        }

        const daysInput = document.getElementById(`days-${routineId}`);
        const validDays = parseInt(daysInput ? daysInput.value : '0', 10);
        if (!validDays || validDays <= 0) {
            showToast('Selecciona días de vigencia válidos', 'bg-warning');
            return;
        }

        const btn = evt && evt.currentTarget ? evt.currentTarget : null;
        const originalText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Actualizando...';
        }

        try {
            const resp = await fetch('/api/admin/routines/assignments/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: window.AssignState.selectedUserId,
                    routine_id: routineId,
                    assignment_id: assignmentInfo.assignment_id,
                    valid_days: validDays
                })
            });

            const data = await resp.json();
            if (resp.ok) {
                showToast(data.message || 'Vigencia actualizada', 'bg-success');
                await window.AssignApi.loadAssignmentsForUser(window.AssignState.selectedUserId);
                window.AssignFilters.applyFilters();
            } else {
                showToast(data.error || 'Error al actualizar', 'bg-danger');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de conexión', 'bg-danger');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    }

    // Remover asignacion de rutina
    async function unassignRoutine(routineId, evt) {
        if (!window.AssignState.selectedUserId) {
            showToast('Debes seleccionar un usuario primero', 'bg-warning');
            return;
        }

        const btn = evt && evt.currentTarget ? evt.currentTarget : null;
        const originalText = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Removiendo...';
        }

        try {
            const resp = await fetch('/api/admin/routines/unassign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: window.AssignState.selectedUserId,
                    routine_id: routineId
                })
            });

            const data = await resp.json();
            if (resp.ok) {
                showToast(data.message || 'Rutina removida', 'bg-success');
                await window.AssignApi.loadAssignmentsForUser(window.AssignState.selectedUserId);
                window.AssignFilters.applyFilters();
            } else {
                showToast(data.error || 'Error al remover', 'bg-danger');
            }
        } catch (e) {
            console.error(e);
            showToast('Error de conexión', 'bg-danger');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    }

    window.assignRoutine = assignRoutine;
    window.updateAssignment = updateAssignment;
    window.unassignRoutine = unassignRoutine;
})();
