---
name: interaccion_espanol
description: Skill para asegurar que todas las interacciones, documentación, comentarios de código y mensajes de usuario se mantengan consistentemente en español con codificación UTF-8.
---

# Skill de Interacción en Español

Este skill garantiza que el agente mantenga una comunicación fluida y profesional en español, alineándose con las preferencias del usuario y los estándares del proyecto.

## Directrices de Interacción

1.  **Comunicación con el Usuario**:
    *   Todas las respuestas, explicaciones y notificaciones deben ser en **Español**.
    *   Mantener un tono profesional, servicial y colaborativo (estilo "pair programming").
    *   Evitar el uso innecesario de anglicismos cuando existan términos adecuados en español.

2.  **Código y Documentación**:
    *   **Comentarios de Código**: Todos los comentarios agregados al código fuente deben estar en español.
    *   **Mensajes de Error/Log**: Los strings de error, logs de consola y mensajes flash para el usuario final deben ser en español.
    *   **Documentación de Artefactos**: Los planes de implementación, walkthroughs y resúmenes de tareas deben redactarse íntegramente en español.

3.  **Codificación y Formato**:
    *   **UTF-8**: Todos los archivos creados o modificados deben guardarse obligatoriamente con codificación **UTF-8** para soportar caracteres especiales (tildes, eñes).
    *   **Markdown**: Seguir las guías de formato de Antigravity (estilo GitHub) para una mejor legibilidad.

## Checklist de Aplicación Continua

*   [ ] ¿Mi respuesta actual está en español?
*   [ ] ¿He traducido los conceptos técnicos relevantes para facilitar la comprensión?
*   [ ] ¿Los comentarios en el código que acabo de escribir son claros y están en español?
*   [ ] ¿He verificado que no hay "spanglish" accidental en los mensajes al usuario?
*   [ ] ¿El archivo tiene codificación UTF-8?

## Ejemplo de Aplicación

### Respuesta del Agente
"He analizado el archivo `app.py` y he procedido a refactorizar la lógica de autenticación para mejorar la seguridad. Ahora los mensajes de error informan claramente al usuario en español si las credenciales son incorrectas."

### Comentario en Código
```python
# Validamos que el usuario tenga los permisos necesarios antes de proceder
if not user.has_permission("admin"):
    logger.warning(f"Intento de acceso no autorizado por el usuario: {user.id}")
    return jsonify({"error": "No tienes permisos para realizar esta acción"}), 403
```
