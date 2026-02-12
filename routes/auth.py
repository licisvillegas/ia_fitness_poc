from flask import Blueprint, request, jsonify, render_template
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import errors as mongo_errors
from datetime import datetime
import re
import os

import extensions
from extensions import logger, limiter, csrf
from utils.auth_helpers import ensure_user_status, get_admin_token, generate_admin_csrf, USER_STATUS_DEFAULT
from utils.cache import cache_delete
from utils.audit import log_audit_event
from utils.validation_decorator import validate_request
from schemas.auth_schemas import RegisterRequest, LoginRequest, TokenRequest

from services.auth_service import AuthService

auth_bp = Blueprint('auth', __name__)
auth_service = AuthService()

@auth_bp.post("/register")
@limiter.limit("3 per 10 minutes")
@validate_request(RegisterRequest)
def auth_register():
    try:
        data = request.validated_data.model_dump()
        user, error, status = auth_service.register_user(data)
        
        if error:
            return jsonify({"error": error}), status
            
        return jsonify({"message": "Registro exitoso", "user": user}), status

    except Exception as e:
        logger.error(f"Error en registro: {e}", exc_info=True)
        return jsonify({"error": "Error interno en registro"}), 500


@auth_bp.post("/login")
@limiter.limit("5 per minute")
@validate_request(LoginRequest)
def auth_login_api():
    try:
        data = request.validated_data
        identifier = data.email # LoginRequest now uses email as identifier
        password = data.password
        
        user, error, status = auth_service.login_user(identifier, password)
        
        if error:
            return jsonify({"error": error}), status

        resp = jsonify({"message": "Inicio de sesión exitoso", "user": user})
        
        # Mantener sesión por varios días para evitar expiraciones tras inactividad
        max_age = 86400 * 30
        
        resp.set_cookie(
            "user_session", 
            user["user_id"], 
            httponly=True, 
            samesite="Lax", 
            max_age=max_age,
            secure=request.is_secure 
        )
        return resp, 200

    except Exception as e:
        logger.error(f"Error en login: {e}", exc_info=True)
        return jsonify({"error": "Error interno en inicio de sesión"}), 500

@auth_bp.post("/admin/login")
@csrf.exempt
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
            # Usar validación manual aquí o refactorizar para que siempre sea JSON
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

from extensions import csrf

@auth_bp.post("/verify_admin_token")
@csrf.exempt
@validate_request(TokenRequest)
def verify_admin_token_endpoint():
    """Valida token para funciones avanzadas de admin (frontend)."""
    try:
        data = request.validated_data
        token = data.token
        
        expected = get_admin_token()

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
