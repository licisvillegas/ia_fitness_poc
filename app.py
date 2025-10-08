from flask import Flask, jsonify, render_template
from pymongo import MongoClient
from bson import ObjectId
import os
from dotenv import load_dotenv

# ======================================================
# CONFIGURACIÓN
# ======================================================
load_dotenv()
app = Flask(__name__)
client = MongoClient(os.getenv("MONGO_URI"))
db = client[os.getenv("MONGO_DB")]

# ======================================================
# ENDPOINTS NUEVOS (Fase 3)
# ======================================================

# 🔹 1. Endpoint: obtener plan del usuario
@app.route("/get_user_plan/<user_id>", methods=["GET"])
def get_user_plan(user_id):
    plan = db.plans.find_one({"user_id": user_id}, sort=[("_id", -1)])
    if not plan:
        return jsonify({"error": "No se encontró un plan para este usuario"}), 404
    plan["_id"] = str(plan["_id"])
    return jsonify(plan)

# 🔹 2. Endpoint: obtener progreso del usuario
@app.route("/get_progress/<user_id>", methods=["GET"])
def get_progress(user_id):
    records = list(db.progress.find({"user_id": user_id}))
    for r in records:
        r["_id"] = str(r["_id"])
    return jsonify(records)

# 🔹 3. Página principal (formulario)
@app.route("/")
def index():
    return render_template("index.html")

# 🔹 4. Página del plan generado
@app.route("/plan")
def plan_page():
    return render_template("plan.html")

# 🔹 5. Página del dashboard de progreso
@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

# 🔹 6. Página nutrición
@app.route("/nutrition")
def nutrition():
    return render_template("nutrition.html")


# ======================================================
#  ENDPOINT: GENERAR PLAN (POST desde index.html)
# ======================================================
from flask import request, jsonify
from bson import ObjectId

@app.route("/generate_plan", methods=["POST"])
def generate_plan():
    if not request.is_json:
        return jsonify({"error": "El cuerpo debe ser JSON"}), 415

    user = request.get_json()

    # Validación mínima
    required = ["_id", "weight_kg", "goal"]
    for r in required:
        if r not in user:
            return jsonify({"error": f"Falta el campo requerido: {r}"}), 400

    weight = float(user["weight_kg"])
    goal = user["goal"]

    # Generación del plan (misma lógica IA Fitness)
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
        }
    }

    # Insertar en MongoDB
    result = db.plans.insert_one(plan)
    plan["_id"] = str(result.inserted_id)

    return jsonify(plan), 201


# ======================================================
# EJECUCIÓN LOCAL
# ======================================================
if __name__ == "__main__":
    app.run(debug=True)
