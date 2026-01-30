(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.GoalOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const containerRef = useRef(null);
        const textRef = useRef(null);
        const timelineRef = useRef(null);
        const fadeTimeoutRef = useRef(null);

        useOverlayRegistration('showGoal', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            const containerEl = containerRef.current;
            const textEl = textRef.current;
            if (!containerEl || !textEl) return;

            if (!window.anime) {
                const fallbackMs = 2000;
                const timeoutId = setTimeout(() => setIsActive(false), fallbackMs);
                return () => clearTimeout(timeoutId);
            }

            anime({
                targets: textEl,
                scale: [0, 1.2, 1],
                opacity: [0, 1],
                duration: 1200,
                easing: 'easeOutElastic(1, .6)'
            });

            if (timelineRef.current) {
                timelineRef.current.pause();
                timelineRef.current = null;
            }

            timelineRef.current = anime.timeline({
                easing: 'easeOutExpo'
            });

            timelineRef.current
                .add({
                    targets: containerEl.querySelector('.flag-left'),
                    translateX: ['-100vw', 0],
                    rotate: [-45, 0],
                    duration: 1000,
                    delay: 200
                })
                .add({
                    targets: containerEl.querySelector('.flag-right'),
                    translateX: ['100vw', 0],
                    rotate: [45, 0],
                    duration: 1000,
                    delay: 200
                }, '-=1000');

            if (window.WorkoutAnimations?.realisticEffect) {
                window.WorkoutAnimations.realisticEffect();
            } else if (window.confetti) {
                confetti({
                    particleCount: 120,
                    spread: 360,
                    origin: { x: 0.5, y: 0.6 }
                });
            }

            fadeTimeoutRef.current = setTimeout(() => {
                anime({
                    targets: containerEl,
                    opacity: 0,
                    duration: 500,
                    easing: 'easeInQuad',
                    complete: () => setIsActive(false)
                });
            }, 4000);

            return () => {
                if (timelineRef.current) {
                    timelineRef.current.pause();
                    timelineRef.current = null;
                }
                if (fadeTimeoutRef.current) {
                    clearTimeout(fadeTimeoutRef.current);
                    fadeTimeoutRef.current = null;
                }
            };
        }, [isActive]);

        if (!isActive) return null;

        return ReactDOM.createPortal(
            <div
                ref={containerRef}
                className="goal-effect position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center pointer-events-none"
                style={{ zIndex: 3500 }}
            >
                <h1
                    ref={textRef}
                    className="display-1 fw-bold text-white mb-4"
                    style={{ textShadow: '0 0 20px #FFD700', transform: 'scale(0)' }}
                >
                    ¡META ALCANZADA!
                </h1>
                <div className="d-flex justify-content-center gap-5">
                    <div className="flag-left display-1 text-white"><i className="fas fa-flag-checkered"></i></div>
                    <div className="flag-right display-1 text-white"><i className="fas fa-flag-checkered"></i></div>
                </div>
            </div>,
            document.body
        );
    };
})();
