const EXPORT_FALLBACK_WIDTH = 900;
const EXPORT_FALLBACK_HEIGHT = 1200;
const COLLAGE_SIZES = {
    "1:1": { width: 1080, height: 1080 },
    "4:5": { width: 1080, height: 1350 },
    "9:16": { width: 1080, height: 1920 }
};

const compareState = {
    mode: 'side',
    slider: 50,
    sliderMode: 'wipe',
    transformA: { scale: 1, x: 0, y: 0 },
    transformB: { scale: 1, x: 0, y: 0 },
    activeAdjust: 'A',
    imageAUrl: '',
    imageBUrl: ''
};

document.addEventListener('DOMContentLoaded', () => {
    initCompareTool();
});

function initCompareTool() {
    const fileA = document.getElementById('compareFileA');
    const fileB = document.getElementById('compareFileB');
    const clearA = document.getElementById('compareClearA');
    const clearB = document.getElementById('compareClearB');

    fileA?.addEventListener('change', () => handleFileSelection('A', fileA?.files?.[0]));
    fileB?.addEventListener('change', () => handleFileSelection('B', fileB?.files?.[0]));

    clearA?.addEventListener('click', () => clearFile('A'));
    clearB?.addEventListener('click', () => clearFile('B'));

    const btnSide = document.getElementById('compareViewSide');
    const btnSlider = document.getElementById('compareViewSlider');
    btnSide?.addEventListener('click', () => setCompareView('side'));
    btnSlider?.addEventListener('click', () => setCompareView('slider'));

    const sliderRange = document.getElementById('compareSliderRange');
    sliderRange?.addEventListener('input', (e) => {
        compareState.slider = parseInt(e.target.value, 10) || 0;
        applyMorphOpacity();
        updateOverlayWidth();
    });
    const sliderResetBtn = document.getElementById('compareSliderReset');
    sliderResetBtn?.addEventListener('click', () => {
        compareState.slider = 50;
        if (sliderRange) sliderRange.value = '50';
        applyMorphOpacity();
        updateOverlayWidth();
    });

    const modeBlend = document.getElementById('compareModeBlend');
    const modeWipe = document.getElementById('compareModeWipe');
    modeBlend?.addEventListener('click', () => setSliderMode('blend'));
    modeWipe?.addEventListener('click', () => setSliderMode('wipe'));

    initAdjustControls();
    initExportButtons();

    setCompareView('side');
    updateCompareImages();
}

function handleFileSelection(which, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (which === 'A') {
            compareState.imageAUrl = dataUrl;
            updateFileName('A', file.name);
        } else {
            compareState.imageBUrl = dataUrl;
            updateFileName('B', file.name);
        }
        updateCompareImages();
    };
    reader.readAsDataURL(file);
}

function clearFile(which) {
    const input = document.getElementById(which === 'A' ? 'compareFileA' : 'compareFileB');
    if (input) input.value = '';
    if (which === 'A') {
        compareState.imageAUrl = '';
        updateFileName('A', 'Sin archivo');
    } else {
        compareState.imageBUrl = '';
        updateFileName('B', 'Sin archivo');
    }
    updateCompareImages();
}

function updateFileName(which, name) {
    const label = document.getElementById(which === 'A' ? 'compareFileNameA' : 'compareFileNameB');
    if (label) {
        label.textContent = name || 'Sin archivo';
    }
}

function setCompareView(mode) {
    compareState.mode = mode;
    const side = document.getElementById('compareSideBySide');
    const sliderWrap = document.getElementById('compareSliderWrap');
    const slider = document.getElementById('compareSliderRange');
    const sliderResetWrap = document.getElementById('compareSliderResetWrap');
    const btnSide = document.getElementById('compareViewSide');
    const btnSlider = document.getElementById('compareViewSlider');
    const modeControls = document.getElementById('compareModeControls');

    if (mode === 'slider') {
        side?.classList.add('d-none');
        sliderWrap?.classList.remove('d-none');
        slider?.classList.remove('d-none');
        sliderResetWrap?.classList.remove('d-none');
        btnSide?.classList.remove('active');
        btnSlider?.classList.add('active');
        compareState.activeAdjust = 'A';
        if (modeControls) {
            modeControls.classList.remove('disabled');
            modeControls.classList.remove('d-none');
        }
        syncCompareControls();
        if (compareState.sliderMode === 'wipe') {
            document.getElementById('compareModeWipe')?.classList.add('active');
            document.getElementById('compareModeBlend')?.classList.remove('active');
        } else {
            document.getElementById('compareModeBlend')?.classList.add('active');
            document.getElementById('compareModeWipe')?.classList.remove('active');
        }
        applyMorphOpacity();
        updateOverlayWidth();
    } else {
        side?.classList.remove('d-none');
        sliderWrap?.classList.add('d-none');
        slider?.classList.add('d-none');
        sliderResetWrap?.classList.add('d-none');
        btnSlider?.classList.remove('active');
        btnSide?.classList.add('active');
        if (modeControls) {
            modeControls.classList.add('disabled');
            modeControls.classList.add('d-none');
        }
    }
}

