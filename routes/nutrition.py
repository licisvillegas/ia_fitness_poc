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
    """Genera un plan diario de comidas usando evaluaciones corporales (TDEE) y plan activo (macros)."""
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
            pass # Ignorar error de parsing

        # Parametros opcionales
        prefs = request.args.get("prefs", "")
        exclude = request.args.get("exclude", "")
        cuisine = request.args.get("cuisine", "")
        notes = request.args.get("notes", "")

        # 1. Intentar buscar evaluacion corporal reciente para TDEE
        assessment = extensions.db.body_assessments.find_one(
            {"user_id": user_id},
            sort=[("created_at", -1)]
        )
        
        assessment_kcal = None
        if assessment and assessment.get("output"):
            ee = assessment["output"].get("energy_expenditure") or {}
            if ee.get("selected_tdee"):
                assessment_kcal = ee.get("selected_tdee")

        # 2. Intentar buscar plan activo para macros (y kcal si falta assessment)
        active = extensions.db.plans.find_one({"user_id": user_id, "active": True}, sort=[("activated_at", -1), ("created_at", -1)])
        
        total_kcal = None
        macros = {}
        plan_id = None

        if active:
            plan_id = str(active.get("_id"))
            np = active.get("nutrition_plan") or {}
            total_kcal = np.get("calories_per_day") or np.get("kcal_obj")
            macros = np.get("macros") or {}
        
        # Prioridad: Assessment TDEE > Plan Kcal
        if assessment_kcal:
            total_kcal = assessment_kcal

        if not total_kcal:
             return jsonify({"error": "No se encontraron objetivos calóricos (ni en Body Assessment ni en Plan activo). Crea una evaluación corporal primero."}), 404

        # Normaliza macros p/c/g a protein/carbs/fat
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
            "plan_id": plan_id,
        }

        agent = MealPlanAgent(model="gpt-4o")
        result = agent.run(context)
        
        log_agent_execution("end", "MealPlanAgent", agent, context, 
            {"endpoint": "/ai/nutrition/plan/<user_id>", "user_id": user_id, "output_keys": list(result.keys()) if isinstance(result, dict) else None})
        
        return jsonify({"backend": agent.backend(), "input": context, "output": result}), 200

    except Exception as e:
        logger.error(f"Error generando : {e}", exc_info=True)
        return jsonify({"error": "Error interno al generar plan de nutrición"}), 500



@nutrition_bp.post("/meal_plans/generate")
def generate_meal_plan():
    """Genera un plan de nutrición AI desde admin y lo guarda."""
    try:
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        
        ok, err = check_admin_access()
        if not ok: return err

        data = request.get_json() or {}
        user_id = normalize_user_id(data.get("user_id"))
        if not user_id:
             return jsonify({"error": "user_id requerido"}), 400

        # Leer parámetros
        meals_val = data.get("meals_per_day")
        try:
            if meals_val is not None:
                meals_val = max(3, min(6, int(meals_val)))
        except: pass
        
        prefs = data.get("preferences", "")
        # Defaults
        exclude = ""
        cuisine = ""
        notes = "Generado desde Admin"

        # --- CONTEXT BUILD (Logic mirrored from ai_nutrition_plan) ---
        # 1. Intentar buscar evaluacion corporal reciente para TDEE
        assessment = extensions.db.body_assessments.find_one(
            {"user_id": user_id},
            sort=[("created_at", -1)]
        )
        
        assessment_kcal = None
        if assessment and assessment.get("output"):
            ee = assessment["output"].get("energy_expenditure") or {}
            if ee.get("selected_tdee"):
                assessment_kcal = ee.get("selected_tdee")

        # 2. Intentar buscar plan activo para macros (y kcal si falta assessment)
        active = extensions.db.plans.find_one({"user_id": user_id, "active": True}, sort=[("activated_at", -1), ("created_at", -1)])
        
        total_kcal = None
        macros = {}
        plan_id = None

        if active:
            plan_id = str(active.get("_id"))
            np = active.get("nutrition_plan") or {}
            total_kcal = np.get("calories_per_day") or np.get("kcal_obj")
            macros = np.get("macros") or {}
        
        # Prioridad: Assessment TDEE > Plan Kcal
        if assessment_kcal:
            total_kcal = assessment_kcal

        if not total_kcal:
             return jsonify({"error": "No se encontraron objetivos calóricos (ni en Body Assessment ni en Plan activo). Crea una evaluación corporal primero."}), 400

        # Normaliza macros p/c/g a protein/carbs/fat
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
            "plan_id": plan_id,
        }
        # -----------------------------------------------------------

        agent = MealPlanAgent(model="gpt-4o")
        result = agent.run(context)
        
        log_agent_execution("end", "MealPlanAgent", agent, context, 
            {"endpoint": "/meal_plans/generate", "user_id": user_id, "output_keys": list(result.keys()) if isinstance(result, dict) else None})
        
        # Save to DB
        doc = {
            "user_id": user_id,
            "plan_id": plan_id,
            "backend": agent.backend(),
            "input": context,
            "output": result,
            "active": False, # Inactive by default so admin can review
            "created_at": datetime.utcnow(),
            "activated_at": None,
            "notes": notes
        }
        res = extensions.db.meal_plans.insert_one(doc)
        doc["_id"] = str(res.inserted_id)

        # Handle dates for JSON
        doc["created_at"] = doc["created_at"].isoformat() + "Z"

        return jsonify({"message": "Plan generado correctamente", "meal_plan": doc}), 201

    except Exception as e:
        logger.error(f"Error generando plan admin: {e}", exc_info=True)
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


