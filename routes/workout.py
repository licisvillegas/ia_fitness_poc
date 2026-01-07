"""
Blueprint de Smart Workout
Maneja dashboard, runner, sesiones y estadísticas de entrenamiento
"""
from flask import Blueprint, request, jsonify, render_template, redirect
from bson import ObjectId
from datetime import datetime
import extensions
from extensions import logger

# Crear blueprint
workout_bp = Blueprint('workout', __name__, url_prefix='/workout')

print("LOADING WORKOUT_PY MODULE...", flush=True)

# Helper para obtener la DB inicializada (evita capturar None en import)
def get_db():
    return extensions.db

# ...

@workout_bp.route("/dashboard")
def dashboard():
    """Render the Workout Dashboard."""
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

@workout_bp.get("/api/exercises/filter")
def api_filter_exercises():
    """
    Public API to filter exercises by muscle groups (comma separated).
    Query params:
    - muscles: "Pecho,Tríceps" or "all"
    - q: search term (optional)
    """
    db = get_db()
    if db is None: return jsonify([]), 503
    
    muscles_arg = request.args.get("muscles", "")
    equipment_arg = request.args.get("equipment", "").strip()
    query_term = request.args.get("q", "").strip()
    
    query = {}
    
    # Muscle Filter
    if muscles_arg and muscles_arg.lower() != "all":
        # Split by comma and strip
        raw_parts = [m.strip() for m in muscles_arg.split(",") if m.strip()]
        
        resolved_parts = set()
        for p in raw_parts:
            # 1. Check if p is a key (case-insensitive check)
            # Assuming keys are stored capitalized or we check regex, 
            # but simpler: check if any body_part has key=p or label_es=p
            
            # Efficient lookup:
            # Find body_part where key=p OR label=p OR label_es=p
            bp = db.body_parts.find_one({
                "$or": [
                    {"key": {"$regex": f"^{p}$", "$options": "i"}},
                    {"label": {"$regex": f"^{p}$", "$options": "i"}},
                    {"label_es": {"$regex": f"^{p}$", "$options": "i"}}
                ]
            })
            
            if bp:
                resolved_parts.add(bp["key"]) # Use the internal key
            else:
                # If not found in body_parts, assume it might be a direct key use by exercise
                # (fallback)
                resolved_parts.add(p)
                
        if resolved_parts:
            query["body_part"] = {"$in": list(resolved_parts)}

    # Equipment Filter
    if equipment_arg:
        query["equipment"] = equipment_arg
            
    # Search Term
    if query_term:
        query["name"] = {"$regex": query_term, "$options": "i"}
        
    try:
        # Projection: keep it light
        cursor = db.exercises.find(query, {
            "exercise_id": 1, "name": 1, "body_part": 1, 
            "difficulty": 1, "equipment": 1, "video_url": 1,
            "description": 1, "image_url": 1
        }).sort("name", 1).limit(50)
        
        results = list(cursor)
        for r in results:
            r["_id"] = str(r["_id"])
            
        return jsonify(results), 200
    except Exception as e:
        logger.error(f"Error filtering exercises: {e}")
        return jsonify({"error": str(e)}), 500


@workout_bp.get("/api/exercises")
def api_list_exercises():
    """Listado publico de ejercicios para el builder del usuario."""
    try:
        db = get_db()
        if db is None: return jsonify({"error": "DB not ready"}), 503
        docs = list(db.exercises.find({}))
        for d in docs:
            d["_id"] = str(d["_id"])
        return jsonify(docs), 200
    except Exception as e:
        logger.error(f"Error listing exercises (workout): {e}")
        return jsonify({"error": "Error interno"}), 500


@workout_bp.get("/api/body-parts")
def api_get_body_parts():
    """Retorna la lista de partes del cuerpo disponibles (Dynamic Collection)."""
    try:
        db = get_db()
        parts = list(db.body_parts.find({}, {"_id": 0}).sort("label_es", 1))
        # Fallback if empty (should be seeded)
        if not parts:
            return jsonify([]), 200
        return jsonify(parts), 200
    except Exception as e:
        logger.error(f"Error getting body parts: {e}")
        return jsonify({"error": str(e)}), 500
