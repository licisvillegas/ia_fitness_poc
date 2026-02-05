from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
from extensions import db, logger
from bson import ObjectId

integrations_bp = Blueprint('integrations', __name__)

@integrations_bp.post('/apple-health')
def sync_apple_health():
    """
    Recibe métricas de salud desde un Atajo de iOS (Shortcuts).
    Payload esperado:
    {
        "user_id": "...",
        "metrics": {
            "steps": 123,
            "calories": 45,
            "heart_rate": 78
        },
        "source": "apple_health_shortcut"
    }
    """
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        user_id = data.get("user_id")
        metrics = data.get("metrics", {})
        
        if not user_id:
            return jsonify({"error": "Missing user_id"}), 400

        # Validar que el usuario existe (opcional pero recomendado)
        # user = db.users.find_one({"_id": ObjectId(user_id)})
        # if not user:
        #    return jsonify({"error": "User not found"}), 404

        # Estructura del documento a guardar
        health_entry = {
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc),
            "source": data.get("source", "apple_health_shortcut"),
            "metrics": metrics,
            "raw_data": data # Guardamos todo por si acaso
        }

        # Guardar en colección específica de métricas externas
        result = db.external_health_metrics.insert_one(health_entry)

        logger.info(f"Apple Health data received for user {user_id}: {metrics}")

        return jsonify({
            "status": "success", 
            "message": "Data received", 
            "id": str(result.inserted_id)
        }), 201

    except Exception as e:
        logger.error(f"Error processing Apple Health sync: {str(e)}")
        return jsonify({"error": "Internal Server Error", "details": str(e)}), 500
