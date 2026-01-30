# Reporte de colores y temas

## Alcance
- Carpetas revisadas: `templates/`, `templates/components/`, `static/css/`.
- Archivos clave de tema: `static/css/theme.css` (tema default oscuro y tema light actual).
- Objetivo: inventariar colores literales usados en templates/componentes, describir uso con el tema default, y preparar propuesta de nuevo tema claro sin tocar el default.

## Tema default (oscuro) - variables y uso
Fuente: `static/css/theme.css`.

### Superficies
- `--bg-body: #0b0f14` (fondo global del body).
- `--bg-panel: #111827` (navbar/sidebar, paneles).
- `--bg-card: #1b2230` (cards, list-group-item, modals).
- `--bg-card-hover: #2a3446` (hover de tablas y list-group).
- `--bg-input: #1b2230` (inputs y selects).
- `--border-color: #2f3a4e` y `--border-light: #415067` (bordes principales).

### Texto
- `--text-main: #f8fafc` (texto general).
- `--text-header: #f8fafc` (h1-h6 forzado a este color en ambos temas).
- `--text-secondary: #cbd5e1` (secundario).
- `--text-muted: #94a3b8` (muted).
- `--text-placeholder: #88a9d5` (placeholders).

### Marca y estados
- `--primary: #4f8df7` / `--primary-hover: #2f6de6` (botones primarios, focus ring, nav active).
- `--success: #22c55e`, `--info: #38bdf8`, `--warning: #f59e0b`, `--danger: #ef4444`, `--secondary: #94a3b8`.
- Backgrounds y textos de alertas: `--success-bg #0f2e1c`, `--info-bg #0b2230`, `--warning-bg #2b1f0a`, `--danger-bg #2b1111`, `--secondary-bg #1c2432`.

### Uso por clases (tema default)
- `bg-panel`, `bg-card`, `text-theme`, `border-theme` conectan templates con variables de tema.
- Formularios y tablas usan variables de tema por reglas globales (form-control, table, modal-content).
- `btn-*`, `alert-*`, `badge-*`, `bg-*`, `border-*` son override para usar variables (mantienen consistencia de tema default).

## Tema light actual (no se modifica aqui)
Fuente: `static/css/theme.css` en `[data-theme="light"]`.

- `--bg-body: #f1f5f9`, `--bg-panel: #c8def1`, `--bg-card: #c2eaed`, `--bg-card-hover: #9cc0e4`.
- `--bg-input: #f8fafc`, `--border-color: #e2e8f0`, `--border-light: #f1f5f9`.
- `--text-main: #0f172a`, `--text-secondary: #334155`, `--text-muted: #64748b`, `--text-placeholder: #94a3b8`.
- `--primary: #2563eb` y estados adaptados para contraste claro.

## Colores literales encontrados (templates/components)
Nota: esta lista refleja valores literales en HTML/inline styles y clases con color explicito. Muchos no usan variables del tema, por lo que afectan el tema light.

### Paleta oscura literal (fondos/bordes)
- `#000`, `#0b0b0b`, `#111`, `#1a1a1a`, `#1f2937`, `#222`, `#333`, `#444`.
- Ejemplos de uso: `templates/body_assessment.html`, `templates/workout_runner.html`, `templates/nutrition.html`, `templates/layout.html`.

### Blancos y grises claros literales
- `#fff`, `#ffffff`, `#e5e7eb`, `#c7c7c7`, `#ccc`, `#ddd`, `#eee`, `#f8f9fa`.
- Usados en texto y fondos (ej. `templates/body_assessment.html`, `templates/dashboard.html`, `templates/workout_runner.html`).

### Acentos neon/cyber
- Verde: `#00ff9d`, `#00e676`.
- Azul/cian: `#00d2ff`, `#007bff`, `#0056b3`.
- Naranja: `#ff9d00`.
- Se ven en `templates/workout_runner.html`, `templates/workout_dashboard.html`, `templates/exercises_catalog*.html`, `templates/routine_builder*.html`.

