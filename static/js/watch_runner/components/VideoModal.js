(function () {
    const { useEffect, useRef, useState } = React;

    window.Runner.components.VideoModal = () => {
        const modalRef = useRef(null);
        const iframeRef = useRef(null);
        const modalInstanceRef = useRef(null);
        const [videoUrl, setVideoUrl] = useState("");

        useEffect(() => {
            const handleOpen = (event) => {
                const rawUrl = event && event.detail ? event.detail.url : "";
                const embedUrl = window.Runner.logic.toEmbedUrl(rawUrl);
                if (!embedUrl) return;
                setVideoUrl(embedUrl);
            };

            window.addEventListener("runner:openVideoModal", handleOpen);
            return () => window.removeEventListener("runner:openVideoModal", handleOpen);
        }, []);

        useEffect(() => {
            const modalEl = modalRef.current;
            if (!modalEl || !window.bootstrap || !window.bootstrap.Modal) return;

            if (!modalInstanceRef.current) {
                modalInstanceRef.current = new bootstrap.Modal(modalEl);
            }

            const handleHidden = () => {
                if (iframeRef.current) iframeRef.current.src = "";
                modalEl.style.zIndex = "";
                setVideoUrl("");
            };

            const handleShown = () => {
                const backdrops = document.querySelectorAll(".modal-backdrop");
                const backdrop = backdrops[backdrops.length - 1];
                if (backdrop) backdrop.style.zIndex = "3900";
            };

            modalEl.addEventListener("hidden.bs.modal", handleHidden);
            modalEl.addEventListener("shown.bs.modal", handleShown);

            if (videoUrl) {
                if (iframeRef.current) iframeRef.current.src = videoUrl;
                modalEl.style.zIndex = "4000";
                modalInstanceRef.current.show();
            } else {
                modalInstanceRef.current.hide();
            }

            return () => {
                modalEl.removeEventListener("hidden.bs.modal", handleHidden);
                modalEl.removeEventListener("shown.bs.modal", handleShown);
            };
        }, [videoUrl]);

        return ReactDOM.createPortal(
            <div className="modal fade" ref={modalRef} tabIndex="-1" aria-hidden="true">
                <div className="modal-dialog modal-lg modal-dialog-centered">
                    <div className="modal-content bg-card text-theme border border-theme">
                        <div className="modal-header border-theme">
                            <h5 className="modal-title text-cyber-green">Video</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body p-0">
                            <div className="ratio ratio-16x9">
                                <iframe
                                    ref={iframeRef}
                                    src=""
                                    title="Video ejercicio"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                ></iframe>
                            </div>
                        </div>
                        <div className="modal-footer border-theme">
                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    };
})();
