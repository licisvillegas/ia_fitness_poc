"""
Blueprint de Autenticación y Helpers
"""
import os
from flask import request, jsonify
import extensions
from extensions import logger, db

USER_STATUS_VALUES = {"active", "inactive", "suspended", "pending"}
USER_STATUS_DEFAULT = "active"

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
    return os.getenv("ADMIN_TOKEN", "admin15M9")

def check_admin_access():
    """Valida token Y rol de administrador en DB.
    Retorna: (is_valid, response_tuple_if_error)
    """
    admin_token = get_admin_token()
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
    if extensions.db is None:
         return False, (jsonify({"error": "DB not available"}), 503)

    role_doc = extensions.db.user_roles.find_one({"user_id": user_id})
    if not role_doc:
        logger.warning(f"check_admin_access: User {user_id} has no role entry in user_roles")
        return False, (jsonify({"error": "No tienes roles asignados. Pide a otro admin que te asigne el rol."}), 403)
    
    if role_doc.get("role") != "admin":
        logger.warning(f"check_admin_access: User {user_id} has role '{role_doc.get('role')}', expected 'admin'")
        return False, (jsonify({"error": "No tiene privilegios de administrador (Rol insuficiente)"}), 403)

    return True, None
