from datetime import datetime
from typing import Optional, Dict, Any, List
from extensions import db, logger
import extensions

USER_STATUS_VALUES = {"active", "inactive", "suspended", "pending"}
USER_STATUS_DEFAULT = "active"

def validate_user_input(user):
    """Valida los campos obligatorios antes de generar el plan"""
    required_fields = ["user_id", "weight_kg", "goal"]
    missing = [f for f in required_fields if f not in user]

    if missing:
        return False, f"Faltan los campos requeridos: {', '.join(missing)}"
    if not isinstance(user["weight_kg"], (int, float)):
        return False, "El campo 'weight_kg' debe ser numérico."
    if user["goal"] not in ["gain_muscle", "lose_fat", "maintain"]:
        return False, "El campo 'goal' debe ser uno de: gain_muscle, lose_fat, maintain."
    return True, None

def normalize_user_status(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    status = str(value).strip().lower()
    if status in USER_STATUS_VALUES:
        return status
    return None


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
    """
    try:
        if extensions.db is None:
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

        cursor = extensions.db.progress.find({"user_id": user_id}, projection=projection).sort("date", 1)
        items = list(cursor)

        if limit is not None and isinstance(limit, int) and limit > 0:
            items = items[-limit:]

        normalized = []
        for it in items:
            d = it.get("date")
            if isinstance(d, datetime):
                date_str = d.strftime("%Y-%m-%d")
            else:
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
                    "url": str(item.get("url", "")).strip() or None,
                }
            )
    return sanitized
