# Complan: Componente Reutilizable de Buscador de Usuarios

## Objetivo
Crear un componente reutilizable de buscador de usuarios que permita buscar por nombre, username, email o user_id, y que pueda ?heredar? el user_id sin romper la l?gica existente en los templates.

## Estado actual (resumen)
- Endpoint com?n: `/admin/api/user_profiles/lookup?term=...&limit=...` (algunos usan `exact=1`).
- Resultado esperado: `user_id`, `name`, `username`, `email`.
- Persistencia/estado actual:
  - Admin: `localStorage.admin_working_user`.
  - General: `localStorage.ai_fitness_user` y `localStorage.ai_fitness_uid`.
  - Algunos templates usan hidden inputs para user_id (ej: `#adminUserId`).

## Templates/archivos por afectar
- `templates/admin_users.html`
- `templates/admin_plans.html`
- `templates/admin_meal_plans.html`
- `templates/admin_privileges.html`
- `templates/admin_body_assessments.html`
- `templates/body_assessment.html`
- `templates/admin_profiles.html`
- `templates/components/sidebar.html`
- (Opcional) `templates/dashboard.html` si se unifica el input de usuario

## Tareas
- [x] Definir API de componente (props/atributos: inputId, resultsId, onSelect, storageKey, placeholder, limit).
- [ ] Crear markup reutilizable (partial Jinja) para input + dropdown de resultados.
- [x] Crear JS reusable (modulo o script inline) para:
  - Fetch a `/admin/api/user_profiles/lookup`.
  - Render de resultados.
  - Callback `onSelect` y persistencia.
  - Cerrar dropdown en click fuera.
- [x] Adaptar templates admin a usar el componente y callbacks actuales.
- [x] Adaptar sidebar admin (impersonacion) al nuevo componente.
- [ ] Verificar que las paginas con busquedas especializadas no pierdan funcionalidad.
- [ ] Ajuste de estilos para mantener consistencia visual.

## Estatus
- Plan creado: completado
- Implementacion: en progreso
- Validacion: pendiente
