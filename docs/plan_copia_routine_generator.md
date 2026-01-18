# Plan de trabajo: copia independiente de /ai/routine/generator

Objetivo: crear una copia independiente de /ai/routine/generator con un nuevo agente AI que genere rutinas usando ejercicios de MongoDB (los mismos que usa `templates/routine_builder.html`). El resultado debe mostrar tabs por dias seleccionados, rutina por dia, e incluir JSON con estructura compatible con la collection `routines` (incluyendo grupos de ejercicios y descansos).

Regla operativa: **antes de ejecutar cualquier tarea del plan, se debe pedir confirmacion**.

## Tabla de actividades
| ID | Actividad | Detalle | Entregable | Estatus |
| --- | --- | --- | --- | --- |
| 1 | Levantar contexto | Revisar `/ai/routine/generator`, `templates/routine_builder.html`, rutas y agentes actuales para entender flujo, inputs y estructura de rutina | Resumen de flujo y puntos de extension | Completado |
| 2 | Definir especificacion del nuevo agente | Inputs esperados, prompts, formato de salida por dia, validaciones, y estructura de grupos/descansos | Documento de especificacion tecnica | Completado |
| 3 | Disenar estructura de datos de salida | Mapear estructura actual de `routines` en MongoDB y asegurar compatibilidad JSON | Esquema JSON acordado | Completado |
| 4 | Crear nueva ruta independiente | Duplicar/crear endpoint y wiring de templates sin depender de la ruta original | Nueva ruta funcional en backend | Completado |
| 5 | Crear nuevo template UI | Copiar y ajustar el template del generador con tabs por dias y seccion JSON por dia | Nuevo template en `templates/` | Completado |
| 6 | Integrar nuevo agente AI | Crear/duplicar agente con logica de seleccion de ejercicios desde MongoDB y generacion por dias | Agente AI conectado a la ruta nueva | Completado |
| 7 | Persistencia de rutinas | Guardar el JSON en la nueva collection de rutinas con estructura compatible | Insercion en MongoDB verificada | Completado |
| 8 | Validaciones y edge cases | Verificar grupos de ejercicios, descansos, dias vacios, limites de ejercicios | Checklist de validaciones | Completado |
| 9 | Pruebas basicas | Pruebas manuales y/o scripts minimos para validar UI y backend | Evidencia de pruebas | Completado |
| 10 | Documentacion | Actualizar docs con uso y consideraciones | Nota de uso en docs | Completado |

## Notas
- Cada actividad se ejecuta solo despues de tu confirmacion explicita.
- Si cambian los requisitos, se actualizara este plan.

## Resumen de contexto (Actividad 1)
- Ruta actual: `routes/ai_routines.py` expone `GET /ai/routine/generator` (template `templates/routine_generator.html`) y `POST /api/generate_routine` (usa `RoutineAgent`).
- El generador actual devuelve JSON con `routineName`, `microcyclePhase`, `sessions[]` y ejercicios simples; no coincide con la estructura de `routines` en MongoDB.
- Persistencia actual del generador: `POST /api/save_demo_routine` guarda el JSON en `demo_routines`, no en `routines`.
- Estructura real de `routines` (usada por builder y runner): documento con `name`, `description`, `routine_day`, `routine_body_parts`, `items[]`.
- Estructura de `items[]` en `templates/routine_builder.html`: `item_type` = `exercise|group|rest` con campos clave:
  - exercise: `exercise_id`, `exercise_name`, `exercise_type`, `equipment`, `body_part`, `substitutes`, `target_sets`, `target_reps`, `target_time_seconds`, `rest_seconds`, `group_id`, `comment`.
  - group: `_id`, `group_name`, `group_type`, `note`.
  - rest: `_id`, `rest_seconds`, `note`, `group_id`.
- Ejercicios base vienen de MongoDB via `GET /api/exercises` (admin) y son los mismos consumidos por `routine_builder.html`.

## Especificacion del nuevo agente (Actividad 2)
### Proposito
Generar una rutina estructurada por dias usando ejercicios disponibles en MongoDB, en formato compatible con la collection `routines`. Debe soportar grupos (biserie/superset/circuito) y descansos como items.

### Inputs esperados (desde UI/ruta nueva)
- level: string (Principiante|Intermedio|Avanzado).
- goal: string (Hipertrofia|Fuerza|Perdida de Grasa u otros).
- frequency: string o number (numero de dias seleccionados).
- equipment: string (filtro para ejercicios, opcional).
- body_parts: array opcional (filtros por grupos musculares, opcional).
- include_cardio: boolean opcional.

### Fuente de ejercicios
- Consultar MongoDB `exercises` via backend (misma fuente que `routine_builder.html`).
- Filtrar por `equipment` y/o `body_part` cuando aplique.
- Cada ejercicio debe aportar: `_id`, `name`, `type`, `equipment`, `body_part`, `video_url`, `substitutes`.

