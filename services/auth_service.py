from datetime import datetime
import re
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import errors as mongo_errors
from bson import ObjectId

from services.base_service import BaseService
from utils.auth_helpers import (
    ensure_user_status, 
    get_admin_token, 
    generate_admin_csrf, 
    USER_STATUS_DEFAULT
)
from utils.audit import log_audit_event
from extensions import logger

class AuthService(BaseService):
    def register_user(self, data):
        """
        Registra un nuevo usuario.
        Retorna (user_data, error_message, status_code)
        """
        name = (data.get("name") or "").strip()
        username = (data.get("username") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not name or not username or not email or not password:
            return None, "Nombre, usuario, email y Contraseña son obligatorios.", 400
        
        if not re.fullmatch(r"[A-Za-z0-9_.-]{3,20}", username):
            return None, "El usuario debe tener de 3 a 20 caracteres alfanuméricos (._- permitidos).", 400
        
        if "@" not in email:
            return None, "El email no es válido.", 400
        
        if len(password) < 8:
            return None, "La Contraseña debe tener al menos 8 caracteres.", 400

        username_lower = username.lower()
        if self.db.users.find_one({"username_lower": username_lower}):
            return None, "El usuario ya está en uso.", 409

        try:
            pwd_hash = generate_password_hash(password, method="pbkdf2:sha256", salt_length=16)
            doc = {
                "name": name,
                "username": username,
                "username_lower": username_lower,
                "email": email,
                "password_hash": pwd_hash,
                "created_at": datetime.utcnow(),
            }
            
            # Referral / Coach Linking Logic
            referral_code = (data.get("referral_code") or "").strip().upper()
            if referral_code:
                coach = self.db.users.find_one({"own_referral_code": referral_code})
                if coach:
                    coach_id = coach.get("user_id") or str(coach["_id"])
                    doc["coach_id"] = coach_id
                    doc["upline_code"] = referral_code
                    self.logger.info(f"Usuario {username} vinculado a coach (Code: {referral_code})")
                    
                    # Notifications handled by the route or a notification service?
                    # For now, let's keep the logic here to ensure it's not lost.
                    self._send_coach_notifications(coach_id, name, username)
                else:
                    self.logger.warning(f"Usuario {username} intentó usar código inválido: {referral_code}")

            res = self.db.users.insert_one(doc)
            user_id = str(res.inserted_id)
            self.db.users.update_one({"_id": res.inserted_id}, {"$set": {"user_id": user_id}})

            self.db.user_status.update_one(
                {"user_id": user_id},
                {"$set": {"status": "pending", "updated_at": datetime.utcnow()}},
                upsert=True,
            )
            
            user_result = {"user_id": user_id, "name": name, "username": username, "email": email, "status": "pending"}
            log_audit_event("USER_REGISTER", user_id=user_id, details={"email": email, "username": username})
            
            return user_result, None, 201

        except mongo_errors.DuplicateKeyError as e:
            message = "El email ya está registrado."
            key_pattern = e.details.get("keyPattern") if e.details else {}
            if key_pattern and "username_lower" in key_pattern:
                message = "El usuario ya está en uso."
            return None, message, 409
        except Exception as e:
            self.logger.error(f"Error en AuthService.register_user: {e}", exc_info=True)
            return None, "Error interno en registro", 500

    def login_user(self, identifier, password):
        """
        Valida credenciales de usuario.
        Retorna (user_data, error_message, status_code)
        """
        if not identifier or not password:
            return None, "Email o usuario y Contraseña son obligatorios.", 400

        identifier_lower = identifier.lower()
        lookup_field = "email" if "@" in identifier else "username_lower"
        u = self.db.users.find_one({lookup_field: identifier_lower})
        
        if not u or not check_password_hash(u.get("password_hash", ""), password):
            log_audit_event("LOGIN_FAILED", details={"identifier": identifier}, level="warn")
            return None, "Credenciales inválidas.", 401

        user_id = str(u.get("user_id") or u["_id"])
        status = ensure_user_status(user_id, default_status=USER_STATUS_DEFAULT)
        
        if status != "active":
            log_audit_event("LOGIN_INACTIVE_STATUS", user_id=user_id, details={"status": status}, level="info")

        user_data = {
            "user_id": user_id,
            "name": u.get("name"),
            "username": u.get("username"),
            "email": u.get("email"),
            "status": status,
        }
        
        self.logger.info(f"Usuario accedió: {u.get('email')} ({u.get('username')})")
        log_audit_event("USER_LOGIN", user_id=user_id, details={"method": "credentials"})
        
        return user_data, None, 200

    def verify_admin_token(self, token):
        """
        Valida token de administrador.
        Retorna (data, error_message, status_code)
        """
        expected = get_admin_token()
        if not expected:
            return None, "Token no configurado", 503
            
        if token == expected:
            return {"ok": True, "token": token}, None, 200
        else:
            return None, "Token inválido", 403

    def _send_coach_notifications(self, coach_id, name, username):
        """Helper para enviar notificaciones al coach."""
        try:
            # 1. Sidebar Notification
            notification = {
                "user_id": ObjectId(coach_id),
                "type": "user_pending",
                "title": "Nuevo Alumno Pendiente",
                "message": f"El usuario {name} ({username}) se ha registrado con tu código y espera activación.",
                "read": False,
                "created_at": datetime.utcnow(),
                "link": "/admin/users?filterStatus=pending"
            }
            self.db.notifications.insert_one(notification)
            
            # 2. Web Push (Critical)
            from routes.push import send_instant_push
            send_instant_push(
                user_id=coach_id,
                title="Nuevo Alumno Registrado",
                body=f"{name} requiere activación.",
                url="/admin/users?filterStatus=pending"
            )
        except Exception as ex:
            self.logger.error(f"Error sending coach notification in AuthService: {ex}")
