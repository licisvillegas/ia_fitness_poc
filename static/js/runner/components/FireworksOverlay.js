(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.FireworksOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const intervalRef = useRef(null);
        const timeoutRef = useRef(null);

        useOverlayRegistration('showFireworks', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            if (!window.confetti) {
                const fallbackMs = 500;
                const timeoutId = setTimeout(() => setIsActive(false), fallbackMs);
                return () => clearTimeout(timeoutId);
            }

            const durationMs = 3000;
            const endAt = Date.now() + durationMs;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

            intervalRef.current = setInterval(() => {
                const timeLeft = endAt - Date.now();
                if (timeLeft <= 0) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    setIsActive(false);
                    return;
                }

                const particleCount = 50 * (timeLeft / durationMs);
                confetti(Object.assign({}, defaults, {
                    particleCount,
                    origin: { x: Math.random() * 0.2 + 0.1, y: Math.random() - 0.2 }
                }));
                confetti(Object.assign({}, defaults, {
                    particleCount,
                    origin: { x: Math.random() * 0.2 + 0.7, y: Math.random() - 0.2 }
                }));
            }, 250);

            timeoutRef.current = setTimeout(() => {
                if (intervalRef.current) clearInterval(intervalRef.current);
                setIsActive(false);
            }, durationMs + 200);

            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
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
