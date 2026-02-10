(function () {
    const { useState } = React;
    const { useWorkout } = window.Runner.hooks;
    const { translateBodyPart } = window.Runner.constants;
    const { getExerciseWithLookup, resolveSubstitutes, openVideoModal } = window.Runner.logic;

    window.Runner.components.ActiveExercise = ({ focusMode }) => {
        const { TimerControls, InputControls, CountdownTimer, HeartRateModal } = window.Runner.components;
        const { currentStep, exerciseLookup, openSubstituteModal, deferExercise } = useWorkout();

        if (!currentStep || currentStep.type !== 'work' || !currentStep.exercise) return null;

        const ex = getExerciseWithLookup(currentStep.exercise || {}, exerciseLookup);
        const exType = (ex.exercise_type || ex.type || "").toString().toLowerCase();
        const name = ex.exercise_name || ex.name || 'Ejercicio';
        const bodyPart = translateBodyPart(ex.body_part);
        const hasVideo = ex.video_url && ex.video_url.trim() !== "";
        const substitutes = resolveSubstitutes(
            ex.substitutes || ex.equivalents || ex.equivalent_exercises || [],
            exerciseLookup
        );
        const exerciseComment = ex.comment || ex.note || ex.description || "";
        const groupComment = currentStep.groupComment || "";
        const [showExerciseNote, setShowExerciseNote] = useState(false);
        const [showHeartRate, setShowHeartRate] = useState(false);
        const hasExerciseNote = Boolean(exerciseComment);
        const showHeartRateButton = currentStep.isTimeBased && (exType === "cardio" || exType === "time" || currentStep.isTimeBased);
        const userAge = window.__RUNNER__?.currentUserAge ?? window.currentUserAge ?? null;

        const exerciseNoteButton = hasExerciseNote ? (
            <button
                type="button"
                className="btn btn-sm btn-outline-info rounded-circle exercise-note-btn"
                title="Ver notas del ejercicio"
                onClick={() => setShowExerciseNote(true)}
            >
                <i className="fas fa-info"></i>
            </button>
        ) : null;

        const exerciseNoteModal = showExerciseNote && hasExerciseNote ? (
            <div
                className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                style={{ background: "rgba(0,0,0,0.65)", zIndex: 2300, padding: "16px" }}
                onClick={() => setShowExerciseNote(false)}
            >
                <div
                    className="alert border-secondary m-0"
                    style={{ maxWidth: "560px", width: "100%", backgroundColor: "#0f1720", color: "#e8f4ff" }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <strong className="text-info">Notas del ejercicio</strong>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowExerciseNote(false)}>
                            Cerrar
                        </button>
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", color: "#8fe4ff" }}>{exerciseComment}</div>
                </div>
            </div>
        ) : null;

        const heartRateModal = showHeartRate ? (
            <HeartRateModal isOpen={showHeartRate} onClose={() => setShowHeartRate(false)} age={userAge} />
        ) : null;

        const cardClassName = `active-card ${currentStep.isTimeBased ? 'time-mode' : ''} animate-entry d-flex flex-column position-relative ${focusMode ? 'h-100' : ''}`;
        const contentClassName = focusMode
            ? "d-flex flex-column justify-content-between h-100"
            : "d-flex flex-column gap-3";

        if (focusMode) {
            return (
                <div className={cardClassName}>

                    {/* Controles superiores derecha: Video y Posponer */}
                    <div className="position-absolute top-0 end-0 m-2 d-flex gap-1" style={{ zIndex: 10 }}>
                        {hasVideo && (
                            <button
                                className="btn btn-sm text-danger"
                                onClick={() => openVideoModal(ex.video_url)}
                                title="Ver Video"
                                style={{ opacity: 0.8 }}
                            >
                                <i className="fab fa-youtube fa-lg"></i>
                            </button>
                        )}
                        <button
                            className="btn btn-sm text-secondary"
                            onClick={deferExercise}
                            title="Dejar Pendiente"
                            style={{ opacity: 0.6 }}
                        >
                            <i className="fas fa-history fa-lg"></i>
                        </button>
                    </div>

                    <div className={contentClassName}>
                        <div className="text-center mb-2 pt-2">
                            <div className="text-info fs-6 mb-1 d-inline-flex align-items-center gap-2">
                                <span>
                                    Serie <span className="text-white fw-bold">{currentStep.setNumber}</span> / <span className="text-secondary">{currentStep.totalSets}</span>
                                </span>
                                {exerciseNoteButton}
                                {showHeartRateButton && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger rounded-circle"
                                        title="Zonas de frecuencia cardiaca"
                                        onClick={() => setShowHeartRate(true)}
                                    >
                                        <i className="fas fa-heartbeat"></i>
                                    </button>
                                )}
                            </div>
                            <h2 className="fw-bold text-white m-0 heading-wrap" style={name.length > 20 ? { fontSize: '1.2rem' } : {}}>{name}</h2>
                            {currentStep.isTimeBased && (
                                <div className="text-secondary small mt-1">Tiempo objetivo: {Math.round((currentStep.target?.time || 0) / 60)} min</div>
                            )}
                            <div className="mt-3 d-flex justify-content-center">
                                <CountdownTimer />
                            </div>
                        </div>
                        <div className="flex-grow-1 d-flex flex-column justify-content-center">
                            {currentStep.isTimeBased ? (
                                <TimerControls step={currentStep} />
                            ) : (
                                <InputControls key={currentStep.id} step={currentStep} hideRPE focusMode={focusMode} />
                            )}
                        </div>
                        {exerciseNoteModal}
                        {heartRateModal}
                    </div>
                </div>
            );
        }

        return (
            <div className={cardClassName}>

                {/* Botón de posponer - Discreto arriba a la derecha (Igual que en Modo Foco) */}
                <button
                    className="btn btn-sm text-secondary position-absolute top-0 end-0 m-2"
                    onClick={deferExercise}
                    title="Dejar Pendiente"
                    style={{ zIndex: 10, opacity: 0.6 }}
                >
                    <i className="fas fa-history fa-lg"></i>
                </button>

                <div className={contentClassName}>

                    <div className="text-center mobile-compact-mb mb-3">
                        {currentStep.groupName && (
                            <div className="mb-1">
                                <span className="badge bg-danger px-2 py-1 small">{currentStep.groupName}</span>
                            </div>
                        )}
                        <span className="text-secondary text-uppercase small tracking-widest d-block mb-1" style={{ fontSize: '0.7rem' }}>{bodyPart}</span>

                        <div className="d-flex flex-column align-items-center justify-content-center gap-1">
                            <h2 className="fw-bold text-white m-0 heading-wrap" style={name.length > 20 ? { fontSize: '1.2rem' } : {}}>{name}</h2>
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
                                {showHeartRateButton && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger rounded-pill px-3 py-0"
                                        style={{ fontSize: '0.75rem' }}
                                        onClick={() => setShowHeartRate(true)}
                                        title="Zonas de frecuencia cardiaca"
                                    >
                                        <i className="fas fa-heartbeat me-1"></i> FC
                                    </button>
                                )}
                                <CountdownTimer />
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
                        <div className="mt-1 text-info fs-6 d-inline-flex align-items-center gap-2">
                            <span>
                                Serie <span className="text-white fw-bold">{currentStep.setNumber}</span> / <span className="text-secondary">{currentStep.totalSets}</span>
                            </span>
                            {exerciseNoteButton}
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
                    {exerciseNoteModal}
                    {heartRateModal}
                </div>
            </div>
        );
    };
})();
