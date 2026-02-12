from flask import Blueprint, request, jsonify, render_template
from bson import ObjectId
import extensions
from extensions import logger
from utils.db_helpers import log_agent_execution
from utils.helpers import normalize_string_list, normalize_equipment_list, normalize_bool, normalize_body_part
from ai_agents.routine_agent import RoutineAgent
from ai_agents.routine_agent_mongo import MongoRoutineAgent
from datetime import datetime
import re



from services.routine_service import RoutineService

ai_routines_bp = Blueprint("ai_routines", __name__)
routine_service = RoutineService()


@ai_routines_bp.post("/api/generate_routine")
def api_generate_routine():
    """Generar rutina (síncrono)
    ---
    tags:
      - Routines
    security:
      - cookieAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [goal, level, days_per_week]
            properties:
              goal: {type: string}
              level: {type: string}
              days_per_week: {type: integer}
              equipment: {type: array, items: {type: string}}
    responses:
      200:
        description: Rutina generada
      500:
        description: Error interno
    """
    try:
        data = request.get_json() or {}
        result = routine_service.generate_routine_sync(data)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error generando rutina: {e}", exc_info=True)
        return jsonify({"error": "Error interno generando rutina"}), 500


@ai_routines_bp.get("/ai/routine/generator")
def ai_routine_generator_page():
    return render_template("routine_generator.html")


@ai_routines_bp.get("/ai/routine/generator_mongo")
def ai_routine_generator_mongo_page():
    return render_template("routine_generator_mongo.html")


@ai_routines_bp.post("/api/generate_routine_mongo")
def api_generate_routine_mongo():
    try:
        data = request.get_json() or {}
        
        if extensions.db is None:
            return jsonify({"error": "Base de datos no disponible"}), 503

        result = routine_service.generate_routine_mongo_sync(data)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error generando rutina mongo: {e}", exc_info=True)
        return jsonify({"error": "Error interno generando rutina"}), 500


@ai_routines_bp.post("/api/generate_routine_async")
def api_generate_routine_async():
    """Generar rutina (asíncrono/fallback)
    ---
    tags:
      - Routines
    security:
      - cookieAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [goal, level]
            properties:
              goal: {type: string}
              level: {type: string}
              frequency: {type: integer}
              equipment: {type: string}
              body_parts: {type: array, items: {type: string}}
              include_cardio: {type: boolean}
    responses:
      200:
        description: Rutina generada (fallback síncrono)
      202:
        description: Tarea iniciada (retorna task_id)
        content:
          application/json:
            schema:
              type: object
              properties:
                task_id: {type: string}
                status: {type: string}
                poll_url: {type: string}
      500:
        description: Error interno
    """
    try:
        data = request.get_json() or {}
        result = routine_service.start_async_generation(data)
        
        # Fallback síncrono: Celery no disponible
        if isinstance(result, dict) and result.get("sync"):
            return jsonify(result["result"]), 200

        # Celery disponible: devolver task_id para polling
        return jsonify({
            "task_id": result,
            "status": "processing",
            "poll_url": f"/api/tasks/{result}"
        }), 202

    except Exception as e:
        logger.error(f"Error iniciando tarea asincrona: {e}", exc_info=True)
        return jsonify({"error": "Error interno iniciando tarea"}), 500


@ai_routines_bp.get("/api/tasks/<task_id>")
def api_get_task_status(task_id):
    """Consultar estado de tarea asíncrona
    ---
    tags:
      - Routines
    parameters:
      - name: task_id
        in: path
        required: true
        schema: {type: string}
    responses:
      200:
        description: Estado de la tarea y resultado si terminó
        content:
          application/json:
            schema:
              type: object
              properties:
                task_id: {type: string}
                state: {type: string, enum: [PENDING, STARTED, SUCCESS, FAILURE]}
                result: {type: object}
      503:
        description: Celery no disponible
    """
    try:
        from celery_app.tasks.ai_tasks import generate_routine_async
    except (ImportError, ModuleNotFoundError):
        return jsonify({"error": "Celery no disponible en este entorno"}), 503

    try:
        task = generate_routine_async.AsyncResult(task_id)
        
        response = {
            "task_id": task_id,
            "state": task.state,
        }
        
        if task.state == 'SUCCESS':
            response['result'] = task.result
        elif task.state == 'FAILURE':
            response['error'] = str(task.info)
        elif task.state == 'PENDING':
            response['state'] = 'PENDING'
        
        return jsonify(response), 200
    except Exception as e:
        logger.error(f"Error consultando tarea {task_id}: {e}", exc_info=True)
        return jsonify({"error": "Error consultando tarea"}), 500


