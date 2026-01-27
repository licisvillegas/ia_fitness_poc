(function initAssignApi() {
    // Capa API para la vista de asignacion
    async function loadRoutines() {
        try {
            const res = await fetch('/api/routines');
            window.AssignState.allRoutines = await res.json();
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    // Mapea usuarios para mostrar nombre legible en el UI
    async function loadUsers() {
        try {
            const res = await fetch('/api/admin/users');
            const users = await res.json();
            window.AssignState.userMap = (Array.isArray(users) ? users : []).reduce((acc, u) => {
                if (u && u.user_id) {
                    acc[u.user_id] = u.name || u.username || u.email || u.user_id;
                }
                return acc;
            }, {});
        } catch (e) {
            console.error(e);
        }
    }

    // Carga asignaciones actuales del usuario seleccionado
    async function loadAssignmentsForUser(userId) {
        if (!userId) {
            window.AssignState.assignedMap = {};
            return;
        }

        try {
            const res = await fetch(`/api/admin/routines/assignments?user_id=${encodeURIComponent(userId)}`);
            const assignments = await res.json();
            const map = {};
            assignments.forEach(a => {
                map[a.routine_id] = a;
            });
            window.AssignState.assignedMap = map;
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    // Lista de grupos musculares para filtros
    async function loadBodyParts() {
        try {
            const res = await fetch('/workout/api/body-parts');
            return await res.json();
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    window.AssignApi = {
        loadRoutines,
        loadUsers,
        loadAssignmentsForUser,
        loadBodyParts
    };
})();
