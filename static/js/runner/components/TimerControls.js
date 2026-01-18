(function () {
    const { useWorkout } = window.Runner.hooks;
    const { formatTime } = window.Runner.utils;

    window.Runner.components.TimerControls = ({ step }) => {
        const { stepTimer, isTimerRunning, setIsTimerRunning, next, logSet, notificationPermission, requestNotificationPermission } = useWorkout();

        const toggle = () => setIsTimerRunning(!isTimerRunning);
        const finish = () => {
            logSet({
                time_seconds: step.target.time
            });
            next();
        }

        return (
            <div className="text-center py-4">
                <div className="display-1 fw-bold text-theme mb-2 font-monospace" style={{ textShadow: '0 0 20px rgba(0,0,0,0.1)' }}>
                    {formatTime(stepTimer)}
                </div>
                <p className="text-success mb-4">TIEMPO OBJETIVO</p>

                <div className="d-grid gap-2">
                    {!isTimerRunning && stepTimer > 0 && (
                        <button className="btn btn-action" onClick={toggle}>INICIAR <i className="fas fa-play ms-2"></i></button>
                    )}
                    {isTimerRunning && (
                        <button className="btn btn-outline-light py-3 border-2" onClick={toggle}>PAUSA ||</button>
                    )}
                    <button className="btn btn-outline-secondary btn-sm mt-3" onClick={finish}>
                        {useWorkout().queue.slice(useWorkout().cursor + 1).some(s => s.type === 'work')
                            ? "Terminar Manualmente"
                            : "Finalizar Rutina"}
                    </button>

                    {notificationPermission === 'default' && (
                        <button className="btn btn-sm btn-link text-secondary mt-2 text-decoration-none" onClick={requestNotificationPermission}>
                            <i className="fas fa-bell me-1"></i> Activar Notificaciones
                        </button>
                    )}
                </div>
            </div>
        );
    };
})();
