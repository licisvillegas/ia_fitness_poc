"""
Blueprint de Autenticación y Helpers
"""
import os
from dotenv import load_dotenv
import secrets
from flask import request, jsonify
import extensions
from extensions import logger, db

load_dotenv()

from datetime import datetime

USER_STATUS_VALUES = {"active", "inactive", "suspended", "pending", "expired"}
USER_STATUS_DEFAULT = "active"

def ensure_user_status(user_id: str, default_status: str = "active") -> str:
    """
    Asegura que el usuario tenga un status en user_status.
    Verifica la fecha de vigencia (valid_until) y expira si corresponde.
    """
    if not user_id or extensions.db is None:
        return default_status
    
    try:
        status_doc = extensions.db.user_status.find_one({"user_id": user_id})
        
        # 1. Crear si no existe
        if not status_doc:
            extensions.db.user_status.insert_one({
                "user_id": user_id,
                "status": default_status,
                "created_at": datetime.utcnow()
            })
            return default_status
            
        current_status = status_doc.get("status", default_status)
        
        # 2. Verificar Vigencia (Solo si está activo)
        valid_until = status_doc.get("valid_until")
        if current_status == "active" and valid_until:
             # Si valid_until es string iso, convertirlo (por seguridad, aunque deberia ser datetime)
             if isinstance(valid_until, str):
                 try:
                     valid_until = datetime.fromisoformat(valid_until.replace("Z", "+00:00"))
                 except:
                     pass # Fallback or ignore
             
             if isinstance(valid_until, datetime) and datetime.utcnow() > valid_until:
                 # EXPIRAR USUARIO
                 extensions.db.user_status.update_one(
                     {"user_id": user_id},
                     {
                         "$set": {
                             "status": "expired", 
                             "updated_at": datetime.utcnow(),
                             "expired_at": datetime.utcnow()
                         }
                     }
                 )
                 logger.info(f"Usuario {user_id} ha expirado automáticamente (Vencía: {valid_until}).")
                 return "expired"

        return current_status
    except Exception as e:
        logger.error(f"Error en ensure_user_status: {e}")
        return default_status


def is_user_active(user_id: str) -> bool:
    """Verifica si un usuario está activo"""
    status = ensure_user_status(user_id)
    return status == "active"


def get_admin_token():
    """Obtiene el token de administrador desde variables de entorno"""
    return os.getenv("ADMIN_TOKEN")

def generate_admin_csrf():
    """Genera un token CSRF para acciones admin."""
    return secrets.token_urlsafe(32)

def validate_admin_csrf():
    """Valida el token CSRF enviado por header contra la cookie."""
    header_token = request.headers.get("X-CSRF-Token") or request.headers.get("X-Admin-CSRF")
    cookie_token = request.cookies.get("admin_csrf")
    if not header_token or not cookie_token or header_token != cookie_token:
        return False, (jsonify({"error": "CSRF invalido o ausente"}), 403)
    return True, None

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
        request.cookies.get("admin_token")
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

def generate_referral_code(prefix="fit"):
    """Genera un código de referidos único."""
    import string
    import random
    chars = string.ascii_uppercase + string.digits
    body = ''.join(random.choices(chars, k=6))
    return f"{prefix.upper()}-{body}"

def check_role_access(allowed_roles=None):
    """
    Valida token de admin Y rol específico en DB.
    allowed_roles: lista de roles permitidos (ej: ['admin', 'coach'])
    Retorna: (is_valid, response_tuple_if_error, user_role)
    """
    if allowed_roles is None:
        allowed_roles = ["admin"]

    # Reutiliza lógica base de token pero añade flexibilidad de roles
    # 1. Check Token ENV var existence
    admin_token = get_admin_token()
    if not admin_token:
        return False, (jsonify({"error": "ADMIN_TOKEN no configurado"}), 503), None

    # 2. Check Provided Token
    provided = (
        request.cookies.get("admin_token")
        or request.headers.get("X-Admin-Token")
    )
    if provided != admin_token:
        return False, (jsonify({"error": "Token de seguridad inválido o ausente"}), 403), None

    # 3. Check User Session
    user_id = request.cookies.get("user_session")
    if not user_id:
        return False, (jsonify({"error": "Sesión de usuario requerida."}), 403), None
    
    if not is_user_active(user_id):
        return False, (jsonify({"error": "Usuario inactivo."}), 403), None

    if extensions.db is None:
         return False, (jsonify({"error": "DB not available"}), 503), None

    role_doc = extensions.db.user_roles.find_one({"user_id": user_id})
    if not role_doc:
        return False, (jsonify({"error": "No tienes roles asignados"}), 403), None
    
    user_role = role_doc.get("role")
    
    # "admin" siempre debería tener acceso si se pide "coach"? 
    # Depende de la lógica. Por ahora estricta:
    # Si pedimos ['coach'], un 'admin' debería poder entrar? Generalmente SÍ (super user).
    # Vamos a asumir que 'admin' es supeconjunto de todo.
    
    effective_allowed = set(allowed_roles)
    if "admin" in user_role: # Si el usuario es admin, pasa (asumiendo jerarquia simple)
        pass 
    elif user_role not in effective_allowed:
        return False, (jsonify({"error": f"Acceso denegado. Rol requerido: {allowed_roles}"}), 403), user_role

    return True, None, user_role
