const slider = document.getElementById('body-slider');
const imgThin = document.getElementById('img-thin');
const imgMuscle = document.getElementById('img-muscle');
const imgOver = document.getElementById('img-over');
const themeSelect = document.getElementById('body-theme-select');
const playBtn = document.getElementById('body-play');
const genderToggle = document.getElementById('gender-toggle');
const themeToggle = document.getElementById('body-theme-toggle');

const themes = {
  HD2: [
    '/static/images/body/male/01front_d2.png',
    '/static/images/body/male/01front_d.png',
    '/static/images/body/male/01front_d3.png',
  ],
  MaleFitness: [
    '/static/images/body/male/fh01.png',
    '/static/images/body/male/fh02.png',
    '/static/images/body/male/fh03.png',
  ],
  HR1: [
    '/static/images/body/male/1front2.png',
    '/static/images/body/male/1front.png',
    '/static/images/body/male/1front3.png',
  ],
  HD1: [
    '/static/images/body/male/1front_d2.png',
    '/static/images/body/male/1front_d.png',
    '/static/images/body/male/1front_d3.png',
  ],
};

const femaleThemes = {
  FD1: [
    '/static/images/body/female/f_front_d2.png',
    '/static/images/body/female/f_front_d.png',
    '/static/images/body/female/f_front_d3.png',
  ],
  FemaleFitness: [
    '/static/images/body/female/ff01.png',
    '/static/images/body/female/ff02.png',
    '/static/images/body/female/ff03.png',
  ],
};

let currentGender = 'male';

function applyTheme(themeKey) {
  console.log('Applying theme:', themeKey);
  const theme = themes[themeKey] || themes.MaleFitness || themes.HD2;
  console.log('Resolved theme images:', theme);
  if (!theme) {
    console.error('Theme not found for key:', themeKey);
    return;
  }
  imgThin.src = theme[0];
  imgMuscle.src = theme[1];
  imgOver.src = theme[2];
}

let activeMaleTheme = 'HD2';
let activeFemaleTheme = 'FD1';

function applyGender() {
  if (currentGender === 'female') {
    const theme = femaleThemes[activeFemaleTheme] || femaleThemes.FemaleFitness || femaleThemes.FD1;
    imgThin.src = theme[0];
    imgMuscle.src = theme[1];
    imgOver.src = theme[2];
  } else {
    applyTheme(activeMaleTheme);
  }
}

function updateThemeVisibility() {
  if (!themeSelect) return;
  if (currentGender === 'female') {
    themeSelect.classList.add('d-none');
    return;
  }
  const unlocked = sessionStorage.getItem('admin_unlocked') === 'true';
  if (unlocked) {
    themeSelect.classList.remove('d-none');
  } else {
    themeSelect.classList.add('d-none');
  }
}

function updateSliderValue(value) {
  if (!slider) return;
  slider.value = Math.max(0, Math.min(100, Math.round(value)));
  slider.dispatchEvent(new Event('input', { bubbles: true }));
}

let isAnimating = false;
let animFrame = null;

function animateSlider(from, to, durationMs, onComplete) {
  const start = performance.now();
  const delta = to - from;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / durationMs);
    updateSliderValue(from + delta * t);
    if (t < 1) {
      animFrame = requestAnimationFrame(tick);
    } else if (onComplete) {
      onComplete();
    }
  };
  animFrame = requestAnimationFrame(tick);
}

function runAutoMorph() {
  if (!slider || isAnimating) return;
  isAnimating = true;
  if (playBtn) {
    playBtn.disabled = true;
    playBtn.classList.add('is-playing');
  }
  updateSliderValue(0);
  animateSlider(0, 100, 4500, () => {
    animateSlider(100, 50, 2500, () => {
      isAnimating = false;
      if (playBtn) {
        playBtn.disabled = false;
        playBtn.classList.remove('is-playing');
        playBtn.blur();
      }
    });
  });
}

if (slider && imgThin && imgMuscle && imgOver) {
  slider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);

    if (val <= 50) {
      const percentage = val / 50;
      imgThin.style.opacity = (1 - percentage).toString();
      imgMuscle.style.opacity = percentage.toString();
      imgOver.style.opacity = '0';
    } else {
      const percentage = (val - 50) / 50;
      imgThin.style.opacity = '0';
      imgMuscle.style.opacity = (1 - percentage).toString();
      imgOver.style.opacity = percentage.toString();
    }
  });
}

if (playBtn) {
  playBtn.addEventListener('click', runAutoMorph);
}

