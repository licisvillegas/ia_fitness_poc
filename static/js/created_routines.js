(function () {
    // State
    window.createdRoutinesMap = new Map();
    window.currentCreatedView = 'weekly'; // Default to weekly
    window.loadedCreatedRoutinesCache = [];
    window.activeCreatedCollapsedRoutineId = null;
    window.currentCreatedTodayStyle = 'card';

    // Dependencies are shared with assigned_routines.js (window.translateDay, window.countExercises, etc)
    // We assume assigned_routines.js is loaded and definitions are available.
    // If not, we might need to duplicate helper functions or move them to a common utility file.
    // For now we assume they are available since both are included in dashboard.html

    // Setup Switcher Listeners
    document.addEventListener('DOMContentLoaded', () => {
        // Initial load
        window.loadCreatedRoutines();

        const btnGrid = document.getElementById('btnCreatedViewGrid');
        const btnWeekly = document.getElementById('btnCreatedViewWeekly');
        const btnToday = document.getElementById('btnCreatedViewToday');

        const setView = (view) => {
            window.currentCreatedView = view;
            if (view === 'today') {
                window.currentCreatedTodayStyle = 'compact';
            }
            [btnGrid, btnWeekly, btnToday].forEach(btn => btn?.classList.remove('active'));
            if (view === 'grid') btnGrid?.classList.add('active');
            if (view === 'weekly') btnWeekly?.classList.add('active');
            if (view === 'today') btnToday?.classList.add('active');

            // Check collapse state
            const collapseEl = document.getElementById('createdRoutinesCollapse');
            const isCollapsed = collapseEl && !collapseEl.classList.contains('show');

            // Auto-expand on ANY view selection
            if (isCollapsed) {
                new bootstrap.Collapse(collapseEl, { show: true });

                // Force render
                const summaryEl = document.getElementById('created-weekly-collapsed-summary');
                if (summaryEl) summaryEl.style.display = 'none';
                window.renderCreatedRoutines();
                return;
            }

            if (isCollapsed && view === 'weekly') {
                window.renderCreatedWeeklyCollapsedView();
            } else {
                const summaryEl = document.getElementById('created-weekly-collapsed-summary');
                if (summaryEl) summaryEl.style.display = 'none';
            }

            if (!isCollapsed) window.renderCreatedRoutines();
        };

        btnGrid?.addEventListener('click', () => setView('grid'));
        btnWeekly?.addEventListener('click', () => setView('weekly'));
        btnToday?.addEventListener('click', () => setView('today'));

        // Collapse Events
        const collapseEl = document.getElementById('createdRoutinesCollapse');
        const summaryEl = document.getElementById('created-weekly-collapsed-summary');

        if (collapseEl && summaryEl) {
            collapseEl.addEventListener('hide.bs.collapse', () => {
                // When collapsing, ALWAYS show the weekly summary row so the user sees the days.
                // This provides a consistent "Collapsed State" regardless of whether they were in Grid or Today view.
                window.renderCreatedWeeklyCollapsedView();

                // Icon toggle
                const icon = document.querySelector('[data-bs-target="#createdRoutinesCollapse"] .active-icon');
                if (icon) { icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down'); }
            });
            collapseEl.addEventListener('show.bs.collapse', () => {
                summaryEl.style.display = 'none';
                // Icon toggle
                const icon = document.querySelector('[data-bs-target="#createdRoutinesCollapse"] .active-icon');
                if (icon) { icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up'); }
            });
        }
    });

    window.loadCreatedRoutines = async function () {
        const sectionEl = document.getElementById('my-created-routines');
        const listEl = document.getElementById('created-routines-list');
        if (!sectionEl || !listEl) return;

        try {
            const res = await fetch('/workout/api/my-routines');
            if (res.status === 401) return;

            const routines = await res.json();
            window.loadedCreatedRoutinesCache = Array.isArray(routines) ? routines : [];

            if (window.loadedCreatedRoutinesCache.length === 0) {
                sectionEl.style.display = 'none';
                return;
            }

            sectionEl.style.display = 'block';
            window.renderCreatedRoutines();

            // Initial render of collapsed view if needed
            const collapseEl = document.getElementById('createdRoutinesCollapse');
            if (collapseEl && !collapseEl.classList.contains('show') && window.currentCreatedView === 'weekly') {
                window.renderCreatedWeeklyCollapsedView();
            }

        } catch (e) {
            console.error("Error loading created routines:", e);
            listEl.innerHTML = '<div class="col-12 text-danger text-center">Error cargando rutinas creadas.</div>';
            sectionEl.style.display = 'block';
        }
    };

    window.renderCreatedRoutines = function () {
        const listEl = document.getElementById('created-routines-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        const routines = window.loadedCreatedRoutinesCache;
        if (routines.length === 0) return;

        if (window.currentCreatedView === 'weekly') {
            window.renderCreatedWeeklyView(routines, listEl);
        } else if (window.currentCreatedView === 'today') {
            window.renderCreatedTodayView(routines, listEl);
        } else {
            window.renderCreatedGridView(routines, listEl);
        }
    };

    // Grid View
    window.renderCreatedGridView = function (routines, container) {
        routines.forEach(r => {
            container.appendChild(window.createCreatedRoutineCard(r));
        });
    };

    // Weekly View
    window.renderCreatedWeeklyView = function (routines, container) {
        // Reuse logic but adapted for created routines (which might not have assigned days, but often do)
        const days = [
            { key: 'Sunday', label: 'Domingo' },
            { key: 'Monday', label: 'Lunes' },
            { key: 'Tuesday', label: 'Martes' },
            { key: 'Wednesday', label: 'Miércoles' },
            { key: 'Thursday', label: 'Jueves' },
            { key: 'Friday', label: 'Viernes' },
            { key: 'Saturday', label: 'Sábado' }
        ];
        const todayEng = new Date().toLocaleDateString("en-US", { weekday: "long" });

        const gridContainer = document.createElement('div');
        gridContainer.className = 'col-12 weekly-grid';

        const routineByDay = {};
        const unassigned = [];

        routines.forEach(r => {
            if (r.routine_day) routineByDay[r.routine_day] = r;
            else unassigned.push(r);
        });

        days.forEach(day => {
            const r = routineByDay[day.key];
            const isToday = (day.key === todayEng);
            gridContainer.appendChild(window.createCompactCreatedRoutineCard(r, day.label, isToday));
        });
        container.appendChild(gridContainer);

        // Unassigned
        if (unassigned.length > 0) {
            const title = document.createElement('div');
            title.className = 'col-12 unassigned-section-title';
              title.innerText = 'Rutinas libres para hoy';
            container.appendChild(title);

            const unassignedGrid = document.createElement('div');
            unassignedGrid.className = 'col-12 weekly-grid';
            unassigned.forEach(r => {
                unassignedGrid.appendChild(window.createCompactCreatedRoutineCard(r, 'General', false));
            });
            container.appendChild(unassignedGrid);
        }
    };

    // Today View
    window.renderCreatedTodayView = function (routines, container) {
        const todayKey = new Date().toLocaleDateString("en-US", { weekday: "long" });
        const relevant = routines.filter(r => !r.routine_day || r.routine_day === todayKey);

        // Toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'col-12 d-flex justify-content-end mb-3';
        toolbar.innerHTML = `
          <div class="btn-group btn-group-sm bg-dark border border-secondary rounded" role="group">
              <button type="button" class="btn btn-outline-secondary ${window.currentCreatedTodayStyle === 'card' ? 'active' : ''}" id="btnCreatedTodayStyleCard"><i class="fas fa-th-large"></i></button>
              <button type="button" class="btn btn-outline-secondary ${window.currentCreatedTodayStyle === 'compact' ? 'active' : ''}" id="btnCreatedTodayStyleCompact"><i class="fas fa-compress-arrows-alt"></i></button>
          </div>
       `;
        container.appendChild(toolbar);

        toolbar.querySelector('#btnCreatedTodayStyleCard').onclick = () => { window.currentCreatedTodayStyle = 'card'; window.renderCreatedRoutines(); };
        toolbar.querySelector('#btnCreatedTodayStyleCompact').onclick = () => { window.currentCreatedTodayStyle = 'compact'; window.renderCreatedRoutines(); };

        if (relevant.length === 0) {
            container.insertAdjacentHTML('beforeend', '<div class="col-12 text-muted text-center py-4">No hay rutinas.</div>');
            return;
        }

        if (window.currentCreatedTodayStyle === 'compact') {
            const grid = document.createElement('div');
            grid.className = 'col-12 weekly-grid';
            relevant.forEach(r => {
                const label = (r.routine_day === todayKey) ? "Hoy" : "General";
                grid.appendChild(window.createCompactCreatedRoutineCard(r, label, r.routine_day === todayKey));
            });
            container.appendChild(grid);
        } else {
            relevant.forEach(r => {
                container.appendChild(window.createCreatedRoutineCard(r));
            });
        }
    };

    // Collapsed View
    window.renderCreatedWeeklyCollapsedView = function () {
        const container = document.getElementById('created-weekly-collapsed-summary');
        if (!container) return;
        container.style.display = 'block';
        container.innerHTML = '';

        const row = document.createElement('div');
        row.className = 'd-flex justify-content-between align-items-center mb-0 px-2 overflow-auto gap-2';

        const days = [
            { key: 'Sunday', label: 'D' }, { key: 'Monday', label: 'L' }, { key: 'Tuesday', label: 'M' },
            { key: 'Wednesday', label: 'M' }, { key: 'Thursday', label: 'J' }, { key: 'Friday', label: 'V' }, { key: 'Saturday', label: 'S' }
        ];
        const todayEng = new Date().toLocaleDateString("en-US", { weekday: "long" });
        const routineByDay = {};
        window.loadedCreatedRoutinesCache.forEach(r => { if (r.routine_day) routineByDay[r.routine_day] = r; });

        const cardContainer = document.createElement('div');
        cardContainer.className = 'mt-3';
        cardContainer.style.display = 'none';

        days.forEach(day => {
            const r = routineByDay[day.key];
            const isToday = (day.key === todayEng);
            const circle = document.createElement('div');
            circle.className = `day-initial-circle ${r ? 'has-routine' : ''} ${isToday ? 'is-today' : ''} flex-shrink-0`;
            circle.innerText = day.label;

            if (r) {
                circle.onclick = () => {
                    container.querySelectorAll('.day-initial-circle').forEach(el => el.classList.remove('active'));
                    if (window.activeCreatedCollapsedRoutineId === r._id) {
                        cardContainer.style.display = 'none';
                        window.activeCreatedCollapsedRoutineId = null;
                    } else {
                        circle.classList.add('active');
                        cardContainer.style.display = 'block';
                        cardContainer.innerHTML = '';
                        const card = window.createCompactCreatedRoutineCard(r, window.translateDay ? window.translateDay(r.routine_day) : day.label, isToday);
                        // Modify onclick to just open, not redirect directly in collapsed
                        cardContainer.appendChild(card);
                        window.activeCreatedCollapsedRoutineId = r._id;
                    }
                };
            }
            row.appendChild(circle);
        });

        container.appendChild(row);
        container.appendChild(cardContainer);
    };

    // Helper: Standard Card for Created Routines
    window.createCreatedRoutineCard = function (r) {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';

        // Ensure map is populated for modal
        if (r && r._id && window.routinesMap) {
            window.routinesMap.set(r._id, r);
        }

        // Count exercises using global helper if available, else local logic
        const exCount = window.countExercises ? window.countExercises(r) : (r.items || []).length;

        col.innerHTML = `
            <div class="card h-100 bg-panel border-secondary shadow-sm">
                <div class="card-body p-3">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <h5 class="card-title text-theme fw-bold mb-1 text-truncate" title="${r.name}" role="button" onclick="window.openRoutineModal('${r._id}')">${r.name}</h5>
                             <div class="text-secondary small">${exCount} ejercicios</div>
                        </div>
                        <div class="dropdown">
                             <button class="btn btn-sm btn-link text-secondary" data-bs-toggle="dropdown"><i class="fas fa-ellipsis-v"></i></button>
                             <ul class="dropdown-menu dropdown-menu-dark">
                                 <li><a class="dropdown-item" href="/workout/routines/builder-guided?id=${r._id}"><i class="fas fa-edit me-2"></i>Editar</a></li>
                                 <li><hr class="dropdown-divider"></li>
                                 <li><a class="dropdown-item text-danger" href="#" onclick="window.deleteCreatedRoutine('${r._id}')"><i class="fas fa-trash me-2"></i>Eliminar</a></li>
                             </ul>
                        </div>
                    </div>
                    <p class="card-text text-secondary small text-truncate mb-3">${r.description || "Sin descripción"}</p>
                    <div class="d-flex justify-content-between align-items-center mt-auto pt-2 border-top border-secondary">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="toggle-${r._id}" ${r.is_active ? 'checked' : ''} onchange="window.toggleRoutineVisibility('${r._id}')">
                            <label class="form-check-label small text-muted" for="toggle-${r._id}">Activa</label>
                        </div>
                        <a href="/workout/run/${r._id}?return_to=/dashboard" class="btn btn-sm btn-outline-primary"><i class="fas fa-play me-1"></i> Iniciar</a>
                    </div>
                </div>
            </div>
        `;
        return col;
    };

    // Helper: Compact Card for Created Routines
    window.createCompactCreatedRoutineCard = function (r, label, isToday) {
        const card = document.createElement('div');
        card.className = `weekly-day-card ${r ? 'has-routine' : ''} ${isToday ? 'is-today' : ''}`;

        let content = `<div class="weekly-day-label">${label}</div>`;

        if (r) {
            if (window.routinesMap) window.routinesMap.set(r._id, r);
            const exCount = window.countExercises ? window.countExercises(r) : (r.items || []).length;
            content += `
                <div class="weekly-routine-name" title="${r.name}">${r.name}</div>
                <div class="text-secondary small mb-1" style="font-size:0.7rem">${exCount} Ejercicios</div>
                  <div class="d-flex gap-1 justify-content-center mt-auto w-100">
                      <a href="/workout/run/${r._id}?return_to=/dashboard" class="btn btn-sm btn-primary weekly-routine-btn-compact" style="flex:1;" title="Iniciar"><i class="fas fa-play"></i></a>
                      <a href="/workout/routines/builder-guided?id=${r._id}" class="btn btn-sm btn-outline-info weekly-routine-btn-compact weekly-routine-btn-icon" title="Editar"><i class="fas fa-edit"></i></a>
                  </div>
            `;
            // Add click handler to open modal
            card.onclick = (e) => {
                // Prevent if clicking buttons
                if (e.target.closest('a') || e.target.closest('button')) return;
                window.openRoutineModal(r._id);
            };
        } else {
            content += `<div class="text-muted small mt-2">-</div>`;
        }

        card.innerHTML = content;
        return card;
    };

    window.toggleRoutineVisibility = async function (id) {
        try { await fetch(`/workout/api/my-routines/${id}/toggle-dash`, { method: 'POST' }); } catch (e) { console.error(e); }
    };

    window.deleteCreatedRoutine = function (id) {
        if (confirm('¿Eliminar esta rutina?')) {
            alert('Funcionalidad de eliminar pendiente de implementar en API.');
        }
    };

})();
