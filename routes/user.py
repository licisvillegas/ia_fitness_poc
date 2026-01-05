from flask import Blueprint, request, jsonify, render_template
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import extensions
from extensions import logger
from utils.auth_helpers import ensure_user_status
from utils.helpers import parse_birth_date

user_bp = Blueprint('user', __name__)

@user_bp.route("/")
def index():
    return render_template("auth.html")

@user_bp.route("/landing")
def landing_page():
    return render_template("landing.html")

@user_bp.route("/dashboard")
def dashboard_page():
    # Redirige al dashboard directamente
    return render_template("dashboard.html")

@user_bp.route("/nutrition")
def nutrition_page():
    return render_template("nutrition.html")

@user_bp.route("/about")
def about_page():
    return render_template("about.html")

@user_bp.route("/plan")
def plan_page():
    return render_template("plan.html")

@user_bp.route("/exercises/list")
def exercises_list_page():
    return render_template("exercises_list.html")

@user_bp.route("/profile")
def profile_page():
    user_id = request.cookies.get("user_session")
    user_context = {}
    if user_id and extensions.db is not None:
        try:
            u = extensions.db.users.find_one({"user_id": user_id})
            if u:
                user_context = {
                   "user_id": user_id,
                   "name": u.get("name"),
                   "email": u.get("email"),
                   "username": u.get("username"),
                   "role": "user"
                }
                role_doc = extensions.db.user_roles.find_one({"user_id": user_id})
                if role_doc:
                    user_context["role"] = role_doc.get("role")
                
                p = extensions.db.user_profiles.find_one({"user_id": user_id})
                if p:
                    bdate = p.get("birth_date")
                    if isinstance(bdate, datetime):
                        bdate = bdate.strftime("%Y-%m-%d")
                    user_context.update({
                        "sex": p.get("sex"),
                        "birth_date": bdate,
                        "phone": p.get("phone"),
                        "has_profile": True
                    })
                else:
                    user_context["has_profile"] = False
        except Exception as e:
            logger.error(f"Error loading profile context: {e}")
            pass

    return render_template("profile.html", user_data=user_context)

@user_bp.post("/api/user/change_password")
def api_user_change_password():
    """
    Permite al usuario cambiar su contraseña.
    Requiere: current_password, new_password
    """
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "No autenticado"}), 401
            
        data = request.get_json()
        current_password = data.get("current_password")
        new_password = data.get("new_password")
        
        if not current_password or not new_password:
            return jsonify({"error": "Faltan datos (actual y nueva contraseña)"}), 400
            
        if len(new_password) < 6:
            return jsonify({"error": "La nueva contraseña debe tener al menos 6 caracteres"}), 400

        if extensions.db is None:
             return jsonify({"error": "DB no disponible"}), 503

        # Verify old password
        user = extensions.db.users.find_one({"user_id": user_id})
        if not user:
             return jsonify({"error": "Usuario no encontrado"}), 404
             
        if not check_password_hash(user["password_hash"] if "password_hash" in user else user.get("password", ""), current_password):
            return jsonify({"error": "La contraseña actual es incorrecta"}), 403
            
        # Update with new password
        new_hash = generate_password_hash(new_password)
        extensions.db.users.update_one({"user_id": user_id}, {"$set": {"password_hash": new_hash}})
        
        logger.info(f"Usuario {user_id} cambió su contraseña exitosamente")
        return jsonify({"message": "Contraseña actualizada correctamente"}), 200

    except Exception as e:
        logger.error(f"Error cambiando password: {e}")
        return jsonify({"error": "Error interno"}), 500


