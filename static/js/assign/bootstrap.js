(function initAssignBootstrap() {
    // Orquestador principal de la vista (eventos + carga inicial)
    const routinesGrid = document.getElementById('routinesGrid');
    const loadingRoutines = document.getElementById('loadingRoutines');

    const selectedUserDisplay = document.getElementById('selectedUserDisplay');
    const noUserDisplay = document.getElementById('noUserDisplay');
    const badgeName = document.getElementById('badgeName');
    const badgeUserId = document.getElementById('badgeUserId');
    const badgeUserEmail = document.getElementById('badgeUserEmail');
    const userStatusBadge = document.getElementById('userStatusBadge');

    // Cuando se selecciona un usuario desde el buscador
    function handleUserSelect(user) {
        if (!user || !user.user_id) return;
        window.AssignState.selectedUserId = user.user_id;
        selectedUserDisplay.style.display = 'block';
        noUserDisplay.style.display = 'none';
        badgeName.textContent = user.name || user.username || user.email || user.user_id;
        badgeUserId.textContent = `ID: ${user.user_id}`;
        badgeUserEmail.textContent = `Correo: ${user.email || '--'}`;
        userStatusBadge.textContent = 'Usuario seleccionado';
        window.AssignApi.loadAssignmentsForUser(window.AssignState.selectedUserId)
            .then(() => window.AssignFilters.applyFilters());
    }

    // Limpia usuario seleccionado y resetea estado
    function clearSelectedUser() {
        window.AssignState.selectedUserId = null;
        selectedUserDisplay.style.display = 'none';
        noUserDisplay.style.display = 'block';
        userStatusBadge.textContent = 'Sin usuario';
        window.AssignState.assignedMap = {};
        window.AssignFilters.applyFilters();
    }

    // Configura el buscador admin reutilizable
    function initSearch() {
        initUserSearch({
            inputId: 'userSearchTerm',
            resultsId: 'userSearchResults',
            hiddenId: 'selectedUserId',
            buttonId: 'btnLookupUser',
            clearButtonId: 'btnClearUserSearch',
            storageKey: 'admin_working_user',
            onSelect: handleUserSelect,
            onClear: clearSelectedUser
        });
    }

    // Carga rutinas + usuarios y render inicial
    async function initData() {
        try {
            await Promise.all([
                window.AssignApi.loadRoutines(),
                window.AssignApi.loadUsers()
            ]);
            window.AssignFilters.applyFilters();
            if (loadingRoutines) loadingRoutines.style.display = 'none';
            routinesGrid.style.display = 'grid';
        } catch (e) {
            console.error(e);
            if (loadingRoutines) {
                loadingRoutines.innerHTML = '<p class="text-danger">Error cargando rutinas</p>';
            }
        }
    }

    // Inyecta lista de musculos al dropdown
    async function initMuscleFilter() {
        try {
            const parts = await window.AssignApi.loadBodyParts();
            const muscleList = document.getElementById('muscleDropdownList');

            parts.forEach(p => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="form-check">
                        <input class="form-check-input muscle-check" type="checkbox" value="${p.key}" id="check_${p.key}">
                        <label class="form-check-label" for="check_${p.key}">${p.label_es || p.label}</label>
                    </div>
                `;
                muscleList.appendChild(li);
            });

            muscleList.addEventListener('change', (e) => {
                if (e.target.classList.contains('muscle-check')) {
                    window.AssignFilters.handleMuscleCheckboxChange(e.target);
                    window.AssignFilters.applyFilters();
                }
            });
        } catch (e) {
            console.error(e);
        }
    }

    // Filtro de texto en tiempo real
    function bindSearchFilter() {
        const routineFilter = document.getElementById('passFilter');
        routineFilter.addEventListener('input', () => {
            window.AssignFilters.applyFilters();
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initSearch();
        initData();
        initMuscleFilter();
        bindSearchFilter();
        window.AssignFilters.bindFilterButtons();
    });
})();
