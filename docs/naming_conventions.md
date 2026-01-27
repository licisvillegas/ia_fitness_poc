# Convenciones de Nomenclatura del Proyecto

Este documento establece las reglas para nombrar archivos, carpetas y variables en el proyecto, asegurando consistencia y legibilidad.

## 1. Archivos y Carpetas

| Tipo de Archivo | Convención | Ejemplo |
| :--- | :--- | :--- |
| **Templates HTML** | `snake_case` | `workout_runner.html` |
| **Componentes HTML** | `snake_case` | `macros_card.html` |
| **Estilos CSS** | `snake_case` | `dashboard_styles.css` |
| **Scripts JavaScript** | `snake_case` | `auth_handler.js` |
| **Módulos Python** | `snake_case` | `user_routes.py` |
| **Carpetas** | `snake_case` | `static/js/` |

## 2. Variables y Funciones

### JavaScript
- **Variables / Constantes**: `camelCase` (ej: `currentUserId`).
- **Funciones**: `camelCase` descriptivas (ej: `fetchUserProgress`).
- **Clases**: `PascalCase` (ej: `WorkoutPlan`).

### Python
- **Variables / Funciones**: `snake_case` (ej: `get_user_data`).
- **Clases**: `PascalCase` (ej: `DatabaseManager`).

### HTML / CSS
- **IDs**: `kebab-case` (ej: `main-nav-toggle`).
- **Clases CSS**: `kebab-case` (ej: `btn-primary`, `stat-card`).

## 3. Idioma y Codificación
- **Contenido**: Todo el texto visible y comentarios de lógica interna deben estar en **Español**.
- **Encoding**: Obligatoriamente **UTF-8**.
