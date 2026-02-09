(function () {
    const { useEffect, useMemo, useState } = React;
    const { useWorkout } = window.Runner.hooks;

    const formulas = {
        brzycki: (w, r) => w * (36 / (37 - r)),
        epley: (w, r) => w * (1 + 0.0333 * r),
        lander: (w, r) => (100 * w) / (101.3 - 2.67123 * r),
        lombardi: (w, r) => w * Math.pow(r, 0.10),
        mayhew: (w, r) => (100 * w) / (52.2 + (41.9 * Math.exp(-0.055 * r))),
        oconner: (w, r) => w * (1 + 0.025 * r),
        wathen: (w, r) => (100 * w) / (48.8 + (53.8 * Math.exp(-0.075 * r)))
    };

    const rmPercentages = {
        1: 1.00, 2: 0.95, 3: 0.93, 4: 0.90,
        5: 0.87, 6: 0.85, 7: 0.83, 8: 0.80,
        9: 0.77, 10: 0.75, 11: 0.70, 12: 0.67,
        13: 0.65, 14: 0.63, 15: 0.60, 16: 0.58,
        17: 0.56, 18: 0.55, 19: 0.53, 20: 0.50
    };

    const convertWeight = (value, fromUnit, toUnit) => {
        if (!value || fromUnit === toUnit) return value;
        const kgToLb = 2.20462;
        return fromUnit === "kg" ? value * kgToLb : value / kgToLb;
    };

    window.Runner.components.RMCalculatorModal = () => {
        const { showRmModal, closeRmModal, currentInput } = useWorkout();
        const [unit, setUnit] = useState(currentInput.unit || "kg");
        const [weight, setWeight] = useState(currentInput.weight || "");
        const [reps, setReps] = useState(currentInput.reps || "");
        const [showAllResults, setShowAllResults] = useState(false);
        const exerciseName = currentInput.exerciseName || "Ejercicio";

        useEffect(() => {
            if (!showRmModal) return;
            const nextUnit = currentInput.unit || "kg";
            setUnit(nextUnit);
            setWeight(currentInput.weight || "");
            setReps(currentInput.reps || "");
            setShowAllResults(false);
        }, [showRmModal, currentInput]);

        const oneRm = useMemo(() => {
            const w = parseFloat(weight) || 0;
            const r = parseFloat(reps) || 0;
            if (!w || !r) return 0;
            if (r <= 1) return w;
            const values = Object.values(formulas).map(fn => fn(w, r));
            return values.reduce((sum, val) => sum + val, 0) / values.length;
        }, [weight, reps]);

        const results = useMemo(() => {
            if (!oneRm) return [];
            const maxRm = showAllResults ? 20 : 12;
            return Object.entries(rmPercentages)
                .filter(([rep]) => Number(rep) <= maxRm)
                .map(([rep, pct]) => ({
                    rep,
                    value: Math.round(oneRm * pct)
                }));
        }, [oneRm, showAllResults]);

        const handleToggleUnit = () => {
            const nextUnit = unit === "kg" ? "lb" : "kg";
            const val = parseFloat(weight) || 0;
            if (val > 0) {
                const converted = convertWeight(val, unit, nextUnit);
                const rounded = Math.round(converted * 10) / 10;
                setWeight(rounded.toString());
            }
            setUnit(nextUnit);
        };

        if (!showRmModal) return null;

        return (
            <div className="rm-modal-backdrop" onClick={closeRmModal}>
                <div className="rm-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="rm-modal-header">
                        <div className="d-flex flex-column">
                            <div className="text-secondary small">Calculadora 1RM</div>
                            <div className="fw-bold text-white">{exerciseName}</div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <button className="btn btn-sm btn-outline-secondary rm-unit-toggle" onClick={handleToggleUnit}>
                                {unit.toUpperCase()}
                            </button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={closeRmModal}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                    <div className="rm-modal-body">
                        <div className="rm-summary">
                            <div>
                                <div className="text-secondary small fw-bold">1RM ESTIMADO</div>
                                <div className="rm-primary-value">{oneRm ? Math.round(oneRm) : "--"}</div>
                                <div className="text-muted small">{unit}</div>
                            </div>
                            <div className="text-end text-secondary small">
                                <div>Peso: <span className="text-white">{weight || "--"}</span> {unit}</div>
                                <div>Reps: <span className="text-white">{reps || "--"}</span></div>
                            </div>
                        </div>
                        <div className="rm-grid">
                            {results.map(item => {
                                const isOneRm = Number(item.rep) === 1;
                                const isSource = Number(item.rep) === Number(reps);
                                return (
                                    <div key={item.rep} className={`rm-tile ${isOneRm ? "highlight" : ""} ${isSource ? "source" : ""}`}>
                                        <div className="rm-label">{item.rep}RM</div>
                                        <div className="rm-value">{item.value}</div>
                                        <div className="rm-unit">{unit}</div>
                                    </div>
                                );
                            })}
                            {!results.length && (
                                <div className="text-secondary small">Ingresa peso y repeticiones para ver resultados.</div>
                            )}
                        </div>
                        {results.length > 0 && (
                            <div className="rm-modal-actions">
                                <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowAllResults(prev => !prev)}>
                                    {showAllResults ? "Mostrar menos" : "Mostrar mas"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };
})();
