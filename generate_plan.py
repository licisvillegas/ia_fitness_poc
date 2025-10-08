from flask import Flask, request, jsonify
from pymongo import MongoClient
from bson import ObjectId
import os
from dotenv import load_dotenv

# ==============================
#  CARGA DE CONFIGURACIÓN
# ==============================
load_dotenv()
app = Flask(__name__)

client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("MONGO_DB")]


# ==============================
#  FUNCIONES AUXILIARES
# ==============================
def validate_user_input(user):
    """
    Verifica que el JSON recibido tenga los campos mínimos requeridos.
    Retorna (True, None) si es válido o (False, mensaje_error) si falta algo.
    """
    required_fields = ["_id", "weight_kg", "goal"]
    missing = [field for field in required_fields if field not in user]

    if missing:
        return False, f"Faltan los siguientes campos requeridos: {', '.join(missing)}"
    
    # Validar tipos básicos
    if not isinstance(user["weight_kg"], (int, float)):
        return False, "El campo 'weight_kg' debe ser numérico."
    if user["goal"] not in ["gain_muscle", "lose_fat", "maintain"]:
        return False, "El campo 'goal' debe ser uno de: gain_muscle, lose_fat, maintain."
    
    return True, None


# ==============================
#  ENDPOINT PRINCIPAL
# ==============================
@app.route("/generate_plan", methods=["POST"])
def generate_plan():
    # Validar tipo de contenido
    if not request.is_json:
        return jsonify({"error": "El cuerpo de la solicitud debe ser JSON."}), 415
    
    user = request.get_json()

    # Validar datos del usuario
    is_valid, error_msg = validate_user_input(user)
    if not is_valid:
        return jsonify({"error": error_msg}), 400

    goal = user.get("goal")
    weight = user.get("weight_kg")

    # Generar plan en base a reglas simples
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
        "user_id": user.get("_id", "usr_temp"),
        "goal": goal,
        "nutrition_plan": {"calories_per_day": calories, "macros": macros},
        "training_plan": {"days_per_week": len(routines), "routines": routines}
    }

    # Guardar en MongoDB
    result = db.plans.insert_one(plan)
    plan["_id"] = str(result.inserted_id)

    return jsonify(plan), 201


# ==============================
#  EJECUCIÓN DEL SERVIDOR
# ==============================
if __name__ == "__main__":
    app.run(debug=True)
