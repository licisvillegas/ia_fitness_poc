(function () {
    let sessionData = [];
    let sessionWeightUnit = "lb";
    let sessionFilterRange = "month";
    let sessionFilterValue = "";
    const sessionWeightUnitKey = "ai_fitness_session_unit";

    const formatDate = (value) => {
        const d = value ? new Date(value) : null;
        if (!d || Number.isNaN(d.getTime())) return "-";
        return d.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
    };

    const formatWeightValue = (value) => {
        const weight = Number(value);
        if (!Number.isFinite(weight)) return "-";
        const toDisplay = sessionWeightUnit === "lb" ? weight * 2.20462 : weight;
        return Math.round(toDisplay).toString();
    };

    const formatVolumeValue = (value) => {
        const volume = Number(value);
        if (!Number.isFinite(volume)) return "0";
        const toDisplay = sessionWeightUnit === "lb" ? volume * 2.20462 : volume;
        return Math.round(toDisplay).toString();
    };

    const formatDuration = (seconds) => {
        const sec = Math.round(Number(seconds));
        if (Number.isNaN(sec) || sec <= 0) return "-";
        if (sec < 60) return `${sec}s`;
        if (sec < 3600) return `${Math.floor(sec / 60)}min`;
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return `${h}h ${m}min`;
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
            const avgWeight = (() => {
                const weights = sets
                    .map(set => Number(set.weight))
                    .filter(weight => Number.isFinite(weight) && weight > 0);
                if (!weights.length) return null;
                const sum = weights.reduce((acc, value) => acc + value, 0);
                return sum / weights.length;
            })();

            // Duration: Sum of set durations (Active Time) or fallback to wall clock
            let totalSeconds = 0;
            sets.forEach(s => totalSeconds += Number(s.duration_seconds || 0));

            // If explicit set durations exist, use sum. Otherwise check session.duration_seconds
            const displayDuration = totalSeconds > 0
                ? formatDuration(totalSeconds)
                : (session.duration_seconds ? formatDuration(session.duration_seconds) : '-');

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
                            <td>${set.duration_seconds ? formatDuration(set.duration_seconds) : (timeValue != null ? `${timeValue}s` : '-')}</td>
                            <td>${set.rpe || '-'}</td>
                        </tr>
                    `;
                });
            }).join('');

            const detailsHtml = `
                <div class="table-responsive">
                    <table class="table table-sm table-dark table-hover mb-0">
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

            const routineLabel = session.routine_name || session.routine_title || session.routine || session.name || "Rutina";
            return `
                <div class="border border-secondary rounded mb-3 bg-card shadow-sm">
                    <div class="d-flex justify-content-between align-items-center p-3 cursor-pointer" 
                         onclick="window.toggleSessionDetails(${index})" 
                         style="cursor: pointer;">
                        <div>
                            <div class="text-theme fw-bold">
                                <i class="fas fa-dumbbell text-cyber-green me-2"></i>
                                ${routineLabel}
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
                                    <span class="text-theme">${avgWeight != null ? formatWeightValue(avgWeight) : '-'}</span> ${sessionWeightUnit}
                                </span>
                                <span class="me-3">
                                    <i class="fas fa-list text-cyber-orange me-1"></i>
                                    <span class="text-theme">${totalSets}</span> series
                                </span>
                                <span>
                                    <i class="far fa-clock text-cyber-green me-1"></i>
                                    <span class="text-theme">${displayDuration}</span>
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
                                Peso corporal: <span class="text-theme">${formatWeightValue(session.body_weight)}</span> ${sessionWeightUnit}
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

    const applySessionFilters = () => {
        const filtered = filterSessionsByRange(sessionData, sessionFilterRange, sessionFilterValue);
        renderSessions(filtered);
    };

    const getSessionDate = (session) => {
        const raw = session.start_time || session.created_at || session.date;
        const d = raw ? new Date(raw) : null;
        if (!d || Number.isNaN(d.getTime())) return null;
        return d;
    };

    const getWeekKey = (date) => {
        const d = new Date(date.getTime());
        const day = d.getDay();
        const diff = (day === 0 ? -6 : 1) - day;
        d.setDate(d.getDate() + diff);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
        const fmt = (value) => value.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
        return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}|${fmt(start)} - ${fmt(end)}`;
    };

    const getDayKey = (date) => {
        const key = date.toLocaleDateString("es-ES", { year: "numeric", month: "2-digit", day: "2-digit" });
        return `${date.toISOString().slice(0, 10)}|${key}`;
    };

    const getMonthKey = (date) => {
        const key = date.toLocaleDateString("es-ES", { year: "numeric", month: "long" });
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}|${key}`;
    };

    const getWeekdayKey = (date) => {
        const weekdayNames = {
            0: "Domingo",
            1: "Lunes",
            2: "Martes",
            3: "Miércoles",
            4: "Jueves",
            5: "Viernes",
            6: "Sábado"
        };
        const day = date.getDay();
        const label = weekdayNames[day] || "Día";
        return `${day}|${label}`;
    };

    const buildRangeOptions = (data, range) => {
        const select = document.getElementById("sessionRangeSelect");
        if (!select) return;
        const map = new Map();
        (Array.isArray(data) ? data : []).forEach(session => {
            const d = getSessionDate(session);
            if (!d) return;
            let key = "";
            if (range === "day") key = getDayKey(d);
            if (range === "weekday") key = getWeekdayKey(d);
            if (range === "week") key = getWeekKey(d);
            if (range === "month") key = getMonthKey(d);
            if (!key) return;
            if (!map.has(key)) map.set(key, 0);
            map.set(key, map.get(key) + 1);
        });

        let entries = Array.from(map.entries());
        if (range === "weekday") {
            const order = { "1": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "0": 6 };
            entries = entries.sort((a, b) => {
                const aKey = (a[0].split("|")[0] || "").trim();
                const bKey = (b[0].split("|")[0] || "").trim();
                return (order[aKey] ?? 99) - (order[bKey] ?? 99);
            });
        } else {
            entries = entries.sort((a, b) => b[0].localeCompare(a[0]));
        }
        select.innerHTML = '<option value="">Todas</option>' + entries.map(([key, count]) => {
            const [value, label] = key.split("|");
            return `<option value="${value}">${label} (${count})</option>`;
        }).join("");

        if (sessionFilterValue && select.querySelector(`option[value="${sessionFilterValue}"]`)) {
            select.value = sessionFilterValue;
        } else {
            sessionFilterValue = "";
            select.value = "";
        }
    };

    const collapseAllSessionDetails = () => {
        sessionData.forEach((_, index) => {
            const details = document.getElementById(`session-details-${index}`);
            const chevron = document.getElementById(`chevron-${index}`);
            if (!details || !chevron) return;
            details.style.display = 'none';
            chevron.classList.remove('fa-chevron-up');
            chevron.classList.add('fa-chevron-down');
        });
    };

    const filterSessionsByRange = (data, range, value) => {
        if (!Array.isArray(data) || !range) return Array.isArray(data) ? data : [];
        if (!value) return data;

        return data.filter(session => {
            const d = getSessionDate(session);
            if (!d) return false;
            if (range === "day") return d.toISOString().slice(0, 10) === value;
            if (range === "weekday") return String(d.getDay()) === value;
            if (range === "month") {
                const monthValue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                return monthValue === value;
            }
            if (range === "week") {
                const [weekValue] = getWeekKey(d).split("|");
                return weekValue === value;
            }
            return true;
        });
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
        applySessionFilters();
    };

    window.setSessionFilterRange = function (range) {
        sessionFilterRange = range;
        const dayBtn = document.getElementById("filterDayBtn");
        const weekdayBtn = document.getElementById("filterWeekdayBtn");
        const weekBtn = document.getElementById("filterWeekBtn");
        const monthBtn = document.getElementById("filterMonthBtn");
        const buttons = [
            { el: dayBtn, active: range === "day" },
            { el: weekdayBtn, active: range === "weekday" },
            { el: weekBtn, active: range === "week" },
            { el: monthBtn, active: range === "month" }
        ];
        buttons.forEach(({ el, active }) => {
            if (!el) return;
            el.classList.toggle("btn-info", active);
            el.classList.toggle("text-dark", active);
            el.classList.toggle("btn-outline-secondary", !active);
        });
        buildRangeOptions(sessionData, sessionFilterRange);
        applySessionFilters();
    };

    window.initSessionUnitControls = function () {
        const kgBtn = document.getElementById("unitKgBtn");
        const lbBtn = document.getElementById("unitLbBtn");
        if (kgBtn) kgBtn.addEventListener("click", () => window.setSessionWeightUnit("kg"));
        if (lbBtn) lbBtn.addEventListener("click", () => window.setSessionWeightUnit("lb"));
        window.setSessionWeightUnit("lb");

        const dayBtn = document.getElementById("filterDayBtn");
        const weekdayBtn = document.getElementById("filterWeekdayBtn");
        const weekBtn = document.getElementById("filterWeekBtn");
        const monthBtn = document.getElementById("filterMonthBtn");
        const rangeSelect = document.getElementById("sessionRangeSelect");
        const collapseBtn = document.getElementById("collapseSessionsBtn");
        if (dayBtn) dayBtn.addEventListener("click", () => window.setSessionFilterRange("day"));
        if (weekdayBtn) weekdayBtn.addEventListener("click", () => window.setSessionFilterRange("weekday"));
        if (weekBtn) weekBtn.addEventListener("click", () => window.setSessionFilterRange("week"));
        if (monthBtn) monthBtn.addEventListener("click", () => window.setSessionFilterRange("month"));
        if (rangeSelect) {
            rangeSelect.addEventListener("change", (event) => {
                sessionFilterValue = event.target.value || "";
                applySessionFilters();
            });
        }
        if (collapseBtn) {
            collapseBtn.addEventListener("click", () => {
                collapseAllSessionDetails();
            });
        }
        window.setSessionFilterRange("month");
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
            buildRangeOptions(sessionData, sessionFilterRange);
            applySessionFilters();
        } catch (e) {
            console.error("Error loading sessions:", e);
            container.innerHTML = `<p class="text-danger text-center m-0">Error cargando sesiones.</p>`;
        }
    };
})();