@workout_bp.get("/api/stats/heatmap")
def api_stats_heatmap():
    """Returns frequency map of workouts for the user (last year)."""
    try:
        user_id = request.args.get("user_id")
        if not user_id: return jsonify({"error": "Missing user_id"}), 400
            
        db = get_db()
        if db is None: return jsonify({}), 503
        
        # Robust Logic: Fetch raw and process in Python to handle Mixed Types (Date/String)
        # Fetch only needed fields from 'workout_sessions'
        cursor = db.workout_sessions.find(
            {"user_id": user_id}, 
            {"started_at": 1, "created_at": 1}
        )
        
        heatmap_data = {}
        
        for s in cursor:
            # Determine date
            raw_date = s.get("started_at") or s.get("created_at")
            date_str = None
            
            if isinstance(raw_date, datetime):
                date_str = raw_date.strftime("%Y-%m-%d")
            elif isinstance(raw_date, str):
                # Try parsing if it's a full ISO string, or just take first 10 chars
                date_str = raw_date[:10]
            
            if date_str:
                heatmap_data[date_str] = heatmap_data.get(date_str, 0) + 1
        
        return jsonify(heatmap_data), 200
        
    except Exception as e:
        logger.error(f"Error yielding heatmap: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.get("/api/routines")
def api_get_user_routines():
    """Returns the routines assigned to the user."""
    try:
        user_id = request.args.get("user_id")
        if not user_id: return jsonify({"error": "Missing user_id"}), 400
        
        db = get_db()
        
        now = datetime.utcnow()
        db.routine_assignments.update_many(
            {"user_id": user_id, "active": True, "expires_at": {"$lte": now}},
            {"$set": {"active": False, "expired_at": now}}
        )

        # 1. Fetch active assignments for this user
        assignments_cursor = db.routine_assignments.find({
            "user_id": user_id,
            "active": True,
            "$or": [
                {"expires_at": {"$exists": False}},
                {"expires_at": None},
                {"expires_at": {"$gt": now}}
            ]
        })
        assigned_ids = [ObjectId(a["routine_id"]) for a in assignments_cursor if a.get("routine_id")]
        
        routines = []
        if assigned_ids:
            # 2. Fetch the actual items from routines collection
            routines_cursor = db.routines.find({"_id": {"$in": assigned_ids}})
            for r in routines_cursor:
                r["_id"] = str(r["_id"])
                # Ensure items array exists
                if "items" not in r: r["items"] = []
                routines.append(r)
        
        return jsonify(routines), 200
        
    except Exception as e:
        logger.error(f"Error fetching routines: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.route("/routines/builder")
def user_routine_builder_page():
    user_id = request.cookies.get("user_session")
    if not user_id:
        return redirect("/")
    return render_template("routine_builder_user.html")

@workout_bp.get("/api/my-routines")
def api_list_my_routines():
    """Lista las rutinas creadas por el usuario."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        db = get_db()
        if db is None: return jsonify({"error": "DB not ready"}), 503

        cursor = db.routines.find({"user_id": user_id}).sort("created_at", -1)
        results = []
        for r in cursor:
            r["_id"] = str(r["_id"])
            results.append(r)
        return jsonify(results), 200
    except Exception as e:
        logger.error(f"Error listing user routines: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.get("/api/my-routines/<routine_id>")
def api_get_my_routine_detail(routine_id):
    """Obtiene detalle de una rutina propia."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401
        if not ObjectId.is_valid(routine_id):
            return jsonify({"error": "ID invalido"}), 400

        db = get_db()
        if db is None: return jsonify({"error": "DB not ready"}), 503

        r = db.routines.find_one({"_id": ObjectId(routine_id), "user_id": user_id})
        if not r:
            return jsonify({"error": "Rutina no encontrada"}), 404
        r["_id"] = str(r["_id"])
        return jsonify(r), 200
    except Exception as e:
        logger.error(f"Error getting user routine {routine_id}: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.post("/api/my-routines/save")
def api_save_my_routine():
    """Guarda o actualiza una rutina del usuario."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        data = request.get_json() or {}
        db = get_db()
        if db is None: return jsonify({"error": "DB not ready"}), 503

        rid = data.get("id")
        doc = {
            "name": data.get("name"),
            "description": data.get("description"),
            "routine_day": data.get("routine_day"),
            "routine_body_parts": data.get("routine_body_parts", []),
            "items": data.get("items", []),
            "updated_at": datetime.utcnow(),
            "user_id": user_id
        }

        if rid:
            if not ObjectId.is_valid(rid):
                return jsonify({"error": "ID invalido"}), 400
            res = db.routines.update_one(
                {"_id": ObjectId(rid), "user_id": user_id},
                {"$set": doc}
            )
            if res.matched_count == 0:
                return jsonify({"error": "Rutina no encontrada"}), 404
            return jsonify({"message": "Rutina actualizada", "id": rid}), 200
        else:
            doc["created_at"] = datetime.utcnow()
            res = db.routines.insert_one(doc)
            return jsonify({"message": "Rutina creada", "id": str(res.inserted_id)}), 200
    except Exception as e:
        logger.error(f"Error saving user routine: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.get("/api/stats/volume")
def api_stats_volume():
    """Returns volume progress over time."""
    try:
        user_id = request.args.get("user_id")
        if not user_id: return jsonify({"error": "Missing user_id"}), 400
        
        db = get_db()
        if db is None: return jsonify([]), 503
        
        # Get last 30 sessions with total_volume
        # Note: Sorting might be tricky with mixed types, but we'll try best effort
        # USE 'workout_sessions'
        cursor = db.workout_sessions.find(
            {"user_id": user_id, "total_volume": {"$gt": 0}},
            {"total_volume": 1, "body_weight": 1, "started_at": 1, "created_at": 1}
        ).sort([("created_at", 1)]).limit(30)
        
        data = []
        for s in cursor:
            raw_date = s.get("started_at") or s.get("created_at")
            date_str = "Unknown"
            
            if isinstance(raw_date, datetime):
                date_str = raw_date.strftime("%Y-%m-%d")
            elif isinstance(raw_date, str):
                date_str = raw_date[:10]
                
            data.append({
                "date": date_str,
                "volume": s.get("total_volume", 0),
                "weight": s.get("body_weight", 0)
            })
            
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"Error fetching volume stats: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.get("/api/sessions")
def api_get_sessions():
    """Returns recent sessions for history list."""
    try:
        user_id = request.args.get("user_id")
        if not user_id:
            return jsonify({"error": "Missing user_id"}), 400
        
        db = get_db()
        if db is None: return jsonify([]), 503
        
        limit = int(request.args.get("limit", 20))
        
        # Try finding sessions by 'created_at' (or started_at) descending
        cursor = db.workout_sessions.find(
            {"user_id": user_id}
        ).sort("created_at", -1).limit(limit)
        
        sessions = []
        for s in cursor:
            s["_id"] = str(s["_id"])
            
            # Normalize start time for frontend
            start_dt = s.get("started_at") or s.get("created_at")
            if isinstance(start_dt, datetime):
                s["start_time"] = start_dt.isoformat()
            elif isinstance(start_dt, str):
                 s["start_time"] = start_dt
            
            sessions.append(s)
            
        return jsonify(sessions), 200
    except Exception as e:
        logger.error(f"Error fetching sessions: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.delete("/api/sessions/<session_id>")
def api_delete_session(session_id):
    """Deletes a workout session."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401
        if not ObjectId.is_valid(session_id):
            return jsonify({"error": "Invalid session id"}), 400

        db = get_db()
        if db is None:
            return jsonify({"error": "DB not ready"}), 503

        role_doc = db.user_roles.find_one({"user_id": user_id})
        is_admin = role_doc and role_doc.get("role") == "admin"

        session_doc = db.workout_sessions.find_one({"_id": ObjectId(session_id)})
        if not session_doc:
            return jsonify({"error": "Session not found"}), 404

        if not is_admin and session_doc.get("user_id") != user_id:
            return jsonify({"error": "Forbidden"}), 403

        res = db.workout_sessions.delete_one({"_id": ObjectId(session_id)})
        if res.deleted_count == 0:
            return jsonify({"error": "Session not found"}), 404

        return jsonify({"success": True}), 200
    except Exception as e:
        logger.error(f"Error deleting session {session_id}: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.get("/run/<routine_id>")
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
            
        # Convert ObjectId to string
        routine["_id"] = str(routine["_id"])
        routine["id"] = str(routine["_id"])
        
        # Ensure items exist
        if "items" not in routine:
            routine["items"] = []
            
        # Get Current User Name (for personalized hello)
        user_id = request.cookies.get("user_session")
        user_name = ""
        if user_id:
             u = db.users.find_one({"user_id": user_id})
             if u:
                 user_name = u.get("name") or u.get("username")
        
        return render_template("workout_runner.html", 
                               routine=routine,
                               current_user_id=user_id,
                               current_user_name=user_name)
    except Exception as e:
        logger.error(f"Error running routine: {e}")
        return f"Error interno: {e}", 500

@workout_bp.post("/api/session/save")
def api_save_session():
    """
    Saves a completed workout session.
    """
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
             return jsonify({"error": "Unauthorized"}), 401
             
        data = request.json
        if not data:
            return jsonify({"error": "No data"}), 400
            
        db = get_db()
        
        # Calculate stats
        sets = data.get("sets", [])
        total_volume = 0
        for s in sets:
             try:
                 w = float(s.get("weight", 0))
                 r = float(s.get("reps", 0))
                 total_volume += w * r
             except: pass
             
        # Prepare document
        session_doc = {
            "user_id": user_id,
            "routine_id": data.get("routine_id"),
            "started_at": data.get("start_time"),
            "completed_at": data.get("end_time") or datetime.now().isoformat(),
            "created_at": datetime.now(),
            "sets": sets,
            "total_volume": round(total_volume, 2),
            "body_weight": 0
        }
        
        res = db.workout_sessions.insert_one(session_doc)
        
        return jsonify({"success": True, "id": str(res.inserted_id)}), 200
        
    except Exception as e:
        logger.error(f"Error saving session: {e}")
        return jsonify({"error": str(e)}), 500
