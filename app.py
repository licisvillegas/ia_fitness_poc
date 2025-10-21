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
import re
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import errors as mongo_errors

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
#try:
#    import certifi
#    client = MongoClient(os.getenv("MONGO_URI"))
#    db = client[os.getenv("MONGO_DB")]
#    logger.info("✅ Conexión exitosa con MongoDB Atlas")
#except Exception as e:
#    logger.error(f"❌ Error al conectar a MongoDB: {str(e)}", exc_info=True)
#    db = None


# === Conexión MongoDB Atlas (versión final compatible PyMongo 4.7+) === #
try:
    import certifi
    from pymongo import MongoClient

    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        raise ValueError("❌ No se encontró la variable MONGO_URI en el entorno")

    # Configurar conexión segura con certificados válidos
    client = MongoClient(
        mongo_uri,
        tls=True,
        tlsCAFile=certifi.where(),  # Certificados raíz actualizados
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=20000,
        socketTimeoutMS=20000
    )

    db = client[os.getenv("MONGO_DB")]
    logger.info("✅ Conexión segura con MongoDB Atlas establecida correctamente")

except Exception as e:
    logger.error(f"❌ Error al conectar a MongoDB Atlas: {str(e)}", exc_info=True)
    db = None


# ======================================================
# FUNCIONES AUXILIARES
# ======================================================
def validate_user_input(user):
    """Valida los campos obligatorios antes de generar el plan"""
    required_fields = ["user_id", "weight_kg", "goal"]
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
    return render_template("auth.html")

@app.route("/profile")
def profile_page():
    return render_template("profile.html")

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

@app.route("/about")
def about_page():
    return render_template("about.html")


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
            "user_id": user["user_id"],
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
        plan["plan_id"] = str(result.inserted_id)

        logger.info(f"🎯 Plan generado correctamente para {user['_id']}")
        return jsonify(plan), 201

    except Exception as e:
        logger.error(f"❌ Error al generar plan: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno al generar plan"}), 500



# ======================================================
# AUTENTICACION: REGISTRO E INICIO DE SESION
# ======================================================

@app.post("/auth/register")
def auth_register():
    try:
        if not request.is_json:
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415

        data = request.get_json() or {}
        name = (data.get("name") or "").strip()
        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not name or not username or not email or not password:
            return jsonify({"error": "Nombre, usuario, email y contraseña son obligatorios."}), 400
        if not re.fullmatch(r"[A-Za-z0-9_.-]{3,20}", username):
            return jsonify({"error": "El usuario debe tener de 3 a 20 caracteres alfanuméricos (._- permitidos)."}), 400
        if "@" not in email:
            return jsonify({"error": "El email no es válido."}), 400
        if len(password) < 8:
            return jsonify({"error": "La contraseña debe tener al menos 8 caracteres."}), 400

        username_lower = username.lower()
        if db.users.find_one({"username_lower": username_lower}):
            return jsonify({"error": "El usuario ya está en uso."}), 409

        pwd_hash = generate_password_hash(password, method="pbkdf2:sha256", salt_length=16)
        doc = {
            "name": name,
            "username": username,
            "username_lower": username_lower,
            "email": email,
            "password_hash": pwd_hash,
            "created_at": datetime.utcnow(),
        }
        res = db.users.insert_one(doc)
        try:
            db.users.update_one({"_id": res.inserted_id}, {"$set": {"user_id": str(res.inserted_id)}})
        except Exception:
            pass
        user = {"user_id": str(res.inserted_id), "name": name, "username": username, "email": email}
        logger.info(f"Usuario registrado: {email} ({username})")
        return jsonify({"message": "Registro exitoso", "user": user}), 201

    except mongo_errors.DuplicateKeyError as e:
        message = "El email ya está registrado."
        try:
            key_pattern = e.details.get("keyPattern") if e.details else {}
            if key_pattern and "username_lower" in key_pattern:
                message = "El usuario ya está en uso."
        except Exception:
            pass
        return jsonify({"error": message}), 409
    except Exception as e:
        logger.error(f"Error en registro: {e}", exc_info=True)
        return jsonify({"error": "Error interno en registro"}), 500


@app.post("/auth/login")
def auth_login_api():
    try:
        if not request.is_json:
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415
        data = request.get_json() or {}
        identifier = (data.get("identifier") or data.get("email") or data.get("username") or "").strip()
        password = data.get("password") or ""
        if not identifier or not password:
            return jsonify({"error": "Email o usuario y contraseña son obligatorios."}), 400

        identifier_lower = identifier.lower()
        lookup_field = "email" if "@" in identifier else "username_lower"
        u = db.users.find_one({lookup_field: identifier_lower})
        if not u or not check_password_hash(u.get("password_hash", ""), password):
            return jsonify({"error": "Credenciales inválidas."}), 401

        user = {
            "user_id": str(u.get("user_id") or u["_id"]),
            "name": u.get("name"),
            "username": u.get("username"),
            "email": u.get("email"),
        }
        logger.info(f"Usuario accedió: {u.get('email')} ({u.get('username')})")
        return jsonify({"message": "Inicio de sesión exitoso", "user": user}), 200

    except Exception as e:
        logger.error(f"Error en login: {e}", exc_info=True)
        return jsonify({"error": "Error interno en inicio de sesión"}), 500

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
    try:
        existing_indexes = db.users.index_information()
        for idx_name in ("user_id_1", "user_name_lower_1"):
            if idx_name in existing_indexes:
                db.users.drop_index(idx_name)
                logger.info(f"Índice obsoleto eliminado: {idx_name}")
    except Exception as drop_err:
        logger.warning(f"No se pudo limpiar índices obsoletos: {drop_err}")
    # Índice único por email en colección de usuarios
    try:
        db.users.create_index("email", unique=True)
    except Exception:
        pass
    try:
        db.users.create_index("username_lower", unique=True, sparse=True)
    except Exception:
        pass
    logger.info("✅ Índice creado en MongoDB: user_id + created_at")
except Exception as e:
    logger.warning(f"⚠️ No se pudo crear el índice: {e}")





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
#try:
#    db.plans.create_index([("user_id", 1), ("created_at", -1)])
#    logger.info("✅ Índice creado en MongoDB: user_id + created_at")
#except Exception as e:
#    logger.warning(f"⚠️ No se pudo crear el índice: {e}")


# ======================================================
# EJECUCIÓN LOCAL
# ======================================================
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)