@user_bp.post("/api/user/profile/save")
def api_user_profile_save():
    """Actualiza perfil del usuario autenticado."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "No autenticado"}), 401
        
        data = request.get_json() or {}
        name = data.get("name")
        sex = (data.get("sex") or "").strip().lower() or None
        birth_date_raw = data.get("birth_date")
        phone = (data.get("phone") or "").strip() or None

        if sex and sex not in ["male", "female", "other"]:
            return jsonify({"error": "Sexo invalido"}), 400

        birth_dt = parse_birth_date(birth_date_raw)
        if birth_date_raw and birth_dt is None:
            return jsonify({"error": "Fecha de nacimiento invalida. Usa YYYY-MM-DD"}), 400

        updates = {
            "sex": sex,
            "birth_date": birth_dt,
            "phone": phone,
            "updated_at": datetime.utcnow(),
        }

        if extensions.db is not None:
             extensions.db.user_profiles.update_one(
                {"user_id": user_id},
                {"$set": updates, "$setOnInsert": {"created_at": datetime.utcnow(), "user_id": user_id}},
                upsert=True,
            )
             if name is not None:
                extensions.db.users.update_one({"user_id": user_id}, {"$set": {"name": name}})
        
        return jsonify({"message": "Perfil actualizado", "user_id": user_id}), 200

    except Exception as e:
        logger.error(f"Error guardando perfil usuario: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500

@user_bp.route("/get_user_plan/<user_id>", methods=["GET"])
def get_user_plan(user_id):
    try:
        if extensions.db is None:
             return jsonify({"error": "DB no inicializada"}), 503
        plan = extensions.db.plans.find_one({"user_id": user_id}, sort=[("created_at", -1)])
        if not plan:
            return jsonify({"error": "No se encontró un plan para este usuario"}), 404
        plan["_id"] = str(plan["_id"])
        # Serializar fechas
        if plan.get("created_at"):
            plan["created_at"] = (plan["created_at"].isoformat() + "Z") if isinstance(plan["created_at"], datetime) else str(plan["created_at"])
        if plan.get("activated_at"):
            plan["activated_at"] = (plan["activated_at"].isoformat() + "Z") if isinstance(plan["activated_at"], datetime) else str(plan["activated_at"])

        return jsonify(plan), 200
    except Exception as e:
        logger.error(f"Error al obtener plan de {user_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno al obtener el plan"}), 500


@user_bp.route("/plans/<user_id>/active")
def get_user_active_plan(user_id):
    """Obtiene el plan activo del usuario (Workout + Nutrition)."""
    # Verify auth (optional or strict based on middleware)
    # user_session = request.cookies.get("user_session")
    # if not user_session: return jsonify({"error": "Unauthorized"}), 401
    
    if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
    
    try:
        plan = extensions.db.plans.find_one({"user_id": user_id, "active": True})
        if not plan:
            return jsonify({"error": "No hay plan activo"}), 404
        
        plan["_id"] = str(plan["_id"])
        return jsonify(plan), 200
    except Exception as e:
        logger.error(f"Error fetching active plan: {e}")
        return jsonify({"error": "Internal Error"}), 500

@user_bp.route("/get_progress/<user_id>", methods=["GET"])
def get_progress(user_id):
    try:
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        records = list(extensions.db.progress.find({"user_id": user_id}).sort("date", 1))
        for r in records:
            r["_id"] = str(r["_id"])
            if r.get("date") and isinstance(r["date"], datetime):
                r["date"] = r["date"].isoformat()
        if not records:
            return jsonify({"error": "No hay registros de progreso para este usuario"}), 404
        return jsonify(records), 200
    except Exception as e:
        logger.error(f"Error al obtener progreso de {user_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno al obtener progreso"}), 500
@user_bp.get("/api/user/my_profile")
def get_my_profile_aggregated():
    """Endpoint agregado para precargar formularios del usuario."""
    user_id = request.cookies.get("user_session")
    if not user_id:
         return jsonify({"error": "No autenticado"}), 401
    
    if extensions.db is None:
         return jsonify({"error": "DB not ready"}), 503

    try:
        # 1. Basic User Info
        user_doc = extensions.db.users.find_one({"user_id": user_id}) or {}
        
        # 2. Profile Info
        profile_doc = extensions.db.user_profiles.find_one({"user_id": user_id}) or {}
        
        # 3. Active Plan Goal/Activity
        plan_doc = extensions.db.plans.find_one({"user_id": user_id, "active": True}) or {}
        
        # 4. Latest Measurements (from body_assessments or progress)
        measurements = {}
        # Try latest assessment
        last_assess = extensions.db.body_assessments.find_one(
            {"user_id": user_id}, sort=[("created_at", -1)]
        )
        if last_assess and "input" in last_assess and "measurements" in last_assess["input"]:
             measurements = last_assess["input"]["measurements"]
        
        # Calculate Age
        age = None
        if profile_doc.get("birth_date"):
            dob = profile_doc["birth_date"]
            if isinstance(dob, datetime):
                today = datetime.utcnow()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        
        # Construct Response
        data = {
            "user_id": user_id,
            "name": user_doc.get("name") or user_doc.get("username"),
            "email": user_doc.get("email"),
            "sex": profile_doc.get("sex"),
            "age": age,
            "phone": profile_doc.get("phone"),
            "goal": plan_doc.get("goal") or user_doc.get("goal"), # Fallback to user doc
            "activity_level": plan_doc.get("activity_level"), # Note: Plan might not check activity level, checking input logic usually relies on creation input.
            "notes": None, # Could fetch from last plan or assessment
            "measurements": measurements
        }
        
        return jsonify(data), 200
        
    except Exception as e:
        logger.error(f"Error fetching my_profile for {user_id}: {e}", exc_info=True)
        return jsonify({"error": "Error interno fetching profile"}), 500
