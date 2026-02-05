(function () {
    window.Runner.components.HeartRateModal = ({ isOpen, onClose, age }) => {
        if (!isOpen) return null;

        const parsedAge = Number.parseInt(age, 10);
        const hasAge = Number.isFinite(parsedAge) && parsedAge > 0 && parsedAge < 120;

        let fcm = 0;
        let fatMin = 0;
        let fatMax = 0;
        let perfMin = 0;
        let perfMax = 0;

        if (hasAge) {
            fcm = 220 - parsedAge;
            fatMin = Math.round(fcm * 0.60);
            fatMax = Math.round(fcm * 0.70);
            perfMin = Math.round(fcm * 0.80);
            perfMax = Math.round(fcm * 0.90);
        }

        return (
            <div className="hr-modal-backdrop" onClick={onClose}>
                <div className="hr-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="hr-modal-header">
                        <div className="d-flex flex-column">
                            <div className="text-secondary small">Frecuencia cardiaca</div>
                            <div className="fw-bold text-white">Zonas de entrenamiento</div>
                        </div>
                        <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    <div className="hr-modal-body">
                        {!hasAge && (
                            <div className="text-secondary">
                                No tenemos tu fecha de nacimiento en el perfil. Completa tu fecha de nacimiento para calcular tus zonas.
                            </div>
                        )}
                        {hasAge && (
                            <>
                                <div className="hr-summary">
                                    <div>
                                        <div className="text-secondary small fw-bold">FCM (220 − edad)</div>
                                        <div className="hr-primary-value">{fcm}</div>
                                        <div className="text-muted small">Edad: {parsedAge} años</div>
                                    </div>
                                    <div className="text-end text-secondary small">
                                        <div>Oxidación de grasa: <span className="text-white">{fatMin} – {fatMax}</span> lpm</div>
                                        <div>Performance: <span className="text-white">{perfMin} – {perfMax}</span> lpm</div>
                                    </div>
                                </div>
                                <div className="hr-zone-grid">
                                    <div className="hr-zone-card">
                                        <div className="hr-zone-title">60 – 70%</div>
                                        <div className="hr-zone-label">Base aeróbica</div>
                                        <div className="hr-zone-value">{fatMin} – {fatMax} lpm</div>
                                    </div>
                                    <div className="hr-zone-card">
                                        <div className="hr-zone-title">70 – 80%</div>
                                        <div className="hr-zone-label">Cardio</div>
                                        <div className="hr-zone-value">{Math.round(fcm * 0.70)} – {Math.round(fcm * 0.80)} lpm</div>
                                    </div>
                                    <div className="hr-zone-card highlight">
                                        <div className="hr-zone-title">80 – 90%</div>
                                        <div className="hr-zone-label">Performance</div>
                                        <div className="hr-zone-value">{perfMin} – {perfMax} lpm</div>
                                    </div>
                                    <div className="hr-zone-card">
                                        <div className="hr-zone-title">90 – 100%</div>
                                        <div className="hr-zone-label">Máxima</div>
                                        <div className="hr-zone-value">{Math.round(fcm * 0.90)} – {Math.round(fcm * 1.00)} lpm</div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };
})();
