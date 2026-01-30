(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.ZenOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const overlayRef = useRef(null);
        const animRef = useRef(null);
        const rafRef = useRef(null);
        const timeoutRef = useRef(null);

        useOverlayRegistration('showZen', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            const overlayEl = overlayRef.current;
            if (!overlayEl) return;

            if (window.anime) {
                animRef.current = anime({
                    targets: overlayEl,
                    opacity: 0.9,
                    duration: 2000,
                    direction: 'alternate',
                    delay: 0,
                    endDelay: 3000,
                    easing: 'easeInOutQuad',
                    complete: () => setIsActive(false)
                });
            } else {
                overlayEl.style.opacity = '0.9';
                const fallbackMs = 5000;
                timeoutRef.current = setTimeout(() => setIsActive(false), fallbackMs);
            }

            if (window.confetti) {
                const durationMs = 6000;
                const endAt = Date.now() + durationMs;

                const frame = () => {
                    const timeLeft = endAt - Date.now();
                    confetti({
                        particleCount: 1,
                        startVelocity: 0,
                        ticks: 200,
                        origin: {
                            x: Math.random(),
                            y: 1.1
                        },
                        colors: ['#a8e6cf', '#dcedc1', '#ffd3b6'],
                        shapes: ['circle'],
                        gravity: -0.2,
                        scalar: 2,
                        drift: 0,
                        opacity: 0.5
                    });

                    if (timeLeft > 0) {
                        if (Math.random() > 0.8) {
                            rafRef.current = requestAnimationFrame(frame);
                        } else {
                            timeoutRef.current = setTimeout(() => {
                                if (Date.now() < endAt) frame();
                            }, 50);
                        }
                    }
                };

                rafRef.current = requestAnimationFrame(frame);
            }

            return () => {
                if (animRef.current) {
                    animRef.current.pause();
                    animRef.current = null;
                }
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

        if (!isActive) return null;

        return ReactDOM.createPortal(
            <div
                ref={overlayRef}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle, #2d3436 0%, #000000 100%)',
                    zIndex: 1999,
                    opacity: 0
                }}
            ></div>,
            document.body
        );
    };
})();
