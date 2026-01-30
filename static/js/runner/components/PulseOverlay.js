(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.PulseOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const heartRef = useRef(null);
        const heartAnimRef = useRef(null);
        const activeCardAnimRef = useRef(null);

        useOverlayRegistration('showPulse', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            const heartEl = heartRef.current;
            if (!heartEl) return;

            const activeCard = document.querySelector('.active-card');

            if (!window.anime) {
                setTimeout(() => setIsActive(false), 1500);
                return;
            }

            heartAnimRef.current = anime({
                targets: heartEl,
                fontSize: [
                    { value: '250px', duration: 300, easing: 'easeOutQuad' },
                    { value: '200px', duration: 150, easing: 'easeInQuad' }
                ],
                opacity: { value: [1, 0.4], duration: 450, easing: 'linear' },
                loop: 5,
                complete: () => {
                    anime({
                        targets: heartEl,
                        opacity: 0,
                        scale: 3,
                        duration: 500,
                        easing: 'easeOutExpo',
                        complete: () => setIsActive(false)
                    });
                }
            });

            if (activeCard) {
                const originalBorder = activeCard.style.borderColor;
                const originalShadow = activeCard.style.boxShadow;
                activeCard.style.border = '2px solid transparent';

                activeCardAnimRef.current = anime({
                    targets: activeCard,
                    borderColor: ['rgba(220, 53, 69, 0)', '#dc3545', 'rgba(220, 53, 69, 0)'],
                    boxShadow: [
                        '0 0 0 rgba(220, 53, 69, 0)',
                        '0 0 20px rgba(220, 53, 69, 0.6)',
                        '0 0 0 rgba(220, 53, 69, 0)'
                    ],
                    duration: 900,
                    easing: 'easeInOutSine',
                    loop: 5,
                    complete: () => {
                        activeCard.style.borderColor = originalBorder;
                        activeCard.style.boxShadow = originalShadow;
                    }
                });
            }

            return () => {
                if (heartAnimRef.current) {
                    heartAnimRef.current.pause();
                    heartAnimRef.current = null;
                }
                if (activeCardAnimRef.current) {
                    activeCardAnimRef.current.pause();
                    activeCardAnimRef.current = null;
                }
                setIsActive(false);
            };
        }, [isActive]);

        if (!isActive) return null;

        return ReactDOM.createPortal(
            <div
                ref={heartRef}
                className="position-fixed top-50 start-50 translate-middle text-danger"
                style={{ fontSize: '0px', zIndex: 3000 }}
            >
                <i className="fas fa-heart"></i>
            </div>,
            document.body
        );
    };
})();
