🎯 Objetivo

Tener un rol intermedio entre Usuario y Admin, con permisos avanzados pero sin control total del sistema.

Roles recomendados
1. Usuario (User)

Rol base.
Puede:

Registrar entrenamientos

Ver progreso, métricas, fotos, circunferencias

Usar planes asignados

Acceder a contenido general

Gestionar su perfil

No puede:

Ver datos de otros usuarios

Crear usuarios

Acceder a administración

2. Coach / Entrenador (Trainer)

Rol profesional que gestiona a sus clientes.

Puede:

Crear y gestionar sus propios clientes

Asignar rutinas a sus clientes

Crear programas de entrenamiento

Ver métricas de progreso de sus clientes

Comentar evaluaciones corporales

Crear plantillas de ejercicios

Acceso a dashboard de clientes

Enviar mensajes/notificaciones a sus usuarios

No puede:

Ver usuarios de otros entrenadores

Modificar configuración global

Acceder a facturación general

Gestionar admins

👉 Ideal para entrenadores independientes.

3. Nutriólogo (Nutritionist)

Enfocado en nutrición y seguimiento.

Puede:

Crear planes nutricionales

Asignar planes a clientes

Ver métricas corporales relacionadas (peso, % grasa, fotos)

Acceso a módulo de alimentación

Seguimiento de cumplimiento

Comunicación con sus clientes

No puede:

Modificar rutinas de entrenamiento

Acceder a módulos técnicos

Ver clientes fuera de su cartera

4. Profesional de Salud (Wellness Pro)

Si quieres unificar coach + nutriólogo bajo un rol flexible.

Puede:

Acceso configurable por módulos:

Entrenamiento ✅

Nutrición ✅

Evaluaciones corporales ✅

Clientes asignados ✅

Ideal para coaches integrales

5. Manager / Supervisor

Un rol superior a entrenador pero inferior a admin.

Puede:

Ver todos los entrenadores/nutriólogos

Ver métricas generales (sin tocar sistema)

Revisar calidad de planes

Acceso a reportes

Auditoría ligera

No puede:

Modificar configuración crítica

Gestionar permisos globales

Tocar infraestructura

6. Admin

Control total:

Usuarios

Roles

Permisos

Facturación

Configuración global

Seguridad

Infraestructura

🧠 Mejor práctica profesional: RBAC (Role-Based Access Control)

En lugar de lógica rígida:

Rol = conjunto de permisos

Permiso = acceso a módulo/acción

Ejemplo de permisos:

workout:create
workout:assign
nutrition:create
nutrition:assign
client:view
client:edit
metrics:view
billing:view
admin:access


Entonces:

Trainer = workout:create + workout:assign + client:view + metrics:view

Nutritionist = nutrition:create + nutrition:assign + client:view

Admin = *

Esto te da flexibilidad brutal para crecer sin reescribir lógica.

Ejemplo de estructura real en tu backend (MongoDB / SQL)
Roles
[
  { "name": "user" },
  { "name": "trainer" },
  { "name": "nutritionist" },
  { "name": "manager" },
  { "name": "admin" }
]

Permisos
[
  "client.create",
  "client.view",
  "client.assign",
  "workout.create",
  "workout.assign",
  "nutrition.create",
  "nutrition.assign",
  "reports.view",
  "admin.panel.access"
]

---

## Matriz de permisos detallada (propuesta inicial)

La siguiente matriz define permisos atÃ³micos y su asignaciÃ³n por rol.
Puedes ajustarla segÃºn mÃ³dulos reales del sistema.

### Permisos (catÃ¡logo)

- profile.view
- profile.edit
- workout.create
- workout.edit
- workout.delete
- workout.assign
- workout.view
- nutrition.create
- nutrition.edit
- nutrition.delete
- nutrition.assign
- nutrition.view
- client.create
- client.edit
- client.delete
- client.assign
- client.view
- metrics.view
- metrics.edit
- assessments.comment
- templates.create
- templates.edit
- templates.delete
- messages.send
- notifications.send
- dashboard.clients
- reports.view
- audit.view
- billing.view
- admin.panel.access
- roles.manage
- permissions.manage
- system.config
- infrastructure.manage