function setSliderMode(mode) {
    compareState.sliderMode = mode;
    const btnBlend = document.getElementById('compareModeBlend');
    const btnWipe = document.getElementById('compareModeWipe');
    if (mode === 'wipe') {
        btnWipe?.classList.add('active');
        btnBlend?.classList.remove('active');
    } else {
        btnBlend?.classList.add('active');
        btnWipe?.classList.remove('active');
    }
    applyMorphOpacity();
    updateOverlayWidth();
}

function updateOverlayWidth() {
    const overlay = document.getElementById('compareOverlay');
    const overlayImg = document.getElementById('compareOverlayImg');
    const handle = document.getElementById('compareSliderHandle');
    const sliderWrap = document.getElementById('compareSliderWrap');
    if (!overlay) return;
    if (compareState.sliderMode === 'wipe') {
        overlay.style.width = '100%';
        overlay.style.borderRight = '0';
        sliderWrap?.classList.add('wipe-mode');
        if (overlayImg) {
            overlayImg.style.clipPath = `inset(0 0 0 ${compareState.slider}%)`;
        }
    } else {
        overlay.style.width = '100%';
        overlay.style.borderRight = '0';
        sliderWrap?.classList.remove('wipe-mode');
        if (overlayImg) overlayImg.style.clipPath = '';
    }
    if (handle) {
        handle.style.left = `${compareState.slider}%`;
    }
}

function updateCompareImages() {
    const imgA = document.getElementById('compareImgA');
    const imgB = document.getElementById('compareImgB');
    const base = document.getElementById('compareBaseImg');
    const overlay = document.getElementById('compareOverlayImg');
    const emptyMsg = document.getElementById('compareEmptyMsg');

    if (imgA) imgA.src = compareState.imageAUrl || '';
    if (imgB) imgB.src = compareState.imageBUrl || '';
    if (base) base.src = compareState.imageAUrl || '';
    if (overlay) overlay.src = compareState.imageBUrl || '';

    applyMorphOpacity();
    applyCompareTransforms();

    if (emptyMsg) {
        if (compareState.imageAUrl && compareState.imageBUrl) {
            emptyMsg.classList.add('d-none');
        } else {
            emptyMsg.classList.remove('d-none');
        }
    }
}

function applyMorphOpacity() {
    const base = document.getElementById('compareBaseImg');
    const overlay = document.getElementById('compareOverlayImg');
    if (!base || !overlay) return;
    const value = Math.max(0, Math.min(100, compareState.slider));
    const ratio = value / 100;
    if (compareState.sliderMode === 'wipe') {
        base.style.opacity = '1';
        overlay.style.opacity = '1';
    } else {
        base.style.opacity = (1 - ratio).toString();
        overlay.style.opacity = ratio.toString();
    }
}

function applyCompareTransforms() {
    const imgA = document.getElementById('compareImgA');
    const imgB = document.getElementById('compareImgB');
    const base = document.getElementById('compareBaseImg');
    const overlay = document.getElementById('compareOverlayImg');

    const tA = `translate(${compareState.transformA.x}px, ${compareState.transformA.y}px) scale(${compareState.transformA.scale})`;
    const tB = `translate(${compareState.transformB.x}px, ${compareState.transformB.y}px) scale(${compareState.transformB.scale})`;

    if (imgA) imgA.style.transform = tA;
    if (imgB) imgB.style.transform = tB;
    if (base) base.style.transform = tA;
    if (overlay) overlay.style.transform = tB;
}

