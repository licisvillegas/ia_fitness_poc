"""
Blueprint de Smart Workout
Maneja dashboard, runner, sesiones y estadísticas de entrenamiento
"""
from flask import Blueprint, request, jsonify, render_template, redirect
from bson import ObjectId
from datetime import datetime, timedelta
import re
import extensions
from extensions import logger
from utils.routine_utils import normalize_routine_items
from utils.cache import cache_get, cache_set

# Crear blueprint
workout_bp = Blueprint('workout', __name__, url_prefix='/workout')

print("LOADING WORKOUT_PY MODULE...", flush=True)

# Helper para obtener la DB inicializada (evita capturar None en import)
def get_db():
    return extensions.db

def _get_body_parts_map(db):
    cache_key = "body_parts_map"
    cached = cache_get(cache_key)
    if cached:
        return cached

    parts = list(db.body_parts.find({}, {"key": 1, "label": 1, "label_es": 1}))
    mapping = {}
    for p in parts:
        key = (p.get("key") or "").strip()
        if not key:
            continue
        label = (p.get("label") or "").strip()
        label_es = (p.get("label_es") or "").strip()
        mapping[key.lower()] = key
        if label:
            mapping[label.lower()] = key
        if label_es:
            mapping[label_es.lower()] = key

    cache_set(cache_key, mapping, 300)
    return mapping

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

@workout_bp.route("/exercises")
def exercises_page():
    """Unified Catalog (Grid + List) secured endpoint."""
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

@workout_bp.route("/exercises/unified")
def exercises_unified_page():
    """Legacy alias for unified view."""
    return exercises_page()

@workout_bp.route("/rm-calculator")
def rm_calculator_page():
    """Render the 1RM calculator."""
    return render_template("rm_calculator.html")

@workout_bp.get("/api/exercises")
def list_public_exercises():
    """Listado público de ejercicios para el catálogo de usuario."""
    db = get_db()
    if db is None: return jsonify({"error": "DB not ready"}), 503
    try:
        limit = int(request.args.get("limit", 50))
        page = int(request.args.get("page", 1))
        if limit < 1:
            limit = 50
        if limit > 5000:
            limit = 5000
        if page < 1:
            page = 1
        skip = (page - 1) * limit

        docs = list(
            db.exercises.find(
                {},
                {
                    "exercise_id": 1,
                    "name": 1,
                    "body_part": 1,
                    "difficulty": 1,
                    "equipment": 1,
                    "type": 1,
                    "exercise_type": 1,
                    "video_url": 1,
                    "description": 1,
                    "image_url": 1,
                    "substitutes": 1,
                    "equivalents": 1,
                    "equivalent_exercises": 1,
                    "alternative_names": 1,
                    "pattern": 1,
                    "plane": 1,
                    "unilateral": 1,
                    "primary_muscle": 1,
                    "level": 1,
                },
            )
            .sort("name", 1)
            .skip(skip)
            .limit(limit)
        )
        for d in docs:
            d["_id"] = str(d["_id"])
        return jsonify(docs), 200
    except Exception as e:
        logger.error(f"Error listing public exercises: {e}")
        return jsonify({"error": "Error interno"}), 500


@workout_bp.get("/api/exercises/search")
def api_search_exercises():
    """Search exercises with pagination for the user catalog."""
    db = get_db()
    if db is None:
        return jsonify({"error": "DB not ready"}), 503
    try:
        limit = int(request.args.get("limit", 50))
        page = int(request.args.get("page", 1))
        if limit < 1:
            limit = 50
        if limit > 200:
            limit = 200
        if page < 1:
            page = 1
        skip = (page - 1) * limit

        term = (request.args.get("q") or "").strip()
        body_part = (request.args.get("body_part") or "").strip()
        equipment = (request.args.get("equipment") or "").strip()
        ex_type = (request.args.get("type") or "").strip()

        query = {}
        if body_part:
            query["body_part"] = body_part

        if equipment:
            escaped_equipment = re.escape(equipment)
            query["equipment"] = {"$regex": f"^{escaped_equipment}$", "$options": "i"}

        if ex_type:
            escaped_type = re.escape(ex_type)
            query["type"] = {"$regex": f"^{escaped_type}$", "$options": "i"}

        if term:
            escaped_term = re.escape(term)
            query["$or"] = [
                {"name": {"$regex": escaped_term, "$options": "i"}},
                {"alternative_names": {"$regex": escaped_term, "$options": "i"}},
            ]

        total = db.exercises.count_documents(query)
        docs = list(
            db.exercises.find(
                query,
                {
                    "exercise_id": 1,
                    "name": 1,
                    "body_part": 1,
                    "difficulty": 1,
                    "equipment": 1,
                    "type": 1,
                    "exercise_type": 1,
                    "video_url": 1,
                    "description": 1,
                    "image_url": 1,
                    "substitutes": 1,
                    "equivalents": 1,
                    "equivalent_exercises": 1,
                    "alternative_names": 1,
                    "pattern": 1,
                    "plane": 1,
                    "unilateral": 1,
                    "primary_muscle": 1,
                    "level": 1,
                    "is_custom": 1,
                },
            )
            .sort("name", 1)
            .skip(skip)
            .limit(limit)
        )
        for d in docs:
            d["_id"] = str(d["_id"])
        return jsonify({"items": docs, "total": total, "page": page, "limit": limit}), 200
    except Exception as e:
        logger.error(f"Error searching exercises: {e}")
        return jsonify({"error": "Error interno"}), 500




