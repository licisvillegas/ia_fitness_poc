from flask import Blueprint, request, jsonify, render_template, redirect, url_for, g
import os
import shutil
import time
from bson import ObjectId
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash

import extensions
from extensions import logger
from utils.auth_helpers import (
    check_admin_access, 
    check_role_access,
    ensure_user_status, 
    generate_admin_csrf, 
    validate_admin_csrf, 
    generate_referral_code,
    USER_STATUS_DEFAULT
)
from utils.cache import cache_delete
from utils.helpers import (
    parse_birth_date,
    format_birth_date,
    compute_age,
    normalize_user_status,
    normalize_string_list,
    normalize_equipment_list,
    normalize_bool,
    normalize_body_part,
)
from utils.routine_utils import normalize_routine_items

admin_bp = Blueprint('admin', __name__)

@admin_bp.route("/admin/login")
def admin_login_page():
    from utils.auth_helpers import get_admin_token
    token = request.cookies.get("admin_token")
    real_token = get_admin_token()
    if token and token == real_token:
        return redirect(url_for("admin.admin_dashboard_page"))
    return render_template("admin_auth.html")

@admin_bp.post("/admin/login")
def admin_login_action():
    from utils.auth_helpers import get_admin_token
    from config import Config
    
    data = request.get_json() or {}
    token = data.get("token")
    real_token = get_admin_token()

    if not real_token:
        return jsonify({"ok": False, "error": "ADMIN_TOKEN no configurado"}), 503
    
    if token == real_token:
        resp = jsonify({"ok": True})
        resp.set_cookie("admin_token", token, httponly=True, samesite="Lax", max_age=86400*7)
        resp.set_cookie("admin_last_active", str(int(time.time())), httponly=True, samesite="Lax",
                        max_age=Config.ADMIN_IDLE_TIMEOUT_SECONDS)
        resp.set_cookie(
            "admin_csrf",
            generate_admin_csrf(),
            httponly=False,
            samesite="Lax",
            max_age=86400 * 7,
            secure=request.is_secure,
        )
        return resp, 200
    else:
        return jsonify({"ok": False, "error": "Token incorrecto"}), 401

@admin_bp.before_request
def enforce_admin_token():
    """
    Admin middleware:
    Verifica la cookie admin_token para cualquier ruta /admin.
    Excluye:
      - /admin/login (POST y GET)
      - /admin/logout
      - API calls (podriamos excluirlas si dependen del header, pero mejor ser estrictos)
    """
    # Lista de rutas exentas controlada
    if request.endpoint in ["admin.admin_login_page", "admin.admin_login_action", "admin.admin_logout_action", "static"]:
        return

    # Si es una ruta bajo este blueprint
    # (Nota: admin_bp.before_request corre para todas las rutas de este BP)
    
    from utils.auth_helpers import get_admin_token
    from config import Config
    
    token = request.cookies.get("admin_token")
    real_token = get_admin_token()

    # debug print without leaking token values
    print(f"DEBUG ADMIN AUTH: Endpoint={request.endpoint}, Token present={bool(token)}")

    if not token or token != real_token:
        print("DEBUG ADMIN AUTH: Token mismatch or missing -> Redirecting to login")
        # Si es una peticion API (JSON), devuelve 401
        if request.path.startswith("/api/") or request.headers.get("Content-Type") == "application/json":
             # Opcional: Para APIs a veces dejamos que check_admin_access maneje validacion + rol
             # Pero el usuario pidio "para ingresar a panel admin siempre debe proporcionarse token"
             # Asi que rechazamos aqui nivel 'puerta blindada'
             return jsonify({"error": "Admin Token Requerido (Cookie)"}), 401
        
        # Si es navegacion web, redirige a login
        return redirect(url_for("admin.admin_login_page"))

    last_active_raw = request.cookies.get("admin_last_active")
    now = int(time.time())
    try:
        last_active = int(last_active_raw) if last_active_raw else 0
    except ValueError:
        last_active = 0

    if not last_active or (now - last_active) > Config.ADMIN_IDLE_TIMEOUT_SECONDS:
        if request.path.startswith("/api/") or request.headers.get("Content-Type") == "application/json":
            resp = jsonify({"error": "Sesion admin expirada. Ingresa el token nuevamente."})
            resp.delete_cookie("admin_token")
            resp.delete_cookie("admin_last_active")
            return resp, 401
        resp = redirect(url_for("admin.admin_login_page"))
        resp.delete_cookie("admin_token")
        resp.delete_cookie("admin_last_active")
        return resp

    g.admin_touch = True

@admin_bp.after_request
def refresh_admin_activity(response):
    if getattr(g, "admin_touch", False):
        from config import Config
        response.set_cookie(
            "admin_last_active",
            str(int(time.time())),
            httponly=True,
            samesite="Lax",
            max_age=Config.ADMIN_IDLE_TIMEOUT_SECONDS,
        )
    return response

@admin_bp.route("/admin/logout")
def admin_logout_action():
    print("DEBUG ADMIN AUTH: Executing Logout")
    resp = redirect("/")
    # Force expire
    resp.set_cookie("admin_token", "", expires=0, max_age=0)
    resp.delete_cookie("admin_token")
    resp.set_cookie("admin_last_active", "", expires=0, max_age=0)
    resp.delete_cookie("admin_last_active")
    resp.delete_cookie("admin_csrf")
    resp.delete_cookie("admin_origin_session")
    resp.delete_cookie("admin_impersonation_id")
    return resp

@admin_bp.route("/admin")
def admin_dashboard_page():
    # El hook before_request ya valida el token.
    # Aquí solo renderizamos.
    return render_template("admin_dashboard.html")

@admin_bp.route("/admin/plans")
def admin_plans_page():
    return render_template("admin_plans.html")

@admin_bp.route("/admin/meal_plans")
def admin_meal_plans_page():
    return render_template("admin_meal_plans.html")

@admin_bp.route("/admin/privileges")
def admin_privileges_page():
    return render_template("admin_privileges.html")

@admin_bp.route("/admin/users")
def admin_users_page():
    # Only admins/coaches can see this page (middleware handles it, but let's be safe/clean)
    # We want to populate the Coach filter
    coaches = []
    if extensions.db is not None:
        # Fetch users who have role='coach' or 'admin'?? Usually just coach.
        # Let's get anyone with role 'coach' or 'admin' to be safe as "potential coaches"
        roles_cursor = extensions.db.user_roles.find(
            {"role": {"$in": ["coach", "admin"]}}
        )
        coach_ids = [r["user_id"] for r in roles_cursor]
        if coach_ids:
             users_cursor = extensions.db.users.find(
                 {"user_id": {"$in": coach_ids}},
                 {"user_id": 1, "name":1, "username":1}
             ).sort("name", 1)
             coaches = list(users_cursor)

    return render_template("admin_users.html", coaches=coaches)

@admin_bp.route("/admin/profiles")
def admin_profiles_page():
    return render_template("admin_profiles.html")

