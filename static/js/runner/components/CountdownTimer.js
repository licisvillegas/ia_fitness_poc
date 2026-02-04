(function () {
    const { useEffect, useMemo, useRef, useState } = React;

    window.Runner.components.CountdownTimer = ({ variant = 'pill' }) => {
        const [isOpen, setIsOpen] = useState(false);
        const [mode, setMode] = useState('timer');
        const [minutes, setMinutes] = useState(1);
        const [seconds, setSeconds] = useState(0);
        const [tempoEccentric, setTempoEccentric] = useState(4);
        const [tempoHoldBottom, setTempoHoldBottom] = useState(1);
        const [tempoConcentric, setTempoConcentric] = useState(1);
        const [tempoHoldTop, setTempoHoldTop] = useState(1);
        const [tempoText, setTempoText] = useState('4.1.1.1');
        const [tempoBeepEnabled, setTempoBeepEnabled] = useState(() => {
            try {
                const stored = localStorage.getItem('runner_tempo_beep');
                if (stored === null) return true;
                return stored === 'true';
            } catch (e) {
                return true;
            }
        });
        const modalRef = useRef(null);
        const modalInstanceRef = useRef(null);

        const totalSeconds = useMemo(() => {
            const mins = Number(minutes) || 0;
            const secs = Number(seconds) || 0;
            return (mins * 60) + secs;
        }, [minutes, seconds]);

        const formatClock = (total) => {
            const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
            const mins = Math.floor(safeTotal / 60);
            const secs = safeTotal % 60;
            return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        };

        useEffect(() => {
            const modalEl = modalRef.current;
            if (!modalEl || !window.bootstrap || !window.bootstrap.Modal) return;

            modalInstanceRef.current = bootstrap.Modal.getOrCreateInstance(modalEl, {
                backdrop: 'static',
                keyboard: false
            });

            const handleHidden = () => setIsOpen(false);
            modalEl.addEventListener('hidden.bs.modal', handleHidden);

            return () => {
                modalEl.removeEventListener('hidden.bs.modal', handleHidden);
                if (modalInstanceRef.current) {
                    modalInstanceRef.current.dispose();
                    modalInstanceRef.current = null;
                }
            };
        }, []);

        useEffect(() => {
            if (!modalInstanceRef.current) return;
            if (isOpen) {
                try {
                    const stored = localStorage.getItem('runner_tempo_beep');
                    if (stored !== null) {
                        setTempoBeepEnabled(stored === 'true');
                    }
                } catch (e) {
                    // ignore
                }
                modalInstanceRef.current.show();
            } else {
                modalInstanceRef.current.hide();
            }
        }, [isOpen]);

        const openModal = () => setIsOpen(true);

        const closeModal = () => {
            if (modalInstanceRef.current) modalInstanceRef.current.hide();
            setIsOpen(false);
        };

        const clampNumber = (value, max) => {
            const parsed = Math.max(0, parseInt(value, 10) || 0);
            if (typeof max === 'number') return Math.min(max, parsed);
            return parsed;
        };

        const adjustValue = (current, delta, max) => clampNumber((Number(current) || 0) + delta, max);

        const applyPreset = (mins, secs) => {
            setMinutes(clampNumber(mins));
            setSeconds(clampNumber(secs, 59));
        };

        const parseTempoText = (value) => {
            const cleaned = String(value || '').trim();
            if (!cleaned) return null;
            const parts = cleaned.split('.').map(p => Math.max(0, parseInt(p, 10) || 0));
            if (parts.length === 3) {
                return { ecc: parts[0], holdBottom: parts[1], conc: parts[2], holdTop: 0 };
            }
            if (parts.length === 4) {
                return { ecc: parts[0], holdBottom: parts[1], conc: parts[2], holdTop: parts[3] };
            }
            return null;
        };

        const syncTempoFromText = (value) => {
            setTempoText(value);
            const parsed = parseTempoText(value);
            if (!parsed) return;
            setTempoEccentric(parsed.ecc);
            setTempoHoldBottom(parsed.holdBottom);
            setTempoConcentric(parsed.conc);
            setTempoHoldTop(parsed.holdTop);
        };

        const updateTempoText = (nextEcc, nextHoldBottom, nextConc, nextHoldTop) => {
            setTempoText(`${nextEcc}.${nextHoldBottom}.${nextConc}.${nextHoldTop}`);
        };

        const handleStart = () => {
            const overlays = window.Runner?.overlays;
            if (!overlays) return;

            if (mode === 'tempo') {
                const ecc = clampNumber(tempoEccentric);
                const holdBottom = clampNumber(tempoHoldBottom);
                const conc = clampNumber(tempoConcentric);
                const holdTop = clampNumber(tempoHoldTop);
                if ((ecc + holdBottom + conc + holdTop) <= 0) return;
                closeModal();
                if (window.WorkoutAnimations && typeof window.WorkoutAnimations.zenEffect === 'function') {
                    window.WorkoutAnimations.zenEffect();
                }
                if (typeof overlays.showTempoGuide === 'function') {
                    overlays.showTempoGuide({ ecc, holdBottom, conc, holdTop, beep: tempoBeepEnabled });
                }
                return;
            }

            if (totalSeconds <= 0) return;
            closeModal();

            if (window.WorkoutAnimations && typeof window.WorkoutAnimations.zenEffect === 'function') {
                window.WorkoutAnimations.zenEffect();
            }

            if (typeof overlays.showCountdown !== 'function') return;

            overlays.showCountdown(() => {
                if (typeof overlays.showEnduranceTimer === 'function') {
                    overlays.showEnduranceTimer(totalSeconds);
                }
            });
        };

        const isIcon = variant === 'icon';

        return (
            <>
                <button
                    type="button"
                    className={isIcon ? "btn btn-sm btn-outline-warning rounded-circle" : "btn btn-sm btn-outline-warning rounded-pill px-3 py-0"}
                    style={isIcon ? { width: '32px', height: '32px', padding: 0 } : { fontSize: '0.75rem' }}
                    onClick={openModal}
                    title="Configurar temporizador"
                >
                    <i className={`fas fa-stopwatch ${isIcon ? '' : 'me-1'}`}></i>
                    {!isIcon && ' Timer'}
                </button>

                {ReactDOM.createPortal(
                    <div className="modal fade" tabIndex="-1" ref={modalRef} data-bs-backdrop="static" data-bs-keyboard="false">
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content bg-dark text-white border-secondary runner-timer-modal">
                                <div className="modal-header border-secondary">
                                    <h5 className="modal-title">Temporizador</h5>
                                    <button
                                        type="button"
                                        className="btn-close btn-close-white"
                                        onClick={closeModal}
                                        aria-label="Close"
                                    ></button>
                                </div>
                                <div className="modal-body">
                                    <div className="btn-group w-100 mb-3" role="group">
                                        <button
                                            type="button"
                                            className={`btn btn-sm ${mode === 'timer' ? 'btn-info text-dark' : 'btn-outline-info'}`}
                                            onClick={() => setMode('timer')}
                                        >
                                            Temporizador
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-sm ${mode === 'tempo' ? 'btn-info text-dark' : 'btn-outline-info'}`}
                                            onClick={() => setMode('tempo')}
                                        >
                                            Tempo
                                        </button>
                                    </div>

                                    {mode === 'timer' ? (
                                        <>
                                            <div className="d-flex flex-wrap gap-2 mb-3">
                                                <button type="button" className="btn btn-sm btn-outline-info rounded-pill" onClick={() => applyPreset(0, 30)}>
                                                    00:30
                                                </button>
                                                <button type="button" className="btn btn-sm btn-outline-info rounded-pill" onClick={() => applyPreset(1, 0)}>
                                                    01:00
                                                </button>
                                                <button type="button" className="btn btn-sm btn-outline-info rounded-pill" onClick={() => applyPreset(2, 0)}>
                                                    02:00
                                                </button>
                                                <button type="button" className="btn btn-sm btn-outline-info rounded-pill" onClick={() => applyPreset(3, 0)}>
                                                    03:00
                                                </button>
                                            </div>

                                            <div className="row g-3">
                                                <div className="col-12 col-md-6">
                                                    <label className="form-label text-secondary">Minutos</label>
                                                    <div className="input-group">
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => setMinutes(adjustValue(minutes, -1))}
                                                            aria-label="Reducir minutos"
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            inputMode="numeric"
                                                            className="form-control bg-dark text-white border-secondary text-center"
                                                            value={minutes}
                                                            onChange={(e) => setMinutes(clampNumber(e.target.value))}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => setMinutes(adjustValue(minutes, 1))}
                                                            aria-label="Aumentar minutos"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="col-12 col-md-6">
                                                    <label className="form-label text-secondary">Segundos</label>
                                                    <div className="input-group">
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => setSeconds(adjustValue(seconds, -5, 59))}
                                                            aria-label="Reducir segundos"
                                                        >
                                                            -5
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="59"
                                                            step="1"
                                                            inputMode="numeric"
                                                            className="form-control bg-dark text-white border-secondary text-center"
                                                            value={seconds}
                                                            onChange={(e) => setSeconds(clampNumber(e.target.value, 59))}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => setSeconds(adjustValue(seconds, 5, 59))}
                                                            aria-label="Aumentar segundos"
                                                        >
                                                            +5
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-secondary small mt-3">
                                                Duracion total: <span className="text-white fw-bold">{formatClock(totalSeconds)}</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="mb-3">
                                                <label className="form-label text-secondary">Tempo (formato 4.1.1.1)</label>
                                                <input
                                                    type="text"
                                                    className="form-control bg-dark text-white border-secondary text-center"
                                                    value={tempoText}
                                                    onChange={(e) => syncTempoFromText(e.target.value)}
                                                />
                                            </div>

                                            <div className="row g-3">
                                                <div className="col-6 col-md-3">
                                                    <label className="form-label text-secondary">Excentrico</label>
                                                    <div className="input-group input-group-sm">
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => {
                                                                const next = adjustValue(tempoEccentric, -1);
                                                                setTempoEccentric(next);
                                                                updateTempoText(next, tempoHoldBottom, tempoConcentric, tempoHoldTop);
                                                            }}
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            inputMode="numeric"
                                                            className="form-control bg-dark text-white border-secondary text-center"
                                                            value={tempoEccentric}
                                                            onChange={(e) => {
                                                                const next = clampNumber(e.target.value);
                                                                setTempoEccentric(next);
                                                                updateTempoText(next, tempoHoldBottom, tempoConcentric, tempoHoldTop);
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => {
                                                                const next = adjustValue(tempoEccentric, 1);
                                                                setTempoEccentric(next);
                                                                updateTempoText(next, tempoHoldBottom, tempoConcentric, tempoHoldTop);
                                                            }}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="col-6 col-md-3">
                                                    <label className="form-label text-secondary">Pausa abajo</label>
                                                    <div className="input-group input-group-sm">
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => {
                                                                const next = adjustValue(tempoHoldBottom, -1);
                                                                setTempoHoldBottom(next);
                                                                updateTempoText(tempoEccentric, next, tempoConcentric, tempoHoldTop);
                                                            }}
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            inputMode="numeric"
                                                            className="form-control bg-dark text-white border-secondary text-center"
                                                            value={tempoHoldBottom}
                                                            onChange={(e) => {
                                                                const next = clampNumber(e.target.value);
                                                                setTempoHoldBottom(next);
                                                                updateTempoText(tempoEccentric, next, tempoConcentric, tempoHoldTop);
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => {
                                                                const next = adjustValue(tempoHoldBottom, 1);
                                                                setTempoHoldBottom(next);
                                                                updateTempoText(tempoEccentric, next, tempoConcentric, tempoHoldTop);
                                                            }}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="col-6 col-md-3">
                                                    <label className="form-label text-secondary">Concentrico</label>
                                                    <div className="input-group input-group-sm">
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => {
                                                                const next = adjustValue(tempoConcentric, -1);
                                                                setTempoConcentric(next);
                                                                updateTempoText(tempoEccentric, tempoHoldBottom, next, tempoHoldTop);
                                                            }}
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            inputMode="numeric"
                                                            className="form-control bg-dark text-white border-secondary text-center"
                                                            value={tempoConcentric}
                                                            onChange={(e) => {
                                                                const next = clampNumber(e.target.value);
                                                                setTempoConcentric(next);
                                                                updateTempoText(tempoEccentric, tempoHoldBottom, next, tempoHoldTop);
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => {
                                                                const next = adjustValue(tempoConcentric, 1);
                                                                setTempoConcentric(next);
                                                                updateTempoText(tempoEccentric, tempoHoldBottom, next, tempoHoldTop);
                                                            }}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="col-6 col-md-3">
                                                    <label className="form-label text-secondary">Pausa arriba</label>
                                                    <div className="input-group input-group-sm">
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => {
                                                                const next = adjustValue(tempoHoldTop, -1);
                                                                setTempoHoldTop(next);
                                                                updateTempoText(tempoEccentric, tempoHoldBottom, tempoConcentric, next);
                                                            }}
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            inputMode="numeric"
                                                            className="form-control bg-dark text-white border-secondary text-center"
                                                            value={tempoHoldTop}
                                                            onChange={(e) => {
                                                                const next = clampNumber(e.target.value);
                                                                setTempoHoldTop(next);
                                                                updateTempoText(tempoEccentric, tempoHoldBottom, tempoConcentric, next);
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-secondary"
                                                            onClick={() => {
                                                                const next = adjustValue(tempoHoldTop, 1);
                                                                setTempoHoldTop(next);
                                                                updateTempoText(tempoEccentric, tempoHoldBottom, tempoConcentric, next);
                                                            }}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="d-flex align-items-center justify-content-between mt-3">
                                                <div className="text-secondary small">
                                                    Tempo activo: <span className="text-white fw-bold">{tempoEccentric}.{tempoHoldBottom}.{tempoConcentric}.{tempoHoldTop}</span>
                                                </div>
                                                <div className="form-check form-switch m-0">
                                                    <input
                                                        className="form-check-input"
                                                        type="checkbox"
                                                        checked={tempoBeepEnabled}
                                                        onChange={(e) => {
                                                            const next = e.target.checked;
                                                            setTempoBeepEnabled(next);
                                                            try {
                                                                localStorage.setItem('runner_tempo_beep', String(next));
                                                            } catch (err) {
                                                                // ignore
                                                            }
                                                        }}
                                                        id="tempoBeepToggle"
                                                    />
                                                    <label className="form-check-label text-secondary small" htmlFor="tempoBeepToggle">
                                                        Beep
                                                    </label>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="modal-footer border-secondary">
                                    <button type="button" className="btn btn-outline-secondary" onClick={closeModal}>
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-warning text-dark fw-bold"
                                        onClick={handleStart}
                                        disabled={mode === 'timer' ? totalSeconds <= 0 : (tempoEccentric + tempoHoldBottom + tempoConcentric + tempoHoldTop) <= 0}
                                    >
                                        {mode === 'timer' ? 'Start' : 'Iniciar tempo'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </>
        );
    };
})();
