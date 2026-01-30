(function () {
    window.Runner.hooks.useWorkoutTimeTargets = (options = {}) => {
        const {
            routineState,
            setRoutineState,
            buildQueue,
            setQueue,
            queueRef,
            setCursor,
            status,
            setStatus
        } = options;

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

        return {
            updateTimeTargets,
            updateTimeTargetForItem
        };
    };
})();
