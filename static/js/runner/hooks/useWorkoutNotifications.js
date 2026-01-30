(function () {
    const { useNotifications } = window.Runner.hooks;

    window.Runner.hooks.useWorkoutNotifications = (options = {}) => {
        const { logSource = "useWorkout" } = options;
        return useNotifications({ logSource });
    };
})();
