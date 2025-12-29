# ======================================================
# AI FITNESS - BACKEND FLASK FINAL
# ======================================================

from flask import Flask, request, jsonify, render_template, make_response, redirect
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import os
import base64
import logging
from dotenv import load_dotenv
import traceback
import re
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import errors as mongo_errors
from ai_agents.reasoning_agent import ReasoningAgent
from typing import Any, Dict, Optional
from ai_agents.meal_plan_agent import MealPlanAgent
from ai_agents.body_assessment_agent import BodyAssessmentAgent
from agents.reasoning_agent import ReasoningAgent as LegacyReasoningAgent

# ======================================================
# CONFIGURACIÓN INICIAL
# ======================================================

# Cargar variables de entorno (.env)
load_dotenv()

# Configuración de Flask
app = Flask(__name__)

# Configuración de logging global
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("ai_fitness")
logger.info("? Aplicación AI Fitness iniciada correctamente")

# Check OpenAI Key Status
openai_key = os.getenv("OPENAI_API_KEY")
if openai_key:
    masked_key = f"{openai_key[:8]}...{openai_key[-4:]}" if len(openai_key) > 12 else "***"
    logger.info(f"? OPENAI_API_KEY detectada: {masked_key}")
else:
    logger.warning("? OPENAI_API_KEY no encontrada en variables de entorno. Los agentes usarán MOCK.")

openai_model = os.getenv("OPENAI_MODEL", "gpt-4o (default)")
logger.info(f"? Modelo OpenAI configurado: {openai_model}")


