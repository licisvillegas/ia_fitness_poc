from flask import Blueprint, request, jsonify, render_template
import os
import base64
from datetime import datetime, timezone
from bson import ObjectId
import cloudinary
import cloudinary.uploader
import cloudinary.api

import extensions
from extensions import logger
from utils.helpers import (
    validate_user_input, fetch_user_progress_for_agent, 
    normalize_measurements, sanitize_photos
)
from utils.db_helpers import log_agent_execution

# Agents
from ai_agents.reasoning_agent import ReasoningAgent
from ai_agents.body_assessment_agent import BodyAssessmentAgent
from ai_agents.routine_agent import RoutineAgent
from agents.reasoning_agent import ReasoningAgent as LegacyReasoningAgent
from ai_agents.meal_plan_agent import MealPlanAgent # Used in diagnostics

# Configuración Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

ai_bp = Blueprint('ai', __name__)

@ai_bp.get("/ai/reason/<user_id>")
def ai_reason_for_user(user_id: str):
    """Ejecuta el agente AI usando el progreso del usuario desde MongoDB."""
    try:
        raw_limit = request.args.get("limit")
        limit = None
        if raw_limit:
            try:
                limit = int(raw_limit)
            except ValueError:
                pass

        context = fetch_user_progress_for_agent(user_id, limit)
        progress = context.get("progress", [])
        if not progress:
            return jsonify({"error": "No hay registros de progreso para este usuario"}), 404
        
        # Enriquecer contexto con datos del usuario/plan activo
        if extensions.db is not None:
            user = extensions.db.users.find_one({"user_id": user_id})
            context["user"] = {"user_id": user_id}
            active_plan = extensions.db.plans.find_one({"user_id": user_id, "active": True})
            if active_plan:
                 context["user"]["goal"] = active_plan.get("goal")
            elif user:
                 context["user"]["goal"] = user.get("goal")

        agent = ReasoningAgent()
        log_agent_execution(
            "start", "ReasoningAgent", agent, context, 
            {"endpoint": "/ai/reason/<user_id>", "user_id": user_id}
        )
        result = agent.run(context)
        log_agent_execution(
            "end", "ReasoningAgent", agent, context,
            {
                "endpoint": "/ai/reason/<user_id>",
                "user_id": user_id,
                "output_keys": list(result.keys()) if isinstance(result, dict) else None,
            },
        )

        try:
            if extensions.db is not None:
                record = {
                    "user_id": user_id,
                    "backend": agent.backend(),
                    "input": context,
                    "output": result,
                    "created_at": datetime.utcnow(),
                }
                res = extensions.db.ai_adjustments.insert_one(record)
                record["_id"] = str(res.inserted_id)
                # Return record as well as per the second implementation
                return jsonify({"output": result, "record": record, "backend": agent.backend(), "input": context}), 200
        except Exception as persist_err:
            logger.warning(f"No se pudo guardar el ajuste AI: {persist_err}")

        return jsonify({
            "backend": agent.backend(),
            "input": context,
            "output": result,
        }), 200
    except Exception as e:
        logger.error(f"Error en ai_reason_for_user({user_id}): {e}", exc_info=True)
        return jsonify({"error": "Error interno al ejecutar el agente con progreso"}), 500

@ai_bp.post("/ai/reason")
def ai_reason_generic():
    try:
        if not request.is_json:
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415
        payload = request.get_json() or {}
        agent = ReasoningAgent()
        log_agent_execution("start", "ReasoningAgent", agent, payload, {"endpoint": "/ai/reason"})
        result = agent.run(payload)
        log_agent_execution(
            "end", "ReasoningAgent", agent, payload,
            {"endpoint": "/ai/reason", "output_keys": list(result.keys()) if isinstance(result, dict) else None},
        )
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error en ai_reason: {e}", exc_info=True)
        return jsonify({"error": "Error interno al ejecutar el agente"}), 500

