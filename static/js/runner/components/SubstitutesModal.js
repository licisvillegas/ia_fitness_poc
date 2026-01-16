(function () {
    const { useState, useEffect } = React;
    const { useWorkout } = window.Runner.hooks;
    const { translateBodyPart } = window.Runner.constants;
    const { getEquipmentMeta, openVideoModal, resolveSubstitutes, getExerciseWithLookup } = window.Runner.logic;

    window.Runner.components.SubstitutesModal = () => {
        const { substituteModal, closeSubstituteModal, applySubstitute, exerciseLookup, queue } = useWorkout();
        const [scope, setScope] = useState("remaining");

        useEffect(() => {
            if (substituteModal.isOpen) setScope("remaining");
        }, [substituteModal.isOpen]);

        if (!substituteModal.isOpen) return null;
        const step = queue[substituteModal.stepIndex];
        if (!step || step.type !== 'work') return null;

        const ex = getExerciseWithLookup(step.exercise || {}, exerciseLookup);
        const substitutes = resolveSubstitutes(
            ex.substitutes || ex.equivalents || ex.equivalent_exercises || [],
            exerciseLookup
        );

        return (
            <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-black-trans animate-slide-up" style={{ zIndex: 2800 }}>
                <div className="card bg-black border border-secondary shadow-lg p-3" style={{ maxWidth: '95%', width: '420px', borderRadius: '16px' }}>
                    <div className="card-body text-white">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <h5 className="fw-bold text-cyber-green m-0">Sustitutos</h5>
                            <button className="btn btn-sm btn-outline-secondary" onClick={closeSubstituteModal}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="text-secondary small mb-3">Quick swap: elige un sustituto y aplica el cambio.</div>

                        <div className="mb-3">
                            <div className="text-uppercase text-secondary small mb-2">Aplicar a</div>
                            <div className="d-flex gap-3 flex-wrap">
                                <label className="form-check d-flex align-items-center gap-2">
                                    <input
                                        className="form-check-input"
                                        type="radio"
                                        name="swapScope"
                                        checked={scope === "current"}
                                        onChange={() => setScope("current")}
                                    />
                                    <span className="form-check-label">Solo esta serie</span>
                                </label>
                                <label className="form-check d-flex align-items-center gap-2">
                                    <input
                                        className="form-check-input"
                                        type="radio"
                                        name="swapScope"
                                        checked={scope === "remaining"}
                                        onChange={() => setScope("remaining")}
                                    />
                                    <span className="form-check-label">Series restantes</span>
                                </label>
                            </div>
                        </div>

                        {substitutes.length === 0 && (
                            <div className="text-secondary small">No hay sustitutos disponibles.</div>
                        )}

                        <div className="d-flex flex-column gap-2">
                            {substitutes.map((sub, idx) => {
                                const name = sub.exercise_name || sub.name || "Ejercicio";
                                const bodyPartLabel = translateBodyPart(sub.body_part);
                                const equipmentMeta = getEquipmentMeta(sub.equipment);
                                const hasVideo = sub.video_url && sub.video_url.trim() !== "";
                                return (
                                    <div key={`${sub._id || sub.id || idx}`} className="border border-secondary rounded p-2 bg-black-trans">
                                        <div className="d-flex justify-content-between align-items-start gap-2">
                                            <div>
                                                <div className="fw-bold text-white">{name}</div>
                                                <div className="text-secondary small d-flex flex-wrap gap-2 mt-1">
                                                    <span className="badge bg-secondary">{bodyPartLabel}</span>
                                                    <span className="badge bg-dark border border-secondary text-info">
                                                        <i className={`${equipmentMeta.icon} me-1`}></i>{equipmentMeta.label}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="d-flex flex-column gap-2">
                                                {hasVideo && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => openVideoModal(sub.video_url)}
                                                    >
                                                        <i className="fab fa-youtube"></i>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-success"
                                                    onClick={() => applySubstitute(sub, scope, substituteModal.stepIndex)}
                                                >
                                                    Usar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    };
})();
