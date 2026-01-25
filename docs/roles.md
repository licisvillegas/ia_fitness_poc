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