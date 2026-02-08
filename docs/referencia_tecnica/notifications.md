# Reporte de notificaciones del runner

Este documento consolida las notificaciones definidas por los scripts cargados desde `templates/workout_runner.html`, incluyendo notificaciones in-app, notificaciones del sistema (push/navegador) y alertas/modales.

## Alcance
`templates/workout_runner.html` solo monta el contenedor y carga `templates/partials/runner/scripts.html`. La lógica real vive en los módulos de `static/js/runner/`.

## Notificaciones in-app (MessageBar, ~3s)
Mensajes visibles dentro de la UI, gestionados por `MessageBar` y `showMessage`.

1. **“Inicia Descanso”**
   - Condición: `status === 'REST'` y `currentStep.type === 'rest'` con cambio de paso/estado.
   - Se ejecuta: `showMessage(NOTIFICATIONS.REST_START.title, "info")`.
   - Archivos: `static/js/runner/hooks/useWorkout.js`, `static/js/runner/constants.js`, `static/js/runner/components/MessageBar.js`.

2. **“Finalizó Descanso. Inicia ejercicio {exName}”**
   - Condición: `status === 'WORK'` y `prevStatus === 'REST'`.
   - Se ejecuta: `showMessage(`${titleSuccess} ${exName}`, "success")`, sonido `playAlert('rest_end')`, vibración.
   - Archivos: `static/js/runner/hooks/useWorkout.js`, `static/js/runner/constants.js`, `static/js/runner/utils.js`.

3. **“Inicia ejercicio {exName}”**
   - Condición: `status === 'WORK'` y no viene de REST (o primer trabajo).
   - Se ejecuta: `showMessage(`${NOTIFICATIONS.WORK_START.titleInfo} ${exName}`, "info")`.
   - Archivos: `static/js/runner/hooks/useWorkout.js`, `static/js/runner/constants.js`.

4. **“Fin de la Rutina”**
   - Condición: `status === 'FINISHED'` y cambio desde otro estado.
   - Se ejecuta: `showMessage(titleSuccess, "success")`.
   - Archivos: `static/js/runner/hooks/useWorkout.js`, `static/js/runner/constants.js`.

5. **“Rutina finalizada”**
   - Condición: cuando `finishWorkout()` se invoca.
   - Se ejecuta: `showMessage("Rutina finalizada", "success")`.
   - Archivos: `static/js/runner/hooks/useWorkoutSteps.js`.

6. **“Rutina cancelada”**
   - Condición: cancelación cuando no hay overlay “glitch” (fallback).
   - Se ejecuta: `showMessage("Rutina cancelada", "error")`.
   - Archivos: `static/js/runner/hooks/useWorkoutSteps.js`.

7. **“Descanso omitido”**
   - Condición: usuario pulsa “SALTAR DESCANSO”.
   - Se ejecuta: `showMessage("Descanso omitido", "info")`, cancela pushes programados.
   - Archivos: `static/js/runner/hooks/useWorkoutQueue.js`.

8. **“Set omitido”**
   - Condición: usuario confirma “Saltar Serie”.
   - Se ejecuta: `showMessage("Set omitido", "info")`.
   - Archivos: `static/js/runner/components/NavigationWrapper.js`.

9. **“No hay ejercicios pendientes”**
   - Condición: `openPendingConfirm` y no hay pendientes.
   - Se ejecuta: `showMessage("No hay ejercicios pendientes", "info")`.
   - Archivos: `static/js/runner/hooks/useWorkoutPending.js`.

10. **“Realiza los ejercicios pendientes”**
    - Condición: `openPendingConfirm` con pendientes.
    - Se ejecuta: `showMessage("Realiza los ejercicios pendientes", "info")`.
    - Archivos: `static/js/runner/hooks/useWorkoutPending.js`.

11. **“Ejercicios pendientes”**
    - Condición: `checkPendingAndFinish` detecta pendientes antes de finalizar.
    - Se ejecuta: `showMessage("Ejercicios pendientes", "info")`.
    - Archivos: `static/js/runner/hooks/useWorkoutPending.js`.

12. **“Sustituto aplicado”**
    - Condición: se aplica un sustituto de ejercicio.
    - Se ejecuta: `showMessage("Sustituto aplicado", "success")`.
    - Archivos: `static/js/runner/hooks/useWorkoutSubstitutions.js`.

## Notificaciones del sistema (push / navegador)
Notificaciones fuera de la app (Service Worker o Notification API), y/o push programados en servidor.

13. **Push programado de descanso: “Tiempo Completado / Tu descanso ha terminado…”**
    - Condición: entrar a REST con `duration > 0` y `schedulePush` disponible; también si la página se oculta durante REST o al modificar tiempo con `addRestTime` (si la pestaña no está visible).
    - Se ejecuta: `schedulePush(delay, title, body, "rest_timer", …)` → `POST /api/push/schedule`.
    - Archivos: `static/js/runner/hooks/useWorkout.js`, `static/js/runner/hooks/useWorkoutQueue.js`, `static/js/runner/utils.js`.

14. **Push motivacional mitad del tiempo**
    - Condición: paso de trabajo basado en tiempo y `totalTime >= 20`.
    - Se ejecuta: `schedulePush(delayHalf, "Motivación", pushBody(exName), "workout_half")`.
    - Señal local adicional: `pulseEffect()` cuando `remaining === halfTime`.
    - Archivos: `static/js/runner/hooks/useWorkout.js`, `static/js/runner/hooks/useWorkoutTimer.js`, `static/js/runner/constants.js`.

