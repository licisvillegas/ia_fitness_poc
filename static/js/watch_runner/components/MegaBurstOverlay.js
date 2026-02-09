(function () {
    const { useEffect, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.MegaBurstOverlay = () => {
        const [isActive, setIsActive] = useState(false);

        useOverlayRegistration('showMegaBurst', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            if (!window.confetti) {
                const timeoutId = setTimeout(() => setIsActive(false), 200);
                return () => clearTimeout(timeoutId);
            }

            try {
                let shapes = ['circle', 'square'];
                if (typeof confetti.shapeFromPath === 'function') {
                    try {
                        const triangle = confetti.shapeFromPath({ path: 'M0 10 L5 0 L10 10z' });
                        const square = confetti.shapeFromPath({ path: 'M0 0 L10 0 L10 10 L0 10z' });
                        shapes = [triangle, square];
                    } catch (err) { }
                }

                const fire = (particleRatio, opts) => {
                    confetti(Object.assign({}, {
                        origin: { y: 0.7 },
                        shapes: shapes
                    }, opts, {
                        particleCount: Math.floor(200 * particleRatio)
                    }));
                };

                fire(0.25, { spread: 26, startVelocity: 55 });
                fire(0.2, { spread: 60 });
                fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
                fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
                fire(0.1, { spread: 120, startVelocity: 45 });
            } catch (e) {
                confetti({ particleCount: 100, startVelocity: 30, spread: 360, origin: { x: 0.5, y: 0.5 } });
            }

            const timeoutId = setTimeout(() => setIsActive(false), 200);
            return () => clearTimeout(timeoutId);
        }, [isActive]);

        return null;
    };
})();
