from flask import Blueprint, request, jsonify, render_template
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import errors as mongo_errors
from datetime import datetime
import re
import os

import extensions
from extensions import logger
from utils.auth_helpers import ensure_user_status, get_admin_token, USER_STATUS_DEFAULT

auth_bp = Blueprint('auth', __name__)

@auth_bp.post("/register")
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
        res = extensions.db.users.insert_one(doc)
        try:
            extensions.db.users.update_one({"_id": res.inserted_id}, {"$set": {"user_id": str(res.inserted_id)}})
        except Exception:
            pass
        user_id = str(res.inserted_id)
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
            return jsonify({"error": "Credenciales inválidas."}), 401

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

# Admin Auth

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
            or request.args.get("token")
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
        from config import Config
        data = request.get_json() or {}
        token = data.get("token")
        
        expected = Config.ADMIN_TOKEN
        if not expected:
            return jsonify({"ok": False, "error": "Token no configurado"}), 503
            
        if token == expected:
            return jsonify({"ok": True}), 200
        else:
            return jsonify({"ok": False, "error": "Token inválido"}), 403
            
    except Exception as e:
        logger.error(f"Error verificando token admin: {e}")
        return jsonify({"ok": False, "error": "Error interno"}), 500