### Acentos y estados (no tema)
- Verde: `#10b981`, `#26a641`, `#39d353`, `#059669`, `#006d32`.
- Rojo: `#ef4444`, `#ff5c5c`.
- Amarillo: `#facc15`.
- Azul: `#3b82f6`, `#1e40af`.

### Transparencias y overlays
- Neutros: `rgba(0, 0, 0, 0.1..0.8)` en varios templates.
- Acentos: `rgba(0, 210, 255, 0.1..0.6)`, `rgba(0, 255, 157, 0.15..0.6)`, `rgba(59, 130, 246, 0.1..0.4)`.

### Inventario completo (color -> archivos)
- `#000`: `templates/admin_body_assessments.html`, `templates/body_assessment.html`, `templates/body_assessment_history.html`, `templates/body_assessment_user.html`, `templates/exercises_list.html`, `templates/nutrition.html`, `templates/routines_catalog_user.html`, `templates/workout_dashboard.html`, `templates/workout_runner.html`
- `#0056b3`: `templates/admin_privileges.html`, `templates/admin_profiles.html`, `templates/admin_users.html`, `templates/exercises_catalog.html`, `templates/exercises_catalog_user.html`, `templates/routines_catalog.html`, `templates/routines_catalog_user.html`
- `#006d32`: `templates/dashboard.html`, `templates/workout_dashboard.html`
- `#007bff`: `templates/admin_privileges.html`, `templates/admin_profiles.html`, `templates/admin_users.html`, `templates/exercises_catalog.html`, `templates/exercises_catalog_user.html`, `templates/routines_catalog.html`, `templates/routines_catalog_user.html`
- `#00d2ff`: `static/css/assigned_routines.css`, `templates/admin_privileges.html`, `templates/admin_profiles.html`, `templates/admin_users.html`, `templates/exercises_catalog.html`, `templates/exercises_catalog_user.html`, `templates/routine_builder.html`, `templates/routine_builder_user.html`, `templates/routines_catalog.html`, `templates/routines_catalog_user.html`, `templates/workout_dashboard.html`
- `#00e676`: `templates/workout_runner.html`
- `#00ff9d`: `static/css/assigned_routines.css`, `templates/admin_privileges.html`, `templates/admin_profiles.html`, `templates/admin_users.html`, `templates/body_assessment.html`, `templates/body_assessment_user.html`, `templates/exercises_catalog.html`, `templates/exercises_catalog_user.html`, `templates/layout.html`, `templates/nutrition.html`, `templates/profile.html`, `templates/routine_builder.html`, `templates/routine_builder_user.html`, `templates/routines_catalog.html`, `templates/routines_catalog_user.html`, `templates/workout_dashboard.html`, `templates/workout_runner.html`
- `#033e53`: `templates/workout_runner.html`
- `#0b0b0b`: `templates/body_assessment.html`, `templates/body_assessment_user.html`, `templates/layout.html`, `templates/nutrition.html`, `templates/profile.html`, `templates/workout_runner.html`
- `#0dcaf0`: `templates/routine_builder.html`, `templates/routine_builder_user.html`
- `#0f0f0f`: `templates/workout_runner.html`
- `#0f172a`: `templates/exercises_list.html`
- `#10b981`: `templates/admin_meal_plans.html`, `templates/admin_plans.html`, `templates/assign_routine.html`, `templates/dashboard.html`, `templates/workout_dashboard.html`
- `#111`: `templates/workout_runner.html`
- `#111827`: `templates/plan.html`, `static/css/styles.css`, `static/css/loader.css`
- `#141a26`: `static/css/assigned_routines.css`, `templates/routines_catalog.html`, `templates/routines_catalog_user.html`
- `#1a1d21`: `templates/routine_builder.html`, `templates/routine_builder_user.html`
- `#1a2230`: `static/css/assigned_routines.css`, `templates/routines_catalog.html`, `templates/routines_catalog_user.html`
- `#1b2434`: `static/css/assigned_routines.css`, `templates/routines_catalog.html`, `templates/routines_catalog_user.html`
- `#1e40af`: `templates/dashboard.html`
- `#1f2937`: `static/css/sidebar.css`, `templates/admin_meal_plans.html`
- `#222`: `templates/exercises_catalog_user.html`, `templates/workout_runner.html`
- `#225`: `templates/exercises_catalog.html`, `templates/exercises_catalog_user.html`, `templates/routine_builder.html`, `templates/routine_builder_user.html`
- `#2a2a2a`: `templates/body_assessment.html`, `templates/body_assessment_user.html`, `templates/layout.html`, `templates/nutrition.html`, `templates/profile.html`, `templates/workout_runner.html`
- `#2c3035`: `templates/dashboard.html`, `templates/workout_dashboard.html`
- `#333`: `templates/nutrition.html`, `templates/workout_dashboard.html`, `templates/workout_runner.html`
- `#374151`: `static/css/sidebar.css`, `templates/dashboard.html`
- `#39d353`: `templates/dashboard.html`, `templates/workout_dashboard.html`
- `#3b82f6`: `templates/dashboard.html`
- `#444`: `templates/body_assessment.html`, `templates/body_assessment_user.html`, `templates/exercises_catalog_user.html`, `templates/workout_runner.html`
- `#555`: `templates/nutrition.html`, `templates/routines_catalog_user.html`
- `#60a5fa`: `templates/exercises_list.html`
- `#666`: `templates/routines_catalog_user.html`
- `#6ee7b7`: `templates/admin_privileges.html`
- `#6f42c1`: `templates/admin_dashboard.html`
- `#888`: `templates/workout_dashboard.html`
- `#9ca3af`: `static/css/styles.css`
- `#aaa`: `templates/exercises_catalog_user.html`
- `#c7c7c7`: `templates/body_assessment.html`, `templates/body_assessment_user.html`, `templates/layout.html`, `templates/nutrition.html`, `templates/profile.html`
- `#ccc`: `templates/body_assessment_history.html`, `templates/nutrition.html`, `templates/routines_catalog_user.html`, `templates/workout_dashboard.html`
- `#ddd`: `templates/body_assessment_history.html`, `templates/nutrition.html`, `templates/routines_catalog_user.html`
- `#dee2e6`: `templates/workout_runner.html`
- `#e5e7eb`: `templates/dashboard.html`
- `#eee`: `templates/nutrition.html`
- `#ef4444`: `templates/assign_routine.html`, `templates/dashboard.html`
- `#f8f9fa`: `templates/nutrition.html`, `templates/workout_runner.html`
- `#facc15`: `templates/dashboard.html`
- `#fca5a5`: `templates/admin_privileges.html`
- `#ff5c5c`: `templates/body_assessment.html`, `templates/body_assessment_user.html`, `templates/layout.html`, `templates/nutrition.html`, `templates/profile.html`
- `#ff9d00`: `static/css/assigned_routines.css`, `templates/body_assessment.html`, `templates/body_assessment_user.html`, `templates/layout.html`, `templates/nutrition.html`, `templates/profile.html`, `templates/workout_dashboard.html`, `templates/workout_runner.html`
- `#ffc107`: `templates/routine_builder.html`, `templates/routine_builder_user.html`
- `#fff`: `static/css/sidebar.css`, `templates/admin_auth.html`, `templates/body_assessment.html`, `templates/body_assessment_user.html`, `templates/exercises_catalog_user.html`, `templates/layout.html`, `templates/nutrition.html`, `templates/profile.html`, `templates/routines_catalog_user.html`, `templates/workout_runner.html`
- `#ffffff`: `templates/admin_meal_plans.html`, `templates/admin_plans.html`, `templates/plan.html`
- `black`: `templates/body_assessment.html`, `templates/body_assessment_history.html`, `templates/body_assessment_user.html`, `templates/nutrition.html`, `templates/routines_catalog_user.html`, `templates/workout_runner.html`
- `white`: `static/css/sidebar.css`, `templates/admin_body_assessments.html`, `templates/admin_meal_plans.html`, `templates/admin_plans.html`, `templates/admin_privileges.html`, `templates/admin_profiles.html`, `templates/admin_users.html`, `templates/assign_routine.html`, `templates/auth.html`, `templates/body_assessment.html`, `templates/body_assessment_history.html`, `templates/body_assessment_user.html`, `templates/components/assigned_routines.html`, `templates/components/created_routines.html`, `templates/components/session_history.html`, `templates/components/sidebar.html`, `templates/components/sidebar_admin.html`, `templates/dashboard.html`, `templates/exercises_catalog.html`, `templates/exercises_catalog_user.html`, `templates/exercises_list.html`, `templates/glossary.html`, `templates/nutrition.html`, `templates/plan.html`, `templates/profile.html`, `templates/routine_builder.html`, `templates/routine_builder_user.html`, `templates/routine_generator.html`, `templates/routines_catalog.html`, `templates/routines_catalog_user.html`, `templates/workout_dashboard.html`, `templates/workout_runner.html`
- `transparent`: `static/css/loader.css`, `static/css/sidebar.css`, `templates/admin_body_assessments.html`, `templates/admin_meal_plans.html`, `templates/assign_routine.html`, `templates/body_assessment.html`, `templates/body_assessment_history.html`, `templates/body_assessment_user.html`, `templates/dashboard.html`, `templates/exercises_list.html`, `templates/landing.html`, `templates/nutrition.html`, `templates/plan.html`, `templates/routine_generator.html`, `templates/routines_catalog_user.html`
- `rgba(0, 0, 0, 0.06)`: `templates/body_assessment.html`, `templates/body_assessment_user.html`
- `rgba(0, 0, 0, 0.1)`: `templates/about.html`, `templates/admin_auth.html`, `templates/admin_body_assessments.html`, `templates/body_assessment.html`, `templates/body_assessment_history.html`, `templates/body_assessment_user.html`, `templates/landing.html`, `templates/workout_runner.html`
- `rgba(0, 0, 0, 0.15)`: `templates/workout_runner.html`
- `rgba(0, 0, 0, 0.2)`: `templates/assign_routine.html`, `templates/glossary.html`
- `rgba(0, 0, 0, 0.3)`: `templates/admin_dashboard.html`, `templates/glossary.html`, `templates/nutrition.html`, `templates/workout_dashboard.html`
- `rgba(0, 0, 0, 0.35)`: `templates/workout_runner.html`
- `rgba(0, 0, 0, 0.4)`: `templates/auth.html`
- `rgba(0, 0, 0, 0.45)`: `templates/nutrition.html`
- `rgba(0, 0, 0, 0.5)`: `static/css/loader.css`, `static/css/sidebar.css`, `templates/workout_runner.html`
- `rgba(0, 0, 0, 0.6)`: `templates/body_assessment.html`, `templates/body_assessment_user.html`, `templates/layout.html`, `templates/nutrition.html`, `templates/profile.html`, `templates/workout_runner.html`
- `rgba(0, 0, 0, 0.7)`: `templates/body_assessment.html`, `templates/body_assessment_user.html`, `templates/layout.html`, `templates/nutrition.html`, `templates/profile.html`, `templates/workout_runner.html`
- `rgba(0, 0, 0, 0.8)`: `templates/dashboard.html`, `templates/exercises_list.html`, `templates/plan.html`, `templates/workout_runner.html`
- `rgba(0, 210, 255, 0.1)`: `templates/workout_dashboard.html`
- `rgba(0, 210, 255, 0.3)`: `static/css/assigned_routines.css`, `templates/admin_privileges.html`, `templates/admin_profiles.html`, `templates/admin_users.html`, `templates/exercises_catalog.html`, `templates/exercises_catalog_user.html`, `templates/routines_catalog.html`, `templates/routines_catalog_user.html`
- `rgba(0, 210, 255, 0.4)`: `templates/admin_privileges.html`, `templates/admin_profiles.html`, `templates/admin_users.html`, `templates/exercises_catalog.html`, `templates/exercises_catalog_user.html`, `templates/routines_catalog.html`, `templates/routines_catalog_user.html`
- `rgba(0, 210, 255, 0.6)`: `templates/admin_privileges.html`, `templates/admin_profiles.html`, `templates/admin_users.html`, `templates/exercises_catalog.html`, `templates/exercises_catalog_user.html`, `templates/routines_catalog.html`, `templates/routines_catalog_user.html`
- `rgba(0, 230, 118, 0.4)`: `templates/workout_runner.html`
- `rgba(0, 255, 157, 0.15)`: `templates/workout_runner.html`
- `rgba(0, 255, 157, 0.2)`: `templates/workout_runner.html`
- `rgba(0, 255, 157, 0.3)`: `static/css/assigned_routines.css`, `templates/admin_privileges.html`, `templates/admin_profiles.html`, `templates/admin_users.html`, `templates/exercises_catalog.html`, `templates/exercises_catalog_user.html`, `templates/routines_catalog.html`, `templates/routines_catalog_user.html`
- `rgba(0, 255, 157, 0.4)`: `templates/workout_dashboard.html`
- `rgba(0, 255, 157, 0.5)`: `templates/exercises_catalog_user.html`
- `rgba(0, 255, 157, 0.6)`: `templates/workout_dashboard.html`
- `rgba(0,0,0,0.5)`: `templates/admin_body_assessments.html`, `templates/body_assessment.html`, `templates/body_assessment_history.html`, `templates/body_assessment_user.html`
- `rgba(15, 23, 42, 0.7)`: `templates/exercises_list.html`
- `rgba(16, 185, 129, 0.1)`: `templates/assign_routine.html`
- `rgba(16, 185, 129, 0.2)`: `templates/admin_privileges.html`, `templates/assign_routine.html`
- `rgba(16, 185, 129, 0.5)`: `templates/admin_privileges.html`
- `rgba(17, 24, 39, 0.75)`: `static/css/styles.css`, `templates/dashboard.html`
- `rgba(239, 68, 68, 0.1)`: `templates/assign_routine.html`, `templates/components/sidebar_admin.html`
- `rgba(239, 68, 68, 0.2)`: `templates/admin_privileges.html`
- `rgba(239, 68, 68, 0.5)`: `templates/admin_privileges.html`
- `rgba(239,68,68,0.2)`: `templates/dashboard.html`
- `rgba(245, 158, 11, 0.1)`: `templates/landing.html`
- `rgba(255, 193, 7, 0.3)`: `templates/body_assessment.html`, `templates/body_assessment_user.html`
- `rgba(255, 255, 255, 0.05)`: `templates/exercises_catalog.html`, `templates/glossary.html`
- `rgba(255, 255, 255, 0.08)`: `static/css/assigned_routines.css`, `templates/routines_catalog.html`, `templates/routines_catalog_user.html`
- `rgba(255, 255, 255, 0.1)`: `templates/glossary.html`, `templates/routine_builder.html`, `templates/routine_builder_user.html`
- `rgba(255, 255, 255, 0.12)`: `static/css/assigned_routines.css`, `templates/routines_catalog.html`, `templates/routines_catalog_user.html`
- `rgba(255, 255, 255, 0.3)`: `templates/routine_builder.html`, `templates/routine_builder_user.html`
- `rgba(255,255,255,0.2)`: `templates/workout_runner.html`
- `rgba(30,30,30,0.95)`: `templates/workout_runner.html`
- `rgba(33, 37, 41, 0.95)`: `templates/routine_builder.html`, `templates/routine_builder_user.html`
- `rgba(34, 197, 94, 0.1)`: `templates/landing.html`
- `rgba(37, 99, 235, 0.1)`: `templates/assign_routine.html`
- `rgba(37, 99, 235, 0.18)`: `templates/nutrition.html`
- `rgba(37, 99, 235, 0.2)`: `templates/exercises_list.html`
- `rgba(37, 99, 235, 0.25)`: `templates/auth.html`, `templates/nutrition.html`
- `rgba(37, 99, 235, 0.3)`: `templates/dashboard.html`, `templates/nutrition.html`, `templates/plan.html`
- `rgba(37, 99, 235, 0.4)`: `templates/dashboard.html`, `templates/exercises_list.html`, `templates/plan.html`
- `rgba(56, 189, 248, 0.1)`: `templates/landing.html`
- `rgba(59, 130, 246, .25)`: `templates/admin_plans.html`, `templates/auth.html`
- `rgba(59, 130, 246, 0.1)`: `templates/admin_auth.html`, `templates/admin_body_assessments.html`, `templates/body_assessment.html`, `templates/body_assessment_history.html`, `templates/body_assessment_user.html`
- `rgba(59, 130, 246, 0.2)`: `templates/body_assessment.html`, `templates/body_assessment_history.html`, `templates/body_assessment_user.html`
- `rgba(59, 130, 246, 0.25)`: `templates/body_assessment.html`, `templates/body_assessment_user.html`
- `rgba(59, 130, 246, 0.3)`: `templates/auth.html`
- `rgba(59, 130, 246, 0.4)`: `templates/exercises_list.html`
- `rgba(59,130,246,0.2)`: `templates/dashboard.html`
- `rgba(11, 15, 20, 0.8)`: `static/css/loader.css`

