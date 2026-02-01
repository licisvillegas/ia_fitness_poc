from flask import Blueprint, request, jsonify
from bson import ObjectId
import re
from extensions import logger
from .utils import get_db, _get_body_parts_map

# Definimos las funciones pero no el blueprint en este archivo
# Estas funciones serán importadas y registradas en __init__.py

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
        
        # New Params
        sort_by = request.args.get("sort", "name")
        sort_order = request.args.get("order", "asc")
        filter_incomplete = request.args.get("incomplete") == "true"

        query = {}
        
        # Incomplete Data Filter (Admin Tool)
        if filter_incomplete:
            query["$or"] = [
                {"taxonomy.section_id": {"$in": [None, ""]}},
                {"taxonomy.group_id": {"$in": [None, ""]}},
                {"taxonomy.muscle_id": {"$in": [None, ""]}},
                {"equipment": {"$in": [None, ""]}},
                {"type": {"$in": [None, ""]}},
            ]
        
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
        docs_cursor = db.exercises.find(
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

        
        # Apply Sorting
        mongo_sort_order = 1 if sort_order == "asc" else -1
        
        if sort_by == "newest":
            # Sort by _id (approx timestamp)
            docs_cursor = docs_cursor.sort("_id", -1)
        else:
            # Default to name
            docs_cursor = docs_cursor.sort("name", mongo_sort_order)
            
        docs = list(docs_cursor.skip(skip).limit(limit))

        for d in docs:
            d["_id"] = str(d["_id"])
        return jsonify({"items": docs, "total": total, "page": page, "limit": limit}), 200
    except Exception as e:
        logger.error(f"Error searching exercises: {e}")
        return jsonify({"error": "Error interno"}), 500

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

def api_get_taxonomy():
    """Retorna la jerarquía completa de músculos (Muscle Taxonomy)."""
    try:
        db = get_db()
        from utils.cache import cache_get, cache_set # Import here to avoid circular
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
