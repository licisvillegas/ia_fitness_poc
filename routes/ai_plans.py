from flask import Blueprint, request, jsonify
from datetime import datetime

import extensions
from extensions import logger
from utils.helpers import validate_user_input
from utils.id_helpers import normalize_user_id

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

        user_id = normalize_user_id(user.get("user_id"))
        
        # --- Smart Data Inheritance ---
        weight = user.get("weight_kg")
        goal = user.get("goal")

        if weight is None or goal is None:
             if extensions.db is not None:
                # 1. Fetch Weight from latest assessment
                if weight is None:
                    latest = extensions.db.body_assessments.find_one(
                        {"user_id": user_id}, sort=[("created_at", -1)]
                    )
                    if latest:
                        inp = latest.get("input") or {}
                        meas = inp.get("measurements") or {}
                        weight = meas.get("weight_kg") or inp.get("weight_kg") or inp.get("weight")
                
                # 2. Fetch Goal from Plan/Onboarding
                if goal is None:
                    # Try active plan first
                    active_plan = extensions.db.plans.find_one({"user_id": user_id, "active": True})
                    if active_plan:
                        goal = active_plan.get("goal")
                    
                    # Try onboarding
                    if not goal:
                        onboarding = extensions.db.onboarding_submissions.find_one(
                             {"user_id": user_id}, sort=[("submission_date", -1)]
                        )
                        if onboarding and "data" in onboarding:
                            goal = onboarding["data"].get("fitness_goal")

        # Fallbacks if still missing
        if weight is None:
             # Default weight? Or error? Let's error if we absolutely can't find it
             # But maybe 70kg as a very weak fallback? Better to error.
             return jsonify({"error": "Peso requerido (no se encontró historial)"}), 400
        
        if goal is None:
             goal = "gain_muscle" # Default fallback
        
        try:
            weight = float(weight)
        except:
             return jsonify({"error": "Peso invalido"}), 400

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
            "user_id": user_id,
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
            extensions.db.plans.update_many({"user_id": user_id}, {"$set": {"active": False}})
        except Exception:
            pass

        result = extensions.db.plans.insert_one(plan_doc)
        plan_doc["_id"] = str(result.inserted_id)
        plan_doc["plan_id"] = plan_doc["_id"]

        logger.info(f"Plan generado correctamente para {user_id}")
        return jsonify(plan_doc), 201

    except Exception as e:
        logger.error(f"Error al generar plan: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno al generar plan"}), 500