### Matriz por rol

| Permiso | Usuario | Trainer | Nutritionist | Wellness Pro | Manager | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| profile.view | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |
| profile.edit | âœ… | âœ… | âœ… | âœ… | âœ… | âœ… |
| workout.create | âœ… (propios) | âœ… | âŒ | âœ… | âŒ | âœ… |
| workout.edit | âœ… (propios) | âœ… | âŒ | âœ… | âŒ | âœ… |
| workout.delete | âŒ | âœ… | âŒ | âœ… | âŒ | âœ… |
| workout.assign | âŒ | âœ… | âŒ | âœ… | âŒ | âœ… |
| workout.view | âœ… (propios) | âœ… (clientes) | âŒ | âœ… | âœ… (supervisiÃ³n) | âœ… |
| nutrition.create | âŒ | âŒ | âœ… | âœ… | âŒ | âœ… |
| nutrition.edit | âŒ | âŒ | âœ… | âœ… | âŒ | âœ… |
| nutrition.delete | âŒ | âŒ | âœ… | âœ… | âŒ | âœ… |
| nutrition.assign | âŒ | âŒ | âœ… | âœ… | âŒ | âœ… |
| nutrition.view | âœ… (propios) | âŒ | âœ… (clientes) | âœ… | âœ… (supervisiÃ³n) | âœ… |
| client.create | âŒ | âœ… (propios) | âœ… (propios) | âœ… (propios) | âŒ | âœ… |
| client.edit | âŒ | âœ… (propios) | âœ… (propios) | âœ… (propios) | âœ… (supervisiÃ³n) | âœ… |
| client.delete | âŒ | âŒ | âŒ | âŒ | âŒ | âœ… |
| client.assign | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… |
| client.view | âŒ | âœ… (propios) | âœ… (propios) | âœ… (propios) | âœ… (todos) | âœ… |
| metrics.view | âœ… (propios) | âœ… (clientes) | âœ… (clientes) | âœ… (clientes) | âœ… (agregado) | âœ… |
| metrics.edit | âŒ | âœ… (clientes) | âœ… (clientes) | âœ… (clientes) | âŒ | âœ… |
| assessments.comment | âŒ | âœ… | âœ… | âœ… | âŒ | âœ… |
| templates.create | âŒ | âœ… | âŒ | âœ… | âŒ | âœ… |
| templates.edit | âŒ | âœ… | âŒ | âœ… | âŒ | âœ… |
| templates.delete | âŒ | âœ… | âŒ | âœ… | âŒ | âœ… |
| messages.send | âœ… (soporte) | âœ… | âœ… | âœ… | âœ… | âœ… |
| notifications.send | âŒ | âœ… | âœ… | âœ… | âœ… | âœ… |
| dashboard.clients | âŒ | âœ… | âœ… | âœ… | âœ… | âœ… |
| reports.view | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… |
| audit.view | âŒ | âŒ | âŒ | âŒ | âœ… | âœ… |
| billing.view | âŒ | âŒ | âŒ | âŒ | âŒ | âœ… |
| admin.panel.access | âŒ | âŒ | âŒ | âŒ | âŒ | âœ… |
| roles.manage | âŒ | âŒ | âŒ | âŒ | âŒ | âœ… |
| permissions.manage | âŒ | âŒ | âŒ | âŒ | âŒ | âœ… |
| system.config | âŒ | âŒ | âŒ | âŒ | âŒ | âœ… |
| infrastructure.manage | âŒ | âŒ | âŒ | âŒ | âŒ | âœ… |

---

## JSON base para backend (roles y permisos)

Este formato sirve para seeds en MongoDB o como base para un script de carga.

