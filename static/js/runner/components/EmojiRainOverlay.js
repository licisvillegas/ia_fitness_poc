(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.EmojiRainOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const timeoutRef = useRef(null);

        useOverlayRegistration('showEmojiRain', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            try {
                if (!window.confetti || typeof confetti.shapeFromText !== 'function') {
                    setIsActive(false);
                    return;
                }

                const scalar = 3;
                const muscle = confetti.shapeFromText({ text: '💪', scalar });
                const fire = confetti.shapeFromText({ text: '🔥', scalar });
                const trophy = confetti.shapeFromText({ text: '🏆', scalar });

                confetti({
                    particleCount: 40,
                    spread: 100,
                    origin: { y: 0.4 },
                    shapes: [muscle, fire, trophy],
                    scalar: 2
                });
            } catch (e) {
                console.error("Error en Lluvia de Emojis:", e);
            }

            timeoutRef.current = setTimeout(() => setIsActive(false), 300);

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
