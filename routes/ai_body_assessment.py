from flask import Blueprint, request, jsonify, render_template, send_file
import os
import base64
import io
from datetime import datetime
from typing import Any, Dict, Optional
from urllib.parse import urlparse
from bson import ObjectId
import cloudinary
import cloudinary.uploader
import cloudinary.api
import requests
from PIL import Image, ImageOps

import extensions
from extensions import logger
from utils.helpers import normalize_measurements, sanitize_photos
from utils.db_helpers import log_agent_execution
from utils.auth_helpers import check_admin_access
from ai_agents.body_metrics_agent import BodyMetricsAgent
from ai_agents.photo_assessment_agent import PhotoAssessmentAgent
from ai_agents.photo_judge_agent import PhotoJudgeAgent
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
MAX_EXPORT_DIM = 2048
DEFAULT_EXPORT_WIDTH = 900
DEFAULT_EXPORT_HEIGHT = 1200
EXPORT_RATIO_SIZES = {
    "1:1": (1080, 1080),
    "4:5": (1080, 1350),
    "9:16": (1080, 1920),
}


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


def _coerce_scale(value: Any) -> float:
    try:
        scale = float(value)
    except (TypeError, ValueError):
        return 1.0
    if scale > 4:
        scale = scale / 100.0
    return max(0.1, min(scale, 5.0))


def _coerce_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _scale_offset(value: int, source: int, target: int) -> int:
    if source <= 0 or target <= 0:
        return value
    return int(round(value * (target / source)))


def _fetch_image(url: str) -> Image.Image:
    resp = requests.get(url, timeout=(5, 15))
    if resp.status_code != 200:
        raise _PayloadError("No se pudo descargar una imagen para exportar.", 400)
    img = Image.open(io.BytesIO(resp.content))
    img = ImageOps.exif_transpose(img)
    return img.convert("RGBA")


def _fit_transform_image(img: Image.Image, canvas_w: int, canvas_h: int, scale: float, x: int, y: int) -> Image.Image:
    if canvas_w <= 0 or canvas_h <= 0:
        raise _PayloadError("Dimensiones de exportación inválidas.", 400)
    img_w, img_h = img.size
    if img_w <= 0 or img_h <= 0:
        raise _PayloadError("Imagen inválida para exportación.", 400)
    fit_scale = min(canvas_w / img_w, canvas_h / img_h)
    final_scale = fit_scale * scale
    new_w = max(1, int(round(img_w * final_scale)))
    new_h = max(1, int(round(img_h * final_scale)))
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    layer = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    left = int(round((canvas_w - new_w) / 2 + x))
    top = int(round((canvas_h - new_h) / 2 + y))
    layer.paste(resized, (left, top), resized)
    return layer


def _apply_opacity(img: Image.Image, alpha: float) -> Image.Image:
    alpha = max(0.0, min(alpha, 1.0))
    if alpha >= 1.0:
        return img
    r, g, b, a = img.split()
    a = a.point(lambda p: int(p * alpha))
    return Image.merge("RGBA", (r, g, b, a))


def _place_image_in_frame(img: Image.Image, frame_w: int, frame_h: int, fit: str, scale: float, x: int, y: int) -> Image.Image:
    if frame_w <= 0 or frame_h <= 0:
        raise _PayloadError("Dimensiones de exportación inválidas.", 400)
    img_w, img_h = img.size
    if img_w <= 0 or img_h <= 0:
        raise _PayloadError("Imagen inválida para exportación.", 400)
    if fit == "cover":
        base_scale = max(frame_w / img_w, frame_h / img_h)
    else:
        base_scale = min(frame_w / img_w, frame_h / img_h)
    final_scale = base_scale * scale
    new_w = max(1, int(round(img_w * final_scale)))
    new_h = max(1, int(round(img_h * final_scale)))
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    layer = Image.new("RGBA", (frame_w, frame_h), (0, 0, 0, 0))
    left = int(round((frame_w - new_w) / 2 + x))
    top = int(round((frame_h - new_h) / 2 + y))
    layer.paste(resized, (left, top), resized)
    return layer


