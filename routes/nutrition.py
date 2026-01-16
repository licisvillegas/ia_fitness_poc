from flask import Blueprint, request, jsonify, render_template
from bson import ObjectId
from datetime import datetime
import extensions
from extensions import logger
from utils.auth_helpers import check_admin_access
from utils.db_helpers import log_agent_execution
from ai_agents.meal_plan_agent import MealPlanAgent
from utils.id_helpers import normalize_user_id, maybe_object_id

nutrition_bp = Blueprint('nutrition', __name__)

@nutrition_bp.route("/ai/nutrition/plan/<user_id>", methods=["GET", "POST"])
def ai_nutrition_plan(user_id: str):
    """Genera un plan diario de comidas usando el plan activo (kcal/macros)."""
    try:
        user_id = normalize_user_id(user_id)
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503

        # Leer input (permite GET params en POST para simplicidad)
        meals_raw = request.args.get("meals") or ((request.get_json() or {}).get("meals") if request.is_json else None)
        meals_val = None
        try:
            if meals_raw is not None and str(meals_raw).strip() != "":
                meals_val = max(3, min(6, int(meals_raw)))
        except Exception:
            meals_val = None
        prefs = request.args.get("prefs") or ((request.get_json() or {}).get("prefs") if request.is_json else None)
        exclude = request.args.get("exclude") or ((request.get_json() or {}).get("exclude") if request.is_json else None)
        cuisine = request.args.get("cuisine") or ((request.get_json() or {}).get("cuisine") if request.is_json else None)
        notes = request.args.get("notes") or ((request.get_json() or {}).get("notes") if request.is_json else None)

        active = extensions.db.plans.find_one({"user_id": user_id, "active": True}, sort=[("activated_at", -1), ("created_at", -1)])
        if not active:
            return jsonify({"error": "No hay plan activo para el usuario"}), 404

        np = active.get("nutrition_plan") or {}
        total_kcal = np.get("calories_per_day") or np.get("kcal_obj")
        if not total_kcal:
            return jsonify({"error": "El plan activo no contiene calorías objetivo"}), 400
        macros = np.get("macros") or {}

        # Normaliza macros p/c/g a protein/carbs/fat si vienen del ajuste AI
        macros_norm = {
            "protein": macros.get("protein", macros.get("p")),
            "carbs": macros.get("carbs", macros.get("c")),
            "fat": macros.get("fat", macros.get("g")),
        }

        context = {
            "total_kcal": float(total_kcal),
            "macros": macros_norm,
            "meals": meals_val if meals_val is not None else 4,
            "prefs": prefs,
            "exclude": exclude,
            "cuisine": cuisine,
            "notes": notes,
            "user_id": user_id,
            "plan_id": str(active.get("_id")) if active.get("_id") is not None else None,
        }

        agent = MealPlanAgent()
        log_agent_execution("start", "MealPlanAgent", agent, context, {"endpoint": "/ai/nutrition/plan/<user_id>", "user_id": user_id})
        result = agent.run(context)
        log_agent_execution("end", "MealPlanAgent", agent, context, 
            {"endpoint": "/ai/nutrition/plan/<user_id>", "user_id": user_id, "output_keys": list(result.keys()) if isinstance(result, dict) else None})
        
        return jsonify({"backend": agent.backend(), "input": context, "output": result}), 200
    except Exception as e:
        logger.error(f"Error generando plan de nutrición: {e}", exc_info=True)
        return jsonify({"error": "Error interno al generar plan de nutrición"}), 500


@nutrition_bp.get("/meal_plans/<user_id>/active")
def get_active_meal_plan(user_id: str):
    """Obtiene el plan de nutrición activo del usuario, si existe."""
    try:
        user_id = normalize_user_id(user_id)
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        search_ids = [user_id]
        oid = maybe_object_id(user_id)
        if oid:
            search_ids.append(oid)

        doc = extensions.db.meal_plans.find_one({"user_id": {"$in": search_ids}, "active": True}, sort=[("activated_at", -1), ("created_at", -1)])
        if not doc:
            return jsonify({"error": "Sin plan de nutrición activo"}), 404
        doc["_id"] = str(doc.get("_id")) if doc.get("_id") is not None else None
        c = doc.get("created_at")
        if isinstance(c, datetime):
            doc["created_at"] = c.isoformat() + "Z"
        a = doc.get("activated_at")
        if isinstance(a, datetime):
            doc["activated_at"] = a.isoformat() + "Z"
        return jsonify(doc), 200
    except Exception as e:
        logger.error(f"Error al obtener meal plan activo: {e}", exc_info=True)
        return jsonify({"error": "Error interno al obtener plan de nutrición"}), 500