@nutrition_bp.put("/meal_plans/<plan_id>")
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
        user_oid = maybe_object_id(user_id)
        if user_oid:
            search_ids.append(user_oid)

        try:
            logger.info(f"Deactivating plans for user_id={user_id} search_ids={search_ids} excluding oid={oid}")
            up_many = extensions.db.meal_plans.update_many(
                {"user_id": {"$in": search_ids}, "_id": {"$ne": oid}}, 
                {"$set": {"active": False}}
            )
            logger.info(f"Deactivated count: {up_many.modified_count}")
        except Exception as e:
            logger.error(f"Error deactivating plans: {e}")
            pass
        
        logger.info(f"Activating plan oid={oid}")
        up_one = extensions.db.meal_plans.update_one({"_id": oid}, {"$set": {"active": True, "activated_at": datetime.utcnow()}})
        logger.info(f"Activated matched={up_one.matched_count} modified={up_one.modified_count}")
        
        # Fetch updated to verify
        updated_doc = extensions.db.meal_plans.find_one({"_id": oid})
        is_active = updated_doc.get("active") if updated_doc else False
        
        return jsonify({"message": f"Meal plan activado (active={is_active})", "meal_plan_id": plan_id, "active": is_active}), 200
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


@nutrition_bp.get("/api/nutrition/find-equivalents")
def find_equivalents():
    """Busca un alimento y devuelve otros del mismo grupo nutricional."""
    try:
        nombre_busqueda = request.args.get("q", "").strip()
        if not nombre_busqueda:
            return jsonify({"error": "Debe proporcionar un nombre de alimento"}), 400
        
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503

        # 1. Buscar matches
        # Usamos un regex más flexible para asegurar coincidencias
        query = {"nombre": {"$regex": f".*{nombre_busqueda}.*", "$options": "i"}}
        
        # Si se pide exacto, buscamos coincidencia exacta (case insensitive)
        is_exact = request.args.get("exact", "false").lower() == "true"
        if is_exact:
            query = {"nombre": {"$regex": f"^{nombre_busqueda}$", "$options": "i"}}

        all_matches = list(extensions.db.alimentos_equivalentes.find(query).limit(20))

        if not all_matches:
            # DEBUG: Intentar obtener una muestra para ver qué hay en la colección
            muestra = list(extensions.db.alimentos_equivalentes.find().limit(5))
            for m in muestra: m["_id"] = str(m["_id"])
            
            logger.warning(f"Alimento no encontrado: '{nombre_busqueda}'. Hay {len(muestra)} ejemplos.")
            return jsonify({
                "error": f"No encontré el alimento '{nombre_busqueda}'",
                "debug_samples": muestra,
                "searched_query": str(query)
            }), 404

        # Si hay múltiples matches y no es exacto, los devolvemos para que el usuario elija
        if len(all_matches) > 1 and not is_exact:
            matches_list = []
            for m in all_matches:
                matches_list.append({
                    "id": str(m["_id"]),
                    "nombre": m.get("nombre"),
                    "grupo": m.get("grupo")
                })
            return jsonify({
                "multiple_matches": True,
                "matches": matches_list
            }), 200

        # Si llegamos aquí, tomamos el primero (o único)
        alimento_base = all_matches[0]
        alimento_base["_id"] = str(alimento_base["_id"])
        grupo = alimento_base.get("grupo")
        
        # 2. Buscar intercambios (mismo grupo, diferente nombre)
        intercambios_cursor = extensions.db.alimentos_equivalentes.find({
            "grupo": grupo,
            "nombre": {"$ne": alimento_base['nombre']}
        }).limit(12)

        intercambios = []
        for doc in intercambios_cursor:
            doc["_id"] = str(doc["_id"])
            intercambios.append(doc)

        return jsonify({
            "alimento_solicitado": alimento_base,
            "opciones_intercambio": intercambios
        }), 200
    except Exception as e:
        logger.error(f"Error buscando equivalentes: {e}", exc_info=True)
        return jsonify({"error": "Error interno al buscar equivalentes"}), 500
