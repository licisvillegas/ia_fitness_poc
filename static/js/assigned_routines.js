window.routinesMap = window.routinesMap || new Map();
window.bodyPartMap = window.bodyPartMap || {};
window.exerciseLookup = window.exerciseLookup || {};

let routineDepsPromise = null;

window.loadBodyParts = async function loadBodyParts() {
  try {
    const res = await fetch("/workout/api/body-parts");
    const parts = await res.json();
    parts.forEach((p) => {
      window.bodyPartMap[p.key] = p.label_es || p.label_en || p.key;
    });
  } catch (e) {
    console.error("Error loading body parts", e);
  }
};

window.loadExercises = async function loadExercises() {
  try {
    const res = await fetch("/workout/api/exercises?limit=1000");
    const data = await res.json();
    if (Array.isArray(data)) {
      window.exerciseLookup = data.reduce((acc, ex) => {
        if (ex && ex._id) acc[ex._id] = ex;
        return acc;
      }, {});
    }
  } catch (e) {
    console.error("Error loading exercises", e);
  }
};

window.ensureRoutineDependencies = async function ensureRoutineDependencies() {
  if (!routineDepsPromise) {
    routineDepsPromise = (async () => {
      await window.loadBodyParts();
      await window.loadExercises();
    })();
  }
  return routineDepsPromise;
};

window.translateDay = function translateDay(eng) {
  const map = {
    Monday: "Lunes",
    Tuesday: "Martes",
    Wednesday: "Miercoles",
    Thursday: "Jueves",
    Friday: "Viernes",
    Saturday: "Sabado",
    Sunday: "Domingo",
  };
  return map[eng] || eng;
};

window.translateBodyPart = function translateBodyPart(bp) {
  return window.bodyPartMap[bp] || bp;
};

window.getRoutineBodyPartsLabel = function getRoutineBodyPartsLabel(routine) {
  const parts = Array.isArray(routine.routine_body_parts) ? routine.routine_body_parts : [];
  if (parts.length === 0) return "N/A";
  return parts.map((p) => window.translateBodyPart(p)).join(", ");
};

window.countExercises = function countExercises(routine) {
  const items = Array.isArray(routine.items) ? routine.items : [];
  const hasInlineGroups = items.some((item) => Array.isArray(item.items));
  if (hasInlineGroups) {
    let total = 0;
    items.forEach((item) => {
      if (item.item_type === "group" || Array.isArray(item.items)) {
        const groupItems = Array.isArray(item.items) ? item.items : [];
        total += groupItems.filter((entry) => entry && entry.item_type !== "rest").length;
      } else if (item.item_type === "exercise") {
        total += 1;
      }
    });
    return total;
  }
  return items.filter((item) => item && item.item_type === "exercise").length;
};

window.loadRoutines = async function loadRoutines(userId, options) {
  const listEl = document.getElementById("routines-list");
  const sectionEl = document.getElementById("my-routines");
  const returnTo = (options && options.returnTo) || "/dashboard";

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
    const routines = await res.json();
    const assignedList = Array.isArray(routines) ? routines : [];

    listEl.innerHTML = "";

    if (assignedList.length === 0) {
      listEl.innerHTML =
        '<div class="col-12 text-muted text-center py-3">No hay rutinas asignadas para este usuario.</div>';
      return;
    }

    const dayOrder = {
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
      Sunday: 7,
    };
    assignedList.sort((a, b) => {
      const da = dayOrder[a.routine_day] || 99;
      const db = dayOrder[b.routine_day] || 99;
      if (da !== db) return da - db;
      return (a.name || "").localeCompare(b.name || "");
    });

    const todayKey = new Date().toLocaleDateString("en-US", { weekday: "long" });

    assignedList.forEach((r) => {
      if (r && r._id) window.routinesMap.set(r._id, r);
      const cardCol = document.createElement("div");
      cardCol.className = "col-md-6 col-lg-4";

      const name = r.name || "Rutina sin nombre";
      const exCount = window.countExercises(r);
      const id = r._id;
      const partsLabel = window.getRoutineBodyPartsLabel(r);
      const dayLabel = r.routine_day ? window.translateDay(r.routine_day) : null;
      const isToday = r.routine_day && r.routine_day === todayKey;
      const validity = r.assigned_expires_at ? window.formatDate(r.assigned_expires_at) : null;

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
      listEl.appendChild(cardCol);
    });
  } catch (e) {
    console.error(e);
    listEl.innerHTML = '<div class="col-12 text-danger text-center">Error cargando rutinas.</div>';
  } finally {
    if (window.hideLoader) window.hideLoader();
  }
};

