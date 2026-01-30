# Analisis de duplicidades y oportunidades de modularizacion

Alcance revisado: `app.py`, `routes/*.py`, `utils/*.py`, `templates/*.html`, `templates/components/*.html`, `static/css/*.css`.

## Backend: secciones con logica repetida
- Validacion de DB activa: revisa `extensions.db is None` antes de operar; usado en `routes/auth.py`, `routes/user.py`, `routes/admin.py`, `routes/nutrition.py`, `routes/ai.py`, `routes/workout.py`; variantes en mensaje y codigo de error (`DB not ready`, `DB no inicializada`, `DB no disponible`).
- Autenticacion por cookies y rol: lectura de `user_session` y `admin_token`; usado en `routes/auth.py` (login/logout), `routes/admin.py` (before_request), `utils/auth_helpers.py` (check_admin_access), `middleware/auth_middleware.py`; variantes en origen de token (cookie/header/query) y en la respuesta (redirect vs JSON).
- Serializacion de fechas: conversion de `datetime` a string ISO o `%Y-%m-%d`; usado en `routes/user.py` (planes, progreso, metrics), `routes/nutrition.py` (meal_plans), `routes/ai.py` (ajustes), `routes/admin.py` (usuarios, perfiles, planes), `routes/workout.py` (heatmap); variantes en formato (`isoformat()+Z`, `strftime`, `str`).
- Manejo de errores y respuesta JSON: bloques `try/except` con `logger.error` y `jsonify`; usado en todos los blueprints; variantes en los mensajes y en la categoria de error.
- Activacion/desactivacion de planes: desactivar anteriores y activar uno nuevo; usado en `routes/nutrition.py` (meal_plans), `routes/admin.py` (plans), `routes/user.py` (active plan); variantes en campos (`active`, `activated_at`) y colecciones.
- Normalizacion de metricas y progreso: mapeo de peso y grasa con prioridades; usado en `routes/user.py` (`get_progress`, `latest_metrics`), `utils/helpers.py` (normalize_measurements); variantes en las fuentes (`input.measurements`, `output.body_composition`, legacy fields).
- Logging de agentes: `log_agent_execution` con inicio/fin; usado en `routes/ai.py` y `routes/nutrition.py`; variante en payload y en persistencia a DB.
- Carga de perfil y datos agregados: composicion de contexto del usuario; usado en `routes/user.py` (`profile_page`, `get_my_profile_aggregated`) y `utils/db_helpers.py` (get_user_profile); variantes en campos incluidos y en formato de fechas.
- Duplicidad en helper de progreso: `fetch_user_progress_for_agent` existe en `utils/helpers.py` y `utils/db_helpers.py` con firmas y retornos distintos; riesgo de uso inconsistente.
- Ruta duplicada en Workout: `@workout_bp.get("/api/exercises")` aparece dos veces en `routes/workout.py`; el segundo handler sobrescribe al primero y genera ambiguedad funcional.

## Frontend: secciones con logica o diseno repetido
- Estructura de `<head>` y carga de CDNs: repetido en muchas plantillas sin `extends`; usado en `templates/auth.html`, `templates/dashboard.html`, `templates/nutrition.html`, `templates/admin_*.html`, etc.; variante en algunos scripts y estilos locales adicionales.
- Sidebar y comportamiento responsive: inclusion de `components/sidebar.html` y `components/sidebar_admin.html` con logica JS repetida; usado en la mayoria de plantillas; variante en `localStorage` keys y items de menu.
- Modales de alerta/confirmacion: implementaciones inline de `showAlertModal` y `showConfirmModal`; usado en `templates/layout.html`, `templates/body_assessment*.html`, `templates/nutrition.html`, `templates/profile.html`, `templates/routine_builder*.html`; variantes en firma y estilos.
- Catalogos y builders duplicados: pares usuario/admin con gran parte de HTML y JS iguales; usado en `templates/exercises_catalog.html` vs `templates/exercises_catalog_user.html`, `templates/routines_catalog.html` vs `templates/routines_catalog_user.html`, `templates/routine_builder.html` vs `templates/routine_builder_user.html`.
- Estilos de UI: reglas repetidas para hover/transition de imagenes y cards; usado en `static/css/styles.css` y patrones similares en varias plantillas; variantes en duracion y escala.

## Relacion entre objetos que usan la misma logica
- Autenticacion y roles: `middleware/auth_middleware.py` + `utils/auth_helpers.py` + endpoints en `routes/auth.py` y `routes/admin.py` + sidebars (muestran estado/acciones por rol).
- Planes y nutricion: `routes/user.py` (plan activo) + `routes/nutrition.py` (meal_plans) + plantillas `templates/plan.html` y `templates/nutrition.html`.
- Progreso y evaluacion corporal: `routes/user.py` (progress y latest_metrics) + `routes/ai.py` (body_assessment) + plantillas `templates/body_assessment*.html`.
- Catalogos de ejercicios y rutinas: `routes/workout.py` + `routes/admin.py` (routines, exercises) + plantillas `templates/exercises_*.html` y `templates/routines_*.html`.

## Sugerencias de modularizacion
- Crear helpers comunes para: verificacion de DB, serializacion de fechas, respuestas JSON estandar y manejo de errores.
- Unificar `fetch_user_progress_for_agent` en un solo modulo con una firma clara y reutilizable.
- Crear un wrapper de ejecucion de agentes (init, log, persistencia, respuesta) para evitar codigo repetido en `routes/ai.py` y `routes/nutrition.py`.
- Extraer logica de planes activos (activar/desactivar/consultar) a un servicio o helper.
- Implementar un layout base para usuario y admin, con bloques reutilizables para head, scripts y sidebar.
- Mover modal de alertas a un componente compartido y exponer API JS unica (evita duplicados con firmas distintas).
- Consolidar plantillas duplicadas (admin/user) mediante herencia de Jinja y bloques de variacion.
- Revisar rutas duplicadas de workout y definir una sola fuente para `/api/exercises`.

## Tareas a realizar (status: pendiente)
- [ ] Normalizar la validacion de DB y las respuestas 503 en un helper o decorador.
- [ ] Unificar serializacion de fechas en un helper reutilizable.
- [ ] Consolidar `fetch_user_progress_for_agent` en un solo modulo y ajustar referencias.
- [ ] Crear un wrapper comun para ejecucion de agentes (log + persistencia + response).
- [ ] Extraer logica de activacion/desactivacion de planes en un servicio compartido.
- [ ] Resolver la duplicidad de la ruta `/workout/api/exercises` y definir un solo handler.
- [ ] Crear layout base de usuario y admin con `extends` y bloques comunes.
- [ ] Mover alert/confirm modal a un componente JS compartido y eliminar duplicados.
- [ ] Refactorizar plantillas duplicadas de catalogos y builders usando herencia.
- [ ] Revisar y consolidar estilos repetidos en `static/css/styles.css` y plantillas.
