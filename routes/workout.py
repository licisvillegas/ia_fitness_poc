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

# --- SHARED HELPERS ---
def hydrate_routines_with_substitutes(routines, db):
    """
    Recursively finds all substitute/equivalent IDs in a list of routines (or items),
    fetches their details in bulk, and replaces the IDs with populated objects.
    Modifies the routines list in-place.
    """
    if not routines: return

    # Helper to collect IDs
    def collect_ids(items, ids_set):
        for item in items:
            if item.get("item_type") == "group" and "items" in item:
                collect_ids(item["items"], ids_set)
            else:
                subs = item.get("substitutes") or item.get("equivalents") or []
                for s in subs:
                    # Handle both strings and objects with ID
                    sid = None
                    if isinstance(s, dict):
                         sid = s.get("exercise_id") or s.get("_id") or s.get("id") or s.get("$oid")
                    elif isinstance(s, (str, ObjectId)):
                         sid = s
                    
                    if sid: ids_set.add(str(sid))

    # Helper to populate
    def populate(items, lookup_map):
        for item in items:
            if item.get("item_type") == "group" and "items" in item:
                populate(item["items"], lookup_map)
            else:
                subs = item.get("substitutes") or item.get("equivalents") or []
                if not subs: continue
                
                new_subs = []
                for s in subs:
                    sid = None
                    if isinstance(s, dict):
                         sid = s.get("exercise_id") or s.get("_id") or s.get("id") or s.get("$oid")
                    elif isinstance(s, (str, ObjectId)):
                         sid = str(s)
                    
                    if sid and str(sid) in lookup_map:
                        new_subs.append(lookup_map[str(sid)])
                    elif sid:
                         # Keep placeholder with error marker
                         new_subs.append({
                            "_id": str(sid), 
                            "name": f"No encontrado ({str(sid)[-6:]})", 
                            "body_part": "Desconocido", 
                            "equipment": "other",
                            "_is_missing": True
                        })
                
                if new_subs:
                    item["substitutes"] = new_subs

    # 1. Collect all Unique IDs across ALL routines
    all_ids = set()
    for r in routines:
        if "items" in r:
            collect_ids(r["items"], all_ids)
            
    # 2. Bulk Fetch
    if not all_ids: return

    found_map = {}
    query_ids = []
    for i in all_ids:
        if ObjectId.is_valid(i): query_ids.append(ObjectId(i))
        else: query_ids.append(i)
        
    cursor = db.exercises.find({"_id": {"$in": query_ids}})
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        found_map[doc["_id"]] = doc
        
    # 3. Apply changes
    for r in routines:
        if "items" in r:
            populate(r["items"], found_map)


@workout_bp.route("/dashboard")
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

@workout_bp.route("/exercises")
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

@workout_bp.route("/exercises/unified")
def exercises_unified_page():
    """Alias heredado para la vista unificada."""
    return exercises_page()

@workout_bp.route("/rm-calculator")
def rm_calculator_page():
    """Renderiza la calculadora de 1RM."""
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
                    "body_part_key": 1,
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