```json
{
  "permissions": [
    "profile.view",
    "profile.edit",
    "workout.create",
    "workout.edit",
    "workout.delete",
    "workout.assign",
    "workout.view",
    "nutrition.create",
    "nutrition.edit",
    "nutrition.delete",
    "nutrition.assign",
    "nutrition.view",
    "client.create",
    "client.edit",
    "client.delete",
    "client.assign",
    "client.view",
    "metrics.view",
    "metrics.edit",
    "assessments.comment",
    "templates.create",
    "templates.edit",
    "templates.delete",
    "messages.send",
    "notifications.send",
    "dashboard.clients",
    "reports.view",
    "audit.view",
    "billing.view",
    "admin.panel.access",
    "roles.manage",
    "permissions.manage",
    "system.config",
    "infrastructure.manage"
  ],
  "roles": [
    {
      "name": "user",
      "permissions": [
        "profile.view",
        "profile.edit",
        "workout.create",
        "workout.edit",
        "workout.view",
        "nutrition.view",
        "metrics.view",
        "messages.send"
      ]
    },
    {
      "name": "trainer",
      "permissions": [
        "profile.view",
        "profile.edit",
        "workout.create",
        "workout.edit",
        "workout.delete",
        "workout.assign",
        "workout.view",
        "client.create",
        "client.edit",
        "client.view",
        "metrics.view",
        "metrics.edit",
        "assessments.comment",
        "templates.create",
        "templates.edit",
        "templates.delete",
        "messages.send",
        "notifications.send",
        "dashboard.clients"
      ]
    },
    {
      "name": "nutritionist",
      "permissions": [
        "profile.view",
        "profile.edit",
        "nutrition.create",
        "nutrition.edit",
        "nutrition.delete",
        "nutrition.assign",
        "nutrition.view",
        "client.create",
        "client.edit",
        "client.view",
        "metrics.view",
        "metrics.edit",
        "assessments.comment",
        "messages.send",
        "notifications.send",
        "dashboard.clients"
      ]
    },
    {
      "name": "wellness_pro",
      "permissions": [
        "profile.view",
        "profile.edit",
        "workout.create",
        "workout.edit",
        "workout.delete",
        "workout.assign",
        "workout.view",
        "nutrition.create",
        "nutrition.edit",
        "nutrition.delete",
        "nutrition.assign",
        "nutrition.view",
        "client.create",
        "client.edit",
        "client.view",
        "metrics.view",
        "metrics.edit",
        "assessments.comment",
        "templates.create",
        "templates.edit",
        "templates.delete",
        "messages.send",
        "notifications.send",
        "dashboard.clients"
      ]
    },
    {
      "name": "manager",
      "permissions": [
        "profile.view",
        "profile.edit",
        "client.view",
        "client.edit",
        "client.assign",
        "workout.view",
        "nutrition.view",
        "metrics.view",
        "reports.view",
        "audit.view",
        "dashboard.clients",
        "messages.send",
        "notifications.send"
      ]
    },
    {
      "name": "admin",
      "permissions": [
        "profile.view",
        "profile.edit",
        "workout.create",
        "workout.edit",
        "workout.delete",
        "workout.assign",
        "workout.view",
        "nutrition.create",
        "nutrition.edit",
        "nutrition.delete",
        "nutrition.assign",
        "nutrition.view",
        "client.create",
        "client.edit",
        "client.delete",
        "client.assign",
        "client.view",
        "metrics.view",
        "metrics.edit",
        "assessments.comment",
        "templates.create",
        "templates.edit",
        "templates.delete",
        "messages.send",
        "notifications.send",
        "dashboard.clients",
        "reports.view",
        "audit.view",
        "billing.view",
        "admin.panel.access",
        "roles.manage",
        "permissions.manage",
        "system.config",
        "infrastructure.manage"
      ]
    }
  ]
}
```

---

## Esquema MongoDB sugerido (colecciones + referencias)

Este enfoque separa permisos y roles, y referencia permisos por id.

### Colecciones

**permissions**
```json
{
  "_id": "ObjectId",
  "code": "workout.create",
  "description": "Crear rutinas/entrenamientos",
  "scope": "workout",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

**roles**
```json
{
  "_id": "ObjectId",
  "name": "trainer",
  "label": "Trainer",
  "permissionIds": ["ObjectId", "ObjectId"],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

**users**
```json
{
  "_id": "ObjectId",
  "email": "user@email.com",
  "roleIds": ["ObjectId"],
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Seed sugerido (ejemplo)

1) Insertar permisos en `permissions` (catÃ¡logo completo).
2) Resolver `_id` de permisos por `code`.
3) Insertar roles en `roles` con `permissionIds`.
4) Asignar `roleIds` a usuarios.
