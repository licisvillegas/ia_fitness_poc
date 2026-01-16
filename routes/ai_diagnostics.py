from flask import Blueprint, jsonify

from extensions import logger
from utils.db_helpers import log_agent_execution
from ai_agents.reasoning_agent import ReasoningAgent
from ai_agents.reasoning_agent import ReasoningAgent as LegacyReasoningAgent
from ai_agents.body_assessment_agent import BodyAssessmentAgent
from ai_agents.meal_plan_agent import MealPlanAgent

ai_diagnostics_bp = Blueprint("ai_diagnostics", __name__)


@ai_diagnostics_bp.get("/ai/diagnostics/agents")
def ai_agents_diagnostics():
    """Run a lightweight diagnostic for agent backends and outputs."""
    try:
        reasoning_payload = {"progress": [{"body_fat": 22.0, "performance": 70, "nutrition_adherence": 85}]}
        body_payload = {
            "sex": "male",
            "age": 30,
            "goal": "definicion",
            "measurements": {"weight_kg": 78, "height_cm": 178},
        }
        meal_payload = {"total_kcal": 2200, "meals": 4, "macros": {"protein": 160, "carbs": 250, "fat": 70}}

        agents = [
            ("ReasoningAgent", ReasoningAgent(), reasoning_payload),
            ("ReasoningAgentLegacy", LegacyReasoningAgent(), reasoning_payload),
            ("BodyAssessmentAgent", BodyAssessmentAgent(), body_payload),
            ("MealPlanAgent", MealPlanAgent(), meal_payload),
        ]

        results = []
        for name, agent, payload in agents:
            log_agent_execution("start", name, agent, payload, {"endpoint": "/ai/diagnostics/agents"})
            output = agent.run(payload)
            log_agent_execution("end", name, agent, payload, {"endpoint": "/ai/diagnostics/agents"})
            results.append({"agent": name, "backend": agent.backend(), "input": payload, "output": output})

        return jsonify({"results": results}), 200
    except Exception as e:
        logger.error(f"Error en ai_agents_diagnostics: {e}", exc_info=True)
        return jsonify({"error": "Error interno en diagnostico de agentes"}), 500
