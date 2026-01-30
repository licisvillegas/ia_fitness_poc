(function () {
    /**
     * Módulo de Animaciones de Entrenamiento
     * ----------------------------------------------------
     * Contiene una colección de efectos visuales para celebrar hitos,
     * transiciones y momentos clave durante la rutina de entrenamiento.
     * 
     * Dependencias: 
     * - canvas-confetti (para partículas)
     * - anime.js (para animaciones SVG y DOM complejas)
     */
    window.WorkoutAnimations = {};

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    function runTimedInterval(options) {
        var durationMs = options && options.durationMs ? options.durationMs : 0;
        var intervalMs = options && options.intervalMs ? options.intervalMs : 1000;
        var onTick = options && typeof options.onTick === 'function' ? options.onTick : function () { };
        var onEnd = options && typeof options.onEnd === 'function' ? options.onEnd : function () { };

        if (!durationMs || durationMs <= 0) {
            onEnd();
            return function () { };
        }

        var endAt = Date.now() + durationMs;
        var intervalId = setInterval(function () {
            var timeLeft = endAt - Date.now();
            if (timeLeft <= 0) {
                clearInterval(intervalId);
                onEnd();
                return;
            }
            onTick(timeLeft);
        }, intervalMs);

        return function cancelInterval() {
            clearInterval(intervalId);
        };
    }

    /**
     * 1. Confeti Básico (Basic Confetti)
     * ----------------------------------------------------
     * Lanza una explosión simple de confeti desde la parte inferior central.
     * Ideal para completar ejercicios o sets pequeños.
     */
    window.WorkoutAnimations.basicConfetti = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showBasicConfetti === 'function') {
            window.Runner.overlays.showBasicConfetti();
            return;
        }

        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });
    };

    /**
     * 2. Fuegos Artificiales (Fireworks)
     * ----------------------------------------------------
     * Simula fuegos artificiales lanzando partículas desde puntos aleatorios
     * en la parte izquierda y derecha de la pantalla durante 3 segundos.
     * Perfecto para celebrar el final de una rutina completa.
     */
    window.WorkoutAnimations.fireworks = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showFireworks === 'function') {
            window.Runner.overlays.showFireworks();
            return;
        }

        var durationMs = 3 * 1000;
        var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        runTimedInterval({
            durationMs: durationMs,
            intervalMs: 250,
            onTick: function (timeLeft) {
                var particleCount = 50 * (timeLeft / durationMs);

                // Dado que las partículas caen, empiezan un poco más arriba que la posición aleatoria
                confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
                confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
            }
        });
    };

    /**
     * 3. Orgullo Escolar (School Pride)
     * ----------------------------------------------------
     * Lanza chorros continuos de confeti desde ambos lados de la pantalla
     * durante 3 segundos, usando colores rojo y blanco (personalizable).
     * Útil para celebraciones de equipo o logros competitivos.
     */
    window.WorkoutAnimations.schoolPride = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showSchoolPride === 'function') {
            window.Runner.overlays.showSchoolPride();
            return;
        }

        var end = Date.now() + (3 * 1000);
        var colors = ['#bb0000', '#ffffff'];

        (function frame() {
            confetti({
                particleCount: 2,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: colors
            });
            confetti({
                particleCount: 2,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: colors
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    };

    /**
     * 4. Lluvia de Emojis (Emoji Rain)
     * ----------------------------------------------------
     * Hace llover emojis relacionados con fitness (músculo, fuego, trofeo)
     * en lugar de confeti de colores.
     * Agrega un toque temático divertido.
     */
    window.WorkoutAnimations.emojiRain = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showEmojiRain === 'function') {
            window.Runner.overlays.showEmojiRain();
            return;
        }

        try {
            if (typeof confetti.shapeFromText !== 'function') {
                console.warn("confetti.shapeFromText no está definido");
                return;
            }

            var scalar = 3;
            var muscle = confetti.shapeFromText({ text: '💪', scalar });
            var fire = confetti.shapeFromText({ text: '🔥', scalar });
            var trophy = confetti.shapeFromText({ text: '🏆', scalar });

            confetti({
                particleCount: 40,
                spread: 100,
                origin: { y: 0.4 },
                shapes: [muscle, fire, trophy],
                scalar: 2
            });
        } catch (e) {
            console.error("Error en Lluvia de Emojis:", e);
        }
    };

    /**
     * 5. Éxito SVG (SVG Success)
     * ----------------------------------------------------
     * Dibuja una marca de verificación (check) animada en pantalla.
     * Requiere elementos DOM específicos (#checkArea, .check-path, etc.).
     * Si no se encuentran los elementos, la animación no se ejecuta.
     */
    window.WorkoutAnimations.svgSuccess = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showSvgSuccess === 'function') {
            window.Runner.overlays.showSvgSuccess();
            return;
        }

        // Requiere estructura DOM específica usualmente encontrada en animations_showcase
        const container = document.getElementById('checkArea');
        if (!container) return;

        container.style.display = 'block';
        anime.remove('.check-path');
        anime.set('.check-path', { strokeDashoffset: anime.setDashoffset });

        var timeline = anime.timeline({
            easing: 'easeInOutQuad',
            complete: function () {
                setTimeout(() => {
                    anime({
                        targets: '.check-container',
                        opacity: 0,
                        duration: 1000,
                        complete: () => {
                            container.style.display = 'none';
                            container.style.opacity = 1;
                        }
                    });
                }, 2000);
            }
        });

        timeline
            .add({
                targets: '.circle',
                strokeDashoffset: [anime.setDashoffset, 0],
                duration: 800,
                easing: 'easeInOutSine'
            })
            .add({
                targets: '.check',
                strokeDashoffset: [anime.setDashoffset, 0],
                duration: 400,
                easing: 'easeOutBounce'
            }, '-=200')
            .add({
                targets: '.check-container',
                scale: [0.8, 1.2, 1],
                duration: 600,
                easing: 'spring(1, 80, 10, 0)'
            }, '-=400');
    };

    /**
     * 6. Efecto Nieve (Snow Effect)
     * ----------------------------------------------------
     * Simula una suave caída de nieve usando partículas circulares blancas
     * con una ligera deriva lateral. Dura 5 segundos.
     * Puede usarse para enfriamientos ("Cool down").
     */
    window.WorkoutAnimations.snowEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showSnow === 'function') {
            window.Runner.overlays.showSnow();
            return;
        }

        var duration = 5 * 1000;
        var animationEnd = Date.now() + duration;
        var skew = 1;

        (function frame() {
            var timeLeft = animationEnd - Date.now();
            var ticks = Math.max(200, 500 * (timeLeft / duration));
            skew = Math.max(0.8, skew - 0.001);

            confetti({
                particleCount: 1,
                startVelocity: 0,
                ticks: ticks,
                origin: {
                    x: Math.random(),
                    y: (Math.random() * skew) - 0.2
                },
                colors: ['#ffffff'],
                shapes: ['circle'],
                gravity: 0.6,
                scalar: randomInRange(0.4, 1),
                drift: randomInRange(-0.4, 0.4)
            });

            if (timeLeft > 0) {
                requestAnimationFrame(frame);
            }
        }());
    };

    /**
     * 7. Efecto Estrellas (Stars Effect)
     * ----------------------------------------------------
     * Dispara ráfagas de estrellas doradas en secuencia.
     * Ideal para logros de "puntuación perfecta" o récords personales (PR).
     */
    window.WorkoutAnimations.starsEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showStars === 'function') {
            window.Runner.overlays.showStars();
            return;
        }

        var defaults = {
            spread: 360,
            ticks: 50,
            gravity: 0,
            decay: 0.94,
            startVelocity: 30,
            colors: ['#FFE400', '#FFBD00', '#E89400', '#FFCA6C', '#FDFFB8']
        };

        function shoot() {
            confetti({
                ...defaults,
                particleCount: 40,
                scalar: 1.2,
                shapes: ['star']
            });

            confetti({
                ...defaults,
                particleCount: 10,
                scalar: 0.75,
                shapes: ['circle']
            });
        }

        setTimeout(shoot, 0);
        setTimeout(shoot, 100);
        setTimeout(shoot, 200);
    };

    /**
     * 8. Revelado de Texto (Text Reveal)
     * ----------------------------------------------------
     * Muestra un texto (por defecto "RUTINA COMPLETADA") con una animación
     * de revelado estilo "máscara" y letras individuales apareciendo.
     * Crea dinámicamente el DOM necesario si no existe.
     */
    window.WorkoutAnimations.textReveal = function (text = "RUTINA COMPLETADA") {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showTextReveal === 'function') {
            window.Runner.overlays.showTextReveal(text);
            return;
        }

        let el = document.querySelector('.ml11');
        if (!el) {
            const wrapper = document.createElement('div');
            wrapper.className = 'ml11 position-fixed top-50 start-50 translate-middle w-100 text-center';
            wrapper.style.zIndex = 3000;
            wrapper.style.pointerEvents = 'none';
            wrapper.innerHTML = `
            <h1 class="text-wrapper text-white" style="font-weight: 900; font-size: 3.5em; text-transform: uppercase; letter-spacing: 0.5em; text-shadow: 0 0 20px rgba(255,193,7,0.5);">
                <span class="line line1" style="opacity: 0; position: absolute; left: 0; height: 100%; width: 3px; background-color: #ffc107; transform-origin: 0 50%; top:0;"></span>
                <span class="letters">${text}</span>
            </h1>
            `;
            document.body.appendChild(wrapper);

            el = wrapper;
        } else {
            el.querySelector('.letters').innerText = text;
        }

        el.style.display = 'block';
        el.style.opacity = 1;

        const lettersEl = el.querySelector('.letters');
        lettersEl.innerHTML = lettersEl.textContent.replace(/([^\x00-\x80]|\w)/g, "<span class='letter' style='display:inline-block; line-height:1em;'>$&</span>");

        anime.timeline({ loop: false })
            .add({
                targets: '.ml11 .line',
                scaleY: [0, 1],
                opacity: [0.5, 1],
                easing: "easeOutExpo",
                duration: 700
            })
            .add({
                targets: '.ml11 .line',
                translateX: [0, lettersEl.getBoundingClientRect().width + 10],
                easing: "easeOutExpo",
                duration: 700,
                delay: 100
            }).add({
                targets: '.ml11 .letter',
                opacity: [0, 1],
                easing: "easeOutExpo",
                duration: 600,
                offset: '-=775',
                delay: (el, i) => 34 * (i + 1)
            }).add({
                targets: '.ml11',
                opacity: 0,
                duration: 1000,
                easing: "easeOutExpo",
                delay: 1000,
                complete: () => {
                    el.style.display = 'none';
                    el.remove();
                }
            });
    };

    /**
     * 9. Fuente (Fountain)
     * ----------------------------------------------------
     * Lanza partículas continuamente hacia arriba desde la parte inferior,
     * cayendo como una fuente de agua o confeti. Dura 3 segundos.
     */
    window.WorkoutAnimations.fountainEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showFountain === 'function') {
            window.Runner.overlays.showFountain();
            return;
        }

        var durationMs = 3 * 1000;

        runTimedInterval({
            durationMs: durationMs,
            intervalMs: 100,
            onTick: function () {
                var particleCount = 20;

                confetti({
                    particleCount: particleCount,
                    startVelocity: 45,
                    spread: 80,
                    origin: { y: 0.9 },
                    gravity: 1.2,
                    drift: 0,
                    scalar: 1,
                    colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
                });
            }
        });
    };

    /**
     * 10. Mega Explosión (Mega Burst)
     * ----------------------------------------------------
     * Una explosión masiva y multicapa de confeti con formas variadas (triángulos, cuadrados).
     * Ideal para el momento cumbre del entrenamiento.
     */
    window.WorkoutAnimations.megaBurst = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showMegaBurst === 'function') {
            window.Runner.overlays.showMegaBurst();
            return;
        }

        try {
            var shapes = ['circle', 'square'];
            if (typeof confetti.shapeFromPath === 'function') {
                try {
                    var triangle = confetti.shapeFromPath({ path: 'M0 10 L5 0 L10 10z' });
                    var square = confetti.shapeFromPath({ path: 'M0 0 L10 0 L10 10 L0 10z' });
                    shapes = [triangle, square];
                } catch (err) { }
            }

            function fire(particleRatio, opts) {
                confetti(Object.assign({}, {
                    origin: { y: 0.7 },
                    shapes: shapes
                }, opts, {
                    particleCount: Math.floor(200 * particleRatio)
                }));
            }

            fire(0.25, { spread: 26, startVelocity: 55 });
            fire(0.2, { spread: 60 });
            fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
            fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
            fire(0.1, { spread: 120, startVelocity: 45 });
        } catch (e) {
            confetti({ particleCount: 100, startVelocity: 30, spread: 360, origin: { x: 0.5, y: 0.5 } });
        }
    };

    /**
     * 11. Efecto Glitch (Glitch Effect)
     * ----------------------------------------------------
     * Muestra texto con un efecto visual de distorsión digital o "glitch".
     * Inyecta estilos CSS temporalmente para lograr el efecto cyberpunk.
     */
    let glitchTimeout;
    window.WorkoutAnimations.glitchEffect = function (text = "RUTINA COMPLETADA") {
        let el = document.querySelector('.glitch-wrapper');
        if (!el) {
            const wrapper = document.createElement('div');
            wrapper.className = 'glitch-wrapper position-fixed top-50 start-50 translate-middle w-100 text-center';
            wrapper.style.zIndex = 3000;
            wrapper.innerHTML = `
                <h1 class="glitch" data-text="${text}">${text}</h1>
            `;
            document.body.appendChild(wrapper);

            if (!document.getElementById('glitch-css')) {
                const style = document.createElement('style');
                style.id = 'glitch-css';
                style.innerHTML = `
                    .glitch { font-size: 3.5rem; font-weight: bold; text-transform: uppercase; position: relative; color: white; letter-spacing: 0.1em; opacity: 0; transition: opacity 0.5s; font-family: monospace}
                    .glitch.active { opacity: 1; }
                    .glitch.active::before, .glitch.active::after {
                        content: attr(data-text);
                        position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.8;
                    }
                    .glitch.active::before { color: #0ff; z-index: -1; animation: glitch-anim-1 0.4s infinite linear alternate-reverse; }
                    .glitch.active::after { color: #f0f; z-index: -2; animation: glitch-anim-2 0.4s infinite linear alternate-reverse; }
                    
                    @keyframes glitch-anim-1 {
                        0% { clip-path: inset(20% 0 80% 0); transform: translate(-2px,0); }
                        20% { clip-path: inset(60% 0 10% 0); transform: translate(2px,0); }
                        40% { clip-path: inset(40% 0 50% 0); transform: translate(-2px,0); }
                        60% { clip-path: inset(80% 0 5% 0); transform: translate(2px,0); }
                        80% { clip-path: inset(10% 0 70% 0); transform: translate(-2px,0); }
                        100% { clip-path: inset(30% 0 20% 0); transform: translate(2px,0); }
                    }
                    @keyframes glitch-anim-2 {
                        0% { clip-path: inset(10% 0 60% 0); transform: translate(2px,0); }
                        20% { clip-path: inset(80% 0 5% 0); transform: translate(-2px,0); }
                        40% { clip-path: inset(30% 0 20% 0); transform: translate(2px,0); }
                        60% { clip-path: inset(15% 0 80% 0); transform: translate(-2px,0); }
                        80% { clip-path: inset(55% 0 10% 0); transform: translate(2px,0); }
                    }
                `;
                document.head.appendChild(style);
            }
            el = wrapper;
        } else {
            const h1 = el.querySelector('.glitch');
            h1.innerText = text;
            h1.setAttribute('data-text', text);
        }

        const glitchText = el.querySelector('.glitch');
        if (glitchTimeout) clearTimeout(glitchTimeout);
        glitchText.classList.add('active');

        glitchTimeout = setTimeout(() => {
            glitchText.classList.remove('active');
            el.remove();
        }, 3000);
    };

    /**
     * 12. Realista (Realistic Effect)
     * ----------------------------------------------------
     * Lanzamiento de confeti simulando física realista con diferentes
     * propiedades de caída y dispersión.
     */
    window.WorkoutAnimations.realisticEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showRealistic === 'function') {
            window.Runner.overlays.showRealistic();
            return;
        }

        var count = 200;
        var defaults = { origin: { y: 0.7 } };
        function fire(particleRatio, opts) {
            confetti(Object.assign({}, defaults, opts, {
                particleCount: Math.floor(count * particleRatio)
            }));
        }
        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
    };

    /**
     * 13. Orgullo (Pride Effect)
     * ----------------------------------------------------
     * Lanza confeti con los colores del arcoíris desde ambos lados.
     */
    window.WorkoutAnimations.prideEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showPride === 'function') {
            window.Runner.overlays.showPride();
            return;
        }

        var end = Date.now() + (3 * 1000);
        var colors = ['#ff0000', '#ffa500', '#ffff00', '#008000', '#0000ff', '#4b0082', '#ee82ee'];
        (function frame() {
            confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: colors });
            confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: colors });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    };

    /**
     * 14. Pulso (Pulse Effect)
     * ----------------------------------------------------
     * Muestra un corazón gigante que palpita y se desvanece en el centro de la pantalla.
     * Representa esfuerzo cardiovascular o pasión.
     */
    window.WorkoutAnimations.pulseEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showPulse === 'function') {
            window.Runner.overlays.showPulse();
            return;
        }

        let heart = document.createElement('div');
        heart.className = 'position-fixed top-50 start-50 translate-middle text-danger';
        heart.style.fontSize = '0px';
        heart.style.zIndex = '3000';
        heart.innerHTML = '<i class="fas fa-heart"></i>';
        document.body.appendChild(heart);

        // Animar el icono del corazón (5 latidos)
        anime({
            targets: heart,
            fontSize: [
                { value: '250px', duration: 300, easing: 'easeOutQuad' },
                { value: '200px', duration: 150, easing: 'easeInQuad' }
            ],
            opacity: { value: [1, 0.4], duration: 450, easing: 'linear' },
            loop: 5,
            complete: () => {
                // Desvanecer al final
                anime({
                    targets: heart,
                    opacity: 0,
                    scale: 3,
                    duration: 500,
                    easing: 'easeOutExpo',
                    complete: () => heart.remove()
                });
            }
        });

        // Animar borde de la tarjeta activa (si existe)
        const activeCard = document.querySelector('.active-card');
        if (activeCard) {
            // Guardar estilo original
            const originalBorder = activeCard.style.borderColor;
            const originalShadow = activeCard.style.boxShadow;

            activeCard.style.border = '2px solid transparent'; // Preparar para animación

            anime({
                targets: activeCard,
                borderColor: ['rgba(220, 53, 69, 0)', '#dc3545', 'rgba(220, 53, 69, 0)'], // Rojo Bootstrap
                boxShadow: [
                    '0 0 0 rgba(220, 53, 69, 0)',
                    '0 0 20px rgba(220, 53, 69, 0.6)',
                    '0 0 0 rgba(220, 53, 69, 0)'
                ],
                duration: 900, // Duración de un latido completo (300+150 * 2 fases ~ 900)
                easing: 'easeInOutSine',
                loop: 5,
                complete: () => {
                    // Restaurar estilos originales
                    activeCard.style.borderColor = originalBorder;
                    activeCard.style.boxShadow = originalShadow;
                }
            });
        }
    };

    /**
     * 15. Flexión (Flex Effect)
     * ----------------------------------------------------
     * Muestra un emoji de brazo musculoso ("flex") que crece y se eleva.
     * Clásico símbolo de fuerza y ganancia muscular.
     */
    window.WorkoutAnimations.flexEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showFlex === 'function') {
            window.Runner.overlays.showFlex();
            return;
        }

        let icon = document.createElement('div');
        icon.className = 'position-fixed top-50 start-50 translate-middle text-warning';
        icon.style.fontSize = '0px';
        icon.style.zIndex = '3000';
        icon.innerHTML = '💪';
        document.body.appendChild(icon);

        anime({
            targets: icon,
            fontSize: ['0px', '200px'],
            translateY: [0, -100],
            opacity: [1, 0],
            duration: 3000,
            easing: 'easeOutExpo',
            complete: () => icon.remove()
        });
    };

    /**
     * 16. Trueno (Thunder Effect)
     * ----------------------------------------------------
     * Simula un relámpago con un flash blanco en toda la pantalla seguido
     * de un icono de rayo parpadeante. ¡Energía pura!
     */
    window.WorkoutAnimations.thunderEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showThunder === 'function') {
            window.Runner.overlays.showThunder();
            return;
        }

        let flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = 0;
        flash.style.left = 0;
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.backgroundColor = '#fff';
        flash.style.zIndex = 3000;
        flash.style.opacity = 0;
        flash.style.pointerEvents = 'none';
        document.body.appendChild(flash);

        anime({
            targets: flash,
            opacity: [0.8, 0],
            duration: 500,
            easing: 'easeOutQuad',
            complete: () => flash.remove()
        });

        let bolt = document.createElement('div');
        bolt.className = 'position-fixed top-50 start-50 translate-middle text-info';
        bolt.style.fontSize = '200px';
        bolt.style.zIndex = '3001';
        bolt.style.textShadow = '0 0 50px #0dcaf0';
        bolt.innerHTML = '<i class="fas fa-bolt"></i>';
        bolt.style.opacity = 0;
        document.body.appendChild(bolt);

        anime({
            targets: bolt,
            opacity: [0, 1, 0, 1, 0],
            scale: [0.8, 1.2],
            duration: 800,
            easing: 'steps(5)',
            complete: () => bolt.remove()
        });
    };

    /**
     * 17. Victoria (Victory Effect)
     * ----------------------------------------------------
     * Hace caer una medalla de oro desde arriba, rebotando en el centro,
     * acompañada de confeti dorado. La recompensa final.
     */
    window.WorkoutAnimations.victoryEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showVictory === 'function') {
            window.Runner.overlays.showVictory();
            return;
        }

        let medal = document.createElement('div');
        medal.className = 'position-fixed start-50 translate-middle-x';
        medal.style.top = '-100px';
        medal.style.fontSize = '150px';
        medal.style.zIndex = '3000';
        medal.style.color = 'gold';
        medal.style.filter = 'drop-shadow(0 10px 10px rgba(0,0,0,0.5))';
        medal.innerHTML = '<i class="fas fa-medal"></i>';
        document.body.appendChild(medal);

        anime({
            targets: medal,
            top: ['-100px', '40%'],
            rotate: [-15, 15, -10, 10, 0],
            duration: 2000,
            easing: 'spring(1, 80, 10, 0)',
            complete: () => {
                setTimeout(() => {
                    anime({
                        targets: medal,
                        opacity: 0,
                        duration: 500,
                        complete: () => medal.remove()
                    });
                }, 1000);
            }
        });

        confetti({
            particleCount: 50,
            spread: 70,
            origin: { y: 0.3 },
            colors: ['#FFD700', '#FFA500']
        });
    };

    /**
     * 20. Cuenta Regresiva (Countdown 3-2-1)
     * ----------------------------------------------------
     * Muestra una cuenta regresiva grande y animada (3, 2, 1, ¡GO!).
     * Incluye vibración táctil si está disponible en el dispositivo.
     * Ejecuta un callback `onComplete` al finalizar.
     */
    window.WorkoutAnimations.countdownEffect = function (onComplete) {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showCountdown === 'function') {
            window.Runner.overlays.showCountdown(onComplete);
            return;
        }

        let container = document.createElement('div');
        container.className = 'position-fixed top-50 start-50 translate-middle text-center';
        container.style.zIndex = '3000';
        container.style.pointerEvents = 'none'; // Permite clicks a través
        document.body.appendChild(container);

        let number = document.createElement('h1');
        number.style.fontSize = '0px';
        number.style.fontWeight = '900';
        number.style.color = '#ffc107';
        number.style.textShadow = '0 0 20px rgba(0,0,0,0.8)';
        number.style.fontFamily = "'Anton', sans-serif"; // Fuente gruesa preferida
        container.appendChild(number);

        let steps = ['3', '2', '1', '¡GO!'];

        let tl = anime.timeline({
            complete: () => {
                container.remove();
                if (onComplete) onComplete();
            }
        });

        steps.forEach((step, index) => {
            tl.add({
                targets: number,
                fontSize: ['0px', '180px'],
                opacity: [0, 1],
                rotate: [-30, 0],
                duration: 500,
                easing: 'easeOutBack',
                begin: () => {
                    number.innerText = step;
                    if (index === 3) number.style.color = '#28a745'; // Verde para GO
                    else number.style.color = '#ffc107';

                    // Intenta usar vibración nativa del dispositivo
                    if (navigator.vibrate) navigator.vibrate(50);
                }
            }).add({
                targets: number,
                opacity: 0,
                scale: 1.5,
                duration: 300,
                easing: 'easeInQuad'
            });
        });
    };

    /**
     * 21. Impacto (Impact Effect)
     * ----------------------------------------------------
     * Simula un golpe fuerte contra el suelo.
     * Lanza polvo/partículas grises desde abajo con fuerza.
     */
    window.WorkoutAnimations.impactEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showImpact === 'function') {
            window.Runner.overlays.showImpact();
            return;
        }

        confetti({
            particleCount: 80,
            spread: 120,
            origin: { y: 1 },
            startVelocity: 60,
            colors: ['#808080', '#696969', '#A9A9A9'],
            drift: 0,
            gravity: 0.8,
            scalar: 1.5,
            shapes: ['circle']
        });

        setTimeout(() => {
            confetti({
                particleCount: 60,
                spread: 150,
                origin: { y: 1 },
                startVelocity: 40,
                colors: ['#D3D3D3', '#F5F5F5'],
                scalar: 0.8
            });
        }, 100);
    };

    /**
     * 22. Modo Fuego (Fire Mode)
     * ----------------------------------------------------
     * Genera llamas continuas desde la parte inferior central.
     * Ideal para rachas de "on fire" o entrenamientos intensos.
     */
    window.WorkoutAnimations.fireEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showFire === 'function') {
            window.Runner.overlays.showFire();
            return;
        }

        var duration = 3 * 1000;
        var animationEnd = Date.now() + duration;

        (function frame() {
            var timeLeft = animationEnd - Date.now();

            confetti({
                particleCount: 5,
                spread: 30,
                startVelocity: 40,
                origin: { y: 1, x: 0.5 },
                colors: ['#ff0000', '#ff4500', '#ffa500'],
                shapes: ['circle'],
                gravity: 0.8,
                scalar: 1.2,
                drift: (Math.random() - 0.5) * 1
            });

            if (Math.random() > 0.8) {
                confetti({
                    particleCount: 2,
                    spread: 60,
                    startVelocity: 55,
                    origin: { y: 1, x: 0.5 },
                    colors: ['#ffd700'],
                    scalar: 0.6
                });
            }

            if (timeLeft > 0) {
                requestAnimationFrame(frame);
            }
        }());
    };

    /**
     * 23. Efecto Respiración (Breathing Effect)
     * ----------------------------------------------------
     * Guía visual para la respiración (coherencia cardíaca, relajación).
     * Muestra un círculo que se expande (Inhala) y contrae (Exhala).
     * Retorna una función de limpieza para detener la animación manualmente.
     */
    window.WorkoutAnimations.breathingEffect = function (durationSeconds = 10, onComplete) {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showBreathing === 'function') {
            return window.Runner.overlays.showBreathing(durationSeconds, onComplete);
        }

        // Crear círculo
        let circle = document.createElement('div');
        circle.style.width = '150px';
        circle.style.height = '150px';
        circle.style.borderRadius = '50%';
        circle.style.backgroundColor = '#0dcaf0';
        circle.style.position = 'fixed';
        circle.style.top = '50%';
        circle.style.left = '50%';
        circle.style.transform = 'translate(-50%, -50%)';
        circle.style.zIndex = '2000';
        circle.style.opacity = '0.5';
        circle.style.boxShadow = '0 0 50px #0dcaf0';
        circle.style.pointerEvents = 'none';
        document.body.appendChild(circle);

        let text = document.createElement('div');
        text.className = 'position-fixed top-50 start-50 translate-middle text-white fw-bold h1';
        text.style.zIndex = '2001';
        text.style.pointerEvents = 'none';
        text.innerText = "Inhala...";
        text.style.textShadow = '0 0 10px rgba(0,0,0,0.5)';
        document.body.appendChild(text);

        // Un ciclo de respiración (in + out) aprox 8000ms.
        // 4s expandir (inhala), 4s contraer (exhala).

        let loopCount = Math.ceil(durationSeconds / 8);
        if (loopCount < 1) loopCount = 1;

        let tl = anime.timeline({
            loop: loopCount * 2, // anime cuenta direcciones como iteraciones.
            direction: 'alternate',
            loopComplete: function (anim) {
                // Cambia el texto al completar una fase (expansión o contracción)
                text.innerText = text.innerText === "Inhala..." ? "Exhala..." : "Inhala...";
            },
            complete: () => {
                circle.remove();
                text.remove();
                if (onComplete) onComplete();
            }
        });

        tl.add({
            targets: circle,
            scale: [1, 2.5],
            opacity: [0.5, 0.2],
            duration: 4000,
            easing: 'easeInOutSine',
            changeBegin: function (anim) {
                // Sincronización precisa puede requerir lógica adicional
            }
        });

        // Función de limpieza para detener externamente
        return () => {
            tl.pause();
            anime.remove(circle);
            if (circle.parentNode) circle.remove();
            if (text.parentNode) text.remove();
        };
    };

    /**
     * 24. Efecto Tristeza / Deserción (Sadness / Give Up)
     * ----------------------------------------------------
     * Muestra una nube de lluvia y simula gotas cayendo (lluvia).
     * Representa sentimientos de tristeza, haber abandonado o dificultad extrema.
     */
    window.WorkoutAnimations.sadEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showSad === 'function') {
            window.Runner.overlays.showSad();
            return;
        }

        // Icono Nube
        let icon = document.createElement('div');
        icon.className = 'position-fixed top-50 start-50 translate-middle';
        icon.style.fontSize = '150px';
        icon.style.zIndex = '3000';
        icon.innerHTML = '🌧️';
        icon.style.opacity = 0;
        icon.style.filter = 'drop-shadow(0 10px 10px rgba(0,0,0,0.5)) grayscale(0.5)';
        document.body.appendChild(icon);

        anime({
            targets: icon,
            opacity: [0, 1, 1, 0],
            translateY: [0, 20],
            scale: [0.8, 1],
            duration: 4000,
            easing: 'easeInOutQuad',
            complete: () => icon.remove()
        });

        // Lluvia (Rain) de confeti azul/gris
        var duration = 3 * 1000;
        var end = Date.now() + duration;

        (function frame() {
            confetti({
                particleCount: 3,
                angle: 270, // Hacia abajo
                spread: 15,
                origin: { x: Math.random(), y: -0.1 }, // Desde arriba
                colors: ['#4287f5', '#a6c1ee', '#1a4e8a', '#5c6fa3'], // Tonos azules y grisaceos
                gravity: 2.5, // Cae rápido
                drift: 0,
                ticks: 300,
                scalar: 0.6,
                shapes: ['circle']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    };

    /**
     * 25. Timer Resistencia (Endurance Timer)
     * ----------------------------------------------------
     * Muestra un anillo de progreso sincronizado con un tiempo definido.
     * Útil para ejercicios isométricos o de resistencia por tiempo.
     */
    window.WorkoutAnimations.enduranceTimerEffect = function (durationSeconds = 10, onComplete) {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showEnduranceTimer === 'function') {
            return window.Runner.overlays.showEnduranceTimer(durationSeconds, onComplete);
        }

        // Contenedor
        let container = document.createElement('div');
        container.className = 'position-fixed top-50 start-50 translate-middle d-flex align-items-center justify-content-center';
        container.style.zIndex = '3000';
        container.style.width = '200px';
        container.style.height = '200px';
        document.body.appendChild(container);

        // SVG Ring
        container.innerHTML = `
            <svg width="200" height="200" viewBox="0 0 200 200" style="transform: rotate(-90deg);">
                <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="15" />
                <circle class="progress-ring" cx="100" cy="100" r="90" fill="none" stroke="#ffc107" stroke-width="15" 
                        stroke-dasharray="565.48" stroke-dashoffset="0" stroke-linecap="round" />
            </svg>
            <div class="timer-text position-absolute text-white fw-bold display-4" style="text-shadow: 0 0 10px black;">
                ${durationSeconds}
            </div>
        `;

        const ring = container.querySelector('.progress-ring');
        const text = container.querySelector('.timer-text');
        const circumference = 2 * Math.PI * 90; // approx 565.48

        // Animar el strokeDashoffset de 0 a circumference (vaciando)
        let anim = anime({
            targets: ring,
            strokeDashoffset: [0, circumference],
            easing: 'linear',
            duration: durationSeconds * 1000,
            update: function (anim) {
                // Actualizar texto
                const progress = anim.progress / 100;
                const remaining = Math.ceil(durationSeconds * (1 - progress));
                // Evitar mostrar -0 o saltos raros
                if (text && text.parentNode) text.innerText = remaining > 0 ? remaining : 0;
            },
            complete: () => {
                if (text && text.parentNode) text.innerText = "OK";
                // Pequeño punch al finalizar
                anime({
                    targets: container,
                    scale: [1, 1.2, 0],
                    opacity: 0,
                    duration: 800,
                    easing: 'easeOutExpo',
                    complete: () => {
                        if (container.parentNode) container.remove();
                        if (onComplete) onComplete();
                    }
                });
            }
        });

        // Retornar función de limpieza
        return () => {
            if (anim) anim.pause();
            anime.remove(ring);
            anime.remove(container);
            if (container.parentNode) container.remove();
        };
    };

    /**
     * 26. Efecto Pausa (Pause Effect)
     * ----------------------------------------------------
     * Muestra un overlay de pausa con un icono pulsante.
     * Retorna una funcion para quitar la pausa.
     */
    window.WorkoutAnimations.pauseEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showPause === 'function') {
            return window.Runner.overlays.showPause();
        }

        // Contenedor Overlay
        let overlay = document.createElement('div');
        overlay.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.6)';
        overlay.style.backdropFilter = 'blur(5px)';
        overlay.style.zIndex = '4000';
        overlay.style.opacity = '0';
        document.body.appendChild(overlay);

        // Contenido
        let content = document.createElement('div');
        content.className = 'text-center text-white';
        content.innerHTML = `
            <div class="pause-icon display-1 mb-3"><i class="fas fa-pause-circle"></i></div>
            <h2 class="display-4 fw-bold">PAUSA</h2>
            <p class="h5 opacity-75">Tómate tu tiempo</p>
        `;
        overlay.appendChild(content);

        // Animar entrada
        anime({
            targets: overlay,
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutQuad'
        });

        // Loop pulsante del icono
        let pulseAnim = anime({
            targets: content.querySelector('.pause-icon'),
            scale: [1, 1.1],
            opacity: [0.8, 1],
            duration: 1000,
            direction: 'alternate',
            loop: true,
            easing: 'easeInOutSine'
        });

        // Función de limpieza (Resume)
        const resume = () => {
            pulseAnim.pause();
            anime({
                targets: overlay,
                opacity: 0,
                scale: 1.1,
                duration: 300,
                easing: 'easeInQuad',
                complete: () => {
                    if (overlay.parentNode) overlay.remove();
                }
            });
        };

        // Permitir cerrar con click (opcional, para UX rápida)
        overlay.addEventListener('click', resume);

        return resume;
    };

    /**
     * 27. Efecto Meta (Goal Effect)
     * ----------------------------------------------------
     * Muestra banderas a cuadros cruzándose y texto de victoria.
     * Ideal para terminar la rutina completa.
     */
    window.WorkoutAnimations.goalEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showGoal === 'function') {
            window.Runner.overlays.showGoal();
            return;
        }

        // Contenedor
        let container = document.createElement('div');
        container.className = 'goal-effect position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center pointer-events-none';
        container.style.zIndex = '3500';
        document.body.appendChild(container);

        // Texto
        let text = document.createElement('h1');
        text.className = 'display-1 fw-bold text-white mb-4';
        text.style.textShadow = '0 0 20px #FFD700';
        text.innerText = "¡META ALCANZADA!";
        text.style.transform = 'scale(0)';
        container.appendChild(text);

        // Banderas (usando FontAwesome iconos como base SVG o simplemente iconos escalados)
        let flagsContainer = document.createElement('div');
        flagsContainer.className = 'd-flex justify-content-center gap-5';
        flagsContainer.innerHTML = `
            <div class="flag-left display-1 text-white"><i class="fas fa-flag-checkered"></i></div>
            <div class="flag-right display-1 text-white"><i class="fas fa-flag-checkered"></i></div>
        `;
        container.appendChild(flagsContainer);

        // Animación Texto
        anime({
            targets: text,
            scale: [0, 1.2, 1],
            opacity: [0, 1],
            duration: 1200,
            easing: 'easeOutElastic(1, .6)'
        });

        // Animación Banderas (Entrada y ondeado simulado)
        let tl = anime.timeline({
            easing: 'easeOutExpo'
        });

        tl.add({
            targets: '.flag-left',
            translateX: ['-100vw', 0],
            rotate: [-45, 0],
            duration: 1000,
            delay: 200
        }).add({
            targets: '.flag-right',
            translateX: ['100vw', 0],
            rotate: [45, 0],
            duration: 1000,
            delay: 200 // Wait a bit relative to start or absolute
        }, '-=1000');

        // Confetti extra
        window.WorkoutAnimations.realisticEffect();

        // Limpieza automática
        setTimeout(() => {
            anime({
                targets: container,
                opacity: 0,
                duration: 500,
                easing: 'easeInQuad',
                complete: () => container.remove()
            });
        }, 4000);
    };

    /**
     * 28. Efecto Nutrición (Nutrition Effect)
     * ----------------------------------------------------
     * Muestra una animación de preparación de alimentos.
     * Iconos de cocina y texto "PREPARANDO ALIMENTACIÓN".
     */
    window.WorkoutAnimations.nutritionEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showNutrition === 'function') {
            window.Runner.overlays.showNutrition();
            return;
        }

        // Contenedor
        let container = document.createElement('div');
        container.className = 'nutrition-effect position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center';
        container.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'; // Fondo claro para diferenciar
        container.style.zIndex = '3500';
        container.style.opacity = '0';
        document.body.appendChild(container);

        // Icono Principal
        let iconContainer = document.createElement('div');
        iconContainer.className = 'display-1 text-success mb-4';
        iconContainer.innerHTML = '<i class="fas fa-utensils"></i>';
        container.appendChild(iconContainer);

        // Texto
        let text = document.createElement('h2');
        text.className = 'display-5 fw-bold text-dark text-center';
        text.innerText = "PREPARANDO ALIMENTACIÓN...";
        container.appendChild(text);

        // Elementos flotantes (ingredientes)
        const ingredients = ['fa-carrot', 'fa-apple-alt', 'fa-leaf', 'fa-lemon'];
        for (let i = 0; i < 8; i++) {
            let el = document.createElement('div');
            el.className = `position-absolute text-success opacity-50`;
            el.style.fontSize = (Math.random() * 2 + 1) + 'rem';
            el.style.left = Math.random() * 100 + 'vw';
            el.style.top = Math.random() * 100 + 'vh';
            el.innerHTML = `<i class="fas ${ingredients[Math.floor(Math.random() * ingredients.length)]}"></i>`;
            container.appendChild(el);

            anime({
                targets: el,
                translateY: [0, -100],
                opacity: [0.5, 0],
                duration: 2000 + Math.random() * 1000,
                loop: true,
                easing: 'linear',
                delay: Math.random() * 1000
            });
        }

        // Animar entrada
        anime({
            targets: container,
            opacity: [0, 1],
            duration: 500,
            easing: 'easeOutQuad'
        });

        // Loop icono principal (círculo)
        anime({
            targets: iconContainer,
            rotate: '1turn',
            duration: 3000,
            loop: true,
            easing: 'linear'
        });

        // Limpieza automática (simulando carga)
        setTimeout(() => {
            anime({
                targets: container,
                opacity: 0,
                duration: 500,
                easing: 'easeInQuad',
                complete: () => container.remove()
            });
        }, 3500);
    };

    /**
     * 29. Efecto Preparando Rutina (Routine Preparation Effect)
     * ----------------------------------------------------
     * Muestra una animación de carga de rutina.
     * Iconos de fitness y texto "PREPARANDO RUTINA".
     */
    window.WorkoutAnimations.routinePreparationEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showRoutinePreparation === 'function') {
            window.Runner.overlays.showRoutinePreparation();
            return;
        }

        // Contenedor
        let container = document.createElement('div');
        container.className = 'routine-prep-effect position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center';
        container.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'; // Fondo claro
        container.style.zIndex = '3500';
        container.style.opacity = '0';
        document.body.appendChild(container);

        // Icono Principal
        let iconContainer = document.createElement('div');
        iconContainer.className = 'display-1 text-primary mb-4';
        iconContainer.innerHTML = '<i class="fas fa-dumbbell"></i>';
        container.appendChild(iconContainer);

        // Texto
        let text = document.createElement('h2');
        text.className = 'display-5 fw-bold text-dark text-center';
        text.innerText = "PREPARANDO RUTINA...";
        container.appendChild(text);

        // Elementos flotantes (fitness)
        const items = ['fa-running', 'fa-heartbeat', 'fa-bolt', 'fa-stopwatch', 'fa-dumbbell'];
        for (let i = 0; i < 8; i++) {
            let el = document.createElement('div');
            el.className = `position-absolute text-primary opacity-50`;
            el.style.fontSize = (Math.random() * 2 + 1) + 'rem';
            el.style.left = Math.random() * 100 + 'vw';
            el.style.top = Math.random() * 100 + 'vh';
            el.innerHTML = `<i class="fas ${items[Math.floor(Math.random() * items.length)]}"></i>`;
            container.appendChild(el);

            anime({
                targets: el,
                translateY: [0, -100],
                opacity: [0.5, 0],
                duration: 2000 + Math.random() * 1000,
                loop: true,
                easing: 'linear',
                delay: Math.random() * 1000
            });
        }

        // Animar entrada
        anime({
            targets: container,
            opacity: [0, 1],
            duration: 500,
            easing: 'easeOutQuad'
        });

        // Loop icono principal (pulse + rotate)
        anime({
            targets: iconContainer,
            scale: [1, 1.2],
            duration: 1000,
            direction: 'alternate',
            loop: true,
            easing: 'easeInOutSine'
        });

        // Limpieza automática
        setTimeout(() => {
            anime({
                targets: container,
                opacity: 0,
                duration: 500,
                easing: 'easeInQuad',
                complete: () => container.remove()
            });
        }, 3500);
    };

    /**
     * 30. Efecto Zen (Zen Effect)
     * ----------------------------------------------------
     * Muestra un overlay oscuro y relajante con burbujas flotando suavemente hacia arriba.
     * Ideal para momentos de calma o cancelación suave.
     */
    window.WorkoutAnimations.zenEffect = function () {
        if (window.Runner && window.Runner.overlays && typeof window.Runner.overlays.showZen === 'function') {
            window.Runner.overlays.showZen();
            return;
        }

        // Calm blue overlay
        let overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = 0;
        overlay.style.left = 0;
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'radial-gradient(circle, #2d3436 0%, #000000 100%)';
        overlay.style.zIndex = '1999';
        overlay.style.opacity = 0;
        document.body.appendChild(overlay);

        anime({
            targets: overlay,
            opacity: 0.9,
            duration: 2000,
            direction: 'alternate',
            delay: 0,
            endDelay: 3000,
            easing: 'easeInOutQuad',
            complete: () => overlay.remove()
        });

        // Slow rising bubbles
        var duration = 6 * 1000;
        var animationEnd = Date.now() + duration;

        (function frame() {
            var timeLeft = animationEnd - Date.now();

            confetti({
                particleCount: 1,
                startVelocity: 0,
                ticks: 200,
                origin: {
                    x: Math.random(),
                    // start from bottom
                    y: 1.1
                },
                colors: ['#a8e6cf', '#dcedc1', '#ffd3b6'],
                shapes: ['circle'],
                gravity: -0.2, // float up
                scalar: 2,
                drift: 0,
                opacity: 0.5
            });

            if (timeLeft > 0) {
                // Less frequent
                if (Math.random() > 0.8) requestAnimationFrame(frame);
                else setTimeout(() => { if (Date.now() < animationEnd) frame(); }, 50);
            }
        }());
    };

})();
