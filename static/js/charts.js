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