@ai_bp.get("/ai/adjustments/<user_id>")
def ai_get_adjustments(user_id: str):
    """Devuelve el historial de ajustes AI para un usuario."""
    try:
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        raw_limit = request.args.get("limit")
        limit = 10
        if raw_limit:
            try:
                val = int(raw_limit)
                if val > 0: limit = val
            except ValueError:
                pass

        cursor = extensions.db.ai_adjustments.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
        items = []
        for doc in cursor:
            doc_id = str(doc.get("_id")) if doc.get("_id") is not None else None
            created = doc.get("created_at")
            if isinstance(created, datetime):
                created_str = created.isoformat() + "Z"
            else:
                created_str = str(created) if created is not None else None
            items.append({
                "_id": doc_id,
                "user_id": doc.get("user_id"),
                "backend": doc.get("backend"),
                "input": doc.get("input"),
                "output": doc.get("output"),
                "created_at": created_str,
            })
        return jsonify(items), 200
    except Exception as e:
        logger.error(f"Error listando historial de ajustes AI: {e}", exc_info=True)
        return jsonify({"error": "Error interno listando historial"}), 500

@ai_bp.get("/ai/body_assessment/tester")
def body_assessment_tester():
    return render_template("body_assessment.html")

@ai_bp.get("/ai/body_assessment/user")
def body_assessment_user():
    return render_template("body_assessment_user.html")

@ai_bp.post("/ai/body_assessment")
def ai_body_assessment():
    try:
        images_for_agent = None
        payload = None

        content_type = request.headers.get("Content-Type", "")
        if "multipart/form-data" in content_type.lower():
            payload_str = request.form.get("payload")
            if not payload_str:
                return jsonify({"error": "Falta el campo 'payload' con JSON"}), 400
            try:
                import json as _json
                payload = _json.loads(payload_str)
            except Exception:
                return jsonify({"error": "'payload' no es JSON válido"}), 400

            photos_meta = payload.get("photos") if isinstance(payload, dict) else None
            img_list = []
            if isinstance(photos_meta, list):
                for ph in photos_meta:
                    if not isinstance(ph, dict): continue
                    file_key = ph.get("file_key")
                    if not file_key: continue
                    file_storage = request.files.get(file_key)
                    if not file_storage: continue
                    try:
                        # Leer bytes para base64 (agente)
                        raw = file_storage.read()
                        if not raw: continue
                        
                        # Reset pointer para posible subida o relectura
                        file_storage.seek(0)
                        
                        # 1. Base64 para el Agente (procesamiento inmediato)
                        b64 = base64.b64encode(raw).decode("utf-8")
                        mime = file_storage.mimetype or "image/jpeg"
                        img_list.append({"data": b64, "mime": mime, "view": ph.get("view")})

                        # 2. Subida a Cloudinary (persistencia)
                        # Cloud name requerido para subir
                        if os.getenv("CLOUDINARY_CLOUD_NAME"):
                            try:
                                # Upload toma el file_storage directamente (file-like object)
                                file_storage.seek(0)
                                user_folder_id = payload.get("user_id") or "unknown"
                                date_folder = datetime.now().strftime("%Y%m%d")
                                upload_result = cloudinary.uploader.upload(
                                    file_storage, 
                                    folder=f"ia_fitness/body_assessments/{user_folder_id}/{date_folder}",
                                    resource_type="image"
                                )
                                secure_url = upload_result.get("secure_url")
                                if secure_url:
                                    ph["url"] = secure_url
                            except Exception as cloud_err:
                                logger.error(f"Error subiendo a Cloudinary: {cloud_err}")
                                # No fallamos el request entero, solo no hay URL
                        else:
                            logger.warning("Cloudinary no configurado. No se subirán imágenes.")

                    finally:
                        try: file_storage.close()
                        except: pass
            if img_list:
                images_for_agent = img_list
        else:
            payload = request.get_json(silent=True) or {}

        measurements_raw = (payload or {}).get("measurements")
        if not isinstance(measurements_raw, dict):
            return jsonify({"error": "'measurements' debe ser un objeto con las medidas"}), 400

        measurements = normalize_measurements(measurements_raw)
        context = {
            "user_id": (payload or {}).get("user_id"),
            "sex": ((payload or {}).get("sex") or "male").lower(),
            "age": (payload or {}).get("age"),
            "goal": (payload or {}).get("goal"),
            "activity_level": (payload or {}).get("activity_level"),
            "measurements": measurements,
            "photos": sanitize_photos((payload or {}).get("photos")),
            "notes": (payload or {}).get("notes"),
        }

        agent = BodyAssessmentAgent()
        log_agent_execution("start", "BodyAssessmentAgent", agent, context, {"endpoint": "/ai/body_assessment"})
        result = agent.run(context, images=images_for_agent)
        log_agent_execution("end", "BodyAssessmentAgent", agent, context, {"endpoint": "/ai/body_assessment"})

        try:
            if extensions.db is not None and context.get("user_id"):
                extensions.db.body_assessments.insert_one(
                    {
                        "user_id": context.get("user_id"),
                        "backend": agent.backend(),
                        "input": context,
                        "output": result,
                        "created_at": datetime.utcnow(),
                    }
                )
        except Exception as persist_err:
            logger.warning(f"No se pudo guardar evaluación corporal: {persist_err}")

        return jsonify({"backend": agent.backend(), "input": context, "output": result}), 200
    except Exception as e:
        logger.error(f"Error generando evaluación corporal: {e}", exc_info=True)
        return jsonify({"error": "Error interno al generar evaluación corporal"}), 500