@nutrition_bp.post("/meal_plans/save")
def save_meal_plan():
    """Guarda y activa un plan de nutrición enviado por el frontend."""
    try:
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        if not request.is_json:
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415
        data = request.get_json() or {}
        user_id = normalize_user_id(data.get("user_id"))
        output = data.get("output") or {}
        input_ctx = data.get("input") or {}
        backend = data.get("backend") or "unknown"
        if not user_id or not isinstance(output, dict):
            return jsonify({"error": "user_id y output son requeridos"}), 400

        try:
            extensions.db.meal_plans.update_many({"user_id": user_id}, {"$set": {"active": False}})
        except Exception:
            pass
        doc = {
            "user_id": user_id,
            "plan_id": input_ctx.get("plan_id"),
            "backend": backend,
            "input": input_ctx,
            "output": output,
            "active": True,
            "created_at": datetime.utcnow(),
            "activated_at": datetime.utcnow(),
        }
        res = extensions.db.meal_plans.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        return jsonify({"message": "Plan de nutrición guardado y activado", "meal_plan": doc}), 201
    except Exception as e:
        logger.error(f"Error al guardar/activar meal plan: {e}", exc_info=True)
        return jsonify({"error": "Error interno al guardar plan de nutrición"}), 500


@nutrition_bp.get("/meal_plans/<user_id>")
def list_meal_plans(user_id: str):
    """Lista meal_plans del usuario (ordenados por fecha desc)."""
    try:
        user_id = normalize_user_id(user_id)
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        raw_limit = request.args.get("limit")
        limit = 20
        if raw_limit:
            try:
                v = int(raw_limit)
                if v > 0: limit = v
            except ValueError:
                pass

        search_ids = [user_id]
        oid = maybe_object_id(user_id)
        if oid:
            search_ids.append(oid)

        cursor = extensions.db.meal_plans.find({"user_id": {"$in": search_ids}}).sort("created_at", -1).limit(limit)
        items = []
        for doc in cursor:
            d = doc.copy()
            d["_id"] = str(d.get("_id"))
            c = d.get("created_at")
            if isinstance(c, datetime):
                d["created_at"] = c.isoformat() + "Z"
            a = d.get("activated_at")
            if isinstance(a, datetime):
                d["activated_at"] = a.isoformat() + "Z"
            items.append(d)
        return jsonify(items), 200
    except Exception as e:
        logger.error(f"Error al listar meal_plans: {e}", exc_info=True)
        return jsonify({"error": "Error interno al listar meal_plans"}), 500


@nutrition_bp.post("/meal_plans/<plan_id>/edit")
def edit_meal_plan(plan_id: str):
    """Actualiza campos permitidos de un meal_plan. Requiere X-Admin-Token."""
    try:
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        ok, err = check_admin_access()
        if not ok: return err
        
        try:
            oid = ObjectId(plan_id)
        except Exception:
            return jsonify({"error": "plan_id invalido"}), 400
        if not request.is_json:
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415

        payload = request.get_json() or {}
        set_fields = {}

        if "notes" in payload:
            notes_val = payload.get("notes")
            if notes_val is None:
                set_fields["notes"] = None
            else:
                set_fields["notes"] = str(notes_val)

        if "output" in payload:
            if payload.get("output") is None:
                set_fields["output"] = None
            elif isinstance(payload.get("output"), dict):
                set_fields["output"] = payload.get("output")
            else:
                return jsonify({"error": "'output' debe ser objeto JSON"}), 400

        if "input" in payload:
            if payload.get("input") is None:
                set_fields["input"] = None
            elif isinstance(payload.get("input"), dict):
                set_fields["input"] = payload.get("input")
            else:
                return jsonify({"error": "'input' debe ser objeto JSON"}), 400

        if "plan_id" in payload:
            plan_val = payload.get("plan_id")
            if plan_val is None:
                set_fields["plan_id"] = None
            else:
                set_fields["plan_id"] = str(plan_val)

        if not set_fields:
            return jsonify({"error": "Sin cambios"}), 400

        extensions.db.meal_plans.update_one({"_id": oid}, {"$set": set_fields})
        doc = extensions.db.meal_plans.find_one({"_id": oid})
        if doc:
            doc["_id"] = str(doc["_id"]) if doc.get("_id") is not None else None
            c = doc.get("created_at")
            if isinstance(c, datetime):
                doc["created_at"] = c.isoformat() + "Z"
            a = doc.get("activated_at")
            if isinstance(a, datetime):
                doc["activated_at"] = a.isoformat() + "Z"
        return jsonify({"message": "Meal plan actualizado", "meal_plan": doc}), 200
    except Exception as e:
        logger.error(f"Error al editar meal_plan: {e}", exc_info=True)
        return jsonify({"error": "Error interno al editar meal_plan"}), 500


