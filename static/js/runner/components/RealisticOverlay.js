(function () {
    const { useEffect, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.RealisticOverlay = () => {
        const [isActive, setIsActive] = useState(false);

        useOverlayRegistration('showRealistic', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            if (!window.confetti) {
                const fallbackMs = 200;
                const timeoutId = setTimeout(() => setIsActive(false), fallbackMs);
                return () => clearTimeout(timeoutId);
            }

            const count = 200;
            const defaults = { origin: { y: 0.7 } };
            const fire = (particleRatio, opts) => {
                confetti(Object.assign({}, defaults, opts, {
                    particleCount: Math.floor(count * particleRatio)
                }));
            };

            fire(0.25, { spread: 26, startVelocity: 55 });
            fire(0.2, { spread: 60 });
            fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
            fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
            fire(0.1, { spread: 120, startVelocity: 45 });

            const timeoutId = setTimeout(() => setIsActive(false), 200);
            return () => clearTimeout(timeoutId);
        }, [isActive]);

        return null;
    };
})();
