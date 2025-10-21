(function(){
  function setBrandLink(){
    try {
      var brand = document.querySelector('.navbar .navbar-brand');
      if (!brand) return;
      var isLogged = !!localStorage.getItem('ai_fitness_user');
      var target = isLogged ? '/user-profile' : '/';
      // Set href for accessibility and add click handler to ensure correct nav
      brand.setAttribute('href', target);
      brand.addEventListener('click', function(e){
        // In case the href was pre-rendered differently
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
