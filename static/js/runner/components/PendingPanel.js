(function () {
    const { useState } = React;
    const { useWorkout } = window.Runner.hooks;

    window.Runner.components.PendingPanel = ({ isOpen, onClose }) => {
        const { PlateCalculatorModal } = window.Runner.components;
        const { queue, cursor, status, logSpecificStep, updateLoggedStep, removeLoggedStep, isStepLogged, sessionLog, unit, showConfirm, historyMaxByExercise } = useWorkout();
        const [activeTab, setActiveTab] = useState('pending');
        const [expandedStepId, setExpandedStepId] = useState(null);
        const [expandedCompletedId, setExpandedCompletedId] = useState(null);

        const [weight, setWeight] = useState('0');
        const [reps, setReps] = useState('0');
        const [completedWeight, setCompletedWeight] = useState('0');
        const [completedReps, setCompletedReps] = useState('0');

        const [calcState, setCalcState] = useState({ isOpen: false, isCompletedMode: false });

        const openCalculator = (isCompletedMode) => {
            setCalcState({ isOpen: true, isCompletedMode });
        };

        const handleCalcApply = (val) => {
            if (calcState.isCompletedMode) {
                setCompletedWeight(val);
            } else {
                setWeight(val);
            }
        };

        if (status === 'LOADING' || status === 'IDLE' || status === 'FINISHED') return null;

        const roundToHalf = (val) => Math.round((parseFloat(val) || 0) * 2) / 2;

        const allWorkSteps = queue.filter(step => step.type === 'work');
        const pendingSteps = allWorkSteps.filter(step => !isStepLogged(step.id));
        const completedSteps = allWorkSteps.filter(step => isStepLogged(step.id));

        const handleQuickLog = (step) => {
            const finalWeight = roundToHalf(weight);
            const finalReps = roundToHalf(reps);

            showConfirm(
                "Confirmar registro",
                `¿Registrar ${finalWeight} ${unit} x ${finalReps} reps?`,
                () => {
                    logSpecificStep(step, {
                        weight: finalWeight,
                        reps: finalReps,
                        unit: unit
                    });
                    setExpandedStepId(null);
                },
                "success"
            );
        };

        const toggleExpand = (step) => {
            if (isStepLogged(step.id)) return;
            if (expandedStepId === step.id) {
                setExpandedStepId(null);
            } else {
                setExpandedStepId(step.id);
                let nextW = step.target?.weight || '0';
                let nextR = step.target?.reps || '0';

                const exId = step.exercise?.exercise_id || step.exercise?._id || step.exercise?.id;
                const lastMatch = [...sessionLog].reverse().find(l => {
                    const lId = l.exerciseId || l.exercise_id;
                    return exId && lId && String(lId) === String(exId);
                });

                if (lastMatch) {
                    if (lastMatch.weight != null) nextW = lastMatch.weight;
                    if (lastMatch.reps != null) nextR = lastMatch.reps;
                } else {
                    if (exId && historyMaxByExercise[exId]) {
                        nextW = String(historyMaxByExercise[exId].weight);
                        if (historyMaxByExercise[exId].reps) nextR = String(historyMaxByExercise[exId].reps);
                    }
                }

                if (unit === 'lb' && nextW) {
                    const valKg = parseFloat(nextW);
                    if (!isNaN(valKg)) {
                        const valLb = valKg * 2.20462;
                        const result = Math.round(valLb * 2) / 2;
                        nextW = result % 1 === 0 ? result.toString() : result.toFixed(1);
                    }
                }

                setWeight(nextW);
                setReps(nextR);
            }
        };

        const formatWeight = (kg) => {
            let val = parseFloat(kg);
            if (unit === 'lb') {
                val = val * 2.20462;
            }
            val = Math.round(val * 2) / 2;
            return val % 1 === 0 ? val.toString() : val.toFixed(1);
        };

        const toggleCompletedExpand = (step) => {
            const logEntry = sessionLog.find(l => l.stepId === step.id);
            if (!logEntry) return;
            if (expandedCompletedId === step.id) {
                setExpandedCompletedId(null);
                return;
            }
            setExpandedCompletedId(step.id);
            setCompletedWeight(formatWeight(logEntry.weight || 0));
            setCompletedReps(logEntry.reps != null ? String(logEntry.reps) : '0');
        };

        const handleUpdateCompleted = (step) => {
            const finalWeight = roundToHalf(completedWeight);
            const finalReps = roundToHalf(completedReps);

            showConfirm(
                "Confirmar actualización",
                `¿Actualizar a ${finalWeight} ${unit} x ${finalReps} reps?`,
                () => {
                    updateLoggedStep(step.id, {
                        weight: finalWeight,
                        reps: finalReps,
                        unit: unit
                    });
                    setExpandedCompletedId(null);
                },
                "warning"
            );
        };

        const handleReleaseStep = (step) => {
            showConfirm(
                "Liberar serie",
                "¿Devolver esta serie a pendientes? Se borrará el registro actual.",
                () => {
                    removeLoggedStep(step.id);
                    setExpandedCompletedId(null);
                },
                "warning"
            );
        };

        return (
            <>
                <div className={`pending-backdrop ${isOpen ? 'show' : ''}`} onClick={onClose}></div>
                <div className={`pending-panel ${isOpen ? 'open' : ''}`}>
                    <div className="pending-panel-header px-3 pt-3 pb-0 border-bottom-0">
                        <div className="d-flex justify-content-between align-items-center w-100">
                            <div className="fw-bold text-white">Seguimiento</div>
                            <button className="btn btn-sm btn-outline-secondary rounded-circle" onClick={onClose}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                    </div>

                    <div className="pending-tabs">
                        <div
                            id="tab-pending"
                            className={`pending-tab ${activeTab === 'pending' ? 'active' : ''}`}
                            onClick={() => setActiveTab('pending')}
                        >
                            Pendientes ({pendingSteps.length})
                        </div>
                        <div
                            id="tab-completed"
                            className={`pending-tab ${activeTab === 'completed' ? 'active' : ''}`}
                            onClick={() => setActiveTab('completed')}
                        >
                            Completados ({completedSteps.length})
                        </div>
                    </div>

                    <div className="pending-panel-body p-3">
                        {activeTab === 'pending' ? (
                            <>
                                {pendingSteps.length === 0 && (
                                    <div className="text-secondary small text-center py-4">No hay ejercicios pendientes.</div>
                                )}
                                {pendingSteps.map((step, idx) => {
                                    const ex = step.exercise || {};
                                    const name = ex.exercise_name || ex.name || 'Ejercicio';
                                    const targetVal = step.isTimeBased
                                        ? `${Math.round((step.target?.time || 0))}s`
                                        : (step.target?.reps || '-');
                                    const isExpanded = expandedStepId === step.id;

                                    return (
                                        <div key={`${step.id}_${idx}`}
                                            className="border border-secondary rounded p-2 mb-2 bg-black-trans"
                                            style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                                            onClick={() => toggleExpand(step)}
                                        >
                                            <div className="d-flex justify-content-between align-items-start">
                                                <div>
                                                    <div className="text-white fw-bold">{name}</div>
                                                    {step.groupName && (
                                                        <div className="text-cyber-orange small">{step.groupName}</div>
                                                    )}
                                                </div>
                                                <div className="text-secondary small text-end">
                                                    <div>Serie {step.setNumber}/{step.totalSets}</div>
                                                    <div>{step.isTimeBased ? `Tiempo ${targetVal}` : `Reps ${targetVal}`}</div>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="mt-3 p-2 bg-dark rounded border border-info animate-entry" onClick={e => e.stopPropagation()}>
                                                    <div className="row g-2 mb-2">
                                                        <div className="col-6">
                                                            <label className="text-muted small d-block mb-1 text-uppercase" style={{ fontSize: '0.6rem' }}>Peso ({unit})</label>
                                                            <div className="input-group input-group-sm">
                                                                <button
                                                                    className="btn btn-outline-secondary px-2"
                                                                    type="button"
                                                                    onClick={() => openCalculator(false)}
                                                                    title="Calculadora de discos"
                                                                >
                                                                    <img src="/static/images/disc/45.png" style={{ width: '18px', height: '18px' }} />
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    className="form-control bg-black border-secondary text-white text-center fw-bold"
                                                                    value={weight}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        if (val === '' || /^\d{0,3}(\.\d{0,2})?$/.test(val)) {
                                                                            setWeight(val);
                                                                        }
                                                                    }}
                                                                    onFocus={e => e.target.select()}
                                                                    inputMode="decimal"
                                                                    pattern="[0-9]*[.,]?[0-9]*"
                                                                    autoFocus
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="col-6">
                                                            <label className="text-muted small d-block mb-1 text-uppercase" style={{ fontSize: '0.6rem' }}>Reps</label>
                                                            <div className="input-group input-group-sm">
                                                                <input
                                                                    type="number"
                                                                    className="form-control bg-black border-secondary text-white text-center fw-bold"
                                                                    value={reps}
                                                                    onChange={e => setReps(e.target.value)}
                                                                    onFocus={e => e.target.select()}
                                                                    inputMode="decimal"
                                                                    pattern="[0-9]*[.,]?[0-9]*"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="btn btn-info btn-sm w-100 fw-bold py-2 shadow-sm"
                                                        onClick={() => handleQuickLog(step)}
                                                    >
                                                        REGISTRAR SERIE
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </>
                        ) : (
                            <>
                                {completedSteps.length === 0 && (
                                    <div className="text-secondary small text-center py-4">Aún no has completado ejercicios.</div>
                                )}
                                {completedSteps.map((step, idx) => {
                                    const logEntry = sessionLog.find(l => l.stepId === step.id);
                                    const ex = step.exercise || {};
                                    const name = ex.exercise_name || ex.name || 'Ejercicio';
                                    const isExpanded = expandedCompletedId === step.id;

                                    return (
                                        <div key={`${step.id}_${idx}`}
                                            className="border border-success rounded p-2 mb-2 bg-black-trans opacity-75"
                                            style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                                            onClick={() => toggleCompletedExpand(step)}
                                        >
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div>
                                                    <div className="text-white fw-bold d-flex align-items-center gap-2">
                                                        {name}
                                                        <i className="fas fa-check-circle text-success small"></i>
                                                    </div>
                                                    <div className="text-secondary small">Serie {step.setNumber}/{step.totalSets}</div>
                                                </div>
                                                <div className="text-end">
                                                    <div className="text-success fw-bold" style={{ fontSize: '0.9rem' }}>
                                                        {logEntry ? `${formatWeight(logEntry.weight)}${unit} x ${logEntry.reps}` : '--'}
                                                    </div>
                                                    {logEntry?.rpe && <div className="text-muted small">RPE {logEntry.rpe}</div>}
                                                </div>
                                            </div>

                                            {isExpanded && logEntry && (
                                                <div className="mt-3 p-2 bg-dark rounded border border-success animate-entry" onClick={e => e.stopPropagation()}>
                                                    <div className="row g-2 mb-2">
                                                        <div className="col-6">
                                                            <label className="text-muted small d-block mb-1 text-uppercase" style={{ fontSize: '0.6rem' }}>Peso ({unit})</label>
                                                            <div className="input-group input-group-sm">
                                                                <button
                                                                    className="btn btn-outline-secondary px-2"
                                                                    type="button"
                                                                    onClick={() => openCalculator(true)}
                                                                    title="Calculadora de discos"
                                                                >
                                                                    <img src="/static/images/disc/45.png" style={{ width: '18px', height: '18px' }} />
                                                                </button>
                                                                <input
                                                                    type="number"
                                                                    className="form-control bg-black border-secondary text-white text-center fw-bold"
                                                                    value={completedWeight}
                                                                    onChange={e => setCompletedWeight(e.target.value)}
                                                                    onFocus={e => e.target.select()}
                                                                    inputMode="decimal"
                                                                    pattern="[0-9]*[.,]?[0-9]*"
                                                                    autoFocus
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="col-6">
                                                            <label className="text-muted small d-block mb-1 text-uppercase" style={{ fontSize: '0.6rem' }}>Reps</label>
                                                            <div className="input-group input-group-sm">
                                                                <input
                                                                    type="number"
                                                                    className="form-control bg-black border-secondary text-white text-center fw-bold"
                                                                    value={completedReps}
                                                                    onChange={e => setCompletedReps(e.target.value)}
                                                                    onFocus={e => e.target.select()}
                                                                    inputMode="decimal"
                                                                    pattern="[0-9]*[.,]?[0-9]*"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="d-flex gap-2">
                                                        <button
                                                            className="btn btn-outline-danger btn-sm w-25"
                                                            title="Liberar serie"
                                                            onClick={(e) => { e.stopPropagation(); handleReleaseStep(step); }}
                                                        >
                                                            <i className="fas fa-trash"></i>
                                                        </button>
                                                        <button
                                                            className="btn btn-success btn-sm w-75 fw-bold py-2 shadow-sm"
                                                            onClick={() => handleUpdateCompleted(step)}
                                                        >
                                                            ACTUALIZAR
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </>
                        )}
                    </div>
                </div>
                <PlateCalculatorModal
                    isOpen={calcState.isOpen}
                    onClose={() => setCalcState({ ...calcState, isOpen: false })}
                    onApply={handleCalcApply}
                    unit={unit}
                />
            </>
        );
    };
})();
