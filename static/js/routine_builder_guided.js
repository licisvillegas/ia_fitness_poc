
(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const isAdminBuilder = urlParams.get("source") === "admin";

  const state = {
    step: 1,
    exercises: [],
    bodyParts: [],
    routines: [],
    isEditingFlow: false,
    routine: {
      id: "",
      name: "",
      description: "",
      routine_day: "",
      routine_body_parts: [],
      items: [],
      is_active: true,
    },
  };

  const SETS_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];
  const REPS_OPTIONS = ["4-6", "6-8", "8-12", "10-12", "12-15", "15-20", "20-25", "AMRAP", "Reps fijas"];
  const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 180];
  const TIME_OPTIONS = [600, 900, 1200, 1800, 3600];

  let exerciseModal = null;
  let addExerciseModal = null;
  let confirmMoveModal = null;
  let alertModal = null;
  let commentModal = null;
  let pendingReplaceId = "";
  let pendingAddGroupId = "";
  let pendingCommentIdx = null;
  let pendingCommentField = "";
  let restModalManualEnabled = false;

  let routineListManuallyExpanded = false;
  let routineListAutoToggle = false;
  const collapsedGroups = new Set();

  const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  const closeOpenModals = () => {
    document.querySelectorAll(".modal.show").forEach((modalEl) => {
      const instance = bootstrap.Modal.getInstance(modalEl);
      if (instance) {
        instance.hide();
      } else {
        modalEl.classList.remove("show");
      }
    });
  };

  const normalizeGroupName = (value) => {
    return (value || "").trim().toLowerCase();
  };

  const isGroupNameTaken = (name, excludeId) => {
    const target = normalizeGroupName(name);
    if (!target) return false;
    return state.routine.items.some((item) => {
      if (item.item_type !== "group") return false;
      if (excludeId && item._id === excludeId) return false;
      return normalizeGroupName(item.group_name) === target;
    });
  };

  const showMessage = (text, tone) => {
    const modalEl = document.getElementById("guidedAlertModal");
    const titleEl = document.getElementById("guidedAlertTitle");
    const bodyEl = document.getElementById("guidedAlertBody");
    const footerEl = document.getElementById("guidedAlertFooter");
    const confirmBtn = document.getElementById("guidedAlertConfirm");
    const cancelBtn = document.getElementById("guidedAlertCancel");
    if (!modalEl || !titleEl || !bodyEl || !footerEl) return;
    const titleMap = {
      success: "Listo",
      warning: "Atencion",
      danger: "Error",
      info: "Aviso",
    };
    titleEl.textContent = titleMap[tone] || "Aviso";
    bodyEl.textContent = text || "";
    if (confirmBtn) confirmBtn.style.display = "none";
    if (cancelBtn) cancelBtn.textContent = "Cerrar";
    if (footerEl) footerEl.style.justifyContent = "flex-end";
    if (!alertModal) alertModal = new bootstrap.Modal(modalEl);
    modalEl.addEventListener("hidden.bs.modal", () => {
      closeOpenModals();
    }, { once: true });
    alertModal.show();
  };

  const clearMessage = () => {
    const modalEl = document.getElementById("guidedAlertModal");
    if (modalEl && alertModal) {
      alertModal.hide();
    }
  };

  const confirmRemove = (message) => {
    const modalEl = document.getElementById("guidedAlertModal");
    const titleEl = document.getElementById("guidedAlertTitle");
    const bodyEl = document.getElementById("guidedAlertBody");
    const footerEl = document.getElementById("guidedAlertFooter");
    const confirmBtn = document.getElementById("guidedAlertConfirm");
    const cancelBtn = document.getElementById("guidedAlertCancel");
    if (!modalEl || !titleEl || !bodyEl || !confirmBtn) {
      return Promise.resolve(window.confirm(message || "Confirmar eliminacion?"));
    }
    titleEl.textContent = "Confirmar";
    bodyEl.textContent = message || "Confirmar eliminacion?";
    if (confirmBtn) {
      confirmBtn.style.display = "inline-block";
      confirmBtn.textContent = "Confirmar";
    }
    if (cancelBtn) cancelBtn.textContent = "Cancelar";
    if (footerEl) footerEl.style.justifyContent = "space-between";
    if (!alertModal) alertModal = new bootstrap.Modal(modalEl);

    return new Promise((resolve) => {
      const onConfirm = () => {
        alertModal.hide();
        resolve(true);
      };
      const onCancel = () => {
        resolve(false);
      };
      confirmBtn.onclick = onConfirm;
      if (cancelBtn) cancelBtn.onclick = onCancel;
      modalEl.addEventListener("hidden.bs.modal", () => resolve(false), { once: true });
      alertModal.show();
    });
  };

  const getMoveItemLabel = (item) => {
    if (!item) return "Elemento";
    if (item.item_type === "group") return `Grupo: ${item.group_name || "Grupo"}`;
    if (item.item_type === "rest") return "Pausa";
    if (item.item_type === "exercise") return `Ejercicio: ${item.exercise_name || "Ejercicio"}`;
    return "Elemento";
  };

  const showConfirmMoveModal = (title, message) => {
    if (!document.getElementById("guidedMoveConfirmModal")) {
      return Promise.resolve(window.confirm(message || title || "Confirmar movimiento"));
    }
    const modalEl = document.getElementById("guidedMoveConfirmModal");
    const titleEl = document.getElementById("guidedMoveConfirmTitle");
    const bodyEl = document.getElementById("guidedMoveConfirmBody");
    const cancelBtn = document.getElementById("guidedMoveConfirmCancel");
    const okBtn = document.getElementById("guidedMoveConfirmOk");
    if (!modalEl || !titleEl || !bodyEl || !okBtn) {
      return Promise.resolve(window.confirm(message || title || "Confirmar movimiento"));
    }
    titleEl.textContent = title || "Confirmar movimiento";
    bodyEl.textContent = message || "";
    if (!confirmMoveModal) {
      confirmMoveModal = new bootstrap.Modal(modalEl);
    }
    return new Promise((resolve) => {
      const onConfirm = () => {
        confirmMoveModal.hide();
        resolve(true);
      };
      const onCancel = () => {
        resolve(false);
      };
      okBtn.onclick = onConfirm;
      if (cancelBtn) cancelBtn.onclick = onCancel;
      modalEl.addEventListener("hidden.bs.modal", () => resolve(false), { once: true });
      confirmMoveModal.show();
    });
  };

  const setStep = (step) => {
    state.step = step;
    document.querySelectorAll(".guided-step-section").forEach((section) => {
      section.style.display = "none";
    });
    const active = document.getElementById(`guidedStep${step}`);
    if (active) active.style.display = "block";

    document.querySelectorAll(".step-chip").forEach((chip) => {
      chip.classList.toggle("active", Number(chip.dataset.step) === step);
    });

    const progress = document.getElementById("guidedProgressBar");
    if (progress) progress.style.width = `${Math.round((step / 3) * 100)}%`;

    const prevBtn = document.getElementById("guidedPrevBtn");
    const nextBtn = document.getElementById("guidedNextBtn");
    const saveBtn = document.getElementById("guidedSaveBtn");
    if (prevBtn) prevBtn.disabled = step === 1;
    if (state.isEditingFlow) {
      if (nextBtn) nextBtn.style.display = step === 3 ? "none" : "inline-block";
      if (saveBtn) saveBtn.style.display = "inline-block";
    } else {
      if (nextBtn) nextBtn.style.display = step === 3 ? "none" : "inline-block";
      if (saveBtn) saveBtn.style.display = step === 3 ? "inline-block" : "none";
    }
    updateHelpText();
  };

  const updateHelpText = () => {
    const el = document.getElementById("guidedHelp");
    if (!el) return;
    const map = {
      1: "Busca una rutina existente o comienza desde cero.",
      2: "Organiza grupos y ajusta orden, descansos y comentarios.",
      3: "Revisa el resumen visual antes de guardar.",
    };
    el.textContent = map[state.step] || "";
    updateProgressModal();
  };

  const renderBodyParts = () => {
    const container = document.getElementById("guidedBodyParts");
    if (!container) return;
    container.innerHTML = "";
    state.bodyParts.forEach((part) => {
      const key = part.key || part.label || "";
      if (!key) return;
      const label = part.label_es || part.label_en || part.label || key;
      const wrapper = document.createElement("div");
      wrapper.className = "form-check form-check-inline";
      wrapper.innerHTML = `
        <input class="form-check-input guided-bodypart" type="checkbox" id="bp_${key}" value="${key}">
        <label class="form-check-label text-secondary small" for="bp_${key}">${label}</label>
      `;
      container.appendChild(wrapper);
    });
  };

  const getRoutineDisplayName = (routine) => {
    return routine?.name || routine?.routine_name || routine?.title || routine?.routine_title || "Rutina";
  };

  const renderRoutineList = () => {
    const list = document.getElementById("guidedRoutineList");
    const termRaw = document.getElementById("guidedRoutineSearch")?.value || "";
    const term = termRaw.toLowerCase();
    const hasTerm = termRaw.trim().length > 0;
    const collapseEl = document.getElementById("guidedRoutineCollapse");
    if (!list) return;
    const filtered = state.routines.filter((r) => {
      const name = getRoutineDisplayName(r).toLowerCase();
      return !term || name.includes(term);
    });
    const collapseInstance = collapseEl ? bootstrap.Collapse.getOrCreateInstance(collapseEl, { toggle: false }) : null;

    if (!filtered.length) {
      list.innerHTML = '<div class="p-3 text-secondary small">Sin resultados.</div>';
      if (collapseInstance && !routineListManuallyExpanded) {
        routineListAutoToggle = true;
        collapseInstance.hide();
      }
      return;
    }

    if (collapseInstance) {
      const shouldShow = hasTerm || routineListManuallyExpanded;
      routineListAutoToggle = true;
      if (shouldShow) {
        collapseInstance.show();
      } else {
        collapseInstance.hide();
      }
    }

    list.innerHTML = filtered
      .map((r) => {
        const isAi = r.source === "ai";
        const badge = isAi ? "AI Generated" : (r.is_active === false ? "Inactiva" : "Activa");
        const badgeClass = isAi ? "bg-warning text-dark" : (r.is_active === false ? "bg-secondary" : "bg-success");
        return `
          <div class="guided-config-card mb-2">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="text-white fw-bold">${getRoutineDisplayName(r)}</div>
                <div class="text-secondary small">${r.description || ""}</div>
              </div>
              <span class="badge ${badgeClass} text-dark">${badge}</span>
            </div>
            <div class="guided-inline-actions mt-2">
              ${isAi ? "" : `<button class="btn btn-sm btn-outline-info" data-load="${r._id}">Cargar</button>`}
              <button class="btn btn-sm btn-outline-secondary" data-dup="${r._id}">Duplicar</button>
            </div>
          </div>
        `;
      })
      .join("");
  };
  const getGroupOptions = () => {
    return state.routine.items.filter((item) => item.item_type === "group");
  };

  const renderGroupOptions = (selectedId) => {
    const groups = getGroupOptions();
    const opts = ['<option value="">Sin grupo</option>'];
    groups.forEach((g) => {
      const name = g.group_name || "Grupo";
      opts.push(`<option value="${g._id}" ${selectedId === g._id ? "selected" : ""}>${name}</option>`);
    });
    return opts.join("");
  };

  const renderExerciseList = () => {
    const list = document.getElementById("guidedExerciseList");
    if (!list) return;
    const exercises = state.routine.items.filter((item) => item.item_type === "exercise");
    if (!exercises.length) {
      list.innerHTML = '<div class="p-3 text-secondary small">No hay ejercicios agregados.</div>';
      return;
    }
    list.innerHTML = exercises
      .map((item, idx) => `
        <div class="guided-ex-item">
          <div>
            <div class="text-white fw-bold">${item.exercise_name || "Ejercicio"}</div>
            <div class="text-secondary small">${item.body_part || "General"}</div>
          </div>
          <div class="guided-inline-actions">
            <button class="btn btn-sm btn-outline-info" data-replace="${item._id}">Reemplazar</button>
            <button class="btn btn-sm btn-outline-danger" data-remove-ex="${idx}"><i class="fas fa-times"></i></button>
          </div>
        </div>
      `)
      .join("");
  };

  const addExercise = (exercise, groupId) => {
    if (!exercise) return;
    const exists = state.routine.items.some((item) => String(item.exercise_id) === String(exercise._id || exercise.id));
    if (exists && !pendingReplaceId) return;

    if (pendingReplaceId) {
      const idx = state.routine.items.findIndex((item) => item._id === pendingReplaceId);
      if (idx >= 0) {
        const existing = state.routine.items[idx];
        const exerciseType = exercise.type || "weight";
        const timeBased = isTimeBasedExercise(exerciseType);
        state.routine.items[idx] = {
          ...existing,
          exercise_id: exercise._id || exercise.id,
          exercise_name: exercise.name || "Ejercicio",
          exercise_type: exerciseType,
          equipment: exercise.equipment || "",
          body_part: exercise.body_part || "",
          video_url: exercise.video_url || "",
          substitutes: Array.isArray(exercise.substitutes) ? exercise.substitutes : [],
          target_time_seconds: timeBased ? (existing.target_time_seconds || 600) : 0,
          target_reps: timeBased ? 0 : (existing.target_reps || "8-12"),
          manual_rest_enabled: existing.manual_rest_enabled !== false,
        };
        normalizeItemTargets(state.routine.items[idx]);
      }
      pendingReplaceId = "";
    } else {
      let inheritedSets = 3;
      if (groupId) {
        const groupExercise = state.routine.items.find((item) => item.item_type === "exercise" && item.group_id === groupId);
        if (groupExercise && groupExercise.target_sets != null) {
          inheritedSets = Number(groupExercise.target_sets) || 3;
        }
      }
      const exerciseType = exercise.type || "weight";
      const timeBased = isTimeBasedExercise(exerciseType);
      state.routine.items.push({
        item_type: "exercise",
        _id: makeId("ex"),
        exercise_id: exercise._id || exercise.id,
        exercise_name: exercise.name || "Ejercicio",
        exercise_type: exerciseType,
        equipment: exercise.equipment || "",
        body_part: exercise.body_part || "",
        video_url: exercise.video_url || "",
        substitutes: Array.isArray(exercise.substitutes) ? exercise.substitutes : [],
        target_sets: inheritedSets,
        target_reps: timeBased ? 0 : "8-12",
        rest_seconds: 60,
        target_time_seconds: timeBased ? 600 : 0,
        group_id: groupId || "",
        comment: "",
        manual_rest_enabled: true,
      });
    }

    updateSummary();
    renderExerciseList();
    renderConfigList();
  };

  const addGroup = (name, type, note) => {
    state.routine.items.push({
      item_type: "group",
      _id: makeId("group"),
      group_name: name,
      group_type: type || "biserie",
      note: note || "",
    });
    renderConfigList();
  };

  const addRest = (groupId, seconds, note) => {
    const restValue = Math.max(1, Math.min(1800, Number(seconds) || 60));
    state.routine.items.push({
      item_type: "rest",
      _id: makeId("rest"),
      rest_seconds: restValue,
      note: note || "Descanso",
      group_id: groupId || "",
      manual_rest_enabled: true,
    });
    renderConfigList();
  };

  const moveGroupBlock = (groupId, dir) => {
    const items = state.routine.items;
    const groupIndices = items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item._id === groupId || item.group_id === groupId)
      .map(({ idx }) => idx)
      .sort((a, b) => a - b);
    if (!groupIndices.length) return;

    const groups = items.filter((item) => item.item_type === "group");
    const currentGroupIndex = groups.findIndex((g) => g._id === groupId);
    const targetGroupIndex = currentGroupIndex + dir;
    if (currentGroupIndex < 0 || targetGroupIndex < 0 || targetGroupIndex >= groups.length) return;

    const targetGroupId = groups[targetGroupIndex]._id;
    const targetIndices = items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item._id === targetGroupId || item.group_id === targetGroupId)
      .map(({ idx }) => idx)
      .sort((a, b) => a - b);

    const block = groupIndices.map((i) => items[i]);
    const remaining = items.filter((_, idx) => !groupIndices.includes(idx));

    const insertAt = dir < 0 ? Math.min(...targetIndices) : Math.max(...targetIndices) + 1;
    remaining.splice(insertAt, 0, ...block);
    state.routine.items = remaining;
    renderConfigList();
  };

  const moveWithinGroup = (itemId, dir) => {
    const items = state.routine.items;
    const idx = items.findIndex((item) => item._id === itemId);
    if (idx < 0) return;
    const groupId = items[idx].group_id || "";
    const sameGroupIndices = items
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => (item.group_id || "") === groupId && item.item_type !== "group")
      .map(({ i }) => i);
    const currentPos = sameGroupIndices.indexOf(idx);
    const targetPos = currentPos + dir;
    if (targetPos < 0 || targetPos >= sameGroupIndices.length) return;
    const swapIdx = sameGroupIndices[targetPos];
    [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
    renderConfigList();
  };

  const moveUngrouped = (itemId, dir) => {
    const items = state.routine.items;
    const idx = items.findIndex((item) => item._id === itemId);
    if (idx < 0) return;
    const ungroupedIndices = items
      .map((item, i) => ({ item, i }))
      .filter(({ item }) => !item.group_id && item.item_type !== "group")
      .map(({ i }) => i);
    const pos = ungroupedIndices.indexOf(idx);
    const target = pos + dir;
    if (target < 0 || target >= ungroupedIndices.length) return;
    const swapIdx = ungroupedIndices[target];
    [items[idx], items[swapIdx]] = [items[swapIdx], items[idx]];
    renderConfigList();
  };

  const removeGroup = (groupId) => {
    state.routine.items = state.routine.items.filter((item) => item._id !== groupId && item.group_id !== groupId);
  };

  const isExactRepsValue = (value) => {
    return value !== null && value !== undefined && /^\d+$/.test(String(value));
  };

  const isTimeBasedExercise = (type) => {
    const normalized = String(type || "").trim().toLowerCase();
    return normalized === "cardio" || normalized === "time";
  };

  const normalizeItemTargets = (item) => {
    if (!item || item.item_type !== "exercise") return item;
    if (isTimeBasedExercise(item.exercise_type)) {
      item.target_reps = 0;
      if (!item.target_time_seconds) item.target_time_seconds = 600;
    } else {
      item.target_time_seconds = 0;
      if (!item.target_reps || Number(item.target_reps) === 0) item.target_reps = "8-12";
    }
    return item;
  };

  const getRepsSelectValue = (value) => {
    return isExactRepsValue(value) ? "Reps fijas" : (value || "8-12");
  };

  const getExactRepsValue = (value) => {
    return isExactRepsValue(value) ? value : "";
  };
  const renderConfigList = () => {
    const list = document.getElementById("guidedConfigList");
    if (!list) return;
    if (!state.routine.items.length) {
      list.innerHTML = '<div class="text-secondary small">No hay ejercicios seleccionados.</div>';
      return;
    }

    const groupItemsMap = new Map();
    state.routine.items.forEach((item, idx) => {
      if (item.item_type === "group") return;
      if (!item.group_id) return;
      if (!groupItemsMap.has(item.group_id)) groupItemsMap.set(item.group_id, []);
      groupItemsMap.get(item.group_id).push({ item, idx });
    });

    const renderExerciseCard = (item, idx) => {
      const isTime = isTimeBasedExercise(item.exercise_type || item.type);
      const manualTimeEnabled = Boolean(item.manual_time_enabled);
      const manualRestEnabled = item.manual_rest_enabled !== false;
      const currentSeconds = Number(item.target_time_seconds) || 600;
      const currentMinutes = Math.max(1, Math.round(currentSeconds / 60));
      return `
          <div class="guided-config-card">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <div class="text-white fw-bold">${item.exercise_name || "Ejercicio"}</div>
            <div class="guided-inline-actions">
              <button class="btn btn-sm btn-outline-info" data-replace="${item._id}">Reemplazar</button>
              <button class="btn btn-sm btn-outline-secondary" data-move-item="${item._id}" data-dir="-1"><i class="fas fa-arrow-up"></i></button>
              <button class="btn btn-sm btn-outline-secondary" data-move-item="${item._id}" data-dir="1"><i class="fas fa-arrow-down"></i></button>
              <button class="btn btn-sm btn-outline-danger" data-remove="${idx}"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="row g-2">
              <div class="col-4 guided-field-series">
                <label class="text-secondary small">Series</label>
                <select class="form-select form-select-sm bg-dark text-white border-secondary guided-compact-select" data-field="target_sets" data-idx="${idx}">
                  ${SETS_OPTIONS.map((opt) => `<option value="${opt}" ${Number(item.target_sets) === opt ? "selected" : ""}>${opt}</option>`).join("")}
                </select>
              </div>
              <div class="col-4 guided-field-reps">
                <label class="text-secondary small">${isTime ? "Tiempo" : "Reps"}</label>
                ${isTime
          ? `<div class="d-flex align-items-center gap-2">
                        ${!manualTimeEnabled ? `
                          <select class="form-select form-select-sm bg-dark text-white border-secondary" data-field="target_time_seconds" data-idx="${idx}">
                            ${TIME_OPTIONS.map((opt) => `<option value="${opt}" ${Number(item.target_time_seconds) === opt ? "selected" : ""}>${Math.round(opt / 60)} min</option>`).join("")}
                          </select>
                        ` : `
                          <div class="input-group input-group-sm">
                            <span class="input-group-text bg-dark text-white border-secondary">min</span>
                            <input type="number" min="1" inputmode="numeric" pattern="[0-9]*" class="form-control bg-dark text-white border-secondary" data-field="target_time_minutes" data-idx="${idx}" value="${currentMinutes}" onfocus="this.select()">
                          </div>
                        `}
                        <button class="btn btn-sm ${manualTimeEnabled ? "btn-info text-dark" : "btn-outline-secondary"}" data-toggle-time-input="${idx}" title="Editar minutos">
                          <i class="fas fa-pen"></i>
                        </button>
                      </div>`
          : `<select class="form-select form-select-sm bg-dark text-white border-secondary guided-compact-select" data-field="target_reps" data-idx="${idx}">
                        ${REPS_OPTIONS.map((opt) => `<option value="${opt}" ${getRepsSelectValue(item.target_reps) === opt ? "selected" : ""}>${opt}</option>`).join("")}
                      </select>
                      <input type="number" min="1" class="form-control form-control-sm bg-dark text-white border-secondary mt-1" data-field="target_reps_exact" data-idx="${idx}" placeholder="Reps fijas" value="${getExactRepsValue(item.target_reps)}" style="display: ${isExactRepsValue(item.target_reps) ? 'block' : 'none'};" ${isExactRepsValue(item.target_reps) ? '' : 'disabled'}>`
        }
              </div>
              <div class="col-4 guided-field-rest">
                <label class="text-secondary small">Descanso</label>
                <div class="d-flex align-items-center gap-2">
                  ${!manualRestEnabled ? `
                    <select class="form-select form-select-sm bg-dark text-white border-secondary" data-field="rest_seconds" data-idx="${idx}">
                      ${REST_OPTIONS.map((opt) => `<option value="${opt}" ${Number(item.rest_seconds) === opt ? "selected" : ""}>${opt}s</option>`).join("")}
                    </select>
                  ` : `
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-dark text-white border-secondary">seg</span>
                      <input type="number" min="1" max="1800" inputmode="numeric" pattern="[0-9]*" class="form-control bg-dark text-white border-secondary" data-field="rest_seconds_manual" data-idx="${idx}" value="${Number(item.rest_seconds) || 60}" onfocus="this.select()">
                    </div>
                  `}
                  <button class="btn btn-sm ${manualRestEnabled ? "btn-info text-dark" : "btn-outline-secondary"}" data-toggle-rest-input="${idx}" title="Editar descanso">
                    <i class="fas fa-pen"></i>
                  </button>
                </div>
              </div>
              <div class="col-6 guided-field-group">
                <label class="text-secondary small">Grupo</label>
                <select class="form-select form-select-sm bg-dark text-white border-secondary" data-field="group_id" data-idx="${idx}">
                  ${renderGroupOptions(item.group_id)}
                </select>
              </div>
              <div class="col-6 guided-field-comment">
                <label class="text-secondary small">Comentario</label>
                <input class="form-control form-control-sm bg-dark text-white border-secondary" data-field="comment" data-idx="${idx}" data-comment-edit="comment" readonly value="${item.comment || ""}">
              </div>
          </div>
        </div>
      `;
    };

    const renderEmptyGroupState = (groupId) => {
      return `
            <div class="text-secondary small d-flex flex-column align-items-center justify-content-center py-3">
                <div class="mb-2">No hay ejercicios en este grupo.</div>
                <button class="btn btn-sm btn-outline-info" onclick="document.dispatchEvent(new CustomEvent('guided-add-to-group', {detail: '${groupId}'}))">
                    <i class="fas fa-plus me-1"></i> Agregar ejercicio
                </button>
            </div>
        `;
    };

    const renderRestCard = (item, idx) => {
      const manualRestEnabled = item.manual_rest_enabled !== false;
      return `
        <div class="guided-config-card">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="text-warning fw-bold">Pausa</div>
            <div class="guided-inline-actions">
              <button class="btn btn-sm btn-outline-secondary" data-move-item="${item._id}" data-dir="-1"><i class="fas fa-arrow-up"></i></button>
              <button class="btn btn-sm btn-outline-secondary" data-move-item="${item._id}" data-dir="1"><i class="fas fa-arrow-down"></i></button>
              <button class="btn btn-sm btn-outline-danger" data-remove="${idx}"><i class="fas fa-times"></i></button>
            </div>
            </div>
            <div class="row g-2">
              <div class="col-6">
                <label class="text-secondary small">Tiempo</label>
                <div class="d-flex align-items-center gap-2">
                  ${!manualRestEnabled ? `
                    <select class="form-select form-select-sm bg-dark text-white border-secondary" data-field="rest_seconds" data-idx="${idx}">
                      ${REST_OPTIONS.map((opt) => `<option value="${opt}" ${Number(item.rest_seconds) === opt ? "selected" : ""}>${opt}s</option>`).join("")}
                    </select>
                  ` : `
                    <div class="input-group input-group-sm">
                      <span class="input-group-text bg-dark text-white border-secondary">seg</span>
                      <input type="number" min="1" max="1800" inputmode="numeric" pattern="[0-9]*" class="form-control bg-dark text-white border-secondary" data-field="rest_seconds_manual" data-idx="${idx}" value="${Number(item.rest_seconds) || 60}" onfocus="this.select()">
                    </div>
                  `}
                  <button class="btn btn-sm ${manualRestEnabled ? "btn-info text-dark" : "btn-outline-secondary"}" data-toggle-rest-input="${idx}" title="Editar descanso">
                    <i class="fas fa-pen"></i>
                  </button>
                </div>
              </div>
              <div class="col-6">
                <label class="text-secondary small">Grupo</label>
                <select class="form-select form-select-sm bg-dark text-white border-secondary" data-field="group_id" data-idx="${idx}">
                  ${renderGroupOptions(item.group_id)}
                </select>
              </div>
              <div class="col-12">
                <label class="text-secondary small">Nota</label>
                <input class="form-control form-control-sm bg-dark text-white border-secondary" data-field="note" data-idx="${idx}" data-comment-edit="note" readonly value="${item.note || ""}">
              </div>
            </div>
          </div>
      `;
    };

    const renderGroupBlock = (group, entries, groupIndex) => {
      const isCollapsed = collapsedGroups.has(group._id);
      const body = entries
        .sort((a, b) => a.idx - b.idx)
        .map(({ item, idx }) => {
          if (item.item_type === "rest") return renderRestCard(item, idx);
          return renderExerciseCard(item, idx);
        })
        .join("");

      return `
        <div class="guided-block" data-group-id="${group._id}">
          <div class="guided-block-header mb-3">
            <div class="guided-handle cursor-grab d-flex align-items-center">
              <i class="fas fa-grip-lines text-secondary me-2"></i>
              <button class="btn btn-sm btn-link text-decoration-none p-0 me-2 text-white" onclick="document.dispatchEvent(new CustomEvent('guided-toggle-group', {detail: '${group._id}'}))">
                  <i class="fas fa-chevron-${isCollapsed ? 'down' : 'up'}"></i>
              </button>
              <span class="text-info fw-bold">Grupo</span>
              <span class="text-secondary small ms-2">${group.group_type || "biserie"} ${group.note ? "- " + group.note : ""}</span>
            </div>
            <div class="guided-inline-actions">
              <button class="btn btn-sm btn-outline-danger" data-remove-group="${group._id}"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="${isCollapsed ? 'd-none' : ''}">
              <div class="row g-2 mb-3">
                <div class="col-12">
                  <label class="text-secondary small">Nombre del grupo</label>
                  <input class="form-control form-control-sm bg-dark text-white border-secondary" data-field="group_name" data-idx="${groupIndex}" value="${group.group_name || ""}">
                  <div class="text-danger small mt-1" data-group-error="${group._id}" style="display:none;"></div>
                </div>
                <div class="col-12">
                  <label class="text-secondary small">Nota</label>
                  <input class="form-control form-control-sm bg-dark text-white border-secondary" data-field="note" data-idx="${groupIndex}" data-comment-edit="note" readonly value="${group.note || ""}">
                </div>
              </div>
              <div class="guided-group-items sortable-group" data-group-id="${group._id}">
                ${body || renderEmptyGroupState(group._id)}
              </div>
          </div>
        </div>
      `;
    };

    const htmlParts = [];
    const renderedGroupIds = new Set();
    let ungroupedOpen = false;

    const openUngrouped = () => {
      if (ungroupedOpen) return;
      htmlParts.push(
        `<div class="guided-block" data-group-id="">
           <div class="guided-block-header mb-3">
             <div class="text-white fw-bold">Sin grupo</div>
             <div class="guided-inline-actions"></div>
           </div>
           <div class="guided-group-items sortable-group" data-group-id="">`
      );
      ungroupedOpen = true;
    };

    const closeUngrouped = () => {
      if (!ungroupedOpen) return;
      htmlParts.push("</div></div>");
      ungroupedOpen = false;
    };

    state.routine.items.forEach((item, idx) => {
      if (item.item_type === "group") {
        closeUngrouped();
        renderedGroupIds.add(item._id);
        htmlParts.push(renderGroupBlock(item, groupItemsMap.get(item._id) || [], idx));
        return;
      }

      if (item.group_id) {
        if (!renderedGroupIds.has(item.group_id)) {
          return;
        }
        return;
      }

      openUngrouped();
      if (item.item_type === "rest") {
        htmlParts.push(renderRestCard(item, idx));
        return;
      }
      htmlParts.push(renderExerciseCard(item, idx));
    });

    closeUngrouped();
    list.innerHTML = htmlParts.join("") || '<div class="text-secondary small">No hay ejercicios seleccionados.</div>';

    const restGroupSelect = document.getElementById("guidedRestGroup");
    if (restGroupSelect) {
      restGroupSelect.innerHTML = '<option value="">Sin grupo</option>' + getGroupOptions()
        .map((g) => `<option value="${g._id}">${g.group_name || "Grupo"}</option>`)
        .join("");
    }

    // Initialize Sortable
    initSortable();
  };

  let mainSortable = null;
  let innerSortables = [];

  const initSortable = () => {
    const list = document.getElementById("guidedConfigList");
    if (!list) return;

    // Cleanup old instances
    if (mainSortable) {
      mainSortable.destroy();
      mainSortable = null;
    }
    innerSortables.forEach(s => s.destroy());
    innerSortables = [];

    // Main list (Groups and Ungrouped items blocks)
    mainSortable = Sortable.create(list, {
      animation: 150,
      handle: '.guided-block-header',
      draggable: '.guided-block',
      onEnd: (evt) => {
        // Now valid to reorder groups
        reconstructStateFromDOM();
      }
    });

    // Inner lists (Items within groups or ungrouped block)
    document.querySelectorAll('.guided-group-items').forEach(el => {
      const s = Sortable.create(el, {
        group: 'shared-items', // Allow dragging between any of these lists
        animation: 150,
        handle: '.guided-config-card',
        onEnd: (evt) => {
          // Only reconstruct if the item was dropped here (to avoid double processing if moved between lists)
          // Actually, the event fires on the 'from' list too? 
          // Sortable 'onEnd' is fired when drag ends. 
          // Ideally we just check state from DOM once.
          reconstructStateFromDOM();
        }
      });
      innerSortables.push(s);
    });
  };

  const reconstructStateFromDOM = () => {
    // 1. Map existing items for quick lookup
    const itemMap = new Map();
    state.routine.items.forEach(item => itemMap.set(item._id, item));

    const newItems = [];
    const root = document.getElementById("guidedConfigList");
    if (!root) return;

    // 2. Iterate through DOM structure
    // The structure is: 
    // #guidedConfigList -> Children are either .guided-block (Groups) or direct .guided-config-card (Ungrouped items in simplified view, 
    // though current render wraps ungrouped in .guided-block too via 'openUngrouped').

    // Actually, looking at renderConfigList:
    // It pushes `renderGroupBlock` OR `renderExerciseCard`/`renderRestCard`.
    // But `renderGroupBlock` returns a div.guided-block.
    // Ungrouped items are wrapped in a div.guided-block too (see lines 721, 747).
    // Specifically: `<div class="guided-block"><div class="guided-block-header ...">Sin grupo</div>...`

    // So we iterate over .guided-block elements.
    root.querySelectorAll(":scope > .guided-block").forEach(blockEl => {
      const groupId = blockEl.dataset.groupId || ""; // Empty if ungrouped block

      // Inside each block, we have .guided-group-items (for valid groups) OR just inline items?
      // Let's check renderGroupBlock (lines 669+): it has .guided-group-items.
      // What about ungrouped?
      // openUngrouped just pushes strict HTML string. It ends with closeUngrouped().
      // It DOES NOT have a .guided-group-items container in the current openUngrouped implementation. 
      // Wait, line 721: `<div class="guided-block"><div class="guided-block-header...` 
      // Then items are pushed directly. Then </div>.
      // So for "Ungrouped" blocks, the items are direct children of .guided-block (after header).
      // For "Group" blocks, items are in .guided-group-items.

      // This inconsistency makes dragging between them harder if Sortable expects same container class.
      // BUT, initSortable (line 791) targets `.guided-group-items`.
      // This implies Ungrouped items are NOT sortable via that second Sortable instance?
      // Re-reading render code...
      // Ungrouped items are rendered directly into `htmlParts`. Not inside a `.guided-group-items` div.
      // This means Drag & Drop MIGHT NOT WORK correctly for Ungrouped items currently if they are targets of the 'shared-items' group.

      // Fix: We must treat the container of items uniformly.
      // However, assuming the user is dragging WITHIN groups or BETWEEN groups that have .guided-group-items.
      // If the user drags to "Ungrouped", we need to support that.
      // Let's first support what IS sortable: `.guided-group-items`.
      // Inspecting blockEl:

      const container = blockEl.querySelector(".guided-group-items");
      if (container) {
        // Valid Group
        container.querySelectorAll(".guided-config-card").forEach(card => {
          const itemIdx = Number(card.querySelector("[data-idx]")?.dataset.idx);
          // We can't rely on idx because it's stale. We need item ID.
          // We should add data-item-id to the card render.
          // Currently renderExerciseCard uses `item._id` in buttons (data-replace, data-move-item).
          // Use that.

          const itemId = card.querySelector("[data-move-item]")?.dataset.moveItem
            || card.querySelector("[data-replace]")?.dataset.replace
            || card.querySelector("[data-idx]")?.dataset.idx; // Fallback to idx if id not found on button

          // Ideally we find by ID.
          let item = null;
          if (itemMap.has(itemId)) {
            item = itemMap.get(itemId);
          } else {
            // Try to recover by index if ID check fails (legacy)
            const idxVal = Number(itemId); // if it was an index
            if (!isNaN(idxVal) && state.routine.items[idxVal] && state.routine.items[idxVal]._id === itemId) {
              item = state.routine.items[idxVal];
            }
            // If still not found, search map values? No, ID should match.
            // The issue is renderRestCard might not have the same data attributes.
            // renderRestCard uses `data-move-item="${item._id}"`. So it should work.
          }

          if (item) {
            item.group_id = groupId; // Update group
            newItems.push(item);
          }
        });
      } else {
        // This is likely an Ungrouped block.
        // The items are direct children `.guided-config-card`.
        // But wait, initSortable ONLY targets `.guided-group-items`.
        // So Ungrouped items ARE NOT SORTABLE currently?
        // If so, we only ignore them or just append them as is?
        // NO, if we rebuild state, we MUST include them or they will be DELETED.

        // If we can't sort them, they stay in original order relative to each other?
        // We should find them and add them.
        // Refactor implication: Ungrouped items need to be in a sortable container too if we want full DnD.
        // For now, let's just collect them to prevent data loss.

        blockEl.querySelectorAll(".guided-config-card").forEach(card => {
          // Logic same as above to find item
          const itemId = card.querySelector("[data-move-item]")?.dataset.moveItem;
          if (itemId && itemMap.has(itemId)) {
            const item = itemMap.get(itemId);
            item.group_id = ""; // Ensure ungrouped
            newItems.push(item);
          }
        });
      }
    });

    // 3. Re-append Groups themselves?
    // state.routine.items is a flat list including Group Objects and Item Objects.
    // We parsed the DOM which contains Items inside Groups.
    // We ALSO need to preserve the Group Objects themselves in `newItems` at the correct positions.
    // The DOM has `.guided-block` for each group. 
    // We should push the GROUP OBJECT when we encounter the block, THEN its items.

    // Reset newItems
    const finalItems = [];

    root.querySelectorAll(":scope > .guided-block").forEach(blockEl => {
      const groupId = blockEl.dataset.groupId;

      if (groupId) {
        // Find the group object
        const groupObj = itemMap.get(groupId);
        if (groupObj) {
          finalItems.push(groupObj);
        }
      }

      // Now items inside
      const container = blockEl.querySelector(".guided-group-items") || blockEl;
      // Fallback to blockEl for ungrouped which are direct children

      container.querySelectorAll(":scope > .guided-config-card").forEach(card => {
        const itemId = card.querySelector("[data-move-item]")?.dataset.moveItem;
        if (itemId && itemMap.has(itemId)) {
          const item = itemMap.get(itemId);
          // If it's a rest or exercise (not a group obj, which we handled above)
          if (item.item_type !== 'group') {
            item.group_id = groupId || "";
            finalItems.push(item);
          }
        }
      });
    });

    // Update state
    state.routine.items = finalItems;

    // Note: We might want to force a re-render of indices/combos without full DOM wipe
    // to reflect changes, OR just let it act as "saved".
    // For now, simple state update. A full renderConfigList() might be jarring/break drag if called during drag (onEnd).
    // Usually onEnd is safe to re-render or just leave it. 
    // Updating visual combos (lines 523 map) happens on render.
    // So for the "Combo" to update visually, we DO need to re-render or hacking the DOM.
    // Let's call renderConfigList() to ensure consistency.
    renderConfigList();
  };

  // Listen for exercise selection from iframe
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "exercise_selected") {
      const exercise = event.data.data;
      if (exercise) {
        // If we have a pending group add
        if (typeof pendingAddGroupId !== 'undefined' && pendingAddGroupId) {
          addExercise(exercise, pendingAddGroupId);
          pendingAddGroupId = ""; // clear
          closeOpenModals();
          showMessage("Ejercicio agregado al grupo", "success");
        } else {
          // Default behavior
          addExercise(exercise, ""); // add as ungrouped initially or prompts?
          // Actually original flow prompts for group.
          // But if we want to skip that prompt for speed?
          // Let's stick to original flow for normal adds.

          // Wait, the original code doesn't show where "addExercise" is called normally. 
          // It seems it was called from `guidedAddExerciseConfirm`.
          // If we want to support the "Add To Empty Group" button, we handled it above.
          // If this event comes from the main "Add Exercise" button (no pending group),
          // we should probably open the Group Selection modal OR add directly if simpler.

          // Let's assume the original flow for non-pending adds:
          // 1. User clicks "Add Exercise" -> Opens Iframe -> Selects -> Message Event
          // 2. We store selection and Open Group Modal (guidedAddExerciseModal)
          // BUT we just called addExercise directly above for pending group.

          if (!state.routine.items.some(i => i.exercise_id === exercise.id) || pendingReplaceId) {
            // If replacing or new
            if (pendingReplaceId) {
              addExercise(exercise);
              closeOpenModals();
            } else {
              // Store temp and open group chooser
              window.tempSelectedExercise = exercise;
              const modalEl = document.getElementById('guidedAddExerciseModal');
              const modal = new bootstrap.Modal(modalEl);
              modal.show();
            }
          }
        }
      }
    }
  });

  window.addEventListener('guided-add-to-group', (e) => {
    const groupId = e.detail;
    document.getElementById('guidedAddExerciseGroup').value = groupId;
    // If we had a direct function to open modal with group pre-set:
    // We need to trigger the "Add Exercise" flow but with group param.
    // Current flow opens exercise modal, then "Add" opens config modal.
    // We can just open the Exercise selection modal directly.
    const frame = document.getElementById('guidedExerciseFrame');
    if (frame && !frame.src) frame.src = '/workout/exercises?mode=select';

    // Temporarily store the intended group
    pendingAddGroupId = groupId; // We need to add this global

    const modalEl = document.getElementById('guidedExerciseModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  });

  const updateSummary = () => {
    const countEl = document.getElementById("guidedSummaryCount");
    if (countEl) countEl.textContent = String(state.routine.items.filter((i) => i.item_type === "exercise").length);
    const groupEl = document.getElementById("guidedSummaryGroup");
    if (groupEl) groupEl.textContent = state.routine.routine_body_parts[0] || "-";
    const activeEl = document.getElementById("guidedSummaryActive");
    if (activeEl) activeEl.textContent = state.routine.is_active ? "Activa" : "Inactiva";
    updateProgressModal();
  };

  const updateProgressModal = () => {
    const countEl = document.getElementById("guidedSummaryCountMobile");
    if (countEl) countEl.textContent = String(state.routine.items.filter((i) => i.item_type === "exercise").length);
    const groupEl = document.getElementById("guidedSummaryGroupMobile");
    if (groupEl) groupEl.textContent = state.routine.routine_body_parts[0] || "-";
    const activeEl = document.getElementById("guidedSummaryActiveMobile");
    if (activeEl) activeEl.textContent = state.routine.is_active ? "Activa" : "Inactiva";
    const helpEl = document.getElementById("guidedHelpMobile");
    if (helpEl) helpEl.textContent = document.getElementById("guidedHelp")?.textContent || "";
    const bar = document.getElementById("guidedProgressBar");
    const barMobile = document.getElementById("guidedProgressBarMobile");
    if (bar && barMobile) barMobile.style.width = bar.style.width || "25%";
  };

  const openProgressModalIfMobile = () => {
    if (window.innerWidth >= 992) return;
    updateProgressModal();
    const modalEl = document.getElementById("guidedProgressModal");
    if (!modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  };

  const setRestModalManual = (enabled) => {
    restModalManualEnabled = enabled;
    const selectEl = document.getElementById("guidedRestSeconds");
    const manualWrap = document.getElementById("guidedRestSecondsManualWrap");
    const manualInput = document.getElementById("guidedRestSecondsManual");
    const toggleBtn = document.getElementById("guidedRestSecondsToggle");
    if (!selectEl || !manualWrap || !manualInput || !toggleBtn) return;

    if (enabled) {
      const currentSeconds = Number(selectEl.value) || 60;
      manualInput.value = String(Math.max(1, Math.min(1800, currentSeconds)));
      selectEl.style.display = "none";
      manualWrap.style.display = "flex";
      toggleBtn.classList.remove("btn-outline-secondary");
      toggleBtn.classList.add("btn-info", "text-dark");
      return;
    }

    manualWrap.style.display = "none";
    selectEl.style.display = "";
    toggleBtn.classList.remove("btn-info", "text-dark");
    toggleBtn.classList.add("btn-outline-secondary");
  };

  const updateReview = () => {
    const list = document.getElementById("guidedReviewList");
    if (!list) return;
    const routine = state.routine;
    const partsLabel = getRoutineBodyPartsLabel(routine);
    const exercises = getExerciseCount(routine);
    const day = routine.routine_day || "-";

    // Use RoutineRenderer
    let previewHtml = '';
    if (typeof RoutineRenderer !== 'undefined') {
      previewHtml = RoutineRenderer.buildPreviewHtml(routine);
    } else {
      previewHtml = '<div class="text-danger p-3">Error: RoutineRenderer not loaded.</div>';
    }

    list.innerHTML = `
      <div class="routine-preview-card" style="background: transparent; border: none; padding: 0;">
        <div class="text-center mb-3">
          <div class="h3 fw-bold text-cyber-green mb-1">${routine.name || "Rutina"}</div>
          <div class="text-secondary">${exercises} ejercicios - Revisa los detalles antes de iniciar</div>
        </div>
        <div class="row g-2 mb-3">
          <div class="col-6">
            <div class="text-secondary small">Grupos</div>
            <div class="text-white">${partsLabel}</div>
          </div>
          <div class="col-6">
            <div class="text-secondary small">Día</div>
            <div class="text-white">${day}</div>
          </div>
          <div class="col-6">
            <div class="text-secondary small">Ejercicios</div>
            <div class="text-white">${exercises}</div>
          </div>
          <div class="col-6">
            <div class="text-secondary small">Estado</div>
            <div class="text-white">${routine.is_active ? "Activa" : "Inactiva"}</div>
          </div>
        </div>
        ${routine.description ? `<div class="text-secondary small mb-3">${routine.description}</div>` : ""}
        <div class="routine-preview-scroll d-flex flex-column gap-2">${previewHtml}</div>
      </div>
    `;
  };

  const translateBodyPart = (bp) => {
    if (!bp) return "N/A";
    const match = state.bodyParts.find((part) => part.key === bp || part.label === bp);
    if (!match) return bp;
    return match.label_es || match.label_en || match.label || bp;
  };

  const getRoutineBodyPartsLabel = (routine) => {
    const parts = Array.isArray(routine.routine_body_parts) ? routine.routine_body_parts : [];
    if (!parts.length) return "N/A";
    return parts.map((p) => translateBodyPart(p)).join(", ");
  };

  const getExerciseCount = (routine) => {
    const items = Array.isArray(routine.items) ? routine.items : [];
    return items.filter((item) => item && item.item_type === "exercise").length;
  };

  // getRestSeconds retained for Step 2 config
  const getRestSeconds = (item) => {
    if (!item) return 60;
    if (item.rest_seconds != null) return item.rest_seconds;
    if (item.rest != null && item.rest !== item.target_time_seconds) return item.rest;
    return 60;
  };

  // getEquipmentMeta retained for Step 2 config
  const getEquipmentMeta = (equipmentKey) => {
    const map = {
      barbell: { label: "Barra", icon: "fas fa-grip-lines" },
      dumbbell: { label: "Mancuernas", icon: "fas fa-dumbbell" },
      machine: { label: "Máquina", icon: "fas fa-cogs" },
      cable: { label: "Polea", icon: "fas fa-wave-square" },
      bodyweight: { label: "Corporal", icon: "fas fa-running" },
      other: { label: "Otro", icon: "fas fa-toolbox" },
    };
    return map[equipmentKey] || { label: equipmentKey || "N/A", icon: "fas fa-dumbbell" };
  };

  const safeId = (value) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "");

  const buildExerciseLookup = () => {
    return (state.exercises || []).reduce((acc, ex) => {
      if (ex && ex._id) acc[ex._id] = ex;
      return acc;
    }, {});
  };

  const resolveSubstitutes = (substitutes) => {
    if (!Array.isArray(substitutes) || substitutes.length == 0) return [];
    const lookup = buildExerciseLookup();
    return substitutes.map((sub) => {
      if (typeof sub == "string") return lookup[sub];
      if (sub && typeof sub == "object") return sub;
      return null;
    }).filter(Boolean);
  };

  const toEmbedUrl = (url) => {
    const trimmed = (url || "").trim();
    if (!trimmed) return "";
    if (trimmed.includes("youtube.com/watch")) {
      const match = trimmed.match(/[?&]v=([^&]+)/);
      if (match && match[1]) return `https://www.youtube.com/embed/${match[1]}`;
    }
    if (trimmed.includes("youtu.be/")) {
      const match = trimmed.match(/youtu\.be\/([^?&]+)/);
      if (match && match[1]) return `https://www.youtube.com/embed/${match[1]}`;
    }
    return trimmed;
  };

  const openVideoModal = (url) => {
    const modalEl = document.getElementById("videoModal");
    const iframe = document.getElementById("videoFrame");
    const embedUrl = toEmbedUrl(url);
    if (!modalEl || !iframe || !embedUrl) return;
    iframe.src = embedUrl;
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener("hidden.bs.modal", () => {
      iframe.src = "";
    }, { once: true });
  };

  const loadBodyParts = async () => {
    try {
      const res = await fetch("/workout/api/body-parts");
      const data = await res.json();
      state.bodyParts = Array.isArray(data) ? data : [];
      renderBodyParts();
    } catch (e) {
      state.bodyParts = [];
    }
  };

  const loadExercises = async () => {
    try {
      const limit = 1000;
      let page = 1;
      let all = [];
      while (true) {
        const res = await fetch(`/workout/api/exercises?limit=${limit}&page=${page}`);
        const data = await res.json();
        if (!Array.isArray(data) || data.length == 0) break;
        all = all.concat(data);
        if (data.length < limit) break;
        page += 1;
      }
      state.exercises = all;
    } catch (e) {
      state.exercises = [];
    }
  };

  const loadRoutines = async () => {
    try {
      const promises = [
        fetch(isAdminBuilder ? "/workout/api/my-routines?all=1" : "/workout/api/my-routines").then(r => r.json())
      ];
      if (isAdminBuilder) {
        promises.push(fetch("/workout/api/ai-routines").then(r => r.json()));
      }
      const [myRoutines, aiRoutines] = await Promise.all(promises);
      const combined = [
        ...(Array.isArray(myRoutines) ? myRoutines : []),
        ...(Array.isArray(aiRoutines) ? aiRoutines : [])
      ];
      const normalized = combined.map((routine) => ({
        ...routine,
        name: getRoutineDisplayName(routine),
      }));
      // Sort by created desc
      state.routines = normalized.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      renderRoutineList();
    } catch (e) {
      state.routines = [];
    }
  };

  const applyRoutineToForm = (routine) => {
    document.getElementById("guidedName").value = routine.name || "";
    document.getElementById("guidedDesc").value = routine.description || "";
    document.getElementById("guidedDay").value = routine.routine_day || "";
    document.getElementById("guidedActive").checked = routine.is_active !== false;

    const selected = new Set(routine.routine_body_parts || []);
    document.querySelectorAll(".guided-bodypart").forEach((el) => {
      el.checked = selected.has(el.value);
    });

    updateSummary();
    renderRoutineList();
    renderExerciseList();
    renderConfigList();
  };

  const normalizeRoutine = (routine, options) => {
    const duplicate = options && options.duplicate;
    state.isEditingFlow = true;
    const exerciseLookup = buildExerciseLookup();
    state.routine.id = duplicate ? "" : routine._id || routine.id || "";
    state.routine.name = duplicate ? `${routine.name || "Rutina"} (Copia)` : (routine.name || "");
    state.routine.description = routine.description || "";
    state.routine.routine_day = routine.routine_day || "";
    state.routine.routine_body_parts = Array.isArray(routine.routine_body_parts) ? routine.routine_body_parts : [];
    state.routine.is_active = routine.is_active !== false;
    state.routine.items = (routine.items || []).map((item) => {
      if (item.item_type === "group") {
        return {
          item_type: "group",
          _id: item._id || makeId("group"),
          group_name: item.group_name || item.name || "Grupo",
          group_type: item.group_type || "biserie",
          note: item.note || "",
        };
      }
      if (item.item_type === "rest" || (!item.exercise_id && item.rest_seconds != null)) {
        return {
          item_type: "rest",
          _id: item._id || makeId("rest"),
          rest_seconds: item.rest_seconds || 60,
          note: item.note || "Descanso",
          group_id: item.group_id || "",
          manual_rest_enabled: item.manual_rest_enabled !== false,
        };
      }
      const exerciseId = item.exercise_id || item._id || item.id;
      const lookupExercise = exerciseLookup[exerciseId] || {};
      const mapped = {
        item_type: "exercise",
        _id: item._id || makeId("ex"),
        exercise_id: exerciseId,
        exercise_name: item.exercise_name || item.name || lookupExercise.name || "Ejercicio",
        exercise_type: item.exercise_type || item.type || lookupExercise.type || "weight",
        equipment: item.equipment || lookupExercise.equipment || "",
        body_part: item.body_part || lookupExercise.body_part || "",
        video_url: item.video_url || lookupExercise.video_url || "",
        substitutes: Array.isArray(item.substitutes) && item.substitutes.length
          ? item.substitutes
          : (Array.isArray(lookupExercise.substitutes) ? lookupExercise.substitutes : []),
        target_sets: item.target_sets || 3,
        target_reps: item.target_reps || "8-12",
        rest_seconds: item.rest_seconds != null ? item.rest_seconds : 60,
        target_time_seconds: item.target_time_seconds || 600,
        group_id: item.group_id || "",
        comment: item.comment || "",
        manual_rest_enabled: item.manual_rest_enabled !== false,
      };
      return normalizeItemTargets(mapped);
    });
  };

  const loadRoutineById = async (id, options) => {
    if (!id) return;
    try {
      // Check if it's an AI routine from state
      const routineRef = state.routines.find(r => String(r._id) === String(id));
      const isAI = routineRef && routineRef.source === "ai";
      let url = isAdminBuilder ? `/workout/api/my-routines/${id}?all=1` : `/workout/api/my-routines/${id}`;
      if (isAI) {
        url = `/workout/api/ai-routines/${id}`;
      }

      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      normalizeRoutine(data, options);
      applyRoutineToForm(state.routine);
      setStep(state.step);
      updateReview();
    } catch (e) {
      showMessage("No se pudo cargar la rutina.", "warning");
    }
  };

  const collapseRoutineList = () => {
    const collapseEl = document.getElementById("guidedRoutineCollapse");
    if (!collapseEl) return;
    const bsCollapse = bootstrap.Collapse.getOrCreateInstance(collapseEl);
    bsCollapse.hide();
  };

  const openExerciseModal = () => {
    const modalEl = document.getElementById("guidedExerciseModal");
    const frame = document.getElementById("guidedExerciseFrame");
    if (!modalEl || !frame) return;
    frame.src = "/workout/exercises?embed=1";
    if (!exerciseModal) {
      exerciseModal = new bootstrap.Modal(modalEl);
    }
    exerciseModal.show();
  };

  const openCommentModal = (title, value, idx, field) => {
    const modalEl = document.getElementById("guidedCommentModal");
    const titleEl = document.getElementById("guidedCommentTitle");
    const textEl = document.getElementById("guidedCommentText");
    if (!modalEl || !textEl || !titleEl) return;
    pendingCommentIdx = idx;
    pendingCommentField = field;
    titleEl.textContent = title || "Editar comentario";
    textEl.value = value || "";
    if (!commentModal) commentModal = new bootstrap.Modal(modalEl);
    commentModal.show();
  };

  const openAddExerciseModal = () => {
    const groupSelect = document.getElementById("guidedAddExerciseGroup");
    if (groupSelect) {
      groupSelect.innerHTML = '<option value="">Sin grupo (al final)</option>' + getGroupOptions()
        .map((g) => `<option value="${g._id}">${g.group_name || "Grupo"}</option>`)
        .join("");
    }
    if (!addExerciseModal) {
      addExerciseModal = new bootstrap.Modal(document.getElementById("guidedAddExerciseModal"));
    }
    addExerciseModal.show();
  };

  const closeExerciseModal = () => {
    const frame = document.getElementById("guidedExerciseFrame");
    if (frame) frame.src = "";
    if (exerciseModal) exerciseModal.hide();
  };
  const bindEvents = () => {
    document.getElementById("guidedNextBtn")?.addEventListener("click", () => {
      clearMessage();
      if (state.step === 1) {
        state.routine.name = document.getElementById("guidedName").value.trim();
        state.routine.description = document.getElementById("guidedDesc").value.trim();
        state.routine.routine_day = document.getElementById("guidedDay").value;
        state.routine.is_active = document.getElementById("guidedActive").checked;
        const selectedParts = Array.from(document.querySelectorAll(".guided-bodypart:checked")).map((el) => el.value);
        state.routine.routine_body_parts = selectedParts;
        if (!state.routine.name) {
          showMessage("Debes ingresar un nombre.", "warning");
          return;
        }
      }
      if (state.step === 2) {
        const hasExercise = state.routine.items.some((i) => i.item_type === "exercise");
        const hasGroup = state.routine.items.some((i) => i.item_type === "group");
        if (!hasExercise && !hasGroup) {
          showMessage("Agrega al menos un grupo o un ejercicio.", "warning");
          return;
        }
      }
      if (state.step === 2) {
        updateReview();
      }
      setStep(Math.min(3, state.step + 1));
      openProgressModalIfMobile();
    });

    document.getElementById("guidedPrevBtn")?.addEventListener("click", () => {
      clearMessage();
      setStep(Math.max(1, state.step - 1));
      openProgressModalIfMobile();
    });

    document.getElementById("guidedCancelBtn")?.addEventListener("click", async () => {
      if (await confirmRemove("Cancelar y limpiar la rutina?")) {
        window.location.reload();
      }
    });

    document.getElementById("guidedProgressInfoBtn")?.addEventListener("click", () => {
      updateProgressModal();
      const modalEl = document.getElementById("guidedProgressModal");
      if (!modalEl) return;
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    });

    document.getElementById("guidedSaveBtn")?.addEventListener("click", async () => {
      clearMessage();
      closeOpenModals();
      try {
        state.routine.name = document.getElementById("guidedName").value.trim();
        state.routine.description = document.getElementById("guidedDesc").value.trim();
        state.routine.routine_day = document.getElementById("guidedDay").value;
        state.routine.is_active = document.getElementById("guidedActive").checked;
        const selectedParts = Array.from(document.querySelectorAll(".guided-bodypart:checked")).map((el) => el.value);
        state.routine.routine_body_parts = selectedParts;
        if (!state.routine.name) {
          showMessage("Debes ingresar un nombre.", "warning");
          return;
        }
        if (window.showLoader) window.showLoader("Guardando rutina...");
        const payload = {
          id: state.routine.id || undefined,
          name: state.routine.name,
          description: state.routine.description,
          routine_day: state.routine.routine_day,
          routine_body_parts: state.routine.routine_body_parts,
          items: state.routine.items,
          is_active: state.routine.is_active,
          admin_template: isAdminBuilder,
        };
        const res = await fetch("/workout/api/my-routines/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Error guardando");
        showMessage("Rutina guardada!", "success");
        await loadRoutines();
        setStep(1);
        openProgressModalIfMobile();
      } catch (e) {
        showMessage("No se pudo guardar la rutina.", "warning");
      } finally {
        if (window.hideLoader) window.hideLoader();
      }
    });

    document.getElementById("guidedExerciseList")?.addEventListener("click", async (event) => {
      const replaceBtn = event.target.closest("[data-replace]");
      if (replaceBtn) {
        pendingReplaceId = replaceBtn.dataset.replace;
        pendingAddGroupId = "";
        openExerciseModal();
        return;
      }
      const btn = event.target.closest("[data-remove-ex]");
      if (!btn) return;
      const idx = Number(btn.dataset.removeEx);
      const exercises = state.routine.items.filter((item) => item.item_type === "exercise");
      const item = exercises[idx];
      if (!item) return;
      if (!(await confirmRemove(`Eliminar ejercicio: ${item.exercise_name || "Ejercicio"}?`))) return;
      state.routine.items = state.routine.items.filter((entry) => entry !== item);
      renderExerciseList();
      renderConfigList();
      updateSummary();
    });

    document.getElementById("guidedConfigList")?.addEventListener("change", (event) => {
      const field = event.target.getAttribute("data-field");
      const idx = Number(event.target.getAttribute("data-idx"));
      if (!field || Number.isNaN(idx)) return;
      const value = event.target.value;
      if (!state.routine.items[idx]) return;
      if (["group_name", "note", "comment"].includes(field)) {
        if (field == "group_name") {
          const groupId = state.routine.items[idx]._id;
          const errorEl = document.querySelector(`[data-group-error="${groupId}"]`);
          if (!value.trim()) {
            if (errorEl) {
              errorEl.textContent = "El nombre del grupo es obligatorio.";
              errorEl.style.display = "block";
            }
            event.target.value = state.routine.items[idx][field] || "";
            return;
          }
          if (isGroupNameTaken(value, groupId)) {
            if (errorEl) {
              errorEl.textContent = "Ya existe un grupo con ese nombre.";
              errorEl.style.display = "block";
            }
            event.target.value = state.routine.items[idx][field] || "";
            return;
          }
          if (errorEl) errorEl.style.display = "none";
        }
        state.routine.items[idx][field] = value;
        return;
      }

      if (field === "target_reps") {
        const exactInput = document.querySelector(`[data-field="target_reps_exact"][data-idx="${idx}"]`);
        if (value === "Reps fijas") {
          if (exactInput) {
            exactInput.disabled = false;
            exactInput.style.display = "block";
            const exactValue = exactInput.value ? exactInput.value : 10;
            state.routine.items[idx].target_reps = exactValue;
            state.routine.items[idx].target_time_seconds = 0;
          } else {
            state.routine.items[idx].target_reps = 10;
            state.routine.items[idx].target_time_seconds = 0;
          }
          renderConfigList();
          return;
        }
        if (exactInput) {
          exactInput.disabled = true;
          exactInput.style.display = "none";
        }
        state.routine.items[idx].target_reps = value;
        state.routine.items[idx].target_time_seconds = 0;
        return;
      }

      if (field === "target_reps_exact") {
        state.routine.items[idx].target_reps = value;
        state.routine.items[idx].target_time_seconds = 0;
        return;
      }

      if (field === "target_time_minutes") {
        const minutes = Math.max(1, Number(value) || 1);
        state.routine.items[idx].target_time_seconds = minutes * 60;
        state.routine.items[idx].target_reps = 0;
        return;
      }

      if (field === "rest_seconds_manual") {
        const seconds = Math.max(1, Math.min(1800, Number(value) || 1));
        state.routine.items[idx].rest_seconds = seconds;
        return;
      }

      const parsedValue = field.includes("sets") || field.includes("seconds") ? Number(value) : value;
      state.routine.items[idx][field] = parsedValue;
      if (field === "target_time_seconds") {
        state.routine.items[idx].target_reps = 0;
      }
      if (field === "target_sets") {
        const item = state.routine.items[idx];
        if (item && item.group_id) {
          state.routine.items.forEach((entry) => {
            if (entry.item_type === "exercise" && entry.group_id === item.group_id) {
              entry.target_sets = parsedValue;
            }
          });
          renderConfigList();
        }
      }

      if (field === "group_id") {
        // Auto-move: Re-order items in state so this item is near its new group
        // Actually, just calling renderConfigList() will re-group them visually 
        // because renderConfigList iterates items but uses groupItemsMap to group them.
        // Wait, renderConfigList iterates items linearly.
        // If we don't move the item in the array, it might appear in the old position?
        // No, renderConfigList SKIPs items that are in a group (line 739/525).
        // And renderGroupBlock renders ALL items in that group.
        // So just changing group_id is enough to move it VISUALLY to the group block.
        // The order INSIDE the group depends on array order.
        renderConfigList();
      }
    });

    document.getElementById("guidedConfigList")?.addEventListener("click", async (event) => {
      const toggleTimeBtn = event.target.closest("[data-toggle-time-input]");
      if (toggleTimeBtn) {
        const idx = Number(toggleTimeBtn.dataset.toggleTimeInput);
        if (Number.isNaN(idx) || !state.routine.items[idx]) return;
        state.routine.items[idx].manual_time_enabled = !state.routine.items[idx].manual_time_enabled;
        renderConfigList();
        return;
      }
      const toggleRestBtn = event.target.closest("[data-toggle-rest-input]");
      if (toggleRestBtn) {
        const idx = Number(toggleRestBtn.dataset.toggleRestInput);
        if (Number.isNaN(idx) || !state.routine.items[idx]) return;
        state.routine.items[idx].manual_rest_enabled = !state.routine.items[idx].manual_rest_enabled;
        renderConfigList();
        return;
      }
      const replaceBtn = event.target.closest("[data-replace]");
      if (replaceBtn) {
        pendingReplaceId = replaceBtn.dataset.replace;
        pendingAddGroupId = "";
        openExerciseModal();
        return;
      }

      const commentInput = event.target.closest("[data-comment-edit]");
      if (commentInput) {
        const idx = Number(commentInput.dataset.idx);
        const field = commentInput.dataset.commentEdit;
        if (Number.isNaN(idx) || !field || !state.routine.items[idx]) return;
        const titleMap = {
          comment: "Comentario del ejercicio",
          note: "Nota"
        };
        openCommentModal(titleMap[field] || "Editar comentario", state.routine.items[idx][field] || "", idx, field);
        return;
      }

      const moveGroupBtn = event.target.closest("[data-move-group]");
      if (moveGroupBtn) {
        const groupId = moveGroupBtn.dataset.moveGroup;
        const dir = Number(moveGroupBtn.dataset.dir);
        const groups = state.routine.items.filter((item) => item.item_type === "group");
        const currentIdx = groups.findIndex((group) => group._id === groupId);
        const targetIdx = currentIdx + dir;
        if (currentIdx < 0 || targetIdx < 0 || targetIdx >= groups.length) return;
        const directionText = dir < 0 ? "antes de" : "despues de";
        const message = `Mover ${getMoveItemLabel(groups[currentIdx])} ${directionText} ${getMoveItemLabel(groups[targetIdx])}?`;
        const confirmed = await showConfirmMoveModal("Confirmar movimiento", message);
        if (!confirmed) return;
        moveGroupBlock(groupId, dir);
        return;
      }

      const moveBtn = event.target.closest("[data-move-item]");
      if (moveBtn) {
        const id = moveBtn.dataset.moveItem;
        const dir = Number(moveBtn.dataset.dir);
        const items = state.routine.items;
        const itemIndex = items.findIndex((entry) => entry._id === id);
        const item = items[itemIndex];
        if (!item) return;

        if (!item.group_id && (item.item_type === "rest" || item.item_type === "exercise")) {
          const groupRanges = new Map();
          items.forEach((entry, idx) => {
            if (entry.item_type !== "group") return;
            if (!groupRanges.has(entry._id)) {
              groupRanges.set(entry._id, { start: idx, end: idx });
            }
          });
          items.forEach((entry, idx) => {
            if (!entry.group_id) return;
            const range = groupRanges.get(entry.group_id);
            if (!range) return;
            range.start = Math.min(range.start, idx);
            range.end = Math.max(range.end, idx);
          });

          const blocks = [];
          items.forEach((entry, idx) => {
            if (entry.item_type === "group") {
              const range = groupRanges.get(entry._id) || { start: idx, end: idx };
              blocks.push({ type: "group", id: entry._id, start: range.start, end: range.end, label: getMoveItemLabel(entry) });
              return;
            }
            if (!entry.group_id) {
              blocks.push({ type: "single", index: idx, label: getMoveItemLabel(entry) });
            }
          });

          const currentBlockIndex = blocks.findIndex((block) => block.type === "single" && block.index === itemIndex);
          if (currentBlockIndex < 0) return;
          const targetBlockIndex = currentBlockIndex + dir;
          if (targetBlockIndex < 0 || targetBlockIndex >= blocks.length) return;
          const targetBlock = blocks[targetBlockIndex];
          const directionText = dir < 0 ? "antes de" : "despues de";
          const message = `Mover ${getMoveItemLabel(item)} ${directionText} ${targetBlock.label}?`;
          const confirmed = await showConfirmMoveModal("Confirmar movimiento", message);
          if (!confirmed) return;

          let insertAt = 0;
          if (targetBlock.type === "group") {
            insertAt = dir < 0 ? targetBlock.start : targetBlock.end + 1;
          } else {
            insertAt = dir < 0 ? targetBlock.index : targetBlock.index + 1;
          }

          const moved = items.splice(itemIndex, 1)[0];
          if (insertAt > itemIndex) insertAt -= 1;
          items.splice(insertAt, 0, moved);
          renderConfigList();
          return;
        }

        let targetItem = null;
        if (item.group_id) {
          const sameGroupIndices = items
            .map((entry, i) => ({ entry, i }))
            .filter(({ entry }) => (entry.group_id || "") === item.group_id && entry.item_type !== "group")
            .map(({ i }) => i);
          const currentPos = sameGroupIndices.indexOf(itemIndex);
          const targetPos = currentPos + dir;
          if (targetPos < 0 || targetPos >= sameGroupIndices.length) return;
          targetItem = items[sameGroupIndices[targetPos]];
        } else {
          const ungroupedIndices = items
            .map((entry, i) => ({ entry, i }))
            .filter(({ entry }) => !entry.group_id && entry.item_type !== "group")
            .map(({ i }) => i);
          const currentPos = ungroupedIndices.indexOf(itemIndex);
          const targetPos = currentPos + dir;
          if (targetPos < 0 || targetPos >= ungroupedIndices.length) return;
          targetItem = items[ungroupedIndices[targetPos]];
        }

        const directionText = dir < 0 ? "antes de" : "despues de";
        const message = `Mover ${getMoveItemLabel(item)} ${directionText} ${getMoveItemLabel(targetItem)}?`;
        const confirmed = await showConfirmMoveModal("Confirmar movimiento", message);
        if (!confirmed) return;

        if (item.group_id) {
          moveWithinGroup(id, dir);
        } else {
          moveUngrouped(id, dir);
        }
        return;
      }

      const removeGroupBtn = event.target.closest("[data-remove-group]");
      if (removeGroupBtn) {
        if (!(await confirmRemove("Eliminar grupo y sus elementos?"))) return;
        removeGroup(removeGroupBtn.dataset.removeGroup);
        renderConfigList();
        renderExerciseList();
        updateSummary();
        return;
      }

      const btn = event.target.closest("[data-remove]");
      if (!btn) return;
      const idx = Number(btn.dataset.remove);
      if (Number.isNaN(idx)) return;
      const item = state.routine.items[idx];
      if (!item) return;
      let message = "Eliminar elemento?";
      if (item.item_type === "group") {
        message = "Eliminar grupo y sus elementos?";
      } else if (item.item_type === "rest") {
        message = "Eliminar pausa?";
      } else if (item.item_type === "exercise") {
        message = `Eliminar ejercicio: ${item.exercise_name || "Ejercicio"}?`;
      }
      if (!(await confirmRemove(message))) return;
      if (item.item_type === "group") {
        removeGroup(item._id);
      } else {
        state.routine.items.splice(idx, 1);
      }
      renderConfigList();
      renderExerciseList();
      updateSummary();
    });

    document.getElementById("guidedOpenExerciseModal")?.addEventListener("click", () => {
      pendingReplaceId = "";
      pendingAddGroupId = "";
      openExerciseModal();
    });
    document.getElementById("guidedAddExerciseBtn")?.addEventListener("click", () => {
      pendingReplaceId = "";
      pendingAddGroupId = "";
      openExerciseModal();
    });

    document.getElementById("guidedAddGroupBtn")?.addEventListener("click", () => {
      const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("guidedGroupModal"));
      modal.show();
    });

    document.getElementById("guidedAddGroupBtnStep2")?.addEventListener("click", () => {
      const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("guidedGroupModal"));
      modal.show();
    });

    document.addEventListener('guided-toggle-group', (e) => {
      const groupId = e.detail;
      if (collapsedGroups.has(groupId)) {
        collapsedGroups.delete(groupId);
      } else {
        collapsedGroups.add(groupId);
      }
      renderConfigList();
    });

    document.getElementById("guidedAddExerciseBtnStep3")?.addEventListener("click", () => {
      openAddExerciseModal();
    });

    document.getElementById("guidedAddExerciseConfirm")?.addEventListener("click", () => {
      const groupSelect = document.getElementById("guidedAddExerciseGroup");
      pendingAddGroupId = groupSelect ? groupSelect.value : "";
      pendingReplaceId = "";
      addExerciseModal?.hide();
      openExerciseModal();
    });

    document.getElementById("guidedGroupSave")?.addEventListener("click", () => {
      const nameInput = document.getElementById("guidedGroupName");
      const errorEl = document.getElementById("guidedGroupNameError");
      const name = nameInput ? nameInput.value.trim() : "";
      const type = document.getElementById("guidedGroupType").value;
      const note = document.getElementById("guidedGroupNote").value.trim();

      if (!name) {
        if (errorEl) {
          errorEl.textContent = "Debes ingresar un nombre para el grupo.";
          errorEl.style.display = "block";
        }
        return;
      }
      if (isGroupNameTaken(name)) {
        if (errorEl) {
          errorEl.textContent = "Ya existe un grupo con ese nombre.";
          errorEl.style.display = "block";
        }
        return;
      }
      if (errorEl) errorEl.style.display = "none";

      addGroup(name, type, note);
      if (nameInput) nameInput.value = "";
      document.getElementById("guidedGroupNote").value = "";
      bootstrap.Modal.getOrCreateInstance(document.getElementById("guidedGroupModal")).hide();
    });

    document.getElementById("guidedAddRestBtn")?.addEventListener("click", () => {
      const restSelect = document.getElementById("guidedRestSeconds");
      if (restSelect && restSelect.options.length === 0) {
        restSelect.innerHTML = REST_OPTIONS.map((opt) => `<option value="${opt}">${opt}s</option>`).join("");
      }
      setRestModalManual(false);
      const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("guidedRestModal"));
      modal.show();
    });

    document.getElementById("guidedRestSecondsToggle")?.addEventListener("click", () => {
      setRestModalManual(!restModalManualEnabled);
    });

    document.getElementById("guidedDesc")?.addEventListener("click", () => {
      const descInput = document.getElementById("guidedDesc");
      if (!descInput) return;
      pendingCommentIdx = null;
      pendingCommentField = "routine_description";
      openCommentModal("Descripcion de la rutina", descInput.value || "", null, "routine_description");
    });

    document.getElementById("guidedRestSave")?.addEventListener("click", () => {
      const groupId = document.getElementById("guidedRestGroup").value;
      const seconds = restModalManualEnabled
        ? document.getElementById("guidedRestSecondsManual").value
        : document.getElementById("guidedRestSeconds").value;
      const note = document.getElementById("guidedRestNote").value.trim();
      addRest(groupId, seconds, note);
      document.getElementById("guidedRestNote").value = "";
      setRestModalManual(false);
      bootstrap.Modal.getOrCreateInstance(document.getElementById("guidedRestModal")).hide();
    });

    document.getElementById("guidedCommentSave")?.addEventListener("click", () => {
      const textEl = document.getElementById("guidedCommentText");
      if (!textEl) return;
      if (!pendingCommentField) return;
      if (pendingCommentField === "routine_description") {
        const descInput = document.getElementById("guidedDesc");
        if (descInput) descInput.value = textEl.value || "";
        state.routine.description = textEl.value || "";
      } else {
        if (pendingCommentIdx == null) return;
        const item = state.routine.items[pendingCommentIdx];
        if (!item) return;
        item[pendingCommentField] = textEl.value || "";
        renderConfigList();
      }
      pendingCommentIdx = null;
      pendingCommentField = "";
      bootstrap.Modal.getOrCreateInstance(document.getElementById("guidedCommentModal")).hide();
    });

    document.getElementById("guidedRoutineList")?.addEventListener("click", (event) => {
      const loadBtn = event.target.closest("[data-load]");
      if (loadBtn) {
        loadRoutineById(loadBtn.dataset.load, { duplicate: false });
        const searchInput = document.getElementById("guidedRoutineSearch");
        if (searchInput) searchInput.value = "";
        renderRoutineList();
        collapseRoutineList();
        return;
      }
      const dupBtn = event.target.closest("[data-dup]");
      if (dupBtn) {
        loadRoutineById(dupBtn.dataset.dup, { duplicate: true });
        const searchInput = document.getElementById("guidedRoutineSearch");
        if (searchInput) searchInput.value = "";
        renderRoutineList();
        collapseRoutineList();
      }
    });

    document.getElementById("guidedRoutineSearch")?.addEventListener("input", renderRoutineList);
    const routineCollapseEl = document.getElementById("guidedRoutineCollapse");
    if (routineCollapseEl) {
      routineCollapseEl.addEventListener("shown.bs.collapse", () => {
        if (routineListAutoToggle) {
          routineListAutoToggle = false;
          return;
        }
        routineListManuallyExpanded = true;
      });
      routineCollapseEl.addEventListener("hidden.bs.collapse", () => {
        if (routineListAutoToggle) {
          routineListAutoToggle = false;
          return;
        }
        routineListManuallyExpanded = false;
      });
    }
    document.getElementById("guidedRoutineReset")?.addEventListener("click", () => {
      document.getElementById("guidedRoutineSearch").value = "";
      renderRoutineList();
    });
  };

  window.openVideoModal = openVideoModal;

  const init = async () => {
    updateHelpText();
    updateSummary();
    await Promise.all([loadBodyParts(), loadExercises(), loadRoutines()]);
    if (isAdminBuilder) {
      const activeWrap = document.getElementById("guidedActive")?.closest(".mb-3");
      if (activeWrap) activeWrap.style.display = "none";
    }
    bindEvents();
    setStep(1);
  };

  window.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type === "rm-exercise-select" && data.exercise) {
      const picked = data.exercise;
      const byId = state.exercises.find((ex) => String(ex._id) === String(picked.id));
      const fallback = {
        _id: picked.id,
        name: picked.name,
        body_part: picked.body_part,
        type: picked.type || picked.exercise_type || "weight"
      };
      addExercise(byId || fallback, pendingAddGroupId);
      pendingAddGroupId = "";
      const nameInput = document.getElementById("guidedExerciseName");
      if (nameInput) nameInput.value = picked.name || "";
      closeExerciseModal();
    }
  });

  document.addEventListener("DOMContentLoaded", init);
})();
