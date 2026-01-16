(function () {
    window.Runner.components.RPEHelpModal = ({ isOpen, onClose }) => {
        if (!isOpen) return null;
        return (
            <div className="plate-modal-backdrop" onClick={onClose}>
                <div className="plate-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '350px' }}>
                    <div className="plate-modal-header">
                        <div className="fw-bold text-info">Guia RPE (Intensidad)</div>
                        <button className="btn btn-sm btn-outline-secondary" onClick={onClose}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                    <div className="plate-modal-body p-3">
                        <table className="table table-dark table-sm small mb-0">
                            <thead>
                                <tr>
                                    <th>RPE</th>
                                    <th>Reserva</th>
                                    <th>Sensacion</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="text-danger fw-bold">10</td>
                                    <td>0 (Fallo)</td>
                                    <td>Maximo esfuerzo</td>
                                </tr>
                                <tr>
                                    <td className="text-warning fw-bold">9</td>
                                    <td>1 Rep</td>
                                    <td>Muy dificil</td>
                                </tr>
                                <tr>
                                    <td className="text-cyber-green fw-bold">8</td>
                                    <td>2 Reps</td>
                                    <td>Dificil pero controlable</td>
                                </tr>
                                <tr>
                                    <td className="text-white">7</td>
                                    <td>3 Reps</td>
                                    <td>Vigoroso</td>
                                </tr>
                            </tbody>
                        </table>
                        <div className="text-muted small mt-2 fst-italic">
                            * Reps en Reserva: Cuantas repeticiones mas podrias haber hecho con buena tecnica.
                        </div>
                    </div>
                </div>
            </div>
        );
    };
})();
