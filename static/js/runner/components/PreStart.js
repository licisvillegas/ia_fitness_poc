(function () {
    const { useState, useEffect, useMemo } = React;
    const { useWorkout } = window.Runner.hooks;

    window.Runner.components.PreStart = ({ focusMode, onToggleFocus, showPending, onTogglePending }) => {
        // Dependencies
        const { Header, MessageBar, RoutineDetails } = window.Runner.components;
        const { routine, startWorkout } = useWorkout();

        return (
            <div className="player-container pre-start-container">
                <Header focusMode={focusMode} onToggleFocus={onToggleFocus} showPending={showPending} onTogglePending={onTogglePending} />
                <div className="visual-stage text-center">
                    <MessageBar />
                    <RoutineDetails routine={routine} />
                </div>
                <div className="controls-section">
                    <button className="btn btn-action shadow-lg ripple" onClick={startWorkout}>
                        INICIAR ENTRENAMIENTO <i className="fas fa-play ms-2"></i>
                    </button>
                </div>
            </div>
        );
    };
})();
