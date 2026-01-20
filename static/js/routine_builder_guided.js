
(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const isAdminBuilder = urlParams.get("source") === "admin";

  const state = {
    step: 1,
    exercises: [],
    bodyParts: [],
    routines: [],
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
  const TIME_OPTIONS = [300, 600, 900, 1200, 1800];

  let exerciseModal = null;
  let addExerciseModal = null;
  let confirmMoveModal = null;
  let pendingReplaceId = "";
  let pendingAddGroupId = "";

  const makeId = (prefix) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  const showMessage = (text, tone) => {
    const el = document.getElementById("guidedMessage");
    if (!el) return;
    el.style.display = "block";
    el.className = `alert alert-${tone || "dark"} border-secondary text-${tone === "warning" ? "dark" : "secondary"} small mb-3`;
    el.textContent = text;
  };

  const clearMessage = () => {
    const el = document.getElementById("guidedMessage");
    if (el) el.style.display = "none";
  };

  const confirmRemove = (message) => {
    return window.confirm(message || "Confirmar eliminacion?");
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
    if (progress) progress.style.width = `${step * 25}%`;

    const prevBtn = document.getElementById("guidedPrevBtn");
    const nextBtn = document.getElementById("guidedNextBtn");
    const saveBtn = document.getElementById("guidedSaveBtn");
    if (prevBtn) prevBtn.disabled = step === 1;
    if (nextBtn) nextBtn.style.display = step === 4 ? "none" : "inline-block";
    if (saveBtn) saveBtn.style.display = step === 4 ? "inline-block" : "none";
    updateHelpText();
  };

  const updateHelpText = () => {
    const el = document.getElementById("guidedHelp");
    if (!el) return;
    const map = {
      1: "Busca una rutina existente o comienza desde cero.",
      2: "Agrega ejercicios con el catalogo o reemplaza los ya seleccionados.",
      3: "Organiza grupos y ajusta orden, descansos y comentarios.",
      4: "Revisa el resumen visual antes de guardar.",
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

  const renderRoutineList = () => {
    const list = document.getElementById("guidedRoutineList");
    const term = (document.getElementById("guidedRoutineSearch")?.value || "").toLowerCase();
    const collapseEl = document.getElementById("guidedRoutineCollapse");
    if (!list) return;
    const filtered = state.routines.filter((r) => {
      const name = (r.name || "").toLowerCase();
      return !term || name.includes(term);
    });
    const collapseInstance = collapseEl ? bootstrap.Collapse.getOrCreateInstance(collapseEl, { toggle: false }) : null;

    if (!filtered.length) {
      list.innerHTML = '<div class="p-3 text-secondary small">Sin resultados.</div>';
      if (collapseInstance) collapseInstance.hide();
      return;
    }

    if (collapseInstance) collapseInstance.show();

    list.innerHTML = filtered
      .map((r) => {
        const badge = r.is_active === false ? "Inactiva" : "Activa";
        const badgeClass = r.is_active === false ? "bg-secondary" : "bg-success";
        return `
          <div class="guided-config-card mb-2">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <div class="text-white fw-bold">${r.name || "Rutina"}</div>
                <div class="text-secondary small">${r.description || ""}</div>
              </div>
              <span class="badge ${badgeClass} text-dark">${badge}</span>
            </div>
            <div class="guided-inline-actions mt-2">
              <button class="btn btn-sm btn-outline-info" data-load="${r._id}">Cargar</button>
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
        state.routine.items[idx] = {
          ...existing,
          exercise_id: exercise._id || exercise.id,
          exercise_name: exercise.name || "Ejercicio",
          exercise_type: exercise.type || "weight",
          equipment: exercise.equipment || "",
          body_part: exercise.body_part || "",
          video_url: exercise.video_url || "",
          substitutes: Array.isArray(exercise.substitutes) ? exercise.substitutes : [],
        };
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
      state.routine.items.push({
        item_type: "exercise",
        _id: makeId("ex"),
        exercise_id: exercise._id || exercise.id,
        exercise_name: exercise.name || "Ejercicio",
        exercise_type: exercise.type || "weight",
        equipment: exercise.equipment || "",
        body_part: exercise.body_part || "",
        video_url: exercise.video_url || "",
        substitutes: Array.isArray(exercise.substitutes) ? exercise.substitutes : [],
        target_sets: inheritedSets,
        target_reps: "8-12",
        rest_seconds: 60,
        target_time_seconds: 600,
        group_id: groupId || "",
        comment: "",
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
      group_name: name || "Grupo",
      group_type: type || "biserie",
      note: note || "",
    });
    renderConfigList();
  };

  const addRest = (groupId, seconds, note) => {
    state.routine.items.push({
      item_type: "rest",
      _id: makeId("rest"),
      rest_seconds: Number(seconds) || 60,
      note: note || "Descanso",
      group_id: groupId || "",
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
      const isTime = item.exercise_type === "time" || item.exercise_type === "cardio";
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
            <div class="col-4">
              <label class="text-secondary small">Series</label>
              <select class="form-select form-select-sm bg-dark text-white border-secondary" data-field="target_sets" data-idx="${idx}">
                ${SETS_OPTIONS.map((opt) => `<option value="${opt}" ${Number(item.target_sets) === opt ? "selected" : ""}>${opt}</option>`).join("")}
              </select>
            </div>
            <div class="col-4">
              <label class="text-secondary small">${isTime ? "Tiempo" : "Reps"}</label>
              ${
                isTime
                  ? `<select class="form-select form-select-sm bg-dark text-white border-secondary" data-field="target_time_seconds" data-idx="${idx}">
                      ${TIME_OPTIONS.map((opt) => `<option value="${opt}" ${Number(item.target_time_seconds) === opt ? "selected" : ""}>${Math.round(opt / 60)} min</option>`).join("")}
                    </select>`
                  : `<select class="form-select form-select-sm bg-dark text-white border-secondary" data-field="target_reps" data-idx="${idx}">
                      ${REPS_OPTIONS.map((opt) => `<option value="${opt}" ${getRepsSelectValue(item.target_reps) === opt ? "selected" : ""}>${opt}</option>`).join("")}
                    </select>
                    <input type="number" min="1" class="form-control form-control-sm bg-dark text-white border-secondary mt-1" data-field="target_reps_exact" data-idx="${idx}" placeholder="Reps fijas" value="${getExactRepsValue(item.target_reps)}" style="display: ${isExactRepsValue(item.target_reps) ? 'block' : 'none'};" ${isExactRepsValue(item.target_reps) ? '' : 'disabled'}>`
              }
            </div>
            <div class="col-4">
              <label class="text-secondary small">Descanso</label>
              <select class="form-select form-select-sm bg-dark text-white border-secondary" data-field="rest_seconds" data-idx="${idx}">
                ${REST_OPTIONS.map((opt) => `<option value="${opt}" ${Number(item.rest_seconds) === opt ? "selected" : ""}>${opt}s</option>`).join("")}
              </select>
            </div>
            <div class="col-6">
              <label class="text-secondary small">Grupo</label>
              <select class="form-select form-select-sm bg-dark text-white border-secondary" data-field="group_id" data-idx="${idx}">
                ${renderGroupOptions(item.group_id)}
              </select>
            </div>
            <div class="col-6">
              <label class="text-secondary small">Comentario</label>
              <input class="form-control form-control-sm bg-dark text-white border-secondary" data-field="comment" data-idx="${idx}" value="${item.comment || ""}">
            </div>
          </div>
        </div>
      `;
    };

    const renderRestCard = (item, idx) => {
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
            <div class="col-4">
              <label class="text-secondary small">Tiempo</label>
              <select class="form-select form-select-sm bg-dark text-white border-secondary" data-field="rest_seconds" data-idx="${idx}">
                ${REST_OPTIONS.map((opt) => `<option value="${opt}" ${Number(item.rest_seconds) === opt ? "selected" : ""}>${opt}s</option>`).join("")}
              </select>
            </div>
            <div class="col-4">
              <label class="text-secondary small">Grupo</label>
              <select class="form-select form-select-sm bg-dark text-white border-secondary" data-field="group_id" data-idx="${idx}">
                ${renderGroupOptions(item.group_id)}
              </select>
            </div>
            <div class="col-4">
              <label class="text-secondary small">Nota</label>
              <input class="form-control form-control-sm bg-dark text-white border-secondary" data-field="note" data-idx="${idx}" value="${item.note || ""}">
            </div>
          </div>
        </div>
      `;
    };

    const renderGroupBlock = (group, entries, groupIndex) => {
      const body = entries
        .sort((a, b) => a.idx - b.idx)
        .map(({ item, idx }) => {
          if (item.item_type === "rest") return renderRestCard(item, idx);
          return renderExerciseCard(item, idx);
        })
        .join("");

      return `
        <div class="guided-block">
          <div class="guided-block-header mb-3">
            <div>
              <div class="text-info fw-bold">Grupo: ${group.group_name || "Grupo"}</div>
              <div class="text-secondary small">${group.group_type || "biserie"} ${group.note ? "- " + group.note : ""}</div>
            </div>
            <div class="guided-inline-actions">
                            <button class="btn btn-sm btn-outline-secondary" data-move-group="${group._id}" data-dir="-1"><i class="fas fa-arrow-up"></i></button>
              <button class="btn btn-sm btn-outline-secondary" data-move-group="${group._id}" data-dir="1"><i class="fas fa-arrow-down"></i></button>
              <button class="btn btn-sm btn-outline-danger" data-remove-group="${group._id}"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="row g-2 mb-3">
            <div class="col-12">
              <label class="text-secondary small">Nota</label>
              <input class="form-control form-control-sm bg-dark text-white border-secondary" data-field="note" data-idx="${groupIndex}" value="${group.note || ""}">
            </div>
          </div>
          ${body || '<div class="text-secondary small">No hay ejercicios en este grupo.</div>'}
        </div>
      `;
    };

    const htmlParts = [];
    const renderedGroupIds = new Set();
    let ungroupedOpen = false;

    const openUngrouped = () => {
      if (ungroupedOpen) return;
      htmlParts.push(
        `<div class="guided-block"><div class="guided-block-header mb-3"><div class="text-white fw-bold">Sin grupo</div><div class="guided-inline-actions"></div></div>`
      );
      ungroupedOpen = true;
    };

    const closeUngrouped = () => {
      if (!ungroupedOpen) return;
      htmlParts.push("</div>");
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
  };

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

  const updateReview = () => {
    const list = document.getElementById("guidedReviewList");
    if (!list) return;
    const routine = state.routine;
    const partsLabel = getRoutineBodyPartsLabel(routine);
    const exercises = getExerciseCount(routine);
    const day = routine.routine_day || "-";
    const previewHtml = buildRoutinePreviewHtml(routine);

    list.innerHTML = `
      <div class="routine-preview-card">
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
            <div class="text-secondary small">Dia</div>
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

  const getRestSeconds = (item) => {
    if (!item) return 60;
    if (item.rest_seconds != null) return item.rest_seconds;
    if (item.rest != null && item.rest !== item.target_time_seconds) return item.rest;
    return 60;
  };

  const getEquipmentMeta = (equipmentKey) => {
    const map = {
      barbell: { label: "Barra", icon: "fas fa-grip-lines" },
      dumbbell: { label: "Mancuernas", icon: "fas fa-dumbbell" },
      machine: { label: "Maquina", icon: "fas fa-cogs" },
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

  const buildRoutinePreviewHtml = (routine) => {
    const items = Array.isArray(routine.items) ? routine.items : [];
    const isRestItem = (item) => item && (item.item_type === "rest" || (!item.exercise_id && item.rest_seconds != null));
    const isExerciseItem = (item) => item && item.item_type === "exercise";
    const isGroupHeader = (item) => item && item.item_type === "group";

    const groupMetaMap = new Map();
    items.forEach((item) => {
      if (isGroupHeader(item)) {
        groupMetaMap.set(item._id || item.id, {
          name: item.group_name || item.name || "Circuito",
          note: item.note || item.description || "",
        });
      }
    });

    const blocks = [];
    const blockIds = new Set();
    const groupEntries = new Map();

    const ensureGroupBlock = (groupId) => {
      if (!groupId || blockIds.has(groupId)) return;
      blockIds.add(groupId);
      blocks.push({ type: "group", id: groupId });
    };

    items.forEach((item) => {
      if (item.item_type === "group" || Array.isArray(item.items)) {
        if (Array.isArray(item.items) && item.items.length > 0) {
          blocks.push({ type: "inline_group", item });
          return;
        }
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
          blocks.push({ type: "ungrouped", entry: item });
        }
      }
    });

    const renderEntry = (item) => {
      if (isRestItem(item)) {
        const restLabel = item.note || "Descanso";
        const restSeconds = getRestSeconds(item);
        return `
          <div class="routine-preview-item d-flex justify-content-between align-items-center">
            <div>
              <div class="text-white fw-bold">${restLabel}</div>
              <div class="text-secondary small">Pausa</div>
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
      const rest = getRestSeconds(item);
      const equipmentMeta = getEquipmentMeta(item.equipment);
      const hasVideo = item.video_url && item.video_url.trim() !== "";
      const substitutes = resolveSubstitutes(item.substitutes || []);
      const subsId = `subs_${safeId(routine._id)}_${safeId(item._id)}`;

      return `
        <div class="routine-preview-item d-flex justify-content-between align-items-start">
          <div>
            <div class="d-flex align-items-center gap-2">
              <div class="text-white fw-bold">${name}</div>
              ${hasVideo ? `
                <button class="btn btn-sm btn-outline-danger" onclick="openVideoModal('${item.video_url}')">
                  <i class="fab fa-youtube"></i>
                </button>
              ` : ""}
            </div>
            <div class="d-flex flex-wrap gap-2 mt-1">
              <span class="badge bg-secondary">${bodyPartLabel}</span>
              <span class="badge bg-dark border border-secondary text-info">
                <i class="${equipmentMeta.icon} me-1"></i>${equipmentMeta.label}
              </span>
            </div>
            ${substitutes.length ? `
              <button class="btn btn-sm btn-outline-info mt-2" type="button" data-bs-toggle="collapse" data-bs-target="#${subsId}">
                Sustitutos (${substitutes.length})
              </button>
              <div class="collapse mt-2" id="${subsId}">
                <div class="d-flex flex-column gap-2">
                  ${substitutes.map((sub) => `
                    <div class="routine-preview-item d-flex align-items-center justify-content-between">
                      <div>
                        <div class="fw-bold text-white">${sub.name || "Ejercicio"}</div>
                        <div class="text-secondary small">
                          <i class="${getEquipmentMeta(sub.equipment).icon} me-1"></i>${getEquipmentMeta(sub.equipment).label}
                        </div>
                      </div>
                      ${sub.video_url ? `
                        <button class="btn btn-sm btn-outline-danger" onclick="openVideoModal('${sub.video_url}')">
                          <i class="fab fa-youtube"></i>
                        </button>
                      ` : ""}
                    </div>
                  `).join("")}
                </div>
              </div>
            ` : ""}
          </div>
          <div class="text-end text-secondary small">
            <div>${sets} sets ${isTime ? `x ${time}s` : `x ${reps}`}</div>
            <div>Descanso ${rest}s</div>
          </div>
        </div>
      `;
    };

    const htmlParts = [];
    let lastBlockWasUngrouped = false;

    blocks.forEach((block) => {
      if (block.type === "ungrouped") {
        if (!lastBlockWasUngrouped) {
          htmlParts.push(`
            <div class="routine-preview-group">
              <div class="text-cyber-blue fw-bold">Sin grupo</div>
            </div>
          `);
          lastBlockWasUngrouped = true;
        }
        htmlParts.push(renderEntry(block.entry));
        return;
      }

      if (block.type === "group") {
        lastBlockWasUngrouped = false;
        const entries = groupEntries.get(block.id) || [];
        const meta = groupMetaMap.get(block.id) || { name: "Circuito", note: "" };
        if (entries.length) {
          htmlParts.push(`
            <div class="routine-preview-group">
              <div class="d-flex justify-content-between align-items-center">
                <div class="text-cyber-orange fw-bold">${meta.name}</div>
                <div class="text-secondary small">${entries.length} items</div>
              </div>
              ${meta.note ? `<div class="text-secondary small mt-1">"${meta.note}"</div>` : ""}
            </div>
          `);
          entries.forEach((entry) => {
            htmlParts.push(renderEntry(entry));
          });
        }
        return;
      }

      if (block.type === "inline_group") {
        lastBlockWasUngrouped = false;
        const item = block.item;
        const entries = (item.items || []).filter((sub) => isExerciseItem(sub) || isRestItem(sub));
        if (entries.length) {
          htmlParts.push(`
            <div class="routine-preview-group">
              <div class="d-flex justify-content-between align-items-center">
                <div class="text-cyber-orange fw-bold">${item.group_name || item.name || "Circuito"}</div>
                <div class="text-secondary small">${entries.length} items</div>
              </div>
              ${(item.note || item.description) ? `<div class="text-secondary small mt-1">"${item.note || item.description}"</div>` : ""}
            </div>
          `);
          entries.forEach((entry) => {
            htmlParts.push(renderEntry(entry));
          });
        }
      }
    });

    return htmlParts.join("") || '<div class="text-secondary small">Sin ejercicios.</div>';
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
      const res = await fetch(isAdminBuilder ? "/workout/api/my-routines?all=1" : "/workout/api/my-routines");
      const data = await res.json();
      state.routines = Array.isArray(data) ? data : [];
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
        };
      }
      const exerciseId = item.exercise_id || item._id || item.id;
      const lookupExercise = exerciseLookup[exerciseId] || {};
      return {
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
      };
    });
  };

  const loadRoutineById = async (id, options) => {
    if (!id) return;
    try {
      const res = await fetch(isAdminBuilder ? `/workout/api/my-routines/${id}?all=1` : `/workout/api/my-routines/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      normalizeRoutine(data, options);
      applyRoutineToForm(state.routine);
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
      if (state.step === 2 && state.routine.items.filter((i) => i.item_type === "exercise").length === 0) {
        showMessage("Agrega al menos un ejercicio.", "warning");
        return;
      }
      if (state.step === 3) {
        updateReview();
      }
      setStep(Math.min(4, state.step + 1));
      openProgressModalIfMobile();
    });

    document.getElementById("guidedPrevBtn")?.addEventListener("click", () => {
      clearMessage();
      setStep(Math.max(1, state.step - 1));
      openProgressModalIfMobile();
    });

    document.getElementById("guidedCancelBtn")?.addEventListener("click", () => {
      if (confirm("Cancelar y limpiar la rutina?")) {
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
      try {
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

    document.getElementById("guidedExerciseList")?.addEventListener("click", (event) => {
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
      if (!confirmRemove(`Eliminar ejercicio: ${item.exercise_name || "Ejercicio"}?`)) return;
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
          } else {
            state.routine.items[idx].target_reps = 10;
          }
          renderConfigList();
          return;
        }
        if (exactInput) {
          exactInput.disabled = true;
          exactInput.style.display = "none";
        }
        state.routine.items[idx].target_reps = value;
        return;
      }

      if (field === "target_reps_exact") {
        state.routine.items[idx].target_reps = value;
        return;
      }

      const parsedValue = field.includes("sets") || field.includes("seconds") ? Number(value) : value;
      state.routine.items[idx][field] = parsedValue;
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
    });

    document.getElementById("guidedConfigList")?.addEventListener("click", async (event) => {
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
        if (!confirmRemove("Eliminar grupo y sus elementos?")) return;
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
      if (!confirmRemove(message)) return;
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
      const name = document.getElementById("guidedGroupName").value.trim();
      const type = document.getElementById("guidedGroupType").value;
      const note = document.getElementById("guidedGroupNote").value.trim();
      addGroup(name, type, note);
      document.getElementById("guidedGroupName").value = "";
      document.getElementById("guidedGroupNote").value = "";
      bootstrap.Modal.getOrCreateInstance(document.getElementById("guidedGroupModal")).hide();
    });

    document.getElementById("guidedAddRestBtn")?.addEventListener("click", () => {
      const restSelect = document.getElementById("guidedRestSeconds");
      if (restSelect && restSelect.options.length === 0) {
        restSelect.innerHTML = REST_OPTIONS.map((opt) => `<option value="${opt}">${opt}s</option>`).join("");
      }
      const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("guidedRestModal"));
      modal.show();
    });

    document.getElementById("guidedRestSave")?.addEventListener("click", () => {
      const groupId = document.getElementById("guidedRestGroup").value;
      const seconds = document.getElementById("guidedRestSeconds").value;
      const note = document.getElementById("guidedRestNote").value.trim();
      addRest(groupId, seconds, note);
      document.getElementById("guidedRestNote").value = "";
      bootstrap.Modal.getOrCreateInstance(document.getElementById("guidedRestModal")).hide();
    });

    document.getElementById("guidedRoutineList")?.addEventListener("click", (event) => {
      const loadBtn = event.target.closest("[data-load]");
      if (loadBtn) {
        loadRoutineById(loadBtn.dataset.load, { duplicate: false });
        collapseRoutineList();
        return;
      }
      const dupBtn = event.target.closest("[data-dup]");
      if (dupBtn) {
        loadRoutineById(dupBtn.dataset.dup, { duplicate: true });
        collapseRoutineList();
      }
    });

    document.getElementById("guidedRoutineSearch")?.addEventListener("input", renderRoutineList);
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
      addExercise(byId || { _id: picked.id, name: picked.name, body_part: picked.body_part }, pendingAddGroupId);
      pendingAddGroupId = "";
      const nameInput = document.getElementById("guidedExerciseName");
      if (nameInput) nameInput.value = picked.name || "";
      closeExerciseModal();
    }
  });

  document.addEventListener("DOMContentLoaded", init);
})();
