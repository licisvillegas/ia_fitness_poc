(function () {
    const { useCallback, useEffect } = React;

    window.Runner.hooks.useWorkoutPersistence = (options = {}) => {
        const {
            routineState,
            status,
            cursor,
            stepTimer,
            isTimerRunning,
            setCursor,
            setStatus,
            setStepTimer,
            setIsTimerRunning
        } = options;

        const restoreFromLocalStorage = useCallback(() => {
            if (!routineState) return false;

            try {
                const savedJson = localStorage.getItem("workout_running_state");
                if (!savedJson) return false;

                const saved = JSON.parse(savedJson);
                const currentId = routineState.id || routineState._id;
                if (String(saved.routineId) !== String(currentId)) return false;

                const isRecent = (Date.now() - saved.savedAt) < 7200000;
                if (!isRecent) return false;

                setCursor(saved.cursor);
                setStatus(saved.status);

                if (saved.isTimerRunning && saved.status !== 'IDLE') {
                    const elapsedSinceSave = Math.floor((Date.now() - saved.savedAt) / 1000);
                    const newTimer = Math.max(0, saved.stepTimer - elapsedSinceSave);
                    setStepTimer(newTimer);
                    setIsTimerRunning(newTimer > 0);
                } else {
                    setStepTimer(saved.stepTimer);
                    setIsTimerRunning(saved.isTimerRunning);
                }

                return true;
            } catch (e) {
                console.warn("Error reading local state", e);
                return false;
            }
        }, [routineState, setCursor, setStatus, setStepTimer, setIsTimerRunning]);

        useEffect(() => {
            if (!routineState || status === 'LOADING') return;
            const state = {
                routineId: routineState.id || routineState._id,
                cursor,
                status,
                stepTimer,
                isTimerRunning,
                savedAt: Date.now()
            };
            try {
                localStorage.setItem("workout_running_state", JSON.stringify(state));
            } catch (e) { }
        }, [routineState, status, cursor, stepTimer, isTimerRunning]);

        return { restoreFromLocalStorage };
    };
})();
