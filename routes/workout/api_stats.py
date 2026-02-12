from flask import request, jsonify
from datetime import datetime, timedelta
from extensions import logger
from .utils import get_db
from utils.validation_decorator import validate_request
from schemas.stats_schemas import SaveRMRecordRequest, SaveAdherenceConfigRequest

@validate_request(SaveRMRecordRequest)
def api_save_rm_record():
    """Guarda un registro de 1RM para el usuario autenticado."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        data = request.validated_data
        weight = data.weight
        reps = data.reps
        exercise = data.exercise.strip()
        date = data.date
        one_rm = data.one_rm
        unit = data.unit.strip()
        formulas = data.formulas

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
        target_frequency = pref.get("target_frequency")

        # Smart Inheritance: If not set, try to get from Onboarding
        if target_frequency is None:
            try:
                onboarding = db.onboarding_submissions.find_one(
                    {"user_id": user_id}, 
                    sort=[("submission_date", -1)]
                )
                if onboarding and "data" in onboarding:
                    days = onboarding["data"].get("days_available")
                    if days:
                        target_frequency = int(days)
                        # Auto-generate preference record
                        db.user_preferences.update_one(
                            {"user_id": user_id},
                            {"$set": {"target_frequency": target_frequency}},
                            upsert=True
                        )
                        logger.info(f"Lazy-synced adherence target for {user_id} from onboarding")
            except Exception as e:
                logger.warning(f"Failed to inherit adherence target: {e}")

        # Fallback default
        if target_frequency is None:
            target_frequency = 3

        return jsonify({"target_frequency": target_frequency}), 200
    except Exception as e:
        logger.error(f"Error loading adherence config: {e}")
        return jsonify({"error": "Internal Error"}), 500

@validate_request(SaveAdherenceConfigRequest)
def api_save_adherence_config():
    """Guarda la configuración de adherencia del usuario (frecuencia objetivo)."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        data = request.validated_data
        target_frequency = data.target_frequency

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
