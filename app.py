# ======================================================
# AI FITNESS - BACKEND FLASK FINAL
# ======================================================

from flask import Flask, request, jsonify, render_template, make_response
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import os
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
logger.info("✔ Aplicación AI Fitness iniciada correctamente")

# ======================================================
# CONEXIÓN MONGODB
# ======================================================
#try:
#    import certifi
#    client = MongoClient(os.getenv("MONGO_URI"))
#    db = client[os.getenv("MONGO_DB")]
#    logger.info("✔ Conexión exitosa con MongoDB Atlas")
#except Exception as e:
#    logger.error(f"❌ Error al conectar a MongoDB: {str(e)}", exc_info=True)
#    db = None


# === Conexión MongoDB Atlas (versión final compatible PyMongo 4.7+) === #
try:
    import certifi
    from pymongo import MongoClient

    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        raise ValueError("❌ No se encontró la variable MONGO_URI en el entorno")

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
    logger.info("✔ Conexión segura con MongoDB Atlas establecida correctamente")

except Exception as e:
    logger.error(f"❌ Error al conectar a MongoDB Atlas: {str(e)}", exc_info=True)
    db = None


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
        result = agent.run(context)

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


@app.post("/ai/body_assessment")
def ai_body_assessment():
    """Genera evaluación corporal a partir de medidas y fotos."""

    try:
        payload = request.get_json(silent=True) or {}
        measurements_raw = payload.get("measurements")
        if not isinstance(measurements_raw, dict):
            return jsonify({"error": "'measurements' debe ser un objeto con las medidas"}), 400

        measurements = normalize_measurements(measurements_raw)

        required = ["height_cm", "weight_kg"]
        if not (measurements.get("waist") or measurements.get("abdomen")):
            required.append("waist/abdomen")
        missing = [key for key in required if measurements.get(key if key != "waist/abdomen" else "waist") is None and key != "waist/abdomen"]
        if "waist/abdomen" in required and not (measurements.get("waist") or measurements.get("abdomen")):
            missing.append("waist o abdomen")

        if missing:
            return (
                jsonify({"error": f"Faltan medidas requeridas: {', '.join(missing)}"}),
                400,
            )

        context = {
            "user_id": payload.get("user_id"),
            "sex": (payload.get("sex") or "male").lower(),
            "age": payload.get("age"),
            "goal": payload.get("goal"),
            "measurements": measurements,
            "photos": sanitize_photos(payload.get("photos")),
            "notes": payload.get("notes"),
        }

        agent = BodyAssessmentAgent()
        result = agent.run(context)

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
        result = agent.run(context)
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
@app.get("/admin/plans")
def admin_plans_page():
    admin_token = os.getenv("ADMIN_TOKEN")
    if not admin_token:
        return jsonify({"error": "ADMIN_TOKEN no configurado"}), 503

    provided = request.args.get("token") or request.cookies.get("admin_token") or request.headers.get("X-Admin-Token")
    if provided != admin_token:
        return (
            "No autorizado. Proporcione ?token=ADMIN_TOKEN o header X-Admin-Token.",
            403,
        )

    resp = make_response(render_template("admin_plans.html"))
    if request.args.get("token"):
        # Guarda cookie de sesión simple para navegar sin repetir el token
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
    admin_token = os.getenv("ADMIN_TOKEN")
    if not admin_token:
        return jsonify({"error": "ADMIN_TOKEN no configurado"}), 503

    provided = (
        request.args.get("token")
        or request.cookies.get("admin_token")
        or request.headers.get("X-Admin-Token")
    )
    if provided != admin_token:
        return (
            "No autorizado. Proporcione ?token=ADMIN_TOKEN o header X-Admin-Token.",
            403,
        )

    resp = make_response(render_template("admin_meal_plans.html"))
    if request.args.get("token"):
        resp.set_cookie("admin_token", request.args.get("token"), httponly=True, samesite="Lax")
    return resp


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
        token = request.headers.get("X-Admin-Token") or request.cookies.get("admin_token")
        admin_token = os.getenv("ADMIN_TOKEN")
        if not admin_token or token != admin_token:
            return jsonify({"error": "No autorizado"}), 403
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
        token = request.headers.get("X-Admin-Token") or request.cookies.get("admin_token")
        admin_token = os.getenv("ADMIN_TOKEN")
        if not admin_token or token != admin_token:
            return jsonify({"error": "No autorizado"}), 403
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
        token = request.headers.get("X-Admin-Token") or request.cookies.get("admin_token")
        admin_token = os.getenv("ADMIN_TOKEN")
        if not admin_token or token != admin_token:
            return jsonify({"error": "No autorizado"}), 403
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
        token = request.headers.get("X-Admin-Token") or request.cookies.get("admin_token")
        admin_token = os.getenv("ADMIN_TOKEN")
        if not admin_token or token != admin_token:
            return jsonify({"error": "No autorizado"}), 403
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
        token = request.headers.get("X-Admin-Token") or request.cookies.get("admin_token")
        admin_token = os.getenv("ADMIN_TOKEN")
        if not admin_token or token != admin_token:
            return jsonify({"error": "No autorizado"}), 403
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
        result = agent.run(payload)
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
        result = agent.run(payload)
        return jsonify({"backend": agent.backend(), "input": payload, "output": result}), 200
    except Exception as e:
        logger.error(f"Error en ai_reason_sample: {e}", exc_info=True)
        return jsonify({"error": "Error interno al ejecutar el agente (sample)"}), 500


