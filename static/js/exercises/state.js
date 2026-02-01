(function initExercisesState() {
    // Estado global del catalogo (filtros, pagina, cache)
    const urlParams = new URLSearchParams(window.location.search);
    const bootstrapData = window.__EXERCISES__ || {};
    const serverIsAdmin = !!bootstrapData.serverIsAdmin;
    const isAdmin = (urlParams.get('admin') === 'true') && serverIsAdmin;
    const isEmbed = !!bootstrapData.isEmbed;

    window.ExercisesState = {
        urlParams,
        isAdmin,
        isEmbed,
        currentView: localStorage.getItem('exercises_view_mode') || 'grid',
        sortBy: 'name',     // 'name' | 'newest'
        sortOrder: 'asc',   // 'asc' | 'desc'
        filterIncomplete: false, // Admin only filter
        allExercises: [],
        exerciseLookup: {},
        exerciseLookupByName: {},
        currentPage: 1,
        totalItems: 0,
        searchTimer: null,
        bodyPartMap: {},
        currentExerciseId: null,
        currentBodyPartForEdit: null,
        messageModalInstance: null,
        fullExerciseCatalog: [],
        fullCatalogLoaded: false,
        taxonomyData: []
    };

    window.ExercisesStateHelpers = {
        setCurrentView(mode) {
            window.ExercisesState.currentView = mode;
            localStorage.setItem('exercises_view_mode', mode);
        },
        addToLookup(ex) {
            if (!ex) return;
            const state = window.ExercisesState;
            const rawId = ex._id && typeof ex._id === 'object' ? (ex._id.$oid || ex._id.oid || ex._id.id) : ex._id;
            const idValue = rawId != null ? String(rawId) : null;
            if (idValue) state.exerciseLookup[idValue] = ex;
            if (ex.exercise_id) state.exerciseLookup[String(ex.exercise_id)] = ex;
            const nameKey = (ex.name || ex.exercise_name || '').trim().toLowerCase();
            if (nameKey) state.exerciseLookupByName[nameKey] = ex;
        }
    };
})();