@ai_bp.get("/ai/body_assessment/history/view/<user_id>")
def body_assessment_history_view(user_id):
    user_name = user_id
    try:
        logger.info(f"Viewing history for user_id: {user_id}")
        if extensions.db is not None:
             user = extensions.db.users.find_one({"_id": ObjectId(user_id)})
             if user:
                 user_name = user.get("name") or user.get("username") or user_id
                 logger.info(f"Found user name: {user_name}")
             else:
                 logger.warning("User not found in DB")
    except Exception as e:
        logger.error(f"Error fetching user name: {e}")
        pass
    return render_template("body_assessment_history.html", user_id=user_id, user_name=user_name)

@ai_bp.get("/ai/body_assessment/history/<user_id>")
def get_body_assessment_history(user_id):
    try:
        if extensions.db is None:
            return jsonify({"error": "DB not ready"}), 503
        
        cursor = extensions.db.body_assessments.find(
            {"user_id": user_id},
            {"created_at": 1, "output": 1, "backend": 1, "input": 1}
        ).sort("created_at", -1)

        history = []
        for doc in cursor:
            # Create a simple summary
            created = doc.get("created_at")
            str_date = created.strftime("%Y-%m-%d %H:%M") if created else "Fecha desconocida"
            
            history.append({
                "id": str(doc.get("_id")),
                "date": str_date,
                "output": doc.get("output"),
                "backend": doc.get("backend"),
                "input": doc.get("input")
            })
        
        return jsonify(history), 200
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        return jsonify({"error": "Error interno"}), 500

@ai_bp.post("/api/generate_routine")
def api_generate_routine():
    try:
        data = request.get_json() or {}
        level = data.get("level", "Intermedio")
        goal = data.get("goal", "Hipertrofia")
        frequency = data.get("frequency", "4 días")
        equipment = data.get("equipment", "Gimnasio completo")

        agent = RoutineAgent()
        log_agent_execution("start", "RoutineAgent", agent, data, {"endpoint": "/api/generate_routine"})
        result = agent.run(level, goal, frequency, equipment)
        log_agent_execution("end", "RoutineAgent", agent, data, {"endpoint": "/api/generate_routine"})
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error generando rutina: {e}", exc_info=True)
        return jsonify({"error": "Error interno generando rutina"}), 500

@ai_bp.get("/ai/routine/generator")
def ai_routine_generator_page():
    return render_template("routine_generator.html")

