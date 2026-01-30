(function () {
    const { useEffect } = React;

    window.Runner.hooks.useWorkoutSync = (options = {}) => {
        const {
            routineState,
            setExerciseLookup,
            setHistoryMaxByExercise,
            lastHistoryRoutineIdRef,
            BODY_PART_MAP,
            getReturnUrl
        } = options;

        // Inicializacion de ejercicios y partes del cuerpo
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
        }, [setExerciseLookup, BODY_PART_MAP]);

        // Historial de sesiones
        useEffect(() => {
            let isMounted = true;
            const routineId = routineState?.id || routineState?._id;
            const userId = window.currentUserId || window.CURRENT_USER_ID;
            if (!userId || !routineId) return;
            if (lastHistoryRoutineIdRef && lastHistoryRoutineIdRef.current === routineId) return;
            if (lastHistoryRoutineIdRef) lastHistoryRoutineIdRef.current = routineId;

            const loadHistoryMax = async () => {
                if (window.showLoader) window.showLoader("Sincronizando historial...");
                try {
                    const res = await fetch(`/workout/api/sessions?user_id=${encodeURIComponent(userId)}&limit=50`);
                    if (!res.ok) return;
                    const sessions = await res.json();
                    if (!isMounted || !Array.isArray(sessions)) return;

                    const maxByExercise = {};
                    const lastSession = sessions.find(s => s && s.routine_id === routineId);

                    if (lastSession) {
                        const sets = Array.isArray(lastSession.sets) ? lastSession.sets : [];
                        sets.forEach(set => {
                            const exId = set.exerciseId || set.exercise_id;
                            if (!exId) return;
                            const weightVal = parseFloat(set.weight);
                            if (!Number.isFinite(weightVal) || weightVal <= 0) return;

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
        }, [routineState?.id, routineState?._id, setHistoryMaxByExercise, lastHistoryRoutineIdRef]);

        // Sincronizacion offline
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

                const targetUrl = pending.return_url || (getReturnUrl ? getReturnUrl() : "/");
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
        }, [getReturnUrl]);
    };
})();
