(function initGlossaryBootstrap() {
    // Inicializa comportamiento de detalles + modal del glosario
    function onReady() {
        if (window.showLoader) window.showLoader('Sincronizando glosario...');

        const state = window.GlossaryState;
        // Acordeon manual: solo un <details> abierto
        const allDetails = document.querySelectorAll('details');

        allDetails.forEach(details => {
            details.addEventListener('toggle', () => {
                if (details.open) {
                    const content = details.querySelector('.details-content');
                    if (content) {
                        content.scrollTop = 0;
                    }
                    allDetails.forEach(other => {
                        if (other !== details && other.open) {
                            other.open = false;
                        }
                    });
                }
            });
        });

        state.refImages = Array.from(document.querySelectorAll('.ref-card .ref-img'));
        state.elements = {
            modalElement: document.getElementById('imageModal'),
            modalImage: document.getElementById('modalImage'),
            modalTitle: document.getElementById('imageModalLabel'),
            modalDesc: document.getElementById('modalDescription'),
            nav: document.getElementById('imageNav'),
            prevBtn: document.getElementById('prevImageBtn'),
            nextBtn: document.getElementById('nextImageBtn')
        };

        if (state.elements.modalElement) {
            state.modal = new bootstrap.Modal(state.elements.modalElement);
        }

        // Cards clickeables que abren el modal
        const clickableCards = document.querySelectorAll('.muscle-card, .ref-card');
        clickableCards.forEach(card => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => window.GlossaryModal.showCard(card));
        });

        if (state.elements.prevBtn) {
            state.elements.prevBtn.addEventListener('click', () => {
                if (state.currentRefIndex > 0) window.GlossaryModal.showRefAt(state.currentRefIndex - 1);
            });
        }

        if (state.elements.nextBtn) {
            state.elements.nextBtn.addEventListener('click', () => {
                if (state.currentRefIndex < state.refImages.length - 1) window.GlossaryModal.showRefAt(state.currentRefIndex + 1);
            });
        }

        setTimeout(() => {
            if (window.hideLoader) window.hideLoader();
        }, 600);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }
})();
