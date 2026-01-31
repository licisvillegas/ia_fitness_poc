(function () {
  function setBrandLink() {
    try {
      var brand = document.querySelector('.navbar .navbar-brand');
      if (!brand) return;
      var isLogged = !!localStorage.getItem('ai_fitness_user');
      var target = isLogged ? '/user-profile' : '/';
      // Establecer href para accesibilidad y agregar manejador de clic para asegurar navegación correcta
      brand.setAttribute('href', target);
      brand.addEventListener('click', function (e) {
        // En caso de que el href fuera pre-renderizado de manera diferente
        if (brand.getAttribute('href') !== target) {
          e.preventDefault();
          window.location.href = target;
        }
      }, { once: false });
    } catch (e) { /* noop */ }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setBrandLink);
  } else {
    setBrandLink();
  }
})();
