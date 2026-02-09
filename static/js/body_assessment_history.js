const bodyAssessmentHistoryConfig = window.bodyAssessmentHistoryConfig || {};
const userId = bodyAssessmentHistoryConfig.userId || "";
const EXPORT_FALLBACK_WIDTH = 900;
const EXPORT_FALLBACK_HEIGHT = 1200;
const COLLAGE_SIZES = {
    "1:1": { width: 1080, height: 1080 },
    "4:5": { width: 1080, height: 1350 },
    "9:16": { width: 1080, height: 1920 }
};
let historyData = [];
let selectedAssessmentId = null;
let compareState = {
    assessments: [],
    aAssessmentIndex: 0,
    bAssessmentIndex: 0,
    aPhotoIndex: 0,
    bPhotoIndex: 0,
    mode: 'side',
    slider: 50,
    transformA: { scale: 1, x: 0, y: 0 },
    transformB: { scale: 1, x: 0, y: 0 },
    activeAdjust: 'A',
    sliderMode: 'wipe',
    initialized: false
};

        document.addEventListener('DOMContentLoaded', loadHistory);
        document.addEventListener('DOMContentLoaded', initHistoryCollapse);
        document.addEventListener('DOMContentLoaded', initAdminDeleteVisibility);

        function initHistoryCollapse() {
            const listWrap = document.getElementById('history-list-wrap');
            const toggleBtn = document.getElementById('historyToggleBtn');
            const detailCol = document.getElementById('history-detail-col');
            if (!listWrap || !toggleBtn) return;

            const storageKey = `historyListCollapsed:${userId || 'anon'}`;
            const stored = localStorage.getItem(storageKey);
            if (stored === 'true') {
                listWrap.classList.remove('show');
                toggleBtn.setAttribute('aria-expanded', 'false');
                if (detailCol) detailCol.classList.add('history-detail-expanded');
            }

            listWrap.addEventListener('shown.bs.collapse', () => {
                localStorage.setItem(storageKey, 'false');
                toggleBtn.setAttribute('aria-expanded', 'true');
                if (detailCol) detailCol.classList.remove('history-detail-expanded');
            });
            listWrap.addEventListener('hidden.bs.collapse', () => {
                localStorage.setItem(storageKey, 'true');
                toggleBtn.setAttribute('aria-expanded', 'false');
                if (detailCol) detailCol.classList.add('history-detail-expanded');
            });
        }

        function initAdminDeleteVisibility() {
            const wrap = document.getElementById('delete-assessment-wrap');
            if (!wrap) return;
            try {
                if (sessionStorage.getItem('admin_unlocked') === 'true') {
                    wrap.style.display = 'block';
                }
            } catch (e) { }
        }

        async function loadHistory() {
            showLoader("Cargando historial...");
            try {
                const resp = await fetch(`/ai/body_assessment/history/${userId}`);
                if (!resp.ok) throw new Error("Error fetching history");

                historyData = await resp.json();
                renderList();
            } catch (e) {
                document.getElementById('history-list').innerHTML = `<div class="p-3 text-danger text-center"><small>${e.message}</small></div>`;
            } finally {
                hideLoader();
            }
        }

        function renderList() {
            const listEl = document.getElementById('history-list');
            if (historyData.length === 0) {
                listEl.innerHTML = '<div class="p-3 text-secondary text-center small">No hay evaluaciones registradas.</div>';
                const delBtn = document.getElementById('delete-assessment-btn');
                if (delBtn) delBtn.disabled = true;
                return;
            }

            const GOAL_DICT = {
                "lose_fat": "Perder Grasa",
                "build_muscle": "Ganar Músculo",
                "maintain": "Mantener",
                "maintenance": "Mantenimiento",
                "general": "General",
                "recomp": "Recomposición"
            };

            let html = '<div class="list-group list-group-flush">';
            historyData.forEach((item, idx) => {
                const date = item.date || "Fecha desconocida";
                const rawGoal = (item.input && item.input.goal) ? item.input.goal.toLowerCase() : "N/A";
                const goal = GOAL_DICT[rawGoal] || rawGoal;

                html += `
                    <div class="list-group-item list-group-item-action bg-transparent text-white history-item p-3" onclick="selectItem(${idx})">
                        <div class="d-flex justify-content-between align-items-center mb-1">
                            <small class="fw-bold text-primary">${date}</small>
                            <i class="fas fa-chevron-right small text-secondary"></i>
                        </div>
                        <div class="small text-secondary text-uppercase" style="font-size: 0.7rem;">${goal}</div>
                    </div>
                `;
            });
            html += '</div>';
            listEl.innerHTML = html;

            // Auto-select first
            if (historyData.length > 0) selectItem(0);
        }

        function selectItem(idx) {
            // Highlight list
            document.querySelectorAll('.history-item').forEach((el, i) => {
                if (i === idx) el.classList.add('active');
                else el.classList.remove('active');
                if (el.classList.contains('active')) el.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                else el.style.backgroundColor = 'transparent';
            });

            const data = historyData[idx];
            showDetail(data);
        }

        function showDetail(data) {
            document.getElementById('empty-state').style.setProperty('display', 'none', 'important');
            document.getElementById('detail-container').style.setProperty('display', 'block', 'important');

            const input = data.input || {};
            const output = data.output || {};
            selectedAssessmentId = data.id || null;
            const delBtn = document.getElementById('delete-assessment-btn');
            if (delBtn) delBtn.disabled = !selectedAssessmentId;

            // Dictionaries for translation
            const DICT = {
                sex: { "male": "Masculino", "female": "Femenino" },
                activity: {
                    "sedentary": "Sedentario",
                    "light": "Ligero",
                    "moderate": "Moderado",
                    "active": "Activo",
                    "very_active": "Muy Activo",
                    "lightly_active": "Ligero",
                    "moderately_active": "Moderado",
                    "extra_active": "Muy Activo",
                    "strong": "Fuerte",
                    "very_strong": "Muy Fuerte"
                },
                goal: {
                    "lose_fat": "Perder Grasa",
                    "build_muscle": "Ganar Músculo",
                    "maintain": "Mantener",
                    "maintenance": "Mantenimiento",
                    "general": "General",
                    "recomp": "Recomposición"
                },
                measures: {
                    "weight_kg": "Peso",
                    "height_cm": "Altura",
                    "cuello": "Cuello",
                    "neck": "Cuello",
                    "hombros": "Hombros",
                    "shoulders": "Hombros",
                    "torax": "Torax",
                    "chest": "Pecho",
                    "cintura": "Cintura",
                    "waist": "Cintura",
                    "abdomen": "Abdomen",
                    "cadera": "Cadera",
                    "forearm": "Antebrazo",
                    "forearm_left": "Antebrazo (Izq)",
                    "forearm_right": "Antebrazo (Der)",
                    "antebrazo_izq": "Antebrazo (Izq)",
                    "antebrazo_der": "Antebrazo (Der)",
                    "hips": "Caderas",
                    "hip": "Cadera",
                    "arm_relaxed": "Brazo (Relajado)",
                    "arm_relaxed_left": "Brazo (Relajado Izq)",
                    "arm_relaxed_right": "Brazo (Relajado Der)",
                    "arm_flexed": "Brazo (Flex)",
                    "arm_flexed_left": "Brazo (Flex Izq)",
                    "arm_flexed_right": "Brazo (Flex Der)",
                    "biceps_izq": "Biceps (Izq)",
                    "biceps_der": "Biceps (Der)",
                    "biceps_l": "Bíceps (I)",
                    "biceps_r": "Bíceps (D)",
                    "thigh": "Muslo",
                    "thigh_left": "Muslo (Izq)",
                    "thigh_right": "Muslo (Der)",
                    "muslo_izq": "Muslo (Izq)",
                    "muslo_der": "Muslo (Der)",
                    "thigh_l": "Muslo (I)",
                    "thigh_r": "Muslo (D)",
                    "calf": "Pantorrilla",
                    "calf_left": "Pantorrilla (Izq)",
                    "calf_right": "Pantorrilla (Der)",
                    "pantorrilla_izq": "Pantorrilla (Izq)",
                    "pantorrilla_der": "Pantorrilla (Der)",
                    "calf_l": "Pantorrilla (I)",
                    "calf_r": "Pantorrilla (D)"
                }
            };

            // Header
            document.getElementById('det-date').innerText = data.date || "Sin fecha";
            const rawGoal = (input.goal || "general").toLowerCase();
            document.getElementById('det-goal').innerText = (DICT.goal[rawGoal] || rawGoal).toUpperCase();
            document.getElementById('det-backend').innerText = data.backend || "Desconocido";

            // Photos
            const photosContainer = document.getElementById('det-photos');
            photosContainer.innerHTML = '';
            const photos = input.photos || [];
            if (photos.length > 0) {
                document.getElementById('no-photos-msg').classList.add('d-none');
                photos.forEach(ph => {
                    if (ph.url) {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'photo-thumb img-loading-container skeleton-pulse p-0';
                        wrapper.style.cursor = 'zoom-in';

                        const img = document.createElement('img');
                        img.src = ph.url;
                        img.className = 'img-skeleton w-100 h-100';
                        img.style.objectFit = 'contain';

                        const openFn = () => openZoom(ph.url);
                        img.onclick = openFn;
                        wrapper.onclick = openFn;

                        img.onload = () => {
                            wrapper.classList.remove('skeleton-pulse');
                            img.classList.add('loaded');
                        };

                        wrapper.appendChild(img);
                        photosContainer.appendChild(wrapper);
                    }
                });
                if (photosContainer.children.length === 0) {
                    document.getElementById('no-photos-msg').classList.remove('d-none');
                    document.getElementById('no-photos-msg').innerText = "Fotos sin URL guardada (versión anterior).";
                }
            } else {
                document.getElementById('no-photos-msg').classList.remove('d-none');
            }

            // General Info
            const sexVal = (input.sex || "").toLowerCase();
            const actVal = (input.activity_level || "").toLowerCase();
            const sexDisplay = DICT.sex[sexVal] || input.sex || '--';
            const actDisplay = DICT.activity[actVal] || input.activity_level || '--';

            const genList = document.getElementById('det-general');
            genList.innerHTML = `
                <li class="list-group-item bg-transparent text-secondary px-0 py-1 d-flex justify-content-between"><span>Sexo:</span> <span class="text-white">${sexDisplay}</span></li>
                <li class="list-group-item bg-transparent text-secondary px-0 py-1 d-flex justify-content-between"><span>Edad:</span> <span class="text-white">${input.age || '--'}</span></li>
                <li class="list-group-item bg-transparent text-secondary px-0 py-1 d-flex justify-content-between"><span>Nivel Act.:</span> <span class="text-white">${actDisplay}</span></li>
                <li class="list-group-item bg-transparent text-secondary px-0 py-1"><span>Notas:</span> <div class="text-white fst-italic mt-1">${input.notes || '--'}</div></li>
            `;

            // Measurements
            const measContainer = document.getElementById('det-measurements');
            measContainer.innerHTML = '';
            const m = input.measurements || {};
            const hasKey = (key) => Object.prototype.hasOwnProperty.call(m, key);
            const skipKeys = new Set();
            if (hasKey("cuello")) skipKeys.add("neck");
            if (hasKey("hombros")) skipKeys.add("shoulders");
            if (hasKey("torax")) skipKeys.add("chest");
            if (hasKey("cintura")) skipKeys.add("waist");
            if (hasKey("cadera")) {
                skipKeys.add("hip");
                skipKeys.add("hips");
            }
            if (hasKey("biceps_izq")) skipKeys.add("biceps_l");
            if (hasKey("biceps_der")) skipKeys.add("biceps_r");
            if (hasKey("biceps_izq")) {
                skipKeys.add("arm_relaxed_left");
                skipKeys.add("arm_flexed_left");
            }
            if (hasKey("biceps_der")) {
                skipKeys.add("arm_relaxed_right");
                skipKeys.add("arm_flexed_right");
            }
            if (hasKey("antebrazo_izq")) skipKeys.add("forearm_left");
            if (hasKey("antebrazo_der")) skipKeys.add("forearm_right");
            if (hasKey("muslo_izq")) skipKeys.add("thigh_l");
            if (hasKey("muslo_der")) skipKeys.add("thigh_r");
            if (hasKey("muslo_izq")) skipKeys.add("thigh_left");
            if (hasKey("muslo_der")) skipKeys.add("thigh_right");
            if (hasKey("pantorrilla_izq")) skipKeys.add("calf_l");
            if (hasKey("pantorrilla_der")) skipKeys.add("calf_r");
            if (hasKey("pantorrilla_izq")) skipKeys.add("calf_left");
            if (hasKey("pantorrilla_der")) skipKeys.add("calf_right");
            for (const [k, v] of Object.entries(m)) {
                if (skipKeys.has(k)) {
                    continue;
                }
                if (v && k !== 'unit_system') { // Filter utility keys if any
                    const label = DICT.measures[k] || k;
                    // Determine unit
                    let unit = "cm";
                    if (k.includes('weight') || k === 'peso') unit = "kg";

                    measContainer.innerHTML += `
                        <div class="col-4 col-sm-4 col-md-6 col-lg-4">
                            <div class="p-2 border border-secondary rounded bg-dark text-center h-100 d-flex flex-column justify-content-center">
                                <span class="text-secondary small text-uppercase" style="font-size:0.65rem; letter-spacing:0.5px;">${label}</span>
                                <span class="text-white fw-bold mt-1">${v} <span class="text-secondary fw-normal" style="font-size:0.7rem;">${unit}</span></span>
                            </div>
                        </div>
                    `;
                }
            }

            // AI Results
            document.getElementById('det-summary').innerText = output.summary || "Sin resumen.";

            // Metrics
            const bc = output.body_composition || {};
            document.getElementById('det-metrics').innerHTML = `
                <div class="col-6 col-md-3"><div class="metric-card"><div class="metric-value">${bc.body_fat_percent || '--'}%</div><div class="metric-label">Grasa</div></div></div>
                <div class="col-6 col-md-3"><div class="metric-card"><div class="metric-value">${bc.muscle_mass_percent || '--'}%</div><div class="metric-label">Músculo</div></div></div>
                <div class="col-6 col-md-3"><div class="metric-card"><div class="metric-value">${bc.lean_mass_kg || '--'} kg</div><div class="metric-label">Masa Magra</div></div></div>
                <div class="col-6 col-md-3"><div class="metric-card"><div class="metric-value">${bc.fat_mass_kg || '--'} kg</div><div class="metric-label">Masa Grasa</div></div></div>
            `;

            // TMB & TDEE
            const en = output.energy_expenditure || {};
            document.getElementById('det-tmb').innerText = en.tmb ? `${en.tmb} kcal` : "--";
            const tdeeList = document.getElementById('det-tdee');
            tdeeList.innerHTML = '';

            if (en.tdee) {
                // Labels from body_assessment_user.html for consistency/equality
                const tdeeLabels = {
                    "sedentary": "Sedentario",
                    "light": "Ligero (1-3 días)",
                    "moderate": "Moderado (3-5 días)",
                    "strong": "Fuerte (6-7 días)",
                    "very_strong": "Muy fuerte",
                    // Backend might use different keys sometimes, keep fallback
                    "active": "Activo",
                    "lightly_active": "Ligeramente Activo",
                    "moderately_active": "Moderadamente Activo",
                    "extra_active": "Extra Activo"
                };

                for (const [lvl, cal] of Object.entries(en.tdee)) {
                    // Match key normalization from previous step if needed, but usually keys are lowercase
                    const normLvl = lvl.toLowerCase();
                    const label = tdeeLabels[normLvl] || DICT.activity[normLvl] || lvl;
                    const isSelected = en.selected_activity === lvl;

                    // Specific styling (Igual al Resulados del agente)
                    const labelClass = isSelected ? "text-white fw-bold" : "text-secondary";
                    const valueClass = isSelected ? "text-warning fw-bold" : "text-light";
                    const bgClass = isSelected ? "bg-dark border border-warning rounded shadow-sm py-2 px-2 my-2" : "py-1 px-2";
                    const checkIcon = isSelected ? '<i class="fas fa-check-circle text-warning me-2"></i>' : '';

                    tdeeList.innerHTML += `
                    <li class="d-flex justify-content-between align-items-center ${bgClass}">
                        <span class="${labelClass}">${checkIcon}${label}</span>
                        <span class="${valueClass} font-monospace">${cal} kcal</span>
                    </li>`;
                }
            } else {
                tdeeList.innerHTML = '<li class="text-muted fst-italic">No disponible</li>';
            }

            // Props
            let props = output.body_proportions;
            if (!props && output.proportions) {
                // Legacy adapt
                props = {
                    symmetry_analysis: output.proportions.symmetry_notes,
                    waist_to_height_ratio: output.proportions.waist_to_height,
                    waist_to_hip_ratio: output.proportions.waist_to_hip
                };
            }
            const pDiv = document.getElementById('det-props');
            if (props) {
                pDiv.innerHTML = `
                    <p class="mb-2 fst-italic text-info">${props.symmetry_analysis || ''}</p>
                    <div class="d-flex gap-3 text-white">
                        <span>Cintura/Altura: <strong>${props.waist_to_height_ratio || '--'}</strong></span>
                        <span>Cintura/Cadera: <strong>${props.waist_to_hip_ratio || '--'}</strong></span>
                    </div>
                `;
            } else {
                pDiv.innerHTML = '<span class="text-muted">No disponible</span>';
            }

            // Recommendations
            const recList = document.getElementById('det-recs');
            recList.innerHTML = '';
            const recs = output.recommendations?.actions || [];
            if (recs.length > 0) {
                recs.forEach(r => {
                    recList.innerHTML += `<li class="list-group-item bg-transparent text-white border-0 px-0 py-1"><i class="fas fa-check text-success me-2"></i>${r}</li>`;
                });
            } else {
                recList.innerHTML = '<li class="text-muted small">Sin recomendaciones.</li>';
            }

            // Photo Feedback
            const pf = output.photo_feedback;
            const pfContainer = document.getElementById('det-photo-feedback');

            if (!pf) {
                pfContainer.innerHTML = '<span class="text-muted">No hay feedback específico sobre las fotos.</span>';
            } else if (Array.isArray(pf)) {
                let html = '<ul class="list-unstyled mb-0">';
                pf.forEach(p => html += `<li class="mb-1"><i class="fas fa-comment-dots text-warning me-2 small"></i>${p}</li>`);
                html += '</ul>';
                pfContainer.innerHTML = html;
            } else {
                // Determine if it looks like a list
                let text = pf.toString();
                if (text.includes('\n-') || text.includes('\n•')) {
                    const lines = text.split(/\n/);
                    let html = '<ul class="list-unstyled mb-0">';
                    lines.forEach(line => {
                        const clean = line.trim().replace(/^[-•]\s*/, '');
                        if (clean) html += `<li class="mb-1"><i class="fas fa-angle-right text-warning me-2 small"></i>${clean}</li>`;
                    });
                    html += '</ul>';
                    pfContainer.innerHTML = html;
                } else {
                    // Plain text paragraphs
                    pfContainer.innerHTML = text.replace(/\n/g, '<br>');
                }
            }

            setupCompareTab(data);
        }

        function setupCompareTab(selectedData) {
            const tabBtn = document.getElementById('compare-tab-btn');
            const selectHistoryA = document.getElementById('compareHistoryA');
            const selectHistoryB = document.getElementById('compareHistoryB');
            const selectA = document.getElementById('compareImageA');
            const selectB = document.getElementById('compareImageB');
            const emptyMsg = document.getElementById('compareEmptyMsg');
            const side = document.getElementById('compareSideBySide');
            const sliderWrap = document.getElementById('compareSliderWrap');
            const slider = document.getElementById('compareSliderRange');

            if (!tabBtn || !selectA || !selectB || !selectHistoryA || !selectHistoryB) return;

            const allAssessments = Array.isArray(historyData) ? historyData : [];
            const validAssessments = allAssessments.filter(item => (item?.input?.photos || []).some(p => p && p.url));
            compareState.assessments = validAssessments;
            const hasTwo = validAssessments.length >= 2;

            tabBtn.disabled = !hasTwo;
            if (!hasTwo) {
                if (emptyMsg) emptyMsg.classList.remove('d-none');
                side?.classList.add('d-none');
                sliderWrap?.classList.add('d-none');
                slider?.classList.add('d-none');
                return;
            }
            if (emptyMsg) emptyMsg.classList.add('d-none');

            const selectedIdx = compareState.assessments.findIndex(item => (item?.id || null) === (selectedData?.id || null));
            const firstIdx = selectedIdx >= 0 ? selectedIdx : 0;
            let secondIdx = validAssessments.findIndex(item => (item?.id || null) !== (selectedData?.id || null));
            if (secondIdx < 0) secondIdx = Math.min(1, compareState.assessments.length - 1);

            compareState.aAssessmentIndex = firstIdx;
            compareState.bAssessmentIndex = secondIdx;
            compareState.aPhotoIndex = 0;
            compareState.bPhotoIndex = 0;
            compareState.slider = 50;
            compareState.transformA = { scale: 1, x: 0, y: 0 };
            compareState.transformB = { scale: 1, x: 0, y: 0 };

            selectHistoryA.innerHTML = '';
            selectHistoryB.innerHTML = '';
            compareState.assessments.forEach((item, idx) => {
                const goalRaw = (item?.input?.goal || 'general').toLowerCase();
                const goalLabel = goalRaw.replace(/_/g, ' ');
                const label = `${item?.date || 'Sin fecha'} · ${goalLabel}`;
                const optA = document.createElement('option');
                optA.value = String(idx);
                optA.textContent = label;
                const optB = optA.cloneNode(true);
                selectHistoryA.appendChild(optA);
                selectHistoryB.appendChild(optB);
            });
            selectHistoryA.value = String(compareState.aAssessmentIndex);
            selectHistoryB.value = String(compareState.bAssessmentIndex);

            populatePhotoSelect('A');
            populatePhotoSelect('B');

            if (!compareState.initialized) {
                bindCompareControls();
                compareState.initialized = true;
            }

            syncCompareControls();
            updateCompareImages();
            setCompareView(compareState.mode);
        }

        function bindCompareControls() {
            const selectHistoryA = document.getElementById('compareHistoryA');
            const selectHistoryB = document.getElementById('compareHistoryB');
            const selectA = document.getElementById('compareImageA');
            const selectB = document.getElementById('compareImageB');
            const btnSide = document.getElementById('compareViewSide');
            const btnSlider = document.getElementById('compareViewSlider');
            const slider = document.getElementById('compareSliderRange');
            const modeBlend = document.getElementById('compareModeBlend');
            const modeWipe = document.getElementById('compareModeWipe');
            const scaleA = document.getElementById('compareScaleA');
            const xA = document.getElementById('compareXA');
            const yA = document.getElementById('compareYA');
            const scaleA_side = document.getElementById('compareScaleA_side');
            const xA_side = document.getElementById('compareXA_side');
            const yA_side = document.getElementById('compareYA_side');
            const scaleB_side = document.getElementById('compareScaleB_side');
            const xB_side = document.getElementById('compareXB_side');
            const yB_side = document.getElementById('compareYB_side');
            const adjustToggle = document.getElementById('compareAdjustToggle');
            const adjustPanel = document.getElementById('compareAdjustPanel');
            const adjustToggleSideA = document.getElementById('compareAdjustToggleSideA');
            const adjustPanelSideA = document.getElementById('compareAdjustPanelSideA');
            const adjustToggleSideB = document.getElementById('compareAdjustToggleSideB');
            const adjustPanelSideB = document.getElementById('compareAdjustPanelSideB');
            const resetSideA = document.getElementById('compareResetSideA');
            const resetSideB = document.getElementById('compareResetSideB');
            const resetSlider = document.getElementById('compareResetSlider');
            const sliderResetBtn = document.getElementById('compareSliderReset');
            const btnAdjustA = document.getElementById('compareAdjustA');
            const btnAdjustB = document.getElementById('compareAdjustB');
            const exportBtn = document.getElementById('compareExportBtn');
            const exportRatio = document.getElementById('compareExportRatio');
            const collageExportBtn = document.getElementById('compareCollageExportBtn');
            const collageLayout = document.getElementById('compareCollageLayout');
            const collageFit = document.getElementById('compareCollageFit');
            const collagePadding = document.getElementById('compareCollagePadding');

            selectHistoryA?.addEventListener('change', (e) => {
                compareState.aAssessmentIndex = parseInt(e.target.value, 10) || 0;
                if (compareState.aAssessmentIndex === compareState.bAssessmentIndex) {
                    compareState.bAssessmentIndex = (compareState.aAssessmentIndex + 1) % compareState.assessments.length;
                    selectHistoryB.value = String(compareState.bAssessmentIndex);
                }
                compareState.aPhotoIndex = 0;
                compareState.transformA = { scale: 1, x: 0, y: 0 };
                populatePhotoSelect('A');
                syncCompareControls();
                updateCompareImages();
            });

            selectHistoryB?.addEventListener('change', (e) => {
                compareState.bAssessmentIndex = parseInt(e.target.value, 10) || 0;
                if (compareState.bAssessmentIndex === compareState.aAssessmentIndex) {
                    compareState.aAssessmentIndex = (compareState.bAssessmentIndex + 1) % compareState.assessments.length;
                    selectHistoryA.value = String(compareState.aAssessmentIndex);
                }
                compareState.bPhotoIndex = 0;
                compareState.transformB = { scale: 1, x: 0, y: 0 };
                populatePhotoSelect('B');
                syncCompareControls();
                updateCompareImages();
            });

            selectA?.addEventListener('change', (e) => {
                compareState.aPhotoIndex = parseInt(e.target.value, 10) || 0;
                compareState.transformA = { scale: 1, x: 0, y: 0 };
                syncCompareControls();
                updateCompareImages();
            });

            selectB?.addEventListener('change', (e) => {
                compareState.bPhotoIndex = parseInt(e.target.value, 10) || 0;
                compareState.transformB = { scale: 1, x: 0, y: 0 };
                syncCompareControls();
                updateCompareImages();
            });

            btnSide?.addEventListener('click', () => setCompareView('side'));
            btnSlider?.addEventListener('click', () => setCompareView('slider'));
            modeBlend?.addEventListener('click', () => {
                compareState.sliderMode = 'blend';
                modeBlend.classList.add('active');
                modeWipe?.classList.remove('active');
                updateCompareImages();
                updateOverlayWidth();
                applyMorphOpacity();
            });
            modeWipe?.addEventListener('click', () => {
                compareState.sliderMode = 'wipe';
                modeWipe.classList.add('active');
                modeBlend?.classList.remove('active');
                updateCompareImages();
                updateOverlayWidth();
                applyMorphOpacity();
            });

            const compareTabBtn = document.getElementById('compare-tab-btn');
            compareTabBtn?.addEventListener('shown.bs.tab', () => {
                compareState.slider = 50;
                if (slider) slider.value = '50';
                updateOverlayWidth();
                applyMorphOpacity();
            });

            slider?.addEventListener('input', (e) => {
                const nextValue = parseInt(e.target.value, 10);
                compareState.slider = Number.isNaN(nextValue) ? 50 : nextValue;
                updateOverlayWidth();
                applyMorphOpacity();
            });

            const onSliderTransformChange = () => {
                const next = {
                    scale: (parseInt(scaleA?.value || '100', 10) || 100) / 100,
                    x: parseInt(xA?.value || '0', 10) || 0,
                    y: parseInt(yA?.value || '0', 10) || 0
                };
                if (compareState.activeAdjust === 'A') {
                    compareState.transformA = next;
                } else {
                    compareState.transformB = next;
                }
                applyCompareTransforms();
            };

            const onSideTransformChange = () => {
                compareState.transformA = {
                    scale: (parseInt(scaleA_side?.value || '100', 10) || 100) / 100,
                    x: parseInt(xA_side?.value || '0', 10) || 0,
                    y: parseInt(yA_side?.value || '0', 10) || 0
                };
                compareState.transformB = {
                    scale: (parseInt(scaleB_side?.value || '100', 10) || 100) / 100,
                    x: parseInt(xB_side?.value || '0', 10) || 0,
                    y: parseInt(yB_side?.value || '0', 10) || 0
                };
                applyCompareTransforms();
            };

            [scaleA, xA, yA].forEach(el => {
                el?.addEventListener('input', onSliderTransformChange);
            });
            [scaleA_side, xA_side, yA_side, scaleB_side, xB_side, yB_side].forEach(el => {
                el?.addEventListener('input', onSideTransformChange);
            });

            adjustToggle?.addEventListener('click', () => {
                adjustPanel?.classList.toggle('d-none');
            });
            adjustToggleSideA?.addEventListener('click', () => {
                adjustPanelSideA?.classList.toggle('d-none');
            });
            adjustToggleSideB?.addEventListener('click', () => {
                adjustPanelSideB?.classList.toggle('d-none');
            });
            resetSideA?.addEventListener('click', () => {
                compareState.transformA = { scale: 1, x: 0, y: 0 };
                syncCompareControls();
                applyCompareTransforms();
            });
            resetSideB?.addEventListener('click', () => {
                compareState.transformB = { scale: 1, x: 0, y: 0 };
                syncCompareControls();
                applyCompareTransforms();
            });
            resetSlider?.addEventListener('click', () => {
                if (compareState.activeAdjust === 'A') {
                    compareState.transformA = { scale: 1, x: 0, y: 0 };
                } else {
                    compareState.transformB = { scale: 1, x: 0, y: 0 };
                }
                syncCompareControls();
                applyCompareTransforms();
            });

            sliderResetBtn?.addEventListener('click', () => {
                compareState.slider = 50;
                const sliderInput = document.getElementById('compareSliderRange');
                if (sliderInput) sliderInput.value = '50';
                applyMorphOpacity();
                updateOverlayWidth();
            });

            btnAdjustA?.addEventListener('click', () => {
                compareState.activeAdjust = 'A';
                btnAdjustA.classList.add('active');
                btnAdjustB?.classList.remove('active');
                syncCompareControls();
            });
            btnAdjustB?.addEventListener('click', () => {
                compareState.activeAdjust = 'B';
                btnAdjustB.classList.add('active');
                btnAdjustA?.classList.remove('active');
                syncCompareControls();
            });

            exportBtn?.addEventListener('click', async () => {
                try {
                    const assessA = compareState.assessments[compareState.aAssessmentIndex] || {};
                    const assessB = compareState.assessments[compareState.bAssessmentIndex] || {};
                    const photosA = Array.isArray(assessA?.input?.photos) ? assessA.input.photos.filter(p => p && p.url) : [];
                    const photosB = Array.isArray(assessB?.input?.photos) ? assessB.input.photos.filter(p => p && p.url) : [];
                    const photoA = photosA[compareState.aPhotoIndex];
                    const photoB = photosB[compareState.bPhotoIndex];

                    if (!photoA?.url || !photoB?.url) {
                        if (window.showAlertModal) {
                            window.showAlertModal("Aviso", "Selecciona dos imágenes válidas para exportar.", "warning");
                        } else {
                            window.alert("Selecciona dos imágenes válidas para exportar.");
                        }
                        return;
                    }

                    let width = EXPORT_FALLBACK_WIDTH;
                    let height = EXPORT_FALLBACK_HEIGHT;
                    let sourceWidth = 0;
                    let sourceHeight = 0;
                    const ratioValue = exportRatio?.value || "4:5";
                    const size = COLLAGE_SIZES[ratioValue];
                    if (size) {
                        width = size.width;
                        height = size.height;
                    } else {
                        const sliderWrap = document.getElementById('compareSliderWrap');
                        const sideWrap = document.getElementById('compareSideBySide');
                        if (compareState.mode === 'slider' && sliderWrap) {
                            const rect = sliderWrap.getBoundingClientRect();
                            width = Math.round(rect.width) || width;
                            height = Math.round(rect.height) || height;
                            sourceWidth = width;
                            sourceHeight = height;
                        } else if (sideWrap) {
                            const frame = sideWrap.querySelector('.compare-frame');
                            if (frame) {
                                const rect = frame.getBoundingClientRect();
                                width = Math.round(rect.width) || width;
                                height = Math.round(rect.height) || height;
                                sourceWidth = width;
                                sourceHeight = height;
                            }
                        }
                    }
                    if (!sourceWidth || !sourceHeight) {
                        const sliderWrap = document.getElementById('compareSliderWrap');
                        const sideWrap = document.getElementById('compareSideBySide');
                        if (compareState.mode === 'slider' && sliderWrap) {
                            const rect = sliderWrap.getBoundingClientRect();
                            sourceWidth = Math.round(rect.width) || width;
                            sourceHeight = Math.round(rect.height) || height;
                        } else if (sideWrap) {
                            const frame = sideWrap.querySelector('.compare-frame');
                            if (frame) {
                                const rect = frame.getBoundingClientRect();
                                sourceWidth = Math.round(rect.width) || width;
                                sourceHeight = Math.round(rect.height) || height;
                            }
                        }
                    }

                    const payload = {
                        ratio: ratioValue,
                        mode: compareState.sliderMode,
                        slider: compareState.slider,
                        width,
                        height,
                        sourceWidth,
                        sourceHeight,
                        imageAUrl: photoA.url,
                        imageBUrl: photoB.url,
                        transformA: { ...compareState.transformA },
                        transformB: { ...compareState.transformB }
                    };

                    if (typeof showLoader === 'function') {
                        showLoader("Exportando comparación...");
                    }
                    const resp = await fetch('/ai/body_assessment/compare/export', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (!resp.ok) {
                        const err = await resp.json().catch(() => ({}));
                        throw new Error(err.error || "No se pudo exportar la comparación.");
                    }
                    const blob = await resp.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
                    a.href = url;
                    a.download = `comparacion_${stamp}.png`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                } catch (err) {
                    const message = err?.message || "Error exportando la comparación.";
                    if (window.showAlertModal) {
                        window.showAlertModal("Error", message, "danger");
                    } else {
                        window.alert(message);
                    }
                } finally {
                    if (typeof hideLoader === 'function') {
                        hideLoader();
                    }
                }
            });

            collageExportBtn?.addEventListener('click', async () => {
                try {
                    const assessA = compareState.assessments[compareState.aAssessmentIndex] || {};
                    const assessB = compareState.assessments[compareState.bAssessmentIndex] || {};
                    const photosA = Array.isArray(assessA?.input?.photos) ? assessA.input.photos.filter(p => p && p.url) : [];
                    const photosB = Array.isArray(assessB?.input?.photos) ? assessB.input.photos.filter(p => p && p.url) : [];
                    const photoA = photosA[compareState.aPhotoIndex];
                    const photoB = photosB[compareState.bPhotoIndex];

                    if (!photoA?.url || !photoB?.url) {
                        if (window.showAlertModal) {
                            window.showAlertModal("Aviso", "Selecciona dos imágenes válidas para exportar.", "warning");
                        } else {
                            window.alert("Selecciona dos imágenes válidas para exportar.");
                        }
                        return;
                    }

                    const ratioValue = exportRatio?.value || "4:5";
                    const size = COLLAGE_SIZES[ratioValue] || COLLAGE_SIZES["4:5"];
                    const layoutValue = collageLayout?.value || "vertical";
                    const fitValue = collageFit?.value || "contain";
                    const paddingValue = parseInt(collagePadding?.value || "16", 10) || 0;

                    let sourceWidth = 0;
                    let sourceHeight = 0;
                    const sliderWrap = document.getElementById('compareSliderWrap');
                    const sideWrap = document.getElementById('compareSideBySide');
                    if (compareState.mode === 'slider' && sliderWrap) {
                        const rect = sliderWrap.getBoundingClientRect();
                        sourceWidth = Math.round(rect.width) || sourceWidth;
                        sourceHeight = Math.round(rect.height) || sourceHeight;
                    } else if (sideWrap) {
                        const frame = sideWrap.querySelector('.compare-frame');
                        if (frame) {
                            const rect = frame.getBoundingClientRect();
                            sourceWidth = Math.round(rect.width) || sourceWidth;
                            sourceHeight = Math.round(rect.height) || sourceHeight;
                        }
                    }

                    const payload = {
                        width: size.width,
                        height: size.height,
                        layout: layoutValue,
                        fit: fitValue,
                        padding: paddingValue,
                        sourceWidth,
                        sourceHeight,
                        imageAUrl: photoA.url,
                        imageBUrl: photoB.url,
                        transformA: { ...compareState.transformA },
                        transformB: { ...compareState.transformB }
                    };

                    if (typeof showLoader === 'function') {
                        showLoader("Exportando collage...");
                    }
                    const resp = await fetch('/ai/body_assessment/compare/collage', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (!resp.ok) {
                        const err = await resp.json().catch(() => ({}));
                        throw new Error(err.error || "No se pudo exportar el collage.");
                    }
                    const blob = await resp.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
                    a.href = url;
                    a.download = `collage_${ratioValue.replace(':', 'x')}_${stamp}.png`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                } catch (err) {
                    const message = err?.message || "Error exportando el collage.";
                    if (window.showAlertModal) {
                        window.showAlertModal("Error", message, "danger");
                    } else {
                        window.alert(message);
                    }
                } finally {
                    if (typeof hideLoader === 'function') {
                        hideLoader();
                    }
                }
            });

            document.addEventListener('click', (event) => {
                const target = event.target;
                const inSliderPanel = target.closest('#compareAdjustPanel') || target.closest('#compareAdjustToggle');
                const inSidePanelA = target.closest('#compareAdjustPanelSideA') || target.closest('#compareAdjustToggleSideA');
                const inSidePanelB = target.closest('#compareAdjustPanelSideB') || target.closest('#compareAdjustToggleSideB');
                if (!inSliderPanel) adjustPanel?.classList.add('d-none');
                if (!inSidePanelA) adjustPanelSideA?.classList.add('d-none');
                if (!inSidePanelB) adjustPanelSideB?.classList.add('d-none');
            });
        }

        function populatePhotoSelect(which) {
            const select = document.getElementById(which === 'A' ? 'compareImageA' : 'compareImageB');
            if (!select) return;
            const assessmentIndex = which === 'A' ? compareState.aAssessmentIndex : compareState.bAssessmentIndex;
            const assessment = compareState.assessments[assessmentIndex] || {};
            const photos = Array.isArray(assessment?.input?.photos) ? assessment.input.photos.filter(p => p && p.url) : [];
            select.innerHTML = '';
            photos.forEach((ph, idx) => {
                const label = ph.label || ph.type || `Foto ${idx + 1}`;
                const opt = document.createElement('option');
                opt.value = String(idx);
                opt.textContent = label;
                select.appendChild(opt);
            });
            if (which === 'A') {
                compareState.aPhotoIndex = 0;
                select.value = '0';
            } else {
                compareState.bPhotoIndex = 0;
                select.value = '0';
            }
        }

        function syncCompareControls() {
            const slider = document.getElementById('compareSliderRange');
            const scaleA = document.getElementById('compareScaleA');
            const xA = document.getElementById('compareXA');
            const yA = document.getElementById('compareYA');
            const btnAdjustA = document.getElementById('compareAdjustA');
            const btnAdjustB = document.getElementById('compareAdjustB');
            const scaleA_side = document.getElementById('compareScaleA_side');
            const xA_side = document.getElementById('compareXA_side');
            const yA_side = document.getElementById('compareYA_side');
            const scaleB_side = document.getElementById('compareScaleB_side');
            const xB_side = document.getElementById('compareXB_side');
            const yB_side = document.getElementById('compareYB_side');

            if (slider) slider.value = String(compareState.slider);
            if (scaleA && compareState.activeAdjust === 'A') scaleA.value = String(compareState.transformA.scale * 100);
            if (xA && compareState.activeAdjust === 'A') xA.value = String(compareState.transformA.x);
            if (yA && compareState.activeAdjust === 'A') yA.value = String(compareState.transformA.y);
            if (scaleA && compareState.activeAdjust === 'B') scaleA.value = String(compareState.transformB.scale * 100);
            if (xA && compareState.activeAdjust === 'B') xA.value = String(compareState.transformB.x);
            if (yA && compareState.activeAdjust === 'B') yA.value = String(compareState.transformB.y);
            if (scaleA_side) scaleA_side.value = String(compareState.transformA.scale * 100);
            if (xA_side) xA_side.value = String(compareState.transformA.x);
            if (yA_side) yA_side.value = String(compareState.transformA.y);
            if (scaleB_side) scaleB_side.value = String(compareState.transformB.scale * 100);
            if (xB_side) xB_side.value = String(compareState.transformB.x);
            if (yB_side) yB_side.value = String(compareState.transformB.y);
            if (btnAdjustA && btnAdjustB) {
                if (compareState.activeAdjust === 'A') {
                    btnAdjustA.classList.add('active');
                    btnAdjustB.classList.remove('active');
                } else {
                    btnAdjustB.classList.add('active');
                    btnAdjustA.classList.remove('active');
                }
            }
        }

        function setCompareView(mode) {
            compareState.mode = mode;
            const side = document.getElementById('compareSideBySide');
            const sliderWrap = document.getElementById('compareSliderWrap');
            const slider = document.getElementById('compareSliderRange');
            const sliderResetWrap = document.getElementById('compareSliderResetWrap');
            const btnSide = document.getElementById('compareViewSide');
            const btnSlider = document.getElementById('compareViewSlider');
            const modeControls = document.getElementById('compareModeControls');

            if (mode === 'slider') {
                side?.classList.add('d-none');
                sliderWrap?.classList.remove('d-none');
                slider?.classList.remove('d-none');
                sliderResetWrap?.classList.remove('d-none');
                btnSide?.classList.remove('active');
                btnSlider?.classList.add('active');
                compareState.activeAdjust = 'A';
                if (modeControls) {
                    modeControls.classList.remove('disabled');
                    modeControls.classList.remove('d-none');
                }
                syncCompareControls();
                if (compareState.sliderMode === 'wipe') {
                    document.getElementById('compareModeWipe')?.classList.add('active');
                    document.getElementById('compareModeBlend')?.classList.remove('active');
                } else {
                    document.getElementById('compareModeBlend')?.classList.add('active');
                    document.getElementById('compareModeWipe')?.classList.remove('active');
                }
                applyMorphOpacity();
                updateOverlayWidth();
            } else {
                side?.classList.remove('d-none');
                sliderWrap?.classList.add('d-none');
                slider?.classList.add('d-none');
                sliderResetWrap?.classList.add('d-none');
                btnSlider?.classList.remove('active');
                btnSide?.classList.add('active');
                if (modeControls) {
                    modeControls.classList.add('disabled');
                    modeControls.classList.add('d-none');
                }
            }
        }

function updateOverlayWidth() {
    const overlay = document.getElementById('compareOverlay');
    const overlayImg = document.getElementById('compareOverlayImg');
    const handle = document.getElementById('compareSliderHandle');
    const sliderWrap = document.getElementById('compareSliderWrap');
    if (!overlay) return;
    if (compareState.sliderMode === 'wipe') {
        overlay.style.width = `100%`;
        overlay.style.borderRight = '0';
        sliderWrap?.classList.add('wipe-mode');
        if (overlayImg) {
            overlayImg.style.clipPath = `inset(0 0 0 ${compareState.slider}%)`;
        }
    } else {
        overlay.style.width = `100%`;
        overlay.style.borderRight = '0';
        sliderWrap?.classList.remove('wipe-mode');
        if (overlayImg) overlayImg.style.clipPath = '';
    }
    if (handle) {
        handle.style.left = `${compareState.slider}%`;
            }
        }

function updateCompareImages() {
    const imgA = document.getElementById('compareImgA');
    const imgB = document.getElementById('compareImgB');
    const base = document.getElementById('compareBaseImg');
    const overlay = document.getElementById('compareOverlayImg');
            const assessA = compareState.assessments[compareState.aAssessmentIndex] || {};
            const assessB = compareState.assessments[compareState.bAssessmentIndex] || {};
            const photosA = Array.isArray(assessA?.input?.photos) ? assessA.input.photos.filter(p => p && p.url) : [];
            const photosB = Array.isArray(assessB?.input?.photos) ? assessB.input.photos.filter(p => p && p.url) : [];
            const photoA = photosA[compareState.aPhotoIndex];
            const photoB = photosB[compareState.bPhotoIndex];

            if (imgA && photoA) imgA.src = photoA.url;
            if (imgB && photoB) imgB.src = photoB.url;
    if (base && photoA) base.src = photoA.url;
    if (overlay && photoB) overlay.src = photoB.url;

    applyMorphOpacity();
    applyCompareTransforms();
}

        function applyMorphOpacity() {
            const base = document.getElementById('compareBaseImg');
            const overlay = document.getElementById('compareOverlayImg');
            if (!base || !overlay) return;
            const value = Math.max(0, Math.min(100, compareState.slider));
            const ratio = value / 100;
            if (compareState.sliderMode === 'wipe') {
                base.style.opacity = '1';
                overlay.style.opacity = '1';
            } else {
                base.style.opacity = (1 - ratio).toString();
                overlay.style.opacity = ratio.toString();
            }
        }

function applyCompareTransforms() {
    const imgA = document.getElementById('compareImgA');
    const imgB = document.getElementById('compareImgB');
    const base = document.getElementById('compareBaseImg');
    const overlay = document.getElementById('compareOverlayImg');

            const tA = `translate(${compareState.transformA.x}px, ${compareState.transformA.y}px) scale(${compareState.transformA.scale})`;
            const tB = `translate(${compareState.transformB.x}px, ${compareState.transformB.y}px) scale(${compareState.transformB.scale})`;

            if (imgA) imgA.style.transform = tA;
            if (imgB) imgB.style.transform = tB;
    if (base) base.style.transform = tA;
    if (overlay) overlay.style.transform = tB;
}

        const zoomModal = new bootstrap.Modal(document.getElementById('imageZoomModal'));
        function openZoom(src) {
            document.getElementById('zoomedImage').src = src;
            zoomModal.show();
        }

        function printReport() {
            window.print();
        }

        async function confirmDeleteAssessment() {
            if (!selectedAssessmentId) return;
            let ok = false;
            if (window.showConfirmModal) {
                ok = await window.showConfirmModal("Confirmar", "¿Eliminar esta evaluacion? Esta accion no se puede deshacer.", "danger");
            } else {
                ok = window.confirm("¿Eliminar esta evaluacion? Esta accion no se puede deshacer.");
            }
            if (!ok) return;
            showLoader("Eliminando evaluacion...");
            try {
                const resp = await fetch(`/ai/body_assessment/history/${selectedAssessmentId}`, { method: "DELETE" });
                if (!resp.ok) {
                    const err = await resp.json().catch(() => ({}));
                    throw new Error(err.error || "Error eliminando evaluacion");
                }
                historyData = historyData.filter(item => item.id !== selectedAssessmentId);
                selectedAssessmentId = null;
                renderList();
                if (historyData.length === 0) {
                    document.getElementById('detail-container').style.setProperty('display', 'none', 'important');
                    document.getElementById('empty-state').style.setProperty('display', 'flex', 'important');
                }
            } catch (e) {
                if (window.showAlertModal) {
                    window.showAlertModal("Error", e.message || "Error eliminando evaluacion", "danger");
                } else {
                    window.alert(e.message || "Error eliminando evaluacion");
                }
            } finally {
                hideLoader();
            }
        }
