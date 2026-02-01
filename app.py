# ======================================================
# Synapse Fit - BACKEND FLASK FINAL (Refactorizado)
# ======================================================

from flask import Flask, render_template
import os
import traceback
import sys
from datetime import datetime, timezone

# FORZAR PYTHON SIN BUFFER
sys.stdout.reconfigure(encoding='utf-8')
print("--- [DEBUG] INICIANDO APP.PY ---", file=sys.stdout, flush=True)

from config import Config
import extensions
from extensions import logger, init_db, create_indexes, db
from middleware.auth_middleware import check_user_profile, inject_user_role, check_workout_lock, check_onboarding_status

# Blueprints
from routes.auth import auth_bp
from routes.user import user_bp
from routes.admin import admin_bp
from routes.nutrition import nutrition_bp
from routes.ai_reasoning import ai_reasoning_bp
from routes.ai_body_assessment import ai_body_assessment_bp
from routes.ai_adjustments import ai_adjustments_bp
from routes.ai_routines import ai_routines_bp
from routes.ai_diagnostics import ai_diagnostics_bp
from routes.ai_plans import ai_plans_bp
from routes.workout import workout_bp
from routes.push import push_bp

from routes.onboarding import onboarding_bp
from routes.notifications import notifications_bp

# ======================================================
# CONFIGURACIÓN INICIAL
# ======================================================
def create_app():
    print("--- [DEBUG] Entrando a create_app ---", file=sys.stdout, flush=True)
    app = Flask(__name__)
    app.config.from_object(Config)

    # Inicializar base de datos
    print("--- [DEBUG] Inicializando BD ---", file=sys.stdout, flush=True)
    init_db(app)

    # Registrar middleware
    print("--- [DEBUG] Registrando Middleware ---", file=sys.stdout, flush=True)
    
    # 0. Global Account Lock (Highest Priority Security Check)
    from middleware.lock_middleware import check_account_lock
    app.before_request(check_account_lock)

    app.before_request(check_user_profile)    # Priority 1: Profile Completeness
    app.before_request(check_onboarding_status) # Priority 2: Onboarding Flow
    app.before_request(check_workout_lock)
    app.context_processor(inject_user_role)

    # Registrar blueprints
    print("--- [DEBUG] Registrando Blueprints ---", file=sys.stdout, flush=True)
    app.register_blueprint(auth_bp, url_prefix="/auth") 
    # NOTA: auth_bp tiene rutas /auth/register, /auth/login, etc. url_prefix="/auth" duplica si las rutas ya tienen /auth?
    # Revisemos auth.py: @auth_bp.post("/register") -> /auth/register (con prefix /auth).
    # Pero las rutas eran /auth/register en app original.
    # Si pongo prefix /auth, auth.py debe tener @auth_bp.post("/register").
    # Mi auth.py tiene @auth_bp.post("/register"). Correcto.
    
    app.register_blueprint(user_bp) # Rutas raiz como /dashboard, /profile
    app.register_blueprint(admin_bp) # Rutas /admin/*
    app.register_blueprint(nutrition_bp) # Rutas mixing /ai/nutrition y /meal_plans
    app.register_blueprint(ai_reasoning_bp)
    app.register_blueprint(ai_body_assessment_bp)
    app.register_blueprint(ai_adjustments_bp)
    app.register_blueprint(ai_routines_bp)
    app.register_blueprint(ai_diagnostics_bp)
    app.register_blueprint(ai_plans_bp)
    app.register_blueprint(workout_bp) # Rutas /api/workout/* (asumo definidos en workout.py)
    app.register_blueprint(push_bp)

    app.register_blueprint(onboarding_bp) # Rutas /onboarding/*
    app.register_blueprint(notifications_bp)

    print("--- [DEBUG] Blueprints registrados exitosamente ---", file=sys.stdout, flush=True)

    @app.get("/health")
    def healthcheck():
        return {"status": "ok"}, 200

    return app

print("--- [DEBUG] Llamando a create_app() ---", file=sys.stdout, flush=True)
app = create_app()
print("--- [DEBUG] App creada exitosamente ---", file=sys.stdout, flush=True)

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
    """Rellena la colección user_status para usuarios existentes como activos."""
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


@app.route('/animations-test')
def animations_test():
    return render_template('animations_showcase.html')

@app.route('/test/push')
def test_push():
    return render_template('test_push.html')

@app.route('/service-worker.js')
def service_worker():
    from flask import send_from_directory
    return send_from_directory(app.static_folder, 'service-worker.js')

if __name__ == "__main__":
    # Solo ejecutar inicializacion DB en el proceso hijo del reloader
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        create_indexes(extensions.db)
        # seed_user_statuses()  # OPTIMIZACIÓN: Deshabilitado para mejorar inicio. 
        # Ejecutar manualmente si es necesario.
    
    use_reloader = False if os.name == "nt" else True
    # Nota: Windows socket error con reloader a veces. 
    # El usuario tuvo problemas antes con esto (WinError 10038).
    # Si sigue fallando, poner use_reloader=False.
    app.run(debug=True, host="0.0.0.0", port=Config.PORT, use_reloader=use_reloader)