@ai_bp.post("/ai/adjustments/<adjustment_id>/save_plan")
def ai_save_adjustment_as_plan(adjustment_id: str):
    try:
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        try:
            oid = ObjectId(adjustment_id)
        except Exception:
            return jsonify({"error": "adjustment_id inválido"}), 400

        adj = extensions.db.ai_adjustments.find_one({"_id": oid})
        if not adj:
            return jsonify({"error": "Ajuste no encontrado"}), 404

        output = (adj.get("output") or {})
        ajustes = (output.get("ajustes") or {})
        food = (ajustes.get("plan_alimentacion") or {})
        macros = (food.get("macros") or {})
        train = (ajustes.get("plan_entrenamiento") or {})

        plan_doc = {
            "user_id": adj.get("user_id"),
            "source": "ai_adjustment",
            "nutrition_plan": {
                "calories_per_day": food.get("kcal_obj"),
                "kcal_delta": food.get("kcal_delta"),
                "macros": {
                    "protein": macros.get("p"),
                    "carbs": macros.get("c"),
                    "fat": macros.get("g"),
                },
            },
            "training_plan": {
                "ai_volumen_delta_ratio": train.get("volumen_delta_ratio"),
                "cardio": train.get("cardio"),
            },
            "ai_summary": {
                "razonamiento_resumido": output.get("razonamiento_resumido"),
                "proxima_revision_dias": output.get("proxima_revision_dias"),
                "backend": adj.get("backend"),
                "adjustment_id": str(adj.get("_id")) if adj.get("_id") is not None else None,
            },
            "created_at": datetime.utcnow(),
        }

        res = extensions.db.plans.insert_one(plan_doc)
        plan_doc["_id"] = str(res.inserted_id)
        return jsonify({"message": "Plan guardado", "plan": plan_doc}), 201
    except Exception as e:
        logger.error(f"Error al guardar plan desde ajuste: {e}", exc_info=True)
        return jsonify({"error": "Error interno al guardar plan"}), 500

@ai_bp.post("/ai/adjustments/<user_id>/apply_latest")
def ai_apply_latest_adjustment(user_id: str):
    """Convierte el ajuste AI más reciente en plan y lo activa."""
    try:
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        adj = list(extensions.db.ai_adjustments.find({"user_id": user_id}).sort("created_at", -1).limit(1))
        if not adj:
            return jsonify({"error": "No hay ajustes AI para este usuario"}), 404
        adj = adj[0]

        output = (adj.get("output") or {})
        ajustes = (output.get("ajustes") or {})
        food = (ajustes.get("plan_alimentacion") or {})
        macros = (food.get("macros") or {})
        train = (ajustes.get("plan_entrenamiento") or {})

        plan_doc = {
            "user_id": user_id,
            "source": "ai_adjustment",
            "nutrition_plan": {
                "calories_per_day": food.get("kcal_obj"),
                "kcal_delta": food.get("kcal_delta"),
                "macros": {
                    "protein": macros.get("p"),
                    "carbs": macros.get("c"),
                    "fat": macros.get("g"),
                },
            },
            "training_plan": {
                "ai_volumen_delta_ratio": train.get("volumen_delta_ratio"),
                "cardio": train.get("cardio"),
            },
            "ai_summary": {
                "razonamiento_resumido": output.get("razonamiento_resumido"),
                "proxima_revision_dias": output.get("proxima_revision_dias"),
                "backend": adj.get("backend"),
                "adjustment_id": str(adj.get("_id")) if adj.get("_id") is not None else None,
            },
            "active": True,
            "created_at": datetime.utcnow(),
            "activated_at": datetime.utcnow(),
        }

        try:
            extensions.db.plans.update_many({"user_id": user_id}, {"$set": {"active": False}})
        except Exception:
            pass

        res = extensions.db.plans.insert_one(plan_doc)
        plan_doc["_id"] = str(res.inserted_id)
        return jsonify({"message": "Plan creado y activado", "plan": plan_doc}), 201
    except Exception as e:
        logger.error(f"Error aplicando último ajuste AI: {e}", exc_info=True)
        return jsonify({"error": "Error interno al aplicar ajuste"}), 500

@ai_bp.get("/ai/reason/sample")
def ai_reason_sample():
    """Ruta de prueba: usa progress.json como contexto."""
    try:
        sample_path = os.path.join(os.getcwd(), "progress.json")
        if not os.path.exists(sample_path):
            return jsonify({"error": "progress.json no encontrado"}), 404
        import json
        with open(sample_path, "r", encoding="utf-8") as f:
            progress = json.load(f)
        payload = {"progress": progress}
        agent = ReasoningAgent()
        log_agent_execution("start", "ReasoningAgent", agent, payload, {"endpoint": "/ai/reason/sample"})
        result = agent.run(payload)
        log_agent_execution("end", "ReasoningAgent", agent, payload, {"endpoint": "/ai/reason/sample"})
        return jsonify({"backend": agent.backend(), "input": payload, "output": result}), 200
    except Exception as e:
        logger.error(f"Error en ai_reason_sample: {e}", exc_info=True)
        return jsonify({"error": "Error interno al ejecutar el agente (sample)"}), 500

