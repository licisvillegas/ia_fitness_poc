
/**
 * Async Routine Generator Logic
 * Handles polling for Celery tasks.
 */

async function generateRoutineAsync(data) {
    try {
        // Initial request
        const response = await fetch('/api/generate_routine_async', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Error iniciando generacion');
        }

        const result = await response.json();

        // Fallback síncrono: Celery no disponible, resultado directo
        if (response.status === 200) {
            updateLoadingStatus('Completado!', 100);
            return result;
        }

        // Async: polling para Celery task
        const { poll_url } = result;
        updateLoadingStatus('Iniciando tarea...', 0);
        return await pollTask(poll_url);

    } catch (error) {
        console.error("Async Generation Error:", error);
        throw error;
    }
}

async function pollTask(url) {
    const maxAttempts = 60; // 2 minutes approx
    let attempt = 0;
    let delay = 1000; // start with 1s

    while (attempt < maxAttempts) {
        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.state === 'SUCCESS') {
                updateLoadingStatus('Completado!', 100);
                return data.result;
            } else if (data.state === 'FAILURE') {
                throw new Error(data.error || 'La tarea fallo');
            } else {
                // PENDING, STARTED, RETRY
                updateLoadingStatus(`Procesando... (Intento ${attempt + 1})`, Math.min(90, attempt * 5));
            }

            // Wait with backoff
            await new Promise(r => setTimeout(r, delay));
            delay = Math.min(delay * 1.5, 5000); // cap at 5s
            attempt++;

        } catch (e) {
            // Network error during poll, retry unless it's the specific failure above
            if (e.message === 'La tarea fallo') throw e;
            console.warn("Polling error (retrying):", e);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw new Error('Timeout esperando resultado');
}

function updateLoadingStatus(message, percent) {
    // Optional: Update UI progress bar if exists
    const statusEl = document.getElementById('loadingStatusText');
    if (statusEl) statusEl.innerText = message;

    // You could confirm if a progress bar acts here
}
