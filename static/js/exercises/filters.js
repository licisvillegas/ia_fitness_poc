(function initExercisesFilters() {
    // Filtros y helpers de UI (seccion, grupo, musculo, equipo)
    const { pageSize, muscleIcons } = window.ExercisesConsts;

    // Cambia entre vista grid/lista
    function switchView(mode) {
        window.ExercisesStateHelpers.setCurrentView(mode);
        window.ExercisesRender.updateViewUI();
    }

    // Actualiza combos de grupo segun seccion
    function updateGroupOptions(sectionId) {
        const state = window.ExercisesState;
        const groupSel = document.getElementById('filterGroup');
        const muscleSel = document.getElementById('filterMuscle');

        groupSel.innerHTML = '<option value="">Grupo...</option>';
        muscleSel.innerHTML = '<option value="">Músculo...</option>';
        groupSel.disabled = !sectionId;
        muscleSel.disabled = true;

        if (!sectionId) return;

        const section = state.taxonomyData.find(s => s.id === sectionId);
        if (section && section.groups) {
            section.groups.forEach(g => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.name;
                groupSel.appendChild(opt);
            });
        }
    }

    // Actualiza combos de musculo segun grupo
    function updateMuscleOptions(sectionId, groupId) {
        const state = window.ExercisesState;
        const muscleSel = document.getElementById('filterMuscle');
        muscleSel.innerHTML = '<option value="">Músculo...</option>';
        muscleSel.disabled = !groupId;

        if (!sectionId || !groupId) return;

        const section = state.taxonomyData.find(s => s.id === sectionId);
        if (section) {
            const group = section.groups.find(g => g.id === groupId);
            if (group && group.muscles) {
                group.muscles.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.name;
                    muscleSel.appendChild(opt);
                });
            }
        }
    }

    // Construye query string para el endpoint
    function buildQueryParams(page) {
        const term = document.getElementById('mainSearch').value.trim();
        const section = document.getElementById('filterSection').value;
        const group = document.getElementById('filterGroup').value;
        const muscle = document.getElementById('filterMuscle').value;
        const equipment = document.getElementById('filterEquipment').value;
        const type = document.getElementById('filterType').value;

        const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
        if (term) params.set('q', term);
        if (section) params.set('section', section);
        if (group) params.set('group', group);
        if (muscle) params.set('muscle', muscle);
        if (equipment) params.set('equipment', equipment);
        if (type) params.set('type', type);
        return params;
    }

    // Debounce para busqueda
    function scheduleSearch() {
        const state = window.ExercisesState;
        if (state.searchTimer) clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(() => window.ExercisesApi.loadExercisesPage(1), 300);
    }

    function resetFilters() {
        document.getElementById('mainSearch').value = '';
        document.getElementById('filterSection').value = '';
        updateGroupOptions('');
        document.getElementById('filterEquipment').value = '';
        document.getElementById('filterType').value = '';
        document.querySelectorAll('.muscle-icon').forEach(el => el.classList.remove('active'));
        window.ExercisesApi.loadExercisesPage(1);
    }

    function renderMuscleIcons() {
        const container = document.getElementById('muscleIconsContainer');
        if (!container) return;
        container.innerHTML = muscleIcons.map(m => `
            <div class="d-flex flex-column align-items-center muscle-item" onclick="filterByIcon('${m.key}')" style="cursor: pointer; min-width: 70px;">
                <div class="muscle-icon" id="icon-${m.key}">
                    <img src="/static/images/muscles/male/${m.img}" alt="${m.label}" 
                         onerror="this.style.display='none'; this.nextElementSibling.classList.remove('d-none');">
                    <div class="muscle-fallback d-none">${m.label.charAt(0)}</div>
                </div>
                <span class="muscle-label">${m.label}</span>
            </div>
        `).join('');
    }

    function updateIconSelectionFromDropdown() {
        const groupVal = document.getElementById('filterGroup').value;
        const muscleVal = document.getElementById('filterMuscle').value;

        document.querySelectorAll('.muscle-icon').forEach(el => el.classList.remove('active'));

        if (!groupVal && !muscleVal) return;

        if (muscleVal) {
            const match = muscleIcons.find(m => m.key === muscleVal);
            if (match) {
                document.getElementById(`icon-${match.key}`)?.classList.add('active');
                return;
            }
        }

        if (groupVal) {
            const match = muscleIcons.find(m => m.key === groupVal);
            if (match) {
                document.getElementById(`icon-${match.key}`)?.classList.add('active');
                return;
            }
        }
    }

    function filterByIcon(key) {
        const state = window.ExercisesState;
        let foundSection = null;
        let foundGroup = null;
        let foundMuscle = null;

        if (state.taxonomyData && state.taxonomyData.length) {
            outerLoop:
            for (const sect of state.taxonomyData) {
                for (const grp of sect.groups) {
                    if (grp.id === key) {
                        foundSection = sect;
                        foundGroup = grp;
                        break outerLoop;
                    }
                    if (grp.muscles) {
                        for (const m of grp.muscles) {
                            if (m.id === key) {
                                foundSection = sect;
                                foundGroup = grp;
                                foundMuscle = m;
                                break outerLoop;
                            }
                        }
                    }
                }
            }
        }

        const secSel = document.getElementById('filterSection');
        const grpSel = document.getElementById('filterGroup');
        const musSel = document.getElementById('filterMuscle');

        const currentActive = document.getElementById(`icon-${key}`).classList.contains('active');

        if (currentActive) {
            secSel.value = '';
            updateGroupOptions('');
            document.querySelectorAll('.muscle-icon').forEach(el => el.classList.remove('active'));
        } else {
            if (foundSection && foundGroup) {
                secSel.value = foundSection.id;
                updateGroupOptions(foundSection.id);
                grpSel.value = foundGroup.id;
                updateMuscleOptions(foundSection.id, foundGroup.id);

                if (foundMuscle) {
                    musSel.value = foundMuscle.id;
                } else {
                    musSel.value = '';
                }

                document.querySelectorAll('.muscle-icon').forEach(el => el.classList.remove('active'));
                document.getElementById(`icon-${key}`).classList.add('active');
            } else {
                console.warn('No mapping found for icon key:', key);
            }
        }
        window.ExercisesApi.loadExercisesPage(1);
    }

    window.ExercisesFilters = {
        switchView,
        updateGroupOptions,
        updateMuscleOptions,
        buildQueryParams,
        scheduleSearch,
        resetFilters,
        renderMuscleIcons,
        updateIconSelectionFromDropdown,
        filterByIcon
    };

    window.switchView = switchView;
    window.resetFilters = resetFilters;
    window.filterByIcon = filterByIcon;
})();
