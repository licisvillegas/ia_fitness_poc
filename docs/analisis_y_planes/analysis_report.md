# Análisis de [templates/workout_runner.html](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/templates/workout_runner.html)

Este reporte detalla el análisis técnico y funcional de la experiencia de ejecución de rutinas ("Workout Runner").

## Resumen Técnico
El archivo [workout_runner.html](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/templates/workout_runner.html) actúa como un contenedor (shell) para una **Single Page Application (SPA)** construida con **React** (sin JSX compilado, usando Babel standalone) y **Bootstrap**.
-   **Core Logic**: [static/js/runner/hooks/useWorkout.js](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/static/js/runner/hooks/useWorkout.js) (Manejo de estado masivo).
-   **Interfaz**: [static/js/runner/components/App.js](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/static/js/runner/components/App.js) y componentes hijos.
-   **Efectos**: [static/js/workout_animations.js](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/static/js/workout_animations.js) (Integra `canvas-confetti` y `anime.js`).

---

## 1. Puntos de Mejora (Deuda Técnica & UX)
### Código y Arquitectura
-   **Complejidad del Estado ([useWorkout.js](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/static/js/runner/hooks/useWorkout.js))**: El hook principal tiene más de 750 líneas. Mezcla lógica de temporizadores, notificaciones, persistencia local, sincronización remota y lógica de negocio.
    -   *Propuesta*: Dividir en custom hooks más pequeños: `useWorkoutTimer`, `useWorkoutSync`, `useNotifications`.
-   **Manipulación Directa del DOM**: Se detecta uso de `document.getElementById` (ej. en `logic.openVideoModal` y [workout_animations.js](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/static/js/workout_animations.js)). En React, esto debería manejarse con Refs o Portals para evitar conflictos de renderizado.
-   **Lógica de Notificaciones Duplicada**: La lógica para registrar/enviar notificaciones push está dispersa entre [App.js](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/static/js/runner/components/App.js) y [useWorkout.js](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/static/js/runner/hooks/useWorkout.js), con bloques de código repetitivos.
-   **Intervalos "Hardcoded"**: Uso directo de `setInterval` en [useEffect](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/static/js/workout_animations.js#988-1053) sin abstracción, lo que hace el código propenso a bugs de "stale closures" (aunque se usan Refs para mitigarlo, es difícil de leer).

### UX / UI
-   **Carga Inicial**: Depende de múltiples scripts externos (React, Babel, AnimeJS) cargados vía CDN. Si falla la conexión a internet *antes* de cargar la caché, la app no inicia, aunque tenga soporte "Offline" para la lógica.

---

## 2. Funcionalidades Obsoletas o Cuestionables
-   **Mezcla de Lógica Local/Push**: El sistema intenta manejar alertas locales (ej. "3 minutos de descanso") mediante la API de Push Notifications para cuando la app está en segundo plano. Hay código redundante que intenta decidir entre alerta local vs remota.
-   **Alertas nativas como fallback**: El uso de `alert()` en [handleOfflineSync](file:///c:/Users/licis/OneDrive/Documentos/GitHub/ia_fitness_poc/static/js/runner/hooks/useWorkout.js#435-462) bloquea el hilo principal y rompe la experiencia de usuario inmersiva. Debería usar siempre modales personalizados (`ConfirmModal`).
-   **Librerías Gigantes**: Se carga `anime.js` completo para animaciones que a veces son puntuales. (Nota: No es "obsoleto" per se, pero sí optimizable).

---

## 3. Propuesta de Nuevas Funcionalidades
### Funcionalidad Core
-   **Registro de RPE/RIR**: Actualmente la app asume que completaste el peso/reps objetivo. Falta un campo para registrar el "Esfuerzo Percibido" (RPE) o "Repeticiones en Reserva" (RIR) real por serie.
-   **Distinción Calentamiento vs Sets Efectivos**: El runner trata todos los sets igual. Sería útil marcar visualmente los sets de aproximación (Warm-up) que no cuentan para el PR.
-   **Modo "Picture in Picture" (PiP)**: Permitir ver el cronómetro flotante si el usuario cambia de pestaña (especialmente en Desktop).

### Experiencia de Usuario
-   **Controles de Audio Integrados**: Si se reproduce música o alarmas, tener un control de volumen independiente dentro del runner (actualmente depende del volumen del sistema).
-   **Edición Rápida en Vivo**: Capacidad de añadir un set extra o borrar uno "on the fly" sin salir del runner (actualmente solo permite sustituir ejercicios).

---

## 4. Casos de Uso Cubiertos (Lo que sí hace bien)
-   ✅ **Ejecución de Rutina Estándar**: Series directas, descansos entre series.
-   ✅ **Circuitos / Superseries**: Manejo correcto de grupos de ejercicios anidados.
-   ✅ **Resiliencia (Crash Recovery)**: Guarda el estado paso a paso en `localStorage`. Si recargas la página, vuelves exactamente donde estabas.
-   ✅ **Soporte Offline Completo**: Si pierdes conexión al finalizar, guarda la sesión localmente y la sincroniza (`offline-session-synced`) al recuperar conexión.
-   ✅ **Pantalla Siempre Activa**: Implementación correcta de `navigator.wakeLock` para evitar que el móvil se bloquee.
-   ✅ **Feedback Hático/Visual**: Uso extensivo de vibración y animaciones para hitos (mitad de tiempo, fin de descanso).

## 5. Casos de Uso Faltantes
-   ❌ **Drop Sets Automatizados**: No hay flujo específico para drop sets (bajar peso inmediatamente sin descanso). El usuario debe hacerlo manualmente como sets separados.
-   ❌ **Historial Inmediato**: Al estar en un ejercicio, no es fácil ver *rápidamente* qué hiciste la semana pasada en ese mismo set específico (muestra el PR general, pero no el historial detallado de sesiones previas).
-   ❌ **Notas por Serie**: Solo hay notas por ejercicio/grupo, pero no se puede dejar una nota específica para "Serie 2" (ej. "me dolió el hombro").

## 6. Extras / Destacados
-   **Sistema de Animaciones**: El módulo `WorkoutAnimations` es muy rico (Fuegos artificiales, Lluvia de emojis, Efecto Glitch). Es un diferenciador "Premium" fuerte.
-   **Modo Foco**: La detección de orientación (Landscape) para ocultar distracciones y mostrar solo números grandes es un excelente toque para usuarios de gimnasio.
