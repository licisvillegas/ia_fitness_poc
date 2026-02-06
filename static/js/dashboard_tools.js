(function () {
  const dash = window.__DASH__ || {};
  const toolsSection = document.getElementById("tools-section");
  if (!toolsSection) return;

  const plateGrid = document.getElementById("plateGrid");
  const plateUnit = document.getElementById("plateUnit");
  const barWeightInput = document.getElementById("barWeight");
  const includeBarInput = document.getElementById("plateIncludeBar");
  const plateModeGroup = document.getElementById("plateModeGroup");
  const plateUnitLabel = document.getElementById("plateUnitLabel");
  const plateUnitSuffix = document.getElementById("plateUnitSuffix");
  const plateTotalEl = document.getElementById("plateTotal");
  const plateTotalWithBarEl = document.getElementById("plateTotalWithBar");
  const plateConvertValue = document.getElementById("plateConvertValue");
  const plateConvertUnit = document.getElementById("plateConvertUnit");
  const plateConvertResult = document.getElementById("plateConvertResult");
  const plateConvertSwap = document.getElementById("plateConvertSwap");
  let isSyncingUnit = false;
  let isSyncingConvert = false;
  let lastPlateUnit = null;

  const plateSets = {
    kg: [
      { value: 1.25, label: "1.25", img: "/static/images/disc/2_5.png" },
      { value: 2.5, label: "2.5", img: "/static/images/disc/2_5.png" },
      { value: 5, label: "5", img: "/static/images/disc/5.png" },
      { value: 10, label: "10", img: "/static/images/disc/10.png" },
      { value: 15, label: "15", img: "/static/images/disc/25.png" },
      { value: 20, label: "20", img: "/static/images/disc/35.png" },
      { value: 25, label: "25", img: "/static/images/disc/45.png" }
    ],
    lb: [
      { value: 2.5, label: "2.5", img: "/static/images/disc/2_5.png" },
      { value: 5, label: "5", img: "/static/images/disc/5.png" },
      { value: 10, label: "10", img: "/static/images/disc/10.png" },
      { value: 25, label: "25", img: "/static/images/disc/25.png" },
      { value: 35, label: "35", img: "/static/images/disc/35.png" },
      { value: 45, label: "45", img: "/static/images/disc/45.png" }
    ]
  };

  let plateCounts = {};
  let plateMode = "per_side";
  const plateState = {
    lb: { counts: null, barWeight: 45, includeBar: true },
    kg: { counts: null, barWeight: 20, includeBar: true }
  };

  const initCounts = (unit) => {
    const counts = {};
    plateSets[unit].forEach((p) => {
      counts[p.value] = 0;
    });
    return counts;
  };

  const savePlateState = (unit) => {
    if (!unit) return;
    plateState[unit] = {
      counts: { ...plateCounts },
      barWeight: parseFloat(barWeightInput.value) || (unit === "kg" ? 20 : 45),
      includeBar: includeBarInput ? includeBarInput.checked : true
    };
  };

  const loadPlateState = (unit) => {
    if (!unit) return;
    const state = plateState[unit] || {};
    plateCounts = state.counts ? { ...state.counts } : initCounts(unit);
    if (barWeightInput) barWeightInput.value = state.barWeight ?? (unit === "kg" ? 20 : 45);
    if (includeBarInput) includeBarInput.checked = state.includeBar ?? true;
  };

  const renderPlateGrid = () => {
    if (!plateGrid) return;
    const unit = plateUnit.value;
    plateGrid.innerHTML = "";
    plateSets[unit].forEach((plate) => {
      const tile = document.createElement("div");
      tile.className = "plate-tile";
      tile.innerHTML = `
        <img src="${plate.img}" alt="${plate.label} ${unit}">
        <div class="text-secondary small">${plate.label} ${unit}</div>
        <div class="plate-counter">
          <button type="button" class="btn-min" data-action="dec" data-value="${plate.value}">-</button>
          <div class="fw-bold text-white" style="min-width:24px;text-align:center;">${plateCounts[plate.value] || 0}</div>
          <button type="button" class="btn-plus" data-action="inc" data-value="${plate.value}">+</button>
        </div>
      `;
      plateGrid.appendChild(tile);
    });
  };

  const updatePlateTotals = () => {
    const unit = plateUnit.value;
    const multiplier = plateMode === "per_side" ? 2 : 1;
    let totalPlates = 0;
    plateSets[unit].forEach((plate) => {
      totalPlates += (plateCounts[plate.value] || 0) * plate.value * multiplier;
    });
    const barWeight = parseFloat(barWeightInput.value) || 0;
    const includeBar = includeBarInput ? includeBarInput.checked : true;
    const totalWithBar = totalPlates + (includeBar ? barWeight : 0);
    if (plateTotalEl) plateTotalEl.textContent = `${totalPlates.toFixed(1)} ${unit}`;
    if (plateTotalWithBarEl) plateTotalWithBarEl.textContent = `${totalWithBar.toFixed(1)} ${unit}`;
    if (plateUnitLabel) plateUnitLabel.textContent = unit;
    if (plateUnitSuffix) plateUnitSuffix.textContent = unit;
    if (barWeightInput && includeBarInput) {
      barWeightInput.disabled = !includeBarInput.checked;
    }
  };

  const convertWeightBasic = (value, fromUnit, toUnit) => {
    if (!value || fromUnit === toUnit) return value;
    const kgToLb = 2.20462;
    return fromUnit === "kg" ? value * kgToLb : value / kgToLb;
  };

  const updatePlateConversion = () => {
    if (!plateConvertValue || !plateConvertUnit || !plateConvertResult) return;
    const raw = parseFloat(plateConvertValue.value);
    if (!Number.isFinite(raw)) {
      plateConvertResult.textContent = "--";
      return;
    }
    const fromUnit = plateConvertUnit.value || "lb";
    const toUnit = fromUnit === "kg" ? "lb" : "kg";
    const converted = convertWeightBasic(raw, fromUnit, toUnit);
    const rounded = Math.round(converted * 100) / 100;
    plateConvertResult.textContent = `${rounded} ${toUnit}`;
  };

  const syncPlateUI = () => {
    renderPlateGrid();
    updatePlateTotals();
  };

  const handlePlateClick = (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const value = parseFloat(btn.getAttribute("data-value"));
    if (!action || !Number.isFinite(value)) return;
    const current = plateCounts[value] || 0;
    plateCounts[value] = action === "inc" ? current + 1 : Math.max(0, current - 1);
    syncPlateUI();
  };

  if (plateGrid) {
    plateGrid.addEventListener("click", handlePlateClick);
  }

  const setPlateUnit = (unit, force = false) => {
    if (!plateUnit || !unit) return;
    if (!force && plateUnit.value === unit) {
      return;
    }
    isSyncingUnit = true;
    const previousUnit = lastPlateUnit || plateUnit.value;
    savePlateState(previousUnit);
    plateUnit.value = unit;
    loadPlateState(unit);
    syncPlateUI();
    lastPlateUnit = unit;
    isSyncingUnit = false;
  };

  if (plateUnit) {
    lastPlateUnit = plateUnit.value || "lb";
    plateUnit.addEventListener("change", () => {
      if (isSyncingUnit) return;
      const unit = plateUnit.value;
      setPlateUnit(unit, true);
    });
  }

  if (plateConvertUnit) {
    plateConvertUnit.addEventListener("change", () => {
      if (isSyncingConvert) return;
      updatePlateConversion();
    });
  }
  if (plateConvertValue) {
    plateConvertValue.addEventListener("input", updatePlateConversion);
  }
  if (plateConvertSwap) {
    plateConvertSwap.addEventListener("click", () => {
      if (!plateConvertUnit) return;
      const current = plateConvertUnit.value || "lb";
      const next = current === "kg" ? "lb" : "kg";
      const raw = parseFloat(plateConvertValue.value);
      isSyncingConvert = true;
      plateConvertUnit.value = next;
      if (Number.isFinite(raw)) {
        const converted = convertWeightBasic(raw, current, next);
        const rounded = Math.round(converted * 100) / 100;
        plateConvertValue.value = rounded.toString();
      }
      isSyncingConvert = false;
      updatePlateConversion();
    });
  }

  if (plateModeGroup) {
    plateModeGroup.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-mode]");
      if (!btn) return;
      const nextMode = btn.getAttribute("data-mode");
      if (!nextMode) return;
      plateMode = nextMode;
      Array.from(plateModeGroup.querySelectorAll("button[data-mode]")).forEach((b) => {
        const isActive = b.getAttribute("data-mode") === plateMode;
        b.classList.toggle("btn-info", isActive);
        b.classList.toggle("text-dark", isActive);
        b.classList.toggle("btn-outline-secondary", !isActive);
      });
      updatePlateTotals();
    });
  }

  if (barWeightInput) {
    barWeightInput.addEventListener("input", updatePlateTotals);
  }
  if (includeBarInput) {
    includeBarInput.addEventListener("change", () => {
      if (barWeightInput) {
        barWeightInput.disabled = !includeBarInput.checked;
      }
      updatePlateTotals();
    });
  }

  loadPlateState(plateUnit.value || "lb");
  syncPlateUI();
  updatePlateConversion();

  // Timer
  const timerDisplay = document.getElementById("timerDisplay");
  const timerMinutes = document.getElementById("timerMinutes");
  const timerSeconds = document.getElementById("timerSeconds");
  const timerStartBtn = document.getElementById("timerStartBtn");
  const timerPauseBtn = document.getElementById("timerPauseBtn");
  const timerResetBtn = document.getElementById("timerResetBtn");
  const timerStepBtns = document.querySelectorAll(".tool-timer-step");
  const timerPresetBtns = document.querySelectorAll(".tool-timer-preset");
  const enduranceOverlay = null;
  const enduranceNumber = null;
  const countdownOverlay = document.getElementById("toolCountdownOverlay");
  const countdownNumber = document.getElementById("toolCountdownNumber");
  const timerTotal = document.getElementById("timerTotal");
  const timerRing = document.querySelector(".tool-timer-ring-fg");
  const ringCircumference = 2 * Math.PI * 54;
  let timerInterval = null;
  let remainingSeconds = 0;
  let totalSeconds = 0;

  const formatTime = (total) => {
    const m = Math.floor(total / 60).toString().padStart(2, "0");
    const s = Math.floor(total % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const updateTimerDisplay = () => {
    if (timerDisplay) timerDisplay.textContent = formatTime(remainingSeconds);
  };

  const updateTimerTotal = () => {
    if (timerTotal) timerTotal.textContent = formatTime(totalSeconds);
  };

  const updateTimerRing = () => {
    if (!timerRing) return;
    if (totalSeconds <= 0) {
      timerRing.style.strokeDasharray = `${ringCircumference}`;
      timerRing.style.strokeDashoffset = `${ringCircumference}`;
      return;
    }
    const progress = Math.max(0, Math.min(1, remainingSeconds / totalSeconds));
    const offset = ringCircumference * (1 - progress);
    timerRing.style.strokeDasharray = `${ringCircumference}`;
    timerRing.style.strokeDashoffset = `${offset}`;
  };

  const syncFromInputs = () => {
    if (timerInterval) return;
    const m = parseInt(timerMinutes.value, 10) || 0;
    const s = parseInt(timerSeconds.value, 10) || 0;
    totalSeconds = Math.max(0, m * 60 + s);
    remainingSeconds = totalSeconds;
    updateTimerDisplay();
    updateTimerTotal();
    updateTimerRing();
  };

  const updateEnduranceOverlay = () => { };

  const runCountdown = (onDone) => {
    if (!countdownOverlay || !countdownNumber) {
      onDone();
      return;
    }
    let count = 3;
    countdownNumber.textContent = count;
    countdownOverlay.classList.remove("d-none");
    const tick = () => {
      if (count <= 1) {
        countdownOverlay.classList.add("d-none");
        onDone();
        return;
      }
      count -= 1;
      countdownNumber.textContent = count;
      setTimeout(tick, 900);
    };
    setTimeout(tick, 900);
  };

  const startTimer = () => {
    if (timerInterval) return;
    if (remainingSeconds <= 0) {
      const m = parseInt(timerMinutes.value, 10) || 0;
      const s = parseInt(timerSeconds.value, 10) || 0;
      totalSeconds = Math.max(0, m * 60 + s);
      remainingSeconds = totalSeconds;
      updateTimerTotal();
    }
    if (remainingSeconds <= 0) return;
    runCountdown(() => {
      updateTimerDisplay();
      updateEnduranceOverlay();
      updateTimerRing();
      timerInterval = setInterval(() => {
        remainingSeconds = Math.max(0, remainingSeconds - 1);
        updateTimerDisplay();
        updateEnduranceOverlay();
        updateTimerRing();
        if (remainingSeconds <= 0) {
          clearInterval(timerInterval);
          timerInterval = null;
          updateEnduranceOverlay();
          updateTimerRing();
        }
      }, 1000);
    });
  };

  const pauseTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
      updateEnduranceOverlay();
      updateTimerRing();
    }
  };

  const resetTimer = () => {
    pauseTimer();
    remainingSeconds = 0;
    totalSeconds = 0;
    updateTimerDisplay();
    updateTimerTotal();
    updateEnduranceOverlay();
    updateTimerRing();
  };

  if (timerStartBtn) timerStartBtn.addEventListener("click", startTimer);
  if (timerPauseBtn) timerPauseBtn.addEventListener("click", pauseTimer);
  if (timerResetBtn) timerResetBtn.addEventListener("click", resetTimer);
  if (timerMinutes) timerMinutes.addEventListener("input", syncFromInputs);
  if (timerSeconds) timerSeconds.addEventListener("input", syncFromInputs);
  timerStepBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const field = btn.getAttribute("data-field");
      const step = parseInt(btn.getAttribute("data-step"), 10) || 0;
      if (!field) return;
      if (field === "minutes") {
        const next = Math.max(0, (parseInt(timerMinutes.value, 10) || 0) + step);
        timerMinutes.value = next;
      }
      if (field === "seconds") {
        const current = parseInt(timerSeconds.value, 10) || 0;
        let next = current + step;
        next = Math.max(0, Math.min(59, next));
        timerSeconds.value = next;
      }
      syncFromInputs();
    });
  });
  timerPresetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mins = parseInt(btn.getAttribute("data-minutes"), 10) || 0;
      const secs = parseInt(btn.getAttribute("data-seconds"), 10) || 0;
      timerMinutes.value = mins;
      timerSeconds.value = secs;
      syncFromInputs();
    });
  });
  syncFromInputs();
  updateEnduranceOverlay();
  updateTimerRing();

  // Heart rate modal
  const hrModal = document.getElementById("toolHeartModal");
  const hrEmptyState = document.getElementById("hrEmptyState");
  const hrContent = document.getElementById("hrContent");
  const hrFcm = document.getElementById("hrFcm");
  const hrAge = document.getElementById("hrAge");
  const hrFat = document.getElementById("hrFat");
  const hrPerf = document.getElementById("hrPerf");
  const hrZoneFat = document.getElementById("hrZoneFat");
  const hrZoneCardio = document.getElementById("hrZoneCardio");
  const hrZonePerf = document.getElementById("hrZonePerf");
  const hrZoneMax = document.getElementById("hrZoneMax");

  const calcHeartRate = () => {
    const age = parseInt(dash.userAge, 10);
    const hasAge = Number.isFinite(age) && age > 0 && age < 120;
    if (hrEmptyState) hrEmptyState.classList.toggle("d-none", hasAge);
    if (hrContent) hrContent.classList.toggle("d-none", !hasAge);
    if (!hasAge) return;
    const fcm = 220 - age;
    const fatMin = Math.round(fcm * 0.6);
    const fatMax = Math.round(fcm * 0.7);
    const cardioMin = Math.round(fcm * 0.7);
    const cardioMax = Math.round(fcm * 0.8);
    const perfMin = Math.round(fcm * 0.8);
    const perfMax = Math.round(fcm * 0.9);
    const maxMin = Math.round(fcm * 0.9);
    const maxMax = Math.round(fcm * 1.0);

    if (hrFcm) hrFcm.textContent = fcm;
    if (hrAge) hrAge.textContent = age;
    if (hrFat) hrFat.textContent = `${fatMin} – ${fatMax}`;
    if (hrPerf) hrPerf.textContent = `${perfMin} – ${perfMax}`;
    if (hrZoneFat) hrZoneFat.textContent = `${fatMin} – ${fatMax} lpm`;
    if (hrZoneCardio) hrZoneCardio.textContent = `${cardioMin} – ${cardioMax} lpm`;
    if (hrZonePerf) hrZonePerf.textContent = `${perfMin} – ${perfMax} lpm`;
    if (hrZoneMax) hrZoneMax.textContent = `${maxMin} – ${maxMax} lpm`;
  };

  if (hrModal) {
    hrModal.addEventListener("show.bs.modal", calcHeartRate);
  }

  // Breathing tool
  const breathModal = document.getElementById("toolBreathModal");
  const breathStartBtn = document.getElementById("breathStartBtn");
  const breathStopBtn = document.getElementById("breathStopBtn");
  let breathInterval = null;
  let breathTimeout = null;
  let breathActive = false;
  let breathOverlay = null;
  let breathCircle = null;
  let breathText = null;
  let breathControls = null;
  let breathStopInline = null;

  const cleanupBreath = () => {
    if (breathInterval) {
      clearInterval(breathInterval);
      breathInterval = null;
    }
    if (breathTimeout) {
      clearTimeout(breathTimeout);
      breathTimeout = null;
    }
    if (breathOverlay) {
      breathOverlay.remove();
      breathOverlay = null;
    }
    if (breathCircle) {
      breathCircle.remove();
      breathCircle = null;
    }
    if (breathText) {
      breathText.remove();
      breathText = null;
    }
    if (breathControls) {
      breathControls.remove();
      breathControls = null;
    }
    breathStopInline = null;
    breathActive = false;
  };

  const startBreath = () => {
    if (breathActive) return;
    breathActive = true;

    breathOverlay = document.createElement("div");
    breathOverlay.className = "breath-overlay";
    document.body.appendChild(breathOverlay);

    breathCircle = document.createElement("div");
    breathCircle.className = "breath-circle";
    document.body.appendChild(breathCircle);

    breathText = document.createElement("div");
    breathText.className = "breath-text";
    breathText.textContent = "Inhala...";
    document.body.appendChild(breathText);

    breathControls = document.createElement("div");
    breathControls.className = "breath-controls";
    breathStopInline = document.createElement("button");
    breathStopInline.type = "button";
    breathStopInline.className = "btn btn-outline-light";
    breathStopInline.innerHTML = '<i class="fas fa-stop me-2"></i>Detener';
    breathStopInline.addEventListener("click", cleanupBreath);
    breathControls.appendChild(breathStopInline);
    document.body.appendChild(breathControls);

    let inhale = true;
    breathInterval = setInterval(() => {
      inhale = !inhale;
      if (breathText) breathText.textContent = inhale ? "Inhala..." : "Exhala...";
    }, 4000);
  };

  if (breathStartBtn) {
    breathStartBtn.addEventListener("click", startBreath);
  }
  if (breathStopBtn) {
    breathStopBtn.addEventListener("click", cleanupBreath);
  }
  if (breathModal) {
    breathModal.addEventListener("hidden.bs.modal", cleanupBreath);
  }

  // 1RM calculator
  const rmModal = document.getElementById("toolRmModal");
  const rmWeight = document.getElementById("rmWeight");
  const rmReps = document.getElementById("rmReps");
  const rmUnitToggle = document.getElementById("rmUnitToggle");
  const rmUnitLabel = document.getElementById("rmUnitLabel");
  const rmPesoLabel = document.getElementById("rmPesoLabel");
  const rmRepsLabel = document.getElementById("rmRepsLabel");
  const rmOneRm = document.getElementById("rmOneRm");
  const rmGrid = document.getElementById("rmGrid");
  const rmShowMore = document.getElementById("rmShowMore");
  const rmPctList = document.getElementById("rmPctList");
  const rmPctBase = document.getElementById("rmPctBase");
  const rmPctUnit = document.getElementById("rmPctUnit");
  let rmUnit = "lb";
  let rmShowAll = false;

  const rmFormulas = {
    brzycki: (w, r) => w * (36 / (37 - r)),
    epley: (w, r) => w * (1 + 0.0333 * r),
    lander: (w, r) => (100 * w) / (101.3 - 2.67123 * r),
    lombardi: (w, r) => w * Math.pow(r, 0.1),
    mayhew: (w, r) => (100 * w) / (52.2 + 41.9 * Math.exp(-0.055 * r)),
    oconner: (w, r) => w * (1 + 0.025 * r),
    wathen: (w, r) => (100 * w) / (48.8 + 53.8 * Math.exp(-0.075 * r))
  };

  const rmPercentages = {
    1: 1.0, 2: 0.95, 3: 0.93, 4: 0.9,
    5: 0.87, 6: 0.85, 7: 0.83, 8: 0.8,
    9: 0.77, 10: 0.75, 11: 0.7, 12: 0.67,
    13: 0.65, 14: 0.63, 15: 0.6, 16: 0.58,
    17: 0.56, 18: 0.55, 19: 0.53, 20: 0.5
  };

  const convertWeight = (value, fromUnit, toUnit) => {
    if (!value || fromUnit === toUnit) return value;
    const kgToLb = 2.20462;
    return fromUnit === "kg" ? value * kgToLb : value / kgToLb;
  };

  const calcOneRm = (w, r) => {
    if (!w || !r) return 0;
    if (r <= 1) return w;
    const values = Object.values(rmFormulas).map((fn) => fn(w, r));
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  };

  const renderRmGrid = (oneRm) => {
    if (!rmGrid) return;
    rmGrid.innerHTML = "";
    if (!oneRm) {
      rmGrid.innerHTML = '<div class="text-secondary small">Ingresa peso y repeticiones para ver resultados.</div>';
      return;
    }
    const maxRm = rmShowAll ? 20 : 12;
    Object.entries(rmPercentages).forEach(([rep, pct]) => {
      const repNum = Number(rep);
      if (repNum > maxRm) return;
      const val = Math.round(oneRm * pct);
      const isSource = repNum === Math.round(parseFloat(rmReps.value) || 0);
      const isOne = repNum === 1;
      rmGrid.innerHTML += `
        <div class="col-4 col-md-3">
          <div class="rm-tile ${isOne ? "rm-tile--one" : ""} ${isSource ? "rm-tile--source" : ""}">
            <div class="text-secondary small">${repNum}RM</div>
            <div class="fw-bold text-white">${val}</div>
            <div class="text-muted small">${rmUnit}</div>
          </div>
        </div>
      `;
    });
  };

  const renderRmPercentages = (oneRm) => {
    if (!rmPctList) return;
    rmPctList.innerHTML = "";
    if (!oneRm) {
      rmPctList.innerHTML = '<div class="text-secondary small">Ingresa peso y repeticiones para ver resultados.</div>';
      if (rmPctBase) rmPctBase.textContent = "--";
      if (rmPctUnit) rmPctUnit.textContent = rmUnit;
      return;
    }
    if (rmPctBase) rmPctBase.textContent = `${Math.round(oneRm)} ${rmUnit}`;
    if (rmPctUnit) rmPctUnit.textContent = rmUnit;
    for (let pct = 125; pct >= 5; pct -= 5) {
      const val = Math.round(oneRm * (pct / 100));
      rmPctList.innerHTML += `
        <div class="col-6 col-md-4 col-lg-3">
          <div class="rm-tile">
            <div class="text-secondary small">${pct}%</div>
            <div class="fw-bold text-white">${val}</div>
            <div class="text-muted small">${rmUnit}</div>
          </div>
        </div>
      `;
    }
  };

  const syncRm = () => {
    if (!rmWeight || !rmReps) return;
    const w = parseFloat(rmWeight.value) || 0;
    const r = parseFloat(rmReps.value) || 0;
    const oneRm = calcOneRm(w, r);
    if (rmOneRm) rmOneRm.textContent = oneRm ? Math.round(oneRm) : "--";
    if (rmUnitLabel) rmUnitLabel.textContent = rmUnit;
    if (rmPesoLabel) rmPesoLabel.textContent = w ? w : "--";
    if (rmRepsLabel) rmRepsLabel.textContent = r ? r : "--";
    renderRmGrid(oneRm);
    renderRmPercentages(oneRm);
    if (rmShowMore) rmShowMore.textContent = rmShowAll ? "Mostrar menos" : "Mostrar más";
    if (rmUnitToggle) rmUnitToggle.textContent = rmUnit.toUpperCase();
  };

  if (rmWeight) rmWeight.addEventListener("input", syncRm);
  if (rmReps) rmReps.addEventListener("input", syncRm);
  if (rmShowMore) {
    rmShowMore.addEventListener("click", () => {
      rmShowAll = !rmShowAll;
      syncRm();
    });
  }
  if (rmUnitToggle) {
    rmUnitToggle.addEventListener("click", () => {
      const nextUnit = rmUnit === "kg" ? "lb" : "kg";
      const val = parseFloat(rmWeight.value) || 0;
      if (val > 0) {
        const converted = convertWeight(val, rmUnit, nextUnit);
        rmWeight.value = (Math.round(converted * 10) / 10).toString();
      }
      rmUnit = nextUnit;
      syncRm();
    });
  }
  if (rmModal) {
    rmModal.addEventListener("show.bs.modal", () => {
      rmShowAll = false;
      syncRm();
    });
  }
  // Tabata Timer
  const tabataModal = document.getElementById("toolTabataModal");
  const tabataConfig = document.getElementById("tabataConfig");
  const tabataActive = document.getElementById("tabataActive");
  const btnStartTabata = document.getElementById("btnStartTabata");
  const btnPauseTabata = document.getElementById("btnPauseTabata");
  const btnResetTabata = document.getElementById("btnResetTabata");

  const inpWork = document.getElementById("tabataWork");
  const inpRest = document.getElementById("tabataRest");
  const inpRounds = document.getElementById("tabataRounds");

  const stateLabel = document.getElementById("tabataStateLabel");
  const timeDisplay = document.getElementById("tabataTimerDisplay");
  const progressBar = document.getElementById("tabataProgressBar");
  const roundDisplay = document.getElementById("tabataRoundDisplay");
  const totalRoundsDisplay = document.getElementById("tabataTotalRounds");
  const totalTimeDisplay = document.getElementById("tabataTotalTime");
  const estimatedTimeDisplay = document.getElementById("tabataEstimatedTime");

  let tabataInterval = null;
  let tabataState = "IDLE"; // IDLE, PREPARE, WORK, REST, PAUSED_WORK, PAUSED_REST
  let currentRound = 1;
  let maxRounds = 8;
  let workTime = 20;
  let restTime = 10;
  let timeLeft = 0;
  let totalSecondsElapsed = 0;

  const formatTabataTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const updateEstimatedTime = () => {
    if (!inpWork || !inpRest || !inpRounds || !estimatedTimeDisplay) return;
    const w = parseInt(inpWork.value) || 0;
    const r = parseInt(inpRest.value) || 0;
    const rounds = parseInt(inpRounds.value) || 0;
    const total = (w + r) * rounds;
    estimatedTimeDisplay.textContent = `Tiempo Total Estimado: ${formatTabataTime(total)}`;
  };

  if (inpWork) inpWork.addEventListener("input", updateEstimatedTime);
  if (inpRest) inpRest.addEventListener("input", updateEstimatedTime);
  if (inpRounds) inpRounds.addEventListener("input", updateEstimatedTime);
  // Call initially
  updateEstimatedTime();

  const updateTabataUI = () => {
    if (!timeDisplay) return;

    timeDisplay.textContent = formatTabataTime(timeLeft);
    roundDisplay.textContent = currentRound;
    totalRoundsDisplay.textContent = maxRounds;
    totalTimeDisplay.textContent = formatTabataTime(totalSecondsElapsed);

    // Progress Bar
    let maxTime = (tabataState.includes("WORK")) ? workTime : (tabataState.includes("REST") ? restTime : 3);
    if (tabataState === "PREPARE") maxTime = 3;

    let pct = (timeLeft / maxTime) * 100;
    progressBar.style.width = `${pct}%`;

    // Colors & Labels
    if (tabataState === "WORK" || tabataState === "PAUSED_WORK") {
      stateLabel.textContent = "¡TRABAJO!";
      stateLabel.className = "fw-bold display-6 mb-2 text-success";
      progressBar.className = "progress-bar bg-success";
    } else if (tabataState === "REST" || tabataState === "PAUSED_REST") {
      stateLabel.textContent = "DESCANSO";
      stateLabel.className = "fw-bold display-6 mb-2 text-warning";
      progressBar.className = "progress-bar bg-warning";
    } else if (tabataState === "PREPARE") {
      stateLabel.textContent = "PREPARAR";
      stateLabel.className = "fw-bold display-6 mb-2 text-info";
      progressBar.className = "progress-bar bg-info";
    } else {
      stateLabel.textContent = "LISTO";
    }
  };

  const tickTabata = () => {
    if (timeLeft > 0) {
      timeLeft--;
      updateTabataUI();
    } else {
      // Transition State
      if (tabataState === "PREPARE") {
        tabataState = "WORK";
        timeLeft = workTime;
        playBeep("go");
      } else if (tabataState === "WORK") {
        if (currentRound >= maxRounds) {
          finishTabata();
          return;
        }
        tabataState = "REST";
        timeLeft = restTime;
        playBeep("rest");
      } else if (tabataState === "REST") {
        currentRound++;
        tabataState = "WORK";
        timeLeft = workTime;
        playBeep("go");
      }
      updateTabataUI();
    }
    totalSecondsElapsed++;
  };

  // Init Audio Context on user interaction
  let audioCtx = null;
  const initAudio = () => {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  };

  const playBeep = (type) => {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === "go") {
      // High pitch for GO
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === "rest") {
      // Low pitch for REST
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === "finish") {
      // Success tune
      const now = audioCtx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.frequency.value = freq;
        gain2.gain.setValueAtTime(0.1, now + i * 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);
        osc2.start(now + i * 0.15);
        osc2.stop(now + i * 0.15 + 0.4);
      });
    }
  };

  const startTabata = () => {
    initAudio(); // Initialize audio context on start button click
    workTime = parseInt(inpWork.value) || 20;
    restTime = parseInt(inpRest.value) || 10;
    maxRounds = parseInt(inpRounds.value) || 8;
    currentRound = 1;
    totalSecondsElapsed = 0;

    tabataConfig.classList.add("d-none");
    tabataActive.classList.remove("d-none");

    tabataState = "PREPARE";
    timeLeft = 3; // 3 sec prep
    updateTabataUI();

    if (tabataInterval) clearInterval(tabataInterval);
    tabataInterval = setInterval(tickTabata, 1000);
  };

  const pauseTabata = () => {
    if (tabataInterval) {
      clearInterval(tabataInterval);
      tabataInterval = null;
      if (tabataState === "WORK") tabataState = "PAUSED_WORK";
      if (tabataState === "REST") tabataState = "PAUSED_REST";
      btnPauseTabata.textContent = "Reanudar";
      btnPauseTabata.classList.replace("btn-outline-warning", "btn-outline-success");
    } else {
      if (tabataState === "PAUSED_WORK") tabataState = "WORK";
      if (tabataState === "PAUSED_REST") tabataState = "REST";
      btnPauseTabata.textContent = "Pausa";
      btnPauseTabata.classList.replace("btn-outline-success", "btn-outline-warning");
      tabataInterval = setInterval(tickTabata, 1000);
    }
    updateTabataUI();
  };

  const resetTabata = () => {
    if (tabataInterval) clearInterval(tabataInterval);
    tabataInterval = null;
    tabataState = "IDLE";
    tabataConfig.classList.remove("d-none");
    tabataActive.classList.add("d-none");
    btnPauseTabata.textContent = "Pausa";
    btnPauseTabata.classList.replace("btn-outline-success", "btn-outline-warning");
  };

  // Session Saving
  const btnSaveTabata = document.getElementById("btnSaveTabata");
  const tabataFinishModal = new bootstrap.Modal(document.getElementById("toolTabataFinishModal"));

  const finishTabata = () => {
    if (tabataInterval) clearInterval(tabataInterval);
    stateLabel.textContent = "¡COMPLETADO!";
    stateLabel.className = "fw-bold display-6 mb-2 text-primary";
    progressBar.style.width = "100%";
    progressBar.className = "progress-bar bg-primary";
    playBeep("finish");
    setTimeout(() => {
      // FORCE SWITCH: Manual & Aggressive
      const tm = bootstrap.Modal.getOrCreateInstance(tabataModal);
      tm.hide();

      // Wait a tiny bit for Bootstrap to try its thing, then NUKE IT
      setTimeout(() => {
        // 1. Remove any backdrop in DOM
        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());

        // 2. Clear body classes
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';

        // 3. Show new modal
        tabataFinishModal.show();
      }, 500); // 500ms should be enough for any fade transition to finish naturally
    }, 2000);
  };

  const saveTabataSession = async () => {
    const btn = document.getElementById("btnSaveTabata");
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try {
      const duration = (workTime + restTime) * maxRounds; // Estimate
      const today = new Date().toISOString();
      const payload = {
        routine_id: null, // Ad-hoc session
        start_time: new Date(Date.now() - duration * 1000).toISOString(),
        end_time: new Date().toISOString(),
        sets: [{
          exercise_name: "Tabata HIIT",
          reps: maxRounds,
          weight: 0,
          cardio_duration: duration,
          notes: `Tabata: ${workTime}s work / ${restTime}s rest`
        }]
      };

      const res = await fetch("/workout/api/session/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        // Refresh session history if available
        if (window.loadSessionHistory) window.loadSessionHistory(localStorage.getItem("ai_fitness_uid"));
        if (window.loadHeatmap) window.loadHeatmap(localStorage.getItem("ai_fitness_uid"));

        tabataFinishModal.hide();
        resetTabata();
      } else {
        alert("Error al guardar la sesión.");
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión.");
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  };

  if (btnSaveTabata) btnSaveTabata.addEventListener("click", saveTabataSession);

  // Stepper Logic
  document.querySelectorAll(".tabata-stepper").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const step = parseInt(btn.getAttribute("data-step")) || 0;
      const input = document.getElementById(targetId);
      if (input) {
        let val = parseInt(input.value) || 0;
        val = Math.max(0, val + step);
        input.value = val;
        updateEstimatedTime();
      }
    });
  });

  if (btnStartTabata) btnStartTabata.addEventListener("click", startTabata);
  if (btnPauseTabata) btnPauseTabata.addEventListener("click", pauseTabata);
  if (btnResetTabata) btnResetTabata.addEventListener("click", resetTabata);

  const cleanupStaleBackdrops = () => {
    const openModals = document.querySelectorAll(".modal.show");
    if (openModals.length > 0) return;
    document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());
    document.body.classList.remove("modal-open");
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
  };

  document.addEventListener("hidden.bs.modal", () => {
    setTimeout(cleanupStaleBackdrops, 50);
  });

  // Defensive cleanup on load in case a backdrop gets stuck.
  setTimeout(cleanupStaleBackdrops, 300);

  // Tools Carousel Toggle Logic
  const toolsCollapse = document.getElementById("toolsCollapse");
  const toolsCarousel = document.getElementById("toolsCarousel");
  const toolsChevron = document.getElementById("toolsChevron");

  if (toolsCollapse && toolsCarousel) {
    toolsCollapse.addEventListener("show.bs.collapse", () => {
      // Hide carousel when expanding
      toolsCarousel.style.display = "none";
      if (toolsChevron) toolsChevron.style.transform = "rotate(0deg)";
    });

    toolsCollapse.addEventListener("hide.bs.collapse", () => {
      // Show carousel when collapsing
      toolsCarousel.style.display = "block";
      if (toolsChevron) toolsChevron.style.transform = "rotate(-90deg)";
    });

    // Initial state check
    if (!toolsCollapse.classList.contains("show")) {
      toolsCarousel.style.display = "block";
      if (toolsChevron) toolsChevron.style.transform = "rotate(-90deg)";
    } else {
      toolsCarousel.style.display = "none";
      if (toolsChevron) toolsChevron.style.transform = "rotate(0deg)";
    }
  }

})();
