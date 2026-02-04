(function () {
    const { useEffect, useRef, useState } = React;
    const { useOverlayRegistration } = window.Runner.hooks;
    const { getAudio } = window.Runner.utils;

    window.Runner.components.TempoOverlay = () => {
        const [isActive, setIsActive] = useState(false);
        const [phaseLabel, setPhaseLabel] = useState('');
        const [phaseColor, setPhaseColor] = useState('#ffffff');
        const [remaining, setRemaining] = useState(0);
        const [tempoLabel, setTempoLabel] = useState('');
        const [beepEnabled, setBeepEnabled] = useState(true);
        const phasesRef = useRef([]);
        const phaseIndexRef = useRef(0);
        const intervalRef = useRef(null);
        const onCloseRef = useRef(null);

        const formatClock = (total) => {
            const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
            const mins = Math.floor(safeTotal / 60);
            const secs = safeTotal % 60;
            return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        };

        const stopLoop = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };

        const cleanup = () => {
            stopLoop();
            setIsActive(false);
        };

        const playBeep = () => {
            if (!beepEnabled) return;
            try {
                const audio = getAudio();
                if (audio && audio.play) {
                    audio.currentTime = 0;
                    audio.play();
                }
            } catch (e) {
                // ignore
            }
        };

        const startPhase = (phase) => {
            setPhaseLabel(phase.label);
            setPhaseColor(phase.color);
            setRemaining(phase.duration);
            playBeep();
        };

        const advancePhase = () => {
            if (!phasesRef.current.length) return;
            phaseIndexRef.current = (phaseIndexRef.current + 1) % phasesRef.current.length;
            startPhase(phasesRef.current[phaseIndexRef.current]);
        };

        const startLoop = () => {
            if (!phasesRef.current.length) return;
            phaseIndexRef.current = 0;
            startPhase(phasesRef.current[0]);

            intervalRef.current = setInterval(() => {
                setRemaining(prev => {
                    const next = Math.max(0, prev - 1);
                    if (next === 0) {
                        advancePhase();
                        return phasesRef.current[phaseIndexRef.current].duration;
                    }
                    return next;
                });
            }, 1000);
        };

        useOverlayRegistration('showTempoGuide', (tempo, onClose) => {
            const ecc = Math.max(0, Math.floor(Number(tempo?.ecc) || 0));
            const holdBottom = Math.max(0, Math.floor(Number(tempo?.holdBottom) || 0));
            const conc = Math.max(0, Math.floor(Number(tempo?.conc) || 0));
            const holdTop = Math.max(0, Math.floor(Number(tempo?.holdTop) || 0));
            const nextBeep = tempo?.beep !== false;

            const phases = [
                { key: 'ecc', label: 'EXCENTRICO', color: '#dc3545', duration: ecc },
                { key: 'hold_bottom', label: 'PAUSA', color: '#ffc107', duration: holdBottom },
                { key: 'conc', label: 'CONCENTRICO', color: '#28a745', duration: conc },
                { key: 'hold_top', label: 'PAUSA', color: '#17a2b8', duration: holdTop }
            ].filter(phase => phase.duration > 0);

            if (!phases.length) return;

            phasesRef.current = phases;
            setTempoLabel([ecc, holdBottom, conc, holdTop].join('-'));
            setBeepEnabled(nextBeep);
            onCloseRef.current = typeof onClose === 'function' ? onClose : null;
            setIsActive(true);

            return () => cleanup();
        });

        useEffect(() => {
            if (!isActive) return;
            startLoop();
            return () => stopLoop();
        }, [isActive]);

        if (!isActive) return null;

        const handleClose = () => {
            if (onCloseRef.current) onCloseRef.current();
            onCloseRef.current = null;
            cleanup();
        };

        return ReactDOM.createPortal(
            <div
                className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center"
                style={{
                    zIndex: 3000,
                    background: 'radial-gradient(circle, rgba(45, 52, 54, 0.75) 0%, rgba(0, 0, 0, 0.9) 100%)',
                    pointerEvents: 'auto'
                }}
            >
                <div className="text-uppercase fw-bold mb-2" style={{ color: phaseColor, fontSize: '1.2rem' }}>
                    {phaseLabel}
                </div>
                <div className="display-3 fw-bold text-white" style={{ textShadow: '0 0 12px rgba(0,0,0,0.6)' }}>
                    {formatClock(remaining)}
                </div>
                <div className="text-secondary mt-2" style={{ letterSpacing: '0.12em' }}>
                    {tempoLabel}
                </div>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-light rounded-pill position-absolute bottom-0 start-50 translate-middle-x mb-4 px-4"
                    onClick={handleClose}
                    title="Cerrar tempo"
                >
                    Cerrar
                </button>
            </div>,
            document.body
        );
    };
})();
