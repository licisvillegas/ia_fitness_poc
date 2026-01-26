(function initExercisesApi() {
    const Utils = window.ExercisesUtils;
    const { equipmentMeta: EQUIPMENT_META, typeMeta: TYPE_META } = window.ExercisesConsts;

    async function loadMetadata() {
        try {
            const res = await fetch('/workout/api/exercises/metadata');
            const data = await res.json();

            if (data.equipment && Array.isArray(data.equipment)) {
                const sel = document.getElementById('filterEquipment');
                const currentVal = sel.value;
                sel.innerHTML = '<option value="">Equipo</option>';

                data.equipment.forEach(val => {
                    if (!val) return;
                    const meta = EQUIPMENT_META[val.toLowerCase()];
                    const label = meta ? meta.label : Utils.capitalize(val);
                    const opt = document.createElement('option');
                    opt.value = val;
                    opt.textContent = label;
                    sel.appendChild(opt);
                });
                sel.value = currentVal;
            }

            if (data.types && Array.isArray(data.types)) {
                const sel = document.getElementById('filterType');
                const currentVal = sel.value;
                sel.innerHTML = '<option value="">Tipo</option>';

                data.types.forEach(val => {
                    if (!val) return;
                    const label = TYPE_META[val.toLowerCase()] || Utils.capitalize(val);
                    const opt = document.createElement('option');
                    opt.value = val;
                    opt.textContent = label;
                    sel.appendChild(opt);
                });
                sel.value = currentVal;
            }
        } catch (e) {
            console.error('Error loading metadata', e);
        }
    }

    async function loadBodyParts() {
        const state = window.ExercisesState;
        try {
            const res = await fetch('/workout/api/taxonomy');
            state.taxonomyData = await res.json();

            const sectionSel = document.getElementById('filterSection');
            sectionSel.innerHTML = '<option value="">Sección...</option>';

            state.taxonomyData.forEach(sect => {
                const opt = document.createElement('option');
                opt.value = sect.id;
                opt.textContent = sect.name;
                sectionSel.appendChild(opt);
            });
        } catch (e) {
            console.error('Error loading taxonomy', e);
        }
    }

    async function loadExercisesPage(page = window.ExercisesState.currentPage) {
        const state = window.ExercisesState;
        const loader = document.getElementById('loader');
        const emptyMsg = document.getElementById('emptyMsg');
        const gridEl = document.getElementById('viewGridContainer');
        const tbody = document.getElementById('exercisesListBody');

        loader?.classList.remove('d-none');
        emptyMsg?.classList.add('d-none');
        if (gridEl) gridEl.innerHTML = '';
        if (tbody) tbody.innerHTML = '';

        try {
            const params = window.ExercisesFilters.buildQueryParams(page);
            const res = await fetch(`/workout/api/exercises/search?${params}`);
            const data = await res.json();

            state.currentPage = data.page || 1;
            state.totalItems = data.total || 0;
            const items = data.items || [];
            state.allExercises = items;

            items.forEach(window.ExercisesStateHelpers.addToLookup);

            if (items.length === 0) {
                emptyMsg?.classList.remove('d-none');
            } else {
                window.ExercisesRender.renderGrid(items);
                window.ExercisesRender.renderList(items);
            }
            window.ExercisesRender.updatePagination();
        } catch (e) {
            console.error(e);
            if (emptyMsg) {
                emptyMsg.classList.remove('d-none');
                emptyMsg.textContent = 'Error al cargar ejercicios.';
            }
        } finally {
            loader?.classList.add('d-none');
        }
    }

    async function ensureFullCatalog() {
        const state = window.ExercisesState;
        if (state.fullCatalogLoaded && state.fullExerciseCatalog.length > 0) return;
        try {
            const res = await fetch('/workout/api/exercises?limit=1000');
            const data = await res.json();
            if (Array.isArray(data)) {
                state.fullExerciseCatalog = data;
                data.forEach(window.ExercisesStateHelpers.addToLookup);
                state.fullCatalogLoaded = true;
                console.log('Full catalog loaded for admin:', data.length);
            }
        } catch (e) {
            console.error('Error loading full catalog', e);
        }
    }

    window.ExercisesApi = {
        loadMetadata,
        loadBodyParts,
        loadExercisesPage,
        ensureFullCatalog
    };
})();
