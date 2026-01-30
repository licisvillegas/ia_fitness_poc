(function () {
    const { useEffect, useRef, useCallback } = React;

    window.Runner.hooks.useWorkoutSteps = (options = {}) => {
        const {
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
        } = options;

        const processingCompletionRef = useRef(false);
        const visibilitySnapshotRef = useRef(null);

        useEffect(() => {
            processingCompletionRef.current = false;
        }, [cursor]);

        const completeStepTimer = useCallback(() => {
            if (processingCompletionRef.current) return;
            if (!currentStep) return;
            processingCompletionRef.current = true;

            if (currentStep.type === 'rest') {
                next();
                return;
            }

            const alreadyLogged = sessionLog.some(l => l.stepId === currentStep.id);
            if (!alreadyLogged) {
                logSet({
                    time_seconds: currentStep.target.time,
                    weight: 0,
                    reps: 0
                });
            }
            next();
        }, [currentStep, logSet, next, sessionLog]);

        useEffect(() => {
            if (!completeStepTimerRef) return;
            completeStepTimerRef.current = completeStepTimer;
        }, [completeStepTimer, completeStepTimerRef]);

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
                        if (completeStepTimerRef?.current) {
                            completeStepTimerRef.current();
                        }
                    } else {
                        setStepTimer(prev => Math.min(prev, nextTimer));
                    }
                }
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);
            return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
        }, [
            completeStepTimerRef,
            currentStepElapsedRef,
            globalTimeRef,
            isPausedRef,
            isTimerRunningRef,
            setGlobalTime,
            setIsTimerRunning,
            setStepTimer,
            statusRef,
            stepTimerRef
        ]);

        const finishWorkout = async () => {
            console.log("DEBUG: finishWorkout called. Status:", status);
            if (status === 'FINISHED') {
                console.log("DEBUG: Status is already FINISHED, aborting.");
                return;
            }

            // 1. Show Icon
            console.log("DEBUG: Setting ShowCompletionIcon to TRUE");
            setShowCompletionIcon(true);
            showMessage("Rutina finalizada", "success");

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
                showConfirm("Finalizar Rutina", "Â¿Deseas guardar el entrenamiento completado?", async () => {
                    setStatus('FINISHED');
                    const payload = {
                        routine_id: (routineState?.id || routine?.id),
                        start_time: new Date(Date.now() - globalTime * 1000).toISOString(),
                        end_time: new Date().toISOString(),
                        sets: sessionLogRef.current // Use REF to ensure latest data
                    };
                    if (window.showLoader) window.showLoader("Guardando sesiÃ³n...");
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
                            localStorage.removeItem("workout_running_state");
                            localStorage.removeItem("offline_pending_session");
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
                            message: "No se pudo guardar la sesiÃ³n (ni en nube ni local). Â¿QuÃ© deseas hacer?",
                            confirmText: "Reintentar Local",
                            cancelText: "Salir sin Guardar",
                            type: "danger",
                            onConfirm: async () => {
                                // Retry Offline Force
                                try {
                                    window.showLoader("Forzando guardado local...");
                                    if (window.offlineManager) {
                                        await window.offlineManager.saveSession(payload);
                                        window.showAlertModal("Ã‰xito", "Guardado localmente forzado.", "success");
                                        setTimeout(() => window.location.href = getReturnUrl(), 1000);
                                    } else {
                                        throw new Error("Offline Manager no disponible");
                                    }
                                } catch (retryErr) {
                                    console.error("Retry failed:", retryErr);
                                    window.hideLoader();
                                    alert("Error final: " + retryErr.message + ". Se saldrÃ¡ y cancelarÃ¡ la sesiÃ³n.");

                                    // FORCE CANCEL
                                    try {
                                        localStorage.removeItem("workout_running_state");
                                        localStorage.removeItem("offline_pending_session");
                                        await fetch("/workout/api/session/cancel", { method: "POST", credentials: "include" });
                                    } catch (e) { console.error("Cancel err", e); }
                                    window.location.href = getReturnUrl();
                                }
                            },
                            onCancel: async () => {
                                // Exit without saving
                                if (confirm("Â¿Seguro que deseas perder los datos de esta sesiÃ³n?")) {
                                    // FORCE CANCEL to unlock server
                                    try {
                                        localStorage.removeItem("workout_running_state");
                                        localStorage.removeItem("offline_pending_session");
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
                    localStorage.removeItem("workout_running_state");
                    localStorage.removeItem("offline_pending_session");
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
                if (window.Runner?.overlays?.showGlitch) {
                    window.Runner.overlays.showGlitch("RUTINA CANCELADA");
                    if (typeof window.WorkoutAnimations?.zenEffect === 'function') {
                        window.WorkoutAnimations.zenEffect();
                    }
                    setTimeout(doCancel, 3000);
                } else if (window.WorkoutAnimations && typeof window.WorkoutAnimations.glitchEffect === 'function') {
                    window.WorkoutAnimations.glitchEffect("RUTINA CANCELADA");
                    if (typeof window.WorkoutAnimations.zenEffect === 'function') {
                        window.WorkoutAnimations.zenEffect();
                    }
                    setTimeout(doCancel, 3000);
                } else {
                    showMessage("Rutina cancelada", "error");
                    doCancel();
                }
            }, "danger");
        };

        const startWorkout = () => {
            if (!queueRef?.current || queueRef.current.length === 0) return;

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
                const step = queueRef.current[cursor];
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

        return {
            finishWorkout,
            cancelWorkout,
            startWorkout,
            completeStepTimerRef
        };
    };
})();