# ======================================================
# ENDPOINTS DE DATOS
# ======================================================

# 📅 Obtener Último plan del usuario
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


# 📅 Obtener registros de progreso
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


# 📅 Generar plan de entrenamiento y nutrición
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
            return jsonify({"error": "Nombre, usuario, email y contraseÃ±a son obligatorios."}), 400
        if not re.fullmatch(r"[A-Za-z0-9_.-]{3,20}", username):
            return jsonify({"error": "El usuario debe tener de 3 a 20 caracteres alfanumÃ©ricos (._- permitidos)."}), 400
        if "@" not in email:
            return jsonify({"error": "El email no es vÃ¡lido."}), 400
        if len(password) < 8:
            return jsonify({"error": "La contraseÃ±a debe tener al menos 8 caracteres."}), 400

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
        user = {"user_id": str(res.inserted_id), "name": name, "username": username, "email": email}
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
            return jsonify({"error": "Email o usuario y contraseÃ±a son obligatorios."}), 400

        identifier_lower = identifier.lower()
        lookup_field = "email" if "@" in identifier else "username_lower"
        u = db.users.find_one({lookup_field: identifier_lower})
        if not u or not check_password_hash(u.get("password_hash", ""), password):
            return jsonify({"error": "Credenciales invÃ¡lidas."}), 401

        user = {
            "user_id": str(u.get("user_id") or u["_id"]),
            "name": u.get("name"),
            "username": u.get("username"),
            "email": u.get("email"),
        }
        logger.info(f"Usuario accedió: {u.get('email')} ({u.get('username')})")
        return jsonify({"message": "Inicio de sesión exitoso", "user": user}), 200

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
# INDEXACIÓN AUTOMÁTICA (MongoDB)
# ======================================================
try:
    db.plans.create_index([("user_id", 1), ("created_at", -1)])
    # index for ai adjustments
    try:
        db.ai_adjustments.create_index([("user_id", 1), ("created_at", -1)])
    except Exception:
        pass
    try:
        existing_indexes = db.users.index_information()
        for idx_name in ("user_id_1", "user_name_lower_1"):
            if idx_name in existing_indexes:
                db.users.drop_index(idx_name)
                logger.info(f"Ãndice obsoleto eliminado: {idx_name}")
    except Exception as drop_err:
        logger.warning(f"No se pudo limpiar Ã­ndices obsoletos: {drop_err}")
    # Ãndice Único por email en colección de usuarios
    try:
        db.users.create_index("email", unique=True)
    except Exception:
        pass
    try:
        db.users.create_index("username_lower", unique=True, sparse=True)
    except Exception:
        pass
    logger.info("Ok. Índices creados: plans.user_id+created_at, ai_adjustments.user_id+created_at")
except Exception as e:
    logger.warning(f"No se pudieron crear índices: {e}")





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
    app.run(debug=True, host="0.0.0.0", port=5000)
