(function () {
    const { useWorkout } = window.Runner.hooks;
    const { formatTime } = window.Runner.utils;

    window.Runner.components.RestOverlay = ({ nextStep, showPending, onTogglePending }) => {
        const { currentStep, skipRest, stepTimer, addRestTime, notificationPermission, requestNotificationPermission, cancelWorkout, queue, cursor, isStepLogged } = useWorkout();
        const { useState, useEffect } = React;
        const [showRestNote, setShowRestNote] = useState(false);
        const [isLandscapeCompact, setIsLandscapeCompact] = useState(false);

        if (currentStep.type !== 'rest') return null;

        const getUpcomingStep = () => {
            if (!queue || cursor >= queue.length - 1) return null;
            let idx = cursor + 1;
            const immediate = queue[idx];
            if (immediate?.type === 'rest') return immediate;
            while (idx < queue.length) {
                const step = queue[idx];
                if (step.type === 'work' && isStepLogged(step.id)) {
                    idx += 1;
                    if (idx < queue.length && queue[idx].type === 'rest') {
                        idx += 1;
                    }
                    continue;
                }
                return step;
            }
            return null;
        };

        const upcomingStep = getUpcomingStep();
        const isLastStep = !upcomingStep;
        const isNextRest = upcomingStep?.type === 'rest';
        const nextRestTime = isNextRest ? formatTime(upcomingStep?.duration || 0) : "";
        const nextExName = isLastStep
            ? "Fin de la Rutina"
            : (isNextRest ? `Descanso (${nextRestTime})` : (upcomingStep?.exercise?.name || upcomingStep?.exercise?.exercise_name || "Siguiente Ejercicio"));
        const nextNote = isNextRest ? "" : (upcomingStep?.exercise?.comment || upcomingStep?.exercise?.note || upcomingStep?.exercise?.description || "");
        // const isNextTimeBased = nextStep?.isTimeBased || false; 

        const restNoteRaw = currentStep?.label || currentStep?.note || "";
        const restNote = restNoteRaw && restNoteRaw !== 'Descansar' ? restNoteRaw : "";
        const hasNotes = Boolean(restNote || nextNote);

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

        // Superposición de Efecto de Respiración
        useEffect(() => {
            let stopAnimation = null;
            if (window.WorkoutAnimations && typeof window.WorkoutAnimations.breathingEffect === 'function') {
                // Ejecutar por una larga duración (1 hora) para que no se detenga antes si el usuario extiende el descanso
                stopAnimation = window.WorkoutAnimations.breathingEffect(3600);
            }
            return () => {
                if (stopAnimation) stopAnimation();
            };
        }, []);

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
                            className={`btn btn-sm rounded-pill px-3 pending-toggle-btn ${showPending ? 'btn-info text-dark' : 'btn-outline-info'}`}
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
                    {hasNotes && (
                        <button
                            className="btn btn-outline-info btn-sm rounded-circle mt-2"
                            style={{ width: '38px', height: '38px' }}
                            onClick={() => setShowRestNote(true)}
                            title="Ver notas"
                        >
                            <i className="fas fa-info"></i>
                        </button>
                    )}
                </div>

                <div className={`text-center ${nextSpacing} animate-pulse mt-5`}>
                    <p className="text-muted small mb-2 text-uppercase">A continuación</p>
                    <h3 className="h2 fw-bold mb-2">{nextExName}</h3>
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

                {showRestNote && hasNotes && (
                    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                        style={{ background: "rgba(0,0,0,0.65)", zIndex: 2300, padding: "16px" }}
                        onClick={() => setShowRestNote(false)}
                    >
                        <div
                            className="alert border-secondary m-0"
                            style={{ maxWidth: "560px", width: "100%", backgroundColor: "#0f1720", color: "#e8f4ff" }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <strong className="text-info">Notas</strong>
                                <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowRestNote(false)}>
                                    Cerrar
                                </button>
                            </div>
                            {restNote && (
                                <div className="mb-3">
                                    <div className="text-uppercase text-secondary small mb-1">Descanso</div>
                                    <div style={{ whiteSpace: "pre-wrap", color: "#8fe4ff" }}>{restNote}</div>
                                </div>
                            )}
                            {nextNote && (
                                <div>
                                    <div className="text-uppercase text-secondary small mb-1">Siguiente ejercicio</div>
                                    <div style={{ whiteSpace: "pre-wrap", color: "#ffe2a3" }}>{nextNote}</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };
})();
