(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.StarsOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const timeoutsRef = useRef([]);

        useOverlayRegistration('showStars', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            if (!window.confetti) {
                const fallbackMs = 300;
                const timeoutId = setTimeout(() => setIsActive(false), fallbackMs);
                return () => clearTimeout(timeoutId);
            }

            const defaults = {
                spread: 360,
                ticks: 50,
                gravity: 0,
                decay: 0.94,
                startVelocity: 30,
                colors: ['#FFE400', '#FFBD00', '#E89400', '#FFCA6C', '#FDFFB8']
            };

            const shoot = () => {
                confetti({
                    ...defaults,
                    particleCount: 40,
                    scalar: 1.2,
                    shapes: ['star']
                });

                confetti({
                    ...defaults,
                    particleCount: 10,
                    scalar: 0.75,
                    shapes: ['circle']
                });
            };

            timeoutsRef.current = [
                setTimeout(shoot, 0),
                setTimeout(shoot, 100),
                setTimeout(shoot, 200)
            ];

            const cleanup = () => {
                timeoutsRef.current.forEach((id) => clearTimeout(id));
                timeoutsRef.current = [];
            };

            const finishId = setTimeout(() => setIsActive(false), 300);
            timeoutsRef.current.push(finishId);

            return cleanup;
        }, [isActive]);

        return null;
    };
})();
