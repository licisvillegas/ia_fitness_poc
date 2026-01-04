"""
Blueprint de Smart Workout
Maneja dashboard, runner, sesiones y estadísticas de entrenamiento
"""
from flask import Blueprint, request, jsonify, render_template
from bson import ObjectId
from datetime import datetime
import extensions
from extensions import logger

# Crear blueprint
workout_bp = Blueprint('workout', __name__, url_prefix='/workout')

# Helper para obtener la DB inicializada (evita capturar None en import)
def get_db():
    return extensions.db

# ======================================================
# RUTAS DE VISTAS
# ======================================================

@workout_bp.route("/dashboard")
def view_workout_dashboard():
    """Dashboard principal del modulo de Smart Workout."""
    user_id = request.cookies.get("user_session")
    db = get_db()
    
    # Check Admin for User Selector
    is_admin = False
    all_users = []
    if user_id and db is not None:
        try:
            role_doc = db.user_roles.find_one({"user_id": user_id})
            if role_doc and role_doc.get("role") == "admin":
                is_admin = True
                users_cursor = db.users.find({}, {"user_id": 1, "name": 1, "username": 1}).sort("name", 1)
                all_users = []
                for u in users_cursor:
                    all_users.append({
                        "user_id": u.get("user_id"),
                        "name": u.get("name") or u.get("username") or "Usuario"
                    })
        except Exception as e:
            logger.error(f"Error loading users for dashboard: {e}")
            pass

    return render_template("workout_dashboard.html", current_user_id=user_id, is_admin=is_admin, all_users=all_users)


@workout_bp.route("/run/<routine_id>")
def view_workout_run(routine_id):
    """Renderiza el Player de Entrenamiento (React)."""
    user_name = None
    user_id = None
    db = get_db()
    try:
        user_id = request.cookies.get("user_session")
        if user_id and db is not None:
            user_doc = db.users.find_one({"user_id": user_id}, {"name": 1, "username": 1})
            if user_doc:
                user_name = user_doc.get("name") or user_doc.get("username")
    except Exception:
        user_name = None
    
    # 1. DEMO MODE
    if routine_id == "demo":
        routine_data = {
            "id": "demo_1",
            "name": "Rutina Demo: Pectoral & Triceps",
            "items": [
                {
                    "item_type": "exercise",
                    "exercise_id": "bench_press",
                    "name": "Press de Banca",
                    "body_part": "Pecho",
                    "sets": 3,
                    "reps": "8-10",
                    "weight": 80,
                    "rest": 90,
                    "target_reps": "8-10"
                },
                {
                    "item_type": "group",
                    "name": "Superserie: Bombeo",
                    "items": [
                        {
                            "exercise_id": "cable_fly",
                            "name": "Cruce de Poleas",
                            "body_part": "Pecho",
                            "sets": 3,
                            "reps": "15",
                            "rest": 0,
                             "target_reps": "15"
                        },
                        {
                            "exercise_id": "pushup",
                            "name": "Flexiones",
                            "body_part": "Pecho",
                            "sets": 3,
                            "reps": "Fallo",
                            "rest": 60,
                             "target_reps": "Fallo"
                        }
                    ]
                },
                {
                    "item_type": "exercise",
                    "exercise_id": "plank",
                    "name": "Plancha Abdominal",
                    "exercise_type": "time",
                    "body_part": "Core",
                    "sets": 3,
                    "time_seconds": 45,
                    "rest": 60
                }
            ]
        }
        return render_template("workout_runner.html", routine=routine_data, current_user_name=user_name, current_user_id=user_id)

    # 2. DB LOOKUP
    try:
        # Fallback Mock for dev persistence (since DB schema might vary)
        routine_data = {
            "id": routine_id,
            "name": f"Rutina Persistida {routine_id}",
            "items": []
        }

        def normalize_item(item, fallback_key):
            if not isinstance(item, dict):
                return None
            if "item_type" not in item:
                if isinstance(item.get("items"), list):
                    item["item_type"] = "group"
                elif item.get("rest_seconds") is not None or (item.get("exercise_id") is None and item.get("rest") is not None):
                    item["item_type"] = "rest"
                else:
                    item["item_type"] = "exercise"
            if item["item_type"] == "group":
                item["_id"] = item.get("_id") or item.get("id") or f"group_{fallback_key}"
                child_items = item.get("items")
                if isinstance(child_items, list):
                    normalized_children = []
                    for idx, child in enumerate(child_items):
                        normalized = normalize_item(child, f"{fallback_key}_{idx}")
                        if normalized:
                            normalized_children.append(normalized)
                    item["items"] = normalized_children
            return item

        def normalize_routine_items(items):
            if not isinstance(items, list):
                return []
            normalized = []
            for idx, item in enumerate(items):
                normalized_item = normalize_item(item, idx)
                if normalized_item:
                    normalized.append(normalized_item)
            return normalized

        if db is not None:
            try:
                if ObjectId.is_valid(routine_id):
                    r = db.routines.find_one({"_id": ObjectId(routine_id)})
                else:
                    r = db.routines.find_one({"routine_id": routine_id})
                if r:
                    # Adapt DB schema to UI needs if necessary
                    def _json_safe(value):
                        if isinstance(value, ObjectId):
                            return str(value)
                        if isinstance(value, dict):
                            return {k: _json_safe(v) for k, v in value.items()}
                        if isinstance(value, list):
                            return [_json_safe(v) for v in value]
                        return value

                    r["id"] = str(r["_id"])
                    routine_data = _json_safe(r)
                    routine_data["items"] = normalize_routine_items(routine_data.get("items"))
                if not routine_data.get("items") and isinstance(routine_data.get("exercises"), list):
                    routine_data["items"] = normalize_routine_items(routine_data.get("exercises"))
            except Exception:
                pass

    except Exception as e:
        logger.error(f"Error loading routine {routine_id}: {e}")
        return str(e), 500

    return render_template("workout_runner.html", routine=routine_data, current_user_name=user_name, current_user_id=user_id)