function syncCompareControls() {
    const slider = document.getElementById('compareSliderRange');
    const scaleA = document.getElementById('compareScaleA');
    const xA = document.getElementById('compareXA');
    const yA = document.getElementById('compareYA');
    const btnAdjustA = document.getElementById('compareAdjustA');
    const btnAdjustB = document.getElementById('compareAdjustB');
    const scaleA_side = document.getElementById('compareScaleA_side');
    const xA_side = document.getElementById('compareXA_side');
    const yA_side = document.getElementById('compareYA_side');
    const scaleB_side = document.getElementById('compareScaleB_side');
    const xB_side = document.getElementById('compareXB_side');
    const yB_side = document.getElementById('compareYB_side');

    if (slider) slider.value = String(compareState.slider);
    if (scaleA && compareState.activeAdjust === 'A') scaleA.value = String(compareState.transformA.scale * 100);
    if (xA && compareState.activeAdjust === 'A') xA.value = String(compareState.transformA.x);
    if (yA && compareState.activeAdjust === 'A') yA.value = String(compareState.transformA.y);
    if (scaleA && compareState.activeAdjust === 'B') scaleA.value = String(compareState.transformB.scale * 100);
    if (xA && compareState.activeAdjust === 'B') xA.value = String(compareState.transformB.x);
    if (yA && compareState.activeAdjust === 'B') yA.value = String(compareState.transformB.y);
    if (scaleA_side) scaleA_side.value = String(compareState.transformA.scale * 100);
    if (xA_side) xA_side.value = String(compareState.transformA.x);
    if (yA_side) yA_side.value = String(compareState.transformA.y);
    if (scaleB_side) scaleB_side.value = String(compareState.transformB.scale * 100);
    if (xB_side) xB_side.value = String(compareState.transformB.x);
    if (yB_side) yB_side.value = String(compareState.transformB.y);
    if (btnAdjustA && btnAdjustB) {
        if (compareState.activeAdjust === 'A') {
            btnAdjustA.classList.add('active');
            btnAdjustB.classList.remove('active');
        } else {
            btnAdjustB.classList.add('active');
            btnAdjustA.classList.remove('active');
        }
    }
}

function initAdjustControls() {
    const adjustToggle = document.getElementById('compareAdjustToggle');
    const adjustPanel = document.getElementById('compareAdjustPanel');
    const adjustToggleSideA = document.getElementById('compareAdjustToggleSideA');
    const adjustToggleSideB = document.getElementById('compareAdjustToggleSideB');
    const adjustPanelSideA = document.getElementById('compareAdjustPanelSideA');
    const adjustPanelSideB = document.getElementById('compareAdjustPanelSideB');

    adjustToggle?.addEventListener('click', () => adjustPanel?.classList.toggle('d-none'));
    adjustToggleSideA?.addEventListener('click', () => adjustPanelSideA?.classList.toggle('d-none'));
    adjustToggleSideB?.addEventListener('click', () => adjustPanelSideB?.classList.toggle('d-none'));

    const btnAdjustA = document.getElementById('compareAdjustA');
    const btnAdjustB = document.getElementById('compareAdjustB');
    btnAdjustA?.addEventListener('click', () => {
        compareState.activeAdjust = 'A';
        syncCompareControls();
    });
    btnAdjustB?.addEventListener('click', () => {
        compareState.activeAdjust = 'B';
        syncCompareControls();
    });

    const scaleA = document.getElementById('compareScaleA');
    const xA = document.getElementById('compareXA');
    const yA = document.getElementById('compareYA');
    scaleA?.addEventListener('input', () => updateSliderTransform('scale', scaleA?.value));
    xA?.addEventListener('input', () => updateSliderTransform('x', xA?.value));
    yA?.addEventListener('input', () => updateSliderTransform('y', yA?.value));

    const scaleA_side = document.getElementById('compareScaleA_side');
    const xA_side = document.getElementById('compareXA_side');
    const yA_side = document.getElementById('compareYA_side');
    const scaleB_side = document.getElementById('compareScaleB_side');
    const xB_side = document.getElementById('compareXB_side');
    const yB_side = document.getElementById('compareYB_side');

    scaleA_side?.addEventListener('input', () => updateSideTransform('A', 'scale', scaleA_side?.value));
    xA_side?.addEventListener('input', () => updateSideTransform('A', 'x', xA_side?.value));
    yA_side?.addEventListener('input', () => updateSideTransform('A', 'y', yA_side?.value));
    scaleB_side?.addEventListener('input', () => updateSideTransform('B', 'scale', scaleB_side?.value));
    xB_side?.addEventListener('input', () => updateSideTransform('B', 'x', xB_side?.value));
    yB_side?.addEventListener('input', () => updateSideTransform('B', 'y', yB_side?.value));

    const resetSlider = document.getElementById('compareResetSlider');
    resetSlider?.addEventListener('click', () => {
        compareState.transformA = { scale: 1, x: 0, y: 0 };
        compareState.transformB = { scale: 1, x: 0, y: 0 };
        syncCompareControls();
        applyCompareTransforms();
    });

    const resetSideA = document.getElementById('compareResetSideA');
    const resetSideB = document.getElementById('compareResetSideB');
    resetSideA?.addEventListener('click', () => {
        compareState.transformA = { scale: 1, x: 0, y: 0 };
        syncCompareControls();
        applyCompareTransforms();
    });
    resetSideB?.addEventListener('click', () => {
        compareState.transformB = { scale: 1, x: 0, y: 0 };
        syncCompareControls();
        applyCompareTransforms();
    });

    document.addEventListener('click', (event) => {
        const target = event.target;
        const inSliderPanel = target.closest('#compareAdjustPanel') || target.closest('#compareAdjustToggle');
        const inSidePanelA = target.closest('#compareAdjustPanelSideA') || target.closest('#compareAdjustToggleSideA');
        const inSidePanelB = target.closest('#compareAdjustPanelSideB') || target.closest('#compareAdjustToggleSideB');
        if (!inSliderPanel) adjustPanel?.classList.add('d-none');
        if (!inSidePanelA) adjustPanelSideA?.classList.add('d-none');
        if (!inSidePanelB) adjustPanelSideB?.classList.add('d-none');
    });
}