class _PayloadError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


def _parse_body_assessment_request(allow_images: bool, upload_images: bool):
    """Parse payload and optional images from request."""
    images_for_agent = None
    payload = None
    total_photo_bytes = 0

    content_type = request.headers.get("Content-Type", "")
    if "multipart/form-data" in content_type.lower():
        payload_str = request.form.get("payload")
        if not payload_str:
            raise _PayloadError("Falta el campo 'payload' con JSON", 400)
        try:
            import json as _json
            payload = _json.loads(payload_str)
        except Exception:
            raise _PayloadError("'payload' no es JSON valido", 400)

        photos_meta = payload.get("photos") if isinstance(payload, dict) else None
        if isinstance(photos_meta, list) and len(photos_meta) > MAX_PHOTOS_PER_ASSESSMENT:
            raise _PayloadError(f"Maximo {MAX_PHOTOS_PER_ASSESSMENT} fotos permitidas.", 413)

        if allow_images and isinstance(photos_meta, list):
            img_list = []
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
                    raw = file_storage.read()
                    if not raw:
                        continue
                    if len(raw) > MAX_PHOTO_BYTES:
                        raise _PayloadError("Imagen demasiado grande. Maximo 5MB por foto.", 413)
                    total_photo_bytes += len(raw)
                    if total_photo_bytes > MAX_TOTAL_PHOTO_BYTES:
                        raise _PayloadError("Total de imagenes demasiado grande. Maximo 20MB.", 413)

                    file_storage.seek(0)

                    b64 = base64.b64encode(raw).decode("utf-8")
                    mime = file_storage.mimetype or "image/jpeg"
                    img_list.append({"data": b64, "mime": mime, "view": ph.get("view")})

                    if upload_images:
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

    return payload, images_for_agent


def _build_context(payload):
    measurements_raw = (payload or {}).get("measurements")
    if not isinstance(measurements_raw, dict):
        raise _PayloadError("'measurements' debe ser un objeto con las medidas", 400)

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
    return context


def _combine_backends(metrics_backend: str, photo_backend: Optional[str]) -> str:
    if not photo_backend:
        return metrics_backend or "unknown"
    if metrics_backend == photo_backend:
        return metrics_backend
    return f"{metrics_backend}+{photo_backend}"


