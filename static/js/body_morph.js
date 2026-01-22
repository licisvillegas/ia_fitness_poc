const slider = document.getElementById('body-slider');
const imgThin = document.getElementById('img-thin');
const imgMuscle = document.getElementById('img-muscle');
const imgOver = document.getElementById('img-over');
const themeSelect = document.getElementById('body-theme-select');
const playBtn = document.getElementById('body-play');

const themes = {
  HD2: [
    '/static/images/body/male/01front_d2.png',
    '/static/images/body/male/01front_d.png',
    '/static/images/body/male/01front_d3.png',
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

function applyTheme(themeKey) {
  const theme = themes[themeKey] || themes.HD2;
  imgThin.src = theme[0];
  imgMuscle.src = theme[1];
  imgOver.src = theme[2];
}

function updateThemeVisibility() {
  if (!themeSelect) return;
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
    applyTheme(e.target.value);
  });
  applyTheme(themeSelect.value || 'HD2');
  updateThemeVisibility();
  setInterval(updateThemeVisibility, 1000);
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

  const values = [scores.sup, scores.cross, scores.vtaper, scores.xframe, scores.lateral];

  polygon.setAttribute('points', buildPentagonPoints(values));

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
