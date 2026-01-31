document.addEventListener("DOMContentLoaded", function () {
    const html = document.documentElement;
    const themeToggle = document.getElementById('theme-toggle');

    const updateIcon = () => {
        if (!themeToggle) return;
        const icon = themeToggle.querySelector('i');
        if (!icon) return;

        const currentTheme = html.getAttribute('data-theme');
        if (currentTheme === 'light') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    };

    // Función global de cambio
    window.toggleTheme = function () {
        const currentTheme = html.getAttribute('data-theme');
        if (currentTheme === 'light') {
            html.removeAttribute('data-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            html.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
        updateIcon();
    };

    // Cargar tema guardado
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        html.setAttribute('data-theme', 'light');
    }
    // No se necesita else ya que el predeterminado es oscuro (sin atributo)

    updateIcon();

    // Vincular cambio de barra lateral si existe
    if (themeToggle) {
        themeToggle.addEventListener('click', window.toggleTheme);
    }
    // Protección de Imágenes: Prevenir menú contextual en imágenes
    document.addEventListener('contextmenu', function (e) {
        if (e.target.tagName === 'IMG') {
            e.preventDefault();
        }
    });
});
