(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.FountainOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const intervalRef = useRef(null);
        const timeoutRef = useRef(null);

        useOverlayRegistration('showFountain', () => {
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

            intervalRef.current = setInterval(() => {
                confetti({
                    particleCount: 20,
                    startVelocity: 45,
                    spread: 80,
                    origin: { y: 0.9 },
                    gravity: 1.2,
                    drift: 0,
                    scalar: 1,
                    colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
                });
            }, 100);

            timeoutRef.current = setTimeout(() => {
                if (intervalRef.current) clearInterval(intervalRef.current);
                setIsActive(false);
            }, durationMs + 100);

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
