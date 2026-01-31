(function () {
    window.Runner.hooks.useWorkoutLog = (options = {}) => {
        const {
            currentStep,
            unit,
            startTimeRef,
            sessionLog,
            sessionLogRef,
            setSessionLog,
            syncProgress,
            cursor,
            triggerHaptic
        } = options;

        const logSpecificStep = (step, data, isMeasured = false) => {
            triggerHaptic(50); // Retroalimentación háptica al registrar
            if (!step || !step.exercise) return;
            const exerciseId = step.exercise.exercise_id || step.exercise._id || step.exercise.id;
            const exerciseName = step.exercise.exercise_name || step.exercise.name;
            const exerciseType = step.exercise.exercise_type || step.exercise.type;

            // Normalizar peso a KG para la base de datos
            let finalWeight = parseFloat(data.weight) || 0;
            const dataUnit = data.unit || unit;
            if (dataUnit === 'lb') {
                finalWeight = finalWeight / 2.20462;
            }

            const resolvedTime = data.time_seconds != null
                ? data.time_seconds
                : (step.isTimeBased ? step.target?.time : null);

            const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;

            // Evitar duplicados para el mismo stepId
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

        const logSet = (data) => {
            const step = currentStep;
            logSpecificStep(step, data, true);
        };

        const updateLoggedStep = (stepId, data) => {
            if (!stepId) return;
            const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
            const idx = currentLog.findIndex(l => l.stepId === stepId);
            if (idx === -1) return;

            // Redondear al 0.5 más cercano para consistencia interna si se pasa desde el registro rápido
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

        return {
            logSet,
            logSpecificStep,
            updateLoggedStep,
            removeLoggedStep
        };
    };
})();
