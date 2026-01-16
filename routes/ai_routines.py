from flask import Blueprint, request, jsonify, render_template

from extensions import logger
from utils.db_helpers import log_agent_execution
from ai_agents.routine_agent import RoutineAgent

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
