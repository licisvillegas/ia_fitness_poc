(function () {
    window.Runner.hooks.useWorkoutPending = (options = {}) => {
        const {
            queueRef,
            sessionLogRef,
            sessionLog,
            isStepLoggedLocal,
            showMessage,
            showConfirm,
            setShowPending,
            goToStepIndex,
            finishWorkoutRef
        } = options;

        const openPendingConfirm = () => {
            const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
            const pendingSteps = queueRef.current.filter(step => step.type === 'work' && !isStepLoggedLocal(step.id, currentLog));
            const pendingCount = pendingSteps.length;

            if (pendingCount === 0) {
                showMessage("No hay ejercicios pendientes", "info");
                return;
            }

            showMessage("Realiza los ejercicios pendientes", "info");

            showConfirm(
                "Ejercicios Pendientes",
                `Tienes ${pendingCount} ejercicios pendientes. ¿Deseas ir al primero?`,
                () => {
                    const firstPendingIdx = queueRef.current.findIndex(step => step.type === 'work' && !isStepLoggedLocal(step.id, currentLog));
                    if (firstPendingIdx !== -1) {
                        goToStepIndex(firstPendingIdx);
                        setShowPending(false);
                    } else {
                        setShowPending(true);
                    }
                },
                "warning",
                () => {
                    setShowPending(true);
                }
            );
        };

        const checkPendingAndFinish = () => {
            console.log("DEBUG: checkPendingAndFinish called");
            const currentLog = (sessionLogRef && sessionLogRef.current) ? sessionLogRef.current : sessionLog;
            const pendingCount = queueRef.current.filter(step => step.type === 'work' && !isStepLoggedLocal(step.id, currentLog)).length;
            console.log("DEBUG: Pending count:", pendingCount);

            if (pendingCount > 0) {
                showMessage("Ejercicios pendientes", "info");
                showConfirm(
                    "Ejercicios Pendientes",
                    `Tienes ${pendingCount} ejercicios pendientes. ¿Deseas realizarlos antes de finalizar?`,
                    () => {
                        const firstPendingIdx = queueRef.current.findIndex(step => step.type === 'work' && !isStepLoggedLocal(step.id, currentLog));
                        if (firstPendingIdx !== -1) {
                            goToStepIndex(firstPendingIdx);
                            console.log("Jumping to pending step:", firstPendingIdx);
                        } else {
                            setShowPending(true);
                        }
                    },
                    "warning",
                    () => {
                        if (finishWorkoutRef?.current) {
                            finishWorkoutRef.current();
                        }
                    }
                );
            } else {
                console.log("DEBUG: No pending steps, calling finishWorkout direct.");
                if (finishWorkoutRef?.current) {
                    finishWorkoutRef.current();
                }
            }
        };

        return {
            openPendingConfirm,
            checkPendingAndFinish
        };
    };
})();
