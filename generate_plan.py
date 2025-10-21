from flask import Flask, request, jsonify
from pymongo import MongoClient
from bson import ObjectId
import os
from dotenv import load_dotenv
from datetime import datetime
import logging

# ==============================
#  CARGA DE CONFIGURACIÓN
# ==============================
load_dotenv()
app = Flask(__name__)

# === LOGGING === #
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("ai_fitness")

# === CONEXIÓN MONGODB === #
try:
    client = MongoClient(os.getenv("MONGO_URI"))
    db = client[os.getenv("MONGO_DB")]
    logger.info("✅ Conexión exitosa con MongoDB Atlas")
except Exception as e:
    logger.error(f"❌ Error al conectar con MongoDB: {str(e)}", exc_info=True)


# ==============================
#  FUNCIONES AUXILIARES
# ==============================
def validate_user_input(user):
    required_fields = ["user_id", "weight_kg", "goal"]
    missing = [field for field in required_fields if field not in user]

    if missing:
        return False, f"Faltan los siguientes campos requeridos: {', '.join(missing)}"
    if not isinstance(user["weight_kg"], (int, float)):
        return False, "El campo 'weight_kg' debe ser numérico."
    if user["goal"] not in ["gain_muscle", "lose_fat", "maintain"]:
        return False, "El campo 'goal' debe ser uno de: gain_muscle, lose_fat, maintain."
    return True, None


# ==============================
#  ENDPOINT: GENERAR PLAN
# ==============================
@app.route("/generate_plan", methods=["POST"])
def generate_plan():
    try:
        if not request.is_json:
            logger.warning("Solicitud sin formato JSON")
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415

        user = request.get_json()
        logger.info(f"Solicitud recibida para generar plan de usuario: {user.get('_id', 'N/A')}")

        # Validación de datos
        valid, msg = validate_user_input(user)
        if not valid:
            logger.warning(f"Entrada inválida: {msg}")
            return jsonify({"error": msg}), 400

        goal = user["goal"]
        weight = float(user["weight_kg"])

        # === Generación del plan === #
        if goal == "gain_muscle":
            calories = weight * 36
            macros = {"protein": 2.2 * weight, "carbs": 5 * weight, "fat": 0.9 * weight}
            routines = ["Chest & Triceps", "Back & Biceps", "Legs", "Shoulders", "Core"]
        elif goal == "lose_fat":
            calories = weight * 28
            macros = {"protein": 2 * weight, "carbs": 2.5 * weight, "fat": 0.8 * weight}
            routines = ["Full Body", "Cardio", "Core"]
        else:
            calories = weight * 32
            macros = {"protein": 2 * weight, "carbs": 3.5 * weight, "fat": 0.85 * weight}
            routines = ["Upper Body", "Lower Body", "Core"]

        plan = {
            "user_id": user["user_id"],
            "goal": goal,
            "nutrition_plan": {"calories_per_day": calories, "macros": macros},
            "training_plan": {"days_per_week": len(routines), "routines": routines},
            "created_at": datetime.utcnow(),
        }

        result = db.plans.insert_one(plan)
        logger.info(f"✅ Plan insertado correctamente con timestamp {plan['created_at']}")

        plan["plan_id"] = str(result.inserted_id)
        return jsonify(plan), 201

    except Exception as e:
        logger.error(f"❌ Error al generar plan: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno al generar plan"}), 500

# ==============================
#  EJECUCIÓN DEL SERVIDOR
# ==============================
if __name__ == "__main__":
    app.run(debug=True)
