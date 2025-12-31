"""
Blueprint de Autenticación y Helpers
"""
import extensions
from extensions import logger


def ensure_user_status(user_id: str, default_status: str = "active") -> str:
    """
    Asegura que el usuario tenga un status en user_status.
    Si no existe, lo crea con el status por defecto.
    Retorna el status actual del usuario.
    """
    if not user_id or extensions.db is None:
        return default_status
    
    try:
        status_doc = extensions.db.user_status.find_one({"user_id": user_id})
        if not status_doc:
            extensions.db.user_status.insert_one({
                "user_id": user_id,
                "status": default_status
            })
            return default_status
        return status_doc.get("status", default_status)
    except Exception as e:
        logger.error(f"Error en ensure_user_status: {e}")
        return default_status


def is_user_active(user_id: str) -> bool:
    """Verifica si un usuario está activo"""
    status = ensure_user_status(user_id)
    return status == "active"


def get_admin_token():
    """Obtiene el token de administrador desde variables de entorno"""
    import os
    return os.getenv("ADMIN_TOKEN", "admin15M9")
