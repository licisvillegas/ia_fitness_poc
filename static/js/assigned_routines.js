
(function () {
  // Global maps and state
  window.routinesMap = new Map();
  window.currentRoutineView = 'weekly'; // Default to weekly
  window.loadedRoutinesCache = [];
  window.currentReturnTo = "/dashboard";
  window.activeCollapsedRoutineId = null;
  window.currentTodayStyle = 'card'; // 'card' or 'compact'

  // Helper: Count total exercises in a routine
  window.countExercises = function (routine) {
    if (!routine) return 0;
    // 1. If groups exist
    if (routine.groups && Array.isArray(routine.groups)) {
      let count = 0;
      routine.groups.forEach((g) => {
        if (g.items) {
          count += g.items.filter((i) => i.item_type === "exercise" || !i.item_type).length;
        }
      });
      return count;
    }
    // 2. If flat items exist
    if (routine.items && Array.isArray(routine.items)) {
      return routine.items.filter((i) => i.item_type === "exercise" || !i.item_type).length;
    }
    return 0;
  };

  // Helper: Get label for body parts
  window.getRoutineBodyPartsLabel = function (routine) {
    if (!routine) return "";
    // If backend provides body_parts populated
    if (routine.body_parts && routine.body_parts.length > 0) {
      return routine.body_parts.map(bp => bp.name).join(", ");
    }
    return "General";
  };

  // Helper: Translate Day
  window.translateDay = function (dayEng) {
    const map = {
      'Monday': 'Lunes', 'Tuesday': 'Martes', 'Wednesday': 'Miércoles',
      'Thursday': 'Jueves', 'Friday': 'Viernes', 'Saturday': 'Sábado',
      'Sunday': 'Domingo'
    };
    return map[dayEng] || dayEng;
  };

  // Helper: Format Date
  window.formatDate = function (dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString();
  };

  // Helper: Ensure dependencies
  window.ensureRoutineDependencies = async function () {
    // Placeholder if any specific logic needed.
    // Usually used to load common modals or scripts.
    return true;
  };

  // Setup Switcher Listeners
  document.addEventListener('DOMContentLoaded', () => {
    const btnGrid = document.getElementById('btnViewGrid');
    const btnWeekly = document.getElementById('btnViewWeekly');
    const btnToday = document.getElementById('btnViewToday');

    const setView = (view) => {
      window.currentRoutineView = view;
      if (view === 'today') {
        window.currentTodayStyle = 'compact';
      }
      // Update UI buttons
      [btnGrid, btnWeekly, btnToday].forEach(btn => btn?.classList.remove('active'));
      if (view === 'grid') btnGrid?.classList.add('active');
      if (view === 'weekly') btnWeekly?.classList.add('active');
      if (view === 'today') btnToday?.classList.add('active');

      // Check collapse state
      const collapseEl = document.getElementById('assignedRoutinesCollapse');
      const isCollapsed = collapseEl && !collapseEl.classList.contains('show');

      // Auto-expand on ANY view selection (Grid, Today, or Weekly)
      if (isCollapsed) {
        new bootstrap.Collapse(collapseEl, { show: true });

        // Force render for the new view
        const summaryEl = document.getElementById('weekly-collapsed-summary');
        if (summaryEl) summaryEl.style.display = 'none';
        window.renderRoutines();
        return;
      }

      if (isCollapsed && view === 'weekly') {
        window.renderWeeklyCollapsedView();
      } else {
        const summaryEl = document.getElementById('weekly-collapsed-summary');
        if (summaryEl) summaryEl.style.display = 'none';
      }

      // Re-render main view if visible
      if (!isCollapsed) window.renderRoutines();
    };

    btnGrid?.addEventListener('click', () => setView('grid'));
    btnWeekly?.addEventListener('click', () => setView('weekly'));
    btnToday?.addEventListener('click', () => setView('today'));

    // Collapse Events
    const collapseEl = document.getElementById('assignedRoutinesCollapse');
    const summaryEl = document.getElementById('weekly-collapsed-summary');

    if (collapseEl && summaryEl) {
      collapseEl.addEventListener('hide.bs.collapse', () => {
        // Always render summary on collapse for consistent UX
        window.renderWeeklyCollapsedView();
      });
      collapseEl.addEventListener('show.bs.collapse', () => {
        summaryEl.style.display = 'none';
      });
    }
  });

  // Main Load Function
  window.loadRoutines = async function (userId, options) {
    const listEl = document.getElementById("routines-list");
    const sectionEl = document.getElementById("my-routines");
    window.currentReturnTo = (options && options.returnTo) || "/dashboard";

    if (!listEl || !sectionEl) return;
    if (!userId) {
      listEl.innerHTML =
        '<div class="col-12 text-muted text-center py-3">Selecciona un usuario para ver rutinas asignadas.</div>';
      sectionEl.style.display = "block";
      return;
    }
    if (window.showLoader) window.showLoader("Buscando rutinas...");

    await window.ensureRoutineDependencies();

    listEl.innerHTML = "";
    sectionEl.style.display = "block";

    try {
      const res = await fetch(`/workout/api/routines?user_id=${encodeURIComponent(userId)}`);
      window.loadedRoutinesCache = await res.json();
      if (!Array.isArray(window.loadedRoutinesCache)) window.loadedRoutinesCache = [];

      window.renderRoutines();

      // Initial Render of Collapsed View if needed
      const collapseEl = document.getElementById('assignedRoutinesCollapse');
      if (collapseEl && !collapseEl.classList.contains('show') && window.currentRoutineView === 'weekly') {
        window.renderWeeklyCollapsedView();
      }

    } catch (e) {
      console.error(e);
      listEl.innerHTML = '<div class="col-12 text-danger text-center">Error cargando rutinas.</div>';
    } finally {
      if (window.hideLoader) window.hideLoader();
    }
  };

  // Main Render Function
  window.renderRoutines = function () {
    const listEl = document.getElementById("routines-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    const routines = window.loadedRoutinesCache;

    if (routines.length === 0) {
      listEl.innerHTML = '<div class="col-12 text-muted text-center py-3">No hay rutinas asignadas para este usuario.</div>';
      return;
    }

    if (window.currentRoutineView === 'weekly') {
      window.renderWeeklyView(routines, listEl);
    } else if (window.currentRoutineView === 'today') {
      window.renderTodayView(routines, listEl);
    } else {
      window.renderGridView(routines, listEl);
    }
  };

  // Grid View Renderer
  window.renderGridView = function (routines, container) {
    const dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };
    const sorted = [...routines].sort((a, b) => {
      const da = dayOrder[a.routine_day] || 99;
      const db = dayOrder[b.routine_day] || 99;
      if (da !== db) return da - db;
      return (a.name || "").localeCompare(b.name || "");
    });

    const todayKey = new Date().toLocaleDateString("en-US", { weekday: "long" });

    sorted.forEach((r) => {
      if (r && r._id) window.routinesMap.set(r._id, r);
      container.appendChild(window.createRoutineCard(r, todayKey));
    });
  };

  // Weekly View Renderer
  window.renderWeeklyView = function (routines, container) {
    const days = [
      { key: 'Sunday', label: 'Domingo' },
      { key: 'Monday', label: 'Lunes' },
      { key: 'Tuesday', label: 'Martes' },
      { key: 'Wednesday', label: 'Miércoles' },
      { key: 'Thursday', label: 'Jueves' },
      { key: 'Friday', label: 'Viernes' },
      { key: 'Saturday', label: 'Sábado' }
    ];

    // Today Check
    const todayEng = new Date().toLocaleDateString("en-US", { weekday: "long" });

    // 1. Weekly Grid Container
    const gridContainer = document.createElement('div');
    gridContainer.className = 'col-12 weekly-grid';

    // 2. Map routines by day
    const routineByDay = {};
    const unassigned = [];

    routines.forEach(r => {
      if (r.routine_day) {
        routineByDay[r.routine_day] = r;
      } else {
        unassigned.push(r);
      }
    });

    days.forEach(day => {
      const r = routineByDay[day.key];
      const isToday = (day.key === todayEng);
      gridContainer.appendChild(window.createCompactRoutineCard(r, day.label, isToday));
    });

    container.appendChild(gridContainer);

    // 3. Unassigned Routines
    if (unassigned.length > 0) {
      const title = document.createElement('div');
      title.className = 'col-12 unassigned-section-title';
      title.innerText = 'Rutinas libres para hoy';
      container.appendChild(title);

      const unassignedGrid = document.createElement('div');
      unassignedGrid.className = 'col-12 weekly-grid';

      unassigned.forEach(r => {
        unassignedGrid.appendChild(window.createCompactRoutineCard(r, 'General', false));
      });

      container.appendChild(unassignedGrid);
    }
  };

  // Today View Renderer
  window.renderTodayView = function (routines, container) {
    const todayKey = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const relevantRoutines = routines.filter(r => !r.routine_day || r.routine_day === todayKey);

    // 1. Sub-selector Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'col-12 d-flex justify-content-end mb-3';
    toolbar.innerHTML = `
          <div class="btn-group btn-group-sm bg-dark border border-secondary rounded" role="group">
              <button type="button" class="btn btn-outline-secondary ${window.currentTodayStyle === 'card' ? 'active' : ''}" id="btnTodayStyleCard" title="Tarjetas Grandes"><i class="fas fa-th-large"></i></button>
              <button type="button" class="btn btn-outline-secondary ${window.currentTodayStyle === 'compact' ? 'active' : ''}" id="btnTodayStyleCompact" title="Compacto"><i class="fas fa-compress-arrows-alt"></i></button>
          </div>
       `;
    container.appendChild(toolbar);

    // Bind events
    toolbar.querySelector('#btnTodayStyleCard').onclick = () => {
      window.currentTodayStyle = 'card';
      window.renderRoutines();
    };
    toolbar.querySelector('#btnTodayStyleCompact').onclick = () => {
      window.currentTodayStyle = 'compact';
      window.renderRoutines();
    };

    if (relevantRoutines.length === 0) {
      container.insertAdjacentHTML('beforeend', '<div class="col-12 text-muted text-center py-4">No hay rutinas para hoy ni rutinas generales disponibles.</div>');
      return;
    }

    if (window.currentTodayStyle === 'compact') {
      const compactGrid = document.createElement('div');
      compactGrid.className = 'col-12 weekly-grid';
      relevantRoutines.forEach(r => {
        const label = (r.routine_day === todayKey) ? "Hoy" : "General";
        const isTodayCard = (r.routine_day === todayKey);
        compactGrid.appendChild(window.createCompactRoutineCard(r, label, isTodayCard));
      });
      container.appendChild(compactGrid);
    } else {
      relevantRoutines.forEach(r => {
        if (r && r._id) window.routinesMap.set(r._id, r);
        const card = window.createRoutineCard(r, todayKey);
        container.appendChild(card);
      });
    }
  };

  // Render Collapsed Weekly View
  window.renderWeeklyCollapsedView = function () {
    const container = document.getElementById('weekly-collapsed-summary');
    if (!container) return;

    container.style.display = 'block';
    container.innerHTML = '';

    // 1. Render Initials Row
    const row = document.createElement('div');
    row.className = 'd-flex justify-content-between align-items-center mb-0 px-2 overflow-auto gap-2';

    const days = [
      { key: 'Sunday', label: 'D' },
      { key: 'Monday', label: 'L' },
      { key: 'Tuesday', label: 'M' },
      { key: 'Wednesday', label: 'M' },
      { key: 'Thursday', label: 'J' },
      { key: 'Friday', label: 'V' },
      { key: 'Saturday', label: 'S' }
    ];

    const todayEng = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const routineByDay = {};
    const unassigned = [];
    window.loadedRoutinesCache.forEach(r => {
      if (r.routine_day) {
        routineByDay[r.routine_day] = r;
      } else {
        unassigned.push(r);
      }
    });

    // Card Container (Hidden initially)
    const cardContainer = document.createElement('div');
    cardContainer.className = 'mt-3';
    cardContainer.id = 'collapsed-routine-card-container';
    cardContainer.style.display = 'none';

    days.forEach(day => {
      const r = routineByDay[day.key];
      const isToday = (day.key === todayEng);

      const circle = document.createElement('div');
      circle.className = `day-initial-circle ${r ? 'has-routine' : ''} ${isToday ? 'is-today' : ''} flex-shrink-0`;
      circle.innerText = day.label;

      if (r) {
        circle.onclick = () => {
          // Toggle card visibility
          document.querySelectorAll('.day-initial-circle').forEach(el => el.classList.remove('active'));

          if (window.activeCollapsedRoutineId === r._id) {
            // Close
            cardContainer.style.display = 'none';
            window.activeCollapsedRoutineId = null;
          } else {
            // Open
            circle.classList.add('active');
            cardContainer.style.display = 'block';
            cardContainer.innerHTML = '';
            const card = window.createCompactRoutineCard(r, window.translateDay(r.routine_day), isToday);
            cardContainer.appendChild(card);
            if (unassigned.length > 0) {
              const title = document.createElement('div');
              title.className = 'col-12 unassigned-section-title mt-3';
              title.innerText = 'Rutinas libres para hoy';
              cardContainer.appendChild(title);

              const unassignedGrid = document.createElement('div');
              unassignedGrid.className = 'col-12 weekly-grid';
              unassigned.forEach(u => {
                unassignedGrid.appendChild(window.createCompactRoutineCard(u, 'General', false));
              });
              cardContainer.appendChild(unassignedGrid);
            }
            window.activeCollapsedRoutineId = r._id;
          }
        };
      }

      row.appendChild(circle);
    });

    container.appendChild(row);
    container.appendChild(cardContainer);
  };

  // Helper: Create Standard Routine Card
  window.createRoutineCard = function (r, todayKey) {
    const cardCol = document.createElement("div");
    cardCol.className = "col-md-6 col-lg-4";

    const name = r.name || "Rutina sin nombre";
    const exCount = window.countExercises(r);
    const id = r._id;
    const partsLabel = window.getRoutineBodyPartsLabel(r);
    const dayLabel = r.routine_day ? window.translateDay(r.routine_day) : null;
    const isToday = r.routine_day && r.routine_day === todayKey;
    const validity = r.assigned_expires_at ? window.formatDate(r.assigned_expires_at) : null;
    const returnTo = window.currentReturnTo || "/dashboard";

    cardCol.innerHTML = `
            <div class="card h-100 bg-panel border-secondary shadow-sm">
              <div class="card-body p-3">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div class="flex-grow-1">
                    <h5 class="card-title text-theme fw-bold mb-1 text-truncate" title="${name}">${name}</h5>
                    <div class="d-flex flex-wrap gap-1 mb-1">
                      <span class="badge bg-secondary" style="font-size: 0.7rem;">${partsLabel}</span>
                      ${dayLabel
        ? `<span class="badge bg-secondary border border-secondary text-info" style="font-size: 0.7rem;">${dayLabel}</span>`
        : `<span class="badge bg-secondary border border-secondary text-info" style="font-size: 0.7rem;"><i class="fas fa-infinity"></i></span>`}
                      ${isToday ? `<span class="badge bg-success text-dark" style="font-size: 0.7rem;"><i class="fas fa-bolt me-1"></i>Hoy</span>` : ""}
                    </div>
                  </div>
                  <span class="badge bg-secondary border border-secondary text-info ms-2" style="font-size: 0.65rem;">
                    ${exCount} ej.
                  </span>
                </div>
                <p class="card-text text-secondary small text-truncate mb-3">${r.description || "Sin descripción"}</p>
                <div class="d-flex justify-content-between align-items-center border-top border-secondary pt-2 mt-2">
                  <small class="text-muted text-uppercase fw-bold" style="font-size:0.65rem;">
                    ${validity ? `Vence: ${validity}` : "Vence: -"}
                  </small>
                  <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-info px-3" onclick="openRoutineModal('${id}')" title="Ver detalle">
                      <i class="fas fa-eye me-1"></i> Ver
                    </button>
                    <a href="/workout/run/${id}?return_to=${encodeURIComponent(returnTo)}" class="btn btn-sm btn-outline-primary px-3" title="Iniciar">
                      <i class="fas fa-play me-1"></i> Iniciar
                    </a>
                  </div>
                </div>
              </div>
            </div>
          `;
    return cardCol;
  };

  // Helper: Create Compact Routine Card
  window.createCompactRoutineCard = function (r, label, isToday) {
    const card = document.createElement('div');
    card.className = `weekly-day-card ${r ? 'has-routine' : ''} ${isToday ? 'is-today' : ''}`;

    let content = `<div class="weekly-day-label">${label}</div>`;

    if (r) {
      window.routinesMap.set(r._id, r);
      content += `
              <div class="weekly-routine-name" title="${r.name}">${r.name}</div>
              <div class="text-secondary small mb-1" style="font-size:0.7rem">${window.countExercises(r)} Ejercicios</div>
              <button class="btn btn-sm btn-primary weekly-routine-btn" onclick="event.stopPropagation(); window.location.href='/workout/run/${r._id}?return_to=${encodeURIComponent(window.currentReturnTo)}'">
                  <i class="fas fa-play me-1"></i>Iniciar
              </button>
          `;
      card.onclick = () => window.openRoutineModal(r._id);
    } else {
      content += `<div class="text-muted small mt-2">-</div>`;
    }

    card.innerHTML = content;
    return card;
  };

  // Open Modal (Rich View)
  window.openRoutineModal = async function (id) {
    const routine = window.routinesMap.get(id);
    if (!routine) return;

    const modalTitle = document.getElementById("routineModalTitle");
    const modalBody = document.getElementById("routineModalBody");
    if (!modalTitle || !modalBody) return;

    // Use RoutineRenderer for building the preview HTML
    if (typeof RoutineRenderer === 'undefined') {
      console.error("RoutineRenderer not found. Make sure routine_renderer.js is included.");
      modalBody.innerHTML = '<div class="text-danger p-3">Error: no se pudo cargar el renderizador de rutinas.</div>';
      return;
    }

    const previewHtml = RoutineRenderer.buildPreviewHtml(routine);

    const partsLabel = getRoutineBodyPartsLabel(routine);
    const exercises = window.countExercises(routine);
    const estDuration = (routine.estimated_duration_minutes || 45) + " min";

    // Calculate validity if assigned
    const assignedInfo = routine.assigned_info;
    let validityHtml = '';
    if (assignedInfo && assignedInfo.expires_at) {
      const exp = new Date(assignedInfo.expires_at);
      const now = new Date();
      const diffTime = exp - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        validityHtml = `<div class="text-danger small">Vencida hace ${Math.abs(diffDays)} días</div>`;
      } else {
        validityHtml = `<div class="text-success small">Vence en ${diffDays} días (${exp.toLocaleDateString()})</div>`;
      }
    }

    // Match RoutineDetails.js header style
    const dayLabel = (routine.routine_day && window.translateDay) ? window.translateDay(routine.routine_day) : "Flexible";
    const statusLabel = (routine.assigned_expires_at) ? window.formatDate(routine.assigned_expires_at) : "Activa";

    // Si ya calculamos validityHtml (días restantes), podemos usarlo o simplificarlo para que coincida con la imagen.
    // La imagen muestra "Estado: Activa". Vamos a mostrar statusLabel que es más genérico o "Activa".
    // Para ser fieles al screenshot:
    // Status text logic from RoutineDetails.js:
    // const validity = routine.assigned_expires_at ? formatDate... : (isActive ? "Activa" : "Oculta");

    modalBody.innerHTML = `
        <div class="routine-preview-card" style="background: transparent; border: none; padding: 0;">
            <div class="text-center mb-3">
                 <div class="h3 fw-bold text-white mb-1">${routine.name || "Rutina"}</div>
                 <div class="text-secondary small">${exercises} ejercicios - Revisa los detalles antes de iniciar</div>
            </div>
            
            <div class="row g-2 mb-3">
               <div class="col-6 text-center">
                  <div class="text-secondary small">Grupos</div>
                  <div class="text-info small text-truncate">${partsLabel}</div>
               </div>
               <div class="col-6 text-center">
                  <div class="text-secondary small">Día</div>
                  <div class="text-warning small">${dayLabel}</div>
               </div>
                <div class="col-6 text-center">
                  <div class="text-secondary small">Ejercicios</div>
                  <div class="text-white small">${exercises}</div>
               </div>
               <div class="col-6 text-center">
                  <div class="text-secondary small">Estado</div>
                  <div class="text-white small">${statusLabel}</div>
               </div>
            </div>
            
            <hr class="border-secondary" />

            <div class="routine-preview-scroll d-flex flex-column gap-2" style="max-height: 400px; overflow-y: auto;">
                ${previewHtml}
            </div>

            <div class="d-grid mt-3">
               <a href="/workout/run/${routine._id}?return_to=${encodeURIComponent(window.currentReturnTo)}" class="btn btn-primary btn-lg">
                 <i class="fas fa-play me-2"></i> Iniciar Rutina
               </a>
            </div>
        </div>
      `;

    const modal = new bootstrap.Modal(document.getElementById("routineModal"));
    modal.show();
  };

})();
