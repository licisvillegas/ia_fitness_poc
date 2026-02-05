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

  const resetCounts = (unit) => {
    plateCounts = {};
    plateSets[unit].forEach((p) => {
      plateCounts[p.value] = 0;
    });
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

  if (plateUnit) {
    plateUnit.addEventListener("change", () => {
      const unit = plateUnit.value;
      barWeightInput.value = unit === "kg" ? 20 : 45;
      resetCounts(unit);
      syncPlateUI();
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

  resetCounts(plateUnit.value || "lb");
  syncPlateUI();

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

  const updateEnduranceOverlay = () => {};

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
})();