def _merge_outputs(metrics_output: Dict[str, Any], photo_output: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    combined = dict(metrics_output or {})
    if not photo_output:
        combined.setdefault("photo_feedback", [])
        return combined

    if photo_output.get("photo_feedback") is not None:
        combined["photo_feedback"] = photo_output.get("photo_feedback")

    if photo_output.get("proportions") and photo_output["proportions"].get("symmetry_notes"):
        proportions = combined.get("proportions") or {}
        proportions["symmetry_notes"] = photo_output["proportions"]["symmetry_notes"]
        combined["proportions"] = proportions

        body_props = combined.get("body_proportions") or {}
        body_props["symmetry_analysis"] = photo_output["proportions"]["symmetry_notes"]
        combined["body_proportions"] = body_props

    return combined


def _persist_body_assessment(context: Dict[str, Any], result: Dict[str, Any], backend: str) -> None:
    try:
        if extensions.db is not None and context.get("user_id"):
            created_at = datetime.utcnow()
            extensions.db.body_assessments.insert_one(
                {
                    "user_id": context.get("user_id"),
                    "backend": backend,
                    "input": context,
                    "output": result,
                    "created_at": created_at,
                }
            )

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
                # Logs for legacy tracking optional, but we stop writing to deprecated collection 'progress'
                pass
    except Exception as persist_err:
        logger.warning(f"No se pudo guardar evaluacion corporal: {persist_err}")


def _persist_photo_judge(context: Dict[str, Any], result: Dict[str, Any], backend: str) -> None:
    try:
        if extensions.db is not None and context.get("user_id"):
            created_at = datetime.utcnow()
            extensions.db.body_photo_judgements.insert_one(
                {
                    "user_id": context.get("user_id"),
                    "backend": backend,
                    "input": context,
                    "output": result,
                    "created_at": created_at,
                }
            )
    except Exception as persist_err:
        logger.warning(f"No se pudo guardar evaluacion visual juez: {persist_err}")


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
        payload, images_for_agent = _parse_body_assessment_request(allow_images=True, upload_images=True)
        context = _build_context(payload)

        metrics_agent = BodyMetricsAgent()
        log_agent_execution("start", "BodyMetricsAgent", metrics_agent, context, {"endpoint": "/ai/body_assessment"})
        metrics_output = metrics_agent.run(context)
        log_agent_execution("end", "BodyMetricsAgent", metrics_agent, context, {"endpoint": "/ai/body_assessment"})

        photo_agent = PhotoAssessmentAgent()
        log_agent_execution("start", "PhotoAssessmentAgent", photo_agent, context, {"endpoint": "/ai/body_assessment"})
        photo_output = photo_agent.run(context, images=images_for_agent)
        log_agent_execution("end", "PhotoAssessmentAgent", photo_agent, context, {"endpoint": "/ai/body_assessment"})
        photo_backend = photo_agent.backend()

        judge_output = None
        judge_backend = None
        if images_for_agent:
            judge_agent = PhotoJudgeAgent()
            log_agent_execution("start", "PhotoJudgeAgent", judge_agent, context, {"endpoint": "/ai/body_assessment"})
            judge_output = judge_agent.run(context, images=images_for_agent)
            log_agent_execution("end", "PhotoJudgeAgent", judge_agent, context, {"endpoint": "/ai/body_assessment"})
            judge_backend = judge_agent.backend()

        result = _merge_outputs(metrics_output, photo_output)
        backend = _combine_backends(metrics_agent.backend(), photo_backend)
        _persist_body_assessment(context, result, backend)
        if judge_output is not None:
            _persist_photo_judge(context, judge_output, judge_backend or "unknown")
        return jsonify({"backend": backend, "input": context, "output": result}), 200
    except _PayloadError as e:
        return jsonify({"error": str(e)}), e.status_code
    except Exception as e:
        logger.error(f"Error generando evaluacion corporal: {e}", exc_info=True)
        return jsonify({"error": "Error interno al generar evaluacion corporal"}), 500


@ai_body_assessment_bp.post("/ai/body_assessment/metrics")
def ai_body_assessment_metrics():
    try:
        payload, _ = _parse_body_assessment_request(allow_images=False, upload_images=False)
        context = _build_context(payload)

        agent = BodyMetricsAgent()
        log_agent_execution("start", "BodyMetricsAgent", agent, context, {"endpoint": "/ai/body_assessment/metrics"})
        result = agent.run(context)
        log_agent_execution("end", "BodyMetricsAgent", agent, context, {"endpoint": "/ai/body_assessment/metrics"})

        return jsonify({"backend": agent.backend(), "input": context, "output": result}), 200
    except _PayloadError as e:
        return jsonify({"error": str(e)}), e.status_code
    except Exception as e:
        logger.error(f"Error generando metricas corporales: {e}", exc_info=True)
        return jsonify({"error": "Error interno al generar metricas"}), 500


@ai_body_assessment_bp.post("/ai/body_assessment/photos")
def ai_body_assessment_photos():
    try:
        payload, images_for_agent = _parse_body_assessment_request(allow_images=True, upload_images=True)
        context = _build_context(payload)

        agent = PhotoAssessmentAgent()
        log_agent_execution("start", "PhotoAssessmentAgent", agent, context, {"endpoint": "/ai/body_assessment/photos"})
        result = agent.run(context, images=images_for_agent)
        log_agent_execution("end", "PhotoAssessmentAgent", agent, context, {"endpoint": "/ai/body_assessment/photos"})

        judge_output = None
        judge_backend = None
        if images_for_agent:
            judge_agent = PhotoJudgeAgent()
            log_agent_execution("start", "PhotoJudgeAgent", judge_agent, context, {"endpoint": "/ai/body_assessment/photos"})
            judge_output = judge_agent.run(context, images=images_for_agent)
            log_agent_execution("end", "PhotoJudgeAgent", judge_agent, context, {"endpoint": "/ai/body_assessment/photos"})
            judge_backend = judge_agent.backend()
            _persist_photo_judge(context, judge_output, judge_backend or "unknown")

        return jsonify({"backend": agent.backend(), "input": context, "output": result}), 200
    except _PayloadError as e:
        return jsonify({"error": str(e)}), e.status_code
    except Exception as e:
        logger.error(f"Error generando analisis de fotos: {e}", exc_info=True)
        return jsonify({"error": "Error interno al analizar fotos"}), 500


@ai_body_assessment_bp.post("/ai/body_assessment/record")
def ai_body_assessment_record():
    try:
        payload = request.get_json(silent=True) or {}
        backend = payload.get("backend") or "unknown"
        context = payload.get("input")
        output = payload.get("output")
        if not isinstance(context, dict) or not isinstance(output, dict):
            return jsonify({"error": "Se requieren 'input' y 'output' validos"}), 400

        _persist_body_assessment(context, output, backend)
        return jsonify({"stored": True}), 200
    except Exception as e:
        logger.error(f"Error guardando evaluacion corporal: {e}", exc_info=True)
        return jsonify({"error": "Error interno al guardar evaluacion"}), 500


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
            updated = doc.get("updated_at")
            str_date = created.strftime("%Y-%m-%d %H:%M") if created else "Fecha desconocida"

            history.append(
                {
                    "id": str(doc.get("_id")),
                    "date": str_date,
                    "created_at": created.isoformat() if created else None,
                    "updated_at": updated.isoformat() if updated else None,
                    "output": doc.get("output"),
                    "backend": doc.get("backend"),
                    "input": doc.get("input"),
                }
            )

        return jsonify(history), 200
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        return jsonify({"error": "Error interno"}), 500


@ai_body_assessment_bp.get("/ai/body_assessment/photos_judge/history/<user_id>")
def get_photo_judge_history(user_id):
    try:
        user_id = normalize_user_id(user_id)
        if extensions.db is None:
            return jsonify({"error": "DB not ready"}), 503

        cursor = (
            extensions.db.body_photo_judgements.find(
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
                    "created_at": created.isoformat() if created else None,
                    "output": doc.get("output"),
                    "backend": doc.get("backend"),
                    "input": doc.get("input"),
                }
            )

        return jsonify(history), 200
    except Exception as e:
        logger.error(f"Error fetching photo judge history: {e}")
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


@ai_body_assessment_bp.post("/ai/body_assessment/compare/export")
def export_body_assessment_compare():
    try:
        payload = request.get_json(silent=True) or {}
        image_a = payload.get("imageAUrl")
        image_b = payload.get("imageBUrl")
        if not image_a or not image_b:
            raise _PayloadError("Faltan URLs de imágenes para exportar.", 400)

        mode = (payload.get("mode") or "wipe").lower()
        if mode not in {"wipe", "blend"}:
            raise _PayloadError("Modo de exportación inválido.", 400)

        slider = _coerce_int(payload.get("slider", 50), 50)
        slider = max(0, min(100, slider))

        ratio = payload.get("ratio")
        if ratio in EXPORT_RATIO_SIZES:
            req_w, req_h = EXPORT_RATIO_SIZES[ratio]
        else:
            req_w = _coerce_int(payload.get("width", DEFAULT_EXPORT_WIDTH), DEFAULT_EXPORT_WIDTH)
            req_h = _coerce_int(payload.get("height", DEFAULT_EXPORT_HEIGHT), DEFAULT_EXPORT_HEIGHT)

        img_a = _fetch_image(image_a)
        img_b = _fetch_image(image_b)

        if req_w <= 0 or req_h <= 0:
            max_w = max(img_a.width, img_b.width, DEFAULT_EXPORT_WIDTH)
            max_h = max(img_a.height, img_b.height, DEFAULT_EXPORT_HEIGHT)
            scale = min(MAX_EXPORT_DIM / max(max_w, max_h, 1), 1.0)
            req_w = max(1, int(round(max_w * scale)))
            req_h = max(1, int(round(max_h * scale)))

        req_w = max(1, min(req_w, MAX_EXPORT_DIM))
        req_h = max(1, min(req_h, MAX_EXPORT_DIM))

        transform_a = payload.get("transformA") or {}
        transform_b = payload.get("transformB") or {}
        scale_a = _coerce_scale(transform_a.get("scale", 1))
        scale_b = _coerce_scale(transform_b.get("scale", 1))
        x_a = _coerce_int(transform_a.get("x", 0), 0)
        y_a = _coerce_int(transform_a.get("y", 0), 0)
        x_b = _coerce_int(transform_b.get("x", 0), 0)
        y_b = _coerce_int(transform_b.get("y", 0), 0)

        source_w = _coerce_int(payload.get("sourceWidth", 0), 0)
        source_h = _coerce_int(payload.get("sourceHeight", 0), 0)
        if source_w > 0 and source_h > 0:
            x_a = _scale_offset(x_a, source_w, req_w)
            y_a = _scale_offset(y_a, source_h, req_h)
            x_b = _scale_offset(x_b, source_w, req_w)
            y_b = _scale_offset(y_b, source_h, req_h)

        layer_a = _fit_transform_image(img_a, req_w, req_h, scale_a, x_a, y_a)
        layer_b = _fit_transform_image(img_b, req_w, req_h, scale_b, x_b, y_b)

        canvas = Image.new("RGBA", (req_w, req_h), (0, 0, 0, 0))
        if mode == "blend":
            ratio = slider / 100.0
            base_alpha = 1.0 - ratio
            overlay_alpha = ratio
            canvas = Image.alpha_composite(canvas, _apply_opacity(layer_a, base_alpha))
            canvas = Image.alpha_composite(canvas, _apply_opacity(layer_b, overlay_alpha))
        else:
            canvas = Image.alpha_composite(canvas, layer_a)
            cutoff = int(round((slider / 100.0) * req_w))
            mask = Image.new("L", (req_w, req_h), 0)
            if cutoff < req_w:
                mask.paste(255, (cutoff, 0, req_w, req_h))
            masked_b = Image.new("RGBA", (req_w, req_h), (0, 0, 0, 0))
            masked_b.paste(layer_b, (0, 0), mask)
            canvas = Image.alpha_composite(canvas, masked_b)

        out = io.BytesIO()
        canvas.save(out, format="PNG")
        out.seek(0)
        return send_file(out, mimetype="image/png", as_attachment=False)
    except _PayloadError as exc:
        return jsonify({"error": str(exc)}), exc.status_code
    except Exception as exc:
        logger.error(f"Error exporting compare image: {exc}", exc_info=True)
        return jsonify({"error": "No se pudo exportar la comparación."}), 500


@ai_body_assessment_bp.post("/ai/body_assessment/compare/collage")
def export_body_assessment_collage():
    try:
        payload = request.get_json(silent=True) or {}
        image_a = payload.get("imageAUrl")
        image_b = payload.get("imageBUrl")
        if not image_a or not image_b:
            raise _PayloadError("Faltan URLs de imágenes para exportar.", 400)

        layout = (payload.get("layout") or "vertical").lower()
        if layout not in {"vertical", "horizontal"}:
            raise _PayloadError("Layout inválido.", 400)

        fit = (payload.get("fit") or "contain").lower()
        if fit not in {"contain", "cover"}:
            raise _PayloadError("Ajuste inválido.", 400)

        padding = _coerce_int(payload.get("padding", 16), 16)
        padding = max(0, min(padding, 200))

        req_w = _coerce_int(payload.get("width", DEFAULT_EXPORT_WIDTH), DEFAULT_EXPORT_WIDTH)
        req_h = _coerce_int(payload.get("height", DEFAULT_EXPORT_HEIGHT), DEFAULT_EXPORT_HEIGHT)
        req_w = max(1, min(req_w, MAX_EXPORT_DIM))
        req_h = max(1, min(req_h, MAX_EXPORT_DIM))

        img_a = _fetch_image(image_a)
        img_b = _fetch_image(image_b)

        transform_a = payload.get("transformA") or {}
        transform_b = payload.get("transformB") or {}
        scale_a = _coerce_scale(transform_a.get("scale", 1))
        scale_b = _coerce_scale(transform_b.get("scale", 1))
        x_a = _coerce_int(transform_a.get("x", 0), 0)
        y_a = _coerce_int(transform_a.get("y", 0), 0)
        x_b = _coerce_int(transform_b.get("x", 0), 0)
        y_b = _coerce_int(transform_b.get("y", 0), 0)

        source_w = _coerce_int(payload.get("sourceWidth", 0), 0)
        source_h = _coerce_int(payload.get("sourceHeight", 0), 0)

        canvas = Image.new("RGBA", (req_w, req_h), (0, 0, 0, 0))

        if layout == "vertical":
            frame_w = max(1, (req_w - padding) // 2)
            frame_h = req_h
            left_x = 0
            right_x = frame_w + padding
            if source_w > 0 and source_h > 0:
                x_a = _scale_offset(x_a, source_w, frame_w)
                y_a = _scale_offset(y_a, source_h, frame_h)
                x_b = _scale_offset(x_b, source_w, frame_w)
                y_b = _scale_offset(y_b, source_h, frame_h)
            layer_a = _place_image_in_frame(img_a, frame_w, frame_h, fit, scale_a, x_a, y_a)
            layer_b = _place_image_in_frame(img_b, frame_w, frame_h, fit, scale_b, x_b, y_b)
            canvas.paste(layer_a, (left_x, 0), layer_a)
            canvas.paste(layer_b, (right_x, 0), layer_b)
        else:
            frame_w = req_w
            frame_h = max(1, (req_h - padding) // 2)
            top_y = 0
            bottom_y = frame_h + padding
            if source_w > 0 and source_h > 0:
                x_a = _scale_offset(x_a, source_w, frame_w)
                y_a = _scale_offset(y_a, source_h, frame_h)
                x_b = _scale_offset(x_b, source_w, frame_w)
                y_b = _scale_offset(y_b, source_h, frame_h)
            layer_a = _place_image_in_frame(img_a, frame_w, frame_h, fit, scale_a, x_a, y_a)
            layer_b = _place_image_in_frame(img_b, frame_w, frame_h, fit, scale_b, x_b, y_b)
            canvas.paste(layer_a, (0, top_y), layer_a)
            canvas.paste(layer_b, (0, bottom_y), layer_b)

        out = io.BytesIO()
        canvas.save(out, format="PNG")
        out.seek(0)
        return send_file(out, mimetype="image/png", as_attachment=False)
    except _PayloadError as exc:
        return jsonify({"error": str(exc)}), exc.status_code
    except Exception as exc:
        logger.error(f"Error exporting collage image: {exc}", exc_info=True)
        return jsonify({"error": "No se pudo exportar el collage."}), 500
