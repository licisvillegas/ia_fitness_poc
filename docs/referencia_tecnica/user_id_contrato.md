# Contrato de user_id

## Definicion
- `user_id` se maneja como string en toda la aplicacion (string del ObjectId original).
- El campo `_id` de MongoDB sigue siendo `ObjectId` y no se usa como `user_id` en la app.

## Normalizacion
- Entrada: cualquier `user_id` recibido por path, query o JSON se normaliza a string.
- Compatibilidad: cuando existan datos legacy con `user_id` guardado como `ObjectId`, se busca con `user_id` (string) y opcionalmente con `ObjectId` si el string es valido.

## Helpers
- `utils/id_helpers.py`:
  - `normalize_user_id(value) -> str|None`
  - `maybe_object_id(value) -> ObjectId|None`

## Rutas actualizadas
- `routes/ai_reasoning.py`
- `routes/ai_adjustments.py`
- `routes/ai_body_assessment.py`
- `routes/ai_plans.py`
- `routes/nutrition.py`

## Recomendaciones
- En nuevas rutas, usar `normalize_user_id` al inicio.
- Si se consulta por `user_id` en colecciones con datos legacy, usar `maybe_object_id` para `search_ids`.
