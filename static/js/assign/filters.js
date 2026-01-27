(function initAssignFilters() {
    // Filtros UI: musculos, estado y alcance
    function handleMuscleCheckboxChange(target) {
        const allCheck = document.getElementById('checkAll');
        const checkboxes = document.querySelectorAll('.muscle-check:not(#checkAll)');

        if (target.id === 'checkAll') {
            if (allCheck.checked) {
                checkboxes.forEach(cb => cb.checked = false);
                window.AssignState.currentMuscles = 'all';
            } else {
                allCheck.checked = true;
                window.AssignState.currentMuscles = 'all';
            }
            updateMuscleButtonText();
            updateChips();
            return;
        }

        if (target.checked) {
            allCheck.checked = false;
        }

        const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
        if (selected.length === 0) {
            allCheck.checked = true;
            window.AssignState.currentMuscles = 'all';
        } else {
            window.AssignState.currentMuscles = selected;
        }
        updateMuscleButtonText();
        updateChips();
    }

    function updateMuscleButtonText() {
        const btn = document.getElementById('muscleFilterBtn');
        if (!btn) return;
        if (window.AssignState.currentMuscles === 'all') {
            btn.textContent = 'Filtrar músculos';
            return;
        }
        const count = Array.isArray(window.AssignState.currentMuscles) ? window.AssignState.currentMuscles.length : 0;
        btn.textContent = `Músculos (${count})`;
    }

    function updateChips() {
        const chipsEl = document.getElementById('muscleChips');
        if (!chipsEl) return;
        chipsEl.innerHTML = '';
        if (window.AssignState.currentMuscles === 'all') return;
        window.AssignState.currentMuscles.forEach(item => {
            const chip = document.createElement('span');
            chip.className = 'chip';
            chip.textContent = item;
            chipsEl.appendChild(chip);
        });
    }

    function getRoutineBodyParts(routine) {
        const parts = new Set();
        if (Array.isArray(routine.routine_body_parts)) {
            routine.routine_body_parts.forEach(p => {
                if (p) parts.add(String(p).toLowerCase());
            });
        }

        if (parts.size === 0 && Array.isArray(routine.items)) {
            routine.items.forEach(item => {
                if (item && item.body_part) {
                    parts.add(String(item.body_part).toLowerCase());
                }
            });
        }

        return Array.from(parts);
    }

    // Aplica filtros y re-renderiza la lista
    function applyFilters() {
        const term = document.getElementById('passFilter').value.toLowerCase();
        const selected = window.AssignState.currentMuscles;
        const statusFilter = window.AssignState.statusFilter;
        const scopeFilter = window.AssignState.scopeFilter;

        let filtered = window.AssignState.allRoutines.filter(r => r.name && r.name.toLowerCase().includes(term));

        if (selected !== 'all' && Array.isArray(selected) && selected.length > 0) {
            const selectedSet = new Set(selected.map(s => String(s).toLowerCase()));
            filtered = filtered.filter(r => {
                const parts = getRoutineBodyParts(r);
                if (parts.length === 0) return false;
                return parts.some(p => selectedSet.has(p));
            });
        }

        if (statusFilter === 'assigned') {
            filtered = filtered.filter(r => window.AssignState.assignedMap[r._id]);
        } else if (statusFilter === 'unassigned') {
            filtered = filtered.filter(r => !window.AssignState.assignedMap[r._id]);
        }

        if (scopeFilter === 'global') {
            filtered = filtered.filter(r => !r.user_id);
        } else if (scopeFilter === 'user') {
            filtered = filtered.filter(r => r.user_id);
        }

        window.AssignRender.renderRoutines(filtered);
    }

    // Enlaza botones de filtro con el estado global
    function bindFilterButtons() {
        const statusButtons = document.querySelectorAll('[data-filter]');
        statusButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                statusButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window.AssignState.statusFilter = btn.dataset.filter;
                applyFilters();
            });
        });

        const scopeButtons = document.querySelectorAll('[data-scope]');
        scopeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                scopeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window.AssignState.scopeFilter = btn.dataset.scope;
                applyFilters();
            });
        });
    }

    window.AssignFilters = {
        handleMuscleCheckboxChange,
        updateMuscleButtonText,
        updateChips,
        applyFilters,
        bindFilterButtons
    };
})();
