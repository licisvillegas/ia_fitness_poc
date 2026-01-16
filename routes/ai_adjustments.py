from flask import Blueprint, request, jsonify
from datetime import datetime
from bson import ObjectId

import extensions
from extensions import logger
from utils.id_helpers import normalize_user_id

ai_adjustments_bp = Blueprint("ai_adjustments", __name__)


@ai_adjustments_bp.get("/ai/adjustments/<user_id>")
def ai_get_adjustments(user_id: str):
    """Devuelve el historial de ajustes AI para un usuario."""
    try:
        user_id = normalize_user_id(user_id)
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        raw_limit = request.args.get("limit")
        limit = 10
        if raw_limit:
            try:
                val = int(raw_limit)
                if val > 0:
                    limit = val
            except ValueError:
                pass

        cursor = (
            extensions.db.ai_adjustments.find({"user_id": user_id})
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
            items.append(
                {
                    "_id": doc_id,
                    "user_id": doc.get("user_id"),
                    "backend": doc.get("backend"),
                    "input": doc.get("input"),
                    "output": doc.get("output"),
                    "created_at": created_str,
                }
            )
        return jsonify(items), 200
    except Exception as e:
        logger.error(f"Error listando historial de ajustes AI: {e}", exc_info=True)
        return jsonify({"error": "Error interno listando historial"}), 500


@ai_adjustments_bp.post("/ai/adjustments/<adjustment_id>/save_plan")
def ai_save_adjustment_as_plan(adjustment_id: str):
    try:
        if extensions.db is None:
            return jsonify({"error": "DB no inicializada"}), 503
        try:
            oid = ObjectId(adjustment_id)
        except Exception:
            return jsonify({"error": "adjustment_id invalido"}), 400

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


@ai_adjustments_bp.post("/ai/adjustments/<user_id>/apply_latest")
def ai_apply_latest_adjustment(user_id: str):
    """Convierte el ajuste AI mas reciente en plan y lo activa."""
    try:
        user_id = normalize_user_id(user_id)
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
        logger.error(f"Error aplicando ultimo ajuste AI: {e}", exc_info=True)
        return jsonify({"error": "Error interno al aplicar ajuste"}), 500
