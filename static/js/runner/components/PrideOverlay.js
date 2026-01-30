(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.PrideOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const rafRef = useRef(null);
        const timeoutRef = useRef(null);

        useOverlayRegistration('showPride', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            if (!window.confetti) {
                const fallbackMs = 500;
                const timeoutId = setTimeout(() => setIsActive(false), fallbackMs);
                return () => clearTimeout(timeoutId);
            }

            const endAt = Date.now() + 3000;
            const colors = ['#ff0000', '#ffa500', '#ffff00', '#008000', '#0000ff', '#4b0082', '#ee82ee'];

            const frame = () => {
                confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: colors });
                confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: colors });
                if (Date.now() < endAt) {
                    rafRef.current = requestAnimationFrame(frame);
                } else {
                    setIsActive(false);
                }
            };

            rafRef.current = requestAnimationFrame(frame);
            timeoutRef.current = setTimeout(() => {
                if (rafRef.current) cancelAnimationFrame(rafRef.current);
                setIsActive(false);
            }, 3100);

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
