(function () {
  const state = {
    targetFrequency: 3,
    sessions: [],
    trainedDates: [],
    heatmapRange: 90,
    windowRangeDays: 30,
  };

  const getUserId = () => {
    if (window.currentUserId) return window.currentUserId;
    const stored = localStorage.getItem("ai_fitness_uid");
    if (stored) return stored;
    const match = document.cookie.match(/(?:^|; )user_session=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  };

  const toLocalDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const parseSessionDate = (session) => {
    const raw = session.started_at || session.start_time || session.created_at || session.date;
    const dt = raw ? new Date(raw) : null;
    if (!dt || Number.isNaN(dt.getTime())) return null;
    return dt;
  };

  const getWeekStart = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    return d;
  };

  const getWeekKey = (date) => {
    const start = getWeekStart(date);
    return toLocalDateKey(start);
  };

  const getUniqueDateList = (sessions) => {
    const set = new Set();
    sessions.forEach((s) => {
      const dt = parseSessionDate(s);
      if (!dt) return;
      set.add(toLocalDateKey(dt));
    });
    return Array.from(set).sort();
  };

  const buildWeekCounts = (dates) => {
    const map = new Map();
    dates.forEach((key) => {
      const dt = new Date(`${key}T00:00:00`);
      if (Number.isNaN(dt.getTime())) return;
      const weekKey = getWeekKey(dt);
      map.set(weekKey, (map.get(weekKey) || 0) + 1);
    });
    return map;
  };

  const getWindowRange = (rangeDays, weekKey) => {
    if (rangeDays === "week") {
      const start = weekKey ? new Date(`${weekKey}T00:00:00`) : getWeekStart(new Date());
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      return { start, end, weeks: 1 };
    }
    const days = Math.max(7, Number(rangeDays) || 30);
    const weeks = Math.max(1, Math.ceil(days / 7));
    const weekStart = getWeekStart(new Date());
    const start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() - (weeks - 1) * 7);
    const end = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
    return { start, end, weeks };
  };

  const getWindowedDates = (dates, rangeDays, weekKey) => {
    const { start, end } = getWindowRange(rangeDays, weekKey);
    return dates.filter((key) => {
      const dt = new Date(`${key}T00:00:00`);
      return dt >= start && dt <= end;
    });
  };

  const updateWindowRangeLabel = (rangeDays, weekKey) => {
    const { start, end } = getWindowRange(rangeDays, weekKey);
    const fmt = (value) => value.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
    setText("adherenceWindowRange", `${fmt(start)} - ${fmt(end)}`);
  };

  const getWeekLabel = (weekKey) => {
    const start = new Date(`${weekKey}T00:00:00`);
    if (Number.isNaN(start.getTime())) return weekKey;
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    const fmt = (value) => value.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
    return `${fmt(start)} - ${fmt(end)}`;
  };

  const buildWeekOptions = (weekCounts) => {
    const select = document.getElementById("adherenceWeekSelect");
    if (!select) return;
    const keys = Array.from(weekCounts.keys()).sort().slice(-12);
    const currentKey = getWeekKey(new Date());
    const previous = select.value;
    const options = [`<option value="${currentKey}">Semana actual</option>`];
    keys.reverse().forEach((key) => {
      if (key === currentKey) return;
      options.push(`<option value="${key}">${getWeekLabel(key)}</option>`);
    });
    select.innerHTML = options.join("");
    if (previous && select.querySelector(`option[value="${previous}"]`)) {
      select.value = previous;
    } else {
      select.value = currentKey;
    }
  };

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  const setHtml = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
  };

  const updateWeeklyAdherence = (weekCounts) => {
    const target = Math.max(1, Number(state.targetFrequency) || 1);
    const select = document.getElementById("adherenceWeekSelect");
    const selectedKey = (select && select.value) || getWeekKey(new Date());
    const done = weekCounts.get(selectedKey) || 0;
    const pctRaw = done / target;
    const pct = Math.min(1, pctRaw) * 100;
    setText("adherenceWeeklyValue", `${Math.round(pct)}%`);
    setText("adherenceWeeklyMeta", `${done} / ${target} sesiones`);
    const bar = document.getElementById("adherenceWeeklyBar");
    if (bar) bar.style.width = `${Math.min(100, Math.round(pct))}%`;
  };

  const getHistoryStart = (dates) => {
    if (!dates || !dates.length) return new Date();
    // Fechas ya vienen ordenadas por getUniqueDateList
    // Parseamos la primera fecha
    return new Date(dates[0]);
  };

  const updateRollingAverage = (dates, rangeDays, weekKey) => {
    const target = Math.max(1, Number(state.targetFrequency) || 1);

    // 1. Determinar el rango teórico seleccionado
    const { weeks: theoreticalWeeks } = getWindowRange(rangeDays, weekKey);
    const theoreticalDays = theoreticalWeeks * 7;

    // 2. Determinar el rango real disponible (Smart History)
    // Solo aplica si NO es modo 'week' (que es fijo) y tenemos datos
    let effectiveDays = theoreticalDays;
    let isAdjusted = false;

    if (rangeDays !== "week" && state.trainedDates.length > 0) {
      const firstDate = getHistoryStart(state.trainedDates);
      const today = new Date();
      const diffTime = Math.abs(today - firstDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 incluye hoy

      // Si la historia real es MENOR que el rango seleccionado (con un margen de error), ajustamos.
      // Ejemplo: Selecciona 30 días, pero empezó hace 10. Usamos 10.
      if (diffDays < theoreticalDays) {
        effectiveDays = Math.max(1, diffDays);
        isAdjusted = true;
      }
    }

    // 3. Calcular semanas efectivas para el promedio
    // Mínimo 1 semana para evitar divisiones locas en primeros días
    const effectiveWeeks = Math.max(1, effectiveDays / 7);

    const count = dates.length;
    const avgPerWeek = count / effectiveWeeks;
    const ratio = avgPerWeek / target;
    const pct = Math.min(1, ratio) * 100;

    const titleEl = document.getElementById("adherenceRollingTitle");
    if (titleEl) {
      // Mostrar etiqueta semántica
      let label = `${theoreticalWeeks} ${theoreticalWeeks === 1 ? "semana" : "semanas"}`;
      if (isAdjusted) {
        label += " (Ajustado)";
      }
      titleEl.textContent = `Semáforo ${label}`;
    }

    setText("adherenceRollingValue", `${avgPerWeek.toFixed(1)} / ${target}`);

    let metaText = `Promedio semanal en ${effectiveDays} días (${count} sesiones)`;
    if (isAdjusted) {
      metaText = `Historial real: ${effectiveDays} días (vs ${theoreticalDays} selec.) - ${count} sesiones`;
    }
    setText("adherenceRollingMeta", metaText);

    const badge = document.getElementById("adherenceRollingBadge");
    if (!badge) return;
    if (ratio >= 1) {
      badge.className = "badge bg-success text-dark";
      badge.textContent = "Verde";
    } else if (ratio >= 0.5) {
      badge.className = "badge bg-warning text-dark";
      badge.textContent = "Amarillo";
    } else {
      badge.className = "badge bg-danger text-white";
      badge.textContent = "Rojo";
    }
    badge.setAttribute("title", `${Math.round(pct)}% de meta (ajustada a historial)`);
  };

  const updateStreaks = (dates) => {
    const target = Math.max(1, Number(state.targetFrequency) || 1);
    if (!dates.length) {
      setText("adherenceStreakCurrent", "0");
      setText("adherenceStreakBest", "0");
      return;
    }

    const weekCounts = buildWeekCounts(dates);
    const weeks = Array.from(weekCounts.keys()).sort();
    let best = 0;
    let current = 0;
    let run = 0;

    weeks.forEach((weekKey) => {
      const meets = (weekCounts.get(weekKey) || 0) >= target;
      if (meets) {
        run += 1;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    });

    // La racha actual verifica desde la última semana hacia atrás
    current = 0;
    for (let i = weeks.length - 1; i >= 0; i -= 1) {
      const wk = weeks[i];
      if ((weekCounts.get(wk) || 0) >= target) {
        current += 1;
      } else {
        break;
      }
    }

    setText("adherenceStreakCurrent", String(current));
    setText("adherenceStreakBest", String(best));
  };

  const updateGapDays = (dates) => {
    if (dates.length < 2) {
      setText("adherenceGapValue", "-");
      return;
    }
    const sorted = dates.map((k) => new Date(`${k}T00:00:00`)).sort((a, b) => a - b);
    let total = 0;
    for (let i = 1; i < sorted.length; i += 1) {
      const diffMs = sorted[i] - sorted[i - 1];
      total += diffMs / (1000 * 60 * 60 * 24);
    }
    const avg = total / (sorted.length - 1);
    setText("adherenceGapValue", `${avg.toFixed(1)} días`);
  };

  const renderHeatmap = (dates) => {
    const container = document.getElementById("adherenceHeatmap");
    if (!container) return;
    container.innerHTML = "";

    const counts = new Map();
    dates.forEach((key) => counts.set(key, (counts.get(key) || 0) + 1));

    const today = new Date();
    const rangeDays = Math.max(30, Math.min(90, Number(state.heatmapRange) || 90));
    for (let i = rangeDays - 1; i >= 0; i -= 1) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = toLocalDateKey(d);
      const count = counts.get(key) || 0;
      let level = 0;
      if (count >= 3) level = 3;
      else if (count === 2) level = 2;
      else if (count === 1) level = 1;

      const cell = document.createElement("div");
      cell.className = `heatmap-cell level-${level}`;
      cell.title = `${key}: ${count} sesiones`;
      container.appendChild(cell);
    }
  };

  const setHeatmapRange = (value) => {
    state.heatmapRange = value;
    document.querySelectorAll("[data-heatmap-range]").forEach((btnEl) => {
      const isActive = Number(btnEl.getAttribute("data-heatmap-range")) === value;
      btnEl.classList.toggle("btn-outline-info", isActive);
      btnEl.classList.toggle("text-dark", isActive);
      btnEl.classList.toggle("btn-outline-secondary", !isActive);
    });
  };

  const refreshUI = () => {
    const dates = state.trainedDates;
    const weekCounts = buildWeekCounts(dates);
    buildWeekOptions(weekCounts);
    const weekSelect = document.getElementById("adherenceWeekSelect");
    const selectedWeekKey = (weekSelect && weekSelect.value) || getWeekKey(new Date());
    const windowMode = state.windowRangeDays;
    const windowedDates = getWindowedDates(dates, windowMode, selectedWeekKey);
    updateWeeklyAdherence(weekCounts);
    updateRollingAverage(windowedDates, windowMode, selectedWeekKey);
    updateStreaks(windowedDates);
    updateGapDays(windowedDates);
    renderHeatmap(dates);
    updateWindowRangeLabel(windowMode, selectedWeekKey);
  };

  const loadConfig = async () => {
    try {
      const res = await fetch("/workout/api/adherence/config");
      const data = await res.json();
      const target = Number(data.target_frequency);
      state.targetFrequency = Number.isFinite(target) && target > 0 ? target : 3;
      const select = document.getElementById("adherenceTargetSelect");
      if (select) select.value = String(state.targetFrequency);

      const header = document.getElementById("adherenceGoalHeader");
      if (header) {
        header.textContent = `Objetivo semanal (${state.targetFrequency} días)`;
      }
    } catch (e) {
      state.targetFrequency = 3;
    }
  };

  const saveConfig = async (value) => {
    const msg = document.getElementById("adherenceSaveMsg");
    if (msg) msg.textContent = "Guardando...";
    try {
      const res = await fetch("/workout/api/adherence/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_frequency: value }),
      });
      if (!res.ok) throw new Error("Error guardando");
      state.targetFrequency = value;
      if (msg) msg.textContent = "Guardado";

      const header = document.getElementById("adherenceGoalHeader");
      if (header) {
        header.textContent = `Objetivo semanal (${value} días)`;
      }

      refreshUI();
    } catch (e) {
      if (msg) msg.textContent = "Error al guardar";
    }
    setTimeout(() => {
      if (msg) msg.textContent = "";
    }, 2000);
  };

  const loadSessions = async () => {
    const uid = getUserId();
    if (!uid) return;
    const res = await fetch(`/workout/api/sessions?user_id=${encodeURIComponent(uid)}&limit=1000`);
    const data = await res.json();
    state.sessions = Array.isArray(data) ? data : [];
    state.trainedDates = getUniqueDateList(state.sessions);

    // Auto-select range logic based on active weeks
    // "depending on the number of weeks of registered trainings"
    if (state.trainedDates.length > 0) {
      const weekCounts = buildWeekCounts(state.trainedDates);
      const activeWeeks = weekCounts.size;

      // Thresholds (Relaxed based on user feedback): 
      // <= 6 weeks (approx 1.5 months) -> 30 days preference
      // <= 12 weeks (approx 3 months) -> 60 days preference
      // > 12 weeks -> 90 days
      console.log("Auto-select debug: Active Weeks =", activeWeeks);

      if (activeWeeks <= 6) {
        state.windowRangeDays = 30;
      } else if (activeWeeks <= 12) {
        state.windowRangeDays = 60;
      } else {
        state.windowRangeDays = 90;
      }

      // Update Select UI if present
      const windowSelect = document.getElementById("adherenceWindowSelect");
      if (windowSelect) {
        windowSelect.value = String(state.windowRangeDays);
      }

      // Auto-select heatmap range using the same thresholds
      setHeatmapRange(state.windowRangeDays);
    }
  };

  const bindEvents = () => {
    const btn = document.getElementById("adherenceSaveBtn");
    const select = document.getElementById("adherenceTargetSelect");
    if (btn && select) {
      btn.addEventListener("click", () => {
        const value = Math.max(1, Math.min(7, Number(select.value) || 3));
        saveConfig(value);
      });
    }

    const weekSelect = document.getElementById("adherenceWeekSelect");
    if (weekSelect) {
      weekSelect.addEventListener("change", () => {
        const weekCounts = buildWeekCounts(state.trainedDates);
        updateWeeklyAdherence(weekCounts);
        if (state.windowRangeDays === "week") {
          refreshUI();
        }
      });
    }

    const windowSelect = document.getElementById("adherenceWindowSelect");
    if (windowSelect) {
      windowSelect.addEventListener("change", () => {
        const raw = windowSelect.value;
        if (raw === "week") {
          state.windowRangeDays = "week";
        } else {
          const value = Math.max(7, Number(raw) || 30);
          state.windowRangeDays = value;
        }
        refreshUI();
      });
    }

    document.querySelectorAll("[data-heatmap-range]").forEach((button) => {
      button.addEventListener("click", () => {
        const value = Number(button.getAttribute("data-heatmap-range")) || 90;
        setHeatmapRange(value);
        renderHeatmap(state.trainedDates);
      });
    });
  };

  const init = async () => {
    await loadConfig();
    await loadSessions();
    bindEvents();
    refreshUI();
  };

  document.addEventListener("DOMContentLoaded", init);
})();