window.openRoutineModal = async function openRoutineModal(id) {
  const routine = window.routinesMap.get(id);
  if (!routine) return;

  const modalTitle = document.getElementById("routineModalTitle");
  const modalBody = document.getElementById("routineModalBody");

  const partsLabel = window.getRoutineBodyPartsLabel(routine);
  const exercises = window.countExercises(routine);
  const day = routine.routine_day ? window.translateDay(routine.routine_day) : "-";
  const validity = routine.assigned_expires_at ? window.formatDate(routine.assigned_expires_at) : "";

  modalTitle.textContent = routine.name || "Rutina";
  const previewHtml = window.buildRoutinePreviewHtml(routine);
  modalBody.innerHTML = `
    <div class="routine-preview-card">
      <div class="text-center mb-3">
        <div class="h3 fw-bold text-white mb-1">${routine.name || "Rutina"}</div>
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
          <div class="text-secondary small">Disponible hasta</div>
          <div class="text-white">${validity || "-"}</div>
        </div>
      </div>
      <div class="routine-preview-scroll d-flex flex-column gap-2">${previewHtml}</div>
    </div>
  `;

  new bootstrap.Modal(document.getElementById("routineModal")).show();
};

window.buildRoutinePreviewHtml = function buildRoutinePreviewHtml(routine) {
  const items = Array.isArray(routine.items) ? routine.items : [];
  const isRestItem = (item) =>
    item && (item.item_type === "rest" || (!item.exercise_id && item.rest_seconds != null));
  const isExerciseItem = (item) => item && item.item_type === "exercise";
  const isGroupHeader = (item) => item && item.item_type === "group";
  const safeId = (value) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "");
  const getExerciseId = (exercise) => {
    if (!exercise) return null;
    if (exercise.$oid || exercise.oid) return exercise.$oid || exercise.oid;
    return exercise.exercise_id || exercise._id || exercise.id || null;
  };

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
        blocks.push({ type: "inline_group", item: item });
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

  const htmlParts = [];
  const renderEntry = (item, idxKey) => {
    if (isRestItem(item)) {
      const restLabel = item.note || "Descanso";
      const restSeconds = window.getRestSeconds(item);
      return `<div class="routine-preview-item d-flex justify-content-between align-items-center">
        <div>
          <div class="text-white fw-bold">${restLabel}</div>
          <div class="text-secondary small">Pausa</div>
        </div>
        <div class="text-end text-secondary small">${restSeconds}s</div>
      </div>`;
    }
    const exId = getExerciseId(item.exercise_id) || getExerciseId(item);
    const baseExercise = exId ? window.exerciseLookup[String(exId)] : null;
    const ex = baseExercise ? { ...baseExercise, ...item } : item;
    ["substitutes", "equivalents", "equivalent_exercises"].forEach((field) => {
      const baseVal = baseExercise ? baseExercise[field] : null;
      const itemVal = item ? item[field] : null;
      if (Array.isArray(baseVal) && baseVal.length > 0) {
        if (!Array.isArray(itemVal) || itemVal.length === 0) {
          ex[field] = baseVal;
        }
      }
    });
    const name = ex.exercise_name || ex.name || "Ejercicio";
    const bodyPartLabel = window.translateBodyPart(ex.body_part);
    const sets = ex.target_sets || ex.sets || 1;
    const reps = ex.target_reps || ex.reps || "-";
    const time = ex.target_time_seconds || ex.time_seconds || 60;
    const isTime = (ex.exercise_type || ex.type) === "time" || (ex.exercise_type || ex.type) === "cardio";
    const rest = window.getRestSeconds(ex);
    const equipmentMeta = window.getEquipmentMeta(ex.equipment);
    const hasVideo = ex.video_url && ex.video_url.trim() !== "";
    const substitutes = window.resolveSubstitutes(ex.substitutes || ex.equivalents || ex.equivalent_exercises || []);
    const subsId = `subs_${safeId(routine._id)}_${idxKey}`;

    return `<div class="routine-preview-item d-flex justify-content-between align-items-start">
      <div>
        <div class="d-flex align-items-center gap-2">
          <div class="text-white fw-bold">${name}</div>
          ${hasVideo
        ? `<button class="btn btn-sm btn-outline-danger" onclick="openVideoModal('${item.video_url}')"><i class="fab fa-youtube"></i></button>`
        : ""
      }
        </div>
        <div class="d-flex flex-wrap gap-2 mt-1">
          <span class="badge bg-secondary">${bodyPartLabel}</span>
          <span class="badge bg-dark border border-secondary text-info"><i class="${equipmentMeta.icon} me-1"></i>${equipmentMeta.label}</span>
        </div>
        ${(() => {
        if (exId && !baseExercise) {
          console.warn("Exercise lookup failed for ID:", exId, "Item:", item);
        }
        return substitutes.length
      })()
        ? `
            <button class="btn btn-sm btn-outline-info mt-2" type="button" data-bs-toggle="collapse" data-bs-target="#${subsId}">Sustitutos (${substitutes.length})</button>
            <div class="collapse mt-2" id="${subsId}">
              <div class="d-flex flex-column gap-2">
                ${substitutes
          .map((sub) => {
            const hasSubVideo = sub.video_url && sub.video_url.trim().length > 0;
            const subVideoBtn = hasSubVideo
              ? `<button class="btn btn-sm btn-outline-danger" onclick="event.preventDefault(); event.stopPropagation(); openVideoModal('${sub.video_url}')" title="Ver video"><i class="fas fa-play"></i></button>`
              : "";

            return `<div class="p-3 mb-2 bg-dark border border-secondary rounded shadow-sm">
                      <div class="d-flex justify-content-between align-items-center">
                        <div>
                           <div class="text-white fw-bold mb-1">${sub.name || "Ejercicio"}</div>
                           <div class="d-flex flex-wrap gap-2">
                                <span class="badge bg-secondary text-light" style="font-size:0.65rem"><i class="${window.getEquipmentMeta(sub.equipment).icon} me-1"></i>${window.getEquipmentMeta(sub.equipment).label}</span>
                                <span class="badge bg-transparent border border-secondary text-secondary" style="font-size:0.65rem">${window.translateBodyPart(sub.body_part) || "General"}</span>
                           </div>
                        </div>
                        <div class="ms-3">
                            ${subVideoBtn}
                        </div>
                      </div>
                    </div>`;
          })
          .join("")}
              </div>
            </div>`
        : ""
      }
      </div>
      <div class="text-end text-secondary small">
        <div>${sets} sets ${isTime ? `x ${time}s` : `x ${reps}`}</div>
        <div>Descanso ${rest}s</div>
      </div>
    </div>`;
  };

  let lastBlockWasUngrouped = false;
  blocks.forEach((block, bIdx) => {
    if (block.type === "ungrouped") {
      if (!lastBlockWasUngrouped) {
        htmlParts.push('<div class="routine-preview-group"><div class="text-cyber-blue fw-bold">Sin grupo</div></div>');
        lastBlockWasUngrouped = true;
      }
      htmlParts.push(renderEntry(block.entry, `u_${bIdx}`));
    } else if (block.type === "group") {
      lastBlockWasUngrouped = false;
      const entries = groupEntries.get(block.id) || [];
      const meta = groupMetaMap.get(block.id) || { name: "Circuito", note: "" };
      if (entries.length > 0) {
        htmlParts.push(
          `<div class="routine-preview-group"><div class="d-flex justify-content-between align-items-center"><div class="text-cyber-orange fw-bold">${meta.name}</div><div class="text-secondary small">${entries.length} items</div></div>${meta.note ? `<div class="text-secondary small mt-1">"${meta.note}"</div>` : ""
          }</div>`
        );
        entries.forEach((entry, eIdx) => {
          htmlParts.push(renderEntry(entry, `g_${block.id}_${eIdx}`));
        });
      }
    } else if (block.type === "inline_group") {
      lastBlockWasUngrouped = false;
      const item = block.item;
      const entries = (item.items || []).filter((sub) => isExerciseItem(sub) || isRestItem(sub));
      if (entries.length > 0) {
        htmlParts.push(
          `<div class="routine-preview-group"><div class="d-flex justify-content-between align-items-center"><div class="text-cyber-orange fw-bold">${item.group_name || item.name || "Circuito"
          }</div><div class="text-secondary small">${entries.length} items</div></div>${item.note || item.description ? `<div class="text-secondary small mt-1">"${item.note || item.description}"</div>` : ""
          }</div>`
        );
        entries.forEach((entry, eIdx) => {
          htmlParts.push(renderEntry(entry, `ig_${bIdx}_${eIdx}`));
        });
      }
    }
  });
  return htmlParts.join("");
};

