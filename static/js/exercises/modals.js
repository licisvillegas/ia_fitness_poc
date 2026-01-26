(function initExercisesModals() {
    const Utils = window.ExercisesUtils;
    const { equipmentMeta: EQUIPMENT_META } = window.ExercisesConsts;

    function ensureMessageModalInstance() {
        const state = window.ExercisesState;
        if (!state.messageModalInstance) {
            const modalEl = document.getElementById('messageModal');
            state.messageModalInstance = new bootstrap.Modal(modalEl);
        }
        return state.messageModalInstance;
    }

    const getLocalMessageModal = () => {
        const modalEl = document.getElementById('messageModal');
        if (!modalEl) return null;
        return bootstrap.Modal.getOrCreateInstance(modalEl);
    };

    const localShowConfirmModal = (title, message, tone = 'warning') => {
        const modalEl = document.getElementById('messageModal');
        if (!modalEl) return Promise.resolve(confirm(message || title || 'Confirmar'));

        const modalTitle = modalEl.querySelector('.modal-title');
        const modalBody = modalEl.querySelector('.modal-body');
        const confirmBtn = modalEl.querySelector('#messageConfirm');
        const cancelBtn = modalEl.querySelector('#messageCancel');
        const okBtn = modalEl.querySelector('#messageOk');

        modalTitle.textContent = title || 'Confirmar';
        modalBody.textContent = message || '';
        confirmBtn.classList.remove('d-none');
        cancelBtn.classList.remove('d-none');
        okBtn.classList.add('d-none');

        confirmBtn.className = tone === 'danger' ? 'btn btn-outline-danger' : 'btn btn-outline-success';
        cancelBtn.className = 'btn btn-outline-secondary';

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
            modalEl.addEventListener('hidden.bs.modal', () => resolve(false), { once: true });
            getLocalMessageModal()?.show();
        });
    };

    const localShowAlertModal = (title, message, tone = 'warning') => {
        const modalEl = document.getElementById('messageModal');
        if (!modalEl) {
            alert(message || title || 'Aviso');
            return Promise.resolve(true);
        }
        const modalTitle = modalEl.querySelector('.modal-title');
        const modalBody = modalEl.querySelector('.modal-body');
        const confirmBtn = modalEl.querySelector('#messageConfirm');
        const cancelBtn = modalEl.querySelector('#messageCancel');
        const okBtn = modalEl.querySelector('#messageOk');

        modalTitle.textContent = title || 'Aviso';
        modalBody.textContent = message || '';
        confirmBtn.classList.add('d-none');
        cancelBtn.classList.add('d-none');
        okBtn.classList.remove('d-none');
        okBtn.className = tone === 'danger' ? 'btn btn-outline-danger' : 'btn btn-outline-light';

        return new Promise(resolve => {
            okBtn.onclick = () => {
                getLocalMessageModal()?.hide();
                resolve(true);
            };
            modalEl.addEventListener('hidden.bs.modal', () => resolve(true), { once: true });
            getLocalMessageModal()?.show();
        });
    };

    function openVideoModal(url) {
        const iframe = document.getElementById('videoFrame');
        iframe.src = Utils.toEmbedUrl(url);

        const modalEl = document.getElementById('videoModal');
        const modal = new bootstrap.Modal(modalEl);
        modalEl.style.zIndex = '1060';

        modal.show();
        modalEl.addEventListener('hidden.bs.modal', () => {
            iframe.src = '';
            modalEl.style.zIndex = '';
        }, { once: true });
    }

    async function openExerciseDetails(id) {
        const state = window.ExercisesState;
        let ex = state.exerciseLookup[id];
        try {
            const res = await fetch(`/workout/api/exercises/${id}`);
            if (res.ok) {
                ex = await res.json();
                window.ExercisesStateHelpers.addToLookup(ex);
            }
        } catch (e) {
            console.error('Error fetching detail:', e);
        }

        if (!ex) return;
        const titleEl = document.getElementById('exerciseDetailsTitle');
        const imgEl = document.getElementById('exerciseDetailsImage');
        const badgesEl = document.getElementById('exerciseDetailsBadges');
        const metaEl = document.getElementById('exerciseDetailsMeta');
        const descEl = document.getElementById('exerciseDetailsDesc');
        const subsEl = document.getElementById('exerciseDetailsSubs');
        const videoBtn = document.getElementById('exerciseDetailsVideoBtn');
        const editBtn = document.getElementById('detailsEditBtn');

        const primaryEquip = Utils.getPrimaryEquipment(ex.equipment);
        const equipMeta = EQUIPMENT_META[primaryEquip] || { label: Utils.getEquipmentLabels(ex.equipment).join(', ') || 'N/A', icon: 'fas fa-dumbbell' };

        const substitutesList = ex.populated_substitutes || ex.substitutes || [];
        titleEl.textContent = ex.name || 'Ejercicio';
        imgEl.src = window.ExercisesRender.resolveImage(ex);
        imgEl.alt = ex.name || 'Ejercicio';
        if (descEl) descEl.textContent = ex.description || 'Sin descripción disponible.';

        if (badgesEl) {
            badgesEl.innerHTML = `
                <span class="exercise-meta-pill"><i class="fas fa-dumbbell"></i>${state.bodyPartMap[ex.body_part] || ex.body_part || 'General'}</span>
                <span class="exercise-meta-pill"><i class="${equipMeta.icon}"></i>${equipMeta.label}</span>
                <span class="exercise-meta-pill"><i class="fas fa-clipboard"></i>${ex.type || 'N/A'}</span>
            `;
        }

        if (metaEl) {
            const altNames = Array.isArray(ex.alternative_names) ? ex.alternative_names : [];
            const items = [
                { label: 'Patrón', value: ex.pattern },
                { label: 'Plano', value: ex.plane },
                { label: 'Unilateral', value: ex.unilateral ? 'Sí' : 'No' },
                { label: 'Músculo primario', value: ex.primary_muscle },
                { label: 'Nivel', value: ex.level },
                { label: 'Nombres alternativos', value: altNames.join(', ') }
            ].filter(item => item.value);
            if (items.length) {
                metaEl.innerHTML = items.map(item => `<div><strong class="text-light">${item.label}:</strong> ${item.value}</div>`).join('');
            } else {
                metaEl.innerHTML = '';
            }
        }

        if (subsEl) {
            const finalSubs = ex.populated_substitutes && ex.populated_substitutes.length > 0
                ? ex.populated_substitutes
                : (ex.substitutes || ex.equivalents || ex.equivalent_exercises || []);

            const resolved = finalSubs.map(sub => {
                if (sub && typeof sub === 'object' && sub.name && !sub._fallback) return sub;
                if (typeof sub === 'string' || typeof sub === 'number') {
                    const key = String(sub);
                    return state.exerciseLookup[key] || state.exerciseLookupByName[key.toLowerCase()] || { name: key, _fallback: true };
                }
                if (sub && typeof sub === 'object') return sub;
                return null;
            }).filter(Boolean);

            if (resolved.length === 0) {
                subsEl.innerHTML = '<li class="text-secondary small">Sin sustitutos disponibles.</li>';
            } else {
                subsEl.innerHTML = resolved.map(sub => {
                    const subName = sub.name || sub.exercise_name || 'Ejercicio';

                    if (sub._fallback || sub._is_missing) {
                        return `<li class="text-secondary small mb-1">• ${subName} <span class="badge bg-danger" style="font-size:0.5rem">No encontrado</span></li>`;
                    }

                    const subBody = state.bodyPartMap[sub.body_part] || sub.body_part || 'General';
                    const subEquip = Utils.getEquipmentLabels(sub.equipment).join(', ') || 'N/A';
                    const hasVideo = sub.video_url && sub.video_url.trim();

                    const videoBtnHtml = hasVideo
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
                                ${videoBtnHtml}
                            </div>
                        </div>
                    </li>`;
                }).join('');
            }
        }

        if (ex.video_url && ex.video_url.trim() !== '') {
            videoBtn.classList.remove('d-none');
            videoBtn.onclick = () => openVideoModal(ex.video_url);
        } else {
            videoBtn.classList.add('d-none');
            videoBtn.onclick = null;
        }

        if (state.isAdmin && editBtn) {
            editBtn.classList.remove('d-none');
            editBtn.onclick = () => {
                const detailsModal = bootstrap.Modal.getInstance(document.getElementById('exerciseDetailsModal'));
                detailsModal.hide();
                openExerciseModal(id);
            };
        }

        new bootstrap.Modal(document.getElementById('exerciseDetailsModal')).show();
    }

    async function openExerciseModal(id = null) {
        const state = window.ExercisesState;
        if (!state.isAdmin) return;

        await window.ExercisesApi.ensureFullCatalog();

        const form = document.getElementById('exerciseForm');
        form.reset();
        document.getElementById('exId').value = '';
        state.currentExerciseId = id;

        const modalTitle = document.querySelector('#exerciseModal .modal-title');
        let subIds = [];
        let specificPopulatedSubs = [];

        if (id) {
            try {
                const res = await fetch(`/workout/api/exercises/${id}`);
                if (res.ok) {
                    const freshEx = await res.json();
                    window.ExercisesStateHelpers.addToLookup(freshEx);
                    if (freshEx.populated_substitutes) {
                        specificPopulatedSubs = freshEx.populated_substitutes;
                        subIds = specificPopulatedSubs.map(s => s._id);
                    } else {
                        subIds = freshEx.substitutes || [];
                    }

                    document.getElementById('exName').value = freshEx.name;
                    document.getElementById('exDescription').value = freshEx.description || '';
                    document.getElementById('exVideo').value = freshEx.video_url || '';
                } else {
                    const ex = state.exerciseLookup[id];
                    if (ex) subIds = ex.substitutes || [];
                }
            } catch (e) {
                console.warn('Could not fetch fresh details, using local', e);
                const ex = state.exerciseLookup[id];
                if (ex) subIds = ex.substitutes || [];
            }

            const ex = state.exerciseLookup[id];
            if (ex) {
                modalTitle.textContent = 'Editar Ejercicio';
                document.getElementById('exId').value = ex._id;
                await populateModalTaxonomy(ex);

                document.getElementById('exType').value = ex.type || 'weight';

                const equipOpts = document.getElementById('exEquipment');
                if (equipOpts) {
                    const sourceOpts = document.getElementById('filterEquipment').options;
                    if (sourceOpts && sourceOpts.length > 0) {
                        equipOpts.innerHTML = '';
                        Array.from(sourceOpts).forEach(src => {
                            if (!src.value) return;
                            const opt = document.createElement('option');
                            opt.value = src.value;
                            opt.textContent = src.text;
                            equipOpts.appendChild(opt);
                        });
                    }
                    const list = Utils.normalizeEquipmentList(ex.equipment);
                    Array.from(equipOpts.options).forEach(opt => opt.selected = list.includes(opt.value));
                }

                document.getElementById('exPattern').value = ex.pattern || '';
                document.getElementById('exPlane').value = ex.plane || '';
                document.getElementById('exLevel').value = ex.level || '';
                document.getElementById('exPrimaryMuscle').value = ex.primary_muscle || '';
                document.getElementById('exUnilateral').checked = !!ex.unilateral;
                document.getElementById('exAlternativeNames').value = (ex.alternative_names || []).join(', ');
                document.getElementById('exDescription').value = ex.description || '';
                document.getElementById('exVideo').value = ex.video_url || '';
            }
        } else {
            modalTitle.textContent = 'Nuevo Ejercicio';
            updateModalGroupOptions('');
        }

        populateSubstitutes(state.fullExerciseCatalog, id, subIds, state.currentExerciseId, specificPopulatedSubs);
        new bootstrap.Modal(document.getElementById('exerciseModal')).show();
    }

    async function populateModalTaxonomy(ex) {
        const state = window.ExercisesState;
        const sectionSel = document.getElementById('exSection');
        sectionSel.innerHTML = '<option value="">Selecciona...</option>';
        state.taxonomyData.forEach(sect => {
            const opt = document.createElement('option');
            opt.value = sect.id;
            opt.textContent = sect.name;
            sectionSel.appendChild(opt);
        });

        const tax = ex.taxonomy || {};
        if (tax.section_id) {
            sectionSel.value = tax.section_id;
            updateModalGroupOptions(tax.section_id);
            if (tax.group_id) {
                document.getElementById('exGroup').value = tax.group_id;
                updateModalMuscleOptions(tax.section_id, tax.group_id);
                if (tax.muscle_id) {
                    document.getElementById('exMuscle').value = tax.muscle_id;
                }
            }
        }
    }

    function updateModalGroupOptions(sectionId) {
        const state = window.ExercisesState;
        const groupSel = document.getElementById('exGroup');
        const muscleSel = document.getElementById('exMuscle');

        groupSel.innerHTML = '<option value="">Selecciona...</option>';
        muscleSel.innerHTML = '<option value="">Selecciona...</option>';
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

    function updateModalMuscleOptions(sectionId, groupId) {
        const state = window.ExercisesState;
        const muscleSel = document.getElementById('exMuscle');
        muscleSel.innerHTML = '<option value="">Selecciona...</option>';
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

    function populateSubstitutes(exercises, currentId, selectedIds = [], exIdForFilter = null, preloadedObjects = []) {
        const state = window.ExercisesState;
        const container = document.getElementById('substitutesContainer');
        const searchTerm = (document.getElementById('subSearch').value || '').toLowerCase();

        let boostGroup = null;
        if (exIdForFilter) {
            const ex = state.exerciseLookup[exIdForFilter];
            if (ex && ex.taxonomy) boostGroup = ex.taxonomy.group_id;
            else if (ex) boostGroup = ex.body_part_key || ex.body_part;
        }

        container.innerHTML = '';

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
            if (boostGroup) {
                const g = ex.taxonomy?.group_id || ex.body_part_key || ex.body_part;
                return g === boostGroup;
            }
            return false;
        });

        if (selectedList.length > 0) {
            const selHeader = document.createElement('h6');
            selHeader.className = 'text-cyber-green border-bottom border-secondary pb-2 mb-3 mt-2';
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

                const div = document.createElement('div');
                div.className = 'p-3 mb-2 bg-dark border border-success rounded shadow-sm position-relative';
                div.style.cursor = 'pointer';
                div.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="form-check">
                            <input class="form-check-input bg-dark border-success" type="checkbox" value="${ex._id}" checked id="sub_${ex._id}">
                            <label class="form-check-label text-white fw-bold d-block" style="cursor:pointer" for="sub_${ex._id}">
                                ${ex.name}
                            </label>
                            <div class="text-secondary small mt-1">
                                <span class="badge bg-secondary border border-secondary text-light" style="font-size:0.6rem">${state.bodyPartMap[ex.body_part_key] || ex.body_part || 'General'}</span>
                                <span class="badge bg-transparent border border-secondary text-secondary" style="font-size:0.6rem">${equipLabel}</span>
                            </div>
                        </div>
                        <div class="ms-2 d-flex align-items-center">
                            ${videoAction}
                            <button type="button" class="btn btn-sm btn-outline-secondary ms-2" title="Remover"><i class="fas fa-times"></i></button>
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

        const availHeader = document.createElement('h6');
        availHeader.className = 'text-info border-bottom border-secondary pb-2 mb-3 mt-4';
        availHeader.innerHTML = searchTerm
            ? `<i class="fas fa-search me-2"></i>Resultados de búsqueda`
            : `<i class="fas fa-lightbulb me-2"></i>Recomendados (Mismo Grupo)`;
        container.appendChild(availHeader);

        if (availableList.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'text-muted small text-center py-3';
            empty.textContent = searchTerm ? 'No se encontraron ejercicios.' : 'No hay recomendaciones directas. Usa el buscador.';
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

                const div = document.createElement('div');
                div.className = 'p-2 mb-2 bg-dark border border-secondary rounded shadow-sm position-relative substitute-item';
                div.style.cursor = 'pointer';
                div.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="form-check">
                            <input class="form-check-input bg-dark border-secondary" type="checkbox" value="${ex._id}" id="sub_${ex._id}">
                            <label class="form-check-label text-white d-block" style="cursor:pointer" for="sub_${ex._id}">
                                ${ex.name}
                            </label>
                            <div class="text-secondary small">
                                <span class="badge bg-secondary border border-secondary text-info" style="font-size:0.6rem">${state.bodyPartMap[ex.body_part_key] || ex.body_part || 'General'}</span>
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

    function initModalListeners() {
        const sectionEl = document.getElementById('exSection');
        const groupEl = document.getElementById('exGroup');
        if (sectionEl) {
            sectionEl.addEventListener('change', (e) => {
                updateModalGroupOptions(e.target.value);
            });
        }
        if (groupEl) {
            groupEl.addEventListener('change', (e) => {
                updateModalMuscleOptions(document.getElementById('exSection').value, e.target.value);
            });
        }
    }

    window.ExercisesModals = {
        ensureMessageModalInstance,
        getLocalMessageModal,
        localShowConfirmModal,
        localShowAlertModal,
        openVideoModal,
        openExerciseDetails,
        openExerciseModal,
        populateSubstitutes,
        getSelectedSubstitutes,
        initModalListeners
    };

    window.openVideoModal = openVideoModal;
    window.openExerciseDetails = openExerciseDetails;
    window.openExerciseModal = openExerciseModal;
})();
