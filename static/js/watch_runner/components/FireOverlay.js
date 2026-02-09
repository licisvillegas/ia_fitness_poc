(function () {
    const { useEffect, useRef } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.FireOverlay = () => {
        const rafRef = useRef(null);
        const timeoutRef = useRef(null);

        useOverlayRegistration('showFire', () => {
                if (!window.confetti) return;

                const durationMs = 3000;
                const endAt = Date.now() + durationMs;

                const frame = () => {
                    const timeLeft = endAt - Date.now();

                    confetti({
                        particleCount: 5,
                        spread: 30,
                        startVelocity: 40,
                        origin: { y: 1, x: 0.5 },
                        colors: ['#ff0000', '#ff4500', '#ffa500'],
                        shapes: ['circle'],
                        gravity: 0.8,
                        scalar: 1.2,
                        drift: (Math.random() - 0.5) * 1
                    });

                    if (Math.random() > 0.8) {
                        confetti({
                            particleCount: 2,
                            spread: 60,
                            startVelocity: 55,
                            origin: { y: 1, x: 0.5 },
                            colors: ['#ffd700'],
                            scalar: 0.6
                        });
                    }

                    if (timeLeft > 0) {
                        rafRef.current = requestAnimationFrame(frame);
                    }
                };

                rafRef.current = requestAnimationFrame(frame);

                timeoutRef.current = setTimeout(() => {
                    if (rafRef.current) cancelAnimationFrame(rafRef.current);
                }, durationMs + 100);
            });

        return null;
    };
})();
