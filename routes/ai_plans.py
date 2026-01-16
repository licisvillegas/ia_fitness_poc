from flask import Blueprint, request, jsonify
from datetime import datetime

import extensions
from extensions import logger
from utils.helpers import validate_user_input

ai_plans_bp = Blueprint("ai_plans", __name__)


@ai_plans_bp.post("/generate_plan")
def generate_plan():
    """Generador heuristico base (no AI full)."""
    try:
        if not request.is_json:
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415

        user = request.get_json()
        valid, message = validate_user_input(user)
        if not valid:
            return jsonify({"error": message}), 400

        weight = float(user["weight_kg"])
        goal = user["goal"]
        now = datetime.utcnow()

        if goal == "gain_muscle":
            calories = weight * 36
            macros = {"protein": 2.2 * weight, "carbs": 5 * weight, "fat": 0.9 * weight}
            routines = ["Pecho y Tr\u00edceps", "Espalda y B\u00edceps", "Piernas", "Hombros", "Core"]
        elif goal == "lose_fat":
            calories = weight * 28
            macros = {"protein": 2 * weight, "carbs": 2.5 * weight, "fat": 0.8 * weight}
            routines = ["Full Body", "Cardio", "Core"]
        else:
            calories = weight * 32
            macros = {"protein": 2 * weight, "carbs": 3.5 * weight, "fat": 0.85 * weight}
            routines = ["Upper Body", "Lower Body", "Core"]

        plan_doc = {
            "user_id": user["user_id"],
            "goal": goal,
            "source": "base_generator",
            "nutrition_plan": {
                "calories_per_day": calories,
                "kcal_delta": 0,
                "macros": macros,
            },
            "training_plan": {
                "days_per_week": len(routines),
                "routines": routines,
                "cardio": "",
                "ai_volumen_delta_ratio": None,
            },
            "active": True,
            "created_at": now,
            "activated_at": now,
        }

        try:
            extensions.db.plans.update_many({"user_id": user["user_id"]}, {"$set": {"active": False}})
        except Exception:
            pass

        result = extensions.db.plans.insert_one(plan_doc)
        plan_doc["_id"] = str(result.inserted_id)
        plan_doc["plan_id"] = plan_doc["_id"]

        logger.info(f"Plan generado correctamente para {user['user_id']}")
        return jsonify(plan_doc), 201

    except Exception as e:
        logger.error(f"Error al generar plan: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno al generar plan"}), 500
