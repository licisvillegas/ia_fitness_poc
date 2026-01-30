(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.PauseOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const overlayRef = useRef(null);
        const pulseAnimRef = useRef(null);

        useOverlayRegistration('showPause', () => {
                setIsActive(true);
                return () => setIsActive(false);
            });

        useEffect(() => {
            const overlayEl = overlayRef.current;
            if (!overlayEl) return;

            if (isActive) {
                if (window.anime) {
                    anime({
                        targets: overlayEl,
                        opacity: [0, 1],
                        duration: 300,
                        easing: 'easeOutQuad'
                    });

                    const iconEl = overlayEl.querySelector('.pause-icon');
                    if (iconEl) {
                        pulseAnimRef.current = anime({
                            targets: iconEl,
                            scale: [1, 1.1],
                            opacity: [0.8, 1],
                            duration: 1000,
                            direction: 'alternate',
                            loop: true,
                            easing: 'easeInOutSine'
                        });
                    }
                } else {
                    overlayEl.style.opacity = '1';
                }
            }

            return () => {
                if (pulseAnimRef.current) {
                    pulseAnimRef.current.pause();
                    pulseAnimRef.current = null;
                }
            };
        }, [isActive]);

        const handleResume = () => {
            const overlayEl = overlayRef.current;
            if (!overlayEl || !window.anime) {
                setIsActive(false);
                return;
            }

            if (pulseAnimRef.current) {
                pulseAnimRef.current.pause();
                pulseAnimRef.current = null;
            }

            anime({
                targets: overlayEl,
                opacity: 0,
                scale: 1.1,
                duration: 300,
                easing: 'easeInQuad',
                complete: () => setIsActive(false)
            });
        };

        if (!isActive) return null;

        return ReactDOM.createPortal(
            <div
                ref={overlayRef}
                className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', zIndex: 4000, opacity: 0 }}
                onClick={handleResume}
            >
                <div className="text-center text-white">
                    <div className="pause-icon display-1 mb-3"><i className="fas fa-pause-circle"></i></div>
                    <h2 className="display-4 fw-bold">PAUSA</h2>
                    <p className="h5 opacity-75">Tomate tu tiempo</p>
                </div>
            </div>,
            document.body
        );
    };
})();
