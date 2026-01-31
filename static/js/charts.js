fetch('/get_progress/usr_001')
    .then(response => response.json())
    .then(data => {
        const labels = data.map(d => d.date);
        const weights = data.map(d => d.weight_kg);
        new Chart(document.getElementById('progressChart'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Peso (kg)',
                    data: weights,
                    borderWidth: 2,
                    fill: false
                }]
            },
            options: { scales: { y: { beginAtZero: false } } }
        });
    });

function toggleMealDetails(element) {
    var details = element.nextElementSibling;
    var icon = element.querySelector('i');
    if (details.style.display === "none" || details.style.display === "") {
        details.style.display = "block";
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
    } else {
        details.style.display = "none";
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
}

function addNewMeal() {
    if (window.showAlertModal) {
        window.showAlertModal("Próximamente", "¡La funcionalidad para agregar una nueva comida llegará pronto!", "warning");
        return;
    }
    alert("¡La funcionalidad para agregar una nueva comida llegará pronto!");
    // Implementar funcionalidad para agregar nueva comida
}

const weightData = [70, 69, 68, 68, 67]; // Datos de ejemplo
const workoutData = [5, 3, 4, 6, 7];     // Datos de ejemplo
const nutritionData = [2000, 2100, 1800, 1900, 2200]; // Ejemplo
