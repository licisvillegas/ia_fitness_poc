(function () {
    const { useWorkout } = window.Runner.hooks;

    window.Runner.components.MessageBar = () => {
        const { message } = useWorkout();
        if (!message) return null;
        const toneClass = message.tone === "error"
            ? "border-danger text-danger"
            : message.tone === "success"
                ? "border-success text-cyber-green"
                : "border-info text-info";
        return (
            <div className={`mx-3 mb-3 p-2 border rounded bg-black-trans small ${toneClass}`}>
                {message.text}
            </div>
        );
    };
})();