@workout_bp.get("/api/exercises/<exercise_id>")
def api_get_exercise_details(exercise_id):
    """Fetch a single exercise with fully populated substitutes."""
    db = get_db()
    if db is None:
        return jsonify({"error": "DB not ready"}), 503
    try:
        query = {}
        if ObjectId.is_valid(exercise_id):
            query = {"$or": [{"_id": ObjectId(exercise_id)}, {"exercise_id": exercise_id}]}
        else:
            query = {"exercise_id": exercise_id}
            
        ex = db.exercises.find_one(query)
        
        if not ex:
            # Fallback: try searching by string _id just in case
            ex = db.exercises.find_one({"_id": exercise_id})
            
        if not ex:
            return jsonify({"error": "Exercise not found"}), 404
        
        ex["_id"] = str(ex["_id"])
        
        # Populate substitutes
        raw_subs = ex.get("substitutes", [])
        populated_subs = []
        
        if raw_subs:
            # 1. Resolve all valid ObjectIds
            target_ids = []
            original_id_map = [] # Keep track of order and raw ID
            
            for s in raw_subs:
                sid = None
                if isinstance(s, dict):
                    sid = s.get("exercise_id") or s.get("_id") or s.get("id") or s.get("$oid") or s.get("oid")
                elif isinstance(s, (str, ObjectId)):
                    sid = s
                
                if sid:
                    original_id_map.append(str(sid))
                    try:
                        target_ids.append(ObjectId(sid))
                    except:
                        pass
                else:
                    original_id_map.append(None)

            # 2. Fetch found documents
            found_docs = {}
            if target_ids:
                cursor = db.exercises.find({"_id": {"$in": target_ids}})
                for doc in cursor:
                    doc["_id"] = str(doc["_id"])
                    found_docs[doc["_id"]] = doc
            
            # 3. Reconstruct list preserving order and handling missing
            for raw_id_str in original_id_map:
                if raw_id_str and raw_id_str in found_docs:
                    populated_subs.append(found_docs[raw_id_str])
                elif raw_id_str:
                    # Placeholder for missing/deleted exercise
                    populated_subs.append({
                        "_id": raw_id_str, 
                        "name": f"Ejercicio no encontrado ({raw_id_str[-6:]})", 
                        "body_part": "Desconocido",
                        "equipment": "other",
                        "_is_missing": True
                    })
            
        ex["populated_substitutes"] = populated_subs
        return jsonify(ex), 200
    except Exception as e:
        logger.error(f"Error fetching exercise details: {e}")
        return jsonify({"error": "Internal Error"}), 500


@workout_bp.get("/api/exercises/search")
def api_search_exercises():
    """Busca ejercicios con paginación para el catálogo de usuario."""
    db = get_db()
    if db is None:
        return jsonify({"error": "DB not ready"}), 503
    try:
        limit = int(request.args.get("limit", 50))
        page = int(request.args.get("page", 1))
        if limit < 1:
            limit = 50
        if limit > 1000:
            limit = 1000
        if page < 1:
            page = 1
        skip = (page - 1) * limit

        term = (request.args.get("q") or "").strip()
        body_part = (request.args.get("body_part") or "").strip()
        equipment = (request.args.get("equipment") or "").strip()
        ex_type = (request.args.get("type") or "").strip()

        query = {}
        if body_part:
            query["$or"] = [
                {"body_part": body_part},
                {"body_part_key": body_part}
            ]

        if equipment:
            escaped_equipment = re.escape(equipment)
            query["equipment"] = {"$regex": f"^{escaped_equipment}$", "$options": "i"}

        if ex_type:
            escaped_type = re.escape(ex_type)
            query["type"] = {"$regex": f"^{escaped_type}$", "$options": "i"}
            
        # Taxonomy Filters (Hierarchical)
        section_id = request.args.get("section")
        group_id = request.args.get("group")
        muscle_id = request.args.get("muscle")
        
        if section_id: query["taxonomy.section_id"] = section_id
        if group_id: query["taxonomy.group_id"] = group_id
        if muscle_id: query["taxonomy.muscle_id"] = muscle_id

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
                    "body_part_key": 1,
                    "taxonomy": 1,
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
    """Guarda un registro de 1RM para el usuario autenticado."""
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
    API pública para filtrar ejercicios por grupos musculares (separados por coma).
    Parámetros de consulta:
    - muscles: "Pecho,Tríceps" o "all"
    - q: término de búsqueda (opcional)
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
            # Query against standardized key OR legacy field for robustness
            query["$or"] = [
                {"body_part_key": {"$in": list(resolved_parts)}},
                {"body_part": {"$in": list(resolved_parts)}}
            ]

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
            "exercise_id": 1, "name": 1, "body_part": 1, "body_part_key": 1, "taxonomy": 1,
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

