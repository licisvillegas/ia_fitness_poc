# Rutas y templates

Listado de templates y rutas que los renderizan. (Generado automaticamente).

## .

| Template | Rutas | Descripcion | Comentarios |
|---|---|---|---|
| `about.html` | `/about` | Pagina informativa/marketing. | Contenido publicitario/institucional. |
| `adherence_dashboard.html` | `/adherence` | Resumen principal del usuario. | Uso general. |
| `admin_auth.html` | `/admin/login` | Vista del panel admin. | Usado en flujo admin; acceso restringido. |
| `admin_body_assessments.html` | `/admin/body_assessments` | Vista del panel admin. | Usado en flujo admin; acceso restringido. |
| `admin_dashboard.html` | `/admin` | Vista del panel admin. | Usado en flujo admin; acceso restringido. |
| `admin_meal_plans.html` | `/admin/meal_plans` | Vista del panel admin. | Usado en flujo admin; acceso restringido. |
| `admin_plans.html` | `/admin/plans` | Vista del panel admin. | Usado en flujo admin; acceso restringido. |
| `admin_privileges.html` | `/admin/privileges` | Vista del panel admin. | Usado en flujo admin; acceso restringido. |
| `admin_profiles.html` | `/admin/profiles` | Vista del panel admin. | Usado en flujo admin; acceso restringido. |
| `admin_users.html` | `/admin/users` | Vista del panel admin. | Usado en flujo admin; acceso restringido. |
| `assign_routine.html` | `/admin/routines/assign` | Asignacion de rutinas. | Panel para asignar rutinas a usuarios. |
| `assign_routine_v2.html` | `/admin/routines/assign-v2` | Asignacion de rutinas. | Panel para asignar rutinas a usuarios. |
| `auth.html` | `/` | Acceso/autenticacion. | Entrada al sistema; formularios de acceso. |
| `body_assessment.html` | `/ai/body_assessment/tester` | Evaluacion corporal y reporte AI. | Contiene formulario + historial + tabs de reporte. |
| `body_assessment_base.html` | `No encontrado` | Evaluacion corporal y reporte AI. | Template base para unificar admin/usuario. |
| `body_assessment_history.html` | `/ai/body_assessment/history/view/<user_id>` | Evaluacion corporal y reporte AI. | Contiene formulario + historial + tabs de reporte. |
| `body_assessment_unified.html` | `/ai/body_assessment/unified` | Evaluacion corporal y reporte AI. | Selector por `?source=admin` o `?source=user`. |
| `body_assessment_user.html` | `/ai/body_assessment/user` | Evaluacion corporal y reporte AI. | Vista usuario final; usa perfil en session/localStorage. |
| `body_morph.html` | `/body-morph` | Vista del sistema. | Uso general. |
| `body_tracking.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `dashboard.html` | `/dashboard` | Resumen principal del usuario. | Uso general. |
| `exercises_catalog.html` | `/admin/exercises` | Catalogo y gestion de ejercicios. | Listado, filtros y detalle de ejercicios. |
| `exercises_catalog_user.html` | `No encontrado` | Catalogo y gestion de ejercicios. | Listado, filtros y detalle de ejercicios. |
| `exercises_list.html` | `/exercises/list` | Catalogo y gestion de ejercicios. | Listado, filtros y detalle de ejercicios. |
| `exercises_unified.html` | `/exercises` | Catalogo y gestion de ejercicios. | Listado, filtros y detalle de ejercicios. |
| `glossary.html` | `/glossary` | Glosario y contenido educativo. | Definiciones, mapas musculares y modales. |
| `landing.html` | `/landing` | Pagina informativa/marketing. | Contenido publicitario/institucional. |
| `layout.html` | `No encontrado` | Layout base compartido. | Incluido por otras vistas; no se navega directo. |
| `muscle_map.html` | `/muscle-map` | Vista del sistema. | Uso general. |
| `nutrition.html` | `/nutrition` | Nutricion y planes de comidas. | Uso general. |
| `offline.html` | `/offline.html` | Pagina offline/estado de red. | Se muestra sin conexion o error de red. |
| `onboarding_par_q.html` | `/par-q` | Onboarding y cuestionarios. | Uso general. |
| `plan.html` | `/plan` | Vista del sistema. | Uso general. |
| `profile.html` | `/profile` | Vista del sistema. | Uso general. |
| `rm_calculator.html` | `/rm-calculator` | Vista del sistema. | Uso general. |
| `routine_builder.html` | `/admin/routines/builder` | Catalogos y gestion de rutinas. | Catalogo, builder o listado de rutinas. |
| `routine_builder_guided.html` | `/routines/builder-guided` | Catalogos y gestion de rutinas. | Catalogo, builder o listado de rutinas. |
| `routine_builder_user.html` | `/routines/builder` | Catalogos y gestion de rutinas. | Catalogo, builder o listado de rutinas. |
| `routine_generator.html` | `/ai/routine/generator` | Catalogos y gestion de rutinas. | Catalogo, builder o listado de rutinas. |
| `routine_generator_mongo.html` | `/ai/routine/generator_mongo` | Catalogos y gestion de rutinas. | Catalogo, builder o listado de rutinas. |
| `routines_catalog.html` | `/admin/routines` | Catalogos y gestion de rutinas. | Catalogo, builder o listado de rutinas. |
| `routines_catalog_user.html` | `/routines` | Catalogos y gestion de rutinas. | Catalogo, builder o listado de rutinas. |
| `workout_dashboard.html` | `/dashboard` | Dashboard de entrenamiento. | Resumen de progreso y acciones rapidas. |
| `workout_runner.html` | `/run/<routine_id>` | Vista de entrenamiento/rutina. | Runner de rutina con UI interactiva. |

## components

| Template | Rutas | Descripcion | Comentarios |
|---|---|---|---|
| `components/adherence_goal_picker.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `components/adherence_heatmap.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `components/adherence_kpis.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `components/assigned_routines.html` | `No encontrado` | Asignacion de rutinas. | Panel para asignar rutinas a usuarios. |
| `components/created_routines.html` | `No encontrado` | Catalogos y gestion de rutinas. | Catalogo, builder o listado de rutinas. |
| `components/loader.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `components/macros.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `components/session_history.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `components/sidebar.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `components/sidebar_admin.html` | `No encontrado` | Vista del sistema. | Uso general. |

