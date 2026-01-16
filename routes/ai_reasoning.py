from flask import Blueprint, request, jsonify
from datetime import datetime
import os

import extensions
from extensions import logger
from utils.helpers import fetch_user_progress_for_agent
from utils.db_helpers import log_agent_execution

from ai_agents.reasoning_agent import ReasoningAgent

ai_reasoning_bp = Blueprint("ai_reasoning", __name__)


@ai_reasoning_bp.get("/ai/reason/<user_id>")
def ai_reason_for_user(user_id: str):
    """Ejecuta el agente AI usando el progreso del usuario desde MongoDB."""
    try:
        raw_limit = request.args.get("limit")
        limit = None
        if raw_limit:
            try:
                limit = int(raw_limit)
            except ValueError:
                pass

        context = fetch_user_progress_for_agent(user_id, limit)
        progress = context.get("progress", [])
        if not progress:
            return jsonify({"error": "No hay registros de progreso para este usuario"}), 404

        # Enriquecer contexto con datos del usuario/plan activo
        if extensions.db is not None:
            user = extensions.db.users.find_one({"user_id": user_id})
            context["user"] = {"user_id": user_id}
            active_plan = extensions.db.plans.find_one({"user_id": user_id, "active": True})
            if active_plan:
                context["user"]["goal"] = active_plan.get("goal")
            elif user:
                context["user"]["goal"] = user.get("goal")

        agent = ReasoningAgent()
        log_agent_execution(
            "start",
            "ReasoningAgent",
            agent,
            context,
            {"endpoint": "/ai/reason/<user_id>", "user_id": user_id},
        )
        result = agent.run(context)
        log_agent_execution(
            "end",
            "ReasoningAgent",
            agent,
            context,
            {
                "endpoint": "/ai/reason/<user_id>",
                "user_id": user_id,
                "output_keys": list(result.keys()) if isinstance(result, dict) else None,
            },
        )

        try:
            if extensions.db is not None:
                record = {
                    "user_id": user_id,
                    "backend": agent.backend(),
                    "input": context,
                    "output": result,
                    "created_at": datetime.utcnow(),
                }
                res = extensions.db.ai_adjustments.insert_one(record)
                record["_id"] = str(res.inserted_id)
                return jsonify(
                    {"output": result, "record": record, "backend": agent.backend(), "input": context}
                ), 200
        except Exception as persist_err:
            logger.warning(f"No se pudo guardar el ajuste AI: {persist_err}")

        return jsonify({"backend": agent.backend(), "input": context, "output": result}), 200
    except Exception as e:
        logger.error(f"Error en ai_reason_for_user({user_id}): {e}", exc_info=True)
        return jsonify({"error": "Error interno al ejecutar el agente con progreso"}), 500


@ai_reasoning_bp.post("/ai/reason")
def ai_reason_generic():
    try:
        if not request.is_json:
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415
        payload = request.get_json() or {}
        agent = ReasoningAgent()
        log_agent_execution("start", "ReasoningAgent", agent, payload, {"endpoint": "/ai/reason"})
        result = agent.run(payload)
        log_agent_execution(
            "end",
            "ReasoningAgent",
            agent,
            payload,
            {"endpoint": "/ai/reason", "output_keys": list(result.keys()) if isinstance(result, dict) else None},
        )
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error en ai_reason: {e}", exc_info=True)
        return jsonify({"error": "Error interno al ejecutar el agente"}), 500


@ai_reasoning_bp.get("/ai/reason/sample")
def ai_reason_sample():
    """Ruta de prueba: usa progress.json como contexto."""
    try:
        sample_path = os.path.join(os.getcwd(), "progress.json")
        if not os.path.exists(sample_path):
            return jsonify({"error": "progress.json no encontrado"}), 404
        import json

        with open(sample_path, "r", encoding="utf-8") as f:
            progress = json.load(f)
        payload = {"progress": progress}
        agent = ReasoningAgent()
        log_agent_execution("start", "ReasoningAgent", agent, payload, {"endpoint": "/ai/reason/sample"})
        result = agent.run(payload)
        log_agent_execution("end", "ReasoningAgent", agent, payload, {"endpoint": "/ai/reason/sample"})
        return jsonify({"backend": agent.backend(), "input": payload, "output": result}), 200
    except Exception as e:
        logger.error(f"Error en ai_reason_sample: {e}", exc_info=True)
        return jsonify({"error": "Error interno al ejecutar el agente (sample)"}), 500
