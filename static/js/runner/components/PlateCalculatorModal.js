(function () {
    const { useState, useEffect } = React;

    window.Runner.components.PlateCalculatorModal = ({ isOpen, onClose, onApply, unit }) => {
        const [plateCounts, setPlateCounts] = useState({
            2.5: 0, 5: 0, 10: 0, 25: 0, 35: 0, 45: 0
        });
        const [plateCountMode, setPlateCountMode] = useState('per_side');
        const [includeBar, setIncludeBar] = useState(false);
        const [barWeight, setBarWeight] = useState(20);

        const plateOptions = [
            { value: 2.5, label: "2.5", src: "/static/images/disc/2_5.png" },
            { value: 5, label: "5", src: "/static/images/disc/5.png" },
            { value: 10, label: "10", src: "/static/images/disc/10.png" },
            { value: 25, label: "25", src: "/static/images/disc/25.png" },
            { value: 35, label: "35", src: "/static/images/disc/35.png" },
            { value: 45, label: "45", src: "/static/images/disc/45.png" }
        ];

        // Reset when opening
        useEffect(() => {
            if (isOpen) {
                setPlateCounts({ 2.5: 0, 5: 0, 10: 0, 25: 0, 35: 0, 45: 0 });
                setIncludeBar(false);
            }
        }, [isOpen]);

        const formatWeight = (val) => {
            const rounded = Math.round(val * 10) / 10;
            return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
        };

        const updatePlateCount = (value, delta) => {
            setPlateCounts(prev => {
                const next = { ...prev };
                const nextVal = Math.max(0, (next[value] || 0) + delta);
                next[value] = nextVal;
                return next;
            });
        };

        const plateMultiplier = plateCountMode === 'per_side' ? 2 : 1;
        const totalPlatesLb = plateOptions.reduce((acc, plate) => {
            const count = plateCounts[plate.value] || 0;
            return acc + (count * plate.value * plateMultiplier);
        }, 0);
        const totalWithBarLb = totalPlatesLb + (includeBar ? (parseFloat(barWeight) || 0) : 0);

        const handleApply = () => {
            if (unit === 'kg') {
                // Convert result (always calculated in LB here) to KG
                const valKg = totalWithBarLb / 2.20462;
                onApply(formatWeight(valKg));
            } else {
                onApply(formatWeight(totalWithBarLb));
            }
            onClose();
        };

        if (!isOpen) return null;

        return (
            <div className="plate-modal-backdrop" onClick={onClose}>
                <div className="plate-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="plate-modal-header">
                        <div className="fw-bold">Discos (lb)</div>
                        <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    <div className="plate-modal-body">
                        <div className="plate-mode-row">
                            <div className="plate-mode-label">Conteo</div>
                            <div className="btn-group btn-group-sm" role="group">
                                <button type="button" className={`btn ${plateCountMode === 'per_side' ? 'btn-info text-dark' : 'btn-outline-secondary'}`} onClick={() => setPlateCountMode('per_side')}>Por lado</button>
                                <button type="button" className={`btn ${plateCountMode === 'total' ? 'btn-info text-dark' : 'btn-outline-secondary'}`} onClick={() => setPlateCountMode('total')}>Total</button>
                            </div>
                        </div>
                        <div className="plate-grid">
                            {plateOptions.map(plate => (
                                <div key={plate.value} className="plate-tile">
                                    <img src={plate.src} alt={`${plate.label} lb`} />
                                    <div className="text-secondary small">{plate.label} lb</div>
                                    <div className="plate-counter">
                                        <button type="button" onClick={() => updatePlateCount(plate.value, -1)}>-</button>
                                        <div className="fw-bold text-theme" style={{ minWidth: '18px' }}>{plateCounts[plate.value] || 0}</div>
                                        <button type="button" onClick={() => updatePlateCount(plate.value, 1)}>+</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-3 d-flex align-items-center justify-content-between">
                            <div className="text-secondary small">Total discos {plateCountMode === 'per_side' ? '(por lado x2)' : '(total)'}</div>
                            <div className="plate-total">{totalPlatesLb.toFixed(1)} lb</div>
                        </div>

                        <div className="mt-3 d-flex align-items-center justify-content-between">
                            <div className="text-secondary small">Peso de barra</div>
                            <div className="d-flex align-items-center gap-2">
                                <div className="form-check form-switch m-0">
                                    <input className="form-check-input" type="checkbox" checked={includeBar} onChange={(e) => setIncludeBar(e.target.checked)} />
                                </div>
                                <input type="number" min="0" className="form-control form-control-sm border-secondary" style={{ width: '80px' }} value={barWeight} onChange={(e) => setBarWeight(e.target.value)} disabled={!includeBar} />
                                <span className="text-secondary small">lb</span>
                            </div>
                        </div>

                        <div className="mt-3 d-flex align-items-center justify-content-between">
                            <div className="text-secondary small">Total</div>
                            <div className="plate-total">{totalWithBarLb.toFixed(1)} lb</div>
                        </div>
                    </div>
                    <div className="plate-modal-footer">
                        <button className="btn btn-outline-secondary" onClick={onClose}>Cancelar</button>
                        <button className="btn btn-info text-dark fw-bold" onClick={handleApply}>Aplicar</button>
                    </div>
                </div>
            </div>
        );
    };
})();
