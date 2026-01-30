# Analisis de candidatos a mejora

Este documento lista objetos (archivos, modulos o endpoints) con oportunidades de mejora en rendimiento, mantenimiento, UX, modularizacion, depuracion y otros temas.

## Rendimiento
- `routes/workout.py` `api_filter_exercises`: multiples consultas a `body_parts` por cada musculo; mover a precarga/cache en memoria o usar un mapa en una sola consulta, y agregar indices en `body_parts.key/label/label_es`.
- `routes/workout.py` `list_public_exercises` y `api_list_exercises`: devuelven todo el catalogo sin paginacion ni limite; agregar paginacion, proyeccion estricta y caching.
- `routes/user.py` `get_progress`: hace merge y ordenamiento en Python con todos los registros; usar agregaciones y paginacion, limitar por rango de fechas.
- `middleware/auth_middleware.py` `inject_user_role`: ejecuta 2-3 consultas por request; usar un endpoint agregado o cache con TTL (en memoria o Redis).
- `routes/ai.py` `ai_body_assessment`: base64 de imagenes en memoria y subida a Cloudinary en el mismo request; limitar tamano, streaming/chunking, y subir en background.

## Mantenimiento y modularizacion
- `routes/ai.py`: archivo muy grande con multiples responsabilidades (reasoning, body assessment, rutina, planes). Dividido en modulos por feature.
- `routes/workout.py`: mezcla dashboard, runner, sesiones, stats y ejercicios. Separar en submodulos (`workout_sessions`, `workout_stats`, `workout_exercises`).
- `extensions.py`: side effects en import (logging y chequeos de env); mover a factory o inicializador para controlar orden de carga.
- `routes/*`: validaciones repetidas (JSON, campos requeridos, errores) y manejo de respuestas similar; crear helpers de validacion/respuesta.
- `utils/auth_helpers.py` y `routes/auth.py`: logica de autenticacion dispersa; centralizar en un servicio.
- Tipos de `user_id` mezclados (string y ObjectId) en varias rutas; normalizado y documentado el contrato.

## UX
- `middleware/auth_middleware.py` `check_workout_lock`: redireccion forzado al runner puede romper navegacion; agregar UI para reanudar/cancelar, y permitir excepciones configurables.
- `routes/user.py` `profile_page`: falta feedback cuando el perfil no existe; mostrar CTA claro para completar perfil.
- `routes/ai.py` `ai_body_assessment`: errores genericos; devolver mensajes de validacion mas claros (tamano, formato, max de fotos).

## Depuracion y observabilidad
- `extensions.py`, `app.py`, `routes/auth.py`: texto con caracteres corruptos ("ConfiguraciИn", "Ocurri¢"); revisar encoding y asegurar UTF-8 estable.
- `extensions.py`: logging global con `basicConfig` en import y mensajes hardcode; mover a config central y agregar `request_id`/trace para diagnostico.
- `app.py`: handler 500 no expone contexto; agregar correlation id y logging estructurado por request.

## Calidad y seguridad (otros)
- `routes/workout.py`: hay dos handlers con el mismo path `GET /workout/api/exercises`; solo uno queda activo. Consolidar en uno.
- `routes/auth.py` vs `routes/user.py`: reglas de password inconsistentes (min 8 en registro, min 6 en cambio); unificar politica.
- `routes/auth.py`: cookie `user_session` guarda solo el `user_id` sin firma; usar sesiones firmadas, JWT o server-side session.
- `config.py`/`.env`: existe `.env` en el repo; evitar subir credenciales y usar `.env.example`.
- `ai_agents`/`routes/ai.py`: se persiste input/output completo del agente; definir limites de tamano y redaccion de PII.
