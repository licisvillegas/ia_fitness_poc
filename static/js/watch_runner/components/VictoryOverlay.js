(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.VictoryOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const medalRef = useRef(null);
        const animRef = useRef(null);

        useOverlayRegistration('showVictory', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            const medalEl = medalRef.current;
            if (!medalEl) return;

            if (!window.anime) {
                const fallbackMs = 2000;
                const timeoutId = setTimeout(() => setIsActive(false), fallbackMs);
                return () => clearTimeout(timeoutId);
            }

            animRef.current = anime({
                targets: medalEl,
                top: ['-100px', '40%'],
                rotate: [-15, 15, -10, 10, 0],
                duration: 2000,
                easing: 'spring(1, 80, 10, 0)',
                complete: () => {
                    setTimeout(() => {
                        anime({
                            targets: medalEl,
                            opacity: 0,
                            duration: 500,
                            complete: () => setIsActive(false)
                        });
                    }, 1000);
                }
            });

            if (window.confetti) {
                confetti({
                    particleCount: 50,
                    spread: 70,
                    origin: { y: 0.3 },
                    colors: ['#FFD700', '#FFA500']
                });
            }

            return () => {
                if (animRef.current) {
                    animRef.current.pause();
                    animRef.current = null;
                }
            };
        }, [isActive]);

        if (!isActive) return null;

        return ReactDOM.createPortal(
            <div
                ref={medalRef}
                className="position-fixed start-50 translate-middle-x"
                style={{
                    top: '-100px',
                    fontSize: '150px',
                    zIndex: 3000,
                    color: 'gold',
                    filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.5))'
                }}
            >
                <i className="fas fa-medal"></i>
            </div>,
            document.body
        );
    };
})();
