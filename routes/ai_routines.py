from flask import Blueprint, request, jsonify, render_template
from bson import ObjectId
import extensions
from extensions import logger
from utils.db_helpers import log_agent_execution
from utils.helpers import normalize_string_list, normalize_equipment_list, normalize_bool, normalize_body_part
from ai_agents.routine_agent import RoutineAgent
from ai_agents.routine_agent_mongo import MongoRoutineAgent
from datetime import datetime
import re



ai_routines_bp = Blueprint("ai_routines", __name__)


@ai_routines_bp.post("/api/generate_routine")
def api_generate_routine():
    try:
        data = request.get_json() or {}
        level = data.get("level", "Intermedio")
        goal = data.get("goal", "Hipertrofia")
        frequency = data.get("frequency", "4 d\u00edas")
        equipment = data.get("equipment", "Gimnasio completo")

        agent = RoutineAgent()
        log_agent_execution("start", "RoutineAgent", agent, data, {"endpoint": "/api/generate_routine"})
        result = agent.run(level, goal, frequency, equipment)
        log_agent_execution("end", "RoutineAgent", agent, data, {"endpoint": "/api/generate_routine"})
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error generando rutina: {e}", exc_info=True)
        return jsonify({"error": "Error interno generando rutina"}), 500


@ai_routines_bp.get("/ai/routine/generator")
def ai_routine_generator_page():
    return render_template("routine_generator.html")


@ai_routines_bp.get("/ai/routine/generator_mongo")
def ai_routine_generator_mongo_page():
    return render_template("routine_generator_mongo.html")


@ai_routines_bp.post("/api/generate_routine_mongo")
def api_generate_routine_mongo():
    try:
        data = request.get_json() or {}
        level = data.get("level", "Intermedio")
        goal = data.get("goal", "Hipertrofia")
        frequency_raw = data.get("frequency", 4)
        equipment = data.get("equipment", "")
        body_parts = data.get("body_parts")
        include_cardio = bool(data.get("include_cardio", False))

        frequency = 4
        if isinstance(frequency_raw, str):
            digits = "".join(ch for ch in frequency_raw if ch.isdigit())
            frequency = int(digits) if digits else 4
        else:
            frequency = int(frequency_raw) if frequency_raw is not None else 4
        if frequency < 1 or frequency > 6:
            return jsonify({"error": "frequency debe estar entre 1 y 6"}), 400

        if body_parts is not None and not isinstance(body_parts, list):
            return jsonify({"error": "body_parts debe ser una lista"}), 400
        if isinstance(body_parts, list):
            body_parts = [str(p).strip() for p in body_parts if str(p).strip()]

        if extensions.db is None:
            return jsonify({"error": "Base de datos no disponible"}), 503

        agent = MongoRoutineAgent(extensions.db)
        result = agent.run(
            level=level,
            goal=goal,
            frequency=frequency,
            equipment=equipment,
            body_parts=body_parts,
            include_cardio=include_cardio,
        )
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error generando rutina mongo: {e}", exc_info=True)
        return jsonify({"error": "Error interno generando rutina"}), 500


@ai_routines_bp.post("/api/save_demo_routine")
def api_save_demo_routine():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No hay datos para guardar"}), 400

        if extensions.db is None:
            return jsonify({"error": "Base de datos no disponible"}), 503

        # Add timestamp
        data["created_at"] = datetime.utcnow()
        
        # Insert into demo_routines collection
        result = extensions.db.demo_routines.insert_one(data)
        
        return jsonify({"message": "Demo guardada", "id": str(result.inserted_id)}), 200
    except Exception as e:
        logger.error(f"Error guardando demo rutina: {e}", exc_info=True)
        return jsonify({"error": "Error interno guardando rutina"}), 500


