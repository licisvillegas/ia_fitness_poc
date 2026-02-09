(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.BreathingOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const [durationSeconds, setDurationSeconds] = useState(10);
        const circleRef = useRef(null);
        const textRef = useRef(null);
        const timelineRef = useRef(null);
        const onCompleteRef = useRef(null);
        const currentTextRef = useRef("Inhala...");

        const stopOverlay = () => {
            if (timelineRef.current) {
                timelineRef.current.pause();
                timelineRef.current = null;
            }
            if (window.anime && circleRef.current) {
                anime.remove(circleRef.current);
            }
            setIsActive(false);
        };

        useOverlayRegistration('showBreathing', (nextDurationSeconds, onComplete) => {
                onCompleteRef.current = typeof onComplete === 'function' ? onComplete : null;
                setDurationSeconds(Number(nextDurationSeconds) || 10);
                currentTextRef.current = "Inhala...";
                setIsActive(true);
                return () => stopOverlay();
            });

        useEffect(() => {
            if (!isActive) return;

            const circleEl = circleRef.current;
            const textEl = textRef.current;
            if (!circleEl || !textEl) return;

            textEl.innerText = "Inhala...";
            currentTextRef.current = "Inhala...";

            const loopCount = Math.max(1, Math.ceil((Number(durationSeconds) || 10) / 8));

            if (!window.anime) {
                const fallbackMs = loopCount * 8000;
                const timeoutId = setTimeout(() => {
                    setIsActive(false);
                    if (onCompleteRef.current) onCompleteRef.current();
                }, fallbackMs);
                return () => clearTimeout(timeoutId);
            }

            if (timelineRef.current) {
                timelineRef.current.pause();
                timelineRef.current = null;
            }

            timelineRef.current = anime.timeline({
                loop: loopCount * 2,
                direction: 'alternate',
                loopComplete: function () {
                    if (!textEl) return;
                    currentTextRef.current = currentTextRef.current === "Inhala..." ? "Exhala..." : "Inhala...";
                    textEl.innerText = currentTextRef.current;
                },
                complete: () => {
                    setIsActive(false);
                    if (onCompleteRef.current) onCompleteRef.current();
                }
            });

            timelineRef.current.add({
                targets: circleEl,
                scale: [1, 2.5],
                opacity: [0.5, 0.2],
                duration: 4000,
                easing: 'easeInOutSine'
            });

            return () => {
                if (timelineRef.current) {
                    timelineRef.current.pause();
                    timelineRef.current = null;
                }
                if (window.anime) {
                    anime.remove(circleEl);
                }
            };
        }, [isActive, durationSeconds]);

        if (!isActive) return null;

        return ReactDOM.createPortal(
            <React.Fragment>
                <div
                    ref={circleRef}
                    style={{
                        width: '150px',
                        height: '150px',
                        borderRadius: '50%',
                        backgroundColor: '#0dcaf0',
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 2000,
                        opacity: 0.5,
                        boxShadow: '0 0 50px #0dcaf0',
                        pointerEvents: 'none'
                    }}
                ></div>
                <div
                    ref={textRef}
                    className="position-fixed top-50 start-50 translate-middle text-white fw-bold h1"
                    style={{ zIndex: 2001, pointerEvents: 'none', textShadow: '0 0 10px rgba(0,0,0,0.5)' }}
                >
                    Inhala...
                </div>
            </React.Fragment>,
            document.body
        );
    };
})();
