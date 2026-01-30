(function () {
    const { createContext, useState, useEffect, useRef, useMemo, useContext } = React;
    const { useWorkoutTimer, useWorkoutNotifications, useWorkoutPersistence, useWorkoutSync, useWorkoutQueue, useWorkoutSteps, useWorkoutLog, useWorkoutModals, useWorkoutSubstitutions, useWorkoutPending, useWorkoutTimeTargets } = window.Runner.hooks;
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
        const [showCompletionIcon, setShowCompletionIcon] = useState(false);
        const [showCountdown, setShowCountdown] = useState(false);
        const [countdownValue, setCountdownValue] = useState(3);

        const [unit, setUnit] = useState(window.RESTORED_STATE?.unit || 'lb');
        const {
            notificationPermission,
            isNotificationsEnabled,
            toggleNotifications,
            ensureNotificationPermission,
            sendNotification
        } = useWorkoutNotifications({ logSource: "useWorkout" });
        const [showPending, setShowPending] = useState(false); // New state lifted from App.js

        const [currentInput, setCurrentInput] = useState({
            weight: "",
            reps: "",
            unit: window.RESTORED_STATE?.unit || 'lb',
            exerciseName: ""
        });
        const [routineState, setRoutineState] = useState(routine);

        // Refs for Interval
        const resumeTimerRef = useRef(false);
        const queueRef = useRef([]);
        const sessionLogRef = useRef([]); // Fix for stale closure
        const startTimeRef = useRef(Date.now()); // Track start time of current step
        const completeStepTimerRef = useRef(null);
        const finishWorkoutRef = useRef(null);
        const statusRef = useRef(status);
        const isPausedRef = useRef(isPaused);
        const currentStepRef = useRef(null);
        const forceRestAfterLoggedRef = useRef(false);
        const lastAnnouncementRef = useRef({ status: null, stepId: null });
        const scheduledPushTaskIdsRef = useRef([]); // Store scheduled push task IDs (Array)
        const prevStatusRef = useRef(status);
        const lastHistoryRoutineIdRef = useRef(null);

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
            // Local notification logic migrated to Server Push on Step Start
            if (elapsed === 180 && !flags.min3) {
                flags.min3 = true;
            }
            if (elapsed === 300 && !flags.min5) {
                flags.min5 = true;
            }
        };

        const currentStep = useMemo(() => queue[cursor], [queue, cursor]);
        const nextStep = useMemo(() => queue[cursor + 1], [queue, cursor]);

        const {
            globalTime,
            setGlobalTime,
            stepTimer,
            setStepTimer,
            isTimerRunning,
            setIsTimerRunning,
            isTimerRunningRef,
            stepTimerRef,
            globalTimeRef,
            currentStepElapsedRef,
            notificationFlagsRef,
            enduranceCleanupRef,
            stepIntervalRef
        } = useWorkoutTimer({
            status,
            isPaused,
            currentStep,
            currentStepRef,
            getStepExerciseMeta,
            checkRepMotivation,
            triggerHaptic,
            getAudio,
            onTimerComplete: () => {
                if (completeStepTimerRef.current) completeStepTimerRef.current();
            }
        });

        useWorkoutSync({
            routineState,
            setExerciseLookup,
            setHistoryMaxByExercise,
            lastHistoryRoutineIdRef,
            BODY_PART_MAP,
            getReturnUrl
        });

        const showMessage = (text, tone = "info") => {
            setMessage({ text, tone });
            setTimeout(() => setMessage(null), 3000);
        };


        const { restoreFromLocalStorage } = useWorkoutPersistence({
            routineState,
            status,
            cursor,
            stepTimer,
            isTimerRunning,
            setCursor,
            setStatus,
            setStepTimer,
            setIsTimerRunning
        });

        const {
            confirmModal,
            setConfirmModal,
            showConfirm,
            closeConfirm,
            handleConfirmAction,
            substituteModal,
            setSubstituteModal,
            openSubstituteModal: openSubstituteModalRaw,
            closeSubstituteModal,
            showRmModal,
            openRmModal,
            closeRmModal
        } = useWorkoutModals();

        const isStepLoggedLocal = (stepId, log) => {
            const currentLog = log || ((sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog);
            return currentLog.some(l => l.stepId === stepId);
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


        const {
            logSet,
            logSpecificStep,
            updateLoggedStep,
            removeLoggedStep
        } = useWorkoutLog({
            currentStep,
            unit,
            startTimeRef,
            sessionLog,
            sessionLogRef,
            setSessionLog,
            syncProgress,
            cursor,
            triggerHaptic
        });

        const { openSubstituteModalForStep, applySubstitute } = useWorkoutSubstitutions({
            queue,
            cursor,
            setQueue,
            getExerciseId,
            mergeExerciseForSwap,
            openSubstituteModal: openSubstituteModalRaw,
            closeSubstituteModal,
            showMessage
        });

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

        const { openPendingConfirm, checkPendingAndFinish } = useWorkoutPending({
            queueRef,
            sessionLogRef,
            sessionLog,
            isStepLoggedLocal,
            showMessage,
            showConfirm,
            setShowPending,
            goToStepIndex,
            finishWorkoutRef
        });
        const {
            isStepLogged,
            next,
            prev,
            skipToNextWork,
            deferExercise,
            skipRest,
            addRestTime
        } = useWorkoutQueue({
            queue,
            cursor,
            status,
            currentStep,
            sessionLog,
            sessionLogRef,
            setCursor,
            setStatus,
            setIsPaused,
            setStepTimer,
            setIsTimerRunning,
            showConfirm,
            showMessage,
            logSet,
            syncProgress,
            checkPendingAndFinish,
            schedulePush,
            cancelPush,
            enduranceCleanupRef,
            scheduledPushTaskIdsRef,
            forceRestAfterLoggedRef
        });

        const { updateTimeTargets, updateTimeTargetForItem } = useWorkoutTimeTargets({
            routineState,
            setRoutineState,
            buildQueue,
            setQueue,
            queueRef,
            setCursor,
            status,
            setStatus
        });

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

                    // Priority: 1. LocalStorage (Recent active run), 2. Server Restored State, 3. Default (Start)
                    let restored = false;
                    // 1. Try LocalStorage
                    try {
                        restored = restoreFromLocalStorage();
                    } catch (e) {
                        console.warn("Error reading local state", e);
                    }

                    // 2. Try Server State (if not restored locally)
                    if (!restored && window.RESTORED_STATE && window.RESTORED_STATE.routine_id === routineState.id) {
                        console.log("Restoring from Server State:", window.RESTORED_STATE);
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
                    } else if (!restored) {
                        // Default start
                        setStatus('IDLE');
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
            statusRef.current = status;

            // Handle Side Effects for Status Transitions
            if (status === 'REST') {
                // ENTERING REST: Schedule Push
                const duration = stepTimerRef.current > 0 ? stepTimerRef.current : stepTimer;

                if (duration > 0 && window.Runner.utils.schedulePush) {
                    // Cancel any existing
                    if (scheduledPushTaskIdsRef.current.length > 0) {
                        scheduledPushTaskIdsRef.current.forEach(id => window.Runner.utils.cancelPush(id));
                        scheduledPushTaskIdsRef.current = [];
                    }
                    // Schedule new
                    window.Runner.utils.schedulePush(
                        duration + 1,
                        "Tiempo Completado",
                        "Tu descanso ha terminado. ¡A trabajar!",
                        "rest_timer",
                        {
                            visibility: document.visibilityState,
                            displayMode: window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
                        }
                    )
                        .then(id => { if (id) scheduledPushTaskIdsRef.current.push(id); });
                }
            }

            if (status === 'WORK') {
                // ENTERING WORK: Schedule Motivation Pushes (if time-based)
                if (scheduledPushTaskIdsRef.current.length > 0) {
                    scheduledPushTaskIdsRef.current.forEach(id => window.Runner.utils.cancelPush(id));
                    scheduledPushTaskIdsRef.current = [];
                }

                const meta = getStepExerciseMeta(currentStep);
                if (meta && (meta.isCardioOrTime || (meta.rawRepsTarget === 0 && meta.rawTimeTarget > 0))) {
                    const totalTime = meta.rawTimeTarget || Number(currentStep.target?.time || 60);

                    if (window.Runner.utils.schedulePush) {
                        // Schedule HALFWAY
                        if (totalTime >= 20) {
                            const halfTime = Math.floor(totalTime / 2);
                            const delayHalf = totalTime - halfTime;
                            window.Runner.utils.schedulePush(delayHalf, "Motivacion", `Vas a la mitad de ${meta.exName || "tu ejercicio"}. Sigue asi.`, "workout_half", { visibility: document.visibilityState })
                                .then(id => { if (id) scheduledPushTaskIdsRef.current.push(id); });
                        }

                        // Schedule 2 MIN Warning
                        if (totalTime > 140) {
                            const delay2Min = totalTime - 120;
                            window.Runner.utils.schedulePush(delay2Min, "Casi terminas", "Lo estas logrando. Te faltan 2 minutos.", "workout_2min", { visibility: document.visibilityState })
                                .then(id => { if (id) scheduledPushTaskIdsRef.current.push(id); });
                        }
                    }
                } else if (meta && meta.rawRepsTarget !== 0) {
                    // REP BASED: Schedule Idle Warnings (3m, 5m)
                    if (window.Runner.utils.schedulePush) {
                        window.Runner.utils.schedulePush(180, "Motivacion", `Vamos, sigue con ${meta.exName || "tu ejercicio"}.`, "workout_idle_3m", { visibility: document.visibilityState })
                            .then(id => { if (id) scheduledPushTaskIdsRef.current.push(id); });

                        window.Runner.utils.schedulePush(300, "Retoma la rutina", `Sigue con ${meta.exName || "tu ejercicio"} cuando puedas.`, "workout_idle_5m", { visibility: document.visibilityState })
                            .then(id => { if (id) scheduledPushTaskIdsRef.current.push(id); });
                    }
                }
            }
            if (status !== 'REST' && status !== 'WORK') {
                if (scheduledPushTaskIdsRef.current.length > 0) {
                    scheduledPushTaskIdsRef.current.forEach(id => window.Runner.utils.cancelPush(id));
                    scheduledPushTaskIdsRef.current = [];
                }
            }

            // Cleanup Endurance Animation if LEAVING REST
            if (status !== 'REST') {
                if (enduranceCleanupRef.current) {
                    enduranceCleanupRef.current();
                    enduranceCleanupRef.current = null;
                }
            }
        }, [status, currentStep?.id]); // Depends on Status AND Step ID (for consecutive work steps)
        useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
        useEffect(() => { currentStepRef.current = currentStep; }, [currentStep]);

        const updateCurrentInput = (payload) => {
            setCurrentInput(prev => ({
                ...prev,
                ...payload
            }));
        };

const { finishWorkout, cancelWorkout, startWorkout } = useWorkoutSteps({
            status,
            setStatus,
            setShowCompletionIcon,
            showMessage,
            showConfirm,
            setConfirmModal,
            confirmModal,
            routineState,
            routine,
            globalTime,
            sessionLogRef,
            sessionLog,
            queueRef,
            cursor,
            currentStep,
            setIsPaused,
            setStepTimer,
            setIsTimerRunning,
            ensureNotificationPermission,
            getReturnUrl,
            triggerHaptic,
            logSet,
            next,
            isPausedRef,
            statusRef,
            isTimerRunningRef,
            stepTimerRef,
            globalTimeRef,
            currentStepElapsedRef,
            setGlobalTime,
            completeStepTimerRef
        });
        useEffect(() => {
            finishWorkoutRef.current = finishWorkout;
        }, [finishWorkout]);

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
            openSubstituteModal: openSubstituteModalForStep,
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

