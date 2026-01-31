from flask import Blueprint, request, jsonify, render_template
import os
import base64
from datetime import datetime
from urllib.parse import urlparse
from bson import ObjectId
import cloudinary
import cloudinary.uploader
import cloudinary.api

import extensions
from extensions import logger
from utils.helpers import normalize_measurements, sanitize_photos
from utils.db_helpers import log_agent_execution
from utils.auth_helpers import check_admin_access
from ai_agents.body_assessment_agent import BodyAssessmentAgent
from utils.id_helpers import normalize_user_id, maybe_object_id

# Configuracion Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
)

ai_body_assessment_bp = Blueprint("ai_body_assessment", __name__)

MAX_PHOTOS_PER_ASSESSMENT = 6
MAX_PHOTO_BYTES = 5 * 1024 * 1024
MAX_TOTAL_PHOTO_BYTES = 20 * 1024 * 1024


def _cloudinary_public_id_from_url(url: str):
    if not url or not isinstance(url, str):
        return None
    try:
        path = urlparse(url).path or ""
    except Exception:
        return None
    if "/upload/" not in path:
        return None
    tail = path.split("/upload/", 1)[1].lstrip("/")
    if not tail:
        return None
    parts = tail.split("/")
    if parts and parts[0].startswith("v") and parts[0][1:].isdigit():
        parts = parts[1:]
    else:
        for idx, part in enumerate(parts):
            if part.startswith("v") and part[1:].isdigit():
                parts = parts[idx + 1 :]
                break
    if not parts:
        return None
    last = parts[-1]
    if "." in last:
        parts[-1] = last.rsplit(".", 1)[0]
    public_id = "/".join([p for p in parts if p])
    return public_id or None


def _get_assessment_defaults(user_id):
    """Helper to fetch default values for body assessment from DB."""
    defaults = {}
    try:
        if user_id and extensions.db is not None:
            # 1. Latest Assessment (Highest Priority)
            latest = extensions.db.body_assessments.find_one(
                {"user_id": user_id}, 
                sort=[("created_at", -1)]
            )
            
            # 2. Onboarding Data
            onboarding = extensions.db.onboarding_submissions.find_one(
                {"user_id": user_id},
                sort=[("submission_date", -1)]
            )
            
            # 3. User Profile
            oid = maybe_object_id(user_id)
            profile = None
            if oid:
                profile = extensions.db.users.find_one({"_id": oid})
            if not profile:
                 profile = extensions.db.users.find_one({"user_id": user_id})

            # --- Helper to extract ---
            def get_onboarding_val(key):
                if onboarding and "data" in onboarding:
                    return onboarding["data"].get(key)
                return None

            # --- Construct Defaults ---
            # AGE
            if latest and (latest.get("input") or {}).get("age"):
                defaults["age"] = latest["input"]["age"]
            elif profile and profile.get("birth_date"):
                 try:
                    today = datetime.now()
                    born = profile["birth_date"]
                    age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
                    defaults["age"] = age
                 except:
                     pass
            
            # HEIGHT
            if latest and (latest.get("input") or {}).get("height_cm"):
                 defaults["height_cm"] = latest["input"].get("height_cm")
            elif latest and (latest.get("input") or {}).get("measurements"):
                 defaults["height_cm"] = latest["input"]["measurements"].get("height_cm")
            
            # WEIGHT
            if latest and (latest.get("input") or {}).get("weight_kg"):
                 defaults["weight_kg"] = latest["input"].get("weight_kg")
            elif latest and (latest.get("input") or {}).get("measurements"):
                 defaults["weight_kg"] = latest["input"]["measurements"].get("weight_kg")

            # SEX
            if latest and (latest.get("input") or {}).get("sex"):
                defaults["sex"] = latest["input"]["sex"]
            elif profile and profile.get("sex"):
                defaults["sex"] = profile["sex"]
            
            # ACTIVITY LEVEL
            if latest and (latest.get("input") or {}).get("activity_level"):
                defaults["activity_level"] = latest["input"]["activity_level"]
            elif get_onboarding_val("activity_level"):
                defaults["activity_level"] = get_onboarding_val("activity_level")

            # GOAL
            if latest and (latest.get("input") or {}).get("goal"):
                defaults["goal"] = latest["input"]["goal"]
            elif get_onboarding_val("fitness_goal"):
                defaults["goal"] = get_onboarding_val("fitness_goal")

    except Exception as e:
        logger.warning(f"Error fetching defaults for body assessment: {e}")
    
    return defaults


@ai_body_assessment_bp.get("/ai/body_assessment/tester")
def body_assessment_tester():
    return render_template("body_assessment.html")


@ai_body_assessment_bp.get("/ai/body_assessment/user")
def body_assessment_user():
    user_id = request.cookies.get("user_session")
    defaults = _get_assessment_defaults(user_id)
    return render_template("body_assessment_user.html", defaults=defaults)


