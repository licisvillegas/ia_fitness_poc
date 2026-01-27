/**
 * dashboard_charts.js - Gestión de gráficos para el Dashboard usando Chart.js
 * Codificación: UTF-8
 */

let charts = [];

/**
 * Inicializa o actualiza todos los gráficos del dashboard.
 * @param {Array} data - Datos de progreso.
 * @param {number|null} latestUserWeight - Último peso registrado.
 */
async function initializeDashboardCharts(data, latestUserWeight) {
    // Destruir gráficos existentes
    charts.forEach(c => c.destroy());
    charts = [];

    const labels = data.map(d => d.date);
    const weights = data.map(d => d.weight_kg);
    const fats = data.map(d => d.body_fat);
    const performance = data.map(d => d.performance);
    const tmbArr = data.map(d => d.tmb);

    // Fetch de estadísticas semanales y volumen diario de forma asíncrona pero coordinada
    let weeklyLabels = [], weeklySessions = [], dailyVolumeLabels = [], dailyVolumes = [];

    try {
        const userId = localStorage.getItem("ai_fitness_uid");
        if (userId) {
            const [wRes, vRes] = await Promise.all([
                fetch(`/workout/api/stats/weekly?user_id=${userId}`),
                fetch(`/workout/api/stats/volume?user_id=${userId}`)
            ]);

            if (wRes.ok) {
                const wData = await wRes.json();
                weeklyLabels = wData.map(d => d.date_label);
                weeklySessions = wData.map(d => d.sessions);
            }
            if (vRes.ok) {
                const vData = await vRes.json();
                dailyVolumeLabels = vData.map(d => d.date);
                dailyVolumes = vData.map(d => d.volume);
            }
        }
    } catch (e) {
        console.error("Error al cargar datos adicionales para gráficos", e);
    }

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const textColor = isLight ? '#374151' : '#e5e7eb';
    const gridColor = isLight ? '#e5e7eb' : '#374151';
    const colors = { blue: "#3b82f6", green: "#10b981", yellow: "#facc15", red: "#ef4444" };

    const commonOpts = {
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
            x: { ticks: { color: textColor }, grid: { color: gridColor } },
            y: { ticks: { color: textColor }, grid: { color: gridColor } }
        }
    };

    // 1. Gráfico de Peso
    const weightCtx = document.getElementById("weightChart");
    if (weightCtx) {
        charts.push(new Chart(weightCtx, {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: window.t ? t('chart_weight') : 'Peso',
                    data: weights,
                    borderColor: colors.blue,
                    backgroundColor: "rgba(59,130,246,0.2)",
                    fill: true,
                    tension: 0.3
                }]
            },
            options: commonOpts
        }));
    }

    // 2. Gráfico de Grasa
    const fatCtx = document.getElementById("fatChart");
    if (fatCtx) {
        charts.push(new Chart(fatCtx, {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: window.t ? t('chart_fat') : 'Grasa',
                    data: fats,
                    borderColor: colors.red,
                    backgroundColor: "rgba(239,68,68,0.2)",
                    fill: true,
                    tension: 0.3
                }]
            },
            options: commonOpts
        }));
    }

    // 3. Gráfico de Rendimiento / Volumen
    const perfCtx = document.getElementById("performanceChart");
    if (perfCtx) {
        const chartLabels = dailyVolumeLabels.length > 0 ? dailyVolumeLabels : labels;
        charts.push(new Chart(perfCtx, {
            type: "line",
            data: {
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Volumen Avg. (kg)',
                        data: dailyVolumes.length > 0 ? dailyVolumes : performance,
                        borderColor: colors.green,
                        backgroundColor: "rgba(16,185,129,0.2)",
                        fill: true,
                        tension: 0.4,
                        spanGaps: true,
                        yAxisID: 'y'
                    },
                    latestUserWeight ? {
                        label: 'Peso Corporal (kg)',
                        data: chartLabels.map(() => latestUserWeight),
                        borderColor: colors.red,
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0,
                        tension: 0
                    } : null
                ].filter(d => d !== null)
            },
            options: {
                ...commonOpts,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: commonOpts.scales.x,
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        ticks: { color: textColor },
                        grid: commonOpts.scales.y.grid
                    }
                }
            }
        }));
    }

    // 4. Gráfico de Metabolismo / Sesiones
    const metabCtx = document.getElementById("metabolismChart");
    if (metabCtx) {
        charts.push(new Chart(metabCtx, {
            type: "bar",
            data: {
                labels: weeklyLabels.length > 0 ? weeklyLabels : labels,
                datasets: [
                    {
                        label: 'Sesiones Semana',
                        data: weeklySessions.length > 0 ? weeklySessions : tmbArr,
                        backgroundColor: colors.blue,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                ...commonOpts,
                scales: {
                    ...commonOpts.scales,
                    y: { ...commonOpts.scales.y, beginAtZero: true, ticks: { ...commonOpts.scales.y.ticks, stepSize: 1 } }
                }
            }
        }));
    }
}

/**
 * Actualiza las etiquetas de los gráficos cuando cambia el idioma.
 */
function updateChartLabels() {
    try {
        if (!charts || charts.length === 0) return;
        if (window.t) {
            if (charts[0]?.data?.datasets[0]) charts[0].data.datasets[0].label = t('chart_weight');
            if (charts[1]?.data?.datasets[0]) charts[1].data.datasets[0].label = t('chart_fat');
        }
        if (charts[2]?.data?.datasets[0]) charts[2].data.datasets[0].label = 'Volumen Avg. (kg)';
        if (charts[3]?.data?.datasets[0]) charts[3].data.datasets[0].label = 'Sesiones Semana';
        charts.forEach(c => c.update());
    } catch (e) { console.error("Error al actualizar etiquetas de gráficos", e); }
}

/**
 * Limpia los gráficos e indica valores vacíos en la UI.
 */
function clearDashboard() {
    const ids = ["stat-weight", "stat-fat"];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = "?";
    });
    const subIds = ["stat-tmb", "stat-diet"];
    subIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = "--";
    });

    charts.forEach(c => c.destroy());
    charts = [];
}

// Exportar funciones globalmente
window.initializeDashboardCharts = initializeDashboardCharts;
window.updateChartLabels = updateChartLabels;
window.clearDashboard = clearDashboard;
