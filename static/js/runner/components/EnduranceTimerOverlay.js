(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.EnduranceTimerOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const [durationSeconds, setDurationSeconds] = useState(10);
        const ringRef = useRef(null);
        const textRef = useRef(null);
        const containerRef = useRef(null);
        const animRef = useRef(null);
        const onCompleteRef = useRef(null);

        const cleanup = () => {
            if (animRef.current) {
                animRef.current.pause();
                animRef.current = null;
            }
            if (window.anime && ringRef.current) {
                anime.remove(ringRef.current);
            }
            if (window.anime && containerRef.current) {
                anime.remove(containerRef.current);
            }
            setIsActive(false);
        };

        useOverlayRegistration('showEnduranceTimer', (nextDurationSeconds, onComplete) => {
                onCompleteRef.current = typeof onComplete === 'function' ? onComplete : null;
                setDurationSeconds(Number(nextDurationSeconds) || 10);
                setIsActive(true);
                return () => cleanup();
            });

        useEffect(() => {
            if (!isActive) return;

            const ringEl = ringRef.current;
            const textEl = textRef.current;
            const containerEl = containerRef.current;
            if (!ringEl || !textEl || !containerEl) return;

            const durationMs = Math.max(1, Number(durationSeconds) || 10) * 1000;
            textEl.innerText = String(Math.ceil(durationMs / 1000));

            if (!window.anime) {
                const tickInterval = 250;
                let elapsed = 0;
                const intervalId = setInterval(() => {
                    elapsed += tickInterval;
                    const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
                    textEl.innerText = String(remaining);
                    if (elapsed >= durationMs) {
                        clearInterval(intervalId);
                        textEl.innerText = "OK";
                        setTimeout(() => {
                            setIsActive(false);
                            if (onCompleteRef.current) onCompleteRef.current();
                        }, 500);
                    }
                }, tickInterval);

                return () => clearInterval(intervalId);
            }

            const circumference = 2 * Math.PI * 90;
            animRef.current = anime({
                targets: ringEl,
                strokeDashoffset: [0, circumference],
                easing: 'linear',
                duration: durationMs,
                update: function (anim) {
                    const progress = anim.progress / 100;
                    const remaining = Math.ceil((durationMs / 1000) * (1 - progress));
                    textEl.innerText = remaining > 0 ? String(remaining) : "0";
                },
                complete: () => {
                    textEl.innerText = "OK";
                    anime({
                        targets: containerEl,
                        scale: [1, 1.2, 0],
                        opacity: 0,
                        duration: 800,
                        easing: 'easeOutExpo',
                        complete: () => {
                            setIsActive(false);
                            if (onCompleteRef.current) onCompleteRef.current();
                        }
                    });
                }
            });

            return () => {
                if (animRef.current) {
                    animRef.current.pause();
                    animRef.current = null;
                }
                if (window.anime) {
                    anime.remove(ringEl);
                    anime.remove(containerEl);
                }
            };
        }, [isActive, durationSeconds]);

        if (!isActive) return null;

        return ReactDOM.createPortal(
            <div
                ref={containerRef}
                className="position-fixed top-50 start-50 translate-middle d-flex align-items-center justify-content-center"
                style={{ zIndex: 3000, width: '200px', height: '200px' }}
            >
                <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="15" />
                    <circle
                        ref={ringRef}
                        className="progress-ring"
                        cx="100"
                        cy="100"
                        r="90"
                        fill="none"
                        stroke="#ffc107"
                        strokeWidth="15"
                        strokeDasharray="565.48"
                        strokeDashoffset="0"
                        strokeLinecap="round"
                    />
                </svg>
                <div
                    ref={textRef}
                    className="timer-text position-absolute text-white fw-bold display-4"
                    style={{ textShadow: '0 0 10px black' }}
                >
                    {durationSeconds}
                </div>
            </div>,
            document.body
        );
    };
})();
