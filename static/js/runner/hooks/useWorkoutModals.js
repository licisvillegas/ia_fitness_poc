(function () {
    const { useState, useRef } = React;

    window.Runner.hooks.useWorkoutModals = (options = {}) => {
        const [confirmModal, setConfirmModal] = useState({
            isOpen: false,
            title: "",
            message: "",
            onConfirm: null,
            onCancel: null,
            type: "danger"
        });
        const [substituteModal, setSubstituteModal] = useState({ isOpen: false, stepIndex: null });
        const [showRmModal, setShowRmModal] = useState(false);

        const onConfirmRef = useRef(null);
        const onCancelRef = useRef(null);

        const showConfirm = (title, message, onConfirm, type = "danger", onCancel = null) => {
            console.log("DEBUG: showConfirm called", { title });
            onConfirmRef.current = onConfirm;
            onCancelRef.current = onCancel;
            setConfirmModal({ isOpen: true, title, message, onConfirm, onCancel, type });
        };

        const closeConfirm = () => {
            const action = onCancelRef.current || confirmModal.onCancel;
            if (action) {
                action();
            }
            onConfirmRef.current = null;
            onCancelRef.current = null;
            setConfirmModal(prev => ({ ...prev, isOpen: false, onConfirm: null, onCancel: null }));
        };

        const handleConfirmAction = () => {
            const action = onConfirmRef.current || confirmModal.onConfirm;

            onConfirmRef.current = null;
            onCancelRef.current = null;

            if (action) action();

            setConfirmModal(prev => ({ ...prev, isOpen: false, onConfirm: null, onCancel: null }));
        };

        const openSubstituteModal = (stepIndex) => setSubstituteModal({ isOpen: true, stepIndex });
        const closeSubstituteModal = () => setSubstituteModal({ isOpen: false, stepIndex: null });

        const openRmModal = () => setShowRmModal(true);
        const closeRmModal = () => setShowRmModal(false);

        return {
            confirmModal,
            setConfirmModal,
            showConfirm,
            closeConfirm,
            handleConfirmAction,
            substituteModal,
            setSubstituteModal,
            openSubstituteModal,
            closeSubstituteModal,
            showRmModal,
            openRmModal,
            closeRmModal
        };
    };
})();
