const slider = document.getElementById('body-slider');
const imgThin = document.getElementById('img-thin');
const imgMuscle = document.getElementById('img-muscle');
const imgOver = document.getElementById('img-over');

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
