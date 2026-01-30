from flask import request, jsonify
from bson import ObjectId
from datetime import datetime
from extensions import logger
from .utils import get_db

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
                "unit": data.get("unit", "lb"),
                "updated_at": datetime.now()
            }}
        )
        return jsonify({"success": True}), 200
    except Exception as e:
        logger.error(f"Error updating progress: {e}")
        return jsonify({"error": str(e)}), 500

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
            
            # Cancel any pending push notifications (like idle reminders)
            try:
                from routes.push import cancel_user_pushes
                cancel_user_pushes(user_id)
            except ImportError:
                 pass
            except Exception as e:
                 logger.warning(f"Error cancelling pushes on save: {e}")
                 
        except Exception as e:
            logger.error(f"Failed to unlock user after save: {e}")

        return jsonify({"success": True, "id": str(res.inserted_id)}), 200
        
    except Exception as e:
        logger.error(f"Error saving session: {e}")
        return jsonify({"error": str(e)}), 500

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
        
        # Cancel any pending push notifications
        try:
            from routes.push import cancel_user_pushes
            cancel_user_pushes(user_id)
        except Exception as e:
            logger.warning(f"Error cancelling pushes on cancel: {e}")
        
        return jsonify({"success": True, "message": "Workout cancelled"}), 200
    except Exception as e:
        logger.error(f"Error cancelling session: {e}")
        return jsonify({"error": str(e)}), 500