def log_agent_execution(
    stage: str,
    name: str,
    agent: Any,
    payload: Optional[Dict[str, Any]] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    """Log agent execution details without leaking sensitive data."""
    backend = agent.backend() if hasattr(agent, "backend") else "unknown"
    model = getattr(agent, "model", None)
    init_error = getattr(agent, "init_error", None)
    key_present = bool(os.getenv("OPENAI_API_KEY"))
    payload_keys = list(payload.keys()) if isinstance(payload, dict) else None
    meta = {"backend": backend, "model": model, "key_present": key_present, "init_error": init_error}
    if payload_keys is not None:
        meta["payload_keys"] = payload_keys
    if extra:
        meta.update(extra)
    logger.info(f"[AgentRun:{stage}] {name} | {meta}")

# ======================================================
# CONEXIÓN MONGODB
# ======================================================
#try:
#    import certifi
#    client = MongoClient(os.getenv("MONGO_URI"))
#    db = client[os.getenv("MONGO_DB")]
#    logger.info("? Conexión exitosa con MongoDB Atlas")
#except Exception as e:
#    logger.error(f"? Error al conectar a MongoDB: {str(e)}", exc_info=True)
#    db = None


# === Conexión MongoDB Atlas (versión final compatible PyMongo 4.7+) === #
try:
    import certifi
    from pymongo import MongoClient

    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        raise ValueError("? No se encontró la variable MONGO_URI en el entorno")

    # Configurar conexión segura con certificados vÃ¡lidos
    client = MongoClient(
        mongo_uri,
        tls=True,
        tlsCAFile=certifi.where(),  # Certificados raÃ­z actualizados
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=20000,
        socketTimeoutMS=20000
    )

    db = client[os.getenv("MONGO_DB")]
    logger.info("? Conexión segura con MongoDB Atlas establecida correctamente")

except Exception as e:
    logger.error(f"? Error al conectar a MongoDB Atlas: {str(e)}", exc_info=True)
    db = None


# ======================================================
# CONTEXT PROCESSORS
# ======================================================
@app.context_processor
def inject_user_role():
    """Inyecta 'current_user_role' en todos los templates."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return {"current_user_role": None}
        
        # Check db logic for role
        if db is not None:
            # Optimizacion: podriamos cachear esto excepcionalmente si fuera muy lento
            role_doc = db.user_roles.find_one({"user_id": user_id})
            if role_doc:
                return {"current_user_role": role_doc.get("role")}
    except Exception:
        pass
    return {"current_user_role": None}


@app.before_request
def check_user_profile():
    """
    Middleware to ensure logged-in users have a profile.
    If not, redirects them to /profile to complete it.
    Excludes static files, auth routes, and admin routes.
    """
    if request.endpoint and "static" in request.endpoint:
        return
    
    # Exclude auth and API routes from redirection loop
    if request.path.startswith("/api/") or \
       request.path.startswith("/login") or \
       request.path.startswith("/logout") or \
       request.path.startswith("/register") or \
       request.path.startswith("/admin") or \
       request.path == "/":
        return

    user_id = request.cookies.get("user_session")
    if not user_id:
        return

    # If already on profile page, allow access
    if request.path == "/profile":
        return

    # Check if user has profile
    if db is not None:
        try:
            profile = db.user_profiles.find_one({"user_id": user_id})
            if not profile:
                # User logged in but no profile -> Force redirect
                return redirect("/profile")
        except Exception as e:
            logger.error(f"Error checking profile middleware: {e}")
            pass


# ======================================================
# FUNCIONES AUXILIARES
# ======================================================
def validate_user_input(user):
    """Valida los campos obligatorios antes de generar el plan"""
    required_fields = ["user_id", "weight_kg", "goal"]
    missing = [f for f in required_fields if f not in user]

    if missing:
        return False, f"Faltan los campos requeridos: {', '.join(missing)}"
    if not isinstance(user["weight_kg"], (int, float)):
        return False, "El campo 'weight_kg' debe ser numÃ©rico."
    if user["goal"] not in ["gain_muscle", "lose_fat", "maintain"]:
        return False, "El campo 'goal' debe ser uno de: gain_muscle, lose_fat, maintain."
    return True, None


USER_STATUS_VALUES = {"active", "inactive", "suspended", "pending"}
USER_STATUS_DEFAULT = "active"


def normalize_user_status(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    status = str(value).strip().lower()
    if status in USER_STATUS_VALUES:
        return status
    return None


def ensure_user_status(user_id: str, default_status: str = USER_STATUS_DEFAULT) -> str:
    """Ensure user_status record exists and return status."""
    if db is None:
        return default_status
    try:
        status_doc = db.user_status.find_one({"user_id": user_id})
        if status_doc and status_doc.get("status"):
            return status_doc.get("status")
        db.user_status.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "status": default_status,
                    "updated_at": datetime.utcnow(),
                }
            },
            upsert=True,
        )
        return default_status
    except Exception as e:
        logger.warning(f"ensure_user_status failed for {user_id}: {e}")
        return default_status


def is_user_active(user_id: str) -> bool:
    status = ensure_user_status(user_id, default_status=USER_STATUS_DEFAULT)
    return status == "active"


def parse_birth_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return datetime(value.year, value.month, value.day)
    try:
        parsed = datetime.strptime(str(value).strip(), "%Y-%m-%d")
        return datetime(parsed.year, parsed.month, parsed.day)
    except Exception:
        return None


def format_birth_date(value: Optional[datetime]) -> Optional[str]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    return None


def compute_age(birth_date: Optional[datetime]) -> Optional[int]:
    if not birth_date:
        return None
    try:
        today = datetime.utcnow().date()
        b = birth_date.date()
        age = today.year - b.year - ((today.month, today.day) < (b.month, b.day))
        return max(age, 0)
    except Exception:
        return None


def fetch_user_progress_for_agent(user_id: str, limit: Optional[int] = None):
    """Obtiene el progreso de un usuario desde MongoDB y lo formatea
    como JSON utilizable por el agente AI.

    Estructura de salida:
    {
      "progress": [
        {
          "user_id": str,
          "date": "YYYY-MM-DD",
          "weight_kg": float,
          "body_fat": float,
          "performance": float,
          "nutrition_adherence": float
        }, ...
      ]
    }

    - Ordena por fecha ascendente.
    - Convierte fechas datetime a ISO (YYYY-MM-DD).
    - Aplica `limit` opcional sobre los Últimos N registros.
    """
    try:
        if db is None:
            raise RuntimeError("Conexión a MongoDB no inicializada")

        projection = {
            "_id": 0,
            "user_id": 1,
            "date": 1,
            "weight_kg": 1,
            "body_fat": 1,
            "performance": 1,
            "nutrition_adherence": 1,
        }

        cursor = db.progress.find({"user_id": user_id}, projection=projection).sort("date", 1)
        items = list(cursor)

        if limit is not None and isinstance(limit, int) and limit > 0:
            items = items[-limit:]

        normalized = []
        for it in items:
            d = it.get("date")
            if isinstance(d, datetime):
                date_str = d.strftime("%Y-%m-%d")
            else:
                # Acepta str u otros tipos serializables; garantiza str
                date_str = str(d) if d is not None else None

            normalized.append({
                "user_id": str(it.get("user_id")) if it.get("user_id") is not None else user_id,
                "date": date_str,
                "weight_kg": it.get("weight_kg"),
                "body_fat": it.get("body_fat"),
                "performance": it.get("performance"),
                "nutrition_adherence": it.get("nutrition_adherence"),
            })

        return {"progress": normalized}
    except Exception as e:
        logger.error(f"Error en fetch_user_progress_for_agent({user_id}): {e}", exc_info=True)
        # Devuelve estructura consistente para el agente incluso ante error
        return {"progress": []}


def normalize_measurements(raw: dict) -> Dict[str, Optional[float]]:
    """Normaliza claves comunes de medidas (soporta alias en español)."""

    aliases = {
        "chest": ["chest", "pecho"],
        "waist": ["waist", "cintura"],
        "abdomen": ["abdomen"],
        "hip": ["hip", "cadera"],
        "arm_relaxed": ["arm_relaxed", "brazo_relajado", "brazo relajado"],
        "arm_flexed": ["arm_flexed", "brazo_contraido", "brazo_contraído", "brazo contraido", "brazo contraído"],
        "thigh": ["thigh", "muslo"],
        "calf": ["calf", "pantorrilla"],
        "neck": ["neck", "cuello"],
        "height_cm": ["height_cm", "altura_cm", "altura"],
        "weight_kg": ["weight_kg", "peso", "peso_kg"],
    }

    def to_float(value: Any) -> Optional[float]:
        try:
            if value is None:
                return None
            if isinstance(value, str):
                value = value.replace(",", ".").strip()
                if not value:
                    return None
            return float(value)
        except (ValueError, TypeError):
            return None

    normalized: Dict[str, Optional[float]] = {}
    for key, keys in aliases.items():
        for alias in keys:
            if alias in raw:
                normalized[key] = to_float(raw.get(alias))
                break
    return normalized


def sanitize_photos(raw: Any) -> list:
    """Reduce la información de fotos a metadatos seguros."""

    sanitized = []
    if isinstance(raw, list):
        for item in raw:
            if not isinstance(item, dict):
                continue
            view = str(item.get("view", "")).strip()
            notes = str(item.get("notes", "")).strip()
            quality = str(item.get("quality", "")).strip()
            sanitized.append(
                {
                    "view": view.lower() or None,
                    "notes": notes or None,
                    "quality": quality or None,
                }
            )
    return sanitized


@app.post("/api/user/change_password")
def api_user_change_password():
    """
    Permite al usuario cambiar su contraseÃ±a.
    Requiere: current_password, new_password
    """
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "No autenticado"}), 401
            
        data = request.get_json()
        current_password = data.get("current_password")
        new_password = data.get("new_password")
        
        if not current_password or not new_password:
            return jsonify({"error": "Faltan datos (actual y nueva contraseÃ±a)"}), 400
            
        if len(new_password) < 6:
            return jsonify({"error": "La nueva contraseÃ±a debe tener al menos 6 caracteres"}), 400

        if db is None:
             return jsonify({"error": "DB no disponible"}), 503

        # Verify old password
        user = db.users.find_one({"user_id": user_id})
        if not user:
             return jsonify({"error": "Usuario no encontrado"}), 404
             
        if not check_password_hash(user["password"], current_password):
            return jsonify({"error": "La contraseÃ±a actual es incorrecta"}), 403
            
        # Update with new password
        new_hash = generate_password_hash(new_password)
        db.users.update_one({"user_id": user_id}, {"$set": {"password": new_hash}})
        
        logger.info(f"Usuario {user_id} cambiÃ³ su contraseÃ±a exitosamente")
        return jsonify({"message": "ContraseÃ±a actualizada correctamente"}), 200

    except Exception as e:
        logger.error(f"Error cambiando password: {e}")
        return jsonify({"error": "Error interno"}), 500


@app.post("/api/user/profile/save")
def api_user_profile_save():
    """Actualiza perfil del usuario autenticado."""
    try:
        user_id = request.cookies.get("user_session")
        if not user_id:
            return jsonify({"error": "No autenticado"}), 401
        
        data = request.get_json() or {}
        name = data.get("name")
        sex = (data.get("sex") or "").strip().lower() or None
        birth_date_raw = data.get("birth_date")
        phone = (data.get("phone") or "").strip() or None

        if sex and sex not in ["male", "female", "other"]:
            return jsonify({"error": "Sexo invalido"}), 400

        birth_dt = parse_birth_date(birth_date_raw)
        if birth_date_raw and birth_dt is None:
            return jsonify({"error": "Fecha de nacimiento invalida. Usa YYYY-MM-DD"}), 400

        updates = {
            "sex": sex,
            "birth_date": birth_dt,
            "phone": phone,
            "updated_at": datetime.utcnow(),
        }

        if db is not None:
             db.user_profiles.update_one(
                {"user_id": user_id},
                {"$set": updates, "$setOnInsert": {"created_at": datetime.utcnow(), "user_id": user_id}},
                upsert=True,
            )
             if name is not None:
                db.users.update_one({"user_id": user_id}, {"$set": {"name": name}})
        
        return jsonify({"message": "Perfil actualizado", "user_id": user_id}), 200

    except Exception as e:
        logger.error(f"Error guardando perfil usuario: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500


@app.get("/ai/reason/<user_id>")

def ai_reason_for_user(user_id: str):
    """Ejecuta el agente AI usando el progreso del usuario desde MongoDB.

    Query params:
      - limit: opcional, entero > 0 para limitar a los ultimos N registros.

    Respuesta: JSON con backend activo, input (progreso) y output (ajustes).
    """
    try:
        raw_limit = request.args.get("limit")
        limit: Optional[int] = None
        if raw_limit is not None and raw_limit != "":
            try:
                limit_val = int(raw_limit)
                if limit_val <= 0:
                    return jsonify({"error": "'limit' debe ser un entero positivo"}), 400
                limit = limit_val
            except ValueError:
                return jsonify({"error": "'limit' debe ser un entero valido"}), 400

        context = fetch_user_progress_for_agent(user_id, limit)
        progress = context.get("progress", [])
        if not progress:
            return jsonify({"error": "No hay registros de progreso para este usuario"}), 404

        agent = ReasoningAgent()
        log_agent_execution(
            "start",
            "ReasoningAgent",
            agent,
            context,
            {"endpoint": "/ai/reason/<user_id>", "user_id": user_id},
        )
        result = agent.run(context)
        log_agent_execution(
            "end",
            "ReasoningAgent",
            agent,
            context,
            {
                "endpoint": "/ai/reason/<user_id>",
                "user_id": user_id,
                "output_keys": list(result.keys()) if isinstance(result, dict) else None,
            },
        )

        # Persistir ajuste en historial
        try:
            if db is not None:
                db.ai_adjustments.insert_one({
                    "user_id": user_id,
                    "backend": agent.backend(),
                    "input": context,
                    "output": result,
                    "created_at": datetime.utcnow(),
                })
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


@app.get("/ai/adjustments/<user_id>")
def ai_get_adjustments(user_id: str):
    """Devuelve el historial de ajustes AI para un usuario.

    Query params:
      - limit: opcional, entero > 0 (por defecto 10) ordenado por fecha desc.
    """
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        raw_limit = request.args.get("limit")
        limit = 10
        if raw_limit:
            try:
                val = int(raw_limit)
                if val > 0:
                    limit = val
            except ValueError:
                return jsonify({"error": "'limit' debe ser entero positivo"}), 400

        cursor = (
            db.ai_adjustments
            .find({"user_id": user_id})
            .sort("created_at", -1)
            .limit(limit)
        )
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


@app.get("/ai/body_assessment/tester")
def body_assessment_tester():
    """Renderiza una interfaz web para probar el agente de evaluación corporal."""

    return render_template("body_assessment.html")


@app.post("/ai/body_assessment")
def ai_body_assessment():
    """Genera evaluación corporal a partir de medidas y fotos.

    Soporta dos formatos de entrada:
      - JSON application/json (sin imágenes)
      - multipart/form-data con campo 'payload' (JSON) y archivos de imagen.
        En payload.photos se pueden incluir objetos con 'file_key' que referencian
        el nombre del campo de archivo en el formulario.
    """

    try:
        images_for_agent = None
        payload = None

        content_type = request.headers.get("Content-Type", "")
        if "multipart/form-data" in content_type.lower():
            payload_str = request.form.get("payload")
            if not payload_str:
                return jsonify({"error": "Falta el campo 'payload' con JSON"}), 400
            try:
                payload = request.get_json(silent=True) if False else None  # claridad: no usar get_json en multipart
                if payload is None:
                    import json as _json

                    payload = _json.loads(payload_str)
            except Exception:
                return jsonify({"error": "'payload' no es JSON válido"}), 400

            # Construir imágenes para el agente desde request.files y payload.photos[*].file_key
            photos_meta = payload.get("photos") if isinstance(payload, dict) else None
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
                        raw = file_storage.read()
                        if not raw:
                            continue
                        b64 = base64.b64encode(raw).decode("utf-8")
                        mime = file_storage.mimetype or "image/jpeg"
                        img_list.append({"data": b64, "mime": mime, "view": ph.get("view")})
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

        required = ["height_cm", "weight_kg"]
        if not (measurements.get("waist") or measurements.get("abdomen")):
            required.append("waist/abdomen")
        missing = [
            key
            for key in required
            if measurements.get(key if key != "waist/abdomen" else "waist") is None and key != "waist/abdomen"
        ]
        if "waist/abdomen" in required and not (measurements.get("waist") or measurements.get("abdomen")):
            missing.append("waist o abdomen")

        if missing:
            return (
                jsonify({"error": f"Faltan medidas requeridas: {', '.join(missing)}"}),
                400,
            )

        context = {
            "user_id": (payload or {}).get("user_id"),
            "sex": ((payload or {}).get("sex") or "male").lower(),
            "age": (payload or {}).get("age"),
            "goal": (payload or {}).get("goal"),
            "measurements": measurements,
            "photos": sanitize_photos((payload or {}).get("photos")),
            "notes": (payload or {}).get("notes"),
        }

        agent = BodyAssessmentAgent()
        log_agent_execution(
            "start",
            "BodyAssessmentAgent",
            agent,
            context,
            {"endpoint": "/ai/body_assessment", "user_id": context.get("user_id")},
        )
        result = agent.run(context, images=images_for_agent)
        log_agent_execution(
            "end",
            "BodyAssessmentAgent",
            agent,
            context,
            {
                "endpoint": "/ai/body_assessment",
                "user_id": context.get("user_id"),
                "output_keys": list(result.keys()) if isinstance(result, dict) else None,
            },
        )

        try:
            if db is not None and context.get("user_id"):
                db.body_assessments.insert_one(
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


@app.route("/ai/nutrition/plan/<user_id>", methods=["GET", "POST"])
def ai_nutrition_plan(user_id: str):
    """Genera un plan diario de comidas usando el plan activo (kcal/macros).

    Query/JSON opcionales:
      - meals: int (3-6)
      - prefs: lista/str (preferencias)
      - exclude: lista/str (exclusiones)
      - cuisine: str (cocina preferida)
      - notes: str (notas breves)
    """
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503

        # Leer input (permite GET params en POST para simplicidad)
        # meals: robust parse and clamp to 3..6
        meals_raw = request.args.get("meals") or ((request.get_json() or {}).get("meals") if request.is_json else None)
        meals_val = None
        try:
            if meals_raw is not None and str(meals_raw).strip() != "":
                meals_val = max(3, min(6, int(meals_raw)))
        except Exception:
            meals_val = None
        prefs = request.args.get("prefs") or (request.get_json() or {}).get("prefs") if request.is_json else None
        exclude = request.args.get("exclude") or (request.get_json() or {}).get("exclude") if request.is_json else None
        cuisine = request.args.get("cuisine") or (request.get_json() or {}).get("cuisine") if request.is_json else None
        notes = request.args.get("notes") or (request.get_json() or {}).get("notes") if request.is_json else None

        active = db.plans.find_one({"user_id": user_id, "active": True}, sort=[("activated_at", -1), ("created_at", -1)])
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
        log_agent_execution(
            "start",
            "MealPlanAgent",
            agent,
            context,
            {"endpoint": "/ai/nutrition/plan/<user_id>", "user_id": user_id},
        )
        result = agent.run(context)
        log_agent_execution(
            "end",
            "MealPlanAgent",
            agent,
            context,
            {
                "endpoint": "/ai/nutrition/plan/<user_id>",
                "user_id": user_id,
                "output_keys": list(result.keys()) if isinstance(result, dict) else None,
            },
        )
        # No persistir automáticamente; el frontend decidirá guardar/activar
        return jsonify({"backend": agent.backend(), "input": context, "output": result}), 200
    except Exception as e:
        logger.error(f"Error generando plan de nutrición: {e}", exc_info=True)
        return jsonify({"error": "Error interno al generar plan de nutrición"}), 500


@app.post("/ai/adjustments/<adjustment_id>/save_plan")
def ai_save_adjustment_as_plan(adjustment_id: str):
    """Crea un documento en `plans` a partir de un ajuste del agente.

    Body: vacío. Usa el documento de `ai_adjustments` como fuente.
    """
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        try:
            oid = ObjectId(adjustment_id)
        except Exception:
            return jsonify({"error": "adjustment_id inválido"}), 400

        adj = db.ai_adjustments.find_one({"_id": oid})
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

        res = db.plans.insert_one(plan_doc)
        plan_doc["_id"] = str(res.inserted_id)
        return jsonify({"message": "Plan guardado", "plan": plan_doc}), 201
    except Exception as e:
        logger.error(f"Error al guardar plan desde ajuste: {e}", exc_info=True)
        return jsonify({"error": "Error interno al guardar plan"}), 500


@app.get("/meal_plans/<user_id>/active")
def get_active_meal_plan(user_id: str):
    """Obtiene el plan de nutrición activo del usuario, si existe."""
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        doc = db.meal_plans.find_one({"user_id": user_id, "active": True}, sort=[("activated_at", -1), ("created_at", -1)])
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


@app.post("/meal_plans/save")
def save_meal_plan():
    """Guarda y activa un plan de nutrición enviado por el frontend.

    Espera JSON con: user_id (str), backend (str, opcional), input (dict), output (dict).
    Desactiva planes previos del usuario y activa el nuevo.
    """
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        if not request.is_json:
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415
        data = request.get_json() or {}
        user_id = (data.get("user_id") or "").strip()
        output = data.get("output") or {}
        input_ctx = data.get("input") or {}
        backend = data.get("backend") or "unknown"
        if not user_id or not isinstance(output, dict):
            return jsonify({"error": "user_id y output son requeridos"}), 400

        try:
            db.meal_plans.update_many({"user_id": user_id}, {"$set": {"active": False}})
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
        res = db.meal_plans.insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        return jsonify({"message": "Plan de nutrición guardado y activado", "meal_plan": doc}), 201
    except Exception as e:
        logger.error(f"Error al guardar/activar meal plan: {e}", exc_info=True)
        return jsonify({"error": "Error interno al guardar plan de nutrición"}), 500


# ======================================================
# ADMIN: VISTA Y EDICION LIGERA DE PLANES
# ======================================================

def check_admin_access():
    """Valida token Y rol de administrador en DB.
    Retorna: (is_valid, response_tuple_if_error)
    """
    admin_token = os.getenv("ADMIN_TOKEN")
    if not admin_token:
        logger.error("check_admin_access: ADMIN_TOKEN env var not set")
        return False, (jsonify({"error": "ADMIN_TOKEN no configurado"}), 503)

    # 1. Validar Token (Cookie, Header o Query)
    provided = (
        request.args.get("token")
        or request.cookies.get("admin_token")
        or request.headers.get("X-Admin-Token")
    )
    if provided != admin_token:
        logger.warning(f"check_admin_access: Token mismatch or missing. Provided: {provided and provided[:5]}...")
        # Si es navegador (Accept html), podría redirigir a login, pero por ahora 403
        return False, (jsonify({"error": "Token de admin inválido o ausente"}), 403)

    # 2. Validar Rol de Usuario (Cookie de sesión)
    user_id = request.cookies.get("user_session")
    if not user_id:
        logger.warning("check_admin_access: Missing user_session cookie")
        return False, (jsonify({"error": "Sesión de usuario requerida. Por favor inicia sesión nuevamente en la home."}), 403)
    
    if not is_user_active(user_id):
        return False, (jsonify({"error": "Usuario inactivo o pendiente. Acceso admin denegado."}), 403)

    # Check db
    role_doc = db.user_roles.find_one({"user_id": user_id})
    if not role_doc:
        logger.warning(f"check_admin_access: User {user_id} has no role entry in user_roles")
        return False, (jsonify({"error": "No tienes roles asignados. Pide a otro admin que te asigne el rol."}), 403)
    
    if role_doc.get("role") != "admin":
        logger.warning(f"check_admin_access: User {user_id} has role '{role_doc.get('role')}', expected 'admin'")
        return False, (jsonify({"error": "No tiene privilegios de administrador (Rol insuficiente)"}), 403)

    return True, None


@app.get("/admin/plans")
def admin_plans_page():
    ok, err_resp = check_admin_access()
    if not ok:
        # Si pide HTML y falla, mostramos login o error legible
        if "text/html" in request.headers.get("Accept", ""):
             # Podríamos redirigir a /admin, pero mostremos mensaje
             return render_template("admin_auth.html", error=err_resp[0].json.get("error"))
        return err_resp

    resp = make_response(render_template("admin_plans.html"))
    if request.args.get("token"):
        resp.set_cookie("admin_token", request.args.get("token"), httponly=True, samesite="Lax")
    return resp


@app.get("/admin/validate")
def admin_validate():
    """Valida que el usuario tiene acceso admin mediante cookie o header.
    Retorna 200 si ok; 403 si no autorizado.
    """
    try:
        admin_token = os.getenv("ADMIN_TOKEN")
        if not admin_token:
            return jsonify({"error": "ADMIN_TOKEN no configurado"}), 503

        provided = (
            request.cookies.get("admin_token")
            or request.headers.get("X-Admin-Token")
            or request.args.get("token")
        )
        if provided != admin_token:
            return jsonify({"ok": False, "error": "No autorizado"}), 403
        return jsonify({"ok": True}), 200
    except Exception:
        return jsonify({"error": "Error validando acceso admin"}), 500


@app.post("/admin/login")
def admin_login():
    """Valida el token de administrador enviado por POST y establece cookie.

    Acepta JSON { token: str } o form-urlencoded con campo 'token'.
    Responde 200 con { ok: true } y set-cookie si es válido; 403 si no.
    """
    try:
        admin_token = os.getenv("ADMIN_TOKEN")
        if not admin_token:
            return jsonify({"error": "ADMIN_TOKEN no configurado"}), 503

        token = ""
        if request.is_json:
            data = request.get_json() or {}
            token = (data.get("token") or "").strip()
        else:
            token = (request.form.get("token") or "").strip()

        if token != admin_token:
            return jsonify({"ok": False, "error": "No autorizado"}), 403

        resp = jsonify({"ok": True, "message": "Login admin OK"})
        # Cookie de sesión simple para navegación admin
        resp.set_cookie("admin_token", token, httponly=True, samesite="Lax")
        return resp, 200
    except Exception as e:
        logger.error(f"Error en /admin/login: {e}", exc_info=True)
        return jsonify({"error": "Error interno en login admin"}), 500


@app.get("/admin/meal_plans")
def admin_meal_plans_page():
    """Vista admin para gestionar meal_plans (nutrición)."""
    ok, err_resp = check_admin_access()
    if not ok:
        if "text/html" in request.headers.get("Accept", ""):
            return render_template("admin_auth.html", error=err_resp[0].json.get("error"))
        return err_resp

    resp = make_response(render_template("admin_meal_plans.html"))
    if request.args.get("token"):
        resp.set_cookie("admin_token", request.args.get("token"), httponly=True, samesite="Lax")
    return resp


@app.get("/admin/privileges")
def admin_privileges_page():
    """Vista admin para gestionar privilegios de usuarios."""
    ok, err_resp = check_admin_access()
    if not ok:
        if "text/html" in request.headers.get("Accept", ""):
            return render_template("admin_auth.html", error=err_resp[0].json.get("error"))
        return err_resp

    resp = make_response(render_template("admin_privileges.html"))
    if request.args.get("token"):
        resp.set_cookie("admin_token", request.args.get("token"), httponly=True, samesite="Lax")
    return resp


@app.get("/admin/api/users_roles")
def admin_api_list_users_roles():
    """API para listar usuarios y sus roles combinado."""
    try:
        admin_token = os.getenv("ADMIN_TOKEN")
        token = request.headers.get("X-Admin-Token") or request.cookies.get("admin_token")
        if not admin_token or token != admin_token:
            return jsonify({"error": "No autorizado"}), 403
        # 1. Obtener estados de usuarios
        status_map = {}
        try:
            for s in db.user_status.find({}):
                uid = s.get("user_id")
                if uid:
                    status_map[uid] = s.get("status") or USER_STATUS_DEFAULT
        except Exception:
            pass

        # 1. Obtener todos los usuarios de la colección 'users'
        users_cursor = db.users.find({}, {"_id": 1, "user_id": 1, "email": 1, "username": 1, "name": 1})
        users_map = {}
        for u in users_cursor:
            uid = str(u.get("user_id") or u.get("_id"))
            users_map[uid] = {
                "user_id": uid,
                "email": u.get("email"),
                "username": u.get("username"),
                "name": u.get("name"),
                "role": "user", # Default
                "status": status_map.get(uid, USER_STATUS_DEFAULT),
            }

        # 2. Obtener roles explícitos de 'user_roles'
        roles_cursor = db.user_roles.find({})
        for r in roles_cursor:
            uid = r.get("user_id")
            if uid in users_map:
                users_map[uid]["role"] = r.get("role", "user")
            else:
                users_map[uid] = {
                    "user_id": uid,
                    "email": "(desconocido)",
                    "username": "n/a",
                    "name": "n/a",
                    "role": r.get("role", "user"),
                    "status": status_map.get(uid, USER_STATUS_DEFAULT),
                }

        return jsonify(list(users_map.values())), 200
    except Exception as e:
        logger.error(f"Error listando roles: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.post("/admin/api/update_role")
def admin_api_update_role():
    """API para actualizar el rol de un usuario."""
    try:
        admin_token = os.getenv("ADMIN_TOKEN")
        token = request.headers.get("X-Admin-Token") or request.cookies.get("admin_token")
        if not admin_token or token != admin_token:
            return jsonify({"error": "No autorizado"}), 403

        data = request.get_json() or {}
        user_id = data.get("user_id")
        new_role = data.get("role")

        if not user_id or new_role not in ["admin", "user"]:
            return jsonify({"error": "Datos inválidos"}), 400

        # Upsert en coleccion user_roles
        db.user_roles.update_one(
            {"user_id": user_id},
            {"$set": {"role": new_role, "updated_at": datetime.utcnow()}},
            upsert=True
        )

        return jsonify({"message": f"Rol actualizado a {new_role}", "user_id": user_id}), 200
    except Exception as e:
        logger.error(f"Error actualizando rol: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.get("/admin/users")
def admin_users_page():
    """Vista admin para gestionar usuarios (CRUD)."""
    ok, err_resp = check_admin_access()
    if not ok:
        if "text/html" in request.headers.get("Accept", ""):
             return render_template("admin_auth.html", error=err_resp[0].json.get("error"))
        return err_resp

    resp = make_response(render_template("admin_users.html"))
    if request.args.get("token"):
        resp.set_cookie("admin_token", request.args.get("token"), httponly=True, samesite="Lax")
    return resp


@app.get("/admin/profiles")
def admin_profiles_page():
    """Vista admin para gestionar perfiles de usuario."""
    ok, err_resp = check_admin_access()
    if not ok:
        if "text/html" in request.headers.get("Accept", ""):
             return render_template("admin_auth.html", error=err_resp[0].json.get("error"))
        return err_resp

    resp = make_response(render_template("admin_profiles.html"))
    if request.args.get("token"):
        resp.set_cookie("admin_token", request.args.get("token"), httponly=True, samesite="Lax")
    return resp


@app.get("/admin/api/user_profiles")
def admin_api_list_user_profiles():
    """Lista usuarios con datos de perfil."""
    ok, err_resp = check_admin_access()
    if not ok:
        return err_resp
    try:
        status_map = {}
        try:
            for s in db.user_status.find({}):
                uid = s.get("user_id")
                if uid:
                    status_map[uid] = s.get("status") or USER_STATUS_DEFAULT
        except Exception:
            pass

        profiles_map = {}
        for p in db.user_profiles.find({}):
            uid = p.get("user_id")
            if not uid:
                continue
            profiles_map[uid] = p

        users_cursor = db.users.find({}, {"_id": 1, "user_id": 1, "email": 1, "username": 1, "name": 1})
        output = []
        for u in users_cursor:
            uid = str(u.get("user_id") or u.get("_id"))
            prof = profiles_map.get(uid, {})
            birth_dt = prof.get("birth_date")
            if isinstance(birth_dt, str):
                birth_dt = parse_birth_date(birth_dt)
            has_profile = bool(prof)
            output.append({
                "user_id": uid,
                "email": u.get("email"),
                "username": u.get("username"),
                "name": u.get("name"),
                "sex": prof.get("sex"),
                "birth_date": format_birth_date(birth_dt),
                "age": compute_age(birth_dt),
                "phone": prof.get("phone"),
                "status": status_map.get(uid, USER_STATUS_DEFAULT),
                "has_profile": has_profile,
            })
        return jsonify(output), 200
    except Exception as e:
        logger.error(f"Error listando perfiles: {e}", exc_info=True)
        return jsonify({"error": "Error interno listando perfiles"}), 500


@app.get("/admin/api/user_profiles/lookup")
def admin_api_lookup_user_profile():
    """Busca usuario por termino y valida estado/perfil."""
    ok, err_resp = check_admin_access()
    if not ok:
        return err_resp
    try:
        term = (request.args.get("term") or "").strip()
        exact = request.args.get("exact") == "1"
        if not term:
            return jsonify({"error": "Termino requerido"}), 400

        users = []
        if exact:
            identifier = term.strip()
            lookup = (
                db.users.find_one({"user_id": identifier})
                or db.users.find_one({"email": identifier.lower()})
                or db.users.find_one({"username_lower": identifier.lower()})
                or db.users.find_one({"name": identifier})
            )
            if lookup:
                users = [lookup]
        else:
            regex = {"$regex": re.escape(term), "$options": "i"}
            users = list(db.users.find({
                "$or": [
                    {"user_id": regex},
                    {"username": regex},
                    {"email": regex},
                    {"name": regex},
                ]
            }, {"_id": 1, "user_id": 1, "email": 1, "username": 1, "name": 1}).limit(5))

        if not users:
            return jsonify({"error": "Usuario no encontrado"}), 404
        if len(users) > 1:
            return jsonify({
                "error": "Multiples coincidencias. Refina la busqueda.",
                "matches": [
                    {
                        "user_id": str(u.get("user_id") or u.get("_id")),
                        "username": u.get("username"),
                        "email": u.get("email"),
                        "name": u.get("name"),
                    } for u in users
                ]
            }), 409

        u = users[0]
        user_id = str(u.get("user_id") or u.get("_id"))
        status = ensure_user_status(user_id, default_status=USER_STATUS_DEFAULT)
        if status != "active":
            return jsonify({"error": "Usuario no activo", "status": status}), 403

        prof = db.user_profiles.find_one({"user_id": user_id}) or {}
        birth_dt = prof.get("birth_date")
        if isinstance(birth_dt, str):
            birth_dt = parse_birth_date(birth_dt)

        return jsonify({
            "user_id": user_id,
            "email": u.get("email"),
            "username": u.get("username"),
            "name": u.get("name"),
            "sex": prof.get("sex"),
            "birth_date": format_birth_date(birth_dt),
            "age": compute_age(birth_dt),
            "phone": prof.get("phone"),
            "status": status,
            "has_profile": bool(prof),
        }), 200
    except Exception as e:
        logger.error(f"Error lookup perfil: {e}", exc_info=True)
        return jsonify({"error": "Error interno en lookup de perfiles"}), 500


@app.post("/admin/api/user_profiles/save")
def admin_api_save_user_profile():
    """Crea o actualiza el perfil de un usuario."""
    ok, err_resp = check_admin_access()
    if not ok:
        return err_resp
    try:
        data = request.get_json() or {}
        user_id = (data.get("user_id") or "").strip()
        if not user_id:
            return jsonify({"error": "User ID requerido"}), 400

        name = data.get("name")
        sex = (data.get("sex") or "").strip().lower() or None
        birth_date_raw = data.get("birth_date")
        phone = (data.get("phone") or "").strip() or None

        if sex and sex not in ["male", "female", "other"]:
            return jsonify({"error": "Sexo invalido"}), 400

        birth_dt = parse_birth_date(birth_date_raw)
        if birth_date_raw and birth_dt is None:
            return jsonify({"error": "Fecha de nacimiento invalida. Usa YYYY-MM-DD"}), 400

        updates = {
            "sex": sex,
            "birth_date": birth_dt,
            "phone": phone,
            "updated_at": datetime.utcnow(),
        }

        db.user_profiles.update_one(
            {"user_id": user_id},
            {"$set": updates, "$setOnInsert": {"created_at": datetime.utcnow(), "user_id": user_id}},
            upsert=True,
        )

        if name is not None:
            db.users.update_one({"user_id": user_id}, {"$set": {"name": name}})

        return jsonify({"message": "Perfil actualizado", "user_id": user_id}), 200
    except Exception as e:
        logger.error(f"Error guardando perfil: {e}", exc_info=True)
        return jsonify({"error": "Error interno guardando perfil"}), 500


@app.post("/admin/api/users/create")
def admin_api_create_user():
    """Crear usuario desde admin panel."""
    ok, err_resp = check_admin_access()
    if not ok: return err_resp

    try:
        data = request.get_json() or {}
        name = (data.get("name") or "").strip()
        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not name or not username or not email or not password:
            return jsonify({"error": "Todos los campos son obligatorios"}), 400
        
        # Validaciones basicas
        if db.users.find_one({"username_lower": username.lower()}):
            return jsonify({"error": "El usuario ya existe"}), 409
        if db.users.find_one({"email": email}):
            return jsonify({"error": "El email ya existe"}), 409

        pwd_hash = generate_password_hash(password, method="pbkdf2:sha256", salt_length=16)
        doc = {
            "name": name,
            "username": username,
            "username_lower": username.lower(),
            "email": email,
            "password_hash": pwd_hash,
            "created_at": datetime.utcnow(),
        }
        res = db.users.insert_one(doc)
        uid = str(res.inserted_id)
        db.users.update_one({"_id": res.inserted_id}, {"$set": {"user_id": uid}})
        
        # Asignar rol por defecto (user)
        db.user_roles.insert_one({"user_id": uid, "role": "user", "updated_at": datetime.utcnow()})

        status = normalize_user_status(data.get("status")) or "active"
        try:
            db.user_status.update_one(
                {"user_id": uid},
                {"$set": {"status": status, "updated_at": datetime.utcnow()}},
                upsert=True,
            )
        except Exception:
            pass

        return jsonify({"message": "Usuario creado exitosamente", "user_id": uid}), 201

    except Exception as e:
        logger.error(f"Error creando usuario admin: {e}", exc_info=True)
        return jsonify({"error": "Error interno al crear usuario"}), 500


@app.post("/admin/api/users/edit")
def admin_api_edit_user():
    """Editar usuario desde admin panel."""
    ok, err_resp = check_admin_access()
    if not ok: return err_resp

    try:
        data = request.get_json() or {}
        user_id = data.get("user_id")
        if not user_id:
            return jsonify({"error": "User ID requerido"}), 400

        updates = {}
        if "name" in data: updates["name"] = data["name"].strip()
        if "username" in data: 
            updates["username"] = data["username"].strip()
            updates["username_lower"] = data["username"].strip().lower()
        if "email" in data: updates["email"] = data["email"].strip().lower()
        
        if "password" in data and data["password"]:
             updates["password_hash"] = generate_password_hash(data["password"], method="pbkdf2:sha256", salt_length=16)

        status = normalize_user_status(data.get("status"))
        if data.get("status") is not None and status is None:
            return jsonify({"error": "Estado de usuario invalido"}), 400

        if not updates:
            return jsonify({"message": "Sin cambios"}), 200

        # Check dupes if changing distinctive fields
        if "email" in updates:
            exist = db.users.find_one({"email": updates["email"]})
            if exist and str(exist.get("user_id") or exist.get("_id")) != user_id:
                return jsonify({"error": "Email ya en uso por otro usuario"}), 409
        
        if "username_lower" in updates:
            exist = db.users.find_one({"username_lower": updates["username_lower"]})
            if exist and str(exist.get("user_id") or exist.get("_id")) != user_id:
                return jsonify({"error": "Usuario ya en uso por otro usuario"}), 409

        db.users.update_one({"user_id": user_id}, {"$set": updates})
        if status:
            db.user_status.update_one(
                {"user_id": user_id},
                {"$set": {"status": status, "updated_at": datetime.utcnow()}},
                upsert=True,
            )
        return jsonify({"message": "Usuario actualizado"}), 200

    except Exception as e:
        logger.error(f"Error editando usuario admin: {e}", exc_info=True)
        return jsonify({"error": "Error interno al editar usuario"}), 500


@app.get("/admin/api/users/<user_id>/full_profile")
def admin_api_get_full_profile(user_id: str):
    """Obtiene perfil completo y ultimas medidas para pre-llenado."""
    ok, err_resp = check_admin_access()
    if not ok: return err_resp

    try:
        # 1. Identity
        user = db.users.find_one({"user_id": user_id})
        if not user:
            return jsonify({"error": "Usuario no encontrado"}), 404

        # 2. Profile (Sex, Age)
        profile = db.user_profiles.find_one({"user_id": user_id}) or {}
        
        # Calculate age if birth_date exists
        age = None
        if profile.get("birth_date"):
            try:
                today = datetime.utcnow()
                born = profile.get("birth_date")
                age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
            except Exception:
                pass

        # 3. Latest Assessment (Measurements, Goal, Notes)
        last_assess = db.body_assessments.find_one(
            {"user_id": user_id},
            sort=[("created_at", -1)]
        ) or {}
        
        last_input = last_assess.get("input") or {}
        last_measures = last_input.get("measurements") or {}

        # Consolidate
        data = {
            "user_id": user_id,
            "name": user.get("name"),
            "email": user.get("email"),
            "sex": profile.get("sex") or last_input.get("sex"),
            "age": age or last_input.get("age"),
            "goal": last_input.get("goal"),
            "notes": last_input.get("notes"),
            "measurements": last_measures
        }
        
        return jsonify(data), 200

    except Exception as e:
        logger.error(f"Error fetching full profile: {e}", exc_info=True)
        return jsonify({"error": "Error interno"}), 500


@app.delete("/admin/api/users/<user_id>")
def admin_api_delete_user(user_id):
    """Borrar usuario por completo."""
    ok, err_resp = check_admin_access()
    if not ok: return err_resp

    try:
        # Cascading delete (simple approach)
        db.users.delete_one({"user_id": user_id})
        db.user_roles.delete_many({"user_id": user_id})
        db.user_status.delete_many({"user_id": user_id})
        db.user_profiles.delete_many({"user_id": user_id})
        db.plans.delete_many({"user_id": user_id})
        db.meal_plans.delete_many({"user_id": user_id})
        db.body_assessments.delete_many({"user_id": user_id})
        db.progress.delete_many({"user_id": user_id})
        db.ai_adjustments.delete_many({"user_id": user_id})

        return jsonify({"message": f"Usuario {user_id} eliminado y limpiado."}), 200
    except Exception as e:
        logger.error(f"Error borrando usuario: {e}", exc_info=True)
        return jsonify({"error": "Error interno borrando usuario"}), 500

@app.get("/admin/body_assessments")
def admin_body_assessments_page():
    ok, err_resp = check_admin_access()
    if not ok:
        if "text/html" in request.headers.get("Accept", ""):
            return render_template("admin_auth.html", error=err_resp[0].json.get("error"))
        return err_resp

    resp = make_response(render_template("admin_body_assessments.html"))
    if request.args.get("token"):
        resp.set_cookie("admin_token", request.args.get("token"), httponly=True, samesite="Lax")
    return resp

@app.get("/body_assessments/<user_id>")
def list_body_assessments(user_id: str):
    """Lista evaluaciones de un usuario."""
    # Check simple de DB
    if db is None:
        return jsonify({"error": "DB no inicializada"}), 503

    try:
        limit = int(request.args.get("limit", 20))
        cursor = db.body_assessments.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
        docs = []
        for d in cursor:
            d["_id"] = str(d["_id"])
            if d.get("created_at"):
                d["created_at"] = d["created_at"].isoformat() + "Z"
            docs.append(d)
        return jsonify(docs), 200
    except Exception as e:
        logger.error(f"Error list_body_assessments: {e}")
        return jsonify({"error": str(e)}), 500


@app.post("/plans/<plan_id>/edit")
def edit_plan(plan_id: str):
    """Actualiza campos permitidos de un plan. Requiere X-Admin-Token.

    Campos permitidos (PATCH):
      - nutrition_plan: { calories_per_day, kcal_delta, macros { protein, carbs, fat } }
      - training_plan: { cardio, ai_volumen_delta_ratio }
      - notes: string (o null para borrar)
    """
    try:
        if db is None:
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

        # Nutrition plan
        np = payload.get("nutrition_plan") or {}
        if isinstance(np, dict):
            if "calories_per_day" in np:
                set_fields["nutrition_plan.calories_per_day"] = np.get("calories_per_day")
            if "kcal_delta" in np:
                set_fields["nutrition_plan.kcal_delta"] = np.get("kcal_delta")
            macros = np.get("macros") or {}
            if isinstance(macros, dict):
                for k in ("protein", "carbs", "fat"):
                    if k in macros:
                        set_fields[f"nutrition_plan.macros.{k}"] = macros.get(k)

        # Training plan
        tp = payload.get("training_plan") or {}
        if isinstance(tp, dict):
            if "cardio" in tp:
                set_fields["training_plan.cardio"] = tp.get("cardio")
            if "ai_volumen_delta_ratio" in tp:
                set_fields["training_plan.ai_volumen_delta_ratio"] = tp.get("ai_volumen_delta_ratio")

        # Notes (nullable)
        if "notes" in payload:
            notes_val = payload.get("notes")
            if notes_val is None:
                set_fields["notes"] = None
            else:
                set_fields["notes"] = str(notes_val)

        # Goal (enum)
        if "goal" in payload:
            goal_val = payload.get("goal")
            allowed_goals = {"gain_muscle", "lose_fat", "maintain"}
            if goal_val is not None:
                if goal_val not in allowed_goals:
                    return jsonify({"error": "goal inválido (use: gain_muscle, lose_fat, maintain)"}), 400
                set_fields["goal"] = goal_val
            else:
                # permitir borrar el goal si llega null explícito
                set_fields["goal"] = None

        if not set_fields:
            return jsonify({"error": "Sin cambios"}), 400

        db.plans.update_one({"_id": oid}, {"$set": set_fields})
        doc = db.plans.find_one({"_id": oid})
        if doc:
            doc["_id"] = str(doc["_id"]) if doc.get("_id") is not None else None
        return jsonify({"message": "Plan actualizado", "plan": doc}), 200
    except Exception as e:
        logger.error(f"Error al editar plan: {e}", exc_info=True)
        return jsonify({"error": "Error interno al editar plan"}), 500


# ======================================================
# PLANES: LISTADO Y ACTIVACION
# ======================================================
@app.get("/plans/<user_id>")
def list_plans(user_id: str):
    """Lista planes del usuario (ordenados por fecha desc)."""
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        raw_limit = request.args.get("limit")
        limit = 20
        if raw_limit:
            try:
                v = int(raw_limit)
                if v > 0:
                    limit = v
            except ValueError:
                return jsonify({"error": "'limit' debe ser entero positivo"}), 400

        cursor = db.plans.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
        items = []
        for doc in cursor:
            d = doc.copy()
            d["_id"] = str(d.get("_id"))
            c = d.get("created_at")
            if isinstance(c, datetime):
                d["created_at"] = c.isoformat() + "Z"
            items.append(d)
        return jsonify(items), 200
    except Exception as e:
        logger.error(f"Error al listar planes: {e}", exc_info=True)
        return jsonify({"error": "Error interno al listar planes"}), 500


@app.post("/plans/<plan_id>/activate")
def activate_plan(plan_id: str):
    """Marca un plan como activo para su usuario y desactiva el resto."""
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        
        ok, err = check_admin_access()
        if not ok: return err

        try:
            oid = ObjectId(plan_id)
        except Exception:
            return jsonify({"error": "plan_id invalido"}), 400

        plan = db.plans.find_one({"_id": oid})
        if not plan:
            return jsonify({"error": "Plan no encontrado"}), 404
        user_id = plan.get("user_id")
        if not user_id:
            return jsonify({"error": "Plan sin user_id"}), 400

        try:
            db.plans.update_many({"user_id": user_id}, {"$set": {"active": False}})
        except Exception:
            pass
        db.plans.update_one({"_id": oid}, {"$set": {"active": True, "activated_at": datetime.utcnow()}})
        return jsonify({"message": "Plan activado", "plan_id": plan_id}), 200
    except Exception as e:
        logger.error(f"Error al activar plan: {e}", exc_info=True)
        return jsonify({"error": "Error interno al activar plan"}), 500


@app.post("/plans/<plan_id>/deactivate")
def deactivate_plan(plan_id: str):
    """Desactiva un plan específico. Requiere X-Admin-Token."""
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503
            
        ok, err = check_admin_access()
        if not ok: return err

        try:
            oid = ObjectId(plan_id)
        except Exception:
            return jsonify({"error": "plan_id invalido"}), 400
        res = db.plans.update_one({"_id": oid}, {"$set": {"active": False}})
        if res.matched_count == 0:
            return jsonify({"error": "Plan no encontrado"}), 404
        return jsonify({"message": "Plan desactivado", "plan_id": plan_id}), 200
    except Exception as e:
        logger.error(f"Error al desactivar plan: {e}", exc_info=True)
        return jsonify({"error": "Error interno al desactivar plan"}), 500


@app.delete("/plans/<plan_id>")
def delete_plan(plan_id: str):
    """Elimina un plan. Requiere X-Admin-Token."""
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503
            
        ok, err = check_admin_access()
        if not ok: return err

        try:
            oid = ObjectId(plan_id)
        except Exception:
            return jsonify({"error": "plan_id invalido"}), 400
        res = db.plans.delete_one({"_id": oid})
        if res.deleted_count == 0:
            return jsonify({"error": "Plan no encontrado"}), 404
        return jsonify({"message": "Plan eliminado", "plan_id": plan_id}), 200
    except Exception as e:
        logger.error(f"Error al eliminar plan: {e}", exc_info=True)
        return jsonify({"error": "Error interno al eliminar plan"}), 500


# ======================================================
# MEAL_PLANS (Nutrición): LISTAR, EDITAR, ACTIVAR/DESACTIVAR, BORRAR
# ======================================================

@app.get("/meal_plans/<user_id>")
def list_meal_plans(user_id: str):
    """Lista meal_plans del usuario (ordenados por fecha desc)."""
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        raw_limit = request.args.get("limit")
        limit = 20
        if raw_limit:
            try:
                v = int(raw_limit)
                if v > 0:
                    limit = v
            except ValueError:
                return jsonify({"error": "'limit' debe ser entero positivo"}), 400

        cursor = db.meal_plans.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
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


@app.post("/meal_plans/<plan_id>/edit")
def edit_meal_plan(plan_id: str):
    """Actualiza campos permitidos de un meal_plan. Requiere X-Admin-Token.

    Campos permitidos (PATCH):
      - notes: string (o null para borrar)
      - output: dict completo (opcional)
      - input: dict completo (opcional)
      - plan_id: str (opcional)
    """
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        token = request.headers.get("X-Admin-Token") or request.cookies.get("admin_token")
        admin_token = os.getenv("ADMIN_TOKEN")
        if not admin_token or token != admin_token:
            return jsonify({"error": "No autorizado"}), 403
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

        db.meal_plans.update_one({"_id": oid}, {"$set": set_fields})
        doc = db.meal_plans.find_one({"_id": oid})
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


@app.post("/meal_plans/<plan_id>/activate")
def activate_meal_plan(plan_id: str):
    """Marca un meal_plan como activo y desactiva el resto del usuario. Requiere admin."""
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        
        ok, err = check_admin_access()
        if not ok: return err
        try:
            oid = ObjectId(plan_id)
        except Exception:
            return jsonify({"error": "plan_id invalido"}), 400

        mp = db.meal_plans.find_one({"_id": oid})
        if not mp:
            return jsonify({"error": "Meal plan no encontrado"}), 404
        user_id = mp.get("user_id")
        if not user_id:
            return jsonify({"error": "Meal plan sin user_id"}), 400

        try:
            db.meal_plans.update_many({"user_id": user_id}, {"$set": {"active": False}})
        except Exception:
            pass
        db.meal_plans.update_one({"_id": oid}, {"$set": {"active": True, "activated_at": datetime.utcnow()}})
        return jsonify({"message": "Meal plan activado", "meal_plan_id": plan_id}), 200
    except Exception as e:
        logger.error(f"Error al activar meal_plan: {e}", exc_info=True)
        return jsonify({"error": "Error interno al activar meal_plan"}), 500


@app.post("/meal_plans/<plan_id>/deactivate")
def deactivate_meal_plan(plan_id: str):
    """Desactiva un meal_plan. Requiere X-Admin-Token."""
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        
        ok, err = check_admin_access()
        if not ok: return err
        try:
            oid = ObjectId(plan_id)
        except Exception:
            return jsonify({"error": "plan_id invalido"}), 400
        res = db.meal_plans.update_one({"_id": oid}, {"$set": {"active": False}})
        if res.matched_count == 0:
            return jsonify({"error": "Meal plan no encontrado"}), 404
        return jsonify({"message": "Meal plan desactivado", "meal_plan_id": plan_id}), 200
    except Exception as e:
        logger.error(f"Error al desactivar meal_plan: {e}", exc_info=True)
        return jsonify({"error": "Error interno al desactivar meal_plan"}), 500


@app.delete("/meal_plans/<plan_id>")
def delete_meal_plan(plan_id: str):
    """Elimina un meal_plan. Requiere X-Admin-Token."""
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        
        ok, err = check_admin_access()
        if not ok: return err
        try:
            oid = ObjectId(plan_id)
        except Exception:
            return jsonify({"error": "plan_id invalido"}), 400
        res = db.meal_plans.delete_one({"_id": oid})
        if res.deleted_count == 0:
            return jsonify({"error": "Meal plan no encontrado"}), 404
        return jsonify({"message": "Meal plan eliminado", "meal_plan_id": plan_id}), 200
    except Exception as e:
        logger.error(f"Error al eliminar meal_plan: {e}", exc_info=True)
        return jsonify({"error": "Error interno al eliminar meal_plan"}), 500


@app.get("/plans/<user_id>/active")
def get_active_plan(user_id: str):
    """Devuelve el plan activo del usuario (si existe)."""
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        doc = db.plans.find_one(
            {"user_id": user_id, "active": True},
            sort=[("activated_at", -1), ("created_at", -1)],
        )
        if not doc:
            return jsonify({"error": "Sin plan activo"}), 404
        doc["_id"] = str(doc.get("_id"))
        c = doc.get("created_at")
        if isinstance(c, datetime):
            doc["created_at"] = c.isoformat() + "Z"
        a = doc.get("activated_at")
        if isinstance(a, datetime):
            doc["activated_at"] = a.isoformat() + "Z"
        return jsonify(doc), 200
    except Exception as e:
        logger.error(f"Error obteniendo plan activo: {e}", exc_info=True)
        return jsonify({"error": "Error interno al obtener plan activo"}), 500


@app.post("/ai/adjustments/<user_id>/apply_latest")
def ai_apply_latest_adjustment(user_id: str):
    """Convierte el ajuste AI más reciente en plan y lo activa."""
    try:
        if db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        adj = (
            db.ai_adjustments
            .find({"user_id": user_id})
            .sort("created_at", -1)
            .limit(1)
        )
        adj = list(adj)
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

        # Desactivar otros
        try:
            db.plans.update_many({"user_id": user_id}, {"$set": {"active": False}})
        except Exception:
            pass

        res = db.plans.insert_one(plan_doc)
        plan_doc["_id"] = str(res.inserted_id)
        return jsonify({"message": "Plan creado y activado", "plan": plan_doc}), 201
    except Exception as e:
        logger.error(f"Error aplicando último ajuste AI: {e}", exc_info=True)
        return jsonify({"error": "Error interno al aplicar ajuste"}), 500


# ======================================================
# ENDPOINTS DE PÁGINAS
# ======================================================

@app.route("/")
def index():
    return render_template("auth.html")

@app.route("/admin")
def admin_auth_page():
    return render_template("admin_auth.html")

@app.route("/plan")
def plan_page():
    return render_template("plan.html")

@app.route("/dashboard")
def dashboard_page():
    # Redirige al dashboard directamente
    return render_template("dashboard.html")

@app.route("/nutrition")
def nutrition_page():
    return render_template("nutrition.html")

@app.route("/about")
def about_page():
    return render_template("about.html")

@app.route("/profile")
def profile_page():
    user_id = request.cookies.get("user_session")
    user_context = {}
    if user_id and db is not None:
        try:
            u = db.users.find_one({"user_id": user_id})
            if u:
                user_context = {
                   "user_id": user_id,
                   "name": u.get("name"),
                   "email": u.get("email"),
                   "username": u.get("username"),
                   "role": "user"
                }
                role_doc = db.user_roles.find_one({"user_id": user_id})
                if role_doc:
                    user_context["role"] = role_doc.get("role")
                
                p = db.user_profiles.find_one({"user_id": user_id})
                if p:
                    bdate = p.get("birth_date")
                    if isinstance(bdate, datetime):
                        bdate = bdate.strftime("%Y-%m-%d")
                    user_context.update({
                        "sex": p.get("sex"),
                        "birth_date": bdate,
                        "phone": p.get("phone"),
                        "has_profile": True
                    })
                else:
                    user_context["has_profile"] = False
        except Exception as e:
            logger.error(f"Error loading profile context: {e}")
            pass

    return render_template("profile.html", user_data=user_context)


# ======================================================
# AGENTIC AI: RAZONAMIENTO Y AJUSTES
# ------------------------------------------------------
# QuÃ© hace:
# - Expone endpoints que reciben un contexto JSON (p. ej. historial
#   de progreso) y devuelven ajustes de nutrición/entrenamiento.
#
# Cómo estÃ¡ configurado:
# - Usa ReasoningAgent, que intentarÃ¡ llamar a OpenAI si `OPENAI_API_KEY`
#   estÃ¡ presente. Si falla o no hay clave, hace fallback a un mock local
#   determinÃ­stico (sin red), Útil para pruebas.
# - Modelo configurable con `OPENAI_MODEL` (por defecto: gpt-4o-mini). gpt-5-nano
# ======================================================

@app.post("/ai/reason")
def ai_reason():
    try:
        if not request.is_json:
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415
        payload = request.get_json() or {}
        agent = ReasoningAgent()
        log_agent_execution("start", "ReasoningAgent", agent, payload, {"endpoint": "/ai/reason"})
        result = agent.run(payload)
        log_agent_execution(
            "end",
            "ReasoningAgent",
            agent,
            payload,
            {"endpoint": "/ai/reason", "output_keys": list(result.keys()) if isinstance(result, dict) else None},
        )
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error en ai_reason: {e}", exc_info=True)
        return jsonify({"error": "Error interno al ejecutar el agente"}), 500


@app.get("/ai/reason/sample")
def ai_reason_sample():
    """Ruta de prueba: usa progress.json como contexto.

    Ideal para validar el flujo end-to-end sin depender de red ni API keys,
    ya que el ReasoningAgent harÃ¡ fallback automÃ¡tico al backend mock.
    """
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
        log_agent_execution(
            "end",
            "ReasoningAgent",
            agent,
            payload,
            {
                "endpoint": "/ai/reason/sample",
                "output_keys": list(result.keys()) if isinstance(result, dict) else None,
            },
        )
        return jsonify({"backend": agent.backend(), "input": payload, "output": result}), 200
    except Exception as e:
        logger.error(f"Error en ai_reason_sample: {e}", exc_info=True)
        return jsonify({"error": "Error interno al ejecutar el agente (sample)"}), 500


@app.get("/ai/diagnostics/agents")
def ai_agents_diagnostics():
    """Run a lightweight diagnostic for agent backends and outputs."""
    try:
        reasoning_payload = {
            "progress": [
                {"body_fat": 22.0, "performance": 70, "nutrition_adherence": 85},
                {"body_fat": 21.8, "performance": 72, "nutrition_adherence": 88},
            ]
        }
        body_payload = {
            "sex": "male",
            "age": 30,
            "goal": "definicion",
            "measurements": {
                "weight_kg": 78,
                "height_cm": 178,
                "waist": 86,
                "neck": 40,
                "hip": 98,
            },
        }
        meal_payload = {
            "total_kcal": 2200,
            "meals": 4,
            "macros": {"protein": 160, "carbs": 250, "fat": 70},
        }

        agents = [
            ("ReasoningAgent", ReasoningAgent(), reasoning_payload),
            ("ReasoningAgentLegacy", LegacyReasoningAgent(), reasoning_payload),
            ("BodyAssessmentAgent", BodyAssessmentAgent(), body_payload),
            ("MealPlanAgent", MealPlanAgent(), meal_payload),
        ]

        results = []
        for name, agent, payload in agents:
            log_agent_execution(
                "start",
                name,
                agent,
                payload,
                {"endpoint": "/ai/diagnostics/agents"},
            )
            output = agent.run(payload)
            log_agent_execution(
                "end",
                name,
                agent,
                payload,
                {
                    "endpoint": "/ai/diagnostics/agents",
                    "output_keys": list(output.keys()) if isinstance(output, dict) else None,
                },
            )
            results.append(
                {
                    "agent": name,
                    "backend": agent.backend(),
                    "input": payload,
                    "output": output,
                }
            )

        return jsonify({"results": results}), 200
    except Exception as e:
        logger.error(f"Error en ai_agents_diagnostics: {e}", exc_info=True)
        return jsonify({"error": "Error interno en diagnostico de agentes"}), 500


@app.get("/ai/reason/<user_id>")
def ai_reason_user(user_id):
    """Genera nuevos ajustes AI para un usuario basándose en su progreso."""
    try:
        user = db.users.find_one({"user_id": user_id})
        progress_recs = list(db.progress.find({"user_id": user_id}).sort("date", 1))
        
        # Limpieza de datos
        clean_progress = []
        for p in progress_recs:
            p["_id"] = str(p["_id"])
            if isinstance(p.get("date"), datetime):
                p["date"] = p["date"].isoformat()
            clean_progress.append(p)
            
        context = {
            "user": {"user_id": user_id},
            "progress": clean_progress
        }
        
        # Intentar obtener objetivo del plan activo
        active_plan = db.plans.find_one({"user_id": user_id, "active": True})
        if active_plan:
            context["user"]["goal"] = active_plan.get("goal")
        elif user:
            context["user"]["goal"] = user.get("goal")
            
        agent = ReasoningAgent()
        log_agent_execution(
            "start",
            "ReasoningAgent",
            agent,
            context,
            {"endpoint": "/ai/reason/<user_id>", "user_id": user_id},
        )
        result = agent.run(context)
        log_agent_execution(
            "end",
            "ReasoningAgent",
            agent,
            context,
            {
                "endpoint": "/ai/reason/<user_id>",
                "user_id": user_id,
                "output_keys": list(result.keys()) if isinstance(result, dict) else None,
            },
        )
        
        # Guardar resultado
        record = {
            "user_id": user_id,
            "created_at": datetime.utcnow(),
            "output": result,
            "backend": agent.backend()
        }
        res = db.ai_adjustments.insert_one(record)
        record["_id"] = str(res.inserted_id)
        
        return jsonify({"output": result, "record": record}), 200
    except Exception as e:
        logger.error(f"Error en ai_reason_user: {e}", exc_info=True)
        return jsonify({"error": "Error interno al generar razonamiento"}), 500


@app.get("/ai/adjustments/<user_id>")
def get_ai_adjustments_history(user_id):
    """Obtiene el historial de ajustes AI de un usuario."""
    try:
        limit = int(request.args.get("limit", 10))
        docs = list(db.ai_adjustments.find({"user_id": user_id}).sort("created_at", -1).limit(limit))
        for d in docs:
            d["_id"] = str(d["_id"])
            if isinstance(d.get("created_at"), datetime):
                # ISO simplificado o string
                d["created_at"] = d["created_at"].isoformat() + "Z"
        return jsonify(docs), 200
    except Exception as e:
        logger.error(f"Error al obtener historial de ajustes: {e}", exc_info=True)
        return jsonify({"error": "Error interno al obtener historial"}), 500


# ======================================================
# ENDPOINTS DE DATOS
# ======================================================

# ?? Obtener Último plan del usuario
@app.route("/get_user_plan/<user_id>", methods=["GET"])
def get_user_plan(user_id):
    try:
        plan = db.plans.find_one({"user_id": user_id}, sort=[("created_at", -1)])
        if not plan:
            return jsonify({"error": "No se encontró un plan para este usuario"}), 404
        plan["_id"] = str(plan["_id"])
        return jsonify(plan), 200
    except Exception as e:
        logger.error(f"âŒ Error al obtener plan de {user_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno al obtener el plan"}), 500


# ?? Obtener registros de progreso
@app.route("/get_progress/<user_id>", methods=["GET"])
def get_progress(user_id):
    try:
        records = list(db.progress.find({"user_id": user_id}).sort("date", 1))
        for r in records:
            r["_id"] = str(r["_id"])
        if not records:
            return jsonify({"error": "No hay registros de progreso para este usuario"}), 404
        return jsonify(records), 200
    except Exception as e:
        logger.error(f"âŒ Error al obtener progreso de {user_id}: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno al obtener progreso"}), 500


# ?? Generar plan de entrenamiento y nutrición
@app.route("/generate_plan", methods=["POST"])
def generate_plan():
    try:
        if not request.is_json:
            logger.warning("Solicitud sin formato JSON")
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415

        user = request.get_json()
        valid, message = validate_user_input(user)
        if not valid:
            return jsonify({"error": message}), 400

        weight = float(user["weight_kg"])
        goal = user["goal"]

        # === Lógica base IA Fitness === #
        if goal == "gain_muscle":
            calories = weight * 36
            macros = {"protein": 2.2 * weight, "carbs": 5 * weight, "fat": 0.9 * weight}
            routines = ["Pecho y TrÃ­ceps", "Espalda y BÃ­ceps", "Piernas", "Hombros", "Core"]
        elif goal == "lose_fat":
            calories = weight * 28
            macros = {"protein": 2 * weight, "carbs": 2.5 * weight, "fat": 0.8 * weight}
            routines = ["Full Body", "Cardio", "Core"]
        else:
            calories = weight * 32
            macros = {"protein": 2 * weight, "carbs": 3.5 * weight, "fat": 0.85 * weight}
            routines = ["Upper Body", "Lower Body", "Core"]

        plan = {
            "user_id": user["user_id"],
            "goal": goal,
            "nutrition_plan": {
                "calories_per_day": calories,
                "macros": macros
            },
            "training_plan": {
                "days_per_week": len(routines),
                "routines": routines
            },
            "created_at": datetime.utcnow()
        }

        result = db.plans.insert_one(plan)
        plan["plan_id"] = str(result.inserted_id)

        logger.info(f"ðŸŽ¯ Plan generado correctamente para {user['_id']}")
        return jsonify(plan), 201

    except Exception as e:
        logger.error(f"âŒ Error al generar plan: {str(e)}", exc_info=True)
        return jsonify({"error": "Error interno al generar plan"}), 500



# ======================================================
# AUTENTICACION: REGISTRO E INICIO DE SESION
# ======================================================

@app.post("/auth/register")
def auth_register():
    try:
        if not request.is_json:
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415

        data = request.get_json() or {}
        name = (data.get("name") or "").strip()
        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not name or not username or not email or not password:
            return jsonify({"error": "Nombre, usuario, email y Contraseña son obligatorios."}), 400
        if not re.fullmatch(r"[A-Za-z0-9_.-]{3,20}", username):
            return jsonify({"error": "El usuario debe tener de 3 a 20 caracteres alfanumÃ©ricos (._- permitidos)."}), 400
        if "@" not in email:
            return jsonify({"error": "El email no es vÃ¡lido."}), 400
        if len(password) < 8:
            return jsonify({"error": "La Contraseña debe tener al menos 8 caracteres."}), 400

        username_lower = username.lower()
        if db.users.find_one({"username_lower": username_lower}):
            return jsonify({"error": "El usuario ya estÃ¡ en uso."}), 409

        pwd_hash = generate_password_hash(password, method="pbkdf2:sha256", salt_length=16)
        doc = {
            "name": name,
            "username": username,
            "username_lower": username_lower,
            "email": email,
            "password_hash": pwd_hash,
            "created_at": datetime.utcnow(),
        }
        res = db.users.insert_one(doc)
        try:
            db.users.update_one({"_id": res.inserted_id}, {"$set": {"user_id": str(res.inserted_id)}})
        except Exception:
            pass
        user_id = str(res.inserted_id)
        try:
            db.user_status.update_one(
                {"user_id": user_id},
                {"$set": {"status": "pending", "updated_at": datetime.utcnow()}},
                upsert=True,
            )
        except Exception:
            pass
        user = {"user_id": user_id, "name": name, "username": username, "email": email, "status": "pending"}
        logger.info(f"Usuario registrado: {email} ({username})")
        return jsonify({"message": "Registro exitoso", "user": user}), 201

    except mongo_errors.DuplicateKeyError as e:
        message = "El email ya estÃ¡ registrado."
        try:
            key_pattern = e.details.get("keyPattern") if e.details else {}
            if key_pattern and "username_lower" in key_pattern:
                message = "El usuario ya estÃ¡ en uso."
        except Exception:
            pass
        return jsonify({"error": message}), 409
    except Exception as e:
        logger.error(f"Error en registro: {e}", exc_info=True)
        return jsonify({"error": "Error interno en registro"}), 500


@app.post("/auth/login")
def auth_login_api():
    try:
        if not request.is_json:
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415
        data = request.get_json() or {}
        identifier = (data.get("identifier") or data.get("email") or data.get("username") or "").strip()
        password = data.get("password") or ""
        if not identifier or not password:
            return jsonify({"error": "Email o usuario y Contraseña son obligatorios."}), 400

        identifier_lower = identifier.lower()
        lookup_field = "email" if "@" in identifier else "username_lower"
        u = db.users.find_one({lookup_field: identifier_lower})
        if not u or not check_password_hash(u.get("password_hash", ""), password):
            return jsonify({"error": "Credenciales invÃ¡lidas."}), 401

        user_id = str(u.get("user_id") or u["_id"])
        status = ensure_user_status(user_id, default_status=USER_STATUS_DEFAULT)
        if status != "active":
            if status == "pending":
                return jsonify({"error": "Cuenta pendiente de activacion por admin.", "status": status}), 403
            if status == "suspended":
                return jsonify({"error": "Cuenta suspendida. Contacta a soporte.", "status": status}), 403
            if status == "inactive":
                return jsonify({"error": "Cuenta inactiva. Contacta a soporte.", "status": status}), 403
            return jsonify({"error": "Cuenta no activa.", "status": status}), 403

        user = {
            "user_id": user_id,
            "name": u.get("name"),
            "username": u.get("username"),
            "email": u.get("email"),
            "status": status,
        }
        logger.info(f"Usuario accedió: {u.get('email')} ({u.get('username')})")
        
        resp = jsonify({"message": "Inicio de sesión exitoso", "user": user})
        resp.set_cookie("user_session", user["user_id"], httponly=True, samesite="Lax", max_age=86400*30)
        return resp, 200

    except Exception as e:
        logger.error(f"Error en login: {e}", exc_info=True)
        return jsonify({"error": "Error interno en inicio de sesión"}), 500

@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": "Bad Request", "message": str(e)}), 400

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not Found", "message": "La ruta solicitada no existe."}), 404

@app.errorhandler(500)
def server_error(e):
    logger.error("Error 500: %s", traceback.format_exc())
    return jsonify({"error": "Internal Server Error", "message": "Ocurrió un error inesperado."}), 500


# ======================================================
# INDEXACION AUTOMATICA (MongoDB)
# ======================================================
def seed_user_statuses():
    """Backfill user_status collection for existing users as active."""
    if db is None:
        return
    try:
        cursor = db.users.find({}, {"user_id": 1})
        for u in cursor:
            uid = str(u.get("user_id") or u.get("_id") or "").strip()
            if not uid:
                continue
            db.user_status.update_one(
                {"user_id": uid},
                {
                    "$setOnInsert": {
                        "status": USER_STATUS_DEFAULT,
                        "updated_at": datetime.utcnow(),
                    }
                },
                upsert=True,
            )
    except Exception as e:
        logger.warning(f"No se pudo backfill user_status: {e}")

try:
    db.plans.create_index([("user_id", 1), ("created_at", -1)])
    try:
        db.ai_adjustments.create_index([("user_id", 1), ("created_at", -1)])
    except Exception:
        pass
    try:
        existing_indexes = db.users.index_information()
        for idx_name in ("user_id_1", "user_name_lower_1"):
            if idx_name in existing_indexes:
                db.users.drop_index(idx_name)
                logger.info(f"Indice obsoleto eliminado: {idx_name}")
    except Exception as drop_err:
        logger.warning(f"No se pudo limpiar indices obsoletos: {drop_err}")
    try:
        db.users.create_index("email", unique=True)
    except Exception:
        pass
    try:
        db.users.create_index("username_lower", unique=True, sparse=True)
    except Exception:
        pass
    try:
        db.user_status.create_index("user_id", unique=True)
    except Exception:
        pass
    try:
        db.user_profiles.create_index("user_id", unique=True)
    except Exception:
        pass
    seed_user_statuses()
    logger.info("Ok. Indices creados: plans.user_id+created_at, ai_adjustments.user_id+created_at")
except Exception as e:
    logger.warning(f"No se pudieron crear indices: {e}")

# ======================================================
# MANEJADORES DE ERRORES GLOBALES
# ======================================================

@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": "Bad Request", "message": str(e)}), 400

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not Found", "message": "La ruta solicitada no existe."}), 404

@app.errorhandler(500)
def server_error(e):
    logger.error("Error 500: %s", traceback.format_exc())
    return jsonify({"error": "Internal Server Error", "message": "Ocurrió un error inesperado."}), 500


# ======================================================

# ======================================================
# EJECUCIÓN LOCAL
# ======================================================
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000, use_reloader=False)