@nutrition_bp.post("/meal_plans/<plan_id>/activate")
def activate_meal_plan(plan_id: str):
    """Marca un meal_plan como activo y desactiva el resto del usuario. Requiere admin."""
    try:
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        
        ok, err = check_admin_access()
        if not ok: return err
        try:
            oid = ObjectId(plan_id)
        except Exception:
            return jsonify({"error": "plan_id invalido"}), 400

        mp = extensions.db.meal_plans.find_one({"_id": oid})
        if not mp:
            return jsonify({"error": "Meal plan no encontrado"}), 404
        
        # FIX: Define user_id from the document
        user_id = normalize_user_id(mp.get("user_id"))
        search_ids = [user_id]
        oid = maybe_object_id(user_id)
        if oid:
            search_ids.append(oid)

        try:
            extensions.db.meal_plans.update_many({"user_id": {"$in": search_ids}}, {"$set": {"active": False}})
        except Exception:
            pass
        extensions.db.meal_plans.update_one({"_id": oid}, {"$set": {"active": True, "activated_at": datetime.utcnow()}})
        return jsonify({"message": "Meal plan activado", "meal_plan_id": plan_id}), 200
    except Exception as e:
        logger.error(f"Error al activar meal_plan: {e}", exc_info=True)
        return jsonify({"error": "Error interno al activar meal_plan"}), 500


@nutrition_bp.post("/meal_plans/<plan_id>/deactivate")
def deactivate_meal_plan(plan_id: str):
    """Desactiva un meal_plan. Requiere X-Admin-Token."""
    try:
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        
        ok, err = check_admin_access()
        if not ok: return err
        try:
            oid = ObjectId(plan_id)
        except Exception:
            return jsonify({"error": "plan_id invalido"}), 400
        res = extensions.db.meal_plans.update_one({"_id": oid}, {"$set": {"active": False}})
        if res.matched_count == 0:
            return jsonify({"error": "Meal plan no encontrado"}), 404
        return jsonify({"message": "Meal plan desactivado", "meal_plan_id": plan_id}), 200
    except Exception as e:
        logger.error(f"Error al desactivar meal_plan: {e}", exc_info=True)
        return jsonify({"error": "Error interno al desactivar meal_plan"}), 500


@nutrition_bp.delete("/meal_plans/<plan_id>")
def delete_meal_plan(plan_id: str):
    """Elimina un meal_plan. Requiere X-Admin-Token."""
    try:
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        
        ok, err = check_admin_access()
        if not ok: return err
        try:
            oid = ObjectId(plan_id)
        except Exception:
            return jsonify({"error": "plan_id invalido"}), 400
        res = extensions.db.meal_plans.delete_one({"_id": oid})
        if res.deleted_count == 0:
            return jsonify({"error": "Meal plan no encontrado"}), 404
        return jsonify({"message": "Meal plan eliminado", "meal_plan_id": plan_id}), 200
    except Exception as e:
        logger.error(f"Error al eliminar meal_plan: {e}", exc_info=True)
        return jsonify({"error": "Error interno al eliminar meal_plan"}), 500