window.resolveSubstitutes = function resolveSubstitutes(substitutes) {
  if (!Array.isArray(substitutes) || substitutes.length === 0) return [];
  return substitutes
    .map((sub) => {
      if (typeof sub === "string" || typeof sub === "number") {
        return window.exerciseLookup[String(sub)] || null;
      }
      if (sub && typeof sub === "object") {
        const oid = sub.$oid || sub.oid;
        if (oid) return window.exerciseLookup[String(oid)] || null;
        const subId = sub._id || sub.exercise_id || sub.id;
        if (subId != null) return window.exerciseLookup[String(subId)] || sub;
        return sub;
      }
      return null;
    })
    .filter(Boolean);
};

window.getEquipmentMeta = function getEquipmentMeta(equipmentKey) {
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

window.toEmbedUrl = function toEmbedUrl(url) {
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

window.openVideoModal = function openVideoModal(url) {
  const modalEl = document.getElementById("videoModal");
  const iframe = document.getElementById("videoFrame");
  const embedUrl = window.toEmbedUrl(url);
  if (!embedUrl) return;
  iframe.src = embedUrl;
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
  modalEl.addEventListener(
    "hidden.bs.modal",
    () => {
      iframe.src = "";
    },
    { once: true }
  );
};

window.formatDate = function formatDate(value) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString();
};

window.getRestSeconds = function getRestSeconds(item) {
  if (!item) return 60;
  if (item.rest_seconds != null) return item.rest_seconds;
  return 60;
};

window.loadCreatedRoutines = async function loadCreatedRoutines(options) {
  const listEl = document.getElementById("created-routines-list");
  const sectionEl = document.getElementById("my-created-routines");
  const returnTo = (options && options.returnTo) || "/dashboard";
  const userId = (options && options.userId) || window.currentUserId;

  if (!listEl || !sectionEl) return;
  if (!userId) {
    listEl.innerHTML =
      '<div class="col-12 text-muted text-center py-3">Selecciona un usuario para ver rutinas creadas.</div>';
    sectionEl.style.display = "block";
    return;
  }

  listEl.innerHTML = '<div class="col-12 text-center py-3"><div class="spinner-border text-primary" role="status"></div></div>';
  sectionEl.style.display = "block";

  try {
    await window.ensureRoutineDependencies();
    const queryParts = [];
    if (userId) queryParts.push(`user_id=${encodeURIComponent(userId)}`);
    queryParts.push("active_only=1");
    const query = queryParts.length ? `?${queryParts.join("&")}` : "";
    const res = await fetch(`/workout/api/my-routines${query}`);
    const routines = await res.json();
    listEl.innerHTML = "";

    if (!Array.isArray(routines) || routines.length === 0) {
      listEl.innerHTML = '<div class="col-12 text-muted text-center py-3">No tienes rutinas creadas aún.</div>';
      return;
    }

    routines.forEach((r) => {
      if (r && r._id) window.routinesMap.set(r._id, r);
      const cardCol = document.createElement("div");
      cardCol.className = "col-md-6 col-lg-4";

      const name = r.name || "Rutina sin nombre";
      const exCount = window.countExercises(r);
      const id = r._id;
      const partsLabel = window.getRoutineBodyPartsLabel(r);
      const dayLabel = r.routine_day ? window.translateDay(r.routine_day) : null;

      cardCol.innerHTML = `
          <div class="card h-100 bg-panel border-secondary shadow-sm">
            <div class="card-body p-3">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div class="flex-grow-1">
                  <h5 class="card-title text-theme fw-bold mb-1 text-truncate" title="${name}">${name}</h5>
                  <div class="d-flex flex-wrap gap-1 mb-1">
                    <span class="badge bg-secondary" style="font-size: 0.7rem;">${partsLabel}</span>
                    ${dayLabel ? `<span class="badge bg-secondary border border-secondary text-info" style="font-size: 0.7rem;">${dayLabel}</span>` : ""}
                  </div>
                </div>
                <span class="badge bg-secondary border border-secondary text-info ms-2" style="font-size: 0.65rem;">
                  ${exCount} ej.
                </span>
              </div>
              <p class="card-text text-secondary small text-truncate mb-3">${r.description || "Sin descripción"}</p>
              <div class="d-flex justify-content-between align-items-center border-top border-secondary pt-2 mt-2">
                <small class="text-muted text-uppercase fw-bold" style="font-size:0.65rem;">Mi rutina</small>
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
      listEl.appendChild(cardCol);
    });
  } catch (e) {
    console.error("Error loading created routines:", e);
    listEl.innerHTML = '<div class="col-12 text-danger text-center">Error cargando rutinas creadas.</div>';
  }
};
