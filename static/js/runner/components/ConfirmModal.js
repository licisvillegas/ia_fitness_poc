(function () {
    const { useWorkout } = window.Runner.hooks;

    window.Runner.components.ConfirmModal = () => {
        const { confirmModal, closeConfirm, handleConfirmAction } = useWorkout();
        if (!confirmModal.isOpen) return null;

        const { title, message, type, confirmText, cancelText } = confirmModal;
        const colorClass = type === 'danger' ? 'text-danger' : type === 'warning' ? 'text-cyber-orange' : 'text-cyber-green';
        const btnClass = type === 'danger' ? 'btn-outline-danger' : type === 'warning' ? 'btn-outline-warning' : 'btn-outline-success';

        return (
            <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-black-trans animate-slide-up" style={{ zIndex: 3000 }}>
                <div className="card bg-black border border-secondary shadow-lg p-3" style={{ maxWidth: '90%', width: '350px', borderRadius: '15px' }}>
                    <div className="card-body text-center">
                        <h4 className={`fw-bold mb-3 ${colorClass}`}>{title}</h4>
                        <p className="text-white mb-4 fs-5">{message}</p>
                        <div className="d-flex gap-3 justify-content-center">
                            <button className="btn btn-secondary flex-grow-1" onClick={closeConfirm}>{cancelText || "Cancelar"}</button>
                            <button className={`btn ${btnClass} flex-grow-1 fw-bold`} onClick={handleConfirmAction}>{confirmText || "Confirmar"}</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };
})();
