# Efectos y Feedback del Sistema

Este documento detalla los efectos visuales, auditivos y hápticos disponibles en la aplicación Synapse Fit para enriquecer la experiencia del usuario.

## 1. Efectos Visuales (Animaciones)
Gestionados principalmente por `static/js/workout_animations.js`.

### Pantalla Completa
*   **Glitch Effect:**
    *   **Descripción:** Distorsión visual momentánea de la pantalla con texto personalizado.
    *   **Uso Actual:** Al cancelar una rutina ("RUTINA CANCELADA").
    *   **Función:** `window.WorkoutAnimations.glitchEffect(text)`
*   **Zen Mode:**
    *   **Descripción:** Desvanecimiento suave a negro o pantalla limpia.
    *   **Uso Actual:** Transición post-cancelación.
    *   **Función:** `window.WorkoutAnimations.zenEffect()`
*   **Confetti:**
    *   **Descripción:** Lluvia de confeti de colores.
    *   **Uso Actual:** Al finalizar una rutina completa.
    *   **Dependencia:** Librería `canvas-confetti`.

### Elementos UI
*   **Pulse (Latido):**
    *   **Descripción:** El contenedor del temporizador "late" (escala arriba/abajo) y cambia de color (rojo/naranja) brevemente.
    *   **Uso Actual:** 
        *   A la mitad del tiempo de ejercicio.
        *   Advertencia de 2 minutos restantes.
    *   **Función:** `window.WorkoutAnimations.pulseEffect()`
*   **Endurance Overlay (Cuenta Regresiva Gigante):**
    *   **Descripción:** Una superposición con números grandes para los últimos 10 segundos de descanso.
    *   **Uso Actual:** Final del periodo de descanso.
    *   **Función:** `window.WorkoutAnimations.enduranceTimerEffect(duration)`
*   **Countdown (Inicio):**
    *   **Descripción:** Cuenta regresiva 3-2-1 a pantalla completa antes de iniciar la rutina.
    *   **Uso Actual:** Al presionar "Iniciar Rutina".
    *   **Función:** `window.WorkoutAnimations.countdownEffect(callback)`

### Indicadores de Notificación
*   **Badge Perfil:** Punto/número rojo en la foto de perfil (Menú cerrado).
*   **Borde Perfil:** Borde rojo pulsante en el contenedor de la foto (Menú cerrado).
*   **Badge Lista:** Contador rojo estándar en el ítem de menú (Menú abierto).

---

## 2. Efectos Auditivos
Sonidos del sistema para feedback inmediato.

*   **Beep Short:**
    *   **Fuente:** `https://actions.google.com/sounds/v1/alarms/beep_short.ogg`
    *   **Uso:** Finalización de timers (Descanso/Trabajo), inicio de intervalos.
    *   **Gestión:** `window.Runner.utils.getAudio().play()`

---

## 3. Efectos Hápticos (Vibración)
Patrones de vibración para dispositivos móviles (Android/Chrome).
*   **Nota:** Requiere interacción previa del usuario y solo funciona en contextos seguros (HTTPS).

| Patrón (ms) | Sensación | Uso |
| :--- | :--- | :--- |
| `[200, 100, 200]` | Doble pulso medio | Alerta de Timer Finalizado. |
| `[50]` | Pulso corto (Click) | Feedback al registrar un set (Log). |
| `[200, 100, 200, 100, 500]` | Alarma larga | Fin de intervalo de trabajo Intenso. |
| `[100, 50, 100, 50, 200, 100, 500]` | Celebración / Ritmo | Finalización de Rutina completa. |
| `[200, 100, ...]` | Vibración Push | Definida en `service-worker.js` para notificaciones en segundo plano. |

---

## 4. Disponibilidad por Estado
| Estado App | Visuales | Audio | Háptico | Push |
| :--- | :---: | :---: | :---: | :---: |
| **Activa (Primer Plano)** | ✅ Sí | ✅ Sí | ✅ Sí | Arriba (Toast) |
| **Segundo Plano (Backgr)** | ❌ No | ⚠️ A veces | ❌ No | ✅ Sí (Notif) |
| **Bloqueado** | ❌ No | ❌ No | ❌ No | ✅ Sí (Notif + Sonido/Vibra del SO) |

