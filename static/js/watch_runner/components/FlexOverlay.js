(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.FlexOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const iconRef = useRef(null);
        const animRef = useRef(null);

        useOverlayRegistration('showFlex', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            const iconEl = iconRef.current;
            if (!iconEl) return;

            if (!window.anime) {
                const fallbackMs = 1500;
                const timeoutId = setTimeout(() => setIsActive(false), fallbackMs);
                return () => clearTimeout(timeoutId);
            }

            animRef.current = anime({
                targets: iconEl,
                fontSize: ['0px', '200px'],
                translateY: [0, -100],
                opacity: [1, 0],
                duration: 3000,
                easing: 'easeOutExpo',
                complete: () => setIsActive(false)
            });

            return () => {
                if (animRef.current) {
                    animRef.current.pause();
                    animRef.current = null;
                }
            };
        }, [isActive]);

        if (!isActive) return null;

        return ReactDOM.createPortal(
            <div
                ref={iconRef}
                className="position-fixed top-50 start-50 translate-middle text-warning"
                style={{ fontSize: '0px', zIndex: 3000 }}
            >
                💪
            </div>,
            document.body
        );
    };
})();
