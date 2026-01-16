(function () {
    const { useWorkout } = window.Runner.hooks;

    window.Runner.components.NextUpBar = () => {
        const { queue, cursor, status } = useWorkout();
        if (status === 'LOADING' || status === 'IDLE' || status === 'FINISHED') return null;

        let idx = cursor + 1;
        while (idx < queue.length && queue[idx].type !== 'work') {
            idx += 1;
        }
        if (idx >= queue.length) {
            return (
                <div className="px-3 pb-2 text-center w-100">
                    <div className="d-inline-flex align-items-center justify-content-center gap-2 py-1 px-3 rounded-pill border border-success"
                        style={{
                            opacity: 0.9,
                            maxWidth: '95%',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-main)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}>
                        <span className="text-secondary text-uppercase flex-shrink-0" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>Siguiente</span>
                        <span className="text-success fw-bold text-truncate" style={{ fontSize: '0.8rem', maxWidth: '60vw' }}>Fin de la Rutina</span>
                        <i className="fas fa-flag-checkered text-success ms-1"></i>
                    </div>
                </div>
            );
        }

        let restInfo = "";
        const restIdx = cursor + 1;
        if (restIdx < queue.length && queue[restIdx].type === 'rest') {
            const restStep = queue[restIdx];
            restInfo = `${restStep.duration || 0}s`;
        }

        const ex = queue[idx].exercise || {};
        const name = ex.exercise_name || ex.name || "Ejercicio";
        return (
            <div className="px-3 pb-2 text-center w-100">
                <div className="d-inline-flex align-items-center justify-content-center gap-2 py-1 px-3 rounded-pill bg-black-trans border border-dark" style={{ opacity: 0.7, maxWidth: '95%' }}>
                    <span className="text-secondary text-uppercase flex-shrink-0" style={{ fontSize: '0.7rem', letterSpacing: '1px' }}>Siguiente</span>
                    <span className="text-light fw-bold text-truncate" style={{ fontSize: '0.8rem', maxWidth: '60vw' }}>{name}</span>
                    {restInfo && <span className="text-muted flex-shrink-0" style={{ fontSize: '0.7rem' }}>({restInfo})</span>}
                </div>
            </div>
        );
    };
})();
