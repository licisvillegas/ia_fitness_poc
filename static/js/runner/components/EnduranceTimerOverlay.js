(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;
    const { playTimerBeep } = window.Runner.utils;

    window.Runner.components.EnduranceTimerOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const [durationSeconds, setDurationSeconds] = useState(10);
        const ringRef = useRef(null);
        const textRef = useRef(null);
        const containerRef = useRef(null);
        const animRef = useRef(null);
        const onCompleteRef = useRef(null);

        const formatClock = (total) => {
            const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
            const mins = Math.floor(safeTotal / 60);
            const secs = safeTotal % 60;
            return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        };

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
            textEl.innerText = formatClock(Math.ceil(durationMs / 1000));

            if (!window.anime) {
                const tickInterval = 250;
                let elapsed = 0;
                const intervalId = setInterval(() => {
                    elapsed += tickInterval;
                    const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
                    textEl.innerText = formatClock(remaining);
                    if (elapsed >= durationMs) {
                        clearInterval(intervalId);
                        textEl.innerText = "OK";
                        if (playTimerBeep) playTimerBeep('finish');
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
                    textEl.innerText = remaining > 0 ? formatClock(remaining) : "00:00";
                },
                complete: () => {
                    textEl.innerText = "OK";
                    if (playTimerBeep) playTimerBeep('finish');
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

        const cancelTimer = () => {
            onCompleteRef.current = null;
            cleanup();
        };

        return ReactDOM.createPortal(
            <div
                className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                style={{
                    zIndex: 3000,
                    background: 'radial-gradient(circle, rgba(45, 52, 54, 0.75) 0%, rgba(0, 0, 0, 0.9) 100%)',
                    pointerEvents: 'auto'
                }}
            >
                <button
                    type="button"
                    className="btn btn-sm btn-outline-light rounded-pill position-absolute bottom-0 start-50 translate-middle-x mb-4 px-4"
                    onClick={cancelTimer}
                    title="Cancelar temporizador"
                >
                    Cerrar
                </button>
                <div
                    ref={containerRef}
                    className="d-flex align-items-center justify-content-center position-relative"
                    style={{ width: '200px', height: '200px' }}
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
                        {formatClock(durationSeconds)}
                    </div>
                </div>
            </div>,
            document.body
        );
    };
})();