@ai_body_assessment_bp.get("/ai/body_assessment/unified")
def body_assessment_unified():
    source = request.args.get("source", "user")
    user_id = request.cookies.get("user_session")
    defaults = _get_assessment_defaults(user_id)
    return render_template("body_assessment_unified.html", source=source, defaults=defaults)


@ai_body_assessment_bp.post("/ai/body_assessment")
def ai_body_assessment():
    try:
        images_for_agent = None
        payload = None
        total_photo_bytes = 0

        content_type = request.headers.get("Content-Type", "")
        if "multipart/form-data" in content_type.lower():
            payload_str = request.form.get("payload")
            if not payload_str:
                return jsonify({"error": "Falta el campo 'payload' con JSON"}), 400
            try:
                import json as _json

                payload = _json.loads(payload_str)
            except Exception:
                return jsonify({"error": "'payload' no es JSON valido"}), 400

            photos_meta = payload.get("photos") if isinstance(payload, dict) else None
            if isinstance(photos_meta, list) and len(photos_meta) > MAX_PHOTOS_PER_ASSESSMENT:
                return jsonify({"error": f"Maximo {MAX_PHOTOS_PER_ASSESSMENT} fotos permitidas."}), 413
            img_list = []
            if isinstance(photos_meta, list):
                for ph in photos_meta:
                    if not isinstance(ph, dict):
                        continue
                    file_key = ph.get("file_key")
                    if not file_key:
                        continue
                    file_storage = request.files.get(file_key)
                    if not file_storage:
                        continue
                    try:
                        # Leer bytes para base64 (agente)
                        raw = file_storage.read()
                        if not raw:
                            continue
                        if len(raw) > MAX_PHOTO_BYTES:
                            return jsonify({"error": "Imagen demasiado grande. Maximo 5MB por foto."}), 413
                        total_photo_bytes += len(raw)
                        if total_photo_bytes > MAX_TOTAL_PHOTO_BYTES:
                            return jsonify({"error": "Total de imagenes demasiado grande. Maximo 20MB."}), 413

                        # Reset pointer para posible subida o relectura
                        file_storage.seek(0)

                        # 1. Base64 para el Agente (procesamiento inmediato)
                        b64 = base64.b64encode(raw).decode("utf-8")
                        mime = file_storage.mimetype or "image/jpeg"
                        img_list.append({"data": b64, "mime": mime, "view": ph.get("view")})

                        # 2. Subida a Cloudinary (persistencia)
                        if os.getenv("CLOUDINARY_CLOUD_NAME"):
                            try:
                                file_storage.seek(0)
                                user_folder_id = payload.get("user_id") or "unknown"
                                date_folder = datetime.now().strftime("%Y%m%d")
                                upload_result = cloudinary.uploader.upload(
                                    file_storage,
                                    folder=f"ia_fitness/body_assessments/{user_folder_id}/{date_folder}",
                                    resource_type="image",
                                )
                                secure_url = upload_result.get("secure_url")
                                if secure_url:
                                    ph["url"] = secure_url
                            except Exception as cloud_err:
                                logger.error(f"Error subiendo a Cloudinary: {cloud_err}")
                        else:
                            logger.warning("Cloudinary no configurado. No se subiran imagenes.")

                    finally:
                        try:
                            file_storage.close()
                        except Exception:
                            pass
            if img_list:
                images_for_agent = img_list
        else:
            payload = request.get_json(silent=True) or {}

        measurements_raw = (payload or {}).get("measurements")
        if not isinstance(measurements_raw, dict):
            return jsonify({"error": "'measurements' debe ser un objeto con las medidas"}), 400

        measurements = normalize_measurements(measurements_raw)
        context = {
            "user_id": normalize_user_id((payload or {}).get("user_id")),
            "sex": ((payload or {}).get("sex") or "male").lower(),
            "age": (payload or {}).get("age"),
            "goal": (payload or {}).get("goal"),
            "activity_level": (payload or {}).get("activity_level"),
            "measurements": measurements,
            "photos": sanitize_photos((payload or {}).get("photos")),
            "notes": (payload or {}).get("notes"),
            "admin_internal_notes": (payload or {}).get("admin_internal_notes"),
            "admin_user_notes": (payload or {}).get("admin_user_notes"),
            "manual_adjustments": (payload or {}).get("manual_adjustments"),
        }

        agent = BodyAssessmentAgent()
        log_agent_execution("start", "BodyAssessmentAgent", agent, context, {"endpoint": "/ai/body_assessment"})
        result = agent.run(context, images=images_for_agent)
        log_agent_execution("end", "BodyAssessmentAgent", agent, context, {"endpoint": "/ai/body_assessment"})
        try:
            if extensions.db is not None and context.get("user_id"):
                created_at = datetime.utcnow()
                extensions.db.body_assessments.insert_one(
                    {
                        "user_id": context.get("user_id"),
                        "backend": agent.backend(),
                        "input": context,
                        "output": result,
                        "created_at": created_at,
                    }
                )

                # Mirror essential metrics into progress for consistency
                meas = (context or {}).get("measurements") or {}
                weight_kg = meas.get("weight_kg") or meas.get("weight")
                body_fat = None
                out = result or {}
                bc = out.get("body_composition") or {}
                if bc.get("body_fat_percent"):
                    body_fat = bc.get("body_fat_percent")
                elif out.get("body_fat_percent"):
                    body_fat = out.get("body_fat_percent")
                elif meas.get("body_fat_percent"):
                    body_fat = meas.get("body_fat_percent")
                elif meas.get("body_fat"):
                    body_fat = meas.get("body_fat")

                if weight_kg is not None or body_fat is not None:
                    extensions.db.progress.insert_one(
                        {
                            "user_id": context.get("user_id"),
                            "date": created_at,
                            "weight_kg": weight_kg,
                            "body_fat": body_fat,
                            "performance": None,
                            "nutrition_adherence": None,
                            "source": "body_assessment",
                        }
                    )
        except Exception as persist_err:
            logger.warning(f"No se pudo guardar evaluacion corporal: {persist_err}")

        return jsonify({"backend": agent.backend(), "input": context, "output": result}), 200
    except Exception as e:
        logger.error(f"Error generando evaluacion corporal: {e}", exc_info=True)
        return jsonify({"error": "Error interno al generar evaluacion corporal"}), 500


