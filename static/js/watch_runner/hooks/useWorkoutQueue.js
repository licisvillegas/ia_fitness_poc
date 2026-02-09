(function () {
    window.Runner.hooks.useWorkoutQueue = (options = {}) => {
        const {
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
        } = options;

        const isStepLogged = (stepId, log) => {
            const currentLog = log || ((sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog);
            return currentLog.some(l => l.stepId === stepId);
        };

        const next = () => {
            console.log("DEBUG: Next llamado. Cursor:", cursor, "QueueLen:", queue.length);

            if (currentStep && currentStep.type === 'work') {
                const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
                const shouldAutoLog = Boolean(currentStep.isTimeBased);
                if (shouldAutoLog && !isStepLogged(currentStep.id, currentLog)) {
                    console.log("DEBUG: Auto-registrando paso actual basado en tiempo:", currentStep.id);
                    const fallbackTime = currentStep.target?.time || 0;
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
                console.log("DEBUG: Fin de la cola alcanzado. Llamando a checkPendingAndFinish.");
                setCursor(queue.length); // Advance to end
                if (status === 'REST') {
                    setStatus('WORK');
                    setTimeout(() => {
                        console.log("DEBUG: Timeout ejecutado, llamando a checkPendingAndFinish");
                        checkPendingAndFinish();
                    }, 100);
                } else {
                    checkPendingAndFinish();
                }
                return;
            }

            let nextIdx = cursor + 1;
            const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;

            // Salto inteligente: Omitir pasos completos de TRABAJO Y sus pasos de DESCANSO siguientes
            while (nextIdx < queue.length) {
                const step = queue[nextIdx];
                if (step.type === 'work' && isStepLogged(step.id, currentLog)) {
                    console.log("DEBUG: Saltando paso completado:", step.id);
                    nextIdx++;
                    // Si el paso inmediato siguiente es DESCANSO, saltarlo también porque su trabajo ha terminado
                    if (nextIdx < queue.length && queue[nextIdx].type === 'rest') {
                        if (forceRestAfterLoggedRef.current) {
                            console.log("DEBUG: Manteniendo descanso después del trabajo registrado");
                            forceRestAfterLoggedRef.current = false;
                            break;
                        }
                        console.log("DEBUG: Saltando descanso huérfano");
                        nextIdx++;
                    }
                } else {
                    break;
                }
            }

            if (nextIdx >= queue.length) {
                setCursor(queue.length); // Avanzar al final (activar estado vacío)
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
            console.log("DEBUG: Saltar al siguiente trabajo. Cursor:", cursor, "QueueLen:", queue.length);
            if (cursor >= queue.length - 1) {
                setCursor(queue.length); // Avanzar al final
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
            while (nextIdx < queue.length) {
                const step = queue[nextIdx];
                if (step.type === 'rest') {
                    nextIdx += 1;
                    continue;
                }
                if (step.type === 'work' && isStepLogged(step.id, currentLog)) {
                    console.log("DEBUG: Saltando paso completado:", step.id);
                    nextIdx += 1;
                    if (nextIdx < queue.length && queue[nextIdx].type === 'rest') {
                        console.log("DEBUG: Saltando descanso huérfano");
                        nextIdx += 1;
                    }
                    continue;
                }
                break;
            }
            if (nextIdx >= queue.length) {
                setCursor(queue.length); // Avanzar al final
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
            console.log("DEBUG: Pospuesto de ejercicio solicitado. Cursor:", cursor);

            showConfirm(
                "Dejar Pendiente",
                "¿Quieres dejar este ejercicio para el final? No se registrará progreso ahora.",
                () => {
                    console.log("DEBUG: Ejecutando posponer");

                    let nextIdx = cursor + 1;
                    if (nextIdx >= queue.length) {
                        setCursor(queue.length);
                        if (status === 'REST') {
                            setStatus('WORK');
                            setTimeout(checkPendingAndFinish, 100);
                        } else {
                            checkPendingAndFinish();
                        }
                        return;
                    }

                    const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;

                    // Saltar pasos de descanso y trabajos ya registrados (y sus descansos siguientes)
                    while (nextIdx < queue.length) {
                        const step = queue[nextIdx];
                        if (step.type === 'rest') {
                            console.log("DEBUG: Saltando descanso durante posponer");
                            nextIdx++;
                            continue;
                        }
                        if (step.type === 'work' && isStepLogged(step.id, currentLog)) {
                            console.log("DEBUG: Saltando paso completado:", step.id);
                            nextIdx++;
                            if (nextIdx < queue.length && queue[nextIdx].type === 'rest') {
                                console.log("DEBUG: Saltando descanso huérfano");
                                nextIdx++;
                            }
                        } else {
                            break;
                        }
                    }

                    if (nextIdx >= queue.length) {
                        setCursor(queue.length);
                        if (status === 'REST') setStatus('WORK');
                        checkPendingAndFinish();
                        return;
                    }

                    setCursor(nextIdx);
                    setIsPaused(false);

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

                    syncProgress(nextIdx, currentLog);
                },
                "warning"
            );
        };

        const prev = () => {
            if (cursor <= 0) return;

            let idx = cursor - 1;
            const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;

            // Saltar pasos ya registrados al retroceder
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
            // Cancelar animación si se está ejecutando
            if (enduranceCleanupRef.current) {
                enduranceCleanupRef.current();
                enduranceCleanupRef.current = null;
            }
            // Cancelar pushes programados
            // Cancelar pushes programados
            if (scheduledPushTaskIdsRef.current.length > 0) {
                if (cancelPush) {
                    scheduledPushTaskIdsRef.current.forEach(id => cancelPush(id));
                }
                scheduledPushTaskIdsRef.current = [];
            }

            setIsTimerRunning(false);
            setIsPaused(false);
            showMessage("Descanso omitido", "info");
            next();
        };

        const addRestTime = (seconds) => {
            // Cancelar animación si se está ejecutando (ya que el tiempo cambió)
            if (enduranceCleanupRef.current) {
                enduranceCleanupRef.current();
                enduranceCleanupRef.current = null;
            }
            // Cancelar pushes anteriores
            // Cancelar pushes anteriores
            if (scheduledPushTaskIdsRef.current.length > 0) {
                if (cancelPush) {
                    scheduledPushTaskIdsRef.current.forEach(id => cancelPush(id));
                }
                scheduledPushTaskIdsRef.current = [];
            }

            setStepTimer(t => {
                const nextValue = Math.max(0, t + seconds);
                // Reprogramar Push
                if (schedulePush && document.visibilityState !== 'visible') {
                    schedulePush(
                        nextValue,
                        "Tiempo Completado",
                        "Tu descanso ha terminado. ¡A trabajar!",
                        "rest_timer",
                        {
                            visibility: document.visibilityState,
                            displayMode: window.matchMedia && window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'
                        }
                    )
                        .then(id => {
                            if (id) scheduledPushTaskIdsRef.current.push(id);
                        });
                }
                return nextValue;
            });
        };

        return {
            isStepLogged,
            next,
            prev,
            skipToNextWork,
            deferExercise,
            skipRest,
            addRestTime
        };
    };
})();
