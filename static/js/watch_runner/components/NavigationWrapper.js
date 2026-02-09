(function () {
    const { useWorkout } = window.Runner.hooks;

    window.Runner.components.NavigationWrapper = ({ children }) => {
        const { prev, skipToNextWork, showMessage, showConfirm } = useWorkout();

        const handleSkip = () => {
            showConfirm("Saltar Serie", "¿Seguro que quieres omitir esta serie?", () => {
                showMessage("Set omitido", "info");
                skipToNextWork();
            }, "warning");
        };

        return (
            <div className="d-flex w-100 h-100 align-items-center justify-content-center position-relative">

                <div className="d-none d-md-block me-3">
                    <button className="btn btn-outline-secondary rounded-circle p-3" onClick={prev} style={{ width: '60px', height: '60px' }}>
                        <i className="fas fa-chevron-left fa-lg"></i>
                    </button>
                </div>

                <div className="flex-grow-1 d-flex flex-column align-items-center justify-content-center w-100" style={{ maxWidth: '600px' }}>
                    {children}

                    <div className="d-flex d-md-none w-100 justify-content-between px-3 mt-3">
                        <button className="btn btn-link text-secondary text-decoration-none" onClick={prev}>
                            <i className="fas fa-chevron-left me-1"></i> Anterior
                        </button>
                        <button className="btn btn-link text-secondary text-decoration-none" onClick={handleSkip}>
                            Saltar <i className="fas fa-chevron-right ms-1"></i>
                        </button>
                    </div>
                </div>

                <div className="d-none d-md-block ms-3">
                    <button className="btn btn-outline-secondary rounded-circle p-3" onClick={handleSkip} style={{ width: '60px', height: '60px' }}>
                        <i className="fas fa-chevron-right fa-lg"></i>
                    </button>
                </div>
            </div>
        );
    };
})();
