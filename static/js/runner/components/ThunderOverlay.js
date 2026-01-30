(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.ThunderOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const flashRef = useRef(null);
        const boltRef = useRef(null);
        const flashAnimRef = useRef(null);
        const boltAnimRef = useRef(null);

        useOverlayRegistration('showThunder', () => {
                setIsActive(true);
            });

        useEffect(() => {
            if (!isActive) return;

            const flashEl = flashRef.current;
            const boltEl = boltRef.current;
            if (!flashEl || !boltEl) return;

            if (!window.anime) {
                const fallbackMs = 800;
                const timeoutId = setTimeout(() => setIsActive(false), fallbackMs);
                return () => clearTimeout(timeoutId);
            }

            flashAnimRef.current = anime({
                targets: flashEl,
                opacity: [0.8, 0],
                duration: 500,
                easing: 'easeOutQuad',
                complete: () => setIsActive(false)
            });

            boltAnimRef.current = anime({
                targets: boltEl,
                opacity: [0, 1, 0, 1, 0],
                scale: [0.8, 1.2],
                duration: 800,
                easing: 'steps(5)'
            });

            return () => {
                if (flashAnimRef.current) {
                    flashAnimRef.current.pause();
                    flashAnimRef.current = null;
                }
                if (boltAnimRef.current) {
                    boltAnimRef.current.pause();
                    boltAnimRef.current = null;
                }
            };
        }, [isActive]);

        if (!isActive) return null;

        return ReactDOM.createPortal(
            <React.Fragment>
                <div
                    ref={flashRef}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: '#fff',
                        zIndex: 3000,
                        opacity: 0,
                        pointerEvents: 'none'
                    }}
                ></div>
                <div
                    ref={boltRef}
                    className="position-fixed top-50 start-50 translate-middle text-info"
                    style={{ fontSize: '200px', zIndex: 3001, textShadow: '0 0 50px #0dcaf0', opacity: 0 }}
                >
                    <i className="fas fa-bolt"></i>
                </div>
            </React.Fragment>,
            document.body
        );
    };
})();
