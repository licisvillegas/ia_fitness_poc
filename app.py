# ======================================================
# AI FITNESS - BACKEND FLASK FINAL (Refactorizado)
# ======================================================

from flask import Flask
import os
import traceback
from datetime import datetime, timezone

from config import Config
import extensions
from extensions import logger, init_db, create_indexes, db
from middleware.auth_middleware import check_user_profile, inject_user_role

# Blueprints
from routes.auth import auth_bp
from routes.user import user_bp
from routes.admin import admin_bp
from routes.nutrition import nutrition_bp
from routes.ai import ai_bp
from routes.workout import workout_bp

# ======================================================
# CONFIGURACIÓN INICIAL
# ======================================================
def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Inicializar base de datos
    init_db(app)

    # Registrar middleware
    app.before_request(check_user_profile)
    app.context_processor(inject_user_role)

    # Registrar blueprints
    app.register_blueprint(auth_bp, url_prefix="/auth") 
    # NOTA: auth_bp tiene rutas /auth/register, /auth/login, etc. url_prefix="/auth" duplica si las rutas ya tienen /auth?
    # Revisemos auth.py: @auth_bp.post("/register") -> /auth/register (con prefix /auth).
    # Pero las rutas eran /auth/register en app original.
    # Si pongo prefix /auth, auth.py debe tener @auth_bp.post("/register").
    # Mi auth.py tiene @auth_bp.post("/register"). Correcto.
    
    app.register_blueprint(user_bp) # Rutas raiz como /dashboard, /profile
    app.register_blueprint(admin_bp) # Rutas /admin/*
    app.register_blueprint(nutrition_bp) # Rutas mixing /ai/nutrition y /meal_plans
    app.register_blueprint(ai_bp) # Rutas /ai/*, /api/generate_routine
    app.register_blueprint(workout_bp) # Rutas /api/workout/* (asumo definidos en workout.py)

    return app

app = create_app()

# ======================================================
# MANEJADORES DE ERRORES GLOBALES
# ======================================================

from flask import jsonify

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
# UTILS DE INICIO
# ======================================================
def seed_user_statuses():
    """Backfill user_status collection for existing users as active."""
    if db is None:
        return
    try:
        cursor = db.users.find({}, {"user_id": 1})
        for u in cursor:
            uid = str(u.get("user_id") or u.get("_id") or "").strip()
            if not uid:
                continue
            db.user_status.update_one(
                {"user_id": uid},
                {
                    "$setOnInsert": {
                        "status": "active",
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
                upsert=True,
            )
    except Exception as e:
        logger.warning(f"No se pudo backfill user_status: {e}")

# ======================================================
# EJECUCIÓN LOCAL
# ======================================================
if __name__ == "__main__":
    # Solo ejecutar inicializacion DB en el proceso hijo del reloader
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        create_indexes(extensions.db)
        seed_user_statuses()
    
    use_reloader = False if os.name == "nt" else True
    # Nota: Windows socket error con reloader a veces. 
    # El usuario tuvo problemas antes con esto (WinError 10038).
    # Si sigue fallando, poner use_reloader=False.
    app.run(debug=True, host="0.0.0.0", port=5000, use_reloader=use_reloader)