# ======================================================
# API ENDPOINTS - SESIONES
# ======================================================

@workout_bp.route("/api/session/save", methods=["POST"])
def api_save_session():
    """Guarda un workout completado."""
    try:
        db = get_db()
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401
        data = request.get_json()
        
        # Data validation minimal
        session_doc = {
            "user_id": user_id,
            "routine_id": data.get("routine_id"), 
            "start_time": data.get("start_time"), # ISO Date expected
            "end_time": data.get("end_time"),
            "body_weight": data.get("body_weight"),
            "total_volume": data.get("total_volume", 0),
            "sets": data.get("sets", []), # Array of workout_sets
            "created_at": datetime.utcnow()
        }
        db.workout_sessions.insert_one(session_doc)
        return jsonify({"message": "Sesion guardada"}), 200
    except Exception as e:
        logger.error(f"Error saving session: {e}")
        return jsonify({"error": str(e)}), 500






@workout_bp.get("/api/routines")
def list_routines():
    """
    Retorna lista de rutinas.
    - Si user_id es enviado: Retorna rutinas ASIGNADAS a ese usuario.
    - Si type='template' o no user_id: Retorna TODAS las rutinas (templates).
    """
    user_id = request.args.get("user_id")
    req_type = request.args.get("type")
    
    db = get_db()
    if db is None:
        return jsonify({"error": "DB not ready"}), 503
        
    try:
        results = []
        
        # CASO 1: Listar Templates (todas las rutinas del sistema)
        # Se asume que ahora las rutinas en db.routines son "templates"
        if req_type == 'template' or not user_id:
            cursor = db.routines.find({}).sort("created_at", -1)
            for r in cursor:
                r["_id"] = str(r["_id"])
                results.append(r)
            return jsonify(results), 200
            
        # CASO 2: Listar Rutinas Asignadas a Usuario
        # 1. Buscar en routine_assignments
        assignments = list(db.routine_assignments.find({"user_id": user_id, "active": True}))
        
        if not assignments:
            # RETROCOMPATIBILIDAD: Buscar si hay rutinas legacy con user_id directo
            legacy_cursor = db.routines.find({"user_id": user_id})
            for r in legacy_cursor:
                r["_id"] = str(r["_id"])
                r["is_legacy"] = True # Flag debug
                results.append(r)
            return jsonify(results), 200
            
        # 2. Obtener IDs de rutinas
        routine_ids_str = [asn["routine_id"] for asn in assignments]
        # Convertir a ObjectId si es necesario (el frontend manda strings, en db a veces son str o objid)
        # Intentamos ambos por consistencia laxa
        obj_ids = []
        str_ids = []
        for rid in routine_ids_str:
            if ObjectId.is_valid(rid):
                obj_ids.append(ObjectId(rid))
            str_ids.append(rid)
            
        # 3. Fetch rutinas reales
        # $in busca en ambos formatos
        query = {"$or": [
            {"_id": {"$in": obj_ids}},
            {"_id": {"$in": str_ids}}, # Si se guardó como string en _id (raro pero posible)
            {"routine_id": {"$in": str_ids}} # Si usa id custom
        ]}
        
        routines_cursor = db.routines.find(query)
        
        for r in routines_cursor:
            r["_id"] = str(r["_id"])
            # Añadir fecha de asignación si se quiere
            # (opcional cruzar datos)
            results.append(r)
            
        return jsonify(results), 200

    except Exception as e:
        logger.error(f"Error fetching routines: {e}")
        return jsonify({"error": "Internal Error"}), 500