if (themeSelect && imgThin && imgMuscle && imgOver) {
  themeSelect.addEventListener('change', (e) => {
    activeMaleTheme = e.target.value;
    activeFemaleTheme = 'FD1'; // Basic override if simple select
    applyGender();
  });
  applyGender();
  updateThemeVisibility();
  setInterval(updateThemeVisibility, 1000);
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    console.log('Theme toggle clicked. Current gender:', currentGender);
    if (currentGender === 'male') {
      // Toggle between MaleFitness and HD2
      activeMaleTheme = (activeMaleTheme === 'MaleFitness') ? 'HD2' : 'MaleFitness';
      console.log('Switched male theme to:', activeMaleTheme);
    } else {
      // Toggle between FemaleFitness and FD1
      activeFemaleTheme = (activeFemaleTheme === 'FemaleFitness') ? 'FD1' : 'FemaleFitness';
      console.log('Switched female theme to:', activeFemaleTheme);
    }

    // Add visual feedback
    if (activeMaleTheme === 'MaleFitness' || activeFemaleTheme === 'FemaleFitness') {
      themeToggle.classList.remove('btn-outline-warning');
      themeToggle.classList.add('btn-warning');
    } else {
      themeToggle.classList.add('btn-outline-warning');
      themeToggle.classList.remove('btn-warning');
    }

    applyGender();
  });
}

if (genderToggle && imgThin && imgMuscle && imgOver) {
  genderToggle.addEventListener('click', () => {
    currentGender = currentGender === 'male' ? 'female' : 'male';
    if (currentGender === 'female') {
      genderToggle.innerHTML = '<i class="fas fa-venus me-1"></i><span class="d-none d-sm-inline">Femenino</span>';
    } else {
      genderToggle.innerHTML = '<i class="fas fa-mars me-1"></i><span class="d-none d-sm-inline">Masculino</span>';
    }
    applyGender();
    updateThemeVisibility();
  });
  applyGender();
}

