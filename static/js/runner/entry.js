(function initRunnerApp() {
    // Monta la app React del runner cuando las dependencias estan listas
    const MAX_TRIES = 80;
    const RETRY_MS = 50;

    const mountApp = () => {
        const rootEl = document.getElementById('react-root');
        if (!rootEl || !window.ReactDOM || !window.React) return false;
        if (!window.Runner || !window.Runner.hooks || !window.Runner.components) return false;

        const { WorkoutProvider, OverlayBusProvider } = window.Runner.hooks;
        const { App } = window.Runner.components;
        if (!WorkoutProvider || !App) return false;

        const initialRoutine = (window.__RUNNER__ && window.__RUNNER__.routine) || window.initialRoutine;

        const appElement = React.createElement(
            WorkoutProvider,
            { routine: initialRoutine },
            React.createElement(App, null)
        );

        const element = OverlayBusProvider
            ? React.createElement(OverlayBusProvider, null, appElement)
            : appElement;

        const root = ReactDOM.createRoot(rootEl);
        root.render(element);
        return true;
    };

    let tries = 0;
    const attempt = () => {
        tries += 1;
        if (mountApp()) return;
        if (tries < MAX_TRIES) {
            setTimeout(attempt, RETRY_MS);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attempt, { once: true });
    } else {
        attempt();
    }
})();
