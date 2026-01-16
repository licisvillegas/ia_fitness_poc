# Plan de rendimiento - ejecucion

## Alcance
- Cache TTL de `body_parts` en filtro de ejercicios.
- Paginacion/proyeccion en listados de ejercicios.
- Filtros y limites en `get_progress`.
- Cache TTL en `inject_user_role`.
- Limites de tamano/cantidad de imagenes en `ai_body_assessment`.
- Cache compartido opcional via Redis (fallback in-memory).

## Estado actual
- Completado:
  - `routes/workout.py`: cache `body_parts`, `limit/page` en listados y `limit` en filtro.
  - `routes/user.py`: `limit/days/start/end` en `get_progress`.
  - `middleware/auth_middleware.py`: cache 60s en `inject_user_role` (Redis opcional).
  - `routes/ai.py`: limites de fotos (6), max 5MB por foto y 20MB total.
  - `utils/cache.py`: cache compartido con Redis (si `REDIS_URL` esta configurado).

## Verificacion sugerida
- `GET /workout/api/exercises?limit=50&page=1`.
- `GET /workout/api/exercises/filter?muscles=Pecho&limit=50`.
- `GET /get_progress/<user_id>?days=180&limit=200`.
- Navegacion entre paginas para validar sidebar/rol.
- Subida de evaluacion corporal con limites.

## Siguientes pasos (no ejecutados)
- Unificar duplicado de `GET /workout/api/exercises` en un solo handler.
- Considerar Redis o cache compartido si hay multiples workers.
