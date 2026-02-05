from flask import Blueprint, request, jsonify, render_template
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import errors as mongo_errors
from datetime import datetime
import re
import os

import extensions
from extensions import logger
from utils.auth_helpers import ensure_user_status, get_admin_token, generate_admin_csrf, USER_STATUS_DEFAULT
from utils.cache import cache_delete
from utils.audit import log_audit_event

auth_bp = Blueprint('auth', __name__)

@auth_bp.post("/register")
def auth_register():
    try:
        if extensions.db is None:
            return jsonify({"error": "DB not ready"}), 503

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
            return jsonify({"error": "El usuario debe tener de 3 a 20 caracteres alfanuméricos (._- permitidos)."}), 400
        if "@" not in email:
            return jsonify({"error": "El email no es válido."}), 400
        if len(password) < 8:
            return jsonify({"error": "La Contraseña debe tener al menos 8 caracteres."}), 400

        username_lower = username.lower()
        if extensions.db.users.find_one({"username_lower": username_lower}):
            return jsonify({"error": "El usuario ya está en uso."}), 409

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
            coach = extensions.db.users.find_one({"own_referral_code": referral_code})
            if coach:
                doc["coach_id"] = coach.get("user_id") or str(coach["_id"])
                doc["upline_code"] = referral_code
                logger.info(f"Usuario {username} vinculado a coach (Code: {referral_code})")
                
                # --- NOTIFICATION & PUSH START ---
                try:
                    from bson import ObjectId
                    coach_id = doc["coach_id"]
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
                    extensions.db.notifications.insert_one(notification)
                    
                    # 2. Web Push (Critical)
                    from routes.push import send_instant_push
                    send_instant_push(
                        user_id=coach_id,
                        title="Nuevo Alumno Registrado",
                        body=f"{name} requiere activación.",
                        url="/admin/users?filterStatus=pending"
                    )
                except Exception as ex:
                    logger.error(f"Error sending coach notification: {ex}")
                # --- NOTIFICATION & PUSH END ---

            else:
                # If code is invalid, we proceed (or should we error? Standard is often to ignore or warn)
                # For now, let's just log it.
                logger.warning(f"Usuario {username} intentó usar código inválido: {referral_code}")

        res = extensions.db.users.insert_one(doc)
        user_id = str(res.inserted_id)
        
        try:
            extensions.db.users.update_one({"_id": res.inserted_id}, {"$set": {"user_id": user_id}})
        except Exception:
            pass
            
        try:
            extensions.db.user_status.update_one(
                {"user_id": user_id},
                {"$set": {"status": "pending", "updated_at": datetime.utcnow()}},
                upsert=True,
            )
        except Exception:
            pass
            
        user = {"user_id": user_id, "name": name, "username": username, "email": email, "status": "pending"}
        logger.info(f"Usuario registrado: {email} ({username})")
        
        # AUDIT
        log_audit_event("USER_REGISTER", user_id=user_id, details={"email": email, "username": username})
        
        return jsonify({"message": "Registro exitoso", "user": user}), 201

    except mongo_errors.DuplicateKeyError as e:
        message = "El email ya está registrado."
        try:
            key_pattern = e.details.get("keyPattern") if e.details else {}
            if key_pattern and "username_lower" in key_pattern:
                message = "El usuario ya está en uso."
        except Exception:
            pass
        return jsonify({"error": message}), 409
    except Exception as e:
        logger.error(f"Error en registro: {e}", exc_info=True)
        return jsonify({"error": "Error interno en registro"}), 500


@auth_bp.post("/login")
def auth_login_api():
    try:
        if extensions.db is None:
            return jsonify({"error": "DB not ready"}), 503

        if not request.is_json:
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415
        data = request.get_json() or {}
        identifier = (data.get("identifier") or data.get("email") or data.get("username") or "").strip()
        password = data.get("password") or ""
        if not identifier or not password:
            return jsonify({"error": "Email o usuario y Contraseña son obligatorios."}), 400

        identifier_lower = identifier.lower()
        lookup_field = "email" if "@" in identifier else "username_lower"
        u = extensions.db.users.find_one({lookup_field: identifier_lower})
        
        if not u or not check_password_hash(u.get("password_hash", ""), password):
            # AUDIT FAILED LOGIN
            log_audit_event("LOGIN_FAILED", details={"identifier": identifier}, level="warn")
            return jsonify({"error": "Credenciales inválidas."}), 401

        user_id = str(u.get("user_id") or u["_id"])
        status = ensure_user_status(user_id, default_status=USER_STATUS_DEFAULT)
        if status != "active":
            # AUDIT LOG ONLY - Do not block here, let middleware handle it
            log_audit_event("LOGIN_INACTIVE_STATUS", user_id=user_id, details={"status": status}, level="info")
            # Continuamos para permitir que el middleware muestre la pantalla de bloqueo adecuada con info.

        user = {
            "user_id": user_id,
            "name": u.get("name"),
            "username": u.get("username"),
            "email": u.get("email"),
            "status": status,
        }
        logger.info(f"Usuario accedió: {u.get('email')} ({u.get('username')})")
        
        # AUDIT SUCCESS LOGIN
        log_audit_event("USER_LOGIN", user_id=user_id, details={"method": "credentials"})
        
        resp = jsonify({"message": "Inicio de sesión exitoso", "user": user})
        
        # Mantener sesión por varios días para evitar expiraciones tras inactividad
        max_age = 86400 * 30
        
        # Safari and modern browsers require SameSite/Secure for some contexts.
        # Max-age=None makes it a session cookie.
        resp.set_cookie(
            "user_session", 
            user["user_id"], 
            httponly=True, 
            samesite="Lax", 
            max_age=max_age,
            secure=request.is_secure # Set secure based on connection
        )
        return resp, 200

    except Exception as e:
        logger.error(f"Error en login: {e}", exc_info=True)
        return jsonify({"error": "Error interno en inicio de sesión"}), 500

