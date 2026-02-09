(function () {
    const { useState, useMemo } = React;
    const { useWorkout } = window.Runner.hooks;

    window.Runner.components.App = () => {
        const { PreStart, Header, MessageBar, NextUpBar, NavigationWrapper, ActiveExercise, PendingPanel, RestOverlay, SubstitutesModal, ConfirmModal, RMCalculatorModal, VideoModal, GlitchOverlay, PauseOverlay, TextRevealOverlay, CountdownOverlay, BreathingOverlay, EnduranceTimerOverlay, TempoOverlay, PulseOverlay, FlexOverlay, ThunderOverlay, VictoryOverlay, ImpactOverlay, FireOverlay, GoalOverlay, ZenOverlay, NutritionOverlay, RoutinePreparationOverlay, SadOverlay, SnowOverlay, StarsOverlay, EmojiRainOverlay, RealisticOverlay, BasicConfettiOverlay, PrideOverlay, SchoolPrideOverlay, FireworksOverlay, MegaBurstOverlay, FountainOverlay, SvgSuccessOverlay } = window.Runner.components;
        const { currentStep, status, queue, cursor, showCompletionIcon, showCountdown, countdownValue, showPending, setShowPending, finishWorkout } = useWorkout();
        const [focusMode, setFocusMode] = useState(false);
        // El estado showPending se movió al contexto

        const nextStep = useMemo(() => {
            if (!queue || cursor >= queue.length - 1) return null;
            return queue[cursor + 1];
        }, [queue, cursor]);

        // Enfoque automático en horizontal
        React.useEffect(() => {
            const handleOrientationChange = () => {
                const isLandscape = window.matchMedia("(orientation: landscape)").matches;
                // Solo aplicar si es diferente para evitar anular los cambios manuales del usuario innecesariamente
                // setFocusMode(isLandscape); 
                // Sin embargo, la vinculación simple es robusta para la rotación. 
                // La solución clave es eliminar la dependencia [status] para que no se dispare en los pasos del entrenamiento.
                setFocusMode(isLandscape);
            };

            // Comprobación inicial
            handleOrientationChange();

            // Oyentes
            window.addEventListener('resize', handleOrientationChange);

            return () => window.removeEventListener('resize', handleOrientationChange);
        }, []); // Eliminar dependencia de estado

        if (status === 'LOADING') return (
            <div className="text-center text-white py-5">
                <h3>Cargando Motor...</h3>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        );
        if (status === 'ERROR') return (
            <div className="d-flex flex-column h-100 justify-content-center align-items-center text-danger">
                <h1>Error de Carga</h1>
                <p>No se pudo iniciar el entrenamiento.</p>
                <p className="small text-secondary">Verifique la consola para más detalles.</p>
                <button className="btn btn-outline-light mt-3" onClick={() => window.location.reload()}>Reintentar</button>
            </div>
        );

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
                <TempoOverlay />
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
