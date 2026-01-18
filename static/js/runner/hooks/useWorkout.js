(function () {
    const { createContext, useState, useEffect, useRef, useMemo, useContext } = React;
    const { formatTime, getAudio, triggerHaptic, getReturnUrl } = window.Runner.utils;
    const { BODY_PART_MAP } = window.Runner.constants;
    const { getExerciseId, mergeExerciseForSwap, getRestSeconds, buildQueue } = window.Runner.logic;

    const WorkoutContext = createContext();

    window.Runner.hooks.WorkoutProvider = ({ children, routine }) => {
        const [queue, setQueue] = useState([]);
        const [cursor, setCursor] = useState(0); // Index in Queue
        const [status, setStatus] = useState('LOADING'); // LOADING | IDLE | WORK | REST | FINISHED
        const [sessionLog, setSessionLog] = useState([]);
        const [historyMaxByExercise, setHistoryMaxByExercise] = useState({});
        const [exerciseLookup, setExerciseLookup] = useState({});
        const [isPaused, setIsPaused] = useState(false);
        const [message, setMessage] = useState(null);
        const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: "", message: "", onConfirm: null, onCancel: null, type: "danger" }); // type: danger | warning | info
        const [substituteModal, setSubstituteModal] = useState({ isOpen: false, stepIndex: null });
        const [showCompletionIcon, setShowCompletionIcon] = useState(false);
        const [showCountdown, setShowCountdown] = useState(false);
        const [countdownValue, setCountdownValue] = useState(3);
        const [unit, setUnit] = useState('lb');
        const [notificationPermission, setNotificationPermission] = useState('default'); // default, granted, denied
        const [showPending, setShowPending] = useState(false); // New state lifted from App.js


        // Timers
        const [globalTime, setGlobalTime] = useState(0);
        const [stepTimer, setStepTimer] = useState(0); // For Rest or Time-based work
        const [isTimerRunning, setIsTimerRunning] = useState(false);

        // Refs for Interval
        const stepIntervalRef = useRef(null);
        const resumeTimerRef = useRef(false);
        const onConfirmRef = useRef(null);
        const queueRef = useRef([]);
        const sessionLogRef = useRef([]); // Fix for stale closure
        const startTimeRef = useRef(Date.now()); // Track start time of current step
        const visibilitySnapshotRef = useRef(null);
        const completeStepTimerRef = useRef(null);
        const statusRef = useRef(status);
        const isPausedRef = useRef(isPaused);
        const isTimerRunningRef = useRef(isTimerRunning);
        const stepTimerRef = useRef(stepTimer);
        const globalTimeRef = useRef(globalTime);
        const currentStepRef = useRef(null);
        const onCancelRef = useRef(null); // Add ref for onCancel

        // Notification Logic
        const requestNotificationPermission = async () => {
            if (!("Notification" in window)) return;
            try {
                const permission = await Notification.requestPermission();
                setNotificationPermission(permission);
            } catch (e) {
                console.error("Notification permission error", e);
            }
        };

        const sendNotification = (title, body) => {
            if (notificationPermission === 'granted' && document.visibilityState === 'hidden') {
                try {
                    new Notification(title, { body, icon: '/static/icons/icon-192x192.png' });
                } catch (e) {
                    console.error("Notification error", e);
                }
            }
        };

        useEffect(() => {
            if ("Notification" in window) {
                setNotificationPermission(Notification.permission);
            }
        }, []);


        // INITIALIZE
        useEffect(() => {
            if (routine) {
                const q = buildQueue(routine);
                setQueue(q);
                setStatus('IDLE');

                // Hydrate from restored state
                // Assumes RESTORED_STATE is a global variable from the Jinja template
                if (window.RESTORED_STATE && window.RESTORED_STATE.routine_id === routine.id) {
                    console.log("RESTORING STATE:", window.RESTORED_STATE);
                    if (window.RESTORED_STATE.cursor > 0 && window.RESTORED_STATE.cursor < q.length) {
                        setCursor(window.RESTORED_STATE.cursor);

                        // AUTO-RESUME: Set status to WORK and ensure timer logic runs
                        // We check the upcoming step type to decide WORK vs REST
                        const resumeStep = q[window.RESTORED_STATE.cursor];
                        if (resumeStep) {
                            if (resumeStep.type === 'rest') {
                                setStatus('REST');
                                setStepTimer(resumeStep.duration); // Reset timer to full duration? Or should we save timer state? 
                                // User asked "resume where leftover", assuming step is enough.
                                setIsTimerRunning(true);
                            } else {
                                setStatus('WORK');
                                setStepTimer(resumeStep.isTimeBased ? resumeStep.target.time : 0);
                                setIsTimerRunning(resumeStep.isTimeBased);
                            }
                        }
                    }
                    if (window.RESTORED_STATE.session_log) {
                        setSessionLog(window.RESTORED_STATE.session_log);
                        sessionLogRef.current = window.RESTORED_STATE.session_log;
                    }
                }

                console.log("Queue Built:", q);
                queueRef.current = q; // Update ref
            }
        }, [routine]);

        // Reset start time when step changes
        useEffect(() => {
            startTimeRef.current = Date.now();
        }, [cursor]); // Reset on cursor change

        useEffect(() => {
            let isMounted = true;
            const loadExercises = async () => {
                try {
                    const res = await fetch("/workout/api/exercises");
                    if (!res.ok) return;
                    const data = await res.json();
                    if (!isMounted || !Array.isArray(data)) return;
                    const lookup = data.reduce((acc, ex) => {
                        if (ex && ex._id) acc[ex._id] = ex;
                        if (ex && ex.exercise_id) acc[String(ex.exercise_id)] = ex;
                        return acc;
                    }, {});
                    setExerciseLookup(lookup);
                } catch (e) { console.error("Error loading exercises", e); }
            };

            const loadBodyParts = async () => {
                try {
                    const res = await fetch("/workout/api/body-parts");
                    const parts = await res.json();
                    if (parts && Array.isArray(parts)) {
                        parts.forEach(p => {
                            if (BODY_PART_MAP) BODY_PART_MAP[p.key] = p.label_es || p.label_en || p.key;
                        });
                    }
                    setExerciseLookup(prev => ({ ...prev }));
                } catch (e) { console.error("Error loading body parts", e); }
            };

            const init = async () => {
                if (window.showLoader) window.showLoader("Cargando motor...");
                try {
                    await Promise.all([loadExercises(), loadBodyParts()]);
                } finally {
                    if (window.hideLoader) window.hideLoader();
                }
            };

            init();

            return () => { isMounted = false; };
        }, []);

        useEffect(() => {
            let isMounted = true;
            const routineId = routine?.id || routine?._id;
            // currentUserId is a global variable from Jinja (see workout_runner.html)
            const userId = window.currentUserId || window.CURRENT_USER_ID;
            if (!userId || !routineId) return;

            const loadHistoryMax = async () => {
                if (window.showLoader) window.showLoader("Sincronizando historial...");
                try {
                    const res = await fetch(`/workout/api/sessions?user_id=${encodeURIComponent(userId)}&limit=50`);
                    if (!res.ok) return;
                    const sessions = await res.json();
                    if (!isMounted || !Array.isArray(sessions)) return;

                    const maxByExercise = {};
                    // Find the LAST (most recent) session for this routine
                    const lastSession = sessions.find(s => s && s.routine_id === routineId);

                    if (lastSession) {
                        const sets = Array.isArray(lastSession.sets) ? lastSession.sets : [];
                        sets.forEach(set => {
                            const exId = set.exerciseId || set.exercise_id;
                            if (!exId) return;
                            const weightVal = parseFloat(set.weight);
                            if (!Number.isFinite(weightVal) || weightVal <= 0) return;

                            // We take the max weight performed in THAT session for the exercise
                            // (e.g. if they did 3 sets: 100, 110, 105, we take 110)
                            if (maxByExercise[exId] == null || weightVal > maxByExercise[exId].weight) {
                                maxByExercise[exId] = { weight: weightVal, reps: set.reps || 0 };
                            }
                        });
                    }

                    setHistoryMaxByExercise(maxByExercise);
                } catch (e) {
                    console.error("Error loading session history", e);
                } finally {
                    if (window.hideLoader) window.hideLoader();
                }
            };

            loadHistoryMax();
            return () => { isMounted = false; };
        }, [routine]);

        // Wake Lock Implementation - Robust & Status Aware
        const isActive = status === 'WORK' || status === 'REST';

        useEffect(() => {
            let wakeLock = null;

            const requestLock = async () => {
                if (!isActive) return;
                // Only request if visible
                if (document.visibilityState !== 'visible') return;

                try {
                    if ('wakeLock' in navigator) {
                        try {
                            wakeLock = await navigator.wakeLock.request('screen');
                            console.log('Pantalla activa: Wake Lock adquirido');
                            wakeLock.addEventListener('release', () => {
                                console.log('Pantalla normal: Wake Lock liberado');
                            });
                        } catch (e) {
                            console.log("Wake Lock request failed", e);
                        }
                    } else {
                        console.warn('Este navegador no soporta Wake Lock API');
                    }
                } catch (err) {
                    console.error(`Wake Lock Error: ${err.name}, ${err.message}`);
                }
            };

            const releaseLock = async () => {
                if (wakeLock !== null) {
                    try {
                        await wakeLock.release();
                        wakeLock = null;
                    } catch (e) {
                        console.log("Wake Lock release error (ignore)", e);
                    }
                }
            };

            const handleVisibilityChange = () => {
                // If we come back to visible and we ARE active, re-request
                if (document.visibilityState === 'visible' && isActive) {
                    requestLock();
                }
            };

            if (isActive) {
                requestLock();
                document.addEventListener('visibilitychange', handleVisibilityChange);
            } else {
                releaseLock();
            }

            return () => {
                releaseLock();
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            };
        }, [isActive]);


        // Global Timer (only when actively working or resting)
        useEffect(() => {
            if (status !== 'WORK' && status !== 'REST' || isPaused) return;
            const int = setInterval(() => setGlobalTime(t => t + 1), 1000);
            return () => clearInterval(int);
        }, [status, isPaused]);

        // Step Timer Logic (Countdown)
        useEffect(() => {
            if (isPaused) {
                clearInterval(stepIntervalRef.current);
                return;
            }
            if (isTimerRunning && stepTimer > 0) {
                stepIntervalRef.current = setInterval(() => {
                    setStepTimer(prev => {
                        if (prev <= 1) {
                            // TIMER DONE
                            playAlarm();
                            triggerHaptic([200, 100, 200, 100, 500]); // Strong vibration pattern
                            sendNotification("Tiempo Completado", "Tu descanso ha terminado. ¡A trabajar!");
                            setIsTimerRunning(false);
                            completeStepTimer(); // Auto-advance logic
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
            } else {
                clearInterval(stepIntervalRef.current);
            }
            return () => clearInterval(stepIntervalRef.current);
        }, [isTimerRunning, stepTimer, isPaused]);

        const playAlarm = () => {
            try {
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                getAudio().play().catch(e => console.log("Audio permission needed"));
            } catch (e) { }
        }

        const currentStep = useMemo(() => queue[cursor], [queue, cursor]);
        const nextStep = useMemo(() => queue[cursor + 1], [queue, cursor]);

        useEffect(() => { statusRef.current = status; }, [status]);
        useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
        useEffect(() => { isTimerRunningRef.current = isTimerRunning; }, [isTimerRunning]);
        useEffect(() => { stepTimerRef.current = stepTimer; }, [stepTimer]);
        useEffect(() => { globalTimeRef.current = globalTime; }, [globalTime]);
        useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);

        // Auto-advance logic when timer hits 0
        const completeStepTimer = () => {
            if (currentStep.type === 'rest') {
                next(); // Auto-skip rest when done
            } else {
                // For Work (Time based), we ensure it is logged
                const alreadyLogged = sessionLog.some(l => l.stepId === currentStep.id);
                if (!alreadyLogged) {
                    logSet({
                        time_seconds: currentStep.target.time,
                        weight: 0,
                        reps: 0
                    });
                }
                next();
            }
        };

        useEffect(() => {
            completeStepTimerRef.current = completeStepTimer;
        }, [completeStepTimer]);

        useEffect(() => {
            const handleVisibilityChange = () => {
                if (document.visibilityState === 'hidden') {
                    visibilitySnapshotRef.current = {
                        hiddenAt: Date.now(),
                        status: statusRef.current,
                        isPaused: isPausedRef.current,
                        isTimerRunning: isTimerRunningRef.current,
                        stepTimer: stepTimerRef.current,
                        globalTime: globalTimeRef.current
                    };
                    return;
                }
                if (document.visibilityState !== 'visible') return;
                const snap = visibilitySnapshotRef.current;
                visibilitySnapshotRef.current = null;
                if (!snap || snap.isPaused) return;
                if (snap.status !== 'WORK' && snap.status !== 'REST') return;

                const deltaSec = Math.floor((Date.now() - snap.hiddenAt) / 1000);
                if (deltaSec <= 0) return;

                setGlobalTime(current => Math.max(current, snap.globalTime + deltaSec));

                if (snap.isTimerRunning && snap.stepTimer > 0) {
                    const nextTimer = Math.max(0, snap.stepTimer - deltaSec);
                    if (nextTimer <= 0) {
                        setStepTimer(0);
                        setIsTimerRunning(false);
                        if (completeStepTimerRef.current) {
                            completeStepTimerRef.current();
                        }
                    } else {
                        setStepTimer(prev => Math.min(prev, nextTimer));
                    }
                }
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);
            return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
        }, []);

        const logSet = (data) => {
            const step = currentStep;
            logSpecificStep(step, data, true);
        };

        const logSpecificStep = (step, data, isMeasured = false) => {
            triggerHaptic(50); // Haptic feedback on log
            if (!step || !step.exercise) return;
            const exerciseId = step.exercise.exercise_id || step.exercise._id || step.exercise.id;
            const exerciseName = step.exercise.exercise_name || step.exercise.name;
            const exerciseType = step.exercise.exercise_type || step.exercise.type;

            // Normalize weight to KG for database
            let finalWeight = parseFloat(data.weight) || 0;
            const dataUnit = data.unit || unit;
            if (dataUnit === 'lb') {
                finalWeight = finalWeight / 2.20462;
            }

            const resolvedTime = data.time_seconds != null
                ? data.time_seconds
                : (step.isTimeBased ? step.target?.time : null);

            const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;

            // Avoid duplicates for same stepId
            if (currentLog.some(l => l.stepId === step.id)) return;

            const newLog = [...currentLog, {
                stepId: step.id,
                exerciseId,
                exercise_id: exerciseId,
                name: exerciseName,
                exercise_type: exerciseType,
                weight: finalWeight.toFixed(1),
                reps: data.reps || 0,
                rpe: data.rpe || 8,
                duration_seconds: isMeasured ? (Date.now() - startTimeRef.current) / 1000 : 0,
                ...(resolvedTime != null ? { time_seconds: resolvedTime } : {}),
                timestamp: new Date()
            }];

            setSessionLog(newLog);
            sessionLogRef.current = newLog;
            syncProgress(cursor, newLog);
        };

        const updateLoggedStep = (stepId, data) => {
            if (!stepId) return;
            const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
            const idx = currentLog.findIndex(l => l.stepId === stepId);
            if (idx === -1) return;

            // Round to nearest 0.5 for internal consistency if passed from quick log
            let finalWeight = parseFloat(data.weight) || 0;
            const dataUnit = data.unit || unit;
            if (dataUnit === 'lb') {
                finalWeight = finalWeight / 2.20462;
            }

            const updatedEntry = {
                ...currentLog[idx],
                weight: finalWeight.toFixed(1),
                reps: data.reps != null ? data.reps : currentLog[idx].reps,
                timestamp: new Date()
            };

            const newLog = [...currentLog];
            newLog[idx] = updatedEntry;
            setSessionLog(newLog);
            sessionLogRef.current = newLog;
            syncProgress(cursor, newLog);
        };

        const removeLoggedStep = (stepId) => {
            if (!stepId) return;
            const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
            const newLog = currentLog.filter(l => l.stepId !== stepId);
            if (newLog.length === currentLog.length) return;

            setSessionLog(newLog);
            sessionLogRef.current = newLog;
            syncProgress(cursor, newLog);
        };

        const syncProgress = async (idx, log) => {
            try {
                await fetch("/workout/api/session/progress", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        routine_id: routine.id,
                        cursor: idx,
                        session_log: log || sessionLogRef.current
                    })
                });
            } catch (e) { console.error("Sync error", e); }
        };

        const isStepLogged = (stepId, log) => {
            const currentLog = log || (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
            return currentLog.some(l => l.stepId === stepId);
        };

        const next = () => {
            console.log("DEBUG: Next called. Cursor:", cursor, "QueueLen:", queue.length);

            if (currentStep && currentStep.type === 'work') {
                const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
                if (!isStepLogged(currentStep.id, currentLog)) {
                    console.log("DEBUG: Auto-logging current step:", currentStep.id);
                    const fallbackTime = currentStep.isTimeBased ? currentStep.target.time : 0;
                    logSet({
                        time_seconds: fallbackTime,
                        weight: 0,
                        reps: 0
                    });
                }
            }

            if (cursor >= queue.length - 1) {
                if (status === 'REST') {
                    setStatus('WORK');
                    setTimeout(checkPendingAndFinish, 100);
                } else {
                    checkPendingAndFinish();
                }
                return;
            }

            let nextIdx = cursor + 1;
            const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;

            // Smart skip
            while (nextIdx < queue.length && (queue[nextIdx].type === 'work' && isStepLogged(queue[nextIdx].id, currentLog))) {
                console.log("DEBUG: Skipping step:", queue[nextIdx].id);
                nextIdx++;
            }

            if (nextIdx >= queue.length) {
                if (status === 'REST') setStatus('WORK');
                checkPendingAndFinish();
                return;
            }

            setCursor(nextIdx);
            setIsPaused(false);
            syncProgress(nextIdx, currentLog);

            const upcoming = queue[nextIdx];
            if (upcoming.type === 'rest') {
                setStatus('REST');
                setStepTimer(upcoming.duration);
                setIsTimerRunning(true);
            } else {
                setStatus('WORK');
                setStepTimer(upcoming.isTimeBased ? upcoming.target.time : 0);
                setIsTimerRunning(upcoming.isTimeBased);
            }
        };

        const skipToNextWork = () => {
            console.log("DEBUG: Skip to next work. Cursor:", cursor, "QueueLen:", queue.length);
            if (cursor >= queue.length - 1) {
                if (status === 'REST') {
                    setStatus('WORK');
                    setTimeout(checkPendingAndFinish, 100);
                } else {
                    checkPendingAndFinish();
                }
                return;
            }
            let nextIdx = cursor + 1;
            while (nextIdx < queue.length && queue[nextIdx].type === 'rest') {
                nextIdx += 1;
            }
            if (nextIdx >= queue.length) {
                if (status === 'REST') setStatus('WORK');
                checkPendingAndFinish();
                return;
            }
            const upcoming = queue[nextIdx];
            setCursor(nextIdx);
            setIsPaused(false);
            setStatus('WORK');
            setStepTimer(upcoming.isTimeBased ? upcoming.target.time : 0);
            setIsTimerRunning(upcoming.isTimeBased);
        };

        const deferExercise = () => {
            console.log("DEBUG: Deferring exercise requested. Cursor:", cursor);

            showConfirm(
                "Dejar Pendiente",
                "¿Quieres dejar este ejercicio para el final? No se registrará progreso ahora.",
                () => {
                    // Actual Defer Logic
                    console.log("DEBUG: Executing Defer");

                    // 1. Calculate next index
                    const nextIdx = cursor + 1;
                    if (nextIdx >= queue.length) {
                        if (status === 'REST') {
                            setStatus('WORK');
                            setTimeout(checkPendingAndFinish, 100);
                        } else {
                            checkPendingAndFinish();
                        }
                        return;
                    }

                    // 2. Move cursor
                    setCursor(nextIdx);
                    setIsPaused(false);

                    // 3. Determine if next step is rest or work
                    const upcoming = queue[nextIdx];
                    if (upcoming.type === 'rest') {
                        setStatus('REST');
                        setStepTimer(upcoming.duration);
                        setIsTimerRunning(true);
                    } else {
                        setStatus('WORK');
                        setStepTimer(upcoming.isTimeBased ? upcoming.target.time : 0);
                        setIsTimerRunning(upcoming.isTimeBased);
                    }

                    // 4. Sync progress (cursor updated, but no new log entry)
                    const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
                    syncProgress(nextIdx, currentLog);
                },
                "warning"
            );
        };

        const prev = () => {
            if (cursor <= 0) return;

            let idx = cursor - 1;
            const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;

            // Skip already logged steps when going back
            while (idx >= 0 && (queue[idx].type === 'rest' || (queue[idx].type === 'work' && isStepLogged(queue[idx].id, currentLog)))) {
                idx -= 1;
            }

            if (idx < 0) return;
            setCursor(idx);
            setIsTimerRunning(false);
            setIsPaused(false);
            const prevStep = queue[idx];
            setStatus('WORK');
            setStepTimer(prevStep.isTimeBased ? prevStep.target.time : 0);
        };

        const skipRest = () => {
            setIsTimerRunning(false);
            setIsPaused(false);
            showMessage("Descanso omitido", "info");
            next();
        };

        const addRestTime = (seconds) => {
            setStepTimer(t => {
                const nextValue = t + seconds;
                return Math.max(0, nextValue);
            });
        };

        const finishWorkout = async () => {
            if (status === 'FINISHED') return; // Prevent double trigger

            // 1. Show Icon
            setShowCompletionIcon(true);

            // Celebration Trigger
            triggerHaptic([100, 50, 100, 50, 200, 100, 500]);
            try {
                if (window.confetti) {
                    const count = 200;
                    const defaults = { origin: { y: 0.7 } };
                    function fire(particleRatio, opts) {
                        window.confetti(Object.assign({}, defaults, opts, {
                            particleCount: Math.floor(count * particleRatio),
                            zIndex: 10000
                        }));
                    }
                    fire(0.25, { spread: 26, startVelocity: 55 });
                    fire(0.2, { spread: 60 });
                    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
                    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
                    fire(0.1, { spread: 120, startVelocity: 45 });
                }
            } catch (e) {
                console.log("Confetti error", e);
            }

            // 2. Wait 2 seconds then show modal
            setTimeout(() => {
                setShowCompletionIcon(false);
                showConfirm("Finalizar Rutina", "¿Deseas guardar el entrenamiento completado?", async () => {
                    setStatus('FINISHED');
                    if (window.showLoader) window.showLoader("Guardando sesión...");
                    // Save logic
                    try {
                        const payload = {
                            routine_id: routine.id,
                            start_time: new Date(Date.now() - globalTime * 1000).toISOString(),
                            end_time: new Date().toISOString(),
                            sets: sessionLogRef.current // Use REF to ensure latest data
                        };

                        // Try online save first
                        try {
                            const res = await fetch("/workout/api/session/save", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(payload)
                            });
                            if (!res.ok) throw new Error("Server returned " + res.status);
                            window.location.href = getReturnUrl();
                        } catch (fetchError) {
                            console.warn("Online save failed, attempting local save...", fetchError);

                            if (window.offlineManager) {
                                await window.offlineManager.saveSession(payload);
                                if (window.showToast) {
                                    window.showToast("Sin conexión: Guardado localmente", "warning");
                                } else {
                                    alert("Sin conexión: Guardado localmente. Se sincronizará cuando recuperes la red.");
                                }
                                // Allow exit
                                setTimeout(() => {
                                    window.location.href = getReturnUrl();
                                }, 1500);
                            } else {
                                throw fetchError; // Re-throw if no offline manager
                            }
                        }

                    } catch (e) {
                        if (window.showAlertModal) {
                            window.showAlertModal("Error", "Error saving: " + e.message, "danger");
                        } else {
                            alert("Error saving: " + e.message);
                        }
                    } finally {
                        if (window.hideLoader) window.hideLoader();
                    }
                }, "success");
            }, 2000);
        };

        const cancelWorkout = () => {
            const doCancel = async () => {
                try {
                    await fetch("/workout/api/session/cancel", { method: "POST" });
                } catch (e) { console.error("Error cancelling:", e); }
                window.location.href = getReturnUrl();
            };

            if (status === 'IDLE') {
                doCancel();
                return;
            }
            showConfirm("Cancelar Rutina", "¿Estás seguro de que quieres salir? Se perderá el progreso actual.", () => {
                showMessage("Rutina cancelada", "error");
                doCancel();
            }, "danger");
        };

        const showMessage = (text, tone = "info") => {
            setMessage({ text, tone });
            setTimeout(() => setMessage(null), 3000);
        };

        const openSubstituteModal = (stepIndex = cursor) => {
            const step = queue[stepIndex];
            if (!step || step.type !== 'work') return;
            setSubstituteModal({ isOpen: true, stepIndex });
        };

        const closeSubstituteModal = () => {
            setSubstituteModal({ isOpen: false, stepIndex: null });
        };

        const applySubstitute = (subExercise, scope = "current", stepIndex = null) => {
            if (!subExercise) return;
            const targetIndex = stepIndex != null ? stepIndex : cursor;
            setQueue(prevQueue => {
                const targetStep = prevQueue[targetIndex];
                if (!targetStep || targetStep.type !== 'work') return prevQueue;
                const targetId = getExerciseId(targetStep.exercise);
                const replaceStep = (step) => ({
                    ...step,
                    exercise: mergeExerciseForSwap(step.exercise, subExercise)
                });

                return prevQueue.map((step, idx) => {
                    if (step.type !== 'work') return step;
                    if (scope === "current") {
                        return idx === targetIndex ? replaceStep(step) : step;
                    }
                    if (idx < targetIndex) return step;
                    const stepId = getExerciseId(step.exercise);
                    if (!targetId) {
                        return idx === targetIndex ? replaceStep(step) : step;
                    }
                    if (stepId && targetId && stepId === targetId) {
                        return replaceStep(step);
                    }
                    return step;
                });
            });
            showMessage("Sustituto aplicado", "success");
            closeSubstituteModal();
        };

        const togglePause = () => {
            if (status !== 'WORK' && status !== 'REST') return;
            if (!isPaused) {
                resumeTimerRef.current = isTimerRunning;
                setIsTimerRunning(false);
                setIsPaused(true);
                return;
            }
            setIsPaused(false);
            if (resumeTimerRef.current || status === 'REST') {
                setIsTimerRunning(true);
            }
        };

        const startWorkout = () => {
            if (!queue || queue.length === 0) return;

            console.log("Starting countdown...");
            setCountdownValue(3);
            setShowCountdown(true);

            // Fetch session start immediately to lock it
            fetch("/workout/api/session/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ routine_id: routine.id })
            }).catch(e => console.error("Start session error", e));

            const interval = setInterval(() => {
                setCountdownValue(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        setShowCountdown(false);

                        console.log("Countdown finished, starting workout...");
                        // Actual start logic
                        const step = queueRef.current[cursor]; // Use ref to avoid stale queue
                        setIsPaused(false);
                        if (step && step.type === 'rest') {
                            setStatus('REST');
                            setStepTimer(step.duration);
                            setIsTimerRunning(true);
                        } else if (step) {
                            setStatus('WORK');
                            setStepTimer(step.isTimeBased ? step.target.time : 0);
                            setIsTimerRunning(step.isTimeBased);
                        }
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        };

        const showConfirm = (title, message, onConfirm, type = "danger", onCancel = null) => {
            console.log("DEBUG: showConfirm called", { title });
            onConfirmRef.current = onConfirm;
            onCancelRef.current = onCancel;
            setConfirmModal({ isOpen: true, title, message, onConfirm, onCancel, type });
        };

        const closeConfirm = () => {
            // If implicit cancel (via X or Cancel button in UI which calls closeConfirm)
            if (onCancelRef.current) {
                onCancelRef.current();
            }
            onConfirmRef.current = null;
            onCancelRef.current = null;
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
        };

        const handleConfirmAction = () => {
            // Confirm action overrides cancel
            const action = onConfirmRef.current;

            // Clear refs so closeConfirm doesn't trigger cancel
            onConfirmRef.current = null;
            onCancelRef.current = null;

            if (action) action();

            setConfirmModal(prev => ({ ...prev, isOpen: false }));
        };

        const checkPendingAndFinish = () => {
            // Find pending steps
            const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
            const pendingCount = queueRef.current.filter(step => step.type === 'work' && !isStepLogged(step.id, currentLog)).length;

            if (pendingCount > 0) {
                showConfirm(
                    "Ejercicios Pendientes",
                    `Tienes ${pendingCount} ejercicios pendientes. ¿Deseas realizarlos antes de finalizar?`,
                    () => {
                        // Confirm: Show Pending Panel
                        setShowPending(true);
                    },
                    "warning",
                    () => {
                        // Cancel: Finish anyway
                        finishWorkout();
                    }
                );
            } else {
                finishWorkout();
            }
        };


        const value = {
            routine,
            queue,
            cursor,
            currentStep,
            nextStep,
            status,
            globalTime,
            stepTimer,
            isTimerRunning,
            setIsTimerRunning,
            next,
            prev,
            skipToNextWork,
            deferExercise,
            skipRest,
            addRestTime,
            logSet,
            logSpecificStep,
            updateLoggedStep,
            removeLoggedStep,
            isStepLogged,
            sessionLog,
            unit,
            setUnit,
            sessionLogRef,
            historyMaxByExercise,
            finishWorkout,
            startWorkout,
            cancelWorkout,
            exerciseLookup,
            isPaused,
            togglePause,
            message,
            showMessage,
            confirmModal,
            showConfirm,
            closeConfirm,
            handleConfirmAction,
            substituteModal,
            openSubstituteModal,
            closeSubstituteModal,
            applySubstitute,
            showCompletionIcon,
            showCountdown,
            countdownValue,
            notificationPermission,
            requestNotificationPermission,
            showPending,
            setShowPending,
            checkPendingAndFinish,
            handleCancelAction: closeConfirm
        };


        return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
    };

    window.Runner.hooks.useWorkout = () => useContext(WorkoutContext);
})();
