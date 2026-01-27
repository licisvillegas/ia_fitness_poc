(function initAssignState() {
    // Estado global simple para orquestar UI de asignacion
    window.AssignState = {
        selectedUserId: null,
        allRoutines: [],
        assignedMap: {},
        currentMuscles: 'all',
        userMap: {},
        statusFilter: 'all',
        scopeFilter: 'all'
    };
})();
