/**
 * nutrition_ui.js - Lógica de interfaz específica para la página de Nutrición.
 * Codificación: UTF-8
 */

/**
 * Alterna la visibilidad de los detalles de una comida.
 * @param {HTMLElement} element - El encabezado de la comida clickeado.
 */
function toggleMealDetails(element) {
    const details = element.nextElementSibling;
    const icon = element.querySelector('i');
    const isHidden = details.style.display === 'none' || details.style.display === '';

    details.style.display = isHidden ? 'block' : 'none';

    if (icon) {
        icon.classList.toggle('fa-chevron-down', !isHidden);
        icon.classList.toggle('fa-chevron-up', isHidden);
    }
}

/**
 * Funcionalidad (en desarrollo) para agregar una nueva comida.
 */
function addNewMeal() {
    if (window.showAlertModal) {
        window.showAlertModal("Pronto", "Funcionalidad para agregar comida próximamente", "warning");
        return;
    }
    alert('Funcionalidad para agregar comida próximamente');
}

document.addEventListener("DOMContentLoaded", () => {
    // Inicialización de controles de administrador basados en desbloqueo previo
    try {
        if (sessionStorage.getItem('admin_unlocked') === 'true') {
            const controls = document.getElementById('daily-plan-controls');
            if (controls) controls.style.display = 'block';
        }
    } catch (e) {
        console.error("Error al verificar estado de admin", e);
    }
});
