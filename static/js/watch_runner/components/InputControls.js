(function () {
    const { useState, useEffect, useRef, useMemo } = React;
    const { useWorkout } = window.Runner.hooks;

    window.Runner.components.InputControls = ({ step, compact = false, hideRPE = false, focusMode = false }) => {
        const { PlateCalculatorModal, RPEHelpModal } = window.Runner.components;
        const { logSet, next, sessionLog, sessionLogRef, historyMaxByExercise, unit, setUnit, updateCurrentInput, openRmModal } = useWorkout();

        const [weight, setWeight] = useState(step.target.weight || '');
        const [weightBaseKg, setWeightBaseKg] = useState(() => {
            const initialVal = parseFloat(step.target.weight);
            return Number.isFinite(initialVal) ? initialVal : null;
        });
        const [reps, setReps] = useState(step.target.reps || '');
        const [rpe, setRpe] = useState(8);
        const [plateModalOpen, setPlateModalOpen] = useState(false);
        const [rpeHelpOpen, setRpeHelpOpen] = useState(false);
        const [showTapHint, setShowTapHint] = useState(false);
        const [isCompleting, setIsCompleting] = useState(false);

        const weightInputRef = useRef(null);
        const repsInputRef = useRef(null);
        const rpe8Ref = useRef(null);
        const completeBtnRef = useRef(null);
        const KG_TO_LB = 2.20462;
        const parseNumber = (value) => {
            if (value == null) return null;
            const normalized = String(value).replace(',', '.');
            const num = parseFloat(normalized);
            return Number.isFinite(num) ? num : null;
        };
        const formatDisplay = (value) => {
            const rounded = Math.round(value * 2) / 2;
            return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
        };
        const getDisplayFromKg = (kgValue, targetUnit) => {
            if (kgValue == null) return '';
            const displayVal = targetUnit === 'kg' ? kgValue : kgValue * KG_TO_LB;
            return formatDisplay(displayVal);
        };
        const getKgFromDisplay = (displayValue, sourceUnit) => {
            const num = parseNumber(displayValue);
            if (num == null) return null;
            return sourceUnit === 'kg' ? num : num / KG_TO_LB;
        };

        // ... (focusWeightInput y useEffects permanecen sin cambios)

        const focusWeightInput = (selectAll = true) => {
            if (!weightInputRef.current) return false;
            weightInputRef.current.focus();
            if (selectAll) weightInputRef.current.select();
            return true;
        };

        useEffect(() => {
            const exerciseId = step.exercise?.exercise_id || step.exercise?._id || step.exercise?.id;
            // ... (resto de la lógica de useEffect)
            let nextWeight = step.target.weight || '';
            let nextReps = step.target.reps || '';
            if (exerciseId || step.exercise?.name) {
                const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
                const lastMatch = [...currentLog].reverse().find(entry => {
                    const entryId = entry.exerciseId || entry.exercise_id;
                    if (exerciseId && entryId && String(entryId) === String(exerciseId)) return true;
                    if (step.exercise?.name && entry.name === step.exercise.name) return true;
                    return false;
                });

                if (lastMatch) {
                    if (lastMatch.weight != null && lastMatch.weight !== '') nextWeight = lastMatch.weight;
                    if (lastMatch.reps) nextReps = lastMatch.reps;
                }
                if (!lastMatch && step.setNumber === 1) {
                    const historyMax = historyMaxByExercise[exerciseId];
                    if (historyMax) {
                        nextWeight = String(historyMax.weight);
                        if (historyMax.reps) nextReps = String(historyMax.reps);
                    }
                }
            }
            const baseKg = parseNumber(nextWeight);
            setWeightBaseKg(baseKg);
            const displayWeight = unit === 'kg' ? nextWeight : getDisplayFromKg(baseKg, unit);
            setWeight(displayWeight);
            setReps(nextReps);
            setRpe(8);
            updateCurrentInput({
                weight: displayWeight,
                reps: nextReps,
                unit: unit,
                exerciseName: step.exercise?.exercise_name || step.exercise?.name || ""
            });

            const shouldFocusWeight = !compact && step.type === 'work' && !step.isTimeBased && !step.target?.time;
            setShowTapHint(shouldFocusWeight);
            setTimeout(() => {
                if (shouldFocusWeight && focusWeightInput(true)) {
                    setShowTapHint(false);
                    return;
                }
                if (rpe8Ref.current) {
                    rpe8Ref.current.focus();
                    return;
                }
                if (document.activeElement && typeof document.activeElement.blur === "function") {
                    document.activeElement.blur();
                }
            }, 100);
            if (shouldFocusWeight) {
                setTimeout(() => {
                    if (focusWeightInput(true)) {
                        setShowTapHint(false);
                    }
                }, 350);
            }
        }, [step, sessionLog, historyMaxByExercise]);

        useEffect(() => {
            const displayWeight = getDisplayFromKg(weightBaseKg, unit);
            setWeight(displayWeight);
            updateCurrentInput({
                weight: displayWeight,
                unit: unit,
                exerciseName: step.exercise?.exercise_name || step.exercise?.name || ""
            });
        }, [unit, weightBaseKg]);

        useEffect(() => {
            setIsCompleting(false);
            if (completeBtnRef.current) {
                completeBtnRef.current.blur();
            }
        }, [step?.id]);

        const adjustReps = (delta) => {
            const current = parseInt(reps, 10);
            const base = Number.isFinite(current) ? current : 0;
            const nextValue = Math.max(0, base + delta);
            if (nextValue >= 1000) return;
            setReps(String(nextValue));
        };

        const handleSubmit = () => {
            if (isCompleting) return;
            setIsCompleting(true);

            // Activar Animación Flex
            if (window.WorkoutAnimations && typeof window.WorkoutAnimations.flexEffect === 'function') {
                window.WorkoutAnimations.flexEffect();
            }

            logSet({ weight, reps, rpe });
            next();
        };

        const toggleUnit = () => {
            const nextUnit = unit === 'kg' ? 'lb' : 'kg';
            const nextWeight = getDisplayFromKg(weightBaseKg, nextUnit);
            setWeight(nextWeight);
            setUnit(nextUnit);
            updateCurrentInput({
                weight: nextWeight,
                unit: nextUnit,
                exerciseName: step.exercise?.exercise_name || step.exercise?.name || ""
            });
        };

        const adjustWeight = (delta) => {
            const currentVal = parseNumber(weight) || 0;
            const newVal = Math.max(0, currentVal + delta);
            if (newVal >= 1000) return;
            const displayWeight = formatDisplay(newVal);
            setWeight(displayWeight);
            const baseKg = unit === 'kg' ? newVal : newVal / KG_TO_LB;
            setWeightBaseKg(baseKg);
            updateCurrentInput({
                weight: displayWeight,
                unit: unit,
                exerciseName: step.exercise?.exercise_name || step.exercise?.name || ""
            });
        };

        const equivalentText = useMemo(() => {
            if (weightBaseKg == null || weightBaseKg === 0) return "";
            let converted;
            let targetUnit;
            if (unit === 'kg') {
                converted = weightBaseKg * KG_TO_LB;
                targetUnit = 'lb';
            } else {
                converted = weightBaseKg;
                targetUnit = 'kg';
            }
            const displayVal = formatDisplay(converted);
            return `~= ${displayVal} ${targetUnit}`;
        }, [weightBaseKg, unit]);

        return (
            <div className="py-1">
                {/* Icono de Calculadora de Discos - Solo Modo Foco */}
                {focusMode && (
                    <div className="position-absolute top-0 start-0 m-2 d-flex align-items-center gap-2" style={{ zIndex: 10 }}>
                        <button
                            type="button"
                            className="plate-icon-btn plate-icon-btn--floating"
                            title="Calculadora de discos"
                            onClick={() => setPlateModalOpen(true)}
                        >
                            <img src="/static/images/disc/45.png" alt="Plate Calc" className="plate-icon-img" />
                        </button>
                        <button
                            type="button"
                            className="rm-icon-btn rm-icon-btn-focus"
                            title="Calculadora 1RM"
                            onClick={openRmModal}
                        >
                            <i className="fas fa-calculator"></i>
                        </button>
                    </div>
                )}

                <div className="row g-2 justify-content-center mb-2">
                    {!compact && (
                        <div className="col-6">
                            <div className="weight-header">
                                <div className="d-flex align-items-center justify-content-center gap-1">
                                    <label className="text-secondary small fw-bold m-0" style={{ fontSize: '0.7rem' }}>PESO</label>
                                    <button className="btn btn-sm btn-dark border border-secondary py-0 px-1 small font-monospace" onClick={toggleUnit} style={{ fontSize: '0.65rem' }}>
                                        {unit.toUpperCase()}
                                    </button>
                                </div>
                            </div>
                            {!hideRPE && (
                                <div className="input-icon-slot">
                                    <button
                                        type="button"
                                        className="plate-icon-btn"
                                        title="Calculadora de discos"
                                        onClick={() => setPlateModalOpen(true)}
                                    >
                                        <img src="/static/images/disc/45.png" alt="Disco" className="plate-icon-img" />
                                    </button>
                                </div>
                            )}
                            <div className="d-flex align-items-center justify-content-center gap-1">
                                <button
                                    className="btn btn-outline-secondary btn-control-hud d-flex align-items-center justify-content-center"
                                    type="button"
                                    onClick={() => adjustWeight(unit === 'lb' ? -5 : -2.5)}
                                >-</button>
                                <div className="position-relative">
                                    <input
                                        key={`weight_${step.id}`}
                                        type="text"
                                        inputMode="decimal"
                                        pattern="[0-9]*[.,]?[0-9]*"
                                        ref={weightInputRef}
                                        className="form-control input-hud text-center p-0"
                                        value={weight}
                                        onChange={e => {
                                            const nextVal = e.target.value;
                                            setWeight(nextVal);
                                            setWeightBaseKg(getKgFromDisplay(nextVal, unit));
                                            updateCurrentInput({
                                                weight: nextVal,
                                                unit: unit,
                                                exerciseName: step.exercise?.exercise_name || step.exercise?.name || ""
                                            });
                                        }}
                                        placeholder="0"
                                        onClick={(e) => e.target.select()}
                                        onFocus={() => setShowTapHint(false)}
                                        autoFocus={!compact && step.type === 'work' && !step.isTimeBased && !step.target?.time}
                                    />
                                    {showTapHint && (
                                        <button
                                            type="button"
                                            className="tap-hint-overlay"
                                            onClick={() => {
                                                if (weightInputRef.current) {
                                                    weightInputRef.current.focus();
                                                    weightInputRef.current.select();
                                                    setShowTapHint(false);
                                                }
                                            }}
                                        >
                                            Tocar para editar
                                        </button>
                                    )}
                                </div>
                                <button
                                    className="btn btn-outline-secondary btn-control-hud d-flex align-items-center justify-content-center"
                                    type="button"
                                    onClick={() => adjustWeight(unit === 'lb' ? 5 : 2.5)}
                                >+</button>
                            </div>
                            <div className="text-center text-muted small mt-1" style={{ fontSize: '0.7rem' }}>
                                {equivalentText}
                            </div>
                        </div>
                    )}
                    <div className={compact ? "col-12" : "col-6 reps-column"}>
                        <div className="reps-header">
                            <label className="text-secondary small fw-bold m-0" style={{ fontSize: '0.7rem' }}>
                                REPS {step.target.reps && <span className="text-cyber-green ms-1">({step.target.reps})</span>}
                            </label>
                        </div>
                        {!compact && !focusMode && (
                            <div className="input-icon-slot">
                                <button
                                    type="button"
                                    className="rm-icon-btn rm-icon-btn-vertical"
                                    title="Calculadora 1RM"
                                    onClick={openRmModal}
                                >
                                    <i className="fas fa-calculator"></i>
                                </button>
                            </div>
                        )}
                        <div className="d-flex align-items-center justify-content-center gap-1">
                            <button
                                className="btn btn-outline-secondary btn-control-hud d-flex align-items-center justify-content-center"
                                type="button"
                                onClick={() => adjustReps(-1)}
                            >-</button>
                            <input
                                type="text"
                                ref={repsInputRef}
                                className="form-control input-hud text-center p-0"
                                value={reps}
                                onChange={e => {
                                    const nextVal = e.target.value;
                                    setReps(nextVal);
                                    updateCurrentInput({
                                        reps: nextVal,
                                        unit: unit,
                                        exerciseName: step.exercise?.exercise_name || step.exercise?.name || ""
                                    });
                                }}
                                placeholder="0"
                                inputMode="numeric"
                                onClick={(e) => e.target.select()}
                            />
                            <button
                                className="btn btn-outline-secondary btn-control-hud d-flex align-items-center justify-content-center"
                                type="button"
                                onClick={() => adjustReps(1)}
                            >+</button>
                        </div>
                    </div>
                </div>

                {!compact && !hideRPE && (
                    <div className="mb-3">
                        <div className="d-flex align-items-center justify-content-center gap-2 mb-1">
                            <label className="text-secondary small fw-bold m-0" style={{ fontSize: '0.7rem' }}>RPE (1-10)</label>
                            <button className="btn btn-sm text-secondary p-0" title="Guia de Intensidad" onClick={() => setRpeHelpOpen(true)}>
                                <i className="fas fa-question-circle" style={{ fontSize: '0.8rem' }}></i>
                            </button>
                        </div>
                        <div className="d-flex justify-content-center gap-1">
                            {[7, 8, 9, 10].map(val => (
                                <button key={val}
                                    type="button"
                                    ref={val === 8 ? rpe8Ref : null}
                                    className={`btn btn-sm btn-rpe-hud d-flex align-items-center justify-content-center ${rpe === val ? 'btn-light' : 'btn-outline-secondary'}`}
                                    onClick={() => setRpe(val)}
                                >{val}</button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="d-grid px-3">
                    <button
                        ref={completeBtnRef}
                        className={`btn btn-action shadow-lg ripple py-3 ${isCompleting ? 'processing' : ''}`}
                        onClick={handleSubmit}
                        disabled={isCompleting}
                    >
                        {useWorkout().queue.slice(useWorkout().cursor + 1).some(s => s.type === 'work')
                            ? "COMPLETAR"
                            : "FINALIZAR"} <i className={`fas ${useWorkout().queue.slice(useWorkout().cursor + 1).some(s => s.type === 'work') ? 'fa-check' : 'fa-flag-checkered'} ms-2`}></i>
                    </button>
                </div>

                <PlateCalculatorModal
                    isOpen={plateModalOpen}
                    onClose={() => setPlateModalOpen(false)}
                    onApply={(newWeight) => {
                        setWeight(newWeight);
                        setWeightBaseKg(getKgFromDisplay(newWeight, unit));
                        updateCurrentInput({
                            weight: newWeight,
                            unit: unit,
                            exerciseName: step.exercise?.exercise_name || step.exercise?.name || ""
                        });
                    }}
                    unit={unit}
                />

                <RPEHelpModal
                    isOpen={rpeHelpOpen}
                    onClose={() => setRpeHelpOpen(false)}
                />
            </div>
        );
    };
})();