@ai_routines_bp.post("/api/save_routine_mongo")
def api_save_routine_mongo():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No hay datos para guardar"}), 400

        if extensions.db is None:
            return jsonify({"error": "Base de datos no disponible"}), 503

        items = data.get("items", [])
        if not isinstance(items, list) or not items:
            return jsonify({"error": "La rutina no contiene items"}), 400

        # Validate items structure
        group_ids = set()
        group_usage = {}
        exercise_ids = []
        exercise_count = 0
        for item in items:
            if not isinstance(item, dict):
                return jsonify({"error": "Items invalidos"}), 400
            item_type = item.get("item_type")
            if item_type not in ("group", "exercise", "rest"):
                return jsonify({"error": "item_type invalido"}), 400
            if item_type == "group":
                gid = item.get("_id")
                if not gid:
                    return jsonify({"error": "Grupo sin _id"}), 400
                group_ids.add(gid)
                group_usage[gid] = 0
            elif item_type == "exercise":
                exercise_count += 1
                ex_id = item.get("exercise_id")
                if not ex_id:
                    return jsonify({"error": "Ejercicio sin exercise_id"}), 400
                exercise_ids.append(str(ex_id))
                rest_seconds = item.get("rest_seconds")
                if rest_seconds is not None:
                    try:
                        rest_seconds = int(rest_seconds)
                    except (TypeError, ValueError):
                        return jsonify({"error": "rest_seconds invalido"}), 400
                    if rest_seconds < 30 or rest_seconds > 180:
                        return jsonify({"error": "rest_seconds fuera de rango"}), 400
                gid = item.get("group_id") or ""
                if gid:
                    group_usage[gid] = group_usage.get(gid, 0) + 1
            elif item_type == "rest":
                rest_seconds = item.get("rest_seconds")
                try:
                    rest_seconds = int(rest_seconds)
                except (TypeError, ValueError):
                    return jsonify({"error": "rest_seconds invalido"}), 400
                if rest_seconds < 30 or rest_seconds > 180:
                    return jsonify({"error": "rest_seconds fuera de rango"}), 400
                gid = item.get("group_id") or ""
                if gid:
                    group_usage[gid] = group_usage.get(gid, 0) + 1

        if exercise_count == 0:
            return jsonify({"error": "La rutina no contiene ejercicios"}), 400

        empty_groups = [gid for gid in group_ids if group_usage.get(gid, 0) == 0]
        if empty_groups:
            return jsonify({"error": "Hay grupos vacios"}), 400

        # Validate exercise ids exist
        obj_ids = [ObjectId(eid) for eid in exercise_ids if ObjectId.is_valid(eid)]
        if obj_ids:
            found = extensions.db.exercises.count_documents({"_id": {"$in": obj_ids}})
            if found != len(obj_ids):
                return jsonify({"error": "Ejercicios no encontrados"}), 400

        # Add timestamp
        data["created_at"] = datetime.utcnow()

        # Insert into ai_routines collection
        result = extensions.db.ai_routines.insert_one(data)

        return jsonify({"message": "Rutina guardada", "id": str(result.inserted_id)}), 200
    except Exception as e:
        logger.error(f"Error guardando rutina mongo: {e}", exc_info=True)
        return jsonify({"error": "Error interno guardando rutina"}), 500

