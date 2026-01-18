(function () {
    const { useMemo } = React;
    const { useWorkout } = window.Runner.hooks;
    const { formatTime } = window.Runner.utils;

    window.Runner.components.Header = ({ focusMode, onToggleFocus, showPending, onTogglePending }) => {
        const {
            routine, globalTime, cursor, queue, isPaused, togglePause, cancelWorkout, status, startWorkout,
            notificationPermission, requestNotificationPermission
        } = useWorkout();

        const workStats = useMemo(() => {
            if (!queue) return { passed: 0, total: 0 };
            const total = queue.filter(s => s.type === 'work').length;
            const passed = queue.slice(0, cursor + 1).filter(s => s.type === 'work').length;
            return { passed, total };
        }, [cursor, queue]);

        return (
            <div className="header-section d-flex justify-content-between align-items-center p-3 relative">
                <div className="header-info d-flex align-items-center gap-3" style={{ flex: 1 }}>
                    <a href="/dashboard" className="btn btn-sm btn-outline-secondary rounded-circle" title="Volver al Dashboard">
                        <i className="fas fa-arrow-left"></i>
                    </a>
                    <div style={{ minWidth: 0 }}>
                        <h5 className="m-0 fw-bold text-theme text-truncate" style={{ fontSize: '1rem' }}>{routine ? routine.name : ''}</h5>
                        <div className="text-secondary small text-truncate">
                            Serie {workStats.passed} / {workStats.total}
                        </div>
                    </div>
                </div>

                <div className="header-timer position-absolute start-50 top-50 translate-middle mobile-compact-timer">
                    <div className="font-monospace fs-3 text-cyber-green fw-bold bg-black px-3 rounded-pill border border-secondary shadow-sm">
                        {formatTime(globalTime)}
                    </div>
                </div>

                <div className="header-controls d-flex align-items-center gap-2" style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <button
                        className="btn btn-sm btn-outline-secondary rounded-circle"
                        onClick={() => {
                            if (notificationPermission === 'default') {
                                requestNotificationPermission();
                            }
                        }}
                        title={notificationPermission === 'granted' ? "Notificaciones activas" : "Activar notificaciones"}
                        disabled={notificationPermission === 'granted' || notificationPermission === 'denied'}
                    >
                        <i className={`fas ${notificationPermission === 'granted' ? 'fa-bell' : 'fa-bell-slash'}`}></i>
                    </button>

                    <button
                        className="btn btn-sm btn-outline-secondary rounded-circle"
                        onClick={() => window.toggleTheme && window.toggleTheme()}
                        title="Cambiar Tema"
                    >
                        <i className="fas fa-adjust"></i>
                    </button>

                    {status !== 'IDLE' && status !== 'FINISHED' && (
                        <button
                            className={`btn btn-sm rounded-pill px-3 ${showPending ? 'btn-info text-dark' : 'btn-outline-info'}`}
                            onClick={onTogglePending}
                            title="Pendientes"
                        >
                            <i className="fas fa-list"></i>
                        </button>
                    )}
                    <button
                        className={`btn btn-sm rounded-pill px-3 ${focusMode ? 'btn-warning text-dark' : 'btn-outline-warning'}`}
                        onClick={onToggleFocus}
                        title="Modo foco"
                    >
                        <i className="fas fa-bullseye"></i>
                    </button>
                    {status === 'IDLE' ? (
                        <button className="btn btn-sm btn-outline-success rounded-pill px-3" onClick={startWorkout}>
                            <i className="fas fa-play"></i>
                        </button>
                    ) : (
                        <button className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={togglePause}>
                            <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
                        </button>
                    )}

                    {/* Create explicit cancel button that shows up in WORK or REST */}
                    <button
                        className="btn btn-sm btn-outline-danger rounded-circle"
                        onClick={cancelWorkout}
                        style={{ width: '32px', height: '32px', padding: 0 }}
                        title="Cancelar Rutina"
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            </div>
        );
    };
})();
