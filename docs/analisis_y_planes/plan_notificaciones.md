# Plan de mejoras de notificaciones

Este plan cubre los **Puntos de mejora principales** y **Otras recomendaciones** del reporte. Se usa para dar seguimiento a ajustes, pruebas y cierre.

## Estado
- Pendiente: no iniciado.
- En curso: en desarrollo.
- En prueba: pruebas en ejecución o por validar.
- Bloqueado: depende de otra tarea o decisión.
- Completado: listo y validado.

## Puntos de mejora principales
| ID | Tarea | Descripción | Archivos objetivo | Estado | Pruebas / validación | Notas |
| --- | --- | --- | --- | --- | --- | --- |
| PM-01 | Exponer `requestNotificationPermission` | Mapear a `ensureNotificationPermission` o exportar con el nombre esperado. | `static/js/runner/hooks/useWorkout.js`, `static/js/runner/components/Header.js`, `static/js/runner/components/RestOverlay.js`, `static/js/runner/components/TimerControls.js` | Completado | Verificar que los botones de activar notificaciones funcionan sin errores en consola. | |
| PM-02 | Unificar mensajes de fin de rutina | Evitar mostrar dos mensajes consecutivos. Definir uno solo. | `static/js/runner/hooks/useWorkout.js`, `static/js/runner/hooks/useWorkoutSteps.js` | Completado | Ejecutar flujo completo de rutina y confirmar que solo aparece un mensaje. | |
| PM-03 | Tags de notificación por contexto | Usar `tag` específico por evento (`rest_end`, `workout_finished`, etc.). | `static/js/runner/hooks/useNotifications.js` | Completado | Generar al menos dos notificaciones seguidas y validar que no se reemplazan indebidamente. | |
| PM-04 | Respetar `isNotificationsEnabled` al programar push | Evitar `schedulePush` si el usuario silenció notificaciones. | `static/js/runner/hooks/useWorkout.js`, `static/js/runner/hooks/useWorkoutQueue.js` | Completado | Desactivar notificaciones desde UI y comprobar que no se programan pushes. | |
| PM-05 | Definir destino de `checkRepMotivation` | Eliminar lógica muerta o conectarla a notificación real. | `static/js/runner/hooks/useWorkout.js`, `static/js/runner/hooks/useWorkoutTimer.js` | Completado | Revisión de comportamiento en ejercicios por reps (3m/5m). | |

## Otras recomendaciones
| ID | Tarea | Descripción | Archivos objetivo | Estado | Pruebas / validación | Notas |
| --- | --- | --- | --- | --- | --- | --- |
| OR-01 | Persistir preferencia de notificaciones | Guardar `isNotificationsEnabled` en `localStorage` y restaurar en carga. | `static/js/runner/hooks/useNotifications.js` | Completado | Recargar la página y validar que se conserva el estado. | |
| OR-02 | Deduplicación por contexto en `schedulePush` | Evitar reprogramar múltiples tareas del mismo contexto. | `static/js/runner/utils.js`, `static/js/runner/hooks/useWorkout.js`, `static/js/runner/hooks/useWorkoutQueue.js` | Completado | Ajustar descanso varias veces y confirmar una sola tarea activa. | |
| OR-03 | Corregir cadenas mal codificadas | Revisar encoding y normalizar textos con caracteres especiales. | `static/js/runner/**/*.js` | Completado | Verificar UI y mensajes sin caracteres corruptos. | No se encontraron cadenas mal codificadas en `static/js/runner`. Lo observado parece ser un tema de encoding en la consola al visualizar. |
| OR-04 | Cola de mensajes en `MessageBar` | Implementar cola simple para no pisar mensajes rápidos. | `static/js/runner/components/MessageBar.js`, `static/js/runner/hooks/useWorkout.js` | Completado | Disparar múltiples mensajes seguidos y verificar orden/visibilidad. | |

## Checklist de pruebas sugeridas
1. Flujo completo: iniciar, descansar, volver a trabajo, finalizar.
2. Activar/desactivar notificaciones y validar comportamiento real.
3. Simular app en segundo plano (oculta) y comprobar pushes.
4. Forzar error de guardado para validar modales.
5. Ajustar tiempo de descanso varias veces y revisar duplicidad de pushes.
