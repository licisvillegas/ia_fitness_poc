(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.SvgSuccessOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const containerRef = useRef(null);
        const timelineRef = useRef(null);

        useOverlayRegistration('showSvgSuccess', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            const containerEl = containerRef.current;
            if (!containerEl) return;

            if (!window.anime) {
                const timeoutId = setTimeout(() => setIsActive(false), 1500);
                return () => clearTimeout(timeoutId);
            }

            anime.remove(containerEl.querySelectorAll('.check-path'));
            anime.set(containerEl.querySelectorAll('.check-path'), { strokeDashoffset: anime.setDashoffset });

            timelineRef.current = anime.timeline({
                easing: 'easeInOutQuad',
                complete: function () {
                    setTimeout(() => {
                        anime({
                            targets: containerEl,
                            opacity: 0,
                            duration: 1000,
                            complete: () => setIsActive(false)
                        });
                    }, 2000);
                }
            });

            timelineRef.current
                .add({
                    targets: containerEl.querySelector('.circle'),
                    strokeDashoffset: [anime.setDashoffset, 0],
                    duration: 800,
                    easing: 'easeInOutSine'
                })
                .add({
                    targets: containerEl.querySelector('.check'),
                    strokeDashoffset: [anime.setDashoffset, 0],
                    duration: 400,
                    easing: 'easeOutBounce'
                }, '-=200')
                .add({
                    targets: containerEl.querySelector('.check-container'),
                    scale: [0.8, 1.2, 1],
                    duration: 600,
                    easing: 'spring(1, 80, 10, 0)'
                }, '-=400');

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
                className="position-fixed top-50 start-50 translate-middle"
                style={{ zIndex: 3000, opacity: 1 }}
            >
                <div className="check-container" style={{ width: '140px', height: '140px' }}>
                    <svg viewBox="0 0 52 52" width="140" height="140">
                        <circle className="check-path circle" cx="26" cy="26" r="25" fill="none" stroke="#28a745" strokeWidth="2" />
                        <path className="check-path check" fill="none" stroke="#28a745" strokeWidth="3" d="M14 27l7 7 17-17" />
                    </svg>
                </div>
            </div>,
            document.body
        );
    };
})();