@workout_bp.route("/api/sessions", methods=["GET"])
def api_get_workout_sessions():
    """Lista sesiones recientes de entrenamiento."""
    try:
        db = get_db()
        user_id = request.cookies.get("user_session")
        if not user_id:
            user_id = request.args.get("user_id")
        if not user_id or db is None:
            return jsonify([])

        cursor = db.workout_sessions.find(
            {"user_id": user_id}
        ).sort("created_at", -1).limit(20)

        sessions = []
        for doc in cursor:
            routine_id = doc.get("routine_id")
            routine_id_str = None
            if routine_id is not None:
                routine_id_str = str(routine_id)
            routine_name = None
            try:
                if routine_id_str and ObjectId.is_valid(routine_id_str):
                    routine_doc = db.routines.find_one({"_id": ObjectId(routine_id_str)}, {"name": 1})
                    if routine_doc:
                        routine_name = routine_doc.get("name")
            except Exception:
                routine_name = None

            created_at = doc.get("created_at")
            if isinstance(created_at, datetime):
                created_at = created_at.isoformat()
            start_time = doc.get("start_time")
            end_time = doc.get("end_time")
            if isinstance(start_time, datetime):
                start_time = start_time.isoformat()
            if isinstance(end_time, datetime):
                end_time = end_time.isoformat()
            duration_seconds = None
            if start_time and end_time:
                try:
                    duration_seconds = int((datetime.fromisoformat(end_time) - datetime.fromisoformat(start_time)).total_seconds())
                except Exception:
                    duration_seconds = None

            sessions.append({
                "id": str(doc.get("_id")) if doc.get("_id") else None,
                "user_id": doc.get("user_id"),
                "routine_id": routine_id_str or routine_id,
                "routine_name": routine_name,
                "created_at": created_at,
                "start_time": start_time,
                "end_time": end_time,
                "duration_seconds": duration_seconds,
                "total_volume": doc.get("total_volume", 0),
                "body_weight": doc.get("body_weight"),
                "sets": doc.get("sets", []),
            })

        return jsonify(sessions), 200
    except Exception as e:
        logger.error(f"Error getting workout sessions: {e}")
        return jsonify([])


@workout_bp.route("/api/history/exercise/<exercise_id>")
def api_get_exercise_history(exercise_id):
    """Obtiene el ultimo historial (pesos/reps) de este ejercicio para auto-fill."""
    try:
        db = get_db()
        user_id = request.cookies.get("user_session")
        if not user_id: return jsonify([])

        # Pipeline: Filter by user -> Unwind sets -> Filter by exercise -> Sort date desc -> Limit
        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$unwind": "$sets"},
            {"$match": {"sets.exercise_id": exercise_id}},
            {"$sort": {"created_at": -1}},
            {"$limit": 5},
            {"$project": {
                "weight": "$sets.weight", 
                "reps": "$sets.reps", 
                "time": "$sets.time_seconds",
                "time_seconds": "$sets.time_seconds", 
                "rpe": "$sets.rpe", 
                "date": "$created_at"
            }}
        ]
        history = list(db.workout_sessions.aggregate(pipeline))
        # Serialize date
        for h in history:
            if "_id" in h: del h["_id"]
            if "date" in h and isinstance(h["date"], datetime):
                h["date"] = h["date"].isoformat()

        return jsonify(history), 200
    except Exception as e:
        logger.error(f"Error history: {e}")
        return jsonify({"error": str(e)}), 500


# ======================================================
# API ENDPOINTS - ESTADÍSTICAS
# ======================================================

@workout_bp.route("/api/stats/heatmap", methods=["GET"])
def api_get_heatmap():
    """Devuelve la frecuencia de entrenamientos del ultimo anio (Heatmap data)."""
    try:
        db = get_db()
        user_id = request.cookies.get("user_session")
        if not user_id:
            user_id = request.args.get("user_id")
        
        if not user_id: return jsonify({})

        # Get timezone from query param, default to UTC
        tz = request.args.get("timezone", "UTC")
        
        # Aggregation: Group by Date (YYYY-MM-DD) -> Count sessions/volume
        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$project": {
                # Ensure created_at is treated as Date (handles strings/dates)
                "dateStr": {"$dateToString": {"format": "%Y-%m-%d", "date": {"$toDate": "$created_at"}, "timezone": tz}}
            }},
            {"$group": {"_id": "$dateStr", "count": {"$sum": 1}}}
        ]
        
        # Debug log
        logger.info(f"Heatmap req for {user_id}, tz={tz}")
        
        data = list(db.workout_sessions.aggregate(pipeline))
        # Format: {"2025-01-01": 1, "2025-01-03": 2}
        result = {item["_id"]: item["count"] for item in data}
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error heatmap: {e}")
        return jsonify({}), 500


@workout_bp.route("/api/stats/volume", methods=["GET"])
def api_get_volume_stats():
    """Devuelve historial de volumen total y peso corporal."""
    try:
        db = get_db()
        user_id = request.cookies.get("user_session")
        if not user_id: 
            user_id = request.args.get("user_id")
            
        if not user_id: return jsonify([])

        # Get sessions sorted by date
        cursor = db.workout_sessions.find(
            {"user_id": user_id},
            {"created_at": 1, "total_volume": 1, "body_weight": 1}
        ).sort("created_at", 1).limit(50)
        
        data = []
        for doc in cursor:
            date_iso = doc["created_at"].strftime("%Y-%m-%d") if isinstance(doc.get("created_at"), datetime) else str(doc.get("created_at"))
            data.append({
                "date": date_iso,
                "volume": doc.get("total_volume", 0),
                "weight": doc.get("body_weight", 0)
            })
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"Error volume stats: {e}")
        return jsonify([]), 500


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
