(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.GlitchOverlay = () => {
        const [text, setText] = useState("");
        const [isActive, setIsActive] = useState(false);
        const timeoutRef = useRef(null);

        useEffect(() => {
            if (!document.getElementById('glitch-css')) {
                const style = document.createElement('style');
                style.id = 'glitch-css';
                style.innerHTML = `
                    .glitch { font-size: 3.5rem; font-weight: bold; text-transform: uppercase; position: relative; color: white; letter-spacing: 0.1em; opacity: 0; transition: opacity 0.5s; font-family: monospace}
                    .glitch.active { opacity: 1; }
                    .glitch.active::before, .glitch.active::after {
                        content: attr(data-text);
                        position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.8;
                    }
                    .glitch.active::before { color: #0ff; z-index: -1; animation: glitch-anim-1 0.4s infinite linear alternate-reverse; }
                    .glitch.active::after { color: #f0f; z-index: -2; animation: glitch-anim-2 0.4s infinite linear alternate-reverse; }
                    @keyframes glitch-anim-1 {
                        0% { clip-path: inset(20% 0 80% 0); transform: translate(-2px,0); }
                        20% { clip-path: inset(60% 0 10% 0); transform: translate(2px,0); }
                        40% { clip-path: inset(40% 0 50% 0); transform: translate(-2px,0); }
                        60% { clip-path: inset(80% 0 5% 0); transform: translate(2px,0); }
                        80% { clip-path: inset(10% 0 70% 0); transform: translate(-2px,0); }
                        100% { clip-path: inset(30% 0 20% 0); transform: translate(2px,0); }
                    }
                    @keyframes glitch-anim-2 {
                        0% { clip-path: inset(10% 0 60% 0); transform: translate(2px,0); }
                        20% { clip-path: inset(80% 0 5% 0); transform: translate(-2px,0); }
                        40% { clip-path: inset(30% 0 20% 0); transform: translate(2px,0); }
                        60% { clip-path: inset(15% 0 80% 0); transform: translate(-2px,0); }
                        80% { clip-path: inset(55% 0 10% 0); transform: translate(2px,0); }
                    }
                `;
                document.head.appendChild(style);
            }
        }, []);

        useOverlayRegistration('showGlitch', (nextText) => {
                const safeText = String(nextText || "RUTINA COMPLETADA");
                setText(safeText);
                setIsActive(true);
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => {
                    setIsActive(false);
                    setText("");
                }, 3000);
            });

        if (!isActive) return null;

        return ReactDOM.createPortal(
            <div className="glitch-wrapper position-fixed top-50 start-50 translate-middle w-100 text-center" style={{ zIndex: 3000 }}>
                <h1 className={`glitch ${isActive ? 'active' : ''}`} data-text={text}>{text}</h1>
            </div>,
            document.body
        );
    };
})();
