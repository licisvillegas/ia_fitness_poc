/**
 * alert_modal.js - Lógica global para modales de alerta y confirmación personalizados.
 * Codificación: UTF-8
 */

(function () {
    const appAlertModal = document.getElementById("appAlertModal");
    const appAlertTitle = document.getElementById("appAlertTitle");
    const appAlertMessage = document.getElementById("appAlertMessage");
    const appAlertCancel = document.getElementById("appAlertCancel");
    const appAlertConfirm = document.getElementById("appAlertConfirm");
    let appAlertResolve = null;

    /**
     * Aplica el tono visual al título del modal.
     */
    const applyAlertTone = (tone) => {
        if (!appAlertTitle) return;
        appAlertTitle.classList.remove("alert-tone-warning", "alert-tone-danger", "alert-tone-success");
        if (tone === "warning") appAlertTitle.classList.add("alert-tone-warning");
        if (tone === "danger") appAlertTitle.classList.add("alert-tone-danger");
        if (tone === "success") appAlertTitle.classList.add("alert-tone-success");
    };

    /**
     * Muestra un modal de alerta simple.
     */
    const showAlertModal = (title, message, tone = "warning") => {
        if (!appAlertModal) {
            alert(message || title || "Aviso");
            return Promise.resolve(true);
        }
        appAlertTitle.textContent = title || "Aviso";
        appAlertMessage.textContent = message || "";
        appAlertCancel.style.display = "none";
        appAlertConfirm.textContent = "Cerrar";
        appAlertConfirm.className = "btn btn-outline-light";
        applyAlertTone(tone);
        appAlertModal.classList.add("show");
        return new Promise(resolve => {
            appAlertResolve = resolve;
        });
    };

    /**
     * Muestra un modal de confirmación con opciones.
     */
    const showConfirmModal = (title, message, tone = "danger") => {
        if (!appAlertModal) {
            return Promise.resolve(confirm(message || title || "Confirmar"));
        }
        appAlertTitle.textContent = title || "Confirmar";
        appAlertMessage.textContent = message || "";
        appAlertCancel.style.display = "inline-flex";
        appAlertConfirm.textContent = "Confirmar";
        appAlertConfirm.className = tone === "danger" ? "btn btn-outline-danger" : "btn btn-outline-success";
        applyAlertTone(tone);
        appAlertModal.classList.add("show");
        return new Promise(resolve => {
            appAlertResolve = resolve;
        });
    };

    /**
     * Cierra el modal y resuelve la promesa con el resultado.
     */
    const closeAlertModal = (result) => {
        if (appAlertModal) {
            appAlertModal.classList.remove("show");
        }
        if (appAlertResolve) appAlertResolve(result);
        appAlertResolve = null;
    };

    // Event Listeners
    appAlertCancel?.addEventListener("click", () => closeAlertModal(false));
    appAlertConfirm?.addEventListener("click", () => closeAlertModal(true));
    appAlertModal?.addEventListener("click", (event) => {
        if (event.target === appAlertModal) closeAlertModal(false);
    });

    // Exponer a nivel global
    window.showAlertModal = showAlertModal;
    window.showConfirmModal = showConfirmModal;
})();
