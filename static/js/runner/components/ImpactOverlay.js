(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.ImpactOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const timeoutRef = useRef(null);

        useOverlayRegistration('showImpact', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            if (!window.confetti) {
                const fallbackMs = 500;
                const timeoutId = setTimeout(() => setIsActive(false), fallbackMs);
                return () => clearTimeout(timeoutId);
            }

            confetti({
                particleCount: 80,
                spread: 120,
                origin: { y: 1 },
                startVelocity: 60,
                colors: ['#808080', '#696969', '#A9A9A9'],
                drift: 0,
                gravity: 0.8,
                scalar: 1.5,
                shapes: ['circle']
            });

            timeoutRef.current = setTimeout(() => {
                confetti({
                    particleCount: 60,
                    spread: 150,
                    origin: { y: 1 },
                    startVelocity: 40,
                    colors: ['#D3D3D3', '#F5F5F5'],
                    scalar: 0.8
                });
                setIsActive(false);
            }, 100);

            return () => {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
            };
        }, [isActive]);

        return null;
    };
})();
