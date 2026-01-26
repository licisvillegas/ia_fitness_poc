(function initExercisesActions() {
    async function sendSelection(idOrObj) {
        const state = window.ExercisesState;
        let ex = idOrObj;
        if (typeof idOrObj === 'string') {
            ex = state.exerciseLookup[idOrObj] || state.allExercises.find(e => e._id === idOrObj);
        }

        if (!ex) {
            console.error('Exercise not found for selection:', idOrObj);
            return;
        }

        const name = ex.name || 'este ejercicio';
        const message = `¿Deseas seleccionar "${name}"?`;

        let ok = false;
        if (window.showConfirmModal) {
            ok = await window.showConfirmModal('Confirmar ejercicio', message, 'success');
        } else {
            ok = confirm(message);
        }

        if (!ok) return;

        if (window.parent) {
            window.parent.postMessage({
                type: 'rm-exercise-select',
                exercise: {
                    name: ex.name,
                    id: ex._id,
                    body_part: ex.body_part,
                    type: ex.type
                }
            }, '*');
        }
    }

    async function saveExercise() {
        const state = window.ExercisesState;
        const id = document.getElementById('exId').value;
        const name = document.getElementById('exName').value;

        const sectionId = document.getElementById('exSection').value;
        const groupId = document.getElementById('exGroup').value;
        const muscleId = document.getElementById('exMuscle').value;

        const type = document.getElementById('exType').value;
        const equipment = Array.from(document.getElementById('exEquipment').selectedOptions).map(o => o.value);

        if (!name) {
            window.ExercisesModals.localShowAlertModal('Campo requerido', 'El nombre es obligatorio', 'warning');
            return;
        }

        const payload = {
            id, name, type, equipment,
            body_part_key: groupId,
            taxonomy: {
                section_id: sectionId,
                group_id: groupId,
                muscle_id: muscleId
            },
            pattern: document.getElementById('exPattern').value,
            plane: document.getElementById('exPlane').value,
            level: document.getElementById('exLevel').value,
            primary_muscle: document.getElementById('exPrimaryMuscle').value,
            unilateral: document.getElementById('exUnilateral').checked,
            alternative_names: document.getElementById('exAlternativeNames').value.split(',').map(c => c.trim()).filter(Boolean),
            video_url: document.getElementById('exVideo').value,
            description: document.getElementById('exDescription').value,
            substitutes: window.ExercisesModals.getSelectedSubstitutes()
        };

        try {
            await fetch('/api/exercises/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            bootstrap.Modal.getInstance(document.getElementById('exerciseModal')).hide();
            window.ExercisesApi.loadExercisesPage(state.currentPage);
        } catch (e) {
            window.ExercisesModals.localShowAlertModal('Error', 'Ocurrió un error al guardar', 'danger');
        }
    }

    async function deleteExercise(id) {
        const confirmed = await window.ExercisesModals.localShowConfirmModal('Eliminar ejercicio', '¿Estás seguro de que deseas eliminar este ejercicio?', 'danger');
        if (!confirmed) return;

        try {
            await fetch(`/api/exercises/delete/${id}`, { method: 'DELETE' });
            window.ExercisesApi.loadExercisesPage(window.ExercisesState.currentPage);
        } catch (e) {
            window.ExercisesModals.localShowAlertModal('Error', 'Error al eliminar', 'danger');
        }
    }

    async function duplicateExercise(id) {
        const state = window.ExercisesState;
        const ex = state.exerciseLookup[id];
        if (!ex) return;

        const confirmed = await window.ExercisesModals.localShowConfirmModal('Duplicar Ejercicio', `¿Deseas crear una copia personalizada de "${ex.name}"?`);
        if (!confirmed) return;

        try {
            const payload = { ...ex, id: null, name: ex.name + ' (Copia)', _id: undefined };
            await fetch('/api/exercises/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            window.ExercisesApi.loadExercisesPage(window.ExercisesState.currentPage);
        } catch (e) {
            window.ExercisesModals.localShowAlertModal('Error', 'Error al duplicar', 'danger');
        }
    }

    window.ExercisesActions = {
        sendSelection,
        saveExercise,
        deleteExercise,
        duplicateExercise
    };

    window.sendSelection = sendSelection;
    window.saveExercise = saveExercise;
    window.deleteExercise = deleteExercise;
    window.duplicateExercise = duplicateExercise;
})();
