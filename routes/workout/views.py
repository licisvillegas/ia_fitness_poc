from flask import request, render_template
from bson import ObjectId
from extensions import logger
import extensions
from .utils import get_db, hydrate_routines_with_substitutes

def dashboard():
    """Renderiza el Dashboard de Entrenamiento."""
    user_id = request.cookies.get("user_session")
    is_admin = False
    all_users = []
    
    if user_id and extensions.db is not None:
        try:
            # Check Role
            role_doc = extensions.db.user_roles.find_one({"user_id": user_id})
            if role_doc and role_doc.get("role") == "admin":
                is_admin = True
                
            # If Admin, fetch all users for selector
            if is_admin:
                users_cursor = extensions.db.users.find({}, {"user_id": 1, "name": 1, "username": 1})
                for u in users_cursor:
                    display_name = u.get("name") or u.get("username") or "Usuario"
                    uid = str(u.get("user_id"))
                    all_users.append({"user_id": uid, "name": display_name})
                    
        except Exception as e:
            logger.error(f"Error preparing dashboard context: {e}")

    return render_template("workout_dashboard.html", 
                           current_user_id=user_id, 
                           is_admin=is_admin, 
                           all_users=all_users)

def exercises_page():
    """Endpoint seguro del Catálogo Unificado (Cuadrícula + Lista)."""
    user_id = request.cookies.get("user_session")
    embed = request.args.get("embed") in ("1", "true", "yes")
    
    is_admin = False
    
    if user_id and extensions.db is not None:
        try:
             role_doc = extensions.db.user_roles.find_one({"user_id": user_id})
             if role_doc and role_doc.get("role") == "admin":
                 is_admin = True
        except Exception as e:
            logger.error(f"Error checking admin role in unified view: {e}")

    # Sidebar Logic
    sidebar_template = "components/sidebar.html"
    request_admin_mode = request.args.get("admin") == "true"
    
    if embed:
        sidebar_template = None
    elif is_admin and request_admin_mode:
        sidebar_template = "components/sidebar_admin.html"

    return render_template("exercises_unified.html", 
                         is_admin=is_admin, 
                         sidebar_template=sidebar_template,
                         embed=embed)

def exercises_unified_page():
    """Alias heredado para la vista unificada."""
    return exercises_page()

def rm_calculator_page():
    """Renderiza la calculadora de 1RM."""
    return render_template("rm_calculator.html")

def user_routine_builder_page():
    return render_template("routine_builder_user.html")

def user_routine_builder_guided_page():
    source = request.args.get("source") or "user"
    return render_template("routine_builder_guided.html", source=source)

def user_routines_catalog_page():
    return render_template("routines_catalog_user.html")

def adherence_dashboard_page():
    """Renderiza el dashboard de adherencia."""
    user_id = request.cookies.get("user_session")
    return render_template("adherence_dashboard.html", current_user_id=user_id)

def run_routine(routine_id):
    """
    Renders the workout runner for a specific routine.
    """
    try:
        db = get_db()
        if not ObjectId.is_valid(routine_id):
            return render_template("404.html", message="ID de rutina inválido"), 400
            
        routine = db.routines.find_one({"_id": ObjectId(routine_id)})
        if not routine:
            return render_template("404.html", message="Rutina no encontrada"), 404
            
        routine["_id"] = str(routine["_id"])
        routine["id"] = str(routine["_id"])
        
        if "items" not in routine:
            routine["items"] = []
            
        hydrate_routines_with_substitutes([routine], db)

        user_id = request.cookies.get("user_session")
        user_name = ""
        restored_state = None
        
        if user_id:
             u = db.users.find_one({"user_id": user_id})
             if u:
                 user_name = u.get("name") or u.get("username")
             
             active_session = db.active_workout_sessions.find_one({
                 "user_id": user_id, 
                 "routine_id": str(routine_id)
             })
             
             if active_session:
                 if "_id" in active_session: active_session["_id"] = str(active_session["_id"])
                 restored_state = active_session

        return render_template("workout_runner.html", 
                               routine=routine,
                               current_user_id=user_id,
                               current_user_name=user_name,
                               restored_state=restored_state)
    except Exception as e:
        logger.error(f"Error running routine: {e}")
        return f"Error interno: {e}", 500