@auth_bp.post("/admin/login")
def admin_login():
    """Valida el token de administrador enviado por POST y establece cookie.

    Acepta JSON { token: str } o form-urlencoded con campo 'token'.
    Responde 200 con { ok: true } y set-cookie si es válido; 403 si no.
    """
    try:
        admin_token = get_admin_token()
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
        resp.set_cookie(
            "admin_csrf",
            generate_admin_csrf(),
            httponly=False,
            samesite="Lax",
            max_age=86400 * 7,
            secure=request.is_secure,
        )
        return resp, 200
    except Exception as e:
        logger.error(f"Error en /admin/login: {e}", exc_info=True)
        return jsonify({"error": "Error interno en login admin"}), 500

@auth_bp.get("/admin/validate")
def admin_validate():
    """Valida que el usuario tiene acceso admin mediante cookie o header.
    Retorna 200 si ok; 403 si no autorizado.
    """
    try:
        admin_token = get_admin_token()
        if not admin_token:
            return jsonify({"error": "ADMIN_TOKEN no configurado"}), 503

        provided = (
            request.cookies.get("admin_token")
            or request.headers.get("X-Admin-Token")
        )
        if provided != admin_token:
            return jsonify({"ok": False, "error": "No autorizado"}), 403
        return jsonify({"ok": True}), 200
    except Exception:
        return jsonify({"error": "Error validando acceso admin"}), 500

@auth_bp.post("/verify_admin_token")
def verify_admin_token_endpoint():
    """Valida token para funciones avanzadas de admin (frontend)."""
    try:
        data = request.get_json() or {}
        token = data.get("token")
        
        expected = get_admin_token()
        logger.info(f"DEBUG: Token check. Received: '{token}', Expected: '{expected}'")

        if not expected:
            return jsonify({"ok": False, "error": "Token no configurado"}), 503
            
        if token == expected:
            resp = jsonify({"ok": True})
            resp.set_cookie("admin_token", token, httponly=True, samesite="Lax", max_age=86400*7)
            resp.set_cookie(
                "admin_csrf",
                generate_admin_csrf(),
                httponly=False,
                samesite="Lax",
                max_age=86400 * 7,
                secure=request.is_secure,
            )
            from config import Config
            import time
            resp.set_cookie("admin_last_active", str(int(time.time())), httponly=True, samesite="Lax", max_age=Config.ADMIN_IDLE_TIMEOUT_SECONDS)
            user_id = request.cookies.get("user_session")
            if user_id:
                cache_delete(f"user_ctx:{user_id}")
            return resp, 200
        else:
            return jsonify({"ok": False, "error": "Token inválido"}), 403
            
    except Exception as e:
        logger.error(f"Error verificando token admin: {e}")
        return jsonify({"ok": False, "error": "Error interno"}), 500

@auth_bp.post("/logout")
def auth_logout():
    """Cierra sesión eliminando todas las cookies de autenticación."""
    try:
        user_id = request.cookies.get("user_session")
        if user_id:
            log_audit_event("USER_LOGOUT", user_id=user_id)
            
        resp = jsonify({"message": "Sesión cerrada correctamente"})
        
        # Eliminar todas las cookies posibles
        resp.delete_cookie("user_session")
        resp.delete_cookie("admin_token")
        resp.delete_cookie("admin_last_active")
        resp.delete_cookie("admin_origin_session")
        resp.delete_cookie("admin_csrf")
        resp.delete_cookie("admin_impersonation_id")
        
        return resp, 200
    except Exception as e:
        logger.error(f"Error en logout: {e}", exc_info=True)
        return jsonify({"error": "Error interno al cerrar sesión"}), 500