function updateSliderTransform(axis, rawValue) {
    const value = parseInt(rawValue, 10) || 0;
    if (compareState.activeAdjust === 'A') {
        if (axis === 'scale') compareState.transformA.scale = value / 100;
        if (axis === 'x') compareState.transformA.x = value;
        if (axis === 'y') compareState.transformA.y = value;
    } else {
        if (axis === 'scale') compareState.transformB.scale = value / 100;
        if (axis === 'x') compareState.transformB.x = value;
        if (axis === 'y') compareState.transformB.y = value;
    }
    applyCompareTransforms();
}

function updateSideTransform(which, axis, rawValue) {
    const value = parseInt(rawValue, 10) || 0;
    const target = which === 'A' ? compareState.transformA : compareState.transformB;
    if (axis === 'scale') target.scale = value / 100;
    if (axis === 'x') target.x = value;
    if (axis === 'y') target.y = value;
    applyCompareTransforms();
    syncCompareControls();
}

function initExportButtons() {
    const exportBtn = document.getElementById('compareExportBtn');
    const collageExportBtn = document.getElementById('compareCollageExportBtn');
    const exportRatio = document.getElementById('compareExportRatio');
    const collageLayout = document.getElementById('compareCollageLayout');
    const collageFit = document.getElementById('compareCollageFit');
    const collagePadding = document.getElementById('compareCollagePadding');

    exportBtn?.addEventListener('click', async () => {
        try {
            if (!compareState.imageAUrl || !compareState.imageBUrl) {
                if (window.showAlertModal) {
                    window.showAlertModal("Aviso", "Selecciona dos imágenes válidas para exportar.", "warning");
                } else {
                    window.alert("Selecciona dos imágenes válidas para exportar.");
                }
                return;
            }

            syncTransformsFromInputs();
            const ratioValue = exportRatio?.value || "4:5";
            const size = COLLAGE_SIZES[ratioValue] || { width: EXPORT_FALLBACK_WIDTH, height: EXPORT_FALLBACK_HEIGHT };
            const { width, height, sourceWidth, sourceHeight } = getExportSourceSize(size.width, size.height);

            const payload = {
                ratio: ratioValue,
                mode: compareState.sliderMode,
                slider: compareState.slider,
                width,
                height,
                sourceWidth,
                sourceHeight,
                imageAUrl: compareState.imageAUrl,
                imageBUrl: compareState.imageBUrl,
                transformA: { ...compareState.transformA },
                transformB: { ...compareState.transformB }
            };

            if (typeof showLoader === 'function') {
                showLoader("Exportando comparación...");
            }
            const resp = await fetch('/ai/body_assessment/compare/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo exportar la comparación.");
            }
            const blob = await resp.blob();
            downloadBlob(blob, `comparacion_${stampNow()}.png`);
        } catch (err) {
            const message = err?.message || "Error exportando la comparación.";
            if (window.showAlertModal) {
                window.showAlertModal("Error", message, "danger");
            } else {
                window.alert(message);
            }
        } finally {
            if (typeof hideLoader === 'function') {
                hideLoader();
            }
        }
    });

    collageExportBtn?.addEventListener('click', async () => {
        try {
            if (!compareState.imageAUrl || !compareState.imageBUrl) {
                if (window.showAlertModal) {
                    window.showAlertModal("Aviso", "Selecciona dos imágenes válidas para exportar.", "warning");
                } else {
                    window.alert("Selecciona dos imágenes válidas para exportar.");
                }
                return;
            }

            syncTransformsFromInputs();
            const ratioValue = exportRatio?.value || "4:5";
            const size = COLLAGE_SIZES[ratioValue] || COLLAGE_SIZES["4:5"];
            const layoutValue = collageLayout?.value || "vertical";
            const fitValue = collageFit?.value || "contain";
            const paddingValue = parseInt(collagePadding?.value || "16", 10) || 0;
            const { width, height, sourceWidth, sourceHeight } = getExportSourceSize(size.width, size.height);

            const payload = {
                width,
                height,
                layout: layoutValue,
                fit: fitValue,
                padding: paddingValue,
                sourceWidth,
                sourceHeight,
                imageAUrl: compareState.imageAUrl,
                imageBUrl: compareState.imageBUrl,
                transformA: { ...compareState.transformA },
                transformB: { ...compareState.transformB }
            };

            if (typeof showLoader === 'function') {
                showLoader("Exportando collage...");
            }
            const resp = await fetch('/ai/body_assessment/compare/collage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || "No se pudo exportar el collage.");
            }
            const blob = await resp.blob();
            downloadBlob(blob, `collage_${ratioValue.replace(':', 'x')}_${stampNow()}.png`);
        } catch (err) {
            const message = err?.message || "Error exportando el collage.";
            if (window.showAlertModal) {
                window.showAlertModal("Error", message, "danger");
            } else {
                window.alert(message);
            }
        } finally {
            if (typeof hideLoader === 'function') {
                hideLoader();
            }
        }
    });
}

