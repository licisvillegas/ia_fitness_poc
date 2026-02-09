(function () {
    const { useNotifications } = window.Runner.hooks;

    window.Runner.hooks.useWorkoutNotifications = (options = {}) => {
        const { logSource = "useWorkout", showAlert } = options;
        return useNotifications({ logSource, showAlert });
    };
})();