## Impacto en el tema light (observaciones)
- Mucho contenido usa `text-white` y fondos oscuros (`#000`, `#111`, `#1a1a1a`) fuera de variables, lo que rompe el contraste cuando `data-theme="light"`.
- Varios componentes usan acentos neon (cian/verde/naranja) con fondos oscuros; en light pueden perder legibilidad si se mantienen igual.
- Sidebar y overlays tienen colores hard-coded (`#1f2937`, `#374151`, `rgba(0,0,0,0.5)`) que ignoran el tema.

## Propuesta de redisenio total del tema claro (borrador)
Objetivo: mantener identidad del tema default (azul primario + contraste fuerte) pero con superficies suaves, elevacion y legibilidad limpia.

### Direccion visual
- Base clara frio-neutra (slate + azul suave), tarjetas blancas/claras con sombra sutil.
- Accentos cian/verde/naranja mantienen energia deportiva pero con saturacion controlada para legibilidad.
- Texto oscuro real (slate-900) y secundarios slate-600/700.

### Nueva propuesta de variables light (solo propuesta)
- `--bg-body: #f4f7fb`
- `--bg-panel: #e7eef6`
- `--bg-card: #ffffff`
- `--bg-card-hover: #eaf2ff`
- `--bg-input: #ffffff`
- `--border-color: #d6e0ea`
- `--border-light: #edf2f7`
- `--text-main: #0b1220`
- `--text-secondary: #334155`
- `--text-muted: #5b6b7f`
- `--text-placeholder: #94a3b8`
- `--primary: #2b6ef2`
- `--primary-hover: #1f56c7`
- `--success: #22a861`, `--success-bg: #e6f7ee`, `--success-text: #135b35`
- `--info: #1a8fd6`, `--info-bg: #e6f4fb`, `--info-text: #0b4b6f`
- `--warning: #d88600`, `--warning-bg: #fff3d6`, `--warning-text: #7a3f00`
- `--danger: #d93838`, `--danger-bg: #fde8e8`, `--danger-text: #7a1c1c`
- `--secondary: #6b7a90`, `--secondary-bg: #eef2f7`, `--secondary-text: #334155`

### Ajustes necesarios para mantener integridad
- Mover colores neon hard-coded a variables semanticas: `--accent-cyan`, `--accent-green`, `--accent-orange`.
- Reemplazar fondos `#000/#111/#1a1a1a` por `var(--bg-panel)` o `var(--bg-card)`.
- Reemplazar `text-white` por `text-theme` o `text-main` en vistas que deben adaptarse a light.

## Archivos con acentos o hard-coded que afectaran light
- `templates/workout_runner.html`, `templates/workout_dashboard.html`, `templates/body_assessment*.html`, `templates/nutrition.html`, `templates/layout.html`.
- `templates/exercises_catalog*.html`, `templates/routine_builder*.html`, `templates/routines_catalog*.html`.
- CSS: `static/css/assigned_routines.css`, `static/css/sidebar.css`, `static/css/styles.css`, `static/css/loader.css`.
