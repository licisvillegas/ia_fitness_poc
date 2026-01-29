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

    /**
     * 1. Confeti Básico (Basic Confetti)
     * ----------------------------------------------------
     * Lanza una explosión simple de confeti desde la parte inferior central.
     * Ideal para completar ejercicios o sets pequeños.
     */
    window.WorkoutAnimations.basicConfetti = function () {
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
        var duration = 3 * 1000;
        var animationEnd = Date.now() + duration;
        var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        var interval = setInterval(function () {
            var timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            var particleCount = 50 * (timeLeft / duration);

            // Dado que las partículas caen, empiezan un poco más arriba que la posición aleatoria
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
    };

    /**
     * 3. Orgullo Escolar (School Pride)
     * ----------------------------------------------------
     * Lanza chorros continuos de confeti desde ambos lados de la pantalla
     * durante 3 segundos, usando colores rojo y blanco (personalizable).
     * Útil para celebraciones de equipo o logros competitivos.
     */
    window.WorkoutAnimations.schoolPride = function () {
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
        var duration = 3 * 1000;
        var animationEnd = Date.now() + duration;

        var interval = setInterval(function () {
            var timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);

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
        }, 100);
    };

    /**
     * 10. Mega Explosión (Mega Burst)
     * ----------------------------------------------------
     * Una explosión masiva y multicapa de confeti con formas variadas (triángulos, cuadrados).
     * Ideal para el momento cumbre del entrenamiento.
     */
    window.WorkoutAnimations.megaBurst = function () {
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
                    .glitch { font-size: 5rem; font-weight: bold; text-transform: uppercase; position: relative; color: white; letter-spacing: 0.1em; opacity: 0; transition: opacity 0.5s; font-family: monospace}
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
        let heart = document.createElement('div');
        heart.className = 'position-fixed top-50 start-50 translate-middle text-danger';
        heart.style.fontSize = '0px';
        heart.style.zIndex = '3000';
        heart.innerHTML = '<i class="fas fa-heart"></i>';
        document.body.appendChild(heart);

        anime({
            targets: heart,
            fontSize: ['0px', '250px'],
            opacity: [1, 0],
            duration: 1500,
            easing: 'easeOutExpo',
            complete: () => heart.remove()
        });
    };

    /**
     * 15. Flexión (Flex Effect)
     * ----------------------------------------------------
     * Muestra un emoji de brazo musculoso ("flex") que crece y se eleva.
     * Clásico símbolo de fuerza y ganancia muscular.
     */
    window.WorkoutAnimations.flexEffect = function () {
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
            duration: 1200,
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

})();
