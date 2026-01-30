(function () {
    const { useState, useMemo } = React;
    const { useWorkout } = window.Runner.hooks;

    window.Runner.components.App = () => {
        const { PreStart, Header, MessageBar, NextUpBar, NavigationWrapper, ActiveExercise, PendingPanel, RestOverlay, SubstitutesModal, ConfirmModal, RMCalculatorModal, VideoModal, GlitchOverlay, PauseOverlay, TextRevealOverlay, CountdownOverlay, BreathingOverlay, EnduranceTimerOverlay, PulseOverlay, FlexOverlay, ThunderOverlay, VictoryOverlay, ImpactOverlay, FireOverlay, GoalOverlay, ZenOverlay, NutritionOverlay, RoutinePreparationOverlay, SadOverlay, SnowOverlay, StarsOverlay, EmojiRainOverlay, RealisticOverlay, BasicConfettiOverlay, PrideOverlay, SchoolPrideOverlay, FireworksOverlay, MegaBurstOverlay, FountainOverlay, SvgSuccessOverlay } = window.Runner.components;
        const { currentStep, status, queue, cursor, showCompletionIcon, showCountdown, countdownValue, showPending, setShowPending, finishWorkout } = useWorkout();
        const [focusMode, setFocusMode] = useState(false);
        // showPending state moved to context

        const nextStep = useMemo(() => {
            if (!queue || cursor >= queue.length - 1) return null;
            return queue[cursor + 1];
        }, [queue, cursor]);

        // Auto-Focus on Landscape
        React.useEffect(() => {
            const handleOrientationChange = () => {
                const isLandscape = window.matchMedia("(orientation: landscape)").matches;
                // Only enforce if different to prevent overriding user manual toggles needlessly
                // setFocusMode(isLandscape); 
                // However, simple binding is robust for rotation. 
                // The key fix is removing [status] dependency so it doesn't fire on workout steps.
                setFocusMode(isLandscape);
            };

            // Initial check
            handleOrientationChange();

            // Listeners
            window.addEventListener('resize', handleOrientationChange);

            return () => window.removeEventListener('resize', handleOrientationChange);
        }, []); // Remove status dependency

        if (status === 'LOADING') return <div className="text-center text-white py-5">Cargando Motor...</div>;

        return (
            <React.Fragment>



                <div className={`completion-overlay ${showCompletionIcon ? 'show' : ''}`}>
                    <img src="/static/images/icon/fw.png" alt="Finished" className="completion-icon" />
                </div>

                {
                    status === 'IDLE' ? (
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
                                    {currentStep ? (
                                        <ActiveExercise focusMode={focusMode} />
                                    ) : (
                                        <div className="d-flex flex-column h-100 justify-content-center align-items-center animate-entry">
                                            <h3 className="text-white mb-3">¡Ejercicios completados!</h3>
                                            <button
                                                className="btn btn-success btn-lg px-5 py-3 rounded-pill fw-bold shadow"
                                                onClick={finishWorkout}
                                            >
                                                <i className="fas fa-flag-checkered me-2"></i>
                                                FINALIZAR RUTINA
                                            </button>
                                        </div>
                                    )}
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
                    )
                }
                <SubstitutesModal />
                <ConfirmModal />
                <RMCalculatorModal />
                <VideoModal />
                <GlitchOverlay />
                <PauseOverlay />
                <TextRevealOverlay />
                <CountdownOverlay />
                <BreathingOverlay />
                <EnduranceTimerOverlay />
                <PulseOverlay />
                <FlexOverlay />
                <ThunderOverlay />
                <VictoryOverlay />
                <ImpactOverlay />
                <FireOverlay />
                <GoalOverlay />
                <ZenOverlay />
                <NutritionOverlay />
                <RoutinePreparationOverlay />
                <SadOverlay />
                <SnowOverlay />
                <StarsOverlay />
                <EmojiRainOverlay />
                <RealisticOverlay />
                <BasicConfettiOverlay />
                <PrideOverlay />
                <SchoolPrideOverlay />
                <FireworksOverlay />
                <MegaBurstOverlay />
                <FountainOverlay />
                <SvgSuccessOverlay />
            </React.Fragment >
        );
    };
})();
