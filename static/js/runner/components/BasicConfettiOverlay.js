(function () {
    const { useEffect, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.BasicConfettiOverlay = () => {
        const [isActive, setIsActive] = useState(false);

        useOverlayRegistration('showBasicConfetti', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            if (!window.confetti) {
                const timeoutId = setTimeout(() => setIsActive(false), 200);
                return () => clearTimeout(timeoutId);
            }

            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });

            const timeoutId = setTimeout(() => setIsActive(false), 200);
            return () => clearTimeout(timeoutId);
        }, [isActive]);

        return null;
    };
})();