@workout_bp.get("/api/taxonomy")
def api_get_taxonomy():
    """Retorna la jerarquía completa de músculos (Muscle Taxonomy)."""
    try:
        db = get_db()
        cache_key = "muscle_taxonomy_tree"
        cached = cache_get(cache_key)
        if cached: return jsonify(cached), 200
        
        # Fetch all groups
        taxonomy_docs = list(db.muscle_taxonomy.find({}).sort("name", 1))
        
        # Organize by Section -> Group
        sections = {}
        for doc in taxonomy_docs:
            sect_id = doc["section"]["id"]
            sect_name = doc["section"]["name"]
            
            if sect_id not in sections:
                sections[sect_id] = {
                    "id": sect_id,
                    "name": sect_name,
                    "groups": []
                }
            
            sections[sect_id]["groups"].append({
                "id": doc["_id"],
                "name": doc["name"],
                "muscles": doc["muscles"]
            })
            
        tree = list(sections.values())
        cache_set(cache_key, tree, 3600) # Cache for 1 hour
        return jsonify(tree), 200
    except Exception as e:
        logger.error(f"Error fetching taxonomy: {e}")
        return jsonify({"error": str(e)}), 500

@workout_bp.get("/api/exercises/metadata")
def api_get_exercise_metadata():
    """Devuelve equipamiento y tipos distintos de la base de datos para filtrado dinámico."""
    try:
        db = get_db()
        # MongoDB distinct handles arrays automatically for equipment
        equipment = db.exercises.distinct("equipment")
        types = db.exercises.distinct("type")
        
        # Clean up data: filter None/Empty, sort
        clean_equipment = sorted([str(e).lower().strip() for e in equipment if e])
        clean_types = sorted([str(t).lower().strip() for t in types if t])
        
        # Unique after normalization
        clean_equipment = sorted(list(set(clean_equipment)))
        clean_types = sorted(list(set(clean_types)))
        
        return jsonify({
            "equipment": clean_equipment,
            "types": clean_types
        }), 200
    except Exception as e:
        logger.error(f"Error fetching metadata: {e}")
        return jsonify({"error": str(e)}), 500