@ai_body_assessment_bp.get("/ai/body_assessment/history/view/<user_id>")
def body_assessment_history_view(user_id):
    user_id = normalize_user_id(user_id)
    user_name = user_id
    try:
        logger.info(f"Viewing history for user_id: {user_id}")
        if extensions.db is not None:
            oid = maybe_object_id(user_id)
            if oid:
                user = extensions.db.users.find_one({"_id": oid})
            else:
                user = extensions.db.users.find_one({"user_id": user_id})
            if user:
                user_name = user.get("name") or user.get("username") or user_id
                logger.info("Found user name for history view")
            else:
                logger.warning("User not found in DB")
    except Exception as e:
        logger.error(f"Error fetching user name: {e}")
        pass
    return render_template("body_assessment_history.html", user_id=user_id, user_name=user_name)


@ai_body_assessment_bp.get("/ai/body_assessment/history/<user_id>")
def get_body_assessment_history(user_id):
    try:
        user_id = normalize_user_id(user_id)
        if extensions.db is None:
            return jsonify({"error": "DB not ready"}), 503

        cursor = (
            extensions.db.body_assessments.find(
            {"user_id": user_id},
                {"created_at": 1, "output": 1, "backend": 1, "input": 1},
            )
            .sort("created_at", -1)
        )

        history = []
        for doc in cursor:
            created = doc.get("created_at")
            str_date = created.strftime("%Y-%m-%d %H:%M") if created else "Fecha desconocida"

            history.append(
                {
                    "id": str(doc.get("_id")),
                    "date": str_date,
                    "output": doc.get("output"),
                    "backend": doc.get("backend"),
                    "input": doc.get("input"),
                }
            )

        return jsonify(history), 200
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        return jsonify({"error": "Error interno"}), 500


@ai_body_assessment_bp.delete("/ai/body_assessment/history/<assessment_id>")
def delete_body_assessment_history(assessment_id):
    try:
        if extensions.db is None:
            return jsonify({"error": "DB not ready"}), 503
        ok, err = check_admin_access()
        if not ok:
            return err
        try:
            oid = ObjectId(assessment_id)
        except Exception:
            return jsonify({"error": "assessment_id invalido"}), 400

        doc = extensions.db.body_assessments.find_one({"_id": oid})
        if not doc:
            return jsonify({"error": "Registro no encontrado"}), 404

        photos = ((doc.get("input") or {}).get("photos") or [])
        deleted_images = 0
        if os.getenv("CLOUDINARY_CLOUD_NAME"):
            for ph in photos:
                if not isinstance(ph, dict):
                    continue
                url = ph.get("url") or ph.get("secure_url")
                public_id = _cloudinary_public_id_from_url(url)
                if not public_id:
                    continue
                try:
                    cloudinary.uploader.destroy(public_id, resource_type="image")
                    deleted_images += 1
                except Exception as cloud_err:
                    logger.warning(f"No se pudo borrar imagen Cloudinary {public_id}: {cloud_err}")
        else:
            logger.warning("Cloudinary no configurado. No se borraran imagenes.")

        extensions.db.body_assessments.delete_one({"_id": oid})
        return jsonify({"deleted": True, "deleted_images": deleted_images}), 200
    except Exception as e:
        logger.error(f"Error eliminando evaluacion corporal: {e}", exc_info=True)
        return jsonify({"error": "Error interno al eliminar"}), 500
