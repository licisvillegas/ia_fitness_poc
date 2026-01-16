# Plan de modularizacion AI

## Alcance
- Separacion de `routes/ai.py` en modulos por feature.

## Estado actual
- Completado:
  - `routes/ai_reasoning.py`: endpoints de reasoning.
  - `routes/ai_body_assessment.py`: evaluacion corporal e historial.
  - `routes/ai_adjustments.py`: ajustes AI y conversion a plan.
  - `routes/ai_routines.py`: generador de rutina.
  - `routes/ai_diagnostics.py`: diagnosticos.
  - `routes/ai_plans.py`: generador heuristico de plan.
  - `app.py`: registro de blueprints actualizado.

## Verificacion sugerida
- `GET /ai/reason/<user_id>` y `POST /ai/reason`.
- `POST /ai/body_assessment` y `GET /ai/body_assessment/history/<user_id>`.
- `POST /api/generate_routine` y `GET /ai/routine/generator`.
- `POST /ai/adjustments/<adjustment_id>/save_plan`.
- `POST /generate_plan`.
- `GET /ai/diagnostics/agents`.
