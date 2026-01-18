(function () {
    const { useState, useMemo } = React;
    const { useWorkout } = window.Runner.hooks;

    window.Runner.components.App = () => {
        const { PreStart, Header, MessageBar, NextUpBar, NavigationWrapper, ActiveExercise, PendingPanel, RestOverlay, SubstitutesModal, ConfirmModal } = window.Runner.components;
        const { currentStep, status, queue, cursor, showCompletionIcon, showCountdown, countdownValue, showPending, setShowPending } = useWorkout();
        const [focusMode, setFocusMode] = useState(false);
        // showPending state moved to context

        const nextStep = useMemo(() => {
            if (!queue || cursor >= queue.length - 1) return null;
            return queue.slice(cursor + 1).find(s => s.type === 'work');
        }, [queue, cursor]);

        if (status === 'LOADING') return <div className="text-center text-white py-5">Cargando Motor...</div>;

        return (
            <React.Fragment>
                <div className={`countdown-overlay ${showCountdown ? 'show' : ''}`}>
                    <img src="/static/images/icon/stw.png" alt="Get Ready" className="countdown-image" />
                    <div className="countdown-text">
                        00:0{countdownValue}
                    </div>
                </div>

                <div className={`completion-overlay ${showCompletionIcon ? 'show' : ''}`}>
                    <img src="/static/images/icon/fw.png" alt="Finished" className="completion-icon" />
                </div>

                {status === 'IDLE' ? (
                    <PreStart
                        focusMode={focusMode}
                        onToggleFocus={() => setFocusMode(prev => !prev)}
                        showPending={showPending}
                        onTogglePending={() => setShowPending(prev => !prev)}
                    />
                ) : status === 'FINISHED' ? (
                    <div className="d-flex flex-column h-100 justify-content-center align-items-center text-success">
                        <h1>¡Entrenamiento Completado!</h1>
                        <p>Guardando...</p>
                    </div>
                ) : (
                    <div className={`player-container ${focusMode ? "focus-mode" : ""}`}>
                        <Header
                            focusMode={focusMode}
                            onToggleFocus={() => setFocusMode(prev => !prev)}
                            showPending={showPending}
                            onTogglePending={() => setShowPending(prev => !prev)}
                        />

                        <div className="visual-stage">
                            {!focusMode && <MessageBar />}
                            {!focusMode && <NextUpBar />}
                            <NavigationWrapper>
                                {currentStep && <ActiveExercise focusMode={focusMode} />}
                            </NavigationWrapper>
                        </div>

                        {(status === 'WORK' || status === 'REST') && (
                            <PendingPanel isOpen={showPending} onClose={() => setShowPending(false)} />
                        )}

                        {status === 'REST' && (
                            <RestOverlay
                                nextStep={nextStep}
                                showPending={showPending}
                                onTogglePending={() => setShowPending(prev => !prev)}
                            />
                        )}
                    </div>
                )}
                <SubstitutesModal />
                <ConfirmModal />
            </React.Fragment>
        );
    };
})();
