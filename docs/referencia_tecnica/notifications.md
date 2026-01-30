# Sistema de Notificaciones de Synapse Fit

Este documento describe la arquitectura y funcionamiento del sistema de notificaciones híbrido implementado en la aplicación, combinando notificaciones dentro de la aplicación (In-App) y notificaciones push del servidor (Web Push).

## 1. Visión General

El sistema utiliza dos mecanismos complementarios:
1.  **Notificaciones In-App (Persistentes):** Para historial, mensajes del sistema y feedback de acciones. Se almacenan en base de datos.
2.  **Server Push / Web Push (Efímeras/Críticas):** Para alertas en tiempo real, especialmente cuando la aplicación está en segundo plano o el dispositivo está bloqueado (ej. finalización de cronómetros).

---

## 2. Notificaciones In-App

Estas notificaciones son persistentes y se muestran dentro de la interfaz de usuario.

### Arquitectura
*   **Backend:**
    *   **Almacenamiento:** MongoDB, colección `notifications`.
    *   **API:** `routes/notifications.py`
        *   `GET /api/notifications/pending`: Obtiene notificaciones no leídas.
        *   `POST /api/notifications/mark-read`: Marca notificaciones como leídas.
*   **Frontend:**
    *   **Lógica:** `static/js/notifications_ui.js`
    *   **Mecanismo:** "Polling" (sondeo) cada 60 segundos para verificar nuevos mensajes.
    *   **UI:** `templates/components/sidebar.html` y `static/css/notifications.css`.

### Indicadores Visuales
El sistema adapta los indicadores visuales según el estado del menú de usuario:
*   **Menú Abierto:** Badge numérico rojo sobre el ítem "Notificaciones" en la lista.
*   **Menú Cerrado:** Borde rojo pulsante alrededor de la foto de perfil y un pequeño badge numérico en la esquina de la foto.

### Tipos y Estilos
Cada notificación tiene un `type` que define su apariencia visual (borde izquierdo e icono):

| Tipo | Color | Icono | Uso Recomendado |
| :--- | :--- | :--- | :--- |
| **info** | Azul (`primary`) | ℹ️ Info | Información general, consejos, actualizaciones. |
| **success** | Verde (`success`) | ✅ Check | Acciones completadas correctamente, logros. |
| **warning** | Amarillo (`warning`) | ⚠️ Alerta | Advertencias no críticas, recordatorios importantes. |
| **error** | Rojo (`danger`) | ❌ Cruz | Fallos en procesos, errores de validación crítica. |

---

## 4. Notificaciones Implementadas y Condiciones

A continuación se detallan las notificaciones automáticas configuradas actualmente en el "Workout Runner".

| Evento | Condición Lógica | Tipo | Mensaje (Ejemplo) | Efecto Adicional |
| :--- | :--- | :--- | :--- | :--- |
| **Fin de Descanso** | `status == 'REST'` y `timer == 0` | **Push** (Tag: `rest_timer`) | "Tu descanso ha terminado. ¡A trabajar!" | Audio Beep, Vibración `[200, 100, 200]` |
| **Mitad de Ejercicio** | Ejercicio por Tiempo/Cardio (>20s) y `tiempo_restante == mitad` | **Push** (Tag: `workout_half`) | "Vas a la mitad de Sentadillas. Sigue así." | Animación Visual (Pulse) |
| **Aviso 2 Minutos** | Ejercicio largo (>140s) y `tiempo_restante == 120s` | **Push** (Tag: `workout_2min`) | "Lo estás logrando. Te faltan 2 minutos." | Animación Visual (Pulse) |
| **Inactividad (3m)** | Ejercicio por Repeticiones, sin loggear set por 3 min | **Push** (Tag: `workout_idle_3m`) | "Vamos, sigue con Press de Banca." | - |
| **Inactividad (5m)** | Ejercicio por Repeticiones, sin loggear set por 5 min | **Push** (Tag: `workout_idle_5m`) | "Retoma la rutina cuando puedas." | - |
| **Fin de Rutina** | Todos los ejercicios completados | **In-App** (UI Modal) | "Rutina finalizada" | Confeti, Vibración de Celebración |

### Notas sobre "Server Push"
Las notificaciones de **Mitad de Ejercicio**, **Aviso 2 Min**, etc., se programan (`schedulePush`) en el servidor al iniciar el paso (Step) correspondiente.
*   Si el usuario completa el paso o salta al siguiente *antes* de que ocurra la condición, la notificación programada se **cancela** automáticamente.
*   Esto asegura que no recibas un aviso de "Mitad de ejercicio" si ya terminaste.


---

## 3. Server Push aka Web Push

Este sistema permite enviar notificaciones al dispositivo del usuario incluso si la pestaña está cerrada o el móvil bloqueado. Es crucial para la funcionalidad del **Cronómetro de Descanso**.

### Arquitectura Técnica
*   **Protocolo:** Web Push estándar utilizando claves VAPID.
*   **Backend:** `routes/push.py`
    *   Librería: `pywebpush`
    *   **Endpoints:**
        *   `/subscribe`: Registra la suscripción del navegador.
        *   `/send`: Envío inmediato.
        *   `/schedule`: Programa un envío futuro (usado por timers).
    *   **Scheduling:** Utiliza `threading.Timer` en memoria. **Nota Importante:** Las notificaciones programadas se pierden si el servidor se reinicia antes de enviarse.
*   **Frontend:**
    *   **Service Worker:** `static/service-worker.js`. Recibe el evento `push` y muestra la notificación del sistema.
    *   **Manager:** `static/js/push_manager.js`. Gestiona permisos y suscripción.
    *   **Utilidades:** `static/js/runner/utils.js`. `schedulePush()` y `cancelPush()`.

### Flujo de Notificación de Timer
1.  Frontend llama a `utils.schedulePush(delay, ...)` con el tiempo restante.
2.  Backend crea un `threading.Timer`.
3.  Al finalizar el tiempo, Backend envía el payload push a los servidores de FCM/Mozilla.
4.  Service Worker recibe el evento `push`.
5.  Service Worker muestra la notificación con alta prioridad (`Urgency: high`).

### Reglas de Implementación
1.  **Urgencia:** Todas las notificaciones de timer deben enviarse con header `Urgency: high` para atravesar modos de ahorro de batería en Android/iOS.
2.  **Interacción:** Se configura `requireInteraction: true` para que la notificación no desaparezca sola.
3.  **Vibración:** El patrón de vibración se define en el Service Worker (`[200, 100, 200...]`) para asegurar que el usuario sienta la alerta.
4.  **Sonido:** El navegador gestiona el sonido basado en la configuración del sistema operativo. El Service Worker usa `renotify: true` para permitir sonido en notificaciones consecutivas.

### Limitaciones Conocidas
*   **Persistencia:** El agendamiento actual es en memoria RAM del servidor. Un reinicio del servidor elimina los timers pendientes.
*   **iOS:** Requiere que la PWA esté instalada en la pantalla de inicio (Add to Home Screen) y tenga interacción previa del usuario para funcionar fiablemente en segundo plano.
