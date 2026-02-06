(function () {
    const { useState, useEffect, useRef } = React;

    window.Runner.hooks.useWorkoutTimer = (options = {}) => {
        const {
            status,
            isPaused,
            currentStep,
            currentStepRef,
            getStepExerciseMeta,
            checkRepMotivation,
            triggerHaptic,
            getAudio,
            onTimerComplete
        } = options;

        const [globalTime, setGlobalTime] = useState(0);
        const [stepTimer, setStepTimer] = useState(0);
        const [isTimerRunning, setIsTimerRunning] = useState(false);

        const stepIntervalRef = useRef(null);
        const isTimerRunningRef = useRef(isTimerRunning);
        const stepTimerRef = useRef(stepTimer);
        const globalTimeRef = useRef(globalTime);
        const currentStepElapsedRef = useRef(0);
        const notificationFlagsRef = useRef({});
        const enduranceCleanupRef = useRef(null);
        const onTimerCompleteRef = useRef(onTimerComplete);

        useEffect(() => {
            onTimerCompleteRef.current = onTimerComplete;
        }, [onTimerComplete]);

        useEffect(() => {
            currentStepElapsedRef.current = 0;
            notificationFlagsRef.current = {};
        }, [currentStep?.id]);

        useEffect(() => {
            if (status !== 'WORK' || isPaused) return;
            const step = currentStep;
            const meta = getStepExerciseMeta ? getStepExerciseMeta(step) : null;
            if (!meta) return;
            const { exName, rawTimeTarget, rawRepsTarget, isCardioOrTime } = meta;
            if (!isCardioOrTime && rawTimeTarget === 0 && rawRepsTarget !== 0) {
                if (checkRepMotivation) {
                    checkRepMotivation(currentStepElapsedRef.current, notificationFlagsRef.current, exName);
                }
            }
        }, [currentStep?.id, status, isPaused, getStepExerciseMeta, checkRepMotivation]);

        // Temporizador global y comprobador de notificaciones
        useEffect(() => {
            if ((status !== 'WORK' && status !== 'REST') || isPaused) return;
            const int = setInterval(() => {
                setGlobalTime(t => t + 1);

                if (status === 'WORK') {
                    currentStepElapsedRef.current += 1;
                    const elapsed = currentStepElapsedRef.current;
                    const step = currentStepRef?.current;

                    const meta = getStepExerciseMeta ? getStepExerciseMeta(step) : null;
                    if (!meta) return;
                    const { exName, rawTimeTarget, rawRepsTarget, isCardioOrTime } = meta;
                    const flags = notificationFlagsRef.current;

                    if (!isCardioOrTime && rawTimeTarget === 0 && rawRepsTarget !== 0) {
                        if (checkRepMotivation) {
                            checkRepMotivation(elapsed, flags, exName);
                        }
                    }

                    if (isCardioOrTime || (rawRepsTarget === 0 && rawTimeTarget > 0)) {
                        const remaining = stepTimerRef.current;
                        const totalTime = rawTimeTarget || Number(step?.target?.time || 60);
                        const halfTime = Math.floor(totalTime / 2);

                        if (remaining === halfTime && !flags.half) {
                            if (window.WorkoutAnimations?.pulseEffect) window.WorkoutAnimations.pulseEffect();
                            flags.half = true;
                        }

                        if (remaining === 120 && !flags.min2left) {
                            if (window.WorkoutAnimations?.pulseEffect) window.WorkoutAnimations.pulseEffect();
                            flags.min2left = true;
                        }
                    }
                }

            }, 1000);
            return () => clearInterval(int);
        }, [status, isPaused, getStepExerciseMeta, checkRepMotivation, currentStepRef]);

        // Lógica del temporizador de paso (Cuenta regresiva)
        useEffect(() => {
            if (status === 'REST') {
                if (stepTimer === 10 && !notificationFlagsRef.current.endurance10) {
                    if (window.WorkoutAnimations?.enduranceTimerEffect) {
                        enduranceCleanupRef.current = window.WorkoutAnimations.enduranceTimerEffect(10);
                    }
                    notificationFlagsRef.current.endurance10 = true;
                } else if (stepTimer > 10) {
                    notificationFlagsRef.current.endurance10 = false;
                    if (enduranceCleanupRef.current) {
                        enduranceCleanupRef.current();
                        enduranceCleanupRef.current = null;
                    }
                }
            }

            if (status !== 'REST' && enduranceCleanupRef.current) {
                enduranceCleanupRef.current();
                enduranceCleanupRef.current = null;
            }

            if (isPaused) {
                clearInterval(stepIntervalRef.current);
                return;
            }
            if (isTimerRunning && stepTimer > 0) {
                stepIntervalRef.current = setInterval(() => {
                    setStepTimer(prev => {
                        if (prev <= 1) return 0;
                        return prev - 1;
                    });
                }, 1000);
            } else {
                clearInterval(stepIntervalRef.current);
            }
            return () => clearInterval(stepIntervalRef.current);
        }, [isTimerRunning, isPaused]);

        // Manejo de la finalización del temporizador vía efecto
        useEffect(() => {
            if (stepTimer === 0 && isTimerRunning) {
                setIsTimerRunning(false);
                if (status === 'WORK' || status === 'REST') {
                    if (onTimerCompleteRef.current) onTimerCompleteRef.current();
                }
            }
        }, [stepTimer, isTimerRunning, status, triggerHaptic, getAudio]);

        useEffect(() => { isTimerRunningRef.current = isTimerRunning; }, [isTimerRunning]);
        useEffect(() => { stepTimerRef.current = stepTimer; }, [stepTimer]);
        useEffect(() => { globalTimeRef.current = globalTime; }, [globalTime]);

        return {
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
        };
    };
})();
