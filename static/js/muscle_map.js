document.addEventListener('DOMContentLoaded', () => {
    const muscles = document.querySelectorAll('.muscle');
    if (!muscles.length) {
        return;
    }

    const muscleName = document.getElementById('muscleName');
    const muscleTip = document.getElementById('muscleTip');
    const muscleImageCard = document.getElementById('muscleImageCard');
    const muscleImage = document.getElementById('muscleImage');
    const clearBtn = document.getElementById('clearSelection');
    const toggleViewBtn = document.getElementById('toggleViewBtn');
    const mapContainer = document.querySelector('.tab-content');
    const adminThemeSelect = document.getElementById('adminThemeSelect');
    const genderToggle = document.getElementById('gender-toggle');
    const frontMap = document.querySelector('.body-map-front');
    const backMap = document.querySelector('.body-map-back');

    const adminThemeImages = {
        HD1: {
            front: '/static/images/body/male/1front_d.png',
            back: '/static/images/body/male/1back_d.png'
        },
        HD2: {
            front: '/static/images/body/male/01front_d.png',
            back: '/static/images/body/male/01back_d.png'
        },
        HR1: {
            front: '/static/images/body/male/1front.png',
            back: '/static/images/body/male/1back.png'
        },
        HR2: {
            front: '/static/images/body/male/01front.png',
            back: '/static/images/body/male/01back.png'
        }
    };

    const femaleThemeImages = {
        front: '/static/images/body/female/f_front_d.png',
        back: '/static/images/body/female/f_back_d.png'
    };

    let currentGender = 'male';

    const isAdminUnlocked = () => sessionStorage.getItem('admin_unlocked') === 'true';
    const canShowAdminSwap = () => window.__HAS_ADMIN === true && isAdminUnlocked();

    const syncAdminSwapVisibility = () => {
        if (!adminThemeSelect) return;
        if (currentGender === 'female') {
            adminThemeSelect.classList.add('d-none');
            return;
        }
        if (canShowAdminSwap()) {
            adminThemeSelect.classList.remove('d-none');
        } else {
            adminThemeSelect.classList.add('d-none');
        }
    };

    const applyGender = () => {
        if (!frontMap || !backMap) return;
        if (currentGender === 'female') {
            frontMap.style.backgroundImage = `url('${femaleThemeImages.front}')`;
            backMap.style.backgroundImage = `url('${femaleThemeImages.back}')`;
            frontMap.classList.add('gender-female');
            backMap.classList.add('gender-female');
        } else {
            frontMap.classList.remove('gender-female');
            backMap.classList.remove('gender-female');

            if (adminThemeSelect) {
                const theme = adminThemeImages[adminThemeSelect.value] || adminThemeImages.HD1;
                frontMap.style.backgroundImage = `url('${theme.front}')`;
                backMap.style.backgroundImage = `url('${theme.back}')`;
            } else {
                frontMap.style.backgroundImage = `url('${adminThemeImages.HD1.front}')`;
                backMap.style.backgroundImage = `url('${adminThemeImages.HD1.back}')`;
            }
        }
    };

    const muscleImages = {
        'Pectorales': 'pec.png',
        'Hombros': 'hom.png',
        'Trapecios': 'esp.png',
        'Dorsal ancho': 'esp.png',
        'Lumbares': 'esp.png',
        'Biceps': 'bic.png',
        'Triceps': 'tri.png',
        'Antebrazos': 'ant.png',
        'Abdominales': 'abs.png',
        'Oblicuos': 'abs.png',
        'Cuadriceps': 'cua.png',
        'Abductores': 'abd.png',
        'Aductores': 'adc.png',
        'Gemelos': 'gem.png',
        'Gluteos': 'glu.png',
        'Isquiotibiales': 'isq.png'
    };

    const muscleTips = {
        'Pectorales': 'Prueba press de banca e inclinados para activar el pecho completo.',
        'Hombros': 'Incluye press militar y elevaciones laterales para volumen.',
        'Biceps': 'Combina curl con barra y curl martillo para variedad.',
        'Abdominales': 'Alterna planchas con crunches controlados.',
        'Cuadriceps': 'Sentadillas y prensa son claves para fuerza frontal.',
        'Trapecios': 'Encogimientos y remo al ment?n ayudan a activar trapecios.',
        'Oblicuos': 'Twists y planchas laterales son ideales para oblicuos.',
        'Antebrazos': 'Farmer walks y curls inversos fortalecen el agarre.',
        'Gemelos': 'Elevaciones de tal?n ayudan a fortalecer los gemelos.',
        'Gluteos': 'Hip thrust y sentadillas profundas activan Glúteos.',
        'Abductores': 'Abducciones con banda y pasos laterales activan los abductores.',
        'Aductores': 'Sentadillas sumo y aducciones con polea activan la zona interna.',
        'Dorsal ancho': 'Dominadas y remos son fundamentales para la amplitud.',
        'Lumbares': 'Hiperextensiones y peso muerto fortalecen la zona baja.',
        'Isquiotibiales': 'Peso muerto rumano y curl femoral para la parte posterior.',
        'Triceps': 'Fondos y extensiones de polea para dar tama?o al brazo.'
    };

    const muscleDescriptions = {
        'hombros': '<strong>Nombres alternativos:</strong> Deltoides, "Deltos".<br><br><strong>Descripción y partes:</strong> músculo que envuelve la articulación del hombro, dando forma redondeada.<br>&bull; <strong>Deltoides anterior:</strong> Parte frontal (empujes).<br>&bull; <strong>Deltoides lateral (medial):</strong> Parte lateral (anchura).<br>&bull; <strong>Deltoides posterior:</strong> Parte trasera (tracción).',
        'pectorales': '<strong>Nombres alternativos:</strong> Pectorales, "Pecs", torso anterior.<br><br><strong>Descripción y partes:</strong> músculo grande en la parte frontal de la caja torácica. Es clave para movimientos de empuje.<br>&bull; <strong>Pectoral mayor:</strong> Se divide funcionalmente en fasc?culo clavicular (parte superior), esternocostal (parte media) y abdominal (parte inferior).<br>&bull; <strong>Pectoral menor:</strong> Situado debajo del mayor.',
        'espalda': '<strong>Nombres alternativos:</strong> Dorsales, espalda alta/media/baja.<br><br><strong>Descripción y partes:</strong> Grupo complejo que cubre la parte posterior del tronco.<br>&bull; <strong>Dorsal ancho (lats):</strong> Da la forma de "V".<br>&bull; <strong>Trapecios:</strong> Parte superior (cuello/hombros), media e inferior.<br>&bull; <strong>Romboides:</strong> Entre los omóplatos.<br>&bull; <strong>Erectores espinales / lumbares:</strong> Zona baja de la espalda (estabilidad).',
        'biceps': '<strong>Nombres alternativos:</strong> Bíceps braquial, "conejos" (coloquial).<br><br><strong>Descripción y partes:</strong> músculo de dos cabezas en la parte frontal del brazo.<br>&bull; <strong>Cabeza larga:</strong> Parte externa.<br>&bull; <strong>Cabeza corta:</strong> Parte interna.<br>&bull; <strong>Braquial:</strong> músculo profundo situado bajo el Bíceps (da volumen).',
        'triceps': '<strong>Nombres alternativos:</strong> Tríceps braquial.<br><br><strong>Descripción y partes:</strong> músculo de tres cabezas en la parte posterior del brazo. Ocupa 2/3 del volumen del brazo.<br>&bull; <strong>Cabeza larga:</strong> La más grande, parte interna.<br>&bull; <strong>Cabeza lateral:</strong> La parte externa visible.<br>&bull; <strong>Cabeza medial:</strong> Situada más abajo, cerca del codo.',
        'antebrazos': '<strong>Nombres alternativos:</strong> Flexores/extensores de la muñeca.<br><br><strong>Descripción y partes:</strong> Conjunto de múltiples músculos pequeños responsables del agarre.<br>&bull; <strong>Braquiorradial:</strong> El músculo más visible en la parte superior del antebrazo.<br>&bull; <strong>Flexores y extensores:</strong> Grupos musculares para mover dedos y muñeca.',
        'abdominales': '<strong>Nombres alternativos:</strong> Core, recto abdominal, "six-pack", abdominales.<br><br><strong>Descripción y partes:</strong> Centro de gravedad y estabilidad del cuerpo.<br>&bull; <strong>Recto abdominal:</strong> La "tableta" frontal.<br>&bull; <strong>Oblicuos (externos e internos):</strong> Los laterales del torso.<br>&bull; <strong>Transverso:</strong> músculo profundo (faja natural).<br>&bull; <strong>Serratos:</strong> músculos en forma de "dientes" sobre las costillas.',
        'gluteos': '<strong>Nombres alternativos:</strong> Nalgas, trasero.<br><br><strong>Descripción y partes:</strong> El grupo muscular más grande y fuerte del cuerpo.<br>&bull; <strong>Glúteo mayor:</strong> La parte principal y más visible.<br>&bull; <strong>Glúteo medio:</strong> Parte lateral superior (estabilidad de cadera).<br>&bull; <strong>Glúteo menor:</strong> Profundo, bajo el medio.',
        'cuadriceps': '<strong>Nombres alternativos:</strong> Cu?driceps femoral, muslo anterior.<br><br><strong>Descripción y partes:</strong> Grupo de cuatro músculos en la parte frontal del muslo.<br>&bull; <strong>Recto femoral:</strong> El músculo central que cruza la cadera.<br>&bull; <strong>Vasto lateral:</strong> Parte externa (da la curva exterior).<br>&bull; <strong>Vasto medial:</strong> Parte interna (forma de gota cerca de la rodilla).<br>&bull; <strong>Vasto intermedio:</strong> Profundo, bajo el recto femoral.',
        'abductores': '<strong>Nombres alternativos:</strong> Abducción de cadera, muslo externo.<br><br><strong>Descripción y partes:</strong> Grupo muscular en la parte externa de la cadera y muslo que estabiliza la pelvis.<br>&bull; <strong>Glúteo medio:</strong> Principal abductor de la cadera.<br>&bull; <strong>Tensor de la fascia lata:</strong> Aporta estabilidad lateral.',
        'aductores': '<strong>Nombres alternativos:</strong> Aductores de cadera, muslo interno.<br><br><strong>Descripción y partes:</strong> Grupo muscular que aproxima la pierna al eje medio del cuerpo y estabiliza la pelvis.<br>&bull; <strong>Aductor largo:</strong> más superficial en el muslo interno.<br>&bull; <strong>Aductor mayor:</strong> Volumen principal en la parte interna.',
        'femoral': '<strong>Nombres alternativos:</strong> Femorales, isquiosurales, isquios, parte posterior del muslo.<br><br><strong>Descripción y partes:</strong> Grupo muscular en la parte trasera del muslo.<br>&bull; <strong>Bíceps femoral:</strong> Parte externa (cabeza larga y corta).<br>&bull; <strong>Semitendinoso y semimembranoso:</strong> Parte interna.',
        'gemelos': '<strong>Nombres alternativos:</strong> Tríceps sural, gemelos, chamorros (coloquial en MX).<br><br><strong>Descripción y partes:</strong> Parte posterior de la pierna baja.<br>&bull; <strong>Gastrocnemio (gemelos):</strong> El músculo visible con forma de diamante (cabeza interna y externa).<br>&bull; <strong>S?leo:</strong> músculo plano situado debajo de los gemelos (visible a los lados del tobillo).'
    };

    const glossaryMap = {
        'Pectorales': 'pectorales',
        'Hombros': 'hombros',
        'Trapecios': 'espalda',
        'Dorsal ancho': 'espalda',
        'Lumbares': 'espalda',
        'Biceps': 'biceps',
        'Triceps': 'triceps',
        'Antebrazos': 'antebrazos',
        'Abdominales': 'abdominales',
        'Oblicuos': 'abdominales',
        'Cuadriceps': 'cuadriceps',
        'Abductores': 'abductores',
        'Aductores': 'aductores',
        'Gemelos': 'gemelos',
        'Gluteos': 'gluteos',
        'Isquiotibiales': 'femoral'
    };

    function clearSelection() {
        muscles.forEach(muscle => {
            muscle.classList.remove('active');
            muscle.setAttribute('aria-pressed', 'false');
        });
        if (muscleName) {
            muscleName.textContent = 'Ninguno';
        }
        if (muscleTip) {
            muscleTip.textContent = 'Selecciona un músculo para mostrar tips de entrenamiento.';
        }
        muscleImageCard?.classList.add('d-none');
    }

    toggleViewBtn?.addEventListener('click', () => {
        const frontTab = document.getElementById('front-tab');
        const backTab = document.getElementById('back-tab');

        if (!frontTab || !backTab) {
            return;
        }

        if (frontTab.classList.contains('active')) {
            backTab.click();
        } else {
            frontTab.click();
        }
    });

    if (adminThemeSelect) {
        syncAdminSwapVisibility();
        let adminChecks = 0;
        const adminCheckTimer = setInterval(() => {
            adminChecks += 1;
            syncAdminSwapVisibility();
            if (!adminThemeSelect.classList.contains('d-none') || adminChecks > 30) {
                clearInterval(adminCheckTimer);
            }
        }, 1000);

        adminThemeSelect.value = 'HD1';
        adminThemeSelect.addEventListener('change', () => {
            if (currentGender !== 'male') return;
            applyGender();
        });
    }

    if (genderToggle) {
        genderToggle.addEventListener('click', () => {
            currentGender = currentGender === 'male' ? 'female' : 'male';
            if (currentGender === 'female') {
                genderToggle.innerHTML = '<i class="fas fa-venus me-1"></i><span class="d-none d-sm-inline">Femenino</span>';
            } else {
                genderToggle.innerHTML = '<i class="fas fa-mars me-1"></i><span class="d-none d-sm-inline">Masculino</span>';
            }
            applyGender();
            syncAdminSwapVisibility();
        });
    }

    applyGender();

    const tooltip = document.createElement('div');
    tooltip.className = 'muscle-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tooltip);

    function showTooltip(name, event) {
        tooltip.textContent = name;
        tooltip.style.left = `${event.clientX}px`;
        tooltip.style.top = `${event.clientY}px`;
        tooltip.classList.add('show');
        tooltip.setAttribute('aria-hidden', 'false');
    }

    function hideTooltip() {
        tooltip.classList.remove('show');
        tooltip.setAttribute('aria-hidden', 'true');
    }

    muscles.forEach(muscle => {
        const nameAttr = muscle.getAttribute('data-name') || 'músculo';
        muscle.setAttribute('tabindex', '0');
        muscle.setAttribute('role', 'button');
        muscle.setAttribute('aria-label', nameAttr);
        muscle.setAttribute('aria-pressed', 'false');
    });

    function selectMuscle(name) {
        muscles.forEach(muscle => {
            muscle.classList.remove('active');
            muscle.setAttribute('aria-pressed', 'false');
        });
        document.querySelectorAll(`.muscle[data-name="${name}"]`).forEach(muscle => {
            muscle.classList.add('active');
            muscle.setAttribute('aria-pressed', 'true');
        });
        if (muscleName) {
            muscleName.textContent = name;
        }
        if (muscleTip) {
            muscleTip.textContent = muscleTips[name] || 'Explora ejercicios enfocados en este músculo.';
        }

        if (muscleImages[name] && muscleImage && muscleImageCard) {
            muscleImage.classList.remove('loaded');
            muscleImageCard.classList.add('skeleton-pulse');
            muscleImage.src = `/static/images/muscles/male/${muscleImages[name]}`;
            muscleImageCard.classList.remove('d-none');
        } else {
            muscleImageCard?.classList.add('d-none');
        }
    }

    mapContainer?.addEventListener('click', event => {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }
        const muscle = target.closest('.muscle');
        if (!muscle) {
            return;
        }
        const name = muscle.getAttribute('data-name') || 'músculo';
        selectMuscle(name);
    });

    let tooltipRaf = 0;
    mapContainer?.addEventListener('pointerenter', event => {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }
        const muscle = target.closest('.muscle');
        if (!muscle) {
            return;
        }
        const nameAttr = muscle.getAttribute('data-name');
        if (nameAttr) {
            showTooltip(nameAttr, event);
        }
    }, true);

    mapContainer?.addEventListener('pointermove', event => {
        if (!tooltip.classList.contains('show')) {
            return;
        }
        if (tooltipRaf) {
            cancelAnimationFrame(tooltipRaf);
        }
        tooltipRaf = requestAnimationFrame(() => {
            tooltip.style.left = `${event.clientX}px`;
            tooltip.style.top = `${event.clientY}px`;
        });
    });

    mapContainer?.addEventListener('pointerleave', hideTooltip, true);
    window.addEventListener('scroll', hideTooltip, true);

    document.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }
        const muscle = target.closest('.muscle');
        if (!muscle) {
            return;
        }
        const name = muscle.getAttribute('data-name') || 'músculo';
        event.preventDefault();
        selectMuscle(name);
    });

    clearBtn?.addEventListener('click', clearSelection);

    const modalElement = document.getElementById('imageModal');
    if (modalElement && typeof bootstrap !== 'undefined') {
        const modal = new bootstrap.Modal(modalElement);
        const modalImage = document.getElementById('modalImage');
        const modalTitle = document.getElementById('imageModalLabel');
        const modalTip = document.getElementById('modalMuscleTip');
        const modalDesc = document.getElementById('modalMuscleDesc');

        muscleImageCard?.addEventListener('click', () => {
            if (!muscleImage || !modalImage || !modalTitle || !modalTip || !modalDesc) {
                return;
            }
            if (!muscleImage.src || muscleImageCard.classList.contains('d-none')) {
                return;
            }

            const mapName = muscleName?.textContent || 'músculo';
            modalImage.src = muscleImage.src;
            modalTitle.textContent = mapName;
            modalTip.textContent = muscleTips[mapName] || '';
            const descriptionKey = glossaryMap[mapName];
            modalDesc.innerHTML = muscleDescriptions[descriptionKey] || '';

            modal.show();
        });
    }
});