15. **Push “Casi terminas” (2 minutos restantes)**
    - Condición: trabajo basado en tiempo y `totalTime > 140`.
    - Se ejecuta: `schedulePush(delay2Min, "Casi terminas", …, "workout_2min")`.
    - Señal local adicional: `pulseEffect()` cuando `remaining === 120`.
    - Archivos: `static/js/runner/hooks/useWorkout.js`, `static/js/runner/hooks/useWorkoutTimer.js`.

16. **Push inactividad 3 min**
    - Condición: paso basado en reps (`rawRepsTarget !== 0`).
    - Se ejecuta: `schedulePush(180, "Motivación", pushBody(exName), "workout_idle_3m")`.
    - Archivos: `static/js/runner/hooks/useWorkout.js`.

17. **Push inactividad 5 min**
    - Condición: paso basado en reps (`rawRepsTarget !== 0`).
    - Se ejecuta: `schedulePush(300, "Retoma la rutina", pushBody(exName), "workout_idle_5m")`.
    - Archivos: `static/js/runner/hooks/useWorkout.js`.

18. **Notificación del sistema al finalizar rutina**
    - Condición: `status === 'FINISHED'` y `sendNotification` disponible con permisos y `isNotificationsEnabled`.
    - Se ejecuta: `sendNotification(pushTitle, pushBody)` → `ServiceWorker.showNotification` (o `new Notification` fallback).
    - Archivos: `static/js/runner/hooks/useWorkout.js`, `static/js/runner/hooks/useNotifications.js`.

## Alertas y confirmaciones (modales)
Notificaciones tipo modal (bloqueantes), gestionadas por `useWorkoutModals`.

19. **“Notificaciones Bloqueadas”**
    - Condición: el usuario intenta activar notificaciones y el permiso está `denied`.
    - Se ejecuta: `showAlert("Notificaciones Bloqueadas", …)` o `alert()` fallback.
    - Archivos: `static/js/runner/hooks/useNotifications.js`, `static/js/runner/hooks/useWorkoutModals.js`.

20. **“Sesion sincronizada”**
    - Condición: evento `offline-session-synced` y rutina coincide.
    - Se ejecuta: `showAlert("Sesion sincronizada", …)` o `window.showAlertModal`.
    - Archivos: `static/js/runner/hooks/useWorkoutSync.js`.

21. **Errores de guardado al finalizar**
    - Condición: falla guardado online y falla guardado offline.
    - Se ejecuta: `showAlert("Error Final", …)` y/o confirmación adicional.
    - Archivos: `static/js/runner/hooks/useWorkoutSteps.js`, `static/js/runner/hooks/useWorkoutModals.js`.

## Señales visuales/sonoras relacionadas
No son mensajes de texto, pero informan eventos relevantes.

22. **Pulso visual a mitad y a 2 minutos**
    - Condición: trabajo basado en tiempo; `remaining === halfTime` o `remaining === 120`.
    - Se ejecuta: `WorkoutAnimations.pulseEffect()`.
    - Archivos: `static/js/runner/hooks/useWorkoutTimer.js`.

23. **Efecto “endurance” al llegar a 10s en descanso**
    - Condición: `status === 'REST'` y `stepTimer === 10`.
    - Se ejecuta: `WorkoutAnimations.enduranceTimerEffect(10)` y se limpia si cambia.
    - Archivos: `static/js/runner/hooks/useWorkoutTimer.js`.

24. **Sonido/vibración en fin de descanso y fin de rutina**
    - Condición: transiciones `REST -> WORK` y `finishWorkout`.
    - Se ejecuta: `playAlert('rest_end')`, `playAlert('victory')`, `triggerHaptic(...)`.
    - Archivos: `static/js/runner/hooks/useWorkout.js`, `static/js/runner/hooks/useWorkoutSteps.js`, `static/js/runner/utils.js`.

## Puntos de mejora principales
1. **`requestNotificationPermission` no existe** en el contexto de `useWorkout`. Se usa en `Header`, `RestOverlay` y `TimerControls`. Debe mapearse a `ensureNotificationPermission` o exportarse con el nombre esperado.
2. **Duplicidad al finalizar**: se muestran dos mensajes (`"Rutina finalizada"` y `"Fin de la Rutina"`). Unificar para evitar ruido.
3. **`sendNotification` usa `tag: 'rest-finished'` fijo** incluso para otros contextos, causando reemplazos. Debe usar tags por evento.
4. **Push se programa aunque el usuario silencie notificaciones** (`isNotificationsEnabled` no se respeta en `schedulePush`).
5. **`checkRepMotivation` no dispara nada visible**; lógica muerta o incompleta. Decidir si se elimina o se conecta con notificación real.

## Otras recomendaciones
1. **Persistir preferencia de notificaciones** (`isNotificationsEnabled`) en `localStorage`.
2. **Deduplicación por `context` en `schedulePush`** para evitar dobles notificaciones cuando cambia el tiempo.
3. **Corregir cadenas mal codificadas** (se ven “Â¿”, “Ã³”). Revisar encoding de archivos JS.
4. **Cola de mensajes en `MessageBar`** si se disparan varios en poco tiempo.
