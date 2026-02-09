
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
                    <a href="/workout/watch/${id}?return_to=${encodeURIComponent(returnTo)}" class="btn btn-sm btn-outline-primary px-3" title="Iniciar">
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
              <button class="btn btn-sm btn-primary weekly-routine-btn" onclick="event.stopPropagation(); window.location.href='/workout/watch/${r._id}?return_to=${encodeURIComponent(window.currentReturnTo)}'">
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

    const partsLabel = window.getRoutineBodyPartsLabel(routine);
    const exercises = window.countExercises(routine);
    const day = routine.routine_day ? window.translateDay(routine.routine_day) : "-";
    const validity = routine.assigned_expires_at ? window.formatDate(routine.assigned_expires_at) : "";

    modalTitle.innerText = routine.name || "Detalle de Rutina";

    // Build Rich Preview HTML
    const previewHtml = buildRoutinePreviewHtml(routine);

    modalBody.innerHTML = `
        <div class="routine-preview-card" style="background: transparent; border: none; padding: 0;">
            <div class="text-center mb-3">
                <div class="h3 fw-bold text-white mb-1">${routine.name || "Rutina"}</div>
                <div class="text-secondary small">${exercises} ejercicios - Revisa los detalles antes de iniciar</div>
            </div>
            <div class="row g-2 mb-3">
                <div class="col-6">
                    <div class="text-secondary small">Grupos</div>
                    <div class="text-info small">${partsLabel}</div>
                </div>
                <div class="col-6">
                    <div class="text-secondary small">Día</div>
                    <div class="text-warning small">${day}</div>
                </div>
                <div class="col-6">
                    <div class="text-secondary small">Ejercicios</div>
                    <div class="text-white small">${exercises}</div>
                </div>
                <div class="col-6">
                    <div class="text-secondary small">Estado</div>
                    <div class="text-white small">${validity || (routine.is_active !== false ? "Activa" : "Oculta")}</div>
                </div>
            </div>
            <hr class="border-secondary">
            <div class="routine-preview-scroll d-flex flex-column gap-2" style="max-height: 400px; overflow-y: auto;">
                ${previewHtml}
            </div>
            <div class="d-grid mt-3">
               <a href="/workout/watch/${routine._id}?return_to=${encodeURIComponent(window.currentReturnTo)}" class="btn btn-primary">
                 <i class="fas fa-play me-2"></i> Iniciar Rutina
               </a>
            </div>
        </div>
      `;

    // Initialize Video Buttons
    // Note: buildRoutinePreviewHtml uses onclick="openVideoModal('url')" so we don't need manual listeners here if we expose openVideoModal to window or ensure it's in scope. 
    // The previous implementation added listeners. The new one uses onclick attributes. 
    // We need to make sure openVideoModal is available globally or we attach listeners.
    // The ported code uses onclick="openVideoModal(...)". We will expose openVideoModal to window.

    const modal = new bootstrap.Modal(document.getElementById("routineModal"));
    modal.show();

    // Ensure video modal cleanup
    const videoModalEl = document.getElementById("videoModal");
    if (videoModalEl) {
      videoModalEl.addEventListener('hidden.bs.modal', () => {
        const frame = document.getElementById("videoFrame");
        if (frame) frame.src = "";
      }, { once: true });
    }
  };


  // --- Rich Rendering Helpers (Ported from routines_catalog_user.html) ---

  function buildRoutinePreviewHtml(routine) {
    // Handle both older 'groups' structure and newer/flat 'items' structure
    // If 'groups' exists and 'items' is empty/flat, we might need to favor groups or flatten groups into items for the renderer.
    // The robust catalog renderer works on a flat list of items that are tagged with item_type='group' or 'exercise'
    // OR it handles a 'groups' array if we adapt it.
    // Let's adapt routine.groups into a flat list if routine.items is empty/incompatible, 
    // OR just rely on routine.items if the backend provides it normalized (which api_my_routine_detail does).
    // However, 'Assigned Routines' might still rely on 'groups'.

    let items = [];
    if (routine.items && routine.items.length > 0) {
      items = routine.items;
    } else if (routine.groups && routine.groups.length > 0) {
      // Convert legacy groups to flattened items for the renderer
      routine.groups.forEach(g => {
        items.push({ item_type: 'group', name: g.name, _id: g._id || 'g_' + Math.random() });
        if (g.items) items.push(...g.items.map(i => ({ ...i, group_id: g._id })));
      });
    }

    const isRestItem = (item) => item && (item.item_type === "rest" || (!item.exercise_id && item.rest_seconds != null));
    const isExerciseItem = (item) => item && (item.item_type === "exercise" || !item.item_type); // Default to exercise
    const isGroupHeader = (item) => item && item.item_type === "group";
    const safeId = (value) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "");

    // 1. Pre-scan for Group Metadata
    const groupMetaMap = new Map();
    items.forEach(item => {
      if (isGroupHeader(item)) {
        groupMetaMap.set(item._id || item.id, {
          name: item.group_name || item.name || "Circuito",
          note: item.note || item.description || ""
        });
      }
    });

    // 2. Cluster items
    const blocks = [];
    const blockIds = new Set();
    const groupEntries = new Map();

    const ensureGroupBlock = (groupId) => {
      if (!groupId || blockIds.has(groupId)) return;
      blockIds.add(groupId);
      blocks.push({ type: 'group', id: groupId });
    };

    items.forEach((item, idx) => {
      // Inline groups
      if (item.item_type === "group" && item.items && Array.isArray(item.items)) {
        blocks.push({ type: 'inline_group', item: item });
        return;
      }
      if (item.item_type === "group") {
        ensureGroupBlock(item._id || item.id);
        return;
      }

      if (isExerciseItem(item) || isRestItem(item)) {
        const gid = item.group_id;
        if (gid) {
          ensureGroupBlock(gid);
          if (!groupEntries.has(gid)) groupEntries.set(gid, []);
          groupEntries.get(gid).push(item);
        } else {
          blocks.push({ type: 'ungrouped', entry: item });
        }
      }
    });

    // 3. Render Blocks
    const htmlParts = [];
    let lastBlockWasUngrouped = false;

    const renderEntry = (item, idxKey) => {
      if (isRestItem(item)) {
        const restLabel = item.note || "Descanso";
        const restSeconds = getRestSeconds(item);
        return `
                    <div class="routine-preview-item d-flex justify-content-between align-items-center mb-1" style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px;">
                        <div>
                            <div class="text-white small fw-bold"><i class="fas fa-hourglass-half me-2 text-secondary"></i>${restLabel}</div>
                        </div>
                        <div class="text-end text-secondary small">${restSeconds}s</div>
                    </div>
                `;
      }

      const name = item.exercise_name || item.name || "Ejercicio";
      const bodyPartLabel = translateBodyPart(item.body_part);
      const sets = item.target_sets || item.sets || 1;
      const reps = item.target_reps || item.reps || "-";
      const time = item.target_time_seconds || item.time_seconds || 60;
      const isTime = (item.exercise_type || item.type) === "time" || (item.exercise_type || item.type) === "cardio";
      // Check for series (legacy structure from assigned routines)
      let setsRepText = `${sets} sets ${isTime ? `x ${time}s` : `x ${reps}`}`;
      if (item.series && Array.isArray(item.series) && item.series.length > 0) {
        setsRepText = `${item.series.length} series: ` + item.series.map(s => s.reps).join('/');
      }

      const rest = getRestSeconds(item);
      const equipmentMeta = getEquipmentMeta(item.equipment);
      const hasVideo = item.video_url && item.video_url.trim() !== "";
      // Simplified subs for now
      const substitutes = resolveSubstitutes(item.substitutes || []);
      const subsId = `subs_${safeId(routine._id)}_${idxKey}`;

      return `
                <div class="routine-preview-item d-flex justify-content-between align-items-start mb-2" style="background: rgba(40,40,45,0.8); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                    <div class="flex-grow-1">
                        <div class="d-flex align-items-center gap-2">
                             <span class="badge bg-dark text-secondary border border-secondary" style="font-size: 0.6rem; min-width: 20px;">${idxKey.split('_').pop() * 1 + 1}</span>
                            <div class="text-white fw-bold" style="font-size: 0.9rem;">${name}</div>
                            ${hasVideo ? `
                                <button class="btn btn-sm btn-link p-0 text-danger" onclick="window.openVideoModal('${item.video_url}')">
                                    <i class="fab fa-youtube"></i>
                                </button>
                            ` : ""}
                        </div>
                        <div class="d-flex flex-wrap gap-2 mt-1">
                            <span class="badge bg-secondary" style="font-size: 0.65rem;">${bodyPartLabel}</span>
                            <span class="badge bg-dark border border-secondary text-info" style="font-size: 0.65rem;">
                                <i class="${equipmentMeta.icon} me-1"></i>${equipmentMeta.label}
                            </span>
                        </div>
                         ${substitutes.length ? `
                            <button class="btn btn-sm btn-link text-info p-0 mt-1" style="font-size: 0.7rem; text-decoration: none;" type="button" data-bs-toggle="collapse" data-bs-target="#${subsId}">
                                <i class="fas fa-exchange-alt me-1"></i> Sustitutos (${substitutes.length})
                            </button>
                            <div class="collapse mt-1" id="${subsId}">
                                <div class="d-flex flex-column gap-1 ps-2 border-start border-info">
                                    ${substitutes.map(sub => `
                                        <div class="d-flex align-items-center gap-2">
                                            <div class="text-secondary small" style="font-size: 0.8rem;">${sub.name || "Ejercicio"}</div>
                                            ${sub.video_url ? `
                                                <button class="btn btn-sm btn-link p-0 text-danger" onclick="window.openVideoModal('${sub.video_url}')"><i class="fab fa-youtube" style="font-size: 0.8rem;"></i></button>
                                            ` : ""}
                                        </div>
                                    `).join("")}
                                </div>
                            </div>
                        ` : ""}
                    </div>
                    <div class="text-end text-secondary small ms-2" style="min-width: 80px;">
                        <div class="fw-bold text-light">${setsRepText}</div>
                        <div>Descanso ${rest}s</div>
                    </div>
                </div>
            `;
    };

    blocks.forEach((block, bIdx) => {
      if (block.type === 'ungrouped') {
        if (!lastBlockWasUngrouped) {
          htmlParts.push(`<h6 class="text-cyber-blue small fw-bold text-uppercase mt-3 mb-2">Ejercicios</h6>`);
          lastBlockWasUngrouped = true;
        }
        htmlParts.push(renderEntry(block.entry, `u_${bIdx}`));
      } else if (block.type === 'group') {
        lastBlockWasUngrouped = false;
        const entries = groupEntries.get(block.id) || [];
        const meta = groupMetaMap.get(block.id) || { name: "Circuito", note: "" };

        if (entries.length > 0) {
          htmlParts.push(`
                        <div class="mt-3 mb-2 p-2 rounded" style="background: rgba(0, 210, 255, 0.05); border: 1px dashed rgba(0, 210, 255, 0.2);">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <div class="text-info fw-bold small text-uppercase">${meta.name}</div>
                                <div class="text-secondary small" style="font-size: 0.7rem;">${entries.length} items</div>
                            </div>
                            ${meta.note ? `<div class="text-secondary small fst-italic mb-2">"${meta.note}"</div>` : ""}
                            ${entries.map((entry, eIdx) => renderEntry(entry, `g_${block.id}_${eIdx}`)).join("")}
                        </div>
                    `);
        }
      } else if (block.type === 'inline_group') {
        lastBlockWasUngrouped = false;
        const item = block.item;
        // Handle legacy inline group internal items which might define their own structure
        const entries = (item.items || []).filter(sub => isExerciseItem(sub) || isRestItem(sub));
        if (entries.length > 0) {
          htmlParts.push(`
                        <div class="mt-3 mb-2 p-2 rounded" style="background: rgba(255, 165, 0, 0.05); border: 1px dashed rgba(255, 165, 0, 0.2);">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <div class="text-warning fw-bold small text-uppercase">${item.group_name || item.name || "Circuito"}</div>
                                <div class="text-secondary small" style="font-size: 0.7rem;">${entries.length} items</div>
                            </div>
                            ${(item.note || item.description) ? `<div class="text-secondary small fst-italic mb-2">"${item.note || item.description}"</div>` : ""}
                             ${entries.map((entry, eIdx) => renderEntry(entry, `ig_${bIdx}_${eIdx}`)).join("")}
                        </div>
                    `);
        }
      }
    });

    if (htmlParts.length === 0) return '<div class="text-muted text-center py-3">No hay ejercicios en esta rutina.</div>';
    return htmlParts.join("");
  }

  function getRestSeconds(item) {
    if (!item) return 60;
    if (item.rest_seconds != null) return item.rest_seconds;
    if (item.rest != null && item.rest !== item.target_time_seconds) return item.rest;
    return 60;
  }

  function getEquipmentMeta(equipmentKey) {
    const raw = Array.isArray(equipmentKey) ? (equipmentKey[0] || "") : equipmentKey;
    const map = {
      barbell: { label: "Barra", icon: "fas fa-grip-lines" },
      dumbbell: { label: "Mancuernas", icon: "fas fa-dumbbell" },
      machine: { label: "Máquina", icon: "fas fa-cogs" },
      cable: { label: "Polea", icon: "fas fa-wave-square" },
      band: { label: "Banda", icon: "fas fa-link" },
      bench: { label: "Banco", icon: "fas fa-chair" },
      bodyweight: { label: "Corporal", icon: "fas fa-running" },
      other: { label: "Otro", icon: "fas fa-toolbox" }
    };
    return map[raw] || { label: "Gral", icon: "fas fa-dumbbell" };
  }

  function translateBodyPart(bp) {
    const map = {
      'chest': 'Pecho', 'back': 'Espalda', 'legs': 'Pierna',
      'shoulders': 'Hombros', 'arms': 'Brazos', 'abs': 'Abdomen',
      'cardio': 'Cardio', 'fullbody': 'Full Body'
    };
    return map[bp] || bp || "Gral";
  }

  function resolveSubstitutes(substitutes) {
    if (!Array.isArray(substitutes) || substitutes.length === 0) return [];
    return substitutes.filter(s => s && typeof s === 'object');
  }

  window.openVideoModal = function (url) {
    const frame = document.getElementById("videoFrame");
    if (frame) {
      // transform watch URL to embed if needed
      let embedUrl = url;
      if (embedUrl.includes("youtube.com/watch")) {
        const match = embedUrl.match(/[?&]v=([^&]+)/);
        if (match && match[1]) embedUrl = `https://www.youtube.com/embed/${match[1]}`;
      } else if (embedUrl.includes("youtu.be/")) {
        const match = embedUrl.match(/youtu\.be\/([^?&]+)/);
        if (match && match[1]) embedUrl = `https://www.youtube.com/embed/${match[1]}`;
      }

      frame.src = embedUrl;
      const modal = new bootstrap.Modal(document.getElementById("videoModal"));
      modal.show();
      // Cleanup handled in openRoutineModal event listener to avoid duplicate listeners
    }
  }

})();