@workout_bp.post("/api/rm/save")
def api_save_rm_record():
    """Saves a 1RM record for the authenticated user."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        data = request.get_json() or {}
        weight = data.get("weight")
        reps = data.get("reps")
        exercise = (data.get("exercise") or "").strip()
        date = data.get("date")
        one_rm = data.get("one_rm")
        unit = (data.get("unit") or "").strip()
        formulas = data.get("formulas", [])

        if not weight or not reps or not exercise or not date:
            return jsonify({"error": "Missing required fields"}), 400

        db = get_db()
        if db is None:
            return jsonify({"error": "DB not ready"}), 503

        record = {
            "user_id": user_id,
            "exercise": exercise,
            "input_weight": float(weight),
            "input_reps": int(reps),
            "unit": unit,
            "calculated_1rm": one_rm,
            "formulas_used": formulas,
            "date": date,
            "created_at": datetime.utcnow()
        }

        res = db.one_rm_records.insert_one(record)
        return jsonify({"status": "success", "id": str(res.inserted_id)}), 200
    except Exception as e:
        logger.error(f"Error saving 1RM record: {e}")
        return jsonify({"error": "Internal Error"}), 500

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
    limit = int(request.args.get("limit", 50))
    if limit < 1:
        limit = 50
    if limit > 200:
        limit = 200
    
    query = {}
    
    # Muscle Filter
    if muscles_arg and muscles_arg.lower() != "all":
        # Split by comma and strip
        raw_parts = [m.strip() for m in muscles_arg.split(",") if m.strip()]
        
        resolved_parts = set()
        parts_map = _get_body_parts_map(db)
        for p in raw_parts:
            key = parts_map.get(p.lower())
            if key:
                resolved_parts.add(key)
            else:
                resolved_parts.add(p)
                
        if resolved_parts:
            query["body_part"] = {"$in": list(resolved_parts)}

    # Equipment Filter
    if equipment_arg:
        escaped_equipment = re.escape(equipment_arg)
        query["equipment"] = {"$regex": f"^{escaped_equipment}$", "$options": "i"}
            
    # Search Term
    if query_term:
        escaped_term = re.escape(query_term)
        query["$or"] = [
            {"name": {"$regex": escaped_term, "$options": "i"}},
            {"alternative_names": {"$regex": escaped_term, "$options": "i"}},
        ]
        
    try:
        # Projection: keep it light
        cursor = db.exercises.find(query, {
            "exercise_id": 1, "name": 1, "body_part": 1,
            "difficulty": 1, "equipment": 1, "video_url": 1,
            "description": 1, "image_url": 1,
            "substitutes": 1, "equivalents": 1, "equivalent_exercises": 1,
            "alternative_names": 1, "pattern": 1, "plane": 1, "unilateral": 1,
            "primary_muscle": 1, "level": 1
        }).sort("name", 1).limit(limit)
        
        results = list(cursor)
        for r in results:
            r["_id"] = str(r["_id"])
            
        return jsonify(results), 200
    except Exception as e:
        logger.error(f"Error filtering exercises: {e}")
        return jsonify({"error": str(e)}), 500


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
        # Relaxed Auth: Allow access via user_id arg (consistent with volume/sessions)
        req_user_id = request.args.get("user_id")
        current_user_id = request.cookies.get("user_session")

        # If neither provided, error
        if not current_user_id and not req_user_id:
             return jsonify({"error": "Unauthorized"}), 401
            
        db = get_db()
        if db is None: return jsonify({}), 503

        # Resolve user_id
        # Priority: Admin requesting specific ID > specific ID (if relaxed) > Cookie ID
        user_id = None
        
        if current_user_id:
             user_id = current_user_id
             # Check Admin for Override
             role_doc = db.user_roles.find_one({"user_id": current_user_id})
             if role_doc and role_doc.get("role") == "admin" and req_user_id:
                 user_id = req_user_id
        else:
             # Fallback to requested ID if no cookie (Dashboard auto-refresh scenario)
             user_id = req_user_id
        
        # Robust Logic: Fetch raw and process in Python to handle Mixed Types (Date/String)
        # Fetch only needed fields from 'workout_sessions'
        cursor = db.workout_sessions.find(
            {"user_id": user_id}, 
            {"completed_at": 1}
        )
        
        heatmap_data = {}
        
        for s in cursor:
            # Determine date
            raw_date = s.get("completed_at")
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
        }, {"routine_id": 1, "expires_at": 1})
        assignments = list(assignments_cursor)
        assigned_ids = []
        assignment_map = {}
        for a in assignments:
            rid = a.get("routine_id")
            if not rid:
                continue
            if ObjectId.is_valid(str(rid)):
                assigned_ids.append(ObjectId(str(rid)))
            expires_at = a.get("expires_at")
            if isinstance(expires_at, datetime):
                expires_at = expires_at.isoformat()
            assignment_map[str(rid)] = expires_at
        
        routines = []
        if assigned_ids:
            # 2. Fetch the actual items from routines collection
            routines_cursor = db.routines.find({"_id": {"$in": assigned_ids}})
            for r in routines_cursor:
                r["_id"] = str(r["_id"])
                # Ensure items array exists
                if "items" not in r: r["items"] = []
                r["assigned_expires_at"] = assignment_map.get(r["_id"])
                routines.append(r)
        
        return jsonify(routines), 200
        
    except Exception as e:
        logger.error(f"Error fetching routines: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.route("/routines/builder")
def user_routine_builder_page():
    return render_template("routine_builder_user.html")

@workout_bp.route("/routines/builder-guided")
def user_routine_builder_guided_page():
    source = request.args.get("source") or "user"
    return render_template("routine_builder_guided.html", source=source)

@workout_bp.route("/routines")
def user_routines_catalog_page():
    return render_template("routines_catalog_user.html")

@workout_bp.route("/adherence")
def adherence_dashboard_page():
    """Render adherence dashboard."""
    user_id = request.cookies.get("user_session")
    return render_template("adherence_dashboard.html", current_user_id=user_id)

@workout_bp.get("/api/my-routines")
def api_list_my_routines():
    """Lista las rutinas creadas por el usuario."""
    try:
        current_user_id = request.cookies.get("user_session")
        req_user_id = request.args.get("user_id")
        
        # Determine effective user
        user_id = current_user_id
        is_admin = False
        db = get_db()
        if db is None: return jsonify({"error": "DB not ready"}), 503

        if current_user_id:
            role_doc = db.user_roles.find_one({"user_id": current_user_id})
            is_admin = role_doc and role_doc.get("role") == "admin"
            if is_admin and req_user_id:
                user_id = req_user_id
        elif req_user_id:
            # Fallback for dashboard consistency
            user_id = req_user_id
        else:
            return jsonify({"error": "Unauthorized"}), 401

        active_only = request.args.get("active_only")
        all_routines = request.args.get("all") in ("1", "true", "yes")
        query = {"user_id": user_id}
        if all_routines and is_admin:
            query = {}
        if active_only in ("1", "true", "yes"):
            query["$or"] = [{"is_active": {"$exists": False}}, {"is_active": True}]

        cursor = db.routines.find(query).sort("created_at", -1)
        results = []
        for r in cursor:
            r["_id"] = str(r["_id"])
            results.append(r)
        return jsonify(results), 200
    except Exception as e:
        logger.error(f"Error listing user routines: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.get("/api/adherence/config")
def api_get_adherence_config():
    """Returns user adherence configuration (target frequency)."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        db = get_db()
        if db is None:
            return jsonify({"error": "DB not ready"}), 503

        pref = db.user_preferences.find_one({"user_id": user_id}) or {}
        target_frequency = pref.get("target_frequency", 3)
        return jsonify({"target_frequency": target_frequency}), 200
    except Exception as e:
        logger.error(f"Error loading adherence config: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.post("/api/adherence/config")
def api_save_adherence_config():
    """Saves user adherence configuration (target frequency)."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        data = request.get_json() or {}
        target_frequency = int(data.get("target_frequency", 3))
        if target_frequency < 1 or target_frequency > 7:
            return jsonify({"error": "target_frequency debe estar entre 1 y 7"}), 400

        db = get_db()
        if db is None:
            return jsonify({"error": "DB not ready"}), 503

        db.user_preferences.update_one(
            {"user_id": user_id},
            {"$set": {"user_id": user_id, "target_frequency": target_frequency}},
            upsert=True
        )
        return jsonify({"success": True, "target_frequency": target_frequency}), 200
    except Exception as e:
        logger.error(f"Error saving adherence config: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.get("/api/my-routines/<routine_id>")
def api_get_my_routine_detail(routine_id):
    """Obtiene detalle de una rutina propia."""
    try:
        current_user_id = request.cookies.get("user_session")
        if not current_user_id:
            return jsonify({"error": "Unauthorized"}), 401
        if not ObjectId.is_valid(routine_id):
            return jsonify({"error": "ID invalido"}), 400

        db = get_db()
        if db is None: return jsonify({"error": "DB not ready"}), 503

        role_doc = db.user_roles.find_one({"user_id": current_user_id})
        is_admin = role_doc and role_doc.get("role") == "admin"
        target_user_id = request.args.get("user_id") if is_admin else None
        user_id = target_user_id or current_user_id

        all_routines = request.args.get("all") in ("1", "true", "yes")
        query = {"_id": ObjectId(routine_id), "user_id": user_id}
        if all_routines and is_admin:
            query = {"_id": ObjectId(routine_id)}
        r = db.routines.find_one(query)
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
        role_doc = db.user_roles.find_one({"user_id": user_id})
        is_admin = role_doc and role_doc.get("role") == "admin"
        admin_template = bool(data.get("admin_template")) and is_admin

        doc = {
            "name": data.get("name"),
            "description": data.get("description"),
            "routine_day": data.get("routine_day"),
            "routine_body_parts": data.get("routine_body_parts", []),
            "items": normalize_routine_items(data.get("items", [])),
            "updated_at": datetime.utcnow(),
        }
        if not admin_template:
            doc["user_id"] = user_id
        if "is_active" in data:
            doc["is_active"] = bool(data.get("is_active"))

        if rid:
            if not ObjectId.is_valid(rid):
                return jsonify({"error": "ID invalido"}), 400
            update_query = {"_id": ObjectId(rid)}
            if not admin_template:
                update_query["user_id"] = user_id
            res = db.routines.update_one(
                update_query,
                {"$set": doc}
            )
            if res.matched_count == 0:
                return jsonify({"error": "Rutina no encontrada"}), 404
            return jsonify({"message": "Rutina actualizada", "id": rid}), 200
        else:
            doc["created_at"] = datetime.utcnow()
            if "is_active" not in doc:
                doc["is_active"] = True
            res = db.routines.insert_one(doc)
            return jsonify({"message": "Rutina creada", "id": str(res.inserted_id)}), 200
    except Exception as e:
        logger.error(f"Error saving user routine: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.get("/api/stats/volume")
def api_stats_volume():
    """Returns average weight per set grouped by day."""
    try:
        user_id = request.args.get("user_id")
        if not user_id: return jsonify({"error": "Missing user_id"}), 400
        
        db = get_db()
        if db is None: return jsonify([]), 503
        
        # Fetch sessions for this user
        cursor = db.workout_sessions.find(
            {"user_id": user_id},
            {"sets": 1, "started_at": 1, "created_at": 1}
        ).sort([("created_at", 1)])
        
        daily_weights = {}
        for s in cursor:
            raw_date = s.get("started_at") or s.get("created_at")
            if not raw_date: continue
            
            date_str = None
            if isinstance(raw_date, datetime):
                date_str = raw_date.strftime("%Y-%m-%d")
            elif isinstance(raw_date, str):
                date_str = raw_date[:10]
            
            if not date_str: continue
            
            sets = s.get("sets", [])
            for st in sets:
                try:
                    w = float(st.get("weight", 0))
                    # Only count sets with weight > 0 if we want a meaningful average of weights used
                    if w > 0:
                        if date_str not in daily_weights:
                            daily_weights[date_str] = {"total_weight": 0, "count": 0}
                        daily_weights[date_str]["total_weight"] += w
                        daily_weights[date_str]["count"] += 1
                except (ValueError, TypeError):
                    continue
            
        # Convert to list of averages
        data = []
        sorted_dates = sorted(daily_weights.keys())
        for d in sorted_dates:
            if daily_weights[d]["count"] > 0:
                avg = daily_weights[d]["total_weight"] / daily_weights[d]["count"]
                data.append({
                    "date": d,
                    "volume": round(avg, 2)
                })
            
        # Return last 30 daily points
        return jsonify(data[-30:]), 200
    except Exception as e:
        logger.error(f"Error fetching volume stats: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.get("/api/stats/weekly")
def api_stats_weekly():
    """Returns weekly stats (volume and consistency) for the last 12 weeks."""
    try:
        user_id = request.args.get("user_id")
        if not user_id: return jsonify({"error": "Missing user_id"}), 400
        
        db = get_db()
        if db is None: return jsonify([]), 503
        
        # Get all sessions for this user
        cursor = db.workout_sessions.find(
            {"user_id": user_id},
            {"total_volume": 1, "started_at": 1, "created_at": 1}
        ).sort("created_at", -1)
        
        weekly_stats = {}
        for s in cursor:
            raw_date = s.get("started_at") or s.get("created_at")
            if not raw_date: continue
            
            dt = None
            if isinstance(raw_date, datetime):
                dt = raw_date
            elif isinstance(raw_date, str):
                try:
                    if "T" in raw_date:
                        dt = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
                    else:
                        dt = datetime.strptime(raw_date[:10], "%Y-%m-%d")
                except: continue
            
            if not dt: continue
            
            year, week, _ = dt.isocalendar()
            week_key = f"{year}-W{week:02d}"
            
            if week_key not in weekly_stats:
                # Find start of the week (Monday) for the label
                monday = dt - timedelta(days=dt.weekday())
                weekly_stats[week_key] = {
                    "week_key": week_key,
                    "volume": 0,
                    "sessions": 0,
                    "date_label": monday.strftime("%d %b")
                }
            
            weekly_stats[week_key]["volume"] += s.get("total_volume", 0)
            weekly_stats[week_key]["sessions"] += 1
            
        sorted_weeks = sorted(weekly_stats.values(), key=lambda x: x["week_key"])
        data = sorted_weeks[-10:]
        
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"Error fetching weekly stats: {e}")
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
        
        limit_param = request.args.get("limit")
        limit = None
        if limit_param:
            try:
                limit = int(limit_param)
            except ValueError:
                limit = 20
            if limit < 1:
                limit = 20
            if limit > 1000:
                limit = 1000

        # No strict date filtering; return full history unless a limit is provided.
        cursor = db.workout_sessions.find(
            { "user_id": user_id }
        ).sort("created_at", -1)
        if limit is not None:
            cursor = cursor.limit(limit)
        
        sessions = []
        routine_ids = set()
        for s in cursor:
            s["_id"] = str(s["_id"])

            rid = s.get("routine_id")
            if rid:
                routine_ids.add(rid)
                s["routine_id"] = str(rid) # Fix: Convert ObjectId to string for JSON serialization

            # Normalize start time for frontend
            start_dt = s.get("started_at") or s.get("created_at")
            if isinstance(start_dt, datetime):
                s["start_time"] = start_dt.isoformat()
            elif isinstance(start_dt, str):
                s["start_time"] = start_dt

            sessions.append(s)

        routine_map = {}
        if routine_ids:
            routine_obj_ids = []
            routine_str_ids = set()
            for rid in routine_ids:
                if isinstance(rid, ObjectId):
                    routine_obj_ids.append(rid)
                    routine_str_ids.add(str(rid))
                elif ObjectId.is_valid(str(rid)):
                    routine_obj_ids.append(ObjectId(str(rid)))
                    routine_str_ids.add(str(rid))

            if routine_obj_ids:
                for r in db.routines.find({"_id": {"$in": routine_obj_ids}}, {"name": 1}):
                    routine_map[str(r["_id"])] = r.get("name")

        for s in sessions:
            rid = s.get("routine_id")
            rid_key = str(rid) if rid is not None else ""
            s["routine_name"] = routine_map.get(rid_key)
            
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
        restored_state = None
        
        if user_id:
             u = db.users.find_one({"user_id": user_id})
             if u:
                 user_name = u.get("name") or u.get("username")
                 
             # Check for active session to restore
             active_session = db.active_workout_sessions.find_one({
                 "user_id": user_id, 
                 "routine_id": str(routine_id)
             })
             
             if active_session:
                 # Convert ObjectId if needed and prepare state
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

@workout_bp.post("/api/session/start")
def api_start_session_endpoint():
    """
    Explicitly starts a session: Sets the lock and creates a temp record.
    """
    try:
        user_id = request.cookies.get("user_session")
        if not user_id: return jsonify({"error": "Unauthorized"}), 401
        
        data = request.json
        routine_id = data.get("routine_id")
        if not routine_id: return jsonify({"error": "Missing routine_id"}), 400
        
        db = get_db()
        
        # 1. Create Active Session Record
        db.active_workout_sessions.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "routine_id": routine_id,
                "started_at": datetime.now().isoformat(),
                "cursor": 0,
                "session_log": [],
                "updated_at": datetime.now()
            }},
            upsert=True
        )
        
        # 2. Lock User
        db.users.update_one(
            {"user_id": user_id},
            {"$set": {"active_routine_id": str(routine_id)}}
        )
        
        return jsonify({"success": True}), 200
    except Exception as e:
        logger.error(f"Error starting session: {e}")
        return jsonify({"error": str(e)}), 500

@workout_bp.post("/api/session/progress")
def api_update_progress():
    """
    Updates the cursor and session log of the active session.
    """
    try:
        user_id = request.cookies.get("user_session")
        if not user_id: return jsonify({"error": "Unauthorized"}), 401
        
        data = request.json
        # Expect: routine_id, cursor, session_log
        
        db = get_db()
        db.active_workout_sessions.update_one(
            {"user_id": user_id},
            {"$set": {
                "cursor": data.get("cursor", 0),
                "session_log": data.get("session_log", []),
                "updated_at": datetime.now()
            }}
        )
        return jsonify({"success": True}), 200
    except Exception as e:
        logger.error(f"Error updating progress: {e}")
        return jsonify({"error": str(e)}), 500

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
        rid = data.get("routine_id")
        if rid and ObjectId.is_valid(rid):
            rid = ObjectId(rid)

        started_at = data.get("start_time")
        if isinstance(started_at, str):
            try:
                started_at = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            except:
                pass

        completed_at = data.get("end_time")
        if completed_at and isinstance(completed_at, str):
            try:
                completed_at = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
            except:
                completed_at = datetime.utcnow()
        elif not completed_at:
             completed_at = datetime.utcnow()

        session_doc = {
            "user_id": user_id,
            "routine_id": rid,
            "started_at": started_at,
            "completed_at": completed_at,
            "created_at": datetime.utcnow(),
            "sets": sets,
            "total_volume": round(total_volume, 2),
            "body_weight": 0
        }
        
        res = db.workout_sessions.insert_one(session_doc)
        
        # UNLOCK USER and CLEAR TEMP
        try:
            db.users.update_one(
                {"user_id": user_id},
                {"$unset": {"active_routine_id": ""}}
            )
            db.active_workout_sessions.delete_one({"user_id": user_id})
        except Exception as e:
            logger.error(f"Failed to unlock user after save: {e}")

        return jsonify({"success": True, "id": str(res.inserted_id)}), 200
        
    except Exception as e:
        logger.error(f"Error saving session: {e}")
        return jsonify({"error": str(e)}), 500

@workout_bp.post("/api/session/cancel")
def api_cancel_session():
    """
    Cancels the current workout session (unlocks the user).
    """
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
             return jsonify({"error": "Unauthorized"}), 401
             
        db = get_db()
        if db is None: return jsonify({"error": "DB not ready"}), 503
        
        db.users.update_one(
            {"user_id": user_id},
            {"$unset": {"active_routine_id": ""}}
        )
        db.active_workout_sessions.delete_one({"user_id": user_id})
        
        return jsonify({"success": True, "message": "Workout cancelled"}), 200
    except Exception as e:
        logger.error(f"Error cancelling session: {e}")
        return jsonify({"error": str(e)}), 500
