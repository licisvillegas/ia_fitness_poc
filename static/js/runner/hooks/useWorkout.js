(function () {
    const { createContext, useState, useEffect, useRef, useMemo, useContext } = React;
    const { useWorkoutTimer, useWorkoutNotifications, useWorkoutPersistence, useWorkoutSync, useWorkoutQueue, useWorkoutSteps, useWorkoutLog, useWorkoutModals, useWorkoutSubstitutions, useWorkoutPending, useWorkoutTimeTargets } = window.Runner.hooks;
    const { formatTime, getAudio, triggerHaptic, getReturnUrl, schedulePush, cancelPush } = window.Runner.utils;
    const { BODY_PART_MAP, NOTIFICATIONS } = window.Runner.constants;
    const { getExerciseId, mergeExerciseForSwap, getRestSeconds, buildQueue } = window.Runner.logic;

    const WorkoutContext = createContext();

    window.Runner.hooks.WorkoutProvider = ({ children, routine }) => {
        const [queue, setQueue] = useState([]);
        const [cursor, setCursor] = useState(0); // Índice en la cola
        const [status, setStatus] = useState('LOADING'); // LOADING | IDLE | WORK | REST | FINISHED
        console.log("WorkoutProvider Initialized. Initial Status:", status);
        const {
            confirmModal,
            setConfirmModal,
            showConfirm,
            showAlert,
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
        } = useWorkoutNotifications({ logSource: "useWorkout", showAlert });
        const [showPending, setShowPending] = useState(false); // Nuevo estado elevado desde App.js

        const [currentInput, setCurrentInput] = useState({
            weight: "",
            reps: "",
            unit: window.RESTORED_STATE?.unit || 'lb',
            exerciseName: ""
        });
        const [routineState, setRoutineState] = useState(routine);

        // Referencias para intervalo
        const resumeTimerRef = useRef(false);
        const queueRef = useRef([]);
        const sessionLogRef = useRef([]); // Arreglo para cierre obsoleto (stale closure)
        const startTimeRef = useRef(Date.now()); // Rastrear hora de inicio del paso actual
        const completeStepTimerRef = useRef(null);
        const finishWorkoutRef = useRef(null);
        const statusRef = useRef(status);
        const isPausedRef = useRef(isPaused);
        const currentStepRef = useRef(null);
        const forceRestAfterLoggedRef = useRef(false);
        const lastAnnouncementRef = useRef({ status: null, stepId: null });
        const scheduledPushTaskIdsRef = useRef([]); // Almacenar IDs de tareas push programadas (Array)
        const prevStatusRef = useRef(status);
        const lastHistoryRoutineIdRef = useRef(null);

        const getStepExerciseMeta = React.useCallback((step) => {
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
        }, []);

        const checkRepMotivation = React.useCallback((elapsed, flags, exName) => {
            // Lógica de notificación local migrada a Server Push al inicio del paso
            if (elapsed === 180 && !flags.min3) {
                flags.min3 = true;
            }
            if (elapsed === 300 && !flags.min5) {
                flags.min5 = true;
            }
        }, []);

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
            getReturnUrl,
            showAlert
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

                    // Prioridad: 1. LocalStorage (Ejecución activa reciente), 2. Estado restaurado del servidor, 3. Por defecto (Inicio)
                    let restored = false;
                    // 1. Intentar LocalStorage
                    try {
                        restored = restoreFromLocalStorage();
                    } catch (e) {
                        console.warn("Error reading local state", e);
                    }

                    // 2. Intentar Estado del Servidor (si no se restauró localmente)
                    if (!restored && window.RESTORED_STATE && window.RESTORED_STATE.routine_id === routineState.id) {
                        console.log("Restoring from Server State:", window.RESTORED_STATE);
                        if (window.RESTORED_STATE.cursor > 0 && window.RESTORED_STATE.cursor < q.length) {
                            setCursor(window.RESTORED_STATE.cursor);

                            // AUTO-RESUMEN: Establecer estado a TRABAJO y asegurar que la lógica del temporizador se ejecute
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
                        // Inicio por defecto
                        setStatus('IDLE');
                    }

                    console.log("Queue Built:", q);
                    queueRef.current = q; // Actualizar referencia
                } catch (e) {
                    console.error("CRITICAL ERROR building queue:", e);
                }
            }
        }, [routineState]);

        // Restablecer tiempo de inicio cuando cambia el paso
        useEffect(() => {
            startTimeRef.current = Date.now();
        }, [cursor]); // Restablecer al cambiar el cursor

        // Implementación de Wake Lock - Robusto y Consciente del Estado
        const isActive = status === 'WORK' || status === 'REST';

        useEffect(() => {
            let wakeLock = null;

            const requestLock = async () => {
                if (!isActive) return;
                // Solo solicitar si es visible
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
                // Si volvemos a ser visibles y ESTAMOS activos, volver a solicitar
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

        useEffect(() => {
            const handleVisibilityForRest = () => {
                if (document.visibilityState !== "hidden") return;
                if (statusRef.current !== "REST") return;
                if (scheduledPushTaskIdsRef.current.length > 0) return;
                const duration = stepTimerRef.current || 0;
                if (duration <= 0 || !window.Runner.utils.schedulePush) return;
                if (duration <= 0 || !window.Runner.utils.schedulePush) return;
                const { pushTitle, pushBody } = NOTIFICATIONS.REST_START;
                window.Runner.utils.schedulePush(
                    duration + 1,
                    pushTitle,
                    pushBody,
                    "rest_timer",
                    {
                        visibility: document.visibilityState,
                        displayMode: window.matchMedia && window.matchMedia("(display-mode: standalone)").matches ? "standalone" : "browser"
                    }
                ).then(id => { if (id) scheduledPushTaskIdsRef.current.push(id); });
            };
            document.addEventListener("visibilitychange", handleVisibilityForRest);
            return () => document.removeEventListener("visibilitychange", handleVisibilityForRest);
        }, []);

        // Restablecer rastreadores al cambiar el paso
        useEffect(() => {
            statusRef.current = status;

            // Manejar efectos secundarios para transiciones de estado
            if (status === 'REST') {
                // ENTRANDO EN DESCANSO: Programar Push
                const duration = stepTimerRef.current > 0 ? stepTimerRef.current : stepTimer;

                if (document.visibilityState !== 'visible') {
                    if (duration > 0 && window.Runner.utils.schedulePush) {
                        // Cancelar cualquiera existente
                        if (scheduledPushTaskIdsRef.current.length > 0) {
                            scheduledPushTaskIdsRef.current.forEach(id => window.Runner.utils.cancelPush(id));
                            scheduledPushTaskIdsRef.current = [];
                        }
                        // Programar nuevo
                        // Programar nuevo
                        const { pushTitle, pushBody } = NOTIFICATIONS.REST_START;
                        window.Runner.utils.schedulePush(
                            duration + 1,
                            pushTitle,
                            pushBody,
                            "rest_timer",
                            {
                                visibility: document.visibilityState,
                                displayMode: window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
                            }
                        )
                            .then(id => { if (id) scheduledPushTaskIdsRef.current.push(id); });
                    }
                }
            }

            if (status === 'WORK') {
                // ENTRANDO EN TRABAJO: Programar Push de Motivación (si es basado en tiempo)
                if (scheduledPushTaskIdsRef.current.length > 0) {
                    if (document.visibilityState === 'visible') {
                        scheduledPushTaskIdsRef.current.forEach(id => window.Runner.utils.cancelPush(id));
                        scheduledPushTaskIdsRef.current = [];
                    }
                }

                const meta = getStepExerciseMeta(currentStep);
                if (meta && (meta.isCardioOrTime || (meta.rawRepsTarget === 0 && meta.rawTimeTarget > 0))) {
                    const totalTime = meta.rawTimeTarget || Number(currentStep.target?.time || 60);

                    if (window.Runner.utils.schedulePush) {
                        // Programar MITAD
                        if (totalTime >= 20) {
                            const halfTime = Math.floor(totalTime / 2);
                            const delayHalf = totalTime - halfTime;
                            const { pushTitle, pushBody } = NOTIFICATIONS.MOTIVATION_HALF;
                            window.Runner.utils.schedulePush(delayHalf, pushTitle, pushBody(meta.exName), "workout_half", { visibility: document.visibilityState })
                                .then(id => { if (id) scheduledPushTaskIdsRef.current.push(id); });
                        }

                        // Programar Aviso de 2 MIN
                        if (totalTime > 140) {
                            const delay2Min = totalTime - 120;
                            const { pushTitle, pushBody } = NOTIFICATIONS.MOTIVATION_2MIN;
                            window.Runner.utils.schedulePush(delay2Min, pushTitle, pushBody, "workout_2min", { visibility: document.visibilityState })
                                .then(id => { if (id) scheduledPushTaskIdsRef.current.push(id); });
                        }
                    }
                } else if (meta && meta.rawRepsTarget !== 0) {
                    // BASADO EN REPS: Programar Avisos de Inactividad (3m, 5m)
                    if (window.Runner.utils.schedulePush) {
                        const note3 = NOTIFICATIONS.IDLE_3MIN;
                        window.Runner.utils.schedulePush(180, note3.pushTitle, note3.pushBody(meta.exName), "workout_idle_3m", { visibility: document.visibilityState })
                            .then(id => { if (id) scheduledPushTaskIdsRef.current.push(id); });

                        const note5 = NOTIFICATIONS.IDLE_5MIN;
                        window.Runner.utils.schedulePush(300, note5.pushTitle, note5.pushBody(meta.exName), "workout_idle_5m", { visibility: document.visibilityState })
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

            // Limpiar animación de resistencia si SE SALE DEL DESCANSO
            if (status !== 'REST') {
                if (enduranceCleanupRef.current) {
                    enduranceCleanupRef.current();
                    enduranceCleanupRef.current = null;
                }
            }
        }, [status, currentStep?.id]); // Depende del Estado Y del ID del Paso (para pasos de trabajo consecutivos)
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
            getAudio,
            logSet,
            next,
            isPausedRef,
            statusRef,
            isTimerRunningRef,
            stepTimerRef,
            globalTimeRef,
            currentStepElapsedRef,
            setGlobalTime,
            setGlobalTime,
            completeStepTimerRef,
            showAlert
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
                    showMessage(NOTIFICATIONS.REST_START.title, "info");
                }
                lastAnnouncementRef.current = { status: 'REST', stepId: currentStep.id };
            }

            if (status === 'WORK' && currentStep.type === 'work') {
                const exName = currentStep.exercise?.exercise_name || currentStep.exercise?.name || "Ejercicio";
                if (prevStatus === 'REST') {
                    // Prioridad: Cancelar Push programado para evitar duplicados si ya estamos aquí
                    if (scheduledPushTaskIdsRef.current.length > 0) {
                        if (window.Runner.utils.cancelPush) {
                            scheduledPushTaskIdsRef.current.forEach(id => window.Runner.utils.cancelPush(id));
                        }
                        scheduledPushTaskIdsRef.current = [];
                    }

                    const { titleSuccess, pushTitle, pushBody } = NOTIFICATIONS.REST_END;
                    showMessage(`${titleSuccess} ${exName}`, "success");

                    /* 
                    if (sendNotification) {
                        sendNotification(pushTitle, pushBody);
                    }
                    */

                    triggerHaptic([200, 100, 200]);
                } else if (lastAnnouncementRef.current.status !== 'WORK' || lastAnnouncementRef.current.stepId !== currentStep.id) {
                    showMessage(`${NOTIFICATIONS.WORK_START.titleInfo} ${exName}`, "info");
                }
                lastAnnouncementRef.current = { status: 'WORK', stepId: currentStep.id };
            }

            if (status === 'FINISHED' && prevStatus !== 'FINISHED') {
                const { titleSuccess, pushTitle, pushBody } = NOTIFICATIONS.WORKOUT_FINISHED;
                showMessage(titleSuccess, "success");
                if (sendNotification) {
                    sendNotification(pushTitle, pushBody);
                }

                // Victory sound moved to interaction handler in useWorkoutSteps.js for better mobile support
                try {
                    if (getAudio) getAudio().play().catch(() => { });
                } catch (e) { console.warn("Fallback sound failed", e); }

                if (window.Runner.utils.schedulePush) {
                    window.Runner.utils.schedulePush(
                        1,
                        pushTitle,
                        pushBody,
                        "workout_finished",
                        {
                            visibility: document.visibilityState,
                            displayMode: window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
                        }
                    );
                }
                lastAnnouncementRef.current = { status: 'FINISHED', stepId: null };
            }

            prevStatusRef.current = status;
        }, [status, currentStep?.id]);

        // Lógica de notificación heredada eliminada (reemplazada por sondeo de intervalo)
        useEffect(() => {
            // Opcional: mantener esta estructura si necesitamos otros efectos secundarios al inicio del paso
        }, [status, currentStep?.id]);

        const togglePause = () => {
            if (window.Runner.utils.resumeAudio) window.Runner.utils.resumeAudio();
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

