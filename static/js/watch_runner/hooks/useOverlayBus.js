(function () {
    const { createContext, useCallback, useContext, useEffect, useRef } = React;

    /**
     * @typedef {( ...args: any[] ) => (void | function)} OverlayHandler
     * @typedef {{ registerOverlay: (name: string, handler: OverlayHandler) => function, listOverlays: () => string[], getOverlay: (name: string) => OverlayHandler | undefined }} OverlayBusApi
     */

    const OverlayBusContext = createContext(null);

    const ensureOverlaysRoot = () => {
        window.Runner = window.Runner || {};
        window.Runner.overlays = window.Runner.overlays || {};
        return window.Runner.overlays;
    };

    const OverlayBusProvider = ({ children }) => {
        const registryRef = useRef({});
        const overlaysRef = useRef(null);

        const registerOverlay = useCallback((name, handler) => {
            if (!name || typeof handler !== 'function') return () => { };
            const overlays = ensureOverlaysRoot();
            overlays[name] = handler;
            registryRef.current[name] = handler;
            return () => {
                if (registryRef.current[name] === handler) delete registryRef.current[name];
                if (overlays[name] === handler) delete overlays[name];
            };
        }, []);

        useEffect(() => {
            const overlays = ensureOverlaysRoot();
            overlaysRef.current = overlays;
            overlays.register = (name, handler) => registerOverlay(name, handler);
            overlays.list = () => Object.keys(registryRef.current);
            overlays.get = (name) => registryRef.current[name];

            return () => {
                if (!overlaysRef.current) return;
                delete overlaysRef.current.register;
                delete overlaysRef.current.list;
                delete overlaysRef.current.get;
            };
        }, [registerOverlay]);

        useEffect(() => {
            const overlays = ensureOverlaysRoot();
            if (overlays.__isBusProxy) return;

            const proxy = new Proxy(overlays, {
                set(target, prop, value) {
                    if (value == null) {
                        delete registryRef.current[prop];
                        delete target[prop];
                        return true;
                    }
                    if (typeof value === 'function') {
                        registryRef.current[prop] = value;
                    }
                    target[prop] = value;
                    return true;
                },
                deleteProperty(target, prop) {
                    delete registryRef.current[prop];
                    delete target[prop];
                    return true;
                }
            });
            proxy.__isBusProxy = true;
            window.Runner.overlays = proxy;
            overlaysRef.current = proxy;
        }, []);

        /** @type {OverlayBusApi} */
        const value = {
            registerOverlay,
            listOverlays: () => Object.keys(registryRef.current),
            getOverlay: (name) => registryRef.current[name]
        };

        return (
            <OverlayBusContext.Provider value={value}>
                {children}
            </OverlayBusContext.Provider>
        );
    };

    const useOverlayBus = () => useContext(OverlayBusContext);

    const useOverlayRegistration = (name, handler) => {
        const bus = useOverlayBus();
        useEffect(() => {
            if (!bus || typeof bus.registerOverlay !== 'function') return;
            if (!name || typeof handler !== 'function') return;
            return bus.registerOverlay(name, handler);
        }, [bus, name, handler]);
    };

    window.Runner.hooks.OverlayBusProvider = OverlayBusProvider;
    window.Runner.hooks.useOverlayBus = useOverlayBus;
    window.Runner.hooks.useOverlayRegistration = useOverlayRegistration;
})();
