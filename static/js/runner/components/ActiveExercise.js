(function () {
    const { useWorkout } = window.Runner.hooks;
    const { translateBodyPart } = window.Runner.constants;
    const { getExerciseWithLookup, resolveSubstitutes, openVideoModal } = window.Runner.logic;

    window.Runner.components.ActiveExercise = ({ focusMode }) => {
        const { TimerControls, InputControls } = window.Runner.components;
        const { currentStep, exerciseLookup, openSubstituteModal, deferExercise } = useWorkout();

        if (!currentStep || currentStep.type !== 'work' || !currentStep.exercise) return null;

        const ex = getExerciseWithLookup(currentStep.exercise || {}, exerciseLookup);
        const name = ex.exercise_name || ex.name || 'Ejercicio';
        const bodyPart = translateBodyPart(ex.body_part);
        const hasVideo = ex.video_url && ex.video_url.trim() !== "";
        const substitutes = resolveSubstitutes(
            ex.substitutes || ex.equivalents || ex.equivalent_exercises || [],
            exerciseLookup
        );
        const exerciseComment = ex.comment || ex.note || ex.description || "";
        const groupComment = currentStep.groupComment || "";

        if (focusMode) {
            return (
                <div className={`active-card ${currentStep.isTimeBased ? 'time-mode' : ''} animate-entry d-flex flex-column h-100 position-relative`}>

                    {/* Defer Button - Discrete top right */}
                    <button
                        className="btn btn-sm text-secondary position-absolute top-0 end-0 m-2"
                        onClick={deferExercise}
                        title="Dejar Pendiente"
                        style={{ zIndex: 10, opacity: 0.6 }}
                    >
                        <i className="fas fa-history fa-lg"></i>
                    </button>

                    <div className="d-flex flex-column justify-content-between h-100">
                        <div className="text-center mb-2 pt-2">
                            <div className="text-info fs-6 mb-1">
                                Serie <span className="text-white fw-bold">{currentStep.setNumber}</span> / <span className="text-secondary">{currentStep.totalSets}</span>
                            </div>
                            <h2 className="fw-bold text-white m-0 heading-wrap">{name}</h2>
                            {currentStep.isTimeBased && (
                                <div className="text-secondary small mt-1">Tiempo objetivo: {Math.round((currentStep.target?.time || 0) / 60)} min</div>
                            )}
                        </div>
                        <div className="flex-grow-1 d-flex flex-column justify-content-center">
                            {currentStep.isTimeBased ? (
                                <TimerControls step={currentStep} />
                            ) : (
                                <InputControls key={currentStep.id} step={currentStep} hideRPE focusMode={focusMode} />
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className={`active-card ${currentStep.isTimeBased ? 'time-mode' : ''} animate-entry d-flex flex-column h-100 position-relative`}>

                {/* Defer Button - Discrete top right (Same as Focus Mode) */}
                <button
                    className="btn btn-sm text-secondary position-absolute top-0 end-0 m-2"
                    onClick={deferExercise}
                    title="Dejar Pendiente"
                    style={{ zIndex: 10, opacity: 0.6 }}
                >
                    <i className="fas fa-history fa-lg"></i>
                </button>

                <div className="d-flex flex-column justify-content-between h-100">

                    <div className="text-center mobile-compact-mb mb-3">
                        {currentStep.groupName && (
                            <div className="mb-1">
                                <span className="badge bg-danger px-2 py-1 small">{currentStep.groupName}</span>
                            </div>
                        )}
                        <span className="text-secondary text-uppercase small tracking-widest d-block mb-1" style={{ fontSize: '0.7rem' }}>{bodyPart}</span>

                        <div className="d-flex flex-column align-items-center justify-content-center gap-1">
                            <h2 className="fw-bold text-white m-0 heading-wrap">{name}</h2>
                            <div className="d-flex flex-wrap align-items-center justify-content-center gap-2">
                                {hasVideo && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger rounded-pill px-3 py-0"
                                        style={{ fontSize: '0.75rem' }}
                                        onClick={() => openVideoModal(ex.video_url)}
                                    >
                                        <i className="fab fa-youtube me-1"></i> Tutorial
                                    </button>
                                )}
                                {substitutes.length > 0 && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-info rounded-pill px-3 py-0"
                                        style={{ fontSize: '0.75rem' }}
                                        onClick={() => openSubstituteModal()}
                                    >
                                        <i className="fas fa-exchange-alt me-1"></i> Sustitutos
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-warning rounded-pill px-3 py-0"
                                    style={{ fontSize: '0.75rem' }}
                                    onClick={deferExercise}
                                    title="Saltar y dejar pendiente (sin omitir descanso)"
                                >
                                    <i className="fas fa-history me-1"></i> Dejar Pendiente
                                </button>
                            </div>
                        </div>
                        <div className="mt-1 text-info fs-6">
                            Serie <span className="text-white fw-bold">{currentStep.setNumber}</span> / <span className="text-secondary">{currentStep.totalSets}</span>
                        </div>
                    </div>

                    <div className="flex-grow-1 d-flex flex-column justify-content-center">
                        {currentStep.isTimeBased ? (
                            <TimerControls step={currentStep} />
                        ) : (
                            <InputControls key={currentStep.id} step={currentStep} />
                        )}
                    </div>

                    {(groupComment || exerciseComment) && (
                        <div className="mt-2 pt-2 border-top border-secondary text-center">
                            {groupComment && <div className="text-cyber-orange small">{groupComment}</div>}
                            {exerciseComment && <div className="text-secondary small">{exerciseComment}</div>}
                        </div>
                    )}
                </div>
            </div>
        );
    };
})();