function syncTransformsFromInputs() {
    const scaleA_side = document.getElementById('compareScaleA_side');
    const xA_side = document.getElementById('compareXA_side');
    const yA_side = document.getElementById('compareYA_side');
    const scaleB_side = document.getElementById('compareScaleB_side');
    const xB_side = document.getElementById('compareXB_side');
    const yB_side = document.getElementById('compareYB_side');
    if (scaleA_side) compareState.transformA.scale = (parseInt(scaleA_side.value, 10) || 100) / 100;
    if (xA_side) compareState.transformA.x = parseInt(xA_side.value, 10) || 0;
    if (yA_side) compareState.transformA.y = parseInt(yA_side.value, 10) || 0;
    if (scaleB_side) compareState.transformB.scale = (parseInt(scaleB_side.value, 10) || 100) / 100;
    if (xB_side) compareState.transformB.x = parseInt(xB_side.value, 10) || 0;
    if (yB_side) compareState.transformB.y = parseInt(yB_side.value, 10) || 0;

    const scale = document.getElementById('compareScaleA');
    const x = document.getElementById('compareXA');
    const y = document.getElementById('compareYA');
    if (scale && x && y) {
        const target = compareState.activeAdjust === 'B' ? compareState.transformB : compareState.transformA;
        target.scale = (parseInt(scale.value, 10) || 100) / 100;
        target.x = parseInt(x.value, 10) || 0;
        target.y = parseInt(y.value, 10) || 0;
    }
}

function getExportSourceSize(defaultWidth, defaultHeight) {
    let sourceWidth = 0;
    let sourceHeight = 0;
    const sliderWrap = document.getElementById('compareSliderWrap');
    const sideWrap = document.getElementById('compareSideBySide');
    if (compareState.mode === 'slider' && sliderWrap) {
        const rect = sliderWrap.getBoundingClientRect();
        sourceWidth = Math.round(rect.width) || sourceWidth;
        sourceHeight = Math.round(rect.height) || sourceHeight;
    } else if (sideWrap) {
        const frame = sideWrap.querySelector('.compare-frame');
        if (frame) {
            const rect = frame.getBoundingClientRect();
            sourceWidth = Math.round(rect.width) || sourceWidth;
            sourceHeight = Math.round(rect.height) || sourceHeight;
        }
    }
    return {
        width: defaultWidth || EXPORT_FALLBACK_WIDTH,
        height: defaultHeight || EXPORT_FALLBACK_HEIGHT,
        sourceWidth: sourceWidth || defaultWidth || EXPORT_FALLBACK_WIDTH,
        sourceHeight: sourceHeight || defaultHeight || EXPORT_FALLBACK_HEIGHT
    };
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function stampNow() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}
