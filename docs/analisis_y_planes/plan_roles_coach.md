# Plan: Segmentación de Usuarios por Entrenador/Nutriólogo

Este plan detalla cómo implementar un sistema de permisos donde los usuarios con rol de **Entrenador (Trainer)** o **Nutriólogo (Nutritionist)** solo tengan acceso a los clientes asignados a ellos, sin comprometer el acceso total del Administrador.

## Cambios Propuestos

### 1. Modelo de Datos (MongoDB)
Para establecer el vínculo entre el profesional y el cliente, realizaremos los siguientes ajustes:

- **Colección `users`**:
  - Agregar un campo opcional `coach_id` (string) que contendrá el `user_id` del Entrenador o Nutriólogo asignado.
- **Colección `user_roles`**:
  - Permitir los valores `'trainer'` y `'nutritionist'` además de `'admin'` y `'user'`.

### 2. Lógica de Autenticación y Helpers
Modificaremos `utils/auth_helpers.py` para manejar estos nuevos niveles de acceso:

- **`check_coach_access()` (Nueva función)**:
  - Validará que el usuario tenga el token de acceso (si se requiere para el panel) y que su rol sea `'admin'`, `'trainer'` o `'nutritionist'`.
  - Retornará el rol y el `user_id` actual para facilitar el filtrado.

### 3. Rutas de Administración (Backend)
Modificaremos `routes/admin.py` para aplicar el filtrado de datos:

- **`list_users()` (`/api/admin/users`)**:
  - Si el usuario logueado es `'admin'`, sigue viendo a todos los usuarios.
  - Si el usuario es `'trainer'` o `'nutritionist'`, la consulta a la base de datos se filtrará automáticamente: `db.users.find({"coach_id": current_user_id})`.
- **`get_user_profile_detail()`**:
  - Se agregará una validación para asegurar que el profesional tenga permiso sobre ese `user_id` específico (es decir, que sea su propio cliente).

### 4. Interfaz de Usuario (Frontend)
- **Dashboard de Administración**:
  - Se adaptará la barra lateral y las vistas para que, si el rol no es `'admin'`, se oculten opciones globales (como configuración del sistema o gestión de otros entrenadores) y se enfoque solo en la "Gestión de Mis Clientes".
- **Asignación de Clientes**:
  - Solo un Administrador total tendrá el privilegio de asignar un cliente a un Entrenador específico modificando el campo `coach_id`.

## Plan de Verificación

### Pruebas Automatizadas
- Crear pruebas unitarias para el nuevo helper `check_coach_access`.
- Verificar que la API de usuarios retorne listas vacías o limitadas según el rol del solicitante.

### Verificación Manual
1. Crear un usuario con rol `'trainer'`.
2. Asignar 2 clientes a ese `'trainer'`.
3. Iniciar sesión como el `'trainer'` y verificar que en el panel de usuarios solo aparezcan esos 2 clientes.
4. Intentar acceder al perfil de un usuario no asignado y verificar que el sistema lo deniegue (403 Forbidden).
