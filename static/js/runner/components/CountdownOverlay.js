(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.CountdownOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const numberRef = useRef(null);
        const containerRef = useRef(null);
        const timelineRef = useRef(null);
        const onCompleteRef = useRef(null);

        useOverlayRegistration('showCountdown', (onComplete) => {
                onCompleteRef.current = typeof onComplete === 'function' ? onComplete : null;
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            const numberEl = numberRef.current;
            if (!numberEl) return;

            if (!window.anime) {
                const fallbackMs = 3200;
                const timeoutId = setTimeout(() => {
                    setIsActive(false);
                    if (onCompleteRef.current) onCompleteRef.current();
                }, fallbackMs);
                return () => clearTimeout(timeoutId);
            }

            const steps = ['3', '2', '1', '¡GO!'];

            if (timelineRef.current) {
                timelineRef.current.pause();
                timelineRef.current = null;
            }

            timelineRef.current = anime.timeline({
                complete: () => {
                    setIsActive(false);
                    if (onCompleteRef.current) onCompleteRef.current();
                }
            });

            steps.forEach((step, index) => {
                timelineRef.current.add({
                    targets: numberEl,
                    fontSize: ['0px', '180px'],
                    opacity: [0, 1],
                    rotate: [-30, 0],
                    duration: 500,
                    easing: 'easeOutBack',
                    begin: () => {
                        numberEl.innerText = step;
                        numberEl.style.color = index === 3 ? '#28a745' : '#ffc107';
                        if (navigator.vibrate) navigator.vibrate(50);
                    }
                }).add({
                    targets: numberEl,
                    opacity: 0,
                    scale: 1.5,
                    duration: 300,
                    easing: 'easeInQuad'
                });
            });

            return () => {
                if (timelineRef.current) {
                    timelineRef.current.pause();
                    timelineRef.current = null;
                }
            };
        }, [isActive]);

        if (!isActive) return null;

        return ReactDOM.createPortal(
            <div
                ref={containerRef}
                className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                style={{
                    zIndex: 3000,
                    background: 'radial-gradient(circle, rgba(45, 52, 54, 0.75) 0%, rgba(0, 0, 0, 0.9) 100%)',
                    pointerEvents: 'auto'
                }}
            >
                <h1
                    ref={numberRef}
                    style={{
                        fontSize: '0px',
                        fontWeight: 900,
                        color: '#ffc107',
                        textShadow: '0 0 20px rgba(0,0,0,0.8)',
                        fontFamily: "'Anton', sans-serif"
                    }}
                ></h1>
            </div>,
            document.body
        );
    };
})();