@admin_bp.route("/admin/body_assessments")
def admin_body_assessments_page():
    return render_template("admin_body_assessments.html")

@admin_bp.route("/admin/exercises")
def admin_exercises_page():
    return render_template("exercises_catalog.html")

@admin_bp.route("/admin/routines")
def admin_routines_catalog_page():
    return render_template("routines_catalog.html")

@admin_bp.route("/admin/routines/builder")
def admin_routine_builder_page():
    return render_template("routine_builder.html")

# ======================================================
# API ENDPOINTS - ADMIN USERS & LOOKUP
# ======================================================

@admin_bp.get("/api/admin/users_paginated")
def list_users_paginated():
    """Endpoint paginado para usuarios."""
    ok, err, user_role = check_role_access(["admin", "coach"])
    if not ok: return err

    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 20))
        search = request.args.get("search", "").strip()
        
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503

        query = {}
        if user_role == "coach":
            current_uid = request.cookies.get("user_session")
            query["coach_id"] = current_uid
        else:
            # Admin can filter by specific coach
            filter_coach = request.args.get("filter_coach_id")
            if filter_coach:
                query["coach_id"] = filter_coach

        # FILTER BY STATUS (Separate Collection)
        filter_status = request.args.get("status")
        if filter_status:
            # Get user_ids with this status
            status_matches = extensions.db.user_status.find({"status": filter_status}, {"user_id": 1})
            status_user_ids = [s["user_id"] for s in status_matches]
            # Add to query (AND logic)
            if "user_id" in query:
                # If we already have a user_id filter (e.g. from search), we need an intersection
                # But search 'user_id' is usually a regex or exact match on _id/user_id string.
                # Complex intersection. For simplicity, let's use $in with existing logic 
                # or just add to query if it's safe.
                # The search logic below uses "$or", so we need to be careful.
                # Let's add it as a top level $and if needed, or just modify query user_id.
                existing_uid_filter = query.get("user_id")
                if existing_uid_filter:
                     # This effectively intersects. But "user_id" in query might be from ... wait, 
                     # we haven't set "user_id" in query yet except for search below.
                     # Search logic overwrites or appends?
                     pass
            
            # Use $in for user_id. 
            # CAUTION: If status_user_ids is empty, we should find nothing.
            if not status_user_ids:
                 # No users with this status found -> force empty result
                 query["user_id"] = "NO_MATCH_IMPOSSIBLE_ID" 
            else:
                 # If we have other filters that might affect user_id (none yet other than search), we combine.
                 query["user_id"] = {"$in": status_user_ids}

        if search:
            # Safe regex search
            regex = {"$regex": search, "$options": "i"}
            search_or = [
                {"name": regex},
                {"email": regex},
                {"username": regex},
                {"user_id": search}
            ]
            
            # Combine with existing filters (like status/coach)
            if "$or" in query:
                 # Should not happen with current logic, but good practice
                 query["$and"] = [query.pop("$or"), {"$or": search_or}]
            elif "user_id" in query:
                 # If we have a status filter on user_id, we must AND it with the search OR
                 # But wait, search OR contains user_id match too.
                 # query = { user_id: {$in: [...]}, $or: [...] } is valid.
                 query["$or"] = search_or
            else:
                 query["$or"] = search_or

        total = extensions.db.users.count_documents(query)
        cursor = extensions.db.users.find(query, {
            "user_id": 1, "name": 1, "email": 1, "username": 1, "created_at": 1, 
            "coach_id": 1, "own_referral_code": 1
        }).sort("created_at", -1).skip((page - 1) * limit).limit(limit)
        
        users_list = list(cursor)
        
        # Batch fetch coach names
        coach_ids = {u.get("coach_id") for u in users_list if u.get("coach_id")}
        coach_map = {}
        if coach_ids:
            # Query users where user_id IN coach_ids
            coaches_cursor = extensions.db.users.find(
                {"user_id": {"$in": list(coach_ids)}}, 
                {"user_id": 1, "name": 1}
            )
            for c in coaches_cursor:
                coach_map[c["user_id"]] = c.get("name")

        data = []
        for u in users_list:
            uid = str(u.get("user_id") or u.get("_id"))
            
            # Helper lookups (optimize later with aggregation if slow)
            roles_doc = extensions.db.user_roles.find_one({"user_id": uid})
            role = roles_doc.get("role") if roles_doc else "user"
            
            status_doc = extensions.db.user_status.find_one({"user_id": uid})
            status = status_doc.get("status", "active") if status_doc else "active"
            valid_until = status_doc.get("valid_until") if status_doc else None
            
            # Format dates
            created = u.get("created_at")
            if isinstance(created, datetime):
                created = created.strftime("%Y-%m-%d %H:%M")
            if isinstance(valid_until, datetime):
                valid_until = valid_until.strftime("%Y-%m-%d")
            
            c_id = u.get("coach_id")
            coach_name = coach_map.get(c_id, c_id) if c_id else None

            data.append({
                "user_id": uid,
                "name": u.get("name"),
                "email": u.get("email"),
                "username": u.get("username"),
                "created_at": created,
                "role": role,
                "status": status,
                "coach_id": c_id,
                "coach_name": coach_name,
                "own_referral_code": u.get("own_referral_code"),
                "valid_until": valid_until
            })

        return jsonify({
            "items": data,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit
        }), 200
    except Exception as e:
        logger.error(f"Error listing users paginated: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.get("/api/admin/users")
def list_users():
    """Lista usuarios registrados (Legacy/Full List)."""
    ok, err, user_role = check_role_access(["admin", "coach"])
    if not ok: return err

    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        
        query = {}
        if user_role == "coach":
            current_uid = request.cookies.get("user_session")
            query["coach_id"] = current_uid

        users_cursor = extensions.db.users.find(query, {
            "user_id": 1, "name": 1, "email": 1, "username": 1, "created_at": 1
        }).sort("created_at", -1)

        result = []
        for u in users_cursor:
            uid = str(u.get("user_id") or u.get("_id"))
            
            # Helper fields
            roles_doc = extensions.db.user_roles.find_one({"user_id": uid})
            role = roles_doc.get("role") if roles_doc else "user"
            
            status_doc = extensions.db.user_status.find_one({"user_id": uid})
            status = status_doc.get("status", "active") if status_doc else "active"
            
            created = u.get("created_at")
            if isinstance(created, datetime):
                created = created.strftime("%Y-%m-%d %H:%M")
            
            result.append({
                "user_id": uid,
                "name": u.get("name"),
                "email": u.get("email"),
                "username": u.get("username"),
                "created_at": created,
                "role": role,
                "status": status
            })
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error listing users: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.post("/admin/api/update_role")
def update_user_role():
    """Actualiza solo el rol de un usuario (Endpoint para admin_privileges.html)."""
    ok, err = check_admin_access()
    if not ok: return err

    try:
        data = request.get_json() or {}
        user_id = data.get("user_id")
        new_role = data.get("role")

        if not user_id or not new_role:
             return jsonify({"error": "Faltan datos (user_id, role)"}), 400

        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503

        extensions.db.user_roles.update_one(
            {"user_id": user_id},
            {"$set": {"role": new_role}},
            upsert=True
        )
        
        return jsonify({"message": "Rol actualizado"}), 200
    except Exception as e:
        logger.error(f"Error updating role: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.post("/admin/api/impersonate")
def impersonate_user():
    """Permite al admin iniciar sesión como otro usuario."""
    ok, err = check_admin_access()
    if not ok: return err
    csrf_ok, csrf_err = validate_admin_csrf()
    if not csrf_ok: return csrf_err

    try:
        data = request.get_json() or {}
        user_id = data.get("user_id")
        
        if not user_id:
             return jsonify({"error": "User ID requerido"}), 400
             
        # Verify user exists
        u = extensions.db.users.find_one({"user_id": user_id}) or extensions.db.users.find_one({"_id": ObjectId(user_id)})
        if not u:
             return jsonify({"error": "Usuario no encontrado"}), 404
             
        target_uid = str(u.get("user_id") or u["_id"])
        
        # Block impersonating other admins
        role_doc = extensions.db.user_roles.find_one({"user_id": target_uid}) if extensions.db is not None else None
        if role_doc and role_doc.get("role") == "admin":
            return jsonify({"error": "No puedes impersonar a un administrador"}), 403

        resp = jsonify({"message": "Switching user context", "user_id": target_uid})
        
        # Save original session if not already saved
        current_session = request.cookies.get("user_session")
        origin_session = request.cookies.get("admin_origin_session")
        
        print(f"DEBUG IMPERSONATE: Current={current_session}, Origin={origin_session}, Target={target_uid}")
        
        if current_session and not origin_session:
            print(f"DEBUG IMPERSONATE: Setting admin_origin_session to {current_session}")
            resp.set_cookie("admin_origin_session", current_session, httponly=True, samesite="Lax", max_age=86400*7)
        else:
            print("DEBUG IMPERSONATE: Skipping origin set (already set or no current session)")

        # Audit record
        try:
            if extensions.db is not None and current_session:
                audit_doc = {
                    "admin_user_id": current_session,
                    "target_user_id": target_uid,
                    "ip": request.headers.get("X-Forwarded-For", request.remote_addr),
                    "user_agent": request.headers.get("User-Agent"),
                    "created_at": datetime.utcnow(),
                    "ended_at": None,
                }
                res = extensions.db.admin_impersonations.insert_one(audit_doc)
                resp.set_cookie("admin_impersonation_id", str(res.inserted_id), httponly=True, samesite="Lax", max_age=86400*7)
        except Exception as e:
            logger.error(f"Error audit impersonation: {e}")

        # Set the HttpOnly session cookie
        resp.set_cookie("user_session", target_uid, httponly=True, samesite="Lax", max_age=86400*30)
        return resp, 200
        
    except Exception as e:
        logger.error(f"Error impersonating: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.post("/admin/api/revert_impersonation")
def revert_impersonation():
    """Regresa a la sesión original del admin."""
    # No llamamos check_admin_access() aqui porque el usuario actual
    # es el impersonado (sin rol admin).
    # La seguridad recae en @admin_bp.before_request que verifica la cookie 'admin_token'.
    
    csrf_ok, csrf_err = validate_admin_csrf()
    if not csrf_ok: return csrf_err

    try:
        origin_uid = request.cookies.get("admin_origin_session")
        print(f"DEBUG REVERT: Origin Cookie={origin_uid}")
        
        if not origin_uid:
            return jsonify({"error": "No hay sesión original para restaurar"}), 400
            
        # Get user details for frontend update
        u = extensions.db.users.find_one({"user_id": origin_uid})
        if not u:
             return jsonify({"error": "Usuario original no encontrado"}), 404
             
        user_data = {
            "user_id": origin_uid,
            "name": u.get("name"),
            "username": u.get("username"),
            "email": u.get("email")
        }
            
        resp = jsonify({"message": "Session restored", "user": user_data})
        try:
            if extensions.db is not None:
                imp_id = request.cookies.get("admin_impersonation_id")
                update = {"$set": {"ended_at": datetime.utcnow()}}
                if imp_id and ObjectId.is_valid(imp_id):
                    extensions.db.admin_impersonations.update_one({"_id": ObjectId(imp_id)}, update)
                else:
                    current_imp = request.cookies.get("user_session")
                    extensions.db.admin_impersonations.update_one(
                        {"admin_user_id": origin_uid, "target_user_id": current_imp, "ended_at": None},
                        update,
                    )
        except Exception as e:
            logger.error(f"Error audit revert: {e}")
        resp.set_cookie("user_session", origin_uid, httponly=True, samesite="Lax", max_age=86400*30)
        resp.delete_cookie("admin_origin_session")
        resp.delete_cookie("admin_impersonation_id")
        
        return resp, 200
    except Exception as e:
        logger.error(f"Error reverting impersonation: {e}")
        return jsonify({"error": "Error interno"}), 500

        
@admin_bp.post("/admin/api/lock")
def lock_admin_session():
    """Bloquea la sesión de admin eliminando el token."""
    csrf_ok, csrf_err = validate_admin_csrf()
    if not csrf_ok: return csrf_err

    try:
        user_id = request.cookies.get("user_session")
        resp = jsonify({"message": "Admin session locked"})
        resp.delete_cookie("admin_token")
        resp.delete_cookie("admin_last_active")
        resp.delete_cookie("admin_csrf")
        if user_id:
            cache_delete(f"user_ctx:{user_id}")
        return resp, 200
    except Exception as e:
        logger.error(f"Error locking admin: {e}")
        return jsonify({"error": "Error interno"}), 500

# Alias para admin_users.html que a veces llama user_profiles/lookup o users_roles
@admin_bp.get("/admin/api/users_roles")
def list_users_roles_alias():
    return list_users()

@admin_bp.get("/admin/api/user_profiles/lookup")
def lookup_users():
    """Busca usuarios por nombre/email para autocompletado."""
    # Permitir si admin logueado
    ok, err = check_admin_access()
    if not ok: return err

    term = request.args.get("term", "").lower().strip()
    limit = int(request.args.get("limit", 5))
    
    if not term:
        return jsonify([]), 200
        
    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        
        # Simple regex or exact check
        # Buscamos en name, username, email, user_id
        query = {
            "$or": [
                {"name": {"$regex": term, "$options": "i"}},
                {"username": {"$regex": term, "$options": "i"}},
                {"email": {"$regex": term, "$options": "i"}},
                {"user_id": term}
            ]
        }
        
        cursor = extensions.db.users.find(query, {
            "user_id": 1, "name": 1, "email": 1, "username": 1
        }).limit(limit)
        
        results = []
        for u in cursor:
            uid = u.get("user_id")
            role_doc = extensions.db.user_roles.find_one({"user_id": uid}) if extensions.db is not None else None
            role = role_doc.get("role") if role_doc else "user"
            has_p = extensions.db.user_profiles.find_one({"user_id": uid}) is not None
            results.append({
                "user_id": uid,
                "name": u.get("name"),
                "email": u.get("email"),
                "username": u.get("username"),
                "has_profile": has_p,
                "role": role
            })
        return jsonify(results), 200
    except Exception as e:
        logger.error(f"Error user lookup: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.post("/api/admin/users")
def create_user():
    """Crea un usuario manualmente."""
    ok, err = check_admin_access()
    if not ok: return err

    try:
        data = request.get_json() or {}
        name = data.get("name")
        email = data.get("email")
        username = data.get("username")
        password = data.get("password")
        role = data.get("role", "user")
        status = data.get("status", "active")

        if not name or not email or not username or not password:
            return jsonify({"error": "Faltan campos obligatorios"}), 400
        
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503

        if extensions.db.users.find_one({"email": email}):
            return jsonify({"error": "Email ya existe"}), 409
        if extensions.db.users.find_one({"username": username}):
            return jsonify({"error": "Username ya existe"}), 409

        if extensions.db.users.find_one({"username": username}):
            return jsonify({"error": "Username ya existe"}), 409

        pwd_hash = generate_password_hash(password)
        
        # Check if generating referral code for new admin/coach
        own_code = data.get("own_referral_code")
        if (role in ["admin", "coach"]) and data.get("generate_code"):
             own_code = generate_referral_code(prefix=username[:3])
        
        new_user = {
            "name": name,
            "email": email,
            "username": username,
            "username_lower": username.lower(),
            "password_hash": pwd_hash,
            "created_at": datetime.utcnow(),
            "own_referral_code": own_code,
            "coach_id": data.get("coach_id") # Allow manual assignment
        }
        res = extensions.db.users.insert_one(new_user)
        user_id = str(res.inserted_id)
        
        # Update user_id inside doc
        extensions.db.users.update_one({"_id": res.inserted_id}, {"$set": {"user_id": user_id}})

        # Role
        extensions.db.user_roles.insert_one({"user_id": user_id, "role": role})

        # Status & Validity
        valid_until = None
        if "validity_days" in data:
            try:
                days = int(data["validity_days"])
                if days > 0:
                     valid_until = datetime.utcnow() + timedelta(days=days)
            except: pass
        elif "validity_date" in data and data["validity_date"]:
             try:
                 valid_until = datetime.strptime(data["validity_date"], "%Y-%m-%d")
             except: pass

        st_doc = {
            "user_id": user_id, 
            "status": status, 
            "updated_at": datetime.utcnow(),
            "valid_until": valid_until
        }
        extensions.db.user_status.insert_one(st_doc)
        
        return jsonify({"message": "Usuario creado", "user_id": user_id}), 201
    except Exception as e:
        logger.error(f"Error creating user: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.put("/api/admin/users/<user_id>")
def update_user(user_id):
    """Edita usuario existente."""
    ok, err = check_admin_access()
    if not ok: return err

    try:
        data = request.get_json() or {}
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        
        u = extensions.db.users.find_one({"user_id": user_id})
        if not u:
            return jsonify({"error": "Usuario no encontrado"}), 404

        # Edit basic info
        update_fields = {}
        if "name" in data: update_fields["name"] = data["name"]
        if "email" in data: update_fields["email"] = data["email"]
        if "username" in data: 
            update_fields["username"] = data["username"]
            update_fields["username_lower"] = data["username"].lower()
        
        # Referral Code Management
        if data.get("generate_code"):
            current_role_doc = extensions.db.user_roles.find_one({"user_id": user_id})
            r_check = current_role_doc.get("role") if current_role_doc else "user"
            if r_check in ["admin", "coach"]:
                prefix = (u.get("username") or "FIT")[:3]
                update_fields["own_referral_code"] = generate_referral_code(prefix=prefix)

        if "own_referral_code" in data and not data.get("generate_code"):
             # Manual override if needed
             update_fields["own_referral_code"] = data["own_referral_code"]
             
        if "coach_id" in data:
            update_fields["coach_id"] = data["coach_id"]
        
        if update_fields:
            extensions.db.users.update_one({"user_id": user_id}, {"$set": update_fields})

        # Edit Role
        if "role" in data:
            extensions.db.user_roles.update_one(
                {"user_id": user_id},
                {"$set": {"role": data["role"]}},
                upsert=True
            )

        # Edit Status & Validity
        if "status" in data or "validity_days" in data or "validity_date" in data:
            update_st = {}
            
            # Status
            if "status" in data:
                 st = normalize_user_status(data["status"])
                 if st: 
                     update_st["status"] = st
                     update_st["updated_at"] = datetime.utcnow()

            # Validity
            if "validity_days" in data:
                 try:
                     days = int(data["validity_days"])
                     if days > 0:
                         update_st["valid_until"] = datetime.utcnow() + timedelta(days=days)
                         # Auto-activate if setting validity? Ideally yes if currently expired/inactive
                         if "status" not in data: # If status manual override not provided
                             update_st["status"] = "active"
                 except: pass
            elif "validity_date" in data:
                 if data["validity_date"]: # Specific Date
                     try:
                         update_st["valid_until"] = datetime.strptime(data["validity_date"], "%Y-%m-%d")
                     except: pass
                 else:
                     # Clear validity (Indefinite)
                     update_st["valid_until"] = None

            if update_st:
                extensions.db.user_status.update_one(
                    {"user_id": user_id},
                    {"$set": update_st},
                    upsert=True
                )

        # Edit Password
        if "password" in data and data["password"]:
            new_hash = generate_password_hash(data["password"])
            extensions.db.users.update_one({"user_id": user_id}, {"$set": {"password_hash": new_hash}})

        return jsonify({"message": "Usuario actualizado"}), 200
    except Exception as e:
        logger.error(f"Error updating user: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.delete("/api/admin/users/<user_id>")
def delete_user(user_id):
    """Elimina usuario y datos relacionados."""
    ok, err = check_admin_access()
    if not ok: return err

    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        
        # Delete user
        extensions.db.users.delete_one({"user_id": user_id})
        # Delete roles, status
        extensions.db.user_roles.delete_many({"user_id": user_id})
        extensions.db.user_status.delete_many({"user_id": user_id})
        extensions.db.user_profiles.delete_many({"user_id": user_id})
        
        # Delete plans, progress? Maybe keep for history, but let's delete for now
        extensions.db.plans.delete_many({"user_id": user_id})
        extensions.db.progress.delete_many({"user_id": user_id})
        extensions.db.meal_plans.delete_many({"user_id": user_id})
        extensions.db.ai_adjustments.delete_many({"user_id": user_id})
        extensions.db.body_assessments.delete_many({"user_id": user_id})

        return jsonify({"message": "Usuario eliminado"}), 200
    except Exception as e:
        logger.error(f"Error deleting user: {e}")
        return jsonify({"error": "Error interno"}), 500

# ======================================================
# API ENDPOINTS - ADMIN PROFILES
# ======================================================
@admin_bp.get("/api/admin/profiles_paginated")
def list_profiles_paginated():
    ok, err = check_admin_access()
    if not ok: return err
    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503

        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 20))
        search = request.args.get("search", "").strip()

        query = {}
        # If searching, we likely search users first unless phone is in profile
        if search:
            regex = {"$regex": search, "$options": "i"}
            # Find users matching name/email/username
            matching_users = list(extensions.db.users.find({
                "$or": [
                    {"name": regex},
                    {"email": regex},
                    {"username": regex}
                ]
            }, {"user_id": 1}))
            
            user_ids = [u["user_id"] for u in matching_users if u.get("user_id")]
            
            # Profile query: user_id IN [...] OR phone matches
            query = {
                "$or": [
                    {"user_id": {"$in": user_ids}},
                    {"phone": regex}
                ]
            }

        total = extensions.db.user_profiles.count_documents(query)
        cursor = extensions.db.user_profiles.find(query).skip((page - 1) * limit).limit(limit)
        
        result = []
        for p in cursor:
            user_id = p.get("user_id")
            # Join user info
            u_doc = extensions.db.users.find_one({"user_id": user_id}, {"name": 1, "email": 1, "username": 1}) or {}
            
            # Basic status implicit check?
            # The grid expects 'status' key for the badge.
            status_doc = extensions.db.user_status.find_one({"user_id": user_id})
            status = status_doc.get("status", "active") if status_doc else "active"

            p_out = {
                "user_id": user_id,
                "username": u_doc.get("username"),
                "name": u_doc.get("name"),
                "email": u_doc.get("email"),
                "sex": p.get("sex"),
                "birth_date": format_birth_date(p.get("birth_date")),
                "phone": p.get("phone"),
                "age": compute_age(p.get("birth_date")),
                "status": status,
                # 'has_profile' is implied true since we are iterating profiles collection
            }
            result.append(p_out)

        return jsonify({
            "items": result,
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit
        }), 200
    except Exception as e:
        logger.error(f"Error listing profiles paginated: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.get("/api/admin/profiles")
def list_profiles():
    ok, err = check_admin_access()
    if not ok: return err
    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        cursor = extensions.db.user_profiles.find({})
        result = []
        for p in cursor:
            # Join with user table to get name/email
            user_id = p.get("user_id")
            u_doc = extensions.db.users.find_one({"user_id": user_id}, {"name": 1, "email": 1, "username": 1}) or {}
            
            p_out = {
                "user_id": user_id,
                "username": u_doc.get("username"),
                "name": u_doc.get("name"),
                "email": u_doc.get("email"),
                "sex": p.get("sex"),
                "birth_date": format_birth_date(p.get("birth_date")),
                "phone": p.get("phone"),
                "age": compute_age(p.get("birth_date"))
            }
            result.append(p_out)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error getting profiles: {e}")
        return jsonify({"error": "Error"}), 500

@admin_bp.get("/api/admin/profiles/<user_id>")
def get_user_profile_detail(user_id):
    ok, err = check_admin_access()
    if not ok: return err
    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        p = extensions.db.user_profiles.find_one({"user_id": user_id})
        if not p:
            return jsonify({"error": "Perfil no encontrado"}), 404
        
        u_doc = extensions.db.users.find_one({"user_id": user_id}) or {}
        
        p_out = {
            "user_id": user_id,
            "name": u_doc.get("name"),
            "email": u_doc.get("email"),
            "username": u_doc.get("username"),
            "sex": p.get("sex"),
            "birth_date": format_birth_date(p.get("birth_date")),
            "phone": p.get("phone"),
            "injuries": p.get("injuries"),
            "equipment": p.get("equipment"),
            "experience": p.get("experience"),
            "goals": p.get("goals")
        }
        return jsonify(p_out), 200
    except Exception as e:
        logger.error(f"Error profile detail: {e}")
        return jsonify({"error": "Error"}), 500

@admin_bp.put("/api/admin/profiles/<user_id>")
def update_user_profile_detail(user_id):
    ok, err = check_admin_access()
    if not ok: return err
    try:
        data = request.get_json() or {}
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503

        setter = {"updated_at": datetime.utcnow()}
        
        if "sex" in data: setter["sex"] = data["sex"]
        if "phone" in data: setter["phone"] = data["phone"]
        if "birth_date" in data: setter["birth_date"] = parse_birth_date(data["birth_date"])
        
        # arrays
        if "injuries" in data: setter["injuries"] = data["injuries"]
        if "equipment" in data: setter["equipment"] = data["equipment"]
        if "experience" in data: setter["experience"] = data["experience"]
        if "goals" in data: setter["goals"] = data["goals"]

        extensions.db.user_profiles.update_one(
            {"user_id": user_id},
            {"$set": setter},
            upsert=True
        )

        # Update base user info if present
        if "name" in data or "email" in data:
            usetter = {}
            if "name" in data: usetter["name"] = data["name"]
            if "email" in data: usetter["email"] = data["email"]
            extensions.db.users.update_one({"user_id": user_id}, {"$set": usetter})

        return jsonify({"message": "Perfil actualizado"}), 200
    except Exception as e:
        logger.error(f"Error update profile: {e}")
        return jsonify({"error": "Error"}), 500

# ======================================================
# API ENDPOINTS - ADMIN BODY ASSESSMENTS
# ======================================================
@admin_bp.get("/api/admin/body_assessments")
def list_body_assessments():
    ok, err = check_admin_access()
    if not ok: return err
    try:
        limit = int(request.args.get("limit", 20))
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        
        cursor = extensions.db.body_assessments.find({}).sort("created_at", -1).limit(limit)
        results = []
        for doc in cursor:
            uid = doc.get("user_id")
            uname = "Unknown"
            if uid:
                u = extensions.db.users.find_one({"user_id": uid}, {"name": 1, "username": 1})
                if u: uname = u.get("name") or u.get("username")

            results.append({
                "id": str(doc["_id"]),
                "user_id": uid,
                "user_name": uname,
                "created_at": doc.get("created_at"),
                "input": doc.get("input"),
                "output": doc.get("output")
            })
        return jsonify(results), 200
    except Exception as e:
        logger.error(f"Error list body assessments: {e}")
        return jsonify({"error": "Error"}), 500

# ======================================================
# API ENDPOINTS - EXERCISE CATALOG (SHARED/ADMIN)
# ======================================================
@admin_bp.get("/api/exercises")
def list_exercises():
    """Listado público/admin de ejercicios."""
    # Podríamos requerir auth, pero el dashboard público lo usa
    if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
    try:
        # Global + user custom? Por simplicidad, todos o globales de momento.
        # Originalmente mostraba todos.
        docs = list(extensions.db.exercises.find({}))
        # Convert _id
        for d in docs:
            d["_id"] = str(d["_id"])
        return jsonify(docs), 200
    except Exception as e:
        logger.error(f"Error listing exercises: {e}")
        return jsonify({"error": "Error"}), 500

@admin_bp.post("/api/exercises/save")
def save_exercise():
    ok, err = check_admin_access()
    if not ok: return err
    
    try:
        data = request.get_json()
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        
        oid = data.get("id")
        name = data.get("name")
        body_part = normalize_body_part(data.get("body_part"), extensions.db)
        alternative_names = normalize_string_list(
            data.get("alternative_names") or data.get("alternative names")
        )
        pattern = str(data.get("pattern") or "").strip()
        plane = str(data.get("plane") or "").strip()
        unilateral = normalize_bool(data.get("unilateral"), default=False)
        primary_muscle = str(data.get("primary_muscle") or "").strip()
        level = str(data.get("level") or "").strip()
        equipment_list = normalize_equipment_list(data.get("equipment"))
        
        if not name: return jsonify({"error": "Nombre es requerido"}), 400
        
        fields = {
            "name": name,
            "body_part": body_part,
            "type": data.get("type"),
            "equipment": equipment_list,
            "description": data.get("description"),
            "video_url": data.get("video_url"),
            "substitutes": data.get("substitutes", []),
            "alternative_names": alternative_names,
            "pattern": pattern,
            "plane": plane,
            "unilateral": unilateral,
            "primary_muscle": primary_muscle,
            "taxonomy": data.get("taxonomy"), # Added taxonomy field
            "level": level,
            "is_custom": False, # Admin created -> Global
            "updated_at": datetime.utcnow()
        }
        
        if oid:
            extensions.db.exercises.update_one({"_id": ObjectId(oid)}, {"$set": fields})
        else:
            fields["created_at"] = datetime.utcnow()
            extensions.db.exercises.insert_one(fields)
            
        return jsonify({"message": "Guardado"}), 200
    except Exception as e:
        logger.error(f"Error saving exercise: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.delete("/api/exercises/delete/<ex_id>")
def delete_exercise(ex_id):
    ok, err = check_admin_access()
    if not ok: return err
    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        extensions.db.exercises.delete_one({"_id": ObjectId(ex_id)})
        return jsonify({"message": "Eliminado"}), 200
    except Exception as e:
        logger.error(f"Error deleting exercise: {e}")
        return jsonify({"error": "Error interno"}), 500


# ======================================================
# API ENDPOINTS - PLANS MANAGEMENT (ADMIN)
# ======================================================
@admin_bp.get("/plans/<user_id>")
def get_user_plans(user_id):
    ok, err = check_admin_access()
    if not ok: return err
    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        limit = int(request.args.get("limit", 50))
        
        cursor = extensions.db.plans.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
        results = []
        for p in cursor:
            p["_id"] = str(p["_id"])
            results.append(p)
        return jsonify(results), 200
    except Exception as e:
        logger.error(f"Error getting plans: {e}")
        return jsonify({"error": "Error"}), 500

@admin_bp.post("/plans/<plan_id>/edit")
def edit_plan(plan_id):
    ok, err = check_admin_access()
    if not ok: return err
    try:
        data = request.get_json()
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        try:
            plan_oid = ObjectId(plan_id)
            plan_filter = {"_id": plan_oid}
        except Exception:
            plan_filter = {"_id": plan_id}
        
        # Merge changes deep? o simple replace?
        # El front envía estructura update: body -> nutrition_plan, etc.
        # Implementaremos un merge manual simple
        
        setter = {"updated_at": datetime.utcnow()}
        if "notes" in data: setter["notes"] = data["notes"]
        if "goal" in data: setter["goal"] = data["goal"]
        
        # update nested
        if "nutrition_plan" in data:
            for k, v in data["nutrition_plan"].items():
                setter[f"nutrition_plan.{k}"] = v
        
        if "training_plan" in data:
            for k, v in data["training_plan"].items():
                setter[f"training_plan.{k}"] = v
        
        res = extensions.db.plans.update_one(plan_filter, {"$set": setter})
        if res.matched_count == 0:
            return jsonify({"error": "Plan no encontrado"}), 404
        return jsonify({"message": "Plan actualizado"}), 200
    except Exception as e:
        logger.error(f"Error editing plan: {e}")
        return jsonify({"error": "Error"}), 500

@admin_bp.post("/plans/<plan_id>/deactivate")
def deactivate_plan(plan_id):
    ok, err = check_admin_access()
    if not ok: return err
    try:
        try:
            plan_oid = ObjectId(plan_id)
            plan_filter = {"_id": plan_oid}
        except Exception:
            plan_filter = {"_id": plan_id}
        res = extensions.db.plans.update_one(plan_filter, {"$set": {"active": False}})
        if res.matched_count == 0:
            return jsonify({"error": "Plan no encontrado"}), 404
        return jsonify({"message": "Desactivado"}), 200
    except Exception as e:
        return jsonify({"error": "Error"}), 500

@admin_bp.delete("/plans/<plan_id>")
def delete_plan(plan_id):
    ok, err = check_admin_access()
    if not ok: return err
    try:
        try:
            plan_oid = ObjectId(plan_id)
            plan_filter = {"_id": plan_oid}
        except Exception:
            plan_filter = {"_id": plan_id}
        res = extensions.db.plans.delete_one(plan_filter)
        if res.deleted_count == 0:
            return jsonify({"error": "Plan no encontrado"}), 404
        return jsonify({"message": "Eliminado"}), 200
    except Exception as e:
        return jsonify({"error": "Error"}), 500

@admin_bp.post("/generate_plan")
def simple_generate_plan():
    """Generador simple de plan (admin)"""
    ok, err = check_admin_access()
    if not ok: return err
    try:
        if not request.is_json:
            return jsonify({"error": "El cuerpo debe ser JSON"}), 415

        data = request.get_json() or {}
        uid = (data.get("user_id") or "").strip()
        if not uid:
            return jsonify({"error": "user_id requerido"}), 400

        now = datetime.utcnow()
        plan_doc = None
        message = "Plan generado"

        adj = extensions.db.ai_adjustments.find_one(
            {"user_id": uid},
            sort=[("created_at", -1)]
        )
        if adj:
            output = (adj.get("output") or {})
            ajustes = (output.get("ajustes") or {})
            food = (ajustes.get("plan_alimentacion") or {})
            macros = (food.get("macros") or {})
            train = (ajustes.get("plan_entrenamiento") or {})

            plan_doc = {
                "user_id": uid,
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
                "created_at": now,
                "activated_at": now,
            }
            message = "Plan creado desde ajuste AI"
        else:
            weight = data.get("weight_kg")
            goal = (data.get("goal") or "maintain").strip()
            if weight is None:
                return jsonify({"error": "weight_kg requerido"}), 400
            try:
                weight = float(weight)
            except (TypeError, ValueError):
                return jsonify({"error": "weight_kg invalido"}), 400

            if goal not in ["gain_muscle", "lose_fat", "maintain"]:
                return jsonify({"error": "goal invalido"}), 400

            if goal == "gain_muscle":
                calories = weight * 36
                macros = {"protein": 2.2 * weight, "carbs": 5 * weight, "fat": 0.9 * weight}
            elif goal == "lose_fat":
                calories = weight * 28
                macros = {"protein": 2 * weight, "carbs": 2.5 * weight, "fat": 0.8 * weight}
            else:
                calories = weight * 32
                macros = {"protein": 2 * weight, "carbs": 3.5 * weight, "fat": 0.85 * weight}

            plan_doc = {
                "user_id": uid,
                "goal": goal,
                "source": "base_generator",
                "notes": f"Generado manualmente (peso: {weight}kg)",
                "nutrition_plan": {
                    "calories_per_day": calories,
                    "kcal_delta": 0,
                    "macros": macros,
                },
                "training_plan": {
                    "cardio": "",
                    "ai_volumen_delta_ratio": None,
                },
                "ai_summary": {
                    "razonamiento_resumido": None,
                    "proxima_revision_dias": None,
                    "backend": "base_generator",
                    "adjustment_id": None,
                },
                "active": True,
                "created_at": now,
                "activated_at": now,
            }

        try:
            extensions.db.plans.update_many({"user_id": uid}, {"$set": {"active": False}})
        except Exception:
            pass

        res = extensions.db.plans.insert_one(plan_doc)
        plan_doc["_id"] = str(res.inserted_id)
        return jsonify({"message": message, "plan": plan_doc}), 201
    except Exception as e:
        logger.error(f"Generate err: {e}")
        return jsonify({"error": "Error"}), 500

# ======================================================
# API ENDPOINTS - ROUTINE BUILDER
# ======================================================

@admin_bp.get("/api/routines")
def list_admin_routines():
    """Lista todas las rutinas (admin view)."""
    ok, err = check_admin_access()
    if not ok: return err
    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        # Fetch all routines sorted by newer first
        cursor = extensions.db.routines.find({}).sort("created_at", -1)
        results = []
        for r in cursor:
            r["_id"] = str(r["_id"])
            user_id = r.get("user_id")
            if user_id:
                user_doc = extensions.db.users.find_one({"user_id": user_id})
                if not user_doc and ObjectId.is_valid(user_id):
                    user_doc = extensions.db.users.find_one({"_id": ObjectId(user_id)})
                if user_doc:
                    r["user_name"] = user_doc.get("name") or user_doc.get("username") or user_doc.get("email")
            results.append(r)
        return jsonify(results), 200
    except Exception as e:
        logger.error(f"Error list routines: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.get("/api/routines/<routine_id>")
def get_routine_detail(routine_id):
    """Obtiene detalle de una rutina por ID."""
    ok, err = check_admin_access()
    if not ok: return err
    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        r = extensions.db.routines.find_one({"_id": ObjectId(routine_id)})
        if not r:
            return jsonify({"error": "Rutina no encontrada"}), 404
        r["_id"] = str(r["_id"])
        return jsonify(r), 200
    except Exception as e:
        logger.error(f"Error get routine {routine_id}: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.route("/api/routines/<routine_id>", methods=["DELETE"])
def delete_routine_detail(routine_id):
    """Elimina una rutina y sus asignaciones."""
    ok, err = check_admin_access()
    if not ok: return err
    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        if not ObjectId.is_valid(routine_id):
            return jsonify({"error": "ID invalido"}), 400

        res = extensions.db.routines.delete_one({"_id": ObjectId(routine_id)})
        extensions.db.routine_assignments.delete_many({"routine_id": routine_id})

        if res.deleted_count == 0:
            return jsonify({"error": "Rutina no encontrada"}), 404

        return jsonify({"message": "Rutina eliminada"}), 200
    except Exception as e:
        logger.error(f"Error deleting routine {routine_id}: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.post("/api/routines/save")
def save_routine_builder():
    """Guarda o actualiza una rutina desde el builder."""
    ok, err = check_admin_access()
    if not ok: return err
    try:
        data = request.get_json()
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503

        rid = data.get("id")
        
        # Fields to persist
        doc = {
            "name": data.get("name"),
            "description": data.get("description"),
            "routine_day": data.get("routine_day"),
            "routine_body_parts": data.get("routine_body_parts", []),
            "items": normalize_routine_items(data.get("items", [])), # The structure from builder
            "updated_at": datetime.utcnow()
        }

        if rid:
            extensions.db.routines.update_one({"_id": ObjectId(rid)}, {"$set": doc})
            return jsonify({"message": "Rutina actualizada", "id": rid}), 200
        else:
            doc["created_at"] = datetime.utcnow()
            res = extensions.db.routines.insert_one(doc)
            return jsonify({"message": "Rutina creada", "id": str(res.inserted_id)}), 200

    except Exception as e:
        logger.error(f"Error save routine: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.get("/admin/routines/assign")
def admin_assign_routine_page():
    source = request.args.get("source") or "admin"
    return render_template("assign_routine.html", source=source)

@admin_bp.get("/admin/routines/assign-v2")
def admin_assign_routine_page_v2():
    source = request.args.get("source") or "admin"
    return render_template("assign_routine_v2.html", source=source)

@admin_bp.post("/api/admin/routines/assign")
def admin_api_assign_routine():
    """Asigna una rutina a un usuario (tabla de enlace)"""
    ok, err = check_admin_access()
    if not ok: return err

    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        data = request.json
        user_id = data.get("user_id")
        routine_id = data.get("routine_id")
        valid_days_raw = data.get("valid_days")

        if not user_id or not routine_id:
            return jsonify({"error": "Faltan datos"}), 400

        try:
            valid_days = int(valid_days_raw)
        except (TypeError, ValueError):
            valid_days = 0

        if valid_days <= 0:
            return jsonify({"error": "Los dias de vigencia deben ser mayor a 0"}), 400

        # Verificar si ya existe asignacion activa
        exists = extensions.db.routine_assignments.find_one({
            "user_id": user_id,
            "routine_id": routine_id,
            "active": True
        })

        if exists:
            expires_at = exists.get("expires_at")
            if isinstance(expires_at, datetime) and expires_at <= datetime.utcnow():
                extensions.db.routine_assignments.update_one(
                    {"_id": exists["_id"]},
                    {"$set": {"active": False, "expired_at": datetime.utcnow()}}
                )
            else:
                return jsonify({"message": "Ya esta asignada"}), 200

        # Crear asignacion
        assigned_at = datetime.utcnow()
        expires_at = assigned_at + timedelta(days=valid_days)
        assignment = {
            "user_id": user_id,
            "routine_id": routine_id,
            "assigned_at": assigned_at,
            "expires_at": expires_at,
            "valid_days": valid_days,
            "active": True
        }
        extensions.db.routine_assignments.insert_one(assignment)
        return jsonify({"message": "Rutina asignada correctamente"}), 200
    except Exception as e:
        logger.error(f"Error assigning routine: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.get("/api/admin/routines/assignments")
def admin_api_list_assignments():
    """Lista asignaciones activas por usuario."""
    ok, err = check_admin_access()
    if not ok: return err

    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        user_id = request.args.get("user_id")
        if not user_id:
            return jsonify({"error": "Falta user_id"}), 400

        now = datetime.utcnow()
        extensions.db.routine_assignments.update_many(
            {"user_id": user_id, "active": True, "expires_at": {"$lte": now}},
            {"$set": {"active": False, "expired_at": now}}
        )

        cursor = extensions.db.routine_assignments.find({
            "user_id": user_id,
            "active": True,
            "$or": [
                {"expires_at": {"$exists": False}},
                {"expires_at": None},
                {"expires_at": {"$gt": now}}
            ]
        }, {"routine_id": 1, "expires_at": 1, "valid_days": 1, "assigned_at": 1})

        results = []
        for doc in cursor:
            expires_at = doc.get("expires_at")
            assigned_at = doc.get("assigned_at")
            routine_id = doc.get("routine_id")
            if isinstance(expires_at, datetime):
                expires_at = expires_at.isoformat()
            if isinstance(assigned_at, datetime):
                assigned_at = assigned_at.isoformat()
            if isinstance(routine_id, ObjectId):
                routine_id = str(routine_id)

            results.append({
                "assignment_id": str(doc.get("_id")),
                "routine_id": routine_id,
                "expires_at": expires_at,
                "valid_days": doc.get("valid_days"),
                "assigned_at": assigned_at
            })

        return jsonify(results), 200
    except Exception as e:
        logger.error(f"Error listing routine assignments: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.post("/api/admin/routines/unassign")
def admin_api_unassign_routine():
    """Desactiva una asignacion de rutina a un usuario."""
    ok, err = check_admin_access()
    if not ok: return err

    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        data = request.json or {}
        user_id = data.get("user_id")
        routine_id = data.get("routine_id")
        if not user_id or not routine_id:
            return jsonify({"error": "Faltan datos"}), 400

        res = extensions.db.routine_assignments.update_many(
            {"user_id": user_id, "routine_id": routine_id, "active": True},
            {"$set": {"active": False, "unassigned_at": datetime.utcnow()}}
        )

        if res.modified_count == 0:
            return jsonify({"message": "No habia asignacion activa"}), 200

        return jsonify({"message": "Rutina removida"}), 200
    except Exception as e:
        logger.error(f"Error unassigning routine: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.post("/api/admin/routines/assignments/update")
def admin_api_update_assignment():
    """Actualiza vigencia de una asignacion activa."""
    ok, err = check_admin_access()
    if not ok: return err

    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        data = request.json or {}
        user_id = data.get("user_id")
        routine_id = data.get("routine_id")
        assignment_id = data.get("assignment_id")
        valid_days_raw = data.get("valid_days")

        if not user_id or not routine_id:
            return jsonify({"error": "Faltan datos"}), 400

        try:
            valid_days = int(valid_days_raw)
        except (TypeError, ValueError):
            valid_days = 0

        if valid_days <= 0:
            return jsonify({"error": "Los dias de vigencia deben ser mayor a 0"}), 400

        assigned_at = datetime.utcnow()
        expires_at = assigned_at + timedelta(days=valid_days)

        if assignment_id and ObjectId.is_valid(assignment_id):
            query = {"_id": ObjectId(assignment_id), "user_id": user_id, "active": True}
        else:
            routine_match = routine_id
            if ObjectId.is_valid(routine_id):
                routine_match = {"$in": [routine_id, ObjectId(routine_id)]}
            query = {"user_id": user_id, "routine_id": routine_match, "active": True}

        res = extensions.db.routine_assignments.update_one(
            query,
            {"$set": {"valid_days": valid_days, "expires_at": expires_at, "updated_at": assigned_at}}
        )

        if res.matched_count == 0:
            return jsonify({"error": "Asignacion activa no encontrada"}), 404

        return jsonify({"message": "Vigencia actualizada"}), 200
    except Exception as e:
        logger.error(f"Error updating routine assignment: {e}")
        return jsonify({"error": "Error interno"}), 500

@admin_bp.get("/admin/api/users/<user_id>/full_profile")
def get_user_full_profile(user_id):
    """Retorna perfil completo (User + Profile) para Body Assessment."""
    ok, err = check_admin_access()
    if not ok: return err
    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        
        u = extensions.db.users.find_one({"user_id": user_id})
        if not u: return jsonify({"error": "Usuario no encontrado"}), 404
        
        p = extensions.db.user_profiles.find_one({"user_id": user_id}) or {}
        
        # Merge basic info
        data = {
            "user_id": u.get("user_id"),
            "name": u.get("name"),
            "email": u.get("email"),
            "username": u.get("username"),
            "sex": p.get("sex"),
            "birth_date": format_birth_date(p.get("birth_date")),
            "age": compute_age(p.get("birth_date")),
            "height": p.get("height"), # field exists? if not null
            "weight": p.get("weight"), # field exists?
            "goals": p.get("goals"),
            "experience": p.get("experience"),
            "injuries": p.get("injuries"),
            "equipment": p.get("equipment"),
            "equipment": p.get("equipment"),
            "measurements": p.get("measurements", {})
        }

        # Try to load latest body assessment for more recent data
        latest_assessment = extensions.db.body_assessments.find_one(
            {"user_id": user_id},
            sort=[("created_at", -1)]
        )
        if latest_assessment:
            inp = latest_assessment.get("input", {})
            # Prioritize assessment data for measurements and activity if available
            if inp.get("measurements"):
                data["measurements"] = inp.get("measurements")
            if inp.get("activity_level"):
                data["activity_level"] = inp.get("activity_level") # Inject activity_level
            if inp.get("goal"):
                data["goals"] = inp.get("goal") # Override goal if present in assessment

        return jsonify(data), 200
    except Exception as e:
        logger.error(f"Error full profile: {e}")
        return jsonify({"error": "Error interno"}), 500



# ======================================================
# OPTIMIZED PAGINATION ENDPOINTS
# ======================================================



# ======================================================
# API ENDPOINTS - ADMIN ONBOARDING
# ======================================================

@admin_bp.route("/admin/onboarding_submissions")
def admin_onboarding_page():
    return render_template("admin_onboarding_submissions.html")

@admin_bp.get("/api/admin/onboarding/history/<user_id>")
def get_onboarding_history(user_id):
    """Obtiene el historial de onboarding submissions de un usuario."""
    ok, err = check_admin_access()
    if not ok: return err
    try:
        if extensions.db is None: return jsonify({"error": "DB not ready"}), 503
        
        # Buscar en onboarding_submissions
        cursor = extensions.db.onboarding_submissions.find({"user_id": user_id}).sort("submission_date", -1)
        
        results = []
        for sub in cursor:
            # sub["data"] es el contenido del wizard
            # sub["submission_date"] es la fecha
            data = sub.get("data", {})
            date_val = sub.get("submission_date")
            if isinstance(date_val, datetime):
                date_str = date_val.strftime("%Y-%m-%d %H:%M")
            else:
                date_str = str(date_val)
                
            results.append({
                "id": str(sub.get("_id")),
                "date": date_str,
                "data": data
            })
            
        return jsonify(results), 200
    except Exception as e:
        logger.error(f"Error getting onboarding history: {e}")
        return jsonify({"error": "Error interno"}), 500
