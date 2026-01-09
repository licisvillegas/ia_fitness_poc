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
    const res = await fetch("/workout/api/exercises");
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

    assignedList.forEach((r) => {
      if (r && r._id) window.routinesMap.set(r._id, r);
      const cardCol = document.createElement("div");
      cardCol.className = "col-md-6 col-lg-4";

      const name = r.name || "Rutina sin nombre";
      const exCount = window.countExercises(r);
      const id = r._id;
      const partsLabel = window.getRoutineBodyPartsLabel(r);
      const dayLabel = r.routine_day ? window.translateDay(r.routine_day) : "Sin dia";
      const validity = r.assigned_expires_at ? window.formatDate(r.assigned_expires_at) : null;

      cardCol.innerHTML = `
          <div class="card h-100 bg-panel border-secondary shadow-sm">
            <div class="card-body p-3">
              <div class="d-flex justify-content-between align-items-start mb-2">
                <div class="flex-grow-1">
                  <h5 class="card-title text-white fw-bold mb-1 text-truncate" title="${name}">${name}</h5>
                  <div class="d-flex flex-wrap gap-1 mb-1">
                    <span class="badge bg-secondary" style="font-size: 0.7rem;">${partsLabel}</span>
                    <span class="badge bg-dark border border-secondary text-info" style="font-size: 0.7rem;">${dayLabel}</span>
                  </div>
                </div>
                <span class="badge bg-dark border border-secondary text-info ms-2" style="font-size: 0.65rem;">
                  ${exCount} ej.
                </span>
              </div>
              <p class="card-text text-secondary small text-truncate mb-3">${r.description || "Sin descripcion"}</p>
              <div class="d-flex justify-content-between align-items-center border-top border-secondary pt-2 mt-2">
                <small class="text-muted text-uppercase fw-bold" style="font-size:0.65rem;">
                  ${validity ? `Vence: ${validity}` : "Vence: -"}
                </small>
                <div class="btn-group btn-group-sm">
                  <button class="btn btn-outline-info" onclick="openRoutineModal('${id}')" title="Ver detalle">
                    <i class="fas fa-eye"></i>
                  </button>
                  <a href="/workout/run/${id}?return_to=${encodeURIComponent(returnTo)}" class="btn btn-outline-primary" title="Iniciar">
                    <i class="fas fa-play"></i>
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
    const name = item.exercise_name || item.name || "Ejercicio";
    const bodyPartLabel = window.translateBodyPart(item.body_part);
    const sets = item.target_sets || item.sets || 1;
    const reps = item.target_reps || item.reps || "-";
    const time = item.target_time_seconds || item.time_seconds || 60;
    const isTime = (item.exercise_type || item.type) === "time" || (item.exercise_type || item.type) === "cardio";
    const rest = window.getRestSeconds(item);
    const equipmentMeta = window.getEquipmentMeta(item.equipment);
    const hasVideo = item.video_url && item.video_url.trim() !== "";
    const substitutes = window.resolveSubstitutes(item.substitutes || []);
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
        ${substitutes.length
        ? `
            <button class="btn btn-sm btn-outline-info mt-2" type="button" data-bs-toggle="collapse" data-bs-target="#${subsId}">Sustitutos (${substitutes.length})</button>
            <div class="collapse mt-2" id="${subsId}">
              <div class="d-flex flex-column gap-2">
                ${substitutes
          .map(
            (sub) => `<div class="routine-preview-item d-flex align-items-center justify-content-between">
                      <div>
                        <div class="fw-bold text-white">${sub.name || "Ejercicio"}</div>
                        <div class="text-secondary small"><i class="${window.getEquipmentMeta(sub.equipment).icon} me-1"></i>${window.getEquipmentMeta(sub.equipment).label}</div>
                      </div>
                      ${sub.video_url
                ? `<button class="btn btn-sm btn-outline-danger" onclick="openVideoModal('${sub.video_url}')"><i class="fab fa-youtube"></i></button>`
                : ""
              }
                    </div>`
          )
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
      if (typeof sub === "string") return window.exerciseLookup[sub];
      if (sub && typeof sub === "object") return sub;
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
