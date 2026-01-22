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