@ai_routines_bp.post("/api/save_demo_routine")
def api_save_demo_routine():
    try:
        data = request.get_json()
        routine_id, error, status = routine_service.save_routine(data, collection="demo_routines")
        
        if error:
            return jsonify({"error": error}), status
            
        return jsonify({"message": "Demo guardada", "id": routine_id}), 200
    except Exception as e:
        logger.error(f"Error guardando demo rutina: {e}", exc_info=True)
        return jsonify({"error": "Error interno guardando rutina"}), 500


@ai_routines_bp.post("/api/save_routine_mongo")
def api_save_routine_mongo():
    """Guardar rutina generada
    ---
    tags:
      - Routines
    security:
      - cookieAuth: []
    requestBody:
      content:
        application/json:
          schema:
            type: object
            required: [name, items]
            properties:
              name: {type: string}
              description: {type: string}
              items: {type: array, items: {type: object}}
    responses:
      200:
        description: Rutina guardada
        content:
          application/json:
            schema:
              type: object
              properties:
                message: {type: string}
                id: {type: string}
      500:
        description: Error interno
    """
    try:
        data = request.get_json()
        routine_id, error, status = routine_service.save_routine(data, collection="ai_routines")
        
        if error:
            return jsonify({"error": error}), status
            
        return jsonify({"message": "Rutina guardada", "id": routine_id}), 200
    except Exception as e:
        logger.error(f"Error guardando rutina mongo: {e}", exc_info=True)
        return jsonify({"error": "Error interno guardando rutina"}), 500

@ai_routines_bp.post("/api/check_exercises")
def api_check_exercises():
    """Verificar existencia de ejercicios
    ---
    tags:
      - Routines
    security:
      - cookieAuth: []
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              names:
                type: array
                items: {type: string}
    responses:
      200:
        description: Lista de ejercicios encontrados
      503:
        description: DB no disponible
    """
    try:
        data = request.get_json() or {}
        exercise_names = data.get("names", [])
        
        if extensions.db is None:
            return jsonify({"error": "Base de datos no disponible"}), 503

        results = routine_service.check_exercises(exercise_names)
        return jsonify({"exercises": results}), 200
    except Exception as e:
        logger.error(f"Error checking exercises: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500


@ai_routines_bp.post("/api/add_exercises")
def api_add_exercises():
    """Agregar ejercicios al catálogo (Admin)
    ---
    tags:
      - Routines
    security:
      - adminAuth: []
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              exercises:
                type: array
                items:
                  type: object
                  properties:
                    name: {type: string}
                    muscle_group: {type: string}
    responses:
      200:
        description: Ejercicios agregados
      403:
        description: No autorizado
    """
    # Only admins can add exercises to global catalog
    from utils.auth_helpers import check_admin_access
    ok, err = check_admin_access()
    if not ok: return err

    try:
        data = request.get_json() or {}
        exercises_to_add = data.get("exercises", [])
        
        if extensions.db is None:
            return jsonify({"error": "Base de datos no disponible"}), 503

        added_count = routine_service.add_exercises_batch(exercises_to_add)
        return jsonify({"message": f"Se agregaron {added_count} ejercicios"}), 200
    except Exception as e:
        logger.error(f"Error adding exercises: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500

@ai_routines_bp.get("/api/demo_routines")
def api_list_demo_routines():
    """Listar rutinas de demostración
    ---
    tags:
      - Routines
    responses:
      200:
        description: Lista de rutinas demo
    """
    try:
        if extensions.db is None:
            return jsonify({"error": "Base de datos no disponible"}), 503

        # This simple query could stay in the route or move to service.
        # Moving to service for consistency.
        routines = routine_service.list_routines(collection="demo_routines")
        return jsonify({"routines": routines}), 200
    except Exception as e:
        logger.error(f"Error listing demo routines: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500


@ai_routines_bp.get("/api/demo_routines/<id>")
def api_get_demo_routine(id):
    """Obtener detalle de rutina demo
    ---
    tags:
      - Routines
    parameters:
      - name: id
        in: path
        required: true
        schema: {type: string}
    responses:
      200:
        description: Detalle de rutina
      404:
        description: No encontrada
    """
    try:
        if extensions.db is None:
            return jsonify({"error": "Base de datos no disponible"}), 503

        if not ObjectId.is_valid(id):
            return jsonify({"error": "ID invalido"}), 400

        routine = routine_service.get_routine_by_id(id, collection="demo_routines")
        if not routine:
            return jsonify({"error": "No encontrada"}), 404
            
        return jsonify(routine), 200
    except Exception as e:
        logger.error(f"Error getting demo routine: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500
