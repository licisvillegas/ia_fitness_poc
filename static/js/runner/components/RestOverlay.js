(function () {
    const { useWorkout } = window.Runner.hooks;
    const { formatTime } = window.Runner.utils;

    window.Runner.components.RestOverlay = ({ nextStep, showPending, onTogglePending }) => {
        const { currentStep, skipRest, stepTimer, addRestTime, notificationPermission, requestNotificationPermission, cancelWorkout } = useWorkout();

        if (currentStep.type !== 'rest') return null;

        const isLastStep = !nextStep;
        const nextExName = isLastStep ? "Fin de la Rutina" : (nextStep?.exercise?.name || nextStep?.exercise?.exercise_name || "Siguiente Ejercicio");
        const nextNote = nextStep?.exercise?.comment || nextStep?.exercise?.note || nextStep?.exercise?.description || "";
        // const isNextTimeBased = nextStep?.isTimeBased || false; 

        return (
            <div className="rest-overlay position-fixed top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center p-4" style={{ zIndex: 2000, backgroundColor: 'var(--bg-body)' }}>
                <div className="position-absolute top-0 end-0 p-3 d-flex align-items-center gap-3">
                    {notificationPermission === 'default' && (
                        <button className="btn btn-sm btn-outline-secondary rounded-circle" onClick={requestNotificationPermission} title="Activar Notificaciones">
                            <i className="fas fa-bell"></i>
                        </button>
                    )}
                    <div className="d-flex align-items-center gap-2">
                        <button
                            className="btn btn-sm btn-outline-secondary rounded-circle"
                            onClick={() => window.toggleTheme && window.toggleTheme()}
                            title="Cambiar Tema"
                        >
                            <i className="fas fa-adjust"></i>
                        </button>
                        <button
                            className={`btn btn-sm rounded-pill px-3 ${showPending ? 'btn-info text-dark' : 'btn-outline-info'}`}
                            onClick={onTogglePending}
                            title="Pendientes"
                        >
                            <i className="fas fa-list"></i>
                        </button>

                        <button
                            className="btn btn-sm btn-outline-danger rounded-circle ms-2"
                            onClick={cancelWorkout}
                            style={{ width: '32px', height: '32px', padding: 0 }}
                            title="Cancelar Rutina"
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                <div className="text-center mb-5">
                    <h2 className="display-1 fw-bold mb-0 text-success font-monospace">{formatTime(stepTimer)}</h2>
                    <p className="text-secondary text-uppercase letter-spacing-2 mt-2">Descanso</p>
                </div>

                <div className="text-center mb-5 animate-pulse">
                    <p className="text-muted small mb-2 text-uppercase">A continuación</p>
                    <h3 className="h2 fw-bold mb-3">{nextExName}</h3>
                    {nextNote && (
                        <div className="alert alert-dark border-secondary text-info d-inline-block px-4 py-2" style={{ maxWidth: '90%' }}>
                            <i className="fas fa-info-circle me-2"></i>{nextNote}
                        </div>
                    )}
                </div>

                <div className="d-flex justify-content-center gap-2 mb-4">
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => addRestTime(-60)} disabled={stepTimer < 60}>-60s</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => addRestTime(-30)} disabled={stepTimer < 30}>-30s</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => addRestTime(-5)} disabled={stepTimer < 5}>-5s</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => addRestTime(5)}>+5s</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => addRestTime(30)}>+30s</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => addRestTime(60)}>+60s</button>
                </div>

                <button className="btn btn-outline-secondary rounded-pill px-5 py-3" onClick={skipRest}>
                    SALTAR DESCANSO <i className="fas fa-forward ms-2"></i>
                </button>
            </div>
        );
    };
})();
