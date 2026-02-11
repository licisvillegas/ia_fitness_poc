(function initExercisesBootstrap() {
    // Inicializa eventos y carga inicial del catalogo
    function onReady() {
        const state = window.ExercisesState;
        if (state.isAdmin) {
            document.getElementById('adminControls')?.classList.remove('d-none');
            document.getElementById('btnNewExercise')?.classList.remove('d-none');
            document.querySelectorAll('.admin-col').forEach(el => el.classList.remove('d-none'));
        }

        window.ExercisesRender.updateViewUI();
        // Carga metadatos y lista inicial
        window.ExercisesApi.loadBodyParts().then(() => {
            window.ExercisesFilters.renderMuscleIcons();
        });
        window.ExercisesApi.loadMetadata().then(() => {
            window.ExercisesApi.loadExercisesPage(1);
        });

        document.getElementById('mainSearch')?.addEventListener('input', window.ExercisesFilters.scheduleSearch);

        document.getElementById('filterSection')?.addEventListener('change', (e) => {
            window.ExercisesFilters.updateGroupOptions(e.target.value);
            window.ExercisesApi.loadExercisesPage(1);
        });

        document.getElementById('filterGroup')?.addEventListener('change', (e) => {
            window.ExercisesFilters.updateMuscleOptions(document.getElementById('filterSection').value, e.target.value);
            window.ExercisesApi.loadExercisesPage(1);
        });

        document.getElementById('filterMuscle')?.addEventListener('change', () => window.ExercisesApi.loadExercisesPage(1));
        document.getElementById('filterEquipment')?.addEventListener('change', () => window.ExercisesApi.loadExercisesPage(1));
        document.getElementById('filterType')?.addEventListener('change', () => window.ExercisesApi.loadExercisesPage(1));

        document.getElementById('prevPageBtn')?.addEventListener('click', () => window.ExercisesApi.loadExercisesPage(state.currentPage - 1));
        document.getElementById('nextPageBtn')?.addEventListener('click', () => window.ExercisesApi.loadExercisesPage(state.currentPage + 1));

        const pageInput = document.getElementById('pageInput');
        if (pageInput) {
            pageInput.addEventListener('change', (e) => window.ExercisesFilters.jumpToPage(e.target.value));
            pageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') window.ExercisesFilters.jumpToPage(e.target.value);
            });
        }

        const subSearch = document.getElementById('subSearch');
        if (subSearch) {
            subSearch.addEventListener('input', () => {
                window.ExercisesModals.populateSubstitutes(state.allExercises, state.currentExerciseId, window.ExercisesModals.getSelectedSubstitutes());
            });
        }

        window.ExercisesModals.initModalListeners();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
})();
