# Rutas y templates

Listado de templates y rutas que los renderizan. Incluye recursos y dependencias detectadas en el HTML. (Generado automaticamente).

## .

| Template | Rutas | Descripcion | Comentarios / Detalle |
|---|---|---|---|
| `about.html` | `/about` | Pagina informativa/marketing. | Incluye: components/sidebar.html Scripts: /static/js/lang.js, /static/js/theme.js CSS: /static/css/sidebar.css, /static/css/theme.css |
| `adherence_dashboard.html` | `/adherence` | Resumen principal del usuario. | Incluye: components/adherence_goal_picker.html, components/adherence_heatmap.html, components/adherence_kpis.html... Scripts: /static/js/adherence_dashboard.js Bloques: content, sidebar, title |
| `admin_auth.html` | `/admin/login` | Vista del panel administrativo. | Scripts: /static/js/lang.js, /static/js/theme.js CSS: /static/css/theme.css Orientado a admin. |
| `admin_body_assessments.html` | `/admin/body_assessments` | Vista del panel administrativo. | Incluye: components/sidebar_admin.html Scripts: /static/js/lang.js, /static/js/theme.js, /static/js/user_search.js CSS: /static/css/sidebar.css, /static/css/theme.css Orientado a admin. |
| `admin_dashboard.html` | `/admin` | Vista del panel administrativo. | Incluye: components/sidebar_admin.html Scripts: /static/js/lang.js, /static/js/theme.js CSS: /static/css/sidebar.css, /static/css/theme.css Orientado a admin. |
| `admin_meal_plans.html` | `/admin/meal_plans` | Vista del panel administrativo. | Incluye: components/sidebar_admin.html Scripts: /static/js/lang.js, /static/js/theme.js, /static/js/user_search.js CSS: /static/css/sidebar.css, /static/css/theme.css Orientado a admin. |
| `admin_plans.html` | `/admin/plans` | Vista del panel administrativo. | Incluye: components/sidebar_admin.html Scripts: /static/js/lang.js, /static/js/theme.js, /static/js/user_search.js CSS: /static/css/sidebar.css, /static/css/theme.css Orientado a admin. |
| `admin_privileges.html` | `/admin/privileges` | Vista del panel administrativo. | Incluye: components/sidebar_admin.html Scripts: /static/js/admin_datagrid.js, /static/js/lang.js, /static/js/theme.js CSS: /static/css/sidebar.css, /static/css/theme.css Orientado a admin. |
| `admin_profiles.html` | `/admin/profiles` | Vista del panel administrativo. | Incluye: components/sidebar_admin.html Scripts: /static/js/admin_datagrid.js, /static/js/lang.js, /static/js/theme.js CSS: /static/css/sidebar.css, /static/css/theme.css Orientado a admin. |
| `admin_users.html` | `/admin/users` | Vista del panel administrativo. | Incluye: components/sidebar_admin.html Scripts: /static/js/admin_datagrid.js, /static/js/lang.js, /static/js/theme.js CSS: /static/css/sidebar.css, /static/css/theme.css Orientado a usuario final. Orientado a admin. |
| `assign_routine.html` | `/admin/routines/assign` | Asignacion de rutinas a usuarios. | Incluye: components/sidebar_admin.html Scripts: /static/js/lang.js, /static/js/theme.js, /static/js/user_search.js CSS: /static/css/sidebar.css, /static/css/theme.css |
| `assign_routine_v2.html` | `/admin/routines/assign-v2` | Asignacion de rutinas a usuarios. | Incluye: components/sidebar_admin.html, partials/assign_v2/header.html, partials/assign_v2/routines_panel.html... CSS: /static/css/assign/assign_v2.css Bloques: content, head, page_scripts, sidebar... |
| `auth.html` | `/` | Autenticacion y acceso al sistema. | Scripts: /static/js/lang.js, /static/js/theme.js CSS: /static/css/theme.css, /static/manifest.json |
| `body_assessment.html` | `/ai/body_assessment/tester` | Evaluacion corporal AI con formulario, fotos y reporte. | Incluye: components/sidebar_admin.html Scripts: /static/js/lang.js, /static/js/theme.js, /static/js/user_search.js CSS: /static/css/sidebar.css, /static/css/theme.css |
| `body_assessment_base.html` | `No encontrado` | Evaluacion corporal AI con formulario, fotos y reporte. | No se detecto ruta directa en routes/*.py. Scripts: /static/js/lang.js, /static/js/theme.js CSS: /static/css/sidebar.css, /static/css/theme.css Bloques: extra_head, extra_scripts, footer_block, form_block... Template base para herencia/extend. |
| `body_assessment_history.html` | `/ai/body_assessment/history/view/<user_id>` | Evaluacion corporal AI con formulario, fotos y reporte. | Incluye: components/loader.html, components/sidebar.html Scripts: /static/js/lang.js, /static/js/loader.js, /static/js/theme.js CSS: /static/css/loader.css, /static/css/sidebar.css, /static/css/theme.css |
| `body_assessment_unified.html` | `/ai/body_assessment/unified` | Evaluacion corporal AI con formulario, fotos y reporte. | Incluye: body_assessment.html, body_assessment_user.html Template puente que selecciona vista por query/source. |
| `body_assessment_user.html` | `/ai/body_assessment/user` | Evaluacion corporal AI con formulario, fotos y reporte. | Incluye: components/loader.html, components/sidebar.html Scripts: /static/js/lang.js, /static/js/loader.js, /static/js/theme.js CSS: /static/css/loader.css, /static/css/sidebar.css, /static/css/theme.css Orientado a usuario final. |
| `body_morph.html` | `/body-morph` | Vista del sistema. | Incluye: components/sidebar.html Scripts: /static/js/body_morph.js CSS: /static/css/body_morph.css Bloques: content, sidebar, title |
| `body_tracking.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. Incluye: components/sidebar.html Scripts: /static/js/theme.js CSS: /static/css/sidebar.css, /static/css/theme.css |
| `dashboard.html` | `/dashboard` | Resumen principal del usuario. | Incluye: components/assigned_routines.html, components/created_routines.html, components/loader.html... Scripts: /static/js/assigned_routines.js, /static/js/lang.js, /static/js/loader.js... CSS: /static/css/assigned_routines.css, /static/css/loader.css, /static/css/sidebar.css... |
| `exercises_catalog.html` | `/admin/exercises` | Catalogo y gestion de ejercicios con filtros. | Scripts: /static/js/loader.js Bloques: content, title |
| `exercises_catalog_user.html` | `No encontrado` | Catalogo y gestion de ejercicios con filtros. | No se detecto ruta directa en routes/*.py. Incluye: components/sidebar.html Scripts: /static/js/loader.js Bloques: content, sidebar, title Orientado a usuario final. |
| `exercises_list.html` | `/exercises/list` | Catalogo y gestion de ejercicios con filtros. | Incluye: components/sidebar.html Scripts: /static/js/lang.js, /static/js/theme.js CSS: /static/css/sidebar.css, /static/css/theme.css |
| `exercises_unified.html` | `/exercises` | Catalogo y gestion de ejercicios con filtros. | Incluye: partials/exercises/modals.html, partials/exercises/muscle_icons.html, partials/exercises/pagination.html... CSS: /static/css/exercises/exercises.css Bloques: content, head, page_scripts, sidebar Template puente que selecciona vista por query/source. |
| `glossary.html` | `/glossary` | Glosario y mapas musculares con modal de detalle. | Incluye: components/sidebar.html, partials/glossary/content.html, partials/glossary/image_modal.html... CSS: /static/css/glossary/glossary.css Bloques: content, head, page_scripts, sidebar... |
| `landing.html` | `/landing` | Pagina informativa/marketing. | Incluye: components/sidebar.html Scripts: /static/js/lang.js, /static/js/theme.js CSS: /static/css/sidebar.css, /static/css/theme.css |
| `layout.html` | `No encontrado` | Layout base con sidebar, bloques y recursos globales. | No se detecto ruta directa en routes/*.py. Incluye: components/loader.html, components/sidebar_admin.html Scripts: /static/js/lang.js, /static/js/loader.js, /static/js/offline_manager.js... CSS: /static/css/loader.css, /static/css/sidebar.css, /static/css/theme.css... Bloques: content, head, page_scripts, sidebar... |
| `muscle_map.html` | `/muscle-map` | Glosario y mapas musculares con modal de detalle. | Incluye: components/sidebar.html Scripts: /static/js/muscle_map.js CSS: /static/css/muscle_map.css Bloques: content, sidebar, title |
| `nutrition.html` | `/nutrition` | Modulo de nutricion y planes de comida. | Incluye: components/loader.html, components/sidebar.html Scripts: /static/js/lang.js, /static/js/loader.js, /static/js/meal_planner.js... CSS: /static/css/loader.css, /static/css/sidebar.css, /static/css/theme.css |
| `offline.html` | `/offline.html` | Pagina offline/estado de red. | Uso general. |
| `onboarding_par_q.html` | `/par-q` | Onboarding y cuestionarios de salud. | Bloques: content, title |
| `plan.html` | `/plan` | Vista del sistema. | Incluye: components/assigned_routines.html, components/loader.html, components/sidebar.html Scripts: /static/js/assigned_routines.js, /static/js/lang.js, /static/js/loader.js... CSS: /static/css/assigned_routines.css, /static/css/loader.css, /static/css/sidebar.css... |
| `profile.html` | `/profile` | Vista del sistema. | Incluye: components/sidebar.html Scripts: /static/js/lang.js, /static/js/theme.js CSS: /static/css/sidebar.css, /static/css/theme.css |
| `rm_calculator.html` | `/rm-calculator` | Vista del sistema. | Incluye: components/sidebar.html Bloques: content, sidebar, title |
| `routine_builder.html` | `/admin/routines/builder` | Catalogos, builder o generador de rutinas. | Scripts: /static/js/loader.js Bloques: content, title |
| `routine_builder_guided.html` | `/routines/builder-guided` | Catalogos, builder o generador de rutinas. | Incluye: components/sidebar.html, components/sidebar_admin.html Scripts: /static/js/routine_builder_guided.js Bloques: content, sidebar, title |
| `routine_builder_user.html` | `/routines/builder` | Catalogos, builder o generador de rutinas. | Incluye: components/sidebar.html Scripts: /static/js/loader.js Bloques: content, sidebar, title Orientado a usuario final. |
| `routine_generator.html` | `/ai/routine/generator` | Catalogos, builder o generador de rutinas. | Bloques: content, title |
| `routine_generator_mongo.html` | `/ai/routine/generator_mongo` | Catalogos, builder o generador de rutinas. | Bloques: content, title |
| `routines_catalog.html` | `/admin/routines` | Catalogos, builder o generador de rutinas. | Scripts: /static/js/loader.js Bloques: content, title |
| `routines_catalog_user.html` | `/routines` | Catalogos, builder o generador de rutinas. | Incluye: components/sidebar.html Scripts: /static/js/loader.js Bloques: content, sidebar, title Orientado a usuario final. |
| `workout_dashboard.html` | `/dashboard` | Dashboard de entrenamiento con resumen y charts. | Incluye: components/assigned_routines.html, components/created_routines.html, components/session_history.html Scripts: /static/js/assigned_routines.js, /static/js/user_search.js Bloques: content, title |
| `workout_runner.html` | `/run/<routine_id>` | Vista de rutina/ejecucion o gestion de entrenamiento. | Incluye: partials/runner/scripts.html, partials/runner/video_modal.html CSS: /static/css/runner/base.css, /static/css/runner/components.css, /static/css/runner/modals.css... Bloques: content, head, page_scripts, sidebar... |

## components

| Template | Rutas | Descripcion | Comentarios / Detalle |
|---|---|---|---|
| `components/adherence_goal_picker.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |
| `components/adherence_heatmap.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |
| `components/adherence_kpis.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |
| `components/assigned_routines.html` | `No encontrado` | Asignacion de rutinas a usuarios. | No se detecto ruta directa en routes/*.py. |
| `components/created_routines.html` | `No encontrado` | Catalogos, builder o generador de rutinas. | No se detecto ruta directa en routes/*.py. |
| `components/loader.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |
| `components/macros.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |
| `components/session_history.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. Scripts: /static/js/session_history.js |
| `components/sidebar.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. Scripts: /static/js/sidebar_ui.js, /static/js/user_search.js CSS: /static/css/theme.css |
| `components/sidebar_admin.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. Scripts: /static/js/sidebar_ui.js, /static/js/user_search.js CSS: /static/css/theme.css Orientado a admin. |

## partials\assign_v2

| Template | Rutas | Descripcion | Comentarios / Detalle |
|---|---|---|---|
| `partials/assign_v2/header.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |
| `partials/assign_v2/routines_panel.html` | `No encontrado` | Catalogos, builder o generador de rutinas. | No se detecto ruta directa en routes/*.py. |
| `partials/assign_v2/scripts.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. Scripts: /static/js/assign/actions.js, /static/js/assign/api.js, /static/js/assign/bootstrap.js... |
| `partials/assign_v2/toast.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |
| `partials/assign_v2/user_selector.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. Orientado a usuario final. |

## partials\exercises

| Template | Rutas | Descripcion | Comentarios / Detalle |
|---|---|---|---|
| `partials/exercises/modals.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |
| `partials/exercises/muscle_icons.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |
| `partials/exercises/pagination.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |
| `partials/exercises/scripts.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. Scripts: /static/js/exercises/actions.js, /static/js/exercises/api.js, /static/js/exercises/bootstrap.js... |
| `partials/exercises/states.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |
| `partials/exercises/toolbar.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |
| `partials/exercises/views.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |

## partials\glossary

| Template | Rutas | Descripcion | Comentarios / Detalle |
|---|---|---|---|
| `partials/glossary/content.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |
| `partials/glossary/image_modal.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |
| `partials/glossary/scripts.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. Scripts: /static/js/glossary/bootstrap.js, /static/js/glossary/data.js, /static/js/glossary/modal.js... |

## partials\runner

| Template | Rutas | Descripcion | Comentarios / Detalle |
|---|---|---|---|
| `partials/runner/scripts.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. Scripts: /static/js/runner/bootstrap.js, /static/js/runner/components/ActiveExercise.js, /static/js/runner/components/App.js... |
| `partials/runner/video_modal.html` | `No encontrado` | Vista del sistema. | No se detecto ruta directa en routes/*.py. |

