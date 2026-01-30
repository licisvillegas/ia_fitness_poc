# Documentación de Rutas "Huérfanas" y Faltantes

Este documento lista las rutas y funcionalidades identificadas en el proyecto que actualmente no tienen acceso directo desde la barra de navegación lateral principal, o que requieren implementación en el backend.

## 1. Rutas Existentes (Sin Enlace en Sidebar)

Estas rutas están completamente definidas en `app.py` y tienen sus plantillas correspondientes, pero no aparecen en el menú de navegación del usuario.

### Evaluación Corporal con IA
*   **URL:** `/ai/body_assessment/tester`
*   **Función Backend:** `body_assessment_tester()`
*   **Plantilla:** `templates/body_assessment.html`
*   **Descripción:** Interfaz principal para que el usuario ingrese sus medidas corporales y suba fotos para ser analizadas por el agente de IA.
*   **Estado:** Funcional, pero accesible solo vía URL directa.

### Panel de Administración
Estas rutas están intencionalmente fuera del menú de usuario estándar, protegidas para uso administrativo.

*   **Login Admin:**
    *   **URL:** `/admin`
    *   **Función:** `admin_auth_page()`
    *   **Plantilla:** `templates/admin_auth.html`

*   **Gestión de Planes de Entrenamiento:**
    *   **URL:** `/admin/plans`
    *   **Función:** `admin_plans_page()`
    *   **Plantilla:** `templates/admin_plans.html`

*   **Gestión de Planes de Nutrición:**
    *   **URL:** `/admin/meal_plans`
    *   **Función:** `admin_meal_plans_page()`
    *   **Plantilla:** `templates/admin_meal_plans.html`

---

## 2. Funcionalidades Faltantes (Enlace sin Backend)

Estas funcionalidades tienen un enlace en la interfaz de usuario (UI), pero no tienen la lógica de backend implementada para responder.

### Perfil de Usuario
*   **Enlace actual:** `/profile` (en el menú desplegable del usuario en Sidebar).
*   **Plantilla Existente:** `templates/profile.html`
*   **Estado:** ⚠️ **CRÍTICO**. La ruta `@app.route("/profile")` no existe en `app.py`. Al hacer clic, el usuario recibirá un error 404.
*   **Acción Requerida:** Agregar la definición de la ruta en `app.py` para renderizar la plantilla existente.

```python
# Ejemplo de implementación requerida en app.py:
@app.route("/profile")
def profile_page():
    return render_template("profile.html")
```