@workout_bp.get("/api/stats/heatmap")
def api_stats_heatmap():
    """Devuelve el mapa de frecuencia de entrenamientos del usuario (último año)."""
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
        # Robust Logic: Use Aggregation to count by date at DB level
        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$project": {
                "dateStr": {
                    "$cond": {
                        "if": {"$eq": [{"$type": "$completed_at"}, "date"]},
                        "then": {"$dateToString": {"format": "%Y-%m-%d", "date": "$completed_at"}},
                        "else": {"$substr": ["$completed_at", 0, 10]}
                    }
                }
            }},
            {"$group": {"_id": "$dateStr", "count": {"$sum": 1}}}
        ]
        
        results = list(db.workout_sessions.aggregate(pipeline))
        heatmap_data = {r["_id"]: r["count"] for r in results if r["_id"]}
        
        return jsonify(heatmap_data), 200
        
    except Exception as e:
        logger.error(f"Error yielding heatmap: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.get("/api/routines")
def api_get_user_routines():
    """Devuelve las rutinas asignadas al usuario."""
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
                if "items" not in r: r["items"] = []
                r["assigned_expires_at"] = assignment_map.get(r["_id"])
                routines.append(r)
        
        # Hydrate substitutes for robust display
        if routines:
            hydrate_routines_with_substitutes(routines, db)

        
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
    """Renderiza el dashboard de adherencia."""
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
            
        # Hydrate substitutes for robust display
        if results:
            hydrate_routines_with_substitutes(results, db)
            
        return jsonify(results), 200
    except Exception as e:
        logger.error(f"Error listing user routines: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.get("/api/adherence/config")
def api_get_adherence_config():
    """Devuelve la configuración de adherencia del usuario (frecuencia objetivo)."""
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
    """Guarda la configuración de adherencia del usuario (frecuencia objetivo)."""
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

@workout_bp.post("/api/my-routines/<routine_id>/toggle-dash")
def api_toggle_dashboard_visibility(routine_id):
    """Alterna la visibilidad de la rutina en el dashboard."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id: return jsonify({"error": "Unauthorized"}), 401
        
        if not ObjectId.is_valid(routine_id):
            return jsonify({"error": "ID invalido"}), 400
            
        db = get_db()
        if db is None: return jsonify({"error": "DB not ready"}), 503

        # Toggle logic: find, flip, update
        routine = db.routines.find_one({"_id": ObjectId(routine_id), "user_id": user_id})
        if not routine:
             return jsonify({"error": "Rutina no encontrada o no autorizada"}), 404
             
        new_val = not routine.get("is_active", True)
        
        db.routines.update_one(
            {"_id": ObjectId(routine_id)},
            {"$set": {"is_active": new_val, "updated_at": datetime.utcnow()}}
        )
        
        return jsonify({"success": True, "is_active": new_val}), 200
    except Exception as e:
        logger.error(f"Error toggling routine visibility: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.get("/api/stats/volume")
def api_stats_volume():
    """Devuelve el peso promedio por serie agrupado por día."""
    try:
        user_id = request.args.get("user_id")
        if not user_id: return jsonify({"error": "Missing user_id"}), 400
        
        db = get_db()
        if db is None: return jsonify([]), 503
        
        # Optimization: Limit to last 6 months to prevent scanning years of history
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        
        pipeline = [
            {"$match": {
                "user_id": user_id,
                "$or": [
                    {"started_at": {"$gte": six_months_ago}},
                    {"created_at": {"$gte": six_months_ago}}
                ]
            }},
            {"$project": {
                "date": {"$ifNull": ["$started_at", "$created_at"]},
                "sets": 1
            }},
            {"$unwind": "$sets"},
            {"$project": {
                "dateStr": {
                    "$cond": {
                        "if": {"$eq": [{"$type": "$date"}, "date"]},
                        "then": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date"}},
                        "else": {"$substr": ["$date", 0, 10]}
                    }
                },
                "weight": {"$toDouble": "$sets.weight"}
            }},
            {"$match": {"weight": {"$gt": 0}}},
            {"$group": {
                "_id": "$dateStr",
                "avgVolume": {"$avg": "$weight"},
                "count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        results = list(db.workout_sessions.aggregate(pipeline))
        
        data = []
        for r in results:
            if r["_id"]:
                data.append({
                    "date": r["_id"],
                    "volume": round(r["avgVolume"], 2)
                })

        # Return last 30 daily points
        return jsonify(data[-30:]), 200
    except Exception as e:
        logger.error(f"Error fetching volume stats: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.get("/api/ai-routines")
def api_list_ai_routines():
    """Lista las rutinas generadas por AI (solo resumen)."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        # Check access (optional: restrict to admins if desired, but user asked for ?source=admin)
        # For now, we assume if they know the endpoint or are in admin builder, it's fine.
        # But let's check basic auth at least.

        db = get_db()
        if db is None: return jsonify({"error": "DB not ready"}), 503

        # Fetch summarized list
        cursor = db.ai_routines.find({}, {
            "routine_name": 1,
            "name": 1,
            "title": 1,
            "plan_name": 1,
            "meta": 1,
            "level": 1,
            "goal": 1,
            "created_at": 1,
            "days": 1  # To estimate size/complexity and fallback name
        }).sort("created_at", -1).limit(50)

        results = []
        for r in cursor:
            # Synthetic name if missing
            name = (
                r.get("routine_name")
                or r.get("name")
                or r.get("title")
                or r.get("plan_name")
                or (r.get("meta") or {}).get("name")
            )
            if not name and r.get("days"):
                first_day = r.get("days")[0] if isinstance(r.get("days"), list) else None
                name = (first_day or {}).get("routine", {}).get("name")
            if not name:
                name = f"AI Rutina - {r.get('goal', '')}".strip()
                if r.get("level"):
                    name = f"{name} ({r.get('level')})"
            # Description from AI metadata
            desc = f"{r.get('goal', '')} | {r.get('level', '')} | {len(r.get('days', []))} dias"
            
            results.append({
                "_id": str(r["_id"]),
                "name": name,
                "description": desc,
                "created_at": r.get("created_at"),
                "is_active": True, # Virtual status
                "source": "ai"
            })
            
        return jsonify(results), 200
    except Exception as e:
        logger.error(f"Error listing AI routines: {e}")
        return jsonify({"error": "Internal Error"}), 500

@workout_bp.get("/api/ai-routines/<routine_id>")
def api_get_ai_routine_detail(routine_id):
    """Obtiene detalle de una rutina AI y la mapea al formato de builder."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401
            
        if not ObjectId.is_valid(routine_id):
            return jsonify({"error": "ID invalido"}), 400

        db = get_db()
        if db is None: return jsonify({"error": "DB not ready"}), 503

        r = db.ai_routines.find_one({"_id": ObjectId(routine_id)})
        if not r:
            return jsonify({"error": "Rutina AI no encontrada"}), 404

        # Convert to builder format
        # AI routines have 'days' array. Builder works with single day/session routine usually.
        # We will take the FIRST day for now, or merge? 
        # The user request said "editable or duplicated". 
        # Usually builder is single-routine. If AI routine is multi-day, we might need to pick one?
        # Let's check how AI results look. It has `days: [{ day_label, routine: { items: [] } }]`
        
        # Strategy: Flatten the first day or specific day? 
        # Let's take the first day's routine for simplicity, or return the whole object 
        # and let frontend decide? The frontend `normalizeRoutine` expects `items`.
        
        # Helper to recursively convert ObjectIds to strings
        def convert_oids(obj):
            if isinstance(obj, list):
                return [convert_oids(item) for item in obj]
            elif isinstance(obj, dict):
                return {k: convert_oids(v) for k, v in obj.items()}
            elif isinstance(obj, ObjectId):
                return str(obj)
            return obj

        # Determine where the routine data is.
        # It could be in 'days' array (from comprehensive plans) or at root (from quick generator)
        days = r.get("days", [])
        target_routine = r # Default to root
        items = r.get("items", [])
        
        if days and len(days) > 0:
            # If it has days, assume it's a multi-day plan and take the first one
            target_routine = days[0].get("routine", {})
            items = target_routine.get("items", [])

        # Map fields
        builder_routine = {
            "_id": str(r["_id"]),
            "name": r.get("routine_name") or target_routine.get("name") or "Rutina AI",
            "description": f"Generada por AI. {r.get('goal', '')} - {r.get('level', '')}",
            "routine_day": "Monday",
            "items": convert_oids(items),
            "routine_body_parts": r.get("body_parts", []) or r.get("routine_body_parts", []),
            "is_active": True,
            "source": "ai"
        }

        # If multi-day, maybe append a note?
        if len(days) > 1:
            builder_routine["description"] += f" (Parte 1 de {len(days)} dias generados)"

        return jsonify(builder_routine), 200
    except Exception as e:
        logger.error(f"Error getting AI routine detail: {e}")
        return jsonify({"error": "Internal Error"}), 500


@workout_bp.get("/api/stats/weekly")
def api_stats_weekly():
    """Devuelve estadísticas semanales (volumen y consistencia) de las últimas 12 semanas."""
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
        
        
        if "items" not in routine:
            routine["items"] = []
            
        # Hydrate substitutes using shared helper
        hydrate_routines_with_substitutes([routine], db)


        # Ensure items exist (fallback)
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