function average(values) {
  const filtered = values.filter((val) => typeof val === 'number' && !Number.isNaN(val) && val > 0);
  if (!filtered.length) return 0;
  const sum = filtered.reduce((acc, val) => acc + val, 0);
  return sum / filtered.length;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function clampScore(score) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

function ratioScore(actual, target) {
  if (!actual || !target) return 0;
  const ratio = actual / target;
  const score = 100 - Math.abs(1 - ratio) * 100;
  return clampScore(score);
}

function ratioToTargetScore(actualRatio, targetRatio) {
  if (!actualRatio || !targetRatio) return 0;
  const score = 100 - (Math.abs(actualRatio - targetRatio) / targetRatio) * 100;
  return clampScore(score);
}

function computePentagonScores(measurements) {
  if (!measurements) return null;
  const data = measurements.measurements || {};

  const neck = toNumber(data.neck);
  const shoulders = toNumber(data.shoulders);
  const waist = toNumber(data.waist);
  const armLeft = average([toNumber(data.biceps_left), toNumber(data.forearm_left)]);
  const armRight = average([toNumber(data.biceps_right), toNumber(data.forearm_right)]);
  const calfLeft = toNumber(data.calf_left);
  const calfRight = toNumber(data.calf_right);
  const thighLeft = toNumber(data.thigh_left);
  const thighRight = toNumber(data.thigh_right);

  const armAvg = average([armLeft, armRight]);
  const calfAvg = average([calfLeft, calfRight]);
  const thighAvg = average([thighLeft, thighRight]);

  const scores = {
    sup: ratioScore(armAvg, neck),
    cross: ratioScore(calfAvg, armAvg),
    vtaper: ratioToTargetScore(shoulders / (waist || 0), 1.618),
    xframe: ratioToTargetScore(thighAvg / (waist || 0), 0.78),
    lateral: clampScore(100 - (Math.abs(armLeft - armRight) + Math.abs(thighLeft - thighRight)) * 5),
  };

  if (Object.values(scores).every((value) => value === 0)) return null;
  return scores;
}

function buildPentagonPoints(values) {
  const center = 110;
  const minRadius = 38;
  const maxRadius = 88;
  const maxValue = 100;
  const angles = [-90, -18, 54, 126, 198];

  return angles
    .map((deg, index) => {
      const ratio = values[index] / maxValue;
      const radius = minRadius + ratio * (maxRadius - minRadius);
      const rad = (deg * Math.PI) / 180;
      const x = center + radius * Math.cos(rad);
      const y = center + radius * Math.sin(rad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function updateSegmentalUI(scores) {
  const polygon = document.getElementById('segmentalPolygon');
  const emptyState = document.getElementById('segmental-empty');
  if (!polygon) return;

  if (!scores) {
    polygon.setAttribute('points', '110,70 156,101 135,152 85,152 64,101');
    if (emptyState) emptyState.classList.remove('d-none');
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');

  // Calculate points

  const values = [scores.sup, scores.cross, scores.vtaper, scores.xframe, scores.lateral];
  const points = buildPentagonPoints(values); // Devuelve cadena "x,y x,y ..."
  polygon.setAttribute('points', points);

  // Actualizar puntos interactivos
  const pointCoords = points.split(' ').map(pair => {
    const [x, y] = pair.split(',');
    return { x, y };
  });

  const metrics = ['sup', 'cross', 'vtaper', 'xframe', 'lateral'];
  const tooltips = {
    'sup': 'Desarrollo superior relativo',
    'cross': 'Equilibrio brazos/piernas',
    'vtaper': 'Relación Hombros-Cintura',
    'xframe': 'Desarrollo piernas vs cintura',
    'lateral': 'Simetría izquierda/derecha'
  };

  const tooltipEl = document.getElementById('seg-tooltip');

  metrics.forEach((metric, index) => {
    const circle = document.getElementById(`pt-${metric}`);
    if (circle && pointCoords[index]) {
      circle.setAttribute('cx', pointCoords[index].x);
      circle.setAttribute('cy', pointCoords[index].y);

      // Add/Update listeners (removing old first to be safe, though typical pattern is simpler)
      // Idealmente usar un delegado o solo onclick si es simple. Para hover:
      // Usar un manejador común para mostrar el tooltip
      const showTooltip = (e) => {
        // Prevenir acciones táctiles predeterminadas si es necesario para evitar disparo doble en algunos dispositivos
        // e.preventDefault(); 

        if (tooltipEl) {
          const score = Math.round(values[index]);
          const desc = tooltips[metric];
          tooltipEl.innerHTML = `<strong class="text-white">${desc}</strong><br><span class="text-cyber-green">${score}/100</span>`;

          if (window.innerWidth <= 768) {
            // Móvil: Centro fijo (dejar que CSS maneje top/left 50%)
            tooltipEl.style.left = '';
            tooltipEl.style.top = '';
            tooltipEl.style.transform = 'translate(-50%, -50%)';
          } else {
            // Escritorio: Posición cerca del punto
            tooltipEl.style.left = `${pointCoords[index].x}px`;
            tooltipEl.style.top = `${pointCoords[index].y - 20}px`;
            tooltipEl.style.transform = 'translate(-50%, -100%)'; // Anclar abajo centro
          }

          tooltipEl.classList.remove('hidden');
          circle.classList.add('active');
        }
      };

      const hideTooltip = () => {
        if (tooltipEl) tooltipEl.classList.add('hidden');
        circle.classList.remove('active');
      };

      // Eventos de mouse
      circle.onmouseenter = showTooltip;
      circle.onmouseleave = hideTooltip;

      // Eventos táctiles
      circle.ontouchstart = (e) => {
        // Detener propagación para prevenir cierre inmediato si tenemos listeners en el documento
        e.stopPropagation();
        showTooltip(e);
      };
      // Opcional: ocultar al tocar en otro lado podría manejarse globalmente,
      // pero por ahora asegurémonos de que tocar otro punto los cambie.
    }
  });

  // Listener global para cerrar tooltip al tocar fuera (para UX móvil)
  document.addEventListener('touchstart', (e) => {
    if (!e.target.closest('.segmental-point') && !e.target.closest('.segmental-tooltip')) {
      const tooltipEl = document.getElementById('seg-tooltip');
      if (tooltipEl && !tooltipEl.classList.contains('hidden')) {
        tooltipEl.classList.add('hidden');
        // Recuperar círculos activos si hay y eliminar clase active
        const activeCircles = document.querySelectorAll('.segmental-point.active');
        activeCircles.forEach(c => c.classList.remove('active'));
      }
    }
  });

  const format = (value) => `${Math.round(value)}%`;
  const labels = {
    'seg-sup': `Brazo/Cuello ${format(scores.sup)}`,
    'seg-cross': `Pant/Brazo ${format(scores.cross)}`,
    'seg-vtaper': `V-Taper ${format(scores.vtaper)}`,
    'seg-xframe': `Muslo/Cint ${format(scores.xframe)}`,
    'seg-lateral': `Balance Lat ${format(scores.lateral)}`,
  };

  Object.keys(labels).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = labels[id];
  });
}

async function loadSegmentalData() {
  const chart = document.getElementById('segmental-chart');
  if (!chart) return;

  try {
    const resp = await fetch('/api/user/body_assessment/latest');
    if (!resp.ok) {
      updateSegmentalUI(null);
      return;
    }
    const data = await resp.json();
    const scores = computePentagonScores(data);
    updateSegmentalUI(scores);
  } catch (e) {
    updateSegmentalUI(null);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadSegmentalData);
} else {
  loadSegmentalData();
}