@ai_bp.get("/ai/diagnostics/agents")
def ai_agents_diagnostics():
    """Run a lightweight diagnostic for agent backends and outputs."""
    try:
        reasoning_payload = {"progress": [{"body_fat": 22.0, "performance": 70, "nutrition_adherence": 85}]}
        body_payload = {"sex": "male", "age": 30, "goal": "definicion", "measurements": {"weight_kg": 78, "height_cm": 178}}
        meal_payload = {"total_kcal": 2200, "meals": 4, "macros": {"protein": 160, "carbs": 250, "fat": 70}}

        agents = [
            ("ReasoningAgent", ReasoningAgent(), reasoning_payload),
            ("ReasoningAgentLegacy", LegacyReasoningAgent(), reasoning_payload),
            ("BodyAssessmentAgent", BodyAssessmentAgent(), body_payload),
            ("MealPlanAgent", MealPlanAgent(), meal_payload),
        ]

        results = []
        for name, agent, payload in agents:
            log_agent_execution("start", name, agent, payload, {"endpoint": "/ai/diagnostics/agents"})
            output = agent.run(payload)
            log_agent_execution("end", name, agent, payload, {"endpoint": "/ai/diagnostics/agents"})
            results.append({"agent": name, "backend": agent.backend(), "input": payload, "output": output})

        return jsonify({"results": results}), 200
    except Exception as e:
        logger.error(f"Error en ai_agents_diagnostics: {e}", exc_info=True)
        return jsonify({"error": "Error interno en diagnostico de agentes"}), 500

@ai_bp.post("/generate_plan")
def generate_plan():
    """Generador heurístico base (no AI full)"""
    try:
        if not request.is_json:
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415

        user = request.get_json()
        valid, message = validate_user_input(user)
        if not valid:
            return jsonify({"error": message}), 400

        weight = float(user["weight_kg"])
        goal = user["goal"]
        now = datetime.utcnow()

        if goal == "gain_muscle":
            calories = weight * 36
            macros = {"protein": 2.2 * weight, "carbs": 5 * weight, "fat": 0.9 * weight}
            routines = ["Pecho y Tríceps", "Espalda y Bíceps", "Piernas", "Hombros", "Core"]
        elif goal == "lose_fat":
            calories = weight * 28
            macros = {"protein": 2 * weight, "carbs": 2.5 * weight, "fat": 0.8 * weight}
            routines = ["Full Body", "Cardio", "Core"]
        else:
            calories = weight * 32
            macros = {"protein": 2 * weight, "carbs": 3.5 * weight, "fat": 0.85 * weight}
            routines = ["Upper Body", "Lower Body", "Core"]

        plan_doc = {
            "user_id": user["user_id"],
            "goal": goal,
            "source": "base_generator",
            "nutrition_plan": {
                "calories_per_day": calories,
                "kcal_delta": 0,
                "macros": macros,
            },
            "training_plan": {
                "days_per_week": len(routines),
                "routines": routines,
                "cardio": "",
                "ai_volumen_delta_ratio": None,
            },
            "active": True,
            "created_at": now,
            "activated_at": now,
        }

        try:
            extensions.db.plans.update_many({"user_id": user["user_id"]}, {"$set": {"active": False}})
        except Exception:
            pass

        result = extensions.db.plans.insert_one(plan_doc)
        plan_doc["_id"] = str(result.inserted_id)
        plan_doc["plan_id"] = plan_doc["_id"]

        logger.info(f"Plan generado correctamente para {user['user_id']}")
        return jsonify(plan_doc), 201

    except Exception as e:
        logger.error(f"Error al generar plan: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno al generar plan"}), 500
