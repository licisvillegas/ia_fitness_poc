(function () {
    const { createContext, useState, useEffect, useRef, useMemo, useContext } = React;
    const { formatTime, getAudio, triggerHaptic, getReturnUrl, schedulePush, cancelPush } = window.Runner.utils;
    const { BODY_PART_MAP } = window.Runner.constants;
    const { getExerciseId, mergeExerciseForSwap, getRestSeconds, buildQueue } = window.Runner.logic;

    const WorkoutContext = createContext();

    window.Runner.hooks.WorkoutProvider = ({ children, routine }) => {
        const [queue, setQueue] = useState([]);
        const [cursor, setCursor] = useState(0); // Index in Queue
        const [status, setStatus] = useState('LOADING'); // LOADING | IDLE | WORK | REST | FINISHED
        console.log("WorkoutProvider Initialized. Initial Status:", status);
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
        const [unit, setUnit] = useState(window.RESTORED_STATE?.unit || 'lb');
        const [notificationPermission, setNotificationPermission] = useState('default'); // default, granted, denied
        const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);
        const [showPending, setShowPending] = useState(false); // New state lifted from App.js
        const [showRmModal, setShowRmModal] = useState(false);
        const [currentInput, setCurrentInput] = useState({
            weight: "",
            reps: "",
            unit: window.RESTORED_STATE?.unit || 'lb',
            exerciseName: ""
        });
        const [routineState, setRoutineState] = useState(routine);


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
        const forceRestAfterLoggedRef = useRef(false);
        const lastAnnouncementRef = useRef({ status: null, stepId: null });
        const enduranceCleanupRef = useRef(null); // Store cleanup for endurance animation
        const scheduledPushTaskRef = useRef(null); // Store scheduled push task ID
        const prevStatusRef = useRef(status);
        const lastHistoryRoutineIdRef = useRef(null);
        const currentStepElapsedRef = useRef(0);
        const notificationFlagsRef = useRef({});


        // Notification Logic
        useEffect(() => {
            if ("Notification" in window) {
                const perm = Notification.permission;
                setNotificationPermission(perm);
                // Default enabled if permission already granted
                setIsNotificationsEnabled(perm === 'granted');
                if (perm === 'granted' && typeof window.ensurePushSubscription === "function") {
                    window.ensurePushSubscription();
                }
            }
        }, []);

        const toggleNotifications = async () => {
            if (!("Notification" in window)) return;

            if (notificationPermission === 'default') {
                try {
                    const permission = await Notification.requestPermission();
                    setNotificationPermission(permission);
                    setIsNotificationsEnabled(permission === 'granted');
                    if (permission === 'granted' && typeof window.ensurePushSubscription === "function") {
                        window.ensurePushSubscription();
                    }
                } catch (e) {
                    console.error("Notification permission error", e);
                }
            } else if (notificationPermission === 'granted') {
                setIsNotificationsEnabled(prev => !prev);
            } else {
                // Denied: Could show a toast here if available mechanism
                alert("Las notificaciones están bloqueadas por el navegador. Habilítalas en la configuración del sitio.");
            }
        };

        const sendNotification = (title, body) => {
            if (isNotificationsEnabled && notificationPermission === 'granted') {
                try {
                    new Notification(title, { body, icon: '/static/icons/icon-192x192.png' });
                } catch (e) {
                    console.error("Notification error", e);
                }
            }
            if (document.visibilityState !== 'visible' && navigator.onLine && typeof window.ensurePushSubscription === "function") {
                window.ensurePushSubscription()
                    .then((ok) => {
                        if (!ok) return;
                        return fetch("/api/push/send", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ title, body, url: window.location.pathname || "/" })
                        });
                    })
                    .catch((e) => console.warn("Push send error", e));
            }
        };

        const ensureNotificationPermission = async () => {
            if (!("Notification" in window)) return;
            if (notificationPermission === 'granted') {
                setIsNotificationsEnabled(true);
                if (typeof window.ensurePushSubscription === "function") {
                    window.ensurePushSubscription();
                }
                return;
            }
            if (notificationPermission !== 'default') return;
            try {
                const permission = await Notification.requestPermission();
                setNotificationPermission(permission);
                setIsNotificationsEnabled(permission === 'granted');
                if (permission === 'granted' && typeof window.ensurePushSubscription === "function") {
                    window.ensurePushSubscription();
                }
            } catch (e) {
                console.error("Notification permission error", e);
            }
        };

        const getStepExerciseMeta = (step) => {
            if (!step || !step.exercise) return null;
            const exName = step.exercise.exercise_name || step.exercise.name || "Ejercicio";
            const stepType = String(
                step.exercise.exercise_type ||
                step.exercise.type ||
                step.exercise_type ||
                step.type ||
                ""
            ).toLowerCase();
            const rawTimeTarget = Number(
                step.exercise.target_time_seconds ||
                step.exercise.time_seconds ||
                step.exercise.time ||
                0
            );
            const rawRepsTarget = Number(
                step.exercise.target_reps ||
                step.exercise.reps ||
                0
            );
            const isCardioOrTime = stepType === 'cardio' || stepType === 'time';
            return { exName, rawTimeTarget, rawRepsTarget, isCardioOrTime };
        };

        const checkRepMotivation = (elapsed, flags, exName) => {
            if (elapsed === 180 && !flags.min3) {
                sendNotification("Motivacion", `Vamos, sigue con ${exName}.`);
                flags.min3 = true;
            }
            if (elapsed === 300 && !flags.min5) {
                sendNotification("Retoma la rutina", `Sigue con ${exName} cuando puedas.`);
                flags.min5 = true;
            }
        };

        const applyTimeTargetToItems = (items, seconds) => {
            if (!Array.isArray(items)) return items;
            return items.map(item => {
                if (!item || typeof item !== "object") return item;
                if (Array.isArray(item.items)) {
                    return { ...item, items: applyTimeTargetToItems(item.items, seconds) };
                }
                if (item.item_type === "exercise") {
                    const type = String(item.exercise_type || item.type || "").toLowerCase();
                    if (type === "cardio" || type === "time") {
                        return {
                            ...item,
                            target_time_seconds: seconds,
                            target_reps: 0
                        };
                    }
                }
                return item;
            });
        };

        const applyTimeTargetToItem = (items, routineItemId, seconds) => {
            if (!Array.isArray(items)) return items;
            return items.map(item => {
                if (!item || typeof item !== "object") return item;
                if (Array.isArray(item.items)) {
                    return { ...item, items: applyTimeTargetToItem(item.items, routineItemId, seconds) };
                }
                if (item.item_type === "exercise") {
                    const id = item._id || item.id;
                    if (String(id) !== String(routineItemId)) return item;
                    const type = String(item.exercise_type || item.type || "").toLowerCase();
                    if (type === "cardio" || type === "time") {
                        return {
                            ...item,
                            target_time_seconds: seconds,
                            target_reps: 0
                        };
                    }
                }
                return item;
            });
        };

        const updateTimeTargets = (seconds) => {
            if (!routineState || !Number.isFinite(seconds)) return;
            const nextItems = applyTimeTargetToItems(routineState.items, seconds);
            const updatedRoutine = { ...routineState, items: nextItems };
            setRoutineState(updatedRoutine);
            const q = buildQueue(updatedRoutine);
            setQueue(q);
            queueRef.current = q;
            setCursor(prev => Math.min(prev, Math.max(q.length - 1, 0)));
            if (status === 'IDLE') setStatus('IDLE');
        };

        const updateTimeTargetForItem = (routineItemId, seconds) => {
            if (!routineState || !routineItemId || !Number.isFinite(seconds)) return;
            const nextItems = applyTimeTargetToItem(routineState.items, routineItemId, seconds);
            const updatedRoutine = { ...routineState, items: nextItems };
            setRoutineState(updatedRoutine);
            const q = buildQueue(updatedRoutine);
            setQueue(q);
            queueRef.current = q;
            setCursor(prev => Math.min(prev, Math.max(q.length - 1, 0)));
            if (status === 'IDLE') setStatus('IDLE');
        };


        // INITIALIZE
        useEffect(() => {
            if (routine) setRoutineState(routine);
        }, [routine]);

        useEffect(() => {
            if (routineState) {
                console.log("routineState changed, building queue...", routineState);
                try {
                    const q = buildQueue(routineState);
                    console.log("Queue Built Successfully:", q);
                    setQueue(q);
                    setStatus('IDLE');

                    // Hydrate from restored state
                    // Assumes RESTORED_STATE is a global variable from the Jinja template
                    if (window.RESTORED_STATE && window.RESTORED_STATE.routine_id === routineState.id) {
                        console.log("RESTORING STATE:", window.RESTORED_STATE);
                        if (window.RESTORED_STATE.cursor > 0 && window.RESTORED_STATE.cursor < q.length) {
                            setCursor(window.RESTORED_STATE.cursor);

                            // AUTO-RESUME: Set status to WORK and ensure timer logic runs
                            const resumeStep = q[window.RESTORED_STATE.cursor];
                            if (resumeStep) {
                                if (resumeStep.type === 'rest') {
                                    setStatus('REST');
                                    setStepTimer(resumeStep.duration);
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
                } catch (e) {
                    console.error("CRITICAL ERROR building queue:", e);
                }
            }
        }, [routineState]);

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
                    console.log("Starting engine initialization (exercises, body parts)...");
                    await Promise.all([loadExercises(), loadBodyParts()]);
                    console.log("Engine initialization complete.");
                } finally {
                    if (window.hideLoader) window.hideLoader();
                }
            };

            init();

            return () => { isMounted = false; };
        }, []);

        useEffect(() => {
            let isMounted = true;
            const routineId = routineState?.id || routineState?._id;
            // currentUserId is a global variable from Jinja (see workout_runner.html)
            const userId = window.currentUserId || window.CURRENT_USER_ID;
            if (!userId || !routineId) return;
            if (lastHistoryRoutineIdRef.current === routineId) return;
            lastHistoryRoutineIdRef.current = routineId;

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
        }, [routineState?.id, routineState?._id]);

        useEffect(() => {
            const handleOfflineSync = (event) => {
                const detail = event && event.detail ? event.detail : {};
                if (!detail.routine_id) return;
                let pending = null;
                try {
                    pending = JSON.parse(localStorage.getItem("offline_pending_session") || "null");
                } catch (e) {
                    pending = null;
                }
                if (!pending || String(pending.routine_id) !== String(detail.routine_id)) return;

                try {
                    localStorage.removeItem("offline_pending_session");
                } catch (e) { }

                const targetUrl = pending.return_url || getReturnUrl();
                if (window.showAlertModal) {
                    window.showAlertModal(
                        "Sesion sincronizada",
                        "La rutina se cerro y regresaremos al dashboard.",
                        "success"
                    );
                } else {
                    alert("Sesion sincronizada. Regresando al dashboard.");
                }
                setTimeout(() => { window.location.href = targetUrl; }, 1200);
            };

            window.addEventListener("offline-session-synced", handleOfflineSync);
            if (navigator.onLine && window.offlineManager && window.offlineManager.sync) {
                window.offlineManager.sync();
            }
            return () => window.removeEventListener("offline-session-synced", handleOfflineSync);
        }, []);

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


        // Reset trackers on step change
        useEffect(() => {
            currentStepElapsedRef.current = 0;
            notificationFlagsRef.current = {};
        }, [currentStep?.id]);

        useEffect(() => {
            if (status !== 'WORK' || isPaused) return;
            const step = currentStep;
            const meta = getStepExerciseMeta(step);
            if (!meta) return;
            const { exName, rawTimeTarget, rawRepsTarget, isCardioOrTime } = meta;
            if (!isCardioOrTime && rawTimeTarget === 0 && rawRepsTarget !== 0) {
                checkRepMotivation(currentStepElapsedRef.current, notificationFlagsRef.current, exName);
            }
        }, [currentStep?.id, status, isPaused]);

        // Global Timer & Notification Checker
        useEffect(() => {
            if (status !== 'WORK' && status !== 'REST' || isPaused) return;
            const int = setInterval(() => {
                setGlobalTime(t => t + 1);

                if (status === 'WORK') {
                    currentStepElapsedRef.current += 1;
                    const elapsed = currentStepElapsedRef.current;
                    const step = currentStepRef.current;

                    const meta = getStepExerciseMeta(step);
                    if (!meta) return;
                    const { exName, rawTimeTarget, rawRepsTarget, isCardioOrTime } = meta;
                    const flags = notificationFlagsRef.current;

                    // Motivation Reps
                    // Condition: exercise_type != cardio/time AND raw_time == 0 AND raw_reps != 0
                    if (!isCardioOrTime && rawTimeTarget === 0 && rawRepsTarget !== 0) {
                        checkRepMotivation(elapsed, flags, exName);
                    }

                    // Motivation Time
                    // Condition: exercise_type = cardio or time OR (raw_reps == 0 AND raw_time > 0)
                    if (isCardioOrTime || (rawRepsTarget === 0 && rawTimeTarget > 0)) {
                        const remaining = stepTimerRef.current;
                        const totalTime = rawTimeTarget || Number(step.target?.time || 60);
                        const halfTime = Math.floor(totalTime / 2);

                        if (remaining === halfTime && !flags.half) {
                            sendNotification("Motivacion", `Vas a la mitad de ${exName}. Sigue asi.`);
                            if (window.WorkoutAnimations?.pulseEffect) window.WorkoutAnimations.pulseEffect();
                            flags.half = true;
                        }

                        if (remaining === 120 && !flags.min2left) {
                            sendNotification("Casi terminas", "Lo estas logrando. Te faltan 2 minutos.");
                            if (window.WorkoutAnimations?.pulseEffect) window.WorkoutAnimations.pulseEffect();
                            flags.min2left = true;
                        }
                    }
                }

            }, 1000);
            return () => clearInterval(int);
        }, [status, isPaused]);

        // Step Timer Logic (Countdown)
        useEffect(() => {
            if (status === 'REST') {
                // Initial Push Scheduling (only if not already scheduled or time changes substantially)
                // Note: We handle scheduling in a separate effect or when setting the timer to avoid spamming
                // But here we rely on dedicated functions for adds/skips.
                // However, if we just landed on REST, we need to schedule.
            }

            // Cleanup animation if NOT rest (Guard)
            if (status !== 'REST' && enduranceCleanupRef.current) {
                enduranceCleanupRef.current();
                enduranceCleanupRef.current = null;
            }

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

        // Background Push Scheduling handled by status transition effect
        const playAlarm = () => {
            try {
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                getAudio().play().catch(e => console.log("Audio permission needed"));
            } catch (e) { }
        }

        const currentStep = useMemo(() => queue[cursor], [queue, cursor]);
        const nextStep = useMemo(() => queue[cursor + 1], [queue, cursor]);

        useEffect(() => {
            statusRef.current = status;

            // Handle Side Effects for Status Transitions
            if (status === 'REST') {
                // ENTERING REST: Schedule Push
                if (stepTimer > 0 && window.Runner.utils.schedulePush) {
                    // Cancel any existing just in case
                    if (scheduledPushTaskRef.current) {
                        window.Runner.utils.cancelPush(scheduledPushTaskRef.current);
                    }
                    // Schedule new
                    window.Runner.utils.schedulePush(stepTimer + 1, "Tiempo Completado", "Tu descanso ha terminado. ¡A trabajar!")
                        .then(id => { scheduledPushTaskRef.current = id; });
                }
            } else {
                // LEAVING REST (or not in REST): Cleanup
                // 1. Cleanup Endurance Animation if running
                if (enduranceCleanupRef.current) {
                    enduranceCleanupRef.current();
                    enduranceCleanupRef.current = null;
                }
                // 2. Cancel Scheduled Push
                if (scheduledPushTaskRef.current) {
                    if (window.Runner && window.Runner.utils && window.Runner.utils.cancelPush) {
                        window.Runner.utils.cancelPush(scheduledPushTaskRef.current);
                    }
                    scheduledPushTaskRef.current = null;
                }
            }
        }, [status]); // DEPENDS ONLY ON STATUS (and captures latest stepTimer from closure)
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
                        globalTime: globalTimeRef.current,
                        currentStepElapsed: currentStepElapsedRef.current
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

                if (snap.status === 'WORK') {
                    currentStepElapsedRef.current = (snap.currentStepElapsed || 0) + deltaSec;
                }

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
                    credentials: "include",
                    body: JSON.stringify({
                        routine_id: (routineState?.id || routine?.id),
                        cursor: idx,
                        session_log: log || sessionLogRef.current,
                        unit: unit
                    })
                });
            } catch (e) { console.error("Sync error", e); }
        };

        const isStepLogged = (stepId, log) => {
            const currentLog = log || (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
            return currentLog.some(l => l.stepId === stepId);
        };

        const updateCurrentInput = (payload) => {
            setCurrentInput(prev => ({
                ...prev,
                ...payload
            }));
        };

        const openRmModal = () => setShowRmModal(true);
        const closeRmModal = () => setShowRmModal(false);

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
                const nextWork = queue[cursor + 1];
                const possibleRest = queue[cursor + 2];
                if (nextWork?.type === 'work' && isStepLogged(nextWork.id, currentLog) && possibleRest?.type === 'rest') {
                    forceRestAfterLoggedRef.current = true;
                }
            }

            if (cursor >= queue.length - 1) {
                setCursor(queue.length); // Advance to end
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

            // Smart skip: Skip completed Work steps AND their following Rest steps
            while (nextIdx < queue.length) {
                const step = queue[nextIdx];
                if (step.type === 'work' && isStepLogged(step.id, currentLog)) {
                    console.log("DEBUG: Skipping completed step:", step.id);
                    nextIdx++;
                    // If the immediate next step is REST, skip it too because its work is done
                    if (nextIdx < queue.length && queue[nextIdx].type === 'rest') {
                        if (forceRestAfterLoggedRef.current) {
                            console.log("DEBUG: Keeping rest after logged work");
                            forceRestAfterLoggedRef.current = false;
                            break;
                        }
                        console.log("DEBUG: Skipping orphan rest");
                        nextIdx++;
                    }
                } else {
                    break;
                }
            }

            if (nextIdx >= queue.length) {
                setCursor(queue.length); // Advance to end (trigger empty state)
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
                setCursor(queue.length); // Advance to end
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
                setCursor(queue.length); // Advance to end
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
                        setCursor(queue.length); // Advance to end
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
            // Cancel animation if running
            if (enduranceCleanupRef.current) {
                enduranceCleanupRef.current();
                enduranceCleanupRef.current = null;
            }
            // Cancel scheduled push
            if (scheduledPushTaskRef.current) {
                if (window.Runner && window.Runner.utils && window.Runner.utils.cancelPush) {
                    window.Runner.utils.cancelPush(scheduledPushTaskRef.current);
                }
                scheduledPushTaskRef.current = null;
            }

            setIsTimerRunning(false);
            setIsPaused(false);
            showMessage("Descanso omitido", "info");
            next();
        };

        const addRestTime = (seconds) => {
            // Cancel animation if running (since time changed)
            if (enduranceCleanupRef.current) {
                enduranceCleanupRef.current();
                enduranceCleanupRef.current = null;
            }
            // Cancel previous push
            if (scheduledPushTaskRef.current) {
                if (window.Runner && window.Runner.utils && window.Runner.utils.cancelPush) {
                    window.Runner.utils.cancelPush(scheduledPushTaskRef.current);
                }
                scheduledPushTaskRef.current = null;
            }

            setStepTimer(t => {
                const nextValue = Math.max(0, t + seconds);
                // Reschedule Push
                if (window.Runner && window.Runner.utils && window.Runner.utils.schedulePush) {
                    window.Runner.utils.schedulePush(nextValue, "Tiempo Completado", "Tu descanso ha terminado. ¡A trabajar!")
                        .then(id => { scheduledPushTaskRef.current = id; });
                }
                return nextValue;
            });
        };

        const finishWorkout = async () => {
            if (status === 'FINISHED') return; // Prevent double trigger

            // 1. Show Icon
            setShowCompletionIcon(true);
            showMessage("Rutina finalizada", "success");
            sendNotification("Rutina finalizada", "Listo para guardar tu entrenamiento.");

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
                    const payload = {
                        routine_id: (routineState?.id || routine?.id),
                        start_time: new Date(Date.now() - globalTime * 1000).toISOString(),
                        end_time: new Date().toISOString(),
                        sets: sessionLogRef.current // Use REF to ensure latest data
                    };
                    if (window.showLoader) window.showLoader("Guardando sesión...");
                    // Save logic
                    try {

                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

                        try {
                            const res = await fetch("/workout/api/session/save", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                credentials: "include",
                                body: JSON.stringify(payload),
                                signal: controller.signal
                            });
                            clearTimeout(timeoutId);
                            if (!res.ok) throw new Error("Server returned " + res.status);
                            window.location.href = getReturnUrl();
                        } catch (fetchErr) {
                            clearTimeout(timeoutId);
                            throw fetchErr;
                        }

                    } catch (e) {
                        console.error("Save error:", e);

                        // Attempt offline save immediately if online save failed
                        let offlineSaved = false;
                        if (window.offlineManager) {
                            try {
                                const offlineResult = await window.offlineManager.saveSession(payload);
                                if (offlineResult) {
                                    offlineSaved = true;
                                    if (window.showAlertModal) {
                                        window.showAlertModal(
                                            "Guardado localmente",
                                            "La sesion se guardo en este dispositivo y se sincronizara cuando vuelva la conexion.",
                                            "warning"
                                        );
                                    } else {
                                        alert("Guardado localmente. Se sincronizara cuando vuelva la conexion.");
                                    }
                                    try {
                                        localStorage.setItem("offline_pending_session", JSON.stringify({
                                            routine_id: payload.routine_id,
                                            return_url: getReturnUrl(),
                                            saved_at: new Date().toISOString()
                                        }));
                                    } catch (storageErr) {
                                        console.warn("No se pudo guardar el estado offline en localStorage", storageErr);
                                    }
                                    setTimeout(() => window.location.href = getReturnUrl(), 2000);
                                    return;
                                }
                            } catch (offlineErr) {
                                console.error("Auto-offline save failed:", offlineErr);
                            }
                        }

                        // If we are here, BOTH online and offline (auto) failed, or offlineManager missing.
                        // Show Recovery Modal to user
                        if (window.hideLoader) window.hideLoader();

                        setConfirmModal({
                            isOpen: true,

                            title: "Error al Guardar",
                            message: "No se pudo guardar la sesión (ni en nube ni local). ¿Qué deseas hacer?",
                            confirmText: "Reintentar Local",
                            cancelText: "Salir sin Guardar",
                            type: "danger",
                            onConfirm: async () => {
                                // Retry Offline Force
                                try {
                                    window.showLoader("Forzando guardado local...");
                                    if (window.offlineManager) {
                                        await window.offlineManager.saveSession(payload);
                                        window.showAlertModal("Éxito", "Guardado localmente forzado.", "success");
                                        setTimeout(() => window.location.href = getReturnUrl(), 1000);
                                    } else {
                                        throw new Error("Offline Manager no disponible");
                                    }
                                } catch (retryErr) {
                                    console.error("Retry failed:", retryErr);
                                    window.hideLoader();
                                    alert("Error final: " + retryErr.message + ". Se saldrá y cancelará la sesión.");

                                    // FORCE CANCEL
                                    try {
                                        await fetch("/workout/api/session/cancel", { method: "POST", credentials: "include" });
                                    } catch (e) { console.error("Cancel err", e); }
                                    window.location.href = getReturnUrl();
                                }
                            },
                            onCancel: async () => {
                                // Exit without saving
                                if (confirm("¿Seguro que deseas perder los datos de esta sesión?")) {
                                    // FORCE CANCEL to unlock server
                                    try {
                                        window.showLoader("Cancelando...");
                                        await fetch("/workout/api/session/cancel", { method: "POST", credentials: "include" });
                                    } catch (e) { console.error("Cancel err", e); }
                                    window.location.href = getReturnUrl();
                                }
                            }
                        });
                    } finally {
                        if (window.hideLoader && !confirmModal.isOpen) window.hideLoader();
                    }
                }, "success");
            }, 2000);
        };

        const cancelWorkout = () => {
            const doCancel = async () => {
                try {
                    await fetch("/workout/api/session/cancel", {
                        method: "POST",
                        credentials: "include"
                    });
                } catch (e) { console.error("Error cancelling:", e); }
                window.location.href = getReturnUrl();
            };

            if (status === 'IDLE') {
                doCancel();
                return;
            }
            showConfirm("Cancelar Rutina", "¿Estás seguro de que quieres salir? Se perderá el progreso actual.", () => {
                if (window.WorkoutAnimations && typeof window.WorkoutAnimations.glitchEffect === 'function') {
                    window.WorkoutAnimations.glitchEffect("RUTINA CANCELADA");
                    setTimeout(doCancel, 3000);
                } else {
                    showMessage("Rutina cancelada", "error");
                    doCancel();
                }
            }, "danger");
        };

        const showMessage = (text, tone = "info") => {
            setMessage({ text, tone });
            setTimeout(() => setMessage(null), 3000);
        };

        useEffect(() => {
            const prevStatus = prevStatusRef.current;
            if (!currentStep || status === 'LOADING' || status === 'IDLE') {
                prevStatusRef.current = status;
                return;
            }

            if (status === 'REST' && currentStep.type === 'rest') {
                if (lastAnnouncementRef.current.status !== 'REST' || lastAnnouncementRef.current.stepId !== currentStep.id) {
                    showMessage("Inicia Descanso", "info");
                }
                lastAnnouncementRef.current = { status: 'REST', stepId: currentStep.id };
            }

            if (status === 'WORK' && currentStep.type === 'work') {
                const exName = currentStep.exercise?.exercise_name || currentStep.exercise?.name || "Ejercicio";
                if (prevStatus === 'REST') {
                    showMessage(`Finalizo Descanso. Inicia ejercicio ${exName}`, "success");
                } else if (lastAnnouncementRef.current.status !== 'WORK' || lastAnnouncementRef.current.stepId !== currentStep.id) {
                    showMessage(`Inicia ejercicio ${exName}`, "info");
                }
                lastAnnouncementRef.current = { status: 'WORK', stepId: currentStep.id };
            }

            if (status === 'FINISHED' && prevStatus !== 'FINISHED') {
                showMessage("Fin de la Rutina", "success");
                lastAnnouncementRef.current = { status: 'FINISHED', stepId: null };
            }

            prevStatusRef.current = status;
        }, [status, currentStep?.id]);

        // Legacy Notification Logic Removed (replaced by interval polling)
        useEffect(() => {
            // Optional: keeping this structure if we need other side effects on step start
        }, [status, currentStep?.id]);

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
            ensureNotificationPermission();

            // NOTE: We no longer use internal state for countdown (setShowCountdown) 
            // because we use the external overlay animation.

            // Fetch session start immediately to lock it
            fetch("/workout/api/session/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ routine_id: (routineState?.id || routine?.id) })
            }).catch(e => console.error("Start session error", e));

            const triggerStart = () => {
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
            };

            if (window.WorkoutAnimations && typeof window.WorkoutAnimations.countdownEffect === 'function') {
                window.WorkoutAnimations.countdownEffect(triggerStart);
            } else {
                console.warn("WorkoutAnimations.countdownEffect not found, starting immediately");
                triggerStart();
            }
        };

        const showConfirm = (title, message, onConfirm, type = "danger", onCancel = null) => {
            console.log("DEBUG: showConfirm called", { title });
            onConfirmRef.current = onConfirm;
            onCancelRef.current = onCancel;
            setConfirmModal({ isOpen: true, title, message, onConfirm, onCancel, type });
        };

        const closeConfirm = () => {
            // Prioritize Ref, then State
            const action = onCancelRef.current || confirmModal.onCancel;
            if (action) {
                action();
            }
            onConfirmRef.current = null;
            onCancelRef.current = null;
            setConfirmModal(prev => ({ ...prev, isOpen: false, onConfirm: null, onCancel: null }));
        };

        const handleConfirmAction = () => {
            // Prioritize Ref, then State
            const action = onConfirmRef.current || confirmModal.onConfirm;

            // Clear refs so closeConfirm doesn't trigger cancel
            onConfirmRef.current = null;
            onCancelRef.current = null;

            if (action) action();

            setConfirmModal(prev => ({ ...prev, isOpen: false, onConfirm: null, onCancel: null }));
        };

        const goToStepIndex = (targetIdx) => {
            if (targetIdx < 0 || targetIdx >= queueRef.current.length) return;
            setCursor(targetIdx);
            const step = queueRef.current[targetIdx];
            if (step?.type === 'rest') {
                setStatus('REST');
                setStepTimer(step.duration || 0);
                setIsTimerRunning(true);
            } else if (step?.type === 'work') {
                setStatus('WORK');
                setStepTimer(step.isTimeBased ? step.target.time : 0);
                setIsTimerRunning(step.isTimeBased);
            }
            setIsPaused(false);
        };

        const openPendingConfirm = () => {
            const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
            const pendingSteps = queueRef.current.filter(step => step.type === 'work' && !isStepLogged(step.id, currentLog));
            const pendingCount = pendingSteps.length;

            if (pendingCount === 0) {
                showMessage("No hay ejercicios pendientes", "info");
                return;
            }

            showMessage("Realiza los ejercicios pendientes", "info");
            sendNotification("Ejercicios pendientes", "Realiza los ejercicios pendientes.");

            showConfirm(
                "Ejercicios Pendientes",
                `Tienes ${pendingCount} ejercicios pendientes. ¿Deseas ir al primero?`,
                () => {
                    const firstPendingIdx = queueRef.current.findIndex(step => step.type === 'work' && !isStepLogged(step.id, currentLog));
                    if (firstPendingIdx !== -1) {
                        goToStepIndex(firstPendingIdx);
                        setShowPending(false);
                    } else {
                        setShowPending(true);
                    }
                },
                "warning",
                () => {
                    setShowPending(true);
                }
            );
        };

        const checkPendingAndFinish = () => {
            // Find pending steps
            const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
            const pendingCount = queueRef.current.filter(step => step.type === 'work' && !isStepLogged(step.id, currentLog)).length;

            if (pendingCount > 0) {
                sendNotification("Ejercicios pendientes", "Tienes ejercicios pendientes por realizar.");
                showConfirm(
                    "Ejercicios Pendientes",
                    `Tienes ${pendingCount} ejercicios pendientes. ¿Deseas realizarlos antes de finalizar?`,
                    () => {
                        // Confirm: Go to first pending exercise
                        const firstPendingIdx = queueRef.current.findIndex(step => step.type === 'work' && !isStepLogged(step.id, currentLog));
                        if (firstPendingIdx !== -1) {
                            goToStepIndex(firstPendingIdx);
                            console.log("Jumping to pending step:", firstPendingIdx);
                        } else {
                            // Should not happen given pendingCount check, but fallback
                            setShowPending(true);
                        }
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
            routine: routineState,
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
            isNotificationsEnabled,
            toggleNotifications,
            showPending,
            setShowPending,
            checkPendingAndFinish,
            openPendingConfirm,
            showRmModal,
            openRmModal,
            closeRmModal,
            currentInput,
            updateCurrentInput,
            updateTimeTargets,
            updateTimeTargetForItem,
            handleCancelAction: closeConfirm
        };


        return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
    };

    window.Runner.hooks.useWorkout = () => useContext(WorkoutContext);
})();
