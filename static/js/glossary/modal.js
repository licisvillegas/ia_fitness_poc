(function initGlossaryModal() {
    const state = window.GlossaryState;
    const data = window.GlossaryData || { muscleDescriptions: {} };

    const isLightZoom = (src) => /\/static\/images\/examples\/(ref[123]|rf[456])\.png$/i.test(src || "");

    function updateNav() {
        const nav = state.elements.nav;
        const prevBtn = state.elements.prevBtn;
        const nextBtn = state.elements.nextBtn;
        if (!nav) return;
        const hasRef = state.currentRefIndex >= 0;
        nav.style.display = hasRef ? "flex" : "none";
        if (prevBtn) prevBtn.disabled = !hasRef || state.currentRefIndex === 0;
        if (nextBtn) nextBtn.disabled = !hasRef || state.currentRefIndex === state.refImages.length - 1;
    }

    function showRefAt(index) {
        const img = state.refImages[index];
        if (!img) return;
        const { modalElement, modalImage, modalTitle, modalDesc } = state.elements;
        state.currentRefIndex = index;
        modalElement.classList.toggle('image-zoom-light', isLightZoom(img.src));
        modalImage.src = img.src;
        modalImage.alt = img.alt;
        const titleEl = img.closest('.ref-card')?.querySelector('.ref-caption');
        modalTitle.textContent = titleEl ? titleEl.textContent : '';
        modalDesc.style.display = 'none';
        updateNav();
    }

    function showCard(card) {
        const { modalElement, modalImage, modalTitle, modalDesc } = state.elements;
        const img = card.querySelector('img');
        if (!img) return;

        if (card.classList.contains('ref-card')) {
            const idx = state.refImages.indexOf(img);
            showRefAt(idx >= 0 ? idx : 0);
        } else {
            state.currentRefIndex = -1;
            modalElement.classList.toggle('image-zoom-light', isLightZoom(img.src));
            modalImage.src = img.src;
            modalImage.alt = img.alt;
            const titleEl = card.querySelector('.muscle-name') || card.querySelector('.ref-caption');
            const name = titleEl ? titleEl.textContent : '';
            modalTitle.textContent = name;

            const key = name.trim().toLowerCase();
            const richInfo = data.muscleDescriptions[key];
            const desc = card.getAttribute('data-desc');
            const finalDesc = richInfo || desc || '';

            if (finalDesc) {
                modalDesc.innerHTML = finalDesc;
                modalDesc.style.display = 'block';
            } else {
                modalDesc.style.display = 'none';
            }
            updateNav();
        }

        state.modal?.show();
    }

    window.GlossaryModal = {
        isLightZoom,
        updateNav,
        showRefAt,
        showCard
    };
})();
