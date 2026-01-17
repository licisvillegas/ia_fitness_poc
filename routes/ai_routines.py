from flask import Blueprint, request, jsonify, render_template
import extensions
from extensions import logger
from utils.db_helpers import log_agent_execution
from ai_agents.routine_agent import RoutineAgent
from datetime import datetime



ai_routines_bp = Blueprint("ai_routines", __name__)


@ai_routines_bp.post("/api/generate_routine")
def api_generate_routine():
    try:
        data = request.get_json() or {}
        level = data.get("level", "Intermedio")
        goal = data.get("goal", "Hipertrofia")
        frequency = data.get("frequency", "4 d\u00edas")
        equipment = data.get("equipment", "Gimnasio completo")

        agent = RoutineAgent()
        log_agent_execution("start", "RoutineAgent", agent, data, {"endpoint": "/api/generate_routine"})
        result = agent.run(level, goal, frequency, equipment)
        log_agent_execution("end", "RoutineAgent", agent, data, {"endpoint": "/api/generate_routine"})
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error generando rutina: {e}", exc_info=True)
        return jsonify({"error": "Error interno generando rutina"}), 500


@ai_routines_bp.get("/ai/routine/generator")
def ai_routine_generator_page():
    return render_template("routine_generator.html")


@ai_routines_bp.post("/api/save_demo_routine")
def api_save_demo_routine():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No hay datos para guardar"}), 400

        if extensions.db is None:
            return jsonify({"error": "Base de datos no disponible"}), 503

        # Add timestamp
        data["created_at"] = datetime.utcnow()
        
        # Insert into demo_routines collection
        result = extensions.db.demo_routines.insert_one(data)
        
        return jsonify({"message": "Demo guardada", "id": str(result.inserted_id)}), 200
    except Exception as e:
        logger.error(f"Error guardando demo rutina: {e}", exc_info=True)
        return jsonify({"error": "Error interno guardando rutina"}), 500
