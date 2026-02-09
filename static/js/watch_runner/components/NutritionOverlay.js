(function () {
    const { useEffect, useMemo, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.NutritionOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const containerRef = useRef(null);
        const iconRef = useRef(null);
        const floatingRefs = useRef([]);
        const fadeTimeoutRef = useRef(null);
        const floatAnimsRef = useRef([]);
        const iconAnimRef = useRef(null);

        const floatingItems = useMemo(() => {
            const ingredients = ['fa-carrot', 'fa-apple-alt', 'fa-leaf', 'fa-lemon'];
            const items = [];
            for (let i = 0; i < 8; i += 1) {
                items.push({
                    id: i,
                    icon: ingredients[Math.floor(Math.random() * ingredients.length)],
                    size: (Math.random() * 2 + 1).toFixed(2) + 'rem',
                    left: Math.random() * 100 + 'vw',
                    top: Math.random() * 100 + 'vh',
                    duration: 2000 + Math.random() * 1000,
                    delay: Math.random() * 1000
                });
            }
            return items;
        }, [isActive]);

        useOverlayRegistration('showNutrition', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            const containerEl = containerRef.current;
            const iconEl = iconRef.current;
            if (!containerEl || !iconEl) return;

            if (!window.anime) {
                const fallbackMs = 3500;
                const timeoutId = setTimeout(() => setIsActive(false), fallbackMs);
                return () => clearTimeout(timeoutId);
            }

            anime({
                targets: containerEl,
                opacity: [0, 1],
                duration: 500,
                easing: 'easeOutQuad'
            });

            iconAnimRef.current = anime({
                targets: iconEl,
                rotate: '1turn',
                duration: 3000,
                loop: true,
                easing: 'linear'
            });

            floatAnimsRef.current = floatingRefs.current.map((el, index) => {
                const item = floatingItems[index];
                if (!el || !item) return null;
                return anime({
                    targets: el,
                    translateY: [0, -100],
                    opacity: [0.5, 0],
                    duration: item.duration,
                    loop: true,
                    easing: 'linear',
                    delay: item.delay
                });
            }).filter(Boolean);

            fadeTimeoutRef.current = setTimeout(() => {
                anime({
                    targets: containerEl,
                    opacity: 0,
                    duration: 500,
                    easing: 'easeInQuad',
                    complete: () => setIsActive(false)
                });
            }, 3500);

            return () => {
                if (iconAnimRef.current) {
                    iconAnimRef.current.pause();
                    iconAnimRef.current = null;
                }
                floatAnimsRef.current.forEach(anim => {
                    if (anim) anim.pause();
                });
                floatAnimsRef.current = [];
                if (fadeTimeoutRef.current) {
                    clearTimeout(fadeTimeoutRef.current);
                    fadeTimeoutRef.current = null;
                }
            };
        }, [isActive, floatingItems]);

        if (!isActive) return null;

        return ReactDOM.createPortal(
            <div
                ref={containerRef}
                className="nutrition-effect position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', zIndex: 3500, opacity: 0 }}
            >
                <div ref={iconRef} className="display-1 text-success mb-4">
                    <i className="fas fa-utensils"></i>
                </div>
                <h2 className="display-5 fw-bold text-dark text-center">PREPARANDO ALIMENTACION...</h2>
                {floatingItems.map((item, index) => (
                    <div
                        key={item.id}
                        ref={(el) => { floatingRefs.current[index] = el; }}
                        className="position-absolute text-success opacity-50"
                        style={{ fontSize: item.size, left: item.left, top: item.top }}
                    >
                        <i className={`fas ${item.icon}`}></i>
                    </div>
                ))}
            </div>,
            document.body
        );
    };
})();
