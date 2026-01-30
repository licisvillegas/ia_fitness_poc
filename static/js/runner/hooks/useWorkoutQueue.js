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
            console.log("DEBUG: Next called. Cursor:", cursor, "QueueLen:", queue.length);

            if (currentStep && currentStep.type === 'work') {
                const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
                const shouldAutoLog = Boolean(currentStep.isTimeBased);
                if (shouldAutoLog && !isStepLogged(currentStep.id, currentLog)) {
                    console.log("DEBUG: Auto-logging current time-based step:", currentStep.id);
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
                console.log("DEBUG: End of queue reached. Calling checkPendingAndFinish.");
                setCursor(queue.length); // Advance to end
                if (status === 'REST') {
                    setStatus('WORK');
                    setTimeout(() => {
                        console.log("DEBUG: Timeout executed, calling checkPendingAndFinish");
                        checkPendingAndFinish();
                    }, 100);
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
            const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
            while (nextIdx < queue.length) {
                const step = queue[nextIdx];
                if (step.type === 'rest') {
                    nextIdx += 1;
                    continue;
                }
                if (step.type === 'work' && isStepLogged(step.id, currentLog)) {
                    console.log("DEBUG: Skipping completed step:", step.id);
                    nextIdx += 1;
                    if (nextIdx < queue.length && queue[nextIdx].type === 'rest') {
                        console.log("DEBUG: Skipping orphan rest");
                        nextIdx += 1;
                    }
                    continue;
                }
                break;
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
                    console.log("DEBUG: Executing Defer");

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

                    // Skip rest steps and already logged work steps (and their following rest)
                    while (nextIdx < queue.length) {
                        const step = queue[nextIdx];
                        if (step.type === 'rest') {
                            console.log("DEBUG: Skipping rest during defer");
                            nextIdx++;
                            continue;
                        }
                        if (step.type === 'work' && isStepLogged(step.id, currentLog)) {
                            console.log("DEBUG: Skipping completed step:", step.id);
                            nextIdx++;
                            if (nextIdx < queue.length && queue[nextIdx].type === 'rest') {
                                console.log("DEBUG: Skipping orphan rest");
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
            // Cancel scheduled pushes
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
            // Cancel animation if running (since time changed)
            if (enduranceCleanupRef.current) {
                enduranceCleanupRef.current();
                enduranceCleanupRef.current = null;
            }
            // Cancel previous push
            // Cancel previous pushes
            if (scheduledPushTaskIdsRef.current.length > 0) {
                if (cancelPush) {
                    scheduledPushTaskIdsRef.current.forEach(id => cancelPush(id));
                }
                scheduledPushTaskIdsRef.current = [];
            }

            setStepTimer(t => {
                const nextValue = Math.max(0, t + seconds);
                // Reschedule Push
                if (schedulePush) {
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
