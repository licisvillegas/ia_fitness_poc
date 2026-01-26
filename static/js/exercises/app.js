console.log("SCRIPT START - User Unified View");
    const urlParams = new URLSearchParams(window.location.search);
    const bootstrapData = window.__EXERCISES__ || {};
    // Security: Only enable admin mode if URL param requests it AND Server confirms admin role
    const serverIsAdmin = !!bootstrapData.serverIsAdmin;
    const isAdmin = (urlParams.get('admin') === 'true') && serverIsAdmin;
    const isEmbed = !!bootstrapData.isEmbed;

    const { pageSize, equipmentMeta: EQUIPMENT_META, typeMeta: TYPE_META, muscleIcons } = window.ExercisesConsts;
    const Utils = window.ExercisesUtils;

    let currentView = localStorage.getItem('exercises_view_mode') || 'grid';
    let allExercises = []; // Current page items
    let exerciseLookup = {};
    let exerciseLookupByName = {};
    let currentPage = 1;
    let totalItems = 0;
    let searchTimer = null;
    let bodyPartMap = {};

    // Admin helpers
    let currentExerciseId = null;
    let currentBodyPartForEdit = null;

    let messageModalInstance = null;
    let fullExerciseCatalog = [];
    let fullCatalogLoaded = false;

    async function loadMetadata() {
        try {
            const res = await fetch("/workout/api/exercises/metadata");
            const data = await res.json();

            // Populate Equipment
            if (data.equipment && Array.isArray(data.equipment)) {
                const sel = document.getElementById("filterEquipment");
                const currentVal = sel.value;
                sel.innerHTML = '<option value="">Equipo</option>';

                data.equipment.forEach(val => {
                    if (!val) return;
                    const meta = EQUIPMENT_META[val.toLowerCase()];
                    const label = meta ? meta.label : Utils.capitalize(val);
                    const opt = document.createElement("option");
                    opt.value = val;
                    opt.textContent = label;
                    sel.appendChild(opt);
                });
                // Attempt to restore selection if valid
                sel.value = currentVal;
            }

            // Populate Types
            if (data.types && Array.isArray(data.types)) {
                const sel = document.getElementById("filterType");
                const currentVal = sel.value;
                sel.innerHTML = '<option value="">Tipo</option>';

                data.types.forEach(val => {
                    if (!val) return;
                    const label = TYPE_META[val.toLowerCase()] || Utils.capitalize(val);
                    const opt = document.createElement("option");
                    opt.value = val;
                    opt.textContent = label;
                    sel.appendChild(opt);
                });
                sel.value = currentVal;
            }

        } catch (e) {
            console.error("Error loading metadata", e);
        }
    }
    function switchView(mode) {
        currentView = mode;
        localStorage.setItem('exercises_view_mode', mode);
        updateViewUI();
    }

    function updateViewUI() {
        const gridContainer = document.getElementById('viewGridContainer');
        const listContainer = document.getElementById('viewListContainer');
        const btnGrid = document.getElementById('btnViewGrid');
        const btnList = document.getElementById('btnViewList');

        if (currentView === 'grid') {
            gridContainer.classList.remove('d-none');
            listContainer.classList.add('d-none');
            btnGrid.classList.add('active');
            btnList.classList.remove('active');
        } else {
            gridContainer.classList.add('d-none');
            listContainer.classList.remove('d-none');
            btnGrid.classList.remove('active');
            btnList.classList.add('active');
        }
    }

    async function sendSelection(idOrObj) {
        let ex = idOrObj;
        if (typeof idOrObj === 'string') {
            ex = exerciseLookup[idOrObj] || allExercises.find(e => e._id === idOrObj);
        }

        if (!ex) {
            console.error("Exercise not found for selection:", idOrObj);
            return;
        }

        const name = ex.name || "este ejercicio";
        const message = `¿Deseas seleccionar "${name}"?`;

        let ok = false;
        if (window.showConfirmModal) {
            ok = await window.showConfirmModal("Confirmar ejercicio", message, "success");
        } else {
            ok = confirm(message);
        }

        if (!ok) return;

        if (window.parent) {
            window.parent.postMessage({
                type: "rm-exercise-select",
                exercise: {
                    name: ex.name,
                    id: ex._id,
                    body_part: ex.body_part,
                    type: ex.type
                }
            }, "*");
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (isAdmin) {
            document.getElementById("btnNewExercise").classList.remove("d-none");
            document.querySelectorAll(".admin-col").forEach(el => el.classList.remove("d-none"));
        }

        updateViewUI();
        loadBodyParts().then(() => {
            renderMuscleIcons();
        });
        loadMetadata().then(() => {
            loadExercisesPage(1);
        });

        // Listeners for filters
        document.getElementById("mainSearch").addEventListener("input", scheduleSearch);

        document.getElementById("filterSection").addEventListener("change", (e) => {
            updateGroupOptions(e.target.value);
            loadExercisesPage(1);
        });
        document.getElementById("filterGroup").addEventListener("change", (e) => {
            updateMuscleOptions(document.getElementById("filterSection").value, e.target.value);
            loadExercisesPage(1);
        });
        document.getElementById("filterMuscle").addEventListener("change", () => loadExercisesPage(1));

        document.getElementById("filterEquipment").addEventListener("change", () => loadExercisesPage(1));
        document.getElementById("filterType").addEventListener("change", () => loadExercisesPage(1));

        document.getElementById("prevPageBtn").addEventListener("click", () => loadExercisesPage(currentPage - 1));
        document.getElementById("nextPageBtn").addEventListener("click", () => loadExercisesPage(currentPage + 1));

        // Admin listeners 
        const subSearch = document.getElementById("subSearch");
        if (subSearch) {
            subSearch.addEventListener("input", () => {
                // search local items for substitutes
                populateSubstitutes(allExercises, currentExerciseId, getSelectedSubstitutes());
            });
        }
    });

    let taxonomyData = [];

    async function loadBodyParts() {
        try {
            const res = await fetch("/workout/api/taxonomy");
            taxonomyData = await res.json();

            const sectionSel = document.getElementById("filterSection");
            sectionSel.innerHTML = '<option value="">Sección...</option>';

            taxonomyData.forEach(sect => {
                const opt = document.createElement("option");
                opt.value = sect.id;
                opt.textContent = sect.name;
                sectionSel.appendChild(opt);
            });

        } catch (e) {
            console.error("Error loading taxonomy", e);
        }
    }

    function updateGroupOptions(sectionId) {
        const groupSel = document.getElementById("filterGroup");
        const muscleSel = document.getElementById("filterMuscle");

        groupSel.innerHTML = '<option value="">Grupo...</option>';
        muscleSel.innerHTML = '<option value="">Músculo...</option>';
        groupSel.disabled = !sectionId;
        muscleSel.disabled = true;

        if (!sectionId) return;

        const section = taxonomyData.find(s => s.id === sectionId);
        if (section && section.groups) {
            section.groups.forEach(g => {
                const opt = document.createElement("option");
                opt.value = g.id;
                opt.textContent = g.name;
                groupSel.appendChild(opt);
            });
        }
    }

    function updateMuscleOptions(sectionId, groupId) {
        const muscleSel = document.getElementById("filterMuscle");
        muscleSel.innerHTML = '<option value="">Músculo...</option>';
        muscleSel.disabled = !groupId;

        if (!sectionId || !groupId) return;

        const section = taxonomyData.find(s => s.id === sectionId);
        if (section) {
            const group = section.groups.find(g => g.id === groupId);
            if (group && group.muscles) {
                group.muscles.forEach(m => {
                    const opt = document.createElement("option");
                    opt.value = m.id;
                    opt.textContent = m.name;
                    muscleSel.appendChild(opt);
                });
            }
        }
    }

    function buildQueryParams(page) {
        const term = document.getElementById("mainSearch").value.trim();
        const section = document.getElementById("filterSection").value;
        const group = document.getElementById("filterGroup").value;
        const muscle = document.getElementById("filterMuscle").value;
        const equipment = document.getElementById("filterEquipment").value;
        const type = document.getElementById("filterType").value;

        const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
        if (term) params.set("q", term);
        if (section) params.set("section", section);
        if (group) params.set("group", group);
        if (muscle) params.set("muscle", muscle);
        if (equipment) params.set("equipment", equipment);
        if (type) params.set("type", type);
        return params;
    }

    function scheduleSearch() {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => loadExercisesPage(1), 300);
    }

    function addToLookup(ex) {
        if (!ex) return;
        const rawId = ex._id && typeof ex._id === "object" ? (ex._id.$oid || ex._id.oid || ex._id.id) : ex._id;
        const idValue = rawId != null ? String(rawId) : null;
        if (idValue) exerciseLookup[idValue] = ex;
        if (ex.exercise_id) exerciseLookup[String(ex.exercise_id)] = ex;
        const nameKey = (ex.name || ex.exercise_name || "").trim().toLowerCase();
        if (nameKey) exerciseLookupByName[nameKey] = ex;
    }

    async function loadExercisesPage(page = currentPage) {
        const loader = document.getElementById("loader");
        const emptyMsg = document.getElementById("emptyMsg");
        const gridEl = document.getElementById("viewGridContainer");
        const tbody = document.getElementById("exercisesListBody");

        loader.classList.remove("d-none");
        emptyMsg.classList.add("d-none");
        gridEl.innerHTML = "";
        tbody.innerHTML = "";

        try {
            const params = buildQueryParams(page);
            const res = await fetch(`/workout/api/exercises/search?${params}`);
            const data = await res.json();

            currentPage = data.page || 1;
            totalItems = data.total || 0;
            const items = data.items || [];
            allExercises = items;

            items.forEach(addToLookup);

            if (items.length === 0) {
                emptyMsg.classList.remove("d-none");
            } else {
                renderGrid(items);
                renderList(items);
            }
            updatePagination();

        } catch (e) {
            console.error(e);
            emptyMsg.classList.remove("d-none");
            emptyMsg.textContent = "Error al cargar ejercicios.";
        } finally {
            loader.classList.add("d-none");
        }
    }

    function updatePagination() {
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        document.getElementById("pageInfo").textContent = `Página ${currentPage} de ${totalPages} (${totalItems})`;
        document.getElementById("prevPageBtn").disabled = currentPage <= 1;
        document.getElementById("nextPageBtn").disabled = currentPage >= totalPages;
    }

    function resolveImage(ex) {
        if (ex.image_url && ex.image_url.trim()) return ex.image_url;
        if (ex.thumbnail_url && ex.thumbnail_url.trim()) return ex.thumbnail_url;
        if (ex.image && ex.image.trim()) return ex.image;
        if (ex.img && ex.img.trim()) return ex.img;
        return "/static/images/gym.png";
    }

    function renderGrid(items) {
        const container = document.getElementById("viewGridContainer");
        items.forEach(ex => {
            const img = resolveImage(ex);
            const hasVideo = ex.video_url && ex.video_url.trim();
            const bodyPartLabel = bodyPartMap[ex.body_part_key] || bodyPartMap[ex.body_part] || ex.body_part;

            const adminHtml = isAdmin ? `
                <div class="admin-actions d-flex gap-1" onclick="event.stopPropagation()">
                    <button class="btn btn-sm btn-warning" onclick="duplicateExercise('${ex._id}')"><i class="fas fa-copy"></i></button>
                    <button class="btn btn-sm btn-info" onclick="openExerciseModal('${ex._id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="deleteExercise('${ex._id}')"><i class="fas fa-trash"></i></button>
                </div>
            ` : '';

            const col = document.createElement("div");
            col.className = "col-sm-6 col-md-4 col-lg-3";
            const clickAction = isEmbed ? `sendSelection('${ex._id}')` : `openExerciseDetails('${ex._id}')`;
            const selectableClass = isEmbed ? 'rm-selectable' : '';

            col.innerHTML = `
                <div class="exercise-grid-card position-relative ${selectableClass}" onclick="${clickAction}">
                    ${hasVideo ? `
                    <button class="btn btn-sm btn-danger rounded-circle position-absolute top-0 end-0 m-2 shadow" 
                            onclick="event.stopPropagation(); openVideoModal('${ex.video_url}')" title="Ver Video" style="z-index:2">
                        <i class="fas fa-play"></i>
                    </button>` : ''}
                    
                    ${adminHtml}

                    <img src="${img}" class="exercise-grid-img" alt="${ex.name}">
                    <div class="card-body p-3">
                        <h6 class="fw-bold text-white text-truncate mb-1" title="${ex.name}">${ex.name}</h6>
                        <div class="d-flex gap-1 mb-2">
                             <span class="badge bg-secondary" style="font-size: 0.65rem;">${bodyPartLabel}</span>
                             <span class="badge bg-dark border border-secondary text-info" style="font-size: 0.65rem;">${ex.type || 'N/A'}</span>
                        </div>
                        <p class="small text-muted text-truncate mb-0">${ex.description || 'Sin descripción'}</p>
                    </div>
                </div>
            `;
            container.appendChild(col);
        });
    }

    function renderList(items) {
        const tbody = document.getElementById("exercisesListBody");
        const mobileContainer = document.getElementById("mobileExercisesList");

        tbody.innerHTML = "";
        if (mobileContainer) mobileContainer.innerHTML = "";

        items.forEach(ex => {
            const bodyPartLabel = bodyPartMap[ex.body_part_key] || bodyPartMap[ex.body_part] || ex.body_part;
            const hasVideo = ex.video_url && ex.video_url.trim();

            /* DESKTOP ROW */
            const adminTd = isAdmin ? `
                <td onclick="event.stopPropagation()">
                   <div class="btn-group btn-group-sm">
                       <button class="btn btn-outline-warning" onclick="duplicateExercise('${ex._id}')"><i class="fas fa-copy"></i></button>
                       <button class="btn btn-outline-info" onclick="openExerciseModal('${ex._id}')"><i class="fas fa-edit"></i></button>
                       <button class="btn btn-outline-danger" onclick="deleteExercise('${ex._id}')"><i class="fas fa-trash"></i></button>
                   </div>
                </td>
            ` : `<td class="admin-col d-none"></td>`;

            const tr = document.createElement("tr");
            tr.style.cursor = "pointer";
            if (isEmbed) {
                tr.onclick = () => sendSelection(ex._id);
                tr.classList.add("rm-selectable");
            } else {
                tr.onclick = () => openExerciseDetails(ex._id);
            }
            tr.innerHTML = `
                <td>
                    <div class="fw-bold text-white">${ex.name}</div>
                    <small class="text-secondary text-truncate d-block" style="max-width: 200px;">${ex.description || ''}</small>
                </td>
                <td><span class="badge bg-secondary">${bodyPartLabel}</span></td>
                <td><small class="text-info">${ex.equipment || 'N/A'}</small></td>
                <td>${ex.type || 'N/A'}</td>
                <td>
                    ${hasVideo ? `<button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); openVideoModal('${ex.video_url}')"><i class="fab fa-youtube"></i></button>` : '-'}
                </td>
                <td>${ex.is_custom ? 'Custom' : 'Global'}</td>
                ${adminTd}
            `;
            tbody.appendChild(tr);

            /* MOBILE CARD */
            if (mobileContainer) {
                const card = document.createElement("div");
                card.className = "card bg-panel border-secondary shadow-sm";
                if (isEmbed) {
                    card.classList.add("rm-selectable");
                    card.onclick = () => sendSelection(ex._id);
                } else {
                    card.onclick = () => openExerciseDetails(ex._id);
                }

                const videoBtnMobile = hasVideo ? `<button class="btn btn-sm btn-outline-danger ms-2" onclick="event.stopPropagation(); openVideoModal('${ex.video_url}')"><i class="fab fa-youtube"></i></button>` : '';

                // Admin Buttons for Mobile
                const adminMobile = isAdmin ? `
                    <div class="d-flex justify-content-between align-items-center border-top border-secondary pt-2 mt-2" onclick="event.stopPropagation()">
                        <small class="text-muted text-uppercase fw-bold" style="font-size:0.7rem;">
                            <i class="fas fa-dumbbell me-1"></i> ${ex.type || 'N/A'}
                        </small>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-warning" onclick="duplicateExercise('${ex._id}')"><i class="fas fa-copy"></i></button>
                            <button class="btn btn-outline-info" onclick="openExerciseModal('${ex._id}')"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-outline-danger" onclick="deleteExercise('${ex._id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                ` : `
                    <div class="border-top border-secondary pt-2 mt-2">
                        <small class="text-muted text-uppercase fw-bold" style="font-size:0.7rem;">
                            <i class="fas fa-dumbbell me-1"></i> ${ex.type || 'N/A'}
                        </small>
                    </div>
                `;

                card.innerHTML = `
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div class="flex-grow-1">
                                <h5 class="card-title text-white fw-bold mb-1 d-flex align-items-center">
                                    ${ex.name}
                                    ${videoBtnMobile}
                                </h5>
                                <div class="d-flex flex-wrap gap-1 mb-1">
                                    <span class="badge bg-secondary" style="font-size: 0.7rem;">${bodyPartLabel}</span>
                                    <span class="badge bg-dark border border-secondary text-info" style="font-size: 0.7rem;">${Utils.getEquipmentLabels(ex.equipment).join(', ') || 'N/A'}</span>
                                </div>
                            </div>
                            <span class="badge ${ex.is_custom ? 'bg-info text-dark' : 'bg-secondary'} ms-2" style="font-size: 0.65rem;">
                                ${ex.is_custom ? 'CUSTOM' : 'GLOBAL'}
                            </span>
                        </div>
                        <p class="card-text text-secondary small text-truncate mb-3">${ex.description || 'Sin descripción'}</p>
                        ${adminMobile}
                    </div>
                `;
                mobileContainer.appendChild(card);
            }
        });

        if (isAdmin) {
            document.querySelectorAll(".admin-col").forEach(el => el.classList.remove("d-none"));
        }
    }

    function resetFilters() {
        document.getElementById("mainSearch").value = "";
        document.getElementById("filterSection").value = "";
        updateGroupOptions("");
        document.getElementById("filterEquipment").value = "";
        document.getElementById("filterType").value = "";
        document.querySelectorAll('.muscle-icon').forEach(el => el.classList.remove('active'));
        loadExercisesPage(1);
    }

    /* FULL CATALOG LOADER FOR ADMIN */
    async function ensureFullCatalog() {
        if (fullCatalogLoaded && fullExerciseCatalog.length > 0) return;
        try {
            const res = await fetch("/workout/api/exercises?limit=1000");
            const data = await res.json();
            if (Array.isArray(data)) {
                fullExerciseCatalog = data;
                data.forEach(addToLookup);
                fullCatalogLoaded = true;
                console.log("Full catalog loaded for admin:", data.length);
            }
        } catch (e) {
            console.error("Error loading full catalog", e);
        }
    }



    /* READ-ONLY DETAIL MODAL */
    async function openExerciseDetails(id) {
        // Fetch fresh details with populated substitutes
        let ex = exerciseLookup[id];
        try {
            const res = await fetch(`/workout/api/exercises/${id}`);
            if (res.ok) {
                ex = await res.json();
                // Update local lookup with fresh data
                addToLookup(ex);
            }
        } catch (e) {
            console.error("Error fetching detail:", e);
        }

        if (!ex) return;
        const titleEl = document.getElementById("exerciseDetailsTitle");
        const imgEl = document.getElementById("exerciseDetailsImage");
        const badgesEl = document.getElementById("exerciseDetailsBadges");
        const metaEl = document.getElementById("exerciseDetailsMeta");
        const descEl = document.getElementById("exerciseDetailsDesc");
        const subsEl = document.getElementById("exerciseDetailsSubs");
        const videoBtn = document.getElementById("exerciseDetailsVideoBtn");
        const editBtn = document.getElementById("detailsEditBtn");

        const primaryEquip = Utils.getPrimaryEquipment(ex.equipment);
        const equipMeta = EQUIPMENT_META[primaryEquip] || { label: Utils.getEquipmentLabels(ex.equipment).join(', ') || "N/A", icon: "fas fa-dumbbell" };

        // Use populated_substitutes from API if available, otherwise fallback to local resolution
        const substitutesList = ex.populated_substitutes || ex.substitutes || [];
        titleEl.textContent = ex.name || "Ejercicio";
        imgEl.src = resolveImage(ex);
        imgEl.alt = ex.name || "Ejercicio";
        if (descEl) descEl.textContent = ex.description || "Sin descripción disponible.";

        if (badgesEl) {
            badgesEl.innerHTML = `
                <span class="exercise-meta-pill"><i class="fas fa-dumbbell"></i>${bodyPartMap[ex.body_part] || ex.body_part || "General"}</span>
                <span class="exercise-meta-pill"><i class="${equipMeta.icon}"></i>${equipMeta.label}</span>
                <span class="exercise-meta-pill"><i class="fas fa-clipboard"></i>${ex.type || "N/A"}</span>
            `;
        }

        if (metaEl) {
            const altNames = Array.isArray(ex.alternative_names) ? ex.alternative_names : [];
            const items = [
                { label: "Patrón", value: ex.pattern },
                { label: "Plano", value: ex.plane },
                { label: "Unilateral", value: ex.unilateral ? "Si" : "No" },
                { label: "Músculo primario", value: ex.primary_muscle },
                { label: "Nivel", value: ex.level },
                { label: "Nombres alternativos", value: altNames.join(", ") }
            ].filter(item => item.value);
            if (items.length) {
                metaEl.innerHTML = items.map(item => `<div><strong class="text-light">${item.label}:</strong> ${item.value}</div>`).join("");
            } else {
                metaEl.innerHTML = "";
            }
        }

        if (subsEl) {
            // Prioritize the populated list from API
            const finalSubs = ex.populated_substitutes && ex.populated_substitutes.length > 0
                ? ex.populated_substitutes
                : (ex.substitutes || ex.equivalents || ex.equivalent_exercises || []);

            const resolved = finalSubs.map(sub => {
                // If we have a full object from API, use it directly
                if (sub && typeof sub === "object" && sub.name && !sub._fallback) return sub;

                // Fallback for legacy string IDs (if API didn't return populated)
                if (typeof sub === "string" || typeof sub === "number") {
                    const key = String(sub);
                    return exerciseLookup[key] || exerciseLookupByName[key.toLowerCase()] || { name: key, _fallback: true };
                }

                // If valid object but maybe missing key fields, pass through
                if (sub && typeof sub === "object") return sub;

                return null;
            }).filter(Boolean);

            if (resolved.length === 0) {
                subsEl.innerHTML = `<li class="text-secondary small">Sin sustitutos disponibles.</li>`;
            } else {
                subsEl.innerHTML = resolved.map(sub => {
                    const subName = sub.name || sub.exercise_name || "Ejercicio";

                    // Show fallback/missing items specifically
                    if (sub._fallback || sub._is_missing) {
                        return `<li class="text-secondary small mb-1">• ${subName} <span class="badge bg-danger" style="font-size:0.5rem">No encontrado</span></li>`;
                    }

                    const subBody = bodyPartMap[sub.body_part] || sub.body_part || "General";
                    const subEquip = Utils.getEquipmentLabels(sub.equipment).join(', ') || 'N/A';
                    const hasVideo = sub.video_url && sub.video_url.trim();

                    const videoBtn = hasVideo
                        ? `<button class="btn btn-sm btn-outline-danger ms-2" onclick="event.stopPropagation(); openVideoModal('${sub.video_url}')" title="Ver Video"><i class="fas fa-play"></i></button>`
                        : '';

                    return `
                    <li class="border border-secondary rounded px-3 py-2 bg-dark mb-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <div class="text-white fw-bold mb-1">${subName}</div>
                                <div class="d-flex flex-wrap gap-1">
                                    <span class="badge bg-secondary" style="font-size:0.6rem">${subBody}</span>
                                    <span class="badge bg-dark border border-secondary text-secondary" style="font-size:0.6rem">${subEquip}</span>
                                </div>
                            </div>
                            <div class="ms-2">
                                ${videoBtn}
                            </div>
                        </div>
                    </li>`;
                }).join("");
            }
        }

        if (ex.video_url && ex.video_url.trim() !== "") {
            videoBtn.classList.remove("d-none");
            videoBtn.onclick = () => openVideoModal(ex.video_url);
        } else {
            videoBtn.classList.add("d-none");
            videoBtn.onclick = null;
        }

        if (isAdmin && editBtn) {
            editBtn.classList.remove("d-none");
            editBtn.onclick = () => {
                const detailsModal = bootstrap.Modal.getInstance(document.getElementById("exerciseDetailsModal"));
                detailsModal.hide();
                openExerciseModal(id);
            };
        }

        new bootstrap.Modal(document.getElementById("exerciseDetailsModal")).show();
    }

    /* ADMIN ACTIONS */
    async function openExerciseModal(id = null) {
        if (!isAdmin) return;

        // Ensure we have all candidates for substitutes
        await ensureFullCatalog();

        const form = document.getElementById("exerciseForm");
        form.reset();
        document.getElementById("exId").value = "";
        currentExerciseId = id;

        const modalTitle = document.querySelector("#exerciseModal .modal-title");
        let subIds = [];
        let specificPopulatedSubs = [];

        if (id) {
            // Try to fetch fresh specific details to get populated substitutes
            try {
                const res = await fetch(`/workout/api/exercises/${id}`);
                if (res.ok) {
                    const freshEx = await res.json();
                    addToLookup(freshEx);
                    // Use the specific populated list
                    if (freshEx.populated_substitutes) {
                        specificPopulatedSubs = freshEx.populated_substitutes;
                        // Also sync subIds just in case
                        subIds = specificPopulatedSubs.map(s => s._id);
                    } else {
                        subIds = freshEx.substitutes || [];
                    }

                    // Update form values with fresh data
                    document.getElementById("exName").value = freshEx.name;
                    document.getElementById("exDescription").value = freshEx.description || '';
                    document.getElementById("exVideo").value = freshEx.video_url || '';
                    // ... other fields are less critical or handled by generic fill if lookup existed ...
                } else {
                    // Fallback to local lookup
                    const ex = exerciseLookup[id];
                    if (ex) subIds = ex.substitutes || [];
                }
            } catch (e) {
                console.warn("Could not fetch fresh details, using local", e);
                const ex = exerciseLookup[id];
                if (ex) subIds = ex.substitutes || [];
            }

            // Re-get local object in case we updated it
            const ex = exerciseLookup[id];
            if (ex) {
                modalTitle.textContent = "Editar Ejercicio";
                document.getElementById("exId").value = ex._id;
                document.getElementById("exName").value = ex.name;
                // Populate Taxonomy Selects
                await populateModalTaxonomy(ex);

                document.getElementById("exType").value = ex.type || "weight";

                // Multi-select equipment
                const equipOpts = document.getElementById("exEquipment");
                if (equipOpts) {
                    // Sync options (ensure existing)
                    const sourceOpts = document.getElementById("filterEquipment").options;
                    if (sourceOpts && sourceOpts.length > 0) {
                        equipOpts.innerHTML = "";
                        Array.from(sourceOpts).forEach(src => {
                            if (!src.value) return;
                            const opt = document.createElement("option");
                            opt.value = src.value;
                            opt.textContent = src.text;
                            equipOpts.appendChild(opt);
                        });
                    }
                    const list = Utils.normalizeEquipmentList(ex.equipment);
                    Array.from(equipOpts.options).forEach(opt => opt.selected = list.includes(opt.value));
                }

                document.getElementById("exPattern").value = ex.pattern || "";
                document.getElementById("exPlane").value = ex.plane || "";
                document.getElementById("exLevel").value = ex.level || "";
                document.getElementById("exPrimaryMuscle").value = ex.primary_muscle || "";
                document.getElementById("exUnilateral").checked = !!ex.unilateral;
                document.getElementById("exAlternativeNames").value = (ex.alternative_names || []).join(", ");
                document.getElementById("exDescription").value = ex.description || '';
                document.getElementById("exVideo").value = ex.video_url || '';
            }
        } else {
            modalTitle.textContent = "Nuevo Ejercicio";
            // Populate sections for new exercise
            updateModalGroupOptions("");
        }

        populateSubstitutes(fullExerciseCatalog, id, subIds, currentExerciseId, specificPopulatedSubs);
        new bootstrap.Modal(document.getElementById("exerciseModal")).show();
    }

    // Helper to populate taxonomy in modal
    async function populateModalTaxonomy(ex) {
        // Ensure options are built first? They should be built by page load or on modal open if not exists.
        // We reuse taxonomyData global from filter logic

        const sectionSel = document.getElementById("exSection");
        sectionSel.innerHTML = '<option value="">Selecciona...</option>';
        taxonomyData.forEach(sect => {
            const opt = document.createElement("option");
            opt.value = sect.id;
            opt.textContent = sect.name;
            sectionSel.appendChild(opt);
        });

        const tax = ex.taxonomy || {};
        // If existing taxonomy found
        if (tax.section_id) {
            sectionSel.value = tax.section_id;
            updateModalGroupOptions(tax.section_id);
            if (tax.group_id) {
                document.getElementById("exGroup").value = tax.group_id;
                updateModalMuscleOptions(tax.section_id, tax.group_id);
                if (tax.muscle_id) {
                    document.getElementById("exMuscle").value = tax.muscle_id;
                }
            }
        } else {
            // Try fallback mapping if no taxonomy but legacy data? 
            // Logic handled by migration script already. User can manually fix here.
        }

    }

    // Listeners for Modal Taxonomy
    document.getElementById("exSection").addEventListener("change", (e) => {
        updateModalGroupOptions(e.target.value);
    });

    document.getElementById("exGroup").addEventListener("change", (e) => {
        updateModalMuscleOptions(document.getElementById("exSection").value, e.target.value);
    });

    function updateModalGroupOptions(sectionId) {
        const groupSel = document.getElementById("exGroup");
        const muscleSel = document.getElementById("exMuscle");

        groupSel.innerHTML = '<option value="">Selecciona...</option>';
        muscleSel.innerHTML = '<option value="">Selecciona...</option>';
        groupSel.disabled = !sectionId;
        muscleSel.disabled = true;

        if (!sectionId) return;

        const section = taxonomyData.find(s => s.id === sectionId);
        if (section && section.groups) {
            section.groups.forEach(g => {
                const opt = document.createElement("option");
                opt.value = g.id;
                opt.textContent = g.name;
                groupSel.appendChild(opt);
            });
        }
    }

    function updateModalMuscleOptions(sectionId, groupId) {
        const muscleSel = document.getElementById("exMuscle");
        muscleSel.innerHTML = '<option value="">Selecciona...</option>';
        muscleSel.disabled = !groupId;

        if (!sectionId || !groupId) return;

        const section = taxonomyData.find(s => s.id === sectionId);
        if (section) {
            const group = section.groups.find(g => g.id === groupId);
            if (group && group.muscles) {
                group.muscles.forEach(m => {
                    const opt = document.createElement("option");
                    opt.value = m.id;
                    opt.textContent = m.name;
                    muscleSel.appendChild(opt);
                });
            }
        }
    }

    function populateSubstitutes(exercises, currentId, selectedIds = [], exIdForFilter = null, preloadedObjects = []) {
        const container = document.getElementById("substitutesContainer");
        const searchTerm = (document.getElementById("subSearch").value || "").toLowerCase();

        // Find current exercise taxonomy to boost relevance
        let boostGroup = null;
        if (exIdForFilter) {
            const ex = exerciseLookup[exIdForFilter];
            if (ex && ex.taxonomy) boostGroup = ex.taxonomy.group_id;
            // fallback to legacy body part if no taxonomy
            else if (ex) boostGroup = ex.body_part_key || ex.body_part;
        }

        container.innerHTML = "";

        // SPLIT VIEW: Selected vs Available

        // Construct selected list from PRELOADED objects first (authoritative), then fallback to specific lookup, then full catalog
        let selectedList = [];
        if (preloadedObjects && preloadedObjects.length > 0) {
            selectedList = preloadedObjects;
        } else {
            selectedList = exercises.filter(ex => selectedIds.includes(ex._id));
        }

        const availableList = exercises.filter(ex => {
            if (ex._id === currentId) return false;
            if (selectedIds.includes(ex._id)) return false;
            if (searchTerm) return ex.name.toLowerCase().includes(searchTerm);
            // Default: Show recommendations (Same Group)
            if (boostGroup) {
                const g = ex.taxonomy?.group_id || ex.body_part_key || ex.body_part;
                return g === boostGroup;
            }
            return false;
        });

        // 1. RENDER SELECTED SECTION
        if (selectedList.length > 0) {
            const selHeader = document.createElement("h6");
            selHeader.className = "text-cyber-green border-bottom border-secondary pb-2 mb-3 mt-2";
            selHeader.innerHTML = `<i class="fas fa-check-circle me-2"></i>Seleccionados (${selectedList.length})`;
            container.appendChild(selHeader);

            selectedList.forEach(ex => {
                const hasVideo = ex.video_url && ex.video_url.trim();
                const equipLabel = Utils.getEquipmentLabels(ex.equipment).join(', ') || 'N/A';
                const videoAction = hasVideo
                    ? `<button type="button" class="btn btn-sm btn-outline-danger ms-2 z-index-2" 
                         onclick="event.preventDefault(); event.stopPropagation(); openVideoModal('${ex.video_url}')" title="Ver Video">
                         <i class="fas fa-play"></i>
                       </button>`
                    : '';

                const div = document.createElement("div");
                div.className = "p-3 mb-2 bg-dark border border-success rounded shadow-sm position-relative";
                div.style.cursor = "pointer";
                div.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="form-check">
                            <input class="form-check-input bg-dark border-success" type="checkbox" value="${ex._id}" checked id="sub_${ex._id}">
                            <label class="form-check-label text-white fw-bold d-block" style="cursor:pointer" for="sub_${ex._id}">
                                ${ex.name}
                            </label>
                            <div class="text-secondary small mt-1">
                                <span class="badge bg-secondary border border-secondary text-light" style="font-size:0.6rem">${bodyPartMap[ex.body_part_key] || ex.body_part || "General"}</span>
                                <span class="badge bg-transparent border border-secondary text-secondary" style="font-size:0.6rem">${equipLabel}</span>
                            </div>
                        </div>
                        <div class="ms-2 d-flex align-items-center">
                            ${videoAction}
                            <button type="button" class="btn btn-sm btn-outline-secondary ms-2" title="Remover"><i class="fas fa-times"></i></button>
                        </div>
                    </div>
                `;
                // Click handler specifically for removing
                div.onclick = (e) => {
                    // If clicking video or actual checkbox, let it propagate naturally? 
                    // Actually, if clicking the card, toggle the checkbox
                    if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'INPUT') return;
                    const cb = div.querySelector('input[type="checkbox"]');
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event('change'));
                };
                container.appendChild(div);
            });
        }

        // 2. RENDER AVAILABLE / SEARCH SECTION
        const availHeader = document.createElement("h6");
        availHeader.className = "text-info border-bottom border-secondary pb-2 mb-3 mt-4";
        availHeader.innerHTML = searchTerm
            ? `<i class="fas fa-search me-2"></i>Resultados de búsqueda`
            : `<i class="fas fa-lightbulb me-2"></i>Recomendados (Mismo Grupo)`;
        container.appendChild(availHeader);

        if (availableList.length === 0) {
            const empty = document.createElement("div");
            empty.className = "text-muted small text-center py-3";
            empty.textContent = searchTerm ? "No se encontraron ejercicios." : "No hay recomendaciones directas. Usa el buscador.";
            container.appendChild(empty);
        } else {
            const sortedAvail = availableList.sort((a, b) => a.name.localeCompare(b.name));
            sortedAvail.forEach(ex => {
                const hasVideo = ex.video_url && ex.video_url.trim();
                const equipLabel = Utils.getEquipmentLabels(ex.equipment).join(', ') || 'N/A';
                const videoAction = hasVideo
                    ? `<button type="button" class="btn btn-sm btn-outline-danger ms-2 z-index-2" 
                         onclick="event.preventDefault(); event.stopPropagation(); openVideoModal('${ex.video_url}')" title="Ver Video">
                         <i class="fas fa-play"></i>
                       </button>`
                    : '';

                const div = document.createElement("div");
                div.className = "p-2 mb-2 bg-dark border border-secondary rounded shadow-sm position-relative substitute-item";
                div.style.cursor = "pointer";
                div.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="form-check">
                            <input class="form-check-input bg-dark border-secondary" type="checkbox" value="${ex._id}" id="sub_${ex._id}">
                            <label class="form-check-label text-white d-block" style="cursor:pointer" for="sub_${ex._id}">
                                ${ex.name}
                            </label>
                            <div class="text-secondary small">
                                <span class="badge bg-secondary border border-secondary text-info" style="font-size:0.6rem">${bodyPartMap[ex.body_part_key] || ex.body_part || "General"}</span>
                                <span class="badge bg-transparent border border-secondary text-secondary" style="font-size:0.6rem">${equipLabel}</span>
                            </div>
                        </div>
                        <div class="ms-2">
                             ${videoAction}
                        </div>
                    </div>
                `;
                div.onclick = (e) => {
                    if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.tagName === 'INPUT') return;
                    const cb = div.querySelector('input[type="checkbox"]');
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event('change'));
                };
                container.appendChild(div);
            });
        }
    }


    function getSelectedSubstitutes() {
        const checkboxes = document.querySelectorAll("#substitutesContainer input[type='checkbox']:checked");
        return Array.from(checkboxes).map(cb => cb.value);
    }

    function ensureMessageModalInstance() {
        if (!messageModalInstance) {
            const modalEl = document.getElementById("messageModal");
            messageModalInstance = new bootstrap.Modal(modalEl);
        }
        return messageModalInstance;
    }

    const getLocalMessageModal = () => {
        const modalEl = document.getElementById("messageModal");
        if (!modalEl) return null;
        return bootstrap.Modal.getOrCreateInstance(modalEl);
    };

    const localShowConfirmModal = (title, message, tone = "warning") => {
        const modalEl = document.getElementById("messageModal");
        if (!modalEl) return Promise.resolve(confirm(message || title || "Confirmar"));

        const modalTitle = modalEl.querySelector(".modal-title");
        const modalBody = modalEl.querySelector(".modal-body");
        const confirmBtn = modalEl.querySelector("#messageConfirm");
        const cancelBtn = modalEl.querySelector("#messageCancel");
        const okBtn = modalEl.querySelector("#messageOk");

        modalTitle.textContent = title || "Confirmar";
        modalBody.textContent = message || "";
        confirmBtn.classList.remove("d-none");
        cancelBtn.classList.remove("d-none");
        okBtn.classList.add("d-none");

        confirmBtn.className = tone === "danger" ? "btn btn-outline-danger" : "btn btn-outline-success";
        cancelBtn.className = "btn btn-outline-secondary";

        return new Promise(resolve => {
            const onConfirm = () => {
                getLocalMessageModal()?.hide();
                resolve(true);
            };
            const onCancel = () => {
                resolve(false);
            };
            confirmBtn.onclick = onConfirm;
            cancelBtn.onclick = onCancel;
            modalEl.addEventListener("hidden.bs.modal", () => resolve(false), { once: true });
            getLocalMessageModal()?.show();
        });
    };

    const localShowAlertModal = (title, message, tone = "warning") => {
        const modalEl = document.getElementById("messageModal");
        if (!modalEl) {
            alert(message || title || "Aviso");
            return Promise.resolve(true);
        }
        const modalTitle = modalEl.querySelector(".modal-title");
        const modalBody = modalEl.querySelector(".modal-body");
        const confirmBtn = modalEl.querySelector("#messageConfirm");
        const cancelBtn = modalEl.querySelector("#messageCancel");
        const okBtn = modalEl.querySelector("#messageOk");

        modalTitle.textContent = title || "Aviso";
        modalBody.textContent = message || "";
        confirmBtn.classList.add("d-none");
        cancelBtn.classList.add("d-none");
        okBtn.classList.remove("d-none");
        okBtn.className = tone === "danger" ? "btn btn-outline-danger" : "btn btn-outline-light";

        return new Promise(resolve => {
            okBtn.onclick = () => {
                getLocalMessageModal()?.hide();
                resolve(true);
            };
            modalEl.addEventListener("hidden.bs.modal", () => resolve(true), { once: true });
            getLocalMessageModal()?.show();
        });
    };

    async function saveExercise() {
        const id = document.getElementById("exId").value;
        const name = document.getElementById("exName").value;

        // Taxonomy
        const sectionId = document.getElementById("exSection").value;
        const groupId = document.getElementById("exGroup").value;
        const muscleId = document.getElementById("exMuscle").value;

        const type = document.getElementById("exType").value;
        const equipment = Array.from(document.getElementById("exEquipment").selectedOptions).map(o => o.value);

        if (!name) {
            localShowAlertModal("Campo requerido", "El nombre es obligatorio", "warning");
            return;
        }

        const payload = {
            id, name, type, equipment,
            body_part_key: groupId, // Maintain compatibility
            taxonomy: {
                section_id: sectionId,
                group_id: groupId,
                muscle_id: muscleId
            },
            pattern: document.getElementById("exPattern").value,
            plane: document.getElementById("exPlane").value,
            level: document.getElementById("exLevel").value,
            primary_muscle: document.getElementById("exPrimaryMuscle").value,
            unilateral: document.getElementById("exUnilateral").checked,
            alternative_names: document.getElementById("exAlternativeNames").value.split(",").map(c => c.trim()).filter(Boolean),
            video_url: document.getElementById("exVideo").value,
            description: document.getElementById("exDescription").value,
            substitutes: getSelectedSubstitutes()
        };

        try {
            await fetch("/api/exercises/save", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            bootstrap.Modal.getInstance(document.getElementById("exerciseModal")).hide();
            loadExercisesPage(currentPage); // Reload page
        } catch (e) {
            localShowAlertModal("Error", "Ocurrió un error al guardar", "danger");
        }
    }

    async function deleteExercise(id) {
        const confirmed = await localShowConfirmModal("Eliminar ejercicio", "¿Estás seguro de que deseas eliminar este ejercicio?", "danger");
        if (!confirmed) return;

        try {
            await fetch(`/api/exercises/delete/${id}`, { method: "DELETE" });
            loadExercisesPage(currentPage);
        } catch (e) {
            localShowAlertModal("Error", "Error al eliminar", "danger");
        }
    }

    async function duplicateExercise(id) {
        const ex = exerciseLookup[id];
        if (!ex) return;

        const confirmed = await localShowConfirmModal("Duplicar Ejercicio", `¿Deseas crear una copia personalizada de "${ex.name}"?`);
        if (!confirmed) return;

        try {
            // Create copy payload similar to existing
            const payload = { ...ex, id: null, name: ex.name + " (Copia)", _id: undefined };
            await fetch("/api/exercises/save", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            loadExercisesPage(currentPage);
        } catch (e) {
            localShowAlertModal("Error", "Error al duplicar", "danger");
        }
    }


    /* Video Modal Helpers */
    function openVideoModal(url) {
        const iframe = document.getElementById("videoFrame");
        iframe.src = Utils.toEmbedUrl(url);

        // Handle Stacking
        const modalEl = document.getElementById("videoModal");
        const modal = new bootstrap.Modal(modalEl);
        modalEl.style.zIndex = "1060";

        modal.show();
        modalEl.addEventListener("hidden.bs.modal", () => { iframe.src = ""; modalEl.style.zIndex = ""; }, { once: true });
    }

    /* Muscle Icons (Hardcoded for visual appeal) */
    function renderMuscleIcons() {
        const container = document.getElementById("muscleIconsContainer");
        container.innerHTML = muscleIcons.map(m => `
            <div class="d-flex flex-column align-items-center muscle-item" onclick="filterByIcon('${m.key}')" style="cursor: pointer; min-width: 70px;">
                <div class="muscle-icon" id="icon-${m.key}">
                    <img src="/static/images/muscles/male/${m.img}" alt="${m.label}" 
                         onerror="this.style.display='none'; this.nextElementSibling.classList.remove('d-none');">
                    <div class="muscle-fallback d-none">${m.label.charAt(0)}</div>
                </div>
                <span class="muscle-label">${m.label}</span>
            </div>
        `).join("");
    }

    // Sync Dropdown -> Icons
    // Sync Dropdown -> Icons
    function updateIconSelectionFromDropdown() {
        const groupVal = document.getElementById("filterGroup").value;
        const muscleVal = document.getElementById("filterMuscle").value;

        document.querySelectorAll('.muscle-icon').forEach(el => el.classList.remove('active'));

        if (!groupVal && !muscleVal) return;

        // Find matches
        // 1. Exact match with Muscle
        if (muscleVal) {
            const match = muscleIcons.find(m => m.key === muscleVal);
            if (match) {
                document.getElementById(`icon-${match.key}`)?.classList.add('active');
                return;
            }
        }

        // 2. Match with Group
        if (groupVal) {
            const match = muscleIcons.find(m => m.key === groupVal);
            if (match) {
                document.getElementById(`icon-${match.key}`)?.classList.add('active');
                return;
            }
        }
    }

    function filterByIcon(key) {
        // Find if key is Muscle, Group, or neither
        let foundSection = null;
        let foundGroup = null;
        let foundMuscle = null;

        if (taxonomyData && taxonomyData.length) {
            outerLoop:
            for (const sect of taxonomyData) {
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

        const secSel = document.getElementById("filterSection");
        const grpSel = document.getElementById("filterGroup");
        const musSel = document.getElementById("filterMuscle");

        const currentActive = document.getElementById(`icon-${key}`).classList.contains('active');

        if (currentActive) {
            // Deselect: Clear all taxonomy filters
            secSel.value = "";
            updateGroupOptions("");
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
                    musSel.value = "";
                }

                document.querySelectorAll('.muscle-icon').forEach(el => el.classList.remove('active'));
                document.getElementById(`icon-${key}`).classList.add("active");
            } else {
                console.warn("No mapping found for icon key:", key);
                // Fallback: try setting group directly if possible or do nothing?
                // For now, do nothing if not mapped.
            }
        }
        loadExercisesPage(1);
    }