### Formato de salida del agente (JSON compatible con `routines`)
Objeto por dia:
- name: string (nombre base o con sufijo del dia).
- description: string (tags/resumen).
- routine_day: string (Lunes/Martes/etc o Day 1..N).
- routine_body_parts: array de strings (keys de body_part).
- items: array de items, usando la misma estructura del builder:
  - item_type: "group" | "exercise" | "rest".
  - group: `{ _id, group_name, group_type, note }`.
  - exercise: `{ _id, exercise_id, exercise_name, exercise_type, equipment, video_url, body_part, substitutes, target_sets, target_reps, target_time_seconds, rest_seconds, group_id, comment }`.
  - rest: `{ _id, rest_seconds, note, group_id }`.

### Reglas de generacion
- Generar exactamente N dias segun `frequency`.
- Repartir grupos musculares equilibrados segun objetivo y nivel.
- Incluir descansos como items `rest` (en grupos o sueltos) con `rest_seconds`.
- Cuando se use un grupo, crear item `group` y luego items asociados con `group_id`.
- `exercise_id` debe ser el `_id` real del ejercicio en MongoDB.
- Evitar duplicados excesivos del mismo ejercicio en un mismo dia.

### Validaciones minimas (backend)
- No permitir items con `exercise_id` inexistente.
- No permitir grupos vacios (group sin ejercicios).
- `rest_seconds` en rango razonable (ej. 30-180).
- `target_sets` >= 1 y `target_reps` con formato valido ("8-12" o numero).

### Respuesta de la ruta
- Debe devolver estructura por dias para pintar tabs y un JSON completo por dia listo para guardar en `routines`.

## Esquema JSON acordado (Actividad 3)
### Documento `routines` (por dia)
```json
{
  "_id": "ObjectId (Mongo)",
  "name": "Rutina Dia 1 - Torso",
  "description": "Hipertrofia | Intermedio | 4 dias",
  "routine_day": "Monday",
  "routine_body_parts": ["chest", "back", "shoulders", "arms"],
  "items": [
    {
      "item_type": "group",
      "_id": "group_1730000000000",
      "group_name": "Biserie 1",
      "group_type": "biserie",
      "note": ""
    },
    {
      "item_type": "exercise",
      "_id": "temp_1730000000001",
      "exercise_id": "66f0b7c2... (ObjectId string)",
      "exercise_name": "Press banca",
      "exercise_type": "weight",
      "equipment": "barbell",
      "video_url": "",
      "body_part": "chest",
      "substitutes": [],
      "target_sets": 3,
      "target_reps": "8-12",
      "target_time_seconds": 600,
      "rest_seconds": 90,
      "group_id": "group_1730000000000",
      "comment": ""
    },
    {
      "item_type": "rest",
      "_id": "rest_1730000000002",
      "rest_seconds": 60,
      "note": "Descanso",
      "group_id": "group_1730000000000"
    }
  ],
  "created_at": "Date",
  "updated_at": "Date"
}
```

### Respuesta del nuevo endpoint (para UI con tabs)
```json
{
  "routine_name": "Rutina AI (mongo)",
  "level": "Intermedio",
  "goal": "Hipertrofia",
  "days": [
    {
      "day_index": 1,
      "day_label": "Lunes",
      "routine": { "...": "Documento routines (sin _id)" }
    }
  ]
}
```

### Reglas de compatibilidad
- `items` debe seguir exactamente la estructura usada por `routine_builder.html`.
- `exercise_id` debe ser string del `_id` en MongoDB.
- `routine_body_parts` debe contener keys de `body_part` (no labels).

## Rutas nuevas (Actividad 4)
- `GET /ai/routine/generator_mongo` -> `templates/routine_generator_mongo.html`.
- `POST /api/generate_routine_mongo` -> placeholder 501 hasta integrar nuevo agente.

## Template nuevo (Actividad 5)
- `templates/routine_generator_mongo.html` crea tabs por dia, tabla de items y modal de JSON por dia.

## Agente integrado (Actividad 6)
- Nuevo agente en `ai_agents/routine_agent_mongo.py` genera rutinas compatibles con `routines`.
- Ruta `POST /api/generate_routine_mongo` conectada al agente.

## Persistencia (Actividad 7)
- Nuevo endpoint `POST /api/save_routine_mongo` guarda la rutina en la collection `ai_routines`.
- UI agrega boton para guardar la rutina del dia activo.

## Validaciones y edge cases (Actividad 8)
- `frequency` debe estar entre 1 y 6.
- `body_parts` debe ser lista si se envia.
- `items` debe ser lista y contener ejercicios.
- `item_type` valido, grupos no vacios, `rest_seconds` en rango.
- `exercise_id` debe existir en MongoDB.

## Pruebas basicas (Actividad 9)
Checklist manual sugerido (pendiente de ejecucion en entorno local):
1. Abrir `GET /ai/routine/generator_mongo` y generar rutina con valores por defecto.
2. Verificar tabs por dias y tabla de items renderiza grupos/descansos.
3. Abrir modal JSON del dia activo y revisar estructura compatible con `routines`.
4. Guardar rutina y confirmar respuesta 200 en `POST /api/save_routine_mongo`.
5. Reintentar guardar con rutina sin items y verificar error 400.

## Nota de uso (Actividad 10)
- UI: `GET /ai/routine/generator_mongo`.
- Generacion: `POST /api/generate_routine_mongo` (usa ejercicios en MongoDB).
- Guardado: `POST /api/save_routine_mongo` (guarda en `ai_routines`).
