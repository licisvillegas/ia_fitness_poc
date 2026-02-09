(function () {
    const { useEffect, useMemo, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;

    window.Runner.components.TextRevealOverlay = () => {
        const [text, setText] = useState("");
        const [isActive, setIsActive] = useState(false);
        const lettersRef = useRef(null);
        const containerRef = useRef(null);
        const timelineRef = useRef(null);

        const lettersHtml = useMemo(() => {
            const safeText = String(text || "");
            return safeText.replace(/([^\x00-\x80]|\w)/g, "<span class='letter' style='display:inline-block; line-height:1em;'>$&</span>");
        }, [text]);

        useOverlayRegistration('showTextReveal', (nextText) => {
                const safeText = String(nextText || "RUTINA COMPLETADA");
                setText(safeText);
                setIsActive(true);
            });

        useEffect(() => {
            const lettersEl = lettersRef.current;
            const containerEl = containerRef.current;
            if (!isActive || !lettersEl || !containerEl) return;

            if (!window.anime) {
                setTimeout(() => {
                    setIsActive(false);
                    setText("");
                }, 2500);
                return;
            }

            if (timelineRef.current) {
                timelineRef.current.pause();
                timelineRef.current = null;
            }

            const width = lettersEl.getBoundingClientRect().width;
            timelineRef.current = anime.timeline({ loop: false })
                .add({
                    targets: containerEl.querySelector('.line'),
                    scaleY: [0, 1],
                    opacity: [0.5, 1],
                    easing: "easeOutExpo",
                    duration: 700
                })
                .add({
                    targets: containerEl.querySelector('.line'),
                    translateX: [0, width + 10],
                    easing: "easeOutExpo",
                    duration: 700,
                    delay: 100
                }).add({
                    targets: containerEl.querySelectorAll('.letter'),
                    opacity: [0, 1],
                    easing: "easeOutExpo",
                    duration: 600,
                    offset: '-=775',
                    delay: function (el, i) { return 34 * (i + 1); }
                }).add({
                    targets: containerEl,
                    opacity: 0,
                    duration: 1000,
                    easing: "easeOutExpo",
                    delay: 1000,
                    complete: () => {
                        setIsActive(false);
                        setText("");
                    }
                });

            return () => {
                if (timelineRef.current) {
                    timelineRef.current.pause();
                    timelineRef.current = null;
                }
            };
        }, [isActive, lettersHtml]);

        if (!isActive) return null;

        return ReactDOM.createPortal(
            <div
                ref={containerRef}
                className="ml11 position-fixed top-50 start-50 translate-middle w-100 text-center"
                style={{ zIndex: 3000, pointerEvents: 'none', opacity: 1 }}
            >
                <h1
                    className="text-wrapper text-white"
                    style={{ fontWeight: 900, fontSize: '3.5em', textTransform: 'uppercase', letterSpacing: '0.5em', textShadow: '0 0 20px rgba(255,193,7,0.5)' }}
                >
                    <span
                        className="line line1"
                        style={{ opacity: 0, position: 'absolute', left: 0, height: '100%', width: '3px', backgroundColor: '#ffc107', transformOrigin: '0 50%', top: 0 }}
                    ></span>
                    <span ref={lettersRef} className="letters" dangerouslySetInnerHTML={{ __html: lettersHtml }}></span>
                </h1>
            </div>,
            document.body
        );
    };
})();
