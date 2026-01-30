(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.SnowOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const rafRef = useRef(null);
        const timeoutRef = useRef(null);

        useOverlayRegistration('showSnow', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            if (!window.confetti) {
                const fallbackMs = 1000;
                const timeoutId = setTimeout(() => setIsActive(false), fallbackMs);
                return () => clearTimeout(timeoutId);
            }

            const durationMs = 5000;
            const endAt = Date.now() + durationMs;
            let skew = 1;

            const frame = () => {
                const timeLeft = endAt - Date.now();
                const ticks = Math.max(200, 500 * (timeLeft / durationMs));
                skew = Math.max(0.8, skew - 0.001);

                confetti({
                    particleCount: 1,
                    startVelocity: 0,
                    ticks: ticks,
                    origin: {
                        x: Math.random(),
                        y: (Math.random() * skew) - 0.2
                    },
                    colors: ['#ffffff'],
                    shapes: ['circle'],
                    gravity: 0.6,
                    scalar: Math.random() * (1 - 0.4) + 0.4,
                    drift: Math.random() * 0.8 - 0.4
                });

                if (timeLeft > 0) {
                    rafRef.current = requestAnimationFrame(frame);
                } else {
                    setIsActive(false);
                }
            };

            rafRef.current = requestAnimationFrame(frame);
            timeoutRef.current = setTimeout(() => {
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                setIsActive(false);
            }, durationMs + 100);

            return () => {
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

        return null;
    };
})();
