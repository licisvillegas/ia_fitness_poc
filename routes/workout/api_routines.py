from flask import request, jsonify
from bson import ObjectId
from datetime import datetime
from extensions import logger
from utils.routine_utils import normalize_routine_items
from utils.validation_decorator import validate_request
from schemas.routine_schemas import RoutineSaveRequest
from .utils import get_db, hydrate_routines_with_substitutes

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

@validate_request(RoutineSaveRequest)
def api_save_my_routine():
    """Guarda o actualiza una rutina del usuario."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        data_obj = request.validated_data
        db = get_db()
        if db is None: return jsonify({"error": "DB not ready"}), 503

        rid = data_obj.id
        role_doc = db.user_roles.find_one({"user_id": user_id})
        is_admin = role_doc and role_doc.get("role") == "admin"
        admin_template = bool(data_obj.admin_template) and is_admin

        doc = {
            "name": data_obj.name,
            "description": data_obj.description,
            "routine_day": data_obj.routine_day,
            "routine_body_parts": data_obj.routine_body_parts,
            "items": normalize_routine_items(data_obj.items),
            "updated_at": datetime.utcnow(),
        }
        if not admin_template:
            doc["user_id"] = user_id
        if data_obj.is_active is not None:
            doc["is_active"] = data_obj.is_active

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
