(function () {
    let sessionData = [];
    let sessionWeightUnit = "kg";
    const sessionWeightUnitKey = "ai_fitness_session_unit";

    const formatDate = (value) => {
        const d = value ? new Date(value) : null;
        if (!d || Number.isNaN(d.getTime())) return "-";
        return d.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
    };

    const formatWeightValue = (value) => {
        const weight = Number(value);
        if (!Number.isFinite(weight)) return "-";
        if (sessionWeightUnit === "lb") {
            const lb = weight * 2.20462;
            return lb % 1 === 0 ? lb.toString() : lb.toFixed(1);
        }
        return weight % 1 === 0 ? weight.toString() : weight.toFixed(1);
    };

    const formatVolumeValue = (value) => {
        const volume = Number(value);
        if (!Number.isFinite(volume)) return "0";
        if (sessionWeightUnit === "lb") {
            const lbVol = volume * 2.20462;
            return lbVol % 1 === 0 ? lbVol.toString() : lbVol.toFixed(1);
        }
        return volume % 1 === 0 ? volume.toString() : volume.toFixed(1);
    };

    const renderSessions = (data) => {
        const container = document.getElementById("sessionsList");
        if (!container) return;

        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = `<p class="text-muted text-center m-0">Aún no hay sesiones registradas.</p>`;
            return;
        }

        container.innerHTML = data.map((session, index) => {
            const sets = Array.isArray(session.sets) ? session.sets : [];
            const totalSets = sets.length;
            const duration = session.duration_seconds
                ? `${Math.floor(session.duration_seconds / 60)}min`
                : '-';

            // Group sets by exercise
            const exerciseGroups = {};
            sets.forEach(set => {
                const exId = set.exercise_id || set.exerciseId || 'unknown';
                if (!exerciseGroups[exId]) {
                    exerciseGroups[exId] = {
                        name: set.name || set.exercise_name || set.exerciseName || set.exercise_id || set.exerciseId || 'Ejercicio',
                        sets: []
                    };
                }
                exerciseGroups[exId].sets.push(set);
            });

            const detailsRows = Object.entries(exerciseGroups).flatMap(([exId, group]) => {
                return group.sets.map((set, idx) => {
                    const timeValue = set.time_seconds != null ? set.time_seconds : set.time;
                    return `
                        <tr class="text-center">
                            <td class="text-start">${group.name}</td>
                            <td>${idx + 1}</td>
                            <td>${set.weight != null && set.weight !== '' ? formatWeightValue(set.weight) : '-'}</td>
                            <td>${set.reps || '-'}</td>
                            <td>${timeValue != null ? `${timeValue}s` : '-'}</td>
                            <td>${set.rpe || '-'}</td>
                        </tr>
                    `;
                });
            }).join('');

            const detailsHtml = `
                <div class="table-responsive">
                    <table class="table table-sm table-dark table-bordered mb-0">
                        <thead>
                            <tr class="text-center">
                                <th>Ejercicio</th>
                                <th>Serie</th>
                                <th>Peso (${sessionWeightUnit})</th>
                                <th>Reps</th>
                                <th>Tiempo</th>
                                <th>RPE</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${detailsRows || `
                                <tr class="text-center">
                                    <td colspan="6" class="text-muted">No hay detalles de ejercicios disponibles.</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            `;

            return `
                <div class="border border-secondary rounded mb-3 bg-dark-elem">
                    <div class="d-flex justify-content-between align-items-center p-3 cursor-pointer" 
                         onclick="window.toggleSessionDetails(${index})" 
                         style="cursor: pointer;">
                        <div>
                            <div class="text-white fw-bold">
                                <i class="fas fa-dumbbell text-cyber-green me-2"></i>
                                ${session.routine_name || session.routine_id || 'Rutina'}
                            </div>
                            <div class="text-secondary small">
                                <i class="far fa-calendar me-1"></i>
                                ${formatDate(session.start_time || session.created_at)}
                            </div>
                        </div>
                        <div class="text-end">
                            <div class="mb-2 d-flex justify-content-end">
                                <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); window.deleteSession('${session._id}', ${index});">
                                    <i class="fas fa-trash-alt me-1"></i>Eliminar
                                </button>
                            </div>
                            <div class="text-secondary small">
                                <span class="me-3">
                                    <i class="fas fa-weight-hanging text-cyber-blue me-1"></i>
                                    <span class="text-white">${formatVolumeValue(session.total_volume || 0)}</span> ${sessionWeightUnit}
                                </span>
                                <span class="me-3">
                                    <i class="fas fa-list text-cyber-orange me-1"></i>
                                    <span class="text-white">${totalSets}</span> series
                                </span>
                                <span>
                                    <i class="far fa-clock text-cyber-green me-1"></i>
                                    <span class="text-white">${duration}</span>
                                </span>
                            </div>
                            <div class="text-secondary small mt-1">
                                <i id="chevron-${index}" class="fas fa-chevron-down"></i>
                                <span class="ms-1">Ver detalles</span>
                            </div>
                        </div>
                    </div>
                    <div id="session-details-${index}" class="p-3 pt-0" style="display: none;">
                        <hr class="border-secondary my-2">
                        ${session.body_weight ? `
                            <div class="mb-3 text-secondary small">
                                <i class="fas fa-user text-cyber-orange me-2"></i>
                                Peso corporal: <span class="text-white">${formatWeightValue(session.body_weight)}</span> ${sessionWeightUnit}
                            </div>
                        ` : ''}
                        ${detailsHtml || '<p class="text-muted small">No hay detalles de ejercicios disponibles.</p>'}
                    </div>
                </div>
            `;
        }).join('');
    };

    window.toggleSessionDetails = function (index) {
        const details = document.getElementById(`session-details-${index}`);
        const chevron = document.getElementById(`chevron-${index}`);
        if (!details || !chevron) return;

        if (details.style.display === 'none') {
            details.style.display = 'block';
            chevron.classList.remove('fa-chevron-down');
            chevron.classList.add('fa-chevron-up');
        } else {
            details.style.display = 'none';
            chevron.classList.remove('fa-chevron-up');
            chevron.classList.add('fa-chevron-down');
        }
    };

    window.deleteSession = async function (sessionId, index) {
        if (!sessionId) return;
        if (typeof showConfirmModal !== 'function') {
            if (!confirm("¿Estás seguro de eliminar esta sesión?")) return;
        } else {
            const confirmed = await showConfirmModal("Eliminar sesión", "¿Estás seguro de eliminar esta sesión? Esta acción no se puede deshacer.", "danger");
            if (!confirmed) return;
        }

        try {
            const res = await fetch(`/workout/api/sessions/${sessionId}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (typeof showAlertModal === 'function') {
                    showAlertModal("No se pudo eliminar", data.error || "No se pudo eliminar la sesión.", "warning");
                } else {
                    alert(data.error || "No se pudo eliminar la sesión.");
                }
                return;
            }
            sessionData.splice(index, 1);
            renderSessions(sessionData);
        } catch (e) {
            console.error("Error deleting session:", e);
            if (typeof showAlertModal === 'function') {
                showAlertModal("Error", "Error eliminando la sesión.", "danger");
            } else {
                alert("Error eliminando la sesión.");
            }
        }
    };

    window.setSessionWeightUnit = function (unit) {
        sessionWeightUnit = unit;
        try {
            localStorage.setItem(sessionWeightUnitKey, unit);
        } catch (e) { }
        const kgBtn = document.getElementById("unitKgBtn");
        const lbBtn = document.getElementById("unitLbBtn");
        if (kgBtn && lbBtn) {
            kgBtn.classList.toggle("btn-info", unit === "kg");
            kgBtn.classList.toggle("text-dark", unit === "kg");
            kgBtn.classList.toggle("btn-outline-secondary", unit !== "kg");
            lbBtn.classList.toggle("btn-info", unit === "lb");
            lbBtn.classList.toggle("text-dark", unit === "lb");
            lbBtn.classList.toggle("btn-outline-secondary", unit !== "lb");
        }
        renderSessions(sessionData);
    };

    window.initSessionUnitControls = function () {
        const storedUnit = localStorage.getItem(sessionWeightUnitKey);
        if (storedUnit === "kg" || storedUnit === "lb") {
            sessionWeightUnit = storedUnit;
        }
        const kgBtn = document.getElementById("unitKgBtn");
        const lbBtn = document.getElementById("unitLbBtn");
        if (kgBtn) kgBtn.addEventListener("click", () => window.setSessionWeightUnit("kg"));
        if (lbBtn) lbBtn.addEventListener("click", () => window.setSessionWeightUnit("lb"));
        window.setSessionWeightUnit(sessionWeightUnit);
    };

    window.loadSessions = async function (userId) {
        const container = document.getElementById("sessionsList");
        const section = document.getElementById("session-history-section");
        if (!container) return;
        if (section) section.style.display = 'block';

        try {
            const res = await fetch(`/workout/api/sessions?user_id=${userId}`);
            const data = await res.json();
            sessionData = Array.isArray(data) ? data : [];
            renderSessions(sessionData);
        } catch (e) {
            console.error("Error loading sessions:", e);
            container.innerHTML = `<p class="text-danger text-center m-0">Error cargando sesiones.</p>`;
        }
    };
})();
