const slider = document.getElementById('body-slider');
const imgThin = document.getElementById('img-thin');
const imgMuscle = document.getElementById('img-muscle');
const imgOver = document.getElementById('img-over');
const themeSelect = document.getElementById('body-theme-select');

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
    '/static/images/body/male/1frontd2.png',
    '/static/images/body/male/1frontd.png',
    '/static/images/body/male/1frontd3.png',
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

if (themeSelect && imgThin && imgMuscle && imgOver) {
  themeSelect.addEventListener('change', (e) => {
    applyTheme(e.target.value);
  });
  applyTheme(themeSelect.value || 'HD2');
  updateThemeVisibility();
  setInterval(updateThemeVisibility, 1000);
}