@ai_routines_bp.post("/api/check_exercises")
def api_check_exercises():
    try:
        data = request.get_json() or {}
        exercise_names = data.get("names", [])
        if not exercise_names:
            return jsonify({"exercises": []}), 200

        if extensions.db is None:
            return jsonify({"error": "Base de datos no disponible"}), 503

        results = []
        for name in exercise_names:
            clean_name = name.strip()
            # Escape for regex and Case insensitive check, allow optional surrounding whitespace
            escaped_name = re.escape(clean_name)
            ex = extensions.db.exercises.find_one({
                "$or": [
                    {"name": {"$regex": rf"^\s*{escaped_name}\s*$", "$options": "i"}},
                    {"alternative_names": {"$regex": rf"^\s*{escaped_name}\s*$", "$options": "i"}},
                ]
            })
            results.append({
                "name": name,
                "exists": bool(ex),
                "exercise_id": str(ex["_id"]) if ex else None
            })
        
        return jsonify({"exercises": results}), 200
    except Exception as e:
        logger.error(f"Error checking exercises: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500


@ai_routines_bp.post("/api/add_exercises")
def api_add_exercises():
    # Only admins can add exercises to global catalog
    from utils.auth_helpers import check_admin_access
    ok, err = check_admin_access()
    if not ok: return err

    try:
        data = request.get_json() or {}
        exercises_to_add = data.get("exercises", [])
        if not exercises_to_add:
            return jsonify({"message": "Nada que agregar"}), 200

        if extensions.db is None:
            return jsonify({"error": "Base de datos no disponible"}), 503

        added_count = 0
        for item in exercises_to_add:
            name = item.get("name") if isinstance(item, dict) else item
            if not name: continue
            
            clean_name = name.strip()
            escaped_name = re.escape(clean_name)
            # Double check if exists with robust search
            ex = extensions.db.exercises.find_one({"name": {"$regex": rf"^\s*{escaped_name}\s*$", "$options": "i"}})
            if not ex:
                if isinstance(item, dict):
                    alternative_names = normalize_string_list(
                        item.get("alternative_names") or item.get("alternative names")
                    )
                    equipment_list = normalize_equipment_list(item.get("equipment"))
                    pattern = str(item.get("pattern") or "").strip()
                    plane = str(item.get("plane") or "").strip()
                    unilateral = normalize_bool(item.get("unilateral"), default=False)
                    primary_muscle = str(item.get("primary_muscle") or "").strip()
                    level = str(item.get("level") or "").strip()
                else:
                    alternative_names = []
                    equipment_list = []
                    pattern = ""
                    plane = ""
                    unilateral = False
                    primary_muscle = ""
                    level = ""

                if not equipment_list:
                    equipment_list = ["dumbbell"]

                body_part = (
                    normalize_body_part(item.get("body_part", "Other"), extensions.db)
                    if isinstance(item, dict)
                    else normalize_body_part("Other", extensions.db)
                )

                new_ex = {
                    "name": name,
                    "body_part": body_part,
                    "type": "weight",
                    "equipment": equipment_list,
                    "description": item.get("description") if (isinstance(item, dict) and item.get("description")) else "Agregado automaticamente desde IA Generator",
                    "video_url": "",
                    "substitutes": [],
                    "is_custom": False,
                    "alternative_names": alternative_names,
                    "pattern": pattern,
                    "plane": plane,
                    "unilateral": unilateral,
                    "primary_muscle": primary_muscle,
                    "level": level,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                extensions.db.exercises.insert_one(new_ex)
                added_count += 1
        
        return jsonify({"message": f"Se agregaron {added_count} ejercicios"}), 200
    except Exception as e:
        logger.error(f"Error adding exercises: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500

@ai_routines_bp.get("/api/demo_routines")
def api_list_demo_routines():
    try:
        if extensions.db is None:
            return jsonify({"error": "Base de datos no disponible"}), 503

        # List basic info
        cursor = extensions.db.demo_routines.find({}, {
            "routineName": 1, 
            "level": 1, 
            "goal": 1, 
            "created_at": 1
        }).sort("created_at", -1)
        
        routines = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            routines.append(doc)
            
        return jsonify({"routines": routines}), 200
    except Exception as e:
        logger.error(f"Error listing demo routines: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500


@ai_routines_bp.get("/api/demo_routines/<id>")
def api_get_demo_routine(id):
    try:
        if extensions.db is None:
            return jsonify({"error": "Base de datos no disponible"}), 503

        if not ObjectId.is_valid(id):
            return jsonify({"error": "ID invalido"}), 400

        doc = extensions.db.demo_routines.find_one({"_id": ObjectId(id)})
        if not doc:
            return jsonify({"error": "No encontrada"}), 404
            
        doc["_id"] = str(doc["_id"])
        return jsonify(doc), 200
    except Exception as e:
        logger.error(f"Error getting demo routine: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500