## partials\assign_v2

| Template | Rutas | Descripcion | Comentarios |
|---|---|---|---|
| `partials/assign_v2/header.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `partials/assign_v2/routines_panel.html` | `No encontrado` | Catalogos y gestion de rutinas. | Catalogo, builder o listado de rutinas. |
| `partials/assign_v2/scripts.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `partials/assign_v2/toast.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `partials/assign_v2/user_selector.html` | `No encontrado` | Vista del sistema. | Uso general. |

## partials\exercises

| Template | Rutas | Descripcion | Comentarios |
|---|---|---|---|
| `partials/exercises/modals.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `partials/exercises/muscle_icons.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `partials/exercises/pagination.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `partials/exercises/scripts.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `partials/exercises/states.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `partials/exercises/toolbar.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `partials/exercises/views.html` | `No encontrado` | Vista del sistema. | Uso general. |

## partials\glossary

| Template | Rutas | Descripcion | Comentarios |
|---|---|---|---|
| `partials/glossary/content.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `partials/glossary/image_modal.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `partials/glossary/scripts.html` | `No encontrado` | Vista del sistema. | Uso general. |

## partials\runner

| Template | Rutas | Descripcion | Comentarios |
|---|---|---|---|
| `partials/runner/scripts.html` | `No encontrado` | Vista del sistema. | Uso general. |
| `partials/runner/video_modal.html` | `No encontrado` | Vista del sistema. | Uso general. |

