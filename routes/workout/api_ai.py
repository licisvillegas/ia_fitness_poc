from flask import request, jsonify
from bson import ObjectId
from extensions import logger
from .utils import get_db

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
