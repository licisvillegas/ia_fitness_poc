(function () {
    const { useWorkout } = window.Runner.hooks;
    const { formatTime } = window.Runner.utils;

    window.Runner.components.RestOverlay = ({ nextStep, showPending, onTogglePending }) => {
        const { currentStep, skipRest, stepTimer, addRestTime, notificationPermission, requestNotificationPermission, cancelWorkout } = useWorkout();
        const { useState, useEffect } = React;
        const [showRestNote, setShowRestNote] = useState(false);
        const [isLandscapeCompact, setIsLandscapeCompact] = useState(false);

        if (currentStep.type !== 'rest') return null;

        const isLastStep = !nextStep;
        const isNextRest = nextStep?.type === 'rest';
        const nextRestTime = isNextRest ? formatTime(nextStep?.duration || 0) : "";
        const nextExName = isLastStep
            ? "Fin de la Rutina"
            : (isNextRest ? `Descanso (${nextRestTime})` : (nextStep?.exercise?.name || nextStep?.exercise?.exercise_name || "Siguiente Ejercicio"));
        const nextNote = isNextRest ? "" : (nextStep?.exercise?.comment || nextStep?.exercise?.note || nextStep?.exercise?.description || "");
        // const isNextTimeBased = nextStep?.isTimeBased || false; 

        const restNote = currentStep?.label || currentStep?.note || "";

        useEffect(() => {
            const updateLayout = () => {
                const isLandscape = window.matchMedia("(orientation: landscape)").matches;
                const isShort = window.innerHeight <= 520;
                setIsLandscapeCompact(isLandscape && isShort);
            };

            updateLayout();
            window.addEventListener("resize", updateLayout);
            return () => window.removeEventListener("resize", updateLayout);
        }, []);

        useEffect(() => {
            if (stepTimer <= 0) setShowRestNote(false);
        }, [stepTimer]);

        const containerPadding = isLandscapeCompact ? "12px" : "1.5rem";
        const headerSpacing = isLandscapeCompact ? "mb-3" : "mb-5";
        const nextSpacing = isLandscapeCompact ? "mb-3" : "mb-5";
        const controlsSpacing = isLandscapeCompact ? "mb-2" : "mb-4";
        const timeStyle = isLandscapeCompact ? { fontSize: "3rem" } : {};
        const skipBtnClasses = isLandscapeCompact ? "btn btn-outline-secondary rounded-pill px-4 py-2" : "btn btn-outline-secondary rounded-pill px-5 py-3";

        return (
            <div
                className="rest-overlay position-fixed top-0 start-0 w-100 h-100 d-flex flex-column justify-content-center align-items-center"
                style={{ zIndex: 2000, backgroundColor: 'var(--bg-body)', padding: containerPadding }}
            >
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
                <div className={`text-center ${headerSpacing}`}>
                    <h2 className="display-1 fw-bold mb-0 text-success font-monospace" style={timeStyle}>{formatTime(stepTimer)}</h2>
                    <p className="text-secondary text-uppercase letter-spacing-2 mt-2">Descanso</p>
                    {restNote && restNote !== 'Descansar' && (
                        isLandscapeCompact ? (
                            <button
                                className="btn btn-outline-info btn-sm rounded-circle mt-2"
                                style={{ width: '38px', height: '38px' }}
                                onClick={() => setShowRestNote(true)}
                                title="Ver nota"
                            >
                                <i className="fas fa-info"></i>
                            </button>
                        ) : (
                            <div className="alert alert-dark border-secondary text-info d-inline-block mt-3 px-4 py-2" style={{ maxWidth: '90%' }}>
                                <i className="fas fa-sticky-note me-2"></i>{restNote}
                            </div>
                        )
                    )}
                </div>

                <div className={`text-center ${nextSpacing} animate-pulse`}>
                    <p className="text-muted small mb-2 text-uppercase">A continuación</p>
                    <h3 className="h2 fw-bold mb-2">{nextExName}</h3>
                    {nextNote && (
                        <div className="alert alert-dark border-secondary text-info d-inline-block px-4 py-2" style={{ maxWidth: '90%' }}>
                            <i className="fas fa-info-circle me-2"></i>{nextNote}
                        </div>
                    )}
                </div>

                <div className={`d-flex justify-content-center gap-2 ${controlsSpacing}`}>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => addRestTime(-60)} disabled={stepTimer < 60}>-60s</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => addRestTime(-30)} disabled={stepTimer < 30}>-30s</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => addRestTime(-5)} disabled={stepTimer < 5}>-5s</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => addRestTime(5)}>+5s</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => addRestTime(30)}>+30s</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => addRestTime(60)}>+60s</button>
                </div>

                <button className={skipBtnClasses} onClick={skipRest}>
                    SALTAR DESCANSO <i className="fas fa-forward ms-2"></i>
                </button>

                {showRestNote && (
                    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                        style={{ background: "rgba(0,0,0,0.65)", zIndex: 2300, padding: "16px" }}
                        onClick={() => setShowRestNote(false)}
                    >
                        <div
                            className="alert alert-dark border-secondary text-info m-0"
                            style={{ maxWidth: "560px", width: "100%" }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <strong className="text-info">Nota del descanso</strong>
                                <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowRestNote(false)}>
                                    Cerrar
                                </button>
                            </div>
                            <div>{restNote}</div>
                        </div>
                    </div>
                )}
            </div>
        );
    };
})();
