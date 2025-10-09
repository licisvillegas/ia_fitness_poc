# ======================================================
# AI FITNESS - BACKEND FLASK FINAL
# ======================================================

from flask import Flask, request, jsonify, render_template
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import os
import logging
from dotenv import load_dotenv
import traceback

# ======================================================
# CONFIGURACIÓN INICIAL
# ======================================================

# Cargar variables de entorno (.env)
load_dotenv()

# Configuración de Flask
app = Flask(__name__)

# Configuración de logging global
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("ai_fitness")
logger.info("🚀 Aplicación AI Fitness iniciada correctamente")

# ======================================================
# CONEXIÓN MONGODB
# ======================================================
try:
    import certifi
    client = MongoClient(os.getenv("MONGO_URI"))
    db = client[os.getenv("MONGO_DB")]
    logger.info("✅ Conexión exitosa con MongoDB Atlas")
except Exception as e:
    logger.error(f"❌ Error al conectar a MongoDB: {str(e)}", exc_info=True)
    db = None


# ======================================================
# FUNCIONES AUXILIARES
# ======================================================
def validate_user_input(user):
    """Valida los campos obligatorios antes de generar el plan"""
    required_fields = ["_id", "weight_kg", "goal"]
    missing = [f for f in required_fields if f not in user]

    if missing:
        return False, f"Faltan los campos requeridos: {', '.join(missing)}"
    if not isinstance(user["weight_kg"], (int, float)):
        return False, "El campo 'weight_kg' debe ser numérico."
    if user["goal"] not in ["gain_muscle", "lose_fat", "maintain"]:
        return False, "El campo 'goal' debe ser uno de: gain_muscle, lose_fat, maintain."
    return True, None


# ======================================================
# ENDPOINTS DE PÁGINAS
# ======================================================

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/plan")
def plan_page():
    return render_template("plan.html")

@app.route("/dashboard")
def dashboard_page():
    # Redirige al dashboard directamente
    return render_template("dashboard.html")

@app.route("/nutrition")
def nutrition_page():
    return render_template("nutrition.html")


# ======================================================
# ENDPOINTS DE DATOS
# ======================================================

# 🔹 Obtener último plan del usuario
@app.route("/get_user_plan/<user_id>", methods=["GET"])
def get_user_plan(user_id):
    try:
        plan = db.plans.find_one({"user_id": user_id}, sort=[("created_at", -1)])
        if not plan:
            return jsonify({"error": "No se encontró un plan para este usuario"}), 404
        plan["_id"] = str(plan["_id"])
        return jsonify(plan), 200
    except Exception as e:
        logger.error(f"❌ Error al obtener plan de {user_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno al obtener el plan"}), 500


# 🔹 Obtener registros de progreso
@app.route("/get_progress/<user_id>", methods=["GET"])
def get_progress(user_id):
    try:
        records = list(db.progress.find({"user_id": user_id}).sort("date", 1))
        for r in records:
            r["_id"] = str(r["_id"])
        if not records:
            return jsonify({"error": "No hay registros de progreso para este usuario"}), 404
        return jsonify(records), 200
    except Exception as e:
        logger.error(f"❌ Error al obtener progreso de {user_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno al obtener progreso"}), 500


# 🔹 Generar plan de entrenamiento y nutrición
@app.route("/generate_plan", methods=["POST"])
def generate_plan():
    try:
        if not request.is_json:
            logger.warning("Solicitud sin formato JSON")
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415

        user = request.get_json()
        valid, message = validate_user_input(user)
        if not valid:
            return jsonify({"error": message}), 400

        weight = float(user["weight_kg"])
        goal = user["goal"]

        # === Lógica base IA Fitness === #
        if goal == "gain_muscle":
            calories = weight * 36
            macros = {"protein": 2.2 * weight, "carbs": 5 * weight, "fat": 0.9 * weight}
            routines = ["Pecho y Tríceps", "Espalda y Bíceps", "Piernas", "Hombros", "Core"]
        elif goal == "lose_fat":
            calories = weight * 28
            macros = {"protein": 2 * weight, "carbs": 2.5 * weight, "fat": 0.8 * weight}
            routines = ["Full Body", "Cardio", "Core"]
        else:
            calories = weight * 32
            macros = {"protein": 2 * weight, "carbs": 3.5 * weight, "fat": 0.85 * weight}
            routines = ["Upper Body", "Lower Body", "Core"]

        plan = {
            "user_id": user["_id"],
            "goal": goal,
            "nutrition_plan": {
                "calories_per_day": calories,
                "macros": macros
            },
            "training_plan": {
                "days_per_week": len(routines),
                "routines": routines
            },
            "created_at": datetime.utcnow()
        }

        result = db.plans.insert_one(plan)
        plan["_id"] = str(result.inserted_id)

        logger.info(f"🎯 Plan generado correctamente para {user['_id']}")
        return jsonify(plan), 201

    except Exception as e:
        logger.error(f"❌ Error al generar plan: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno al generar plan"}), 500


# ======================================================
# MANEJADORES DE ERRORES GLOBALES
# ======================================================

@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": "Bad Request", "message": str(e)}), 400

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not Found", "message": "La ruta solicitada no existe."}), 404

@app.errorhandler(500)
def server_error(e):
    logger.error("Error 500: %s", traceback.format_exc())
    return jsonify({"error": "Internal Server Error", "message": "Ocurrió un error inesperado."}), 500


# ======================================================
# INDEXACIÓN AUTOMÁTICA (MongoDB)
# ======================================================
try:
    db.plans.create_index([("user_id", 1), ("created_at", -1)])
    logger.info("✅ Índice creado en MongoDB: user_id + created_at")
except Exception as e:
    logger.warning(f"⚠️ No se pudo crear el índice: {e}")


# ======================================================
# EJECUCIÓN LOCAL
# ======================================================
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)

