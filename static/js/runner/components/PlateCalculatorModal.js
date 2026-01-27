(function () {
    const { useState, useEffect } = React;

    window.Runner.components.PlateCalculatorModal = ({ isOpen, onClose, onApply, unit }) => {
        const isMetric = unit === 'kg';

        const metricPlates = [
            { value: 1.25, label: "1.25", src: "/static/images/disc/2_5.png" }, // Using existing images as proxy
            { value: 2.5, label: "2.5", src: "/static/images/disc/2_5.png" },
            { value: 5, label: "5", src: "/static/images/disc/5.png" },
            { value: 10, label: "10", src: "/static/images/disc/10.png" },
            { value: 15, label: "15", src: "/static/images/disc/25.png" },
            { value: 20, label: "20", src: "/static/images/disc/35.png" },
            { value: 25, label: "25", src: "/static/images/disc/45.png" }
        ];

        const imperialPlates = [
            { value: 2.5, label: "2.5", src: "/static/images/disc/2_5.png" },
            { value: 5, label: "5", src: "/static/images/disc/5.png" },
            { value: 10, label: "10", src: "/static/images/disc/10.png" },
            { value: 25, label: "25", src: "/static/images/disc/25.png" },
            { value: 35, label: "35", src: "/static/images/disc/35.png" },
            { value: 45, label: "45", src: "/static/images/disc/45.png" }
        ];

        const plateOptions = isMetric ? metricPlates : imperialPlates;

        const [plateCounts, setPlateCounts] = useState({});
        const [plateCountMode, setPlateCountMode] = useState('per_side');
        const [includeBar, setIncludeBar] = useState(false);
        const [barWeight, setBarWeight] = useState(isMetric ? 20 : 45);

        // Reset when opening or unit changes
        useEffect(() => {
            if (isOpen) {
                const initialCounts = {};
                plateOptions.forEach(p => initialCounts[p.value] = 0);
                setPlateCounts(initialCounts);
                setIncludeBar(false);
                setBarWeight(isMetric ? 20 : 45);
            }
        }, [isOpen, unit]);

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
        const totalPlates = plateOptions.reduce((acc, plate) => {
            const count = plateCounts[plate.value] || 0;
            return acc + (count * plate.value * plateMultiplier);
        }, 0);
        const totalWithBar = totalPlates + (includeBar ? (parseFloat(barWeight) || 0) : 0);

        const handleApply = () => {
            onApply(formatWeight(totalWithBar));
            onClose();
        };

        if (!isOpen) return null;

        return ReactDOM.createPortal(
            <div className="plate-modal-backdrop" onClick={onClose}>
                <div className="plate-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="plate-modal-header text-white">
                        <div className="fw-bold">Calculadora de Discos ({unit})</div>
                        <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    <div className="plate-modal-body">
                        <div className="plate-mode-row">
                            <div className="plate-mode-label text-muted small uppercase">Modo de Conteo</div>
                            <div className="btn-group btn-group-sm" role="group">
                                <button type="button" className={`btn ${plateCountMode === 'per_side' ? 'btn-info text-dark' : 'btn-outline-secondary'}`} onClick={() => setPlateCountMode('per_side')}>Por lado</button>
                                <button type="button" className={`btn ${plateCountMode === 'total' ? 'btn-info text-dark' : 'btn-outline-secondary'}`} onClick={() => setPlateCountMode('total')}>Total</button>
                            </div>
                        </div>
                        <div className="plate-grid">
                            {plateOptions.map(plate => (
                                <div key={plate.value} className="plate-tile">
                                    <img src={plate.src} alt={`${plate.label} ${unit}`} style={{ opacity: plateCounts[plate.value] > 0 ? 1 : 0.4 }} />
                                    <div className="text-secondary small">{plate.label} {unit}</div>
                                    <div className="plate-counter">
                                        <button type="button" onClick={() => updatePlateCount(plate.value, -1)} className="btn-min">-</button>
                                        <div className="fw-bold text-white px-2" style={{ minWidth: '24px' }}>{plateCounts[plate.value] || 0}</div>
                                        <button type="button" onClick={() => updatePlateCount(plate.value, 1)} className="btn-plus">+</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="plate-calc-details bg-dark-glass p-3 rounded-4 mt-3">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <div className="text-secondary small">Suma de discos</div>
                                <div className="plate-total fw-bold text-white">{totalPlates.toFixed(1)} {unit}</div>
                            </div>

                            <div className="d-flex align-items-center justify-content-between mb-2">
                                <div className="text-secondary small">Peso de barra</div>
                                <div className="d-flex align-items-center gap-2">
                                    <div className="form-check form-switch m-0">
                                        <input className="form-check-input" type="checkbox" checked={includeBar} onChange={(e) => setIncludeBar(e.target.checked)} />
                                    </div>
                                    <input type="number" min="0" className="form-control form-control-sm bg-dark border-secondary text-white text-center" style={{ width: '70px' }} value={barWeight} onChange={(e) => setBarWeight(e.target.value)} disabled={!includeBar} />
                                    <span className="text-secondary small">{unit}</span>
                                </div>
                            </div>

                            <hr className="border-secondary opacity-25 my-2" />

                            <div className="d-flex align-items-center justify-content-between">
                                <div className="text-cyber-primary small fw-bold">PESO TOTAL</div>
                                <div className="plate-total-final fw-bold text-cyber-primary" style={{ fontSize: '1.4rem' }}>{totalWithBar.toFixed(1)} {unit}</div>
                            </div>
                        </div>
                    </div>
                    <div className="plate-modal-footer">
                        <button className="btn btn-outline-secondary border-0" onClick={onClose}>Cancelar</button>
                        <button className="btn btn-info text-dark fw-bold px-4 rounded-pill" onClick={handleApply}>Aplicar al entrenamiento</button>
                    </div>
                </div>
            </div>,
            document.body
        );
    };
})();
