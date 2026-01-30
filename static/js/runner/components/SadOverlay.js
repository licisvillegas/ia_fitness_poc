(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.SadOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const iconRef = useRef(null);
        const animRef = useRef(null);
        const rafRef = useRef(null);
        const timeoutRef = useRef(null);

        useOverlayRegistration('showSad', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            const iconEl = iconRef.current;
            if (!iconEl) return;

            if (!window.anime) {
                const fallbackMs = 3000;
                const timeoutId = setTimeout(() => setIsActive(false), fallbackMs);
                return () => clearTimeout(timeoutId);
            }

            animRef.current = anime({
                targets: iconEl,
                opacity: [0, 1, 1, 0],
                translateY: [0, 20],
                scale: [0.8, 1],
                duration: 4000,
                easing: 'easeInOutQuad',
                complete: () => setIsActive(false)
            });

            if (window.confetti) {
                const durationMs = 3000;
                const endAt = Date.now() + durationMs;

                const frame = () => {
                    confetti({
                        particleCount: 3,
                        angle: 270,
                        spread: 15,
                        origin: { x: Math.random(), y: -0.1 },
                        colors: ['#4287f5', '#a6c1ee', '#1a4e8a', '#5c6fa3'],
                        gravity: 2.5,
                        drift: 0,
                        ticks: 300,
                        scalar: 0.6,
                        shapes: ['circle']
                    });

                    if (Date.now() < endAt) {
                        rafRef.current = requestAnimationFrame(frame);
                    }
                };

                rafRef.current = requestAnimationFrame(frame);
            }

            return () => {
                if (animRef.current) {
                    animRef.current.pause();
                    animRef.current = null;
                }
                if (rafRef.current) {
                    cancelAnimationFrame(rafRef.current);
                    rafRef.current = null;
                }
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            };
        }, [isActive]);

        if (!isActive) return null;

        return ReactDOM.createPortal(
            <div
                ref={iconRef}
                className="position-fixed top-50 start-50 translate-middle"
                style={{
                    fontSize: '150px',
                    zIndex: 3000,
                    opacity: 0,
                    filter: 'drop-shadow(0 10px 10px rgba(0,0,0,0.5)) grayscale(0.5)'
                }}
            >
                🌧️
            </div>,
            document.body
        );
    };
})();
