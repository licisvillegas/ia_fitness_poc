(function () {
    window.Runner.hooks.useWorkoutSubstitutions = (options = {}) => {
        const {
            queue,
            cursor,
            setQueue,
            getExerciseId,
            mergeExerciseForSwap,
            openSubstituteModal,
            closeSubstituteModal,
            showMessage
        } = options;

        const openSubstituteModalForStep = (stepIndex = cursor) => {
            const step = queue[stepIndex];
            if (!step || step.type !== 'work') return;
            openSubstituteModal(stepIndex);
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

        return {
            openSubstituteModalForStep,
            applySubstitute
        };
    };
})();
